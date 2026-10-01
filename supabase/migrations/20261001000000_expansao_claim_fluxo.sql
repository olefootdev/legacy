-- ═══════════════════════════════════════════════════════════════════════════
-- FLUXO DE CLAIM — o saque do bônus de equiparação (P1 do raio-x 30/09)
--
-- A tabela `expansao_claim` existia desde 20260928140000 e estava INERTE:
-- nenhuma função de pedir, aprovar, recusar ou pagar. Este arquivo liga a
-- máquina inteira:
--
--   · `expansao_claim_pedir()`  — o JOGADOR pede. Saca TUDO que está
--     disponível, para a carteira Solana VINCULADA E VERIFICADA (a mesma que
--     o PIN protege — não existe campo de endereço livre, senão o claim vira
--     o desvio da verificação por assinatura). Conta com PIN assina com ele.
--   · `expansao_claim_aprovar/recusar/pagar` — o ADMIN opera a fila, só por
--     service_role (as rotas /api/admin/expansao/claims, com step-up de
--     login recente). O que destrava o pagamento é decisão HUMANA: nenhum
--     claim se paga sozinho — `pagar` exige a assinatura da transação
--     on-chain que o admin fez na tesouraria.
--
-- O número disponível é EXATAMENTE o que `expansao_meu_bonus()` mostra:
-- cada liquidação convertida pelo preço GRAVADO no ciclo dela
-- (floor(bonus_contabil × 1e6 / preco_micro)) + prêmios de carreira −
-- claims vivos. "Vivo" aqui inclui o PENDENTE — o meu_bonus só desconta
-- aprovado/pago porque mostra "sacado", mas pedir de novo em cima de um
-- pendente duplicaria o saldo.
--
-- líquido × bruto: a taxa de 5% do Token-2022 morde NA TRANSFERÊNCIA. O
-- jogador vê e recebe o líquido; a tesouraria debita o bruto. A fórmula do
-- gross-up espelha server/src/lib/expansao/taxaDeTransferencia.ts: menor
-- bruto que entrega AO MENOS o líquido, com a taxa arredondada PARA CIMA
-- como o spl-token-2022 faz.
-- ═══════════════════════════════════════════════════════════════════════════

-- Um pedido vivo por vez: o segundo `pedir` concorrente esbarra aqui, não em
-- leitura defasada do saldo.
create unique index if not exists expansao_claim_um_pendente
  on public.expansao_claim (user_id) where status = 'pendente';

-- ─── o saldo que pode ser pedido ───────────────────────────────────────────
create or replace function public.expansao_claim_disponivel_interno(p_user uuid)
returns numeric language sql stable security definer set search_path = public
as $$
  with l as (
    select coalesce(sum(floor(li.bonus_contabil * 1000000 / c.preco_micro)), 0) as tok
      from expansao_liquidacao li
      join expansao_ciclo c on c.id = li.ciclo_id
     where li.user_id = p_user
  ),
  p as (
    select coalesce(sum(pc.olefoot), 0) as tok
      from expansao_premio_carreira pc
     where pc.user_id = p_user
  ),
  cl as (
    select coalesce(sum(c.olefoot_liquido), 0) as tok
      from expansao_claim c
     where c.user_id = p_user and c.status in ('pendente', 'aprovado', 'pago')
  )
  select greatest(l.tok + p.tok - cl.tok, 0) from l, p, cl;
$$;
revoke all on function public.expansao_claim_disponivel_interno(uuid) from public, anon, authenticated;
grant execute on function public.expansao_claim_disponivel_interno(uuid) to service_role;

-- ─── gross-up da taxa de 5%: o bruto que a tesouraria debita ───────────────
-- taxa = ceil(bruto × 500 / 10000), como o `calculate_fee` do spl-token-2022.
-- O palpite contínuo pode entregar 1 a menos por arredondamento; o laço sobe
-- até fechar (provado por verificação, não por álgebra — igual ao TS).
create or replace function public.expansao_claim_bruto_interno(p_liquido numeric)
returns numeric language plpgsql immutable set search_path = public
as $$
declare v_bruto numeric := ceil(p_liquido * 10000 / 9500);
begin
  while v_bruto - ceil(v_bruto * 500 / 10000) < p_liquido loop
    v_bruto := v_bruto + 1;
  end loop;
  return v_bruto;
end;
$$;
revoke all on function public.expansao_claim_bruto_interno(numeric) from public, anon, authenticated;
grant execute on function public.expansao_claim_bruto_interno(numeric) to service_role;

-- ─── pedir (o jogador) ─────────────────────────────────────────────────────
-- Motivos: carteira_nao_vinculada · pin_obrigatorio · pin_errado ·
-- muitas_tentativas · claim_pendente · sem_saldo. Sem exceção pra fluxo — a
-- tela decide o que dizer, no padrão do PIN.
create or replace function public.expansao_claim_pedir(p_pin text default null)
returns table (ok boolean, motivo text, tenta_de_novo_em integer,
               claim_id bigint, olefoot numeric, wallet text)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_wallet text;
  v_disp numeric;
  v_pin record;
  v_id bigint;
begin
  if v_uid is null then raise exception 'must be authenticated'; end if;

  -- O destino é a carteira verificada por assinatura — nunca um campo livre.
  select w.wallet_address into v_wallet
    from solana_wallet_links w
   where w.user_id = v_uid and w.verified = true;
  if v_wallet is null then
    return query select false, 'carteira_nao_vinculada'::text, 0, null::bigint, null::numeric, null::text;
    return;
  end if;

  -- Conta que trancou a carteira com PIN assina o saque com ele.
  if exists (select 1 from carteira_pin cp where cp.user_id = v_uid) then
    select * into v_pin from public.carteira_pin_conferir_interno(v_uid, p_pin);
    if not v_pin.ok then
      return query select false, coalesce(v_pin.motivo, 'pin_errado'),
                          v_pin.tenta_de_novo_em, null::bigint, null::numeric, null::text;
      return;
    end if;
  end if;

  if exists (select 1 from expansao_claim c where c.user_id = v_uid and c.status = 'pendente') then
    return query select false, 'claim_pendente'::text, 0, null::bigint, null::numeric, null::text;
    return;
  end if;

  v_disp := public.expansao_claim_disponivel_interno(v_uid);
  if v_disp <= 0 then
    return query select false, 'sem_saldo'::text, 0, null::bigint, null::numeric, null::text;
    return;
  end if;

  begin
    insert into expansao_claim (user_id, ref, olefoot_liquido, olefoot_bruto, wallet, status, achados)
    values (v_uid, 'claim-' || gen_random_uuid(), v_disp,
            public.expansao_claim_bruto_interno(v_disp), v_wallet, 'pendente',
            jsonb_build_object('pedido_em', now(), 'disponivel_no_pedido', v_disp))
    returning id into v_id;
  exception when unique_violation then
    -- O índice parcial segurou um pedir concorrente.
    return query select false, 'claim_pendente'::text, 0, null::bigint, null::numeric, null::text;
    return;
  end;

  return query select true, null::text, 0, v_id, v_disp, v_wallet;
end;
$$;
revoke all on function public.expansao_claim_pedir(text) from public, anon;
grant execute on function public.expansao_claim_pedir(text) to authenticated, service_role;

-- ─── a fila do admin ───────────────────────────────────────────────────────
create or replace function public.expansao_claim_listar(p_status text default null, p_limite integer default 200)
returns table (claim_id bigint, user_id uuid, username text, wallet text,
               olefoot_liquido numeric, olefoot_bruto numeric, status text,
               criado_em timestamptz, pago_em timestamptz, achados jsonb)
language sql stable security definer set search_path = public
as $$
  select c.id, c.user_id, pr.username, c.wallet,
         c.olefoot_liquido, c.olefoot_bruto, c.status,
         c.criado_em, c.pago_em, c.achados
    from expansao_claim c
    left join profiles pr on pr.id = c.user_id
   where p_status is null or c.status = p_status
   order by c.criado_em desc
   limit least(greatest(coalesce(p_limite, 200), 1), 1000);
$$;
revoke all on function public.expansao_claim_listar(text, integer) from public, anon, authenticated;
grant execute on function public.expansao_claim_listar(text, integer) to service_role;

-- Erro com prefixo CLAIM_XXX: vira 400 com a frase na rota (padrão LICENCA_).
create or replace function public.expansao_claim_aprovar(p_id bigint, p_por text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_status text;
begin
  update expansao_claim
     set status = 'aprovado',
         achados = coalesce(achados, '{}'::jsonb)
           || jsonb_build_object('aprovado_por', p_por, 'aprovado_em', now())
   where id = p_id and status = 'pendente';
  if found then return true; end if;

  select c.status into v_status from expansao_claim c where c.id = p_id;
  if v_status is null then raise exception 'CLAIM_INEXISTENTE: Claim % não existe.', p_id; end if;
  raise exception 'CLAIM_ESTADO: Claim % está "%" — só o pendente se aprova.', p_id, v_status;
end;
$$;

create or replace function public.expansao_claim_recusar(p_id bigint, p_por text, p_motivo text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_status text;
begin
  -- Recusar devolve o valor ao saldo disponível na mesma hora (o disponível
  -- só desconta pendente/aprovado/pago). Pago não se recusa — já saiu token.
  update expansao_claim
     set status = 'recusado',
         achados = coalesce(achados, '{}'::jsonb)
           || jsonb_build_object('recusado_por', p_por, 'recusado_em', now(),
                                 'motivo_recusa', nullif(trim(coalesce(p_motivo, '')), ''))
   where id = p_id and status in ('pendente', 'aprovado');
  if found then return true; end if;

  select c.status into v_status from expansao_claim c where c.id = p_id;
  if v_status is null then raise exception 'CLAIM_INEXISTENTE: Claim % não existe.', p_id; end if;
  raise exception 'CLAIM_ESTADO: Claim % está "%" — pago não se recusa.', p_id, v_status;
end;
$$;

create or replace function public.expansao_claim_pagar(p_id bigint, p_por text, p_tx text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_status text;
begin
  -- A assinatura da transação on-chain é OBRIGATÓRIA: "pago" sem prova é só
  -- uma palavra. É ela que deixa qualquer um conferir o claim no explorer.
  if nullif(trim(coalesce(p_tx, '')), '') is null then
    raise exception 'CLAIM_TX: Informe a assinatura da transação on-chain.';
  end if;

  update expansao_claim
     set status = 'pago', pago_em = now(),
         achados = coalesce(achados, '{}'::jsonb)
           || jsonb_build_object('pago_por', p_por, 'tx', trim(p_tx))
   where id = p_id and status = 'aprovado';
  if found then return true; end if;

  select c.status into v_status from expansao_claim c where c.id = p_id;
  if v_status is null then raise exception 'CLAIM_INEXISTENTE: Claim % não existe.', p_id; end if;
  raise exception 'CLAIM_ESTADO: Claim % está "%" — só o aprovado se paga.', p_id, v_status;
end;
$$;

revoke all on function public.expansao_claim_aprovar(bigint, text) from public, anon, authenticated;
revoke all on function public.expansao_claim_recusar(bigint, text, text) from public, anon, authenticated;
revoke all on function public.expansao_claim_pagar(bigint, text, text) from public, anon, authenticated;
grant execute on function public.expansao_claim_aprovar(bigint, text) to service_role;
grant execute on function public.expansao_claim_recusar(bigint, text, text) to service_role;
grant execute on function public.expansao_claim_pagar(bigint, text, text) to service_role;

comment on table public.expansao_claim is
  'Saques do bônus de equiparação. pedir (jogador, carteira verificada + PIN
   se houver) → pendente → aprovar/recusar (admin) → pagar com assinatura
   on-chain. Disponível = liquidações pelo preço do ciclo + prêmios − claims
   vivos (pendente conta). Um pendente por conta (índice parcial).';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — roda aqui, num savepoint que termina em raise e não deixa
-- rastro. No PGlite do `npm run test:claim-expansao` ela roda inteira; em
-- produção pula se não houver conta.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_chegou boolean := false;
  v_user uuid;
  v_ciclo bigint;
  v_r record;
  v_claim bigint;
  v_bruto numeric;
begin
  -- As portas primeiro: são elas que custam caro erradas.
  if has_function_privilege('anon', 'public.expansao_claim_pedir(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.expansao_claim_pedir(text)', 'execute')
     or has_function_privilege('authenticated', 'public.expansao_claim_listar(text,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.expansao_claim_aprovar(bigint,text)', 'execute')
     or has_function_privilege('authenticated', 'public.expansao_claim_recusar(bigint,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.expansao_claim_pagar(bigint,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.expansao_claim_disponivel_interno(uuid)', 'execute') then
    raise exception 'uma função do claim ficou com a porta errada';
  end if;

  select id into v_user from auth.users u
   where not exists (select 1 from public.expansao_claim c where c.user_id = u.id)
     and not exists (select 1 from public.carteira_pin p where p.user_id = u.id)
     and not exists (select 1 from public.solana_wallet_links w where w.user_id = u.id)
   limit 1;
  if v_user is null then
    raise notice 'sem conta limpa neste ambiente: verificação do claim pulada';
    return;
  end if;

  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

    -- Um ciclo de mentira no passado distante (não colide com a janela única)
    -- paga $1,00 → 8000 OLEFOOT a $0,000125; mais um prêmio de 500.
    insert into public.expansao_ciclo (abre_em, fecha_em, status, preco_micro)
    values ('2001-01-01T00:00:00Z', '2001-01-01T01:00:00Z', 'SETTLED', 12500)
    returning id into v_ciclo;
    insert into public.expansao_liquidacao (ciclo_id, user_id, equiparado, bonus_contabil)
    values (v_ciclo, v_user, 0, 100);
    insert into public.expansao_premio_carreira (user_id, degrau, olefoot, acumulado)
    values (v_user, 'CAMPEAO', 500, 0);

    if public.expansao_claim_disponivel_interno(v_user) <> 8500 then
      raise exception 'disponível devia ser 8500, veio %',
        public.expansao_claim_disponivel_interno(v_user);
    end if;

    -- Sem carteira vinculada, não há destino.
    select * into v_r from public.expansao_claim_pedir(null);
    if v_r.ok or v_r.motivo <> 'carteira_nao_vinculada' then
      raise exception 'sem carteira devia recusar, veio %', v_r.motivo; end if;

    insert into public.solana_wallet_links
      (user_id, wallet_address, verified, verified_at, proof_message, proof_signature)
    values (v_user, 'VERIFICACAOCLAIM11111111111111111111111111111', true, now(), 'prova', 'assinatura');

    -- Pede: saca TUDO, pro endereço vinculado, e o bruto cobre a taxa de 5%.
    select * into v_r from public.expansao_claim_pedir(null);
    if not v_r.ok or v_r.olefoot <> 8500
       or v_r.wallet <> 'VERIFICACAOCLAIM11111111111111111111111111111' then
      raise exception 'pedir falhou: % % %', v_r.motivo, v_r.olefoot, v_r.wallet; end if;
    v_claim := v_r.claim_id;
    select c.olefoot_bruto into v_bruto from public.expansao_claim c where c.id = v_claim;
    if v_bruto - ceil(v_bruto * 500 / 10000) < 8500
       or (v_bruto - 1) - ceil((v_bruto - 1) * 500 / 10000) >= 8500 then
      raise exception 'bruto % não é o MENOR que entrega 8500', v_bruto; end if;

    -- Pendente trava o segundo pedido e zera o disponível.
    select * into v_r from public.expansao_claim_pedir(null);
    if v_r.ok or v_r.motivo <> 'claim_pendente' then
      raise exception 'segundo pedir devia travar, veio %', v_r.motivo; end if;
    if public.expansao_claim_disponivel_interno(v_user) <> 0 then
      raise exception 'pendente não zerou o disponível'; end if;

    -- A máquina de estados do admin.
    begin
      perform public.expansao_claim_pagar(v_claim, 'verificacao', 'tx-teste');
      raise exception 'pagou sem aprovar';
    exception when others then
      if sqlerrm not like 'CLAIM_ESTADO:%' then raise; end if;
    end;
    if not public.expansao_claim_aprovar(v_claim, 'verificacao') then
      raise exception 'aprovar devolveu false'; end if;
    select * into v_r from public.expansao_claim_pedir(null);
    if v_r.ok or v_r.motivo <> 'sem_saldo' then
      raise exception 'aprovado devia continuar descontando, veio %', v_r.motivo; end if;
    begin
      perform public.expansao_claim_pagar(v_claim, 'verificacao', '   ');
      raise exception 'pagou sem assinatura';
    exception when others then
      if sqlerrm not like 'CLAIM_TX:%' then raise; end if;
    end;
    if not public.expansao_claim_pagar(v_claim, 'verificacao', 'tx-teste') then
      raise exception 'pagar devolveu false'; end if;
    begin
      perform public.expansao_claim_recusar(v_claim, 'verificacao', 'tarde demais');
      raise exception 'recusou claim pago';
    exception when others then
      if sqlerrm not like 'CLAIM_ESTADO:%' then raise; end if;
    end;

    -- Recusar DEVOLVE o saldo: nova liquidação, pede, recusa, pede de novo.
    insert into public.expansao_liquidacao (ciclo_id, user_id, equiparado, bonus_contabil, sobra_t1)
    values (v_ciclo, v_user, 0, 100, 1)
    on conflict (ciclo_id, user_id) do nothing;
    update public.expansao_liquidacao set bonus_contabil = bonus_contabil + 100
     where ciclo_id = v_ciclo and user_id = v_user;
    select * into v_r from public.expansao_claim_pedir(null);
    if not v_r.ok or v_r.olefoot <> 8000 then
      raise exception 'nova liquidação devia liberar 8000, veio % %', v_r.motivo, v_r.olefoot; end if;
    perform public.expansao_claim_recusar(v_r.claim_id, 'verificacao', 'teste');
    select * into v_r from public.expansao_claim_pedir(null);
    if not v_r.ok or v_r.olefoot <> 8000 then
      raise exception 'recusado não devolveu o saldo: % %', v_r.motivo, v_r.olefoot; end if;

    -- Conta com PIN assina o saque: sem ele não anda, com o certo anda.
    perform public.expansao_claim_recusar(v_r.claim_id, 'verificacao', 'teste do pin');
    insert into public.carteira_pin (user_id, pin_hash)
    values (v_user, extensions.crypt('123456', extensions.gen_salt('bf')));
    select * into v_r from public.expansao_claim_pedir(null);
    if v_r.ok or v_r.motivo <> 'pin_obrigatorio' then
      raise exception 'com PIN criado devia exigir PIN, veio %', v_r.motivo; end if;
    select * into v_r from public.expansao_claim_pedir('654321');
    if v_r.ok or v_r.motivo <> 'pin_errado' then
      raise exception 'PIN errado devia recusar, veio %', v_r.motivo; end if;
    select * into v_r from public.expansao_claim_pedir('123456');
    if not v_r.ok then raise exception 'PIN certo falhou: %', v_r.motivo; end if;

    -- A fila do admin mostra o claim com quem pediu.
    if not exists (select 1 from public.expansao_claim_listar('pendente', 10) l
                    where l.claim_id = v_r.claim_id and l.user_id = v_user) then
      raise exception 'a fila não mostrou o claim pendente'; end if;

    v_chegou := true;
    raise exception 'DESFAZ_A_VERIFICACAO';
  exception when others then
    if sqlerrm <> 'DESFAZ_A_VERIFICACAO' then raise; end if;
  end;

  perform set_config('request.jwt.claims', '', true);
  if not v_chegou then raise exception 'a verificação não chegou ao fim'; end if;
  if exists (select 1 from public.expansao_claim c where c.user_id = v_user)
     or exists (select 1 from public.carteira_pin p where p.user_id = v_user)
     or exists (select 1 from public.solana_wallet_links w where w.user_id = v_user) then
    raise exception 'a verificação deixou rastro';
  end if;
end $$;

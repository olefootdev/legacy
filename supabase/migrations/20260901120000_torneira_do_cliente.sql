-- ════════════════════════════════════════════════════════════════════════════
-- ONDA 0 · A TORNEIRA DO CLIENTE — parte 1: fechar as bocas sem uso legítimo
-- ════════════════════════════════════════════════════════════════════════════
-- Varredura de 2026-09-01. O cliente escreve dinheiro e elegibilidade direto no
-- banco, por três caminhos distintos:
--
--   1. `manager_game_state.finance`      — o saldo inteiro vem do browser
--   2. `profiles.exp_lifetime_earned`    — UPDATE direto por column grant
--   3. `sync_my_exp_lifetime(p_amount)`  — RPC que aceita o valor sem validar
--
-- O caminho 2 é o que esta migration fecha, junto com o cofre do ledger. O 1 e
-- o 3 dependem de o servidor saber CALCULAR o prêmio — que é a parte seguinte
-- da Onda 0 e não cabe aqui.
--
-- Por que o 2 é seguro fechar agora: uma varredura no repositório inteiro
-- (jogo + revela + server) achou UMA escrita do cliente em `profiles`, e ela
-- grava `display_name`. Todas as outras passam por função SECURITY DEFINER
-- (`admin_set_user_status`, `admin_set_verification`, `sync_my_exp_lifetime`),
-- que não é afetada por grant de coluna.
--
-- Por que importa: `exp_lifetime_earned` é o que define "indicado ATIVO" na
-- régua dos marcos de rede — cujo primeiro degrau paga 200.000 EXP. Com UPDATE
-- direto, qualquer conta se declarava ativa.


-- ── 1 · profiles: o cliente só escreve o próprio nome ───────────────────────
revoke update on public.profiles from anon, authenticated;

-- `display_name` é a única coluna que o cliente grava hoje
-- (src/supabase/profileDisplayName.ts). `anon` não precisa de UPDATE nenhum.
grant update (display_name) on public.profiles to authenticated;


-- ── 2 · finance_ledger_entries: cofre, não caderno de rascunho ──────────────
-- O ledger nasceu para ser a fonte da verdade do dinheiro e hoje está VAZIO,
-- com o cliente segurando INSERT, UPDATE, DELETE e TRUNCATE. Antes de ele valer
-- como prova de qualquer coisa, precisa ser append-only e escrito pelo servidor.
-- SELECT continua (a RLS já filtra por dono).
revoke insert, update, delete, truncate on public.finance_ledger_entries
  from anon, authenticated;


-- ── 3 · medidor na boca que sobrou ─────────────────────────────────────────
-- `sync_my_exp_lifetime` continua aceitando o valor do cliente — fechá-la agora
-- pararia a progressão de todo mundo, porque nada no servidor calcula prêmio
-- ainda. O que dá pra fazer hoje é MEDIR: cada reivindicação fica registrada
-- com o antes e o depois, para que a reconciliação da parte 2 saiba quais
-- contas inflaram.
create table if not exists public.exp_lifetime_claims (
  id           bigserial primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  claimed      bigint not null,
  previous     bigint not null,
  applied      boolean not null,
  claimed_at   timestamptz not null default now()
);

create index if not exists exp_lifetime_claims_user_idx
  on public.exp_lifetime_claims (user_id, claimed_at desc);

alter table public.exp_lifetime_claims enable row level security;

-- ninguém do lado do cliente lê nem escreve: é trilha de auditoria
revoke all on public.exp_lifetime_claims from anon, authenticated;

comment on table public.exp_lifetime_claims is
  'Auditoria das chamadas a sync_my_exp_lifetime. O cliente declara o próprio '
  'lifetime EXP enquanto o servidor não calcula prêmio (Onda 0, parte 2). '
  'Serve para reconciliar contas infladas quando o cálculo migrar pro servidor.';

-- Corpo copiado da FONTE (pg_get_functiondef em 2026-09-01), com o registro de
-- auditoria acrescentado. Regra 3 do template: não reescrever de cabeça.
create or replace function public.sync_my_exp_lifetime(p_amount bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_previous bigint;
  v_applied boolean := false;
begin
  if v_uid is null then
    raise exception 'must be authenticated';
  end if;
  if p_amount is null or p_amount < 0 then
    return;
  end if;

  select exp_lifetime_earned into v_previous
    from public.profiles where id = v_uid;

  update public.profiles
     set exp_lifetime_earned = greatest(exp_lifetime_earned, p_amount)
   where id = v_uid
     and exp_lifetime_earned < p_amount;

  v_applied := found;

  insert into public.exp_lifetime_claims (user_id, claimed, previous, applied)
  values (v_uid, p_amount, coalesce(v_previous, 0), v_applied);
end;
$function$;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — exercita o caminho novo, não a existência dele
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_uid uuid;
  v_antes bigint;
  v_linhas int;
begin
  -- 1. o cliente perdeu UPDATE nas colunas que não são dele
  if has_column_privilege('authenticated', 'public.profiles',
                          'exp_lifetime_earned', 'UPDATE') then
    raise exception 'authenticated ainda escreve profiles.exp_lifetime_earned';
  end if;
  if has_column_privilege('authenticated', 'public.profiles',
                          'verification_status', 'UPDATE') then
    raise exception 'authenticated ainda escreve profiles.verification_status';
  end if;
  if has_column_privilege('anon', 'public.profiles',
                          'exp_lifetime_earned', 'UPDATE') then
    raise exception 'anon ainda escreve profiles.exp_lifetime_earned';
  end if;

  -- 2. mas continua escrevendo o que precisa — senão o cadastro quebra
  if not has_column_privilege('authenticated', 'public.profiles',
                              'display_name', 'UPDATE') then
    raise exception 'authenticated perdeu display_name — o cadastro quebraria';
  end if;

  -- 3. o ledger virou append-only pro cliente
  if has_table_privilege('authenticated', 'public.finance_ledger_entries', 'DELETE')
     or has_table_privilege('authenticated', 'public.finance_ledger_entries', 'INSERT')
  then
    raise exception 'cliente ainda escreve/apaga finance_ledger_entries';
  end if;
  if not has_table_privilege('authenticated', 'public.finance_ledger_entries', 'SELECT') then
    raise exception 'cliente perdeu a leitura do próprio ledger';
  end if;

  -- 4. a função auditada de fato registra — chamada real, com usuário real
  select id, exp_lifetime_earned into v_uid, v_antes
    from public.profiles order by created_at limit 1;

  if v_uid is null then
    raise notice 'verificação: sem perfis para exercitar sync_my_exp_lifetime';
  else
    -- p_amount menor que o atual: não altera o saldo, mas TEM que auditar.
    -- `auth.uid()` lê `request.jwt.claim.sub` primeiro (conferido na fonte).
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    perform public.sync_my_exp_lifetime(0);

    select count(*) into v_linhas
      from public.exp_lifetime_claims
     where user_id = v_uid and claimed = 0;

    if v_linhas = 0 then
      raise exception 'sync_my_exp_lifetime não gravou auditoria';
    end if;

    if (select exp_lifetime_earned from public.profiles where id = v_uid)
       is distinct from v_antes then
      raise exception 'sync_my_exp_lifetime alterou saldo numa chamada que não devia';
    end if;

    -- limpa a linha de teste; a auditoria de verdade começa vazia
    delete from public.exp_lifetime_claims where user_id = v_uid and claimed = 0;
    perform set_config('request.jwt.claim.sub', '', true);
  end if;

  raise notice 'verificação: ok — torneira de profiles e do ledger fechada';
end $$;

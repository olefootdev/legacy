-- ═══════════════════════════════════════════════════════════════════════════
-- NETWORK — quem é quem na minha rede
--
-- Pedido do fundador (2026-10-02): "eu cadastrei o TIAGO e não consigo ver em
-- lugar nenhum. Até na rede se clicar na bolinha amarela dele não aparece nada.
-- Sei que entrou uma pessoa mas não sei quem é, aonde está."
--
-- O mapa (`expansao_mapa`) devolvia só id, nível, time e pai. A regra de
-- privacidade escrita em 20260928140000 sempre foi "mostra o @username de quem
-- é da MINHA EQUIPE" — mas o nome nunca saiu do banco. Esta função entrega:
--
--   · pra TODO nó abaixo de mim: posição (nível, time, pai) — como o mapa;
--   · SÓ pra quem é da minha equipe (minha cadeia de patrocínio):
--     @username, clube, quando entrou, por onde entrou, se ativou a conta
--     (pode convidar) e se o binário dele está ativo.
--   · quem chegou por DERRAMAMENTO continua sem nome — ocupa a posição e soma
--     volume, mas não é gente que eu trouxe.
--
-- 🔒 Sem parâmetro de usuário: lê a árvore de `auth.uid()` e de ninguém mais.
-- Não dá pra pedir a rede de outra pessoa nem passando um uuid.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.expansao_minha_equipe(p_ate integer default 5)
returns table (
  user_id uuid, nivel integer, y_ordem bigint, perna smallint, da_minha_equipe boolean,
  pai_id uuid, direto boolean, username text, clube text, entrou_em timestamptz,
  origem text, ativado boolean, binario_ativo boolean
)
language sql stable security definer set search_path = public
as $$
  with eu as (
    select n.user_id as uid, n.nivel as nivel
      from expansao_no n where n.user_id = auth.uid()
  ), abaixo as (
    select n.*,
           (select uid from eu) = any(n.patrocinio_path) as dme
      from expansao_no n
     where (select uid from eu) = any(n.posicao_path)
       and n.nivel - (select nivel from eu) between 1 and least(greatest(coalesce(p_ate, 5), 1), 10)
  )
  select a.user_id,
         a.nivel - (select nivel from eu),
         a.y_ordem,
         coalesce(
           (select n2.lado from expansao_no n2
             where n2.user_id = a.posicao_path[array_position(a.posicao_path, (select uid from eu)) + 1]),
           a.lado
         ),
         a.dme,
         a.pai_id,
         a.patrocinador_id = (select uid from eu),
         case when a.dme then p.username end,
         case when a.dme then p.club_name end,
         a.criado_em,
         case when a.dme then c.origem end,
         case when a.dme then public.expansao_pode_convidar_interno(a.user_id) end,
         case when a.dme then public.expansao_ativo_interno(a.user_id) end
    from abaixo a
    left join profiles p on p.id = a.user_id
    left join expansao_confirmacao c on c.user_id = a.user_id
   order by a.nivel, a.y_ordem;
$$;

revoke all on function public.expansao_minha_equipe(integer) from public, anon;
grant execute on function public.expansao_minha_equipe(integer) to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — leitura pura; nada a desfazer
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_raiz uuid;
  v_n integer;
  v_r record;
begin
  if has_function_privilege('anon', 'public.expansao_minha_equipe(integer)', 'execute') then
    raise exception 'expansao_minha_equipe ficou aberta a anon';
  end if;

  -- Sem sessão: não devolve nada (não há "eu").
  perform set_config('request.jwt.claims', '', true);
  select count(*) into v_n from public.expansao_minha_equipe(5);
  if v_n <> 0 then raise exception 'sem sessão devolveu % linhas', v_n; end if;

  -- Logado como a raiz: devolve exatamente o que o mapa devolve, na mesma
  -- posição, e nome só pra quem é da equipe.
  select n.user_id into v_raiz from public.expansao_no n where n.pai_id is null order by n.criado_em limit 1;
  if v_raiz is null then
    raise notice 'árvore vazia: verificação de conteúdo pulada';
    return;
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_raiz, 'role', 'authenticated')::text, true);

  select count(*) into v_n
    from public.expansao_minha_equipe(5) e
    full join public.expansao_mapa(v_raiz, 1, 5) m on m.user_id = e.user_id
   where e.user_id is null or m.user_id is null
      or e.nivel <> m.nivel or e.perna <> m.perna or e.da_minha_equipe <> m.da_minha_equipe;
  if v_n <> 0 then raise exception 'a equipe diverge do mapa em % nós', v_n; end if;

  if exists (select 1 from public.expansao_minha_equipe(5) e
              where not e.da_minha_equipe and (e.username is not null or e.clube is not null)) then
    raise exception 'quem derramou saiu com nome';
  end if;

  perform set_config('request.jwt.claims', '', true);
end $$;

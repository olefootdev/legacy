-- ════════════════════════════════════════════════════════════════════════════
-- ONDA 0 · prêmios da Liga (campeão + mata-mata) — escrita travada, leitura própria
-- ════════════════════════════════════════════════════════════════════════════
-- No REPO estas tabelas nasceram sem RLS (20260616140000, 20260619200000). Em
-- PRODUÇÃO alguém ligou a RLS fora do repo, sem criar policy nenhuma. Medido em
-- 2026-09-18: RLS ligada, zero policies, e anon/authenticated ainda com grant de
-- INSERT/UPDATE (inócuo só porque a RLS sem policy nega tudo).
--
-- Efeito colateral dessa RLS sem policy: o cliente também não LÊ nem marca o
-- próprio prêmio — o polling de useGlobalConsequencesSync volta vazio desde
-- sempre. Em 2026-09-18: 69 prêmios de campeão e 4.163 de mata-mata pendentes,
-- ZERO pagos (17M OLE + ~758M EXP). Pagar ou não esse acumulado é decisão do
-- fundador — por isso a RPC de reclamação ficou numa migration SEPARADA
-- (20260918270000), que só se aplica depois dessa decisão.
--
-- Esta aqui só: (1) tira o grant de escrita que sobrou, pra RLS não ser a
-- única barreira; (2) dá ao manager leitura dos PRÓPRIOS prêmios; (3) cria a
-- identidade confiável que as policies (e a 20260918240000) usam.
--
-- IDENTIDADE: `manager_id` guarda o e-mail mandado no cadastro do time
-- (managerProfile.email). Comparo com o e-mail VERIFICADO do auth, sem
-- diferenciar maiúscula. Nunca com o e-mail do perfil (profiles.onboarding_data):
-- ele é gravado via save_onboarding_profile com valor vindo do cliente — usar
-- ele deixaria qualquer um se declarar dono do prêmio alheio. Quem cadastrou o
-- time com e-mail diferente do login fica com prêmio retido (não perdido) até a
-- migração do eixo e-mail → auth.uid() (Onda 1). A verificação conta quantos.

create or replace function public.my_manager_identities()
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $function$
  select array_remove(array[
    (select lower(u.email) from auth.users u where u.id = auth.uid()),
    auth.uid()::text
  ], null);
$function$;

revoke execute on function public.my_manager_identities() from public, anon;
grant execute on function public.my_manager_identities() to authenticated;

comment on function public.my_manager_identities() is
  'Identidades confiáveis do usuário logado pra casar com manager_id (texto, '
  'legado por e-mail): e-mail do auth em minúsculas + uid. NÃO incluir o e-mail '
  'do perfil — ele é declarado pelo cliente.';

alter table public.global_league_season_champions enable row level security;
alter table public.global_league_ko_prizes enable row level security;

drop policy if exists "season_champions_select_own" on public.global_league_season_champions;
create policy "season_champions_select_own"
  on public.global_league_season_champions for select
  to authenticated
  using (lower(manager_id) = any ((select public.my_manager_identities())::text[]));

drop policy if exists "ko_prizes_select_own" on public.global_league_ko_prizes;
create policy "ko_prizes_select_own"
  on public.global_league_ko_prizes for select
  to authenticated
  using (lower(manager_id) = any ((select public.my_manager_identities())::text[]));

revoke all on public.global_league_season_champions from anon, authenticated;
revoke all on public.global_league_ko_prizes from anon, authenticated;
grant select on public.global_league_season_champions to authenticated;
grant select on public.global_league_ko_prizes to authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_uid     uuid;
  v_email   text;
  v_ids     text[];
  v_retidos int;
  v_orfaos  int;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.global_league_season_champions'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.global_league_ko_prizes'::regclass) then
    raise exception 'RLS não ficou ligada nas tabelas de prêmio';
  end if;
  if has_table_privilege('authenticated', 'public.global_league_season_champions', 'INSERT')
     or has_any_column_privilege('authenticated', 'public.global_league_season_champions', 'UPDATE')
     or has_table_privilege('authenticated', 'public.global_league_ko_prizes', 'INSERT')
     or has_any_column_privilege('authenticated', 'public.global_league_ko_prizes', 'UPDATE')
     or has_table_privilege('anon', 'public.global_league_ko_prizes', 'SELECT')
     or has_table_privilege('anon', 'public.global_league_season_champions', 'SELECT') then
    raise exception 'cliente ainda escreve (ou anon lê) tabela de prêmio';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
                  and tablename = 'global_league_ko_prizes' and cmd = 'SELECT'
                  and qual ilike '%my_manager_identities%') then
    raise exception 'policy de leitura do próprio prêmio não foi criada';
  end if;

  select id, email into v_uid, v_email
    from auth.users where email is not null order by created_at limit 1;
  if v_uid is not null then
    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    v_ids := public.my_manager_identities();
    perform set_config('request.jwt.claim.sub', '', true);
    if not (lower(v_email) = any (v_ids)) or not (v_uid::text = any (v_ids)) then
      raise exception 'my_manager_identities não reconheceu o próprio usuário';
    end if;
  end if;

  -- diagnóstico (não falha): quem ficaria com prêmio retido até a Onda 1
  select count(*) into v_retidos
    from (select manager_id from public.global_league_season_champions where not claimed
          union all
          select manager_id from public.global_league_ko_prizes where not claimed) p
   where not exists (select 1 from auth.users u where lower(u.email) = lower(p.manager_id));
  select count(*) into v_orfaos
    from public.global_league_teams t
   where not exists (select 1 from auth.users u
                      where lower(u.email) = lower(t.manager_id) or u.id::text = t.manager_id);
  raise notice 'diagnóstico: % prêmio(s) pendente(s) sem e-mail de login correspondente; % time(s) com manager_id que não bate com nenhum login',
    v_retidos, v_orfaos;

  raise notice 'verificação: ok — prêmios sem escrita do cliente, leitura só do próprio';
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- EXPANSÃO — revoga `anon` (o conserto que o revoke anterior não fechou)
--
-- ⚠️ ARQUIVO RECUPERADO em 2026-10-07. Aplicada direto no banco em 2026-09-29
-- (versão 20260929020640), sem arquivo no repo. SQL copiado de
-- `supabase_migrations.schema_migrations`. Ela repete parte da 20260928220252
-- de propósito: as duas estão no histórico, e reescrever o passado é pior que
-- carregar a repetição.
--
-- 🔴 O `revoke from public` NÃO bastou. O Supabase tem DEFAULT PRIVILEGES que
-- concedem EXECUTE a anon/authenticated/service_role em toda função nova do
-- schema public — o grant chega pelos ROLES NOMEADOS, não por PUBLIC, então
-- revogar de PUBLIC não tira nada.
--
-- Conferido no proacl: expansao_mapa e expansao_ativacao estavam com anon=X.
-- expansao_mapa é a função que existe justamente para NÃO vazar a rede; com
-- anon podendo chamá-la, bastava ter um uuid pra enumerar a árvore de alguém
-- sem sessão.
--
-- É o mesmo portão-que-falha-aberto do /api/admin/profiles e do
-- vault_ancestrais: em Postgres, permissão se confere lendo o ACL, nunca
-- deduzindo do que a gente escreveu.
-- ═══════════════════════════════════════════════════════════════════════════

revoke execute on function public.expansao_mapa(uuid,integer,integer) from anon;
revoke execute on function public.expansao_ativacao(uuid) from anon;
revoke execute on function public.expansao_append_only() from anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — roda junto e derruba tudo se falhar
-- ═══════════════════════════════════════════════════════════════════════════
do $$
begin
  if has_function_privilege('anon', 'public.expansao_mapa(uuid,integer,integer)', 'execute') then
    raise exception 'anon ainda executa expansao_mapa';
  end if;
  if has_function_privilege('anon', 'public.expansao_ativacao(uuid)', 'execute') then
    raise exception 'anon ainda executa expansao_ativacao';
  end if;
  if has_function_privilege('authenticated', 'public.expansao_append_only()', 'execute') then
    raise exception 'authenticated ainda executa expansao_append_only — o trigger de append-only é chamável por conta logada';
  end if;
  raise notice 'verificação: ok — anon e authenticated fechados';
end $$;

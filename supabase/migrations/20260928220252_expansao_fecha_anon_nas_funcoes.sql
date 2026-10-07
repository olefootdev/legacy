-- ═══════════════════════════════════════════════════════════════════════════
-- EXPANSÃO — fecha `anon` nas funções da rede
--
-- ⚠️ ARQUIVO RECUPERADO em 2026-10-07. Esta migration foi aplicada direto no
-- banco em 2026-09-28 (versão 20260928220252) e nunca teve arquivo no repo.
-- O SQL abaixo é o que está gravado em `supabase_migrations.schema_migrations`,
-- copiado da FONTE e não da memória (Regra 3 do _TEMPLATE). Sem este arquivo,
-- reconstruir o banco pelo repositório devolvia `anon` às funções da rede.
--
-- 🔴 As default privileges do Supabase dão EXECUTE nominal a `anon` e
-- `authenticated` em TODA função nova no schema public. `revoke from public`
-- NÃO tira isso — o grant não é do PUBLIC, é do próprio anon.
--
-- É primo do furo que o projeto já pagou ("grant to service_role não
-- restringe"): lá o default era PUBLIC, aqui é nominal. A lição que fica para
-- toda função nova: revogar de public, anon E authenticated, sempre, e depois
-- conceder só a quem deve — e conferir o proacl depois de aplicar.
--
-- expansao_mapa com anon significaria enumerar a rede de qualquer um sem login.
-- ═══════════════════════════════════════════════════════════════════════════

revoke execute on function public.expansao_mapa(uuid,integer,integer) from anon;
revoke execute on function public.expansao_ativacao(uuid) from anon;
revoke execute on function public.expansao_append_only() from public, anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO — roda junto e derruba tudo se falhar
-- ═══════════════════════════════════════════════════════════════════════════
-- Permissão se confere lendo o ACL, nunca deduzindo do que a gente escreveu.
do $$
begin
  if has_function_privilege('anon', 'public.expansao_mapa(uuid,integer,integer)', 'execute') then
    raise exception 'anon ainda executa expansao_mapa — a rede continua enumerável sem login';
  end if;
  if has_function_privilege('anon', 'public.expansao_ativacao(uuid)', 'execute') then
    raise exception 'anon ainda executa expansao_ativacao';
  end if;
  if has_function_privilege('anon', 'public.expansao_append_only()', 'execute') then
    raise exception 'anon ainda executa expansao_append_only';
  end if;
  raise notice 'verificação: ok — anon fechado nas três funções';
end $$;

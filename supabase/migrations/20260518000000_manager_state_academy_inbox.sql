-- ============================================================================
-- Persistência cross-browser do queue da Academia OLE + inbox do manager
-- ============================================================================
-- Antes: managerProspectArtQueue e inbox viviam só no localStorage.
-- Manager criava prospect num browser, admin processava no MESMO browser,
-- e se o manager logava noutro device a carta entregue não aparecia.
--
-- Agora: ambos os slices vão pro Supabase como JSONB. O game state hydrator
-- traz de volta no boot e o reducer continua mutando em memória.
-- ============================================================================

alter table public.manager_game_state
  add column if not exists manager_prospect_art_queue jsonb,
  add column if not exists inbox jsonb;

-- Sem índices: campos são lidos só pelo próprio user_id (já indexado como PK).
-- Sem RLS extra: a tabela já tem RLS por user_id (mesma policy dos outros slices).

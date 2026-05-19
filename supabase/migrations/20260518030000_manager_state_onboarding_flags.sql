-- ============================================================================
-- Persistência cross-browser das flags de onboarding
-- ============================================================================
-- Antes: welcomeGenesisPackVersion + hasDoneOnboarding viviam SÓ no
-- localStorage. Manager fazia a cerimônia, deslogava, logava noutro browser
-- (ou aba anônima) — localStorage zerado + welcome_pack_grants sem entry
-- na cerimônia nova (regressão da remoção do tryGrantWelcomeGenesisPack
-- no Sprint 2). Resultado: cerimônia abria de novo.
--
-- Solução em 2 camadas:
--   1. OnboardingCeremony agora chama claimWelcomePackSlot() no finish()
--      → grava em welcome_pack_grants (gate primário).
--   2. Esta coluna persiste as flags como BACKUP (segundo guard) caso o
--      RPC falhe ou tenha latência.
--
-- Shape do JSON:
--   {
--     "welcomeGenesisPackVersion": int,
--     "hasDoneOnboarding": boolean
--   }
-- ============================================================================

alter table public.manager_game_state
  add column if not exists onboarding_flags jsonb;

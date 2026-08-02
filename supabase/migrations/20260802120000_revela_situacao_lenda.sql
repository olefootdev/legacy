-- ============================================================================
-- REVELA — situação de jogo "lenda" (ex-atleta)
-- ============================================================================
-- Pedido do fundador (2026-08-02, testando o onboarding em produção): o passo 2
-- só oferecia escolinha / júnior / profissional. Falta o ex-atleta, que entra
-- pelo mesmo funil mas NÃO está em atividade — e isso precisa refletir na
-- disponibilidade que a vitrine anuncia.
--
-- O CHECK atual RECUSA 'lenda', então sem esta migration o cadastro falha no
-- envio (o cliente manda, o Postgres rejeita). Aplicar ANTES do deploy do
-- portal — a ordem importa, como já aconteceu com o `p_handle`.
-- ============================================================================

alter table public.revela_talents
  drop constraint if exists revela_talents_game_situation_check;

alter table public.revela_talents
  add constraint revela_talents_game_situation_check
  check (
    game_situation is null
    or game_situation in ('escolinha', 'junior', 'profissional', 'lenda')
  );

comment on column public.revela_talents.game_situation is
  'Situação do atleta: escolinha | junior | profissional | lenda. '
  '"lenda" = ex-atleta, fora de atividade — a vitrine não deve anunciar '
  'disponibilidade para observação/contratação nesse caso.';


-- ─── Verificação ────────────────────────────────────────────────────────────
-- Deve devolver os quatro valores aceitos.
--
-- select pg_get_constraintdef(oid)
--   from pg_constraint
--  where conname = 'revela_talents_game_situation_check';


-- ============================================================================
-- Reserva o handle "meu-perfil"
-- ============================================================================
-- A rota `/meu-perfil` (painel do atleta) nasce nesta mesma leva. Sem reservar,
-- alguém poderia registrar esse handle e o link curto `revela.olefoot.com/<@>`
-- passaria a competir com a rota do painel — o React resolveria a rota primeiro
-- e o dono do @ ficaria sem endereço, sem erro nenhum aparecer.
-- ============================================================================

create or replace function public.revela_handle_reserved(p text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p, '')) in (
    'comecar', 't', 'lenda', 'playervip', 'api', 'admin', 'app', 'www', 'home',
    'login', 'entrar', 'cadastro', 'revela', 'olefoot', 'perfil', 'conta',
    'sobre', 'ajuda', 'suporte', 'assets', 'fonts', 'static', 'og-default',
    'null', 'undefined', 'me', 'eu', 'time', 'liga',
    -- rota do painel do atleta (2026-08-02)
    'meu-perfil', 'meuperfil', 'dashboard'
  );
$$;


-- ─── Verificação ────────────────────────────────────────────────────────────
-- select public.revela_check_handle('meu-perfil');  -- deve dar reserved

-- OLEFOOT — Genesis: preço em EXP (250k–1M), contrato em jogos, opção vitalícia (Admin).
-- price_bro_cents mantido por compatibilidade; UI e jogo usam price_exp.

alter table public.genesis_market_players
  add column if not exists price_exp integer not null default 250000;

alter table public.genesis_market_players
  add column if not exists contract_matches_included integer not null default 70;

alter table public.genesis_market_players
  add column if not exists contract_is_lifetime boolean not null default false;

comment on column public.genesis_market_players.price_exp is 'Preço de compra imediata em EXP (ranking).';
comment on column public.genesis_market_players.contract_matches_included is 'Jogos (amistoso+oficial) antes de recomprar.';
comment on column public.genesis_market_players.contract_is_lifetime is 'Se true, sem expiração por jogos (só Admin no catálogo).';

-- Escala EXP ~ linear no mint OVR 24–72 → 250k–1M, múltiplos de 5k
update public.genesis_market_players
set price_exp = (
  round(
    (
      250000::numeric + (
        greatest(24, least(72, coalesce(mint_overall, 30))) - 24
      ) / 48.0 * (1000000 - 250000)
    ) / 5000
  ) * 5000
)::integer;

comment on table public.genesis_market_players is 'Catálogo global OLEFOOT Genesis; listagem, price_exp (EXP) e contrato em jogos.';

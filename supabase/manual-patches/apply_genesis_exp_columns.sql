-- OLEFOOT — Patch manual (SQL Editor) se `price_exp` / contrato / `market_value_exp` ainda não existem.
-- Idempotente: usa ADD COLUMN IF NOT EXISTS. Executar UMA vez (ou repetir sem problema).

-- === Conteúdo alinhado a migrations 00007 + 00008 ===

alter table public.genesis_market_players
  add column if not exists price_exp integer not null default 250000;

alter table public.genesis_market_players
  add column if not exists contract_matches_included integer not null default 70;

alter table public.genesis_market_players
  add column if not exists contract_is_lifetime boolean not null default false;

comment on column public.genesis_market_players.price_exp is 'Preço de compra imediata em EXP (ranking).';
comment on column public.genesis_market_players.contract_matches_included is 'Jogos (amistoso+oficial) antes de recomprar.';
comment on column public.genesis_market_players.contract_is_lifetime is 'Se true, sem expiração por jogos (só Admin no catálogo).';

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

alter table public.genesis_market_players
  add column if not exists market_value_exp integer not null default 250000;

comment on column public.genesis_market_players.market_value_exp is 'Valor de mercado de referência em EXP (substitui escala BRO na UI).';

update public.genesis_market_players
set market_value_exp = (
  case
    when coalesce(price_exp, 0) > 0 then price_exp
    else (
      round(
        (
          250000::numeric + (
            greatest(24, least(72, coalesce(mint_overall, 30))) - 24
          ) / 48.0 * (1000000 - 250000)
        ) / 5000
      ) * 5000
    )::integer
  end
);

comment on table public.genesis_market_players is 'Catálogo global OLEFOOT Genesis; price_exp e market_value_exp em EXP; contrato em jogos.';

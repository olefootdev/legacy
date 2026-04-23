-- OLEFOOT — Valor de mercado Genesis em EXP.
-- market_value_bro_cents mantido por compatibilidade; a app usa market_value_exp na ficha e no livro quando preenchido.

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

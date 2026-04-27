-- OLEFOOT — Referências de retrato Genesis para hospedagem externa (ex.: Pinata).
-- `portrait_public_url` continua a ser o URL do card; `portrait_token_public_url` para o token circular
-- quando não se usa o padrão Storage (-card / -token no mesmo bucket).

alter table public.genesis_market_players
  add column if not exists portrait_token_public_url text,
  add column if not exists portrait_media_refs jsonb;

comment on column public.genesis_market_players.portrait_token_public_url is
  'URL pública do retrato circular (token). Usado com `portrait_public_url` quando a mídia não está no Storage Supabase.';

comment on column public.genesis_market_players.portrait_media_refs is
  'Metadados agregados do último upload externo (provider, cid, urls, mime, tamanho, pinataFileId, etc.).';

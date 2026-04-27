-- Lesões α (server-only): debuff temporário no overall do time.
-- Uma lesão num jogo registra injury_modifier (-2 a -4) e injury_rounds_remaining
-- (1 ou 2). A cada rodada futura, o tick decrementa o contador; quando chega
-- a 0, o modifier é zerado. Não modela jogador individual ainda.

alter table public.global_league_teams
  add column if not exists injury_modifier int not null default 0,
  add column if not exists injury_rounds_remaining int not null default 0;

comment on column public.global_league_teams.injury_modifier is
  'Debuff temporário no overall do time por lesões. 0 = sem lesão. Tipicamente entre -4 e 0.';
comment on column public.global_league_teams.injury_rounds_remaining is
  'Quantas rodadas restam de debuff. 0 = sem lesão. Decrementado a cada tick que joga.';

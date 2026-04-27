-- Correção de IDs de times favoritos que podem estar trocados
-- Ceará deve ser ID 152 (não 129)
-- Athletico-PR deve ser ID 129 (não 152)

-- Atualiza registros onde o ID está trocado
update public.profiles
set onboarding_data = jsonb_set(
  onboarding_data,
  '{favoriteRealTeam}',
  jsonb_build_object(
    'id', 152,
    'name', 'Ceará',
    'logo', 'https://media.api-sports.io/football/teams/152.png'
  )
)
where onboarding_data->>'favoriteRealTeam' is not null
  and onboarding_data->'favoriteRealTeam'->>'name' = 'Ceará'
  and (onboarding_data->'favoriteRealTeam'->>'id')::int != 152;

update public.profiles
set onboarding_data = jsonb_set(
  onboarding_data,
  '{favoriteRealTeam}',
  jsonb_build_object(
    'id', 129,
    'name', 'Athletico-PR',
    'logo', 'https://media.api-sports.io/football/teams/129.png'
  )
)
where onboarding_data->>'favoriteRealTeam' is not null
  and onboarding_data->'favoriteRealTeam'->>'name' = 'Athletico-PR'
  and (onboarding_data->'favoriteRealTeam'->>'id')::int != 129;

-- Comentário para log
comment on table public.profiles is 'Correção aplicada em 2026-04-27: IDs de Ceará (152) e Athletico-PR (129) verificados e corrigidos';

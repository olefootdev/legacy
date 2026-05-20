-- Remove times da Liga Global cujo manager_id não corresponde a nenhum
-- email em auth.users (times órfãos de users deletados).
-- Também remove times mockados (ole-fc, guest).
DELETE FROM public.global_league_teams
WHERE manager_id NOT IN (
  SELECT email FROM auth.users WHERE email IS NOT NULL
)
OR manager_id IN ('ole-fc', 'guest');

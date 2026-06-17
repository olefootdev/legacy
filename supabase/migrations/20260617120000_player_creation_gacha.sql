-- =============================================================================
-- FASE 1 — Modelo de dados do novo sistema de criação de jogador (gacha de época)
-- Data: 2026-06-17  | Ver memória: project-player-creation-gacha
--
-- 3 tabelas:
--   attribute_templates  -> o "banco que cresce": atributos de craques reais por
--                           (nome, ano), derivados pela metodologia Olefoot.
--   academy_draw_config  -> odds + tetos de OVR por raridade (admin-tunável).
--   academy_draws        -> log de cada sorteio (auditoria + 1 por manager).
--
-- + RPC count_my_active_referrals() para o gate "≥5 indicados ativos (já jogaram)".
--
-- Pode rodar no SQL Editor do Supabase (como o reset) ou via `supabase db push`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- attribute_templates — molde reutilizável de atributos por craque/ano
--   attributes jsonb = 10 canônicos: passe, marcacao, velocidade, drible,
--   finalizacao, fisico, tatico, mentalidade, confianca, fairPlay (0-99).
-- -----------------------------------------------------------------------------
create table if not exists public.attribute_templates (
  id               uuid primary key default gen_random_uuid(),
  player_slug      text not null,                 -- ex: cristiano-ronaldo
  player_name      text not null,                 -- ex: Cristiano Ronaldo
  year             int  not null,                 -- ano de atuação (ex: 2017)
  position         text not null,                 -- GOL/ZAG/LE/LD/VOL/MC/MEI/PE/PD/ATA
  rarity_tier      text not null,                 -- normal/premium/gold/rare/legend
  attributes       jsonb not null,                -- 10 atributos (metodologia Olefoot)
  overall          int  not null,
  bio_snippet      text,                          -- 1 linha pública ("temporada de 42 gols…")
  sources          jsonb not null default '[]'::jsonb,  -- urls públicas usadas
  methodology_ver  text not null default 'v1',
  status           text not null default 'draft', -- draft | sealed (admin revisou)
  agent_run_id     text,
  reviewed_by      uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint attribute_templates_year_chk     check (year between 1950 and 2100),
  constraint attribute_templates_overall_chk  check (overall between 1 and 99),
  constraint attribute_templates_rarity_chk   check (rarity_tier in ('normal','premium','gold','rare','legend')),
  constraint attribute_templates_status_chk   check (status in ('draft','sealed')),
  unique (player_slug, year)
);

create index if not exists attribute_templates_pos_year_tier_idx
  on public.attribute_templates (position, year, rarity_tier, status);

alter table public.attribute_templates enable row level security;

-- Leitura: qualquer autenticado vê templates já selados (proveniência do reveal).
drop policy if exists attribute_templates_select_sealed on public.attribute_templates;
create policy attribute_templates_select_sealed
  on public.attribute_templates for select
  to authenticated
  using (status = 'sealed');
-- Escrita: só service_role (backend do agente / admin). RLS bloqueia o resto.

-- -----------------------------------------------------------------------------
-- academy_draw_config — odds + bandas de OVR por raridade (decisões aprovadas)
-- -----------------------------------------------------------------------------
create table if not exists public.academy_draw_config (
  rarity_tier      text primary key,
  probability_pct  numeric not null,   -- soma deve dar 100
  ovr_floor        int not null,
  ovr_ceiling      int not null,
  sort_order       int not null,
  constraint academy_draw_config_rarity_chk check (rarity_tier in ('normal','premium','gold','rare','legend'))
);

insert into public.academy_draw_config (rarity_tier, probability_pct, ovr_floor, ovr_ceiling, sort_order) values
  ('normal',  50, 48, 62, 1),
  ('premium', 27, 60, 68, 2),
  ('gold',    15, 66, 74, 3),
  ('rare',     6, 73, 80, 4),
  ('legend',   2, 82, 90, 5)
on conflict (rarity_tier) do update
  set probability_pct = excluded.probability_pct,
      ovr_floor       = excluded.ovr_floor,
      ovr_ceiling     = excluded.ovr_ceiling,
      sort_order      = excluded.sort_order;

alter table public.academy_draw_config enable row level security;
drop policy if exists academy_draw_config_select_all on public.academy_draw_config;
create policy academy_draw_config_select_all
  on public.academy_draw_config for select
  to authenticated
  using (true);
-- Escrita: só service_role (admin tuning).

-- -----------------------------------------------------------------------------
-- academy_draws — log de sorteios. 1 por manager (sem re-roll, decisão #3).
-- -----------------------------------------------------------------------------
create table if not exists public.academy_draws (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  position     text not null,
  year         int  not null,
  rolled_tier  text not null,
  template_id  uuid references public.attribute_templates(id) on delete set null,
  player_name  text,
  status       text not null default 'revealed',  -- revealed | confirmed | discarded
  created_at   timestamptz not null default now(),
  constraint academy_draws_status_chk check (status in ('revealed','confirmed','discarded'))
);

-- 1 sorteio por manager (exceto descartes administrativos).
create unique index if not exists academy_draws_one_per_user_idx
  on public.academy_draws (user_id)
  where status <> 'discarded';

alter table public.academy_draws enable row level security;
drop policy if exists academy_draws_select_own on public.academy_draws;
create policy academy_draws_select_own
  on public.academy_draws for select
  to authenticated
  using (user_id = auth.uid());
-- Escrita: só service_role (o endpoint /draw roda server-side).

-- -----------------------------------------------------------------------------
-- count_my_active_referrals() — gate: indicados que JÁ JOGARAM (exp > 0)
-- -----------------------------------------------------------------------------
create or replace function public.count_my_active_referrals()
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text;
  v_count int;
begin
  select p.my_referral_code into v_code
    from public.profiles p
   where p.id = auth.uid();

  if v_code is null then
    return 0;
  end if;

  select count(*) into v_count
    from public.profiles p
   where p.referred_by_code = v_code
     and coalesce(p.exp_lifetime_earned, 0) > 0;

  return coalesce(v_count, 0);
end;
$$;

revoke execute on function public.count_my_active_referrals() from anon, public;
grant execute on function public.count_my_active_referrals() to authenticated;

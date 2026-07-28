-- ════════════════════════════════════════════════════════════════════════════
-- OLEFOOT REVELA — portal público de talentos (revela.olefoot.com)
--
-- O QUE É
-- REVELA é a porta de entrada do universo Olefoot: o lugar onde um atleta real
-- cria o perfil, é revisado pelo OLE SCOUT, é divulgado, ganha apoiadores e
-- eventualmente vira CARD DIGITAL. Não é o /playervip — aquele é o cockpit
-- INTERNO da lenda (atleta + facilitador + Olefoot). Este é a vitrine ABERTA.
--
-- ┌── O funil (os 7 passos do "Como Funciona") ────────────────────────────┐
-- │ 1 Criação de perfil  → revela_talents (status 'pending')               │
-- │ 2 Validação de conta → user_id preenchido (exige login)                │
-- │ 3 Revisão OLE SCOUT  → status 'in_review' → 'approved' | 'rejected'    │
-- │ 4 Divulgação         → aparece nos RPCs públicos                       │
-- │ 5 CARD DIGITAL       → status 'carded' + card_legacy_id                │
-- │ 6 Compartilhar       → slug público + referral                         │
-- │ 7 Bem-vindo ao time  → entra no Game                                   │
-- └────────────────────────────────────────────────────────────────────────┘
--
-- ⚠️ REGRA DE PII — esta é a terceira vez que este projeto encosta nisto.
-- Já vazamos e-mail em /api/admin/profiles e em global_league_teams. A lição
-- que ficou: `FOR SELECT USING (true)` numa tabela que tem QUALQUER coluna
-- pessoal é vazamento garantido, porque a anon key está no bundle do front.
--
-- Portanto, aqui:
--   • revela_talents NÃO TEM policy de select pra anon. Nenhuma. Zero.
--   • Todo acesso público passa por RPC SECURITY DEFINER que devolve uma
--     lista BRANCA de colunas. contact_phone / contact_email / user_id nunca
--     saem do banco.
--   • O ranking de clubes NÃO lê global_league_teams direto (anon foi revogado
--     em 20260717170000 justamente porque manager_id e id são e-mail). O RPC
--     daqui devolve só club_name / points / division / brasão.
--
-- Idempotente: pode rodar de novo sem estragar nada.
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- 0. Colunas de legacy_players usadas pela vitrine
--
-- get_playervip_landing (em produção) já lê main_club/phase/narrative_title/
-- tagline/mint_overall/year_start/year_end, mas essas colunas foram aplicadas
-- fora da pasta de migrations. Garantimos aqui pra esta migration ser
-- auto-suficiente em qualquer ambiente (staging novo, reset, etc.).
-- ════════════════════════════════════════════════════════════════════════════
alter table public.legacy_players
  add column if not exists main_club       text,
  add column if not exists phase           text,
  add column if not exists narrative_title text,
  add column if not exists tagline         text,
  add column if not exists mint_overall    int,
  add column if not exists year_start      int,
  add column if not exists year_end        int,
  add column if not exists price_unit_cents bigint,
  add column if not exists currency        text;


-- ════════════════════════════════════════════════════════════════════════════
-- 1. revela_talents — o atleta que está chegando
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.revela_talents (
  id            uuid primary key default gen_random_uuid(),

  -- Identidade pública
  slug          text not null unique,          -- revela.olefoot.com/t/<slug>
  name          text not null,
  pos           text not null,                 -- GOL ZAG LE LD VOL MC MEI PE PD ATA
  club          text,                          -- clube atual / peneira / várzea
  city          text,
  uf            text,                          -- sigla do estado (SP, RJ…)
  country       text not null default 'BR',
  birth_year    int,
  strong_foot   text,
  height_cm     int,
  bio           text,
  portrait_url  text,
  video_url     text,

  -- Ficha — os 10 atributos canônicos do jogo (src/entities/types.ts).
  -- Preenchida pelo OLE SCOUT na revisão, não pelo próprio atleta.
  attributes    jsonb not null default '{}'::jsonb,
  -- OVR ponderado POR POSIÇÃO (src/entities/ovrWeights.ts). Gravado aqui pelo
  -- mesmo motivo do mint_overall: o cliente NUNCA recalcula. Recalcular sem a
  -- posição é exatamente o bug que já apareceu na vitrine do playervip.
  overall       int check (overall is null or (overall between 0 and 99)),

  -- Funil
  status        text not null default 'pending'
                check (status in ('pending','in_review','approved','rejected','carded')),
  scout_note    text,                          -- feedback do OLE SCOUT (privado)
  featured      boolean not null default false,
  -- Quando o talento vira card, aponta pro registro real do catálogo.
  card_legacy_id text references public.legacy_players(id) on delete set null,

  -- Dono do perfil (passo 2 — validação de conta). Nunca sai em RPC público.
  user_id       uuid references auth.users(id) on delete set null,
  -- Quem trouxe este atleta: credita a rede de indicação existente.
  referral_code text,

  -- 🔒 PII — jamais exposto por RPC público. Só admin (service role) enxerga.
  contact_phone text,
  contact_email text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  approved_at   timestamptz
);

create index if not exists revela_talents_public_idx
  on public.revela_talents (status, overall desc nulls last)
  where status in ('approved','carded');
create index if not exists revela_talents_user_idx  on public.revela_talents (user_id);
create index if not exists revela_talents_queue_idx on public.revela_talents (created_at desc)
  where status in ('pending','in_review');

comment on table public.revela_talents is
  'Talentos do portal público REVELA. LEITURA PÚBLICA SÓ VIA RPC — contact_phone/'
  'contact_email/user_id são dados pessoais e não têm policy de select pra anon.';
comment on column public.revela_talents.overall is
  'OVR ponderado por posição, gravado na aprovação. O cliente NUNCA recalcula '
  '(ver src/entities/ovrWeights.ts e a nota em PlayerVipLanding.tsx).';

alter table public.revela_talents enable row level security;

-- Sem policy de select pra anon — de propósito. O público lê pelos RPCs abaixo.
drop policy if exists revela_talents_owner_read on public.revela_talents;
create policy revela_talents_owner_read
  on public.revela_talents for select
  to authenticated
  using (user_id = auth.uid());

-- Escrita: só via RPC (security definer). Nada de insert/update direto.
revoke insert, update, delete on public.revela_talents from anon, authenticated;
revoke select on public.revela_talents from anon;


-- ════════════════════════════════════════════════════════════════════════════
-- 2. revela_supports — "eu acredito nesse jogador"
--
-- Exige conta (decisão do fundador): apoiar converte visitante em cadastro e
-- credita a rede de quem trouxe o link. PK composta = 1 apoio por pessoa,
-- sem inflar contador.
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.revela_supports (
  talent_id  uuid not null references public.revela_talents(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (talent_id, user_id)
);

create index if not exists revela_supports_talent_idx on public.revela_supports (talent_id);

alter table public.revela_supports enable row level security;

-- O apoiador vê os próprios apoios (pra UI marcar "✓ NA TORCIDA" ao recarregar).
-- A CONTAGEM pública vem do RPC — não desta policy.
drop policy if exists revela_supports_owner_read on public.revela_supports;
create policy revela_supports_owner_read
  on public.revela_supports for select
  to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.revela_supports from anon, authenticated;
revoke select on public.revela_supports from anon;


-- ════════════════════════════════════════════════════════════════════════════
-- 3. RPCs públicos — lista branca de colunas
-- ════════════════════════════════════════════════════════════════════════════

-- Helper de slug sem depender da extensão `unaccent` estar instalada.
create or replace function public.unaccent_safe(p text)
returns text
language sql
immutable
as $$
  select translate(
    coalesce(p, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  );
$$;

-- ── 3.1 Lista de talentos (Descoberta, Reveal Wall, Torcida) ────────────────
create or replace function public.revela_list_talents(
  p_limit int default 24,
  p_order text default 'overall'   -- 'overall' | 'supporters' | 'recent'
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(q.payload order by q.ord), '[]'::jsonb)
  from (
    select
      jsonb_build_object(
        'id',         rt.id,
        'slug',       rt.slug,
        'name',       rt.name,
        'pos',        rt.pos,
        'club',       rt.club,
        'city',       rt.city,
        'uf',         rt.uf,
        'country',    rt.country,
        'birthYear',  rt.birth_year,
        'strongFoot', rt.strong_foot,
        'bio',        rt.bio,
        'portrait',   rt.portrait_url,
        'video',      rt.video_url,
        'attributes', rt.attributes,
        'overall',    rt.overall,
        'status',     rt.status,
        'featured',   rt.featured,
        'carded',     rt.status = 'carded',
        'supporters', coalesce(s.total, 0),
        'createdAt',  rt.created_at
      ) as payload,
      case lower(coalesce(p_order, 'overall'))
        when 'supporters' then coalesce(s.total, 0)::numeric
        when 'recent'     then extract(epoch from rt.created_at)::numeric
        else coalesce(rt.overall, 0)::numeric
      end as ord_val,
      row_number() over (
        order by
          case lower(coalesce(p_order, 'overall'))
            when 'supporters' then coalesce(s.total, 0)::numeric
            when 'recent'     then extract(epoch from rt.created_at)::numeric
            else coalesce(rt.overall, 0)::numeric
          end desc,
          rt.created_at desc
      ) as ord
    from public.revela_talents rt
    left join (
      select talent_id, count(*)::int as total
      from public.revela_supports
      group by talent_id
    ) s on s.talent_id = rt.id
    where rt.status in ('approved', 'carded')
    order by ord_val desc, rt.created_at desc
    limit greatest(1, least(coalesce(p_limit, 24), 100))
  ) q;
$$;

grant execute on function public.revela_list_talents(int, text) to anon, authenticated;

comment on function public.revela_list_talents(int, text) is
  'Vitrine pública do REVELA. Lista branca de colunas: NUNCA devolve '
  'contact_phone, contact_email, user_id, referral_code ou scout_note.';


-- ── 3.2 Um talento pelo slug (página de perfil / social share) ──────────────
create or replace function public.revela_get_talent(p_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id',         rt.id,
    'slug',       rt.slug,
    'name',       rt.name,
    'pos',        rt.pos,
    'club',       rt.club,
    'city',       rt.city,
    'uf',         rt.uf,
    'country',    rt.country,
    'birthYear',  rt.birth_year,
    'strongFoot', rt.strong_foot,
    'heightCm',   rt.height_cm,
    'bio',        rt.bio,
    'portrait',   rt.portrait_url,
    'video',      rt.video_url,
    'attributes', rt.attributes,
    'overall',    rt.overall,
    'status',     rt.status,
    'carded',     rt.status = 'carded',
    'supporters', (select count(*)::int from public.revela_supports s where s.talent_id = rt.id),
    'createdAt',  rt.created_at
  )
  from public.revela_talents rt
  where lower(rt.slug) = lower(trim(coalesce(p_slug, '')))
    and rt.status in ('approved', 'carded');
$$;

grant execute on function public.revela_get_talent(text) to anon, authenticated;


-- ── 3.3 Apoiar (exige conta) ────────────────────────────────────────────────
create or replace function public.revela_support_talent(p_talent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  ok    boolean;
  total int;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;

  select true into ok
  from public.revela_talents
  where id = p_talent_id and status in ('approved','carded');

  if not coalesce(ok, false) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  insert into public.revela_supports (talent_id, user_id)
  values (p_talent_id, uid)
  on conflict (talent_id, user_id) do nothing;

  select count(*)::int into total
  from public.revela_supports where talent_id = p_talent_id;

  return jsonb_build_object('ok', true, 'supporters', total);
end;
$$;

grant execute on function public.revela_support_talent(uuid) to authenticated;


-- ── 3.4 Meus apoios (pra UI remarcar "NA TORCIDA" ao voltar) ────────────────
create or replace function public.revela_my_supports()
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(talent_id), '{}'::uuid[])
  from public.revela_supports
  where user_id = auth.uid();
$$;

grant execute on function public.revela_my_supports() to authenticated;


-- ── 3.5 Criar perfil de talento (passo 1 + 2 do funil) ──────────────────────
-- Exige conta: o passo 2 do "Como Funciona" é literalmente "Validação de Conta".
create or replace function public.revela_submit_talent(
  p_name          text,
  p_pos           text,
  p_club          text default null,
  p_city          text default null,
  p_uf            text default null,
  p_birth_year    int  default null,
  p_strong_foot   text default null,
  p_bio           text default null,
  p_video_url     text default null,
  p_contact_phone text default null,
  p_referral_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  base_slug text;
  try_slug  text;
  n         int := 0;
  new_id    uuid;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;
  if coalesce(trim(p_name), '') = '' or length(trim(p_name)) < 2 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_name');
  end if;
  if coalesce(trim(p_pos), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_pos');
  end if;

  -- Um perfil por conta enquanto estiver na fila ou aprovado.
  if exists (
    select 1 from public.revela_talents
    where user_id = uid and status <> 'rejected'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_submitted');
  end if;

  -- slug: nome normalizado, sufixo numérico em caso de colisão
  base_slug := regexp_replace(
    lower(unaccent_safe(trim(p_name))), '[^a-z0-9]+', '-', 'g'
  );
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then base_slug := 'talento'; end if;

  try_slug := base_slug;
  while exists (select 1 from public.revela_talents where slug = try_slug) loop
    n := n + 1;
    try_slug := base_slug || '-' || n::text;
  end loop;

  insert into public.revela_talents (
    slug, name, pos, club, city, uf, birth_year, strong_foot, bio,
    video_url, contact_phone, contact_email, user_id, referral_code, status
  )
  values (
    try_slug, trim(p_name), upper(trim(p_pos)), nullif(trim(coalesce(p_club,'')),''),
    nullif(trim(coalesce(p_city,'')),''), nullif(upper(trim(coalesce(p_uf,''))),''),
    p_birth_year, nullif(trim(coalesce(p_strong_foot,'')),''),
    nullif(trim(coalesce(p_bio,'')),''), nullif(trim(coalesce(p_video_url,'')),''),
    nullif(regexp_replace(coalesce(p_contact_phone,''), '\D', '', 'g'), ''),
    (select email from auth.users where id = uid),
    uid, nullif(trim(coalesce(p_referral_code,'')),''), 'pending'
  )
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id, 'slug', try_slug);
end;
$$;

grant execute on function public.revela_submit_talent(
  text, text, text, text, text, int, text, text, text, text, text
) to authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 3.6 revela_lineups — o XI montado no Team Builder
--
-- Substitui a captura de telefone que o protótipo fazia em localStorage. A
-- ponte pro jogo passa a ser a CONTA, que já existe e já tem a árvore de
-- indicação montada. Um XI por conta (o último vence) — é uma vitrine social,
-- não um histórico.
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists public.revela_lineups (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  team_name  text not null,
  formation  text not null,
  coach      text,
  -- 11 posições; cada uma "t:<uuid>" (talento) | "l:<id>" (lenda) | null
  slots      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.revela_lineups enable row level security;

drop policy if exists revela_lineups_owner_read on public.revela_lineups;
create policy revela_lineups_owner_read
  on public.revela_lineups for select
  to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.revela_lineups from anon, authenticated;
revoke select on public.revela_lineups from anon;

create or replace function public.revela_save_lineup(
  p_team_name text,
  p_formation text,
  p_coach     text default null,
  p_slots     jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;
  if coalesce(trim(p_team_name), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_team_name');
  end if;

  insert into public.revela_lineups (user_id, team_name, formation, coach, slots)
  values (uid, trim(p_team_name), trim(p_formation), nullif(trim(coalesce(p_coach,'')),''),
          coalesce(p_slots, '[]'::jsonb))
  on conflict (user_id) do update set
    team_name  = excluded.team_name,
    formation  = excluded.formation,
    coach      = excluded.coach,
    slots      = excluded.slots,
    updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.revela_save_lineup(text, text, text, jsonb) to authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 4. Ranking público de clubes — SEM tocar em PII
--
-- global_league_teams teve `select` revogado pra anon em 20260717170000 porque
-- `manager_id` E `id` são e-mail ("gt_fulano_gmail_com"). Este RPC roda como
-- definer e devolve APENAS nome do clube, pontos, divisão e brasão. Nenhuma
-- coluna de identidade sai daqui — nem o id.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.revela_top_clubs(p_limit int default 10)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'rank',      r.rank,
      'club',      r.club_name,
      'short',     r.club_short,
      'points',    r.points,
      'division',  r.division,
      'played',    r.matches_played,
      'wins',      r.wins,
      'crestId',   r.favorite_team_id,
      -- tendência: subiu/desceu/estável desde a rodada anterior
      'trend',     case
                     when r.previous_position is null then 'flat'
                     when r.previous_position > r.rank then 'up'
                     when r.previous_position < r.rank then 'down'
                     else 'flat'
                   end
    ) order by r.rank
  ), '[]'::jsonb)
  from (
    select
      row_number() over (
        order by coalesce(points,0) desc,
                 coalesce(goal_difference,0) desc,
                 coalesce(goals_for,0) desc
      )::int as rank,
      club_name, club_short, coalesce(points,0) as points, division,
      coalesce(matches_played,0) as matches_played, coalesce(wins,0) as wins,
      favorite_team_id, previous_position
    from public.global_league_teams
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ) r;
$$;

grant execute on function public.revela_top_clubs(int) to anon, authenticated;

comment on function public.revela_top_clubs(int) is
  'Ranking público do REVELA. NUNCA devolve id nem manager_id — ambos são '
  'e-mail em global_league_teams (ver 20260717170000). Só nome/pontos/divisão.';


-- ── 4.1 As 3 divisões (contagem viva) ───────────────────────────────────────
create or replace function public.revela_divisions()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object('division', d.division, 'clubs', d.clubs) order by d.division
  ), '[]'::jsonb)
  from (
    select coalesce(division, 3) as division, count(*)::int as clubs
    from public.global_league_teams
    group by coalesce(division, 3)
  ) d;
$$;

grant execute on function public.revela_divisions() to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 5. Lendas para a vitrine pública
--
-- legacy_players já libera select pra anon onde listed_on_market = true
-- (20260421211000), então o front poderia ler direto. Usamos RPC mesmo assim,
-- por dois motivos: (a) fixa a lista de colunas num lugar só, (b) devolve o
-- handle do /playervip quando existir, sem o front precisar de um segundo
-- round-trip. Nenhum dado pessoal é tocado.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.revela_list_legends(p_limit int default 12)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(q.payload order by q.ord), '[]'::jsonb)
  from (
    select
      jsonb_build_object(
        'id',         lp.id,
        'name',       lp.name,
        'pos',        lp.pos,
        'club',       lp.main_club,
        'country',    lp.country,
        'phase',      lp.phase,
        'overall',    lp.mint_overall,
        'attributes', lp.attributes,
        'portrait',   coalesce(lp.portrait_public_url, ''),
        'focusX',     coalesce(lp.portrait_focus_x, 0.5),
        'focusY',     coalesce(lp.portrait_focus_y, 0.0),
        'rarity',     lp.rarity_label,
        'title',      lp.narrative_title,
        'tagline',    lp.tagline,
        'bio',        lp.bio,
        'yearStart',  lp.year_start,
        'yearEnd',    lp.year_end,
        'handle',     ph.handle
      ) as payload,
      row_number() over (
        order by coalesce(lp.mint_overall, 0) desc, lp.created_at
      ) as ord
    from public.legacy_players lp
    left join lateral (
      select h.handle from public.playervip_handles h
      where h.collection_id = lp.collection_id
      limit 1
    ) ph on true
    where coalesce(lp.listed_on_market, false) = true
    order by coalesce(lp.mint_overall, 0) desc, lp.created_at
    limit greatest(1, least(coalesce(p_limit, 12), 60))
  ) q;
$$;

grant execute on function public.revela_list_legends(int) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 6. Fila do OLE SCOUT (admin) — aqui SIM o PII aparece, e só pro admin.
--    Chamado pelo backend com service role; nunca pela anon key.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.revela_admin_review_talent(
  p_id         uuid,
  p_status     text,
  p_attributes jsonb default null,
  p_overall    int  default null,
  p_note       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('pending','in_review','approved','rejected','carded') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_status');
  end if;

  update public.revela_talents
  set status      = p_status,
      attributes  = coalesce(p_attributes, attributes),
      overall     = coalesce(p_overall, overall),
      scout_note  = coalesce(p_note, scout_note),
      approved_at = case when p_status in ('approved','carded') then now() else approved_at end,
      updated_at  = now()
  where id = p_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Só service role. Sem grant pra anon/authenticated — de propósito.
revoke execute on function public.revela_admin_review_talent(uuid, text, jsonb, int, text)
  from anon, authenticated;

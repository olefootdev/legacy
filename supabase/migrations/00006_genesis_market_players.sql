-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — 00006_genesis_market_players
--
-- Catálogo oficial «Genesis» (primeiros jogadores OLEFOOT), listados no mercado.
-- Retratos: bucket público `genesis-player-portraits` — caminho sugerido
--   genesis/<id>.jpg (ver comentário em portrait_storage_path).
-- Regenerar seed a partir do CSV: node scripts/gen-genesis-seed-sql.mjs
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.genesis_market_players (
  id text primary key,
  kit_number int not null,
  name text not null,
  pos text not null,
  pos_original text,
  archetype text not null,
  zone text not null,
  behavior text not null,
  attributes jsonb not null default '{}'::jsonb,
  fatigue int not null default 0,
  injury_risk int not null default 0,
  evolution_xp int not null default 0,
  out_for_matches int not null default 0,
  market_value_bro_cents bigint not null default 0,
  price_bro_cents bigint not null default 0,
  country text,
  age int,
  strong_foot text,
  creator_label text,
  rarity_label text,
  bio text,
  listed_on_market boolean not null default true,
  mint_overall int,
  evolution_rate int,
  collection_id text,
  card_supply int default 1,
  spirit_notes text,
  portrait_storage_path text,
  portrait_public_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint genesis_market_players_strong_foot_chk
    check (strong_foot is null or strong_foot in ('right', 'left', 'both'))
);

create index if not exists idx_genesis_market_listed on public.genesis_market_players (listed_on_market, mint_overall desc nulls last);
create index if not exists idx_genesis_market_pos on public.genesis_market_players (pos);

comment on table public.genesis_market_players is 'Catálogo global OLEFOOT Genesis; mercado (listed_on_market) e preços em centavos de BRO.';
comment on column public.genesis_market_players.portrait_storage_path is
  'Caminho do objecto no bucket Storage `genesis-player-portraits` (ex.: genesis/GEN-001.jpg). URL pública = {SUPABASE_URL}/storage/v1/object/public/genesis-player-portraits/{path}';
comment on column public.genesis_market_players.portrait_public_url is
  'Opcional: URL já resolvida (CDN ou upload manual); tem precedência sobre portrait_storage_path na UI.';

alter table public.genesis_market_players enable row level security;

drop policy if exists "genesis_market_players_select_public" on public.genesis_market_players;
create policy "genesis_market_players_select_public"
  on public.genesis_market_players for select
  to anon, authenticated
  using (coalesce(listed_on_market, true) = true);

grant select, update on table public.genesis_market_players to anon, authenticated;

drop policy if exists "genesis_market_players_update_portraits" on public.genesis_market_players;
create policy "genesis_market_players_update_portraits"
  on public.genesis_market_players for update
  to anon, authenticated
  using (true)
  with check (true);

-- ─── Storage: retratos Genesis (upload autenticado sob prefixo genesis/) ───
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'genesis-player-portraits',
  'genesis-player-portraits',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "genesis_portraits_public_read" on storage.objects;
create policy "genesis_portraits_public_read"
  on storage.objects for select
  using (bucket_id = 'genesis-player-portraits');

drop policy if exists "genesis_portraits_auth_insert" on storage.objects;
create policy "genesis_portraits_auth_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'genesis-player-portraits'
    and name like 'genesis/%'
  );

drop policy if exists "genesis_portraits_auth_update" on storage.objects;
create policy "genesis_portraits_auth_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'genesis-player-portraits' and name like 'genesis/%')
  with check (bucket_id = 'genesis-player-portraits' and name like 'genesis/%');

drop policy if exists "genesis_portraits_auth_delete" on storage.objects;
create policy "genesis_portraits_auth_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'genesis-player-portraits' and name like 'genesis/%');

-- genesis_market_players seed (50 rows)
insert into public.genesis_market_players (id, kit_number, name, pos, pos_original, archetype, zone, behavior, attributes, fatigue, injury_risk, evolution_xp, out_for_matches, market_value_bro_cents, price_bro_cents, country, age, strong_foot, creator_label, rarity_label, bio, listed_on_market, mint_overall, evolution_rate, collection_id, card_supply, spirit_notes) values
('GEN-001', 1, 'Adrien Ayo', 'MC', 'LM', 'novo_talento', 'meio', 'criativo', '{"passe":35,"marcacao":35,"velocidade":35,"drible":25,"finalizacao":25,"fisico":31,"tatico":28,"mentalidade":25,"confianca":30,"fairPlay":35}'::jsonb, 0, 61, 57, 0, 1000, 1000, 'France', 19, null, 'genesis', 'Basic', 'Prefers positioning over chasing — spatial intelligence influences defense.', true, 30, 62, 'genesis', 1, 'Creative Soul'),
('GEN-002', 2, 'Adrien Ayo', 'MC', 'LM', 'novo_talento', 'meio', 'criativo', '{"passe":55,"marcacao":35,"velocidade":55,"drible":25,"finalizacao":40,"fisico":40,"tatico":42,"mentalidade":45,"confianca":45,"fairPlay":45}'::jsonb, 0, 54, 57, 0, 4000, 4000, 'France', 21, null, 'genesis', 'Rare', 'Prefers positioning over chasing — spatial intelligence influences defense.', true, 43, 80, 'genesis', 1, 'Creative Soul'),
('GEN-003', 3, 'Adrien Ayo', 'MC', 'LM', 'novo_talento', 'meio', 'criativo', '{"passe":55,"marcacao":40,"velocidade":75,"drible":35,"finalizacao":55,"fisico":40,"tatico":49,"mentalidade":55,"confianca":50,"fairPlay":45}'::jsonb, 0, 47, 91, 0, 25000, 25000, 'France', 23, null, 'genesis', 'Ultra Rare', 'Prefers positioning over chasing — spatial intelligence influences defense.', true, 50, 91, 'genesis', 1, 'Creative Soul'),
('GEN-004', 4, 'Ahmad Al-Kuwari', 'PE', 'LW', 'profissional', 'lateral_esq', 'ofensivo', '{"passe":35,"marcacao":35,"velocidade":35,"drible":25,"finalizacao":30,"fisico":37,"tatico":32,"mentalidade":35,"confianca":30,"fairPlay":25}'::jsonb, 0, 70, 57, 0, 1000, 1000, 'Qatar', 25, null, 'genesis', 'Basic', 'Accelerates game in emotional situations — pride overrules tactics under pressure.', true, 32, 67, 'genesis', 1, 'Provocative'),
('GEN-005', 5, 'Ahmad Al-Kuwari', 'PE', 'LW', 'profissional', 'lateral_esq', 'ofensivo', '{"passe":35,"marcacao":38,"velocidade":40,"drible":40,"finalizacao":38,"fisico":42,"tatico":38,"mentalidade":40,"confianca":37,"fairPlay":35}'::jsonb, 0, 70, 57, 0, 7000, 7000, 'Qatar', 27, null, 'genesis', 'Silver', 'Accelerates game in emotional situations — pride overrules tactics under pressure.', true, 38, 61, 'genesis', 1, 'Provocative'),
('GEN-006', 6, 'Augusto Bobby', 'MC', 'CAM', 'novo_talento', 'meio', 'ofensivo', '{"passe":25,"marcacao":20,"velocidade":35,"drible":15,"finalizacao":35,"fisico":44,"tatico":22,"mentalidade":25,"confianca":30,"fairPlay":35}'::jsonb, 0, 64, 57, 0, 1000, 1000, 'Jamaica', 21, null, 'genesis', 'Basic', 'Plays through pain — injury resistance overrides substitution logic.', true, 29, 60, 'genesis', 1, 'Provocative'),
('GEN-007', 7, 'Bruno Guina', 'MC', 'CM', 'novo_talento', 'meio', 'ofensivo', '{"passe":35,"marcacao":30,"velocidade":35,"drible":25,"finalizacao":20,"fisico":28,"tatico":24,"mentalidade":15,"confianca":20,"fairPlay":25}'::jsonb, 0, 58, 57, 0, 1000, 1000, 'Brazil', 17, null, 'genesis', 'Basic', 'Dribbles like poetry, but bleeds when the game gets tough.', true, 26, 57, 'genesis', 1, 'Provocative'),
('GEN-008', 8, 'Adriano Carioca', 'ATA', 'CF', 'novo_talento', 'ataque', 'ofensivo', '{"passe":35,"marcacao":20,"velocidade":35,"drible":35,"finalizacao":45,"fisico":49,"tatico":35,"mentalidade":35,"confianca":40,"fairPlay":45}'::jsonb, 0, 61, 77, 0, 12000, 12000, 'Brazil', 19, null, 'genesis', 'Gold', 'Prefers to shoot than pass when approaching the box — natural bias for protagonism.', true, 37, 77, 'genesis', 1, 'Provocative'),
('GEN-009', 9, 'Felipe Ybere', 'PD', 'RW', 'novo_talento', 'lateral_dir', 'equilibrado', '{"passe":35,"marcacao":30,"velocidade":35,"drible":25,"finalizacao":25,"fisico":34,"tatico":28,"mentalidade":25,"confianca":25,"fairPlay":25}'::jsonb, 0, 58, 57, 0, 1000, 1000, 'Peru', 17, null, 'genesis', 'Basic', 'Unshakable belief — trusts the game can shift with ancestral guidance.', true, 29, 62, 'genesis', 1, 'Impulsive Charger'),
('GEN-010', 10, 'Flavio Medina', 'VOL', 'CDM', 'profissional', 'meio', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":35,"drible":25,"finalizacao":35,"fisico":47,"tatico":32,"mentalidade":35,"confianca":30,"fairPlay":25}'::jsonb, 0, 67, 57, 0, 1000, 1000, 'Espanha', 23, null, 'genesis', 'Basic', 'Unique style forged by skill, vision, and passion.', true, 33, 61, 'genesis', 1, 'Legacy'),
('GEN-011', 11, 'Eurico Freddy', 'VOL', 'CDM', 'profissional', 'meio', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":35,"drible":25,"finalizacao":35,"fisico":47,"tatico":32,"mentalidade":35,"confianca":30,"fairPlay":25}'::jsonb, 0, 70, 57, 0, 1000, 1000, 'Gana', 25, null, 'genesis', 'Basic', 'Loses tempo when multitasked — better with clear singular focus.', true, 33, 57, 'genesis', 1, 'Impulsive Charger'),
('GEN-012', 12, 'Gui Nunez', 'ATA', 'CF', 'profissional', 'ataque', 'ofensivo', '{"passe":45,"marcacao":20,"velocidade":35,"drible":35,"finalizacao":45,"fisico":51,"tatico":42,"mentalidade":45,"confianca":40,"fairPlay":35}'::jsonb, 0, 77, 62, 0, 12000, 12000, 'Brazil', 30, null, 'genesis', 'Gold', 'Prefers to shoot than pass when approaching the box — natural bias for protagonism.', true, 39, 62, 'genesis', 1, 'Provocative'),
('GEN-013', 13, 'Bernard Gustave', 'ATA', 'CF', 'profissional', 'ataque', 'equilibrado', '{"passe":55,"marcacao":18,"velocidade":50,"drible":45,"finalizacao":55,"fisico":47,"tatico":46,"mentalidade":40,"confianca":40,"fairPlay":40}'::jsonb, 0, 65, 56, 0, 15000, 15000, 'France', 27, null, 'genesis', 'Retro', 'Creative playmaker with elegance and tactical sharpness.', true, 44, 56, 'genesis', 1, 'Legacy'),
('GEN-014', 14, 'Helinho', 'LD', 'RWB', 'profissional', 'lateral_dir', 'equilibrado', '{"passe":45,"marcacao":30,"velocidade":45,"drible":35,"finalizacao":30,"fisico":43,"tatico":42,"mentalidade":45,"confianca":40,"fairPlay":35}'::jsonb, 0, 65, 62, 0, 12000, 12000, 'Brazil', 25, null, 'genesis', 'Gold', 'Presses deeper when teammates slow down — compensates for others instinctively.', true, 39, 62, 'genesis', 1, 'Legacy'),
('GEN-015', 15, 'Helinho', 'LD', 'RWB', 'profissional', 'lateral_dir', 'equilibrado', '{"passe":55,"marcacao":42,"velocidade":45,"drible":50,"finalizacao":40,"fisico":48,"tatico":53,"mentalidade":55,"confianca":45,"fairPlay":35}'::jsonb, 0, 72, 67, 0, 15000, 15000, 'Brazil', 30, null, 'genesis', 'Retro', 'Presses deeper when teammates slow down — compensates for others instinctively.', true, 47, 67, 'genesis', 1, 'Provocador'),
('GEN-016', 16, 'Henrine Tito', 'PD', 'RM', 'profissional', 'meio', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":35,"drible":35,"finalizacao":30,"fisico":45,"tatico":27,"mentalidade":15,"confianca":15,"fairPlay":15}'::jsonb, 0, 70, 57, 0, 1000, 1000, 'Italy', 25, null, 'genesis', 'Basic', 'Unique style forged by skill, vision, and passion.', true, 29, 47, 'genesis', 1, 'Adaptive Leader'),
('GEN-017', 17, 'James Oliver', 'ATA', 'ST', 'novo_talento', 'ataque', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":25,"drible":25,"finalizacao":45,"fisico":55,"tatico":24,"mentalidade":15,"confianca":10,"fairPlay":5}'::jsonb, 0, 77, 57, 0, 12000, 12000, 'United States', 20, null, 'genesis', 'Gold', 'Boosts intensity when crowd reacts — external rhythm drives internal tempo.', true, 27, 57, 'genesis', 1, 'Cold Strategist'),
('GEN-018', 18, 'Joel Andinho', 'ZAG', 'CB', 'novo_talento', 'defesa', 'ofensivo', '{"passe":35,"marcacao":35,"velocidade":35,"drible":35,"finalizacao":20,"fisico":39,"tatico":27,"mentalidade":15,"confianca":25,"fairPlay":35}'::jsonb, 0, 65, 57, 0, 1000, 1000, 'Colombia', 15, null, 'genesis', 'Basic', 'Maintains movement pattern even under pressure — values structure over chaos.', true, 30, 57, 'genesis', 1, 'Provocative'),
('GEN-019', 19, 'Joel Andinho', 'ZAG', 'CB', 'novo_talento', 'defesa', 'ofensivo', '{"passe":45,"marcacao":40,"velocidade":45,"drible":45,"finalizacao":30,"fisico":44,"tatico":37,"mentalidade":25,"confianca":30,"fairPlay":35}'::jsonb, 0, 66, 62, 0, 20000, 20000, 'Colombia', 19, null, 'genesis', 'Next', 'Maintains movement pattern even under pressure — values structure over chaos.', true, 38, 62, 'genesis', 1, 'Provocative'),
('GEN-020', 20, 'John Malby', 'LD', 'RB', 'profissional', 'lateral_dir', 'equilibrado', '{"passe":35,"marcacao":30,"velocidade":35,"drible":35,"finalizacao":30,"fisico":48,"tatico":31,"mentalidade":25,"confianca":25,"fairPlay":25}'::jsonb, 0, 67, 57, 0, 1000, 1000, 'United States', 23, null, 'genesis', 'Basic', 'Unique style forged by skill, vision, and passion.', true, 32, 56, 'genesis', 1, 'Impulsive Charger'),
('GEN-021', 21, 'Juan Figueroa', 'MC', 'CAM', 'profissional', 'meio', 'equilibrado', '{"passe":25,"marcacao":35,"velocidade":35,"drible":35,"finalizacao":35,"fisico":48,"tatico":32,"mentalidade":35,"confianca":25,"fairPlay":15}'::jsonb, 0, 67, 57, 0, 1000, 1000, 'Argentina', 23, null, 'genesis', 'Basic', 'Takes long shots when momentum drops — attempts to reset energy.', true, 32, 61, 'genesis', 1, 'Cold Strategist'),
('GEN-022', 22, 'Julio Camargo', 'MC', 'CCM', 'profissional', 'meio', 'equilibrado', '{"passe":35,"marcacao":30,"velocidade":35,"drible":35,"finalizacao":30,"fisico":40,"tatico":35,"mentalidade":35,"confianca":35,"fairPlay":35}'::jsonb, 0, 73, 57, 0, 1000, 1000, 'Brazil', 27, null, 'genesis', 'Basic', 'Delivers long passes to break compact lines — vision-oriented decision-making.', true, 34, 63, 'genesis', 1, 'Legacy'),
('GEN-023', 23, 'Julio Camargo', 'MC', 'CCM', 'profissional', 'meio', 'equilibrado', '{"passe":45,"marcacao":40,"velocidade":35,"drible":45,"finalizacao":40,"fisico":45,"tatico":45,"mentalidade":45,"confianca":45,"fairPlay":45}'::jsonb, 0, 77, 62, 0, 12000, 12000, 'Brazil', 30, null, 'genesis', 'Gold', 'Delivers long passes to break compact lines — vision-oriented decision-making.', true, 43, 62, 'genesis', 1, 'Legacy'),
('GEN-024', 24, 'Julio Camargo', 'MC', 'CCM', 'lenda', 'meio', 'equilibrado', '{"passe":55,"marcacao":70,"velocidade":55,"drible":45,"finalizacao":60,"fisico":60,"tatico":56,"mentalidade":65,"confianca":55,"fairPlay":45}'::jsonb, 0, 67, 72, 0, 30000, 30000, 'Brazil', 30, null, 'genesis', 'Legend', 'Delivers long passes to break compact lines — vision-oriented decision-making.', true, 57, 72, 'genesis', 1, 'Legacy'),
('GEN-025', 25, 'Luca Preto', 'LE', 'LB', 'profissional', 'lateral_esq', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":35,"drible":35,"finalizacao":20,"fisico":44,"tatico":31,"mentalidade":25,"confianca":25,"fairPlay":25}'::jsonb, 0, 70, 57, 0, 1000, 1000, 'Brazil', 25, null, 'genesis', 'Basic', 'Skillful and unpredictable, you shine under pressure.', true, 31, 52, 'genesis', 1, 'Impulsive'),
('GEN-026', 26, 'Lyov Miroslav', 'GOL', 'GK', 'novo_talento', 'gol', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":35,"drible":15,"finalizacao":20,"fisico":40,"tatico":25,"mentalidade":25,"confianca":20,"fairPlay":15}'::jsonb, 0, 68, 57, 0, 2000, 2000, 'Russian', 17, null, 'genesis', 'Academy', 'Born to lead — snaps when a teammate is unfairly hit', true, 26, 72, 'genesis', 1, 'Cold Strategist'),
('GEN-027', 27, 'Lyov Miroslav', 'GOL', 'GK', 'lenda', 'gol', 'equilibrado', '{"passe":65,"marcacao":55,"velocidade":55,"drible":55,"finalizacao":40,"fisico":58,"tatico":62,"mentalidade":65,"confianca":50,"fairPlay":35}'::jsonb, 0, 85, 62, 0, 30000, 30000, 'Russian', 35, null, 'genesis', 'Legend', 'Born to lead — snaps when a teammate is unfairly hit', true, 54, 62, 'genesis', 1, 'Cold Strategist'),
('GEN-028', 28, 'Marcelinho Souza', 'ZAG', 'CB', 'novo_talento', 'defesa', 'equilibrado', '{"passe":45,"marcacao":65,"velocidade":75,"drible":35,"finalizacao":40,"fisico":60,"tatico":50,"mentalidade":65,"confianca":50,"fairPlay":35}'::jsonb, 0, 48, 100, 0, 25000, 25000, 'Brazil', 17, null, 'genesis', 'Ultra Rare', 'Switches flanks frequently — uses field geometry to create numerical advantage.', true, 52, 100, 'genesis', 1, 'Adaptive Leader'),
('GEN-029', 29, 'Marinho Souza', 'MC', 'CM', 'profissional', 'meio', 'equilibrado', '{"passe":35,"marcacao":25,"velocidade":35,"drible":35,"finalizacao":35,"fisico":43,"tatico":27,"mentalidade":15,"confianca":20,"fairPlay":25}'::jsonb, 0, 70, 57, 0, 1000, 1000, 'Brazil', 25, null, 'genesis', 'Basic', 'Skillful and unpredictable, you shine under pressure.', true, 30, 47, 'genesis', 1, 'Impulsive'),
('GEN-030', 30, 'Martine Pache', 'LE', 'LWB', 'novo_talento', 'lateral_esq', 'equilibrado', '{"passe":25,"marcacao":45,"velocidade":45,"drible":35,"finalizacao":45,"fisico":36,"tatico":32,"mentalidade":35,"confianca":30,"fairPlay":25}'::jsonb, 0, 56, 67, 0, 12000, 12000, 'Espanha', 19, null, 'genesis', 'Gold', 'Unique style forged by skill, vision, and passion.', true, 35, 67, 'genesis', 1, 'Provocador'),
('GEN-031', 31, 'Moacir Ruda', 'VOL', 'CDM', 'profissional', 'meio', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":35,"drible":25,"finalizacao":15,"fisico":22,"tatico":32,"mentalidade":35,"confianca":35,"fairPlay":35}'::jsonb, 0, 70, 57, 0, 1000, 1000, 'Peru', 25, null, 'genesis', 'Basic', 'Unique style forged by skill, vision, and passion.', true, 30, 57, 'genesis', 1, 'Impulsive Charger'),
('GEN-032', 32, 'Murilo Garcia', 'GOL', 'GK', 'profissional', 'gol', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":35,"drible":15,"finalizacao":20,"fisico":37,"tatico":25,"mentalidade":25,"confianca":25,"fairPlay":25}'::jsonb, 0, 80, 57, 0, 1000, 1000, 'Uruguay', 25, null, 'genesis', 'Basic', 'Gritty and fearless, you lead with heart and instinct.', true, 28, 52, 'genesis', 1, 'Impulsive'),
('GEN-033', 33, 'Omar Khalid', 'GOL', 'GK', 'profissional', 'gol', 'ofensivo', '{"passe":30,"marcacao":38,"velocidade":40,"drible":25,"finalizacao":20,"fisico":32,"tatico":30,"mentalidade":35,"confianca":37,"fairPlay":40}'::jsonb, 0, 85, 57, 0, 7000, 7000, 'Pakistan', 30, null, 'genesis', 'Silver', 'Unshakable belief — trusts the game can shift with ancestral guidance.', true, 33, 62, 'genesis', 1, 'Provocative'),
('GEN-034', 34, 'Mathias Jimenez', 'MC', 'LM', 'profissional', 'meio', 'ofensivo', '{"passe":25,"marcacao":30,"velocidade":35,"drible":25,"finalizacao":25,"fisico":42,"tatico":29,"mentalidade":35,"confianca":25,"fairPlay":15}'::jsonb, 0, 70, 57, 0, 1000, 1000, 'Paraguay', 25, null, 'genesis', 'Basic', 'Reads space before engaging — relies on strategy over instinct.', true, 29, 57, 'genesis', 1, 'Provocative'),
('GEN-035', 35, 'Mathias Jimenez', 'MC', 'LM', 'profissional', 'meio', 'ofensivo', '{"passe":40,"marcacao":32,"velocidade":30,"drible":30,"finalizacao":32,"fisico":47,"tatico":35,"mentalidade":35,"confianca":30,"fairPlay":25}'::jsonb, 0, 72, 57, 0, 7000, 7000, 'Paraguay', 25, null, 'genesis', 'Silver', 'Reads space before engaging — relies on strategy over instinct.', true, 34, 62, 'genesis', 1, 'Provocative'),
('GEN-036', 36, 'Polk Idea', 'ZAG', 'CB', 'profissional', 'defesa', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":35,"drible":35,"finalizacao":30,"fisico":50,"tatico":23,"mentalidade":5,"confianca":5,"fairPlay":5}'::jsonb, 0, 87, 57, 0, 1000, 1000, 'Ukranian', 30, null, 'genesis', 'Basic', 'Unique style forged by skill, vision, and passion.', true, 26, 32, 'genesis', 1, 'Impulsive'),
('GEN-037', 37, 'Aljariri Rahman', 'MC', 'CAM', 'profissional', 'meio', 'equilibrado', '{"passe":35,"marcacao":20,"velocidade":35,"drible":35,"finalizacao":35,"fisico":43,"tatico":31,"mentalidade":25,"confianca":30,"fairPlay":35}'::jsonb, 0, 70, 57, 0, 1000, 1000, 'UAE', 25, null, 'genesis', 'Basic', 'Rarely retreats — forward movement defines his approach.', true, 32, 62, 'genesis', 1, 'Impulsive'),
('GEN-038', 38, 'Aljariri Rahman', 'MC', 'CAM', 'novo_talento', 'meio', 'equilibrado', '{"passe":45,"marcacao":35,"velocidade":55,"drible":55,"finalizacao":75,"fisico":58,"tatico":60,"mentalidade":75,"confianca":55,"fairPlay":35}'::jsonb, 0, 67, 97, 0, 25000, 25000, 'UAE', 30, null, 'genesis', 'Ultra Rare', 'Rarely retreats — forward movement defines his approach.', true, 55, 97, 'genesis', 1, 'Impulsive'),
('GEN-039', 39, 'Sanjay Ravi', 'GOL', 'GK', 'profissional', 'gol', 'equilibrado', '{"passe":25,"marcacao":25,"velocidade":35,"drible":25,"finalizacao":35,"fisico":39,"tatico":29,"mentalidade":35,"confianca":35,"fairPlay":35}'::jsonb, 0, 80, 57, 0, 1000, 1000, 'Indian', 25, null, 'genesis', 'Basic', 'Unshakable belief — trusts the game can shift with ancestral guidance.', true, 32, 57, 'genesis', 1, 'Impulsive Charger'),
('GEN-040', 40, 'Ruiz Pacheco', 'PD', 'RW', 'novo_talento', 'lateral_dir', 'equilibrado', '{"passe":55,"marcacao":60,"velocidade":65,"drible":55,"finalizacao":75,"fisico":57,"tatico":59,"mentalidade":65,"confianca":65,"fairPlay":65}'::jsonb, 0, 59, 57, 0, 9000, 9000, 'Chile', 28, null, 'genesis', 'Classic', 'Unique style forged by skill, vision, and passion.', true, 62, 76, 'genesis', 1, 'Adaptive Leader'),
('GEN-041', 41, 'Ruiz Pacheco', 'PD', 'RW', 'lenda', 'lateral_dir', 'equilibrado', '{"passe":65,"marcacao":70,"velocidade":65,"drible":65,"finalizacao":85,"fisico":57,"tatico":65,"mentalidade":65,"confianca":65,"fairPlay":65}'::jsonb, 0, 62, 72, 0, 30000, 30000, 'Chile', 30, null, 'genesis', 'Legend', 'Unique style forged by skill, vision, and passion.', true, 67, 72, 'genesis', 1, 'Adaptive Leader'),
('GEN-042', 42, 'Satto Nakamoto', 'ZAG', 'CB', 'profissional', 'defesa', 'equilibrado', '{"passe":45,"marcacao":35,"velocidade":45,"drible":45,"finalizacao":40,"fisico":36,"tatico":33,"mentalidade":15,"confianca":30,"fairPlay":45}'::jsonb, 0, 78, 43, 0, 12000, 12000, 'Japan', 27, null, 'genesis', 'Gold', 'Precise, focused, and resilient in every situation.', true, 37, 43, 'genesis', 1, 'Adaptive Leader'),
('GEN-043', 43, 'Savinho Davila', 'PD', 'EXT', 'novo_talento', 'ataque', 'equilibrado', '{"passe":45,"marcacao":25,"velocidade":45,"drible":45,"finalizacao":40,"fisico":29,"tatico":37,"mentalidade":25,"confianca":25,"fairPlay":25}'::jsonb, 0, 53, 62, 0, 12000, 12000, 'Brazil', 17, null, 'genesis', 'Gold', 'Delays passing in favor of direct action — believes in personal execution.', true, 34, 62, 'genesis', 1, 'Adaptive Leader'),
('GEN-044', 44, 'Luiz Spiner', 'GOL', 'GK', 'profissional', 'gol', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":35,"drible":15,"finalizacao":20,"fisico":42,"tatico":25,"mentalidade":25,"confianca":25,"fairPlay":25}'::jsonb, 0, 80, 57, 0, 1000, 1000, 'Mexico', 25, null, 'genesis', 'Basic', 'Unique style forged by skill, vision, and passion.', true, 28, 52, 'genesis', 1, 'Impulsive Charger'),
('GEN-045', 45, 'Sun Tsung', 'LD', 'RB', 'profissional', 'lateral_dir', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":25,"drible":35,"finalizacao":10,"fisico":38,"tatico":27,"mentalidade":15,"confianca":20,"fairPlay":25}'::jsonb, 0, 82, 57, 0, 1000, 1000, 'South Korea', 30, null, 'genesis', 'Basic', 'Responds to coach input faster than peer pressure — prioritizes leadership over environment.', true, 26, 37, 'genesis', 1, 'Cold Strategist'),
('GEN-046', 46, 'Patrick Taliano', 'ATA', 'ST', 'profissional', 'ataque', 'equilibrado', '{"passe":35,"marcacao":20,"velocidade":35,"drible":35,"finalizacao":35,"fisico":32,"tatico":23,"mentalidade":5,"confianca":10,"fairPlay":15}'::jsonb, 0, 86, 57, 0, 1000, 1000, 'Italy', 29, null, 'genesis', 'Basic', 'Activates sprint mode without needing trigger — physical instinct drives reactions.', true, 24, 34, 'genesis', 1, 'Impulsive'),
('GEN-047', 47, 'Dario Tcheco', 'LE', 'LB', 'profissional', 'lateral_esq', 'equilibrado', '{"passe":35,"marcacao":25,"velocidade":35,"drible":25,"finalizacao":25,"fisico":39,"tatico":28,"mentalidade":25,"confianca":30,"fairPlay":35}'::jsonb, 0, 70, 57, 0, 1000, 1000, 'Tchequia', 25, null, 'genesis', 'Basic', 'Overcommits after scoring — momentum disrupts balance.', true, 30, 52, 'genesis', 1, 'Cold Strategist'),
('GEN-048', 48, 'Caue Ubirajara', 'ZAG', 'CB', 'profissional', 'defesa', 'equilibrado', '{"passe":35,"marcacao":35,"velocidade":15,"drible":15,"finalizacao":5,"fisico":22,"tatico":29,"mentalidade":35,"confianca":35,"fairPlay":35}'::jsonb, 0, 100, 57, 0, 1000, 1000, 'Equador', 35, null, 'genesis', 'Basic', 'Unique style forged by skill, vision, and passion.', true, 26, 37, 'genesis', 1, 'Impulsive Charger'),
('GEN-049', 49, 'Victor Suarez', 'PD', 'RM', 'profissional', 'meio', 'equilibrado', '{"passe":35,"marcacao":25,"velocidade":35,"drible":35,"finalizacao":35,"fisico":33,"tatico":35,"mentalidade":35,"confianca":35,"fairPlay":35}'::jsonb, 0, 67, 57, 0, 1000, 1000, 'Uruguay', 23, null, 'genesis', 'Basic', 'Gritty and fearless, you lead with heart and instinct.', true, 34, 61, 'genesis', 1, 'Adaptive Leader'),
('GEN-050', 50, 'Zimbabwe Konolulo', 'GOL', 'GK', 'profissional', 'gol', 'equilibrado', '{"passe":45,"marcacao":35,"velocidade":25,"drible":45,"finalizacao":10,"fisico":40,"tatico":45,"mentalidade":45,"confianca":45,"fairPlay":45}'::jsonb, 0, 92, 62, 0, 12000, 12000, 'Gana', 30, null, 'genesis', 'Gold', 'Unique style forged by skill, vision, and passion.', true, 38, 62, 'genesis', 1, 'Impulsive Charger')
on conflict (id) do update set
  kit_number = excluded.kit_number, name = excluded.name, pos = excluded.pos, pos_original = excluded.pos_original, archetype = excluded.archetype, zone = excluded.zone, behavior = excluded.behavior, attributes = excluded.attributes, fatigue = excluded.fatigue, injury_risk = excluded.injury_risk, evolution_xp = excluded.evolution_xp, out_for_matches = excluded.out_for_matches, market_value_bro_cents = excluded.market_value_bro_cents, price_bro_cents = excluded.price_bro_cents, country = excluded.country, age = excluded.age, strong_foot = excluded.strong_foot, creator_label = excluded.creator_label, rarity_label = excluded.rarity_label, bio = excluded.bio, listed_on_market = excluded.listed_on_market, mint_overall = excluded.mint_overall, evolution_rate = excluded.evolution_rate, collection_id = excluded.collection_id, card_supply = excluded.card_supply, spirit_notes = excluded.spirit_notes, updated_at = now();

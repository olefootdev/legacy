/**
 * Lê supabase/seeds/olefoot_genesis_players_source.csv e escreve SQL INSERT
 * para public.genesis_market_players (stdout).
 * Uso: node scripts/gen-genesis-seed-sql.mjs > /tmp/genesis_seed.sql
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(__dirname, '../supabase/seeds/olefoot_genesis_players_source.csv');

const POS_MAP = {
  GK: 'GOL',
  LM: 'MC',
  LW: 'PE',
  CAM: 'MC',
  CDM: 'VOL',
  CCM: 'MC',
  RWB: 'LD',
  LWB: 'LE',
  ST: 'ATA',
  CF: 'ATA',
  CB: 'ZAG',
  RB: 'LD',
  LB: 'LE',
  RW: 'PD',
  RM: 'PD',
  EXT: 'PD',
};

function normPos(p) {
  const k = String(p || '')
    .trim()
    .toUpperCase();
  return POS_MAP[k] ?? 'MC';
}

function normZone(z) {
  const u = String(z || '').toLowerCase();
  if (u === 'goal') return 'gol';
  if (u.includes('defense_central')) return 'defesa';
  if (u.includes('defense_left') || u.includes('wing_left')) return 'lateral_esq';
  if (u.includes('defense_right') || u.includes('wing_right')) return 'lateral_dir';
  if (u === 'wing_attack' || u.includes('attack_center') || u === 'attack_striker') return 'ataque';
  if (u.includes('attack_left')) return 'lateral_esq';
  if (u.includes('attack_right')) return 'lateral_dir';
  if (u.startsWith('mid')) return 'meio';
  return 'meio';
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function sqlStr(s) {
  if (s == null || s === '') return 'null';
  return `'${String(s).replace(/'/g, "''")}'`;
}

function sqlJson(s) {
  if (!s || !s.trim()) return `'{}'::jsonb`;
  try {
    const o = JSON.parse(s);
    return `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;
  } catch {
    return `'{}'::jsonb`;
  }
}

function sqlInt(n, def = 0) {
  const x = Number(n);
  if (!Number.isFinite(x)) return String(def);
  return String(Math.round(x));
}

function sqlBool(v) {
  const t = String(v).trim().toLowerCase();
  if (t === 'true' || t === '1') return 'true';
  return 'false';
}

/** Alinhado a `genesisListingPriceExpFromMintOverall` (playerContracts) — mint OVR 24–72 → 250k–1M EXP, passo 5k. */
function genesisListingPriceExpFromMintOverall(mintOverall) {
  const o =
    mintOverall != null && Number.isFinite(Number(mintOverall)) ? Math.round(Number(mintOverall)) : 30;
  const t = (Math.max(24, Math.min(72, o)) - 24) / 48;
  const raw = 250_000 + Math.round(t * (1_000_000 - 250_000));
  return Math.round(raw / 5000) * 5000;
}

const raw = fs.readFileSync(csvPath, 'utf8');
const lines = raw.split(/\r?\n/).filter((l) => l.trim());
const header = parseCsvLine(lines[0]);
const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));

const rows = [];
for (let li = 1; li < lines.length; li++) {
  const cols = parseCsvLine(lines[li]);
  if (cols.length < header.length) continue;
  const g = (h) => cols[idx[h]] ?? '';
  const id = g('id').trim();
  if (!id) continue;
  const attrsJson = g('attrs');
  const posOle = normPos(g('pos'));
  const zoneOle = normZone(g('zone'));
  const priceBro = g('priceBRO');
  const mvc = g('marketValueBroCents');
  const priceCents = Number.isFinite(Number(priceBro)) ? Math.round(Number(priceBro) * 100) : Number(mvc) || 0;
  const mintRaw = g('mintOverall').trim();
  const mintNum = mintRaw ? Number(mintRaw) : NaN;
  const priceExp = genesisListingPriceExpFromMintOverall(mintNum);
  const marketValueExp = priceExp;
  rows.push({
    id,
    kit_number: sqlInt(g('num'), 0),
    name: g('name').trim(),
    pos: posOle,
    pos_original: g('pos').trim(),
    archetype: g('archetype').trim() || 'novo_talento',
    zone: zoneOle,
    behavior: g('behavior').trim() || 'equilibrado',
    attributes: attrsJson,
    fatigue: sqlInt(g('fatigue'), 0),
    injury_risk: sqlInt(g('injuryRisk'), 0),
    evolution_xp: sqlInt(g('evolutionXp'), 0),
    out_for_matches: sqlInt(g('outForMatches'), 0),
    market_value_bro_cents: sqlInt(mvc, 0),
    price_bro_cents: String(priceCents),
    price_exp: String(priceExp),
    market_value_exp: String(marketValueExp),
    country: g('country').trim(),
    age: g('age').trim() ? sqlInt(g('age'), 0) : 'null',
    strong_foot: g('strongFoot').trim().toLowerCase() || null,
    creator_label: g('creatorType').trim() || 'genesis',
    rarity_label: g('rarity').trim() || 'Basic',
    bio: g('bio').trim(),
    listed: 'true',
    mint_overall: g('mintOverall').trim() ? sqlInt(g('mintOverall'), 0) : 'null',
    evolution_rate: g('evolutionRate').trim() ? sqlInt(g('evolutionRate'), 1) : 'null',
    collection_id: (g('collectionId') || 'genesis').trim() || 'genesis',
    card_supply: sqlInt(g('cardSupply'), 1),
    spirit_notes: (g('spiritNotes') || '').trim(),
  });
}

console.log('-- genesis_market_players seed (' + rows.length + ' rows)');
console.log(
  'insert into public.genesis_market_players (id, kit_number, name, pos, pos_original, archetype, zone, behavior, attributes, fatigue, injury_risk, evolution_xp, out_for_matches, market_value_bro_cents, price_bro_cents, price_exp, market_value_exp, contract_matches_included, contract_is_lifetime, country, age, strong_foot, creator_label, rarity_label, bio, listed_on_market, mint_overall, evolution_rate, collection_id, card_supply, spirit_notes) values',
);
const parts = rows.map(
  (r) =>
    `(${sqlStr(r.id)}, ${r.kit_number}, ${sqlStr(r.name)}, ${sqlStr(r.pos)}, ${sqlStr(r.pos_original)}, ${sqlStr(r.archetype)}, ${sqlStr(r.zone)}, ${sqlStr(r.behavior)}, ${sqlJson(r.attributes)}, ${r.fatigue}, ${r.injury_risk}, ${r.evolution_xp}, ${r.out_for_matches}, ${r.market_value_bro_cents}, ${r.price_bro_cents}, ${r.price_exp}, ${r.market_value_exp}, 70, false, ${sqlStr(r.country)}, ${r.age}, ${r.strong_foot ? sqlStr(r.strong_foot) : 'null'}, ${sqlStr(r.creator_label)}, ${sqlStr(r.rarity_label)}, ${sqlStr(r.bio)}, ${r.listed}, ${r.mint_overall}, ${r.evolution_rate}, ${sqlStr(r.collection_id)}, ${r.card_supply}, ${r.spirit_notes ? sqlStr(r.spirit_notes) : 'null'})`,
);
console.log(parts.join(',\n'));
console.log('on conflict (id) do update set');
console.log(
  '  kit_number = excluded.kit_number, name = excluded.name, pos = excluded.pos, pos_original = excluded.pos_original, archetype = excluded.archetype, zone = excluded.zone, behavior = excluded.behavior, attributes = excluded.attributes, fatigue = excluded.fatigue, injury_risk = excluded.injury_risk, evolution_xp = excluded.evolution_xp, out_for_matches = excluded.out_for_matches, market_value_bro_cents = excluded.market_value_bro_cents, price_bro_cents = excluded.price_bro_cents, price_exp = excluded.price_exp, market_value_exp = excluded.market_value_exp, contract_matches_included = excluded.contract_matches_included, contract_is_lifetime = excluded.contract_is_lifetime, country = excluded.country, age = excluded.age, strong_foot = excluded.strong_foot, creator_label = excluded.creator_label, rarity_label = excluded.rarity_label, bio = excluded.bio, listed_on_market = excluded.listed_on_market, mint_overall = excluded.mint_overall, evolution_rate = excluded.evolution_rate, collection_id = excluded.collection_id, card_supply = excluded.card_supply, spirit_notes = excluded.spirit_notes, updated_at = now();',
);

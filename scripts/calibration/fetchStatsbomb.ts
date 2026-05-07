/**
 * Fetch StatsBomb Open Data — dados reais de partidas de futebol.
 *
 * StatsBomb disponibiliza ~900+ partidas no GitHub com eventos detalhados:
 * chutes com xG, passes com coordenadas, pressão, dribles, etc.
 *
 * Salva em scripts/calibration/raw/ (gitignored).
 *
 * Uso: npx tsx scripts/calibration/fetchStatsbomb.ts
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const BASE = 'https://raw.githubusercontent.com/statsbomb/open-data/master/data';
const RAW_DIR = join(import.meta.dirname, 'raw');

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

interface SBCompetition {
  competition_id: number;
  season_id: number;
  competition_name: string;
  season_name: string;
}

interface SBMatch {
  match_id: number;
  home_team: { home_team_name: string };
  away_team: { away_team_name: string };
  home_score: number;
  away_score: number;
}

async function main() {
  mkdirSync(join(RAW_DIR, 'events'), { recursive: true });

  console.log('Fetching competitions...');
  const competitions: SBCompetition[] = await fetchJSON(`${BASE}/competitions.json`);

  // Pegar ligas top: La Liga, Premier League, Champions League, World Cup, etc.
  const topCompIds = new Set([11, 2, 16, 43, 72, 37, 49, 55]); // IDs conhecidos
  const selected = competitions.filter(c => topCompIds.has(c.competition_id));

  if (selected.length === 0) {
    console.log('Nenhuma competição encontrada nos IDs target. Usando todas disponíveis (limit 8).');
    selected.push(...competitions.slice(0, 8));
  }

  console.log(`${selected.length} competition-seasons selecionadas.`);

  let matchCount = 0;
  const MAX_MATCHES = 200; // Limite para não exagerar

  for (const comp of selected) {
    if (matchCount >= MAX_MATCHES) break;

    const matchesUrl = `${BASE}/matches/${comp.competition_id}/${comp.season_id}.json`;
    let matches: SBMatch[];
    try {
      matches = await fetchJSON(matchesUrl);
    } catch {
      console.log(`  Skip ${comp.competition_name} ${comp.season_name} (sem dados)`);
      continue;
    }

    console.log(`  ${comp.competition_name} ${comp.season_name}: ${matches.length} partidas`);

    for (const m of matches) {
      if (matchCount >= MAX_MATCHES) break;

      const eventsFile = join(RAW_DIR, 'events', `${m.match_id}.json`);
      if (existsSync(eventsFile)) {
        matchCount++;
        continue; // Já baixado
      }

      try {
        const events = await fetchJSON(`${BASE}/events/${m.match_id}.json`);
        writeFileSync(eventsFile, JSON.stringify(events));
        matchCount++;
        if (matchCount % 20 === 0) console.log(`    ${matchCount} partidas baixadas...`);
        // Rate limiting gentil
        await new Promise(r => setTimeout(r, 100));
      } catch {
        // Algumas partidas não têm eventos
      }
    }
  }

  // Salvar index das partidas
  const allMatches: Array<{ id: number; comp: string; season: string; home: string; away: string; score: string }> = [];
  for (const comp of selected) {
    try {
      const matches: SBMatch[] = await fetchJSON(`${BASE}/matches/${comp.competition_id}/${comp.season_id}.json`);
      for (const m of matches) {
        if (existsSync(join(RAW_DIR, 'events', `${m.match_id}.json`))) {
          allMatches.push({
            id: m.match_id,
            comp: comp.competition_name,
            season: comp.season_name,
            home: m.home_team.home_team_name,
            away: m.away_team.away_team_name,
            score: `${m.home_score}-${m.away_score}`,
          });
        }
      }
    } catch { /* skip */ }
  }

  writeFileSync(join(RAW_DIR, 'match_index.json'), JSON.stringify(allMatches, null, 2));
  console.log(`\nDone: ${matchCount} partidas com eventos em ${RAW_DIR}/events/`);
  console.log(`Index: ${allMatches.length} partidas em match_index.json`);
}

main().catch(e => { console.error(e); process.exit(1); });

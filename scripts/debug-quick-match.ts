/**
 * Debug: roda 1 partida Quick determinística e conta onde os chutes morrem.
 *
 * USO: npx tsx scripts/debug-quick-match.ts
 */

// Stub import.meta.env antes de importar nada do src (evita adminPanelAuth.ts crash)
(globalThis as { import?: { meta?: { env?: Record<string, string> } } }).import = { meta: { env: {} } };
import { runMatchMinute, type RunMinuteInput } from '../src/engine/runMatchMinute';
import type { LiveMatchSnapshot } from '../src/engine/types';
import type { PlayerEntity } from '../src/entities/types';
import { pitchPlayersFromLineup } from '../src/engine/pitchFromLineup';

// Shell mínimo (evita importar de game/initialState que puxa adminPanelAuth)
function makeShell(): LiveMatchSnapshot {
  return {
    minute: 0,
    homeScore: 0,
    awayScore: 0,
    possession: 'home',
    ball: { x: 50, y: 50 },
    events: [],
    phase: 'playing',
    mode: 'quick',
    homeFormationScheme: '4-3-3',
    homePlayers: [],
    homeStats: {},
    homePlayerSlot: {},
    awayPlayers: [],
    impactEvents: [],
    matchLineupBySlot: {},
    homeImpactLedger: [],
    awayImpactLedger: [],
    substitutionsUsed: 0,
    travelKm: 0,
    homeName: 'TIG',
    awayName: 'ALV',
    homeShort: 'TIG',
    awayShort: 'ALV',
  } as unknown as LiveMatchSnapshot;
}

function makePlayer(id: string, num: number, pos: string, ovr: number): PlayerEntity {
  const zoneFromPos = (p: string) =>
    p === 'GOL' ? 'gol'
    : p === 'ZAG' ? 'defesa'
    : p === 'LE' ? 'lateral_esq'
    : p === 'LD' ? 'lateral_dir'
    : p === 'PE' || p === 'PD' || p === 'ATA' ? 'ataque'
    : 'meio';
  return {
    id, num, name: `${pos}-${num}`, pos,
    archetype: 'profissional',
    zone: zoneFromPos(pos) as PlayerEntity['zone'],
    behavior: 'equilibrado',
    attrs: {
      passe: ovr, marcacao: ovr, velocidade: ovr, drible: ovr, finalizacao: ovr,
      fisico: ovr, tatico: ovr, mentalidade: ovr, confianca: ovr, fairPlay: ovr,
    },
    fatigue: 0, injuryRisk: 0, evolutionXp: 0, outForMatches: 0,
  };
}

function makeSquad(prefix: string, baseOvr: number): PlayerEntity[] {
  const positions = ['GOL', 'ZAG', 'ZAG', 'LE', 'LD', 'VOL', 'MC', 'MEI', 'PE', 'PD', 'ATA'];
  return positions.map((pos, i) => makePlayer(`${prefix}-${i + 1}`, i + 1, pos, baseOvr + (i % 5) - 2));
}

function makeLineup(squad: PlayerEntity[]) {
  const slots = ['gol', 'zag1', 'zag2', 'le', 'ld', 'vol', 'mc1', 'mc2', 'pe', 'pd', 'ata'];
  const out: Record<string, string> = {};
  slots.forEach((slot, i) => { out[slot] = squad[i].id; });
  return out;
}

async function runMatch() {
  const homeSquad = makeSquad('home', 75);
  const awaySquad = makeSquad('away', 75);
  const lineup = makeLineup(homeSquad);
  const homePlayers = pitchPlayersFromLineup(lineup, Object.fromEntries(homeSquad.map(p => [p.id, p])), '4-3-3');

  let snapshot: LiveMatchSnapshot = { ...makeShell(), homePlayers };

  const input: RunMinuteInput = {
    snapshot,
    homeRoster: homeSquad,
    awayRoster: awaySquad.map(p => ({ id: p.id, num: p.num, name: p.name, pos: p.pos })),
    homeShort: 'TIG',
    awayShort: 'ALV',
    awayName: 'Alvorada',
    crowdSupport: 80,
    opponentStrength: 75,
    tacticalMentality: 50,
    tacticalStyle: { id: 'balanced', label: 'Equilibrado', possession: 0.5, buildUp: 0.5, verticality: 0.5, shootingProfile: 0.5, riskTaking: 0.5 } as never,
    formationScheme: '4-3-3',
  };

  let ticksInAtt = 0;
  let shotTextsCount = 0;
  let maxBallX = 0;
  let lastTrack = '';
  for (let i = 0; i < 90; i++) {
    const out = runMatchMinute({ ...input, snapshot });
    snapshot = out.snapshot;
    if (snapshot.ball.x > maxBallX) maxBallX = snapshot.ball.x;
    if (snapshot.ball.x >= 67) ticksInAtt++;
    if (i < 30) lastTrack += `${i}:${snapshot.ball.x.toFixed(0)}(${snapshot.possession[0]}) `;
  }
  console.log(`  track[0-29]: ${lastTrack}`);
  console.log(`  maxBallX: ${maxBallX.toFixed(1)}`);
  for (const e of (snapshot.events ?? [])) {
    if (e.kind === 'narrative') {
      const text = (e as { text?: string }).text ?? '';
      if (/chut|remat|finaliz|defes|trav|fora|cima|barr/i.test(text)) shotTextsCount++;
    }
  }
  return {
    goals: snapshot.homeScore + snapshot.awayScore,
    shots_in_att_zone: shotTextsCount,
    ticks_in_att: ticksInAtt,
    events_total: snapshot.events?.length ?? 0,
  };
}

async function main() {
  // Habilita contador de ações (lê do globalThis.__actionStats)
  (globalThis as { __actionStats?: Record<string, number> }).__actionStats = {};

  const runs = 5;
  const totals = { goals: 0, shots: 0, ticksAtt: 0, events: 0 };
  for (let i = 0; i < runs; i++) {
    const r = await runMatch();
    console.log(`Run ${i + 1}: goals=${r.goals} shots(narr)=${r.shots_in_att_zone} ticksInAtt=${r.ticks_in_att}/90 events=${r.events_total}`);
    totals.goals += r.goals;
    totals.shots += r.shots_in_att_zone;
    totals.ticksAtt += r.ticks_in_att;
    totals.events += r.events_total;
  }
  console.log(`\nMÉDIA (${runs} partidas):`);
  console.log(`  goals: ${(totals.goals / runs).toFixed(1)}`);
  console.log(`  shots (narrative com palavra-chave): ${(totals.shots / runs).toFixed(1)}`);
  console.log(`  ticks em zona att: ${(totals.ticksAtt / runs).toFixed(1)}/90`);
  console.log(`  events totais: ${(totals.events / runs).toFixed(1)}`);

  const stats = (globalThis as { __actionStats?: Record<string, number> }).__actionStats!;
  console.log('\nAÇÕES por (possession-zone-action) — total acumulado:');
  const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  for (const [k, v] of sorted) console.log(`  ${k}: ${v}`);
}

main().catch(e => { console.error(e); process.exit(1); });

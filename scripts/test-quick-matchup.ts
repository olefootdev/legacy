/**
 * Self-test da Fase A do Quick Match 2.0 — Matchup Matrix + Analyst Beats + Replan.
 *
 * Espelha o que o backend faz: spawna python3 smartfield/match_simulator.py
 * via stdin e valida o MatchPlan v1.1.
 *
 * Cobre:
 *   1. Shape: matchup_matrix (7 canais × 2 lados), analyst_beats (4 no full)
 *   2. Gating: todo gol carrega channel + reason; time sem canal positivo
 *      e sem confiança de brilho NÃO marca
 *   3. Determinismo: mesmo input → mesmo plano (byte a byte)
 *   4. Replan: mode=second_half começa no 46', herda placar, beats só do 2º tempo
 *   5. Peso das decisões: ledger bom gera mais gols que ledger ruim (mesmos seeds)
 *
 * Uso: npm run test:quick-matchup
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

const SCRIPT_DIR = path.resolve(process.cwd(), 'smartfield');
const ATTACK_CHANNELS = ['ataque_central', 'corredor_esquerdo', 'corredor_direito', 'criacao', 'bola_parada'];
const ALL_CHANNELS = [...ATTACK_CHANNELS, 'finalizacao_vs_gk', 'pressao'];

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function runSim(input: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', ['match_simulator.py'], { cwd: SCRIPT_DIR, timeout: 10_000 });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => { stdout += c.toString(); });
    proc.stderr.on('data', (c) => { stderr += c.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        try { resolve(JSON.parse(stdout)); } catch (e) { reject(new Error(`json inválido: ${e}`)); }
      } else {
        reject(new Error(`python exited ${code}: ${stderr.slice(0, 300)}`));
      }
    });
    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();
  });
}

const POSITIONS: Array<{ pos: string; role: 'gk' | 'def' | 'mid' | 'attack' }> = [
  { pos: 'GOL', role: 'gk' },
  { pos: 'ZAG', role: 'def' },
  { pos: 'ZAG', role: 'def' },
  { pos: 'LD', role: 'def' },
  { pos: 'LE', role: 'def' },
  { pos: 'VOL', role: 'mid' },
  { pos: 'MC', role: 'mid' },
  { pos: 'MEI', role: 'mid' },
  { pos: 'PD', role: 'attack' },
  { pos: 'PE', role: 'attack' },
  { pos: 'ATA', role: 'attack' },
];

function buildLineup(prefix: string, level: number, confianca = level) {
  return POSITIONS.map((slot, i) => ({
    id: `${prefix}-${i}`,
    name: `${prefix}${i}`,
    pos: slot.pos,
    role: slot.role,
    finalizacao: level,
    passe: level,
    marcacao: level,
    velocidade: level,
    fisico: level,
    confianca,
    fatigue: 10,
  }));
}

function baseInput(seed: string, homeLevel = 78, awayLevel = 70) {
  return {
    seed,
    home_short: 'FLA',
    away_short: 'PAL',
    home_team: { strength: homeLevel, intensity: 'balanced', lineup: buildLineup('h', homeLevel) },
    away_team: { strength: awayLevel, lineup: buildLineup('a', awayLevel) },
  };
}

async function main() {
  console.log('— Fase A: Matchup Matrix + Analyst Beats + Replan —\n');

  // 1. Shape do plano v1.1
  console.log('[1] Shape v1.1');
  const plan = await runSim(baseInput('fase-a-shape'));
  check('version 1.1', plan.version === '1.1');
  check('mode full', plan.mode === 'full');
  for (const side of ['home', 'away']) {
    const m = plan.matchup_matrix?.[side];
    check(`matrix.${side} com 7 canais`, !!m && ALL_CHANNELS.every((ch) => ch in m));
    check(
      `matrix.${side} edges em [-1,1]`,
      !!m && ALL_CHANNELS.every((ch) => m[ch].edge >= -1 && m[ch].edge <= 1 && typeof m[ch].label === 'string'),
    );
  }
  check('4 analyst beats', plan.analyst_beats?.length === 4,
    `got ${plan.analyst_beats?.length}`);
  check('beats nos minutos 18/35/58/78',
    JSON.stringify(plan.analyst_beats?.map((b: any) => b.minute)) === JSON.stringify([18, 35, 58, 78]));
  for (const beat of plan.analyst_beats ?? []) {
    const weights = beat.choices.map((c: any) => c.weight);
    check(`${beat.id}: 3 escolhas, insight, janela`,
      beat.choices.length === 3 && typeof beat.insight?.text === 'string' && beat.window_ms > 0);
    check(`${beat.id}: tem opção boa e armadilha`,
      weights.some((w: number) => w > 0) && weights.some((w: number) => w < 0),
      `weights=${JSON.stringify(weights)}`);
  }
  check('momentum_curve com 90 valores', plan.momentum_curve.length === 90);

  // 2. Gating de gol por canal
  console.log('\n[2] Gating de gol');
  const shots = plan.events.filter((e: any) => e.kind.startsWith('goal_') || e.kind.startsWith('shot_'));
  check('todo chute/gol tem channel + reason',
    shots.length > 0 && shots.every((e: any) => ATTACK_CHANNELS.includes(e.channel) && typeof e.reason === 'string'));

  // Home fraco (todos os canais negativos) + confiança baixa (sem brilho) → 0 gols home
  let weakGoals = 0;
  for (let i = 0; i < 12; i += 1) {
    const input = baseInput(`gating-${i}`, 50, 88);
    input.home_team.lineup = buildLineup('h', 48, 50); // confiança 50 < 80: sem brilho
    input.home_team.strength = 50;
    const p = await runSim(input);
    weakGoals += p.home_score;
  }
  check('time sem canal positivo nem brilho não marca (12 seeds)', weakGoals === 0, `gols=${weakGoals}`);

  // 3. Determinismo
  console.log('\n[3] Determinismo');
  const a = await runSim(baseInput('determinism'));
  const b = await runSim(baseInput('determinism'));
  const strip = (p: any) => { const { generated_at_ms, duration_ms, ...rest } = p; return JSON.stringify(rest); };
  check('mesmo seed → plano idêntico', strip(a) === strip(b));

  // 4. Replan de 2º tempo
  console.log('\n[4] Replan second_half');
  const h2 = await runSim({
    ...baseInput('replan'),
    mode: 'second_half',
    first_half: { home_score: 1, away_score: 0, momentum_end: 62, cards_home: 1, cards_away: 2 },
    decisions: [
      { beat_id: 'beat-18', choice_id: 'beat-18-exploit', channel: 'corredor_esquerdo', target_side: 'home', weight: 0.18 },
    ],
  });
  check('mode second_half', h2.mode === 'second_half');
  check('start_minute 46', h2.start_minute === 46);
  check('momentum_curve com 45 valores', h2.momentum_curve.length === 45, `got ${h2.momentum_curve.length}`);
  check('herda placar do 1º tempo', h2.home_score >= 1);
  check('eventos só do 2º tempo', h2.events.every((e: any) => e.minute >= 46));
  check('beats só nos minutos 58/78',
    JSON.stringify(h2.analyst_beats?.map((b: any) => b.minute)) === JSON.stringify([58, 78]));

  // 5. Decisões pesam de verdade: ledger bom vs ruim nos mesmos seeds
  console.log('\n[5] Peso das decisões');
  const goodLedger = [
    { channel: 'ataque_central', target_side: 'home', weight: 0.2 },
    { channel: 'criacao', target_side: 'home', weight: 0.2 },
    { channel: 'corredor_esquerdo', target_side: 'home', weight: 0.2 },
  ];
  const badLedger = [
    { channel: 'ataque_central', target_side: 'home', weight: -0.2 },
    { channel: 'criacao', target_side: 'home', weight: -0.2 },
    { channel: 'corredor_esquerdo', target_side: 'home', weight: -0.2 },
  ];
  let goodGoals = 0;
  let badGoals = 0;
  let goodDiff = 0;
  let badDiff = 0;
  for (let i = 0; i < 30; i += 1) {
    const fh = { home_score: 0, away_score: 0, momentum_end: 50 };
    const base = { ...baseInput(`weights-${i}`, 74, 74), mode: 'second_half', first_half: fh };
    const good = await runSim({ ...base, decisions: goodLedger });
    const bad = await runSim({ ...base, decisions: badLedger });
    goodGoals += good.home_score;
    badGoals += bad.home_score;
    goodDiff += good.home_score - good.away_score;
    badDiff += bad.home_score - bad.away_score;
  }
  check(`ledger bom gera mais gols (${goodGoals} vs ${badGoals}, 30 seeds)`, goodGoals > badGoals);
  check(`ledger ruim conta CONTRA o saldo (saldo bom ${goodDiff} vs ruim ${badDiff})`, goodDiff > badDiff);

  console.log(failures === 0 ? '\n✅ Fase A OK — todos os checks passaram' : `\n❌ ${failures} check(s) falharam`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Erro fatal:', e);
  process.exit(1);
});

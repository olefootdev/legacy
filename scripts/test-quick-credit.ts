/**
 * Self-test do crédito de progressão (creditQuickPlan) — Fase D.
 *
 * Valida, fora do reducer (puro), que o resultado da Partida Rápida 2.0 credita
 * a progressão correta: economia, evolução, fadiga/recovery e Manager IQ.
 *
 * Uso: npm run test:quick-credit
 */

import { computeQuickPlanCredit, readingMultiplier, type QuickPlanCreditState, type QuickPlanCreditInput } from '../src/match/quickEngaged/creditQuickPlan';
import type { PlayerEntity } from '../src/entities/types';

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) console.log(`  ✓ ${label}`);
  else { failures += 1; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}

function mkPlayer(id: string, ovr: number, fatigue: number): PlayerEntity {
  const a = ovr;
  return {
    id, name: id.toUpperCase(), pos: 'ATA', num: 9,
    attrs: { passe: a, marcacao: a, velocidade: a, drible: a, finalizacao: a, fisico: a, tatico: a, mentalidade: a, confianca: a, fairPlay: a },
    fatigue, injuryRisk: 10, outForMatches: 0, evolutionXp: 0,
  } as unknown as PlayerEntity;
}

function baseState(): QuickPlanCreditState {
  return {
    finance: { ole: 1000, broCents: 0, expLifetimeEarned: 5000, expHistory: [] } as never,
    players: { p1: mkPlayer('p1', 80, 60), p2: mkPlayer('p2', 70, 40), bench1: mkPlayer('bench1', 65, 50) },
    playerHealth: {},
    quickMatchStreak: { current: 0, best: 0, lastMatchWon: false, multiplier: 1 },
  };
}

const winInput: QuickPlanCreditInput = {
  homeScore: 2, awayScore: 0,
  reading: { good: 4, total: 4 },
  homeStats: {
    p1: { passesOk: 20, passesAttempt: 24, tackles: 1, km: 9, rating: 8.4, shotsOn: 3 },
    p2: { passesOk: 30, passesAttempt: 34, tackles: 4, km: 10, rating: 7.1, shotsOn: 1 },
  },
  homeOnPitch: ['p1', 'p2'],
  agg: { shots: 6, possessionHome: 62, wasLosing: false },
};

function main() {
  console.log('— Crédito de progressão (Fase D) —\n');

  console.log('[1] Multiplicador Manager IQ');
  check('leitura 4/4 → > 1x', readingMultiplier({ good: 4, total: 4 }) > 1.1);
  check('leitura 0/4 → < 1x', readingMultiplier({ good: 0, total: 4 }) < 0.9);
  check('sem leitura → 1x', readingMultiplier({ good: 0, total: 0 }) === 1);

  console.log('\n[2] Economia');
  const r = computeQuickPlanCredit(baseState(), winInput);
  check('OLE creditado (saldo subiu)', r.finance.ole > 1000, `ole=${r.finance.ole}`);
  check('expLifetime subiu', (r.finance.expLifetimeEarned ?? 0) > 5000);
  check('vitória + boa leitura rende mais que derrota + má leitura', (() => {
    const win = computeQuickPlanCredit(baseState(), winInput).oleGain;
    const loss = computeQuickPlanCredit(baseState(), { ...winInput, homeScore: 0, awayScore: 2, reading: { good: 0, total: 4 }, agg: { ...winInput.agg, wasLosing: true } }).oleGain;
    return win > loss;
  })());
  check('clean sheet (0 sofrido) entra como bônus', r.bonusNames.length > 0, JSON.stringify(r.bonusNames));

  console.log('\n[3] Evolução de jogador');
  check('titular ganhou evolutionXp', (r.players.p1.evolutionXp ?? 0) > 0, `xp=${r.players.p1.evolutionXp}`);
  check('boa leitura dá XP extra vs leitura ruim', (() => {
    const good = computeQuickPlanCredit(baseState(), winInput).players.p1.evolutionXp ?? 0;
    const bad = computeQuickPlanCredit(baseState(), { ...winInput, reading: { good: 0, total: 4 } }).players.p1.evolutionXp ?? 0;
    return good > bad;
  })());

  console.log('\n[4] Fadiga: titular cansa, banco descansa');
  check('titular CANSA ao jogar (60→80)', r.players.p1.fatigue === 80, `fad=${r.players.p1.fatigue}`);
  check('banco DESCANSA (50→32)', r.players.bench1.fatigue === 32, `fad=${r.players.bench1.fatigue}`);
  check('playerHealth sincronizado', r.playerHealth.p1?.fatigue === 80);

  console.log('\n[5] Streak');
  check('vitória incrementa streak', r.quickMatchStreak.current === 1);

  console.log(failures === 0 ? '\n✅ Crédito OK — todos os checks passaram' : `\n❌ ${failures} check(s) falharam`);
  process.exit(failures === 0 ? 0 : 1);
}

main();

/**
 * Self-test: CLUB PULSE + MODO DA HOME (Fase 1).
 *
 * Prova que:
 *  - o Pulse é determinístico e fica em 0–100 em qualquer entrada;
 *  - clube recém-criado nasce neutro (≈50), não em crise;
 *  - cada componente move o número na direção certa;
 *  - consequências negativas derrubam, e o piso de punição é respeitado;
 *  - a Home escolhe o modo pela precedência documentada.
 *
 * Uso: npm run test:club-pulse
 */
import {
  computeClubPulse,
  formScore,
  squadMoralScore,
  consequenceAdjustment,
  pulseTrend,
  pulseColorToken,
  shouldShowTrend,
  type ClubPulseInput,
} from '../src/systems/clubPulse';
import { resolveHomeMode, blockOrderFor, MATCHDAY_WINDOW_MS, type HomeMode } from '../src/pages/homeMode';
import type { FormLetter } from '../src/entities/types';

let fail = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(ok ? `  ✅ ${label}` : `  ❌ ${label} ${detail}`);
  if (!ok) fail++;
};

const NEUTRAL: ClubPulseInput = {
  crowdSupportPercent: 50,
  form: [],
  squadMoral: [],
  engagementScore: 50,
  consequences: [],
  managerScoreToday: 0,
};
const withInput = (over: Partial<ClubPulseInput>): ClubPulseInput => ({ ...NEUTRAL, ...over });

console.log('\n🫀 CLUB PULSE\n');

// ── 1) Neutro / limites ───────────────────────────────────────────────────
{
  const neutral = computeClubPulse(NEUTRAL);
  check('clube novo nasce neutro (48–52)', neutral.value >= 48 && neutral.value <= 52, `v=${neutral.value}`);
  check('clube novo não inventa driver', neutral.drivers.length === 0, `${neutral.drivers.length} drivers`);
  check('clube novo é "Estável"', neutral.band === 'steady', neutral.band);

  const best = computeClubPulse(withInput({
    crowdSupportPercent: 100, form: ['W', 'W', 'W', 'W', 'W'],
    squadMoral: [100, 100], engagementScore: 100, managerScoreToday: 999,
  }));
  check('teto respeitado (<=100)', best.value <= 100, `v=${best.value}`);
  check('tudo no máximo vira "fire"', best.band === 'fire', best.band);

  const worst = computeClubPulse(withInput({
    crowdSupportPercent: 0, form: ['L', 'L', 'L', 'L', 'L'],
    squadMoral: [0, 0], engagementScore: 0,
    consequences: Array.from({ length: 10 }, () => ({ dimension: 'physical' as const, currentValue: -50 })),
  }));
  check('piso respeitado (>=0)', worst.value >= 0, `v=${worst.value}`);
  check('tudo no mínimo vira "crisis"', worst.band === 'crisis', worst.band);
}

// ── 2) Determinismo ───────────────────────────────────────────────────────
{
  const input = withInput({ crowdSupportPercent: 71, form: ['W', 'L', 'W'], squadMoral: [62, 48], engagementScore: 66 });
  const a = computeClubPulse(input);
  const b = computeClubPulse(input);
  check('mesma entrada → mesmo número', a.value === b.value, `${a.value} vs ${b.value}`);
  check('mesma entrada → mesmos drivers', JSON.stringify(a.drivers) === JSON.stringify(b.drivers));
}

// ── 3) Cada componente empurra pro lado certo ─────────────────────────────
{
  const base = computeClubPulse(NEUTRAL).value;
  check('torcida cantando sobe', computeClubPulse(withInput({ crowdSupportPercent: 95 })).value > base);
  check('torcida hostil desce', computeClubPulse(withInput({ crowdSupportPercent: 5 })).value < base);
  check('5 vitórias sobem', computeClubPulse(withInput({ form: ['W', 'W', 'W', 'W', 'W'] })).value > base);
  check('5 derrotas descem', computeClubPulse(withInput({ form: ['L', 'L', 'L', 'L', 'L'] })).value < base);
  check('plantel empolgado sobe', computeClubPulse(withInput({ squadMoral: [90, 88, 92] })).value > base);
  check('plantel abatido desce', computeClubPulse(withInput({ squadMoral: [10, 12, 8] })).value < base);
  check('comando ativo sobe', computeClubPulse(withInput({ engagementScore: 100 })).value > base);
  check('atividade de hoje soma pouco (<=4)',
    computeClubPulse(withInput({ managerScoreToday: 500 })).value - base <= 4);
}

// ── 4) Forma: recência pesa mais ──────────────────────────────────────────
{
  const subindo: FormLetter[] = ['L', 'L', 'L', 'W', 'W'];
  const caindo: FormLetter[] = ['W', 'W', 'L', 'L', 'L'];
  check('mesmos resultados, ordem diferente → nota diferente', formScore(subindo) !== formScore(caindo));
  check('vitórias recentes valem mais', formScore(subindo) > formScore(caindo),
    `sub=${formScore(subindo).toFixed(1)} cai=${formScore(caindo).toFixed(1)}`);
  check('sem histórico = 50 (neutro)', formScore([]) === 50);
  check('plantel vazio = 50 (neutro)', squadMoralScore([]) === 50);
}

// ── 5) Consequências: punição pesa mais que bônus ─────────────────────────
{
  const bad = consequenceAdjustment([{ dimension: 'physical', currentValue: -40 }]);
  const good = consequenceAdjustment([{ dimension: 'physical', currentValue: 40 }]);
  check('consequência ruim é negativa', bad < 0, `${bad}`);
  check('consequência boa é positiva', good > 0, `${good}`);
  check('punição tem mais alcance que bônus', Math.abs(bad) > good, `bad=${bad} good=${good}`);
  check('lista vazia não mexe', consequenceAdjustment([]) === 0);
  check('valor não-finito é ignorado',
    consequenceAdjustment([{ dimension: 'physical', currentValue: NaN }]) === 0);
  check('física pesa mais que financeira',
    Math.abs(consequenceAdjustment([{ dimension: 'physical', currentValue: -10 }])) >
    Math.abs(consequenceAdjustment([{ dimension: 'financial', currentValue: -10 }])));
}

// ── 6) Tendência ──────────────────────────────────────────────────────────
{
  check('virou o jogo → subindo', pulseTrend(['L', 'L', 'L', 'W', 'W'], 0) === 'up');
  check('despencou → caindo', pulseTrend(['W', 'W', 'W', 'L', 'L'], 0) === 'down');
  check('constante → estável', pulseTrend(['D', 'D', 'D', 'D', 'D'], 0) === 'flat');
  check('sem histórico + jogou hoje → subindo', pulseTrend([], 30) === 'up');
  check('sem histórico + parado → estável', pulseTrend([], 0) === 'flat');
}

// ── 6b) A seta não pode contradizer a banda ───────────────────────────────
{
  // O caso que a prancheta pegou: clube perdeu tudo, empatou o último jogo,
  // e a tendência dava 'up' ao lado de "Em crise".
  const crise = computeClubPulse(withInput({
    crowdSupportPercent: 22, form: ['L', 'L', 'L', 'D', 'L'],
    squadMoral: [28, 31, 25], engagementScore: 20,
    consequences: [{ dimension: 'physical', currentValue: -30 }, { dimension: 'psychological', currentValue: -12 }],
  }));
  check('o caso real ainda calcula tendência de alta', crise.trend === 'up', crise.trend);
  check('mas a crise NÃO mostra seta', shouldShowTrend(crise) === false, `band=${crise.band}`);

  const embalado = computeClubPulse(withInput({
    crowdSupportPercent: 78, form: ['W', 'W', 'D', 'W', 'W'],
    squadMoral: [72, 68, 75, 70], engagementScore: 80, managerScoreToday: 35,
  }));
  check('clube embalado mostra seta', shouldShowTrend(embalado) === true);
  check('tendência estável não vira seta',
    shouldShowTrend({ band: 'steady', trend: 'flat' }) === false);
  check('queda fora da crise mostra seta',
    shouldShowTrend({ band: 'low', trend: 'down' }) === true);
  check('nem alta salva a crise',
    shouldShowTrend({ band: 'crisis', trend: 'up' }) === false &&
    shouldShowTrend({ band: 'crisis', trend: 'down' }) === false);
}

// ── 7) Cor por band ───────────────────────────────────────────────────────
{
  const bands = ['fire', 'high', 'steady', 'low', 'crisis'] as const;
  const tokens = bands.map(pulseColorToken);
  check('toda band tem cor', tokens.every((t) => t.startsWith('var(--')));
  check('cores são distintas', new Set(tokens).size === bands.length);
}

console.log('\n🏠 MODO DA HOME\n');

const NOW = 1_700_000_000_000;
const baseMode = {
  nextKickoffMs: null as number | null,
  incomingOffersCount: 0,
  suspendedCount: 0,
  expiredCount: 0,
  injuredCount: 0,
  hasResultFlash: false,
  nowMs: NOW,
};

// ── 8) Cada modo é alcançável ─────────────────────────────────────────────
{
  check('dia comum', resolveHomeMode(baseMode) === 'normal');
  check('dia de jogo (dentro da janela)',
    resolveHomeMode({ ...baseMode, nextKickoffMs: NOW + 30 * 60_000 }) === 'matchday');
  check('crise (3 pendências)',
    resolveHomeMode({ ...baseMode, suspendedCount: 1, expiredCount: 1, injuredCount: 1 }) === 'crisis');
  check('proposta na mesa',
    resolveHomeMode({ ...baseMode, incomingOffersCount: 2 }) === 'offer');
  check('festa', resolveHomeMode({ ...baseMode, hasResultFlash: true }) === 'celebration');
}

// ── 9) Precedência: festa > jogo > crise > proposta ───────────────────────
{
  const tudo = {
    ...baseMode,
    nextKickoffMs: NOW + 10 * 60_000,
    incomingOffersCount: 3,
    suspendedCount: 2, expiredCount: 2, injuredCount: 2,
    hasResultFlash: true,
  };
  check('festa ganha de todo mundo', resolveHomeMode(tudo) === 'celebration');
  check('jogo ganha de crise e proposta',
    resolveHomeMode({ ...tudo, hasResultFlash: false }) === 'matchday');
  check('crise ganha de proposta',
    resolveHomeMode({ ...tudo, hasResultFlash: false, nextKickoffMs: null }) === 'crisis');
  check('proposta sobra por último',
    resolveHomeMode({ ...tudo, hasResultFlash: false, nextKickoffMs: null, suspendedCount: 0, expiredCount: 0, injuredCount: 0 }) === 'offer');
}

// ── 10) Janela do dia de jogo ─────────────────────────────────────────────
{
  check('kickoff no limite ainda é matchday',
    resolveHomeMode({ ...baseMode, nextKickoffMs: NOW + MATCHDAY_WINDOW_MS }) === 'matchday');
  check('kickoff além da janela não é matchday',
    resolveHomeMode({ ...baseMode, nextKickoffMs: NOW + MATCHDAY_WINDOW_MS + 1 }) === 'normal');
  check('kickoff que já passou não segura o topo',
    resolveHomeMode({ ...baseMode, nextKickoffMs: NOW - 1 }) === 'normal');
  check('2 pendências ainda não é crise',
    resolveHomeMode({ ...baseMode, suspendedCount: 1, injuredCount: 1 }) === 'normal');
}

// ── 11) Nenhum bloco some por decisão de layout ───────────────────────────
{
  const modes: HomeMode[] = ['celebration', 'matchday', 'crisis', 'offer', 'normal'];
  const reference = [...blockOrderFor('normal')].sort();
  for (const m of modes) {
    const order = blockOrderFor(m);
    check(`[${m}] sem bloco duplicado`, new Set(order).size === order.length);
    check(`[${m}] carrega os mesmos blocos do normal`,
      JSON.stringify([...order].sort()) === JSON.stringify(reference));
  }
  check('[matchday] partida em 1º', blockOrderFor('matchday')[0] === 'nextMatch');
  check('[crisis] mesa do manager em 1º', blockOrderFor('crisis')[0] === 'managerDesk');
  check('[celebration] campeão em 1º', blockOrderFor('celebration')[0] === 'lastChampion');
  // Fase 4: num dia comum, o pedido do jogador é a única coisa que exige
  // decisão — então ele abre a Home. Nos outros modos ele nunca é o 1º:
  // quem manda no topo é o que tem hora marcada ou acabou de acontecer.
  check('[normal] o vestiário abre a Home', blockOrderFor('normal')[0] === 'playerRequest');
  check('[normal] a ordem editorial segue logo atrás', blockOrderFor('normal')[1] === 'slider');
  for (const mode of ['matchday', 'crisis', 'celebration', 'offer'] as HomeMode[]) {
    check(`[${mode}] pedido nunca rouba o 1º lugar`, blockOrderFor(mode)[0] !== 'playerRequest');
    check(`[${mode}] mas fica logo no 2º, pra ser respondido na sessão`,
      blockOrderFor(mode)[1] === 'playerRequest', blockOrderFor(mode).slice(0, 3).join(' → '));
  }
}

console.log(fail === 0 ? '\n✅ TUDO VERDE\n' : `\n❌ ${fail} FALHA(S)\n`);
process.exit(fail === 0 ? 0 : 1);

/**
 * Self-test: PUNIÇÃO POR AUSÊNCIA SUAVIZADA (Fase 1.5).
 *
 * A tabela antiga forçava 1–3 lesões automáticas: quem voltava depois de dois
 * dias encontrava o plantel quebrado e desistia de novo. A recalibração de
 * 2026-08-26 trocou lesão CERTA por RISCO elevado.
 *
 * Prova que:
 *  - nenhuma tier gera lesão automática;
 *  - a pressão migrou pro injuryRiskAdditive, e ele cresce com a ausência;
 *  - a torcida esfria bem menos e por menos tempo;
 *  - o que devia continuar doendo (treino, evolução, mercado) continua;
 *  - a aplicação segue idempotente ao reaplicar a mesma tier.
 *
 * Uso: npm run test:absence-penalty
 */
import {
  getAbsenceTier,
  getAbsenceEffect,
  evaluateAbsence,
} from '../src/systems/engagement/absencePenalty';
import { buildAbsenceSideEffects, shouldApplyAbsenceEffects } from '../src/systems/engagement/absenceEffects';
import type { AbsenceTier, ManagerPresence } from '../src/systems/engagement/types';

let fail = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(ok ? `  ✅ ${label}` : `  ❌ ${label} ${detail}`);
  if (!ok) fail++;
};

const TIERS: AbsenceTier[] = ['normal', 'warning_12h', 'mild_24h', 'moderate_36h', 'heavy_48h', 'crisis_72h'];
const NOW = 1_700_000_000_000;
const MS_PER_HOUR = 3_600_000;

console.log('\n🛌 AUSÊNCIA — RECALIBRAÇÃO\n');

// ── 1) Lesão automática desligada em TODA a tabela ────────────────────────
{
  for (const t of TIERS) {
    const e = getAbsenceEffect(t);
    check(`[${t}] não gera lesão automática`, e.randomInjuryCount === 0, `count=${e.randomInjuryCount}`);
  }
}

// ── 2) A pressão migrou pro risco, e ele escala ───────────────────────────
{
  const risks = TIERS.map((t) => getAbsenceEffect(t).injuryRiskAdditive);
  check('risco nunca decresce ao longo das tiers',
    risks.every((r, i) => i === 0 || r >= risks[i - 1]!), risks.join(' → '));
  check('crise carrega o maior risco', risks[risks.length - 1] === Math.max(...risks), risks.join(','));
  check('crise pressiona mais que a tabela antiga (35)',
    getAbsenceEffect('crisis_72h').injuryRiskAdditive >= 35);
  check('normal não pressiona', getAbsenceEffect('normal').injuryRiskAdditive === 0);
}

// ── 3) Torcida esfria bem menos ───────────────────────────────────────────
{
  const crisis = getAbsenceEffect('crisis_72h').crowdSupportDelta;
  check('crise não derruba 20% da torcida (limite antigo)', crisis > -20, `${crisis}`);
  check('crise ainda incomoda a torcida', crisis < 0, `${crisis}`);
  check('tiers leves não mexem na torcida',
    getAbsenceEffect('warning_12h').crowdSupportDelta === 0 &&
    getAbsenceEffect('mild_24h').crowdSupportDelta === 0);
}

// ── 4) O que DEVIA continuar doendo continua ──────────────────────────────
{
  check('24h+ para o treino', getAbsenceEffect('mild_24h').trainingMultiplier === 0);
  check('12h+ trava evolução de atributos', getAbsenceEffect('warning_12h').attrEvolutionEnabled === false);
  check('36h+ para o mercado', getAbsenceEffect('moderate_36h').marketActivityEnabled === false);
  check('36h+ trava regeneração de fadiga', getAbsenceEffect('moderate_36h').fatigueRegenEnabled === false);
  check('crise ainda ameaça as estrelas', getAbsenceEffect('crisis_72h').starPlayerDepartureRisk === true);
  check('normal é inofensivo',
    getAbsenceEffect('normal').trainingMultiplier === 1 &&
    getAbsenceEffect('normal').attrEvolutionEnabled === true);
}

// ── 5) Tier a partir das horas ────────────────────────────────────────────
{
  check('1h → normal', getAbsenceTier(1) === 'normal');
  check('13h → warning', getAbsenceTier(13) === 'warning_12h');
  check('40h → moderate', getAbsenceTier(40) === 'moderate_36h');
  check('100h → crise', getAbsenceTier(100) === 'crisis_72h');

  const presence: ManagerPresence = {
    managerId: 'm', lastLoginAt: NOW - 50 * MS_PER_HOUR, totalSessions: 3, bonusStreakSlots: 0,
  };
  const ev = evaluateAbsence(presence, NOW);
  check('evaluateAbsence casa tier com as horas', ev.tier === 'heavy_48h', `${ev.tier} @ ${ev.hours.toFixed(1)}h`);
}

// ── 6) Efeitos aplicados: zero lesão, torcida curta ───────────────────────
{
  const side = buildAbsenceSideEffects({
    managerId: 'm', clubId: 'c',
    eligiblePlayerIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
    tier: 'crisis_72h',
    effect: getAbsenceEffect('crisis_72h'),
    hoursAbsent: 80,
    now: NOW,
  });

  const injuries = side.consequences.filter((c) => c.kind.includes('injur'));
  check('volta sem NENHUMA lesão nova', injuries.length === 0, `${injuries.length} lesões`);

  const crowd = side.consequences.find((c) => c.kind === 'crowd_support_drop');
  check('torcida esfria (consequência criada)', !!crowd);
  if (crowd) {
    const hours = (crowd.expiresAt - crowd.startsAt) / MS_PER_HOUR;
    check('esfriamento dura 12h, não 24h', Math.round(hours) === 12, `${hours}h`);
    check('magnitude suave (> -10)', crowd.magnitude > -10, `${crowd.magnitude}`);
  }

  check('manager fica sabendo (inbox)', side.inboxItems.length > 0);
  check('resumo registra zero lesão', side.summary.includes('injuries=0'), side.summary);
}

// ── 7) Idempotência: mesma tier não reaplica ──────────────────────────────
{
  check('mesma tier não reaplica', shouldApplyAbsenceEffects('heavy_48h', 'heavy_48h') === false);
  check('escalada reaplica', shouldApplyAbsenceEffects('moderate_36h', 'heavy_48h') === true);
  check('regressão não reaplica', shouldApplyAbsenceEffects('crisis_72h', 'moderate_36h') === false);
  check('tiers leves nunca aplicam', shouldApplyAbsenceEffects(undefined, 'mild_24h') === false);
  check('primeira aplicação a partir de moderate', shouldApplyAbsenceEffects(undefined, 'moderate_36h') === true);
}

console.log(fail === 0 ? '\n✅ TUDO VERDE\n' : `\n❌ ${fail} FALHA(S)\n`);
process.exit(fail === 0 ? 0 : 1);

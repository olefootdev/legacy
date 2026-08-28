/**
 * Self-test: DETECTOR DE MOMENTO (Fase 2).
 *
 * O `quickRarity` da Partida Rápida virou o detector de TODO o jogo. O risco
 * dessa promoção é um só: mudar sem querer a conta que já estava em produção.
 *
 * Prova que:
 *  - a matemática da Partida Rápida ficou IDÊNTICA (competição é neutra);
 *  - o shim `computeQuickRarity` continua servindo os consumidores antigos;
 *  - fase, taça e pênaltis só pesam quando o resultado foi bom;
 *  - as faixas de tier e o `shareWorthy` seguem a régua original;
 *  - o tradutor de fase cobre os catálogos vivos das duas copas.
 *
 * Uso: npm run test:moments
 */
import { detectMoment, stageFromRoundName, momentTierLabel, momentCompetitionLabel, type MomentInput } from '../src/systems/moments';
import { computeQuickRarity } from '../src/match/quickRarity';

let fail = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(ok ? `  ✅ ${label}` : `  ❌ ${label} ${detail}`);
  if (!ok) fail++;
};

const BASE: MomentInput = {
  competition: 'quick',
  homeScore: 1, awayScore: 0,
  won: true, draw: false, wasLosing: false,
  possessionHome: 50, shotsHome: 8, bonusCount: 0,
  cleanSheet: false, hattrick: false, streak: 0,
};
const m = (over: Partial<MomentInput> = {}) => detectMoment({ ...BASE, ...over });

console.log('\n⚡ DETECTOR DE MOMENTO\n');

// ── 1) A conta da Partida Rápida não mudou ────────────────────────────────
{
  // Valores derivados da fórmula original, à mão:
  check('1–0 simples = 1 em 1 (comum)', m().oneInX === 1, `${m().oneInX}`);
  check('vitória por 2 = ×2', m({ homeScore: 2, awayScore: 0 }).oneInX === 2,
    `${m({ homeScore: 2, awayScore: 0 }).oneInX}`);
  check('goleada 3–0 sem clean sheet marcado = ×4', m({ homeScore: 3, awayScore: 0 }).oneInX === 4,
    `${m({ homeScore: 3, awayScore: 0 }).oneInX}`);
  check('virada = ×6', m({ wasLosing: true, homeScore: 2, awayScore: 1 }).oneInX === 6,
    `${m({ wasLosing: true, homeScore: 2, awayScore: 1 }).oneInX}`);
  check('hat-trick = ×10', m({ hattrick: true }).oneInX === 10);
  check('clean sheet = ×3', m({ cleanSheet: true }).oneInX === 3);
  check('sequência de 5 = ×5', m({ streak: 5 }).oneInX === 5);
  check('domínio (posse>65 e chutes>15) = ×2', m({ possessionHome: 70, shotsHome: 18 }).oneInX === 2);
}

// ── 2) Faixas de tier e shareWorthy ───────────────────────────────────────
{
  check('1 em 1 → comum', m().tier === 0);
  check('1 em 10 → raro', m({ hattrick: true }).tier === 1);
  check('épico a partir de 1 em 50',
    m({ hattrick: true, cleanSheet: true, homeScore: 3, awayScore: 0 }).tier >= 2);
  check('lendário a partir de 1 em 200',
    m({ hattrick: true, cleanSheet: true, homeScore: 5, awayScore: 0, streak: 7 }).tier === 3);
  check('comum não vale print', m().shareWorthy === false);
  check('raro já vale print', m({ hattrick: true }).shareWorthy === true);
  check('rótulos de tier em pt-BR',
    momentTierLabel(0) === 'Comum' && momentTierLabel(3) === 'Lendário');
}

// ── 3) Competição sozinha é NEUTRA (garante paridade com a Quick) ─────────
{
  const cases: Array<Partial<MomentInput>> = [
    {}, { hattrick: true }, { wasLosing: true, homeScore: 3, awayScore: 2 },
    { homeScore: 4, awayScore: 0, cleanSheet: true }, { won: false, draw: true, homeScore: 1, awayScore: 1 },
  ];
  let allEqual = true;
  for (const c of cases) {
    const quick = m(c);
    const ole = detectMoment({ ...BASE, ...c, competition: 'liga-ole' });
    if (quick.oneInX !== ole.oneInX || quick.tier !== ole.tier || quick.headline !== ole.headline) allEqual = false;
  }
  check('trocar a competição não muda a conta', allEqual);
  check('o shim computeQuickRarity devolve o mesmo',
    computeQuickRarity({ ...BASE, hattrick: true } as never).oneInX === m({ hattrick: true }).oneInX);
  check('o shim marca a competição como quick',
    computeQuickRarity(BASE as never).competition === 'quick');
}

// ── 4) Contexto: fase, taça, pênaltis ─────────────────────────────────────
{
  const semNada = m({ competition: 'liga-ole' }).oneInX;
  check('final multiplica (×5)', m({ competition: 'liga-ole', stage: 'final' }).oneInX === semNada * 5);
  check('semifinal multiplica menos que final',
    m({ competition: 'liga-ole', stage: 'semi' }).oneInX < m({ competition: 'liga-ole', stage: 'final' }).oneInX);
  check('grupo é neutro', m({ competition: 'liga-ole', stage: 'group' }).oneInX === semNada);
  check('taça multiplica (×12)', m({ competition: 'liga-ole', isTitle: true }).oneInX === semNada * 12);
  check('pênaltis multiplicam (×2)',
    m({ competition: 'liga-ole', isTitle: true, wentToPens: true }).oneInX ===
    m({ competition: 'liga-ole', isTitle: true }).oneInX * 2);
  // Lendário é raro ATÉ entre títulos: um 1–0 magro na decisão é épico. Só
  // vira lendário quando o título vem com goleada, virada ou pênaltis.
  check('título 1–0 na final é épico (não lendário)',
    m({ competition: 'global', stage: 'final', isTitle: true }).tier === 2,
    `oneInX=${m({ competition: 'global', stage: 'final', isTitle: true }).oneInX}`);
  check('título na final nos pênaltis é épico',
    m({ competition: 'global', stage: 'final', isTitle: true, wentToPens: true }).tier >= 2);
  check('título apertado nunca cai abaixo de épico (piso)',
    m({ competition: 'liga-ole', isTitle: true, homeScore: 1, awayScore: 0 }).tier >= 2);
  check('título goleado é lendário',
    m({ competition: 'liga-ole', stage: 'final', isTitle: true, homeScore: 3, awayScore: 0 }).tier === 3);
  check('título sempre vale print',
    m({ competition: 'liga-ole', isTitle: true }).shareWorthy === true);
}

// ── 5) Contexto NÃO premia derrota ────────────────────────────────────────
{
  const derrota: Partial<MomentInput> = { won: false, draw: false, homeScore: 0, awayScore: 2 };
  const semFase = m({ ...derrota, competition: 'legends-cup' }).oneInX;
  check('perder na final não vira feito raro',
    m({ ...derrota, competition: 'legends-cup', stage: 'final' }).oneInX === semFase,
    `${m({ ...derrota, competition: 'legends-cup', stage: 'final' }).oneInX} vs ${semFase}`);
  check('derrota não é compartilhável', m({ ...derrota, competition: 'legends-cup' }).shareWorthy === false);
}

// ── 6) Manchetes ──────────────────────────────────────────────────────────
{
  check('título manda na manchete', m({ isTitle: true, hattrick: true }).headline === 'É CAMPEÃO');
  check('hat-trick vem antes de virada', m({ hattrick: true, wasLosing: true }).headline === 'NOITE DE HAT-TRICK');
  check('virada tem manchete própria', m({ wasLosing: true, homeScore: 2, awayScore: 1 }).headline === 'VIRADA HISTÓRICA');
  check('empate tem manchete própria',
    m({ won: false, draw: true, homeScore: 1, awayScore: 1 }).headline === 'BATALHA');
  check('taça nos pênaltis aparece na tagline',
    m({ isTitle: true, wentToPens: true }).tagline.includes('pênaltis'));
  check('fase entra na tagline da vitória',
    m({ competition: 'liga-ole', stage: 'semi' }).tagline.includes('semifinal'));
  check('toda competição tem rótulo',
    (['quick', 'liga-ole', 'legends-cup', 'global'] as const).every((c) => momentCompetitionLabel(c).length > 3));
}

// ── 7) Tradutor de fase cobre os catálogos vivos ──────────────────────────
{
  // Liga Ole
  check('Fase de 32 → group', stageFromRoundName('Fase de 32') === 'group');
  check('Oitavas → round16', stageFromRoundName('Oitavas') === 'round16');
  check('Quartas → quarter', stageFromRoundName('Quartas') === 'quarter');
  check('Semifinal → semi', stageFromRoundName('Semifinal') === 'semi');
  check('Final → final', stageFromRoundName('Final') === 'final');
  // Legends Cup
  check('Fase de Grupos → group', stageFromRoundName('Fase de Grupos') === 'group');
  check('Playoff → group', stageFromRoundName('Playoff') === 'group');
  // Defesa
  check('rótulo desconhecido → undefined', stageFromRoundName('Repescagem Lunar') === undefined);
  check('vazio → undefined', stageFromRoundName('') === undefined && stageFromRoundName(null) === undefined);
  check('não confunde semifinal com final', stageFromRoundName('semifinal') === 'semi');
}

console.log(fail === 0 ? '\n✅ TUDO VERDE\n' : `\n❌ ${fail} FALHA(S)\n`);
process.exit(fail === 0 ? 0 : 1);

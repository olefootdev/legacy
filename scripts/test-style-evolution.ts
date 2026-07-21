/**
 * Self-test: EVOLUÇÃO CONFORME O ESTILO DO MANAGER.
 *
 * Prova que o plantel evolui na identidade tática do time:
 *  - treino sob PRESSÃO ALTA reforça físico/marcação;
 *  - treino sob POSSE CONTROLADA reforça passe/tático;
 *  - partida idêntica com estilos opostos evolui atributos diferentes.
 *
 * Uso: npm run test:style-evolution
 */
import {
  styleAttrWeights, topStyleAttr, applyStyleTrainingBias,
} from '../src/tactics/styleAttrWeights';
import { STYLE_PRESETS } from '../src/tactics/playingStyle';
import { applyMatchPerformanceEvolution } from '../src/entities/playerEvolution';
import type { PlayerEntity, PlayerAttributes } from '../src/entities/types';

let fail = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(ok ? `  ✅ ${label}` : `  ❌ ${label} ${detail}`);
  if (!ok) fail++;
};

const flatAttrs = (v: number): PlayerAttributes => ({
  passe: v, marcacao: v, velocidade: v, drible: v, finalizacao: v,
  fisico: v, tatico: v, mentalidade: v, confianca: v, fairPlay: v,
});
const mkPlayer = (v: number): PlayerEntity => ({
  id: 'p', name: 'P', pos: 'MC', num: 8, attrs: flatAttrs(v),
  fatigue: 20, injuryRisk: 5, outForMatches: 0, evolutionXp: 0,
  mintOverall: v, evolutionRate: 1,
} as unknown as PlayerEntity);

console.log('\n🎯 EVOLUÇÃO CONFORME O ESTILO\n');

// ── 1) Pesos de estilo apontam pros atributos certos ──
{
  const press = styleAttrWeights(STYLE_PRESETS.PRESSAO_ALTA);
  const poss = styleAttrWeights(STYLE_PRESETS.POSSE_CONTROLADA);
  const direct = styleAttrWeights(STYLE_PRESETS.JOGO_DIRETO);

  check('soma dos pesos = 1 (pressão)', Math.abs(Object.values(press).reduce((a, b) => a + b, 0) - 1) < 1e-6);
  // A DIVERGÊNCIA entre managers é o que importa (presets compartilham marcação):
  check('pressão desenvolve FÍSICO mais que posse', press.fisico > poss.fisico, `press=${press.fisico.toFixed(2)} poss=${poss.fisico.toFixed(2)}`);
  check('posse desenvolve TÁTICO mais que pressão', poss.tatico > press.tatico, `poss=${poss.tatico.toFixed(2)} press=${press.tatico.toFixed(2)}`);
  check('pressão: físico > tático (intensidade sobre controle)', press.fisico > press.tatico);
  check('posse: tático > físico (controle sobre intensidade)', poss.tatico > poss.fisico);
  check('jogo direto prioriza velocidade/finalização sobre tático',
    (direct.velocidade + direct.finalizacao) > (direct.tatico + direct.marcacao),
    `v+f=${(direct.velocidade+direct.finalizacao).toFixed(2)}`);
  check('topo da pressão ∈ {marcação, físico}', ['fisico', 'marcacao'].includes(topStyleAttr(press)), topStyleAttr(press));
  check('topo do jogo direto ∈ {velocidade, finalização}', ['velocidade', 'finalizacao'].includes(topStyleAttr(direct)), topStyleAttr(direct));
}

// ── 2) Treino: mesma base, estilos opostos → squads DIVERGEM ──
{
  const pressW = styleAttrWeights(STYLE_PRESETS.PRESSAO_ALTA);
  const possW = styleAttrWeights(STYLE_PRESETS.POSSE_CONTROLADA);
  const directW = styleAttrWeights(STYLE_PRESETS.JOGO_DIRETO);
  let aPress = flatAttrs(50), aPoss = flatAttrs(50), aDirect = flatAttrs(50);
  for (let i = 0; i < 12; i++) {
    aPress = applyStyleTrainingBias(aPress, pressW);
    aPoss = applyStyleTrainingBias(aPoss, possW);
    aDirect = applyStyleTrainingBias(aDirect, directW);
  }
  check('treino de pressão desenvolveu FÍSICO acima da posse', aPress.fisico > aPoss.fisico, `press=${aPress.fisico} poss=${aPoss.fisico}`);
  check('treino de posse desenvolveu TÁTICO acima da pressão', aPoss.tatico > aPress.tatico, `poss=${aPoss.tatico} press=${aPress.tatico}`);
  check('treino de jogo direto desenvolveu VELOCIDADE acima da posse', aDirect.velocidade > aPoss.velocidade, `direto=${aDirect.velocidade} poss=${aPoss.velocidade}`);
  check('cada treino subiu ao menos 2 atributos por sessão', aPress.marcacao > 50 && aPress.fisico > 50);
}

// ── 3) Partida: swing idêntico, estilos opostos → atributo diferente sobe ──
{
  const pressW = styleAttrWeights(STYLE_PRESETS.PRESSAO_ALTA);
  const possW = styleAttrWeights(STYLE_PRESETS.POSSE_CONTROLADA);
  // stat forte → swing positivo alto; jogador com atributos variados (não chapado)
  const base: PlayerEntity = {
    ...mkPlayer(60),
    attrs: { passe: 60, marcacao: 60, velocidade: 60, drible: 60, finalizacao: 60, fisico: 60, tatico: 60, mentalidade: 60, confianca: 60, fairPlay: 60 },
  } as PlayerEntity;
  const stat = { passesOk: 30, passesAttempt: 34, tackles: 6, km: 11, rating: 8.4 };

  // acumula 8 partidas idênticas sob cada estilo
  let ep = base, eq = base;
  for (let i = 0; i < 8; i++) {
    ep = applyMatchPerformanceEvolution(ep, stat as never, 'win', false, pressW);
    eq = applyMatchPerformanceEvolution(eq, stat as never, 'win', false, possW);
  }
  check('partida sob pressão elevou FÍSICO acima da posse',
    ep.attrs.fisico > eq.attrs.fisico, `press=${ep.attrs.fisico} poss=${eq.attrs.fisico}`);
  check('partida sob posse elevou TÁTICO acima da pressão',
    eq.attrs.tatico > ep.attrs.tatico, `poss=${eq.attrs.tatico} press=${ep.attrs.tatico}`);

  // sem estilo, mantém o comportamento antigo (nivelamento) — não quebra
  const flat = { ...mkPlayer(60), attrs: { passe: 40, marcacao: 80, velocidade: 60, drible: 60, finalizacao: 60, fisico: 60, tatico: 60, mentalidade: 60, confianca: 60, fairPlay: 60 } } as PlayerEntity;
  const noStyle = applyMatchPerformanceEvolution(flat, stat as never, 'win', false);
  check('sem estilo, nivelamento sobe o atributo mais baixo (passe 40→cresce)', noStyle.attrs.passe > 40, `passe=${noStyle.attrs.passe}`);
}

console.log(fail === 0 ? '\n✅ ESTILO→EVOLUÇÃO — tudo passou\n' : `\n❌ ${fail} falha(s)\n`);
if (fail > 0) process.exit(1);

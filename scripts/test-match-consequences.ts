/**
 * Self-test: A CONTA DA PARTIDA (Fase 3).
 *
 * Prova que o pós-jogo consegue explicar ao manager o que a partida causou:
 *  - toda consequência do catálogo tem caminho de volta ao seu texto;
 *  - a seleção pega o que nasceu AGORA e ignora o que é de antes;
 *  - penalidade aparece antes de bônus (o que dói primeiro);
 *  - consequência de outro clube nunca vaza pra tela.
 *
 * E que o FOCO do pré-jogo é uma decisão real:
 *  - os 5 estilos existem no catálogo de intensidade;
 *  - eles divergem de verdade nos parâmetros do motor.
 *
 * Uso: npm run test:match-consequences
 */
import { IMPACT_CATALOG, templateForKind } from '../src/systems/impactCatalog';
import { eventsFromMatchSummary, materializeBatch } from '../src/systems/consequences/handlers';
import { selectRecentConsequences } from '../src/systems/consequences/recent';
import { TACTICAL_INTENSITY_PRESETS, type TacticalIntensityLevel } from '../src/match/quickTacticalIntensity';
import type { PersistentConsequence } from '../src/systems/consequences/types';

let fail = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(ok ? `  ✅ ${label}` : `  ❌ ${label} ${detail}`);
  if (!ok) fail++;
};

const NOW = 1_700_000_000_000;
const MIN = 60_000;

console.log('\n📉 A CONTA DA PARTIDA\n');

// ── 1) Todo template tem caminho de volta ao texto ────────────────────────
{
  let missing: string[] = [];
  for (const entry of Object.values(IMPACT_CATALOG)) {
    for (const tpl of [...(entry.player ?? []), ...(entry.club ?? [])]) {
      const found = templateForKind(tpl.kind);
      if (!found || found.label !== tpl.label) missing.push(tpl.kind);
    }
  }
  check('todo kind do catálogo resolve pro seu template', missing.length === 0, missing.join(', '));
  check('kind inexistente devolve undefined', templateForKind('nao_existe') === undefined);

  let semTexto: string[] = [];
  for (const entry of Object.values(IMPACT_CATALOG)) {
    for (const tpl of [...(entry.player ?? []), ...(entry.club ?? [])]) {
      if (!tpl.label.trim() || !tpl.description.trim()) semTexto.push(tpl.kind);
    }
  }
  check('todo template tem rótulo E explicação em pt-BR', semTexto.length === 0, semTexto.join(', '));
}

// ── 2) Uma partida real gera consequências explicáveis ────────────────────
{
  const events = eventsFromMatchSummary({
    managerId: 'mgr', clubId: 'club', matchId: 'm1',
    scoreFor: 4, scoreAgainst: 0,
    redCardPlayerIds: ['p2'],
    hatTrickPlayerIds: ['p1'],
    injuries: [{ playerId: 'p3', severity: 'light' }],
    exhaustedPlayerIds: [],
    mvpPlayerId: 'p1',
  } as never);
  const cons = materializeBatch(events).map((c) => ({ ...c, startsAt: NOW, expiresAt: NOW + 3600_000 }));
  check('a partida gerou consequências', cons.length > 0, `${cons.length}`);

  const explicaveis = cons.filter((c) => !!templateForKind(c.kind));
  check('todas são explicáveis ao manager', explicaveis.length === cons.length,
    `${explicaveis.length}/${cons.length}`);

  const byId: Record<string, PersistentConsequence> = {};
  for (const c of cons) byId[c.id] = c;
  const rows = selectRecentConsequences(byId, 'club', NOW);
  check('todas entram na seleção do pós-jogo', rows.length === cons.length);
  check('penalidade vem antes de bônus',
    rows.findIndex((r) => r.magnitude < 0) < rows.findIndex((r) => r.magnitude > 0) ||
    !rows.some((r) => r.magnitude > 0),
    rows.map((r) => `${r.kind}:${r.magnitude}`).join(' '));
}

// ── 3) Janela de recência e isolamento por clube ──────────────────────────
{
  const mk = (id: string, clubId: string, startsAt: number, magnitude = -1): PersistentConsequence => ({
    id, managerId: 'mgr', clubId, kind: 'red_card_suspension',
    dimension: 'physical', scope: 'player', playerId: 'p1',
    magnitude, decayCurve: 'step', startsAt, expiresAt: startsAt + 3600_000,
  });

  const active: Record<string, PersistentConsequence> = {
    agora: mk('agora', 'club', NOW - 5_000),
    recente: mk('recente', 'club', NOW - 2 * MIN),
    velha: mk('velha', 'club', NOW - 30 * MIN),
    outroClube: mk('outroClube', 'rival', NOW - 5_000),
    futura: mk('futura', 'club', NOW + 10 * MIN),
  };

  const rows = selectRecentConsequences(active, 'club', NOW);
  const ids = rows.map((r) => r.id).sort();
  check('pega o que acabou de acontecer', ids.includes('agora'));
  // Agrupamento: 'recente' é de 2 min atrás — outro jogo, não este.
  check('não mistura lotes de partidas diferentes', !ids.includes('recente'), ids.join(','));
  check('ignora o que é de antes da partida', !ids.includes('velha'));
  check('nunca vaza consequência de outro clube', !ids.includes('outroClube'));
  check('ignora consequência com início no futuro', !ids.includes('futura'));
  check('sem consequência devolve lista vazia', selectRecentConsequences({}, 'club', NOW).length === 0);
}

// ── 3b) Agrupamento por lote ──────────────────────────────────────────────
{
  const mk = (id: string, startsAt: number): PersistentConsequence => ({
    id, managerId: 'mgr', clubId: 'club', kind: 'red_card_suspension',
    dimension: 'physical', scope: 'player', playerId: 'p1',
    magnitude: -1, decayCurve: 'step', startsAt, expiresAt: startsAt + 3600_000,
  });
  // Lote da Liga Global (1 min atrás) + lote da partida que acabou (agora).
  const active: Record<string, PersistentConsequence> = {
    globalA: mk('globalA', NOW - 60_000),
    globalB: mk('globalB', NOW - 60_000),
    agoraA: mk('agoraA', NOW - 200),
    agoraB: mk('agoraB', NOW - 1_500),
  };
  const ids = selectRecentConsequences(active, 'club', NOW).map((r) => r.id).sort();
  check('só o lote mais novo entra', ids.join(',') === 'agoraA,agoraB', ids.join(','));
  check('o lote anterior fica de fora', !ids.includes('globalA') && !ids.includes('globalB'));
  check('lote único inteiro passa',
    selectRecentConsequences({ a: mk('a', NOW), b: mk('b', NOW) }, 'club', NOW).length === 2);
}

console.log('\n🎯 FOCO DO PRÉ-JOGO\n');

// ── 4) Os 5 estilos existem e DIVERGEM ────────────────────────────────────
{
  const levels: TacticalIntensityLevel[] = ['defend', 'possession', 'counter', 'press', 'attack'];
  check('os 5 focos existem no catálogo', levels.every((l) => !!TACTICAL_INTENSITY_PRESETS[l]));
  check('todo foco tem rótulo e descrição em pt-BR',
    levels.every((l) => TACTICAL_INTENSITY_PRESETS[l].label.length > 2 && TACTICAL_INTENSITY_PRESETS[l].description.length > 8));

  const d = TACTICAL_INTENSITY_PRESETS.defend;
  const a = TACTICAL_INTENSITY_PRESETS.attack;
  const p = TACTICAL_INTENSITY_PRESETS.possession;
  const c = TACTICAL_INTENSITY_PRESETS.counter;

  check('atacar cria mais chance de gol que defender', a.shotChanceBoost > d.shotChanceBoost);
  check('defender protege mais que atacar', d.defensiveBonus > a.defensiveBonus);
  check('atacar cansa mais que defender', a.fatigueRate > d.fatigueRate);
  check('posse dá mais bola que contra-ataque', p.possessionBoost > c.possessionBoost);
  check('contra-ataque é o que mais contra-ataca',
    levels.every((l) => TACTICAL_INTENSITY_PRESETS[l].counterChance <= c.counterChance));
  check('nenhum foco é cópia de outro',
    new Set(levels.map((l) => {
      const t = TACTICAL_INTENSITY_PRESETS[l];
      return `${t.fatigueRate}|${t.shotChanceBoost}|${t.possessionBoost}|${t.defensiveBonus}`;
    })).size === levels.length);
}

console.log(fail === 0 ? '\n✅ TUDO VERDE\n' : `\n❌ ${fail} FALHA(S)\n`);
process.exit(fail === 0 ? 0 : 1);

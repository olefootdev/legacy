/**
 * Self-test do CAMINHO DE VOLTA do Legacy Mode.
 *
 * A pergunta que este teste responde: quando a partida do motor novo termina,
 * o resultado VOLTA para o estado do jogo? Sem isso a tela é decorativa — e foi
 * exatamente o buraco que existia: `FieldViewPreview` não tinha um único
 * dispatch, então jogar não mudava nada.
 *
 * Roda uma partida COMPLETA do MotorEngine e passa o resultado pelo
 * `gameReducer` de verdade, com FINALIZE_QUICK_PLAN — o mesmo caminho que a
 * Partida Rápida já usa em produção.
 *
 * Não existe e2e local neste projeto: o front local aponta para o Railway.
 * Self-test do reducer é a verificação honesta.
 *
 * Uso: npm run test:legacy-persistence
 */
import { gameReducer } from '../src/game/reducer';
import type { OlefootGameState } from '../src/game/types';
import type { PlayerEntity } from '../src/entities/types';
import type { PitchPlayerState } from '../src/engine/types';
import { MotorEngine, defaultAttrs, type MotorPlayerInput } from '../src/motor/MotorEngine';
import { defaultArchetypeForSlot } from '../src/motor/archetypeWeights';

let falhas = 0;
const check = (rotulo: string, ok: boolean, detalhe = '') => {
  if (ok) console.log(`  ✅ ${rotulo}`);
  else { falhas += 1; console.log(`  ❌ ${rotulo} ${detalhe}`); }
};

const SLOTS: Array<[string, PitchPlayerState['role'], string]> = [
  ['gol', 'gk', 'GOL'], ['zag1', 'def', 'ZAG'], ['zag2', 'def', 'ZAG'],
  ['le', 'def', 'LAT'], ['ld', 'def', 'LAT'],
  ['vol', 'mid', 'VOL'], ['mc1', 'mid', 'MEI'], ['mc2', 'mid', 'MEI'],
  ['pe', 'attack', 'PE'], ['ata', 'attack', 'ATA'], ['pd', 'attack', 'PD'],
];

function mkPlayer(id: string, pos: string, num: number): PlayerEntity {
  return {
    id, name: id.toUpperCase(), pos, num,
    attrs: {
      passe: 72, marcacao: 70, velocidade: 74, drible: 70, finalizacao: 72,
      fisico: 72, tatico: 72, mentalidade: 74, confianca: 72, fairPlay: 70,
      cabeceio: 65, bolaParada: 60, penalti: 60,
    },
  } as unknown as PlayerEntity;
}

function homeXI(): PitchPlayerState[] {
  return SLOTS.map(([slotId, role, pos], i) => ({
    playerId: `home-${slotId}`,
    slotId, name: `Jogador ${i + 1}`, num: i + 1, pos,
    x: 50, y: 50, fatigue: 10, role,
  } as PitchPlayerState));
}

function motorInputs(xi: PitchPlayerState[], side: 'home' | 'away'): MotorPlayerInput[] {
  return xi.map((p) => ({
    id: side === 'home' ? p.playerId : `away-${p.slotId}`,
    side, slotId: p.slotId, role: p.role, shirtNumber: p.num,
    attrs: defaultAttrs(),
    tacticalArchetypeId: defaultArchetypeForSlot(p.slotId),
  }));
}

function main(): void {
  console.log('Legacy Mode — o resultado volta pro estado do jogo?\n');

  const xi = homeXI();
  const players: Record<string, PlayerEntity> = {};
  xi.forEach((p, i) => { players[p.playerId] = mkPlayer(p.playerId, p.pos, i + 1); });

  // ── 1. Partida completa no motor novo ───────────────────────────────────
  const engine = new MotorEngine(motorInputs(xi, 'home'), motorInputs(xi, 'away'), { seed: 190277 });
  while (!engine.finished) engine.step();
  console.log(`  partida: ${engine.homeScore}×${engine.awayScore} · ` +
    `${engine.stats.passes} passes · ${engine.stats.shots} finalizações\n`);

  check('a partida termina', engine.finished);
  check('produz estatística por jogador', engine.byPlayer.size >= 11,
    `(${engine.byPlayer.size} jogadores com stats)`);

  const comKm = [...engine.byPlayer.values()].filter((e) => e.distanceM > 500).length;
  check('jogadores percorrem distância real', comKm >= 15, `(${comKm} acima de 500m)`);

  // ── 2. Resultado no formato do crédito ──────────────────────────────────
  // Espelha `buildFinalize` da ponte — mesmos campos, mesma origem.
  const homeStats: Record<string, {
    passesOk: number; passesAttempt: number; tackles: number;
    km: number; rating: number; shotsOn?: number; goals?: number;
  }> = {};
  for (const p of xi) {
    const e = engine.byPlayer.get(p.playerId);
    if (!e) continue;
    const acerto = e.passes > 0 ? e.passesOk / e.passes : 0.8;
    homeStats[p.playerId] = {
      passesOk: e.passesOk, passesAttempt: e.passes, tackles: e.tackles,
      km: Math.round((e.distanceM / 1000) * 100) / 100,
      rating: Math.max(4, Math.min(10, 6 + e.goals * 1.25 + (acerto - 0.82) * 3.2)),
      shotsOn: e.shots, goals: e.goals,
    };
  }
  const H = engine.bySide.home;
  const A = engine.bySide.away;

  check('todo titular tem linha de estatística', Object.keys(homeStats).length === 11,
    `(${Object.keys(homeStats).length} de 11)`);

  // ── 3. Passa pelo reducer de verdade ────────────────────────────────────
  // Mesmo formato de estado que `test-legends-cup-reducer` usa. Não dá para
  // partir de `createInitialGameState()` aqui: ela lê `import.meta.env`, que só
  // existe sob o Vite — e este self-test roda em Node puro, de propósito,
  // porque o front local aponta para o Railway e não há e2e local.
  const antes = {
    club: { id: 'c1', name: 'Olefoot FC', shortName: 'OLE' },
    finance: { ole: 10_000, broCents: 0, expLifetimeEarned: 0, expHistory: [] },
    players,
    playerHealth: {},
    quickMatchStreak: { current: 0, best: 0, lastMatchWon: false, multiplier: 1 },
    inbox: [],
    results: [],
    form: [],
    nextFixture: {
      opponent: { id: 'r1', name: 'Adversário FC', shortName: 'ADV', strength: 72 },
      awayName: 'Adversário FC',
    },
  } as unknown as OlefootGameState;

  const depois = gameReducer(antes, {
    type: 'FINALIZE_QUICK_PLAN',
    homeScore: engine.homeScore,
    awayScore: engine.awayScore,
    reading: { good: H.passesOk, total: Math.max(1, H.passes) },
    homeStats,
    homeOnPitch: xi.map((p) => p.playerId),
    agg: {
      shots: H.shots,
      possessionHome: Math.round((H.possessionS / Math.max(1, H.possessionS + A.possessionS)) * 100),
      wasLosing: engine.homeScore < engine.awayScore,
    },
  } as never);

  check('o reducer devolve um estado novo', depois !== antes);

  const mudouFinance = JSON.stringify(depois.finance) !== JSON.stringify(antes.finance);
  check('a economia se mexe', mudouFinance,
    `(antes ${JSON.stringify(antes.finance)} · depois ${JSON.stringify(depois.finance)})`);

  const saudeAntes = Object.keys(antes.playerHealth ?? {}).length;
  const saudeDepois = Object.keys(depois.playerHealth ?? {}).length;
  check('a fadiga do elenco é registrada', saudeDepois > saudeAntes,
    `(${saudeAntes} → ${saudeDepois})`);

  const mudouStreak = depois.quickMatchStreak !== antes.quickMatchStreak;
  const empate = engine.homeScore === engine.awayScore;
  check('a sequência de resultados anda', mudouStreak || empate,
    `(${antes.quickMatchStreak} → ${depois.quickMatchStreak})`);

  console.log('');
  if (falhas > 0) {
    console.error(
      `legacy-persistence: FALHOU — ${falhas} verificação(ões).\n` +
      'Enquanto o resultado não voltar ao estado, o Legacy Mode é demonstração:\n' +
      'joga-se, e nada no clube muda.',
    );
    process.exit(1);
  }
  console.log('legacy-persistence: ok — a partida conta.');
}

main();

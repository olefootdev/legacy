/**
 * Grava uma partida completa do motor novo num JSON compacto, para reprodução.
 * npx tsx scripts/record-motor-match.ts > partida.json
 *
 * Amostra só com a bola rolando e arredonda posições a 0,1m — o suficiente
 * para o olho e pequeno o bastante para caber numa página estática.
 */
import { MotorEngine, defaultAttrs, type MotorPlayerInput } from '../src/motor/MotorEngine';

const SEED = Number(process.argv[2] ?? 404413);
/** Amostras por segundo de futebol. */
const HZ = 2.5;

/** Casa: 4-3-3 de posse — sai jogando, pontas que cortam, falso 9. */
const CASA: Array<[string, MotorPlayerInput['role'], string, string]> = [
  ['gol', 'gk', 'GK_BUILD_UP', 'Goleiro'],
  ['zag1', 'def', 'CB_BALL_PLAYING', 'Zagueiro'],
  ['zag2', 'def', 'CB_BALL_PLAYING', 'Zagueiro'],
  ['le', 'def', 'FB_ATTACKING', 'Lateral'],
  ['ld', 'def', 'FB_ATTACKING', 'Lateral'],
  ['vol', 'mid', 'DM_PLAYMAKER', 'Volante armador'],
  ['mc1', 'mid', 'CM_CONTROLLER', 'Meia'],
  ['mc2', 'mid', 'AM_PLAYMAKER', 'Armador'],
  ['pe', 'attack', 'WINGER_INVERTED', 'Ponta que corta'],
  ['ata', 'attack', 'ST_FALSE_9', 'Falso 9'],
  ['pd', 'attack', 'WINGER_INVERTED', 'Ponta que corta'],
];

/** Fora: 4-4-2 direto — largura, contenção, centroavante de área. */
const FORA: Array<[string, MotorPlayerInput['role'], string, string]> = [
  ['gol', 'gk', 'GK_CLASSIC', 'Goleiro'],
  ['le', 'def', 'WB_OVERLAP', 'Ala'],
  ['zag1', 'def', 'CB_DEFENDER', 'Zagueiro'],
  ['zag2', 'def', 'CB_AGGRESSIVE', 'Zagueiro'],
  ['ld', 'def', 'WB_OVERLAP', 'Ala'],
  ['vol', 'mid', 'DM_DESTROYER', 'Volante de contenção'],
  ['mc1', 'mid', 'CM_BOX_TO_BOX', 'Meia'],
  ['mc2', 'mid', 'CM_BOX_TO_BOX', 'Meia'],
  ['pd', 'mid', 'WINGER_CLASSIC', 'Ponta de linha'],
  ['ata', 'attack', 'ST_TARGET', 'Centroavante de área'],
  ['pe', 'attack', 'WINGER_CLASSIC', 'Ponta de linha'],
];

function build(
  side: 'home' | 'away',
  plano: Array<[string, MotorPlayerInput['role'], string, string]>,
): MotorPlayerInput[] {
  return plano.map(([slot, role, arch], i) => ({
    id: `${side}-${slot}`,
    side,
    slotId: slot,
    role,
    shirtNumber: i + 1,
    attrs: defaultAttrs(),
    tacticalArchetypeId: arch,
  }));
}

const engine = new MotorEngine(build('home', CASA), build('away', FORA), { seed: SEED });
const ordem = engine.snapshot().players.map((p) => p.id);
const idx = new Map(ordem.map((id, i) => [id, i]));

const frames: number[][] = [];
const gols: Array<{ t: number; lado: 'home' | 'away'; minuto: number }> = [];
let placarCasa = 0;
let placarFora = 0;
const passoAmostra = Math.round(1 / (HZ * 0.05));
let k = 0;

while (!engine.finished) {
  engine.step();
  if (engine.homeScore !== placarCasa) {
    placarCasa = engine.homeScore;
    gols.push({ t: Math.round(engine.t), lado: 'home', minuto: engine.minute });
  }
  if (engine.awayScore !== placarFora) {
    placarFora = engine.awayScore;
    gols.push({ t: Math.round(engine.t), lado: 'away', minuto: engine.minute });
  }
  if (k++ % passoAmostra !== 0) continue;
  if (engine.phase !== 'live') continue;

  const s = engine.snapshot();
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const linha: number[] = [
    Math.round(engine.t),
    r1(s.ball.x), r1(s.ball.z),
    engine.carrier ? (idx.get(engine.carrier) ?? -1) : -1,
    engine.homeScore, engine.awayScore,
  ];
  for (const id of ordem) {
    const p = s.players.find((q) => q.id === id)!;
    linha.push(r1(p.x), r1(p.z));
  }
  frames.push(linha);
}

const elenco = (plano: typeof CASA, side: 'home' | 'away') =>
  plano.map(([slot, role, arch, rotulo], i) => ({
    id: `${side}-${slot}`, num: i + 1, slot, role, arch, rotulo,
  }));

process.stdout.write(JSON.stringify({
  seed: SEED,
  hz: HZ,
  placar: [engine.homeScore, engine.awayScore],
  stats: {
    passes: engine.stats.passes,
    chutes: engine.stats.shots,
    defesas: engine.stats.saves,
    bolaRolandoMin: Math.round(engine.inPlaySeconds / 60),
  },
  ordem,
  casa: elenco(CASA, 'home'),
  fora: elenco(FORA, 'away'),
  gols,
  frames,
}));

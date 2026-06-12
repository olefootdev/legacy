/**
 * Self-test da Fase C — montagem de inputs + lógica dos 5 cards + substituição.
 *
 * Lógica pura (sem React/Python). Cobre:
 *   1. buildQuickPlanInputs monta 11 titulares + 11 away com posições reais
 *   2. homeStrength = média dos OVRs quando não passado
 *   3. pickHalftimeFive: 3 melhores (effective desc) no topo, 2 piores embaixo
 *   4. applySubstitution troca out→in mantendo as posições
 *   5. effectiveOvr aplica penalidade de fadiga
 *
 * Uso: npm run test:quick-engaged
 */

import {
  buildQuickPlanInputs,
  pickHalftimeFive,
  applySubstitution,
  playerToHomeView,
  effectiveOvr,
  formationShape,
  applyFormationToPayloads,
  type QuickHomePlayerView,
} from '../src/match/quickEngaged/buildQuickPlanInputs';
import type { PlayerEntity } from '../src/entities/types';

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) console.log(`  ✓ ${label}`);
  else { failures += 1; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}

// Slots canônicos (PITCH_SLOT_ORDER) pareados com a posição do jogador.
const SLOTS: { slot: string; pos: string }[] = [
  { slot: 'gol', pos: 'GOL' },
  { slot: 'zag1', pos: 'ZAG' },
  { slot: 'zag2', pos: 'ZAG' },
  { slot: 'ld', pos: 'LD' },
  { slot: 'le', pos: 'LE' },
  { slot: 'vol', pos: 'VOL' },
  { slot: 'mc1', pos: 'MC' },
  { slot: 'mc2', pos: 'MC' },
  { slot: 'pd', pos: 'PD' },
  { slot: 'pe', pos: 'PE' },
  { slot: 'ata', pos: 'ATA' },
];

function mkPlayer(i: number, pos: string, ovrLevel: number): PlayerEntity {
  const attrs = {
    passe: ovrLevel, marcacao: ovrLevel, velocidade: ovrLevel, drible: ovrLevel,
    finalizacao: ovrLevel, fisico: ovrLevel, tatico: ovrLevel, mentalidade: ovrLevel,
    confianca: ovrLevel, fairPlay: ovrLevel,
  };
  return {
    id: `p${i}`,
    name: `Jog${i}`,
    pos,
    num: i + 1,
    attrs,
    outForMatches: 0,
  } as unknown as PlayerEntity;
}

function main() {
  console.log('— Fase C: montagem + 5 cards + substituição —\n');

  // Monta 11 titulares variando OVR + um banco
  const players: Record<string, PlayerEntity> = {};
  const lineup: Record<string, string> = {};
  SLOTS.forEach(({ slot, pos }, i) => {
    const ovr = 60 + i * 2; // 60..80 crescente
    players[`p${i}`] = mkPlayer(i, pos, ovr);
    lineup[slot] = `p${i}`;
  });
  // Banco
  for (let i = 11; i < 16; i += 1) {
    players[`p${i}`] = mkPlayer(i, 'MC', 70);
  }

  console.log('[1] buildQuickPlanInputs');
  const { input, homePlayers } = buildQuickPlanInputs({
    players,
    playerHealth: undefined,
    lineup,
    homeShort: 'HOM',
    awayShort: 'AWA',
    awayStrength: 72,
    seed: 'fase-c',
  });
  check('11 titulares home', homePlayers.length === 11, `got ${homePlayers.length}`);
  check('11 payloads home', input.homeLineup.length === 11);
  check('11 payloads away', input.awayLineup.length === 11);
  check('away tem laterais reais (LE/LD/PE/PD)', (() => {
    const positions = input.awayLineup.map((p) => p.pos);
    return positions.includes('LE') && positions.includes('LD') && positions.includes('PE') && positions.includes('PD');
  })());
  check('away determinístico por seed', (() => {
    const b = buildQuickPlanInputs({
      players, playerHealth: undefined, lineup, homeShort: 'HOM', awayShort: 'AWA', awayStrength: 72, seed: 'fase-c',
    });
    return JSON.stringify(b.input.awayLineup) === JSON.stringify(input.awayLineup);
  })());

  console.log('\n[2] homeStrength derivado');
  // OVRs computados por overallFromAttributes; só checamos faixa coerente
  check('homeStrength entre min e max dos OVRs', (() => {
    const ovrs = homePlayers.map((p) => p.ovr);
    return input.homeStrength >= Math.min(...ovrs) && input.homeStrength <= Math.max(...ovrs);
  })(), `homeStrength=${input.homeStrength}`);

  console.log('\n[3] pickHalftimeFive');
  const five = pickHalftimeFive(homePlayers);
  check('3 no topo + 2 embaixo', five.top.length === 3 && five.bottom.length === 2);
  check('topo são os de maior effective', (() => {
    const sorted = [...homePlayers].sort((a, b) => b.effective - a.effective);
    return five.top.every((p, i) => p.id === sorted[i]!.id);
  })());
  check('bottom são os 2 piores (pior primeiro)', (() => {
    const sorted = [...homePlayers].sort((a, b) => a.effective - b.effective);
    return five.bottom[0]!.id === sorted[0]!.id && five.bottom[1]!.id === sorted[1]!.id;
  })());
  check('sem sobreposição topo/bottom', !five.top.some((t) => five.bottom.some((b) => b.id === t.id)));

  console.log('\n[4] applySubstitution');
  const out = five.bottom[0]!;
  const reserve = playerToHomeView(players.p13!, 0);
  const after = applySubstitution(homePlayers, out.id, reserve);
  check('mesmo tamanho (11)', after.length === 11);
  check('out saiu, reserva entrou', !after.some((p) => p.id === out.id) && after.some((p) => p.id === reserve.id));
  check('posição do slot preservada', (() => {
    const idx = homePlayers.findIndex((p) => p.id === out.id);
    return after[idx]!.id === reserve.id;
  })());
  // Item 4: o que entra HERDA o papel do slot (mismatch reflete na hora).
  check('reserva herda o papel de quem saiu', (() => {
    const gk = homePlayers.find((p) => p.payload.role === 'gk')!;
    const fieldReserve = playerToHomeView(players.p14!, 0); // MC → role mid
    const swapped = applySubstitution(homePlayers, gk.id, fieldReserve);
    const inSlot = swapped.find((p) => p.id === fieldReserve.id)!;
    return inSlot.payload.role === 'gk'; // entrou no gol → joga de goleiro
  })());

  console.log('\n[5] effectiveOvr');
  check('fadiga 0 → ovr cheio', effectiveOvr(80, 0) === 80);
  check('fadiga 50 → -10', effectiveOvr(80, 50) === 70);
  check('cansado rende menos que igual descansado', (() => {
    const fresh: QuickHomePlayerView = playerToHomeView(mkPlayer(99, 'ATA', 75), 0);
    const tired: QuickHomePlayerView = playerToHomeView(mkPlayer(98, 'ATA', 75), 60);
    return tired.effective < fresh.effective;
  })());

  console.log('\n[6] Formação afeta o replan');
  check('formationShape 4-3-3 → 4/3/3', (() => {
    const s = formationShape('4-3-3');
    return s.def === 4 && s.mid === 3 && s.attack === 3;
  })());
  check('formationShape 4-2-3-1 → 4 def / 5 mid / 1 attack', (() => {
    const s = formationShape('4-2-3-1');
    return s.def === 4 && s.mid === 5 && s.attack === 1;
  })());
  const payloads = input.homeLineup;
  const def532 = applyFormationToPayloads(payloads, '5-3-2');
  const atk343 = applyFormationToPayloads(payloads, '3-4-3');
  const countRole = (ps: typeof payloads, r: string) => ps.filter((p) => p.role === r).length;
  check('5-3-2 põe 2 atacantes, 3-4-3 põe 3', countRole(def532, 'attack') === 2 && countRole(atk343, 'attack') === 3);
  check('mais defensiva tem mais zagueiros', countRole(def532, 'def') > countRole(atk343, 'def'));
  check('GK preservado em ambas', countRole(def532, 'gk') === 1 && countRole(atk343, 'gk') === 1);
  check('sempre 11 jogadores', def532.length === 11 && atk343.length === 11);

  console.log(failures === 0 ? '\n✅ Fase C OK — todos os checks passaram' : `\n❌ ${failures} check(s) falharam`);
  process.exit(failures === 0 ? 0 : 1);
}

main();

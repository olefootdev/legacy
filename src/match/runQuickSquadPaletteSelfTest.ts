/**
 * Self-test da paleta nomeada gerada pelo elenco (quick-match-revolution.md §4/§5).
 * Roda: `npm run test:quick-squad-palette`
 */

import type { PitchPlayerState } from '@/engine/types';
import type { MatchPlayerAttributes } from '@/match/playerInMatch';
import { buildSquadDecisionMoment, computeSquadProfile } from './quickSquadPalette';

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

function mkAttrs(over: Partial<MatchPlayerAttributes>): MatchPlayerAttributes {
  return {
    passeCurto: 50, passeLongo: 50, cruzamento: 50, marcacao: 50, velocidade: 50,
    fairPlay: 50, drible: 50, finalizacao: 50, fisico: 50, tatico: 50,
    mentalidade: 50, confianca: 50, ...over,
  };
}
let idc = 0;
function mk(role: PitchPlayerState['role'], name: string, over: Partial<MatchPlayerAttributes>): PitchPlayerState {
  idc++;
  return {
    playerId: `p${idc}`, slotId: `s${idc}`, name, num: idc, pos: 'MC',
    x: 50, y: 50, heading: 0, fatigue: 0, role, attributes: mkAttrs(over),
  } as PitchPlayerState;
}

console.log('\n▶ Quick Squad Palette Self-Test\n');

// ── ATAQUE: elenco criativo → desbloqueia criação, contexto NOMEADO ─────────
const creative: PitchPlayerState[] = [
  mk('gk', 'Goleiro', {}),
  mk('def', 'Zaga', { marcacao: 60, fisico: 60 }),
  mk('mid', 'Palhinha', { passeCurto: 88, drible: 84, tatico: 80, passeLongo: 80 }),
  mk('mid', 'Adauto', { passeCurto: 84, drible: 80, tatico: 78 }),
  mk('attack', 'Tito', { finalizacao: 86, drible: 82, velocidade: 80 }),
];
const atk = buildSquadDecisionMoment(creative, 30, 1000, 'attack');
const atkIds = atk.moment.choices.map((c) => c.id);
check('ataque: protagonista nomeado no contexto', /Palhinha|Adauto|Tito/.test(atk.moment.context), atk.moment.context);
check('ataque: criativo desbloqueia criação', atkIds.some((id) => ['passe_genial', 'drible', 'lancamento'].includes(id)), atkIds.join(','));
check('ataque: 3 botões', atk.moment.choices.length === 3);
check('ataque: finalização marca gol real (scoreOnSuccess + executor)', atk.moment.choices.some((c) => c.scoreOnSuccess && c.executorId), atkIds.join(','));
check('ataque: timer 3s (§4.2)', atk.moment.timeoutMs === 3000, String(atk.moment.timeoutMs));
check('ataque: successText nomeia o jogador', atk.moment.choices.every((c) => !!c.successText && /[A-Z]/.test(c.successText)), JSON.stringify(atk.moment.choices.map((c) => c.successText)));

// ── ATAQUE: elenco defensivo → criação NÃO aparece ──────────────────────────
idc = 0;
const weak: PitchPlayerState[] = [
  mk('gk', 'GK', {}),
  mk('def', 'Bruto', { marcacao: 80, fisico: 82, passeCurto: 38, drible: 34, tatico: 44, velocidade: 40 }),
  mk('def', 'Pedra', { marcacao: 78, fisico: 80, passeCurto: 40, drible: 36, velocidade: 42 }),
  mk('mid', 'Limitado', { passeCurto: 44, drible: 40, tatico: 48, fisico: 70 }),
  mk('attack', 'Bola', { finalizacao: 50, drible: 42, velocidade: 52 }),
];
const atkWeak = buildSquadDecisionMoment(weak, 60, 2000, 'attack');
const weakIds = atkWeak.moment.choices.map((c) => c.id);
check('ataque defensivo: NÃO mostra passe genial nem drible', !weakIds.includes('passe_genial') && !weakIds.includes('drible'), weakIds.join(','));
check('ataque defensivo: tem opção segura', weakIds.some((id) => ['segurar', 'recuar'].includes(id)), weakIds.join(','));

// ── DEFESA: carrinho de zagueiro LENTO vira CARTÃO (§4.3) ────────────────────
const def = buildSquadDecisionMoment(weak, 70, 3000, 'defense');
const defIds = def.moment.choices.map((c) => c.id);
check('defesa: botões Desarme/Carrinho/Cercar', defIds.includes('desarme') && defIds.includes('carrinho') && defIds.includes('cercar'), defIds.join(','));
check('defesa: contexto nomeia o zagueiro', /Bruto|Pedra/.test(def.moment.context), def.moment.context);
const carrinho = def.moment.choices.find((c) => c.id === 'carrinho');
check('defesa: carrinho de LENTO tem cardOnFail', carrinho?.cardOnFail === 'yellow', JSON.stringify(carrinho));
check('defesa: failText do carrinho explica o PORQUÊ (lento)', /lento/i.test(carrinho?.failText ?? ''), carrinho?.failText);

// Defesa com zagueiro RÁPIDO → carrinho sem cartão.
idc = 0;
const fastDef: PitchPlayerState[] = [
  mk('gk', 'GK', {}),
  mk('def', 'Veloz', { marcacao: 72, velocidade: 78 }),
  mk('mid', 'M', {}),
  mk('attack', 'A', {}),
];
const defFast = buildSquadDecisionMoment(fastDef, 50, 4000, 'defense');
check('defesa rápida: carrinho de veloz NÃO carda', defFast.moment.choices.find((c) => c.id === 'carrinho')?.cardOnFail === undefined);

check('invariante: successChance em (0,1]', [...atk.moment.choices, ...def.moment.choices].every((c) => c.successChance > 0 && c.successChance <= 1));
check('profile determinístico', JSON.stringify(computeSquadProfile(creative)) === JSON.stringify(atk.profile));

if (failures > 0) {
  console.log(`\n✗ quick squad palette self-test FALHOU (${failures})\n`);
  process.exit(1);
}
console.log('\n▶ quick squad palette self-test OK — decisões NOMEADAS (ataque+defesa) + gol/cartão real\n');

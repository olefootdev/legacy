/**
 * Self-test da paleta gerada pelo elenco (quick-match-revolution.md §5).
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
function mk(role: PitchPlayerState['role'], over: Partial<MatchPlayerAttributes>): PitchPlayerState {
  idc++;
  return {
    playerId: `p${idc}`, slotId: `s${idc}`, name: `Jog ${idc}`, num: idc, pos: 'MC',
    x: 50, y: 50, heading: 0, fatigue: 0, role,
    attributes: mkAttrs(over),
  } as PitchPlayerState;
}

console.log('\n▶ Quick Squad Palette Self-Test\n');

// ── Elenco CRIATIVO: deve desbloquear criação ───────────────────────────────
const creative: PitchPlayerState[] = [
  mk('gk', {}),
  mk('def', { marcacao: 60, fisico: 60 }),
  mk('mid', { passeCurto: 86, drible: 82, tatico: 80, passeLongo: 80 }),
  mk('mid', { passeCurto: 84, drible: 80, tatico: 78 }),
  mk('attack', { finalizacao: 84, drible: 82, velocidade: 78 }),
];
const cRes = buildSquadDecisionMoment(creative, 30, 1000);
const cIds = cRes.moment.choices.map((c) => c.id);
check('criativo: perfil creativity alto', cRes.profile.creativity >= 70, JSON.stringify(cRes.profile));
check('criativo: desbloqueia ao menos 1 opção de criação',
  cIds.some((id) => ['passe_genial', 'drible', 'lancamento'].includes(id)), cIds.join(','));
check('criativo: exatamente 3 botões', cRes.moment.choices.length === 3, String(cRes.moment.choices.length));
check('criativo: finalização tem scoreOnSuccess + executor',
  cRes.moment.choices.some((c) => c.scoreOnSuccess && c.executorId), cIds.join(','));

// ── Elenco SÓ DEFENSIVO: criação NÃO aparece ────────────────────────────────
idc = 0;
const defensive: PitchPlayerState[] = [
  mk('gk', {}),
  mk('def', { marcacao: 78, fisico: 80, passeCurto: 40, drible: 38, tatico: 45 }),
  mk('def', { marcacao: 76, fisico: 78, passeCurto: 42, drible: 36 }),
  mk('mid', { passeCurto: 46, drible: 40, tatico: 50, fisico: 70 }),
  mk('attack', { finalizacao: 52, drible: 44, velocidade: 55 }),
];
const dRes = buildSquadDecisionMoment(defensive, 60, 2000);
const dIds = dRes.moment.choices.map((c) => c.id);
check('defensivo: creativity baixo', dRes.profile.creativity < 60, JSON.stringify(dRes.profile));
check('defensivo: NÃO mostra passe genial nem drible',
  !dIds.includes('passe_genial') && !dIds.includes('drible'), dIds.join(','));
check('defensivo: tem opção segura (segurar/chutão/muralha)',
  dIds.some((id) => ['segurar', 'chutao', 'muralha'].includes(id)), dIds.join(','));

// ── Invariantes gerais ──────────────────────────────────────────────────────
check('todos os botões têm successChance em (0,1]',
  [...cRes.moment.choices, ...dRes.moment.choices].every((c) => c.successChance > 0 && c.successChance <= 1));
check('nenhuma label vazia',
  [...cRes.moment.choices, ...dRes.moment.choices].every((c) => c.label.length >= 3));
check('profile determinístico', JSON.stringify(computeSquadProfile(creative)) === JSON.stringify(cRes.profile));

if (failures > 0) {
  console.log(`\n✗ quick squad palette self-test FALHOU (${failures})\n`);
  process.exit(1);
}
console.log('\n▶ quick squad palette self-test OK — menu é espelho do elenco (criação×defesa + gol real)\n');

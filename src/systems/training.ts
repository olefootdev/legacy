import type { PlayerAttributes, PlayerEntity } from '@/entities/types';
import { addOle } from './economy';
import type { FinanceState } from '@/entities/types';

/**
 * Atributos prioritários por posição que sobem em sessão de treino dos
 * prospects (`managerCreated`). O sistema rotaciona dentro da lista usando
 * evolutionXp como contador, então sessões consecutivas evoluem attrs
 * diferentes — em ~3 sessões cobre todos os primários daquela posição.
 */
const POSITION_TRAIN_ATTRS: Record<string, Array<keyof PlayerAttributes>> = {
  GOL: ['marcacao', 'tatico', 'mentalidade'],
  ZAG: ['marcacao', 'fisico', 'tatico'],
  LE: ['velocidade', 'marcacao', 'passe'],
  LD: ['velocidade', 'marcacao', 'passe'],
  VOL: ['marcacao', 'tatico', 'passe'],
  MC: ['passe', 'tatico', 'drible'],
  MEI: ['drible', 'passe', 'finalizacao'],
  PE: ['velocidade', 'drible', 'passe'],
  PD: ['velocidade', 'drible', 'passe'],
  ATA: ['finalizacao', 'drible', 'fisico'],
};

function isAcademyProspect(p: PlayerEntity): boolean {
  return p.managerCreated === true || p.id.startsWith('mgr_');
}

function pickTrainingAttr(p: PlayerEntity): keyof PlayerAttributes {
  const candidates = POSITION_TRAIN_ATTRS[p.pos] ?? ['fisico', 'tatico'];
  const xp = Math.max(0, Math.floor(p.evolutionXp ?? 0));
  return candidates[xp % candidates.length];
}

/**
 * Treino leve: reduz fadiga e custa EXP.
 * Prospects da Academia (`managerCreated`) também ganham +1 num atributo
 * primário da posição (rotacionado por sessão). O cap de OVR é aplicado
 * depois pelo reducer via clampPlayerToEvolutionCap (88 pra prospects).
 */
export function applySquadTraining(
  players: Record<string, PlayerEntity>,
  finance: FinanceState,
  oleCost = 35,
): { players: Record<string, PlayerEntity>; finance: FinanceState; ok: boolean } {
  if (finance.ole < oleCost) return { players, finance, ok: false };
  const nextPlayers: Record<string, PlayerEntity> = {};
  for (const [id, p] of Object.entries(players)) {
    let attrs = p.attrs;
    if (isAcademyProspect(p)) {
      const attr = pickTrainingAttr(p);
      const current = p.attrs[attr] ?? 0;
      attrs = { ...p.attrs, [attr]: Math.min(99, current + 1) };
    }
    nextPlayers[id] = {
      ...p,
      attrs,
      fatigue: Math.max(0, p.fatigue - 6 - p.attrs.fisico / 40),
      evolutionXp: p.evolutionXp + 2,
    };
  }
  return { players: nextPlayers, finance: addOle(finance, -oleCost), ok: true };
}

import type { IndividualTrainingType, CollectiveTrainingType, TrainingPlan, TrainingGroup } from '@/game/types';
import type { PlayerEntity } from '@/entities/types';

function clampAttr(v: number): number {
  return Math.max(1, Math.min(99, Math.round(v)));
}

export function maxSlotsByTrainingCenter(level: number): number {
  if (level >= 3) return 5;
  if (level >= 2) return 3;
  return 1;
}

export function addHoursIso(iso: string, h: number): string {
  return new Date(new Date(iso).getTime() + h * 3600_000).toISOString();
}

export function applyTrainingToPlayer(
  player: PlayerEntity,
  trainingType: IndividualTrainingType | CollectiveTrainingType,
): PlayerEntity {
  const p = { ...player, attrs: { ...player.attrs } };
  switch (trainingType) {
    case 'fisico':
      p.attrs.fisico = clampAttr(p.attrs.fisico + 2);
      p.attrs.velocidade = clampAttr(p.attrs.velocidade + 1);
      p.fatigue = Math.max(0, p.fatigue - 4);
      break;
    case 'mental':
      p.attrs.mentalidade = clampAttr(p.attrs.mentalidade + 2);
      p.attrs.confianca = clampAttr(p.attrs.confianca + 2);
      break;
    case 'tatico':
    case 'formacao':
      p.attrs.tatico = clampAttr(p.attrs.tatico + 2);
      p.attrs.marcacao = clampAttr(p.attrs.marcacao + 1);
      break;
    case 'atributos':
      p.attrs.passe = clampAttr(p.attrs.passe + 1);
      p.attrs.drible = clampAttr(p.attrs.drible + 1);
      p.attrs.finalizacao = clampAttr(p.attrs.finalizacao + 1);
      break;
    case 'especial':
      p.attrs.finalizacao = clampAttr(p.attrs.finalizacao + 2);
      p.attrs.passe = clampAttr(p.attrs.passe + 1);
      p.attrs.drible = clampAttr(p.attrs.drible + 1);
      break;
    case 'empatia':
      p.attrs.confianca = clampAttr(p.attrs.confianca + 2);
      p.attrs.fairPlay = clampAttr(p.attrs.fairPlay + 1);
      break;
  }
  p.evolutionXp += 4;
  return p;
}

export function resolveGroupPlayerIds(
  players: Record<string, PlayerEntity>,
  group: TrainingGroup,
): string[] {
  const list = Object.values(players);
  if (group === 'all') return list.map((p) => p.id);
  if (group === 'defensivo') return list.filter((p) => p.zone === 'defesa' || p.zone === 'gol').map((p) => p.id);
  if (group === 'criativo') return list.filter((p) => p.zone === 'meio').map((p) => p.id);
  return list.filter((p) => p.zone === 'ataque').map((p) => p.id);
}

export function splitDuePlans(plans: TrainingPlan[], nowIso: string): { due: TrainingPlan[]; rest: TrainingPlan[] } {
  const due: TrainingPlan[] = [];
  const rest: TrainingPlan[] = [];
  for (const p of plans) {
    if (p.status === 'running' && p.endAt <= nowIso) due.push(p);
    else rest.push(p);
  }
  return { due, rest };
}

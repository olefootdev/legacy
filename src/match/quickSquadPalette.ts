/**
 * Paleta de decisões NOMEADA + gerada pelos atributos do ELENCO (quick-match-revolution.md §4/§5).
 *
 * Cada decisão tem um PROTAGONISTA real em campo e um contexto de lance, no
 * estilo da spec:
 *   "Palhinha recebe no meio-campo  ▸ Passe curto  ▸ Segurar  ▸ Recuar"
 *   "Atacante avança, Lugano cerca  ▸ Desarme  ▸ Carrinho  ▸ Cercar"
 *
 * §5 — o MENU é espelho do elenco: criação (Passe genial/Drible/Lançamento) só
 * aparece se o time CRIA (gating relativo à média do próprio elenco). Time
 * defensivo só vê Finalizar/Segurar/Recuar. Comprar meia criativo expande a
 * paleta (loop de ROI).
 *
 * §4.3 — consequência REAL e com o PORQUÊ: finalização certa vira GOL; carrinho
 * de zagueiro LENTO vira CARTÃO ("Carrinho! Fulano é lento → AMARELO"). O texto
 * explica a causa pelo atributo do executor.
 */

import type { PitchPlayerState } from '@/engine/types';
import type { MatchPlayerAttributes } from '@/match/playerInMatch';
import type { QuickInteractiveMoment, QuickMomentChoice } from '@/match/quickInteractiveMoments';

export interface SquadProfile {
  creativity: number; // passe + drible + tático (meio/ataque)
  finishing: number; // finalização (ataque)
  pace: number; // velocidade
  defense: number; // marcação + físico (defesa)
  overall: number;
}

export type SquadDecisionMode = 'attack' | 'defense';

type Role = NonNullable<PitchPlayerState['role']>;

const DEFAULT_ATTRS: MatchPlayerAttributes = {
  passeCurto: 50, passeLongo: 50, cruzamento: 50, marcacao: 50, velocidade: 50,
  fairPlay: 50, drible: 50, finalizacao: 50, fisico: 50, tatico: 50,
  mentalidade: 50, confianca: 50,
};

function attrs(p: PitchPlayerState): MatchPlayerAttributes {
  return (p.attributes as MatchPlayerAttributes) ?? DEFAULT_ATTRS;
}
function avg(nums: number[], fallback = 50): number {
  const v = nums.filter((n) => typeof n === 'number');
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : fallback;
}
function byRole(players: PitchPlayerState[], role: Role): PitchPlayerState[] {
  return players.filter((p) => p.role === role);
}
function firstName(name: string | undefined): string {
  if (!name) return 'O jogador';
  const t = name.trim().split(/\s+/);
  return t.length > 1 ? t[0]! : name;
}
function chance(base: number, value: number): number {
  return Math.max(0.12, Math.min(0.92, base + (value - 50) * 0.005));
}

export function computeSquadProfile(players: PitchPlayerState[]): SquadProfile {
  const att = byRole(players, 'attack');
  const mid = byRole(players, 'mid');
  const def = byRole(players, 'def');
  const creators = [...mid, ...att];
  const creativity = avg([
    ...creators.map((p) => attrs(p).passeCurto),
    ...creators.map((p) => attrs(p).drible),
    ...creators.map((p) => attrs(p).tatico),
  ]);
  const finishing = avg((att.length ? att : creators).map((p) => attrs(p).finalizacao));
  const pace = avg(players.map((p) => attrs(p).velocidade));
  const defense = avg([
    ...(def.length ? def : players).map((p) => attrs(p).marcacao),
    ...(def.length ? def : players).map((p) => attrs(p).fisico),
  ]);
  const overall = Math.round((creativity + finishing + pace + defense) / 4);
  return { creativity, finishing, pace, defense, overall };
}

/** Protagonista do lance: quem está com a bola (ataque) / quem cerca (defesa). */
function pickProtagonist(players: PitchPlayerState[], mode: SquadDecisionMode): PitchPlayerState | undefined {
  const pool = players.filter((p) => p.role !== 'gk');
  if (!pool.length) return undefined;
  if (mode === 'defense') {
    const def = pool.filter((p) => p.role === 'def');
    const list = def.length ? def : pool;
    return [...list].sort((a, b) => (attrs(b).marcacao ?? 50) - (attrs(a).marcacao ?? 50))[0];
  }
  const creators = pool.filter((p) => p.role === 'mid' || p.role === 'attack');
  const list = creators.length ? creators : pool;
  const score = (p: PitchPlayerState) => (attrs(p).passeCurto ?? 50) + (attrs(p).drible ?? 50);
  return [...list].sort((a, b) => score(b) - score(a))[0];
}

// ─── Catálogo de ATAQUE (executado pelo protagonista que tem a bola) ─────────
interface AttackSpec {
  id: string;
  label: string;
  desc: string;
  attr: keyof MatchPlayerAttributes;
  base: number;
  scoreOnSuccess: boolean;
  ole: number; exp: number; momentum: number;
  dim: keyof SquadProfile | 'any';
  tilt: number;
  success: (n: string) => string;
  fail: (n: string) => string;
}

const ATTACK: AttackSpec[] = [
  { id: 'passe_genial', label: 'Passe genial', desc: 'Rasga a defesa num passe', attr: 'passeCurto', base: 0.5, scoreOnSuccess: true, ole: 30, exp: 11, momentum: 16, dim: 'creativity', tilt: 4,
    success: (n) => `${n} rasga a zaga num passe de outro mundo — GOOOL!`,
    fail: (n) => `${n} arrisca o passe genial, mas a defesa lê. Faltou pouco.` },
  { id: 'drible', label: 'Drible', desc: 'Encara e parte pro gol', attr: 'drible', base: 0.44, scoreOnSuccess: true, ole: 28, exp: 10, momentum: 15, dim: 'creativity', tilt: 2,
    success: (n) => `${n} dribla, deixa o marcador no chão e finaliza — GOL!`,
    fail: (n) => `${n} tenta o drible, mas trava na marcação. Sem drible pra isso.` },
  { id: 'lancamento', label: 'Lançamento', desc: 'Bola nas costas da defesa', attr: 'passeLongo', base: 0.46, scoreOnSuccess: true, ole: 26, exp: 9, momentum: 14, dim: 'pace', tilt: 2,
    success: (n) => `${n} lança nas costas da zaga e o time define — GOOOL!`,
    fail: (n) => `${n} tenta o lançamento, mas a bola foge pela linha de fundo.` },
  { id: 'finalizar', label: 'Chutar', desc: 'Arrisca a finalização', attr: 'finalizacao', base: 0.4, scoreOnSuccess: true, ole: 24, exp: 8, momentum: 13, dim: 'finishing', tilt: 3,
    success: (n) => `${n} arrisca e acerta o ângulo — GOLAÇO!`,
    fail: (n) => `${n} finaliza, mas o goleiro defende.` },
  { id: 'segurar', label: 'Segurar', desc: 'Protege a bola, sem risco', attr: 'tatico', base: 0.74, scoreOnSuccess: false, ole: 12, exp: 4, momentum: 6, dim: 'any', tilt: -1,
    success: (n) => `${n} segura a bola e o time recompõe com calma.`,
    fail: (n) => `${n} tenta segurar, mas perde no toque. Posse adversária.` },
  { id: 'recuar', label: 'Recuar', desc: 'Recua e reorganiza', attr: 'tatico', base: 0.8, scoreOnSuccess: false, ole: 10, exp: 4, momentum: 3, dim: 'any', tilt: -2,
    success: (n) => `${n} recua, troca passes e reorganiza a jogada.`,
    fail: (n) => `${n} recua afobado e entrega a bola.` },
];

function attackUnlocked(s: AttackSpec, p: SquadProfile, mean: number): boolean {
  return s.dim === 'any' ? true : p[s.dim] >= mean - 4;
}
function attackScore(s: AttackSpec, p: SquadProfile, mean: number): number {
  return s.dim === 'any' ? s.tilt : p[s.dim] - mean + s.tilt;
}

// ─── Catálogo de DEFESA (executado pelo zagueiro que cerca) ──────────────────
const ATTACK_CONTEXTS = [
  (n: string) => `${n} recebe no meio-campo.`,
  (n: string) => `${n} avança em profundidade.`,
  (n: string) => `${n} encara a marcação na entrada da área.`,
  (n: string) => `${n} puxa o contra-ataque.`,
];
const DEFENSE_CONTEXTS = [
  (n: string) => `Atacante dispara — ${n} é o último homem.`,
  (n: string) => `Cruzamento na área, ${n} tem que subir.`,
  (n: string) => `Adversário avança, ${n} fecha o corredor.`,
];

function buildChoiceFor(
  prot: PitchPlayerState | undefined,
  attr: keyof MatchPlayerAttributes,
  base: number,
  extra: Partial<QuickMomentChoice> & Pick<QuickMomentChoice, 'id' | 'label' | 'description' | 'momentumImpact'>,
): QuickMomentChoice {
  const val = prot ? (attrs(prot)[attr] ?? 50) : 50;
  return {
    successChance: parseFloat(chance(base, val).toFixed(2)),
    reward: extra.reward ?? { ole: 14, exp: 5 },
    executorId: prot?.playerId,
    executorName: prot?.name,
    ...extra,
  } as QuickMomentChoice;
}

export interface SquadDecisionResult {
  moment: QuickInteractiveMoment;
  profile: SquadProfile;
  protagonist?: PitchPlayerState;
}

/**
 * Monta o moment NOMEADO. mode 'attack' = menu espelho do elenco (criação só se
 * cria); mode 'defense' = Desarme/Carrinho/Cercar/Recuar com carrinho de lento
 * virando cartão real. timeoutMs 3000 (§4.2 timer 2–3s).
 */
export function buildSquadDecisionMoment(
  players: PitchPlayerState[],
  minute: number,
  nowMs: number,
  mode: SquadDecisionMode = 'attack',
): SquadDecisionResult {
  const profile = computeSquadProfile(players);
  const prot = pickProtagonist(players, mode);
  const name = firstName(prot?.name);

  let choices: QuickMomentChoice[];
  let context: string;

  if (mode === 'defense') {
    const slow = (attrs(prot ?? ({} as PitchPlayerState)).velocidade ?? 50) < 52;
    choices = [
      buildChoiceFor(prot, 'marcacao', 0.6, {
        id: 'desarme', label: 'Desarme', description: 'Bote no tempo certo', momentumImpact: 10,
        reward: { ole: 18, exp: 7 },
        successText: `Desarme limpo de ${name} — bola recuperada!`,
        failText: `${name} erra o tempo do bote e o atacante escapa.`,
      }),
      buildChoiceFor(prot, 'marcacao', 0.42, {
        id: 'carrinho', label: 'Carrinho', description: slow ? 'Alto risco — ele é lento' : 'Divididão', momentumImpact: 16,
        reward: { ole: 26, exp: 10 },
        cardOnFail: slow ? 'yellow' : undefined,
        successText: `Carrinho perfeito de ${name}! Tirou tudo, sem falta.`,
        failText: slow
          ? `Carrinho! ${name} é lento demais, chega atrasado — AMARELO!`
          : `Carrinho atrasado de ${name} — falta na entrada da área.`,
      }),
      buildChoiceFor(prot, 'tatico', 0.72, {
        id: 'cercar', label: 'Cercar', description: 'Atrasa, espera o erro', momentumImpact: 6,
        reward: { ole: 12, exp: 4 },
        successText: `${name} cerca, atrasa o ataque e a defesa recompõe.`,
        failText: `${name} é driblado no corredor — perigo!`,
      }),
    ];
    context = DEFENSE_CONTEXTS[minute % DEFENSE_CONTEXTS.length]!(name);
  } else {
    const mean = (profile.creativity + profile.finishing + profile.pace + profile.defense) / 4;
    const unlocked = ATTACK.filter((s) => attackUnlocked(s, profile, mean)).sort(
      (a, b) => attackScore(b, profile, mean) - attackScore(a, profile, mean),
    );
    const safeIds = new Set(['segurar', 'recuar']);
    const picked: AttackSpec[] = [];
    for (const s of unlocked) { if (picked.length >= 2) break; picked.push(s); }
    if (!picked.some((s) => safeIds.has(s.id))) {
      picked.push(unlocked.find((s) => safeIds.has(s.id)) ?? ATTACK.find((s) => s.id === 'segurar')!);
    } else {
      const extra = unlocked.find((s) => !picked.includes(s));
      if (extra) picked.push(extra);
    }
    choices = picked.slice(0, 3).map((s) =>
      buildChoiceFor(prot, s.attr, s.base, {
        id: s.id, label: s.label, description: s.desc, momentumImpact: s.momentum,
        reward: { ole: s.ole, exp: s.exp },
        scoreOnSuccess: s.scoreOnSuccess,
        successText: s.success(name),
        failText: s.fail(name),
      }),
    );
    context = ATTACK_CONTEXTS[minute % ATTACK_CONTEXTS.length]!(name);
  }

  return {
    profile,
    protagonist: prot,
    moment: {
      id: `squad_${mode}_${minute}_${nowMs}`,
      minute,
      type: 'squad_decision',
      context,
      choices,
      timeoutMs: 3000,
      triggeredAtMs: nowMs,
    },
  };
}

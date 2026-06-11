/**
 * Paleta de decisões gerada pelos ATRIBUTOS DO ELENCO (quick-match-revolution.md §5).
 *
 * Os 3 botões não são fixos — são um espelho da qualidade do elenco em campo:
 *   - elenco criativo → desbloqueia "Passe genial", "Drible", "Lançamento";
 *   - elenco só defensivo → "Chutão", "Recuar", "Segurar" (criação nem aparece).
 * Loop de ROI (§5): comprar um meia criativo → novo botão aparece na próxima
 * partida → cria mais → vence mais. Causa-efeito entre gastar e jogar.
 *
 * Guardrail anti-churn: time fraco tem fantasia PRÓPRIA (Muralha, Contra-ataque,
 * Goleiro herói) — divertido no seu nível, não punido. Comprar EXPANDE a paleta.
 *
 * Reusa `quickInteractiveMoments` (mesmo shape de moment/choice) e os atributos
 * de `PitchPlayerState`. Sucesso de uma FINALIZAÇÃO vira gol real (§4.3).
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

/** Melhor executor por atributo entre os papéis preferidos (fallback: qualquer). */
function bestExecutor(
  players: PitchPlayerState[],
  attr: keyof MatchPlayerAttributes,
  roles: Role[],
): PitchPlayerState | undefined {
  const pool = players.filter((p) => p.role && roles.includes(p.role));
  const list = pool.length ? pool : players.filter((p) => p.role !== 'gk');
  return [...list].sort((a, b) => (attrs(b)[attr] ?? 50) - (attrs(a)[attr] ?? 50))[0];
}

function chance(base: number, value: number): number {
  return Math.max(0.12, Math.min(0.92, base + (value - 50) * 0.005));
}

interface PaletteSpec {
  id: string;
  label: string;
  desc: string;
  attr: keyof MatchPlayerAttributes;
  roles: Role[];
  base: number;
  scoreOnSuccess: boolean;
  ole: number;
  exp: number;
  momentum: number;
  /** Dimensão do perfil que rege esta opção ('any' = sempre candidata). */
  dim: keyof SquadProfile | 'any';
  /** Empurrãozinho fixo de prioridade (desempate / sabor ofensivo). */
  tilt: number;
  successText: (name: string) => string;
  failText: (name: string) => string;
  fantasy?: boolean;
}

// Catálogo. Gating RELATIVO (ver buildSquadDecisionMoment): uma opção dimensionada
// só entra quando a SUA dimensão é um ponto FORTE do elenco (>= média do time).
// Robusto a escala absoluta: o menu vira espelho do que o time faz de MELHOR.
const PALETTE: PaletteSpec[] = [
  {
    id: 'passe_genial', label: 'Passe genial', desc: 'Rasga a defesa com um passe',
    attr: 'passeCurto', roles: ['mid', 'attack'], base: 0.5, scoreOnSuccess: true,
    ole: 30, exp: 11, momentum: 16, dim: 'creativity', tilt: 4,
    successText: (n) => `${n} rasga a defesa com um passe de outro mundo — GOOOL!`,
    failText: (n) => `${n} tenta o passe genial, mas a zaga corta. Quase.`,
  },
  {
    id: 'drible', label: 'Drible', desc: 'Encara o marcador e parte pro gol',
    attr: 'drible', roles: ['attack', 'mid'], base: 0.44, scoreOnSuccess: true,
    ole: 28, exp: 10, momentum: 15, dim: 'creativity', tilt: 2,
    successText: (n) => `${n} dribla, limpa o zagueiro e finaliza — é GOL!`,
    failText: (n) => `${n} tenta o drible mas perde a bola no carrinho.`,
  },
  {
    id: 'lancamento', label: 'Lançamento', desc: 'Bola nas costas da defesa',
    attr: 'passeLongo', roles: ['mid', 'def'], base: 0.46, scoreOnSuccess: true,
    ole: 26, exp: 9, momentum: 14, dim: 'pace', tilt: 2,
    successText: (n) => `${n} lança nas costas da zaga e o atacante define — GOOOL!`,
    failText: (n) => `${n} lança longo, mas a bola foge pela linha de fundo.`,
  },
  {
    id: 'contra_ataque', label: 'Contra-ataque', desc: 'Velocidade pura no espaço',
    attr: 'velocidade', roles: ['attack', 'mid'], base: 0.42, scoreOnSuccess: true,
    ole: 26, exp: 9, momentum: 16, dim: 'pace', tilt: 3, fantasy: true,
    successText: (n) => `${n} voa no contra-ataque e bate cruzado — GOL!`,
    failText: (n) => `${n} dispara, mas a defesa volta a tempo de afastar.`,
  },
  {
    id: 'finalizar', label: 'Finalizar', desc: 'Arrisca o chute de fora',
    attr: 'finalizacao', roles: ['attack', 'mid'], base: 0.38, scoreOnSuccess: true,
    ole: 24, exp: 8, momentum: 13, dim: 'finishing', tilt: 3,
    successText: (n) => `${n} arrisca de fora e acerta o ângulo — GOLAÇO!`,
    failText: (n) => `${n} chuta de longe, mas o goleiro defende.`,
  },
  {
    id: 'muralha', label: 'Muralha', desc: 'Segura o resultado com raça',
    attr: 'marcacao', roles: ['def'], base: 0.7, scoreOnSuccess: false,
    ole: 16, exp: 6, momentum: 8, dim: 'defense', tilt: 2, fantasy: true,
    successText: (n) => `${n} comanda a muralha — adversário não passa. Que defesa de time!`,
    failText: (n) => `${n} tenta segurar, mas o adversário fura o bloqueio.`,
  },
  {
    id: 'chutao', label: 'Chutão', desc: 'Tira o perigo, alivia a pressão',
    attr: 'fisico', roles: ['def'], base: 0.66, scoreOnSuccess: false,
    ole: 12, exp: 4, momentum: 5, dim: 'any', tilt: -2,
    successText: (n) => `${n} manda pra longe e o time respira.`,
    failText: (n) => `${n} tenta o chutão, mas a bola sobra pro adversário.`,
  },
  {
    id: 'segurar', label: 'Segurar', desc: 'Mantém a posse, sem risco',
    attr: 'tatico', roles: ['mid', 'def'], base: 0.74, scoreOnSuccess: false,
    ole: 12, exp: 4, momentum: 6, dim: 'any', tilt: -1,
    successText: (n) => `${n} segura a bola e o time recompõe com calma.`,
    failText: (n) => `${n} tenta segurar, mas perde no toque. Posse adversária.`,
  },
];

/** Quão "forte" (relativo à média do time) é a dimensão da opção. */
function specScore(spec: PaletteSpec, p: SquadProfile, mean: number): number {
  if (spec.dim === 'any') return spec.tilt;
  return (p[spec.dim] - mean) + spec.tilt;
}
/** Entra na paleta quando a dimensão é (quase) um ponto forte do elenco. */
function specUnlocked(spec: PaletteSpec, p: SquadProfile, mean: number): boolean {
  if (spec.dim === 'any') return true;
  return p[spec.dim] >= mean - 4;
}

function buildChoice(
  spec: PaletteSpec,
  players: PitchPlayerState[],
): QuickMomentChoice {
  const exec = bestExecutor(players, spec.attr, spec.roles);
  const name = exec?.name ?? 'O time';
  const val = exec ? (attrs(exec)[spec.attr] ?? 50) : 50;
  const sc = chance(spec.base, val);
  return {
    id: spec.id,
    label: spec.label,
    description: spec.desc,
    successChance: parseFloat(sc.toFixed(2)),
    reward: { ole: spec.ole, exp: spec.exp },
    momentumImpact: spec.momentum,
    scoreOnSuccess: spec.scoreOnSuccess,
    executorId: exec?.playerId,
    executorName: exec?.name,
    successText: spec.successText(name),
    failText: spec.failText(name),
  };
}

export interface SquadDecisionResult {
  moment: QuickInteractiveMoment;
  profile: SquadProfile;
}

/**
 * Monta o moment "squad_decision": 3 botões escolhidos pela paleta que o elenco
 * desbloqueia (criação some se o time não cria; fantasia entra pra time fraco;
 * sempre há ao menos uma opção segura). O menu vira espelho do elenco.
 */
export function buildSquadDecisionMoment(
  players: PitchPlayerState[],
  minute: number,
  nowMs: number,
): SquadDecisionResult {
  const onPitch = players.filter((p) => p.role !== 'gk');
  const profile = computeSquadProfile(players);
  const mean = (profile.creativity + profile.finishing + profile.pace + profile.defense) / 4;

  // Gating RELATIVO: a dimensão FORTE do elenco decide o que aparece (espelho).
  const unlocked = PALETTE.filter((s) => specUnlocked(s, profile, mean)).sort(
    (a, b) => specScore(b, profile, mean) - specScore(a, profile, mean),
  );

  // Top 2 por força relativa + garante 1 opção segura (segurar/chutão/muralha).
  const safeIds = new Set(['segurar', 'chutao', 'muralha']);
  const picked: PaletteSpec[] = [];
  for (const s of unlocked) {
    if (picked.length >= 2) break;
    picked.push(s);
  }
  const hasSafe = picked.some((s) => safeIds.has(s.id));
  if (!hasSafe) {
    const safe = unlocked.find((s) => safeIds.has(s.id)) ?? PALETTE.find((s) => s.id === 'segurar')!;
    picked.push(safe);
  } else {
    const extra = unlocked.find((s) => !picked.includes(s));
    if (extra) picked.push(extra);
  }

  const choices = picked.slice(0, 3).map((s) => buildChoice(s, onPitch));

  // Identidade dominante → texto do contexto.
  const topDim = ([...(['creativity', 'finishing', 'pace', 'defense'] as const)])
    .sort((a, b) => profile[b] - profile[a])[0]!;
  const context = topDim === 'defense'
    ? 'Adversário pressiona — segura ou tenta a resposta?'
    : topDim === 'creativity' || topDim === 'finishing'
      ? 'O time troca passes no campo de ataque — o que fazemos?'
      : 'Bola recuperada — acelera ou controla?';

  return {
    profile,
    moment: {
      id: `squad_${minute}_${nowMs}`,
      minute,
      type: 'squad_decision',
      context,
      choices,
      timeoutMs: 5000,
      triggeredAtMs: nowMs,
    },
  };
}

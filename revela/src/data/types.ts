/**
 * Tipos do REVELA — espelham exatamente o que os RPCs devolvem.
 *
 * Os atributos usam as MESMAS 10 chaves canônicas do jogo (PlayerAttributes em
 * src/entities/types.ts). Não é coincidência nem cópia: a ficha que o OLE SCOUT
 * preenche aqui é a mesma ficha que vira card lá.
 */
import type { PlayerAttributes } from '@/entities/types';

export type RevelaAttributes = Partial<PlayerAttributes>;

/** Status do funil — os 7 passos do "Como Funciona" colapsados em 5 estados. */
export type TalentStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'carded';

export interface Talent {
  id: string;
  slug: string;
  name: string;
  pos: string;
  /**
   * Situação de jogo: escolinha | junior | profissional | lenda.
   * É o único campo do cadastro que a vitrine usa pra saber que o cadastrado é
   * um EX-ATLETA. Opcional porque só chega depois da migration que o incluiu na
   * lista branca das RPCs públicas (20260802140000).
   */
  gameSituation?: string | null;
  club: string | null;
  city: string | null;
  uf: string | null;
  country: string | null;
  birthYear: number | null;
  strongFoot: string | null;
  bio: string | null;
  portrait: string | null;
  video: string | null;
  attributes: RevelaAttributes;
  /** OVR ponderado por posição, calculado no servidor. NUNCA recalcular aqui. */
  overall: number | null;
  status: TalentStatus;
  featured: boolean;
  carded: boolean;
  supporters: number;
  createdAt: string;
}

export interface Legend {
  id: string;
  name: string;
  pos: string;
  club: string | null;
  country: string | null;
  phase: string | null;
  overall: number | null;
  attributes: RevelaAttributes;
  portrait: string;
  focusX: number;
  focusY: number;
  rarity: string | null;
  title: string | null;
  tagline: string | null;
  bio: string | null;
  yearStart: number | null;
  yearEnd: number | null;
  /** Handle da vitrine /playervip, quando a lenda tem uma. */
  handle: string | null;
}

export interface ClubRank {
  rank: number;
  club: string;
  short: string;
  points: number;
  division: number | null;
  played: number;
  wins: number;
  crestId: number | null;
  trend: 'up' | 'down' | 'flat';
}

export interface DivisionCount {
  division: number;
  clubs: number;
}

/** Vocabulário de status do card — cada cor significa uma coisa. */
export type CardStatus = 'new' | 'rising' | 'hot' | 'verified' | 'scouted' | 'card-ready';

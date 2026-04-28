// Tipos compartilhados do sistema de set-pieces (escanteio + falta)

export type SetPieceMode = 'corner' | 'free_kick';
export type SetPieceSide = 'home' | 'away';

export type CornerType = 'short' | 'near_post' | 'far_post';
export type FreeKickType = 'direct_shot' | 'cross' | 'short_pass';

export interface SetPieceTaker {
  id: string;
  displayName: string;
  shirtNumber: number;
  skillRating: number; // atributo relevante (cruzamento p/ corner, finalizacao+passeLongo p/ freekick)
}

export interface SetPieceTarget {
  id: string;
  displayName: string;
  shirtNumber: number;
  /** Cabeceio (corner) ou aproximação (free kick). 0-100 */
  skillRating: number;
  position: 'CB' | 'ST' | 'AM' | 'CM' | 'WG' | string;
}

export interface SetPieceChoice {
  mode: SetPieceMode;
  takerId: string;
  type: CornerType | FreeKickType;
  /** Corredor designado (corner). Opcional. */
  targetId?: string;
  /** Distância da falta ao gol em metros (free kick). */
  distance?: number;
  /** Posição lateral da falta (free kick): center, left, right. */
  zone?: 'center' | 'left' | 'right';
}

export interface SetPieceContext {
  mode: SetPieceMode;
  side: SetPieceSide;
  takers: SetPieceTaker[];
  targets: SetPieceTarget[];
  /** Free kick: distância em metros até o gol. */
  distance?: number;
  /** Free kick: zona lateral. */
  zone?: 'center' | 'left' | 'right';
  /** Corner: lado do campo (esquerdo/direito). */
  cornerSide?: 'left' | 'right';
}

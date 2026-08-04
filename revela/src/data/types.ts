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

/** O que o perfil PÚBLICO mostra do teste. As respostas item a item não saem. */
export interface DnaPublico {
  arquetipo: string;
  tracos: Record<string, number>;
}

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
  /** O sonho, que ele escreve no cadastro. Nunca foi a mesma coisa que a bio. */
  dream?: string | null;
  /**
   * A foto existe mas está esperando o responsável autorizar (atleta menor de
   * idade). Diferente de "não mandou foto": aqui o vazio tem explicação.
   */
  fotoEsperando?: boolean;
  portrait: string | null;
  video: string | null;
  /**
   * TEXTO LIVRE do cadastro — pode ser '@fulano', 'instagram.com/fulano' ou
   * até uma cidade digitada no campo errado. NUNCA usar como href: passar por
   * `perfilInstagram()` primeiro. Só chega no perfil, não na listagem.
   */
  instagram?: string | null;
  /**
   * UM post que o atleta escolheu destacar. Curadoria, não feed: ver o
   * cabeçalho de `embedDoPost` em data/instagram.ts.
   */
  instagramPost?: string | null;
  attributes: RevelaAttributes;
  /**
   * Player DNA — como ele pensa. Null enquanto não fez o teste, e null também
   * enquanto a migration 20260805120000 não estiver aplicada: o bloco some
   * sozinho nos dois casos, que é o comportamento certo pros dois.
   */
  dna?: DnaPublico | null;
  /**
   * De onde veio a ficha. `auto` = gerada no cadastro a partir do que ele
   * declarou + Player DNA; `scout` = um humano olhou e assinou. A vitrine
   * PRECISA mostrar a diferença — ver migration 20260805220000.
   *
   * Opcional porque cadastro anterior à migration não tem o campo; quem lê
   * trata ausência como 'scout', que é o que aquelas fichas de fato são.
   */
  ratingSource?: 'auto' | 'scout' | null;
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

/** Quantos clubes em cada divisão da Liga Global — alimenta o número do hero. */
export interface DivisionCount {
  division: number;
  clubs: number;
}

/** Vocabulário de status do card — cada cor significa uma coisa. */
export type CardStatus = 'new' | 'rising' | 'hot' | 'verified' | 'scouted' | 'card-ready';

/**
 * SMART-PROFILE — a ficha única do jogador OLEFOOT.
 *
 * Plano: https://claude.ai/code/artifact/18040fa8-6f28-42b1-9710-7be74017b365
 *
 * Uma ficha por PAR (dono, jogador): o mesmo Genesis pode estar no elenco de
 * dezenas de managers, e cada cópia evolui do seu jeito. Quem escreve a ficha é
 * o SERVIDOR (tabela `player_profiles` + histórico `player_profile_events`); o
 * jogo só lê. Na Fase 1 os atributos ainda vêm do elenco salvo pelo cliente — a
 * Fase 2 traz a evolução para o servidor.
 *
 * Nomes de campo em português no banco e aqui; o que a pessoa lê tem par PT/EN
 * no cliente (src/smartProfile/rotulos.ts).
 */

export const ATRIBUTOS_NUCLEO = [
  'passe', 'marcacao', 'velocidade', 'drible', 'finalizacao',
  'fisico', 'tatico', 'mentalidade', 'confianca', 'fairPlay',
] as const;
export const ATRIBUTOS_ESPECIALISTA = ['cabeceio', 'bolaParada', 'penalti'] as const;

export type AtributoNucleo = (typeof ATRIBUTOS_NUCLEO)[number];
export type AtributoEspecialista = (typeof ATRIBUTOS_ESPECIALISTA)[number];
export type Atributo = AtributoNucleo | AtributoEspecialista;
export type Atributos = Record<Atributo, number>;

export type Origem = 'genesis' | 'legacy' | 'academia' | 'gacha' | 'revela' | 'bot';
export type Raridade = 'comum' | 'raro' | 'epico' | 'lendario' | 'unico';

export type ClasseId =
  | 'paredao' | 'goleiro_libero'
  | 'xerife' | 'zagueiro_construtor' | 'lateral_apoiador' | 'lateral_marcador'
  | 'volante_destruidor' | 'regista' | 'box_to_box' | 'maestro' | 'meia_chegada'
  | 'ponta_driblador' | 'velocista' | 'pivo' | 'falso_9' | 'matador';

export interface Temperamento {
  /** Arrisca: drible, chute de longe, jogada individual. */
  ousadia: number;
  /** Decide sob pressão: pênalti, final, minuto 90. */
  frieza: number;
  /** Quer jogar, quer crescer, quer mais. */
  ambicao: number;
  /** Vínculo com o clube e o manager. Nasce em 50; cresce com o tempo. */
  lealdade: number;
}

/** Camada 1 — selada no nascimento da ficha. O hash prova que não mudou. */
export interface Genese {
  origem: Origem;
  catalogo: string | null;
  nome: string;
  posicao: string;
  raridade: Raridade;
  atributos: Atributos;
  ovr: number;
  nacionalidade: string | null;
  idade: number | null;
  pe: 'right' | 'left' | 'both' | null;
  nascidaEm: string;
}

export interface Cerebro {
  espacos: number;
  ideias: unknown[];
}

/** Linha de `player_profiles`. */
export interface Ficha {
  owner_id: string;
  player_id: string;
  origem: Origem;
  catalogo: string | null;
  raridade: Raridade;
  genese: Genese;
  genese_hash: string;
  nome: string;
  posicao: string;
  atributos: Atributos;
  ovr: number;
  classe: ClasseId;
  classe_afinidade: ClasseId | null;
  temperamento: Temperamento;
  tracos: unknown[];
  nivel: number;
  xp: number;
  cerebro: Cerebro;
  vinculo: Record<string, unknown>;
  ativo: boolean;
}

export type TipoEvento = 'nasceu' | 'atributos' | 'saiu_do_elenco' | 'voltou_ao_elenco';

export interface Evento {
  owner_id: string;
  player_id: string;
  tipo: TipoEvento;
  dados: Record<string, unknown>;
}

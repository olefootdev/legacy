/**
 * PARTIDA VIVA — tipos compartilhados (docs/PARTIDA-VIVA-PLANO.md).
 *
 * Regra nº 1 do plano: UMA verdade só. O palco nunca decide nada: ele recebe
 * o `QuadroAoVivo` que o `QuickPlanPlayer` emite (o lance JÁ resolvido — com
 * estilo, buff de lenda, formação e momento decisivo aplicados) e desenha.
 */
import type { CadeiaDeLance, MatchPlanEvent } from '@/match/quickPlanTypes';

/** Fases do `QuickPlanPlayer` (espelho de `PlayerPhase`). */
export type FaseDoPlayer =
  | 'playing' | 'beat' | 'halftime' | 'celebration' | 'penalty' | 'forced'
  | 'clutch' | 'sub' | 'shootout' | 'done' | 'leadin';

/** O que a partida está mostrando AGORA — emitido a cada mudança relevante. */
export interface QuadroAoVivo {
  minuto: number;
  fase: FaseDoPlayer;
  placarCasa: number;
  placarFora: number;
  /** 0–100 na perspectiva da casa (curva de momento do plano, já com os empurrões de gol). */
  momento: number;
  /** Lance comum em destaque (null fora de lance). */
  lance: MatchPlanEvent | null;
  /** Gol que acabou de sair (comemoração em curso). */
  gol: { chave: string; nome: string; lado: 'home' | 'away'; actorId?: string; cadeia?: CadeiaDeLance; xg?: number } | null;
  /** Últimas linhas do feed, mais recente primeiro. */
  narracao: { id: string; minuto: number; texto: string }[];
  /** Estilo de jogo atual (dock da Rápida) — o campo reage na hora. */
  estilo?: string;
  /** Decisão em aberto que o manager resolve SEM sair do campo (Fase 4). */
  decisao?: DecisaoNoCampo | null;
  /** LEGACY (Fase 4b): grito valendo (até o minuto `ate`), quando pode gritar de novo, ordens vigentes. */
  grito?: { tipo: string; ate: number } | null;
  gritoLivreEm?: number;
  ordens?: Record<string, string>;
  /** Fase 4c: quem está em campo pela casa (o palco troca a ficha quando muda). */
  emCampo?: string[];
  /** Fase 4c: reservas disponíveis (só no LEGACY) e trocas que ainda cabem. */
  banco?: { id: string; nome: string; pos: string; ovr: number; fadiga: number }[];
  subsRestantes?: number;
  /** Fase 4c: prancheta aberta — o relógio da Rápida está parado. */
  pausado?: boolean;
}

/**
 * Uma decisão da Partida Rápida, trazida pros trilhos. A resposta volta pelo
 * canal (`responder(id)`) e cai na MESMA função que o botão da Rápida chamaria
 * — a verdade não muda de lugar.
 */
export interface DecisaoNoCampo {
  tipo: 'analista' | 'reacao' | 'decisivo' | 'lesao' | 'expulsao';
  /** Chave única da decisão (o palco reinicia o prazo quando muda). */
  chave: string;
  titulo: string;
  texto: string;
  opcoes: { id: string; rotulo: string; detalhe?: string }[];
  /** Prazo em ms (só a reação tem; as outras esperam o manager). */
  prazoMs?: number;
  /** Auxiliar desenhado no campo (Fase 4c): onde está a nossa chance e o perigo deles. */
  corredores?: { nosso: string; perigo: string };
  /** Quem protagoniza (momento decisivo / lesão). */
  protagonista?: string;
}

/** Uma ficha em campo. */
export interface Ficha {
  id: string;
  nome: string;
  /** Iniciais pra quem não tem retrato (nunca foto aleatória). */
  iniciais: string;
  lado: 'home' | 'away';
  /** Slot canônico do catálogo de formações (gol, zag1, mc1, ata…). */
  slot: string;
  /** Retrato real (portraitTokenUrl → portraitUrl) ou null. */
  rosto: string | null;
  /** 0–100 (100 = exausto). */
  fadiga: number;
  /** 0–100, só pra velocidade da ficha. */
  velocidade: number;
  /** Classe do SMART-PROFILE (regista, velocista, matador…) — vem do servidor com o plano. */
  classe?: string;
}

/**
 * Telas grandes que ainda são da Partida Rápida (intervalo, batedor de pênalti,
 * substituição manual, disputa de pênaltis, fim): o palco sai da frente.
 * Analista, reação, momento decisivo e lesão são decididos NOS TRILHOS (Fase 4).
 */
export const FASES_FORA_DO_CAMPO: ReadonlySet<FaseDoPlayer> = new Set([
  'halftime', 'penalty', 'sub', 'shootout', 'done',
]);

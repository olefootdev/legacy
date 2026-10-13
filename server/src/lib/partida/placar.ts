/**
 * UMA VERDADE SÓ (Partida Viva, Fase 0) — o placar a partir dos lances e das
 * escolhas.
 *
 * O motor (server/smartfield/match_simulator.py) emite cada lance com o
 * desfecho JÁ decidido para cada escolha possível do manager: no gol natural,
 * `decisivo.opcoes[opção] = o gol acontece?`; no pênalti da casa,
 * `penalti.por_batedor[batedor] = converteu?`; no pênalti do adversário,
 * `penalti.gol`. O manager escolhe (a opção, o batedor) e o placar É a função
 * destas escolhas sobre estes lances — a mesma função aqui, no aparelho
 * (src/match/QuickPlanPlayer.tsx) e na custódia (../smartProfile/custodia.ts).
 *
 * Este módulo é PURO e sem importações de propósito: o cliente o importa
 * direto do servidor, então a conta do aparelho e a do servidor não podem
 * divergir — e um teste varre as 200 partidas com escolhas aleatórias
 * (scripts/test-uma-verdade.ts) pra provar.
 */

export type LadoDaPartida = 'home' | 'away';

export interface DecisivoDoLance {
  /** opção → o gol acontece? (atacando: converteu; defendendo: não segurou). */
  opcoes: Record<string, boolean>;
  /** A leitura certa (só pra feedback; não entra na conta). */
  melhor?: string;
  /** Atributo nosso × deles por opção — decide a escolha automática (prazo esgotado). */
  duelo?: { por_opcao?: Record<string, [number, number]> };
  /** Fase 4 — LENDA COMO AGENTE: o que o atleta de verdade escolheria (vale sem resposta, antes do duelo). */
  auto?: string;
}

export interface PenaltiDoLance {
  /** Batedor sugerido pelo motor (vale quando o manager não escolhe). */
  batedor?: string;
  /** Casa: desfecho por batedor possível (11 + banco). */
  por_batedor?: Record<string, boolean>;
  /** Fora: o motor decidiu. */
  gol?: boolean;
}

/** Um lance que conta pro placar ou pra nota, como a custódia o guarda. */
export interface LanceDaVerdade {
  /** Minuto. */
  m: number;
  /** goal · penalty · shot · chance · woodwork · save · yellow · red. */
  k: string;
  lado: LadoDaPartida;
  /** Autor (batedor sugerido, no pênalti). */
  a: string | null;
  decisivo?: DecisivoDoLance;
  penalti?: PenaltiDoLance;
}

export interface PlanoDaVerdade {
  modo: 'full' | 'second_half' | 'from_minute';
  minutoInicial: number;
  lances: LanceDaVerdade[];
  /** Curva de momento do plano, do minuto inicial em diante (um valor por minuto). */
  momentum?: number[];
}

/** As escolhas do manager, por minuto do lance. */
export interface Escolhas {
  /** minuto → opção do momento decisivo (chutar/driblar/tocar · cercar/carrinho/combate). */
  decisivos: Record<string, string>;
  /** minuto → id do batedor do pênalti da casa. */
  penaltis: Record<string, string>;
}

export const escolhasVazias = (): Escolhas => ({ decisivos: {}, penaltis: {} });

/** Lances que o resumo da custódia guarda (os que contam pro placar, pra nota ou pro estado). */
export const KINDS_DA_VERDADE: ReadonlySet<string> = new Set(['goal', 'penalty', 'shot', 'chance', 'woodwork', 'save', 'yellow', 'red']);

/**
 * Costura a partida: o plano inteiro primeiro; cada plano seguinte (replan do
 * intervalo ou de um comando) manda do minuto inicial dele em diante. `planos`
 * vem na ORDEM DE EMISSÃO. É a mesma emenda que o aparelho faz
 * (`emendarEventos`, src/match/placarAoVivo.ts): o aparelho só aplica um
 * replan a partir do `start_minute` dele, nunca antes nem depois.
 */
export function costurar(planos: readonly PlanoDaVerdade[]): { lances: LanceDaVerdade[]; momentum: number[] } {
  const full = planos.find((p) => p.modo === 'full');
  let lances: LanceDaVerdade[] = full ? [...full.lances] : [];
  const momentum: number[] = new Array<number>(90).fill(50);
  const pintar = (p: PlanoDaVerdade) => {
    const curva = p.momentum ?? [];
    const base = Math.max(1, p.minutoInicial);
    for (let i = 0; i < curva.length && base - 1 + i < 90; i++) momentum[base - 1 + i] = curva[i]!;
  };
  if (full) pintar(full);
  for (const p of planos) {
    if (p === full || p.modo === 'full') continue;
    lances = [...lances.filter((l) => l.m < p.minutoInicial), ...p.lances];
    pintar(p);
  }
  return { lances, momentum };
}

/**
 * A escolha do jogador quando o manager não decide a tempo (LEGACY, prazo de
 * 10 s): a do atleta, se for uma lenda com preferência (`auto`, Fase 4); senão
 * a opção com a maior vantagem no duelo; empate, a primeira. Sem duelo,
 * a primeira opção. É regra, não sorteio — e vale igual no aparelho e aqui.
 */
export function escolhaAutomatica(d: DecisivoDoLance): string {
  const opcoes = Object.keys(d.opcoes);
  // A lenda decide como o atleta dela decidiria (o motor só manda `auto` com preferência clara).
  if (d.auto && opcoes.includes(d.auto)) return d.auto;
  let melhor = opcoes[0] ?? '';
  let vantagem = -Infinity;
  for (const k of opcoes) {
    const par = d.duelo?.por_opcao?.[k];
    const v = par ? par[0] - par[1] : 0;
    if (v > vantagem) { vantagem = v; melhor = k; }
  }
  return melhor;
}

/** O batedor do pênalti da casa dado o lance e a escolha (sem escolha: o sugerido). */
export function batedorDoPenalti(l: LanceDaVerdade, escolhas: Escolhas): string | null {
  const escolhido = escolhas.penaltis[String(l.m)];
  const tabela = l.penalti?.por_batedor;
  if (escolhido && tabela && escolhido in tabela) return escolhido;
  return l.penalti?.batedor ?? l.a;
}

/**
 * O gol deste lance acontece? É a única porta: o aparelho e a custódia só
 * contam gol por aqui.
 *   - gol natural com `decisivo`: o desfecho da opção escolhida (ou da automática);
 *   - gol sem `decisivo` (plano antigo): vale o gol do motor;
 *   - pênalti da casa: o desfecho do batedor escolhido (sem tabela: vale o gol,
 *     que é o desfecho mais provável de um pênalti);
 *   - pênalti do adversário: o que o motor decidiu.
 */
export function golDoLance(l: LanceDaVerdade, escolhas: Escolhas): boolean {
  if (l.k === 'goal') {
    const d = l.decisivo;
    if (!d || !Object.keys(d.opcoes).length) return true;
    const escolha = escolhas.decisivos[String(l.m)];
    const key = escolha && escolha in d.opcoes ? escolha : escolhaAutomatica(d);
    return d.opcoes[key] === true;
  }
  if (l.k === 'penalty') {
    if (l.lado === 'away') return l.penalti?.gol === true;
    const tabela = l.penalti?.por_batedor;
    if (!tabela) return true;
    const b = batedorDoPenalti(l, escolhas);
    return b != null && tabela[b] === true;
  }
  return false;
}

export interface ContaDaPartida {
  placar: [number, number];
  /** Gols por autor (casa e fora). */
  gols: Record<string, number>;
  /** Finalizações por autor, na mesma régua da nota do aparelho (chute, chance, trave e gol; defesa não conta). */
  chutes: Record<string, number>;
  /** Amarelos por lado. */
  cartoes: { home: number; away: number };
  /** Expulsos por lado. */
  expulsos: { home: number; away: number };
  /** Quem foi expulso (o replan não pode devolvê-lo ao campo) e quem já tem amarelo (o 2º é vermelho). */
  expulsosIds: string[];
  amareladosIds: string[];
}

/**
 * A conta da partida até `ateMinuto` (exclusivo; ausente = inteira): placar,
 * gols e finalizações por jogador, cartões e expulsos. Espelha o que o
 * aparelho tabula lance a lance (`QuickPlanPlayer`: tally).
 */
export function contarPartida(lances: readonly LanceDaVerdade[], escolhas: Escolhas, ateMinuto?: number): ContaDaPartida {
  const out: ContaDaPartida = { placar: [0, 0], gols: {}, chutes: {}, cartoes: { home: 0, away: 0 }, expulsos: { home: 0, away: 0 }, expulsosIds: [], amareladosIds: [] };
  const mais = (r: Record<string, number>, id: string | null) => { if (id) r[id] = (r[id] ?? 0) + 1; };
  for (const l of lances) {
    if (ateMinuto !== undefined && l.m >= ateMinuto) continue;
    if (l.k === 'goal' || l.k === 'penalty') {
      if (!golDoLance(l, escolhas)) continue;
      const autor = l.k === 'penalty' && l.lado === 'home' ? batedorDoPenalti(l, escolhas) : l.a;
      out.placar[l.lado === 'home' ? 0 : 1] += 1;
      mais(out.gols, autor);
      mais(out.chutes, autor);
    } else if (l.k === 'shot' || l.k === 'chance' || l.k === 'woodwork') {
      mais(out.chutes, l.a);
    } else if (l.k === 'yellow') {
      out.cartoes[l.lado] += 1;
      if (l.a && !out.amareladosIds.includes(l.a)) out.amareladosIds.push(l.a);
    } else if (l.k === 'red') {
      out.expulsos[l.lado] += 1;
      if (l.a && !out.expulsosIds.includes(l.a)) out.expulsosIds.push(l.a);
    }
  }
  return out;
}

/** Converte um evento do plano (como o motor emite) num lance da verdade; null se não conta. */
export function lanceDoEvento(e: {
  kind?: unknown; minute?: unknown; actor_id?: unknown; decisivo?: unknown; penalti?: unknown;
}): LanceDaVerdade | null {
  const kind = String(e.kind ?? '');
  const m = /^(.+)_(home|away)$/.exec(kind);
  if (!m) return null;
  const base = m[1]!;
  if (!KINDS_DA_VERDADE.has(base)) return null;
  const lance: LanceDaVerdade = {
    m: Number(e.minute) || 0, k: base, lado: m[2] as LadoDaPartida,
    a: typeof e.actor_id === 'string' ? e.actor_id : null,
  };
  const d = e.decisivo as DecisivoDoLance | undefined;
  if (base === 'goal' && d && d.opcoes && typeof d.opcoes === 'object') {
    lance.decisivo = { opcoes: { ...d.opcoes }, ...(d.melhor ? { melhor: d.melhor } : {}),
      ...(d.duelo?.por_opcao ? { duelo: { por_opcao: { ...d.duelo.por_opcao } } } : {}),
      ...(typeof d.auto === 'string' && d.auto in d.opcoes ? { auto: d.auto } : {}) };
  }
  const p = e.penalti as PenaltiDoLance | undefined;
  if (base === 'penalty' && p && typeof p === 'object') {
    lance.penalti = { ...(p.batedor ? { batedor: p.batedor } : {}),
      ...(p.por_batedor ? { por_batedor: { ...p.por_batedor } } : {}),
      ...(typeof p.gol === 'boolean' ? { gol: p.gol } : {}) };
  }
  return lance;
}

/** Lê escolhas vindas de fora (relato, replan): só chaves de minuto e valores curtos. */
export function lerEscolhas(raw: unknown): Escolhas {
  const out = escolhasVazias();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  const ler = (campo: 'decisivos' | 'penaltis', max: number) => {
    const v = r[campo];
    if (!v || typeof v !== 'object') return;
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const minuto = Number(k);
      if (!Number.isInteger(minuto) || minuto < 1 || minuto > 90) continue;
      if (typeof val !== 'string' || !val || val.length > max) continue;
      out[campo][String(minuto)] = val;
    }
  };
  ler('decisivos', 16);
  ler('penaltis', 120);
  return out;
}

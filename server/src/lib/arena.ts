/**
 * O FILME COMO ARENA (Partida Viva, Fase 4; docs/raio-x-partida-viva.html) — a conta.
 *
 * "Assumir o lance": um manager pega o filme de outro (ou da própria lenda),
 * escolhe um minuto e joga dali com as próprias ordens e os MESMOS dados. O
 * motor (server/smartfield/arena.py) devolve dois planos a partir do mesmo
 * estado: `voce` (com as ordens) e `parado` (banco calado). Aqui, PURO e sem
 * banco, a régua das três respostas:
 *
 *   - ELE FEZ:   o que o dono do filme fez do minuto em diante — contado pela
 *                custódia (planos emitidos + as escolhas que o filme carrega),
 *                com a mesma `contarPartida` do placar. Filme que não bate com
 *                a custódia não vira arena.
 *   - VOCÊ FEZ:  o plano `voce` + as SUAS escolhas nos momentos decisivos.
 *   - PARADO:    o plano `parado` + a escolha automática (ninguém no banco).
 *
 * O saldo é quanto você melhorou o saldo de gols do time, dali em diante,
 * em relação ao dono do filme. É ele que entra no ranking semanal.
 */
import {
  contarPartida, costurar, escolhaAutomatica, escolhasVazias, lanceDoEvento,
  type Escolhas, type LanceDaVerdade, type PlanoDaVerdade,
} from './partida/placar.js';

/** O minuto mais tarde em que dá pra assumir (precisa sobrar jogo). */
export const MINUTO_MAX_DA_ARENA = 85;
/** Uma tentativa por filme por manager: o desafio é de um tiro só. */
export const TENTATIVAS_POR_FILME = 1;

/** O que a custódia guarda de cada plano emitido (só o que a arena usa). */
export interface PlanoGuardado extends PlanoDaVerdade {
  /** O pedido que foi ao motor (Fase 4): sem ele, a partida não vira arena. */
  entrada?: Record<string, unknown>;
}

export type Placar = [number, number];

/** O plano em vigor num minuto: o último emitido que já começou (ordem de emissão). */
export function planoEmVigor<T extends PlanoGuardado>(planos: readonly T[], minuto: number): T | null {
  let vigente: T | null = null;
  for (const p of planos) {
    const inicio = p.modo === 'full' ? 1 : p.minutoInicial;
    if (inicio <= minuto) vigente = p;
  }
  return vigente;
}

export interface OQueEleFez {
  /** Placar quando você assume (antes do minuto). */
  noMinuto: Placar;
  /** Placar final do filme. */
  final: Placar;
  /** Estado do jogo no minuto (vai ao motor como `estado` do replan). */
  estado: {
    home_score: number; away_score: number; momentum_end: number;
    cards_home: number; cards_away: number; sent_off_home: number; sent_off_away: number;
    expulsos: string[]; amarelados: string[];
  };
}

/**
 * O que o dono fez, pela custódia. `placarDoFilme` é o placar que o filme diz:
 * se a custódia (planos + escolhas do filme) não chega nele, devolve null — o
 * filme não é a verdade e não vira arena.
 */
export function oQueEleFez(planos: readonly PlanoDaVerdade[], escolhas: Escolhas, minuto: number, placarDoFilme: Placar): OQueEleFez | null {
  const { lances, momentum } = costurar(planos);
  const final = contarPartida(lances, escolhas);
  if (final.placar[0] !== placarDoFilme[0] || final.placar[1] !== placarDoFilme[1]) return null;
  const ate = contarPartida(lances, escolhas, minuto);
  return {
    noMinuto: [ate.placar[0], ate.placar[1]],
    final: [final.placar[0], final.placar[1]],
    estado: {
      home_score: ate.placar[0], away_score: ate.placar[1],
      // O momento de quando você pega o jogo (o minuto anterior ao assumido).
      momentum_end: momentum[Math.max(0, minuto - 2)] ?? 50,
      cards_home: ate.cartoes.home, cards_away: ate.cartoes.away,
      sent_off_home: ate.expulsos.home, sent_off_away: ate.expulsos.away,
      expulsos: ate.expulsosIds, amarelados: ate.amareladosIds.filter((id) => !ate.expulsosIds.includes(id)),
    },
  };
}

/** Os lances da verdade de um plano do motor (o que conta pro placar). */
export function lancesDoPlano(plano: { events?: Array<Record<string, unknown>> } | null | undefined): LanceDaVerdade[] {
  const out: LanceDaVerdade[] = [];
  for (const e of plano?.events ?? []) {
    const l = lanceDoEvento(e);
    if (l) out.push(l);
  }
  return out;
}

/** O placar final de um plano da arena: o do minuto + o que o plano decidiu com estas escolhas. */
export function placarDaArena(noMinuto: Placar, lances: readonly LanceDaVerdade[], escolhas: Escolhas): Placar {
  const c = contarPartida(lances, escolhas);
  return [noMinuto[0] + c.placar[0], noMinuto[1] + c.placar[1]];
}

/** Um momento em que quem assumiu escolhe — SEM o desfecho (ele só aparece depois de fechar). */
export type MomentoDaArena =
  | { tipo: 'decisivo'; m: number; intent: 'attack' | 'defend'; contexto: string; opcoes: string[];
      duelo: { nosso: { id: string; nome: string }; deles: { id: string; nome: string }; por_opcao: Record<string, [number, number]> };
      auto: string }
  | { tipo: 'penalti'; m: number; sugerido: string | null; batedores: string[] };

/** Os momentos de escolha do plano `voce`, sem desfecho: é o que vai ao aparelho antes de fechar. */
export function momentosSemDesfecho(plano: { events?: Array<Record<string, unknown>> } | null | undefined): MomentoDaArena[] {
  const out: MomentoDaArena[] = [];
  for (const e of plano?.events ?? []) {
    const l = lanceDoEvento(e);
    if (!l) continue;
    if (l.k === 'goal' && l.decisivo && Object.keys(l.decisivo.opcoes).length) {
      const d = e.decisivo as { intent?: string; contexto?: string; duelo?: { nosso?: { id?: string; nome?: string }; deles?: { id?: string; nome?: string } } };
      out.push({
        tipo: 'decisivo', m: l.m, intent: d.intent === 'defend' ? 'defend' : 'attack', contexto: String(d.contexto ?? ''),
        opcoes: Object.keys(l.decisivo.opcoes),
        duelo: {
          nosso: { id: String(d.duelo?.nosso?.id ?? ''), nome: String(d.duelo?.nosso?.nome ?? '') },
          deles: { id: String(d.duelo?.deles?.id ?? ''), nome: String(d.duelo?.deles?.nome ?? '') },
          por_opcao: { ...(l.decisivo.duelo?.por_opcao ?? {}) },
        },
        auto: escolhaAutomatica(l.decisivo),
      });
    } else if (l.k === 'penalty' && l.lado === 'home' && l.penalti?.por_batedor) {
      out.push({ tipo: 'penalti', m: l.m, sugerido: l.penalti.batedor ?? l.a, batedores: Object.keys(l.penalti.por_batedor) });
    }
  }
  return out;
}

/** Só as escolhas dos momentos que existem no plano (o resto é lixo do aparelho). */
export function escolhasValidas(momentos: readonly MomentoDaArena[], escolhas: Escolhas): Escolhas {
  const out = escolhasVazias();
  for (const mo of momentos) {
    const k = String(mo.m);
    if (mo.tipo === 'decisivo' && escolhas.decisivos[k] && mo.opcoes.includes(escolhas.decisivos[k]!)) out.decisivos[k] = escolhas.decisivos[k]!;
    if (mo.tipo === 'penalti' && escolhas.penaltis[k] && mo.batedores.includes(escolhas.penaltis[k]!)) out.penaltis[k] = escolhas.penaltis[k]!;
  }
  return out;
}

export interface VereditoDaArena {
  minuto: number;
  noMinuto: Placar;
  ele: Placar;
  voce: Placar;
  parado: Placar;
  /** (saldo de gols seu dali em diante) − (o dele). Positivo = você fez melhor. */
  saldo: number;
  /** (o seu) − (o do banco calado): quanto as SUAS ordens e escolhas valeram. */
  contraParado: number;
}

export function veredito(minuto: number, noMinuto: Placar, ele: Placar, voce: Placar, parado: Placar): VereditoDaArena {
  const dali = (p: Placar) => (p[0] - noMinuto[0]) - (p[1] - noMinuto[1]);
  return { minuto, noMinuto, ele, voce, parado, saldo: dali(voce) - dali(ele), contraParado: dali(voce) - dali(parado) };
}

/**
 * LENDA COMO AGENTE: quando quem assume é o ATLETA de uma lenda, as escolhas
 * dele nos momentos da lenda viram a preferência dela (lenda → opção → vezes).
 */
export function escolhasDaLenda(momentos: readonly MomentoDaArena[], escolhas: Escolhas, lendas: readonly string[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const mo of momentos) {
    if (mo.tipo !== 'decisivo' || !lendas.includes(mo.duelo.nosso.id)) continue;
    const opcao = escolhas.decisivos[String(mo.m)];
    if (!opcao || !mo.opcoes.includes(opcao)) continue;
    const id = mo.duelo.nosso.id;
    out[id] = { ...(out[id] ?? {}), [opcao]: (out[id]?.[opcao] ?? 0) + 1 };
  }
  return out;
}

/** Soma as preferências de várias tentativas (o que vai ao motor como `agentes`). */
export function somarPreferencias(listas: ReadonlyArray<Record<string, Record<string, number>> | null | undefined>, ids?: readonly string[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const l of listas) {
    for (const [id, cont] of Object.entries(l ?? {})) {
      if (ids && !ids.includes(id)) continue;
      for (const [op, n] of Object.entries(cont ?? {})) {
        if (!Number.isFinite(n) || n <= 0) continue;
        out[id] = { ...(out[id] ?? {}), [op]: (out[id]?.[op] ?? 0) + Math.floor(n) };
      }
    }
  }
  return out;
}

/** A semana do ranking = a temporada da LEGACY League (segunda a domingo, UTC: '2026-W42'). */
export { temporadaDe as semanaDe } from './legacyLeague.js';

export interface LinhaDoRanking { desafiante: string; pontos: number; tentativas: number; melhor: number }

/**
 * Ranking da semana: soma do saldo de cada tentativa (só o que é positivo
 * pontua — perder pro dono do filme não tira ponto, mas não soma), desempate
 * por menos tentativas e depois pelo melhor saldo.
 */
export function rankingDaSemana(tentativas: ReadonlyArray<{ desafiante: string; saldo: number }>): LinhaDoRanking[] {
  const por = new Map<string, LinhaDoRanking>();
  for (const t of tentativas) {
    const l = por.get(t.desafiante) ?? { desafiante: t.desafiante, pontos: 0, tentativas: 0, melhor: -Infinity };
    l.pontos += Math.max(0, t.saldo);
    l.tentativas += 1;
    l.melhor = Math.max(l.melhor, t.saldo);
    por.set(t.desafiante, l);
  }
  return [...por.values()].sort((a, b) => b.pontos - a.pontos || a.tentativas - b.tentativas || b.melhor - a.melhor);
}

/** O pedido do motor guardado na custódia: só o que reproduz a partida (sem estado de replan nem prova). */
export function entradaDoMotor(body: Record<string, unknown>): Record<string, unknown> {
  const fica = ['seed', 'home_short', 'away_short', 'home_team', 'away_team', 'is_derby', 'fantasma', 'classes', 'comandos', 'agentes', 'plano_fora'];
  const out: Record<string, unknown> = {};
  for (const k of fica) if (body[k] !== undefined) out[k] = body[k];
  return out;
}

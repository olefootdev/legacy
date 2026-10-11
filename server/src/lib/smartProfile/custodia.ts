/**
 * CUSTÓDIA DO PLANO — o servidor guarda o plano da Partida Rápida que emitiu
 * e confere se o resultado relatado pelo celular É o que os planos decidiram.
 *
 * Fase 2B (até 10/10): conferia um TETO ("gols ≤ lances de ataque"), porque o
 * celular convertia quase-gol em gol por sorteio (estilo, lenda, formação,
 * momento decisivo, reações).
 *
 * UMA VERDADE SÓ (Partida Viva, Fase 0): o celular não decide mais nada. O
 * motor emite cada desfecho possível (momento decisivo por opção, pênalti por
 * batedor) e o celular só ESCOLHE. O relato traz as escolhas; o servidor
 * recalcula o placar com a mesma função do aparelho (../partida/placar.ts) e
 * exige igualdade EXATA: placar, gols e finalizações de cada titular.
 *
 * O que a custódia garante:
 *   - a partida veio de planos que o servidor emitiu PARA ESTE manager;
 *   - cada plano credita uma vez só (sem repetir evolução);
 *   - os titulares relatados são os da escalação (ou do banco) que foi ao motor;
 *   - o placar e os números por jogador são exatamente os dos planos + escolhas;
 *   - as escolhas declaradas em cada replan batem com as do relato.
 */
import { ovrDe } from './ovr.js';
import { atributosCompletos } from './derivar.js';
import {
  contarPartida, costurar, escolhasVazias, lanceDoEvento,
  type Escolhas, type LanceDaVerdade, type PlanoDaVerdade,
} from '../partida/placar.js';

export type { Escolhas, LanceDaVerdade } from '../partida/placar.js';

export interface ResumoDoPlano extends PlanoDaVerdade {
  escalacao: string[];
  /** Reservas enviados com o pedido (quem entra do banco também pode marcar). */
  banco?: string[];
  /** Replan: as escolhas que o celular declarou ao pedir (o estado foi derivado delas). */
  escolhas_declaradas?: Escolhas;
  /** Replan: de onde veio o estado inicial — da custódia (derivado) ou do celular (sem cadeia). */
  estado_fonte?: 'custodia' | 'celular';
  /** Conferência da Fase 3 (plano.ts). Ausente em plano emitido antes dela. */
  conferencia?: { conferidos: number; sem_ficha: number; corrigidos: number; preenchidos?: number; motivos: string[] };
}

/** O que o servidor guarda de cada plano emitido: só o que a validação e a derivação de estado usam. */
export function resumirPlano(
  plano: unknown,
  escalacaoCasa: string[],
  extras: { banco?: string[]; escolhasDeclaradas?: Escolhas; estadoFonte?: 'custodia' | 'celular' } = {},
): ResumoDoPlano {
  const p = (plano ?? {}) as { mode?: string; start_minute?: number; events?: Array<Record<string, unknown>>; momentum_curve?: unknown };
  const lances: LanceDaVerdade[] = [];
  for (const e of p.events ?? []) {
    const l = lanceDoEvento(e);
    if (l) lances.push(l);
  }
  const modo = p.mode === 'second_half' || p.mode === 'from_minute' ? p.mode : 'full';
  const momentum = Array.isArray(p.momentum_curve)
    ? p.momentum_curve.slice(0, 90).map((v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : 50))
    : undefined;
  return {
    modo, minutoInicial: Number(p.start_minute) || 0,
    escalacao: escalacaoCasa.slice(0, 30), lances, momentum,
    ...(extras.banco?.length ? { banco: extras.banco.slice(0, 12) } : {}),
    ...(extras.escolhasDeclaradas ? { escolhas_declaradas: extras.escolhasDeclaradas } : {}),
    ...(extras.estadoFonte ? { estado_fonte: extras.estadoFonte } : {}),
  };
}

/** A partida costurada (ver `costurar`): só os lances. */
export function lancesDaPartida(planos: readonly PlanoDaVerdade[]): LanceDaVerdade[] {
  return costurar(planos).lances;
}

/** Nota da partida — cópia de `matchRating` sem contexto (src/match/QuickPlanPlayer.tsx). */
export function notaDaPartida(ovr: number, gols: number, chutes: number): number {
  const base = 6.0 + (ovr - 60) / 50;
  return Math.max(5.0, Math.min(9.9, base + gols * 0.9 + chutes * 0.12));
}

export interface JogadorRelatado { id: string; pos: string; attrsAntes: Record<string, unknown>; nota: number; gols: number; chutes: number }
export interface Veredito {
  custodia: 'valida' | 'suspeita';
  motivos: string[];
  /** O placar que os planos + escolhas decidiram — é este que vale, não o relatado. */
  placar: [number, number];
}

/**
 * O estado da partida num minuto, derivado da cadeia de planos + escolhas:
 * é o que o servidor usa como ponto de partida de um replan, no lugar do que
 * o celular diz. `momentum_end` é o momento do minuto em que o comando foi
 * dado (o replan começa 3 minutos depois; no intervalo, o do 45').
 */
export function estadoNoMinuto(planos: readonly PlanoDaVerdade[], escolhas: Escolhas, modo: 'second_half' | 'from_minute', fromMinute: number) {
  const { lances, momentum } = costurar(planos);
  const inicio = modo === 'second_half' ? 46 : fromMinute;
  const conta = contarPartida(lances, escolhas, inicio);
  const minutoDoComando = modo === 'second_half' ? 45 : Math.max(1, fromMinute - 3);
  return {
    home_score: conta.placar[0], away_score: conta.placar[1],
    momentum_end: momentum[minutoDoComando - 1] ?? 50,
    cards_home: conta.cartoes.home, cards_away: conta.cartoes.away,
    sent_off_home: conta.expulsos.home, sent_off_away: conta.expulsos.away,
  };
}

export function validarRelato(
  relato: { placar: [number, number]; escolhas?: Escolhas; jogadores: JogadorRelatado[] },
  planos: ResumoDoPlano[],
): Veredito {
  const motivos: string[] = [];
  const escolhas = relato.escolhas ?? escolhasVazias();

  // FASE 3: o plano que alimentou esta partida nasceu de número adulterado? O
  // servidor já cortou na emissão, mas a partida não é limpa — fica registrado.
  for (const p of planos) {
    const corrigidos = p.conferencia?.corrigidos ?? 0;
    if (corrigidos > 0) motivos.push(`plano emitido com ${corrigidos} titular(es) fora da ficha (atributo cortado pelo servidor)`);
  }

  const { lances } = costurar(planos);
  const conta = contarPartida(lances, escolhas);

  // PLACAR: exatamente o que os planos decidiram dadas as escolhas.
  if (relato.placar[0] !== conta.placar[0] || relato.placar[1] !== conta.placar[1]) {
    motivos.push(`placar relatado ${relato.placar[0]}×${relato.placar[1]} difere do recalculado ${conta.placar[0]}×${conta.placar[1]}`);
  }

  // ESCOLHAS: cada escolha tem de ser uma opção que o lance oferecia.
  for (const l of lances) {
    if (l.k === 'goal' && l.decisivo) {
      const e = escolhas.decisivos[String(l.m)];
      if (e && !(e in l.decisivo.opcoes)) motivos.push(`${l.m}': opção "${e}" não existia no momento decisivo`);
    }
    if (l.k === 'penalty' && l.lado === 'home' && l.penalti?.por_batedor) {
      const b = escolhas.penaltis[String(l.m)];
      if (b && !(b in l.penalti.por_batedor)) motivos.push(`${l.m}': batedor ${b} não estava na tabela do pênalti`);
    }
  }

  // REPLANS: as escolhas declaradas ao pedir cada replan têm de ser as mesmas
  // do relato (para os minutos anteriores ao replan) — senão o replan partiu
  // de um estado falso.
  for (const p of planos) {
    const d = p.escolhas_declaradas;
    if (!d || p.modo === 'full') continue;
    const campos: Array<'decisivos' | 'penaltis'> = ['decisivos', 'penaltis'];
    for (const campo of campos) {
      for (const [minuto, valor] of Object.entries(d[campo] ?? {})) {
        if (Number(minuto) >= p.minutoInicial) continue;
        if (escolhas[campo][minuto] !== valor) motivos.push(`replan do ${p.minutoInicial}' declarou escolha "${valor}" no ${minuto}' e o relato diz "${escolhas[campo][minuto] ?? '—'}"`);
      }
    }
  }

  // TITULARES: na escalação (ou no banco) que foi ao motor; gols e finalizações
  // exatamente os recalculados; nota pela fórmula.
  const escalados = new Set(planos.flatMap((p) => [...p.escalacao, ...(p.banco ?? [])]));
  for (const j of relato.jogadores) {
    if (escalados.size && !escalados.has(j.id)) motivos.push(`${j.id} não estava na escalação enviada ao motor`);
    const gols = conta.gols[j.id] ?? 0;
    const chutes = conta.chutes[j.id] ?? 0;
    if (j.gols !== gols) motivos.push(`${j.id} com ${j.gols} gol(s) relatado(s) e ${gols} recalculado(s)`);
    if (j.chutes !== chutes) motivos.push(`${j.id} com ${j.chutes} finalização(ões) relatada(s) e ${chutes} recalculada(s)`);
    const ovr = ovrDe(atributosCompletos(j.attrsAntes, j.pos), j.pos);
    const esperada = notaDaPartida(ovr, gols, chutes);
    if (Math.abs(esperada - j.nota) > 1e-9) motivos.push(`${j.id} com nota ${j.nota} (a fórmula dá ${esperada.toFixed(2)})`);
  }

  return { custodia: motivos.length ? 'suspeita' : 'valida', motivos: motivos.slice(0, 20), placar: conta.placar };
}

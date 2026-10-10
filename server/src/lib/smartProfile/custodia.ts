/**
 * CUSTÓDIA DO PLANO (Fase 2B) — o servidor guarda o plano da Partida Rápida que
 * entregou e confere se o resultado relatado pelo celular cabe nele.
 *
 * O que a custódia garante (forte):
 *   - a partida veio de um plano que o servidor emitiu PARA ESTE manager;
 *   - cada plano credita uma vez só (sem repetir evolução);
 *   - os titulares relatados são os da escalação que foi ao motor.
 * O que ela confere (plausibilidade): o placar e os gols de cada jogador cabem
 * nos lances do plano. Não é o placar EXATO: escolhas do manager durante o jogo
 * (momento decisivo, leitura do analista, estilo ao vivo, lenda, formação)
 * podem converter quase-gols em gols, sorteados pela seed no celular. O placar
 * exato — o servidor refazendo cada escolha — é a Fase 2C.
 */
import { ovrDe } from './ovr.js';
import { atributosCompletos } from './derivar.js';

/** Lances que o celular pode transformar em gol (direto ou por escolha). */
const LANCE_DE_ATAQUE = new Set(['goal', 'shot', 'chance', 'save', 'woodwork', 'counter', 'corner', 'buildup']);

export interface LanceResumido { k: string; lado: 'home' | 'away'; a: string | null; m: number; d: boolean }
export interface ResumoDoPlano {
  modo: 'full' | 'second_half' | 'from_minute';
  minutoInicial: number;
  escalacao: string[];
  lances: LanceResumido[];
  /** Conferência da Fase 3 (plano.ts). Ausente em plano emitido antes dela. */
  conferencia?: { conferidos: number; sem_ficha: number; corrigidos: number; preenchidos?: number; motivos: string[] };
}

/** O que o servidor guarda de cada plano emitido: só o que a validação usa. */
export function resumirPlano(plano: unknown, escalacaoCasa: string[]): ResumoDoPlano {
  const p = (plano ?? {}) as { mode?: string; start_minute?: number; events?: Array<Record<string, unknown>> };
  const lances: LanceResumido[] = [];
  for (const e of p.events ?? []) {
    const kind = String(e.kind ?? '');
    const m = /^(.+)_(home|away)$/.exec(kind);
    if (!m) continue;
    const base = m[1]!;
    if (!LANCE_DE_ATAQUE.has(base) && base !== 'penalty') continue;
    lances.push({ k: base, lado: m[2] as 'home' | 'away', a: typeof e.actor_id === 'string' ? e.actor_id : null,
      m: Number(e.minute) || 0, d: e.decision_influenced === true });
  }
  const modo = p.mode === 'second_half' || p.mode === 'from_minute' ? p.mode : 'full';
  return { modo, minutoInicial: Number(p.start_minute) || 0,
    escalacao: escalacaoCasa.slice(0, 30), lances };
}

/**
 * Costura a partida: o plano inteiro primeiro; cada plano seguinte (replan do
 * intervalo ou de um comando do LEGACY) manda do minuto inicial dele em diante.
 * `planos` vem na ORDEM DE EMISSÃO (a do relato do celular). O celular nunca
 * pede, no 1º tempo, replan que comece depois do 45' — então emissão e minuto
 * andam juntos e o replan do intervalo não é atropelado.
 */
export function lancesDaPartida(planos: ResumoDoPlano[]): LanceResumido[] {
  const full = planos.find((p) => p.modo === 'full');
  const depois = planos.filter((p) => p !== full);
  let lances = full ? full.lances : [];
  for (const p of depois) lances = [...lances.filter((l) => l.m < p.minutoInicial), ...p.lances];
  return lances;
}

/** Nota da partida — cópia de `matchRating` sem contexto (src/match/QuickPlanPlayer.tsx). */
export function notaDaPartida(ovr: number, gols: number, chutes: number): number {
  const base = 6.0 + (ovr - 60) / 50;
  return Math.max(5.0, Math.min(9.9, base + gols * 0.9 + chutes * 0.12));
}

export interface JogadorRelatado { id: string; pos: string; attrsAntes: Record<string, unknown>; nota: number; gols: number; chutes: number }
export interface Veredito { custodia: 'valida' | 'suspeita'; motivos: string[] }

export function validarRelato(
  relato: { placar: [number, number]; jogadores: JogadorRelatado[] },
  planos: ResumoDoPlano[],
): Veredito {
  const motivos: string[] = [];

  // FASE 3: o plano que alimentou esta partida nasceu de número adulterado? O
  // servidor já cortou na emissão, mas a partida não é limpa — fica registrado.
  for (const p of planos) {
    const corrigidos = p.conferencia?.corrigidos ?? 0;
    if (corrigidos > 0) motivos.push(`plano emitido com ${corrigidos} titular(es) fora da ficha (atributo cortado pelo servidor)`);
  }

  const lances = lancesDaPartida(planos);
  const casa = lances.filter((l) => l.lado === 'home');
  const fora = lances.filter((l) => l.lado === 'away');

  // Placar: a casa não faz mais gols do que lances de ataque + pênaltis que teve.
  const maxCasa = casa.length;
  if (relato.placar[0] > maxCasa) motivos.push(`placar da casa ${relato.placar[0]} acima do possível no plano (${maxCasa})`);
  // Mínimo de gols do adversário: hoje todo gol natural dele vira momento
  // decisivo (pode ser salvo), então o plano não garante nenhum. Só o máximo vale.
  if (relato.placar[1] > fora.length) motivos.push(`placar do adversário ${relato.placar[1]} acima do possível no plano (${fora.length})`);

  // Titulares: têm que estar na escalação que foi ao motor.
  const escalados = new Set(planos.flatMap((p) => p.escalacao));
  const penaltisCasa = casa.filter((l) => l.k === 'penalty').length;
  let golsDeJogadores = 0;
  for (const j of relato.jogadores) {
    if (escalados.size && !escalados.has(j.id)) motivos.push(`${j.id} não estava na escalação enviada ao motor`);
    // Gols de um jogador: lances de ataque dele + pênaltis (qualquer um pode bater).
    const chances = casa.filter((l) => l.a === j.id && l.k !== 'penalty').length;
    if (j.gols > chances + penaltisCasa) motivos.push(`${j.id} com ${j.gols} gol(s) e só ${chances + penaltisCasa} chance(s) no plano`);
    if (j.chutes < j.gols) motivos.push(`${j.id} com mais gols que chutes`);
    golsDeJogadores += j.gols;
    // Nota: tem que ser a que a fórmula dá para o OVR de antes e os gols/chutes relatados.
    const ovr = ovrDe(atributosCompletos(j.attrsAntes, j.pos), j.pos);
    const esperada = notaDaPartida(ovr, j.gols, j.chutes);
    if (Math.abs(esperada - j.nota) > 1e-9) motivos.push(`${j.id} com nota ${j.nota} (a fórmula dá ${esperada.toFixed(2)})`);
  }
  if (golsDeJogadores > relato.placar[0]) motivos.push(`titulares somam ${golsDeJogadores} gols e o placar tem ${relato.placar[0]}`);

  return { custodia: motivos.length ? 'suspeita' : 'valida', motivos: motivos.slice(0, 20) };
}

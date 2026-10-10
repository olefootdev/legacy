/**
 * PARTIDA VIVA — cronograma de uma jogada contada (Fase 2).
 *
 * Quanto tempo cada ação leva depende da distância: passe voa rápido, condução
 * e drible vão no passo de quem corre com a bola. É função pura — o coreógrafo
 * usa pra agendar, e a Partida Rápida usa pra saber quanto segurar o lance na
 * tela (`segurarLance`), sem mexer no desfecho.
 */
import type { AcaoDeLance, CadeiaDeLance } from '@/match/quickPlanTypes';

const VOA = new Set<AcaoDeLance['t']>(['passe', 'lancamento', 'cruzamento', 'escanteio', 'desvio']);
const CORRE = new Set<AcaoDeLance['t']>(['conducao', 'drible']);
/** Um respiro depois do corte, pra ver quem começa com a bola. */
export const RESPIRO_INICIAL = 0.35;
/** Velocidade de quem conduz no lance (m/s) — o coreógrafo garante esse passo. */
export const VEL_CONDUCAO = 8;

export interface TempoDaAcao { ini: number; dur: number; /** Preparação de bola parada antes da ação (s). */ prep: number }

/**
 * BOLA PARADA (feedback do fundador 10/10): antes do escanteio, da falta e do
 * pênalti, o jogo PARA e os times se posicionam — cobrador vai até a bola,
 * barreira, gente na área, goleiro na linha. Segundos de preparação por tipo.
 */
export const PREP_ESCANTEIO = 2.8;
export const PREP_FALTA = 3.0;
export const PREP_PENALTI = 2.6;

/** Tipo de bola parada que a ação `i` cobra (ou null). */
export function bolaParadaDe(acoes: readonly AcaoDeLance[], i: number): 'escanteio' | 'falta' | 'penalti' | null {
  const ac = acoes[i]!;
  if (ac.t === 'escanteio') return 'escanteio';
  if (ac.t === 'cobranca') return 'penalti';
  if (ac.t === 'cobranca_falta') return 'falta';
  if (ac.t === 'cruzamento' && acoes[i - 1]?.t === 'falta') return 'falta';
  return null;
}
const PREP = { escanteio: PREP_ESCANTEIO, falta: PREP_FALTA, penalti: PREP_PENALTI } as const;

export function cronogramaDaCadeia(cad: CadeiaDeLance): { tempos: TempoDaAcao[]; total: number } {
  let t = RESPIRO_INICIAL;
  let ant = cad.inicio;
  const tempos = cad.acoes.map((ac, i) => {
    const bp = bolaParadaDe(cad.acoes, i);
    const prep = bp ? PREP[bp] : 0;
    t += prep;
    const dist = Math.hypot(ac.x - ant.x, ac.z - ant.z);
    let dur: number;
    if (VOA.has(ac.t)) dur = Math.min(1.1, Math.max(0.35, dist / 24));
    else if (CORRE.has(ac.t)) dur = Math.min(2.8, Math.max(0.45, dist / VEL_CONDUCAO));
    else if (ac.t === 'desarme') dur = 0.6;
    else if (ac.t === 'falta') dur = 0.55;
    else if (ac.t === 'cobranca_falta') dur = 0.8; // a bola por cima da barreira
    else dur = 0.5; // chute / cabeceio / cobrança
    const tempo = { ini: t, dur, prep };
    t += dur;
    ant = ac;
    return tempo;
  });
  return { tempos, total: t };
}

/** Milissegundos que a Partida Rápida deve segurar um lance com cadeia. */
export function msParaMostrar(cad: CadeiaDeLance | undefined): number {
  return cad?.acoes.length ? Math.round((cronogramaDaCadeia(cad).total + 0.8) * 1000) : 0;
}

/**
 * quickTacticalLive — o estilo de jogo AO VIVO (dock de 5 na Partida Rápida).
 *
 * UMA VERDADE SÓ (Partida Viva, Fase 0): o estilo NÃO mexe mais no placar no
 * aparelho. Até 10/10 este módulo convertia quase-gol em gol (e gol em chute)
 * por sorteio local conforme o estilo "certo pro momento"; isso saiu. O
 * estilo vira um COMANDO que vai ao servidor (`{tipo: 'estilo'}`,
 * server/smartfield/comandos_ao_vivo.py) e muda os pesos do motor no replan a
 * partir de 3 minutos depois — o resultado só nasce lá.
 *
 * O que fica aqui é só apresentação: o rótulo de cada estilo e o empurrão na
 * BARRA de momento (sensação na hora; o momento de verdade vem do plano novo).
 */

import type { TacticalIntensityLevel } from './quickTacticalIntensity';
import { L } from '@/i18n/L';

export const STYLE_LABEL: Record<TacticalIntensityLevel, string> = {
  defend: L('Retranca', 'Park the bus'), counter: L('Contra-ataque', 'Counter'), possession: L('Posse', 'Possession'), press: L('Pressão', 'Press'), attack: L('Ataque', 'Attack'),
};

export interface LiveMatchState {
  /** homeScore - awayScore (>0 ganhando). */
  scoreDiff: number;
  minute: number;
  /** Momento 0-100 na perspectiva da casa (50 = equilíbrio). */
  momentum: number;
}

/**
 * O estilo que o MOMENTO pede — LEITURA, não resultado. Quem usa: o técnico da
 * Legends Cup (escolhe o estilo do rival pelo contexto). Nenhum placar nasce daqui.
 *  • perdendo: pressão (cedo) / ataque total (fim)
 *  • ganhando: posse (controlar) / contra (se dominado) / retranca (fim ou +2)
 *  • empatado: ataque/pressão se dominando, contra se sufocado, posse/pressão no resto
 */
export function idealStyle(s: LiveMatchState): TacticalIntensityLevel {
  const { scoreDiff, minute, momentum } = s;
  if (scoreDiff < 0) return minute >= 70 ? 'attack' : 'press';
  if (scoreDiff > 0) {
    if (scoreDiff >= 2 || minute >= 78) return 'defend';
    return momentum <= 42 ? 'counter' : 'possession';
  }
  if (momentum >= 62) return minute >= 70 ? 'attack' : 'press';
  if (momentum <= 38) return 'counter';
  return minute >= 76 ? 'press' : 'possession';
}

/** Índice ofensivo da formação (-1 fechada … +1 aberta) — só pro DNA do clube (clubDna.ts). */
export const FORMATION_OFFENSE: Record<string, number> = {
  '5-3-2': -1, '3-5-2': -0.3, '4-4-2': 0, '4-2-3-1': 0.25, '4-3-3': 0.5, '3-4-3': 1,
};

/** Viés territorial do estilo — empurra a barra de momento na hora da troca (só tela). */
export function styleMomentumBias(style: TacticalIntensityLevel): number {
  return ({ defend: -11, counter: -4, possession: 4, press: 10, attack: 15 } as const)[style] ?? 0;
}

/** Acende a curva de momento a partir do minuto da troca (efeito decai ~18'). Só tela. */
export function nudgeMomentumCurve(curve: number[], fromMinute: number, bias: number): number[] {
  if (!bias) return curve;
  const out = curve.slice();
  const target = Math.max(8, Math.min(92, 50 + bias));
  for (let i = Math.max(0, Math.floor(fromMinute)); i < out.length; i += 1) {
    const decay = 1 - (i - fromMinute) / 18;
    if (decay <= 0) break;
    out[i] = Math.max(5, Math.min(95, (out[i] ?? 50) + (target - (out[i] ?? 50)) * 0.35 * decay));
  }
  return out;
}

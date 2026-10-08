/**
 * JANELA DA ESTREIA (Fase 2 da Fundação do Clube, 2026-10-07).
 *
 * 7 dias de pré-temporada depois que o elenco chega: o manager vende jogador
 * do pacote pra um clube da várzea (controlado pelo jogo — o mercado entre
 * managers ainda é pequeno demais pra liquidez) e compra no mercado Genesis.
 * Corre EM PARALELO com a Liga Global — nada segura a estreia.
 */
import type { PlayerEntity } from '@/entities/types';
import { overallFromAttributes } from '@/entities/player';

/** Abaixo disso a várzea não compra mais (o time precisa de banco). */
export const JANELA_ELENCO_MINIMO = 13;
/** A várzea paga 80% do valor de mercado. */
export const FATOR_VARZEA = 0.8;

/** Valor em EXP que a várzea paga (80% do valor de mercado; sem valor, estima pelo OVR). */
export function valorNaVarzea(p: PlayerEntity): number {
  const ovr = p.mintOverall ?? overallFromAttributes(p.attrs, p.pos);
  const mercado = p.marketValueExp && p.marketValueExp > 0 ? p.marketValueExp : Math.max(50_000, (ovr - 40) ** 2 * 400);
  return Math.round((mercado * FATOR_VARZEA) / 1000) * 1000;
}

export function janelaAberta(janelaAte: string | undefined, agoraMs = Date.now()): boolean {
  return !!janelaAte && agoraMs <= Date.parse(janelaAte);
}

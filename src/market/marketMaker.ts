/**
 * Market Maker — liquidez garantida para jogadores do plantel.
 * O sistema faz uma proposta imediata com desconto dinâmico (20–35%)
 * baseado em posição e OVR do jogador.
 */
import type { PlayerEntity } from '@/entities/types';
import { overallFromAttributes } from '@/entities/player';
import { genesisListingPriceExpFromMintOverall } from '@/playerContracts/playerContracts';

/**
 * Desconto aplicado pelo Market Maker.
 * Jogadores raros (OVR ≥ 75) ou posições de alta demanda (GOL, ZAG)
 * recebem desconto menor — o MM paga mais por eles.
 */
export function marketMakerDiscountRate(pos: string, ovr: number): number {
  const p = pos.toUpperCase();
  const isGK = p === 'GOL';
  const isCB = p === 'ZAG' || p === 'ZAG-D' || p === 'ZAG-E' || p === 'ZAG-C';

  if (ovr >= 75) return 0.20;       // Raro: 20% desconto
  if (isGK || isCB) return 0.22;   // Goleiro/Zagueiro: 22%
  if (ovr >= 65) return 0.27;      // OVR 65–74: 27%
  return 0.35;                      // OVR < 65: 35%
}

/** Bônus em EXP por cada ponto de OVR evoluído acima do mintOverall. */
const EVOLUTION_BONUS_EXP_PER_OVR = 20_000;

/**
 * Calcula a oferta do Market Maker para um jogador.
 *
 * Duas componentes recompensam evolução real (treino + partidas):
 *   - Base usa o OVR ATUAL (não o mintOverall): manda o sinal correto
 *     de "preço por capacidade atual"
 *   - Bônus de evolução: cada ponto de OVR acima do mintOverall paga
 *     +20k EXP extra. Treinar um prospect de 70 → 75 antes de vender
 *     adiciona ~+150k EXP na oferta.
 *
 * O desconto continua dinâmico (20–35% via marketMakerDiscountRate)
 * em cima da soma base + bônus. Arredonda a 1 000 EXP.
 */
export function calcMarketMakerOffer(player: PlayerEntity): number {
  const ovr = overallFromAttributes(player.attrs, player.pos);
  const mintOvr = player.mintOverall ?? ovr;
  const basePrice = genesisListingPriceExpFromMintOverall(ovr);
  const evolutionBonus = Math.max(0, ovr - mintOvr) * EVOLUTION_BONUS_EXP_PER_OVR;
  const grossPrice = basePrice + evolutionBonus;
  const discount = marketMakerDiscountRate(player.pos, ovr);
  const offer = Math.round((grossPrice * (1 - discount)) / 1000) * 1000;
  return Math.max(10_000, offer); // mínimo 10k EXP
}

/** Label do desconto para exibir na UI. */
export function marketMakerDiscountLabel(pos: string, ovr: number): string {
  const rate = marketMakerDiscountRate(pos, ovr);
  return `${Math.round(rate * 100)}% abaixo do valor de mercado`;
}

/**
 * Filtros do Mercado — vocabulário único.
 *
 * O hero do Mercado (Transfer.tsx) é quem manda: nome, posição e ordem valem
 * pra qualquer aba. A aba Legacies só recebe e obedece. Antes cada aba tinha o
 * seu próprio jeito de ordenar, com nomes diferentes pra mesma coisa.
 */
import { L } from '@/i18n/L';

export type SortKey = 'relevance' | 'name_asc' | 'price_asc' | 'value_desc' | 'new';

export const MARKET_SORTS: { id: SortKey; label: string }[] = [
  { id: 'relevance', label: L('Melhor OVR', 'Best OVR') },
  { id: 'name_asc', label: 'A–Z' },
  { id: 'price_asc', label: L('Mais baratos', 'Cheapest') },
  { id: 'value_desc', label: L('Mais caros', 'Most expensive') },
  { id: 'new', label: L('Novidades', 'New') },
];

/** Posições do jogo, na ordem do campo (gol → ataque). */
export const MARKET_POSITIONS = ['GOL', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MEI', 'PD', 'PE', 'ATA'];

/** Rótulo de TELA da posição — a fonte única é src/i18n/posicao.ts. */
export { posLabel as rotuloPosicao } from '@/i18n/posicao';

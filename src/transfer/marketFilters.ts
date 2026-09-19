/**
 * Filtros do Mercado — vocabulário único.
 *
 * O hero do Mercado (Transfer.tsx) é quem manda: nome, posição e ordem valem
 * pra qualquer aba. A aba Legacies só recebe e obedece. Antes cada aba tinha o
 * seu próprio jeito de ordenar, com nomes diferentes pra mesma coisa.
 */
export type SortKey = 'relevance' | 'name_asc' | 'price_asc' | 'value_desc' | 'new';

export const MARKET_SORTS: { id: SortKey; label: string }[] = [
  { id: 'relevance', label: 'Melhor OVR' },
  { id: 'name_asc', label: 'A–Z' },
  { id: 'price_asc', label: 'Mais baratos' },
  { id: 'value_desc', label: 'Mais caros' },
  { id: 'new', label: 'Novidades' },
];

/** Posições do jogo, na ordem do campo (gol → ataque). */
export const MARKET_POSITIONS = ['GOL', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MEI', 'PD', 'PE', 'ATA'];

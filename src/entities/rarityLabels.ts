/**
 * Escada de raridade das lendas OLEFOOT — fonte única.
 *
 *   AI+  <  Revelação  <  Premium  <  Raro  <  Ultra-raro  <  Épico
 *
 * Regra de produto do fundador: a tag tem que VALER alguma coisa. `Épico` é
 * reservado a feito monumental (vice de Copa do Mundo, símbolo anti-racismo),
 * não é o default de toda lenda.
 *
 * DOIS TIERS FORA DO EIXO DE PRESTÍGIO:
 *   `AI+`       — card gerado por IA, sem atleta real por trás.
 *   `Revelação` — atleta em INÍCIO de carreira, cuja história ainda não
 *                 aconteceu. Não é "raridade baixa": é outra promessa. Enquanto
 *                 a lenda tem 3 fases porque o passado está fechado, a revelação
 *                 tem 1 card e evolutionRate alto — o valor está no que vem.
 *
 * Visual: prestígio = GRAU DE AMARELO (épico sólido → premium sem amarelo).
 * AI+ sai da escada de amarelo de propósito, pra não se confundir com raro.
 */

export type RarityTier = 'ai' | 'revelacao' | 'premium' | 'raro' | 'ultra' | 'epico';

/** Ordem crescente de prestígio — use pra ordenar/comparar. */
export const RARITY_ORDER: RarityTier[] = ['ai', 'revelacao', 'premium', 'raro', 'ultra', 'epico'];

export const RARITY_LABEL: Record<RarityTier, string> = {
  ai: 'AI+',
  revelacao: 'Revelação',
  premium: 'Premium',
  raro: 'Raro',
  ultra: 'Ultra-raro',
  epico: 'Épico',
};

/**
 * Resolve o tier a partir do `rarity_label` gravado no banco.
 *
 * ATENÇÃO à ordem dos testes: 'ultra_raro' contém 'raro', então 'ultra' TEM que
 * ser checado antes. O fallback por OVR só existe pra card legado sem label.
 */
export function rarityTierOf(rarityLabel: string | null | undefined, ovr?: number): RarityTier {
  const r = (rarityLabel ?? '').toLowerCase().trim();
  if (r.includes('epico') || r.includes('épico')) return 'epico';
  if (r.includes('ultra')) return 'ultra';
  if (r.includes('premium')) return 'premium';
  // Antes de 'raro': "revelacao" não contém "raro", mas deixar junto evita que
  // alguém adicione um teste solto depois e crie colisão.
  if (r.includes('revelacao') || r.includes('revelação')) return 'revelacao';
  if (r.startsWith('ai') || r.includes('ai+') || r.includes('ai_plus')) return 'ai';
  if (r.includes('raro')) return 'raro';
  const n = ovr ?? 0;
  return n >= 83 ? 'epico' : n >= 78 ? 'ultra' : 'raro';
}

/** Label pronto pra UI (nunca mostrar o valor cru do banco tipo "ultra_raro"). */
export function rarityLabelPt(rarityLabel: string | null | undefined, ovr?: number): string {
  return RARITY_LABEL[rarityTierOf(rarityLabel, ovr)];
}

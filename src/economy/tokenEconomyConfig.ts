/**
 * Token Economy Config — camada centralizada para o preço do OLEFOOT token
 * e flags de evolução (fixed → market, treasury, mint).
 *
 * Qualquer feature que precise saber "quanto vale 1 OLEFOOT em USD" deve
 * importar `getTokenPrice()` daqui. NUNCA hardcodar 0.00001 em outro lugar.
 *
 * Modo inicial: 'fixed' @ $0.00001. Quando listarmos em exchange, troca-se
 * a config no banco (UPDATE token_economy_config) e cache invalida.
 */

import { getSupabase } from '@/supabase/client';

export interface TokenEconomyConfig {
  currentTokenPrice: number;
  pricingMode: 'fixed' | 'market';
  futureExchangeEnabled: boolean;
}

const DEFAULT_CONFIG: TokenEconomyConfig = {
  currentTokenPrice: 0.00001,
  pricingMode: 'fixed',
  futureExchangeEnabled: false,
};

const CACHE_TTL_MS = 60_000;
let cached: { config: TokenEconomyConfig; fetchedAt: number } | null = null;

export async function getTokenPrice(): Promise<TokenEconomyConfig> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.config;
  }

  const sb = getSupabase();
  if (!sb) return DEFAULT_CONFIG;

  const { data, error } = await sb.rpc('get_token_price');
  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    return DEFAULT_CONFIG;
  }

  const row = Array.isArray(data) ? data[0] : data;
  const config: TokenEconomyConfig = {
    currentTokenPrice: Number(row.current_token_price ?? DEFAULT_CONFIG.currentTokenPrice),
    pricingMode: (row.pricing_mode ?? DEFAULT_CONFIG.pricingMode) as TokenEconomyConfig['pricingMode'],
    futureExchangeEnabled: Boolean(row.future_exchange_enabled),
  };

  cached = { config, fetchedAt: Date.now() };
  return config;
}

export function invalidateTokenPriceCache(): void {
  cached = null;
}

/**
 * Converte amount de OLEFOOT em USD usando a config atual.
 * Use SEMPRE essa fn em vez de multiplicar manualmente.
 */
export function olefootToUsd(amount: number, config: TokenEconomyConfig): number {
  return amount * config.currentTokenPrice;
}

export function usdToOlefoot(usdAmount: number, config: TokenEconomyConfig): number {
  if (config.currentTokenPrice <= 0) return 0;
  return usdAmount / config.currentTokenPrice;
}

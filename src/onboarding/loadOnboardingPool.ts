import {
  fetchGenesisMarketPlayerRowsOrdered,
  type GenesisMarketPlayerRow,
} from '@/supabase/genesisMarket';

/**
 * Carrega o pool elegível pra cerimônia de onboarding.
 *
 * Filtros:
 *   - listado no mercado (admin habilitou)
 *   - contrato não-vitalício (welcome pack tem 70 jogos fixos)
 *
 * Retorna `null` se Supabase não responder ou o pool ficar abaixo do mínimo.
 * O fallback mock fica em `fallbackOnboardingPool.ts` — caller decide.
 */
export const ONBOARDING_POOL_MIN = 25;

export async function loadOnboardingPool(): Promise<GenesisMarketPlayerRow[] | null> {
  const rows = await fetchGenesisMarketPlayerRowsOrdered();
  const eligible = rows.filter(
    (r) => r?.id && r.contract_is_lifetime !== true && r.listed_on_market === true,
  );
  if (eligible.length < ONBOARDING_POOL_MIN) return null;
  return eligible;
}

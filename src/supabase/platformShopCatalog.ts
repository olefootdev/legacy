/**
 * Persistência do catálogo da loja via platform_config.
 * Admin salva, todos os managers recebem no boot via loadPlatformConfigOnce().
 */
import { setPlatformConfig, fetchAllPlatformConfig } from './adminCore';
import type { ShopCatalogItem } from '@/game/shopCatalog';

export const SHOP_CATALOG_KEY = 'shop_catalog';

export async function saveShopCatalogToSupabase(items: ShopCatalogItem[]): Promise<boolean> {
  return setPlatformConfig(SHOP_CATALOG_KEY, items as unknown as Record<string, unknown>);
}

export async function loadShopCatalogFromSupabase(): Promise<ShopCatalogItem[] | null> {
  const raw = await fetchAllPlatformConfig();
  const val = raw[SHOP_CATALOG_KEY];
  if (!Array.isArray(val) || val.length === 0) return null;
  return val as ShopCatalogItem[];
}

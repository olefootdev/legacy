import { useEffect, useState } from 'react';
import { fetchAllPlatformConfig, setPlatformConfig } from '@/supabase/adminCore';

export type FeatureFlags = {
  LEGACY_DNA: boolean;
  GAMESPIRIT_ENABLED: boolean;
  WELCOME_PACK: boolean;
  LEGACY_MARKET: boolean;
  TUTORIAL_ENABLED: boolean;
  ASSISTANT_ENABLED: boolean;
};

export type PlatformLimits = {
  WELCOME_PACK_LIMIT: number;
  LEGACY_DAILY_TICK: number;
};

export type PlatformPrices = {
  OLE_TO_BRO_CENTS: number;
  LEGACY_BASE_PRICE_OLE: number;
};

const DEFAULT_FLAGS: FeatureFlags = {
  LEGACY_DNA: true,
  GAMESPIRIT_ENABLED: true,
  WELCOME_PACK: true,
  LEGACY_MARKET: true,
  TUTORIAL_ENABLED: true,
  ASSISTANT_ENABLED: true,
};

const DEFAULT_LIMITS: PlatformLimits = {
  WELCOME_PACK_LIMIT: 1000,
  LEGACY_DAILY_TICK: 1,
};

const DEFAULT_PRICES: PlatformPrices = {
  OLE_TO_BRO_CENTS: 1,
  LEGACY_BASE_PRICE_OLE: 50000,
};

/** Singleton em memória — carregado no boot a partir de platform_config. */
let _flags: FeatureFlags = { ...DEFAULT_FLAGS };
let _limits: PlatformLimits = { ...DEFAULT_LIMITS };
let _prices: PlatformPrices = { ...DEFAULT_PRICES };
let _loaded = false;
const _listeners = new Set<() => void>();

function notify() {
  for (const l of _listeners) l();
}

export async function loadPlatformConfigOnce(): Promise<void> {
  if (_loaded) return;
  const raw = await fetchAllPlatformConfig();
  if (raw.feature_flags) _flags = { ...DEFAULT_FLAGS, ...(raw.feature_flags as Partial<FeatureFlags>) };
  if (raw.limits) _limits = { ...DEFAULT_LIMITS, ...(raw.limits as Partial<PlatformLimits>) };
  if (raw.prices) _prices = { ...DEFAULT_PRICES, ...(raw.prices as Partial<PlatformPrices>) };
  _loaded = true;
  notify();
}

export function getFeatureFlags(): FeatureFlags { return _flags; }
export function getPlatformLimits(): PlatformLimits { return _limits; }
export function getPlatformPrices(): PlatformPrices { return _prices; }
export function isFeatureEnabled(key: keyof FeatureFlags): boolean { return !!_flags[key]; }

export async function saveFeatureFlags(next: FeatureFlags): Promise<boolean> {
  const ok = await setPlatformConfig('feature_flags', next as unknown as Record<string, unknown>);
  if (ok) { _flags = { ...next }; notify(); }
  return ok;
}
export async function savePlatformLimits(next: PlatformLimits): Promise<boolean> {
  const ok = await setPlatformConfig('limits', next as unknown as Record<string, unknown>);
  if (ok) { _limits = { ...next }; notify(); }
  return ok;
}
export async function savePlatformPrices(next: PlatformPrices): Promise<boolean> {
  const ok = await setPlatformConfig('prices', next as unknown as Record<string, unknown>);
  if (ok) { _prices = { ...next }; notify(); }
  return ok;
}

/** Hook — re-renderiza quando config muda. */
export function usePlatformConfig() {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    _listeners.add(l);
    if (!_loaded) void loadPlatformConfigOnce();
    return () => { _listeners.delete(l); };
  }, []);
  return { flags: _flags, limits: _limits, prices: _prices, loaded: _loaded };
}

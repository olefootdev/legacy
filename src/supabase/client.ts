import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const meta = (globalThis as Record<string, unknown>).import_meta_env as Record<string, string> | undefined;
const SUPABASE_URL: string | undefined =
  meta?.VITE_SUPABASE_URL ?? (typeof import.meta !== 'undefined' ? (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SUPABASE_URL : undefined);
const SUPABASE_ANON_KEY: string | undefined =
  meta?.VITE_SUPABASE_ANON_KEY ?? (typeof import.meta !== 'undefined' ? (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY : undefined);

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

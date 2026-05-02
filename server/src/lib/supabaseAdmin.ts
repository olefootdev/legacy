import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null | undefined;

/**
 * Cliente service-role só quando `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` existem.
 * Aceita formato novo sb_secret_* e formato JWT legado (eyJ...).
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    cached = null;
    return null;
  }

  // Aceita formato novo sb_secret_* (Supabase ≥ 2025) ou JWT legado
  const isNewFormat = key.startsWith('sb_secret_');
  const isJwtFormat = key.split('.').length === 3;

  if (!isNewFormat && !isJwtFormat) {
    console.error('[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY formato inválido.');
    cached = null;
    return null;
  }

  // Validar JWT legado: deve ser service_role, não anon
  if (isJwtFormat && !isNewFormat) {
    try {
      const parts = key.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
      if (payload.role !== 'service_role') {
        console.error('[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY deve ser service_role, não anon key.');
        cached = null;
        return null;
      }
    } catch (e) {
      console.error('[supabaseAdmin] Falha ao decodificar JWT:', e instanceof Error ? e.message : 'unknown');
      cached = null;
      return null;
    }
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Validação assíncrona no startup
  cached.from('matches').select('id').limit(1).then(({ error }) => {
    if (error) {
      console.error(`[supabaseAdmin] Falha de conectividade Supabase no startup: ${error.message}`);
    } else {
      console.log('[supabaseAdmin] Conexão Supabase validada com sucesso.');
    }
  });

  return cached;
}


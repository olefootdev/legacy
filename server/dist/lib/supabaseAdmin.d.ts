import { type SupabaseClient } from '@supabase/supabase-js';
/**
 * Cliente service-role só quando `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` existem.
 * Aceita formato novo sb_secret_* e formato JWT legado (eyJ...).
 */
export declare function getSupabaseAdmin(): SupabaseClient | null;

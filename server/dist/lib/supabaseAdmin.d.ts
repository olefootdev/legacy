import { type SupabaseClient } from '@supabase/supabase-js';
/**
 * Cliente service-role só quando `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` existem.
 * Não falha no import — útil para desenvolver só GameSpirit/OpenAI sem Supabase local.
 */
export declare function getSupabaseAdmin(): SupabaseClient | null;

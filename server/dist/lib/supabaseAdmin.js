import { createClient } from '@supabase/supabase-js';
let cached;
/**
 * Cliente service-role só quando `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` existem.
 * Não falha no import — útil para desenvolver só GameSpirit/OpenAI sem Supabase local.
 */
export function getSupabaseAdmin() {
    if (cached !== undefined)
        return cached;
    const url = process.env.SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) {
        cached = null;
        return null;
    }
    // Validação básica de formato: service role keys são JWTs (3 segmentos base64)
    const parts = key.split('.');
    if (parts.length !== 3) {
        console.error('[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY não parece um JWT válido — verifique a variável de ambiente.');
        cached = null;
        return null;
    }
    // Validar que é service role (não anon key)
    try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        if (payload.role !== 'service_role') {
            console.error('[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY deve ser service_role, não anon key.');
            cached = null;
            return null;
        }
    }
    catch (e) {
        console.error('[supabaseAdmin] Falha ao decodificar JWT:', e instanceof Error ? e.message : 'unknown');
        cached = null;
        return null;
    }
    cached = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    // Validação assíncrona no startup: testa conectividade real sem bloquear o servidor
    cached.from('matches').select('id').limit(1).then(({ error }) => {
        if (error) {
            console.error(`[supabaseAdmin] Falha de conectividade Supabase no startup: ${error.message}`);
        }
        else {
            console.log('[supabaseAdmin] Conexão Supabase validada com sucesso.');
        }
    });
    return cached;
}
//# sourceMappingURL=supabaseAdmin.js.map
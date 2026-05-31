/**
 * Smoke test: dispara um password recovery real pra validar
 * o SMTP custom (Resend) + template branded da Olefoot.
 *
 * USO:
 *   tsx --env-file=server/.env scripts/migrate-legacy-v1/test-recovery-email.ts olefootdev@gmail.com
 */
import { createClient } from '@supabase/supabase-js';

const TARGET = process.argv[2];
if (!TARGET) {
  console.error('Uso: tsx ...test-recovery-email.ts <email>');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatórios');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: users, error: lerr } = await sb.auth.admin.listUsers({ page: 1, perPage: 300 });
if (lerr) { console.error('list error:', lerr.message); process.exit(2); }
const found = users.users.find((u) => u.email?.toLowerCase() === TARGET.toLowerCase());
console.log(found ? `✓ ${TARGET} existe em auth.users (id ${found.id.slice(0,8)}…)` : `✗ ${TARGET} NÃO existe — abortando`);
if (!found) process.exit(3);

const { error } = await sb.auth.resetPasswordForEmail(TARGET, {
  redirectTo: 'https://game.olefoot.com/reset-password',
});
if (error) {
  console.error('✗ erro disparando recovery:', error.message);
  process.exit(4);
}
console.log('✓ recovery email disparado pra', TARGET);
console.log('  agora confere a caixa de entrada (e spam) em ~30s');
console.log('  esperado: FROM noreply@olefoot.com, subject "Resgate seu acesso na Olefoot"');

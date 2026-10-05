/**
 * SMART-PROFILE — cria/sincroniza as fichas de TODOS os elencos (dado, não schema).
 *
 *   npx tsx --env-file=server/.env scripts/smart-profile-backfill.mts            # simula (não grava)
 *   npx tsx --env-file=server/.env scripts/smart-profile-backfill.mts --gravar   # grava
 *
 * Idempotente: rodar de novo não duplica nada — cada jogador ganha a ficha uma
 * vez, e só mudanças viram evento. Precisa da migration 20261005210000.
 * Sem o backfill o jogo funciona igual: cada manager ganha as fichas na
 * primeira vez que abre o painel de um jogador.
 */
import { createClient } from '@supabase/supabase-js';
import { sincronizarFichas } from '../server/src/lib/smartProfile/sincronizar.ts';

const gravar = process.argv.includes('--gravar');
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const { data: elencos, error } = await sb.from('manager_squad').select('user_id');
if (error) throw error;
console.log(`${elencos?.length ?? 0} elencos${gravar ? '' : ' — SIMULAÇÃO (use --gravar para gravar)'}`);
if (!gravar) process.exit(0);

let fichas = 0, criadas = 0, eventos = 0, falhas = 0;
for (const e of elencos ?? []) {
  try {
    const r = await sincronizarFichas(sb, e.user_id);
    fichas += r.fichas.length; criadas += r.criadas; eventos += r.eventos;
  } catch (err) {
    falhas++;
    console.error(`  ✗ ${e.user_id}: ${err instanceof Error ? err.message : err}`);
  }
}
console.log(`fichas ativas: ${fichas} · criadas agora: ${criadas} · eventos na memória: ${eventos} · falhas: ${falhas}`);
process.exit(falhas ? 1 : 0);

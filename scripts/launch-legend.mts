/**
 * Lançamento de lenda no PLAYERVIP — ponta a ponta, reutilizável pras 8.
 *
 * Faz, na ordem que NÃO falha:
 *   1. cria conta do beneficiário (atleta) + facilitador (idempotente) e gera o
 *      magic link do atleta pra você mandar no WhatsApp
 *   2. importa os cards (POST /api/admin/legend-import) — só se houver admin token;
 *      senão imprime o curl exato pra você rodar / usar o wizard do admin
 *   3. vincula cada card: injeta o uid do beneficiário no slot `player` e o do
 *      facilitador no `facilitator` (mesma lógica de admin_link_legend_full,
 *      20260713120000:161-178). Feito via service role porque a RPC exige
 *      is_admin() e um script não tem auth.uid().
 *
 * Uso:
 *   npx tsx --env-file=server/.env scripts/launch-legend.mts \
 *     adauto --beneficiary=adautogol@gmail.com --facilitator=afiger@gmail.com [--run]
 *
 * Sem --run: DRY-RUN (só leitura, mostra o plano). Com --run: executa.
 * Import via endpoint só se OLEFOOT_ADMIN_TOKEN estiver no ambiente.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const get = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const RUN = args.includes('--run');
const beneficiaryEmail = (get('beneficiary') ?? '').trim().toLowerCase();
const facilitatorEmail = (get('facilitator') ?? '').trim().toLowerCase();
const REDIRECT = 'https://game.olefoot.com/playervip';
const API = process.env.VITE_OLEFOOT_API_URL || process.env.OLEFOOT_API_URL || 'https://legacy-production-de1e.up.railway.app';
const ADMIN_TOKEN = process.env.OLEFOOT_ADMIN_TOKEN || process.env.ADMIN_API_TOKEN || process.env.GLOBAL_LEAGUE_ADMIN_TOKEN;

if (!slug || !beneficiaryEmail) {
  console.error('uso: launch-legend.mts <slug> --beneficiary=email [--facilitator=email] [--run]');
  process.exit(1);
}

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const mode = RUN ? '🔴 RUN (escreve em prod)' : '🟡 DRY-RUN (só leitura)';
const line = (t: string) => console.log(`\n${'─'.repeat(68)}\n${t}\n${'─'.repeat(68)}`);
console.log(`\n🚀 Lançar "${slug}"  ·  ${mode}\n   beneficiário: ${beneficiaryEmail}\n   facilitador : ${facilitatorEmail || '(nenhum)'}`);

// legend.json
const legend = JSON.parse(readFileSync(resolve(process.cwd(), `legends/${slug}/legend.json`), 'utf8'));
const phases: string[] = (legend.phases ?? []).map((p: { phase: string }) => p.phase);
const cardIds = phases.map((ph) => `legacy-${slug}-${ph}`);

// ── util
const users = (await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users;
const findUser = (e: string) => users.find((u) => (u.email ?? '').toLowerCase() === e);
async function ensureUser(email: string): Promise<{ id: string; created: boolean; link?: string }> {
  const found = findUser(email);
  if (found) return { id: found.id, created: false };
  if (!RUN) return { id: '(criada no --run)', created: true };
  const { data, error } = await sb.auth.admin.createUser({ email, email_confirm: true });
  if (error && !/already/i.test(error.message)) throw new Error(`createUser ${email}: ${error.message}`);
  const uid = data?.user?.id ?? findUser(email)?.id ?? '?';
  const link = (await sb.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: REDIRECT } })).data?.properties?.action_link;
  return { id: uid, created: true, link };
}

// ── 1) contas
line('1) CONTAS');
const ben = await ensureUser(beneficiaryEmail);
console.log(`   beneficiário ${beneficiaryEmail}: ${ben.created ? (RUN ? 'CRIADA' : 'será criada') : 'já existe'} (${ben.id.slice(0, 8)})`);
if (ben.link) console.log(`   🔗 MAGIC LINK (mande pro atleta):\n      ${ben.link}`);
let facId: string | null = null;
if (facilitatorEmail) {
  const fac = await ensureUser(facilitatorEmail);
  facId = fac.id.startsWith('(') ? null : fac.id;
  console.log(`   facilitador ${facilitatorEmail}: ${fac.created ? (RUN ? 'CRIADA' : 'será criada') : 'já existe'} (${fac.id.slice(0, 8)})`);
}

// ── 2) import
line('2) IMPORT DOS CARDS');
const existing = (await sb.from('legacy_players').select('id').in('id', cardIds)).data ?? [];
console.log(`   cards no banco: ${existing.length}/${cardIds.length} (${cardIds.join(', ')})`);
if (existing.length === cardIds.length) {
  console.log('   ✅ já importados — pulo o import');
} else if (!ADMIN_TOKEN) {
  console.log('   ⚠️  sem admin token local. Importe pelo wizard do admin OU rode:');
  console.log(`      curl -sS -X POST "${API}/api/admin/legend-import" \\\n        -H "X-Admin-Token: <TOKEN>" -H "Content-Type: application/json" \\\n        -d '{"slug":"${slug}","payload": <conteúdo de legends/${slug}/legend.json>}'`);
} else if (!RUN) {
  console.log('   (no --run: POST /api/admin/legend-import com o payload do legend.json)');
} else {
  const res = await fetch(`${API}/api/admin/legend-import`, {
    method: 'POST',
    headers: { 'X-Admin-Token': ADMIN_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, payload: legend }),
  });
  console.log(`   import HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// ── 3) vínculo (por card)
line('3) VÍNCULO (por card)');
const benUid = RUN ? findUser(beneficiaryEmail)?.id ?? ben.id : ben.id;
for (const id of cardIds) {
  const { data: card } = await sb.from('legacy_players').select('id, payment_split, beneficiary_user_id').eq('id', id).maybeSingle();
  if (!card) { console.log(`   ${id}: ❌ não existe ainda (importe antes)`); continue; }
  const split = (card.payment_split ?? []) as Array<Record<string, unknown>>;
  const next = split.map((e) => {
    if (e.kind === 'player') return { ...e, user_id: benUid, label: beneficiaryEmail };
    if (e.kind === 'facilitator' && facId) return { ...e, user_id: facId, label: facilitatorEmail };
    return e;
  });
  const preview = next.map((e) => `${e.kind}=${e.user_id ? String(e.user_id).slice(0, 8) : 'null'}`).join(' ');
  if (!RUN) { console.log(`   ${id}: viraria → benef=${String(benUid).slice(0, 8)} · split[${preview}]`); continue; }
  const { error } = await sb.from('legacy_players').update({ beneficiary_user_id: benUid, payment_split: next, updated_at: new Date().toISOString() }).eq('id', id);
  console.log(`   ${id}: ${error ? '❌ ' + error.message : '✅ vinculado · split[' + preview + ']'}`);
}

// ── 4) conferência
line('4) ESTADO FINAL');
const { data: final } = await sb.from('legacy_players').select('id, listed_on_market, beneficiary_user_id, payment_split').in('id', cardIds);
for (const c of final ?? []) {
  const sp = (c.payment_split ?? []) as Array<Record<string, unknown>>;
  const g = (k: string) => { const v = sp.find((s) => s.kind === k)?.user_id; return v ? String(v).slice(0, 8) : '❌null'; };
  console.log(`   ${c.id}: listado=${c.listed_on_market} benef=${c.beneficiary_user_id ? String(c.beneficiary_user_id).slice(0, 8) : '❌null'} · player=${g('player')} fac=${g('facilitator')} olefoot=${g('olefoot')} comm=${g('community')}`);
}
console.log(RUN ? '\n✅ feito. Cards nascem listed_on_market=false — liste quando for vender.\n' : '\n🟡 dry-run. Rode com --run pra executar.\n');

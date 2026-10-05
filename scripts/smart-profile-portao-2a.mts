/**
 * Portão da Fase 2A — as últimas partidas do modo sombra bateram?
 *
 *   npm run smart-profile:portao-2a
 *
 * Passa quando as 20 partidas mais recentes têm zero divergência entre a
 * evolução do celular e a do servidor. Só leitura.
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data, error } = await sb.from('evolucao_sombra')
  .select('seed, resultado, jogadores, divergencias, antes_diferente, detalhes, criado_em, custodia, custodia_motivos')
  .order('criado_em', { ascending: false }).limit(20);
if (error) { console.error('Sem a tabela evolucao_sombra? Aplique a migration 20261005230000.', error.message); process.exit(1); }

const linhas = data ?? [];
const comDivergencia = linhas.filter((l) => l.divergencias > 0);
const jogadores = linhas.reduce((s, l) => s + l.jogadores, 0);
const antesDif = linhas.reduce((s, l) => s + l.antes_diferente, 0);
console.log(`\nÚltimas ${linhas.length} partidas · ${jogadores} titulares evoluídos`);
console.log(`partidas com divergência: ${comDivergencia.length}`);
console.log(`titulares com "antes" diferente da ficha (informativo): ${antesDif}`);
const porCustodia = linhas.reduce<Record<string, number>>((m, l) => ({ ...m, [l.custodia]: (m[l.custodia] ?? 0) + 1 }), {});
console.log(`custódia (Fase 2B): ${Object.entries(porCustodia).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}`);
for (const l of linhas.filter((x) => x.custodia === 'suspeita').slice(0, 5)) console.log(`  ⚠ suspeita ${l.seed}: ${(l.custodia_motivos as string[]).slice(0, 3).join('; ')}`);
for (const l of comDivergencia.slice(0, 5)) console.log(`  ✗ ${l.criado_em} ${l.seed}: ${JSON.stringify(l.detalhes).slice(0, 300)}`);
const passou = linhas.length >= 20 && comDivergencia.length === 0;
console.log(passou ? '\n🟢 PORTÃO DA FASE 2A: 20 partidas reais, servidor e celular iguais' : `\n⏳ PORTÃO DA FASE 2A: ${linhas.length < 20 ? `faltam ${20 - linhas.length} partidas` : 'há divergência'}`);
process.exit(passou ? 0 : 1);

/**
 * SMART-PROFILE — portão da Fase 1, só LEITURA.
 *
 *   npx tsx --env-file=server/.env scripts/smart-profile-conferir.mts
 *
 * Monta em memória a ficha de cada jogador de cada elenco real e confere:
 *   1. o OVR da ficha é o mesmo que o jogo mostra (fórmula do cliente);
 *   2. os atributos da ficha são os do elenco salvo;
 *   3. toda ficha tem gênese com hash, classe válida e temperamento.
 * Mostra também como as classes e raridades se distribuem. Não grava nada.
 */
import { createClient } from '@supabase/supabase-js';
import { overallFromAttributes } from '../src/entities/player.ts';
import { withSpecialistDefaults } from '../src/entities/specialistAttrs.ts';
import { conciliar, type InfoCatalogo } from '../server/src/lib/smartProfile/ficha.ts';
import { CLASSES, grupoDaPosicao } from '../server/src/lib/smartProfile/classes.ts';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const { data: elencos, error } = await sb.from('manager_squad').select('user_id, players');
if (error) throw error;
const { data: gen } = await sb.from('genesis_market_players').select('id, attributes, rarity_label, mint_overall, country, age, strong_foot');
const { data: leg } = await sb.from('legacy_players').select('id, attributes, rarity_label, mint_overall, country, age, strong_foot');
const cat = new Map<string, InfoCatalogo>();
for (const r of gen ?? []) cat.set(`genesis-${r.id}`, { catalogo: r.id, atributos: r.attributes, rotuloRaridade: r.rarity_label, ovrNascimento: r.mint_overall, nacionalidade: r.country, idade: r.age, pe: r.strong_foot });
for (const r of leg ?? []) cat.set(`legacy-${r.id}`, { catalogo: r.id, atributos: r.attributes, rotuloRaridade: r.rarity_label, ovrNascimento: r.mint_overall, nacionalidade: r.country, idade: r.age, pe: r.strong_foot });

let total = 0, ovrDiverge = 0, attrsDiverge = 0, invalidas = 0, comEvolucao = 0;
const exemplos: string[] = [];
const porClasse = new Map<string, number>(), porRaridade = new Map<string, number>(), porOrigem = new Map<string, number>();
const agora = new Date().toISOString();

for (const e of elencos ?? []) {
  for (const p of (e.players ?? []) as Record<string, any>[]) {
    if (!p?.id || !p.attrs) continue;
    total++;
    const { ficha, eventos } = conciliar(e.user_id, p, null, cat.get(p.id) ?? null, agora);
    // O que o jogo mostra hoje para esse jogador.
    const naTela = overallFromAttributes(withSpecialistDefaults(p.attrs, p.pos), p.pos);
    if (ficha.ovr !== naTela) { ovrDiverge++; if (exemplos.length < 5) exemplos.push(`${p.id} ${p.pos}: ficha ${ficha.ovr} × tela ${naTela}`); }
    for (const k of Object.keys(p.attrs)) {
      if (typeof p.attrs[k] === 'number' && (ficha.atributos as any)[k] !== p.attrs[k]) { attrsDiverge++; break; }
    }
    const classe = CLASSES.find((c) => c.id === ficha.classe);
    if (!classe || !classe.grupos.includes(grupoDaPosicao(ficha.posicao)) || !/^[0-9a-f]{64}$/.test(ficha.genese_hash) || !ficha.temperamento) invalidas++;
    if ((eventos[0]?.dados as any)?.evolucao_anterior) comEvolucao++;
    porClasse.set(ficha.classe, (porClasse.get(ficha.classe) ?? 0) + 1);
    porRaridade.set(ficha.raridade, (porRaridade.get(ficha.raridade) ?? 0) + 1);
    porOrigem.set(ficha.origem, (porOrigem.get(ficha.origem) ?? 0) + 1);
  }
}

const linha = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
console.log(`\n${elencos?.length} elencos, ${total} jogadores\n`);
console.log(`OVR diferente do da tela:      ${ovrDiverge}${exemplos.length ? `  (ex.: ${exemplos.join('; ')})` : ''}`);
console.log(`atributos diferentes do elenco: ${attrsDiverge}`);
console.log(`fichas inválidas:               ${invalidas}`);
console.log(`já evoluíram desde o catálogo:  ${comEvolucao}\n`);
console.log(`origem:   ${linha(porOrigem)}`);
console.log(`raridade: ${linha(porRaridade)}`);
console.log(`classe:   ${linha(porClasse)}\n`);
const passou = ovrDiverge === 0 && attrsDiverge === 0 && invalidas === 0 && total > 0;
console.log(passou ? '🟢 PORTÃO DA FASE 1: todas as fichas batem com o que o manager vê' : '🔴 PORTÃO DA FASE 1: há divergência');
process.exit(passou ? 0 : 1);

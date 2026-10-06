/**
 * Portão da Fase 3 — a conferência corta jogador honesto?
 *
 *   npm run smart-profile:portao-3
 *
 * Passa quando NENHUM titular de NENHUM elenco de produção é cortado. O payload
 * do motor é montado a partir do ELENCO SALVO (`manager_squad`), com as mesmas
 * funções que o jogo usa (`playerToQuickPlanPayload` + `applyLegacyBoostToLineup`)
 * nos extremos de moral e com o boost de lenda no teto do CAP — o pior caso
 * honesto — e conferido contra a ficha.
 *
 * A primeira versão deste portão montava o payload a partir da PRÓPRIA FICHA:
 * testava a ficha contra si mesma, e por isso dava 0 corte mesmo com a Fase 3
 * cortando gente honesta em produção. A diferença que importa é exatamente a
 * que ele não via — ficha DEFASADA em relação ao elenco. Agora o portão
 * reproduz o fluxo real: elenco → payload → conferência contra a ficha que o
 * servidor usa (reconciliada por `conciliar`, como a rota faz antes de conferir).
 *
 * Um corte aqui é falso positivo: tiraria ponto de quem joga limpo. Só leitura.
 */
import { createClient } from '@supabase/supabase-js';
import { conferirEscalacao, type FichaDoMotor } from '../server/src/lib/smartProfile/plano.js';
import { conciliar } from '../server/src/lib/smartProfile/ficha.js';
import { diferencaDeAtributos } from '../server/src/lib/smartProfile/ficha.js';
import type { Ficha } from '../server/src/lib/smartProfile/tipos.js';
import { playerToQuickPlanPayload, applyLegacyBoostToLineup } from '../src/match/quickPlanClient.js';
import type { PlayerEntity } from '../src/entities/types.js';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// Em páginas de 1.000: o PostgREST corta aí por padrão, e um portão que vê
// metade do elenco não é portão.
type FichaLinha = { owner_id: string; player_id: string; nome: string; posicao: string; atributos: Record<string, number> };
const fichas: FichaLinha[] = [];
for (let pagina = 0; ; pagina++) {
  const { data, error } = await sb.from('player_profiles')
    .select('owner_id, player_id, nome, posicao, atributos').eq('ativo', true)
    .order('owner_id').order('player_id').range(pagina * 1000, pagina * 1000 + 999);
  if (error) { console.error('Sem a tabela player_profiles? Aplique a migration 20261005210000.', error.message); process.exit(1); }
  fichas.push(...((data ?? []) as FichaLinha[]));
  if ((data ?? []).length < 1000) break;
}

// O ELENCO é a origem do que o celular envia: atributos E behavior. É daqui
// que o payload tem de nascer — senão o portão não vê a defasagem da ficha.
const { data: elencos } = await sb.from('manager_squad').select('user_id, players');
const entidadeDe = new Map<string, Record<string, unknown>>();
for (const e of elencos ?? []) {
  for (const p of (e.players ?? []) as Record<string, unknown>[]) {
    if (p && typeof p.id === 'string' && p.attrs) entidadeDe.set(`${e.user_id}|${p.id}`, p);
  }
}

/** Boost de lenda no teto: 5 categorias no CAP de 8. O pior caso honesto. */
const LENDA_NO_TETO = [
  { label: 'ATAQUE', pct: 99 }, { label: 'DEFESA', pct: 99 }, { label: 'MORAL', pct: 99 },
  { label: 'PASSE', pct: 99 }, { label: 'VELOCIDADE', pct: 99 },
];

let titulares = 0, cortados = 0, semElenco = 0, defasadas = 0;
const motivos: string[] = [];
const porAtributo = new Map<string, number>();
const AGORA = '2026-01-01T00:00:00.000Z'; // `conciliar` é pura; a data não entra na conta

for (const f of fichas) {
  const bruta = entidadeDe.get(`${f.owner_id}|${f.player_id}`);
  if (!bruta) { semElenco++; continue; }

  // A rota sincroniza a ficha com o elenco ANTES de conferir. Reproduzimos isso
  // com a mesma função pura, e contamos quantas estavam defasadas no banco.
  const r = conciliar(f.owner_id, bruta, f as unknown as Ficha, null, AGORA);
  if (Object.keys(diferencaDeAtributos(f.atributos, r.ficha.atributos)).length) defasadas++;

  const mapa = new Map<string, FichaDoMotor>([[f.player_id, { atributos: r.ficha.atributos }]]);
  const behavior = String(bruta.behavior ?? 'equilibrado');
  const entidade = { ...bruta, behavior } as unknown as PlayerEntity;

  // Pior caso honesto: moral no chão e no teto, com e sem lenda em campo.
  for (const moral of [0, 50, 100]) {
    for (const comLenda of [false, true]) {
      const base = playerToQuickPlanPayload(entidade, 0, 'mid', moral);
      const enviado = comLenda ? applyLegacyBoostToLineup([base], LENDA_NO_TETO) : [base];
      const r = conferirEscalacao(enviado, mapa);
      titulares++;
      if (r.conferencia.corrigidos > 0) {
        cortados++;
        for (const m of r.conferencia.motivos) {
          const campo = m.split('.')[1]?.split(':')[0] ?? '?';
          porAtributo.set(campo, (porAtributo.get(campo) ?? 0) + 1);
          if (motivos.length < 10) motivos.push(`${behavior} moral=${moral}${comLenda ? ' +lenda' : ''} → ${m}`);
        }
      }
    }
  }
}

const elencosVistos = new Set(fichas.map((f) => f.owner_id)).size;
console.log(`\n${fichas.length} fichas ativas · ${elencosVistos} elencos · ${titulares} combinações honestas testadas`);
console.log(`cortes em jogada honesta: ${cortados}`);
console.log(`fichas defasadas em relação ao elenco: ${defasadas} (o sync da rota resolve antes de conferir)`);
if (semElenco) console.log(`fichas sem jogador no elenco salvo (ignoradas): ${semElenco}`);
if (porAtributo.size) console.log(`por atributo: ${[...porAtributo].map(([k, v]) => `${k} ${v}`).join(' · ')}`);
for (const m of motivos) console.log(`  ✗ ${m}`);

// Contraprova: a conferência não pode ser um carimbo que deixa tudo passar.
let pegou = 0;
for (const f of fichas.slice(0, 50)) {
  const mapa = new Map<string, FichaDoMotor>([[f.player_id, { atributos: f.atributos }]]);
  const r = conferirEscalacao([{ id: f.player_id, finalizacao: 99, passe: 99, marcacao: 99, velocidade: 99 }], mapa);
  if (r.conferencia.corrigidos > 0) pegou++;
}
const amostra = Math.min(50, fichas.length);
console.log(`contraprova — atributo inflado a 99 em ${amostra} fichas: ${pegou} pegos`);

const passou = cortados === 0 && pegou === amostra && amostra > 0;
console.log(passou
  ? '\n🟢 PORTÃO DA FASE 3: nenhum jogador honesto é cortado, e o inflado não passa'
  : `\n🔴 PORTÃO DA FASE 3: ${cortados > 0 ? `${cortados} jogada honesta cortada` : 'a conferência deixou passar atributo inflado'}`);
process.exit(passou ? 0 : 1);

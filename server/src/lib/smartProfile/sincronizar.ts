/**
 * Sincroniza as fichas de um manager com o elenco salvo — a parte que fala
 * com o banco. A lógica de cada ficha está em `ficha.ts` (pura, testada).
 *
 * Fase 1: os atributos ainda vêm do elenco que o cliente salva em
 * `manager_squad`. A ficha registra cada mudança no histórico com
 * `fonte: 'elenco'` — na Fase 2 o servidor passa a calcular a evolução e essa
 * fonte deixa de existir.
 *
 * Uma sincronização por dono de cada vez (fila em memória): duas abas abertas
 * não duplicam eventos no histórico.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { conciliar, saiuDoElenco, type InfoCatalogo } from './ficha.js';
import type { Evento, Ficha } from './tipos.js';

export interface ResumoSync {
  fichas: Ficha[];
  criadas: number;
  atualizadas: number;
  inativadas: number;
  eventos: number;
}

/** Erro de "tabela não existe" do PostgREST — a migration ainda não rodou. */
export const semTabela = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || (/player_profile/.test(e.message ?? '') && /exist|find/i.test(e.message ?? '')));

async function catalogoPara(sb: SupabaseClient, ids: string[]): Promise<Map<string, InfoCatalogo>> {
  const out = new Map<string, InfoCatalogo>();
  const genesis = ids.filter((i) => i.startsWith('genesis-')).map((i) => i.slice('genesis-'.length));
  const legacy = ids.filter((i) => i.startsWith('legacy-')).map((i) => i.slice('legacy-'.length));
  if (genesis.length) {
    const { data } = await sb.from('genesis_market_players')
      .select('id, attributes, rarity_label, mint_overall, country, age, strong_foot').in('id', genesis);
    for (const r of data ?? []) {
      out.set(`genesis-${r.id}`, { catalogo: String(r.id), atributos: r.attributes, rotuloRaridade: r.rarity_label,
        ovrNascimento: r.mint_overall, nacionalidade: r.country, idade: r.age, pe: r.strong_foot });
    }
  }
  if (legacy.length) {
    const { data } = await sb.from('legacy_players')
      .select('id, attributes, rarity_label, mint_overall, country, age, strong_foot').in('id', legacy);
    for (const r of data ?? []) {
      out.set(`legacy-${r.id}`, { catalogo: String(r.id), atributos: r.attributes, rotuloRaridade: r.rarity_label,
        ovrNascimento: r.mint_overall, nacionalidade: r.country, idade: r.age, pe: r.strong_foot });
    }
  }
  return out;
}

async function sincronizarAgora(sb: SupabaseClient, ownerId: string, agora: string): Promise<ResumoSync> {
  const { data: elenco, error: e1 } = await sb.from('manager_squad').select('players').eq('user_id', ownerId).maybeSingle();
  if (e1) throw new Error(`elenco: ${e1.message}`);
  const jogadores = ((elenco?.players ?? []) as Record<string, unknown>[])
    .filter((p) => p && typeof p.id === 'string' && p.attrs && typeof p.attrs === 'object');

  const { data: atuais, error: e2 } = await sb.from('player_profiles').select('*').eq('owner_id', ownerId);
  if (e2) throw Object.assign(new Error(`fichas: ${e2.message}`), { code: e2.code });
  const porId = new Map((atuais ?? []).map((f) => [f.player_id as string, f as unknown as Ficha]));

  const catalogo = await catalogoPara(sb, jogadores.map((p) => p.id as string).filter((id) => !porId.has(id)));

  const gravar: Ficha[] = [];
  const eventos: Evento[] = [];
  const resumo: ResumoSync = { fichas: [], criadas: 0, atualizadas: 0, inativadas: 0, eventos: 0 };
  const vistos = new Set<string>();

  for (const p of jogadores) {
    const id = p.id as string;
    if (vistos.has(id)) continue; // elenco com id repetido: a primeira cópia vale
    vistos.add(id);
    const existente = porId.get(id) ?? null;
    const r = conciliar(ownerId, p, existente, catalogo.get(id) ?? null, agora);
    resumo.fichas.push(r.ficha);
    if (r.mudou) {
      gravar.push(r.ficha);
      eventos.push(...r.eventos);
      if (existente) resumo.atualizadas++; else resumo.criadas++;
    }
  }
  for (const f of porId.values()) {
    if (f.ativo && !vistos.has(f.player_id)) {
      const r = saiuDoElenco(f);
      gravar.push(r.ficha);
      eventos.push(...r.eventos);
      resumo.inativadas++;
    }
  }

  // Ficha antes do evento: o evento aponta para a ficha (chave estrangeira).
  for (let i = 0; i < gravar.length; i += 200) {
    const lote = gravar.slice(i, i + 200).map(({ ...f }) => f);
    const { error } = await sb.from('player_profiles').upsert(lote, { onConflict: 'owner_id,player_id' });
    if (error) throw new Error(`gravar fichas: ${error.message}`);
  }
  for (let i = 0; i < eventos.length; i += 500) {
    const { error } = await sb.from('player_profile_events').insert(eventos.slice(i, i + 500));
    if (error) throw new Error(`gravar histórico: ${error.message}`);
  }
  resumo.eventos = eventos.length;
  return resumo;
}

const fila = new Map<string, Promise<ResumoSync>>();

/** Sincroniza um dono. Pedidos simultâneos do mesmo dono esperam o anterior. */
export function sincronizarFichas(sb: SupabaseClient, ownerId: string, agora = new Date().toISOString()): Promise<ResumoSync> {
  const anterior = fila.get(ownerId) ?? Promise.resolve(null as unknown as ResumoSync);
  const proximo = anterior.catch(() => null).then(() => sincronizarAgora(sb, ownerId, agora));
  fila.set(ownerId, proximo);
  void proximo.finally(() => { if (fila.get(ownerId) === proximo) fila.delete(ownerId); }).catch(() => {});
  return proximo;
}

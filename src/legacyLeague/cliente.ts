/**
 * LEGACY LEAGUE — o celular falando com a liga (server/src/routes/legacyLeague.ts).
 *
 * A liga só se joga na Partida Viva (modo LEGACY). O servidor abre a partida e
 * sorteia o adversário (o time de outro manager real); no fim, ela só vale com
 * custódia válida + o filme da partida. Tudo aqui nunca lança.
 */
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import { getSupabase } from '@/supabase/client';
import { CABECALHO_IDIOMA } from '@/i18n/cabecalho';
import { stubDoElenco, type LinhaDeElenco } from '@/match/friendlyMatchmaking';
import type { OpponentStub } from '@/entities/types';

export interface Clube { nome: string; sigla: string }
export interface LinhaDaTabela { posicao: number; voce: boolean; clube: Clube | null; jogos: number; v: number; e: number; d: number; gp: number; gc: number; saldo: number; pontos: number }
export interface PartidaDaLiga {
  id: string; status: 'aberta' | 'valida' | 'invalida' | 'expirada'; motivo: string | null;
  golsPro: number | null; golsContra: number | null; pontos: number | null; quando: string; adversario: Clube | null;
}
export interface EstadoDaLiga {
  temporada: string; terminaEm: string; restantesHoje: number; limitePorDia: number;
  tabela: LinhaDaTabela[]; minha: Omit<LinhaDaTabela, 'voce' | 'clube'> | null;
  campeaoAnterior: { clube: Clube | null; pontos: number; voce: boolean } | null;
  partidas: PartidaDaLiga[];
}

async function cabecalhos(): Promise<Record<string, string> | null> {
  try {
    const sb = getSupabase();
    const t = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    return t ? { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...CABECALHO_IDIOMA } : null;
  } catch {
    return null;
  }
}

export async function lerLiga(): Promise<EstadoDaLiga | 'sem_sessao' | 'indisponivel'> {
  const h = await cabecalhos();
  if (!h) return 'sem_sessao';
  try {
    const r = await fetch(`${olefootApiBase()}/api/legacy-league`, { headers: h });
    const corpo = (await r.json().catch(() => null)) as (EstadoDaLiga & { ok?: boolean }) | null;
    return r.ok && corpo?.ok ? corpo : 'indisponivel';
  } catch {
    return 'indisponivel';
  }
}

export type PartidaAberta = { partida: string; adversario: OpponentStub };

/** Abre (ou retoma) a partida da liga. */
export async function abrirPartida(): Promise<PartidaAberta | { erro: string }> {
  const h = await cabecalhos();
  if (!h) return { erro: 'sem_sessao' };
  try {
    const r = await fetch(`${olefootApiBase()}/api/legacy-league/partida`, { method: 'POST', headers: h, body: '{}' });
    const corpo = (await r.json().catch(() => null)) as { ok?: boolean; erro?: string; partida?: string; adversario?: LinhaDeElenco } | null;
    if (!r.ok || !corpo?.ok || !corpo.partida || !corpo.adversario) return { erro: corpo?.erro ?? 'indisponivel' };
    const stub = stubDoElenco(corpo.adversario);
    return stub ? { partida: corpo.partida, adversario: stub } : { erro: 'o adversário ficou sem elenco' };
  } catch {
    return { erro: 'indisponivel' };
  }
}

export interface FechamentoDaLiga { status: 'valida' | 'invalida' | 'expirada' | 'aberta' | 'aguardando' | 'erro'; pontos?: number | null; motivo?: string | null }

/**
 * Fecha a partida. O servidor responde `aguardando` enquanto a custódia e o
 * filme (enviados no fim da partida) não chegaram — tenta de novo algumas vezes.
 */
export async function fecharPartida(partida: string, seed: string, tentativas = 8): Promise<FechamentoDaLiga> {
  const h = await cabecalhos();
  if (!h) return { status: 'erro' };
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(`${olefootApiBase()}/api/legacy-league/resultado`, { method: 'POST', headers: h, body: JSON.stringify({ partida, seed }) });
      const corpo = (await r.json().catch(() => null)) as (FechamentoDaLiga & { ok?: boolean }) | null;
      if (corpo?.ok && corpo.status !== 'aguardando') return corpo;
    } catch {
      /* rede: tenta de novo */
    }
    await new Promise((ok) => setTimeout(ok, 1500 + i * 1000));
  }
  return { status: 'aguardando' };
}

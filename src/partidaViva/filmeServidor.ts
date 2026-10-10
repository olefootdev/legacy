/**
 * PARTIDA VIVA — Fase 7: o filme no servidor (rotas em server/src/routes/filmes.ts).
 *
 * Quem jogou manda o filme; se o adversário era o time de outro manager, ele
 * recebe a notificação e assiste o time DELE jogando ("seu time jogou enquanto
 * você dormia"). Tudo aqui nunca lança: sem sessão ou sem rede, o filme fica
 * só no aparelho (gravacao.ts) e a partida segue igual.
 */
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import { getSupabase } from '@/supabase/client';
import type { FilmeDaPartida } from './gravacao';

export interface FilmeNaNuvem {
  id: string;
  papel: 'dono' | 'adversario';
  quando: string;
  novo: boolean;
  resumo: { siglaCasa: string; siglaFora: string; nomeCasa: string; nomeFora: string; placarCasa: number; placarFora: number };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function token(): Promise<string | null> {
  try {
    const sb = getSupabase();
    return sb ? (await sb.auth.getSession()).data.session?.access_token ?? null : null;
  } catch {
    return null;
  }
}

/** Manda o filme. `adversarioId` só vale se for a conta de outro manager (uuid). */
export async function enviarFilme(f: FilmeDaPartida, adversarioId: string | undefined): Promise<{ id: string; avisado: boolean } | null> {
  const t = await token();
  if (!t) return null;
  try {
    const r = await fetch(`${olefootApiBase()}/api/filme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ filme: f, adversario: adversarioId && UUID.test(adversarioId) ? adversarioId : null }),
      keepalive: false,
    });
    const corpo = (await r.json().catch(() => null)) as { ok?: boolean; id?: string; avisado?: boolean } | null;
    return r.ok && corpo?.ok && corpo.id ? { id: corpo.id, avisado: !!corpo.avisado } : null;
  } catch {
    return null;
  }
}

export async function listarFilmesDaNuvem(): Promise<FilmeNaNuvem[]> {
  const t = await token();
  if (!t) return [];
  try {
    const r = await fetch(`${olefootApiBase()}/api/filmes`, { headers: { Authorization: `Bearer ${t}` } });
    const corpo = (await r.json().catch(() => null)) as { filmes?: FilmeNaNuvem[] } | null;
    return Array.isArray(corpo?.filmes) ? corpo!.filmes : [];
  } catch {
    return [];
  }
}

export async function abrirFilmeDaNuvem(id: string): Promise<{ filme: FilmeDaPartida; papel: 'dono' | 'adversario' } | null> {
  const t = await token();
  if (!t) return null;
  try {
    const r = await fetch(`${olefootApiBase()}/api/filme/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${t}` } });
    const corpo = (await r.json().catch(() => null)) as { ok?: boolean; filme?: FilmeDaPartida; papel?: 'dono' | 'adversario' } | null;
    return corpo?.ok && corpo.filme && Array.isArray(corpo.filme.trechos) ? { filme: corpo.filme, papel: corpo.papel ?? 'dono' } : null;
  } catch {
    return null;
  }
}

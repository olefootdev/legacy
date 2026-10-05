/**
 * SMART-PROFILE no jogo — só LEITURA. Quem monta e grava a ficha é o servidor
 * (server/src/routes/playerProfiles.ts); aqui o jogo busca, guarda em memória
 * e avisa quem está na tela.
 *
 * O servidor sincroniza a ficha com o elenco salvo a cada busca. Por isso o
 * jogo busca de novo quando a ficha tem mais de um minuto — tempo de o elenco
 * evoluído depois de uma partida chegar ao banco.
 */
import { useEffect, useState } from 'react';
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import { getSupabase } from '@/supabase/client';

export interface Temperamento { ousadia: number; frieza: number; ambicao: number; lealdade: number }

export interface Ficha {
  player_id: string;
  origem: string;
  raridade: string;
  genese: { ovr: number; nascidaEm: string; origem: string };
  genese_hash: string;
  ovr: number;
  classe: string;
  classe_afinidade: string | null;
  temperamento: Temperamento;
  tracos: unknown[];
  nivel: number;
  xp: number;
  cerebro: { espacos: number; ideias: unknown[] };
}

type Estado = { fichas: Map<string, Ficha>; buscadoEm: number; carregando: boolean; indisponivel: boolean };

let estado: Estado = { fichas: new Map(), buscadoEm: 0, carregando: false, indisponivel: false };
const ouvintes = new Set<(e: Estado) => void>();
const VALIDADE_MS = 60_000;

function publicar(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial };
  for (const o of ouvintes) o(estado);
}

export async function buscarFichas(forcar = false): Promise<void> {
  if (estado.carregando) return;
  if (!forcar && Date.now() - estado.buscadoEm < VALIDADE_MS) return;
  const sb = getSupabase();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  if (!token) return; // sem sessão (modo visitante): o jogo segue sem ficha
  publicar({ carregando: true });
  try {
    const r = await fetch(`${olefootApiBase()}/api/player-profiles`, { headers: { Authorization: `Bearer ${token}` } });
    const data = (await r.json().catch(() => null)) as { ok?: boolean; fichas?: Ficha[]; indisponivel?: boolean } | null;
    if (r.ok && data?.ok) {
      publicar({ fichas: new Map((data.fichas ?? []).map((f) => [f.player_id, f])), buscadoEm: Date.now(), indisponivel: !!data.indisponivel });
    }
  } catch {
    // Rede fora: mantém o que já tinha. A ficha é complemento, nunca trava a tela.
  } finally {
    publicar({ carregando: false });
  }
}

/** A ficha de um jogador (ou null enquanto não chega / se ainda não existe). */
export function useFicha(playerId: string | null | undefined): { ficha: Ficha | null; carregando: boolean } {
  const [e, setE] = useState(estado);
  useEffect(() => {
    ouvintes.add(setE);
    void buscarFichas();
    return () => { ouvintes.delete(setE); };
  }, []);
  return { ficha: playerId ? e.fichas.get(playerId) ?? null : null, carregando: e.carregando };
}

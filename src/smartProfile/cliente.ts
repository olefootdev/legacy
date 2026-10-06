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

/** Catálogo e curva vêm do SERVIDOR (Fase 4): o cliente não duplica número. */
export interface TracoDoCatalogo { id: string; nome: string; comoSeGanha: string; atributo: string; bonus: number }
export interface IdeiaDoCatalogo {
  id: string; nivel: number; setores: string[];
  exige: { eixo: string; minimo: number };
  efeito: Record<string, number>;
}
export interface Rpg { tracos: TracoDoCatalogo[]; curvaDeXp: number[]; ideias: IdeiaDoCatalogo[] }

type Estado = { fichas: Map<string, Ficha>; rpg: Rpg | null; buscadoEm: number; carregando: boolean; indisponivel: boolean };

let estado: Estado = { fichas: new Map(), rpg: null, buscadoEm: 0, carregando: false, indisponivel: false };
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
    const data = (await r.json().catch(() => null)) as { ok?: boolean; fichas?: Ficha[]; rpg?: Rpg; indisponivel?: boolean } | null;
    if (r.ok && data?.ok) {
      publicar({
        fichas: new Map((data.fichas ?? []).map((f) => [f.player_id, f])),
        rpg: data.rpg ?? estado.rpg,
        buscadoEm: Date.now(),
        indisponivel: !!data.indisponivel,
      });
    }
  } catch {
    // Rede fora: mantém o que já tinha. A ficha é complemento, nunca trava a tela.
  } finally {
    publicar({ carregando: false });
  }
}

/** A ficha de um jogador (ou null enquanto não chega / se ainda não existe). */
export function useFicha(playerId: string | null | undefined): { ficha: Ficha | null; carregando: boolean; rpg: Rpg | null } {
  const [e, setE] = useState(estado);
  useEffect(() => {
    ouvintes.add(setE);
    void buscarFichas();
    return () => { ouvintes.delete(setE); };
  }, []);
  return { ficha: playerId ? e.fichas.get(playerId) ?? null : null, carregando: e.carregando, rpg: e.rpg };
}

/**
 * MANAGER-IDEAS (Fase 5) — o manager ensina ou faz o jogador esquecer.
 *
 * Quem decide se o jogador aceita é o SERVIDOR: a regra (espaço, nível, setor,
 * temperamento) não mora aqui. A tela manda a intenção e mostra a recusa.
 * Em caso de sucesso, recarrega as fichas pra ficha refletir o cérebro novo.
 */
export async function mexerNoCerebro(
  playerId: string,
  acao: { ensinar: string } | { esquecer: string },
): Promise<{ ok: true } | { ok: false; erro: string; detalhe?: string }> {
  const sb = getSupabase();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  if (!token) return { ok: false, erro: 'sem-sessao' };
  try {
    const r = await fetch(`${olefootApiBase()}/api/player-profiles/${encodeURIComponent(playerId)}/cerebro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(acao),
    });
    const data = (await r.json().catch(() => null)) as { ok?: boolean; erro?: string; detalhe?: string } | null;
    if (!r.ok || !data?.ok) return { ok: false, erro: data?.erro ?? 'falhou', detalhe: data?.detalhe };
    await buscarFichas(true);
    return { ok: true };
  } catch {
    return { ok: false, erro: 'sem-rede' };
  }
}

/**
 * Elenco da Fundação do Clube (Fase 2, 2026-10-07) — lado do cliente.
 *
 * O SERVIDOR sorteia (`POST /api/onboarding/sorteio`: 12 Genesis + 3 cards
 * premium com 35/25/15% de Lenda Edição Fundação + faixa de EXP) e grava; aqui
 * só montamos os PlayerEntity com os mapeadores de sempre:
 *   · Genesis → contrato de boas-vindas (70 jogos), id `genesis-<row>`;
 *   · Lenda   → EDIÇÃO FUNDAÇÃO: `legacyRowToPlayerEntity`, id `fundacao-<row>`
 *     (não colide com card comprado), contrato vitalício, não se vende nem se
 *     empresta (o servidor recusa — `ehEdicaoFundacao`).
 */
import { buildDefaultLineup } from '@/entities/lineup';
import type { PlayerEntity } from '@/entities/types';
import { fetchGenesisMarketPlayerRowsOrdered, mergeGenesisRowWithSavedPlayer } from '@/supabase/genesisMarket';
import { fetchAllLegacyPlayerRows, legacyRowToPlayerEntity } from '@/supabase/legacyPlayers';
import { getSupabase } from '@/supabase/client';
import { STARTER_EXP_TIERS } from './rollStarterExp';

const ENV = (import.meta as { env?: Record<string, string | undefined> }).env;
const API_BASE = ENV?.VITE_OLEFOOT_API_URL || ENV?.VITE_API_URL || 'http://localhost:4000';

/** Contrato do pacote de boas-vindas (mesmo da cerimônia antiga). */
const CONTRATO_BOAS_VINDAS = 70;
/** Janela da Estreia: 7 dias de pré-temporada a partir do elenco recebido. */
export const DIAS_DA_JANELA = 7;

export interface SorteioFundacao {
  versao: 1;
  genesis: string[];
  premium: Array<{ tipo: 'lenda' | 'premium'; id: string; chance: number }>;
  expTier: number;
  sorteadoEm: string;
}

export interface CartaDoSorteio {
  playerId: string;
  origem: 'genesis' | 'premium' | 'lenda';
  /** Só nos 3 cards premium: a chance de lenda daquele card. */
  chance?: number;
}

export interface ElencoDaFundacao {
  players: Record<string, PlayerEntity>;
  lineup: Record<string, string>;
  cartas: CartaDoSorteio[];
  expInicial: number;
  /** Ids que a várzea compra na Janela (o pacote — nunca a Edição Fundação). */
  pacote: string[];
}

export function ehEdicaoFundacao(p: Pick<PlayerEntity, 'id'> & { edicaoFundacao?: boolean }): boolean {
  return p.edicaoFundacao === true || p.id.startsWith('fundacao-');
}

/** Pede o sorteio ao servidor. Repetir devolve o MESMO sorteio. */
export async function pedirSorteio(): Promise<{ ok: true; sorteio: SorteioFundacao } | { ok: false; erro: string }> {
  try {
    const sb = getSupabase();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    if (!token) return { ok: false, erro: 'Sessão expirada. Entra de novo.' };
    const res = await fetch(`${API_BASE}/api/onboarding/sorteio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: '{}',
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; sorteio?: SorteioFundacao; error?: string } | null;
    if (!res.ok || !body?.ok || !body.sorteio) return { ok: false, erro: body?.error ?? `Servidor respondeu ${res.status}.` };
    return { ok: true, sorteio: body.sorteio };
  } catch {
    return { ok: false, erro: 'Sem conexão com o servidor.' };
  }
}

function comContratoDeBoasVindas(p: PlayerEntity): PlayerEntity {
  return {
    ...p,
    contractIsLifetime: false,
    contractExpired: false,
    contractMatchesRemaining: CONTRATO_BOAS_VINDAS,
    contractMatchesIncluded: CONTRATO_BOAS_VINDAS,
    listedOnMarket: false,
  };
}

/** Monta o elenco a partir do sorteio (ids → jogadores reais do catálogo). */
export async function montarElencoDaFundacao(s: SorteioFundacao): Promise<ElencoDaFundacao | null> {
  const [genesisRows, legacyRows] = await Promise.all([fetchGenesisMarketPlayerRowsOrdered(), fetchAllLegacyPlayerRows()]);
  const genPorId = new Map(genesisRows.map((r) => [String(r.id), r]));
  const legPorId = new Map(legacyRows.map((r) => [String(r.id), r]));

  const players: Record<string, PlayerEntity> = {};
  const cartas: CartaDoSorteio[] = [];
  const pacote: string[] = [];

  const addGenesis = (rowId: string, origem: 'genesis' | 'premium', chance?: number): boolean => {
    const row = genPorId.get(rowId);
    if (!row) return false;
    const pid = `genesis-${row.id}`;
    players[pid] = comContratoDeBoasVindas(mergeGenesisRowWithSavedPlayer(row, undefined));
    cartas.push({ playerId: pid, origem, chance });
    pacote.push(pid);
    return true;
  };

  for (const id of s.genesis) if (!addGenesis(id, 'genesis')) return null;
  for (const card of s.premium) {
    if (card.tipo === 'lenda') {
      const row = legPorId.get(card.id);
      if (!row) return null;
      const base = legacyRowToPlayerEntity(row);
      const pid = `fundacao-${String(row.id).replace(/^legacy-/, '')}`;
      players[pid] = {
        ...base,
        id: pid,
        edicaoFundacao: true,
        contractIsLifetime: true,
        contractExpired: false,
        listedOnMarket: false,
      };
      cartas.push({ playerId: pid, origem: 'lenda', chance: card.chance });
    } else if (!addGenesis(card.id, 'premium', card.chance)) {
      return null;
    }
  }

  const tier = STARTER_EXP_TIERS[s.expTier] ?? STARTER_EXP_TIERS[1]!;
  return { players, lineup: buildDefaultLineup(players), cartas, expInicial: tier.amount, pacote };
}

import { buildDefaultLineup } from '@/entities/lineup';
import type { PlayerEntity } from '@/entities/types';
import { dispatchGame, getGameState } from '@/game/store';
import { makeInboxItem } from '@/game/inboxItem';
import { getSupabase, isSupabaseConfigured } from '@/supabase/client';
import {
  fetchGenesisMarketPlayerRowsOrdered,
  mergeGenesisRowWithSavedPlayer,
  type GenesisMarketPlayerRow,
} from '@/supabase/genesisMarket';
import { isFeatureEnabled, loadPlatformConfigOnce } from '@/admin/platformConfigStore';

/** Incrementar quando mudar regras do pack (re-entrega controlada no futuro). */
export const WELCOME_GENESIS_PACK_VERSION = 2;

const WELCOME_CONTRACT_MATCHES = 70;
const WELCOME_PACK_TAG = 'welcomepack';
const WELCOME_BENCH_COUNT = 9; // 11 starters + 9 bench = 20 total (entrega a lista WP inteira)
const WELCOME_EXP_GRANT = 500_000; // saldo inicial de EXP pra cada manager que abre o welcome pack

/**
 * Verifica server-side se este manager já recebeu o welcome pack.
 * Guard primário — independente do localStorage.
 */
export async function hasServerGrant(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data: sessData } = await sb.auth.getSession();
  const uid = sessData?.session?.user?.id ?? null;
  if (!uid) return false;
  const { data, error } = await sb
    .from('welcome_pack_grants')
    .select('user_id')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) return false;
  return data !== null;
}

/**
 * Reserva atômica de 1 slot via RPC. Retorna null se Supabase off ou sem auth.
 *
 * Usa getSession() (lê do storage local, sincrónico após signUp) em vez de
 * getUser() (faz round-trip ao server e pode falhar logo depois do signup
 * por causa de propagação do token).
 */
export async function claimWelcomePackSlot(): Promise<
  { claimed: boolean; remaining: number } | null
> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: sessData } = await sb.auth.getSession();
  const uid = sessData?.session?.user?.id ?? null;
  if (!uid) {
    console.warn('[welcomePack] sem sess\u00e3o ap\u00f3s signup; n\u00e3o foi poss\u00edvel reservar slot.');
    return null;
  }
  const { data, error } = await sb.rpc('claim_welcome_pack', { p_manager_id: uid });
  if (error) {
    console.warn('[welcomePack] claim_welcome_pack:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    claimed: Boolean((row as { claimed: boolean }).claimed),
    remaining: Number((row as { remaining: number }).remaining ?? 0),
  };
}

/** Ordem alinhada a `PITCH_SLOT_ORDER` em `entities/lineup.ts` (rótulos de posição na ficha). */
const WELCOME_STARTER_POS_SEQUENCE = [
  'PE',
  'ATA',
  'PD',
  'MC',
  'VOL',
  'MC',
  'LE',
  'ZAG',
  'ZAG',
  'LD',
  'GOL',
] as const;

const POS_ALIASES: Record<string, string> = {
  MEI: 'MC',
  MCO: 'MC',
  MD: 'MC',
  MC: 'MC',
  VOL: 'VOL',
  DM: 'VOL',
  CDM: 'VOL',
  ZAG: 'ZAG',
  CB: 'ZAG',
  LE: 'LE',
  LB: 'LE',
  LD: 'LD',
  RB: 'LD',
  GOL: 'GOL',
  GK: 'GOL',
  GOLEIRO: 'GOL',
  ATA: 'ATA',
  ST: 'ATA',
  CF: 'ATA',
  PE: 'PE',
  LW: 'PE',
  PD: 'PD',
  RW: 'PD',
};

function normCatalogPos(raw: string | null | undefined): string {
  const u = (raw ?? '').trim().toUpperCase();
  return POS_ALIASES[u] ?? u;
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
}

/**
 * Escolhe 11 titulares (uma passagem por posição na ordem do campo) + 9 reservas aleatórias.
 * Exclui linhas `contract_is_lifetime` do pool de boas-vindas (pack = sempre 70 jogos).
 * IMPORTANTE: Apenas jogadores com `listed_on_market: true` são elegíveis.
 */
export function selectWelcomeGenesisRows(rows: GenesisMarketPlayerRow[]): {
  starters: GenesisMarketPlayerRow[];
  bench: GenesisMarketPlayerRow[];
} | null {
  // Prioriza linhas marcadas pelo admin como 'welcomepack' E listadas; se insuficientes, cai pro catálogo geral listado.
  const tagged = rows.filter(
    (r) =>
      r?.id &&
      r.contract_is_lifetime !== true &&
      r.listed_on_market === true &&
      (r as unknown as { admin_market_tag?: string | null }).admin_market_tag === WELCOME_PACK_TAG,
  );
  const general = rows.filter((r) => r?.id && r.contract_is_lifetime !== true && r.listed_on_market === true);
  const needed = WELCOME_STARTER_POS_SEQUENCE.length + WELCOME_BENCH_COUNT;
  const pool = (tagged.length >= needed ? tagged : general).sort(
    (a, b) => (a.kit_number ?? 0) - (b.kit_number ?? 0),
  );
  const byId = new Map(pool.map((r) => [r.id, r]));
  if (byId.size < needed) return null;

  const used = new Set<string>();
  const starters: GenesisMarketPlayerRow[] = [];

  const takeExact = (want: string): GenesisMarketPlayerRow | null => {
    for (const r of pool) {
      if (used.has(r.id)) continue;
      if (normCatalogPos(r.pos) === want) {
        used.add(r.id);
        return r;
      }
    }
    return null;
  };

  const takeAny = (): GenesisMarketPlayerRow | null => {
    for (const r of pool) {
      if (used.has(r.id)) continue;
      used.add(r.id);
      return r;
    }
    return null;
  };

  for (const want of WELCOME_STARTER_POS_SEQUENCE) {
    const pick = takeExact(want) ?? takeAny();
    if (!pick) return null;
    starters.push(pick);
  }

  const benchPool = pool.filter((r) => !used.has(r.id));
  shuffleInPlace(benchPool);
  const bench = benchPool.slice(0, WELCOME_BENCH_COUNT);
  if (bench.length < WELCOME_BENCH_COUNT) return null;

  return { starters, bench };
}

function applyWelcomeContract(entity: PlayerEntity): PlayerEntity {
  return {
    ...entity,
    contractIsLifetime: false,
    contractExpired: false,
    contractMatchesRemaining: WELCOME_CONTRACT_MATCHES,
    contractMatchesIncluded: WELCOME_CONTRACT_MATCHES,
    listedOnMarket: false,
  };
}

export type WelcomeGenesisPackResult =
  | { ok: true; position?: number; remaining?: number }
  | {
      ok: false;
      reason:
        | 'already_granted'
        | 'squad_not_empty'
        | 'no_supabase'
        | 'insufficient_catalog'
        | 'selection_failed'
        | 'feature_disabled'
        | 'limit_reached';
    };

/**
 * Entrega 16 jogadores Genesis (11 + 5), contrato 70 jogos, escalação por `buildDefaultLineup`,
 * marca `userSettings.welcomeGenesisPackVersion` e notifica a caixa de entrada.
 * Idempotente: não faz nada se o pack já foi aplicado ou o plantel não está vazio.
 */
export async function tryGrantWelcomeGenesisPack(): Promise<WelcomeGenesisPackResult> {
  const st0 = getGameState();

  // Guard server-side primário — independente do localStorage
  if (isSupabaseConfigured()) {
    const alreadyGranted = await hasServerGrant();
    if (alreadyGranted) return { ok: false, reason: 'already_granted' };
  } else {
    // Fallback local apenas quando Supabase não está configurado
    if ((st0.userSettings.welcomeGenesisPackVersion ?? 0) >= WELCOME_GENESIS_PACK_VERSION) {
      return { ok: false, reason: 'already_granted' };
    }
  }

  if (Object.keys(st0.players).length > 0) {
    return { ok: false, reason: 'squad_not_empty' };
  }
  if (!isSupabaseConfigured()) {
    return { ok: false, reason: 'no_supabase' };
  }

  // Feature flag: admin pode desligar o welcome pack sem redeploy.
  await loadPlatformConfigOnce();
  if (!isFeatureEnabled('WELCOME_PACK')) {
    return { ok: false, reason: 'feature_disabled' };
  }

  // Reserva 1 slot do teto global (primeiros N managers).
  const slot = await claimWelcomePackSlot();
  if (slot && !slot.claimed) {
    return { ok: false, reason: 'limit_reached' };
  }

  const rows = await fetchGenesisMarketPlayerRowsOrdered();
  const needed = WELCOME_STARTER_POS_SEQUENCE.length + WELCOME_BENCH_COUNT;
  if (rows.length < needed) {
    return { ok: false, reason: 'insufficient_catalog' };
  }

  const picked = selectWelcomeGenesisRows(rows);
  if (!picked) {
    return { ok: false, reason: 'selection_failed' };
  }

  const allRows = [...picked.starters, ...picked.bench];
  const players: Record<string, PlayerEntity> = {};
  for (const row of allRows) {
    const pid = `genesis-${row.id}`;
    const merged = mergeGenesisRowWithSavedPlayer(row, st0.players[pid]);
    players[pid] = applyWelcomeContract(merged);
  }

  dispatchGame({ type: 'MERGE_PLAYERS', players });

  const st1 = getGameState();
  const lu = buildDefaultLineup(st1.players);
  dispatchGame({
    type: 'SET_LINEUP',
    lineup: lu,
    formationScheme: st1.manager.formationScheme,
  });

  dispatchGame({
    type: 'SET_USER_SETTINGS',
    partial: { welcomeGenesisPackVersion: WELCOME_GENESIS_PACK_VERSION },
  });

  // Saldo inicial de EXP pro manager — investimento em mercado, City, etc.
  dispatchGame({
    type: 'ADMIN_GRANT_RESOURCES',
    earnedExp: WELCOME_EXP_GRANT,
  });

  const positionLine =
    slot && slot.claimed
      ? ` És o manager nº ${slot.remaining != null ? '' : ''}— ${slot.remaining} pack${slot.remaining === 1 ? '' : 's'} ainda disponível${slot.remaining === 1 ? '' : 'is'}.`
      : '';
  const note = makeInboxItem('welcome-genesis-pack-v1', 'SHOP_PACK', 'PLANTEL', 'Pack de boas-vindas OLE', {
    body:
      `Recebeste 11 jogadores Genesis titulares + ${WELCOME_BENCH_COUNT} reservas + ${WELCOME_EXP_GRANT.toLocaleString('pt-BR')} EXP iniciais. Cada jogador tem ${WELCOME_CONTRACT_MATCHES} jogos de contrato (amistosos e oficiais).${positionLine} Boa sorte, treinador — vê o plantel em Equipe.`,
    deepLink: '/team',
  });
  dispatchGame({ type: 'INBOX_PREPEND', item: note });

  return { ok: true, remaining: slot?.remaining };
}

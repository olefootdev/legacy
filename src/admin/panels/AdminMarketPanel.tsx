import { useEffect, useMemo, useState } from 'react';
import { Package, ShoppingBag, Tag, ToggleLeft, ToggleRight, Gift } from 'lucide-react';
import { useGameDispatch, useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import { playerPortraitSrc } from '@/lib/playerPortrait';
import { cn } from '@/lib/utils';
import type { PlayerEntity } from '@/entities/types';
import {
  fetchGenesisMarketPlayerRowsOrdered,
  mergeGenesisRowWithSavedPlayer,
} from '@/supabase/genesisMarket';
import { getSupabase } from '@/supabase/client';

const COLLECTION_WELCOMEPACK = 'welcomepack';

const RARITY_LABEL: Record<string, string> = {
  normal: 'Normal',
  ouro: 'Ouro',
  epico: 'Épico',
  lenda: 'Lenda',
  genesis: 'Genesis',
};

const RARITY_COLOR: Record<string, string> = {
  normal: 'text-gray-400',
  ouro: 'text-yellow-400',
  epico: 'text-purple-400',
  lenda: 'text-orange-400',
  genesis: 'text-neon-yellow',
};

type SubTab = 'jogadores' | 'colecoes';

function useAdminPlayers(): { players: PlayerEntity[]; fetchError: string | null } {
  const dispatch = useGameDispatch();
  const players = useGameStore((s) => s.players);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetchGenesisMarketPlayerRowsOrdered()
      .then((rows) => {
        const toMerge: Record<string, PlayerEntity> = {};
        for (const row of rows) {
          const pid = `genesis-${row.id}`;
          if (!players[pid]) {
            toMerge[pid] = mergeGenesisRowWithSavedPlayer(row, undefined);
          }
        }
        if (Object.keys(toMerge).length > 0) {
          dispatch({ type: 'MERGE_PLAYERS', players: toMerge });
        }
        setFetchError(null);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[AdminMarketPanel] fetch genesis players failed:', err);
        setFetchError(msg || 'Falha ao carregar catálogo Genesis do Supabase.');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () =>
      (Object.values(players) as PlayerEntity[]).filter(
        (p) => !p.managerCreated,
      ),
    [players],
  );

  return { players: filtered, fetchError };
}

function StatusBadge({ listed }: { listed: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        listed
          ? 'bg-green-500/15 text-green-400'
          : 'bg-white/5 text-gray-500',
      )}
    >
      {listed ? 'Listado' : 'Inativo'}
    </span>
  );
}

function CollectionBadge({ collectionId }: { collectionId?: string }) {
  if (!collectionId) return null;
  const isWelcome = collectionId === COLLECTION_WELCOMEPACK;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        isWelcome
          ? 'bg-neon-yellow/15 text-neon-yellow'
          : 'bg-blue-500/15 text-blue-400',
      )}
    >
      {isWelcome && <Gift className="h-2.5 w-2.5" />}
      {collectionId}
    </span>
  );
}

function PlayerRow({ player }: { player: PlayerEntity }) {
  const dispatch = useGameDispatch();
  const ovr = overallFromAttributes(player.attrs, player.pos);
  const listed = player.listedOnMarket === true;

  const toggleListed = () => {
    const nextListed = !listed;
    dispatch({ type: 'ADMIN_SET_PLAYER_LISTED', playerId: player.id, listed: nextListed });
    // Persiste em genesis_market_players.listed_on_market se for jogador Genesis.
    const catalogId = player.id.startsWith('genesis-')
      ? player.id.replace(/^genesis-/, '')
      : null;
    const sb = getSupabase();
    if (catalogId && sb) {
      void sb
        .from('genesis_market_players')
        .update({ listed_on_market: nextListed, updated_at: new Date().toISOString() })
        .eq('id', catalogId)
        .then(({ error }) => {
          if (error) console.error('[AdminMarketPanel] persist listed_on_market:', error.message);
        });
    }
  };

  const toggleWelcomepack = () => {
    const next = player.adminMarketTag === COLLECTION_WELCOMEPACK ? undefined : COLLECTION_WELCOMEPACK;
    dispatch({ type: 'ADMIN_SET_PLAYER_COLLECTION', playerId: player.id, collectionId: next });
    // Persiste no Supabase (genesis_market_players.admin_market_tag) se for jogador Genesis.
    const catalogId = player.id.startsWith('genesis-')
      ? player.id.replace(/^genesis-/, '')
      : null;
    const sb = getSupabase();
    if (catalogId && sb) {
      void sb
        .from('genesis_market_players')
        .update({ admin_market_tag: next ?? null, updated_at: new Date().toISOString() })
        .eq('id', catalogId)
        .then(({ error }) => {
          if (error) console.error('[AdminMarketPanel] persist admin_market_tag:', error.message);
        });
    }
  };

  return (
    <tr className="border-b border-white/5 transition-colors hover:bg-white/[0.02]">
      <td className="py-2 pl-3 pr-2">
        <div className="flex items-center gap-2">
          <img
            src={playerPortraitSrc(player, 40, 40)}
            alt={player.name}
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
          <div>
            <p className="text-xs font-semibold text-white">{player.name}</p>
            <p className="text-[10px] text-gray-500">{player.id.slice(0, 12)}…</p>
          </div>
        </div>
      </td>
      <td className="px-2 py-2 text-center">
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {player.pos}
        </span>
      </td>
      <td className="px-2 py-2 text-center">
        <span className="text-xs font-bold text-neon-yellow">{ovr}</span>
      </td>
      <td className="px-2 py-2">
        <span className={cn('text-[10px] font-semibold', RARITY_COLOR[player.rarity ?? 'normal'])}>
          {RARITY_LABEL[player.rarity ?? 'normal'] ?? player.rarity ?? '—'}
        </span>
      </td>
      <td className="px-2 py-2">
        <CollectionBadge collectionId={player.adminMarketTag} />
      </td>
      <td className="px-2 py-2">
        <StatusBadge listed={listed} />
      </td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleListed}
            title={listed ? 'Tornar Inativo' : 'Listar no Mercado'}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase transition-all',
              listed
                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'bg-green-500/10 text-green-400 hover:bg-green-500/20',
            )}
          >
            {listed ? <ToggleLeft className="h-3 w-3" /> : <ToggleRight className="h-3 w-3" />}
            {listed ? 'Inativar' : 'Listar'}
          </button>
          <button
            type="button"
            onClick={toggleWelcomepack}
            title={
              player.adminMarketTag === COLLECTION_WELCOMEPACK
                ? 'Remover do Welcome Pack'
                : 'Adicionar ao Welcome Pack'
            }
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase transition-all',
              player.adminMarketTag === COLLECTION_WELCOMEPACK
                ? 'bg-neon-yellow/10 text-neon-yellow hover:bg-neon-yellow/20'
                : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white',
            )}
          >
            <Gift className="h-3 w-3" />
            WP
          </button>
        </div>
      </td>
    </tr>
  );
}

function JogadoresTab() {
  const { players, fetchError } = useAdminPlayers();
  const [filter, setFilter] = useState<'all' | 'listed' | 'inactive' | 'welcomepack'>('all');

  const filtered = useMemo((): PlayerEntity[] => {
    if (filter === 'listed') return players.filter((p) => p.listedOnMarket === true);
    if (filter === 'inactive') return players.filter((p) => p.listedOnMarket !== true);
    if (filter === 'welcomepack') return players.filter((p) => p.adminMarketTag === COLLECTION_WELCOMEPACK);
    return players;
  }, [players, filter]);

  const listedCount = players.filter((p) => p.listedOnMarket === true).length;
  const wpCount = players.filter((p) => p.adminMarketTag === COLLECTION_WELCOMEPACK).length;

  return (
    <div className="space-y-4">
      {fetchError ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
          <span className="font-bold text-red-200">Falha ao carregar Supabase:</span> {fetchError}
        </div>
      ) : null}
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <p className="text-lg font-black text-white">{players.length}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total</p>
        </div>
        <div className="rounded-xl border border-green-500/20 bg-green-500/[0.05] p-3 text-center">
          <p className="text-lg font-black text-green-400">{listedCount}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Listados</p>
        </div>
        <div className="rounded-xl border border-neon-yellow/20 bg-neon-yellow/[0.05] p-3 text-center">
          <p className="text-lg font-black text-neon-yellow">{wpCount}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Welcome Pack</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'all', label: 'Todos' },
            { id: 'listed', label: 'Listados' },
            { id: 'inactive', label: 'Inativos' },
            { id: 'welcomepack', label: 'Welcome Pack' },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all',
              filter === f.id
                ? 'bg-neon-yellow text-black'
                : 'bg-white/5 text-gray-400 hover:bg-white/10',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] py-12 text-center text-gray-500 text-sm">
          Nenhum jogador encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[600px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-500">
                <th className="py-2 pl-3 pr-2">Jogador</th>
                <th className="px-2 py-2 text-center">Pos</th>
                <th className="px-2 py-2 text-center">OVR</th>
                <th className="px-2 py-2">Raridade</th>
                <th className="px-2 py-2">Coleção</th>
                <th className="px-2 py-2">Status</th>
                <th className="py-2 pr-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(filtered as PlayerEntity[]).map((p: PlayerEntity) => {
                const row = <PlayerRow player={p} />;
                return { ...row, key: p.id };
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ColecoesTab() {
  const { players } = useAdminPlayers();

  const welcomepackPlayers = useMemo(
    () => players.filter((p) => p.adminMarketTag === COLLECTION_WELCOMEPACK),
    [players],
  );
  const listedWP = welcomepackPlayers.filter((p) => p.listedOnMarket === true);

  const dispatch = useGameDispatch();

  const removeFromWP = (playerId: string) => {
    dispatch({ type: 'ADMIN_SET_PLAYER_COLLECTION', playerId, collectionId: undefined });
    // Persiste no Supabase (genesis_market_players.admin_market_tag) se for jogador Genesis.
    const catalogId = playerId.startsWith('genesis-') ? playerId.replace(/^genesis-/, '') : null;
    const sb = getSupabase();
    if (catalogId && sb) {
      void sb
        .from('genesis_market_players')
        .update({ admin_market_tag: null, updated_at: new Date().toISOString() })
        .eq('id', catalogId)
        .then(({ error }) => {
          if (error) console.error('[AdminMarketPanel] persist remove admin_market_tag:', error.message);
        });
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Pack */}
      <div className="rounded-xl border border-neon-yellow/20 bg-neon-yellow/[0.04]">
        <div className="flex items-center gap-3 border-b border-neon-yellow/10 px-4 py-3">
          <Gift className="h-5 w-5 text-neon-yellow" />
          <div>
            <h3 className="text-sm font-bold text-white">Welcome Pack</h3>
            <p className="text-[10px] text-gray-400">
              Jogadores entregues gratuitamente a todos os novos managers no cadastro.
              Apenas os que estiverem <strong className="text-green-400">Listados</strong> são entregues.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3 text-right">
            <div>
              <p className="text-lg font-black text-neon-yellow">{listedWP.length}</p>
              <p className="text-[10px] text-gray-500">Ativos</p>
            </div>
            <div>
              <p className="text-lg font-black text-white">{welcomepackPlayers.length}</p>
              <p className="text-[10px] text-gray-500">Total</p>
            </div>
          </div>
        </div>

        {welcomepackPlayers.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">
            Nenhum jogador no Welcome Pack ainda.
            <br />
            <span className="text-[10px]">Use o botão "WP" na aba Jogadores para adicionar.</span>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {welcomepackPlayers.map((p) => {
              const ovr = overallFromAttributes(p.attrs, p.pos);
              const listed = p.listedOnMarket === true;
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <img
                    src={playerPortraitSrc(p, 40, 40)}
                    alt={p.name}
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-semibold text-white">{p.name}</p>
                    <p className="text-[10px] text-gray-500">{p.pos} · OVR {ovr}</p>
                  </div>
                  <StatusBadge listed={listed} />
                  {!listed && (
                    <span className="text-[10px] text-yellow-500">⚠ Inativo — não será entregue</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFromWP(p.id)}
                    className="rounded-lg bg-red-500/10 px-2.5 py-1 text-[10px] font-bold uppercase text-red-400 hover:bg-red-500/20 transition-all"
                  >
                    Remover
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4 text-[11px] text-gray-500 leading-relaxed">
        <p className="font-semibold text-white mb-1">Como funciona o Welcome Pack?</p>
        <p>
          Jogadores marcados com <span className="text-neon-yellow font-bold">WP</span> e com status{' '}
          <span className="text-green-400 font-bold">Listado</span> são entregues automaticamente
          a cada novo manager ao se registrar. Basta adicionar os jogadores no Welcome Pack via
          a aba Jogadores e garantir que estão Listados.
        </p>
      </div>
    </div>
  );
}

export function AdminMarketPanel() {
  const [subTab, setSubTab] = useState<SubTab>('jogadores');

  const SUB_TABS: { id: SubTab; label: string; icon: typeof ShoppingBag }[] = [
    { id: 'jogadores', label: 'Jogadores', icon: ShoppingBag },
    { id: 'colecoes', label: 'Coleções', icon: Package },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Tag className="h-5 w-5 text-neon-yellow" />
        <div>
          <h2 className="text-lg font-black text-white">Market</h2>
          <p className="text-[11px] text-gray-400">
            Controle quais jogadores aparecem no mercado e gerencie coleções.
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-xl bg-white/5 p-1">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition-all',
              subTab === t.id
                ? 'bg-neon-yellow text-black shadow'
                : 'text-gray-400 hover:text-white',
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'jogadores' && <JogadoresTab />}
      {subTab === 'colecoes' && <ColecoesTab />}
    </div>
  );
}

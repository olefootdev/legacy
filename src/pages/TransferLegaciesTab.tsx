import { useEffect, useMemo, useState } from 'react';
import { Crown, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import {
  fetchListedLegacyPlayerRows,
  legacyPortraitImageUrl,
  legacyRowToPlayerEntity,
  type LegacyPlayerRow,
} from '@/supabase/legacyPlayers';

export function TransferLegaciesTab() {
  const dispatch = useGameDispatch();
  const oleBal = useGameStore((s) => s.finance.ole);
  const playersById = useGameStore((s) => s.players);
  const [rows, setRows] = useState<LegacyPlayerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchListedLegacyPlayerRows().then((data) => {
      if (cancelled) return;
      setRows(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const owned = useMemo(() => {
    const set = new Set<string>();
    for (const pid of Object.keys(playersById)) if (pid.startsWith('legacy-')) set.add(pid);
    return set;
  }, [playersById]);

  const buy = (row: LegacyPlayerRow) => {
    const entity = legacyRowToPlayerEntity(row);
    const priceExp = Math.max(1, Math.round(row.price_bro_cents));
    if (oleBal < priceExp) {
      window.alert('Saldo OLE insuficiente.');
      return;
    }
    if (owned.has(entity.id)) {
      window.alert('Você já possui esse legacy.');
      return;
    }
    dispatch({ type: 'BUY_LEGACY_PLAYER', player: entity, priceExp });
  };

  if (loading) {
    return <div className="py-10 text-center text-sm text-gray-500">Carregando legacies…</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-white/[0.02] py-12 text-center text-sm text-gray-500">
        Nenhum Legacy disponível no momento.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => {
        const entity = legacyRowToPlayerEntity(row);
        const ovr = overallFromAttributes(entity.attrs);
        const portrait = legacyPortraitImageUrl(row);
        const priceExp = Math.max(1, Math.round(row.price_bro_cents));
        const isOwned = owned.has(entity.id);
        const canAfford = oleBal >= priceExp;
        const boosterEntries = Object.entries(row.team_booster ?? {});
        return (
          <div
            key={row.id}
            className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.06] to-black p-4"
          >
            <div className="flex items-start gap-3">
              {portrait ? (
                <img src={portrait} alt={entity.name} className="h-14 w-14 rounded-full object-cover ring-2 ring-amber-500/40" />
              ) : (
                <div className="grid h-14 w-14 place-items-center rounded-full bg-amber-500/20 text-amber-400">
                  <Crown className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Crown className="h-3 w-3 text-amber-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Legacy DNA</span>
                </div>
                <p className="truncate text-sm font-black text-white">{entity.name}</p>
                <p className="text-[11px] text-gray-400">
                  {entity.pos} · OVR {ovr}
                  {row.country ? ` · ${row.country}` : ''}
                </p>
              </div>
            </div>

            {row.bio && <p className="mt-3 line-clamp-2 text-[11px] leading-snug text-gray-400">{row.bio}</p>}

            {(row.taught_attributes?.length ?? 0) > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-gray-500">Ensina</p>
                <div className="flex flex-wrap gap-1">
                  {row.taught_attributes.map((a) => (
                    <span key={a} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase text-amber-300">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {boosterEntries.length > 0 && (
              <div className="mt-2">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-gray-500">Booster (titular)</p>
                <div className="flex flex-wrap gap-1">
                  {boosterEntries.map(([k, v]) => (
                    <span key={k} className="rounded-full bg-green-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase text-green-300">
                      {k} +{v}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-sm font-black text-neon-yellow">
                <Coins className="h-3.5 w-3.5" />
                {priceExp.toLocaleString('pt-BR')} OLE
              </div>
              <button
                type="button"
                onClick={() => buy(row)}
                disabled={isOwned || !canAfford}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors',
                  isOwned
                    ? 'bg-white/5 text-gray-500'
                    : canAfford
                      ? 'bg-amber-500 text-black hover:bg-amber-400'
                      : 'bg-white/5 text-gray-500',
                )}
              >
                {isOwned ? 'Adquirido' : canAfford ? 'Comprar' : 'Sem saldo'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Aba PLANTEL da página /manager/scouts.
 *
 * Lista TODOS os jogadores do plantel do manager — não só os afetados.
 * Cruza dados locais (store) com agregação do Python (consequences por
 * jogador) pra mostrar painel de transparência real.
 *
 * Default sort: indisponíveis > mais alertas > maior OVR. Filtros: posição,
 * status, busca por nome.
 */
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Search, Filter, Users } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import type { PlayerEntity } from '@/entities/types';
import type { SquadOverview } from '@/insights/client';
import { cn } from '@/lib/utils';
import { ScoutPlayerCard } from './ScoutPlayerCard';

interface Props {
  /** Agregação por jogador do Python — pode ser null se serviço offline. */
  overview: SquadOverview | null;
}

type PosFilter = 'all' | 'GK' | 'DEF' | 'MID' | 'ATK';

const POS_GROUPS: Record<Exclude<PosFilter, 'all'>, Set<string>> = {
  GK: new Set(['GK']),
  DEF: new Set(['RB', 'CB', 'LB', 'RWB', 'LWB', 'SW']),
  MID: new Set(['CDM', 'CM', 'CAM', 'RM', 'LM']),
  ATK: new Set(['RW', 'LW', 'CF', 'ST', 'SS']),
};

function posInGroup(pos: string, group: Exclude<PosFilter, 'all'>): boolean {
  return POS_GROUPS[group].has(pos);
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded-sm text-[10px] font-display font-bold uppercase tracking-[0.16em] border transition',
        active
          ? 'bg-neon-yellow/15 text-neon-yellow border-neon-yellow/30'
          : 'bg-white/5 text-white/55 border-white/10 hover:border-white/25',
      )}
    >
      {children}
    </button>
  );
}

export function ScoutsPlantelTab({ overview }: Props) {
  const players = useGameStore((s) => s.players);
  const playerHealth = useGameStore((s) => s.playerHealth);
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState<PosFilter>('all');
  const [hideHealthy, setHideHealthy] = useState(false);

  const entriesById = useMemo(() => {
    const map = new Map<string, SquadOverview['players'][number]>();
    if (overview?.players) {
      for (const e of overview.players) map.set(e.player_id, e);
    }
    return map;
  }, [overview]);

  const sortedIds = useMemo(() => {
    if (!players) return [] as string[];
    const allPlayers = Object.values(players) as PlayerEntity[];

    // Filtros
    const filtered = allPlayers.filter((p) => {
      if (!p) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (posFilter !== 'all' && !posInGroup(p.pos, posFilter)) return false;
      if (hideHealthy) {
        const entry = entriesById.get(p.id);
        const out = playerHealth?.[p.id]?.outForMatches ?? 0;
        if (!entry?.is_unavailable && out === 0 && (entry?.active_count ?? 0) === 0) {
          return false;
        }
      }
      return true;
    });

    // Sort: indisponíveis > mais alertas > OVR desc
    filtered.sort((a, b) => {
      const ea = entriesById.get(a.id);
      const eb = entriesById.get(b.id);
      const ua = (ea?.is_unavailable ?? (playerHealth?.[a.id]?.outForMatches ?? 0) > 0) ? 1 : 0;
      const ub = (eb?.is_unavailable ?? (playerHealth?.[b.id]?.outForMatches ?? 0) > 0) ? 1 : 0;
      if (ua !== ub) return ub - ua;
      const aa = ea?.alerts ?? 0;
      const ab = eb?.alerts ?? 0;
      if (aa !== ab) return ab - aa;
      return overallFromAttributes(b.attrs) - overallFromAttributes(a.attrs);
    });

    return filtered.map((p) => p.id);
  }, [players, search, posFilter, hideHealthy, entriesById, playerHealth]);

  const totalCount = players ? Object.keys(players).length : 0;
  const affectedCount = overview?.total_players_affected ?? 0;
  const unavailableCount = overview?.total_unavailable ?? 0;

  if (totalCount === 0) {
    return (
      <div className="text-center py-12 px-4 rounded-sm bg-white/3 border border-dashed border-white/10">
        <Users size={28} className="text-white/30 mx-auto mb-3" />
        <p className="text-sm text-white/55">Plantel vazio.</p>
        <p className="text-[12px] text-white/35 mt-1">
          Compre jogadores no Mercado pra começar.
        </p>
      </div>
    );
  }

  return (
    <section aria-label="Plantel completo" className="space-y-3">
      {/* ── Faixa de filtros ──────────────────────────────────── */}
      <div className="space-y-2">
        {/* Busca */}
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar jogador..."
            className="w-full bg-white/5 border border-white/10 rounded-sm pl-8 pr-3 py-2 text-[12px] text-white/85 placeholder:text-white/30 focus:outline-none focus:border-neon-yellow/40 transition"
          />
        </div>

        {/* Posição */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <Filter size={11} className="text-white/40 shrink-0" />
          <FilterChip active={posFilter === 'all'} onClick={() => setPosFilter('all')}>
            Todos ({totalCount})
          </FilterChip>
          <FilterChip active={posFilter === 'GK'} onClick={() => setPosFilter('GK')}>
            GK
          </FilterChip>
          <FilterChip active={posFilter === 'DEF'} onClick={() => setPosFilter('DEF')}>
            Defesa
          </FilterChip>
          <FilterChip active={posFilter === 'MID'} onClick={() => setPosFilter('MID')}>
            Meio
          </FilterChip>
          <FilterChip active={posFilter === 'ATK'} onClick={() => setPosFilter('ATK')}>
            Ataque
          </FilterChip>
          <FilterChip active={hideHealthy} onClick={() => setHideHealthy(!hideHealthy)}>
            Só afetados
          </FilterChip>
        </div>
      </div>

      {/* ── Resumo ─────────────────────────────────────────────── */}
      {overview && (affectedCount > 0 || unavailableCount > 0) && (
        <div className="flex items-center gap-3 text-[10px] text-white/55 px-1">
          {affectedCount > 0 && (
            <span>
              <span className="text-white/85 tabular-nums font-bold">{affectedCount}</span>{' '}
              jogador(es) com consequências ativas
            </span>
          )}
          {unavailableCount > 0 && (
            <span className="text-red-400">
              <span className="font-bold tabular-nums">{unavailableCount}</span> indisponível(eis)
            </span>
          )}
        </div>
      )}

      {/* ── Lista ──────────────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {sortedIds.map((id) => (
          <ScoutPlayerCard key={id} playerId={id} squadEntry={entriesById.get(id)} />
        ))}
      </motion.div>

      {sortedIds.length === 0 && (
        <div className="text-center py-6 text-[12px] text-white/40 italic">
          Nenhum jogador corresponde ao filtro.
        </div>
      )}
    </section>
  );
}

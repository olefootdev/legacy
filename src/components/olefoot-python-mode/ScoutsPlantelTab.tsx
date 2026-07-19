/**
 * Aba PLANTEL do SCOUTS — Legacy Tech.
 *
 * Cabeçalho editorial: eyebrow Agency + headline Moret italic + régua amarela.
 * Filtros como pílulas (DS §7.6): bg neon/[0.08] quando ativo + glow.
 * Lista com `view-player-card` (cada ScoutPlayerCard).
 */
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Search, Users } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import type { PlayerEntity } from '@/entities/types';
import type { SquadOverview } from '@/insights/client';
import { cn } from '@/lib/utils';
import { ScoutPlayerCard } from './ScoutPlayerCard';

interface Props {
  overview: SquadOverview | null;
}

type PosFilter = 'all' | 'GK' | 'DEF' | 'MID' | 'ATK';

const POS_GROUPS: Record<Exclude<PosFilter, 'all'>, Set<string>> = {
  GK: new Set(['GK', 'GOL']),
  DEF: new Set(['RB', 'CB', 'LB', 'RWB', 'LWB', 'SW', 'ZAG', 'LD', 'LE']),
  MID: new Set(['CDM', 'CM', 'CAM', 'RM', 'LM', 'MC', 'MD', 'ME', 'MO', 'VOL']),
  ATK: new Set(['RW', 'LW', 'CF', 'ST', 'SS', 'ATA', 'PD', 'PE']),
};

function posInGroup(pos: string, group: Exclude<PosFilter, 'all'>): boolean {
  return POS_GROUPS[group].has(pos);
}

function FilterChip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 border transition-all whitespace-nowrap',
        active
          ? 'bg-neon-yellow/[0.08] text-neon-yellow border-neon-yellow/45 shadow-[0_0_12px_rgba(253,225,0,0.18)]'
          : 'bg-deep-black/40 text-white/65 border-white/12 hover:border-neon-yellow/30 hover:text-white',
      )}
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: '10px',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {children}
      {count !== undefined && (
        <span
          className={cn(
            'tabular-nums',
            active ? 'text-neon-yellow/80' : 'text-white/40',
          )}
          style={{ fontSize: '9px', letterSpacing: '0.16em' }}
        >
          {count}
        </span>
      )}
    </motion.button>
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

    filtered.sort((a, b) => {
      const ea = entriesById.get(a.id);
      const eb = entriesById.get(b.id);
      const ua = (ea?.is_unavailable ?? (playerHealth?.[a.id]?.outForMatches ?? 0) > 0) ? 1 : 0;
      const ub = (eb?.is_unavailable ?? (playerHealth?.[b.id]?.outForMatches ?? 0) > 0) ? 1 : 0;
      if (ua !== ub) return ub - ua;
      const aa = ea?.alerts ?? 0;
      const ab = eb?.alerts ?? 0;
      if (aa !== ab) return ab - aa;
      return overallFromAttributes(b.attrs, b.pos) - overallFromAttributes(a.attrs, a.pos);
    });

    return filtered.map((p) => p.id);
  }, [players, search, posFilter, hideHealthy, entriesById, playerHealth]);

  const totalCount = players ? Object.keys(players).length : 0;
  const affectedCount = overview?.total_players_affected ?? 0;
  const unavailableCount = overview?.total_unavailable ?? 0;

  // Counters por grupo
  const groupCounts = useMemo(() => {
    if (!players) return { GK: 0, DEF: 0, MID: 0, ATK: 0 };
    const arr = Object.values(players) as PlayerEntity[];
    return {
      GK: arr.filter((p) => p && posInGroup(p.pos, 'GK')).length,
      DEF: arr.filter((p) => p && posInGroup(p.pos, 'DEF')).length,
      MID: arr.filter((p) => p && posInGroup(p.pos, 'MID')).length,
      ATK: arr.filter((p) => p && posInGroup(p.pos, 'ATK')).length,
    };
  }, [players]);

  if (totalCount === 0) {
    return (
      <div
        className="text-center py-12 px-4 bg-[var(--color-card)] border border-dashed border-white/15"
        style={{ borderRadius: 'var(--radius-md)' }}
      >
        <Users size={28} className="text-white/30 mx-auto mb-3" />
        <p
          className="text-white/70"
          style={{ fontFamily: 'var(--font-ui)', fontSize: '14px' }}
        >
          Plantel vazio.
        </p>
        <p
          className="text-white/45 mt-1"
          style={{ fontFamily: 'var(--font-ui)', fontSize: '12px' }}
        >
          Compre jogadores no Mercado pra começar.
        </p>
      </div>
    );
  }

  return (
    <section aria-label="Plantel completo" className="space-y-4">
      {/* ── Header editorial (DS §7.4) ────────────────────────── */}
      <header className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span aria-hidden className="block h-px w-8 bg-neon-yellow/55" />
          <span
            className="text-neon-yellow"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '10px',
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
            }}
          >
            Plantel · {totalCount} jogadores
          </span>
        </div>
        <h2
          className="text-white leading-[0.95]"
          style={{
            fontFamily: 'var(--font-serif-hero)',
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: 'clamp(22px, 3.5vw, 30px)',
            letterSpacing: '-0.02em',
          }}
        >
          Quem está em campo
        </h2>
        <span aria-hidden className="block w-12 h-[3px] bg-neon-yellow mt-2" />
      </header>

      {/* ── Status agregado (se Python entregou) ──────────────── */}
      {overview && (affectedCount > 0 || unavailableCount > 0) && (
        <div
          className="flex items-center gap-4 px-3 py-2 bg-[var(--color-card)] border border-white/8"
          style={{
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-ui)',
            fontSize: '11px',
          }}
        >
          {affectedCount > 0 && (
            <span className="text-white/65">
              <span className="text-white tabular-nums font-bold">{affectedCount}</span>{' '}
              com efeitos ativos
            </span>
          )}
          {unavailableCount > 0 && (
            <span className="text-[var(--color-danger)]">
              <span className="font-bold tabular-nums">{unavailableCount}</span> indisponível
              {unavailableCount === 1 ? '' : 'is'}
            </span>
          )}
        </div>
      )}

      {/* ── Busca ─────────────────────────────────────────────── */}
      <div className="relative">
        <Search
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar jogador…"
          className="w-full bg-deep-black/60 border border-white/15 pl-9 pr-3 py-2.5 text-white placeholder:text-white/35 focus:border-neon-yellow/55 focus:outline-none transition-colors"
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '13px',
            borderRadius: 'var(--radius-sm)',
          }}
        />
      </div>

      {/* ── Filtros pílula ────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        <FilterChip active={posFilter === 'all'} onClick={() => setPosFilter('all')} count={totalCount}>
          Todos
        </FilterChip>
        <FilterChip active={posFilter === 'GK'} onClick={() => setPosFilter('GK')} count={groupCounts.GK}>
          GK
        </FilterChip>
        <FilterChip active={posFilter === 'DEF'} onClick={() => setPosFilter('DEF')} count={groupCounts.DEF}>
          Defesa
        </FilterChip>
        <FilterChip active={posFilter === 'MID'} onClick={() => setPosFilter('MID')} count={groupCounts.MID}>
          Meio
        </FilterChip>
        <FilterChip active={posFilter === 'ATK'} onClick={() => setPosFilter('ATK')} count={groupCounts.ATK}>
          Ataque
        </FilterChip>
        <span className="w-px h-5 bg-white/10 mx-1 shrink-0" />
        <FilterChip active={hideHealthy} onClick={() => setHideHealthy(!hideHealthy)}>
          Só afetados
        </FilterChip>
      </div>

      {/* ── Lista ─────────────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {sortedIds.map((id) => (
          <ScoutPlayerCard key={id} playerId={id} squadEntry={entriesById.get(id)} />
        ))}
      </motion.div>

      {sortedIds.length === 0 && (
        <div
          className="text-center py-6 text-white/45 italic"
          style={{ fontFamily: 'var(--font-ui)', fontSize: '12px' }}
        >
          Nenhum jogador corresponde ao filtro.
        </div>
      )}
    </section>
  );
}

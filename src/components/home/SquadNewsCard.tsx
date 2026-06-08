/**
 * Card "Novidades do elenco" — consome selectStatusFeed da Fase 2.
 *
 * Acende a infraestrutura que estava dormindo: jogadores em recuperação,
 * contratos em alerta, fadiga crítica, suspensões, retornos.
 *
 * Hierarquia visual: critical > warning > info.
 * Esconde quando não há novidades (zero ruído na Home).
 */

import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Activity, ShieldOff, Flame, Coins, Ban, ShieldCheck, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import { selectStatusFeed, type StatusFeedItem } from '@/match/availabilityReport';

const ICON_BY_KIND: Record<StatusFeedItem['kind'], typeof Activity> = {
  injury_in: Activity,
  injury_out: ShieldCheck,
  suspension_in: ShieldOff,
  suspension_out: ShieldCheck,
  contract_warning: Coins,
  contract_expired: Ban,
  fatigue_warning: Flame,
  fatigue_recovered: ShieldCheck,
};

const SEVERITY_BORDER: Record<StatusFeedItem['severity'], string> = {
  critical: 'border-[var(--color-danger)]/40 bg-[var(--color-danger)]/8',
  warning: 'border-[var(--color-warning)]/40 bg-[var(--color-warning)]/8',
  info: 'border-white/10 bg-white/[0.02]',
};

const SEVERITY_TEXT: Record<StatusFeedItem['severity'], string> = {
  critical: 'text-[var(--color-danger)]',
  warning: 'text-[var(--color-warning)]',
  info: 'text-white/80',
};

function severityWeight(s: StatusFeedItem['severity']): number {
  if (s === 'critical') return 0;
  if (s === 'warning') return 1;
  return 2;
}

const MAX_ITEMS = 5;

export function SquadNewsCard() {
  const players = useGameStore((s) => s.players);
  const playerHealth = useGameStore((s) => s.playerHealth);

  // selectStatusFeed sem `previous` → emite só alertas vigentes
  // (contract_warning, contract_expired). Sem ruído de "transições" no primeiro load.
  const items = selectStatusFeed({ players, health: playerHealth });

  if (items.length === 0) return null;

  // Ordena por severidade primeiro, depois por atMs desc (já vem assim mas garante).
  const sorted = [...items]
    .sort((a, b) => {
      const sev = severityWeight(a.severity) - severityWeight(b.severity);
      if (sev !== 0) return sev;
      return b.atMs - a.atMs;
    })
    .slice(0, MAX_ITEMS);

  const criticalCount = items.filter((i) => i.severity === 'critical').length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="border border-white/10 bg-black/30 p-4"
      style={{ borderRadius: 'var(--radius-md)' }}
      aria-label="Novidades do elenco"
    >
      {/* Header com barra lateral neon */}
      <div className="mb-3 flex items-center gap-2.5">
        <span aria-hidden className="shrink-0 w-[3px] h-5 bg-neon-yellow" />
        <h3
          className="text-neon-yellow uppercase"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.18em',
          }}
        >
          Novidades do elenco
        </h3>
        {criticalCount > 0 ? (
          <span
            className="ml-auto inline-flex items-center gap-1 border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/12 px-1.5 py-0.5 text-[var(--color-danger)]"
            style={{
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-display)',
              fontSize: '9px',
              fontWeight: 800,
              letterSpacing: '0.18em',
            }}
          >
            {criticalCount} crítico{criticalCount === 1 ? '' : 's'}
          </span>
        ) : (
          <span
            className="ml-auto text-white/45"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.18em',
            }}
          >
            {items.length} item{items.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Lista */}
      <ul className="space-y-1.5">
        {sorted.map((item) => {
          const Icon = ICON_BY_KIND[item.kind];
          return (
            <li
              key={`${item.playerId}-${item.kind}-${item.atMs}`}
              className={cn(
                'flex items-center gap-2 border px-2.5 py-2',
                SEVERITY_BORDER[item.severity],
              )}
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <Icon
                className={cn('h-3.5 w-3.5 shrink-0', SEVERITY_TEXT[item.severity])}
                aria-hidden
              />
              <p
                className="min-w-0 flex-1 truncate text-white/90"
                style={{ fontFamily: 'var(--font-ui)', fontSize: '12px' }}
                title={item.message}
              >
                {item.message}
              </p>
            </li>
          );
        })}
      </ul>

      {/* CTA: ir pro plantel quando há mais que cabe */}
      {items.length > MAX_ITEMS ? (
        <Link
          to="/team"
          className="mt-3 inline-flex items-center gap-1 text-white/55 transition-colors hover:text-neon-yellow"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}
        >
          Ver plantel completo
          <ChevronRight className="h-3 w-3" aria-hidden />
        </Link>
      ) : null}
    </motion.section>
  );
}

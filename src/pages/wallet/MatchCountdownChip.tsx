import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

type MatchCountdownChipProps = {
  /** ISO de kickoff. Se ausente, mostra estado "sem partida agendada". */
  kickoffIso?: string;
  opponent?: string;
  roundLabel?: string;
  isHome?: boolean;
  /** Texto de venue opcional (ex: "Maracanã"). */
  venue?: string;
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'AO VIVO';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export function MatchCountdownChip({
  kickoffIso,
  opponent,
  roundLabel,
  isHome,
  venue,
}: MatchCountdownChipProps) {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!kickoffIso) return;
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [kickoffIso]);

  if (!kickoffIso || !opponent) {
    return null;
  }

  const kickoff = new Date(kickoffIso).getTime();
  const remaining = kickoff - now;
  const isLive = remaining <= 0 && remaining > -3 * 3600_000;

  return (
    <motion.button
      type="button"
      onClick={() => navigate('/matchday/preview')}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative flex w-full items-center gap-3 overflow-hidden border border-neon-yellow/20 bg-gradient-to-r from-neon-yellow/[0.06] via-transparent to-transparent px-4 py-3 text-left transition-colors hover:border-neon-yellow/40"
      style={{ borderRadius: 'var(--radius-card)' }}
    >
      <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-neon-yellow" />

      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neon-yellow/15 text-neon-yellow text-[16px]">
        {isLive ? '●' : '⏱'}
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-neon-yellow/80">
          {isLive ? 'Partida ao vivo' : 'Próxima partida'}
        </p>
        <p className="mt-0.5 text-[13px] font-bold text-white truncate">
          {isHome ? 'vs' : 'fora —'} {opponent}
          {roundLabel ? <span className="text-white/45"> · {roundLabel}</span> : null}
          {venue ? <span className="text-white/35"> · {venue}</span> : null}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={`tabular-nums ${isLive ? 'text-red-400' : 'text-neon-yellow'}`}
          style={{
            fontFamily: 'var(--font-serif-hero)',
            fontStyle: 'italic',
            fontSize: '20px',
            lineHeight: 1,
          }}
        >
          {formatCountdown(remaining)}
        </p>
        <p className="mt-0.5 font-display text-[9px] font-bold uppercase tracking-[0.18em] text-white/35">
          {isLive ? 'Em campo' : 'Pra começar'}
        </p>
      </div>
    </motion.button>
  );
}

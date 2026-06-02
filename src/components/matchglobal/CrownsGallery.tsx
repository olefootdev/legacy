/**
 * CrownsGallery — galeria horizontal das últimas Coroas do Dia.
 *
 * Mostra os N campeões mais recentes da Liga Global em cards compactos.
 * Reutiliza `loadRecentCrowns` (sem precisar de novo hook).
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Crown } from 'lucide-react';
import { loadRecentCrowns } from '@/supabase/globalLeague';
import type { DailyCrown } from '@/match/globalLeagueMVP';

function formatDate(iso: string): string {
  // iso = 'YYYY-MM-DD'
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

interface Props {
  limit?: number;
}

export function CrownsGallery({ limit = 10 }: Props) {
  const [crowns, setCrowns] = useState<DailyCrown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadRecentCrowns(limit).then((rows) => {
      if (cancelled) return;
      setCrowns(rows);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [limit]);

  if (loading) return null;
  if (crowns.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
            Galeria de Coroas
          </p>
          <h3 className="font-display text-xl font-bold uppercase text-white">
            Campeões Recentes
          </h3>
        </div>
        <span className="font-mono text-[10px] text-white/40">
          {crowns.length} coroa{crowns.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="overflow-x-auto -mx-3 px-3 pb-1">
        <div className="flex gap-3 min-w-max">
          {crowns.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="sports-panel rounded-lg p-4 min-w-[200px] border border-neon-yellow/20 hover:border-neon-yellow/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <Crown className="w-5 h-5 text-neon-yellow" />
                <span className="font-mono text-[10px] text-text-soft">
                  {formatDate(c.dailyDate)}
                </span>
              </div>
              <p className="font-display text-base font-bold uppercase text-white truncate">
                {c.clubName}
              </p>
              {c.runnerUpClubName && c.finalScoreHome != null && c.finalScoreAway != null && (
                <p className="font-mono text-[11px] text-text-soft mt-2">
                  {c.finalScoreHome}–{c.finalScoreAway} vs {c.runnerUpClubName}
                  {c.finalWentToPens ? ' (P)' : ''}
                </p>
              )}
              <p className="font-mono text-[10px] text-text-soft mt-1">
                bracket {c.bracketSize}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

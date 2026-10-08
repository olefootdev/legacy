/**
 * CrownsGallery — galeria horizontal das últimas Coroas do Dia.
 *
 * Mostra os N campeões mais recentes da Liga Global em cards compactos.
 * Reutiliza `loadRecentCrowns` (sem precisar de novo hook).
 */

import { L, emIngles } from '@/i18n/L';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Crown } from 'lucide-react';
import { loadRecentCrowns } from '@/supabase/globalLeague';
import type { DailyCrown } from '@/match/globalLeagueMVP';

function formatDate(iso: string): string {
  // iso = 'YYYY-MM-DD'
  const [y, m, d] = iso.split('-');
  return emIngles() ? `${m}/${d}/${y.slice(2)}` : `${d}/${m}/${y.slice(2)}`;
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
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <span className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">— {L('Galeria de coroas', 'Crown gallery')}</span>
          <span className="shrink-0 font-prova text-[12px] font-bold text-mudo">
            {crowns.length} {L('coroa', 'crown')}{crowns.length === 1 ? '' : 's'}
          </span>
        </div>
        <h3 className="font-voz text-[clamp(30px,8vw,44px)] leading-[0.95] text-papel">{L('Quem já levou a coroa', 'Who wore the crown')}</h3>
      </div>

      <div className="-mx-3 overflow-x-auto px-3 pb-2">
        <div className="flex min-w-max gap-2">
          {crowns.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={i === 0
                ? 'flex min-w-[200px] flex-col gap-1.5 bg-ouro-27 p-4 text-asfalto-27'
                : 'flex min-w-[200px] flex-col gap-1.5 border-2 border-ouro-27 p-4'}
            >
              <div className="flex items-start justify-between">
                <Crown aria-hidden className={i === 0 ? 'h-5 w-5' : 'h-5 w-5 text-ouro-27'} />
                <span className={i === 0 ? 'font-prova text-[10.5px] font-bold' : 'font-prova text-[10.5px] font-bold text-mudo'}>
                  {formatDate(c.dailyDate)}
                </span>
              </div>
              <p className={i === 0 ? 'truncate font-impact text-[22px] uppercase leading-none' : 'truncate font-impact text-[22px] uppercase leading-none text-papel'}>
                {c.clubName}
              </p>
              {c.runnerUpClubName && c.finalScoreHome != null && c.finalScoreAway != null && (
                <p className={i === 0 ? 'truncate font-prova text-[11px]' : 'truncate font-prova text-[11px] text-suave'}>
                  {c.finalScoreHome}×{c.finalScoreAway} vs {c.runnerUpClubName}
                  {c.finalWentToPens ? ' (P)' : ''}
                </p>
              )}
              <p className={i === 0 ? 'font-prova text-[10px] uppercase opacity-70' : 'font-prova text-[10px] uppercase text-mudo'}>
                {L(`chave de ${c.bracketSize}`, `bracket of ${c.bracketSize}`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

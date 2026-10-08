import { useEffect, useState } from 'react';
import { Clock, Users } from 'lucide-react';
import {
  formatOtzDate,
  formatOtzTime,
  formatOnlineCompact,
  OTZ_SHORT_LABEL,
  syntheticOnlineStats,
} from '@/systems/oleTimeZone';
import { L } from '@/i18n/L';

/**
 * Bloco do header: horário OTZ (UTC) + métricas sintéticas de jogadores online.
 * Atualiza o relógio a cada segundo; stats a cada ~15s (mesma janela que `syntheticOnlineStats`).
 */
export function HeaderOtzStrip() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const d = new Date(now);
  const stats = syntheticOnlineStats(now);

  const statsTitle = `~${formatOnlineCompact(stats.online)} online · ${formatOnlineCompact(stats.inMatch)} ${L('em jogo', 'in match')} · ${formatOnlineCompact(stats.scouting)} scouting`;

  return (
    <div
      className="w-auto max-w-[min(100%,13rem)] min-w-0 select-none text-right leading-tight sm:max-w-none sm:w-auto"
      title={L(
        'Tempo oficial Olefoot (UTC). O estado do jogo sincroniza ao focar a app ou em segundo plano (definições).',
        'Official Olefoot time (UTC). Game state syncs when the app regains focus or in the background (settings).',
      )}
    >
      <div className="flex items-center justify-end gap-1 text-rua sm:gap-1.5">
        <Clock className="h-3 w-3 shrink-0 opacity-90 sm:h-3.5 sm:w-3.5" aria-hidden />
        <span className="hidden font-prova text-[9px] font-bold uppercase tracking-widest text-mudo sm:inline">
          {OTZ_SHORT_LABEL}
        </span>
        <span className="font-display text-[11px] font-black tabular-nums tracking-tight text-papel sm:text-xs md:text-sm">
          {formatOtzTime(d)}
        </span>
      </div>
      <div className="mt-0.5 text-[8px] font-medium tabular-nums text-mudo sm:text-[9px]">
        {formatOtzDate(d)} · UTC
      </div>
      {/* Mobile: linhas curtas (sem ellipsis). Desktop: uma linha. */}
      <div
        className="mt-1 flex flex-col items-end gap-0 text-[7px] font-medium leading-snug text-mudo sm:hidden"
        aria-label={statsTitle}
      >
        <span className="tabular-nums">~{formatOnlineCompact(stats.online)} online</span>
        <span className="tabular-nums">{formatOnlineCompact(stats.inMatch)} {L('em jogo', 'in match')}</span>
        <span className="tabular-nums">{formatOnlineCompact(stats.scouting)} scouting</span>
      </div>
      <div className="mt-1 hidden items-center justify-end gap-1 text-[9px] font-medium text-mudo sm:flex" title={statsTitle}>
        <Users className="h-3 w-3 shrink-0 text-rua" aria-hidden />
        <span className="max-w-[min(100%,20rem)] text-right leading-snug">{statsTitle}</span>
      </div>
    </div>
  );
}

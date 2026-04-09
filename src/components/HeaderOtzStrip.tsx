import { useEffect, useState } from 'react';
import { Clock, Users } from 'lucide-react';
import {
  formatOtzDate,
  formatOtzTime,
  formatOnlineCompact,
  OTZ_SHORT_LABEL,
  syntheticOnlineStats,
} from '@/systems/oleTimeZone';

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

  return (
    <div
      className="text-right leading-tight select-none"
      title="Tempo oficial Olefoot (UTC). O estado do jogo sincroniza ao focar a app ou em segundo plano (definições)."
    >
      <div className="flex items-center justify-end gap-1.5 text-neon-yellow">
        <Clock className="w-3.5 h-3.5 shrink-0 opacity-90" aria-hidden />
        <span className="text-[9px] font-display font-black uppercase tracking-widest text-gray-500">
          {OTZ_SHORT_LABEL}
        </span>
        <span className="text-xs md:text-sm font-display font-black tabular-nums tracking-tight text-white">
          {formatOtzTime(d)}
        </span>
      </div>
      <div className="text-[9px] text-gray-500 font-medium mt-0.5 tabular-nums">{formatOtzDate(d)} · UTC</div>
      <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-gray-400 font-medium">
        <Users className="w-3 h-3 shrink-0 text-neon-yellow/80" aria-hidden />
        <span>
          ~{formatOnlineCompact(stats.online)} online
          <span className="text-gray-600 mx-1">·</span>
          {formatOnlineCompact(stats.inMatch)} em jogo
          <span className="text-gray-600 mx-1">·</span>
          {formatOnlineCompact(stats.scouting)} scouting
        </span>
      </div>
    </div>
  );
}

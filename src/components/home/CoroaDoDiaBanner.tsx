/**
 * CoroaDoDiaBanner — Coroa do Dia no padrão StatBanner compacto (Liga Global).
 * Substitui o hero amarelo grande; agora a Liga Ole é o único hero da Home.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Swords, Flag } from 'lucide-react';
import { useDailyCycle } from '@/hooks/useDailyCycle';
import { StatBanner } from './StatBanner';

function fmt(ms: number): string {
  if (ms <= 0) return 'agora';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}
const phaseLabel = (n: number) => ({ 2: 'Final', 4: 'Semifinal', 8: 'Quartas', 16: 'Oitavas', 32: 'Fase de 32' } as Record<number, string>)[n] ?? `Fase de ${n}`;

export function CoroaDoDiaBanner() {
  const navigate = useNavigate();
  const daily = useDailyCycle();
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 1000); return () => clearInterval(id); }, []);

  const live = daily.bracket.find((r) => r.status === 'live');
  const next = daily.bracket.find((r) => r.status !== 'finished');

  let icon = <Flag size={18} />;
  let value = 'Corrida do dia';
  let sub = `Top ${daily.cutSize || 32} às ${daily.qualifyHour}h`;

  if (daily.phase === 'crowned' && daily.todayCrown) {
    icon = <Crown size={18} />;
    value = `Coroado · ${daily.todayCrown.clubName}`;
    sub = 'Campeão de hoje';
  } else if (daily.phase === 'knockout') {
    const r = live ?? next;
    icon = <Swords size={18} />;
    value = r ? `Mata-mata · ${phaseLabel(r.size)}` : 'Mata-mata em andamento';
    sub = live ? 'Ao vivo agora' : next ? `Próxima rodada em ${fmt(Math.max(0, next.scheduledKickoffMs - Date.now()))}` : 'Aguardando';
  } else if (daily.phase === 'qualifying') {
    sub = daily.myRank != null ? `Você em ${daily.myRank}º · corte em ${fmt(daily.msToCut)}` : `Jogue 1 partida · corte em ${fmt(daily.msToCut)}`;
  }

  return (
    <StatBanner
      tone="yellow"
      icon={icon}
      eyebrow="Coroa do Dia · Liga Global"
      value={value}
      sub={sub}
      onClick={() => navigate('/match/global')}
    />
  );
}

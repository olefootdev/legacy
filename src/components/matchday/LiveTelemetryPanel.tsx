import { useEffect, useState } from 'react';
import { getTelemetry, type LiveMatchTelemetry } from '@/match/liveTelemetry';
import { Activity, Target, Zap, AlertTriangle } from 'lucide-react';

export function LiveTelemetryPanel() {
  const [telemetry, setTelemetry] = useState<LiveMatchTelemetry | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry(getTelemetry());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'T' && e.shiftKey) {
        setIsVisible(v => !v);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (!telemetry || !isVisible) return null;

  const a = telemetry.actions;
  const q = telemetry.quality;

  return (
    <div className="fixed bottom-4 right-4 bg-black/95 text-white p-4 rounded-lg text-xs font-mono w-72 shadow-2xl border border-white/10">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-green-400" />
          <span className="font-bold text-sm">TELEMETRIA AO VIVO</span>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-white/50 hover:text-white text-xs"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2">
        {/* Ações Ofensivas */}
        <div className="border-b border-white/10 pb-2">
          <div className="flex items-center gap-1 text-yellow-400 mb-1">
            <Target className="w-3 h-3" />
            <span className="font-semibold">OFENSIVAS</span>
          </div>
          <div className="pl-4 space-y-0.5">
            <div className="flex justify-between">
              <span className="text-white/70">Chutes:</span>
              <span className="font-bold text-yellow-400">
                {a.shoots} {a.shootsLongRange > 0 && <span className="text-orange-400">({a.shootsLongRange} long)</span>}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Cruzamentos:</span>
              <span className="font-bold text-blue-400">{a.crosses}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Through balls:</span>
              <span className="font-bold text-purple-400">{a.throughBalls}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Dribles:</span>
              <span className="font-bold text-cyan-400">{a.dribbles}</span>
            </div>
          </div>
        </div>

        {/* Ações Defensivas */}
        <div className="border-b border-white/10 pb-2">
          <div className="flex items-center gap-1 text-red-400 mb-1">
            <AlertTriangle className="w-3 h-3" />
            <span className="font-semibold">FÍSICAS</span>
          </div>
          <div className="pl-4 space-y-0.5">
            <div className="flex justify-between">
              <span className="text-white/70">Faltas:</span>
              <span className="font-bold text-red-400">{a.fouls}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Cartões:</span>
              <span className="font-bold">
                {a.yellowCards > 0 && <span className="text-yellow-400">🟨{a.yellowCards}</span>}
                {a.yellowCards > 0 && a.redCards > 0 && ' '}
                {a.redCards > 0 && <span className="text-red-500">🟥{a.redCards}</span>}
                {a.yellowCards === 0 && a.redCards === 0 && <span className="text-white/50">-</span>}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Desarmes:</span>
              <span className="font-bold text-gray-400">{a.tackles}</span>
            </div>
          </div>
        </div>

        {/* Passes */}
        <div className="border-b border-white/10 pb-2">
          <div className="flex justify-between text-xs">
            <span className="text-white/70">Passes:</span>
            <span className="font-bold">{a.passes}</span>
          </div>
          <div className="flex justify-between text-xs pl-4">
            <span className="text-white/50">Progressivos:</span>
            <span className="text-green-400">{a.progressivePasses} ({(q.forwardPassRatio * 100).toFixed(0)}%)</span>
          </div>
        </div>

        {/* Métricas de Qualidade */}
        <div className="pt-1">
          <div className="flex items-center gap-1 text-green-400 mb-1">
            <Zap className="w-3 h-3" />
            <span className="font-semibold">QUALIDADE</span>
          </div>
          <div className="pl-4 space-y-0.5">
            <div className="flex justify-between items-center">
              <span className="text-white/70">Variedade:</span>
              <div className="flex items-center gap-1">
                <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${q.actionVariety > 0.7 ? 'bg-green-400' : q.actionVariety > 0.5 ? 'bg-yellow-400' : 'bg-red-400'}`}
                    style={{ width: `${q.actionVariety * 100}%` }}
                  />
                </div>
                <span className="text-xs">{(q.actionVariety * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/70">Emoção:</span>
              <div className="flex items-center gap-1">
                <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${q.excitementScore > 60 ? 'bg-green-400' : q.excitementScore > 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                    style={{ width: `${q.excitementScore}%` }}
                  />
                </div>
                <span className="text-xs">{q.excitementScore.toFixed(0)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/70">Fisicalidade:</span>
              <div className="flex items-center gap-1">
                <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${q.physicalityScore > 40 ? 'bg-green-400' : q.physicalityScore > 20 ? 'bg-yellow-400' : 'bg-red-400'}`}
                    style={{ width: `${q.physicalityScore}%` }}
                  />
                </div>
                <span className="text-xs">{q.physicalityScore.toFixed(0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-white/10 text-[10px] text-white/40 text-center">
        Shift+T para ocultar/mostrar
      </div>
    </div>
  );
}

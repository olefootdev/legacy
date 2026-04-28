/**
 * Sprint L4 — Painel de controles contextuais de prensa.
 * Triggers + zona + intensidade. Lê/atualiza state.manager.pressing.
 */
import { useGameDispatch, useGameStore } from '@/game/store';

const DEFAULT_PRESSING = {
  triggers: { onTurnover: true, whenLosing: true, whenLeading: false },
  zone: 'mid' as const,
  intensity: 60,
};

export function PressingControls() {
  const dispatch = useGameDispatch();
  const pressing = useGameStore((s) => s.manager.pressing) ?? DEFAULT_PRESSING;

  const setTrigger = (key: keyof typeof pressing.triggers, value: boolean) => {
    dispatch({
      type: 'SET_PRESSING_CONTEXT',
      patch: { triggers: { [key]: value } },
    });
  };

  const setZone = (zone: 'high' | 'mid' | 'low') => {
    dispatch({ type: 'SET_PRESSING_CONTEXT', patch: { zone } });
  };

  const setIntensity = (intensity: number) => {
    dispatch({ type: 'SET_PRESSING_CONTEXT', patch: { intensity } });
  };

  return (
    <div className="space-y-3 border-t border-white/10 pt-4">
      <div className="text-[10px] uppercase tracking-[0.35em] font-bold text-white/70">
        Prensa contextual
      </div>

      {/* Zona */}
      <div>
        <div className="text-[9px] uppercase tracking-[0.25em] text-white/50 mb-1.5">
          Zona principal
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(['high', 'mid', 'low'] as const).map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZone(z)}
              className={`text-[10px] uppercase tracking-[0.2em] font-bold py-2 px-2 transition-all ${
                pressing.zone === z
                  ? 'bg-neon-yellow text-black'
                  : 'bg-zinc-800 text-white/70 hover:bg-zinc-700'
              }`}
            >
              {z === 'high' ? 'Alta' : z === 'mid' ? 'Média' : 'Baixa'}
            </button>
          ))}
        </div>
      </div>

      {/* Intensidade */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] uppercase tracking-[0.25em] text-white/50">
            Intensidade
          </span>
          <span className="text-[11px] font-display font-bold text-neon-yellow tabular-nums">
            {pressing.intensity}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={pressing.intensity}
          onChange={(e) => setIntensity(Number(e.target.value))}
          className="w-full accent-neon-yellow"
        />
      </div>

      {/* Triggers */}
      <div>
        <div className="text-[9px] uppercase tracking-[0.25em] text-white/50 mb-1.5">
          Gatilhos
        </div>
        <div className="space-y-1">
          {(
            [
              ['onTurnover', 'Prensar ao perder a bola'],
              ['whenLosing', 'Intensificar se atrás no placar'],
              ['whenLeading', 'Intensificar se ganhando'],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2 text-[11px] text-white/80 cursor-pointer hover:text-white"
            >
              <input
                type="checkbox"
                checked={pressing.triggers[key]}
                onChange={(e) => setTrigger(key, e.target.checked)}
                className="accent-neon-yellow"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

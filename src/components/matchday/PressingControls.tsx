/**
 * Sprint L4 — Painel de controles contextuais de prensa.
 * Triggers + zona + intensidade. Lê/atualiza state.manager.pressing.
 *
 * Design system Legacy Tech:
 * — Botões de zona com -skew-x-6 + clip nas bordas, neon-yellow no ativo
 * — Slider com track preto + fill amarelo + thumb destacado
 * — Eyebrow `tracking-[0.35em]` no header da seção
 */
import { useGameDispatch, useGameStore } from '@/game/store';

const DEFAULT_PRESSING = {
  triggers: { onTurnover: true, whenLosing: true, whenLeading: false },
  zone: 'mid' as const,
  intensity: 60,
};

const ZONE_LABEL: Record<'high' | 'mid' | 'low', string> = {
  high: 'Alta',
  mid: 'Média',
  low: 'Baixa',
};

const TRIGGERS: { key: 'onTurnover' | 'whenLosing' | 'whenLeading'; label: string }[] = [
  { key: 'onTurnover', label: 'Prensar ao perder a bola' },
  { key: 'whenLosing', label: 'Intensificar se atrás no placar' },
  { key: 'whenLeading', label: 'Intensificar se ganhando' },
];

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

  const intensityTone =
    pressing.intensity >= 75
      ? 'var(--color-danger)'
      : pressing.intensity >= 45
        ? 'var(--color-neon-yellow)'
        : 'var(--color-warning)';

  return (
    <div className="space-y-4 border-t border-white/10 pt-4">
      <div
        className="text-[10px] uppercase tracking-[0.35em] font-bold text-white/55"
        style={{ fontFamily: 'var(--font-ui)' }}
      >
        Prensa contextual
      </div>

      {/* Zona ─────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="text-[9px] uppercase tracking-[0.28em] text-white/40">
          Zona principal
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {(['high', 'mid', 'low'] as const).map((z) => {
            const active = pressing.zone === z;
            return (
              <button
                key={z}
                type="button"
                onClick={() => setZone(z)}
                className="relative -skew-x-6 transition-all"
                style={{
                  background: active ? 'var(--color-neon-yellow)' : 'var(--color-card)',
                  color: active ? '#000' : 'rgba(255,255,255,0.65)',
                  border: active
                    ? '1px solid transparent'
                    : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: active ? '0 0 14px rgba(253, 225, 0, 0.32)' : 'none',
                }}
              >
                <span
                  className="block skew-x-6 py-2 text-[10px] uppercase tracking-[0.22em] font-display font-bold"
                >
                  {ZONE_LABEL[z]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Intensidade ─────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-[0.28em] text-white/40">
            Intensidade
          </span>
          <span
            className="font-display font-black tabular-nums leading-none"
            style={{ color: intensityTone, fontSize: 'var(--text-base)' }}
          >
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
          className="w-full"
          style={{ accentColor: intensityTone }}
        />
      </div>

      {/* Gatilhos ──────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="text-[9px] uppercase tracking-[0.28em] text-white/40">
          Gatilhos
        </div>
        <div className="space-y-1">
          {TRIGGERS.map(({ key, label }) => {
            const checked = pressing.triggers[key];
            return (
              <label
                key={key}
                className="flex items-center gap-2.5 text-[11px] cursor-pointer group"
                style={{ color: checked ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.55)' }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setTrigger(key, e.target.checked)}
                  className="w-3.5 h-3.5 cursor-pointer"
                  style={{ accentColor: 'var(--color-neon-yellow)' }}
                />
                <span className="group-hover:text-white transition-colors">{label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

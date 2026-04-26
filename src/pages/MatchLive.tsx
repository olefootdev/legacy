/**
 * Partida ao vivo (MVP) — campo 2D + `TacticalSimLoop` + `SIM_SYNC`.
 * Rota: `/match/live`
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Live2dMatchShell, type Live2dShellConfig } from '@/pages/Live2dMatchShell';

const LIVE_CONFIG: Live2dShellConfig = {
  productLabel: 'Partida ao vivo',
  productSub: 'Motor tático MVP',
};

export function MatchLive() {
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);

  if (accepted) {
    return <Live2dMatchShell config={LIVE_CONFIG} />;
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-[var(--stadium-night)] px-5 py-10">
      <div className="relative w-full max-w-md overflow-hidden bg-[var(--surface-dark)] shadow-[0_20px_60px_rgba(0,0,0,0.7)]" style={{ borderRadius: 'var(--radius-sm)' }}>
        {/* Faixa amarela lateral (assinatura BVB) */}
        <div className="absolute left-0 top-0 h-full w-1 bg-[var(--yellow)]" aria-hidden />

        {/* Diagonal accent sutil */}
        <div
          className="absolute right-0 top-0 h-32 w-32 bg-[var(--yellow)] opacity-[0.04] pointer-events-none"
          style={{ transform: 'skewX(-34deg) translateX(50%)' }}
          aria-hidden
        />

        <div className="relative px-6 py-7 pl-7">
          <h2 className="ole-headline text-white uppercase" style={{ fontSize: 'var(--text-display-sm)' }}>
            Olá Manager
          </h2>
          <p className="mt-4 text-[var(--text-secondary)] leading-relaxed" style={{ fontSize: 'var(--text-body-md)' }}>
            Este modo de jogo está em desenvolvimento, não contabiliza pontos para a liga.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setAccepted(true)}
              className="group relative w-full overflow-hidden bg-[var(--yellow)] transition-all hover:shadow-[0_0_20px_rgba(253,225,0,0.3)]"
              style={{
                borderRadius: 'var(--radius-sm)',
                clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)'
              }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2 px-6 py-3 font-display font-bold uppercase tracking-[0.15em] text-black" style={{ fontSize: 'var(--text-ui-sm)' }}>
                Jogar Teste
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="w-full border border-white/10 bg-white/5 transition-all hover:bg-white/10 hover:border-white/20"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <span className="flex items-center justify-center gap-2 px-6 py-3 font-display font-bold uppercase tracking-[0.15em] text-white/70" style={{ fontSize: 'var(--text-ui-sm)' }}>
                Ir para Home
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

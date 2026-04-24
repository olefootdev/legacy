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
    <div className="flex min-h-svh items-center justify-center bg-deep-black px-5 py-10">
      <div className="relative w-full max-w-md overflow-hidden rounded-sm border border-white/[0.1] bg-black/70 shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-md">
        <div className="absolute left-0 top-0 h-full w-1 bg-neon-yellow/90" aria-hidden />
        <div className="relative px-6 py-7 pl-7">
          <h2 className="font-display text-xl font-bold uppercase tracking-tight text-white sm:text-2xl">
            Olá Manager
          </h2>
          <p className="mt-4 font-sans text-sm leading-relaxed text-white/80">
            Este modo de jogo está em desenvolvimento, não contabiliza pontos para a liga.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setAccepted(true)}
              className="btn-primary w-full"
            >
              <span className="btn-primary-inner justify-center py-1">Jogar Teste</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="btn-secondary w-full"
            >
              <span className="btn-secondary-inner justify-center py-1">Ir para Home</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

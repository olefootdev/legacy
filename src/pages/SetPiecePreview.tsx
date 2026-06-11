import { useState } from 'react';
import type { SetPieceChoice, SetPieceContext } from '@/components/setpiece';
import { QuickSetPieceCard } from '@/components/matchquick/QuickSetPieceCard';

export function SetPiecePreview() {
  const [scenario, setScenario] = useState<'corner' | 'free_kick'>('corner');
  const [resolved, setResolved] = useState<SetPieceChoice | null>(null);

  const cornerCtx: SetPieceContext = {
    mode: 'corner',
    side: 'home',
    cornerSide: 'right',
    takers: [
      { id: 't1', displayName: 'Adrien Ayo', shirtNumber: 7, skillRating: 84 },
      { id: 't2', displayName: 'Lucas R.', shirtNumber: 10, skillRating: 78 },
      { id: 't3', displayName: 'Mathias S.', shirtNumber: 11, skillRating: 72 },
    ],
    targets: [
      { id: 'cb1', displayName: 'Vinicius P.', shirtNumber: 4, skillRating: 82, position: 'CB' },
      { id: 'st1', displayName: 'Gabriel M.', shirtNumber: 9, skillRating: 76, position: 'ST' },
      { id: 'cb2', displayName: 'Pedro L.', shirtNumber: 5, skillRating: 71, position: 'CB' },
      { id: 'am1', displayName: 'Bruno S.', shirtNumber: 8, skillRating: 68, position: 'AM' },
    ],
  };

  const freeKickCtx: SetPieceContext = {
    mode: 'free_kick',
    side: 'home',
    distance: 24,
    zone: 'center',
    takers: [
      { id: 'fk1', displayName: 'Adrien Ayo', shirtNumber: 7, skillRating: 87 },
      { id: 'fk2', displayName: 'Lucas R.', shirtNumber: 10, skillRating: 79 },
      { id: 'fk3', displayName: 'Daniel V.', shirtNumber: 14, skillRating: 73 },
    ],
    targets: [
      { id: 'cb1', displayName: 'Vinicius P.', shirtNumber: 4, skillRating: 82, position: 'CB' },
      { id: 'st1', displayName: 'Gabriel M.', shirtNumber: 9, skillRating: 76, position: 'ST' },
      { id: 'cb2', displayName: 'Pedro L.', shirtNumber: 5, skillRating: 71, position: 'CB' },
      { id: 'am1', displayName: 'Bruno S.', shirtNumber: 8, skillRating: 68, position: 'AM' },
    ],
  };

  if (resolved) {
    return (
      <div className="min-h-screen bg-deep-black text-white flex flex-col items-center justify-center px-6 py-12">
        <div className="text-[10px] uppercase tracking-[0.35em] text-white/60 mb-3">
          Decisão registrada
        </div>
        <h1
          className="ole-headline-italic text-neon-yellow mb-8"
          style={{ fontSize: 'clamp(48px, 8vw, 96px)', lineHeight: 1 }}
        >
          {resolved.mode === 'corner' ? 'ESCANTEIO' : 'FALTA'}
        </h1>
        <pre className="bg-zinc-900 border border-zinc-700 rounded p-4 text-xs leading-relaxed font-mono">
          {JSON.stringify(resolved, null, 2)}
        </pre>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={() => {
              setResolved(null);
            }}
            className="bg-neon-yellow text-black px-8 py-3 font-display font-black uppercase tracking-wider -skew-x-6 hover:bg-white"
          >
            Outro
          </button>
          <button
            type="button"
            onClick={() => {
              setScenario((s) => (s === 'corner' ? 'free_kick' : 'corner'));
              setResolved(null);
            }}
            className="bg-transparent border-2 border-neon-yellow text-neon-yellow px-8 py-3 font-display font-black italic uppercase tracking-wider -skew-x-6 hover:bg-neon-yellow hover:text-black"
          >
            Trocar cenário
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Toggle de cenário (canto superior direito) */}
      <div className="fixed top-3 right-3 z-50 flex gap-2">
        <button
          type="button"
          onClick={() => setScenario('corner')}
          className={`text-[10px] uppercase tracking-[0.25em] font-bold px-3 py-1.5 transition-all ${
            scenario === 'corner'
              ? 'bg-black text-neon-yellow'
              : 'bg-transparent border-2 border-black/60 text-black/70 hover:border-black'
          }`}
        >
          Escanteio
        </button>
        <button
          type="button"
          onClick={() => setScenario('free_kick')}
          className={`text-[10px] uppercase tracking-[0.25em] font-bold px-3 py-1.5 transition-all ${
            scenario === 'free_kick'
              ? 'bg-black text-neon-yellow'
              : 'bg-transparent border-2 border-black/60 text-black/70 hover:border-black'
          }`}
        >
          Falta
        </button>
      </div>

      <div className="min-h-screen bg-deep-black" />
      <QuickSetPieceCard
        key={scenario}
        ctx={scenario === 'corner' ? cornerCtx : freeKickCtx}
        pickSeconds={10}
        onResolve={setResolved}
      />
    </div>
  );
}

export default SetPiecePreview;

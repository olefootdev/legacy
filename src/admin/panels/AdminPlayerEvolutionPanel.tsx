import { useCallback, useMemo, useState } from 'react';
import { useGameDispatch, useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import {
  ADMIN_OVR_GROWTH_MAX,
  ensureMintOverall,
  getEvolvedOverallCap,
} from '@/entities/playerEvolution';
import { MANAGER_PROSPECT_EVOLVED_MAX_OVR } from '@/entities/managerProspect';

function parseRate(raw: string, fallback: number): number | null {
  const n = Number(raw.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.min(3, Math.max(0.25, n));
}

export function AdminPlayerEvolutionPanel() {
  const dispatch = useGameDispatch();
  const players = useGameStore((s) => s.players);
  const rows = useMemo(
    () => Object.values(players).sort((a, b) => a.name.localeCompare(b.name, 'pt')),
    [players],
  );
  const [rateDraft, setRateDraft] = useState<Record<string, string>>({});

  const rateFor = useCallback(
    (id: string, stored: number | undefined) => rateDraft[id] ?? String(stored ?? 1),
    [rateDraft],
  );

  const saveRate = (playerId: string, currentRate: number | undefined) => {
    const parsed = parseRate(rateFor(playerId, currentRate), currentRate ?? 1);
    if (parsed == null) return;
    dispatch({ type: 'ADMIN_PATCH_PLAYER', playerId, partial: { evolutionRate: parsed } });
    setRateDraft((d) => {
      const next = { ...d };
      delete next[playerId];
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-50/90">
        <strong className="text-white">Evolução por jogador</strong>: a taxa multiplica ganhos e perdas de atributos após
        cada partida (e XP de evolução). Academia OLE: OVR máximo evoluído{' '}
        <span className="font-mono text-neon-yellow">{MANAGER_PROSPECT_EVOLVED_MAX_OVR}</span>. Cartões Admin /
        legado: tecto = mint +{' '}
        <span className="font-mono text-neon-yellow">{ADMIN_OVR_GROWTH_MAX}</span> no overall.
      </div>

      <div className="ole-scroll-x overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-[720px] w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.04] text-[10px] font-bold uppercase tracking-wider text-white/45">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Pos</th>
              <th className="px-3 py-2">OVR</th>
              <th className="px-3 py-2">Mint</th>
              <th className="px-3 py-2">Tecto</th>
              <th className="px-3 py-2">Origem</th>
              <th className="px-3 py-2">Taxa (0,25–3)</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const hydrated = ensureMintOverall(p);
              const ovr = overallFromAttributes(hydrated.attrs);
              const cap = getEvolvedOverallCap(hydrated);
              const mint = hydrated.mintOverall ?? ovr;
              return (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-3 py-2 font-mono text-white/70">{p.num}</td>
                  <td className="max-w-[140px] truncate px-3 py-2 font-bold text-white">{p.name}</td>
                  <td className="px-3 py-2 text-white/60">{p.pos}</td>
                  <td className="px-3 py-2 font-mono text-neon-yellow/90">{ovr}</td>
                  <td className="px-3 py-2 font-mono text-white/80">{mint}</td>
                  <td className="px-3 py-2 font-mono text-white/80">{cap}</td>
                  <td className="px-3 py-2 text-white/50">{p.managerCreated ? 'Academia' : 'Admin / clube'}</td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={rateFor(p.id, p.evolutionRate)}
                      onChange={(e) => setRateDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                      className="w-20 rounded border border-white/15 bg-black/50 px-2 py-1 font-mono text-white outline-none focus:border-neon-yellow"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => saveRate(p.id, p.evolutionRate)}
                      className="rounded border border-white/20 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/80 hover:bg-white/10"
                    >
                      Guardar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="text-sm text-white/40">Sem jogadores no save.</p> : null}
    </div>
  );
}

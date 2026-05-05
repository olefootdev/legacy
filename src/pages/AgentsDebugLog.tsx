/**
 * /dev/agents-debug
 *
 * Tabela de log de decisões dos agentes — lê MatchLogger.getInstance().
 * Filtros: agente, tick range, intenção, flags (OOB, IGN_BALL, ADJ).
 * Atualiza a cada segundo enquanto a partida roda.
 */
import { useEffect, useState, useCallback } from 'react';
import { MatchLogger } from '../../agents/match/MatchLogger';
import type { AgentTickSnapshot } from '../../agents/match/MatchLogger';

const POSITIONS = ['GK','LB','CB_L','CB_R','RB','LM','CM_L','CM_R','RM','ST_L','ST_R'] as const;
const INTENTIONS = ['ALL','HOLD_POSITION','SUPPORT','PROGRESS','FINISH'] as const;

function Flag({ label, active }: { label: string; active: boolean }) {
  if (!active) return null;
  return (
    <span className="rounded px-1 py-0.5 text-[10px] font-bold uppercase"
      style={{ background: '#ff4444', color: '#fff', marginLeft: 2 }}>
      {label}
    </span>
  );
}

function PhaseChip({ phase }: { phase: string | null }) {
  const colors: Record<string, string> = {
    POSSESSION: '#22c55e',
    DEFENDING: '#ef4444',
    TRANSITION_ATTACK: '#f59e0b',
    TRANSITION_DEFENSE: '#f97316',
  };
  const c = phase ? (colors[phase] ?? '#888') : '#555';
  return (
    <span className="rounded px-1 py-0.5 text-[10px] font-mono"
      style={{ background: c + '33', color: c, border: `1px solid ${c}55` }}>
      {phase ?? '—'}
    </span>
  );
}

function IntentionChip({ intention }: { intention: string }) {
  const colors: Record<string, string> = {
    HOLD_POSITION: '#6b7280',
    SUPPORT: '#3b82f6',
    PROGRESS: '#f59e0b',
    FINISH: '#ef4444',
  };
  const c = colors[intention] ?? '#888';
  return (
    <span className="rounded px-1 py-0.5 text-[10px] font-mono font-bold"
      style={{ background: c + '22', color: c }}>
      {intention}
    </span>
  );
}

export function AgentsDebugLog() {
  const [snapshots, setSnapshots] = useState<AgentTickSnapshot[]>([]);
  const [agentFilter, setAgentFilter] = useState<string>('ALL');
  const [intentionFilter, setIntentionFilter] = useState<string>('ALL');
  const [onlyFlags, setOnlyFlags] = useState(false);
  const [tickMin, setTickMin] = useState('');
  const [tickMax, setTickMax] = useState('');
  const [paused, setPaused] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(0);

  const refresh = useCallback(() => {
    const logger = MatchLogger.getInstance();
    const all: AgentTickSnapshot[] = [];
    const positions = agentFilter === 'ALL' ? [...POSITIONS] : [agentFilter];
    for (const pos of positions) {
      for (const side of ['home', 'away'] as const) {
        const id = `${pos.toLowerCase()}_${side}`;
        all.push(...logger.getSnapshots(id, 200));
      }
    }
    all.sort((a, b) => b.tick - a.tick || a.agentId.localeCompare(b.agentId));
    setSnapshots(all);
    setLastRefresh(Date.now());
  }, [agentFilter]);

  useEffect(() => {
    if (paused) return;
    refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, [refresh, paused]);

  const filtered = snapshots.filter(s => {
    if (intentionFilter !== 'ALL' && s.intention !== intentionFilter) return false;
    if (onlyFlags && !s.isOutOfPosition && !s.shouldIgnoreBall && !s.targetAdjusted) return false;
    if (tickMin && s.tick < Number(tickMin)) return false;
    if (tickMax && s.tick > Number(tickMax)) return false;
    return true;
  });

  return (
    <div className="min-h-screen p-4 font-mono text-xs"
      style={{ background: '#0a0a0a', color: '#e5e5e5' }}>

      <div className="mb-4 flex items-center gap-3">
        <span className="font-display text-sm font-bold uppercase tracking-widest"
          style={{ color: '#FDE100' }}>
          Agent Debug Log
        </span>
        <span className="text-white/40">
          {filtered.length} entradas · {lastRefresh ? new Date(lastRefresh).toLocaleTimeString() : '—'}
        </span>
        <button
          onClick={() => setPaused(p => !p)}
          className="ml-auto rounded px-3 py-1 text-[11px] font-bold uppercase"
          style={{ background: paused ? '#22c55e22' : '#ef444422', color: paused ? '#22c55e' : '#ef4444', border: `1px solid ${paused ? '#22c55e' : '#ef4444'}44` }}>
          {paused ? '▶ Retomar' : '⏸ Pausar'}
        </button>
        <button
          onClick={refresh}
          className="rounded px-3 py-1 text-[11px] font-bold uppercase"
          style={{ background: '#ffffff11', color: '#fff', border: '1px solid #ffffff22' }}>
          ↻ Agora
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 rounded p-3"
        style={{ background: '#111', border: '1px solid #222' }}>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase text-white/40">Agente</label>
          <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
            className="rounded px-2 py-1 text-xs"
            style={{ background: '#1a1a1a', color: '#fff', border: '1px solid #333' }}>
            <option value="ALL">Todos</option>
            {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase text-white/40">Intenção</label>
          <select value={intentionFilter} onChange={e => setIntentionFilter(e.target.value)}
            className="rounded px-2 py-1 text-xs"
            style={{ background: '#1a1a1a', color: '#fff', border: '1px solid #333' }}>
            {INTENTIONS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase text-white/40">Tick min</label>
          <input type="number" value={tickMin} onChange={e => setTickMin(e.target.value)}
            placeholder="0" className="w-20 rounded px-2 py-1 text-xs"
            style={{ background: '#1a1a1a', color: '#fff', border: '1px solid #333' }} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase text-white/40">Tick max</label>
          <input type="number" value={tickMax} onChange={e => setTickMax(e.target.value)}
            placeholder="∞" className="w-20 rounded px-2 py-1 text-xs"
            style={{ background: '#1a1a1a', color: '#fff', border: '1px solid #333' }} />
        </div>

        <div className="flex flex-col justify-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={onlyFlags} onChange={e => setOnlyFlags(e.target.checked)}
              className="accent-yellow-400" />
            <span className="text-[11px] text-white/60">Só com flags (OOB / IGN / ADJ)</span>
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-white/30">
          Nenhum dado. Inicia uma partida em <code>/dev/agents-field</code> primeiro.
        </div>
      ) : (
        <div className="overflow-x-auto rounded" style={{ border: '1px solid #222' }}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr style={{ background: '#111', borderBottom: '1px solid #222' }}>
                {['Tick','Agente','Pos','Zone','Phase','Intenção','Ação','Target','Stam','Conf','Flags'].map(h => (
                  <th key={h} className="px-2 py-2 text-left text-[10px] uppercase text-white/40 font-normal whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={`${s.agentId}-${s.tick}-${i}`}
                  className="border-b"
                  style={{ borderColor: '#1a1a1a', background: i % 2 === 0 ? '#0d0d0d' : '#111' }}>
                  <td className="px-2 py-1.5 text-white/50">{s.tick}</td>
                  <td className="px-2 py-1.5 text-white/80 whitespace-nowrap">{s.agentId}</td>
                  <td className="px-2 py-1.5 font-bold whitespace-nowrap" style={{ color: '#FDE100' }}>{s.position}</td>
                  <td className="px-2 py-1.5 text-white/60 whitespace-nowrap">{s.zoneId}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap"><PhaseChip phase={s.phase} /></td>
                  <td className="px-2 py-1.5 whitespace-nowrap"><IntentionChip intention={s.intention} /></td>
                  <td className="px-2 py-1.5 text-white/70">{s.actionType}</td>
                  <td className="px-2 py-1.5 text-white/50 whitespace-nowrap">
                    {s.actionTarget ? `(${s.actionTarget.x.toFixed(1)}, ${s.actionTarget.y.toFixed(1)})` : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-white/50">{s.stamina.toFixed(0)}</td>
                  <td className="px-2 py-1.5 text-white/50">{s.confidence.toFixed(0)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <Flag label="OOB" active={s.isOutOfPosition} />
                    <Flag label="IGN" active={s.shouldIgnoreBall} />
                    <Flag label="ADJ" active={s.targetAdjusted} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

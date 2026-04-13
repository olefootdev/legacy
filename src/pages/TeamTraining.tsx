import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Dumbbell, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGameDispatch, useGameStore } from '@/game/store';
import { maxSlotsByTrainingCenter } from '@/systems/trainingPlans';

type IndividualType = 'fisico' | 'mental' | 'tatico' | 'atributos' | 'especial';
type CollectiveType = 'formacao' | 'empatia' | 'fisico';
type GroupType = 'defensivo' | 'criativo' | 'ataque' | 'all';

const INDIVIDUAL: IndividualType[] = ['fisico', 'mental', 'tatico', 'atributos', 'especial'];
const COLLECTIVE: CollectiveType[] = ['formacao', 'empatia', 'fisico'];
const GROUPS: GroupType[] = ['defensivo', 'criativo', 'ataque', 'all'];

export function TeamTraining() {
  const dispatch = useGameDispatch();
  const players = useGameStore((s) => s.players);
  const structures = useGameStore((s) => s.structures);
  const plans = useGameStore((s) => s.manager.trainingPlans);
  const [mode, setMode] = useState<'individual' | 'coletivo'>('individual');
  const [individualType, setIndividualType] = useState<IndividualType>('fisico');
  const [collectiveType, setCollectiveType] = useState<CollectiveType>('formacao');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [group, setGroup] = useState<GroupType>('all');
  const [durationHours, setDurationHours] = useState(24);

  const slots = maxSlotsByTrainingCenter(structures.training_center ?? 1);
  const roster = useMemo(
    () => Object.values(players).filter((p) => p.outForMatches <= 0).sort((a, b) => a.num - b.num),
    [players],
  );

  const running = plans.filter((p) => p.status === 'running');

  const togglePlayer = (id: string) => {
    setSelectedPlayers((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= slots) return prev;
      return [...prev, id];
    });
  };

  const startTraining = () => {
    dispatch({
      type: 'START_TEAM_TRAINING_PLAN',
      mode,
      trainingType: mode === 'individual' ? individualType : collectiveType,
      playerIds: selectedPlayers,
      group,
      durationHours,
    });
    setSelectedPlayers([]);
  };

  const completeDueNow = () => {
    dispatch({ type: 'COMPLETE_DUE_TRAININGS' });
  };

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-6 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-2xl font-black uppercase tracking-wider min-[390px]:text-3xl">
            <Dumbbell className="h-7 w-7 shrink-0 text-neon-yellow" />
            Meu Time / Treino
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Selecione o tipo, escolha jogadores/grupo e inicie o plano de treino com execução por período.
          </p>
        </div>
        <Link
          to="/team"
          className="flex shrink-0 items-center gap-2 self-start rounded bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20 sm:self-auto"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </Link>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="sports-panel p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-black/40 border border-white/10 rounded p-3 text-xs">
            <div className="text-gray-500 uppercase font-bold">Nível centro treino</div>
            <div className="text-white font-black text-lg">{structures.training_center ?? 1}</div>
          </div>
          <div className="bg-black/40 border border-white/10 rounded p-3 text-xs">
            <div className="text-gray-500 uppercase font-bold">Slots por treino</div>
            <div className="text-neon-yellow font-black text-lg">{slots}</div>
          </div>
          <div className="bg-black/40 border border-white/10 rounded p-3 text-xs">
            <div className="text-gray-500 uppercase font-bold">Planos em execução</div>
            <div className="text-white font-black text-lg">{running.length}</div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('individual')}
            className={mode === 'individual' ? 'bg-neon-yellow text-black px-4 py-2 rounded text-xs font-bold uppercase' : 'bg-white/5 border border-white/10 px-4 py-2 rounded text-xs font-bold uppercase'}
          >
            Individual
          </button>
          <button
            type="button"
            onClick={() => setMode('coletivo')}
            className={mode === 'coletivo' ? 'bg-neon-yellow text-black px-4 py-2 rounded text-xs font-bold uppercase' : 'bg-white/5 border border-white/10 px-4 py-2 rounded text-xs font-bold uppercase'}
          >
            Coletivo
          </button>
        </div>

        {mode === 'individual' ? (
          <div className="space-y-2">
            <div className="text-xs text-gray-400 font-bold uppercase">Tipo de treino (Individual)</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {INDIVIDUAL.map((t) => (
                <button key={t} onClick={() => setIndividualType(t)} className={individualType === t ? 'bg-neon-yellow text-black py-2 rounded text-xs font-bold uppercase' : 'bg-white/5 border border-white/10 py-2 rounded text-xs font-bold uppercase'}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-gray-400 font-bold uppercase">Tipo de treino (Coletivo)</div>
            <div className="grid grid-cols-3 gap-2">
              {COLLECTIVE.map((t) => (
                <button key={t} onClick={() => setCollectiveType(t)} className={collectiveType === t ? 'bg-neon-yellow text-black py-2 rounded text-xs font-bold uppercase' : 'bg-white/5 border border-white/10 py-2 rounded text-xs font-bold uppercase'}>
                  {t}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-400 font-bold uppercase mt-3">Grupo</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {GROUPS.map((g) => (
                <button key={g} onClick={() => setGroup(g)} className={group === g ? 'bg-neon-yellow text-black py-2 rounded text-xs font-bold uppercase' : 'bg-white/5 border border-white/10 py-2 rounded text-xs font-bold uppercase'}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-xs text-gray-400 font-bold uppercase">Período de execução</div>
          <input type="range" min={6} max={72} step={6} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} className="w-full accent-neon-yellow" />
          <div className="text-xs text-gray-500">{durationHours}h</div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="sports-panel p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-black uppercase tracking-wider">Selecionar jogadores</h3>
          <span className="text-xs text-gray-500">{selectedPlayers.length}/{slots}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {roster.map((p) => {
            const active = selectedPlayers.includes(p.id);
            const disabled = !active && selectedPlayers.length >= slots;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePlayer(p.id)}
                disabled={disabled || mode === 'coletivo'}
                className={`text-left p-2 rounded border ${active ? 'border-neon-yellow bg-neon-yellow/10' : 'border-white/10 bg-black/30'} disabled:opacity-40`}
              >
                <div className="text-xs font-bold text-white">{p.num} · {p.name}</div>
                <div className="text-[10px] text-gray-500">{p.pos} • FAT {Math.round(p.fatigue)}</div>
              </button>
            );
          })}
        </div>
      </motion.div>

      <div className="flex flex-wrap gap-3">
        <button onClick={startTraining} className="bg-neon-yellow text-black px-5 py-2 rounded text-xs font-bold uppercase tracking-wider">
          Iniciar treino
        </button>
        <button onClick={completeDueNow} className="bg-white/10 border border-white/20 text-white px-5 py-2 rounded text-xs font-bold uppercase tracking-wider">
          Concluir treinos vencidos
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="sports-panel p-5">
        <h3 className="font-display font-black uppercase tracking-wider mb-3">Fila de treinos</h3>
        <div className="space-y-2">
          {plans.length === 0 && <div className="text-xs text-gray-500">Nenhum treino cadastrado.</div>}
          {plans.map((p) => (
            <div key={p.id} className="bg-black/40 border border-white/10 rounded p-3">
              <div className="flex justify-between text-xs">
                <span className="text-white font-bold uppercase">{p.mode} · {p.trainingType}</span>
                <span className={p.status === 'running' ? 'text-neon-yellow' : 'text-neon-green'}>{p.status}</span>
              </div>
              <div className="text-[10px] text-gray-500 mt-1">
                jogadores: {p.playerIds.length} • grupo: {p.group} • fim: {new Date(p.endAt).toLocaleString('pt-BR')}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

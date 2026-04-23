import type { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  Dumbbell,
  Flame,
  Orbit,
  Save,
  Scale,
  Shield,
  Sparkles,
  StretchHorizontal,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { TeamMeuTimeHeader } from '@/pages/TeamMeuTimeHeader';
import { useGameDispatch, useGameStore } from '@/game/store';
import {
  STYLE_PRESETS,
  PRESET_LABEL_PT,
  totalStylePoints,
  redistributeStylePoints,
  type TeamTacticalStyle,
  type PlayingStylePresetId,
  type StyleAxisKey,
} from '@/tactics/playingStyle';

const AXES: Array<{ key: StyleAxisKey; label: string; left: string; right: string }> = [
  { key: 'buildUp', label: 'Construção', left: 'Posicional/curta', right: 'Direta/longa' },
  { key: 'width', label: 'Amplitude', left: 'Estreito', right: 'Amplo' },
  { key: 'verticality', label: 'Verticalidade', left: 'Circulação', right: 'Progressão imediata' },
  { key: 'chanceCreation', label: 'Criação', left: 'Central/entrelinhas', right: 'Cruzamentos/alas' },
  { key: 'shootingProfile', label: 'Perfil de chute', left: 'Prioriza dentro da área', right: 'Aceita longa distância' },
  { key: 'defensiveBlock', label: 'Bloco defensivo', left: 'Linha alta', right: 'Bloco baixo' },
  { key: 'pressing', label: 'Pressão', left: 'Baixa', right: 'Alta/Gegen' },
  { key: 'compactness', label: 'Compactação', left: 'Solto', right: 'Muito compacto' },
  { key: 'riskTaking', label: 'Risco', left: 'Seguro', right: 'Agressivo' },
  { key: 'velocidade', label: 'Velocidade', left: 'Jogo pausado', right: 'Transições rápidas' },
];

const PRESET_ICONS: Record<PlayingStylePresetId, LucideIcon> = {
  balanced: Scale,
  POSSE_CONTROLADA: Orbit,
  PRESSAO_ALTA: Flame,
  TRANSICAO_RAPIDA: Zap,
  BLOCO_BAIXO: Shield,
  JOGO_PELAS_LATERAIS: StretchHorizontal,
  JOGO_DIRETO: ArrowUpRight,
  CRIATIVO_LIVRE: Sparkles,
};

export function TeamTactics() {
  const dispatch = useGameDispatch();
  const manager = useGameStore((s) => s.manager);
  const style = manager.tacticalStyle;
  const [tacticName, setTacticName] = useState('');

  const current = style ?? STYLE_PRESETS.balanced;
  const savedTactics = manager.savedTactics ?? [];
  const selectedSavedId = useMemo(
    () => manager.activeMatchTacticId ?? savedTactics[0]?.id ?? null,
    [manager.activeMatchTacticId, savedTactics],
  );

  const pointsTotal = totalStylePoints(current);

  const setAxis = (key: StyleAxisKey, nextPoints: number) => {
    const next = redistributeStylePoints(current, key, nextPoints);
    dispatch({
      type: 'SET_MANAGER_SLIDERS',
      partial: { tacticalStyle: { ...next, presetId: undefined } },
    });
  };

  const applyPreset = (presetId: PlayingStylePresetId) => {
    dispatch({ type: 'SET_PLAYING_STYLE_PRESET', presetId });
  };

  const handleSave = () => {
    const name = tacticName.trim();
    if (!name) return;
    dispatch({ type: 'SAVE_TACTIC_PLAN', name });
  };

  const handleStartTraining = () => {
    if (!selectedSavedId) return;
    dispatch({ type: 'START_TACTIC_TRAINING', tacticId: selectedSavedId });
  };

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-6 pb-8">
      <TeamMeuTimeHeader
        title="Tática"
        subtitle={
          <>
            Distribui <span className="font-semibold text-white/90">100 pontos</span> entre os 10 eixos. O motor usa a
            proporção de cada eixo nas decisões.
          </>
        }
      />

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="sports-panel p-5">
        <h3 className="font-display font-black uppercase tracking-wider text-lg mb-4">Presets</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(Object.keys(STYLE_PRESETS) as PlayingStylePresetId[]).map((id) => {
            const active = (current.presetId ?? 'balanced') === id;
            const Icon = PRESET_ICONS[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => applyPreset(id)}
                className={
                  active
                    ? 'flex items-start gap-2 rounded bg-neon-yellow px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-black'
                    : 'flex items-start gap-2 rounded border border-white/10 bg-white/5 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10'
                }
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-90" aria-hidden />
                <span className="min-w-0 leading-snug">{PRESET_LABEL_PT[id]}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="sports-panel p-5 space-y-5">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h3 className="font-display font-black uppercase tracking-wider text-lg">Eixos do estilo</h3>
          <div className="text-xs font-bold uppercase tracking-wider">
            <span className={pointsTotal === 100 ? 'text-neon-yellow' : 'text-red-400'}>
              Total: {pointsTotal}/100 pontos
            </span>
            {current.presetId === undefined && (
              <span className="text-gray-500 ml-2 font-normal normal-case">(personalizado)</span>
            )}
          </div>
        </div>
        {AXES.map((axis) => {
          const value = Math.max(0, Math.round(Number(current[axis.key as keyof TeamTacticalStyle]) || 0));
          return (
            <div key={axis.key}>
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                <span>{axis.label}</span>
                <span className="text-neon-yellow">{value} pts</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={value}
                onChange={(e) => setAxis(axis.key, Number(e.target.value))}
                className="w-full accent-neon-yellow h-1 bg-black appearance-none cursor-pointer rounded-full"
              />
              <div className="flex justify-between text-[10px] text-gray-600 font-bold mt-1">
                <span>{axis.left}</span>
                <span>{axis.right}</span>
              </div>
            </div>
          );
        })}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="sports-panel p-5 space-y-4">
        <h3 className="font-display font-black uppercase tracking-wider text-lg">Salvar Tática</h3>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            value={tacticName}
            onChange={(e) => setTacticName(e.target.value)}
            placeholder="Nome da tática (ex.: Pressão Alta 4-3-3)"
            className="flex-1 bg-black/60 border border-white/20 rounded px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-neon-yellow/60 outline-none"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!tacticName.trim()}
            className="inline-flex items-center justify-center gap-2 rounded bg-neon-yellow px-4 py-2 text-xs font-bold uppercase tracking-wider text-black disabled:opacity-40"
          >
            <Save className="h-4 w-4 shrink-0" aria-hidden />
            Salvar
          </button>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Táticas salvas</div>
          <div className="grid gap-2 max-h-44 overflow-auto pr-1">
            {savedTactics.length === 0 && (
              <div className="text-xs text-gray-500">Nenhuma tática salva ainda.</div>
            )}
            {savedTactics.map((t) => {
              const activeMatch = manager.activeMatchTacticId === t.id;
              const activeTraining = manager.activeTrainingTacticId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => dispatch({ type: 'SET_MANAGER_SLIDERS', partial: { tacticalStyle: t.style, activeMatchTacticId: t.id } })}
                  className={`text-left p-3 rounded border transition-colors ${
                    activeMatch ? 'border-neon-yellow bg-neon-yellow/10' : 'border-white/15 bg-black/30 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{t.name}</span>
                    <span className="text-[10px] text-gray-500">{t.style.presetId ?? 'custom'}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    {activeMatch ? 'Pronta para partidas' : 'Clique para usar nas partidas'}
                    {activeTraining ? ' • Em treino' : ''}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 pt-1">
          <button
            type="button"
            onClick={handleStartTraining}
            disabled={!selectedSavedId}
            className="inline-flex items-center justify-center gap-2 rounded border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/20 disabled:opacity-40"
          >
            <Dumbbell className="h-4 w-4 shrink-0" aria-hidden />
            Treinar
          </button>
          <span className="text-xs text-gray-500 self-center">
            Em <b>TREINAR</b>, a tática selecionada passa a ser implementada também nos treinos.
          </span>
        </div>
      </motion.div>
    </div>
  );
}

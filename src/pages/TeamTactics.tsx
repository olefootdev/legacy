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
  type PlayingStylePresetId,
} from '@/tactics/playingStyle';

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
        subtitle="Escolha um preset e salve suas táticas favoritas para usar em partidas e treinos."
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

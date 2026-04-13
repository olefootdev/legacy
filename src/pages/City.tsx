import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2,
  Activity,
  Dumbbell,
  GraduationCap,
  Store,
  Zap,
  ArrowUpCircle,
  Users,
  Coins,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useGameDispatch, useGameStore } from '@/game/store';
import { getNextUpgradeCost } from '@/clubStructures/upgrade';
import { DEFAULT_BRO_PRICES_CENTS } from '@/clubStructures/broDefaults';
import { MAX_LEVEL, type ClubStructureId } from '@/clubStructures/types';
import { formatBroFromCents, formatExp } from '@/systems/economy';
import {
  CITY_QUICK_MEDICAL_COST_EXP,
  CITY_QUICK_STORE_BRO_GAIN_CENTS,
  CITY_QUICK_STORE_COST_EXP,
  CITY_QUICK_TRAINING_COST_EXP,
  CITY_QUICK_TRAINING_DURATION_H,
} from '@/game/cityQuickConstants';
import { maxSlotsByTrainingCenter } from '@/systems/trainingPlans';
import { GameBannerBackdrop } from '@/components/GameBannerBackdrop';
import { STRUCTURE_TO_BANNER_SLOT } from '@/ui/banners';

type CityStructDef = {
  uiId: string;
  structureId: ClubStructureId;
  name: string;
  icon: typeof Building2;
  color: string;
  bg: string;
  border: string;
  desc: string;
  action: string;
  actionIcon: typeof Users;
  statsForLevel: (level: number) => { label: string; value: string }[];
};

const CITY_STRUCTURE_DEFS: CityStructDef[] = [
  {
    uiId: 'stadium',
    structureId: 'stadium',
    name: 'Estádio',
    icon: Building2,
    color: 'text-neon-yellow',
    bg: 'bg-neon-yellow/10',
    border: 'border-neon-yellow',
    desc: 'O coração do clube. Cada nível reforça capacidade, receita em dias de jogo e o ambiente para a torcida.',
    action: 'Expandir Arquibancada',
    actionIcon: Users,
    statsForLevel: (lvl) => [
      {
        label: 'Capacidade (aprox.)',
        value: `${(22000 + (lvl - 1) * 8500).toLocaleString('pt-BR')} lugares`,
      },
      { label: 'Nível', value: `${lvl} / ${MAX_LEVEL}` },
    ],
  },
  {
    uiId: 'ct',
    structureId: 'training_center',
    name: 'Centro de Treinamento',
    icon: Dumbbell,
    color: 'text-neon-green',
    bg: 'bg-neon-green/10',
    border: 'border-neon-green',
    desc: 'Mais campos e ciência do desporto: melhor ganho de atributos e mais planos de treino em simultâneo.',
    action: 'Treino Intensivo',
    actionIcon: Zap,
    statsForLevel: (lvl) => [
      { label: 'Slots de plano', value: String(maxSlotsByTrainingCenter(lvl)) },
      { label: 'Nível', value: `${lvl} / ${MAX_LEVEL}` },
    ],
  },
  {
    uiId: 'dm',
    structureId: 'medical_dept',
    name: 'Departamento Médico',
    icon: Activity,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500',
    desc: 'Recuperação e prevenção: menos fadiga acumulada e risco de lesão após investimento em mutirão.',
    action: 'Mutirão de Cura',
    actionIcon: Activity,
    statsForLevel: (lvl) => [
      { label: 'Cobertura', value: `Nível ${lvl}` },
      { label: 'Mutirão (EXP)', value: `${CITY_QUICK_MEDICAL_COST_EXP} EXP` },
    ],
  },
  {
    uiId: 'base',
    structureId: 'youth_academy',
    name: 'Categoria de Base',
    icon: GraduationCap,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400',
    desc: 'Revela jovens promessas para o plantel ou para o mercado.',
    action: 'Buscar Promessas',
    actionIcon: Users,
    statsForLevel: (lvl) => [
      { label: 'Potencial de scouting', value: `Nível ${lvl}` },
      { label: 'Nível', value: `${lvl} / ${MAX_LEVEL}` },
    ],
  },
  {
    uiId: 'store',
    structureId: 'megastore',
    name: 'Megaloja',
    icon: Store,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-400',
    desc: 'Merchandising e campanhas relâmpago convertem EXP em BRO e reforçam o apoio da torcida.',
    action: 'Campanha de Vendas',
    actionIcon: Coins,
    statsForLevel: (lvl) => [
      { label: 'Campanha (EXP → BRO)', value: `${CITY_QUICK_STORE_COST_EXP} → +${CITY_QUICK_STORE_BRO_GAIN_CENTS / 100} BRO` },
      { label: 'Nível', value: `${lvl} / ${MAX_LEVEL}` },
    ],
  },
];

function levelOf(structures: Record<string, number>, id: ClubStructureId): number {
  const n = structures[id];
  return typeof n === 'number' && n >= 1 ? Math.min(MAX_LEVEL, n) : 1;
}

function upgradeLine(
  structureId: ClubStructureId,
  level: number,
  ole: number,
  broCents: number,
): { title: string; subtitle: string; canAfford: boolean; hasUpgrade: boolean } {
  const c = getNextUpgradeCost(structureId, level, DEFAULT_BRO_PRICES_CENTS);
  if (!c) {
    return {
      title: 'Nível máximo',
      subtitle: 'Estrutura no topo da árvore de evolução.',
      canAfford: false,
      hasUpgrade: false,
    };
  }
  if (c.currency === 'exp') {
    return {
      title: `${formatExp(c.amount)} EXP`,
      subtitle: 'Upgrade com tesouraria EXP (ranking).',
      canAfford: ole >= c.amount,
      hasUpgrade: true,
    };
  }
  return {
    title: formatBroFromCents(c.amount),
    subtitle: 'Upgrade com BRO na carteira.',
    canAfford: broCents >= c.amount,
    hasUpgrade: true,
  };
}

export function City() {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const structuresState = useGameStore((s) => s.structures);
  const finance = useGameStore((s) => s.finance);
  const crowd = useGameStore((s) => s.crowd);

  const [selected, setSelected] = useState(CITY_STRUCTURE_DEFS[0]!);
  const [quickPendingId, setQuickPendingId] = useState<ClubStructureId | null>(null);

  const level = levelOf(structuresState, selected.structureId);
  const stats = useMemo(() => selected.statsForLevel(level), [selected, level]);
  const upgrade = useMemo(
    () => upgradeLine(selected.structureId, level, finance.ole, finance.broCents),
    [selected.structureId, level, finance.ole, finance.broCents],
  );

  const canQuickMedical = finance.ole >= CITY_QUICK_MEDICAL_COST_EXP;
  const canQuickStore = finance.ole >= CITY_QUICK_STORE_COST_EXP;
  const canQuickTraining = finance.ole >= CITY_QUICK_TRAINING_COST_EXP;

  const handleUpgrade = () => {
    if (!upgrade.hasUpgrade || !upgrade.canAfford) return;
    dispatch({ type: 'UPGRADE_STRUCTURE', structureId: selected.structureId });
  };

  const runQuickAction = (id: ClubStructureId) => {
    if (id === 'stadium') {
      const lvl = levelOf(structuresState, 'stadium');
      const up = upgradeLine('stadium', lvl, finance.ole, finance.broCents);
      if (!up.hasUpgrade || !up.canAfford) return;
      dispatch({ type: 'UPGRADE_STRUCTURE', structureId: 'stadium' });
      return;
    }
    if (id === 'training_center') {
      if (!canQuickTraining) return;
      dispatch({ type: 'CITY_QUICK_TRAINING_INTENSIVO' });
      return;
    }
    if (id === 'medical_dept') {
      if (!canQuickMedical) return;
      dispatch({ type: 'CITY_QUICK_MEDICAL_MUTIRAO' });
      return;
    }
    if (id === 'youth_academy') {
      navigate('/city/youth-prospects');
      return;
    }
    if (id === 'megastore') {
      if (!canQuickStore) return;
      dispatch({ type: 'CITY_QUICK_STORE_CAMPAIGN' });
    }
  };

  const openQuickConfirm = () => {
    if (quickDisabled) return;
    setQuickPendingId(selected.structureId);
  };

  const stadiumUpgradeForModal = useMemo(() => {
    const lvl = levelOf(structuresState, 'stadium');
    return upgradeLine('stadium', lvl, finance.ole, finance.broCents);
  }, [structuresState, finance.ole, finance.broCents]);

  const quickConfirmCopy = useMemo(() => {
    if (!quickPendingId) return null;
    const def = CITY_STRUCTURE_DEFS.find((d) => d.structureId === quickPendingId);
    const title = def ? `Desejas fazer «${def.action}»?` : 'Desejas confirmar esta ação?';
    const lines: string[] = [];
    let costExpLine: string | null = null;
    let confirmBlocked = false;

    if (quickPendingId === 'stadium') {
      const up = stadiumUpgradeForModal;
      if (!up.hasUpgrade) {
        lines.push('Não há próximo nível disponível para o estádio.');
        confirmBlocked = true;
      } else if (!up.canAfford) {
        lines.push('Saldo insuficiente para este upgrade.');
        confirmBlocked = true;
      } else {
        const c = getNextUpgradeCost('stadium', levelOf(structuresState, 'stadium'), DEFAULT_BRO_PRICES_CENTS);
        if (c?.currency === 'exp') {
          costExpLine = `Custo em EXP: ${formatExp(c.amount)}`;
          lines.push('O estádio sobe um nível. Reforço de ambiente e capacidade para a torcida.');
        } else if (c?.currency === 'bro') {
          costExpLine = 'Custo em EXP: nenhum neste nível.';
          lines.push(`Custo em BRO: ${formatBroFromCents(c.amount)} (debitado da carteira).`);
          lines.push('O estádio sobe um nível.');
        }
      }
    } else if (quickPendingId === 'training_center') {
      costExpLine = `Custo em EXP: ${formatExp(CITY_QUICK_TRAINING_COST_EXP)}`;
      lines.push(
        `Plano físico coletivo (~${CITY_QUICK_TRAINING_DURATION_H}h). Respeita os slots do CT (nível atual).`,
      );
      if (!canQuickTraining) confirmBlocked = true;
    } else if (quickPendingId === 'medical_dept') {
      costExpLine = `Custo em EXP: ${formatExp(CITY_QUICK_MEDICAL_COST_EXP)}`;
      lines.push('Reduz fadiga e risco de lesão em todo o plantel (mutirão médico).');
      if (!canQuickMedical) confirmBlocked = true;
    } else if (quickPendingId === 'youth_academy') {
      costExpLine = 'Custo em EXP: nenhum.';
      lines.push('Abre o olheiro da categoria de base para ver promessas.');
    } else if (quickPendingId === 'megastore') {
      costExpLine = `Custo em EXP: ${formatExp(CITY_QUICK_STORE_COST_EXP)}`;
      lines.push(
        `Ganhas cerca de +${CITY_QUICK_STORE_BRO_GAIN_CENTS / 100} BRO e um pequeno reforço no apoio da torcida (atual ${crowd.supportPercent.toFixed(1)}%).`,
      );
      if (!canQuickStore) confirmBlocked = true;
    }

    return { title, lines, costExpLine, confirmBlocked };
  }, [
    quickPendingId,
    stadiumUpgradeForModal,
    structuresState,
    canQuickTraining,
    canQuickMedical,
    canQuickStore,
    crowd.supportPercent,
  ]);

  const quickDisabled =
    selected.structureId === 'stadium'
      ? !upgrade.hasUpgrade || !upgrade.canAfford
      : selected.structureId === 'training_center'
        ? !canQuickTraining
        : selected.structureId === 'medical_dept'
          ? !canQuickMedical
          : selected.structureId === 'megastore'
            ? !canQuickStore
            : false;

  const quickHint =
    selected.structureId === 'stadium'
      ? 'Mesmo fluxo que “Evoluir estrutura”: paga EXP ou BRO conforme o nível.'
      : selected.structureId === 'training_center'
        ? `Gasta ${CITY_QUICK_TRAINING_COST_EXP} EXP e abre plano físico coletivo (~${CITY_QUICK_TRAINING_DURATION_H}h). Respeita slots do CT.`
        : selected.structureId === 'medical_dept'
          ? `Gasta ${CITY_QUICK_MEDICAL_COST_EXP} EXP para reduzir fadiga e risco de lesão em todo o plantel.`
          : selected.structureId === 'megastore'
            ? `Gasta ${CITY_QUICK_STORE_COST_EXP} EXP, credita +${CITY_QUICK_STORE_BRO_GAIN_CENTS / 100} BRO e aumenta ligeiramente o apoio da torcida (atual ${crowd.supportPercent.toFixed(1)}%).`
            : 'Abre o olheiro da categoria de base.';

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-2xl font-black italic uppercase tracking-wider sm:text-3xl md:text-4xl">
          Cidade do Clube
        </h2>
        <div className="text-right space-y-1">
          <div className="text-neon-yellow font-display font-black text-xl">{formatExp(finance.ole)} EXP</div>
          <div className="text-sm text-white font-display font-bold">{formatBroFromCents(finance.broCents)}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Tesouraria · Apoio {crowd.supportPercent.toFixed(1)}%</div>
        </div>
      </div>

      <div className="sports-panel relative overflow-hidden bg-black/80 p-4 sm:p-6 md:p-8">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 mx-auto grid aspect-square w-full min-w-0 max-w-4xl grid-cols-3 grid-rows-3 gap-2 sm:gap-4 md:aspect-[16/9] md:gap-8">
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ strokeDasharray: '8 8' }}>
            <line x1="50%" y1="50%" x2="16.6%" y2="16.6%" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
            <line x1="50%" y1="50%" x2="83.3%" y2="16.6%" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
            <line x1="50%" y1="50%" x2="16.6%" y2="83.3%" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
            <line x1="50%" y1="50%" x2="83.3%" y2="83.3%" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
          </svg>

          <div className="col-start-2 row-start-2 flex justify-center items-center z-10">
            <StructureNode struct={CITY_STRUCTURE_DEFS[0]!} level={levelOf(structuresState, 'stadium')} selected={selected} onSelect={setSelected} />
          </div>
          <div className="col-start-1 row-start-1 flex justify-center items-center z-10">
            <StructureNode struct={CITY_STRUCTURE_DEFS[3]!} level={levelOf(structuresState, 'youth_academy')} selected={selected} onSelect={setSelected} />
          </div>
          <div className="col-start-3 row-start-1 flex justify-center items-center z-10">
            <StructureNode struct={CITY_STRUCTURE_DEFS[4]!} level={levelOf(structuresState, 'megastore')} selected={selected} onSelect={setSelected} />
          </div>
          <div className="col-start-1 row-start-3 flex justify-center items-center z-10">
            <StructureNode struct={CITY_STRUCTURE_DEFS[1]!} level={levelOf(structuresState, 'training_center')} selected={selected} onSelect={setSelected} />
          </div>
          <div className="col-start-3 row-start-3 flex justify-center items-center z-10">
            <StructureNode struct={CITY_STRUCTURE_DEFS[2]!} level={levelOf(structuresState, 'medical_dept')} selected={selected} onSelect={setSelected} />
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selected && (
          <motion.div
            key={selected.uiId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              'sports-panel max-h-[min(88dvh,calc(100dvh-9rem))] overflow-x-hidden overflow-y-auto border-2 p-0 transition-colors duration-500 sm:max-h-none sm:overflow-y-visible',
              selected.border,
            )}
          >
            <div
              className={cn(
                'relative flex items-center justify-between overflow-hidden border-b border-white/10 p-4 sm:p-6',
                selected.bg,
              )}
            >
              <GameBannerBackdrop slot={STRUCTURE_TO_BANNER_SLOT[selected.structureId]} className="z-0" />
              <div
                className="pointer-events-none absolute inset-0 z-[1] opacity-30 mix-blend-overlay"
                style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '4px 4px' }}
              />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h3 className="font-display font-black text-3xl uppercase italic tracking-wider text-white drop-shadow-md">{selected.name}</h3>
                  <span className="bg-black/80 px-2 py-1 rounded text-xs font-bold border border-white/20 text-white">
                    NÍVEL {level}
                  </span>
                </div>
                <p className="text-gray-300 max-w-xl text-sm font-medium">{selected.desc}</p>
              </div>
              <selected.icon className={cn('w-20 h-20 opacity-20 absolute right-6 -bottom-4 rotate-12', selected.color)} />
            </div>

            <div className="grid grid-cols-1 gap-4 bg-dark-gray p-4 sm:gap-6 sm:p-6 md:grid-cols-3">
              <div className="space-y-4">
                <h4 className="font-bold text-gray-500 uppercase tracking-wider text-xs flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Status atual
                </h4>
                <div className="space-y-2">
                  {stats.map((s, i) => (
                    <div key={i} className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5">
                      <span className="text-gray-400 text-sm font-medium">{s.label}</span>
                      <span className="font-display font-bold text-lg text-white text-right">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-gray-500 uppercase tracking-wider text-xs flex items-center gap-2">
                  <ArrowUpCircle className="w-4 h-4" /> Próximo nível
                </h4>
                <div className="bg-black/40 p-4 rounded-lg border border-white/5 space-y-3">
                  <div className="flex justify-between text-sm items-center gap-2">
                    <span className="text-gray-400 font-medium">Custo</span>
                    <span
                      className={cn(
                        'font-display font-bold text-lg text-right',
                        upgrade.hasUpgrade && upgrade.canAfford ? 'text-neon-yellow' : 'text-gray-500',
                      )}
                    >
                      {upgrade.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-snug">{upgrade.subtitle}</p>
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-400 font-medium">Tempo</span>
                    <span className="text-white font-display font-bold">Imediato</span>
                  </div>
                  <button
                    type="button"
                    disabled={!upgrade.hasUpgrade || !upgrade.canAfford}
                    onClick={handleUpgrade}
                    className={cn(
                      'w-full mt-2 py-2.5 font-display font-bold uppercase tracking-wider text-sm -skew-x-6 transition-colors border',
                      upgrade.hasUpgrade && upgrade.canAfford
                        ? 'bg-neon-yellow text-black border-neon-yellow hover:brightness-110'
                        : 'bg-white/5 text-gray-500 border-white/10 cursor-not-allowed',
                    )}
                  >
                    <span className="skew-x-6 block">Evoluir estrutura</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-gray-500 uppercase tracking-wider text-xs flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Ação rápida
                </h4>
                <div className="h-full flex flex-col justify-start pt-2">
                  <button
                    type="button"
                    disabled={quickDisabled}
                    onClick={openQuickConfirm}
                    className={cn(
                      'w-full py-5 text-black font-display font-black uppercase tracking-wider text-lg -skew-x-6 transition-all shadow-lg',
                      quickDisabled ? 'opacity-40 cursor-not-allowed grayscale' : 'hover:scale-[1.02]',
                      selected.structureId === 'stadium' ? 'bg-neon-yellow hover:shadow-[0_0_20px_rgba(228,255,0,0.4)]' :
                      selected.structureId === 'training_center' ? 'bg-neon-green hover:shadow-[0_0_20px_rgba(0,255,102,0.4)]' :
                      selected.structureId === 'medical_dept' ? 'bg-red-500 text-white hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]' :
                      selected.structureId === 'youth_academy' ? 'bg-blue-400 hover:shadow-[0_0_20px_rgba(96,165,250,0.4)]' :
                      'bg-purple-400 hover:shadow-[0_0_20px_rgba(192,132,252,0.4)]',
                    )}
                  >
                    <span className="skew-x-6 flex items-center justify-center gap-3">
                      <selected.actionIcon className="w-6 h-6" />
                      {selected.action}
                    </span>
                  </button>
                  <p className="text-center text-[11px] text-gray-500 mt-3 font-medium px-2 leading-relaxed">{quickHint}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {quickPendingId && quickConfirmCopy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-y-contain bg-black/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:items-center sm:p-4"
            onClick={() => setQuickPendingId(null)}
            role="presentation"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="my-auto flex w-full max-w-md shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-dark-gray shadow-2xl max-h-[min(88dvh,calc(100dvh-5rem))] sm:max-h-[min(92dvh,720px)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="city-quick-confirm-title"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-black/40 p-4">
                <h3
                  id="city-quick-confirm-title"
                  className="pr-2 font-display text-sm font-black uppercase tracking-wider text-white md:text-base"
                >
                  Confirmar ação rápida
                </h3>
                <button
                  type="button"
                  onClick={() => setQuickPendingId(null)}
                  className="shrink-0 p-1 text-gray-400 transition-colors hover:text-white"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain p-5">
                <p className="font-display text-lg font-bold leading-snug text-white">{quickConfirmCopy.title}</p>
                {quickConfirmCopy.costExpLine && (
                  <p className="font-display text-xl font-black tracking-tight text-neon-yellow">
                    {quickConfirmCopy.costExpLine}
                  </p>
                )}
                <ul className="list-disc space-y-2 pl-4 text-sm leading-relaxed text-gray-300">
                  {quickConfirmCopy.lines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-white/10 bg-black/30 p-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setQuickPendingId(null)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-white/20 text-white font-display font-bold uppercase text-sm tracking-wider hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={quickConfirmCopy.confirmBlocked}
                  onClick={() => {
                    if (quickConfirmCopy.confirmBlocked || !quickPendingId) return;
                    runQuickAction(quickPendingId);
                    setQuickPendingId(null);
                  }}
                  className={cn(
                    'w-full sm:w-auto px-5 py-2.5 rounded-lg font-display font-black uppercase text-sm tracking-wider transition-colors border',
                    quickConfirmCopy.confirmBlocked
                      ? 'bg-white/10 text-gray-500 border-white/10 cursor-not-allowed'
                      : 'bg-neon-yellow text-black border-neon-yellow hover:brightness-110',
                  )}
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StructureNode({
  struct,
  level,
  selected,
  onSelect,
}: {
  struct: CityStructDef;
  level: number;
  selected: CityStructDef;
  onSelect: (s: CityStructDef) => void;
}) {
  const isSelected = selected.uiId === struct.uiId;

  return (
    <button
      type="button"
      onClick={() => onSelect(struct)}
      className={cn(
        'relative z-10 flex flex-col items-center gap-2 transition-all duration-300 sm:gap-3',
        isSelected ? 'z-20 scale-105 sm:scale-110' : 'opacity-60 hover:z-20 hover:scale-[1.03] hover:opacity-100 sm:hover:scale-105',
      )}
    >
      {isSelected && (
        <div className={cn('absolute top-4 w-20 h-20 blur-2xl rounded-full opacity-50', struct.bg.replace('/10', ''))} />
      )}

      <div
        className={cn(
          'w-20 h-20 md:w-28 md:h-28 rounded-2xl border-2 flex items-center justify-center relative overflow-hidden transition-colors duration-300 shadow-xl',
          isSelected ? cn(struct.border, 'bg-dark-gray') : 'border-white/20 bg-black/80',
        )}
      >
        <div className={cn('absolute inset-0 opacity-20 transition-opacity', struct.bg, isSelected ? 'opacity-30' : 'group-hover:opacity-20')} />
        <div
          className="absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '4px 4px' }}
        />

        <struct.icon className={cn('w-10 h-10 md:w-12 md:h-12 relative z-10 transition-colors', isSelected ? struct.color : 'text-white')} />

        <div className="absolute bottom-1.5 right-1.5 bg-black/90 px-1.5 py-0.5 rounded text-[9px] font-bold border border-white/20 text-white z-10">
          {level}
        </div>
      </div>

      <span
        className={cn(
          'font-display font-bold uppercase tracking-wider text-xs md:text-sm text-center max-w-[100px] md:max-w-[120px] leading-tight drop-shadow-md transition-colors',
          isSelected ? struct.color : 'text-white',
        )}
      >
        {struct.name}
      </span>
    </button>
  );
}

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
  ChevronRight,
  TrendingUp,
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
import { BackButton } from '@/components/BackButton';
import { maxSlotsByTrainingCenter } from '@/systems/trainingPlans';
import {
  megastoreAwayConfidenceBonusPoints,
  megastoreHomeConfidenceBonusPoints,
  medicalDeptRecoverySpeedBonusPercent,
  medicalDeptTreatmentSlots,
  stadiumCapacityByLevel,
  stadiumExpPerSpectatorByLevel,
  trainingCenterAttributeGainMultiplier,
  trainingCenterHasAiLabs,
  trainingCenterMaxConcurrentCollectivePlans,
  youthAcademyProspectTrainingMultiplier,
} from '@/clubStructures/benefits';
import { useTrackScreen, trackMissionEvent } from '@/progression/trackEvent';
import { TeamMeuTimeHeader } from '@/pages/TeamMeuTimeHeader';

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
        label: 'Capacidade',
        value: `${stadiumCapacityByLevel(lvl).toLocaleString('pt-BR')} lugares`,
      },
      {
        label: 'EXP / assistente (casa)',
        value: `${stadiumExpPerSpectatorByLevel(lvl)}`,
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
      { label: 'Slots por tipo de treino', value: String(maxSlotsByTrainingCenter(lvl)) },
      {
        label: 'Colectivos simultâneos',
        value: String(trainingCenterMaxConcurrentCollectivePlans(lvl)),
      },
      {
        label: 'AI Labs',
        value: trainingCenterHasAiLabs(lvl) ? 'Desbloqueado' : 'Bloqueado',
      },
      {
        label: 'Booster atributos',
        value: `${Math.round((trainingCenterAttributeGainMultiplier(lvl) - 1) * 100)}%`,
      },
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
      { label: 'Slots de tratamento', value: String(medicalDeptTreatmentSlots(lvl)) },
      {
        label: 'Velocidade recuperação',
        value: `+${medicalDeptRecoverySpeedBonusPercent(lvl)}%`,
      },
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
      {
        label: 'Booster treino (promessas)',
        value: `${Math.round((youthAcademyProspectTrainingMultiplier(lvl) - 1) * 100)}%`,
      },
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
    desc: 'Reforça o apoio em casa e fora; em vitórias, converte confiança da torcida em EXP extra.',
    action: 'Campanha de Vendas',
    actionIcon: Coins,
    statsForLevel: (lvl) => [
      { label: 'Campanha (EXP → BRO)', value: `${CITY_QUICK_STORE_COST_EXP} → +${CITY_QUICK_STORE_BRO_GAIN_CENTS / 100} BRO` },
      {
        label: 'Apoio em casa',
        value: `+${megastoreHomeConfidenceBonusPoints(lvl)} pts`,
      },
      {
        label: 'Apoio fora',
        value: lvl >= 4 ? `+${megastoreAwayConfidenceBonusPoints(lvl)} pts` : '—',
      },
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
  useTrackScreen('screen_city');
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const structuresState = useGameStore((s) => s.structures);
  const finance = useGameStore((s) => s.finance);
  const crowd = useGameStore((s) => s.crowd);
  const clubName = useGameStore((s) => s.club.name);

  const [selected, setSelected] = useState<CityStructDef | null>(null);
  const [quickPendingId, setQuickPendingId] = useState<ClubStructureId | null>(null);

  const stadiumLevel = levelOf(structuresState, 'stadium');
  const stadiumUpgrade = useMemo(
    () => upgradeLine('stadium', stadiumLevel, finance.ole, finance.broCents),
    [stadiumLevel, finance.ole, finance.broCents],
  );

  const canQuickMedical = finance.ole >= CITY_QUICK_MEDICAL_COST_EXP;
  const canQuickStore = finance.ole >= CITY_QUICK_STORE_COST_EXP;
  const canQuickTraining = finance.ole >= CITY_QUICK_TRAINING_COST_EXP;

  const runQuickAction = (id: ClubStructureId) => {
    if (id === 'stadium') {
      const lvl = levelOf(structuresState, 'stadium');
      const up = upgradeLine('stadium', lvl, finance.ole, finance.broCents);
      if (!up.hasUpgrade || !up.canAfford) return;
      dispatch({ type: 'UPGRADE_STRUCTURE', structureId: 'stadium' });
      trackMissionEvent('structure_upgraded');
      return;
    }
    if (id === 'training_center') {
      if (!canQuickTraining) return;
      dispatch({ type: 'CITY_QUICK_TRAINING_INTENSIVO' });
      trackMissionEvent('training_session');
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

  const quickConfirmCopy = useMemo(() => {
    if (!quickPendingId) return null;
    const def = CITY_STRUCTURE_DEFS.find((d) => d.structureId === quickPendingId);
    const title = def ? `Desejas fazer «${def.action}»?` : 'Desejas confirmar esta ação?';
    const lines: string[] = [];
    let costExpLine: string | null = null;
    let confirmBlocked = false;

    if (quickPendingId === 'stadium') {
      const up = stadiumUpgrade;
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
    stadiumUpgrade,
    structuresState,
    canQuickTraining,
    canQuickMedical,
    canQuickStore,
    crowd.supportPercent,
  ]);

  return (
    <div className="w-full max-w-[100vw] min-w-0 mx-auto space-y-6 pb-8 overflow-x-hidden px-3 sm:px-4 lg:px-6">
      <div className="w-full max-w-6xl min-w-0 mx-auto">
        <BackButton to="/clube" label="Clube" />
      </div>
      {/* Header com navegação integrada */}
      <div className="w-full max-w-6xl min-w-0 mx-auto">
        <TeamMeuTimeHeader
          title="Cidade do Clube"
          subtitle={
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <span>Estruturas, evolução e ações rápidas para o desenvolvimento do clube.</span>
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span className="text-neon-yellow font-display font-black">{formatExp(finance.ole)} EXP</span>
                <span className="text-white/40">·</span>
                <span className="text-white/70 font-display font-bold">{formatBroFromCents(finance.broCents)}</span>
                <span className="text-white/40">·</span>
                <span className="text-white/60">Apoio {crowd.supportPercent.toFixed(1)}%</span>
              </div>
            </div>
          }
        />
      </div>

      <div className="w-full max-w-6xl min-w-0 mx-auto space-y-6">
        {/* Hero Principal — Estádio */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative isolate overflow-hidden bg-neon-yellow border border-black/15 w-full max-w-full min-w-0"
          style={{ borderRadius: 'var(--radius-sm)', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}
        >
          {/* Watermark gigante */}
          <div
            className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
            aria-hidden
          >
            <Building2
              className="text-black/[0.04]"
              style={{ width: 'clamp(200px, 40vw, 500px)', height: 'clamp(200px, 40vw, 500px)' }}
              strokeWidth={1}
            />
          </div>

          {/* Conteúdo */}
          <div className="relative z-10 p-6 sm:p-8">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-3 text-black/85 mb-3">
              <span aria-hidden className="h-px w-8 bg-black/60" />
              <span className="uppercase font-semibold text-[10px] tracking-[0.22em]">
                Estrutura Principal
              </span>
              <span aria-hidden className="h-px w-8 bg-black/60" />
            </div>

            {/* Título */}
            <h2
              className="italic text-black leading-none mb-2"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontWeight: 700,
                fontSize: 'clamp(2.5rem, 6vw, 3.75rem)',
                letterSpacing: '-0.02em',
              }}
            >
              Estádio
            </h2>

            <p className="text-black/70 text-sm sm:text-base mb-6 max-w-2xl">
              O coração do clube. Cada nível reforça capacidade, receita em dias de jogo e o ambiente para a torcida.
            </p>

            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-black px-3 py-3 sm:px-4 sm:py-4 text-center" style={{ borderRadius: 'var(--radius-sm)' }}>
                <p className="text-[9px] sm:text-[10px] text-white/65 uppercase tracking-[0.18em] mb-1.5">
                  Capacidade
                </p>
                <p
                  className="text-neon-yellow tabular-nums leading-none"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    fontSize: 'clamp(16px, 3vw, 24px)',
                  }}
                >
                  {(stadiumCapacityByLevel(stadiumLevel) / 1000).toFixed(0)}k
                </p>
              </div>
              <div className="bg-black px-3 py-3 sm:px-4 sm:py-4 text-center" style={{ borderRadius: 'var(--radius-sm)' }}>
                <p className="text-[9px] sm:text-[10px] text-white/65 uppercase tracking-[0.18em] mb-1.5">
                  EXP/Torcedor
                </p>
                <p
                  className="text-neon-yellow tabular-nums leading-none"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    fontSize: 'clamp(16px, 3vw, 24px)',
                  }}
                >
                  {stadiumExpPerSpectatorByLevel(stadiumLevel)}
                </p>
              </div>
              <div className="bg-black px-3 py-3 sm:px-4 sm:py-4 text-center" style={{ borderRadius: 'var(--radius-sm)' }}>
                <p className="text-[9px] sm:text-[10px] text-white/65 uppercase tracking-[0.18em] mb-1.5">
                  Nível
                </p>
                <p
                  className="text-white tabular-nums leading-none"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    fontSize: 'clamp(16px, 3vw, 24px)',
                  }}
                >
                  {stadiumLevel}/{MAX_LEVEL}
                </p>
              </div>
            </div>

            {/* CTA */}
            <button
              type="button"
              disabled={!stadiumUpgrade.hasUpgrade || !stadiumUpgrade.canAfford}
              onClick={() => setQuickPendingId('stadium')}
              className={cn(
                'w-full px-5 py-3 font-display font-bold uppercase tracking-[0.2em] text-[11px] sm:text-[12px] transition-all flex items-center justify-center gap-2',
                stadiumUpgrade.hasUpgrade && stadiumUpgrade.canAfford
                  ? 'bg-black text-neon-yellow hover:bg-deep-black shadow-[0_4px_12px_rgba(0,0,0,0.4)]'
                  : 'bg-black/60 text-black/40 cursor-not-allowed',
              )}
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <ArrowUpCircle className="w-4 h-4" />
              {stadiumUpgrade.hasUpgrade ? `Expandir · ${stadiumUpgrade.title}` : 'Nível Máximo'}
            </button>
          </div>
        </motion.div>

      {/* Grid de estruturas menores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-full min-w-0">
        {CITY_STRUCTURE_DEFS.slice(1).map((struct, idx) => {
          const level = levelOf(structuresState, struct.structureId);
          const upgrade = upgradeLine(struct.structureId, level, finance.ole, finance.broCents);
          const canQuick =
            struct.structureId === 'training_center' ? canQuickTraining :
            struct.structureId === 'medical_dept' ? canQuickMedical :
            struct.structureId === 'megastore' ? canQuickStore :
            true;

          return (
            <motion.div
              key={struct.uiId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + idx * 0.05 }}
              className="relative isolate overflow-hidden bg-panel border border-white/10 w-full max-w-full min-w-0 hover:border-white/20 transition-all"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              {/* Watermark do ícone */}
              <div
                className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
                aria-hidden
              >
                <struct.icon
                  className={cn('opacity-[0.03]', struct.color)}
                  style={{ width: 'clamp(120px, 30vw, 200px)', height: 'clamp(120px, 30vw, 200px)' }}
                  strokeWidth={1}
                />
              </div>

              {/* Conteúdo */}
              <div className="relative z-10 p-5 sm:p-6 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-12 w-12 shrink-0 items-center justify-center border-2 transition-transform hover:scale-110',
                        struct.bg,
                        struct.border
                      )}
                      style={{ borderRadius: 'var(--radius-sm)' }}
                    >
                      <struct.icon className={cn('h-6 w-6', struct.color)} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-black uppercase tracking-wider text-white">
                        {struct.name}
                      </h3>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                        Nível {level}/{MAX_LEVEL}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Descrição */}
                <p className="text-xs text-gray-400 leading-relaxed">
                  {struct.desc}
                </p>

                {/* Stats principais */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  {struct.statsForLevel(level).slice(0, 2).map((stat, i) => (
                    <div key={i} className="flex justify-between items-center text-xs gap-2">
                      <span className="text-gray-500 uppercase tracking-wider text-[10px]">{stat.label}</span>
                      <span className={cn('font-display font-bold', struct.color)}>{stat.value}</span>
                    </div>
                  ))}
                </div>

                {/* Ações */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    disabled={!upgrade.hasUpgrade || !upgrade.canAfford}
                    onClick={() => {
                      dispatch({ type: 'UPGRADE_STRUCTURE', structureId: struct.structureId });
                      trackMissionEvent('structure_upgraded');
                    }}
                    className={cn(
                      'flex-1 py-2.5 text-xs font-display font-bold uppercase tracking-wider transition-all border flex items-center justify-center gap-1.5',
                      upgrade.hasUpgrade && upgrade.canAfford
                        ? 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                        : 'bg-white/5 text-gray-600 border-white/5 cursor-not-allowed',
                    )}
                    style={{ borderRadius: 'var(--radius-sm)' }}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    Evoluir
                  </button>
                  <button
                    type="button"
                    disabled={!canQuick}
                    onClick={() => setQuickPendingId(struct.structureId)}
                    className={cn(
                      'flex-1 py-2.5 text-xs font-display font-bold uppercase tracking-wider transition-all border flex items-center justify-center gap-1.5',
                      canQuick
                        ? cn('border-transparent hover:brightness-110', struct.bg.replace('/10', '/90'), 'text-black')
                        : 'bg-white/5 text-gray-600 border-white/5 cursor-not-allowed',
                    )}
                    style={{ borderRadius: 'var(--radius-sm)' }}
                  >
                    <struct.actionIcon className="w-3.5 h-3.5" />
                    {struct.action.split(' ')[0]}
                  </button>
                </div>

                {/* Link para detalhes */}
                {struct.structureId === 'youth_academy' && (
                  <button
                    type="button"
                    onClick={() => navigate('/clube/academia')}
                    className="w-full text-xs text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1 pt-2 transition-colors"
                  >
                    <span>Ver promessas</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      </div>

      {/* Modal de confirmação */}
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
                  Confirmar ação
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

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2,
  Activity,
  Dumbbell,
  GraduationCap,
  Store,
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
  CITY_QUICK_STORE_COST_EXP,
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
  trainingCenterMaxConcurrentCollectivePlans,
  youthAcademyProspectTrainingMultiplier,
} from '@/clubStructures/benefits';
import { useTrackScreen, trackMissionEvent } from '@/progression/trackEvent';
import { BarraSegmentos, SecaoRua } from '@/components/ui/Rua';
import { L, LOCALE } from '@/i18n/L';

type CityStructDef = {
  uiId: string;
  structureId: ClubStructureId;
  name: string;
  icon: typeof Building2;
  desc: string;
  action?: string;
  actionIcon?: typeof Users;
  statsForLevel: (level: number) => { label: string; value: string }[];
};

const CITY_STRUCTURE_DEFS: CityStructDef[] = [
  {
    uiId: 'stadium',
    structureId: 'stadium',
    name: L('Estádio', 'Stadium'),
    icon: Building2,
    desc: L('O coração do clube. Cada nível reforça capacidade, receita em dias de jogo e o ambiente para a torcida.', 'The heart of the club. Each level boosts capacity, matchday revenue and the atmosphere for the fans.'),
    action: L('Expandir Arquibancada', 'Expand Stands'),
    actionIcon: Users,
    statsForLevel: (lvl) => [
      {
        label: L('Capacidade', 'Capacity'),
        value: L(`${stadiumCapacityByLevel(lvl).toLocaleString(LOCALE)} lugares`, `${stadiumCapacityByLevel(lvl).toLocaleString(LOCALE)} seats`),
      },
      {
        label: L('EXP / assistente (casa)', 'EXP / spectator (home)'),
        value: `${stadiumExpPerSpectatorByLevel(lvl)}`,
      },
      { label: L('Nível', 'Level'), value: `${lvl} / ${MAX_LEVEL}` },
    ],
  },
  {
    uiId: 'ct',
    structureId: 'training_center',
    name: L('Centro de Treinamento', 'Training Center'),
    icon: Dumbbell,
    desc: L('Mais ganho e planos de treino', 'More gains and training plans'),
    statsForLevel: (lvl) => [
      { label: L('Slots por tipo de treino', 'Slots per training type'), value: String(maxSlotsByTrainingCenter(lvl)) },
      {
        label: L('Coletivos simultâneos', 'Concurrent team sessions'),
        value: String(trainingCenterMaxConcurrentCollectivePlans(lvl)),
      },
      {
        label: L('Booster atributos', 'Attribute booster'),
        value: `${Math.round((trainingCenterAttributeGainMultiplier(lvl) - 1) * 100)}%`,
      },
      { label: L('Nível', 'Level'), value: `${lvl} / ${MAX_LEVEL}` },
    ],
  },
  {
    uiId: 'dm',
    structureId: 'medical_dept',
    name: L('Departamento Médico', 'Medical Department'),
    icon: Activity,
    desc: L('Menos fadiga e lesão', 'Less fatigue and injury'),
    statsForLevel: (lvl) => [
      { label: L('Slots de tratamento', 'Treatment slots'), value: String(medicalDeptTreatmentSlots(lvl)) },
      {
        label: L('Velocidade recuperação', 'Recovery speed'),
        value: `+${medicalDeptRecoverySpeedBonusPercent(lvl)}%`,
      },
      { label: L('Nível', 'Level'), value: `${lvl} / ${MAX_LEVEL}` },
    ],
  },
  {
    uiId: 'base',
    structureId: 'youth_academy',
    name: L('Categoria de Base', 'Youth Academy'),
    icon: GraduationCap,
    desc: L('Revela jovens promessas', 'Develops young prospects'),
    action: L('Buscar Promessas', 'Scout Prospects'),
    actionIcon: Users,
    statsForLevel: (lvl) => [
      {
        label: L('Booster treino (promessas)', 'Training booster (prospects)'),
        value: `${Math.round((youthAcademyProspectTrainingMultiplier(lvl) - 1) * 100)}%`,
      },
      { label: L('Nível', 'Level'), value: `${lvl} / ${MAX_LEVEL}` },
    ],
  },
  {
    uiId: 'store',
    structureId: 'megastore',
    name: L('Megaloja', 'Megastore'),
    icon: Store,
    desc: L('Torcida vira EXP nas vitórias', 'Fans turn into EXP on wins'),
    action: L('Campanha de Vendas', 'Sales Campaign'),
    actionIcon: Coins,
    statsForLevel: (lvl) => [
      { label: L('Campanha de vendas', 'Sales campaign'), value: L(`${CITY_QUICK_STORE_COST_EXP} EXP · reforça a torcida`, `${CITY_QUICK_STORE_COST_EXP} EXP · boosts fan support`) },
      {
        label: L('Apoio em casa', 'Home support'),
        value: `+${megastoreHomeConfidenceBonusPoints(lvl)} pts`,
      },
      {
        label: L('Apoio fora', 'Away support'),
        value: lvl >= 4 ? `+${megastoreAwayConfidenceBonusPoints(lvl)} pts` : '—',
      },
      { label: L('Nível', 'Level'), value: `${lvl} / ${MAX_LEVEL}` },
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
      title: L('Nível máximo', 'Max level'),
      subtitle: L('Estrutura no topo da árvore de evolução.', 'Structure at the top of the upgrade tree.'),
      canAfford: false,
      hasUpgrade: false,
    };
  }
  if (c.currency === 'exp') {
    return {
      title: `${formatExp(c.amount)} EXP`,
      subtitle: L('Upgrade com tesouraria EXP (ranking).', 'Upgrade with EXP treasury (ranking).'),
      canAfford: ole >= c.amount,
      hasUpgrade: true,
    };
  }
  return {
    title: formatBroFromCents(c.amount),
    subtitle: L('Upgrade com BRO na carteira.', 'Upgrade with BRO from your wallet.'),
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
  const [upgradeModalState, setUpgradeModalState] = useState<{
    structureId: ClubStructureId;
    phase: 'confirm' | 'success' | 'insufficient';
  } | null>(null);

  const stadiumLevel = levelOf(structuresState, 'stadium');
  const stadiumUpgrade = useMemo(
    () => upgradeLine('stadium', stadiumLevel, finance.ole, finance.broCents),
    [stadiumLevel, finance.ole, finance.broCents],
  );

  const canQuickStore = finance.ole >= CITY_QUICK_STORE_COST_EXP;

  const runQuickAction = (id: ClubStructureId) => {
    if (id === 'stadium') {
      const lvl = levelOf(structuresState, 'stadium');
      const up = upgradeLine('stadium', lvl, finance.ole, finance.broCents);
      if (!up.hasUpgrade || !up.canAfford) return;
      dispatch({ type: 'UPGRADE_STRUCTURE', structureId: 'stadium' });
      trackMissionEvent('structure_upgraded');
      return;
    }
    if (id === 'youth_academy') {
      navigate('/clube/academia');
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
    const title = def ? L(`Desejas fazer «${def.action}»?`, `Do you want to run «${def.action}»?`) : L('Desejas confirmar esta ação?', 'Confirm this action?');
    const lines: string[] = [];
    let costExpLine: string | null = null;
    let confirmBlocked = false;

    if (quickPendingId === 'stadium') {
      const up = stadiumUpgrade;
      if (!up.hasUpgrade) {
        lines.push(L('Não há próximo nível disponível para o estádio.', 'No next level available for the stadium.'));
        confirmBlocked = true;
      } else if (!up.canAfford) {
        lines.push(L('Saldo insuficiente para este upgrade.', 'Insufficient balance for this upgrade.'));
        confirmBlocked = true;
      } else {
        const c = getNextUpgradeCost('stadium', levelOf(structuresState, 'stadium'), DEFAULT_BRO_PRICES_CENTS);
        if (c?.currency === 'exp') {
          costExpLine = L(`Custo em EXP: ${formatExp(c.amount)}`, `EXP cost: ${formatExp(c.amount)}`);
          lines.push(L('O estádio sobe um nível. Reforço de ambiente e capacidade para a torcida.', 'The stadium goes up one level. Better atmosphere and capacity for the fans.'));
        } else if (c?.currency === 'bro') {
          costExpLine = L('Custo em EXP: nenhum neste nível.', 'EXP cost: none at this level.');
          lines.push(L(`Custo em BRO: ${formatBroFromCents(c.amount)} (debitado da carteira).`, `BRO cost: ${formatBroFromCents(c.amount)} (charged to your wallet).`));
          lines.push(L('O estádio sobe um nível.', 'The stadium goes up one level.'));
        }
      }
    } else if (quickPendingId === 'youth_academy') {
      costExpLine = L('Custo em EXP: nenhum.', 'EXP cost: none.');
      lines.push(L('Abre o olheiro da categoria de base para ver promessas.', 'Opens the youth academy scout to see prospects.'));
    } else if (quickPendingId === 'megastore') {
      costExpLine = L(`Custo em EXP: ${formatExp(CITY_QUICK_STORE_COST_EXP)}`, `EXP cost: ${formatExp(CITY_QUICK_STORE_COST_EXP)}`);
      lines.push(
        L(`Reforça o apoio da torcida (atual ${crowd.supportPercent.toFixed(1)}%).`, `Boosts fan support (currently ${crowd.supportPercent.toFixed(1)}%).`),
      );
      if (!canQuickStore) confirmBlocked = true;
    }

    return { title, lines, costExpLine, confirmBlocked };
  }, [
    quickPendingId,
    stadiumUpgrade,
    structuresState,
    canQuickStore,
    crowd.supportPercent,
  ]);

  const totalStructures = CITY_STRUCTURE_DEFS.length;
  const totalLevel = Object.values(structuresState).reduce((sum, lvl) => sum + (lvl || 1), 0);

  const stadiumCanUp = stadiumUpgrade.hasUpgrade && stadiumUpgrade.canAfford;

  return (
    <div className="w-full max-w-[100vw] min-w-0 mx-auto space-y-8 pb-8 overflow-x-hidden px-3 sm:px-4 lg:px-6">
      <div className="w-full max-w-6xl min-w-0 mx-auto">
        <BackButton to="/clube" label={L('Clube', 'Club')} />
      </div>

      <div className="w-full max-w-6xl min-w-0 mx-auto space-y-8">
        {/* Cabeçalho da tela */}
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="block min-w-0 truncate font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">
            — {clubName} · {L(`${totalStructures} estruturas · nível somado ${totalLevel}`, `${totalStructures} facilities · total level ${totalLevel}`)}
          </span>
          <h1 className="font-impact text-[clamp(48px,14vw,96px)] uppercase leading-[0.86] text-papel">{L('Estruturas', 'Facilities')}</h1>
        </div>

        {/* Hero — o Estádio atrás do alambrado (o momento "rua" da tela) */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          aria-label={L('Estádio', 'Stadium')}
          className="rua-grao relative isolate w-full min-w-0 max-w-full overflow-hidden bg-concreto"
        >
          <span aria-hidden className="rua-alambrado pointer-events-none absolute inset-x-0 top-0 h-40 [--alambrado:rgba(238,233,223,0.22)]" />
          <div className="relative z-10 flex flex-col gap-5 p-5 sm:p-8">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-mudo">
                  — {L('Estrutura principal', 'Main structure')}
                </span>
                <h2 className="font-impact text-[clamp(40px,11vw,72px)] uppercase leading-none text-papel">
                  {L('Estádio', 'Stadium')}
                </h2>
              </div>
              <span className="mt-1 inline-flex shrink-0 rotate-[3deg] flex-col items-center bg-cal px-3 py-2 text-asfalto-27 shadow-[4px_4px_0_rgba(0,0,0,0.55)]">
                <span className="font-prova text-[9px] font-bold uppercase tracking-[0.2em]">{L('Nível', 'Level')}</span>
                <span className="font-spray text-[32px] font-black leading-none">{stadiumLevel}/{MAX_LEVEL}</span>
              </span>
            </div>

            <div className="flex min-w-0 flex-col">
              <span className="font-spray text-[clamp(64px,19vw,120px)] font-black leading-[0.85] text-papel tabular-nums">
                {(stadiumCapacityByLevel(stadiumLevel) / 1000).toFixed(0)}K
              </span>
              <span className="font-impact text-[clamp(18px,5vw,24px)] uppercase leading-tight text-suave">
                {L('lugares pra torcida', 'seats for the fans')}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-px bg-linha">
              <div className="bg-asfalto-27 px-4 py-3">
                <dt className="font-prova text-[10px] font-bold uppercase tracking-[0.16em] text-mudo">{L('EXP/Torcedor', 'EXP/Fan')}</dt>
                <dd className="font-impact text-[28px] leading-none text-papel tabular-nums">{stadiumExpPerSpectatorByLevel(stadiumLevel)}</dd>
              </div>
              <div className="bg-asfalto-27 px-4 py-3">
                <dt className="font-prova text-[10px] font-bold uppercase tracking-[0.16em] text-mudo">{L('Nível', 'Level')}</dt>
                <dd className="pt-1"><BarraSegmentos valor={stadiumLevel} max={MAX_LEVEL} segmentos={MAX_LEVEL} className="h-3" /></dd>
              </div>
            </dl>

            <button
              type="button"
              disabled={!stadiumCanUp}
              onClick={() => setQuickPendingId('stadium')}
              className={cn(
                'mb-1 mr-1 inline-flex min-h-[56px] w-[calc(100%-0.25rem)] items-center justify-center gap-2 px-5 font-impact text-[clamp(17px,4.8vw,21px)] uppercase leading-none transition-[transform,box-shadow]',
                stadiumCanUp
                  ? 'bg-rua text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)]'
                  : stadiumUpgrade.hasUpgrade
                    ? 'cursor-not-allowed border-2 border-dashed border-fio text-mudo'
                    : 'cursor-not-allowed bg-ouro-27 text-asfalto-27',
              )}
            >
              <ArrowUpCircle className="h-5 w-5 shrink-0" />
              <span className="min-w-0 truncate">
                {stadiumUpgrade.hasUpgrade ? L(`Expandir · ${stadiumUpgrade.title}`, `Expand · ${stadiumUpgrade.title}`) : L('Nível Máximo', 'Max Level')}
              </span>
              {stadiumCanUp && <span aria-hidden>→</span>}
            </button>
          </div>
        </motion.section>

      {/* Grid de estruturas menores */}
      <section className="flex w-full min-w-0 max-w-full flex-col gap-3">
      <SecaoRua label={L('Outras estruturas', 'Other facilities')} aside={CITY_STRUCTURE_DEFS.length - 1} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-full min-w-0">
        {CITY_STRUCTURE_DEFS.slice(1).map((struct, idx) => {
          const level = levelOf(structuresState, struct.structureId);
          const upgrade = upgradeLine(struct.structureId, level, finance.ole, finance.broCents);
          const canQuick = struct.structureId === 'megastore' ? canQuickStore : true;

          return (
            <motion.div
              key={struct.uiId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + idx * 0.05 }}
              className="relative flex w-full min-w-0 max-w-full flex-col gap-4 bg-concreto p-5 sm:p-6"
            >
              {/* Header */}
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-rua">
                  <struct.icon className="h-6 w-6 text-rua" strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-impact text-[24px] uppercase leading-none text-papel">
                    {struct.name}
                  </h3>
                  <p className="mt-1 font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo">
                    {L('Nível', 'Level')} {level}/{MAX_LEVEL}
                  </p>
                </div>
              </div>
              <BarraSegmentos valor={level} max={MAX_LEVEL} segmentos={MAX_LEVEL} className="h-2.5" />

              {/* Descrição */}
              <p className="truncate text-[13px] leading-relaxed text-suave">
                {struct.desc}
              </p>

              {/* Stats principais — todos os benefícios do nível atual */}
              <dl className="flex flex-col border-t-2 border-dashed border-linha pt-2">
                {struct.statsForLevel(level).map((stat, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 border-b border-linha py-1.5 last:border-b-0">
                    <dt className="font-prova text-[10px] font-bold uppercase tracking-[0.1em] text-mudo">{stat.label}</dt>
                    <dd className="font-impact text-[16px] leading-none text-papel tabular-nums">{stat.value}</dd>
                  </div>
                ))}
              </dl>

              {/* Ações */}
              <div className="mt-auto flex gap-2 pb-1 pr-1">
                <button
                  type="button"
                  disabled={!upgrade.hasUpgrade}
                  onClick={() => {
                    if (!upgrade.hasUpgrade) return;
                    setUpgradeModalState({
                      structureId: struct.structureId,
                      phase: upgrade.canAfford ? 'confirm' : 'insufficient',
                    });
                  }}
                  className={cn(
                    'inline-flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-1.5 px-2 font-impact text-[15px] uppercase leading-none transition-colors disabled:cursor-not-allowed',
                    !upgrade.hasUpgrade
                      ? 'bg-ouro-27 text-asfalto-27'
                      : upgrade.canAfford
                        ? 'border-2 border-papel text-papel hover:bg-papel hover:text-asfalto-27'
                        : 'border-2 border-dashed border-fio text-mudo hover:border-papel',
                  )}
                >
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 truncate">{upgrade.hasUpgrade ? L(`Evoluir · ${upgrade.title}`, `Upgrade · ${upgrade.title}`) : L('Nível máximo', 'Max level')}</span>
                </button>
                {struct.action && struct.actionIcon && (
                  <button
                    type="button"
                    disabled={!canQuick}
                    onClick={() => setQuickPendingId(struct.structureId)}
                    className={cn(
                      'inline-flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-1.5 px-2 font-impact text-[15px] uppercase leading-none transition-[transform,box-shadow]',
                      canQuick
                        ? 'bg-rua text-asfalto-27 shadow-[3px_3px_0_var(--color-papel)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_var(--color-papel)]'
                        : 'cursor-not-allowed border-2 border-dashed border-fio text-mudo',
                    )}
                  >
                    <struct.actionIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 truncate">{struct.action.split(' ')[0]}</span>
                    {canQuick && <span aria-hidden>→</span>}
                  </button>
                )}
              </div>

              {/* Link para detalhes */}
              {struct.structureId === 'youth_academy' && (
                <button
                  type="button"
                  onClick={() => navigate('/clube/academia')}
                  className="inline-flex min-h-[40px] items-center gap-1 self-start font-impact text-[16px] uppercase text-rua transition-colors hover:text-papel"
                >
                  <span>{L('Ver promessas', 'View prospects')}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
      </section>
      </div>

      {/* Modal de Upgrade (Evoluir) com 3 fases */}
      <AnimatePresence>
        {upgradeModalState && (() => {
          const def = CITY_STRUCTURE_DEFS.find((d) => d.structureId === upgradeModalState.structureId);
          const level = levelOf(structuresState, upgradeModalState.structureId);
          const upgrade = upgradeLine(upgradeModalState.structureId, level, finance.ole, finance.broCents);
          const cost = getNextUpgradeCost(upgradeModalState.structureId, level, DEFAULT_BRO_PRICES_CENTS);

          const handleConfirm = () => {
            // Evolução é instantânea no reducer — sem spinner fake.
            dispatch({ type: 'UPGRADE_STRUCTURE', structureId: upgradeModalState.structureId });
            trackMissionEvent('structure_upgraded');
            setUpgradeModalState({ ...upgradeModalState, phase: 'success' });
          };

          const handleClose = () => {
            setUpgradeModalState(null);
          };

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
              onClick={upgradeModalState.phase === 'success' ? handleClose : undefined}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md overflow-hidden border-2 border-linha bg-asfalto-27"
              >
                {/* Fase 1: Confirmação */}
                {upgradeModalState.phase === 'confirm' && (
                  <>
                    <div className="border-b-2 border-linha p-5">
                      <span className="font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-mudo">— {L('Evoluir', 'Upgrade')}</span>
                      <div className="mt-1 flex items-center gap-3">
                        {def && <def.icon className="h-7 w-7 shrink-0 text-rua" strokeWidth={2} />}
                        <h3 className="font-impact text-[28px] uppercase leading-none text-papel">
                          {def?.name}
                        </h3>
                      </div>
                    </div>

                    <div className="space-y-5 p-5">
                      {/* Custo */}
                      <div className="border-2 border-linha p-4">
                        <p className="font-prova text-[10px] font-bold uppercase tracking-[0.2em] text-mudo">
                          {L('Custo da Evolução', 'Upgrade Cost')}
                        </p>
                        <p className="mt-1 font-spray text-[40px] font-black leading-none text-papel tabular-nums">
                          {cost?.currency === 'exp' ? formatExp(cost.amount) : formatBroFromCents(cost?.amount ?? 0)}
                        </p>
                      </div>

                      {/* Benefícios */}
                      <div className="space-y-2">
                        <p className="font-prova text-[11px] font-bold uppercase tracking-[0.14em] text-mudo">
                          — {L(`Benefícios do Nível ${level + 1}`, `Level ${level + 1} Benefits`)}
                        </p>
                        <ul className="flex flex-col">
                          {def?.statsForLevel(level + 1).slice(0, 3).map((stat, i) => (
                            <li key={i} className="flex items-center justify-between gap-2 border-b border-linha py-1.5 text-[13px] last:border-b-0">
                              <span className="text-suave">{stat.label}</span>
                              <span className="font-impact text-[16px] text-papel">{stat.value}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="flex gap-3 border-t-2 border-linha p-5">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="inline-flex min-h-[48px] flex-1 items-center justify-center border-2 border-linha px-4 font-impact text-[17px] uppercase leading-none text-mudo transition-colors hover:border-papel hover:text-papel"
                      >
                        {L('Cancelar', 'Cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!upgrade.canAfford}
                        className={cn(
                          'inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 px-4 font-impact text-[18px] uppercase leading-none transition-[transform,box-shadow]',
                          upgrade.canAfford
                            ? 'bg-rua text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--color-papel)]'
                            : 'cursor-not-allowed border-2 border-dashed border-fio text-mudo',
                        )}
                      >
                        {L('Confirmar', 'Confirm')} {upgrade.canAfford && <span aria-hidden>→</span>}
                      </button>
                    </div>
                  </>
                )}

                {/* Fase 2: Sucesso */}
                {upgradeModalState.phase === 'success' && (
                  <>
                    <div className="flex flex-col items-center gap-3 p-10 text-center">
                      <motion.span
                        initial={{ scale: 0, rotate: -8 }}
                        animate={{ scale: 1, rotate: -3 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        className="inline-flex flex-col items-center bg-rua px-5 py-3 text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)]"
                      >
                        <span className="font-prova text-[10px] font-bold uppercase tracking-[0.2em]">{L('Nível', 'Level')}</span>
                        <span className="font-spray text-[56px] font-black leading-none">{level + 1}</span>
                      </motion.span>

                      <motion.h3
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mt-3 font-voz text-[36px] leading-none text-papel"
                      >
                        {L('Subiu na moral.', 'Levelled up.')}
                      </motion.h3>

                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-[14px] text-suave"
                      >
                        {L(`${def?.name} agora está no nível ${level + 1}`, `${def?.name} is now level ${level + 1}`)}
                      </motion.p>
                    </div>

                    <div className="border-t-2 border-linha p-5">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 border-2 border-papel px-4 font-impact text-[18px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27"
                      >
                        {L('Continuar', 'Continue')} <span aria-hidden>→</span>
                      </button>
                    </div>
                  </>
                )}

                {/* Fase 4: Saldo Insuficiente */}
                {upgradeModalState.phase === 'insufficient' && (
                  <>
                    <div className="flex flex-col items-center gap-3 p-10 text-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-baixa"
                      >
                        <X className="h-8 w-8 text-baixa" strokeWidth={3} />
                      </motion.div>

                      <motion.h3
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="font-impact text-[28px] uppercase leading-none text-papel"
                      >
                        {L('Saldo Insuficiente', 'Insufficient Balance')}
                      </motion.h3>

                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-[14px] text-suave"
                      >
                        {cost?.currency === 'exp'
                          ? L(`Precisa de ${formatExp(cost.amount)} EXP para evoluir ${def?.name}`, `You need ${formatExp(cost.amount)} EXP to upgrade ${def?.name}`)
                          : L(`Precisa de ${formatBroFromCents(cost?.amount ?? 0)} para evoluir ${def?.name}`, `You need ${formatBroFromCents(cost?.amount ?? 0)} to upgrade ${def?.name}`)
                        }
                      </motion.p>
                    </div>

                    <div className="border-t-2 border-linha p-5">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="inline-flex min-h-[48px] w-full items-center justify-center border-2 border-linha px-4 font-impact text-[18px] uppercase leading-none text-papel transition-colors hover:border-papel"
                      >
                        {L('Fechar', 'Close')}
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Modal de confirmação (ações rápidas) */}
      <AnimatePresence>
        {quickPendingId && quickConfirmCopy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-y-contain bg-black/85 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:items-center sm:p-4"
            onClick={() => setQuickPendingId(null)}
            role="presentation"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="my-auto flex w-full max-w-md shrink-0 flex-col overflow-hidden border-2 border-linha bg-asfalto-27 max-h-[min(88dvh,calc(100dvh-5rem))] sm:max-h-[min(92dvh,720px)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="city-quick-confirm-title"
            >
              <div className="flex shrink-0 items-center justify-between border-b-2 border-linha p-4">
                <h3
                  id="city-quick-confirm-title"
                  className="pr-2 font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo"
                >
                  — {L('Confirmar ação', 'Confirm action')}
                </h3>
                <button
                  type="button"
                  onClick={() => setQuickPendingId(null)}
                  className="shrink-0 p-1 text-mudo transition-colors hover:text-papel"
                  aria-label={L('Fechar', 'Close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain p-5">
                <p className="font-voz text-[26px] leading-tight text-papel">{quickConfirmCopy.title}</p>
                {quickConfirmCopy.costExpLine && (
                  <p className="font-impact text-[22px] uppercase leading-tight text-papel">
                    {quickConfirmCopy.costExpLine}
                  </p>
                )}
                <ul className="space-y-2 border-l-[3px] border-fio pl-3 text-[14px] leading-relaxed text-suave">
                  {quickConfirmCopy.lines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
              <div className="flex shrink-0 flex-col-reverse gap-3 border-t-2 border-linha p-4 pr-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setQuickPendingId(null)}
                  className="inline-flex min-h-[48px] w-full items-center justify-center border-2 border-linha px-5 font-impact text-[17px] uppercase leading-none text-mudo transition-colors hover:border-papel hover:text-papel sm:w-auto"
                >
                  {L('Cancelar', 'Cancel')}
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
                    'inline-flex min-h-[48px] w-full items-center justify-center gap-2 px-5 font-impact text-[18px] uppercase leading-none transition-[transform,box-shadow] sm:w-auto',
                    quickConfirmCopy.confirmBlocked
                      ? 'cursor-not-allowed border-2 border-dashed border-fio text-mudo'
                      : 'bg-rua text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--color-papel)]',
                  )}
                >
                  {L('Confirmar', 'Confirm')} {!quickConfirmCopy.confirmBlocked && <span aria-hidden>→</span>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

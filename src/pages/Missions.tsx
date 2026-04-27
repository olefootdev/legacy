import { motion, AnimatePresence } from 'motion/react';
import {
  Target,
  CheckCircle2,
  Clock,
  Trophy,
  Copy,
  CheckCircle,
  Link2,
  ChevronRight,
  Lock,
  ChevronDown,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { formatExp } from '@/systems/economy';
import { useEffect, useMemo, useState } from 'react';
import { MISSION_CATALOG } from '@/progression/missions/catalog';
import { useProgressionStore } from '@/progression/progressionStore';
import { BackButton } from '@/components/BackButton';
import type { MissionDef, MissionEvent, MissionKind } from '@/progression/types';
import { normalizeWalletState } from '@/wallet/initial';
import { inviteLinkForCode } from '@/wallet/referralCode';
import { computeCareerTier } from '@/systems/careerTiers';
import { DashboardGrid, DashboardSection } from '@/components/dashboard';

interface MissionStub {
  id: string;
  title: string;
  desc: string;
  reward: number;
  status: 'available' | 'in_progress' | 'completed' | 'locked';
  target: number;
  distinctDone?: string[];
  trackEvents: readonly MissionEvent[];
  progress?: { current: number; total: number };
  kind: MissionKind;
  minTier?: number;
}

const EVENT_LABELS: Record<MissionEvent, string> = {
  session_login: 'fazer login',
  screen_home: 'abrir Home',
  screen_team: 'abrir Meu Time',
  screen_wallet: 'abrir Wallet',
  screen_city: 'abrir Cidade',
  screen_transfer: 'abrir Transfer',
  screen_store: 'abrir Loja',
  screen_club_hub: 'abrir Clube',
  screen_competition_hub: 'abrir Competição',
  screen_market_hub: 'abrir Mercado',
  screen_help_hub: 'abrir Ajuda',
  match_started: 'iniciar partida',
  match_completed: 'completar partida',
  match_won: 'vencer partida',
  goal_scored: 'marcar gol',
  lineup_saved: 'salvar escalação',
  structure_upgraded: 'evoluir estrutura',
  store_purchase: 'comprar na loja',
  transfer_listed: 'listar no transfer',
  training_session: 'fazer sessão de treino',
  fast_match_completed: 'completar partida rápida',
  mission_claimed: 'resgatar missão',
};

const KIND_LABELS: Record<MissionKind, string> = {
  onboarding: 'Iniciante',
  daily: 'Diária',
  weekly: 'Semanal',
  achievement: 'Conquista',
  special: 'Especial',
};

function statusColor(s: MissionStub['status']) {
  if (s === 'completed') return 'text-neon-green';
  if (s === 'in_progress') return 'text-neon-yellow';
  if (s === 'locked') return 'text-gray-600';
  return 'text-gray-500';
}

function statusIcon(s: MissionStub['status']) {
  if (s === 'completed') return CheckCircle2;
  if (s === 'in_progress') return Clock;
  if (s === 'locked') return Lock;
  return Target;
}

export function Missions() {
  const dispatch = useGameDispatch();
  const finance = useGameStore((s) => s.finance);
  const ensureResets = useProgressionStore((s) => s.ensureResets);
  const claimMission = useProgressionStore((s) => s.claimMission);
  const runtime = useProgressionStore((s) => s.missions);
  const expLifetimeEarned = useProgressionStore((s) => s.expLifetimeEarned);
  const currentTier = useMemo(() => computeCareerTier(expLifetimeEarned), [expLifetimeEarned]);
  const [filterKind, setFilterKind] = useState<MissionKind | 'all'>('all');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const wallet = useMemo(() => normalizeWalletState(finance.wallet ?? undefined), [finance.wallet]);
  const myReferralCode = wallet.myReferralCode ?? '';
  const inviteUrl = myReferralCode ? inviteLinkForCode(myReferralCode) : '';

  useEffect(() => {
    ensureResets();
  }, [ensureResets]);

  const missions = useMemo<MissionStub[]>(() => {
    return MISSION_CATALOG.map((def: MissionDef) => {
      const isLocked = (def.minTier ?? 1) > currentTier.id;
      const st = runtime[def.id] ?? { progress: 0, claimed: false, distinctDone: [] };
      const status: MissionStub['status'] = isLocked
        ? 'locked'
        : st.claimed
        ? 'completed'
        : st.progress > 0
        ? 'in_progress'
        : 'available';
      return {
        id: def.id,
        title: def.title,
        desc: def.description,
        reward: def.rewardExp,
        status,
        target: def.targetCount,
        distinctDone: st.distinctDone ?? [],
        trackEvents: def.trackEvents,
        progress: { current: st.progress, total: def.targetCount },
        kind: def.kind,
        minTier: def.minTier,
      };
    });
  }, [runtime, currentTier.id]);

  const visibleMissions = useMemo(() => {
    if (filterKind === 'all') return missions;
    return missions.filter((m) => m.kind === filterKind);
  }, [missions, filterKind]);

  const stats = useMemo(() => {
    const completed = missions.filter((m) => m.status === 'completed').length;
    const inProgress = missions.filter((m) => m.status === 'in_progress').length;
    const locked = missions.filter((m) => m.status === 'locked').length;
    const totalExp = missions
      .filter((m) => m.status === 'completed')
      .reduce((sum, m) => sum + m.reward, 0);
    const readyToClaim = missions.filter(
      (m) => m.status !== 'completed' && m.status !== 'locked' && (m.progress?.current ?? 0) >= m.target
    ).length;
    return { completed, inProgress, locked, totalExp, readyToClaim, total: missions.length };
  }, [missions]);

  const completeMission = (m: MissionStub) => {
    if ((m.progress?.current ?? 0) >= m.target) {
      const ok = claimMission(m.id);
      if (ok) {
        dispatch({
          type: 'GRANT_EARNED_EXP',
          amount: m.reward,
          historySource: `Missão: ${m.title}`,
        });
        setFeedback(`✓ Missão concluída: +${formatExp(m.reward)} EXP`);
        setTimeout(() => setFeedback(null), 4000);
      }
      return;
    }
    const missingCount = m.target - (m.progress?.current ?? 0);
    const missingDistinct = m.trackEvents
      .filter((evt) => !new Set(m.distinctDone ?? []).has(evt))
      .map((evt) => EVENT_LABELS[evt])
      .slice(0, 3);
    const missingText =
      missingDistinct.length > 0
        ? `Falta: ${missingDistinct.join(', ')}.`
        : `Faltam ${missingCount} progresso(s) para concluir.`;
    setFeedback(`Você está chegando lá. ${missingText}`);
    setTimeout(() => setFeedback(null), 5000);
  };

  function copyCode() {
    if (!myReferralCode) return;
    void navigator.clipboard.writeText(myReferralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function copyInviteLink() {
    if (!inviteUrl) return;
    void navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  const kinds: Array<{ id: MissionKind | 'all'; label: string }> = [
    { id: 'all', label: 'Todas' },
    { id: 'daily', label: 'Diárias' },
    { id: 'weekly', label: 'Semanais' },
    { id: 'achievement', label: 'Conquistas' },
    { id: 'special', label: 'Especiais' },
    { id: 'onboarding', label: 'Iniciante' },
  ];

  return (
    <div className="min-h-screen bg-deep-black w-full max-w-[100vw] min-w-0 overflow-x-hidden">
      <div className="mx-auto max-w-6xl px-3 sm:px-4 lg:px-8 pt-6">
        <BackButton to="/manager" label="Manager" />
      </div>
      {/* ── HERO CINEMATOGRÁFICO ──────────────────────────────────── */}
      <section className="relative w-full max-w-full min-w-0 overflow-hidden bg-neon-yellow min-h-[78vh] sm:min-h-[88vh]">
        {/* Camada amarela sólida (sem faixa preta) */}
        <div
          className="absolute inset-0 bg-neon-yellow"
          aria-hidden
        />
        {/* Linhas verticais sutis (textura de campo) */}
        <svg
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ clipPath: 'polygon(0 0, 62% 0, 38% 100%, 0% 100%)' }}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <g stroke="#000" strokeOpacity="0.06" strokeWidth="0.15">
            <line x1="20" y1="0" x2="20" y2="100" />
            <line x1="40" y1="0" x2="40" y2="100" />
            <line x1="60" y1="0" x2="60" y2="100" />
            <line x1="80" y1="0" x2="80" y2="100" />
          </g>
        </svg>

        {/* Conteúdo */}
        <div className="relative z-10 mx-auto max-w-6xl min-w-0 w-full px-3 sm:px-4 lg:px-8 py-5 sm:py-7">

          {/* Grid: esquerda (amarelo) + direita (preto) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center min-h-[50vh]">
            {/* ── ESQUERDA: Título + Stats ────────────────────────── */}
            <div className="space-y-6 sm:space-y-8">
              {/* Eyebrow */}
              <div className="flex items-center justify-center gap-3 lg:justify-start">
                <span className="h-px w-8 bg-black/40" aria-hidden />
                <span className="font-display text-[10px] font-bold uppercase tracking-[0.35em] text-black/70">
                  Centro de Missões
                </span>
                <span className="h-px w-8 bg-black/40" aria-hidden />
              </div>

              {/* Título Moret italic */}
              <h1
                className="ole-headline-italic text-black text-center lg:text-left leading-[0.9]"
                style={{ fontSize: 'clamp(64px, 14vw, 120px)' }}
              >
                Missões
              </h1>

              {/* Stats grid — 3 cards apenas */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-black px-4 py-4 text-center">
                  <p className="font-display text-[9px] font-bold uppercase tracking-[0.22em] text-white/50">
                    Concluídas
                  </p>
                  <p
                    className="ole-headline-italic text-neon-yellow mt-2 tabular-nums"
                    style={{ fontSize: 'clamp(32px, 5vw, 48px)' }}
                  >
                    {stats.completed}
                  </p>
                </div>
                <div className="bg-black px-4 py-4 text-center">
                  <p className="font-display text-[9px] font-bold uppercase tracking-[0.22em] text-white/50">
                    Em Progresso
                  </p>
                  <p
                    className="ole-headline-italic text-neon-yellow mt-2 tabular-nums"
                    style={{ fontSize: 'clamp(32px, 5vw, 48px)' }}
                  >
                    {stats.inProgress}
                  </p>
                </div>
                <div className="col-span-2 bg-deep-black border border-white/8 px-4 py-4 text-center">
                  <p className="font-display text-[9px] font-bold uppercase tracking-[0.22em] text-white/50">
                    EXP Total Ganho
                  </p>
                  <p className="font-mono text-lg font-bold text-white mt-2 tabular-nums">
                    {formatExp(stats.totalExp)}
                  </p>
                </div>
              </div>

              {/* CTA Ver Missões */}
              <div className="flex justify-center lg:justify-start pt-2">
                <a
                  href="#missoes-content"
                  className="inline-flex items-center gap-2 bg-black text-neon-yellow px-6 py-3 hover:bg-deep-black transition-colors"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  Ver Missões
                  <ChevronDown className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* ── DIREITA: Badge com número total de missões ──────────────── */}
            <div className="relative flex items-center justify-center lg:justify-end">
              <div className="relative">
                <p
                  className="ole-headline-italic text-white/[0.08] tabular-nums leading-none select-none"
                  style={{ fontSize: 'clamp(180px, 28vw, 320px)' }}
                  aria-hidden
                >
                  {stats.total}
                </p>
                {/* Badge sobreposto */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-neon-yellow px-6 py-3 sm:px-8 sm:py-4">
                    <p className="font-display text-xs sm:text-sm font-bold uppercase tracking-[0.22em] text-black/70">
                      Missões
                    </p>
                    <p className="font-display text-2xl sm:text-3xl font-black uppercase text-black mt-1 tabular-nums">
                      {stats.total}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTEÚDO PRINCIPAL ────────────────────────────────────── */}
      <div id="missoes-content" className="w-full max-w-[100vw] min-w-0 mx-auto overflow-x-hidden">
        <div className="w-full max-w-6xl min-w-0 mx-auto px-3 sm:px-4 lg:px-8 py-8 sm:py-12 space-y-6 sm:space-y-8">
        {/* Feedback */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="border border-neon-yellow/40 bg-neon-yellow/10 px-4 py-3 text-sm text-neon-yellow font-semibold"
            >
              {feedback}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Link de indicação — padrão BVB */}
        <section className="ole-card-accent w-full max-w-full min-w-0 overflow-hidden">
          <div className="p-5 sm:p-6 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-neon-yellow/15 border-2 border-neon-yellow/40">
                  <Link2 className="h-5 w-5 text-neon-yellow" strokeWidth={2.5} aria-hidden />
                </div>
                <div className="min-w-0">
                  <h3
                    className="text-neon-yellow uppercase leading-tight"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '13px',
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                    }}
                  >
                    Link de Indicação
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                    Compartilhe e ganhe recompensas quando seus amigos entrarem
                  </p>
                </div>
              </div>
              <Link
                to="/wallet/referrals"
                className="shrink-0 inline-flex items-center gap-1.5 bg-neon-yellow/10 border border-neon-yellow/40 px-3 py-2 hover:bg-neon-yellow/20 transition-colors"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--color-neon-yellow)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                Ver Indicações
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* URL display + botões */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div
                className="flex-1 min-w-0 bg-deep-black border border-white/10 px-3 py-2.5 font-mono text-xs text-white/90 break-all"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                {inviteUrl || '—'}
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={copyInviteLink}
                  disabled={!inviteUrl}
                  className="flex items-center justify-center gap-2 bg-neon-yellow text-black px-4 py-2.5 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {copiedLink ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span className="hidden xs:inline">Copiar link</span>
                  <span className="xs:hidden">Link</span>
                </button>
                <button
                  type="button"
                  onClick={copyCode}
                  disabled={!myReferralCode}
                  className="flex items-center justify-center gap-2 bg-deep-black border border-white/20 text-white px-4 py-2.5 hover:border-neon-yellow/60 hover:text-neon-yellow disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {copiedCode ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span className="hidden xs:inline">Só código</span>
                  <span className="xs:hidden">Código</span>
                </button>
              </div>
            </div>

            {/* Código exibido */}
            {myReferralCode && (
              <p
                className="text-gray-600 font-mono"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.05em',
                }}
              >
                Código: <span className="text-gray-400">{myReferralCode}</span>
              </p>
            )}
          </div>
        </section>

        {/* Filtros de categoria */}
        <div className="w-full max-w-full min-w-0 flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
          {kinds.map((k) => (
            <button
              key={k.id}
              onClick={() => setFilterKind(k.id)}
              className={cn(
                'shrink-0 border px-4 py-2 font-display text-xs font-bold uppercase tracking-[0.18em] transition',
                filterKind === k.id
                  ? 'border-neon-yellow bg-neon-yellow text-black'
                  : 'border-white/10 bg-black/40 text-gray-400 hover:border-white/20 hover:bg-white/5 hover:text-white'
              )}
            >
              {k.label}
            </button>
          ))}
        </div>

        {/* Lista de missões */}
        <DashboardGrid>
          {visibleMissions.map((m, i) => {
            const Icon = statusIcon(m.status);
            const isReady =
              m.status !== 'completed' && m.status !== 'locked' && (m.progress?.current ?? 0) >= m.target;

            return (
              <DashboardSection size="md" className="w-full max-w-full min-w-0">
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={cn(
                    'w-full max-w-full min-w-0 border bg-black/40 p-4 sm:p-5 transition-all h-full flex flex-col',
                    m.status === 'completed' && 'border-neon-green/50 bg-gradient-to-br from-neon-green/10 to-black/40',
                    m.status === 'in_progress' && 'border-neon-yellow/30 hover:border-neon-yellow/50',
                    m.status === 'locked' && 'border-white/10 opacity-60',
                    m.status === 'available' && 'border-white/10 hover:border-white/20',
                    isReady && 'border-neon-yellow/60 bg-gradient-to-br from-neon-yellow/15 to-black/40'
                  )}
                >
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center border-2',
                        m.status === 'completed' && 'border-neon-green bg-neon-green/20',
                        m.status === 'in_progress' && 'border-neon-yellow bg-neon-yellow/20',
                        m.status === 'locked' && 'border-white/10 bg-white/5',
                        m.status === 'available' && 'border-white/15 bg-white/5'
                      )}
                    >
                      <Icon className={cn('h-5 w-5', statusColor(m.status))} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-500">
                          {KIND_LABELS[m.kind]}
                        </span>
                        {m.status === 'completed' && (
                          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-neon-green">
                            Concluída
                          </span>
                        )}
                        {m.status === 'locked' && m.minTier && (
                          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-600">
                            Tier {m.minTier}+
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-sm font-bold uppercase tracking-wide text-white">
                        {m.title}
                      </h3>
                    </div>
                  </div>

                  {/* Descrição */}
                  <p className="text-xs text-gray-400 mb-4">{m.desc}</p>

                  {/* Progress bar */}
                  {m.progress && m.status !== 'completed' && m.status !== 'locked' && (
                    <div className="mb-4 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden border border-white/10 bg-black/60">
                        <div
                          className={cn(
                            'h-full transition-all duration-500',
                            isReady ? 'bg-neon-yellow' : 'bg-neon-yellow/60'
                          )}
                          style={{ width: `${Math.min(100, (m.progress.current / m.progress.total) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-500 tabular-nums">
                        {m.progress.current}/{m.progress.total}
                      </span>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                      <Trophy className="h-4 w-4 text-neon-yellow" strokeWidth={2.5} />
                      <span className="font-display text-sm font-bold text-neon-yellow">
                        {formatExp(m.reward)}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">EXP</span>
                    </div>

                    {m.status !== 'completed' && m.status !== 'locked' && (
                      <button
                        onClick={() => completeMission(m)}
                        disabled={!isReady}
                        className={cn(
                          'px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.18em] transition',
                          isReady
                            ? 'bg-neon-yellow text-black hover:bg-white'
                            : 'bg-white/5 text-gray-600 cursor-not-allowed'
                        )}
                      >
                        {isReady ? 'Resgatar' : 'Em progresso'}
                      </button>
                    )}
                  </div>
                </motion.div>
              </DashboardSection>
            );
          })}
        </DashboardGrid>

        {visibleMissions.length === 0 && (
          <div className="border border-white/10 bg-black/30 p-8 text-center">
            <Trophy className="mx-auto h-12 w-12 text-gray-600 mb-3" strokeWidth={2} />
            <p className="text-sm text-gray-500">Nenhuma missão nesta categoria</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

import { motion, AnimatePresence } from 'motion/react';
import {
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
import { SecaoRua } from '@/components/ui';
import { L } from '@/i18n/L';

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
  session_login: L('fazer login', 'log in'),
  screen_home: L('abrir Home', 'open Home'),
  screen_team: L('abrir Meu Time', 'open My Team'),
  screen_team_valores: L('abrir Valores do elenco', 'open Squad Values'),
  screen_mercado_vivo: L('abrir o Mercado ao Vivo', 'open the Live Market'),
  screen_wallet: L('abrir Wallet', 'open Wallet'),
  screen_city: L('abrir Cidade', 'open City'),
  screen_transfer: L('abrir Transfer', 'open Transfer'),
  screen_store: L('abrir Loja', 'open Store'),
  screen_club_hub: L('abrir Clube', 'open Club'),
  screen_competition_hub: L('abrir Competição', 'open Competition'),
  screen_market_hub: L('abrir Mercado', 'open Market'),
  screen_help_hub: L('abrir Ajuda', 'open Help'),
  match_started: L('iniciar partida', 'start a match'),
  match_completed: L('completar partida', 'complete a match'),
  match_won: L('vencer partida', 'win a match'),
  goal_scored: L('marcar gol', 'score a goal'),
  lineup_saved: L('salvar escalação', 'save lineup'),
  structure_upgraded: L('evoluir estrutura', 'upgrade a structure'),
  store_purchase: L('comprar na loja', 'buy in the store'),
  transfer_listed: L('listar no transfer', 'list on transfer'),
  training_session: L('fazer sessão de treino', 'do a training session'),
  fast_match_completed: L('completar partida rápida', 'complete a quick match'),
  mission_claimed: L('resgatar missão', 'claim a mission'),
};

const KIND_LABELS: Record<MissionKind, string> = {
  onboarding: L('Iniciante', 'Beginner'),
  daily: L('Diária', 'Daily'),
  weekly: L('Semanal', 'Weekly'),
  achievement: L('Conquista', 'Achievement'),
  special: L('Especial', 'Special'),
};

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
          historySource: L(`Missão: ${m.title}`, `Mission: ${m.title}`),
        });
        setFeedback(L(`Missão concluída: +${formatExp(m.reward)} EXP`, `Mission complete: +${formatExp(m.reward)} EXP`));
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
        ? L(`Falta: ${missingDistinct.join(', ')}.`, `Missing: ${missingDistinct.join(', ')}.`)
        : L(`Faltam ${missingCount} progresso(s) para concluir.`, `${missingCount} more step(s) to complete.`);
    setFeedback(L(`Você está chegando lá. ${missingText}`, `You're getting there. ${missingText}`));
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
    { id: 'all', label: L('Todas', 'All') },
    { id: 'daily', label: L('Diárias', 'Daily') },
    { id: 'weekly', label: L('Semanais', 'Weekly') },
    { id: 'achievement', label: L('Conquistas', 'Achievements') },
    { id: 'special', label: L('Especiais', 'Special') },
    { id: 'onboarding', label: L('Iniciante', 'Beginner') },
  ];

  const pct = (m: MissionStub) =>
    m.progress && m.progress.total > 0 ? Math.min(1, m.progress.current / m.progress.total) : 0;

  return (
    <div className="w-full max-w-[100vw] min-w-0 overflow-x-hidden">
      <div className="mx-auto w-full max-w-3xl px-3 pt-4 sm:px-4">
        <BackButton to="/manager" label="Manager" />
      </div>

      {/* ── HERO — missão é ação: peça amarela com alambrado (DS 2027) ── */}
      <section className="rua-alambrado relative mt-2 w-full max-w-full min-w-0 overflow-hidden bg-rua text-asfalto-27 [--alambrado:rgba(13,13,12,.24)]">
        <div className="relative z-10 mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-5 px-3 py-6 sm:px-4 sm:py-8">
          <span className="ole-eyebrow-poster" data-on="yellow">
            {L('Centro de missões', 'Mission center')}
          </span>
          <div className="flex min-w-0 items-end justify-between gap-3">
            <h1
              className="min-w-0 font-impact uppercase leading-[0.84]"
              style={{ fontSize: 'clamp(60px, 18vw, 112px)' }}
            >
              {L('Missões', 'Missions')}
            </h1>
            <span className="shrink-0 pb-1 font-spray font-black leading-none" style={{ fontSize: 'clamp(30px, 9vw, 52px)' }}>
              {stats.completed}
              <span className="opacity-50">/{stats.total}</span>
            </span>
          </div>

          <div className="grid grid-cols-3 border-t-2 border-asfalto-27">
            {[
              { k: 'done', label: L('Concluídas', 'Completed'), v: String(stats.completed) },
              { k: 'prog', label: L('Andando', 'Moving'), v: String(stats.inProgress) },
              { k: 'exp', label: L('EXP ganho', 'EXP earned'), v: formatExp(stats.totalExp) },
            ].map((x, i) => (
              <div key={x.k} className={cn('flex min-w-0 flex-col gap-1 pt-3', i > 0 && 'border-l-2 border-asfalto-27 pl-3')}>
                <span className="block min-w-0 truncate font-spray text-[clamp(24px,7vw,36px)] font-black leading-none">{x.v}</span>
                <span className="block min-w-0 truncate font-prova text-[10.5px] font-bold uppercase tracking-[0.16em]">{x.label}</span>
              </div>
            ))}
          </div>

          {stats.readyToClaim > 0 && (
            <a
              href="#missoes-content"
              className="inline-flex min-h-[50px] items-center gap-2 self-start bg-asfalto-27 px-5 font-impact text-[19px] uppercase leading-none text-rua transition-colors hover:bg-concreto"
            >
              {L(`${stats.readyToClaim} pra resgatar`, `${stats.readyToClaim} to claim`)}
              <ChevronDown aria-hidden className="h-5 w-5" />
            </a>
          )}
        </div>
      </section>

      {/* ── CONTEÚDO PRINCIPAL ────────────────────────────────────── */}
      <div id="missoes-content" className="mx-auto w-full min-w-0 max-w-3xl space-y-7 overflow-x-hidden px-3 py-7 sm:px-4">
        {/* Feedback — lambe colado */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              role="status"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="-rotate-1 bg-cal px-4 py-3 font-voz text-[22px] leading-[1.1] text-asfalto-27"
            >
              {feedback}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filtros de categoria */}
        <div className="flex w-full max-w-full min-w-0 items-center gap-2 overflow-x-auto pb-1 hide-scrollbar" role="tablist">
          {kinds.map((k) => (
            <button
              key={k.id}
              type="button"
              role="tab"
              aria-selected={filterKind === k.id}
              onClick={() => setFilterKind(k.id)}
              className={cn(
                'min-h-[40px] shrink-0 border-2 px-3.5 font-prova text-[12px] font-bold uppercase tracking-[0.12em] transition-colors',
                filterKind === k.id
                  ? 'border-rua bg-rua text-asfalto-27'
                  : 'border-linha text-mudo hover:border-fio hover:text-papel',
              )}
            >
              {k.label}
            </button>
          ))}
        </div>

        {/* Lista de missões — checkbox do DS: feita = cheio + risco; pronta = rua
            com botão; andando = contorno; parada = tracejado; trancada = cadeado. */}
        <section className="flex flex-col gap-2" aria-label={L('Lista de missões', 'Mission list')}>
          <SecaoRua
            label={filterKind === 'all' ? L('Todas as missões', 'All missions') : kinds.find((k) => k.id === filterKind)?.label ?? ''}
            aside={`${visibleMissions.filter((m) => m.status === 'completed').length}/${visibleMissions.length}`}
          />
          <ul className="flex flex-col">
            {visibleMissions.map((m) => {
              const isReady =
                m.status !== 'completed' && m.status !== 'locked' && (m.progress?.current ?? 0) >= m.target;
              const done = m.status === 'completed';
              const locked = m.status === 'locked';
              const moving = m.status === 'in_progress' && !isReady;
              return (
                <li key={m.id} className={cn('flex min-w-0 items-center gap-3.5 border-b border-linha py-3.5 last:border-b-0', locked && 'opacity-60')}>
                  <span
                    aria-hidden
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center font-impact text-[17px] leading-none',
                      done && 'bg-rua text-asfalto-27',
                      isReady && 'bg-rua',
                      moving && 'border-2 border-rua',
                      m.status === 'available' && !isReady && 'border-2 border-dashed border-fio',
                      locked && 'text-fio',
                    )}
                  >
                    {done ? '✓' : locked ? <Lock className="h-4 w-4" /> : ''}
                  </span>
                  <div className="flex min-w-0 grow flex-col gap-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 font-prova text-[10.5px] font-bold uppercase tracking-[0.16em] text-mudo">
                        {KIND_LABELS[m.kind]}
                        {locked && m.minTier ? ` · Tier ${m.minTier}+` : ''}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'block min-w-0 truncate font-voz text-[23px] leading-none',
                        done ? 'text-mudo line-through decoration-2' : 'text-papel',
                      )}
                    >
                      {m.title}
                    </span>
                    <span className="block min-w-0 truncate font-prova text-[12px] text-mudo">
                      {m.desc}
                      {!done && !locked && m.progress ? ` · ${Math.min(m.progress.current, m.progress.total)}/${m.progress.total}` : ''}
                      {done ? ` · ${L('resgatada', 'claimed')}` : ''}
                    </span>
                    {moving && (
                      <span aria-hidden className="mt-1 block h-1.5 w-full max-w-[220px] bg-linha">
                        <span className="block h-full bg-rua" style={{ width: `${Math.max(4, pct(m) * 100)}%` }} />
                      </span>
                    )}
                  </div>
                  {isReady ? (
                    <button
                      type="button"
                      onClick={() => completeMission(m)}
                      className="inline-flex min-h-[44px] shrink-0 items-center bg-rua px-3.5 font-impact text-[17px] uppercase leading-none text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--color-papel)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rua"
                    >
                      {L('Pegar', 'Claim')} +{formatExp(m.reward)}
                    </button>
                  ) : (
                    <span
                      className={cn(
                        'shrink-0 text-right font-impact text-[22px] leading-none',
                        done || locked ? 'text-mudo' : 'text-rua',
                      )}
                    >
                      +{formatExp(m.reward)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <span className="font-prova text-[11px] uppercase tracking-[0.18em] text-mudo">{L('Recompensa em EXP', 'Rewards in EXP')}</span>

          {visibleMissions.length === 0 && (
            <div className="flex flex-col items-start gap-3 border-2 border-dashed border-fio px-4 py-5">
              <Trophy aria-hidden className="h-6 w-6 text-fio" strokeWidth={2} />
              <p className="font-voz text-[22px] leading-[1.05] text-papel">{L('Nenhuma missão nesta categoria.', 'No missions in this category.')}</p>
              <button
                type="button"
                onClick={() => setFilterKind('all')}
                className="inline-flex min-h-[44px] items-center gap-2 border-2 border-papel px-4 font-impact text-[17px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27"
              >
                {L('Ver todas', 'See all')} <span aria-hidden>→</span>
              </button>
            </div>
          )}
        </section>

        {/* Link de indicação — convite também é missão */}
        <section className="flex w-full min-w-0 flex-col gap-3.5 border-l-[5px] border-rua bg-concreto px-[18px] py-4">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 font-prova text-[12px] font-bold uppercase tracking-[0.2em] text-papel">
              <Link2 aria-hidden className="h-4 w-4 shrink-0 text-rua" strokeWidth={2.5} />
              <span className="truncate">{L('Link de Indicação', 'Referral Link')}</span>
            </span>
            <Link
              to="/wallet/network"
              className="inline-flex min-h-[40px] shrink-0 items-center gap-1 font-impact text-[15px] uppercase text-rua hover:text-papel"
            >
              {L('Ver Indicações', 'View Referrals')}
              <ChevronRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>

          <div className="min-w-0 break-all border-2 border-dashed border-linha px-3 py-2.5 font-prova text-[12px] text-papel">
            {inviteUrl || '—'}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={copyInviteLink}
              disabled={!inviteUrl}
              className="inline-flex min-h-[46px] items-center justify-center gap-2 bg-rua px-4 font-impact text-[17px] uppercase leading-none text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {copiedLink ? <CheckCircle className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copiedLink ? L('Copiado', 'Copied') : L('Copiar link', 'Copy link')}
            </button>
            <button
              type="button"
              onClick={copyCode}
              disabled={!myReferralCode}
              className="inline-flex min-h-[46px] items-center justify-center gap-2 border-2 border-papel px-4 font-impact text-[17px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {copiedCode ? <CheckCircle className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {L('Só código', 'Code only')}
            </button>
          </div>
          {myReferralCode && (
            <p className="font-prova text-[11px] uppercase tracking-[0.12em] text-mudo">
              {L('Código', 'Code')}: <span className="text-papel">{myReferralCode}</span>
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

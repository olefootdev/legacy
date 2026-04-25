import { motion } from 'motion/react';
import { Target, CheckCircle2, Clock, Gift, ChevronRight, Copy, CheckCircle, Link2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { formatExp } from '@/systems/economy';
import { useEffect, useMemo, useState } from 'react';
import { MISSION_CATALOG } from '@/progression/missions/catalog';
import { useProgressionStore } from '@/progression/progressionStore';
import type { MissionDef, MissionEvent } from '@/progression/types';
import { normalizeWalletState } from '@/wallet/initial';
import { inviteLinkForCode } from '@/wallet/referralCode';
import { computeCareerTier } from '@/systems/careerTiers';

interface MissionStub {
  id: string;
  title: string;
  desc: string;
  reward: number;
  status: 'available' | 'in_progress' | 'completed';
  target: number;
  distinctDone?: string[];
  trackEvents: readonly MissionEvent[];
  progress?: { current: number; total: number };
}

const EVENT_LABELS: Record<MissionEvent, string> = {
  session_login: 'fazer login',
  screen_home: 'abrir Home',
  screen_team: 'abrir Meu Time',
  screen_wallet: 'abrir Wallet',
  screen_city: 'abrir Cidade',
  screen_transfer: 'abrir Transfer',
  screen_store: 'abrir Loja',
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

function statusColor(s: MissionStub['status']) {
  if (s === 'completed') return 'text-neon-yellow';
  if (s === 'in_progress') return 'text-neon-yellow';
  return 'text-gray-500';
}

function statusIcon(s: MissionStub['status']) {
  if (s === 'completed') return CheckCircle2;
  if (s === 'in_progress') return Clock;
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
  const [tab, setTab] = useState<'ongoing' | 'completed'>('ongoing');
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
    return MISSION_CATALOG.filter((def) => (def.minTier ?? 1) <= currentTier.id).map((def: MissionDef) => {
      const st = runtime[def.id] ?? { progress: 0, claimed: false, distinctDone: [] };
      const status: MissionStub['status'] = st.claimed ? 'completed' : st.progress > 0 ? 'in_progress' : 'available';
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
      };
    });
  }, [runtime, currentTier.id]);

  const visibleMissions = useMemo(() => {
    const list = tab === 'completed'
      ? missions.filter((m) => m.status === 'completed')
      : missions.filter((m) => m.status !== 'completed');
    return list;
  }, [missions, tab]);

  const completeMission = (m: MissionStub) => {
    if ((m.progress?.current ?? 0) >= m.target) {
      const ok = claimMission(m.id);
      if (ok) {
        dispatch({
          type: 'GRANT_EARNED_EXP',
          amount: m.reward,
          historySource: `Missão: ${m.title}`,
        });
        setFeedback('Missão concluída com sucesso.');
        setTab('completed');
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

  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-display font-black uppercase tracking-wider">Missões</h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Seu tier atual: <span className="text-neon-yellow font-bold">{currentTier.glyph} {currentTier.name}</span>
              {' · '}
              {MISSION_CATALOG.length - missions.length > 0
                ? `${MISSION_CATALOG.length - missions.length} missão(ões) travada(s) — evolua para desbloquear.`
                : 'Todas as missões desbloqueadas.'}
            </p>
          </div>
          <div className="bg-panel border border-white/10 px-4 py-2">
            <span className="text-sm font-display font-bold text-neon-yellow tracking-wider">{formatExp(finance.ole)} EXP</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-panel border border-blue-400/25 p-5 space-y-3"
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Link2 className="w-5 h-5 text-blue-400 shrink-0" aria-hidden />
            <div>
              <h3 className="text-sm font-display font-black uppercase tracking-wider text-white">Seu link de indicação</h3>
              <p className="text-[11px] text-gray-500 mt-0.5 max-w-xl">
                Quem abrir este endereço entra no cadastro já com o seu código. O mesmo link usa o domínio actual da app (localhost em dev, o teu site em produção).
              </p>
            </div>
          </div>
          <Link
            to="/wallet/referrals"
            className="text-[10px] font-bold uppercase tracking-wider text-blue-300 hover:text-blue-200 border border-blue-500/30 px-2.5 py-1.5 shrink-0"
          >
            Carteira → Indicações
          </Link>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
          <div className="flex-1 min-w-0 bg-black/40 border border-white/10 px-3 py-2.5 font-mono text-xs text-white/90 break-all">
            {inviteUrl || '—'}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={copyInviteLink}
              disabled={!inviteUrl}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500/15 border border-blue-400/35 text-blue-200 text-[11px] font-bold uppercase tracking-wider hover:bg-blue-500/25 disabled:opacity-30"
            >
              {copiedLink ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              Copiar link
            </button>
            <button
              type="button"
              onClick={copyCode}
              disabled={!myReferralCode}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-white/15 text-gray-200 text-[11px] font-bold uppercase tracking-wider hover:bg-white/10 disabled:opacity-30"
            >
              {copiedCode ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              Só código
            </button>
          </div>
        </div>
        {myReferralCode ? (
          <p className="text-[10px] text-gray-600 font-mono">
            Código: <span className="text-gray-400">{myReferralCode}</span>
          </p>
        ) : null}
      </motion.div>

      <div className="space-y-3">
        {feedback && (
          <div className="bg-neon-yellow/10 border border-neon-yellow/40 p-3 text-xs text-neon-yellow font-semibold">
            {feedback}
          </div>
        )}
        <div className="flex gap-2 pb-1">
          <button
            onClick={() => setTab('ongoing')}
            className={cn(
              'px-4 py-2 text-xs font-display font-bold uppercase tracking-wider border -skew-x-6',
              tab === 'ongoing'
                ? 'bg-neon-yellow text-black border-neon-yellow'
                : 'bg-dark-gray text-gray-400 border-white/10 hover:bg-white/10 hover:text-white',
            )}
          >
            <span className="skew-x-6 block">Em Andamento</span>
          </button>
          <button
            onClick={() => setTab('completed')}
            className={cn(
              'px-4 py-2 text-xs font-display font-bold uppercase tracking-wider border -skew-x-6',
              tab === 'completed'
                ? 'bg-neon-yellow text-black border-neon-yellow'
                : 'bg-dark-gray text-gray-400 border-white/10 hover:bg-white/10 hover:text-white',
            )}
          >
            <span className="skew-x-6 block">Concluídas</span>
          </button>
        </div>

        {visibleMissions.map((m, i) => {
          const Icon = statusIcon(m.status);
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className={cn(
                'bg-panel border border-white/10 p-5 flex items-center gap-4 group hover:border-white/20 transition-colors',
                m.status === 'completed' && 'border-neon-yellow/50 bg-neon-yellow/10',
              )}
            >
              <div className={cn('w-10 h-10 flex items-center justify-center shrink-0', statusColor(m.status))}>
                <Icon className="w-6 h-6" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-white tracking-wider uppercase text-sm">{m.title}</h3>
                  {m.status === 'completed' && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-neon-yellow bg-neon-yellow/10 px-2 py-0.5">Concluída</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
                {m.progress && m.status !== 'completed' && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 bg-dark-gray overflow-hidden">
                      <div
                        className="h-full bg-neon-yellow"
                        style={{ width: `${(m.progress.current / m.progress.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 font-bold">{m.progress.current}/{m.progress.total}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {m.status !== 'completed' && tab === 'ongoing' && (
                  <button
                    onClick={() => completeMission(m)}
                    className="px-3 py-1.5 rounded bg-neon-yellow text-black text-[10px] font-bold uppercase tracking-wider"
                  >
                    Concluir
                  </button>
                )}
                <div className="flex items-center gap-1">
                  <Gift className="w-3.5 h-3.5 text-neon-yellow" />
                  <span className="text-sm font-display font-bold text-neon-yellow">{m.reward}</span>
                  <span className="text-[9px] text-gray-500 font-bold">EXP</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
              </div>
            </motion.div>
          );
        })}
        {visibleMissions.length === 0 && (
          <div className="bg-panel border border-white/10 p-5 text-xs text-gray-500">
            Nenhuma missão nesta aba.
          </div>
        )}
      </div>

    </div>
  );
}

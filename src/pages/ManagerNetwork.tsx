/**
 * ManagerNetwork — Página de Network do Manager
 * Solicitações de amizade + Indicações cadastradas + Link de indicação
 * Design system: HERO amarelo editorial + cards padrão do jogo
 */
import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Network,
  Users,
  UserPlus,
  Copy,
  CheckCircle,
  Link2,
  X,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { useNavigate } from 'react-router-dom';
import { normalizeWalletState } from '@/wallet/initial';
import { inviteLinkForCode, normalizeReferralCode } from '@/wallet/referralCode';
import { fetchMyReferrals, claimMyReferralCommission, type ReferredProfile } from '@/supabase/referrals';

export function ManagerNetwork() {
  const dispatch = useGameDispatch();
  const navigate = useNavigate();
  const club = useGameStore((s) => s.club);
  const social = useGameStore((s) => s.social);
  const finance = useGameStore((s) => s.finance);

  const wallet = useMemo(
    () => normalizeWalletState(finance.wallet ?? undefined),
    [finance.wallet],
  );

  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const myReferralCode = wallet.myReferralCode ?? '';
  const inviteLink = myReferralCode ? inviteLinkForCode(myReferralCode) : '';

  // Indicações cadastradas — fonte autoritativa é o Supabase (RPC get_my_referrals).
  // wallet.referralTree é zustand local e não reflete cadastros via link.
  const [serverReferrals, setServerReferrals] = useState<ReferredProfile[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await fetchMyReferrals();
      if (cancelled) return;
      setServerReferrals(list);
      setLoadingReferrals(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const referrals = useMemo(
    () =>
      serverReferrals.map((r) => ({
        id: r.id,
        displayName: r.displayName ?? 'Manager',
        clubName: r.clubName ?? null,
        clubShort: r.clubShort,
        level: 1 as number,
        joinedAt: r.createdAt,
        lifetime: r.expLifetimeEarned,
        pending: r.commissionPending,
        total: r.commissionTotal,
      })),
    [serverReferrals],
  );

  const totalCommissionPending = useMemo(
    () => referrals.reduce((sum, r) => sum + r.pending, 0),
    [referrals],
  );
  const totalCommissionAccumulated = useMemo(
    () => referrals.reduce((sum, r) => sum + r.total, 0),
    [referrals],
  );

  const [claiming, setClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState<number | null>(null);

  const handleClaimAll = async () => {
    if (claiming || totalCommissionPending <= 0) return;
    setClaiming(true);
    try {
      const amount = await claimMyReferralCommission();
      if (amount > 0) {
        dispatch({ type: 'WALLET_RECEIVE_REFERRAL_COMMISSION_EXP', amount });
        setClaimSuccess(amount);
        // Refresh do servidor pra zerar os pendings na UI
        const fresh = await fetchMyReferrals();
        setServerReferrals(fresh);
      }
      setTimeout(() => setClaimSuccess(null), 4000);
    } finally {
      setClaiming(false);
    }
  };

  const blockedManagerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const f of social.friends) ids.add(f.managerId);
    for (const o of social.outgoing) ids.add(o.toManagerId);
    for (const i of social.incoming) ids.add(i.fromManagerId);
    return ids;
  }, [social]);

  const suggestions = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const DISCOVERABLE_MANAGERS: any[] = [];
    return DISCOVERABLE_MANAGERS.filter((m) => {
      if (blockedManagerIds.has(m.id)) return false;
      if (!qq) return true;
      return (
        m.clubName.toLowerCase().includes(qq) ||
        m.city.toLowerCase().includes(qq) ||
        m.id.toLowerCase().includes(qq)
      );
    });
  }, [q, blockedManagerIds]);

  const sendInvite = (managerId: string, clubName: string) => {
    dispatch({ type: 'SEND_FRIEND_REQUEST', managerId, clubName });
    setAddOpen(false);
    setQ('');
  };

  function handleCopyCode() {
    if (!myReferralCode) return;
    navigator.clipboard.writeText(myReferralCode).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function handleCopyLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <div className="mx-auto min-w-0 w-full max-w-6xl space-y-6 overflow-x-hidden pb-6 md:pb-8 px-3 sm:px-4 lg:px-6">
      {/* ── HERO EDITORIAL — amarelo com watermark cinematográfico ── */}
      <section
        aria-label="Network do Manager"
        className="relative w-full max-w-full min-w-0 overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-6"
      >
        {/* Watermark gigante — preto sobre amarelo, opacity baixa */}
        <div
          className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden"
          aria-hidden
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="font-display font-black uppercase whitespace-nowrap text-black/[0.04]"
            style={{
              fontSize: 'clamp(120px, 22vw, 420px)',
              lineHeight: '0.85',
              letterSpacing: '-0.02em',
            }}
          >
            Network
          </motion.span>
        </div>

        {/* Composição editorial centrada vertical */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-14 text-center"
        >
          {/* Eyebrow */}
          <div
            className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-black mb-4 sm:mb-6 truncate"
          >
            <span className="text-black">{club.name} · {club.city}</span>
          </div>

          {/* Headline duo: NETWORK + Conexões */}
          <h1 className="leading-[0.9]">
            <span
              className="block font-bold uppercase text-black"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.75rem, 8vw, 6rem)',
                letterSpacing: '0.005em',
              }}
            >
              Network
            </span>
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="block italic text-black"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontSize: 'clamp(2.25rem, 7vw, 5rem)',
                marginTop: '0.04em',
                letterSpacing: '-0.01em',
              }}
            >
              Conexões
            </motion.span>
          </h1>

          {/* Régua decorativa */}
          <span aria-hidden className="mx-auto mt-6 block w-16 h-[3px] bg-black" />

          {/* Quote italic — CENTERPIECE editorial */}
          <motion.blockquote
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="ole-headline-italic mt-7 sm:mt-9 text-black/85 mx-auto max-w-xl leading-snug"
            style={{ fontSize: 'clamp(15px, 2vw, 19px)' }}
          >
            "construir rede é construir legado — cada conexão multiplica oportunidades."
          </motion.blockquote>

          {/* Link de indicação — destaque no hero */}
          <div className="mt-8 sm:mt-10 mx-auto max-w-lg">
            {inviteLink && (
              <div className="bg-black/10 border-2 border-black/20 px-4 py-4 rounded-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-black/60 mb-2">
                  Teu link de indicação
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 bg-black/20 border border-black/30 rounded-sm px-3 py-2.5">
                    <p className="font-mono text-base font-bold text-black tracking-wider truncate">
                      {myReferralCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="shrink-0 bg-black px-3 py-2.5 rounded-sm hover:bg-black/90 transition-colors"
                    aria-label="Copiar código"
                  >
                    {copiedCode ? (
                      <CheckCircle className="w-5 h-5 text-neon-yellow" />
                    ) : (
                      <Copy className="w-5 h-5 text-neon-yellow" />
                    )}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/10">
                  <p className="text-[10px] text-black/60 font-mono truncate">{inviteLink}</p>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-black/80 hover:text-black transition-colors flex items-center gap-1"
                  >
                    <Link2 className="w-3 h-3" />
                    {copiedLink ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stats strip — 3 métricas principais */}
          <div className="mt-8 sm:mt-10 grid grid-cols-3 gap-2 sm:gap-3 max-w-lg mx-auto px-2">
            <div className="bg-black px-2 py-3 sm:px-4 sm:py-4 text-center min-w-0"
                 style={{ borderRadius: 'var(--radius-sm)' }}>
              <p
                className="text-neon-yellow tabular-nums leading-none truncate"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 'clamp(20px, 4vw, 36px)',
                }}
              >
                {social.friends.length}
              </p>
              <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
                Amigos
              </p>
            </div>
            <div className="bg-black px-2 py-3 sm:px-4 sm:py-4 text-center min-w-0"
                 style={{ borderRadius: 'var(--radius-sm)' }}>
              <p
                className="text-rose-400 tabular-nums leading-none truncate"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 'clamp(20px, 4vw, 36px)',
                }}
              >
                {social.incoming.length}
              </p>
              <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
                Pedidos
              </p>
            </div>
            <div className="bg-black px-2 py-3 sm:px-4 sm:py-4 text-center min-w-0"
                 style={{ borderRadius: 'var(--radius-sm)' }}>
              <p
                className="text-cyan-400 tabular-nums leading-none truncate"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 'clamp(20px, 4vw, 36px)',
                }}
              >
                {loadingReferrals ? '…' : referrals.length}
              </p>
              <p className="mt-1.5 text-white/65 uppercase tracking-[0.18em] text-[9px] sm:text-[10px] font-medium">
                Indicações
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── SEÇÕES PRINCIPAIS ────────────────────────────────────── */}
      <section className="space-y-4">
        {/* Solicitações pendentes */}
        {social.incoming.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="ole-eyebrow !text-rose-400">
                <span>Solicitações</span>
              </div>
            </div>
            {social.incoming.map((req, idx) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + idx * 0.05 }}
                className="group bg-panel border border-white/10 hover:border-rose-500/40 rounded-sm p-5 sm:p-6 transition-all hover:shadow-[0_0_24px_rgba(244,63,94,0.12)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-rose-500/15 border-2 border-rose-500/40 rounded-sm transition-transform group-hover:scale-110">
                      <UserPlus className="h-7 w-7 text-rose-400" strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-sm font-black uppercase tracking-wider text-white mb-1">
                        {req.fromClubName}
                      </h3>
                      <p className="text-xs text-gray-400">
                        Quer entrar na tua rede
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'ACCEPT_FRIEND_REQUEST', requestId: req.id })}
                      className="bg-neon-green px-4 py-2 rounded-sm font-display text-[10px] font-black uppercase tracking-wider text-black hover:bg-white transition-all hover:scale-[1.02]"
                    >
                      Aceitar
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'DECLINE_FRIEND_REQUEST', requestId: req.id })}
                      className="border border-white/20 px-4 py-2 rounded-sm font-display text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Amigos */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="ole-eyebrow !text-neon-yellow">
                <span>Amigos</span>
              </div>
              <Users className="h-3.5 w-3.5 text-neon-yellow/70" aria-hidden />
            </div>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 bg-neon-yellow px-3 py-1.5 rounded-sm font-display text-xs font-bold uppercase tracking-wider text-black hover:bg-white transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          </div>

          {social.friends.length === 0 ? (
            <div className="bg-panel border border-dashed border-white/10 rounded-sm p-6 text-center">
              <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-2">Nenhum amigo ainda</p>
              <p className="text-xs text-gray-600">
                Clica em <strong className="text-white">Adicionar</strong> para começar a construir a tua rede.
              </p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {social.friends.map((f, idx) => (
                <motion.div
                  key={f.managerId}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 + idx * 0.03 }}
                  className="flex items-center justify-between gap-2 bg-panel border border-white/10 rounded-sm p-4 hover:border-neon-yellow/30 transition-colors"
                >
                  <span className="font-display text-sm font-bold text-white truncate">
                    {f.clubName}
                  </span>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'REMOVE_SOCIAL_FRIEND', managerId: f.managerId })}
                    className="shrink-0 text-[10px] font-bold uppercase text-gray-500 hover:text-red-400 transition-colors"
                  >
                    Remover
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Convites enviados */}
        {social.outgoing.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <div className="ole-eyebrow !text-white/40">
              <span>Convites enviados</span>
            </div>
            <div className="space-y-2">
              {social.outgoing.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-2 bg-panel border border-white/10 rounded-sm p-3"
                >
                  <span className="font-display text-sm font-bold text-gray-400 truncate">
                    {o.toClubName}
                  </span>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'CANCEL_OUTGOING_FRIEND_REQUEST', requestId: o.id })}
                    className="shrink-0 text-[10px] font-bold uppercase text-gray-500 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Indicações cadastradas */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="ole-eyebrow !text-cyan-400">
                <span>Indicações</span>
              </div>
              <TrendingUp className="h-3.5 w-3.5 text-cyan-400/70" aria-hidden />
            </div>
            {referrals.length > 0 && (
              <span className="bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 rounded-sm font-display text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                {referrals.length}
              </span>
            )}
          </div>

          {/* Comissão pendente — destaque com botão Resgatar */}
          {!loadingReferrals && referrals.length > 0 && (
            <div className="bg-gradient-to-r from-neon-yellow/10 to-neon-yellow/5 border border-neon-yellow/30 rounded-sm p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] text-neon-yellow/70 uppercase tracking-[0.2em] font-display font-bold">
                    Comissão pendente
                  </p>
                  <p className="text-[10px] text-white/50 mt-0.5">
                    5% sobre todo EXP ganho pelos teus indicados
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-xl font-black text-neon-yellow tabular-nums tracking-tight leading-none">
                    +{totalCommissionPending.toLocaleString('pt-BR')}
                    <span className="text-[10px] ml-1 text-neon-yellow/70">EXP</span>
                  </p>
                  {totalCommissionAccumulated > totalCommissionPending && (
                    <p className="text-[9px] text-white/40 mt-1">
                      Total histórico: {totalCommissionAccumulated.toLocaleString('pt-BR')} EXP
                    </p>
                  )}
                </div>
              </div>
              {totalCommissionPending > 0 && (
                <motion.button
                  type="button"
                  onClick={handleClaimAll}
                  disabled={claiming}
                  whileTap={{ scale: 0.97 }}
                  className="mt-3 w-full bg-neon-yellow text-black py-2.5 rounded-sm font-display text-xs font-black uppercase tracking-[0.18em] hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {claiming ? 'Resgatando…' : 'Resgatar tudo'}
                </motion.button>
              )}
              {claimSuccess !== null && claimSuccess > 0 && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-[10px] text-emerald-300 font-display uppercase tracking-wider text-center"
                >
                  ✓ +{claimSuccess.toLocaleString('pt-BR')} EXP creditados no saldo
                </motion.p>
              )}
            </div>
          )}

          {loadingReferrals ? (
            <div className="bg-panel border border-dashed border-white/10 rounded-sm p-6 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider">A carregar a tua rede…</p>
            </div>
          ) : referrals.length === 0 ? (
            <div className="bg-panel border border-dashed border-white/10 rounded-sm p-6 text-center">
              <Sparkles className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-2">Nenhuma indicação ainda</p>
              <p className="text-xs text-gray-600 mb-4">
                Partilha o teu link de indicação para começar a construir a tua rede e ganhar comissões.
              </p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-2 bg-cyan-500 px-4 py-2 rounded-sm font-display text-xs font-bold uppercase tracking-wider text-white hover:bg-cyan-400 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar link de indicação
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {referrals.map((ref, idx) => (
                <motion.div
                  key={ref.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + idx * 0.05 }}
                  className="bg-panel border border-cyan-500/10 rounded-sm p-4 hover:border-cyan-500/30 transition-colors"
                >
                  {/* Header: nome + clube + L1 badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-bold text-white truncate">
                        {ref.displayName}
                      </p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                        {ref.clubShort && (
                          <>
                            <span className="font-mono text-cyan-300/80">{ref.clubShort}</span>
                            <span className="text-white/30">·</span>
                          </>
                        )}
                        {ref.clubName && (
                          <>
                            <span className="truncate">{ref.clubName}</span>
                            <span className="text-white/30">·</span>
                          </>
                        )}
                        <span className="whitespace-nowrap">
                          {new Date(ref.joinedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </span>
                      </p>
                    </div>
                    <span className="shrink-0 px-2 py-1 rounded-sm font-display text-[9px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300">
                      L{ref.level}
                    </span>
                  </div>

                  {/* Stats: EXP do indicado + comissão recebida */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
                    <div className="text-center">
                      <p className="text-[9px] text-gray-500 uppercase tracking-[0.18em] mb-1">
                        Já ganhou
                      </p>
                      <p className="font-display text-base font-bold text-white tabular-nums">
                        {ref.lifetime.toLocaleString('pt-BR')}
                      </p>
                      <p className="text-[9px] text-gray-500 uppercase tracking-wider">EXP</p>
                    </div>
                    <div className="text-center border-l border-white/5">
                      <p className="text-[9px] text-neon-yellow/70 uppercase tracking-[0.18em] mb-1">
                        {ref.pending > 0 ? 'A resgatar (5%)' : 'Já recebido (5%)'}
                      </p>
                      <p className="font-display text-base font-bold text-neon-yellow tabular-nums">
                        +{(ref.pending > 0 ? ref.pending : ref.total).toLocaleString('pt-BR')}
                      </p>
                      <p className="text-[9px] text-neon-yellow/70 uppercase tracking-wider">EXP</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Info sobre comissões */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-panel border border-white/10 border-l-4 border-l-cyan-400 rounded-sm p-4 sm:p-5"
        >
          <p className="flex items-center gap-1.5 font-display text-xs font-black uppercase tracking-wider text-white mb-3">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" /> Como funcionam as comissões?
          </p>
          <ul className="space-y-2 text-xs text-white/60">
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold mt-0.5">•</span>
              <span><strong className="text-white">5% em BRO</strong> sobre compras elegíveis (OLE Game / NFT) até 3 níveis</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold mt-0.5">•</span>
              <span><strong className="text-white">1% da base GAT em EXP</strong> por dia, por nível (automático)</span>
            </li>
          </ul>
        </motion.div>
      </section>

      {/* ── MODAL ADICIONAR AMIGO ── */}
      <AnimatePresence>
        {addOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/85 p-3 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={() => setAddOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="my-auto flex max-h-[min(88dvh,calc(100dvh-5rem))] w-full max-w-md flex-col overflow-hidden rounded-sm border border-neon-yellow/40 bg-panel p-5 sm:max-h-[min(90dvh,640px)]"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-black uppercase tracking-wide text-white">
                    Adicionar amigo
                  </h3>
                  <p className="mt-1 text-[11px] text-gray-500">Busca um clube e envia um convite.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="rounded-sm p-2 text-gray-500 hover:bg-white/10 hover:text-white transition-colors"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nome do clube ou cidade..."
                className="mb-3 w-full rounded-sm border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-neon-yellow/60 focus:outline-none"
              />
              <ul className="max-h-[min(40dvh,14rem)] flex-1 divide-y divide-white/10 overflow-y-auto rounded-sm border border-white/10">
                {suggestions.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-gray-500">
                    Nenhum resultado ou todos já na rede.
                  </li>
                ) : (
                  suggestions.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-white/5">
                      <div className="min-w-0">
                        <p className="truncate font-display text-sm font-bold text-white">{m.clubName}</p>
                        <p className="text-[10px] text-gray-500">{m.city}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => sendInvite(m.id, m.clubName)}
                        className="shrink-0 bg-neon-yellow px-2.5 py-1 rounded-sm font-display text-[10px] font-bold uppercase text-black hover:bg-white transition-colors"
                      >
                        Convidar
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

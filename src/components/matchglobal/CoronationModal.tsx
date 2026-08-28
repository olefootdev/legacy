/**
 * CoronationModal — celebração fullscreen quando o manager logado é Coroa do Dia.
 *
 * Trigger: Realtime INSERT em `daily_crowns` capturado por useCoronationListener.
 * Confetti via canvas inline (sem lib externa). Dismiss via clique ou auto após 12s.
 *
 * [Fase 2] Ganhou COMPARTILHAMENTO. Era o maior feito do jogo — bater todo mundo
 * na chave do dia — e morria na tela sem render print. O texto sai do mesmo
 * detector de momento das outras competições, com o placar real da final e o
 * link de indicação embutido. Compartilhar CANCELA o auto-fechamento: ninguém
 * perde a modal no meio do share.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, X, Share2 } from 'lucide-react';
import type { DailyCrown } from '@/match/globalLeagueMVP';
import { detectMoment } from '@/systems/moments';
import { shareImageWithText } from '@/lib/shareImage';
import { fetchMyReferralCode } from '@/supabase/referrals';
import { track } from '@/analytics/track';

interface Props {
  crown: DailyCrown | null;
  onClose: () => void;
}

export function CoronationModal({ crown, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shared, setShared] = useState<'idle' | 'done' | 'copied'>('idle');
  /** Mexeu no share → a modal para de se auto-fechar e espera o manager. */
  const [holdOpen, setHoldOpen] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    if (!crown || holdOpen) return;
    const t = setTimeout(onClose, 12_000);
    return () => clearTimeout(t);
  }, [crown, onClose, holdOpen]);

  useEffect(() => {
    if (!crown) return;
    let alive = true;
    void fetchMyReferralCode().then((c) => { if (alive) setReferralCode(c); }).catch(() => {});
    return () => { alive = false; };
  }, [crown]);

  // A coroação apareceu — é o maior feito do jogo e até agora morria na tela.
  useEffect(() => {
    if (!crown) return;
    track('moment_detected', { competition: 'global', tier: 3, bracketSize: crown.bracketSize, surface: 'coronation' });
  }, [crown]);

  useEffect(() => {
    if (!crown) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = ['#FFDC00', '#FFFFFF', '#39FF14', '#FF6B35'];
    interface Particle { x: number; y: number; vx: number; vy: number; size: number; color: string; rot: number; vr: number; }
    const particles: Particle[] = [];
    const W = window.innerWidth, H = window.innerHeight;
    for (let i = 0; i < 220; i++) {
      particles.push({
        x: W / 2 + (Math.random() - 0.5) * 80,
        y: H / 2 + (Math.random() - 0.5) * 80,
        vx: (Math.random() - 0.5) * 18,
        vy: -Math.random() * 16 - 6,
        size: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
      });
    }

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.vy += 0.35;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [crown]);

  /**
   * Momento da coroação. `isTitle` + `stage: 'final'` fazem o detector tratar
   * como o feito máximo — e os pênaltis, quando houve, multiplicam a raridade.
   */
  const moment = crown
    ? detectMoment({
        competition: 'global',
        homeScore: crown.finalScoreHome ?? 0,
        awayScore: crown.finalScoreAway ?? 0,
        won: true,
        draw: false,
        wasLosing: false,
        possessionHome: 0,
        shotsHome: 0,
        bonusCount: 0,
        cleanSheet: (crown.finalScoreAway ?? 1) === 0,
        hattrick: false,
        streak: 0,
        stage: 'final',
        isTitle: true,
        wentToPens: crown.finalWentToPens,
      })
    : null;

  const onShare = async () => {
    if (!crown || !moment) return;
    setHoldOpen(true);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://game.olefoot.com';
    const referralUrl = referralCode ? `${origin}/cadastro/${referralCode}` : `${origin}/cadastro`;
    const scoreLine =
      crown.finalScoreHome != null && crown.finalScoreAway != null && crown.runnerUpClubName
        ? ` Final ${crown.finalScoreHome}–${crown.finalScoreAway} contra ${crown.runnerUpClubName}${crown.finalWentToPens ? ' nos pênaltis' : ''}.`
        : '';
    const text =
      `👑 COROA DO DIA no Olefoot! ${crown.clubName} ganhou a chave de ${crown.bracketSize} times.` +
      scoreLine +
      (moment.oneInX >= 10 ? ` Raridade estimada: 1 em ${moment.oneInX}.` : '') +
      ` Monta teu time e vem me tirar a coroa 👉 ${referralUrl}`;
    const r = await shareImageWithText({
      imageUrl: '/banner-campeao-game-ole.png',
      text,
      fileName: 'olefoot-coroa-do-dia.png',
      title: 'Coroa do Dia',
    });
    track('moment_shared', {
      competition: 'global',
      tier: moment.tier,
      result: r,
      surface: 'coronation',
    });
    if (r === 'shared') setShared('done');
    else if (r === 'fallback') setShared('copied');
  };

  return (
    <AnimatePresence>
      {crown && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center"
          onClick={onClose}
        >
          <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

          <motion.button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-6 right-6 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
          >
            <X className="w-5 h-5 text-white" />
          </motion.button>

          <motion.div
            initial={{ scale: 0.4, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 14, stiffness: 200 }}
            className="relative z-10 text-center px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              animate={{ rotate: [0, -6, 6, -4, 4, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-block mb-6"
            >
              <Crown className="w-32 h-32 text-neon-yellow drop-shadow-[0_0_32px_rgba(255,220,0,0.7)]" strokeWidth={1.5} />
            </motion.div>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="font-display text-[10px] sm:text-xs font-bold uppercase tracking-[0.4em] text-neon-yellow/80 mb-3"
            >
              Coroa do Dia · {crown.dailyDate}
            </motion.p>

            <motion.h1
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="font-display text-4xl sm:text-6xl md:text-7xl font-black uppercase text-white leading-none"
            >
              Você é o
              <br />
              <span className="text-neon-yellow">Campeão</span>
            </motion.h1>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="font-serif-hero italic text-xl sm:text-2xl text-white/80 mt-6"
            >
              {crown.clubName}
            </motion.p>

            {crown.runnerUpClubName && crown.finalScoreHome != null && crown.finalScoreAway != null && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="font-mono text-sm text-white/60 mt-4"
              >
                Final {crown.finalScoreHome}–{crown.finalScoreAway} vs {crown.runnerUpClubName}
                {crown.finalWentToPens ? ' (pênaltis)' : ''}
              </motion.p>
            )}

            <motion.button
              type="button"
              onClick={(e) => { e.stopPropagation(); void onShare(); }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
              className="mt-8 inline-flex items-center justify-center gap-2 border"
              style={{
                padding: '13px 26px',
                borderRadius: 'var(--radius-sm)',
                borderColor: 'var(--color-neon-yellow)',
                backgroundColor: 'rgba(253,225,0,0.1)',
                color: 'var(--color-neon-yellow)',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '13px',
                letterSpacing: '0.12em',
              }}
            >
              <Share2 className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              {shared === 'done' ? 'COMPARTILHADO!' : shared === 'copied' ? 'LINK COPIADO!' : 'COMPARTILHAR A COROA'}
            </motion.button>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4 }}
              className="mt-5 text-xs uppercase tracking-wider text-white/40"
            >
              clique fora pra fechar
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

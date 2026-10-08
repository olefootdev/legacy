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

import { L } from '@/i18n/L';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, X, Share2 } from 'lucide-react';
import type { DailyCrown } from '@/match/globalLeagueMVP';
import { detectMoment } from '@/systems/moments';
import { shareImageWithText } from '@/lib/shareImage';
import { fetchMyReferralCode } from '@/supabase/referrals';
import { track } from '@/analytics/track';
import { MarcaRua } from '@/components/ui/Rua';

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

    // DS 2027: papel picado em rua, ouro e papel — sem verde/laranja de enfeite.
    const colors = ['#F2E61E', '#C9A13B', '#EEE9DF'];
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
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://game.olefoot.ai';
    const referralUrl = referralCode ? `${origin}/cadastro/${referralCode}` : `${origin}/cadastro`;
    const scoreLine =
      crown.finalScoreHome != null && crown.finalScoreAway != null && crown.runnerUpClubName
        ? L(` Final ${crown.finalScoreHome}–${crown.finalScoreAway} contra ${crown.runnerUpClubName}${crown.finalWentToPens ? ' nos pênaltis' : ''}.`, ` Final ${crown.finalScoreHome}–${crown.finalScoreAway} vs ${crown.runnerUpClubName}${crown.finalWentToPens ? ' on penalties' : ''}.`)
        : '';
    const text =
      L(`👑 COROA DO DIA no Olefoot! ${crown.clubName} ganhou a chave de ${crown.bracketSize} times.`, `👑 CROWN OF THE DAY on Olefoot! ${crown.clubName} won the ${crown.bracketSize}-team bracket.`) +
      scoreLine +
      (moment.oneInX >= 10 ? L(` Raridade estimada: 1 em ${moment.oneInX}.`, ` Estimated rarity: 1 in ${moment.oneInX}.`) : '') +
      L(` Monta teu time e vem me tirar a coroa 👉 ${referralUrl}`, ` Build your team and come take my crown 👉 ${referralUrl}`);
    const r = await shareImageWithText({
      imageUrl: '/banner-campeao-game-ole.png',
      text,
      fileName: 'olefoot-coroa-do-dia.png',
      title: L('Coroa do Dia', 'Crown of the Day'),
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
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-asfalto-27/95"
          onClick={onClose}
        >
          <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

          <motion.button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            aria-label={L('Fechar', 'Close')}
            className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center border-2 border-papel text-papel transition-colors hover:bg-papel hover:text-asfalto-27"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
          >
            <X className="h-5 w-5" />
          </motion.button>

          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: 40, rotate: 0 }}
            animate={{ scale: 1, opacity: 1, y: 0, rotate: -1.5 }}
            transition={{ type: 'spring', damping: 14, stiffness: 200 }}
            className="relative z-10 mx-4 flex w-full max-w-md flex-col gap-4 overflow-hidden bg-ouro-27 p-6 text-asfalto-27 shadow-[6px_6px_0_var(--color-papel)]"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              aria-hidden
              className="rua-reticula absolute -right-4 -top-4 h-40 w-48 [--reticula:rgba(13,13,12,0.4)]"
              style={{
                WebkitMaskImage: 'radial-gradient(circle at 100% 0%, #000 0%, transparent 72%)',
                maskImage: 'radial-gradient(circle at 100% 0%, #000 0%, transparent 72%)',
              }}
            />
            <div className="relative flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.2em]">
                <Crown aria-hidden className="h-4 w-4" /> {L('#coroadodia', '#crownoftheday')} · {crown.dailyDate}
              </span>
            </div>

            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="relative font-voz leading-[0.9]"
              style={{ fontSize: 'clamp(44px, 13vw, 72px)' }}
            >
              {L('A coroa é tua.', 'The crown is yours.')}
            </motion.h1>

            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }} className="relative flex items-end justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-impact uppercase leading-[0.88] [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(32px, 9vw, 48px)' }}>
                  {crown.clubName}
                </p>
                {crown.runnerUpClubName && crown.finalScoreHome != null && crown.finalScoreAway != null && (
                  <p className="font-prova text-[12px] font-bold uppercase tracking-[0.06em]">
                    Final <span className="font-spray text-[22px] font-black">{crown.finalScoreHome}×{crown.finalScoreAway}</span> vs {crown.runnerUpClubName}
                    {crown.finalWentToPens ? L(' (pênaltis)', ' (penalties)') : ''}
                  </p>
                )}
              </div>
              <MarcaRua tipo="nove" className="h-20 shrink-0 bg-asfalto-27" />
            </motion.div>

            <motion.button
              type="button"
              onClick={(e) => { e.stopPropagation(); void onShare(); }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
              className="relative mt-2 inline-flex min-h-[54px] items-center justify-center gap-2 bg-asfalto-27 px-6 font-impact text-[20px] uppercase leading-none text-ouro-27 transition-transform hover:-translate-y-0.5"
            >
              <Share2 className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              {shared === 'done' ? L('Compartilhado!', 'Shared!') : shared === 'copied' ? L('Link copiado!', 'Link copied!') : L('Compartilhar a coroa', 'Share the crown')}
              {shared === 'idle' && <span aria-hidden>→</span>}
            </motion.button>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4 }}
              className="relative text-center font-prova text-[10.5px] font-bold uppercase tracking-[0.16em] opacity-70"
            >
              {L('toca fora pra fechar', 'tap outside to close')}
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * MomentShareCard — o pôster compartilhável de QUALQUER momento (Fase 2).
 *
 * Generaliza o `QuickShareCard` (que só servia a Partida Rápida) e o
 * `ChampionShareCard` local da Liga Ole (que só disparava no título). Mesma
 * anatomia visual dos dois — banner estático 9:16, manchete Moret sobreposta,
 * selo de raridade, CTA de indicação e Web Share da imagem real — mas dirigido
 * por um `Moment`, então serve Liga Ole, Legends Cup e Liga Global também.
 *
 * O link de indicação viaja DENTRO do texto (nunca no campo `url` separado):
 * assim ele acompanha o print mesmo quando o app de destino ignora o `url`.
 *
 * Presentational puro.
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { Share2, Sparkles, Star } from 'lucide-react';
import { shareImageWithText } from '@/lib/shareImage';
import { momentTierLabel, type Moment, type MomentCompetition } from '@/systems/moments/detectMoment';

const MORET = 'var(--font-serif-hero)';

/** Arte de fundo por competição — assets que já existem no repositório. */
const BANNER: Record<MomentCompetition, string> = {
  'quick': '/banner-campeao-game-ole.png',
  'liga-ole': '/banner-campeao-liga-ole.png',
  'legends-cup': '/banner-campeao-game-ole.png',
  'global': '/banner-campeao-game-ole.png',
};

export interface MomentShareCardProps {
  moment: Moment;
  clubName: string;
  /** Adversário do lance. Ausente = feito de campanha, não de partida. */
  opponentName?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  /** Craque do momento — chip destacado na base do card. */
  highlight?: { label: string; name: string; detail?: string } | null;
  referralCode: string | null;
  /** Texto do botão de ação principal dentro do card. */
  ctaLabel?: string;
}

export function MomentShareCard({
  moment,
  clubName,
  opponentName,
  homeScore,
  awayScore,
  highlight,
  referralCode,
  ctaLabel = 'CRIE SEU TIME AGORA',
}: MomentShareCardProps) {
  const [shared, setShared] = useState<'idle' | 'done' | 'copied'>('idle');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://game.olefoot.com';
  const referralUrl = referralCode ? `${origin}/cadastro/${referralCode}` : `${origin}/cadastro`;
  const displayUrl = referralUrl.replace(/^https?:\/\//, '');

  const hasScore = typeof homeScore === 'number' && typeof awayScore === 'number';
  const scoreLine = hasScore ? `${homeScore}–${awayScore}` : null;

  const shareMessage =
    `${moment.headline} no Olefoot! ${clubName}` +
    (scoreLine && opponentName ? ` ${scoreLine} ${opponentName}` : '') +
    ` — ${moment.tagline}.` +
    (moment.oneInX >= 10 ? ` Raridade estimada: 1 em ${moment.oneInX}.` : '') +
    (highlight ? ` ${highlight.label}: ${highlight.name}.` : '') +
    ` Monta teu time e vem 👉 ${referralUrl}`;

  const banner = BANNER[moment.competition];

  const onShare = async () => {
    const r = await shareImageWithText({
      imageUrl: banner,
      text: shareMessage,
      fileName: `olefoot-${moment.competition}.png`,
      title: moment.headline,
    });
    if (r === 'shared') setShared('done');
    else if (r === 'fallback') setShared('copied');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-3"
    >
      <div
        className="relative w-full max-w-[340px] overflow-hidden"
        style={{
          borderRadius: 'var(--radius-md)',
          aspectRatio: '9 / 16',
          border: '2px solid rgba(201,162,39,0.55)',
          boxShadow: '0 12px 34px rgba(0,0,0,0.5)',
        }}
      >
        <img
          src={banner}
          alt={`${clubName} — ${moment.headline}`}
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.1) 24%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.4) 64%, rgba(0,0,0,0.94) 100%)' }}
        />

        {/* Topo: selo de raridade + manchete do momento */}
        <div className="absolute inset-x-4 top-8 z-10">
          {moment.oneInX >= 10 && (
            <div
              className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1"
              style={{ borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(253,225,0,0.5)' }}
            >
              <Sparkles className="h-3 w-3 text-neon-yellow" strokeWidth={2.5} aria-hidden />
              <span style={{ color: 'var(--color-neon-yellow)', fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em' }}>
                {momentTierLabel(moment.tier).toUpperCase()} · 1 EM {moment.oneInX}
              </span>
            </div>
          )}
          <p
            className="mb-1 font-display uppercase"
            style={{ color: 'var(--color-neon-yellow)', fontSize: '10px', fontWeight: 800, letterSpacing: '0.26em' }}
          >
            {moment.competitionLabel}
          </p>
          <p
            style={{
              color: '#f7ecd2',
              fontFamily: MORET,
              fontStyle: 'italic',
              fontWeight: 700,
              fontSize: 'clamp(30px, 10vw, 46px)',
              lineHeight: 0.9,
              letterSpacing: '-0.03em',
            }}
          >
            {moment.headline}
          </p>
          <p className="mt-1.5 text-white" style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '15px' }}>
            {clubName}
            {scoreLine ? <span className="tabular-nums text-neon-yellow"> {scoreLine} </span> : ' '}
            {opponentName ?? ''}
          </p>
          <p className="mt-1 text-white/70" style={{ fontFamily: 'var(--font-sans)', fontSize: '12px' }}>
            {moment.tagline}
          </p>
        </div>

        {/* Base: destaque + CTA de indicação */}
        <div className="absolute inset-x-4 bottom-4 z-10">
          {highlight && (
            <div
              className="mb-2.5 inline-flex items-center gap-2 px-2.5 py-1.5"
              style={{ borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(253,225,0,0.4)' }}
            >
              <Star className="h-3.5 w-3.5 text-neon-yellow" strokeWidth={2.5} aria-hidden />
              <span style={{ color: '#f7ecd2', fontSize: '11px', fontWeight: 600 }}>
                {highlight.label}: <span className="text-white">{highlight.name}</span>
                {highlight.detail ? ` · ${highlight.detail}` : ''}
              </span>
            </div>
          )}

          <a
            href={referralUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2"
            style={{
              padding: '11px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-neon-yellow)',
              color: '#1a1405',
              fontWeight: 800,
              fontSize: '13px',
              letterSpacing: '0.04em',
              textDecoration: 'none',
              fontFamily: 'var(--font-display)',
            }}
          >
            {ctaLabel}
          </a>
          <p className="mt-1.5 text-center" style={{ color: 'rgba(253,225,0,0.85)', fontSize: '10px' }}>
            {displayUrl}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onShare}
        className="flex w-full max-w-[340px] items-center justify-center gap-2 border"
        style={{
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          borderColor: 'var(--color-neon-yellow)',
          backgroundColor: 'rgba(253,225,0,0.08)',
          color: 'var(--color-neon-yellow)',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: '12px',
          letterSpacing: '0.1em',
        }}
      >
        <Share2 className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        {shared === 'done' ? 'COMPARTILHADO!' : shared === 'copied' ? 'LINK COPIADO!' : 'COMPARTILHAR MOMENTO'}
      </button>
    </motion.div>
  );
}

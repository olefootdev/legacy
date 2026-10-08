/**
 * MomentShareCard — o pôster compartilhável de QUALQUER momento (Fase 2).
 *
 * Generaliza o `QuickShareCard` (que só servia a Partida Rápida) e o
 * `ChampionShareCard` local da Liga Ole (que só disparava no título). Mesma
 * anatomia visual dos dois — banner estático 9:16, manchete Anton sobreposta,
 * selo de raridade, CTA de indicação e Web Share da imagem real — mas dirigido
 * por um `Moment`, então serve Liga Ole, Legends Cup e Liga Global também.
 *
 * O link de indicação viaja DENTRO do texto (nunca no campo `url` separado):
 * assim ele acompanha o print mesmo quando o app de destino ignora o `url`.
 *
 * DS 2027: pôster de rua — manchete Anton, clube na VOZ, placar em spray,
 * craque num post-it de ouro chapado (peça 2b do DS), CTA rua com sombra dura.
 *
 * Presentational puro.
 */

import { L } from '@/i18n/L';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Share2 } from 'lucide-react';
import { shareImageWithText } from '@/lib/shareImage';
import { track } from '@/analytics/track';
import { momentTierLabel, type Moment, type MomentCompetition } from '@/systems/moments/detectMoment';

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
  ctaLabel = L('CRIE SEU TIME AGORA', 'CREATE YOUR TEAM NOW'),
}: MomentShareCardProps) {
  const [shared, setShared] = useState<'idle' | 'done' | 'copied'>('idle');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://game.olefoot.ai';
  const referralUrl = referralCode ? `${origin}/cadastro/${referralCode}` : `${origin}/cadastro`;
  const displayUrl = referralUrl.replace(/^https?:\/\//, '');

  const hasScore = typeof homeScore === 'number' && typeof awayScore === 'number';
  const scoreLine = hasScore ? `${homeScore}–${awayScore}` : null;

  const shareMessage =
    L(`${moment.headline} no Olefoot! ${clubName}`, `${moment.headline} on Olefoot! ${clubName}`) +
    (scoreLine && opponentName ? ` ${scoreLine} ${opponentName}` : '') +
    ` — ${moment.tagline}.` +
    (moment.oneInX >= 10 ? L(` Raridade estimada: 1 em ${moment.oneInX}.`, ` Estimated rarity: 1 in ${moment.oneInX}.`) : '') +
    (highlight ? ` ${highlight.label}: ${highlight.name}.` : '') +
    L(` Monta teu time e vem 👉 ${referralUrl}`, ` Build your team and join 👉 ${referralUrl}`);

  const banner = BANNER[moment.competition];

  // O card foi MOSTRADO. Sem isto não dá pra calcular taxa de share — só o
  // numerador (quem apertou) seria conhecido.
  useEffect(() => {
    track('moment_detected', {
      competition: moment.competition,
      tier: moment.tier,
      oneInX: moment.oneInX,
      surface: 'card',
    });
  }, [moment.competition, moment.tier, moment.oneInX]);

  const onShare = async () => {
    const r = await shareImageWithText({
      imageUrl: banner,
      text: shareMessage,
      fileName: `olefoot-${moment.competition}.png`,
      title: moment.headline,
    });
    // `result` separa quem compartilhou de verdade de quem caiu no fallback
    // de clipboard e de quem cancelou no diálogo do sistema.
    track('moment_shared', {
      competition: moment.competition,
      tier: moment.tier,
      result: r,
      surface: 'card',
    });
    if (r === 'shared') setShared('done');
    else if (r === 'fallback') setShared('copied');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full flex-col items-center gap-4"
    >
      {/* O pôster: foto escurecida, manchete no GRITO, craque em post-it de ouro. */}
      <div className="relative w-full max-w-[340px] overflow-hidden bg-asfalto-27 shadow-[6px_6px_0_var(--color-papel)]" style={{ aspectRatio: '9 / 16' }}>
        <img
          src={banner}
          alt={`${clubName} — ${moment.headline}`}
          loading="eager"
          className="absolute inset-0 object-cover"
          style={{ width: '100%', height: '100%', maxWidth: 'none' }}
        />
        {/* Escurece a foto pra leitura — preto → transparente, sem cor. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(13,13,12,0.9) 0%, rgba(13,13,12,0.35) 30%, rgba(13,13,12,0.1) 46%, rgba(13,13,12,0.6) 66%, rgba(13,13,12,0.97) 100%)' }}
        />

        {/* Topo: competição + selo de raridade + manchete */}
        <div className="absolute inset-x-4 top-5 z-10 flex flex-col gap-2">
          <div className="flex min-w-0 items-center justify-between gap-2 font-prova text-[10.5px] font-bold uppercase tracking-[0.2em]">
            <span className="min-w-0 truncate text-rua">{moment.competitionLabel}</span>
            <span className="shrink-0 text-suave">{L('Fim de campanha', 'Campaign over')}</span>
          </div>
          {moment.oneInX >= 10 && (
            <span className="inline-flex w-fit -rotate-2 items-center bg-cal px-2.5 py-1 font-prova text-[10.5px] font-bold uppercase tracking-[0.12em] text-asfalto-27">
              {momentTierLabel(moment.tier)} · {L('1 em', '1 in')} {moment.oneInX}
            </span>
          )}
          <p className="font-impact uppercase text-papel [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(36px, 11vw, 50px)', lineHeight: 0.9 }}>
            {moment.headline}
          </p>
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-papel">
            <span className="font-voz text-[24px] leading-none">{clubName}</span>
            {scoreLine && <span className="font-spray text-[30px] font-black leading-none text-rua">{scoreLine}</span>}
            {opponentName && <span className="font-impact text-[18px] uppercase leading-none text-suave">{opponentName}</span>}
          </p>
          <p className="font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-suave">{moment.tagline}</p>
        </div>

        {/* Base: post-it de ouro do craque + CTA de indicação */}
        <div className="absolute inset-x-4 bottom-4 z-10 flex flex-col gap-3">
          {highlight && (
            <div className="relative ml-auto w-[150px] rotate-[3deg] bg-ouro-27 px-3 pb-2.5 pt-4 text-asfalto-27 shadow-[4px_6px_0_rgba(0,0,0,0.55)]">
              {/* Fita crepe segurando o post-it. */}
              <span aria-hidden className="absolute -top-2 left-4 h-4 w-16 -rotate-6 bg-cal/80" />
              <span className="block font-prova text-[10px] font-bold uppercase tracking-[0.16em]">— {highlight.label}</span>
              <span className="mt-1 block truncate font-voz text-[24px] leading-none">{highlight.name}</span>
              {highlight.detail && <span className="mt-1 block font-impact text-[20px] uppercase leading-none">{highlight.detail}</span>}
            </div>
          )}

          <a
            href={referralUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[48px] w-full items-center justify-center gap-2 bg-rua px-3 font-impact text-[18px] uppercase leading-none text-asfalto-27 no-underline shadow-[4px_4px_0_var(--color-papel)]"
          >
            {ctaLabel} <span aria-hidden>→</span>
          </a>
          <p className="truncate text-center font-prova text-[10px] font-bold tracking-[0.1em] text-papel/80">{displayUrl}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onShare}
        className="flex min-h-[52px] w-full max-w-[340px] items-center justify-center gap-2 border-2 border-papel px-4 font-impact text-[19px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rua"
      >
        <Share2 className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        {shared === 'done' ? L('Compartilhado', 'Shared') : shared === 'copied' ? L('Link copiado', 'Link copied') : L('Compartilhar momento', 'Share moment')}
      </button>
    </motion.div>
  );
}

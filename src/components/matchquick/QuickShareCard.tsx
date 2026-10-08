/**
 * QuickShareCard — card VIRAL do pós-jogo da Partida Rápida.
 *
 * Reúne as ideias de viralização orgânica num único pôster compartilhável
 * (estilo do ChampionShareCard da Liga Ole: banner estático + texto sobreposto
 * + Web Share da imagem real, sem compositing em canvas):
 *   • #1  Momento Imortal — manchete editorial do pico dramático
 *   • #8  Ficha do craque — chip do MVP
 *   • #9  Story strip — tira da forma recente (W/W/D)
 *   • #10 "1 em X" — selo de raridade estimada
 *   • #7  Compartilhar — Web Share API com link de indicação embutido
 *
 * O link de indicação viaja no texto: quem clica cai em /cadastro/<código>.
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { Share2, Star, Sparkles } from 'lucide-react';
import type { FormLetter } from '@/entities/types';
import type { QuickRarity } from '@/match/quickRarity';
import { rarityTierLabel } from '@/match/quickRarity';
import { shareImageWithText } from '@/lib/shareImage';
import { Hashtag } from '@/components/ui';
import { L } from '@/i18n/L';

interface Props {
  clubName: string;
  opponentName: string;
  homeScore: number;
  awayScore: number;
  result: 'win' | 'draw' | 'loss';
  rarity: QuickRarity;
  mvp?: { name: string; goals: number; rating: number } | null;
  /** Forma recente (mais recente por último) — vira a story strip. */
  form?: FormLetter[];
  referralCode: string | null;
}

// Forma é delta de jogo (+/−): alta/baixa só aqui; empate fica no papel.
const FORM_COLOR: Record<FormLetter, string> = {
  W: 'var(--color-alta)',
  D: 'var(--color-suave)',
  L: 'var(--color-baixa)',
};

export function QuickShareCard({
  clubName,
  opponentName,
  homeScore,
  awayScore,
  result,
  rarity,
  mvp,
  form,
  referralCode,
}: Props) {
  const [shared, setShared] = useState<'idle' | 'done' | 'copied'>('idle');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://game.olefoot.ai';
  const referralUrl = referralCode ? `${origin}/cadastro/${referralCode}` : `${origin}/cadastro`;
  const displayUrl = referralUrl.replace(/^https?:\/\//, '');

  const resWord = result === 'win' ? L('venci', 'won') : result === 'draw' ? L('empatei', 'drew') : L('perdi', 'lost');
  const shareMessage =
    L(`${rarity.headline} no Olefoot! ${clubName} ${homeScore}–${awayScore} ${opponentName} — ${resWord} ${rarity.tagline}.`, `${rarity.headline} on Olefoot! ${clubName} ${homeScore}–${awayScore} ${opponentName} — ${resWord} ${rarity.tagline}.`) +
    (rarity.oneInX >= 10 ? L(` Raridade estimada: 1 em ${rarity.oneInX} partidas.`, ` Estimated rarity: 1 in ${rarity.oneInX} matches.`) : '') +
    (mvp ? L(` Craque: ${mvp.name} (nota ${mvp.rating.toFixed(1)}).`, ` Star: ${mvp.name} (rating ${mvp.rating.toFixed(1)}).`) : '') +
    L(` Monta teu time e vem 👉 ${referralUrl}`, ` Build your team and join 👉 ${referralUrl}`);

  const onShare = async () => {
    const r = await shareImageWithText({
      imageUrl: '/banner-campeao-game-ole.png',
      text: shareMessage,
      fileName: 'olefoot-partida.png',
      title: rarity.headline,
    });
    if (r === 'shared') setShared('done');
    else if (r === 'fallback') setShared('copied');
  };

  const strip = (form ?? []).slice(-6);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4">
      <div
        className="relative w-full max-w-[340px] overflow-hidden border-[3px] border-rua bg-asfalto-27"
        style={{ aspectRatio: '9 / 16' }}
      >
        <img
          src="/banner-campeao-game-ole.png"
          alt={`${clubName} ${homeScore}–${awayScore} ${opponentName}`}
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover grayscale"
        />
        {/* Escurece a foto pra leitura (preto → transparente) — máscara, não enfeite. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(13,13,12,0.86) 0%, rgba(13,13,12,0.15) 26%, rgba(13,13,12,0) 42%, rgba(13,13,12,0.5) 62%, rgba(13,13,12,0.96) 100%)' }}
        />

        {/* Topo: selo de raridade + manchete do momento, colada como lambe */}
        <div className="absolute inset-x-4 top-6 z-10 flex flex-col items-start">
          {rarity.oneInX >= 10 && (
            <span className="mb-2 inline-flex items-center gap-1.5 bg-ouro-27 px-2.5 py-1 font-prova text-[10.5px] font-bold uppercase tracking-[0.12em] text-asfalto-27">
              <Sparkles className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              {rarityTierLabel(rarity.tier)} · {L('1 em', '1 in')} {rarity.oneInX}
            </span>
          )}
          <Hashtag className="mb-1.5 font-prova text-rua">{L('#partidarápida #olefoot', '#quickmatch #olefoot')}</Hashtag>
          <p
            className="-rotate-2 bg-cal px-2.5 pb-1 pt-1.5 font-impact uppercase text-asfalto-27"
            style={{ fontSize: 'clamp(26px, 8.5vw, 40px)', lineHeight: 1 }}
          >
            {rarity.headline}
          </p>
          <p className="mt-3 flex min-w-0 max-w-full items-baseline gap-2 font-impact uppercase text-papel" style={{ fontSize: '17px', lineHeight: 1 }}>
            <span className="min-w-0 truncate">{clubName}</span>
            <span className="shrink-0 font-spray font-black text-[30px] tabular-nums text-rua">{homeScore}×{awayScore}</span>
            <span className="min-w-0 truncate text-suave">{opponentName}</span>
          </p>
        </div>

        {/* Base: MVP + story strip + CTA de indicação */}
        <div className="absolute inset-x-4 bottom-4 z-10">
          {mvp && (
            <div className="mb-3 inline-flex max-w-full rotate-[2deg] items-center gap-2 bg-ouro-27 px-2.5 py-1.5 text-asfalto-27">
              <Star className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
              <span className="truncate font-voz text-[18px] leading-none">{mvp.name}</span>
              <span className="shrink-0 font-prova text-[11px] font-bold">{mvp.rating.toFixed(1)}</span>
            </div>
          )}

          {strip.length > 0 && (
            <div className="mb-3 flex items-center gap-1">
              <span className="mr-1 font-prova text-[9px] font-bold uppercase tracking-[0.18em] text-suave">{L('Forma', 'Form')}</span>
              {strip.map((f, idx) => (
                <span
                  key={idx}
                  className="grid h-[18px] w-[18px] place-items-center font-impact text-[10px] text-asfalto-27"
                  style={{ background: FORM_COLOR[f] }}
                >
                  {f}
                </span>
              ))}
            </div>
          )}

          <a
            href={referralUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[46px] w-full items-center justify-center gap-2 bg-rua font-impact text-[17px] uppercase leading-none text-asfalto-27 no-underline"
          >
            {L('Crie seu time agora', 'Create your team now')} <span aria-hidden>→</span>
          </a>
          <p className="mt-1.5 text-center font-prova text-[10px] text-rua">{displayUrl}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onShare}
        className="inline-flex min-h-[52px] w-full max-w-[340px] items-center justify-center gap-2 bg-rua px-6 font-impact text-[19px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--color-papel)]"
      >
        <Share2 className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        {shared === 'done' ? L('Compartilhado!', 'Shared!') : shared === 'copied' ? L('Link copiado!', 'Link copied!') : L('Compartilhar momento', 'Share moment')}
      </button>
    </motion.div>
  );
}

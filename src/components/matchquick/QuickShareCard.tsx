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

const MORET = 'var(--font-serif-hero)';

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

const FORM_COLOR: Record<FormLetter, string> = {
  W: 'var(--color-success)',
  D: 'var(--color-warning)',
  L: 'var(--color-danger)',
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
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://game.olefoot.com';
  const referralUrl = referralCode ? `${origin}/cadastro/${referralCode}` : `${origin}/cadastro`;
  const displayUrl = referralUrl.replace(/^https?:\/\//, '');

  const resWord = result === 'win' ? 'venci' : result === 'draw' ? 'empatei' : 'perdi';
  const shareMessage =
    `${rarity.headline} no Olefoot! ${clubName} ${homeScore}–${awayScore} ${opponentName} — ${resWord} ${rarity.tagline}.` +
    (rarity.oneInX >= 10 ? ` Raridade estimada: 1 em ${rarity.oneInX} partidas.` : '') +
    (mvp ? ` Craque: ${mvp.name} (nota ${mvp.rating.toFixed(1)}).` : '') +
    ` Monta teu time e vem 👉 ${referralUrl}`;

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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3">
      <div
        className="relative w-full max-w-[340px] overflow-hidden"
        style={{ borderRadius: 'var(--radius-md)', aspectRatio: '9 / 16', border: '2px solid rgba(201,162,39,0.55)', boxShadow: '0 12px 34px rgba(0,0,0,0.5)' }}
      >
        <img
          src="/banner-campeao-game-ole.png"
          alt={`${clubName} ${homeScore}–${awayScore} ${opponentName}`}
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
          {rarity.oneInX >= 10 && (
            <div
              className="inline-flex items-center gap-1.5 mb-2 px-2.5 py-1"
              style={{ borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(253,225,0,0.5)' }}
            >
              <Sparkles className="w-3 h-3 text-neon-yellow" strokeWidth={2.5} aria-hidden />
              <span style={{ color: 'var(--color-neon-yellow)', fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em' }}>
                {rarityTierLabel(rarity.tier).toUpperCase()} · 1 EM {rarity.oneInX}
              </span>
            </div>
          )}
          <p className="font-display uppercase mb-1" style={{ color: 'var(--color-neon-yellow)', fontSize: '10px', fontWeight: 800, letterSpacing: '0.26em' }}>
            Partida Rápida · Olefoot
          </p>
          <p style={{ color: '#f7ecd2', fontFamily: MORET, fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(30px, 10vw, 46px)', lineHeight: 0.9, letterSpacing: '-0.03em' }}>
            {rarity.headline}
          </p>
          <p className="mt-1.5 text-white" style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '15px' }}>
            {clubName} <span className="tabular-nums text-neon-yellow">{homeScore}–{awayScore}</span> {opponentName}
          </p>
        </div>

        {/* Base: MVP + story strip + CTA de indicação */}
        <div className="absolute inset-x-4 bottom-4 z-10">
          {mvp && (
            <div
              className="inline-flex items-center gap-2 mb-2.5 px-2.5 py-1.5"
              style={{ borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(253,225,0,0.4)' }}
            >
              <Star className="w-3.5 h-3.5 text-neon-yellow" strokeWidth={2.5} aria-hidden />
              <span style={{ color: '#f7ecd2', fontSize: '11px', fontWeight: 600 }}>
                Craque: <span className="text-white">{mvp.name}</span> · nota {mvp.rating.toFixed(1)}
              </span>
            </div>
          )}

          {strip.length > 0 && (
            <div className="flex items-center gap-1 mb-3">
              <span className="font-display uppercase text-white/55" style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '0.18em', marginRight: 2 }}>Forma</span>
              {strip.map((f, idx) => (
                <span
                  key={idx}
                  className="grid place-items-center font-display"
                  style={{ width: 16, height: 16, borderRadius: 4, background: FORM_COLOR[f], color: '#0b0b0b', fontSize: '9px', fontWeight: 900 }}
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
            className="flex items-center justify-center gap-2 w-full"
            style={{ padding: '11px', borderRadius: 'var(--radius-sm)', background: 'var(--color-neon-yellow)', color: '#1a1405', fontWeight: 800, fontSize: '13px', letterSpacing: '0.04em', textDecoration: 'none', fontFamily: 'var(--font-display)' }}
          >
            CRIE SEU TIME AGORA
          </a>
          <p className="mt-1.5 text-center" style={{ color: 'rgba(253,225,0,0.85)', fontSize: '10px' }}>{displayUrl}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onShare}
        className="flex items-center justify-center gap-2 w-full max-w-[340px] border"
        style={{ padding: '12px', borderRadius: 'var(--radius-sm)', borderColor: 'var(--color-neon-yellow)', backgroundColor: 'rgba(253,225,0,0.08)', color: 'var(--color-neon-yellow)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '12px', letterSpacing: '0.1em' }}
      >
        <Share2 className="w-4 h-4" strokeWidth={2.5} aria-hidden />
        {shared === 'done' ? 'COMPARTILHADO!' : shared === 'copied' ? 'LINK COPIADO!' : 'COMPARTILHAR MOMENTO'}
      </button>
    </motion.div>
  );
}

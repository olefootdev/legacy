/**
 * LigaOleBanner — banner cinematográfico da Liga Ole pra Home (slide do slider).
 *
 * Sistema editorial Olefoot (Legacy Tech): bloco AMARELO com watermark "OLE"
 * gigante, eyebrow Agency uppercase, headline Moret italic gigante (peso
 * emocional) e CTA preto em pílula. Clicar leva ao /liga-ole.
 */

import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Trophy, ChevronRight } from 'lucide-react';

const MORET = 'var(--font-serif-hero)';

export function LigaOleBanner() {
  const navigate = useNavigate();
  return (
    <motion.button
      type="button"
      onClick={() => navigate('/liga-ole')}
      whileTap={{ scale: 0.985 }}
      aria-label="Criar Liga Ole"
      className="relative w-full overflow-hidden bg-neon-yellow text-left px-6 py-6"
      style={{ borderRadius: 'var(--radius-md)', boxShadow: '0 12px 34px rgba(253,225,0,0.24)' }}
    >
      {/* Watermark cinematográfico */}
      <span aria-hidden className="absolute inset-0 grid place-items-center pointer-events-none select-none overflow-hidden">
        <span
          className="font-display font-black uppercase whitespace-nowrap text-black/[0.06]"
          style={{ fontSize: 'clamp(150px, 42vw, 340px)', lineHeight: 0.78, letterSpacing: '-0.03em' }}
        >
          OLE
        </span>
      </span>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-4 h-4 text-black" strokeWidth={2.5} aria-hidden />
          <span className="font-display uppercase tracking-[0.3em] text-[10px] font-black text-black/70">
            Mata-Mata
          </span>
        </div>

        <p
          className="text-black leading-[0.86]"
          style={{ fontFamily: MORET, fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(46px, 15vw, 72px)', letterSpacing: '-0.035em' }}
        >
          Liga Ole
        </p>

        <span aria-hidden className="block w-12 h-[3px] bg-black/80 mt-3 mb-3" />

        <div className="flex items-end justify-between gap-3">
          <p className="font-display uppercase tracking-[0.18em] text-[11px] font-black text-black/85 leading-snug">
            Mostre que você é o melhor
          </p>
          <span className="shrink-0 inline-flex items-center gap-1 bg-black text-neon-yellow font-display uppercase tracking-[0.16em] text-[11px] font-black px-4 py-2 rounded-full">
            Disputar <ChevronRight className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />
          </span>
        </div>
      </div>
    </motion.button>
  );
}

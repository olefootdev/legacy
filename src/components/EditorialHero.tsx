/**
 * EditorialHero — o cabeçalho das telas internas do Clube (Staff, Treino,
 * Academia). DS 2027 "Respeito é ouro".
 *
 * Asfalto, não amarelo: amarelo é só onde se age (degrau CORRE), e o hero é
 * leitura. Rótulo "— EYEBROW" em prova, título no grito (Anton) em papel,
 * subtítulo na voz (Pirata — nome do treinador, frase), dado em prova.
 *
 * `lambe` é o momento "rua" da tela: um adesivo de cal colado torto no canto,
 * com um dado real (nível, booster, reputação). Um por tela, não em tudo.
 *
 * `watermark` e `quote` seguem na assinatura por compatibilidade, mas não são
 * desenhados.
 */

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

interface EditorialHeroProps {
  /** @deprecated Não é mais desenhado. */
  watermark?: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** @deprecated Não é mais desenhado. */
  quote?: string;
  stats?: string;
  /** Ícone (lucide) — vira selo em contorno de rua ao lado do título. */
  icon?: ReactNode;
  /** Adesivo de cal colado torto (o momento "rua"). Dado real ou nada. */
  lambe?: { rotulo: string; valor: ReactNode };
}

export function EditorialHero({ eyebrow, title, subtitle, stats, icon, lambe }: EditorialHeroProps) {
  return (
    <section aria-label={title} className="relative w-full max-w-full min-w-0">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative flex min-w-0 items-start gap-4 pt-2"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="block min-w-0 truncate font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">
            — {eyebrow}
          </span>

          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <span
                aria-hidden
                className="hidden h-14 w-14 shrink-0 items-center justify-center border-2 border-rua text-rua sm:flex [&_svg]:h-7 [&_svg]:w-7"
              >
                {icon}
              </span>
            )}
            <h1 className="min-w-0 font-impact text-[clamp(52px,15vw,104px)] uppercase leading-[0.84] text-papel [overflow-wrap:anywhere]">
              {title}
            </h1>
          </div>

          {subtitle && <p className="min-w-0 font-voz text-[clamp(24px,7vw,34px)] leading-none text-papel">{subtitle}</p>}

          {stats && (
            <p className="font-prova text-[12px] font-bold uppercase tracking-[0.12em] text-mudo">{stats}</p>
          )}
        </div>

        {lambe && (
          <span className="mt-6 inline-flex shrink-0 rotate-[3deg] flex-col items-center bg-cal px-3 py-2 text-asfalto-27 shadow-[4px_4px_0_rgba(0,0,0,0.55)]">
            <span className="font-prova text-[9px] font-bold uppercase tracking-[0.2em]">{lambe.rotulo}</span>
            <span className="font-spray text-[clamp(26px,8vw,40px)] font-black leading-none">{lambe.valor}</span>
          </span>
        )}
      </motion.div>
    </section>
  );
}

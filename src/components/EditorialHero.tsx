/**
 * EditorialHero — o cabeçalho amarelo das telas internas do Clube
 * (Staff, Treino, Academia, Estruturas).
 *
 * ── Alinhado ao layer final (2026-08-01) ───────────────────────────────────
 * A versão anterior empilhava, nesta ordem, antes de qualquer dado útil:
 * watermark gigante do título atrás do próprio título, subtítulo em serifa
 * itálica do tamanho da manchete, régua decorativa, um ícone dentro de uma
 * caixa, e uma frase entre aspas. Cinco camadas de enfeite.
 *
 * O layer final é o oposto: eyebrow com risco, manchete em Anton, e o dado.
 * Três razões concretas para o corte:
 *   1. o watermark repetia a palavra que já estava escrita em cima dele — e
 *      sobre amarelo virava um borrão cinza;
 *   2. serifa itálica é assinatura de NOME DE LENDA, não de subtítulo;
 *   3. a frase entre aspas era decoração: nunca dizia nada que o manager já
 *      não soubesse.
 *
 * `watermark` e `quote` seguem na assinatura por compatibilidade, mas não são
 * mais desenhados — quem chama não quebra, e as props somem quando as páginas
 * pararem de passá-las.
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
  icon?: ReactNode;
}

export function EditorialHero({ eyebrow, title, subtitle, stats, icon }: EditorialHeroProps) {
  return (
    <section
      aria-label={title}
      className="relative w-full max-w-full min-w-0 overflow-hidden bg-neon-yellow -mx-3 sm:-mx-4 lg:-mx-8"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex items-center gap-4 px-4 sm:px-6 lg:px-8"
        style={{ paddingBlock: 'clamp(24px, 5vw, 44px)' }}
      >
        <div className="min-w-0 flex-1">
          <span className="ole-eyebrow-poster" data-on="yellow" style={{ fontSize: '12px' }}>
            {eyebrow}
          </span>

          <h1
            className="mt-2 font-impact uppercase"
            style={{
              color: 'var(--color-deep-black)',
              fontSize: 'clamp(40px, 11vw, 84px)',
              lineHeight: 0.84,
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h1>

          {subtitle && (
            <p
              className="mt-2 font-display font-black uppercase"
              style={{ fontSize: '12px', letterSpacing: '0.16em', color: 'rgba(13,13,13,0.7)' }}
            >
              {subtitle}
            </p>
          )}

          {stats && (
            <p
              className="mt-2.5"
              style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'rgba(13,13,13,0.62)' }}
            >
              {stats}
            </p>
          )}
        </div>

        {/* O ícone vira selo lateral: acompanha o título em vez de empurrar o
            conteúdo pra baixo. Some no mobile, onde o espaço é do texto. */}
        {icon && <div className="hidden flex-none sm:block">{icon}</div>}
      </motion.div>
    </section>
  );
}

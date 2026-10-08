import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

/**
 * Cartão de seção dos hubs (ClubHub, MarketHub, CompetitionHub, HelpHub).
 *
 * ── Alinhado ao layer final (2026-08-01) ───────────────────────────────────
 * A versão anterior ("Legacy Tech") pintava o trilho lateral com uma cor
 * DIFERENTE por categoria — e as páginas usavam esmeralda, violeta, ciano,
 * fúcsia, âmbar. Isso contraria a linguagem em dois pontos:
 *
 *   1. o trilho amarelo de 3px é assinatura de PERTENCIMENTO, não legenda de
 *      categoria — quando cada card tem a sua cor, o trilho não significa nada;
 *   2. hierarquia no layer final vem de UMA cor: o que importa fica amarelo, o
 *      resto fica escuro. Cinco cores diferentes dão peso igual a tudo, que é o
 *      mesmo que não dar peso a nada.
 *
 * Agora: trilho sempre amarelo, superfície `.ole-poster` (sombra dura clara,
 * raio 14px) e título em Anton. Para destacar UM card do hub existe
 * `destaque` — ele inverte pra bloco amarelo, do mesmo jeito que o líder do
 * ranking na Home.
 */
export function HubSectionCard({
  to,
  eyebrow,
  title,
  description,
  cta,
  delay = 0,
  meta,
  badge,
  destaque = false,
  external = false,
  onClick,
}: {
  key?: import('react').Key;
  to: string;
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  cta: ReactNode;
  delay?: number;
  /** Linha extra acima do CTA (ex.: "10 ativos · 3 favoritos"). */
  meta?: ReactNode;
  /** Badge no canto superior direito (ex.: "NOVO", "BETA", contador). */
  badge?: ReactNode;
  /** Inverte pra bloco amarelo. Use em NO MÁXIMO um card por hub. */
  destaque?: boolean;
  /** Link externo (abre em nova aba). */
  external?: boolean;
  onClick?: () => void;
}) {
  const className = [
    // VOLT2: sem pular no hover e sem trilho lateral — o card chapado muda a borda.
    'group relative isolate block h-full overflow-hidden transition-colors duration-200',
    destaque ? '' : 'ole-poster hover:border-neon-yellow',
  ].join(' ');

  const style = destaque
    ? ({
        borderRadius: 'var(--radius-poster)',
        background: 'var(--color-neon-yellow)',
      } as const)
    : ({ borderRadius: 'var(--radius-poster)' } as const);

  const tinta = destaque ? 'var(--color-deep-black)' : 'var(--color-giz)';
  const tintaFraca = destaque ? 'rgba(13,13,12,0.72)' : 'var(--color-suave)';
  const tintaEyebrow = destaque ? 'rgba(13,13,12,0.7)' : 'var(--color-mudo)';

  const inner = (
    <div className="relative flex h-full flex-col gap-4 p-5 pl-6">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate font-prova text-[11.5px] font-bold uppercase tracking-[0.16em]" style={{ color: tintaEyebrow }}>
          — {eyebrow}
        </span>
        {badge ? (
          <span
            className="inline-flex items-center font-prova font-bold uppercase"
            style={{
              padding: '4px 8px',
              fontSize: '10px',
              letterSpacing: '0.12em',
              background: destaque ? 'var(--color-deep-black)' : 'var(--color-neon-yellow)',
              color: destaque ? '#fff' : 'var(--color-deep-black)',
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>

      <h3
        className="font-impact uppercase transition-colors"
        style={{ fontSize: 'clamp(22px,5vw,30px)', lineHeight: 0.9, letterSpacing: '-0.01em', color: tinta }}
      >
        {title}
      </h3>

      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', lineHeight: 1.55, color: tintaFraca }}>
        {description}
      </p>

      {meta ? (
        <p
          className="font-prova font-bold uppercase"
          style={{ fontSize: '10.5px', letterSpacing: '0.14em', color: tintaEyebrow }}
        >
          {meta}
        </p>
      ) : null}

      <div className="mt-auto pt-1">
        {/* DS 2027: CTA chapado; fora do amarelo ganha a sombra dura de papel. */}
        <span
          className="inline-flex items-center gap-2 whitespace-nowrap font-impact text-[17px] uppercase leading-none transition-[transform,box-shadow] group-hover:-translate-x-0.5 group-hover:-translate-y-0.5"
          style={{
            minHeight: 44,
            padding: '0 18px',
            background: destaque ? 'var(--color-deep-black)' : 'var(--color-neon-yellow)',
            color: destaque ? 'var(--color-neon-yellow)' : 'var(--color-deep-black)',
            boxShadow: destaque ? 'none' : '4px 4px 0 var(--color-giz)',
          }}
        >
          {cta} <span aria-hidden>→</span>
        </span>
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      {external ? (
        <a href={to} target="_blank" rel="noopener noreferrer" className={className} style={style} onClick={onClick}>
          {inner}
        </a>
      ) : (
        <Link to={to} className={className} style={style} onClick={onClick}>
          {inner}
        </Link>
      )}
    </motion.div>
  );
}

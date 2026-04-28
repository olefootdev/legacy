/**
 * LegendActions — barra de ações sociais reutilizável.
 *
 * Foi pensada pra qualquer lenda: receber slug + nome, dispensa lógica
 * adicional. Inclui:
 *  - Curtir (coração)
 *  - Treinar com X (CTA dominante amarelo) → Store/Legacies focado
 *  - Compartilhar (URL pública)
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Share2, ChevronRight } from 'lucide-react';

interface LegendActionsProps {
  slug: string;
  name: string;
  liked: boolean;
  likeCount: number;
  onToggleLike: () => void;
  /** Slug usado pra destacar o card no Store (?legend={highlight}). */
  storeHighlightId?: string;
  /** Surface escura (default) ou clara (em hero amarelo). */
  variant?: 'on-yellow' | 'on-dark';
}

function formatLikes(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return (n / 1000).toFixed(0) + 'k';
}

export function LegendActions({
  slug,
  name,
  liked,
  likeCount,
  onToggleLike,
  storeHighlightId,
  variant = 'on-yellow',
}: LegendActionsProps) {
  const [shareFlash, setShareFlash] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/legend/${slug}`;
    const text = `Aprende com ${name} no Olefoot. Museu vivo do futebol.`;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: name, text, url });
        return;
      }
    } catch {
      /* user cancelled — fallback below */
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareFlash(true);
      window.setTimeout(() => setShareFlash(false), 1600);
    } catch {
      window.prompt('Copia o link:', url);
    }
  };

  const isYellow = variant === 'on-yellow';
  const ghostBtn = isYellow
    ? 'border-black/30 bg-black/5 text-black hover:bg-black/15 hover:border-black/50'
    : 'border-white/20 bg-white/[0.04] text-white/85 hover:bg-white/10 hover:border-white/40';
  const heartFillCls = liked
    ? 'fill-current text-[var(--color-danger)]'
    : isYellow
      ? 'text-black/65'
      : 'text-white/65';

  const trainHref = storeHighlightId
    ? `/mercado/loja?tab=legacies&legend=${storeHighlightId}`
    : `/mercado/loja?tab=legacies`;

  return (
    <div className="flex flex-col items-center gap-3 sm:gap-4">
      {/* CTA dominante */}
      <Link
        to={trainHref}
        className="inline-flex items-center gap-2 bg-black text-neon-yellow px-7 py-3 font-display font-black uppercase shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-all hover:bg-deep-black hover:scale-[1.02] active:scale-[0.98]"
        style={{
          fontSize: '13px',
          letterSpacing: '0.22em',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        Treinar com {name}
        <ChevronRight className="w-4 h-4" />
      </Link>

      {/* Linha de social: like + share */}
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleLike}
          aria-pressed={liked}
          aria-label={liked ? 'Descurtir' : 'Curtir'}
          className={`group inline-flex items-center gap-2 border px-4 py-2 font-display font-black uppercase transition-all hover:scale-[1.02] active:scale-[0.97] ${ghostBtn}`}
          style={{
            fontSize: '11px',
            letterSpacing: '0.22em',
            borderRadius: 'var(--radius-pill)',
          }}
        >
          <Heart
            className={`w-4 h-4 transition-transform ${heartFillCls} ${liked ? 'scale-110' : 'group-hover:scale-110'}`}
            strokeWidth={2.5}
          />
          <span className="tabular-nums">{formatLikes(likeCount)}</span>
        </button>

        <button
          type="button"
          onClick={() => void handleShare()}
          aria-label="Compartilhar"
          className={`relative inline-flex items-center gap-2 border px-4 py-2 font-display font-black uppercase transition-all hover:scale-[1.02] active:scale-[0.97] ${ghostBtn}`}
          style={{
            fontSize: '11px',
            letterSpacing: '0.22em',
            borderRadius: 'var(--radius-pill)',
          }}
        >
          <Share2 className="w-4 h-4" strokeWidth={2.5} />
          {shareFlash ? 'Link copiado!' : 'Compartilhar'}
        </button>
      </div>
    </div>
  );
}

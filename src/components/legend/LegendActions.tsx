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
    const text = `Aprenda com ${name} no Olefoot. Museu vivo do futebol.`;
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
      window.prompt('Copie o link:', url);
    }
  };

  const isYellow = variant === 'on-yellow';
  const ghostBtn = isYellow
    ? 'border-black/30 text-black hover:border-black'
    : 'border-white/30 text-white hover:border-white hover:bg-white/5';
  const heartFillCls = liked
    ? 'fill-current text-baixa'
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
        className="ole-num inline-flex h-[50px] max-w-full items-center gap-2 whitespace-nowrap bg-black px-6 text-[13px] uppercase text-neon-yellow transition-colors hover:bg-deep-black [--corte:12px] [clip-path:var(--clip-corte)]"
      >
        <span className="min-w-0 truncate">Treinar com {name}</span>
        <ChevronRight className="w-4 h-4 shrink-0" />
      </Link>

      {/* Linha de social: like + share */}
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleLike}
          aria-pressed={liked}
          aria-label={liked ? 'Descurtir' : 'Curtir'}
          className={`ole-num group inline-flex h-10 items-center gap-2 border px-4 text-[11px] uppercase transition-colors ${ghostBtn}`}
        >
          <Heart
            className={`w-4 h-4 ${heartFillCls}`}
            strokeWidth={2.5}
          />
          <span className="tabular-nums">{formatLikes(likeCount)}</span>
        </button>

        <button
          type="button"
          onClick={() => void handleShare()}
          aria-label="Compartilhar"
          className={`ole-num relative inline-flex h-10 items-center gap-2 whitespace-nowrap border px-4 text-[11px] uppercase transition-colors ${ghostBtn}`}
        >
          <Share2 className="w-4 h-4" strokeWidth={2.5} />
          {shareFlash ? 'Link copiado' : 'Compartilhar'}
        </button>
      </div>
    </div>
  );
}

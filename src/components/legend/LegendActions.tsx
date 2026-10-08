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
import { Heart, Share2 } from 'lucide-react';
import { L } from '@/i18n/L';

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
    const text = L(`Aprenda com ${name} no Olefoot. Museu vivo do futebol.`, `Learn from ${name} on Olefoot. A living football museum.`);
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
      window.prompt(L('Copie o link:', 'Copy the link:'), url);
    }
  };

  const isYellow = variant === 'on-yellow';
  // DS 2027: 'on-yellow' = sobre o OURO da lenda (o nome da prop ficou).
  const ghostBtn = isYellow
    ? 'border-2 border-asfalto-27 text-asfalto-27 hover:bg-asfalto-27 hover:text-ouro-27'
    : 'border-2 border-papel text-papel hover:bg-papel hover:text-asfalto-27';
  const heartFillCls = liked ? 'fill-current' : '';

  const trainHref = storeHighlightId
    ? `/mercado/loja?tab=legacies&legend=${storeHighlightId}`
    : `/mercado/loja?tab=legacies`;

  return (
    <div className="flex flex-col items-center gap-3 sm:gap-4">
      {/* CTA dominante */}
      <Link
        to={trainHref}
        className={`inline-flex min-h-[56px] max-w-full items-center gap-2 whitespace-nowrap px-7 font-impact text-[21px] uppercase leading-none transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 ${
          isYellow
            ? 'bg-asfalto-27 text-ouro-27 shadow-[5px_5px_0_var(--color-papel)]'
            : 'bg-rua text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)]'
        }`}
      >
        <span className="min-w-0 truncate">{L('Treinar com', 'Train with')} {name}</span>
        <span aria-hidden>→</span>
      </Link>

      {/* Linha de social: like + share */}
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleLike}
          aria-pressed={liked}
          aria-label={liked ? L('Descurtir', 'Unlike') : L('Curtir', 'Like')}
          className={`group inline-flex min-h-[44px] items-center gap-2 px-4 font-impact text-[16px] uppercase leading-none transition-colors ${ghostBtn}`}
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
          aria-label={L('Compartilhar', 'Share')}
          className={`relative inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap px-4 font-impact text-[16px] uppercase leading-none transition-colors ${ghostBtn}`}
        >
          <Share2 className="w-4 h-4" strokeWidth={2.5} />
          {shareFlash ? L('Link copiado', 'Link copied') : L('Compartilhar', 'Share')}
        </button>
      </div>
    </div>
  );
}

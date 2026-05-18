/**
 * AcademyCardDeliveryModal
 *
 * Abre quando o manager clica num item de inbox 'ACADEMY_CARD_DELIVERED'.
 * Mostra a carta do jogo + (se houver) o card promocional, com botões de
 * Compartilhar (Web Share API → Twitter/X intent fallback) e Baixar PNG.
 *
 * Roteamento: ativado via query string `?academyDelivery=<requestId>` em
 * /clube/elenco — quem aciona é o Team.tsx ao ler a queue.
 */
import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Share2, Download, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  playerName: string;
  portraitUrl?: string;
  promotionalUrl?: string;
  shareText: string;
}

async function downloadImageAs(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch {
    // Fallback: abre em nova aba se CORS bloqueia download direto
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function AcademyCardDeliveryModal({
  open,
  onClose,
  playerName,
  portraitUrl,
  promotionalUrl,
  shareText,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = promotionalUrl ?? portraitUrl;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Olefoot — ${playerName}`,
          text: shareText,
          url: url ?? window.location.origin,
        });
        return;
      } catch {
        // Cancelado pelo user ou não suportado — cai pra fallback
      }
    }
    // Fallback: abre Twitter/X intent
    const tweet = `${shareText}\n${url ?? ''}`.slice(0, 280);
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`,
      '_blank',
      'noopener,noreferrer',
    );
  }, [playerName, portraitUrl, promotionalUrl, shareText]);

  const handleCopy = useCallback(async () => {
    if (!navigator.clipboard) return;
    const url = promotionalUrl ?? portraitUrl ?? '';
    await navigator.clipboard.writeText(`${shareText}\n${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareText, portraitUrl, promotionalUrl]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 backdrop-blur-sm p-3">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative my-auto flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neon-yellow/40 bg-deep-black shadow-[0_0_60px_rgba(253,225,0,0.25)]"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neon-yellow/30 bg-neon-yellow/5 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.22em] text-neon-yellow/70">
                  Academia OLE · Entrega
                </p>
                <h3 className="font-display text-base font-black uppercase italic tracking-wide text-white">
                  🎁 {playerName}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <p className="mb-4 text-center text-[12px] leading-relaxed text-white/85">
                Tua carta foi feita à mão pela equipa Olefoot.
                {promotionalUrl
                  ? ' Aqui em baixo tens a versão do jogo e a versão promocional pra dividir nas redes.'
                  : ' Aproveita pra compartilhar nas tuas redes!'}
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Card do jogo */}
                {portraitUrl ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-center text-[10px] font-bold uppercase tracking-wider text-neon-yellow/85">
                      Carta no jogo
                    </p>
                    <div className="overflow-hidden rounded-lg border border-white/15 bg-black">
                      <img
                        src={portraitUrl}
                        alt={`Carta de ${playerName}`}
                        className="block w-full"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void downloadImageAs(portraitUrl, `olefoot-${playerName}-carta.png`)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/85 hover:bg-white/10"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Baixar carta
                    </button>
                  </div>
                ) : null}

                {/* Card promocional */}
                {promotionalUrl ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-center text-[10px] font-bold uppercase tracking-wider text-fuchsia-300">
                      Card promocional
                    </p>
                    <div className="overflow-hidden rounded-lg border border-fuchsia-500/30 bg-black">
                      <img
                        src={promotionalUrl}
                        alt={`Card promocional de ${playerName}`}
                        className="block w-full"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void downloadImageAs(promotionalUrl, `olefoot-${playerName}-promo.png`)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-fuchsia-500/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-fuchsia-200 hover:bg-fuchsia-500/10"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Baixar promocional
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Texto pré-formatado */}
              <div className="mt-5 rounded-lg border border-white/10 bg-black/50 p-3">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/50">
                  Texto pra postar
                </p>
                <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-white/85">
                  {shareText}
                </pre>
              </div>
            </div>

            {/* Bottom — share buttons */}
            <div className="shrink-0 space-y-2 border-t border-white/10 bg-black/50 px-4 py-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleShare()}
                  className="btn-primary inline-flex flex-1 items-center justify-center gap-2 px-4 py-2.5 font-display text-xs font-black uppercase tracking-wider"
                >
                  <Share2 className="h-4 w-4" />
                  Compartilhar
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 font-display text-xs font-black uppercase tracking-wider transition-colors',
                    copied
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                      : 'border-white/30 text-white/85 hover:bg-white/10',
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar texto
                    </>
                  )}
                </button>
              </div>
              <p className="text-center text-[10px] text-white/40">
                Web Share API no celular abre direto Instagram / X. No PC abre o Twitter/X.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

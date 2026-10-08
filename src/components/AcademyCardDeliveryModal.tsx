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
import { getSupabase } from '@/supabase/client';
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import { L } from '@/i18n/L';

interface Props {
  open: boolean;
  onClose: () => void;
  playerName: string;
  portraitUrl?: string;
  promotionalUrl?: string;
  shareText: string;
}

async function fetchBlobAndSave(blob: Blob, filename: string): Promise<void> {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

/**
 * Tenta baixar a imagem com fallback em camadas:
 *   1) fetch direto (funciona quando CORS do storage está aberto, ex.: Supabase Storage público)
 *   2) proxy /api/academy/download-promo (servidor faz fetch + força attachment)
 *   3) abre em nova aba (último recurso, manager precisa salvar manual)
 */
async function downloadImageAs(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await fetchBlobAndSave(await res.blob(), filename);
    return;
  } catch {
    // CORS bloqueou ou upstream falhou — tenta proxy do nosso backend
  }
  try {
    const sb = getSupabase();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    if (token) {
      const base = olefootApiBase();
      const proxyUrl = `${base}/api/academy/download-promo?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
      const res = await fetch(proxyUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        await fetchBlobAndSave(await res.blob(), filename);
        return;
      }
    }
  } catch {
    // Proxy falhou — último fallback abaixo
  }
  window.open(url, '_blank', 'noopener,noreferrer');
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-3">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative my-auto flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden border-2 border-linha bg-asfalto-27"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-linha px-4 py-3">
              <div className="min-w-0">
                <span className="font-prova text-[11px] font-bold text-mudo">{L('#academia #entrega', '#academy #delivery')}</span>
                <h3 className="truncate font-voz text-[30px] leading-none text-papel">
                  {playerName}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center border-2 border-linha text-mudo hover:border-papel hover:text-papel"
                aria-label={L('Fechar', 'Close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <p className="mb-5 font-impact text-[clamp(26px,7vw,36px)] uppercase leading-none text-papel">
                {L('Chegou. ', 'It landed. ')}<span className="font-voz normal-case text-suave">{L('Feita à mão pela equipe Olefoot.', 'Handmade by the Olefoot team.')}</span>
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Card do jogo */}
                {portraitUrl ? (
                  <div className="flex flex-col gap-2">
                    <p className="font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">
                      — {L('Carta no jogo', 'In-game card')}
                    </p>
                    {/* Carta colada torta como lambe — o momento "rua" da entrega. */}
                    <div className="-rotate-2 overflow-hidden bg-cal p-1.5 shadow-[6px_8px_0_rgba(0,0,0,0.55)]">
                      <img
                        src={portraitUrl}
                        alt={L(`Carta de ${playerName}`, `${playerName} card`)}
                        className="block w-full"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void downloadImageAs(portraitUrl, `olefoot-${playerName}-carta.png`)}
                      className="mt-2 inline-flex min-h-[44px] items-center justify-center gap-1.5 border-2 border-linha px-3 font-impact text-[15px] uppercase leading-none text-papel hover:border-papel"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {L('Baixar carta', 'Download card')}
                    </button>
                  </div>
                ) : null}

                {/* Card promocional */}
                {promotionalUrl ? (
                  <div className="flex flex-col gap-2">
                    <p className="font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">
                      — {L('Card promocional', 'Promo card')}
                    </p>
                    <div className="rotate-[1.5deg] overflow-hidden bg-cal p-1.5 shadow-[6px_8px_0_rgba(0,0,0,0.55)]">
                      <img
                        src={promotionalUrl}
                        alt={L(`Card promocional de ${playerName}`, `${playerName} promo card`)}
                        className="block w-full"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void downloadImageAs(promotionalUrl, `olefoot-${playerName}-promo.png`)}
                      className="mt-2 inline-flex min-h-[44px] items-center justify-center gap-1.5 border-2 border-linha px-3 font-impact text-[15px] uppercase leading-none text-papel hover:border-papel"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {L('Baixar promocional', 'Download promo')}
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Texto pré-formatado */}
              <div className="mt-6 border-l-[3px] border-fio bg-concreto p-3">
                <p className="mb-1 font-prova text-[10px] font-bold uppercase tracking-[0.18em] text-mudo">
                  — {L('Texto pra postar', 'Text to post')}
                </p>
                <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-papel">
                  {shareText}
                </pre>
              </div>
            </div>

            {/* Bottom — share buttons */}
            <div className="shrink-0 space-y-2 border-t-2 border-linha px-4 py-4 pr-5">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleShare()}
                  className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 bg-rua px-4 font-impact text-[19px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)]"
                >
                  <Share2 className="h-4 w-4" />
                  {L('Compartilhar', 'Share')} <span aria-hidden>→</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className={cn(
                    'inline-flex min-h-[52px] items-center justify-center gap-2 border-2 px-4 font-impact text-[17px] uppercase leading-none transition-colors',
                    copied
                      ? 'border-alta text-alta'
                      : 'border-papel text-papel hover:bg-papel hover:text-asfalto-27',
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      {L('Copiado!', 'Copied!')}
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      {L('Copiar texto', 'Copy text')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

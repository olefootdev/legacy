/**
 * Widget do Cloudflare Turnstile — o desafio anti-bot do envio de talento.
 *
 * POR QUE EXISTE: o envio é anônimo de propósito (clicar em ENVIAR finaliza o
 * cadastro; a conta vem na aprovação) e aceita foto de até 4 MB. Sem nenhuma
 * trava, um script enche a fila do OLE SCOUT e o bucket de fotos sem esforço.
 *
 * SÓ APARECE SE ESTIVER CONFIGURADO. Sem `VITE_TURNSTILE_SITE_KEY` o componente
 * não renderiza nada e o envio segue pelo caminho de sempre — assim o funil não
 * para enquanto o widget não é criado no painel da Cloudflare. Quando a chave
 * existir, o token passa a acompanhar o envio e o Worker valida antes de gravar.
 */
import { useEffect, useRef } from 'react';

const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim();
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Está ligado? A tela usa isto pra saber se deve exigir o token. */
export const turnstileAtivo = Boolean(SITE_KEY);

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function carregarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile indisponível'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const idRef = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY || !caixa.current) return;
    let vivo = true;

    void carregarScript()
      .then(() => {
        if (!vivo || !caixa.current || !window.turnstile) return;
        idRef.current = window.turnstile.render(caixa.current, {
          sitekey: SITE_KEY,
          theme: 'dark',
          language: 'pt-br',
          callback: (token: string) => onToken(token),
          // Token expirado ou desafio recusado zera o estado: quem envia sem
          // token cai no caminho direto, e é justamente o que não queremos
          // depois que a proteção existe.
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        });
      })
      .catch(() => {
        // Script bloqueado (adblock, rede corporativa): sem token, o envio
        // segue pelo caminho direto em vez de travar a pessoa fora do cadastro.
        onToken(null);
      });

    return () => {
      vivo = false;
      if (idRef.current && window.turnstile) {
        try {
          window.turnstile.remove(idRef.current);
        } catch {
          /* já removido */
        }
      }
    };
    // onToken vem estável da página (useCallback); re-render não recria o widget.
  }, [onToken]);

  if (!SITE_KEY) return null;
  return <div ref={caixa} className="mt-4" />;
}

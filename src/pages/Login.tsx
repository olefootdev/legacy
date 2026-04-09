import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * Ordem: SVG transparente primeiro (sem caixa cinza). PNG com fundo preto + `mix-blend-screen`
 * misturava com gradientes do hero e parecia “fundo cinza escuro”.
 */
const LOGO_URLS = ['/brand/olefoot-logo.svg', '/brand/olefoot-logo-yellow.png', '/olefoot-logo.png', '/logo-olefoot-header.png'] as const;

/**
 * Login — topo transparente (logo + chip sobre o hero); sem barra com fundo próprio.
 */
export function Login() {
  const [logoIndex, setLogoIndex] = useState(0);
  const showWordmark = logoIndex >= LOGO_URLS.length;

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-deep-black">
      <div
        className="absolute inset-0 z-0 scale-105 bg-cover bg-[center_22%] bg-no-repeat sm:bg-center"
        style={{ backgroundImage: 'url(/login-hero.png)' }}
        aria-hidden
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/88 via-black/35 to-black/90" aria-hidden />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/50 to-black/25 opacity-[0.96]" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_95%_60%_at_50%_75%,rgba(0,0,0,0.65),transparent_52%)]"
        aria-hidden
      />

      {/* Topo sem barra: logo + chip sobre o hero escuro (só sombras para legibilidade) */}
      <header
        role="banner"
        className="relative z-[100] w-full shrink-0 bg-transparent px-4 pb-2 pt-5 sm:px-6 sm:pb-3 sm:pt-6 md:px-8"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link
            to="/"
            className="flex min-w-0 flex-1 items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-yellow/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            aria-label="Olefoot — início"
          >
            {!showWordmark ? (
              <img
                src={LOGO_URLS[logoIndex]}
                alt="Olefoot"
                width={260}
                height={72}
                decoding="async"
                fetchPriority="high"
                className="h-10 w-auto max-h-11 max-w-[min(100%,280px)] object-contain object-left drop-shadow-[0_2px_16px_rgba(0,0,0,0.75)] sm:h-12 sm:max-h-[3.25rem]"
                onError={() => setLogoIndex((i) => i + 1)}
              />
            ) : (
              <span className="font-display text-xl font-bold uppercase tracking-tight text-neon-yellow [text-shadow:0_2px_16px_rgba(0,0,0,0.9)] sm:text-2xl">
                Olefoot
              </span>
            )}
          </Link>

          <button
            type="button"
            className={cn(
              'shrink-0 rounded-full border border-white/20 bg-black/35 px-4 py-2',
              'font-display text-[9px] font-bold uppercase tracking-[0.28em] text-white/95 sm:px-5 sm:text-[10px] sm:tracking-[0.32em]',
              'shadow-[0_4px_20px_rgba(0,0,0,0.45)] backdrop-blur-[6px] transition hover:border-white/35 hover:bg-black/45',
            )}
          >
            Manager de Futebol
          </button>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-5 pb-6 sm:px-8 sm:pb-8 md:px-10">
        <div className="min-h-[10vh] shrink-0 sm:min-h-[12vh] md:min-h-[14vh]" aria-hidden />

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-end">
          <div
            className={cn(
              'relative overflow-hidden rounded-sm border border-white/[0.1]',
              'bg-black/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_40px_rgba(0,0,0,0.45)]',
              'backdrop-blur-md',
            )}
          >
            <div className="absolute left-0 top-0 h-full w-1 bg-neon-yellow/90" aria-hidden />

            <div className="relative px-5 py-6 pl-6 sm:px-6 sm:py-7 sm:pl-7">
              <h1 className="font-display text-[clamp(1.65rem,6.8vw,2.65rem)] font-bold uppercase leading-[1.02] tracking-tight text-white [text-shadow:0_3px_28px_rgba(0,0,0,0.92)]">
                Mostre que você entende de <span className="text-neon-yellow">futebol</span>
              </h1>

              <p className="mt-4 font-sans text-sm font-medium leading-snug text-white/88 [text-shadow:0_2px_14px_rgba(0,0,0,0.85)] sm:text-base">
                Seja o maior Manager do mundo
              </p>
            </div>
          </div>

          <nav className="mt-8 flex w-full flex-col gap-3 sm:mt-10" aria-label="Acesso à conta">
            <Link to="/" className="btn-primary block w-full text-center">
              <span className="btn-primary-inner justify-center py-1">Entrar</span>
            </Link>
            <Link to="/cadastro" className="btn-secondary block w-full text-center">
              <span className="btn-secondary-inner justify-center py-1">Cadastrar</span>
            </Link>
            <Link
              to="/config"
              className="pt-1 text-center font-sans text-xs font-bold uppercase tracking-wide text-white/60 underline decoration-white/30 underline-offset-[6px] transition hover:text-neon-yellow hover:decoration-neon-yellow/45"
            >
              Esqueci Senha
            </Link>
          </nav>
        </div>

        <footer className="mx-auto mt-8 max-w-md text-center text-[10px] text-white/35 sm:mt-10 sm:text-[11px]">
          Olefoot © 2026 · Todos os direitos reservados
        </footer>
      </div>
    </div>
  );
}

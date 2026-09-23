/** Os poucos pedaços de UI que as duas telas dividem. VOLT2: chapado, 0 raio. */
import type { ReactNode } from 'react';

export const BOTAO_VOLT =
  'flex h-[52px] w-full items-center justify-center bg-neon-yellow px-4 font-num text-[13px] font-extrabold uppercase tracking-[0.04em] text-deep-black disabled:opacity-40';
export const BOTAO_LINHA =
  'flex h-[52px] w-full items-center justify-center border border-white/30 px-4 font-num text-[13px] font-extrabold uppercase tracking-[0.04em] text-white disabled:opacity-40';
export const CAMPO =
  'h-12 w-full border border-white/10 bg-panel px-3 font-mono text-[14px] text-white outline-none focus:border-neon-yellow';

export function Barra({ titulo, onVoltar }: { titulo: string; onVoltar?: () => void }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2.5 bg-nav px-4">
      {onVoltar && (
        <button type="button" onClick={onVoltar} aria-label="Voltar"
          className="flex h-8 w-8 items-center justify-center border border-white/15 text-white">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      )}
      <span className="font-display text-[16px] tracking-[0.02em]">{titulo}</span>
    </div>
  );
}

export function Aviso({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <div className="border-l-[3px] border-atencao bg-sheet px-3.5 py-3">
      {titulo && <p className="font-num text-[11px] font-extrabold uppercase tracking-[0.04em] text-atencao">{titulo}</p>}
      <p className="mt-1 text-[12px] leading-relaxed text-giz">{children}</p>
    </div>
  );
}

export const Logo = () => (
  <img src="/brand/olefoot-yellow-01.svg" alt="OLEFOOT" className="block h-[26px] w-[138px] shrink-0 self-start" />
);

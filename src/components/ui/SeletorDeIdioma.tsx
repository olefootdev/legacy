/**
 * PT | EN — a troca de idioma do jogo. Trocar recarrega a página (ver
 * `src/i18n/L.ts`): todo texto volta no idioma escolhido, inclusive o da engine.
 */
import { IDIOMAS } from '@/i18n/idioma';
import { idiomaDoJogo, trocarIdiomaDoJogo, L } from '@/i18n/L';

export function SeletorDeIdioma({ className = '' }: { className?: string }) {
  const atual = idiomaDoJogo();
  return (
    <div role="group" aria-label={L('Idioma', 'Language')} className={`inline-flex border border-white/16 ${className}`}>
      {IDIOMAS.map((i) => (
        <button
          key={i}
          type="button"
          aria-pressed={i === atual}
          onClick={() => trocarIdiomaDoJogo(i)}
          className={`px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.14em] ${
            i === atual ? 'bg-neon-yellow text-black' : 'text-cimento hover:text-white'
          }`}
        >
          {i}
        </button>
      ))}
    </div>
  );
}

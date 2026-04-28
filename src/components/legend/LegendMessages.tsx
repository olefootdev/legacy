/**
 * LegendMessages — feed de mensagens dos managers para a lenda.
 *
 * Composer + lista. Reaproveitável: passa o slug + nome.
 * O state vive no hook `useLegendSocial(slug)` (localStorage hoje;
 * Supabase quando as tabelas existirem).
 */
import { useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import type { LegendMessage } from '@/hooks/useLegendSocial';
import { useGameStore } from '@/game/store';

interface LegendMessagesProps {
  legendName: string;
  messages: LegendMessage[];
  onPost: (input: { managerName: string; managerInitials: string; message: string }) => void;
  onRemove?: (id: string) => void;
}

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  return new Date(ts).toLocaleDateString('pt-BR');
}

export function LegendMessages({ legendName, messages, onPost, onRemove }: LegendMessagesProps) {
  const profile = useGameStore((s) => s.userSettings.managerProfile);
  const club = useGameStore((s) => s.club);

  const managerName = useMemo(() => {
    const first = profile?.firstName?.trim();
    const last = profile?.lastName?.trim();
    return [first, last].filter(Boolean).join(' ').trim() || 'Manager Anônimo';
  }, [profile?.firstName, profile?.lastName]);

  const managerInitials = useMemo(() => {
    const first = profile?.firstName?.trim()?.[0] ?? '';
    const last = profile?.lastName?.trim()?.[0] ?? '';
    const fallback = club?.shortName?.trim()?.slice(0, 3) ?? '';
    return ((first + last) || fallback || 'M').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'M';
  }, [profile?.firstName, profile?.lastName, club?.shortName]);

  const [draft, setDraft] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onPost({ managerName, managerInitials, message: draft });
    setDraft('');
  };

  const remaining = 280 - draft.length;
  const tooLong = remaining < 0;

  return (
    <section
      aria-label={`Mural de mensagens para ${legendName}`}
      className="relative bg-deep-black py-10 sm:py-14"
    >
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        {/* Header editorial — Moret italic pra dar peso emocional */}
        <header className="flex items-center gap-3 mb-6">
          <span aria-hidden className="w-1 h-8 bg-neon-yellow" />
          <h2
            className="italic text-neon-yellow leading-none"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontWeight: 700,
              fontSize: 'clamp(28px, 4.5vw, 40px)',
              letterSpacing: '-0.02em',
            }}
          >
            Mural dos Managers
          </h2>
        </header>
        <p className="text-white/55 text-[13px] leading-relaxed mb-5 max-w-2xl">
          Deixa o teu recado pra {legendName}. As mensagens aparecem no museu pra
          todos os outros managers verem.
        </p>

        {/* Composer */}
        <form
          onSubmit={handleSubmit}
          className="border border-l-[3px] border-[var(--color-border)] border-l-neon-yellow bg-dark-gray p-4 sm:p-5 mb-6"
          style={{ borderRadius: 'var(--radius-md)' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="grid place-items-center h-9 w-9 bg-neon-yellow text-black font-display font-black uppercase shrink-0"
              style={{
                fontSize: '12px',
                letterSpacing: '0.04em',
                borderRadius: 'var(--radius-sm)',
              }}
              aria-hidden
            >
              {managerInitials}
            </div>
            <div className="min-w-0">
              <p
                className="text-white uppercase truncate font-display"
                style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.22em' }}
              >
                {managerName}
              </p>
              <p
                className="text-white/45 mt-0.5"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '10px',
                  letterSpacing: '0.04em',
                }}
              >
                Postando como tu mesmo
              </p>
            </div>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 320))}
            rows={3}
            placeholder={`Manda um recado pra ${legendName.split(' ')[0]}...`}
            className="w-full resize-none border border-white/15 bg-deep-black/60 px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-neon-yellow/55 focus:outline-none"
            style={{ borderRadius: 'var(--radius-sm)' }}
          />
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <span
              className={`tabular-nums ${tooLong ? 'text-[var(--color-danger)]' : 'text-white/40'}`}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.16em',
              }}
            >
              {remaining}/280
            </span>
            <button
              type="submit"
              disabled={!draft.trim() || tooLong}
              className="inline-flex items-center gap-2 bg-neon-yellow text-black font-display font-black uppercase px-5 py-2.5 transition-all hover:bg-white active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                fontSize: '11px',
                letterSpacing: '0.22em',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 4px 14px rgba(253,225,0,0.18)',
              }}
            >
              <Send className="w-3.5 h-3.5" strokeWidth={2.5} />
              Publicar
            </button>
          </div>
        </form>

        {/* Lista */}
        {messages.length === 0 ? (
          <div
            className="border border-dashed border-white/15 bg-deep-black/40 px-5 py-8 text-center"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            <p
              className="italic text-white/55"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontSize: '15px',
              }}
            >
              Sê o primeiro a deixar uma mensagem.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((msg) => (
              <li
                key={msg.id}
                className="border border-l-[3px] border-[var(--color-border)] border-l-white/15 bg-dark-gray p-4 transition-all hover:border-l-neon-yellow"
                style={{ borderRadius: 'var(--radius-md)' }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="grid place-items-center h-8 w-8 bg-deep-black border border-neon-yellow/45 text-neon-yellow font-display font-black uppercase shrink-0"
                    style={{
                      fontSize: '11px',
                      letterSpacing: '0.04em',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    aria-hidden
                  >
                    {msg.managerInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-white uppercase truncate font-display"
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        letterSpacing: '0.22em',
                      }}
                    >
                      {msg.managerName}
                    </p>
                    <p
                      className="text-white/40 mt-0.5"
                      style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '10px',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {timeAgo(msg.createdAt)}
                    </p>
                  </div>
                  {onRemove ? (
                    <button
                      type="button"
                      onClick={() => onRemove(msg.id)}
                      className="text-white/35 hover:text-[var(--color-danger)] transition-colors text-[10px] font-display font-bold uppercase tracking-widest"
                      aria-label="Remover mensagem"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <p
                  className="text-white/85 leading-relaxed whitespace-pre-line"
                  style={{ fontFamily: 'var(--font-sans)', fontSize: '13px' }}
                >
                  {msg.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

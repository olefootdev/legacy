/**
 * LegendMessages — feed de mensagens dos managers para a lenda.
 *
 * Composer + lista. Reaproveitável: passa o slug + nome.
 * O state vive no hook `useLegendSocial(slug)` (localStorage hoje;
 * Supabase quando as tabelas existirem).
 */
import { useMemo, useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import type { LegendMessage } from '@/hooks/useLegendSocial';
import { useGameStore } from '@/game/store';
import { L, LOCALE } from '@/i18n/L';

interface LegendMessagesProps {
  legendName: string;
  messages: LegendMessage[];
  onPost: (input: { managerName: string; managerInitials: string; message: string }) => void;
  onRemove?: (id: string) => void;
}

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return L('agora', 'now');
  if (mins < 60) return L(`há ${mins}m`, `${mins}m ago`);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return L(`há ${hours}h`, `${hours}h ago`);
  const days = Math.floor(hours / 24);
  if (days < 7) return L(`há ${days}d`, `${days}d ago`);
  return new Date(ts).toLocaleDateString(LOCALE);
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onPost({ managerName, managerInitials, message: draft });
    setDraft('');
  };

  const remaining = 150 - draft.length;
  const tooLong = remaining < 0;

  return (
    <section
      aria-label={L(`Mural de mensagens para ${legendName}`, `Message wall for ${legendName}`)}
      className="relative py-10 sm:py-14"
    >
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        {/* DS 2027: o mural é o muro — recado vira lambe de papel. */}
        <p className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">— {L('Mural dos managers', 'Managers wall')}</p>
        <h2 className="mt-1.5 font-voz leading-none text-papel" style={{ fontSize: 'clamp(40px, 10vw, 60px)' }}>
          {L('Deixa teu recado.', 'Leave your mark.')}
        </h2>
        <p className="mb-5 mt-2 truncate font-prova text-[12px] text-mudo">
          {L(`Recado pra ${legendName} · visível pra todos os managers`, `Message for ${legendName} · visible to all managers`)}
        </p>

        {/* Composer */}
        <form
          onSubmit={handleSubmit}
          className="mb-8 border-l-[5px] border-rua bg-concreto p-4 sm:p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-[3px] border-rua font-impact uppercase text-rua"
              style={{ fontSize: '14px' }}
              aria-hidden
            >
              {managerInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate font-voz text-[22px] leading-none text-papel">{managerName}</p>
              <p className="mt-1 font-prova text-[11px] text-mudo">
                {L('Postando como você', 'Posting as you')}
              </p>
            </div>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 180))}
            rows={3}
            placeholder={L(`Manda um recado pra ${legendName.split(' ')[0]}...`, `Send ${legendName.split(' ')[0]} a message...`)}
            className="w-full resize-none border-2 border-linha bg-black px-3 py-2.5 text-[15px] text-papel placeholder:text-fio focus:border-rua focus:outline-none"
          />
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <span
              className={`font-prova font-bold tabular-nums ${tooLong ? 'text-baixa' : 'text-mudo'}`}
              style={{ fontSize: '11.5px' }}
            >
              {remaining}/150
            </span>
            <button
              type="submit"
              disabled={!draft.trim() || tooLong}
              className="inline-flex min-h-[46px] items-center gap-2 bg-rua px-5 font-impact uppercase text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              style={{ fontSize: '18px' }}
            >
              <Send className="w-3.5 h-3.5" strokeWidth={2.5} />
              {L('Publicar', 'Post')}
            </button>
          </div>
        </form>

        {/* Lista */}
        {messages.length === 0 ? (
          <div className="border-2 border-dashed border-fio px-5 py-7">
            <p className="font-voz text-[28px] leading-none text-papel">{L('Muro limpo.', 'Clean wall.')}</p>
            <p className="mt-1.5 font-prova text-[12px] text-mudo">
              {L('Seja o primeiro a deixar uma mensagem.', 'Be the first to leave a message.')}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-5">
            {messages.map((msg, i) => (
              <li
                key={msg.id}
                className="bg-cal p-4 text-asfalto-27 shadow-[5px_5px_0_rgba(0,0,0,0.6)]"
                style={{ transform: `rotate(${[-1, 0.8, -0.4, 1.2][i % 4]}deg)` }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-asfalto-27 font-impact uppercase text-rua"
                    style={{ fontSize: '12px' }}
                    aria-hidden
                  >
                    {msg.managerInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-voz text-[20px] leading-none">{msg.managerName}</p>
                    <p className="mt-1 font-prova font-bold uppercase tracking-[0.1em]" style={{ fontSize: '10px' }}>
                      {timeAgo(msg.createdAt)}
                    </p>
                  </div>
                  {onRemove ? (
                    <button
                      type="button"
                      onClick={() => onRemove(msg.id)}
                      className="grid h-9 w-9 place-items-center font-impact text-[20px] text-asfalto-27 transition-colors hover:text-baixa"
                      aria-label={L('Remover mensagem', 'Remove message')}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <p
                  className="whitespace-pre-line font-medium leading-relaxed"
                  style={{ fontSize: '15px' }}
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

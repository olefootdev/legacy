import { useMemo } from 'react';
import { UserPlus, X } from 'lucide-react';
import { useFriendships } from '@/social/useFriendships';
import { FriendSearchBlock } from './manager/FriendSearchBlock';
import { SecaoRua, Hashtag, UmaLinha } from '@/components/ui';
import { L, LOCALE } from '@/i18n/L';

/**
 * Manager → Amigos. Só amizade entre managers.
 *
 * Era `/manager/network`, que misturava amizade com o plano de marketing antigo
 * (ativação de R$ 125, carreira com bônus em dólar, comissão de 5% em três
 * níveis, marcos em EXP). O fundador cancelou aquele plano em 2026-09-30: a
 * rede que paga é a EXPANSÃO, no NETWORK da carteira. Aqui fica o que é
 * social — buscar, convidar, aceitar.
 */
function desde(iso: string): string {
  try { return new Date(iso).toLocaleDateString(LOCALE, { day: '2-digit', month: 'short' }); }
  catch { return iso.slice(0, 10); }
}

export function ManagerAmigos() {
  const f = useFriendships();
  const ligados = useMemo(() => new Set<string>([
    ...f.data.friends.map((x) => x.managerId),
    ...f.data.incoming.map((x) => x.managerId),
    ...f.data.outgoing.map((x) => x.managerId),
  ]), [f.data]);

  const linha = 'flex min-w-0 items-center justify-between gap-3 border-b border-linha py-3 last:border-b-0';

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-7 px-4 pb-10 pt-6">
      <header className="flex min-w-0 items-end justify-between gap-3 border-b-2 border-papel pb-3">
        <div className="min-w-0">
          <Hashtag>{L('#manager #amigos', '#manager #friends')}</Hashtag>
          <h1 className="mt-1 font-impact uppercase leading-[0.9] text-papel" style={{ fontSize: 'clamp(48px, 14vw, 72px)' }}>
            {L('Amigos', 'Friends')}
          </h1>
        </div>
        <span className="shrink-0 font-spray font-black leading-none text-rua" style={{ fontSize: 'clamp(40px, 12vw, 64px)' }}>
          {f.data.friends.length}
        </span>
      </header>

      <FriendSearchBlock onInvite={f.invite} linkedIds={ligados} error={f.error} />

      {f.data.incoming.length > 0 && (
        <section className="flex flex-col gap-3">
          <SecaoRua label={L('Pedidos', 'Requests')} aside={f.data.incoming.length} />
          {f.data.incoming.map((p) => (
            <div key={p.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-l-[5px] border-rua bg-concreto px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <UserPlus aria-hidden className="h-5 w-5 shrink-0 text-rua" strokeWidth={2.2} />
                <UmaLinha className="font-voz text-[22px] leading-none text-papel">{p.clubName}</UmaLinha>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => void f.accept(p.id)}
                  className="min-h-[44px] bg-rua px-3.5 font-impact text-[16px] uppercase text-asfalto-27 shadow-[3px_3px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5">
                  {L('Aceitar', 'Accept')}
                </button>
                <button type="button" onClick={() => void f.decline(p.id)}
                  className="min-h-[44px] border-2 border-papel px-3.5 font-impact text-[16px] uppercase text-papel hover:bg-papel hover:text-asfalto-27">
                  {L('Recusar', 'Decline')}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SecaoRua label={L('Seus amigos', 'Your friends')} aside={f.loading ? undefined : f.data.friends.length} />
        {f.loading ? (
          <p className="font-prova text-[12px] text-mudo">{L('Carregando…', 'Loading…')}</p>
        ) : f.data.friends.length === 0 ? (
          // Vazio com saída: tracejado + frase na voz + o caminho.
          <div className="flex flex-col items-start gap-3 border-2 border-dashed border-fio px-4 py-5">
            <p className="font-voz text-[24px] leading-[1.05] text-papel">
              {L('Ninguém na tua roda ainda.', 'Nobody in your crew yet.')}
            </p>
            <p className="sr-only">{L('Nenhum amigo ainda. Busque um clube acima.', 'No friends yet. Search for a club above.')}</p>
            <a
              href="#buscar-manager"
              className="inline-flex min-h-[46px] items-center gap-2 border-2 border-papel px-4 font-impact text-[17px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27"
            >
              {L('Buscar um clube', 'Find a club')} <span aria-hidden>→</span>
            </a>
          </div>
        ) : (
          <ul className="flex flex-col">
            {f.data.friends.map((a) => (
              <li key={a.id} className={linha}>
                <UmaLinha className="font-voz text-[22px] leading-none text-papel">{a.clubName}</UmaLinha>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-prova text-[11px] uppercase text-mudo">{desde(a.since)}</span>
                  <button type="button" onClick={() => void f.remove(a.id)} aria-label={L(`Desfazer amizade com ${a.clubName}`, `Unfriend ${a.clubName}`)}
                    className="flex h-10 w-10 items-center justify-center text-mudo hover:text-papel">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {f.data.outgoing.length > 0 && (
        <section className="flex flex-col gap-2">
          <SecaoRua label={L('Convites enviados', 'Sent invites')} aside={f.data.outgoing.length} />
          <ul className="flex flex-col">
            {f.data.outgoing.map((p) => (
              <li key={p.id} className={linha}>
                <UmaLinha className="font-voz text-[20px] leading-none text-suave">{p.clubName}</UmaLinha>
                <button type="button" onClick={() => void f.remove(p.id)}
                  className="min-h-[40px] shrink-0 font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-mudo hover:text-papel">
                  {L('Cancelar', 'Cancel')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

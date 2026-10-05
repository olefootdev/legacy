import { useMemo } from 'react';
import { UserPlus, X } from 'lucide-react';
import { useFriendships } from '@/social/useFriendships';
import { FriendSearchBlock } from './manager/FriendSearchBlock';
import { SecaoVolt, Hashtag, UmaLinha } from '@/components/ui';
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

  return (
    <div className="mx-auto min-w-0 w-full max-w-3xl space-y-6 px-4 pb-10 pt-6">
      <div>
        <Hashtag>{L('#manager #amigos', '#manager #friends')}</Hashtag>
        <h1 className="mt-1 font-impact text-[34px] uppercase leading-[1.05] text-white">{L('Amigos', 'Friends')}</h1>
      </div>

      <FriendSearchBlock onInvite={f.invite} linkedIds={ligados} error={f.error} />

      {f.data.incoming.length > 0 && (
        <section className="space-y-3">
          <SecaoVolt label={L('Pedidos', 'Requests')} />
          {f.data.incoming.map((p) => (
            <div key={p.id} className="flex min-w-0 items-center justify-between gap-3 border border-white/10 bg-panel px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <UserPlus className="h-5 w-5 shrink-0 text-white" strokeWidth={2.2} />
                <UmaLinha className="text-[14px] font-semibold text-white">{p.clubName}</UmaLinha>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => void f.accept(p.id)}
                  className="ole-num bg-neon-yellow px-3 py-2 text-[11px] uppercase text-black hover:bg-white">
                  {L('Aceitar', 'Accept')}
                </button>
                <button type="button" onClick={() => void f.decline(p.id)}
                  className="ole-num border border-white/30 px-3 py-2 text-[11px] uppercase text-white hover:border-white">
                  {L('Recusar', 'Decline')}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <SecaoVolt label={L('Seus amigos', 'Your friends')} tone="neutro" />
        {f.loading ? (
          <p className="font-mono text-[12px] text-cimento">{L('Carregando…', 'Loading…')}</p>
        ) : f.data.friends.length === 0 ? (
          <p className="text-[13px] text-cimento">{L('Nenhum amigo ainda. Busque um clube acima.', 'No friends yet. Search for a club above.')}</p>
        ) : (
          <div className="border border-white/10 bg-panel">
            {f.data.friends.map((a) => (
              <div key={a.id} className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 last:border-b-0">
                <UmaLinha className="text-[14px] font-semibold text-white">{a.clubName}</UmaLinha>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-[10.5px] text-poeira">{desde(a.since)}</span>
                  <button type="button" onClick={() => void f.remove(a.id)} aria-label={L(`Desfazer amizade com ${a.clubName}`, `Unfriend ${a.clubName}`)}
                    className="p-1 text-cimento hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {f.data.outgoing.length > 0 && (
        <section className="space-y-3">
          <SecaoVolt label={L('Convites enviados', 'Sent invites')} tone="neutro" />
          <div className="border border-white/10 bg-panel">
            {f.data.outgoing.map((p) => (
              <div key={p.id} className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 last:border-b-0">
                <UmaLinha className="text-[13px] text-giz">{p.clubName}</UmaLinha>
                <button type="button" onClick={() => void f.remove(p.id)}
                  className="shrink-0 font-mono text-[10.5px] uppercase text-cimento hover:text-white">
                  {L('Cancelar', 'Cancel')}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

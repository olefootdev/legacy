import { useEffect, useState } from 'react';
import { L, emIngles } from '@/i18n/L';
import { convitePendente } from '@/supabase/expansaoConvite';

/**
 * Faixa fina no topo do login/cadastro quando a pessoa veio de um convite.
 *
 * Por que existe: o convite sobrevive no sessionStorage, mas a tela de login é
 * uma landing de venda — quem clicou no link de um amigo cai num anúncio sem
 * nenhum rastro de por que está ali. Tecnicamente funcionava; na prática a
 * pessoa desiste no meio e ninguém descobre por quê.
 */
export function FaixaConvitePendente() {
  const [username, setUsername] = useState<string | null>(null);
  useEffect(() => { setUsername(convitePendente()); }, []);
  if (!username) return null;

  return (
    <div className="flex min-w-0 items-center justify-center gap-2.5 bg-rua px-4 py-2.5 text-center text-asfalto-27">
      <span className="shrink-0 bg-asfalto-27 px-2 py-0.5 font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-rua">
        {L('Convite', 'Invite')}
      </span>
      <span className="min-w-0 truncate font-voz text-[19px] leading-none">
        {emIngles() ? <>@{username} is waiting for you</> : <>@{username} está te esperando</>}
      </span>
    </div>
  );
}

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
    <div className="flex items-center justify-center gap-2 bg-neon-yellow px-4 py-2.5 text-center">
      <span className="font-mono text-[10px] uppercase tracking-wider text-deep-black/70">
        {L('Convite', 'Invite')}
      </span>
      <span className="text-[12.5px] font-bold text-deep-black">
        {emIngles() ? <>@{username} is waiting for you</> : <>@{username} está te esperando</>}
      </span>
    </div>
  );
}

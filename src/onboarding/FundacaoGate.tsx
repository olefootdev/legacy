/**
 * Porta da Fundação do Clube: manager NOVO (sem jogadores, sem onboarding e
 * sem identidade) vai pra /fundacao antes de qualquer outra tela; quem fundou e
 * está sem elenco vai pro Ato 4 (/fundacao/elenco), que sorteia no servidor.
 *
 * Só decide depois que o elenco E o manager_game_state remoto chegaram (+1.5s
 * de folga, igual à cerimônia): senão mandaria pra fundação quem já fundou em
 * outro aparelho. Manager antigo NUNCA é forçado — ele vê o convite na Home.
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGameStateHydrationDone, useGameStore, useSquadHydrationDone } from '@/game/store';
import { isSupabaseConfigured } from '@/supabase/client';

const FORA_DA_PORTA = ['/fundacao', '/login', '/cadastro', '/reset-password', '/admin', '/playervip', '/token', '/legend'];

export function FundacaoGate() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const hasDoneOnboarding = useGameStore((s) => s.userSettings?.hasDoneOnboarding ?? false);
  const playersCount = useGameStore((s) => Object.keys(s.players ?? {}).length);
  const temIdentidade = useGameStore((s) => !!s.club?.identidade);
  const elenco = useSquadHydrationDone();
  const estado = useGameStateHydrationDone();
  const [assentou, setAssentou] = useState(false);

  useEffect(() => {
    if (!elenco || !estado) return;
    const t = setTimeout(() => setAssentou(true), 1500);
    return () => clearTimeout(t);
  }, [elenco, estado]);

  useEffect(() => {
    if (!assentou || !isSupabaseConfigured() || !managerProfile) return;
    if (playersCount > 0) return;
    if (FORA_DA_PORTA.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    // Fundou mas ainda não tem elenco (fechou no sorteio, ou perdeu o plantel):
    // o Ato 4 sorteia — o servidor devolve o mesmo sorteio se já existir.
    if (temIdentidade) {
      void navigate('/fundacao/elenco', { replace: true });
      return;
    }
    if (hasDoneOnboarding) return;
    navigate('/fundacao', { replace: true });
  }, [assentou, managerProfile, temIdentidade, hasDoneOnboarding, playersCount, pathname, navigate]);

  return null;
}

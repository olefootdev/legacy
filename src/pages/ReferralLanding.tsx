import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameDispatch, useGameStore } from '@/game/store';
import {
  normalizeReferralCode,
  isReservedInviteSegment,
  setPendingReferrerCode,
} from '@/wallet/referralCode';
import { isDevRegistrationBypassed } from '@/lib/devRegistrationBypass';

/**
 * Link curto olefoot.app/CÓDIGO — grava indicação pendente (cadastro) ou vincula patrocinador (uma vez).
 */
export function ReferralLanding() {
  const { inviteCode = '' } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const hasProfile = useGameStore((s) => !!s.userSettings?.managerProfile);
  const registered = isDevRegistrationBypassed() || hasProfile;
  const sponsorId = useGameStore((s) => s.finance.wallet?.sponsorId ?? null);
  const sponsorDispatchAttempted = useRef(false);

  useEffect(() => {
    sponsorDispatchAttempted.current = false;
  }, [inviteCode]);

  useEffect(() => {
    const raw = inviteCode.trim();
    if (isReservedInviteSegment(raw)) {
      navigate(`/${raw}`, { replace: true });
      return;
    }
    const norm = normalizeReferralCode(raw);
    if (!norm) {
      navigate('/', { replace: true });
      return;
    }

    if (!registered) {
      setPendingReferrerCode(norm);
      navigate('/cadastro', { replace: true });
      return;
    }
    if (!sponsorId && !sponsorDispatchAttempted.current) {
      sponsorDispatchAttempted.current = true;
      dispatch({ type: 'WALLET_SET_SPONSOR', sponsorId: norm });
    }
    navigate('/', { replace: true });
  }, [inviteCode, registered, sponsorId, navigate, dispatch]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-deep-black text-sm text-white/60">
      A abrir convite…
    </div>
  );
}

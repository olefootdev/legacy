import { useEffect, useState } from 'react';
import { L } from '@/i18n/L';
import { moedaDoJogo } from '@/wallet/constants';
import {
  applyLegacyOlefootCredit,
  hasShownLegacyToast,
  markLegacyToastShown,
} from '@/wallet/applyLegacyOlefootCredit';

function formatBalance(human: string): string {
  const n = Number(human);
  if (!Number.isFinite(n)) return human;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

/**
 * Toast de boas-vindas exibido uma única vez no primeiro login de usuário
 * migrado do Olefoot v1, mostrando o saldo OLEXP herdado da carteira BSC antiga.
 * Idempotente: o RPC marca credited_at; o flag local evita reabrir após dismiss.
 */
export function LegacyOlefootWelcomeToast() {
  const [balanceHuman, setBalanceHuman] = useState<string | null>(null);

  useEffect(() => {
    if (hasShownLegacyToast()) return;
    let cancelled = false;
    void applyLegacyOlefootCredit().then((claim) => {
      if (cancelled) return;
      if (claim.isFirstClaim && claim.balanceHuman) {
        setBalanceHuman(claim.balanceHuman);
      } else if (claim.alreadyClaimed) {
        markLegacyToastShown();
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!balanceHuman) return null;

  const dismiss = () => {
    markLegacyToastShown();
    setBalanceHuman(null);
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/85 px-4">
      <div className="relative w-full max-w-md border-t-[5px] border-rua bg-concreto p-6">
        <button
          onClick={dismiss}
          className="absolute right-3 top-3 text-mudo hover:text-papel text-xl leading-none"
          aria-label={L('Fechar', 'Close')}
        >
          ×
        </button>
        <div className="font-prova text-[11px] font-medium uppercase tracking-[0.2em] text-mudo">
          {L('Bem-vindo de volta', 'Welcome back')}
        </div>
        <div className="mt-2 font-impact text-[34px] uppercase leading-[0.95] text-papel">
          {L('Seu saldo da era anterior foi recuperado', 'Your balance from the previous era was recovered')}
        </div>
        <div className="mt-5 border-[3px] border-ouro-27 bg-asfalto-27 p-4">
          <div className="font-prova text-[10.5px] text-mudo uppercase tracking-wider">{L('Saldo', 'Balance')} {moedaDoJogo()}</div>
          <div className="mt-1 font-spray text-[36px] font-black leading-none text-ouro-27 tabular-nums">
            {formatBalance(balanceHuman)}
          </div>
          <div className="mt-1 font-prova text-[11px] text-mudo">
            ({balanceHuman} {moedaDoJogo()} — {L('snapshot da carteira BSC', 'BSC wallet snapshot')})
          </div>
        </div>
        <p className="mt-4 text-sm text-papel leading-relaxed">
          {L(
            'A carteira antiga foi desativada nessa versão. Seu saldo foi creditado off-chain na sua conta nova — disponível para usar no jogo.',
            'The old wallet was retired in this version. Your balance was credited off-chain to your new account — ready to use in the game.',
          )}
        </p>
        <button
          onClick={dismiss}
          className="btn-primary mt-5 w-full py-3 text-[15px] [--corte:12px]"
        >
          {L('Entendido', 'Got it')}
        </button>
      </div>
    </div>
  );
}

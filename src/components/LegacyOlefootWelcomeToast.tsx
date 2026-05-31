import { useEffect, useState } from 'react';
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
 * migrado do Olefoot v1, mostrando o saldo OLEFOOT herdado da carteira BSC antiga.
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
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="relative max-w-md w-full rounded-2xl border border-neon-yellow/40 bg-panel p-6 shadow-2xl">
        <button
          onClick={dismiss}
          className="absolute right-3 top-3 text-white/40 hover:text-white/80 text-xl leading-none"
          aria-label="Fechar"
        >
          ×
        </button>
        <div className="text-neon-yellow text-xs uppercase tracking-widest font-semibold">
          Bem-vindo de volta
        </div>
        <div className="mt-2 text-white text-xl font-bold leading-tight">
          Seu saldo da era anterior foi recuperado
        </div>
        <div className="mt-5 rounded-xl border border-white/10 bg-deep-black/60 p-4">
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Saldo OLEFOOT</div>
          <div className="mt-1 text-3xl font-bold text-neon-yellow tabular-nums">
            {formatBalance(balanceHuman)}
          </div>
          <div className="mt-1 text-[11px] text-white/40">
            ({balanceHuman} OLEFOOT — snapshot da carteira BSC)
          </div>
        </div>
        <p className="mt-4 text-sm text-white/70 leading-relaxed">
          A carteira antiga foi desativada nessa versão. Seu saldo foi creditado off-chain na sua
          conta nova — disponível para usar no jogo.
        </p>
        <button
          onClick={dismiss}
          className="mt-5 w-full rounded-xl bg-neon-yellow py-3 text-deep-black font-bold tracking-wide hover:bg-neon-yellow/90 transition"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

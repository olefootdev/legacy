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
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/85 px-4">
      <div className="relative max-w-md w-full border border-white/16 bg-panel p-6">
        <button
          onClick={dismiss}
          className="absolute right-3 top-3 text-white/40 hover:text-white/80 text-xl leading-none"
          aria-label="Fechar"
        >
          ×
        </button>
        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-cimento">
          Bem-vindo de volta
        </div>
        <div className="mt-2 font-impact text-2xl uppercase leading-[1.1] text-white">
          Seu saldo da era anterior foi recuperado
        </div>
        <div className="mt-5 border border-white/10 bg-card p-4">
          <div className="font-mono text-[10.5px] text-cimento uppercase tracking-wider">Saldo OLEFOOT</div>
          <div className="mt-1 font-mono text-3xl font-medium text-white tabular-nums">
            {formatBalance(balanceHuman)}
          </div>
          <div className="mt-1 font-mono text-[11px] text-poeira">
            ({balanceHuman} OLEFOOT — snapshot da carteira BSC)
          </div>
        </div>
        <p className="mt-4 text-sm text-white/70 leading-relaxed">
          A carteira antiga foi desativada nessa versão. Seu saldo foi creditado off-chain na sua
          conta nova — disponível para usar no jogo.
        </p>
        <button
          onClick={dismiss}
          className="btn-primary mt-5 w-full py-3 text-[15px] [--corte:12px]"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

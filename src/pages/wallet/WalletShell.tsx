import type { ReactNode } from 'react';
import { GameBannerBackdrop } from '@/components/GameBannerBackdrop';

import { WalletSpotToggle } from './WalletSpotToggle';
import { TradingViewEmbed } from './TradingViewEmbed';
import { WalletFaq } from './WalletFaq';

export type WalletShellAccount = 'spot' | 'olexp' | 'gat';

export function WalletShell({
  account,
  title,
  subtitle,
  children,
}: {
  account: WalletShellAccount;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto min-w-0 w-full max-w-3xl space-y-8 pb-28 md:pb-12">
      <WalletSpotToggle />

      <header className="relative min-w-0 overflow-x-hidden overflow-y-visible rounded-2xl border border-white/10 px-4 py-4">
        <GameBannerBackdrop slot="wallet_spot" imageOpacity={0.32} />
        <div className="relative z-10 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.22em] text-neon-yellow/90 font-display font-bold">
            Wallet Olefoot
          </p>
          <h1 className="text-2xl md:text-3xl font-display font-black text-white tracking-tight leading-tight">
            {title}
          </h1>
          {subtitle ? <p className="text-sm text-gray-400 max-w-xl leading-relaxed">{subtitle}</p> : null}
        </div>
      </header>

      {children}

      {account === 'olexp' ? (
        <section className="space-y-3 pt-4 border-t border-white/10">
          <h2 className="text-xs font-display font-bold uppercase tracking-widest text-gray-500">Mercado</h2>
          <TradingViewEmbed />
        </section>
      ) : null}

      <WalletFaq variant={account} />
    </div>
  );
}

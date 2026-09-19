import { useNavigate } from 'react-router-dom';
import type { WalletLedgerEntry, WalletLedgerType } from '@/wallet/types';
import { SecaoVolt } from '@/components/ui';

type ActivityStripProps = {
  ledger: WalletLedgerEntry[];
  limit?: number;
};

const TYPE_META: Record<WalletLedgerType, { label: string; icon: string }> = {
  SPOT_EXP: { label: 'Movimento EXP', icon: '◆' },
  SPOT_BRO: { label: 'Movimento USDT', icon: '◆' },
  REFERRAL_OLE_GAME: { label: 'Indicação OLE', icon: '◈' },
  REFERRAL_NFT: { label: 'Indicação NFT', icon: '◈' },
  TRANSFER: { label: 'Transferência', icon: '↗' },
  PURCHASE: { label: 'Compra', icon: '◉' },
  MATCH_REWARD: { label: 'Prêmio de partida', icon: '★' },
  STRUCTURE_UPGRADE: { label: 'Upgrade estrutura', icon: '⬡' },
};

function formatAmount(amount: number, currency: string): string {
  const positive = amount >= 0;
  const sign = positive ? '+' : '−';
  const abs = Math.abs(amount);
  const displayCurrency = currency === 'BRO' ? 'USDT' : currency;
  if (currency === 'BRO') {
    const usdt = (abs / 100).toFixed(2);
    return `${sign}${usdt} ${displayCurrency}`;
  }
  return `${sign}${abs.toLocaleString('pt-BR')} ${displayCurrency}`;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function ActivityStrip({ ledger, limit = 3 }: ActivityStripProps) {
  const navigate = useNavigate();

  const recent = [...ledger]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <SecaoVolt label="Atividade recente" tone="neutro" className="min-w-0 grow" />
        <button
          type="button"
          onClick={() => navigate('/wallet/extract')}
          className="shrink-0 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-cimento transition-colors hover:text-white"
        >
          Extrato →
        </button>
      </div>

      <div
        className="border border-white/10 bg-panel divide-y divide-white/[0.07]"
        style={{ borderRadius: 'var(--radius-card)' }}
      >
        {recent.length === 0 ? (
          <div className="p-5 text-center">
            <p className="text-[12px] text-cimento">Sem movimentações ainda</p>
          </div>
        ) : (
          recent.map((entry) => {
            const meta = TYPE_META[entry.type] ?? { label: entry.type, icon: '•' };
            const positive = entry.amount >= 0;
            return (
              <div key={entry.id} className="flex items-center gap-3 p-3 sm:p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-card-hi text-cimento text-[14px]">
                  {meta.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-white truncate">{meta.label}</p>
                  <p className="font-mono text-[10.5px] text-cimento">
                    {timeAgo(entry.createdAt)}
                    {entry.status !== 'confirmed' ? ` · ${entry.status}` : ''}
                  </p>
                </div>
                <p
                  className={`font-mono text-[13px] font-medium tabular-nums shrink-0 ${
                    positive ? 'text-alta' : 'text-giz'
                  }`}
                >
                  {formatAmount(entry.amount, entry.currency)}
                </p>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

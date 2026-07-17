import { useNavigate } from 'react-router-dom';
import type { WalletLedgerEntry, WalletLedgerType } from '@/wallet/types';

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
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.28em] text-neon-yellow/80">
            Atividade recente
          </p>
          <h2
            className="mt-1 font-display text-[22px] font-black uppercase leading-none tracking-tight text-white sm:text-[26px]"
            style={{ letterSpacing: '0.005em' }}
          >
            Últimas movimentações
          </h2>
        </div>
        <button
          type="button"
          onClick={() => navigate('/wallet/extract')}
          className="text-[10px] font-display font-bold uppercase tracking-[0.2em] text-white/55 hover:text-neon-yellow transition-colors"
        >
          Ver extrato →
        </button>
      </div>

      <div
        className="border border-white/[0.06] divide-y divide-white/[0.04]"
        style={{
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-panel-elevated,#0b0b0b)',
        }}
      >
        {recent.length === 0 ? (
          <div className="p-5 text-center">
            <p className="text-[12px] text-white/55">
              Sem movimentações ainda. Suas próximas transações aparecem aqui.
            </p>
          </div>
        ) : (
          recent.map((entry) => {
            const meta = TYPE_META[entry.type] ?? { label: entry.type, icon: '•' };
            const positive = entry.amount >= 0;
            return (
              <div key={entry.id} className="flex items-center gap-3 p-3 sm:p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/40 ring-1 ring-white/[0.05] text-neon-yellow text-[14px]">
                  {meta.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-white truncate">{meta.label}</p>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">
                    {timeAgo(entry.createdAt)}
                    {entry.status !== 'confirmed' ? ` · ${entry.status}` : ''}
                  </p>
                </div>
                <p
                  className={`text-[13px] font-bold tabular-nums shrink-0 ${
                    positive ? 'text-neon-green' : 'text-red-400'
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

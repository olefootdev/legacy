import { useNavigate } from 'react-router-dom';
import type { WalletLedgerEntry, WalletLedgerType } from '@/wallet/types';
import { SecaoVolt } from '@/components/ui';
import { L, LOCALE } from '@/i18n/L';

type ActivityStripProps = {
  ledger: WalletLedgerEntry[];
  limit?: number;
};

const TYPE_META: Record<WalletLedgerType, { label: string; icon: string }> = {
  SPOT_EXP: { label: L('Movimento EXP', 'EXP movement'), icon: '◆' },
  SPOT_BRO: { label: L('Movimento BRO', 'BRO movement'), icon: '◆' },
  REFERRAL_OLE_GAME: { label: L('Indicação OLE', 'OLE referral'), icon: '◈' },
  REFERRAL_NFT: { label: L('Indicação NFT', 'NFT referral'), icon: '◈' },
  TRANSFER: { label: L('Transferência', 'Transfer'), icon: '↗' },
  PURCHASE: { label: L('Compra', 'Purchase'), icon: '◉' },
  MATCH_REWARD: { label: L('Prêmio de partida', 'Match reward'), icon: '★' },
  STRUCTURE_UPGRADE: { label: L('Upgrade estrutura', 'Facility upgrade'), icon: '⬡' },
};

function formatAmount(amount: number, currency: string): string {
  const positive = amount >= 0;
  const sign = positive ? '+' : '−';
  const abs = Math.abs(amount);
  // BRO é crédito do jogo, não Tether — o rótulo "USDT" era resto do nome antigo.
  const displayCurrency = currency;
  if (currency === 'BRO') {
    const usdt = (abs / 100).toFixed(2);
    return `${sign}${usdt} ${displayCurrency}`;
  }
  return `${sign}${abs.toLocaleString(LOCALE)} ${displayCurrency}`;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return L('agora', 'now');
  if (min < 60) return L(`há ${min}min`, `${min}min ago`);
  const h = Math.floor(min / 60);
  if (h < 24) return L(`há ${h}h`, `${h}h ago`);
  const d = Math.floor(h / 24);
  if (d < 7) return L(`há ${d}d`, `${d}d ago`);
  return new Date(iso).toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit' });
}

export function ActivityStrip({ ledger, limit = 3 }: ActivityStripProps) {
  const navigate = useNavigate();

  const recent = [...ledger]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <SecaoVolt label={L('Atividade recente', 'Recent activity')} tone="neutro" className="min-w-0 grow" />
        <button
          type="button"
          onClick={() => navigate('/wallet/extract')}
          className="shrink-0 font-impact text-[16px] uppercase text-rua transition-colors hover:text-papel"
        >
          {L('Extrato →', 'Statement →')}
        </button>
      </div>

      <div className="divide-y-2 divide-linha">
        {recent.length === 0 ? (
          <div className="flex flex-col items-start gap-1 border-2 border-dashed border-fio p-5">
            <p className="font-voz text-[26px] leading-none text-papel">{L('Nada rolou ainda.', 'Nothing yet.')}</p>
            <p className="font-prova text-[12px] text-mudo">{L('Joga uma partida e o prêmio cai aqui.', 'Play a match and the prize lands here.')}</p>
          </div>
        ) : (
          recent.map((entry) => {
            const meta = TYPE_META[entry.type] ?? { label: entry.type, icon: '•' };
            const positive = entry.amount >= 0;
            return (
              <div key={entry.id} className="flex min-h-[60px] items-center gap-3 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-linha text-[14px] text-suave">
                  {meta.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-prova text-[13px] text-papel">{meta.label}</p>
                  <p className="font-prova text-[11px] text-mudo">
                    {timeAgo(entry.createdAt)}
                    {entry.status !== 'confirmed' ? ` · ${entry.status}` : ''}
                  </p>
                </div>
                <p
                  className={`shrink-0 font-impact text-[19px] leading-none tabular-nums ${
                    positive ? 'text-rua' : 'text-papel'
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

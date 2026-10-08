import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGameStore } from '@/game/store';

import { queryLedger } from '@/wallet/ledger';
import { createInitialWalletState } from '@/wallet/initial';
import type { WalletLedgerType, WalletCurrencyExt, WalletLedgerEntry } from '@/wallet/types';
import { moedaDoJogo } from '@/wallet/constants';
import { BotaoRua, SecaoRua } from '@/components/ui/Rua';
import { cn } from '@/lib/utils';
import { L, LOCALE } from '@/i18n/L';

const LEDGER_TYPE_OPTIONS: { value: WalletLedgerType | ''; label: string }[] = [
  { value: '', label: L('Todos', 'All') },
  { value: 'SPOT_EXP', label: 'SPOT EXP' },
  { value: 'SPOT_BRO', label: 'SPOT BRO' },
  { value: 'REFERRAL_OLE_GAME', label: 'Referral OLE' },
  { value: 'REFERRAL_NFT', label: 'Referral NFT' },
  { value: 'MATCH_REWARD', label: 'Match Reward' },
  { value: 'PURCHASE', label: L('Compra', 'Purchase') },
  { value: 'TRANSFER', label: L('Transferência', 'Transfer') },
  { value: 'STRUCTURE_UPGRADE', label: L('Estrutura', 'Facility') },
];

// Função, não const de módulo: `moedaDoJogo()` depende do idioma, e uma lista
// avaliada no import congelaria o rótulo de quem troca de idioma na sessão.
const currencyOptions = (): { value: WalletCurrencyExt | ''; label: string }[] => [
  { value: '', label: L('Todas', 'All') },
  { value: 'BRO', label: 'BRO' },
  { value: 'EXP', label: 'EXP' },
  { value: 'OLEFOOT', label: moedaDoJogo() },
];

/**
 * Status em palavra, não em bolinha colorida (DS 2027: verde/vermelho é só
 * delta). Confirmado não diz nada — é o normal; o resto aparece na linha.
 */
function statusTexto(status: string): string | null {
  if (status === 'confirmed') return null;
  if (status === 'pending') return L('pendente', 'pending');
  return status;
}

function formatLedgerDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return iso.slice(0, 10);
  }
}

/** Rótulo legível do tipo — o mesmo da lista de filtros. */
const rotuloDoTipo = (t: WalletLedgerType): string => LEDGER_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;

// DS 2027: select em concreto, rótulo em A PROVA; o foco é ação (rua).
const SELECT =
  'min-h-[46px] w-full min-w-0 appearance-none border-2 border-linha bg-concreto px-3 font-prova text-[12px] font-bold uppercase tracking-[0.1em] text-papel transition-colors focus:border-rua focus:outline-none';

/**
 * Extrato completo — a lista MOVIMENTO do DS 2027 (peça 3b): uma linha por
 * lançamento, entrada (+) em rua, saída (−) em papel, meta em A PROVA.
 */
export function ExtractTab() {
  const finance = useGameStore((s) => s.finance);
  const wallet = finance.wallet ?? createInitialWalletState();

  const [filterType, setFilterType] = useState<WalletLedgerType | ''>('');
  const [filterCurrency, setFilterCurrency] = useState<WalletCurrencyExt | ''>('');

  const entries: WalletLedgerEntry[] = queryLedger(wallet, {
    ...(filterType ? { type: filterType } : {}),
    ...(filterCurrency ? { currency: filterCurrency } : {}),
  });

  const sorted = [...entries].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  const filtrando = filterType !== '' || filterCurrency !== '';

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-8 px-4 pb-28 sm:px-8 md:pb-12">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/wallet"
            className="inline-flex min-h-[44px] items-center gap-2 font-prova text-[12px] font-bold uppercase tracking-[0.16em] text-mudo transition-colors hover:text-papel"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.4} /> {L('Carteira', 'Wallet')}
          </Link>
          <span className="inline-flex shrink-0 items-center gap-1.5 font-prova text-[11.5px] font-bold uppercase tracking-[0.2em] text-mudo">
            Solana <span aria-hidden className="text-ouro-27">●</span>
          </span>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex min-w-0 flex-col gap-1.5 border-b-[3px] border-ouro-27 pb-5"
        >
          <p className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">— {L('#extrato', '#statement')}</p>
          <h1 className="font-voz text-[clamp(52px,14vw,92px)] leading-[0.92] text-papel">{L('Extrato Completo', 'Full statement')}</h1>
        </motion.div>
      </div>

      {/* Filtros */}
      <div className="space-y-3">
        <SecaoRua label={L('Filtrar', 'Filter')} aside={`${sorted.length} ${L('registros', 'entries')}`} />
        <div className="grid grid-cols-2 gap-2.5">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as WalletLedgerType | '')}
            aria-label={L('Tipo', 'Type')}
            className={SELECT}
          >
            {LEDGER_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-asfalto-27">
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={filterCurrency}
            onChange={(e) => setFilterCurrency(e.target.value as WalletCurrencyExt | '')}
            aria-label={L('Moeda', 'Currency')}
            className={SELECT}
          >
            {currencyOptions().map((o) => (
              <option key={o.value} value={o.value} className="bg-asfalto-27">
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Movimento */}
      <section className="space-y-2">
        <SecaoRua label={L('Movimento', 'Activity')} />
        {sorted.length === 0 ? (
          <div className="flex flex-col items-start gap-3 border-2 border-dashed border-fio p-5">
            <p className="font-voz text-[clamp(28px,8vw,36px)] leading-none text-papel">{L('Nada por aqui.', 'Nothing here.')}</p>
            <p className="font-prova text-[12px] text-mudo">{L('Nenhuma transação encontrada.', 'No transactions found.')}</p>
            {filtrando ? (
              <BotaoRua
                variante="contorno"
                onClick={() => { setFilterType(''); setFilterCurrency(''); }}
                className="min-h-[46px] px-5 text-[18px]"
              >
                {L('Limpar filtros', 'Clear filters')} <span aria-hidden>→</span>
              </BotaoRua>
            ) : (
              <BotaoRua to="/" className="mt-1">
                {L('Bora jogar', "Let's play")} <span aria-hidden>→</span>
              </BotaoRua>
            )}
          </div>
        ) : (
          <div className="divide-y-2 divide-linha">
            {sorted.map((entry) => {
              const entrou = entry.amount >= 0;
              const st = statusTexto(entry.status);
              return (
                <div key={entry.id} className="flex min-h-[64px] min-w-0 items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-prova text-[13px] text-papel">{entry.source}</div>
                    <div className="mt-0.5 truncate font-prova text-[11px] text-mudo">
                      {formatLedgerDate(entry.createdAt)} · {rotuloDoTipo(entry.type)}
                      {st ? <span className="text-suave"> · {st}</span> : null}
                    </div>
                  </div>
                  <div
                    className={cn(
                      'shrink-0 whitespace-nowrap font-impact text-[19px] leading-none tabular-nums',
                      entrou ? 'text-rua' : 'text-papel',
                    )}
                  >
                    {entry.currency === 'EXP'
                      ? `${entry.amount < 0 ? '-' : '+'}${Math.abs(entry.amount).toLocaleString(LOCALE)}`
                      : `${entry.amount >= 0 ? '+' : ''}${(entry.amount / 100).toFixed(2)}`}
                    <span className="ml-1 font-prova text-[10.5px] font-bold text-mudo">
                      {entry.currency}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

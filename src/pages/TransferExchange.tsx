import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import { formatExp, formatBroFromCents } from '@/systems/economy';
import {
  EXP_EXCHANGE_MAX_LOT,
  EXP_EXCHANGE_MIN_BRO_CENTS,
  EXP_EXCHANGE_MIN_LOT,
} from '@/economy/expExchange';
import type { ExpExchangeOrder } from '@/economy/expExchange';

function broInputToCents(s: string): number | null {
  const t = s.replace(',', '.').trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function TransferExchange() {
  const dispatch = useGameDispatch();
  const club = useGameStore((s) => s.club);
  const ole = useGameStore((s) => s.finance.ole);
  const broCents = useGameStore((s) => s.finance.broCents);
  const expExchange = useGameStore((s) => s.expExchange);

  const [expDraft, setExpDraft] = useState('50000');
  const [broDraft, setBroDraft] = useState('5');
  const [announceErr, setAnnounceErr] = useState<string | null>(null);
  const [announcePending, setAnnouncePending] = useState<{ expAmount: number; broCents: number } | null>(null);
  const [buyTarget, setBuyTarget] = useState<ExpExchangeOrder | null>(null);

  const allOrders = useMemo(
    () => [...expExchange.playerOrders, ...expExchange.npcOrders],
    [expExchange.npcOrders, expExchange.playerOrders],
  );

  const sortedOrders = useMemo(() => {
    return [...allOrders].sort((a, b) => {
      const ta = new Date(a.createdAtIso).getTime();
      const tb = new Date(b.createdAtIso).getTime();
      return tb - ta;
    });
  }, [allOrders]);

  const tryOpenAnnounceConfirm = () => {
    setAnnounceErr(null);
    const expAmount = Math.round(Number(expDraft.replace(/\s/g, '')) || 0);
    const broC = broInputToCents(broDraft);
    if (broC == null || broC < EXP_EXCHANGE_MIN_BRO_CENTS) {
      setAnnounceErr(`Indica um preço mínimo de ${(EXP_EXCHANGE_MIN_BRO_CENTS / 100).toFixed(2)} BRO.`);
      return;
    }
    if (expAmount < EXP_EXCHANGE_MIN_LOT || expAmount > EXP_EXCHANGE_MAX_LOT) {
      setAnnounceErr(
        `EXP por lote: entre ${formatExp(EXP_EXCHANGE_MIN_LOT)} e ${formatExp(EXP_EXCHANGE_MAX_LOT)}.`,
      );
      return;
    }
    if (ole < expAmount) {
      setAnnounceErr('Saldo EXP insuficiente para este lote.');
      return;
    }
    setAnnouncePending({ expAmount, broCents: broC });
  };

  const confirmAnnounce = () => {
    if (!announcePending) return;
    dispatch({
      type: 'EXP_EXCHANGE_ANNOUNCE_SELL',
      expAmount: announcePending.expAmount,
      broCents: announcePending.broCents,
    });
    setAnnouncePending(null);
    setExpDraft('50000');
    setBroDraft('5');
  };

  const confirmBuy = () => {
    if (!buyTarget) return;
    if (buyTarget.kind !== 'npc') return;
    if (broCents < buyTarget.broCents) return;
    dispatch({ type: 'EXP_EXCHANGE_BUY', orderId: buyTarget.id });
    setBuyTarget(null);
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-6 pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/transfer"
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-display text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Mercado
        </Link>
        <h1 className="font-display text-xl font-black uppercase tracking-wide text-white sm:text-2xl">
          Exchange EXP ↔ BRO
        </h1>
      </div>

      <p className="text-[11px] leading-relaxed text-gray-500 sm:text-xs">
        Anuncia lotes de EXP pelo preço em BRO (referência USDT). Ordens da rede são preenchidas na hora; anúncios do teu
        clube ficam visíveis até cancelares ou até outro manager comprar quando a ligação P2P estiver activa.
      </p>

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/40 p-4">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Saldo EXP</div>
          <div className="mt-1 font-display text-lg font-black text-neon-yellow">{formatExp(ole)}</div>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Saldo BRO</div>
          <div className="mt-1 font-display text-lg font-black text-white">{formatBroFromCents(broCents)}</div>
        </div>
      </div>

      <section className="sports-panel space-y-4 border border-neon-yellow/25 bg-dark-gray p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-neon-yellow" aria-hidden />
          <h2 className="font-display text-sm font-black uppercase tracking-wide text-white">Anunciar venda de EXP</h2>
        </div>
        <p className="text-[10px] text-gray-500">
          O montante em EXP é reservado logo após anunciar. Cancelar devolve o EXP ao saldo.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-gray-400" htmlFor="ex-exp">
              Quantidade EXP
            </label>
            <input
              id="ex-exp"
              type="number"
              min={EXP_EXCHANGE_MIN_LOT}
              max={EXP_EXCHANGE_MAX_LOT}
              value={expDraft}
              onChange={(e) => setExpDraft(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 font-display text-sm font-bold text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-gray-400" htmlFor="ex-bro">
              Preço pedido (BRO)
            </label>
            <input
              id="ex-bro"
              type="text"
              inputMode="decimal"
              placeholder="ex.: 12,50"
              value={broDraft}
              onChange={(e) => setBroDraft(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 font-display text-sm font-bold text-white placeholder:text-gray-600"
            />
          </div>
        </div>
        {announceErr ? <p className="text-[11px] text-red-300">{announceErr}</p> : null}
        <button
          type="button"
          onClick={tryOpenAnnounceConfirm}
          className="w-full rounded-lg border border-neon-yellow/50 bg-neon-yellow/15 py-3 font-display text-xs font-black uppercase tracking-wider text-neon-yellow transition-colors hover:bg-neon-yellow/25"
        >
          PUBLICAR ORDEM
        </button>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-sm font-black uppercase tracking-wide text-white">
            Livro de EXP anunciado
          </h2>
          <p className="mt-1 text-[11px] text-gray-500">
            Ofertas dos managers vendendo EXP em troca de BRO. Cada linha mostra
            <strong className="text-neon-yellow"> quanto EXP</strong> está à venda e
            <strong className="text-white"> por quanto BRO</strong> no total. Compra só com saldo BRO suficiente.
          </p>
        </div>
        <ul className="space-y-2">
          {sortedOrders.map((o) => {
            const isOwnPlayer = o.kind === 'player' && o.sellerClubId === club.id;
            const isOtherPlayer = o.kind === 'player' && o.sellerClubId !== club.id;
            const canBuyNpc = o.kind === 'npc';
            const expPerBro = o.broCents > 0 ? Math.round(o.expAmount / (o.broCents / 100)) : 0;
            return (
              <li
                key={o.id}
                className="flex min-w-0 flex-col gap-2 rounded-xl border border-white/10 bg-black/35 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-black uppercase text-white truncate">{o.teamName}</span>
                    {isOwnPlayer ? (
                      <span className="shrink-0 rounded border border-neon-green/50 bg-neon-green/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-neon-green">
                        Teu clube
                      </span>
                    ) : o.kind === 'npc' ? (
                      <span className="shrink-0 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-400">
                        Oferta NPC
                      </span>
                    ) : (
                      <span className="shrink-0 rounded border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-cyan-200">
                        Clube rival
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-gray-500">Vendendo</p>
                      <p className="font-mono font-bold text-neon-yellow">{formatExp(o.expAmount)} EXP</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-gray-500">Pede</p>
                      <p className="font-mono font-bold text-white">{formatBroFromCents(o.broCents)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-gray-500">Taxa</p>
                      <p className="font-mono text-gray-400">{expPerBro.toLocaleString('pt-BR')} EXP/BRO</p>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {isOwnPlayer ? (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'EXP_EXCHANGE_CANCEL_SELL', orderId: o.id })}
                      className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wider text-gray-300 hover:bg-white/10"
                    >
                      Cancelar
                    </button>
                  ) : null}
                  {canBuyNpc ? (
                    <button
                      type="button"
                      onClick={() => setBuyTarget(o)}
                      disabled={broCents < o.broCents}
                      className={cn(
                        'rounded-lg border px-4 py-2 font-display text-[10px] font-black uppercase tracking-wider',
                        broCents < o.broCents
                          ? 'cursor-not-allowed border-white/10 bg-white/5 text-gray-600'
                          : 'border-neon-green/50 bg-neon-green/20 text-neon-green hover:bg-neon-green/30',
                      )}
                      title={broCents < o.broCents ? 'Saldo BRO insuficiente' : 'Comprar EXP'}
                    >
                      Comprar
                    </button>
                  ) : null}
                  {isOtherPlayer ? (
                    <span className="self-center rounded border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-bold uppercase text-gray-500">
                      P2P · em breve
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        {sortedOrders.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/30 py-8 text-center">
            <p className="font-display text-sm font-bold uppercase tracking-wider text-white/70">
              Livro vazio
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              Nenhuma oferta de EXP no momento. Use o formulário acima pra anunciar o teu EXP em troca de BRO.
            </p>
          </div>
        ) : null}
      </section>

      <AnimatePresence>
        {announcePending ? (
          <div
            className="fixed inset-0 z-50 flex min-h-0 items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm sm:px-6"
            style={{
              paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))',
              paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
              paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="ex-announce-title"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="max-h-[min(32rem,85dvh)] w-full max-w-md overflow-y-auto overscroll-y-contain rounded-2xl border border-neon-yellow/45 bg-[#0d0d0d] p-5 shadow-[0_0_40px_rgba(234,255,0,0.14)] [-webkit-overflow-scrolling:touch]"
            >
              <div className="mb-4 flex items-start justify-between gap-2">
                <h3 id="ex-announce-title" className="font-display text-base font-black uppercase text-neon-yellow">
                  Confirmar anúncio
                </h3>
                <button
                  type="button"
                  onClick={() => setAnnouncePending(null)}
                  className="rounded-lg p-1 text-gray-500 hover:bg-white/10 hover:text-white"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm leading-relaxed text-gray-300">
                Você está anunciando{' '}
                <span className="font-display font-bold text-neon-yellow">{formatExp(announcePending.expAmount)}</span>{' '}
                EXP por{' '}
                <span className="font-display font-bold text-white">
                  {(announcePending.broCents / 100).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>{' '}
                BRO.
              </p>
              <p className="mt-2 text-[11px] text-gray-500">
                O EXP fica reservado até venderes ou cancelares o anúncio.
              </p>
              <button
                type="button"
                onClick={confirmAnnounce}
                className="mt-5 w-full rounded-xl border border-neon-yellow/55 bg-neon-yellow py-3 font-display text-sm font-black uppercase tracking-wider text-black transition-colors hover:bg-white"
              >
                CONFIRMAR ANÚNCIO
              </button>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {buyTarget && buyTarget.kind === 'npc' ? (
          <div
            className="fixed inset-0 z-50 flex min-h-0 items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm sm:px-6"
            style={{
              paddingTop: 'max(1.5rem, env(safe-area-inset-top, 0px))',
              paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
              paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="ex-buy-title"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="max-h-[min(32rem,85dvh)] w-full max-w-md overflow-y-auto overscroll-y-contain rounded-2xl border border-neon-green/40 bg-[#0d0d0d] p-5 shadow-[0_0_40px_rgba(0,255,102,0.12)] [-webkit-overflow-scrolling:touch]"
            >
              <div className="mb-4 flex items-start justify-between gap-2">
                <h3 id="ex-buy-title" className="font-display text-base font-black uppercase text-white">
                  Confirmar compra
                </h3>
                <button
                  type="button"
                  onClick={() => setBuyTarget(null)}
                  className="rounded-lg p-1 text-gray-500 hover:bg-white/10 hover:text-white"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-gray-400">
                <span className="font-bold text-white">{buyTarget.teamName}</span> — recebes{' '}
                <span className="text-neon-yellow">{formatExp(buyTarget.expAmount)} EXP</span> por{' '}
                <span className="text-white">{formatBroFromCents(buyTarget.broCents)}</span>.
              </p>
              {broCents < buyTarget.broCents ? (
                <p className="mt-3 text-[11px] text-red-300">Saldo BRO insuficiente.</p>
              ) : null}
              <button
                type="button"
                onClick={confirmBuy}
                disabled={broCents < buyTarget.broCents}
                className={cn(
                  'mt-5 w-full rounded-xl py-3 font-display text-sm font-black uppercase tracking-wider',
                  broCents < buyTarget.broCents
                    ? 'cursor-not-allowed bg-white/10 text-gray-500'
                    : 'bg-neon-green text-black hover:bg-white',
                )}
              >
                Confirmar compra
              </button>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

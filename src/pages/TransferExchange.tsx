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
import { BackButton } from '@/components/BackButton';

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
      <BackButton to="/mercado" label="Mercado" />
      {/* Top bar — back link compacto (assinatura /legend) */}
      <div className="flex items-center justify-between">
        <Link
          to="/transfer"
          className="inline-flex items-center gap-2 text-white/65 hover:text-neon-yellow transition-colors"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Mercado
        </Link>
        <span
          className="text-white/35 uppercase"
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '10px',
            letterSpacing: '0.22em',
          }}
        >
          OLE Football · Exchange
        </span>
      </div>

      {/* Mini-hero editorial — eyebrow + headline duo + régua */}
      <header className="text-center pt-2 pb-2">
        <div className="ole-eyebrow !text-neon-yellow mb-4">
          <span>Câmbio do mercado</span>
        </div>
        <h1 className="leading-[0.95]">
          <span
            className="block font-bold uppercase text-white"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.25rem, 6vw, 3.5rem)',
              letterSpacing: '0.005em',
            }}
          >
            EXP <span className="text-neon-yellow">↔</span> BRO
          </span>
          <span
            className="block italic text-neon-yellow mt-1"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontWeight: 400,
              fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
              letterSpacing: '-0.01em',
            }}
          >
            câmbio paralelo
          </span>
        </h1>
        <span aria-hidden className="mx-auto mt-5 block w-12 h-[3px] bg-neon-yellow" />
        <p
          className="mx-auto mt-5 max-w-xl text-white/55"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            lineHeight: 1.55,
          }}
        >
          Anuncia lotes de EXP pelo preço em BRO (referência USDT). Ordens da rede são preenchidas na hora;
          anúncios do teu clube ficam visíveis até cancelares ou até outro manager comprar.
        </p>
      </header>

      {/* Saldos — números editoriais (Moret italic) */}
      <div
        className="grid grid-cols-2 divide-x divide-[var(--color-border)] border border-[var(--color-border)] bg-dark-gray"
        style={{ borderRadius: 'var(--radius-md)' }}
      >
        {([
          { label: 'Saldo EXP', value: formatExp(ole), accent: true },
          { label: 'Saldo BRO', value: formatBroFromCents(broCents), accent: false },
        ] as const).map((s) => (
          <div key={s.label} className="px-5 py-4">
            <p
              className="text-white/55 uppercase"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '10px',
                letterSpacing: '0.22em',
                fontWeight: 600,
              }}
            >
              {s.label}
            </p>
            <p
              className={cn('mt-1.5 italic tabular-nums leading-none', s.accent ? 'text-neon-yellow' : 'text-white')}
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontWeight: 700,
                fontSize: 'clamp(1.6rem, 3.5vw, 2.25rem)',
                letterSpacing: '-0.02em',
              }}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <section
        className="space-y-4 border border-[var(--color-border)] bg-dark-gray p-5 sm:p-6"
        style={{ borderRadius: 'var(--radius-md)' }}
      >
        {/* Section header — padrão ▍ TÍTULO */}
        <div className="flex items-center gap-3">
          <span aria-hidden className="w-[3px] h-7 bg-neon-yellow shrink-0" />
          <div className="min-w-0">
            <h2
              className="text-neon-yellow uppercase"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.18em',
              }}
            >
              Anunciar venda de EXP
            </h2>
            <p
              className="mt-0.5 text-white/45"
              style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', lineHeight: 1.5 }}
            >
              O montante em EXP é reservado logo após anunciar. Cancelar devolve ao saldo.
            </p>
          </div>
          <ArrowLeftRight className="h-4 w-4 text-white/30 ml-auto shrink-0" aria-hidden />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {([
            {
              id: 'ex-exp',
              label: 'Quantidade EXP',
              value: expDraft,
              setValue: setExpDraft,
              type: 'number' as const,
              extra: { min: EXP_EXCHANGE_MIN_LOT, max: EXP_EXCHANGE_MAX_LOT },
              placeholder: '',
            },
            {
              id: 'ex-bro',
              label: 'Preço pedido (BRO)',
              value: broDraft,
              setValue: setBroDraft,
              type: 'text' as const,
              extra: { inputMode: 'decimal' as const },
              placeholder: 'ex.: 12,50',
            },
          ]).map((f) => (
            <div key={f.id}>
              <label
                className="mb-1.5 block text-[var(--color-neon-yellow)] uppercase"
                htmlFor={f.id}
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '10px',
                  letterSpacing: '0.22em',
                  fontWeight: 600,
                }}
              >
                {f.label}
              </label>
              <input
                id={f.id}
                type={f.type}
                value={f.value}
                placeholder={f.placeholder}
                onChange={(e) => f.setValue(e.target.value)}
                className="w-full border border-[var(--color-border)] bg-black/55 px-3 py-2 text-white placeholder:text-white/30 outline-none focus:border-neon-yellow transition-colors"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '14px',
                  borderRadius: 'var(--radius-sm)',
                }}
                {...(f.extra as Record<string, unknown>)}
              />
            </div>
          ))}
        </div>

        {announceErr ? (
          <p
            className="text-[var(--color-danger)]"
            style={{ fontFamily: 'var(--font-sans)', fontSize: '12px' }}
          >
            {announceErr}
          </p>
        ) : null}

        <button
          type="button"
          onClick={tryOpenAnnounceConfirm}
          className="w-full bg-neon-yellow py-3 text-black hover:bg-white hover:scale-[1.005] active:scale-[0.995] transition-all"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}
        >
          Publicar ordem
        </button>
      </section>

      <section className="space-y-4">
        {/* Section header — padrão ▍ TÍTULO */}
        <div className="flex items-center gap-3">
          <span aria-hidden className="w-[3px] h-7 bg-neon-yellow shrink-0" />
          <div className="min-w-0">
            <h2
              className="text-neon-yellow uppercase"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.18em',
              }}
            >
              Livro de EXP
            </h2>
            <p
              className="mt-0.5 text-white/45"
              style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', lineHeight: 1.5 }}
            >
              Ofertas vendendo EXP em troca de BRO. Compra só com saldo BRO suficiente.
            </p>
          </div>
        </div>

        <ul className="space-y-2">
          {sortedOrders.map((o) => {
            const isOwnPlayer = o.kind === 'player' && o.sellerClubId === club.id;
            const isOtherPlayer = o.kind === 'player' && o.sellerClubId !== club.id;
            const canBuyNpc = o.kind === 'npc';
            const expPerBro = o.broCents > 0 ? Math.round(o.expAmount / (o.broCents / 100)) : 0;
            const tagMeta = isOwnPlayer
              ? { label: 'Teu clube', cls: 'border-[var(--color-success)] text-[var(--color-success)]' }
              : o.kind === 'npc'
                ? { label: 'NPC', cls: 'border-[var(--color-border)] text-white/55' }
                : { label: 'Rival', cls: 'border-neon-yellow/45 text-neon-yellow' };
            return (
              <li
                key={o.id}
                className="flex min-w-0 flex-col gap-3 border border-[var(--color-border)] bg-dark-gray p-4 transition-colors hover:border-neon-yellow/30 sm:flex-row sm:items-center sm:justify-between"
                style={{ borderRadius: 'var(--radius-md)' }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="truncate text-white uppercase"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '14px',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {o.teamName}
                    </span>
                    <span
                      className={cn('shrink-0 inline-flex items-center border px-2 py-0.5 uppercase', tagMeta.cls)}
                      style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '9px',
                        fontWeight: 600,
                        letterSpacing: '0.2em',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      {tagMeta.label}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-3">
                    {([
                      { label: 'Vendendo', value: `${formatExp(o.expAmount)}`, suffix: 'EXP', accent: true, muted: false },
                      { label: 'Pede', value: formatBroFromCents(o.broCents), suffix: '', accent: false, muted: false },
                      { label: 'Taxa', value: expPerBro.toLocaleString('pt-BR'), suffix: 'EXP/BRO', accent: false, muted: true },
                    ] as const).map((c) => (
                      <div key={c.label}>
                        <p
                          className="text-white/45 uppercase"
                          style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: '9px',
                            letterSpacing: '0.22em',
                            fontWeight: 600,
                          }}
                        >
                          {c.label}
                        </p>
                        <p
                          className={cn(
                            'mt-1 italic tabular-nums leading-none',
                            c.accent ? 'text-neon-yellow' : c.muted ? 'text-white/65' : 'text-white',
                          )}
                          style={{
                            fontFamily: 'var(--font-serif-hero)',
                            fontWeight: 600,
                            fontSize: '15px',
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {c.value}
                          {c.suffix ? (
                            <span
                              className="ml-1 not-italic text-white/45"
                              style={{
                                fontFamily: 'var(--font-ui)',
                                fontSize: '9px',
                                letterSpacing: '0.18em',
                                textTransform: 'uppercase',
                              }}
                            >
                              {c.suffix}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {isOwnPlayer ? (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'EXP_EXCHANGE_CANCEL_SELL', orderId: o.id })}
                      className="border border-[var(--color-border)] bg-deep-black px-4 py-2 text-white/75 hover:border-neon-yellow/60 hover:text-neon-yellow transition-colors"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '10px',
                        fontWeight: 700,
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        borderRadius: 'var(--radius-sm)',
                      }}
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
                        'px-5 py-2 transition-all',
                        broCents < o.broCents
                          ? 'cursor-not-allowed border border-[var(--color-border)] bg-white/5 text-white/30'
                          : 'bg-neon-yellow text-black hover:bg-white hover:scale-[1.02] active:scale-[0.98]',
                      )}
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '10px',
                        fontWeight: 700,
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        borderRadius: 'var(--radius-sm)',
                      }}
                      title={broCents < o.broCents ? 'Saldo BRO insuficiente' : 'Comprar EXP'}
                    >
                      Comprar
                    </button>
                  ) : null}
                  {isOtherPlayer ? (
                    <span
                      className="self-center inline-flex items-center gap-1.5 border border-[var(--color-border)] bg-deep-black px-3 py-1.5 text-white/45 uppercase"
                      style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '9px',
                        letterSpacing: '0.22em',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <span aria-hidden className="w-1 h-1 rounded-full bg-rose-500 live-dot" />
                      P2P · em breve
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        {sortedOrders.length === 0 ? (
          <div
            className="border border-[var(--color-border)] bg-dark-gray py-12 text-center"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            <p
              className="italic text-white/55 mx-auto max-w-md"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontSize: 'clamp(18px, 2.4vw, 22px)',
                lineHeight: 1.4,
              }}
            >
              “livro vazio — anuncia o primeiro lote.”
            </p>
            <p
              className="mt-3 text-white/35 uppercase"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '10px',
                letterSpacing: '0.22em',
              }}
            >
              Use o formulário acima
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
              className="max-h-[min(32rem,85dvh)] w-full max-w-md overflow-y-auto overscroll-y-contain border border-[var(--color-border)] bg-deep-black p-6 [-webkit-overflow-scrolling:touch]"
              style={{ borderRadius: 'var(--radius-md)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="w-[3px] h-7 bg-neon-yellow shrink-0" />
                  <h3
                    id="ex-announce-title"
                    className="text-neon-yellow uppercase"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '14px',
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                    }}
                  >
                    Confirmar anúncio
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAnnouncePending(null)}
                  className="grid h-8 w-8 place-items-center text-white/45 hover:bg-white/10 hover:text-white transition-colors"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p
                className="italic text-white/85"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontSize: 'clamp(17px, 2.2vw, 21px)',
                  lineHeight: 1.45,
                }}
              >
                Anunciando{' '}
                <span className="not-italic text-neon-yellow tabular-nums" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                  {formatExp(announcePending.expAmount)}
                </span>{' '}
                EXP por{' '}
                <span className="not-italic text-white tabular-nums" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                  {(announcePending.broCents / 100).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>{' '}
                BRO.
              </p>
              <p
                className="mt-3 text-white/45"
                style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', lineHeight: 1.5 }}
              >
                O EXP fica reservado até venderes ou cancelares o anúncio.
              </p>
              <button
                type="button"
                onClick={confirmAnnounce}
                className="mt-6 w-full bg-neon-yellow py-3 text-black hover:bg-white hover:scale-[1.005] active:scale-[0.995] transition-all"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                }}
              >
                Confirmar anúncio
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
              className="max-h-[min(32rem,85dvh)] w-full max-w-md overflow-y-auto overscroll-y-contain border border-[var(--color-border)] bg-deep-black p-6 [-webkit-overflow-scrolling:touch]"
              style={{ borderRadius: 'var(--radius-md)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="w-[3px] h-7 bg-neon-yellow shrink-0" />
                  <h3
                    id="ex-buy-title"
                    className="text-neon-yellow uppercase"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '14px',
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                    }}
                  >
                    Confirmar compra
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setBuyTarget(null)}
                  className="grid h-8 w-8 place-items-center text-white/45 hover:bg-white/10 hover:text-white transition-colors"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p
                className="italic text-white/85"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontSize: 'clamp(17px, 2.2vw, 21px)',
                  lineHeight: 1.45,
                }}
              >
                <span
                  className="not-italic text-white block uppercase mb-1"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '14px',
                    letterSpacing: '0.06em',
                  }}
                >
                  {buyTarget.teamName}
                </span>
                Recebes{' '}
                <span className="not-italic text-neon-yellow tabular-nums" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                  {formatExp(buyTarget.expAmount)} EXP
                </span>{' '}
                por{' '}
                <span className="not-italic text-white tabular-nums" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                  {formatBroFromCents(buyTarget.broCents)}
                </span>
                .
              </p>
              {broCents < buyTarget.broCents ? (
                <p
                  className="mt-3 text-[var(--color-danger)]"
                  style={{ fontFamily: 'var(--font-sans)', fontSize: '12px' }}
                >
                  Saldo BRO insuficiente.
                </p>
              ) : null}
              <button
                type="button"
                onClick={confirmBuy}
                disabled={broCents < buyTarget.broCents}
                className={cn(
                  'mt-6 w-full py-3 transition-all',
                  broCents < buyTarget.broCents
                    ? 'cursor-not-allowed bg-white/8 text-white/30'
                    : 'bg-neon-yellow text-black hover:bg-white hover:scale-[1.005] active:scale-[0.995]',
                )}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                }}
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

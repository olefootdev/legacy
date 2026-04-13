import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ShoppingBag,
  Zap,
  Package,
  Sparkles,
  Hexagon,
  Crown,
  Flame,
  Gem,
  Wallet,
  ChevronRight,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { GameBannerBackdrop } from '@/components/GameBannerBackdrop';
import { cn } from '@/lib/utils';

type ShopTab = 'todos' | 'boosters' | 'packs' | 'extra';

type Rarity = 'comum' | 'raro' | 'epico' | 'mitico';

interface ShopItem {
  id: string;
  title: string;
  blurb: string;
  tab: ShopTab;
  rarity: Rarity;
  priceBro: number | null;
  priceExp: number | null;
  icon: typeof Zap;
  featured?: boolean;
}

const ITEMS: ShopItem[] = [
  {
    id: 'pack-elite',
    title: 'Pack Elite Draft',
    blurb: '3 jogadores 72+ OVR · chance de carta holográfica.',
    tab: 'packs',
    rarity: 'epico',
    priceBro: 24.99,
    priceExp: null,
    icon: Package,
    featured: true,
  },
  {
    id: 'pack-starter',
    title: 'Pack Arranque',
    blurb: '5 jogadores 65+ · ideal para reforçar o banco.',
    tab: 'packs',
    rarity: 'comum',
    priceBro: 4.99,
    priceExp: 1200,
    icon: Hexagon,
  },
  {
    id: 'booster-fatigue',
    title: 'Booster Fadiga Zero',
    blurb: 'Reset imediato de fadiga em todo o plantel (24h).',
    tab: 'boosters',
    rarity: 'raro',
    priceBro: null,
    priceExp: 450,
    icon: Zap,
  },
  {
    id: 'booster-injury',
    title: 'Kit Médico Premium',
    blurb: 'Reduz 1 jogo de lesão no jogador escolhido.',
    tab: 'boosters',
    rarity: 'epico',
    priceBro: 9.99,
    priceExp: null,
    icon: Flame,
  },
  {
    id: 'pack-legend',
    title: 'Cápsula Lendária',
    blurb: '1 jogador 84+ garantido · supply limitado.',
    tab: 'packs',
    rarity: 'mitico',
    priceBro: 79.0,
    priceExp: null,
    icon: Crown,
    featured: true,
  },
  {
    id: 'scout-token',
    title: 'Token Olheiro PRO',
    blurb: 'Desbloqueia janela extra no mercado por 48h.',
    tab: 'extra',
    rarity: 'raro',
    priceBro: 14.5,
    priceExp: 2800,
    icon: Gem,
  },
];

function rarityStyles(r: Rarity): { border: string; glow: string; label: string; labelClass: string } {
  switch (r) {
    case 'comum':
      return {
        border: 'border-slate-500/50',
        glow: 'shadow-[0_0_24px_rgba(148,163,184,0.15)]',
        label: 'COMUM',
        labelClass: 'bg-slate-600/40 text-slate-200',
      };
    case 'raro':
      return {
        border: 'border-cyan-400/55',
        glow: 'shadow-[0_0_28px_rgba(34,211,238,0.2)]',
        label: 'RARO',
        labelClass: 'bg-cyan-500/25 text-cyan-200',
      };
    case 'epico':
      return {
        border: 'border-fuchsia-500/60',
        glow: 'shadow-[0_0_32px_rgba(217,70,239,0.25)]',
        label: 'ÉPICO',
        labelClass: 'bg-fuchsia-600/30 text-fuchsia-100',
      };
    case 'mitico':
      return {
        border: 'border-amber-400/70',
        glow: 'shadow-[0_0_40px_rgba(251,191,36,0.35)]',
        label: 'MÍTICO',
        labelClass: 'bg-gradient-to-r from-amber-600/50 to-orange-600/50 text-amber-50',
      };
    default:
      return {
        border: 'border-white/20',
        glow: '',
        label: '',
        labelClass: '',
      };
  }
}

function formatBro(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function priceLines(item: ShopItem): { bro: string | null; exp: string | null } {
  return {
    bro: item.priceBro != null ? `${item.priceBro.toFixed(2)} BRO` : null,
    exp: item.priceExp != null ? `${item.priceExp.toLocaleString('pt-BR')} EXP` : null,
  };
}

export function Store() {
  const finance = useGameStore((s) => s.finance);
  const [tab, setTab] = useState<ShopTab>('todos');
  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null);
  const [purchaseDone, setPurchaseDone] = useState<{ item: ShopItem; atLabel: string } | null>(null);

  const broDisplay = useMemo(() => formatBro(finance.broCents ?? 0), [finance.broCents]);
  const expDisplay = useMemo(() => Math.floor(finance.ole ?? 0).toLocaleString('pt-BR'), [finance.ole]);

  const filtered = useMemo(
    () => (tab === 'todos' ? ITEMS : ITEMS.filter((i) => i.tab === tab)),
    [tab],
  );

  const handleConfirmPurchase = () => {
    if (!confirmItem) return;
    const atLabel = new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    setPurchaseDone({ item: confirmItem, atLabel });
    setConfirmItem(null);
  };

  const checkoutRarity = confirmItem ? rarityStyles(confirmItem.rarity) : null;
  const checkoutPrices = confirmItem ? priceLines(confirmItem) : null;

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-8 pb-28 md:pb-12">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 px-4 py-8 md:px-8 md:py-10">
        <GameBannerBackdrop slot="leagues_header" imageOpacity={0.22} />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 2l8 14H22L30 2zm0 56l-8-14h16L30 58zM2 30l14-8v16L2 30zm56 0l-14 8V22l14 8z' fill='%23fff' fill-opacity='1'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-neon-green/35 bg-neon-green/10 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-neon-green" aria-hidden />
              <span className="font-display text-[9px] font-black uppercase tracking-[0.2em] text-neon-green">
                Marketplace
              </span>
            </div>
            <h1 className="font-display text-3xl font-black italic tracking-tight text-white md:text-4xl">
              LOJA <span className="text-neon-yellow">OLEFOOT</span>
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-gray-400">
              Boosters, packs de jogadores e utilidades raras. Compras em{' '}
              <strong className="text-white">BRO</strong> ou <strong className="text-neon-yellow">EXP</strong>.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="rounded-xl border border-white/15 bg-black/50 px-4 py-3 backdrop-blur-sm">
              <p className="font-display text-[9px] font-bold uppercase tracking-wider text-gray-500">Saldo EXP</p>
              <p className="font-mono text-lg font-bold text-neon-yellow">{expDisplay}</p>
            </div>
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-4 py-3 backdrop-blur-sm">
              <p className="font-display text-[9px] font-bold uppercase tracking-wider text-cyan-400/80">Saldo BRO</p>
              <p className="font-mono text-lg font-bold text-cyan-200">{broDisplay}</p>
            </div>
            <Link
              to="/wallet"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-neon-yellow/40 bg-neon-yellow/10 px-4 py-3 font-display text-xs font-bold uppercase tracking-wide text-neon-yellow transition hover:bg-neon-yellow/20"
            >
              <Wallet className="h-4 w-4" aria-hidden />
              Wallet
              <ChevronRight className="h-4 w-4 opacity-60" aria-hidden />
            </Link>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {purchaseDone ? (
          <motion.div
            key="store-purchase-success"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-950/35 px-4 py-4 shadow-[0_0_32px_rgba(16,185,129,0.12)] sm:flex-row sm:items-center sm:justify-between"
            role="status"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/15">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="font-display text-sm font-black uppercase tracking-wide text-emerald-100">
                  Compra confirmada
                </p>
                <p className="mt-0.5 font-display text-base font-bold text-white">{purchaseDone.item.title}</p>
                <p className="mt-1 text-[11px] text-emerald-200/80">
                  Pedido registado às {purchaseDone.atLabel}. Entrega em jogo quando o checkout BRO / EXP estiver
                  ligado.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPurchaseDone(null)}
              className="shrink-0 self-start rounded-lg border border-white/15 px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wide text-white/80 transition hover:bg-white/10 sm:self-center"
            >
              Fechar
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'todos' as const, label: 'Todos' },
            { id: 'packs' as const, label: 'Packs' },
            { id: 'boosters' as const, label: 'Boosters' },
            { id: 'extra' as const, label: 'Extra' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-full border px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wider transition',
              tab === t.id
                ? 'border-neon-yellow bg-neon-yellow/15 text-neon-yellow'
                : 'border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20 hover:text-white',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item, index) => {
          const rs = rarityStyles(item.rarity);
          const Icon = item.icon;
          return (
            <motion.article
              key={item.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, type: 'spring', stiffness: 380, damping: 28 }}
              className={cn(
                'group relative overflow-hidden rounded-2xl border bg-[#0c0c0f] p-1',
                rs.border,
                rs.glow,
                item.featured && 'ring-1 ring-neon-yellow/30',
              )}
            >
              <div
                className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-500 group-hover:opacity-100"
                style={{
                  background:
                    'linear-gradient(125deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)',
                }}
              />
              <div className="relative rounded-[0.9rem] bg-gradient-to-b from-white/[0.06] to-transparent p-4 md:p-5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 font-display text-[8px] font-black uppercase tracking-widest',
                      rs.labelClass,
                    )}
                  >
                    {rs.label}
                  </span>
                  {item.featured ? (
                    <span className="rounded border border-neon-yellow/40 bg-neon-yellow/10 px-2 py-0.5 font-display text-[8px] font-bold uppercase text-neon-yellow">
                      Featured mint
                    </span>
                  ) : (
                    <span className="font-mono text-[9px] text-gray-600">#{String(8400 + index).padStart(5, '0')}</span>
                  )}
                </div>
                <div className="mb-4 flex h-24 items-center justify-center rounded-xl border border-white/5 bg-black/60">
                  <Icon className="h-14 w-14 text-white/25 transition group-hover:text-white/40" aria-hidden />
                </div>
                <h2 className="font-display text-lg font-black tracking-tight text-white md:text-xl">{item.title}</h2>
                <p className="mt-2 text-[11px] leading-relaxed text-gray-500">{item.blurb}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                  {item.priceBro != null ? (
                    <span className="rounded-lg border border-cyan-500/30 bg-cyan-950/50 px-2.5 py-1 font-mono text-[11px] font-bold text-cyan-200">
                      {item.priceBro.toFixed(2)} BRO
                    </span>
                  ) : null}
                  {item.priceExp != null ? (
                    <span className="rounded-lg border border-neon-yellow/30 bg-neon-yellow/5 px-2.5 py-1 font-mono text-[11px] font-bold text-neon-yellow">
                      {item.priceExp.toLocaleString('pt-BR')} EXP
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmItem(item)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] py-3 font-display text-[10px] font-black uppercase tracking-wider text-white transition hover:border-neon-yellow/40 hover:bg-neon-yellow/10 hover:text-neon-yellow"
                >
                  <ShoppingBag className="h-4 w-4" aria-hidden />
                  Comprar
                </button>
              </div>
            </motion.article>
          );
        })}
      </div>

      <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-center text-[10px] leading-relaxed text-gray-500">
        Itens são <strong className="text-gray-400">utilidades de jogo</strong> — sem blockchain obrigatória. Preços
        ilustrativos até integração completa de checkout BRO / EXP.
      </p>

      <AnimatePresence>
        {confirmItem ? (
          <motion.div
            key="store-checkout-overlay"
            role="presentation"
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setConfirmItem(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-neon-yellow/35 bg-[#0f0f12] shadow-[0_0_48px_rgba(234,255,0,0.12)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="store-checkout-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2 border-b border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-display text-[9px] font-bold uppercase tracking-widest text-neon-yellow/90">
                    Confirmar compra
                  </p>
                  <h2 id="store-checkout-title" className="mt-1 font-display text-lg font-black text-white">
                    {confirmItem.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmItem(null)}
                  className="rounded-full p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-[min(60vh,420px)] space-y-4 overflow-y-auto overscroll-y-contain px-4 py-4">
                <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Resumo</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-300">{confirmItem.blurb}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={cn(
                        'rounded px-2 py-0.5 font-display text-[8px] font-black uppercase tracking-widest',
                        checkoutRarity?.labelClass,
                      )}
                    >
                      {checkoutRarity?.label}
                    </span>
                    <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[9px] text-gray-400">
                      ID: {confirmItem.id}
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Preço</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {checkoutPrices?.bro ? (
                      <span className="rounded-lg border border-cyan-500/35 bg-cyan-950/50 px-3 py-2 font-mono text-sm font-bold text-cyan-100">
                        {checkoutPrices.bro}
                      </span>
                    ) : null}
                    {checkoutPrices?.exp ? (
                      <span className="rounded-lg border border-neon-yellow/35 bg-neon-yellow/10 px-3 py-2 font-mono text-sm font-bold text-neon-yellow">
                        {checkoutPrices.exp}
                      </span>
                    ) : null}
                    {!checkoutPrices?.bro && !checkoutPrices?.exp ? (
                      <span className="text-sm text-gray-500">Sem preço definido</span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-[10px] leading-relaxed text-gray-600">
                    Saldo atual: <span className="text-neon-yellow">{expDisplay} EXP</span>
                    <span className="mx-1.5 text-white/20">·</span>
                    <span className="text-cyan-200">{broDisplay} BRO</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-2 border-t border-white/10 bg-black/50 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setConfirmItem(null)}
                  className="flex-1 rounded-xl border border-white/15 py-3 font-display text-[10px] font-bold uppercase tracking-wide text-gray-300 transition hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPurchase}
                  className="btn-primary flex flex-[1.2] items-center justify-center gap-2 py-3 font-display text-[10px] font-black uppercase tracking-wide"
                >
                  <ShoppingBag className="h-4 w-4" aria-hidden />
                  Comprar
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

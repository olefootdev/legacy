import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ShoppingBag, Zap, Sparkles, Wallet, ChevronRight, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getGameState, useGameDispatch, useGameStore } from '@/game/store';
import { GameBannerBackdrop } from '@/components/GameBannerBackdrop';
import { ManagerOutcomePanel } from '@/components/manager/ManagerOutcomePanel';
import { cn } from '@/lib/utils';
import { shopItemIcon, type ShopCatalogItem, type ShopRarity, type ShopTabId } from '@/game/shopCatalog';
import { trackGrowthCommerce } from '@/admin/platformStore';
import { TransferHeroSlider, type HeroTab } from '@/transfer/TransferHeroSlider';
import { StoreFeaturedBoxes } from '@/store/StoreFeaturedBoxes';

type ShopTab = 'todos' | ShopTabId;

type StorePurchaseOutcome =
  | { kind: 'success'; item: ShopCatalogItem; atLabel: string; currency: 'exp' | 'bro' }
  | { kind: 'error'; title: string; message: string };

function rarityStyles(r: ShopRarity): { border: string; glow: string; label: string; labelClass: string } {
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

function priceLines(item: ShopCatalogItem): { bro: string | null; exp: string | null } {
  return {
    bro: item.priceBroCents != null && item.priceBroCents > 0 ? `${formatBro(item.priceBroCents)} BRO` : null,
    exp: item.priceExp != null && item.priceExp > 0 ? `${item.priceExp.toLocaleString('pt-BR')} EXP` : null,
  };
}

// ─── Hero slides por aba ────────────────────────────────────────────────
// imageUrl aponta pra `/public/store-heroes/{tab}-{n}.webp` — designer popula
// depois. Fallback com gradiente temático quando ausente.

const TAB_TO_HERO: Record<ShopTab, HeroTab> = {
  todos: 'store-all',
  packs: 'store-packs',
  boosters: 'store-boosters',
  extra: 'store-extra',
};

function heroSlidesForStoreTab(
  tab: ShopTab,
): { imageUrl?: string; title: string; subtitle: string; tag?: string; ctaLabel?: string }[] {
  switch (tab) {
    case 'todos':
      return [
        { imageUrl: '/store-heroes/store-all-01.webp', title: 'Loja OLEFOOT', subtitle: 'Packs, boosters e itens raros — tudo num só lugar.', tag: 'Destaques', ctaLabel: 'Explorar' },
        { imageUrl: '/store-heroes/store-all-02.webp', title: 'Duas moedas, uma loja', subtitle: 'Pague em EXP (conquistado) ou BRO (convertível) conforme a sua estratégia.', tag: 'EXP ↔ BRO' },
        { imageUrl: '/store-heroes/store-all-03.webp', title: 'Itens consumíveis com impacto real', subtitle: 'Boosters afetam plantel, torcida e mercado — não é apenas cosmético.', tag: 'Gameplay' },
      ];
    case 'packs':
      return [
        { imageUrl: '/store-heroes/store-packs-01.webp', title: 'Packs da temporada', subtitle: 'Cartas Genesis em blindpack com chance de tier mítico.', tag: 'Chance Mítico', ctaLabel: 'Abrir' },
        { imageUrl: '/store-heroes/store-packs-02.webp', title: 'Packs especiais limitados', subtitle: 'Drops temáticos com duração curta — compra antes que saia de rotação.', tag: 'Edição limitada' },
      ];
    case 'boosters':
      return [
        { imageUrl: '/store-heroes/store-boosters-01.webp', title: 'Boosters de plantel', subtitle: 'Moral, forma e recuperação — puxa a equipa pra cima no momento certo.', tag: 'Consumível', ctaLabel: 'Ver boosters' },
        { imageUrl: '/store-heroes/store-boosters-02.webp', title: 'Combos estratégicos', subtitle: 'Combine boosters antes de partidas decisivas pra maximizar o retorno.', tag: 'Combo' },
      ];
    case 'extra':
      return [
        { imageUrl: '/store-heroes/store-extra-01.webp', title: 'Extras & curiosidades', subtitle: 'Itens cosméticos, troféus, upgrades de estrutura e mais.', tag: 'Extra', ctaLabel: 'Ver itens' },
      ];
  }
}

function featuredItemsForStoreTab(tab: ShopTab, catalog: ShopCatalogItem[]): ShopCatalogItem[] {
  const rarityRank = (r: ShopRarity): number =>
    r === 'mitico' ? 4 : r === 'epico' ? 3 : r === 'raro' ? 2 : 1;
  const pool = tab === 'todos' ? catalog : catalog.filter((i) => i.tab === tab);
  // Prioriza featured + mais raros.
  return [...pool]
    .sort((a, b) => {
      if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
      return rarityRank(b.rarity) - rarityRank(a.rarity);
    })
    .slice(0, 6);
}

function featuredBoxesConfigForStoreTab(tab: ShopTab): {
  title: string;
  subtitle: string;
  variant: 'premium' | 'rising' | 'drop';
} {
  switch (tab) {
    case 'todos':   return { title: 'Destaques da loja', subtitle: 'Seleção curada — featured + raridades mais altas.', variant: 'premium' };
    case 'packs':   return { title: 'Packs em foco', subtitle: 'Blindpacks com maior chance de tier raro.', variant: 'drop' };
    case 'boosters':return { title: 'Boosters em alta', subtitle: 'Mais usados antes de partidas decisivas.', variant: 'rising' };
    case 'extra':   return { title: 'Extras da temporada', subtitle: 'Cosméticos e upgrades da estrutura.', variant: 'premium' };
  }
}

export function Store() {
  const dispatch = useGameDispatch();
  const navigate = useNavigate();
  const finance = useGameStore((s) => s.finance);
  const catalog = useGameStore((s) => s.shopCatalog);
  const inventory = useGameStore((s) => s.shopInventory);

  const [tab, setTab] = useState<ShopTab>('todos');
  const [confirmItem, setConfirmItem] = useState<ShopCatalogItem | null>(null);
  const [purchaseOutcome, setPurchaseOutcome] = useState<StorePurchaseOutcome | null>(null);
  const [purchaseErr, setPurchaseErr] = useState<string | null>(null);

  const broDisplay = useMemo(() => formatBro(finance.broCents ?? 0), [finance.broCents]);
  const expDisplay = useMemo(() => Math.floor(finance.ole ?? 0).toLocaleString('pt-BR'), [finance.ole]);

  const filtered = useMemo(
    () => (tab === 'todos' ? catalog : catalog.filter((i) => i.tab === tab)),
    [tab, catalog],
  );

  const tryPurchase = (item: ShopCatalogItem, currency: 'exp' | 'bro') => {
    setPurchaseErr(null);
    const canExp = item.priceExp != null && item.priceExp > 0;
    const canBro = item.priceBroCents != null && item.priceBroCents > 0;
    if (currency === 'exp' && (!canExp || finance.ole < item.priceExp!)) {
      setPurchaseErr(
        `Faltam ${Math.max(0, Math.ceil((item.priceExp ?? 0) - (finance.ole ?? 0))).toLocaleString('pt-BR')} EXP para pagar este item.`,
      );
      return;
    }
    if (currency === 'bro' && (!canBro || finance.broCents < item.priceBroCents!)) {
      const need = (item.priceBroCents ?? 0) - (finance.broCents ?? 0);
      setPurchaseErr(
        `Faltam ${formatBro(Math.max(0, need))} BRO para pagar este item.`,
      );
      return;
    }

    const before = getGameState();
    const ole0 = Math.floor(Number(before.finance.ole ?? 0));
    const bro0 = Math.floor(Number(before.finance.broCents ?? 0));

    dispatch({ type: 'SHOP_PURCHASE_ITEM', itemId: item.id, currency });

    const after = getGameState();
    const ole1 = Math.floor(Number(after.finance.ole ?? 0));
    const bro1 = Math.floor(Number(after.finance.broCents ?? 0));

    const priceExp = item.priceExp ?? 0;
    const priceBro = item.priceBroCents ?? 0;
    const expPaid = currency === 'exp' && priceExp > 0 && ole0 - ole1 >= priceExp;
    const broPaid = currency === 'bro' && priceBro > 0 && bro0 - bro1 >= priceBro;
    const paid = expPaid || broPaid;

    if (!paid) {
      setConfirmItem(null);
      setPurchaseOutcome({
        kind: 'error',
        title: 'Compra não registada',
        message:
          'O pagamento não foi aplicado (saldo pode ter mudado ou o item não está disponível). Abre a Wallet, confirma EXP/BRO e tenta outra vez.',
      });
      return;
    }

    const atLabel = new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    trackGrowthCommerce('store_item', broPaid ? priceBro : 0, {
      grossBroCents: broPaid ? priceBro : undefined,
      label: item.title,
    });
    setPurchaseOutcome({ kind: 'success', item, atLabel, currency });
    setConfirmItem(null);
  };

  const checkoutRarity = confirmItem ? rarityStyles(confirmItem.rarity) : null;
  const checkoutPrices = confirmItem ? priceLines(confirmItem) : null;
  const canExpBuy =
    confirmItem && confirmItem.priceExp != null && confirmItem.priceExp > 0 && finance.ole >= confirmItem.priceExp;
  const canBroBuy =
    confirmItem &&
    confirmItem.priceBroCents != null &&
    confirmItem.priceBroCents > 0 &&
    finance.broCents >= confirmItem.priceBroCents;

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
              Consumíveis ficam no inventário e aplicam efeito em <strong className="text-white">Meu Time</strong>.
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

      {/* Hero promocional por aba — arte substituída pelo designer em /public/store-heroes/ */}
      <TransferHeroSlider
        tab={TAB_TO_HERO[tab]}
        slides={heroSlidesForStoreTab(tab)}
      />

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

      {/* Boxes em destaque — featured + rarer items. */}
      <StoreFeaturedBoxes
        title={featuredBoxesConfigForStoreTab(tab).title}
        subtitle={featuredBoxesConfigForStoreTab(tab).subtitle}
        variant={featuredBoxesConfigForStoreTab(tab).variant}
        items={featuredItemsForStoreTab(tab, catalog)}
        onSelect={(item) => { setPurchaseErr(null); setConfirmItem(item); }}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item, index) => {
          const rs = rarityStyles(item.rarity);
          const Icon = shopItemIcon(item.iconKey);
          const inv = inventory[item.id] ?? 0;
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
                {item.consumable && inv > 0 ? (
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-emerald-300/90">
                    Inventário: {inv}×
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                  {item.priceBroCents != null && item.priceBroCents > 0 ? (
                    <span className="rounded-lg border border-cyan-500/30 bg-cyan-950/50 px-2.5 py-1 font-mono text-[11px] font-bold text-cyan-200">
                      {formatBro(item.priceBroCents)} BRO
                    </span>
                  ) : null}
                  {item.priceExp != null && item.priceExp > 0 ? (
                    <span className="rounded-lg border border-neon-yellow/30 bg-neon-yellow/5 px-2.5 py-1 font-mono text-[11px] font-bold text-neon-yellow">
                      {item.priceExp.toLocaleString('pt-BR')} EXP
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPurchaseErr(null);
                    setConfirmItem(item);
                  }}
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
        Catálogo editável no <strong className="text-gray-400">Admin → Loja</strong>. Itens consumíveis aplicam efeitos
        reais no save (plantel, torcida, mercado NPC, EXP).
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
                    {confirmItem.consumable ? (
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-display text-[8px] font-bold uppercase text-emerald-200">
                        Consumível
                      </span>
                    ) : null}
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
                    Saldo: <span className="text-neon-yellow">{expDisplay} EXP</span>
                    <span className="mx-1.5 text-white/20">·</span>
                    <span className="text-cyan-200">{broDisplay} BRO</span>
                  </p>
                  {purchaseErr ? (
                    <div className="mt-3 space-y-2 rounded-lg border border-rose-500/25 bg-rose-950/30 p-3">
                      <p className="text-xs font-bold leading-snug text-rose-200">{purchaseErr}</p>
                      <Link
                        to="/wallet"
                        className="inline-flex w-full items-center justify-center rounded-lg border border-rose-400/35 bg-rose-500/15 py-2.5 font-display text-[10px] font-black uppercase tracking-wide text-rose-100 transition hover:bg-rose-500/25 sm:w-auto sm:px-4"
                      >
                        Ver saldo na Wallet
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col gap-2 border-t border-white/10 bg-black/50 px-4 py-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setConfirmItem(null)}
                  className="flex-1 rounded-xl border border-white/15 py-3 font-display text-[10px] font-bold uppercase tracking-wide text-gray-300 transition hover:bg-white/5"
                >
                  Cancelar
                </button>
                {confirmItem.priceExp != null && confirmItem.priceExp > 0 ? (
                  <button
                    type="button"
                    disabled={!canExpBuy}
                    onClick={() => tryPurchase(confirmItem, 'exp')}
                    className="btn-primary flex flex-1 items-center justify-center gap-2 py-3 font-display text-[10px] font-black uppercase tracking-wide disabled:opacity-40"
                  >
                    <Zap className="h-4 w-4" />
                    Pagar EXP
                  </button>
                ) : null}
                {confirmItem.priceBroCents != null && confirmItem.priceBroCents > 0 ? (
                  <button
                    type="button"
                    disabled={!canBroBuy}
                    onClick={() => tryPurchase(confirmItem, 'bro')}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/15 py-3 font-display text-[10px] font-black uppercase tracking-wide text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-40"
                  >
                    <Wallet className="h-4 w-4" />
                    Pagar BRO
                  </button>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ManagerOutcomePanel
        open={purchaseOutcome != null}
        variant={purchaseOutcome?.kind === 'error' ? 'error' : 'success'}
        title={
          purchaseOutcome?.kind === 'success'
            ? 'Compra concluída'
            : purchaseOutcome?.kind === 'error'
              ? purchaseOutcome.title
              : ''
        }
        message={
          purchaseOutcome?.kind === 'success'
            ? `Pagamento em ${purchaseOutcome.currency === 'exp' ? 'EXP' : 'BRO'} às ${purchaseOutcome.atLabel}. ${
                purchaseOutcome.item.consumable
                  ? 'O item está no inventário: abre Meu Time, escolhe um jogador e aplica o consumível.'
                  : 'O pedido do pack foi registado; vê também a mensagem na caixa do clube.'
              }`
            : purchaseOutcome?.kind === 'error'
              ? purchaseOutcome.message
              : ''
        }
        actions={
          purchaseOutcome?.kind === 'success'
            ? [
                ...(purchaseOutcome.item.consumable
                  ? [
                      {
                        label: 'Ir a Meu Time',
                        variant: 'primary' as const,
                        onClick: () => {
                          setPurchaseOutcome(null);
                          navigate('/team');
                        },
                      },
                    ]
                  : []),
                {
                  label: purchaseOutcome.item.consumable ? 'Ficar na loja' : 'OK',
                  variant: purchaseOutcome.item.consumable ? ('secondary' as const) : ('primary' as const),
                  onClick: () => setPurchaseOutcome(null),
                },
                {
                  label: 'Wallet',
                  variant: 'ghost' as const,
                  onClick: () => {
                    setPurchaseOutcome(null);
                    navigate('/wallet');
                  },
                },
              ]
            : purchaseOutcome?.kind === 'error'
              ? [
                  {
                    label: 'Ir à Wallet',
                    variant: 'primary' as const,
                    onClick: () => {
                      setPurchaseOutcome(null);
                      navigate('/wallet');
                    },
                  },
                  {
                    label: 'Fechar',
                    variant: 'ghost' as const,
                    onClick: () => setPurchaseOutcome(null),
                  },
                ]
              : []
        }
        onDismiss={() => setPurchaseOutcome(null)}
      />
    </div>
  );
}

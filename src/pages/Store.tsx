import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Zap, Sparkles, Wallet, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getGameState, useGameDispatch, useGameStore } from '@/game/store';
import { ManagerOutcomePanel } from '@/components/manager/ManagerOutcomePanel';
import { cn } from '@/lib/utils';
import type { ShopCatalogItem, ShopRarity, ShopTabId } from '@/game/shopCatalog';
import { trackGrowthCommerce } from '@/admin/platformStore';
import { StoreFeaturedBoxes } from '@/store/StoreFeaturedBoxes';
import { StoreSectionHeadline } from '@/store/StoreSectionHeadline';
import { trackMissionEvent } from '@/progression/trackEvent';
import { BackButton } from '@/components/BackButton';
import { LegendaryBadge } from '@/store/LegendaryBadge';
import { PremiumPriceReveal } from '@/store/PremiumPriceReveal';
import { StoreViewToggle, type StoreViewMode } from '@/store/StoreViewToggle';
import { StoreItemList } from '@/store/StoreItemList';
import { L, LOCALE } from '@/i18n/L';

type ShopTab = 'todos' | ShopTabId;

type StorePurchaseOutcome =
  | { kind: 'success'; item: ShopCatalogItem; atLabel: string; currency: 'exp' | 'bro' }
  | { kind: 'error'; title: string; message: string };

/**
 * Estilo por raridade do pack.
 *
 * ── Alinhado à regra canônica (2026-08-01) ─────────────────────────────────
 * A escada de raridade do OLEFOOT tem uma regra escrita pelo fundador em
 * `src/entities/rarityLabels.ts`: **prestígio = GRAU DE AMARELO** (o topo vem
 * amarelo sólido, a base vem sem amarelo nenhum).
 *
 * Esta tela ignorava a regra e usava quatro matizes soltos — cinza, ciano,
 * fúcsia e âmbar. O problema não era só destoar do layer final: o jogo tinha
 * DUAS escalas de raridade conflitantes ao mesmo tempo (o `Badge` do DS pintava
 * épico de ROXO enquanto aqui épico era FÚCSIA), então a cor não ensinava nada
 * — o jogador via a mesma palavra em duas cores diferentes.
 *
 * Agora a raridade se lê pela quantidade de amarelo: comum não tem, raro tem um
 * fio, épico tem trilho e etiqueta, mítico vem sólido. A informação continua
 * inteira; o vocabulário passa a ser um só.
 *
 * VOLT2 (2026-09-19): sem brilho, sem sombra de adesivo e sem degradê de fundo.
 * A escada fica só na borda (`frame`), no trilho e na etiqueta chapada.
 */
function rarityStyles(r: ShopRarity): {
  border: string;
  /** Moldura do card por raridade — cor chapada; o topo ganha borda volt 2px. */
  frame: string;
  label: string;
  labelClass: string;
  /** Cor sólida do trilho lateral. */
  rail: string;
} {
  switch (r) {
    case 'comum':
      return {
        border: 'border-white/12',
        frame: 'hover:border-white/30',
        label: L('COMUM', 'COMMON'),
        labelClass: 'bg-white/10 text-white/70',
        rail: 'bg-white/25',
      };
    case 'raro':
      return {
        border: 'border-neon-yellow/25',
        frame: 'hover:border-white/30',
        label: L('RARO', 'RARE'),
        labelClass: 'bg-neon-yellow/12 text-neon-yellow/85',
        rail: 'bg-neon-yellow/45',
      };
    case 'epico':
      return {
        border: 'border-neon-yellow/55',
        frame: 'border-neon-yellow/55',
        label: L('ÉPICO', 'EPIC'),
        labelClass: 'bg-neon-yellow/25 text-neon-yellow',
        rail: 'bg-neon-yellow',
      };
    case 'mitico':
      // O topo da escada: borda volt 2px + etiqueta volt chapada invertida.
      return {
        border: 'border-neon-yellow',
        frame: 'border-2 border-neon-yellow',
        label: L('MÍTICO', 'MYTHIC'),
        labelClass: 'bg-neon-yellow text-black',
        rail: 'bg-neon-yellow',
      };
    default:
      return {
        border: 'border-white/12',
        frame: 'hover:border-white/30',
        label: '',
        labelClass: '',
        rail: 'bg-white/25',
      };
  }
}

function formatBro(cents: number): string {
  return (cents / 100).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function priceLines(item: ShopCatalogItem): { bro: string | null; exp: string | null } {
  return {
    bro: item.priceBroCents != null && item.priceBroCents > 0 ? `${formatBro(item.priceBroCents)} BRO` : null,
    exp: item.priceExp != null && item.priceExp > 0 ? `${item.priceExp.toLocaleString(LOCALE)} EXP` : null,
  };
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
    case 'todos':   return { title: L('Destaques da loja', 'Store highlights'), subtitle: L('Seleção curada — featured + raridades mais altas.', 'Curated pick — featured + top rarities.'), variant: 'premium' };
    case 'packs':   return { title: L('Packs em foco', 'Packs in focus'), subtitle: L('Blindpacks com maior chance de tier raro.', 'Blindpacks with the best odds of a rare tier.'), variant: 'drop' };
    case 'boosters':return { title: L('Boosters em alta', 'Trending boosters'), subtitle: L('Mais usados antes de partidas decisivas.', 'Most used before decisive matches.'), variant: 'rising' };
    case 'extra':   return { title: L('Extras da temporada', 'Season extras'), subtitle: L('Cosméticos e upgrades da estrutura.', 'Cosmetics and facility upgrades.'), variant: 'premium' };
  }
}

export function Store() {
  const dispatch = useGameDispatch();
  const navigate = useNavigate();
  const finance = useGameStore((s) => s.finance);
  const catalog = useGameStore((s) => s.shopCatalog);
  const inventory = useGameStore((s) => s.shopInventory);

  const [tab, setTab] = useState<ShopTab>('todos');
  const [viewMode, setViewMode] = useState<StoreViewMode>('grid');
  const [confirmItem, setConfirmItem] = useState<ShopCatalogItem | null>(null);
  const [purchaseOutcome, setPurchaseOutcome] = useState<StorePurchaseOutcome | null>(null);
  const [purchaseErr, setPurchaseErr] = useState<string | null>(null);

  const broDisplay = useMemo(() => formatBro(finance.broCents ?? 0), [finance.broCents]);
  const expDisplay = useMemo(() => Math.floor(finance.ole ?? 0).toLocaleString(LOCALE), [finance.ole]);

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
        L(
          `Faltam ${Math.max(0, Math.ceil((item.priceExp ?? 0) - (finance.ole ?? 0))).toLocaleString(LOCALE)} EXP para pagar este item.`,
          `You need ${Math.max(0, Math.ceil((item.priceExp ?? 0) - (finance.ole ?? 0))).toLocaleString(LOCALE)} more EXP to pay for this item.`,
        ),
      );
      return;
    }
    if (currency === 'bro' && (!canBro || finance.broCents < item.priceBroCents!)) {
      const need = (item.priceBroCents ?? 0) - (finance.broCents ?? 0);
      setPurchaseErr(
        L(`Faltam ${formatBro(Math.max(0, need))} BRO para pagar este item.`, `You need ${formatBro(Math.max(0, need))} more BRO to pay for this item.`),
      );
      return;
    }

    const before = getGameState();
    const ole0 = Math.floor(Number(before.finance.ole ?? 0));
    const bro0 = Math.floor(Number(before.finance.broCents ?? 0));

    dispatch({ type: 'SHOP_PURCHASE_ITEM', itemId: item.id, currency });
    trackMissionEvent('store_purchase');

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
        title: L('Compra não registrada', 'Purchase not recorded'),
        message:
          L(
            'O pagamento não foi aplicado (saldo pode ter mudado ou o item não está disponível). Abra a Wallet, confira EXP/BRO e tente outra vez.',
            'The payment was not applied (your balance may have changed or the item is unavailable). Open the Wallet, check EXP/BRO and try again.',
          ),
      });
      return;
    }

    const atLabel = new Date().toLocaleString(LOCALE, {
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

  // Meta da aba — segue padrão BVB do /transfer (num + eyebrow + subtitle + quote)
  const TAB_META: Record<ShopTab, { eyebrow: string }> = {
    todos:    { eyebrow: L('Catálogo Olefoot', 'Olefoot Catalog') },
    packs:    { eyebrow: L('Packs de Jogadores', 'Player Packs') },
    boosters: { eyebrow: L('Boosters de Partida', 'Match Boosters') },
    extra:    { eyebrow: L('Extras Especiais', 'Special Extras') },
  };
  const tabMeta = TAB_META[tab] ?? TAB_META.todos;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden pb-28 md:pb-12">
      <BackButton to="/mercado" label={L('Mercado', 'Market')} />
      {/* ── HERO EDITORIAL — diagonal split + watermark cinematográfico (espelha /transfer) ── */}
      <section
        aria-label={L('Loja Olefoot', 'Olefoot Store')}
        className="relative w-full overflow-hidden bg-neon-yellow"
      >
        {/* ── HERO no layer final ──────────────────────────────────────────
            Saíram watermark, subtítulo em serifa itálica, régua decorativa e a
            frase entre aspas por aba. Ficou o que decide a compra: onde estou e
            quanto tenho. */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 px-5 sm:px-8"
          style={{ paddingBlock: 'clamp(26px, 5vw, 46px)' }}
        >
          <span className="ole-eyebrow-poster" data-on="yellow" style={{ fontSize: '12px' }}>
            {tabMeta.eyebrow}
          </span>

          <h1
            className="mt-2 font-impact uppercase"
            style={{
              color: 'var(--color-deep-black)',
              fontSize: 'clamp(42px, 11vw, 88px)',
              lineHeight: 0.84,
              letterSpacing: '-0.01em',
            }}
          >
            {L('Loja', 'Store')}
          </h1>

          <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <span className="font-impact tabular-nums" style={{ fontSize: '30px', lineHeight: 0.85, color: 'var(--color-deep-black)' }}>
              {expDisplay}
              <span className="ml-1.5 font-display font-black" style={{ fontSize: '11px', letterSpacing: '0.14em' }}>EXP</span>
            </span>
            <span className="font-impact tabular-nums" style={{ fontSize: '30px', lineHeight: 0.85, color: 'rgba(13,13,13,0.55)' }}>
              {broDisplay}
              <span className="ml-1.5 font-display font-black" style={{ fontSize: '11px', letterSpacing: '0.14em' }}>BRO</span>
            </span>
          </div>

          {/* CTAs — primary preto sobre amarelo + outline preto */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to="/wallet"
              className="inline-flex items-center gap-2 bg-black px-7 py-3 text-neon-yellow font-bold uppercase tracking-[0.2em] text-[12px] hover:bg-deep-black/80 transition-colors"
              style={{
                fontFamily: 'var(--font-display)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <Wallet className="w-4 h-4" />
              {L('Carteira', 'Wallet')}
            </Link>
            <button
              type="button"
              onClick={() => setTab('packs')}
              className="inline-flex items-center gap-2 border border-black/70 bg-transparent px-7 py-3 text-black font-bold uppercase tracking-[0.2em] text-[12px] hover:bg-black/10 transition-colors"
              style={{
                fontFamily: 'var(--font-display)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <Sparkles className="w-4 h-4" />
              {L('Ver packs', 'View packs')}
            </button>
          </div>
        </motion.div>
      </section>

      {/* Slider de abas */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'todos' as const, label: L('Todos', 'All') },
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

      {/* Header com toggle de visualização */}
      <div className="flex items-start justify-between gap-4">
        <StoreSectionHeadline
          variant="moret"
          title={tab === 'todos' ? L('Raros da Semana', 'Rares of the Week') : L(`Todos os ${TAB_META[tab].eyebrow}`, `All ${TAB_META[tab].eyebrow}`)}
          subtitle={`${filtered.length} ${filtered.length === 1 ? L('item disponível', 'item available') : L('itens disponíveis', 'items available')}.`}
        />
        <StoreViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {/* Visualização dinâmica: Grid ou Lista */}
      {viewMode === 'list' ? (
        <StoreItemList
          items={filtered}
          inventory={inventory}
          onSelect={(item) => { setPurchaseErr(null); setConfirmItem(item); }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item, index) => {
            const rs = rarityStyles(item.rarity);
            const inv = inventory[item.id] ?? 0;
            const handleSelect = () => { setPurchaseErr(null); setConfirmItem(item); };
            const broText = item.priceBroCents != null && item.priceBroCents > 0 ? `${formatBro(item.priceBroCents)} BRO` : null;
            const expText = item.priceExp != null && item.priceExp > 0 ? `${item.priceExp.toLocaleString(LOCALE)} EXP` : null;
            return (
              <PremiumPriceReveal
                key={item.id}
                item={item}
                onSelect={handleSelect}
              >
                <motion.article
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02, type: 'spring', stiffness: 380, damping: 28 }}
                  className={cn(
                    'group relative isolate flex h-full cursor-pointer overflow-hidden border border-white/10',
                    'transition-colors duration-300',
                    rs.frame,
                  )}
                  style={{
                    borderRadius: 'var(--radius-card)',
                    background: 'var(--color-panel-elevated)',
                  }}
                >
                  {/* Trilho lateral colorido (raridade) — texto-claro, sem ícone solto */}
                  <span
                    aria-hidden
                    className={cn('absolute left-0 top-0 h-full w-[3px]', rs.rail)}
                  />

                  {/* Badge Lendário (já é texto-claro) */}
                  <LegendaryBadge rarity={item.rarity} featured={item.featured} />

                  <div className="relative flex w-full flex-col gap-4 p-5 pl-6">
                    {/* Eyebrow + raridade */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-sm px-2.5 py-1 font-display text-[9px] font-black uppercase tracking-[0.22em]',
                          rs.labelClass,
                        )}
                      >
                        {rs.label || 'Item'}
                      </span>
                      {item.consumable && inv > 0 ? (
                        <span className="rounded-sm bg-[var(--color-success)]/15 px-2.5 py-1 font-display text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--color-success)]">
                          {inv}× {L('inventário', 'inventory')}
                        </span>
                      ) : null}
                    </div>

                    {/* Título — peso editorial, mais legível que antes */}
                    <h3
                      className="font-display text-[20px] font-black uppercase leading-tight tracking-tight text-white line-clamp-2"
                      style={{ letterSpacing: '0.005em' }}
                    >
                      {item.title}
                    </h3>

                    {/* Descrição — texto-claro, sem icone */}
                    <p className="text-[12px] leading-relaxed text-white/55 line-clamp-2">
                      {item.blurb}
                    </p>

                    {/* Preço — Anton tabular (número não usa serifa). */}
                    <div className="flex items-baseline gap-3 border-t border-[var(--color-divider-yellow)] pt-3">
                      {broText ? (
                        <span
                          className="font-impact tabular-nums text-white/80"
                          style={{ fontSize: 'clamp(22px, 3vw, 30px)', lineHeight: 1 }}
                        >
                          {broText}
                        </span>
                      ) : null}
                      {broText && expText ? (
                        <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">{L('ou', 'or')}</span>
                      ) : null}
                      {expText ? (
                        <span
                          className="font-impact tabular-nums text-neon-yellow"
                          style={{ fontSize: 'clamp(22px, 3vw, 30px)', lineHeight: 1 }}
                        >
                          {expText}
                        </span>
                      ) : null}
                    </div>

                    {/* CTA — botão texto-claro */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect();
                      }}
                      className="mt-auto inline-flex items-center justify-center rounded-sm bg-neon-yellow px-5 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.22em] text-black transition-colors hover:bg-white"
                    >
                      {L('Comprar', 'Buy')}
                    </button>
                  </div>

                </motion.article>
              </PremiumPriceReveal>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {confirmItem ? (
          <motion.div
            key="store-checkout-overlay"
            role="presentation"
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
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
              className={cn(
                "relative w-full max-w-md overflow-hidden rounded-md border bg-panel",
                confirmItem.rarity === 'mitico'
                  ? 'border-2 border-neon-yellow'
                  : 'border-neon-yellow/35'
              )}
              role="dialog"
              aria-modal="true"
              aria-labelledby="store-checkout-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={cn(
                "flex items-start justify-between gap-2 border-b px-4 py-4",
                confirmItem.rarity === 'mitico' ? 'border-neon-yellow/20 bg-card' : 'border-white/10'
              )}>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[9px] font-bold uppercase tracking-widest text-neon-yellow/90">
                    {L('Confirmar compra', 'Confirm purchase')}
                  </p>

                  {/* Nome do item — Anton. Serifa itálica é assinatura de LENDA. */}
                  {(confirmItem.rarity === 'mitico' || confirmItem.rarity === 'epico') ? (
                    <h2
                      id="store-checkout-title"
                      className="mt-2 font-impact uppercase text-neon-yellow"
                      style={{
                        fontSize: 'clamp(1.35rem, 4.5vw, 1.9rem)',
                        letterSpacing: '-0.01em',
                        lineHeight: 1.05,
                      }}
                    >
                      {confirmItem.title}
                    </h2>
                  ) : (
                    <h2 id="store-checkout-title" className="mt-1 font-display text-lg font-black text-white">
                      {confirmItem.title}
                    </h2>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmItem(null)}
                  className="rounded-full p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
                  aria-label={L('Fechar', 'Close')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-[min(60vh,420px)] space-y-4 overflow-y-auto overscroll-y-contain px-4 py-4">
                <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{L('Resumo', 'Summary')}</p>
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
                      <span className="rounded border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-2 py-0.5 font-display text-[8px] font-bold uppercase text-[var(--color-success)]">
                        {L('Consumível', 'Consumable')}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{L('Preço', 'Price')}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {checkoutPrices?.bro ? (
                      <span className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 font-impact tabular-nums text-white" style={{ fontSize: '15px' }}>
                        {checkoutPrices.bro}
                      </span>
                    ) : null}
                    {checkoutPrices?.exp ? (
                      <span className="rounded-lg border border-neon-yellow/35 bg-neon-yellow/10 px-3 py-2 font-impact tabular-nums text-neon-yellow" style={{ fontSize: '15px' }}>
                        {checkoutPrices.exp}
                      </span>
                    ) : null}
                    {!checkoutPrices?.bro && !checkoutPrices?.exp ? (
                      <span className="text-sm text-gray-500">{L('Sem preço definido', 'No price set')}</span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-[10px] leading-relaxed text-gray-600">
                    {L('Saldo', 'Balance')}: <span className="font-impact tabular-nums text-neon-yellow">{expDisplay} EXP</span>
                    <span className="mx-1.5 text-white/20">·</span>
                    <span className="font-impact tabular-nums text-white/80">{broDisplay} BRO</span>
                  </p>
                  {purchaseErr ? (
                    <div className="mt-3 space-y-2 rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 p-3">
                      <p className="text-xs font-bold leading-snug text-[var(--color-danger)]">{purchaseErr}</p>
                      <Link
                        to="/wallet"
                        className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--color-danger)]/35 bg-[var(--color-danger)]/15 py-2.5 font-display text-[10px] font-black uppercase tracking-wide text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/25 sm:w-auto sm:px-4"
                      >
                        {L('Ver saldo na Wallet', 'Check balance in Wallet')}
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
                  {L('Cancelar', 'Cancel')}
                </button>
                {confirmItem.priceExp != null && confirmItem.priceExp > 0 ? (
                  <button
                    type="button"
                    disabled={!canExpBuy}
                    onClick={() => tryPurchase(confirmItem, 'exp')}
                    className="btn-primary flex flex-1 items-center justify-center gap-2 py-3 font-display text-[10px] font-black uppercase tracking-wide disabled:opacity-40"
                  >
                    <Zap className="h-4 w-4" />
                    {L('Pagar', 'Pay')} {checkoutPrices?.exp ?? 'EXP'}
                  </button>
                ) : null}
                {confirmItem.priceBroCents != null && confirmItem.priceBroCents > 0 ? (
                  <button
                    type="button"
                    disabled={!canBroBuy}
                    onClick={() => tryPurchase(confirmItem, 'bro')}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 py-3 font-display text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-white/20 disabled:opacity-40"
                  >
                    <Wallet className="h-4 w-4" />
                    {L('Pagar', 'Pay')} {checkoutPrices?.bro ?? 'BRO'}
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
            ? L('Compra concluída', 'Purchase complete')
            : purchaseOutcome?.kind === 'error'
              ? purchaseOutcome.title
              : ''
        }
        message={
          purchaseOutcome?.kind === 'success'
            ? `${L(
                `Pagamento em ${purchaseOutcome.currency === 'exp' ? 'EXP' : 'BRO'} às ${purchaseOutcome.atLabel}.`,
                `Paid in ${purchaseOutcome.currency === 'exp' ? 'EXP' : 'BRO'} at ${purchaseOutcome.atLabel}.`,
              )} ${
                purchaseOutcome.item.consumable
                  ? L('O item está no inventário: abra Meu Time, escolha um jogador e aplique o consumível.', 'The item is in your inventory: open My Team, pick a player and apply the consumable.')
                  : L('O pedido do pack foi registrado; veja também a mensagem na caixa do clube.', 'Your pack order was recorded; also check the message in the club inbox.')
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
                        label: L('Ir a Meu Time', 'Go to My Team'),
                        variant: 'primary' as const,
                        onClick: () => {
                          setPurchaseOutcome(null);
                          navigate('/team');
                        },
                      },
                    ]
                  : []),
                {
                  label: purchaseOutcome.item.consumable ? L('Ficar na loja', 'Stay in store') : 'OK',
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
                    label: L('Ir à Wallet', 'Go to Wallet'),
                    variant: 'primary' as const,
                    onClick: () => {
                      setPurchaseOutcome(null);
                      navigate('/wallet');
                    },
                  },
                  {
                    label: L('Fechar', 'Close'),
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

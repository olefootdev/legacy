import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getGameState, useGameDispatch, useGameStore } from '@/game/store';
import { ManagerOutcomePanel } from '@/components/manager/ManagerOutcomePanel';
import { cn } from '@/lib/utils';
import type { ShopCatalogItem, ShopRarity, ShopTabId } from '@/game/shopCatalog';
import { trackGrowthCommerce } from '@/admin/platformStore';
import { StoreFeaturedBoxes } from '@/store/StoreFeaturedBoxes';
import { trackMissionEvent } from '@/progression/trackEvent';
import { BackButton } from '@/components/BackButton';
import { LegendaryBadge } from '@/store/LegendaryBadge';
import { PremiumPriceReveal } from '@/store/PremiumPriceReveal';
import { StoreViewToggle, type StoreViewMode } from '@/store/StoreViewToggle';
import { StoreItemList } from '@/store/StoreItemList';
import { BotaoRua, FitaRua, SecaoRua, SeloRua } from '@/components/ui/Rua';
import { L, LOCALE } from '@/i18n/L';

type ShopTab = 'todos' | ShopTabId;

type StorePurchaseOutcome =
  | { kind: 'success'; item: ShopCatalogItem; atLabel: string; currency: 'exp' | 'bro' }
  | { kind: 'error'; title: string; message: string };

/**
 * Estilo por raridade do pack — a ESCADA do DS 2027 ("Respeito é ouro").
 *
 * Antes (VOLT2) a raridade se lia pelo grau de amarelo. No DS 2027 o amarelo
 * é só de AÇÃO (o botão de comprar), então a raridade sobe a escada:
 *   comum  → 01 CHÃO     (contorno tracejado: a carta base)
 *   raro   → concreto chapado (superfície, ainda sem fio)
 *   épico  → 03 RESPEITO (asfalto + fio de ouro)
 *   mítico → 04 LENDA    (ouro chapado — raro de propósito)
 * Ouro e rua não disputam a mesma peça: na carta de ouro o botão é asfalto.
 */
type BotaoLoja = 'corre' | 'contorno' | 'asfalto-ouro';
function rarityStyles(r: ShopRarity): {
  /** Fundo/borda/texto da carta. */
  carta: string;
  label: string;
  /** Selo da raridade. */
  selo: 'mudo' | 'cal' | 'ouro-contorno' | 'ouro';
  /** Texto secundário (descrição, moeda) dentro da carta. */
  sub: string;
  botao: BotaoLoja;
} {
  switch (r) {
    case 'comum':
      return { carta: 'border-2 border-dashed border-fio bg-asfalto-27 text-papel', label: L('Comum', 'Common'), selo: 'mudo', sub: 'text-suave', botao: 'contorno' };
    case 'raro':
      return { carta: 'bg-concreto text-papel', label: L('Raro', 'Rare'), selo: 'cal', sub: 'text-suave', botao: 'contorno' };
    case 'epico':
      return { carta: 'border-[3px] border-ouro-27 bg-asfalto-27 text-papel', label: L('Épico', 'Epic'), selo: 'ouro-contorno', sub: 'text-suave', botao: 'contorno' };
    case 'mitico':
      return { carta: 'bg-ouro-27 text-asfalto-27', label: L('Mítico', 'Mythic'), selo: 'ouro', sub: 'text-asfalto-27/75', botao: 'asfalto-ouro' };
    default:
      return { carta: 'bg-concreto text-papel', label: '', selo: 'mudo', sub: 'text-suave', botao: 'contorno' };
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
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-8 overflow-x-hidden px-3 pb-28 sm:px-4 md:pb-12">
      <BackButton to="/mercado" label={L('Mercado', 'Market')} />

      {/* ── HERO: título na voz + saldo no degrau RESPEITO ─────────────── */}
      <section aria-label={L('Loja Olefoot', 'Olefoot Store')} className="flex min-w-0 flex-col gap-5">
        <div className="flex min-w-0 flex-col gap-1">
          <SecaoRua label={tabMeta.eyebrow} />
          <h1 className="flex flex-col font-impact uppercase leading-[0.88]">
            <span className="font-voz text-[clamp(48px,13vw,84px)] normal-case leading-[0.9] text-papel">{L('Loja', 'Store')}</span>
            <span className="text-[clamp(30px,8.5vw,54px)] text-rua">{L('Arma o teu time.', 'Gear up your team.')}</span>
          </h1>
        </div>

        <div className="grid min-w-0 grid-cols-2 border-[3px] border-ouro-27 bg-asfalto-27">
          <div className="flex min-w-0 flex-col gap-1 p-4 sm:p-5">
            <span className="font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-mudo">{L('Saldo', 'Balance')} · EXP</span>
            <span className="block min-w-0 font-spray text-[clamp(24px,7vw,48px)] font-black leading-[0.9] tabular-nums text-ouro-27 [overflow-wrap:anywhere]">{expDisplay}</span>
          </div>
          <div className="flex min-w-0 flex-col gap-1 border-l-2 border-linha p-4 sm:p-5">
            <span className="font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-mudo">{L('Saldo', 'Balance')} · BRO</span>
            <span className="block min-w-0 font-spray text-[clamp(24px,7vw,48px)] font-black leading-[0.9] tabular-nums text-papel [overflow-wrap:anywhere]">{broDisplay}</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <BotaoRua onClick={() => setTab('packs')}>
            {L('Ver packs', 'View packs')} <span aria-hidden>→</span>
          </BotaoRua>
          <BotaoRua variante="contorno" to="/wallet" className="px-5 text-[18px]">
            {L('Carteira', 'Wallet')}
          </BotaoRua>
        </div>
      </section>

      {/* ── MOMENTO RUA: a fita da casa ─────────────────────────────────── */}
      <FitaRua tags={['#lojadarua', '#correloko', '#persista']} inclinacao={-2} className="py-2" />

      {/* Abas */}
      <div role="tablist" aria-label={L('Categorias', 'Categories')} className="flex min-w-0 flex-wrap gap-2">
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
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'inline-flex min-h-[44px] items-center px-4 font-impact text-[17px] uppercase leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rua',
              tab === t.id
                ? 'bg-rua text-asfalto-27'
                : 'border-2 border-linha text-mudo hover:border-papel hover:text-papel',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Título da vitrine + toggle */}
      <div className="flex min-w-0 items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <SecaoRua
            label={`${filtered.length} ${filtered.length === 1 ? L('item disponível', 'item available') : L('itens disponíveis', 'items available')}`}
          />
          <h2 className="block min-w-0 font-voz text-[clamp(32px,9vw,48px)] leading-[0.95] text-papel">
            {tab === 'todos' ? L('Raros da semana', 'Rares of the week') : L(`Todos os ${TAB_META[tab].eyebrow}`, `All ${TAB_META[tab].eyebrow}`)}
          </h2>
        </div>
        <StoreViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {/* Visualização dinâmica: Grid ou Lista */}
      {viewMode === 'list' ? (
        <StoreItemList
          items={filtered}
          inventory={inventory}
          onSelect={(item) => { setPurchaseErr(null); setConfirmItem(item); }}
        />
      ) : filtered.length === 0 ? (
        <p className="border-2 border-dashed border-fio px-5 py-8 text-center font-sans text-[14px] text-suave">
          {L('Nenhum item nesta categoria por enquanto.', 'No items in this category yet.')}
        </p>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item, index) => {
            const rs = rarityStyles(item.rarity);
            const inv = inventory[item.id] ?? 0;
            const handleSelect = () => { setPurchaseErr(null); setConfirmItem(item); };
            const broText = item.priceBroCents != null && item.priceBroCents > 0 ? formatBro(item.priceBroCents) : null;
            const expText = item.priceExp != null && item.priceExp > 0 ? item.priceExp.toLocaleString(LOCALE) : null;
            const lenda = item.rarity === 'mitico';
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
                    'group relative isolate flex h-full min-w-0 cursor-pointer flex-col gap-4 p-5 transition-transform duration-200 hover:-translate-y-1',
                    rs.carta,
                    // Mítico é lambe colado: torto e com sombra dura de papel.
                    lenda && '-rotate-1 shadow-[6px_6px_0_var(--color-papel)] hover:rotate-0',
                  )}
                >
                  {/* Selos: raridade + destaque + inventário */}
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {rs.label ? (
                      <SeloRua tom={rs.selo} className={cn(lenda && 'bg-asfalto-27 text-ouro-27')}>{rs.label}</SeloRua>
                    ) : null}
                    <LegendaryBadge rarity={item.rarity} featured={item.featured} />
                    {item.consumable && inv > 0 ? (
                      <SeloRua tom={lenda ? 'cal' : 'mudo'} className="ml-auto">
                        {inv}× {L('no inventário', 'in inventory')}
                      </SeloRua>
                    ) : null}
                  </div>

                  <h3 className="line-clamp-2 font-impact text-[clamp(24px,6.5vw,30px)] uppercase leading-[0.95]">
                    {item.title}
                  </h3>

                  <p className={cn('line-clamp-2 font-sans text-[13px] leading-snug', rs.sub)}>
                    {item.blurb}
                  </p>

                  {/* Preço — Anton; a moeda em mono. */}
                  <div className={cn('mt-auto flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 border-t-2 pt-3', lenda ? 'border-asfalto-27' : 'border-linha')}>
                    {broText ? (
                      <span className="inline-flex items-baseline gap-1.5">
                        <span className="font-impact text-[clamp(26px,7vw,32px)] leading-none tabular-nums">{broText}</span>
                        <span className={cn('font-prova text-[11px] font-bold tracking-[0.16em]', rs.sub)}>BRO</span>
                      </span>
                    ) : null}
                    {broText && expText ? (
                      <span className={cn('font-prova text-[11px] uppercase tracking-[0.2em]', rs.sub)}>{L('ou', 'or')}</span>
                    ) : null}
                    {expText ? (
                      <span className="inline-flex items-baseline gap-1.5">
                        <span className="font-impact text-[clamp(26px,7vw,32px)] leading-none tabular-nums">{expText}</span>
                        <span className={cn('font-prova text-[11px] font-bold tracking-[0.16em]', rs.sub)}>EXP</span>
                      </span>
                    ) : null}
                  </div>

                  <BotaoRua
                    variante={rs.botao}
                    onClick={handleSelect}
                    className="w-full"
                  >
                    {L('Comprar', 'Buy')} <span aria-hidden>→</span>
                  </BotaoRua>
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
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setConfirmItem(null)}
          >
            {/* O RECIBO: corpo de concreto, picote e o canhoto com o preço em spray. */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className={cn(
                'relative flex max-h-[92vh] w-full max-w-md min-w-0 flex-col overflow-hidden bg-concreto text-papel',
                confirmItem.rarity === 'mitico' ? 'border-[3px] border-ouro-27' : 'border-2 border-linha',
              )}
              role="dialog"
              aria-modal="true"
              aria-labelledby="store-checkout-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rua-grao flex min-w-0 items-start justify-between gap-3 px-5 pb-4 pt-5">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-mudo">
                    — {L('Confirmar compra', 'Confirm purchase')}
                  </span>
                  <h2
                    id="store-checkout-title"
                    className={cn(
                      'font-impact text-[clamp(28px,8vw,38px)] uppercase leading-[0.92] [overflow-wrap:anywhere]',
                      confirmItem.rarity === 'mitico' || confirmItem.rarity === 'epico' ? 'text-ouro-27' : 'text-papel',
                    )}
                  >
                    {confirmItem.title}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {checkoutRarity?.label ? <SeloRua tom={checkoutRarity.selo}>{checkoutRarity.label}</SeloRua> : null}
                    {confirmItem.consumable ? <SeloRua tom="cal">{L('Consumível', 'Consumable')}</SeloRua> : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmItem(null)}
                  className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center text-mudo transition-colors hover:text-papel"
                  aria-label={L('Fechar', 'Close')}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-5 pb-5">
                <p className="font-sans text-[14px] leading-relaxed text-suave">{confirmItem.blurb}</p>
                <span className="block font-prova text-[11px] uppercase tracking-[0.12em] text-fio">ID · {confirmItem.id}</span>
              </div>

              {/* Picote */}
              <div aria-hidden className="relative h-3 shrink-0">
                <span className="rua-picote-h absolute inset-x-0 top-1/2 h-2 -translate-y-1/2" />
              </div>

              {/* Canhoto */}
              <div className="flex min-w-0 flex-col gap-4 bg-asfalto-27 px-5 pb-5 pt-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-mudo">{L('Preço', 'Price')}</span>
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
                    {checkoutPrices?.exp ? (
                      <span className="font-spray text-[clamp(36px,10vw,48px)] font-black leading-[0.9] tabular-nums text-papel">{checkoutPrices.exp}</span>
                    ) : null}
                    {checkoutPrices?.bro && checkoutPrices?.exp ? (
                      <span className="font-prova text-[11px] uppercase tracking-[0.2em] text-mudo">{L('ou', 'or')}</span>
                    ) : null}
                    {checkoutPrices?.bro ? (
                      <span className="font-spray text-[clamp(36px,10vw,48px)] font-black leading-[0.9] tabular-nums text-papel">{checkoutPrices.bro}</span>
                    ) : null}
                    {!checkoutPrices?.bro && !checkoutPrices?.exp ? (
                      <span className="font-sans text-sm text-mudo">{L('Sem preço definido', 'No price set')}</span>
                    ) : null}
                  </div>
                  <span className="font-prova text-[11px] uppercase tracking-[0.12em] text-mudo">
                    {L('Teu saldo', 'Your balance')} · <span className="text-ouro-27">{expDisplay} EXP</span> · <span className="text-papel">{broDisplay} BRO</span>
                  </span>
                </div>

                {purchaseErr ? (
                  <div className="flex min-w-0 flex-col gap-2 border-l-4 border-baixa bg-concreto px-4 py-3">
                    <p className="font-sans text-[13px] font-semibold leading-snug text-papel">{purchaseErr}</p>
                    <Link
                      to="/wallet"
                      className="inline-flex min-h-[44px] items-center gap-2 self-start font-impact text-[17px] uppercase text-rua hover:text-papel"
                    >
                      {L('Ver saldo na Wallet', 'Check balance in Wallet')} <span aria-hidden>→</span>
                    </Link>
                  </div>
                ) : null}

                <div className="flex min-w-0 flex-col gap-3">
                  {confirmItem.priceExp != null && confirmItem.priceExp > 0 ? (
                    <BotaoRua
                      disabled={!canExpBuy}
                      onClick={() => tryPurchase(confirmItem, 'exp')}
                      className="w-full px-4 text-[19px]"
                    >
                      {L('Pagar', 'Pay')} {checkoutPrices?.exp ?? 'EXP'} <span aria-hidden>→</span>
                    </BotaoRua>
                  ) : null}
                  {confirmItem.priceBroCents != null && confirmItem.priceBroCents > 0 ? (
                    <BotaoRua
                      variante="contorno"
                      disabled={!canBroBuy}
                      onClick={() => tryPurchase(confirmItem, 'bro')}
                      className="w-full px-4 text-[19px]"
                    >
                      {L('Pagar', 'Pay')} {checkoutPrices?.bro ?? 'BRO'}
                    </BotaoRua>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setConfirmItem(null)}
                    className="inline-flex min-h-[44px] items-center justify-center font-prova text-[12px] font-bold uppercase tracking-[0.2em] text-mudo transition-colors hover:text-papel"
                  >
                    {L('Cancelar', 'Cancel')}
                  </button>
                </div>
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

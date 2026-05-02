import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Plus, RotateCcw, Save, ShoppingBag, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import {
  defaultShopCatalog,
  normalizeShopCatalog,
  normalizeShopCatalogItem,
  shopEffectScope,
  type ShopCatalogItem,
  type ShopItemEffect,
  type ShopRarity,
  type ShopTabId,
} from '@/game/shopCatalog';
import { saveShopCatalogToSupabase } from '@/supabase/platformShopCatalog';

const TABS: ShopTabId[] = ['boosters', 'packs', 'extra'];
const RARITIES: ShopRarity[] = ['comum', 'raro', 'epico', 'mitico'];

const EFFECT_PRESETS: { id: string; label: string; consumable: boolean; effect: ShopItemEffect | null }[] = [
  { id: 'pack', label: 'Pack (só compra, sem uso)', consumable: false, effect: null },
  { id: 'fatigue0', label: 'Zerar fadiga (plantel)', consumable: true, effect: { kind: 'reset_squad_fatigue' } },
  { id: 'fatigueD', label: 'Reduzir fadiga (plantel, −25)', consumable: true, effect: { kind: 'reduce_squad_fatigue', delta: 25 } },
  { id: 'risk', label: 'Reduzir risco lesão (plantel, −15)', consumable: true, effect: { kind: 'reduce_squad_injury_risk', delta: 15 } },
  { id: 'inj1', label: 'Reduzir 1 jogo de lesão (1 jogador)', consumable: true, effect: { kind: 'reduce_player_injury', matches: 1 } },
  { id: 'crowd', label: 'Apoio da torcida (+12)', consumable: true, effect: { kind: 'boost_crowd_support', deltaPercent: 12 } },
  { id: 'scout', label: 'Renovar mercado NPC', consumable: true, effect: { kind: 'refresh_npc_market' } },
  { id: 'exp500', label: 'EXP ganho (+500)', consumable: true, effect: { kind: 'grant_earned_exp', amount: 500 } },
];

function presetIdForRow(row: ShopCatalogItem): string {
  if (!row.consumable) return 'pack';
  const hit = EFFECT_PRESETS.find(
    (p) => p.consumable && p.effect && JSON.stringify(p.effect) === JSON.stringify(row.effect),
  );
  return hit?.id ?? 'custom';
}

function emptyItem(): ShopCatalogItem {
  const pr = EFFECT_PRESETS.find((p) => p.id === 'fatigue0')!;
  return normalizeShopCatalog([
    {
      id: `item_${Date.now().toString(36)}`,
      title: 'Novo item',
      blurb: 'Descrição curta.',
      tab: 'boosters',
      rarity: 'comum',
      iconKey: 'zap',
      priceBroCents: null,
      priceExp: 100,
      consumable: pr.consumable,
      effect: pr.effect,
    },
  ])[0]!;
}

export function AdminShopPanel() {
  const dispatch = useGameDispatch();
  const storeCatalog = useGameStore((s) => s.shopCatalog);
  const inventory = useGameStore((s) => s.shopInventory);
  const [draft, setDraft] = useState<ShopCatalogItem[]>(storeCatalog);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setDraft(storeCatalog);
  }, [storeCatalog]);

  const invSummary = useMemo(() => {
    const rows = Object.entries(inventory)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => {
        const it = storeCatalog.find((x) => x.id === id);
        return { id, n, title: it?.title ?? id };
      });
    rows.sort((a, b) => a.title.localeCompare(b.title));
    return rows;
  }, [inventory, storeCatalog]);

  const persist = async () => {
    const next = normalizeShopCatalog(draft);
    const items = next.length ? next : defaultShopCatalog();
    dispatch({ type: 'ADMIN_SET_SHOP_CATALOG', items });
    // Persiste no Supabase para todos os managers receberem no próximo boot
    void saveShopCatalogToSupabase(items);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  };

  const resetDefaults = () => {
    const d = defaultShopCatalog();
    setDraft(d);
    dispatch({ type: 'ADMIN_SET_SHOP_CATALOG', items: d });
    void saveShopCatalogToSupabase(d);
  };

  const patchAt = (idx: number, partial: Partial<ShopCatalogItem>) => {
    setDraft((prev) => {
      const copy = [...prev];
      const cur = copy[idx];
      if (!cur) return prev;
      const merged = normalizeShopCatalogItem({ ...cur, ...partial });
      if (merged) copy[idx] = merged;
      return copy;
    });
  };

  const removeAt = (idx: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/20 px-4 py-3 text-sm text-white/90">
        <p className="font-display text-lg font-black text-white">Loja &amp; boosters</p>
        <p className="mt-1 text-white/70">
          Cadastro de itens à venda. Itens <strong className="text-white">consumíveis</strong> entram no inventário do
          save; o jogador usa em <strong className="text-white">Meu Time</strong> ao abrir um jogador. Preços:{' '}
          <strong className="text-white">BRO</strong> em centavos (1 BRO = 100) e <strong className="text-white">EXP</strong>{' '}
          inteiro.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={persist}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-display text-xs font-black uppercase tracking-wide transition',
            savedFlash
              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
              : 'border-neon-yellow/40 bg-neon-yellow/10 text-neon-yellow hover:bg-neon-yellow/20',
          )}
        >
          <Save className="h-4 w-4" />
          {savedFlash ? 'Guardado' : 'Guardar catálogo'}
        </button>
        <button
          type="button"
          onClick={resetDefaults}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-black/40 px-4 py-2 font-display text-xs font-bold uppercase tracking-wide text-white/80 hover:bg-white/10"
        >
          <RotateCcw className="h-4 w-4" />
          Restaurar padrão OLEFOOT
        </button>
        <button
          type="button"
          onClick={() => setDraft((d) => [...d, emptyItem()])}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-black/40 px-4 py-2 font-display text-xs font-bold uppercase tracking-wide text-white/80 hover:bg-white/10"
        >
          <Plus className="h-4 w-4" />
          Novo item
        </button>
      </div>

      {invSummary.length ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="font-display text-[10px] font-black uppercase tracking-widest text-white/40">
            Inventário neste save (teste)
          </p>
          <ul className="mt-2 space-y-1 text-xs text-white/80">
            {invSummary.map((r) => (
              <li key={r.id}>
                <span className="font-mono text-neon-yellow">{r.n}×</span> {r.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-4">
        {draft.map((row, idx) => (
          <div
            key={`${row.id}-${idx}`}
            className="rounded-xl border border-white/10 bg-black/35 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-display text-xs font-bold text-white/50">
                <ShoppingBag className="h-4 w-4 text-fuchsia-400" />
                #{idx + 1} ·{' '}
                <span className="text-white/35">Escopo: {shopEffectScope(row.consumable ? row.effect : null)}</span>
              </div>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-rose-200 hover:bg-rose-500/20"
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase text-white/40">ID (slug)</span>
                <input
                  value={row.id}
                  onChange={(e) => patchAt(idx, { id: e.target.value.trim() })}
                  className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 font-mono text-xs text-white"
                />
              </label>
              <label className="block space-y-1 md:col-span-2">
                <span className="text-[10px] font-bold uppercase text-white/40">Título</span>
                <input
                  value={row.title}
                  onChange={(e) => patchAt(idx, { title: e.target.value })}
                  className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1 md:col-span-3">
                <span className="text-[10px] font-bold uppercase text-white/40">Descrição</span>
                <textarea
                  value={row.blurb}
                  onChange={(e) => patchAt(idx, { blurb: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase text-white/40">Separador</span>
                <select
                  value={row.tab}
                  onChange={(e) => patchAt(idx, { tab: e.target.value as ShopTabId })}
                  className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                >
                  {TABS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase text-white/40">Raridade</span>
                <select
                  value={row.rarity}
                  onChange={(e) => patchAt(idx, { rarity: e.target.value as ShopRarity })}
                  className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                >
                  {RARITIES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase text-white/40">Ícone (zap, gem, …)</span>
                <input
                  value={row.iconKey}
                  onChange={(e) => patchAt(idx, { iconKey: e.target.value })}
                  className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 font-mono text-xs text-white"
                />
              </label>
              <label className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  checked={row.featured ?? false}
                  onChange={(e) => patchAt(idx, { featured: e.target.checked })}
                />
                <span className="text-xs font-bold text-white/70">Featured</span>
              </label>
              <label className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  checked={row.consumable}
                  onChange={(e) => {
                    const on = e.target.checked;
                    patchAt(idx, {
                      consumable: on,
                      effect: on ? row.effect ?? { kind: 'reset_squad_fatigue' } : null,
                    });
                  }}
                />
                <span className="text-xs font-bold text-white/70">Consumível (inventário)</span>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase text-white/40">Preço BRO (centavos)</span>
                <input
                  type="number"
                  min={0}
                  value={row.priceBroCents ?? ''}
                  placeholder="vazio"
                  onChange={(e) => {
                    const v = e.target.value;
                    patchAt(idx, { priceBroCents: v === '' ? null : Math.max(0, Math.round(Number(v))) });
                  }}
                  className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 font-mono text-xs text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase text-white/40">Preço EXP</span>
                <input
                  type="number"
                  min={0}
                  value={row.priceExp ?? ''}
                  placeholder="vazio"
                  onChange={(e) => {
                    const v = e.target.value;
                    patchAt(idx, { priceExp: v === '' ? null : Math.max(0, Math.round(Number(v))) });
                  }}
                  className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 font-mono text-xs text-white"
                />
              </label>
              <label className="block space-y-1 md:col-span-2">
                <span className="text-[10px] font-bold uppercase text-white/40">Efeito ao usar</span>
                <select
                  value={presetIdForRow(row)}
                  onChange={(e) => {
                    const pr = EFFECT_PRESETS.find((p) => p.id === e.target.value);
                    if (!pr) return;
                    patchAt(idx, { consumable: pr.consumable, effect: pr.effect });
                  }}
                  className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                >
                  {EFFECT_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                  <option value="custom" disabled>
                    Efeito personalizado (ajuste manual / import)
                  </option>
                </select>
              </label>
            </div>

            {/* Label image upload */}
            <LabelImageUpload
              value={row.labelImageUrl}
              onChange={(url) => patchAt(idx, { labelImageUrl: url })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const LABEL_IMAGE_IDEAL_W = 480;
const LABEL_IMAGE_IDEAL_H = 300;

function LabelImageUpload({
  value,
  onChange,
}: {
  value?: string;
  onChange: (url: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') onChange(result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: import('react').DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleFile(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase text-white/40">
          Imagem de rótulo
        </span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-mono text-white/30">
          Ideal: {LABEL_IMAGE_IDEAL_W} × {LABEL_IMAGE_IDEAL_H} px · ratio 8:5 · PNG ou WebP
        </span>
      </div>

      {value ? (
        <div className="relative inline-block">
          <img
            src={value}
            alt="Label"
            className="h-[90px] w-[144px] rounded-lg border border-white/10 object-cover"
          />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute -right-2 -top-2 rounded-full bg-black/80 p-1 text-white/60 hover:text-white"
            aria-label="Remover imagem"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="flex h-[90px] w-[144px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 bg-white/[0.03] text-white/30 transition hover:border-white/25 hover:bg-white/[0.06] hover:text-white/50"
        >
          <ImagePlus className="h-5 w-5" />
          <span className="text-[9px] font-semibold uppercase tracking-wider">Upload</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/webp,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

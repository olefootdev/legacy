import { useCallback, useEffect, useState } from 'react';
import { Image as ImageIcon, RotateCcw, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameDispatch, useGameStore } from '@/game/store';
import {
  BANNER_PRESETS_FALLBACK,
  BANNER_SLOT_IDS,
  BANNER_SLOT_META,
  isSafePresetFilename,
  resolveUiBannerImageUrl,
  type BannerSlotId,
} from '@/ui/banners';

type Manifest = { version?: number; presets?: { file: string; label?: string }[] };

async function loadPresetCatalog(): Promise<{ file: string; label: string }[]> {
  try {
    const r = await fetch('/banners/manifest.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('no manifest');
    const j = (await r.json()) as Manifest;
    if (!j.presets || !Array.isArray(j.presets)) throw new Error('bad');
    const out: { file: string; label: string }[] = [];
    for (const p of j.presets) {
      if (!p || typeof p !== 'object' || typeof p.file !== 'string') continue;
      if (!isSafePresetFilename(p.file)) continue;
      out.push({ file: p.file, label: typeof p.label === 'string' ? p.label : p.file });
    }
    return out.length ? out : BANNER_PRESETS_FALLBACK;
  } catch {
    return BANNER_PRESETS_FALLBACK;
  }
}

export function AdminBannersPanel() {
  const dispatch = useGameDispatch();
  const uiBanners = useGameStore((s) => s.uiBanners);
  const [catalog, setCatalog] = useState(BANNER_PRESETS_FALLBACK);
  const [slot, setSlot] = useState<BannerSlotId>(BANNER_SLOT_IDS[0]!);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  useEffect(() => {
    void loadPresetCatalog().then(setCatalog);
  }, []);

  const current = uiBanners[slot];
  const previewUrl = resolveUiBannerImageUrl(current);

  const setPreset = (file: string) => {
    dispatch({ type: 'ADMIN_SET_UI_BANNER', slot, entry: { kind: 'preset', file } });
    setUploadErr(null);
  };

  const clearSlot = () => {
    dispatch({ type: 'ADMIN_SET_UI_BANNER', slot, entry: { kind: 'none' } });
    setUploadErr(null);
  };

  const onFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f || !f.type.startsWith('image/')) {
        setUploadErr('Escolhe uma imagem (PNG, JPG, WebP, SVG).');
        return;
      }
      if (f.size > 1_200_000) {
        setUploadErr('Ficheiro grande demais — usa menos de ~1,2 MB ou um preset.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        if (!dataUrl.startsWith('data:image/')) {
          setUploadErr('Leitura inválida.');
          return;
        }
        if (dataUrl.length > 2_000_000) {
          setUploadErr('Imagem demasiado pesada para o save local.');
          return;
        }
        dispatch({ type: 'ADMIN_SET_UI_BANNER', slot, entry: { kind: 'custom', dataUrl } });
        setUploadErr(null);
      };
      reader.readAsDataURL(f);
    },
    [dispatch, slot],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-neon-yellow/30 bg-neon-yellow/10 px-4 py-3 text-sm text-white/90">
        <p className="font-display text-lg font-black text-white">Banners da UI</p>
        <p className="mt-1 text-white/70">
          Coloca ficheiros em{' '}
          <code className="rounded bg-black/40 px-1 text-neon-yellow/90">public/banners/presets/</code> e lista-os em{' '}
          <code className="rounded bg-black/40 px-1 text-neon-yellow/90">public/banners/manifest.json</code> para
          aparecerem na grelha abaixo. Cada zona do jogo tem o seu próprio slot.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,220px),1fr]">
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Zona</p>
          <div className="flex flex-col gap-1">
            {BANNER_SLOT_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSlot(id)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-xs font-bold transition-colors',
                  slot === id
                    ? 'border-neon-yellow bg-neon-yellow/15 text-neon-yellow'
                    : 'border-white/10 bg-black/30 text-white/60 hover:border-white/25 hover:text-white',
                )}
              >
                {BANNER_SLOT_META[id].label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <p className="text-sm text-white/55">{BANNER_SLOT_META[slot].hint}</p>
            <div className="relative mt-3 h-28 overflow-hidden rounded-xl border border-white/15 bg-black/50">
              {previewUrl ? (
                <img src={previewUrl} alt="" className="h-full w-full object-cover opacity-80" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-white/35">
                  <ImageIcon className="mr-2 h-5 w-5 shrink-0" />
                  Padrão do jogo (sem banner)
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/85 hover:bg-white/10">
              <Upload className="h-3.5 w-3.5 shrink-0" />
              Carregar imagem
              <input type="file" accept="image/*" className="hidden" onChange={onFile} />
            </label>
            <button
              type="button"
              onClick={clearSlot}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/70 hover:bg-white/10"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              Repor zona
            </button>
          </div>
          {uploadErr ? <p className="text-xs text-red-400">{uploadErr}</p> : null}

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">Presets</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {catalog.map((p) => {
                const active = current?.kind === 'preset' && current.file === p.file;
                return (
                  <button
                    key={p.file}
                    type="button"
                    onClick={() => setPreset(p.file)}
                    className={cn(
                      'overflow-hidden rounded-lg border text-left transition-colors',
                      active ? 'border-neon-yellow ring-1 ring-neon-yellow/50' : 'border-white/10 hover:border-white/30',
                    )}
                  >
                    <div className="aspect-[3/1] bg-black/40">
                      <img
                        src={`/banners/presets/${p.file}`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="truncate px-2 py-1.5 text-[10px] font-bold text-white/75">{p.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

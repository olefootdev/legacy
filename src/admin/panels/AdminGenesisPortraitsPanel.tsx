/**
 * Admin — Genesis Player Portraits
 * Upload, crop (card 3:4 + token 1:1), preview — destino: Supabase Storage ou Pinata (dois botões no modal).
 */
import type React from 'react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  CloudUpload,
  Link2,
  Loader2,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  hostedMediaDescriptorToStoredVariant,
  type GenesisPortraitMediaRefs,
} from '@/media/hostedMediaTypes';
import { uploadImageToPinataViaServer } from '@/media/pinataUploadClient';
import { getSupabase, isSupabaseConfigured } from '@/supabase/client';
import type { GenesisMarketPlayerRow } from '@/supabase/genesisMarket';
import { GenesisPinataFolderCidBlock } from '@/admin/panels/GenesisPinataFolderCidBlock';
import { GenesisPinataManualUrlsBlock } from '@/admin/panels/GenesisPinataManualUrlsBlock';
import { fetchGenesisMarketPlayerRowsOrdered, genesisPortraitImageUrl, genesisTokenImageUrl } from '@/supabase/genesisMarket';

const CARD_W = 300;
const CARD_H = 400;
const TOKEN_SIZE = 200;

const BUCKET = 'genesis-player-portraits';

function isHttpImageUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function truncateMiddle(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  const keep = Math.max(8, Math.floor((maxLen - 3) / 2));
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
}

type CropState = { offsetX: number; offsetY: number; scale: number };

function defaultCrop(): CropState {
  return { offsetX: 0, offsetY: 0, scale: 1 };
}

async function renderCrop(
  img: HTMLImageElement,
  crop: CropState,
  outW: number,
  outH: number,
  circular: boolean,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;

  if (circular) {
    ctx.beginPath();
    ctx.arc(outW / 2, outH / 2, outW / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
  }

  const imgAspect = img.naturalWidth / img.naturalHeight;
  const outAspect = outW / outH;

  let drawW: number;
  let drawH: number;
  if (imgAspect > outAspect) {
    drawH = outH * crop.scale;
    drawW = drawH * imgAspect;
  } else {
    drawW = outW * crop.scale;
    drawH = drawW / imgAspect;
  }

  const drawX = (outW - drawW) / 2 + crop.offsetX * outW;
  const drawY = (outH - drawH) / 2 + crop.offsetY * outH;

  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/webp',
      0.88,
    );
  });
}

function CropPreview({
  imageSrc,
  crop,
  onCropChange,
  width,
  height,
  circular,
  label,
}: {
  imageSrc: string;
  crop: CropState;
  onCropChange: (c: CropState) => void;
  width: number;
  height: number;
  circular: boolean;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const previewScale = Math.min(1, 200 / width);
  const pw = Math.round(width * previewScale);
  const ph = Math.round(height * previewScale);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const dx = (e.clientX - lastPos.current.x) / pw;
      const dy = (e.clientY - lastPos.current.y) / ph;
      lastPos.current = { x: e.clientX, y: e.clientY };
      onCropChange({ ...crop, offsetX: crop.offsetX + dx, offsetY: crop.offsetY + dy });
    },
    [crop, onCropChange, pw, ph],
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const imgStyle = (): React.CSSProperties => {
    if (!imgRef.current) return {};
    const img = imgRef.current;
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const outAspect = width / height;
    let drawW: number;
    let drawH: number;
    if (imgAspect > outAspect) {
      drawH = 100 * crop.scale;
      drawW = drawH * imgAspect * (height / width);
    } else {
      drawW = 100 * crop.scale;
      drawH = drawW / imgAspect * (width / height);
    }
    return {
      width: `${drawW}%`,
      height: `${drawH}%`,
      left: `${50 + crop.offsetX * 100}%`,
      top: `${50 + crop.offsetY * 100}%`,
      transform: 'translate(-50%, -50%)',
      position: 'absolute',
      objectFit: 'cover',
      pointerEvents: 'none',
    };
  };

  const [imgLoaded, setImgLoaded] = useState(false);

  const imgRefCb = useCallback((el: HTMLImageElement | null) => {
    imgRef.current = el;
    if (el && el.complete && el.naturalWidth > 0) {
      setImgLoaded(true);
    }
  }, []);

  const onImgLoad = useCallback(() => setImgLoaded(true), []);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">{label}</span>
      <div
        ref={containerRef}
        className={cn(
          'relative cursor-grab overflow-hidden border-2 border-white/20 bg-black/60 active:cursor-grabbing',
          circular ? 'rounded-full' : 'rounded-lg',
        )}
        style={{ width: pw, height: ph }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <img
          ref={imgRefCb}
          src={imageSrc}
          alt=""
          draggable={false}
          onLoad={onImgLoad}
          style={imgLoaded && imgRef.current ? imgStyle() : { opacity: 0 }}
        />
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="rounded bg-white/10 p-1 text-white/70 hover:bg-white/20"
          onClick={() => onCropChange({ ...crop, scale: Math.min(3, crop.scale + 0.1) })}
          title="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rounded bg-white/10 p-1 text-white/70 hover:bg-white/20"
          onClick={() => onCropChange({ ...crop, scale: Math.max(0.5, crop.scale - 0.1) })}
          title="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <span className="mx-1 text-[9px] text-white/30">|</span>
        <button type="button" className="rounded bg-white/10 p-1 text-white/70 hover:bg-white/20" onClick={() => onCropChange({ ...crop, offsetY: crop.offsetY - 0.03 })}><ArrowUp className="h-3 w-3" /></button>
        <button type="button" className="rounded bg-white/10 p-1 text-white/70 hover:bg-white/20" onClick={() => onCropChange({ ...crop, offsetY: crop.offsetY + 0.03 })}><ArrowDown className="h-3 w-3" /></button>
        <button type="button" className="rounded bg-white/10 p-1 text-white/70 hover:bg-white/20" onClick={() => onCropChange({ ...crop, offsetX: crop.offsetX - 0.03 })}><ArrowLeft className="h-3 w-3" /></button>
        <button type="button" className="rounded bg-white/10 p-1 text-white/70 hover:bg-white/20" onClick={() => onCropChange({ ...crop, offsetX: crop.offsetX + 0.03 })}><ArrowRight className="h-3 w-3" /></button>
        <button type="button" className="ml-1 rounded bg-white/10 px-1.5 py-1 text-[9px] font-bold text-white/50 hover:bg-white/20" onClick={() => onCropChange(defaultCrop())}>Reset</button>
      </div>
    </div>
  );
}

type GenesisPortraitSaveReceipt =
  | { kind: 'pinata'; cardUrl: string; tokenUrl: string; updatedAt: string }
  | { kind: 'storage'; cardPath: string; updatedAt: string };

function PlayerEditor({
  player,
  onSaved,
  onClose,
}: {
  player: GenesisMarketPlayerRow;
  onSaved: (patch?: Partial<GenesisMarketPlayerRow>) => void;
  onClose: () => void;
}) {
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [rawDataUrl, setRawDataUrl] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [cardCrop, setCardCrop] = useState<CropState>(defaultCrop);
  const [tokenCrop, setTokenCrop] = useState<CropState>(defaultCrop);
  const [savingKind, setSavingKind] = useState<null | 'storage' | 'pinata'>(null);
  const [savingPhase, setSavingPhase] = useState<null | 'upload' | 'db'>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saveReceipt, setSaveReceipt] = useState<GenesisPortraitSaveReceipt | null>(null);
  const hiddenImgRef = useRef<HTMLImageElement | null>(null);

  const existingCardUrl = genesisPortraitImageUrl(player);
  const existingTokenUrl = genesisTokenImageUrl(player);

  useEffect(() => {
    setUrlDraft('');
    setRawDataUrl(null);
    setRawFile(null);
    setCardCrop(defaultCrop());
    setTokenCrop(defaultCrop());
    setError(null);
    setSuccess(false);
    setSaveReceipt(null);
    setSavingPhase(null);
  }, [player.id]);

  const loadImageFromUrl = useCallback((url: string) => {
    const u = url.trim();
    if (!isHttpImageUrl(u)) {
      setError('Usa uma URL http(s) válida (ex.: gateway Pinata).');
      return;
    }
    setError(null);
    setSuccess(false);
    setRawFile(null);
    setRawDataUrl(u);
    setCardCrop(defaultCrop());
    setTokenCrop(defaultCrop());
  }, []);

  const loadFromUrlDraft = useCallback(() => {
    loadImageFromUrl(urlDraft);
  }, [urlDraft, loadImageFromUrl]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setRawFile(f);
    setError(null);
    setSuccess(false);
    const reader = new FileReader();
    reader.onload = () => setRawDataUrl(reader.result as string);
    reader.readAsDataURL(f);
    setCardCrop(defaultCrop());
    setTokenCrop(defaultCrop());
  }, []);

  const performSave = useCallback(
    async (mode: 'storage' | 'pinata') => {
      if (!rawDataUrl || !hiddenImgRef.current) return;
      const sb = getSupabase();
      if (!sb) {
        setError('Supabase não configurado');
        return;
      }
      setSavingKind(mode);
      setSavingPhase('upload');
      setSaveReceipt(null);
      setError(null);
      try {
        const img = hiddenImgRef.current;
        const [cardBlob, tokenBlob] = await Promise.all([
          renderCrop(img, cardCrop, CARD_W, CARD_H, false),
          renderCrop(img, tokenCrop, TOKEN_SIZE, TOKEN_SIZE, true),
        ]);
        const cardPath = `genesis/${player.id}-card.webp`;
        const tokenPath = `genesis/${player.id}-token.webp`;
        const nowIso = new Date().toISOString();

        if (mode === 'pinata') {
          const cardFile = new File([cardBlob], `${player.id}-card.webp`, { type: 'image/webp' });
          const tokenFile = new File([tokenBlob], `${player.id}-token.webp`, { type: 'image/webp' });
          const [cardUp, tokenUp] = await Promise.all([
            uploadImageToPinataViaServer(cardFile, {
              entityType: 'genesis_market_player',
              entityId: player.id,
              originalName: cardFile.name,
              mimeType: 'image/webp',
            }),
            uploadImageToPinataViaServer(tokenFile, {
              entityType: 'genesis_market_player',
              entityId: player.id,
              originalName: tokenFile.name,
              mimeType: 'image/webp',
            }),
          ]);
          if (cardUp.ok === false) throw new Error(`Card Pinata: ${cardUp.error}`);
          if (tokenUp.ok === false) throw new Error(`Token Pinata: ${tokenUp.error}`);

          const refs: GenesisPortraitMediaRefs = {
            provider: 'pinata',
            entityType: 'genesis_market_player',
            entityId: player.id,
            uploadedAt: nowIso,
            card: hostedMediaDescriptorToStoredVariant(cardUp.media),
            token: hostedMediaDescriptorToStoredVariant(tokenUp.media),
          };

          setSavingPhase('db');
          const dbPatch = {
            portrait_public_url: cardUp.media.publicUrl,
            portrait_token_public_url: tokenUp.media.publicUrl,
            portrait_media_refs: refs as unknown as GenesisMarketPlayerRow['portrait_media_refs'],
            portrait_storage_path: null as null,
            updated_at: nowIso,
          };
          const { error: dbErr } = await sb
            .from('genesis_market_players')
            .update({
              portrait_public_url: dbPatch.portrait_public_url,
              portrait_token_public_url: dbPatch.portrait_token_public_url,
              portrait_media_refs: dbPatch.portrait_media_refs as unknown as Record<string, unknown>,
              portrait_storage_path: null,
              updated_at: nowIso,
            })
            .eq('id', player.id);
          if (dbErr) throw new Error(`DB update: ${dbErr.message}`);

          setSaveReceipt({
            kind: 'pinata',
            cardUrl: cardUp.media.publicUrl,
            tokenUrl: tokenUp.media.publicUrl,
            updatedAt: nowIso,
          });
          onSaved(dbPatch);
        } else {
          const uploadOpts = { cacheControl: '3600', upsert: true, contentType: 'image/webp' };
          const [cardRes, tokenRes] = await Promise.all([
            sb.storage.from(BUCKET).upload(cardPath, cardBlob, uploadOpts),
            sb.storage.from(BUCKET).upload(tokenPath, tokenBlob, uploadOpts),
          ]);
          if (cardRes.error) throw new Error(`Card upload: ${cardRes.error.message}`);
          if (tokenRes.error) throw new Error(`Token upload: ${tokenRes.error.message}`);

          setSavingPhase('db');
          const dbPatch = {
            portrait_storage_path: cardPath,
            portrait_public_url: null as null,
            portrait_token_public_url: null as null,
            portrait_media_refs: null as null,
            updated_at: nowIso,
          };
          const { error: dbErr } = await sb
            .from('genesis_market_players')
            .update({
              portrait_storage_path: cardPath,
              portrait_public_url: null,
              portrait_token_public_url: null,
              portrait_media_refs: null,
              updated_at: nowIso,
            })
            .eq('id', player.id);
          if (dbErr) throw new Error(`DB update: ${dbErr.message}`);

          setSaveReceipt({ kind: 'storage', cardPath, updatedAt: nowIso });
          onSaved(dbPatch);
        }

        setSuccess(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/taint|cross-origin|securityerror|not read.*image/i.test(msg)) {
          setError(
            'O browser bloqueou o recorte desta URL (CORS). Faz download da imagem e usa “Escolher ficheiro”, ou confirma que o gateway envia Access-Control-Allow-Origin.',
          );
        } else {
          setError(msg);
        }
      } finally {
        setSavingKind(null);
        setSavingPhase(null);
      }
    },
    [rawDataUrl, cardCrop, tokenCrop, player.id, onSaved],
  );

  const handleDelete = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setError('Supabase não configurado');
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const storedPath = player.portrait_storage_path?.trim();
      if (storedPath) {
        const tokenFromStored = storedPath.replace(/-card\./, '-token.');
        const paths =
          tokenFromStored !== storedPath ? [storedPath, tokenFromStored] : [storedPath];
        const { error: rmErr } = await sb.storage.from(BUCKET).remove(paths);
        if (rmErr) throw new Error(`Storage delete: ${rmErr.message}`);
      }

      const clearedAt = new Date().toISOString();
      const { error: dbErr } = await sb
        .from('genesis_market_players')
        .update({
          portrait_storage_path: null,
          portrait_public_url: null,
          portrait_token_public_url: null,
          portrait_media_refs: null,
          updated_at: clearedAt,
        })
        .eq('id', player.id);
      if (dbErr) throw new Error(`DB update: ${dbErr.message}`);

      setRawFile(null);
      setRawDataUrl(null);
      setSuccess(false);
      setSaveReceipt(null);
      onSaved({
        portrait_storage_path: null,
        portrait_public_url: null,
        portrait_token_public_url: null,
        portrait_media_refs: null,
        updated_at: clearedAt,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }, [player.id, player.portrait_storage_path, onSaved]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-white/15 bg-[#111] p-6">
        <button
          type="button"
          className="absolute right-4 top-4 rounded-full bg-white/10 p-1 text-white/60 hover:bg-white/20"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="font-display text-lg font-black">
          <span className="text-neon-yellow">#{player.kit_number}</span> {player.name}
        </h3>
        <p className="mb-4 text-xs text-white/40">
          {player.pos} · {player.id}
        </p>

        {existingCardUrl && (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-bold uppercase text-white/30">Card atual</span>
              <img src={existingCardUrl} alt="" className="h-24 rounded border border-white/10 object-cover" crossOrigin="anonymous" />
            </div>
            {existingTokenUrl && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-[9px] font-bold uppercase text-white/30">Token atual</span>
                <img src={existingTokenUrl} alt="" className="h-16 w-16 rounded-full border border-white/10 object-cover" crossOrigin="anonymous" />
              </div>
            )}
            <button
              type="button"
              disabled={deleting}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
              onClick={handleDelete}
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {deleting ? 'Excluindo...' : 'Excluir foto'}
            </button>
          </div>
        )}

        <div className="mb-4 rounded-lg border border-cyan-500/25 bg-cyan-500/[0.07] px-3 py-3">
          <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-cyan-200/80">
            <Link2 className="h-3.5 w-3.5" />
            Imagem já no Pinata (colar URL)
          </div>
          <p className="mb-2 text-[11px] leading-relaxed text-white/45">
            Cola a URL pública da foto; o editor usa-a como fonte. Ao gravar no Pinata, os recortes card+token são
            enviados outra vez (novos ficheiros no IPFS) e o Supabase recebe as duas URLs finais.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <input
              type="url"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://gateway.pinata.cloud/ipfs/…"
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-xs text-white/90 placeholder:text-white/25"
            />
            <button
              type="button"
              onClick={loadFromUrlDraft}
              className="shrink-0 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-500/25"
            >
              Carregar no editor
            </button>
          </div>
          {existingCardUrl ? (
            <button
              type="button"
              className="mt-2 text-left text-[11px] font-bold text-white/40 underline decoration-white/20 hover:text-cyan-200/90"
              onClick={() => loadImageFromUrl(existingCardUrl)}
            >
              Usar foto atual do jogador (card) como fonte para reenquadrar
            </button>
          ) : null}
        </div>

        <label className="mb-5 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/25 bg-white/5 px-4 py-3 text-sm text-white/60 hover:bg-white/10">
          <Upload className="h-5 w-5" />
          {rawFile
            ? rawFile.name
            : rawDataUrl && isHttpImageUrl(rawDataUrl)
              ? 'Fonte: URL (ou escolhe ficheiro abaixo)'
              : 'Escolher ficheiro do disco…'}
          <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
        </label>

        {rawDataUrl && (
          <>
            <img
              ref={hiddenImgRef}
              src={rawDataUrl}
              alt=""
              className="hidden"
              crossOrigin="anonymous"
            />
            <div className="mb-4 flex flex-wrap items-start justify-center gap-6">
              <div key={`card-${rawDataUrl}`} className="contents">
                <CropPreview
                  imageSrc={rawDataUrl}
                  crop={cardCrop}
                  onCropChange={setCardCrop}
                  width={CARD_W}
                  height={CARD_H}
                  circular={false}
                  label="Card (Mercado)"
                />
              </div>
              <div key={`token-${rawDataUrl}`} className="contents">
                <CropPreview
                  imageSrc={rawDataUrl}
                  crop={tokenCrop}
                  onCropChange={setTokenCrop}
                  width={TOKEN_SIZE}
                  height={TOKEN_SIZE}
                  circular
                  label="Token (Partida)"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <button
                type="button"
                disabled={savingKind !== null}
                className="flex items-center justify-center gap-2 rounded-lg bg-neon-yellow px-5 py-2.5 font-display text-sm font-black text-black hover:bg-neon-yellow/90 disabled:opacity-50"
                onClick={() => void performSave('storage')}
              >
                {savingKind === 'storage' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                {savingKind === 'storage'
                  ? savingPhase === 'db'
                    ? 'A atualizar Supabase…'
                    : 'A enviar ao Storage…'
                  : 'Salvar no Supabase Storage'}
              </button>
              <button
                type="button"
                disabled={savingKind !== null}
                className="flex items-center justify-center gap-2 rounded-lg border border-cyan-400/50 bg-cyan-500/10 px-5 py-2.5 font-display text-sm font-black text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
                onClick={() => void performSave('pinata')}
                title="olefoot-server + PINATA_JWT + VITE_OLEFOOT_API_URL. Sem login: VITE_OLEFOOT_PINATA_UPLOAD_TOKEN (raiz) = OLEFOOT_PINATA_UPLOAD_TOKEN (server)."
              >
                {savingKind === 'pinata' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CloudUpload className="h-4 w-4" />
                )}
                {savingKind === 'pinata'
                  ? savingPhase === 'db'
                    ? 'A gravar linha no Supabase…'
                    : 'A enviar WebP ao Pinata…'
                  : 'Salvar no Pinata + Supabase'}
              </button>
            </div>
            {success && saveReceipt && (
              <div className="mt-4 rounded-lg border border-emerald-500/35 bg-emerald-500/[0.12] px-3 py-3">
                <div className="flex items-center gap-2 text-xs font-black text-emerald-200">
                  <Check className="h-4 w-4 shrink-0" />
                  Supabase atualizado
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-white/55">
                  Tabela <code className="text-white/70">genesis_market_players</code> · id{' '}
                  <code className="text-neon-yellow/80">{player.id}</code>
                  {saveReceipt.kind === 'pinata' ? (
                    <>
                      {' '}
                      · colunas <code className="text-white/60">portrait_public_url</code>,{' '}
                      <code className="text-white/60">portrait_token_public_url</code>,{' '}
                      <code className="text-white/60">portrait_media_refs</code>,{' '}
                      <code className="text-white/60">portrait_storage_path</code> (null)
                    </>
                  ) : (
                    <>
                      {' '}
                      · colunas <code className="text-white/60">portrait_storage_path</code> (card); URLs Pinata
                      limpas
                    </>
                  )}
                </p>
                <p className="mt-2 text-[9px] font-mono leading-snug text-white/40">
                  {saveReceipt.kind === 'pinata' ? (
                    <>
                      <span className="text-white/50">card</span> {truncateMiddle(saveReceipt.cardUrl, 96)}
                      <br />
                      <span className="text-white/50">token</span> {truncateMiddle(saveReceipt.tokenUrl, 96)}
                    </>
                  ) : (
                    <>
                      <span className="text-white/50">path</span> {saveReceipt.cardPath}
                    </>
                  )}
                </p>
                <p className="mt-2 text-[9px] text-white/35">As miniaturas “Card atual” acima já refletem esta gravação.</p>
              </div>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-white/35">
              Gravar no Pinata grava <code className="text-white/50">portrait_public_url</code>,{' '}
              <code className="text-white/50">portrait_token_public_url</code> e{' '}
              <code className="text-white/50">portrait_media_refs</code>; Storage fica vazio.
            </p>
          </>
        )}

        {error && <p className="mt-3 text-xs font-bold text-red-400">{error}</p>}
      </div>
    </div>
  );
}

export function AdminGenesisPortraitsPanel() {
  const [players, setPlayers] = useState<GenesisMarketPlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<GenesisMarketPlayerRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchGenesisMarketPlayerRowsOrdered().then((rows) => {
      setPlayers(rows);
      setLoading(false);
    });
  }, [refreshKey]);

  if (!isSupabaseConfigured()) {
    return <p className="text-sm text-white/40">Supabase não configurado.</p>;
  }

  return (
    <section>
      <h2 className="font-display text-xl font-black tracking-tight">Fotos Genesis</h2>
        <p className="mb-4 mt-1 text-xs text-white/40">
        Clique no jogador para ajustar a foto (crop). Ao gravar, o cliente fala com o Supabase e atualiza a linha em{' '}
        <code className="rounded bg-black/40 px-1 text-white/55">genesis_market_players</code>: no Pinata envia os
        WebPs ao servidor, depois grava as URLs públicas e <code className="rounded bg-black/40 px-1 text-white/55">portrait_media_refs</code>; no Storage faz upload ao bucket e grava{' '}
        <code className="rounded bg-black/40 px-1 text-white/55">portrait_storage_path</code>. Para Pinata:{' '}
        <code className="rounded bg-black/40 px-1 text-neon-yellow/80">npm run dev:server</code>,{' '}
        <code className="rounded bg-black/40 px-1 text-neon-yellow/80">VITE_OLEFOOT_API_URL</code>,{' '}
        <code className="rounded bg-black/40 px-1 text-neon-yellow/80">PINATA_JWT</code> no servidor. No{' '}
        <code className="rounded bg-black/40 px-1 text-white/50">/admin</code> sem login: o mesmo segredo em{' '}
        <code className="rounded bg-black/40 px-1 text-neon-yellow/80">VITE_OLEFOOT_PINATA_UPLOAD_TOKEN</code> e{' '}
        <code className="rounded bg-black/40 px-1 text-neon-yellow/80">OLEFOOT_PINATA_UPLOAD_TOKEN</code>.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-white/40">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando jogadores...
        </div>
      ) : (
        <>
          <GenesisPinataManualUrlsBlock onApplied={() => setRefreshKey((k) => k + 1)} />
          <GenesisPinataFolderCidBlock players={players} onApplied={() => setRefreshKey((k) => k + 1)} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {players.map((p) => {
            const cardUrl = genesisPortraitImageUrl(p);
            const tokenUrl = genesisTokenImageUrl(p);
            const hasPhoto = !!cardUrl;
            return (
              <button
                key={p.id}
                type="button"
                className={cn(
                  'group relative flex flex-col items-center gap-1.5 rounded-xl border px-2 pb-3 pt-2 text-left transition-colors',
                  hasPhoto
                    ? 'border-white/10 bg-white/5 hover:border-neon-yellow/40 hover:bg-white/10'
                    : 'border-dashed border-white/15 bg-white/[0.02] hover:border-neon-yellow/30 hover:bg-white/5',
                )}
                onClick={() => setEditing(p)}
              >
                {hasPhoto ? (
                  <div className="flex items-center gap-2">
                    <img
                      src={cardUrl}
                      alt=""
                      className="h-20 rounded border border-white/10 object-cover"
                      crossOrigin="anonymous"
                    />
                    {tokenUrl && (
                      <img
                        src={tokenUrl}
                        alt=""
                        className="h-10 w-10 rounded-full border border-white/10 object-cover"
                        crossOrigin="anonymous"
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex h-20 w-full items-center justify-center rounded bg-white/5">
                    <Camera className="h-6 w-6 text-white/15" />
                  </div>
                )}
                <div className="w-full text-center">
                  <div className="line-clamp-1 text-[10px] font-black uppercase tracking-wide text-white/80">
                    <span className="text-neon-yellow/70">#{p.kit_number}</span> {p.name}
                  </div>
                  <div className="text-[9px] text-white/45">
                    {p.pos}
                    {p.rarity_label ? <> · <span className="text-amber-400/80">{p.rarity_label}</span></> : null}
                  </div>
                </div>
                {hasPhoto && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-emerald-500/20 p-0.5">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </span>
                )}
              </button>
            );
          })}
          </div>
        </>
      )}

      {editing ? (
        <Fragment key={editing.id}>
          <PlayerEditor
            player={editing}
            onSaved={(patch) => {
              setRefreshKey((k) => k + 1);
              setEditing((prev) => (prev ? { ...prev, ...patch } : null));
            }}
            onClose={() => setEditing(null)}
          />
        </Fragment>
      ) : null}
    </section>
  );
}

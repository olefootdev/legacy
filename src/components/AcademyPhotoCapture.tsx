/**
 * AcademyPhotoCapture
 *
 * Passo 4 da criação de jogador da Academia OLE. Fluxo:
 *   1. idle: 2 opções — câmera ao vivo (getUserMedia) OU upload (com
 *      `capture="user"` que abre câmera selfie nativa no mobile).
 *   2. streaming: video ao vivo + overlay translúcido + "Capturar".
 *   3. positioning: snapshot da face + drag/scale sobre template fixo.
 *   4. composed: callback onComposed(blob) — composição final.
 *
 * Composição = layer bg PNG + face posicionada + jersey PNG (overlay).
 * No mobile, prefere upload via input file com `capture="user"` —
 * getUserMedia é menos confiável em Safari iOS / Android Chrome velho.
 * Pattern de canvas 2D copiado de AdminGenesisPortraitsPanel.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, ZoomIn, ZoomOut, Check, X, Loader2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

const CARD_W = 600;
const CARD_H = 800;

interface CropState {
  offsetX: number; // -0.5 a 0.5 (fração do tamanho do canvas)
  offsetY: number;
  scale: number;   // 0.5 a 2.5
}

const DEFAULT_CROP: CropState = { offsetX: 0, offsetY: 0, scale: 1 };

interface Props {
  /** URL pública do PNG de fundo (camada inferior). */
  backgroundUrl: string;
  /** URL pública do PNG da camisa com transparência onde vai o rosto. */
  jerseyUrl: string;
  /** Callback chamado quando o manager confirma a composição. */
  onComposed: (blob: Blob) => void;
  /** Callback opcional pra cancelar/voltar passo. */
  onCancel?: () => void;
}

type Stage = 'idle' | 'streaming' | 'permission-denied' | 'positioning' | 'composing';

export function AcademyPhotoCapture({ backgroundUrl, jerseyUrl, onComposed, onCancel }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [faceUrl, setFaceUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const faceImgRef = useRef<HTMLImageElement | null>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const jerseyImgRef = useRef<HTMLImageElement | null>(null);
  const draggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Pre-carrega as imagens do template uma vez
  useEffect(() => {
    const bg = new Image();
    bg.crossOrigin = 'anonymous';
    bg.src = backgroundUrl;
    bg.onload = () => { bgImgRef.current = bg; };
    const jersey = new Image();
    jersey.crossOrigin = 'anonymous';
    jersey.src = jerseyUrl;
    jersey.onload = () => { jerseyImgRef.current = jersey; };
  }, [backgroundUrl, jerseyUrl]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  const startCamera = useCallback(async () => {
    setErrorMsg(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setStage('permission-denied');
      setErrorMsg('Webcam não disponível neste browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setStage('streaming');
      // Aguarda o React renderizar o <video> antes de atribuir o srcObject
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[AcademyPhotoCapture] getUserMedia:', msg);
      setStage('permission-denied');
      setErrorMsg('Permissão de câmera negada ou nenhuma câmera disponível.');
    }
  }, []);

  /**
   * Handler comum: recebe um Blob (de webcam OU upload), gera Image,
   * entra no estado de positioning.
   */
  const loadFaceBlob = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      faceImgRef.current = img;
      setFaceUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setCrop(DEFAULT_CROP);
      setStage('positioning');
      stopStream();
      setTimeout(() => renderPreview(DEFAULT_CROP), 50);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setErrorMsg('Não foi possível ler a imagem. Tenta outra.');
    };
    img.src = url;
  }, [stopStream]);

  /**
   * Trigger do input file. capture="user" hint pro browser abrir câmera
   * frontal nativa no mobile (iOS Safari, Android Chrome). Em desktop
   * abre file picker normal.
   */
  const onFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Selecione um arquivo de imagem.');
      return;
    }
    setErrorMsg(null);
    loadFaceBlob(file);
    // Limpa o value pra permitir re-upload do mesmo arquivo
    e.target.value = '';
  }, [loadFaceBlob]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w === 0 || h === 0) return;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    // Espelha horizontalmente pra ficar mais natural (selfie mode)
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    c.toBlob((blob) => { if (blob) loadFaceBlob(blob); }, 'image/png');
  }, [loadFaceBlob]);

  const renderPreview = useCallback((c: CropState) => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CARD_W, CARD_H);
    // Layer 1: background
    if (bgImgRef.current) {
      ctx.drawImage(bgImgRef.current, 0, 0, CARD_W, CARD_H);
    } else {
      ctx.fillStyle = '#0A0A0A';
      ctx.fillRect(0, 0, CARD_W, CARD_H);
    }
    // Layer 2: face (posicionada/escalada)
    // Default = 42% da largura, centralizada horizontalmente, posição vertical
    // no upper-third (onde fica o rosto numa carta de jogador). User pode
    // ajustar via drag/zoom.
    if (faceImgRef.current) {
      const img = faceImgRef.current;
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const baseSize = CARD_W * 0.42;
      let drawW = baseSize * c.scale;
      let drawH = drawW / imgAspect;
      const drawX = (CARD_W - drawW) / 2 + c.offsetX * CARD_W;
      // Centro vertical em ~33% da altura (centro do rosto em carta vertical)
      const drawY = (CARD_H * 0.33 - drawH / 2) + c.offsetY * CARD_H;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    }
    // Layer 3: jersey overlay
    if (jerseyImgRef.current) {
      ctx.drawImage(jerseyImgRef.current, 0, 0, CARD_W, CARD_H);
    }
  }, []);

  // Re-render quando crop muda
  useEffect(() => {
    if (stage === 'positioning') renderPreview(crop);
  }, [crop, stage, renderPreview]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (stage !== 'positioning') return;
    draggingRef.current = true;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [stage]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current || stage !== 'positioning') return;
    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    const rect = e.currentTarget.getBoundingClientRect();
    setCrop((prev) => ({
      ...prev,
      offsetX: Math.max(-0.5, Math.min(0.5, prev.offsetX + dx / rect.width)),
      offsetY: Math.max(-0.5, Math.min(0.5, prev.offsetY + dy / rect.height)),
    }));
  }, [stage]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const adjustScale = useCallback((delta: number) => {
    setCrop((prev) => ({ ...prev, scale: Math.max(0.5, Math.min(2.5, prev.scale + delta)) }));
  }, []);

  const reset = useCallback(() => setCrop(DEFAULT_CROP), []);

  const confirm = useCallback(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    setStage('composing');
    // Renderiza em alta resolução pra mandar pro Freepik
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setStage('positioning');
          setErrorMsg('Falha ao compor imagem. Tenta de novo.');
          return;
        }
        onComposed(blob);
        // Limpa URL temporário da face
        if (faceUrl) URL.revokeObjectURL(faceUrl);
      },
      'image/png',
      0.92,
    );
  }, [onComposed, faceUrl]);

  const retake = useCallback(() => {
    if (faceUrl) URL.revokeObjectURL(faceUrl);
    setFaceUrl(null);
    faceImgRef.current = null;
    setCrop(DEFAULT_CROP);
    void startCamera();
  }, [faceUrl, startCamera]);

  return (
    <div className="flex flex-col gap-3">
      {/* Input file escondido — capture="user" abre câmera selfie nativa no mobile */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={onFileSelected}
        className="hidden"
      />

      {/* IDLE */}
      {stage === 'idle' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-white/15 bg-deep-black/50 p-6 text-center">
          <Camera className="h-10 w-10 text-neon-yellow" aria-hidden />
          <p className="text-sm text-white/80">
            Tira uma selfie pra ser a base da arte do teu cartão.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 font-display text-xs font-black uppercase tracking-wider"
            >
              <Upload className="h-4 w-4" />
              Tirar foto / Carregar
            </button>
            <button
              type="button"
              onClick={() => void startCamera()}
              className="inline-flex items-center justify-center gap-2 border border-white/30 px-5 py-2.5 font-display text-xs font-black uppercase tracking-wider text-white/85 hover:bg-white/10"
            >
              <Camera className="h-4 w-4" />
              Câmera ao vivo
            </button>
          </div>
          <p className="text-[10px] leading-relaxed text-white/50">
            No celular o botão "Tirar foto" abre a câmera frontal direto.<br />
            No PC abre o explorador de arquivos pra escolher uma imagem.
          </p>
          {errorMsg && (
            <p className="text-[11px] text-red-300">{errorMsg}</p>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-[10px] uppercase tracking-wider text-white/50 hover:text-white"
            >
              Voltar
            </button>
          )}
        </div>
      )}

      {/* PERMISSION DENIED — oferece upload como fallback */}
      {stage === 'permission-denied' && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-red-500/40 bg-red-950/40 p-5 text-center">
          <X className="h-6 w-6 text-red-300" aria-hidden />
          <p className="text-sm text-red-200">{errorMsg ?? 'Câmera indisponível.'}</p>
          <p className="text-[11px] text-red-200/70">
            Sem problema — usa o botão de upload pra escolher uma foto do device.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider"
            >
              <Upload className="h-4 w-4" />
              Carregar foto
            </button>
            <button
              type="button"
              onClick={() => void startCamera()}
              className="border border-red-300/40 px-4 py-2 text-xs uppercase tracking-wider text-red-200 hover:bg-red-500/20"
            >
              Tentar câmera de novo
            </button>
          </div>
        </div>
      )}

      {/* STREAMING — preview ao vivo */}
      {stage === 'streaming' && (
        <div className="flex flex-col items-center gap-3">
          <div className="relative overflow-hidden rounded-lg border border-white/20">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="block max-h-[60vh] w-auto"
              style={{ transform: 'scaleX(-1)' }} /* mirror preview */
            />
            <div className="pointer-events-none absolute inset-0 border-4 border-dashed border-neon-yellow/40" />
          </div>
          <p className="text-center text-[12px] text-white/70">
            Olha pra câmera, enquadra teu rosto no meio, e clica em Capturar.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { stopStream(); setStage('idle'); }}
              className="border border-white/30 px-4 py-2 text-xs uppercase tracking-wider text-white/80 hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={capture}
              className="btn-primary px-6 py-2.5 text-xs font-black uppercase tracking-wider"
            >
              Capturar
            </button>
          </div>
        </div>
      )}

      {/* POSITIONING — drag/scale + preview composto */}
      {(stage === 'positioning' || stage === 'composing') && (
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <canvas
              ref={previewRef}
              width={CARD_W}
              height={CARD_H}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className={cn(
                'block max-h-[60vh] w-auto rounded border border-white/15 bg-deep-black select-none',
                stage === 'positioning' ? 'cursor-move' : 'cursor-wait opacity-70',
              )}
              style={{ touchAction: 'none' }}
            />
            {stage === 'composing' && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40">
                <Loader2 className="h-8 w-8 animate-spin text-neon-yellow" />
              </div>
            )}
          </div>
          {errorMsg && (
            <div className="rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-[12px] text-red-200">
              {errorMsg}
            </div>
          )}
          <p className="text-center text-[11px] text-white/60">
            Arrasta a foto pra posicionar · usa zoom pra escalar
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => adjustScale(-0.1)}
              disabled={stage !== 'positioning'}
              className="rounded border border-white/30 p-2 text-white/80 hover:bg-white/10 disabled:opacity-40"
              aria-label="Diminuir"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => adjustScale(0.1)}
              disabled={stage !== 'positioning'}
              className="rounded border border-white/30 p-2 text-white/80 hover:bg-white/10 disabled:opacity-40"
              aria-label="Aumentar"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={stage !== 'positioning'}
              className="rounded border border-white/30 p-2 text-white/80 hover:bg-white/10 disabled:opacity-40"
              aria-label="Resetar"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={retake}
              disabled={stage !== 'positioning'}
              className="border border-white/30 px-3 py-2 text-[11px] uppercase tracking-wider text-white/80 hover:bg-white/10 disabled:opacity-40"
            >
              Tirar de novo
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={stage !== 'positioning'}
              className="btn-primary inline-flex items-center gap-1 px-5 py-2 text-xs font-black uppercase tracking-wider disabled:opacity-40"
            >
              <Check className="h-3 w-3" />
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * AcademyPhotoCapture
 *
 * Passo 4 da criação de jogador da Academia OLE. Fluxo:
 *   1. idle: botão "Iniciar câmera" pede permissão getUserMedia
 *   2. streaming: video ao vivo + overlay translúcido do template + "Capturar"
 *   3. positioning: snapshot da face + drag/scale sobre o template fixo
 *   4. composed: callback onComposed(blob) — composição final webp/png
 *
 * Composição = layer bg PNG + face posicionada + jersey PNG (overlay alpha).
 * Pattern de canvas 2D + pointer events copiado de AdminGenesisPortraitsPanel
 * (não usamos libs externas tipo react-easy-crop pra manter o bundle leve).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, ZoomIn, ZoomOut, Check, X, Loader2 } from 'lucide-react';
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
    c.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          faceImgRef.current = img;
          setFaceUrl(url);
          setCrop(DEFAULT_CROP);
          setStage('positioning');
          stopStream();
          // Renderiza preview inicial
          setTimeout(() => renderPreview(DEFAULT_CROP), 50);
        };
        img.src = url;
      },
      'image/png',
    );
  }, [stopStream]);

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
    if (faceImgRef.current) {
      const img = faceImgRef.current;
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const baseSize = CARD_W * 0.7; // face cobre ~70% da largura por padrão
      let drawW = baseSize * c.scale;
      let drawH = drawW / imgAspect;
      const drawX = (CARD_W - drawW) / 2 + c.offsetX * CARD_W;
      const drawY = (CARD_H * 0.25 - drawH / 2) + c.offsetY * CARD_H;
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
      {/* IDLE */}
      {stage === 'idle' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-white/15 bg-deep-black/50 p-6 text-center">
          <Camera className="h-10 w-10 text-neon-yellow" aria-hidden />
          <p className="text-sm text-white/80">
            Tira uma selfie pra ser a base da arte da carta. Vai precisar de permissão de câmera.
          </p>
          <button
            type="button"
            onClick={() => void startCamera()}
            className="btn-primary px-5 py-2.5 font-display text-xs font-black uppercase tracking-wider"
          >
            Iniciar câmera
          </button>
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

      {/* PERMISSION DENIED */}
      {stage === 'permission-denied' && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-red-500/40 bg-red-950/40 p-5 text-center">
          <X className="h-6 w-6 text-red-300" aria-hidden />
          <p className="text-sm text-red-200">{errorMsg ?? 'Câmera indisponível.'}</p>
          <p className="text-[11px] text-red-200/70">
            Habilita a permissão de câmera nas configurações do browser e tenta de novo.
          </p>
          <button
            type="button"
            onClick={() => void startCamera()}
            className="btn-primary px-4 py-2 text-xs font-black uppercase tracking-wider"
          >
            Tentar de novo
          </button>
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

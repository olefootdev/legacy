/**
 * AcademyPhotoCapture
 *
 * Captura uma SELFIE do manager pra mandar pro Freepik como reference.
 * NÃO compõe localmente — o Freepik faz a composição (selfie + camisa +
 * fundo) com 3 reference images separadas.
 *
 * Fluxo:
 *   1. idle:     2 botões (câmera ao vivo OU upload com capture="user")
 *   2. streaming: video preview + Capturar
 *   3. preview:  selfie capturada + Retake ou Confirmar
 *   4. composing: callback onCaptured(blob) — caller envia pro server
 *
 * No mobile, o upload com capture="user" abre câmera frontal nativa —
 * mais confiável que getUserMedia (Safari iOS, Chrome Android).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, X, Loader2, Upload, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** Callback chamado quando o manager confirma a selfie. */
  onCaptured: (selfieBlob: Blob) => void;
  /** Callback opcional pra cancelar/voltar passo. */
  onCancel?: () => void;
}

type Stage = 'idle' | 'streaming' | 'permission-denied' | 'preview' | 'composing';

export function AcademyPhotoCapture({ onCaptured, onCancel }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewBlobRef = useRef<Blob | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const setPreviewFromBlob = useCallback((blob: Blob) => {
    previewBlobRef.current = blob;
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    setStage('preview');
    stopStream();
  }, [stopStream]);

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
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (e) {
      setStage('permission-denied');
      setErrorMsg(`Permissão de câmera negada: ${e instanceof Error ? e.message : 'erro desconhecido'}`);
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
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    // JPEG comprimido — selfies via PNG ficam grandes demais
    c.toBlob((blob) => { if (blob) setPreviewFromBlob(blob); }, 'image/jpeg', 0.88);
  }, [setPreviewFromBlob]);

  const onFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Selecione um arquivo de imagem.');
      return;
    }
    setErrorMsg(null);
    setPreviewFromBlob(file);
    e.target.value = '';
  }, [setPreviewFromBlob]);

  const retake = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewBlobRef.current = null;
    setPreviewUrl(null);
    setStage('idle');
  }, [previewUrl]);

  const confirm = useCallback(() => {
    if (!previewBlobRef.current) return;
    setStage('composing');
    onCaptured(previewBlobRef.current);
  }, [onCaptured]);

  return (
    <div className="flex flex-col gap-3">
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
          <p className="text-sm text-white/85">
            Tira uma selfie clara da tua face. A IA vai usar como referência pra gerar a carta cinematográfica.
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
            No celular o botão "Tirar foto" abre a câmera frontal nativa.<br />
            No PC abre o explorador de arquivos pra escolher uma imagem.
          </p>
          {errorMsg && <p className="text-[11px] text-red-300">{errorMsg}</p>}
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
              style={{ transform: 'scaleX(-1)' }}
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

      {/* PREVIEW — selfie capturada, escolher Retake ou Confirmar */}
      {(stage === 'preview' || stage === 'composing') && previewUrl && (
        <div className="flex flex-col items-center gap-3">
          <div className="relative overflow-hidden rounded-lg border border-neon-yellow/40 bg-deep-black">
            <img
              src={previewUrl}
              alt="Selfie capturada"
              className={cn(
                'block max-h-[60vh] w-auto',
                stage === 'composing' && 'opacity-60',
              )}
            />
            {stage === 'composing' && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40">
                <Loader2 className="h-8 w-8 animate-spin text-neon-yellow" />
              </div>
            )}
          </div>
          <p className="text-center text-[10px] leading-relaxed text-neon-yellow/70">
            ⚡ Esta foto vai pra IA junto com a camisa e o fundo Olefoot.<br />
            O resultado é uma carta cinematográfica premium (estilo FIFA Ultimate Team).
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={retake}
              disabled={stage === 'composing'}
              className="inline-flex items-center gap-1 border border-white/30 px-4 py-2 text-xs uppercase tracking-wider text-white/85 hover:bg-white/10 disabled:opacity-40"
            >
              <RefreshCw className="h-3 w-3" />
              Tirar de novo
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={stage === 'composing'}
              className="btn-primary inline-flex items-center gap-1 px-5 py-2 text-xs font-black uppercase tracking-wider disabled:opacity-40"
            >
              <Check className="h-3 w-3" />
              {stage === 'composing' ? 'Enviando…' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

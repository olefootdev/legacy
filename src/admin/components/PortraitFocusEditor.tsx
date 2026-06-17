import { useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';
import { portraitFocusStyle } from '@/supabase/legacyPlayers';

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Editor de enquadramento (ponto focal) — mantém a URL como fonte única.
 * Arrasta no preview do card pra mover o foco, +/- pra zoom. Mostra card (3:4)
 * e token (1:1 circular) lado a lado, exatamente como vai renderizar no jogo.
 * Não re-sobe imagem; só ajusta foco X/Y (0..1) + zoom.
 */
export function PortraitFocusEditor({
  url,
  fx,
  fy,
  zoom,
  onChange,
}: {
  url: string;
  fx: number;
  fy: number;
  zoom: number;
  onChange: (fx: number, fy: number, zoom: number) => void;
}) {
  const dragging = useRef(false);
  const cur = useRef({ fx, fy, zoom });
  cur.current = { fx, fy, zoom };
  const boxRef = useRef<HTMLDivElement>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = e.movementX / rect.width;
    const dy = e.movementY / rect.height;
    onChange(clamp01(cur.current.fx - dx), clamp01(cur.current.fy - dy), cur.current.zoom);
  };

  const style = portraitFocusStyle(fx, fy, zoom);

  if (!url.trim()) {
    return (
      <p className="rounded-lg border border-dashed border-white/15 bg-black/20 px-3 py-4 text-center text-xs text-white/40">
        Cola/sobe a URL do retrato pra ajustar o enquadramento.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-white/40">Card</p>
          <div
            ref={boxRef}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerMove={onPointerMove}
            className="relative aspect-[3/4] w-28 cursor-move touch-none overflow-hidden rounded-lg ring-2 ring-amber-400/50"
          >
            <img src={url} alt="card" draggable={false} className="h-full w-full select-none" style={style} />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100">
              <Move className="h-5 w-5 text-white/70 drop-shadow" />
            </div>
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-white/40">Token</p>
          <div className="relative aspect-square w-20 overflow-hidden rounded-full ring-2 ring-amber-400/50">
            <img src={url} alt="token" draggable={false} className="h-full w-full select-none" style={style} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(fx, fy, Math.min(3, +(zoom + 0.1).toFixed(2)))}
          className="rounded border border-white/15 p-1.5 text-white/70 hover:bg-white/10"
          title="Zoom +"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onChange(fx, fy, Math.max(0.5, +(zoom - 0.1).toFixed(2)))}
          className="rounded border border-white/15 p-1.5 text-white/70 hover:bg-white/10"
          title="Zoom −"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <span className="ml-1 font-mono text-[11px] text-white/50">
          {Math.round(fx * 100)}% / {Math.round(fy * 100)}% · {zoom.toFixed(2)}×
        </span>
        <button
          type="button"
          onClick={() => onChange(0.5, 0, 1)}
          className="ml-auto flex items-center gap-1 rounded border border-white/15 px-2 py-1 text-[11px] text-white/60 hover:bg-white/10"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>
      <p className="text-[10px] text-white/35">Arrasta no card pra enquadrar. O token usa o mesmo foco.</p>
    </div>
  );
}

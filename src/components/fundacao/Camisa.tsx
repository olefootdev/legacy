/**
 * Escudo do clube — SVG próprio. As cores vêm da camisa do clube.
 * (A camisa em si virou o uniforme em peças: src/components/uniforme/UniformeSVG.tsx.)
 */
import { L } from '@/i18n/L';
import { tintaSobre } from '@/club/camisa';

export function EscudoSVG({ primaria, secundaria, iniciais, largura = 86 }: { primaria: string; secundaria: string; iniciais: string; largura?: number }) {
  // Detalhe igual ao fundo some: troca por papel/asfalto.
  const detalhe = secundaria.toLowerCase() === primaria.toLowerCase() ? tintaSobre(primaria) : secundaria;
  return (
    <svg viewBox="0 0 120 140" width={largura} role="img" aria-label={L(`Escudo ${iniciais}`, `${iniciais} crest`)} className="max-w-full">
      <path d="M60 6 L112 22 L106 82 Q96 116 60 134 Q24 116 14 82 L8 22 Z" fill={primaria} stroke="#000" strokeWidth={6} strokeLinejoin="round" />
      <path d="M60 20 L98 32 L94 80 Q86 104 60 118 Q34 104 26 80 L22 32 Z" fill="none" stroke={detalhe} strokeWidth={5} />
      <text x={60} y={86} textAnchor="middle" fontFamily="Anton, Impact, sans-serif" fontSize={34} fill={detalhe}>
        {iniciais}
      </text>
    </svg>
  );
}

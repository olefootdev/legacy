/**
 * Camisa + calção e escudo do clube — SVG próprio (sem camisa de clube real).
 * 8 padrões (`PadraoDeCamisa`); as cores vêm da identidade do clube. Usado na
 * fundação e, depois, onde o clube aparece (ata, cartaz de jogo, placar).
 */
import { useId } from 'react';
import type { PadraoDeCamisa } from '@/club/identidade';
import { L } from '@/i18n/L';

const CAMISA = 'M60 22 L84 12 Q100 24 116 12 L140 22 L182 52 L163 84 L145 73 L145 190 L55 190 L55 73 L37 84 L18 52 Z';
const CALCAO = 'M58 196 L142 196 L150 262 L108 262 L100 232 L92 262 L50 262 Z';

export const PADROES_DE_CAMISA: { k: PadraoDeCamisa; nome: string }[] = [
  { k: 'lisa', nome: L('Lisa', 'Plain') },
  { k: 'listras', nome: L('Listras', 'Stripes') },
  { k: 'horiz', nome: L('Horizontal', 'Hoops') },
  { k: 'diagonal', nome: L('Faixa', 'Sash') },
  { k: 'meio', nome: L('Meio a meio', 'Halves') },
  { k: 'peito', nome: L('Faixa peito', 'Chest band') },
  { k: 'mangas', nome: L('Mangas', 'Sleeves') },
  { k: 'gola', nome: L('Detalhe', 'Trim') },
];

/** Paleta da fundação: as cores da rua + as clássicas de camisa. */
export const CORES_DE_CAMISA = ['#F2E61E', '#0D0D0C', '#EEE9DF', '#C9A13B', '#B3121B', '#0B3D91', '#0E7A3A', '#5E2A84', '#E8731C', '#7A1F2B', '#6FA8DC', '#8A857B'];

/** Texto legível sobre a cor (luminância simples). */
function tintaSobre(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#0D0D0C' : '#EEE9DF';
}

function Padrao({ padrao, c2 }: { padrao: PadraoDeCamisa; c2: string }) {
  switch (padrao) {
    case 'listras':
      return <>{[8, 34, 60, 86, 112, 138, 164, 190].map((x) => <rect key={x} x={x} y={0} width={13} height={200} fill={c2} />)}</>;
    case 'horiz':
      return <>{[30, 56, 82, 108, 134, 160, 186].map((y) => <rect key={y} x={0} y={y} width={200} height={13} fill={c2} />)}</>;
    case 'diagonal':
      return <polygon points="40,0 80,0 170,200 130,200" fill={c2} />;
    case 'meio':
      return <rect x={100} y={0} width={100} height={200} fill={c2} />;
    case 'peito':
      return <rect x={0} y={80} width={200} height={30} fill={c2} />;
    case 'mangas':
      return (
        <>
          <polygon points="0,0 62,0 55,75 30,95 0,60" fill={c2} />
          <polygon points="200,0 138,0 145,75 170,95 200,60" fill={c2} />
        </>
      );
    case 'gola':
      return (
        <>
          <path d="M84 12 Q100 30 116 12" stroke={c2} strokeWidth={10} fill="none" />
          <rect x={55} y={178} width={90} height={12} fill={c2} />
          <rect x={55} y={73} width={8} height={117} fill={c2} />
          <rect x={137} y={73} width={8} height={117} fill={c2} />
        </>
      );
    default:
      return null;
  }
}

export function CamisaSVG({
  padrao,
  primaria,
  secundaria,
  calcao,
  iniciais,
  largura = 150,
  rotulo,
}: {
  padrao: PadraoDeCamisa;
  primaria: string;
  secundaria: string;
  calcao: string;
  iniciais?: string;
  largura?: number;
  /** Sem rótulo, a camisa é decorativa (aria-hidden). */
  rotulo?: string;
}) {
  const clip = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 200 280"
      width={largura}
      role={rotulo ? 'img' : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
      className="max-w-full"
    >
      <defs>
        <clipPath id={`k${clip}`}>
          <path d={CAMISA} />
        </clipPath>
      </defs>
      <g clipPath={`url(#k${clip})`}>
        <rect width={200} height={200} fill={primaria} />
        <Padrao padrao={padrao} c2={secundaria} />
      </g>
      <path d={CAMISA} fill="none" stroke="#000" strokeWidth={5} strokeLinejoin="round" />
      {iniciais ? (
        // Contorno na cor principal por trás das letras: legível sobre listra/faixa.
        <text x={100} y={128} textAnchor="middle" fontFamily="Anton, Impact, sans-serif" fontSize={34} fill={tintaSobre(primaria)} stroke={primaria} strokeWidth={8} paintOrder="stroke" strokeLinejoin="round">
          {iniciais}
        </text>
      ) : null}
      <path d={CALCAO} fill={calcao} stroke="#000" strokeWidth={5} strokeLinejoin="round" />
    </svg>
  );
}

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

/**
 * O UNIFORME 2D (14/10/2026) — camisa em peças, frente e costas, chapado.
 *
 * Peças: corpo (com padrão), mangas (curta ou longa, punho), gola (5 tipos),
 * calção e meião. Frente: escudo no peito e o texto do peito (iniciais, por
 * padrão). Costas: nome e número com contraste automático. Tudo SVG próprio,
 * sem imagem — o mesmo desenho serve à Fundação, ao Clube e ao cartaz.
 * Dados e regras em src/club/camisa.ts.
 */
import { useId, type ReactNode } from 'react';
import { corDaManga, corDoMeiao, golaDe, temPunho, tintaSobre, type CamisaDoClube, type PadraoDeCamisa } from '@/club/camisa';

const CORPO = 'M92 26 Q120 40 148 26 L180 40 L171 104 L170 262 Q120 271 70 262 L69 104 L60 40 Z';
const MANGA_E = (longa: boolean) => (longa ? 'M60 40 L14 150 L36 158 L72 112 L69 104 Z' : 'M60 40 L16 92 L38 114 L69 104 Z');
const MANGA_D = (longa: boolean) => (longa ? 'M180 40 L226 150 L204 158 L168 112 L171 104 Z' : 'M180 40 L224 92 L202 114 L171 104 Z');
const PUNHO_E = (longa: boolean) => (longa ? 'M18 141 L14 150 L36 158 L40 149 Z' : 'M21 86 L16 92 L38 114 L43 108 Z');
const PUNHO_D = (longa: boolean) => (longa ? 'M222 141 L226 150 L204 158 L200 149 Z' : 'M219 86 L224 92 L202 114 L197 108 Z');
const CALCAO = 'M70 284 L170 284 L176 352 L126 356 L120 334 L114 356 L64 352 Z';
const MEIAO_E = 'M78 364 L108 364 L108 412 L74 412 Z';
const MEIAO_D = 'M132 364 L162 364 L166 412 L132 412 Z';
const CONTORNO = '#0D0D0C';
const ESCUDO = 'M60 6 L112 22 L106 82 Q96 116 60 134 Q24 116 14 82 L8 22 Z';

/** O padrão desenhado dentro da caixa (x0, y0, w, h), na cor do detalhe. */
export function Padrao({ padrao, c2, x0, y0, w, h }: { padrao: PadraoDeCamisa; c2: string; x0: number; y0: number; w: number; h: number }) {
  const rs: ReactNode[] = [];
  const r = (x: number, y: number, ww: number, hh: number) => rs.push(<rect key={rs.length} x={x} y={y} width={ww} height={hh} fill={c2} />);
  switch (padrao) {
    case 'listras': for (let x = x0 + 6; x < x0 + w; x += 26) r(x, y0, 13, h); break;
    case 'listras-finas': for (let x = x0 + 4; x < x0 + w; x += 12) r(x, y0, 4, h); break;
    case 'horiz': for (let y = y0 + 10; y < y0 + h; y += 26) r(x0, y, w, 13); break;
    case 'diagonal': return <polygon points={`${x0 + w * 0.15},${y0} ${x0 + w * 0.42},${y0} ${x0 + w * 0.95},${y0 + h} ${x0 + w * 0.68},${y0 + h}`} fill={c2} />;
    case 'meio': r(x0 + w / 2, y0, w / 2, h); break;
    case 'quartos': r(x0 + w / 2, y0, w / 2, h / 2); r(x0, y0 + h / 2, w / 2, h / 2); break;
    case 'chevron': return <polygon points={`${x0},${y0 + h * 0.18} ${x0 + w / 2},${y0 + h * 0.42} ${x0 + w},${y0 + h * 0.18} ${x0 + w},${y0 + h * 0.3} ${x0 + w / 2},${y0 + h * 0.54} ${x0},${y0 + h * 0.3}`} fill={c2} />;
    case 'peito': r(x0, y0 + h * 0.3, w, h * 0.12); break;
    case 'giz': for (let x = x0 + 8; x < x0 + w; x += 11) r(x, y0, 1.6, h); break;
    case 'xadrez': for (let y = y0, k = 0; y < y0 + h; y += 18, k++) for (let x = x0 + (k % 2) * 18; x < x0 + w; x += 36) r(x, y, 18, 18); break;
    case 'ombros': return <path d={`M${x0} ${y0} L${x0 + w} ${y0} L${x0 + w} ${y0 + h * 0.2} Q${x0 + w / 2} ${y0 + h * 0.34} ${x0} ${y0 + h * 0.2} Z`} fill={c2} />;
    case 'lateral': r(x0 + w * 0.12, y0, w * 0.1, h); r(x0 + w * 0.78, y0, w * 0.1, h); break;
    case 'gola': r(x0, y0 + h - 12, w, 12); r(x0 + w * 0.08, y0, w * 0.06, h); r(x0 + w * 0.86, y0, w * 0.06, h); break;
    default: return null;
  }
  return <>{rs}</>;
}

function Peca({ d, c1, c2, padrao, caixa, id }: { d: string; c1: string; c2: string; padrao: PadraoDeCamisa; caixa: [number, number, number, number]; id: string }) {
  return (
    <>
      <clipPath id={id}><path d={d} /></clipPath>
      <g clipPath={`url(#${id})`}>
        <rect x={0} y={0} width={240} height={420} fill={c1} />
        <Padrao padrao={padrao} c2={c2} x0={caixa[0]} y0={caixa[1]} w={caixa[2]} h={caixa[3]} />
      </g>
      <path d={d} fill="none" stroke={CONTORNO} strokeWidth={3.5} strokeLinejoin="round" />
    </>
  );
}

function Texto({ x, y, size, cor, fundo, children, espaco = 0 }: { x: number; y: number; size: number; cor: string; fundo: string; children: string; espaco?: number }) {
  return (
    <text x={x} y={y} textAnchor="middle" fontFamily="Anton, Impact, sans-serif" fontSize={size} letterSpacing={espaco} fill={cor} stroke={fundo} strokeWidth={size / 6} paintOrder="stroke" strokeLinejoin="round">
      {children}
    </text>
  );
}

function Gola({ tipo, cor, costas }: { tipo: ReturnType<typeof golaDe>; cor: string; costas: boolean }) {
  const s = { stroke: cor, strokeWidth: 7, fill: 'none', strokeLinecap: 'round' as const };
  if (costas) return <path d="M92 26 Q120 34 148 26" {...s} />;
  if (tipo === 'v') return <path d="M92 26 L120 58 L148 26" {...s} />;
  if (tipo === 'polo') {
    return (
      <>
        <path d="M92 26 L104 48 L120 34 L136 48 L148 26 Z" fill={cor} stroke={CONTORNO} strokeWidth={2.5} />
        <line x1={120} y1={36} x2={120} y2={70} stroke={CONTORNO} strokeWidth={2} />
        <circle cx={120} cy={48} r={2.4} fill={CONTORNO} />
        <circle cx={120} cy={62} r={2.4} fill={CONTORNO} />
      </>
    );
  }
  if (tipo === 'retro') {
    return (
      <>
        <path d="M92 26 Q120 46 148 26" {...s} />
        <path d="M112 40 L120 54 L128 40" stroke={CONTORNO} strokeWidth={2} fill="none" />
        <line x1={114} y1={44} x2={126} y2={44} stroke={CONTORNO} strokeWidth={1.5} />
      </>
    );
  }
  if (tipo === 'careca') return <path d="M90 26 Q120 50 150 26" stroke={cor} strokeWidth={11} fill="none" />;
  return <path d="M92 26 Q120 44 148 26" {...s} />;
}

export interface UniformeProps {
  camisa: CamisaDoClube;
  vista?: 'frente' | 'costas';
  /** Iniciais do clube (escudo e, sem texto do peito, o peito). */
  iniciais: string;
  /** Costas: nome e número (ausentes = a sigla e o 10). */
  nome?: string;
  numero?: string | number;
  largura?: number;
  /** Só a camisa (miniaturas): corta calção e meião. */
  soCamisa?: boolean;
  /** Sem rótulo, decorativo (aria-hidden). */
  rotulo?: string;
}

export function UniformeSVG({ camisa: c, vista = 'frente', iniciais, nome, numero, largura = 150, soCamisa = false, rotulo }: UniformeProps) {
  const base = useId().replace(/:/g, '');
  const costas = vista === 'costas';
  const longa = !!c.mangaLonga;
  const manga = corDaManga(c);
  const padraoManga: PadraoDeCamisa = c.padraoNasMangas ? c.padrao : 'lisa';
  const tinta = tintaSobre(c.primaria);
  const peito = (c.peito ?? iniciais).toUpperCase().slice(0, 12);
  const num = String(numero ?? 10).slice(0, 2);
  const detalheEscudo = c.primaria.toLowerCase() === c.secundaria.toLowerCase() ? tintaSobre(c.secundaria) : c.primaria;
  return (
    <svg
      viewBox={soCamisa ? '8 16 224 260' : '0 0 240 420'}
      width={largura}
      role={rotulo ? 'img' : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
      className="max-w-full"
    >
      <Peca id={`${base}me`} d={MANGA_E(longa)} c1={manga} c2={c.secundaria} padrao={padraoManga} caixa={[0, 20, 240, 160]} />
      <Peca id={`${base}md`} d={MANGA_D(longa)} c1={manga} c2={c.secundaria} padrao={padraoManga} caixa={[0, 20, 240, 160]} />
      {temPunho(c) && (
        <>
          <path d={PUNHO_E(longa)} fill={c.secundaria} stroke={CONTORNO} strokeWidth={2.5} />
          <path d={PUNHO_D(longa)} fill={c.secundaria} stroke={CONTORNO} strokeWidth={2.5} />
        </>
      )}
      <Peca id={`${base}co`} d={CORPO} c1={c.primaria} c2={c.secundaria} padrao={c.padrao === 'mangas' ? 'lisa' : c.padrao} caixa={[60, 20, 120, 250]} />
      <path d="M74 254 Q120 262 166 254" stroke={CONTORNO} strokeOpacity={0.35} strokeWidth={1.2} strokeDasharray="3 3" fill="none" />
      <Gola tipo={golaDe(c)} cor={c.secundaria} costas={costas} />
      {costas ? (
        <>
          <Texto x={120} y={92} size={20} cor={tinta} fundo={c.primaria} espaco={1}>{(nome ?? iniciais).toUpperCase().slice(0, 12)}</Texto>
          <Texto x={120} y={196} size={96} cor={tinta} fundo={c.primaria}>{num}</Texto>
        </>
      ) : (
        <>
          <g transform="translate(132 62) scale(0.26)">
            <path d={ESCUDO} fill={c.secundaria} stroke={CONTORNO} strokeWidth={7} />
            <text x={60} y={88} textAnchor="middle" fontFamily="Anton, Impact, sans-serif" fontSize={40} fill={detalheEscudo}>{iniciais.toUpperCase().slice(0, 3)}</text>
          </g>
          {peito && <Texto x={120} y={150} size={peito.length > 6 ? 24 : 34} cor={tinta} fundo={c.primaria} espaco={1.5}>{peito}</Texto>}
        </>
      )}
      {!soCamisa && (
        <>
          <Peca id={`${base}ca`} d={CALCAO} c1={c.calcao} c2={c.secundaria} padrao="lisa" caixa={[64, 284, 112, 72]} />
          <rect x={64} y={284} width={112} height={9} fill={c.secundaria} stroke={CONTORNO} strokeWidth={2} />
          {!costas && <Texto x={84} y={340} size={14} cor={tintaSobre(c.calcao)} fundo={c.calcao}>{num}</Texto>}
          <Peca id={`${base}mi`} d={MEIAO_E} c1={corDoMeiao(c)} c2={c.secundaria} padrao="lisa" caixa={[70, 364, 100, 48]} />
          <Peca id={`${base}mj`} d={MEIAO_D} c1={corDoMeiao(c)} c2={c.secundaria} padrao="lisa" caixa={[70, 364, 100, 48]} />
          <rect x={78} y={364} width={30} height={8} fill={c.secundaria} />
          <rect x={132} y={364} width={30} height={8} fill={c.secundaria} />
        </>
      )}
    </svg>
  );
}

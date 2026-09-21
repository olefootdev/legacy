import type { CSSProperties } from 'react';
import { MOEDA_JOGO } from '@/wallet/constants';

/**
 * Card canônico Legadão — preto + dourado ornamentado.
 *
 * Referência: ~/Desktop/ole-design-system/olefoot-legacy-design.pdf
 * Aspect ratio: 2:3 (1024 x 1536 viewBox).
 *
 * Tudo em SVG → escala perfeita em qualquer tamanho. Imagem de fundo (cenário
 * de coliseu) e foto do jogador são opcionais; quando ausentes, o card usa
 * apenas o painel ornamentado em dourado/preto.
 *
 * Tipografia herda de tokens globais: font-display e font-impact (Anton).
 * Cor primária: --color-neon-yellow.
 *
 * VOLT2 (2026-09-19): sem halo, sem degradê de superfície, sem serifa/itálico,
 * sem texto girado decorativo. Fica só o fade da base da foto (scrim).
 */

export interface LegacyPlayerCardStats {
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
}

export interface LegacyPlayerCardProps {
  key?: import("react").Key;
  name: string;
  position: string; // "CAM", "ATA", "GOL", etc.
  ovr: number;
  countryEmoji?: string; // ex: "🇧🇷"
  photoUrl?: string | null;
  backdropUrl?: string | null;
  stats: LegacyPlayerCardStats;
  edition?: { current: number; total: number }; // ex: { current: 1, total: 77 }
  tagline?: string; // default: "FEITO DE HISTÓRIA · MOVIDO POR HONRA"
  est?: number; // default: 2024
  className?: string;
  style?: CSSProperties;
}

const VB_W = 1024;
const VB_H = 1536;

// Paleta — tokens VOLT2 em hex (atributo SVG não lê var()). "GOLD" aqui é o
// volt do jogo (#FDE100), não o ouro da rede.
const GOLD = '#FDE100'; // --color-neon-yellow
const GOLD_DARK = '#C9B000'; // --color-neon-yellow-dark
const GOLD_DEEP = '#7E8185'; // --color-poeira
const BLACK = '#08090A'; // --color-nav
const DEEP_BLACK = '#0D0D0D'; // --color-deep-black
const PANEL = '#141516'; // --color-panel

function StatPip({
  x,
  label,
  value,
}: {
  key?: import("react").Key;
  x: number;
  label: string;
  value: number;
}) {
  return (
    <g transform={`translate(${x}, 0)`}>
      <text
        x="0"
        y="0"
        fill={GOLD_DARK}
        fontFamily="var(--font-display)"
        fontSize="28"
        fontWeight="700"
        letterSpacing="0.18em"
        textAnchor="middle"
      >
        {label}
      </text>
      <text
        x="0"
        y="44"
        fill={GOLD}
        fontFamily="var(--font-display)"
        fontSize="48"
        fontWeight="900"
        textAnchor="middle"
      >
        {value}
      </text>
    </g>
  );
}

export function LegacyPlayerCard(props: LegacyPlayerCardProps) {
  const {
    name,
    position,
    ovr,
    countryEmoji,
    photoUrl,
    backdropUrl,
    stats,
    edition,
    tagline = 'FEITO DE HISTÓRIA · MOVIDO POR HONRA',
    est = 2024,
    className,
    style,
  } = props;

  const editionLabel = edition ? `${String(edition.current).padStart(2, '0')}/${edition.total}` : null;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'block', width: '100%', height: 'auto', ...style }}
      role="img"
      aria-label={`Card Legadão de ${name}, ${position}, OVR ${ovr}`}
    >
      <defs>
        {/* Scrim: escurece a base da foto pra o nome ler (gradiente permitido) */}
        <linearGradient id="lpc-photo-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="55%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.95)" />
        </linearGradient>
        {/* Clip do interior da moldura */}
        <clipPath id="lpc-inner-clip">
          <path d="M 64 96 L 960 96 L 960 1440 L 64 1440 Z" />
        </clipPath>
      </defs>

      {/* === FUNDO === */}
      <rect width={VB_W} height={VB_H} fill={BLACK} />

      {/* Moldura externa preta */}
      <rect x="20" y="20" width={VB_W - 40} height={VB_H - 40} fill={DEEP_BLACK} />

      {/* === Conteúdo dentro da moldura (recortado) === */}
      <g clipPath="url(#lpc-inner-clip)">
        <rect x="64" y="96" width={VB_W - 128} height={VB_H - 192} fill={PANEL} />

        {/* Backdrop (cenário) opcional */}
        {backdropUrl && (
          <image
            href={backdropUrl}
            x="64"
            y="96"
            width={VB_W - 128}
            height={VB_H - 192}
            preserveAspectRatio="xMidYMid slice"
            opacity="0.55"
          />
        )}

        {/* Foto do jogador */}
        {photoUrl && (
          <image
            href={photoUrl}
            x="160"
            y="180"
            width="704"
            height="1000"
            preserveAspectRatio="xMidYMin slice"
          />
        )}

        {/* Fade na base da foto */}
        <rect x="64" y="700" width={VB_W - 128} height="500" fill="url(#lpc-photo-fade)" />
      </g>

      {/* === MOLDURA DOURADA ORNAMENTADA === */}
      {/* Borda principal (4 lados) */}
      <rect
        x="32"
        y="60"
        width={VB_W - 64}
        height={VB_H - 120}
        fill="none"
        stroke={GOLD}
        strokeWidth="3"
      />
      {/* Borda interna fina */}
      <rect
        x="48"
        y="80"
        width={VB_W - 96}
        height={VB_H - 160}
        fill="none"
        stroke={GOLD_DARK}
        strokeWidth="1"
        opacity="0.6"
      />

      {/* Cantos chanfrados ornamentais — cada canto é um L dourado */}
      {/* Top-left */}
      <path d="M 32 60 L 32 28 L 100 28 L 100 60 M 32 60 L 64 60 L 64 28" stroke={GOLD} strokeWidth="3" fill="none" />
      {/* Top-right */}
      <path d="M 992 60 L 992 28 L 924 28 L 924 60 M 992 60 L 960 60 L 960 28" stroke={GOLD} strokeWidth="3" fill="none" />
      {/* Bottom-left */}
      <path d="M 32 1476 L 32 1508 L 100 1508 L 100 1476 M 32 1476 L 64 1476 L 64 1508" stroke={GOLD} strokeWidth="3" fill="none" />
      {/* Bottom-right */}
      <path d="M 992 1476 L 992 1508 L 924 1508 L 924 1476 M 992 1476 L 960 1476 L 960 1508" stroke={GOLD} strokeWidth="3" fill="none" />

      {/* === FAIXA SUPERIOR (LEGADO • HONRA / HISTÓRIA • RESPEITO) === */}
      <text
        x="120"
        y="135"
        fill={GOLD}
        fontFamily="var(--font-display)"
        fontSize="18"
        fontWeight="700"
        letterSpacing="0.32em"
      >
        LEGADO · HONRA
      </text>
      <text
        x={VB_W - 120}
        y="135"
        fill={GOLD}
        fontFamily="var(--font-display)"
        fontSize="18"
        fontWeight="700"
        letterSpacing="0.32em"
        textAnchor="end"
      >
        HISTÓRIA · RESPEITO
      </text>

      {/* Coroa "L" central (logo simplificada em SVG) */}
      <g transform={`translate(${VB_W / 2}, 100)`}>
        {/* Coroa */}
        <path
          d="M -32 -18 L -26 -38 L -10 -26 L 0 -42 L 10 -26 L 26 -38 L 32 -18 L 32 0 L -32 0 Z"
          fill={GOLD}
        />
        {/* "L" abaixo */}
        <text
          x="0"
          y="36"
          fill={GOLD}
          fontFamily="var(--font-impact)"
          fontSize="44"
          textAnchor="middle"
        >
          L
        </text>
      </g>

      {/* === TOP-LEFT: OVR + POS + país === */}
      <g transform="translate(96, 260)">
        <text
          x="0"
          y="0"
          fill={GOLD}
          fontFamily="var(--font-display)"
          fontSize="160"
          fontWeight="900"
          letterSpacing="-0.04em"
        >
          {ovr}
        </text>
        <text
          x="0"
          y="60"
          fill={GOLD}
          fontFamily="var(--font-display)"
          fontSize="56"
          fontWeight="700"
          letterSpacing="0.08em"
        >
          {position}
        </text>
        {countryEmoji && (
          <text
            x="0"
            y="160"
            fontSize="64"
          >
            {countryEmoji}
          </text>
        )}
      </g>

      {/* === TOP-RIGHT: edição limitada === */}
      {editionLabel && (
        <g transform={`translate(${VB_W - 96}, 260)`}>
          <text
            x="0"
            y="0"
            fill={GOLD}
            fontFamily="var(--font-display)"
            fontSize="40"
            fontWeight="900"
            letterSpacing="0.05em"
            textAnchor="end"
          >
            {editionLabel}
          </text>
          <text
            x="0"
            y="46"
            fill={GOLD_DARK}
            fontFamily="var(--font-display)"
            fontSize="22"
            fontWeight="700"
            letterSpacing="0.22em"
            textAnchor="end"
          >
            EDIÇÃO
          </text>
          <text
            x="0"
            y="76"
            fill={GOLD_DARK}
            fontFamily="var(--font-display)"
            fontSize="22"
            fontWeight="700"
            letterSpacing="0.22em"
            textAnchor="end"
          >
            LIMITADA
          </text>
          {/* Mini-coroa selada */}
          <g transform="translate(-30, 130)">
            <rect x="-30" y="-30" width="60" height="60" fill="none" stroke={GOLD} strokeWidth="2" />
            <text
              x="0"
              y="12"
              fill={GOLD}
              fontFamily="var(--font-impact)"
              fontSize="36"
              textAnchor="middle"
            >
              L
            </text>
          </g>
        </g>
      )}

      {/* === DIVISOR antes do nome === */}
      <line x1="120" y1="1170" x2={VB_W - 120} y2="1170" stroke={GOLD} strokeWidth="2" />
      <line x1="120" y1="1176" x2={VB_W - 120} y2="1176" stroke={GOLD_DEEP} strokeWidth="1" opacity="0.6" />

      {/* === NOME === */}
      <text
        x={VB_W / 2}
        y="1280"
        fill={GOLD}
        fontFamily="var(--font-impact)"
        fontSize="124"
        letterSpacing="0.01em"
        textAnchor="middle"
      >
        {name.toUpperCase()}
      </text>

      {/* === TAGLINE === */}
      <text
        x={VB_W / 2}
        y="1318"
        fill={GOLD_DARK}
        fontFamily="var(--font-display)"
        fontSize="22"
        fontWeight="700"
        letterSpacing="0.28em"
        textAnchor="middle"
      >
        {tagline}
      </text>

      {/* Divisor antes dos stats */}
      <line x1="120" y1="1338" x2={VB_W - 120} y2="1338" stroke={GOLD_DARK} strokeWidth="1" opacity="0.5" />

      {/* === STATS === */}
      <g transform="translate(0, 1370)">
        {(() => {
          const items: { label: string; value: number }[] = [
            { label: 'PAC', value: stats.pac },
            { label: 'SHO', value: stats.sho },
            { label: 'PAS', value: stats.pas },
            { label: 'DRI', value: stats.dri },
            { label: 'DEF', value: stats.def },
            { label: 'PHY', value: stats.phy },
          ];
          const startX = 120;
          const endX = VB_W - 120;
          return items.map((it, i) => (
            <StatPip
              key={it.label}
              x={startX + ((endX - startX) * i) / (items.length - 1)}
              label={it.label}
              value={it.value}
            />
          ));
        })()}
      </g>

      {/* === RODAPÉ === */}
      <g transform={`translate(0, ${VB_H - 70})`}>
        <text
          x="100"
          y="0"
          fill={GOLD_DARK}
          fontFamily="var(--font-display)"
          fontSize="20"
          fontWeight="700"
          letterSpacing="0.22em"
        >
          EST.
        </text>
        <text
          x="100"
          y="30"
          fill={GOLD}
          fontFamily="var(--font-display)"
          fontSize="26"
          fontWeight="900"
          letterSpacing="0.1em"
        >
          {est}
        </text>

        <text
          x={VB_W * 0.34}
          y="14"
          fill={GOLD}
          fontFamily="var(--font-display)"
          fontSize="22"
          fontWeight="700"
          letterSpacing="0.32em"
          textAnchor="middle"
        >
          ÚNICO
        </text>

        {/* Mini-coroa central no rodapé */}
        <g transform={`translate(${VB_W / 2}, 6)`}>
          <circle r="22" fill="none" stroke={GOLD} strokeWidth="2" />
          <text
            x="0"
            y="10"
            fill={GOLD}
            fontFamily="var(--font-impact)"
            fontSize="26"
            textAnchor="middle"
          >
            L
          </text>
        </g>

        <text
          x={VB_W * 0.66}
          y="14"
          fill={GOLD}
          fontFamily="var(--font-display)"
          fontSize="22"
          fontWeight="700"
          letterSpacing="0.32em"
          textAnchor="middle"
        >
          INFINITO
        </text>

        <text
          x={VB_W - 100}
          y="0"
          fill={GOLD_DARK}
          fontFamily="var(--font-display)"
          fontSize="16"
          fontWeight="700"
          letterSpacing="0.22em"
          textAnchor="end"
        >
          {MOEDA_JOGO}
        </text>
        <text
          x={VB_W - 100}
          y="22"
          fill={GOLD_DARK}
          fontFamily="var(--font-display)"
          fontSize="16"
          fontWeight="700"
          letterSpacing="0.22em"
          textAnchor="end"
        >
          VERIFICADO
        </text>
      </g>
    </svg>
  );
}

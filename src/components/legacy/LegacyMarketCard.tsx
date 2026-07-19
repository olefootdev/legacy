import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { LegacyPlayerRow, LegacyLotInfo } from '@/supabase/legacyPlayers';
import { legacyPortraitFocusStyle } from '@/supabase/legacyPlayers';
import { rarityTierOf, RARITY_LABEL, type RarityTier } from '@/entities/rarityLabels';

/**
 * LegacyMarketCard — carta colecionável do mercado de lendas (Legacy Tech).
 *
 * Tamanho ÚNICO (sem hero): pensada pra carrossel horizontal — o usuário arrasta
 * o dedo e vê todas as cartas do atleta. Foto 4/5 P&B→cor, OVR Moret italic, nome
 * Agency, raridade = GRAU DE AMARELO. Tilt 3D no mouse; clicar VIRA pra ficha
 * (clicar de novo volta). Todo dado é real (attrs, ensino, booster, escassez do
 * lote). A ordenação (mais cara primeiro) vive no TransferLegaciesTab.
 */

type Tier = RarityTier;

const ATTR_ROWS: Array<{ key: string; label: string }> = [
  { key: 'drible', label: 'DRI' },
  { key: 'passe', label: 'PAS' },
  { key: 'finalizacao', label: 'FIN' },
  { key: 'velocidade', label: 'VEL' },
  { key: 'fisico', label: 'FÍS' },
  { key: 'marcacao', label: 'MAR' },
];

function tierOf(row: LegacyPlayerRow, ovr: number): Tier {
  return rarityTierOf(row.rarity_label, ovr);
}

const TIER_LABEL: Record<Tier, string> = RARITY_LABEL;

/** Sinal de calor HONESTO — derivado da escassez real do lote, não de contador fake. */
function scarcitySignal(lot?: LegacyLotInfo): string | null {
  if (!lot || lot.supply <= 0) return null;
  const pct = lot.restam / lot.supply;
  if (pct <= 0.1) return 'Últimas unidades';
  if (pct <= 0.25) return 'Quase esgotado';
  return null;
}

export function LegacyMarketCard({
  row,
  ovr,
  portrait,
  priceLabel,
  pixReady,
  lot,
  owned,
  onOpen,
}: {
  row: LegacyPlayerRow;
  ovr: number;
  portrait: string | null;
  priceLabel: string;
  pixReady: boolean;
  lot?: LegacyLotInfo;
  owned: boolean;
  onOpen: () => void;
}) {
  const tier = tierOf(row, ovr);
  const [flipped, setFlipped] = useState(false);
  const [tilt, setTilt] = useState<{ rx: number; ry: number; mx: number; my: number } | null>(null);
  const reduceRef = useRef(
    typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const stageRef = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    if (reduceRef.current || flipped || !stageRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({ rx: (0.5 - py) * 10, ry: (px - 0.5) * 10, mx: px * 100, my: py * 100 });
  };

  const flip = () => {
    setTilt(null);
    setFlipped((f) => !f);
  };

  const rotY = (flipped ? 180 : 0) + (tilt?.ry ?? 0);
  const rotX = flipped ? 0 : tilt?.rx ?? 0;

  const scarce = scarcitySignal(lot);
  const taught = Array.isArray(row.taught_attributes) ? row.taught_attributes.slice(0, 3) : [];
  const boosterEntries = Object.entries(row.team_booster ?? {}).filter(([, v]) => typeof v === 'number' && v !== 0);
  const attrs = row.attributes ?? {};
  const topTwo = new Set(
    ATTR_ROWS.map((a) => ({ k: a.key, v: attrs[a.key] ?? 0 }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 2)
      .map((a) => a.k),
  );

  const faceBorder = cn(
    'border border-white/[0.08]',
    tier === 'epico' && 'border-l-[3px] border-l-neon-yellow',
    tier === 'ultra' && 'border-neon-yellow/40',
    tier === 'raro' && 'border-l-[3px] border-l-white/15',
    tier === 'premium' && 'border-l-[3px] border-l-white/10',
    tier === 'ai' && 'border-l-[3px] border-l-sky-400/40',
  );

  const BuyButton = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="flex w-full min-w-0 items-center justify-center gap-2 rounded-[4px] bg-neon-yellow px-2 py-3 font-display font-black uppercase text-black transition-colors hover:bg-white"
    >
      <span className="min-w-0 truncate tabular-nums" style={{ fontSize: 13, letterSpacing: '0.02em' }}>
        {priceLabel}
      </span>
      <span className="flex-none rounded-[3px] border border-black/25 px-1.5 py-0.5 text-[9px] tracking-[0.06em]">
        {pixReady ? 'PIX' : 'OLE'}
      </span>
    </button>
  );

  return (
    <div
      ref={stageRef}
      style={{ perspective: 1100 }}
      onMouseMove={onMove}
      onMouseLeave={() => setTilt(null)}
      className="group relative rounded-[7px]"
    >
      <article
        className="relative transition-transform duration-500 ease-out"
        style={{ transformStyle: 'preserve-3d', transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)` }}
      >
        {/* ---------- FRENTE ---------- */}
        <div
          className={cn('relative flex flex-col overflow-hidden bg-gradient-to-b from-[var(--color-card-hi)] to-[var(--color-card)]', faceBorder)}
          style={{ borderRadius: 6, backfaceVisibility: 'hidden' }}
        >
          {tier === 'epico' && (
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 z-[5] h-[2px]"
              style={{ background: 'linear-gradient(90deg,#FDE100,transparent 65%)', boxShadow: '0 0 12px rgba(253,225,0,.45)' }}
            />
          )}

          {/* Foto — clicar VIRA pra ficha */}
          <div
            role="button"
            tabIndex={0}
            onClick={flip}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                flip();
              }
            }}
            aria-label={`Ver ficha de ${row.name}`}
            className="relative aspect-[4/5] cursor-pointer overflow-hidden bg-deep-black outline-none focus-visible:ring-2 focus-visible:ring-neon-yellow/50"
          >
            {portrait ? (
              <img
                src={portrait}
                alt={row.name}
                className="ole-player-photo-bw h-full w-full object-cover transition-[filter] duration-500 group-hover:[filter:grayscale(0)_contrast(1.03)]"
                // Usa o foco que o admin definiu (portrait_focus_x/y/zoom) em vez
                // do 'center 10%' fixo, que cortava a cabeça em várias fotos.
                // Foco padrão (y=0) = topo. Ver AdminLegendCreatorPanel.
                style={legacyPortraitFocusStyle(row)}
                referrerPolicy="no-referrer"
                draggable={false}
              />
            ) : (
              <div className="flex h-full items-center justify-center font-display text-4xl font-black uppercase text-white/25">
                {row.name.slice(0, 2)}
              </div>
            )}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 z-[2] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              style={{ background: `radial-gradient(600px circle at ${tilt?.mx ?? 50}% ${tilt?.my ?? 0}%, rgba(253,225,0,.10), transparent 42%)` }}
            />
            <span aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(0deg,var(--color-card) 2%,rgba(36,36,36,.1) 34%,transparent 55%)' }} />

            <div className="absolute left-3 top-2.5 z-[3] leading-[0.78]">
              <span
                className="block text-neon-yellow"
                style={{ fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic', fontWeight: 700, fontSize: 34, textShadow: '0 2px 10px rgba(0,0,0,.8)', letterSpacing: '-0.03em' }}
              >
                {ovr}
              </span>
              <span className="font-display font-extrabold uppercase text-white/70" style={{ fontSize: 8, letterSpacing: '0.2em' }}>
                OVR
              </span>
            </div>

            <span
              className={cn(
                'absolute right-3 top-3 z-[3] rounded-[4px] font-display font-black uppercase',
                tier === 'epico' && 'bg-neon-yellow text-black shadow-[0_0_14px_rgba(253,225,0,0.45)]',
                tier === 'ultra' && 'border border-neon-yellow/60 text-neon-yellow',
                tier === 'raro' && 'border border-white/20 text-white/60',
                tier === 'premium' && 'border border-white/12 text-white/40',
                // AI+ sai da escada de amarelo: card gerado por IA, não é prestígio.
                tier === 'ai' && 'border border-sky-400/50 text-sky-300/80',
              )}
              style={{ fontSize: 9, letterSpacing: '0.2em', padding: '4px 7px' }}
            >
              {TIER_LABEL[tier]}
            </span>

            {scarce && (
              <span
                className="absolute left-3 top-[52px] z-[3] inline-flex items-center gap-1 rounded-full border border-neon-yellow/35 bg-deep-black/70 font-display font-bold uppercase text-neon-yellow"
                style={{ fontSize: 9, letterSpacing: '0.14em', padding: '3px 7px' }}
              >
                🔥 {scarce}
              </span>
            )}

            <div className="absolute inset-x-0 bottom-0 z-[3] px-3 pb-3">
              <h3 className="truncate font-display font-extrabold uppercase leading-[0.96] text-white" style={{ fontSize: 20, letterSpacing: '0.01em' }}>
                {row.name}
              </h3>
              <p className="mt-0.5 font-display font-bold uppercase text-white/60" style={{ fontSize: 9, letterSpacing: '0.16em' }}>
                {row.pos} · {row.country ?? '—'}
              </p>
            </div>
          </div>

          <div className="bg-[var(--color-card)] px-3 pb-3 pt-2.5">
            {lot && lot.supply > 0 && (
              <>
                <div className="mb-2 h-1 overflow-hidden rounded-full bg-[var(--color-card-hi)]">
                  <span className="block h-full bg-neon-yellow" style={{ width: `${Math.max(3, (lot.restam / lot.supply) * 100)}%` }} />
                </div>
                <div className="mb-2 flex items-center justify-between text-[11px] text-white/55">
                  <span>
                    restam <b className="text-neon-yellow tabular-nums">{lot.restam.toLocaleString('pt-BR')}</b>
                  </span>
                  <span className="tabular-nums">Ed. {lot.supply.toLocaleString('pt-BR')}</span>
                </div>
              </>
            )}
            {owned ? (
              <span className="flex w-full items-center justify-center gap-1.5 rounded-[4px] border border-[var(--color-success)] py-3 font-display text-[11px] font-black uppercase tracking-[0.12em] text-[var(--color-success)]">
                ✓ No time
              </span>
            ) : (
              BuyButton
            )}
          </div>
        </div>

        {/* ---------- VERSO (ficha real) — clicar volta pra frente ---------- */}
        <div
          onClick={flip}
          className={cn('absolute inset-0 flex cursor-pointer flex-col bg-gradient-to-b from-[var(--color-card-hi)] to-[var(--color-card)] p-3.5', faceBorder)}
          style={{ borderRadius: 6, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-neon-yellow">Ficha técnica</span>
            <span className="font-display text-[9px] uppercase tracking-[0.16em] text-white/35">toque p/ voltar</span>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-1.5">
            {ATTR_ROWS.map((a) => (
              <div key={a.key} className="rounded-[4px] border border-white/[0.08] bg-deep-black/50 py-2 text-center">
                <b
                  className={cn('block leading-none', topTwo.has(a.key) ? 'text-neon-yellow' : 'text-white')}
                  style={{ fontFamily: 'var(--font-serif-hero)', fontStyle: 'italic', fontWeight: 700, fontSize: 18 }}
                >
                  {attrs[a.key] ?? '—'}
                </b>
                <span className="mt-0.5 block font-display text-[8px] font-extrabold uppercase tracking-[0.14em] text-white/50">{a.label}</span>
              </div>
            ))}
          </div>
          {taught.length > 0 && (
            <div className="flex items-center justify-between border-t border-white/[0.08] py-1.5 text-[11px] text-white/60">
              <span>Ensina no time</span>
              <b className="font-medium text-white">{taught.join(' · ')}</b>
            </div>
          )}
          {boosterEntries.length > 0 && (
            <div className="flex items-center justify-between border-t border-white/[0.08] py-1.5 text-[11px] text-white/60">
              <span>Bônus de time</span>
              <b className="font-medium text-white">
                {boosterEntries.map(([k, v]) => `${k} +${v}${k.includes('pct') ? '%' : ''}`).join(' · ')}
              </b>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-white/[0.08] py-1.5 text-[11px] text-white/60">
            <span>Edição</span>
            <b className="font-medium text-white tabular-nums">{(lot?.supply ?? row.card_supply ?? 0).toLocaleString('pt-BR')} cópias</b>
          </div>
        </div>
      </article>
    </div>
  );
}

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { LegacyPlayerRow, LegacyLotInfo } from '@/supabase/legacyPlayers';
import { legacyPortraitFocusStyle } from '@/supabase/legacyPlayers';
import { rarityTierOf, RARITY_LABEL, type RarityTier } from '@/entities/rarityLabels';
import { moedaDoJogo } from '@/wallet/constants';
import { L, LOCALE } from '@/i18n/L';
import { posLabel } from '@/components/matchquick/posLabel';
import { DEGRAU_CLASSES, MarcaRua } from '@/components/ui/Rua';
import {
  DEGRAU_INFO,
  Segmentos,
  ctaCartaClasses,
  degrauDe,
  faixaClasses,
  fotoFundo,
  ovrClasses,
} from '@/components/market/rua/escada';

/**
 * LegacyMarketCard — carta colecionável do mercado de lendas, na ESCADA do
 * DS 2027 · "Respeito é ouro".
 *
 * O OVR decide o degrau (CHÃO cal · CORRE rua · RESPEITO asfalto+fio de ouro ·
 * LENDA ouro chapado). Foto 4/5 P&B→cor, OVR em Anton, nome na VOZ (Pirata),
 * rótulos em prova. A carta pode vir colada torta (`torto`, até 6°) como lambe
 * num muro — o hover endireita. Clicar na foto VIRA pra ficha (clicar de novo
 * volta) — virada chapada, sem 3D (o DS proíbe). Todo dado é real (attrs,
 * ensino, booster, escassez do lote).
 */

type Tier = RarityTier;

const ATTR_ROWS: Array<{ key: string; label: string }> = [
  { key: 'drible', label: 'DRI' },
  { key: 'passe', label: 'PAS' },
  { key: 'finalizacao', label: L('FIN', 'SHO') },
  { key: 'velocidade', label: L('VEL', 'PAC') },
  { key: 'fisico', label: L('FÍS', 'PHY') },
  { key: 'marcacao', label: L('MAR', 'DEF') },
];

function tierOf(row: LegacyPlayerRow, ovr: number): Tier {
  return rarityTierOf(row.rarity_label, ovr);
}

const TIER_LABEL: Record<Tier, string> = RARITY_LABEL;

/** Sinal de calor HONESTO — derivado da escassez real do lote, não de contador fake. */
function scarcitySignal(lot?: LegacyLotInfo): string | null {
  if (!lot || lot.supply <= 0) return null;
  const pct = lot.restam / lot.supply;
  if (pct <= 0.1) return L('Últimas unidades', 'Last units');
  if (pct <= 0.25) return L('Quase esgotado', 'Almost sold out');
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
  tag,
  torto = 0,
  onOpen,
}: {
  row: LegacyPlayerRow;
  ovr: number;
  portrait: string | null;
  priceLabel: string;
  pixReady: boolean;
  lot?: LegacyLotInfo;
  owned: boolean;
  /** Fase/edição da carta (#revelação, #consolidação, #expansão). Na grade do
   *  mercado é o que diferencia as cartas do MESMO atleta. */
  tag?: string | null;
  /** Inclinação de lambe colado, em graus (DS: até 6°). 0 = reta. */
  torto?: number;
  onOpen: () => void;
}) {
  const tier = tierOf(row, ovr);
  const d = degrauDe(ovr);
  const info = DEGRAU_INFO[d];
  const [flipped, setFlipped] = useState(false);

  const flip = () => setFlipped((f) => !f);

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
  const destaque = d === 'respeito' ? 'text-ouro-27' : '';
  // Linha fina dentro da carta: some no fundo de cada degrau sem brigar com ele.
  const fio = d === 'respeito' ? 'border-linha' : 'border-asfalto-27/25';
  // Selo de cima da foto sempre em asfalto: lê em qualquer retrato.
  const seloFoto =
    'inline-flex max-w-full items-center truncate whitespace-nowrap bg-asfalto-27 px-1.5 py-0.5 font-prova text-[9.5px] font-bold uppercase tracking-[0.08em]';

  return (
    <div
      className="group relative transition-transform duration-200 hover:!rotate-0 hover:-translate-y-1"
      style={torto ? { transform: `rotate(${torto}deg)` } : undefined}
    >
      <article
        className={cn(
          'relative flex h-full flex-col gap-2.5 p-2.5 shadow-[5px_6px_0_rgba(0,0,0,0.55)] sm:p-3',
          DEGRAU_CLASSES[d],
        )}
      >
        {/* ---------- FRENTE (fica no fluxo pra segurar a altura da carta) ---------- */}
        <div className={cn('flex min-w-0 flex-1 flex-col gap-2.5', flipped && 'invisible')} aria-hidden={flipped}>
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="flex flex-col">
              <span
                className={cn('font-impact leading-[0.85] tabular-nums', ovrClasses(d))}
                style={{ fontSize: 'clamp(40px, 11vw, 52px)' }}
              >
                {ovr}
              </span>
              <span className={cn('mt-1 font-impact text-[14px] uppercase leading-none', destaque)}>{posLabel(row.pos)}</span>
            </div>
            <MarcaRua tipo="escudo" className={cn('h-7', d === 'respeito' ? 'bg-ouro-27' : 'bg-asfalto-27')} />
          </div>

          {/* Foto — clicar VIRA pra ficha */}
          <div
            role="button"
            tabIndex={flipped ? -1 : 0}
            onClick={flip}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                flip();
              }
            }}
            aria-label={L(`Ver ficha de ${row.name}`, `View ${row.name}'s profile`)}
            className={cn(
              'relative aspect-[4/5] w-full cursor-pointer overflow-hidden outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-asfalto-27',
              fotoFundo(d),
            )}
          >
            {portrait ? (
              <img
                src={portrait}
                alt={row.name}
                className="ole-player-photo-bw h-full w-full object-cover transition-[filter] duration-500 group-hover:[filter:grayscale(0)_contrast(1.03)]"
                // Foco que o admin definiu (portrait_focus_x/y/zoom). Ver AdminLegendCreatorPanel.
                style={legacyPortraitFocusStyle(row)}
                referrerPolicy="no-referrer"
                draggable={false}
              />
            ) : (
              <MarcaRua tipo="escudo" className="absolute left-1/2 top-1/2 h-14 -translate-x-1/2 -translate-y-1/2 bg-current opacity-30" />
            )}

            <div className="absolute inset-x-0 top-2 flex min-w-0 items-start justify-between gap-1">
              <span className={cn(seloFoto, d === 'lenda' ? 'text-ouro-27' : 'text-papel')}>{TIER_LABEL[tier]}</span>
              {scarce && <span className={cn(seloFoto, 'text-rua')}>{scarce}</span>}
            </div>
          </div>

          <div className="min-w-0">
            <h3 className="truncate font-voz text-[24px] leading-[0.95] sm:text-[26px]">{row.name}</h3>
            <p className="mt-1 truncate font-prova text-[10px] font-bold uppercase tracking-[0.14em] opacity-75">
              {row.country ?? '—'}
              {tag ? <span className="normal-case tracking-normal"> · {tag}</span> : null}
            </p>
          </div>

          {/* Escassez REAL do lote — barra em segmentos, cor do degrau. */}
          {lot && lot.supply > 0 && (
            <div className="flex flex-col gap-1">
              <Segmentos
                valor={lot.restam}
                max={lot.supply}
                cheio={d === 'respeito' ? 'bg-ouro-27' : 'bg-asfalto-27'}
                vazio={d === 'respeito' ? 'bg-linha' : 'bg-asfalto-27/20'}
                className="h-2"
              />
              <div className="flex items-center justify-between font-prova text-[10px] font-bold uppercase tracking-[0.08em]">
                <span>
                  {L('restam', 'left')} <b className={cn('tabular-nums', destaque)}>{lot.restam.toLocaleString(LOCALE)}</b>
                </span>
                <span className="tabular-nums opacity-75">Ed. {lot.supply.toLocaleString(LOCALE)}</span>
              </div>
            </div>
          )}

          <div className={faixaClasses(d)}>
            <span className="truncate">
              {info.n} · {info.nome}
            </span>
          </div>

          <div className="mt-auto flex min-w-0 flex-col gap-2">
            {owned ? (
              <span
                className={cn(
                  'flex min-h-11 w-full items-center justify-center gap-1.5 border-2 border-dashed font-impact text-[16px] uppercase leading-none',
                  d === 'respeito' ? 'border-ouro-27 text-ouro-27' : 'border-asfalto-27',
                )}
              >
                ✓ {L('No time', 'In squad')}
              </span>
            ) : (
              <>
                <div className="flex min-w-0 items-end justify-between gap-2">
                  <span
                    className={cn('min-w-0 truncate font-spray font-black leading-none tabular-nums', destaque)}
                    style={{ fontSize: 'clamp(20px, 5.6vw, 28px)' }}
                    title={priceLabel}
                  >
                    {priceLabel}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 px-1.5 py-0.5 font-prova text-[9.5px] font-bold uppercase tracking-[0.08em]',
                      d === 'respeito' ? 'border-2 border-ouro-27 text-ouro-27' : 'bg-asfalto-27 text-papel',
                    )}
                  >
                    {pixReady ? 'PIX' : moedaDoJogo()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen();
                  }}
                  className={ctaCartaClasses(d)}
                >
                  {L('Comprar', 'Buy')} <span aria-hidden>→</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* ---------- VERSO (ficha real) — clicar volta pra frente ---------- */}
        {flipped && (
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
            aria-label={L('Voltar pra frente da carta', 'Back to card front')}
            className="absolute inset-0 flex cursor-pointer flex-col gap-2.5 overflow-y-auto p-2.5 outline-none sm:p-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className={cn('font-impact text-[18px] uppercase leading-none', destaque)}>{L('Ficha', 'Profile')}</span>
              <span className="font-prova text-[9px] uppercase tracking-[0.14em] opacity-70">{L('toque p/ voltar', 'tap to go back')}</span>
            </div>
            <p className="truncate font-voz text-[22px] leading-none">{row.name}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {ATTR_ROWS.map((a) => (
                <div key={a.key} className={cn('border-2 py-1.5 text-center', fio)}>
                  <b
                    className={cn(
                      'block font-impact text-[20px] leading-none tabular-nums',
                      topTwo.has(a.key) && (d === 'respeito' ? 'text-ouro-27' : 'underline decoration-2 underline-offset-2'),
                    )}
                  >
                    {attrs[a.key] ?? '—'}
                  </b>
                  <span className="mt-0.5 block font-prova text-[9px] font-bold uppercase tracking-[0.12em] opacity-70">{a.label}</span>
                </div>
              ))}
            </div>
            {taught.length > 0 && (
              <div className={cn('flex flex-col gap-0.5 border-t-2 pt-1.5 text-[11px]', fio)}>
                <span className="font-prova text-[9.5px] font-bold uppercase tracking-[0.12em] opacity-70">{L('Ensina no time', 'Teaches the team')}</span>
                <b className="font-medium">{taught.join(' · ')}</b>
              </div>
            )}
            {boosterEntries.length > 0 && (
              <div className={cn('flex flex-col gap-0.5 border-t-2 pt-1.5 text-[11px]', fio)}>
                <span className="font-prova text-[9.5px] font-bold uppercase tracking-[0.12em] opacity-70">{L('Bônus de time', 'Team bonus')}</span>
                <b className="font-medium">
                  {boosterEntries.map(([k, v]) => `${k} +${v}${k.includes('pct') ? '%' : ''}`).join(' · ')}
                </b>
              </div>
            )}
            <div className={cn('mt-auto flex items-center justify-between border-t-2 pt-1.5 font-prova text-[10px] font-bold uppercase tracking-[0.1em]', fio)}>
              <span className="opacity-70">{L('Edição', 'Edition')}</span>
              <span className="tabular-nums">
                {(lot?.supply ?? row.card_supply ?? 0).toLocaleString(LOCALE)} {L('cópias', 'copies')}
              </span>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}

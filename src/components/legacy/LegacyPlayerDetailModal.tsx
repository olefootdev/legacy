import { AnimatePresence, motion } from 'framer-motion';
import { X, Crown, Coins } from 'lucide-react';
import {
  legacyPortraitImageUrl,
  legacyPortraitFocusStyle,
  legacyRowToPlayerEntity,
  type LegacyPlayerRow,
} from '@/supabase/legacyPlayers';
import { overallFromAttributes } from '@/entities/player';
import type { PlayerAttributes } from '@/entities/types';

const ATTR_LABELS: Array<[keyof PlayerAttributes, string]> = [
  ['velocidade', 'Velocidade'],
  ['finalizacao', 'Finalização'],
  ['drible', 'Drible'],
  ['passe', 'Passe'],
  ['marcacao', 'Marcação'],
  ['fisico', 'Físico'],
  ['tatico', 'Tático'],
  ['mentalidade', 'Mentalidade'],
  ['confianca', 'Confiança'],
  ['fairPlay', 'Fair Play'],
];

function attrColor(v: number): string {
  if (v >= 85) return 'bg-emerald-400';
  if (v >= 70) return 'bg-amber-400';
  if (v >= 55) return 'bg-yellow-500/70';
  return 'bg-white/30';
}

function fmtBrl(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

/**
 * Detalhe de um jogador Legacy — história + atributos + compra. Equivalente
 * ao modal dos Genesis: clica no card e vê a ficha completa.
 */
export function LegacyPlayerDetailModal({
  row,
  open,
  onClose,
  brlCents,
  isOwned,
  canAffordOle,
  onBuy,
  onPixBuy,
}: {
  row: LegacyPlayerRow | null;
  open: boolean;
  onClose: () => void;
  brlCents: number | null;
  isOwned: boolean;
  canAffordOle: boolean;
  onBuy: () => void;
  onPixBuy: () => void;
}) {
  if (!open || !row) return null;
  const entity = legacyRowToPlayerEntity(row);
  const ovr = overallFromAttributes(entity.attrs);
  const portrait = legacyPortraitImageUrl(row);
  const priceExp = Math.max(1, Math.round(row.price_bro_cents));
  const taught = Array.isArray(row.taught_attributes) ? row.taught_attributes : [];
  const boosterEntries = Object.entries(row.team_booster ?? {});

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/85 backdrop-blur-sm sm:items-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="relative mx-auto flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-amber-500/30 bg-dark-gray shadow-lg sm:rounded-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Legacy DNA</span>
              {row.collection_title && (
                <span className="text-[10px] text-white/45">· {row.collection_title}</span>
              )}
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/* Foto + identidade */}
            <div className="flex items-start gap-4">
              {portrait ? (
                <div className="relative aspect-[11/15.6] w-28 shrink-0 overflow-hidden rounded-xl ring-2 ring-amber-500/50">
                  <img
                    src={portrait}
                    alt={entity.name}
                    style={legacyPortraitFocusStyle(row)}
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
              ) : (
                <div className="grid aspect-[11/15.6] w-28 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-400">
                  <Crown className="h-10 w-10" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl font-black leading-tight text-white">{entity.name}</p>
                <p className="mt-0.5 text-xs text-white/55">
                  {entity.pos}{row.country ? ` · ${row.country}` : ''}{row.age ? ` · ${row.age} anos` : ''}
                </p>
                <div className="mt-2 inline-flex items-baseline gap-1.5 rounded-lg bg-black/40 px-2.5 py-1">
                  <span className="font-serif-hero text-2xl font-black text-neon-yellow" style={{ fontFamily: 'var(--font-serif-hero)' }}>{ovr}</span>
                  <span className="text-[10px] uppercase tracking-wide text-white/40">OVR</span>
                </div>
              </div>
            </div>

            {/* História */}
            {row.bio && (
              <div className="mt-4">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">História</p>
                <p className="text-[13px] leading-relaxed text-white/70">{row.bio}</p>
              </div>
            )}

            {/* Atributos */}
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Atributos</p>
              <div className="grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2">
                {ATTR_LABELS.map(([key, label]) => {
                  const v = entity.attrs[key] ?? 0;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-[11px] text-white/55">{label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div className={`h-full rounded-full ${attrColor(v)}`} style={{ width: `${v}%` }} />
                      </div>
                      <span className="w-7 shrink-0 text-right font-mono text-xs font-bold text-white">{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ensina + Booster */}
            {taught.length > 0 && (
              <div className="mt-4">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">Ensina aos companheiros</p>
                <div className="flex flex-wrap gap-1">
                  {taught.map((a) => (
                    <span key={a} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-300">{a}</span>
                  ))}
                </div>
              </div>
            )}
            {boosterEntries.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">Booster do time (titular)</p>
                <div className="flex flex-wrap gap-1">
                  {boosterEntries.map(([k, v]) => (
                    <span key={k} className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-300">{k} +{v}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer: compra */}
          <div className="space-y-2 border-t border-white/10 px-5 py-4">
            {isOwned ? (
              <div className="rounded-lg bg-white/5 py-2.5 text-center text-[12px] font-bold uppercase tracking-wider text-gray-400">
                Você já tem este jogador
              </div>
            ) : (
              <>
                {brlCents != null && (
                  <button
                    type="button"
                    onClick={onPixBuy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-black uppercase tracking-wide text-black transition hover:brightness-110"
                  >
                    Comprar com PIX · {fmtBrl(brlCents)}
                  </button>
                )}
                {row.currency !== 'USDT' && (
                  <button
                    type="button"
                    onClick={onBuy}
                    disabled={!canAffordOle}
                    className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-bold uppercase tracking-wider transition ${
                      canAffordOle ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-white/5 text-gray-500'
                    }`}
                  >
                    <Coins className="h-4 w-4" />
                    {canAffordOle ? `Comprar · ${priceExp.toLocaleString('pt-BR')} OLE` : 'Sem saldo OLE'}
                  </button>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

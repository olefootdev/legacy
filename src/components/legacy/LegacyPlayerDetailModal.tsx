import { AnimatePresence, motion } from 'framer-motion';
import { X, Crown, Coins, TrendingUp, BookText, GraduationCap, Sparkles } from 'lucide-react';
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

function fmtBrl(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

/** Barra de atributo (mesmo espírito do StatBar do mercado Genesis). */
function StatBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 90 ? 'bg-neon-yellow' : value >= 80 ? 'bg-emerald-400' : value >= 70 ? 'bg-amber-400' : value >= 55 ? 'bg-blue-400' : 'bg-gray-500';
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="w-24 shrink-0 text-[11px] font-medium text-white/55">{label}</span>
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full border border-white/5 bg-black/50">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="w-7 shrink-0 text-right font-display text-sm font-bold tabular-nums text-white">{value}</span>
    </div>
  );
}

/**
 * Detalhe de um jogador Legacy — padronizado no layout rico dos Genesis
 * (2 colunas: card à esquerda, ficha completa à direita). Mantém os
 * diferenciais do Legacy: História, Ensina aos companheiros e Booster do time.
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
  const cardStats: Array<[string, number]> = [
    ['PAC', entity.attrs.velocidade],
    ['SHO', entity.attrs.finalizacao],
    ['PAS', entity.attrs.passe],
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[80] flex min-h-0 flex-col overflow-y-auto overscroll-y-contain bg-black/90 px-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-[max(1.25rem,calc(env(safe-area-inset-bottom,0px)+5.5rem))] backdrop-blur-sm sm:items-center sm:justify-center sm:px-4 sm:pb-6 sm:pt-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          className="my-2 flex w-full min-h-0 max-w-[min(100%,60rem)] flex-col overflow-hidden rounded-2xl border-2 border-amber-400/55 bg-deep-black shadow-[0_0_50px_-8px_rgba(245,158,11,0.45)] sm:my-4 max-h-[min(920px,calc(100dvh-7.5rem))] sm:max-h-[min(920px,calc(100dvh-4.5rem))]"
        >
          {/* Topbar */}
          <div className="z-[60] flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <Crown className="h-4 w-4 shrink-0 text-amber-300" strokeWidth={2.5} />
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Legacy DNA</span>
              {row.collection_title && (
                <span className="truncate text-[10px] text-white/40">· {row.collection_title}</span>
              )}
            </div>
            <button type="button" onClick={onClose} className="rounded-full bg-black/50 p-2 text-gray-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Corpo com scroll */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
            <div className="flex flex-col md:flex-row">
              {/* ESQUERDA — card */}
              <div className="flex w-full shrink-0 items-start justify-center border-b border-white/10 bg-black/20 p-4 sm:p-6 md:w-2/5 md:border-b-0 md:border-r">
                <div className="w-full max-w-[300px]">
                  <div className="overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-gradient-to-b from-amber-950/30 to-black">
                    <div className="relative aspect-[11/15.6] w-full overflow-hidden bg-gradient-to-br from-amber-900/25 to-black">
                      {portrait ? (
                        <img src={portrait} alt={entity.name} style={legacyPortraitFocusStyle(row)} className="absolute inset-0 h-full w-full" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-amber-400/40">
                          <Crown className="h-16 w-16" />
                        </div>
                      )}
                      <div className="absolute left-2.5 top-2.5 rounded-lg border border-amber-400/40 bg-black/70 px-2.5 py-1 backdrop-blur">
                        <p className="italic leading-none tabular-nums text-amber-300" style={{ fontFamily: 'var(--font-serif-hero)', fontWeight: 700, fontSize: '24px' }}>
                          {ovr}
                        </p>
                      </div>
                      {/* sem overlay de nome aqui: a coluna da direita já traz o nome
                          grande, e sobrepor duplicaria o nome estampado na arte. */}
                    </div>
                    <div className="grid grid-cols-3 gap-px bg-white/5">
                      {cardStats.map(([label, val]) => (
                        <div key={label} className="bg-black/40 px-1 py-2 text-center">
                          <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/40">{label}</p>
                          <p className="italic leading-none tabular-nums text-white" style={{ fontFamily: 'var(--font-serif-hero)', fontWeight: 700, fontSize: '16px' }}>
                            {val}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* DIREITA — ficha */}
              <div className="min-w-0 flex-1 p-4 sm:p-6">
                <div className="flex flex-col gap-5">
                  {/* Header */}
                  <div className="border-b border-white/10 pb-4">
                    <h2 className="break-words font-display text-2xl font-black italic uppercase tracking-wider text-white sm:text-3xl">
                      {entity.name}
                    </h2>
                    <p className="break-words text-sm font-bold uppercase tracking-widest text-amber-300">
                      {entity.pos} • Overall {ovr}
                    </p>
                    <p className="mt-1.5 text-[10px] text-gray-500">
                      {row.collection_title ? `${row.collection_title} · ` : ''}
                      {row.country ?? '—'}{row.age ? ` · ${row.age} anos` : ''}
                    </p>
                  </div>

                  {/* História */}
                  <div className="rounded-xl border border-white/10 bg-black/35 p-4">
                    <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                      <BookText className="h-4 w-4" /> História
                    </h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/85">
                      {(row.bio ?? '').trim() || 'Sem história registrada para este Legacy.'}
                    </p>
                  </div>

                  {/* Atributos */}
                  <div>
                    <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                      <TrendingUp className="h-4 w-4" /> Atributos Detalhados
                    </h3>
                    <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
                      {ATTR_LABELS.map(([key, label]) => (
                        <StatBar key={key} label={label} value={entity.attrs[key] ?? 0} />
                      ))}
                    </div>
                  </div>

                  {/* Ensina aos companheiros */}
                  {taught.length > 0 && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                      <h3 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300/80">
                        <GraduationCap className="h-4 w-4" /> Ensina aos companheiros
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {taught.map((a) => (
                          <span key={a} className="rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-200">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Booster do time */}
                  {boosterEntries.length > 0 && (
                    <div className="rounded-xl border border-green-500/20 bg-green-500/[0.04] p-4">
                      <h3 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-green-300/80">
                        <Sparkles className="h-4 w-4" /> Booster do time (titular)
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {boosterEntries.map(([k, v]) => (
                          <span key={k} className="rounded-full bg-green-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-green-300">
                            {k} +{v}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Compra */}
                  <div className="relative overflow-hidden rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 to-transparent p-4 sm:p-5">
                    {isOwned ? (
                      <div className="rounded-lg bg-white/5 py-2.5 text-center text-[12px] font-bold uppercase tracking-wider text-gray-400">
                        Você já tem este jogador
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300/70">Adquirir lenda</span>
                          <span className="font-display text-lg font-black tabular-nums text-neon-yellow">
                            {brlCents != null ? fmtBrl(brlCents) : `${priceExp.toLocaleString('pt-BR')} OLE`}
                          </span>
                        </div>
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
                              canAffordOle ? 'bg-amber-400 text-black hover:bg-white' : 'bg-white/5 text-gray-500'
                            }`}
                          >
                            <Coins className="h-4 w-4" />
                            {canAffordOle ? `Comprar · ${priceExp.toLocaleString('pt-BR')} OLE` : 'Sem saldo OLE'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Crown, ShoppingCart, AlertTriangle, Loader2, TrendingUp, BookText, GraduationCap, Sparkles } from 'lucide-react';
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
  // Atributos sempre em amarelo (mesma cor do mercado Genesis — sem faixa por valor).
  const color = 'bg-neon-yellow';
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
  canAfford,
  balanceLabel,
  buying,
  errorMsg,
  pixState = 'none',
  notListed = false,
  onBuy,
  onPixBuy,
}: {
  row: LegacyPlayerRow | null;
  open: boolean;
  onClose: () => void;
  brlCents: number | null;
  isOwned: boolean;
  /** Lenda fora de catálogo (deep-link do Legends Cup): ficha abre, compra não. */
  notListed?: boolean;
  /** true = tem saldo OLEFOOT; false = não tem; null = ainda carregando o saldo. */
  canAfford: boolean | null;
  /** saldo atual do manager, formatado (ex.: "12.500 OLEFOOT") — só pra exibir. */
  balanceLabel?: string | null;
  /** compra em andamento — trava o botão e mostra "Comprando…". */
  buying?: boolean;
  /** erro da última tentativa de compra (exibido inline, sem alert). */
  errorMsg?: string | null;
  /** disponibilidade do PIX: ready = tem R$; loading = cotação carregando; none = card só OLEFOOT. */
  pixState?: 'ready' | 'loading' | 'none';
  onBuy: () => void;
  onPixBuy: () => void;
}) {
  // Confirmação de 2 passos só pra compras de alto valor (evita débito acidental).
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    // Reseta o passo de confirmação ao trocar de jogador / reabrir.
    setConfirming(false);
  }, [row?.id, open]);

  if (!open || !row) return null;
  const entity = legacyRowToPlayerEntity(row);
  const ovr = overallFromAttributes(entity.attrs, entity.pos);
  const portrait = legacyPortraitImageUrl(row);
  const priceExp = Math.max(1, Math.round(row.price_bro_cents));
  // Compra acima deste valor pede um 2º clique de confirmação.
  const HIGH_VALUE_THRESHOLD = 100_000;
  const needsConfirm = priceExp >= HIGH_VALUE_THRESHOLD;
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
                          <p className="italic leading-none tabular-nums text-neon-yellow" style={{ fontFamily: 'var(--font-serif-hero)', fontWeight: 700, fontSize: '16px' }}>
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

                  {/* Compra — o preço vive NO botão (sem repetir em cima).
                      Tem saldo → carrinho de 1 clique. Sem saldo → aviso + PIX. */}
                  <div className="relative overflow-hidden rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 to-transparent p-4 sm:p-5">
                    {isOwned ? (
                      <div className="rounded-lg bg-white/5 py-2.5 text-center text-[12px] font-bold uppercase tracking-wider text-gray-400">
                        Você já tem este jogador
                      </div>
                    ) : notListed ? (
                      /* Fora de catálogo: label honesto, sem CTA de compra. */
                      <div className="space-y-1.5 rounded-lg bg-white/5 py-3 text-center">
                        <p className="text-[12px] font-bold uppercase tracking-wider text-gray-400">
                          Fora de catálogo
                        </p>
                        <p className="text-[11px] text-white/45">
                          Esta lenda não está à venda no momento.
                        </p>
                      </div>
                    ) : canAfford === null ? (
                      <div className="flex items-center justify-center gap-2 rounded-lg bg-white/5 py-3 text-center text-[12px] font-bold uppercase tracking-wider text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin" /> Verificando saldo…
                      </div>
                    ) : canAfford ? (
                      /* Tem saldo: carrinho direto, preço no botão. Alto valor pede 2º clique. */
                      <div className="space-y-2.5">
                        {errorMsg && (
                          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" strokeWidth={2.5} />
                            <p className="text-[11px] text-red-300">{errorMsg}</p>
                          </div>
                        )}
                        {confirming && needsConfirm && !buying ? (
                          <>
                            <p className="text-center text-[12px] text-white/70">
                              Confirmar a compra de <span className="font-bold text-neon-yellow">{priceExp.toLocaleString('pt-BR')} OLEFOOT</span>?
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setConfirming(false)}
                                className="rounded-xl border border-white/15 py-3 text-[12px] font-bold uppercase tracking-wider text-white/70 transition hover:border-white/40 hover:text-white"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={onBuy}
                                className="flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-[12px] font-black uppercase tracking-wider text-black transition hover:bg-white"
                              >
                                <ShoppingCart className="h-4 w-4" strokeWidth={2.5} /> Confirmar
                              </button>
                            </div>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={buying}
                            onClick={() => {
                              if (needsConfirm) setConfirming(true);
                              else onBuy();
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3.5 text-sm font-black uppercase tracking-wide text-black transition hover:bg-white disabled:opacity-60"
                          >
                            {buying ? (
                              <><Loader2 className="h-4 w-4 animate-spin" /> Comprando…</>
                            ) : (
                              <><ShoppingCart className="h-4 w-4" strokeWidth={2.5} /> Comprar · {priceExp.toLocaleString('pt-BR')} OLEFOOT</>
                            )}
                          </button>
                        )}
                      </div>
                    ) : (
                      /* Sem saldo: avisa e oferece recarga via PIX. */
                      <div className="space-y-3">
                        {errorMsg && (
                          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" strokeWidth={2.5} />
                            <p className="text-[11px] text-red-300">{errorMsg}</p>
                          </div>
                        )}
                        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" strokeWidth={2.5} />
                          <div className="min-w-0">
                            <p className="text-[12px] font-black uppercase tracking-wider text-red-300">Saldo insuficiente</p>
                            <p className="text-[11px] text-white/55">
                              {balanceLabel ? `Você tem ${balanceLabel} · ` : ''}custa {priceExp.toLocaleString('pt-BR')} OLEFOOT
                            </p>
                          </div>
                        </div>
                        {pixState === 'ready' && brlCents != null ? (
                          <button
                            type="button"
                            disabled={buying}
                            onClick={onPixBuy}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3.5 text-sm font-black uppercase tracking-wide text-black transition hover:brightness-110 disabled:opacity-60"
                          >
                            <ShoppingCart className="h-4 w-4" strokeWidth={2.5} />
                            Comprar com PIX · {fmtBrl(brlCents)}
                          </button>
                        ) : pixState === 'loading' ? (
                          <p className="flex items-center justify-center gap-2 rounded-lg bg-white/5 py-2.5 text-center text-[11px] text-white/45">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cotação indisponível, tente em instantes…
                          </p>
                        ) : (
                          <p className="rounded-lg bg-white/5 py-2.5 text-center text-[11px] text-white/45">
                            Recarregue OLEFOOT na carteira para adquirir esta lenda.
                          </p>
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

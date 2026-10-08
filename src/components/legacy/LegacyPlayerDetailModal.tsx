import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import {
  legacyPortraitImageUrl,
  legacyPortraitFocusStyle,
  legacyRowToPlayerEntity,
  type LegacyPlayerRow,
} from '@/supabase/legacyPlayers';
import { overallFromAttributes } from '@/entities/player';
import type { PlayerAttributes } from '@/entities/types';
import { moedaDoJogo } from '@/wallet/constants';
import { L, LOCALE } from '@/i18n/L';
import { posLabel } from '@/components/matchquick/posLabel';
import { cn } from '@/lib/utils';
import { DEGRAU_CLASSES, MarcaRua, SeloRua } from '@/components/ui/Rua';
import {
  ACAO_CONTORNO,
  ACAO_OURO,
  ACAO_RUA,
  AtributoRua,
  DEGRAU_INFO,
  FECHAR_RUA,
  degrauDe,
  faixaClasses,
  fotoFundo,
  ovrClasses,
} from '@/components/market/rua/escada';

const ATTR_LABELS: Array<[keyof PlayerAttributes, string]> = [
  ['velocidade', L('Velocidade', 'Pace')],
  ['finalizacao', L('Finalização', 'Finishing')],
  ['drible', L('Drible', 'Dribbling')],
  ['passe', L('Passe', 'Passing')],
  ['marcacao', L('Marcação', 'Marking')],
  ['fisico', L('Físico', 'Physical')],
  ['tatico', L('Tático', 'Tactical')],
  ['mentalidade', L('Mentalidade', 'Mentality')],
  ['confianca', L('Confiança', 'Confidence')],
  ['fairPlay', 'Fair Play'],
];

/** Atributos especialistas — mostrados num bloco à parte (bola parada / cabeça / pênalti). */
const SPECIALIST_LABELS: Array<[keyof PlayerAttributes, string]> = [
  ['cabeceio', L('Cabeceio', 'Heading')],
  ['bolaParada', L('Bola parada', 'Set pieces')],
  ['penalti', L('Pênalti', 'Penalty')],
];

function fmtBrl(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

/** Barra de atributo — 10 segmentos de rua (mesma régua do mercado Genesis). */
function StatBar({ label, value }: { label: string; value: number }) {
  return <AtributoRua label={label} value={value} largo />;
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
  /** true = tem saldo OLEXP; false = não tem; null = ainda carregando o saldo. */
  canAfford: boolean | null;
  /** saldo atual do manager, formatado (ex.: "12.500 OLEXP") — só pra exibir. */
  balanceLabel?: string | null;
  /** compra em andamento — trava o botão e mostra "Comprando…". */
  buying?: boolean;
  /** erro da última tentativa de compra (exibido inline, sem alert). */
  errorMsg?: string | null;
  /** disponibilidade do PIX: ready = tem R$; loading = cotação carregando; none = card só OLEXP. */
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

  const d = degrauDe(ovr);
  const info = DEGRAU_INFO[d];
  const destaque = d === 'respeito' ? 'text-ouro-27' : '';
  // Compra de lenda é ouro; carta de base (corre/chão) compra no amarelo.
  const acaoCompra = d === 'respeito' || d === 'lenda' ? ACAO_OURO : ACAO_RUA;
  const rotulo = 'font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo';
  const aviso = (msg: string) => (
    <div className="flex items-start gap-2 border-l-[3px] border-baixa bg-concreto px-3 py-2">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-baixa" strokeWidth={2.5} aria-hidden />
      <p className="text-[12px] text-baixa">{msg}</p>
    </div>
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[80] flex min-h-0 flex-col overflow-y-auto overscroll-y-contain bg-asfalto-27/95 px-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-[max(1.25rem,calc(env(safe-area-inset-bottom,0px)+5.5rem))] sm:items-center sm:justify-center sm:px-4 sm:pb-6 sm:pt-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 20 }}
          className="my-2 flex w-full min-h-0 max-w-[min(100%,60rem)] flex-col overflow-hidden border-[3px] border-ouro-27 bg-asfalto-27 sm:my-4 max-h-[min(920px,calc(100dvh-7.5rem))] sm:max-h-[min(920px,calc(100dvh-4.5rem))]"
        >
          {/* Topbar */}
          <div className="z-[60] flex shrink-0 items-center justify-between gap-3 border-b-2 border-linha px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <SeloRua tom="ouro">{L('Lenda', 'Legend')}</SeloRua>
              {row.collection_title && (
                <span className="min-w-0 truncate font-prova text-[10.5px] uppercase tracking-[0.12em] text-mudo">
                  {row.collection_title}
                </span>
              )}
            </div>
            <button type="button" onClick={onClose} aria-label={L('Fechar', 'Close')} className={FECHAR_RUA}>
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Corpo com scroll */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
            <div className="flex flex-col md:flex-row">
              {/* ESQUERDA — a carta colada no muro */}
              <div className="rua-grao flex w-full shrink-0 items-start justify-center border-b-2 border-linha bg-concreto px-6 py-8 md:w-2/5 md:border-b-0 md:border-r-2">
                <div className="w-full max-w-[280px] -rotate-[1.5deg]">
                  <div className={cn('flex flex-col gap-2.5 p-3 shadow-[8px_10px_0_rgba(0,0,0,0.6)]', DEGRAU_CLASSES[d])}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span className={cn('font-impact text-[64px] leading-[0.85] tabular-nums', ovrClasses(d))}>{ovr}</span>
                        <span className={cn('mt-1 font-impact text-[15px] uppercase leading-none', destaque)}>{posLabel(entity.pos)}</span>
                      </div>
                      <MarcaRua tipo="escudo" className={cn('h-8', d === 'respeito' ? 'bg-ouro-27' : 'bg-asfalto-27')} />
                    </div>
                    <div className={cn('relative aspect-[11/14] w-full overflow-hidden', fotoFundo(d))}>
                      {portrait ? (
                        <img src={portrait} alt={entity.name} style={legacyPortraitFocusStyle(row)} className="absolute inset-0 h-full w-full" />
                      ) : (
                        <MarcaRua tipo="escudo" className="absolute left-1/2 top-1/2 h-16 -translate-x-1/2 -translate-y-1/2 bg-current opacity-30" />
                      )}
                    </div>
                    <div className="flex justify-between gap-1">
                      {cardStats.map(([label, val]) => (
                        <div key={label} className="flex flex-col items-start">
                          <span className="font-prova text-[9.5px] font-bold uppercase tracking-[0.14em] opacity-70">{label}</span>
                          <span className={cn('font-impact text-[20px] leading-none tabular-nums', destaque)}>{val}</span>
                        </div>
                      ))}
                    </div>
                    <div className={faixaClasses(d)}>
                      <span className="truncate">
                        {info.n} · {info.nome}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* DIREITA — ficha */}
              <div className="min-w-0 flex-1 p-4 sm:p-6">
                <div className="flex flex-col gap-7">
                  {/* Cabeçalho */}
                  <div className="flex flex-col gap-2 border-b-2 border-linha pb-5">
                    <h2 className="break-words font-voz leading-[0.9] text-papel [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(40px, 10vw, 64px)' }}>
                      {entity.name}
                    </h2>
                    <p className="flex flex-wrap items-baseline gap-x-3 font-impact uppercase leading-none">
                      <span className="text-[22px] text-suave">{posLabel(entity.pos)}</span>
                      <span className="text-[22px] text-ouro-27">OVR {ovr}</span>
                    </p>
                    <p className="font-prova text-[10.5px] uppercase tracking-[0.12em] text-mudo">
                      {row.collection_title ? `${row.collection_title} · ` : ''}
                      {row.country ?? '—'}{row.age ? L(` · ${row.age} anos`, ` · ${row.age} yrs`) : ''}
                    </p>
                  </div>

                  {/* História — lambe de cal colado torto no muro. */}
                  <div className="flex flex-col gap-2">
                    <h3 className={rotulo}>— {L('História', 'Story')}</h3>
                    <div className="-rotate-[0.8deg] bg-cal px-4 py-4 text-asfalto-27 shadow-[5px_5px_0_rgba(0,0,0,0.55)]">
                      <p className="whitespace-pre-wrap text-[14px] leading-relaxed">
                        {(row.bio ?? '').trim() || L('Sem história registrada pra este Legacy.', 'No story recorded for this Legacy.')}
                      </p>
                    </div>
                  </div>

                  {/* Atributos */}
                  <div className="flex flex-col gap-3">
                    <h3 className={rotulo}>— {L('Atributos', 'Attributes')}</h3>
                    <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
                      {ATTR_LABELS.map(([key, label]) => (
                        <StatBar key={key} label={label} value={entity.attrs[key] ?? 0} />
                      ))}
                    </div>

                    {/* Especialistas — bola parada, cabeça, pênalti. Bloco à parte
                        porque não entram no OVR: decidem quem marca cada lance. */}
                    <h4 className={cn(rotulo, 'mt-4')}>— {L('Especialista', 'Specialist')}</h4>
                    <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
                      {SPECIALIST_LABELS.map(([key, label]) => (
                        <StatBar key={key} label={label} value={entity.attrs[key] ?? 0} />
                      ))}
                    </div>
                  </div>

                  {/* Ensina aos companheiros */}
                  {taught.length > 0 && (
                    <div className="flex flex-col gap-2.5">
                      <h3 className={rotulo}>— {L('Ensina aos companheiros', 'Teaches teammates')}</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {taught.map((a) => (
                          <span key={a} className="border-2 border-papel px-2.5 py-1 font-impact text-[15px] uppercase leading-none text-papel">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Booster do time */}
                  {boosterEntries.length > 0 && (
                    <div className="flex flex-col gap-2.5">
                      <h3 className={rotulo}>— {L('Booster do time (titular)', 'Team booster (starter)')}</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {boosterEntries.map(([k, v]) => (
                          <span key={k} className="inline-flex items-baseline gap-1.5 border-2 border-linha px-2.5 py-1 font-prova text-[11px] font-bold uppercase tracking-[0.08em] text-suave">
                            {k} <span className="font-impact text-[15px] tracking-normal text-alta">+{v}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Compra — o preço vive NO botão (sem repetir em cima).
                      Tem saldo → 1 clique. Sem saldo → aviso + PIX. */}
                  <div className="rua-grao border-2 border-linha bg-concreto p-4 sm:p-5">
                    {isOwned ? (
                      <div className="border-2 border-dashed border-fio py-3 text-center font-impact text-[17px] uppercase leading-none text-suave">
                        ✓ {L('Já tá no seu time', 'Already in your squad')}
                      </div>
                    ) : notListed ? (
                      /* Fora de catálogo: label honesto, sem CTA de compra. */
                      <div className="space-y-1.5 border-2 border-dashed border-fio px-3 py-4 text-center">
                        <p className="font-impact text-[18px] uppercase leading-none text-suave">
                          {L('Fora de catálogo', 'Not in catalogue')}
                        </p>
                        <p className="font-prova text-[11px] uppercase tracking-[0.1em] text-mudo">
                          {L('Esta lenda não está à venda agora.', 'This legend is not for sale right now.')}
                        </p>
                      </div>
                    ) : canAfford === null ? (
                      <div className="flex items-center justify-center gap-2 py-3 text-center font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {L('Conferindo saldo…', 'Checking balance…')}
                      </div>
                    ) : canAfford ? (
                      /* Tem saldo: compra direta, preço no botão. Alto valor pede 2º clique. */
                      <div className="space-y-3">
                        {errorMsg && aviso(errorMsg)}
                        {confirming && needsConfirm && !buying ? (
                          <>
                            <p className="text-center text-[14px] text-suave">
                              {L('Fechar a compra por', 'Close the deal for')}{' '}
                              <span className="font-spray text-[22px] font-black text-ouro-27">
                                {priceExp.toLocaleString(LOCALE)} {moedaDoJogo()}
                              </span>
                              ?
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              <button type="button" onClick={() => setConfirming(false)} className={ACAO_CONTORNO}>
                                {L('Cancelar', 'Cancel')}
                              </button>
                              <button type="button" onClick={onBuy} className={acaoCompra}>
                                {L('Confirmar', 'Confirm')} <span aria-hidden>→</span>
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
                            className={acaoCompra}
                          >
                            {buying ? (
                              <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {L('Comprando…', 'Buying…')}</>
                            ) : (
                              <>{L('Comprar', 'Buy')} · {priceExp.toLocaleString(LOCALE)} {moedaDoJogo()} <span aria-hidden>→</span></>
                            )}
                          </button>
                        )}
                      </div>
                    ) : (
                      /* Sem saldo: avisa e oferece PIX. */
                      <div className="space-y-3">
                        {errorMsg && aviso(errorMsg)}
                        <div className="flex flex-col gap-1 border-l-[3px] border-baixa pl-3">
                          <p className="font-impact text-[17px] uppercase leading-none text-baixa">{L('Saldo não fecha', 'Balance falls short')}</p>
                          <p className="font-prova text-[11px] uppercase tracking-[0.08em] text-mudo">
                            {balanceLabel ? L(`Você tem ${balanceLabel} · `, `You have ${balanceLabel} · `) : ''}{L('custa', 'costs')} {priceExp.toLocaleString(LOCALE)} {moedaDoJogo()}
                          </p>
                        </div>
                        {pixState === 'ready' && brlCents != null ? (
                          <button type="button" disabled={buying} onClick={onPixBuy} className={ACAO_RUA}>
                            {L('Comprar com PIX', 'Buy with PIX')} · {fmtBrl(brlCents)} <span aria-hidden>→</span>
                          </button>
                        ) : pixState === 'loading' ? (
                          <p className="flex items-center justify-center gap-2 border-2 border-dashed border-fio py-2.5 text-center font-prova text-[11px] uppercase tracking-[0.08em] text-mudo">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> {L('Cotação indisponível, tente em instantes…', 'Quote unavailable, try again shortly…')}
                          </p>
                        ) : (
                          <p className="border-2 border-dashed border-fio px-3 py-2.5 text-center font-prova text-[11px] uppercase tracking-[0.08em] text-mudo">
                            {L(`Recarregue ${moedaDoJogo()} na carteira pra levar esta lenda.`, `Top up ${moedaDoJogo()} in your wallet to get this legend.`)}
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

import { useMemo, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, TrendingDown, TrendingUp, Minus, Activity, Zap, Megaphone, Sparkles, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { playerPortraitSrc } from '@/lib/playerPortrait';
import { useGameDispatch, useGameStore } from '@/game/store';
import { shopEffectNeedsPlayer, shopEffectScope, shopItemIcon } from '@/game/shopCatalog';
import { overallFromAttributes, playerToCardView } from '@/entities/player';
import { formatBroFromCents, formatExp } from '@/systems/economy';
import {
  estimateMarketBroCentsFromOvr,
  marketTrendVsBaseline,
  PLAYER_SEASON_ATTR_KEYS,
  PLAYER_SEASON_ATTR_LABELS,
  trainingTypeLabel,
} from '@/team/playerSeasonLedger';
import { VeracityPillarsStrip } from '@/components/VeracityPillarsStrip';
import { LegacyMentorSection } from '@/legacy/LegacyMentorSection';
import { PlayerHealthContractSection } from '@/components/player/PlayerHealthContractSection';

function TrendGlyph({ label }: { label: 'up' | 'down' | 'flat' | 'unknown' }) {
  if (label === 'up') return <TrendingUp className="h-4 w-4 text-emerald-400" aria-hidden />;
  if (label === 'down') return <TrendingDown className="h-4 w-4 text-rose-400" aria-hidden />;
  if (label === 'flat') return <Minus className="h-4 w-4 text-gray-500" aria-hidden />;
  return <span className="text-[10px] font-bold uppercase text-gray-500">—</span>;
}

export function TeamPlayerSeasonSheet({
  playerId,
  onClose,
  onAnnounceSale,
}: {
  playerId: string | null;
  onClose: () => void;
  onAnnounceSale?: (playerId: string) => void;
}) {
  const dispatch = useGameDispatch();
  const panelRef = useRef<HTMLDivElement>(null);
  const players = useGameStore((s) => s.players);
  const ledgerMap = useGameStore((s) => s.playerSeasonLedger);
  const shopCatalog = useGameStore((s) => s.shopCatalog);
  const shopInventory = useGameStore((s) => s.shopInventory);

  const player = playerId ? players[playerId] : undefined;
  const ledger = playerId ? ledgerMap[playerId] : undefined;

  const maxOvr = useMemo(() => {
    const vals = Object.values(players);
    if (!vals.length) return 88;
    return Math.max(...vals.map((p) => overallFromAttributes(p.attrs)));
  }, [players]);

  const card = useMemo(
    () => (player ? playerToCardView(player, maxOvr) : null),
    [player, maxOvr],
  );

  const boosterRows = useMemo(() => {
    const rows: { item: (typeof shopCatalog)[number]; qty: number }[] = [];
    for (const item of shopCatalog) {
      if (!item.consumable || !item.effect) continue;
      const qty = shopInventory[item.id] ?? 0;
      if (qty < 1) continue;
      rows.push({ item, qty });
    }
    return rows;
  }, [shopCatalog, shopInventory]);

  const ovrNow = player ? overallFromAttributes(player.attrs) : 0;
  const mintOvr = player?.mintOverall ?? ovrNow;
  const ovrDelta = ovrNow - mintOvr;

  const usesExpMarket =
    player?.marketValueExp != null && Number.isFinite(player.marketValueExp) && player.marketValueExp > 0;
  const marketCurrent = usesExpMarket
    ? Math.max(0, Math.round(player.marketValueExp!))
    : player?.marketValueBroCents != null && Number.isFinite(player.marketValueBroCents)
      ? Math.max(0, Math.round(player.marketValueBroCents))
      : estimateMarketBroCentsFromOvr(ovrNow);

  const trendSeason = marketTrendVsBaseline(marketCurrent, ledger?.seasonBaselineMarketBroCents);
  const trendSinceLastMatch = marketTrendVsBaseline(marketCurrent, ledger?.lastMarketBroCentsAfterMatch);

  useEffect(() => {
    if (!playerId) return;
    const el = panelRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    el?.focus();
  }, [playerId]);

  if (!playerId || !player || !card) return null;

  const km = ledger?.kmTotal ?? 0;
  const passPct =
    ledger && ledger.passesAttempt > 0
      ? Math.round((ledger.passesOk / ledger.passesAttempt) * 1000) / 10
      : null;

  /** Insight auto-gerado — 1 status principal + highlight + recomendação. */
  const insight = useMemo(() => {
    const mp = ledger?.matchesPlayed ?? 0;
    const goals = ledger?.goals ?? 0;
    const reds = ledger?.redCards ?? 0;
    const yellows = ledger?.yellowCards ?? 0;
    const tacklesAvg = mp > 0 ? (ledger?.tackles ?? 0) / mp : 0;
    const goalsAvg = mp > 0 ? goals / mp : 0;
    const pos = (player.pos ?? '').toUpperCase();
    const isAttacker = /ATA|SA|PL|CF|ST/.test(pos);
    const isMid = /MC|MEI|MED|CM|AM/.test(pos);
    const isDef = /ZAG|CB|LD|LE|LB|DF/.test(pos);

    // Status momento
    let momentum: { label: string; tone: 'good' | 'bad' | 'neutral' } = { label: 'Acompanhamento neutro', tone: 'neutral' };
    if (trendSinceLastMatch.pct != null && trendSinceLastMatch.pct > 4) {
      momentum = { label: 'Em alta desde o último jogo', tone: 'good' };
    } else if (trendSinceLastMatch.pct != null && trendSinceLastMatch.pct < -4) {
      momentum = { label: 'Em baixa desde o último jogo', tone: 'bad' };
    } else if (trendSeason.pct != null && trendSeason.pct > 8) {
      momentum = { label: 'Valorizando na temporada', tone: 'good' };
    } else if (trendSeason.pct != null && trendSeason.pct < -8) {
      momentum = { label: 'Desvalorizando na temporada', tone: 'bad' };
    }

    // Highlight estatístico
    let highlight: string | null = null;
    if (mp >= 3) {
      if (goalsAvg >= 0.5 && (isAttacker || isMid)) {
        highlight = `Goleador — ${goalsAvg.toFixed(2)} gols/jogo`;
      } else if (passPct != null && passPct >= 85 && (isMid || isDef)) {
        highlight = `Precisão alta — ${passPct}% de passes certos`;
      } else if (tacklesAvg >= 3 && isDef) {
        highlight = `Marcador forte — ${tacklesAvg.toFixed(1)} desarmes/jogo`;
      } else if (ovrDelta >= 2) {
        highlight = `Evoluiu +${ovrDelta} OVR no clube`;
      } else if (ovrDelta <= -2) {
        highlight = `Regrediu ${ovrDelta} OVR desde o mint`;
      }
    } else if (mp === 0) {
      highlight = 'Ainda sem jogos contabilizados';
    }

    // Recomendação de venda
    let recommendation: { text: string; action: 'sell' | 'hold' | 'watch' } = {
      text: 'Continua monitorando — sem sinal forte.',
      action: 'watch',
    };
    if (trendSeason.pct != null && trendSeason.pct > 15) {
      recommendation = { text: 'Janela boa pra venda: valor subiu >15% na temporada.', action: 'sell' };
    } else if (reds >= 2) {
      recommendation = { text: 'Atenção disciplinar — 2+ expulsões nesta temporada.', action: 'watch' };
    } else if (mp >= 5 && goalsAvg < 0.1 && isAttacker) {
      recommendation = { text: 'Produção baixa pra atacante — reavaliar posição ou venda.', action: 'watch' };
    } else if (goalsAvg >= 0.5 || (passPct != null && passPct >= 88)) {
      recommendation = { text: 'Peça-chave. Segura enquanto o rendimento se mantiver.', action: 'hold' };
    } else if (yellows >= 5) {
      recommendation = { text: 'Cartões acumulando — risco de suspensão futura.', action: 'watch' };
    }

    return { momentum, highlight, recommendation };
  }, [ledger, player.pos, trendSeason.pct, trendSinceLastMatch.pct, ovrDelta, passPct]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto overscroll-y-contain bg-black/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        ref={panelRef}
        initial={{ scale: 0.96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 12 }}
        onClick={(e) => e.stopPropagation()}
        className="my-auto flex w-full max-w-2xl flex-col border border-white/10 bg-dark-gray shadow-2xl"
        style={{
          borderRadius: 'var(--radius-md)',
          maxHeight: 'min(92vh, calc(100vh - 2rem))',
          overflow: 'hidden',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-player-sheet-title"
      >
        {/* Hero Header — foto hero slider + info sobreposta */}
        <div className="relative w-full border-b border-white/10 bg-black overflow-hidden shrink-0">
          {/* Foto do jogador — hero slider generoso */}
          <div className="relative w-full overflow-hidden bg-black" style={{ height: 'clamp(280px, 45vh, 500px)' }}>
            {/* Background tonal */}
            <div
              className={cn(
                'absolute inset-0',
                card.style === 'neon-yellow' ? 'bg-neon-yellow/10' : 'bg-white/5',
              )}
              aria-hidden
            />
            {/* Foto — object-contain garante que a foto inteira apareça sem cortes */}
            <img
              src={playerPortraitSrc({ name: player.name, portraitUrl: player.portraitUrl }, 800, 1200)}
              alt=""
              className="absolute inset-0 h-full w-full object-contain object-center grayscale"
              referrerPolicy="no-referrer"
            />
            {/* Gradient overlay para leitura — mais forte nas bordas */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90"
            />

            {/* OVR — Moret italic editorial (canto superior esquerdo) */}
            <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10">
              <p
                className="italic text-neon-yellow tabular-nums leading-none drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontWeight: 700,
                  fontSize: 'clamp(72px, 15vw, 120px)',
                  letterSpacing: '-0.04em',
                }}
              >
                {ovrNow}
              </p>
              <p
                className="mt-1 text-white/60 uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                }}
              >
                Overall
              </p>
            </div>

            {/* Botão fechar (canto superior direito) */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 shrink-0 rounded-full border border-white/20 bg-black/70 p-2 text-white/80 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Info do jogador — sobreposta no rodapé da foto */}
            <div className="absolute bottom-0 left-0 right-0 z-10 p-4 sm:p-6 bg-gradient-to-t from-black via-black/95 to-transparent">
              {/* Nome + posição */}
              <div className="pr-12">
                <p
                  id="team-player-sheet-title"
                  className="text-white uppercase leading-none drop-shadow-[0_3px_12px_rgba(0,0,0,0.9)]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 'clamp(24px, 5vw, 38px)',
                    letterSpacing: '0.03em',
                    lineHeight: 1.05,
                  }}
                >
                  {player.name}
                </p>
                <p
                  className="text-white/60 uppercase mt-2"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '9px',
                    letterSpacing: '0.22em',
                    fontWeight: 600,
                  }}
                >
                  {player.country ? (
                    <span className="mr-2 not-italic text-sm" title={player.country ?? undefined} aria-hidden>
                      {player.country}
                    </span>
                  ) : null}
                  {player.pos} · Temporada (agregado)
                </p>
              </div>

              {/* OVR mint + delta — destaque editorial */}
              <div className="mt-4 flex items-baseline gap-3">
                <div>
                  <p
                    className="text-white/50 uppercase"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '9px',
                      fontWeight: 700,
                      letterSpacing: '0.22em',
                    }}
                  >
                    Overall mint
                  </p>
                  <p
                    className="italic text-white tabular-nums leading-none mt-1"
                    style={{
                      fontFamily: 'var(--font-serif-hero)',
                      fontWeight: 700,
                      fontSize: 'clamp(28px, 4vw, 40px)',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {mintOvr}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-white/40"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '14px',
                      fontWeight: 700,
                    }}
                  >
                    →
                  </span>
                  <p
                    className={cn(
                      'tabular-nums',
                      ovrDelta > 0 ? 'text-emerald-400' : ovrDelta < 0 ? 'text-rose-400' : 'text-gray-500'
                    )}
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(20px, 3.5vw, 28px)',
                      fontWeight: 800,
                    }}
                  >
                    {ovrDelta >= 0 ? '+' : ''}{ovrDelta}
                  </p>
                </div>
              </div>
              <p
                className="mt-2 text-white/40 italic"
                style={{
                  fontFamily: 'var(--font-serif-hero)',
                  fontSize: '11px',
                }}
              >
                {ovrDelta > 0 ? 'Evoluiu no clube' : ovrDelta < 0 ? 'Regrediu desde o mint' : 'Mantém o nível inicial'}
              </p>
            </div>
          </div>
        </div>

        <div className="border-b border-white/10 bg-black/30 px-4 py-1.5">
          <VeracityPillarsStrip />
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 scrollbar-hide scroll-smooth-snap">
          {/* ── Insight inteligente ───────────────────────────────── */}
          <section
            className={cn(
              'border p-4 scroll-snap-section',
              insight.momentum.tone === 'good' && 'border-emerald-400/30 bg-emerald-950/20',
              insight.momentum.tone === 'bad' && 'border-rose-400/30 bg-rose-950/20',
              insight.momentum.tone === 'neutral' && 'border-white/10 bg-white/[0.02]',
            )}
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="shrink-0 w-[3px] h-5 bg-neon-yellow" />
              <h3
                className="text-neon-yellow uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                }}
              >
                Leitura rápida
              </h3>
            </div>
            <p
              className={cn(
                'mt-3',
                insight.momentum.tone === 'good' && 'text-emerald-300',
                insight.momentum.tone === 'bad' && 'text-rose-300',
                insight.momentum.tone === 'neutral' && 'text-white',
              )}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '15px',
                fontWeight: 700,
              }}
            >
              {insight.momentum.label}
            </p>
            {insight.highlight ? (
              <p className="mt-2 flex items-center gap-2 text-white/85"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '12px',
                }}
              >
                <Flame className="h-3.5 w-3.5 shrink-0 text-neon-yellow/80" aria-hidden />
                {insight.highlight}
              </p>
            ) : null}
            <div
              className={cn(
                'mt-3 border px-3 py-2',
                insight.recommendation.action === 'sell' && 'border-neon-yellow/35 bg-neon-yellow/5 text-neon-yellow',
                insight.recommendation.action === 'hold' && 'border-cyan-500/25 bg-cyan-950/20 text-cyan-200',
                insight.recommendation.action === 'watch' && 'border-white/10 bg-black/30 text-gray-300',
              )}
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <span
                className="mr-1.5 uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                }}
              >
                {insight.recommendation.action === 'sell' && '💰 Oportunidade'}
                {insight.recommendation.action === 'hold' && '🔒 Segurar'}
                {insight.recommendation.action === 'watch' && '👁 Observar'}
              </span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px' }}>
                {insight.recommendation.text}
              </span>
            </div>
          </section>

          {player ? <PlayerHealthContractSection player={player} /> : null}
          {player ? <LegacyMentorSection student={player} /> : null}
          {boosterRows.length ? (
            <section className="border border-fuchsia-500/35 bg-fuchsia-950/20 p-4 scroll-snap-section"
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              <div className="flex items-center gap-2.5">
                <span aria-hidden className="shrink-0 w-[3px] h-5 bg-fuchsia-400" />
                <h3
                  className="text-fuchsia-200/90 uppercase"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                  }}
                >
                  Boosters (inventário)
                </h3>
              </div>
              <p className="mt-2 text-gray-500"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '10px',
                  lineHeight: 1.5,
                }}
              >
                Itens comprados na loja. Os que valem para um só jogador usam sempre esta ficha. Os de plantel ou clube
                aplicam ao save completo.
              </p>
              <ul className="mt-3 space-y-2">
                {boosterRows.map(({ item, qty }) => {
                  const Icon = shopItemIcon(item.iconKey);
                  const needP = shopEffectNeedsPlayer(item.effect);
                  const scope = shopEffectScope(item.effect);
                  const canUseHere = !needP || Boolean(playerId);
                  return (
                    <li
                      key={item.id}
                      className="flex flex-col gap-2 border border-white/10 bg-black/35 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      style={{ borderRadius: 'var(--radius-sm)' }}
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300/80" aria-hidden />
                        <div className="min-w-0">
                          <p className="text-white"
                            style={{
                              fontFamily: 'var(--font-display)',
                              fontSize: '12px',
                              fontWeight: 700,
                            }}
                          >
                            {item.title}
                          </p>
                          <p className="text-gray-500"
                            style={{
                              fontFamily: 'var(--font-ui)',
                              fontSize: '10px',
                            }}
                          >
                            {qty}× · escopo: {scope}
                            {needP ? ' · este jogador' : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!canUseHere}
                        onClick={() => {
                          if (!canUseHere) return;
                          dispatch({
                            type: 'CONSUME_SHOP_ITEM',
                            itemId: item.id,
                            playerId: needP ? playerId ?? undefined : undefined,
                          });
                        }}
                        className="shrink-0 border border-fuchsia-500/40 bg-fuchsia-500/15 px-3 py-2 text-fuchsia-100 transition hover:bg-fuchsia-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '10px',
                          fontWeight: 700,
                          letterSpacing: '0.2em',
                          textTransform: 'uppercase',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        Usar
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {/* Mercado */}
          <section className="border border-cyan-500/20 bg-cyan-950/25 p-4 scroll-snap-section"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="shrink-0 w-[3px] h-5 bg-cyan-400" />
              <h3
                className="text-cyan-200/90 uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                }}
              >
                Valor de mercado (referência)
              </h3>
            </div>
            <p className="mt-3 text-white tabular-nums"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '24px',
                fontWeight: 700,
              }}
            >
              {usesExpMarket ? `${formatExp(marketCurrent)} EXP` : `${formatBroFromCents(marketCurrent)} BRO`}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="border border-white/10 bg-black/30 px-3 py-2"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <p className="text-gray-500 uppercase"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                  }}
                >
                  Vs. início de registo
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <TrendGlyph label={trendSeason.label} />
                  <span className="text-white"
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    {ledger?.seasonBaselineMarketBroCents != null
                      ? `${usesExpMarket ? formatExp(ledger.seasonBaselineMarketBroCents) : formatBroFromCents(ledger.seasonBaselineMarketBroCents)}${usesExpMarket ? ' EXP' : ' BRO'} → ${trendSeason.pct != null ? `${trendSeason.pct >= 0 ? '+' : ''}${trendSeason.pct.toFixed(1)}%` : '—'}`
                      : 'Ainda sem linha base (1.º jogo ou treino contado)'}
                  </span>
                </div>
              </div>
              <div className="border border-white/10 bg-black/30 px-3 py-2"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <p className="text-gray-500 uppercase"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                  }}
                >
                  Desde o último jogo
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <TrendGlyph label={trendSinceLastMatch.label} />
                  <span className="text-white"
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    {ledger?.lastMarketBroCentsAfterMatch != null
                      ? `${trendSinceLastMatch.pct != null ? `${trendSinceLastMatch.pct >= 0 ? '+' : ''}${trendSinceLastMatch.pct.toFixed(1)}%` : '—'} vs. pós-jogo (${usesExpMarket ? `${formatExp(ledger.lastMarketBroCentsAfterMatch)} EXP` : `${formatBroFromCents(ledger.lastMarketBroCentsAfterMatch)} BRO`})`
                      : 'Sem jogo finalizado ainda'}
                  </span>
                </div>
              </div>
            </div>
            <p className="mt-3 text-gray-500"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '10px',
                lineHeight: 1.5,
              }}
            >
              {usesExpMarket
                ? 'Valor de mercado em EXP (catálogo Genesis). A linha base grava-se no primeiro jogo ou treino contabilizado; «desde o último jogo» mede evolução após o apito final.'
                : 'Sem BRO no cartão, o valor mostrado estima a partir do OVR. A linha base da temporada grava-se no primeiro jogo ou treino contabilizado; «desde o último jogo» mede treinos e evolução após o apito final.'}
            </p>
          </section>

          {/* Jogos */}
          <section className="border border-white/10 bg-black/25 p-4 scroll-snap-section"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="shrink-0 w-[3px] h-5 bg-neon-yellow" />
              <h3
                className="text-neon-yellow uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                }}
              >
                Competição &amp; jogo
              </h3>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <div>
                <dt className="text-gray-500 uppercase"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                  }}
                >
                  Jogos
                </dt>
                <dd className="text-white tabular-nums mt-1"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                >
                  {ledger?.matchesPlayed ?? 0}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 uppercase"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                  }}
                >
                  Golos
                </dt>
                <dd className="text-white tabular-nums mt-1"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                >
                  {ledger?.goals ?? 0}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 uppercase"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                  }}
                >
                  Amarelos / Vermelhos
                </dt>
                <dd className="text-white tabular-nums mt-1"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                >
                  {ledger?.yellowCards ?? 0} / {ledger?.redCards ?? 0}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 uppercase"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                  }}
                >
                  Passes OK / tent.
                </dt>
                <dd className="text-white tabular-nums mt-1"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                >
                  {ledger?.passesOk ?? 0} / {ledger?.passesAttempt ?? 0}
                  {passPct != null ? <span className="text-gray-400"> ({passPct}%)</span> : null}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 uppercase"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                  }}
                >
                  Desarmes
                </dt>
                <dd className="text-white tabular-nums mt-1"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                >
                  {ledger?.tackles ?? 0}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 uppercase"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                  }}
                >
                  Km (motor)
                </dt>
                <dd className="text-white tabular-nums mt-1"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                >
                  {km.toFixed(1)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 uppercase"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                  }}
                >
                  Remates (agreg.)
                </dt>
                <dd className="text-white tabular-nums mt-1"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                >
                  {ledger?.shots ?? 0}
                </dd>
              </div>
            </dl>
          </section>

          {/* Treinos */}
          <section className="border border-white/10 bg-black/25 p-4 scroll-snap-section"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="shrink-0 w-[3px] h-5 bg-white/70" />
              <h3
                className="text-white/90 uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                }}
              >
                Treinos
              </h3>
            </div>
            <p className="mt-2 text-gray-500"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '11px',
              }}
            >
              Planos concluídos: <span className="font-mono font-bold text-white">{ledger?.trainingPlansCompleted ?? 0}</span>
              {' · '}
              Sessões leves: <span className="font-mono font-bold text-white">{ledger?.trainingLightSessions ?? 0}</span>
            </p>
            {ledger && Object.keys(ledger.trainingByType).length > 0 ? (
              <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto">
                {Object.entries(ledger.trainingByType).map(([k, n]) => (
                  <li key={k} className="flex justify-between gap-2 border-b border-white/5 py-1.5">
                    <span className="text-gray-400"
                      style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '11px',
                      }}
                    >
                      {trainingTypeLabel(k)}
                    </span>
                    <span className="text-white tabular-nums"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      {n}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-gray-500"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '11px',
                }}
              >
                Sem treinos contabilizados nesta temporada.
              </p>
            )}
          </section>

          {/* Atributos actuais */}
          <section className="border border-white/10 bg-black/25 p-4 scroll-snap-section"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="shrink-0 w-[3px] h-5 bg-white/70" />
              <h3
                className="text-white/90 uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                }}
              >
                Atributos actuais
              </h3>
            </div>
            <p className="mt-2 text-gray-500"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '10px',
              }}
            >
              O modelo completo do cartão. A evolução global resume-se ao OVR mint ({mintOvr}) vs. actual ({ovrNow}).
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {PLAYER_SEASON_ATTR_KEYS.map((key) => (
                <li
                  key={key}
                  className="flex items-center justify-between border border-white/5 bg-black/30 px-3 py-2"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                >
                  <span className="text-gray-400"
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '11px',
                    }}
                  >
                    {PLAYER_SEASON_ATTR_LABELS[key]}
                  </span>
                  <span className="text-white tabular-nums"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    {player.attrs[key]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── Footer CTA ───────────────────────────────────────────── */}
        {onAnnounceSale ? (
          <div className="shrink-0 border-t border-white/10 bg-black/55 px-4 py-4">
            <button
              type="button"
              onClick={() => onAnnounceSale(player.id)}
              className="group flex w-full items-center justify-center gap-2 bg-neon-yellow px-4 py-3 text-black transition-colors hover:bg-white"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <Megaphone className="h-4 w-4 shrink-0" aria-hidden />
              Anunciar Venda
              <span className="ml-1.5 border border-black/20 bg-black/15 px-2 py-1 font-mono text-[10px] font-bold tracking-wider text-black/80 group-hover:bg-black/20"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                {usesExpMarket ? `${formatExp(marketCurrent)} EXP` : `${formatBroFromCents(marketCurrent)} BRO`}
              </span>
            </button>
            {insight.recommendation.action === 'sell' ? (
              <p className="mt-2 text-center text-neon-yellow/85"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '10px',
                }}
              >
                Oportunidade detectada — valor subiu recentemente.
              </p>
            ) : null}
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

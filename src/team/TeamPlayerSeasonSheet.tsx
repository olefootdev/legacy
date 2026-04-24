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
        className="my-auto flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-dark-gray shadow-2xl max-h-[min(90dvh,calc(100dvh-4rem))]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-player-sheet-title"
      >
        <div className="flex items-start gap-3 border-b border-white/10 bg-black/40 px-4 py-3">
          <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md border border-white/15 bg-black/50">
            <img
              src={playerPortraitSrc({ name: player.name, portraitUrl: player.portraitUrl }, 200, 280)}
              alt=""
              className="h-full w-full object-cover object-top"
              referrerPolicy="no-referrer"
            />
            <span
              className={cn(
                'absolute bottom-1 left-1 rounded px-1 py-0.5 font-display text-[10px] font-black',
                card.style === 'neon-yellow' ? 'bg-neon-yellow text-black' : 'bg-black/85 text-white',
              )}
            >
              {ovrNow}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p id="team-player-sheet-title" className="font-display text-lg font-black uppercase italic tracking-wide text-white truncate">
              {player.name}
            </p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {player.pos} · Temporada (agregado)
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase">
              <span className="rounded border border-white/15 bg-black/40 px-2 py-1 text-gray-300">
                OVR mint <span className="text-white">{mintOvr}</span>
                <span className={ovrDelta > 0 ? ' text-emerald-400' : ovrDelta < 0 ? ' text-rose-400' : ' text-gray-500'}>
                  {' '}
                  ({ovrDelta >= 0 ? '+' : ''}
                  {ovrDelta})
                </span>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-white/10 bg-black/30 px-4 py-1.5">
          <VeracityPillarsStrip />
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {/* ── Insight inteligente ───────────────────────────────── */}
          <section
            className={cn(
              'rounded-xl border p-3',
              insight.momentum.tone === 'good' && 'border-emerald-400/30 bg-emerald-950/20',
              insight.momentum.tone === 'bad' && 'border-rose-400/30 bg-rose-950/20',
              insight.momentum.tone === 'neutral' && 'border-white/10 bg-white/[0.02]',
            )}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-neon-yellow" aria-hidden />
              <span className="font-display text-[10px] font-black uppercase tracking-widest text-white/70">
                Leitura rápida
              </span>
            </div>
            <p
              className={cn(
                'mt-2 font-display text-sm font-bold',
                insight.momentum.tone === 'good' && 'text-emerald-300',
                insight.momentum.tone === 'bad' && 'text-rose-300',
                insight.momentum.tone === 'neutral' && 'text-white',
              )}
            >
              {insight.momentum.label}
            </p>
            {insight.highlight ? (
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/85">
                <Flame className="h-3 w-3 shrink-0 text-neon-yellow/80" aria-hidden />
                {insight.highlight}
              </p>
            ) : null}
            <div
              className={cn(
                'mt-2 rounded border px-2.5 py-1.5 text-[11px] leading-snug',
                insight.recommendation.action === 'sell' && 'border-neon-yellow/35 bg-neon-yellow/5 text-neon-yellow',
                insight.recommendation.action === 'hold' && 'border-cyan-500/25 bg-cyan-950/20 text-cyan-200',
                insight.recommendation.action === 'watch' && 'border-white/10 bg-black/30 text-gray-300',
              )}
            >
              <span className="mr-1 font-bold uppercase tracking-wider text-[9px]">
                {insight.recommendation.action === 'sell' && '💰 Oportunidade'}
                {insight.recommendation.action === 'hold' && '🔒 Segurar'}
                {insight.recommendation.action === 'watch' && '👁 Observar'}
              </span>
              {insight.recommendation.text}
            </div>
          </section>

          {player ? <LegacyMentorSection student={player} /> : null}
          {boosterRows.length ? (
            <section className="rounded-xl border border-fuchsia-500/35 bg-fuchsia-950/20 p-3">
              <h4 className="flex items-center gap-2 font-display text-[10px] font-black uppercase tracking-widest text-fuchsia-200/90">
                <Zap className="h-3.5 w-3.5" aria-hidden />
                Boosters (inventário)
              </h4>
              <p className="mt-1 text-[9px] leading-relaxed text-gray-500">
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
                      className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/35 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300/80" aria-hidden />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white">{item.title}</p>
                          <p className="text-[9px] text-gray-500">
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
                        className="shrink-0 rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/15 px-3 py-1.5 font-display text-[9px] font-black uppercase tracking-wide text-fuchsia-100 transition hover:bg-fuchsia-500/25 disabled:cursor-not-allowed disabled:opacity-35"
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
          <section className="rounded-xl border border-cyan-500/20 bg-cyan-950/25 p-3">
            <h4 className="flex items-center gap-2 font-display text-[10px] font-black uppercase tracking-widest text-cyan-200/90">
              <Activity className="h-3.5 w-3.5" aria-hidden />
              Valor de mercado (referência)
            </h4>
            <p className="mt-2 font-mono text-xl font-bold text-white">
              {usesExpMarket ? `${formatExp(marketCurrent)} EXP` : `${formatBroFromCents(marketCurrent)} BRO`}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-2">
                <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Vs. início de registo</p>
                <div className="mt-1 flex items-center gap-2">
                  <TrendGlyph label={trendSeason.label} />
                  <span className="text-xs font-bold text-white">
                    {ledger?.seasonBaselineMarketBroCents != null
                      ? `${usesExpMarket ? formatExp(ledger.seasonBaselineMarketBroCents) : formatBroFromCents(ledger.seasonBaselineMarketBroCents)}${usesExpMarket ? ' EXP' : ' BRO'} → ${trendSeason.pct != null ? `${trendSeason.pct >= 0 ? '+' : ''}${trendSeason.pct.toFixed(1)}%` : '—'}`
                      : 'Ainda sem linha base (1.º jogo ou treino contado)'}
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-2">
                <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Desde o último jogo</p>
                <div className="mt-1 flex items-center gap-2">
                  <TrendGlyph label={trendSinceLastMatch.label} />
                  <span className="text-xs font-bold text-white">
                    {ledger?.lastMarketBroCentsAfterMatch != null
                      ? `${trendSinceLastMatch.pct != null ? `${trendSinceLastMatch.pct >= 0 ? '+' : ''}${trendSinceLastMatch.pct.toFixed(1)}%` : '—'} vs. pós-jogo (${usesExpMarket ? `${formatExp(ledger.lastMarketBroCentsAfterMatch)} EXP` : `${formatBroFromCents(ledger.lastMarketBroCentsAfterMatch)} BRO`})`
                      : 'Sem jogo finalizado ainda'}
                  </span>
                </div>
              </div>
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-gray-500">
              {usesExpMarket
                ? 'Valor de mercado em EXP (catálogo Genesis). A linha base grava-se no primeiro jogo ou treino contabilizado; «desde o último jogo» mede evolução após o apito final.'
                : 'Sem BRO no cartão, o valor mostrado estima a partir do OVR. A linha base da temporada grava-se no primeiro jogo ou treino contabilizado; «desde o último jogo» mede treinos e evolução após o apito final.'}
            </p>
          </section>

          {/* Jogos */}
          <section className="rounded-xl border border-white/10 bg-black/25 p-3">
            <h4 className="font-display text-[10px] font-black uppercase tracking-widest text-neon-yellow/90">Competição &amp; jogo</h4>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-[9px] font-bold uppercase text-gray-500">Jogos</dt>
                <dd className="font-mono font-bold text-white">{ledger?.matchesPlayed ?? 0}</dd>
              </div>
              <div>
                <dt className="text-[9px] font-bold uppercase text-gray-500">Golos</dt>
                <dd className="font-mono font-bold text-white">{ledger?.goals ?? 0}</dd>
              </div>
              <div>
                <dt className="text-[9px] font-bold uppercase text-gray-500">Amarelos / Vermelhos</dt>
                <dd className="font-mono font-bold text-white">
                  {ledger?.yellowCards ?? 0} / {ledger?.redCards ?? 0}
                </dd>
              </div>
              <div>
                <dt className="text-[9px] font-bold uppercase text-gray-500">Passes OK / tent.</dt>
                <dd className="font-mono font-bold text-white">
                  {ledger?.passesOk ?? 0} / {ledger?.passesAttempt ?? 0}
                  {passPct != null ? <span className="text-gray-400"> ({passPct}%)</span> : null}
                </dd>
              </div>
              <div>
                <dt className="text-[9px] font-bold uppercase text-gray-500">Desarmes</dt>
                <dd className="font-mono font-bold text-white">{ledger?.tackles ?? 0}</dd>
              </div>
              <div>
                <dt className="text-[9px] font-bold uppercase text-gray-500">Km (motor)</dt>
                <dd className="font-mono font-bold text-white">{km.toFixed(1)}</dd>
              </div>
              <div>
                <dt className="text-[9px] font-bold uppercase text-gray-500">Remates (agreg.)</dt>
                <dd className="font-mono font-bold text-white">{ledger?.shots ?? 0}</dd>
              </div>
            </dl>
          </section>

          {/* Treinos */}
          <section className="rounded-xl border border-white/10 bg-black/25 p-3">
            <h4 className="font-display text-[10px] font-black uppercase tracking-widest text-white/90">Treinos</h4>
            <p className="mt-1 text-[10px] text-gray-500">
              Planos concluídos: <span className="font-mono font-bold text-white">{ledger?.trainingPlansCompleted ?? 0}</span>
              {' · '}
              Sessões leves: <span className="font-mono font-bold text-white">{ledger?.trainingLightSessions ?? 0}</span>
            </p>
            {ledger && Object.keys(ledger.trainingByType).length > 0 ? (
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs">
                {Object.entries(ledger.trainingByType).map(([k, n]) => (
                  <li key={k} className="flex justify-between gap-2 border-b border-white/5 py-1">
                    <span className="text-gray-400">{trainingTypeLabel(k)}</span>
                    <span className="font-mono font-bold text-white">{n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-gray-500">Sem treinos contabilizados nesta temporada.</p>
            )}
          </section>

          {/* Atributos actuais */}
          <section className="rounded-xl border border-white/10 bg-black/25 p-3">
            <h4 className="font-display text-[10px] font-black uppercase tracking-widest text-white/90">Atributos actuais</h4>
            <p className="mt-1 text-[9px] text-gray-500">
              O modelo completo do cartão. A evolução global resume-se ao OVR mint ({mintOvr}) vs. actual ({ovrNow}).
            </p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {PLAYER_SEASON_ATTR_KEYS.map((key) => (
                <li
                  key={key}
                  className="flex items-center justify-between rounded border border-white/5 bg-black/30 px-2 py-1.5 text-xs"
                >
                  <span className="text-gray-400">{PLAYER_SEASON_ATTR_LABELS[key]}</span>
                  <span className="font-mono font-bold text-white">{player.attrs[key]}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── Footer CTA ───────────────────────────────────────────── */}
        {onAnnounceSale ? (
          <div className="shrink-0 border-t border-white/10 bg-black/55 px-4 py-3">
            <button
              type="button"
              onClick={() => onAnnounceSale(player.id)}
              className="group flex w-full items-center justify-center gap-2 rounded-lg border border-neon-yellow/40 bg-neon-yellow/10 px-4 py-2.5 font-display text-xs font-black uppercase tracking-wider text-neon-yellow transition-colors hover:bg-neon-yellow hover:text-black"
            >
              <Megaphone className="h-4 w-4 shrink-0" aria-hidden />
              Anunciar Venda
              <span className="ml-1 rounded border border-neon-yellow/40 bg-black/30 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider text-neon-yellow/90 group-hover:border-black/30 group-hover:text-black">
                {usesExpMarket ? `${formatExp(marketCurrent)} EXP` : `${formatBroFromCents(marketCurrent)} BRO`}
              </span>
            </button>
            {insight.recommendation.action === 'sell' ? (
              <p className="mt-2 text-center text-[10px] text-neon-yellow/85">
                Oportunidade detectada — valor subiu recentemente.
              </p>
            ) : null}
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

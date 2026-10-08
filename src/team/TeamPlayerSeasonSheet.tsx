import { useMemo, useRef, useEffect, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { X, TrendingDown, TrendingUp, Minus, Activity, Zap, Megaphone, Sparkles, Flame, Lock, Eye, CircleDollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarraSegmentos, DEGRAU_CLASSES, degrauDe } from '@/components/ui/Rua';
import { DEGRAU_INFO, ovrNumeroClasses } from '@/components/clube/escada';
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
import { L, emIngles } from '@/i18n/L';
import { rotuloPosicao } from '@/transfer/marketFilters';
import { FichaDoJogador } from '@/smartProfile/FichaDoJogador';

/** Rótulo de tela do escopo do booster (o valor continua sendo o id). */
const ROTULO_ESCOPO: Record<string, string> = {
  player: L('jogador', 'player'),
  squad: L('plantel', 'squad'),
  club: L('clube', 'club'),
  none: L('nenhum', 'none'),
};

function TrendGlyph({ label }: { label: 'up' | 'down' | 'flat' | 'unknown' }) {
  if (label === 'up') return <TrendingUp className="h-4 w-4 text-alta" aria-hidden />;
  if (label === 'down') return <TrendingDown className="h-4 w-4 text-baixa" aria-hidden />;
  if (label === 'flat') return <Minus className="h-4 w-4 text-mudo" aria-hidden />;
  return <span className="font-prova text-[10px] font-bold uppercase text-mudo">—</span>;
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
    return Math.max(...vals.map((p) => overallFromAttributes(p.attrs, p.pos)));
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

  const ovrNow = player ? overallFromAttributes(player.attrs, player.pos) : 0;
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
    let momentum: { label: string; tone: 'good' | 'bad' | 'neutral' } = { label: L('Acompanhamento neutro', 'Steady form'), tone: 'neutral' };
    if (trendSinceLastMatch.pct != null && trendSinceLastMatch.pct > 4) {
      momentum = { label: L('Em alta desde o último jogo', 'Rising since last match'), tone: 'good' };
    } else if (trendSinceLastMatch.pct != null && trendSinceLastMatch.pct < -4) {
      momentum = { label: L('Em baixa desde o último jogo', 'Falling since last match'), tone: 'bad' };
    } else if (trendSeason.pct != null && trendSeason.pct > 8) {
      momentum = { label: L('Valorizando na temporada', 'Value rising this season'), tone: 'good' };
    } else if (trendSeason.pct != null && trendSeason.pct < -8) {
      momentum = { label: L('Desvalorizando na temporada', 'Value falling this season'), tone: 'bad' };
    }

    // Highlight estatístico
    let highlight: string | null = null;
    if (mp >= 3) {
      if (goalsAvg >= 0.5 && (isAttacker || isMid)) {
        highlight = L(`Goleador — ${goalsAvg.toFixed(2)} gols/jogo`, `Goalscorer — ${goalsAvg.toFixed(2)} goals/match`);
      } else if (passPct != null && passPct >= 85 && (isMid || isDef)) {
        highlight = L(`Precisão alta — ${passPct}% de passes certos`, `High accuracy — ${passPct}% passes completed`);
      } else if (tacklesAvg >= 3 && isDef) {
        highlight = L(`Marcador forte — ${tacklesAvg.toFixed(1)} desarmes/jogo`, `Strong tackler — ${tacklesAvg.toFixed(1)} tackles/match`);
      } else if (ovrDelta >= 2) {
        highlight = L(`Evoluiu +${ovrDelta} OVR no clube`, `Improved +${ovrDelta} OVR at the club`);
      } else if (ovrDelta <= -2) {
        highlight = L(`Regrediu ${ovrDelta} OVR desde o mint`, `Dropped ${ovrDelta} OVR since mint`);
      }
    } else if (mp === 0) {
      highlight = L('Ainda sem jogos contabilizados', 'No matches recorded yet');
    }

    // Recomendação de venda
    let recommendation: { text: string; action: 'sell' | 'hold' | 'watch' } = {
      text: L('Continua monitorando — sem sinal forte.', 'Keep watching — no strong signal.'),
      action: 'watch',
    };
    if (trendSeason.pct != null && trendSeason.pct > 15) {
      recommendation = { text: L('Janela boa pra venda: valor subiu >15% na temporada.', 'Good time to sell: value up >15% this season.'), action: 'sell' };
    } else if (reds >= 2) {
      recommendation = { text: L('Atenção disciplinar — 2+ expulsões nesta temporada.', 'Discipline alert — 2+ red cards this season.'), action: 'watch' };
    } else if (mp >= 5 && goalsAvg < 0.1 && isAttacker) {
      recommendation = { text: L('Produção baixa pra atacante — reavaliar posição ou venda.', 'Low output for a striker — rethink position or sell.'), action: 'watch' };
    } else if (goalsAvg >= 0.5 || (passPct != null && passPct >= 88)) {
      recommendation = { text: L('Peça-chave. Segura enquanto o rendimento se mantiver.', 'Key player. Hold while form lasts.'), action: 'hold' };
    } else if (yellows >= 5) {
      recommendation = { text: L('Cartões acumulando — risco de suspensão futura.', 'Cards piling up — suspension risk ahead.'), action: 'watch' };
    }

    return { momentum, highlight, recommendation };
  }, [ledger, player.pos, trendSeason.pct, trendSinceLastMatch.pct, ovrDelta, passPct]);

  const d = degrauDe(ovrNow);
  const valorLabel = usesExpMarket ? `${formatExp(marketCurrent)} EXP` : `${formatBroFromCents(marketCurrent)}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto overscroll-y-contain bg-black/85 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        ref={panelRef}
        initial={{ scale: 0.96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 12 }}
        onClick={(e) => e.stopPropagation()}
        className="my-auto flex w-full max-w-2xl flex-col border-2 border-linha bg-asfalto-27"
        style={{
          maxHeight: 'min(92vh, calc(100vh - 2rem))',
          overflow: 'hidden',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-player-sheet-title"
      >
        {/* Hero — foto + carta do degrau (OVR) colada no canto */}
        <div className="relative w-full shrink-0 overflow-hidden border-b-2 border-linha bg-asfalto-27">
          <div className="relative w-full overflow-hidden bg-concreto" style={{ height: 'clamp(280px, 45vh, 480px)' }}>
            {/* Foto — object-contain garante que a cabeça nunca seja cortada */}
            <img
              src={playerPortraitSrc({ id: player.id, name: player.name, portraitUrl: player.portraitUrl }, 800, 1200)}
              alt=""
              className="absolute inset-0 h-full w-full object-contain object-center grayscale"
              referrerPolicy="no-referrer"
            />
            {/* Escurece a foto pra leitura (preto → transparente; permitido pelo DS) */}
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/95" />

            {/* OVR — carta do degrau colada torta (o momento "rua" da ficha) */}
            <div
              className={cn('absolute left-4 top-4 z-10 flex -rotate-3 flex-col px-3 py-2 shadow-[5px_6px_0_rgba(0,0,0,0.55)] sm:left-6 sm:top-6', DEGRAU_CLASSES[d])}
            >
              <span className={cn('font-impact text-[clamp(56px,14vw,96px)] leading-[0.85] tabular-nums', ovrNumeroClasses(d))}>{ovrNow}</span>
              <span className="mt-1 font-prova text-[10px] font-bold uppercase tracking-[0.16em]">
                {DEGRAU_INFO[d].n} · {DEGRAU_INFO[d].nome}
              </span>
            </div>

            {/* Botão fechar */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 shrink-0 items-center justify-center border-2 border-linha bg-asfalto-27 text-mudo transition-colors hover:border-papel hover:text-papel sm:right-6 sm:top-6"
              aria-label={L('Fechar', 'Close')}
            >
              <X className="h-5 w-5" />
            </button>

            {/* Info do jogador — sobreposta no rodapé da foto */}
            <div className="absolute bottom-0 left-0 right-0 z-10 p-4 sm:p-6">
              <div className="pr-12">
                <p id="team-player-sheet-title" className="font-voz text-[clamp(34px,9vw,52px)] leading-none text-papel [overflow-wrap:anywhere]">
                  {player.name}
                </p>
                <p className="mt-2 font-prova text-[11px] font-bold uppercase tracking-[0.14em] text-suave">
                  {player.country ? (
                    <span className="mr-2 not-italic" title={player.country ?? undefined} aria-hidden>
                      {player.country}
                    </span>
                  ) : null}
                  {rotuloPosicao(player.pos)} · {L('Temporada (agregado)', 'Season (total)')}
                </p>
              </div>

              {/* OVR mint + delta */}
              <div className="mt-4 flex items-end gap-3">
                <div>
                  <p className="font-prova text-[10px] font-bold uppercase tracking-[0.18em] text-mudo">Overall mint</p>
                  <p className="mt-1 font-impact text-[clamp(28px,4vw,40px)] leading-none text-papel tabular-nums">{mintOvr}</p>
                </div>
                <span aria-hidden className="pb-1 font-impact text-[22px] leading-none text-rua">→</span>
                <p
                  className={cn(
                    'pb-0.5 font-impact text-[clamp(24px,4vw,32px)] leading-none tabular-nums',
                    ovrDelta > 0 ? 'text-alta' : ovrDelta < 0 ? 'text-baixa' : 'text-mudo',
                  )}
                >
                  {ovrDelta >= 0 ? '+' : ''}{ovrDelta}
                </p>
              </div>
              <p className="mt-2 font-voz text-[18px] leading-none text-suave">
                {ovrDelta > 0 ? L('Evoluiu no clube', 'Improved at the club') : ovrDelta < 0 ? L('Regrediu desde o mint', 'Dropped since mint') : L('Mantém o nível inicial', 'Holding initial level')}
              </p>
            </div>
          </div>
        </div>

        <div className="border-b-2 border-linha px-4 py-1.5">
          <VeracityPillarsStrip />
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 scrollbar-hide scroll-smooth-snap">
          {/* ── SMART-PROFILE: classe, temperamento, gênese ───────── */}
          <FichaDoJogador playerId={playerId} />

          {/* ── Insight inteligente ───────────────────────────────── */}
          <section
            className={cn(
              'scroll-snap-section border-l-[3px] bg-concreto p-4',
              insight.momentum.tone === 'good' && 'border-alta',
              insight.momentum.tone === 'bad' && 'border-baixa',
              insight.momentum.tone === 'neutral' && 'border-fio',
            )}
          >
            <Rotulo>{L('Leitura rápida', 'Quick read')}</Rotulo>
            <p
              className={cn(
                'mt-2 font-voz text-[24px] leading-tight',
                insight.momentum.tone === 'good' && 'text-alta',
                insight.momentum.tone === 'bad' && 'text-baixa',
                insight.momentum.tone === 'neutral' && 'text-papel',
              )}
            >
              {insight.momentum.label}
            </p>
            {insight.highlight ? (
              <p className="mt-2 flex items-center gap-2 text-[13px] text-suave">
                <Flame className="h-3.5 w-3.5 shrink-0 text-rua" aria-hidden />
                {insight.highlight}
              </p>
            ) : null}
            <div
              className={cn(
                'mt-3 px-3 py-2.5 text-[13px]',
                insight.recommendation.action === 'sell' && 'border-2 border-rua text-papel',
                insight.recommendation.action === 'hold' && 'border-2 border-linha text-papel',
                insight.recommendation.action === 'watch' && 'border-2 border-dashed border-fio text-suave',
              )}
            >
              <span className={cn('mr-1.5 inline-flex items-center gap-1.5 align-middle font-prova text-[10px] font-bold uppercase tracking-[0.16em]', insight.recommendation.action === 'sell' ? 'text-rua' : 'text-mudo')}>
                {insight.recommendation.action === 'sell' && (
                  <>
                    <CircleDollarSign className="h-3.5 w-3.5 shrink-0" aria-hidden strokeWidth={2.2} />
                    {L('Oportunidade', 'Opportunity')}
                  </>
                )}
                {insight.recommendation.action === 'hold' && (
                  <>
                    <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden strokeWidth={2.2} />
                    {L('Segurar', 'Hold')}
                  </>
                )}
                {insight.recommendation.action === 'watch' && (
                  <>
                    <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden strokeWidth={2.2} />
                    {L('Observar', 'Watch')}
                  </>
                )}
              </span>
              <span>{insight.recommendation.text}</span>
            </div>
          </section>

          {player ? <PlayerHealthContractSection player={player} /> : null}
          {player ? <LegacyMentorSection student={player} /> : null}
          {boosterRows.length ? (
            <section className="scroll-snap-section flex flex-col gap-3">
              <Rotulo aside={boosterRows.length}>{L('Boosters (inventário)', 'Boosters (inventory)')}</Rotulo>
              <p className="text-[12px] leading-relaxed text-mudo">
                {L('Itens comprados na loja. Os que valem para um só jogador usam sempre esta ficha. Os de plantel ou clube aplicam ao save completo.', 'Items bought in the shop. Single-player items apply to this player. Squad or club items apply to the whole save.')}
              </p>
              <ul className="flex flex-col gap-px bg-linha">
                {boosterRows.map(({ item, qty }) => {
                  const Icon = shopItemIcon(item.iconKey);
                  const needP = shopEffectNeedsPlayer(item.effect);
                  const scope = shopEffectScope(item.effect);
                  const canUseHere = !needP || Boolean(playerId);
                  return (
                    <li
                      key={item.id}
                      className="flex flex-col gap-2 bg-concreto px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-rua" aria-hidden />
                        <div className="min-w-0">
                          <p className="font-impact text-[16px] uppercase leading-tight text-papel">{item.title}</p>
                          <p className="font-prova text-[10px] text-mudo">
                            {qty}× · {L('escopo', 'scope')}: {ROTULO_ESCOPO[scope] ?? scope}
                            {needP ? L(' · este jogador', ' · this player') : ''}
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
                        className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 self-start border-2 border-rua px-3 font-impact text-[15px] uppercase leading-none text-rua transition-colors hover:bg-rua hover:text-asfalto-27 disabled:cursor-not-allowed disabled:opacity-35 sm:self-auto"
                      >
                        {L('Usar', 'Use')} <span aria-hidden>→</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {/* Mercado — valor que já existe: degrau RESPEITO */}
          <section className="scroll-snap-section flex flex-col gap-3 border-[3px] border-ouro-27 p-4">
            <Rotulo>{L('Valor de mercado (referência)', 'Market value (reference)')}</Rotulo>
            <p className="font-spray text-[clamp(36px,10vw,48px)] font-black leading-none text-ouro-27 tabular-nums">{valorLabel}</p>
            <div className="grid gap-px bg-linha sm:grid-cols-2">
              <div className="bg-asfalto-27 px-3 py-2.5">
                <p className="font-prova text-[10px] font-bold uppercase tracking-[0.16em] text-mudo">
                  {L('Vs. início de registro', 'Vs. first record')}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <TrendGlyph label={trendSeason.label} />
                  <span className="text-[12px] text-papel">
                    {ledger?.seasonBaselineMarketBroCents != null
                      ? `${usesExpMarket ? formatExp(ledger.seasonBaselineMarketBroCents) : formatBroFromCents(ledger.seasonBaselineMarketBroCents)}${usesExpMarket ? ' EXP' : ' BRO'} → ${trendSeason.pct != null ? `${trendSeason.pct >= 0 ? '+' : ''}${trendSeason.pct.toFixed(1)}%` : '—'}`
                      : L('Ainda sem linha base (1.º jogo ou treino contado)', 'No baseline yet (1st match or training counted)')}
                  </span>
                </div>
              </div>
              <div className="bg-asfalto-27 px-3 py-2.5">
                <p className="font-prova text-[10px] font-bold uppercase tracking-[0.16em] text-mudo">
                  {L('Desde o último jogo', 'Since last match')}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <TrendGlyph label={trendSinceLastMatch.label} />
                  <span className="text-[12px] text-papel">
                    {ledger?.lastMarketBroCentsAfterMatch != null
                      ? `${trendSinceLastMatch.pct != null ? `${trendSinceLastMatch.pct >= 0 ? '+' : ''}${trendSinceLastMatch.pct.toFixed(1)}%` : '—'} ${L('vs. pós-jogo', 'vs. post-match')} (${usesExpMarket ? `${formatExp(ledger.lastMarketBroCentsAfterMatch)} EXP` : `${formatBroFromCents(ledger.lastMarketBroCentsAfterMatch)}`})`
                      : L('Sem jogo finalizado ainda', 'No finished match yet')}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-mudo">
              {usesExpMarket
                ? L('Valor de mercado em EXP (catálogo Genesis). A linha base é gravada no primeiro jogo ou treino contabilizado; «desde o último jogo» mede a evolução após o apito final.', 'Market value in EXP (Genesis catalog). The baseline is set on the first recorded match or training; “since last match” tracks progress after the final whistle.')
                : L('Sem BRO no cartão, o valor mostrado é estimado a partir do OVR. A linha base da temporada é gravada no primeiro jogo ou treino contabilizado; «desde o último jogo» mede treinos e evolução após o apito final.', 'With no BRO on the card, the value is estimated from OVR. The season baseline is set on the first recorded match or training; “since last match” tracks training and progress after the final whistle.')}
            </p>
          </section>

          {/* Jogos */}
          <section className="scroll-snap-section flex flex-col gap-3">
            <Rotulo>{L('Competição & jogo', 'Competition & match')}</Rotulo>
            <dl className="grid grid-cols-2 gap-px bg-linha sm:grid-cols-3">
              <Dado label={L('Jogos', 'Matches')} valor={ledger?.matchesPlayed ?? 0} />
              <Dado label={L('Gols', 'Goals')} valor={ledger?.goals ?? 0} />
              <Dado label={L('Amarelos / Vermelhos', 'Yellows / Reds')} valor={`${ledger?.yellowCards ?? 0} / ${ledger?.redCards ?? 0}`} />
              <Dado
                label={L('Passes OK / tent.', 'Passes OK / att.')}
                valor={<>{ledger?.passesOk ?? 0} / {ledger?.passesAttempt ?? 0}{passPct != null ? <span className="font-prova text-[11px] text-mudo"> ({passPct}%)</span> : null}</>}
              />
              <Dado label={L('Desarmes', 'Tackles')} valor={ledger?.tackles ?? 0} />
              <Dado label={L('Km (motor)', 'Km (engine)')} valor={km.toFixed(1)} />
              <Dado label={L('Finalizações (agreg.)', 'Shots (total)')} valor={ledger?.shots ?? 0} />
            </dl>
          </section>

          {/* Treinos */}
          <section className="scroll-snap-section flex flex-col gap-3">
            <Rotulo>{L('Treinos', 'Training')}</Rotulo>
            <p className="text-[12px] text-suave">
              {L('Planos concluídos', 'Plans completed')}: <span className="font-impact text-[16px] text-papel">{ledger?.trainingPlansCompleted ?? 0}</span>
              {' · '}
              {L('Sessões leves', 'Light sessions')}: <span className="font-impact text-[16px] text-papel">{ledger?.trainingLightSessions ?? 0}</span>
            </p>
            {ledger && Object.keys(ledger.trainingByType).length > 0 ? (
              <ul className="max-h-28 overflow-y-auto">
                {Object.entries(ledger.trainingByType).map(([k, n]) => (
                  <li key={k} className="flex justify-between gap-2 border-b border-linha py-1.5">
                    <span className="text-[12px] text-suave">{trainingTypeLabel(k)}</span>
                    <span className="font-impact text-[15px] text-papel tabular-nums">{n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-2 border-dashed border-fio p-3 font-voz text-[19px] leading-tight text-suave">
                {L('Sem treinos contabilizados nesta temporada.', 'No training recorded this season.')}
              </p>
            )}
          </section>

          {/* Atributos atuais — em segmentos */}
          <section className="scroll-snap-section flex flex-col gap-3">
            <Rotulo>{L('Atributos atuais', 'Current attributes')}</Rotulo>
            <p className="text-[11px] text-mudo">
              {emIngles()
                ? <>The full card model. Overall progress boils down to mint OVR ({mintOvr}) vs. current ({ovrNow}).</>
                : <>O modelo completo do cartão. A evolução global se resume ao OVR mint ({mintOvr}) vs. atual ({ovrNow}).</>}
            </p>
            <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {PLAYER_SEASON_ATTR_KEYS.map((key) => (
                <li key={key} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-prova text-[11px] font-bold uppercase tracking-[0.08em] text-mudo">{PLAYER_SEASON_ATTR_LABELS[key]}</span>
                    <span className="font-impact text-[18px] leading-none text-papel tabular-nums">{player.attrs[key]}</span>
                  </div>
                  <BarraSegmentos valor={Math.max(0, Math.min(100, Number(player.attrs[key]) || 0))} max={100} className="mt-1.5 h-2 gap-[3px]" />
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── Footer CTA ───────────────────────────────────────────── */}
        {onAnnounceSale ? (
          <div className="shrink-0 border-t-2 border-linha px-4 py-4 pr-5">
            <button
              type="button"
              onClick={() => onAnnounceSale(player.id)}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 bg-rua px-4 font-impact text-[19px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)]"
            >
              <Megaphone className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">{L('Anunciar Venda', 'List for Sale')}</span>
              <span className="shrink-0 border-2 border-asfalto-27 px-2 py-1 font-prova text-[11px] font-bold">{valorLabel}</span>
            </button>
            {insight.recommendation.action === 'sell' ? (
              <p className="mt-3 text-center font-voz text-[17px] text-rua">
                {L('Oportunidade detectada — valor subiu recentemente.', 'Opportunity spotted — value rose recently.')}
              </p>
            ) : null}
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

/** Rótulo de seção da ficha: "— TÍTULO" em prova. */
function Rotulo({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <h3 className="min-w-0 truncate font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">— {children}</h3>
      {aside != null && <span className="shrink-0 font-prova text-[12px] font-bold text-mudo">{aside}</span>}
    </div>
  );
}

function Dado({ label, valor }: { label: string; valor: ReactNode }) {
  return (
    <div className="min-w-0 bg-asfalto-27 px-3 py-2.5">
      <dt className="truncate font-prova text-[10px] font-bold uppercase tracking-[0.12em] text-mudo">{label}</dt>
      <dd className="mt-1 font-impact text-[22px] leading-none text-papel tabular-nums">{valor}</dd>
    </div>
  );
}

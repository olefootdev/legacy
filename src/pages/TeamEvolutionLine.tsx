import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { User, Users } from 'lucide-react';
import { TeamMeuTimeHeader } from '@/pages/TeamMeuTimeHeader';
import { useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import { PLAYER_SEASON_ATTR_KEYS, PLAYER_SEASON_ATTR_LABELS } from '@/team/playerSeasonLedger';
import type { PlayerEvolutionPoint } from '@/team/playerEvolutionTimeline';
import type { PlayerAttributes } from '@/entities/types';
import { BackButton } from '@/components/BackButton';

const LEDGER_METRICS = [
  { key: 'goals', label: 'Golos (cum.)' },
  { key: 'assists', label: 'Assistências (cum.)' },
  { key: 'passesOk', label: 'Passes certos (cum.)' },
  { key: 'shots', label: 'Remates (cum.)' },
  { key: 'tackles', label: 'Desarmes / roubos (cum.)' },
  { key: 'yellowCards', label: 'Amarelos (cum.)' },
  { key: 'redCards', label: 'Vermelhos (cum.)' },
  { key: 'winsCumulative', label: 'Vitórias (cum.)' },
] as const;

type LedgerMetricId = (typeof LEDGER_METRICS)[number]['key'];
type AttrSelection = 'ovr' | keyof PlayerAttributes;

function winsCumulative(points: PlayerEvolutionPoint[]): number[] {
  let w = 0;
  return points.map((p) => {
    if (p.source === 'match' && p.ledger.matchWin === 1) w += 1;
    return w;
  });
}

function seriesFromLedger(points: PlayerEvolutionPoint[], key: LedgerMetricId): number[] {
  if (key === 'winsCumulative') return winsCumulative(points);
  return points.map((p) => {
    const L = p.ledger;
    switch (key) {
      case 'goals':
        return L.goals;
      case 'assists':
        return L.assists;
      case 'passesOk':
        return L.passesOk;
      case 'shots':
        return L.shots;
      case 'tackles':
        return L.tackles;
      case 'yellowCards':
        return L.yellowCards;
      case 'redCards':
        return L.redCards;
      default:
        return 0;
    }
  });
}

function seriesFromAttrs(points: PlayerEvolutionPoint[], key: keyof PlayerAttributes): number[] {
  return points.map((p) => p.attrs[key]);
}

function seriesOvr(points: PlayerEvolutionPoint[], pos?: string): number[] {
  return points.map((p) => overallFromAttributes(p.attrs, pos));
}

function valuesForAttrSelection(points: PlayerEvolutionPoint[], sel: AttrSelection, pos?: string): number[] {
  return sel === 'ovr' ? seriesOvr(points, pos) : seriesFromAttrs(points, sel);
}

type ChartSeries = { label: string; color: string; values: number[] };

function LineChartSvg({
  seriesList,
  height = 200,
  compact = false,
}: {
  seriesList: ChartSeries[];
  height?: number;
  compact?: boolean;
}) {
  const w = 560;
  const padL = 48;
  const padR = 14;
  const padT = compact ? 10 : 22;
  const padB = compact ? 12 : 30;
  const iw = w - padL - padR;
  const ih = height - padT - padB;

  let minV = Infinity;
  let maxV = -Infinity;
  for (const s of seriesList) {
    for (const v of s.values) {
      if (Number.isFinite(v)) {
        minV = Math.min(minV, v);
        maxV = Math.max(maxV, v);
      }
    }
  }
  if (!Number.isFinite(minV)) {
    return (
      <div className="rounded border border-white/10 bg-black/30 p-4 text-center text-[10px] text-gray-500">
        —
      </div>
    );
  }
  if (minV === maxV) {
    minV -= 1;
    maxV += 1;
  }
  const span = Math.max(1e-6, maxV - minV);
  const pad = span * 0.08;
  minV -= pad;
  maxV += pad;
  const span2 = maxV - minV;

  const maxLen = Math.max(1, ...seriesList.map((s) => s.values.length));
  const xAt = (i: number, len: number) => {
    if (len <= 1) return padL + iw / 2;
    return padL + (i / (len - 1)) * iw;
  };

  const paths = seriesList.map((s) => {
    const len = s.values.length;
    const pts = s.values.map((v, i) => {
      const x = xAt(i, len);
      const y = padT + ih - ((v - minV) / span2) * ih;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return { d: pts.join(' '), color: s.color };
  });

  return (
    <div className={compact ? '' : 'space-y-2'}>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        className="h-auto w-full max-w-full rounded border border-white/10 bg-black/25"
        role="img"
        aria-label="Gráfico de linhas"
      >
        {!compact && (
          <text x={padL} y={16} fill="rgba(255,255,255,0.5)" className="text-[11px]">
            min {minV.toFixed(2)} · max {maxV.toFixed(2)}
          </text>
        )}
        {paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth={compact ? 1.6 : 2.2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {!compact && (
          <text x={padL} y={height - 8} fill="rgba(255,255,255,0.35)" className="text-[10px]">
            Eixo X: evento 1 … {maxLen}
          </text>
        )}
      </svg>
      {!compact && (
        <div className="flex flex-wrap gap-3 text-[10px] text-gray-400">
          {seriesList.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function TeamEvolutionLine() {
  const players = useGameStore((s) => s.players);
  const timeline = useGameStore((s) => s.playerEvolutionTimeline ?? {});
  const npcOffers = useGameStore((s) => s.managerProspectMarket?.npcOffers ?? []);

  const [scope, setScope] = useState<'player' | 'team'>('player');
  const [playerA, setPlayerA] = useState<string>('');
  const [compareOn, setCompareOn] = useState(false);
  const [compareKind, setCompareKind] = useState<'roster' | 'market'>('roster');
  const [playerB, setPlayerB] = useState<string>('');
  const [marketListingId, setMarketListingId] = useState<string>('');
  const [tab, setTab] = useState<'attrs' | 'events'>('attrs');
  const [attrSelection, setAttrSelection] = useState<AttrSelection>('ovr');
  const [ledgerKey, setLedgerKey] = useState<LedgerMetricId>('goals');

  const roster = useMemo(
    () => Object.values(players).sort((a, b) => a.num - b.num),
    [players],
  );

  const pointsA = playerA ? timeline[playerA] ?? [] : [];
  const pointsB = compareKind === 'roster' && playerB ? timeline[playerB] ?? [] : [];

  const marketSnapshot = useMemo(
    () => npcOffers.find((o) => o.listingId === marketListingId)?.snapshot,
    [npcOffers, marketListingId],
  );

  const attrLabel =
    attrSelection === 'ovr' ? 'OVR' : PLAYER_SEASON_ATTR_LABELS[attrSelection as keyof PlayerAttributes];

  const chartSeries: ChartSeries[] = useMemo(() => {
    if (scope === 'team' || pointsA.length < 2) return [];
    if (tab === 'attrs') {
      const primary: ChartSeries = {
        label: players[playerA]?.name ?? 'A',
        color: 'rgb(234, 255, 0)',
        values: valuesForAttrSelection(pointsA, attrSelection, players[playerA]?.pos),
      };
      if (compareOn && compareKind === 'roster' && playerB && pointsB.length >= 2) {
        return [
          primary,
          {
            label: players[playerB]?.name ?? 'B',
            color: 'rgb(96, 220, 255)',
            values: valuesForAttrSelection(pointsB, attrSelection, players[playerB]?.pos),
          },
        ];
      }
      if (compareOn && compareKind === 'market' && marketSnapshot) {
        const ref =
          attrSelection === 'ovr'
            ? overallFromAttributes(marketSnapshot.attrs, marketSnapshot.pos)
            : marketSnapshot.attrs[attrSelection as keyof PlayerAttributes];
        return [
          primary,
          {
            label: `${marketSnapshot.name} (mercado)`,
            color: 'rgb(180, 160, 255)',
            values: pointsA.map(() => ref),
          },
        ];
      }
      return [primary];
    }
    const primary: ChartSeries = {
      label: players[playerA]?.name ?? 'A',
      color: 'rgb(234, 255, 0)',
      values: seriesFromLedger(pointsA, ledgerKey),
    };
    if (compareOn && compareKind === 'roster' && playerB && pointsB.length >= 2) {
      return [
        primary,
        {
          label: players[playerB]?.name ?? 'B',
          color: 'rgb(96, 220, 255)',
          values: seriesFromLedger(pointsB, ledgerKey),
        },
      ];
    }
    return [primary];
  }, [
    scope,
    pointsA,
    pointsB,
    tab,
    attrSelection,
    ledgerKey,
    playerA,
    playerB,
    players,
    compareOn,
    compareKind,
    marketSnapshot,
  ]);

  const eventsMarketCompareBlocked = tab === 'events' && compareOn && compareKind === 'market';

  const teamSparkRows = useMemo(() => {
    return roster.map((p) => {
      const pts = timeline[p.id] ?? [];
      const ovrPts = pts.length >= 2 ? seriesOvr(pts, p.pos) : [];
      return { id: p.id, name: p.name, num: p.num, pts, ovrPts };
    });
  }, [roster, timeline]);

  return (
    <div className="w-full max-w-[100vw] min-w-0 mx-auto overflow-x-hidden pb-12">
      <div className="w-full max-w-6xl min-w-0 mx-auto px-3 sm:px-4 lg:px-8 space-y-4 text-[13px] leading-snug">
        <BackButton to="/clube" label="Clube" />
        <TeamMeuTimeHeader
          title="Linha evolutiva"
          subtitle="Evolução de atributos e totais de jogo ao longo do tempo. Compara com outro jogador do plantel ou usa uma carta do mercado EXP como referência (atributos)."
        />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="sports-panel space-y-3 p-3 sm:p-4"
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setScope('player')}
            className={
              scope === 'player'
                ? 'inline-flex items-center gap-1.5 rounded bg-neon-yellow px-3 py-1.5 text-[11px] font-semibold uppercase text-black'
                : 'inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase text-gray-300'
            }
          >
            <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Por jogador
          </button>
          <button
            type="button"
            onClick={() => setScope('team')}
            className={
              scope === 'team'
                ? 'inline-flex items-center gap-1.5 rounded bg-neon-yellow px-3 py-1.5 text-[11px] font-semibold uppercase text-black'
                : 'inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase text-gray-300'
            }
          >
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Equipe inteira
          </button>
        </div>

        {scope === 'player' ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Jogador</span>
                <select
                  value={playerA}
                  onChange={(e) => setPlayerA(e.target.value)}
                  className="w-full rounded border border-white/15 bg-black/40 px-2 py-2 text-xs text-white"
                >
                  <option value="">— Escolher —</option>
                  {roster.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.num} · {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="space-y-2 rounded border border-white/10 bg-black/20 p-2">
                <label className="flex items-center gap-2 text-[11px] text-gray-300">
                  <input
                    type="checkbox"
                    checked={compareOn}
                    onChange={(e) => setCompareOn(e.target.checked)}
                    className="accent-neon-yellow"
                  />
                  Comparar com outro
                </label>
                {compareOn && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCompareKind('roster')}
                      className={
                        compareKind === 'roster'
                          ? 'rounded border border-neon-yellow/50 bg-neon-yellow/10 px-2 py-1 text-[10px] font-bold uppercase text-neon-yellow'
                          : 'rounded border border-white/10 px-2 py-1 text-[10px] font-bold uppercase text-gray-400'
                      }
                    >
                      Plantel
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompareKind('market')}
                      className={
                        compareKind === 'market'
                          ? 'rounded border border-neon-yellow/50 bg-neon-yellow/10 px-2 py-1 text-[10px] font-bold uppercase text-neon-yellow'
                          : 'rounded border border-white/10 px-2 py-1 text-[10px] font-bold uppercase text-gray-400'
                      }
                    >
                      Mercado EXP
                    </button>
                  </div>
                )}
                {compareOn && compareKind === 'roster' && (
                  <select
                    value={playerB}
                    onChange={(e) => setPlayerB(e.target.value)}
                    className="w-full rounded border border-white/15 bg-black/40 px-2 py-2 text-xs text-white"
                  >
                    <option value="">— Jogador B —</option>
                    {roster
                      .filter((p) => p.id !== playerA)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.num} · {p.name}
                        </option>
                      ))}
                  </select>
                )}
                {compareOn && compareKind === 'market' && (
                  <select
                    value={marketListingId}
                    onChange={(e) => setMarketListingId(e.target.value)}
                    className="w-full rounded border border-white/15 bg-black/40 px-2 py-2 text-xs text-white"
                  >
                    <option value="">— Oferta NPC —</option>
                    {npcOffers.map((o) => (
                      <option key={o.listingId} value={o.listingId}>
                        {o.snapshot.name} · OVR {overallFromAttributes(o.snapshot.attrs, o.snapshot.pos)} · {o.priceExp} EXP
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={() => setTab('attrs')}
                className={
                  tab === 'attrs'
                    ? 'rounded bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white'
                    : 'rounded px-2.5 py-1 text-[11px] text-gray-500 hover:text-gray-300'
                }
              >
                Atributos
              </button>
              <button
                type="button"
                onClick={() => setTab('events')}
                className={
                  tab === 'events'
                    ? 'rounded bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white'
                    : 'rounded px-2.5 py-1 text-[11px] text-gray-500 hover:text-gray-300'
                }
              >
                Eventos de jogo
              </button>
            </div>

            {tab === 'attrs' ? (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setAttrSelection('ovr')}
                  className={
                    attrSelection === 'ovr'
                      ? 'rounded border border-neon-yellow/60 bg-neon-yellow/10 px-2 py-1 text-[10px] font-semibold text-neon-yellow'
                      : 'rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-gray-400 hover:text-white'
                  }
                >
                  OVR
                </button>
                {PLAYER_SEASON_ATTR_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setAttrSelection(k)}
                    className={
                      attrSelection === k
                        ? 'rounded border border-neon-yellow/60 bg-neon-yellow/10 px-2 py-1 text-[10px] font-semibold text-neon-yellow'
                        : 'rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-gray-400 hover:text-white'
                    }
                  >
                    {PLAYER_SEASON_ATTR_LABELS[k]}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {LEDGER_METRICS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setLedgerKey(m.key)}
                    className={
                      ledgerKey === m.key
                        ? 'rounded border border-neon-yellow/60 bg-neon-yellow/10 px-2 py-1 text-[10px] font-semibold text-neon-yellow'
                        : 'rounded border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-gray-400 hover:text-white'
                    }
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}

            {eventsMarketCompareBlocked && (
              <p className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-200/90">
                No mercado EXP não há histórico de jogos — compara estatísticas no modo «Plantel» ou vê atributos no
                separador «Atributos».
              </p>
            )}

            {playerA && pointsA.length < 2 && (
              <p className="text-[11px] text-gray-500">
                Ainda não há histórico suficiente (mínimo 2 pontos). Joga partidas ou conclui treinos para gerar a linha.
              </p>
            )}

            {playerA && pointsA.length >= 2 && !eventsMarketCompareBlocked && (
              <div className="space-y-2 border-t border-white/10 pt-3">
                {tab === 'attrs' && (
                  <>
                    <p className="text-[10px] text-gray-500">
                      Métrica: <span className="text-white">{attrLabel}</span>
                    </p>
                    <LineChartSvg seriesList={chartSeries} />
                  </>
                )}
                {tab === 'events' && (
                  <>
                    <p className="text-[10px] text-gray-500">
                      Métrica:{' '}
                      <span className="text-white">{LEDGER_METRICS.find((m) => m.key === ledgerKey)?.label}</span>
                    </p>
                    <LineChartSvg seriesList={chartSeries} />
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-gray-400">
              Visão geral: OVR ao longo dos eventos registados por jogador (desde esta versão do jogo).
            </p>
            <div className="max-h-[min(28rem,55dvh)] overflow-y-auto rounded border border-white/10">
              <table className="w-full border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-white/10 bg-black/40 text-[10px] uppercase text-gray-500">
                    <th className="px-2 py-2">Jogador</th>
                    <th className="px-2 py-2">Pontos</th>
                    <th className="min-w-[180px] px-2 py-2">OVR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {teamSparkRows.map((row) => (
                    <tr key={row.id} className="bg-black/20">
                      <td className="px-2 py-2 font-medium text-white">
                        <span className="font-mono text-gray-500">{row.num}</span> · {row.name}
                      </td>
                      <td className="px-2 py-2 tabular-nums text-gray-400">{row.pts.length}</td>
                      <td className="px-1 py-1">
                        {row.ovrPts.length >= 2 ? (
                          <LineChartSvg
                            compact
                            height={100}
                            seriesList={[{ label: 'OVR', color: 'rgb(234, 255, 0)', values: row.ovrPts }]}
                          />
                        ) : (
                          <span className="px-2 text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>

      <p className="text-[10px] text-gray-600">
        Os pontos são gravados após cada jogo finalizado e após treinos concluídos (incl. sessão leve). MVP detalhado
        pode ser acrescentado quando o motor expuser esse dado por jogo.
      </p>
    </div>
    </div>
  );
}

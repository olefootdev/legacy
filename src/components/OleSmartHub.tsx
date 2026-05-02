import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Newspaper,
  MessageCircle,
  Zap,
  Trophy,
  Target,
  Star,
  AlertTriangle,
  Flame,
  Users,
  HeadphonesIcon,
  Send,
  UserPlus,
  ChevronRight,
  Check,
  AtSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import { formatOle } from '@/systems/economy';
import { computeUsername, findProfileByUsername } from '@/supabase/managerUsername';

function ovr(attrs: import('@/entities/types').PlayerAttributes): number {
  const vals = Object.values(attrs);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function formColor(r: 'W' | 'D' | 'L') {
  if (r === 'W') return 'bg-green-500';
  if (r === 'D') return 'bg-yellow-400';
  return 'bg-red-500';
}

function formLabel(r: 'W' | 'D' | 'L') {
  if (r === 'W') return 'V';
  if (r === 'D') return 'E';
  return 'D';
}

// ─── Radar SVG hexagonal ──────────────────────────────────────────────────────

const RADAR_LABELS = ['VEL', 'FIN', 'PAS', 'DRI', 'MAR', 'FIS'];
const RADAR_KEYS: Array<keyof import('@/entities/types').PlayerAttributes> = [
  'velocidade', 'finalizacao', 'passe', 'drible', 'marcacao', 'fisico',
];

function hexPoint(angle: number, r: number, cx: number, cy: number): [number, number] {
  const rad = (angle - 90) * (Math.PI / 180);
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function hexPath(values: number[], maxR: number, cx: number, cy: number): string {
  const n = values.length;
  return values.map((v, i) => {
    const [x, y] = hexPoint((360 / n) * i, (v / 100) * maxR, cx, cy);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ') + ' Z';
}

function RadarSVG({ values }: { values: number[] }) {
  const cx = 50;
  const cy = 50;
  const maxR = 38;
  const n = 6;
  const levels = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox="0 0 100 100" width={100} height={100}>
      {/* Grid levels */}
      {levels.map((lvl) => (
        <polygon
          key={lvl}
          points={Array.from({ length: n }, (_, i) => {
            const [x, y] = hexPoint((360 / n) * i, lvl * maxR, cx, cy);
            return `${x.toFixed(2)},${y.toFixed(2)}`;
          }).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.5"
        />
      ))}
      {/* Axis lines */}
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = hexPoint((360 / n) * i, maxR, cx, cy);
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={x.toFixed(2)} y2={y.toFixed(2)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.5"
          />
        );
      })}
      {/* Data area */}
      <path
        d={hexPath(values, maxR, cx, cy)}
        fill="rgba(253,225,0,0.15)"
        stroke="#FDE100"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Vertex dots */}
      {values.map((v, i) => {
        const [x, y] = hexPoint((360 / n) * i, (v / 100) * maxR, cx, cy);
        return <circle key={i} cx={x.toFixed(2)} cy={y.toFixed(2)} r="2.5" fill="#FDE100" />;
      })}
      {/* Labels */}
      {RADAR_LABELS.map((label, i) => {
        const [x, y] = hexPoint((360 / n) * i, maxR + 8, cx, cy);
        return (
          <text
            key={label}
            x={x.toFixed(2)}
            y={y.toFixed(2)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="7"
            fill="rgba(255,255,255,0.55)"
            fontFamily="var(--font-display)"
            letterSpacing="0.05em"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Widget: Seção header ─────────────────────────────────────────────────────

function SectionHeader({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-1.5">
        <span className="w-[3px] h-4 bg-neon-yellow rounded-sm shrink-0" />
        <span
          className="text-white/85 tracking-[0.28em] uppercase"
          style={{ fontFamily: 'var(--font-display)', fontSize: '9px' }}
        >
          {label}
        </span>
      </div>
      <Icon className="w-3 h-3 text-white/35" strokeWidth={2} />
    </div>
  );
}

// ─── Widget 1: Notícias ───────────────────────────────────────────────────────

function NewsWidget() {
  const clubName = useGameStore((s) => s.club?.name ?? 'Clube');
  const form = useGameStore((s) => s.form);
  const results = useGameStore((s) => s.results);
  const ranking = useGameStore((s) => s.competitiveRanking);

  const headlines = useMemo(() => {
    const items: Array<{ text: string; icon: React.ElementType; color: string }> = [];

    const last = results[results.length - 1];
    if (last) {
      if (last.result === 'win') {
        items.push({
          text: `${last.home} vence ${last.scoreHome}–${last.scoreAway} e mantém pressão na tabela`,
          icon: Flame,
          color: 'text-green-400',
        });
      } else if (last.result === 'loss') {
        items.push({
          text: `Derrota por ${last.scoreHome}–${last.scoreAway} — hora de rever a tática`,
          icon: AlertTriangle,
          color: 'text-red-400',
        });
      } else {
        items.push({
          text: `Empate ${last.scoreHome}–${last.scoreAway} — ponto conquistado`,
          icon: Target,
          color: 'text-yellow-400',
        });
      }
    }

    const recentWins = (form.slice(-5)).filter((r) => r === 'W').length;
    if (recentWins >= 3) {
      items.push({
        text: `${recentWins} vitórias nos últimos jogos — sequência em chamas`,
        icon: Flame,
        color: 'text-neon-yellow',
      });
    }

    if (ranking && ranking.currentWinStreak >= 2) {
      items.push({
        text: `Sequência de ${ranking.currentWinStreak} vitórias consecutivas no modo competitivo`,
        icon: Trophy,
        color: 'text-neon-yellow',
      });
    }

    if (items.length === 0) {
      items.push({
        text: `${clubName} começa a temporada. Primeira partida define o tom.`,
        icon: Star,
        color: 'text-white/55',
      });
    }

    return items.slice(0, 3);
  }, [results, form, ranking, clubName]);

  return (
    <div>
      <SectionHeader label="NOTÍCIAS · IA" icon={Newspaper} />
      <div className="space-y-2">
        {headlines.map((h, i) => (
          <div key={i} className="flex items-start gap-2">
            <h.icon className={cn('w-3 h-3 mt-0.5 shrink-0', h.color)} strokeWidth={2} />
            <p
              className="text-white/65 leading-snug"
              style={{ fontFamily: 'var(--font-sans)', fontSize: '11px' }}
            >
              {h.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Widget 2: Forma recente ──────────────────────────────────────────────────

function FormWidget() {
  const form = useGameStore((s) => s.form);
  const ranking = useGameStore((s) => s.competitiveRanking);

  const last5 = form.slice(-5);

  return (
    <div>
      <SectionHeader label="FORMA RECENTE" icon={Flame} />
      {last5.length === 0 ? (
        <p className="text-white/35" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px' }}>
          Nenhuma partida jogada.
        </p>
      ) : (
        <div className="flex gap-1.5 mb-3">
          {last5.map((r, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center justify-center rounded-sm shrink-0',
                formColor(r),
              )}
              style={{ width: 24, height: 24 }}
            >
              <span
                className="text-black font-bold"
                style={{ fontFamily: 'var(--font-display)', fontSize: '9px' }}
              >
                {formLabel(r)}
              </span>
            </div>
          ))}
        </div>
      )}

      {ranking && ranking.matchesPlayed > 0 && (
        <div className="grid grid-cols-3 gap-1 text-center">
          {([
            { label: 'VITÓRIAS', value: ranking.wins, color: 'text-green-400' },
            { label: 'EMPATES', value: ranking.draws, color: 'text-yellow-400' },
            { label: 'DERROTAS', value: ranking.losses, color: 'text-red-400' },
          ] as const).map((s) => (
            <div key={s.label}>
              <div
                className={cn('tabular-nums italic', s.color)}
                style={{ fontFamily: 'var(--font-serif-hero)', fontSize: '18px' }}
              >
                {s.value}
              </div>
              <div
                className="text-white/45 tracking-[0.14em]"
                style={{ fontFamily: 'var(--font-display)', fontSize: '8px' }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Widget 3: Radar (Performance) ───────────────────────────────────────────

function RadarWidget() {
  const players = useGameStore((s) => s.players);
  const lineup = useGameStore((s) => s.lineup);

  const { radarValues, avgOvr, barStats } = useMemo(() => {
    const lineupIds = Object.values(lineup);
    const starters = lineupIds
      .map((id) => players[id])
      .filter(Boolean);

    if (starters.length === 0) {
      return { radarValues: [50, 50, 50, 50, 50, 50], avgOvr: 0, barStats: [] };
    }

    function avg(key: keyof import('@/entities/types').PlayerAttributes) {
      const vals = starters.map((p) => p.attrs[key] ?? 0);
      return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }

    const stats = {
      velocidade: avg('velocidade'),
      finalizacao: avg('finalizacao'),
      passe: avg('passe'),
      drible: avg('drible'),
      marcacao: avg('marcacao'),
      fisico: avg('fisico'),
    };

    const totalOvr = starters.map((p) => ovr(p.attrs));
    const avgOvrVal = Math.round(totalOvr.reduce((a, b) => a + b, 0) / totalOvr.length);

    return {
      radarValues: RADAR_KEYS.map((k) => stats[k]),
      avgOvr: avgOvrVal,
      barStats: [
        { label: 'VEL', value: stats.velocidade },
        { label: 'FIN', value: stats.finalizacao },
        { label: 'PAS', value: stats.passe },
        { label: 'DRI', value: stats.drible },
        { label: 'MAR', value: stats.marcacao },
        { label: 'FIS', value: stats.fisico },
      ],
    };
  }, [players, lineup]);

  const hasLineup = Object.keys(lineup).length > 0;

  return (
    <div>
      <SectionHeader label="PERFORMANCE · XI" icon={Target} />
      {!hasLineup ? (
        <p className="text-white/35" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px' }}>
          Escala o teu plantel para ver o radar.
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <RadarSVG values={radarValues} />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="tabular-nums italic text-neon-yellow mb-2 leading-none"
              style={{ fontFamily: 'var(--font-serif-hero)', fontSize: '28px' }}
            >
              {avgOvr}
            </div>
            <div className="space-y-1">
              {barStats.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span
                    className="text-white/55 w-7 shrink-0 tracking-[0.1em]"
                    style={{ fontFamily: 'var(--font-display)', fontSize: '8px' }}
                  >
                    {s.label}
                  </span>
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neon-yellow rounded-full"
                      style={{ width: `${s.value}%` }}
                    />
                  </div>
                  <span
                    className="tabular-nums text-white/65 w-5 text-right shrink-0"
                    style={{ fontFamily: 'var(--font-sans)', fontSize: '10px' }}
                  >
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Widget 4: Próximo jogo ───────────────────────────────────────────────────

function MatchAnalysisWidget() {
  const nextFixture = useGameStore((s) => s.nextFixture);
  const players = useGameStore((s) => s.players);
  const lineup = useGameStore((s) => s.lineup);
  const ranking = useGameStore((s) => s.competitiveRanking);
  const clubName = useGameStore((s) => s.club?.name ?? 'Nós');

  const { ourOvr, comparisons, verdict } = useMemo(() => {
    if (!nextFixture) return { ourOvr: 0, comparisons: [], verdict: '' };

    const lineupIds = Object.values(lineup);
    const starters = lineupIds.map((id) => players[id]).filter(Boolean);
    const strength = nextFixture.opponent.strength;

    function avg(keys: Array<keyof import('@/entities/types').PlayerAttributes>) {
      if (starters.length === 0) return 50;
      const vals = starters.map((p) =>
        keys.reduce((sum, k) => sum + (p.attrs[k] ?? 0), 0) / keys.length
      );
      return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }

    const totalOvr = starters.length > 0
      ? Math.round(starters.map((p) => ovr(p.attrs)).reduce((a, b) => a + b, 0) / starters.length)
      : (nextFixture.opponent.highlightPlayer?.ovr ?? strength);

    const winStreak = ranking?.currentWinStreak ?? 0;

    const rows = [
      {
        label: 'ATAQUE',
        ours: avg(['finalizacao', 'velocidade', 'drible']),
        theirs: Math.round(strength * 0.95 + (Math.random() * 4 - 2)),
      },
      {
        label: 'DEFESA',
        ours: avg(['marcacao', 'fisico']),
        theirs: Math.round(strength * 0.85),
      },
      {
        label: 'CRIATIVIDADE',
        ours: avg(['passe', 'tatico']),
        theirs: Math.round(strength * 0.90),
      },
      {
        label: 'ACERTOS',
        ours: avg(['confianca', 'mentalidade']),
        theirs: Math.round(strength * 0.88),
      },
      {
        label: 'CONFIANÇA',
        ours: Math.min(99, winStreak * 8 + 50),
        theirs: Math.round(strength * 0.82),
      },
    ];

    const v = totalOvr > strength
      ? 'Favoritos. Mantém a pressão.'
      : totalOvr < strength - 5
        ? 'Desafio difícil. Joga pelo contra-ataque.'
        : 'Equilíbrio total. Detalhe decide.';

    const vColor = totalOvr > strength
      ? 'text-green-400'
      : totalOvr < strength - 5
        ? 'text-red-400'
        : 'text-yellow-400';

    return { ourOvr: totalOvr, comparisons: rows, verdict: v, verdictColor: vColor };
  }, [nextFixture, players, lineup, ranking]);

  const verdictColor = useMemo(() => {
    if (!nextFixture) return 'text-white/35';
    const strength = nextFixture.opponent.strength;
    return ourOvr > strength
      ? 'text-green-400'
      : ourOvr < strength - 5
        ? 'text-red-400'
        : 'text-yellow-400';
  }, [ourOvr, nextFixture]);

  if (!nextFixture) return null;

  return (
    <div>
      <SectionHeader label="PRÓXIMO JOGO · ANÁLISE" icon={Trophy} />
      <div
        className="text-white/45 mb-2 tracking-[0.1em]"
        style={{ fontFamily: 'var(--font-display)', fontSize: '8px' }}
      >
        {nextFixture.kickoffLabel} · {nextFixture.competition}
      </div>

      {/* Confronto visual */}
      <div className="flex items-end justify-between mb-3">
        <div className="text-left">
          <div
            className="text-white/85 leading-none tracking-wide uppercase truncate max-w-[80px]"
            style={{ fontFamily: 'var(--font-display)', fontSize: '9px' }}
          >
            {clubName}
          </div>
          <div
            className="tabular-nums italic text-neon-yellow leading-none mt-0.5"
            style={{ fontFamily: 'var(--font-serif-hero)', fontSize: '22px' }}
          >
            {ourOvr}
          </div>
        </div>
        <div
          className="text-white/35 tracking-widest"
          style={{ fontFamily: 'var(--font-display)', fontSize: '9px' }}
        >
          VS
        </div>
        <div className="text-right">
          <div
            className="text-white/85 leading-none tracking-wide uppercase truncate max-w-[80px]"
            style={{ fontFamily: 'var(--font-display)', fontSize: '9px' }}
          >
            {nextFixture.opponent.shortName}
          </div>
          <div
            className="tabular-nums italic text-white/65 leading-none mt-0.5"
            style={{ fontFamily: 'var(--font-serif-hero)', fontSize: '22px' }}
          >
            {nextFixture.opponent.strength}
          </div>
        </div>
      </div>

      {/* Barras de comparação estilo FIFA */}
      <div className="space-y-1.5 mb-2">
        {comparisons.map((row) => {
          const total = row.ours + row.theirs;
          const ourPct = total > 0 ? (row.ours / total) * 100 : 50;
          const theirPct = 100 - ourPct;
          return (
            <div key={row.label}>
              <div
                className="text-center text-white/45 tracking-[0.22em] mb-0.5"
                style={{ fontFamily: 'var(--font-display)', fontSize: '8px' }}
              >
                {row.label}
              </div>
              <div className="flex items-center gap-1">
                <span
                  className="tabular-nums text-white/65 w-5 text-right shrink-0"
                  style={{ fontFamily: 'var(--font-sans)', fontSize: '10px' }}
                >
                  {row.ours}
                </span>
                <div className="flex flex-1 h-1.5 overflow-hidden rounded-full">
                  <div
                    className="h-full bg-neon-yellow"
                    style={{ width: `${ourPct.toFixed(1)}%` }}
                  />
                  <div
                    className="h-full bg-white/30"
                    style={{ width: `${theirPct.toFixed(1)}%` }}
                  />
                </div>
                <span
                  className="tabular-nums text-white/45 w-5 text-left shrink-0"
                  style={{ fontFamily: 'var(--font-sans)', fontSize: '10px' }}
                >
                  {row.theirs}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Veredito */}
      <div
        className={cn('text-center', verdictColor)}
        style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600 }}
      >
        {verdict}
      </div>
    </div>
  );
}

// ─── Widget 5: Mercado ────────────────────────────────────────────────────────

function MarketWidget() {
  const navigate = useNavigate();
  const players = useGameStore((s) => s.players);
  const lineup = useGameStore((s) => s.lineup);

  const picks = useMemo(() => {
    const lineupIds = new Set(Object.values(lineup));
    const all = Object.values(players);
    const listed = all.filter((p) => p.listedOnMarket && !lineupIds.has(p.id));
    const source = listed.length >= 2 ? listed : all.filter((p) => !lineupIds.has(p.id));
    return [...source]
      .sort((a, b) => ovr(b.attrs) - ovr(a.attrs))
      .slice(0, 2);
  }, [players, lineup]);

  return (
    <div>
      <SectionHeader label="MERCADO · IA" icon={Star} />
      {picks.length === 0 ? (
        <p className="text-white/35" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px' }}>
          Nenhum jogador disponível.
        </p>
      ) : (
        <div className="space-y-2 mb-2">
          {picks.map((p) => {
            const playerOvr = ovr(p.attrs);
            return (
              <div
                key={p.id}
                className="flex items-center gap-2 border border-white/10 bg-white/[0.02] px-2 py-1.5"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                {/* Foto ou placeholder */}
                <div
                  className="shrink-0 flex items-center justify-center bg-white/5 border border-white/10"
                  style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)' }}
                >
                  {p.portraitUrl ? (
                    <img
                      src={p.portraitUrl}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      style={{
                        filter: 'grayscale(40%)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    />
                  ) : (
                    <span
                      className="text-neon-yellow font-bold"
                      style={{ fontFamily: 'var(--font-display)', fontSize: '10px' }}
                    >
                      {p.pos}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-white/85 truncate tracking-wide uppercase"
                    style={{ fontFamily: 'var(--font-display)', fontSize: '10px' }}
                  >
                    {p.name}
                  </div>
                  <div
                    className="text-white/45"
                    style={{ fontFamily: 'var(--font-sans)', fontSize: '10px' }}
                  >
                    {p.pos}
                    {p.marketValueExp != null
                      ? ` · ${formatOle(p.marketValueExp)} EXP`
                      : ''}
                  </div>
                </div>
                <div
                  className="tabular-nums italic text-neon-yellow shrink-0"
                  style={{ fontFamily: 'var(--font-serif-hero)', fontSize: '18px' }}
                >
                  {playerOvr}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <button
        type="button"
        onClick={() => navigate('/mercado')}
        className="w-full border border-white/15 bg-white/[0.03] text-white/55 hover:border-neon-yellow/40 hover:text-white/85 transition-all text-center tracking-[0.22em] uppercase"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '9px',
          padding: '6px 0',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        VER MERCADO COMPLETO
      </button>
    </div>
  );
}

// ─── Footer: Chat ─────────────────────────────────────────────────────────────

// ─── Friends (localStorage) ───────────────────────────────────────────────────

const FRIENDS_KEY = 'olefoot-friends-v1';

interface Friend {
  username: string;
}

function loadFriends(): Friend[] {
  try {
    const raw = localStorage.getItem(FRIENDS_KEY);
    return raw ? (JSON.parse(raw) as Friend[]) : [];
  } catch { return []; }
}

function saveFriends(list: Friend[]): void {
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(list));
}

function useFriends() {
  const [friends, setFriends] = useState<Friend[]>(loadFriends);

  const add = useCallback((username: string) => {
    const clean = username.replace(/^@/, '').trim().toLowerCase();
    if (!clean) return false;
    setFriends((prev) => {
      if (prev.some((f) => f.username === clean)) return prev;
      const next = [...prev, { username: clean }];
      saveFriends(next);
      return next;
    });
    return true;
  }, []);

  const remove = useCallback((username: string) => {
    setFriends((prev) => {
      const next = prev.filter((f) => f.username !== username);
      saveFriends(next);
      return next;
    });
  }, []);

  const isFriend = useCallback((username: string) => {
    const clean = username.replace(/^@/, '').trim().toLowerCase();
    return friends.some((f) => f.username === clean);
  }, [friends]);

  return { friends, add, remove, isFriend };
}

// ─── Chat modes ───────────────────────────────────────────────────────────────

type ChatMode = 'coach' | 'manager' | 'support';

const CHAT_TABS: Array<{ mode: ChatMode; Icon: React.ElementType; label: string }> = [
  { mode: 'coach', Icon: MessageCircle, label: 'TREINADOR' },
  { mode: 'manager', Icon: Users, label: 'MANAGER' },
  { mode: 'support', Icon: HeadphonesIcon, label: 'SUPORTE' },
];

// ─── Manager contact picker ───────────────────────────────────────────────────

function ManagerContactPicker({
  friends,
  onSelect,
  onAdd,
  onRemove,
}: {
  friends: Friend[];
  onSelect: (username: string) => void;
  onAdd: (username: string) => boolean;
  onRemove: (username: string) => void;
}) {
  const [addInput, setAddInput] = useState('');
  const [addMode, setAddMode] = useState(false);
  const [addError, setAddError] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleAdd() {
    const clean = addInput.replace(/^@/, '').trim().toLowerCase();
    if (!clean) { setAddError('Digite um @usuário'); return; }
    if (friends.some((f) => f.username === clean)) { setAddError('Já adicionado'); return; }
    setAddBusy(true);
    setAddError('');
    const profile = await findProfileByUsername(clean);
    setAddBusy(false);
    if (!profile) {
      setAddError('Usuário não encontrado');
      return;
    }
    onAdd(profile.username);
    setAddInput('');
    setAddMode(false);
    setAddError('');
  }

  return (
    <div className="space-y-2">
      <p
        className="text-white/45 tracking-[0.18em] uppercase"
        style={{ fontFamily: 'var(--font-display)', fontSize: '9px' }}
      >
        Com quem quer falar?
      </p>

      {friends.length > 0 && (
        <div className="space-y-1 max-h-28 overflow-y-auto">
          {friends.map((f) => (
            <div
              key={f.username}
              className="flex items-center gap-2 group"
            >
              <button
                type="button"
                onClick={() => onSelect(f.username)}
                className="flex flex-1 items-center gap-2 px-2 py-1.5 border border-white/10 bg-white/[0.03] hover:border-neon-yellow/40 hover:bg-neon-yellow/[0.04] transition-all text-left"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <AtSign className="w-3 h-3 text-neon-yellow shrink-0" strokeWidth={2} />
                <span
                  className="flex-1 text-white/75 tabular-nums"
                  style={{ fontFamily: 'var(--font-sans)', fontSize: '11px' }}
                >
                  {f.username}
                </span>
                <ChevronRight className="w-3 h-3 text-white/25 shrink-0" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => onRemove(f.username)}
                className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-red-400 transition-all p-1"
                aria-label="Remover amigo"
              >
                <X className="w-3 h-3" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      {friends.length === 0 && !addMode && (
        <p
          className="text-white/35 py-1"
          style={{ fontFamily: 'var(--font-sans)', fontSize: '11px' }}
        >
          Nenhum amigo adicionado ainda.
        </p>
      )}

      {addMode ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div className="flex flex-1 items-center gap-1 border border-neon-yellow/40 bg-white/[0.04] px-2"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <AtSign className="w-3 h-3 text-neon-yellow/70 shrink-0" strokeWidth={2} />
              <input
                ref={inputRef}
                type="text"
                value={addInput}
                onChange={(e) => { setAddInput(e.target.value); setAddError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); if (e.key === 'Escape') setAddMode(false); }}
                placeholder="nomedeusuario"
                disabled={addBusy}
                className="flex-1 bg-transparent text-white/85 placeholder:text-white/25 outline-none min-w-0"
                style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', padding: '6px 0' }}
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={addBusy}
              className={cn(
                'flex items-center justify-center bg-neon-yellow text-black transition-all shrink-0',
                addBusy ? 'opacity-50' : 'hover:brightness-105 active:scale-[0.97]',
              )}
              style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)' }}
              aria-label="Confirmar"
            >
              {addBusy
                ? <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                : <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
            </button>
            <button
              type="button"
              onClick={() => { setAddMode(false); setAddError(''); setAddInput(''); }}
              className="flex items-center justify-center border border-white/15 text-white/45 hover:text-white/75 transition-all shrink-0"
              style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)' }}
              aria-label="Cancelar"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
          {addError && (
            <p className="text-red-400" style={{ fontFamily: 'var(--font-sans)', fontSize: '10px' }}>
              {addError}
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setAddMode(true); }}
          className="flex items-center gap-1.5 text-white/45 hover:text-neon-yellow transition-colors"
          style={{ fontFamily: 'var(--font-display)', fontSize: '9px', letterSpacing: '0.18em' }}
        >
          <UserPlus className="w-3 h-3" strokeWidth={2} />
          + ADICIONAR AMIGO
        </button>
      )}
    </div>
  );
}

// ─── Chat panel (substitui ChatFooter) ───────────────────────────────────────

function ChatPanel() {
  const navigate = useNavigate();
  const { friends, add, remove, isFriend } = useFriends();

  const [mode, setMode] = useState<ChatMode>('coach');
  const [message, setMessage] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [atInput, setAtInput] = useState('');
  const [atError, setAtError] = useState('');
  const msgRef = useRef<HTMLTextAreaElement>(null);

  function handleTabChange(m: ChatMode) {
    setMode(m);
    setMessage('');
    setSelectedFriend(null);
    setAtInput('');
    setAtError('');
  }

  function handleSend() {
    if (!message.trim()) return;
    if (mode === 'coach') {
      navigate('/coach/chat', { state: { draft: message } });
    } else if (mode === 'manager' && selectedFriend) {
      navigate(`/manager/dm/${selectedFriend}`, { state: { draft: message } });
    } else if (mode === 'support') {
      navigate('/ajuda', { state: { draft: message } });
    }
    setMessage('');
  }

  function handleManagerConfirm() {
    const clean = atInput.replace(/^@/, '').trim().toLowerCase();
    if (!clean) { setAtError('Digite um @usuário'); return; }
    if (!isFriend(clean)) { setAtError('Não é amigo — adicione primeiro'); return; }
    setSelectedFriend(clean);
    setAtError('');
    setAtInput('');
    setTimeout(() => msgRef.current?.focus(), 50);
  }

  const placeholders: Record<ChatMode, string> = {
    coach: 'Pergunta ao treinador…',
    manager: `Mensagem para @${selectedFriend ?? ''}…`,
    support: 'Descreve o problema…',
  };

  const canSend =
    message.trim().length > 0 &&
    (mode !== 'manager' || selectedFriend !== null);

  return (
    <div className="border-t border-white/10 pt-3 space-y-3">
      {/* Tab selector */}
      <div className="flex gap-1">
        {CHAT_TABS.map(({ mode: m, Icon, label }) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => handleTabChange(m)}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2 border transition-all',
                active
                  ? 'border-neon-yellow/60 bg-neon-yellow/[0.07] text-neon-yellow'
                  : 'border-white/10 bg-white/[0.02] text-white/40 hover:border-white/20 hover:text-white/60',
              )}
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={active ? 2.5 : 2} />
              <span
                className="tracking-[0.15em]"
                style={{ fontFamily: 'var(--font-display)', fontSize: '8px' }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Manager: contact picker or selected badge */}
      {mode === 'manager' && !selectedFriend && (
        <ManagerContactPicker
          friends={friends}
          onSelect={(u) => { setSelectedFriend(u); setTimeout(() => msgRef.current?.focus(), 50); }}
          onAdd={add}
          onRemove={remove}
        />
      )}

      {/* Manager: @input manual override (se não tem amigos e quer tentar) */}
      {mode === 'manager' && !selectedFriend && friends.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <div
              className="flex flex-1 items-center gap-1 border border-white/10 bg-white/[0.03] px-2"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <AtSign className="w-3 h-3 text-white/30 shrink-0" strokeWidth={2} />
              <input
                type="text"
                value={atInput}
                onChange={(e) => { setAtInput(e.target.value); setAtError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleManagerConfirm(); }}
                placeholder="ou digitar @usuário"
                className="flex-1 bg-transparent text-white/65 placeholder:text-white/25 outline-none min-w-0"
                style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', padding: '5px 0' }}
              />
              {atInput && (
                <button type="button" onClick={handleManagerConfirm}
                  className="text-neon-yellow hover:brightness-110 transition-all shrink-0">
                  <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
          {atError && (
            <p className="text-red-400" style={{ fontFamily: 'var(--font-sans)', fontSize: '10px' }}>
              {atError}
            </p>
          )}
        </div>
      )}

      {/* Manager: selected friend badge */}
      {mode === 'manager' && selectedFriend && (
        <div className="flex items-center gap-2">
          <div
            className="flex flex-1 items-center gap-1.5 px-2 py-1.5 border border-neon-yellow/30 bg-neon-yellow/[0.05]"
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <AtSign className="w-3 h-3 text-neon-yellow shrink-0" strokeWidth={2} />
            <span
              className="flex-1 text-neon-yellow tabular-nums"
              style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600 }}
            >
              {selectedFriend}
            </span>
            <Check className="w-3 h-3 text-green-400 shrink-0" strokeWidth={2.5} />
          </div>
          <button
            type="button"
            onClick={() => { setSelectedFriend(null); setMessage(''); }}
            className="flex items-center justify-center border border-white/15 text-white/40 hover:text-white/70 transition-all shrink-0"
            style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)' }}
            aria-label="Trocar destinatário"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Message input — só aparece quando pode digitar */}
      {(mode !== 'manager' || selectedFriend) && (
        <div
          className="flex items-end gap-1.5 border border-white/10 bg-white/[0.03] px-2 py-1.5 focus-within:border-neon-yellow/40 transition-colors"
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          <textarea
            ref={msgRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={placeholders[mode]}
            rows={2}
            className="flex-1 bg-transparent text-white/85 placeholder:text-white/25 outline-none resize-none leading-snug min-w-0"
            style={{ fontFamily: 'var(--font-sans)', fontSize: '12px' }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              'flex items-center justify-center shrink-0 mb-0.5 transition-all',
              canSend
                ? 'text-neon-yellow hover:scale-110 active:scale-95'
                : 'text-white/20 cursor-not-allowed',
            )}
            aria-label="Enviar"
          >
            <Send className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Header do hub ────────────────────────────────────────────────────────────

function HubHeader({ onClose }: { onClose?: () => void }) {
  const managerFirst = useGameStore((s) => s.userSettings?.managerProfile?.firstName?.trim() ?? '');
  const clubShort = useGameStore((s) => s.club?.shortName ?? '');
  const expBalance = useGameStore((s) => s.finance.ole);
  const myUsername = useMemo(() => computeUsername(managerFirst, clubShort), [managerFirst, clubShort]);

  return (
    <div className="shrink-0">
      {/* Rail amarelo topo */}
      <span
        aria-hidden
        className="block h-px bg-gradient-to-r from-transparent via-neon-yellow/55 to-transparent"
      />
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-neon-yellow" strokeWidth={2.5} />
            <span
              className="text-white/85 tracking-[0.18em] uppercase"
              style={{ fontFamily: 'var(--font-display)', fontSize: '10px' }}
            >
              OLEFOOT · SMART HUB
            </span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-white/45 hover:text-white transition-colors p-0.5"
              aria-label="Fechar hub"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="min-w-0">
            {managerFirst && (
              <span
                className="italic text-neon-yellow leading-none block"
                style={{ fontFamily: 'var(--font-serif-hero)', fontSize: '16px' }}
              >
                {managerFirst}
              </span>
            )}
            {myUsername && (
              <span
                className="text-white/40 tabular-nums block mt-0.5"
                style={{ fontFamily: 'var(--font-sans)', fontSize: '10px' }}
              >
                @{myUsername}
              </span>
            )}
          </div>
          <span
            className="tabular-nums italic text-neon-yellow ml-auto"
            style={{ fontFamily: 'var(--font-serif-hero)', fontSize: '16px' }}
          >
            {formatOle(expBalance)} EXP
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Hub body (widgets empilhados) ────────────────────────────────────────────

function HubBody({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0D0D0D] border-l border-white/10">
      <HubHeader onClose={onClose} />

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 space-y-5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <NewsWidget />
        <div className="h-px bg-white/[0.06]" />
        <FormWidget />
        <div className="h-px bg-white/[0.06]" />
        <RadarWidget />
        <div className="h-px bg-white/[0.06]" />
        <MatchAnalysisWidget />
        <div className="h-px bg-white/[0.06]" />
        <MarketWidget />
      </div>

      <div className="px-4 pb-4 shrink-0">
        <ChatPanel />
      </div>
    </div>
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/** Painel desktop fixo (xl+), lado direito, w-72, fixed right-0 top-0 h-screen z-40 */
export function OleSmartHubPanel() {
  return (
    <div className="hidden xl:flex fixed right-2 top-2 bottom-2 w-72 z-40 flex-col rounded-xl overflow-hidden">
      <HubBody />
    </div>
  );
}

/** Gaveta mobile, 50vw da direita, z-[81], spring animation */
export function OleSmartHubDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="xl:hidden fixed inset-0 bg-black/70 z-[80] backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="xl:hidden fixed top-0 right-0 bottom-0 z-[81]"
            style={{ width: '50vw', minWidth: 240, maxWidth: 320 }}
          >
            <HubBody onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Botão trigger para abrir no mobile — ícone Zap com dot amarelo pulsante */
export function OleSmartHubTrigger({
  onClick,
  hasActivity,
}: {
  onClick: () => void;
  hasActivity?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="xl:hidden relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-all hover:border-neon-yellow/40 hover:bg-neon-yellow/10 hover:text-neon-yellow"
      aria-label="Abrir Smart Hub"
    >
      <Zap className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2.25} />
      {hasActivity && (
        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-neon-yellow animate-pulse" />
      )}
    </button>
  );
}

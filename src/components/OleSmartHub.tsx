import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
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
  Brain,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  ShieldAlert,
  Timer,
  Dumbbell,
  ArrowRightLeft,
  Crown,
  User,
  Wallet,
  GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameStore } from '@/game/store';
import { useGameDispatch } from '@/game/store';
import { formatOle } from '@/systems/economy';
import { computeUsername, findProfileByUsername } from '@/supabase/managerUsername';
import { chatWithCoach } from '@/coach/coachApi';
import type { TeamContext } from '@/coach/types';
import { useClubConsequences } from '@/hooks/useConsequences';

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
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const club = useGameStore((s) => s.club);

  const headlines = useMemo(() => {
    const items: Array<{ text: string; icon: React.ElementType; color: string }> = [];

    // Headlines da Global League têm prioridade
    if (globalLeagueMVP && globalLeagueMVP.status !== 'waiting_teams') {
      const managerId = managerProfile?.email ?? club?.id;
      const myTeam = managerId
        ? globalLeagueMVP.teams.find((t) => t.managerId === managerId)
        : null;

      if (myTeam) {
        // Subiu/desceu de posição
        if (myTeam.position != null && myTeam.previousPosition != null) {
          const diff = myTeam.previousPosition - myTeam.position;
          if (diff > 0) {
            items.push({
              text: `Subiu ${diff} posição${diff > 1 ? 'ões' : ''} na Liga Global — agora ${myTeam.position}º`,
              icon: TrendingUp,
              color: 'text-green-400',
            });
          } else if (diff < 0) {
            items.push({
              text: `Caiu ${Math.abs(diff)} posição${Math.abs(diff) > 1 ? 'ões' : ''} na Liga Global — ${myTeam.position}º`,
              icon: TrendingDown,
              color: 'text-red-400',
            });
          }
        }

        // Suspensão ativa
        if (myTeam.suspensionRoundsRemaining > 0) {
          items.push({
            text: `Suspensão ativa — perde ${myTeam.suspensionRoundsRemaining} rodada${myTeam.suspensionRoundsRemaining > 1 ? 's' : ''} na Liga Global`,
            icon: ShieldAlert,
            color: 'text-red-400',
          });
        }

        // Lesão ativa
        if (myTeam.injuryRoundsRemaining > 0) {
          const mod = myTeam.injuryModifier < 0 ? myTeam.injuryModifier : -myTeam.injuryModifier;
          items.push({
            text: `Lesão: ${mod} OVR por ${myTeam.injuryRoundsRemaining} rodada${myTeam.injuryRoundsRemaining > 1 ? 's' : ''} na Liga Global`,
            icon: AlertTriangle,
            color: 'text-orange-400',
          });
        }

        // Sequência de vitórias na liga
        const streak = myTeam.recentForm.slice(-3).filter((r) => r === 'W').length;
        if (streak === 3) {
          items.push({
            text: `${myTeam.clubName} em chamas — 3 vitórias seguidas na Liga Global`,
            icon: Flame,
            color: 'text-neon-yellow',
          });
        }
      }
    }

    // Headlines locais como complemento
    const last = results[results.length - 1];
    if (last && items.length < 2) {
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
    if (recentWins >= 3 && items.length < 2) {
      items.push({
        text: `${recentWins} vitórias nos últimos jogos — sequência em chamas`,
        icon: Flame,
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

    return items.slice(0, 2);
  }, [results, form, clubName, globalLeagueMVP, managerProfile, club]);

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
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const club = useGameStore((s) => s.club);

  const globalForm = useMemo(() => {
    if (!globalLeagueMVP || globalLeagueMVP.status === 'waiting_teams') return null;
    const managerId = managerProfile?.email ?? club?.id;
    if (!managerId) return null;
    const myTeam = globalLeagueMVP.teams.find((t) => t.managerId === managerId);
    return myTeam?.recentForm?.slice(-5) ?? null;
  }, [globalLeagueMVP, managerProfile, club]);

  const last5Local = form.slice(-5);
  const hasGlobal = globalForm && globalForm.length > 0;

  return (
    <div>
      <SectionHeader label="FORMA RECENTE" icon={Flame} />

      {/* Liga Global */}
      {hasGlobal && (
        <div className="mb-3">
          <div
            className="text-white/35 tracking-[0.18em] uppercase mb-1.5"
            style={{ fontFamily: 'var(--font-display)', fontSize: '8px' }}
          >
            Liga Global
          </div>
          <div className="flex gap-1.5">
            {globalForm.map((r, i) => (
              <div
                key={i}
                className={cn('flex items-center justify-center rounded-sm shrink-0', formColor(r as 'W' | 'D' | 'L'))}
                style={{ width: 24, height: 24 }}
              >
                <span className="text-black font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: '9px' }}>
                  {formLabel(r as 'W' | 'D' | 'L')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Local */}
      {last5Local.length === 0 && !hasGlobal ? (
        <p className="text-white/35" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px' }}>
          Nenhuma partida jogada.
        </p>
      ) : last5Local.length > 0 ? (
        <div className="mb-3">
          {hasGlobal && (
            <div
              className="text-white/35 tracking-[0.18em] uppercase mb-1.5"
              style={{ fontFamily: 'var(--font-display)', fontSize: '8px' }}
            >
              Local
            </div>
          )}
          <div className="flex gap-1.5">
            {last5Local.map((r, i) => (
              <div
                key={i}
                className={cn('flex items-center justify-center rounded-sm shrink-0', formColor(r))}
                style={{ width: 24, height: 24 }}
              >
                <span className="text-black font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: '9px' }}>
                  {formLabel(r)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

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

// ─── Widget 5: Mercado ────────────────────────────────────────────────────────

function MarketWidget() {
  const navigate = useNavigate();
  const players = useGameStore((s) => s.players);
  const lineup = useGameStore((s) => s.lineup);
  // SCOUTS layer — histórico de mercado pra calcular tendência
  const evolutionTimeline = useGameStore(
    (s) =>
      (s as {
        playerEvolutionTimeline?: Record<
          string,
          Array<{ atIso: string; marketValueBroCents?: number }>
        >;
      }).playerEvolutionTimeline,
  );

  const picks = useMemo(() => {
    const lineupIds = new Set(Object.values(lineup));
    const all = Object.values(players);
    const listed = all.filter((p) => p.listedOnMarket && !lineupIds.has(p.id));
    const source = listed.length >= 2 ? listed : all.filter((p) => !lineupIds.has(p.id));
    return [...source]
      .sort((a, b) => ovr(b.attrs) - ovr(a.attrs))
      .slice(0, 2);
  }, [players, lineup]);

  /**
   * Tendência de mercado por jogador a partir do playerEvolutionTimeline.
   * Compara o marketValueBroCents mais recente com o primeiro snapshot disponível.
   * Retorna pct (positivo = alta, negativo = queda) ou null se sem histórico.
   */
  const trendByPlayer = useMemo(() => {
    const out = new Map<string, number>();
    if (!evolutionTimeline) return out;
    for (const p of picks) {
      const tl = evolutionTimeline[p.id];
      if (!tl || tl.length < 2) continue;
      const withMv = tl.filter((pt) => typeof pt.marketValueBroCents === 'number');
      if (withMv.length < 2) continue;
      const first = withMv[0].marketValueBroCents as number;
      const last = withMv[withMv.length - 1].marketValueBroCents as number;
      if (first <= 0) continue;
      const pct = ((last - first) / first) * 100;
      if (Math.abs(pct) < 1) continue; // ignora ruído <1%
      out.set(p.id, pct);
    }
    return out;
  }, [picks, evolutionTimeline]);

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
                    className="text-white/45 flex items-center gap-1.5"
                    style={{ fontFamily: 'var(--font-sans)', fontSize: '10px' }}
                  >
                    <span className="truncate">
                      {p.pos}
                      {p.marketValueExp != null
                        ? ` · ${formatOle(p.marketValueExp)} EXP`
                        : ''}
                    </span>
                    {/* Tendência de mercado (real, vinda de playerEvolutionTimeline) */}
                    {(() => {
                      const pct = trendByPlayer.get(p.id);
                      if (pct === undefined) return null;
                      const up = pct > 0;
                      const Icon = up ? TrendingUp : TrendingDown;
                      return (
                        <span
                          className={cn(
                            'inline-flex items-center gap-0.5 shrink-0 tabular-nums',
                            up ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]',
                          )}
                          title={`Variação no histórico de mercado: ${up ? '+' : ''}${pct.toFixed(1)}%`}
                        >
                          <Icon size={9} />
                          {up ? '+' : ''}
                          {Math.round(pct)}%
                        </span>
                      );
                    })()}
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

// ─── Coach Inline Chat ────────────────────────────────────────────────────────

const ONBOARDING_QUESTIONS = [
  {
    question: 'Como você prefere jogar?',
    chips: ['Posse de bola', 'Contra-ataque', 'Pressing intenso', 'Jogo direto'],
    category: 'tactics' as const,
  },
  {
    question: 'Qual sua prioridade de desenvolvimento?',
    chips: ['Jovens talentos', 'Resultados imediatos', 'Equilíbrio', 'Construção longa'],
    category: 'training' as const,
  },
  {
    question: 'Como você escala o time?',
    chips: ['Conservador e seguro', 'Arrisco formações novas', 'Depende do adversário'],
    category: 'lineup' as const,
  },
];

function CoachInlineChat() {
  const dispatch = useGameDispatch();
  const coach = useGameStore((s) => s.manager.coach);
  const favoriteRealTeam = useGameStore((s) => s.userSettings?.favoriteRealTeam);
  const players = useGameStore((s) => s.players);
  const finance = useGameStore((s) => s.finance);
  const playerHealth = useGameStore((s) => s.playerHealth);
  // SCOUTS layer — moral, performance, consequências persistentes
  const playerMoral = useGameStore(
    (s) => (s as { playerMoral?: Record<string, { moral?: number; momentum?: number; formStreak?: number }> }).playerMoral,
  );
  const playerSeasonLedger = useGameStore(
    (s) => (s as {
      playerSeasonLedger?: Record<string, {
        matchesPlayed?: number;
        goals?: number;
        assists?: number;
        yellowCards?: number;
        redCards?: number;
      }>;
    }).playerSeasonLedger,
  );
  const consequenceStore = useGameStore((s) => s.consequenceStore);
  const managerTrainingPlans = useGameStore((s) => s.manager?.trainingPlans);
  const managerStaff = useGameStore((s) => s.manager?.staff);
  const results = useGameStore((s) => s.results);
  const form = useGameStore((s) => s.form);
  const nextFixture = useGameStore((s) => s.nextFixture);
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const club = useGameStore((s) => s.club);
  const formationScheme = useGameStore((s) => s.manager?.formationScheme);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [localMessages, setLocalMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [heartTeamAsked, setHeartTeamAsked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const onboardingStep = coach?.memory.onboardingStep ?? -1;
  const isOnboarding = onboardingStep < 3;

  // Pergunta do time do coração: inserida após step 0 se ainda não foi feita
  const heartTeamQuestion = favoriteRealTeam && !heartTeamAsked && onboardingStep >= 0;

  const activeInstructions = coach?.memory.managerInstructions.filter((i) => i.active).length ?? 0;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localMessages, loading]);

  // Monta TeamContext a partir do estado do jogo
  function buildTeamContext(): TeamContext {
    const allPlayers = Object.values(players);

    // Saúde dos jogadores via playerHealth (SSOT)
    let totalFatigue = 0;
    let totalInjuryRisk = 0;
    let injuredCount = 0;
    let suspendedCount = 0;
    for (const p of allPlayers) {
      const h = playerHealth?.[p.id];
      const fatigue = h?.fatigue ?? p.fatigue ?? 0;
      const injuryRisk = h?.injuryRisk ?? p.injuryRisk ?? 0;
      totalFatigue += fatigue;
      totalInjuryRisk += injuryRisk;
      if ((h?.outForMatches ?? p.outForMatches ?? 0) > 0) injuredCount++;
      if ((h?.suspendedMatches ?? 0) > 0) suspendedCount++;
    }
    const avgFatigue = allPlayers.length ? totalFatigue / allPlayers.length : 0;
    const avgInjuryRisk = allPlayers.length ? totalInjuryRisk / allPlayers.length : 0;
    const avgOvr = allPlayers.length
      ? allPlayers.reduce((sum, p) => {
          const vals = Object.values(p.attrs);
          return sum + Math.round(vals.reduce((a: number, b) => a + (b as number), 0) / vals.length);
        }, 0) / allPlayers.length
      : 0;

    // Squad resumido (top 18 por OVR)
    const squadList = [...allPlayers]
      .sort((a, b) => {
        const ovrA = Object.values(a.attrs).reduce((s: number, v) => s + (v as number), 0) / Object.values(a.attrs).length;
        const ovrB = Object.values(b.attrs).reduce((s: number, v) => s + (v as number), 0) / Object.values(b.attrs).length;
        return ovrB - ovrA;
      })
      .slice(0, 18)
      .map((p) => {
        const h = playerHealth?.[p.id];
        const fatigue = h?.fatigue ?? p.fatigue ?? 0;
        const injured = (h?.outForMatches ?? p.outForMatches ?? 0) > 0;
        const vals = Object.values(p.attrs);
        const pOvr = Math.round(vals.reduce((a: number, b) => a + (b as number), 0) / vals.length);
        return { name: p.name, pos: p.pos, ovr: pOvr, fatigue: Math.round(fatigue), injured, age: p.age };
      });

    // Staff
    const staffState = managerStaff;
    const staffLevels = staffState?.roles ?? ({} as any);
    const staffAssignedCount = staffState
      ? Object.values(staffState.assignedByPlayer).reduce((sum, arr) => sum + arr.length, 0)
      : 0;

    // Treinos
    const trainingPlans = managerTrainingPlans ?? [];
    const runningTrainingPlans = trainingPlans.filter((t) => t.status === 'running').length;
    const completedTrainingPlans = trainingPlans.filter((t) => t.status === 'completed').length;

    // Próximo jogo
    let nextMatch: TeamContext['nextMatch'] | undefined;
    if (nextFixture) {
      nextMatch = {
        opponent: nextFixture.opponent?.name ?? nextFixture.opponent?.shortName ?? 'Adversário',
        isHome: nextFixture.isHome ?? true,
        daysUntil: 0,
      };
    }

    // Resultados recentes
    const last5 = results.slice(-5);
    const recentResults = last5.map((r) => ({
      opponent: r.home === (club?.name ?? '') ? r.away : r.home,
      result: r.result as 'win' | 'draw' | 'loss',
      scoreFor: r.result === 'win' ? Math.max(r.scoreHome, r.scoreAway) : r.result === 'loss' ? Math.min(r.scoreHome, r.scoreAway) : r.scoreHome,
      scoreAgainst: r.result === 'win' ? Math.min(r.scoreHome, r.scoreAway) : r.result === 'loss' ? Math.max(r.scoreHome, r.scoreAway) : r.scoreAway,
    }));
    const recentForm = form.slice(-5) as Array<'W' | 'D' | 'L'>;

    // Liga Global MVP
    let leaguePosition: number | undefined;
    let leaguePoints: number | undefined;
    let leagueDivision: number | undefined;
    let leagueMatchesPlayed: number | undefined;
    let leagueWins: number | undefined;
    let leagueDraws: number | undefined;
    let leagueLosses: number | undefined;
    let leagueGoalsFor: number | undefined;
    let leagueGoalsAgainst: number | undefined;
    let leagueSeasonName: string | undefined;
    let leagueStatus: string | undefined;
    let leagueRecentForm: Array<'W' | 'D' | 'L'> | undefined;

    if (globalLeagueMVP) {
      leagueStatus = globalLeagueMVP.status;
      leagueSeasonName = globalLeagueMVP.seasonId;
      // Encontra o time do manager pelo nome do clube
      const myTeam = globalLeagueMVP.teams.find(
        (t) => t.clubName === (club?.name ?? '')
      );
      if (myTeam) {
        leaguePosition = myTeam.position;
        leaguePoints = myTeam.points;
        leagueDivision = myTeam.division;
        leagueMatchesPlayed = myTeam.matchesPlayed;
        leagueWins = myTeam.wins;
        leagueDraws = myTeam.draws;
        leagueLosses = myTeam.losses;
        leagueGoalsFor = myTeam.goalsFor;
        leagueGoalsAgainst = myTeam.goalsAgainst;
        leagueRecentForm = myTeam.recentForm as Array<'W' | 'D' | 'L'>;
      }
    }

    // ─── SCOUTS layer — moral agregada + momentum de forma ──────────
    let totalMoral = 0;
    let moralCount = 0;
    let inGoodForm = 0;
    let inBadForm = 0;
    for (const p of allPlayers) {
      const m = playerMoral?.[p.id];
      if (m && typeof m.moral === 'number') {
        totalMoral += m.moral;
        moralCount++;
      }
      const fs = m?.formStreak ?? 0;
      if (fs >= 3) inGoodForm++;
      else if (fs <= -3) inBadForm++;
    }
    const averageMoral = moralCount > 0 ? Math.round(totalMoral / moralCount) : undefined;
    const formMomentum = moralCount > 0 ? inGoodForm - inBadForm : undefined;

    // ─── Consequências ativas — Coach precisa enxergar pra recomendar ───
    const now = Date.now();
    const activeConsequences = consequenceStore?.active
      ? Object.values(consequenceStore.active).filter((c) => new Date(c.expiresAt).getTime() > now)
      : [];
    let activeAlerts = 0;
    let activeCelebrations = 0;
    const UNAVAILABILITY_KINDS = new Set([
      'red_card_suspension',
      'red_card_suspension_repeat',
      'injury_light_out',
      'injury_medium_out',
      'injury_severe_out',
      'forced_rest',
    ]);
    for (const c of activeConsequences) {
      if (UNAVAILABILITY_KINDS.has(c.kind) || c.magnitude < 0) activeAlerts++;
      else if (c.magnitude > 0) activeCelebrations++;
    }

    // Top 5 jogadores afetados — prioridade pra Coach citar
    const affectedPlayers = activeConsequences
      .filter((c) => c.playerId)
      .map((c) => {
        const p = players[c.playerId!];
        if (!p) return null;
        let kind: 'injury' | 'suspension' | 'low_morale' | 'mvp_streak' | 'market_spike' | 'other' = 'other';
        let detail = c.kind.replace(/_/g, ' ');
        if (c.kind.startsWith('injury_')) {
          kind = 'injury';
          detail = c.kind === 'injury_severe_out' ? 'lesão grave' : c.kind === 'injury_medium_out' ? 'lesão moderada' : 'lesão leve';
        } else if (c.kind.includes('suspension')) {
          kind = 'suspension';
          detail = 'suspenso por cartão';
        } else if (c.kind === 'morale_drop_card' || c.kind === 'morale_drop_heavy_defeat') {
          kind = 'low_morale';
          detail = 'moral abalada';
        } else if (c.kind === 'morale_boost_mvp' || c.kind === 'morale_boost_hat_trick') {
          kind = 'mvp_streak';
          detail = c.kind === 'morale_boost_hat_trick' ? 'hat-trick recente' : 'eleito MVP';
        } else if (c.kind === 'market_interest_spike' || c.kind === 'market_value_boost_mvp') {
          kind = 'market_spike';
          detail = 'valor de mercado em alta';
        }
        return {
          name: p.name,
          pos: p.pos,
          kind,
          detail,
          msUntilExpiry: new Date(c.expiresAt).getTime() - now,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => {
        // Negativos primeiro, depois positivos, depois por urgência (menos tempo restante)
        const aNeg = a.kind === 'injury' || a.kind === 'suspension' || a.kind === 'low_morale' ? 1 : 0;
        const bNeg = b.kind === 'injury' || b.kind === 'suspension' || b.kind === 'low_morale' ? 1 : 0;
        if (aNeg !== bNeg) return bNeg - aNeg;
        return a.msUntilExpiry - b.msUntilExpiry;
      })
      .slice(0, 5);

    // Stats acumulados dos top 5 por OVR — Coach pode citar artilheiro/líder de assists
    const topByOvr = [...allPlayers]
      .map((p) => {
        const vals = Object.values(p.attrs);
        const pOvr = vals.reduce((a: number, b) => a + (b as number), 0) / vals.length;
        return { p, ovr: pOvr };
      })
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, 5);
    const topPlayerSeasonStats = topByOvr
      .map(({ p }) => {
        const L = playerSeasonLedger?.[p.id];
        if (!L || (L.matchesPlayed ?? 0) === 0) return null;
        return {
          name: p.name,
          goals: L.goals ?? 0,
          assists: L.assists ?? 0,
          matchesPlayed: L.matchesPlayed ?? 0,
          yellowCards: L.yellowCards ?? 0,
          redCards: L.redCards ?? 0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return {
      totalPlayers: allPlayers.length,
      injuredPlayers: injuredCount,
      suspendedPlayers: suspendedCount,
      averageFatigue: Math.round(avgFatigue),
      averageInjuryRisk: Math.round(avgInjuryRisk),
      averageOverall: Math.round(avgOvr),
      squadList,
      formation: formationScheme ?? undefined,
      staffLevels,
      staffSlotsAvailable: 0,
      staffAssignedCount,
      runningTrainingPlans,
      completedTrainingPlans,
      trainingCenterLevel: 1,
      availableExp: finance.ole ?? 0,
      availableBro: finance.broCents ?? 0,
      favoriteTeam: favoriteRealTeam?.name,
      nextMatch,
      recentResults,
      recentForm,
      leaguePosition,
      leaguePoints,
      leagueDivision,
      leagueMatchesPlayed,
      leagueWins,
      leagueDraws,
      leagueLosses,
      leagueGoalsFor,
      leagueGoalsAgainst,
      leagueSeasonName,
      leagueStatus,
      leagueRecentForm,
      clubName: club?.name,
      managerName: undefined,
      // SCOUTS context
      averageMoral,
      formMomentum,
      activeAlerts,
      activeCelebrations,
      affectedPlayers: affectedPlayers.length > 0 ? affectedPlayers : undefined,
      topPlayerSeasonStats: topPlayerSeasonStats.length > 0 ? topPlayerSeasonStats : undefined,
    };
  }

  async function sendMessage(text: string) {
    if (!coach || !text.trim() || loading) return;
    const userMsg = text.trim();
    setInput('');
    setLoading(true);

    const userEntry = { role: 'user' as const, content: userMsg };
    setLocalMessages((prev) => [...prev, userEntry]);

    dispatch({ type: 'COACH_ADD_MESSAGE', message: { role: 'user', content: userMsg, timestamp: Date.now() } });

    const history = [
      ...(coach.conversationContext ?? []).slice(-10).map((m) => ({ role: m.role, content: m.content })),
      ...localMessages.slice(-6),
    ];

    const res = await chatWithCoach(coach, buildTeamContext(), userMsg, history);
    setLoading(false);

    if (!res.ok || !res.response) {
      const errMsg = res.error ?? 'Erro ao conectar com o servidor.';
      setLocalMessages((prev) => [...prev, { role: 'assistant', content: errMsg }]);
      return;
    }

    const assistantMsg = res.response;
    setLocalMessages((prev) => [...prev, { role: 'assistant', content: assistantMsg }]);
    dispatch({ type: 'COACH_ADD_MESSAGE', message: { role: 'assistant', content: assistantMsg, timestamp: Date.now() } });

    // Persiste instrução se o backend detectou uma
    if (res.instruction) {
      dispatch({
        type: 'COACH_ADD_INSTRUCTION',
        instruction: res.instruction.instruction,
        context: res.instruction.category === 'training' ? 'Conversa sobre treinos'
          : res.instruction.category === 'tactics' ? 'Conversa sobre táticas'
          : res.instruction.category === 'lineup' ? 'Conversa sobre escalação'
          : 'Conversa com o manager',
        priority: res.instruction.priority,
        category: res.instruction.category,
      });
    }
  }

  async function handleOnboardingAnswer(text: string, stepIndex: number) {
    if (!coach) return;

    // Persiste a resposta como instrução
    const q = ONBOARDING_QUESTIONS[stepIndex];
    if (q) {
      dispatch({
        type: 'COACH_ADD_INSTRUCTION',
        instruction: text,
        context: `Onboarding — ${q.question}`,
        priority: 'high',
        category: q.category,
      });
    }

    // Avança o step
    dispatch({ type: 'COACH_SET_ONBOARDING_STEP', step: stepIndex + 1 });

    await sendMessage(text);
  }

  async function handleHeartTeamAnswer(text: string) {
    setHeartTeamAsked(true);
    if (favoriteRealTeam && text.toLowerCase().includes('sim')) {
      dispatch({
        type: 'COACH_ADD_INSTRUCTION',
        instruction: `Inspirar estilo de jogo no ${favoriteRealTeam.name}`,
        context: 'Onboarding — time do coração',
        priority: 'high',
        category: 'tactics',
      });
    }
    await sendMessage(text);
  }

  // Determina qual pergunta de onboarding mostrar
  function getCurrentOnboardingQuestion(): { question: string; chips: string[]; isHeartTeam: boolean } | null {
    if (!isOnboarding) return null;
    if (heartTeamQuestion && onboardingStep >= 1) {
      return {
        question: `Vi que você torce para o ${favoriteRealTeam!.name}. Quer que eu inspire o estilo de jogo do seu time do coração nas sugestões táticas?`,
        chips: ['Sim, quero!', 'Não por enquanto'],
        isHeartTeam: true,
      };
    }
    const q = ONBOARDING_QUESTIONS[onboardingStep === -1 ? 0 : onboardingStep];
    if (!q) return null;
    return { ...q, isHeartTeam: false };
  }

  const currentQ = getCurrentOnboardingQuestion();
  const effectiveStep = onboardingStep === -1 ? 0 : onboardingStep;

  return (
    <div className="flex flex-col gap-2">
      {/* Knowledge badge */}
      {activeInstructions > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 border border-neon-yellow/20 bg-neon-yellow/[0.04]"
          style={{ borderRadius: 'var(--radius-sm)' }}>
          <Brain className="w-3 h-3 text-neon-yellow shrink-0" strokeWidth={2} />
          <span className="text-neon-yellow/80" style={{ fontFamily: 'var(--font-sans)', fontSize: '10px' }}>
            {activeInstructions} instrução{activeInstructions !== 1 ? 'ões' : ''} aprendida{activeInstructions !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Onboarding: pergunta atual + chips */}
      {isOnboarding && currentQ && (
        <div className="space-y-2">
          {/* Progresso */}
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn(
                  'flex-1 h-0.5 rounded-full transition-all',
                  i < effectiveStep ? 'bg-neon-yellow' : i === effectiveStep ? 'bg-neon-yellow/50' : 'bg-white/10',
                )}
              />
            ))}
          </div>

          {/* Pergunta do coach */}
          <div className="px-2.5 py-2 border border-white/10 bg-white/[0.03]"
            style={{ borderRadius: 'var(--radius-sm)' }}>
            <p className="text-white/80 leading-snug" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px' }}>
              {localMessages.length === 0
                ? currentQ.question
                : localMessages[localMessages.length - 1]?.role === 'assistant'
                  ? localMessages[localMessages.length - 1]!.content
                  : currentQ.question}
            </p>
          </div>

          {/* Chips de resposta rápida */}
          {!loading && (
            <div className="flex flex-wrap gap-1">
              {currentQ.chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => currentQ.isHeartTeam ? handleHeartTeamAnswer(chip) : handleOnboardingAnswer(chip, effectiveStep)}
                  className="px-2 py-1 border border-white/15 bg-white/[0.04] text-white/65 hover:border-neon-yellow/50 hover:text-neon-yellow/90 hover:bg-neon-yellow/[0.06] transition-all"
                  style={{ borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-sans)', fontSize: '10px' }}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-1.5 text-white/40">
              <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px' }}>Treinador respondendo…</span>
            </div>
          )}
        </div>
      )}

      {/* Chat livre (pós-onboarding) */}
      {!isOnboarding && (
        <div className="space-y-2">
          {/* Histórico de mensagens */}
          <div
            ref={scrollRef}
            className="flex flex-col gap-1.5 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            style={{ maxHeight: 180 }}
          >
            {localMessages.slice(-12).map((m, i) => (
              <div
                key={i}
                className={cn(
                  'px-2.5 py-1.5 leading-snug',
                  m.role === 'user'
                    ? 'self-end border border-neon-yellow/25 bg-neon-yellow/[0.06] text-white/85 ml-4'
                    : 'self-start border border-white/10 bg-white/[0.03] text-white/70 mr-4',
                )}
                style={{ borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-sans)', fontSize: '11px', maxWidth: '90%' }}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="self-start flex items-center gap-1.5 px-2.5 py-1.5 border border-white/10 bg-white/[0.03]"
                style={{ borderRadius: 'var(--radius-sm)' }}>
                <Loader2 className="w-3 h-3 animate-spin text-white/40" strokeWidth={2} />
                <span className="text-white/35" style={{ fontFamily: 'var(--font-sans)', fontSize: '10px' }}>digitando…</span>
              </div>
            )}
          </div>

          {localMessages.length === 0 && !loading && (
            <p className="text-white/30 text-center" style={{ fontFamily: 'var(--font-sans)', fontSize: '10px' }}>
              Pergunte qualquer coisa ao seu treinador
            </p>
          )}
        </div>
      )}

      {/* Input — aparece sempre (onboarding: texto livre opcional; chat: principal) */}
      <div
        className="flex items-end gap-1.5 border border-white/10 bg-white/[0.03] px-2 py-1.5 focus-within:border-neon-yellow/40 transition-colors"
        style={{ borderRadius: 'var(--radius-sm)' }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (isOnboarding && currentQ) {
                if (input.trim()) {
                  currentQ.isHeartTeam ? handleHeartTeamAnswer(input) : handleOnboardingAnswer(input, effectiveStep);
                }
              } else {
                sendMessage(input);
              }
            }
          }}
          placeholder={isOnboarding ? 'Ou escreva sua resposta…' : 'Fale com seu treinador…'}
          rows={2}
          disabled={loading}
          className="flex-1 bg-transparent text-white/85 placeholder:text-white/25 outline-none resize-none leading-snug min-w-0 disabled:opacity-50"
          style={{ fontFamily: 'var(--font-sans)', fontSize: '12px' }}
        />
        <button
          type="button"
          onClick={() => {
            if (!input.trim()) return;
            if (isOnboarding && currentQ) {
              currentQ.isHeartTeam ? handleHeartTeamAnswer(input) : handleOnboardingAnswer(input, effectiveStep);
            } else {
              sendMessage(input);
            }
          }}
          disabled={!input.trim() || loading}
          className={cn(
            'flex items-center justify-center shrink-0 mb-0.5 transition-all',
            input.trim() && !loading
              ? 'text-neon-yellow hover:scale-110 active:scale-95'
              : 'text-white/20 cursor-not-allowed',
          )}
          aria-label="Enviar"
        >
          <Send className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ─── Chat modes ───────────────────────────────────────────────────────────────

type ChatMode = 'coach' | 'manager' | 'support';

const CHAT_TABS: Array<{ mode: ChatMode; Icon: React.ElementType; label: string }> = [
  { mode: 'coach', Icon: MessageCircle, label: 'TREINADOR' },
  { mode: 'manager', Icon: Users, label: 'MANAGER' },
  { mode: 'support', Icon: HeadphonesIcon, label: 'ASSIST+' },
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
        <div className="space-y-1 max-h-28 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
  const activeInstructions = useGameStore(
    (s) => s.manager.coach?.memory.managerInstructions.filter((i) => i.active).length ?? 0,
  );

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
    if (mode === 'manager' && selectedFriend) {
      navigate('/manager/mensagens', { state: { draft: message, to: selectedFriend } });
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
    coach: 'Fale com seu treinador…',
    manager: `Mensagem para @${selectedFriend ?? ''}…`,
    support: 'Descreve o problema…',
  };

  const canSend =
    message.trim().length > 0 &&
    (mode === 'support' || (mode === 'manager' && selectedFriend !== null));

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
                'flex flex-1 flex-col items-center gap-1 py-2 border transition-all relative',
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
              {/* Badge de conhecimento no tab do treinador */}
              {m === 'coach' && activeInstructions > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex items-center justify-center bg-neon-yellow text-black font-bold rounded-full"
                  style={{ width: 14, height: 14, fontFamily: 'var(--font-display)', fontSize: '7px' }}
                >
                  {activeInstructions > 9 ? '9+' : activeInstructions}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Coach: chat inline */}
      {mode === 'coach' && <CoachInlineChat />}

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

      {/* Message input — só para support e manager (coach tem CoachInlineChat) */}
      {(mode === 'support' || (mode === 'manager' && selectedFriend)) && (
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

// ─── SCOUTS Status Widget (Legacy Tech) ───────────────────────────────
//
// Eco do painel /manager/scouts no canto do Hub: lê o consequenceStore
// LOCAL (sempre disponível, sem fetch HTTP) e mostra contagens reais
// em tempo real. Clique → vai pro SCOUTS.

const UNAVAILABILITY_KINDS_HUB = new Set([
  'red_card_suspension',
  'red_card_suspension_repeat',
  'injury_light_out',
  'injury_medium_out',
  'injury_severe_out',
  'forced_rest',
]);

function ScoutsStatusWidget() {
  const navigate = useNavigate();
  const consequences = useClubConsequences();
  const players = useGameStore((s) => s.players);

  const { total, unavailable, alerts, celebrations, mostUrgent } = useMemo(() => {
    let alerts = 0;
    let celebrations = 0;
    const unavailableSet = new Set<string>();
    let mostUrgent: { name: string; kind: string; msUntilExpiry: number } | null = null;
    for (const e of consequences) {
      const c = e.consequence;
      if (UNAVAILABILITY_KINDS_HUB.has(c.kind) && c.playerId) {
        unavailableSet.add(c.playerId);
      }
      if (UNAVAILABILITY_KINDS_HUB.has(c.kind) || c.magnitude < 0) {
        alerts++;
        if (!mostUrgent || e.msUntilExpiry < mostUrgent.msUntilExpiry) {
          mostUrgent = {
            name: c.playerId ? (players[c.playerId]?.name ?? 'Jogador') : 'Clube',
            kind: c.kind,
            msUntilExpiry: e.msUntilExpiry,
          };
        }
      } else if (c.magnitude > 0) {
        celebrations++;
      }
    }
    return {
      total: consequences.length,
      unavailable: unavailableSet.size,
      alerts,
      celebrations,
      mostUrgent,
    };
  }, [consequences, players]);

  // Não mostra widget se nada está acontecendo
  if (total === 0) return null;

  const railColor =
    unavailable > 0
      ? 'border-l-[var(--color-danger)]'
      : alerts > 0
        ? 'border-l-[var(--color-warning)]'
        : 'border-l-neon-yellow';

  return (
    <motion.button
      type="button"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      onClick={() => navigate('/manager/scouts')}
      className={cn(
        'group w-full text-left border border-l-[3px] border-white/10 bg-[var(--color-card)] p-3 transition-all',
        'hover:border-neon-yellow/40',
        railColor,
      )}
      style={{
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      }}
      aria-label="Abrir painel SCOUTS"
    >
      {/* Eyebrow */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span aria-hidden className="block h-px w-4 bg-neon-yellow/55" />
          <span
            className="text-neon-yellow"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '9px',
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
            }}
          >
            Scouts · plantel
          </span>
        </div>
        <ChevronRight
          size={12}
          className="text-white/30 group-hover:text-neon-yellow transition shrink-0"
        />
      </div>

      {/* Counts row — Moret italic nos números */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="flex flex-col items-start">
          <span
            className={cn(
              'leading-none tabular-nums',
              unavailable > 0 ? 'text-[var(--color-danger)]' : 'text-white/70',
            )}
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontWeight: 700,
              fontSize: '22px',
              letterSpacing: '-0.03em',
            }}
          >
            {unavailable}
          </span>
          <span
            className="text-white/45 mt-1"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '8px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            Fora
          </span>
        </div>
        <div className="flex flex-col items-start">
          <span
            className={cn(
              'leading-none tabular-nums',
              alerts > 3
                ? 'text-[var(--color-danger)]'
                : alerts > 0
                  ? 'text-[var(--color-warning)]'
                  : 'text-white/70',
            )}
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontWeight: 700,
              fontSize: '22px',
              letterSpacing: '-0.03em',
            }}
          >
            {alerts}
          </span>
          <span
            className="text-white/45 mt-1"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '8px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            Alertas
          </span>
        </div>
        <div className="flex flex-col items-start">
          <span
            className={cn(
              'leading-none tabular-nums',
              celebrations > 0 ? 'text-[var(--color-success)]' : 'text-white/70',
            )}
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontStyle: 'italic',
              fontWeight: 700,
              fontSize: '22px',
              letterSpacing: '-0.03em',
            }}
          >
            {celebrations}
          </span>
          <span
            className="text-white/45 mt-1"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '8px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            Em alta
          </span>
        </div>
      </div>

      {/* Hint da consequência mais urgente */}
      {mostUrgent && (
        <div
          className="flex items-center gap-1.5 pt-2 border-t border-white/5 text-white/55"
          style={{ fontFamily: 'var(--font-ui)', fontSize: '10px' }}
        >
          <Timer size={9} className="opacity-50" />
          <span className="truncate">
            <span className="text-white/85">{mostUrgent.name}</span> · expira em{' '}
            <span
              className="text-white/85 tabular-nums"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontStyle: 'italic',
                fontWeight: 700,
              }}
            >
              {mostUrgent.msUntilExpiry < 60_000
                ? '<1m'
                : mostUrgent.msUntilExpiry < 3_600_000
                  ? `${Math.floor(mostUrgent.msUntilExpiry / 60_000)}m`
                  : mostUrgent.msUntilExpiry < 86_400_000
                    ? `${Math.floor(mostUrgent.msUntilExpiry / 3_600_000)}h`
                    : `${Math.floor(mostUrgent.msUntilExpiry / 86_400_000)}d`}
            </span>
          </span>
        </div>
      )}
    </motion.button>
  );
}

// ─── Menu rápido (atalhos pras outras partes do jogo) ────────────────────────

const QUICK_TILES: Array<{ label: string; to: string; Icon: React.ElementType }> = [
  { label: 'Elenco', to: '/clube/elenco', Icon: Users },
  { label: 'Treino', to: '/clube/treino', Icon: Dumbbell },
  { label: 'Mercado', to: '/mercado', Icon: ArrowRightLeft },
  { label: 'Competição', to: '/competicao', Icon: Trophy },
  { label: 'Legends Cup', to: '/legends-cup', Icon: Crown },
  { label: 'Manager', to: '/manager', Icon: User },
  { label: 'Wallet', to: '/wallet', Icon: Wallet },
  { label: 'Academia', to: '/clube/academia', Icon: GraduationCap },
];

function HubQuickMenu() {
  const navigate = useNavigate();
  return (
    <div>
      <SectionHeader label="MENU RÁPIDO" icon={Zap} />
      <div className="grid grid-cols-2 gap-2">
        {QUICK_TILES.map(({ label, to, Icon }) => (
          <motion.button
            key={to}
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(to)}
            className="group flex items-center gap-2.5 border border-white/10 bg-white/[0.03] px-3 transition-all hover:border-neon-yellow/40 hover:-translate-y-0.5 hover:bg-white/[0.05] active:scale-[0.98]"
            style={{ minHeight: 56, borderRadius: 'var(--radius-md)' }}
          >
            <Icon
              className="w-[18px] h-[18px] text-neon-yellow shrink-0 transition-transform group-hover:scale-110"
              strokeWidth={2}
            />
            <span
              className="text-white/70 group-hover:text-white text-left leading-tight tracking-[0.14em] uppercase transition-colors"
              style={{ fontFamily: 'var(--font-display)', fontSize: '9px' }}
            >
              {label}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ─── Card shell (widgets viram cards maiores, respirando) ────────────────────

function HubCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="border border-white/10 bg-[var(--color-card)] p-4"
      style={{ borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
    >
      {children}
    </div>
  );
}

function HubBody({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0D0D0D] border-l border-white/10">
      <HubHeader onClose={onClose} />

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <HubQuickMenu />
        <ScoutsStatusWidget />
        <HubCard>
          <RadarWidget />
        </HubCard>
        <HubCard>
          <FormWidget />
        </HubCard>
        <HubCard>
          <NewsWidget />
        </HubCard>
        <HubCard>
          <MarketWidget />
        </HubCard>
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

/** Gaveta mobile, min(88vw, 380px) da direita, z-[81], spring animation */
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
            style={{ width: 'min(88vw, 380px)' }}
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

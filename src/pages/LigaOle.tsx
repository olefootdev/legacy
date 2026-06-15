/**
 * LigaOle — hub da Liga Ole (mata-mata de 32 times reais).
 *
 * Visual no SISTEMA EDITORIAL Olefoot (Legacy Tech): Hero amarelo no padrão
 * Crown Jewel (eyebrow Agency + Moret italic gigante + régua + caption), section
 * headers com rail amarelo + Moret italic, e o confronto como peça editorial.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Trophy, Swords, ChevronRight, ShieldX, Flame, Crown, CalendarDays, Skull, Medal } from 'lucide-react';
import { useGameStore, useGameDispatch } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import { getEffectiveFatigue } from '@/systems/fatigue';
import { fetchOpponentRoster } from '@/match/opponentRosterClient';
import { fetchLigaOleRivals } from '@/match/ligaOle/fetchLigaOleTeams';
import {
  createLigaOle,
  managerOpponent,
  roundMatches,
  availableRoundCount,
  ligaOleRoundReward,
  dinastiaMultiplier,
  dinastiaLabel,
  LIGA_OLE_ROUNDS,
  type LigaOleTeam,
  type LigaOleState,
  type LigaOleRoundMatch,
} from '@/match/ligaOle/ligaOleModel';
import { formatCompactNumber } from '@/systems/economy';
import {
  currentWeekKey,
  recordLigaOleWeeklyRun,
  fetchLigaOleWeeklyLeaderboard,
  notifyLigaOleNemesis,
  currentManagerId,
  type LigaOleWeeklyRow,
} from '@/supabase/ligaOleWeekly';
import type { OpponentStub } from '@/entities/types';

const MORET = 'var(--font-serif-hero)';
const roundAbbr = (r: string) => r.replace('Fase de 32', '32-avos').replace('Semifinal', 'Semi');

/** Uma linha de confronto do chaveamento (compacto, mobile). */
function BracketRow({ m }: { m: LigaOleRoundMatch }) {
  const resolved = !!m.result;
  const winner = m.result?.winner;
  const nameStyle = (id: string) => {
    const isManager = id === 'manager' || m.a.isManager && id === m.a.id || m.b.isManager && id === m.b.id;
    const won = resolved && winner === id;
    const lost = resolved && winner !== id;
    return {
      fontFamily: MORET, fontStyle: 'italic' as const, fontWeight: 700,
      fontSize: 'clamp(13px, 3.6vw, 16px)', letterSpacing: '-0.01em',
      color: isManager ? 'var(--color-neon-yellow)' : lost ? 'rgba(255,255,255,0.35)' : '#fff',
      opacity: lost ? 0.8 : 1,
    };
  };
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-2 border-l-[3px]"
      style={{ borderLeftColor: m.isManager ? 'var(--color-neon-yellow)' : 'var(--color-border)', backgroundColor: 'var(--color-deep-black)', borderRadius: 'var(--radius-sm)' }}
    >
      <span className="flex-1 text-right truncate leading-none" style={nameStyle(m.a.id)}>{m.a.name}</span>
      {resolved ? (
        <span className="font-display tabular-nums text-[13px] font-black text-white/75 shrink-0">
          {m.result!.scoreA}<span className="text-white/30 mx-0.5">-</span>{m.result!.scoreB}
        </span>
      ) : (
        <span className="font-display uppercase tracking-[0.12em] text-[9px] font-black text-white/30 shrink-0">vs</span>
      )}
      <span className="flex-1 text-left truncate leading-none" style={nameStyle(m.b.id)}>{m.b.name}</span>
      {m.result?.shootout && <Flame className="w-3 h-3 text-neon-yellow shrink-0" strokeWidth={2.5} aria-hidden />}
    </div>
  );
}

/** Chaveamento COMPACTO (mobile): abas por fase + confrontos da fase escolhida. */
function BracketCompact({ liga }: { liga: LigaOleState }) {
  const total = availableRoundCount(liga);
  const [round, setRound] = useState(liga.roundIndex);
  const matches = roundMatches(liga, round);
  const isCurrent = round === liga.roundIndex;
  return (
    <div className="border p-3" style={{ borderRadius: 'var(--radius-md)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-dark-gray)' }}>
      {/* Abas das fases já existentes (passadas + atual) */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1" style={{ scrollbarWidth: 'none' }}>
        {LIGA_OLE_ROUNDS.slice(0, total).map((r, i) => {
          const sel = i === round;
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRound(i)}
              className="shrink-0 px-2.5 py-1 font-display uppercase tracking-[0.1em] text-[9px] font-black transition-colors"
              style={{ borderRadius: 'var(--radius-sm)', backgroundColor: sel ? 'var(--color-neon-yellow)' : 'transparent', color: sel ? '#000' : 'rgba(255,255,255,0.5)', border: sel ? 'none' : '1px solid var(--color-border)' }}
            >
              {roundAbbr(r)}
            </button>
          );
        })}
      </div>
      <p className="font-display uppercase tracking-[0.2em] text-[8px] font-black text-white/35 mb-2 px-0.5">
        {isCurrent
          ? `${matches.length * 2} clubes ainda na disputa`
          : `Resultados · ${matches.length} ${matches.length === 1 ? 'jogo' : 'jogos'}`}
      </p>
      <div className="flex flex-col gap-1.5">
        {matches.map((m) => <BracketRow key={m.pairIndex} m={m} />)}
      </div>
    </div>
  );
}

/** Hero amarelo — padrão Crown Jewel (eyebrow + Moret gigante + régua + caption). */
function LeagueHero({ eyebrow, title, caption, watermark, icon }: {
  eyebrow: string; title: string; caption: string; watermark?: string; icon?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden bg-neon-yellow px-6 py-7"
      style={{ borderRadius: 'var(--radius-md)', boxShadow: '0 10px 30px rgba(253,225,0,0.20)' }}
    >
      {watermark && (
        <span aria-hidden className="absolute inset-0 grid place-items-center pointer-events-none select-none">
          <span className="font-display font-black uppercase whitespace-nowrap text-black/[0.05]"
            style={{ fontSize: 'clamp(120px, 30vw, 280px)', lineHeight: 0.8, letterSpacing: '-0.02em' }}>
            {watermark}
          </span>
        </span>
      )}
      <div className="relative z-10">
        <p className="font-display uppercase tracking-[0.3em] text-[10px] font-black text-black/70 mb-2">{eyebrow}</p>
        {icon && <div className="mb-2">{icon}</div>}
        <p className="text-black leading-[0.92]"
          style={{ fontFamily: MORET, fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(40px, 12vw, 60px)', letterSpacing: '-0.03em' }}>
          {title}
        </p>
        <span aria-hidden className="block w-12 h-[3px] bg-black/80 mt-3 mb-3" />
        <p className="font-display uppercase tracking-[0.2em] text-[12px] font-black text-black/85">{caption}</p>
      </div>
    </motion.div>
  );
}

/** Section header editorial — rail amarelo 3×ALTO + Moret italic. */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="block w-[3px] h-7 bg-neon-yellow shrink-0" />
      <h2 className="text-neon-yellow" style={{ fontFamily: MORET, fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(22px, 6vw, 30px)', letterSpacing: '-0.01em' }}>
        {children}
      </h2>
    </div>
  );
}

/** Leaderboard da Liga da Semana — quem chegou mais longe (Supabase real). */
function WeeklyLeaderboard({ rows, myId, weekLabel }: { rows: LigaOleWeeklyRow[]; myId: string | null; weekLabel: string }) {
  if (!rows.length) return null;
  const reachedName = (i: number, champ: boolean) => (champ ? 'Campeão' : (LIGA_OLE_ROUNDS[Math.max(0, Math.min(4, i))] ?? '—'));
  return (
    <div className="border p-3" style={{ borderRadius: 'var(--radius-md)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-dark-gray)' }}>
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        <CalendarDays className="w-3.5 h-3.5 text-neon-yellow shrink-0" strokeWidth={2.5} aria-hidden />
        <span className="font-display uppercase tracking-[0.2em] text-[9px] font-black text-white/55">Liga da Semana · {weekLabel} · quem chegou mais longe</span>
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((r) => {
          const mine = !!myId && r.managerId === myId;
          return (
            <div
              key={r.managerId}
              className="flex items-center gap-2.5 px-2.5 py-1.5"
              style={{ borderRadius: 'var(--radius-sm)', backgroundColor: mine ? 'rgba(253,225,0,0.10)' : 'var(--color-deep-black)', border: mine ? '1px solid var(--color-neon-yellow)' : '1px solid transparent' }}
            >
              <span className="font-display tabular-nums text-[11px] font-black w-5 text-center shrink-0" style={{ color: r.rank <= 3 ? 'var(--color-neon-yellow)' : 'rgba(255,255,255,0.4)' }}>{r.rank}</span>
              {r.isChampion
                ? <Crown className="w-3.5 h-3.5 text-neon-yellow shrink-0" strokeWidth={2.5} aria-hidden />
                : <Medal className="w-3.5 h-3.5 text-white/30 shrink-0" strokeWidth={2} aria-hidden />}
              <span className="flex-1 truncate leading-none" style={{ fontFamily: MORET, fontStyle: 'italic', fontWeight: 700, fontSize: '14px', color: mine ? 'var(--color-neon-yellow)' : '#fff' }}>{r.clubName}</span>
              <span className="font-display uppercase tracking-[0.1em] text-[8px] font-black text-white/45 shrink-0">{reachedName(r.reachedRound, r.isChampion)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LigaOle() {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const players = useGameStore((s) => s.players);
  const playerHealth = useGameStore((s) => s.playerHealth);
  const lineup = useGameStore((s) => s.lineup);
  const club = useGameStore((s) => s.club);
  const liga = useGameStore((s) => s.ligaOle);
  const flash = useGameStore((s) => s.ligaOleResultFlash);
  const balance = useGameStore((s) => s.finance.ole);
  const nemesis = useGameStore((s) => s.ligaOleNemesis);
  const titles = useGameStore((s) => s.ligaOleTitles) ?? 0;
  const lastDefeated = useGameStore((s) => s.ligaOleLastDefeated);
  // Só a liga ATIVA dirige a jornada; estados encerrados não assombram o landing.
  const active = liga && liga.status === 'active' ? liga : null;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Aposta da próxima partida (EXP). Dobra na vitória; zera na derrota.
  const [wager, setWager] = useState(0);

  // Liga da Semana — seed global compartilhado por todos + leaderboard real.
  const weekKey = useMemo(() => currentWeekKey(), []);
  const [board, setBoard] = useState<LigaOleWeeklyRow[]>([]);
  const [myId, setMyId] = useState<string | null>(null);

  const managerOverall = useMemo(() => {
    const ids = Object.values(lineup).filter((v): v is string => typeof v === 'string' && !!players[v]);
    const xi = ids.map((id) => players[id]!).slice(0, 11);
    if (!xi.length) return 70;
    const sum = xi.reduce((s, p) => s + (overallFromAttributes(p.attrs) - getEffectiveFatigue(p.id, p, playerHealth) * 0.2), 0);
    return Math.round(sum / xi.length);
  }, [players, lineup, playerHealth]);

  // NÊMESIS (cross-user): venceu um rival real → notifica o derrotado UMA vez.
  useEffect(() => {
    if (!lastDefeated?.managerId) return;
    notifyLigaOleNemesis({ targetManagerId: lastDefeated.managerId, winnerClub: lastDefeated.clubName, round: lastDefeated.round })
      .finally(() => dispatch({ type: 'LIGA_OLE_NEMESIS_NOTIFIED' }));
  }, [lastDefeated?.managerId, lastDefeated?.round, dispatch]);

  // Liga da Semana: registra o avanço da campanha ativa (a RPC guarda a fase mais longe).
  useEffect(() => {
    if (active?.mode === 'weekly' && active.weekKey) {
      recordLigaOleWeeklyRun({ weekKey: active.weekKey, reachedRound: active.roundIndex, isChampion: false, clubName: club.name, clubShort: club.shortName });
    }
  }, [active?.mode, active?.weekKey, active?.roundIndex, club.name, club.shortName]);

  // Liga da Semana: registra o RESULTADO FINAL (campeão/eliminado) da campanha semanal.
  useEffect(() => {
    if (!flash?.weekKey) return;
    const reached = flash.outcome === 'champion' ? 4 : Math.max(0, LIGA_OLE_ROUNDS.indexOf(flash.reachedRound as (typeof LIGA_OLE_ROUNDS)[number]));
    recordLigaOleWeeklyRun({ weekKey: flash.weekKey, reachedRound: reached, isChampion: flash.outcome === 'champion', clubName: flash.clubName, clubShort: club.shortName });
  }, [flash?.weekKey, flash?.outcome, flash?.reachedRound, flash?.clubName, club.shortName]);

  // Leaderboard da semana + meu id (pra destacar minha linha). Recarrega ao mudar de fase.
  useEffect(() => {
    let alive = true;
    fetchLigaOleWeeklyLeaderboard(weekKey, 20).then((r) => { if (alive) setBoard(r); });
    currentManagerId().then((id) => { if (alive) setMyId(id); });
    return () => { alive = false; };
  }, [weekKey, flash?.weekKey, active?.roundIndex]);

  const createLeague = async (mode: 'classic' | 'weekly') => {
    setError(null);
    setBusy(true);
    try {
      const myManagerId = await currentManagerId();
      // weekly → seed GLOBAL da semana (todos pegam o mesmo chaveamento). classic → seed própria.
      const seed = mode === 'weekly' ? `ligaole-week-${weekKey}` : `ligaole-${club.shortName}-${Date.now()}`;
      const rivals = await fetchLigaOleRivals({ excludeShort: club.shortName, excludeName: club.name, excludeManagerId: myManagerId, count: 31, seed });
      if (rivals.length < 31) {
        setError('Ainda não há managers suficientes pra montar a Liga Ole (precisa de 31 rivais reais).');
        setBusy(false);
        return;
      }
      // REVANCHE (só clássica): força o nêmesis no chaveamento se não tiver caído no sorteio.
      if (mode === 'classic' && nemesis && !rivals.some((r) => r.id === nemesis.id)) {
        rivals[rivals.length - 1] = { id: nemesis.id, name: nemesis.name, short: nemesis.short, overall: nemesis.overall, managerId: nemesis.managerId };
      }
      const managerTeam: LigaOleTeam = { id: 'manager', name: club.name, short: club.shortName, overall: managerOverall, isManager: true };
      const built = createLigaOle({ teams: [managerTeam, ...rivals], managerTeamId: 'manager', seed });
      dispatch({ type: 'CREATE_LIGA_OLE', liga: built, mode, weekKey: mode === 'weekly' ? weekKey : undefined });
      setWager(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar a liga.');
    } finally {
      setBusy(false);
    }
  };

  const playNext = async () => {
    if (!active) return;
    const opp = managerOpponent(active);
    if (!opp) return;
    setBusy(true);
    try {
      const roster = await fetchOpponentRoster({ clubName: opp.name, clubShort: opp.short });
      const stub: OpponentStub = {
        id: `ligaole-${opp.id}`,
        name: opp.name,
        shortName: opp.short,
        strength: opp.overall,
        genesisAwayPlayers: roster?.players,
        formationScheme: roster?.formationScheme ?? '4-3-3',
        supporterCrestUrl: null,
      };
      dispatch({ type: 'ADMIN_PATCH_NEXT_FIXTURE', partial: { opponent: stub, awayName: stub.name } });
      dispatch({ type: 'START_LIGA_OLE_MATCH', opponentId: opp.id, wager: Math.min(wager, balance) });
      navigate('/match/quick');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao montar a partida.');
      setBusy(false);
    }
  };

  const reset = () => dispatch({ type: 'RESET_LIGA_OLE' });
  const dismissFlash = () => dispatch({ type: 'DISMISS_LIGA_OLE_RESULT' });
  const opp = active ? managerOpponent(active) : null;
  const pillCls = 'w-full py-4 font-display uppercase tracking-[0.18em] text-[13px] font-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2';
  const pillStyle = { backgroundColor: 'var(--color-neon-yellow)', color: '#000', borderRadius: 'var(--radius-md)' } as const;
  // CTA "Avançar" — usado em DOIS lugares (acima e abaixo do chaveamento) pra
  // ficar sempre à mão no mobile, sem precisar rolar de volta.
  const advanceBtn = (
    <button type="button" disabled={busy || !opp} onClick={playNext} className={pillCls} style={pillStyle}>
      {busy ? 'Preparando a partida…' : <>Avançar <ChevronRight className="w-4 h-4" strokeWidth={3} aria-hidden /></>}
    </button>
  );

  return (
    <main className="min-h-screen bg-black text-white px-5 py-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <Link to="/" className="font-display uppercase tracking-[0.2em] text-[11px] text-white/50 hover:text-white">← Home</Link>
        <span className="font-display uppercase tracking-[0.3em] text-[11px] font-black text-neon-yellow flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden /> Liga Ole
        </span>
      </div>

      {/* ─── LANDING (sem liga ativa) — flash de resultado é TRANSITÓRIO ────── */}
      {!active && (
        <div className="flex flex-col gap-5">
          {/* Resultado da última campanha — só quando ACABOU de acontecer */}
          {flash?.outcome === 'champion' && (
            <LeagueHero
              eyebrow="Liga Ole · Campeão"
              title={flash.clubName}
              caption="Levantou a taça"
              watermark="OLE"
              icon={<Trophy className="w-9 h-9 text-black" strokeWidth={2} aria-hidden />}
            />
          )}
          {flash?.outcome === 'eliminated' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="relative px-6 py-7 border" style={{ borderRadius: 'var(--radius-md)', borderColor: 'var(--color-danger)', backgroundColor: 'var(--color-dark-gray)' }}
            >
              <button type="button" onClick={dismissFlash} aria-label="Fechar" className="absolute top-3 right-4 text-white/40 hover:text-white text-lg leading-none">×</button>
              <p className="font-display uppercase tracking-[0.3em] text-[10px] font-black text-danger mb-2 flex items-center gap-2">
                <ShieldX className="w-4 h-4" strokeWidth={2.5} aria-hidden /> Fim da linha
              </p>
              <p className="text-white leading-[0.95]" style={{ fontFamily: MORET, fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(34px, 10vw, 52px)', letterSpacing: '-0.03em' }}>
                {flash.reachedRound}
              </p>
              <span aria-hidden className="block w-12 h-[3px] bg-white/30 mt-3 mb-3" />
              <p className="font-display uppercase tracking-[0.2em] text-[12px] font-black text-white/55">Eliminado · a taça fica pra próxima</p>
            </motion.div>
          )}

          {/* Convite — sempre presente no landing */}
          {!flash && (
            <LeagueHero
              eyebrow="Mata-mata · 32 clubes"
              title="Seja campeão."
              caption="Só managers reais · 5 confrontos"
              watermark="OLE"
            />
          )}

          {/* DINASTIA — títulos acumulados multiplicam os prêmios das próximas campanhas */}
          {titles > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border" style={{ borderRadius: 'var(--radius-md)', borderColor: 'var(--color-neon-yellow)', backgroundColor: 'var(--color-dark-gray)' }}>
              <span className="flex items-center gap-2.5 min-w-0">
                <Crown className="w-5 h-5 text-neon-yellow shrink-0" strokeWidth={2} aria-hidden />
                <span className="min-w-0">
                  <span className="block font-display uppercase tracking-[0.2em] text-[9px] font-black text-white/45">Dinastia</span>
                  <span className="block truncate text-neon-yellow" style={{ fontFamily: MORET, fontStyle: 'italic', fontWeight: 700, fontSize: '18px' }}>{dinastiaLabel(titles)}</span>
                </span>
              </span>
              <span className="font-display tabular-nums text-[13px] font-black text-neon-yellow shrink-0">prêmios ×{dinastiaMultiplier(titles).toFixed(2)}</span>
            </div>
          )}

          {/* NÊMESIS — quem te eliminou entra na próxima clássica como revanche */}
          {nemesis && (
            <div className="flex items-center gap-2.5 px-4 py-3 border" style={{ borderRadius: 'var(--radius-md)', borderColor: 'var(--color-danger)', backgroundColor: 'var(--color-dark-gray)' }}>
              <Skull className="w-5 h-5 text-danger shrink-0" strokeWidth={2} aria-hidden />
              <p className="text-[12px] text-white/75 leading-snug">
                Nêmesis: <span className="text-white font-semibold" style={{ fontFamily: MORET, fontStyle: 'italic' }}>{nemesis.name}</span> te eliminou na <span className="text-danger">{nemesis.round}</span>. Crie a Liga Ole clássica e cobre a <span className="text-neon-yellow">revanche</span>.
              </p>
            </div>
          )}

          <div>
            <p className="text-white/60 text-[13px] leading-snug mb-3 px-1">
              O sistema sorteia <span className="text-white font-semibold">31 managers reais</span> (com elencos de verdade) + o seu time. Você joga rodada a rodada — Fase de 32, Oitavas, Quartas, Semi e Final. Empatou? <span className="text-neon-yellow">Pênaltis decidem.</span> Perdeu? Acabou. Vença tudo e seja campeão.
            </p>
            {error && <p className="text-danger text-[12px] mb-2 px-1">{error}</p>}
            <div className="flex flex-col gap-2.5">
              <button type="button" disabled={busy} onClick={() => createLeague('classic')} className={pillCls} style={pillStyle}>
                {busy ? 'Sorteando os 32…' : flash ? 'Criar nova Liga Ole' : 'Criar Liga Ole'}
              </button>
              {/* Liga da Semana — mesmo chaveamento pra todos os managers, ranking real */}
              <button
                type="button"
                disabled={busy}
                onClick={() => createLeague('weekly')}
                className="w-full py-3.5 font-display uppercase tracking-[0.18em] text-[12px] font-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2 border"
                style={{ backgroundColor: 'var(--color-dark-gray)', color: 'var(--color-neon-yellow)', borderColor: 'var(--color-neon-yellow)', borderRadius: 'var(--radius-md)' }}
              >
                <CalendarDays className="w-4 h-4" strokeWidth={2.5} aria-hidden /> Liga da Semana
              </button>
              <p className="font-display uppercase tracking-[0.14em] text-[9px] font-black text-white/35 text-center">
                Liga da Semana · {weekKey} · mesmo chaveamento pra todo mundo
              </p>
            </div>
          </div>

          {/* Leaderboard semanal — quem chegou mais longe (cross-user) */}
          <WeeklyLeaderboard rows={board} myId={myId} weekLabel={weekKey} />
        </div>
      )}

      {/* ─── LIGA ATIVA → jornada ─────────────────────────────────────────── */}
      {active && (
        <div className="flex flex-col gap-7">
          {/* A JORNADA: trilha + confronto + ÚNICO CTA */}
          <div className="flex flex-col gap-4">
            <SectionHeader>A Jornada</SectionHeader>

            {/* Trilha das fases */}
            <div className="flex items-stretch gap-1.5">
              {LIGA_OLE_ROUNDS.map((r, i) => {
                const done = i < active.roundIndex;
                const current = i === active.roundIndex;
                return (
                  <div key={r} className="flex-1 text-center">
                    <div className="h-1.5 rounded-full mb-1.5 transition-colors" style={{ backgroundColor: done ? 'var(--color-success)' : current ? 'var(--color-neon-yellow)' : 'rgba(255,255,255,0.12)' }} />
                    <span className="font-display uppercase tracking-[0.06em] text-[8px] font-black leading-tight block" style={{ color: current ? 'var(--color-neon-yellow)' : done ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)' }}>
                      {roundAbbr(r)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Confronto — peça editorial (Moret protagonista) */}
            <div className="relative overflow-hidden border px-5 py-6" style={{ borderRadius: 'var(--radius-md)', borderColor: 'var(--color-neon-yellow)', backgroundColor: 'var(--color-dark-gray)', boxShadow: '0 10px 30px rgba(253,225,0,0.08)' }}>
              {opp && nemesis && opp.id === nemesis.id && (
                <p className="flex items-center justify-center gap-1.5 font-display uppercase tracking-[0.3em] text-[10px] font-black text-danger mb-2">
                  <Skull className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden /> Revanche
                </p>
              )}
              <p className="font-display uppercase tracking-[0.32em] text-[10px] font-black text-neon-yellow text-center mb-4">
                {active.mode === 'weekly' ? 'Liga da Semana · ' : ''}{LIGA_OLE_ROUNDS[active.roundIndex]}
              </p>
              <div className="flex items-center justify-center gap-3">
                <div className="flex-1 text-right min-w-0">
                  <p className="text-neon-yellow truncate leading-[0.95]" style={{ fontFamily: MORET, fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(22px, 6.5vw, 32px)', letterSpacing: '-0.02em' }}>{club.name}</p>
                  <p className="font-display uppercase tracking-[0.18em] text-[9px] font-black text-white/45 mt-1">Força {managerOverall}</p>
                </div>
                <Swords className="w-5 h-5 text-white/35 shrink-0" strokeWidth={2} aria-hidden />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-white truncate leading-[0.95]" style={{ fontFamily: MORET, fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(22px, 6.5vw, 32px)', letterSpacing: '-0.02em' }}>{opp?.name ?? '—'}</p>
                  <p className="font-display uppercase tracking-[0.18em] text-[9px] font-black text-white/45 mt-1">Força {opp?.overall ?? '—'}</p>
                </div>
              </div>
            </div>

            {/* Prêmio da fase + APOSTA (dobra na vitória) */}
            {(() => {
              const prize = ligaOleRoundReward(active.roundIndex);
              const presets = [10_000, 50_000, 250_000, 1_000_000].filter((v) => v <= balance);
              const chips: { label: string; value: number }[] = [
                { label: 'Sem aposta', value: 0 },
                ...presets.map((v) => ({ label: formatCompactNumber(v), value: v })),
              ];
              const staked = Math.min(wager, balance);
              return (
                <div className="flex flex-col gap-3">
                  {/* Prêmio em jogo */}
                  <div className="flex items-center justify-between px-3.5 py-2.5 border" style={{ borderRadius: 'var(--radius-sm)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-deep-black)' }}>
                    <span className="font-display uppercase tracking-[0.18em] text-[9px] font-black text-white/45">
                      {prize.isChampion ? 'Prêmio de TÍTULO' : 'Prêmio da fase'}
                    </span>
                    <span className="font-display tabular-nums text-[14px] font-black text-neon-yellow">
                      +{prize.amount.toLocaleString('pt-BR')} EXP
                    </span>
                  </div>

                  {/* Aposta */}
                  <div className="px-3.5 py-3 border" style={{ borderRadius: 'var(--radius-sm)', borderColor: staked > 0 ? 'var(--color-neon-yellow)' : 'var(--color-border)', backgroundColor: 'var(--color-dark-gray)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-display uppercase tracking-[0.18em] text-[9px] font-black text-white/55">Apostar EXP · paga 2× na vitória</span>
                      <span className="font-display tabular-nums text-[9px] font-black text-white/35">Saldo {formatCompactNumber(balance)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {chips.map((c) => {
                        const sel = staked === c.value;
                        return (
                          <button
                            key={c.label}
                            type="button"
                            disabled={busy}
                            onClick={() => setWager(c.value)}
                            className="px-2.5 py-1.5 font-display uppercase tracking-[0.08em] text-[10px] font-black transition-colors"
                            style={{ borderRadius: 'var(--radius-sm)', backgroundColor: sel ? 'var(--color-neon-yellow)' : 'transparent', color: sel ? '#000' : 'rgba(255,255,255,0.6)', border: sel ? 'none' : '1px solid var(--color-border)' }}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                    {staked > 0 && (
                      <p className="font-display uppercase tracking-[0.12em] text-[10px] font-black text-neon-yellow mt-2.5">
                        Ganhe e leve +{(staked * 2).toLocaleString('pt-BR')} EXP
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

            {error && <p className="text-danger text-[12px] text-center">{error}</p>}

            {advanceBtn}
          </div>

          {/* CHAVEAMENTO — section header no design system (sem ícone) */}
          <div className="flex flex-col gap-3">
            <SectionHeader>Chaveamento</SectionHeader>
            <BracketCompact key={active.roundIndex} liga={active} />
            {/* CTA duplicado embaixo (mobile: à mão sem rolar de volta) */}
            {advanceBtn}
          </div>

          <button type="button" onClick={reset} className="text-white/30 text-[11px] underline self-center hover:text-white/60">
            Desistir da liga
          </button>
        </div>
      )}
    </main>
  );
}

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
import { Trophy, Swords, ChevronRight, ShieldX, Flame, Crown, CalendarDays, Skull, Medal, Share2, Star } from 'lucide-react';
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
import { fetchMyReferralCode } from '@/supabase/referrals';
import { shareImageWithText } from '@/lib/shareImage';
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
      // Lista de confrontos = texto corrido: fonte padrão (Inter), legível e leve.
      // A Moret editorial fica reservada pros heróis e pro confronto em destaque.
      fontFamily: 'var(--font-sans)', fontWeight: 600,
      fontSize: 'clamp(12px, 3.4vw, 15px)', letterSpacing: '0',
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

/**
 * Hero cinematográfico — banner editorial full-bleed (preto+dourado) com texto
 * sobreposto. Scrim de baixo garante legibilidade; texto claro/dourado ancorado
 * no rodapé esquerdo pra não cobrir o manager no centro da imagem.
 */
function CinematicHero({ eyebrow, title, caption, image }: {
  eyebrow: string; title: string; caption: string; image: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden"
      style={{ borderRadius: 'var(--radius-md)', aspectRatio: '3 / 2', boxShadow: '0 10px 30px rgba(0,0,0,0.45)' }}
    >
      <img
        src={image}
        alt=""
        aria-hidden
        loading="eager"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div aria-hidden className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 34%, rgba(0,0,0,0) 62%)' }} />

      <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 px-2.5 py-1"
        style={{ borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(253,225,0,0.45)' }}>
        <Trophy className="h-3.5 w-3.5 text-neon-yellow" strokeWidth={2.5} aria-hidden />
        <span className="font-display uppercase text-neon-yellow" style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.16em' }}>Liga Ole</span>
      </div>

      <div className="absolute inset-x-4 bottom-4 z-10">
        <p className="font-display uppercase mb-1.5" style={{ color: 'var(--color-neon-yellow)', fontSize: '10px', fontWeight: 800, letterSpacing: '0.28em' }}>{eyebrow}</p>
        <p style={{ color: '#f5ead0', fontFamily: MORET, fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(38px, 11vw, 56px)', lineHeight: 0.92, letterSpacing: '-0.03em' }}>{title}</p>
        <span aria-hidden className="block h-[3px] w-11 bg-neon-yellow mt-2.5 mb-2" />
        <p className="font-display uppercase" style={{ color: 'rgba(245,234,208,0.8)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.18em' }}>{caption}</p>
      </div>
    </motion.div>
  );
}

/**
 * Card de campeão VIRAL — pôster `banner-campeao` com texto sobreposto, craque
 * do time, CTA que É o link de indicação do manager, e botão de compartilhar
 * (Web Share API → imagem real + texto + link). Crescimento orgânico: quem
 * clica no texto/CTA cai no /cadastro/<código> e vira indicado.
 */
function ChampionShareCard({ clubName, bestPlayer, referralCode }: {
  clubName: string;
  bestPlayer: { name: string; ovr: number } | null;
  referralCode: string | null;
}) {
  const [shared, setShared] = useState<'idle' | 'done' | 'copied'>('idle');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://game.olefoot.com';
  const referralUrl = referralCode ? `${origin}/cadastro/${referralCode}` : `${origin}/cadastro`;
  const displayUrl = referralUrl.replace(/^https?:\/\//, '');
  const shareMessage =
    `🏆 ${clubName} é CAMPEÃO da Liga Ole no Olefoot!` +
    (bestPlayer ? ` Craque: ${bestPlayer.name} (OVR ${bestPlayer.ovr}).` : '') +
    ` Monta teu time e vem me enfrentar 👉 ${referralUrl}`;

  const onShare = async () => {
    const r = await shareImageWithText({
      imageUrl: '/banner-campeao-liga-ole.png',
      text: shareMessage,
      fileName: 'campeao-liga-ole.png',
      title: 'Campeão da Liga Ole',
    });
    if (r === 'shared') setShared('done');
    else if (r === 'fallback') setShared('copied');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-[340px] overflow-hidden"
        style={{ borderRadius: 'var(--radius-md)', aspectRatio: '9 / 16', border: '2px solid rgba(201,162,39,0.55)', boxShadow: '0 12px 34px rgba(0,0,0,0.5)' }}>
        <img src="/banner-campeao-liga-ole.png" alt={`${clubName} campeão da Liga Ole`} loading="eager"
          className="absolute inset-0 h-full w-full object-cover" />
        <div aria-hidden className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.1) 22%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.35) 64%, rgba(0,0,0,0.92) 100%)' }} />

        <div className="absolute inset-x-4 top-9 z-10">
          <p className="font-display uppercase mb-1" style={{ color: 'var(--color-neon-yellow)', fontSize: '10px', fontWeight: 800, letterSpacing: '0.26em' }}>Liga Ole · Mata-mata dos 32</p>
          <p style={{ color: '#f7ecd2', fontFamily: MORET, fontStyle: 'italic', fontWeight: 700, fontSize: 'clamp(40px, 13vw, 60px)', lineHeight: 0.88, letterSpacing: '-0.03em' }}>É campeão!</p>
          <p className="mt-1.5 text-white" style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '14px' }}>{clubName}</p>
        </div>

        <div className="absolute inset-x-4 bottom-4 z-10">
          {bestPlayer && (
            <div className="inline-flex items-center gap-2 mb-2.5 px-2.5 py-1.5"
              style={{ borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(253,225,0,0.4)' }}>
              <Star className="w-3.5 h-3.5 text-neon-yellow" strokeWidth={2.5} aria-hidden />
              <span style={{ color: '#f7ecd2', fontSize: '11px', fontWeight: 600 }}>Craque: <span className="text-white">{bestPlayer.name}</span> · OVR {bestPlayer.ovr}</span>
            </div>
          )}
          <p className="mb-3" style={{ color: 'rgba(247,236,210,0.82)', fontSize: '11px', lineHeight: 1.5 }}>
            Bati managers reais no chaveamento e levantei a taça. Você também consegue.
          </p>
          <a href={referralUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full"
            style={{ padding: '11px', borderRadius: 'var(--radius-sm)', background: 'var(--color-neon-yellow)', color: '#1a1405', fontWeight: 800, fontSize: '13px', letterSpacing: '0.04em', textDecoration: 'none', fontFamily: 'var(--font-display)' }}>
            <Trophy className="w-4 h-4" strokeWidth={2.5} aria-hidden /> CRIE SEU TIME AGORA
          </a>
          <p className="mt-1.5 text-center" style={{ color: 'rgba(253,225,0,0.85)', fontSize: '10px' }}>{displayUrl}</p>
        </div>
      </div>

      <button type="button" onClick={onShare}
        className="flex items-center justify-center gap-2 w-full max-w-[340px] border"
        style={{ padding: '12px', borderRadius: 'var(--radius-sm)', borderColor: 'var(--color-neon-yellow)', backgroundColor: 'rgba(253,225,0,0.08)', color: 'var(--color-neon-yellow)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '12px', letterSpacing: '0.1em' }}>
        <Share2 className="w-4 h-4" strokeWidth={2.5} aria-hidden />
        {shared === 'done' ? 'COMPARTILHADO!' : shared === 'copied' ? 'LINK COPIADO!' : 'COMPARTILHAR NAS REDES'}
      </button>
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
              <span className="flex-1 truncate leading-none" style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '14px', color: mine ? 'var(--color-neon-yellow)' : '#fff' }}>{r.clubName}</span>
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

  // Card de campeão viral: código de indicação (server) + craque do elenco.
  const [referralCode, setReferralCode] = useState<string | null>(null);
  useEffect(() => {
    if (flash?.outcome !== 'champion') return;
    let alive = true;
    fetchMyReferralCode().then((c) => { if (alive) setReferralCode(c); }).catch(() => {});
    return () => { alive = false; };
  }, [flash?.outcome]);

  const bestPlayer = useMemo(() => {
    const all = Object.values(players ?? {});
    if (!all.length) return null;
    let best = all[0];
    let bestOvr = overallFromAttributes(all[0].attrs);
    for (const p of all) {
      const o = overallFromAttributes(p.attrs);
      if (o > bestOvr) { best = p; bestOvr = o; }
    }
    return { name: best.name, ovr: bestOvr };
  }, [players]);

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
      const norm = (s: string | null | undefined) => String(s ?? '').trim().toLowerCase();
      const managerTeam: LigaOleTeam = { id: 'manager', name: club.name, short: club.shortName, overall: managerOverall, isManager: true };
      const seed = mode === 'weekly' ? `ligaole-week-${weekKey}` : `ligaole-${club.shortName}-${Date.now()}`;
      let teams: LigaOleTeam[];

      if (mode === 'weekly') {
        // CAMPO CANÔNICO de 32 (idêntico pra TODOS): sem auto-exclusão. O manager
        // assume o próprio slot no campo (ou troca o último, se não estiver nele).
        const field = await fetchLigaOleRivals({ count: 32, seed });
        if (field.length < 32) {
          setError('Ainda não há 32 managers reais pra montar a Liga da Semana.');
          setBusy(false);
          return;
        }
        let slot = myManagerId ? field.findIndex((t) => t.managerId && t.managerId === myManagerId) : -1;
        if (slot < 0) slot = field.findIndex((t) => norm(t.short) === norm(club.shortName) || norm(t.name) === norm(club.name));
        if (slot < 0) slot = field.length - 1;
        field[slot] = managerTeam;
        teams = field;
      } else {
        // CLÁSSICA: 31 rivais sorteados em volta do manager (bracket próprio).
        const rivals = await fetchLigaOleRivals({ excludeShort: club.shortName, excludeName: club.name, excludeManagerId: myManagerId, count: 31, seed });
        if (rivals.length < 31) {
          setError('Ainda não há managers suficientes pra montar a Liga Ole (precisa de 31 rivais reais).');
          setBusy(false);
          return;
        }
        // REVANCHE: força o nêmesis no chaveamento se não tiver caído no sorteio.
        if (nemesis && !rivals.some((r) => r.id === nemesis.id)) {
          rivals[rivals.length - 1] = { id: nemesis.id, name: nemesis.name, short: nemesis.short, overall: nemesis.overall, managerId: nemesis.managerId };
        }
        teams = [managerTeam, ...rivals];
      }

      const built = createLigaOle({ teams, managerTeamId: 'manager', seed });
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
            <ChampionShareCard
              clubName={flash.clubName}
              bestPlayer={bestPlayer}
              referralCode={referralCode}
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

          {/* Convite — sempre presente no landing. Hero cinematográfico (banner real). */}
          {!flash && (
            <CinematicHero
              eyebrow="Mata-mata · 32 clubes"
              title="Seja campeão."
              caption="Só managers reais · 5 confrontos"
              image="/banner-inicio-liga-ole.png"
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
                Revanche: <span className="text-white font-semibold" style={{ fontFamily: 'var(--font-sans)' }}>{nemesis.name}</span> te eliminou na <span className="text-danger">{nemesis.round}</span>. Crie a Liga Ole clássica e <span className="text-neon-yellow">cobre essa conta</span>.
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
                  <p className="text-neon-yellow truncate leading-[0.95]" style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 'clamp(20px, 6vw, 30px)', letterSpacing: '-0.01em' }}>{club.name}</p>
                  <p className="font-display uppercase tracking-[0.18em] text-[9px] font-black text-white/45 mt-1">Força {managerOverall}</p>
                </div>
                <Swords className="w-5 h-5 text-white/35 shrink-0" strokeWidth={2} aria-hidden />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-white truncate leading-[0.95]" style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 'clamp(20px, 6vw, 30px)', letterSpacing: '-0.01em' }}>{opp?.name ?? '—'}</p>
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

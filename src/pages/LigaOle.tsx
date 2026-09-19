/**
 * LigaOle — hub da Liga Ole (mata-mata de 32 times reais).
 *
 * VOLT2: superfícies chapadas, manchete Anton, números em Archivo (ole-num),
 * rótulos em mono. Section headers com rail amarelo e o confronto como peça
 * editorial — sem sombra, sem serifa itálica.
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
import { coachPersonaFor, personaLine } from '@/match/ligaOle/coachPersona';
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
import { MomentShareCard } from '@/components/moments/MomentShareCard';
import { detectMoment, stageFromRoundName } from '@/systems/moments';
import { LigaOlePreviewModal } from '@/components/ligaole/LigaOlePreviewModal';
import { CinematicHero } from '@/components/CinematicHero';
import {
  currentWeekKey,
  recordLigaOleWeeklyRun,
  fetchLigaOleWeeklyLeaderboard,
  notifyLigaOleNemesis,
  currentManagerId,
  type LigaOleWeeklyRow,
} from '@/supabase/ligaOleWeekly';
import type { OpponentStub } from '@/entities/types';

/** Fonte de manchete do layer final. (Era serifa itálica.) */
const MANCHETE = 'var(--font-impact)';
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
        <span className="ole-num text-[13px] text-giz shrink-0">
          {m.result!.scoreA}<span className="text-poeira mx-0.5">-</span>{m.result!.scoreB}
        </span>
      ) : (
        <span className="font-mono uppercase tracking-[0.12em] text-[9.5px] text-poeira shrink-0">vs</span>
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
    <div className="border border-white/10 bg-panel p-3">
      {/* Abas das fases já existentes (passadas + atual) */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1" style={{ scrollbarWidth: 'none' }}>
        {LIGA_OLE_ROUNDS.slice(0, total).map((r, i) => {
          const sel = i === round;
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRound(i)}
              className="shrink-0 px-2.5 py-1 font-mono uppercase tracking-[0.1em] text-[10px] font-medium transition-colors"
              style={{ borderRadius: 'var(--radius-sm)', backgroundColor: sel ? 'var(--color-neon-yellow)' : 'transparent', color: sel ? '#000' : 'rgba(255,255,255,0.5)', border: sel ? 'none' : '1px solid var(--color-border)' }}
            >
              {roundAbbr(r)}
            </button>
          );
        })}
      </div>
      <p className="font-mono uppercase tracking-[0.14em] text-[10px] text-cimento mb-2 px-0.5">
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
 * Card de campeão VIRAL — pôster `banner-campeao` com texto sobreposto, craque
 * do time, CTA que É o link de indicação do manager, e botão de compartilhar
 * (Web Share API → imagem real + texto + link). Crescimento orgânico: quem
 * clica no texto/CTA cai no /cadastro/<código> e vira indicado.
 */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="block w-[3px] h-7 bg-neon-yellow shrink-0" />
      <h2 className="text-neon-yellow" style={{ fontFamily: MANCHETE, textTransform: 'uppercase', fontSize: 'clamp(22px, 6vw, 30px)', letterSpacing: '-0.01em' }}>
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
    <div className="border border-white/10 bg-panel p-3">
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        <CalendarDays className="w-3.5 h-3.5 text-neon-yellow shrink-0" strokeWidth={2.5} aria-hidden />
        <span className="truncate font-mono uppercase tracking-[0.12em] text-[10px] text-cimento">Liga da Semana · {weekLabel} · quem chegou mais longe</span>
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((r) => {
          const mine = !!myId && r.managerId === myId;
          return (
            <div
              key={r.managerId}
              className={`flex h-10 items-center gap-2.5 px-2.5 ${mine ? 'bg-neon-yellow text-black' : 'bg-deep-black'}`}
            >
              <span className={`ole-num text-[12px] w-5 text-center shrink-0 ${mine ? 'text-black' : r.rank <= 3 ? 'text-white' : 'text-cimento'}`}>{r.rank}</span>
              {r.isChampion
                ? <Crown className={`w-3.5 h-3.5 shrink-0 ${mine ? 'text-black' : 'text-neon-yellow'}`} strokeWidth={2.5} aria-hidden />
                : <Medal className={`w-3.5 h-3.5 shrink-0 ${mine ? 'text-black/60' : 'text-poeira'}`} strokeWidth={2} aria-hidden />}
              <span className={`flex-1 truncate leading-none text-[14px] ${mine ? 'font-bold text-black' : 'font-semibold text-giz'}`}>{r.clubName}</span>
              <span className={`font-mono uppercase tracking-[0.1em] text-[9.5px] shrink-0 ${mine ? 'text-black/70' : 'text-cimento'}`}>{reachedName(r.reachedRound, r.isChampion)}</span>
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
    // Busca o código sempre que há card pra compartilhar (título OU campanha épica).
    if (!flash) return;
    let alive = true;
    fetchMyReferralCode().then((c) => { if (alive) setReferralCode(c); }).catch(() => {});
    return () => { alive = false; };
  }, [flash]);

  /**
   * MOMENTO da campanha (Fase 2). Antes o card viral só existia no TÍTULO —
   * uma campanha que morria na semifinal não rendia print nenhum. Agora o
   * detector classifica a corrida inteira: chegar longe já é raro, e a fase
   * alcançada entra no peso.
   *
   * Só vira card a partir de ÉPICO (tier >= 2) quando não houve taça. O
   * campeão sempre ganha o card — levantar caneco é o momento por definição.
   */
  const ligaOleMoment = useMemo(() => {
    if (!flash) return null;
    const isTitle = flash.outcome === 'champion';
    const stage = isTitle ? 'final' : stageFromRoundName(flash.reachedRound);
    const m = detectMoment({
      competition: 'liga-ole',
      homeScore: 0, awayScore: 0,
      won: isTitle, draw: false, wasLosing: false,
      possessionHome: 0, shotsHome: 0, bonusCount: 0,
      cleanSheet: false, hattrick: false,
      streak: 0,
      stage,
      isTitle,
    });
    if (isTitle) return m;
    return m.tier >= 2 ? m : null;
  }, [flash]);

  const bestPlayer = useMemo(() => {
    const all = Object.values(players ?? {});
    if (!all.length) return null;
    let best = all[0];
    let bestOvr = overallFromAttributes(all[0].attrs, all[0].pos);
    for (const p of all) {
      const o = overallFromAttributes(p.attrs, p.pos);
      if (o > bestOvr) { best = p; bestOvr = o; }
    }
    return { name: best.name, ovr: bestOvr };
  }, [players]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
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
    const sum = xi.reduce((s, p) => s + (overallFromAttributes(p.attrs, p.pos) - getEffectiveFatigue(p.id, p, playerHealth) * 0.2), 0);
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
  const pillCls = 'ole-num w-full h-[52px] whitespace-nowrap uppercase text-[13px] transition-colors enabled:hover:!bg-white disabled:opacity-50 flex items-center justify-center gap-2 [--corte:12px] [clip-path:var(--clip-corte)]';
  const pillStyle = { backgroundColor: 'var(--color-neon-yellow)', color: '#000' } as const;
  // CTA "Avançar" — usado em DOIS lugares (acima e abaixo do chaveamento) pra
  // ficar sempre à mão no mobile, sem precisar rolar de volta.
  const advanceBtn = (
    <button type="button" disabled={busy || !opp} onClick={() => setPreviewOpen(true)} className={pillCls} style={pillStyle}>
      {busy ? 'Preparando a partida…' : <>Avançar <ChevronRight className="w-4 h-4" strokeWidth={3} aria-hidden /></>}
    </button>
  );

  return (
    <main className="min-h-screen bg-black text-white px-5 py-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <Link to="/" className="font-mono uppercase tracking-[0.14em] text-[11px] text-cimento hover:text-white">← Home</Link>
        <span className="font-mono tracking-[0.04em] text-[11.5px] font-medium text-neon-yellow flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden /> #ligaole
        </span>
      </div>

      {/* ─── LANDING (sem liga ativa) — flash de resultado é TRANSITÓRIO ────── */}
      {!active && (
        <div className="flex flex-col gap-5">
          {/* Resultado da última campanha — só quando ACABOU de acontecer */}
          {ligaOleMoment && (
            <MomentShareCard
              moment={ligaOleMoment}
              clubName={flash!.clubName}
              highlight={bestPlayer ? { label: 'Craque', name: bestPlayer.name, detail: `OVR ${bestPlayer.ovr}` } : null}
              referralCode={referralCode}
              ctaLabel={flash!.outcome === 'champion' ? 'CRIE SEU TIME AGORA' : 'VEM TENTAR TAMBÉM'}
            />
          )}
          {flash?.outcome === 'eliminated' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="relative px-6 py-7 border border-baixa bg-panel"
            >
              <button type="button" onClick={dismissFlash} aria-label="Fechar" className="absolute top-3 right-4 text-cimento hover:text-white text-lg leading-none">×</button>
              <p className="font-mono uppercase tracking-[0.16em] text-[11px] font-medium text-baixa mb-2 flex items-center gap-2">
                <ShieldX className="w-4 h-4" strokeWidth={2.5} aria-hidden /> Fim da linha
              </p>
              <p className="text-white leading-[1.1]" style={{ fontFamily: MANCHETE, textTransform: 'uppercase', fontSize: 'clamp(34px, 10vw, 52px)', letterSpacing: '-0.01em' }}>
                {flash.reachedRound}
              </p>
              <p className="mt-2 font-mono uppercase tracking-[0.14em] text-[11.5px] text-cimento">Eliminado</p>
            </motion.div>
          )}

          {/* Convite — sempre presente no landing. Hero cinematográfico (banner real). */}
          {!flash && (
            <CinematicHero
              badgeLabel="Liga Ole"
              BadgeIcon={Trophy}
              eyebrow="#matamata · 32 clubes"
              title="Seja campeão."
              caption="Só managers reais · 5 confrontos"
              image="/banner-inicio-liga-ole.png"
            />
          )}

          {/* DINASTIA — títulos acumulados multiplicam os prêmios das próximas campanhas */}
          {titles > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 border border-neon-yellow bg-panel">
              <span className="flex items-center gap-2.5 min-w-0">
                <Crown className="w-5 h-5 text-neon-yellow shrink-0" strokeWidth={2} aria-hidden />
                <span className="min-w-0">
                  <span className="block font-mono uppercase tracking-[0.14em] text-[10px] text-cimento">Dinastia</span>
                  <span className="block truncate text-neon-yellow leading-[1.1]" style={{ fontFamily: MANCHETE, textTransform: 'uppercase', fontSize: '20px' }}>{dinastiaLabel(titles)}</span>
                </span>
              </span>
              <span className="ole-num text-[13px] text-neon-yellow shrink-0">prêmios ×{dinastiaMultiplier(titles).toFixed(2)}</span>
            </div>
          )}

          {/* NÊMESIS — quem te eliminou entra na próxima clássica como revanche */}
          {nemesis && (
            <div className="flex items-center gap-2.5 px-4 py-3 border border-baixa bg-panel">
              <Skull className="w-5 h-5 text-baixa shrink-0" strokeWidth={2} aria-hidden />
              <p className="text-[12.5px] text-giz leading-snug">
                Revanche: <span className="text-white font-semibold">{nemesis.name}</span> te eliminou na <span className="text-baixa">{nemesis.round}</span> · volta na Liga Ole clássica.
              </p>
            </div>
          )}

          <div>
            <p className="font-mono text-cimento text-[11.5px] leading-snug mb-3 px-1">
              <span className="text-white">31 managers reais</span> + você · 5 fases · empate vai pros <span className="text-neon-yellow">pênaltis</span> · perdeu, acabou
            </p>
            {error && <p className="text-baixa text-[12px] mb-2 px-1">{error}</p>}
            <div className="flex flex-col gap-2.5">
              <button type="button" disabled={busy} onClick={() => createLeague('classic')} className={pillCls} style={pillStyle}>
                {busy ? 'Sorteando os 32…' : flash ? 'Criar nova Liga Ole' : 'Criar Liga Ole'}
              </button>
              {/* Liga da Semana — mesmo chaveamento pra todos os managers, ranking real */}
              <button
                type="button"
                disabled={busy}
                onClick={() => createLeague('weekly')}
                className="ole-num w-full h-[50px] whitespace-nowrap uppercase text-[13px] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 border border-neon-yellow bg-panel text-neon-yellow hover:bg-card"
              >
                <CalendarDays className="w-4 h-4" strokeWidth={2.5} aria-hidden /> Liga da Semana
              </button>
              <p className="font-mono text-[10.5px] text-cimento text-center">
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
                    <div className="h-1.5 mb-1.5 transition-colors" style={{ backgroundColor: done ? 'var(--color-alta)' : current ? 'var(--color-neon-yellow)' : 'var(--color-card-hi)' }} />
                    <span className="font-mono uppercase tracking-[0.04em] text-[9px] font-medium leading-tight block" style={{ color: current ? 'var(--color-neon-yellow)' : done ? 'var(--color-giz)' : 'var(--color-poeira)' }}>
                      {roundAbbr(r)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Confronto — peça editorial (Moret protagonista) */}
            <div className="relative overflow-hidden border border-neon-yellow bg-panel px-5 py-6">
              {opp && nemesis && opp.id === nemesis.id && (
                <p className="flex items-center justify-center gap-1.5 font-mono uppercase tracking-[0.16em] text-[11px] font-medium text-baixa mb-2">
                  <Skull className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden /> Revanche
                </p>
              )}
              <p className="font-mono uppercase tracking-[0.16em] text-[11px] font-medium text-neon-yellow text-center mb-4">
                {active.mode === 'weekly' ? 'Liga da Semana · ' : ''}{LIGA_OLE_ROUNDS[active.roundIndex]}
              </p>
              <div className="flex items-center justify-center gap-3">
                <div className="flex-1 text-right min-w-0">
                  <p className="text-neon-yellow truncate leading-[0.95]" style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 'clamp(20px, 6vw, 30px)', letterSpacing: '-0.01em' }}>{club.name}</p>
                  <p className="ole-num uppercase text-[10px] text-cimento mt-1">Força {managerOverall}</p>
                </div>
                <Swords className="w-5 h-5 text-poeira shrink-0" strokeWidth={2} aria-hidden />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-white truncate leading-[0.95]" style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 'clamp(20px, 6vw, 30px)', letterSpacing: '-0.01em' }}>{opp?.name ?? '—'}</p>
                  <p className="ole-num uppercase text-[10px] text-cimento mt-1">Força {opp?.overall ?? '—'}</p>
                </div>
              </div>
              {/* FABLE — persona do treinador rival: rosto + provocação pré-jogo.
                  Determinística por teamId (mesmo rival, mesma cara sempre). */}
              {opp && (() => {
                const persona = coachPersonaFor(opp.id);
                const line = personaLine(opp.id, 'pre', LIGA_OLE_ROUNDS[active.roundIndex]);
                return (
                  <p className="text-center text-cimento text-[12px] mt-4">
                    {persona.icon} <span className="font-mono uppercase tracking-[0.12em] text-[10px] text-giz">{persona.label}</span>{' '}
                    — “{line}”
                  </p>
                );
              })()}
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
                  {/* Prêmio em jogo — já com a Dinastia aplicada (igual ao reducer). */}
                  {(() => {
                    const mult = dinastiaMultiplier(titles);
                    const finalPrize = Math.round(prize.amount * mult);
                    return (
                      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border border-white/10 bg-deep-black">
                        <div className="flex min-w-0 flex-col">
                          <span className="font-mono uppercase tracking-[0.14em] text-[10px] text-cimento">
                            {prize.isChampion ? 'Prêmio de título' : 'Prêmio da fase'}
                          </span>
                          {mult > 1 && (
                            <span className="truncate font-mono text-[10px] text-poeira mt-0.5">
                              base {prize.amount.toLocaleString('pt-BR')} × Dinastia {mult.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <span className="ole-num shrink-0 text-[14px] text-neon-yellow">
                          +{finalPrize.toLocaleString('pt-BR')} EXP
                        </span>
                      </div>
                    );
                  })()}

                  {/* Aposta */}
                  <div className="px-3.5 py-3 border bg-panel" style={{ borderColor: staked > 0 ? 'var(--color-neon-yellow)' : 'var(--color-border)' }}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="truncate font-mono uppercase tracking-[0.12em] text-[10px] text-giz">Apostar EXP · paga 2× na vitória</span>
                      <span className="shrink-0 font-mono text-[10px] text-cimento">Saldo {formatCompactNumber(balance)}</span>
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
                            className="ole-num px-2.5 py-1.5 uppercase text-[10.5px] transition-colors"
                            style={{ borderRadius: 'var(--radius-sm)', backgroundColor: sel ? 'var(--color-neon-yellow)' : 'transparent', color: sel ? '#000' : 'rgba(255,255,255,0.6)', border: sel ? 'none' : '1px solid var(--color-border)' }}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                    {staked > 0 && (
                      <div className="grid grid-cols-2 gap-1.5 mt-2.5">
                        <div className="px-2.5 py-2 text-center border border-alta/60 bg-deep-black">
                          <p className="font-mono uppercase tracking-[0.12em] text-[9.5px] text-alta">Vitória</p>
                          <p className="ole-num text-[13px] text-alta">+{(staked * 2).toLocaleString('pt-BR')}</p>
                        </div>
                        <div className="px-2.5 py-2 text-center border border-baixa/60 bg-deep-black">
                          <p className="font-mono uppercase tracking-[0.12em] text-[9.5px] text-baixa">Derrota</p>
                          <p className="ole-num text-[13px] text-baixa">−{staked.toLocaleString('pt-BR')}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {error && <p className="text-baixa text-[12px] text-center">{error}</p>}

            {advanceBtn}
          </div>

          {/* CHAVEAMENTO — section header no design system (sem ícone) */}
          <div className="flex flex-col gap-3">
            <SectionHeader>Chaveamento</SectionHeader>
            <BracketCompact key={active.roundIndex} liga={active} />
            {/* CTA duplicado embaixo (mobile: à mão sem rolar de volta) */}
            {advanceBtn}
          </div>

          <button type="button" onClick={reset} className="font-mono text-poeira text-[11px] underline self-center hover:text-white">
            Desistir da liga
          </button>
        </div>
      )}

      {previewOpen && opp && (
        <LigaOlePreviewModal
          opponentName={opp.name}
          opponentShort={opp.short}
          opponentOverall={opp.overall}
          busy={busy}
          onCancel={() => setPreviewOpen(false)}
          onConfirm={() => {
            setPreviewOpen(false);
            void playNext();
          }}
          onGoToMarket={() => {
            setPreviewOpen(false);
            navigate('/mercado/transfer');
          }}
        />
      )}
    </main>
  );
}

/**
 * LigaOle — hub da Liga Ole (mata-mata de 32 times reais).
 *
 * DS 2027 "Respeito é ouro": o confronto é cartaz de convocação (rua em
 * cima, asfalto embaixo, o "x" na voz), placar em spray, rótulos "— " em mono,
 * Dinastia com fio de ouro (respeito que já existe), revanche em lambe de cal
 * e a Liga da Semana na régua do "quanto falta" da Home.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Trophy, ShieldX, Flame, Crown, CalendarDays, Skull } from 'lucide-react';
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
import { Convocacao } from '@/components/ligaole/Convocacao';
import { BotaoRua, SecaoRua, SeloRua } from '@/components/ui/Rua';
import { cn } from '@/lib/utils';
import {
  currentWeekKey,
  recordLigaOleWeeklyRun,
  fetchLigaOleWeeklyLeaderboard,
  notifyLigaOleNemesis,
  currentManagerId,
  type LigaOleWeeklyRow,
} from '@/supabase/ligaOleWeekly';
import type { OpponentStub } from '@/entities/types';
import { L, LOCALE, emIngles } from '@/i18n/L';


/** Rótulo de TELA das fases — o valor PT (LIGA_OLE_ROUNDS) segue sendo a chave. */
const ROUND_LABEL_EN: Record<string, string> = { 'Fase de 32': 'Round of 32', Oitavas: 'Round of 16', Quartas: 'Quarter-finals', Semifinal: 'Semi-final', Final: 'Final' };
const ROUND_ABBR_EN: Record<string, string> = { 'Fase de 32': 'R32', Oitavas: 'R16', Quartas: 'QF', Semifinal: 'Semi', Final: 'Final' };
const roundLabel = (r: string) => (emIngles() ? ROUND_LABEL_EN[r] ?? r : r);
const roundAbbr = (r: string) => (emIngles() ? ROUND_ABBR_EN[r] ?? r : r.replace('Fase de 32', '32-avos').replace('Semifinal', 'Semi'));

/** Uma linha de confronto do chaveamento: nomes no grito, placar em spray. */
function BracketRow({ m }: { m: LigaOleRoundMatch }) {
  const resolved = !!m.result;
  const winner = m.result?.winner;
  const nameCls = (id: string) => {
    const isManager = id === 'manager' || m.a.isManager && id === m.a.id || m.b.isManager && id === m.b.id;
    const lost = resolved && winner !== id;
    return cn(
      'min-w-0 flex-1 truncate font-impact text-[clamp(14px,4vw,17px)] uppercase leading-none',
      isManager ? 'text-rua' : lost ? 'text-fio line-through decoration-1' : 'text-papel',
    );
  };
  return (
    <div className={cn('flex h-12 min-w-0 items-center gap-2 bg-concreto px-3', m.isManager && 'border-l-[3px] border-rua')}>
      <span className={cn(nameCls(m.a.id), 'text-right')}>{m.a.name}</span>
      <span className="w-14 shrink-0 text-center">
        {resolved ? (
          <span className="font-spray text-[22px] font-black leading-none text-papel">
            {m.result!.scoreA}×{m.result!.scoreB}
          </span>
        ) : (
          <span aria-label={L('contra', 'vs')} className="font-voz text-[22px] leading-none text-fio">x</span>
        )}
      </span>
      <span className={cn(nameCls(m.b.id), 'text-left')}>{m.b.name}</span>
      {m.result?.shootout && (
        <span title={L('Decidido nos pênaltis', 'Decided on penalties')} className="inline-flex shrink-0">
          <Flame className="h-3.5 w-3.5 text-rua" strokeWidth={2.5} aria-label={L('Pênaltis', 'Penalties')} />
        </span>
      )}
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
    <div className="flex min-w-0 flex-col gap-3">
      {/* Abas das fases já existentes (passadas + atual) */}
      <div className="flex min-w-0 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {LIGA_OLE_ROUNDS.slice(0, total).map((r, i) => {
          const sel = i === round;
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRound(i)}
              aria-pressed={sel}
              className={cn(
                'min-h-[36px] shrink-0 px-3 font-prova text-[11px] font-bold uppercase tracking-[0.1em] transition-colors',
                sel ? 'bg-rua text-asfalto-27' : 'border-2 border-linha text-mudo hover:border-papel hover:text-papel',
              )}
            >
              {roundAbbr(r)}
            </button>
          );
        })}
      </div>
      <p className="font-prova text-[11px] font-bold uppercase tracking-[0.14em] text-mudo">
        {isCurrent
          ? L(`${matches.length * 2} clubes ainda na disputa`, `${matches.length * 2} clubs still in contention`)
          : L(`Resultados · ${matches.length} ${matches.length === 1 ? 'jogo' : 'jogos'}`, `Results · ${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`)}
      </p>
      <div className="flex min-w-0 flex-col gap-1.5">
        {matches.map((m) => <BracketRow key={m.pairIndex} m={m} />)}
      </div>
    </div>
  );
}

/**
 * Leaderboard da Liga da Semana — quem chegou mais longe (Supabase real).
 * Mesma régua do "quanto falta" da Home: campeão com fio de ouro, a linha do
 * manager em rua colada torta, o resto no concreto.
 */
function WeeklyLeaderboard({ rows, myId, weekLabel }: { rows: LigaOleWeeklyRow[]; myId: string | null; weekLabel: string }) {
  if (!rows.length) return null;
  const reachedName = (i: number, champ: boolean) => (champ ? L('Campeão', 'Champion') : roundLabel(LIGA_OLE_ROUNDS[Math.max(0, Math.min(4, i))] ?? '—'));
  return (
    <section aria-label={L('Liga da Semana', 'League of the Week')} className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <SecaoRua label={L(`Liga da Semana · ${weekLabel}`, `League of the Week · ${weekLabel}`)} />
        <h2 className="font-voz text-[clamp(34px,9vw,48px)] leading-[0.95] text-papel">{L('Quem foi mais longe', 'Who went furthest')}</h2>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        {rows.map((r) => {
          const mine = !!myId && r.managerId === myId;
          return (
            <div
              key={r.managerId}
              className={cn(
                'flex min-w-0 items-center gap-3 px-4',
                mine && 'relative z-[1] my-1 h-[56px] -rotate-1 bg-rua text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)]',
                !mine && 'h-[50px]',
                !mine && r.isChampion && 'border-2 border-ouro-27 text-ouro-27',
                !mine && !r.isChampion && 'bg-concreto text-papel',
              )}
            >
              <span className="w-10 shrink-0 font-impact text-[20px] leading-none">#{String(r.rank).padStart(2, '0')}</span>
              <span className="block min-w-0 grow truncate font-impact text-[19px] uppercase leading-none">{r.clubName}</span>
              {r.isChampion && <Crown className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />}
              <span className={cn('shrink-0 font-prova text-[10.5px] font-bold uppercase tracking-[0.1em]', !mine && !r.isChampion && 'text-mudo')}>
                {reachedName(r.reachedRound, r.isChampion)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
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
          setError(L('Ainda não há 32 managers reais pra montar a Liga da Semana.', 'There are not yet 32 real managers to build the League of the Week.'));
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
          setError(L('Ainda não há managers suficientes pra montar a Liga Ole (precisa de 31 rivais reais).', 'Not enough managers yet to build the Liga Ole (31 real rivals needed).'));
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
      setError(e instanceof Error ? e.message : L('Falha ao criar a liga.', 'Failed to create the league.'));
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
      setError(e instanceof Error ? e.message : L('Falha ao montar a partida.', 'Failed to set up the match.'));
      setBusy(false);
    }
  };

  const reset = () => dispatch({ type: 'RESET_LIGA_OLE' });
  const dismissFlash = () => dispatch({ type: 'DISMISS_LIGA_OLE_RESULT' });
  const opp = active ? managerOpponent(active) : null;
  // CTA "Avançar" — usado em DOIS lugares (acima e abaixo do chaveamento) pra
  // ficar sempre à mão no mobile, sem precisar rolar de volta.
  const advanceBtn = (
    <BotaoRua disabled={busy || !opp} onClick={() => setPreviewOpen(true)} className="w-full">
      {busy ? L('Preparando a partida…', 'Preparing the match…') : <>{L('Avançar', 'Advance')} <span aria-hidden>→</span></>}
    </BotaoRua>
  );

  return (
    <main className="mx-auto min-h-screen min-w-0 max-w-xl px-4 py-6 text-papel">
      <div className="mb-6 flex min-w-0 items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex min-h-[44px] items-center font-prova text-[11.5px] font-bold uppercase tracking-[0.2em] text-mudo hover:text-papel"
        >
          ← Home
        </Link>
        <span className="flex items-center gap-1.5 font-prova text-[11.5px] font-bold uppercase tracking-[0.2em] text-mudo">
          <Trophy className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> — {L('Mata-mata', 'Knockout')}
        </span>
      </div>

      {/* ─── LANDING (sem liga ativa) — flash de resultado é TRANSITÓRIO ────── */}
      {!active && (
        <div className="flex flex-col gap-8">
          {/* Resultado da última campanha — só quando ACABOU de acontecer */}
          {ligaOleMoment && (
            <MomentShareCard
              moment={ligaOleMoment}
              clubName={flash!.clubName}
              highlight={bestPlayer ? { label: L('Craque', 'Star'), name: bestPlayer.name, detail: `OVR ${bestPlayer.ovr}` } : null}
              referralCode={referralCode}
              ctaLabel={flash!.outcome === 'champion' ? L('CRIE SEU TIME AGORA', 'CREATE YOUR TEAM NOW') : L('VEM TENTAR TAMBÉM', 'COME GIVE IT A TRY')}
            />
          )}
          {flash?.outcome === 'eliminated' && (
            <motion.section
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              aria-label={L('Fim da linha', 'End of the road')}
              className="rua-grao relative flex flex-col gap-2 border-2 border-linha bg-concreto px-5 pb-6 pt-5"
            >
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-prova text-[11.5px] font-bold uppercase tracking-[0.2em] text-mudo">
                  <ShieldX className="h-4 w-4" strokeWidth={2.5} aria-hidden /> {L('Fim da linha', 'End of the road')}
                </span>
                <button
                  type="button"
                  onClick={dismissFlash}
                  aria-label={L('Fechar', 'Close')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center font-impact text-[22px] leading-none text-mudo hover:text-papel"
                >
                  ×
                </button>
              </div>
              <p className="font-impact uppercase leading-[0.86] text-papel" style={{ fontSize: 'clamp(46px, 13vw, 76px)' }}>
                {roundLabel(flash.reachedRound)}
              </p>
              <p className="font-voz text-[clamp(24px,6.5vw,32px)] leading-[1.05] text-papel">
                {L('Caiu aqui. Volta mais forte.', 'Went out here. Come back stronger.')}
              </p>
              <p className="font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-suave">{L('Eliminado', 'Eliminated')}</p>
            </motion.section>
          )}

          {/* Convite — sempre presente no landing. Hero cinematográfico (banner real). */}
          {!flash && (
            <CinematicHero
              badgeLabel="Liga Ole"
              BadgeIcon={Trophy}
              eyebrow={L('#matamata · 32 clubes', '#knockout · 32 clubs')}
              title={L('Seja campeão.', 'Be the champion.')}
              caption={L('Só managers reais · 5 confrontos', 'Real managers only · 5 ties')}
              image="/banner-inicio-liga-ole.png"
            />
          )}

          {/* DINASTIA — títulos acumulados (valor que já existe: RESPEITO, fio de ouro) */}
          {titles > 0 && (
            <section
              aria-label={L('Dinastia', 'Dynasty')}
              className="flex min-w-0 items-center justify-between gap-4 border-[3px] border-ouro-27 bg-asfalto-27 px-4 py-4"
            >
              <span className="flex min-w-0 items-center gap-3">
                <Crown className="h-6 w-6 shrink-0 text-ouro-27" strokeWidth={2} aria-hidden />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.2em] text-mudo">— {L('Dinastia', 'Dynasty')}</span>
                  <span className="block truncate font-voz text-[26px] leading-none text-ouro-27">{dinastiaLabel(titles)}</span>
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span className="font-spray text-[30px] font-black leading-none text-ouro-27">×{dinastiaMultiplier(titles).toFixed(2)}</span>
                <span className="font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo">{L('prêmios', 'prizes')}</span>
              </span>
            </section>
          )}

          {/* NÊMESIS — quem te eliminou entra na próxima clássica: lambe de cal colado torto */}
          {nemesis && (
            <div className="flex min-w-0 rotate-[1deg] items-start gap-3 bg-cal px-4 py-3.5 text-asfalto-27 shadow-[4px_5px_0_rgba(0,0,0,0.55)]">
              <Skull className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              <p className="min-w-0 text-[14px] leading-snug">
                <span className="mb-1 block font-impact text-[18px] uppercase leading-none">{L('Revanche', 'Revenge')}</span>
                {emIngles()
                  ? <><span className="font-semibold">{nemesis.name}</span> knocked you out in the <span className="font-semibold">{roundLabel(nemesis.round)}</span> · back in the classic Liga Ole.</>
                  : <><span className="font-semibold">{nemesis.name}</span> te eliminou na <span className="font-semibold">{nemesis.round}</span> · volta na Liga Ole clássica.</>}
              </p>
            </div>
          )}

          <section aria-label={L('Entrar na Liga Ole', 'Join the Liga Ole')} className="flex min-w-0 flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              <SecaoRua label={L('Regulamento', 'Rules')} />
              <p className="font-voz text-[clamp(26px,7vw,34px)] leading-[1.05] text-papel">
                {L('Perdeu, acabou. Empate vai pros pênaltis.', "Lose and you're out. Draws go to penalties.")}
              </p>
              <p className="font-prova text-[11px] font-bold uppercase leading-snug tracking-[0.12em] text-mudo">
                {L('31 managers reais + você · 5 fases', '31 real managers + you · 5 rounds')}
              </p>
            </div>
            {error && <p role="alert" className="border-l-[3px] border-baixa bg-concreto px-3 py-2.5 text-[13px] text-papel">{error}</p>}
            <div className="flex flex-col gap-3">
              <BotaoRua disabled={busy} onClick={() => createLeague('classic')} className="w-full">
                {busy ? L('Sorteando os 32…', 'Drawing the 32…') : <>{flash ? L('Criar nova Liga Ole', 'Create new Liga Ole') : L('Criar Liga Ole', 'Create Liga Ole')} <span aria-hidden>→</span></>}
              </BotaoRua>
              {/* Liga da Semana — mesmo chaveamento pra todos os managers, ranking real */}
              <BotaoRua variante="contorno" disabled={busy} onClick={() => createLeague('weekly')} className="w-full">
                <CalendarDays className="h-5 w-5" strokeWidth={2.5} aria-hidden /> {L('Liga da Semana', 'League of the Week')}
              </BotaoRua>
              <p className="text-center font-prova text-[10.5px] font-bold uppercase tracking-[0.12em] text-mudo">
                {weekKey} · {L('mesmo chaveamento pra todo mundo', 'same bracket for everyone')}
              </p>
            </div>
          </section>

          {/* Leaderboard semanal — quem chegou mais longe (cross-user) */}
          <WeeklyLeaderboard rows={board} myId={myId} weekLabel={weekKey} />
        </div>
      )}

      {/* ─── LIGA ATIVA → jornada ─────────────────────────────────────────── */}
      {active && (
        <div className="flex flex-col gap-9">
          {/* A JORNADA: trilha + confronto + ÚNICO CTA */}
          <div className="flex flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              <SecaoRua
                label={active.mode === 'weekly' ? L('Liga da Semana · a jornada', 'League of the Week · the journey') : L('Liga Ole · a jornada', 'Liga Ole · the journey')}
                aside={`${String(active.roundIndex + 1).padStart(2, '0')}/${String(LIGA_OLE_ROUNDS.length).padStart(2, '0')}`}
              />
            </div>

            {/* Trilha das fases — segmentos: papel passou, rua é agora, linha falta */}
            <ol aria-label={L('Fases da Liga Ole', 'Liga Ole rounds')} className="flex min-w-0 items-stretch gap-1">
              {LIGA_OLE_ROUNDS.map((r, i) => {
                const done = i < active.roundIndex;
                const current = i === active.roundIndex;
                return (
                  <li key={r} aria-current={current ? 'step' : undefined} className="flex min-w-0 flex-1 flex-col gap-1.5 text-center">
                    <span aria-hidden className={cn('block h-3.5', done ? 'bg-papel' : current ? 'bg-rua' : 'bg-linha')} />
                    <span className={cn('block truncate font-prova text-[9.5px] font-bold uppercase leading-tight tracking-[0.04em]', current ? 'text-rua' : done ? 'text-suave' : 'text-fio')}>
                      {roundAbbr(r)}
                    </span>
                  </li>
                );
              })}
            </ol>

            {/* Confronto — cartaz de convocação */}
            <Convocacao
              ariaLabel={L(`${roundLabel(LIGA_OLE_ROUNDS[active.roundIndex])}: ${club.name} contra ${opp?.name ?? '—'}`, `${roundLabel(LIGA_OLE_ROUNDS[active.roundIndex])}: ${club.name} vs ${opp?.name ?? '—'}`)}
              kicker={`${active.mode === 'weekly' ? L('Liga da Semana', 'League of the Week') : 'Liga Ole'} · ${roundLabel(LIGA_OLE_ROUNDS[active.roundIndex])}`}
              aside={L('Mata-mata', 'Knockout')}
              home={club.name}
              homeMeta={L(`Força ${managerOverall}`, `Strength ${managerOverall}`)}
              away={opp?.name ?? '—'}
              awayMeta={L(`Força ${opp?.overall ?? '—'}`, `Strength ${opp?.overall ?? '—'}`)}
              tag={opp && nemesis && opp.id === nemesis.id ? (
                <SeloRua tom="cal" className="-rotate-2">
                  <Skull className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> {L('Revanche', 'Revenge')}
                </SeloRua>
              ) : undefined}
            >
              {/* FABLE — persona do treinador rival: rosto + provocação pré-jogo.
                  Determinística por teamId (mesmo rival, mesma cara sempre). */}
              {opp && (() => {
                const persona = coachPersonaFor(opp.id);
                const line = personaLine(opp.id, 'pre', LIGA_OLE_ROUNDS[active.roundIndex]);
                return (
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.2em] text-mudo">
                      {persona.icon} — {persona.label}
                    </span>
                    <p className="font-voz text-[clamp(22px,5.6vw,28px)] leading-[1.05] text-papel">“{line}”</p>
                  </div>
                );
              })()}
            </Convocacao>

            {/* Prêmio da fase + APOSTA (dobra na vitória) */}
            {(() => {
              const prize = ligaOleRoundReward(active.roundIndex);
              const presets = [10_000, 50_000, 250_000, 1_000_000].filter((v) => v <= balance);
              const chips: { label: string; value: number }[] = [
                { label: L('Sem aposta', 'No bet'), value: 0 },
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
                      <div className="flex min-w-0 items-end justify-between gap-3 bg-concreto px-4 py-3.5">
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.16em] text-mudo">
                            — {prize.isChampion ? L('Prêmio de título', 'Title prize') : L('Prêmio da fase', 'Round prize')}
                          </span>
                          {mult > 1 && (
                            <span className="truncate font-prova text-[10px] font-bold uppercase tracking-[0.1em] text-ouro-27">
                              base {prize.amount.toLocaleString(LOCALE)} × {L('Dinastia', 'Dynasty')} {mult.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 font-spray text-[clamp(26px,7.5vw,34px)] font-black leading-none text-papel">
                          +{finalPrize.toLocaleString(LOCALE)} <span className="text-[0.6em]">EXP</span>
                        </span>
                      </div>
                    );
                  })()}

                  {/* Aposta */}
                  <div className={cn('flex min-w-0 flex-col gap-3 bg-concreto px-4 py-3.5', staked > 0 && 'border-l-[3px] border-rua')}>
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate font-prova text-[10.5px] font-bold uppercase tracking-[0.14em] text-suave">
                        — {L('Apostar EXP · paga 2× na vitória', 'Bet EXP · pays 2× on a win')}
                      </span>
                      <span className="shrink-0 font-prova text-[10.5px] font-bold uppercase tracking-[0.1em] text-mudo">
                        {L('Saldo', 'Balance')} {formatCompactNumber(balance)}
                      </span>
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
                            aria-pressed={sel}
                            className={cn(
                              'min-h-[40px] px-3 font-impact text-[16px] uppercase leading-none transition-colors',
                              sel ? 'bg-rua text-asfalto-27' : 'border-2 border-linha text-suave hover:border-papel hover:text-papel',
                            )}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                    {staked > 0 && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="flex flex-col items-center gap-1 border-2 border-linha px-2.5 py-2">
                          <span className="font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo">{L('Vitória', 'Win')}</span>
                          <span className="font-spray text-[22px] font-black leading-none text-alta">+{(staked * 2).toLocaleString(LOCALE)}</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 border-2 border-linha px-2.5 py-2">
                          <span className="font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo">{L('Derrota', 'Loss')}</span>
                          <span className="font-spray text-[22px] font-black leading-none text-baixa">−{staked.toLocaleString(LOCALE)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {error && <p role="alert" className="border-l-[3px] border-baixa bg-concreto px-3 py-2.5 text-[13px] text-papel">{error}</p>}

            {advanceBtn}
          </div>

          {/* CHAVEAMENTO */}
          <section aria-label={L('Chaveamento', 'Bracket')} className="flex flex-col gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <SecaoRua label={L('Chaveamento · 32 clubes', 'Bracket · 32 clubs')} />
              <h2 className="font-voz text-[clamp(34px,9vw,48px)] leading-[0.95] text-papel">{L('A chave', 'The bracket')}</h2>
            </div>
            <BracketCompact key={active.roundIndex} liga={active} />
            {/* CTA duplicado embaixo (mobile: à mão sem rolar de volta) */}
            <div className="mt-2">{advanceBtn}</div>
          </section>

          <button
            type="button"
            onClick={reset}
            className="min-h-[44px] self-center font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo underline underline-offset-4 hover:text-papel"
          >
            {L('Desistir da liga', 'Quit the league')}
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

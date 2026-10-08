/**
 * LEGENDS CUP — regulamento, fase de grupos e a trilha do mata-mata.
 *
 * A tela responde três perguntas em ordem: COMO funciona (regulamento), ONDE
 * estou (tabela do grupo ou fase do mata-mata) e CONTRA QUEM jogo agora (os
 * cards reais das lendas, com foto e OVR).
 *
 * A campanha mora no estado do jogo (não em localStorage): o resultado da
 * Partida Rápida volta pelo FINALIZE_QUICK_PLAN, igual à Liga Ole.
 *
 * DS 2027 "Respeito é ouro": o confronto é cartaz de convocação (rua em cima,
 * asfalto embaixo, o "x" na voz), as lendas são cartas na escada pelo OVR,
 * a chave é uma fila de ingressos e o campeão é LENDA — ouro chapado.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore, useGameDispatch } from '@/game/store';
import { Loader2, Trophy, RotateCcw, ArrowLeft, Check } from 'lucide-react';
import type { OpponentStub, PlayerEntity } from '@/entities/types';
import { CinematicHero } from '@/components/CinematicHero';
import { overallFromAttributes } from '@/entities/player';
import {
  LEGENDS_CUP_ROUNDS, LEGENDS_CUP_OPPONENT_NAME, LEGENDS_CUP_SQUADS,
  GROUP_MATCHES, GROUP_QUALIFIERS, GROUP_SIZE, MANAGER_TEAM_ID,
  createLegendsCupState, currentGroupOpponent, goalDiff, isGroupStage,
  legendsCupPhaseExp, roundOf, sortStandings,
  type LegendsCupGroupTeam, type LegendsCupState,
} from '@/match/legendsCup/legendsCupModel';
import { buildLegendsCupOpponent, type LegendsCupOpponent } from '@/match/legendsCup/legendsCupSquad';
import { coachPersonaFor, personaLine } from '@/match/ligaOle/coachPersona';
import { MomentShareCard } from '@/components/moments/MomentShareCard';
import { detectMoment, stageFromRoundName } from '@/systems/moments';
import { fetchMyReferralCode } from '@/supabase/referrals';
import { BotaoRua, DEGRAU_CLASSES, FitaRua, MarcaRua, SecaoRua, SeloRua, type Degrau } from '@/components/ui/Rua';
import { Convocacao } from '@/components/ligaole/Convocacao';
import { posLabel } from '@/components/matchquick/posLabel';
import { cn } from '@/lib/utils';
import { L, LOCALE, emIngles } from '@/i18n/L';

/** Rótulos de TELA — o valor PT (LEGENDS_CUP_ROUNDS / OPPONENT_NAME) segue sendo a chave. */
const ROUND_EN: Record<string, string> = { 'Fase de Grupos': 'Group Stage', Playoff: 'Playoff', Oitavas: 'Round of 16', Quartas: 'Quarter-finals', Semifinal: 'Semi-final', Final: 'Final' };
const OPP_NAME_EN: Record<string, string> = { 'Grupo A': 'Group A', 'Os Convocados': 'The Call-Ups', 'Os Artilheiros': 'The Goalscorers', 'A Muralha': 'The Wall', 'Os Campeões': 'The Champions', 'Os Imortais': 'The Immortals' };
const roundLabel = (r: string) => (emIngles() ? ROUND_EN[r] ?? r : r);
const oppNameLabel = (n: string | undefined) => (n && emIngles() ? OPP_NAME_EN[n] ?? n : n);

export function LegendsCup() {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  // Selectors finos: a página não deve re-renderizar a cada tick de partida.
  const cup = useGameStore((s) => s.legendsCup);
  const titles = useGameStore((s) => s.legendsCupTitles ?? 0);
  const flash = useGameStore((s) => s.legendsCupResultFlash);
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);

  /**
   * MOMENTO da campanha (Fase 2). A Legends Cup fechava campanhas — inclusive
   * títulos contra TODAS as lendas na final — sem oferecer nada pra
   * compartilhar. Agora o mesmo detector da Partida Rápida classifica a
   * corrida: o campeão sempre rende card; sem taça, só a partir de ÉPICO.
   */
  const cupMoment = useMemo(() => {
    if (!flash) return null;
    const isTitle = flash.outcome === 'champion';
    const stage = isTitle ? 'final' : stageFromRoundName(flash.reachedRound);
    const m = detectMoment({
      competition: 'legends-cup',
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

  /** Craque do plantel — vira o chip de destaque do card. */
  const bestPlayer = useMemo(() => {
    const all = Object.values(players ?? {});
    if (all.length === 0) return null;
    let best = all[0]!;
    let bestOvr = overallFromAttributes(best.attrs, best.pos);
    for (const p of all) {
      const o = overallFromAttributes(p.attrs, p.pos);
      if (o > bestOvr) { best = p; bestOvr = o; }
    }
    return { name: best.name, ovr: bestOvr };
  }, [players]);

  // Código de indicação — só busca quando há card pra compartilhar.
  const [referralCode, setReferralCode] = useState<string | null>(null);
  useEffect(() => {
    if (!cupMoment) return;
    let alive = true;
    void fetchMyReferralCode().then((c) => { if (alive) setReferralCode(c); }).catch(() => {});
    return () => { alive = false; };
  }, [cupMoment]);

  const [opp, setOpp] = useState<LegendsCupOpponent | null>(null);
  const [loading, setLoading] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const round = cup ? roundOf(cup.roundIndex) : null;
  const inGroup = !!cup && isGroupStage(cup.roundIndex);

  /** Força do elenco do manager — usada no sorteio e na simulação do grupo. */
  const myOverall = useMemo(() => {
    const ps = Object.values(players);
    if (!ps.length) return 70;
    return Math.round(ps.reduce((acc, p) => acc + overallFromAttributes(p.attrs, p.pos), 0) / ps.length);
  }, [players]);

  // Adversário do mata-mata: os cards de lenda da fase.
  useEffect(() => {
    if (!cup || cup.status !== 'active' || isGroupStage(cup.roundIndex)) { setOpp(null); return; }
    let alive = true;
    setLoading(true);
    buildLegendsCupOpponent(cup.roundIndex, cup.seed)
      .then((o) => { if (alive) setOpp(o); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [cup]);

  /** Sorteia o grupo (3 clubes de managers reais) e abre a campanha. */
  const drawGroup = useCallback(async () => {
    if (drawing) return;
    setDrawing(true);
    setError(null);
    try {
      const { fetchLigaOleRivals } = await import('@/match/ligaOle/fetchLigaOleTeams');
      // O multiplicador premia TÍTULO, não tentativa: recomeçar após ser
      // eliminado não pode inflar prêmio, senão vira farm de EXP.
      const runNumber = titles + 1;
      const seed = `legendscup-${club.shortName ?? club.name}-${Date.now()}`;
      const rows = await fetchLigaOleRivals({
        excludeShort: club.shortName,
        excludeName: club.name,
        count: GROUP_SIZE - 1,
        seed,
      });
      if (rows.length < GROUP_SIZE - 1) {
        setError(L('Não há managers suficientes na liga para formar o grupo agora. Tente de novo em instantes.', 'Not enough managers in the league to form a group right now. Try again shortly.'));
        return;
      }
      const rivals: LegendsCupGroupTeam[] = rows.map((r) => ({
        id: r.id, name: r.name, short: r.short, overall: r.overall, managerId: r.managerId,
      }));
      const managerTeam: LegendsCupGroupTeam = {
        id: MANAGER_TEAM_ID,
        name: club.name,
        short: club.shortName ?? club.name.slice(0, 3).toUpperCase(),
        overall: myOverall,
        isManager: true,
      };
      dispatch({ type: 'CREATE_LEGENDS_CUP', cup: createLegendsCupState(seed, managerTeam, rivals, runNumber) });
    } catch {
      setError(L('Falha ao sortear o grupo. Verifique a conexão e tente de novo.', 'Failed to draw the group. Check your connection and try again.'));
    } finally {
      setDrawing(false);
    }
  }, [drawing, titles, club, myOverall, dispatch]);

  /** Entra na partida da rodada do grupo (adversário = clube de manager real). */
  const playGroupMatch = useCallback(async () => {
    if (!cup) return;
    const rival = currentGroupOpponent(cup);
    if (!rival) return;
    setLoading(true);
    try {
      const { fetchOpponentRoster } = await import('@/match/opponentRosterClient');
      const roster = await fetchOpponentRoster({ clubName: rival.name, clubShort: rival.short });
      const stub: OpponentStub = {
        id: `legendscup-grupo-${rival.id}`,
        name: rival.name,
        shortName: rival.short,
        strength: rival.overall,
        genesisAwayPlayers: roster?.players,
        formationScheme: (roster?.formationScheme as OpponentStub['formationScheme']) ?? '4-3-3',
      };
      dispatch({ type: 'ADMIN_PATCH_NEXT_FIXTURE', partial: { opponent: stub, awayName: stub.name } });
      dispatch({ type: 'START_LEGENDS_CUP_MATCH', opponentId: stub.id });
      navigate('/match/quick');
    } finally {
      setLoading(false);
    }
  }, [cup, dispatch, navigate]);

  /** Entra na partida do mata-mata (adversário = time de lendas). */
  const playKnockout = useCallback(() => {
    if (!opp) return;
    dispatch({ type: 'ADMIN_PATCH_NEXT_FIXTURE', partial: { opponent: opp.stub, awayName: opp.stub.name } });
    dispatch({ type: 'START_LEGENDS_CUP_MATCH', opponentId: opp.stub.id });
    navigate('/match/quick');
  }, [opp, dispatch, navigate]);

  const phaseExp = cup ? legendsCupPhaseExp(cup.roundIndex, cup.runNumber) : 0;
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-8 px-3 pb-16 sm:px-4">
      <div className="flex flex-col gap-4">
        {/* A fita do torneio — colada torta no topo, como na Home. */}
        <FitaRua tags={['#legendscup', '#persista', '#correloko']} className="-mx-3 -mt-3 py-2 sm:-mx-4" />

        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-linha bg-concreto text-papel transition-colors hover:border-papel focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rua"
            aria-label={L('Voltar', 'Back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="min-w-0 truncate font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">
            — {L('Mata-mata das lendas', 'The legends knockout')}
          </span>
          {titles > 0 && (
            <SeloRua tom="ouro-contorno" className="ml-auto">
              <Trophy className="h-3.5 w-3.5" aria-hidden strokeWidth={2.5} />
              {titles} {titles === 1 ? L('título', 'title') : L('títulos', 'titles')}
            </SeloRua>
          )}
        </div>

        <CinematicHero
          image="/hero-legacy-full.png"
          objectPosition="center 22%"
          badgeLabel="Legends Cup"
          BadgeIcon={Trophy}
          eyebrow="#legendscup"
          title="Legends Cup"
          caption={
            titles > 0
              ? L(`${titles} ${titles === 1 ? 'título' : 'títulos'} · todas as lendas na final`, `${titles} ${titles === 1 ? 'title' : 'titles'} · every legend in the final`)
              : L('5 fases · todas as lendas na final', '5 rounds · every legend in the final')
          }
        />
      </div>

      {flash && <ResultFlash flash={flash} onClose={() => dispatch({ type: 'DISMISS_LEGENDS_CUP_RESULT' })} />}

      {cupMoment && (
        <div className="flex justify-center">
          <MomentShareCard
            moment={cupMoment}
            clubName={club.name}
            highlight={bestPlayer ? { label: L('Craque', 'Star'), name: bestPlayer.name, detail: `OVR ${bestPlayer.ovr}` } : null}
            referralCode={referralCode}
            ctaLabel={cupMoment.tier === 3 ? L('CRIE SEU TIME AGORA', 'CREATE YOUR TEAM NOW') : L('VEM TENTAR TAMBÉM', 'COME GIVE IT A TRY')}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="border-l-[3px] border-baixa bg-concreto px-4 py-3 text-[14px] leading-snug text-papel">
          {error}
        </p>
      )}

      {!cup ? (
        <StartCard onStart={drawGroup} drawing={drawing} />
      ) : (
        <>
          <Trail roundIndex={cup.roundIndex} />

          {inGroup ? (
            <GroupStage cup={cup} clubName={club.name} onPlay={playGroupMatch} loading={loading} phaseExp={phaseExp} />
          ) : (
            <KnockoutStage
              round={round!}
              cup={cup}
              clubName={club.name}
              opp={opp}
              loading={loading}
              phaseExp={phaseExp}
              onPlay={playKnockout}
            />
          )}

          <Bracket roundIndex={cup.roundIndex} runNumber={cup.runNumber} />

          <button
            type="button"
            onClick={() => dispatch({ type: 'RESET_LEGENDS_CUP' })}
            className="mx-auto flex min-h-[44px] items-center gap-2 font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo underline-offset-4 hover:text-papel hover:underline"
          >
            <RotateCcw className="h-3 w-3" aria-hidden /> {L('Abandonar campanha', 'Abandon campaign')}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Resultado da campanha. Campeão é o topo da escada: LENDA, ouro chapado.
 * Eliminado fica no concreto, de igual pra igual — sem deboche.
 */
function ResultFlash({
  flash,
  onClose,
}: {
  flash: { outcome: string; reachedRound: string };
  onClose: () => void;
}) {
  const champ = flash.outcome === 'champion';
  return (
    <section
      aria-label={champ ? L('Campeão da Legends Cup', 'Legends Cup champion') : L('Eliminado da Legends Cup', 'Out of the Legends Cup')}
      className={cn(
        'relative flex min-w-0 flex-col gap-3 overflow-hidden px-5 pb-6 pt-5 sm:px-7',
        champ ? 'bg-ouro-27 text-asfalto-27' : 'rua-grao border-2 border-linha bg-concreto text-papel',
      )}
    >
      {champ && (
        <span
          aria-hidden
          className="rua-reticula absolute -bottom-4 -right-4 h-44 w-56 [--reticula:rgba(13,13,12,0.4)]"
          style={{
            WebkitMaskImage: 'radial-gradient(circle at 100% 100%, #000 0%, transparent 72%)',
            maskImage: 'radial-gradient(circle at 100% 100%, #000 0%, transparent 72%)',
          }}
        />
      )}
      <div className="relative flex min-w-0 items-center justify-between gap-3 font-prova text-[11.5px] font-bold uppercase tracking-[0.2em]">
        <span className={cn('min-w-0 truncate', !champ && 'text-mudo')}>
          {L('Fim de campanha', 'Campaign over')} · {roundLabel(flash.reachedRound)}
        </span>
        <button
          type="button"
          onClick={onClose}
          className={cn('min-h-[36px] shrink-0 px-1 underline-offset-4 hover:underline', !champ && 'text-mudo hover:text-papel')}
        >
          {L('Fechar', 'Close')}
        </button>
      </div>
      <div className="relative flex min-w-0 items-end justify-between gap-4">
        <span className="font-impact uppercase leading-[0.86]" style={{ fontSize: 'clamp(54px, 16vw, 104px)' }}>
          {champ ? L('Campeão', 'Champion') : L('Eliminado', 'Out')}
        </span>
        {champ && <MarcaRua tipo="nove" className="h-24 shrink-0 bg-asfalto-27 sm:h-28" />}
      </div>
      <p className="relative font-voz text-[clamp(26px,7vw,36px)] leading-[1]">
        {champ ? L('Respeito é ouro.', 'Respect is gold.') : L('Perdeu hoje. Volta amanhã.', 'Lost today. Back tomorrow.')}
      </p>
      <p className={cn('relative font-prova text-[11.5px] font-bold uppercase tracking-[0.16em]', !champ && 'text-suave')}>
        {L('Chegou até', 'Reached')} {roundLabel(flash.reachedRound)}
      </p>
    </section>
  );
}

function degrauDe(ovr: number): Degrau {
  if (ovr >= 90) return 'lenda';
  if (ovr >= 80) return 'respeito';
  if (ovr >= 70) return 'corre';
  return 'chao';
}

/** Inclinações de lambe colado — alternam pra não parecer grade. */
const TORTO = [-2.5, 2, -1.5, 2.5, -2, 1.5];

/**
 * Carta de lenda na ESCADA do DS (mesma régua do DropLenda da Home): o OVR
 * escolhe o degrau. Colada torta, endireita no hover.
 */
function CartaLenda({ legend, i }: { legend: PlayerEntity; i: number }) {
  const ovr = overallFromAttributes(legend.attrs, legend.pos);
  const d = degrauDe(ovr);
  const destaque = d === 'respeito' ? 'text-ouro-27' : '';
  return (
    <div
      className={cn(
        'flex w-[138px] flex-col gap-2 p-2.5 shadow-[5px_7px_0_rgba(0,0,0,0.55)] transition-transform duration-200 hover:!rotate-0',
        DEGRAU_CLASSES[d],
      )}
      style={{ transform: `rotate(${TORTO[i % TORTO.length]}deg)` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span
            className={cn(
              'font-impact text-[38px] leading-[0.85]',
              destaque,
              d === 'chao' && 'text-transparent [-webkit-text-stroke:1.5px_var(--color-asfalto-27)]',
            )}
          >
            {ovr}
          </span>
          <span className={cn('mt-1 font-impact text-[12px] uppercase leading-none', destaque)}>{posLabel(legend.pos)}</span>
        </div>
        <MarcaRua tipo="escudo" className={cn('h-6', d === 'respeito' ? 'bg-ouro-27' : 'bg-asfalto-27')} />
      </div>
      <div className={cn('relative aspect-[4/5] w-full overflow-hidden', d === 'respeito' ? 'bg-concreto' : 'bg-asfalto-27/10')}>
        {legend.portraitUrl ? (
          <img
            src={legend.portraitUrl}
            alt={legend.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="absolute inset-0 object-cover"
            style={{ width: '100%', height: '100%', maxWidth: 'none', objectPosition: '50% 20%' }}
          />
        ) : (
          <MarcaRua tipo="escudo" className="absolute left-1/2 top-1/2 h-10 -translate-x-1/2 -translate-y-1/2 bg-current opacity-30" />
        )}
      </div>
      <span className="block min-w-0 truncate font-voz text-[21px] leading-none">{legend.name}</span>
    </div>
  );
}

/** Trilho horizontal de cartas — folga vertical pra inclinação não cortar. */
function TrilhoLendas({ legends, label }: { legends: PlayerEntity[]; label: string }) {
  return (
    <ul
      aria-label={label}
      className="flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto px-2 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {legends.map((l, i) => (
        <li key={l.id} className="shrink-0 snap-start">
          <CartaLenda legend={l} i={i} />
        </li>
      ))}
    </ul>
  );
}

/** Antes de começar: quem espera na final + o regulamento inteiro. */
function StartCard({ onStart, drawing }: { onStart: () => void; drawing: boolean }) {
  // Prévia real das lendas que entram na FINAL — o gancho emocional do torneio.
  // Determinístico por seed fixa: a vitrine não muda a cada render.
  const [finalLegends, setFinalLegends] = useState<PlayerEntity[]>([]);
  useEffect(() => {
    let alive = true;
    const finalIdx = LEGENDS_CUP_ROUNDS.length - 1;
    buildLegendsCupOpponent(finalIdx, 'legendscup-preview')
      .then((o) => { if (alive) setFinalLegends(o.legends.slice(0, 5)); })
      .catch(() => { /* sem lendas carregadas → some a vitrine, sem inventar nada */ });
    return () => { alive = false; };
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-8">
      {finalLegends.length > 0 && (
        <section aria-label={L('Quem espera na final', 'Waiting in the final')} className="flex min-w-0 flex-col gap-1">
          <SecaoRua label={L('Quem espera na final', 'Waiting in the final')} />
          <h2 className="flex flex-col font-impact text-[clamp(38px,10.5vw,58px)] uppercase leading-[0.9]">
            <span className="font-voz text-[1.2em] normal-case leading-[0.9] text-papel">{L('Enfrente', 'Face')}</span>
            <span className="text-rua">{L('as lendas.', 'the legends.')}</span>
          </h2>
          <TrilhoLendas legends={finalLegends} label={L('Lendas da final', 'Final legends')} />
        </section>
      )}

      {finalLegends.length === 0 && (
        <h2 className="flex flex-col font-impact text-[clamp(38px,10.5vw,58px)] uppercase leading-[0.9]">
          <span className="font-voz text-[1.2em] normal-case leading-[0.9] text-papel">{L('Enfrente', 'Face')}</span>
          <span className="text-rua">{L('as lendas.', 'the legends.')}</span>
        </h2>
      )}

      <section aria-label={L('Regulamento', 'Rules')} className="flex min-w-0 flex-col gap-4">
        <SecaoRua label={L('Regulamento', 'Rules')} />
        <ol className="flex flex-col gap-2">
          <Rule n={1} title={L('Fase de grupos', 'Group stage')}>
            {emIngles() ? <>
            Your club is drawn into a group with <strong>{GROUP_SIZE - 1} real managers</strong>. Single round:{' '}
            {GROUP_MATCHES} matches, everyone plays everyone. Win 3 points, draw 1.{' '}
            <strong>The top {GROUP_QUALIFIERS} qualify.</strong>
            </> : <>
            Seu clube cai num grupo com <strong>{GROUP_SIZE - 1} managers reais</strong>. Turno único:{' '}
            {GROUP_MATCHES} jogos, todos contra todos. Vitória 3 pontos, empate 1.{' '}
            <strong>Os {GROUP_QUALIFIERS} primeiros classificam.</strong>
            </>}
          </Rule>
          <Rule n={2} title={L('Mata-mata', 'Knockout')}>
            {emIngles() ? <>
            Five rounds, and the opponent changes: the <strong>real legend cards</strong> of
            OLEFOOT. Lose and you're out — no way back.
            </> : <>
            Cinco fases, e aí o adversário muda: são os <strong>cards reais das lendas</strong> da
            OLEFOOT. Perdeu, acabou — não tem volta.
            </>}
          </Rule>
          <Rule n={3} title={L('A cada degrau, mais lenda', 'Every step, more legends')}>
            {emIngles() ? <>
            The Playoff has 4 legends on the pitch. The final has <strong>all of them</strong>, with Palhinha 95.
            </> : <>
            O Playoff tem 4 lendas em campo. A final tem <strong>todas</strong>, com o Palhinha 95.
            </>}
          </Rule>
          <Rule n={4} title={L('Prêmio', 'Prize')} ouro>
            {emIngles() ? <>
            EXP for every round won, from 2.5M for qualifying to <strong>100M for the title</strong>. Winning the
            Cup doubles the prize of your next campaign (up to 4×).
            </> : <>
            EXP por fase vencida, de 2,5M na classificação a <strong>100M no título</strong>. Ganhar o
            Cup dobra o prêmio da próxima campanha (até 4×).
            </>}
          </Rule>
        </ol>
      </section>

      <div className="flex min-w-0 flex-col items-start gap-3">
        <p className="font-voz text-[clamp(24px,6vw,30px)] leading-[1.05] text-papel">
          {L('Ninguém desce o morro de graça.', 'Nobody comes down the hill for free.')}
        </p>
        <BotaoRua onClick={onStart} disabled={drawing} className="w-full sm:w-auto">
          {drawing ? (
            <><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {L('Sorteando grupo…', 'Drawing group…')}</>
          ) : (
            <>{L('Sortear grupo', 'Draw group')} <span aria-hidden>→</span></>
          )}
        </BotaoRua>
      </div>
    </div>
  );
}

/** Regra do regulamento: número vazado (degrau CHÃO — é promessa), título no grito. */
function Rule({ n, title, ouro, children }: { n: number; title: string; ouro?: boolean; children: React.ReactNode }) {
  return (
    <li className={cn('flex min-w-0 gap-4 bg-concreto p-4', ouro && 'border-[3px] border-ouro-27')}>
      <span
        aria-hidden
        className={cn(
          'w-10 shrink-0 font-impact text-[44px] leading-[0.85] text-transparent',
          ouro ? '[-webkit-text-stroke:1.5px_var(--color-ouro-27)]' : '[-webkit-text-stroke:1.5px_var(--color-papel)]',
        )}
      >
        {String(n).padStart(2, '0')}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className={cn('font-impact text-[20px] uppercase leading-none', ouro ? 'text-ouro-27' : 'text-papel')}>{title}</span>
        <p className="text-[14px] leading-relaxed text-suave [&_strong]:font-semibold [&_strong]:text-papel">{children}</p>
      </div>
    </li>
  );
}

/** Trilha das fases — onde o manager está e o que falta. */
function Trail({ roundIndex }: { roundIndex: number }) {
  return (
    <nav aria-label={L('Fases da Legends Cup', 'Legends Cup rounds')} className="flex min-w-0 flex-col gap-2.5">
      <SecaoRua
        label={L('Fases', 'Rounds')}
        aside={`${String(roundIndex + 1).padStart(2, '0')}/${String(LEGENDS_CUP_ROUNDS.length).padStart(2, '0')}`}
      />
      <ol className="flex min-w-0 flex-wrap items-center gap-1.5">
        {LEGENDS_CUP_ROUNDS.map((r, i) => {
          const done = i < roundIndex;
          const active = i === roundIndex;
          return (
            <li
              key={r}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.1em]',
                active && 'bg-rua text-asfalto-27',
                done && 'border-2 border-linha text-suave',
                !active && !done && 'border-2 border-dashed border-fio text-mudo',
              )}
            >
              {done && <Check className="h-3 w-3" aria-hidden strokeWidth={3} />}
              {roundLabel(r)}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Fase de grupos: tabela, jogos e o próximo confronto. */
function GroupStage({
  cup, clubName, onPlay, loading, phaseExp,
}: { cup: LegendsCupState; clubName: string; onPlay: () => void; loading: boolean; phaseExp: number }) {
  const sorted = sortStandings(Object.values(cup.standings));
  const nameOf = (id: string) => cup.groupTeams.find((t) => t.id === id)?.name ?? id;
  const shortOf = (id: string) => cup.groupTeams.find((t) => t.id === id)?.short ?? id;
  const rival = currentGroupOpponent(cup);
  const rodada = cup.groupRoundsPlayed;
  const myTeam = cup.groupTeams.find((t) => t.id === MANAGER_TEAM_ID);

  return (
    <div className="flex min-w-0 flex-col gap-8">
      {/* Próxima partida do manager — cartaz de convocação */}
      {rival && (
        <div className="flex min-w-0 flex-col gap-4">
          <Convocacao
            ariaLabel={L(`Sua partida: ${clubName} contra ${rival.name}`, `Your match: ${clubName} vs ${rival.name}`)}
            kicker={L(`Legends Cup · ${roundLabel(LEGENDS_CUP_ROUNDS[0])}`, `Legends Cup · ${roundLabel(LEGENDS_CUP_ROUNDS[0])}`)}
            aside={L(`Rodada ${rodada + 1}`, `Matchday ${rodada + 1}`)}
            home={clubName}
            homeMeta={myTeam ? L(`Força ${myTeam.overall}`, `Strength ${myTeam.overall}`) : null}
            away={rival.name}
            awayMeta={L(`Força ${rival.overall}`, `Strength ${rival.overall}`)}
          >
            <p className="font-voz text-[clamp(22px,5.6vw,28px)] leading-[1.05] text-papel">
              {L('Escala o time e entra.', 'Set your XI and walk in.')}
            </p>
          </Convocacao>
          <PlayBar onPlay={onPlay} loading={loading} phaseExp={phaseExp} expLabel={L('EXP por classificar', 'EXP for qualifying')} />
        </div>
      )}

      <section aria-label={L('Tabela do grupo', 'Group table')} className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <SecaoRua
            label={L('Tabela · turno único', 'Table · single round')}
            aside={L(`Rodada ${Math.min(rodada + 1, GROUP_MATCHES)}/${GROUP_MATCHES}`, `Matchday ${Math.min(rodada + 1, GROUP_MATCHES)}/${GROUP_MATCHES}`)}
          />
          <h2 className="font-voz text-[clamp(38px,10vw,54px)] leading-[0.95] text-papel">{L('Grupo A', 'Group A')}</h2>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          {sorted.map((r, i) => {
            const isMe = r.teamId === MANAGER_TEAM_ID;
            const leader = i === 0 && !isMe;
            const qualifies = i < GROUP_QUALIFIERS;
            const gd = goalDiff(r);
            const meta = L(
              `${r.played}J · ${r.wins}V ${r.draws}E ${r.losses}D · SG ${gd > 0 ? `+${gd}` : gd}`,
              `${r.played}P · ${r.wins}W ${r.draws}D ${r.losses}L · GD ${gd > 0 ? `+${gd}` : gd}`,
            );
            return (
              <Fragment key={r.teamId}>
                <div
                  className={cn(
                    'flex min-w-0 items-center gap-3 px-4',
                    isMe && 'relative z-[1] my-1 h-[64px] -rotate-1 bg-rua text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)]',
                    !isMe && 'h-[56px]',
                    leader && 'border-2 border-ouro-27 text-ouro-27',
                    !isMe && !leader && 'bg-concreto text-papel',
                  )}
                >
                  <span className={cn('w-10 shrink-0 font-impact text-[22px] leading-none', !isMe && !leader && qualifies && 'text-rua')}>
                    #{String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex min-w-0 grow flex-col gap-1">
                    <span className="block min-w-0 truncate font-impact text-[20px] uppercase leading-none">{nameOf(r.teamId)}</span>
                    <span className={cn('block truncate font-prova text-[10.5px] font-bold uppercase tracking-[0.1em]', isMe ? 'text-asfalto-27/75' : 'text-mudo')}>
                      {meta}
                    </span>
                  </span>
                  <span className="shrink-0 font-impact text-[26px] leading-none">{r.points}</span>
                </div>
                {i === GROUP_QUALIFIERS - 1 && i < sorted.length - 1 && (
                  <div className="flex h-6 items-center gap-2" aria-label={L('Zona de classificação acima desta linha', 'Qualification zone above this line')}>
                    <span className="block h-0 grow border-t-2 border-dashed border-rua" />
                    <span className="font-prova text-[11px] font-bold tracking-[0.2em] text-rua">{L('CLASSIFICA', 'QUALIFY')}</span>
                    <span className="block h-0 grow border-t-2 border-dashed border-rua" />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>

        <p className="font-prova text-[11px] font-bold uppercase leading-snug tracking-[0.1em] text-mudo">
          {L(`Os ${GROUP_QUALIFIERS} primeiros vão ao Playoff · a rodada inteira roda junto com o seu jogo`, `Top ${GROUP_QUALIFIERS} go to the Playoff · the whole matchday plays alongside your match`)}
        </p>
      </section>

      {/* Jogos do grupo, rodada a rodada */}
      <section aria-label={L('Jogos do grupo', 'Group matches')} className="flex min-w-0 flex-col gap-3">
        <SecaoRua label={L('Jogos', 'Matches')} />
        <div className="flex min-w-0 flex-col gap-4">
          {Array.from({ length: GROUP_MATCHES }, (_, r) => (
            <div key={r} className="flex min-w-0 flex-col gap-1.5">
              <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.2em] text-fio">
                {L('Rodada', 'Matchday')} {String(r + 1).padStart(2, '0')}
              </span>
              {cup.groupFixtures.filter((f) => f.round === r).map((f) => {
                const played = f.scoreHome !== undefined;
                const homeMe = f.homeId === MANAGER_TEAM_ID;
                const awayMe = f.awayId === MANAGER_TEAM_ID;
                return (
                  <div
                    key={`${f.round}-${f.homeId}-${f.awayId}`}
                    className={cn(
                      'flex h-12 min-w-0 items-center gap-2 bg-concreto px-3',
                      f.isManager && 'border-l-[3px] border-rua',
                    )}
                  >
                    <span className={cn('min-w-0 flex-1 truncate text-right font-impact text-[17px] uppercase leading-none', homeMe ? 'text-rua' : 'text-suave')}>
                      {shortOf(f.homeId)}
                    </span>
                    <span className="w-16 shrink-0 text-center">
                      {played ? (
                        <span className="font-spray text-[24px] font-black leading-none text-papel">{f.scoreHome}×{f.scoreAway}</span>
                      ) : (
                        <span aria-label={L('a jogar', 'to play')} className="font-voz text-[22px] leading-none text-fio">x</span>
                      )}
                    </span>
                    <span className={cn('min-w-0 flex-1 truncate font-impact text-[17px] uppercase leading-none', awayMe ? 'text-rua' : 'text-suave')}>
                      {shortOf(f.awayId)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Mata-mata: convocação contra o time de lendas + as cartas que entram em campo. */
function KnockoutStage({
  round, cup, clubName, opp, loading, phaseExp, onPlay,
}: {
  round: string; cup: LegendsCupState; clubName: string; opp: LegendsCupOpponent | null;
  loading: boolean; phaseExp: number; onPlay: () => void;
}) {
  const teamId = opp?.stub.id ?? 'legendscup';
  const persona = coachPersonaFor(teamId);
  const line = personaLine(teamId, 'pre', round);
  const isFinal = cup.roundIndex === LEGENDS_CUP_ROUNDS.length - 1;
  const oppName = oppNameLabel(LEGENDS_CUP_OPPONENT_NAME[round as never]) ?? '—';

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Convocacao
        ariaLabel={L(`${roundLabel(round)}: ${clubName} contra ${oppName}`, `${roundLabel(round)}: ${clubName} vs ${oppName}`)}
        kicker={`Legends Cup · ${roundLabel(round)}`}
        aside={isFinal ? L('A decisão', 'The decider') : L('Mata-mata', 'Knockout')}
        home={clubName}
        away={oppName}
        awayMeta={opp ? L(`Força ${opp.stub.strength}`, `Strength ${opp.stub.strength}`) : null}
        tag={isFinal ? <SeloRua tom="ouro" className="-rotate-2">{L('Todas as lendas', 'Every legend')}</SeloRua> : undefined}
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.2em] text-mudo">— {persona.label}</span>
          <p className="font-voz text-[clamp(22px,5.6vw,28px)] leading-[1.05] text-papel">“{line}”</p>
        </div>
      </Convocacao>

      {loading ? (
        <div className="grid place-items-center py-10 text-mudo">
          <Loader2 className="h-6 w-6 animate-spin" aria-label={L('Carregando lendas', 'Loading legends')} />
        </div>
      ) : opp && opp.legends.length > 0 ? (
        <section aria-label={L('Lendas em campo', 'Legends on the pitch')} className="flex min-w-0 flex-col gap-1">
          <SecaoRua label={L('Quem entra em campo', 'Who takes the pitch')} aside={opp.legends.length} />
          <TrilhoLendas legends={opp.legends} label={L('Lendas da fase', 'Round legends')} />
        </section>
      ) : null}

      <PlayBar onPlay={onPlay} loading={loading} phaseExp={phaseExp} expLabel={L('EXP por avançar', 'EXP for advancing')} />
    </div>
  );
}

function PlayBar({
  onPlay, loading, phaseExp, expLabel,
}: { onPlay: () => void; loading: boolean; phaseExp: number; expLabel: string }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3">
      <BotaoRua onClick={onPlay} disabled={loading} className="grow">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
        {L('Jogar', 'Play')} <span aria-hidden>→</span>
      </BotaoRua>
      <div className="flex shrink-0 flex-col items-end">
        <span className="font-spray text-[30px] font-black leading-none text-papel">+{phaseExp.toLocaleString(LOCALE)}</span>
        <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.14em] text-mudo">{expLabel}</span>
      </div>
    </div>
  );
}

/**
 * O caminho até o título — cada fase é um ingresso: a que passou fica
 * carimbada, a atual é rua colada torta, as que faltam são CHÃO (tracejado) e
 * a final, onde moram todas as lendas, leva o fio de ouro.
 */
function Bracket({ roundIndex, runNumber }: { roundIndex: number; runNumber: number }) {
  const last = LEGENDS_CUP_ROUNDS.length - 1;
  return (
    <section aria-label={L('O caminho até o título', 'The road to the title')} className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <SecaoRua label={L('Chave', 'Bracket')} />
        <h2 className="font-voz text-[clamp(34px,9vw,48px)] leading-[0.95] text-papel">{L('O caminho até o título', 'The road to the title')}</h2>
      </div>
      <ol className="flex min-w-0 flex-col gap-2">
        {LEGENDS_CUP_ROUNDS.map((r, i) => {
          const legends = LEGENDS_CUP_SQUADS[r]?.length ?? 0;
          const done = i < roundIndex;
          const active = i === roundIndex;
          const isFinal = i === last;
          return (
            <li
              key={r}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex min-w-0 items-stretch',
                active && 'relative z-[1] my-1 -rotate-1 bg-rua text-asfalto-27 shadow-[4px_4px_0_var(--color-papel)]',
                done && 'bg-concreto text-mudo',
                !active && !done && isFinal && 'border-[3px] border-ouro-27 text-ouro-27',
                !active && !done && !isFinal && 'border-2 border-dashed border-fio text-suave',
              )}
            >
              <div className="flex min-w-0 grow flex-col gap-1 px-4 py-3">
                <span className={cn('font-impact text-[22px] uppercase leading-none', done && 'line-through decoration-2')}>{roundLabel(r)}</span>
                <span className="truncate font-prova text-[10.5px] font-bold uppercase tracking-[0.12em]">
                  {oppNameLabel(LEGENDS_CUP_OPPONENT_NAME[r])} ·{' '}
                  {legends > 0 ? L(`${legends} lendas + Jiva`, `${legends} legends + Jiva`) : L(`${GROUP_SIZE - 1} managers reais`, `${GROUP_SIZE - 1} real managers`)}
                </span>
              </div>
              {/* Canhoto: o prêmio da fase, separado pelo picote. */}
              <div
                className={cn(
                  'flex shrink-0 flex-col items-end justify-center border-l-2 border-dashed px-3 py-3',
                  active && 'border-asfalto-27/40',
                )}
                style={!active ? { borderLeftColor: 'color-mix(in srgb, currentColor 30%, transparent)' } : undefined}
              >
                {done ? (
                  <Check className="h-5 w-5 text-papel" aria-label={L('Passou', 'Cleared')} strokeWidth={3} />
                ) : (
                  <>
                    <span className="font-spray text-[20px] font-black leading-none">{legendsCupPhaseExp(i, runNumber).toLocaleString(LOCALE)}</span>
                    <span className="font-prova text-[9.5px] font-bold uppercase tracking-[0.14em]">EXP</span>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default LegendsCup;

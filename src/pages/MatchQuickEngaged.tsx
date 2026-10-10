/**
 * MatchQuickEngaged — Partida Rápida 2.0 (Fase C do Quick Match redesign).
 *
 * Experiência baseada no motor Python (plano pré-computado) + Analyst Beats,
 * isolada do fluxo tick-by-tick legado. O MatchQuick gateia por
 * VITE_QUICK_PLAN_ENABLED: flag ON → esta página; OFF → o motor antigo intacto.
 *
 * Fluxo: kickoff → 1º tempo (QuickPlanPlayer com 2 beats) → INTERVALO (5 cards
 * top3+bottom2, sub, tática, 15s) → replan do 2º tempo no Python com a lineup
 * ajustada → 2º tempo → apito final com Leitura de Jogo.
 *
 * Tempo-alvo: ~25s por tempo (speedMultiplier derivado do plano).
 *
 * A nota antiga dizia que a progressão não era creditada aqui e que a flag
 * ficava OFF em produção. As duas coisas deixaram de ser verdade: o
 * `FINALIZE_QUICK_PLAN` credita XP/fadiga/economia (ver o fim deste arquivo) e
 * `VITE_QUICK_PLAN_ENABLED=1` está no `.env.production` — ou seja, ESTA é a
 * Partida Rápida que todo mundo joga. O caminho tick-by-tick (MatchQuickLegacy)
 * só roda com a flag desligada.
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { overallFromAttributes } from '@/entities/player';
import { Hashtag } from '@/components/ui';
import { BotaoRua, SeloRua, SecaoRua } from '@/components/ui/Rua';
import { ConvocacaoRua } from '@/components/match/ResultadoRua';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore, useGameDispatch, getGameState } from '@/game/store';
import { relatarPartidaSombra } from '@/smartProfile/sombra';
import { getEffectiveFatigue } from '@/systems/fatigue';
import { playerPortraitSrc } from '@/lib/playerPortrait';
import { matchdayHomeCrestUrl } from '@/settings/matchdayCrest';
import { fetchQuickPlan, applyLegacyBoostToLineup, type ComandoAoVivo } from '@/match/quickPlanClient';
import { fetchQuickNarration, type QuickNarration } from '@/match/quickNarrateClient';
import { fetchOpponentRoster } from '@/match/opponentRosterClient';
import { LIGA_OLE_ROUNDS } from '@/match/ligaOle/ligaOleModel';
import type { ShootoutSetup } from '@/components/matchquick/PenaltyShootout';
import type { ShootoutKicker, ShootoutKeeper } from '@/match/quickEngaged/penaltyShootout';
import type { MatchPlan } from '@/match/quickPlanTypes';
import {
  QuickPlanPlayer,
  type QuickPlanHalftimeContext,
  type ComandoSemMinuto,
  type ContextoDoReplan,
  type QuickPlanPlayResult,
  matchRating,
  type PenaltyTaker,
  type SquadCard,
} from '@/match/QuickPlanPlayer';
import {
  buildQuickPlanInputs,
  playerToHomeView,
  applyFormationToPayloads,
  type QuickHomePlayerView,
} from '@/match/quickEngaged/buildQuickPlanInputs';
import {
  QuickHalftimePanel,
  type HalftimeResult,
} from '@/components/matchquick/QuickHalftimePanel';
import { QuickPerformanceBonusPanel } from '@/components/matchquick/QuickPerformanceBonusPanel';
import { QuickStreakChallengesPanel } from '@/components/matchquick/QuickStreakChallengesPanel';
import { calculateTotalBonusRewards } from '@/match/quickPerformanceBonuses';
import { QuickShareCard } from '@/components/matchquick/QuickShareCard';
import { computeQuickRarity } from '@/match/quickRarity';
import { MatchConsequences } from '@/components/match/MatchConsequences';
import { fetchMyReferralCode } from '@/supabase/referrals';
import { scarShootoutConfidenceDelta } from '@/systems/scars';
import { nemesisIsDerby } from '@/match/rivalDerby';
import { dnaLabel } from '@/systems/clubDna';
import { coachPersonaFor, personaLine } from '@/match/ligaOle/coachPersona';
import type { AgentEchoTrait } from '@/match/quickAgentEcho';
import { L, emIngles } from '@/i18n/L';
import { posLabel } from '@/components/matchquick/posLabel';
import { dnaDoClubeParaMotor } from '@/club/identidade';
import { criarCanalAoVivo } from '@/partidaViva/canal';
import { montarFichas } from '@/partidaViva/escalacao';
import { deitarTela, levantarTela } from '@/partidaViva/orientacao';
import { msParaMostrar } from '@/partidaViva/cronograma';
import { ligarSom } from '@/partidaViva/som';
import { gravarEntrega, salvarFilme, type FilmeDaPartida as Filme, type Trecho } from '@/partidaViva/gravacao';
import { enviarFilme } from '@/partidaViva/filmeServidor';
import type { QuadroAoVivo } from '@/partidaViva/tipos';

// PARTIDA VIVA (beta): o palco em campo só carrega o PixiJS quando é aberto.
const PartidaVivaPalco = lazy(() =>
  import('@/partidaViva/PartidaVivaPalco').then((m) => ({ default: m.PartidaVivaPalco })),
);

type Phase = 'loading' | 'kickoff' | 'playing' | 'finished' | 'error';

export default function MatchQuickEngaged({ aoVivoInicial = false }: { aoVivoInicial?: boolean } = {}) {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const players = useGameStore((s) => s.players);
  // Moral por jogador — ponte Fase 4 até os atributos enviados ao motor.
  const playerMoral = useGameStore((s) => s.playerMoral);
  /** playerId → nome, pro bloco de consequências dizer QUEM levou. */
  const playerNames = useMemo(() => {
    const out: Record<string, string> = {};
    for (const p of Object.values(players)) out[p.id] = p.name;
    return out;
  }, [players]);
  const playerHealth = useGameStore((s) => s.playerHealth);
  const lineup = useGameStore((s) => s.lineup);
  const club = useGameStore((s) => s.club);
  const managerFormation = useGameStore((s) => s.manager.formationScheme);
  const clubIdentidade = club.identidade;
  const nextFixture = useGameStore((s) => s.nextFixture);
  const homeCrestUrl = useGameStore((s) => matchdayHomeCrestUrl(s.userSettings));
  // Liga Ole: detecta no MOUNT se esta partida é da liga (pendingOpponentId),
  // pra mostrar a continuação ("avançou de fase" + Avançar) no pós-jogo.
  const ligaOle = useGameStore((s) => s.ligaOle);
  const ligaFlash = useGameStore((s) => s.ligaOleResultFlash);
  // Evolução do time pós-partida (delta de OVR) — preenchido pelo FINALIZE_QUICK_PLAN.
  const lastEvolution = useGameStore((s) => s.lastQuickEvolution);
  // Ponte #1/#2: bônus de performance + desafios semanais pro pós-jogo.
  const lastBonuses = useGameStore((s) => s.lastQuickBonuses);
  const streakChallenges = useGameStore((s) => s.streakChallenges);
  // Viral: forma (story strip), streak (raridade) e código de indicação (card).
  const form = useGameStore((s) => s.form);
  const quickStreak = useGameStore((s) => s.quickMatchStreak);
  const newRecord = useGameStore((s) => s.lastQuickNewRecord);
  // FABLE — cicatrizes (confiança no shootout) + DNA do clube (pós-jogo).
  const playerScars = useGameStore((s) => s.playerScars);
  const clubDna = useGameStore((s) => s.clubDna);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const isLigaOleMatchRef = useRef<boolean | null>(null);
  if (isLigaOleMatchRef.current === null) isLigaOleMatchRef.current = !!ligaOle?.pendingOpponentId;
  // FABLE — persona do treinador rival: captura o adversário da Liga Ole no
  // mount (o pendingOpponentId é limpo pelo FINALIZE, então guardamos aqui).
  const ligaOpponentIdRef = useRef<string | null>(null);
  if (ligaOpponentIdRef.current === null) ligaOpponentIdRef.current = ligaOle?.pendingOpponentId ?? '';
  // LEGENDS CUP: mesma captura no MOUNT — o FINALIZE limpa o pendingOpponentId,
  // e é ele que diz se esta partida foi do Cup (pro CTA de compra no pós-jogo).
  const legendsCup = useGameStore((s) => s.legendsCup);
  const isLegendsCupMatchRef = useRef<boolean | null>(null);
  if (isLegendsCupMatchRef.current === null) isLegendsCupMatchRef.current = !!legendsCup?.pendingOpponentId;

  const [phase, setPhase] = useState<Phase>('loading');
  const [plan, setPlan] = useState<MatchPlan | null>(null);
  const [narration, setNarration] = useState<QuickNarration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuickPlanPlayResult | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [halftimeCtx, setHalftimeCtx] = useState<QuickPlanHalftimeContext | null>(null);

  // Viral #7: busca o código de indicação só quando o jogo termina (pro card).
  useEffect(() => {
    if (phase !== 'finished') return;
    let alive = true;
    fetchMyReferralCode().then((c) => { if (alive) setReferralCode(c); }).catch(() => {});
    return () => { alive = false; };
  }, [phase]);

  // Estado vivo da lineup home (subs do intervalo persistem aqui)
  const homePlayersRef = useRef<QuickHomePlayerView[]>([]);
  // Quick plan usa taxonomia própria (defensive/balanced/offensive), distinta
  // da quickMatchIntensity legada (counter/press/...). Começa equilibrado.
  const intensityRef = useRef<'defensive' | 'balanced' | 'offensive'>('balanced');
  // A formação do manager (fundação / tela de elenco). Antes lia
  // `lineup.formation`, campo que a escalação não tem: toda Partida Rápida
  // saía em 4-4-2, qualquer que fosse a escolha do manager.
  const formationRef = useRef<string>(managerFormation ?? '4-4-2');
  // DNA da fundação → motor. null (clube antigo) = plano neutro, igual ao de antes.
  const homeDnaRef = useRef(dnaDoClubeParaMotor(clubIdentidade));
  const awayLineupRef = useRef<import('@/match/quickPlanClient').QuickPlanPlayerPayload[]>([]);
  const seedRef = useRef<string>('');
  /** Custódia (SMART-PROFILE 2B): ids dos planos emitidos pelo servidor nesta partida. */
  const planIdsRef = useRef<(string | null | undefined)[]>([]);
  const baseStrengthRef = useRef<{ home: number; away: number }>({ home: 70, away: 70 });
  const htResolverRef = useRef<((p: MatchPlan | null) => void) | null>(null);
  const startedRef = useRef(false);

  const opponent = nextFixture?.opponent;
  const hasOpponent = !!opponent && opponent.id !== 'placeholder-opponent' && opponent.id !== 'no-opponent-available';

  /**
   * MATCHMAKING — a Partida Rápida acha o próprio adversário.
   *
   * O gate do Quick 2.0 (`MatchQuick`: flag ON → esta página) deixou a busca de
   * adversário dentro do `MatchQuickLegacy`, que não renderiza mais. Quem
   * entrava sem jogo marcado batia em "Nenhum adversário disponível" e não
   * tinha como jogar — com a base pequena, quase sempre.
   *
   * `findFriendlyOpponent` (src/match/friendlyMatchmaking.ts) é a decisão de
   * produto de 2026-05-27 e SEMPRE devolve partida, nesta ordem: manager real
   * (a IA joga por ele quando está offline) → time da Liga Global → bot do
   * nível do manager. Por isso aqui não há caminho que desista.
   */
  const buscaDeAdversarioRef = useRef(false);
  const [buscandoAdversario, setBuscandoAdversario] = useState(false);
  const [buscaFalhou, setBuscaFalhou] = useState(false);
  const [tentativaDeBusca, setTentativaDeBusca] = useState(0);
  useEffect(() => {
    if (hasOpponent || buscaDeAdversarioRef.current) return;
    buscaDeAdversarioRef.current = true;
    setBuscandoAdversario(true);
    setBuscaFalhou(false);
    // SEM flag de cancelamento, de propósito. Com `cancelado` + a ref de
    // "já tentei", o StrictMode travava a tela em "Procurando adversário…"
    // para sempre: ele monta, desmonta e remonta: o cleanup da 1ª passada
    // marcava `cancelado`, a 2ª passada saía pela ref já marcada, e a busca
    // original terminava sem poder nem desligar o "procurando". A ref sozinha
    // já impede busca em dobro, e `setState` depois de desmontar é no-op no
    // React 18. (O MatchQuickLegacy tem o mesmo par ref+cancelled — mesma
    // armadilha, se algum dia voltar a renderizar.)
    (async () => {
      try {
        const { quickFindOpponent, opponentMatchToStub } = await import('@/match/friendlyMatchmaking');
        const { getSupabase } = await import('@/supabase/client');
        const sb = getSupabase();
        const sessao = sb ? (await sb.auth.getSession()).data.session : null;
        // Snapshot do elenco fora das deps, pra não refazer a busca a cada tick.
        const elenco = getGameState().players;
        const ids = Object.keys(elenco);
        const meuOvr = ids.length
          ? Math.round(Object.values(elenco).reduce((s, p) => s + overallFromAttributes(p.attrs, p.pos), 0) / ids.length)
          : 70;
        const achado = await quickFindOpponent(club.id, meuOvr || 70, sessao?.user?.id, sessao?.user?.email);
        const stub = opponentMatchToStub(achado, meuOvr || 70);
        console.info(`[MatchQuickEngaged] adversário: ${stub.name} (${stub.id}, força ${stub.strength})`);
        dispatch({ type: 'ADMIN_PATCH_NEXT_FIXTURE', partial: { opponent: stub, awayName: stub.name } });
      } catch (err) {
        // A busca só estoura por rede/sessão; a hierarquia em si não desiste.
        console.warn('[MatchQuickEngaged] busca de adversário falhou', err);
        setBuscaFalhou(true);
      } finally {
        setBuscandoAdversario(false);
      }
    })();
    // `tentativaDeBusca` entra nas deps de propósito: é o que faz o botão
    // "procurar de novo" rodar o efeito outra vez.
  }, [hasOpponent, club.id, dispatch, tentativaDeBusca]);

  /** Tentar de novo depois de uma falha de rede. */
  const buscarAdversarioDeNovo = useCallback(() => {
    buscaDeAdversarioRef.current = false;
    setBuscaFalhou(false);
    setTentativaDeBusca((n) => n + 1);
  }, []);

  // As LENDAS que estavam do outro lado — capturadas quando o adversário
  // aparece (pode chegar pelo matchmaking acima, um render depois), porque o
  // FINALIZE mexe no nextFixture. É o que alimenta o CTA "leve ele pro seu
  // time": o manager acabou de sentir o card em campo, é a hora de oferecer.
  const facedLegendsRef = useRef<Array<{ id: string; name: string; portraitUrl?: string; ovr: number }> | null>(null);
  if (facedLegendsRef.current === null && hasOpponent) {
    facedLegendsRef.current = (opponent?.genesisAwayPlayers ?? [])
      .filter((p) => String(p.id).startsWith('legacy-'))
      .map((p) => ({
        id: String(p.id),
        name: p.name,
        portraitUrl: (p as { portraitUrl?: string }).portraitUrl,
        ovr: overallFromAttributes(p.attrs, p.pos),
      }))
      .sort((a, b) => b.ovr - a.ovr);
  }

  // FABLE — DERBY/CLÁSSICO: revanche contra o nêmesis vira clássico MECÂNICO
  // (o Python amplia finalização/xG/pênalti/cartão dos 2 lados) e visual.
  const ligaOleNemesisEng = useGameStore((s) => s.ligaOleNemesis);
  const isDerbyMatch = nemesisIsDerby({
    opponentId: ligaOpponentIdRef.current || opponent?.id,
    ligaOleNemesisId: ligaOleNemesisEng?.id,
  });

  // Banco: titulares de fora, saudáveis
  const bench = useMemo<QuickHomePlayerView[]>(() => {
    const starterIds = new Set(homePlayersRef.current.map((p) => p.id));
    return Object.values(players)
      .filter((p) => {
        if (starterIds.has(p.id)) return false;
        const h = playerHealth?.[p.id];
        if (h) return (h.outForMatches ?? 0) <= 0 && (h.suspendedMatches ?? 0) <= 0;
        return (p.outForMatches ?? 0) <= 0;
      })
      .map((p) => playerToHomeView(p, getEffectiveFatigue(p.id, p, playerHealth)))
      .sort((a, b) => b.effective - a.effective)
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, playerHealth, halftimeCtx]); // recomputa ao abrir o intervalo

  // Monta + busca o plano uma vez
  useEffect(() => {
    if (startedRef.current || !hasOpponent) return;
    startedRef.current = true;
    (async () => {
      try {
        const seed = `${club.shortName}-${opponent!.shortName}-${opponent!.id}-${Date.now()}`;
        seedRef.current = seed;
        // Elenco REAL do adversário. NUNCA inventa jogadores: usa o stub só se
        // for real (ids sintéticos `gl-syn-*`/`away-*` não contam); senão resolve
        // no backend (profiles → manager_squad). Sintético só como último recurso.
        const stubAway = opponent!.genesisAwayPlayers;
        const isSynthetic = (id: string) => id.startsWith('gl-syn-') || id.startsWith('away-');
        const stubLooksReal = !!stubAway && stubAway.length >= 7 && !stubAway.some((p) => isSynthetic(String(p.id)));
        let awayPlayers = stubLooksReal ? stubAway : undefined;
        if (!awayPlayers) {
          const roster = await fetchOpponentRoster({ clubName: opponent!.name, clubShort: opponent!.shortName });
          if (roster) awayPlayers = roster.players;
          else if (stubAway && stubAway.length >= 7) awayPlayers = stubAway; // último recurso
        }
        const { input, homePlayers } = buildQuickPlanInputs({
          players,
          playerHealth,
          // PONTE Fase 4 — a moral do vestiário chega ao motor.
          moralById: playerMoral,
          lineup: lineup as Record<string, string>,
          homeShort: club.shortName,
          awayShort: opponent!.shortName,
          awayStrength: opponent!.strength ?? 72,
          intensity: intensityRef.current,
          seed,
          awaySeedKey: `${opponent!.id}|away`,
          awayPlayers,
        });
        homePlayersRef.current = homePlayers;
        awayLineupRef.current = input.awayLineup;
        baseStrengthRef.current = { home: input.homeStrength, away: input.awayStrength };
        // Formação inicial salva pelo manager ENTRA no 1º tempo (antes só valia a
        // partir do intervalo): remapeia os roles → muda a matchup matrix no Python.
        input.homeLineup = applyFormationToPayloads(input.homeLineup, formationRef.current);
        // Boost PASSIVO das lendas titulares no lineup enviado ao Python — a
        // presença da lenda já pesa na simulação (sem depender do buff manual).
        input.homeLineup = applyLegacyBoostToLineup(input.homeLineup, legacyBoosters);
        // FABLE — revanche contra o nêmesis = clássico MECÂNICO no Python.
        input.isDerby = isDerbyMatch;
        input.homeDna = homeDnaRef.current;
        const fetched = await fetchQuickPlan(input);
        if (!fetched) {
          setError(L('Não foi possível gerar a partida (motor offline). Tente novamente.', 'Could not generate the match (engine offline). Try again.'));
          setPhase('error');
          return;
        }
        planIdsRef.current = [fetched.plano_id];
        setPlan(fetched);
        setPhase('kickoff');
        // Pré-busca a narração IA (Sonnet) em paralelo ao kickoff — não bloqueia.
        // Chega antes do 1º beat na maioria das vezes; senão, cai no texto Python.
        fetchQuickNarration(fetched, { home: club.name, away: opponent!.name })
          .then((n) => { if (n) setNarration(n); })
          .catch(() => { /* degradação graciosa */ });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase('error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOpponent]);

  // Kickoff 3-2-1
  useEffect(() => {
    if (phase !== 'kickoff') return undefined;
    if (countdown <= 0) {
      setPhase('playing');
      return undefined;
    }
    // Com o campo aberto, a contagem espera a ENTRADA EM CAMPO (~5 s).
    const t = window.setTimeout(() => setCountdown((c) => c - 1), aoVivo ? 1700 : 700);
    return () => window.clearTimeout(t);
  }, [phase, countdown]);

  // Ritmo fixo 1x: as durações por tier (quickPlanTypes) já miram ~30s de jogo.
  // Sem compressão dinâmica — previsível e calibrável num lugar só.
  const speedMultiplier = 1.0;

  // ── PARTIDA VIVA (docs/PARTIDA-VIVA-PLANO.md, Fase 1) ──────────────────────
  // A mesma partida, vista em campo. O QuickPlanPlayer publica o que mostra no
  // canal; o palco só desenha — placar, decisões e crédito seguem daqui.
  const canalRef = useRef(criarCanalAoVivo());
  const [aoVivo, setAoVivo] = useState(aoVivoInicial);
  const abrirCampo = useCallback(() => {
    void deitarTela(); // dentro do toque: tela cheia + deitada no Android
    ligarSom(); // o navegador só libera áudio dentro de um toque
    setAoVivo(true);
  }, []);
  const fecharCampo = useCallback(() => setAoVivo(false), []);
  // Modo de assistir (Fase 3): só muda o RITMO de exibição — nunca o desfecho.
  const [modoVivo, setModoVivo] = useState<'lances' | 'completa'>('lances');
  const [velVivo, setVelVivo] = useState<1 | 2 | 4>(1);
  const [pulando, setPulando] = useState(false);
  // "Pular" corre o relógio até o próximo lance (ou gol, ou decisão) e para.
  useEffect(() => {
    if (!pulando) return undefined;
    return canalRef.current.assinar(() => {
      const q = canalRef.current.ultimo();
      if (q && (q.lance || q.gol || q.fase !== 'playing')) setPulando(false);
    });
  }, [pulando]);
  const relogioVivo = !aoVivo ? undefined : pulando ? 50 : Math.round((modoVivo === 'completa' ? 2600 : 240) / velVivo);
  useEffect(() => {
    if (phase === 'finished' || phase === 'error') void levantarTela();
  }, [phase]);
  useEffect(() => () => { void levantarTela(); }, []);
  const fichasAoVivo = useMemo(() => {
    if (!plan) return [];
    const awayEnt = new Map((opponent?.genesisAwayPlayers ?? []).map((p) => [String(p.id), p]));
    const classe = (id: string) => plan.classes?.[id];
    return [
      ...montarFichas(
        'home',
        homePlayersRef.current.map((v) => ({ id: v.id, nome: v.name, pos: v.pos, fadiga: v.fatigue, entidade: players[v.id], classe: classe(v.id) })),
        lineup as Record<string, string>,
      ),
      ...montarFichas(
        'away',
        awayLineupRef.current.map((p) => ({ id: p.id, nome: p.name, pos: p.pos, fadiga: p.fatigue ?? 0, velocidade: p.velocidade, entidade: awayEnt.get(p.id), classe: classe(p.id) })),
      ),
    ];
    // Fichas fixadas quando o plano chega (subs ao vivo entram na Fase 4).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.seed]);

  // LEGACY (Fase 4c): fichas dos reservas — o rosto de quem entra arrastado do banco.
  const fichasDoBanco = useMemo(() => {
    if (!plan) return [];
    const classe = (id: string) => plan.classes?.[id];
    return montarFichas('home', bench.slice(0, 11).map((v) => ({ id: v.id, nome: v.name, pos: v.pos, fadiga: v.fatigue, entidade: players[v.id], classe: classe(v.id) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.seed, bench.length]);

  // Batedores de pênalti: top finalizadores em campo (recalcula após subs/replan).
  const penaltyTakers = useMemo<PenaltyTaker[]>(() => {
    return [...homePlayersRef.current]
      .sort((a, b) => b.payload.finalizacao - a.payload.finalizacao)
      .slice(0, 4)
      .map((p) => ({
        id: p.id,
        name: p.name,
        finalizacao: p.payload.finalizacao,
        portrait: players[p.id] ? playerPortraitSrc(players[p.id]!, 48, 48) : null,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, players]);

  // LEGACY: lendas (isLegacy) titulares dão um buff de time ativável na partida.
  // Deriva o destaque (label + %) do legacyTeamBooster de cada uma.
  const legacyBoosters = useMemo(() => {
    const BOOSTER_LABEL: Record<string, string> = {
      morale: 'MORAL', possession_pct: 'POSSE', attack: 'ATAQUE', defense: 'DEFESA',
      finalizacao: 'FINALIZAÇÃO', velocidade: 'VELOCIDADE', passe: 'PASSE',
    };
    const ids = Object.values(lineup).filter((v): v is string => typeof v === 'string');
    const out: { id: string; name: string; label: string; pct: number }[] = [];
    for (const id of ids) {
      const p = players[id];
      if (!p || !p.isLegacy) continue;
      const entries = Object.entries(p.legacyTeamBooster ?? {});
      let label = 'ATAQUE';
      let pct = 2;
      if (entries.length) {
        entries.sort((a, b) => Number(b[1]) - Number(a[1]));
        const [k, v] = entries[0]!;
        label = BOOSTER_LABEL[k] ?? k.toUpperCase();
        pct = Math.max(1, Math.min(6, Math.round(Number(v) || 2)));
      }
      out.push({ id, name: p.name, label, pct });
    }
    return out.slice(0, 3);
  }, [players, lineup]);

  // Mapa de TODAS as lendas do ELENCO (não só titulares) → buff. Permite que uma
  // lenda que ENTRA por substituição também ofereça o buff. Antes o buff só lia o
  // lineup do kickoff, então o legacy substituído "não carregava" (bug do JUCA).
  const legacyLookup = useMemo(() => {
    const BOOSTER_LABEL: Record<string, string> = {
      morale: 'MORAL', possession_pct: 'POSSE', attack: 'ATAQUE', defense: 'DEFESA',
      finalizacao: 'FINALIZAÇÃO', velocidade: 'VELOCIDADE', passe: 'PASSE',
    };
    const map: Record<string, { name: string; label: string; pct: number }> = {};
    for (const p of Object.values(players)) {
      if (!p.isLegacy) continue;
      const entries = Object.entries(p.legacyTeamBooster ?? {});
      let label = 'ATAQUE';
      let pct = 2;
      if (entries.length) {
        entries.sort((a, b) => Number(b[1]) - Number(a[1]));
        const [k, v] = entries[0]!;
        label = BOOSTER_LABEL[k] ?? k.toUpperCase();
        pct = Math.max(1, Math.min(6, Math.round(Number(v) || 2)));
      }
      map[p.id] = { name: p.name, label, pct };
    }
    return map;
  }, [players]);

  // QuickHomePlayerView → SquadCard (5 cards + banco).
  const toSquadCard = useCallback(
    (p: QuickHomePlayerView): SquadCard => ({
      id: p.id,
      name: p.name,
      pos: p.pos,
      ovr: p.ovr,
      fatigue: p.fatigue,
      portrait: players[p.id] ? playerPortraitSrc(players[p.id]!, 48, 48) : null,
      fairPlay: players[p.id]?.attrs.fairPlay ?? 70,
    }),
    [players],
  );

  // Resolver de foto pro feed (item 8): home tem retrato; away é sintético.
  const portraitOf = useCallback(
    (actorId: string | undefined, side: 'home' | 'away' | undefined): string | null => {
      if (!actorId || side === 'away') return null;
      const p = players[actorId];
      return p ? playerPortraitSrc(p, 48, 48) : null;
    },
    [players],
  );

  // Seam do intervalo: abre o painel, espera a decisão, replaneja o 2º tempo
  const onSecondHalf = useCallback(async (ctx: QuickPlanHalftimeContext): Promise<MatchPlan | null> => {
    setHalftimeCtx(ctx);
    return new Promise<MatchPlan | null>((resolve) => {
      htResolverRef.current = resolve;
    });
  }, []);

  // LEGACY (Fase 4b): grito/ordem no campo → o servidor refaz o plano a partir
  // de minuto+3 (o passado não muda). Mesma entrada do replan do intervalo.
  const comandosRef = useRef<ComandoAoVivo[]>([]);
  const pedirReplan = useCallback(
    async (
      cmd: ComandoSemMinuto | null,
      ctx: ContextoDoReplan,
    ): Promise<MatchPlan | null> => {
      // cmd null = substituição no campo (Fase 4c): o replan só leva o elenco novo.
      if (cmd) comandosRef.current = [...comandosRef.current, { ...cmd, minuto: ctx.minuto } as ComandoAoVivo];
      const inicio = ctx.minuto + 3;
      // 1º tempo: replan nunca começa depois do 45' — o do intervalo leva o comando.
      if ((ctx.minuto <= 45 && inicio > 45) || inicio > 90) return null;
      const homeLineup = applyLegacyBoostToLineup(
        applyFormationToPayloads(
          // Quem entrou do banco chega com o fôlego dele (o servidor não cobra os minutos no banco).
          homePlayersRef.current.map((p) => (ctx.entradas[p.id] != null ? { ...p.payload, entrou_em: ctx.entradas[p.id] } : p.payload)),
          formationRef.current,
        ),
        homePlayersRef.current.map((p) => legacyLookup[p.id]).filter((b): b is { name: string; label: string; pct: number } => !!b),
      );
      const novo = await fetchQuickPlan({
        seed: seedRef.current,
        homeShort: club.shortName,
        awayShort: opponent!.shortName,
        homeStrength: baseStrengthRef.current.home,
        awayStrength: baseStrengthRef.current.away,
        intensity: intensityRef.current,
        isDerby: isDerbyMatch,
        homeDna: homeDnaRef.current,
        homeLineup,
        awayLineup: awayLineupRef.current,
        mode: 'from_minute',
        fromMinute: inicio,
        estado: {
          home_score: ctx.homeScore, away_score: ctx.awayScore, momentum_end: ctx.momentumEnd,
          cards_home: ctx.cardsHome, cards_away: ctx.cardsAway, sent_off_home: ctx.sentOffHome, sent_off_away: ctx.sentOffAway,
        },
        decisions: ctx.ledger.map((d) => ({ beat_id: d.beat_id, choice_id: d.choice_id, channel: d.channel, target_side: d.target_side, weight: d.weight })),
        comandos: comandosRef.current,
      }).catch(() => null);
      if (novo) planIdsRef.current = [...planIdsRef.current, novo.plano_id];
      return novo;
    },
    [club.shortName, opponent, legacyLookup, isDerbyMatch],
  );

  const resumeFromHalftime = useCallback(
    async (ht: HalftimeResult) => {
      const ctx = halftimeCtx;
      setHalftimeCtx(null);
      homePlayersRef.current = ht.homePlayers;
      intensityRef.current = ht.intensity;
      formationRef.current = ht.formation;
      const resolve = htResolverRef.current;
      htResolverRef.current = null;
      if (!ctx || !resolve) return;
      try {
        // Formação remapeia os roles → muda a matchup matrix de verdade.
        const homeLineupRaw = applyFormationToPayloads(
          ht.homePlayers.map((p) => p.payload),
          ht.formation,
        );
        // Boost PASSIVO das lendas que ESTÃO em campo no 2º tempo (inclui quem
        // entrou por substituição) — derivado do elenco vivo, não do kickoff.
        const htBoosters = ht.homePlayers
          .map((p) => legacyLookup[p.id])
          .filter((b): b is { name: string; label: string; pct: number } => !!b);
        const homeLineup = applyLegacyBoostToLineup(homeLineupRaw, htBoosters);
        const replan = await fetchQuickPlan({
          seed: seedRef.current,
          homeShort: club.shortName,
          awayShort: opponent!.shortName,
          homeStrength: baseStrengthRef.current.home,
          awayStrength: baseStrengthRef.current.away,
          intensity: ht.intensity,
          isDerby: isDerbyMatch, // clássico continua quente no 2º tempo
          homeDna: homeDnaRef.current, // o DNA não muda no intervalo

          homeLineup,
          awayLineup: awayLineupRef.current, // mesmo adversário do 1º tempo
          mode: 'second_half',
          comandos: comandosRef.current, // gritos/ordens do Legacy seguem valendo no 2º tempo
          firstHalf: {
            home_score: ctx.homeScore,
            away_score: ctx.awayScore,
            momentum_end: ctx.momentumEnd,
            cards_home: ctx.cardsHome,
            cards_away: ctx.cardsAway,
            sent_off_home: ctx.sentOffHome,
            sent_off_away: ctx.sentOffAway,
          },
          decisions: ctx.ledger.map((d) => ({
            beat_id: d.beat_id,
            choice_id: d.choice_id,
            channel: d.channel,
            target_side: d.target_side,
            weight: d.weight,
          })),
        });
        if (replan) planIdsRef.current = [...planIdsRef.current, replan.plano_id];
        resolve(replan);
        // Re-narra o 2º tempo (novos beats/gols 46-90) e mescla na narração viva.
        if (replan) {
          fetchQuickNarration(replan, { home: club.name, away: opponent!.name })
            .then((n) => {
              if (!n) return;
              setNarration((prev) => prev
                ? { beats: { ...prev.beats, ...n.beats }, goals: { ...prev.goals, ...n.goals }, reading: n.reading ?? prev.reading }
                : n);
            })
            .catch(() => { /* mantém narração do 1º tempo */ });
        }
      } catch {
        resolve(null);
      }
    },
    [halftimeCtx, club.shortName, opponent, legacyLookup, isDerbyMatch],
  );

  // DISPUTA DE PÊNALTIS: monta os dados (elenco vivo + goleiros) a partir dos
  // refs com atributos. Desgaste de 90' na fadiga — quem entrou de fora chega
  // mais fresco (recompensa o sub tático na hora da disputa).
  const buildShootout = useCallback((): ShootoutSetup | null => {
    const MATCH_WEAR = 26;
    const wear = (f: number | undefined) => Math.min(100, (f ?? 0) + MATCH_WEAR);
    const home = homePlayersRef.current;
    const away = awayLineupRef.current;
    if (!home.length || !away.length) return null;

    const homeOutfield: ShootoutKicker[] = home
      .filter((p) => p.payload.role !== 'gk')
      .map((p) => ({
        id: p.id, name: p.name, pos: p.pos,
        finalizacao: p.payload.finalizacao, fisico: p.payload.fisico,
        // FABLE — cicatriz pesa AQUI: pênalti perdido não curado = -8 de
        // confiança na disputa; medalha (clutch/redenção) = +5.
        confianca: Math.max(0, Math.min(100, p.payload.confianca + scarShootoutConfidenceDelta(playerScars?.[p.id]))),
        fatigue: wear(p.payload.fatigue), portrait: players[p.id] ? playerPortraitSrc(players[p.id]!, 40, 40) : null,
      }));
    const awayOutfield: ShootoutKicker[] = away
      .filter((p) => p.role !== 'gk')
      .map((p) => ({
        id: p.id, name: p.name, pos: p.pos,
        finalizacao: p.finalizacao, fisico: p.fisico, confianca: p.confianca, fatigue: wear(p.fatigue),
      }));
    if (homeOutfield.length < 5 || awayOutfield.length < 1) return null;

    const homeGk = home.find((p) => p.payload.role === 'gk');
    const awayGk = away.find((p) => p.role === 'gk');
    const homeKeeper: ShootoutKeeper = homeGk
      ? { id: homeGk.id, name: homeGk.name, marcacao: homeGk.payload.marcacao, confianca: homeGk.payload.confianca, fisico: homeGk.payload.fisico, fatigue: wear(homeGk.payload.fatigue) }
      : { id: 'h-gk', name: L('Goleiro', 'Goalkeeper'), marcacao: 62, confianca: 60, fisico: 65, fatigue: MATCH_WEAR };
    const awayKeeper: ShootoutKeeper = awayGk
      ? { id: awayGk.id, name: awayGk.name, marcacao: awayGk.marcacao, confianca: awayGk.confianca, fisico: awayGk.fisico, fatigue: wear(awayGk.fatigue) }
      : { id: 'a-gk', name: L('Goleiro', 'Goalkeeper'), marcacao: 62, confianca: 60, fisico: 65, fatigue: MATCH_WEAR };

    return { homeKickers: homeOutfield, awayKickers: awayOutfield, homeKeeper, awayKeeper };
  }, [players, playerScars]);

  // FABLE — Eco do agente: traços por playerId (agentProfile → risco/confiança).
  const agentTraits = useMemo<Record<string, AgentEchoTrait>>(() => {
    const out: Record<string, AgentEchoTrait> = {};
    for (const p of Object.values(players)) {
      const prof = p.agentProfile;
      if (!prof) continue;
      out[p.id] = {
        risk: prof.riskProfile?.baseRisk ?? 50,
        confidence: prof.learningState?.confidence ?? 50,
      };
    }
    return out;
  }, [players]);

  // FASE 6 — o filme: cada montagem do palco é um trecho; cada entrega, uma linha do roteiro.
  const trechosRef = useRef<(Trecho & { montagem: number; formacaoCasa: string })[]>([]);
  const gravar = useCallback((m: { id: number; comEntrada: boolean }, passo: number, q: QuadroAoVivo) => {
    let t = trechosRef.current[trechosRef.current.length - 1];
    if (!t || t.montagem !== m.id) {
      t = { montagem: m.id, comEntrada: m.comEntrada, formacaoCasa: formationRef.current, roteiro: [] };
      trechosRef.current.push(t);
    }
    gravarEntrega(t, passo, q);
  }, []);
  const [filmeId, setFilmeId] = useState<string | null>(null);

  const creditedRef = useRef(false);
  const onComplete = useCallback((_p: MatchPlan, r: QuickPlanPlayResult) => {
    setResult(r);
    setPhase('finished');
    // FASE 6 — guarda o filme no aparelho (só se a partida foi vista em campo).
    const trechos = trechosRef.current.filter((t) => t.roteiro.length > 3);
    if (trechos.length && plan && opponent) {
      const id = `${plan.seed}-${Date.now().toString(36)}`;
      const filme: Filme = {
        v: 1, id, quando: new Date().toISOString(), seed: plan.seed,
        siglaCasa: club.shortName, siglaFora: opponent.shortName, nomeCasa: club.name, nomeFora: opponent.name,
        placarCasa: r.homeScore, placarFora: r.awayScore,
        formacaoCasa: trechos[0]!.formacaoCasa, formacaoFora: '4-3-3',
        fichas: fichasAoVivo, banco: fichasDoBanco,
        trechos: trechos.map(({ comEntrada, roteiro, formacaoCasa }) => ({ comEntrada, roteiro, formacaoCasa })),
      };
      if (salvarFilme(filme)) setFilmeId(id);
      // FASE 7 — sobe pro servidor; se o adversário é o time de outro manager, ele é avisado.
      void enviarFilme(filme, opponent.id);
    }
    // CRÉDITO DE PROGRESSÃO (Fase D): credita XP/economia/evolução/fadiga +
    // Manager IQ uma única vez por partida.
    if (creditedRef.current) return;
    creditedRef.current = true;
    const homeStats: Record<string, { passesOk: number; passesAttempt: number; tackles: number; km: number; rating: number; shotsOn?: number; goals?: number }> = {};
    for (const p of homePlayersRef.current) {
      const t = r.playerStats[p.id];
      homeStats[p.id] = { passesOk: 0, passesAttempt: 0, tackles: 0, km: 0, rating: matchRating(p.ovr, t), shotsOn: t?.shots ?? 0, goals: t?.goals ?? 0 };
    }
    // SMART-PROFILE Fase 2A: foto do estado ANTES do crédito, pro modo sombra.
    const antesDoCredito = getGameState();
    dispatch({
      type: 'FINALIZE_QUICK_PLAN',
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      reading: r.reading,
      homeStats,
      homeOnPitch: r.homeOnPitch,
      agg: { shots: r.stats.homeShots, possessionHome: r.stats.possessionHome, wasLosing: r.stats.wasLosing },
      mvpName: _p.mvp_projection?.name,
      shootoutWin: r.shootout?.winner,
      // FABLE — DNA (estilos ao vivo + formação) e Cicatrizes (pênaltis + herói do fim).
      styleLog: r.styleLog,
      formation: formationRef.current,
      shootoutKicks: r.shootout?.homeKicks,
      lateHeroIds: r.lateHeroIds,
    });
    relatarPartidaSombra({
      seed: _p.seed,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      shootoutWin: r.shootout?.winner,
      readingGood: r.reading.good,
      homeStats,
      planos: planIdsRef.current,
      antes: antesDoCredito,
      depois: getGameState(),
      // FASE 2C: quando o servidor responde, a conta dele vale.
      aoAplicar: (jogadores) => dispatch({ type: 'APLICAR_EVOLUCAO_DO_SERVIDOR', jogadores }),
    });
  }, [dispatch, plan, opponent, fichasAoVivo, fichasDoBanco, club.name, club.shortName]);

  // ── Render ────────────────────────────────────────────────────────────
  if (!hasOpponent) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center px-5">
        <div className="flex w-full max-w-sm flex-col items-start gap-5">
          <p className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">— {aoVivo ? 'Legacy' : L('Partida rápida', 'Quick match')}</p>
          {buscandoAdversario ? (
            <p className="font-voz text-[34px] leading-[1.02] text-papel animate-pulse">
              {L('Procurando adversário…', 'Finding an opponent…')}
            </p>
          ) : (
            <>
              <p className="font-voz text-[30px] leading-[1.05] text-papel">
                {buscaFalhou
                  ? L('Não deu pra procurar adversário agora — confira a conexão.', 'Could not search for an opponent right now — check your connection.')
                  : L('Nenhum adversário disponível para a partida rápida.', 'No opponent available for the quick match.')}
              </p>
              {buscaFalhou && (
                <BotaoRua onClick={buscarAdversarioDeNovo}>
                  {L('Procurar de novo', 'Search again')} <span aria-hidden>→</span>
                </BotaoRua>
              )}
            </>
          )}
          <Link to="/" className="inline-flex min-h-[44px] items-center font-impact text-[18px] uppercase text-suave hover:text-papel">
            {L('← Voltar', '← Back')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex min-w-0 items-center justify-between gap-3 mb-4">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">
              — {aoVivo ? 'Legacy' : L('Partida rápida', 'Quick match')}
            </span>
            {isDerbyMatch && (
              <SeloRua tom="corre" className="-rotate-2">{L('Clássico', 'Derby')}</SeloRua>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {(phase === 'kickoff' || phase === 'playing') && !aoVivo && (
              <button
                type="button"
                onClick={abrirCampo}
                className="min-h-[40px] bg-rua px-3 font-impact text-[15px] uppercase leading-none text-asfalto-27 shadow-[3px_3px_0_var(--color-papel)]"
              >
                {L('Ver em campo', 'Watch on pitch')}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="min-h-[40px] shrink-0 px-1 font-prova text-[12px] font-bold uppercase tracking-[0.18em] text-mudo hover:text-papel"
            >
              {L('Sair', 'Exit')}
            </button>
          </span>
        </div>

        {phase === 'loading' && (
          <p className="py-20 text-center font-voz text-[30px] leading-none text-suave animate-pulse">{L('Preparando o time…', 'Preparing the team…')}</p>
        )}

        {phase === 'error' && (
          <div className="border-l-[3px] border-baixa bg-concreto px-4 py-4">
            <p className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-baixa">{L('Motor fora do ar', 'Engine down')}</p>
            <p className="mt-1.5 text-[13px] text-suave">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-3 min-h-[40px] font-impact text-[17px] uppercase text-rua hover:text-papel"
            >
              ← Home
            </button>
          </div>
        )}

        {phase === 'kickoff' && (
          <div className="flex flex-col gap-6 py-2">
            <ConvocacaoRua
              homeName={club.name}
              awayName={opponent!.name}
              rotuloEsq={aoVivo ? 'Legacy' : L('Partida rápida', 'Quick match')}
              rotuloDir={isDerbyMatch ? L('Clássico', 'Derby') : L('Agora', 'Now')}
              frase={L('Quem chega com respeito, entra.', 'Walk in with respect.')}
            />
            <div className="flex items-center justify-center py-4" aria-live="polite">
              <motion.span
                key={countdown}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="font-spray font-black leading-none text-rua"
                style={{ fontSize: 'clamp(6rem, 34vw, 10rem)' }}
              >
                {countdown > 0 ? countdown : L('BOLA!', 'GO!')}
              </motion.span>
            </div>
          </div>
        )}

        {(phase === 'playing' || phase === 'finished') && plan && (
          <QuickPlanPlayer
            key={plan.seed}
            plan={plan}
            resultadoExp={lastBonuses && lastBonuses.length > 0 ? calculateTotalBonusRewards(lastBonuses).exp : null}
            narration={narration ?? undefined}
            buildShootout={buildShootout}
            speedMultiplier={speedMultiplier}
            onSecondHalf={onSecondHalf}
            onComplete={onComplete}
            portraitOf={portraitOf}
            homeCrestUrl={homeCrestUrl}
            awayCrestUrl={opponent!.supporterCrestUrl ?? null}
            homeName={club.name}
            awayName={opponent!.name}
            penaltyTakers={penaltyTakers}
            legacyBoosters={legacyBoosters}
            legacyLookup={legacyLookup}
            agentTraits={agentTraits}
            onAoVivo={canalRef.current.publicar}
            registrarResposta={canalRef.current.registrarResponder}
            golEsperaCampo={aoVivo}
            pedirReplan={aoVivo ? pedirReplan : undefined}
            segurarLance={aoVivo ? (ev) => Math.round(msParaMostrar(ev.cadeia) / velVivo) : undefined}
            relogioMs={relogioVivo}
            initialFormation={formationRef.current}
            fieldCards={homePlayersRef.current.map(toSquadCard)}
            awayCards={awayLineupRef.current.map((p) => ({
              id: p.id,
              name: p.name,
              pos: p.pos,
              ovr: Math.round((p.finalizacao + p.passe + p.marcacao + p.velocidade + p.fisico + p.confianca) / 6),
              fatigue: p.fatigue ?? 0,
              portrait: null,
              fairPlay: p.fair_play ?? 70,
            }))}
            benchCards={bench.map(toSquadCard)}
            onSubstitution={(outId, inId) => {
              // Mantém o elenco vivo do pai em sincronia (replan do intervalo + pênalti).
              const inView = bench.find((b) => b.id === inId);
              if (!inView) return;
              homePlayersRef.current = homePlayersRef.current.map((p) =>
                p.id === outId ? { ...inView, payload: { ...inView.payload, role: p.payload.role } } : p,
              );
            }}
            secondHalfLineup={() => {
              // Elenco vivo APÓS o intervalo: o QuickPlanPlayer usa pra reconhecer a
              // lenda que ENTROU no 2º tempo e oferecer o buff dela (request #2).
              const fieldCards = homePlayersRef.current.map(toSquadCard);
              const starterIds = new Set(homePlayersRef.current.map((p) => p.id));
              const benchCards = Object.values(players)
                .filter((p) => {
                  if (starterIds.has(p.id)) return false;
                  const h = playerHealth?.[p.id];
                  if (h) return (h.outForMatches ?? 0) <= 0 && (h.suspendedMatches ?? 0) <= 0;
                  return (p.outForMatches ?? 0) <= 0;
                })
                .map((p) => playerToHomeView(p, getEffectiveFatigue(p.id, p, playerHealth)))
                .sort((a, b) => b.effective - a.effective)
                .slice(0, 8)
                .map(toSquadCard);
              return { field: fieldCards, bench: benchCards };
            }}
          />
        )}

        {aoVivo && (phase === 'playing' || phase === 'kickoff') && plan && fichasAoVivo.length >= 14 && (
          <Suspense fallback={null}>
            <PartidaVivaPalco
              canal={canalRef.current}
              fichas={fichasAoVivo}
              formacaoCasa={formationRef.current}
              formacaoFora="4-3-3"
              seed={plan.seed}
              siglaCasa={club.shortName}
              siglaFora={opponent!.shortName}
              modo={modoVivo}
              velocidade={velVivo}
              pulando={pulando}
              onModo={setModoVivo}
              onVelocidade={setVelVivo}
              onPular={() => setPulando(true)}
              onSair={fecharCampo}
              comEntrada={phase === 'kickoff'}
              banco={fichasDoBanco}
              gravar={gravar}
            />
          </Suspense>
        )}

        {phase === 'finished' && result && (
          <div className="mt-6 flex flex-col gap-5">
            {/* FASE 6 — o filme da partida vista em campo, pra reassistir. */}
            {filmeId && (
              <button
                type="button"
                onClick={() => { ligarSom(); navigate(`/match/filme/${encodeURIComponent(filmeId)}`); }}
                className="flex items-center justify-between border border-papel bg-rua px-4 py-3 text-left text-asfalto-27"
              >
                <span>
                  <span className="block font-impact text-[22px] leading-none">{L('Reassistir em campo', 'Rewatch on the pitch')}</span>
                  <span className="mt-1 block font-prova text-[11px]">{L('O filme da partida · Câmera do Craque', 'The match film · Star Cam')}</span>
                </span>
                <span aria-hidden className="font-impact text-[26px]">▶</span>
              </button>
            )}
            {/* O RESULTADO (spray + voz + MVP em post-it + fita de EXP) agora mora
                no fim do QuickPlanPlayer — uma peça só, sem MVP duplicado. */}

            {/* Rival fantasma (#6) — recorde pessoal superado: dopamina + bragging. */}
            {newRecord && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="-rotate-1 self-start bg-ouro-27 px-4 py-2.5 text-asfalto-27"
              >
                <p className="font-prova text-[11px] font-bold uppercase tracking-[0.18em]">
                  {L('Novo recorde pessoal', 'New personal record')}
                </p>
                <p className="font-spray font-black text-[34px] leading-none tabular-nums">
                  {result.homeScore}×{result.awayScore}
                </p>
              </motion.div>
            )}

            {/* CARD VIRAL DO MOMENTO (#1/#7/#8/#9/#10) — manchete + raridade + MVP +
                story strip + compartilhar com link de indicação. Só aparece quando
                o desfecho é digno de print (vitória ou jogo raro). */}
            {(() => {
              const drawScore = result.homeScore === result.awayScore;
              const won = result.homeScore > result.awayScore || (drawScore && result.shootout?.winner === 'home');
              const draw = drawScore && !result.shootout;
              const res: 'win' | 'draw' | 'loss' = won ? 'win' : draw ? 'draw' : 'loss';
              const rarity = computeQuickRarity({
                homeScore: result.homeScore,
                awayScore: result.awayScore,
                won,
                draw,
                wasLosing: result.stats.wasLosing,
                possessionHome: result.stats.possessionHome,
                shotsHome: result.stats.homeShots,
                bonusCount: lastBonuses?.length ?? 0,
                cleanSheet: result.awayScore === 0 && result.homeScore > 0,
                hattrick: !!lastBonuses?.some((b) => b.id === 'hattrick'),
                streak: quickStreak?.current ?? 0,
              });
              // Mostra o card em vitória OU quando o jogo foi raro (virada épica, etc.).
              if (!won && !rarity.shareWorthy) return null;
              const mvp = plan?.mvp_projection
                ? { name: plan.mvp_projection.name, goals: plan.mvp_projection.goals, rating: plan.mvp_projection.rating }
                : null;
              return (
                <div className="flex flex-col gap-3">
                  <SecaoRua label={L('Pro print', 'For the feed')} />
                  <QuickShareCard
                    clubName={club.name}
                    opponentName={opponent!.name}
                    homeScore={result.homeScore}
                    awayScore={result.awayScore}
                    result={res}
                    rarity={rarity}
                    mvp={mvp}
                    form={form}
                    referralCode={referralCode}
                  />
                </div>
              );
            })()}

            {/* A CONTA DA PARTIDA (Fase 3.2) — o motor de consequências persistentes
                já rodava em silêncio: cartão vira suspensão + moral abalado + multa,
                hat-trick vira moral em alta + valor de mercado. Aqui o manager
                finalmente VÊ a corrente causal do jogo que acabou de jogar. */}
            <MatchConsequences playerNames={playerNames} />

            {/* EVOLUÇÃO DO TIME — o manager VÊ que não perdeu tempo: o time melhorou. */}
            {lastEvolution && (lastEvolution.risers.length > 0 || lastEvolution.teamOvrAfter > 0) && (() => {
              const teamUp = lastEvolution.teamOvrAfter - lastEvolution.teamOvrBefore;
              const risers = lastEvolution.risers.slice(0, 4);
              return (
                <div className="bg-concreto px-5 py-4">
                  <SecaoRua
                    label={L('Seu time evoluiu', 'Your team improved')}
                    aside={
                      <span className={teamUp >= 0 ? 'text-alta' : 'text-baixa'}>
                        {lastEvolution.teamOvrBefore.toFixed(1)} → {lastEvolution.teamOvrAfter.toFixed(1)}
                      </span>
                    }
                    className="mb-3"
                  />
                  {risers.length > 0 ? (
                    <ul className="flex flex-col">
                      {risers.map((r) => (
                        <li key={r.id} className="flex min-h-[48px] min-w-0 items-center gap-3 border-b border-linha last:border-b-0">
                          {players[r.id] ? (
                            <img src={playerPortraitSrc(players[r.id]!, 32, 32)} alt="" className="h-8 w-8 shrink-0 rounded-full bg-asfalto-27 object-cover" />
                          ) : (
                            <span className="h-8 w-8 shrink-0 rounded-full bg-asfalto-27" />
                          )}
                          <span className="min-w-0 flex-1 truncate font-voz text-[20px] leading-none text-papel">{r.name}</span>
                          <span className="shrink-0 font-prova text-[10px] font-bold uppercase tracking-[0.1em] text-mudo">{posLabel(r.pos)}</span>
                          <span className="shrink-0 font-impact text-[17px] tabular-nums text-alta">{r.ovrBefore}→{r.ovrAfter}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-suave">{L('O elenco segurou o nível. Vença pra acelerar a evolução.', 'The squad held its level. Win to speed up progress.')}</p>
                  )}
                </div>
              );
            })()}

            {/* FABLE — DNA DO CLUBE: a marca desta partida no eixo
                Romântico ↔ Pragmático (halo/chifres do futebol). */}
            {clubDna && clubDna.lastShift !== 0 && (() => {
              const pct = Math.max(0, Math.min(100, (clubDna.axis + 100) / 2));
              const romantic = clubDna.lastShift > 0;
              return (
                <div className="bg-concreto px-5 py-4">
                  <SecaoRua
                    label={L('DNA do clube', 'Club DNA')}
                    aside={
                      <span className={romantic ? 'text-rua' : 'text-suave'}>
                        {romantic ? '+' : ''}{clubDna.lastShift} {romantic ? L('Romântico', 'Romantic') : L('Pragmático', 'Pragmatic')}
                      </span>
                    }
                    className="mb-3"
                  />
                  <div className="relative h-2 bg-linha">
                    <div className="absolute top-1/2 h-4 w-1.5 -translate-y-1/2 bg-rua" style={{ left: `calc(${pct}% - 3px)` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo">{L('Pragmático', 'Pragmatic')}</span>
                    <span className="truncate font-voz text-[18px] leading-none text-papel">{dnaLabel(clubDna.axis)}</span>
                    <span className="font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo">{L('Romântico', 'Romantic')}</span>
                  </div>
                </div>
              );
            })()}

            {/* Ponte #1 — BÔNUS DE PERFORMANCE: o "efeito uau" que estava sendo
                calculado e jogado no lixo agora aparece (revelação progressiva). */}
            {lastBonuses && lastBonuses.length > 0 && (
              <div className="bg-concreto px-5 py-4">
                <QuickPerformanceBonusPanel
                  bonuses={lastBonuses}
                  totalOle={calculateTotalBonusRewards(lastBonuses).ole}
                  totalExp={calculateTotalBonusRewards(lastBonuses).exp}
                />
              </div>
            )}

            {/* Ponte #2 — DESAFIOS SEMANAIS: o gancho de retorno ("volta amanhã")
                agora progride e fica visível no modo mais jogado. */}
            {streakChallenges && streakChallenges.challenges.length > 0 && (
              <div className="bg-concreto px-5 py-4">
                {/* #4 — celebra desafio recém-concluído (surpresa + endowed progress). */}
                {(() => {
                  const justDone = streakChallenges.challenges.filter((c) => c.completed && !c.claimed);
                  if (!justDone.length) return null;
                  return (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mb-4 -rotate-1 bg-rua px-3 py-2.5 text-asfalto-27"
                    >
                      <p className="font-prova text-[10.5px] font-bold uppercase tracking-[0.18em]">
                        {L('✓ Desafio concluído', '✓ Challenge complete')}
                      </p>
                      <p className="mt-0.5 font-voz text-[19px] leading-[1.05]">
                        {justDone.map((c) => c.name).join(' · ')} — {L('resgate a recompensa.', 'claim your reward.')}
                      </p>
                    </motion.div>
                  );
                })()}
                <QuickStreakChallengesPanel challenges={streakChallenges.challenges} />
              </div>
            )}

            {/* #11 DESTAQUES DO ELENCO — torna VISÍVEIS os atributos que já pesam no
                motor (drible/tático/mentalidade) mas eram invisíveis ao manager. */}
            {(() => {
              const xi = homePlayersRef.current.map((p) => players[p.id]).filter((p): p is NonNullable<typeof p> => !!p);
              if (!xi.length) return null;
              const shortNm = (n: string) => n.match(/"([^"]+)"/)?.[1] ?? n.split(/\s+/)[0] ?? n;
              const cats: { label: string; key: 'drible' | 'tatico' | 'mentalidade' }[] = [
                { label: L('Driblador', 'Dribbler'), key: 'drible' },
                { label: L('Cérebro', 'Brain'), key: 'tatico' },
                { label: L('Frieza', 'Composure'), key: 'mentalidade' },
              ];
              const picks = cats
                .map((c) => {
                  const best = xi.reduce((b, p) => (p.attrs[c.key] > b.attrs[c.key] ? p : b), xi[0]!);
                  return best.attrs[c.key] >= 72 ? { ...c, name: shortNm(best.name), val: best.attrs[c.key] } : null;
                })
                .filter((x): x is NonNullable<typeof x> => !!x);
              if (!picks.length) return null;
              return (
                <div className="bg-concreto px-5 py-4">
                  <SecaoRua label={L('Destaques do elenco', 'Squad highlights')} className="mb-2" />
                  <ul className="flex flex-col">
                    {picks.map((p) => (
                      <li key={p.key} className="flex min-h-[46px] min-w-0 items-center gap-3 border-b border-linha last:border-b-0">
                        <span className="w-[5.5rem] shrink-0 font-prova text-[10px] font-bold uppercase tracking-[0.12em] text-mudo">{p.label}</span>
                        <span className="min-w-0 flex-1 truncate font-voz text-[20px] leading-none text-papel">{p.name}</span>
                        <span className="shrink-0 font-impact text-[20px] tabular-nums text-papel">{p.val}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {/* LIGA OLE — continuação da campanha (avançou / campeão / eliminado) */}
            {isLigaOleMatchRef.current && (() => {
              // FABLE — a persona do treinador rival deixa o recado (NPC com
              // opinião): ele perdeu → 'lost'; ele te eliminou → 'eliminated_you'.
              const rivalId = ligaOpponentIdRef.current;
              const rivalQuote = rivalId
                ? (() => {
                    const persona = coachPersonaFor(rivalId);
                    const situation = ligaFlash?.outcome === 'eliminated' ? 'eliminated_you' as const : 'lost' as const;
                    return { persona, line: personaLine(rivalId, situation, String(result.homeScore * 10 + result.awayScore)) };
                  })()
                : null;
              const rivalQuoteEl = (tom: 'escuro' | 'claro') =>
                rivalQuote ? (
                  <p className={tom === 'escuro' ? 'mt-3 text-[13px] text-asfalto-27/80' : 'mt-3 text-[13px] text-suave'}>
                    {rivalQuote.persona.icon} {rivalQuote.persona.label}, {L('treinador rival', 'rival coach')} —{' '}
                    <span className="font-voz text-[18px] leading-none">“{rivalQuote.line}”</span>
                  </p>
                ) : null;
              if (ligaFlash?.outcome === 'champion') {
                return (
                  <div className="relative overflow-hidden bg-ouro-27 px-5 py-5 text-asfalto-27">
                    <Hashtag className="mb-1 font-prova text-asfalto-27/75">{L('#ligaole #campeão', '#ligaole #champion')}</Hashtag>
                    <p className="font-impact uppercase leading-[0.95]" style={{ fontSize: 'clamp(32px, 10vw, 52px)' }}>{club.name}</p>
                    <p className="mt-1 font-voz text-[28px] leading-none">{L('Levantou a taça.', 'Lifted the trophy.')}</p>
                    {rivalQuoteEl('escuro')}
                    <BotaoRua variante="asfalto" onClick={() => navigate('/liga-ole')} className="mt-4 w-full">
                      {L('Ver Liga Ole', 'View Liga Ole')} <span aria-hidden>→</span>
                    </BotaoRua>
                  </div>
                );
              }
              if (ligaFlash?.outcome === 'eliminated') {
                return (
                  <div className="border-l-[3px] border-baixa bg-concreto px-5 py-5">
                    <Hashtag className="mb-1 font-prova text-baixa">{L('#ligaole #eliminado', '#ligaole #eliminated')}</Hashtag>
                    <p className="font-impact uppercase leading-none text-papel" style={{ fontSize: 'clamp(26px, 7.5vw, 38px)' }}>{L('Caiu nas', 'Out in the')} {ligaFlash.reachedRound}</p>
                    <p className="mt-1 font-voz text-[24px] leading-none text-suave">{L('Perdeu hoje. Volta amanhã.', 'Lost today. Back tomorrow.')}</p>
                    {rivalQuoteEl('claro')}
                    <BotaoRua variante="contorno" onClick={() => navigate('/liga-ole')} className="mt-4 w-full">
                      {L('Ver Liga Ole', 'View Liga Ole')}
                    </BotaoRua>
                  </div>
                );
              }
              if (ligaOle?.status === 'active') {
                return (
                  <div className="relative overflow-hidden bg-rua px-5 py-5 text-asfalto-27">
                    <span aria-hidden className="rua-alambrado absolute inset-x-0 top-0 h-24 [--alambrado:rgba(13,13,12,0.22)]" />
                    <Hashtag className="relative mb-1 font-prova text-asfalto-27/75">#ligaole</Hashtag>
                    <p className="relative font-impact uppercase leading-[0.95]" style={{ fontSize: 'clamp(26px, 8vw, 40px)' }}>{emIngles() ? `${club.name} advanced!` : `${club.name} avançou de fase!`}</p>
                    <p className="relative mt-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.18em]">{L('Próxima', 'Next')}: {LIGA_OLE_ROUNDS[ligaOle.roundIndex]}</p>
                    {rivalQuoteEl('escuro')}
                    <BotaoRua variante="asfalto" onClick={() => navigate('/liga-ole')} className="relative mt-4 w-full">
                      {L('Avançar', 'Continue')} <span aria-hidden>→</span>
                    </BotaoRua>
                  </div>
                );
              }
              return null;
            })()}

            {/*
              LEGENDS CUP — o CTA promocional. Aparece tenha o manager ganhado
              ou perdido: quem venceu quer o card que o derrotou junto do seu,
              quem perdeu quer a arma que o venceu. É o motivo do Cup existir —
              a lenda ganha em VENDA, não em EXP.
              `?from=legendscup` fica na URL pra dar pra medir a conversão.
            */}
            {isLegendsCupMatchRef.current && (facedLegendsRef.current?.length ?? 0) > 0 && (() => {
              const legends = facedLegendsRef.current!;
              const star = legends[0]!;
              const won = result.homeScore > result.awayScore;
              return (
                <div className="border-[3px] border-ouro-27 bg-asfalto-27 p-4">
                  <Hashtag className="font-prova text-ouro-27">#legendscup</Hashtag>
                  <p className="mt-2 font-voz text-[24px] leading-[1.05] text-papel">
                    {won
                      ? L(`Você venceu ${star.name}. Agora imagine ele do seu lado.`, `You beat ${star.name}. Now imagine him on your side.`)
                      : L(`${star.name} decidiu contra você. Ele pode ser seu.`, `${star.name} decided it against you. He can be yours.`)}
                  </p>

                  <div className="mt-4 flex gap-2.5 overflow-x-auto pb-1">
                    {legends.slice(0, 5).map((l) => (
                      <Link
                        key={l.id}
                        to={`/mercado/transfer?legacy=${encodeURIComponent(l.id)}&from=legendscup`}
                        className="w-[76px] shrink-0 overflow-hidden bg-ouro-27 text-asfalto-27 transition-transform hover:-translate-y-0.5"
                      >
                        <div className="relative aspect-[3/4] bg-asfalto-27">
                          {l.portraitUrl ? (
                            <img src={l.portraitUrl} alt={l.name} loading="lazy" referrerPolicy="no-referrer"
                              className="h-full w-full object-cover object-[50%_18%]" />
                          ) : (
                            <div className="grid h-full place-items-center font-prova text-[10px] text-mudo">{L('sem foto', 'no photo')}</div>
                          )}
                          <span className="absolute left-0 top-0 bg-ouro-27 px-1.5 py-0.5 font-impact text-[13px] leading-none text-asfalto-27">
                            {l.ovr}
                          </span>
                        </div>
                        <p className="truncate px-1.5 py-1 font-impact text-[11px] uppercase leading-none">{l.name}</p>
                      </Link>
                    ))}
                  </div>

                  <Link
                    to="/mercado/transfer?from=legendscup"
                    className="mt-4 flex min-h-[50px] w-full items-center justify-center gap-2 bg-ouro-27 font-impact text-[19px] uppercase leading-none text-asfalto-27 transition-colors hover:bg-papel"
                  >
                    {L('Contratar uma lenda', 'Sign a legend')} <span aria-hidden>→</span>
                  </Link>
                </div>
              );
            })()}

            <div className="mt-1 flex flex-col gap-3 pb-4">
              {!isLigaOleMatchRef.current && (
                <BotaoRua onClick={() => navigate(0)} className="w-full">
                  {L('Jogar de novo', 'Play again')} <span aria-hidden>→</span>
                </BotaoRua>
              )}
              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex min-h-[48px] w-full items-center justify-center font-impact text-[17px] uppercase text-suave transition-colors hover:text-papel"
              >
                {L('Voltar para a Home', 'Back to Home')}
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {halftimeCtx && (
          <QuickHalftimePanel
            homeShort={club.shortName}
            awayShort={opponent!.shortName}
            homeScore={halftimeCtx.homeScore}
            awayScore={halftimeCtx.awayScore}
            homePlayers={homePlayersRef.current}
            bench={bench}
            intensity={intensityRef.current}
            formation={formationRef.current}
            maxSubs={Math.max(0, 5 - halftimeCtx.subsUsed)}
            onResume={resumeFromHalftime}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

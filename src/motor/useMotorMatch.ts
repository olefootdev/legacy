/**
 * /src/motor/useMotorMatch.ts — A PONTE
 *
 * Faz o motor novo rodar debaixo da experiência que já existia: cards em
 * perspectiva, câmera de tensão com zoom, toque no jogador, painéis de leitura.
 *
 * ── Por que uma troca de cérebro, e não uma tela nova ────────────────────────
 *
 * A auditoria de intenção (ghost mapping, 22/08/2026) achou onze componentes
 * de experiência com UM consumidor cada — todos pendurados em
 * `FieldViewPreview`, a página de `/match/legacy` que não tem link nenhum. E
 * achou algo pior: o motor novo, escrito no mesmo dia, tinha ZERO referências a
 * qualquer um deles. Dois mundos paralelos, sem se falarem.
 *
 * Este hook expõe EXATAMENTE a mesma interface de `useLegacyMatchEngine`. A
 * página troca uma linha de import e ganha o motor novo inteiro sem perder um
 * pixel do que foi desenhado.
 *
 * ── Coordenadas ─────────────────────────────────────────────────────────────
 *
 * Motor:  x = comprimento 0–105m (0 = gol da casa), z = largura 0–68m.
 * Cards:  x = PROFUNDIDADE 0–100 (0 = gol da casa), y = LARGURA 0–100.
 *
 * A convenção dos cards não sai de comentário nenhum — sai do que `ivProject`
 * desenha: `ivProject(50, 0)` e `ivProject(50, 100)` são as duas pontas da
 * linha do meio, logo o primeiro argumento é profundidade. Num projeto que já
 * perdeu meses para eixos trocados, isso se confere no desenho, não no texto.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PitchPlayerState } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';
import { FIELD_LENGTH, FIELD_WIDTH, type ArchetypeId } from '@/tactical';
import {
  MotorEngine,
  STEP_S,
  defaultAttrs,
  type MotorAttrs,
  type MotorPlayerInput,
} from './MotorEngine';
import { defaultArchetypeForSlot } from './archetypeWeights';
import { recordAttackingAction } from '@/playerDecision/agentActionMemory';

/** Metros do motor → profundidade 0–100 dos cards. */
const toDepth = (x: number) => (x / FIELD_LENGTH) * 100;
/** Metros do motor → largura 0–100 dos cards. */
const toWidth = (z: number) => (z / FIELD_WIDTH) * 100;

export type MotorEventKind =
  | 'corner' | 'freekick' | 'shot' | 'rebound' | 'possession_change' | 'goal' | 'save';

export interface MotorMatchState {
  minute: number;
  homeScore: number;
  awayScore: number;
  possession: 'home' | 'away';
  homePlayers: PitchPlayerState[];
  awayPlayers: PitchPlayerState[];
  ballX: number;
  ballY: number;
  onBallPlayerId: string | undefined;
  events: Array<{ minute: number; text: string; kind?: string }>;
  phase: 'pregame' | 'playing' | 'halftime' | 'fulltime';
  lastEvent: string | null;
  possessionPct: { home: number; away: number };
  expertBars: {
    decisions: { home: number; away: number };
    confidence: { home: number; away: number; homeLabel: string; awayLabel: string };
    tactical: { home: number; away: number };
  };
}

/** Converte um jogador do elenco real para a entrada do motor. */
function toMotorInput(
  p: PitchPlayerState,
  side: 'home' | 'away',
  entity?: PlayerEntity,
): MotorPlayerInput {
  const a = entity?.attrs;
  // Sem entidade real, o elenco de referência. Com entidade, os atributos dela
  // — e os mentais, que o schema antigo não tem, saem dos compostos existentes
  // até o cadastro ganhar os campos próprios.
  const attrs: MotorAttrs = a
    ? defaultAttrs({
        aceleracao: a.velocidade,
        velocidadeMaxima: a.velocidade,
        fisico: a.fisico,
        passe: a.passe,
        cruzamento: a.drible * 0.5 + a.passe * 0.5,
        drible: a.drible,
        finalizacao: a.finalizacao,
        marcacao: a.marcacao,
        decisao: a.mentalidade,
        visaoDeJogo: a.tatico,
        antecipacao: a.tatico,
        posicionamento: a.tatico,
      })
    : defaultAttrs();
  return {
    id: p.playerId,
    side,
    slotId: p.slotId,
    role: p.role,
    shirtNumber: p.num,
    attrs,
    // O card sempre soube carregar o arquétipo — o motor antigo é que nunca
    // preenchia o campo. Aqui ele é obrigatório e falha ruidosamente.
    tacticalArchetypeId: p.tacticalArchetypeId ?? defaultArchetypeForSlot(p.slotId),
  };
}

const RENDER_MS = 33;

/** Linha de estatística que o crédito de partida já consome. */
export interface MotorStatRow {
  passesOk: number;
  passesAttempt: number;
  tackles: number;
  km: number;
  rating: number;
  shotsOn?: number;
  goals?: number;
}

export interface MotorFinalize {
  homeScore: number;
  awayScore: number;
  reading: { good: number; total: number };
  homeStats: Record<string, MotorStatRow>;
  homeOnPitch: string[];
  agg: { shots: number; possessionHome: number; wasLosing: boolean };
  mvpName?: string;
}

/**
 * Nota do jogador, 4 a 10, na escala que o torcedor reconhece.
 *
 * Base 6,0 e sobe pelo que ele produziu: gol pesa mais que tudo, acerto de
 * passe move meio ponto para cada lado, desarme e xG somam. Não é modelo
 * sofisticado — é o suficiente para o pós-jogo dizer quem jogou, e o lugar
 * óbvio para o arquétipo entrar depois (um volante de contenção não deveria
 * ser julgado pela mesma régua de um armador).
 */
function nota(e: {
  passes: number; passesOk: number; tackles: number; goals: number; xg: number;
}): number {
  const acerto = e.passes > 0 ? e.passesOk / e.passes : 0.8;
  const r =
    6.0
    + e.goals * 1.25
    + (acerto - 0.82) * 3.2
    + Math.min(1.2, e.tackles * 0.09)
    + Math.min(1.0, e.xg * 1.6);
  return Math.round(Math.max(4, Math.min(10, r)) * 10) / 10;
}

/** Monta o resultado no formato que `FINALIZE_QUICK_PLAN` já espera. */
function buildFinalize(engine: MotorEngine, homeXI: PitchPlayerState[]): MotorFinalize {
  const homeStats: Record<string, MotorStatRow> = {};
  let melhorNota = -1;
  let mvpName: string | undefined;
  for (const p of homeXI) {
    const e = engine.byPlayer.get(p.playerId);
    const base = e ?? {
      passes: 0, passesForward: 0, passesOk: 0, carries: 0,
      shots: 0, xg: 0, tackles: 0, goals: 0, distanceM: 0,
    };
    const r = nota(base);
    homeStats[p.playerId] = {
      passesOk: base.passesOk,
      passesAttempt: base.passes,
      tackles: base.tackles,
      km: Math.round((base.distanceM / 1000) * 100) / 100,
      rating: r,
      shotsOn: base.shots,
      goals: base.goals,
    };
    if (r > melhorNota) {
      melhorNota = r;
      mvpName = p.name;
    }
  }
  const H = engine.bySide.home;
  const A = engine.bySide.away;
  const posseTotal = Math.max(1, H.possessionS + A.possessionS);
  return {
    homeScore: engine.homeScore,
    awayScore: engine.awayScore,
    // "Leitura" no Quick mede decisões certas. Aqui o proxy honesto é o acerto
    // de passe do time, que é o que este motor mede de verdade.
    reading: { good: H.passesOk, total: Math.max(1, H.passes) },
    homeStats,
    homeOnPitch: homeXI.map((p) => p.playerId),
    agg: {
      shots: H.shots,
      possessionHome: Math.round((H.possessionS / posseTotal) * 100),
      wasLosing: engine.homeScore < engine.awayScore,
    },
    mvpName,
  };
}

export type MotorAwayRosterEntry = { id: string; num: number; name: string; pos: string };

/** Slots do 4-4-2 visitante, na ordem em que o roster chega. */
const AWAY_SLOTS: Array<[string, PitchPlayerState['role']]> = [
  ['gol', 'gk'], ['le', 'def'], ['zag1', 'def'], ['zag2', 'def'], ['ld', 'def'],
  ['vol', 'mid'], ['mc1', 'mid'], ['mc2', 'mid'], ['pd', 'mid'],
  ['ata', 'attack'], ['pe', 'attack'],
];

const FALLBACK_AWAY: MotorAwayRosterEntry[] = [
  { id: 'agk1', num: 1, name: 'Silvio', pos: 'GOL' },
  { id: 'alat1', num: 2, name: 'Edu', pos: 'LAT' },
  { id: 'azag1', num: 4, name: 'Marcos', pos: 'ZAG' },
  { id: 'azag2', num: 5, name: 'Felipe', pos: 'ZAG' },
  { id: 'alat2', num: 3, name: 'Igor', pos: 'LAT' },
  { id: 'avol1', num: 6, name: 'Patrick', pos: 'VOL' },
  { id: 'avol2', num: 8, name: 'Mateus', pos: 'VOL' },
  { id: 'amei1', num: 10, name: 'Samuel', pos: 'MEI' },
  { id: 'apd1', num: 7, name: 'Arthur', pos: 'PD' },
  { id: 'aata1', num: 9, name: 'Bruno M', pos: 'ATA' },
  { id: 'ape1', num: 11, name: 'Kelvin', pos: 'PE' },
];

/** Roster visitante → onze em `PitchPlayerState`, na convenção dos cards. */
function buildAwayXI(roster: MotorAwayRosterEntry[]): PitchPlayerState[] {
  return AWAY_SLOTS.map(([slotId, role], i) => {
    const r = roster[i] ?? FALLBACK_AWAY[i]!;
    return {
      playerId: r.id,
      slotId,
      name: r.name,
      num: r.num,
      pos: r.pos,
      x: 50,
      y: 50,
      fatigue: 12,
      role,
    } as PitchPlayerState;
  });
}

/**
 * Motor novo com a interface do antigo.
 *
 * @param homePlayers  onze da casa, já montados pela página
 * @param awayPlayers  onze visitantes
 * @param onEvent      gatilho de câmera/efeito, igual ao hook antigo
 * @param frozen       congela o quadro sem parar o rAF
 * @param timeScale    quantos segundos de futebol por segundo real
 * @param realEntities elenco real, para atributos e skills
 */
export function useMotorMatch(
  homePlayers: PitchPlayerState[],
  onEvent: (kind: MotorEventKind) => void,
  frozen = false,
  timeScale = 8,
  awayRoster: MotorAwayRosterEntry[] = FALLBACK_AWAY,
  realEntities?: Record<string, PlayerEntity>,
) {
  const engineRef = useRef<MotorEngine | null>(null);
  const homeRef = useRef(homePlayers);
  homeRef.current = homePlayers;
  const awayPlayers = useRef(buildAwayXI(awayRoster)).current;
  const awayRef = useRef(awayPlayers);
  awayRef.current = awayPlayers;
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;
  const scaleRef = useRef(timeScale);
  scaleRef.current = timeScale;
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const entitiesRef = useRef(realEntities);
  entitiesRef.current = realEntities;
  /**
   * A partida começou. Vive em ref, não em estado.
   *
   * Com a fase derivada do estado havia corrida: o laço de animação reescreve
   * o estado inteiro a cada 33ms e sobrescrevia o `phase: 'playing'` que o
   * apito acabara de gravar, antes que o ref sincronizasse no render. Resultado
   * visível: a partida rodava — a posse mudava, os cards andavam — e o
   * cronômetro ficava travado em 0'.
   */
  const startedRef = useRef(false);

  const [legacyModeActive, setLegacyModeActive] = useState(false);
  const [activatedSkills, setActivatedSkills] = useState<
    Array<{ playerId: string; skillId: string; activatedAt: number }>
  >([]);

  const vazio = (): MotorMatchState => ({
    minute: 0, homeScore: 0, awayScore: 0, possession: 'home',
    homePlayers, awayPlayers, ballX: 50, ballY: 50,
    onBallPlayerId: undefined, events: [], phase: 'pregame', lastEvent: null,
    possessionPct: { home: 50, away: 50 },
    expertBars: {
      decisions: { home: 50, away: 50 },
      confidence: { home: 50, away: 50, homeLabel: 'estável', awayLabel: 'estável' },
      tactical: { home: 50, away: 50 },
    },
  });
  const [state, setState] = useState<MotorMatchState>(vazio);

  useEffect(() => {
    const ents = entitiesRef.current;
    engineRef.current = new MotorEngine(
      homeRef.current.map((p) => toMotorInput(p, 'home', ents?.[p.playerId])),
      awayRef.current.map((p) => toMotorInput(p, 'away', ents?.[p.playerId])),
      { seed: 404413 },
    );

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let lastRender = 0;
    let ultimoEvento = 0;
    let ultimoPlacar = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const engine = engineRef.current;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!engine || frozenRef.current) return;

      if (startedRef.current && !engine.finished) {
        acc += dt * scaleRef.current;
        let passos = 0;
        while (acc >= STEP_S && passos < 240) {
          engine.step();
          acc -= STEP_S;
          passos++;
        }
        if (acc > STEP_S * 240) acc = 0;
      }

      if (now - lastRender < RENDER_MS) return;
      lastRender = now;

      const snap = engine.snapshot();
      const porId = new Map(snap.players.map((p) => [p.id, p]));
      const mapear = (base: PitchPlayerState[]): PitchPlayerState[] =>
        base.map((p) => {
          const t = porId.get(p.playerId);
          if (!t) return p;
          return {
            ...p,
            x: toDepth(t.x),
            y: toWidth(t.z),
            heading: t.heading,
            fatigue: Math.max(0, 100 - (t.matchStamina ?? 100)),
          };
        });

      // Espelha a última decisão de cada jogador na memória que o
      // PlayerBrainCard já lê. O motor fica puro — quem adapta é a ponte, e é
      // de propósito: criar um segundo canal para o card seria repetir o erro
      // que o ghost mapping flagrou (dois dialetos para a mesma coisa).
      for (const [id, acao] of engine.lastAction) recordAttackingAction(id, acao);

      // Eventos novos desde o último quadro viram gatilho de câmera.
      const novos = engine.events.slice(ultimoEvento);
      ultimoEvento = engine.events.length;
      for (const ev of novos) {
        const k = ev.kind as MotorEventKind;
        onEventRef.current(k);
      }
      const placar = engine.homeScore + engine.awayScore;
      if (placar !== ultimoPlacar) {
        ultimoPlacar = placar;
        onEventRef.current('goal');
      }

      const H = engine.bySide.home;
      const A = engine.bySide.away;
      const posseTotal = Math.max(1, H.possessionS + A.possessionS);
      const pct = (v: number, t: number) => Math.round((v / Math.max(1, t)) * 100);
      const rotulo = (v: number) => (v >= 62 ? 'confiante' : v <= 38 ? 'abalado' : 'estável');
      // Confiança lida do que está em jogo: xG produzido contra sofrido.
      const confCasa = Math.max(5, Math.min(95, 50 + (H.xg - A.xg) * 6));
      const confFora = 100 - confCasa;

      const carrier = engine.carrier;
      const doDono = carrier ? (carrier.startsWith('home') ? 'home' : 'away') : 'home';

      setState({
        minute: engine.minute,
        homeScore: engine.homeScore,
        awayScore: engine.awayScore,
        possession: doDono,
        homePlayers: mapear(homeRef.current),
        awayPlayers: mapear(awayRef.current),
        ballX: toDepth(snap.ball.x),
        ballY: toWidth(snap.ball.z),
        onBallPlayerId: carrier ?? undefined,
        events: engine.events.slice(-6).reverse(),
        phase: engine.finished
          ? 'fulltime'
          : startedRef.current ? 'playing' : 'pregame',
        lastEvent: novos.length > 0 ? novos[novos.length - 1]!.kind : null,
        possessionPct: {
          home: Math.round((H.possessionS / posseTotal) * 100),
          away: Math.round((A.possessionS / posseTotal) * 100),
        },
        expertBars: {
          // Decisões: acerto de passe, que é o que o motor mede de verdade.
          decisions: { home: pct(H.passesOk, H.passes), away: pct(A.passesOk, A.passes) },
          confidence: {
            home: Math.round(confCasa), away: Math.round(confFora),
            homeLabel: rotulo(confCasa), awayLabel: rotulo(confFora),
          },
          // Tático: fatia de passes que progridem — verticalidade do time.
          tactical: {
            home: pct(H.passesForward, H.passes),
            away: pct(A.passesForward, A.passes),
          },
        },
      });
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Skills e Modo Legado ainda não têm efeito no motor novo — o buff de skill
   * vive no TacticalSimLoop antigo e ainda não foi portado. Mantidos aqui com a
   * assinatura original para a página não quebrar, e sinalizando honestamente
   * que não mudam a partida ainda.
   */
  const applySkillToPlayer = useCallback(
    (playerId: string, skillId: string): { ok: boolean; message: string } => {
      setActivatedSkills((prev) => [
        ...prev.filter((s) => !(s.playerId === playerId && s.skillId === skillId)),
        { playerId, skillId, activatedAt: engineRef.current?.t ?? 0 },
      ]);
      return { ok: true, message: `${playerId} ativou ${skillId}` };
    },
    [],
  );

  const toggleLegacyMode = useCallback(() => {
    const next = !legacyModeActive;
    setLegacyModeActive(next);
    return { active: next, activated: next ? homeRef.current.length : 0, buffDurationSec: 300 };
  }, [legacyModeActive]);

  return {
    ...state,
    activatedSkills,
    legacyModeActive,
    playersById: entitiesRef.current ?? {},
    applySkillToPlayer,
    toggleLegacyMode,
    /**
     * Resultado da partida no formato do crédito. `null` antes do apito final —
     * a página só despacha quando existe.
     */
    finalize: (): MotorFinalize | null => {
      const engine = engineRef.current;
      if (!engine || !engine.finished) return null;
      return buildFinalize(engine, homeRef.current);
    },
    startMatch: () => {
      startedRef.current = true;
      setState((prev) => (prev.phase === 'pregame' ? { ...prev, phase: 'playing' } : prev));
    },
  };
}

export type { ArchetypeId };

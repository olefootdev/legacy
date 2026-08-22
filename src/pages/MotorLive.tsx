/**
 * /dev/motor — o motor novo rodando na tela, em RETRATO.
 *
 * Campo inteiro num telefone em pé: 105 × 68m cabem em 390 × 602pt, sobrando
 * espaço para o HUD. Ninguém precisa virar o aparelho, e o que a tela comunica
 * é FORMA COLETIVA — com token de ~10pt não existe drible visível, existe bloco
 * que sobe, linha que quebra, time que desliza. É por isso que as medidas de
 * compactação da régua de realismo são, ao mesmo tempo, a barra de qualidade
 * visual deste modo.
 *
 * Esta tela consome o motor direto, sem game store: é bancada de observação.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MotorEngine,
  STEP_S,
  HALF_SECONDS,
  defaultAttrs,
  type MotorPlayerInput,
} from '@/motor/MotorEngine';
import { defaultArchetypeForSlot } from '@/motor/archetypeWeights';
import type { MatchTruthSnapshot } from '@/bridge/matchTruthSchema';
import {
  FIELD_LENGTH,
  FIELD_WIDTH,
  PENALTY_AREA_DEPTH_M,
  PENALTY_AREA_HALF_W_M,
  GOAL_AREA_DEPTH_M,
  GOAL_AREA_HALF_W_M,
  CENTER_CIRCLE_RADIUS_M,
  PENALTY_SPOT_M,
  GOAL_INNER_WIDTH_M,
} from '@/tactical';

// ── Escalação ─────────────────────────────────────────────────────────────────

const S433: Array<[string, MotorPlayerInput['role']]> = [
  ['gol', 'gk'], ['zag1', 'def'], ['zag2', 'def'], ['le', 'def'], ['ld', 'def'],
  ['vol', 'mid'], ['mc1', 'mid'], ['mc2', 'mid'],
  ['pe', 'attack'], ['ata', 'attack'], ['pd', 'attack'],
];
const S442: Array<[string, MotorPlayerInput['role']]> = [
  ['gol', 'gk'], ['le', 'def'], ['zag1', 'def'], ['zag2', 'def'], ['ld', 'def'],
  ['vol', 'mid'], ['mc1', 'mid'], ['mc2', 'mid'], ['pd', 'mid'],
  ['ata', 'attack'], ['pe', 'attack'],
];

function buildTeam(
  side: 'home' | 'away',
  slots: Array<[string, MotorPlayerInput['role']]>,
): MotorPlayerInput[] {
  return slots.map(([slot, role], i) => ({
    id: `${side}-${slot}`,
    side,
    slotId: slot,
    role,
    shirtNumber: i + 1,
    attrs: defaultAttrs(),
    tacticalArchetypeId: defaultArchetypeForSlot(slot),
  }));
}

// ── Geometria da tela ─────────────────────────────────────────────────────────

/** Margem em metros ao redor do gramado, para o campo não colar na borda. */
const PAD = 3;
const VB_W = FIELD_WIDTH + PAD * 2;
const VB_H = FIELD_LENGTH + PAD * 2;

/** Mundo → tela. x é profundidade (vira Y invertido), z é largura (vira X). */
const sx = (z: number) => z + PAD;
const sy = (x: number) => FIELD_LENGTH - x + PAD;

const HOME = '#39D98A';
const AWAY = '#FF8A5B';
const LINE = 'rgba(255,255,255,0.34)';

const SPEEDS = [1, 4, 10, 30] as const;

export function MotorLive() {
  const engineRef = useRef<MotorEngine | null>(null);
  const [snap, setSnap] = useState<MatchTruthSnapshot | null>(null);
  const [hud, setHud] = useState({
    minute: 0, home: 0, away: 0, phase: 'live',
    passes: 0, shots: 0, carrier: null as string | null,
  });
  const [speed, setSpeed] = useState<number>(10);
  const [running, setRunning] = useState(true);
  const [seed, setSeed] = useState(404413);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const runningRef = useRef(running);
  runningRef.current = running;

  const reset = useCallback((nextSeed: number) => {
    engineRef.current = new MotorEngine(
      buildTeam('home', S433),
      buildTeam('away', S442),
      { seed: nextSeed },
    );
    setSnap(engineRef.current.snapshot());
  }, []);

  useEffect(() => { reset(seed); }, [seed, reset]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const frame = (now: number) => {
      const engine = engineRef.current;
      raf = requestAnimationFrame(frame);
      const dtReal = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!engine || !runningRef.current || engine.finished) return;

      acc += dtReal * speedRef.current;
      // Teto de passos por quadro: em 30× o motor avança 600 passos por
      // segundo, e não vale travar o navegador para adiantar a partida.
      let steps = 0;
      while (acc >= STEP_S && steps < 220) {
        engine.step();
        acc -= STEP_S;
        steps++;
      }
      if (acc > STEP_S * 220) acc = 0;

      setSnap(engine.snapshot());
      setHud({
        minute: engine.minute,
        home: engine.homeScore,
        away: engine.awayScore,
        phase: engine.phase,
        passes: engine.stats.passes,
        shots: engine.stats.shots,
        carrier: engine.carrier,
      });
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const dead = hud.phase !== 'live';

  return (
    <div style={{
      minHeight: '100svh', background: '#0B140F', color: '#E9ECE4',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', padding: '12px',
    }}>
      {/* Placar */}
      <div style={{
        width: 'min(420px, 100%)', display: 'flex', alignItems: 'baseline',
        justifyContent: 'space-between', padding: '6px 4px 10px',
      }}>
        <span style={{ color: HOME, fontSize: 13, letterSpacing: '0.12em' }}>CASA</span>
        <span style={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {hud.home} <span style={{ opacity: 0.35 }}>:</span> {hud.away}
        </span>
        <span style={{ color: AWAY, fontSize: 13, letterSpacing: '0.12em' }}>FORA</span>
      </div>

      {/* Campo — retrato, campo inteiro */}
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: 'min(420px, 100%)', height: 'auto', display: 'block', borderRadius: 8 }}
        role="img"
        aria-label="Campo de futebol em retrato com os 22 jogadores do motor novo"
      >
        <rect x="0" y="0" width={VB_W} height={VB_H} fill="#12291C" />
        {/* faixas do gramado */}
        {Array.from({ length: 7 }, (_, i) => (
          <rect
            key={i}
            x={PAD} y={PAD + (i * FIELD_LENGTH) / 7}
            width={FIELD_WIDTH} height={FIELD_LENGTH / 7}
            fill={i % 2 ? 'rgba(255,255,255,0.022)' : 'transparent'}
          />
        ))}
        <g fill="none" stroke={LINE} strokeWidth="0.35">
          <rect x={PAD} y={PAD} width={FIELD_WIDTH} height={FIELD_LENGTH} />
          <line x1={PAD} y1={sy(FIELD_LENGTH / 2)} x2={PAD + FIELD_WIDTH} y2={sy(FIELD_LENGTH / 2)} />
          <circle cx={sx(FIELD_WIDTH / 2)} cy={sy(FIELD_LENGTH / 2)} r={CENTER_CIRCLE_RADIUS_M} />
          {/* áreas — casa embaixo, visitante em cima */}
          {[0, 1].map((end) => {
            const nearGoalX = end === 0 ? 0 : FIELD_LENGTH;
            const dir = end === 0 ? 1 : -1;
            const boxY = end === 0
              ? sy(PENALTY_AREA_DEPTH_M)
              : sy(FIELD_LENGTH);
            const sixY = end === 0 ? sy(GOAL_AREA_DEPTH_M) : sy(FIELD_LENGTH);
            return (
              <g key={end}>
                <rect
                  x={sx(FIELD_WIDTH / 2 - PENALTY_AREA_HALF_W_M)}
                  y={end === 0 ? boxY : PAD}
                  width={PENALTY_AREA_HALF_W_M * 2}
                  height={PENALTY_AREA_DEPTH_M}
                />
                <rect
                  x={sx(FIELD_WIDTH / 2 - GOAL_AREA_HALF_W_M)}
                  y={end === 0 ? sixY : PAD}
                  width={GOAL_AREA_HALF_W_M * 2}
                  height={GOAL_AREA_DEPTH_M}
                />
                <circle
                  cx={sx(FIELD_WIDTH / 2)}
                  cy={sy(nearGoalX + dir * PENALTY_SPOT_M)}
                  r="0.4" fill={LINE} stroke="none"
                />
                <rect
                  x={sx(FIELD_WIDTH / 2 - GOAL_INNER_WIDTH_M / 2)}
                  y={end === 0 ? sy(0) : PAD - 1.6}
                  width={GOAL_INNER_WIDTH_M} height={1.6}
                  stroke="rgba(255,255,255,0.6)" strokeWidth="0.4"
                />
              </g>
            );
          })}
        </g>

        {/* Jogadores */}
        {snap?.players.map((p) => {
          const isHome = p.side === 'home';
          const c = isHome ? HOME : AWAY;
          const hasBall = hud.carrier === p.id;
          const isGk = p.role === 'gk';
          return (
            <g key={p.id}>
              {hasBall && (
                <circle cx={sx(p.z)} cy={sy(p.x)} r="3.4" fill={c} opacity="0.22" />
              )}
              <circle
                cx={sx(p.z)} cy={sy(p.x)} r={isGk ? 1.7 : 1.9}
                fill={isGk ? '#0B140F' : c}
                stroke={c}
                strokeWidth={isGk ? 0.7 : 0.35}
              />
              <text
                x={sx(p.z)} y={sy(p.x) + 0.72}
                textAnchor="middle" fontSize="2.1"
                fill={isGk ? c : '#0B140F'} fontWeight="700"
              >
                {p.shirtNumber}
              </text>
            </g>
          );
        })}

        {/* Bola */}
        {snap && (
          <circle
            cx={sx(snap.ball.z)} cy={sy(snap.ball.x)} r="1.05"
            fill="#FFFFFF" stroke="#0B140F" strokeWidth="0.3"
          />
        )}
      </svg>

      {/* HUD */}
      <div style={{
        width: 'min(420px, 100%)', display: 'flex', justifyContent: 'space-between',
        fontSize: 12, opacity: 0.75, padding: '10px 4px 4px', fontVariantNumeric: 'tabular-nums',
      }}>
        <span>{hud.minute}′ {dead ? '· bola parada' : ''}</span>
        <span>{hud.passes} passes · {hud.shots} chutes</span>
      </div>

      {/* Controles */}
      <div style={{
        width: 'min(420px, 100%)', display: 'flex', gap: 6, flexWrap: 'wrap',
        padding: '10px 4px', alignItems: 'center',
      }}>
        <button onClick={() => setRunning((r) => !r)} style={btn(running)}>
          {running ? 'pausar' : 'seguir'}
        </button>
        {SPEEDS.map((s) => (
          <button key={s} onClick={() => setSpeed(s)} style={btn(speed === s)}>{s}×</button>
        ))}
        <button onClick={() => setSeed((x) => x + 1)} style={btn(false)}>outra partida</button>
        <span style={{ fontSize: 11, opacity: 0.45, marginLeft: 'auto' }}>seed {seed}</span>
      </div>

      <p style={{
        width: 'min(420px, 100%)', fontSize: 11.5, opacity: 0.42,
        lineHeight: 1.5, padding: '4px 4px 24px', margin: 0,
      }}>
        Motor novo em tempo de futebol: {HALF_SECONDS * 2}s por partida, sem compressão.
        Campo inteiro em retrato — o que se lê aqui é forma coletiva, não drible.
      </p>
    </div>
  );
}

function btn(active: boolean): React.CSSProperties {
  return {
    background: active ? '#39D98A' : 'transparent',
    color: active ? '#0B140F' : '#E9ECE4',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 4, padding: '5px 11px', fontSize: 12,
    fontFamily: 'inherit', cursor: 'pointer',
  };
}

export default MotorLive;

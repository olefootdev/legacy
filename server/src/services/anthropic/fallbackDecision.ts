import type { GameSpiritDecisionContext, GameSpiritDecisionResult } from './gameSpiritContext.js';
import { T, type Idioma } from '../../lib/idioma.js';

function slugToken(label: string): string {
  return label
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toUpperCase();
}

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

/**
 * Decisão local quando a API falha ou não está configurada.
 * Usa pressão, objectivo e colegas próximos — não é aleatório puro.
 */
export function intelligentFallbackDecision(ctx: GameSpiritDecisionContext, idioma: Idioma = 'pt'): GameSpiritDecisionResult {
  const t = (pt: string, en: string) => T(idioma, pt, en);
  const seed = hash01(`${ctx.player}|${ctx.position}|${ctx.objective}|${ctx.nearbyPlayers.join(',')}`);
  const pressure = String(ctx.pressureLevel).toLowerCase();
  const obj = ctx.objective.toLowerCase();
  const mates = ctx.nearbyPlayers;

  const pickMate = (): string | null => {
    if (!mates.length) return null;
    const idx = Math.floor(seed * mates.length) % mates.length;
    return mates[idx] ?? null;
  };

  let decision = 'recuar';
  let narration = t(`${ctx.player} segura e recua para reorganizar.`, `${ctx.player} holds it and drops back to reorganise.`);

  const mate = pickMate();
  const mateSlug = mate ? slugToken(mate) : '';

  if (!ctx.ballOwner) {
    decision = 'press_or_block_lane';
    narration = t(`${ctx.player} fecha linha de passe e pressiona o portador.`, `${ctx.player} cuts off the passing lane and presses the ball carrier.`);
    return {
      decision,
      confidence: 0.42 + seed * 0.08,
      narration,
    };
  }

  if (pressure === 'high' || pressure === 'extreme') {
    if (mate && (obj.includes('build') || obj.includes('play'))) {
      decision = `pass_to_${mateSlug}`;
      narration = t(`${ctx.player} solta rápido para ${mate} sob pressão.`, `${ctx.player} releases it quickly to ${mate} under pressure.`);
    } else {
      decision = 'recuar';
      narration = t(`${ctx.player} recua com segurança para sair da pressão.`, `${ctx.player} plays it back safely to escape the press.`);
    }
  } else if (obj.includes('shot') || obj.includes('finish') || obj.includes('remate')) {
    decision = 'chutar';
    narration = t(`${ctx.player} procura o remate com espaço favorável.`, `${ctx.player} looks for the shot with space to work.`);
  } else if (obj.includes('dribble') || obj.includes('drible')) {
    decision = 'driblar';
    narration = t(`${ctx.player} conduz e tenta desequilibrar na condução.`, `${ctx.player} drives forward and tries to unbalance the defence.`);
  } else if (mate) {
    const forwardBias = seed > 0.35;
    decision = forwardBias ? `pass_to_${mateSlug}` : 'conduzir';
    narration = forwardBias
      ? t(`${ctx.player} toca para ${mate} para acelerar a jogada.`, `${ctx.player} slips it to ${mate} to speed up the move.`)
      : t(`${ctx.player} conduz a bola procurando melhor linha.`, `${ctx.player} carries the ball looking for a better line.`);
  } else if (seed > 0.55) {
    decision = 'driblar';
    narration = t(`${ctx.player} tenta progredir na condução.`, `${ctx.player} tries to make ground on the ball.`);
  } else {
    decision = 'recuar';
    narration = t(`${ctx.player} recua para manter posse.`, `${ctx.player} drops back to keep possession.`);
  }

  return {
    decision,
    confidence: 0.44 + seed * 0.12,
    narration,
  };
}

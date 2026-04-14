import type { GameSpiritDecisionContext, GameSpiritDecisionResult } from './gameSpiritContext.js';

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
export function intelligentFallbackDecision(ctx: GameSpiritDecisionContext): GameSpiritDecisionResult {
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
  let narration = `${ctx.player} segura e recua para reorganizar.`;

  const mate = pickMate();
  const mateSlug = mate ? slugToken(mate) : '';

  if (!ctx.ballOwner) {
    decision = 'press_or_block_lane';
    narration = `${ctx.player} fecha linha de passe e pressiona o portador.`;
    return {
      decision,
      confidence: 0.42 + seed * 0.08,
      narration,
    };
  }

  if (pressure === 'high' || pressure === 'extreme') {
    if (mate && (obj.includes('build') || obj.includes('play'))) {
      decision = `pass_to_${mateSlug}`;
      narration = `${ctx.player} solta rápido para ${mate} sob pressão.`;
    } else {
      decision = 'recuar';
      narration = `${ctx.player} recua com segurança para sair da pressão.`;
    }
  } else if (obj.includes('shot') || obj.includes('finish') || obj.includes('remate')) {
    decision = 'chutar';
    narration = `${ctx.player} procura o remate com espaço favorável.`;
  } else if (obj.includes('dribble') || obj.includes('drible')) {
    decision = 'driblar';
    narration = `${ctx.player} conduz e tenta desequilibrar na condução.`;
  } else if (mate) {
    const forwardBias = seed > 0.35;
    decision = forwardBias ? `pass_to_${mateSlug}` : 'conduzir';
    narration = forwardBias
      ? `${ctx.player} toca para ${mate} para acelerar a jogada.`
      : `${ctx.player} conduz a bola procurando melhor linha.`;
  } else if (seed > 0.55) {
    decision = 'driblar';
    narration = `${ctx.player} tenta progredir na condução.`;
  } else {
    decision = 'recuar';
    narration = `${ctx.player} recua para manter posse.`;
  }

  return {
    decision,
    confidence: 0.44 + seed * 0.12,
    narration,
  };
}

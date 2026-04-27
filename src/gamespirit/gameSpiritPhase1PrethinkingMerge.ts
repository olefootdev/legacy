import type { DecisionContext, PrethinkingIntent } from '@/playerDecision/types';
import { identifyFieldZone } from '@/playerDecision/ContextScanner';

function decisionTokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean);
}

/**
 * Traduz texto curto da API (decision) para intenção de prethinking, só quando a confiança é alta.
 *
 * Regras de continuidade:
 *  - Nunca substitui intenções defensivas críticas por algo ofensivo frágil.
 *  - Nunca inverte a direção da jogada quando a equipa está a progredir
 *    (e.g., "recuar" com bola no meio-campo ofensivo é ignorado).
 *  - Quando a intenção base já é ofensiva (atacar_espaco, finalizar_rapido),
 *    um hint de "recuar" é descartado para manter a continuidade visual.
 */
export function applyPhase1HintToPrethinkingIntent(
  base: PrethinkingIntent,
  ctx: DecisionContext,
  hint: NonNullable<DecisionContext['gameSpiritPhase1Hint']>,
): PrethinkingIntent {
  const now = Date.now();
  if (now > hint.expiresAtMs) return base;

  const FADE_MS = 1200;
  const remaining = hint.expiresAtMs - now;
  const fadeFactor = remaining < FADE_MS ? remaining / FADE_MS : 1;
  const effectiveConfidence = hint.confidence * fadeFactor;
  if (effectiveConfidence < 0.52) return base;

  const d = hint.decision.toLowerCase();
  const tok = decisionTokens(d);

  const teamHasBall = ctx.possession === ctx.self.side;

  const wantsPass =
    d.includes('pass')
    || d.includes('passe')
    || d.includes('toca')
    || tok.some((t) => t.startsWith('pass_to'));
  const wantsDribble =
    d.includes('drib')
    || d.includes('conduz')
    || d.includes('carry')
    || d.includes('progred');
  const wantsShoot = d.includes('chut') || d.includes('shoot') || d.includes('remat') || d.includes('finaliz');
  const wantsRetreat = d.includes('recuar') || d.includes('retreat') || d.includes('reorgan');
  const wantsPress =
    d.includes('press')
    || d.includes('pressao')
    || d.includes('fechar')
    || d.includes('bloqueio')
    || d.includes('intercept');

  const zone = identifyFieldZone(ctx.self.x, ctx.attackDir);
  const inOffensiveZone = zone === 'opp_box' || zone === 'att_third' || zone === 'att_mid' || zone === 'mid';
  const baseIsOffensive =
    base === 'atacar_espaco'
    || base === 'finalizar_rapido'
    || base === 'tabela'
    || base === 'passe_rapido';

  if (wantsRetreat && teamHasBall && inOffensiveZone) return base;
  if (wantsRetreat && baseIsOffensive) return base;

  if (ctx.isReceiver && wantsPass) return 'passe_rapido';
  if (ctx.isReceiver && wantsRetreat) return 'proteger_bola';

  if (teamHasBall && ctx.isCarrier) {
    if (wantsShoot) return 'finalizar_rapido';
    if (wantsPass) return 'passe_rapido';
    if (wantsDribble) return 'atacar_espaco';
    if (wantsRetreat) return 'proteger_bola';
  }

  if (!teamHasBall && wantsPress && (ctx.carrierId || !ctx.possession)) {
    return 'pressionar_portador';
  }

  if (teamHasBall && !ctx.isCarrier && wantsPass) return 'passe_rapido';
  if (teamHasBall && !ctx.isCarrier && wantsDribble) return 'atacar_espaco';

  return base;
}

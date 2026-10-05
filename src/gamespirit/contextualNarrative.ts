/**
 * Narração contextual rica — reage ao placar, minuto, momentum e situação emocional.
 * Fase 1 — Quick Win #6
 */

import type { SpiritContext, SpiritOutcome } from './types';
import * as T from './narrativeTemplates';
import { L } from '@/i18n/L';

interface NarrativeContext {
  minute: number;
  homeScore: number;
  awayScore: number;
  scoreDiff: number;
  momentum?: { home: number; away: number };
  homeShort: string;
  awayShort: string;
  isLateGame: boolean;
  isDesperateTime: boolean;
}

function extractContext(ctx: SpiritContext, awayShort: string): NarrativeContext {
  const scoreDiff = ctx.homeScore - ctx.awayScore;
  return {
    minute: ctx.minute,
    homeScore: ctx.homeScore,
    awayScore: ctx.awayScore,
    scoreDiff,
    momentum: ctx.momentum,
    homeShort: ctx.homeShort ?? L('Casa', 'Home'),
    awayShort,
    isLateGame: ctx.minute >= 75,
    isDesperateTime: ctx.minute >= 85,
  };
}

/** Narração contextual para GOLS — reage ao timing e placar. */
export function contextualGoalNarrative(
  event: SpiritOutcome,
  ctx: SpiritContext,
  awayShort: string,
  scorerName: string,
): string | null {
  const nc = extractContext(ctx, awayShort);
  const scorerSide = event.goalFor;
  if (!scorerSide) return null;

  const isHome = scorerSide === 'home';
  const newScoreDiff = isHome ? nc.scoreDiff + 1 : nc.scoreDiff - 1;

  // Gol que empata nos acréscimos (85'+)
  if (nc.isDesperateTime && Math.abs(newScoreDiff) === 0 && Math.abs(nc.scoreDiff) === 1) {
    return [
      L(`${nc.minute}' — INACREDITÁVEL! ${scorerName.toUpperCase()} EMPATA NOS ACRÉSCIMOS!`, `${nc.minute}' — UNBELIEVABLE! ${scorerName.toUpperCase()} EQUALISES IN STOPPAGE TIME!`),
      L(`${nc.minute}' — A TORCIDA EXPLODE! ${scorerName.toUpperCase()} ARRANCA O EMPATE NO ÚLTIMO SUSPIRO!`, `${nc.minute}' — THE CROWD ERUPTS! ${scorerName.toUpperCase()} SNATCHES A LAST-GASP EQUALISER!`),
      L(`${nc.minute}' — NÃO É POSSÍVEL! ${scorerName.toUpperCase()} IGUALA TUDO NO FIM!`, `${nc.minute}' — YOU CANNOT BE SERIOUS! ${scorerName.toUpperCase()} LEVELS IT AT THE DEATH!`),
    ][Math.floor(Math.random() * 3)];
  }

  // Gol da virada (estava perdendo, agora vence)
  if (isHome && nc.scoreDiff < 0 && newScoreDiff > 0) {
    return L(`${nc.minute}' — VIRADA COMPLETA! ${scorerName.toUpperCase()} COLOCA ${nc.homeShort.toUpperCase()} NA FRENTE!`, `${nc.minute}' — COMPLETE TURNAROUND! ${scorerName.toUpperCase()} PUTS ${nc.homeShort.toUpperCase()} IN FRONT!`);
  }

  // Gol que abre vantagem confortável (2+ gols)
  if (Math.abs(newScoreDiff) >= 2 && Math.abs(nc.scoreDiff) === 1) {
    return isHome
      ? L(`${nc.minute}' — ${scorerName.toUpperCase()} AMPLIA! ${nc.homeShort} abre ${Math.abs(newScoreDiff)} gols de vantagem!`, `${nc.minute}' — ${scorerName.toUpperCase()} EXTENDS THE LEAD! ${nc.homeShort} now ${Math.abs(newScoreDiff)} goals clear!`)
      : L(`${nc.minute}' — ${scorerName.toUpperCase()} faz o segundo! ${nc.awayShort} domina ${Math.abs(newScoreDiff)}-${nc.homeScore}.`, `${nc.minute}' — ${scorerName.toUpperCase()} adds another! ${nc.awayShort} in control ${Math.abs(newScoreDiff)}-${nc.homeScore}.`);
  }

  // Gol relâmpago (primeiros 5 minutos)
  if (nc.minute <= 5 && nc.homeScore === 0 && nc.awayScore === 0) {
    return L(`${nc.minute}' — GOL RELÂMPAGO! ${scorerName.toUpperCase()} abre o placar logo no início!`, `${nc.minute}' — LIGHTNING GOAL! ${scorerName.toUpperCase()} opens the scoring straight away!`);
  }

  // Gol nos acréscimos que define o jogo
  if (nc.isDesperateTime && Math.abs(newScoreDiff) >= 2) {
    return L(`${nc.minute}' — ACABOU! ${scorerName.toUpperCase()} mata o jogo nos acréscimos!`, `${nc.minute}' — THAT'S IT! ${scorerName.toUpperCase()} kills it off in stoppage time!`);
  }

  return null; // usa narração padrão
}

/** Narração contextual para CHUTES — reage à pressão do placar/tempo. */
export function contextualShotNarrative(
  event: SpiritOutcome,
  ctx: SpiritContext,
  awayShort: string,
  shooterName: string,
): string | null {
  const nc = extractContext(ctx, awayShort);
  const isHome = ctx.possession === 'home';

  // Chute pra fora quando perdendo no final (desperdiçou chance de empatar)
  if (
    event.action === 'shot' &&
    !event.goalFor &&
    isHome &&
    nc.scoreDiff < 0 &&
    nc.isDesperateTime &&
    /(fora|largo|wide|over the bar)/.test(event.narrative ?? '')
  ) {
    return L(`${nc.minute}' — PRA FORA! ${shooterName} desperdiça a chance de empatar. O tempo está acabando...`, `${nc.minute}' — WIDE! ${shooterName} wastes the chance to equalise. Time is running out...`);
  }

  // Defesa milagrosa quando vencendo por 1 no final
  if (
    event.action === 'shot' &&
    !event.goalFor &&
    !isHome &&
    nc.scoreDiff === 1 &&
    nc.isLateGame &&
    /(defende|save)/.test(event.narrative ?? '')
  ) {
    return L(`${nc.minute}' — DEFENDEU! O goleiro salva a vitória de ${nc.homeShort}! Que reflexo!`, `${nc.minute}' — SAVED! The keeper protects ${nc.homeShort}'s lead! What reflexes!`);
  }

  // Chute bloqueado em momento crítico (perdendo, últimos 10 min)
  if (
    event.action === 'shot' &&
    !event.goalFor &&
    isHome &&
    nc.scoreDiff < 0 &&
    nc.minute >= 80 &&
    /(bloqueio|block)/.test(event.narrative ?? '')
  ) {
    return L(`${nc.minute}' — BLOQUEIO CRUCIAL! ${nc.awayShort} fecha todos os espaços. ${nc.homeShort} não consegue passar!`, `${nc.minute}' — CRUCIAL BLOCK! ${nc.awayShort} close every gap. ${nc.homeShort} can't find a way through!`);
  }

  return null;
}

/** Narração contextual para MOMENTUM — quando time domina completamente. */
export function contextualMomentumNarrative(
  ctx: SpiritContext,
  awayShort: string,
): string | null {
  const nc = extractContext(ctx, awayShort);
  if (!nc.momentum) return null;

  const homeMom = nc.momentum.home;
  const awayMom = nc.momentum.away;

  // Casa dominando (momentum > 70 e diferença > 30)
  if (homeMom > 70 && homeMom - awayMom > 30 && Math.random() < 0.15) {
    return L(`${nc.minute}' — ${nc.homeShort.toUpperCase()} DOMINA COMPLETAMENTE! A torcida empurra o time!`, `${nc.minute}' — ${nc.homeShort.toUpperCase()} TOTALLY IN CONTROL! The crowd roar them on!`);
  }

  // Visitante sufocando (momentum > 70)
  if (awayMom > 70 && awayMom - homeMom > 30 && Math.random() < 0.15) {
    return L(`${nc.minute}' — ${nc.awayShort} não dá espaço! ${nc.homeShort} sufocado na defesa.`, `${nc.minute}' — ${nc.awayShort} give no space! ${nc.homeShort} pinned back.`);
  }

  return null;
}

/** Narração contextual para AÇÕES TÁTICAS — faltas, posse, pressão. */
export function contextualTacticalNarrative(
  event: SpiritOutcome,
  ctx: SpiritContext,
  awayShort: string,
): string | null {
  const nc = extractContext(ctx, awayShort);

  // Falta tática quando perdendo no final
  if (
    nc.scoreDiff < 0 &&
    nc.isLateGame &&
    event.action === 'press' &&
    /(falta|foul)/.test(event.narrative ?? '') &&
    Math.random() < 0.4
  ) {
    return L(`${nc.minute}' — Falta tática! ${nc.homeShort} tenta parar o contra-ataque do ${nc.awayShort}!`, `${nc.minute}' — Tactical foul! ${nc.homeShort} stop the ${nc.awayShort} counter!`);
  }

  // Posse prolongada quando vencendo (administra vantagem)
  if (
    nc.scoreDiff > 0 &&
    nc.isLateGame &&
    event.action === 'recycle' &&
    ctx.possession === 'home' &&
    Math.random() < 0.25
  ) {
    return L(`${nc.minute}' — ${nc.homeShort} segura a bola. Administra a vantagem com paciência.`, `${nc.minute}' — ${nc.homeShort} keep the ball. Managing the lead patiently.`);
  }

  // Pressão alta quando perdendo nos acréscimos
  if (
    nc.scoreDiff < 0 &&
    nc.isDesperateTime &&
    event.action === 'press' &&
    Math.random() < 0.35
  ) {
    return L(`${nc.minute}' — PRESSÃO TOTAL! ${nc.homeShort} vai com tudo em busca do empate!`, `${nc.minute}' — ALL-OUT PRESSURE! ${nc.homeShort} throw everything at it for the equaliser!`);
  }

  // Recuo defensivo quando vencendo por 1
  if (
    nc.scoreDiff === 1 &&
    nc.isLateGame &&
    event.action === 'clear' &&
    ctx.possession === 'home' &&
    Math.random() < 0.3
  ) {
    return L(`${nc.minute}' — ${nc.homeShort} recua. Defende a vantagem mínima com unhas e dentes!`, `${nc.minute}' — ${nc.homeShort} sit deep. Defending the one-goal lead with everything!`);
  }

  // Contra-ataque rápido após recuperação
  if (
    event.action === 'progress' &&
    ctx.ballZone === 'def' &&
    ctx.possession === 'home' &&
    Math.random() < 0.2
  ) {
    return L(`${nc.minute}' — Recupera e sai rápido! ${nc.homeShort} busca o contra-ataque!`, `${nc.minute}' — Win it and go! ${nc.homeShort} look to counter!`);
  }

  return null;
}

/** Narração contextual para FALTAS — reage à gravidade e contexto. */
export function contextualFoulNarrative(
  ctx: SpiritContext,
  awayShort: string,
  fouledName: string,
  isPenalty: boolean,
): string | null {
  const nc = extractContext(ctx, awayShort);

  // Pênalti nos acréscimos (drama máximo)
  if (isPenalty && nc.isDesperateTime) {
    return L(`${nc.minute}' — PÊNALTI NOS ACRÉSCIMOS! ${fouledName} derrubado na área! O estádio está em silêncio...`, `${nc.minute}' — STOPPAGE-TIME PENALTY! ${fouledName} brought down in the box! The stadium falls silent...`);
  }

  // Pênalti que pode virar o jogo (perdendo por 1)
  if (isPenalty && nc.scoreDiff === -1 && nc.isLateGame) {
    return L(`${nc.minute}' — PÊNALTI! A chance de empatar! ${fouledName} foi derrubado na área!`, `${nc.minute}' — PENALTY! The chance to equalise! ${fouledName} was brought down in the box!`);
  }

  // Falta perigosa em momento de pressão
  if (!isPenalty && nc.scoreDiff < 0 && nc.isLateGame && ctx.ballZone === 'att') {
    return L(`${nc.minute}' — Falta perigosa! ${fouledName} sofre falta na entrada da área. Última chance de ${nc.homeShort}?`, `${nc.minute}' — Dangerous free kick! ${fouledName} fouled on the edge of the box. Last chance for ${nc.homeShort}?`);
  }

  return null;
}

/** Wrapper principal — tenta narração contextual, fallback pra padrão. */
export function enrichNarrative(
  event: SpiritOutcome,
  ctx: SpiritContext,
  awayShort: string,
  defaultNarrative: string,
): string {
  // Gols
  if (event.goalFor && event.goalScorerPlayerId) {
    const scorerName = ctx.onBall?.name ?? ctx.homeShort ?? L('Atacante', 'Attacker');
    const contextual = contextualGoalNarrative(event, ctx, awayShort, scorerName);
    if (contextual) return contextual;
  }

  // Chutes
  if (event.action === 'shot') {
    const shooterName = ctx.onBall?.name ?? L('Atacante', 'Attacker');
    const contextual = contextualShotNarrative(event, ctx, awayShort, shooterName);
    if (contextual) return contextual;
  }

  // Ações táticas (faltas, posse, pressão)
  const tacticalNarrative = contextualTacticalNarrative(event, ctx, awayShort);
  if (tacticalNarrative) return tacticalNarrative;

  // Momentum (injeção ocasional, não substitui evento)
  if (Math.random() < 0.08) {
    const momentumLine = contextualMomentumNarrative(ctx, awayShort);
    if (momentumLine) return momentumLine;
  }

  return defaultNarrative;
}

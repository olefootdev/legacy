/**
 * Narração contextual rica — reage ao placar, minuto, momentum e situação emocional.
 * Fase 1 — Quick Win #6
 */
function extractContext(ctx, awayShort) {
    const scoreDiff = ctx.homeScore - ctx.awayScore;
    return {
        minute: ctx.minute,
        homeScore: ctx.homeScore,
        awayScore: ctx.awayScore,
        scoreDiff,
        momentum: ctx.momentum,
        homeShort: ctx.homeShort ?? 'Casa',
        awayShort,
        isLateGame: ctx.minute >= 75,
        isDesperateTime: ctx.minute >= 85,
    };
}
/** Narração contextual para GOLS — reage ao timing e placar. */
export function contextualGoalNarrative(event, ctx, awayShort, scorerName) {
    const nc = extractContext(ctx, awayShort);
    const scorerSide = event.goalFor;
    if (!scorerSide)
        return null;
    const isHome = scorerSide === 'home';
    const newScoreDiff = isHome ? nc.scoreDiff + 1 : nc.scoreDiff - 1;
    // Gol que empata nos acréscimos (85'+)
    if (nc.isDesperateTime && Math.abs(newScoreDiff) === 0 && Math.abs(nc.scoreDiff) === 1) {
        return [
            `${nc.minute}' — INACREDITÁVEL! ${scorerName.toUpperCase()} EMPATA NOS ACRÉSCIMOS!`,
            `${nc.minute}' — A TORCIDA EXPLODE! ${scorerName.toUpperCase()} ARRANCA O EMPATE NO ÚLTIMO SUSPIRO!`,
            `${nc.minute}' — NÃO É POSSÍVEL! ${scorerName.toUpperCase()} IGUALA TUDO NO FIM!`,
        ][Math.floor(Math.random() * 3)];
    }
    // Gol da virada (estava perdendo, agora vence)
    if (isHome && nc.scoreDiff < 0 && newScoreDiff > 0) {
        return `${nc.minute}' — VIRADA COMPLETA! ${scorerName.toUpperCase()} COLOCA ${nc.homeShort.toUpperCase()} NA FRENTE!`;
    }
    // Gol que abre vantagem confortável (2+ gols)
    if (Math.abs(newScoreDiff) >= 2 && Math.abs(nc.scoreDiff) === 1) {
        return isHome
            ? `${nc.minute}' — ${scorerName.toUpperCase()} AMPLIA! ${nc.homeShort} abre ${Math.abs(newScoreDiff)} gols de vantagem!`
            : `${nc.minute}' — ${scorerName.toUpperCase()} faz o segundo! ${nc.awayShort} domina ${Math.abs(newScoreDiff)}-${nc.homeScore}.`;
    }
    // Gol relâmpago (primeiros 5 minutos)
    if (nc.minute <= 5 && nc.homeScore === 0 && nc.awayScore === 0) {
        return `${nc.minute}' — GOL RELÂMPAGO! ${scorerName.toUpperCase()} abre o placar logo no início!`;
    }
    // Gol nos acréscimos que define o jogo
    if (nc.isDesperateTime && Math.abs(newScoreDiff) >= 2) {
        return `${nc.minute}' — ACABOU! ${scorerName.toUpperCase()} mata o jogo nos acréscimos!`;
    }
    return null; // usa narração padrão
}
/** Narração contextual para CHUTES — reage à pressão do placar/tempo. */
export function contextualShotNarrative(event, ctx, awayShort, shooterName) {
    const nc = extractContext(ctx, awayShort);
    const isHome = ctx.possession === 'home';
    // Chute pra fora quando perdendo no final (desperdiçou chance de empatar)
    if (event.action === 'shot' &&
        !event.goalFor &&
        isHome &&
        nc.scoreDiff < 0 &&
        nc.isDesperateTime &&
        (event.narrative?.includes('fora') || event.narrative?.includes('largo'))) {
        return `${nc.minute}' — PRA FORA! ${shooterName} desperdiça a chance de empatar. O tempo está acabando...`;
    }
    // Defesa milagrosa quando vencendo por 1 no final
    if (event.action === 'shot' &&
        !event.goalFor &&
        !isHome &&
        nc.scoreDiff === 1 &&
        nc.isLateGame &&
        event.narrative?.includes('defende')) {
        return `${nc.minute}' — DEFENDEU! O goleiro salva a vitória de ${nc.homeShort}! Que reflexo!`;
    }
    // Chute bloqueado em momento crítico (perdendo, últimos 10 min)
    if (event.action === 'shot' &&
        !event.goalFor &&
        isHome &&
        nc.scoreDiff < 0 &&
        nc.minute >= 80 &&
        event.narrative?.includes('bloqueio')) {
        return `${nc.minute}' — BLOQUEIO CRUCIAL! ${nc.awayShort} fecha todos os espaços. ${nc.homeShort} não consegue passar!`;
    }
    return null;
}
/** Narração contextual para MOMENTUM — quando time domina completamente. */
export function contextualMomentumNarrative(ctx, awayShort) {
    const nc = extractContext(ctx, awayShort);
    if (!nc.momentum)
        return null;
    const homeMom = nc.momentum.home;
    const awayMom = nc.momentum.away;
    // Casa dominando (momentum > 70 e diferença > 30)
    if (homeMom > 70 && homeMom - awayMom > 30 && Math.random() < 0.15) {
        return `${nc.minute}' — ${nc.homeShort.toUpperCase()} DOMINA COMPLETAMENTE! A torcida empurra o time!`;
    }
    // Visitante sufocando (momentum > 70)
    if (awayMom > 70 && awayMom - homeMom > 30 && Math.random() < 0.15) {
        return `${nc.minute}' — ${nc.awayShort} não dá espaço! ${nc.homeShort} sufocado na defesa.`;
    }
    return null;
}
/** Narração contextual para AÇÕES TÁTICAS — faltas, posse, pressão. */
export function contextualTacticalNarrative(event, ctx, awayShort) {
    const nc = extractContext(ctx, awayShort);
    // Falta tática quando perdendo no final
    if (nc.scoreDiff < 0 &&
        nc.isLateGame &&
        event.action === 'press' &&
        event.narrative?.includes('falta') &&
        Math.random() < 0.4) {
        return `${nc.minute}' — Falta tática! ${nc.homeShort} tenta parar o contra-ataque do ${nc.awayShort}!`;
    }
    // Posse prolongada quando vencendo (administra vantagem)
    if (nc.scoreDiff > 0 &&
        nc.isLateGame &&
        event.action === 'recycle' &&
        ctx.possession === 'home' &&
        Math.random() < 0.25) {
        return `${nc.minute}' — ${nc.homeShort} segura a bola. Administra a vantagem com paciência.`;
    }
    // Pressão alta quando perdendo nos acréscimos
    if (nc.scoreDiff < 0 &&
        nc.isDesperateTime &&
        event.action === 'press' &&
        Math.random() < 0.35) {
        return `${nc.minute}' — PRESSÃO TOTAL! ${nc.homeShort} vai com tudo em busca do empate!`;
    }
    // Recuo defensivo quando vencendo por 1
    if (nc.scoreDiff === 1 &&
        nc.isLateGame &&
        event.action === 'clear' &&
        ctx.possession === 'home' &&
        Math.random() < 0.3) {
        return `${nc.minute}' — ${nc.homeShort} recua. Defende a vantagem mínima com unhas e dentes!`;
    }
    // Contra-ataque rápido após recuperação
    if (event.action === 'progress' &&
        ctx.ballZone === 'def' &&
        ctx.possession === 'home' &&
        Math.random() < 0.2) {
        return `${nc.minute}' — Recupera e sai rápido! ${nc.homeShort} busca o contra-ataque!`;
    }
    return null;
}
/** Narração contextual para FALTAS — reage à gravidade e contexto. */
export function contextualFoulNarrative(ctx, awayShort, fouledName, isPenalty) {
    const nc = extractContext(ctx, awayShort);
    // Pênalti nos acréscimos (drama máximo)
    if (isPenalty && nc.isDesperateTime) {
        return `${nc.minute}' — PÊNALTI NOS ACRÉSCIMOS! ${fouledName} derrubado na área! O estádio está em silêncio...`;
    }
    // Pênalti que pode virar o jogo (perdendo por 1)
    if (isPenalty && nc.scoreDiff === -1 && nc.isLateGame) {
        return `${nc.minute}' — PÊNALTI! A chance de empatar! ${fouledName} foi derrubado na área!`;
    }
    // Falta perigosa em momento de pressão
    if (!isPenalty && nc.scoreDiff < 0 && nc.isLateGame && ctx.ballZone === 'att') {
        return `${nc.minute}' — Falta perigosa! ${fouledName} sofre falta na entrada da área. Última chance de ${nc.homeShort}?`;
    }
    return null;
}
/** Wrapper principal — tenta narração contextual, fallback pra padrão. */
export function enrichNarrative(event, ctx, awayShort, defaultNarrative) {
    // Gols
    if (event.goalFor && event.goalScorerPlayerId) {
        const scorerName = ctx.onBall?.name ?? ctx.homeShort ?? 'Atacante';
        const contextual = contextualGoalNarrative(event, ctx, awayShort, scorerName);
        if (contextual)
            return contextual;
    }
    // Chutes
    if (event.action === 'shot') {
        const shooterName = ctx.onBall?.name ?? 'Atacante';
        const contextual = contextualShotNarrative(event, ctx, awayShort, shooterName);
        if (contextual)
            return contextual;
    }
    // Ações táticas (faltas, posse, pressão)
    const tacticalNarrative = contextualTacticalNarrative(event, ctx, awayShort);
    if (tacticalNarrative)
        return tacticalNarrative;
    // Momentum (injeção ocasional, não substitui evento)
    if (Math.random() < 0.08) {
        const momentumLine = contextualMomentumNarrative(ctx, awayShort);
        if (momentumLine)
            return momentumLine;
    }
    return defaultNarrative;
}
//# sourceMappingURL=contextualNarrative.js.map
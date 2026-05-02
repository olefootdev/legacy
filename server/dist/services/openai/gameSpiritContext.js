/** Contexto mínimo enviado pelo cliente (motor / painel) para decisão GameSpirit. */
export function stableCacheKey(ctx) {
    const norm = {
        player: ctx.player.trim(),
        position: ctx.position.trim(),
        ballOwner: ctx.ballOwner,
        pressureLevel: String(ctx.pressureLevel).trim().toLowerCase(),
        nearbyPlayers: [...ctx.nearbyPlayers].map((s) => s.trim()).filter(Boolean).sort(),
        objective: ctx.objective.trim().toLowerCase(),
    };
    return JSON.stringify(norm);
}
/** Aceita `{ context: { player, ... } }` (padrão Express) ou o objeto de contexto na raiz. */
export function parseGameSpiritRequestBody(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    if (o.context !== undefined && o.context !== null && typeof o.context === 'object') {
        return parseGameSpiritDecisionBody(o.context);
    }
    return parseGameSpiritDecisionBody(raw);
}
export function parseGameSpiritDecisionBody(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const player = typeof o.player === 'string' ? o.player.trim() : '';
    if (!player)
        return null;
    const position = typeof o.position === 'string' ? o.position.trim() : 'unknown';
    const ballOwner = Boolean(o.ballOwner);
    const pressureLevel = typeof o.pressureLevel === 'string' && o.pressureLevel.trim()
        ? o.pressureLevel.trim().toLowerCase()
        : 'medium';
    let nearbyPlayers = [];
    if (Array.isArray(o.nearbyPlayers)) {
        nearbyPlayers = o.nearbyPlayers
            .filter((x) => typeof x === 'string' && x.trim().length > 0)
            .map((s) => s.trim())
            .slice(0, 12);
    }
    const objective = typeof o.objective === 'string' && o.objective.trim() ? o.objective.trim() : 'build_play';
    const uuidLike = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
    const matchId = typeof o.matchId === 'string' && uuidLike(o.matchId.trim()) ? o.matchId.trim() : undefined;
    const clubId = typeof o.clubId === 'string' && uuidLike(o.clubId.trim()) ? o.clubId.trim() : undefined;
    return {
        player,
        position,
        ballOwner,
        pressureLevel,
        nearbyPlayers,
        objective,
        matchId,
        clubId,
    };
}
//# sourceMappingURL=gameSpiritContext.js.map
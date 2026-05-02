/**
 * Testes para endpoint /api/match/tick
 */
import { describe, it, expect, beforeAll } from 'vitest';
const API_BASE = 'http://localhost:4000';
describe('Match Tick Endpoint', () => {
    beforeAll(async () => {
        // Aguarda servidor estar pronto
        await new Promise(resolve => setTimeout(resolve, 1000));
    });
    it('deve retornar erro para JSON inválido', async () => {
        const response = await fetch(`${API_BASE}/api/match/tick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'invalid json',
        });
        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBeDefined();
    });
    it('deve retornar erro para minute inválido', async () => {
        const response = await fetch(`${API_BASE}/api/match/tick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                minute: -5,
                homeScore: 0,
                awayScore: 0,
                possession: 'home',
                ball: { x: 50, y: 50 },
                crowdSupport: 75,
                tacticalMentality: 60,
                opponentStrength: 80,
                homeRoster: [],
                homePlayers: [],
                awayShort: 'ADV',
                causalSeqStart: 0,
            }),
        });
        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('minute');
    });
    it('deve processar tick válido e retornar outcome', async () => {
        const payload = {
            minute: 10,
            homeScore: 0,
            awayScore: 0,
            possession: 'home',
            ball: { x: 50, y: 50 },
            onBall: {
                playerId: 'p1',
                name: 'Jogador 1',
                slotId: 'slot_9',
                role: 'attack',
                x: 50,
                y: 50,
                heading: 0,
                fatigue: 50,
                attributes: {
                    velocidade: 80,
                    finalizacao: 75,
                    passe: 70,
                    drible: 78,
                    fisico: 72,
                    defesa: 40,
                },
            },
            crowdSupport: 75,
            tacticalMentality: 60,
            opponentStrength: 80,
            homeRoster: [
                {
                    id: 'p1',
                    name: 'Jogador 1',
                    pos: 'ATA',
                    attrs: {
                        velocidade: 80,
                        finalizacao: 75,
                        passe: 70,
                        drible: 78,
                        fisico: 72,
                        defesa: 40,
                    },
                },
            ],
            homePlayers: [
                {
                    playerId: 'p1',
                    name: 'Jogador 1',
                    slotId: 'slot_9',
                    role: 'attack',
                    x: 50,
                    y: 50,
                    heading: 0,
                    fatigue: 50,
                    attributes: {
                        velocidade: 80,
                        finalizacao: 75,
                        passe: 70,
                        drible: 78,
                        fisico: 72,
                        defesa: 40,
                    },
                },
            ],
            homeShort: 'CASA',
            awayRoster: [
                { id: 'away1', num: 9, name: 'Atacante', pos: 'ATA' },
            ],
            awayShort: 'ADV',
            causalSeqStart: 0,
        };
        const response = await fetch(`${API_BASE}/api/match/tick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.ok).toBe(true);
        expect(data.outcome).toBeDefined();
        expect(data.outcome.narrative).toBeDefined();
        expect(data.outcome.action).toBeDefined();
        expect(data.outcome.nextPossession).toBeDefined();
        expect(data.outcome.ball).toBeDefined();
        expect(data.outcome.causalEvents).toBeInstanceOf(Array);
    });
    it('deve processar múltiplos ticks em sequência', async () => {
        const outcomes = [];
        for (let minute = 0; minute < 5; minute++) {
            const payload = {
                minute,
                homeScore: 0,
                awayScore: 0,
                possession: 'home',
                ball: { x: 50 + minute * 5, y: 50 },
                crowdSupport: 75,
                tacticalMentality: 60,
                opponentStrength: 80,
                homeRoster: [],
                homePlayers: [],
                awayShort: 'ADV',
                causalSeqStart: minute * 10,
            };
            const response = await fetch(`${API_BASE}/api/match/tick`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            outcomes.push(data.outcome);
        }
        expect(outcomes).toHaveLength(5);
        outcomes.forEach(outcome => {
            expect(outcome.narrative).toBeDefined();
            expect(outcome.causalEvents.length).toBeGreaterThan(0);
        });
    });
});
//# sourceMappingURL=matchTickController.test.js.map
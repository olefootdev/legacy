import type { FormationSchemeId } from '@/match-engine/types';
import type { PlayingStylePresetId } from '@/tactics/playingStyle';
import type { PlayerEntity } from '@/entities/types';
import { generatePlayerId } from '@/entities/player';
import { randomBrazilianName } from '@/entities/nameGenerator';

export type BotTeamId = 'bot-ole-fc' | 'bot-antros-sc' | 'bot-hexa-team' | 'bot-for-peace';

export interface BotTeamDefinition {
  id: BotTeamId;
  name: string;
  shortName: string;
  country: string;
  avgOverall: number;
  formation: FormationSchemeId;
  style: PlayingStylePresetId;
  crestUrl?: string;
  description: string;
}

export const BOT_TEAMS: Record<BotTeamId, BotTeamDefinition> = {
  'bot-ole-fc': {
    id: 'bot-ole-fc',
    name: 'OLE FC',
    shortName: 'OLE',
    country: 'Internacional',
    avgOverall: 75,
    formation: '4-3-3',
    style: 'balanced',
    description: 'Time equilibrado com foco em posse de bola e transições rápidas.',
  },
  'bot-antros-sc': {
    id: 'bot-antros-sc',
    name: 'ANTROS SC',
    shortName: 'ANT',
    country: 'Internacional',
    avgOverall: 72,
    formation: '4-4-2',
    style: 'BLOCO_BAIXO',
    description: 'Equipe defensiva sólida, joga no contra-ataque.',
  },
  'bot-hexa-team': {
    id: 'bot-hexa-team',
    name: 'HEXA TEAM',
    shortName: 'HEX',
    country: 'Brasil',
    avgOverall: 78,
    formation: '4-2-3-1',
    style: 'TRANSICAO_RAPIDA',
    description: 'Seleção brasileira de craques, jogo ofensivo e técnico.',
  },
  'bot-for-peace': {
    id: 'bot-for-peace',
    name: 'FOR PEACE',
    shortName: 'FPC',
    country: 'Internacional',
    avgOverall: 70,
    formation: '3-5-2',
    style: 'POSSE_CONTROLADA',
    description: 'Time que valoriza a paz através do futebol, posse de bola intensa.',
  },
};

export function getBotTeamById(id: BotTeamId): BotTeamDefinition {
  return BOT_TEAMS[id];
}

export function getAllBotTeams(): BotTeamDefinition[] {
  return Object.values(BOT_TEAMS);
}

export function getRandomBotTeam(): BotTeamDefinition {
  const teams = getAllBotTeams();
  return teams[Math.floor(Math.random() * teams.length)]!;
}

/**
 * Gera um elenco completo para um time bot.
 * 18 jogadores: 2 GOL, 6 DEF, 6 MEI, 4 ATA
 */
export function generateBotSquad(botTeam: BotTeamDefinition): Record<string, PlayerEntity> {
  const squad: Record<string, PlayerEntity> = {};
  const { avgOverall, country, id: botId } = botTeam;
  const isBrazilian = country === 'Brasil';

  // Variação de OVR: ±5 do avgOverall
  const minOvr = Math.max(60, avgOverall - 5);
  const maxOvr = Math.min(90, avgOverall + 5);

  const positions: Array<{ pos: string; count: number }> = [
    { pos: 'GOL', count: 2 },
    { pos: 'DEF', count: 6 },
    { pos: 'MEI', count: 6 },
    { pos: 'ATA', count: 4 },
  ];

  let playerIndex = 0;

  for (const { pos, count } of positions) {
    for (let i = 0; i < count; i++) {
      playerIndex++;
      const ovr = Math.floor(minOvr + Math.random() * (maxOvr - minOvr));
      const playerId = generatePlayerId();

      // Nome: brasileiro se HEXA TEAM, senão genérico
      const name = isBrazilian
        ? randomBrazilianName()
        : `${botTeam.shortName} ${pos} ${playerIndex}`;

      // Atributos balanceados por posição
      const attrs = generateAttributesForPosition(pos, ovr);

      squad[playerId] = {
        id: playerId,
        num: playerIndex,
        name,
        pos,
        archetype: 'profissional',
        zone: pos === 'GOL' ? 'gol' : pos === 'DEF' ? 'defesa' : pos === 'MEI' ? 'meio' : 'ataque',
        behavior: 'equilibrado',
        attrs,
        fatigue: 0,
        injuryRisk: 0,
        evolutionXp: 0,
        outForMatches: 0,
        age: 20 + Math.floor(Math.random() * 12),
        country,
        strongFoot: Math.random() > 0.5 ? 'right' : 'left',
        mintOverall: ovr,
      };
    }
  }

  return squad;
}

/**
 * Gera atributos balanceados para uma posição específica.
 */
function generateAttributesForPosition(pos: string, targetOvr: number) {
  const base = Math.floor(targetOvr * 0.8); // base 80% do OVR
  const variance = Math.floor(targetOvr * 0.4); // variação de 40%

  const rand = () => Math.max(40, Math.min(99, base + Math.floor(Math.random() * variance)));

  switch (pos) {
    case 'GOL':
      return {
        passe: rand(),
        marcacao: rand() + 10,
        velocidade: rand() - 10,
        drible: rand() - 15,
        finalizacao: rand() - 25,
        fisico: rand() + 5,
        tatico: rand() + 10,
        mentalidade: rand() + 5,
        confianca: rand(),
        fairPlay: rand(),
      };

    case 'DEF':
      return {
        passe: rand(),
        marcacao: rand() + 15,
        velocidade: rand(),
        drible: rand() - 5,
        finalizacao: rand() - 20,
        fisico: rand() + 10,
        tatico: rand() + 10,
        mentalidade: rand() + 5,
        confianca: rand(),
        fairPlay: rand(),
      };

    case 'MEI':
      return {
        passe: rand() + 10,
        marcacao: rand(),
        velocidade: rand() + 5,
        drible: rand() + 10,
        finalizacao: rand(),
        fisico: rand(),
        tatico: rand() + 10,
        mentalidade: rand() + 5,
        confianca: rand(),
        fairPlay: rand(),
        shortPassing: rand() + 15,
        longPassing: rand() + 10,
        curve: rand() + 5,
        agility: rand() + 10,
        balance: rand() + 10,
        reactions: rand() + 5,
        ballControl: rand() + 15,
        dribbling2: rand() + 10,
        composure: rand() + 5,
        interceptions: rand(),
        headingAccuracy: rand() - 5,
        marking: rand(),
        standingTackle: rand(),
        slidingTackle: rand() - 5,
        jumping: rand(),
        stamina: rand() + 10,
        strength: rand(),
        aggression: rand(),
      };

    case 'ATA':
      return {
        passe: rand() + 5,
        marcacao: rand() - 15,
        velocidade: rand() + 10,
        drible: rand() + 15,
        finalizacao: rand() + 20,
        fisico: rand(),
        tatico: rand() + 5,
        mentalidade: rand() + 10,
        confianca: rand() + 5,
        fairPlay: rand(),
      };

    default:
      // Fallback: atributos genéricos
      return {
        passe: rand(),
        marcacao: rand(),
        velocidade: rand(),
        drible: rand(),
        finalizacao: rand(),
        fisico: rand(),
        tatico: rand(),
        mentalidade: rand(),
        confianca: rand(),
        fairPlay: rand(),
      };
  }
}

/**
 * Verifica se um ID é de um time bot.
 */
export function isBotTeamId(id: string): id is BotTeamId {
  return id.startsWith('bot-');
}

/**
 * Retorna um bot aleatório com OVR próximo ao especificado.
 */
export function getMatchingBotTeam(targetOvr: number, maxDiff = 10): BotTeamDefinition {
  const teams = getAllBotTeams();
  const sorted = teams.sort((a, b) => {
    const diffA = Math.abs(a.avgOverall - targetOvr);
    const diffB = Math.abs(b.avgOverall - targetOvr);
    return diffA - diffB;
  });

  // Retorna o mais próximo que esteja dentro do maxDiff
  const best = sorted.find((t) => Math.abs(t.avgOverall - targetOvr) <= maxDiff);
  return best ?? getRandomBotTeam();
}

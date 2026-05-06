import type { ArchetypeId, EventType, MatchScore } from './types';

type NarrationMap = Partial<Record<EventType, string[]>>;
type ArchetypeNarration = Partial<Record<ArchetypeId, NarrationMap>>;

const ARCHETYPE_NARRATION: ArchetypeNarration = {
  MAESTRO: {
    pass:  ['{name} distribui com precisão cirúrgica.', '{name} abre o campo com um passe de craque.', '{name} controla o ritmo — o jogo passa por ele.'],
    shot:  ['{name} arrisca de meia distância!'],
  },
  WILD: {
    shot:  ['{name} arrisca de longe — sem pensar!', '{name} tenta o impossível!', '{name} dispara de fora da área!'],
    pass:  ['{name} tenta o passe arriscado.'],
    foul:  ['{name} entra com tudo — falta dura!'],
  },
  VETERAN: {
    pass:  ['{name} esfria o jogo com experiência.', '{name} manda em campo — veterano de lei.', '{name} posiciona a equipe com calma.'],
    tackle:['{name} lê a jogada antes de todo mundo.'],
  },
  FINISHER: {
    shot:  ['{name} finaliza — posição perfeita!', '{name} não perdoa a chance!'],
    goal:  ['{name} não perdoa! GOOOL!', '{name} gelou o goleiro — puro instinto!', '{name} estava no lugar certo — GOOOL!'],
  },
  DESTROYER: {
    tackle:['{name} para na força — destruiu o ataque.', '{name} entra duro e limpo.'],
    foul:  ['{name} força o erro — falta necessária.'],
  },
  HUNTER: {
    interception: ['{name} antecipa e rouba a bola!', '{name} lê o passe e intercepta!'],
    pressure:     ['{name} pressiona alto — não deixa o adversário respirar.'],
  },
  BOX_INVADER: {
    shot:  ['{name} invade a área — finaliza!', '{name} de cabeça — chegou na hora certa!'],
    cross: ['{name} se posiciona no segundo pau.'],
  },
  ENGINE: {
    pass:  ['{name} liga o jogo — motor do time.', '{name} cobre o campo inteiro.'],
  },
  COLD_BLOOD: {
    shot:  ['{name} sem emoção — finaliza com frieza.'],
    goal:  ['{name} sangue frio total — GOOOL!'],
  },
};

// Context-aware narration layers
function contextNarration(type: EventType, name: string, team: string, minute: number, score: MatchScore): string | null {
  const losing = score.home < score.away ? 'home' : score.away < score.home ? 'away' : null;
  const losingTeam = losing === 'home' ? 'Tigres' : losing === 'away' ? 'Alvorada' : null;
  const isUrgent = minute > 80 && losingTeam === team;
  const isClosing = minute > 85;
  const isFirstGoal = score.home === 0 && score.away === 0;

  if (type === 'goal') {
    if (isFirstGoal) return `${team} ABRE O PLACAR! ${name} MARCA O PRIMEIRO!`;
    if (isUrgent) return `${name} EMPATA! ${team} ACREDITA! GOOOL!`;
    if (isClosing) return `GOOOL NOS ACRÉSCIMOS! ${name} — ${team}!`;
    return null; // fall through to archetype
  }

  if (type === 'shot' && isUrgent) {
    return `${name} PRECISA FAZER ISSO AGORA — finaliza com tudo!`;
  }

  if (type === 'pass' && isClosing && losingTeam !== team) {
    return `${team} administra. ${name} esfria o jogo.`;
  }

  if (type === 'pressure' && minute > 75) {
    return `${team} aperta! Pressão total nos minutos finais.`;
  }

  return null;
}

const GENERAL_NARRATION: Record<string, string[]> = {
  goal:         ['GOOOL DO {team}! {name} MARCA!', '{team} MARCA! GOOOL!', 'É GOOOL! {name} — {team}!'],
  danger:       ['Área ameaçada!', 'Situação de perigo para {team}!', 'Cruzamento perigoso na área!'],
  pressure:     ['{team} aperta o meio.', 'Intensidade aumenta em campo.', '{name} não deixa o adversário sair jogando.'],
  corner:       ['Escanteio para o {team}.', 'Bola na área — escanteio do {team}.'],
  foul:         ['Falta cometida. Jogo parado.', 'Árbitro apita — {name} derruba o adversário.'],
  pass:         ['{name} recebe e distribui.', 'Passe circulado pelo {team}.', '{name} domina e acha o companheiro.'],
  shot:         ['Finalização do {team}!', '{name} chuta!', 'Chute de dentro da área — {team}!'],
  tackle:       ['{name} se antecipa!', 'Disputa no meio-campo — {name} vence.', 'Duelo físico intenso.'],
  interception: ['{name} intercepta com inteligência!', 'Interceptação — {team} recupera a bola!'],
  cross:        ['Cruzamento na área!', 'Bola levantada — {team} ataca!', '{name} levanta na grande área.'],
};

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? k);
}

export function generateNarration(
  type: EventType,
  archetype: ArchetypeId | undefined,
  name: string,
  team: string,
  minute = 0,
  score: MatchScore = { home: 0, away: 0 },
): string {
  // 1. Context layer — urgent/dramatic moments override everything
  const ctx = contextNarration(type, name, team, minute, score);
  if (ctx) return ctx;

  // 2. Archetype layer
  if (archetype) {
    const archetypeMap = ARCHETYPE_NARRATION[archetype];
    if (archetypeMap) {
      const templates = archetypeMap[type];
      if (templates && templates.length > 0) {
        return fill(pick(templates), { name, team });
      }
    }
  }

  // 3. General fallback
  const general = GENERAL_NARRATION[type];
  if (general) return fill(pick(general), { name, team });
  return fill('{name} participa da jogada.', { name, team });
}

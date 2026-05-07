import type { ArchetypeId, EventType, MatchScore } from './types';
import type { PlayerNarrativeProfile } from '@/gamespirit/playerNarrativeProfile';
import { traitPhrase, moodPhrase } from '@/gamespirit/playerNarrativeProfile';

type NarrationMap = Partial<Record<EventType, string[]>>;
type ArchetypeNarration = Partial<Record<ArchetypeId, NarrationMap>>;

const ARCHETYPE_NARRATION: ArchetypeNarration = {
  MAESTRO: {
    pass:  [
      '{name} distribui com precisão cirúrgica.',
      '{name} abre o campo com um passe de craque.',
      '{name} controla o ritmo — o jogo passa por ele.',
      '{name} enxerga o corredor antes de todo mundo.',
    ],
    shot:  ['{name} arrisca de meia distância!', '{name} surpreende com o chute de longe!'],
  },
  WILD: {
    shot:  [
      '{name} arrisca de longe — sem pensar!',
      '{name} tenta o impossível!',
      '{name} dispara de fora da área!',
      '{name} não calcula — chuta com tudo!',
    ],
    pass:  ['{name} tenta o passe arriscado.', '{name} força o jogo — alto risco!'],
    foul:  ['{name} entra com tudo — falta dura!', '{name} não mede as consequências!'],
  },
  VETERAN: {
    pass:  [
      '{name} esfria o jogo com experiência.',
      '{name} manda em campo — veterano de lei.',
      '{name} posiciona a equipe com calma.',
      '{name} lê o jogo antes de todo mundo.',
    ],
    tackle: ['{name} lê a jogada antes de todo mundo.', '{name} antecipa com a sabedoria dos anos.'],
    interception: ['{name} estava lá antes da bola chegar.'],
  },
  FINISHER: {
    shot:  [
      '{name} finaliza — posição perfeita!',
      '{name} não perdoa a chance!',
      '{name} estava esperando esse momento!',
      '{name} chuta com a frieza de quem vive para o gol!',
    ],
    goal:  [
      '{name} não perdoa! GOOOL!',
      '{name} gelou o goleiro — puro instinto!',
      '{name} estava no lugar certo — GOOOL!',
      'GOOOL! {name} — o finalizador faz o que sabe!',
      '{name} marca com a naturalidade de quem nasceu para isso!',
    ],
  },
  DESTROYER: {
    tackle: [
      '{name} para na força — destruiu o ataque.',
      '{name} entra duro e limpo.',
      '{name} não deixa passar — destruidor em ação!',
    ],
    foul:  ['{name} força o erro — falta necessária.', '{name} para o contra-ataque na raça!'],
    interception: ['{name} rouba a bola com autoridade!'],
  },
  HUNTER: {
    interception: [
      '{name} antecipa e rouba a bola!',
      '{name} lê o passe e intercepta!',
      '{name} estava no caminho certo — interceptação!',
    ],
    pressure: [
      '{name} pressiona alto — não deixa o adversário respirar.',
      '{name} caça a bola sem parar!',
    ],
    tackle: ['{name} recupera com intensidade!'],
  },
  BOX_INVADER: {
    shot:  [
      '{name} invade a área — finaliza!',
      '{name} de cabeça — chegou na hora certa!',
      '{name} aparece na área como um fantasma!',
    ],
    cross: ['{name} se posiciona no segundo pau.', '{name} ataca o espaço na área!'],
    goal:  [
      'GOOOL! {name} invade a área e não perdoa!',
      '{name} estava no lugar certo — GOOOL de área!',
    ],
  },
  ENGINE: {
    pass:  [
      '{name} liga o jogo — motor do time.',
      '{name} cobre o campo inteiro.',
      '{name} não para — conecta o time!',
    ],
    tackle: ['{name} recupera e já distribui — motor incansável!'],
    pressure: ['{name} pressiona e recupera — energia total!'],
  },
  COLD_BLOOD: {
    shot:  [
      '{name} sem emoção — finaliza com frieza.',
      '{name} calcula tudo antes de chutar.',
    ],
    goal:  [
      '{name} sangue frio total — GOOOL!',
      'GOOOL! {name} — frieza absoluta na finalização!',
      '{name} não sentiu a pressão — GOOOL!',
    ],
    pass:  ['{name} distribui sem pressa — controle total.'],
  },
};

// Context-aware narration layers
function contextNarration(
  type: EventType,
  name: string,
  team: string,
  minute: number,
  score: MatchScore,
  profile?: PlayerNarrativeProfile,
): string | null {
  const losing = score.home < score.away ? 'home' : score.away < score.home ? 'away' : null;
  const losingTeam = losing === 'home' ? team : null; // só casa
  const isUrgent = minute > 80 && losingTeam === team;
  const isClosing = minute > 85;
  const isFirstGoal = score.home === 0 && score.away === 0;

  // ── Contexto temporal ────────────────────────────────────────────────────
  const isOpening   = minute <= 5;
  const isHalfTime  = minute >= 43 && minute <= 48;
  const isFinalPush = minute >= 80 && minute <= 90;
  const isExtraTime = minute > 90;
  const tightGame   = Math.abs(score.home - score.away) <= 1 && minute > 60;

  if (type === 'pass' && isOpening) {
    return `${team} começa a construir — primeiros toques do jogo.`;
  }
  if (type === 'pressure' && isOpening) {
    return `${name} pressiona desde o início — ${team} quer impor o ritmo.`;
  }
  if (type === 'pass' && isHalfTime && !isUrgent) {
    return `${name} circula antes do intervalo — ${team} administra.`;
  }
  if (type === 'shot' && isHalfTime) {
    return `${name} tenta antes do apito — ${team} quer o gol do intervalo!`;
  }
  if (type === 'pass' && isFinalPush && tightGame) {
    return `${name} mantém a posse — cada toque vale ouro agora.`;
  }
  if (type === 'tackle' && isFinalPush) {
    return `${name} não deixa o adversário respirar — pressão total nos minutos finais!`;
  }
  if (type === 'pass' && isExtraTime) {
    return `${name} circula nos acréscimos — ${team} segura o resultado.`;
  }
  if (type === 'shot' && isExtraTime) {
    return `${name} CHUTA NOS ACRÉSCIMOS — pode ser o gol da vitória!`;
  }
  if (type === 'duel') {
    return `${name} entra no duelo — briga pela bola sem sair do lugar!`;
  }

  if (type === 'goal') {
    // Gol com perfil rico
    if (profile) {
      const { trait, mood, cognitiveArchetype, isLegacy, cardArchetype } = profile;

      if (isLegacy) return `A LENDA FALA! ${name} marca — ${team} explode!`;

      if (isUrgent && trait === 'sangue_frio') {
        return `${name} EMPATA COM FRIEZA TOTAL! ${team} ACREDITA! GOOOL!`;
      }
      if (isUrgent && mood === 'em_chamas') {
        return `${name} EM CHAMAS EMPATA! ${team} NÃO DESISTE! GOOOL!`;
      }
      if (isUrgent && trait === 'guerreiro') {
        return `${name} NA RAÇA! ${team} EMPATA! GOOOL!`;
      }
      if (isFirstGoal && cognitiveArchetype === 'finalizador') {
        return `${team} ABRE O PLACAR! ${name} — instinto de finalizador!`;
      }
      if (isFirstGoal && cardArchetype === 'novo_talento') {
        return `${team} ABRE O PLACAR! O jovem ${name} marca primeiro!`;
      }
      if (isClosing) return `GOOOL NOS ACRÉSCIMOS! ${name} — ${team}!`;
    }

    if (isFirstGoal && isOpening) return `GOOOL RELÂMPAGO! ${name} MARCA LOGO DE INÍCIO — ${team}!`;
    if (isFirstGoal) return `${team} ABRE O PLACAR! ${name} MARCA O PRIMEIRO!`;
    if (isUrgent) return `${name} EMPATA! ${team} ACREDITA! GOOOL!`;
    if (isClosing) return `GOOOL NOS ACRÉSCIMOS! ${name} — ${team}!`;
    if (tightGame) return `GOOOL! ${name} QUEBRA O EQUILÍBRIO — ${team} NA FRENTE!`;
    return null;
  }

  if (type === 'shot' && isUrgent) {
    if (profile?.trait === 'finalizador') {
      return `${name} PRECISA FAZER ISSO AGORA — finaliza com o instinto do goleador!`;
    }
    return `${name} PRECISA FAZER ISSO AGORA — finaliza com tudo!`;
  }

  if (type === 'pass' && isClosing && losingTeam !== team) {
    if (profile?.trait === 'experiente') {
      return `${team} administra. ${name} — veterano — esfria o jogo.`;
    }
    return `${team} administra. ${name} esfria o jogo.`;
  }

  if (type === 'pressure' && minute > 75) {
    if (profile?.trait === 'guerreiro') {
      return `${team} aperta! ${name} não para de correr — pressão total!`;
    }
    return `${team} aperta! Pressão total nos minutos finais.`;
  }

  if (type === 'tackle' && profile?.mood === 'em_chamas') {
    return `${name} em chamas — recupera a bola com autoridade!`;
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
  save:         ['Goleiro defende!', 'Defesa difícil — quase gol!', '{name} pega firme com o goleiro.', 'Goleiro espalma o chute do {name}!'],
  post:         ['NA TRAVE! {name} quase marcou!', 'Bola explode na trave!', 'Centímetros — bate na madeira!'],
  wide:         ['Pra fora! {name} mandou no alto.', '{name} chuta — bola passa raspando!', 'Mandou pra galera — {name} desperdiçou.'],
  rebound:      ['Rebote na área — segue o jogo!', '{name} chutou, sobrou pra área.', 'Bola viva após defesa parcial.'],
  blocked:      ['Chute bloqueado pela defesa!', '{name} chuta — defensor bloqueia!', 'Bloqueio firme — {team} trava a finalização!', 'Corpo no chute! Defensor anula {name}!'],
  duel:         ['{name} briga pela bola — duelo no campo!', '{name} não sai do lugar — disputa intensa!', 'Duelo físico — {name} segura a posição!'],
  // Gatilhos táticos especiais
  tiktak:       ['{name} de primeira — tik-tak no meio!', '{name} toca de primeira — circulação rápida!', 'Um toque só — {name} acelera o jogo!'],
  long_ball:    ['{name} lança de lado a lado — bola longa!', '{name} muda o jogo com lançamento diagonal!', 'Bola longa de {name} — muda o corredor!'],
  false9:       ['{name} segura, gira e chuta — falso 9 em ação!', '{name} recua, cria espaço e finaliza!', 'Falso 9! {name} engana a defesa e chuta!'],
  forced_shot:  ['{name} tem que chutar — zona de ataque!', '{name} não tem saída — finaliza!', '{name} na área — obrigado a chutar!'],
  duel_win:     ['{name} ganha o duelo sem sair do lugar!', '{name} segura a posição — duelo ganho!', '{name} firme — recupera a bola no duelo!'],
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
  profile?: PlayerNarrativeProfile,
  tacticalTrigger?: import('./types').TacticalTrigger,
): string {
  // 0. Gatilho tático especial — narração específica da mecânica
  if (tacticalTrigger && tacticalTrigger !== null) {
    const triggerLines = GENERAL_NARRATION[tacticalTrigger];
    if (triggerLines) return fill(pick(triggerLines), { name, team });
  }

  // 1. Context layer — momentos urgentes/dramáticos com perfil rico
  const ctx = contextNarration(type, name, team, minute, score, profile);
  if (ctx) return ctx;

  // 2. Perfil narrativo — frases baseadas em traço + humor (quando disponível)
  if (profile) {
    const profileLine = profileNarration(type, name, profile, minute);
    if (profileLine) return profileLine;
  }

  // 3. Archetype layer (engine Classic)
  if (archetype) {
    const archetypeMap = ARCHETYPE_NARRATION[archetype];
    if (archetypeMap) {
      const templates = archetypeMap[type];
      if (templates && templates.length > 0) {
        return fill(pick(templates), { name, team });
      }
    }
  }

  // 4. General fallback
  const general = GENERAL_NARRATION[type];
  if (general) return fill(pick(general), { name, team });
  return fill('{name} participa da jogada.', { name, team });
}

/**
 * Camada de narração baseada no PlayerNarrativeProfile.
 * Gera frases que refletem quem o jogador É, não só o que ele fez.
 */
function profileNarration(
  type: EventType,
  name: string,
  profile: PlayerNarrativeProfile,
  minute: number,
): string | null {
  const { trait, mood, cognitiveArchetype, attrs, fatigue, isLegacy } = profile;
  const tp = traitPhrase(trait, name);
  const mp = moodPhrase(mood);

  // Gol — frases mais ricas possíveis
  if (type === 'goal') {
    if (isLegacy) return `A LENDA MARCA! ${name}${mp} — GOOOL!`;
    if (trait === 'finalizador' && attrs.finalizacao >= 82) {
      return `GOOOL! ${tp} faz o que sabe — finalização perfeita!`;
    }
    if (trait === 'sangue_frio' && minute > 70) {
      return `GOOOL! ${tp} decide sem sentir a pressão!`;
    }
    if (mood === 'em_chamas') {
      return `GOOOL! ${name} em chamas — imparável hoje!`;
    }
    if (cognitiveArchetype === 'finalizador') {
      return `GOOOL! ${name} — instinto puro de finalizador!`;
    }
    if (trait === 'guerreiro' && fatigue > 70) {
      return `GOOOL! ${name} no limite do cansaço — mas não desiste!`;
    }
    if (trait === 'imprevisivel') {
      return `GOOOL! ${name} surpreende todo mundo — impossível de prever!`;
    }
    return null;
  }

  // Chute
  if (type === 'shot') {
    if (trait === 'finalizador' && attrs.finalizacao >= 80) {
      return `${tp} finaliza com a precisão que é sua marca!`;
    }
    if (mood === 'em_chamas') {
      return `${name}${mp} — chuta com tudo!`;
    }
    if (trait === 'imprevisivel') {
      return `${name} arrisca de onde ninguém esperava!`;
    }
    if (fatigue > 78 && attrs.mentalidade >= 70) {
      return `${name} cansado, mas não desiste — finaliza!`;
    }
    return null;
  }

  // Passe
  if (type === 'pass') {
    if (trait === 'criativo' && attrs.passe >= 78) {
      return `${tp} enxerga o corredor e distribui com classe.`;
    }
    if (cognitiveArchetype === 'construtor') {
      return `${name} constrói a jogada com paciência.`;
    }
    if (trait === 'experiente') {
      return `${tp} esfria o jogo — leitura de veterano.`;
    }
    return null;
  }

  // Desarme / interceptação
  if (type === 'tackle' || type === 'interception') {
    if (trait === 'destruidor') {
      return `${tp} para a jogada na força!`;
    }
    if (cognitiveArchetype === 'destruidor') {
      return `${name} antecipa e corta — destruidor em ação!`;
    }
    if (trait === 'guerreiro') {
      return `${name} não para de lutar — recupera a bola!`;
    }
    if (mood === 'em_chamas') {
      return `${name}${mp} — intercepta com autoridade!`;
    }
    return null;
  }

  // Pressão
  if (type === 'pressure') {
    if (trait === 'guerreiro' && attrs.fisico >= 72) {
      return `${name} não para de correr — pressão constante!`;
    }
    if (cognitiveArchetype === 'destruidor') {
      return `${name} caça a bola sem descanso!`;
    }
    return null;
  }

  // Falta
  if (type === 'foul') {
    if (trait === 'agressivo') {
      return `${name} entra com tudo — falta dura!`;
    }
    if (fatigue > 75) {
      return `${name} cansado comete a falta — desgaste visível.`;
    }
    return null;
  }

  return null;
}


import type { ArchetypeId, EventType, MatchScore } from './types';
import type { PlayerNarrativeProfile } from '@/gamespirit/playerNarrativeProfile';
import { traitPhrase, moodPhrase } from '@/gamespirit/playerNarrativeProfile';
import { L, emIngles } from '@/i18n/L';

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

const ARCHETYPE_NARRATION_EN: ArchetypeNarration = {
  MAESTRO: {
    pass:  [
      '{name} distributes with surgical precision.',
      '{name} opens up the pitch with a master\'s pass.',
      '{name} controls the tempo — everything goes through him.',
      '{name} sees the lane before anyone else.',
    ],
    shot:  ['{name} tries it from mid-range!', '{name} surprises with a long-range shot!'],
  },
  WILD: {
    shot:  [
      '{name} lets fly from distance — no second thoughts!',
      '{name} tries the impossible!',
      '{name} fires from outside the box!',
      '{name} doesn\'t think — hits it with everything!',
    ],
    pass:  ['{name} tries the risky pass.', '{name} forces the play — high risk!'],
    foul:  ['{name} goes in hard — nasty foul!', '{name} doesn\'t care about the consequences!'],
  },
  VETERAN: {
    pass:  [
      '{name} calms the game with experience.',
      '{name} runs the show — a true veteran.',
      '{name} organises the team calmly.',
      '{name} reads the game before anyone else.',
    ],
    tackle: ['{name} reads the play before anyone else.', '{name} anticipates with years of wisdom.'],
    interception: ['{name} was there before the ball arrived.'],
  },
  FINISHER: {
    shot:  [
      '{name} shoots — perfect position!',
      '{name} doesn\'t waste the chance!',
      '{name} was waiting for this moment!',
      '{name} shoots with the cool of someone who lives for goals!',
    ],
    goal:  [
      '{name} makes no mistake! GOAL!',
      '{name} froze the keeper — pure instinct!',
      '{name} was in the right place — GOAL!',
      'GOAL! {name} — the finisher does what he knows!',
      '{name} scores like he was born to do it!',
    ],
  },
  DESTROYER: {
    tackle: [
      '{name} stops it by force — attack destroyed.',
      '{name} goes in hard and clean.',
      '{name} lets nothing through — destroyer in action!',
    ],
    foul:  ['{name} forces the error — tactical foul.', '{name} stops the counter with pure grit!'],
    interception: ['{name} wins the ball with authority!'],
  },
  HUNTER: {
    interception: [
      '{name} anticipates and steals the ball!',
      '{name} reads the pass and intercepts!',
      '{name} was in the right lane — interception!',
    ],
    pressure: [
      '{name} presses high — no breathing room for the opponent.',
      '{name} hunts the ball non-stop!',
    ],
    tackle: ['{name} wins it back with intensity!'],
  },
  BOX_INVADER: {
    shot:  [
      '{name} bursts into the box — shoots!',
      '{name} with the header — perfect timing!',
      '{name} appears in the box like a ghost!',
    ],
    cross: ['{name} takes up position at the back post.', '{name} attacks the space in the box!'],
    goal:  [
      'GOAL! {name} bursts into the box and makes no mistake!',
      '{name} was in the right place — goal from inside the box!',
    ],
  },
  ENGINE: {
    pass:  [
      '{name} links the play — the team\'s engine.',
      '{name} covers every blade of grass.',
      '{name} never stops — connects the team!',
    ],
    tackle: ['{name} wins it and moves it on — tireless engine!'],
    pressure: ['{name} presses and wins it back — full energy!'],
  },
  COLD_BLOOD: {
    shot:  [
      '{name} no emotion — finishes coolly.',
      '{name} calculates everything before shooting.',
    ],
    goal:  [
      '{name} ice in his veins — GOAL!',
      'GOAL! {name} — absolute composure in front of goal!',
      '{name} didn\'t feel the pressure — GOAL!',
    ],
    pass:  ['{name} distributes without hurry — total control.'],
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
    return L(`${team} começa a construir — primeiros toques do jogo.`, `${team} starts building — first touches of the game.`);
  }
  if (type === 'pressure' && isOpening) {
    return L(`${name} pressiona desde o início — ${team} quer impor o ritmo.`, `${name} presses from the start — ${team} want to set the tempo.`);
  }
  if (type === 'pass' && isHalfTime && !isUrgent) {
    return L(`${name} circula antes do intervalo — ${team} administra.`, `${name} keeps it moving before half-time — ${team} manage the game.`);
  }
  if (type === 'shot' && isHalfTime) {
    return L(`${name} tenta antes do apito — ${team} quer o gol do intervalo!`, `${name} tries before the whistle — ${team} want a goal before the break!`);
  }
  if (type === 'pass' && isFinalPush && tightGame) {
    return L(`${name} mantém a posse — cada toque vale ouro agora.`, `${name} keeps possession — every touch is gold now.`);
  }
  if (type === 'tackle' && isFinalPush) {
    return L(`${name} não deixa o adversário respirar — pressão total nos minutos finais!`, `${name} gives the opponent no air — full pressure in the closing minutes!`);
  }
  if (type === 'pass' && isExtraTime) {
    return L(`${name} circula nos acréscimos — ${team} segura o resultado.`, `${name} keeps it moving in stoppage time — ${team} hold on to the result.`);
  }
  if (type === 'shot' && isExtraTime) {
    return L(`${name} CHUTA NOS ACRÉSCIMOS — pode ser o gol da vitória!`, `${name} SHOOTS IN STOPPAGE TIME — this could be the winner!`);
  }
  if (type === 'duel') {
    return L(`${name} entra no duelo — briga pela bola sem sair do lugar!`, `${name} goes into the duel — fights for the ball without giving ground!`);
  }

  if (type === 'goal') {
    // Gol com perfil rico
    if (profile) {
      const { trait, mood, cognitiveArchetype, isLegacy, cardArchetype } = profile;

      if (isLegacy) return L(`A LENDA FALA! ${name} marca — ${team} explode!`, `THE LEGEND SPEAKS! ${name} scores — ${team} erupt!`);

      if (isUrgent && trait === 'sangue_frio') {
        return L(`${name} EMPATA COM FRIEZA TOTAL! ${team} ACREDITA! GOOOL!`, `${name} EQUALISES, ICE COLD! ${team} BELIEVE! GOAL!`);
      }
      if (isUrgent && mood === 'em_chamas') {
        return L(`${name} EM CHAMAS EMPATA! ${team} NÃO DESISTE! GOOOL!`, `${name} ON FIRE EQUALISES! ${team} NEVER GIVE UP! GOAL!`);
      }
      if (isUrgent && trait === 'guerreiro') {
        return L(`${name} NA RAÇA! ${team} EMPATA! GOOOL!`, `${name} WITH PURE GRIT! ${team} EQUALISE! GOAL!`);
      }
      if (isFirstGoal && cognitiveArchetype === 'finalizador') {
        return L(`${team} ABRE O PLACAR! ${name} — instinto de finalizador!`, `${team} OPEN THE SCORING! ${name} — a finisher's instinct!`);
      }
      if (isFirstGoal && cardArchetype === 'novo_talento') {
        return L(`${team} ABRE O PLACAR! O jovem ${name} marca primeiro!`, `${team} OPEN THE SCORING! Young ${name} strikes first!`);
      }
      if (isClosing) return L(`GOOOL NOS ACRÉSCIMOS! ${name} — ${team}!`, `STOPPAGE-TIME GOAL! ${name} — ${team}!`);
    }

    if (isFirstGoal && isOpening) return L(`GOOOL RELÂMPAGO! ${name} MARCA LOGO DE INÍCIO — ${team}!`, `LIGHTNING GOAL! ${name} SCORES RIGHT FROM THE START — ${team}!`);
    if (isFirstGoal) return L(`${team} ABRE O PLACAR! ${name} MARCA O PRIMEIRO!`, `${team} OPEN THE SCORING! ${name} GETS THE FIRST!`);
    if (isUrgent) return L(`${name} EMPATA! ${team} ACREDITA! GOOOL!`, `${name} EQUALISES! ${team} BELIEVE! GOAL!`);
    if (isClosing) return L(`GOOOL NOS ACRÉSCIMOS! ${name} — ${team}!`, `STOPPAGE-TIME GOAL! ${name} — ${team}!`);
    if (tightGame) return L(`GOOOL! ${name} QUEBRA O EQUILÍBRIO — ${team} NA FRENTE!`, `GOAL! ${name} BREAKS THE DEADLOCK — ${team} IN FRONT!`);
    return null;
  }

  if (type === 'shot' && isUrgent) {
    if (profile?.trait === 'finalizador') {
      return L(`${name} PRECISA FAZER ISSO AGORA — finaliza com o instinto do goleador!`, `${name} HAS TO DO IT NOW — shoots with a goalscorer's instinct!`);
    }
    return L(`${name} PRECISA FAZER ISSO AGORA — finaliza com tudo!`, `${name} HAS TO DO IT NOW — shoots with everything!`);
  }

  if (type === 'pass' && isClosing && losingTeam !== team) {
    if (profile?.trait === 'experiente') {
      return L(`${team} administra. ${name} — veterano — esfria o jogo.`, `${team} manage it. ${name} — the veteran — slows the game down.`);
    }
    return L(`${team} administra. ${name} esfria o jogo.`, `${team} manage it. ${name} slows the game down.`);
  }

  if (type === 'pressure' && minute > 75) {
    if (profile?.trait === 'guerreiro') {
      return L(`${team} aperta! ${name} não para de correr — pressão total!`, `${team} turn up the heat! ${name} never stops running — full pressure!`);
    }
    return L(`${team} aperta! Pressão total nos minutos finais.`, `${team} turn up the heat! Full pressure in the closing minutes.`);
  }

  if (type === 'tackle' && profile?.mood === 'em_chamas') {
    return L(`${name} em chamas — recupera a bola com autoridade!`, `${name} on fire — wins the ball back with authority!`);
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

const GENERAL_NARRATION_EN: Record<string, string[]> = {
  goal:         ['GOAL FOR {team}! {name} SCORES!', '{team} SCORE! GOAL!', 'IT\'S A GOAL! {name} — {team}!'],
  danger:       ['Box under threat!', 'Danger for {team}!', 'Dangerous cross into the box!'],
  pressure:     ['{team} squeeze the midfield.', 'Intensity rising on the pitch.', '{name} won\'t let the opponent play out.'],
  corner:       ['Corner to {team}.', 'Ball into the box — {team} corner.'],
  foul:         ['Foul. Play stopped.', 'Referee whistles — {name} brings his man down.'],
  pass:         ['{name} receives and distributes.', 'Ball moved around by {team}.', '{name} controls and finds a teammate.'],
  shot:         ['{team} shoot!', '{name} shoots!', 'Shot from inside the box — {team}!'],
  tackle:       ['{name} gets there first!', 'Midfield battle — {name} wins it.', 'Intense physical duel.'],
  interception: ['{name} intercepts smartly!', 'Interception — {team} win the ball back!'],
  cross:        ['Cross into the box!', 'Ball lofted in — {team} attack!', '{name} crosses into the box.'],
  save:         ['Goalkeeper saves!', 'Tough save — almost a goal!', '{name} denied by the keeper.', 'Goalkeeper parries {name}\'s shot!'],
  post:         ['OFF THE POST! {name} so close!', 'The ball smashes off the post!', 'Inches — it hits the woodwork!'],
  wide:         ['Wide! {name} blazed it over.', '{name} shoots — just wide!', 'Into the stands — {name} wasted it.'],
  rebound:      ['Rebound in the box — play on!', '{name} shot, it dropped in the box.', 'Ball live after a partial save.'],
  blocked:      ['Shot blocked by the defence!', '{name} shoots — defender blocks!', 'Solid block — {team} stop the shot!', 'Body on the line! Defender denies {name}!'],
  duel:         ['{name} fights for the ball — duel on the pitch!', '{name} holds his ground — intense battle!', 'Physical duel — {name} holds position!'],
  tiktak:       ['{name} first time — tiki-taka in midfield!', '{name} one-touch — quick circulation!', 'One touch — {name} speeds up the game!'],
  long_ball:    ['{name} switches play — long ball!', '{name} changes the game with a diagonal ball!', 'Long ball from {name} — switches the flank!'],
  false9:       ['{name} holds, turns and shoots — false 9 in action!', '{name} drops deep, creates space and shoots!', 'False 9! {name} fools the defence and shoots!'],
  forced_shot:  ['{name} has to shoot — attacking zone!', '{name} has no way out — shoots!', '{name} in the box — has to shoot!'],
  duel_win:     ['{name} wins the duel without giving ground!', '{name} holds position — duel won!', '{name} stands firm — wins the ball in the duel!'],
};

const ARCH_NARR = emIngles() ? ARCHETYPE_NARRATION_EN : ARCHETYPE_NARRATION;
const GEN_NARR = emIngles() ? GENERAL_NARRATION_EN : GENERAL_NARRATION;

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
    const triggerLines = GEN_NARR[tacticalTrigger];
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
    const archetypeMap = ARCH_NARR[archetype];
    if (archetypeMap) {
      const templates = archetypeMap[type];
      if (templates && templates.length > 0) {
        return fill(pick(templates), { name, team });
      }
    }
  }

  // 4. General fallback
  const general = GEN_NARR[type];
  if (general) return fill(pick(general), { name, team });
  return fill(L('{name} participa da jogada.', '{name} is involved in the play.'), { name, team });
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
    if (isLegacy) return L(`A LENDA MARCA! ${name}${mp} — GOOOL!`, `THE LEGEND SCORES! ${name}${mp} — GOAL!`);
    if (trait === 'finalizador' && attrs.finalizacao >= 82) {
      return L(`GOOOL! ${tp} faz o que sabe — finalização perfeita!`, `GOAL! ${tp} does what he does best — perfect finish!`);
    }
    if (trait === 'sangue_frio' && minute > 70) {
      return L(`GOOOL! ${tp} decide sem sentir a pressão!`, `GOAL! ${tp} decides it without feeling the pressure!`);
    }
    if (mood === 'em_chamas') {
      return L(`GOOOL! ${name} em chamas — imparável hoje!`, `GOAL! ${name} on fire — unstoppable today!`);
    }
    if (cognitiveArchetype === 'finalizador') {
      return L(`GOOOL! ${name} — instinto puro de finalizador!`, `GOAL! ${name} — pure finisher's instinct!`);
    }
    if (trait === 'guerreiro' && fatigue > 70) {
      return L(`GOOOL! ${name} no limite do cansaço — mas não desiste!`, `GOAL! ${name} running on empty — but never gives up!`);
    }
    if (trait === 'imprevisivel') {
      return L(`GOOOL! ${name} surpreende todo mundo — impossível de prever!`, `GOAL! ${name} surprises everyone — impossible to read!`);
    }
    return null;
  }

  // Chute
  if (type === 'shot') {
    if (trait === 'finalizador' && attrs.finalizacao >= 80) {
      return L(`${tp} finaliza com a precisão que é sua marca!`, `${tp} finishes with his trademark precision!`);
    }
    if (mood === 'em_chamas') {
      return L(`${name}${mp} — chuta com tudo!`, `${name}${mp} — shoots with everything!`);
    }
    if (trait === 'imprevisivel') {
      return L(`${name} arrisca de onde ninguém esperava!`, `${name} tries it from where no one expected!`);
    }
    if (fatigue > 78 && attrs.mentalidade >= 70) {
      return L(`${name} cansado, mas não desiste — finaliza!`, `${name} tired, but never gives up — shoots!`);
    }
    return null;
  }

  // Passe
  if (type === 'pass') {
    if (trait === 'criativo' && attrs.passe >= 78) {
      return L(`${tp} enxerga o corredor e distribui com classe.`, `${tp} spots the lane and distributes with class.`);
    }
    if (cognitiveArchetype === 'construtor') {
      return L(`${name} constrói a jogada com paciência.`, `${name} builds the move patiently.`);
    }
    if (trait === 'experiente') {
      return L(`${tp} esfria o jogo — leitura de veterano.`, `${tp} slows the game down — a veteran's read.`);
    }
    return null;
  }

  // Desarme / interceptação
  if (type === 'tackle' || type === 'interception') {
    if (trait === 'destruidor') {
      return L(`${tp} para a jogada na força!`, `${tp} stops the move by force!`);
    }
    if (cognitiveArchetype === 'destruidor') {
      return L(`${name} antecipa e corta — destruidor em ação!`, `${name} reads it and cuts it out — destroyer in action!`);
    }
    if (trait === 'guerreiro') {
      return L(`${name} não para de lutar — recupera a bola!`, `${name} never stops fighting — wins the ball back!`);
    }
    if (mood === 'em_chamas') {
      return L(`${name}${mp} — intercepta com autoridade!`, `${name}${mp} — intercepts with authority!`);
    }
    return null;
  }

  // Pressão
  if (type === 'pressure') {
    if (trait === 'guerreiro' && attrs.fisico >= 72) {
      return L(`${name} não para de correr — pressão constante!`, `${name} never stops running — constant pressure!`);
    }
    if (cognitiveArchetype === 'destruidor') {
      return L(`${name} caça a bola sem descanso!`, `${name} hunts the ball relentlessly!`);
    }
    return null;
  }

  // Falta
  if (type === 'foul') {
    if (trait === 'agressivo') {
      return L(`${name} entra com tudo — falta dura!`, `${name} goes in hard — nasty foul!`);
    }
    if (fatigue > 75) {
      return L(`${name} cansado comete a falta — desgaste visível.`, `${name}, tired, commits the foul — visible fatigue.`);
    }
    return null;
  }

  return null;
}


import type { ArchetypeId, EventType } from './types';

type NarrationMap = Partial<Record<EventType, string[]>>;
type ArchetypeNarration = Partial<Record<ArchetypeId, NarrationMap>>;

const ARCHETYPE_NARRATION: ArchetypeNarration = {
  MAESTRO: {
    pass:  ['(MAESTRO) {name} distribui com precisão.', '(MAESTRO) {name} abre o campo.', '(MAESTRO) {name} controla o ritmo.'],
    shot:  ['(MAESTRO) {name} arrisca de meia distância.'],
  },
  WILD: {
    shot:  ['(WILD) {name} arrisca de longe!', '(WILD) {name} tenta o impossível!', '(WILD) {name} dispara sem pensar!'],
    pass:  ['(WILD) {name} tenta o passe arriscado.'],
    foul:  ['(WILD) {name} entra com tudo!'],
  },
  VETERAN: {
    pass:  ['(VETERAN) {name} esfria o jogo.', '(VETERAN) {name} manda em campo.', '(VETERAN) {name} posiciona a equipe.'],
    tackle:['(VETERAN) {name} lê a jogada.'],
  },
  FINISHER: {
    shot:  ['(FINISHER) {name} finaliza!', '(FINISHER) {name} não perdoa a chance!'],
    goal:  ['(FINISHER) {name} não perdoa! GOL!', '(FINISHER) {name} gelou o goleiro!'],
  },
  DESTROYER: {
    tackle:['(DESTROYER) {name} para na força.', '(DESTROYER) {name} destrói o ataque.'],
    foul:  ['(DESTROYER) {name} força o erro.'],
  },
  HUNTER: {
    interception: ['(HUNTER) {name} antecipa à marcação!', '(HUNTER) {name} rouba a bola!'],
    pressure:     ['(HUNTER) {name} pressiona alto.'],
  },
  BOX_INVADER: {
    shot:  ['(BOX_INVADER) {name} invade a área!', '(BOX_INVADER) {name} de cabeça!'],
    cross: ['(BOX_INVADER) {name} se posiciona no segundo pau.'],
  },
  ENGINE: {
    pass:  ['(ENGINE) {name} liga o jogo.', '(ENGINE) {name} cobre o campo.'],
  },
  COLD_BLOOD: {
    shot:  ['(COLD_BLOOD) {name} sem emoção — finaliza.'],
  },
};

const GENERAL_NARRATION: Record<string, string[]> = {
  goal:         ['GOOOOOOL DO {team}!', '{team} MARCA! GOOOL!', 'É GOOOOOL! {team} ABRE O PLACAR!'],
  danger:       ['Cruzamento perigoso!', 'Área ameaçada!', 'Situação de perigo!', 'Escanteio perigoso do {team}!'],
  pressure:     ['Pressão alta ativada.', '{team} aperta o meio.', 'Intensidade aumenta em campo.'],
  corner:       ['Escanteio para o {team}.', 'Bola na área — escanteio.'],
  foul:         ['Falta cometida.', 'Jogo parado.', 'Árbitro apita a falta.'],
  pass:         ['{name} recebe na direita...', 'Passe circulado pelo {team}.', '{name} domina e distribui.'],
  shot:         ['Finalização do {team}!', '{name} chuta!', 'Chute de dentro da área!'],
  tackle:       ['{name} se antecipa à marcação!', 'Disputa no meio-campo.', 'Duelo físico intenso.'],
  interception: ['{name} se antecipa à marcação!', 'Interceptação inteligente!'],
  cross:        ['Faz o corta-luz... levou pro fundo!', 'Cruzamento na área!', 'Bola levantada na grande área.'],
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
): string {
  if (archetype) {
    const archetypeMap = ARCHETYPE_NARRATION[archetype];
    if (archetypeMap) {
      const templates = archetypeMap[type];
      if (templates && templates.length > 0) {
        return fill(pick(templates), { name, team });
      }
    }
  }
  const general = GENERAL_NARRATION[type];
  if (general) return fill(pick(general), { name, team });
  return fill('{name} participa da jogada.', { name, team });
}

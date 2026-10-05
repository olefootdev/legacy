/**
 * PlayerNarrativeProfile — extrai a riqueza dos agentes para narrativa.
 *
 * Agrega: arquétipo cognitivo, personalidade derivada, intenção de prethinking,
 * stats de partida, zone memory e arquétipo tático. Zero tokens, zero chamadas
 * externas — tudo computado localmente a partir do estado existente.
 *
 * Consumido por:
 *   - SpiritContext (narrativa tick a tick na partida rápida / test2d)
 *   - Classic narration.ts (frases ricas por evento)
 */

import type { PitchPlayerState } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';
import type { MatchCognitiveArchetype, MatchPlayerPersonality } from '@/match/playerInMatch';
import { derivePersonalityFromAttrs } from '@/match/playerInMatch';
import { L } from '@/i18n/L';

// ─── Tipos exportados ────────────────────────────────────────────────────────

/** Intenção narrativa simplificada — o que o jogador "quer" neste momento. */
export type NarrativeIntent =
  | 'atacar'       // atacar_espaco, finalizar_rapido
  | 'criar'        // passe_rapido, tabela, receber_e_girar
  | 'defender'     // cobertura_defensiva, pressionar_portador, interceptar_linha
  | 'segurar'      // proteger_bola, matar_jogada, encaixe
  | 'disputar';    // disputar_rebote

/** Traço de personalidade dominante — o mais saliente para a narrativa. */
export type NarrativeTrait =
  | 'sangue_frio'    // bigGameMentality alto + composure alto
  | 'agressivo'      // aggressiveness alto
  | 'criativo'       // ego alto + vision alto
  | 'guerreiro'      // workRate alto + loyalty alto
  | 'imprevisivel'   // riskAppetite alto + unpredictable
  | 'experiente'     // VETERAN archetype
  | 'destruidor'     // DESTROYER / destruidor archetype
  | 'finalizador'    // FINISHER / finalizador archetype
  | 'equilibrado';   // nenhum traço dominante

/** Estado emocional do jogador neste momento da partida. */
export type NarrativeMood =
  | 'em_chamas'    // confidence > 80 / onFire
  | 'confiante'    // confidence 60-80
  | 'pressionado'  // fatigue > 75 ou moraleRuntime baixo
  | 'neutro';

/**
 * Perfil narrativo completo de um jogador.
 * Leve — apenas primitivos e strings, sem referências circulares.
 */
export interface PlayerNarrativeProfile {
  playerId: string;
  name: string;
  shortName: string;
  pos: string;
  role: 'attack' | 'mid' | 'def' | 'gk';

  /** Arquétipo cognitivo do engine (executor/criador/destruidor/construtor/finalizador). */
  cognitiveArchetype: MatchCognitiveArchetype | null;

  /** Arquétipo tático do catálogo (CM_MEZZALA, ST_FALSE_9, etc.) — quando disponível. */
  tacticalArchetypeId: string | null;

  /** Arquétipo de carta (profissional/lenda/meme/ai_plus/novo_talento). */
  cardArchetype: string | null;

  /** Traço de personalidade dominante para a narrativa. */
  trait: NarrativeTrait;

  /** Intenção atual do jogador (derivada do prethinking ou do contexto). */
  intent: NarrativeIntent;

  /** Estado emocional atual. */
  mood: NarrativeMood;

  /** Personalidade derivada dos atributos. */
  personality: MatchPlayerPersonality;

  /** Atributos-chave normalizados 0-100 para frases específicas. */
  attrs: {
    finalizacao: number;
    passe: number;
    drible: number;
    marcacao: number;
    velocidade: number;
    tatico: number;
    mentalidade: number;
    confianca: number;
    fisico: number;
  };

  /** Fadiga atual 0-100. */
  fatigue: number;

  /** Confiança runtime 0-100 (de PlayerMatchRuntime, se disponível). */
  confidenceRuntime: number;

  /** Zona do campo onde o jogador tem mais confiança (de zoneMemory). */
  strongZone: string | null;

  /** É lenda? Modifica tom narrativo. */
  isLegacy: boolean;

  /** Skills equipadas (IDs) — para frases de habilidade especial. */
  skillIds: string[];
}

// ─── Builder principal ───────────────────────────────────────────────────────

/**
 * Constrói o perfil narrativo a partir do estado do pitch + entidade do roster.
 * Aceita dados parciais — nunca lança exceção.
 */
export function buildPlayerNarrativeProfile(
  pitch: PitchPlayerState,
  entity?: PlayerEntity,
): PlayerNarrativeProfile {
  const attrs = resolveAttrs(pitch, entity);
  const personality = derivePersonalityFromAttrs(attrs);
  const trait = deriveTrait(pitch, entity, personality);
  const intent = deriveIntent(pitch);
  const mood = deriveMood(pitch, entity);
  const strongZone = resolveStrongZone(entity);

  return {
    playerId: pitch.playerId,
    name: pitch.name,
    shortName: pitch.name.split(' ').pop() ?? pitch.name,
    pos: pitch.pos,
    role: pitch.role,
    cognitiveArchetype: pitch.cognitiveArchetype ?? null,
    tacticalArchetypeId: pitch.tacticalArchetypeId ?? null,
    cardArchetype: pitch.archetype ?? entity?.archetype ?? null,
    trait,
    intent,
    mood,
    personality,
    attrs,
    fatigue: pitch.fatigue,
    confidenceRuntime: resolveConfidence(entity),
    strongZone,
    isLegacy: entity?.isLegacy ?? false,
    skillIds: pitch.skillIds ?? [],
  };
}

// ─── Helpers internos ────────────────────────────────────────────────────────

function resolveAttrs(pitch: PitchPlayerState, entity?: PlayerEntity) {
  const pa = pitch.attributes;
  const ea = entity?.attrs;
  return {
    finalizacao: pa?.finalizacao ?? ea?.finalizacao ?? 60,
    passe:       pa?.passeCurto  ?? ea?.passe       ?? 60,
    drible:      pa?.drible      ?? ea?.drible       ?? 60,
    marcacao:    pa?.marcacao    ?? ea?.marcacao     ?? 60,
    velocidade:  pa?.velocidade  ?? ea?.velocidade   ?? 60,
    tatico:      pa?.tatico      ?? ea?.tatico       ?? 60,
    mentalidade: pa?.mentalidade ?? ea?.mentalidade  ?? 60,
    confianca:   pa?.confianca   ?? ea?.confianca    ?? 60,
    fisico:      pa?.fisico      ?? ea?.fisico       ?? 60,
    // campos exigidos por MatchPlayerAttributes
    passeCurto:  pa?.passeCurto  ?? ea?.passe       ?? 60,
    passeLongo:  pa?.passeLongo  ?? ea?.passe       ?? 60,
    cruzamento:  pa?.cruzamento  ?? ea?.passe       ?? 60,
    fairPlay:    pa?.fairPlay    ?? ea?.fairPlay     ?? 70,
  };
}

function resolveConfidence(entity?: PlayerEntity): number {
  // PlayerMatchRuntime está em state.playerHealth — aqui usamos confiança dos attrs como proxy
  return entity?.attrs?.confianca ?? 60;
}

function resolveStrongZone(entity?: PlayerEntity): string | null {
  // Lê zoneMemory do runtime se disponível via entity (não disponível diretamente aqui,
  // mas o campo existe em PlayerMatchRuntime — retornamos null como fallback seguro)
  return null;
}

function deriveTrait(
  pitch: PitchPlayerState,
  entity: PlayerEntity | undefined,
  personality: MatchPlayerPersonality,
): NarrativeTrait {
  const arch = pitch.cognitiveArchetype;
  const cardArch = pitch.archetype ?? entity?.archetype;

  if (arch === 'finalizador' || pitch.role === 'attack') {
    if ((pitch.attributes?.finalizacao ?? entity?.attrs?.finalizacao ?? 0) >= 82) return 'finalizador';
  }
  if (arch === 'destruidor') return 'destruidor';
  if (cardArch === 'lenda') return 'experiente';

  if (personality.bigGameMentality >= 75 && personality.aggressiveness < 60) return 'sangue_frio';
  if (personality.aggressiveness >= 75) return 'agressivo';
  if (personality.ego >= 72 && (pitch.attributes?.tatico ?? 60) >= 70) return 'criativo';
  if (personality.loyalty >= 75 && (pitch.attributes?.fisico ?? 60) >= 72) return 'guerreiro';

  // Arquétipo tático como desempate
  const tac = pitch.tacticalArchetypeId ?? '';
  if (tac.includes('MEZZALA') || tac.includes('TREQUARTISTA') || tac.includes('SHADOW')) return 'criativo';
  if (tac.includes('DESTROYER') || tac.includes('ANCHOR')) return 'destruidor';
  if (tac.includes('POACHER') || tac.includes('FINISHER')) return 'finalizador';

  return 'equilibrado';
}

function deriveIntent(pitch: PitchPlayerState): NarrativeIntent {
  // Sem acesso direto ao PrethinkingState aqui — derivamos do role + posição
  const role = pitch.role;
  const x = pitch.x; // 0-100, home ataca para +x

  if (role === 'attack') {
    return x > 65 ? 'atacar' : 'criar';
  }
  if (role === 'mid') {
    return x > 55 ? 'criar' : 'defender';
  }
  if (role === 'def') {
    return x < 40 ? 'defender' : 'segurar';
  }
  if (role === 'gk') return 'segurar';
  return 'segurar';
}

function deriveMood(pitch: PitchPlayerState, entity?: PlayerEntity): NarrativeMood {
  const fatigue = pitch.fatigue;
  const confianca = pitch.attributes?.confianca ?? entity?.attrs?.confianca ?? 60;

  if (confianca >= 82 && fatigue < 70) return 'em_chamas';
  if (confianca >= 65 && fatigue < 80) return 'confiante';
  if (fatigue >= 78 || confianca < 45) return 'pressionado';
  return 'neutro';
}

// ─── Utilitário: mapa de perfis para todo o XI ───────────────────────────────

/**
 * Constrói um mapa playerId → PlayerNarrativeProfile para todos os jogadores em campo.
 * Usado pelo Classic e pelo SpiritContext para lookup O(1).
 */
export function buildSquadNarrativeProfiles(
  pitchPlayers: PitchPlayerState[],
  roster: PlayerEntity[],
): Map<string, PlayerNarrativeProfile> {
  const map = new Map<string, PlayerNarrativeProfile>();
  for (const pitch of pitchPlayers) {
    const entity = roster.find((e) => e.id === pitch.playerId);
    map.set(pitch.playerId, buildPlayerNarrativeProfile(pitch, entity));
  }
  return map;
}

// ─── Utilitário: frase de traço para narração ────────────────────────────────

/** Retorna um fragmento narrativo curto baseado no traço do jogador. */
export function traitPhrase(trait: NarrativeTrait, name: string): string {
  switch (trait) {
    case 'sangue_frio':   return L(`${name}, gelado como sempre,`, `${name}, ice-cold as ever,`);
    case 'agressivo':     return L(`${name}, no limite da intensidade,`, `${name}, right on the edge,`);
    case 'criativo':      return L(`${name}, com a visão que só ele tem,`, `${name}, with vision only he has,`);
    case 'guerreiro':     return L(`${name}, que não para de correr,`, `${name}, who never stops running,`);
    case 'imprevisivel':  return L(`${name}, impossível de prever,`, `${name}, impossible to read,`);
    case 'experiente':    return L(`${name}, com a leitura de um veterano,`, `${name}, with a veteran's reading of the game,`);
    case 'destruidor':    return L(`${name}, que veio para destruir jogadas,`, `${name}, here to break up play,`);
    case 'finalizador':   return L(`${name}, que vive para o gol,`, `${name}, who lives for goals,`);
    default:              return `${name}`;
  }
}

/** Retorna fragmento de humor para enriquecer a frase. */
export function moodPhrase(mood: NarrativeMood): string {
  switch (mood) {
    case 'em_chamas':   return L(' em chamas nessa partida', ' on fire today');
    case 'pressionado': return L(' sentindo o peso do cansaço', ' feeling the fatigue');
    case 'confiante':   return L(' confiante no momento', ' full of confidence');
    default:            return '';
  }
}

/** Retorna fragmento de intenção para enriquecer a frase. */
export function intentPhrase(intent: NarrativeIntent): string {
  switch (intent) {
    case 'atacar':   return L('buscou o gol', 'went for goal');
    case 'criar':    return L('tentou criar a jogada', 'tried to create');
    case 'defender': return L('cortou o perigo', 'cut out the danger');
    case 'segurar':  return L('segurou a bola', 'held the ball up');
    case 'disputar': return L('disputou o rebote', 'fought for the rebound');
  }
}

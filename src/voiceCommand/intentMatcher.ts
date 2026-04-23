/**
 * Parser de comandos de voz — transcript → ParsedCommand[].
 *
 * Estratégia:
 *   1. Normaliza o texto (lowercase, sem acentos, trim de pontuação).
 *   2. Quebra em fragmentos por conectores ("e", "depois", "entao", "também").
 *   3. Em cada fragmento:
 *      a) Tenta match por substituição / formação (têm sintaxe própria).
 *      b) Testa padrões de intent (regex ou keywords ordenadas por especificidade).
 *      c) Extrai alvo (nome, camisa, role, posição ou ball carrier).
 *   4. Retorna array — comando composto vira múltiplos ParsedCommand.
 *
 * Sem LLM, sem rede. 100% determinístico + testável.
 */

import type { FormationSchemeId } from '@/match-engine/types';
import type {
  CommandTarget,
  ParsedCommand,
  VoiceIntent,
} from './types';
import { stemPt } from './stemPt';

// ─── Roster Context ─────────────────────────────────────────────────────────

export interface MatchRosterContext {
  /** Jogadores em campo do time casa (único time comandável). */
  homePlayers: Array<{
    playerId: string;
    name: string;
    num?: number;
    slotId?: string;
    role?: 'gk' | 'def' | 'mid' | 'attack';
  }>;
  /** Portador da bola atual, se houver. */
  ballCarrierPlayerId?: string;
}

// ─── Normalização ───────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')          // remove acentos
    .replace(/[.,!?;:"']/g, ' ')              // pontuação vira espaço
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fuzzy match entre token e alvo — compara por prefixo + distância simples.
 * Tolera: "adri" → "adrien", "gui" → "gui nunez".
 */
function fuzzyMatch(token: string, target: string): boolean {
  const a = normalize(token);
  const b = normalize(target);
  if (a === b) return true;
  if (b.startsWith(a) && a.length >= 3) return true;
  if (a.startsWith(b) && b.length >= 3) return true;
  // "adri" dentro de "adrien ayo"
  const targetTokens = b.split(' ');
  return targetTokens.some((t) => t === a || (t.startsWith(a) && a.length >= 3));
}

// ─── Quebra em fragmentos (comando composto) ────────────────────────────────

const CONJUNCTIONS = /\s+(e|entao|então|depois|enquanto|tambem|também|dai|daí|ai|aí)\s+/g;

function splitFragments(text: string): string[] {
  const clean = normalize(text);
  const parts = clean.split(CONJUNCTIONS).filter((p) => p.length > 0 && !/^(e|entao|depois|enquanto|tambem|dai|ai)$/.test(p));
  return parts.length > 0 ? parts : [clean];
}

// ─── Resolução de alvo ──────────────────────────────────────────────────────

const ROLE_KEYWORDS: Array<{ re: RegExp; role: 'gk' | 'def' | 'mid' | 'attack' }> = [
  { re: /\b(atacantes?|frente|pontas?)\b/, role: 'attack' },
  { re: /\b(meias?|meio\s*campo|volantes?)\b/, role: 'mid' },
  { re: /\b(zagueiros?|defesa|defensores?)\b/, role: 'def' },
  { re: /\b(goleiro|arqueiro|gr)\b/, role: 'gk' },
];

const TEAM_KEYWORDS = /\b(time|equipe|todos|geral)\b/;

const SHIRT_NUMBER_RE = /\b(?:camisa|numero|número)\s+(\d{1,2})\b|\b(\d{1,2})\s*(?:camisa)?\b/;

function tryResolveRole(text: string): CommandTarget | null {
  for (const { re, role } of ROLE_KEYWORDS) {
    if (re.test(text)) return { kind: 'role', role };
  }
  return null;
}

function tryResolveShirtNumber(text: string): CommandTarget | null {
  // evita confundir "4-3-3" como número de camisa
  if (/\d\s*[-x]\s*\d/.test(text)) return null;
  const m = text.match(SHIRT_NUMBER_RE);
  if (!m) return null;
  const n = Number(m[1] ?? m[2]);
  if (Number.isFinite(n) && n > 0 && n <= 99) return { kind: 'shirt_number', number: n };
  return null;
}

function tryResolveTeam(text: string): CommandTarget | null {
  if (TEAM_KEYWORDS.test(text)) return { kind: 'team' };
  return null;
}

function tryResolvePlayer(text: string, ctx: MatchRosterContext): CommandTarget | null {
  // Tokens candidatos: palavras com 3+ letras (remove stopwords curtos)
  const tokens = text.split(' ').filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  for (const tok of tokens) {
    for (const p of ctx.homePlayers) {
      if (fuzzyMatch(tok, p.name)) {
        return { kind: 'player_id', playerId: p.playerId };
      }
    }
  }
  return null;
}

const STOPWORDS = new Set([
  'que', 'para', 'pelo', 'pela', 'dos', 'das', 'com', 'sem', 'mais', 'menos',
  'agora', 'vai', 'vem', 'fica', 'fica', 'pra', 'aqui', 'ali', 'sobre', 'sob',
  'bem', 'mal', 'hoje', 'ainda', 'muito', 'pouco', 'outro', 'outra',
]);

function resolveTarget(text: string, ctx: MatchRosterContext, fallback: CommandTarget): CommandTarget {
  return (
    tryResolvePlayer(text, ctx) ??
    tryResolveShirtNumber(text) ??
    tryResolveRole(text) ??
    tryResolveTeam(text) ??
    fallback
  );
}

// ─── Match por intent ───────────────────────────────────────────────────────

interface IntentPattern {
  intent: VoiceIntent;
  patterns: RegExp[];
  /** Alvo default quando o parser não consegue extrair explicitamente. */
  defaultTarget: CommandTarget;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // ─── Substituição (especial — 2 nomes obrigatórios) ─────
  // (tratada em parser separado antes de tudo)

  // ─── Formação (regex específica) ────────────────────────
  // (tratada em parser separado)

  // ─── Criativos (ordem importa — match específicos antes de genéricos) ──
  {
    intent: 'hold_small_area',
    patterns: [/\bpequena\b.*\b(segura|espera|fixa)\b/, /\bvai\s+pra\s+pequena\b/],
    defaultTarget: { kind: 'role', role: 'attack' },
  },
  {
    intent: 'break_line',
    patterns: [/\bquebra(\s+a)?\s+linha\b/, /\bfura\s+a\s+linha\b/, /\bataca\s+as?\s+costas\b/],
    defaultTarget: { kind: 'role', role: 'attack' },
  },
  {
    intent: 'break_zone',
    patterns: [/\bquebra(\s+a)?\s+zona\b/, /\bsai\s+da\s+zona\b/],
    defaultTarget: { kind: 'ball_carrier' },
  },
  {
    intent: 'run_behind',
    patterns: [/\bcorre\s+pelas?\s+costas\b/, /\bpor\s+tras\s+do\s+marcador\b/],
    defaultTarget: { kind: 'ball_carrier' },
  },
  {
    intent: 'pedal_to_metal',
    patterns: [/\bpisa\s+no\s+acelerador\b/, /\btudo\s+no\s+acelerador\b/],
    defaultTarget: { kind: 'team' },
  },
  {
    intent: 'free_play',
    patterns: [/\bse\s+vira\b/, /\bjoga\s+livre\b/],
    defaultTarget: { kind: 'ball_carrier' },
  },
  {
    intent: 'wait_support',
    patterns: [/\bespera\s+a\s+chegada\b/, /\baguarda\s+o\s+apoio\b/],
    defaultTarget: { kind: 'ball_carrier' },
  },
  {
    intent: 'stretch_team',
    patterns: [/\bestica(r|m)?\s+o?\s+time\b/, /\bestica(r|m)?\s+a?\s+equipe\b/],
    defaultTarget: { kind: 'role', role: 'attack' },
  },

  // ─── Ações individuais ─────────────────────────────────
  {
    intent: 'invade_box',
    patterns: [/\binvade\s+a?\s+grande\s+area\b/, /\binvade\s+a?\s+area\b/, /\bataca\s+a\s+area\b/, /\bvai\s+pra\s+area\b/],
    defaultTarget: { kind: 'role', role: 'attack' },
  },
  {
    intent: 'dribble_attempt',
    patterns: [/\btenta\s+o?\s+drible\b/, /\bdribla\b/, /\bpassa\s+por\s+ele\b/],
    defaultTarget: { kind: 'ball_carrier' },
  },
  {
    intent: 'take_shot',
    patterns: [/\bchut(a|e)\b/, /\bfinaliza\b/, /\bbate\s+pro\s+gol\b/],
    defaultTarget: { kind: 'ball_carrier' },
  },
  {
    intent: 'cross_ball',
    patterns: [/\bcruza(r|m)?(\s+a\s+bola|\s+mais)?\b/],
    defaultTarget: { kind: 'role', role: 'def' },  // laterais; refinado no router
  },
  {
    intent: 'pass_to_player',
    patterns: [/\bpassa\s+(pro|pra|para)\s+o?\b/, /\bda\s+bola\s+pro\b/, /\btoca\s+pro\b/],
    defaultTarget: { kind: 'ball_carrier' },
  },
  {
    intent: 'hold_ball',
    patterns: [/\bsegura\s+a?\s+bola\b/, /\bfica\s+com\s+a?\s+bola\b/],
    defaultTarget: { kind: 'ball_carrier' },
  },
  {
    intent: 'quick_pass',
    patterns: [/\btoca\s+rapido\b/, /\btoque\s+rapido\b/],
    defaultTarget: { kind: 'team' },
  },
  {
    intent: 'switch_play',
    patterns: [/\btroca\s+de\s+lado\b/, /\binverte\b/],
    defaultTarget: { kind: 'ball_carrier' },
  },
  {
    intent: 'mark_player',
    patterns: [/\bmarca(r|m)?\s+o\b/, /\bcola\s+no\b/],
    defaultTarget: { kind: 'role', role: 'def' },
  },
  {
    intent: 'block_advance',
    patterns: [/\bsegura\s+(o|ele)\b/, /\bfecha\s+o\s+cara\b/],
    defaultTarget: { kind: 'role', role: 'def' },
  },

  // ─── Agressivo ────────────────────────────────────────
  {
    intent: 'aggressive_tackle',
    patterns: [/\bentra\s+(duro|com\s+tudo)\b/, /\bdivida\s+forte\b/],
    defaultTarget: { kind: 'role', role: 'def' },
  },
  {
    intent: 'tactical_foul',
    patterns: [/\bfaz\s+falta\b/, /\bcometa?\s+falta\b/, /\bpara\s+com\s+falta\b/],
    defaultTarget: { kind: 'role', role: 'mid' },
  },

  // ─── Coletivo ─────────────────────────────────────────
  {
    intent: 'team_press_high',
    patterns: [/\bpressiona(r|m)?\s+alto\b/, /\bpressao\s+alta\b/, /\bmarca(r|m)?\s+alto\b/],
    defaultTarget: { kind: 'team' },
  },
  {
    intent: 'team_retreat',
    patterns: [/\brecua(r|m)?\b/, /\bvolta\s+pra\s+defesa\b/, /\btodos?\s+atras\b/],
    defaultTarget: { kind: 'team' },
  },
  {
    intent: 'team_hold_possession',
    patterns: [/\bmata\s+o\s+jogo\b/, /\bsegura\s+o\s+jogo\b/, /\bposse\s+segura\b/],
    defaultTarget: { kind: 'team' },
  },
  {
    intent: 'team_high_line',
    patterns: [/\bsobe\s+o\s+time\b/, /\blinha\s+alta\b/],
    defaultTarget: { kind: 'team' },
  },
  {
    intent: 'forwards_press_defenders',
    patterns: [/\batacantes?\s+pressiona(r|m)?\b/, /\bataque\s+pressao\b/],
    defaultTarget: { kind: 'role', role: 'attack' },
  },
  {
    intent: 'midfielders_compact',
    patterns: [/\bmeias?\s+fecha(m|r)?\s+o\s+meio\b/, /\bmeio\s+compacto\b/],
    defaultTarget: { kind: 'role', role: 'mid' },
  },
  {
    intent: 'laterals_cross',
    patterns: [/\blaterais?\s+cruza(r|m)?\s+mais\b/],
    defaultTarget: { kind: 'role', role: 'def' },
  },
  {
    intent: 'left_back_overlap',
    patterns: [/\bsobe\s+o\s+lateral\b/, /\blateral\s+esquerdo\s+sobe\b/],
    defaultTarget: { kind: 'slot', slotId: 'le' },
  },

  // ─── Físico / Mental ─────────────────────────────────
  {
    intent: 'spare_player',
    patterns: [/\bpoupa\s+o\b/, /\bdesacelera\s+o\b/],
    defaultTarget: { kind: 'ball_carrier' },
  },
  {
    intent: 'calm_team',
    patterns: [/\bacalma\s+o\s+time\b/, /\brespira\b/, /\bcalma\s+ai\b/],
    defaultTarget: { kind: 'team' },
  },
];

// ─── Parser especial: substituição ──────────────────────────────────────────

const SUBSTITUTION_RE =
  /(?:sai|tira)\s+(?:o\s+)?([\w]+(?:\s+[\w]+)?)\s+(?:entra|coloca|poe|põe)\s+(?:o\s+)?([\w]+(?:\s+[\w]+)?)/;

const SUBSTITUTION_RE_2 =
  /(?:substitui|troca)\s+(?:o\s+)?([\w]+(?:\s+[\w]+)?)\s+(?:por|pelo)\s+(?:o\s+)?([\w]+(?:\s+[\w]+)?)/;

function tryMatchSubstitution(
  text: string,
  ctx: MatchRosterContext,
  fragmentIndex: number,
): ParsedCommand | null {
  const m = text.match(SUBSTITUTION_RE) ?? text.match(SUBSTITUTION_RE_2);
  if (!m) return null;
  const outName = m[1]!.trim();
  const inName = m[2]!.trim();
  const outTarget: CommandTarget = tryResolvePlayer(outName, ctx) ?? { kind: 'player_name', nameToken: outName };
  const inTarget: CommandTarget = tryResolvePlayer(inName, ctx) ?? { kind: 'player_name', nameToken: inName };
  return {
    intent: 'player_substitution',
    target: outTarget,
    substitutionInfo: { out: outTarget, in: inTarget },
    rawText: text,
    fragmentIndex,
  };
}

// ─── Parser especial: mudança de formação ───────────────────────────────────

const FORMATION_ALIASES: Record<string, FormationSchemeId> = {
  '4 3 3': '4-3-3',
  '4-3-3': '4-3-3',
  '433': '4-3-3',
  '4 4 2': '4-4-2',
  '4-4-2': '4-4-2',
  '442': '4-4-2',
  '4 2 3 1': '4-2-3-1',
  '4-2-3-1': '4-2-3-1',
  '4231': '4-2-3-1',
  '3 5 2': '3-5-2',
  '3-5-2': '3-5-2',
  '352': '3-5-2',
  '4 5 1': '4-5-1',
  '4-5-1': '4-5-1',
  '451': '4-5-1',
  '5 3 2': '5-3-2',
  '5-3-2': '5-3-2',
  '532': '5-3-2',
  '3 4 3': '3-4-3',
  '3-4-3': '3-4-3',
  '343': '3-4-3',
};

function tryMatchFormation(text: string, fragmentIndex: number): ParsedCommand | null {
  if (!/\b(muda|troca|vamos|passa)\b.*\b(formacao|para|pra|de)?\b/.test(text) && !/\b\d\s*[-\s]\s*\d\s*[-\s]\s*\d\b/.test(text)) {
    return null;
  }
  for (const [alias, scheme] of Object.entries(FORMATION_ALIASES)) {
    // normaliza espaços pra testar ambas variantes
    const altText = text.replace(/\s+/g, ' ').replace(/-/g, ' ');
    const altAlias = alias.replace(/-/g, ' ');
    if (altText.includes(altAlias)) {
      return {
        intent: 'formation_change',
        target: { kind: 'team' },
        formationTarget: scheme,
        rawText: text,
        fragmentIndex,
      };
    }
  }
  return null;
}

// ─── Matcher principal ──────────────────────────────────────────────────────

/**
 * Fallback de palavra-chave curta — cobre "chuta", "drible", "cruza" solto,
 * sem os verbos auxiliares dos patterns regulares. Corre DEPOIS dos patterns
 * pra não atropelar contextos explícitos.
 */
const SHORT_KEYWORDS: Array<{ re: RegExp; intent: VoiceIntent; defaultTarget: CommandTarget }> = [
  { re: /\b(chuta|chute|finaliza|bate|arrisca)\b/, intent: 'take_shot', defaultTarget: { kind: 'ball_carrier' } },
  { re: /\b(drible|dribla|enfia|encara)\b/, intent: 'dribble_attempt', defaultTarget: { kind: 'ball_carrier' } },
  { re: /\b(cruza|cruzamento)\b/, intent: 'cross_ball', defaultTarget: { kind: 'role', role: 'def' } },
  { re: /\b(passa|toca|tabela)\b/, intent: 'pass_to_player', defaultTarget: { kind: 'ball_carrier' } },
  { re: /\b(segura|guarda)\b/, intent: 'hold_ball', defaultTarget: { kind: 'ball_carrier' } },
  { re: /\b(pressao|pressiona|marcacao\s+alta|sufoca)\b/, intent: 'team_press_high', defaultTarget: { kind: 'team' } },
  { re: /\b(recua|recuar|volta|atras|defende)\b/, intent: 'team_retreat', defaultTarget: { kind: 'team' } },
  { re: /\b(acelera|corre|forca|ataca|vai\s+pra\s+cima)\b/, intent: 'pedal_to_metal', defaultTarget: { kind: 'team' } },
  { re: /\b(calma|respira|acalma)\b/, intent: 'calm_team', defaultTarget: { kind: 'team' } },
  { re: /\b(invade|penetra|entra\s+na\s+area)\b/, intent: 'invade_box', defaultTarget: { kind: 'role', role: 'attack' } },
  { re: /\b(marca|marcar|cola|pega)\b/, intent: 'mark_player', defaultTarget: { kind: 'role', role: 'def' } },
  { re: /\b(falta|falta\s+tatica)\b/, intent: 'tactical_foul', defaultTarget: { kind: 'role', role: 'mid' } },
  { re: /\b(posse|mata\s+jogo|mantem\s+a\s+bola)\b/, intent: 'team_hold_possession', defaultTarget: { kind: 'team' } },
  { re: /\b(sobe|linha\s+mais\s+alta)\b/, intent: 'team_high_line', defaultTarget: { kind: 'team' } },
];

function matchFragment(
  fragment: string,
  ctx: MatchRosterContext,
  fragmentIndex: number,
): ParsedCommand | null {
  // Prioridades: substituição → formação → intents regulares → palavra-chave curta.
  const sub = tryMatchSubstitution(fragment, ctx, fragmentIndex);
  if (sub) return sub;

  const form = tryMatchFormation(fragment, fragmentIndex);
  if (form) return form;

  for (const ip of INTENT_PATTERNS) {
    for (const re of ip.patterns) {
      if (re.test(fragment)) {
        const target = resolveTarget(fragment, ctx, ip.defaultTarget);
        return {
          intent: ip.intent,
          target,
          rawText: fragment,
          fragmentIndex,
        };
      }
    }
  }

  for (const kw of SHORT_KEYWORDS) {
    if (kw.re.test(fragment)) {
      const target = resolveTarget(fragment, ctx, kw.defaultTarget);
      return {
        intent: kw.intent,
        target,
        rawText: fragment,
        fragmentIndex,
      };
    }
  }

  // Último recurso: stem dos tokens da frase contra o mapa de stems→intent.
  // Pega conjugações que nem os patterns nem as short keywords cobrem
  // (ex.: "acionou", "acionei", "passando", "chutando").
  const tokensStem = fragment.split(' ').map(stemPt);
  for (const tok of tokensStem) {
    const intent = STEM_INTENT[tok];
    if (intent) {
      const defaultTarget = STEM_DEFAULT_TARGET[intent] ?? { kind: 'ball_carrier' as const };
      const target = resolveTarget(fragment, ctx, defaultTarget);
      return { intent, target, rawText: fragment, fragmentIndex };
    }
  }

  if (typeof console !== 'undefined') {
    console.debug('[voice] fragmento não reconhecido:', { fragment, normalized: fragment, stems: tokensStem });
  }
  return null;
}

/**
 * Stems de verbos-chave → intent. Cobre qualquer conjugação via `stemPt`:
 *   aciona/acionou/acionar/acionando → "acion"
 *   chuta/chutou/chutar/chutando     → "chut"
 */
const STEM_INTENT: Record<string, VoiceIntent> = {
  pass: 'pass_to_player',
  toc: 'pass_to_player',
  acion: 'pass_to_player',
  lanc: 'pass_to_player',
  serv: 'pass_to_player',
  entreg: 'pass_to_player',
  met: 'pass_to_player',
  lig: 'pass_to_player',
  tabel: 'pass_to_player',
  chut: 'take_shot',
  finaliz: 'take_shot',
  arrisc: 'take_shot',
  atir: 'take_shot',
  bat: 'take_shot',
  dribl: 'dribble_attempt',
  enfi: 'dribble_attempt',
  encar: 'dribble_attempt',
  cruz: 'cross_ball',
  levant: 'cross_ball',
  invad: 'invade_box',
  penetr: 'invade_box',
  segur: 'hold_ball',
  guard: 'hold_ball',
  press: 'team_press_high',
  pression: 'team_press_high',
  sufoc: 'team_press_high',
  recu: 'team_retreat',
  volt: 'team_retreat',
  defend: 'team_retreat',
  acel: 'pedal_to_metal',
  acelera: 'pedal_to_metal',
  corr: 'pedal_to_metal',
  forc: 'pedal_to_metal',
  cal: 'calm_team',
  acalm: 'calm_team',
  respir: 'calm_team',
  marc: 'mark_player',
  col: 'mark_player',
  peg: 'mark_player',
  falt: 'tactical_foul',
  poup: 'spare_player',
};

const STEM_DEFAULT_TARGET: Partial<Record<VoiceIntent, CommandTarget>> = {
  pass_to_player: { kind: 'ball_carrier' },
  take_shot: { kind: 'ball_carrier' },
  dribble_attempt: { kind: 'ball_carrier' },
  cross_ball: { kind: 'role', role: 'def' },
  invade_box: { kind: 'role', role: 'attack' },
  hold_ball: { kind: 'ball_carrier' },
  team_press_high: { kind: 'team' },
  team_retreat: { kind: 'team' },
  pedal_to_metal: { kind: 'team' },
  calm_team: { kind: 'team' },
  mark_player: { kind: 'role', role: 'def' },
  tactical_foul: { kind: 'role', role: 'mid' },
  spare_player: { kind: 'ball_carrier' },
};

/**
 * Parser principal. Input: transcript bruto. Output: 0..N comandos parseados.
 */
export function parseVoiceCommand(
  transcript: string,
  ctx: MatchRosterContext,
): ParsedCommand[] {
  if (!transcript || transcript.trim().length === 0) return [];
  const fragments = splitFragments(transcript);
  const out: ParsedCommand[] = [];
  for (let i = 0; i < fragments.length; i++) {
    const parsed = matchFragment(fragments[i]!, ctx, i);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Útil em testes e debug. */
export const __testing = { normalize, fuzzyMatch, splitFragments };

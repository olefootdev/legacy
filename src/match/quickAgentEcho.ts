/**
 * quickAgentEcho.ts — Eco do agente na troca de estilo (Partida Rápida).
 *
 * Filosofia Fable ("roda de expressões" invertida): o manager dá o comando e
 * um agente ESPECÍFICO reage no feed, coerente com a personalidade dele
 * (agentProfile → risco/confiança). O comando deixa de ser um toggle mudo e
 * vira uma conversa com o elenco — profundidade sem UI nova.
 *
 * PURO e determinístico (seed + minuto + estilo) — sem Date/Math.random.
 */

import type { TacticalIntensityLevel } from './quickTacticalIntensity';
import { L } from '@/i18n/L';

export interface AgentEchoTrait {
  /** RiskProfile.baseRisk (0-100) — apetite por risco do agente. */
  risk: number;
  /** LearningState.confidence (0-100) — confiança atual. */
  confidence: number;
}

export interface AgentEchoInput {
  style: TacticalIntensityLevel;
  /** Jogadores em campo (id + nome curto + posição). */
  field: { id: string; name: string; pos: string }[];
  /** Traços por playerId (agentProfile). Sem traço → reação neutra. */
  traits: Record<string, AgentEchoTrait>;
  seed: string;
  minute: number;
}

function hashStr(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** O estilo pede risco alto (attack/press) ou baixo (defend/counter)? */
const STYLE_RISK: Record<TacticalIntensityLevel, number> = {
  attack: 2, press: 1, possession: 0, counter: -1, defend: -2,
};

type Mood = 'embraces' | 'grumbles' | 'steady';

const ECHO_LINES: Record<Mood, Record<'up' | 'down' | 'flat', string[]>> = {
  embraces: {
    up: [L('{name} abraça o comando e acelera o time.', '{name} embraces the call and speeds the team up.'), L('{name} sorri: era isso que ele pedia.', '{name} smiles: just what he wanted.')],
    down: [L('{name} morde o freio, mas cumpre a ordem.', '{name} bites his tongue, but follows orders.'), L('{name} recua reclamando baixinho — quer bola.', '{name} drops back muttering — he wants the ball.')],
    flat: [L('{name} assume a batuta do novo ritmo.', '{name} takes charge of the new tempo.'), L('{name} organiza o time no novo desenho.', '{name} organises the team in the new shape.')],
  },
  grumbles: {
    up: [L('{name} torce o nariz pro sacrifício — mas vai.', '{name} frowns at the sacrifice — but goes.'), L('{name} respira fundo: pressão não é o forte dele.', '{name} takes a deep breath: pressing isn\'t his strength.')],
    down: [L('{name} agradece: agora joga protegido.', '{name} is grateful: now he plays protected.'), L('{name} se encaixa no bloco — confortável.', '{name} slots into the block — comfortable.')],
    flat: [L('{name} segue o plano sem discutir.', '{name} follows the plan without arguing.'), L('{name} acena pro banco: entendido.', '{name} nods to the bench: understood.')],
  },
  steady: {
    up: [L('{name} puxa a linha pra frente sem alarde.', '{name} quietly pushes the line up.'), L('{name} ajusta a marcação pro novo plano.', '{name} adjusts the marking for the new plan.')],
    down: [L('{name} fecha a porta e chama o time.', '{name} shuts the door and rallies the team.'), L('{name} baixa o ritmo com a frieza de sempre.', '{name} slows the tempo with his usual calm.')],
    flat: [L('{name} mantém o time no trilho.', '{name} keeps the team on track.'), L('{name} toca o jogo — profissional.', '{name} keeps it ticking — professional.')],
  },
};

/** Nome curto: apelido entre aspas ou primeiro nome. */
function shortName(name: string): string {
  return name.match(/"([^"]+)"/)?.[1] ?? name.split(/\s+|\s—\s/)[0] ?? name;
}

/**
 * Escolhe UM agente do XI e devolve a reação dele ao estilo — ou null se não
 * há campo. Prioriza quem tem traço forte (muito ousado ou muito cauteloso):
 * é a reação com mais personalidade.
 */
export function buildAgentEcho(input: AgentEchoInput): { playerId: string; text: string } | null {
  const candidates = input.field.filter((p) => p.pos.toUpperCase() !== 'GK' && !p.pos.toUpperCase().includes('GOL'));
  if (!candidates.length) return null;

  // Traço mais extremo = mais personalidade. Empate → seed decide.
  const scored = candidates.map((p) => {
    const t = input.traits[p.id];
    const extremity = t ? Math.abs(t.risk - 50) : 0;
    return { p, t, extremity };
  });
  scored.sort((a, b) => b.extremity - a.extremity);
  const top = scored.slice(0, 3);
  const pick = top[hashStr(`${input.seed}:echo:${input.minute}:${input.style}`) % top.length]!;

  const styleRisk = STYLE_RISK[input.style] ?? 0;
  const risk = pick.t?.risk ?? 50;
  const confidence = pick.t?.confidence ?? 50;
  // Ousado (risk alto) abraça estilos agressivos; cauteloso resmunga neles —
  // e vice-versa nos defensivos. Confiança baixa acentua o resmungo.
  let mood: Mood = 'steady';
  if (styleRisk > 0) mood = risk >= 58 ? 'embraces' : risk <= 42 || confidence <= 40 ? 'grumbles' : 'steady';
  else if (styleRisk < 0) mood = risk <= 42 ? 'embraces' : risk >= 58 ? 'grumbles' : 'steady';

  const dir: 'up' | 'down' | 'flat' = styleRisk > 0 ? 'up' : styleRisk < 0 ? 'down' : 'flat';
  const pool = ECHO_LINES[mood][dir];
  const line = pool[hashStr(`${input.seed}:echoline:${input.minute}:${pick.p.id}`) % pool.length]!;
  return { playerId: pick.p.id, text: line.replace('{name}', shortName(pick.p.name)) };
}

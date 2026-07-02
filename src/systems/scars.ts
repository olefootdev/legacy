/**
 * scars.ts — Cicatrizes de jogador (memória permanente + arco de redenção).
 *
 * Filosofia Fable: dano grave vira cicatriz — o corpo é o diário da aventura.
 * Aqui, momentos extremos da partida marcam o JOGADOR:
 *
 *   • penalty_miss  — errou na disputa de pênaltis → -8 de confiança em
 *     shootouts ATÉ converter uma (aí a cicatriz "cura" e vira medalha).
 *   • clutch_goal_90 — gol aos 85'+ → +5 permanente (herói do minuto final).
 *   • redemption    — converteu carregando a cicatriz → +5 permanente.
 *
 * Máximo 2 cicatrizes por jogador (a mais nova substitui a mais antiga não
 * curada). Arco narrativo automático: zero conteúdo manual.
 *
 * PURO — sem Date/Math.random.
 */

export type ScarKind = 'penalty_miss' | 'clutch_goal_90' | 'redemption';

export interface PlayerScar {
  kind: ScarKind;
  /** Rótulo do jogo que marcou ("vs Fúria FC — Semifinal"). */
  matchLabel: string;
  /** Cicatriz de pênalti curada (virou medalha de redenção)? */
  healed?: boolean;
  atMs: number;
}

export type PlayerScarsMap = Record<string, PlayerScar[]>;

const MAX_SCARS = 2;

/** Delta de confiança do jogador NUMA DISPUTA DE PÊNALTIS pelas cicatrizes. */
export function scarShootoutConfidenceDelta(scars: PlayerScar[] | undefined): number {
  if (!scars?.length) return 0;
  return scars.reduce((s, sc) => {
    if (sc.kind === 'penalty_miss' && !sc.healed) return s - 8;
    if (sc.kind === 'clutch_goal_90' || sc.kind === 'redemption') return s + 5;
    return s;
  }, 0);
}

function pushScar(list: PlayerScar[], scar: PlayerScar): PlayerScar[] {
  // Não duplica o mesmo tipo não-curado; a mais nova substitui a mais antiga.
  const kept = list.filter((s) => !(s.kind === scar.kind && !s.healed));
  return [...kept, scar].slice(-MAX_SCARS);
}

export interface QuickScarInputs {
  /** Cobranças da CASA na disputa (ordem real). */
  shootoutKicks?: { kickerId: string; scored: boolean }[];
  /** Autores de gol da casa aos 85'+ no tempo normal. */
  lateHeroIds?: string[];
  matchLabel: string;
  atMs: number;
}

export interface ScarNarrative {
  playerId: string;
  kind: ScarKind | 'healed';
  text: string;
}

/**
 * Aplica os momentos extremos de UMA partida ao mapa de cicatrizes.
 * Regras: errou pênalti → cicatriz; converteu CARREGANDO cicatriz → cura +
 * medalha de redenção; gol 85'+ → medalha de clutch.
 * Retorna o mapa novo + narrativas (pro inbox/pós-jogo contar a história).
 */
export function applyQuickScars(
  map: PlayerScarsMap | undefined,
  input: QuickScarInputs,
  nameOf: (playerId: string) => string,
): { map: PlayerScarsMap; narratives: ScarNarrative[] } {
  const out: PlayerScarsMap = { ...(map ?? {}) };
  const narratives: ScarNarrative[] = [];

  for (const kick of input.shootoutKicks ?? []) {
    const cur = out[kick.kickerId] ?? [];
    const openScar = cur.find((s) => s.kind === 'penalty_miss' && !s.healed);
    if (kick.scored && openScar) {
      // REDENÇÃO: a cicatriz VIRA a medalha (substitui, não acumula slot).
      const withoutScar = cur.filter((s) => s !== openScar);
      out[kick.kickerId] = pushScar(withoutScar, { kind: 'redemption', matchLabel: input.matchLabel, atMs: input.atMs });
      narratives.push({
        playerId: kick.kickerId,
        kind: 'healed',
        text: `Redenção: ${nameOf(kick.kickerId)} carregava o pênalti perdido (${openScar.matchLabel}) — e converteu. Conta acertada com a história.`,
      });
    } else if (!kick.scored) {
      out[kick.kickerId] = pushScar(cur, { kind: 'penalty_miss', matchLabel: input.matchLabel, atMs: input.atMs });
      narratives.push({
        playerId: kick.kickerId,
        kind: 'penalty_miss',
        text: `Cicatriz: ${nameOf(kick.kickerId)} perdeu o pênalti (${input.matchLabel}). Só uma conversão cura essa marca.`,
      });
    }
  }

  for (const heroId of input.lateHeroIds ?? []) {
    const cur = out[heroId] ?? [];
    if (cur.some((s) => s.kind === 'clutch_goal_90')) continue; // medalha única
    out[heroId] = pushScar(cur, { kind: 'clutch_goal_90', matchLabel: input.matchLabel, atMs: input.atMs });
    narratives.push({
      playerId: heroId,
      kind: 'clutch_goal_90',
      text: `Medalha: ${nameOf(heroId)} decidiu aos 85'+ (${input.matchLabel}). O herói do minuto final pede a bola.`,
    });
  }

  return { map: out, narratives };
}

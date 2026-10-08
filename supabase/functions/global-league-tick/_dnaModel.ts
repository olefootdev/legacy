/**
 * DNA DO CLUBE na Liga Global (Fase 0 da "Fundação do Clube", 2026-10-07).
 *
 * A liga não roda o Quick Plan (Python) — o placar sai de um λ de Poisson por
 * setor. Este módulo leva o MESMO DNA (7 eixos 0–1, vindo no `lineup_snapshot`
 * que o cliente sincroniza) pra esse λ e pros cartões, com as mesmas regras do
 * `match_simulator.py`:
 *   · ORÇAMENTO: média dos eixos = 0.5 (especializar custa; tudo alto = neutro);
 *   · GANHO 1.5 sobre a forma comprimida que o cliente manda;
 *   · sem DNA, todo multiplicador é exatamente 1 (placar idêntico ao de antes).
 *
 * Sem imports: o arquivo roda no Deno (Edge) e no Node (teste de calibração,
 * `npm run test:liga-dna`).
 */

export const DNA_EIXOS = ['posse', 'pressao', 'vertical', 'criatividade', 'solidez', 'disciplina', 'intensidade'] as const;
export type EixoDna = (typeof DNA_EIXOS)[number];
export type Dna = Record<EixoDna, number>;

export const DNA_GANHO = 1.5;

/** Lê, prende em 0–1 e centra (orçamento). null = time sem DNA (neutro). */
export function readDna(raw: unknown): Dna | null {
  if (!raw || typeof raw !== 'object') return null;
  const vals = {} as Dna;
  for (const k of DNA_EIXOS) {
    const v = Number((raw as Record<string, unknown>)[k]);
    vals[k] = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5;
  }
  const media = DNA_EIXOS.reduce((s, k) => s + vals[k], 0) / DNA_EIXOS.length;
  const out = {} as Dna;
  for (const k of DNA_EIXOS) out[k] = Math.max(0.12, Math.min(0.88, 0.5 + (vals[k] - media) * DNA_GANHO));
  return out;
}

/** Desvio do neutro: -0.5 … +0.5 (0 sem DNA). */
export function dz(dna: Dna | null, k: EixoDna): number {
  return dna ? dna[k] - 0.5 : 0;
}

/**
 * Quanto o time CRIA (multiplica o próprio λ). Espelha o Python: vertical e
 * intensidade finalizam mais, criação e posse trabalham chance melhor, e o
 * time sólido que abre mão da bola vive de contra-ataque.
 */
function ataque(d: Dna | null): number {
  const contra = Math.max(0, dz(d, 'solidez') - dz(d, 'posse'));
  return 1 + dz(d, 'vertical') * 0.2 + dz(d, 'criatividade') * 0.1 + dz(d, 'intensidade') * 0.08
    + dz(d, 'posse') * 0.04 + contra * 0.1;
}

/** Quanto o time CONCEDE (multiplica o λ do adversário). */
function concede(d: Dna | null): number {
  return 1 - dz(d, 'solidez') * 0.22 - dz(d, 'posse') * 0.06 + dz(d, 'pressao') * 0.03;
}

/** Multiplicadores de λ dos dois lados. Sem DNA nenhum: { home: 1, away: 1 }. */
export function dnaLambdaMults(home: Dna | null, away: Dna | null): { home: number; away: number } {
  return {
    home: Math.max(0.6, ataque(home) * concede(away)),
    away: Math.max(0.6, ataque(away) * concede(home)),
  };
}

/** Faltas/cartões: disciplina limpa, pressão alta derruba mais. */
export function dnaCardMult(d: Dna | null): { yellow: number; red: number } {
  return {
    yellow: Math.max(0.3, 1 - dz(d, 'disciplina') * 1.2 + dz(d, 'pressao') * 0.4),
    red: Math.max(0.3, 1 - dz(d, 'disciplina') * 0.8),
  };
}

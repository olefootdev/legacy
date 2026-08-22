/**
 * /src/motor/archetypeWeights.ts — ARQUÉTIPO COMO PESO DE DECISÃO
 *
 * Traduz os 54 arquétipos táticos de `@/tactical/archetypesCatalog` em
 * multiplicadores sobre o valor de cada ação. É o coração da proposta das
 * lendas: é aqui que um Enganche joga diferente de um Camisa 9 de área com os
 * mesmos atributos.
 *
 * ── A regra que não se quebra ─────────────────────────────────────────────────
 *
 * O arquétipo NÃO trava coordenada. Ele altera o que o jogador VALORIZA.
 *
 * Por isso os campos `attackZones`, `defenseZones`, `allowedZones` e
 * `forbiddenZones` do catálogo são deliberadamente ignorados aqui. Prender o
 * jogador a uma zona foi exatamente o erro do motor antigo: `returnBias` de
 * 0,68 a 0,97 mais três grampos de zona, que deixaram o bloco incapaz de
 * acompanhar a bola (correlação medida: 0,05). Um ponta que "cai por dentro"
 * não é um ponta proibido de ficar na linha — é um ponta que dá mais valor ao
 * espaço interior quando ele existe.
 *
 * O que se usa: `profile` (discipline, aggression, creativity, risk) e
 * `intentions` — as 49 intenções semânticas que o catálogo já descreve.
 *
 * ── Onde os pesos entram ─────────────────────────────────────────────────────
 * Todos multiplicam valores que já estão em GOLS ESPERADOS no MotorEngine, o
 * que mantém a comparação entre passar, conduzir e finalizar na mesma moeda.
 */
import { ARCHETYPE_BY_ID, type ArchetypeId, type PlayerArchetype } from '@/tactical';

export interface DecisionWeights {
  /** Multiplicador no valor de um passe. */
  pass: number;
  /** Bônus adicional quando o passe ganha profundidade. */
  passForward: number;
  /** Multiplicador na condução com a bola. */
  carry: number;
  /** Multiplicador na finalização. */
  shoot: number;
  /** Quanto valoriza correr em profundidade, nas costas da linha. */
  runDepth: number;
  /** Quanto valoriza abrir e buscar largura. */
  runWide: number;
  /** Quanto vale simplesmente não perder a bola. */
  retention: number;
  /** Disposição a sair da forma para pressionar. */
  press: number;
  /**
   * Tolerância a passe de baixa chance. Acima de 1, o jogador aceita jogadas
   * que provavelmente não dão certo — o passe do meia genial que erra oito e
   * decide o jogo no nono.
   */
  risk: number;
}

export const NEUTRAL_WEIGHTS: DecisionWeights = {
  pass: 1, passForward: 1, carry: 1, shoot: 1,
  runDepth: 1, runWide: 1, retention: 1, press: 1, risk: 1,
};

/** Deltas por intenção. Somam sobre a base vinda do `profile`. */
const INTENTION_DELTAS: Partial<Record<string, Partial<DecisionWeights>>> = {
  // ── Construção e criação ────────────────────────────────────────────────
  build_from_back:      { pass: 0.12, retention: 0.25, carry: -0.10 },
  orchestrate_buildup:  { pass: 0.18, retention: 0.22, passForward: 0.10 },
  dictate_tempo:        { pass: 0.16, retention: 0.28 },
  set_tempo:            { pass: 0.12, retention: 0.22 },
  create_chances:       { pass: 0.20, passForward: 0.30, risk: 0.20 },
  progress_ball:        { passForward: 0.28, carry: 0.15 },
  link_play:            { pass: 0.15, retention: 0.15 },
  short_support:        { pass: 0.10, retention: 0.20 },
  offer_pass_option:    { pass: 0.08, retention: 0.15 },
  switch_flanks:        { passForward: 0.10, runWide: 0.20 },
  link_defense_attack:  { pass: 0.12, passForward: 0.12 },

  // ── Condução e drible ───────────────────────────────────────────────────
  carry_ball_forward:   { carry: 0.35, passForward: 0.08 },
  box_to_box:           { carry: 0.15, runDepth: 0.15 },
  rotate_position:      { runWide: 0.12, runDepth: 0.10 },
  drift_zones:          { runWide: 0.15, runDepth: 0.10 },
  free_roam:            { runDepth: 0.18, runWide: 0.18, risk: 0.15 },

  // ── Profundidade ────────────────────────────────────────────────────────
  run_in_behind:        { runDepth: 0.40, risk: 0.15 },
  ghost_run:            { runDepth: 0.30 },
  half_space_run:       { runDepth: 0.25 },
  channel_run:          { runDepth: 0.28 },
  underlap_run:         { runDepth: 0.22 },
  exploit_space:        { runDepth: 0.22, risk: 0.10 },
  shadow_striker:       { runDepth: 0.28, shoot: 0.18 },
  overlap_attack:       { runWide: 0.30, runDepth: 0.15 },

  // ── Largura ─────────────────────────────────────────────────────────────
  hug_touchline:        { runWide: 0.40 },
  hold_width_defense:   { runWide: 0.22 },
  combine_wide:         { runWide: 0.25, pass: 0.10 },
  deliver_cross:        { runWide: 0.28, passForward: 0.18 },
  connect_wide_attack:  { runWide: 0.20, pass: 0.10 },
  cut_inside:           { runWide: -0.20, shoot: 0.25, carry: 0.15 },
  support_inside:       { runWide: -0.15, pass: 0.12 },
  invert_midfield:      { runWide: -0.22, pass: 0.15, retention: 0.12 },

  // ── Finalização ─────────────────────────────────────────────────────────
  finish_chances:       { shoot: 0.40, runDepth: 0.15 },
  hold_up_play:         { retention: 0.35, carry: -0.15, runDepth: -0.15 },
  drop_deep:            { pass: 0.15, retention: 0.18, runDepth: -0.20 },

  // ── Defensivo ───────────────────────────────────────────────────────────
  press_high:           { press: 0.35 },
  trigger_press:        { press: 0.30 },
  press_defenders:      { press: 0.35 },
  step_out_press:       { press: 0.25 },
  man_mark:             { press: 0.20 },
  break_up_play:        { press: 0.25 },
  recovery_run:         { press: 0.15 },
  cover_space:          { press: -0.10, retention: 0.10 },
  close_spaces:         { press: -0.08 },
  screen_defense:       { press: -0.12, retention: 0.15, carry: -0.15 },
  anchor_midfield:      { retention: 0.25, carry: -0.20, runDepth: -0.25 },
  organize_defense:     { retention: 0.15, runDepth: -0.20 },
  hold_position:        { runDepth: -0.25, runWide: -0.15, retention: 0.12 },
  sweep_behind:         { press: 0.12 },
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Pesos de decisão de um arquétipo.
 *
 * A base sai do `profile` e as intenções ajustam por cima. Depois tudo é
 * limitado a uma faixa sã: um arquétipo tempera o jogador, não o transforma em
 * outra coisa. Sem esse limite, um `ST_POACHER` com três intenções de
 * finalização acabaria batendo de qualquer lugar do campo.
 */
export function weightsFor(archetype: PlayerArchetype): DecisionWeights {
  const { discipline, aggression, creativity, risk } = archetype.profile;
  // 0–100 → desvio em torno de 1, no máximo ±0,30.
  const dev = (v: number) => ((v - 50) / 50) * 0.30;

  const w: DecisionWeights = {
    pass: 1 + dev(creativity) * 0.7,
    passForward: 1 + dev(creativity) * 0.6 + dev(risk) * 0.6,
    carry: 1 + dev(creativity) * 0.4 - dev(discipline) * 0.5,
    shoot: 1 + dev(aggression) * 0.5,
    runDepth: 1 + dev(risk) * 0.7 - dev(discipline) * 0.6,
    runWide: 1,
    retention: 1 + dev(discipline) * 0.8 - dev(risk) * 0.5,
    press: 1 + dev(aggression) * 0.9,
    risk: 1 + dev(risk) * 0.8,
  };

  for (const intention of archetype.intentions) {
    const delta = INTENTION_DELTAS[intention];
    if (!delta) continue;
    for (const [k, v] of Object.entries(delta)) {
      w[k as keyof DecisionWeights] += v as number;
    }
  }

  return {
    pass: clamp(w.pass, 0.65, 1.55),
    passForward: clamp(w.passForward, 0.60, 1.70),
    carry: clamp(w.carry, 0.55, 1.60),
    shoot: clamp(w.shoot, 0.55, 1.75),
    runDepth: clamp(w.runDepth, 0.50, 1.80),
    runWide: clamp(w.runWide, 0.55, 1.70),
    retention: clamp(w.retention, 0.65, 1.65),
    press: clamp(w.press, 0.60, 1.70),
    risk: clamp(w.risk, 0.70, 1.55),
  };
}

/**
 * Resolve o arquétipo por id, com FALHA RUIDOSA.
 *
 * No motor antigo este campo nunca era atribuído por ninguém, e a leitura
 * ficava dentro de um `try/catch` que engolia o erro: 35 KB de design tático
 * jamais executaram uma linha, em nenhuma partida, sem que nada avisasse.
 * Aqui um id ausente ou desconhecido é erro, não silêncio.
 */
export function resolveArchetype(id: string | undefined, playerId: string): PlayerArchetype {
  if (!id) {
    throw new Error(
      `[motor] jogador "${playerId}" sem tacticalArchetypeId. ` +
      `O arquétipo é obrigatório: é ele que define o estilo do jogador. ` +
      `Use um dos ${Object.keys(ARCHETYPE_BY_ID).length} ids de @/tactical/archetypesCatalog.`,
    );
  }
  const found = ARCHETYPE_BY_ID[id as ArchetypeId];
  if (!found) {
    throw new Error(
      `[motor] jogador "${playerId}" com tacticalArchetypeId desconhecido: "${id}".`,
    );
  }
  return found;
}

/**
 * Arquétipo padrão por slot — o time "sem estilo declarado".
 *
 * Serve de ponto de partida para testes e para elencos que ainda não
 * escolheram. Não é fallback silencioso: quem não passa `tacticalArchetypeId`
 * continua tomando erro. Isto é uma escolha explícita de quem chama.
 */
export function defaultArchetypeForSlot(slotId: string): ArchetypeId {
  const s = slotId.toLowerCase();
  if (s === 'gol') return 'GK_CLASSIC';
  if (s.startsWith('zag')) return 'CB_DEFENDER';
  if (s === 'le' || s === 'ld') return 'FB_CONSERVATIVE';
  if (s === 'vol') return 'DM_ANCHOR';
  if (s.startsWith('mc')) return 'CM_BOX_TO_BOX';
  if (s === 'pe' || s === 'pd') return 'WINGER_CLASSIC';
  if (s === 'ata') return 'ST_FINISHER';
  return 'CM_BOX_TO_BOX';
}

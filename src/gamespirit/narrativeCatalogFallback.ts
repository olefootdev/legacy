/**
 * Fallback hardcoded — 3–5 templates por categoria.
 *
 * Garante que o jogo NUNCA fica sem narração, mesmo se:
 *   - Supabase offline
 *   - Catálogo ainda não foi gerado
 *   - Browser sem rede
 *
 * Substituído em runtime pelo catálogo Supabase quando hidratado.
 */

import type { NarrativeTemplate } from './narrativeCatalog';

export const FALLBACK_CATALOG: NarrativeTemplate[] = [
  // ── Gol ───────────────────────────────────────────────
  { id: 'fb-goal-1', category: 'goal', intensity: 'normal',
    template: '{minute}\' — {player} aparece na área e marca.',
    variables: {}, persona_vibe: 'casual', context_tags: [] },
  { id: 'fb-goal-2', category: 'goal', intensity: 'normal',
    template: '{minute}\' — Gol de {player}. Vantagem.',
    variables: {}, persona_vibe: 'analytical', context_tags: [] },
  { id: 'fb-goal-3', category: 'goal', intensity: 'world_class',
    template: '{minute}\' — {player} encaixa um remate seco, sem chance pro goleiro.',
    variables: {}, persona_vibe: 'visceral', context_tags: [] },
  { id: 'fb-goal-4', category: 'goal', intensity: 'late',
    template: '{minute}\' — {player} decide no fim. Gol decisivo.',
    variables: {}, persona_vibe: 'visceral', context_tags: ['last_15_min'] },
  { id: 'fb-goal-5', category: 'goal', intensity: 'comeback',
    template: '{minute}\' — {player} vira o jogo. Que reação.',
    variables: {}, persona_vibe: 'poetic', context_tags: ['comeback'] },

  // ── Finalização ───────────────────────────────────────
  { id: 'fb-ss-1', category: 'shot_saved', intensity: 'routine',
    template: '{minute}\' — Chute travado. Segue o jogo.',
    variables: {}, persona_vibe: 'casual', context_tags: [] },
  { id: 'fb-ss-2', category: 'shot_saved', intensity: 'good',
    template: '{minute}\' — {player} obriga defesa firme do goleiro.',
    variables: {}, persona_vibe: 'analytical', context_tags: [] },
  { id: 'fb-ss-3', category: 'shot_saved', intensity: 'world_class',
    template: '{minute}\' — Defesa espetacular. {player} não entende.',
    variables: {}, persona_vibe: 'visceral', context_tags: [] },
  { id: 'fb-sm-1', category: 'shot_missed', intensity: 'close',
    template: '{minute}\' — {player} passou raspando. Quase lá.',
    variables: {}, persona_vibe: 'casual', context_tags: [] },
  { id: 'fb-sm-2', category: 'shot_missed', intensity: 'wild',
    template: '{minute}\' — {player} mandou na arquibancada.',
    variables: {}, persona_vibe: 'casual', context_tags: [] },

  // ── Faltas ────────────────────────────────────────────
  { id: 'fb-fy-1', category: 'foul_yellow', intensity: 'tactical',
    template: '{minute}\' — Amarelo em {player}. Falta tática.',
    variables: {}, persona_vibe: 'analytical', context_tags: [] },
  { id: 'fb-fy-2', category: 'foul_yellow', intensity: 'rash',
    template: '{minute}\' — {player} exagerou na dividida. Cartão amarelo.',
    variables: {}, persona_vibe: 'casual', context_tags: [] },
  { id: 'fb-fr-1', category: 'foul_red', intensity: 'dangerous',
    template: '{minute}\' — Vermelho direto pra {player}. Entrada violenta.',
    variables: {}, persona_vibe: 'visceral', context_tags: [] },
  { id: 'fb-fr-2', category: 'foul_red', intensity: 'second_yellow',
    template: '{minute}\' — Segundo amarelo. {player} deixa o time.',
    variables: {}, persona_vibe: 'analytical', context_tags: [] },

  // ── Substituição ──────────────────────────────────────
  { id: 'fb-sub-1', category: 'substitution', intensity: 'fresh_legs',
    template: '{minute}\' — Pernas novas: entra {player}.',
    variables: {}, persona_vibe: 'casual', context_tags: [] },
  { id: 'fb-sub-2', category: 'substitution', intensity: 'tactical',
    template: '{minute}\' — Leitura tática: {player} entra.',
    variables: {}, persona_vibe: 'analytical', context_tags: [] },

  // ── Momento / pressão ─────────────────────────────────
  { id: 'fb-ms-1', category: 'momentum_shift', intensity: 'home_rising',
    template: '{minute}\' — A casa acorda. Pressão crescente.',
    variables: {}, persona_vibe: 'poetic', context_tags: [] },
  { id: 'fb-ms-2', category: 'momentum_shift', intensity: 'away_rising',
    template: '{minute}\' — O visitante toma conta do jogo.',
    variables: {}, persona_vibe: 'analytical', context_tags: [] },
  { id: 'fb-pm-1', category: 'pressure_moment', intensity: 'last_5_min',
    template: '{minute}\' — Últimos minutos. Decisão no ar.',
    variables: {}, persona_vibe: 'visceral', context_tags: ['last_5_min'] },

  // ── Tempo de jogo ────────────────────────────────────
  { id: 'fb-ht-1', category: 'half_time', intensity: 'winning',
    template: 'Intervalo. Time em vantagem, merece.',
    variables: {}, persona_vibe: 'casual', context_tags: [] },
  { id: 'fb-ht-2', category: 'half_time', intensity: 'losing',
    template: 'Intervalo. Precisa acordar no segundo tempo.',
    variables: {}, persona_vibe: 'analytical', context_tags: [] },
  { id: 'fb-ht-3', category: 'half_time', intensity: 'drawing',
    template: 'Intervalo. Jogo aberto, decidido no retorno.',
    variables: {}, persona_vibe: 'casual', context_tags: [] },
  { id: 'fb-ft-1', category: 'full_time', intensity: 'thriller',
    template: 'Fim de jogo. Que partida.',
    variables: {}, persona_vibe: 'visceral', context_tags: [] },
  { id: 'fb-ft-2', category: 'full_time', intensity: 'goalless',
    template: 'Fim de jogo. Empate sem gols.',
    variables: {}, persona_vibe: 'casual', context_tags: [] },
  { id: 'fb-ft-3', category: 'full_time', intensity: 'rout',
    template: 'Fim de jogo. Placar elástico.',
    variables: {}, persona_vibe: 'analytical', context_tags: [] },
];

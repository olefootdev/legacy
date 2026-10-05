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
import { L } from '@/i18n/L';

export const FALLBACK_CATALOG: NarrativeTemplate[] = [
  // ── Gol ───────────────────────────────────────────────
  { id: 'fb-goal-1', category: 'goal', intensity: 'normal',
    template: L('{minute}\' — {player} aparece na área e marca.', "{minute}' — {player} arrives in the box and scores."),
    variables: {}, persona_vibe: 'casual', context_tags: [] },
  { id: 'fb-goal-2', category: 'goal', intensity: 'normal',
    template: L('{minute}\' — Gol de {player}. Vantagem.', "{minute}' — {player} scores. In front."),
    variables: {}, persona_vibe: 'analytical', context_tags: [] },
  { id: 'fb-goal-3', category: 'goal', intensity: 'world_class',
    template: L('{minute}\' — {player} encaixa um remate seco, sem chance pro goleiro.', "{minute}' — {player} drills it low, the keeper had no chance."),
    variables: {}, persona_vibe: 'visceral', context_tags: [] },
  { id: 'fb-goal-4', category: 'goal', intensity: 'late',
    template: L('{minute}\' — {player} decide no fim. Gol decisivo.', "{minute}' — {player} settles it late. A decisive goal."),
    variables: {}, persona_vibe: 'visceral', context_tags: ['last_15_min'] },
  { id: 'fb-goal-5', category: 'goal', intensity: 'comeback',
    template: L('{minute}\' — {player} vira o jogo. Que reação.', "{minute}' — {player} turns it around. What a response."),
    variables: {}, persona_vibe: 'poetic', context_tags: ['comeback'] },

  // ── Finalização ───────────────────────────────────────
  { id: 'fb-ss-1', category: 'shot_saved', intensity: 'routine',
    template: L('{minute}\' — Chute travado. Segue o jogo.', "{minute}' — Shot blocked. Play on."),
    variables: {}, persona_vibe: 'casual', context_tags: [] },
  { id: 'fb-ss-2', category: 'shot_saved', intensity: 'good',
    template: L('{minute}\' — {player} obriga defesa firme do goleiro.', "{minute}' — {player} forces a firm save from the keeper."),
    variables: {}, persona_vibe: 'analytical', context_tags: [] },
  { id: 'fb-ss-3', category: 'shot_saved', intensity: 'world_class',
    template: L('{minute}\' — Defesa espetacular. {player} não entende.', "{minute}' — Spectacular save. {player} can't believe it."),
    variables: {}, persona_vibe: 'visceral', context_tags: [] },
  { id: 'fb-sm-1', category: 'shot_missed', intensity: 'close',
    template: L('{minute}\' — {player} passou raspando. Quase lá.', "{minute}' — {player} just wide. So close."),
    variables: {}, persona_vibe: 'casual', context_tags: [] },
  { id: 'fb-sm-2', category: 'shot_missed', intensity: 'wild',
    template: L('{minute}\' — {player} mandou na arquibancada.', "{minute}' — {player} puts it into the stands."),
    variables: {}, persona_vibe: 'casual', context_tags: [] },

  // ── Faltas ────────────────────────────────────────────
  { id: 'fb-fy-1', category: 'foul_yellow', intensity: 'tactical',
    template: L('{minute}\' — Amarelo em {player}. Falta tática.', "{minute}' — Yellow for {player}. Tactical foul."),
    variables: {}, persona_vibe: 'analytical', context_tags: [] },
  { id: 'fb-fy-2', category: 'foul_yellow', intensity: 'rash',
    template: L('{minute}\' — {player} exagerou na dividida. Cartão amarelo.', "{minute}' — {player} mistimes the challenge. Yellow card."),
    variables: {}, persona_vibe: 'casual', context_tags: [] },
  { id: 'fb-fr-1', category: 'foul_red', intensity: 'dangerous',
    template: L('{minute}\' — Vermelho direto pra {player}. Entrada violenta.', "{minute}' — Straight red for {player}. A violent challenge."),
    variables: {}, persona_vibe: 'visceral', context_tags: [] },
  { id: 'fb-fr-2', category: 'foul_red', intensity: 'second_yellow',
    template: L('{minute}\' — Segundo amarelo. {player} deixa o time.', "{minute}' — Second yellow. {player} is off."),
    variables: {}, persona_vibe: 'analytical', context_tags: [] },

  // ── Substituição ──────────────────────────────────────
  { id: 'fb-sub-1', category: 'substitution', intensity: 'fresh_legs',
    template: L('{minute}\' — Pernas novas: entra {player}.', "{minute}' — Fresh legs: {player} comes on."),
    variables: {}, persona_vibe: 'casual', context_tags: [] },
  { id: 'fb-sub-2', category: 'substitution', intensity: 'tactical',
    template: L('{minute}\' — Leitura tática: {player} entra.', "{minute}' — Tactical switch: {player} on."),
    variables: {}, persona_vibe: 'analytical', context_tags: [] },

  // ── Momento / pressão ─────────────────────────────────
  { id: 'fb-ms-1', category: 'momentum_shift', intensity: 'home_rising',
    template: L('{minute}\' — A casa acorda. Pressão crescente.', "{minute}' — The home side wake up. Pressure building."),
    variables: {}, persona_vibe: 'poetic', context_tags: [] },
  { id: 'fb-ms-2', category: 'momentum_shift', intensity: 'away_rising',
    template: L('{minute}\' — O visitante toma conta do jogo.', "{minute}' — The visitors take control."),
    variables: {}, persona_vibe: 'analytical', context_tags: [] },
  { id: 'fb-pm-1', category: 'pressure_moment', intensity: 'last_5_min',
    template: L('{minute}\' — Últimos minutos. Decisão no ar.', "{minute}' — Final minutes. It's all to play for."),
    variables: {}, persona_vibe: 'visceral', context_tags: ['last_5_min'] },

  // ── Tempo de jogo ────────────────────────────────────
  { id: 'fb-ht-1', category: 'half_time', intensity: 'winning',
    template: L('Intervalo. Time em vantagem, merece.', 'Half-time. In front, and deservedly so.'),
    variables: {}, persona_vibe: 'casual', context_tags: [] },
  { id: 'fb-ht-2', category: 'half_time', intensity: 'losing',
    template: L('Intervalo. Precisa acordar no segundo tempo.', 'Half-time. Need to wake up after the break.'),
    variables: {}, persona_vibe: 'analytical', context_tags: [] },
  { id: 'fb-ht-3', category: 'half_time', intensity: 'drawing',
    template: L('Intervalo. Jogo aberto, decidido no retorno.', 'Half-time. Wide open, to be settled in the second half.'),
    variables: {}, persona_vibe: 'casual', context_tags: [] },
  { id: 'fb-ft-1', category: 'full_time', intensity: 'thriller',
    template: L('Fim de jogo. Que partida.', 'Full time. What a match.'),
    variables: {}, persona_vibe: 'visceral', context_tags: [] },
  { id: 'fb-ft-2', category: 'full_time', intensity: 'goalless',
    template: L('Fim de jogo. Empate sem gols.', 'Full time. Goalless draw.'),
    variables: {}, persona_vibe: 'casual', context_tags: [] },
  { id: 'fb-ft-3', category: 'full_time', intensity: 'rout',
    template: L('Fim de jogo. Placar elástico.', 'Full time. A one-sided scoreline.'),
    variables: {}, persona_vibe: 'analytical', context_tags: [] },
];

/**
 * Mapa do ecossistema GameSpirit — usado pelo painel Admin e para copy-paste em specs / integrações.
 * Mantém alinhado com `src/gamespirit/*` e docs em `docs/`.
 */

import { TacticalIntent } from '@/gamespirit/storyContracts';

export const GAME_SPIRIT_VERSION_TAG = '2026-04 — OLEFOOT';

/** Intenções táticas (comandos / narração / pesos do roteiro). */
export const TACTICAL_INTENT_VALUES = Object.values(TacticalIntent);

/** Tipos de beat no roteiro ao vivo (`storyContracts.BeatKind`). */
export const BEAT_KIND_VALUES = [
  'shape',
  'press',
  'chance_home',
  'chance_away',
  'set_piece_home',
  'set_piece_away',
  'card_risk_home',
  'card_risk_away',
  'narrative',
  'play_dribble',
  'play_cross',
  'play_long_shot',
  'foul_home',
  'foul_away',
] as const;

/** Fases lógicas partida rápida (`spiritSnapshotTypes.SpiritPhase`). */
export const SPIRIT_PHASE_VALUES = [
  'open_play',
  'shot_resolve',
  'buildup_gk',
  'set_piece',
  'penalty',
  'celebration_goal',
] as const;

/** Ações discretas escolhidas pelo motor quick (`types.ProposedAction`). */
export const PROPOSED_ACTION_VALUES = ['recycle', 'progress', 'shot', 'press', 'clear', 'counter'] as const;

/** Blocos de linhas em `storyNarrativeCatalog.ts` (narrativa espectáculo / transmissão). */
export const NARRATIVE_CATALOG_BLOCKS = [
  { name: 'DRIBBLE_LINES', role: 'Drible / espetáculo' },
  { name: 'CROSS_LINES', role: 'Cruzamentos' },
  { name: 'LONG_SHOT_LINES', role: 'Remate de longe' },
  { name: 'LONG_SHOT_FOLLOW_SAVE', role: 'Seguimento defesa' },
  { name: 'LONG_SHOT_FOLLOW_WIDE', role: 'Seguimento fora' },
  { name: 'FOUL_LINES', role: 'Faltas (genérico)' },
  { name: 'FOUL_HOME_LINES', role: 'Falta casa → perigo visitante' },
  { name: 'FOUL_AWAY_LINES', role: 'Falta visitante → perigo casa' },
  { name: 'FREE_KICK_WALL_LINES', role: 'Livre / barreira' },
  { name: 'PRESS_LINES', role: 'Pressing' },
  { name: 'SHAPE_LINES', role: 'Bloco / formação' },
  { name: 'BUILD_UP_LINES', role: 'Construção / posse' },
  { name: 'CHANCE_HOME_SAVE_EXTRA', role: 'GR casa nega' },
  { name: 'CHANCE_AWAY_BLOCK', role: 'Defesa corta visitante' },
] as const;

export type GameSpiritSectionId =
  | 'overview'
  | 'quick'
  | 'live'
  | 'narration'
  | 'coach'
  | 'prematch'
  | 'rules'
  | 'pipeline'
  | 'admin';

export interface GameSpiritModuleEntry {
  file: string;
  title: string;
  blurb: string;
}

export interface GameSpiritSection {
  id: GameSpiritSectionId;
  title: string;
  lead: string;
  modules: GameSpiritModuleEntry[];
}

export const GAME_SPIRIT_SECTIONS: GameSpiritSection[] = [
  {
    id: 'overview',
    title: 'Visão geral',
    lead:
      'GameSpirit é a camada de decisão e narrativa do OLEFOOT: no modo quick governa posse, bola, fases, overlays e penáltis; no ao vivo (roteiro) gera beats e textos sem vazar resultado no pré-jogo. Integra com o log causal, Redux e (em 3D) apenas consome snapshots.',
    modules: [
      {
        file: 'src/gamespirit/types.ts',
        title: 'Contratos do tick quick',
        blurb: 'SpiritContext, ProposedAction, SpiritOutcome, SpiritSnapshotMeta — ligação ao motor e eventos causais.',
      },
      {
        file: 'src/engine/types.ts',
        title: 'Tipos do engine',
        blurb: 'Importa contratos GameSpirit (penálti, overlay, spiritPhase) no snapshot de partida.',
      },
      {
        file: 'docs/MATCH_CAUSAL_PIPELINE.md',
        title: 'Pipeline causal',
        blurb: 'Ordem: GameSpirit → log append-only → snapshot → UI.',
      },
    ],
  },
  {
    id: 'quick',
    title: 'Motor minuto a minuto (quick)',
    lead:
      'gameSpiritTick consome contexto tático (estilo de jogo, mentalidade, zonas) e devolve narrativa + patches de posse/bola + meta (fase, overlay, penálti). spiritStateMachine concentra probabilidades de remate, faltas, cartões e durações de UI.',
    modules: [
      {
        file: 'src/gamespirit/GameSpirit.ts',
        title: 'gameSpiritTick',
        blurb: 'Escolha de ação, narração via templates/seed, golo, sequências de penálti e integração crowd.',
      },
      {
        file: 'src/gamespirit/spiritStateMachine.ts',
        title: 'Máquina de estado pura',
        blurb: 'Pesos de remate, DANGEROUS_FOUL_PROB, PENALTY_FROM_FOUL_PROB, overlays de golo/cartão vermelho.',
      },
      {
        file: 'src/engine/runMatchMinute.ts',
        title: 'runMatchMinute',
        blurb: 'Orquestra um minuto: buildSpiritContext, gameSpiritTick, fadiga, eventos UI.',
      },
      {
        file: 'src/tactics/playingStyle.ts',
        title: 'Estilo de jogo',
        blurb: 'normalizeStyle — entrada tática para o SpiritContext (via reducer / partida).',
      },
    ],
  },
  {
    id: 'live',
    title: 'Roteiro ao vivo & beats',
    lead:
      'Contratos em storyContracts: timeline, beats, matriz de duelos, pesos da história. liveStoryEngine e storyMotor avançam o roteiro; advanceLiveStoryMinute um passo por minuto.',
    modules: [
      {
        file: 'src/gamespirit/storyContracts.ts',
        title: 'Contratos',
        blurb: 'TacticalIntent, BeatKind, Beat, StoryTimeline, StoryWeights, CoachCommand — sem vencedor no pré-jogo.',
      },
      {
        file: 'src/gamespirit/liveStoryEngine.ts',
        title: 'Motor da história ao vivo',
        blurb: 'Resolução de beats, orçamento de tempo, narração por tipo de lance.',
      },
      {
        file: 'src/gamespirit/storyMotor.ts',
        title: 'storyMotor',
        blurb: 'Colagem entre estado da partida e geração de conteúdo do roteiro.',
      },
      {
        file: 'src/gamespirit/advanceLiveStoryMinute.ts',
        title: 'advanceLiveStoryMinute',
        blurb: 'API de avanço explícito do roteiro por minuto.',
      },
      {
        file: 'src/gamespirit/beatArriveHints.ts',
        title: 'beatArriveHints',
        blurb: 'Sugestões posicionais / UX para chegada de beats.',
      },
    ],
  },
  {
    id: 'narration',
    title: 'Narração & voz',
    lead:
      'Duas famílias: narrativeTemplates (feed da partida rápida, funções por tipo de lance) e storyNarrativeCatalog (linhas longas estilo transmissão, placeholders {name} / {away}). narrationSeed faz escolha determinística por seed.',
    modules: [
      {
        file: 'src/gamespirit/narrativeTemplates.ts',
        title: 'Templates quick',
        blurb: 'shot, shotSave, pass, tackle, goal… — uma linha, nomes em bold no renderer.',
      },
      {
        file: 'src/gamespirit/storyNarrativeCatalog.ts',
        title: 'Catálogo ao vivo',
        blurb: `${NARRATIVE_CATALOG_BLOCKS.length} blocos de linhas + pick*Line / injectName.`,
      },
      {
        file: 'src/gamespirit/narrationSeed.ts',
        title: 'narrationSeed',
        blurb: 'pickLine e variação coerente com minuto/seed.',
      },
    ],
  },
  {
    id: 'coach',
    title: 'Comandos do treinador',
    lead:
      'Texto livre do utilizador é classificado por palavras-chave → TacticalIntent → ajuste de StoryWeights (duelos, oportunidades, pressão disciplinar). Usado no fluxo ao vivo / UI de comando.',
    modules: [
      {
        file: 'src/gamespirit/coachCommands.ts',
        title: 'coachCommands',
        blurb: 'scoreCommandRelevance, applyRelevantCommandToStoryWeights, CANONICAL_RELEVANT_COMMAND.',
      },
      {
        file: 'src/gamespirit/prematchCoachSuggestion.ts',
        title: 'Sugestão pré-jogo',
        blurb: 'Frases curtas de orientação a partir da matriz e risco (sem prever resultado).',
      },
    ],
  },
  {
    id: 'prematch',
    title: 'Pré-jogo & “por posição”',
    lead:
      'prematchAnalysis agrega força por papel em campo (guarda-redes / defesa / meio / ataque) a partir dos atributos de jogo. buildLivePrematchBundle prepara o pacote seguro para o live (sem desfecho). buildPrematchSectorAndMatrix alimenta duelos setoriais.',
    modules: [
      {
        file: 'src/gamespirit/prematchAnalysis.ts',
        title: 'Análise setorial',
        blurb: 'SectorStrength por role (gk/def/mid/attack), MatchupMatrix defVsAtk / criVsCri / atkVsDef.',
      },
      {
        file: 'src/gamespirit/buildLivePrematch.ts',
        title: 'Bundle pré-live',
        blurb: 'LivePrematchBundle para arranque da história sem vazar vencedor.',
      },
      {
        file: 'src/pages/LiveMatch.tsx',
        title: 'UI Live Match',
        blurb: 'Consumidor visível GameSpirit no ecrã de partida ao vivo.',
      },
    ],
  },
  {
    id: 'rules',
    title: 'Regras, fases & overlays',
    lead:
      'spiritSnapshotTypes define fases (open_play, penalty, …), overlays (golo, intervalo, penálti, vermelho) e estado do penálti. Constantes de tempo (ex. GOAL_SCORER_OVERLAY_MS) vivem na state machine.',
    modules: [
      {
        file: 'src/gamespirit/spiritSnapshotTypes.ts',
        title: 'Snapshot types',
        blurb: 'SpiritPhase, SpiritOverlayKind, PenaltyState, HomeShotLogicalOutcome.',
      },
      {
        file: 'src/match/MatchInterruptOverlay.tsx',
        title: 'Overlay de interrupção',
        blurb: 'UI para tipos de overlay GameSpirit.',
      },
      {
        file: 'src/pages/MatchQuick.tsx',
        title: 'Partida rápida',
        blurb: 'Integra overlays de golo/penálti e constantes da state machine.',
      },
    ],
  },
  {
    id: 'pipeline',
    title: 'Integração causal & 3D',
    lead:
      'Eventos append-only em match/causal; MatchBabylonLayer documenta fusão SIM_SYNC + roteiro. Modo Supabase live pode não usar GameSpirit para placar — ver SUPABASE.md.',
    modules: [
      {
        file: 'src/match/causal/matchCausalTypes.ts',
        title: 'Tipos causais',
        blurb: 'Importa BallZone do GameSpirit.',
      },
      {
        file: 'src/components/MatchBabylonLayer.tsx',
        title: 'Babylon',
        blurb: 'Camada 3D alimentada por beats / estado sincronizado.',
      },
      {
        file: 'docs/SUPABASE.md',
        title: 'Supabase / live',
        blurb: 'Quando o placar não vem do GameSpirit.',
      },
    ],
  },
  {
    id: 'admin',
    title: 'Admin & Gemini',
    lead:
      'playerFromPrompt: GameSpirit como intérprete de prompt → ficha de jogador (JSON). createPlayerIntegrationReference: passos do wizard e contrato de resposta. Configuração: GEMINI_API_KEY no .env.',
    modules: [
      {
        file: 'src/gamespirit/admin/playerFromPrompt.ts',
        title: 'interpretPlayerPromptGameSpirit',
        blurb: 'Gemini + merge com contexto fixo (nome, pos, país, tipo, raridade, pé).',
      },
      {
        file: 'src/gamespirit/admin/createPlayerIntegrationReference.ts',
        title: 'Referência Create Player',
        blurb: 'Passos, campos opcionais, shape JSON, copy-pasta integração.',
      },
      {
        file: 'src/admin/panels/AdminCreatePlayerPanel.tsx',
        title: 'UI Create Player',
        blurb: 'Wizard completo no Admin (separado deste painel).',
      },
    ],
  },
];

export const GAME_SPIRIT_DOC_PATHS = [
  'docs/MATCH_CAUSAL_PIPELINE.md',
  'docs/SUPABASE.md',
  'docs/PROMPT_MOTOR_VISUAL_BABYLON_YUKA.md',
  'docs/ADMIN_CREATE_PLAYER_INTEGRATION.md',
] as const;

export const GAME_SPIRIT_TEST_COMMANDS = [
  { cmd: 'npm run test:spirit-machine', about: 'Máquina de estado + gameSpiritTick (self-test).' },
  { cmd: 'npm run test:live-story', about: 'Pré-jogo ao vivo, comandos, diff de beats no intervalo.' },
] as const;

function sectionToText(s: GameSpiritSection): string {
  const lines = [`## ${s.title}`, '', s.lead, ''];
  for (const m of s.modules) {
    lines.push(`- **${m.title}** (\`${m.file}\`)`, `  ${m.blurb}`, '');
  }
  return lines.join('\n');
}

/** Texto único para colar em Notion / outro repo. */
export function buildGameSpiritCopypasta(): string {
  const parts = [
    `OLEFOOT — GAME SPIRIT (${GAME_SPIRIT_VERSION_TAG})`,
    '',
    'Domínios e ficheiros principais:',
    '',
    ...GAME_SPIRIT_SECTIONS.map(sectionToText),
    '---',
    'Intenções táticas (TacticalIntent):',
    TACTICAL_INTENT_VALUES.join(', '),
    '',
    'BeatKind:',
    BEAT_KIND_VALUES.join(', '),
    '',
    'SpiritPhase:',
    SPIRIT_PHASE_VALUES.join(', '),
    '',
    'ProposedAction (quick):',
    PROPOSED_ACTION_VALUES.join(', '),
    '',
    'Documentação:',
    ...GAME_SPIRIT_DOC_PATHS.map((p) => `- ${p}`),
    '',
    'Testes:',
    ...GAME_SPIRIT_TEST_COMMANDS.map((t) => `- \`${t.cmd}\` — ${t.about}`),
    '',
  ];
  return parts.join('\n');
}

/**
 * Verdade operacional do GameSpirit — o que o motor consome hoje vs. o que é só painel / ficheiros estáticos.
 * Isto não inventa capacidades: serve para o Admin não prometer o que o código não faz.
 */

export type WiringStatus =
  | 'motor'
  | 'motor_roteiro'
  | 'codigo_sem_ui'
  | 'local_admin'
  | 'nao_integrado';

export interface WiringRow {
  id: string;
  nome: string;
  status: WiringStatus;
  /** Uma frase factual. */
  fact: string;
}

export const GAME_SPIRIT_WIRING_TABLE: WiringRow[] = [
  {
    id: 'tick_quick',
    nome: 'gameSpiritTick + runMatchMinute',
    status: 'motor',
    fact: 'Partida rápida (quick) chama isto a cada minuto; posse, bola, narrativa curta, golos/penáltis autoritativos.',
  },
  {
    id: 'state_machine',
    nome: 'spiritStateMachine',
    status: 'motor',
    fact: 'Probabilidades de remate, faltas perigosas, penálti derivado de falta, overlays de tempo (golo, vermelho).',
  },
  {
    id: 'templates_quick',
    nome: 'narrativeTemplates',
    status: 'motor',
    fact: 'Frases do feed da partida rápida; escolha por seed/minuto no bundle.',
  },
  {
    id: 'catalog_live',
    nome: 'storyNarrativeCatalog',
    status: 'motor_roteiro',
    fact: 'Linhas longas para beats ao vivo (drible, cruzamento, falta…); pick*Line no código compilado.',
  },
  {
    id: 'live_story',
    nome: 'liveStoryEngine / storyMotor / advanceLiveStoryMinute',
    status: 'motor_roteiro',
    fact: 'Roteiro ao vivo e beats; usado no fluxo live/texto conforme o reducer liga.',
  },
  {
    id: 'coach_commands',
    nome: 'coachCommands (TacticalIntent)',
    status: 'codigo_sem_ui',
    fact: 'Classifica texto → ajusta StoryWeights; existe API, a UI dedicada no jogo pode ser parcial.',
  },
  {
    id: 'prematch',
    nome: 'prematchAnalysis + buildLivePrematch',
    status: 'motor_roteiro',
    fact: 'Forças setoriais por papel (gk/def/mid/attack) e matriz de duelos; pré-jogo sem vencedor.',
  },
  {
    id: 'gemini_player',
    nome: 'interpretPlayerPromptGameSpirit (Gemini)',
    status: 'motor',
    fact: 'Só Create Player no Admin; precisa GEMINI_API_KEY no build Vite.',
  },
  {
    id: 'admin_kb',
    nome: 'Biblioteca deste painel (localStorage)',
    status: 'local_admin',
    fact: 'Narrativas/padrões ficam só na biblioteca local. As posições (código = POS do jogador, ex. MC, GOL) são lidas em pitchPlayersFromLineup ao iniciar a partida e sobrepõem a grelha da formação.',
  },
  {
    id: 'docling',
    nome: 'Docling (PDF/layout → texto estruturado)',
    status: 'nao_integrado',
    fact: 'Não há pacote Docling nem pipeline no OLEFOOT; usa importação de ficheiro .txt/.md ou cola o output do Docling fora deste app.',
  },
  {
    id: 'openai',
    nome: 'OpenAI (Admin → olefoot-server)',
    status: 'motor',
    fact: 'POST /api/game-spirit/teach e POST /api/gamespirit; OPENAI_API_KEY só em server/.env. Com `VITE_OLEFOOT_GAMESPIRIT_PHASE1=true`, o TacticalSimLoop agenda pedidos nos gatilhos receção/portador, enviesa prethinking e empurra narração curta para `simState.events` — nunca no loop por frame.',
  },
];

export function statusLabelPt(s: WiringStatus): string {
  switch (s) {
    case 'motor':
      return 'Ativo no motor (quick)';
    case 'motor_roteiro':
      return 'Ativo no roteiro / live';
    case 'codigo_sem_ui':
      return 'Código pronto, UI parcial';
    case 'local_admin':
      return 'Só neste painel (local)';
    case 'nao_integrado':
      return 'Não ligado / precisa config';
    default:
      return s;
  }
}

export function clientGeminiConfigured(): boolean {
  try {
    const k =
      typeof process !== 'undefined' && process.env && typeof process.env.GEMINI_API_KEY === 'string'
        ? process.env.GEMINI_API_KEY
        : '';
    return k.trim().length > 0;
  } catch {
    return false;
  }
}

export function olefootApiBase(): string {
  const v = import.meta.env.VITE_OLEFOOT_API_URL;
  if (typeof v === 'string' && v.trim()) return v.replace(/\/$/, '');
  return 'http://localhost:4000';
}

import { PRESET_LABEL_PT, type PlayingStylePresetId } from '@/tactics/playingStyle';

export type AiLabsMode = 'livre' | 'classico';

export interface AiLabsProposal {
  presetId: PlayingStylePresetId;
  /** Texto curto: o que vamos fazer no jogo (sem jargão de código). */
  implementation: string;
  /** Até ~150 caracteres — resumo inspirador / clássico. */
  headline: string;
  /** Sugestões de reforço por posição (links para Mercado). */
  transferByPos: { pos: string; label: string }[];
}

/** Clássicos públicos → preset interno (interpretação, não simulação 1:1). */
const CLASSIC_ROWS: {
  needles: string[];
  headline: string;
  presetId: PlayingStylePresetId;
  transfer: { pos: string; label: string }[];
}[] = [
  {
    needles: ['corinthians', '2012', 'timão', 'libertadores 2012'],
    headline:
      'Corinthians 2012: bloco firme, transição rápida e criatividade no último terço — referência pública, estilo aproximado no OLE.',
    presetId: 'BLOCO_BAIXO',
    transfer: [
      { pos: 'VOL', label: 'Volante que segura e sai' },
      { pos: 'ATA', label: 'Referência de área' },
    ],
  },
  {
    needles: ['barcelona', 'guardiola', 'tiki', '2011'],
    headline:
      'Barça de posse: troca curta, amplitude e pressão alta — referência pública; no OLE aproxima posse controlada.',
    presetId: 'POSSE_CONTROLADA',
    transfer: [
      { pos: 'MC', label: 'Meias que ligam o jogo' },
      { pos: 'LE', label: 'Ala que sobe e cruza' },
    ],
  },
  {
    needles: ['liverpool', ' gegen', 'klopp', 'pressão alta'],
    headline:
      'Gegenpressing: perder e ir atrás da bola, bloco curto — referência pública; no OLE aproxima pressão alta.',
    presetId: 'PRESSAO_ALTA',
    transfer: [
      { pos: 'PE', label: 'Extremo que parte em velocidade' },
      { pos: 'VOL', label: 'Meio que cobre espaços' },
    ],
  },
  {
    needles: ['real madrid', 'ancelotti', 'modric', 'kroos'],
    headline:
      'Criação com liberdade e leitura individual — referência pública; no OLE aproxima estilo criativo livre.',
    presetId: 'CRIATIVO_LIVRE',
    transfer: [
      { pos: 'MOC', label: 'Meia que desequilibra' },
      { pos: 'ATA', label: 'Homem-gol móvel' },
    ],
  },
  {
    needles: ['contra ataque', 'transicao rapida', 'vertical rapida', 'profundidade direta'],
    headline:
      'Contra-ataque e profundidade: campo aberto e finalização — referência pública; no OLE aproxima transição rápida.',
    presetId: 'TRANSICAO_RAPIDA',
    transfer: [
      { pos: 'PD', label: 'Ponta que fixa e desmarca' },
      { pos: 'ATA', label: 'Finalizador' },
    ],
  },
  {
    needles: ['atletico', 'simeone', 'bloco baixo', 'fechadinho'],
    headline:
      'Bloco compacto e jogo direto: defender junto e punir no erro — referência pública; no OLE aproxima bloco baixo.',
    presetId: 'BLOCO_BAIXO',
    transfer: [
      { pos: 'ZAG', label: 'Central agressivo no jogo aéreo' },
      { pos: 'VOL', label: 'Primeiro volante' },
    ],
  },
  {
    needles: ['inglaterra', '1966', 'long ball', 'wing'],
    headline:
      'Jogo inglês clássico: amplitude e bolas na área — referência pública; no OLE aproxima alas e cruzamentos.',
    presetId: 'JOGO_PELAS_LATERAIS',
    transfer: [
      { pos: 'LD', label: 'Lateral ofensivo' },
      { pos: 'ATA', label: 'Homem de área' },
    ],
  },
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchClassic(text: string): (typeof CLASSIC_ROWS)[number] | null {
  const n = norm(text);
  if (n.length < 4) return null;
  for (const row of CLASSIC_ROWS) {
    const hit = row.needles.some((k) => n.includes(norm(k)));
    if (hit) return row;
  }
  return null;
}

function heuristicFree(text: string): PlayingStylePresetId {
  const n = norm(text);
  if (/bloco|fechad|defens.*baix|simeone|mourinho|catenaccio/.test(n)) return 'BLOCO_BAIXO';
  if (/gegen|press|pressing|klopp|recuper.*imed|alta.*linha/.test(n)) return 'PRESSAO_ALTA';
  if (/posse|tiki|guardiola|triang|circul|pacienc|curta|toc/.test(n)) return 'POSSE_CONTROLADA';
  if (/contra|transi|vertical|rapido|veloc|profund/.test(n)) return 'TRANSICAO_RAPIDA';
  if (/ala|cruz|lateral|extens|ponta|wing/.test(n)) return 'JOGO_PELAS_LATERAIS';
  if (/longa|lanc|rasto|bota|2.?a|segunda bola|jogo direto/.test(n)) return 'JOGO_DIRETO';
  if (/criativ|ancelotti|livre|imprevis|liberdade/.test(n)) return 'CRIATIVO_LIVRE';
  return 'balanced';
}

function buildImplementation(presetId: PlayingStylePresetId, mode: AiLabsMode): string {
  const nome = PRESET_LABEL_PT[presetId];
  if (mode === 'classico') {
    return `Aplicamos o preset «${nome}» na tática do clube. Ajusta depois em Tática se quiseres matizar. O treino continua a usar a lógica que já tens no Centro de treino.`;
  }
  return `Lemos a tua visão e encaixámos no preset «${nome}». Abre Tática para ver os eixos; o treino segue o que já definiste no plantel.`;
}

/** Sugestão OLE a partir do nome do time do coração (informação pública / tom de adepto). */
export function oleSuggestionFromFavoriteTeam(teamName: string | undefined | null): AiLabsProposal | null {
  const t = (teamName ?? '').trim();
  if (t.length < 2) return null;
  const n = norm(t);
  const fromClassic = matchClassic(t);
  if (fromClassic) {
    return {
      presetId: fromClassic.presetId,
      headline: fromClassic.headline.slice(0, 150),
      implementation: buildImplementation(fromClassic.presetId, 'classico'),
      transferByPos: fromClassic.transfer,
    };
  }
  if (n.includes('corinth') || n.includes('timao')) return interpretAiLabsInput('classico', 'Corinthians 2012');
  if (n.includes('flam') || n.includes('mengo')) {
    return {
      presetId: 'TRANSICAO_RAPIDA',
      headline:
        'Sugestão OLE: ritmo e transição — inspiração em fases fortes do teu clube (visão de adepto, não estatística oficial).'.slice(
          0,
          150,
        ),
      implementation: buildImplementation('TRANSICAO_RAPIDA', 'classico'),
      transferByPos: [
        { pos: 'VOL', label: 'Meio completo' },
        { pos: 'ATA', label: 'Homem-gol' },
      ],
    };
  }
  if (n.includes('palme') || n.includes('verdao')) {
    return {
      presetId: 'BLOCO_BAIXO',
      headline:
        'Sugestão OLE: bloco firme e bola parada — inspiração em ciclos sólidos do clube (referência genérica).'.slice(
          0,
          150,
        ),
      implementation: buildImplementation('BLOCO_BAIXO', 'classico'),
      transferByPos: [
        { pos: 'ZAG', label: 'Central' },
        { pos: 'MC', label: 'Meia que entra na área' },
      ],
    };
  }
  return {
    presetId: 'balanced',
    headline: 'Sugestão OLE: começar equilibrado e afinar na Tática com o teu clube do coração como norte emocional.'.slice(
      0,
      150,
    ),
    implementation: buildImplementation('balanced', 'classico'),
    transferByPos: [
      { pos: 'MC', label: 'Motor do meio' },
      { pos: 'ATA', label: 'Referência ofensiva' },
    ],
  };
}

export function interpretAiLabsInput(mode: AiLabsMode, raw: string): AiLabsProposal {
  const text = raw.trim();
  if (mode === 'classico') {
    const hit = matchClassic(text);
    if (hit) {
      return {
        presetId: hit.presetId,
        headline: hit.headline.slice(0, 150),
        implementation: buildImplementation(hit.presetId, 'classico'),
        transferByPos: hit.transfer,
      };
    }
    return {
      presetId: 'balanced',
      headline:
        'Não encontrámos um clássico conhecido nesse texto. Experimenta «Corinthians 2012» ou «Barcelona posse».',
      implementation: buildImplementation('balanced', 'classico'),
      transferByPos: [
        { pos: 'MC', label: 'Meia criativo' },
        { pos: 'ATA', label: 'Avançado' },
      ],
    };
  }

  const presetId = heuristicFree(text);
  return {
    presetId,
    headline: `Visão lida: encaixámos em «${PRESET_LABEL_PT[presetId]}».`,
    implementation: buildImplementation(presetId, 'livre'),
    transferByPos:
      presetId === 'JOGO_PELAS_LATERAIS'
        ? [
            { pos: 'LE', label: 'Ala esquerdo' },
            { pos: 'LD', label: 'Ala direito' },
          ]
        : presetId === 'BLOCO_BAIXO'
          ? [
              { pos: 'ZAG', label: 'Central' },
              { pos: 'VOL', label: 'Volante' },
            ]
          : presetId === 'PRESSAO_ALTA'
            ? [
                { pos: 'PE', label: 'Extremo na pressão' },
                { pos: 'VOL', label: 'Cobertura nas costas' },
              ]
            : [
                { pos: 'MC', label: 'Meio' },
                { pos: 'ATA', label: 'Avançado' },
              ],
  };
}

export function presetDisplayName(id: PlayingStylePresetId): string {
  return PRESET_LABEL_PT[id] ?? id;
}

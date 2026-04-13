/**
 * Catálogo de estilos de cabelo para Academia OLE / prompt de retrato (personagem fictício).
 * Referências a jogadores reais são apenas âncoras de estilo para ilustração, não rostos reais.
 */
export type ManagerHairStyleCatalogEntry = {
  id: string;
  name: string;
  description: string;
  example_player: string;
  tags: string[];
  length: string;
  texture: string;
  rarity: string;
  signature?: boolean;
};

export const MANAGER_HAIR_STYLES: ManagerHairStyleCatalogEntry[] = [
  {
    id: 'fade_short_top',
    name: 'Degradê topo curto',
    description: 'Laterais baixas com topo curto e alinhado',
    example_player: 'Cristiano Ronaldo',
    tags: ['clean', 'professional', 'modern'],
    length: 'short',
    texture: 'straight',
    rarity: 'common',
  },
  {
    id: 'fade_messy_top',
    name: 'Degradê bagunçado',
    description: 'Laterais curtas com topo médio desorganizado',
    example_player: 'Kevin De Bruyne',
    tags: ['natural', 'casual'],
    length: 'medium',
    texture: 'straight',
    rarity: 'common',
  },
  {
    id: 'faux_hawk',
    name: 'Moicano disfarçado',
    description: 'Laterais curtas com volume central destacado',
    example_player: 'Neymar Jr.',
    tags: ['flashy', 'attacker', 'creative'],
    length: 'medium',
    texture: 'mixed',
    rarity: 'uncommon',
  },
  {
    id: 'short_curly',
    name: 'Cacheado curto',
    description: 'Cabelo cacheado natural com volume controlado',
    example_player: 'Vinicius Jr.',
    tags: ['natural', 'dynamic'],
    length: 'short',
    texture: 'curly',
    rarity: 'common',
  },
  {
    id: 'afro',
    name: 'Afro volumoso',
    description: 'Cabelo cheio e volumoso estilo black power',
    example_player: 'Marcelo',
    tags: ['strong_identity', 'classic'],
    length: 'medium',
    texture: 'afro',
    rarity: 'uncommon',
  },
  {
    id: 'dreads',
    name: 'Dreads',
    description: 'Cabelo em dreadlocks, podendo ter variações de cor',
    example_player: 'Paul Pogba',
    tags: ['stylish', 'creative'],
    length: 'long',
    texture: 'dread',
    rarity: 'rare',
  },
  {
    id: 'dreads_ronaldinho',
    name: 'Dreads raiz (Ronaldinho)',
    description: 'Dreads longos, soltos, com faixa na cabeça, estilo leve e improvisador',
    example_player: 'Ronaldinho Gaucho',
    tags: ['raiz', 'improviso', 'criativo', 'brasil'],
    length: 'long',
    texture: 'dread',
    rarity: 'legendary',
    signature: true,
  },
  {
    id: 'braids',
    name: 'Tranças',
    description: 'Tranças rente ao couro cabeludo',
    example_player: 'Jules Kounde',
    tags: ['clean', 'urban'],
    length: 'medium',
    texture: 'braid',
    rarity: 'uncommon',
  },
  {
    id: 'long_tied',
    name: 'Cabelo longo preso',
    description: 'Cabelo longo preso em coque ou rabo',
    example_player: 'Gareth Bale',
    tags: ['warrior', 'classic'],
    length: 'long',
    texture: 'straight',
    rarity: 'uncommon',
  },
  {
    id: 'beckham_style',
    name: 'Liso médio estilizado',
    description: 'Cabelo médio liso ou levemente ondulado, estilizado',
    example_player: 'David Beckham',
    tags: ['elegant', 'iconic'],
    length: 'medium',
    texture: 'wavy',
    rarity: 'rare',
  },
  {
    id: 'buzz_cut',
    name: 'Raspado',
    description: 'Cabelo raspado ou muito curto',
    example_player: 'Kylian Mbappe',
    tags: ['minimal', 'fast'],
    length: 'very_short',
    texture: 'straight',
    rarity: 'common',
  },
  {
    id: 'dyed_style',
    name: 'Colorido / platinado',
    description: 'Cabelo com coloração chamativa (loiro, platinado, etc)',
    example_player: 'Phil Foden',
    tags: ['flashy', 'young'],
    length: 'short',
    texture: 'mixed',
    rarity: 'rare',
  },
  {
    id: 'raiz_simple',
    name: 'Raiz (sem firula)',
    description: 'Corte simples, sem estilo definido, direto ao ponto',
    example_player: 'Jogador de base',
    tags: ['raiz', 'simples', 'low_profile'],
    length: 'short',
    texture: 'mixed',
    rarity: 'common',
  },
];

const RARITY_LABEL_PT: Record<string, string> = {
  common: 'comum',
  uncommon: 'pouco comum',
  rare: 'raro',
  legendary: 'lendário',
};

/** Texto longo para o prompt Admin / arte (não é URL). */
export function hairStylePromptFromCatalogId(id: string): string | undefined {
  const e = MANAGER_HAIR_STYLES.find((x) => x.id === id);
  if (!e) return undefined;
  const rarityPt = RARITY_LABEL_PT[e.rarity] ?? e.rarity;
  const parts = [
    `${e.name} [id=${e.id}]`,
    e.description,
    `Referência de estilo (cartão fictício): ${e.example_player}`,
    e.tags.length ? `Tags: ${e.tags.join(', ')}` : null,
    `Comprimento: ${e.length}; textura: ${e.texture}`,
    `Raridade estética: ${rarityPt}`,
    e.signature ? 'Assinatura icónica: sim' : null,
  ];
  return parts.filter(Boolean).join(' · ');
}

/** Rótulo para selects: nome do estilo + jogador de referência; sem raridade nem metadados de tipo. */
export function hairStyleSelectLabel(entry: ManagerHairStyleCatalogEntry): string {
  const ref = entry.example_player?.trim();
  return ref ? `${entry.name} (${ref})` : entry.name;
}

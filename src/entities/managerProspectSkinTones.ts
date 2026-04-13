/**
 * Catálogo de tom de pele para Academia OLE / prompt de retrato (personagem fictício).
 */
export type ManagerSkinToneCatalogEntry = {
  id: string;
  name: string;
  description: string;
  rarity: string;
};

export const MANAGER_SKIN_TONES: ManagerSkinToneCatalogEntry[] = [
  {
    id: 'very_light',
    name: 'Muito clara',
    description: 'Tom de pele muito claro',
    rarity: 'common',
  },
  {
    id: 'light',
    name: 'Clara',
    description: 'Tom de pele claro',
    rarity: 'common',
  },
  {
    id: 'medium_light',
    name: 'Média clara',
    description: 'Tom intermediário entre claro e moreno',
    rarity: 'common',
  },
  {
    id: 'medium',
    name: 'Morena',
    description: 'Tom de pele médio',
    rarity: 'common',
  },
  {
    id: 'medium_dark',
    name: 'Morena escura',
    description: 'Tom de pele mais escuro',
    rarity: 'common',
  },
  {
    id: 'dark',
    name: 'Escura',
    description: 'Tom de pele escuro',
    rarity: 'common',
  },
  {
    id: 'very_dark',
    name: 'Muito escura',
    description: 'Tom de pele muito escuro',
    rarity: 'common',
  },
];

const RARITY_LABEL_PT: Record<string, string> = {
  common: 'comum',
  uncommon: 'pouco comum',
  rare: 'raro',
  legendary: 'lendário',
};

export function skinTonePromptFromCatalogId(id: string): string | undefined {
  const e = MANAGER_SKIN_TONES.find((x) => x.id === id);
  if (!e) return undefined;
  const rarityPt = RARITY_LABEL_PT[e.rarity] ?? e.rarity;
  return [
    `Tom de pele: ${e.name} [id=${e.id}]`,
    e.description,
    `Raridade estética: ${rarityPt}`,
  ].join(' · ');
}

export function skinToneSelectLabel(entry: ManagerSkinToneCatalogEntry): string {
  const r = RARITY_LABEL_PT[entry.rarity] ?? entry.rarity;
  return `${entry.name} (${r})`;
}

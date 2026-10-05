/**
 * Catálogo de tom de pele para Academia OLE / prompt de retrato (personagem fictício).
 */
import { emIngles } from '@/i18n/L';
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

/**
 * Nome NA TELA. O `name` do catálogo fica em português porque alimenta o
 * prompt da arte (`skinTonePromptFromCatalogId`).
 */
const SKIN_NAME_EN: Record<string, string> = {
  very_light: 'Very fair',
  light: 'Fair',
  medium_light: 'Light medium',
  medium: 'Medium',
  medium_dark: 'Medium dark',
  dark: 'Dark',
  very_dark: 'Very dark',
};

const RARITY_LABEL_EN: Record<string, string> = {
  common: 'common',
  uncommon: 'uncommon',
  rare: 'rare',
  legendary: 'legendary',
};

export function skinToneDisplayName(entry: ManagerSkinToneCatalogEntry): string {
  return emIngles() ? SKIN_NAME_EN[entry.id] ?? entry.name : entry.name;
}

export function skinToneSelectLabel(entry: ManagerSkinToneCatalogEntry): string {
  const r = emIngles()
    ? RARITY_LABEL_EN[entry.rarity] ?? entry.rarity
    : RARITY_LABEL_PT[entry.rarity] ?? entry.rarity;
  return `${skinToneDisplayName(entry)} (${r})`;
}

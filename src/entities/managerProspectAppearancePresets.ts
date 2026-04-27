/**
 * Presets de aparência por região para Academia OLE.
 * Facilita criação rápida com características típicas de cada região.
 */

import type { ManagerProspectPortraitStyleRegion } from './managerProspect';

export interface AppearancePreset {
  id: string;
  label: string;
  region: ManagerProspectPortraitStyleRegion;
  skinToneId: string;
  eyeColor: string;
  hairStyleId: string;
  originTags: string[];
  originTextTemplate: string;
}

export const APPEARANCE_PRESETS: AppearancePreset[] = [
  // Brasil
  {
    id: 'brasileiro_classico',
    label: 'Brasileiro clássico',
    region: 'americas_sul',
    skinToneId: 'moreno_medio',
    eyeColor: 'Olhos castanhos',
    hairStyleId: 'curto_ondulado',
    originTags: ['Misto'],
    originTextTemplate: 'Brasil, ascendência mista (europeia, africana e indígena)',
  },
  {
    id: 'brasileiro_afro',
    label: 'Brasileiro afrodescendente',
    region: 'americas_sul',
    skinToneId: 'escuro',
    eyeColor: 'Olhos pretos ou muito escuros',
    hairStyleId: 'afro_curto',
    originTags: ['Afrodescendente'],
    originTextTemplate: 'Brasil, raízes africanas',
  },
  {
    id: 'brasileiro_europeu',
    label: 'Brasileiro descendente europeu',
    region: 'americas_sul',
    skinToneId: 'claro',
    eyeColor: 'Olhos castanho-claros, mel ou âmbar',
    hairStyleId: 'curto_liso',
    originTags: ['Europeu'],
    originTextTemplate: 'Brasil, ascendência italiana/portuguesa',
  },
  {
    id: 'brasileiro_asiatico',
    label: 'Brasileiro nikkei',
    region: 'americas_sul',
    skinToneId: 'amarelo_claro',
    eyeColor: 'Olhos pretos ou muito escuros',
    hairStyleId: 'curto_liso',
    originTags: ['Asiático'],
    originTextTemplate: 'Brasil, descendente de japoneses',
  },

  // Portugal
  {
    id: 'portugues_classico',
    label: 'Português clássico',
    region: 'europa',
    skinToneId: 'moreno_claro',
    eyeColor: 'Olhos castanhos',
    hairStyleId: 'curto_ondulado',
    originTags: ['Europeu'],
    originTextTemplate: 'Portugal, origem mediterrânica',
  },
  {
    id: 'portugues_norte',
    label: 'Português do norte',
    region: 'europa',
    skinToneId: 'claro',
    eyeColor: 'Olhos verdes ou avelã',
    hairStyleId: 'curto_liso',
    originTags: ['Europeu'],
    originTextTemplate: 'Portugal, região norte (Minho/Douro)',
  },
  {
    id: 'luso_africano',
    label: 'Luso-africano',
    region: 'europa',
    skinToneId: 'escuro',
    eyeColor: 'Olhos pretos ou muito escuros',
    hairStyleId: 'afro_curto',
    originTags: ['Afrodescendente'],
    originTextTemplate: 'Portugal, raízes cabo-verdianas/angolanas',
  },

  // África
  {
    id: 'africano_ocidental',
    label: 'Africano ocidental',
    region: 'africa_subsariana',
    skinToneId: 'muito_escuro',
    eyeColor: 'Olhos pretos ou muito escuros',
    hairStyleId: 'afro_curto',
    originTags: ['Afrodescendente'],
    originTextTemplate: 'África Ocidental (Senegal/Costa do Marfim/Gana)',
  },
  {
    id: 'africano_central',
    label: 'Africano central',
    region: 'africa_subsariana',
    skinToneId: 'muito_escuro',
    eyeColor: 'Olhos pretos ou muito escuros',
    hairStyleId: 'careca',
    originTags: ['Afrodescendente'],
    originTextTemplate: 'África Central (Camarões/RD Congo)',
  },

  // Europa
  {
    id: 'europeu_norte',
    label: 'Europeu nórdico',
    region: 'europa',
    skinToneId: 'muito_claro',
    eyeColor: 'Olhos azuis, acinzentados ou gelo',
    hairStyleId: 'curto_liso_loiro',
    originTags: ['Europeu'],
    originTextTemplate: 'Europa do Norte (Escandinávia/Países Baixos)',
  },
  {
    id: 'europeu_leste',
    label: 'Europeu do leste',
    region: 'europa',
    skinToneId: 'claro',
    eyeColor: 'Olhos verdes ou avelã',
    hairStyleId: 'curto_liso',
    originTags: ['Europeu'],
    originTextTemplate: 'Europa Oriental (Polónia/Rússia/Ucrânia)',
  },
  {
    id: 'europeu_sul',
    label: 'Europeu mediterrânico',
    region: 'europa',
    skinToneId: 'moreno_medio',
    eyeColor: 'Olhos castanhos',
    hairStyleId: 'curto_ondulado',
    originTags: ['Europeu'],
    originTextTemplate: 'Europa do Sul (Itália/Espanha/Grécia)',
  },

  // América Latina
  {
    id: 'argentino',
    label: 'Argentino',
    region: 'americas_sul',
    skinToneId: 'claro',
    eyeColor: 'Olhos castanho-claros, mel ou âmbar',
    hairStyleId: 'curto_ondulado',
    originTags: ['Europeu'],
    originTextTemplate: 'Argentina, ascendência italiana/espanhola',
  },
  {
    id: 'mexicano',
    label: 'Mexicano',
    region: 'americas_outras',
    skinToneId: 'moreno_medio',
    eyeColor: 'Olhos castanhos',
    hairStyleId: 'curto_liso',
    originTags: ['Indígena', 'Misto'],
    originTextTemplate: 'México, raízes indígenas e espanholas',
  },

  // Ásia
  {
    id: 'asiatico_leste',
    label: 'Asiático do leste',
    region: 'asia',
    skinToneId: 'amarelo_claro',
    eyeColor: 'Olhos pretos ou muito escuros',
    hairStyleId: 'curto_liso',
    originTags: ['Asiático'],
    originTextTemplate: 'Ásia Oriental (Japão/Coreia/China)',
  },
  {
    id: 'asiatico_sudeste',
    label: 'Asiático do sudeste',
    region: 'asia',
    skinToneId: 'moreno_claro',
    eyeColor: 'Olhos castanhos',
    hairStyleId: 'curto_liso',
    originTags: ['Asiático'],
    originTextTemplate: 'Sudeste Asiático (Tailândia/Vietname/Filipinas)',
  },

  // Médio Oriente
  {
    id: 'arabe',
    label: 'Árabe',
    region: 'mena',
    skinToneId: 'moreno_medio',
    eyeColor: 'Olhos castanhos',
    hairStyleId: 'curto_ondulado',
    originTags: ['Árabe'],
    originTextTemplate: 'Médio Oriente (Egito/Marrocos/Argélia)',
  },
];

export function getPresetById(id: string): AppearancePreset | undefined {
  return APPEARANCE_PRESETS.find((p) => p.id === id);
}

export function getPresetsByRegion(region: ManagerProspectPortraitStyleRegion): AppearancePreset[] {
  return APPEARANCE_PRESETS.filter((p) => p.region === region);
}

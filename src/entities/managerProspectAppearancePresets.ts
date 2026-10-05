/**
 * Presets de aparência por região para Academia OLE.
 * Facilita criação rápida com características típicas de cada região.
 */

import type { ManagerProspectPortraitStyleRegion } from './managerProspect';
import { L } from '@/i18n/L';

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
    label: L('Brasileiro clássico', 'Classic Brazilian'),
    region: 'americas_sul',
    skinToneId: 'moreno_medio',
    eyeColor: 'Olhos castanhos',
    hairStyleId: 'curto_ondulado',
    originTags: ['Misto'],
    originTextTemplate: L('Brasil, ascendência mista (europeia, africana e indígena)', 'Brazil, mixed heritage (European, African and Indigenous)'),
  },
  {
    id: 'brasileiro_afro',
    label: L('Brasileiro afrodescendente', 'Afro-Brazilian'),
    region: 'americas_sul',
    skinToneId: 'escuro',
    eyeColor: 'Olhos pretos ou muito escuros',
    hairStyleId: 'afro_curto',
    originTags: ['Afrodescendente'],
    originTextTemplate: L('Brasil, raízes africanas', 'Brazil, African roots'),
  },
  {
    id: 'brasileiro_europeu',
    label: L('Brasileiro descendente europeu', 'Brazilian of European descent'),
    region: 'americas_sul',
    skinToneId: 'claro',
    eyeColor: 'Olhos castanho-claros, mel ou âmbar',
    hairStyleId: 'curto_liso',
    originTags: ['Europeu'],
    originTextTemplate: L('Brasil, ascendência italiana/portuguesa', 'Brazil, Italian/Portuguese heritage'),
  },
  {
    id: 'brasileiro_asiatico',
    label: L('Brasileiro nikkei', 'Japanese-Brazilian (Nikkei)'),
    region: 'americas_sul',
    skinToneId: 'amarelo_claro',
    eyeColor: 'Olhos pretos ou muito escuros',
    hairStyleId: 'curto_liso',
    originTags: ['Asiático'],
    originTextTemplate: L('Brasil, descendente de japoneses', 'Brazil, of Japanese descent'),
  },

  // Portugal
  {
    id: 'portugues_classico',
    label: L('Português clássico', 'Classic Portuguese'),
    region: 'europa',
    skinToneId: 'moreno_claro',
    eyeColor: 'Olhos castanhos',
    hairStyleId: 'curto_ondulado',
    originTags: ['Europeu'],
    originTextTemplate: L('Portugal, origem mediterrânica', 'Portugal, Mediterranean origin'),
  },
  {
    id: 'portugues_norte',
    label: L('Português do norte', 'Northern Portuguese'),
    region: 'europa',
    skinToneId: 'claro',
    eyeColor: 'Olhos verdes ou avelã',
    hairStyleId: 'curto_liso',
    originTags: ['Europeu'],
    originTextTemplate: L('Portugal, região norte (Minho/Douro)', 'Portugal, northern region (Minho/Douro)'),
  },
  {
    id: 'luso_africano',
    label: L('Luso-africano', 'Luso-African'),
    region: 'europa',
    skinToneId: 'escuro',
    eyeColor: 'Olhos pretos ou muito escuros',
    hairStyleId: 'afro_curto',
    originTags: ['Afrodescendente'],
    originTextTemplate: L('Portugal, raízes cabo-verdianas/angolanas', 'Portugal, Cape Verdean/Angolan roots'),
  },

  // África
  {
    id: 'africano_ocidental',
    label: L('Africano ocidental', 'West African'),
    region: 'africa_subsariana',
    skinToneId: 'muito_escuro',
    eyeColor: 'Olhos pretos ou muito escuros',
    hairStyleId: 'afro_curto',
    originTags: ['Afrodescendente'],
    originTextTemplate: L('África Ocidental (Senegal/Costa do Marfim/Gana)', 'West Africa (Senegal/Ivory Coast/Ghana)'),
  },
  {
    id: 'africano_central',
    label: L('Africano central', 'Central African'),
    region: 'africa_subsariana',
    skinToneId: 'muito_escuro',
    eyeColor: 'Olhos pretos ou muito escuros',
    hairStyleId: 'careca',
    originTags: ['Afrodescendente'],
    originTextTemplate: L('África Central (Camarões/RD Congo)', 'Central Africa (Cameroon/DR Congo)'),
  },

  // Europa
  {
    id: 'europeu_norte',
    label: L('Europeu nórdico', 'Nordic European'),
    region: 'europa',
    skinToneId: 'muito_claro',
    eyeColor: 'Olhos azuis, acinzentados ou gelo',
    hairStyleId: 'curto_liso_loiro',
    originTags: ['Europeu'],
    originTextTemplate: L('Europa do Norte (Escandinávia/Países Baixos)', 'Northern Europe (Scandinavia/Netherlands)'),
  },
  {
    id: 'europeu_leste',
    label: L('Europeu do leste', 'Eastern European'),
    region: 'europa',
    skinToneId: 'claro',
    eyeColor: 'Olhos verdes ou avelã',
    hairStyleId: 'curto_liso',
    originTags: ['Europeu'],
    originTextTemplate: L('Europa Oriental (Polónia/Rússia/Ucrânia)', 'Eastern Europe (Poland/Russia/Ukraine)'),
  },
  {
    id: 'europeu_sul',
    label: L('Europeu mediterrânico', 'Mediterranean European'),
    region: 'europa',
    skinToneId: 'moreno_medio',
    eyeColor: 'Olhos castanhos',
    hairStyleId: 'curto_ondulado',
    originTags: ['Europeu'],
    originTextTemplate: L('Europa do Sul (Itália/Espanha/Grécia)', 'Southern Europe (Italy/Spain/Greece)'),
  },

  // América Latina
  {
    id: 'argentino',
    label: L('Argentino', 'Argentine'),
    region: 'americas_sul',
    skinToneId: 'claro',
    eyeColor: 'Olhos castanho-claros, mel ou âmbar',
    hairStyleId: 'curto_ondulado',
    originTags: ['Europeu'],
    originTextTemplate: L('Argentina, ascendência italiana/espanhola', 'Argentina, Italian/Spanish heritage'),
  },
  {
    id: 'mexicano',
    label: L('Mexicano', 'Mexican'),
    region: 'americas_outras',
    skinToneId: 'moreno_medio',
    eyeColor: 'Olhos castanhos',
    hairStyleId: 'curto_liso',
    originTags: ['Indígena', 'Misto'],
    originTextTemplate: L('México, raízes indígenas e espanholas', 'Mexico, Indigenous and Spanish roots'),
  },

  // Ásia
  {
    id: 'asiatico_leste',
    label: L('Asiático do leste', 'East Asian'),
    region: 'asia',
    skinToneId: 'amarelo_claro',
    eyeColor: 'Olhos pretos ou muito escuros',
    hairStyleId: 'curto_liso',
    originTags: ['Asiático'],
    originTextTemplate: L('Ásia Oriental (Japão/Coreia/China)', 'East Asia (Japan/Korea/China)'),
  },
  {
    id: 'asiatico_sudeste',
    label: L('Asiático do sudeste', 'Southeast Asian'),
    region: 'asia',
    skinToneId: 'moreno_claro',
    eyeColor: 'Olhos castanhos',
    hairStyleId: 'curto_liso',
    originTags: ['Asiático'],
    originTextTemplate: L('Sudeste Asiático (Tailândia/Vietname/Filipinas)', 'Southeast Asia (Thailand/Vietnam/Philippines)'),
  },

  // Médio Oriente
  {
    id: 'arabe',
    label: L('Árabe', 'Arab'),
    region: 'mena',
    skinToneId: 'moreno_medio',
    eyeColor: 'Olhos castanhos',
    hairStyleId: 'curto_ondulado',
    originTags: ['Árabe'],
    originTextTemplate: L('Médio Oriente (Egito/Marrocos/Argélia)', 'Middle East (Egypt/Morocco/Algeria)'),
  },
];

export function getPresetById(id: string): AppearancePreset | undefined {
  return APPEARANCE_PRESETS.find((p) => p.id === id);
}

export function getPresetsByRegion(region: ManagerProspectPortraitStyleRegion): AppearancePreset[] {
  return APPEARANCE_PRESETS.filter((p) => p.region === region);
}

import type { ClubStructureId } from '@/clubStructures/types';

/** Slots configuráveis no Admin (imagens de fundo / banners). */
export type BannerSlotId =
  | 'city_stadium'
  | 'city_training'
  | 'city_medical'
  | 'city_youth'
  | 'city_store'
  | 'home_matchday'
  | 'team_header'
  | 'wallet_spot'
  | 'leagues_header';

export const BANNER_SLOT_IDS: BannerSlotId[] = [
  'city_stadium',
  'city_training',
  'city_medical',
  'city_youth',
  'city_store',
  'home_matchday',
  'team_header',
  'wallet_spot',
  'leagues_header',
];

export const BANNER_SLOT_META: Record<BannerSlotId, { label: string; hint: string }> = {
  city_stadium: { label: 'Clube — painel Estádio', hint: 'Cabeçalho do cartão ao seleccionar o Estádio na cidade.' },
  city_training: { label: 'Clube — Centro de treino', hint: 'Cabeçalho do painel Centro de Treinamento.' },
  city_medical: { label: 'Clube — Departamento médico', hint: 'Cabeçalho do painel Médico.' },
  city_youth: { label: 'Clube — Categoria de base', hint: 'Cabeçalho do painel Base.' },
  city_store: { label: 'Clube — Megaloja', hint: 'Cabeçalho do painel Megaloja.' },
  home_matchday: { label: 'Home — bloco Matchday', hint: 'Área grande do próximo jogo na Home.' },
  team_header: { label: 'Plantel — cabeçalho', hint: 'Zona do título «Plantel Principal» e separadores.' },
  wallet_spot: { label: 'Wallet — topo', hint: 'Cabeçalho das páginas SPOT / OLEXP da carteira.' },
  leagues_header: { label: 'Ligas — topo', hint: 'Zona do título na página Ligas.' },
};

export const STRUCTURE_TO_BANNER_SLOT: Record<ClubStructureId, BannerSlotId> = {
  stadium: 'city_stadium',
  training_center: 'city_training',
  medical_dept: 'city_medical',
  youth_academy: 'city_youth',
  megastore: 'city_store',
};

export type UiBannerEntry =
  | { kind: 'none' }
  | { kind: 'preset'; file: string }
  | { kind: 'custom'; dataUrl: string };

export type UiBannersState = Partial<Record<BannerSlotId, UiBannerEntry>>;

/** Catálogo em código (fallback se `manifest.json` falhar). Deve coincidir com ficheiros em `public/banners/presets/`. */
export const BANNER_PRESETS_FALLBACK: { file: string; label: string }[] = [
  { file: 'abstract-neon.svg', label: 'Neon (estádio)' },
  { file: 'abstract-green.svg', label: 'Relvado' },
  { file: 'abstract-crimson.svg', label: 'Energia' },
  { file: 'abstract-blue.svg', label: 'Noite azul' },
  { file: 'abstract-violet.svg', label: 'Roxo arena' },
  { file: 'abstract-amber.svg', label: 'Ouro / BRO' },
  { file: 'abstract-midnight.svg', label: 'Meia-noite' },
  { file: 'abstract-grid.svg', label: 'Grelha técnica' },
];

const PRESET_FILE_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(svg|png|webp|jpg|jpeg)$/i;

export function isSafePresetFilename(file: string): boolean {
  return PRESET_FILE_RE.test(file) && !file.includes('..');
}

export function resolveUiBannerImageUrl(entry: UiBannerEntry | undefined): string | null {
  if (!entry || entry.kind === 'none') return null;
  if (entry.kind === 'preset') {
    if (!isSafePresetFilename(entry.file)) return null;
    return `/banners/presets/${encodeURIComponent(entry.file)}`;
  }
  if (entry.kind === 'custom') {
    const u = entry.dataUrl;
    if (typeof u !== 'string') return null;
    if (u.startsWith('data:image/')) return u;
    if (u.startsWith('https://') || u.startsWith('http://')) return u;
  }
  return null;
}

export function hydrateUiBanners(raw: unknown): UiBannersState {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const out: UiBannersState = {};
  for (const id of BANNER_SLOT_IDS) {
    const e = o[id];
    if (!e || typeof e !== 'object') continue;
    const k = (e as { kind?: string }).kind;
    if (k === 'preset') {
      const file = (e as { file?: string }).file;
      if (typeof file === 'string' && isSafePresetFilename(file)) {
        out[id] = { kind: 'preset', file };
      }
    } else if (k === 'custom') {
      const dataUrl = (e as { dataUrl?: string }).dataUrl;
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/') && dataUrl.length < 2_500_000) {
        out[id] = { kind: 'custom', dataUrl };
      }
    }
  }
  return out;
}

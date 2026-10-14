/**
 * A CAMISA DO CLUBE — uniforme 2D em peças (14/10/2026).
 *
 * Antes: uma silhueta, 8 padrões, 3 cores, só na Fundação. Agora a camisa é
 * feita de PEÇAS (corpo, mangas, calção, meião), com gola, punho, manga longa,
 * texto no peito e mais padrões — e sai da Fundação: o manager edita no Clube
 * e ela veste o time no campo do LEGACY.
 *
 * Compatível pra trás: a camisa salva na Fundação (`padrao/primaria/
 * secundaria/calcao`) continua válida; os campos novos são opcionais e têm o
 * mesmo visual de antes quando ausentes. Função pura, sem React.
 */

export type PadraoDeCamisa =
  // os 8 da Fundação (as chaves não mudam: há clubes salvos com elas)
  | 'lisa' | 'listras' | 'horiz' | 'diagonal' | 'meio' | 'peito' | 'mangas' | 'gola'
  // novos (14/10)
  | 'listras-finas' | 'quartos' | 'chevron' | 'giz' | 'xadrez' | 'ombros' | 'lateral';

export type GolaDeCamisa = 'redonda' | 'v' | 'polo' | 'retro' | 'careca';

export interface CamisaDoClube {
  padrao: PadraoDeCamisa;
  primaria: string;
  secundaria: string;
  calcao: string;
  /** Cor das mangas (ausente: a principal; no padrão antigo 'mangas', a do detalhe). */
  manga?: string;
  /** O padrão do corpo continua nas mangas. */
  padraoNasMangas?: boolean;
  mangaLonga?: boolean;
  /** Punho na cor do detalhe (ausente = sim). */
  punho?: boolean;
  gola?: GolaDeCamisa;
  /** Cor do meião (ausente: a principal). */
  meiao?: string;
  /** Texto do peito no lugar do patrocínio (ausente: as iniciais do clube, como antes). */
  peito?: string;
  /** ISO — quando a camisa foi editada pela última vez (decide entre aparelhos). */
  editadaEm?: string;
}

export const PADROES: { k: PadraoDeCamisa; pt: string; en: string }[] = [
  { k: 'lisa', pt: 'Lisa', en: 'Plain' },
  { k: 'listras', pt: 'Listras', en: 'Stripes' },
  { k: 'listras-finas', pt: 'Listra fina', en: 'Pinstripes' },
  { k: 'horiz', pt: 'Aros', en: 'Hoops' },
  { k: 'diagonal', pt: 'Faixa', en: 'Sash' },
  { k: 'meio', pt: 'Meio a meio', en: 'Halves' },
  { k: 'quartos', pt: 'Quartos', en: 'Quarters' },
  { k: 'chevron', pt: 'Chevron', en: 'Chevron' },
  { k: 'peito', pt: 'Faixa peito', en: 'Chest band' },
  { k: 'giz', pt: 'Risca de giz', en: 'Chalk stripe' },
  { k: 'xadrez', pt: 'Xadrez', en: 'Checks' },
  { k: 'ombros', pt: 'Ombros', en: 'Yoke' },
  { k: 'lateral', pt: 'Laterais', en: 'Side panels' },
  { k: 'mangas', pt: 'Mangas', en: 'Sleeves' },
  { k: 'gola', pt: 'Detalhe', en: 'Trim' },
];

export const GOLAS: { k: GolaDeCamisa; pt: string; en: string }[] = [
  { k: 'redonda', pt: 'Redonda', en: 'Crew' },
  { k: 'v', pt: 'Gola V', en: 'V-neck' },
  { k: 'polo', pt: 'Polo', en: 'Polo' },
  { k: 'retro', pt: 'Retrô', en: 'Retro' },
  { k: 'careca', pt: 'Careca', en: 'Mock' },
];

/** Paleta do jogo: as cores da rua + as clássicas de camisa. */
export const CORES_DE_CAMISA = ['#F2E61E', '#0D0D0C', '#EEE9DF', '#C9A13B', '#B3121B', '#0B3D91', '#0E7A3A', '#5E2A84', '#E8731C', '#7A1F2B', '#6FA8DC', '#8A857B'];

export const CAMISA_PADRAO: CamisaDoClube = { padrao: 'listras', primaria: '#F2E61E', secundaria: '#0D0D0C', calcao: '#0D0D0C' };

const HEX = /^#[0-9a-f]{6}$/i;
const cor = (v: unknown, reserva: string) => (typeof v === 'string' && HEX.test(v) ? v.toUpperCase() : reserva);

/** Lê uma camisa vinda de fora (servidor, aparelho antigo): o que não vale, cai no padrão. */
export function normalizarCamisa(raw: unknown): CamisaDoClube {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const padrao = PADROES.some((p) => p.k === r.padrao) ? (r.padrao as PadraoDeCamisa) : CAMISA_PADRAO.padrao;
  const primaria = cor(r.primaria, CAMISA_PADRAO.primaria);
  const secundaria = cor(r.secundaria, CAMISA_PADRAO.secundaria);
  const out: CamisaDoClube = { padrao, primaria, secundaria, calcao: cor(r.calcao, CAMISA_PADRAO.calcao) };
  if (typeof r.manga === 'string' && HEX.test(r.manga)) out.manga = r.manga.toUpperCase();
  if (typeof r.meiao === 'string' && HEX.test(r.meiao)) out.meiao = r.meiao.toUpperCase();
  if (typeof r.padraoNasMangas === 'boolean') out.padraoNasMangas = r.padraoNasMangas;
  if (typeof r.mangaLonga === 'boolean') out.mangaLonga = r.mangaLonga;
  if (typeof r.punho === 'boolean') out.punho = r.punho;
  if (GOLAS.some((g) => g.k === r.gola)) out.gola = r.gola as GolaDeCamisa;
  if (typeof r.peito === 'string') out.peito = r.peito.toUpperCase().replace(/[^A-Z0-9À-Ú '!.-]/gi, '').slice(0, 12);
  if (typeof r.editadaEm === 'string' && !Number.isNaN(Date.parse(r.editadaEm))) out.editadaEm = r.editadaEm;
  return out;
}

/** A camisa do clube: a editada no Clube vence; senão a da Fundação; senão a do jogo. */
export function camisaDoClube(club: { camisa?: CamisaDoClube; identidade?: { camisa?: unknown } } | null | undefined): CamisaDoClube {
  if (club?.camisa) return normalizarCamisa(club.camisa);
  if (club?.identidade?.camisa) return normalizarCamisa(club.identidade.camisa);
  return CAMISA_PADRAO;
}

/** Entre dois aparelhos, vence a camisa editada por último. */
export function camisaMaisRecente(a: CamisaDoClube | null | undefined, b: CamisaDoClube | null | undefined): CamisaDoClube | undefined {
  if (!a) return b ?? undefined;
  if (!b) return a;
  return Date.parse(b.editadaEm ?? '') > Date.parse(a.editadaEm ?? '') ? b : a;
}

// ── as peças, com os valores de antes quando o campo novo não existe ──
export const corDaManga = (c: CamisaDoClube) => c.manga ?? (c.padrao === 'mangas' ? c.secundaria : c.primaria);
export const corDoMeiao = (c: CamisaDoClube) => c.meiao ?? c.primaria;
export const golaDe = (c: CamisaDoClube): GolaDeCamisa => c.gola ?? 'redonda';
export const temPunho = (c: CamisaDoClube) => c.punho ?? true;

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Distância perceptiva simples entre duas cores (0 = igual; ~765 = oposto). */
export function distanciaDeCor(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
  const rm = (r1 + r2) / 2;
  return Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2);
}

/** Texto legível sobre a cor (luminância simples). */
export function tintaSobre(hex: string): string {
  const [r, g, b] = rgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#0D0D0C' : '#EEE9DF';
}

/** A camisa do goleiro: a cor da paleta mais longe da linha (o juiz exige diferente). */
export function camisaDoGoleiro(c: CamisaDoClube): { primaria: string; secundaria: string } {
  const candidatas = ['#0E7A3A', '#E8731C', '#6FA8DC', '#5E2A84', '#8A857B', '#0B3D91'];
  const primaria = [...candidatas].sort((x, y) => Math.min(distanciaDeCor(y, c.primaria), distanciaDeCor(y, c.secundaria)) - Math.min(distanciaDeCor(x, c.primaria), distanciaDeCor(x, c.secundaria)))[0]!;
  return { primaria, secundaria: '#0D0D0C' };
}

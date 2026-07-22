/**
 * Legends Data — fonte única de verdade do "museu vivo" Olefoot.
 *
 * Cada lenda fica indexada por slug (ex: 'pele') que vira a URL pública:
 *   game.olefoot.com/legend/pele
 *
 * Campos extras (achievements, era, openGraph) servem a SEO e ao
 * carrossel comercial. Quando o Hall of Fame backend estiver disponível,
 * trocar este import por um fetch preservando o shape.
 */

export interface LegendEvent {
  year: number;
  text: string;
}

export interface LegendAttribute {
  /** Nome curto exibido (ex: "FINALIZAÇÃO"). */
  label: string;
  /** Valor 0-100 (Football Manager scale). */
  value: number;
}

export interface LegendAchievement {
  /** Valor numérico/string compacto (ex: "1283", "3×"). */
  value: string;
  /** Rótulo curto Agency uppercase (ex: "Gols na carreira"). */
  label: string;
}

export interface LegendQuote {
  /** A citação. */
  text: string;
  /** Autor da citação (não a própria lenda — outro grande do esporte). */
  author: string;
  /** Contexto opcional ("Maradona, 1998"). */
  context?: string;
}

export interface LegendData {
  /** Slug URL-safe (lowercase, sem acento). Usado em /legend/{slug}. */
  slug: string;
  /** Nome em CAPS para o hero. */
  name: string;
  /** Nome próprio (citação canônica). */
  fullName: string;
  /** Eyebrow do hero ("O Rei do Futebol"). */
  epithet: string;
  /** Era textual ("1956 – 1977"). */
  era: string;
  /** Nacionalidade ("Brasil"). */
  nationality: string;
  /** Frase-data editorial ("Tricampeão do Mundo · 1958 · 1962 · 1970").
   *  Substitui a linha "era · nacionalidade" no hero com algo mais
   *  emocional/cinematográfico. Sempre maiúsculo. */
  signature: string;
  /** OVR 0-100 do museum (média do DNA + premium). */
  ovr: number;
  /** Citação principal (atribuída à própria lenda). */
  quote: string;
  quoteAuthor?: string;
  /** Foto P&B 400×500 (use object-cover object-top). */
  photoUrl?: string;
  /** Marcos de carreira ordenados por ano. */
  trajectory: LegendEvent[];
  /** 6 atributos core (3×2 no DNA grid). */
  dna: LegendAttribute[];
  /** 4 conquistas-âncora (Moret italic gigante). */
  achievements: LegendAchievement[];
  /** Citações de outros lendas sobre este (carrossel "voz do povo"). */
  tributes?: LegendQuote[];
  /** Quando o usuário clica "Treinar com X" — slug usado para destacar
   *  o card no Store/Legacies. Quando o backend tiver ID real, trocar. */
  storeHighlightId?: string;
  /** Open Graph (compartilhamento social). */
  og: {
    title: string;
    description: string;
    image?: string;
  };
}

export const LEGENDS_BY_SLUG: Record<string, LegendData> = {
  palhinha: {
    slug: 'palhinha',
    name: 'PALHINHA',
    fullName: 'Jorge Ferreira da Silva',
    epithet: 'O falso 9 que ninguém sabia marcar',
    era: '1992 – 1997',
    nationality: 'Brasil',
    signature: 'Bicampeão do Mundo · Tri da Libertadores · 1992 · 1993 · 1997',
    ovr: 95,
    quote: 'Três Libertadores. Poucos brasileiros podem dizer isso.',
    photoUrl: '/legends/palhinha.png',
    trajectory: [
      { year: 1992, text: 'Chega do América-MG e fatura Paulista, Libertadores e Mundial no São Paulo' },
      { year: 1993, text: 'Bicampeão do Mundo e Supercopa — dois golaços em Chilavert no mesmo jogo' },
      { year: 1997, text: 'Tricampeão da Libertadores, agora de azul pelo Cruzeiro' },
    ],
    dna: [
      { label: 'PASSE', value: 96 },
      { label: 'DRIBLE', value: 92 },
      { label: 'FINALIZAÇÃO', value: 86 },
      { label: 'VELOCIDADE', value: 86 },
      { label: 'TÁTICO', value: 96 },
      { label: 'MENTALIDADE', value: 96 },
    ],
    achievements: [
      { value: '71', label: 'Gols pelo São Paulo' },
      { value: '2×', label: 'Mundial (92·93)' },
      { value: '3×', label: 'Libertadores' },
      { value: '95', label: 'OVR no auge' },
    ],
    storeHighlightId: 'legacy-palhinha',
    og: {
      title: 'PALHINHA · Bicampeão do Mundo — Olefoot Legends',
      description:
        'Treina com Palhinha no Olefoot. Jorge Ferreira da Silva — bicampeão do mundo (92·93), tricampeão da Libertadores, OVR 95 no museu vivo.',
    },
  },

  goncalves: {
    slug: 'goncalves',
    name: 'GONÇALVES',
    fullName: 'Marcelo Gonçalves Costa Lopes',
    epithet: 'A leitura tática que carregou o Brasil',
    era: '1990 – 1998',
    nationality: 'Brasil',
    signature: 'Vice-Campeão do Mundo · Campeão da Copa América · 1995 · 1998',
    ovr: 84,
    quote: 'Pilar da linha de três que matou um jejum de 27 anos.',
    trajectory: [
      { year: 1993, text: 'Bicampeão mexicano — o zagueiro do passe rasteiro atravessa a fronteira' },
      { year: 1995, text: 'Campeão Brasileiro — pilar da defesa que matou um jejum de 27 anos' },
      { year: 1998, text: 'Titular na Copa América campeã e vice-campeão do Mundo com o Brasil' },
    ],
    dna: [
      { label: 'MARCAÇÃO', value: 86 },
      { label: 'TÁTICO', value: 92 },
      { label: 'MENTALIDADE', value: 93 },
      { label: 'PASSE', value: 78 },
      { label: 'FÍSICO', value: 76 },
      { label: 'FAIR PLAY', value: 91 },
    ],
    achievements: [
      { value: '1998', label: 'Vice do Mundo' },
      { value: '1×', label: 'Copa América' },
      { value: '1995', label: 'Brasileirão' },
      { value: '84', label: 'OVR no auge' },
    ],
    storeHighlightId: 'legacy-goncalves',
    og: {
      title: 'GONÇALVES · O Zagueiro do Brasil — Olefoot Legends',
      description:
        'Treina com Marcelo Gonçalves no Olefoot. Zagueiro vice-campeão do Mundo em 98 e campeão da Copa América — a leitura tática que carregou o Brasil.',
    },
  },

  adauto: {
    slug: 'adauto',
    name: 'ADAUTO',
    fullName: 'Adauto Evandro da Silva',
    epithet: 'Símbolo além do gol',
    era: '1999 – 2006',
    nationality: 'Brasil',
    signature: 'Artilheiro · Símbolo do Slavia Praha · 2000 · 2002 · 2006',
    ovr: 88,
    quote: 'Brasileiro no Eden. Voz no debate. Símbolo além do gol.',
    photoUrl: '/legends/adauto.png',
    trajectory: [
      { year: 2000, text: '8 gols em 7 jogos na Copa SP — o Santo André acreditou antes do país' },
      { year: 2002, text: 'Três gols no Olímpico e a Copa Sul-Minas pelo Atlético-PR' },
      { year: 2006, text: '78 jogos, 19 gols e uma voz no Slavia Praha — símbolo além do gol' },
    ],
    dna: [
      { label: 'FINALIZAÇÃO', value: 89 },
      { label: 'DRIBLE', value: 86 },
      { label: 'VELOCIDADE', value: 82 },
      { label: 'TÁTICO', value: 90 },
      { label: 'MENTALIDADE', value: 96 },
      { label: 'CONFIANÇA', value: 95 },
    ],
    achievements: [
      { value: '19', label: 'Gols no Slavia' },
      { value: '8', label: 'Gols em 7 jogos (Copa SP)' },
      { value: '2002', label: 'Copa Sul-Minas' },
      { value: '88', label: 'OVR no auge' },
    ],
    storeHighlightId: 'legacy-adauto',
    og: {
      title: 'ADAUTO · Símbolo do Slavia Praha — Olefoot Legends',
      description:
        'Treina com Adauto no Olefoot. Artilheiro brasileiro no Eden, símbolo além do gol — 19 gols pelo Slavia Praha, OVR 88 no museu vivo.',
    },
  },
};

/** Lookup tolerante: aceita slug com ou sem acento. */
export function findLegend(slugOrId: string | undefined): LegendData {
  const normalized = (slugOrId ?? 'palhinha')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return LEGENDS_BY_SLUG[normalized] ?? (LEGENDS_BY_SLUG.palhinha as LegendData);
}

/** Lista para grid/galeria futura. */
export const ALL_LEGEND_SLUGS = Object.keys(LEGENDS_BY_SLUG);

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
  pele: {
    slug: 'pele',
    name: 'PELÉ',
    fullName: 'Edson Arantes do Nascimento',
    epithet: 'O Rei do Futebol',
    era: '1956 – 1977',
    nationality: 'Brasil',
    ovr: 99,
    quote:
      'Eu nasci para jogar futebol, da mesma forma que Beethoven nasceu para escrever música e Michelangelo nasceu para pintar.',
    quoteAuthor: 'Edson Arantes do Nascimento',
    trajectory: [
      { year: 1958, text: 'Copa do Mundo aos 17 anos — gol de placa contra a Suécia na final' },
      { year: 1962, text: 'Bicampeonato mundial — lesão na primeira fase, Brasil campeão' },
      { year: 1970, text: 'Tricampeonato — seleção de todos os tempos' },
      { year: 1977, text: 'Adeus ao futebol no Cosmos de Nova York' },
    ],
    dna: [
      { label: 'FINALIZAÇÃO', value: 98 },
      { label: 'DRIBLE', value: 96 },
      { label: 'VELOCIDADE', value: 94 },
      { label: 'PASSE', value: 92 },
      { label: 'FÍSICO', value: 88 },
      { label: 'MENTALIDADE', value: 99 },
    ],
    achievements: [
      { value: '1283', label: 'Gols na carreira' },
      { value: '3×', label: 'Mundo' },
      { value: '21', label: 'Anos de elite' },
      { value: '92', label: 'Hat-tricks' },
    ],
    tributes: [
      {
        text: 'O melhor jogador de todos os tempos foi Pelé.',
        author: 'Diego Maradona',
        context: '1998',
      },
      {
        text: 'Pelé não tinha defeito, era completo.',
        author: 'Garrincha',
      },
    ],
    storeHighlightId: 'legacy-pele',
    og: {
      title: 'PELÉ · O Rei do Futebol — Olefoot Legends',
      description:
        'Treina com Pelé no Olefoot. Aprende com a lenda do futebol mundial — 1.283 gols, 3 mundiais, OVR 99 no museu vivo.',
    },
  },

  garrincha: {
    slug: 'garrincha',
    name: 'GARRINCHA',
    fullName: 'Manuel Francisco dos Santos',
    epithet: 'A Alegria do Povo',
    era: '1953 – 1973',
    nationality: 'Brasil',
    ovr: 95,
    quote:
      'Eu jogava futebol pela alegria de jogar. Não pensava em prêmio, em dinheiro, em fama.',
    quoteAuthor: 'Manuel Francisco dos Santos',
    trajectory: [
      { year: 1958, text: 'Copa do Mundo — desequilibrou no flanco direito' },
      { year: 1962, text: 'Bola de Ouro do Mundial após Pelé se lesionar' },
      { year: 1966, text: 'Última Copa pela seleção brasileira' },
    ],
    dna: [
      { label: 'DRIBLE', value: 99 },
      { label: 'VELOCIDADE', value: 92 },
      { label: 'FINALIZAÇÃO', value: 84 },
      { label: 'PASSE', value: 80 },
      { label: 'FÍSICO', value: 78 },
      { label: 'MENTALIDADE', value: 76 },
    ],
    achievements: [
      { value: '232', label: 'Gols na carreira' },
      { value: '2×', label: 'Mundo' },
      { value: '20', label: 'Anos de elite' },
      { value: '50', label: 'Internacionais' },
    ],
    tributes: [
      {
        text: 'Era um furacão pela direita. Ninguém defendia o Garrincha.',
        author: 'Pelé',
      },
    ],
    storeHighlightId: 'legacy-garrincha',
    og: {
      title: 'GARRINCHA · A Alegria do Povo — Olefoot Legends',
      description:
        'Treina com Garrincha no Olefoot. O drible que enganou o mundo — bicampeão, herói da Copa de 62, OVR 95.',
    },
  },

  zico: {
    slug: 'zico',
    name: 'ZICO',
    fullName: 'Arthur Antunes Coimbra',
    epithet: 'O Galinho de Quintino',
    era: '1971 – 1994',
    nationality: 'Brasil',
    ovr: 94,
    quote: 'O futebol arte é o futebol que faz a torcida sonhar.',
    quoteAuthor: 'Arthur Antunes Coimbra',
    trajectory: [
      { year: 1976, text: 'Estreia profissional pelo Flamengo' },
      { year: 1981, text: 'Mundial Interclubes — 3-0 sobre o Liverpool' },
      { year: 1982, text: 'Copa do Mundo na Espanha — geração de ouro' },
    ],
    dna: [
      { label: 'PASSE', value: 96 },
      { label: 'FINALIZAÇÃO', value: 92 },
      { label: 'MENTALIDADE', value: 90 },
      { label: 'DRIBLE', value: 88 },
      { label: 'VELOCIDADE', value: 80 },
      { label: 'FÍSICO', value: 78 },
    ],
    achievements: [
      { value: '826', label: 'Gols na carreira' },
      { value: '4×', label: 'Brasileirão' },
      { value: '23', label: 'Anos de elite' },
      { value: '6×', label: 'Bola de Prata' },
    ],
    tributes: [
      {
        text: 'Zico foi o melhor jogador que vi em campo.',
        author: 'Sócrates',
      },
    ],
    storeHighlightId: 'legacy-zico',
    og: {
      title: 'ZICO · O Galinho de Quintino — Olefoot Legends',
      description:
        'Treina com Zico no Olefoot. O 10 do Flamengo eterno — Mundial 81, geração 82, OVR 94.',
    },
  },
};

/** Lookup tolerante: aceita slug com ou sem acento. */
export function findLegend(slugOrId: string | undefined): LegendData {
  const normalized = (slugOrId ?? 'pele')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return LEGENDS_BY_SLUG[normalized] ?? (LEGENDS_BY_SLUG.pele as LegendData);
}

/** Lista para grid/galeria futura. */
export const ALL_LEGEND_SLUGS = Object.keys(LEGENDS_BY_SLUG);

/**
 * Legends Data — fonte única de verdade do "museu vivo" Olefoot.
 *
 * Cada lenda fica indexada por slug (ex: 'pele') que vira a URL pública:
 *   game.olefoot.ai/legend/pele
 *
 * Campos extras (achievements, era, openGraph) servem a SEO e ao
 * carrossel comercial. Quando o Hall of Fame backend estiver disponível,
 * trocar este import por um fetch preservando o shape.
 */
import { L } from '@/i18n/L';

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
    epithet: L('O falso 9 que ninguém sabia marcar', 'The false 9 nobody could mark'),
    era: '1992 – 1997',
    nationality: L('Brasil', 'Brazil'),
    signature: L('Bicampeão do Mundo · Tri da Libertadores · 1992 · 1993 · 1997', 'Two-time World Champion · Three-time Libertadores · 1992 · 1993 · 1997'),
    ovr: 95,
    quote: L('Três Libertadores. Poucos brasileiros podem dizer isso.', 'Three Libertadores. Few Brazilians can say that.'),
    photoUrl: '/legends/palhinha.png',
    trajectory: [
      { year: 1992, text: L('Chega do América-MG e fatura Paulista, Libertadores e Mundial no São Paulo', 'Arrives from América-MG and wins the Paulista, Libertadores and Intercontinental Cup with São Paulo') },
      { year: 1993, text: L('Bicampeão do Mundo e Supercopa — dois golaços em Chilavert no mesmo jogo', 'World Champion again and Supercopa — two stunners past Chilavert in the same game') },
      { year: 1997, text: L('Tricampeão da Libertadores, agora de azul pelo Cruzeiro', 'Third Libertadores, now in blue for Cruzeiro') },
    ],
    dna: [
      { label: L('PASSE', 'PASSING'), value: 96 },
      { label: L('DRIBLE', 'DRIBBLING'), value: 92 },
      { label: L('FINALIZAÇÃO', 'FINISHING'), value: 86 },
      { label: L('VELOCIDADE', 'PACE'), value: 86 },
      { label: L('TÁTICO', 'TACTICAL'), value: 96 },
      { label: L('MENTALIDADE', 'MENTALITY'), value: 96 },
    ],
    achievements: [
      { value: '71', label: L('Gols pelo São Paulo', 'Goals for São Paulo') },
      { value: '2×', label: L('Mundial (92·93)', 'World title (92·93)') },
      { value: '3×', label: 'Libertadores' },
      { value: '95', label: L('OVR no auge', 'Peak OVR') },
    ],
    storeHighlightId: 'legacy-palhinha',
    og: {
      title: L('PALHINHA · Bicampeão do Mundo — Olefoot Legends', 'PALHINHA · Two-time World Champion — Olefoot Legends'),
      description:
        L('Treina com Palhinha no Olefoot. Jorge Ferreira da Silva — bicampeão do mundo (92·93), tricampeão da Libertadores, OVR 95 no museu vivo.', 'Train with Palhinha on Olefoot. Jorge Ferreira da Silva — two-time world champion (92·93), three-time Libertadores winner, OVR 95 in the living museum.'),
    },
  },

  goncalves: {
    slug: 'goncalves',
    name: 'GONÇALVES',
    fullName: 'Marcelo Gonçalves Costa Lopes',
    epithet: L('A leitura tática que carregou o Brasil', 'The tactical reading that carried Brazil'),
    era: '1990 – 1998',
    nationality: L('Brasil', 'Brazil'),
    signature: L('Vice-Campeão do Mundo · Campeão da Copa América · 1995 · 1998', 'World Cup Runner-up · Copa América Champion · 1995 · 1998'),
    ovr: 84,
    quote: L('Formou a dupla de zaga que matou o jejum de 27 anos do fogão.', 'Part of the centre-back pair that ended Botafogo\'s 27-year drought.'),
    photoUrl: 'https://maroon-improved-loon-313.mypinata.cloud/ipfs/bafybeihjtvglafhzzwkujdw3pqyr7tstl7f4qtbcmnsty64kidmzkwgcry/gonca-certo-br.png',
    trajectory: [
      { year: 1993, text: L('Bicampeão mexicano — o zagueiro do passe rasteiro atravessa a fronteira', 'Two-time Mexican champion — the ball-playing centre-back crosses the border') },
      { year: 1995, text: L('Campeão Brasileiro — pilar da defesa que matou um jejum de 27 anos', 'Brazilian Champion — pillar of the defence that ended a 27-year drought') },
      { year: 1998, text: L('Titular na Copa América campeã e vice-campeão do Mundo com o Brasil', 'Starter in the Copa América win and World Cup runner-up with Brazil') },
    ],
    dna: [
      { label: L('MARCAÇÃO', 'MARKING'), value: 86 },
      { label: L('TÁTICO', 'TACTICAL'), value: 92 },
      { label: L('MENTALIDADE', 'MENTALITY'), value: 93 },
      { label: L('PASSE', 'PASSING'), value: 78 },
      { label: L('FÍSICO', 'PHYSICAL'), value: 76 },
      { label: 'FAIR PLAY', value: 91 },
    ],
    achievements: [
      { value: '1998', label: L('Vice do Mundo', 'World Cup runner-up') },
      { value: '1×', label: 'Copa América' },
      { value: '1995', label: 'Brasileirão' },
      { value: '84', label: L('OVR no auge', 'Peak OVR') },
    ],
    storeHighlightId: 'legacy-goncalves',
    og: {
      title: L('GONÇALVES · O Zagueiro do Brasil — Olefoot Legends', 'GONÇALVES · Brazil\'s Centre-back — Olefoot Legends'),
      description:
        L('Treina com Marcelo Gonçalves no Olefoot. Zagueiro vice-campeão do Mundo em 98 e campeão da Copa América — a leitura tática que carregou o Brasil.', 'Train with Marcelo Gonçalves on Olefoot. World Cup runner-up centre-back in 98 and Copa América champion — the tactical reading that carried Brazil.'),
    },
  },

  adauto: {
    slug: 'adauto',
    name: 'ADAUTO',
    fullName: 'Adauto Evandro da Silva',
    epithet: L('Símbolo além do gol', 'A symbol beyond goals'),
    era: '1999 – 2006',
    nationality: L('Brasil', 'Brazil'),
    signature: L('Artilheiro · Símbolo do Slavia Praha · 2000 · 2002 · 2006', 'Top scorer · Slavia Praha icon · 2000 · 2002 · 2006'),
    ovr: 88,
    quote: L('Brasileiro no Eden. Voz no debate. Símbolo além do gol.', 'A Brazilian at the Eden. A voice in the debate. A symbol beyond goals.'),
    photoUrl: '/legends/adauto.png',
    trajectory: [
      { year: 2000, text: L('8 gols em 7 jogos na Copa SP — o Santo André acreditou antes do país', '8 goals in 7 games at the Copa SP — Santo André believed before the country did') },
      { year: 2002, text: L('Três gols no Olímpico e a Copa Sul-Minas pelo Atlético-PR', 'Three goals at the Olímpico and the Copa Sul-Minas with Atlético-PR') },
      { year: 2006, text: L('78 jogos, 19 gols e uma voz no Slavia Praha — símbolo além do gol', '78 games, 19 goals and a voice at Slavia Praha — a symbol beyond goals') },
    ],
    dna: [
      { label: L('FINALIZAÇÃO', 'FINISHING'), value: 89 },
      { label: L('DRIBLE', 'DRIBBLING'), value: 86 },
      { label: L('VELOCIDADE', 'PACE'), value: 82 },
      { label: L('TÁTICO', 'TACTICAL'), value: 90 },
      { label: L('MENTALIDADE', 'MENTALITY'), value: 96 },
      { label: L('CONFIANÇA', 'CONFIDENCE'), value: 95 },
    ],
    achievements: [
      { value: '19', label: L('Gols no Slavia', 'Goals for Slavia') },
      { value: '8', label: L('Gols em 7 jogos (Copa SP)', 'Goals in 7 games (Copa SP)') },
      { value: '2002', label: 'Copa Sul-Minas' },
      { value: '88', label: L('OVR no auge', 'Peak OVR') },
    ],
    storeHighlightId: 'legacy-adauto',
    og: {
      title: L('ADAUTO · Símbolo do Slavia Praha — Olefoot Legends', 'ADAUTO · Slavia Praha Icon — Olefoot Legends'),
      description:
        L('Treina com Adauto no Olefoot. Artilheiro brasileiro no Eden, símbolo além do gol — 19 gols pelo Slavia Praha, OVR 88 no museu vivo.', 'Train with Adauto on Olefoot. Brazilian goalscorer at the Eden, a symbol beyond goals — 19 goals for Slavia Praha, OVR 88 in the living museum.'),
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

/**
 * QUEM É A OLEFOOT — conteúdo institucional do guia.
 *
 * ── DE ONDE VEIO ────────────────────────────────────────────────────────────
 * Extraído do "OLEFOOT PITCH DECK (GITEX 2025)", 10 páginas, em inglês.
 * Traduzido e ENCURTADO: o deck é para investidor, esta página é para um
 * moleque de 15 anos e o pai dele. Nada aqui foi inventado — cada número tem
 * página de origem anotada.
 *
 * ── O QUE FICOU DE FORA, DE PROPÓSITO ───────────────────────────────────────
 * O deck é construído sobre NFT, tokenização, blockchain, micro-investidores e
 * divisão de receita ("atleta até 50%"). Nada disso entra aqui, por dois
 * motivos que se somam:
 *
 *   1. O PRODUTO MUDOU. Em 2026-08-01 o jogo teve a rentabilidade expurgada —
 *      saíram OLEXP, GAT, HODL e ganho diário. Não há nada on-chain no projeto
 *      hoje. Repetir o deck seria descrever um produto que não existe mais.
 *   2. O PÚBLICO É OUTRO. Esta página fala com atleta de base e com a família
 *      dele. "Vire um ativo digital e ganhe 50% das vendas" numa página que
 *      mostra menores de idade é exatamente a leitura que o expurgo removeu.
 *
 * O que sobra do deck é o que sustenta credibilidade e não promete dinheiro:
 * a data, o percurso, as pessoas e a tese dos 99%.
 */

/* ══ O que é ═══════════════════════════════════════════════════════════════ */

/** A tese, na frase do próprio deck (p.5, traduzida). */
export const TESE =
  'Jogamos pelo futuro, criando oportunidade para os 99% dos atletas que ficam de fora do jogo global.';

/** Números do problema — deck p.3. Cada um é uma estatística citada lá. */
export const O_PROBLEMA = [
  { valor: '1 em 7.000', onde: 'no Brasil', texto: 'jovens de base que chegam a profissional' },
  { valor: '0,012%', onde: 'na Inglaterra', texto: 'dos garotos de academia chegam à Premier League' },
  { valor: '1 em 6.000', onde: 'na Espanha', texto: 'alcançam a primeira divisão' },
];

/** A linha do tempo — deck p.2. */
export const HISTORIA = [
  {
    ano: '2018',
    titulo: 'A Olefoot nasce',
    texto:
      'Uma sport tech sul-americana com uma missão: mudar a forma como talento e torcida se encontram no futebol.',
  },
  {
    ano: '2019',
    titulo: 'O mundo olha',
    texto:
      'Finalista em competições de pitch no Brasil e na América do Sul, e no Smart Dubai Global Blockchain Challenge.',
  },
  {
    ano: '2020',
    titulo: 'O time cresce',
    texto:
      'Chegam André Figer e Diego Lugano — nomes que não entram num projeto qualquer.',
  },
  {
    ano: '2026',
    titulo: 'O REVELA abre',
    texto:
      'A vitrine onde qualquer atleta cria seu perfil de graça, é avaliado por um olheiro e vira carta jogável.',
  },
];

/** Meta declarada no deck (p.9). */
export const META_2030 = 'Uma comunidade global de mais de 1 milhão de pessoas até 2030.';

/* ══ O time ════════════════════════════════════════════════════════════════ */

export interface MembroDoTime {
  nome: string;
  papel: string;
  texto: string;
}

/**
 * As descrições de Figer e Lugano vêm do deck (p.2). A do fundador é a única
 * que não está lá — foi ele quem pediu para entrar, e o texto se limita ao que
 * o próprio deck sustenta: a empresa é de 2018.
 */
export const TIME: MembroDoTime[] = [
  {
    nome: 'André Figer',
    papel: 'Sócio',
    texto: 'Um dos nomes mais influentes do mundo dos negócios do futebol.',
  },
  {
    nome: 'Diego Lugano',
    papel: 'Embaixador',
    texto:
      'Zagueiro campeão pelo São Paulo e capitão da seleção uruguaia em duas Copas do Mundo.',
  },
  {
    nome: 'Jonhnes Carvalho',
    papel: 'Fundador',
    texto: 'Tocando a Olefoot desde 2018, do primeiro pitch à vitrine que está no ar.',
  },
];

/* ══ Imprensa e vídeo ══════════════════════════════════════════════════════ */

export interface Materia {
  veiculo: string;
  titulo: string;
  url: string;
}

/**
 * ⚠️ PREENCHER. As seções somem sozinhas enquanto estas listas estiverem
 * vazias — página com "em breve" é pior que página sem a seção.
 *
 * Basta colar aqui; não precisa mexer em layout nenhum.
 */
export const MATERIAS: Materia[] = [
  // { veiculo: 'Nome do veículo', titulo: 'Título da matéria', url: 'https://…' },
];

/**
 * O vídeo do fundador explicando a Olefoot. Aceita YouTube ou Vimeo — o
 * componente extrai o id e monta o embed sem cookie. Vazio = seção some.
 */
export const VIDEO_FUNDADOR = '';

/**
 * O vocabulário de posição do REVELA.
 *
 * O formulário antigo cuspia dez siglas secas em fila — GOL ZAG LE LD VOL MC
 * MEI PE PD ATA — e mandava o atleta se reconhecer ali. Quem joga sabe o que é
 * "MC"; quem está começando, nem sempre, e a diferença entre MC e MEI é
 * exatamente o tipo de coisa que faz alguém errar a própria ficha.
 *
 * Aqui a escolha vira duas perguntas fáceis: em que setor você joga, e em qual
 * posição dentro dele. O código gravado é o mesmo de sempre — a sigla é o que o
 * jogo entende (src/entities/ovrWeights.ts pondera o OVR por ela).
 */

export interface Posicao {
  /** Sigla canônica — é isto que vai pro banco. */
  code: string;
  nome: string;
  /** O que a posição faz, na língua de quem joga. */
  descricao: string;
}

export interface Setor {
  id: string;
  nome: string;
  posicoes: Posicao[];
}

export const SETORES: Setor[] = [
  {
    id: 'gol',
    nome: 'Gol',
    posicoes: [{ code: 'GOL', nome: 'Goleiro', descricao: 'Debaixo das traves' }],
  },
  {
    id: 'def',
    nome: 'Defesa',
    posicoes: [
      { code: 'ZAG', nome: 'Zagueiro', descricao: 'Miolo da defesa' },
      { code: 'LD', nome: 'Lateral-direito', descricao: 'Corredor da direita' },
      { code: 'LE', nome: 'Lateral-esquerdo', descricao: 'Corredor da esquerda' },
    ],
  },
  {
    id: 'mei',
    nome: 'Meio',
    posicoes: [
      { code: 'VOL', nome: 'Volante', descricao: 'Primeiro a marcar, sai jogando' },
      { code: 'MC', nome: 'Meio-campo', descricao: 'Liga a defesa ao ataque' },
      { code: 'MEI', nome: 'Meia-atacante', descricao: 'Último passe, chega na área' },
    ],
  },
  {
    id: 'ata',
    nome: 'Ataque',
    posicoes: [
      { code: 'PD', nome: 'Ponta-direita', descricao: 'Velocidade pela direita' },
      { code: 'PE', nome: 'Ponta-esquerda', descricao: 'Velocidade pela esquerda' },
      { code: 'ATA', nome: 'Centroavante', descricao: 'Referência na área' },
    ],
  },
];

const POR_CODIGO = new Map(
  SETORES.flatMap((s) => s.posicoes.map((p) => [p.code, { ...p, setor: s.id }])),
);

export function nomeDaPosicao(code: string): string {
  return POR_CODIGO.get(code.toUpperCase())?.nome ?? code;
}

export function setorDaPosicao(code: string): string | null {
  return POR_CODIGO.get(code.toUpperCase())?.setor ?? null;
}

/** Pé dominante — o RPC já aceitava e o formulário antigo nunca perguntou. */
export const PES = [
  { code: 'right', nome: 'Direito' },
  { code: 'left', nome: 'Esquerdo' },
  { code: 'both', nome: 'Os dois' },
] as const;

/** Categoria — a faixa em que o atleta compete hoje. */
export const CATEGORIAS = [
  { code: 'sub15', nome: 'Sub-15' },
  { code: 'sub20', nome: 'Sub-20' },
  { code: 'amador', nome: 'Amador' },
  { code: 'profissional', nome: 'Profissional' },
  { code: 'legend', nome: 'Legend' },
] as const;

/** Situação de jogo — onde a carreira está, não a idade. */
export const SITUACOES = [
  { code: 'escolinha', nome: 'Escolinha', descricao: 'Formação, base inicial' },
  { code: 'junior', nome: 'Júnior', descricao: 'Categoria de base de clube' },
  { code: 'profissional', nome: 'Profissional', descricao: 'Contrato profissional' },
  // Ex-atleta: entra pelo mesmo funil, mas NÃO está em atividade. É o que
  // separa "pode ser observado por clube" de "está aqui pelo legado" — e é a
  // situação que a vitrine precisa saber pra não anunciar disponibilidade que
  // não existe.
  { code: 'lenda', nome: 'Lenda', descricao: 'Ex-atleta, fora de atividade' },
] as const;

/** Situações em que o atleta está EM ATIVIDADE (logo, observável por clube). */
export const SITUACOES_EM_ATIVIDADE: readonly string[] = ['escolinha', 'junior', 'profissional'];

/** O atleta está disponível pra ser observado/contratado? */
export function estaEmAtividade(situacao: string | null | undefined): boolean {
  if (!situacao) return true; // sem informação, não afirma indisponibilidade
  return SITUACOES_EM_ATIVIDADE.includes(situacao);
}

/**
 * PLAYER DNA — como o atleta pensa.
 *
 * Treze situações. Nenhuma pergunta sobre ele, só sobre o que ele faria. O
 * resultado não é nota: é ARQUÉTIPO — uma identidade que ele quer postar.
 *
 * ── AS TRÊS REGRAS QUE CONSTROEM OS ITENS ───────────────────────────────────
 *
 * 1. TODA ALTERNATIVA TEM QUE SER UMA RESPOSTA QUE UM BOM JOGADOR DARIA.
 *    Se uma opção é obviamente a certa, o item não mede DNA — mede se o moleque
 *    sabe o que adulto quer ouvir. É por isso que não existe "você treina todo
 *    dia?" aqui: a resposta é sempre sim, e sempre inútil.
 *
 * 2. ESCOLHA FORÇADA, NUNCA ESCALA. "De 1 a 5, quão líder você é" mede
 *    autoestima. Situação com quatro saídas defensáveis mede PREFERÊNCIA — e
 *    preferência é exatamente o que arquétipo é.
 *
 * 3. A SITUAÇÃO TEM QUE SER A REALIDADE DELE. Treino às 7h, prova na escola,
 *    teste num clube longe. Não é final de Champions. Se ele não se reconhece na
 *    pergunta, responde o que imagina que um profissional responderia.
 *
 * ── A ARMADILHA DA CONTAGEM ─────────────────────────────────────────────────
 * Os traços NÃO aparecem o mesmo número de vezes: Construção cabe em quase toda
 * situação (10 itens), Disciplina em poucas (4). Contar escolha crua faria
 * praticamente todo mundo sair Construtor, e o arquétipo viraria enfeite. A
 * conta é `escolhas ÷ oportunidades` — ver `pontuarDna`. `scripts/test-revela-dna.ts`
 * prova isso com um caso onde a contagem crua daria o resultado errado.
 *
 * O PREÇO DISSO, assumido de olhos abertos: com 4 oportunidades, Disciplina é
 * volátil — quem cai nela três vezes sai Incansável. Dá pra amortecer com um
 * prior bayesiano, e não vale: amortecer também derrubaria quem marcou 4 de 4
 * pra uns 70, e num gerador de IDENTIDADE (que é o que isto é, não uma medida)
 * um traço no máximo tem que ler como máximo. Se um dia virar medida de
 * verdade, o conserto é aumentar as oportunidades, não maquiar a conta.
 */

export type TracoId =
  | 'lideranca'
  | 'construcao'
  | 'estrategia'
  | 'competitividade'
  | 'adaptacao'
  | 'decisao'
  | 'disciplina';

export interface Traco {
  id: TracoId;
  nome: string;
  /** Quando é o traço MAIS forte, vira o substantivo do arquétipo. */
  substantivo: string;
  /** Quando é o segundo, vira o adjetivo. */
  adjetivo: string;
  /** O que esse traço diz sobre ele, na língua de quem joga. */
  oQueDiz: string;
}

export const TRACOS: Traco[] = [
  {
    id: 'lideranca',
    nome: 'Liderança',
    substantivo: 'Líder',
    adjetivo: 'de comando',
    oQueDiz: 'puxa o time e assume o peso do lance',
  },
  {
    id: 'construcao',
    nome: 'Construção',
    substantivo: 'Construtor',
    adjetivo: 'construtor',
    oQueDiz: 'resolve conversando e organiza quem está do lado',
  },
  {
    id: 'estrategia',
    nome: 'Estratégia',
    substantivo: 'Estrategista',
    adjetivo: 'estrategista',
    oQueDiz: 'lê o jogo antes de agir',
  },
  {
    id: 'competitividade',
    nome: 'Competitividade',
    substantivo: 'Competidor',
    adjetivo: 'competitivo',
    oQueDiz: 'vai no duelo e não recua',
  },
  {
    id: 'adaptacao',
    nome: 'Adaptação',
    substantivo: 'Camaleão',
    adjetivo: 'camaleão',
    oQueDiz: 'se encaixa em qualquer cenário',
  },
  {
    id: 'decisao',
    nome: 'Decisão',
    substantivo: 'Resolvedor',
    adjetivo: 'resolvedor',
    oQueDiz: 'escolhe rápido e banca a escolha',
  },
  {
    id: 'disciplina',
    nome: 'Disciplina',
    substantivo: 'Incansável',
    adjetivo: 'incansável',
    oQueDiz: 'tem a rotina que sustenta o resto',
  },
];

export const TRACO_POR_ID = new Map(TRACOS.map((t) => [t.id, t]));

export interface AlternativaDna {
  texto: string;
  traco: TracoId;
}

export interface ItemDna {
  /** Estável — é a chave gravada no banco. Nunca renumerar. */
  id: string;
  bloco: 'jogo' | 'fora';
  situacao: string;
  alternativas: AlternativaDna[];
}

export const ITENS_DNA: ItemDna[] = [
  /* ══ Bloco A · dentro do jogo ═══════════════════════════════════════════ */
  {
    id: 'a1',
    bloco: 'jogo',
    situacao: 'Seu time está perdendo de 1 a 0. Faltam dez minutos.',
    alternativas: [
      { texto: 'Peço a bola e puxo o time', traco: 'lideranca' },
      { texto: 'Junto quem está perto e mudo a saída de bola', traco: 'construcao' },
      { texto: 'Procuro onde o adversário está cansado', traco: 'estrategia' },
      { texto: 'Acelero tudo e vou pra cima', traco: 'competitividade' },
    ],
  },
  {
    id: 'a2',
    bloco: 'jogo',
    situacao: 'Você recebe de costas, marcado, sem opção clara.',
    alternativas: [
      { texto: 'Protejo, giro e encaro o marcador', traco: 'competitividade' },
      { texto: 'Devolvo simples e me ofereço de novo', traco: 'construcao' },
      { texto: 'Antes de receber eu já sabia pra onde ia jogar', traco: 'decisao' },
      { texto: 'Chamo alguém pra vir me dar linha', traco: 'lideranca' },
    ],
  },
  {
    id: 'a3',
    bloco: 'jogo',
    situacao: 'O adversário está te ganhando na velocidade.',
    alternativas: [
      { texto: 'Mudo minha posição de partida pra sair na frente', traco: 'estrategia' },
      { texto: 'Aceito o duelo e vou de novo', traco: 'competitividade' },
      { texto: 'Peço ajuda e faço a dobra', traco: 'construcao' },
      { texto: 'Mudo meu jeito de marcar no meio do jogo', traco: 'adaptacao' },
    ],
  },
  {
    id: 'a4',
    bloco: 'jogo',
    situacao: 'Você errou um passe e virou gol do adversário.',
    alternativas: [
      { texto: 'Levanto a cabeça e cobro o próximo lance', traco: 'competitividade' },
      { texto: 'Falo com o time pra ninguém desmontar', traco: 'lideranca' },
      { texto: 'Já sei o que fazer diferente num lance parecido', traco: 'decisao' },
      { texto: 'Simplifico as próximas até recuperar o ritmo', traco: 'adaptacao' },
    ],
  },
  {
    id: 'a5',
    bloco: 'jogo',
    situacao: 'O treinador te escala numa posição que não é a sua.',
    alternativas: [
      { texto: 'Jogo e me viro — é jogo', traco: 'adaptacao' },
      { texto: 'Pergunto o que ele espera de mim ali', traco: 'construcao' },
      { texto: 'Vou provar que mereço voltar pra minha', traco: 'competitividade' },
      { texto: 'Estudo o que a posição pede antes de entrar', traco: 'estrategia' },
    ],
  },
  {
    id: 'a6',
    bloco: 'jogo',
    situacao: 'Falta perto da área. Dois querem bater — e você bate bem.',
    alternativas: [
      { texto: 'Bato. É minha responsabilidade', traco: 'lideranca' },
      { texto: 'Deixo com quem está mais confiante hoje', traco: 'construcao' },
      { texto: 'Olho o goleiro e a barreira antes de decidir', traco: 'estrategia' },
      { texto: 'Combino uma jogada ensaiada', traco: 'decisao' },
    ],
  },

  /* ══ Bloco B · fora do jogo ═════════════════════════════════════════════ */
  {
    id: 'b1',
    bloco: 'fora',
    situacao: 'Uma hora livre depois da escola.',
    alternativas: [
      { texto: 'Treino sozinho o que errei no último jogo', traco: 'disciplina' },
      { texto: 'Assisto jogo prestando atenção na movimentação', traco: 'estrategia' },
      { texto: 'Chamo a galera pra bater uma', traco: 'competitividade' },
      { texto: 'Descanso — amanhã o treino é forte', traco: 'decisao' },
    ],
  },
  {
    id: 'b2',
    bloco: 'fora',
    situacao: 'Semana de prova na escola e treino forte no clube.',
    alternativas: [
      { texto: 'Faço um horário e sigo', traco: 'disciplina' },
      { texto: 'Falo com o treinador e com o professor pra ajustar', traco: 'construcao' },
      { texto: 'Encaixo do jeito que der — sempre dá', traco: 'adaptacao' },
      { texto: 'Escolho o que é mais importante naquela semana', traco: 'decisao' },
    ],
  },
  {
    id: 'b3',
    bloco: 'fora',
    situacao: 'Chega um jogador novo e ninguém fala com ele.',
    alternativas: [
      { texto: 'Chamo pro meu lado', traco: 'lideranca' },
      { texto: 'Passo o que ele precisa saber do time', traco: 'construcao' },
      { texto: 'Vejo como ele joga antes', traco: 'estrategia' },
      { texto: 'Deixo ele achar o espaço dele — cada um tem seu tempo', traco: 'adaptacao' },
    ],
  },
  {
    id: 'b4',
    bloco: 'fora',
    situacao: 'Você ficou fora da relação do jogo.',
    alternativas: [
      { texto: 'Vou assistir e apoiar de fora', traco: 'lideranca' },
      { texto: 'Pergunto ao treinador o que preciso melhorar', traco: 'construcao' },
      { texto: 'Treino dobrado na semana', traco: 'disciplina' },
      { texto: 'Uso pra estudar o time de fora', traco: 'estrategia' },
    ],
  },
  {
    id: 'b5',
    bloco: 'fora',
    situacao: 'Teste num clube longe, na mesma semana de um jogo importante do seu time.',
    alternativas: [
      { texto: 'Vou no teste — oportunidade não espera', traco: 'decisao' },
      { texto: 'Converso antes com quem me orienta', traco: 'construcao' },
      { texto: 'Fico. Meu time conta comigo', traco: 'lideranca' },
      { texto: 'Tento os dois — dou um jeito', traco: 'adaptacao' },
    ],
  },
  {
    id: 'b6',
    bloco: 'fora',
    situacao: 'Como você prefere que te cobrem?',
    alternativas: [
      { texto: 'Direto, na hora, no olho', traco: 'competitividade' },
      { texto: 'Explicando o porquê', traco: 'construcao' },
      { texto: 'Depois, com calma, vendo o vídeo', traco: 'estrategia' },
      { texto: 'Do jeito que vier — eu absorvo', traco: 'adaptacao' },
    ],
  },
  {
    id: 'b7',
    bloco: 'fora',
    situacao: 'Você está com uma dor leve na véspera do jogo.',
    alternativas: [
      { texto: 'Aviso o treinador e trato — não escondo', traco: 'disciplina' },
      { texto: 'Jogo assim mesmo. O time precisa', traco: 'competitividade' },
      { texto: 'Faço um aquecimento diferente pra proteger', traco: 'estrategia' },
      { texto: 'Vejo como acordo no dia e decido', traco: 'decisao' },
    ],
  },
];

/** Item id → índice da alternativa escolhida. */
export type RespostasDna = Record<string, number>;

export interface ResultadoDna {
  /** 0–99 por traço, já normalizado por oportunidade. */
  tracos: Record<TracoId, number>;
  /** Traços em ordem decrescente. O topo dita o arquétipo. */
  ordem: TracoId[];
  /** "Líder Construtor". */
  arquetipo: string;
  /** A frase que vai no perfil, montada dos dois traços do topo. */
  frase: string;
}

/**
 * Quantas VEZES cada traço teve chance de ser escolhido — contando ITENS, não
 * alternativas: numa mesma situação o atleta escolhe uma coisa só, então um
 * traço que aparece duas vezes no mesmo item continua valendo uma chance.
 */
export function oportunidadesPorTraco(itens: ItemDna[] = ITENS_DNA): Record<TracoId, number> {
  const acc = Object.fromEntries(TRACOS.map((t) => [t.id, 0])) as Record<TracoId, number>;
  for (const item of itens) {
    for (const traco of new Set(item.alternativas.map((a) => a.traco))) {
      acc[traco] += 1;
    }
  }
  return acc;
}

/**
 * A CONTA. Percentual de aproveitamento por traço, não contagem crua.
 *
 * Empate no topo é resolvido pela ordem de `TRACOS` — determinística, pra que
 * o mesmo conjunto de respostas devolva sempre o mesmo arquétipo. Sem isso o
 * atleta veria o próprio arquétipo mudar entre um carregamento e outro.
 */
export function pontuarDna(respostas: RespostasDna, itens: ItemDna[] = ITENS_DNA): ResultadoDna {
  const oportunidades = oportunidadesPorTraco(itens);
  const escolhas = Object.fromEntries(TRACOS.map((t) => [t.id, 0])) as Record<TracoId, number>;

  for (const item of itens) {
    const i = respostas[item.id];
    const alt = typeof i === 'number' ? item.alternativas[i] : undefined;
    if (alt) escolhas[alt.traco] += 1;
  }

  const tracos = Object.fromEntries(
    TRACOS.map((t) => {
      const chances = oportunidades[t.id];
      const pct = chances > 0 ? Math.round((escolhas[t.id] / chances) * 99) : 0;
      return [t.id, pct];
    }),
  ) as Record<TracoId, number>;

  const ordem = TRACOS.map((t) => t.id).sort((a, b) => {
    const d = tracos[b] - tracos[a];
    if (d !== 0) return d;
    return TRACOS.findIndex((t) => t.id === a) - TRACOS.findIndex((t) => t.id === b);
  });

  const primeiro = TRACO_POR_ID.get(ordem[0])!;
  const segundo = TRACO_POR_ID.get(ordem[1])!;

  return {
    tracos,
    ordem,
    arquetipo: `${primeiro.substantivo} ${segundo.adjetivo}`,
    // DUAS FRASES, não uma emendada com "e": os dois textos já têm "e" dentro
    // ("puxa o time E assume o peso"), e juntar com mais um "e" produzia
    // "assume o peso do lance e lê o jogo" — que o leitor lê como uma coisa só.
    frase: `${capitalizar(primeiro.oQueDiz)}. ${capitalizar(segundo.oQueDiz)}.`,
  };
}

/** Quantos itens já foram respondidos — pra barra de progresso e pra validação. */
export function respondidas(respostas: RespostasDna, itens: ItemDna[] = ITENS_DNA): number {
  return itens.filter((i) => typeof respostas[i.id] === 'number').length;
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

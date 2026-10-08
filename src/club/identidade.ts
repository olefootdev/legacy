/**
 * IDENTIDADE DO CLUBE — o que o manager escolhe na fundação (onboarding
 * "Fundação do Clube", 2026-10-07) e o DNA que isso vira no motor.
 *
 * Régua: o que não chega ao motor é enfeite. Toda escolha de jogo (100 pontos,
 * estilo, técnico inspirador, time histórico, treino) empurra UM vetor só —
 * `DnaDoClube` — e é esse vetor que o Quick Plan (Python) consome. As escolhas
 * de cara (camisa, frase, país) ficam guardadas no clube e não mexem no jogo.
 *
 * Função pura, sem React/store: o mesmo cálculo serve ao onboarding (Prancheta
 * Viva), ao payload da partida e aos testes (`npm run test:identidade`).
 */
import type { FormationSchemeId } from '@/match-engine/types';

/** Os 6 atributos de jogo que recebem os 100 pontos (de 5 em 5). */
export type AtributoDeJogo = 'tatico' | 'fairplay' | 'criativo' | 'ataque' | 'defesa' | 'mentalidade';
export type PontosDeJogo = Record<AtributoDeJogo, number>;

export type EstiloDeJogo = 'posse' | 'reativo' | 'pressao' | 'longos' | 'defensivo' | 'liberdade';
export type TreinoDoClube = 'rigido' | 'flexivel' | 'tranquilo';
export type DisponibilidadeDoManager = 'diario' | 'semana3' | 'semana1';
export type PadraoDeCamisa = 'lisa' | 'listras' | 'horiz' | 'diagonal' | 'meio' | 'peito' | 'mangas' | 'gola';

/** Eixos do DNA, todos em 0–1; 0.5 = neutro (o motor não mexe em nada). */
export type EixoDna = 'posse' | 'pressao' | 'vertical' | 'criatividade' | 'solidez' | 'disciplina' | 'intensidade';
export type DnaDoClube = Record<EixoDna, number>;

export interface EstreiaDoClube {
  /** Seed do plano (determinística por clube: rejogar dá o mesmo jogo). */
  seed: string;
  adversario: { time: string; temporada: string; nome: string };
  placar: { casa: number; fora: number };
  /** Fidelidade 0–100: o quanto o time jogou como o manager pediu. */
  fidelidade: number;
  jogadoEm: string;
}

export interface IdentidadeDoClube {
  versao: 1;
  pontos: PontosDeJogo;
  formacao: FormationSchemeId;
  estilo: EstiloDeJogo;
  /** Chave de TECNICOS_INSPIRADORES, ou null se o manager pulou. */
  tecnico: string | null;
  /** Chave de TIMES_HISTORICOS + temporada, ou null. */
  historico: { time: string; temporada: string } | null;
  treino: TreinoDoClube;
  disponibilidade: DisponibilidadeDoManager;
  camisa: { padrao: PadraoDeCamisa; primaria: string; secundaria: string; calcao: string };
  /** Frase de guerra (até 100 caracteres) — aparece no túnel. */
  frase: string;
  /** Jogo da Fundação (Ato 5): o que o motor entregou contra o fantasma do time histórico. */
  estreia?: EstreiaDoClube;
  pais: string;
  estado: string | null;
  /** ISO — quando a fundação foi feita. */
  fundadoEm: string;
  /** Janela da Estreia (Fase 2): até quando a várzea compra jogador do pacote. */
  janelaAte?: string;
  /** Ids do pacote da fundação que a várzea pode comprar (nunca a Edição Fundação). */
  pacote?: string[];
}

export const EIXOS_DNA: readonly EixoDna[] = ['posse', 'pressao', 'vertical', 'criatividade', 'solidez', 'disciplina', 'intensidade'];
export const ATRIBUTOS_DE_JOGO: readonly AtributoDeJogo[] = ['tatico', 'fairplay', 'criativo', 'ataque', 'defesa', 'mentalidade'];
export const TOTAL_DE_PONTOS = 100;
export const PASSO_DE_PONTOS = 5;

type Empurrao = Partial<DnaDoClube>;

export const ESTILOS: Record<EstiloDeJogo, { nome: string; empurra: Empurrao }> = {
  posse: { nome: 'Posse de bola', empurra: { posse: 0.35, vertical: -0.1 } },
  reativo: { nome: 'Reativo', empurra: { solidez: 0.2, vertical: 0.25, posse: -0.25 } },
  pressao: { nome: 'Pressão alta', empurra: { pressao: 0.4, intensidade: 0.2 } },
  longos: { nome: 'Passes longos', empurra: { vertical: 0.35, posse: -0.15 } },
  defensivo: { nome: 'Defensivo', empurra: { solidez: 0.4, pressao: -0.15, vertical: -0.1 } },
  liberdade: { nome: 'Liberdade criativa', empurra: { criatividade: 0.4, disciplina: -0.1 } },
};

/** Técnicos reais (informação pública) e o conceito de jogo de cada um. */
export const TECNICOS_INSPIRADORES: Record<string, { nome: string; era: string; conceitos: string[]; empurra: Empurrao }> = {
  guardiola: { nome: 'Pep Guardiola', era: 'Barcelona 2008–12 · Manchester City', conceitos: ['posse', 'pressão pós-perda', 'jogo de posição'], empurra: { posse: 0.35, pressao: 0.25, criatividade: 0.1, vertical: -0.1 } },
  klopp: { nome: 'Jürgen Klopp', era: 'Dortmund · Liverpool 2015–24', conceitos: ['gegenpressing', 'transição vertical', 'intensidade'], empurra: { pressao: 0.4, intensidade: 0.3, vertical: 0.2, posse: -0.05 } },
  mourinho: { nome: 'José Mourinho', era: 'Porto 2004 · Inter 2010', conceitos: ['bloco baixo', 'contra-ataque', 'jogo grande'], empurra: { solidez: 0.35, vertical: 0.25, posse: -0.25, pressao: -0.1 } },
  cruyff: { nome: 'Johan Cruyff', era: 'Barcelona 1988–96', conceitos: ['futebol total', 'rotação', 'posse'], empurra: { posse: 0.3, criatividade: 0.25, pressao: 0.1 } },
  sacchi: { nome: 'Arrigo Sacchi', era: 'Milan 1987–91', conceitos: ['linha alta', 'pressão em bloco', 'zona'], empurra: { pressao: 0.35, solidez: 0.15, disciplina: 0.15 } },
  tele: { nome: 'Telê Santana', era: 'Seleção 1982 · São Paulo 1992', conceitos: ['futebol-arte', 'ataque', 'toque'], empurra: { criatividade: 0.35, posse: 0.15, vertical: 0.1 } },
  bielsa: { nome: 'Marcelo Bielsa', era: 'Argentina · Leeds', conceitos: ['marcação individual', 'intensidade', 'verticalidade'], empurra: { intensidade: 0.35, vertical: 0.25, pressao: 0.25, disciplina: -0.05 } },
  simeone: { nome: 'Diego Simeone', era: 'Atlético de Madrid 2011–', conceitos: ['bloco compacto', 'disciplina', 'luta'], empurra: { solidez: 0.4, disciplina: 0.2, intensidade: 0.15, posse: -0.25, criatividade: -0.1 } },
  ancelotti: { nome: 'Carlo Ancelotti', era: 'Milan · Real Madrid', conceitos: ['equilíbrio', 'liberdade aos craques', 'gestão'], empurra: { criatividade: 0.2, solidez: 0.1, posse: 0.1 } },
  tite: { nome: 'Tite', era: 'Corinthians 2012 · Seleção', conceitos: ['compactação', 'equilíbrio', 'transição'], empurra: { solidez: 0.25, disciplina: 0.2, vertical: 0.1 } },
};

/** Times históricos reais e o DNA de cada temporada. `forca` = rating do "fantasma". */
export const TIMES_HISTORICOS: Record<string, { nome: string; temporadas: Record<string, { empurra: Empurrao; forca: number }> }> = {
  barcelona: { nome: 'Barcelona', temporadas: {
    '2008–09': { empurra: { posse: 0.35, pressao: 0.25, criatividade: 0.2 }, forca: 91 },
    '2010–11': { empurra: { posse: 0.4, pressao: 0.3, criatividade: 0.2 }, forca: 93 },
    '2014–15': { empurra: { vertical: 0.3, criatividade: 0.3, posse: 0.15 }, forca: 91 },
  } },
  selecao: { nome: 'Seleção Brasileira', temporadas: {
    '1970': { empurra: { criatividade: 0.4, vertical: 0.2, posse: 0.15 }, forca: 94 },
    '1982': { empurra: { criatividade: 0.4, posse: 0.25, solidez: -0.1 }, forca: 90 },
    '2002': { empurra: { vertical: 0.3, criatividade: 0.25, solidez: 0.1 }, forca: 90 },
  } },
  saopaulo: { nome: 'São Paulo', temporadas: {
    '1992': { empurra: { criatividade: 0.3, posse: 0.2, intensidade: 0.1 }, forca: 89 },
    '2005': { empurra: { solidez: 0.3, disciplina: 0.15, vertical: 0.15 }, forca: 87 },
  } },
  flamengo: { nome: 'Flamengo', temporadas: {
    '1981': { empurra: { criatividade: 0.35, posse: 0.2, vertical: 0.1 }, forca: 90 },
    '2019': { empurra: { pressao: 0.3, vertical: 0.25, intensidade: 0.2 }, forca: 89 },
  } },
  milan: { nome: 'Milan', temporadas: {
    '1988–89': { empurra: { pressao: 0.35, solidez: 0.2, disciplina: 0.15 }, forca: 92 },
    '2006–07': { empurra: { solidez: 0.25, criatividade: 0.2, posse: 0.1 }, forca: 88 },
  } },
  holanda: { nome: 'Holanda', temporadas: { '1974': { empurra: { pressao: 0.35, posse: 0.25, criatividade: 0.2 }, forca: 91 } } },
  liverpool: { nome: 'Liverpool', temporadas: { '2019–20': { empurra: { pressao: 0.35, intensidade: 0.3, vertical: 0.25 }, forca: 91 } } },
  realmadrid: { nome: 'Real Madrid', temporadas: { '2016–17': { empurra: { vertical: 0.25, criatividade: 0.25, solidez: 0.1 }, forca: 91 } } },
  atletico: { nome: 'Atlético de Madrid', temporadas: { '2013–14': { empurra: { solidez: 0.4, disciplina: 0.2, intensidade: 0.2, posse: -0.2 }, forca: 88 } } },
  santos: { nome: 'Santos', temporadas: { '1962': { empurra: { criatividade: 0.4, vertical: 0.3 }, forca: 92 } } },
};

export const TREINOS: Record<TreinoDoClube, { nome: string; empurra: Empurrao }> = {
  rigido: { nome: 'Rígido', empurra: { disciplina: 0.2, intensidade: 0.15, criatividade: -0.05 } },
  flexivel: { nome: 'Flexível', empurra: {} },
  tranquilo: { nome: 'Tranquilo', empurra: { criatividade: 0.1, intensidade: -0.1 } },
};

/** Peso de cada fonte no DNA. Os 100 pontos são a base; o resto inclina. */
const PESO = { estilo: 1, tecnico: 0.8, historico: 0.6, treino: 1 } as const;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function dnaNeutro(): DnaDoClube {
  return { posse: 0.5, pressao: 0.5, vertical: 0.5, criatividade: 0.5, solidez: 0.5, disciplina: 0.5, intensidade: 0.5 };
}

/** Pontos válidos: múltiplos de 5, nenhum negativo, soma exatamente 100. */
export function pontosValidos(p: PontosDeJogo): boolean {
  let soma = 0;
  for (const k of ATRIBUTOS_DE_JOGO) {
    const v = p[k];
    if (!Number.isFinite(v) || v < 0 || v % PASSO_DE_PONTOS !== 0) return false;
    soma += v;
  }
  return soma === TOTAL_DE_PONTOS;
}

function empurrar(d: DnaDoClube, e: Empurrao | undefined, peso: number) {
  if (!e) return;
  for (const k of EIXOS_DNA) {
    const v = e[k];
    if (v) d[k] += v * peso;
  }
}

/**
 * As escolhas → DNA. Os 100 pontos montam a base (cada atributo vale ~1/35
 * por ponto, então 35 pontos num atributo já satura o eixo dele); estilo,
 * técnico, time histórico e treino inclinam. No fim o vetor é centrado
 * (`centrarDna`): o que importa é a FORMA do DNA, não o tamanho.
 */
export function dnaDaIdentidade(id: Pick<IdentidadeDoClube, 'pontos' | 'estilo' | 'tecnico' | 'historico' | 'treino'>): DnaDoClube {
  const n = (k: AtributoDeJogo) => (id.pontos[k] ?? 0) / 35;
  const d: DnaDoClube = {
    posse: n('tatico') * 0.5 + n('criativo') * 0.3,
    pressao: n('defesa') * 0.3 + n('mentalidade') * 0.3 + n('ataque') * 0.2,
    vertical: n('ataque') * 0.6,
    criatividade: n('criativo') * 0.9,
    solidez: n('defesa') * 0.7 + n('tatico') * 0.3,
    disciplina: n('fairplay') * 0.9 + 0.1,
    intensidade: n('mentalidade') * 0.6 + n('ataque') * 0.2,
  };
  empurrar(d, ESTILOS[id.estilo]?.empurra, PESO.estilo);
  if (id.tecnico) empurrar(d, TECNICOS_INSPIRADORES[id.tecnico]?.empurra, PESO.tecnico);
  if (id.historico) {
    const t = TIMES_HISTORICOS[id.historico.time]?.temporadas[id.historico.temporada];
    empurrar(d, t?.empurra, PESO.historico);
  }
  empurrar(d, TREINOS[id.treino]?.empurra, PESO.treino);
  return centrarDna(d);
}

/**
 * DNA é ORÇAMENTO: a média dos 7 eixos fica sempre em 0.5. Subir posse custa
 * em outro eixo — nenhum estilo é melhor que os outros, só diferente, e o
 * manager equilibrado joga neutro (igual a um clube antigo). O motor (Python)
 * aplica a mesma regra, então um pedido com tudo em 0.9 vira neutro lá também.
 * A forma sai comprimida pela metade (`FORMA_DO_DNA`) pra nenhum eixo bater no
 * teto e perder informação; o motor aplica o ganho (DNA_GANHO = 1.5) que foi
 * calibrado em 500 partidas por técnico (todos entre −1 e +8pp de um time sem DNA).
 */
const FORMA_DO_DNA = 0.5;

export function centrarDna(d: DnaDoClube): DnaDoClube {
  const media = EIXOS_DNA.reduce((s, k) => s + d[k], 0) / EIXOS_DNA.length;
  const out = dnaNeutro();
  for (const k of EIXOS_DNA) out[k] = Math.max(0.12, Math.min(0.88, 0.5 + (d[k] - media) * FORMA_DO_DNA));
  return out;
}

/**
 * DNA do FANTASMA de um time histórico (Jogo da Fundação). O time histórico é
 * o empurrão inteiro (peso 2 — é a identidade dele, não uma inspiração), sobre
 * o neutro, centrado pela mesma regra de orçamento. Desconhecido = null.
 */
export function dnaDoTimeHistorico(time: string, temporada: string): DnaDoClube | null {
  const t = TIMES_HISTORICOS[time]?.temporadas[temporada];
  if (!t) return null;
  const d = dnaNeutro();
  empurrar(d, t.empurra, 2);
  return dnaParaMotor(centrarDna(d));
}

/** Payload do DNA pro motor: 3 casas, só os eixos conhecidos (vira chave de cache). */
export function dnaParaMotor(d: DnaDoClube): DnaDoClube {
  const out = dnaNeutro();
  for (const k of EIXOS_DNA) out[k] = Math.round(clamp01(d[k]) * 1000) / 1000;
  return out;
}

/** DNA do clube pronto pro motor, ou null se ele ainda não foi fundado. */
export function dnaDoClubeParaMotor(identidade: IdentidadeDoClube | null | undefined): DnaDoClube | null {
  if (!identidade || !pontosValidos(identidade.pontos)) return null;
  return dnaParaMotor(dnaDaIdentidade(identidade));
}

/**
 * Conflito entre escolhas (ex.: Mourinho reativo + posse de bola). Não bloqueia:
 * o DNA já faz a média; isto só explica ao manager por que o time vai ao meio.
 */
export function conflitoDeEscolhas(id: Pick<IdentidadeDoClube, 'pontos' | 'estilo' | 'tecnico'>): string | null {
  const t = id.tecnico ? TECNICOS_INSPIRADORES[id.tecnico] : null;
  if (t && id.estilo === 'posse' && (id.tecnico === 'mourinho' || id.tecnico === 'simeone')) {
    return `${t.nome} é reativo e o estilo pede posse. O DNA vai puxar pro meio-termo.`;
  }
  if (t && id.estilo === 'defensivo' && (id.tecnico === 'klopp' || id.tecnico === 'cruyff' || id.tecnico === 'tele')) {
    return `Defensivo com ${t.nome}? A inspiração empurra pra frente, o estilo segura.`;
  }
  if (id.estilo === 'pressao' && id.pontos.mentalidade + id.pontos.ataque < 25) {
    return 'Pressão alta pede fôlego: pouca mentalidade e ataque pra sustentar.';
  }
  if (id.estilo === 'liberdade' && id.pontos.tatico >= 35) {
    return 'Muita tática com liberdade criativa: o time vai pensar demais.';
  }
  return null;
}

/**
 * A fala do Coach na fundação: o ponto forte e o ponto fraco do DNA atual,
 * ou o conflito entre escolhas quando houver. Uma frase, na voz do jogo.
 */
export function falaDoCoach(
  id: Pick<IdentidadeDoClube, 'pontos' | 'estilo' | 'tecnico' | 'historico' | 'treino'>,
  L: (pt: string, en: string) => string,
): { texto: string; alerta: boolean } {
  const c = conflitoDeEscolhas(id);
  if (c) return { texto: c, alerta: true };
  const d = dnaDaIdentidade(id);
  const ordem = [...EIXOS_DNA].sort((a, b) => d[b] - d[a]);
  const forte: Record<EixoDna, string> = {
    posse: L('Vai rodar a bola até abrir.', 'It will move the ball until a gap opens.'),
    pressao: L('Vai sufocar a saída deles.', "It will choke their build-up."),
    vertical: L('Bola recuperada é bola na área.', 'A won ball goes straight to the box.'),
    criatividade: L('Os craques vão ter licença pra inventar.', 'Your stars get license to invent.'),
    solidez: L('Vai ser difícil fazer gol na gente.', "We'll be hard to score against."),
    disciplina: L('Time limpo, cartão vai ser raro.', 'A clean side — cards will be rare.'),
    intensidade: L('Ninguém para de correr.', 'Nobody stops running.'),
  };
  const fraco: Record<EixoDna, string> = {
    posse: L('Mas a bola vai queimar no pé.', 'But the ball will burn in their feet.'),
    pressao: L('Mas o rival vai sair jogando.', 'But the rival will play out freely.'),
    vertical: L('Mas vai faltar profundidade.', 'But depth will be missing.'),
    criatividade: L('Mas falta quem invente.', 'But nobody will invent.'),
    solidez: L('Mas vai sobrar espaço atrás.', 'But there will be space behind.'),
    disciplina: L('Mas cuidado com os cartões.', 'But watch the cards.'),
    intensidade: L('Mas o fôlego acaba no fim.', 'But legs go late on.'),
  };
  return { texto: `${forte[ordem[0]!]} ${fraco[ordem[ordem.length - 1]!]}`, alerta: false };
}

/** "Monta pra mim": uma identidade coerente a partir do time de coração. */
export function identidadeSugerida(coracao: string | null | undefined): Pick<IdentidadeDoClube, 'pontos' | 'estilo' | 'tecnico' | 'historico' | 'treino'> {
  const P = (tatico: number, fairplay: number, criativo: number, ataque: number, defesa: number, mentalidade: number): PontosDeJogo =>
    ({ tatico, fairplay, criativo, ataque, defesa, mentalidade });
  const nome = (coracao ?? '').toLowerCase();
  if (nome.includes('flamengo')) return { pontos: P(15, 10, 25, 25, 10, 15), estilo: 'pressao', tecnico: 'klopp', historico: { time: 'flamengo', temporada: '2019' }, treino: 'rigido' };
  if (nome.includes('são paulo') || nome.includes('sao paulo')) return { pontos: P(20, 10, 25, 20, 10, 15), estilo: 'posse', tecnico: 'tele', historico: { time: 'saopaulo', temporada: '1992' }, treino: 'flexivel' };
  if (nome.includes('santos')) return { pontos: P(10, 10, 35, 25, 10, 10), estilo: 'liberdade', tecnico: 'tele', historico: { time: 'santos', temporada: '1962' }, treino: 'tranquilo' };
  if (nome.includes('corinthians')) return { pontos: P(25, 15, 10, 10, 25, 15), estilo: 'defensivo', tecnico: 'tite', historico: { time: 'selecao', temporada: '2002' }, treino: 'rigido' };
  if (nome.includes('palmeiras')) return { pontos: P(25, 10, 10, 15, 25, 15), estilo: 'reativo', tecnico: 'mourinho', historico: { time: 'atletico', temporada: '2013–14' }, treino: 'rigido' };
  if (nome.includes('barcelona')) return { pontos: P(25, 15, 25, 15, 10, 10), estilo: 'posse', tecnico: 'guardiola', historico: { time: 'barcelona', temporada: '2010–11' }, treino: 'flexivel' };
  if (nome.includes('liverpool')) return { pontos: P(15, 10, 15, 25, 15, 20), estilo: 'pressao', tecnico: 'klopp', historico: { time: 'liverpool', temporada: '2019–20' }, treino: 'rigido' };
  if (nome.includes('real madrid')) return { pontos: P(15, 10, 25, 25, 15, 10), estilo: 'liberdade', tecnico: 'ancelotti', historico: { time: 'realmadrid', temporada: '2016–17' }, treino: 'flexivel' };
  if (nome.includes('milan')) return { pontos: P(25, 15, 10, 15, 20, 15), estilo: 'pressao', tecnico: 'sacchi', historico: { time: 'milan', temporada: '1988–89' }, treino: 'rigido' };
  if (nome.includes('seleção') || nome.includes('selecao')) return { pontos: P(15, 10, 30, 25, 10, 10), estilo: 'liberdade', tecnico: 'tele', historico: { time: 'selecao', temporada: '1970' }, treino: 'flexivel' };
  return { pontos: P(20, 15, 15, 15, 20, 15), estilo: 'pressao', tecnico: 'sacchi', historico: { time: 'milan', temporada: '1988–89' }, treino: 'flexivel' };
}

/** Ganho que o motor aplica sobre a forma enviada (smartfield DNA_GANHO, _dnaModel DNA_GANHO). */
export const DNA_GANHO_DO_MOTOR = 1.5;

/** O DNA como o MOTOR o usa (forma × ganho, teto 0.12–0.88) — é o que a Prancheta desenha. */
export function dnaEfetivo(d: DnaDoClube): DnaDoClube {
  const media = EIXOS_DNA.reduce((s, k) => s + d[k], 0) / EIXOS_DNA.length;
  const out = dnaNeutro();
  for (const k of EIXOS_DNA) out[k] = Math.max(0.12, Math.min(0.88, 0.5 + (d[k] - media) * DNA_GANHO_DO_MOTOR));
  return out;
}

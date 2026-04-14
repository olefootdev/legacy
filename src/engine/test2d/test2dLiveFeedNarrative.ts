/**
 * Narração rica e variada só para ao vivo 2D (`test2d`): mesmos eventos, texto menos repetitivo.
 * Chaves estáveis → mesmo lance = mesma frase (replays / sync).
 */

function fnv1a32(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function pickLine(key: string, lines: readonly string[]): string {
  if (lines.length === 0) return '';
  return lines[fnv1a32(key) % lines.length]!;
}

export type Test2dTurnoverTag = 'recuperação' | 'interceptação' | 'desarme' | 'perda';

const PASS_AFTER: Record<Test2dTurnoverTag, readonly string[]> = {
  recuperação: [
    'Primeiro toque limpo — a equipa respira e sai a jogar.',
    'Toque curto a reorganizar; o ritmo volta ao normal.',
    'Bola quente, cabeça fria: entrega segura depois da recuperação.',
    'Liberta pressão com um passe simples e inteligente.',
    'Muda o chip: circulação rápida no meio.',
    'Sai a jogar pela linha, sem complicar.',
    'A posse é vossa — passe a desbloquear o corredor.',
    'Toque de qualidade a segurar o momentum.',
  ],
  interceptação: [
    'Leitura defensiva — e já há resposta com bola nos pés.',
    'Corta o passe e logo entrega: transição nascida na pressão.',
    'Antecipação cruel; a seguir toque a arrancar o contra-ataque.',
    'Rouba a ideia ao adversário e devolve com classe.',
    'Interceptação que vira arranque — passe imediato.',
    'Bola recuperada no timing perfeito; toque a abrir o jogo.',
    'Lê a linha de passe e castiga com um toque certeiro.',
    'Corta, respira, entrega: futebol de alto nível.',
  ],
  desarme: [
    'Desarme limpo — a equipa assume o comando com um toque assertivo.',
    'Ganha o duelo e já pensa na frente: passe a descomprimir.',
    'Recuperação física; técnica a responder com um passe seguro.',
    'Tira a bola com força e devolve com critério.',
    'Duplo esforço: desarme e primeira saída com qualidade.',
    'A pressão morre aqui — passe a virar a página.',
    'Corpo bem posto, bola recuperada, toque a libertar.',
    'Trabalho sujo feito; agora é futebol de toques.',
  ],
  perda: [
    'Erro anulado no instante — toque a repor confiança.',
    'Cai, levanta, entrega: reação de campeão.',
    'Perda dolorosa, mas a resposta vem logo no passe.',
    'Tira o peso do erro com um toque simples e certo.',
    'Recomeço imediato — bola a circular de novo.',
    'Mentalidade: perdeu, recuperou, já joga à frente.',
    'Apaga o risco com um passe curto e seguro.',
    'Volta ao trilho com um toque de mestre.',
  ],
};

const CARRY_AFTER: Record<Test2dTurnoverTag, readonly string[]> = {
  recuperação: [
    'Encosta o corpo e conduz — espaço a abrir-se à frente.',
    'Arranca com a bola colada ao pé; o bloco sobe consigo.',
    'Primeiro impulso com drible; adversário a recuar.',
    'Condução agressiva a dar oxigénio ao ataque.',
    'Carrega a bola como quem carrega o ritmo do jogo.',
    'Drible de saída — linha ultrapassada sem pedir licença.',
    'Acelera o pulso com uma condução vertical.',
    'Pé quente, cabeça fria: progressão em condução.',
  ],
  interceptação: [
    'Rouba e já desafia na condução — transição viva.',
    'Intercepta e explode em velocidade com a bola.',
    'Corta o passe e arranca em modo “eu resolvo”.',
    'Leitura + arranque: condução a castigar o desequilíbrio.',
    'Bola recuperada e logo a picar à frente.',
    'Do ladrão ao artista — condução a deixar marcas.',
    'Pressão convertida em metros ganhos com drible.',
    'Transição express: bola colada, olhos na baliza.',
  ],
  desarme: [
    'Ganha o corpo e conduz para território seguro.',
    'Desarme e já a progredir com a bola dominada.',
    'Fisicalidade e técnica: carrega a bola para fora da confusão.',
    'Tira da zona quente com uma condução inteligente.',
    'Duelo ganho — metros conquistados em drible.',
    'Cola a bola ao pé e afasta o perigo a correr.',
    'Resposta de líder: condução a dar exemplo.',
    'Do desarme ao drible — sequência de classe.',
  ],
  perda: [
    'Erro esquecido em segundos — condução a devolver autoridade.',
    'Perdeu, recuperou, já desafia na carreira.',
    'Resposta imediata com drible e coragem.',
    'Apaga o susto com uma condução objectiva.',
    'Volta à carga com a bola nos pés e a moral alta.',
    'Reação de campeão: condução a mudar o filme.',
    'Tira o foco do erro com progressão em drible.',
    'Muda o rumo com uma arrancada técnica.',
  ],
};

const INTERCEPT_CUT: readonly string[] = [
  'Interceptação — linha de passe cortada com agressividade.',
  'Leitura defensiva de manual: o passe não passa.',
  'Antecipação perfeita; a bola muda de dono.',
  'Corta o passe como quem corta o fio da meada.',
  'Pressão alta a dar frutos — interceptação seca.',
  'O adversário pensava que era passe; era armadilha.',
  'Corta na fonte — transição defensiva com pitada.',
];

const SHOT_WINDUP: readonly string[] = [
  'Remate de {who}!',
  '{who} arrisca o disparo!',
  'Bola para a baliza — tentativa de {who}!',
  '{who} solta o pé — remate!',
  'Disparo carregado de {who}!',
  '{who} à procura do golo!',
];

const GK_FROM_SHOT_DEFENSE: readonly string[] = [
  'Defesa — bola colada ao GR ({reason}).',
  'Guarda-redes segura o contacto ({reason}).',
  'GR a dominar a situação ({reason}).',
  'Defesa segura; bola nas mãos do GR ({reason}).',
];

const GK_FROM_SHOT_ATTACK: readonly string[] = [
  'Remate — bola com o GR ({reason}).',
  'Tentativa parada; guarda-redes com a bola ({reason}).',
  'GR a encaixar depois do remate ({reason}).',
  'Bola neutralizada pelo GR ({reason}).',
];

const MISS_POWER: readonly string[] = [
  'Remate forte para fora.',
  'Disparo potente — falha o alvo por centímetros largos.',
  'Pé bem pendurado, mas a bola foge à baliza.',
  'Tiro carregado que não encontra a moldura.',
];

const MISS_WEAK: readonly string[] = [
  'Remate fraco — longe da baliza.',
  'Toque timido; o GR nem precisa de brilhar.',
  'Disparo sem convicção; bola a morrer ao lado.',
  'Remate a pedir mais força — não chega.',
];

const MISS_PLACED: readonly string[] = [
  'Remate ao lado.',
  'Colocação bonita, mas a baliza escapa.',
  'Tenta o canto — a bola raspa fora.',
  'Remate estudado que não entra na história.',
];

/** Linha completa `NN' — …` */
export function test2dPassAfterTurnoverLine(
  minute: number,
  tag: Test2dTurnoverTag,
  varietyKey: string,
): string {
  const body = pickLine(`${minute}|pass|${tag}|${varietyKey}`, PASS_AFTER[tag]);
  return `${minute}' — ${body}`;
}

export function test2dCarryAfterTurnoverLine(
  minute: number,
  tag: Test2dTurnoverTag,
  varietyKey: string,
): string {
  const body = pickLine(`${minute}|carry|${tag}|${varietyKey}`, CARRY_AFTER[tag]);
  return `${minute}' — ${body}`;
}

export function test2dInterceptCutPassLine(minute: number, varietyKey: string): string {
  const body = pickLine(`${minute}|intercept|${varietyKey}`, INTERCEPT_CUT);
  return `${minute}' — ${body}`;
}

export function test2dShotWindupLine(minute: number, who: string, varietyKey: string): string {
  const tpl = pickLine(`${minute}|shot|${who}|${varietyKey}`, SHOT_WINDUP);
  return `${minute}' — ${tpl.replaceAll('{who}', who)}`;
}

export function test2dGkBallFromShotLine(
  minute: number,
  defenseFraming: boolean,
  reason: string,
  varietyKey: string,
): string {
  const pool = defenseFraming ? GK_FROM_SHOT_DEFENSE : GK_FROM_SHOT_ATTACK;
  const tpl = pickLine(`${minute}|gkshot|${defenseFraming}|${reason}|${varietyKey}`, pool);
  return `${minute}' — ${tpl.replaceAll('{reason}', reason)}`;
}

export function test2dShotMissDetailLine(
  minute: number,
  strike: 'power' | 'weak' | 'placed',
  varietyKey: string,
): string {
  const pool = strike === 'power' ? MISS_POWER : strike === 'weak' ? MISS_WEAK : MISS_PLACED;
  const body = pickLine(`${minute}|miss|${strike}|${varietyKey}`, pool);
  return `${minute}' — ${body}`;
}

const PASS_INCOMPLETE: readonly string[] = [
  'Passe incompleto — leitura da linha a falhar por um segundo.',
  'Bola a pedir mais precisão; o toque não chega ao destino.',
  'Pressão a condenar o passe: bola solta.',
  'Técnica a falhar no timing — perda de posse iminente.',
  'O colega abria linha, mas o passe não acompanhou a ideia.',
  'Erro de execução: o adversário chega primeiro à segunda bola.',
];

const RECEPTION_FUMBLE: readonly string[] = [
  'Má recepção — bola escapa, tudo a recomeçar.',
  'Primeiro toque a falhar; o ritmo quebra-se.',
  'Bola quente demais para o pé — perda de controlo.',
  'Recepção a pedir mais treino; a equipa perde o compasso.',
  'Toque de preparação fraco; o bloco adversário reage.',
];

const DRIBBLE_STRIPPED: readonly string[] = [
  'Drible falhado — marcador ganha o duelo e a bola.',
  'Quis emendar sozinho; o adversário leu e cortou.',
  'Excesso de confiança na condução — bola roubada.',
  'Um-para-um perdido; a defesa impõe-se.',
];

const DRIBBLE_LOOSE: readonly string[] = [
  'Drible travado — bola fica viva entre as linhas.',
  'Perde o equilíbrio na condução; a bola solta-se.',
  'Pressão em cima; a condução não aguenta o contacto.',
];

const CROSS_FAIL: readonly string[] = [
  'Cruzamento bloqueado na origem — bola não passa.',
  'Linha de cruzamento cortada; a defesa fecha o corredor.',
  'Centro a falhar: timing ou espaço a faltar.',
];

const PASS_SOLID: readonly string[] = [
  'Passe limpo a manter o bloco ligado.',
  'Circulação inteligente — pressão a arrefecer.',
  'Toque certeiro a abrir ângulo novo.',
  'Boa decisão: entrega simples no pé certo.',
  'Passe a dar fluidez ao último terço.',
];

export function test2dPassIncompleteLine(minute: number, varietyKey: string): string {
  const body = pickLine(`${minute}|passinc|${varietyKey}`, PASS_INCOMPLETE);
  return `${minute}' — ${body}`;
}

export function test2dReceptionFumbleLine(minute: number, varietyKey: string): string {
  const body = pickLine(`${minute}|fumble|${varietyKey}`, RECEPTION_FUMBLE);
  return `${minute}' — ${body}`;
}

export function test2dDribbleStrippedLine(minute: number, varietyKey: string): string {
  const body = pickLine(`${minute}|dribstrip|${varietyKey}`, DRIBBLE_STRIPPED);
  return `${minute}' — ${body}`;
}

export function test2dDribbleLooseLine(minute: number, varietyKey: string): string {
  const body = pickLine(`${minute}|dribloose|${varietyKey}`, DRIBBLE_LOOSE);
  return `${minute}' — ${body}`;
}

export function test2dCrossFailLine(minute: number, varietyKey: string): string {
  const body = pickLine(`${minute}|crossfail|${varietyKey}`, CROSS_FAIL);
  return `${minute}' — ${body}`;
}

export function test2dPassSolidLine(minute: number, varietyKey: string): string {
  const body = pickLine(`${minute}|passsolid|${varietyKey}`, PASS_SOLID);
  return `${minute}' — ${body}`;
}

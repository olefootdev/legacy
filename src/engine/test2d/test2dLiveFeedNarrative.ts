/**
 * Narração rica e variada só para ao vivo 2D (`test2d`): mesmos eventos, texto menos repetitivo.
 * Chaves estáveis → mesmo lance = mesma frase (replays / sync).
 */

import { emIngles } from '@/i18n/L';

const EN = emIngles();

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

// ── EN (mesmos tamanhos e ordem dos pools PT) ──
const PASS_AFTER_EN: Record<Test2dTurnoverTag, readonly string[]> = {
  recuperação: [
    'Clean first touch — the team breathes and plays out.',
    'Short touch to reset; the rhythm is back.',
    'Hot ball, cool head: safe pass after the recovery.',
    'Releases the pressure with a simple, smart pass.',
    'Switches gear: quick circulation in midfield.',
    'Plays out along the line, nothing fancy.',
    'Your ball now — a pass to unlock the flank.',
    'Quality touch to hold the momentum.',
  ],
  interceptação: [
    'Defensive read — and already an answer on the ball.',
    'Cuts the pass and moves it on: a transition born from pressure.',
    'Ruthless anticipation; then a touch to launch the counter.',
    'Steals the idea from the opponent and returns it with class.',
    'Interception turned into a burst — instant pass.',
    'Ball won with perfect timing; a touch to open the game.',
    'Reads the passing lane and punishes with a sharp touch.',
    'Cut, breathe, deliver: top-level football.',
  ],
  desarme: [
    'Clean tackle — the team takes command with a confident touch.',
    'Wins the duel and looks forward: a pass to ease the pressure.',
    'Physical recovery; technique answers with a safe pass.',
    'Takes the ball with power and gives it back with judgement.',
    'Double effort: tackle and a quality first ball out.',
    'The press dies here — a pass to turn the page.',
    'Body well placed, ball won, a touch to break free.',
    'Dirty work done; now it is passing football.',
  ],
  perda: [
    'Mistake erased in an instant — a touch to restore confidence.',
    'Falls, gets up, delivers: a champion\'s reaction.',
    'Painful loss, but the answer comes straight away with a pass.',
    'Shakes off the error with a simple, accurate touch.',
    'Instant restart — the ball is moving again.',
    'Mentality: lost it, won it back, already playing forward.',
    'Kills the risk with a short, safe pass.',
    'Back on track with a masterful touch.',
  ],
};

const CARRY_AFTER_EN: Record<Test2dTurnoverTag, readonly string[]> = {
  recuperação: [
    'Shields and drives on — space opening up ahead.',
    'Bursts away with the ball glued to his foot; the block moves up with him.',
    'First push with a dribble; the opponent backs off.',
    'Aggressive carry giving the attack oxygen.',
    'Carries the ball like he carries the tempo of the game.',
    'Dribble out — a line beaten without asking.',
    'Raises the pulse with a vertical carry.',
    'Hot foot, cool head: progress on the ball.',
  ],
  interceptação: [
    'Steals it and already takes them on — live transition.',
    'Intercepts and explodes into pace with the ball.',
    'Cuts the pass and goes in "I\'ll sort it" mode.',
    'Read + burst: a carry punishing the imbalance.',
    'Ball won and already driving forward.',
    'From thief to artist — a carry that leaves a mark.',
    'Pressure turned into metres gained on the dribble.',
    'Express transition: ball glued, eyes on goal.',
  ],
  desarme: [
    'Wins the body and drives into safe territory.',
    'Tackle and already moving forward with the ball under control.',
    'Physicality and technique: carries the ball out of the scramble.',
    'Takes it out of the danger zone with a smart carry.',
    'Duel won — metres gained on the dribble.',
    'Ball glued to the foot, runs the danger away.',
    'A leader\'s answer: a carry that sets the example.',
    'From tackle to dribble — a classy sequence.',
  ],
  perda: [
    'Mistake forgotten in seconds — a carry to restore authority.',
    'Lost it, won it back, already running at them.',
    'Instant answer with a dribble and courage.',
    'Wipes out the scare with a purposeful carry.',
    'Back on the charge, ball at his feet and morale high.',
    'A champion\'s reaction: a carry that changes the script.',
    'Takes the focus off the error with a dribbling run.',
    'Changes course with a technical burst.',
  ],
};

const INTERCEPT_CUT_EN: readonly string[] = [
  'Interception — passing lane cut aggressively.',
  'Textbook defensive read: the pass doesn\'t get through.',
  'Perfect anticipation; the ball changes hands.',
  'Cuts the pass like cutting the thread.',
  'High press paying off — clean interception.',
  'The opponent thought it was a pass; it was a trap.',
  'Cut at the source — defensive transition with flair.',
];

const SHOT_WINDUP_EN: readonly string[] = [
  'Shot from {who}!',
  '{who} lets fly!',
  'Ball towards goal — attempt from {who}!',
  '{who} unleashes it — shot!',
  'Powerful strike from {who}!',
  '{who} going for goal!',
];

const GK_FROM_SHOT_DEFENSE_EN: readonly string[] = [
  'Save — ball held by the GK ({reason}).',
  'Goalkeeper holds on ({reason}).',
  'GK in control of the situation ({reason}).',
  'Safe save; ball in the GK\'s hands ({reason}).',
];

const GK_FROM_SHOT_ATTACK_EN: readonly string[] = [
  'Shot — ball with the GK ({reason}).',
  'Attempt stopped; goalkeeper has the ball ({reason}).',
  'GK gathers after the shot ({reason}).',
  'Ball neutralised by the GK ({reason}).',
];

const MISS_POWER_EN: readonly string[] = [
  'Powerful shot, wide.',
  'Thunderous strike — misses the target by a distance.',
  'Full swing, but the ball flies past the goal.',
  'Loaded shot that doesn\'t find the frame.',
];

const MISS_WEAK_EN: readonly string[] = [
  'Weak shot — well wide of goal.',
  'Timid touch; the GK doesn\'t even need to shine.',
  'Shot without conviction; ball dying out wide.',
  'Shot lacking power — doesn\'t get there.',
];

const MISS_PLACED_EN: readonly string[] = [
  'Shot wide.',
  'Nice placement, but the goal escapes him.',
  'Goes for the corner — the ball grazes wide.',
  'Measured shot that won\'t make history.',
];

const PASS_INCOMPLETE_EN: readonly string[] = [
  'Incomplete pass — the read of the line fails by a second.',
  'Needed more precision; the pass doesn\'t reach its target.',
  'Pressure dooms the pass: loose ball.',
  'Timing off — possession about to be lost.',
  'The teammate offered a lane, but the pass didn\'t follow the idea.',
  'Execution error: the opponent gets to the second ball first.',
];

const RECEPTION_FUMBLE_EN: readonly string[] = [
  'Poor first touch — ball gets away, back to square one.',
  'First touch fails; the rhythm breaks.',
  'Ball too hot to handle — control lost.',
  'Reception needs more training; the team loses its rhythm.',
  'Weak set-up touch; the opposing block reacts.',
];

const DRIBBLE_STRIPPED_EN: readonly string[] = [
  'Failed dribble — the marker wins the duel and the ball.',
  'Tried to do it alone; the opponent read it and cut it out.',
  'Overconfidence on the ball — dispossessed.',
  'One-on-one lost; the defence wins out.',
];

const DRIBBLE_LOOSE_EN: readonly string[] = [
  'Dribble stopped — ball stays live between the lines.',
  'Loses balance on the carry; the ball breaks loose.',
  'Pressure on top; the carry can\'t take the contact.',
];

const CROSS_FAIL_EN: readonly string[] = [
  'Cross blocked at source — ball doesn\'t get through.',
  'Crossing lane cut; the defence closes the flank.',
  'Cross fails: timing or space missing.',
];

const PASS_SOLID_EN: readonly string[] = [
  'Clean pass keeping the block connected.',
  'Smart circulation — pressure cooling off.',
  'Accurate touch opening a new angle.',
  'Good decision: simple ball to the right feet.',
  'Pass bringing fluency to the final third.',
];

const DRIBBLE_SUCCESS_EN: readonly string[] = [
  'Surgical dribble — leaves the marker for dead.',
  'One-on-one won with class: space out of nothing.',
  'Finesse to get past the pressing line.',
  'Ball glued to the foot, opponent out of the game.',
  'Breaks the duel with a rare quality touch.',
  'Dribbles as if he knew what the opponent would do.',
  'Technical exit; the block opens the way ahead.',
  'A carry worth gold: line beaten.',
];

const HIGH_PRESS_EVENT_EN: readonly string[] = [
  'High press — the team smothers the opponent\'s build-up.',
  'Compact block closing spaces: tempo rising.',
  'Maximum intensity! No breathing room for the opponent.',
  'Organised pressure makes the difference — traffic blocked.',
  'Collective press taking the ball off the opponent.',
  'No space, no time — the press is paying off.',
  'Collective hunt for the ball: the game gets tight.',
];

const CHANCE_CREATED_EN: readonly string[] = [
  'Huge chance! Goal in sight!',
  'Space created — crucial moment of decision.',
  'Quick combination opening a gap in the defence.',
  'The move develops well — a chance emerging!',
  'Defence exposed! The ball reaches the shooter.',
  'What a move! The final pass is perfect.',
  'Dangerous situation — the defence is in trouble.',
];

/** Linha completa `NN' — …` */
export function test2dPassAfterTurnoverLine(
  minute: number,
  tag: Test2dTurnoverTag,
  varietyKey: string,
): string {
  const body = pickLine(`${minute}|pass|${tag}|${varietyKey}`, (EN ? PASS_AFTER_EN : PASS_AFTER)[tag]);
  return `${minute}' — ${body}`;
}

export function test2dCarryAfterTurnoverLine(
  minute: number,
  tag: Test2dTurnoverTag,
  varietyKey: string,
): string {
  const body = pickLine(`${minute}|carry|${tag}|${varietyKey}`, (EN ? CARRY_AFTER_EN : CARRY_AFTER)[tag]);
  return `${minute}' — ${body}`;
}

export function test2dInterceptCutPassLine(minute: number, varietyKey: string): string {
  const body = pickLine(`${minute}|intercept|${varietyKey}`, (EN ? INTERCEPT_CUT_EN : INTERCEPT_CUT));
  return `${minute}' — ${body}`;
}

export function test2dShotWindupLine(minute: number, who: string, varietyKey: string): string {
  const tpl = pickLine(`${minute}|shot|${who}|${varietyKey}`, (EN ? SHOT_WINDUP_EN : SHOT_WINDUP));
  return `${minute}' — ${tpl.replaceAll('{who}', who)}`;
}

export function test2dGkBallFromShotLine(
  minute: number,
  defenseFraming: boolean,
  reason: string,
  varietyKey: string,
): string {
  const pool = defenseFraming ? (EN ? GK_FROM_SHOT_DEFENSE_EN : GK_FROM_SHOT_DEFENSE) : (EN ? GK_FROM_SHOT_ATTACK_EN : GK_FROM_SHOT_ATTACK);
  const tpl = pickLine(`${minute}|gkshot|${defenseFraming}|${reason}|${varietyKey}`, pool);
  return `${minute}' — ${tpl.replaceAll('{reason}', reason)}`;
}

export function test2dShotMissDetailLine(
  minute: number,
  strike: 'power' | 'weak' | 'placed',
  varietyKey: string,
): string {
  const pool = strike === 'power' ? (EN ? MISS_POWER_EN : MISS_POWER) : strike === 'weak' ? (EN ? MISS_WEAK_EN : MISS_WEAK) : (EN ? MISS_PLACED_EN : MISS_PLACED);
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

const DRIBBLE_SUCCESS: readonly string[] = [
  'Drible cirúrgico — deixa o marcador a ver navios.',
  'Um-para-um ganho com classe: espaço criado do nada.',
  'Finesse a ultrapassar a linha de pressão.',
  'Bola colada ao pé, adversário fora do jogo.',
  'Quebra o duelo com um toque de qualidade rara.',
  'Dribla como se soubesse o que o adversário ia fazer.',
  'Saída técnica; o bloco abre caminho à frente.',
  'Condução que vale ouro: linha ultrapassada.',
];

const HIGH_PRESS_EVENT: readonly string[] = [
  'Pressing alto — a equipa sufoca a saída adversária.',
  'Bloco compacto a fechar espaços: ritmo a subir.',
  'Intensidade máxima! Adversário sem respiro na saída.',
  'A pressão organizada faz a diferença — trânsito bloqueado.',
  'Pressão coletiva a tirar a bola das mãos do adversário.',
  'Sem espaço, sem tempo — pressing a dar resultado.',
  'Caçada coletiva à bola: o jogo fica apertado.',
];

const CHANCE_CREATED: readonly string[] = [
  'Grande oportunidade de golo! A baliza à vista!',
  'Espaço criado — momento de decisão crucial.',
  'Combinação rápida a abrir brecha na defesa.',
  'A jogada desenvolve-se bem — chance a emergir!',
  'Defesa exposta! A bola chega ao rematador.',
  'Que jogada! O último passe é perfeito.',
  'Situação perigosa — a defesa pede socorro.',
];

export function test2dPassIncompleteLine(minute: number, varietyKey: string): string {
  const body = pickLine(`${minute}|passinc|${varietyKey}`, (EN ? PASS_INCOMPLETE_EN : PASS_INCOMPLETE));
  return `${minute}' — ${body}`;
}

export function test2dReceptionFumbleLine(minute: number, varietyKey: string): string {
  const body = pickLine(`${minute}|fumble|${varietyKey}`, (EN ? RECEPTION_FUMBLE_EN : RECEPTION_FUMBLE));
  return `${minute}' — ${body}`;
}

export function test2dDribbleStrippedLine(minute: number, varietyKey: string): string {
  const body = pickLine(`${minute}|dribstrip|${varietyKey}`, (EN ? DRIBBLE_STRIPPED_EN : DRIBBLE_STRIPPED));
  return `${minute}' — ${body}`;
}

export function test2dDribbleLooseLine(minute: number, varietyKey: string): string {
  const body = pickLine(`${minute}|dribloose|${varietyKey}`, (EN ? DRIBBLE_LOOSE_EN : DRIBBLE_LOOSE));
  return `${minute}' — ${body}`;
}

export function test2dCrossFailLine(minute: number, varietyKey: string): string {
  const body = pickLine(`${minute}|crossfail|${varietyKey}`, (EN ? CROSS_FAIL_EN : CROSS_FAIL));
  return `${minute}' — ${body}`;
}

export function test2dPassSolidLine(minute: number, varietyKey: string): string {
  const body = pickLine(`${minute}|passsolid|${varietyKey}`, (EN ? PASS_SOLID_EN : PASS_SOLID));
  return `${minute}' — ${body}`;
}

export function test2dDribbleSuccessLine(minute: number, varietyKey: string): string {
  const body = pickLine(`${minute}|dribsuc|${varietyKey}`, (EN ? DRIBBLE_SUCCESS_EN : DRIBBLE_SUCCESS));
  return `${minute}' — ${body}`;
}

export function test2dHighPressLine(minute: number, varietyKey: string): string {
  const body = pickLine(`${minute}|hipress|${varietyKey}`, (EN ? HIGH_PRESS_EVENT_EN : HIGH_PRESS_EVENT));
  return `${minute}' — ${body}`;
}

export function test2dChanceCreatedLine(minute: number, varietyKey: string): string {
  const body = pickLine(`${minute}|chance|${varietyKey}`, (EN ? CHANCE_CREATED_EN : CHANCE_CREATED));
  return `${minute}' — ${body}`;
}

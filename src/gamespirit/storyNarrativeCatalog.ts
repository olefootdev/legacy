/**
 * Linhas de narração estilo transmissão / resenha — usadas pelo GameSpirit ao vivo.
 * Placeholder {name} = jogador casa; {away} = equipa visitante (texto curto).
 */

export const DRIBBLE_LINES = [
  `{name} engana com o corpo e entra na área em velocidade.`,
  `Caneta seca de {name} — a defesa fica a ver passar o comboio.`,
  `{name} em slalom: deixa dois no chão e a torcida acorda.`,
  `Condução forte de {name}, protege com o braço e gira na hora H.`,
  `{name} puxa três homens e abre o corredor para o colega.`,
  `Elastico rápido de {name} — quase dá show no meio-campo.`,
];

export const CROSS_LINES = [
  `Cruzamento fechado de {name} — a bola ferve na pequena área.`,
  `Bola na segunda linha: {name} mede o centro e procura a cabeça.`,
  `Centro rasteiro de {name}, corta a defesa mas sobra na frontal.`,
  `{name} na linha de fundo: levanta na medida para o desvio.`,
  `Cruzamento alto de {name} — quem sobe de trás?`,
  `Bola lá de fora: {name} cruza com efeito, perigo máximo.`,
];

export const LONG_SHOT_LINES = [
  `{name} arrisca de fora da grande área — a bola vibra nas redes… laterais.`,
  `Foguete de média distância por {name}! O guarda-redes estica-se todo.`,
  `Remate colocado de {name} de fora da área — passa raspando o poste.`,
  `{name} solta o pé de longe: defesa desvia em cima da linha.`,
  `Tiro de trivela de {name} — arte pura, mas sai por cima.`,
  `{name} a testar o GR de longe: defesa segura com segurança.`,
  `Pancada seca de {name} da meia-lua — barreira a fechar o ângulo.`,
];

export const LONG_SHOT_FOLLOW_SAVE = [
  `Grande defesa — a bola ia entrar.`,
  `O guarda-redes nega o golo de beliche.`,
  `Trave a evitar o estrondo.`,
];

export const LONG_SHOT_FOLLOW_WIDE = [
  `Sai ao lado com veneno.`,
  `Por cima — era difícil, mas a intenção era boa.`,
  `O relvado agradece que não tenha ido à bancada.`,
];

export const FOUL_LINES = [
  `Entrada tardia — o árbitro assina falta.`,
  `Falta tática para cortar o contra-ataque.`,
  `Carga por trás: cartão no bolso do juiz, por agora.`,
  `Empurão claro na disputa aérea — bola parada.`,
  `Dureza excessiva no meio: a equipa visitante reclama.`,
  `Falta perigosa na frontal — cheira a remate ou cruzamento.`,
];

/** Falta da equipa da casa — posse parada para os visitantes. */
export const FOUL_HOME_LINES = [
  `{name} comete a falta — {away} com bola parada perigosa.`,
  `Cartão amarelo no ar… não, só falta. {away} a organizar o livre.`,
  `Entrada por cima de {name}: juiz protege o atleta visitante.`,
  `Falta clara da casa; {away} pode cruzar ou rematar.`,
];

/** Falta dos visitantes — oportunidade para a casa. */
export const FOUL_AWAY_LINES = [
  `Falta dura de {away} sobre {name} — livre na meia-lua.`,
  `Os visitantes cortam o lance com o braço: falta e conversa com o capitão.`,
  `{away} atrasam o jogo; a casa prepara o cruzamento.`,
  `Falta tática de {away}: {name} vai bater ou levantar na área?`,
];

export const FREE_KICK_WALL_LINES = [
  `Barreira com cinco homens — quem bate?`,
  `Livre direto na zona de remate: tensão no estádio.`,
  `Toca atrás para o cruzamento em vez do remate direto.`,
];

export const PRESS_LINES = [
  `Pressing alto da casa — {away} não respira na saída de bola.`,
  `Linha avançada: a torcida empurra o erro.`,
  `Recuperação no último terço — quase, quase.`,
];

export const SHAPE_LINES = [
  `Bloco compacto: não há espaços entre linhas.`,
  `Equipa recua cinco metros e reorganiza.`,
  `Meio-campo a fechar corredores — jogo de paciência.`,
];

export const BUILD_UP_LINES = [
  `Toques curtos a girar o relógio.`,
  `Posse paciente à procura da brecha.`,
  `A bola passeia no meio sem pressa.`,
];

export const CHANCE_HOME_SAVE_EXTRA = [
  `Defesa em duas tempos — ainda há jogo.`,
  `O GR fecha o ângulo como um muro.`,
];

export const CHANCE_AWAY_BLOCK = [
  `Corte providencial na pequena área.`,
  `A defesa da casa tira com unhas e dentes.`,
];

function idx(n: number, max: number): number {
  return Math.min(max - 1, Math.floor(Math.abs(n % max)));
}

export function pickDribbleLine(seed: number, minute: number, salt: number): string {
  return DRIBBLE_LINES[idx(seed + minute * 31 + salt, DRIBBLE_LINES.length)]!;
}

export function pickCrossLine(seed: number, minute: number, salt: number): string {
  return CROSS_LINES[idx(seed + minute * 37 + salt, CROSS_LINES.length)]!;
}

export function pickLongShotLine(seed: number, minute: number, salt: number): string {
  return LONG_SHOT_LINES[idx(seed + minute * 41 + salt, LONG_SHOT_LINES.length)]!;
}

export function pickLongShotFollow(seed: number, minute: number, kind: 'save' | 'wide'): string {
  const arr = kind === 'save' ? LONG_SHOT_FOLLOW_SAVE : LONG_SHOT_FOLLOW_WIDE;
  return arr[idx(seed + minute * 43, arr.length)]!;
}

export function pickFoulLine(seed: number, minute: number, salt: number): string {
  return FOUL_LINES[idx(seed + minute * 47 + salt, FOUL_LINES.length)]!;
}

export function pickFoulHomeLine(seed: number, minute: number, salt: number): string {
  return FOUL_HOME_LINES[idx(seed + minute * 79 + salt, FOUL_HOME_LINES.length)]!;
}

export function pickFoulAwayLine(seed: number, minute: number, salt: number): string {
  return FOUL_AWAY_LINES[idx(seed + minute * 83 + salt, FOUL_AWAY_LINES.length)]!;
}

export function pickFreeKickWallLine(seed: number, minute: number): string {
  return FREE_KICK_WALL_LINES[idx(seed + minute * 53, FREE_KICK_WALL_LINES.length)]!;
}

export function pickPressLine(seed: number, minute: number): string {
  return PRESS_LINES[idx(seed + minute * 59, PRESS_LINES.length)]!;
}

export function pickShapeLine(seed: number, minute: number): string {
  return SHAPE_LINES[idx(seed + minute * 61, SHAPE_LINES.length)]!;
}

export function pickBuildUpLine(seed: number, minute: number): string {
  return BUILD_UP_LINES[idx(seed + minute * 67, BUILD_UP_LINES.length)]!;
}

export function pickChanceSaveExtra(seed: number, minute: number): string {
  return CHANCE_HOME_SAVE_EXTRA[idx(seed + minute * 71, CHANCE_HOME_SAVE_EXTRA.length)]!;
}

export function pickAwayBlockLine(seed: number, minute: number): string {
  return CHANCE_AWAY_BLOCK[idx(seed + minute * 73, CHANCE_AWAY_BLOCK.length)]!;
}

export function injectName(template: string, name: string): string {
  return template.replace(/\{name\}/g, name);
}

export function injectAway(template: string, awayShort: string): string {
  return template.replace(/\{away\}/g, awayShort);
}

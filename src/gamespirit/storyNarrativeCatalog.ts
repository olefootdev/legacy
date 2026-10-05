/**
 * Linhas de narração estilo transmissão / resenha — usadas pelo GameSpirit ao vivo.
 * Placeholder {name} = jogador casa; {away} = equipa visitante (texto curto).
 */

import { L } from '@/i18n/L';

export const DRIBBLE_LINES = [
  L(`{name} engana com o corpo e entra na área em velocidade.`, `{name} sells the dummy and bursts into the box.`),
  L(`Caneta seca de {name} — a defesa fica a ver passar o comboio.`, `Nutmeg from {name} — the defence left watching.`),
  L(`{name} em slalom: deixa dois no chão e a torcida acorda.`, `{name} slaloms through: two on the floor and the crowd wakes up.`),
  L(`Condução forte de {name}, protege com o braço e gira na hora H.`, `Powerful run from {name}, holds them off and turns at the perfect moment.`),
  L(`{name} puxa três homens e abre o corredor para o colega.`, `{name} draws three men and opens the lane for a teammate.`),
  L(`Elastico rápido de {name} — quase dá show no meio-campo.`, `Quick elastico from {name} — almost a show in midfield.`),
];

export const CROSS_LINES = [
  L(`Cruzamento fechado de {name} — a bola ferve na pequena área.`, `Inswinging cross from {name} — chaos in the six-yard box.`),
  L(`Bola na segunda linha: {name} mede o centro e procura a cabeça.`, `Second phase: {name} measures the cross, looking for a head.`),
  L(`Centro rasteiro de {name}, corta a defesa mas sobra na frontal.`, `Low cross from {name}, beats the defence but runs to the edge of the box.`),
  L(`{name} na linha de fundo: levanta na medida para o desvio.`, `{name} at the byline: an inviting ball for the flick.`),
  L(`Cruzamento alto de {name} — quem sobe de trás?`, `High cross from {name} — who's arriving late?`),
  L(`Bola lá de fora: {name} cruza com efeito, perigo máximo.`, `From out wide: {name} whips it in, real danger.`),
];

export const LONG_SHOT_LINES = [
  L(`{name} arrisca de fora da grande área — a bola vibra nas redes… laterais.`, `{name} tries his luck from outside the box — it ripples the net… the side netting.`),
  L(`Foguete de média distância por {name}! O guarda-redes estica-se todo.`, `Rocket from range by {name}! The keeper at full stretch.`),
  L(`Remate colocado de {name} de fora da área — passa raspando o poste.`, `Placed effort from {name} outside the box — just past the post.`),
  L(`{name} solta o pé de longe: defesa desvia em cima da linha.`, `{name} lets fly from distance: deflected off the line.`),
  L(`Tiro de trivela de {name} — arte pura, mas sai por cima.`, `Outside-of-the-boot strike from {name} — pure art, but over.`),
  L(`{name} a testar o GR de longe: defesa segura com segurança.`, `{name} tests the keeper from range: comfortably held.`),
  L(`Pancada seca de {name} da meia-lua — barreira a fechar o ângulo.`, `Thunderous hit from {name} at the D — the wall cuts out the angle.`),
];

export const LONG_SHOT_FOLLOW_SAVE = [
  L(`Grande defesa — a bola ia entrar.`, `Great save — that was going in.`),
  L(`O guarda-redes nega o golo de beliche.`, `The keeper denies a certain goal.`),
  L(`Trave a evitar o estrondo.`, `The woodwork saves them.`),
];

export const LONG_SHOT_FOLLOW_WIDE = [
  L(`Sai ao lado com veneno.`, `Wide, but with venom.`),
  L(`Por cima — era difícil, mas a intenção era boa.`, `Over — difficult, but the idea was right.`),
  L(`O relvado agradece que não tenha ido à bancada.`, `At least it didn't end up in the stands.`),
];

export const FOUL_LINES = [
  L(`Entrada tardia — o árbitro assina falta.`, `Late challenge — the referee gives the foul.`),
  L(`Falta tática para cortar o contra-ataque.`, `Tactical foul to stop the counter.`),
  L(`Carga por trás: cartão no bolso do juiz, por agora.`, `From behind: the card stays in the referee's pocket, for now.`),
  L(`Empurão claro na disputa aérea — bola parada.`, `Clear push in the aerial duel — set piece.`),
  L(`Dureza excessiva no meio: a equipa visitante reclama.`, `Too physical in midfield: the visitors protest.`),
  L(`Falta perigosa na frontal — cheira a remate ou cruzamento.`, `Dangerous free kick on the edge — shot or cross?`),
];

/** Falta da equipa da casa — posse parada para os visitantes. */
export const FOUL_HOME_LINES = [
  L(`{name} comete a falta — {away} com bola parada perigosa.`, `{name} gives away the foul — dangerous set piece for {away}.`),
  L(`Cartão amarelo no ar… não, só falta. {away} a organizar o livre.`, `Yellow card coming… no, just a foul. {away} line up the free kick.`),
  L(`Entrada por cima de {name}: juiz protege o atleta visitante.`, `{name} goes over the ball: the referee protects the visiting player.`),
  L(`Falta clara da casa; {away} pode cruzar ou rematar.`, `Clear foul by the home side; {away} can cross or shoot.`),
];

/** Falta dos visitantes — oportunidade para a casa. */
export const FOUL_AWAY_LINES = [
  L(`Falta dura de {away} sobre {name} — livre na meia-lua.`, `Heavy foul by {away} on {name} — free kick at the D.`),
  L(`Os visitantes cortam o lance com o braço: falta e conversa com o capitão.`, `The visitors stop it with an arm: foul, and words with the captain.`),
  L(`{away} atrasam o jogo; a casa prepara o cruzamento.`, `{away} slow things down; the home side ready the cross.`),
  L(`Falta tática de {away}: {name} vai bater ou levantar na área?`, `Tactical foul by {away}: will {name} shoot or swing it in?`),
];

export const FREE_KICK_WALL_LINES = [
  L(`Barreira com cinco homens — quem bate?`, `Five in the wall — who's taking it?`),
  L(`Livre direto na zona de remate: tensão no estádio.`, `Free kick in shooting range: tension in the stadium.`),
  L(`Toca atrás para o cruzamento em vez do remate direto.`, `Rolled back for the cross instead of a direct shot.`),
];

export const PRESS_LINES = [
  L(`Pressing alto da casa — {away} não respira na saída de bola.`, `High press from the home side — {away} can't breathe on the ball.`),
  L(`Linha avançada: a torcida empurra o erro.`, `High line: the crowd force the error.`),
  L(`Recuperação no último terço — quase, quase.`, `Won back in the final third — so nearly.`),
];

export const SHAPE_LINES = [
  L(`Bloco compacto: não há espaços entre linhas.`, `Compact block: no space between the lines.`),
  L(`Equipe recua cinco metros e reorganiza.`, `The team drop five metres and regroup.`),
  L(`Meio-campo a fechar corredores — jogo de paciência.`, `Midfield closing the lanes — a game of patience.`),
];

export const BUILD_UP_LINES = [
  L(`Toques curtos a girar o relógio.`, `Short passes, running the clock.`),
  L(`Posse paciente à procura da brecha.`, `Patient possession, probing for a gap.`),
  L(`A bola passeia no meio sem pressa.`, `The ball moves around midfield, no hurry.`),
];

export const CHANCE_HOME_SAVE_EXTRA = [
  L(`Defesa em duas tempos — ainda há jogo.`, `Saved at the second attempt — still alive.`),
  L(`O GR fecha o ângulo como um muro.`, `The keeper narrows the angle like a wall.`),
];

export const CHANCE_AWAY_BLOCK = [
  L(`Corte providencial na pequena área.`, `Vital block in the six-yard box.`),
  L(`A defesa da casa tira com unhas e dentes.`, `The home defence clear it by any means.`),
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

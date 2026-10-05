import type { GoalBuildUp } from '@/engine/types';
import { L } from '@/i18n/L';

function hashPick(minute: number, scorerName: string, salt: number): number {
  let h = minute * 1009 + salt;
  for (let i = 0; i < scorerName.length; i++) {
    h = (h + scorerName.charCodeAt(i) * (i + 7)) >>> 0;
  }
  return h;
}

/**
 * Frase curta sob o nome do marcador no cartão de golo (partida rápida / overlay).
 * Tom emocional, variada por minuto + nome + tipo de construção.
 */
export function pickGoalOverlayStoryline(input: {
  scorerName: string;
  minute: number;
  goalBuildUp?: GoalBuildUp;
  side: 'home' | 'away';
  awayShort?: string;
}): string {
  const { scorerName, minute, goalBuildUp, side, awayShort } = input;
  const n = scorerName.trim() || L('Marcador', 'Scorer');
  const counter = goalBuildUp === 'counter';
  const away = awayShort?.trim() ?? L('visitante', 'away');

  const homeCounter = [
    () => L(`${n} disparou na transição e não deu tempo para reagir.`, `${n} burst through on the transition, no time to react.`),
    () => L(`${n} aproveitou o espaço na ruptura e cravou.`, `${n} exploited the space on the break and nailed it.`),
    () => L(`${n} entrou na área em velocidade e fechou em beleza.`, `${n} raced into the box and finished in style.`),
    () => L(`${n} leu o desvio e apareceu sozinho frente ao GR.`, `${n} read the deflection and found himself alone with the GK.`),
    () => L(`${n} transformou a recuperação num gol de manual.`, `${n} turned the recovery into a textbook goal.`),
    () => L(`${n} foi letal no contra-golpe — bola na rede.`, `${n} was lethal on the counter — back of the net.`),
  ];

  const homePositional = [
    () => L(`${n} aproveitou o erro da defesa e marcou.`, `${n} punished the defensive error and scored.`),
    () => L(`${n} subiu de cabeça no escanteio e marcou.`, `${n} rose to head home from the corner.`),
    () => L(`${n} subiu de cabeça ao canto e mandou para dentro.`, `${n} rose and headed it into the corner.`),
    () => L(`${n} dominou na grande área e encostou com classe.`, `${n} controlled it in the box and slotted home with class.`),
    () => L(`${n} insistiu na jogada e o estádio explodiu.`, `${n} kept at it and the stadium erupted.`),
    () => L(`${n} apareceu no sítio certo e só teve de empurrar.`, `${n} was in the right place and just had to tap it in.`),
    () => L(`${n} fechou a jogada colectiva com um remate certeiro.`, `${n} finished off the team move with a precise strike.`),
    () => L(`${n} enganou o último defesa e bateu com frieza.`, `${n} fooled the last defender and finished coolly.`),
    () => L(`${n} encontrou o ângulo e a bola nem pestanejou.`, `${n} found the angle and the ball didn't even blink.`),
  ];

  const awayCounter = [
    () => L(`${n} castigou o time da casa num lance rápido.`, `${n} punished the home side with a quick move.`),
    () => L(`${n} fugiu ao fora-de-jogo e definiu com sangue frio.`, `${n} beat the offside trap and finished ice-cold.`),
    () => L(`${n} surgiu na segunda vaga e fez o inferno na baliza.`, `${n} arrived in the second wave and wreaked havoc in front of goal.`),
    () => L(`${n} fechou o contra-ataque com um toque preciso.`, `${n} finished the counter with a precise touch.`),
    () => L(`${n} aproveitou a hesitação e cruzou o guarda-redes.`, `${n} seized on the hesitation and beat the goalkeeper.`),
  ];

  const awayPositional = [
    () => L(`${n} (${away}) subiu de cabeça no canto e marcou.`, `${n} (${away}) headed it into the corner.`),
    () => L(`${n} aproveitou a confusão na área e empurrou para dentro.`, `${n} capitalised on the scramble in the box and pushed it in.`),
    () => L(`${n} apareceu entre centrais e cabeceou sem piedade.`, `${n} appeared between the centre-backs and headed in without mercy.`),
    () => L(`${n} fechou o cruzamento com um remate violento.`, `${n} met the cross with a thunderous strike.`),
    () => L(`${n} (${away}) fez lembrar que a defesa dormiu um segundo.`, `${n} (${away}) showed the defence switched off for a second.`),
    () => L(`${n} isolou-se na pequena área e não perdoou.`, `${n} found himself alone in the six-yard box and made no mistake.`),
  ];

  const pool =
    side === 'away'
      ? counter
        ? awayCounter
        : awayPositional
      : counter
        ? homeCounter
        : homePositional;

  const i = hashPick(minute, n, side === 'away' ? 17 : 31) % pool.length;
  return pool[i]!();
}

import type { GoalBuildUp } from '@/engine/types';

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
  const n = scorerName.trim() || 'Marcador';
  const counter = goalBuildUp === 'counter';
  const away = awayShort?.trim() ?? 'visitante';

  const homeCounter = [
    () => `${n} disparou na transição e não deu tempo para reagir.`,
    () => `${n} aproveitou o espaço na ruptura e cravou.`,
    () => `${n} entrou na área em velocidade e fechou em beleza.`,
    () => `${n} leu o desvio e apareceu sozinho frente ao GR.`,
    () => `${n} transformou a recuperação num golo de manual.`,
    () => `${n} foi letal no contra-golpe — bola na rede.`,
  ];

  const homePositional = [
    () => `${n} aproveitou o erro da defesa e marcou.`,
    () => `${n} subiu de cabeça no escanteio e marcou.`,
    () => `${n} subiu de cabeça ao canto e mandou para dentro.`,
    () => `${n} dominou na grande área e encostou com classe.`,
    () => `${n} insistiu na jogada e o estádio explodiu.`,
    () => `${n} apareceu no sítio certo e só teve de empurrar.`,
    () => `${n} fechou a jogada colectiva com um remate certeiro.`,
    () => `${n} enganou o último defesa e bateu com frieza.`,
    () => `${n} encontrou o ângulo e a bola nem pestanejou.`,
  ];

  const awayCounter = [
    () => `${n} castigou a equipa da casa num lance rápido.`,
    () => `${n} fugiu ao fora-de-jogo e definiu com sangue frio.`,
    () => `${n} surgiu na segunda vaga e fez o inferno na baliza.`,
    () => `${n} fechou o contra-ataque com um toque preciso.`,
    () => `${n} aproveitou a hesitação e cruzou o guarda-redes.`,
  ];

  const awayPositional = [
    () => `${n} (${away}) subiu de cabeça no canto e marcou.`,
    () => `${n} aproveitou a confusão na área e empurrou para dentro.`,
    () => `${n} apareceu entre centrais e cabeceou sem piedade.`,
    () => `${n} fechou o cruzamento com um remate violento.`,
    () => `${n} (${away}) fez lembrar que a defesa dormiu um segundo.`,
    () => `${n} isolou-se na pequena área e não perdoou.`,
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

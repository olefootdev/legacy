/**
 * Templates de narração — fonte única para todo texto do feed na partida rápida.
 * Regras: uma linha, sem \n, verbo forte + nomes dos intervenientes.
 * O renderer (`renderQuickFeedRichText`) já faz bold automático de nomes reconhecidos.
 *
 * Sistema de variação: evita repetir expressões em lances similares consecutivos.
 */

import { pickVaried } from './narrativeVariation';

function pick<T>(arr: T[], eventType: string, seed: number, minute: number): T {
  return pickVaried(arr, eventType, seed, minute);
}

function s(min: number): string {
  return `${min}' —`;
}

// ── Remates ──────────────────────────────────────────────

export function shot(p: { min: number; shooter: string }): string {
  return pick(
    [
      `${s(p.min)} ${p.shooter} dispara de primeira.`,
      `${s(p.min)} ${p.shooter} arrisca o remate.`,
      `${s(p.min)} ${p.shooter} finaliza com potência.`,
      `${s(p.min)} ${p.shooter} solta a bomba.`,
      `${s(p.min)} Remate forte de ${p.shooter}.`,
      `${s(p.min)} ${p.shooter} tenta de longe.`,
    ],
    'shot',
    p.min * 17 + p.shooter.length,
    p.min,
  );
}

export function shotBlock(p: { min: number; shooter: string; defender?: string }): string {
  if (p.defender) {
    return pick(
      [
        `${s(p.min)} ${p.shooter} remata, ${p.defender} corta na hora H.`,
        `${s(p.min)} Bloqueio de ${p.defender} ao remate de ${p.shooter}.`,
        `${s(p.min)} ${p.defender} fecha o espaço e trava ${p.shooter}.`,
        `${s(p.min)} ${p.shooter} chuta, ${p.defender} põe o corpo.`,
      ],
      'shotBlock',
      p.min + (p.defender.length ?? 0),
      p.min,
    );
  }
  return pick(
    [
      `${s(p.min)} Remate de ${p.shooter} travado pela defesa.`,
      `${s(p.min)} ${p.shooter} finaliza, bloqueio no caminho.`,
      `${s(p.min)} Defesa fecha e corta o remate de ${p.shooter}.`,
    ],
    'shotBlock',
    p.min,
    p.min,
  );
}

export function shotSave(p: { min: number; shooter: string; keeper?: string }): string {
  if (p.keeper) {
    return pick(
      [
        `${s(p.min)} ${p.shooter} remata, ${p.keeper} defende.`,
        `${s(p.min)} ${p.keeper} fecha o ângulo e nega ${p.shooter}.`,
        `${s(p.min)} ${p.keeper} espalma o remate de ${p.shooter}.`,
        `${s(p.min)} ${p.shooter} chuta, ${p.keeper} voa e segura.`,
        `${s(p.min)} Defesa espetacular de ${p.keeper}!`,
      ],
      'shotSave',
      p.min + 1,
      p.min,
    );
  }
  return pick(
    [
      `${s(p.min)} Remate de ${p.shooter} defendido pelo GR.`,
      `${s(p.min)} ${p.shooter} finaliza, o guarda-redes segura.`,
      `${s(p.min)} Goleiro fecha o ângulo e defende ${p.shooter}.`,
      `${s(p.min)} ${p.shooter} chuta, GR espalma para escanteio.`,
    ],
    'shotSave',
    p.min + 1,
    p.min,
  );
}

export function shotWide(p: { min: number; shooter: string; recoverer?: string }): string {
  if (p.recoverer) {
    return pick(
      [
        `${s(p.min)} ${p.shooter} chuta para fora; ${p.recoverer} repõe do fundo.`,
        `${s(p.min)} Remate largo de ${p.shooter}; saída de ${p.recoverer}.`,
        `${s(p.min)} ${p.shooter} erra o alvo; ${p.recoverer} repõe.`,
        `${s(p.min)} ${p.shooter} manda para as nuvens; saída de baliza.`,
      ],
      'shotWide',
      p.min + 2,
      p.min,
    );
  }
  return pick(
    [
      `${s(p.min)} ${p.shooter} chuta para fora.`,
      `${s(p.min)} Remate de ${p.shooter} passa ao lado.`,
      `${s(p.min)} ${p.shooter} erra o alvo.`,
      `${s(p.min)} ${p.shooter} finaliza por cima.`,
    ],
    'shotWide',
    p.min + 2,
    p.min,
  );
}

// ── Progressão / Passe / Reciclagem ─────────────────────

export function progress(p: { min: number; carrier: string; receiver?: string }): string {
  if (p.receiver) {
    return pick(
      [
        `${s(p.min)} ${p.carrier} conduz e serve ${p.receiver}.`,
        `${s(p.min)} ${p.carrier} avança e encontra ${p.receiver} na frente.`,
        `${s(p.min)} ${p.carrier} acelera e acha ${p.receiver}.`,
        `${s(p.min)} Passe longo de ${p.carrier} para ${p.receiver}.`,
        `${s(p.min)} ${p.carrier} lança ${p.receiver} no espaço.`,
        `${s(p.min)} ${p.carrier} vê ${p.receiver} e solta.`,
      ],
      'progress',
      p.min + p.carrier.length,
      p.min,
    );
  }
  return pick(
    [
      `${s(p.min)} ${p.carrier} progride bola ao pé.`,
      `${s(p.min)} ${p.carrier} conduz e abre espaço.`,
      `${s(p.min)} Arranque de ${p.carrier}; bloco avança.`,
      `${s(p.min)} ${p.carrier} ganha terreno.`,
      `${s(p.min)} ${p.carrier} avança pela direita.`,
      `${s(p.min)} ${p.carrier} carrega e puxa a marcação.`,
    ],
    'progress',
    p.min + p.carrier.length,
    p.min,
  );
}

export function progressLoss(p: { min: number; loser: string; winner: string }): string {
  return pick(
    [
      `${s(p.min)} ${p.loser} perde a bola; ${p.winner} recupera.`,
      `${s(p.min)} ${p.winner} rouba a posse a ${p.loser}.`,
    ],
    'progressLoss',
    p.min + p.loser.length,
    p.min,
  );
}

export function recycle(p: { min: number; passer: string; receiver?: string }): string {
  if (p.receiver) {
    return pick(
      [
        `${s(p.min)} ${p.passer} recua para ${p.receiver}; posse circula.`,
        `${s(p.min)} Toque de ${p.passer} para ${p.receiver}, ritmo muda.`,
        `${s(p.min)} ${p.passer} volta a bola para ${p.receiver}.`,
        `${s(p.min)} ${p.passer} acha ${p.receiver} atrás; equipa respira.`,
        `${s(p.min)} ${p.passer} devolve para ${p.receiver}, posse segura.`,
        `${s(p.min)} ${p.passer} toca em ${p.receiver} e reorganiza.`,
      ],
      'recycle',
      p.min + p.passer.length,
      p.min,
    );
  }
  return pick(
    [
      `${s(p.min)} ${p.passer} recicla a posse.`,
      `${s(p.min)} ${p.passer} gira o jogo; equipa reorganiza.`,
      `${s(p.min)} Toque seguro de ${p.passer}.`,
      `${s(p.min)} ${p.passer} volta a bola e controla o ritmo.`,
      `${s(p.min)} ${p.passer} recua; time respira.`,
      `${s(p.min)} ${p.passer} segura a posse.`,
    ],
    'recycle',
    p.min + p.passer.length,
    p.min,
  );
}

// ── Pressão / Recuperação / Corte ───────────────────────

export function press(p: { min: number; team: string; recoverer?: string }): string {
  if (p.recoverer) {
    return pick(
      [
        `${s(p.min)} ${p.recoverer} rouba alto; ${p.team} recupera.`,
        `${s(p.min)} Pressão de ${p.team}; ${p.recoverer} arma o contragolpe.`,
      ],
      'press',
      p.min + 3,
      p.min,
    );
  }
  return `${s(p.min)} Marcação alta de ${p.team} sufoca a saída.`;
}

export function clear(p: { min: number; defender?: string }): string {
  if (p.defender) {
    return pick(
      [
        `${s(p.min)} ${p.defender} corta e afasta o perigo.`,
        `${s(p.min)} Corte firme de ${p.defender}; bola afastada.`,
      ],
      'clear',
      p.min + 3,
      p.min,
    );
  }
  return pick(
    [
      `${s(p.min)} Defesa corta de cabeça e afasta.`,
      `${s(p.min)} Corte seco; bola para as nuvens.`,
    ],
    'clear',
    p.min + 3,
    p.min,
  );
}

export function recovery(p: { min: number; team: string; recoverer?: string }): string {
  if (p.recoverer) {
    return `${s(p.min)} ${p.recoverer} recupera a posse para ${p.team}.`;
  }
  return `${s(p.min)} ${p.team} retoma a posse.`;
}

export function counter(p: { min: number; leader: string }): string {
  return `${s(p.min)} Contra-ataque; ${p.leader} lidera a investida.`;
}

// ── Faltas ───────────────────────────────────────────────

export function foulPenalty(p: { min: number; fouled: string }): string {
  return `${s(p.min)} Falta sobre ${p.fouled} na grande área — penalty!`;
}

export function foulFreeKick(p: { min: number; fouled: string }): string {
  return `${s(p.min)} Falta sobre ${p.fouled}; livre perigoso.`;
}

// ── Golos ────────────────────────────────────────────────

export function goalPositional(p: { min: number; scorer: string }): string {
  return pick(
    [
      `${s(p.min)} GOL! ${p.scorer} explode a rede.`,
      `${s(p.min)} GOL! ${p.scorer} não perdoa.`,
    ],
    'goalPositional',
    p.min + p.scorer.length,
    p.min,
  );
}

export function goalCounter(p: { min: number; scorer: string }): string {
  return pick(
    [
      `${s(p.min)} GOL! Contra-ataque: ${p.scorer} fuzila o GR.`,
      `${s(p.min)} GOL! Transição letal — ${p.scorer} conclui.`,
    ],
    'goalCounter',
    p.min + p.scorer.length,
    p.min,
  );
}

export function goalPostIn(p: { min: number; scorer: string }): string {
  return pick(
    [
      `${s(p.min)} GOL! Trave e para dentro — ${p.scorer}!`,
      `${s(p.min)} GOL! A bola bate na trave e entra; ${p.scorer}.`,
    ],
    'goalPostIn',
    p.min + p.scorer.length,
    p.min,
  );
}

export function goalAwayPositional(p: { min: number; scorer: string; team: string }): string {
  return pick(
    [
      `${s(p.min)} GOL do ${p.team}! ${p.scorer} marca.`,
      `${s(p.min)} GOL! ${p.scorer} (${p.team}) fura o bloqueio.`,
    ],
    'goalAwayPositional',
    p.min + 7,
    p.min,
  );
}

export function goalAwayCounter(p: { min: number; scorer: string; team: string }): string {
  return pick(
    [
      `${s(p.min)} GOL do ${p.team}! Contra-ataque; ${p.scorer} castiga.`,
      `${s(p.min)} GOL! ${p.scorer} conclui transição do ${p.team}.`,
    ],
    'goalAwayCounter',
    p.min + 7,
    p.min,
  );
}

// ── Away genérico ───────────────────────────────────────

export function awayShotWide(p: { min: number; shooter: string; team: string; recoverer?: string }): string {
  if (p.recoverer) {
    return pick(
      [
        `${s(p.min)} ${p.shooter} (${p.team}) chuta para fora; ${p.recoverer} repõe.`,
        `${s(p.min)} Remate do ${p.team} por ${p.shooter} para fora; saída de ${p.recoverer}.`,
      ],
      'awayShotWide',
      p.min + 5,
      p.min,
    );
  }
  return pick(
    [
      `${s(p.min)} ${p.shooter} (${p.team}) finaliza para fora.`,
      `${s(p.min)} Remate do ${p.team} passa ao lado.`,
    ],
    'awayShotWide',
    p.min + 5,
    p.min,
  );
}

export function awayBuild(p: { min: number; team: string }): string {
  return `${s(p.min)} ${p.team} constrói jogada.`;
}

export function turnover(p: { min: number; team: string }): string {
  return `${s(p.min)} ${p.team} retoma a posse.`;
}

export function noCarrierRecycle(p: { min: number; team: string }): string {
  return `${s(p.min)} ${p.team} recua para reorganizar.`;
}

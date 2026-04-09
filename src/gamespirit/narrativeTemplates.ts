/**
 * Templates de narração — fonte única para todo texto do feed na partida rápida.
 * Regras: uma linha, sem \n, verbo forte + nomes dos intervenientes.
 * O renderer (`renderQuickFeedRichText`) já faz bold automático de nomes reconhecidos.
 */

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(Math.floor(seed * 9973)) % arr.length]!;
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
    ],
    p.min * 17 + p.shooter.length,
  );
}

export function shotBlock(p: { min: number; shooter: string; defender?: string }): string {
  if (p.defender) {
    return pick(
      [
        `${s(p.min)} ${p.shooter} remata, ${p.defender} corta na hora H.`,
        `${s(p.min)} Bloqueio de ${p.defender} ao remate de ${p.shooter}.`,
      ],
      p.min + (p.defender.length ?? 0),
    );
  }
  return pick(
    [
      `${s(p.min)} Remate de ${p.shooter} travado pela defesa.`,
      `${s(p.min)} ${p.shooter} finaliza, bloqueio no caminho.`,
    ],
    p.min,
  );
}

export function shotSave(p: { min: number; shooter: string; keeper?: string }): string {
  if (p.keeper) {
    return pick(
      [
        `${s(p.min)} ${p.shooter} remata, ${p.keeper} defende.`,
        `${s(p.min)} ${p.keeper} fecha o ângulo e nega ${p.shooter}.`,
      ],
      p.min + 1,
    );
  }
  return pick(
    [
      `${s(p.min)} Remate de ${p.shooter} defendido pelo GR.`,
      `${s(p.min)} ${p.shooter} finaliza, o guarda-redes segura.`,
    ],
    p.min + 1,
  );
}

export function shotWide(p: { min: number; shooter: string; recoverer?: string }): string {
  if (p.recoverer) {
    return pick(
      [
        `${s(p.min)} ${p.shooter} chuta para fora; ${p.recoverer} repõe do fundo.`,
        `${s(p.min)} Remate largo de ${p.shooter}; saída de ${p.recoverer}.`,
      ],
      p.min + 2,
    );
  }
  return pick(
    [
      `${s(p.min)} ${p.shooter} chuta para fora.`,
      `${s(p.min)} Remate de ${p.shooter} passa ao lado.`,
    ],
    p.min + 2,
  );
}

// ── Progressão / Passe / Reciclagem ─────────────────────

export function progress(p: { min: number; carrier: string; receiver?: string }): string {
  if (p.receiver) {
    return pick(
      [
        `${s(p.min)} ${p.carrier} conduz e serve ${p.receiver}.`,
        `${s(p.min)} ${p.carrier} avança e encontra ${p.receiver} na frente.`,
      ],
      p.min + p.carrier.length,
    );
  }
  return pick(
    [
      `${s(p.min)} ${p.carrier} progride bola ao pé.`,
      `${s(p.min)} ${p.carrier} conduz e abre espaço.`,
      `${s(p.min)} Arranque de ${p.carrier}; bloco avança.`,
    ],
    p.min + p.carrier.length,
  );
}

export function progressLoss(p: { min: number; loser: string; winner: string }): string {
  return pick(
    [
      `${s(p.min)} ${p.loser} perde a bola; ${p.winner} recupera.`,
      `${s(p.min)} ${p.winner} rouba a posse a ${p.loser}.`,
    ],
    p.min + p.loser.length,
  );
}

export function recycle(p: { min: number; passer: string; receiver?: string }): string {
  if (p.receiver) {
    return pick(
      [
        `${s(p.min)} ${p.passer} recua para ${p.receiver}; posse circula.`,
        `${s(p.min)} Toque de ${p.passer} para ${p.receiver}, ritmo muda.`,
      ],
      p.min + p.passer.length,
    );
  }
  return pick(
    [
      `${s(p.min)} ${p.passer} recicla a posse.`,
      `${s(p.min)} ${p.passer} gira o jogo; equipa reorganiza.`,
      `${s(p.min)} Toque seguro de ${p.passer}.`,
    ],
    p.min + p.passer.length,
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
      p.min + 3,
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
      p.min + 3,
    );
  }
  return pick(
    [
      `${s(p.min)} Defesa corta de cabeça e afasta.`,
      `${s(p.min)} Corte seco; bola para as nuvens.`,
    ],
    p.min + 3,
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
  return `${s(p.min)} Falta sobre ${p.fouled} na grande área — penálti!`;
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
    p.min + p.scorer.length,
  );
}

export function goalCounter(p: { min: number; scorer: string }): string {
  return pick(
    [
      `${s(p.min)} GOL! Contra-ataque: ${p.scorer} fuzila o GR.`,
      `${s(p.min)} GOL! Transição letal — ${p.scorer} conclui.`,
    ],
    p.min + p.scorer.length,
  );
}

export function goalPostIn(p: { min: number; scorer: string }): string {
  return pick(
    [
      `${s(p.min)} GOL! Trave e para dentro — ${p.scorer}!`,
      `${s(p.min)} GOL! A bola bate na trave e entra; ${p.scorer}.`,
    ],
    p.min,
  );
}

export function goalAwayPositional(p: { min: number; scorer: string; team: string }): string {
  return pick(
    [
      `${s(p.min)} GOL do ${p.team}! ${p.scorer} marca.`,
      `${s(p.min)} GOL! ${p.scorer} (${p.team}) fura o bloqueio.`,
    ],
    p.min + 7,
  );
}

export function goalAwayCounter(p: { min: number; scorer: string; team: string }): string {
  return pick(
    [
      `${s(p.min)} GOL do ${p.team}! Contra-ataque; ${p.scorer} castiga.`,
      `${s(p.min)} GOL! ${p.scorer} conclui transição do ${p.team}.`,
    ],
    p.min + 7,
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
      p.min + 5,
    );
  }
  return pick(
    [
      `${s(p.min)} ${p.shooter} (${p.team}) finaliza para fora.`,
      `${s(p.min)} Remate do ${p.team} passa ao lado.`,
    ],
    p.min + 5,
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

/**
 * Templates de narração — fonte única para todo texto do feed na partida rápida.
 * Regras: uma linha, sem \n, verbo forte + nomes dos intervenientes.
 * O renderer (`renderQuickFeedRichText`) já faz bold automático de nomes reconhecidos.
 *
 * Sistema de variação: evita repetir expressões em lances similares consecutivos.
 */

import { pickVaried } from './narrativeVariation';
import { L } from '@/i18n/L';

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
      L(`${s(p.min)} ${p.shooter} dispara de primeira.`, `${s(p.min)} ${p.shooter} hits it first time.`),
      L(`${s(p.min)} ${p.shooter} arrisca o remate.`, `${s(p.min)} ${p.shooter} tries his luck.`),
      L(`${s(p.min)} ${p.shooter} finaliza com potência.`, `${s(p.min)} ${p.shooter} strikes it with power.`),
      L(`${s(p.min)} ${p.shooter} solta a bomba.`, `${s(p.min)} ${p.shooter} unleashes a rocket.`),
      L(`${s(p.min)} Remate forte de ${p.shooter}.`, `${s(p.min)} Fierce strike from ${p.shooter}.`),
      L(`${s(p.min)} ${p.shooter} tenta de longe.`, `${s(p.min)} ${p.shooter} has a go from distance.`),
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
        L(`${s(p.min)} ${p.shooter} remata, ${p.defender} corta na hora H.`, `${s(p.min)} ${p.shooter} shoots, ${p.defender} blocks just in time.`),
        L(`${s(p.min)} Bloqueio de ${p.defender} ao remate de ${p.shooter}.`, `${s(p.min)} ${p.defender} blocks ${p.shooter}'s effort.`),
        L(`${s(p.min)} ${p.defender} fecha o espaço e trava ${p.shooter}.`, `${s(p.min)} ${p.defender} closes the gap and stops ${p.shooter}.`),
        L(`${s(p.min)} ${p.shooter} chuta, ${p.defender} põe o corpo.`, `${s(p.min)} ${p.shooter} shoots, ${p.defender} puts his body on the line.`),
      ],
      'shotBlock',
      p.min + (p.defender.length ?? 0),
      p.min,
    );
  }
  return pick(
    [
      L(`${s(p.min)} Remate de ${p.shooter} travado pela defesa.`, `${s(p.min)} ${p.shooter}'s shot is blocked by the defence.`),
      L(`${s(p.min)} ${p.shooter} finaliza, bloqueio no caminho.`, `${s(p.min)} ${p.shooter} shoots, but it's blocked.`),
      L(`${s(p.min)} Defesa fecha e corta o remate de ${p.shooter}.`, `${s(p.min)} The defence closes in and blocks ${p.shooter}'s shot.`),
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
        L(`${s(p.min)} ${p.shooter} remata, ${p.keeper} defende.`, `${s(p.min)} ${p.shooter} shoots, ${p.keeper} saves.`),
        L(`${s(p.min)} ${p.keeper} fecha o ângulo e nega ${p.shooter}.`, `${s(p.min)} ${p.keeper} narrows the angle and denies ${p.shooter}.`),
        L(`${s(p.min)} ${p.keeper} espalma o remate de ${p.shooter}.`, `${s(p.min)} ${p.keeper} parries ${p.shooter}'s strike.`),
        L(`${s(p.min)} ${p.shooter} chuta, ${p.keeper} voa e segura.`, `${s(p.min)} ${p.shooter} shoots, ${p.keeper} flies and holds on.`),
        L(`${s(p.min)} Defesa espetacular de ${p.keeper}!`, `${s(p.min)} Spectacular save from ${p.keeper}!`),
      ],
      'shotSave',
      p.min + 1,
      p.min,
    );
  }
  return pick(
    [
      L(`${s(p.min)} Remate de ${p.shooter} defendido pelo GR.`, `${s(p.min)} ${p.shooter}'s shot is saved by the keeper.`),
      L(`${s(p.min)} ${p.shooter} finaliza, o guarda-redes segura.`, `${s(p.min)} ${p.shooter} shoots, the keeper gathers.`),
      L(`${s(p.min)} Goleiro fecha o ângulo e defende ${p.shooter}.`, `${s(p.min)} The keeper narrows the angle and stops ${p.shooter}.`),
      L(`${s(p.min)} ${p.shooter} chuta, GR espalma para escanteio.`, `${s(p.min)} ${p.shooter} shoots, the keeper tips it behind for a corner.`),
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
        L(`${s(p.min)} ${p.shooter} chuta para fora; ${p.recoverer} repõe do fundo.`, `${s(p.min)} ${p.shooter} fires wide; goal kick to ${p.recoverer}.`),
        L(`${s(p.min)} Remate largo de ${p.shooter}; saída de ${p.recoverer}.`, `${s(p.min)} ${p.shooter} drags it wide; goal kick ${p.recoverer}.`),
        L(`${s(p.min)} ${p.shooter} erra o alvo; ${p.recoverer} repõe.`, `${s(p.min)} ${p.shooter} misses the target; ${p.recoverer} restart.`),
        L(`${s(p.min)} ${p.shooter} manda para as nuvens; saída de baliza.`, `${s(p.min)} ${p.shooter} sends it into orbit; goal kick.`),
      ],
      'shotWide',
      p.min + 2,
      p.min,
    );
  }
  return pick(
    [
      L(`${s(p.min)} ${p.shooter} chuta para fora.`, `${s(p.min)} ${p.shooter} fires wide.`),
      L(`${s(p.min)} Remate de ${p.shooter} passa ao lado.`, `${s(p.min)} ${p.shooter}'s shot goes just wide.`),
      L(`${s(p.min)} ${p.shooter} erra o alvo.`, `${s(p.min)} ${p.shooter} misses the target.`),
      L(`${s(p.min)} ${p.shooter} finaliza por cima.`, `${s(p.min)} ${p.shooter} puts it over the bar.`),
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
        L(`${s(p.min)} ${p.carrier} conduz e serve ${p.receiver}.`, `${s(p.min)} ${p.carrier} carries it and feeds ${p.receiver}.`),
        L(`${s(p.min)} ${p.carrier} avança e encontra ${p.receiver} na frente.`, `${s(p.min)} ${p.carrier} pushes on and finds ${p.receiver} up front.`),
        L(`${s(p.min)} ${p.carrier} acelera e acha ${p.receiver}.`, `${s(p.min)} ${p.carrier} accelerates and picks out ${p.receiver}.`),
        L(`${s(p.min)} Passe longo de ${p.carrier} para ${p.receiver}.`, `${s(p.min)} Long ball from ${p.carrier} to ${p.receiver}.`),
        L(`${s(p.min)} ${p.carrier} lança ${p.receiver} no espaço.`, `${s(p.min)} ${p.carrier} sends ${p.receiver} into space.`),
        L(`${s(p.min)} ${p.carrier} vê ${p.receiver} e solta.`, `${s(p.min)} ${p.carrier} spots ${p.receiver} and releases.`),
      ],
      'progress',
      p.min + p.carrier.length,
      p.min,
    );
  }
  return pick(
    [
      L(`${s(p.min)} ${p.carrier} progride bola ao pé.`, `${s(p.min)} ${p.carrier} drives forward with the ball.`),
      L(`${s(p.min)} ${p.carrier} conduz e abre espaço.`, `${s(p.min)} ${p.carrier} carries it and opens up space.`),
      L(`${s(p.min)} Arranque de ${p.carrier}; bloco avança.`, `${s(p.min)} Burst from ${p.carrier}; the team moves up.`),
      L(`${s(p.min)} ${p.carrier} ganha terreno.`, `${s(p.min)} ${p.carrier} gains ground.`),
      L(`${s(p.min)} ${p.carrier} avança pela direita.`, `${s(p.min)} ${p.carrier} advances down the right.`),
      L(`${s(p.min)} ${p.carrier} carrega e puxa a marcação.`, `${s(p.min)} ${p.carrier} carries it and draws the markers.`),
    ],
    'progress',
    p.min + p.carrier.length,
    p.min,
  );
}

export function progressLoss(p: { min: number; loser: string; winner: string }): string {
  return pick(
    [
      L(`${s(p.min)} ${p.loser} perde a bola; ${p.winner} recupera.`, `${s(p.min)} ${p.loser} loses it; ${p.winner} win it back.`),
      L(`${s(p.min)} ${p.winner} rouba a posse a ${p.loser}.`, `${s(p.min)} ${p.winner} dispossess ${p.loser}.`),
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
        L(`${s(p.min)} ${p.passer} recua para ${p.receiver}; posse circula.`, `${s(p.min)} ${p.passer} goes back to ${p.receiver}; ball moving.`),
        L(`${s(p.min)} Toque de ${p.passer} para ${p.receiver}, ritmo muda.`, `${s(p.min)} ${p.passer} to ${p.receiver}, change of tempo.`),
        L(`${s(p.min)} ${p.passer} volta a bola para ${p.receiver}.`, `${s(p.min)} ${p.passer} plays it back to ${p.receiver}.`),
        L(`${s(p.min)} ${p.passer} acha ${p.receiver} atrás; equipa respira.`, `${s(p.min)} ${p.passer} finds ${p.receiver} behind; a breather.`),
        L(`${s(p.min)} ${p.passer} devolve para ${p.receiver}, posse segura.`, `${s(p.min)} ${p.passer} returns it to ${p.receiver}, safe hands.`),
        L(`${s(p.min)} ${p.passer} toca em ${p.receiver} e reorganiza.`, `${s(p.min)} ${p.passer} plays in ${p.receiver} and resets.`),
      ],
      'recycle',
      p.min + p.passer.length,
      p.min,
    );
  }
  return pick(
    [
      L(`${s(p.min)} ${p.passer} recicla a posse.`, `${s(p.min)} ${p.passer} recycles possession.`),
      L(`${s(p.min)} ${p.passer} gira o jogo; equipa reorganiza.`, `${s(p.min)} ${p.passer} switches play; the team resets.`),
      L(`${s(p.min)} Toque seguro de ${p.passer}.`, `${s(p.min)} Safe pass from ${p.passer}.`),
      L(`${s(p.min)} ${p.passer} volta a bola e controla o ritmo.`, `${s(p.min)} ${p.passer} goes back and controls the tempo.`),
      L(`${s(p.min)} ${p.passer} recua; time respira.`, `${s(p.min)} ${p.passer} drops back; time to breathe.`),
      L(`${s(p.min)} ${p.passer} segura a posse.`, `${s(p.min)} ${p.passer} keeps possession.`),
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
        L(`${s(p.min)} ${p.recoverer} rouba alto; ${p.team} recupera.`, `${s(p.min)} ${p.recoverer} wins it high; ${p.team} back in possession.`),
        L(`${s(p.min)} Pressão de ${p.team}; ${p.recoverer} arma o contragolpe.`, `${s(p.min)} ${p.team} press; ${p.recoverer} sets up the counter.`),
      ],
      'press',
      p.min + 3,
      p.min,
    );
  }
  return L(`${s(p.min)} Marcação alta de ${p.team} sufoca a saída.`, `${s(p.min)} ${p.team}'s high press stifles the build-up.`);
}

export function clear(p: { min: number; defender?: string }): string {
  if (p.defender) {
    return pick(
      [
        L(`${s(p.min)} ${p.defender} corta e afasta o perigo.`, `${s(p.min)} ${p.defender} cuts it out and clears the danger.`),
        L(`${s(p.min)} Corte firme de ${p.defender}; bola afastada.`, `${s(p.min)} Firm clearance from ${p.defender}; ball cleared.`),
      ],
      'clear',
      p.min + 3,
      p.min,
    );
  }
  return pick(
    [
      L(`${s(p.min)} Defesa corta de cabeça e afasta.`, `${s(p.min)} The defence heads it clear.`),
      L(`${s(p.min)} Corte seco; bola para as nuvens.`, `${s(p.min)} Hoofed clear; into the stands.`),
    ],
    'clear',
    p.min + 3,
    p.min,
  );
}

export function recovery(p: { min: number; team: string; recoverer?: string }): string {
  if (p.recoverer) {
    return L(`${s(p.min)} ${p.recoverer} recupera a posse para ${p.team}.`, `${s(p.min)} ${p.recoverer} wins it back for ${p.team}.`);
  }
  return L(`${s(p.min)} ${p.team} retoma a posse.`, `${s(p.min)} ${p.team} regain possession.`);
}

export function counter(p: { min: number; leader: string }): string {
  return L(`${s(p.min)} Contra-ataque; ${p.leader} lidera a investida.`, `${s(p.min)} Counter-attack; ${p.leader} leads the charge.`);
}

// ── Faltas ───────────────────────────────────────────────

export function foulPenalty(p: { min: number; fouled: string }): string {
  return L(`${s(p.min)} Falta sobre ${p.fouled} na grande área — penalty!`, `${s(p.min)} Foul on ${p.fouled} in the box — penalty!`);
}

export function foulFreeKick(p: { min: number; fouled: string }): string {
  return L(`${s(p.min)} Falta sobre ${p.fouled}; livre perigoso.`, `${s(p.min)} Foul on ${p.fouled}; dangerous free kick.`);
}

// ── Golos ────────────────────────────────────────────────

export function goalPositional(p: { min: number; scorer: string }): string {
  return pick(
    [
      L(`${s(p.min)} GOL! ${p.scorer} explode a rede.`, `${s(p.min)} GOAL! ${p.scorer} rips the net.`),
      L(`${s(p.min)} GOL! ${p.scorer} não perdoa.`, `${s(p.min)} GOAL! ${p.scorer} makes no mistake.`),
    ],
    'goalPositional',
    p.min + p.scorer.length,
    p.min,
  );
}

export function goalCounter(p: { min: number; scorer: string }): string {
  return pick(
    [
      L(`${s(p.min)} GOL! Contra-ataque: ${p.scorer} fuzila o GR.`, `${s(p.min)} GOAL! On the counter: ${p.scorer} beats the keeper.`),
      L(`${s(p.min)} GOL! Transição letal — ${p.scorer} conclui.`, `${s(p.min)} GOAL! Lethal transition — ${p.scorer} finishes.`),
    ],
    'goalCounter',
    p.min + p.scorer.length,
    p.min,
  );
}

export function goalPostIn(p: { min: number; scorer: string }): string {
  return pick(
    [
      L(`${s(p.min)} GOL! Trave e para dentro — ${p.scorer}!`, `${s(p.min)} GOAL! Off the post and in — ${p.scorer}!`),
      L(`${s(p.min)} GOL! A bola bate na trave e entra; ${p.scorer}.`, `${s(p.min)} GOAL! It hits the post and goes in; ${p.scorer}.`),
    ],
    'goalPostIn',
    p.min + p.scorer.length,
    p.min,
  );
}

export function goalAwayPositional(p: { min: number; scorer: string; team: string }): string {
  return pick(
    [
      L(`${s(p.min)} GOL do ${p.team}! ${p.scorer} marca.`, `${s(p.min)} GOAL for ${p.team}! ${p.scorer} scores.`),
      L(`${s(p.min)} GOL! ${p.scorer} (${p.team}) fura o bloqueio.`, `${s(p.min)} GOAL! ${p.scorer} (${p.team}) breaks through.`),
    ],
    'goalAwayPositional',
    p.min + 7,
    p.min,
  );
}

export function goalAwayCounter(p: { min: number; scorer: string; team: string }): string {
  return pick(
    [
      L(`${s(p.min)} GOL do ${p.team}! Contra-ataque; ${p.scorer} castiga.`, `${s(p.min)} GOAL for ${p.team}! On the counter; ${p.scorer} punishes them.`),
      L(`${s(p.min)} GOL! ${p.scorer} conclui transição do ${p.team}.`, `${s(p.min)} GOAL! ${p.scorer} finishes the ${p.team} break.`),
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
        L(`${s(p.min)} ${p.shooter} (${p.team}) chuta para fora; ${p.recoverer} repõe.`, `${s(p.min)} ${p.shooter} (${p.team}) fires wide; ${p.recoverer} restart.`),
        L(`${s(p.min)} Remate do ${p.team} por ${p.shooter} para fora; saída de ${p.recoverer}.`, `${s(p.min)} ${p.shooter} shoots wide for ${p.team}; goal kick ${p.recoverer}.`),
      ],
      'awayShotWide',
      p.min + 5,
      p.min,
    );
  }
  return pick(
    [
      L(`${s(p.min)} ${p.shooter} (${p.team}) finaliza para fora.`, `${s(p.min)} ${p.shooter} (${p.team}) shoots wide.`),
      L(`${s(p.min)} Remate do ${p.team} passa ao lado.`, `${s(p.min)} ${p.team}'s shot goes wide.`),
    ],
    'awayShotWide',
    p.min + 5,
    p.min,
  );
}

export function awayBuild(p: { min: number; team: string }): string {
  return L(`${s(p.min)} ${p.team} constrói jogada.`, `${s(p.min)} ${p.team} build an attack.`);
}

export function turnover(p: { min: number; team: string }): string {
  return L(`${s(p.min)} ${p.team} retoma a posse.`, `${s(p.min)} ${p.team} regain possession.`);
}

export function noCarrierRecycle(p: { min: number; team: string }): string {
  return L(`${s(p.min)} ${p.team} recua para reorganizar.`, `${s(p.min)} ${p.team} drop back to regroup.`);
}

/**
 * Bridge: GlobalMatchScheduler (ciclo 5min) → Coach Agent dispatches.
 *
 * Em cada transição de janela do ciclo de 5min, dispara o gerador
 * proativo do coach correspondente. O coach já trata dedupe e auto-execução.
 */

import { dispatchGame } from '@/game/store';
import { getGlobalScheduler } from './globalMatchScheduler';
import type { CycleWindowPhase, GlobalRound } from './globalMatch';

let installed = false;

/**
 * Instala o bridge (idempotente). Chame uma vez no boot da app.
 * O scheduler já deve estar startado — ou então starte aqui também.
 */
export function installCycleCoachBridge(opts: { autoStart?: boolean } = {}) {
  if (installed) return;
  installed = true;

  const scheduler = getGlobalScheduler();

  const handleWindowChange = (phase: CycleWindowPhase, round: GlobalRound) => {
    const opponent = nextOpponentLabel(round);
    switch (phase) {
      case 'recovery':
        dispatchGame({ type: 'COACH_GENERATE_HEALTH_ACTIONS' });
        break;
      case 'training':
        dispatchGame({ type: 'COACH_GENERATE_TRAINING_ACTIONS' });
        break;
      case 'tactical':
        dispatchGame({ type: 'COACH_GENERATE_TACTICAL_ACTIONS', opponentContext: opponent });
        break;
      case 'lock':
        // 1 min antes do kickoff: briefing
        dispatchGame({ type: 'COACH_GENERATE_BRIEFING', opponentContext: opponent });
        break;
      case 'live':
      case 'finished':
        // sem ação proativa enquanto vive ou ao terminar — pós-jogo é do GameSpirit.
        break;
    }
  };

  if (opts.autoStart) {
    scheduler.start(undefined, handleWindowChange);
  } else {
    // Re-start preservando handler já registrado, se houver.
    scheduler.start(undefined, handleWindowChange);
  }
}

/** Heurística simples: pega o primeiro fixture do round como "oponente". */
function nextOpponentLabel(round: GlobalRound): string | undefined {
  const f = round.fixtures[0];
  if (!f) return undefined;
  return f.awayTeamName || f.homeTeamName;
}

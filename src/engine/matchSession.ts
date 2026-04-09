/**
 * Sessão de partida — contrato partilhado pelos três modos (`live` | `quick` | `auto`).
 *
 * - **Resolução**: `runMatchMinute`, `runMatchMinuteBulk`, `advanceMatchToPostgame` (`./runMatchMinute`, `./matchBulk`).
 * - **Início**: `START_LIVE_MATCH` com `mode` no `gameReducer`.
 * - **Fim**: `FINALIZE_MATCH` — EXP, forma, histórico, `leagueSeason`, recuperação de lesões/suspensões (`tickRecoveryMatches`).
 *
 * Lesões (`rollMatchInjury`), cartões (`rollMatchDiscipline`) e auto-sub após vermelho (`applyRedCardAutoSub`)
 * correm dentro de `runMatchMinute` para modos que o usam. Partida **ao vivo** (Babylon): placar, eventos e
 * estatísticas vêm do `TacticalSimLoop` + `SIM_SYNC` no reducer, não de `runMatchMinute`.
 */

export type { MatchMode } from './types';

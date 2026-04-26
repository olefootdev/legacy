import type { PitchPoint, PossessionSide } from '@/engine/types';
import type { BallZone } from '@/gamespirit/types';

/** Qualidade de contacto no remate (efeito em precisão / xG e leitura visual). */
export type ShotStrikeProfile = 'weak' | 'placed' | 'power' | 'header';

/** Fases lógicas do motor textual (minuto a minuto), independentes do FSM do pitch 3D. */
export type EngineSimPhase = 'LIVE' | 'GOAL_RESTART' | 'KICKOFF_PENDING' | 'STOPPED';

/**
 * Evento causal append-only: placar, bola e posse só mudam com entrada coerente no log.
 * `simTime` ordena eventos no mesmo minuto (fração decimal).
 */
export type CausalMatchEvent =
  | {
      seq: number;
      simTime: number;
      type: 'shot_attempt';
      payload: {
        side: PossessionSide;
        shooterId: string;
        zone: BallZone;
        minute: number;
        /** Alvo heurístico da trajetória (UI %), opcional */
        target?: PitchPoint;
        /** Perfil de remate (fraco / colocado / forte); omitido em logs antigos. */
        strike?: ShotStrikeProfile;
      };
    }
  | {
      seq: number;
      simTime: number;
      type: 'shot_result';
      payload: {
        side: PossessionSide;
        shooterId: string;
        /** `post_in` conta como golo; `wide` = remate ao lado (reinício / posse). */
        outcome: 'goal' | 'save' | 'miss' | 'block' | 'post_in' | 'post_out' | 'wide';
        strike?: ShotStrikeProfile;
        /** Defesa com espalma vs segurar — só `save`; UI / replay. */
        saveKind?: 'parry' | 'hold';
        /** Destaque do duelo com o GR (narrativa / replay). */
        gkHighlight?: 'spectacular_save' | 'gk_blunder_goal' | 'world_class_goal';
      };
    }
  | {
      seq: number;
      simTime: number;
      type: 'phase_change';
      payload: { from: EngineSimPhase; to: EngineSimPhase; reason?: string };
    }
  | {
      seq: number;
      simTime: number;
      type: 'ball_state';
      payload: PitchPoint & { reason: string };
    }
  | {
      seq: number;
      simTime: number;
      type: 'possession_change';
      payload: { to: PossessionSide; reason?: string };
    }
  /**
   * Falta no fluxo contínuo (ex.: desarme tardio). Não altera placar;
   * feed/UI derivam texto; replay ordena por simTime com shot/possession.
   */
  | {
      seq: number;
      simTime: number;
      type: 'foul_committed';
      payload: {
        minute: number;
        foulerId: string;
        foulerSide: PossessionSide;
        victimId: string;
        /** ex.: tackle | draw_foul */
        kind: string;
        dangerous: boolean;
        /** Leve / firme / criminosa — influencia cartão no motor contínuo. */
        severity?: 'light' | 'firm' | 'ugly';
      };
    }
  /** Cartão mostrado no loop contínuo (amarelo frequente, vermelho raro). */
  | {
      seq: number;
      simTime: number;
      type: 'card_shown';
      payload: {
        minute: number;
        playerId: string;
        side: PossessionSide;
        card: 'yellow' | 'red';
        reason?: string;
      };
    }
  /**
   * Motor tático: reorganização forçada (log causal — não narrativa de UI).
   * Disparado quando o árbitro lógico deteta confusão no log ou ajuntamento espacial.
   */
  | {
      seq: number;
      simTime: number;
      type: 'referee_shape_reset';
      payload: {
        minute: number;
        reason: 'causal_whirlwind' | 'spatial_swarm' | 'box_clump_gk_foul' | 'box_clump_attacker_foul';
        awardedSide: PossessionSide;
      };
    }
  /**
   * Drible tentado (evento discreto pra estatísticas pós-jogo).
   * Sucesso: carregador passa o defensor; fracasso: desarme implícito (NÃO emite `foul_committed`).
   */
  | {
      seq: number;
      simTime: number;
      type: 'dribble_attempt';
      payload: {
        minute: number;
        carrierId: string;
        carrierSide: PossessionSide;
        defenderId: string | null;
        success: boolean;
      };
    }
  /**
   * Interceptação (corte de passe/avanço sem desarme direto).
   */
  | {
      seq: number;
      simTime: number;
      type: 'interception';
      payload: {
        minute: number;
        defenderId: string;
        defenderSide: PossessionSide;
        zone: 'def' | 'mid' | 'att';
      };
    }
  /**
   * Escanteio (derivado de remate `block`/`wide` ou falta na área).
   * Próximo tick usa hint de set-piece para forçar cruzamento + cabeçada.
   */
  | {
      seq: number;
      simTime: number;
      type: 'corner_kick';
      payload: {
        minute: number;
        side: PossessionSide;
      };
    }
  /**
   * Signature Move usado (meta-progressão).
   * Registra quando jogador usa move especial desbloqueado.
   */
  | {
      seq: number;
      simTime: number;
      type: 'signature_move_used';
      payload: {
        playerId: string;
        playerName: string;
        moveId: string;
        moveName: string;
        xGBoost: number;
        minute: number;
      };
    }
  /**
   * Lateral cobrado: bola saiu pela linha lateral.
   * `awardedTo` = lado que cobra (oposto de quem tocou por último).
   */
  | {
      seq: number;
      simTime: number;
      type: 'throw_in';
      payload: {
        minute: number;
        awardedTo: PossessionSide;
        zone: 'def' | 'mid' | 'att';
      };
    }
  /**
   * Tiro de meta: bola saiu pela linha de fundo defendida (atacante chutou pra fora ou rebote).
   * `awardedTo` = goleiro do time que defende.
   */
  | {
      seq: number;
      simTime: number;
      type: 'goal_kick';
      payload: {
        minute: number;
        awardedTo: PossessionSide;
      };
    };

export interface CausalLogState {
  /** Próximo seq a atribuir (monotónico na partida). */
  nextSeq: number;
  entries: CausalMatchEvent[];
}

/** Stress test2d / partidas longas: muitos micro-eventos; manter histórico completo para replay/disciplina. */
const MAX_CAUSAL_ENTRIES = 25_000;

export function appendCausalEntries(state: CausalLogState | undefined, batch: CausalMatchEvent[]): CausalLogState {
  const prev = state ?? { nextSeq: 1, entries: [] };
  if (batch.length === 0) return prev;
  const merged = [...prev.entries, ...batch];
  const trimmed = merged.length > MAX_CAUSAL_ENTRIES ? merged.slice(-MAX_CAUSAL_ENTRIES) : merged;
  const lastSeq = batch.length ? batch[batch.length - 1]!.seq : prev.nextSeq - 1;
  return {
    nextSeq: lastSeq + 1,
    entries: trimmed,
  };
}

/** Incrementa placar só a partir de `shot_result` com outcome goal neste lote. */
export function scoreDeltaFromEvents(events: CausalMatchEvent[]): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const e of events) {
    if (
      e.type === 'shot_result' &&
      (e.payload.outcome === 'goal' || e.payload.outcome === 'post_in')
    ) {
      if (e.payload.side === 'home') home += 1;
      else away += 1;
    }
  }
  return { home, away };
}

/**
 * Validação para testes / debug: cada goal no lote tem shot_attempt do mesmo shooter antes do shot_result.
 */
export function validateGoalChain(events: CausalMatchEvent[]): boolean {
  let pendingShot: { side: PossessionSide; shooterId: string } | null = null;

  for (const e of events) {
    if (e.type === 'shot_attempt') {
      pendingShot = { side: e.payload.side, shooterId: e.payload.shooterId };
    } else if (e.type === 'shot_result') {
      if (e.payload.outcome === 'goal' || e.payload.outcome === 'post_in') {
        if (!pendingShot || pendingShot.shooterId !== e.payload.shooterId || pendingShot.side !== e.payload.side) {
          return false;
        }
      }
      pendingShot = null;
    }
  }
  return true;
}

export function createCausalBatch(minute: number, startSeq: number) {
  const out: CausalMatchEvent[] = [];
  let seq = startSeq;
  let ord = 0;
  const simT = () => minute + ord++ * 0.001;

  return {
    push(event: Omit<CausalMatchEvent, 'seq' | 'simTime'>): void {
      const simTime = simT();
      out.push({ ...event, seq: seq++, simTime } as CausalMatchEvent);
    },
    events: out,
    lastSeq: () => seq - 1,
  };
}

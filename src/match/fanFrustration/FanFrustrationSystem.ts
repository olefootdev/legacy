import type { PlayerEntity } from '@/entities/types';
import type { PlayerMatchRuntime, PlayerMatchRuntime as PR } from '@/match/playerInMatch';
import type { MatchTacticalRole } from '@/match/playerInMatch';

export type PlayerID = string;

export interface GameState {
  // Allow host to attach transient fields on player objects for rule detection (prefixed with _)
  players: Record<PlayerID, PlayerEntity & Record<string, any> & { runtime?: PlayerMatchRuntime; slot?: string; position?: MatchTacticalRole }>;
  ball?: any;
  teams?: any;
  timestamp?: number;
  // Freeform additional properties used by condition lambdas in rules
  [k: string]: any;
}

export interface FrustrationRule {
  id: string;
  position?: MatchTacticalRole | 'COLLECTIVE';
  condition: (state: GameState, playerId?: PlayerID) => boolean;
  penalty: number;
  multiplierOnRepeat?: number;
  eventType: string;
}

export interface FrustrationEvent {
  type: string;
  jogador?: PlayerID | null;
  penalidade: number;
  acumulado: boolean;
  ruleId: string;
}

export type FanReaction = 'none' | 'vaias_leves' | 'vaias_fortes' | 'protesto';

type Handler<T> = (payload: T) => void;

export class FanFrustrationSystem {
  private fanMood = 100;
  private rules: FrustrationRule[];
  private repeatCounters = new Map<string, number>();
  private listeners = new Map<string, Set<Function>>();

  constructor(rules: FrustrationRule[]) {
    this.rules = rules;
  }

  getFanMood(): number {
    return Math.max(0, Math.min(100, Math.round(this.fanMood)));
  }

  on<T>(eventName: string, cb: Handler<T>) {
    const s = this.listeners.get(eventName) ?? new Set();
    s.add(cb as Function);
    this.listeners.set(eventName, s);
    return () => this.off(eventName, cb as Function);
  }

  off(eventName: string, cb: Function) {
    const s = this.listeners.get(eventName);
    if (!s) return;
    s.delete(cb);
  }

  private emit<T>(eventName: string, payload: T) {
    const s = this.listeners.get(eventName);
    if (!s) return;
    for (const cb of s) {
      try {
        (cb as Handler<T>)(payload);
      } catch (e) {
        // swallow listener errors
        // console.error('FanFrustration listener error', e);
      }
    }
  }

  evaluate(state: GameState): FrustrationEvent[] {
    const events: FrustrationEvent[] = [];
    // Evaluate per-player rules
    for (const rule of this.rules) {
      if (rule.position === 'COLLECTIVE') continue;
      for (const playerId of Object.keys(state.players || {})) {
        const player = state.players[playerId];
  // position filter: support transient player.position or legacy fields (pos / zone)
  const role = getPlayerRole(player);
  if (rule.position && role !== rule.position) continue;
        if (rule.condition(state, playerId)) {
          const ev = this.applyPenalty(rule, playerId);
          events.push(ev);
        }
      }
    }

    // Evaluate collective rules
    for (const rule of this.rules.filter((r) => r.position === 'COLLECTIVE')) {
      if (rule.condition(state)) {
        const ev = this.applyPenalty(rule, null);
        events.push(ev);
      }
    }

    if (events.length > 0) {
      this.emitReaction();
    }

    return events;
  }

  applyPenalty(rule: FrustrationRule, playerId: PlayerID | null): FrustrationEvent {
    const key = `${rule.id}:${playerId ?? 'COL'}`;
    const prev = this.repeatCounters.get(key) ?? 0;
    const next = prev + 1;
    this.repeatCounters.set(key, next);

    const multiplier = rule.multiplierOnRepeat && prev > 0 ? Math.pow(rule.multiplierOnRepeat, prev) : 1;
    const rawPenalty = rule.penalty * multiplier;
    // Reduce fanMood but never below 0
    this.fanMood = Math.max(0, this.fanMood - rawPenalty);

    const accumulated = prev > 0;

    const ev: FrustrationEvent = {
      type: rule.eventType,
      jogador: playerId,
      penalidade: -Math.abs(rawPenalty),
      acumulado: accumulated,
      ruleId: rule.id,
    };

    this.emit('FrustrationEvent', ev);

    // Emit fan reaction snapshot
    const reaction = this.currentReaction();
    this.emit('FanReaction', { reaction, fanMood: this.getFanMood() });

    // Emit commentator cue
  this.emit('CommentatorReaction', { line: this.commentatorLineForRule(rule), ruleId: rule.id, playerId });

    // Apply morale penalty on player if available
    if (playerId) {
      const m = (this as any).applyMoralePenaltyToPlayer ?? this._applyMoralePenalty;
      try {
        m.call(this, playerId, rawPenalty);
      } catch (e) {
        // ignore if caller doesn't provide context
      }
    }

    return ev;
  }

  private commentatorLineForRule(rule: FrustrationRule): string {
    switch (rule.id) {
      case 'ATACANTE_PASSA_EM_POSICAO_GOL':
        return 'Que passe!... poderia ter sido gol.';
      case 'ATACANTE_RECUA_PARA_GOLEIRO':
        return 'Inacreditável recuo ao goleiro em chance de finalização.';
      case 'PONTA_RECUA_1x1':
        return 'Ponta que recua num 1x1? A torcida não perdoa.';
      case 'GOLEIRO_CERA':
        return 'Goleiro faz cera e irrita a torcida.';
      case 'LATERAL_NAO_AVANCA':
        return 'Lateral que não acompanha o ataque e mata a jogada.';
      default:
        return 'A torcida não gostou da jogada.';
    }
  }

  private _applyMoralePenalty(playerId: PlayerID, rawPenalty: number) {
    // Best-effort: if the system has access to a players map (not by default), try to reduce moraleRuntime
    // This is a noop here; host code may subscribe to FrustrationEvent and apply exact morale logic.
  }

  emitReaction(): FanReaction {
    const r = this.currentReaction();
    this.emit('FanReaction', { reaction: r, fanMood: this.getFanMood() });
    return r;
  }

  currentReaction(): FanReaction {
    const mood = this.getFanMood();
    if (mood < 40) return 'protesto';
    if (mood < 60) return 'vaias_fortes';
    if (mood < 80) return 'vaias_leves';
    return 'none';
  }

  reset() {
    this.fanMood = 100;
    this.repeatCounters.clear();
  }

  // Helper used by tests / host to reduce a player's morale when event occurs.
  // Host can override by assigning system.applyMoralePenaltyToPlayer = (id,n)=>{...}
  applyMoralePenaltyToPlayer(playerId: PlayerID, amount: number) {
    // default: nop
  }
}

export const FrustrationRulesRegistry: FrustrationRule[] = [
  // Attacker passes in scoring position
  {
    id: 'ATACANTE_PASSA_EM_POSICAO_GOL',
    position: 'atacante',
    condition: (s, pid) => {
      if (!pid) return false;
      const ctx = s.players?.[pid] ?? {};
      return Boolean(getTransient(ctx, '_lastAction') === 'PASS_IN_GOOD_SPOT');
    },
    penalty: 25,
    multiplierOnRepeat: 1.5,
    eventType: 'ATACANTE_PASSA_EM_POSICAO_GOL',
  },

  // Attacker passes back to goalkeeper inside chance
  {
    id: 'ATACANTE_RECUA_PARA_GOLEIRO',
    position: 'atacante',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(getTransient(p, '_lastAction') === 'PASS_TO_KEEPER_IN_SHOT_RANGE');
    },
    penalty: 15,
    multiplierOnRepeat: 1.3,
    eventType: 'ATACANTE_RECUA_PARA_GOLEIRO',
  },

  // Winger (ponta) recues on 1x1
  {
    id: 'PONTA_RECUA_1x1',
    position: 'ponta',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(getTransient(p, '_lastAction') === 'RECUAR_ON_1V1');
    },
    penalty: 12,
    multiplierOnRepeat: 1.4,
    eventType: 'PONTA_RECUA_1X1',
  },

  // Goalkeeper time-wasting
  {
    id: 'GOLEIRO_CERA',
    position: 'goleiro',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      // expect host to set runtime._secondsStopped and team context
      return Boolean(p && (p as any)._secondsStopped > 5 && (s as any).teamHasSmallLead === true);
    },
    penalty: 10,
    multiplierOnRepeat: 1.4,
    eventType: 'GOLEIRO_CERA',
  },

  // Fullback not advancing
  {
    id: 'LATERAL_NAO_AVANCA',
    position: 'lateral',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      // host sets _timeInAttackWithoutCrossMidline in seconds and posX for side
      return Boolean(p && (p as any)._timeInAttackWithoutCrossMidline > 15 && (p as any)._posX < (s as any)._midlineX);
    },
    penalty: 8,
    multiplierOnRepeat: 1.2,
    eventType: 'LATERAL_NAO_AVANCA',
  },

  // Defensive rifar
  {
    id: 'ZAGUEIRO_RIFA',
    position: 'zagueiro',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && (p as any)._lastAction === 'RIFAR_UNDER_PRESSURE');
    },
    penalty: 6,
    multiplierOnRepeat: 1.2,
    eventType: 'ZAGUEIRO_RIFA',
  },

  // Midfielder hoarding ball
  {
    id: 'MEIA_SEGURA_BOLA',
    position: 'meia',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && (p as any)._timeWithBall > 4 && (p as any)._teammateFree === true);
    },
    penalty: 5,
    multiplierOnRepeat: 1.2,
    eventType: 'MEIA_SEGURA_BOLA',
  },

  // MEIA: only lateral passing without progression
  {
    id: 'MEIA_SOMENTE_LATERAL',
    position: 'meia',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && (p as any)._direcaoPasses === 'LATERAL' && (p as any)._sequenciaPasses > 5);
    },
    penalty: 2,
    multiplierOnRepeat: 1.1,
    eventType: 'MEIA_SOMENTE_LATERAL',
  },

  // VOLANTE se esconde
  {
    id: 'VOLANTE_SE_ESCONDE',
    position: 'volante',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && (p as any)._distanciaBola > 20 && (s as any)._possePropria === true);
    },
    penalty: 4,
    multiplierOnRepeat: 1.2,
    eventType: 'VOLANTE_SE_ESCONDE',
  },

  // MEIA criativo não tenta vertical
  {
    id: 'MEIA_NAO_VERTICALIZA',
    position: 'meia',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && (p as any)._espacoVerticalLivre === true && getTransient(p, '_escolha') === 'LATERAL');
    },
    penalty: 4,
    multiplierOnRepeat: 1.2,
    eventType: 'MEIA_NAO_VERTICALIZA',
  },

  // MEIA domina e precisa 3+ toques
  {
    id: 'MEIA_DOMINA_MUITO',
    position: 'meia',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && (p as any)._toquesAntesDePassar > 2 && (p as any)._pressao < 30);
    },
    penalty: 3,
    multiplierOnRepeat: 1.1,
    eventType: 'MEIA_DOMINA_MUITO',
  },

  // PONTA: não tenta drible em vantagem posicional
  {
    id: 'PONTA_NAO_TENTA_DRIBLE_VANTAGEM',
    position: 'ponta',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && (p as any)._vantagemPosicional === true && getTransient(p, '_acao') === 'PASSE_SEGURO');
    },
    penalty: 8,
    multiplierOnRepeat: 1.3,
    eventType: 'PONTA_NAO_TENTA_DRIBLE_VANTAGEM',
  },

  // PONTA: tenta driblar sempre e nunca passa
  {
    id: 'PONTA_TENTA_DRIBLAR_SEMPRE',
    position: 'ponta',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && (p as any)._tentativasDribleConsecutivas > 3);
    },
    penalty: 6,
    multiplierOnRepeat: 1.2,
    eventType: 'PONTA_TENTA_DRIBLAR_SEMPRE',
  },

  // PONTA não recompõe
  {
    id: 'PONTA_NAO_RECOMPOE',
    position: 'ponta',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && getTransient(s, '_bolaPerdida') === true && getTransient(p, '_pontaPosicao') === 'OFENSIVO' && getTransient(s, '_lateralDesprotegido') === true);
    },
    penalty: 7,
    multiplierOnRepeat: 1.2,
    eventType: 'PONTA_NAO_RECOMPOE',
  },

  // ATACANTE domina e faz passe em vez de finalizar
  {
    id: 'ATACANTE_PASSA_EM_POS_FINAL',
    position: 'atacante',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && (p as any)._probabilidadeGol > 35 && getTransient(p, '_escolha') === 'PASSE');
    },
    penalty: 18,
    multiplierOnRepeat: 1.3,
    eventType: 'ATACANTE_PASSA_EM_POS_FINAL',
  },

  // ATACANTE estatico sem atacar profundidade
  {
    id: 'ATACANTE_ESTATIVO_NAO_PROFUNDA',
    position: 'atacante',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && (p as any)._espacoProfundidadeLivre === true && (p as any)._estatico === true);
    },
    penalty: 6,
    multiplierOnRepeat: 1.2,
    eventType: 'ATACANTE_ESTATIVO_NAO_PROFUNDA',
  },

  // ATACANTE finaliza fraco ou no goleiro frequentemente
  {
    id: 'ATACANTE_FINALIZA_FRACO',
    position: 'atacante',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && ((p as any)._forcaChute < 40 || ((p as any)._direcao === 'CENTRO_GOL' && (p as any)._frequenciaFinalizacao > 60)));
    },
    penalty: 7,
    multiplierOnRepeat: 1.2,
    eventType: 'ATACANTE_FINALIZA_FRACO',
  },

  // ATACANTE não acompanha rebote
  {
    id: 'ATACANTE_NAO_ACOMPANHA_REBOTE',
    position: 'atacante',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && getTransient(s, '_reboteDisponivel') === true && (p as any)._distanciaARebote > 10);
    },
    penalty: 5,
    multiplierOnRepeat: 1.1,
    eventType: 'ATACANTE_NAO_ACOMPANHA_REBOTE',
  },

  // ATACANTE não pressiona quando necessário
  {
    id: 'ATACANTE_PASSIVO_QUANDO_PRECISA',
    position: 'atacante',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && (s as any)._pressaoSolicitada === true && (p as any)._passivo === true);
    },
    penalty: 6,
    multiplierOnRepeat: 1.2,
    eventType: 'ATACANTE_PASSIVO',
  },

  // GOLEIRO: lento na reposição com contra-ataque claro
  {
    id: 'GOLEIRO_LENTO_REPOSICAO',
    position: 'goleiro',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && (p as any)._tempoReposicao > 4 && (s as any)._contraAtaque === true);
    },
    penalty: 12,
    multiplierOnRepeat: 1.2,
    eventType: 'GOLEIRO_LENTO_REPOSICAO',
  },

  // GOLEIRO: sai jogando curto sob pressao e perde
  {
    id: 'GOLEIRO_CURTO_SOB_PRESSAO',
    position: 'goleiro',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && (s as any)._pressaoAdversario > 70 && getTransient(p, '_escolha') === 'CURTO' && getTransient(p, '_perdeuBola') === true);
    },
    penalty: 10,
    multiplierOnRepeat: 1.3,
    eventType: 'GOLEIRO_CURTO_SOB_PRESSAO',
  },

  // GOLEIRO não sai em bola óbvia na pequena área
  {
    id: 'GOLEIRO_NAO_SAI_PEQUENA_AREA',
    position: 'goleiro',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && getTransient(s, '_bolaNaAreaPequena') === true && getTransient(p, '_goleiroParado') === true);
    },
    penalty: 12,
    multiplierOnRepeat: 1.3,
    eventType: 'GOLEIRO_NAO_SAI_PEQUENA_AREA',
  },

  // GOLEIRO rebate para centro da area
  {
    id: 'GOLEIRO_REBATE_CENTRO',
    position: 'goleiro',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && getTransient(p, '_reboteZona') === 'CENTRO_AREA');
    },
    penalty: 9,
    multiplierOnRepeat: 1.2,
    eventType: 'GOLEIRO_REBATE_CENTRO',
  },

  // ZAGUEIRO: apenas toca para tras sem progressao
  {
    id: 'ZAGUEIRO_TOCA_PARA_TRAS',
    position: 'zagueiro',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && (p as any)._passesProgressivos === 0 && (p as any)._sequenciaPasses > 4);
    },
    penalty: 5,
    multiplierOnRepeat: 1.1,
    eventType: 'ZAGUEIRO_TOCA_PARA_TRAS',
  },

  // ZAGUEIRO inventa drible e perde bola
  {
    id: 'ZAGUEIRO_DRIBLA_E_PERDE',
    position: 'zagueiro',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && getTransient(p, '_zona') === 'DEFESA' && getTransient(p, '_acao') === 'DRIBLE' && getTransient(p, '_perdeuBola') === true);
    },
    penalty: 6,
    multiplierOnRepeat: 1.2,
    eventType: 'ZAGUEIRO_DRIBLA_E_PERDE',
  },

  // ZAGUEIRO não acompanha atacante
  {
    id: 'ZAGUEIRO_NAO_ACOMPANHA',
    position: 'zagueiro',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && getTransient(p, '_marcacaoPerdida') === true && (p as any)._distanciaAtacante > 5);
    },
    penalty: 6,
    multiplierOnRepeat: 1.2,
    eventType: 'ZAGUEIRO_NAO_ACOMPANHA',
  },

  // ZAGUEIRO parado no cruzamento
  {
    id: 'ZAGUEIRO_PARADO_CROSS',
    position: 'zagueiro',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && getTransient(s, '_cruzamentoNaArea') === true && getTransient(p, '_acao') === 'NENHUMA');
    },
    penalty: 6,
    multiplierOnRepeat: 1.1,
    eventType: 'ZAGUEIRO_PARADO_CROSS',
  },

  // LATERAL sobe sem cobertura deixando buraco
  {
    id: 'LATERAL_SOBE_SEM_COBERTURA',
    position: 'lateral',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && getTransient(p, '_lateralAvancado') === true && getTransient(s, '_coberturaDefensiva') === 'NENHUMA');
    },
    penalty: 7,
    multiplierOnRepeat: 1.2,
    eventType: 'LATERAL_SOBE_SEM_COBERTURA',
  },

  // LATERAL cruza sem receptor
  {
    id: 'LATERAL_CRUZA_SEM_RECEPTOR',
    position: 'lateral',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && getTransient(p, '_cruzamentoSemReceptorLivre') === true);
    },
    penalty: 6,
    multiplierOnRepeat: 1.1,
    eventType: 'LATERAL_CRUZA_SEM_RECEPTOR',
  },

  // LATERAL recebe livre e demora
  {
    id: 'LATERAL_DECISAO_LENTA',
    position: 'lateral',
    condition: (s, pid) => {
      if (!pid) return false;
      const p = s.players?.[pid];
      return Boolean(p && (p as any)._tempoDecisao > 3 && (p as any)._pressao < 20);
    },
    penalty: 5,
    multiplierOnRepeat: 1.1,
    eventType: 'LATERAL_DECISAO_LENTA',
  },

  // Collective: disconnection of block
  {
    id: 'COLETIVO_DESCONECTADO',
    position: 'COLLECTIVE',
    condition: (s) => Boolean((s as any)._defenceToMidDisconnect === true),
    penalty: 4,
    multiplierOnRepeat: 1.3,
    eventType: 'DESCONEXAO_BLOCO',
  },

  // Collective: lack of tactical variation per match
  {
    id: 'COLETIVO_SEM_VARIACAO',
    position: 'COLLECTIVE',
    condition: (s) => Boolean((s as any)._tacticalVariationPercent !== undefined && (s as any)._tacticalVariationPercent < 20),
    penalty: 3,
    multiplierOnRepeat: 1.1,
    eventType: 'SEM_VARIACAO_TATICA',
  },
];

export default FanFrustrationSystem;

function getTransient(obj: any, key: string): any {
  if (!obj) return undefined;
  try {
    return obj[key];
  } catch (e) {
    return undefined;
  }
}

function getPlayerRole(player: any): MatchTacticalRole | undefined {
  if (!player) return undefined;
  if (player.position) return player.position;
  const p = (player.pos || '').toLowerCase();
  if (p.startsWith('gol') || p === 'goleiro') return 'goleiro';
  if (p.startsWith('zag') || p === 'zagueiro') return 'zagueiro';
  if (p.startsWith('lat') || p === 'lateral') return 'lateral';
  if (p === 'vol' || p === 'volante') return 'volante';
  if (p.startsWith('mei') || p === 'meia' || p === 'mc') return 'meia';
  if (p.startsWith('pon') || p === 'ponta') return 'ponta';
  if (p.startsWith('ata') || p === 'atacante') return 'atacante';
  if (player.zone === 'defesa') return 'zagueiro';
  if (player.zone === 'meio') return 'meia';
  if (player.zone === 'ataque') return 'atacante';
  return undefined;
}


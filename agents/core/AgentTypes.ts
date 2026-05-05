// ── Field coordinate system ───────────────────────────────────────────────────
// x: 0 (home goal) → 100 (away goal)   — depth / length
// y: 0 (left edge) → 100 (right edge)  — width
// Both axes normalized 0–100.

export interface Vec2 {
  x: number;
  y: number;
}

// ── Positions ─────────────────────────────────────────────────────────────────
export type PositionId =
  | 'GK'
  | 'CB_L' | 'CB_R' | 'LB' | 'RB'
  | 'LM'   | 'CM_L' | 'CM_R' | 'RM'
  | 'ST_L' | 'ST_R';

export type RoleId = 'defensive' | 'support' | 'offensive';

export type ArchetypeId = 'defensive' | 'balanced' | 'offensive' | 'aggressive';

// ── Intentions — mapeiam diretamente os princípios do ebook "Táctica do Zero" ─
export type Intention =
  // COM BOLA
  | 'FINISH'            // Finalização — chute ao gol (zona 4, distância < threshold)
  | 'PASS'              // Apoio/Circulação — dar continuidade, evitar perda
  | 'DRIBBLE'           // Superioridade qualitativa — 1x1 quando há espaço
  | 'PROGRESS'          // Progressão — conduzir em direção ao gol
  | 'HOLD_UP'           // Hold-up — segurar a bola de costas, esperar apoio (ST)
  // SEM BOLA — FASE OFENSIVA
  | 'RUN_BEHIND'        // Desmarque de ruptura — ultrapassar o portador, correr nas costas
  | 'SUPPORT_BALL'      // Desmarque de apoio — oferecer opção próxima ao portador
  | 'OVERLAP'           // Desdobramento — lateral/meia projeta-se pelo corredor
  | 'HOLD_WIDTH'        // Amplitude — manter largura para esticar a defesa
  // SEM BOLA — FASE DEFENSIVA
  | 'PRESS'             // Pressionamento — ir ao encontro do portador adversário
  | 'COVER'             // Cobertura — apoiar companheiro que está marcando
  | 'TRACK_RUNNER'      // Vigilância — seguir adversário sem bola perigoso
  | 'DELAY'             // Temporização — frear sem entrar no duelo, aguardar ajuda
  | 'RECOVER'           // Recuo — retornar à posição defensiva
  | 'HOLD_SHAPE';       // Manter bloco — compactar, não sair da zona

// ── Actions ───────────────────────────────────────────────────────────────────
export type ActionType =
  | 'MOVE'
  | 'RUN'
  | 'PASS'
  | 'SHOOT'
  | 'TACKLE'
  | 'HOLD';

export interface AgentAction {
  type: ActionType;
  target?: Vec2;   // destination for MOVE/RUN, or target player position for PASS
}

// ── Behavior bias ─────────────────────────────────────────────────────────────
export type BehaviorBias = 'defensive' | 'balanced' | 'offensive';

// ── Zone constraint per position ──────────────────────────────────────────────
export interface ZoneConstraint {
  baseZone: Vec2;        // ideal resting position (normalized 0–100)
  maxRoam: number;       // max distance from base zone (normalized units)
  bias: BehaviorBias;
}

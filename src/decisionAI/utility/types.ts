export type CurveKind = 'linear' | 'sigmoid' | 'quadratic_up' | 'quadratic_down' | 'logit';

export interface AxisDef {
  input: string;       // nome do input (ex: 'distToGoal', 'pressure', 'xG')
  curve: CurveKind;
  m: number;           // slope / steepness
  k: number;           // x-shift
  b: number;           // y-shift
  c: number;           // vertical scale
  weight?: number;     // peso opcional (default 1.0)
}

export interface CandidateAction {
  id: string;          // ex: 'shoot', 'pass', 'dribble', 'hold'
  axes: AxisDef[];
}

export interface UtilityResult {
  id: string;
  score: number;
  rawScores: Record<string, number>;  // por axis input
}

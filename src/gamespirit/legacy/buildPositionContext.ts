// Stub no-op: construtor de contexto posicional para sessões de treino.

export interface PositionContext {
  summary: string;
}

export function buildPositionContext(_pos: string): PositionContext {
  return { summary: '' };
}

export function serializePositionContext(_ctx: PositionContext): string {
  return '';
}

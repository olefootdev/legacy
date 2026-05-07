import type { CoachAgent, TeamContext, ManagerInstruction } from './types';

// Prioriza VITE_OLEFOOT_API_URL sempre (inclusive em dev) — assim o dev que
// não roda o server local também consegue testar contra o Railway.
// Fallback localhost só se nenhuma env var estiver definida.
const API_BASE =
  import.meta.env.VITE_OLEFOOT_API_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:4000';

export interface CoachChatResponse {
  ok: boolean;
  response?: string;
  instruction?: ManagerInstruction | null;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  error?: string;
}

export interface TrainingSuggestion {
  mode: 'individual' | 'coletivo';
  trainingType: string;
  group: 'defensivo' | 'criativo' | 'ataque' | 'all';
  durationHours: number;
  reasoning: string;
  priority: 'low' | 'medium' | 'high';
}

export interface StaffSuggestion {
  type: 'upgrade' | 'assignment';
  role: string;
  action: string;
  reasoning: string;
  priority: 'low' | 'medium' | 'high';
  cost?: {
    currency: 'exp' | 'bro';
    amount: number;
  };
}

/**
 * Chama o backend para conversar com o Coach Agent via Claude Haiku
 */
export async function chatWithCoach(
  coach: CoachAgent,
  teamContext: TeamContext,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<CoachChatResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/coach/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coach,
        teamContext,
        userMessage,
        conversationHistory,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { ok: false, error: error.error || 'Erro ao conversar com coach' };
    }

    return await response.json();
  } catch (error: any) {
    console.error('[chatWithCoach] Erro:', error);
    return { ok: false, error: error.message || 'Erro de conexão com o servidor' };
  }
}

/**
 * Solicita sugestão de plano de treino ao Coach Agent
 */
export async function suggestTraining(
  coach: CoachAgent,
  teamContext: TeamContext
): Promise<{ ok: boolean; suggestion?: TrainingSuggestion; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/coach/suggest-training`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coach, teamContext }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { ok: false, error: error.error || 'Erro ao gerar sugestão de treino' };
    }

    return await response.json();
  } catch (error: any) {
    console.error('[suggestTraining] Erro:', error);
    return { ok: false, error: error.message || 'Erro de conexão com o servidor' };
  }
}

/**
 * Solicita sugestões de ações de staff ao Coach Agent
 */
export async function suggestStaff(
  coach: CoachAgent,
  teamContext: TeamContext
): Promise<{ ok: boolean; suggestions?: StaffSuggestion[]; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/coach/suggest-staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coach, teamContext }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { ok: false, error: error.error || 'Erro ao gerar sugestões de staff' };
    }

    return await response.json();
  } catch (error: any) {
    console.error('[suggestStaff] Erro:', error);
    return { ok: false, error: error.message || 'Erro de conexão com o servidor' };
  }
}

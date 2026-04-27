import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';

export type TeachKind = 'narrative' | 'tactical' | 'position';

export interface TeachResponseOk {
  ok: true;
  data: unknown;
  rawAssistant: string;
}

export interface TeachResponseErr {
  ok: false;
  error: string;
  status?: number;
}

export async function requestGameSpiritTeach(body: {
  kind: TeachKind;
  userMessage: string;
  contextJson?: string;
}): Promise<TeachResponseOk | TeachResponseErr> {
  const base = olefootApiBase();
  try {
    const r = await fetch(`${base}/api/game-spirit/teach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = (await r.json()) as { ok?: boolean; error?: string; data?: unknown; rawAssistant?: string };
    if (!r.ok || j.ok === false) {
      return { ok: false, error: j.error ?? `HTTP ${r.status}`, status: r.status };
    }
    return {
      ok: true,
      data: j.data,
      rawAssistant: typeof j.rawAssistant === 'string' ? j.rawAssistant : '',
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Sem ligação ao servidor (arranca olefoot-server na porta 4000?).',
    };
  }
}

export type AdminPlayerPromptLockedPayload = {
  name: string;
  pos: string;
  country?: string;
  strongFoot?: string;
  creatorType?: string;
  rarity?: string;
  collectionSummary?: string;
};

export async function requestAdminPlayerFromPrompt(body: {
  userPrompt: string;
  locked: AdminPlayerPromptLockedPayload;
}): Promise<{ ok: true; rawAssistant: string } | { ok: false; error: string; status?: number }> {
  const base = olefootApiBase();
  try {
    const r = await fetch(`${base}/api/admin/player-from-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = (await r.json()) as { ok?: boolean; error?: string; rawAssistant?: string };
    if (!r.ok || j.ok === false) {
      return { ok: false, error: j.error ?? `HTTP ${r.status}`, status: r.status };
    }
    const raw = typeof j.rawAssistant === 'string' ? j.rawAssistant : '';
    if (!raw.trim()) {
      return { ok: false, error: 'Resposta vazia do servidor.', status: r.status };
    }
    return { ok: true, rawAssistant: raw };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Sem ligação ao servidor (arranca olefoot-server na porta 4000?).',
    };
  }
}

export async function fetchGameSpiritServerStatus(): Promise<{
  reachable: boolean;
  openaiConfigured?: boolean;
  error?: string;
}> {
  const base = olefootApiBase();
  try {
    const r = await fetch(`${base}/api/game-spirit/status`);
    if (!r.ok) return { reachable: true, error: `HTTP ${r.status}` };
    const j = (await r.json()) as { openaiConfigured?: boolean };
    return { reachable: true, openaiConfigured: Boolean(j.openaiConfigured) };
  } catch (e) {
    return {
      reachable: false,
      error: e instanceof Error ? e.message : 'fetch failed',
    };
  }
}

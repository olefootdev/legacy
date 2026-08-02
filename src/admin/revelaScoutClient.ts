/**
 * Client da fila do OLE SCOUT (talentos do REVELA).
 *
 * Fala com `/api/revela-admin`, que roda no servidor com service role — as RPCs
 * `revela_admin_queue` e `revela_admin_review_talent` não têm grant pra anon, e
 * a fila carrega PII (telefone, e-mail, responsável de menor). O navegador nunca
 * vê a chave nem toca no banco direto.
 */
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import { getSupabase } from '@/supabase/client';

/** Uma linha da fila — espelha o retorno de `revela_admin_queue()`. */
export interface ScoutTalent {
  id: string;
  slug: string;
  name: string;
  nickname: string | null;
  pos: string;
  category: string | null;
  game_situation: string | null;
  club: string | null;
  city: string | null;
  uf: string | null;
  birth_year: number | null;
  idade: number | null;
  strong_foot: string | null;
  height_cm: number | null;
  has_agent: boolean | null;
  agent_name: string | null;
  dream: string | null;
  status: string;
  overall: number | null;
  portrait_url: string | null;
  video_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  user_id: string | null;
  created_at: string;
}

/** As 10 chaves canônicas — a mesma ficha do `PlayerAttributes` do jogo. */
export const SCOUT_ATTR_KEYS = [
  'passe',
  'marcacao',
  'velocidade',
  'drible',
  'finalizacao',
  'fisico',
  'tatico',
  'mentalidade',
  'confianca',
  'fairPlay',
] as const;

export type ScoutAttrKey = (typeof SCOUT_ATTR_KEYS)[number];
export type ScoutAttrs = Record<ScoutAttrKey, number>;

export const SCOUT_ATTR_LABEL: Record<ScoutAttrKey, string> = {
  passe: 'Passe',
  marcacao: 'Marcação',
  velocidade: 'Velocidade',
  drible: 'Drible',
  finalizacao: 'Finalização',
  fisico: 'Físico',
  tatico: 'Tático',
  mentalidade: 'Mentalidade',
  confianca: 'Confiança',
  fairPlay: 'Fair play',
};

function adminToken(): string | null {
  try {
    return localStorage.getItem('olefoot-admin-token');
  } catch {
    return null;
  }
}

async function headers(json = false): Promise<Record<string, string>> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  const tok = adminToken();
  if (tok) h['X-Admin-Token'] = tok;
  try {
    const sb = getSupabase();
    const access = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    if (access) h['Authorization'] = `Bearer ${access}`;
  } catch {
    /* sessão indisponível */
  }
  return h;
}

async function fail(r: Response): Promise<never> {
  let msg = `HTTP ${r.status}`;
  try {
    const body = (await r.json()) as { error?: string };
    if (body?.error) msg = body.error;
  } catch {
    /* corpo não-JSON */
  }
  throw new Error(msg);
}

export async function fetchScoutQueue(): Promise<ScoutTalent[]> {
  const r = await fetch(`${olefootApiBase()}/api/revela-admin/queue`, { headers: await headers() });
  if (!r.ok) return fail(r);
  const body = (await r.json()) as { talents?: ScoutTalent[] };
  return body.talents ?? [];
}

export interface ReviewResult {
  ok: boolean;
  reason?: string;
  overall?: number;
}

/**
 * Revisa um talento. `overall` NÃO é enviado de propósito — quem calcula é
 * `revela_ovr(pos, attrs)` no banco, com os pesos por posição. Deixar o cliente
 * mandar OVR criaria uma segunda fonte de verdade divergindo da do jogo.
 */
export async function reviewScoutTalent(input: {
  id: string;
  status: 'approved' | 'rejected' | 'in_review' | 'carded';
  attributes?: ScoutAttrs;
  note?: string;
}): Promise<ReviewResult> {
  const r = await fetch(`${olefootApiBase()}/api/revela-admin/review`, {
    method: 'POST',
    headers: await headers(true),
    body: JSON.stringify(input),
  });
  if (!r.ok) return fail(r);
  return (await r.json()) as ReviewResult;
}

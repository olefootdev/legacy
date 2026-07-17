/**
 * Amizade entre managers — cliente Supabase.
 *
 * Fonte da verdade: `public.manager_friendships`, que existe no banco desde
 * 2026-04-27 com RLS completa e **nunca tinha sido usada** — o cliente rodava um
 * mock local (`src/social/`) com um pedido fake do "WOLVES" e clubes NPC
 * inventados. Removido em 2026-07-17.
 *
 * Eixo de identidade é `auth.users.id` (uuid). O mock antigo usava e-mail como
 * `managerId` — se você encontrar `managerId = email` em algum lugar, é resquício.
 *
 * Os nomes de clube são denormalizados na própria linha (`requester_club_name` /
 * `addressee_club_name`), então listar não precisa de join nem de RPC: a RLS
 * `friendships_select_involved` já deixa os dois lados lerem.
 */
import { getSupabase } from './client';

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected' | 'blocked' | 'cancelled';

export interface ManagerSearchResult {
  id: string;
  username: string | null;
  displayName: string | null;
  clubName: string | null;
  clubShort: string | null;
}

export interface FriendEntry {
  /** id da linha de amizade (use pra remover). */
  id: string;
  /** uuid do OUTRO manager. */
  managerId: string;
  clubName: string;
  since: string;
}

export interface PendingRequest {
  id: string;
  /** uuid do outro lado. */
  managerId: string;
  clubName: string;
  sentAt: string;
  message: string | null;
}

export interface Friendships {
  friends: FriendEntry[];
  /** Pedidos que eu RECEBI e ainda não respondi. */
  incoming: PendingRequest[];
  /** Pedidos que eu ENVIEI e aguardam resposta. */
  outgoing: PendingRequest[];
}

export const EMPTY_FRIENDSHIPS: Friendships = { friends: [], incoming: [], outgoing: [] };

interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  requester_club_name: string | null;
  addressee_club_name: string | null;
  message: string | null;
  created_at: string;
  responded_at: string | null;
}

/** Busca manager por nome do clube, username ou e-mail EXATO. Mín. 3 chars. */
export async function searchManagers(q: string, limit = 10): Promise<ManagerSearchResult[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const term = q.trim();
  if (term.length < 3) return [];
  const { data, error } = await sb.rpc('search_managers', { p_q: term, p_limit: limit });
  if (error || !Array.isArray(data)) {
    if (error) console.warn('[friendships] searchManagers:', error.message);
    return [];
  }
  return data.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    username: (r.username as string) ?? null,
    displayName: (r.display_name as string) ?? null,
    clubName: (r.club_name as string) ?? null,
    clubShort: (r.club_short as string) ?? null,
  }));
}

/** Amigos + pedidos, dos dois lados. Leitura direta: a RLS já filtra. */
export async function fetchMyFriendships(): Promise<Friendships> {
  const sb = getSupabase();
  if (!sb) return EMPTY_FRIENDSHIPS;

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return EMPTY_FRIENDSHIPS;

  const { data, error } = await sb
    .from('manager_friendships')
    .select('id, requester_id, addressee_id, status, requester_club_name, addressee_club_name, message, created_at, responded_at')
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false });

  if (error || !Array.isArray(data)) {
    if (error) console.warn('[friendships] fetchMyFriendships:', error.message);
    return EMPTY_FRIENDSHIPS;
  }

  const out: Friendships = { friends: [], incoming: [], outgoing: [] };
  for (const raw of data as FriendshipRow[]) {
    const iAmRequester = raw.requester_id === user.id;
    const otherId = iAmRequester ? raw.addressee_id : raw.requester_id;
    const otherClub = (iAmRequester ? raw.addressee_club_name : raw.requester_club_name) ?? 'Manager';

    if (raw.status === 'accepted') {
      out.friends.push({
        id: raw.id,
        managerId: otherId,
        clubName: otherClub,
        since: raw.responded_at ?? raw.created_at,
      });
    } else if (iAmRequester) {
      out.outgoing.push({ id: raw.id, managerId: otherId, clubName: otherClub, sentAt: raw.created_at, message: raw.message });
    } else {
      out.incoming.push({ id: raw.id, managerId: otherId, clubName: otherClub, sentAt: raw.created_at, message: raw.message });
    }
  }
  return out;
}

export type FriendActionResult = { ok: true } | { ok: false; error: string };

function mapError(msg: string): string {
  if (msg.includes('ALREADY_FRIENDS')) return 'Vocês já são amigos.';
  if (msg.includes('ALREADY_PENDING')) return 'Você já enviou um convite para este manager.';
  if (msg.includes('BLOCKED')) return 'Não é possível convidar este manager.';
  if (msg.includes('MANAGER_NOT_FOUND')) return 'Manager não encontrado.';
  if (msg.includes('INVALID_TARGET')) return 'Convite inválido.';
  if (msg.includes('NOT_ADDRESSEE')) return 'Só quem recebeu o convite pode responder.';
  if (msg.includes('NOT_PENDING')) return 'Este convite já foi respondido.';
  if (msg.includes('REQUEST_NOT_FOUND')) return 'Convite não encontrado.';
  if (msg.includes('NOT_AUTHENTICATED')) return 'Faça login novamente.';
  return 'Não foi possível concluir agora.';
}

/** Envia convite. Se o outro já tinha te convidado, vira amizade na hora. */
export async function sendFriendRequest(toManagerId: string, message?: string): Promise<FriendActionResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Serviço indisponível.' };
  const { error } = await sb.rpc('send_friend_request', { p_to: toManagerId, p_message: message ?? null });
  if (error) return { ok: false, error: mapError(error.message || '') };
  return { ok: true };
}

export async function respondFriendRequest(requestId: string, accept: boolean): Promise<FriendActionResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Serviço indisponível.' };
  const { error } = await sb.rpc('respond_friend_request', { p_id: requestId, p_accept: accept });
  if (error) return { ok: false, error: mapError(error.message || '') };
  return { ok: true };
}

/** Desfaz amizade ou cancela convite enviado. */
export async function removeFriendship(friendshipId: string): Promise<FriendActionResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Serviço indisponível.' };
  const { error } = await sb.rpc('remove_friendship', { p_id: friendshipId });
  if (error) return { ok: false, error: mapError(error.message || '') };
  return { ok: true };
}

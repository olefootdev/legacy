/**
 * useLegendSocial — interações sociais reutilizáveis para qualquer lenda.
 *
 * Persiste em localStorage por enquanto. Quando as tabelas
 * `legend_likes` e `legend_messages` existirem no Supabase, basta trocar o
 * adapter abaixo (READ/WRITE) preservando a API pública.
 *
 * Chave de armazenamento namespaced: `olefoot.legend.{slug}.likes`
 *                                   `olefoot.legend.{slug}.liked`
 *                                   `olefoot.legend.{slug}.messages`
 */
import { useCallback, useEffect, useState } from 'react';

export interface LegendMessage {
  id: string;
  managerName: string;
  managerInitials: string;
  message: string;
  createdAt: number; // epoch ms
}

const MSG_LIMIT = 50;

function readNum(key: string, fallback = 0): number {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? Math.max(0, Number.parseInt(raw, 10) || 0) : fallback;
  } catch {
    return fallback;
  }
}
function writeNum(key: string, value: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, String(Math.max(0, value)));
  } catch {
    /* ignore */
  }
}
function readBool(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function writeBool(key: string, value: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}
function readMsgs(key: string): LegendMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LegendMessage[];
    return Array.isArray(parsed) ? parsed.slice(0, MSG_LIMIT) : [];
  } catch {
    return [];
  }
}
function writeMsgs(key: string, msgs: LegendMessage[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(msgs.slice(0, MSG_LIMIT)));
  } catch {
    /* ignore */
  }
}

/** Heurística de "popularidade base" — baseline pra parecer vivo no v1. */
function seedLikes(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return 240 + (h % 1800); // entre 240 e ~2040
}

export function useLegendSocial(slug: string) {
  const likesKey = `olefoot.legend.${slug}.likes`;
  const likedKey = `olefoot.legend.${slug}.liked`;
  const msgsKey = `olefoot.legend.${slug}.messages`;

  const [liked, setLiked] = useState<boolean>(() => readBool(likedKey));
  const [likeCount, setLikeCount] = useState<number>(() => {
    const stored = readNum(likesKey, -1);
    if (stored >= 0) return stored;
    const seed = seedLikes(slug);
    writeNum(likesKey, seed);
    return seed;
  });
  const [messages, setMessages] = useState<LegendMessage[]>(() => readMsgs(msgsKey));

  // Sync entre tabs (quando o usuário curte em outra aba aberta)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === likesKey) setLikeCount(readNum(likesKey));
      if (e.key === likedKey) setLiked(readBool(likedKey));
      if (e.key === msgsKey) setMessages(readMsgs(msgsKey));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [likesKey, likedKey, msgsKey]);

  const toggleLike = useCallback(() => {
    setLiked((prev) => {
      const next = !prev;
      writeBool(likedKey, next);
      setLikeCount((c) => {
        const adjusted = Math.max(0, c + (next ? 1 : -1));
        writeNum(likesKey, adjusted);
        return adjusted;
      });
      return next;
    });
  }, [likedKey, likesKey]);

  const postMessage = useCallback(
    (input: { managerName: string; managerInitials: string; message: string }) => {
      const trimmed = input.message.trim().slice(0, 150);
      if (!trimmed) return;
      const initials = (input.managerInitials || input.managerName || '?')
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 3) || '?';
      const entry: LegendMessage = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        managerName: (input.managerName || 'Manager Anônimo').slice(0, 40),
        managerInitials: initials,
        message: trimmed,
        createdAt: Date.now(),
      };
      setMessages((prev) => {
        const next = [entry, ...prev].slice(0, MSG_LIMIT);
        writeMsgs(msgsKey, next);
        return next;
      });
    },
    [msgsKey],
  );

  const removeMessage = useCallback(
    (id: string) => {
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== id);
        writeMsgs(msgsKey, next);
        return next;
      });
    },
    [msgsKey],
  );

  return {
    liked,
    likeCount,
    toggleLike,
    messages,
    postMessage,
    removeMessage,
  };
}

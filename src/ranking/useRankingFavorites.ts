import { useCallback, useState } from 'react';

const STORAGE_KEY = 'olefoot_ranking_favorites_v1';

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function saveFavorites(next: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    /* ignore */
  }
}

export function useRankingFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);

  const toggleFavorite = useCallback((team: string) => {
    setFavorites((prev) => {
      const n = new Set(prev);
      if (n.has(team)) n.delete(team);
      else n.add(team);
      saveFavorites(n);
      return n;
    });
  }, []);

  return { favorites, toggleFavorite };
}

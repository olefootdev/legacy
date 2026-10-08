/**
 * Drops reais do mercado de lendas (legacy_players listadas), mais novas
 * primeiro. Selo "Novo" só nas que entraram nos últimos 14 dias.
 * Usado pela Home e pelo hub do Mercado.
 */
import { useEffect, useState } from 'react';
import { fetchListedLegacyPlayerRows, legacyPortraitImageUrl } from '@/supabase/legacyPlayers';
import { overallFromAttributes } from '@/entities/player';
import type { PlayerAttributes } from '@/entities/types';
import type { LegendMini } from '@/components/home/LegendsRail';

const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function useLegendDrops(max = 6): LegendMini[] {
  const [legends, setLegends] = useState<LegendMini[]>([]);
  useEffect(() => {
    let vivo = true;
    void fetchListedLegacyPlayerRows().then((rows) => {
      if (!vivo) return;
      const sorted = [...rows].sort((a, b) => {
        const ta = a.created_at ? Date.parse(a.created_at) : 0;
        const tb = b.created_at ? Date.parse(b.created_at) : 0;
        return tb - ta;
      });
      setLegends(
        sorted.slice(0, max).map((r) => ({
          id: r.id,
          name: r.name.trim(),
          pos: r.pos,
          ovr: overallFromAttributes(r.attributes as unknown as PlayerAttributes, r.pos),
          portraitUrl: legacyPortraitImageUrl(r),
          isNew: r.created_at ? Date.now() - Date.parse(r.created_at) < NEW_WINDOW_MS : false,
        })),
      );
    });
    return () => {
      vivo = false;
    };
  }, [max]);
  return legends;
}

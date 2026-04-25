/**
 * Narração flutuante sobre o campo — aparece em eventos de peso
 * (falta, cartão, escanteio, gol). Diferente do feed: é um cartão
 * transitório que pulsa no topo do campo por ~3s e desaparece.
 *
 * Consome EVENTOS reais do motor — nada inventado. Só transforma
 * evento canônico em frase bonita.
 */

import { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Flag, Square, AlertTriangle, Trophy } from 'lucide-react';
import { useGameStore } from '@/game/store';
import type { MatchEventEntry } from '@/engine/types';
import { cn } from '@/lib/utils';

type NarrationKind = 'foul' | 'yellow' | 'red' | 'corner_home' | 'corner_away' | 'goal';

interface NarrationCard {
  id: string;
  kind: NarrationKind;
  title: string;
  subtitle?: string;
  minute: number;
  ttlMs: number;
  createdAt: number;
}

function eventToNarration(
  ev: MatchEventEntry,
  playersById: Record<string, { name?: string }>,
  live: { homeShort?: string; awayShort?: string } | null,
): NarrationCard | null {
  if (!ev.id || !ev.kind) return null;
  const createdAt = Date.now();

  if (ev.kind === 'yellow_home' || ev.kind === 'yellow_away') {
    const name = ev.playerId ? (playersById[ev.playerId]?.name ?? 'Jogador') : 'Jogador';
    return {
      id: `narr-${ev.id}`,
      kind: 'yellow',
      title: `🟨 Cartão amarelo · ${name}`,
      subtitle: 'Falta dura — aviso do árbitro',
      minute: ev.minute,
      ttlMs: 3200,
      createdAt,
    };
  }

  if (ev.kind === 'red_home' || ev.kind === 'red_away') {
    const name = ev.playerId ? (playersById[ev.playerId]?.name ?? 'Jogador') : 'Jogador';
    return {
      id: `narr-${ev.id}`,
      kind: 'red',
      title: `🟥 Cartão vermelho · ${name}`,
      subtitle: 'Expulso — time fica com um a menos',
      minute: ev.minute,
      ttlMs: 4000,
      createdAt,
    };
  }

  if (ev.kind === 'goal_home' || ev.kind === 'goal_away') {
    const name = ev.playerId ? (playersById[ev.playerId]?.name ?? 'Jogador') : 'Time';
    const side = ev.kind === 'goal_home' ? (live?.homeShort ?? 'Casa') : (live?.awayShort ?? 'Fora');
    return {
      id: `narr-${ev.id}`,
      kind: 'goal',
      title: `⚽ GOL · ${side}`,
      subtitle: `${name} estufa a rede`,
      minute: ev.minute,
      ttlMs: 3800,
      createdAt,
    };
  }

  if (ev.kind === 'whistle') {
    const t = ev.text?.toLowerCase() ?? '';
    if (/(escanteio|canto\s+para)/.test(t)) {
      const homeShort = live?.homeShort?.toLowerCase() ?? '';
      const awayShort = live?.awayShort?.toLowerCase() ?? '';
      const isHome = homeShort ? t.includes(homeShort) : true;
      const side = isHome ? (live?.homeShort ?? 'Casa') : (live?.awayShort ?? 'Fora');
      return {
        id: `narr-${ev.id}`,
        kind: isHome ? 'corner_home' : 'corner_away',
        title: `🚩 Escanteio · ${side}`,
        subtitle: 'A torcida vai junto com o time',
        minute: ev.minute,
        ttlMs: 3200,
        createdAt,
      };
    }
    if (/falta/.test(t)) {
      return {
        id: `narr-${ev.id}`,
        kind: 'foul',
        title: `🟧 Falta no campo`,
        subtitle: 'Árbitro interrompe — reinício pela vítima',
        minute: ev.minute,
        ttlMs: 3000,
        createdAt,
      };
    }
  }

  if (ev.kind === 'injury_home') {
    const name = ev.playerId ? (playersById[ev.playerId]?.name ?? 'Jogador') : 'Jogador';
    return {
      id: `narr-${ev.id}`,
      kind: 'foul',
      title: `🚑 Lesão · ${name}`,
      subtitle: 'Staff corre ao relvado',
      minute: ev.minute,
      ttlMs: 3500,
      createdAt,
    };
  }

  return null;
}

function PitchNarrationOverlayInner() {
  const live = useGameStore((s) => s.liveMatch);
  const players = useGameStore((s) => s.players);
  const [active, setActive] = useState<NarrationCard[]>([]);
  const [seenIds] = useState(() => new Set<string>());

  // Descobre eventos novos que merecem narração.
  const newCards = useMemo(() => {
    if (!live?.events) return [] as NarrationCard[];
    const out: NarrationCard[] = [];
    const playersLite: Record<string, { name?: string }> = {};
    for (const pid of Object.keys(players)) playersLite[pid] = { name: players[pid]!.name };
    for (const p of live.homePlayers) playersLite[p.playerId] = { name: p.name };
    for (const r of (live.awayRoster ?? [])) playersLite[r.id] = { name: r.name };

    // Só olha os 8 primeiros eventos (mais recentes) pra não refloodar.
    for (const ev of live.events.slice(0, 8)) {
      if (seenIds.has(ev.id)) continue;
      const narr = eventToNarration(ev, playersLite, live);
      if (narr) {
        seenIds.add(ev.id);
        out.push(narr);
      } else {
        // ainda marca como visto pra evitar reprocessar
        seenIds.add(ev.id);
      }
    }
    return out;
  }, [live?.events, live?.homePlayers, live?.awayRoster, live?.homeShort, live?.awayShort, players, seenIds]);

  // Adiciona novos, respeita TTL de cada card.
  useEffect(() => {
    if (newCards.length === 0) return;
    setActive((prev) => {
      const next = [...prev, ...newCards];
      // limita a 2 narrações simultâneas
      return next.slice(-2);
    });
  }, [newCards]);

  useEffect(() => {
    if (active.length === 0) return;
    const timers = active.map((c) =>
      window.setTimeout(() => {
        setActive((prev) => prev.filter((x) => x.id !== c.id));
      }, Math.max(0, c.ttlMs - (Date.now() - c.createdAt))),
    );
    return () => { for (const t of timers) window.clearTimeout(t); };
  }, [active]);

  if (!live || live.phase !== 'playing') return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-[30] flex flex-col items-center gap-2 px-2">
      <AnimatePresence>
        {active.map((c) => {
          const Icon =
            c.kind === 'yellow' ? Square :
            c.kind === 'red' ? Square :
            c.kind === 'goal' ? Trophy :
            c.kind === 'corner_home' || c.kind === 'corner_away' ? Flag :
            AlertTriangle;
          const accent =
            c.kind === 'yellow' ? 'from-yellow-500/40 to-yellow-600/30 border-yellow-400/60 text-yellow-100' :
            c.kind === 'red' ? 'from-rose-600/50 to-rose-700/40 border-rose-400/70 text-rose-100' :
            c.kind === 'goal' ? 'from-neon-yellow/40 to-amber-500/30 border-neon-yellow/70 text-white' :
            c.kind === 'corner_home' ? 'from-emerald-500/30 to-teal-500/25 border-emerald-400/60 text-emerald-100' :
            c.kind === 'corner_away' ? 'from-rose-500/30 to-rose-600/25 border-rose-400/60 text-rose-100' :
            'from-orange-500/30 to-orange-600/25 border-orange-400/60 text-orange-100';
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: -16, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className={cn(
                'rounded-xl border bg-gradient-to-b px-3 py-2 shadow-xl backdrop-blur pointer-events-auto',
                accent,
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0" />
                <div className="flex items-center gap-2">
                  <p className="font-display text-xs font-black uppercase tracking-widest">{c.title}</p>
                  <span className="font-mono text-[10px] opacity-70">{c.minute}'</span>
                </div>
              </div>
              {c.subtitle ? (
                <p className="mt-0.5 pl-6 text-[10px] font-bold uppercase tracking-wider opacity-80">
                  {c.subtitle}
                </p>
              ) : null}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export const PitchNarrationOverlay = memo(PitchNarrationOverlayInner);

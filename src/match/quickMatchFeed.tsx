import type { ReactNode } from 'react';
import type { MatchEventEntry } from '@/engine/types';
import { cn } from '@/lib/utils';

export type FeedNameRef = { text: string; side: 'home' | 'away' };

function collectRefs(
  homeShort: string,
  awayShort: string,
  homeNames: string[],
  awayNames: string[],
): FeedNameRef[] {
  const out: FeedNameRef[] = [
    { text: homeShort, side: 'home' },
    { text: awayShort, side: 'away' },
  ];
  for (const n of homeNames) {
    if (n.length >= 2) out.push({ text: n, side: 'home' });
  }
  for (const n of awayNames) {
    if (n.length >= 2) out.push({ text: n, side: 'away' });
  }
  out.sort((a, b) => b.text.length - a.text.length);
  return out;
}

/** Destaca nomes de jogadores / equipas no texto do feed. */
export function renderQuickFeedRichText(
  text: string,
  opts: {
    homeShort: string;
    awayShort: string;
    homeNames: string[];
    awayNames: string[];
    homeClassName: string;
    awayClassName: string;
  },
): ReactNode {
  const refs = collectRefs(opts.homeShort, opts.awayShort, opts.homeNames, opts.awayNames);
  const parts: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    let best: { start: number; end: number; side: 'home' | 'away' } | null = null;
    for (const r of refs) {
      const idx = text.indexOf(r.text, i);
      if (idx < 0) continue;
      if (!best || idx < best.start || (idx === best.start && r.text.length > best.end - best.start)) {
        best = { start: idx, end: idx + r.text.length, side: r.side };
      }
    }
    if (!best) {
      parts.push(text.slice(i));
      break;
    }
    if (best.start > i) parts.push(text.slice(i, best.start));
    const cls = best.side === 'home' ? opts.homeClassName : opts.awayClassName;
    const slice = text.slice(best.start, best.end);
    parts.push(
      <span key={key++} className={cn('font-bold', cls)}>
        {slice}
      </span>,
    );
    i = best.end;
  }
  return <>{parts}</>;
}

export function quickFeedLineClass(kind: MatchEventEntry['kind']): string {
  switch (kind) {
    case 'goal_home':
      return 'border-l-2 border-l-neon-yellow/80 bg-neon-yellow/[0.06]';
    case 'goal_away':
      return 'border-l-2 border-l-white/50 bg-white/[0.04]';
    case 'yellow_home':
      return 'border-l-2 border-l-amber-400/70 bg-amber-500/[0.07]';
    case 'red_home':
    case 'red_away':
      return 'border-l-2 border-l-red-500/80 bg-red-500/[0.08]';
    case 'yellow_away':
      return 'border-l-2 border-l-amber-400/50 bg-amber-500/[0.05]';
    case 'penalty_start':
    case 'penalty_result':
      return 'border-l-2 border-l-purple-400/70 bg-purple-500/[0.08]';
    case 'injury_home':
      return 'border-l-2 border-l-orange-400/70 bg-orange-500/[0.08]';
    case 'whistle':
      return 'border-l-2 border-l-gray-500/50';
    case 'sub':
      return 'border-l-2 border-l-cyan-500/40';
    default:
      return 'border-l-2 border-l-transparent';
  }
}

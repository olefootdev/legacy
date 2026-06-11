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
      <span
        key={key++}
        className={cn('font-bold', cls)}
        style={{
          fontFamily: 'var(--font-serif-hero)',
          fontStyle: 'italic',
          fontWeight: 700,
          fontSize: '15px',
          letterSpacing: '0.01em',
        }}
      >
        {slice}
      </span>,
    );
    i = best.end;
  }
  return <>{parts}</>;
}

// ─── Curadoria de importância (quick-match-revolution.md §12 P3) ────────────
// Com botões interativos no feed, cada item precisa valer. Eventos-chave
// (gol/cartão/pênalti/lesão/sub) entram SEMPRE; narrativa só quando o texto
// carrega um lance de verdade; filler ("troca passes", "recicla posse") cede
// lugar quando o pool aperta.

/** Texto de narrativa que descreve lance relevante (chute, defesa, trave, falta…). */
const NARRATIVE_HIGHLIGHT_RE =
  /chut|rema[tz]|finaliz|defes|defend|espalm|trave|travessão|p[êe]nalti|falta|cabeç|escanteio|c[óo]rner|contra-ataque|cruzamento|drible|rouba|desarm|perigo|quase|pra fora|gol/i;

/**
 * Importância 0–3 de um evento do feed:
 *   3 = clímax (gol, vermelho, pênalti) · 2 = momento-chave (amarelo, lesão,
 *   sub, chute, apito) · 1 = narrativa com lance · 0 = filler ambiente.
 */
export function quickFeedImportance(e: Pick<MatchEventEntry, 'kind' | 'text'>): number {
  switch (e.kind) {
    case 'goal_home':
    case 'goal_away':
    case 'red_home':
    case 'red_away':
    case 'penalty_start':
    case 'penalty_result':
      return 3;
    case 'yellow_home':
    case 'yellow_away':
    case 'injury_home':
    case 'sub':
    case 'shot_home':
    case 'shot_away':
    case 'whistle':
      return 2;
    default:
      return NARRATIVE_HIGHLIGHT_RE.test(e.text ?? '') ? 1 : 0;
  }
}

/**
 * Seleciona os eventos que merecem o pool visível do feed (mais recentes
 * primeiro, ordem preservada). Regra: eventos de importância ≥1 têm prioridade;
 * filler (0) só preenche as vagas que sobrarem — assim o feed nunca fica vazio
 * no começo do jogo, mas "arroz de festa" sai primeiro quando o pool aperta.
 *
 * `nowMinute` (opcional): evento-chave com mais de 20 minutos de jogo não volta
 * pro pool — sem isso, gols do 1º tempo ficavam reciclando na rotação aos 60'+
 * ("ficam os eventos do primeiro tempo sendo narrados").
 */
const FEED_KEY_EVENT_MAX_AGE_MIN = 20;

export function curateQuickFeedPool<T extends Pick<MatchEventEntry, 'kind' | 'text' | 'minute'>>(
  events: T[],
  max: number,
  nowMinute?: number,
): T[] {
  if (events.length <= max) return events.slice(0, max);
  const windowed = events.slice(0, Math.min(events.length, max * 3));
  const recent =
    typeof nowMinute === 'number'
      ? windowed.filter(
          (e) =>
            quickFeedImportance(e) === 0 ||
            typeof e.minute !== 'number' ||
            nowMinute - e.minute <= FEED_KEY_EVENT_MAX_AGE_MIN,
        )
      : windowed;
  const kept: T[] = [];
  const fillerBackfill: T[] = [];
  for (const e of recent) {
    if (kept.length >= max) break;
    if (quickFeedImportance(e) >= 1) kept.push(e);
    else if (fillerBackfill.length < max) fillerBackfill.push(e);
  }
  if (kept.length < max) {
    // Preenche com filler na ordem original até completar o pool.
    for (const f of fillerBackfill) {
      if (kept.length >= max) break;
      kept.push(f);
    }
    // Reordena pro feed manter cronologia (mais recente primeiro).
    const order = new Map(recent.map((e, i) => [e, i] as const));
    kept.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  }
  return kept;
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

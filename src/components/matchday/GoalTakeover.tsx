/**
 * Full-screen yellow takeover at goal — 1.2s. Honors prefers-reduced-motion
 * via the global `html.olefoot-reduce-motion` rule (animations are clamped
 * to ~0ms there, so the takeover effectively never paints).
 */

import { useEffect, useState } from 'react';

interface GoalTakeoverProps {
  /** Bumped externally when a new goal happens — drives mount + remount. */
  triggerKey: number | string | null;
  /** Optional headline. Default: "GOL." */
  text?: string;
  /** Optional italic line below. Default: "Olefoot." */
  italic?: string;
  /** Suppress entirely (e.g. reduce-motion preference). */
  disabled?: boolean;
}

export function GoalTakeover({
  triggerKey,
  text = 'GOL.',
  italic = 'Olefoot.',
  disabled = false,
}: GoalTakeoverProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (disabled || triggerKey == null) return;
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 1200);
    return () => window.clearTimeout(t);
  }, [triggerKey, disabled]);

  if (!visible) return null;

  return (
    <div className="ole-goal-takeover" aria-live="polite" role="status">
      <div className="ole-goal-takeover__text">
        {text}
        <span className="ole-goal-takeover__italic">{italic}</span>
      </div>
    </div>
  );
}

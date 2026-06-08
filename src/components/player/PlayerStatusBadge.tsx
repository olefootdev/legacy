/**
 * Badge unificado de status do jogador — chip compacto com hierarquia clara.
 *
 * Hierarquia (do mais grave pro mais leve, primeiro vencedor exibe):
 *   1. contract_expired  ← preto/zinc — bloqueia escalação
 *   2. injured           ← danger     — fora N jogos por lesão
 *   3. suspended         ← warning    — fora N jogos por suspensão
 *   4. exhausted         ← warning    — fadiga ≥ 75%
 *   5. contract_warning  ← warning    — contrato ≤ 10% restante
 *   6. injury_risk       ← warning    — injuryRisk ≥ 70
 *   ─ default: nada renderiza (jogador saudável)
 *
 * Tokens usados (zero hex hardcode):
 *   var(--color-danger), var(--color-warning), var(--color-info),
 *   var(--font-display), var(--radius-sm)
 *
 * Variantes de tamanho:
 *   - 'sm' (default) — uso em lista de plantel (compacto, ao lado do nome)
 *   - 'md'           — uso em hero / ficha (mais respiro, melhor leitura)
 */

import { AlertTriangle, Activity, Ban, ShieldOff, Coins, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlayerEntity } from '@/entities/types';
import type { PlayerHealth } from '@/systems/playerHealth/types';
import { INJURY_LABEL_PT } from '@/systems/injury';

export type PlayerStatusKind =
  | 'contract_expired'
  | 'injured'
  | 'suspended'
  | 'exhausted'
  | 'contract_warning'
  | 'injury_risk';

interface BadgeConfig {
  Icon: typeof AlertTriangle;
  label: string;
  /** Sub-texto curto (ex.: "3j" ou nome da lesão). */
  detail?: string;
  className: string;
  /** Texto longo no `title` attribute pra hover. */
  tooltip: string;
}

function classifyPlayer(p: PlayerEntity, h: PlayerHealth | undefined): BadgeConfig | null {
  // 1. Contrato vencido — mais grave que qualquer coisa pq impede de entrar em XI oficial.
  if (p.contractExpired === true) {
    return {
      Icon: Ban,
      label: 'Contrato',
      detail: 'vencido',
      className:
        'bg-[var(--color-deep-black)]/70 text-zinc-200 border-zinc-500/60',
      tooltip: 'Contrato vencido — jogador não pode entrar em XI oficial. Renove pra reativar.',
    };
  }

  // 2. Lesão — vermelho com severidade quando disponível.
  const outForMatches = h?.outForMatches ?? p.outForMatches ?? 0;
  if (outForMatches > 0) {
    const severityLabel = h?.injurySeverity ? INJURY_LABEL_PT[h.injurySeverity] : 'Lesão';
    return {
      Icon: Activity,
      label: severityLabel,
      detail: `${outForMatches}j`,
      className:
        'bg-[var(--color-danger)]/12 text-[var(--color-danger)] border-[var(--color-danger)]/40',
      tooltip: `${severityLabel} — ${outForMatches} jogo${outForMatches === 1 ? '' : 's'} de recuperação restante${outForMatches === 1 ? '' : 's'}.`,
    };
  }

  // 3. Suspensão — laranja/danger leve, diferenciado de lesão.
  const suspended = h?.suspendedMatches ?? 0;
  if (suspended > 0) {
    return {
      Icon: ShieldOff,
      label: 'Suspenso',
      detail: `${suspended}j`,
      className:
        'bg-[var(--color-warning)]/14 text-[var(--color-warning)] border-[var(--color-warning)]/50',
      tooltip: `Suspenso por ${suspended} jogo${suspended === 1 ? '' : 's'} oficial${suspended === 1 ? '' : 's'}.`,
    };
  }

  // 4. Exausto — fadiga muito alta, ainda escalável mas em alerta.
  const fatigue = h?.fatigue ?? p.fatigue ?? 0;
  if (fatigue >= 75) {
    return {
      Icon: Flame,
      label: 'Fadiga',
      detail: `${Math.round(fatigue)}%`,
      className:
        'bg-[var(--color-warning)]/12 text-[var(--color-warning)] border-[var(--color-warning)]/40',
      tooltip: `Fadiga em ${Math.round(fatigue)}%. Ainda escalável, mas considere poupar pra evitar lesão.`,
    };
  }

  // 5. Contrato em alerta (≤ 10% restante mas ainda jogando).
  if (
    p.contractIsLifetime !== true &&
    typeof p.contractMatchesRemaining === 'number' &&
    typeof p.contractMatchesIncluded === 'number' &&
    p.contractMatchesIncluded > 0
  ) {
    const pct = p.contractMatchesRemaining / p.contractMatchesIncluded;
    if (pct > 0 && pct <= 0.1) {
      return {
        Icon: Coins,
        label: 'Contrato',
        detail: `${p.contractMatchesRemaining}j`,
        className:
          'bg-[var(--color-warning)]/12 text-[var(--color-warning)] border-[var(--color-warning)]/40',
        tooltip: `Contrato perto do fim: ${p.contractMatchesRemaining} jogo${p.contractMatchesRemaining === 1 ? '' : 's'} restante${p.contractMatchesRemaining === 1 ? '' : 's'} de ${p.contractMatchesIncluded}. Renove em breve.`,
      };
    }
  }

  // 6. Risco de lesão acumulado.
  const injuryRisk = h?.injuryRisk ?? p.injuryRisk ?? 0;
  if (injuryRisk >= 70) {
    return {
      Icon: AlertTriangle,
      label: 'Risco',
      detail: `${Math.round(injuryRisk)}`,
      className:
        'bg-[var(--color-warning)]/12 text-[var(--color-warning)] border-[var(--color-warning)]/40',
      tooltip: `Risco de lesão acumulado em ${Math.round(injuryRisk)}/100. Considere dar descanso ou priorizar recuperação.`,
    };
  }

  return null;
}

interface Props {
  player: PlayerEntity;
  health?: PlayerHealth;
  size?: 'sm' | 'md';
  className?: string;
}

export function PlayerStatusBadge({ player, health, size = 'sm', className }: Props) {
  const cfg = classifyPlayer(player, health);
  if (!cfg) return null;

  const isMd = size === 'md';
  return (
    <span
      className={cn(
        'shrink-0 inline-flex items-center gap-1 border uppercase',
        isMd ? 'px-2 py-1' : 'px-1.5 py-0.5',
        cfg.className,
        className,
      )}
      style={{
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-display)',
        fontSize: isMd ? '10px' : '9px',
        fontWeight: 700,
        letterSpacing: '0.18em',
      }}
      title={cfg.tooltip}
      aria-label={cfg.tooltip}
    >
      <cfg.Icon size={isMd ? 12 : 10} aria-hidden />
      <span className="leading-none">{cfg.label}</span>
      {cfg.detail && (
        <span
          className="tabular-nums leading-none opacity-90"
          style={{ fontWeight: 800 }}
        >
          {cfg.detail}
        </span>
      )}
    </span>
  );
}

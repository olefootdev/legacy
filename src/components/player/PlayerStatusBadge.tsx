/**
 * Badge unificado de status do jogador — chip compacto com hierarquia clara.
 *
 * Hierarquia (do mais grave pro mais leve, primeiro vencedor exibe):
 *   1. contract_expired  ← chão tracejado — bloqueia escalação
 *   2. injured           ← danger     — fora N jogos por lesão
 *   3. suspended         ← warning    — fora N jogos por suspensão
 *   4. exhausted         ← warning    — fadiga ≥ 75%
 *   5. contract_warning  ← warning    — contrato ≤ 10% restante
 *   6. injury_risk       ← warning    — injuryRisk ≥ 70
 *   ─ default: nada renderiza (jogador saudável)
 *
 * DS 2027: selo quadrado em A PROVA (Geist Mono); estado de jogo usa só
 * baixa (vermelho) e atenção (laranja); contrato vencido é CHÃO (tracejado).
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
import { L } from '@/i18n/L';

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
      label: L('Contrato', 'Contract'),
      detail: L('vencido', 'expired'),
      className: 'bg-asfalto-27 text-suave border-dashed border-fio',
      tooltip: L('Contrato vencido — jogador não pode entrar em XI oficial. Renove pra reativar.', 'Contract expired — player can’t be in an official XI. Renew to reactivate.'),
    };
  }

  // 2. Lesão — vermelho com severidade quando disponível.
  const outForMatches = h?.outForMatches ?? p.outForMatches ?? 0;
  if (outForMatches > 0) {
    const severityLabel = h?.injurySeverity ? INJURY_LABEL_PT[h.injurySeverity] : L('Lesão', 'Injury');
    return {
      Icon: Activity,
      label: severityLabel,
      detail: L(`${outForMatches}j`, `${outForMatches}g`),
      className: 'bg-baixa/12 text-baixa border-baixa/50',
      tooltip: L(`${severityLabel} — ${outForMatches} jogo${outForMatches === 1 ? '' : 's'} de recuperação restante${outForMatches === 1 ? '' : 's'}.`, `${severityLabel} — ${outForMatches} game${outForMatches === 1 ? '' : 's'} of recovery left.`),
    };
  }

  // 3. Suspensão — laranja/danger leve, diferenciado de lesão.
  const suspended = h?.suspendedMatches ?? 0;
  if (suspended > 0) {
    return {
      Icon: ShieldOff,
      label: L('Suspenso', 'Suspended'),
      detail: L(`${suspended}j`, `${suspended}g`),
      className: 'bg-atencao/10 text-atencao border-atencao/50',
      tooltip: L(`Suspenso por ${suspended} jogo${suspended === 1 ? '' : 's'} oficial${suspended === 1 ? '' : 's'}.`, `Suspended for ${suspended} official game${suspended === 1 ? '' : 's'}.`),
    };
  }

  // 4. Exausto — fadiga muito alta, ainda escalável mas em alerta.
  const fatigue = h?.fatigue ?? p.fatigue ?? 0;
  if (fatigue >= 75) {
    return {
      Icon: Flame,
      label: L('Fadiga', 'Fatigue'),
      detail: `${Math.round(fatigue)}%`,
      className: 'bg-atencao/10 text-atencao border-atencao/50',
      tooltip: L(`Fadiga em ${Math.round(fatigue)}%. Ainda escalável, mas considere poupar pra evitar lesão.`, `Fatigue at ${Math.round(fatigue)}%. Still selectable, but consider resting him to avoid injury.`),
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
        label: L('Contrato', 'Contract'),
        detail: L(`${p.contractMatchesRemaining}j`, `${p.contractMatchesRemaining}g`),
        className: 'bg-atencao/10 text-atencao border-atencao/50',
        tooltip: L(`Contrato perto do fim: ${p.contractMatchesRemaining} jogo${p.contractMatchesRemaining === 1 ? '' : 's'} restante${p.contractMatchesRemaining === 1 ? '' : 's'} de ${p.contractMatchesIncluded}. Renove em breve.`, `Contract ending: ${p.contractMatchesRemaining} of ${p.contractMatchesIncluded} game${p.contractMatchesIncluded === 1 ? '' : 's'} left. Renew soon.`),
      };
    }
  }

  // 6. Risco de lesão acumulado.
  const injuryRisk = h?.injuryRisk ?? p.injuryRisk ?? 0;
  if (injuryRisk >= 70) {
    return {
      Icon: AlertTriangle,
      label: L('Risco', 'Risk'),
      detail: `${Math.round(injuryRisk)}`,
      className: 'bg-atencao/10 text-atencao border-atencao/50',
      tooltip: L(`Risco de lesão acumulado em ${Math.round(injuryRisk)}/100. Considere dar descanso ou priorizar recuperação.`, `Accumulated injury risk at ${Math.round(injuryRisk)}/100. Consider rest or prioritising recovery.`),
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
        'shrink-0 inline-flex items-center gap-1 border-2 font-prova font-bold uppercase',
        isMd ? 'px-2 py-1 text-[10.5px] tracking-[0.12em]' : 'px-1.5 py-0.5 text-[9.5px] tracking-[0.1em]',
        cfg.className,
        className,
      )}
      title={cfg.tooltip}
      aria-label={cfg.tooltip}
    >
      <cfg.Icon size={isMd ? 12 : 10} aria-hidden />
      <span className="leading-none">{cfg.label}</span>
      {cfg.detail && (
        <span className="tabular-nums leading-none opacity-90">
          {cfg.detail}
        </span>
      )}
    </span>
  );
}

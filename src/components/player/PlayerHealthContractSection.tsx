/**
 * Bloco "Saúde & Contrato" pra ficha do jogador.
 *
 * 2 sub-blocos verticais:
 *   1. Saúde     — fadiga atual + recuperação de lesão (se houver) + risco.
 *   2. Contrato  — barra de progresso + CTA "Renovar contrato" quando aplicável.
 *
 * Design tokens (zero hex hardcode):
 *   var(--color-success | warning | danger | info | neon-yellow)
 *   var(--font-display), var(--font-ui)
 *   var(--radius-sm | md)
 *
 * Padrão de section igual ao usado em TeamPlayerSeasonSheet:
 *   border + bg + padding 4 + barra lateral 3px da cor da família.
 */

import { useState } from 'react';
import { Activity, ShieldCheck, FileText, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGameStore, dispatchGame } from '@/game/store';
import { getPlayerHealth } from '@/systems/playerHealth/selectors';
import { INJURY_LABEL_PT, INJURY_MATCHES_OUT } from '@/systems/injury';
import { RenewContractModal } from '@/components/RenewContractModal';
import type { PlayerEntity } from '@/entities/types';

interface Props {
  player: PlayerEntity;
}

/** Mini-barra horizontal segmentada com porcentagem (0–100). */
function ProgressBar({
  pct,
  tone,
}: {
  pct: number;
  tone: 'success' | 'warning' | 'danger' | 'neon';
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const colorVar =
    tone === 'success' ? 'var(--color-success)'
    : tone === 'warning' ? 'var(--color-warning)'
    : tone === 'danger' ? 'var(--color-danger)'
    : 'var(--color-neon-yellow)';
  return (
    <div
      className="relative h-1.5 w-full overflow-hidden bg-white/8"
      style={{ borderRadius: 'var(--radius-sm)' }}
    >
      <div
        className="absolute inset-y-0 left-0 transition-[width] duration-500"
        style={{
          width: `${clamped}%`,
          background: colorVar,
          borderRadius: 'var(--radius-sm)',
        }}
      />
    </div>
  );
}

/** Linha label + valor com tipografia padrão da ficha. */
function MetricRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  const colorClass =
    tone === 'good' ? 'text-[var(--color-success)]'
    : tone === 'warn' ? 'text-[var(--color-warning)]'
    : tone === 'bad' ? 'text-[var(--color-danger)]'
    : 'text-white';
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className="uppercase text-white/55"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.18em',
        }}
      >
        {label}
      </span>
      <span
        className={cn('tabular-nums', colorClass)}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          fontWeight: 800,
          letterSpacing: '0.04em',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function PlayerHealthContractSection({ player }: Props) {
  const playerHealth = useGameStore((s) => s.playerHealth);
  const [renewOpen, setRenewOpen] = useState(false);

  const h = getPlayerHealth(playerHealth, player);

  // ── Saúde ────────────────────────────────────────────────────────────────
  const isInjured = h.outForMatches > 0;
  const isSuspended = h.suspendedMatches > 0;
  const severity = h.injurySeverity ?? null;
  const totalMatchesForInjury = severity ? INJURY_MATCHES_OUT[severity] : null;
  const matchesCompleted = totalMatchesForInjury != null && isInjured
    ? Math.max(0, totalMatchesForInjury - h.outForMatches)
    : 0;
  const recoveryPct = totalMatchesForInjury
    ? (matchesCompleted / totalMatchesForInjury) * 100
    : 0;

  const fatiguePct = Math.round(h.fatigue);
  const fatigueTone: 'good' | 'warn' | 'bad' | 'neutral' =
    fatiguePct >= 85 ? 'bad' : fatiguePct >= 70 ? 'warn' : fatiguePct >= 50 ? 'neutral' : 'good';
  const energyPct = 100 - fatiguePct;
  const energyTone: 'success' | 'warning' | 'danger' | 'neon' =
    energyPct >= 50 ? 'success' : energyPct >= 25 ? 'warning' : 'danger';

  const riskPct = Math.round(h.injuryRisk);
  const riskTone: 'good' | 'warn' | 'bad' | 'neutral' =
    riskPct >= 70 ? 'bad' : riskPct >= 50 ? 'warn' : 'good';

  // ── Contrato ─────────────────────────────────────────────────────────────
  const isLifetime = player.contractIsLifetime === true;
  const isExpired = player.contractExpired === true;
  const remaining = player.contractMatchesRemaining;
  const included = player.contractMatchesIncluded;
  const hasContract = !isLifetime && typeof remaining === 'number' && typeof included === 'number' && included > 0;
  const contractPct = hasContract ? (remaining! / included!) * 100 : 0;
  const contractTone: 'success' | 'warning' | 'danger' | 'neon' =
    isExpired ? 'danger'
    : contractPct <= 10 ? 'warning'
    : contractPct <= 30 ? 'neon'
    : 'success';

  // Renovável: prospects do manager OU Genesis não-vitalício (espelha o reducer).
  const isRenewable =
    !isLifetime && (player.managerCreated === true || player.genesisCatalogId != null);
  const canRenew = isRenewable && (isExpired || contractPct <= 30);
  const autoRenewOn = player.autoRenewContract === true;

  return (
    <>
      <section
        className="border border-white/10 bg-black/25 p-4 scroll-snap-section"
        style={{ borderRadius: 'var(--radius-md)' }}
      >
        {/* Header com barra lateral neon — padrão da ficha */}
        <div className="mb-3 flex items-center gap-2.5">
          <span aria-hidden className="shrink-0 w-[3px] h-5 bg-neon-yellow" />
          <h3
            className="text-neon-yellow uppercase"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.18em',
            }}
          >
            Saúde & Contrato
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* ── Sub-bloco: Saúde ────────────────────────────────────────────── */}
          <div
            className={cn(
              'border p-3',
              isInjured
                ? 'border-[var(--color-danger)]/35 bg-[var(--color-danger)]/8'
                : isSuspended
                  ? 'border-[var(--color-warning)]/35 bg-[var(--color-warning)]/8'
                  : 'border-white/10 bg-white/[0.02]',
            )}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <div className="mb-2 flex items-center gap-2">
              <Activity
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  isInjured ? 'text-[var(--color-danger)]' : 'text-white/80',
                )}
                aria-hidden
              />
              <span
                className="uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.22em',
                  color: isInjured ? 'var(--color-danger)' : 'white',
                }}
              >
                Saúde
              </span>
            </div>

            {/* Estado primário (lesão / suspensão / disponível) */}
            {isInjured ? (
              <>
                <p
                  className="text-[var(--color-danger)]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '14px',
                    fontWeight: 800,
                  }}
                >
                  {severity ? INJURY_LABEL_PT[severity] : 'Lesionado'}
                </p>
                <p className="mt-0.5 text-white/65" style={{ fontFamily: 'var(--font-ui)', fontSize: '11px' }}>
                  Faltam <span className="font-bold text-white">{h.outForMatches}</span>{' '}
                  jogo{h.outForMatches === 1 ? '' : 's'} pro retorno
                  {totalMatchesForInjury ? ` (${matchesCompleted}/${totalMatchesForInjury})` : ''}.
                </p>
                {totalMatchesForInjury ? (
                  <div className="mt-2.5">
                    <ProgressBar pct={recoveryPct} tone="warning" />
                    <p
                      className="mt-1 uppercase text-white/45"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '9px',
                        fontWeight: 700,
                        letterSpacing: '0.18em',
                      }}
                    >
                      Recuperando · {Math.round(recoveryPct)}%
                    </p>
                  </div>
                ) : null}
              </>
            ) : isSuspended ? (
              <>
                <p
                  className="text-[var(--color-warning)]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '14px',
                    fontWeight: 800,
                  }}
                >
                  Suspenso
                </p>
                <p className="mt-0.5 text-white/65" style={{ fontFamily: 'var(--font-ui)', fontSize: '11px' }}>
                  {h.suspendedMatches} jogo{h.suspendedMatches === 1 ? '' : 's'} de suspensão.
                </p>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--color-success)]" aria-hidden />
                <span
                  className="text-[var(--color-success)]"
                  style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 800 }}
                >
                  Disponível
                </span>
              </div>
            )}

            {/* Métricas sempre visíveis: energia, fadiga, risco */}
            <div className="mt-3 space-y-2 border-t border-white/8 pt-3">
              <div>
                <MetricRow label="Energia" value={`${energyPct}%`} tone={fatigueTone === 'bad' ? 'bad' : fatigueTone === 'warn' ? 'warn' : 'good'} />
                <div className="mt-1">
                  <ProgressBar pct={energyPct} tone={energyTone} />
                </div>
              </div>
              <MetricRow label="Risco de lesão" value={`${riskPct}/100`} tone={riskTone} />
            </div>
          </div>

          {/* ── Sub-bloco: Contrato ─────────────────────────────────────────── */}
          <div
            className={cn(
              'border p-3',
              isExpired
                ? 'border-zinc-500/45 bg-zinc-900/40'
                : isLifetime
                  ? 'border-[var(--color-neon-yellow)]/35 bg-[var(--color-neon-yellow)]/8'
                  : contractPct <= 10
                    ? 'border-[var(--color-warning)]/35 bg-[var(--color-warning)]/8'
                    : 'border-white/10 bg-white/[0.02]',
            )}
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <div className="mb-2 flex items-center gap-2">
              <FileText
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  isExpired ? 'text-zinc-300' : isLifetime ? 'text-[var(--color-neon-yellow)]' : 'text-white/80',
                )}
                aria-hidden
              />
              <span
                className="uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.22em',
                  color: isExpired ? '#d4d4d8' : isLifetime ? 'var(--color-neon-yellow)' : 'white',
                }}
              >
                Contrato
              </span>
            </div>

            {isLifetime ? (
              <>
                <p
                  className="text-[var(--color-neon-yellow)]"
                  style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 800 }}
                >
                  Vitalício
                </p>
                <p className="mt-0.5 text-white/65" style={{ fontFamily: 'var(--font-ui)', fontSize: '11px' }}>
                  Jogador histórico do clube — sem fim de jogos.
                </p>
              </>
            ) : isExpired ? (
              <>
                <p
                  className="text-zinc-200"
                  style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 800 }}
                >
                  Vencido
                </p>
                <p className="mt-0.5 text-white/65" style={{ fontFamily: 'var(--font-ui)', fontSize: '11px' }}>
                  Não pode entrar em XI oficial. Renove pra reativar.
                </p>
              </>
            ) : hasContract ? (
              <>
                <p
                  className={cn(
                    contractPct <= 10 ? 'text-[var(--color-warning)]' : 'text-white',
                  )}
                  style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 800 }}
                >
                  {remaining} <span className="opacity-60">/ {included} jogos</span>
                </p>
                <p className="mt-0.5 text-white/65" style={{ fontFamily: 'var(--font-ui)', fontSize: '11px' }}>
                  Decrementa 1 a cada partida em que o jogador participa.
                </p>
                <div className="mt-2.5">
                  <ProgressBar pct={contractPct} tone={contractTone} />
                  <p
                    className="mt-1 uppercase text-white/45"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '9px',
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                    }}
                  >
                    Restante · {Math.round(contractPct)}%
                  </p>
                </div>
              </>
            ) : (
              <p className="text-white/55" style={{ fontFamily: 'var(--font-ui)', fontSize: '12px' }}>
                Sem contrato registrado.
              </p>
            )}

            {/* CTA de renovação — prospects do manager + Genesis não-vitalícios. */}
            {canRenew ? (
              <button
                type="button"
                onClick={() => setRenewOpen(true)}
                className={cn(
                  'mt-3 inline-flex h-9 w-full touch-manipulation items-center justify-center gap-1.5 border uppercase transition-colors',
                  isExpired
                    ? 'border-[var(--color-warning)] bg-[var(--color-warning)]/15 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/25'
                    : 'border-cyan-400/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20',
                )}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.22em',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                {isExpired ? 'Renovar agora' : 'Renovar contrato'}
              </button>
            ) : null}

            {/* Auto-renovação opt-in (OLEXP) — protege o time do WO sem ação manual. */}
            {isRenewable ? (
              <button
                type="button"
                onClick={() =>
                  dispatchGame({ type: 'SET_AUTO_RENEW_CONTRACT', playerId: player.id, enabled: !autoRenewOn })
                }
                className={cn(
                  'mt-2 flex w-full touch-manipulation items-center justify-between gap-2 border px-3 py-2 transition-colors',
                  autoRenewOn
                    ? 'border-amber-400/45 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
                    : 'border-white/12 bg-white/[0.03] text-white/55 hover:bg-white/[0.06]',
                )}
                style={{ borderRadius: 'var(--radius-sm)' }}
                aria-pressed={autoRenewOn}
              >
                <span
                  className="uppercase"
                  style={{ fontFamily: 'var(--font-display)', fontSize: '9.5px', fontWeight: 800, letterSpacing: '0.18em' }}
                >
                  Auto-renovar (OLEXP)
                </span>
                <span
                  className={cn(
                    'flex h-4 w-7 shrink-0 items-center rounded-full px-0.5 transition-colors',
                    autoRenewOn ? 'justify-end bg-amber-400/80' : 'justify-start bg-white/15',
                  )}
                >
                  <span className="h-3 w-3 rounded-full bg-white" />
                </span>
              </button>
            ) : null}

            {/* Hint sutil pra jogadores sem possibilidade de renovação (Genesis etc) */}
            {!canRenew && !isLifetime && !isExpired && hasContract && contractPct <= 10 ? (
              <p
                className="mt-2 uppercase text-white/45"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                }}
              >
                Jogador de catálogo — renovação não disponível.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <RenewContractModal open={renewOpen} onClose={() => setRenewOpen(false)} player={player} />
    </>
  );
}

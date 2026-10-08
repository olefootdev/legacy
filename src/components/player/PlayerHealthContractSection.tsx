/**
 * Bloco "Saúde & Contrato" pra ficha do jogador — DS 2027 · "Respeito é ouro".
 *
 * 2 sub-blocos:
 *   1. Saúde     — energia (fadiga) + recuperação de lesão (se houver) + risco.
 *   2. Contrato  — barra em segmentos + CTA "Renovar contrato" quando aplicável.
 *
 * Pele: concreto, rótulo "— " em prova, número em Anton. Estado de jogo usa só
 * baixa/atenção; contrato vitalício é RESPEITO (fio de ouro); vencido é CHÃO
 * (tracejado); renovar é ação → rua.
 */

import { useState } from 'react';
import { Activity, ShieldCheck, FileText, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { moedaDoJogo } from '@/wallet/constants';
import { useGameStore, dispatchGame } from '@/game/store';
import { getPlayerHealth } from '@/systems/playerHealth/selectors';
import { INJURY_LABEL_PT, INJURY_MATCHES_OUT } from '@/systems/injury';
import { RenewContractModal } from '@/components/RenewContractModal';
import type { PlayerEntity } from '@/entities/types';
import { L, emIngles } from '@/i18n/L';

interface Props {
  player: PlayerEntity;
}

/** Barra em 10 segmentos (0–100), cor pelo tom. */
function ProgressBar({
  pct,
  tone,
}: {
  pct: number;
  tone: 'success' | 'warning' | 'danger' | 'neon';
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const cheios = Math.round((clamped / 100) * 10);
  const cor =
    tone === 'success' ? 'bg-papel'
    : tone === 'warning' ? 'bg-atencao'
    : tone === 'danger' ? 'bg-baixa'
    : 'bg-rua';
  return (
    <div aria-hidden className="grid h-2 w-full grid-cols-10 gap-[3px]">
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={i < cheios ? cor : 'bg-linha'} />
      ))}
    </div>
  );
}

/** Linha rótulo (prova) + valor (Anton). */
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
    tone === 'warn' ? 'text-atencao'
    : tone === 'bad' ? 'text-baixa'
    : 'text-papel';
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-prova text-[10.5px] font-bold uppercase tracking-[0.16em] text-mudo">{label}</span>
      <span className={cn('font-impact text-[17px] leading-none tabular-nums', colorClass)}>{value}</span>
    </div>
  );
}

const ROTULO = 'font-prova text-[10.5px] font-bold uppercase tracking-[0.2em]';
const PEQUENO = 'font-prova text-[10px] font-bold uppercase tracking-[0.16em] text-mudo';

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
      <section className="scroll-snap-section border-2 border-linha bg-concreto p-4">
        <h3 className={cn(ROTULO, 'mb-3 text-mudo')}>— {L('Saúde & Contrato', 'Health & Contract')}</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* ── Sub-bloco: Saúde ────────────────────────────────────────────── */}
          <div
            className={cn(
              'border-2 p-3',
              isInjured
                ? 'border-baixa/50 bg-baixa/[0.06]'
                : isSuspended
                  ? 'border-atencao/50 bg-atencao/[0.06]'
                  : 'border-linha bg-asfalto-27',
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <Activity className={cn('h-3.5 w-3.5 shrink-0', isInjured ? 'text-baixa' : 'text-mudo')} aria-hidden />
              <span className={cn(ROTULO, isInjured ? 'text-baixa' : 'text-suave')}>{L('Saúde', 'Health')}</span>
            </div>

            {/* Estado primário (lesão / suspensão / disponível) */}
            {isInjured ? (
              <>
                <p className="font-impact text-[20px] uppercase leading-none text-baixa">
                  {severity ? INJURY_LABEL_PT[severity] : L('Lesionado', 'Injured')}
                </p>
                <p className="mt-1 text-[12px] text-suave">
                  {emIngles() ? (
                    <><span className="font-bold text-papel">{h.outForMatches}</span>{' '}
                    game{h.outForMatches === 1 ? '' : 's'} until return</>
                  ) : (
                    <>Faltam <span className="font-bold text-papel">{h.outForMatches}</span>{' '}
                    jogo{h.outForMatches === 1 ? '' : 's'} pro retorno</>
                  )}
                  {totalMatchesForInjury ? ` (${matchesCompleted}/${totalMatchesForInjury})` : ''}.
                </p>
                {totalMatchesForInjury ? (
                  <div className="mt-2.5">
                    <ProgressBar pct={recoveryPct} tone="warning" />
                    <p className={cn(PEQUENO, 'mt-1')}>
                      {L('Recuperando', 'Recovering')} · {Math.round(recoveryPct)}%
                    </p>
                  </div>
                ) : null}
              </>
            ) : isSuspended ? (
              <>
                <p className="font-impact text-[20px] uppercase leading-none text-atencao">{L('Suspenso', 'Suspended')}</p>
                <p className="mt-1 text-[12px] text-suave">
                  {L(`${h.suspendedMatches} jogo${h.suspendedMatches === 1 ? '' : 's'} de suspensão.`, `${h.suspendedMatches}-game suspension.`)}
                </p>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-papel" aria-hidden />
                <span className="font-impact text-[20px] uppercase leading-none text-papel">{L('Disponível', 'Available')}</span>
              </div>
            )}

            {/* Métricas sempre visíveis: energia, fadiga, risco */}
            <div className="mt-3 space-y-2.5 border-t-2 border-linha pt-3">
              <div>
                <MetricRow label={L('Energia', 'Energy')} value={`${energyPct}%`} tone={fatigueTone === 'bad' ? 'bad' : fatigueTone === 'warn' ? 'warn' : 'good'} />
                <div className="mt-1.5">
                  <ProgressBar pct={energyPct} tone={energyTone} />
                </div>
              </div>
              <MetricRow label={L('Risco de lesão', 'Injury risk')} value={`${riskPct}/100`} tone={riskTone} />
            </div>
          </div>

          {/* ── Sub-bloco: Contrato ─────────────────────────────────────────── */}
          <div
            className={cn(
              'p-3',
              isExpired
                ? 'border-2 border-dashed border-fio bg-asfalto-27'
                : isLifetime
                  ? 'border-[3px] border-ouro-27 bg-asfalto-27'
                  : contractPct <= 10
                    ? 'border-2 border-atencao/50 bg-atencao/[0.06]'
                    : 'border-2 border-linha bg-asfalto-27',
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <FileText
                className={cn('h-3.5 w-3.5 shrink-0', isLifetime ? 'text-ouro-27' : 'text-mudo')}
                aria-hidden
              />
              <span className={cn(ROTULO, isLifetime ? 'text-ouro-27' : 'text-suave')}>{L('Contrato', 'Contract')}</span>
            </div>

            {isLifetime ? (
              <>
                <p className="font-impact text-[20px] uppercase leading-none text-ouro-27">{L('Vitalício', 'Lifetime')}</p>
                <p className="mt-1 text-[12px] text-suave">
                  {L('Jogador histórico do clube — sem fim de jogos.', 'Club legend — no game limit.')}
                </p>
              </>
            ) : isExpired ? (
              <>
                <p className="font-impact text-[20px] uppercase leading-none text-suave">{L('Vencido', 'Expired')}</p>
                <p className="mt-1 text-[12px] text-suave">
                  {L('Não pode entrar em XI oficial. Renove pra reativar.', 'Can’t be in an official XI. Renew to reactivate.')}
                </p>
              </>
            ) : hasContract ? (
              <>
                <p className={cn('font-impact text-[22px] leading-none tabular-nums', contractPct <= 10 ? 'text-atencao' : 'text-papel')}>
                  {remaining} <span className="font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-mudo">/ {included} {L('jogos', 'games')}</span>
                </p>
                <p className="mt-1 text-[12px] text-suave">
                  {L('Desconta 1 a cada partida em que o jogador entra.', 'Counts down 1 for each match the player plays.')}
                </p>
                <div className="mt-2.5">
                  <ProgressBar pct={contractPct} tone={contractTone} />
                  <p className={cn(PEQUENO, 'mt-1')}>
                    {L('Restante', 'Remaining')} · {Math.round(contractPct)}%
                  </p>
                </div>
              </>
            ) : (
              <p className="text-[12px] text-suave">{L('Sem contrato registrado.', 'No contract on record.')}</p>
            )}

            {/* CTA de renovação — prospects do manager + Genesis não-vitalícios. */}
            {canRenew ? (
              <button
                type="button"
                onClick={() => setRenewOpen(true)}
                className={cn(
                  'mt-3 inline-flex min-h-10 w-full touch-manipulation items-center justify-center gap-1.5 font-impact text-[16px] uppercase leading-none transition-[transform,background-color,color]',
                  isExpired
                    ? 'bg-rua text-asfalto-27 shadow-[3px_3px_0_var(--color-papel)] hover:-translate-y-px'
                    : 'border-2 border-rua text-rua hover:bg-rua hover:text-asfalto-27',
                )}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                {isExpired ? L('Renovar agora', 'Renew now') : L('Renovar contrato', 'Renew contract')} <span aria-hidden>→</span>
              </button>
            ) : null}

            {/* Auto-renovação opt-in (verba) — protege o time do WO sem ação manual. */}
            {isRenewable ? (
              <button
                type="button"
                onClick={() =>
                  dispatchGame({ type: 'SET_AUTO_RENEW_CONTRACT', playerId: player.id, enabled: !autoRenewOn })
                }
                className={cn(
                  'mt-2 flex w-full touch-manipulation items-center justify-between gap-2 border-2 px-3 py-2 transition-colors',
                  autoRenewOn ? 'border-rua text-rua' : 'border-linha text-mudo hover:border-fio',
                )}
                aria-pressed={autoRenewOn}
              >
                <span className="font-prova text-[10px] font-bold uppercase tracking-[0.14em]">
                  {L('Auto-renovar', 'Auto-renew')} ({moedaDoJogo()})
                </span>
                <span
                  className={cn(
                    'flex h-4 w-7 shrink-0 items-center rounded-full px-0.5 transition-colors',
                    autoRenewOn ? 'justify-end bg-rua' : 'justify-start bg-linha',
                  )}
                >
                  <span className={cn('h-3 w-3 rounded-full', autoRenewOn ? 'bg-asfalto-27' : 'bg-mudo')} />
                </span>
              </button>
            ) : null}

            {/* Hint pra jogadores sem possibilidade de renovação (Genesis etc) */}
            {!canRenew && !isLifetime && !isExpired && hasContract && contractPct <= 10 ? (
              <p className={cn(PEQUENO, 'mt-2')}>
                {L('Jogador de catálogo — renovação não disponível.', 'Catalogue player — renewal unavailable.')}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <RenewContractModal open={renewOpen} onClose={() => setRenewOpen(false)} player={player} />
    </>
  );
}

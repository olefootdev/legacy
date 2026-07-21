/**
 * ManagerDesk — módulo "Mesa do Manager" do layout v3.
 *
 * Três pendências REAIS que exigem decisão: suspensões, contratos vencidos e
 * propostas de compra. Cada linha só aparece quando o count > 0. Se as três
 * forem 0 → "Tudo em dia". Dados por props (Home conta do estado real:
 * playerHealth.suspendedMatches, contractExpired, useMarketOffers.incomingCount).
 */

import { useNavigate } from 'react-router-dom';

type Row = {
  key: string;
  icon: string;
  title: string;
  subtitle: string;
  count: number;
  tone: 'red' | 'warn' | 'neon';
  action?: string;
  onClick: () => void;
};

export function ManagerDesk({
  suspendedCount,
  expiredCount,
  offersCount,
  onOpenOffers,
}: {
  suspendedCount: number;
  expiredCount: number;
  offersCount: number;
  onOpenOffers?: () => void;
}) {
  const navigate = useNavigate();

  const rows: Row[] = [];
  if (suspendedCount > 0) {
    rows.push({
      key: 'susp',
      icon: '⛔',
      title: 'Suspensões',
      subtitle: `${suspendedCount} jogador${suspendedCount > 1 ? 'es' : ''} fora da próxima`,
      count: suspendedCount,
      tone: 'red',
      onClick: () => navigate('/clube/elenco'),
    });
  }
  if (expiredCount > 0) {
    rows.push({
      key: 'contract',
      icon: '📄',
      title: 'Contrato vencido',
      subtitle: `${expiredCount} não pode${expiredCount > 1 ? 'm' : ''} ser escalado${expiredCount > 1 ? 's' : ''}`,
      count: expiredCount,
      tone: 'red',
      action: 'Renovar ›',
      onClick: () => navigate('/clube/elenco'),
    });
  }
  if (offersCount > 0) {
    rows.push({
      key: 'offers',
      icon: '💰',
      title: 'Propostas de compra',
      subtitle: `${offersCount} proposta${offersCount > 1 ? 's' : ''} pelo teu elenco`,
      count: offersCount,
      tone: 'neon',
      onClick: onOpenOffers ?? (() => navigate('/mercado/transfer')),
    });
  }

  const toneColor: Record<Row['tone'], string> = {
    red: 'var(--color-danger)',
    warn: 'var(--color-warning)',
    neon: 'var(--color-neon-yellow)',
  };

  return (
    <section aria-label="Mesa do Manager" className="flex flex-col gap-2">
      <span
        className="mb-0.5 font-display font-black uppercase text-white/45"
        style={{ fontSize: '9px', letterSpacing: '0.2em' }}
      >
        Mesa do Manager
      </span>

      {rows.length === 0 ? (
        <div
          className="flex items-center gap-3 border border-[var(--color-border)] bg-dark-gray px-4 py-4"
          style={{ borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-success)' }}
        >
          <span aria-hidden style={{ fontSize: '16px' }}>
            ✅
          </span>
          <div>
            <p className="font-impact uppercase text-white" style={{ fontSize: '12px' }}>
              Tudo em dia
            </p>
            <p className="text-white/55" style={{ fontFamily: 'var(--font-sans)', fontSize: '10px' }}>
              Nenhuma pendência no teu elenco.
            </p>
          </div>
        </div>
      ) : (
        rows.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={r.onClick}
            className="flex items-center gap-3 border border-[var(--color-border)] bg-dark-gray px-3 py-2.5 text-left transition-all hover:border-white/20"
            style={{ borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${toneColor[r.tone]}` }}
          >
            <span
              aria-hidden
              className="grid h-8 w-8 flex-none place-items-center bg-[var(--color-card)]"
              style={{ borderRadius: 'var(--radius-sm)', fontSize: '14px' }}
            >
              {r.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-impact uppercase text-white" style={{ fontSize: '11px' }}>
                {r.title}
              </span>
              <span className="block truncate text-white/60" style={{ fontFamily: 'var(--font-sans)', fontSize: '10px' }}>
                {r.subtitle}
              </span>
            </span>
            {r.action ? (
              <span
                className="flex-none font-display font-black uppercase text-white/60"
                style={{ fontSize: '8.5px', letterSpacing: '0.12em' }}
              >
                {r.action}
              </span>
            ) : (
              <span
                className="flex-none font-impact tabular-nums"
                style={{ fontSize: '22px', lineHeight: 0.8, color: toneColor[r.tone] }}
              >
                {r.count}
              </span>
            )}
          </button>
        ))
      )}
    </section>
  );
}

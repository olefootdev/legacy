/**
 * ManagerDesk — "Mesa do Manager".
 *
 * Três pendências REAIS que exigem decisão: suspensões, contratos vencidos e
 * propostas de compra. Cada linha só aparece quando count > 0; se as três forem
 * 0 → "Tudo em dia". Dados por props (Home conta do estado real).
 *
 * ── Linguagem REVELA (2026-07-24) ──────────────────────────────────────────
 * Quando HÁ pendência, a seção vira um pôster AMARELO que sangra na largura —
 * porque aqui amarelo significa "precisa de você". Sem pendência, ela volta a
 * ser discreta e o amarelo some. A cor é informação, não decoração.
 *
 * Cada linha segue o formato pedido pelo fundador: ícone + quantidade + ação +
 * atividade, com botão preto e texto branco sobre o amarelo. Os ícones vêm do
 * lucide (já instalado) — nada de emoji.
 */

import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, CircleCheck, FileClock, ShieldAlert, type LucideIcon } from 'lucide-react';

type Row = {
  key: string;
  icon: LucideIcon;
  count: number;
  /** A frase de comando — o que a pessoa precisa fazer. */
  acao: string;
  /** O contexto — que pendência é essa. */
  atividade: string;
  /** O verbo curto do botão. */
  botao: string;
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
      icon: ShieldAlert,
      count: suspendedCount,
      acao: 'Reveja a escalação',
      atividade: `jogador${suspendedCount > 1 ? 'es' : ''} suspenso${suspendedCount > 1 ? 's' : ''} pra próxima`,
      botao: 'Escalar',
      onClick: () => navigate('/clube/elenco'),
    });
  }
  if (expiredCount > 0) {
    rows.push({
      key: 'contract',
      icon: FileClock,
      count: expiredCount,
      acao: 'Renove o contrato',
      atividade: `vencido${expiredCount > 1 ? 's' : ''} — não pode escalar`,
      botao: 'Renovar',
      onClick: () => navigate('/clube/elenco'),
    });
  }
  if (offersCount > 0) {
    rows.push({
      key: 'offers',
      icon: ArrowLeftRight,
      count: offersCount,
      acao: 'Responda as ofertas',
      atividade: `proposta${offersCount > 1 ? 's' : ''} pelo teu elenco`,
      botao: 'Ver mesa',
      onClick: onOpenOffers ?? (() => navigate('/mercado/transfer')),
    });
  }

  // ── Tudo em dia: discreto, sem amarelo. A cor só aparece quando há ação. ──
  if (rows.length === 0) {
    return (
      <section aria-label="Mesa do Manager" className="flex flex-col gap-2">
        <span className="ole-eyebrow-poster" style={{ fontSize: '12px' }}>
          Mesa do manager
        </span>
        <div className="ole-poster flex items-center gap-3 px-4 py-4" style={{ borderLeft: '3px solid var(--color-success)' }}>
          <CircleCheck className="h-5 w-5 flex-none" strokeWidth={2.2} style={{ color: 'var(--color-success)' }} aria-hidden />
          <div>
            <p className="font-impact uppercase text-white" style={{ fontSize: '13px' }}>
              Tudo em dia
            </p>
            <p className="text-white/55" style={{ fontFamily: 'var(--font-sans)', fontSize: '11px' }}>
              Nenhuma pendência no teu elenco.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ── Há pendência: pôster amarelo sangrado. ───────────────────────────────
  return (
    <section
      aria-label="Mesa do Manager"
      className="ole-bleed"
      style={{
        background: 'var(--color-neon-yellow)',
        color: 'var(--color-deep-black)',
        paddingBlock: 'clamp(22px, 5vw, 34px)',
      }}
    >
      <span className="ole-eyebrow-poster" data-on="yellow" style={{ fontSize: '12px' }}>
        Precisa de você
      </span>
      <h2
        className="mt-2 font-impact uppercase"
        style={{ fontSize: 'clamp(26px, 6vw, 40px)', lineHeight: 0.9, letterSpacing: '-0.01em' }}
      >
        Mesa do manager
      </h2>

      <div className="mt-5 flex flex-col gap-2.5">
        {rows.map((r) => (
          <div
            key={r.key}
            className="grid items-center gap-3.5"
            style={{
              gridTemplateColumns: 'auto auto 1fr auto',
              background: 'rgba(13,13,13,0.06)',
              border: '1.5px solid rgba(13,13,13,0.14)',
              borderRadius: 'var(--radius-poster)',
              padding: '12px 14px',
            }}
          >
            <r.icon className="h-6 w-6 flex-none" strokeWidth={1.9} style={{ color: 'var(--color-deep-black)' }} aria-hidden />
            <span
              className="font-impact tabular-nums"
              style={{ fontSize: '34px', lineHeight: 0.8, color: 'var(--color-deep-black)' }}
            >
              {r.count}
            </span>
            <span className="min-w-0">
              <span className="block font-impact uppercase" style={{ fontSize: '15px', lineHeight: 1, color: 'var(--color-deep-black)' }}>
                {r.acao}
              </span>
              <span className="mt-0.5 block" style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'rgba(13,13,13,0.6)' }}>
                {r.atividade}
              </span>
            </span>
            <button
              type="button"
              onClick={r.onClick}
              className="min-h-[38px] flex-none whitespace-nowrap rounded-md px-4 font-display font-black uppercase"
              style={{ background: 'var(--color-deep-black)', color: '#fff', fontSize: '10px', letterSpacing: '0.12em' }}
            >
              {r.botao}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

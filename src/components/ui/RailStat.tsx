import type { ReactNode } from 'react';

/**
 * Stat card do DS: trilho amarelo de 3px à esquerda, rótulo e número grande.
 * Reusado em Treino / Staff / Academia.
 *
 * ── 2026-08-01 ─────────────────────────────────────────────────────────────
 * Duas correções:
 *   1. o número era serifa itálica — que no layer final é assinatura de nome
 *      de lenda, nunca de número. Virou Anton tabular.
 *   2. o valor era 32px fixo dentro de um box com `overflow-hidden`, então
 *      "10.000.000 EXP" aparecia na tela cortado como "10.000.0". Agora o
 *      tamanho é fluido e o texto quebra em vez de sumir — número cortado é
 *      pior que número pequeno: mente sobre o saldo.
 */
export function RailStat({
  label,
  value,
  hint,
  rail = 'var(--color-neon-yellow)',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  rail?: string;
}) {
  return (
    <div className="ole-poster relative min-w-0 overflow-hidden py-3.5 pl-[18px] pr-3">
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: rail }} aria-hidden />
      <div
        className="font-display font-semibold uppercase text-neon-yellow"
        style={{ fontSize: '10px', letterSpacing: '0.13em' }}
      >
        {label}
      </div>
      <div
        className="mt-1 font-impact tabular-nums leading-none text-white"
        style={{
          // Escala baixa no mobile de propósito: em três colunas de ~110px um
          // saldo de 10.000.000 precisa caber numa linha só. Número quebrado em
          // duas linhas ou cortado pelo overflow mente sobre o saldo.
          fontSize: 'clamp(15px, 4.2vw, 30px)',
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-[10px] text-white/40">{hint}</div>}
    </div>
  );
}

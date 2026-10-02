/**
 * ECONOMIA → Pré-venda — a torneira que até aqui era UPDATE manual no SQL
 * Editor (e que o raio-x 30/09 encontrou ABERTA e sem teto por conta).
 * Abrir/fechar, teto por conta, degrau e teto pós-degrau; embaixo, compras e
 * posições. A compra em si segue 100% no caminho do Pix.
 */
import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Settings2, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { lerPresaleAdmin, mudarPresaleConfig, type PresaleAdmin } from '@/admin/adminExpansaoClient';
import { dolarCents, fmtData, tok } from '@/admin/fmt';

export function AdminPreVendaPanel() {
  const [dados, setDados] = useState<PresaleAdmin | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // O formulário edita em DÓLARES; o servidor fala em centavos.
  const [aberta, setAberta] = useState(false);
  const [liquidez, setLiquidez] = useState(false);
  const [tetoUsd, setTetoUsd] = useState('');
  const [degrauBps, setDegrauBps] = useState('');
  const [tetoAposUsd, setTetoAposUsd] = useState('');
  const [confirma, setConfirma] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const d = await lerPresaleAdmin();
      setDados(d);
      setAberta(d.config?.aberta === true);
      setLiquidez(d.config?.liquidez_adicionada === true);
      setTetoUsd(d.config?.teto_conta_usd_cents != null ? String(d.config.teto_conta_usd_cents / 100) : '');
      setDegrauBps(d.config?.degrau_vendido_bps != null ? String(d.config.degrau_vendido_bps) : '');
      setTetoAposUsd(d.config?.teto_apos_degrau_usd_cents != null ? String(d.config.teto_apos_degrau_usd_cents / 100) : '');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar a pré-venda.');
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const salvar = async () => {
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      await mudarPresaleConfig({
        aberta,
        liquidezAdicionada: liquidez,
        tetoContaUsdCents: tetoUsd.trim() === '' ? null : Math.round(Number(tetoUsd) * 100),
        degrauVendidoBps: degrauBps.trim() === '' ? undefined : Number(degrauBps),
        tetoAposDegrauUsdCents: tetoAposUsd.trim() === '' ? null : Math.round(Number(tetoAposUsd) * 100),
      });
      setConfirma(false);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const campo = 'w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30';
  const pct = dados ? (dados.vendidoBps / 100).toFixed(2) : '0';

  return (
    <div className="space-y-6">
      {erro ? <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{erro}</p> : null}

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
            <Settings2 className="h-4 w-4" /> Torneira
          </h3>
          <span className="flex items-center gap-2">
            <span className={cn('rounded border px-2 py-0.5 text-[10px] font-bold uppercase',
              dados?.config?.liquidez_adicionada
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                : 'border-amber-500/40 bg-amber-500/15 text-amber-200')}
              title="Decisão do fundador: nenhuma liberação de token da pré-venda acontece antes de adicionar liquidez na moeda">
              {dados?.config?.liquidez_adicionada ? 'Liquidez OK — liberação destravada' : 'Liberação TRAVADA (sem liquidez)'}
            </span>
            <span className={cn('rounded border px-2 py-0.5 text-[10px] font-bold uppercase',
              dados?.config?.aberta ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200' : 'border-rose-500/40 bg-rose-500/15 text-rose-200')}>
              {dados?.config?.aberta ? 'Aberta' : 'Fechada'}
            </span>
          </span>
        </div>

        <div className="mb-4">
          <div className="flex items-baseline justify-between font-mono text-[11px] text-white/55">
            <span>{tok(dados?.vendidosTokens)} vendidos de {tok(dados?.alocacaoTokens)} ({pct}%)</span>
            <span>
              {dados ? `${dados.totais.pagas} compra(s) paga(s) · ${dolarCents(dados.totais.usdCentsPagos)}` : '—'}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full bg-white/10">
            <div className="h-full bg-neon-yellow" style={{ width: `${Math.min(100, Number(pct))}%` }} />
          </div>
          {/* Gatilho da LIQUIDEZ (fundador, 2026-10-01): pool no DEX quando as
              vendas pagas cruzarem $10.000 — esta régua é o relógio disso. */}
          {(() => {
            const pagosCents = Number(dados?.totais.usdCentsPagos ?? 0);
            const metaCents = 1_000_000; // $10.000,00
            const pctLiq = Math.min(100, (pagosCents / metaCents) * 100);
            return (
              <div className="mt-3">
                <div className="flex items-baseline justify-between font-mono text-[11px]">
                  <span className="uppercase tracking-wider text-amber-200/80">Gatilho da liquidez</span>
                  <span className="text-white/55">{dolarCents(pagosCents)} de $10.000,00 ({pctLiq.toFixed(1)}%)</span>
                </div>
                <div className="mt-1 h-1.5 w-full bg-white/10">
                  <div className={cn('h-full', pctLiq >= 100 ? 'bg-emerald-400' : 'bg-amber-400')} style={{ width: `${pctLiq}%` }} />
                </div>
                {pctLiq >= 100 ? (
                  <p className="mt-1 text-[11px] font-bold text-emerald-300">
                    Meta batida — hora de adicionar a pool no DEX e ligar "Liquidez adicionada".
                  </p>
                ) : null}
              </div>
            );
          })()}
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <label className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/40 px-3 py-2">
            <input type="checkbox" checked={aberta} onChange={(e) => setAberta(e.target.checked)} className="h-4 w-4 accent-yellow-400" />
            <span className="text-xs font-bold uppercase text-white/80">Pré-venda aberta</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-black/40 px-3 py-2"
            title="Enquanto desligado, NENHUMA liberação de token da pré-venda pode acontecer — é a trava que as pontes de unlock checam.">
            <input type="checkbox" checked={liquidez} onChange={(e) => setLiquidez(e.target.checked)} className="h-4 w-4 accent-yellow-400" />
            <span className="text-xs font-bold uppercase text-amber-200/90">Liquidez adicionada (destrava liberação)</span>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase text-white/45">Teto por conta (US$)</span>
            <input className={campo} value={tetoUsd} onChange={(e) => setTetoUsd(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} placeholder="em branco = sem teto" inputMode="decimal" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase text-white/45">Degrau (bps vendidos)</span>
            <input className={campo} value={degrauBps} onChange={(e) => setDegrauBps(e.target.value.replace(/\D/g, ''))} placeholder="5000 = 50%" inputMode="numeric" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase text-white/45">Teto após o degrau (US$)</span>
            <input className={campo} value={tetoAposUsd} onChange={(e) => setTetoAposUsd(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} placeholder="em branco = sem teto" inputMode="decimal" />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={() => setConfirma(true)} disabled={carregando}
            className="rounded-lg bg-neon-yellow px-4 py-2 text-xs font-bold uppercase text-black hover:bg-yellow-300 disabled:opacity-50">
            Salvar config
          </button>
          <button type="button" onClick={() => void carregar()} disabled={carregando}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-[10px] font-bold uppercase text-white/70 hover:bg-white/10 disabled:opacity-50">
            <RotateCcw className={cn('h-3.5 w-3.5', carregando && 'animate-spin')} /> Atualizar
          </button>
          <span className="text-[11px] text-white/40">Atualizada {fmtData(dados?.config?.atualizado_em)}</span>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
          <ShoppingCart className="h-4 w-4" /> Compras · {dados?.totais.compras ?? 0}
        </h3>
        <div className="max-h-[340px] overflow-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-black/90">
              <tr className="border-b border-white/10 text-[9px] uppercase text-white/45">
                <th className="px-2 py-2">Quem</th>
                <th className="px-2 py-2">US$</th>
                <th className="px-2 py-2">R$ (Pix)</th>
                <th className="px-2 py-2">Tokens</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Criada</th>
                <th className="px-2 py-2">Paga</th>
              </tr>
            </thead>
            <tbody>
              {(dados?.compras ?? []).map((compra) => (
                <tr key={compra.id} className="border-b border-white/5">
                  <td className="px-2 py-1.5 text-white/85">{compra.username ? `@${compra.username}` : '—'}</td>
                  <td className="px-2 py-1.5 font-mono text-white/70">{dolarCents(compra.usd_cents)}</td>
                  <td className="px-2 py-1.5 font-mono text-white/55">{(Number(BigInt(String(compra.brl_cents || '0'))) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td className="px-2 py-1.5 font-mono text-emerald-200/90">{tok(compra.tokens_entregues)}</td>
                  <td className="px-2 py-1.5 text-white/55">{compra.status}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-white/45">{fmtData(compra.criada_em)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-white/45">{compra.paga_em ? fmtData(compra.paga_em) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!carregando && (dados?.compras.length ?? 0) === 0 ? <p className="p-6 text-center text-sm text-white/35">Nenhuma compra.</p> : null}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
          Posições · {dados?.posicoes.length ?? 0}
        </h3>
        <div className="max-h-[300px] overflow-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-black/90">
              <tr className="border-b border-white/10 text-[9px] uppercase text-white/45">
                <th className="px-2 py-2">Quem</th>
                <th className="px-2 py-2">Comprou (US$)</th>
                <th className="px-2 py-2">Tokens totais</th>
                <th className="px-2 py-2">Liberado compra</th>
                <th className="px-2 py-2">Liberado tempo</th>
                <th className="px-2 py-2">Sacado</th>
              </tr>
            </thead>
            <tbody>
              {(dados?.posicoes ?? []).map((posicao, i) => (
                <tr key={`${posicao.username ?? i}`} className="border-b border-white/5">
                  <td className="px-2 py-1.5 text-white/85">{posicao.username ? `@${posicao.username}` : '—'}</td>
                  <td className="px-2 py-1.5 font-mono text-white/70">{dolarCents(posicao.compra_original_usd_cents)}</td>
                  <td className="px-2 py-1.5 font-mono text-white/70">{tok(posicao.tokens_totais)}</td>
                  <td className="px-2 py-1.5 font-mono text-white/55">{tok(posicao.liberado_por_compra)}</td>
                  <td className="px-2 py-1.5 font-mono text-white/55">{tok(posicao.liberado_por_tempo)}</td>
                  <td className="px-2 py-1.5 font-mono text-white/55">{tok(posicao.sacado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!carregando && (dados?.posicoes.length ?? 0) === 0 ? <p className="p-6 text-center text-sm text-white/35">Nenhuma posição.</p> : null}
        </div>
      </section>

      <ConfirmDialog
        open={confirma}
        onClose={() => (salvando ? null : setConfirma(false))}
        onConfirm={() => void salvar()}
        eyebrow="Pré-venda"
        title={aberta ? 'Salvar e manter a pré-venda ABERTA?' : 'Salvar e FECHAR a pré-venda?'}
        confirmLabel={salvando ? 'Salvando…' : 'Salvar'}
        confirmDisabled={salvando}
        accent="#eab308"
      >
        <div className="mt-3 space-y-1 text-sm text-white/75">
          <p>Torneira: <strong>{aberta ? 'aberta' : 'fechada'}</strong></p>
          <p>Teto por conta: <strong>{tetoUsd.trim() === '' ? 'SEM teto' : `US$ ${tetoUsd}`}</strong></p>
          <p>Degrau: <strong>{degrauBps || '—'} bps</strong> · teto após: <strong>{tetoAposUsd.trim() === '' ? 'SEM teto' : `US$ ${tetoAposUsd}`}</strong></p>
          <p className="text-xs text-white/50">Vale pra TODO MUNDO na próxima compra. Exige login recente.</p>
        </div>
      </ConfirmDialog>
    </div>
  );
}

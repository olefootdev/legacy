/**
 * EXPANSÃO → Ciclos — o livro-caixa do ciclo horário, que até aqui só
 * existia no SQL Editor: pool, equiparado, pago e cortado hora a hora, as
 * liquidações de cada hora, e o botão que roda o MESMO fechamento do cron.
 * Embaixo, o raio-x de uma conta: liquidações, teto do dia, prêmios e claims.
 */
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Clock, RotateCcw, Search, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  fecharCiclosPendentes,
  lerLiquidacoesDoCiclo,
  lerPessoaExpansao,
  lerResumoExpansao,
  type CicloAdmin,
  type LiquidacaoAdmin,
  type PessoaExpansao,
  type ResumoExpansao,
} from '@/admin/adminExpansaoClient';
import { dolarCents, fmtData, tok } from '@/admin/fmt';

const COR_STATUS: Record<string, string> = {
  SETTLED: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  HELD: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  CANCELED: 'border-rose-500/40 bg-rose-500/15 text-rose-200',
};

function Kpi({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[9px] uppercase tracking-widest text-white/40">{rotulo}</div>
      <div className={cn('mt-1 font-mono text-lg font-bold tabular-nums', destaque ? 'text-neon-yellow' : 'text-white')}>
        {valor}
      </div>
    </div>
  );
}

export function AdminExpansaoPanel() {
  const [resumo, setResumo] = useState<ResumoExpansao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [confirmaFechar, setConfirmaFechar] = useState(false);
  const [fechando, setFechando] = useState(false);
  const [fechados, setFechados] = useState<number | null>(null);

  const [cicloAberto, setCicloAberto] = useState<number | null>(null);
  const [liquidacoes, setLiquidacoes] = useState<LiquidacaoAdmin[]>([]);
  const [carregandoLiq, setCarregandoLiq] = useState(false);

  const [busca, setBusca] = useState('');
  const [pessoa, setPessoa] = useState<PessoaExpansao | null>(null);
  const [buscando, setBuscando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try { setResumo(await lerResumoExpansao()); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar os ciclos.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const fechar = async () => {
    if (fechando) return;
    setFechando(true);
    setErro(null);
    try {
      const r = await fecharCiclosPendentes();
      setFechados(r.fechados);
      setConfirmaFechar(false);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao fechar.');
    } finally {
      setFechando(false);
    }
  };

  const abrirCiclo = async (id: number) => {
    if (cicloAberto === id) { setCicloAberto(null); return; }
    setCicloAberto(id);
    setCarregandoLiq(true);
    try { setLiquidacoes((await lerLiquidacoesDoCiclo(id)).liquidacoes); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao abrir o ciclo.'); }
    finally { setCarregandoLiq(false); }
  };

  const buscar = async () => {
    if (buscando || !busca.trim()) return;
    setBuscando(true);
    setErro(null);
    try { setPessoa(await lerPessoaExpansao(busca)); }
    catch (e) { setPessoa(null); setErro(e instanceof Error ? e.message : 'Falha na busca.'); }
    finally { setBuscando(false); }
  };

  const campo = 'w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30';
  const j = resumo?.janela;

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-white/45">
        O ciclo fecha a cada hora pelo cron (<code className="text-white/60">expansao-ciclo-horario</code>, min 05).
        O botão roda o <strong className="text-white/80">mesmo fechamento</strong> — idempotente, com lock no banco.
      </p>

      {erro ? <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{erro}</p> : null}
      {fechados != null ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {fechados === 0 ? 'Nenhuma hora pendente — o cron está em dia.' : `${fechados} hora(s) fechada(s).`}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Horas por fechar" valor={resumo?.horasPendentes == null ? '—' : String(resumo.horasPendentes)} destaque={(resumo?.horasPendentes ?? 0) > 0} />
        <Kpi rotulo={`Pool (últimos ${j?.ciclos ?? 0} ciclos)`} valor={j ? dolarCents(j.poolUsdCents) : '—'} />
        <Kpi rotulo="Pago" valor={j ? dolarCents(j.pagoUsdCents) : '—'} />
        <Kpi rotulo="Cortado pelo teto" valor={j ? dolarCents(j.cortadoUsdCents) : '—'} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setConfirmaFechar(true)}
          disabled={carregando}
          className="flex items-center gap-2 rounded-lg bg-neon-yellow px-4 py-2 text-xs font-bold uppercase text-black hover:bg-yellow-300 disabled:opacity-50"
        >
          <Zap className="h-4 w-4" /> Fechar horas pendentes
        </button>
        <button type="button" onClick={() => void carregar()} disabled={carregando}
          className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-[10px] font-bold uppercase text-white/70 hover:bg-white/10 disabled:opacity-50">
          <RotateCcw className={cn('h-3.5 w-3.5', carregando && 'animate-spin')} /> Atualizar
        </button>
        {j ? (
          <span className="text-[11px] text-white/40">
            {j.settled} pagaram · {j.held} retidos (HELD = hora sem equiparação; o saldo não é confiscado)
          </span>
        ) : null}
      </div>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
          <Clock className="h-4 w-4" /> Ciclos (clique pra abrir as liquidações)
        </h3>
        <div className="max-h-[420px] overflow-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-black/90">
              <tr className="border-b border-white/10 text-[9px] uppercase text-white/45">
                <th className="px-2 py-2">Hora (abre)</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Pool</th>
                <th className="px-2 py-2">Equiparado</th>
                <th className="px-2 py-2">Pago</th>
                <th className="px-2 py-2">Cortado</th>
                <th className="px-2 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {(resumo?.ciclos ?? []).map((ciclo: CicloAdmin) => (
                <Fragment key={ciclo.id}>
                  <tr onClick={() => void abrirCiclo(ciclo.id)}
                    className={cn('cursor-pointer border-b border-white/5 hover:bg-white/[0.04]', cicloAberto === ciclo.id && 'bg-white/[0.05]')}>
                    <td className="whitespace-nowrap px-2 py-1.5 font-mono text-white/85">{fmtData(ciclo.abre_em)}</td>
                    <td className="px-2 py-1.5">
                      <span className={cn('rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase',
                        COR_STATUS[ciclo.status] ?? 'border-white/15 bg-white/10 text-white/60')}>
                        {ciclo.status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-white/70">{dolarCents(ciclo.pool)}</td>
                    <td className="px-2 py-1.5 font-mono text-white/55">{dolarCents(ciclo.equiparado_total)}</td>
                    <td className="px-2 py-1.5 font-mono text-emerald-200/90">{dolarCents(ciclo.bonus_total)}</td>
                    <td className="px-2 py-1.5 font-mono text-amber-200/80">{dolarCents(ciclo.cortado_total)}</td>
                    <td className="max-w-[160px] truncate px-2 py-1.5 text-white/40" title={ciclo.motivo ?? undefined}>{ciclo.motivo ?? '—'}</td>
                  </tr>
                  {cicloAberto === ciclo.id ? (
                    <tr className="border-b border-white/10 bg-black/40">
                      <td colSpan={7} className="px-3 py-2">
                        {carregandoLiq ? <p className="py-2 text-white/40">Carregando…</p> : liquidacoes.length === 0 ? (
                          <p className="py-2 text-white/40">Ninguém foi liquidado neste ciclo.</p>
                        ) : (
                          <table className="w-full text-left text-[11px]">
                            <thead>
                              <tr className="text-[9px] uppercase text-white/40">
                                <th className="px-2 py-1">Quem</th>
                                <th className="px-2 py-1">Equiparado</th>
                                <th className="px-2 py-1">Bônus</th>
                                <th className="px-2 py-1">Cortado (teto)</th>
                                <th className="px-2 py-1">Retido</th>
                              </tr>
                            </thead>
                            <tbody>
                              {liquidacoes.map((l) => (
                                <tr key={l.user_id} className="border-t border-white/5">
                                  <td className="px-2 py-1 text-white/85">{l.username ? `@${l.username}` : l.user_id.slice(0, 8)}</td>
                                  <td className="px-2 py-1 font-mono text-white/55">{tok(l.equiparado)} OLEXP</td>
                                  <td className="px-2 py-1 font-mono text-emerald-200/90">{dolarCents(l.bonus_contabil)}</td>
                                  <td className="px-2 py-1 font-mono text-amber-200/80">{dolarCents(l.cortado_teto)}</td>
                                  <td className="px-2 py-1 text-white/55">{l.retido_inativo ? 'sim' : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
          {!carregando && (resumo?.ciclos.length ?? 0) === 0 ? (
            <p className="p-8 text-center text-sm text-white/35">Nenhum ciclo ainda — o primeiro nasce com a primeira compra.</p>
          ) : null}
          {carregando ? <p className="p-8 text-center text-sm text-white/35">Carregando…</p> : null}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
          <Search className="h-4 w-4" /> Raio-x de uma conta
        </h3>
        <div className="flex gap-2">
          <input className={campo} value={busca} onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void buscar(); }} placeholder="@username" />
          <button type="button" onClick={() => void buscar()} disabled={buscando || !busca.trim()}
            className="shrink-0 rounded-lg bg-neon-yellow px-4 py-2 text-xs font-bold uppercase text-black hover:bg-yellow-300 disabled:opacity-50">
            {buscando ? 'Buscando…' : 'Buscar'}
          </button>
        </div>

        {pessoa ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi rotulo="Liquidado (total)" valor={dolarCents(pessoa.totalUsdCents)} />
              <Kpi rotulo="Hoje (teto $2.500)" valor={dolarCents(pessoa.hojeUsdCents)} />
              <Kpi rotulo="Cortado pelo teto" valor={dolarCents(pessoa.cortadoUsdCents)} />
              <Kpi rotulo="Disponível p/ saque" valor={`${tok(pessoa.disponivelOlefoot)} OLEFOOT`} destaque />
            </div>
            <div className="grid gap-3 text-[11px] text-white/60 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 p-3">
                <div className="mb-1 text-[9px] uppercase tracking-widest text-white/40">Posição na árvore</div>
                {pessoa.no ? (
                  <p>
                    nível {pessoa.no.nivel} · time {pessoa.no.lado} · patrocinador{' '}
                    {pessoa.no.patrocinador ? `@${pessoa.no.patrocinador}` : '—'} · perna padrão{' '}
                    {pessoa.no.perna_padrao ?? 'automática'} · desde {fmtData(pessoa.no.criado_em)}
                  </p>
                ) : <p>Fora da árvore.</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {pessoa.pernas.map((p) => (
                    <span key={`${p.lado}-${p.trilho}`} className="rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px]">
                      T{p.lado} {p.trilho}: {tok(p.volume)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 p-3">
                <div className="mb-1 text-[9px] uppercase tracking-widest text-white/40">Carteira · prêmios · satélites</div>
                <p className="break-all font-mono text-[10px] text-white/55">
                  {pessoa.carteira
                    ? `${pessoa.carteira.wallet_address} ${pessoa.carteira.verified ? '(verificada)' : '(NÃO verificada)'}`
                    : 'Sem carteira vinculada — não consegue pedir saque.'}
                </p>
                <p className="mt-1">
                  {pessoa.premios.length} prêmio(s) de carreira
                  {pessoa.premios.length > 0 ? ` (${pessoa.premios.map((p) => p.degrau).join(', ')})` : ''} ·{' '}
                  {pessoa.satelites.length} satélite(s) · {pessoa.claims.length} claim(s)
                </p>
              </div>
            </div>
            {pessoa.liquidacoes.length > 0 ? (
              <div className="max-h-[260px] overflow-auto rounded-lg border border-white/10">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-black/90">
                    <tr className="border-b border-white/10 text-[9px] uppercase text-white/45">
                      <th className="px-2 py-2">Ciclo</th>
                      <th className="px-2 py-2">Equiparado</th>
                      <th className="px-2 py-2">Bônus</th>
                      <th className="px-2 py-2">Cortado</th>
                      <th className="px-2 py-2">Retido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pessoa.liquidacoes.map((l) => (
                      <tr key={`${l.ciclo_id}`} className="border-b border-white/5">
                        <td className="whitespace-nowrap px-2 py-1.5 font-mono text-white/70">{fmtData(l.abre_em)}</td>
                        <td className="px-2 py-1.5 font-mono text-white/55">{tok(l.equiparado)} OLEXP</td>
                        <td className="px-2 py-1.5 font-mono text-emerald-200/90">{dolarCents(l.bonus_contabil)}</td>
                        <td className="px-2 py-1.5 font-mono text-amber-200/80">{dolarCents(l.cortado_teto)}</td>
                        <td className="px-2 py-1.5 text-white/55">{l.retido_inativo ? 'sim' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <ConfirmDialog
        open={confirmaFechar}
        onClose={() => (fechando ? null : setConfirmaFechar(false))}
        onConfirm={() => void fechar()}
        eyebrow="Expansão"
        title="Fechar as horas pendentes?"
        confirmLabel={fechando ? 'Fechando…' : 'Fechar'}
        confirmDisabled={fechando}
        accent="#eab308"
      >
        <p className="mt-3 text-sm text-white/75">
          Roda o mesmo fechamento do cron, hora a hora, até alcançar agora. Cada hora
          liquida equiparação e paga bônus — exige login recente (janela de 30 min).
        </p>
      </ConfirmDialog>
    </div>
  );
}

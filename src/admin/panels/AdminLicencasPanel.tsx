/**
 * Licenças da expansão — gerar lote, baixar os códigos, revogar.
 *
 * A licença ativa a conta no plano de equiparação sem compra: sem OLEFOOT, sem
 * OLEXP, sem receita. O código aparece UMA vez, logo depois de gerar — o banco
 * guarda só o hash. Por isso o lote recém-gerado tem Copiar e Baixar CSV, e a
 * lista de baixo mostra só os 4 finais.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Download, KeyRound, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  gerarLicencas,
  listarLicencas,
  revogarLicenca,
  type CodigoGerado,
  type LicencaAdmin,
  type SituacaoLicenca,
} from '@/admin/adminLicencasClient';

function fmtData(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 16) : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const COR: Record<SituacaoLicenca, string> = {
  livre: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  usada: 'border-sky-500/40 bg-sky-500/15 text-sky-200',
  revogada: 'border-rose-500/40 bg-rose-500/15 text-rose-200',
  expirada: 'border-white/15 bg-white/10 text-white/60',
};

function baixarCsv(lote: string, codigos: readonly CodigoGerado[]) {
  const linhas = ['lote,codigo', ...codigos.map((c) => `"${lote.replace(/"/g, '""')}",${c.codigo}`)];
  const url = URL.createObjectURL(new Blob([linhas.join('\n') + '\n'], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `licencas-${lote.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminLicencasPanel() {
  const [lista, setLista] = useState<LicencaAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [quantidade, setQuantidade] = useState('10');
  const [lote, setLote] = useState('');
  const [patrocinador, setPatrocinador] = useState('');
  const [validade, setValidade] = useState('');
  const [gerando, setGerando] = useState(false);
  const [gerados, setGerados] = useState<{ lote: string; codigos: CodigoGerado[] } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const [alvo, setAlvo] = useState<LicencaAdmin | null>(null);
  const [motivo, setMotivo] = useState('');
  const [revogando, setRevogando] = useState(false);
  const [filtro, setFiltro] = useState<SituacaoLicenca | 'todas'>('todas');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try { setLista(await listarLicencas()); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar licenças.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const contagem = useMemo(() => {
    const c: Record<SituacaoLicenca, number> = { livre: 0, usada: 0, revogada: 0, expirada: 0 };
    for (const l of lista) c[l.situacao]++;
    return c;
  }, [lista]);
  const visiveis = useMemo(() => (filtro === 'todas' ? lista : lista.filter((l) => l.situacao === filtro)), [lista, filtro]);

  const gerar = async () => {
    if (gerando) return;
    setErro(null);
    setGerando(true);
    try {
      const nomeLote = lote.trim();
      const codigos = await gerarLicencas({
        quantidade: Number(quantidade),
        lote: nomeLote,
        patrocinador: patrocinador.trim() || undefined,
        validadeDias: validade.trim() ? Number(validade) : null,
      });
      setGerados({ lote: nomeLote, codigos });
      setCopiado(false);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar.');
    } finally {
      setGerando(false);
    }
  };

  const copiar = async () => {
    if (!gerados) return;
    try {
      await navigator.clipboard.writeText(gerados.codigos.map((c) => c.codigo).join('\n'));
      setCopiado(true);
    } catch { /* sem clipboard: os códigos estão na tela */ }
  };

  const revogar = async () => {
    if (!alvo || revogando) return;
    setRevogando(true);
    try {
      await revogarLicenca(alvo.licenca_id, motivo);
      setAlvo(null);
      setMotivo('');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao revogar.');
    } finally {
      setRevogando(false);
    }
  };

  const campo = 'w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30';

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-white/45">
        Licença ativa a conta no plano de equiparação <strong className="text-white/80">sem compra</strong>:
        não gera OLEFOOT, OLEXP nem receita. A conta entra na árvore e passa a poder convidar.
      </p>

      {erro ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{erro}</p>
      ) : null}

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">Gerar lote</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-[10px] uppercase text-white/45">Lote</span>
            <input className={campo} value={lote} onChange={(e) => setLote(e.target.value)} placeholder="ex.: parceiros-outubro" maxLength={80} />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase text-white/45">Quantidade (1–500)</span>
            <input className={campo} value={quantidade} onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase text-white/45">Validade em dias</span>
            <input className={campo} value={validade} onChange={(e) => setValidade(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="sem validade" />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-[10px] uppercase text-white/45">Patrocinador (opcional)</span>
            <input className={campo} value={patrocinador} onChange={(e) => setPatrocinador(e.target.value)} placeholder="@username — em branco segue o cadastro, ou a ORIGEM" />
          </label>
          <div className="flex items-end sm:col-span-2">
            <button
              type="button"
              onClick={() => void gerar()}
              disabled={gerando || !lote.trim() || !quantidade}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-neon-yellow px-4 py-2 text-xs font-bold uppercase text-black hover:bg-yellow-300 disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" />
              {gerando ? 'Gerando…' : `Gerar ${quantidade || 0}`}
            </button>
          </div>
        </div>

        {gerados ? (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-amber-100">
                {gerados.codigos.length} códigos · lote {gerados.lote}. Aparecem só agora — o banco guarda só o hash.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => void copiar()}
                  className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-[10px] font-bold uppercase text-white hover:bg-white/10">
                  <Copy className="h-3.5 w-3.5" /> {copiado ? 'Copiado' : 'Copiar'}
                </button>
                <button type="button" onClick={() => baixarCsv(gerados.lote, gerados.codigos)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-[10px] font-bold uppercase text-white hover:bg-white/10">
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
              </div>
            </div>
            <div className="mt-3 grid max-h-[260px] gap-1 overflow-auto font-mono text-[12px] text-white sm:grid-cols-3">
              {gerados.codigos.map((c) => <span key={c.licencaId}>{c.codigo}</span>)}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(['todas', 'livre', 'usada', 'revogada', 'expirada'] as const).map((s) => (
              <button key={s} type="button" onClick={() => setFiltro(s)}
                className={cn('rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase',
                  filtro === s ? 'border-neon-yellow text-neon-yellow' : 'border-white/15 text-white/55 hover:text-white')}>
                {s}{s === 'todas' ? ` ${lista.length}` : ` ${contagem[s]}`}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void carregar()} disabled={carregando}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase text-white/70 hover:bg-white/10 disabled:opacity-50">
            <RotateCcw className={cn('h-3.5 w-3.5', carregando && 'animate-spin')} /> Atualizar
          </button>
        </div>
        <div className="max-h-[480px] overflow-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-black/90">
              <tr className="border-b border-white/10 text-[9px] uppercase text-white/45">
                <th className="px-2 py-2">Final</th>
                <th className="px-2 py-2">Lote</th>
                <th className="px-2 py-2">Patrocinador</th>
                <th className="px-2 py-2">Situação</th>
                <th className="px-2 py-2">Usada por</th>
                <th className="px-2 py-2">Criada</th>
                <th className="px-2 py-2">Validade</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => (
                <tr key={l.licenca_id} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-2 py-1.5 font-mono text-white/85">…{l.final}</td>
                  <td className="max-w-[140px] truncate px-2 py-1.5 text-white/70" title={l.lote}>{l.lote}</td>
                  <td className="px-2 py-1.5 text-white/55">{l.patrocinador ? `@${l.patrocinador}` : '—'}</td>
                  <td className="px-2 py-1.5">
                    <span className={cn('rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase', COR[l.situacao])}
                      title={l.motivo_revogacao ?? undefined}>
                      {l.situacao}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-white/70">
                    {l.usada_por ? `@${l.usada_por}` : '—'}
                    {l.usada_em ? <span className="block text-[10px] text-white/40">{fmtData(l.usada_em)}</span> : null}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-white/45">{fmtData(l.criada_em)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-white/45">{l.expira_em ? fmtData(l.expira_em) : 'sem'}</td>
                  <td className="px-2 py-1.5 text-right">
                    {l.situacao !== 'revogada' ? (
                      <button type="button" onClick={() => setAlvo(l)}
                        className="rounded-lg border border-rose-500/40 px-2.5 py-1 text-[10px] font-bold uppercase text-rose-200 hover:bg-rose-500/10">
                        Revogar
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!carregando && visiveis.length === 0 && <p className="p-8 text-center text-sm text-white/35">Nenhuma licença.</p>}
          {carregando && <p className="p-8 text-center text-sm text-white/35">Carregando…</p>}
        </div>
      </section>

      <ConfirmDialog
        open={alvo != null}
        onClose={() => (revogando ? null : setAlvo(null))}
        onConfirm={() => void revogar()}
        eyebrow="Licença"
        title={`Revogar …${alvo?.final ?? ''}?`}
        confirmLabel={revogando ? 'Revogando…' : 'Revogar'}
        confirmDisabled={revogando}
        accent="#fb7185"
      >
        {alvo ? (
          <div className="mt-3 space-y-2 text-sm text-white/75">
            <p>
              {alvo.usada_por
                ? <>@{alvo.usada_por} perde a ativação e para de poder convidar. A posição na árvore fica.</>
                : <>O código deixa de funcionar.</>}
            </p>
            <input className={campo} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional)" maxLength={200} />
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

/**
 * EXPANSÃO → Saques — a fila de claims do bônus de equiparação.
 *
 * pendente → aprovar/recusar → pagar. Nenhum claim se paga sozinho: PAGAR
 * exige colar a assinatura da transação on-chain que o admin fez na
 * tesouraria — é ela que deixa qualquer um conferir no explorer. As três
 * ações exigem login recente (janela de 30 min).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, HandCoins, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  aprovarClaim,
  lerClaims,
  pagarClaim,
  recusarClaim,
  type ClaimAdmin,
  type StatusClaim,
} from '@/admin/adminExpansaoClient';
import { fmtData, tok } from '@/admin/fmt';

const COR: Record<StatusClaim, string> = {
  pendente: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  aprovado: 'border-sky-500/40 bg-sky-500/15 text-sky-200',
  pago: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  recusado: 'border-rose-500/40 bg-rose-500/15 text-rose-200',
};

type Acao = { tipo: 'aprovar' | 'recusar' | 'pagar'; claim: ClaimAdmin };

export function AdminExpansaoClaimsPanel() {
  const [lista, setLista] = useState<ClaimAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<StatusClaim | 'todos'>('todos');

  const [acao, setAcao] = useState<Acao | null>(null);
  const [motivo, setMotivo] = useState('');
  const [tx, setTx] = useState('');
  const [agindo, setAgindo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try { setLista((await lerClaims()).claims); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao carregar a fila.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const contagem = useMemo(() => {
    const c: Record<StatusClaim, number> = { pendente: 0, aprovado: 0, pago: 0, recusado: 0 };
    for (const x of lista) c[x.status]++;
    return c;
  }, [lista]);
  const visiveis = useMemo(
    () => (filtro === 'todos' ? lista : lista.filter((x) => x.status === filtro)),
    [lista, filtro],
  );

  const executar = async () => {
    if (!acao || agindo) return;
    setAgindo(true);
    setErro(null);
    try {
      if (acao.tipo === 'aprovar') await aprovarClaim(acao.claim.claim_id);
      else if (acao.tipo === 'recusar') await recusarClaim(acao.claim.claim_id, motivo);
      else await pagarClaim(acao.claim.claim_id, tx);
      setAcao(null);
      setMotivo('');
      setTx('');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha na ação.');
    } finally {
      setAgindo(false);
    }
  };

  const campo = 'w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30';
  const txDe = (c: ClaimAdmin) => (c.achados && typeof c.achados['tx'] === 'string' ? (c.achados['tx'] as string) : null);
  const motivoDe = (c: ClaimAdmin) =>
    c.achados && typeof c.achados['motivo_recusa'] === 'string' ? (c.achados['motivo_recusa'] as string) : null;

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-white/45">
        O jogador pede pela carteira <strong className="text-white/80">verificada</strong> (PIN assina, quando existe)
        e saca tudo que está disponível. O <strong className="text-white/80">líquido</strong> é o que chega;
        o <strong className="text-white/80">bruto</strong> é o que a tesouraria debita (a taxa de 5% morde na transferência).
      </p>

      {erro ? <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{erro}</p> : null}

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(['todos', 'pendente', 'aprovado', 'pago', 'recusado'] as const).map((s) => (
              <button key={s} type="button" onClick={() => setFiltro(s)}
                className={cn('rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase',
                  filtro === s ? 'border-neon-yellow text-neon-yellow' : 'border-white/15 text-white/55 hover:text-white')}>
                {s}{s === 'todos' ? ` ${lista.length}` : ` ${contagem[s]}`}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void carregar()} disabled={carregando}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase text-white/70 hover:bg-white/10 disabled:opacity-50">
            <RotateCcw className={cn('h-3.5 w-3.5', carregando && 'animate-spin')} /> Atualizar
          </button>
        </div>

        <div className="max-h-[520px] overflow-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-black/90">
              <tr className="border-b border-white/10 text-[9px] uppercase text-white/45">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Quem</th>
                <th className="px-2 py-2">Líquido</th>
                <th className="px-2 py-2">Bruto</th>
                <th className="px-2 py-2">Carteira</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Pedido</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {visiveis.map((claim) => (
                <tr key={claim.claim_id} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-2 py-1.5 font-mono text-white/45">{claim.claim_id}</td>
                  <td className="px-2 py-1.5 text-white/85">{claim.username ? `@${claim.username}` : claim.user_id.slice(0, 8)}</td>
                  <td className="px-2 py-1.5 font-mono text-emerald-200/90">{tok(claim.olefoot_liquido)}</td>
                  <td className="px-2 py-1.5 font-mono text-white/55">{tok(claim.olefoot_bruto)}</td>
                  <td className="max-w-[140px] truncate px-2 py-1.5 font-mono text-[10px] text-white/50" title={claim.wallet}>
                    {claim.wallet}
                  </td>
                  <td className="px-2 py-1.5">
                    <span
                      className={cn('rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase', COR[claim.status])}
                      title={claim.status === 'pago' ? `tx: ${txDe(claim) ?? '—'}` : claim.status === 'recusado' ? (motivoDe(claim) ?? undefined) : undefined}
                    >
                      {claim.status}
                    </span>
                    {claim.pago_em ? <span className="block text-[10px] text-white/40">{fmtData(claim.pago_em)}</span> : null}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-white/45">{fmtData(claim.criado_em)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    {claim.status === 'pendente' ? (
                      <button type="button" onClick={() => setAcao({ tipo: 'aprovar', claim })}
                        className="mr-1 rounded-lg border border-sky-500/40 px-2.5 py-1 text-[10px] font-bold uppercase text-sky-200 hover:bg-sky-500/10">
                        Aprovar
                      </button>
                    ) : null}
                    {claim.status === 'aprovado' ? (
                      <button type="button" onClick={() => setAcao({ tipo: 'pagar', claim })}
                        className="mr-1 rounded-lg border border-emerald-500/40 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-200 hover:bg-emerald-500/10">
                        Pagar
                      </button>
                    ) : null}
                    {claim.status === 'pendente' || claim.status === 'aprovado' ? (
                      <button type="button" onClick={() => setAcao({ tipo: 'recusar', claim })}
                        className="rounded-lg border border-rose-500/40 px-2.5 py-1 text-[10px] font-bold uppercase text-rose-200 hover:bg-rose-500/10">
                        Recusar
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!carregando && visiveis.length === 0 ? <p className="p-8 text-center text-sm text-white/35">Nenhum claim.</p> : null}
          {carregando ? <p className="p-8 text-center text-sm text-white/35">Carregando…</p> : null}
        </div>
      </section>

      <ConfirmDialog
        open={acao != null}
        onClose={() => (agindo ? null : setAcao(null))}
        onConfirm={() => void executar()}
        eyebrow="Saque"
        title={
          acao?.tipo === 'aprovar'
            ? `Aprovar o claim #${acao.claim.claim_id}?`
            : acao?.tipo === 'pagar'
              ? `Marcar o claim #${acao?.claim.claim_id} como PAGO?`
              : `Recusar o claim #${acao?.claim.claim_id}?`
        }
        confirmLabel={agindo ? 'Executando…' : acao?.tipo === 'aprovar' ? 'Aprovar' : acao?.tipo === 'pagar' ? 'Pagar' : 'Recusar'}
        confirmDisabled={agindo || (acao?.tipo === 'pagar' && !tx.trim())}
        accent={acao?.tipo === 'recusar' ? '#fb7185' : acao?.tipo === 'pagar' ? '#34d399' : '#38bdf8'}
      >
        {acao ? (
          <div className="mt-3 space-y-2 text-sm text-white/75">
            <p className="flex items-center gap-2">
              {acao.tipo === 'aprovar' ? <Check className="h-4 w-4 text-sky-300" /> : acao.tipo === 'pagar' ? <HandCoins className="h-4 w-4 text-emerald-300" /> : <X className="h-4 w-4 text-rose-300" />}
              @{acao.claim.username ?? acao.claim.user_id.slice(0, 8)} · {tok(acao.claim.olefoot_liquido)} OLEFOOT líquido
              ({tok(acao.claim.olefoot_bruto)} bruto da tesouraria)
            </p>
            <p className="break-all font-mono text-[11px] text-white/50">{acao.claim.wallet}</p>
            {acao.tipo === 'pagar' ? (
              <>
                <p>
                  Primeiro envie o <strong>bruto</strong> na tesouraria; depois cole aqui a assinatura
                  da transação. Sem ela o banco recusa.
                </p>
                <input className={campo} value={tx} onChange={(e) => setTx(e.target.value)} placeholder="Assinatura da transação (obrigatória)" maxLength={200} />
              </>
            ) : null}
            {acao.tipo === 'recusar' ? (
              <>
                <p>Recusar devolve o valor ao saldo disponível do jogador na hora.</p>
                <input className={campo} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (fica escrito no claim)" maxLength={300} />
              </>
            ) : null}
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

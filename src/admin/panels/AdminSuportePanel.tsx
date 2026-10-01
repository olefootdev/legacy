/**
 * SISTEMA → Suporte — as duas ferramentas que o atendimento não tinha:
 * destravar o PIN da carteira (zera as tentativas; o PIN continua o mesmo) e
 * o relatório de vendas de card em BRO.
 *
 * Remover o PIN de alguém NÃO existe de propósito: é o golpe de engenharia
 * social que o PIN bloqueia. Quem esqueceu entra com a senha da conta e
 * define outro (regra da migration 20260930180000).
 */
import { useCallback, useEffect, useState } from 'react';
import { CreditCard, LockKeyhole, RotateCcw, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { destravarPin, lerCardSales, lerSuportePin, type CardSaleAdmin, type SuportePin } from '@/admin/adminExpansaoClient';
import { dolarCents, fmtData } from '@/admin/fmt';

/** Centavos de BRO → "1.234,56 BRO" (mesma escala de centavos do BRL). */
const bro = (cents: string) => {
  const v = BigInt(String(cents || '0').split('.')[0] || '0');
  return `${(v / 100n).toLocaleString('pt-BR')},${(v % 100n).toString().padStart(2, '0')}`;
};

export function AdminSuportePanel() {
  const [pin, setPin] = useState<SuportePin | null>(null);
  const [vendas, setVendas] = useState<CardSaleAdmin[]>([]);
  const [resumo, setResumo] = useState<{ nome: string; moeda: string; vendas: number; grossCents: string; ownerCents: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [alvo, setAlvo] = useState<{ username: string | null; userId: string } | null>(null);
  const [destravando, setDestravando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [p, c] = await Promise.all([lerSuportePin(), lerCardSales()]);
      setPin(p);
      setVendas(c.vendas);
      setResumo(c.resumo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const destravar = async () => {
    if (!alvo?.username || destravando) return;
    setDestravando(true);
    setErro(null);
    try {
      const r = await destravarPin(alvo.username);
      setAviso(`@${alvo.username} destravado — ${r.apagadas} tentativa(s) apagada(s). O PIN continua o mesmo.`);
      setAlvo(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao destravar.');
    } finally {
      setDestravando(false);
    }
  };

  return (
    <div className="space-y-6">
      {erro ? <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{erro}</p> : null}
      {aviso ? <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{aviso}</p> : null}

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
            <LockKeyhole className="h-4 w-4" /> PIN da carteira · {pin?.comPin.length ?? 0} conta(s) com PIN
          </h3>
          <button type="button" onClick={() => void carregar()} disabled={carregando}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase text-white/70 hover:bg-white/10 disabled:opacity-50">
            <RotateCcw className={cn('h-3.5 w-3.5', carregando && 'animate-spin')} /> Atualizar
          </button>
        </div>

        {(pin?.travados.length ?? 0) > 0 ? (
          <div className="mb-4 space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-rose-300/80">Travados agora (5 erros / 15 min)</div>
            {pin!.travados.map((t) => (
              <div key={t.userId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
                <span className="text-sm text-white/85">
                  {t.username ? `@${t.username}` : t.userId.slice(0, 8)}
                  <span className="ml-2 text-[11px] text-white/45">{t.erros} erro(s) · destrava sozinho {fmtData(t.destravaEm)}</span>
                </span>
                <button type="button" onClick={() => setAlvo({ username: t.username, userId: t.userId })} disabled={!t.username}
                  title={t.username ? undefined : 'Conta sem username — destrave pelo SQL'}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-[10px] font-bold uppercase text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-40">
                  <Unlock className="h-3.5 w-3.5" /> Destravar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-4 text-sm text-white/40">Ninguém travado agora.</p>
        )}

        {(pin?.comErroRecente.length ?? 0) > 0 ? (
          <p className="mb-4 text-[11px] text-amber-200/70">
            Errando mas ainda não travados:{' '}
            {pin!.comErroRecente.map((e) => `${e.username ? '@' + e.username : e.userId.slice(0, 8)} (${e.erros})`).join(' · ')}
          </p>
        ) : null}

        <div className="max-h-[220px] overflow-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-black/90">
              <tr className="border-b border-white/10 text-[9px] uppercase text-white/45">
                <th className="px-2 py-2">Conta com PIN</th>
                <th className="px-2 py-2">Criado</th>
                <th className="px-2 py-2">Trocado</th>
              </tr>
            </thead>
            <tbody>
              {(pin?.comPin ?? []).map((p, i) => (
                <tr key={`${p.username ?? i}`} className="border-b border-white/5">
                  <td className="px-2 py-1.5 text-white/85">{p.username ? `@${p.username}` : '—'}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-white/45">{fmtData(p.criadoEm)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-white/45">{p.trocadoEm ? fmtData(p.trocadoEm) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!carregando && (pin?.comPin.length ?? 0) === 0 ? <p className="p-6 text-center text-sm text-white/35">Ninguém criou PIN ainda.</p> : null}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
          <CreditCard className="h-4 w-4" /> Vendas de card · {vendas.length}
        </h3>

        {resumo.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {resumo.map((r) => (
              <div key={`${r.nome}-${r.moeda}`} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
                <div className="text-[10px] font-bold uppercase text-white/70">{r.nome}</div>
                <div className="font-mono text-[11px] text-white/55">
                  {r.vendas} venda(s) · {r.moeda === 'BRO' ? `${bro(r.grossCents)} BRO` : dolarCents(r.grossCents)}
                  <span className="text-white/35"> (atleta {r.moeda === 'BRO' ? bro(r.ownerCents) : dolarCents(r.ownerCents)})</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="max-h-[340px] overflow-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-black/90">
              <tr className="border-b border-white/10 text-[9px] uppercase text-white/45">
                <th className="px-2 py-2">Card</th>
                <th className="px-2 py-2">Comprador</th>
                <th className="px-2 py-2">Beneficiário</th>
                <th className="px-2 py-2">Bruto</th>
                <th className="px-2 py-2">Atleta</th>
                <th className="px-2 py-2">Meio</th>
                <th className="px-2 py-2">Quando</th>
              </tr>
            </thead>
            <tbody>
              {vendas.map((v) => (
                <tr key={v.id} className="border-b border-white/5">
                  <td className="px-2 py-1.5 text-white/85">{v.card}</td>
                  <td className="px-2 py-1.5 text-white/70">{v.comprador ? `@${v.comprador}` : '—'}</td>
                  <td className="px-2 py-1.5 text-white/55">{v.beneficiario ? `@${v.beneficiario}` : '—'}</td>
                  <td className="px-2 py-1.5 font-mono text-emerald-200/90">
                    {v.currency === 'BRO' ? `${bro(v.gross_cents)} BRO` : dolarCents(v.gross_cents)}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-white/55">
                    {v.currency === 'BRO' ? `${bro(v.owner_cents)} BRO` : dolarCents(v.owner_cents)}
                  </td>
                  <td className="px-2 py-1.5 text-white/45">{v.payment_method}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-white/45">{fmtData(v.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!carregando && vendas.length === 0 ? <p className="p-6 text-center text-sm text-white/35">Nenhuma venda registrada.</p> : null}
          {carregando ? <p className="p-6 text-center text-sm text-white/35">Carregando…</p> : null}
        </div>
      </section>

      <ConfirmDialog
        open={alvo != null}
        onClose={() => (destravando ? null : setAlvo(null))}
        onConfirm={() => void destravar()}
        eyebrow="PIN"
        title={`Destravar @${alvo?.username ?? ''}?`}
        confirmLabel={destravando ? 'Destravando…' : 'Destravar'}
        confirmDisabled={destravando}
        accent="#34d399"
      >
        <p className="mt-3 text-sm text-white/75">
          Zera as tentativas erradas — a pessoa volta a poder digitar o PIN na hora.
          O PIN <strong>continua o mesmo</strong>; confirme a identidade antes (exige login recente).
        </p>
      </ConfirmDialog>
    </div>
  );
}

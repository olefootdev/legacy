/**
 * EXPANSÃO → Rede — a árvore de qualquer conta (read-only), as contas-satélite
 * da Ativação 3× com o dono nomeado, e os prêmios de carreira pagos.
 * O admin não mexe em posição por aqui: ver primeiro, decidir depois.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GitBranch, RotateCcw, Satellite, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  lerArvoreAdmin,
  lerPremios,
  lerSatelites,
  type NoArvoreAdmin,
  type PremioAdmin,
  type SateliteAdmin,
} from '@/admin/adminExpansaoClient';
import { fmtData, tok } from '@/admin/fmt';

export function AdminExpansaoRedePanel() {
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [ate, setAte] = useState('6');
  const [raiz, setRaiz] = useState<string | null>(null);
  const [nos, setNos] = useState<NoArvoreAdmin[]>([]);
  const [buscando, setBuscando] = useState(false);

  const [satelites, setSatelites] = useState<SateliteAdmin[]>([]);
  const [premios, setPremios] = useState<PremioAdmin[]>([]);
  const [totalPremios, setTotalPremios] = useState('0');
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [s, p] = await Promise.all([lerSatelites(), lerPremios()]);
      setSatelites(s.satelites);
      setPremios(p.premios);
      setTotalPremios(p.totalOlefoot);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const buscar = async () => {
    if (buscando || !busca.trim()) return;
    setBuscando(true);
    setErro(null);
    try {
      const r = await lerArvoreAdmin(busca, Math.min(Math.max(Number(ate) || 6, 1), 12));
      setRaiz(r.raiz.username);
      setNos(r.nos);
    } catch (e) {
      setRaiz(null);
      setNos([]);
      setErro(e instanceof Error ? e.message : 'Falha na busca.');
    } finally {
      setBuscando(false);
    }
  };

  const porNivel = useMemo(() => {
    const mapa = new Map<number, NoArvoreAdmin[]>();
    for (const n of nos) {
      const lista = mapa.get(n.nivel) ?? [];
      lista.push(n);
      mapa.set(n.nivel, lista);
    }
    return [...mapa.entries()].sort((a, b) => a[0] - b[0]);
  }, [nos]);

  const campo = 'w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30';

  return (
    <div className="space-y-6">
      {erro ? <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{erro}</p> : null}

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
          <GitBranch className="h-4 w-4" /> Árvore (read-only)
        </h3>
        <div className="flex flex-wrap gap-2">
          <input className={cn(campo, 'max-w-xs')} value={busca} onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void buscar(); }} placeholder="@username da raiz" />
          <input className={cn(campo, 'w-24')} value={ate} onChange={(e) => setAte(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric" title="Níveis (1–12)" placeholder="níveis" />
          <button type="button" onClick={() => void buscar()} disabled={buscando || !busca.trim()}
            className="rounded-lg bg-neon-yellow px-4 py-2 text-xs font-bold uppercase text-black hover:bg-yellow-300 disabled:opacity-50">
            {buscando ? 'Abrindo…' : 'Abrir árvore'}
          </button>
        </div>

        {raiz ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-white/55">
              Raiz: <strong className="text-white">@{raiz}</strong> · {nos.length - 1 >= 0 ? nos.length - 1 : 0} conta(s) abaixo ·{' '}
              <span className="text-white/40">T1/T2 = perna relativa à raiz</span>
            </p>
            {porNivel.map(([nivel, lista]) => (
              <div key={nivel}>
                <div className="mb-1 text-[9px] uppercase tracking-widest text-white/35">
                  {nivel === 0 ? 'Raiz' : `Nível ${nivel} · ${lista.length}`}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {lista.map((n) => (
                    <span
                      key={n.userId}
                      title={`patrocinador: ${n.patrocinador ? '@' + n.patrocinador : '—'} · entrou ${fmtData(n.criadoEm)}`}
                      className={cn(
                        'rounded border px-2 py-1 font-mono text-[10.5px]',
                        n.perna === 1 ? 'border-sky-500/40 bg-sky-500/10 text-sky-100'
                          : n.perna === 2 ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                            : 'border-neon-yellow/50 bg-neon-yellow/10 text-neon-yellow',
                      )}
                    >
                      {n.perna ? `T${n.perna} ` : ''}
                      {n.username ? `@${n.username}` : n.userId.slice(0, 8)}
                      {n.satelliteDe ? <span className="ml-1 text-[9px] text-white/50">🛰 de @{n.satelliteDe}</span> : null}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
            <Satellite className="h-4 w-4" /> Satélites da Ativação 3× · {satelites.length}
          </h3>
          <button type="button" onClick={() => void carregar()} disabled={carregando}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase text-white/70 hover:bg-white/10 disabled:opacity-50">
            <RotateCcw className={cn('h-3.5 w-3.5', carregando && 'animate-spin')} /> Atualizar
          </button>
        </div>
        <div className="max-h-[300px] overflow-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-black/90">
              <tr className="border-b border-white/10 text-[9px] uppercase text-white/45">
                <th className="px-2 py-2">Satélite</th>
                <th className="px-2 py-2">Dono</th>
                <th className="px-2 py-2">Time</th>
                <th className="px-2 py-2">Ref</th>
                <th className="px-2 py-2">Criado</th>
              </tr>
            </thead>
            <tbody>
              {satelites.map((s) => (
                <tr key={s.user_id} className="border-b border-white/5">
                  <td className="px-2 py-1.5 text-white/85">{s.username ? `@${s.username}` : s.user_id.slice(0, 8)}</td>
                  <td className="px-2 py-1.5 text-white/70">{s.dono ? `@${s.dono}` : s.dono_id.slice(0, 8)}</td>
                  <td className="px-2 py-1.5 text-white/55">T{s.lado}</td>
                  <td className="max-w-[180px] truncate px-2 py-1.5 font-mono text-white/40" title={s.ref}>{s.ref}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-white/45">{fmtData(s.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!carregando && satelites.length === 0 ? <p className="p-6 text-center text-sm text-white/35">Nenhum satélite criado.</p> : null}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-neon-yellow/90">
          <Trophy className="h-4 w-4" /> Prêmios de carreira · {premios.length} · {tok(totalPremios)} OLEFOOT
        </h3>
        <div className="max-h-[300px] overflow-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-black/90">
              <tr className="border-b border-white/10 text-[9px] uppercase text-white/45">
                <th className="px-2 py-2">Quem</th>
                <th className="px-2 py-2">Degrau</th>
                <th className="px-2 py-2">Prêmio</th>
                <th className="px-2 py-2">Acumulado na graduação</th>
                <th className="px-2 py-2">Quando</th>
              </tr>
            </thead>
            <tbody>
              {premios.map((p) => (
                <tr key={`${p.user_id}-${p.degrau}`} className="border-b border-white/5">
                  <td className="px-2 py-1.5 text-white/85">{p.username ? `@${p.username}` : p.user_id.slice(0, 8)}</td>
                  <td className="px-2 py-1.5 font-bold text-neon-yellow/90">{p.degrau}</td>
                  <td className="px-2 py-1.5 font-mono text-emerald-200/90">{tok(p.olefoot)} OLEFOOT</td>
                  <td className="px-2 py-1.5 font-mono text-white/55">{tok(p.acumulado)} OLEXP</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-white/45">{fmtData(p.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!carregando && premios.length === 0 ? <p className="p-6 text-center text-sm text-white/35">Nenhum prêmio pago ainda.</p> : null}
        </div>
      </section>
    </div>
  );
}

/**
 * PROVAS DE DIVULGAÇÃO — a fila de prints do Instagram.
 *
 * POR QUE EXISTE: sem esta tela, conferir print seria abrir o SQL Editor ou
 * chamar a rota com curl. É o mesmo gargalo que a tela do OLE SCOUT resolveu
 * pra aprovação de talento — e ele aparece no mesmo dia em que o link circula.
 *
 * ── A IA VEM PRIMEIRO, O HUMANO DECIDE O RESTO ──────────────────────────────
 * "Analisar com IA" varre a fila: o que ela reconhece com confiança some daqui
 * (aprovado e creditado); o que ela não tem certeza FICA, com o veredito escrito
 * ao lado. Ela nunca reprova ninguém — quem reprova é quem está lendo isto.
 *
 * A imagem é grande de propósito. Print de story em miniatura não se lê, e uma
 * tela de conferência onde não dá pra conferir não serve pra nada.
 */
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import {
  analisarProvas,
  fetchProvas,
  PROVA_LABEL,
  revisarProva,
  type ProvaDivulgacao,
} from '@/admin/revelaScoutClient';

export function AdminRevelaProvasPanel() {
  const [provas, setProvas] = useState<ProvaDivulgacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setProvas(await fetchProvas());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar a fila.');
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function rodarIa() {
    if (analisando) return;
    setAnalisando(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await analisarProvas();
      const aprovadas = r.resultado.filter((x) => x.acao === 'aprovada').length;
      const humanas = r.resultado.filter((x) => x.acao === 'fila_humana').length;
      setAviso(
        `${r.analisadas} analisadas · ${aprovadas} aprovadas e creditadas · ${humanas} pra você olhar`,
      );
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao analisar.');
    }
    setAnalisando(false);
  }

  async function decidir(prova: ProvaDivulgacao, status: 'approved' | 'rejected') {
    if (ocupada) return;
    setOcupada(prova.id);
    setErro(null);
    try {
      const r = await revisarProva({ id: prova.id, status });
      if (!r.ok) {
        setErro(r.reason ?? 'Não deu pra registrar.');
      } else {
        setAviso(
          status === 'approved'
            ? `${prova.atleta ?? 'Atleta'} recebeu ${r.oleko ?? 0} OLEKO.`
            : `Prova de ${prova.atleta ?? 'atleta'} recusada.`,
        );
        setProvas((p) => p.filter((x) => x.id !== prova.id));
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao registrar.');
    }
    setOcupada(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Barra de ação ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="ole-headline text-2xl">Provas de divulgação</h2>
          <p className="mt-1 text-sm text-white/50">
            {carregando
              ? 'Carregando…'
              : provas.length === 0
                ? 'Nada na fila.'
                : `${provas.length} ${provas.length === 1 ? 'print esperando' : 'prints esperando'}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void rodarIa()}
            disabled={analisando || provas.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-neon-yellow/60 bg-neon-yellow/10 px-4 py-2 text-sm font-semibold text-neon-yellow disabled:opacity-40"
          >
            {analisando ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Sparkles size={15} />
            )}
            Analisar com IA
          </button>
          <button
            type="button"
            onClick={() => void carregar()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/12 px-3 py-2 text-sm text-white/70"
          >
            <RefreshCw size={14} />
            Atualizar
          </button>
        </div>
      </div>

      {erro && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
          {erro}
        </p>
      )}
      {aviso && (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">
          {aviso}
        </p>
      )}

      {/* ── A fila ───────────────────────────────────────────────────────── */}
      {!carregando && provas.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[.03] px-5 py-10 text-center">
          <p className="text-sm text-white/55">
            Nenhum print aguardando. Quando um atleta mandar, ele aparece aqui — e a IA já
            aprova sozinha o que reconhece com clareza.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {provas.map((p) => (
            <article
              key={p.id}
              className="overflow-hidden rounded-xl border border-white/10 bg-white/[.03]"
            >
              <div className="flex items-baseline justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.atleta ?? 'Sem ficha'}</p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wider text-white/40">
                    {PROVA_LABEL[p.mission] ?? p.mission} · {p.semana}
                  </p>
                </div>
                {p.slug && (
                  <a
                    href={`https://revela.olefoot.com/t/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[11px] text-neon-yellow underline-offset-2 hover:underline"
                  >
                    perfil
                  </a>
                )}
              </div>

              {/* Grande de propósito — print de story em miniatura não se lê. */}
              <a href={p.imageUrl} target="_blank" rel="noreferrer" className="block">
                <img
                  src={p.imageUrl}
                  alt={`Print enviado por ${p.atleta ?? 'atleta'}`}
                  loading="lazy"
                  className="max-h-[420px] w-full bg-black/40 object-contain"
                />
              </a>

              {p.iaVeredito && (
                <p className="border-t border-white/8 px-4 py-2.5 text-[12.5px] text-white/60">
                  {p.iaVeredito}
                </p>
              )}

              <div className="flex gap-2 border-t border-white/8 px-4 py-3">
                <button
                  type="button"
                  onClick={() => void decidir(p, 'approved')}
                  disabled={ocupada === p.id}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500/90 px-3 py-2 text-sm font-semibold text-black disabled:opacity-40"
                >
                  {ocupada === p.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  Aprovar e creditar
                </button>
                <button
                  type="button"
                  onClick={() => void decidir(p, 'rejected')}
                  disabled={ocupada === p.id}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/60 disabled:opacity-40"
                >
                  <X size={14} />
                  Recusar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

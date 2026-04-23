/**
 * Entrada dedicada para testes no admin — URL estável (/admin/testes) enquanto o jogo evolui noutras frentes.
 * Não substitui /admin; apenas agrupa atalhos e o endereço completo para partilhar com o equipa.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Beaker, ClipboardCopy, ExternalLink, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const TEST_SHORTCUTS: { label: string; hash: string; hint: string }[] = [
  { label: 'Game Spirit', hash: 'game-spirit', hint: 'IA, decisões, diagnóstico' },
  { label: 'Create player', hash: 'create-player', hint: 'Geração / integração' },
  { label: 'Academy players', hash: 'academy-players', hint: 'Arte / prospects' },
  { label: 'Evolução', hash: 'evolution', hint: 'Progressão de jogadores' },
  { label: 'Dados do save', hash: 'save', hint: 'Hub local / persistência' },
  { label: 'Sessão local', hash: 'user', hint: 'Estado da sessão no browser' },
  { label: 'Usuários', hash: 'usuarios', hint: 'Contas na plataforma' },
  { label: 'Financeiro', hash: 'financeiro', hint: 'Agregados BRO' },
  { label: 'Ligas', hash: 'leagues', hint: 'Calendário / ligas' },
  { label: 'Banners', hash: 'banners', hint: 'Conteúdo promocional' },
  { label: 'Resumo', hash: 'overview', hint: 'KPIs gerais' },
  { label: 'Growth', hash: 'growth', hint: 'Métricas de crescimento e projeções' },
];

export function AdminTestesHub() {
  const baseAdminUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/admin';
    return `${window.location.origin}/admin`;
  }, []);

  const copyFullAdminUrl = async () => {
    try {
      await navigator.clipboard.writeText(baseAdminUrl);
    } catch {
      // Clipboard pode falhar em contextos não seguros; ignorar silenciosamente.
    }
  };

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10 md:px-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neon-yellow/15">
              <Beaker className="h-7 w-7 text-neon-yellow" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/35">
                <Shield className="h-3.5 w-3.5 text-neon-yellow/80" />
                Olefoot admin
              </div>
              <h1 className="font-display text-2xl font-black tracking-tight md:text-3xl">Área de testes</h1>
              <p className="mt-2 max-w-xl text-sm text-white/50">
                Usa esta rota para marcar e partilhar trabalho de QA no admin sem misturar com o fluxo normal do
                jogo. Cada atalho abre o painel completo já na aba certa.
              </p>
            </div>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10"
          >
            <ExternalLink className="h-4 w-4" />
            Painel completo
          </Link>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/40 p-4 md:p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">Link estável</div>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <code className="break-all rounded-lg bg-white/5 px-3 py-2 text-xs text-neon-yellow/90">
              {typeof window !== 'undefined' ? `${window.location.origin}/admin/testes` : '/admin/testes'}
            </code>
            <button
              type="button"
              onClick={copyFullAdminUrl}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10"
            >
              <ClipboardCopy className="h-4 w-4" />
              Copiar base /admin
            </button>
          </div>
          <p className="mt-2 text-[11px] text-white/35">
            “Copiar base” grava só o URL do painel principal (<span className="text-white/45">/admin</span>) para
            colares hashes manualmente se precisares.
          </p>
        </div>

        <h2 className="mt-10 text-xs font-bold uppercase tracking-widest text-white/40">Atalhos</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {TEST_SHORTCUTS.map((s) => (
            <li key={s.hash}>
              <Link
                to={`/admin#${s.hash}`}
                className={cn(
                  'flex flex-col rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors',
                  'hover:border-neon-yellow/35 hover:bg-white/[0.06]',
                )}
              >
                <span className="text-sm font-bold text-white">{s.label}</span>
                <span className="mt-0.5 text-[11px] text-white/40">{s.hint}</span>
                <code className="mt-2 text-[10px] text-neon-yellow/70">#{s.hash}</code>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-12">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-white/45 hover:text-white/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao jogo
          </Link>
        </div>
      </div>
    </div>
  );
}

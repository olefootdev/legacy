import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { normalizeWalletState } from '@/wallet/initial';
import { inviteLinkForCode } from '@/wallet/referralCode';
import {
  fetchMyReferralCode, fetchMyReferrals, getMyNetworkStatus, fetchClaimedMilestones, claimNetworkMilestone,
  type ReferredProfile, type NetworkStatus,
} from '@/supabase/referrals';
import { NETWORK_MILESTONES, isMilestoneReached, progressForMilestone } from '@/systems/network/milestones';
import { fetchMyAffiliateCommissions, claimMyAffiliateCommissions } from '@/wallet/affiliateCommissions';
import { applyPendingCredits } from '@/wallet/applyPendingCredits';
import { SecaoVolt, Hashtag, UmaLinha } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * A indicação do JOGO, dentro do NETWORK.
 *
 * É a árvore antiga (`profiles.referred_by_code`), que continua valendo: ela
 * paga 5% nas compras de card e os marcos em EXP — e desde 2026-09-29 é por ela
 * que quem compra um pack sem convite acha o patrocinador na expansão.
 *
 * 🔴 O que NÃO veio da tela antiga (`/wallet/referrals`), e por quê:
 *   · "Comissões Nv. 1/2/3" — somava só lançamento com destino 'self', que
 *     nenhum código produz. Era sempre zero.
 *   · "Comissões OLE Game" e "Comissões NFT" — lidas do livro LOCAL, onde a
 *     simulação gravava a comissão que a pessoa GEROU pro patrocinador. A tela
 *     mostrava em verde, com sinal de mais, como se ela tivesse recebido.
 *   · "Envios BRO por código" — dependia de um tipo de lançamento sem produtor.
 * Comissão de verdade mora em `affiliate_commissions`, no servidor — e é de lá
 * que o bloco "Comissão de card" lê. Número inventado não entra.
 *
 * Os MARCOS e a comissão de card vieram de `/manager/network` (Fase 4): são
 * dinheiro da rede do jogo e moram no NETWORK. Lá ficaram as amizades e a
 * carreira antiga.
 */

function quando(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch {
    return iso.slice(0, 10);
  }
}

export function IndicacaoDoJogo() {
  const carteiraLocal = useGameStore((s) => s.finance.wallet);
  const codigoLocal = useMemo(
    () => normalizeWalletState(carteiraLocal ?? undefined).myReferralCode ?? '',
    [carteiraLocal],
  );

  // O servidor manda. O código local é só o que aparece enquanto a resposta
  // não chega.
  const [codigoServidor, setCodigoServidor] = useState<string | null>(null);
  const [indicados, setIndicados] = useState<ReferredProfile[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [codigo, lista] = await Promise.all([fetchMyReferralCode(), fetchMyReferrals()]);
      if (!vivo) return;
      setCodigoServidor(codigo);
      setIndicados(lista);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, []);

  // ── marcos e comissão: servidor, sempre ──
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [resgatados, setResgatados] = useState<number[]>([]);
  const [comissaoPendente, setComissaoPendente] = useState(0);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const lerDinheiro = async () => {
    const [s, r, c] = await Promise.all([
      getMyNetworkStatus(), fetchClaimedMilestones(), fetchMyAffiliateCommissions(),
    ]);
    setStatus(s);
    setResgatados(r);
    setComissaoPendente(c.filter((x) => x.currency === 'BRO').reduce((s2, x) => s2 + x.totalPendingCents, 0));
  };
  useEffect(() => { void lerDinheiro(); }, []);

  const mostrar = (msg: string) => { setAviso(msg); setTimeout(() => setAviso(null), 4000); };

  const resgatarMarco = async (alvo: number) => {
    if (ocupado) return;
    setOcupado(`marco-${alvo}`);
    try {
      const r = await claimNetworkMilestone(alvo);
      if (r.ok === false) { mostrar(r.error); return; }
      // O servidor credita em `wallet_credits`; o resgate traz pro saldo.
      await applyPendingCredits();
      mostrar(`+${r.exp.toLocaleString('pt-BR')} EXP no seu saldo`);
    } finally {
      await lerDinheiro();
      setOcupado(null);
    }
  };

  const resgatarComissao = async () => {
    if (ocupado || comissaoPendente <= 0) return;
    setOcupado('comissao');
    try {
      const r = await claimMyAffiliateCommissions('BRO');
      const total = r.reduce((s2, x) => s2 + x.totalCents, 0);
      if (total > 0) {
        await applyPendingCredits();
        mostrar(`+${(total / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} BRO no seu saldo`);
      }
    } finally {
      await lerDinheiro();
      setOcupado(null);
    }
  };

  const codigo = codigoServidor ?? codigoLocal;
  const link = codigo ? inviteLinkForCode(codigo) : '';

  const copiar = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* sem clipboard: o link está na tela pra copiar à mão */ }
  };

  return (
    <section className="min-w-0 space-y-3">
      <SecaoVolt label="Indicação do jogo" tone="neutro">
        <Hashtag>#cadastro #marcos #comissao</Hashtag>
      </SecaoVolt>

      <div className="border border-white/10 bg-panel px-4 py-4">
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-poeira">Seu código</span>
          <span className="ole-num min-w-0 truncate text-[18px] tracking-wider text-white">{codigo || '—'}</span>
        </div>
        {link ? (
          <>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-giz" style={{ wordBreak: 'break-all' }}>
              {link}
            </p>
            <button
              type="button"
              onClick={() => void copiar()}
              className="mt-3 w-full border border-white/30 px-4 py-3 text-[13px] font-bold text-white transition-colors hover:border-white"
            >
              {copiado ? 'COPIADO' : 'COPIAR LINK DE CADASTRO'}
            </button>
          </>
        ) : null}
      </div>

      <div className="border border-white/10 bg-panel">
        <div className="flex items-baseline justify-between px-4 pb-2 pt-3.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-poeira">Seus indicados</span>
          <span className="ole-num text-[20px] leading-none text-white tabular-nums">
            {carregando ? '…' : indicados.length}
          </span>
        </div>
        {!carregando && indicados.length === 0 ? (
          <p className="px-4 pb-4 text-[12.5px] text-cimento">Ninguém entrou com o seu código ainda.</p>
        ) : null}
        {indicados.map((r) => (
          <div key={r.id} className="flex min-w-0 items-center justify-between gap-3 border-t border-white/10 px-4 py-2.5">
            <UmaLinha className="text-[13px] font-medium text-white">
              {r.displayName ?? r.clubName ?? 'Manager'}
            </UmaLinha>
            <span className="shrink-0 font-mono text-[10.5px] text-poeira">{quando(r.createdAt)}</span>
          </div>
        ))}
      </div>

      {/* ── marcos da rede: EXP por indicados ativos ── */}
      <div className="border border-white/10 bg-panel">
        <div className="flex items-baseline justify-between gap-3 px-4 pb-2 pt-3.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-poeira">Marcos da rede</span>
          <span className="font-mono text-[10px] text-cimento">
            {status ? `${status.qualifyingCount} qualificados` : '…'}
          </span>
        </div>
        {NETWORK_MILESTONES.map((m) => {
          const s = status ?? { directsActive: 0, qualifyingCount: 0 };
          const feito = resgatados.includes(m.target);
          const chegou = isMilestoneReached(m.target, s);
          const andou = Math.min(progressForMilestone(m.target, s), m.target);
          return (
            <div key={m.target} className="border-t border-white/10 px-4 py-3">
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <span className="shrink-0 font-mono text-[11.5px] text-giz tabular-nums">
                  {andou}/{m.target} {m.target === 1 ? 'indicado' : 'indicados'}
                </span>
                <span className="ole-num whitespace-nowrap text-[13px] text-white tabular-nums">
                  +{m.exp.toLocaleString('pt-BR')} EXP
                </span>
              </div>
              <div className="mt-2 h-1 w-full bg-sheet">
                <div className={cn('h-full', feito ? 'bg-white/25' : 'bg-neon-yellow')}
                     style={{ width: `${Math.round((andou / m.target) * 100)}%` }} />
              </div>
              {feito ? (
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-poeira">Resgatado</p>
              ) : chegou ? (
                <button
                  type="button"
                  onClick={() => void resgatarMarco(m.target)}
                  disabled={ocupado !== null}
                  className="mt-2.5 h-[44px] w-full bg-neon-yellow text-[12px] font-bold uppercase text-black transition-colors hover:bg-white disabled:opacity-50"
                >
                  {ocupado === `marco-${m.target}` ? 'Resgatando…' : `Resgatar +${m.exp.toLocaleString('pt-BR')} EXP`}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* ── comissão de card: 5% em três níveis, paga pelo servidor ── */}
      <div className="border border-white/10 bg-panel px-4 py-3.5">
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-poeira">Comissão de card</span>
          <span className="ole-num whitespace-nowrap text-[15px] text-white tabular-nums">
            {(comissaoPendente / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} BRO
          </span>
        </div>
        {comissaoPendente > 0 ? (
          <button
            type="button"
            onClick={() => void resgatarComissao()}
            disabled={ocupado !== null}
            className="mt-3 h-[44px] w-full border border-white/30 text-[12px] font-bold uppercase text-white transition-colors hover:border-white disabled:opacity-50"
          >
            {ocupado === 'comissao' ? 'Resgatando…' : 'Resgatar para o saldo'}
          </button>
        ) : (
          <p className="mt-1.5 text-[11.5px] text-cimento">Nada a resgatar agora.</p>
        )}
      </div>

      {aviso && <p className="font-mono text-[11.5px] text-alta">{aviso}</p>}

      {/* Amizades e a carreira antiga ficaram na tela do Manager. */}
      <Link
        to="/manager/network"
        className="flex h-[50px] items-center justify-between gap-3 border border-white/15 px-4 text-giz transition-colors hover:border-white/35"
      >
        <UmaLinha className="text-[13px] font-bold">AMIGOS E CARREIRA DO JOGO</UmaLinha>
        <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.2} />
      </Link>
    </section>
  );
}

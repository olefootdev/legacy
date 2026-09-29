import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { normalizeWalletState } from '@/wallet/initial';
import { inviteLinkForCode } from '@/wallet/referralCode';
import { fetchMyReferralCode, fetchMyReferrals, type ReferredProfile } from '@/supabase/referrals';
import { SecaoVolt, Hashtag, UmaLinha } from '@/components/ui';

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
 * Comissão de verdade mora em `affiliate_commissions`, no servidor, e entra
 * aqui quando o bloco passar a ler de lá. Número inventado não entra.
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
        <Hashtag>#cadastro #card5% #marcosEXP</Hashtag>
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

      {/* Marcos em EXP, carreira do jogo e amizades ainda moram na tela do
          Manager. Ficam a um toque daqui até migrarem. */}
      <Link
        to="/manager/network"
        className="flex h-[50px] items-center justify-between gap-3 border border-white/15 px-4 text-giz transition-colors hover:border-white/35"
      >
        <UmaLinha className="text-[13px] font-bold">MARCOS E CARREIRA DO JOGO</UmaLinha>
        <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2.2} />
      </Link>
    </section>
  );
}

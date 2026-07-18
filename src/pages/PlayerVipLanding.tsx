/**
 * PLAYERVIP LANDING — vitrine pública de uma lenda (link de convite viral).
 *
 * game.olefoot.com/playervip/<handle>
 *   • Página ABERTA (sem login). Explica a lenda + mostra os cards.
 *   • NÃO vende aqui: manda pro jogo (/mercado/transfer) pra comprar.
 *   • Abrir o link guarda o código de indicação do dono → cadastro credita a rede.
 *
 * Isto NÃO é o link mágico (que loga como o dono e nunca se compartilha). Este é
 * público e reutilizável de propósito.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { fetchPlayerVipLanding, type LandingCard, type PlayerVipLandingData } from '@/supabase/playerVipLanding';
import { setPendingReferrerCode } from '@/wallet/referralCode';

const YELLOW = '#FDE100';

/** Espelha os pesos de overallFromAttributes (player.ts) pra bater com o jogo. */
const OVR_W: Record<string, number> = {
  passe: 0.12, marcacao: 0.1, velocidade: 0.12, drible: 0.1, finalizacao: 0.12,
  fisico: 0.1, tatico: 0.12, mentalidade: 0.08, confianca: 0.08, fairPlay: 0.06,
};
function weightedOvr(attrs: Record<string, number> | null, fallback: number | null): number | null {
  if (!attrs) return fallback;
  let sum = 0;
  for (const [k, w] of Object.entries(OVR_W)) sum += (attrs[k] ?? 58) * w;
  return Math.round(Math.max(40, Math.min(99, sum)));
}

function priceLabel(card: LandingCard): string {
  if (card.currency === 'OLEFOOT') return `${card.priceCents.toLocaleString('pt-BR')} OLE`;
  const dollars = card.priceCents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

const PHASE_LABEL: Record<string, string> = {
  revelacao: 'Revelação',
  consolidacao: 'Consolidação',
  expansao: 'Expansão',
};

export function PlayerVipLanding() {
  const { handle = '' } = useParams<{ handle: string }>();
  const [data, setData] = useState<PlayerVipLandingData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    void fetchPlayerVipLanding(handle).then((d) => {
      if (cancelled) return;
      if (!d) { setState('notfound'); return; }
      setData(d);
      setState('ready');
      if (d.referralCode) setPendingReferrerCode(d.referralCode);
    });
    return () => { cancelled = true; };
  }, [handle]);

  const cadastroHref = useMemo(() => {
    const code = data?.referralCode?.trim();
    return code ? `/cadastro/${code}` : '/cadastro';
  }, [data?.referralCode]);

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b] text-white">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: YELLOW }} />
      </div>
    );
  }

  if (state === 'notfound' || !data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-[#0a0a0b] px-6 text-center text-white">
        <Brand />
        <h1 className="ole-headline-italic mt-4 text-3xl">Página não encontrada</h1>
        <p className="text-sm text-white/55">Esse link de lenda não existe ou foi removido.</p>
        <a href="https://game.olefoot.com" className="mt-2 text-xs font-bold uppercase tracking-wider" style={{ color: YELLOW }}>
          Ir para a OLEFOOT
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="mx-auto max-w-2xl px-6 pb-24 pt-8">
        <Brand />

        {/* Hero */}
        <header className="mt-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">Coleção oficial</p>
          <h1 className="ole-headline-italic mt-1 leading-[0.95]" style={{ fontSize: 'clamp(38px,11vw,64px)' }}>
            {data.displayName}
          </h1>
          {data.headline && (
            <p className="mt-4 max-w-lg text-base leading-relaxed text-white/60">{data.headline}</p>
          )}
        </header>

        {/* Cards */}
        {data.cards.length > 0 && (
          <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {data.cards.map((c) => {
              const ovr = weightedOvr(c.attributes, c.mintOverall);
              return (
                <article key={c.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#131315]">
                  <div className="relative aspect-[3/4] bg-[#0c0c0d]">
                    {c.portrait ? (
                      <img
                        src={c.portrait}
                        alt={c.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover object-[50%_18%]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-white/20">sem foto</div>
                    )}
                    {ovr != null && (
                      <span
                        className="absolute left-2 top-2 rounded-md px-1.5 py-0.5 font-display text-sm font-black text-black"
                        style={{ background: YELLOW }}
                      >
                        {ovr}
                      </span>
                    )}
                    {c.phase && PHASE_LABEL[c.phase] && (
                      <span className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/80">
                        {PHASE_LABEL[c.phase]}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-display text-sm font-black leading-tight">{c.name}</p>
                    {c.club && <p className="mt-0.5 text-[11px] text-white/45">{c.club}</p>}
                    {c.narrativeTitle && (
                      <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-white/40">{c.narrativeTitle}</p>
                    )}
                    <p className="mt-2 font-display text-base font-black" style={{ color: YELLOW }}>
                      {priceLabel(c)}
                    </p>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {/* CTA */}
        <section className="mt-12 rounded-2xl border border-white/10 bg-[#131315] p-6 text-center">
          <h2 className="ole-headline-italic text-2xl">Coleção só no jogo</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/55">
            Estes cards são colecionáveis oficiais da OLEFOOT. Crie sua conta e garanta o seu no mercado do jogo.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              to={cadastroHref}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-4 font-display text-sm font-black uppercase tracking-wider text-black transition-transform hover:-translate-y-0.5"
              style={{ background: YELLOW }}
            >
              Criar conta e colecionar <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/mercado/transfer"
              className="flex w-full items-center justify-center rounded-xl border border-white/15 py-3.5 text-sm font-bold uppercase tracking-wider text-white/80 transition-colors hover:border-white/40"
            >
              Já jogo — ver no mercado
            </Link>
          </div>
        </section>

        <footer className="mt-10 text-center">
          <Link to="/playervip" className="text-[11px] font-bold uppercase tracking-wider text-white/35 hover:text-white/70">
            É você, {data.displayName}? Entrar no seu painel
          </Link>
        </footer>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-7 w-3 rounded-sm" style={{ background: YELLOW, boxShadow: '0 0 22px rgba(253,225,0,.45)' }} />
      <span className="font-display text-[15px] font-black uppercase tracking-wide">OLEFOOT</span>
      <span className="font-display text-[15px] font-black uppercase tracking-wide text-white/40">PLAYERVIP</span>
    </div>
  );
}

export default PlayerVipLanding;

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
import { keyAttrsForPosition } from '@/admin/legendAttrCalibration';

const YELLOW = '#FDE100';

/**
 * O OVR vem do `mint_overall` gravado no banco — mesma conta que o jogo faz,
 * ponderada POR POSIÇÃO (src/entities/ovrWeights.ts), sincronizada a cada
 * tokenização.
 *
 * Aqui existia uma cópia local dos pesos, com a fórmula única antiga e SEM
 * posição: a vitrine pública mostrava um OVR e o card no jogo mostrava outro.
 * Não volte a recalcular — o RPC não devolve a posição, e recalcular sem ela
 * reintroduz exatamente o bug.
 */
function cardOvr(card: LandingCard): number | null {
  return card.mintOverall;
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
              const ovr = cardOvr(c);
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
                    <AttrBars attrs={c.attributes} pos={c.pos} />
                    <p className="mt-3 font-display text-base font-black" style={{ color: YELLOW }}>
                      {priceLabel(c)}
                    </p>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <Progression cards={data.cards} />

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

        {/* Porta de serviço: discreta de propósito. A página é feita pra quem
            DESCOBRE a lenda; quem já é dono de card é minoria dos visitantes. */}
        <footer className="mt-10 flex flex-col items-center gap-2">
          <Link
            to="/playervip"
            className="rounded-xl border border-white/15 px-8 py-3 font-display text-sm font-black uppercase tracking-wider text-white/70 transition-colors hover:border-white/40 hover:text-white"
          >
            Entrar
          </Link>
          <p className="text-[11px] text-white/30">Apenas para jogadores e facilitadores</p>
        </footer>
      </div>
    </div>
  );
}

const ATTR_LABEL: Record<string, string> = {
  passe: 'Passe', marcacao: 'Marcação', velocidade: 'Velocidade', drible: 'Drible',
  finalizacao: 'Finalização', fisico: 'Físico', tatico: 'Tático',
  mentalidade: 'Mentalidade', confianca: 'Confiança', fairPlay: 'Fair play',
};

/**
 * Mostra só os atributos que DEFINEM o ofício da posição (ATA=gol, VOL=desarme,
 * MEI=assistência). Dez barras viram planilha numa página feita pra público
 * amplo; três contam a história do jogador em um relance.
 */
function AttrBars({ attrs, pos }: { attrs: Record<string, number> | null; pos: string | null }) {
  const keys = useMemo(() => keyAttrsForPosition(pos ?? ''), [pos]);
  if (!attrs || keys.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-1.5 border-t border-white/[0.07] pt-3">
      {keys.slice(0, 3).map((k) => (
        <div key={k} className="grid grid-cols-[62px_1fr_20px] items-center gap-2">
          <span className="text-[9.5px] uppercase tracking-wide text-white/40">{ATTR_LABEL[k] ?? k}</span>
          <span className="h-[5px] overflow-hidden rounded-full bg-white/[0.07]">
            <span className="block h-full rounded-full" style={{ width: `${attrs[k] ?? 0}%`, background: YELLOW }} />
          </span>
          <span className="text-right text-[10px] font-bold tabular-nums" style={{ color: YELLOW }}>{attrs[k] ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}

/** Linha do tempo: como o jogador evoluiu de uma fase pra outra. */
function Progression({ cards }: { cards: LandingCard[] }) {
  if (cards.length < 2) return null;
  return (
    <section className="mt-12">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">A trajetória</p>
      <ol className="mt-4 flex flex-col gap-0">
        {cards.map((c, i) => (
          <li key={c.id} className="relative flex gap-4 pb-6 last:pb-0">
            {i < cards.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-white/10" />}
            <span
              className="relative mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#0a0a0b]"
              style={{ background: YELLOW }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-display text-sm font-black">{c.name}</span>
                {c.mintOverall != null && (
                  <span className="text-[11px] font-bold tabular-nums" style={{ color: YELLOW }}>OVR {c.mintOverall}</span>
                )}
                <span className="text-[11px] text-white/35">
                  {c.yearStart}{c.yearEnd && c.yearEnd !== c.yearStart ? `–${c.yearEnd}` : ''}
                </span>
              </div>
              {c.club && <p className="mt-0.5 text-[12px] text-white/55">{c.club}</p>}
              {c.tagline && <p className="mt-1.5 text-[12px] italic leading-snug text-white/40">“{c.tagline}”</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img src="/brand/olefoot-yellow-01.svg" alt="Olefoot" className="w-auto shrink-0" style={{ height: 22 }} />
      <span className="font-display text-[15px] font-black uppercase tracking-wide text-white/40">PLAYERVIP</span>
    </div>
  );
}

export default PlayerVipLanding;

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
import { Hashtag } from '@/components/ui';

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
      <div className="flex min-h-screen items-center justify-center bg-deep-black text-white">
        <Loader2 className="h-6 w-6 animate-spin text-neon-yellow" />
      </div>
    );
  }

  if (state === 'notfound' || !data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-deep-black px-6 text-center text-white">
        <Brand />
        <h1 className="mt-4 font-impact text-[32px] uppercase leading-[1.05]">Página não encontrada</h1>
        <p className="text-sm text-cimento">Esse link de lenda não existe ou foi removido.</p>
        <a href="https://game.olefoot.com" className="mt-2 text-xs font-bold uppercase tracking-wider text-neon-yellow transition-colors hover:text-white">
          Ir para a OLEFOOT
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-deep-black text-white">
      <div className="mx-auto max-w-2xl px-6 pb-24 pt-8">
        <Brand />

        {/* Hero */}
        <header className="mt-10">
          <p className="ole-eyebrow-poster">Coleção oficial</p>
          <h1 className="mt-2 font-impact uppercase leading-[1.02] [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(40px,12vw,68px)' }}>
            {data.displayName}
          </h1>
          {data.headline && (
            <p className="mt-4 max-w-lg text-base leading-relaxed text-giz">{data.headline}</p>
          )}
        </header>

        {/* Cards */}
        {data.cards.length > 0 && (
          <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {data.cards.map((c) => {
              const ovr = cardOvr(c);
              return (
                <article key={c.id} className="overflow-hidden border border-white/10 bg-panel">
                  <div className="relative aspect-[3/4] overflow-hidden bg-deep-black">
                    {c.portrait ? (
                      <img
                        src={c.portrait}
                        alt={c.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="object-cover object-[50%_18%]"
                        // Inline de propósito: mobile-responsive.css tem `img { height: auto }`
                        // fora de camada, que vence o h-full do Tailwind.
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center font-mono text-[11px] text-poeira">sem foto</div>
                    )}
                    {ovr != null && (
                      <span className="ole-num absolute left-2 top-2 bg-neon-yellow px-1.5 py-0.5 text-sm text-black">
                        {ovr}
                      </span>
                    )}
                    {c.phase && PHASE_LABEL[c.phase] && (
                      <span className="absolute right-2 top-2 bg-deep-black px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-giz">
                        {PHASE_LABEL[c.phase]}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate font-impact text-[17px] uppercase leading-[1.1] text-white">{c.name}</p>
                    {c.club && <p className="mt-0.5 truncate text-[11px] text-cimento">{c.club}</p>}
                    {c.narrativeTitle && (
                      <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-poeira">{c.narrativeTitle}</p>
                    )}
                    <AttrBars attrs={c.attributes} pos={c.pos} />
                    <p className="ole-num mt-3 text-base text-white">
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
        <section className="mt-12 border border-white/10 bg-panel p-6 text-center">
          <h2 className="font-impact text-[28px] uppercase leading-[1.05]">Coleção só no jogo</h2>
          <Hashtag className="mt-2 text-center">#colecionável #mercado</Hashtag>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              to={cadastroHref}
              className="btn-primary flex h-14 w-full items-center justify-center gap-2"
            >
              Criar conta e colecionar <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/mercado/transfer"
              className="btn-secondary flex h-12 w-full items-center justify-center"
            >
              Já jogo — ver no mercado
            </Link>
          </div>
        </section>

        <footer className="mt-12 flex flex-col items-center gap-3">
          <Link
            to="/playervip"
            className="btn-secondary flex h-12 w-full max-w-sm items-center justify-center"
          >
            Entrar
          </Link>
          <p className="text-[12px] text-poeira">Apenas para jogadores e facilitadores</p>
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
          <span className="truncate font-mono text-[9.5px] uppercase tracking-wide text-cimento">{ATTR_LABEL[k] ?? k}</span>
          <span className="h-[5px] overflow-hidden bg-card-hi">
            <span className="block h-full bg-neon-yellow" style={{ width: `${attrs[k] ?? 0}%` }} />
          </span>
          <span className="ole-num text-right text-[10px] text-giz">{attrs[k] ?? '—'}</span>
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
      <p className="ole-eyebrow-poster">A trajetória</p>
      <ol className="mt-4 flex flex-col gap-0">
        {cards.map((c, i) => (
          <li key={c.id} className="relative flex gap-4 pb-6 last:pb-0">
            {i < cards.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-white/10" />}
            <span className="relative mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-deep-black bg-neon-yellow" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-impact text-[17px] uppercase leading-[1.1]">{c.name}</span>
                {c.mintOverall != null && (
                  <span className="ole-num text-[11px] text-neon-yellow">OVR {c.mintOverall}</span>
                )}
                <span className="font-mono text-[11px] text-poeira">
                  {c.yearStart}{c.yearEnd && c.yearEnd !== c.yearStart ? `–${c.yearEnd}` : ''}
                </span>
              </div>
              {c.club && <p className="mt-0.5 text-[12px] text-cimento">{c.club}</p>}
              {c.tagline && <p className="mt-1.5 text-[12px] leading-snug text-poeira">“{c.tagline}”</p>}
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
      <span className="font-impact text-[15px] uppercase tracking-wide text-cimento">PLAYERVIP</span>
    </div>
  );
}

export default PlayerVipLanding;

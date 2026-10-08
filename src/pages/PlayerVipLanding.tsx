/**
 * PLAYERVIP LANDING — vitrine pública de uma lenda (link de convite viral).
 *
 * game.olefoot.ai/playervip/<handle>
 *   • Página ABERTA (sem login). Explica a lenda + mostra os cards.
 *   • NÃO vende aqui: manda pro jogo (/mercado/transfer) pra comprar.
 *   • Abrir o link guarda o código de indicação do dono → cadastro credita a rede.
 *
 * Isto NÃO é o link mágico (que loga como o dono e nunca se compartilha). Este é
 * público e reutilizável de propósito.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { fetchPlayerVipLanding, type LandingCard, type PlayerVipLandingData } from '@/supabase/playerVipLanding';
import { setPendingReferrerCode } from '@/wallet/referralCode';
import { keyAttrsForPosition } from '@/admin/legendAttrCalibration';
import { BarraSegmentos, BotaoRua, DEGRAU_CLASSES, FitaRua, MarcaRua, type Degrau } from '@/components/ui/Rua';
import { degrauDeOvr } from '@/components/bolsa/Bolsa';
import { cn } from '@/lib/utils';
import { moedaDoJogo } from '@/wallet/constants';
import { L, LOCALE } from '@/i18n/L';

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
  if (card.currency === 'OLEFOOT') return `${card.priceCents.toLocaleString(LOCALE)} ${moedaDoJogo()}`;
  const dollars = card.priceCents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

const PHASE_LABEL: Record<string, string> = {
  revelacao: L('Revelação', 'Breakthrough'),
  consolidacao: L('Consolidação', 'Consolidation'),
  expansao: L('Expansão', 'Expansion'),
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
      <div className="flex min-h-screen items-center justify-center bg-asfalto-27 text-papel">
        <Loader2 className="h-6 w-6 animate-spin text-rua" />
      </div>
    );
  }

  if (state === 'notfound' || !data) {
    return (
      <div className="rua-grao flex min-h-screen w-full flex-col bg-asfalto-27 text-papel">
        <div className="mx-auto flex w-full max-w-md grow flex-col justify-center gap-5 px-6 py-10">
          <Brand />
          <div className="flex min-w-0 -rotate-1 flex-col gap-2 border-[3px] border-dashed border-asfalto-27 bg-cal p-6 text-asfalto-27">
            <h1 className="font-voz text-[clamp(38px,10vw,50px)] leading-[0.95]">{L('Muro vazio.', 'Empty wall.')}</h1>
            <p className="font-sans text-[15px] leading-snug">{L('Esse link de lenda não existe ou foi removido.', "This legend link doesn't exist or was removed.")}</p>
          </div>
          <a
            href="https://game.olefoot.ai"
            className="inline-flex min-h-[44px] items-center gap-2 self-start font-impact text-[18px] uppercase text-rua transition-colors hover:text-papel"
          >
            {L('Ir para a OLEFOOT', 'Go to OLEFOOT')} <span aria-hidden>→</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rua-grao min-h-screen w-full overflow-x-hidden bg-asfalto-27 text-papel">
      <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-12 px-4 pb-24 pt-6 sm:px-6">
        <Brand />

        {/* ── HERO: a lenda na voz ──────────────────────────────────────── */}
        <header className="flex min-w-0 flex-col gap-3">
          <span className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-ouro-27">— {L('Coleção oficial', 'Official collection')}</span>
          <h1 className="block min-w-0 font-voz leading-[0.9] text-papel [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(52px,15vw,96px)' }}>
            {data.displayName}
          </h1>
          {data.headline && (
            <p className="max-w-lg font-sans text-[16px] leading-relaxed text-suave">{data.headline}</p>
          )}
        </header>

        {/* ── MOMENTO RUA: fita + cartas coladas tortas ─────────────────── */}
        <FitaRua tags={['#playervip', '#respeitoéouro', '#persista']} className="-mx-4 py-2 sm:-mx-6" />

        {data.cards.length > 0 && (
          <section aria-label={L('Cartas da coleção', 'Collection cards')} className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-10 px-2 sm:grid-cols-3 sm:px-0">
            {data.cards.map((c, i) => (
              <CartaLenda key={c.id} card={c} torto={TORTO[i % TORTO.length]!} />
            ))}
          </section>
        )}

        <Progression cards={data.cards} />

        {/* ── CTA: o INGRESSO pro jogo ──────────────────────────────────── */}
        <section aria-label={L('Coleção só no jogo', 'Collection only in-game')} className="flex min-w-0 flex-col">
          <div className="relative flex min-w-0 flex-col gap-5 overflow-hidden bg-rua p-5 text-asfalto-27 sm:p-7">
            <span aria-hidden className="rua-alambrado absolute inset-x-0 top-0 h-32 [--alambrado:rgba(13,13,12,0.28)]" />
            <div className="relative flex min-w-0 items-center justify-between gap-3 font-prova text-[11.5px] font-bold uppercase tracking-[0.2em]">
              <span className="min-w-0 truncate">Olefoot · PlayerVip</span>
              <span className="shrink-0">{L('Entrada', 'Admission')}</span>
            </div>
            <h2 className="relative font-impact text-[clamp(40px,11vw,68px)] uppercase leading-[0.86]">
              {L('Coleção só', 'Collect it')}
              <br />
              {L('no jogo', 'in-game')}
            </h2>
            <p className="relative font-voz text-[clamp(22px,5.6vw,28px)] leading-[1.05]">{L('#colecionável #mercado', '#collectible #market')}</p>
            <div className="relative flex min-w-0 flex-col gap-3">
              <Link
                to={cadastroHref}
                className="inline-flex min-h-[56px] items-center justify-center gap-2 bg-asfalto-27 px-6 font-impact text-[21px] uppercase leading-none text-rua transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-asfalto-27"
              >
                {L('Criar conta e colecionar', 'Sign up and collect')} <span aria-hidden>→</span>
              </Link>
              <Link
                to="/mercado/transfer"
                className="inline-flex min-h-[52px] items-center justify-center border-2 border-asfalto-27 px-5 text-center font-impact text-[18px] uppercase leading-none transition-colors hover:bg-asfalto-27 hover:text-rua focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-asfalto-27"
              >
                {L('Já jogo — ver no mercado', 'Already playing — view in market')}
              </Link>
            </div>
          </div>
          <div aria-hidden className="relative h-3 shrink-0 bg-rua">
            <span className="rua-picote-h absolute inset-x-0 top-1/2 h-2 -translate-y-1/2" />
          </div>
          <div className="flex min-w-0 items-end justify-between gap-4 bg-concreto p-5">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-mudo">{L('Lenda', 'Legend')}</span>
              <span className="block min-w-0 truncate font-voz text-[28px] leading-none text-ouro-27">{data.displayName}</span>
            </div>
            <MarcaRua tipo="nove" className="h-16 bg-ouro-27" />
          </div>
        </section>

        <footer className="flex min-w-0 flex-col items-center gap-3 border-t-2 border-linha pt-8">
          <BotaoRua variante="contorno" to="/playervip" className="w-full max-w-sm">
            {L('Entrar', 'Sign in')}
          </BotaoRua>
          <p className="font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo">{L('Apenas para jogadores e facilitadores', 'Players and facilitators only')}</p>
        </footer>
      </div>
    </div>
  );
}

/** Inclinações de lambe colado — alternam pra não parecer grade. */
const TORTO = [-2.5, 2, -1.5];

/** Carta da lenda na ESCADA pelo OVR do banco; os dados de vitrine vêm embaixo, retos. */
function CartaLenda({ card: c, torto }: { card: LandingCard; torto: number }) {
  const ovr = cardOvr(c);
  const d: Degrau = ovr != null ? degrauDeOvr(ovr) : 'respeito';
  const destaque = d === 'respeito' ? 'text-ouro-27' : '';
  return (
    <article className="flex min-w-0 flex-col gap-4">
      <div
        className={cn(
          'mx-auto flex w-full max-w-[300px] flex-col gap-2.5 p-3 shadow-[6px_8px_0_rgba(0,0,0,0.55)] transition-transform duration-200 hover:!rotate-0',
          DEGRAU_CLASSES[d],
        )}
        style={{ transform: `rotate(${torto}deg)` }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <span
              className={cn(
                'font-impact text-[50px] leading-[0.85]',
                destaque,
                d === 'chao' && 'text-transparent [-webkit-text-stroke:1.5px_var(--color-asfalto-27)]',
              )}
            >
              {ovr ?? '—'}
            </span>
            {c.pos && <span className={cn('mt-1 font-impact text-[14px] uppercase leading-none', destaque)}>{c.pos}</span>}
          </div>
          <MarcaRua tipo="escudo" className={cn('h-8', d === 'respeito' ? 'bg-ouro-27' : 'bg-asfalto-27')} />
        </div>
        <div className={cn('relative aspect-[4/5] w-full overflow-hidden', d === 'respeito' ? 'bg-concreto' : 'bg-asfalto-27/10')}>
          {c.portrait ? (
            <img
              src={c.portrait}
              alt={c.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="absolute inset-0 object-cover"
              // Inline de propósito: mobile-responsive.css tem `img { height: auto }`
              // fora de camada, que vence o h-full do Tailwind.
              style={{ width: '100%', height: '100%', maxWidth: 'none', objectPosition: '50% 18%' }}
            />
          ) : (
            <MarcaRua tipo="escudo" className="absolute left-1/2 top-1/2 h-14 -translate-x-1/2 -translate-y-1/2 bg-current opacity-30" />
          )}
          {c.phase && PHASE_LABEL[c.phase] && (
            <span className="absolute left-0 top-2 bg-asfalto-27 px-2 py-0.5 font-prova text-[10.5px] font-bold uppercase tracking-[0.12em] text-papel">
              {PHASE_LABEL[c.phase]}
            </span>
          )}
        </div>
        <span className="block min-w-0 truncate font-voz text-[26px] leading-none">{c.name}</span>
        <div
          className={cn(
            'flex items-center justify-between gap-2 px-2 py-1.5',
            d === 'chao' && 'border-t-2 border-dashed border-asfalto-27 px-0',
            d === 'corre' && 'bg-asfalto-27 text-rua',
            d === 'respeito' && 'border-2 border-ouro-27 text-ouro-27',
            d === 'lenda' && 'bg-asfalto-27 text-ouro-27',
          )}
        >
          <span className="min-w-0 truncate font-prova text-[11px] font-bold uppercase tracking-[0.12em]">{c.club ?? 'Olefoot'}</span>
          <span className="shrink-0 font-impact text-[18px] leading-none tabular-nums">{priceLabel(c)}</span>
        </div>
      </div>

      {(c.narrativeTitle || c.attributes) && (
        <div className="flex min-w-0 flex-col gap-3 px-1">
          {c.narrativeTitle && <p className="line-clamp-2 font-sans text-[13px] leading-snug text-suave">{c.narrativeTitle}</p>}
          <AttrBars attrs={c.attributes} pos={c.pos} />
        </div>
      )}
    </article>
  );
}

const ATTR_LABEL: Record<string, string> = {
  passe: L('Passe', 'Passing'), marcacao: L('Marcação', 'Marking'), velocidade: L('Velocidade', 'Pace'), drible: L('Drible', 'Dribbling'),
  finalizacao: L('Finalização', 'Finishing'), fisico: L('Físico', 'Physical'), tatico: L('Tático', 'Tactical'),
  mentalidade: L('Mentalidade', 'Mentality'), confianca: L('Confiança', 'Confidence'), fairPlay: 'Fair play',
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
    <div className="flex min-w-0 flex-col gap-2">
      {keys.slice(0, 3).map((k) => (
        <div key={k} className="grid min-w-0 grid-cols-[78px_1fr_26px] items-center gap-2">
          <span className="truncate font-prova text-[10.5px] font-bold uppercase tracking-[0.1em] text-mudo">{ATTR_LABEL[k] ?? k}</span>
          <BarraSegmentos valor={attrs[k] ?? 0} max={100} className="h-2.5" />
          <span className="text-right font-impact text-[14px] leading-none tabular-nums text-papel">{attrs[k] ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}

/** Linha do tempo: como o jogador evoluiu de uma fase pra outra. */
function Progression({ cards }: { cards: LandingCard[] }) {
  if (cards.length < 2) return null;
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">— {L('A trajetória', 'The journey')}</span>
        <h2 className="font-impact text-[clamp(32px,9vw,48px)] uppercase leading-[0.9] text-papel">{L('Fase por fase', 'Phase by phase')}</h2>
      </div>
      <ol className="flex min-w-0 flex-col gap-1.5">
        {cards.map((c, i) => (
          <li key={c.id} className="flex min-w-0 items-start gap-4 bg-concreto p-4">
            <span className="w-10 shrink-0 font-spray text-[34px] font-black leading-[0.85] text-mudo">{String(i + 1).padStart(2, '0')}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-voz text-[24px] leading-none text-papel">{c.name}</span>
                {c.mintOverall != null && (
                  <span className={cn('font-impact text-[15px] leading-none', degrauDeOvr(c.mintOverall) === 'lenda' || degrauDeOvr(c.mintOverall) === 'respeito' ? 'text-ouro-27' : 'text-papel')}>
                    OVR {c.mintOverall}
                  </span>
                )}
                {c.yearStart != null && (
                  <span className="font-spray text-[20px] font-black leading-none text-suave">
                    {c.yearStart}{c.yearEnd && c.yearEnd !== c.yearStart ? `–${c.yearEnd}` : ''}
                  </span>
                )}
              </div>
              {c.club && <p className="font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-mudo">{c.club}</p>}
              {c.tagline && <p className="font-sans text-[13px] leading-snug text-suave">“{c.tagline}”</p>}
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
      <MarcaRua tipo="wordmark" label="Olefoot" className="h-[20px] bg-rua" />
      <span className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">PlayerVip</span>
    </div>
  );
}

export default PlayerVipLanding;

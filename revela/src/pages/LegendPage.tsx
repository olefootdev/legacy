/**
 * A LENDA — segunda camada do REVELA, no MESMO layout.
 *
 * POR QUE ELA EXISTE: o card de lenda mandava pra `game.olefoot.com/playervip/
 * <handle>`, que tem outra linguagem visual. A pessoa clicava e sentia que tinha
 * caído noutro site — e site que troca de cara no meio do caminho perde
 * credibilidade exatamente na hora em que pede confiança (comprar uma carta).
 *
 * O QUE MUDA E O QUE FICA: a estrutura do /playervip fica inteira — link por
 * handle, coleção, captura de indicação, CTA pro jogo. O que muda é só a casca:
 * preto, Playfair, sombra dura, trilho amarelo. Mesma gramática das LENDAS da
 * home, porque é a continuação daquela seção, não outro produto.
 *
 * DADOS: as cartas vêm de `revela_list_legends` (o mesmo RPC da home), agrupadas
 * pelo mesmo `groupByAthlete`. Assim a página funciona pra QUALQUER lenda do
 * catálogo, tenha ela vitrine no /playervip ou não — hoje o Gonçalves não tem, e
 * mesmo assim ganha página. Quando o handle existe, buscamos também o
 * `get_playervip_landing` pra herdar a headline e o código de indicação.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchPlayerVipLanding,
  type PlayerVipLandingData,
} from '@/supabase/playerVipLanding';
import { AttrBar, Eyebrow, Portrait, keyAttrs, ptBr } from '../components/primitives';
import { groupByAthlete, isLegend } from '../data/legends';
import { fetchLegends } from '../data/revelaApi';
import { GAME_URL, rememberReferral, signupUrl } from '../data/session';
import type { Legend } from '../data/types';

const PHASE_LABEL: Record<string, string> = {
  revelacao: 'Revelação',
  consolidacao: 'Consolidação',
  expansao: 'Expansão',
};

export function LegendPage({
  onNote,
}: {
  onNote: (title: string, body?: string, tone?: 'yellow' | 'green') => void;
}) {
  const { slug = '' } = useParams<{ slug: string }>();
  const [cards, setCards] = useState<Legend[] | null>(null);
  const [vip, setVip] = useState<PlayerVipLandingData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setCards(null);
    setVip(null);
    window.scrollTo({ top: 0, behavior: 'instant' });

    void fetchLegends(60).then((all) => {
      if (cancelled) return;
      const found = groupByAthlete(all.filter(isLegend)).get(slug.toLowerCase());
      if (!found || found.length === 0) {
        setState('notfound');
        return;
      }
      setCards(found);
      setState('ready');

      // Só busca a vitrine do /playervip quando ela existe. É de lá que vêm a
      // headline escrita à mão e o código que credita a rede de quem divulga.
      const handle = found[0].handle;
      if (handle) {
        void fetchPlayerVipLanding(handle).then((d) => {
          if (cancelled || !d) return;
          setVip(d);
          if (d.referralCode) rememberReferral(d.referralCode);
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const best = cards?.[0];

  const era = useMemo(() => {
    if (!cards || cards.length === 0) return null;
    const anos = cards.flatMap((c) => [c.yearStart, c.yearEnd]).filter((y): y is number => y != null);
    if (anos.length === 0) return null;
    const min = Math.min(...anos);
    const max = Math.max(...anos);
    return min === max ? String(min) : `${min}–${max}`;
  }, [cards]);

  if (state === 'loading') {
    return (
      <main className="grid min-h-[70vh] place-items-center">
        <p className="rev-label text-[11px]" style={{ color: 'rgba(237,235,228,.4)' }}>
          Carregando…
        </p>
      </main>
    );
  }

  if (state === 'notfound' || !best || !cards) {
    return (
      <main className="rev-section grid min-h-[70vh] place-items-center text-center">
        <div>
          <Eyebrow>Não encontramos</Eyebrow>
          <h1 className="rev-editorial mt-5" style={{ fontSize: 'clamp(30px,5vw,54px)' }}>
            Essa lenda não está no acervo
          </h1>
          <p className="mt-3 text-[14px]" style={{ color: 'rgba(237,235,228,.5)' }}>
            O link pode ter mudado, ou a coleção saiu do mercado.
          </p>
          <Link to="/#lendas" className="rev-btn rev-focus mt-7" data-variant="yellow" data-on="dark">
            Ver todas as lendas
          </Link>
        </div>
      </main>
    );
  }

  const displayName = vip?.displayName?.trim() || nomeDoAtleta(best.name);
  const shareUrl = `${window.location.origin}/lenda/${slug}`;

  async function share() {
    const texto = `${displayName} na @olefootgame — a carreira dele virou carta jogável.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${displayName} · Olefoot Revela`, text: texto, url: shareUrl });
        return;
      } catch {
        /* cancelou: cai no clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(`${texto} ${shareUrl}`);
      onNote('Link copiado!', 'Marca a gente no post.', 'green');
    } catch {
      onNote('Não deu pra copiar', 'Copia o endereço da barra mesmo.');
    }
  }

  return (
    <main>
      {/* ── Abertura editorial ───────────────────────────────────────────── */}
      <section className="rev-section" style={{ background: 'var(--color-rev-black)' }}>
        <div className="rev-container">
          <Link
            to="/#lendas"
            className="rev-label rev-focus text-[10px]"
            style={{ color: 'rgba(237,235,228,.45)' }}
          >
            ← Lendas
          </Link>

          <div className="mt-8 grid items-end gap-10 lg:grid-cols-[.85fr_1.15fr]">
            <div className="mx-auto w-full max-w-[340px] lg:mx-0">
              <div
                className="overflow-hidden"
                style={{ borderRadius: 'var(--radius-rev-card-lg)', border: '1px solid rgba(237,235,228,.14)' }}
              >
                <Portrait
                  src={best.portrait}
                  alt={displayName}
                  ratio="3 / 4"
                  focusX={best.focusX}
                  focusY={best.focusY}
                  grayscale
                  width={360}
                  priority
                />
              </div>
            </div>

            <div>
              <Eyebrow>Lenda Olefoot</Eyebrow>
              <h1
                className="rev-editorial mt-5"
                style={{ fontSize: 'clamp(40px,7vw,96px)', color: 'var(--color-rev-bone)' }}
              >
                {displayName}
              </h1>

              <p className="rev-label mt-4 text-[11px]" style={{ color: 'rgba(237,235,228,.45)' }}>
                {[era, best.club, best.pos].filter(Boolean).join(' · ')}
              </p>

              <span className="mt-6 block" style={{ width: 34, height: 3, background: 'var(--color-rev-yellow)' }} />

              <p className="mt-6 max-w-[52ch] text-[16px] leading-relaxed" style={{ color: 'rgba(237,235,228,.62)' }}>
                {vip?.headline || best.tagline || best.title}
              </p>

              <div className="mt-8 flex flex-wrap gap-8">
                <Numero valor={cards.length} rotulo={cards.length === 1 ? 'Carta no acervo' : 'Cartas no acervo'} />
                {best.overall != null && <Numero valor={best.overall} rotulo="Melhor OVR" />}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── A carreira, carta por carta ──────────────────────────────────── */}
      <section className="rev-section" style={{ background: 'var(--color-rev-resenha)' }}>
        <div className="rev-container">
          <Eyebrow>A carreira</Eyebrow>
          <h2
            className="rev-editorial mt-4"
            style={{ fontSize: 'clamp(28px,4.2vw,52px)', color: 'var(--color-rev-bone)' }}
          >
            {cards.length === 1 ? 'A carta' : `${cards.length} fases, ${cards.length} cartas`}
          </h2>
          <p className="mt-4 max-w-[54ch] text-[15px] leading-relaxed" style={{ color: 'rgba(237,235,228,.5)' }}>
            Cada fase carrega a ficha daquele momento da carreira — a mesma que ela leva pro
            campo dentro do game.
          </p>

          <div
            className="mt-10 grid gap-7"
            style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(276px,1fr))' }}
          >
            {cards.map((c) => (
              <CartaDaFase key={c.id} card={c} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Divulgação: a estrutura do playervip, com a cara do REVELA ───── */}
      <section className="rev-section" style={{ background: 'var(--color-rev-black)' }}>
        <div className="rev-container grid gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>Jogue com ele</Eyebrow>
            <h2
              className="rev-display mt-4"
              style={{ fontSize: 'clamp(30px,4.6vw,58px)', color: 'var(--color-rev-yellow)' }}
            >
              Leve {primeiroNome(displayName)} pro seu time
            </h2>
            <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed" style={{ color: 'rgba(237,235,228,.58)' }}>
              As cartas são disputadas no mercado do game. Quem não tem conta ainda cria de
              graça — leva menos de um minuto.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={`${GAME_URL}/mercado/transfer`} className="rev-btn rev-focus" data-variant="yellow" data-on="dark">
                Ver no mercado
              </a>
              <a href={signupUrl()} className="rev-btn rev-focus" data-variant="outline" data-on="dark">
                Criar minha conta
              </a>
            </div>
          </div>

          <div>
            <Eyebrow>Divulgue</Eyebrow>
            <h2
              className="rev-editorial mt-4"
              style={{ fontSize: 'clamp(24px,3.4vw,40px)', color: 'var(--color-rev-bone)' }}
            >
              Esse link é dele
            </h2>
            <p className="mt-3 max-w-[44ch] text-[15px] leading-relaxed" style={{ color: 'rgba(237,235,228,.55)' }}>
              Compartilhar essa página é o jeito mais direto de fazer a história dele chegar em
              mais gente.
            </p>

            <div
              className="mt-5 flex items-center gap-3 px-4 py-3"
              style={{ borderRadius: 10, background: 'var(--color-rev-surface)', border: '1px solid rgba(255,255,255,.08)' }}
            >
              <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: 'rgba(237,235,228,.6)', fontFamily: 'ui-monospace, monospace' }}>
                {shareUrl}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={share} className="rev-btn rev-focus" data-variant="yellow" data-on="dark">
                Compartilhar
              </button>
              <a
                href="https://instagram.com/olefootgame"
                target="_blank"
                rel="noreferrer noopener"
                className="rev-btn rev-focus"
                data-variant="outline"
                data-on="dark"
              >
                @olefootgame
              </a>
            </div>

            {vip?.referralCode && (
              <p className="mt-5 text-[12px] leading-snug" style={{ color: 'rgba(237,235,228,.38)' }}>
                Quem criar conta a partir deste link entra pela rede de {displayName}.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

/* ══ Peças ═════════════════════════════════════════════════════════════════ */

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div>
      <p className="rev-display text-[38px] leading-none tabular-nums" style={{ color: 'var(--color-rev-yellow)' }}>
        {ptBr(valor)}
      </p>
      <p className="rev-label mt-1.5 text-[10px]" style={{ color: 'rgba(237,235,228,.42)' }}>
        {rotulo}
      </p>
    </div>
  );
}

function CartaDaFase({ card }: { card: Legend }) {
  const attrs = keyAttrs(card.pos, card.attributes);
  const anos =
    card.yearStart && card.yearEnd && card.yearStart !== card.yearEnd
      ? `${card.yearStart}–${card.yearEnd}`
      : (card.yearStart ?? card.yearEnd ?? null);

  return (
    <article
      className="overflow-hidden"
      style={{
        borderRadius: 'var(--radius-rev-card-lg)',
        background: 'var(--color-rev-surface)',
        border: '1px solid rgba(237,235,228,.12)',
      }}
    >
      <div className="relative">
        <Portrait src={card.portrait} alt={card.name} ratio="3 / 4" focusX={card.focusX} focusY={card.focusY} grayscale width={300} />
        {card.overall != null && (
          <span
            className="absolute left-3 top-3 inline-flex items-baseline gap-1 rounded-lg px-2.5 py-1"
            style={{ background: 'rgba(13,13,13,.86)', color: 'var(--color-rev-yellow)', backdropFilter: 'blur(4px)' }}
          >
            <span style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic', fontWeight: 800, fontSize: 20, lineHeight: 1 }}>
              {card.overall}
            </span>
            <span className="rev-label text-[9px] opacity-70">OVR</span>
          </span>
        )}
        {card.phase && (
          <span
            className="rev-sticker absolute right-3 top-3"
            style={{ background: 'var(--color-rev-bone)', color: '#0D0D0D' }}
          >
            {PHASE_LABEL[card.phase] ?? card.phase}
          </span>
        )}
      </div>

      {/* Trilho amarelo: o mesmo marcador de identidade da home. */}
      <div className="rev-rail p-5">
        <p className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.42)' }}>
          {[anos, card.club].filter(Boolean).join(' · ')}
        </p>
        <p className="rev-editorial mt-2 text-[24px]" style={{ color: 'var(--color-rev-bone)' }}>
          {card.title ?? card.name}
        </p>
        {card.tagline && (
          <p className="mt-3 text-[14px] leading-relaxed" style={{ color: 'rgba(237,235,228,.55)' }}>
            {card.tagline}
          </p>
        )}

        {attrs.length > 0 && (
          <div className="mt-5 flex flex-col gap-2">
            {attrs.map((a) => (
              <AttrBar key={a.key} label={a.label} value={a.value} active tone="bone" />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

/* ══ Nome ══════════════════════════════════════════════════════════════════ */

/**
 * O catálogo guarda nome de CARTA ("Palhinha 93", "Adauto SLV") — o sufixo é a
 * fase. Numa página editorial dedicada ao atleta, esse sufixo lê como código de
 * produto. Aqui mostramos a pessoa; a fase aparece em cada carta, onde importa.
 */
function nomeDoAtleta(nomeDaCarta: string): string {
  return nomeDaCarta.trim().replace(/\s*\d{2,4}$/, '').replace(/\d+$/, '').replace(/\s+[A-Z]{2,4}$/, '').trim();
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/**
 * Topo do REVELA: nav, hero-pôster e marquee.
 *
 * O hero é a promessa da marca em uma tela: "DESCUBRA QUEM ESTÁ CHEGANDO".
 * A cena é a própria tese do produto — o beco, o grafite, o portal aberto pro
 * estádio. Por isso a foto ocupa a tela inteira e o texto vira amarelo em cima
 * dela, em vez do bloco amarelo chapado de antes.
 *
 * O card flutuante saiu daqui de propósito: sobre esta foto ele tapava o portal
 * (o único elemento que explica o produto sem legenda) e repetia, acima da
 * dobra, o mesmo talento que a seção Descoberta mostra logo abaixo.
 */
import { useState } from 'react';
import { ptBr, useCountUp } from '../components/primitives';
import { GAME_URL, signupUrl } from '../data/session';

// Âncoras com a barra na frente: a partir de /lenda/<slug> um '#lendas' puro
// não sairia do lugar. Com '/#lendas' o navegador volta pra home e desce.
const NAV_LINKS = [
  { href: '/#descobrir', label: 'Descobrir' },
  // Era '/#torcida'. A seção saiu; o item vira A Trajetória, que é onde a
  // disputa acontece agora.
  { href: '/#placar', label: 'Trajetória' },
  { href: '/#mural', label: 'Reveal Wall' },
  { href: '/#lendas', label: 'Lendas' },
  { href: '/#resenha', label: 'Resenha' },
];

/* ══ Nav ═══════════════════════════════════════════════════════════════════ */

export function Nav({
  session,
  onLogin,
  onLogout,
}: {
  session: { email: string | null } | null;
  onLogin: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(253,225,0,.94)',
        backdropFilter: 'blur(10px)',
        borderBottom: '2px solid #0D0D0D',
      }}
    >
      <div
        className="rev-container flex items-center justify-between gap-4"
        style={{ paddingInline: 'var(--rev-pad-x)', minHeight: 62 }}
      >
        <a
          href="/"
          className="rev-focus flex items-center gap-2.5"
          data-on="yellow"
          aria-label="Olefoot Revela — início"
        >
          {/* A marca oficial, mascarada: herda a cor do pai (preto sobre o
              amarelo). O rótulo REVELA continua tipográfico — é o nome do
              produto dentro da marca, não parte do logotipo.

              Em tela estreita o badge some: a barra tem 343px úteis, e
              logo+badge+CTA+menu somavam 334 — o CTA quebrava em duas linhas.
              Some o badge antes do CTA porque quem está no site já sabe onde
              está; o botão é a única coisa ali que leva alguém adiante. */}
          <span className="rev-logo" style={{ height: 20, color: '#0D0D0D' }} />
          <span
            className="rev-label hidden rounded px-2 py-1 text-[10px] min-[420px]:block"
            style={{ background: '#0D0D0D', color: 'var(--color-rev-yellow)' }}
          >
            Revela
          </span>
        </a>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rev-label rev-focus text-[12px]"
              data-on="yellow"
              style={{ color: 'rgba(13,13,13,.72)' }}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* ENTRAR / MEU PERFIL — sem `hidden sm:block`.
              Estava escondido no celular, que é justamente onde o atleta está:
              quem já mandou a ficha não tinha como voltar pra acompanhar. Logado,
              o botão deixa de ser só "sair" e vira o caminho pro painel — que é
              o que a pessoa quer quando volta ao site. */}
          {session ? (
            <>
              <a
                href="/meu-perfil"
                className="rev-label rev-focus text-[11px]"
                data-on="yellow"
                style={{ color: 'rgba(13,13,13,.75)' }}
              >
                Meu perfil
              </a>
              <button
                type="button"
                onClick={onLogout}
                className="rev-label rev-focus hidden text-[11px] sm:block"
                data-on="yellow"
                style={{ color: 'rgba(13,13,13,.45)' }}
              >
                Sair
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className="rev-label rev-focus text-[11px]"
              data-on="yellow"
              style={{ color: 'rgba(13,13,13,.6)' }}
            >
              Entrar
            </button>
          )}
          <a
            href="/comecar"
            className="rev-btn rev-focus whitespace-nowrap"
            style={{ minHeight: 40, padding: '0 14px' }}
          >
            Criar perfil
          </a>
          <button
            type="button"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rev-focus grid place-items-center lg:hidden"
            data-on="yellow"
            style={{ width: 40, height: 40, color: '#0D0D0D' }}
          >
            <span className="text-[20px] leading-none">{open ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>

      {open && (
        <nav
          className="flex flex-col lg:hidden"
          style={{ borderTop: '2px solid #0D0D0D', paddingInline: 'var(--rev-pad-x)' }}
        >
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rev-label rev-focus py-3.5 text-[12px]"
              data-on="yellow"
              style={{ color: '#0D0D0D', borderBottom: '1px solid rgba(13,13,13,.12)' }}
            >
              {l.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

/* ══ Hero ══════════════════════════════════════════════════════════════════ */

export interface HeroStat {
  value: number;
  label: string;
}

export function Hero({ stats }: { stats: HeroStat[] }) {
  return (
    <section id="topo" className="rev-hero-shot" style={{ background: '#0D0D0D' }}>
      {/* A foto. `srcSet` existe porque o arquivo grande tem 334 KB e o celular
          — que é onde o atleta está — não precisa de 1536px de largura. */}
      <img
        src="/revela/hero-portal-1536.jpg"
        srcSet="/revela/hero-portal-960.jpg 960w, /revela/hero-portal-1536.jpg 1536w"
        sizes="100vw"
        width={1536}
        height={1024}
        fetchPriority="high"
        decoding="async"
        alt="Jogador de costas num beco, diante de um portal de energia que abre para um estádio lotado. Na parede, o grafite REVELA."
        className="rev-hero-shot__img"
      />

      {/* Véu escuro. Sobe da base, onde o texto mora, e deixa o portal inteiro
          visível no meio da tela — é ele que conta a história sem legenda. */}
      <div className="rev-hero-shot__veil" aria-hidden="true" />

      <div className="rev-hero-shot__body rev-container">
        <span
          className="rev-label inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[10px]"
          style={{
            background: 'rgba(13,13,13,.72)',
            color: 'var(--color-rev-yellow)',
            border: '1px solid rgba(253,225,0,.34)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <span
            className="rev-anim-pulse inline-block rounded-full"
            style={{ width: 7, height: 7, background: 'var(--color-rev-yellow)' }}
          />
          A nova cena do futebol · ao vivo
        </span>

        <h1
          className="rev-hero-type mt-5"
          style={{ color: 'var(--color-rev-yellow)', textShadow: '0 3px 28px rgba(13,13,13,.72)' }}
        >
          Descubra
          <br />
          quem está
          <br />
          chegando.
        </h1>

        <p
          className="rev-label mt-5 max-w-[46ch] text-[13px] leading-[1.8]"
          style={{ color: 'rgba(237,235,228,.78)', letterSpacing: '.06em' }}
        >
          O portal onde talento vira card, lenda vira legado e você entra em campo com os dois.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <a href="#descobrir" className="rev-btn rev-focus" data-variant="yellow" data-on="dark">
            Explorar talentos
          </a>
          <a
            href="#como-funciona"
            className="rev-btn rev-focus"
            data-variant="outline"
            data-on="dark"
          >
            Como funciona
          </a>
        </div>

        {stats.length > 0 && (
          <div className="mt-9 flex flex-wrap gap-x-10 gap-y-6">
            {stats.map((s) => (
              <Stat key={s.label} value={s.value} label={s.label} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const shown = useCountUp(value, 1400);
  return (
    <div>
      <p
        className="rev-display text-[clamp(30px,5vw,42px)] leading-none tabular-nums"
        style={{ color: 'var(--color-rev-bone)' }}
      >
        {ptBr(shown)}
      </p>
      <p className="rev-label mt-1.5 text-[10px]" style={{ color: 'rgba(237,235,228,.5)' }}>
        {label}
      </p>
    </div>
  );
}

/* ══ Marquee ═══════════════════════════════════════════════════════════════ */

const MARQUEE_WORDS = ['Revelar', 'Descobrir', 'Apoiar', 'Acompanhar', 'Reconhecer'];

export function Marquee() {
  // Duplicado porque o keyframe translada -50%: a segunda cópia entra no lugar
  // exato da primeira e o loop não tem costura.
  const strip = [...MARQUEE_WORDS, ...MARQUEE_WORDS];
  return (
    <div
      className="relative overflow-hidden py-4"
      style={{ background: 'var(--color-rev-black)', borderBlock: '2px solid rgba(253,225,0,.2)' }}
      aria-hidden="true"
    >
      <div className="rev-anim-marq flex w-max gap-8 whitespace-nowrap">
        {strip.map((w, i) => (
          <span
            key={`${w}-${i}`}
            className="rev-display text-[26px]"
            style={{ color: 'var(--color-rev-yellow)' }}
          >
            {w} <span style={{ opacity: 0.4 }}>✱</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ══ CTA final + rodapé ════════════════════════════════════════════════════ */

export function GameCta() {
  return (
    <section
      className="rev-section relative overflow-hidden text-center"
      style={{ background: 'var(--color-rev-yellow)', color: '#0D0D0D' }}
    >
      <div className="rev-container relative z-10">
        <h2 className="rev-hero-type" style={{ fontSize: 'clamp(46px,10vw,150px)' }}>
          Entre em campo.
        </h2>
        <p className="rev-label mx-auto mt-5 max-w-[44ch] text-[12px]" style={{ color: 'rgba(13,13,13,.62)' }}>
          Monte o clube, escale o time, dispute ligas contra managers reais.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href={GAME_URL} className="rev-btn rev-focus">
            Jogar agora
          </a>
          <a href="/comecar" className="rev-btn rev-focus" data-variant="outline">
            Criar meu perfil
          </a>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="rev-section" style={{ background: 'var(--color-rev-black)' }}>
      <div className="rev-container flex flex-col items-center gap-5 text-center">
        <div className="flex items-center gap-2.5">
          {/* Mesma máscara, cor invertida pelo contexto — um ativo só. */}
          <span className="rev-logo" style={{ height: 24, color: 'var(--color-rev-bone)' }} />
          <span
            className="rev-label rounded px-2 py-1 text-[10px]"
            style={{ background: 'var(--color-rev-yellow)', color: '#0D0D0D' }}
          >
            Revela
          </span>
        </div>
        <p
          className="rev-editorial max-w-[36ch] text-[19px]"
          style={{ color: 'rgba(237,235,228,.5)' }}
        >
          “Todo craque foi, um dia, um nome que ninguém conhecia.”
        </p>
        <div className="flex flex-wrap justify-center gap-5">
          <a href="/como-funciona" className="rev-label rev-focus text-[11px]" style={{ color: 'rgba(237,235,228,.45)' }}>
            Como funciona
          </a>
          <a
            href="https://instagram.com/olefootgame"
            target="_blank"
            rel="noreferrer noopener"
            className="rev-label rev-focus text-[11px]"
            style={{ color: 'var(--color-rev-yellow)' }}
          >
            @olefootgame
          </a>
          <a href={GAME_URL} className="rev-label rev-focus text-[11px]" style={{ color: 'rgba(237,235,228,.45)' }}>
            game.olefoot.com
          </a>
        </div>
        <p className="text-[11px]" style={{ color: 'rgba(237,235,228,.28)' }}>
          © {new Date().getFullYear()} Olefoot · Desde 2018 no mercado
        </p>
      </div>
    </footer>
  );
}

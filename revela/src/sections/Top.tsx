/**
 * Topo do REVELA: nav, hero-pôster e marquee.
 *
 * O hero é a promessa da marca em uma tela: "DESCUBRA QUEM ESTÁ CHEGANDO".
 * O card flutuante à direita não é ilustração — é um talento REAL do banco. Se
 * ainda não houver nenhum aprovado, o card vira convite ("pode ser você"), que
 * é uma verdade melhor que um jogador inventado.
 */
import { useState } from 'react';
import { OvrBadge, Portrait, Sticker, ptBr, useCountUp } from '../components/primitives';
import { GAME_URL, signupUrl } from '../data/session';
import type { Talent } from '../data/types';

// Âncoras com a barra na frente: a partir de /lenda/<slug> um '#lendas' puro
// não sairia do lugar. Com '/#lendas' o navegador volta pra home e desce.
const NAV_LINKS = [
  { href: '/#descobrir', label: 'Descobrir' },
  { href: '/#torcida', label: 'Torcida' },
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
          {session ? (
            <button
              type="button"
              onClick={onLogout}
              className="rev-label rev-focus hidden text-[11px] sm:block"
              data-on="yellow"
              style={{ color: 'rgba(13,13,13,.6)' }}
            >
              Sair
            </button>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className="rev-label rev-focus hidden text-[11px] sm:block"
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

export function Hero({ featured, stats }: { featured: Talent | null; stats: HeroStat[] }) {

  return (
    <section
      id="topo"
      className="rev-section relative overflow-hidden"
      style={{ background: 'var(--color-rev-yellow)', color: '#0D0D0D' }}
    >
      <div className="rev-container relative z-10 grid items-center gap-12 lg:grid-cols-[1.15fr_.85fr]">
        {/* ── Coluna da promessa ─────────────────────────────────────────── */}
        <div>
          <span
            className="rev-label inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[10px]"
            style={{ background: '#0D0D0D', color: 'var(--color-rev-yellow)' }}
          >
            <span
              className="rev-anim-pulse inline-block rounded-full"
              style={{ width: 7, height: 7, background: 'var(--color-rev-yellow)' }}
            />
            A nova cena do futebol · ao vivo
          </span>

          <h1 className="rev-hero-type mt-6">
            Descubra
            <br />
            quem está
            <br />
            chegando.
          </h1>

          <p
            className="rev-label mt-6 max-w-[46ch] text-[13px] leading-[1.8]"
            style={{ color: 'rgba(13,13,13,.68)', letterSpacing: '.06em' }}
          >
            O portal onde talento vira card, lenda vira legado e você entra em campo com os dois.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#descobrir" className="rev-btn rev-focus">
              Explorar talentos
            </a>
            <a href="#como-funciona" className="rev-btn rev-focus" data-variant="outline">
              Como funciona
            </a>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-10 gap-y-6">
            {stats.map((s) => (
              <Stat key={s.label} value={s.value} label={s.label} />
            ))}
          </div>
        </div>

        {/* ── Card flutuante ─────────────────────────────────────────────── */}
        <div className="relative mx-auto w-full max-w-[330px]">
          {featured ? <HeroCard talent={featured} /> : <HeroInvite />}
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const shown = useCountUp(value, 1400);
  return (
    <div>
      <p className="rev-display text-[42px] leading-none tabular-nums">{ptBr(shown)}</p>
      <p className="rev-label mt-1.5 text-[10px]" style={{ color: 'rgba(13,13,13,.55)' }}>
        {label}
      </p>
    </div>
  );
}

function HeroCard({ talent }: { talent: Talent }) {
  return (
    <article className="rev-anim-float rev-poster relative" style={{ borderRadius: 'var(--radius-rev-card-lg)' }}>
      <Portrait src={talent.portrait} alt={talent.name} ratio="4 / 5" width={360} priority />

      <div className="absolute left-3 top-3">
        <OvrBadge value={talent.overall} />
      </div>
      <div className="absolute right-3 top-3">
        <Sticker status={talent.carded ? 'card-ready' : 'rising'} rotate={4} />
      </div>

      {/* Placa de nome com trilho amarelo — a assinatura de identidade. */}
      <div
        className="rev-rail absolute inset-x-3 bottom-3 px-3.5 py-2.5"
        style={{ background: 'rgba(13,13,13,.9)', backdropFilter: 'blur(6px)', borderRadius: 6 }}
      >
        <p className="rev-display text-[22px] leading-none" style={{ color: 'var(--color-rev-bone)' }}>
          {talent.name}
        </p>
        <p className="rev-label mt-1 text-[10px]" style={{ color: 'rgba(237,235,228,.55)' }}>
          {[talent.pos, talent.club, talent.uf].filter(Boolean).join(' · ')}
        </p>
      </div>
    </article>
  );
}

/**
 * Sem talento aprovado ainda, o hero não finge. Ele convida — que é literalmente
 * a proposta do produto: o próximo nome pode ser o seu.
 */
function HeroInvite() {
  return (
    <article
      className="rev-anim-float rev-poster grid place-items-center px-7 text-center"
      style={{ aspectRatio: '4 / 5', borderRadius: 'var(--radius-rev-card-lg)' }}
    >
      <div>
        <span className="rev-label text-[10px]" style={{ color: 'var(--color-rev-yellow)' }}>
          Vaga aberta
        </span>
        <p className="rev-display mt-3 text-[38px] leading-[.9]" style={{ color: 'var(--color-rev-bone)' }}>
          O próximo
          <br />
          nome
          <br />
          pode ser
          <br />o seu.
        </p>
        <a href="/comecar" className="rev-btn rev-focus mt-6" data-variant="yellow">
          Criar meu perfil
        </a>
      </div>
    </article>
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

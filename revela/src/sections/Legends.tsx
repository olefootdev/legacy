/**
 * LENDAS e A RESENHA — o universo oposto ao dos talentos.
 *
 * Aqui a gramática muda de propósito: preto no lugar do amarelo, serifa
 * itálica no lugar do Anton gritado, foto em preto e branco, espaço generoso.
 * Talento é energia e futuro; lenda é silêncio e legado. Se as duas seções
 * parecessem iguais, a página perderia a única narrativa que ela tem.
 *
 * FONTE: `legacy_players` via RPC — o mesmo catálogo que vende card no jogo.
 * Nenhuma lenda é escrita à mão aqui.
 */
import { Link } from 'react-router-dom';
import { Eyebrow, Portrait } from '../components/primitives';
import { athleteName, type AthleteLegend } from '../data/legends';

export function Legends({ legends }: { legends: AthleteLegend[] }) {
  return (
    <section id="lendas" className="rev-section" style={{ background: 'var(--color-rev-black)' }}>
      <div className="rev-container">
        <header className="mx-auto max-w-[46ch] text-center">
          <Eyebrow>Legado</Eyebrow>
          <h2
            className="rev-editorial mt-5"
            style={{ fontSize: 'clamp(32px,5.4vw,68px)', color: 'var(--color-rev-bone)' }}
          >
            Lendas que fizeram a história
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed" style={{ color: 'rgba(237,235,228,.5)' }}>
            Nomes que o Brasil viu jogar, agora jogáveis. Cada carta carrega a ficha real
            do atleta — a mesma que ele leva pro campo dentro do game.
          </p>
        </header>

        {legends.length === 0 ? (
          <p
            className="mx-auto mt-12 max-w-[44ch] px-6 py-7 text-center text-[14px]"
            style={{
              color: 'rgba(237,235,228,.45)',
              border: '2px dashed rgba(237,235,228,.2)',
              borderRadius: 'var(--radius-rev-card)',
            }}
          >
            O catálogo de lendas ainda não tem carta publicada no mercado.
          </p>
        ) : (
          <div
            className="mt-14 grid gap-7"
            style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}
          >
            {legends.map((l) => (
              <LegendCard key={l.id} legend={l} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function LegendCard({ legend }: { legend: AthleteLegend }) {
  const era =
    legend.yearStart && legend.yearEnd
      ? `${legend.yearStart}–${legend.yearEnd}`
      : legend.yearStart
        ? `desde ${legend.yearStart}`
        : (legend.phase ?? '');

  // Rota INTERNA. Antes isto pulava pra game.olefoot.com/playervip/<handle>, que
  // tem outra linguagem visual — a pessoa clicava e sentia que tinha trocado de
  // site. Agora a vitrine da lenda é uma página daqui, e funciona pra todo mundo
  // do acervo, tenha handle no /playervip ou não.
  return (
    <Link
      to={`/lenda/${legend.slug}`}
      className="rev-focus group block overflow-hidden"
      style={{
        borderRadius: 'var(--radius-rev-card-lg)',
        border: '1px solid rgba(237,235,228,.12)',
        background: 'var(--color-rev-surface)',
        transition: 'transform var(--dur-rev-slow) var(--ease-rev), border-color var(--dur-rev-slow)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-8px)';
        e.currentTarget.style.borderColor = 'rgba(253,225,0,.32)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'rgba(237,235,228,.12)';
      }}
    >
      <Portrait
        src={legend.portrait}
        alt={legend.name}
        ratio="3 / 4"
        focusX={legend.focusX}
        focusY={legend.focusY}
        grayscale
        width={300}
      />

      <div className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rev-label inline-block rounded px-2 py-1 text-[9px]"
            style={{ border: '1px solid rgba(237,235,228,.3)', color: 'rgba(237,235,228,.6)' }}
          >
            Lenda{legend.overall != null ? ` · ${legend.overall} OVR` : ''}
          </span>
          {/* Carreira em vez de carta. O atleta tem mais fases no catálogo — em
              vez de escondê-las ou repetir o card, dizemos a amplitude. */}
          {legend.phases > 1 && (
            <span
              className="rev-label inline-block rounded px-2 py-1 text-[9px]"
              style={{ border: '1px solid rgba(253,225,0,.35)', color: 'var(--color-rev-yellow)' }}
            >
              {legend.phases} fases
              {legend.lowestOverall != null ? ` · ${legend.lowestOverall}–${legend.overall}` : ''}
            </span>
          )}
        </div>

        {era && (
          <p className="rev-label mt-4 text-[10px]" style={{ color: 'rgba(237,235,228,.42)' }}>
            {era}
            {legend.club ? ` · ${legend.club}` : ''}
          </p>
        )}

        <p
          className="rev-editorial mt-2"
          style={{ fontSize: 'clamp(26px,3vw,36px)', color: 'var(--color-rev-bone)' }}
        >
          {legend.name}
        </p>

        {/* O risco amarelo é o único ponto de marca nesta seção. Um só. */}
        <span className="mt-4 block" style={{ width: 28, height: 2, background: 'var(--color-rev-yellow)' }} />

        {(legend.tagline || legend.title) && (
          <p className="mt-4 text-[14px] leading-relaxed" style={{ color: 'rgba(237,235,228,.55)' }}>
            {legend.tagline ?? legend.title}
          </p>
        )}

        <p className="rev-label mt-5 text-[10px]" style={{ color: 'var(--color-rev-yellow)' }}>
          Ver a carreira →
        </p>
      </div>
    </Link>
  );
}

/* ══ A Resenha ═════════════════════════════════════════════════════════════ */

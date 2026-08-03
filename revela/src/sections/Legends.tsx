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

/**
 * ⚠️ NOTA DE FONTE — ler antes de mexer.
 * O handoff pede uma seção editorial de conteúdo ("capa da semana", matérias).
 * Esse CMS NÃO EXISTE no projeto. Em vez de inventar manchete, A Resenha aqui
 * conta as histórias que JÁ estão no banco: `narrative_title`, `tagline` e
 * `bio` das lendas, escritas pelo Legend Creator. É conteúdo real, só que
 * curado do catálogo em vez de uma redação.
 *
 * Quando existir um CMS, trocar a fonte aqui e manter o layout.
 *
 * ⚠️ O NOME DO ATLETA É OBRIGATÓRIO EM TODA LINHA.
 * Até 2026-08-03 esta seção mostrava `title ?? name` — ou seja, quando havia
 * título, o nome DESAPARECIA. Cinco manchetes anônimas embaixo de uma capa com
 * o rosto do Palhinha, e o leitor atribuía todas a ele: "O zagueiro do Brasil"
 * (Gonçalves) e "Capitão do primeiro título nacional do Athletico" (Nem Lima)
 * viravam biografia do Palhinha, que não é zagueiro nem jogou no Athletico.
 * Manchete sem assinatura não é resenha — é boato.
 */
export function Resenha({ legends }: { legends: AthleteLegend[] }) {
  const withStory = legends.filter((l) => l.title || l.bio || l.tagline);
  if (withStory.length === 0) return null;

  const [feature, ...rest] = withStory;
  const list = rest.slice(0, 4);

  return (
    <section id="resenha" className="rev-section" style={{ background: 'var(--color-rev-resenha)' }}>
      <div className="rev-container">
        <Eyebrow>A resenha</Eyebrow>
        <h2
          className="rev-editorial mt-4"
          style={{ fontSize: 'clamp(30px,4.8vw,58px)', color: 'var(--color-rev-bone)' }}
        >
          Histórias que viraram carta
        </h2>

        <div
          className="mt-10 grid gap-8"
          style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}
        >
          {/* Capa */}
          <article
            className="overflow-hidden"
            style={{ borderRadius: 'var(--radius-rev-card-lg)', background: 'rgba(0,0,0,.35)' }}
          >
            <div className="relative">
              <Portrait
                src={feature.portrait}
                alt={feature.name}
                ratio="16 / 10"
                focusX={feature.focusX}
                focusY={feature.focusY}
                width={560}
              />
              <span
                className="rev-label absolute left-4 top-4 rounded px-2.5 py-1.5 text-[9px]"
                style={{ background: 'var(--color-rev-yellow)', color: '#0D0D0D' }}
              >
                Capa da semana
              </span>
            </div>
            <div className="p-6">
              <p className="rev-label text-[10px]" style={{ color: 'var(--color-rev-yellow)' }}>
                {athleteName(feature)}
              </p>
              <p
                className="rev-editorial mt-2"
                style={{ fontSize: 'clamp(24px,2.8vw,34px)', color: 'var(--color-rev-bone)' }}
              >
                {feature.title ?? feature.name}
              </p>
              <p className="mt-3 text-[14px] leading-relaxed" style={{ color: 'rgba(237,235,228,.55)' }}>
                {feature.bio ?? feature.tagline}
              </p>
            </div>
          </article>

          {/* Lista */}
          <ol className="flex flex-col justify-center">
            {list.map((l, i) => (
              <li
                key={l.id}
                style={{
                  borderBottom: i < list.length - 1 ? '1px solid rgba(237,235,228,.1)' : undefined,
                  transition: 'transform var(--dur-rev-micro) var(--ease-rev)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateX(5px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateX(0)')}
              >
                {/* Vira link: se a linha diz de quem é a história, o passo
                    seguinte natural é abrir a história. */}
                <Link
                  to={`/lenda/${l.slug}`}
                  className="rev-focus flex items-start gap-5 py-5"
                  data-on="dark"
                  style={{ color: 'inherit' }}
                >
                  <span
                    className="rev-editorial shrink-0 text-[26px]"
                    style={{ color: 'rgba(253,225,0,.6)' }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0">
                    {/* O NOME primeiro — é ele que responde "de quem é isso?".
                        A raridade vem depois, apagada: é dado de catálogo, não
                        de identidade. */}
                    <p className="rev-label text-[9px]">
                      <span style={{ color: 'var(--color-rev-yellow)' }}>{athleteName(l)}</span>
                      {l.rarity && (
                        <span style={{ color: 'rgba(237,235,228,.35)' }}> · {l.rarity}</span>
                      )}
                    </p>
                    <p
                      className="rev-editorial mt-1 text-[21px]"
                      style={{ color: 'var(--color-rev-bone)' }}
                    >
                      {l.title ?? l.name}
                    </p>
                    {l.tagline && (
                      <p className="mt-1.5 text-[13px] leading-snug" style={{ color: 'rgba(237,235,228,.45)' }}>
                        {l.tagline}
                      </p>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

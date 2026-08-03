/**
 * O EMBAIXADOR — a seção que empresta credibilidade em dois segundos.
 *
 * POR QUE ELA EXISTE: quem chega por um link de WhatsApp precisa decidir, quase
 * instantaneamente, se isto é sério. Estatística e linha do tempo convencem
 * quem já parou pra ler; um rosto que a pessoa reconhece convence antes disso.
 *
 * ── A COPY DIZ O QUE É VERDADE, E SÓ ────────────────────────────────────────
 * A ideia original do fundador era "Jogue no time do Diego Lugano". Não dá:
 * conferi o catálogo e NÃO EXISTE card do Lugano — são 25 cartas de 11 atletas
 * (Palhinha, Gonçalves, Nem, Cocito, Johnson, Adauto, William, Breno, Nando,
 * Juca, Jiva). A frase mandaria o visitante procurar na vitrine um nome que não
 * está lá, e a primeira coisa que ele descobriria sobre a Olefoot é que a
 * chamada não bate.
 *
 * O que É verdade — e o deck sustenta — é que ele é EMBAIXADOR desde 2020. É
 * isso que a seção diz. No dia em que existir uma carta dele, a chamada do
 * fundador vira verdade e é UMA LINHA de texto pra trocar.
 *
 * ── A FOTO SANGRA, NÃO SE ENCAIXA ───────────────────────────────────────────
 * Primeira versão punha ele numa coluna de 520px, dentro do respiro da seção:
 * virou selo pequeno num mar amarelo. Recorte sem fundo pede o contrário — ele
 * ENCOSTA na base e sai pela borda, como quem está de pé atrás do texto.
 *
 * O arquivo também foi recortado no CORPO, não na moldura: o original é
 * 4000×2288 com o brilho ocupando as laterais, e o alfa sólido revelou que o
 * homem cabe em 2457×2231. Cortando ali, o mesmo espaço na tela mostra ele
 * quase três vezes maior. WebP com alfa: 128 KB contra 887 KB do PNG.
 */
import { Link } from 'react-router-dom';
import { Eyebrow } from '../components/primitives';
import { GAME_URL } from '../data/session';

export function Embaixador() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: 'var(--color-rev-yellow)',
        color: '#0D0D0D',
        // Sem padding embaixo: é ali que a foto encosta.
        padding: 'var(--rev-pad-y) var(--rev-pad-x) 0',
      }}
    >
      <div className="rev-container grid items-end gap-6 lg:grid-cols-[1fr_.95fr]">
        {/* ── A fala ──────────────────────────────────────────────────────── */}
        <div style={{ paddingBottom: 'var(--rev-pad-y)' }}>
          <Eyebrow on="yellow">Um embaixador respeitado</Eyebrow>
          <h2
            className="rev-display mt-4 max-w-[11ch]"
            style={{ fontSize: 'clamp(44px,8.4vw,104px)' }}
          >
            Diego Lugano está no time
          </h2>
          <p
            className="mt-6 max-w-[42ch] text-[clamp(16px,2.3vw,19px)] leading-relaxed"
            style={{ color: 'rgba(13,13,13,.76)' }}
          >
            Capitão da seleção uruguaia em duas Copas do Mundo e campeão pelo São Paulo.
            Embaixador da Olefoot <strong>desde 2020</strong> — quando o projeto ainda estava
            começando.
          </p>
          <p className="mt-4 max-w-[40ch] text-[15px]" style={{ color: 'rgba(13,13,13,.58)' }}>
            Gente desse tamanho não entra num projeto qualquer. Foi por isso que ele entrou cedo.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/como-funciona" className="rev-btn rev-focus">
              Conheça o projeto
            </Link>
            <a href={GAME_URL} className="rev-btn rev-focus" data-variant="outline">
              Entrar no jogo
            </a>
          </div>
        </div>

        {/* ── A foto ──────────────────────────────────────────────────────────
            `items-end` no grid + zero padding embaixo: ele nasce do chão da
            seção. No celular a coluna some e ele fica logo abaixo do texto,
            grande, ocupando a largura inteira. */}
        <div className="relative mx-auto w-full max-w-[640px] self-end lg:max-w-none">
          <img
            src="/revela/lugano-1000.webp"
            srcSet="/revela/lugano-640.webp 640w, /revela/lugano-1000.webp 1000w"
            sizes="(min-width: 1024px) 46vw, 92vw"
            width={1000}
            height={908}
            loading="lazy"
            decoding="async"
            alt="Diego Lugano com a camisa da Olefoot"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      </div>
    </section>
  );
}

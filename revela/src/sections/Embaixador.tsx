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
 * fundador vira verdade e é uma linha de texto pra trocar.
 */
import { Link } from 'react-router-dom';
import { Eyebrow } from '../components/primitives';
import { GAME_URL } from '../data/session';

export function Embaixador() {
  return (
    <section
      className="rev-section relative overflow-hidden"
      style={{ background: 'var(--color-rev-yellow)', color: '#0D0D0D' }}
    >
      <div className="rev-container grid items-center gap-8 lg:grid-cols-[1fr_.92fr]">
        {/* ── A fala ──────────────────────────────────────────────────────── */}
        <div>
          <Eyebrow on="yellow">Um embaixador respeitado</Eyebrow>
          <h2 className="rev-display mt-4 max-w-[13ch]" style={{ fontSize: 'clamp(36px,6.4vw,78px)' }}>
            Diego Lugano está no time
          </h2>
          <p
            className="mt-5 max-w-[46ch] text-[clamp(15px,2.2vw,18px)] leading-relaxed"
            style={{ color: 'rgba(13,13,13,.74)' }}
          >
            Capitão da seleção uruguaia em duas Copas do Mundo e campeão pelo São Paulo.
            Embaixador da Olefoot <strong>desde 2020</strong> — quando o projeto ainda estava
            começando.
          </p>
          <p className="mt-4 max-w-[42ch] text-[14.5px]" style={{ color: 'rgba(13,13,13,.58)' }}>
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
            PNG com alfa, recortado. Sobre o amarelo a camisa preta e o brasão
            fazem o contraste sozinhos — sem caixa, sem moldura, sem sombra:
            ele fica DENTRO da página em vez de colado nela.

            `object-position: top` porque o corte é panorâmico (1200×686) e o
            que importa é o rosto, que fica no terço de cima. */}
        <div className="relative mx-auto w-full max-w-[520px]">
          <img
            src="/revela/lugano-1200.png"
            srcSet="/revela/lugano-800.png 800w, /revela/lugano-1200.png 1200w"
            sizes="(min-width: 1024px) 520px, 92vw"
            width={1200}
            height={686}
            loading="lazy"
            decoding="async"
            alt="Diego Lugano com a camisa da Olefoot"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              // O PNG é um corte panorâmico que termina no peito. Sobre o
              // amarelo, essa borda reta lê como adesivo colado. A máscara
              // dissolve os últimos 18% e ele passa a sair de dentro da página.
              maskImage: 'linear-gradient(to bottom, #000 82%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, #000 82%, transparent 100%)',
            }}
          />
        </div>
      </div>
    </section>
  );
}

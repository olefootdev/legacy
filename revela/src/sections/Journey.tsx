/**
 * Como Funciona + Road to Card + criação de perfil.
 *
 * ESTA É A SEÇÃO QUE JUSTIFICA O REVELA EXISTIR. O problema declarado pelo
 * fundador: "um novo jogador não faz ideia de como criar um card". Antes, o
 * caminho existia mas estava escondido dentro do jogo e do /playervip. Aqui ele
 * é a espinha da página — sete passos nomeados, com o formulário do passo 1
 * logo abaixo, sem intermediário.
 */
import { Link } from 'react-router-dom';
import { Eyebrow } from '../components/primitives';

/* ══ Os 7 passos ═══════════════════════════════════════════════════════════ */

const STEPS = [
  { n: 1, label: 'Criação de perfil', hint: 'Nome, posição, onde joga. Dois minutos.' },
  { n: 2, label: 'Validação de conta', hint: 'Tua conta Olefoot confirma que é você.' },
  { n: 3, label: 'Revisão pelo OLE SCOUT', hint: 'A ficha de atributos é montada por quem entende.' },
  { n: 4, label: 'Divulgação na plataforma', hint: 'Teu perfil entra na vitrine pública.' },
  { n: 5, label: 'Criação do card digital', hint: 'Vira carta jogável dentro do game.' },
  { n: 6, label: 'Compartilhar com os amigos', hint: 'Teu link, tua torcida, tua rede.' },
  { n: 7, label: 'Bem-vindo ao time', hint: 'Você está dentro do universo Olefoot.' },
];

export function ComoFunciona() {
  return (
    <section
      id="como-funciona"
      className="rev-section relative overflow-hidden"
      style={{ background: 'var(--color-rev-black)' }}
    >
      <div className="rev-container relative z-10 grid gap-12 lg:grid-cols-[.9fr_1.1fr]">
        <div>
          <Eyebrow>O projeto Olefoot</Eyebrow>
          <h2
            className="rev-display mt-4"
            style={{ fontSize: 'clamp(34px,5.6vw,72px)', color: 'var(--color-rev-yellow)' }}
          >
            Como funciona
          </h2>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed" style={{ color: 'rgba(237,235,228,.62)' }}>
            A Olefoot existe com o objetivo de criar novas oportunidades no futebol usando
            tecnologias de ponta. Do nome que ninguém conhece até a carta que todo mundo quer.
          </p>

          <div className="mt-10">
            <p className="rev-display leading-none" style={{ fontSize: 'clamp(64px,9vw,120px)', color: 'var(--color-rev-yellow)' }}>
              2018
            </p>
            <p className="rev-label mt-2 text-[11px]" style={{ color: 'rgba(237,235,228,.45)' }}>
              Desde 2018 no mercado
            </p>
          </div>

          {/* O passo 1 é clicável de dentro da explicação — é aqui que a pessoa
              acabou de entender o caminho e decide entrar nele. */}
          <Link to="/comecar" className="rev-btn rev-focus mt-9" data-variant="yellow" data-on="dark">
            Começar pelo passo 1 →
          </Link>
        </div>

        <ol
          className="flex flex-col"
          style={{
            background: 'var(--color-rev-surface)',
            border: '2px solid rgba(253,225,0,.16)',
            borderRadius: 'var(--radius-rev-card-lg)',
            padding: 'clamp(18px,3vw,30px)',
          }}
        >
          {STEPS.map((s, i) => (
            <li
              key={s.n}
              className="flex items-start gap-4 py-4"
              style={{ borderBottom: i < STEPS.length - 1 ? '1px solid rgba(255,255,255,.07)' : undefined }}
            >
              <span
                className="rev-display grid shrink-0 place-items-center text-[16px]"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'var(--color-rev-yellow)',
                  color: '#0D0D0D',
                }}
              >
                {s.n}
              </span>
              <span className="min-w-0">
                <p className="rev-label text-[12px]" style={{ color: 'var(--color-rev-bone)' }}>
                  {s.label}
                </p>
                <p className="mt-1 text-[13px] leading-snug" style={{ color: 'rgba(237,235,228,.5)' }}>
                  {s.hint}
                </p>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

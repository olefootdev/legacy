/**
 * O PLACAR DA TRAJETÓRIA — a peça que transforma missão em disputa.
 *
 * Sem placar público a campanha é uma lista de tarefas: a pessoa cumpre, ganha
 * OLEKO e nada acontece no mundo. O placar é onde o esforço vira posição, e
 * posição é o que faz alguém voltar amanhã.
 *
 * ABAS POR CHAVE, e essa é a decisão que protege a campanha: uma lenda com 40
 * mil seguidores junta mil fãs numa tarde; um moleque de 14 anos de uma peneira
 * junta trinta em duas semanas. Num ranking só, o segundo se vê em último e
 * desiste — e ele é exatamente quem o REVELA existe pra atrair.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eyebrow, Portrait } from '../components/primitives';
import { fetchRankingTrajetoria } from '../data/revelaApi';
import {
  CHAVES,
  ORDEM_CHAVES,
  PERIODOS,
  ptBrNum,
  type LinhaRanking,
  type PeriodoId,
} from '../data/trajetoria';

export function Placar({ limite = 10, comTitulo = true }: { limite?: number; comTitulo?: boolean }) {
  const [chave, setChave] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoId>('all');
  const [linhas, setLinhas] = useState<LinhaRanking[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let morto = false;
    setCarregando(true);
    void fetchRankingTrajetoria(chave, limite, periodo).then((r) => {
      if (morto) return;
      setLinhas(r);
      setCarregando(false);
    });
    return () => {
      morto = true;
    };
  }, [chave, limite, periodo]);

  // Placar vazio não vira caixa vazia: some. Mas só some no estado INICIAL
  // (geral + sempre): depois que a pessoa filtrou, sumir a seção inteira
  // esconderia os próprios botões que ela acabou de usar.
  if (!carregando && linhas.length === 0 && chave === null && periodo === 'all') return null;

  return (
    <section
      id="placar"
      className="rev-section"
      style={{ background: 'var(--color-rev-black)', color: 'var(--color-rev-bone)' }}
    >
      <div className="rev-container">
        {comTitulo && (
          <>
            <Eyebrow>A Trajetória</Eyebrow>
            <h2 className="rev-display mt-4 max-w-[16ch]" style={{ fontSize: 'clamp(32px,5vw,64px)' }}>
              Quem está correndo mais
            </h2>
            <p className="mt-4 max-w-[52ch] text-[14.5px]" style={{ color: 'rgba(237,235,228,.6)' }}>
              Cada atleta acumula <strong style={{ color: 'var(--color-rev-yellow)' }}>OLEKO</strong>{' '}
              completando a ficha, chamando torcida e trazendo gente nova. Cada categoria disputa
              a sua — ninguém corre contra quem já chegou.
            </p>
          </>
        )}

        {/* ── Recorte de tempo ────────────────────────────────────────────
            Vem ANTES da categoria porque muda o significado da tabela inteira:
            "sempre" é acervo, o resto é movimento. */}
        <div className="mt-7 flex flex-wrap gap-2">
          {PERIODOS.map((p) => (
            <Aba key={p.id} ativa={periodo === p.id} onClick={() => setPeriodo(p.id)}>
              {p.label}
            </Aba>
          ))}
        </div>

        {/* ── Categoria ───────────────────────────────────────────────────── */}
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Aba ativa={chave === null} onClick={() => setChave(null)} discreta>
            Geral
          </Aba>
          {ORDEM_CHAVES.map((c) => (
            <Aba key={c} ativa={chave === c} onClick={() => setChave(c)} discreta>
              {CHAVES[c]}
            </Aba>
          ))}
        </div>

        {/* ── Tabela ──────────────────────────────────────────────────────── */}
        <div
          className="mt-6 overflow-hidden rounded-[14px]"
          style={{ background: 'rgba(237,235,228,.04)', border: '1px solid rgba(237,235,228,.1)' }}
        >
          {carregando ? (
            <p className="px-5 py-8 text-center text-[13px]" style={{ color: 'rgba(237,235,228,.4)' }}>
              Carregando…
            </p>
          ) : linhas.length === 0 ? (
            <p className="px-5 py-8 text-center text-[14px]" style={{ color: 'rgba(237,235,228,.5)' }}>
              {periodo === 'all'
                ? 'Ninguém pontuou nesta categoria ainda. A primeira posição está aberta.'
                : 'Ninguém se mexeu nesse período. Quem correr hoje aparece aqui amanhã.'}
            </p>
          ) : (
            linhas.map((l) => <Linha key={l.slug} l={l} periodo={periodo} />)
          )}
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link to="/comecar" className="rev-btn rev-focus" data-variant="yellow" data-on="dark">
            Entrar na disputa
          </Link>
          <span className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.4)' }}>
            É de graça · cada divisão libera EXP no game
          </span>
        </div>
      </div>
    </section>
  );
}

/**
 * Duas fileiras de aba com o mesmo peso brigariam entre si. A de tempo é a
 * principal (muda o significado da tabela); a de categoria é `discreta` — mesma
 * mecânica, menos tinta.
 */
function Aba({
  ativa,
  onClick,
  discreta = false,
  children,
}: {
  ativa: boolean;
  onClick: () => void;
  discreta?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      className="rev-label rev-focus text-[10px]"
      data-on="dark"
      style={{
        padding: discreta ? '7px 12px' : '9px 14px',
        borderRadius: 999,
        background: ativa ? (discreta ? 'rgba(253,225,0,.14)' : 'var(--color-rev-yellow)') : 'transparent',
        color: ativa
          ? discreta
            ? 'var(--color-rev-yellow)'
            : '#0d0d0d'
          : 'rgba(237,235,228,.55)',
        border: `1px solid ${
          ativa ? 'var(--color-rev-yellow)' : 'rgba(237,235,228,.15)'
        }`,
      }}
    >
      {children}
    </button>
  );
}

function Linha({ l, periodo }: { l: LinhaRanking; periodo: PeriodoId }) {
  // Pódio em amarelo cheio; o resto no tom da casa. Prestígio é grau de amarelo,
  // a mesma régua do catálogo do jogo.
  const podio = l.pos <= 3;

  return (
    <Link
      to={`/t/${l.slug}`}
      className="rev-focus grid items-center gap-3 border-t px-4 py-3"
      data-on="dark"
      style={{
        gridTemplateColumns: '30px 48px 1fr auto',
        borderColor: 'rgba(237,235,228,.08)',
        color: 'inherit',
      }}
    >
      <span
        className="rev-display text-[20px] leading-none tabular-nums"
        style={{ color: podio ? 'var(--color-rev-yellow)' : 'rgba(237,235,228,.35)' }}
      >
        {l.pos}
      </span>

      {/* Mini-card 3:4, não quadrado. Num 1:1 o retrato é reduzido a dois
          terços da altura e o rosto some — e quando o retrato é uma ARTE
          (como a do Breno), o quadrado vira um pôster ilegível de 44px. */}
      <span className="overflow-hidden rounded-[5px]" style={{ width: 48 }}>
        <Portrait src={l.portrait} alt={l.name} ratio="3 / 4" width={96} />
      </span>

      <span className="min-w-0">
        <span className="block text-[15px] leading-[1.2]">{l.name}</span>
        <span className="rev-label mt-1 block text-[9px]" style={{ color: 'rgba(237,235,228,.42)' }}>
          {l.divisao.nome}
          {periodo === 'all' ? (
            <> · {ptBrNum(l.fas)} {l.fas === 1 ? 'fã' : 'fãs'}</>
          ) : (l.fasJanela ?? 0) > 0 ? (
            <>
              {' · '}
              <span style={{ color: 'var(--color-rev-success, #22c55e)' }}>
                +{ptBrNum(l.fasJanela ?? 0)} {l.fasJanela === 1 ? 'fã' : 'fãs'}
              </span>
            </>
          ) : null}
        </span>
      </span>

      <span className="text-right">
        <span
          className="rev-display block text-[19px] leading-none tabular-nums"
          style={{ color: 'var(--color-rev-yellow)' }}
        >
          {ptBrNum(l.oleko)}
        </span>
        <span className="rev-label mt-1 block text-[8px]" style={{ color: 'rgba(237,235,228,.35)' }}>
          {periodo === 'all' ? 'OLEKO' : 'no período'}
        </span>
      </span>
    </Link>
  );
}

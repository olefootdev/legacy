/**
 * O TESTE DE DNA — /dna
 *
 * UMA PERGUNTA POR VEZ, e isso é o desenho inteiro. Treze situações numa página
 * só viram formulário, e formulário é exatamente o que o REVELA não quer ser: o
 * moleque desiste na terceira. Uma de cada vez, com a barra andando, cada toque
 * empurrando pra próxima — dura uns dois minutos e parece um joguinho.
 *
 * ── NENHUMA ALTERNATIVA É A CERTA ───────────────────────────────────────────
 * As quatro saídas de cada situação são todas respostas que um bom jogador
 * daria. A tela reforça isso ("não tem resposta certa") porque se ele achar que
 * está sendo avaliado, responde o que imagina que o adulto quer ouvir — e aí o
 * teste mede obediência, não preferência.
 *
 * ── DÁ PRA VOLTAR, NÃO DÁ PRA PULAR ─────────────────────────────────────────
 * Voltar é barato e tira a ansiedade de errar. Pular não existe: item sem
 * resposta é oportunidade perdida na conta do traço, e um traço com metade das
 * chances vira ruído. Se ele não quiser terminar, sai — o progresso parcial
 * simplesmente não é gravado.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eyebrow } from '../components/primitives';
import {
  ITENS_DNA,
  TRACO_POR_ID,
  pontuarDna,
  type RespostasDna,
  type ResultadoDna,
} from '../data/dna';
import { fetchMeuTalento, salvarDna, type MeuTalento } from '../data/revelaApi';

type Estado = 'carregando' | 'sem-conta' | 'sem-ficha' | 'teste' | 'resultado';

export function DnaTestPage({
  session,
  requireAuth,
  onNote,
}: {
  session: { userId: string } | null;
  requireAuth: (reason: string, aoEntrar?: () => void) => void;
  onNote: (title: string, body?: string, tone?: 'yellow' | 'green') => void;
}) {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>('carregando');
  const [talento, setTalento] = useState<MeuTalento | null>(null);
  const [respostas, setRespostas] = useState<RespostasDna>({});
  /**
   * Espelho síncrono das respostas. Toque duplo no celular dispara dois cliques
   * antes de qualquer re-render, e aí o segundo montaria o objeto em cima de um
   * `respostas` velho — perdendo a resposta anterior. O ref é escrito na hora,
   * não no próximo render.
   */
  const respostasRef = useRef<RespostasDna>({});
  const [i, setI] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoDna | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (!session) {
      setEstado('sem-conta');
      return;
    }
    let cancelado = false;
    void fetchMeuTalento().then((t) => {
      if (cancelado) return;
      if (!t) {
        setEstado('sem-ficha');
        return;
      }
      setTalento(t);
      // Já respondeu antes: abre no resultado, com o botão de refazer.
      if (t.dna?.respostas) {
        respostasRef.current = t.dna.respostas;
        setRespostas(t.dna.respostas);
        setResultado(pontuarDna(t.dna.respostas));
        setEstado('resultado');
      } else {
        setEstado('teste');
      }
    });
    return () => {
      cancelado = true;
    };
  }, [session]);

  const item = ITENS_DNA[i];
  const total = ITENS_DNA.length;
  const feitas = useMemo(
    () => ITENS_DNA.filter((it) => typeof respostas[it.id] === 'number').length,
    [respostas],
  );

  async function escolher(indice: number) {
    const novas = { ...respostasRef.current, [item.id]: indice };
    respostasRef.current = novas;
    setRespostas(novas);

    if (i < total - 1) {
      setI(i + 1);
      return;
    }

    // Último item: calcula e grava.
    const res = pontuarDna(novas);
    setResultado(res);
    setSalvando(true);
    const gravou = await salvarDna(novas, res);
    setSalvando(false);
    setEstado('resultado');
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (gravou.ok) {
      onNote('Teu DNA está no ar', `Você é ${res.arquetipo}.`, 'green');
    } else {
      onNote(
        'O resultado saiu, mas não salvou',
        'Ele aparece aqui agora; tenta refazer daqui a pouco pra gravar no perfil.',
      );
    }
  }

  /* ── Portas fechadas ─────────────────────────────────────────────────── */

  if (estado === 'carregando') {
    return (
      <main className="grid min-h-[70vh] place-items-center">
        <p className="rev-label text-[11px]" style={{ color: 'rgba(237,235,228,.4)' }}>
          Carregando…
        </p>
      </main>
    );
  }

  if (estado === 'sem-conta') {
    return (
      <Aviso
        titulo="Entra pra fazer o teste"
        texto="O resultado fica gravado no teu perfil — por isso precisa de conta."
        botao={{
          label: 'Entrar',
          onClick: () => requireAuth('Entra pra fazer o teste de DNA'),
        }}
      />
    );
  }

  if (estado === 'sem-ficha') {
    return (
      <Aviso
        titulo="Você ainda não tem ficha"
        texto="O DNA mora dentro do teu perfil de atleta. Cria o perfil primeiro — leva dois minutos."
        link={{ to: '/comecar', label: 'Criar meu perfil' }}
      />
    );
  }

  /* ── O resultado ─────────────────────────────────────────────────────── */

  if (estado === 'resultado' && resultado) {
    return (
      <main className="rev-section" style={{ background: 'var(--color-rev-black)' }}>
        <div className="rev-container max-w-[760px]">
          <Eyebrow>Player DNA</Eyebrow>
          <h1
            className="rev-display mt-5"
            style={{ fontSize: 'clamp(38px,7vw,84px)', lineHeight: 0.92, color: 'var(--color-rev-yellow)' }}
          >
            {resultado.arquetipo}
          </h1>
          <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed" style={{ color: 'rgba(237,235,228,.7)' }}>
            {resultado.frase}
          </p>

          <div className="mt-10 flex flex-col gap-3">
            {resultado.ordem.map((id) => {
              const t = TRACO_POR_ID.get(id)!;
              const v = resultado.tracos[id];
              return (
                <div key={id} className="grid grid-cols-[120px_1fr_34px] items-center gap-3.5">
                  <span className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.55)' }}>
                    {t.nome}
                  </span>
                  <span
                    className="h-[6px] overflow-hidden rounded-full"
                    style={{ background: 'rgba(237,235,228,.11)' }}
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${v}%`,
                        background: 'var(--color-rev-yellow)',
                        transition: 'width .9s var(--ease-rev)',
                      }}
                    />
                  </span>
                  <span
                    className="rev-display text-right text-[15px] tabular-nums"
                    style={{ color: 'var(--color-rev-bone)' }}
                  >
                    {v}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="mt-8 max-w-[52ch] text-[13px] leading-relaxed" style={{ color: 'rgba(237,235,228,.38)' }}>
            Não é nota de bom ou ruim — é preferência. Um Competidor não é melhor que um
            Estrategista; eles resolvem o mesmo lance de jeitos diferentes.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            {talento && (
              <Link to={`/t/${talento.slug}`} className="rev-btn rev-focus" data-variant="yellow" data-on="dark">
                Ver no meu perfil
              </Link>
            )}
            <button
              type="button"
              className="rev-btn rev-focus"
              data-variant="outline"
              data-on="dark"
              disabled={salvando}
              onClick={() => {
                respostasRef.current = {};
                setRespostas({});
                setResultado(null);
                setI(0);
                setEstado('teste');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
            >
              Refazer o teste
            </button>
            <button
              type="button"
              className="rev-btn rev-focus"
              data-variant="outline"
              data-on="dark"
              onClick={() => navigate('/meu-perfil')}
            >
              Voltar ao painel
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* ── O teste ─────────────────────────────────────────────────────────── */

  return (
    <main className="rev-section" style={{ background: 'var(--color-rev-black)' }}>
      <div className="rev-container max-w-[720px]">
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow>{item.bloco === 'jogo' ? 'Dentro do jogo' : 'Fora do jogo'}</Eyebrow>
          <span className="rev-label text-[10px] tabular-nums" style={{ color: 'rgba(237,235,228,.45)' }}>
            {i + 1} de {total}
          </span>
        </div>

        <div className="mt-3.5 h-[5px] overflow-hidden rounded-full" style={{ background: 'rgba(237,235,228,.11)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${(feitas / total) * 100}%`,
              background: 'var(--color-rev-yellow)',
              transition: 'width .4s var(--ease-rev)',
            }}
          />
        </div>

        <h1
          className="rev-display mt-10"
          style={{ fontSize: 'clamp(28px,4.6vw,46px)', lineHeight: 1.02, color: 'var(--color-rev-bone)' }}
        >
          {item.situacao}
        </h1>

        <div className="mt-8 flex flex-col gap-2.5">
          {item.alternativas.map((alt, indice) => {
            const marcada = respostas[item.id] === indice;
            return (
              <button
                key={alt.texto}
                type="button"
                onClick={() => void escolher(indice)}
                disabled={salvando}
                className="rev-focus w-full px-5 py-4 text-left text-[16px] leading-snug transition-colors"
                style={{
                  background: marcada ? 'rgba(253,225,0,.12)' : 'var(--color-rev-surface)',
                  border: marcada
                    ? '1px solid rgba(253,225,0,.55)'
                    : '1px solid rgba(237,235,228,.1)',
                  borderRadius: 'var(--radius-rev-card)',
                  color: marcada ? 'var(--color-rev-yellow)' : 'var(--color-rev-bone)',
                }}
              >
                {alt.texto}
              </button>
            );
          })}
        </div>

        <div className="mt-7 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setI(Math.max(0, i - 1))}
            disabled={i === 0}
            className="rev-label rev-focus text-[10px] disabled:opacity-30"
            style={{ color: 'rgba(237,235,228,.5)' }}
          >
            ← Voltar
          </button>
          <p className="text-right text-[13px]" style={{ color: 'rgba(237,235,228,.35)' }}>
            {salvando ? 'Salvando…' : 'Não tem resposta certa. Marca a que é a tua.'}
          </p>
        </div>
      </div>
    </main>
  );
}

function Aviso({
  titulo,
  texto,
  botao,
  link,
}: {
  titulo: string;
  texto: string;
  botao?: { label: string; onClick: () => void };
  link?: { to: string; label: string };
}) {
  return (
    <main className="rev-section grid min-h-[70vh] place-items-center text-center">
      <div>
        <Eyebrow>Player DNA</Eyebrow>
        <h1 className="rev-display mt-5" style={{ fontSize: 'clamp(30px,5vw,54px)' }}>
          {titulo}
        </h1>
        <p className="mx-auto mt-3 max-w-[40ch] text-[14px]" style={{ color: 'rgba(237,235,228,.5)' }}>
          {texto}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {botao && (
            <button type="button" onClick={botao.onClick} className="rev-btn rev-focus" data-variant="yellow" data-on="dark">
              {botao.label}
            </button>
          )}
          {link && (
            <Link to={link.to} className="rev-btn rev-focus" data-variant="yellow" data-on="dark">
              {link.label}
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

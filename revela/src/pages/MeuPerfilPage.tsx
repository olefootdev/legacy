/**
 * O painel do atleta — onde ele acompanha o próprio cadastro.
 *
 * POR QUE EXISTE: até aqui, quem mandava a ficha simplesmente sumia. Não havia
 * para onde ir depois de enviar: nenhum lugar dizia se estava na fila, se foi
 * aprovado, nem entregava o link pra ele chamar a torcida. O próprio "Como
 * Funciona" da home promete "compartilhar com os amigos" e "bem-vindo ao time"
 * — dois passos que não existiam em lugar nenhum do produto.
 *
 * O que esta tela responde, nesta ordem: em que pé está, o que acontece agora,
 * e o que ele pode fazer enquanto espera (que é chamar gente).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eyebrow } from '../components/primitives';
import { Trajetoria } from '../components/Trajetoria';
import {
  fetchLegends,
  fetchMeuTalento,
  fetchMinhaTrajetoria,
  fetchTalents,
  type MeuTalento,
} from '../data/revelaApi';
import { byAthlete, isLegend, type AthleteLegend } from '../data/legends';
import { TeamBuilder } from '../sections/TeamBuilder';
import type { Talent } from '../data/types';
import type { Trajetoria as TrajetoriaData } from '../data/trajetoria';
import type { RevelaSession } from '../data/session';

/** O funil dos 7 passos, colapsado no que o atleta precisa saber agora. */
const ESTADO: Record<string, { titulo: string; explica: string; passo: number }> = {
  pending: {
    titulo: 'Na fila do OLE Scout',
    explica:
      'Tua ficha chegou. Agora um olheiro assiste teu vídeo e monta teus atributos — é o que transforma o cadastro em card.',
    passo: 3,
  },
  in_review: {
    titulo: 'Em análise',
    explica: 'Um olheiro já está com a tua ficha na mão. Falta pouco.',
    passo: 3,
  },
  approved: {
    titulo: 'Aprovado — você está na vitrine',
    explica:
      'Teu perfil é público agora. Quem abrir teu link vê tua ficha e pode te apoiar.',
    passo: 4,
  },
  carded: {
    titulo: 'Teu card existe',
    explica: 'Você virou carta jogável dentro do game. Bem-vindo ao time.',
    passo: 5,
  },
};

export function MeuPerfilPage({
  session,
  requireAuth,
  onNote,
}: {
  session: RevelaSession | null;
  requireAuth: (motivo: string, aoEntrar?: () => void) => void;
  onNote: (titulo: string, corpo?: string, tom?: 'yellow' | 'green') => void;
}) {
  const [talento, setTalento] = useState<MeuTalento | null>(null);
  const [trajetoria, setTrajetoria] = useState<TrajetoriaData | null>(null);
  // Elenco do montador de time. Sai da HOME e vem pro painel: brincar de montar
  // escalação é coisa de quem já está dentro, não de quem chegou pelo link de um
  // amigo e ainda não sabe o que é o REVELA.
  const [talents, setTalents] = useState<Talent[]>([]);
  const [legends, setLegends] = useState<AthleteLegend[]>([]);
  const [carregando, setCarregando] = useState(true);
  // Qual link foi copiado por último — a página tem dois, e um estado só
  // acenderia "Copiado" nos dois ao mesmo tempo.
  const [copiado, setCopiado] = useState<'perfil' | 'indicacao' | null>(null);

  const carregar = useCallback(async () => {
    if (!session) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    // Em paralelo: a Trajetória não depende da ficha pra ser buscada, e
    // serializar atrasaria o painel inteiro por nada.
    const [t, tr] = await Promise.all([fetchMeuTalento(), fetchMinhaTrajetoria()]);
    setTalento(t);
    setTrajetoria(tr);
    setCarregando(false);

    // Depois de pintar o painel — o montador fica lá embaixo e não pode
    // atrasar o que a pessoa veio ver.
    void Promise.all([fetchTalents(40), fetchLegends(60)]).then(([ts, ls]) => {
      setTalents(ts);
      setLegends(byAthlete(ls.filter(isLegend)));
    });
  }, [session]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Sem sessão: a tela não finge que tem conteúdo — pede o login e explica pra quê.
  if (!session) {
    return (
      <main className="mx-auto w-full max-w-[560px] px-5 py-16 text-center">
        <Eyebrow>Área do atleta</Eyebrow>
        <h1 className="rev-display mt-3 text-[clamp(32px,8vw,52px)] leading-[0.9]">
          Entre pra acompanhar
        </h1>
        <p className="mt-4 text-[15px]" style={{ color: 'rgba(237,235,228,.6)' }}>
          Se você já mandou tua ficha, é aqui que vê em que pé está e pega teu link pra
          chamar a torcida.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => requireAuth('ver teu perfil')}
            className="rev-btn rev-focus"
            data-variant="yellow"
            data-on="dark"
          >
            Entrar
          </button>
          <Link to="/comecar" className="rev-btn rev-focus" data-variant="outline" data-on="dark">
            Ainda não tenho ficha
          </Link>
        </div>
      </main>
    );
  }

  if (carregando) {
    return (
      <main className="mx-auto w-full max-w-[560px] px-5 py-20 text-center">
        <p style={{ color: 'rgba(237,235,228,.5)' }}>Carregando teu perfil…</p>
      </main>
    );
  }

  // Logado, mas sem ficha: o caminho é criar uma.
  if (!talento) {
    return (
      <main className="mx-auto w-full max-w-[560px] px-5 py-16 text-center">
        <Eyebrow>Área do atleta</Eyebrow>
        <h1 className="rev-display mt-3 text-[clamp(30px,7vw,46px)] leading-[0.9]">
          Você ainda não tem ficha
        </h1>
        <p className="mt-4 text-[15px]" style={{ color: 'rgba(237,235,228,.6)' }}>
          Tua conta está ativa, mas nenhum perfil de atleta está ligado a ela. Leva dois
          minutos pra criar.
        </p>
        <Link
          to="/comecar"
          className="rev-btn rev-focus mt-8 inline-flex"
          data-variant="yellow"
          data-on="dark"
        >
          Criar meu perfil →
        </Link>
      </main>
    );
  }

  const estado = ESTADO[talento.status] ?? ESTADO.pending;
  const publico = talento.status === 'approved' || talento.status === 'carded';
  const link = `${window.location.origin}/t/${talento.slug}`;

  async function copiar(qual: 'perfil' | 'indicacao', texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
      setTimeout(() => setCopiado(null), 1800);
    } catch {
      /* clipboard bloqueado — o texto continua selecionável */
    }
  }

  return (
    <main className="mx-auto w-full max-w-[720px] px-5 py-10 sm:py-14">
      <Eyebrow>Área do atleta</Eyebrow>
      <h1 className="rev-display mt-3 text-[clamp(34px,9vw,60px)] leading-[0.88]">
        {talento.name}
      </h1>
      <p className="mt-2 text-[14px]" style={{ color: 'rgba(237,235,228,.55)' }}>
        {[talento.pos, talento.club, [talento.city, talento.uf].filter(Boolean).join('/')]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {/* ── Em que pé está ─────────────────────────────────────────────── */}
      <section
        className="mt-8 rounded-[14px] p-5"
        style={{
          background: publico ? 'var(--color-rev-yellow, #fde100)' : 'rgba(237,235,228,.05)',
          color: publico ? '#0d0d0d' : 'inherit',
          border: publico ? 'none' : '1px solid rgba(237,235,228,.10)',
        }}
      >
        <p
          className="rev-label text-[10px]"
          style={{ color: publico ? 'rgba(13,13,13,.6)' : 'rgba(237,235,228,.5)' }}
        >
          Passo {estado.passo} de 7
        </p>
        <h2 className="rev-display mt-1.5 text-[clamp(22px,5vw,30px)] leading-[0.95]">
          {estado.titulo}
        </h2>
        <p
          className="mt-2 text-[14px]"
          style={{ color: publico ? 'rgba(13,13,13,.7)' : 'rgba(237,235,228,.6)' }}
        >
          {estado.explica}
        </p>

        {talento.scoutNote ? (
          <p
            className="mt-3 rounded-[8px] px-3 py-2 text-[13px]"
            style={{
              background: publico ? 'rgba(13,13,13,.08)' : 'rgba(237,235,228,.06)',
              color: publico ? 'rgba(13,13,13,.75)' : 'rgba(237,235,228,.7)',
            }}
          >
            <strong>Recado do olheiro:</strong> {talento.scoutNote}
          </p>
        ) : null}
      </section>

      {/* ── Os números que já são dele ─────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Numero valor={talento.overall != null ? String(talento.overall) : '—'} rotulo="Overall" />
        <Numero valor={String(talento.supporters)} rotulo="Fãs" />
        <Numero
          valor={new Date(talento.createdAt).toLocaleDateString('pt-BR')}
          rotulo="Ficha enviada"
        />
      </div>

      {/* ── O link: só existe de verdade depois que o perfil é público ── */}
      <section className="mt-8">
        <Eyebrow>Chame a torcida</Eyebrow>
        {publico ? (
          <>
            <p className="mt-2 text-[14px]" style={{ color: 'rgba(237,235,228,.6)' }}>
              Esse é o teu endereço. Manda pra quem torce por você — cada apoio te sobe no
              ranking da semana.
            </p>
            <div
              className="mt-3 flex items-center gap-2.5 rounded-[10px] px-3 py-2.5"
              style={{ background: 'rgba(13,13,13,.5)', border: '1px solid rgba(253,225,0,.28)' }}
            >
              <code
                className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px]"
                style={{ color: 'var(--color-rev-yellow, #fde100)' }}
              >
                {link}
              </code>
              <button
                type="button"
                onClick={() => void copiar('perfil', link)}
                className="rev-btn rev-focus shrink-0"
                data-variant="yellow"
                data-on="dark"
                style={{ minHeight: 36, padding: '0 14px' }}
              >
                {copiado === 'perfil' ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <Link
              to={`/t/${talento.slug}`}
              className="rev-btn rev-focus mt-3 inline-flex"
              data-variant="outline"
              data-on="dark"
            >
              Ver meu perfil público →
            </Link>
          </>
        ) : (
          <p className="mt-2 text-[14px]" style={{ color: 'rgba(237,235,228,.55)' }}>
            Teu link fica disponível assim que o olheiro aprovar. É ele que você vai mandar
            pros amigos — por isso a gente não solta antes: link que abre numa página vazia
            queima a divulgação.
          </p>
        )}
      </section>

      {/* ── O link de indicação ─────────────────────────────────────────── */}
      {publico && <LinkDeIndicacao talento={talento} />}

      {/* ── O montador de time ──────────────────────────────────────────
          Fica DEPOIS da Trajetória de propósito: primeiro o que ele precisa
          fazer, depois o que ele pode brincar. */}
      {talents.length + legends.length > 0 && (
        <div className="mt-12" style={{ marginInline: 'calc(var(--rev-pad-x) * -1)' }}>
          <TeamBuilder
            talents={talents}
            legends={legends}
            authed
            onNeedAuth={() => requireAuth('Entra pra salvar teu time')}
            onNote={onNote}
          />
        </div>
      )}

      {/* A Trajetória some inteira se a migration ainda não estiver aplicada —
          o painel é alicerce, ela é camada. */}
      {trajetoria && (
        <Trajetoria
          dados={trajetoria}
          linkPerfil={publico ? link : null}
          story={
            publico
              ? {
                  nome: talento.name,
                  pos: talento.pos,
                  clube: talento.club,
                  overall: talento.overall,
                  fas: trajetoria.fas,
                  divisao: trajetoria.divisao,
                  portrait: talento.portrait,
                  url: link,
                }
              : null
          }
        />
      )}
    </main>
  );
}

/**
 * O LINK DE INDICAÇÃO — `revela.olefoot.com/<handle>`.
 *
 * POR QUE ELE É DIFERENTE DO LINK DO PERFIL: os dois abrem a mesma página, mas
 * só este CREDITA A REDE de quem o atleta trouxe. É o `revela_resolve_handle`
 * que faz a ponte — traduz o @ em perfil E em código de indicação, na mesma
 * URL. É o link que ele deve pôr na bio do Instagram.
 *
 * ⚠️ O CRÉDITO SÓ LIGA DEPOIS DO CLUBE. O código de indicação nasce com o
 * `profiles` do jogo. Antes disso o link abre o perfil e não credita ninguém —
 * e a tela DIZ isso, em vez de deixar o atleta divulgar achando que está
 * construindo rede.
 */
function LinkDeIndicacao({ talento }: { talento: MeuTalento }) {
  const [copiado, setCopiado] = useState(false);

  // Sem @ escolhido não existe link curto. Acontece com quem foi cadastrado
  // pelo scout antes do handle virar obrigatório — o Breno é um desses.
  if (!talento.handle) {
    return (
      <section className="mt-8">
        <Eyebrow>Teu link de indicação</Eyebrow>
        <p className="mt-2 text-[14px]" style={{ color: 'rgba(237,235,228,.55)' }}>
          Você ainda não escolheu teu @. É ele que vira teu endereço curto — o link que você põe
          na bio do Instagram e que credita quem chegar por você. Fala com a gente pra escolher.
        </p>
      </section>
    );
  }

  const url = `revela.olefoot.com/${talento.handle}`;
  const ativo = talento.indicacaoAtiva === true;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(`https://${url}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* clipboard bloqueado — o texto continua selecionável */
    }
  }

  return (
    <section className="mt-8">
      <Eyebrow>Teu link de indicação</Eyebrow>
      <p className="mt-2 text-[14px]" style={{ color: 'rgba(237,235,228,.6)' }}>
        Curto, cabe na bio do Instagram. Quem chega por ele vê teu perfil — e entra na tua rede.
      </p>

      <div
        className="mt-3 flex items-center gap-2.5 rounded-[10px] px-3 py-2.5"
        style={{ background: 'rgba(13,13,13,.5)', border: '1px solid rgba(253,225,0,.28)' }}
      >
        <code
          className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[14px]"
          style={{ color: 'var(--color-rev-yellow, #fde100)' }}
        >
          {url}
        </code>
        <button
          type="button"
          onClick={() => void copiar()}
          className="rev-btn rev-focus shrink-0"
          data-variant="yellow"
          data-on="dark"
          style={{ minHeight: 36, padding: '0 14px' }}
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      {!ativo && (
        <p className="mt-3 text-[13px] leading-relaxed" style={{ color: 'rgba(237,235,228,.5)' }}>
          O link já funciona como teu endereço. Mas a <strong>indicação</strong> só passa a contar
          depois que você criar teu clube no game — é lá que nasce teu código. Sem isso, quem
          chegar por você não entra na tua rede.
        </p>
      )}
    </section>
  );
}

function Numero({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <div
      className="rounded-[12px] px-4 py-3"
      style={{ background: 'rgba(237,235,228,.05)', border: '1px solid rgba(237,235,228,.08)' }}
    >
      <p className="rev-display text-[26px] leading-none tabular-nums">{valor}</p>
      <p className="rev-label mt-1.5 text-[10px]" style={{ color: 'rgba(237,235,228,.45)' }}>
        {rotulo}
      </p>
    </div>
  );
}

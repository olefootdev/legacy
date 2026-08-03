/**
 * A TRAJETÓRIA no painel do atleta.
 *
 * Três blocos, nesta ordem — e a ordem é a decisão de design:
 *   1. COMO FUNCIONA   explica antes de cobrar. Quem não entende OLEKO lê uma
 *                      lista de tarefas sem sentido e fecha a aba.
 *   2. ONDE VOCÊ ESTÁ  divisão, barra e o EXP que está esperando por ele.
 *   3. TASKS           comece por aqui · esta semana · suas metas.
 *
 * REGRA DE HONESTIDADE DA UI: task que ele não pode cumprir hoje NÃO aparece
 * como task — vira meta com barra. "Chegue a 10.000 fãs" num perfil com 12 fãs
 * não é missão, é deboche.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eyebrow } from './primitives';
import { BotaoStory, type StoryInput } from './StoryCard';
import { enviarProva, fetchMinhasProvas, type MinhasProvas } from '../data/revelaApi';
import { uploadPrint } from '../data/upload';
import {
  CHAVES,
  DIVISOES,
  MISSOES_SEMANA,
  expConquistado,
  faltaPraProxima,
  progressoDivisao,
  ptBrNum,
  type Missao,
  type Trajetoria as TrajetoriaData,
} from '../data/trajetoria';

const AMARELO = 'var(--color-rev-yellow, #fde100)';
const OSSO = 'rgba(237,235,228,';

export function Trajetoria({
  dados,
  linkPerfil,
  story,
}: {
  dados: TrajetoriaData;
  linkPerfil: string | null;
  /** Só existe quando o perfil já é público — antes disso não há o que divulgar. */
  story: StoryInput | null;
}) {
  const comece = dados.missoes.filter((m) => m.grupo === 'comece');
  const metas = dados.missoes.filter((m) => m.grupo === 'metas');
  const comeceAberto = comece.filter((m) => !m.feita);
  const conquistadas = dados.missoes.filter((m) => m.feita);

  return (
    <section className="mt-12">
      <Eyebrow>A Trajetória</Eyebrow>

      <ComoFunciona />
      <OndeVoceEsta dados={dados} />
      <Medalhas conquistadas={conquistadas} divisaoId={dados.divisao.id} />

      {/* ── Bloco 1 — some sozinho quando as cinco estiverem feitas ───────── */}
      {comeceAberto.length > 0 && (
        <Grupo titulo="Comece por aqui" nota={`${comece.length - comeceAberto.length} de ${comece.length} feitas`}>
          {comece.map((m) => (
            <LinhaTask key={m.id} missao={m} />
          ))}
        </Grupo>
      )}

      {/* ── Bloco 2 — postou, print, mandou. A IA confere. ─────────────────── */}
      <Grupo titulo="Esta semana" nota="reseta toda segunda">
        {MISSOES_SEMANA.map((m) => (
          <MissaoComPrint key={m.id} missao={m} />
        ))}
        <p className="px-4 pb-3 pt-2 text-[12px]" style={{ color: `${OSSO}.4)` }}>
          Postou, tira um print e manda aqui. A gente confere a imagem e o OLEKO cai — quase
          sempre no mesmo dia.
        </p>
      </Grupo>

      {/* ── Bloco 3 — nunca some: é o mapa do que ainda dá pra conquistar ── */}
      <Grupo titulo="Suas metas" nota="progresso contínuo">
        {metas.map((m) => (
          <LinhaMeta key={m.id} missao={m} />
        ))}
      </Grupo>

      {/* ── A munição: arte pronta pro story ─────────────────────────────── */}
      {story && (
        <div
          className="mt-4 rounded-[14px] px-5 py-5"
          style={{ background: `${OSSO}.05)`, border: `1px solid ${OSSO}.10)` }}
        >
          <h3 className="rev-display text-[18px] leading-none">Divulgue em 1 toque</h3>
          <p className="mt-2 text-[13.5px]" style={{ color: `${OSSO}.6)` }}>
            Link cru no grupo não para o dedo de ninguém. Isto gera a tua arte 9:16 com foto,
            divisão e endereço — pronta pro story.
          </p>
          <div className="mt-4">
            <BotaoStory dados={story} />
          </div>
          {linkPerfil && (
            <p className="mt-3 text-[12.5px]" style={{ color: `${OSSO}.42)` }}>
              Teu endereço: <span style={{ color: AMARELO }}>{linkPerfil}</span>
            </p>
          )}
        </div>
      )}

      {!story && linkPerfil && (
        <p className="mt-4 text-[13px]" style={{ color: `${OSSO}.5)` }}>
          Quase tudo aqui depende de gente ver teu perfil. Teu endereço é{' '}
          <span style={{ color: AMARELO }}>{linkPerfil}</span>.
        </p>
      )}
    </section>
  );
}

/* ══ 1. Como funciona ══════════════════════════════════════════════════════ */

const PASSOS = [
  {
    titulo: 'OLEKO é a sua pontuação',
    texto:
      'Você ganha OLEKO cumprindo missões: completar sua ficha, chamar torcida, trazer outros atletas, aparecer. OLEKO não se gasta — ele só sobe, e é ele que define sua divisão.',
  },
  {
    titulo: 'Cinco divisões',
    texto:
      'Todo mundo começa em Fraldinha. De lá pra cima: Junior, Sub 17, Pro e Campeão. Sua divisão aparece no teu perfil público — é o que o olheiro e o manager veem antes de tudo.',
  },
  {
    titulo: 'Cada divisão paga em EXP do game',
    texto:
      'Chegou em Junior, são 250 mil EXP. O EXP é o dinheiro do OLEFOOT: compra jogador, paga treino, abre entrada de liga. Pra sacar, você precisa do teu clube criado — leva dois minutos e é grátis.',
  },
  {
    titulo: 'Você corre com os seus',
    texto:
      'O ranking é separado por categoria: quem está na escolinha disputa com a escolinha, o profissional com o profissional, a lenda com a lenda. Ninguém corre contra quem já chegou.',
  },
  {
    titulo: 'A temporada tem fim',
    texto:
      'Seis semanas. Toda segunda sai o pódio da semana. No fim, os primeiros de cada categoria levam troféu, carta de lenda e destaque na home — e a divisão que você conquistou fica no teu perfil pra sempre.',
  },
];

function ComoFunciona() {
  // Fechado por padrão: quem já entendeu não precisa rolar cinco parágrafos
  // toda vez que abre o painel pra ver o número de fãs.
  const [aberto, setAberto] = useState(false);

  return (
    <div
      className="mt-4 overflow-hidden rounded-[14px]"
      style={{ background: `${OSSO}.05)`, border: `1px solid ${OSSO}.10)` }}
    >
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="rev-focus flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        data-on="dark"
      >
        <span>
          <span className="rev-display block text-[20px] leading-none">Como funciona</span>
          <span className="mt-1.5 block text-[13px]" style={{ color: `${OSSO}.55)` }}>
            Aqui você não espera ser descoberto. Você corre atrás.
          </span>
        </span>
        <span className="shrink-0 text-[18px]" style={{ color: AMARELO }}>
          {aberto ? '−' : '+'}
        </span>
      </button>

      {!aberto && (
        <div className="px-5 pb-5">
          <Link
            to="/como-funciona"
            className="rev-btn rev-focus"
            data-variant="outline"
            data-on="dark"
            style={{ minHeight: 38, padding: '0 16px', fontSize: 11 }}
          >
            Guia completo do REVELA →
          </Link>
        </div>
      )}

      {aberto && (
        <ol className="list-none px-5 pb-5" style={{ margin: 0 }}>
          {PASSOS.map((p, i) => (
            <li
              key={p.titulo}
              className="grid gap-3 border-t pt-4"
              style={{ gridTemplateColumns: '26px 1fr', borderColor: `${OSSO}.08)`, marginTop: 16 }}
            >
              <span className="rev-display text-[22px] leading-none" style={{ color: AMARELO }}>
                {i + 1}
              </span>
              <span>
                <strong className="block text-[15px]">{p.titulo}</strong>
                <span className="mt-1 block text-[14px]" style={{ color: `${OSSO}.6)` }}>
                  {p.texto}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ══ 2. Onde você está ═════════════════════════════════════════════════════ */

function OndeVoceEsta({ dados }: { dados: TrajetoriaData }) {
  const pct = Math.round(progressoDivisao(dados) * 100);
  const falta = faltaPraProxima(dados);
  const expTravado = expConquistado(dados.divisao.id);

  return (
    <div className="mt-4">
      <div
        className="rounded-[14px] px-5 py-5"
        style={{ background: AMARELO, color: '#0d0d0d' }}
      >
        <p className="rev-label text-[10px]" style={{ color: 'rgba(13,13,13,.6)' }}>
          Divisão {dados.divisao.id} de 5 · chave {CHAVES[dados.chave] ?? 'Novos talentos'}
        </p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="rev-display text-[clamp(30px,8vw,46px)] leading-none">{dados.divisao.nome}</h3>
          <p className="rev-display text-[26px] leading-none tabular-nums">
            {ptBrNum(dados.oleko)} <span className="text-[15px]">OLEKO</span>
          </p>
        </div>

        {dados.proxima ? (
          <>
            <div
              className="mt-4 h-2 w-full overflow-hidden rounded-full"
              style={{ background: 'rgba(13,13,13,.16)' }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progresso até ${dados.proxima.nome}`}
            >
              <div style={{ width: `${pct}%`, height: '100%', background: '#0d0d0d' }} />
            </div>
            <p className="mt-2 text-[13.5px]" style={{ color: 'rgba(13,13,13,.72)' }}>
              Faltam <strong>{ptBrNum(falta)} OLEKO</strong> pra <strong>{dados.proxima.nome}</strong> —
              que libera {ptBrNum(dados.proxima.exp)} EXP no game.
            </p>
          </>
        ) : (
          <p className="mt-3 text-[13.5px]" style={{ color: 'rgba(13,13,13,.72)' }}>
            Você chegou no topo da Trajetória. O que vem agora é o pódio da temporada.
          </p>
        )}
      </div>

      {/* O gancho que converte atleta em jogador. Só aparece quando há prêmio
          conquistado e ele ainda não tem onde receber. */}
      {expTravado > 0 && !dados.temClube && (
        <div
          className="mt-3 rounded-[12px] px-5 py-4"
          style={{ background: 'rgba(13,13,13,.5)', border: `1px solid rgba(253,225,0,.34)` }}
        >
          <p className="rev-display text-[22px] leading-[1.05]" style={{ color: AMARELO }}>
            {ptBrNum(expTravado)} EXP esperando por você
          </p>
          <p className="mt-1.5 text-[13.5px]" style={{ color: `${OSSO}.62)` }}>
            O prêmio das divisões que você já conquistou. Cria teu clube pra sacar — leva dois
            minutos e é grátis.
          </p>
          <a
            href="https://game.olefoot.com/cadastro"
            className="rev-btn rev-focus mt-4 inline-flex"
            data-variant="yellow"
            data-on="dark"
          >
            Criar meu clube →
          </a>
        </div>
      )}
    </div>
  );
}

/* ══ 1b. Prova de divulgação ═══════════════════════════════════════════════ */

/**
 * "Postou? Manda o print."
 *
 * A alternativa era o webhook `mentions` da Meta — que exige App Review, leva
 * semanas, e mesmo aprovado não cobre story. O print funciona hoje, em todos os
 * formatos, e não depende de aprovação de ninguém.
 *
 * A IA olha a imagem e aprova o que reconhece com confiança. O que ela não tem
 * certeza NÃO é reprovado: vai pra fila humana com o veredito anotado. Errar
 * pro lado de pagar OLEKO a mais custa nada — OLEKO não é dinheiro. Errar pro
 * outro lado é chamar de mentiroso um garoto que divulgou de verdade.
 */
const ROTULO_PROVA: Record<string, { texto: string; cor: string }> = {
  pending: { texto: 'Print recebido — conferindo', cor: 'var(--color-rev-yellow, #fde100)' },
  approved: { texto: 'Aprovado — OLEKO creditado', cor: 'var(--color-rev-success, #22c55e)' },
  rejected: { texto: 'Não deu pra confirmar', cor: 'var(--color-rev-danger, #ef4444)' },
};

function MissaoComPrint({
  missao,
}: {
  missao: { id: string; label: string; oleko: number; comoFazer: string };
}) {
  const [provas, setProvas] = useState<MinhasProvas>({});
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void fetchMinhasProvas().then(setProvas);
  }, []);

  const prova = provas[missao.id];

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reescolher o mesmo arquivo depois de um erro
    if (!file || ocupado) return;

    setOcupado(true);
    setErro(null);

    const up = await uploadPrint(file);
    if (!up.ok || !up.url) {
      setErro(up.motivo ?? 'Não deu pra subir o print.');
      setOcupado(false);
      return;
    }

    const res = await enviarProva(missao.id, up.url);
    setOcupado(false);

    if (!res.ok) {
      setErro(
        res.reason === 'ja_enviado'
          ? 'Você já mandou o print desta missão esta semana.'
          : res.reason === 'sem_ficha'
            ? 'Só quem tem ficha no REVELA manda print.'
            : 'Não deu pra registrar. Tenta de novo.',
      );
      return;
    }

    setProvas((p) => ({ ...p, [missao.id]: { status: 'pending', note: null } }));
  }

  return (
    <div className="border-t px-4 py-3" style={{ borderColor: `${OSSO}.08)` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14.5px] leading-[1.35]">{missao.label}</p>
          <p className="mt-0.5 text-[12.5px]" style={{ color: `${OSSO}.45)` }}>
            {missao.comoFazer}
          </p>
        </div>
        <Oleko valor={missao.oleko} apagado={prova?.status === 'approved'} />
      </div>

      {prova ? (
        <p
          className="rev-label mt-2.5 text-[10px]"
          style={{ color: ROTULO_PROVA[prova.status]?.cor ?? AMARELO }}
        >
          {ROTULO_PROVA[prova.status]?.texto ?? prova.status}
          {prova.note ? ` · ${prova.note}` : ''}
        </p>
      ) : (
        <>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void aoEscolher(e)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={ocupado}
            className="rev-btn rev-focus mt-2.5"
            data-variant="outline"
            data-on="dark"
            style={{ minHeight: 36, padding: '0 14px', fontSize: 11 }}
          >
            {ocupado ? 'Enviando…' : 'Mandar print'}
          </button>
        </>
      )}

      {erro && (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--color-rev-danger, #ef4444)' }}>
          {erro}
        </p>
      )}
    </div>
  );
}

/* ══ 2b. Medalhas e troféus ════════════════════════════════════════════════ */

/**
 * A prateleira do que ele já conquistou.
 *
 * POR QUE FALTAVA: os Selos de Craque existem desde julho, mas só aparecem no
 * perfil PÚBLICO. O atleta conquistava e nunca via — a conquista virava algo que
 * só estranho enxerga. Aqui a medalha é a mesma missão cumprida, com o OLEKO que
 * ela pagou: recompensa e prova, no mesmo lugar.
 *
 * TROFÉU é outra coisa: divisão conquistada. Medalha é tarefa; troféu é degrau.
 */
const ICONE: Record<string, string> = {
  foto: '📸', video: '🎬', handle: '🔗', scout: '🔎', clube: '🏟️',
  fas_10: '🔟', fas_100: '⭐', fas_1000: '🔥', fas_2500: '💥',
  fas_5000: '🌪️', fas_10000: '👑', rede: '🤝', rede_5: '🧲', card: '🏆',
};

function Medalhas({ conquistadas, divisaoId }: { conquistadas: Missao[]; divisaoId: number }) {
  if (conquistadas.length === 0 && divisaoId <= 1) return null;

  const trofeus = DIVISOES.filter((d) => d.id > 1 && d.id <= divisaoId);

  return (
    <div
      className="mt-4 rounded-[14px] px-5 py-5"
      style={{ background: `${OSSO}.05)`, border: `1px solid ${OSSO}.10)` }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="rev-display text-[18px] leading-none">Sua prateleira</h3>
        <span className="rev-label text-[9px]" style={{ color: `${OSSO}.4)` }}>
          {trofeus.length} {trofeus.length === 1 ? 'troféu' : 'troféus'} · {conquistadas.length}{' '}
          {conquistadas.length === 1 ? 'medalha' : 'medalhas'}
        </span>
      </div>

      {trofeus.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {trofeus.map((d) => (
            <span
              key={d.slug}
              className="rev-display inline-flex items-center gap-2 text-[15px] leading-none"
              style={{ background: AMARELO, color: '#0d0d0d', padding: '9px 13px', borderRadius: 8 }}
            >
              🏅 {d.nome}
            </span>
          ))}
        </div>
      )}

      {conquistadas.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {conquistadas.map((m) => (
            <span
              key={m.id}
              title={`${m.label} · +${ptBrNum(m.oleko)} OLEKO`}
              className="inline-flex items-center gap-2 text-[12.5px]"
              style={{
                background: `${OSSO}.07)`,
                border: `1px solid rgba(253,225,0,.28)`,
                borderRadius: 999,
                padding: '7px 12px',
              }}
            >
              <span aria-hidden="true">{ICONE[m.id] ?? '✅'}</span>
              {m.label}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[13.5px]" style={{ color: `${OSSO}.5)` }}>
          Sua prateleira está vazia. A primeira medalha é a foto de perfil — leva 10 segundos.
        </p>
      )}
    </div>
  );
}

/* ══ 3. Tasks ══════════════════════════════════════════════════════════════ */

function Grupo({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="mt-4 overflow-hidden rounded-[14px]"
      style={{ background: `${OSSO}.05)`, border: `1px solid ${OSSO}.10)` }}
    >
      <div className="flex items-baseline justify-between gap-3 px-4 py-3">
        <h3 className="rev-display text-[18px] leading-none">{titulo}</h3>
        <span className="rev-label text-[9px]" style={{ color: `${OSSO}.4)` }}>
          {nota}
        </span>
      </div>
      {children}
    </div>
  );
}

function Oleko({ valor, apagado = false }: { valor: number; apagado?: boolean }) {
  return (
    <span
      className="rev-display shrink-0 text-[15px] leading-none tabular-nums"
      style={{ color: apagado ? `${OSSO}.35)` : AMARELO }}
    >
      +{ptBrNum(valor)}
    </span>
  );
}

function LinhaTask({ missao }: { missao: Missao }) {
  return (
    <div
      className="flex items-center justify-between gap-3 border-t px-4 py-3"
      style={{ borderColor: `${OSSO}.08)` }}
    >
      <span className="flex min-w-0 items-start gap-2.5">
        <Marca feita={missao.feita} />
        <span
          className="text-[14.5px] leading-[1.35]"
          style={{ color: missao.feita ? `${OSSO}.42)` : undefined }}
        >
          {missao.label}
        </span>
      </span>
      <Oleko valor={missao.oleko} apagado={missao.feita} />
    </div>
  );
}

/**
 * Meta com progresso. Mostra o número REAL ao lado do alvo — é o que separa
 * "faltam 88 fãs" (meta) de "chegue a 10.000 fãs" (deboche).
 */
function LinhaMeta({ missao }: { missao: Missao }) {
  const temBarra = typeof missao.alvo === 'number' && typeof missao.atual === 'number';
  const pct = temBarra ? Math.min(100, Math.round(((missao.atual ?? 0) / (missao.alvo || 1)) * 100)) : 0;

  return (
    <div className="border-t px-4 py-3" style={{ borderColor: `${OSSO}.08)` }}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-start gap-2.5">
          <Marca feita={missao.feita} />
          <span
            className="text-[14.5px] leading-[1.35]"
            style={{ color: missao.feita ? `${OSSO}.42)` : undefined }}
          >
            {missao.label}
          </span>
        </span>
        <Oleko valor={missao.oleko} apagado={missao.feita && missao.oleko === 0} />
      </div>

      {temBarra && !missao.feita && (
        <>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: `${OSSO}.1)` }}
          >
            <div style={{ width: `${pct}%`, height: '100%', background: AMARELO }} />
          </div>
          <p className="mt-1.5 text-[12.5px]" style={{ color: `${OSSO}.45)` }}>
            {ptBrNum(missao.atual ?? 0)} de {ptBrNum(missao.alvo ?? 0)} — faltam{' '}
            {ptBrNum(Math.max(0, (missao.alvo ?? 0) - (missao.atual ?? 0)))}
          </p>
        </>
      )}

      {missao.id === 'rede' && (missao.atual ?? 0) > 0 && (
        <p className="mt-1.5 text-[12.5px]" style={{ color: `${OSSO}.45)` }}>
          {ptBrNum(missao.atual ?? 0)} {(missao.atual ?? 0) === 1 ? 'aprovado' : 'aprovados'}
          {(missao.lendas ?? 0) > 0
            ? ` · ${ptBrNum(missao.lendas ?? 0)} ${(missao.lendas ?? 0) === 1 ? 'lenda, que vale' : 'lendas, que valem'} o dobro`
            : ''}
        </p>
      )}
    </div>
  );
}

function Marca({ feita }: { feita: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full text-[11px]"
      style={{
        width: 18,
        height: 18,
        background: feita ? 'var(--color-rev-success, #22c55e)' : 'transparent',
        border: feita ? 'none' : `1.5px solid ${OSSO}.24)`,
        color: '#0d0d0d',
      }}
    >
      {feita ? '✓' : ''}
    </span>
  );
}

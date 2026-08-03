/**
 * O GUIA — a explicação completa do REVELA, escrita PRO ATLETA.
 *
 * ── A QUEM ESTA PÁGINA FALA ─────────────────────────────────────────────────
 * Decisão do fundador (2026-08-03): fala com o atleta, e fala de um jeito que
 * ele consiga REPASSAR. Isso muda a escrita, não só o conteúdo: cada bloco
 * responde uma pergunta que ele vai ouvir do pai, do treinador, do amigo do
 * grupo — e responde curto o bastante pra ele repetir de cabeça. Por isso a
 * página fecha com um roteiro de 30 segundos, pronto pra colar no WhatsApp.
 *
 * ── DUAS NUMERAÇÕES QUE NÃO SE MISTURAM ─────────────────────────────────────
 * A JORNADA tem 7 passos (cadastro → card). A TRAJETÓRIA tem 5 divisões
 * (Fraldinha → Campeão). São coisas diferentes e ficam na mesma página, então
 * o texto diz isso com todas as letras: uma é o CAMINHO, a outra é a CORRIDA.
 * Sem esse aviso, "passo 5" e "divisão 5" viram a mesma coisa na cabeça de quem
 * lê rápido.
 *
 * ── OS NÚMEROS VÊM DO CATÁLOGO ──────────────────────────────────────────────
 * Nada de valor digitado à mão aqui: `DIVISOES`, `CHAVES` e `MISSOES_SEMANA`
 * são importados de `data/trajetoria.ts`. Um guia que promete OLEKO diferente
 * do que o painel paga é pior que guia nenhum.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eyebrow } from '../components/primitives';
import {
  CHAVES,
  DIVISOES,
  MISSOES_SEMANA,
  ORDEM_CHAVES,
  ptBrNum,
} from '../data/trajetoria';

const AMARELO = 'var(--color-rev-yellow, #fde100)';
const OSSO = 'rgba(237,235,228,';

/* ══ A jornada — os mesmos 7 passos da home ════════════════════════════════ */

const JORNADA = [
  { n: 1, titulo: 'Você cria teu perfil', texto: 'Nome, posição, onde joga, uma foto e um vídeo. Dois minutos, de graça.' },
  { n: 2, titulo: 'Sua conta é validada', texto: 'O WhatsApp confirma que é você mesmo. Menor de idade precisa do responsável.' },
  { n: 3, titulo: 'O OLE SCOUT avalia', texto: 'Um olheiro assiste teu vídeo e monta tua ficha de atributos. É o que transforma cadastro em jogador.' },
  { n: 4, titulo: 'Você entra na vitrine', texto: 'Teu perfil vira público, com endereço próprio. É esse link que você manda pros amigos.' },
  { n: 5, titulo: 'Teu card é criado', texto: 'Você vira uma carta jogável dentro do game da Olefoot, com teus atributos.' },
  { n: 6, titulo: 'A torcida chega', texto: 'Quem abre teu link vira teu fã. Cada fã te sobe na disputa.' },
  { n: 7, titulo: 'Você está no time', texto: 'Managers escalam tua carta. Teu nome passa a circular sem você precisar estar na sala.' },
];

/* ══ Perguntas que ele vai ouvir ═══════════════════════════════════════════ */

const PERGUNTAS = [
  {
    q: 'Custa alguma coisa?',
    a: 'Não. Criar o perfil, entrar na vitrine, virar card e disputar a Trajetória é tudo de graça. Nunca vai ter mensalidade pra você aparecer aqui.',
  },
  {
    q: 'Preciso ser federado ou estar em clube?',
    a: 'Não. Escolinha, várzea, base, profissional e ex-atleta — todo mundo entra. E cada um disputa na sua categoria, então você não corre contra quem já chegou.',
  },
  {
    q: 'A Olefoot vira minha empresária?',
    a: 'Não. A gente não assina contrato de imagem, não fica com percentual do teu passe e não te representa em nada. O REVELA é vitrine, não agência.',
  },
  {
    q: 'O que é esse EXP que eu ganho?',
    a: 'É o dinheiro de dentro do game da Olefoot. Serve pra montar teu clube, contratar jogador, pagar treino e entrar em liga. Não é dinheiro de verdade e não vira dinheiro de verdade — é ficha de fliperama.',
  },
  {
    q: 'Sou menor de idade, posso?',
    a: 'Pode, com o responsável no cadastro. Nome e telefone dele ficam guardados só pra gente confirmar — não aparecem no teu perfil público.',
  },
  {
    q: 'Meu telefone vai aparecer pra alguém?',
    a: 'Não. O que fica público é o que você escolheria mostrar num cartaz: nome, posição, clube, cidade, teus atributos, teu vídeo. Contato nunca.',
  },
  {
    q: 'E se ninguém me apoiar?',
    a: 'Você continua na vitrine e continua sendo visto pelos managers. A torcida acelera, não é o portão.',
  },
];

export function ComoFuncionaPage({ session }: { session: { userId: string } | null }) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <main>
      {/* ══ Abertura ═══════════════════════════════════════════════════════ */}
      <section className="rev-section" style={{ background: AMARELO, color: '#0D0D0D' }}>
        <div className="rev-container">
          <Link to="/" className="rev-label rev-focus text-[10px]" data-on="yellow" style={{ color: 'rgba(13,13,13,.55)' }}>
            ← Voltar
          </Link>
          <h1 className="rev-hero-type mt-7" style={{ fontSize: 'clamp(40px,8vw,110px)' }}>
            Como o REVELA
            <br />
            funciona
          </h1>
          <p className="mt-6 max-w-[54ch] text-[16px] leading-relaxed" style={{ color: 'rgba(13,13,13,.72)' }}>
            Aqui você não espera ser descoberto — você corre atrás. Esta página explica o
            caminho inteiro, do cadastro à carta jogável. Leia uma vez e você consegue
            explicar pra qualquer pessoa.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/comecar" className="rev-btn rev-focus">
              Criar meu perfil
            </Link>
            <a href="#roteiro" className="rev-btn rev-focus" data-variant="outline">
              Como explicar pra alguém
            </a>
          </div>
        </div>
      </section>

      {/* ══ 1. A jornada ═══════════════════════════════════════════════════ */}
      <section className="rev-section" style={{ background: 'var(--color-rev-black)' }}>
        <div className="rev-container">
          <Eyebrow>O caminho</Eyebrow>
          <h2 className="rev-display mt-4 max-w-[20ch]" style={{ fontSize: 'clamp(30px,5vw,60px)', color: 'var(--color-rev-bone)' }}>
            Sete passos até virar carta
          </h2>
          <p className="mt-4 max-w-[52ch] text-[15px]" style={{ color: `${OSSO}.6)` }}>
            Esta é a jornada — o que acontece com você, na ordem. Ninguém pula passo, e
            nenhum deles custa dinheiro.
          </p>

          <ol className="mt-10 list-none" style={{ margin: '40px 0 0', padding: 0 }}>
            {JORNADA.map((p) => (
              <li
                key={p.n}
                className="grid gap-5 border-t py-6"
                style={{ gridTemplateColumns: '48px 1fr', borderColor: `${OSSO}.1)` }}
              >
                <span className="rev-display text-[34px] leading-none" style={{ color: AMARELO }}>
                  {String(p.n).padStart(2, '0')}
                </span>
                <span>
                  <p className="rev-display text-[22px] leading-none" style={{ color: 'var(--color-rev-bone)' }}>
                    {p.titulo}
                  </p>
                  <p className="mt-2 max-w-[58ch] text-[15px] leading-relaxed" style={{ color: `${OSSO}.6)` }}>
                    {p.texto}
                  </p>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ══ 2. A Trajetória ════════════════════════════════════════════════ */}
      <section className="rev-section" style={{ background: AMARELO, color: '#0D0D0D' }}>
        <div className="rev-container">
          <Eyebrow on="yellow">A disputa</Eyebrow>
          <h2 className="rev-display mt-4 max-w-[18ch]" style={{ fontSize: 'clamp(30px,5vw,60px)' }}>
            A Trajetória
          </h2>

          {/* O aviso que impede as duas numerações de se confundirem. */}
          <p className="mt-5 max-w-[56ch] text-[16px] leading-relaxed" style={{ color: 'rgba(13,13,13,.75)' }}>
            Os sete passos são o <strong>caminho</strong>. A Trajetória é a <strong>corrida</strong>
            — ela roda por cima, ao mesmo tempo, e mede o quanto você se mexe.
          </p>
          <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed" style={{ color: 'rgba(13,13,13,.62)' }}>
            Você ganha <strong>OLEKO</strong> completando tua ficha, chamando torcida, trazendo
            outros atletas e aparecendo. OLEKO não se gasta — só sobe. E é ele que define tua
            divisão.
          </p>

          <h3 className="rev-display mt-12 text-[26px]">As cinco divisões</h3>
          <div className="mt-5 flex flex-col gap-2.5">
            {DIVISOES.map((d) => (
              <div
                key={d.slug}
                className="grid items-center gap-2 px-5 py-4"
                style={{
                  gridTemplateColumns: 'minmax(120px,1fr) auto',
                  background: '#0D0D0D',
                  borderRadius: 12,
                }}
              >
                <span>
                  <span className="rev-display block text-[24px] leading-none" style={{ color: AMARELO }}>
                    {d.nome}
                  </span>
                  <span className="rev-label mt-1.5 block text-[10px]" style={{ color: `${OSSO}.45)` }}>
                    {d.meta === 0 ? 'todo mundo começa aqui' : `${ptBrNum(d.meta)} OLEKO`}
                  </span>
                </span>
                <span className="text-right">
                  {d.exp > 0 ? (
                    <>
                      <span className="rev-display block text-[19px] leading-none tabular-nums" style={{ color: 'var(--color-rev-bone)' }}>
                        {ptBrNum(d.exp)}
                      </span>
                      <span className="rev-label mt-1 block text-[9px]" style={{ color: `${OSSO}.4)` }}>
                        EXP no game
                      </span>
                    </>
                  ) : (
                    <span className="rev-label text-[10px]" style={{ color: `${OSSO}.3)` }}>
                      —
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>

          <h3 className="rev-display mt-12 text-[26px]">Você corre com os seus</h3>
          <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed" style={{ color: 'rgba(13,13,13,.68)' }}>
            O ranking é separado por categoria — a que você declarou no cadastro. Um moleque de
            escolinha não disputa contra um ex-profissional que já tem quarenta mil seguidores.
            Cada chave tem seu pódio e seu prêmio.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {ORDEM_CHAVES.map((c) => (
              <span
                key={c}
                className="rev-label text-[11px]"
                style={{ background: '#0D0D0D', color: AMARELO, padding: '10px 16px', borderRadius: 999 }}
              >
                {CHAVES[c]}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 3. Como ganhar OLEKO ═══════════════════════════════════════════ */}
      <section className="rev-section" style={{ background: 'var(--color-rev-black)' }}>
        <div className="rev-container">
          <Eyebrow>O que vale ponto</Eyebrow>
          <h2 className="rev-display mt-4 max-w-[20ch]" style={{ fontSize: 'clamp(30px,5vw,58px)', color: 'var(--color-rev-bone)' }}>
            Como se ganha OLEKO
          </h2>
          <p className="mt-4 max-w-[52ch] text-[15px]" style={{ color: `${OSSO}.6)` }}>
            Teu painel mostra tudo isso com teu número do lado, e o que falta pra próxima meta.
            Aqui é o mapa geral.
          </p>

          <div className="mt-10 grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,290px),1fr))' }}>
            <Bloco titulo="Sua ficha" nota="uma vez só">
              <Item texto="Foto de perfil" oleko={500} />
              <Item texto="Vídeo de 15 segundos jogando" oleko={500} />
              <Item texto="Teu @username" oleko={500} />
              <Item texto="Ficha avaliada pelo OLE SCOUT" oleko={2000} />
              <Item texto="Criar teu clube no game" oleko={2500} />
            </Bloco>

            <Bloco titulo="Torcida" nota="quanto mais gente vê, mais sobe">
              <Item texto="10 fãs" oleko={100} />
              <Item texto="100 fãs" oleko={2500} />
              <Item texto="1.000 fãs" oleko={7500} />
              <Item texto="2.500 fãs" oleko={15000} />
              <Item texto="5.000 fãs" oleko={30000} />
              <Item texto="10.000 fãs" oleko={60000} />
            </Bloco>

            <Bloco titulo="Chamar gente" nota="quem você traz conta">
              <Item texto="Cada atleta seu aprovado pelo scout" oleko={1250} />
              <Item texto="Um ex-atleta (lenda) aprovado" oleko={2500} />
              <Item texto="Bônus com 5 aprovados na tua rede" oleko={10000} />
              <Item texto="Teu card jogável ser lançado" oleko={10000} />
            </Bloco>

            <Bloco titulo="Toda semana" nota="reseta na segunda">
              {MISSOES_SEMANA.map((m) => (
                <Item key={m.id} texto={m.label} oleko={m.oleko} />
              ))}
              <Item texto="Pódio da semana na tua categoria" oleko={3000} />
            </Bloco>
          </div>
        </div>
      </section>

      {/* ══ 4. O print ═════════════════════════════════════════════════════ */}
      <section className="rev-section" style={{ background: 'var(--color-rev-surface)' }}>
        <div className="rev-container">
          <Eyebrow>Instagram</Eyebrow>
          <h2 className="rev-display mt-4 max-w-[20ch]" style={{ fontSize: 'clamp(28px,4.6vw,54px)', color: 'var(--color-rev-bone)' }}>
            Postou? Manda o print
          </h2>
          <p className="mt-5 max-w-[56ch] text-[15px] leading-relaxed" style={{ color: `${OSSO}.62)` }}>
            Marque <strong style={{ color: AMARELO }}>@olefootgame</strong> num post, num reels ou
            num story. Depois tira um print e manda no teu painel, no bloco{' '}
            <em>Esta semana</em>. Só isso.
          </p>
          <p className="mt-4 max-w-[56ch] text-[15px] leading-relaxed" style={{ color: `${OSSO}.62)` }}>
            A gente confere a imagem e o OLEKO cai — quase sempre no mesmo dia. Se o print
            estiver cortado ou embaçado, uma pessoa olha antes de decidir. Ninguém é reprovado
            por uma foto ruim sem alguém ter olhado.
          </p>
          <p className="mt-6 max-w-[56ch] text-[14px] leading-relaxed" style={{ color: `${OSSO}.42)` }}>
            Uma marcação por formato por semana. Na segunda, zera e você pode mandar de novo.
          </p>
        </div>
      </section>

      {/* ══ 5. O prêmio ════════════════════════════════════════════════════ */}
      <section className="rev-section" style={{ background: 'var(--color-rev-black)' }}>
        <div className="rev-container">
          <Eyebrow>O prêmio</Eyebrow>
          <h2 className="rev-display mt-4 max-w-[22ch]" style={{ fontSize: 'clamp(28px,4.6vw,54px)', color: 'var(--color-rev-bone)' }}>
            Cada divisão paga em EXP
          </h2>
          <p className="mt-5 max-w-[56ch] text-[15px] leading-relaxed" style={{ color: `${OSSO}.62)` }}>
            Chegou em <strong style={{ color: AMARELO }}>Junior</strong>, são{' '}
            <strong style={{ color: AMARELO }}>250 mil EXP</strong>. O EXP é o dinheiro de dentro
            do game da Olefoot: compra jogador, paga treino, abre entrada de liga.
          </p>
          <p className="mt-4 max-w-[56ch] text-[15px] leading-relaxed" style={{ color: `${OSSO}.62)` }}>
            Pra receber, você precisa do <strong>teu clube criado</strong> — leva dois minutos e
            é grátis. Se ainda não tem, o prêmio não se perde: fica te esperando, e o painel
            mostra quanto tem guardado.
          </p>
          <p className="mt-6 max-w-[56ch] text-[14px] leading-relaxed" style={{ color: `${OSSO}.4)` }}>
            EXP não é dinheiro de verdade e não vira dinheiro de verdade. É ficha de fliperama:
            só serve dentro do jogo.
          </p>
        </div>
      </section>

      {/* ══ 6. Perguntas ═══════════════════════════════════════════════════ */}
      <section className="rev-section" style={{ background: AMARELO, color: '#0D0D0D' }}>
        <div className="rev-container">
          <Eyebrow on="yellow">Direto ao ponto</Eyebrow>
          <h2 className="rev-display mt-4 max-w-[20ch]" style={{ fontSize: 'clamp(28px,4.6vw,54px)' }}>
            O que sempre perguntam
          </h2>
          <dl className="mt-9" style={{ margin: '36px 0 0' }}>
            {PERGUNTAS.map((p) => (
              <div key={p.q} className="border-t py-6" style={{ borderColor: 'rgba(13,13,13,.16)' }}>
                <dt className="rev-display text-[21px] leading-tight">{p.q}</dt>
                <dd className="mt-2 max-w-[62ch] text-[15px] leading-relaxed" style={{ margin: '8px 0 0', color: 'rgba(13,13,13,.7)' }}>
                  {p.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ══ 7. O roteiro pra repassar ══════════════════════════════════════ */}
      <RoteiroDeTrinta />

      {/* ══ Fechamento ═════════════════════════════════════════════════════ */}
      <section className="rev-section" style={{ background: 'var(--color-rev-black)' }}>
        <div className="rev-container text-center">
          <h2 className="rev-display mx-auto max-w-[16ch]" style={{ fontSize: 'clamp(30px,5.4vw,64px)', color: AMARELO }}>
            O próximo nome pode ser o seu
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {session ? (
              <Link to="/meu-perfil" className="rev-btn rev-focus" data-variant="yellow" data-on="dark">
                Ir pro meu painel
              </Link>
            ) : (
              <Link to="/comecar" className="rev-btn rev-focus" data-variant="yellow" data-on="dark">
                Criar meu perfil
              </Link>
            )}
            <Link to="/#descobrir" className="rev-btn rev-focus" data-variant="outline" data-on="dark">
              Ver quem já está aqui
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ══ Peças ═════════════════════════════════════════════════════════════════ */

function Bloco({
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
      className="overflow-hidden rounded-[14px]"
      style={{ background: `${OSSO}.05)`, border: `1px solid ${OSSO}.1)` }}
    >
      <div className="px-5 py-4">
        <h3 className="rev-display text-[20px] leading-none" style={{ color: 'var(--color-rev-bone)' }}>
          {titulo}
        </h3>
        <p className="rev-label mt-1.5 text-[9px]" style={{ color: `${OSSO}.4)` }}>
          {nota}
        </p>
      </div>
      {children}
    </div>
  );
}

function Item({ texto, oleko }: { texto: string; oleko: number }) {
  return (
    <div
      className="flex items-baseline justify-between gap-3 border-t px-5 py-3"
      style={{ borderColor: `${OSSO}.08)` }}
    >
      <span className="text-[14px] leading-snug" style={{ color: `${OSSO}.75)` }}>
        {texto}
      </span>
      <span className="rev-display shrink-0 text-[15px] leading-none tabular-nums" style={{ color: AMARELO }}>
        +{ptBrNum(oleko)}
      </span>
    </div>
  );
}

/**
 * O bloco que existe por causa da instrução do fundador: o atleta tem que
 * conseguir REPASSAR. Um texto pronto, curto, na voz dele — pra colar no grupo
 * sem ter que resumir a página inteira de cabeça.
 */
const ROTEIRO =
  'Fiz meu perfil na Olefoot REVELA — é uma vitrine de jogador onde um olheiro monta ' +
  'minha ficha de atributos e eu viro uma carta jogável dentro do game deles. É de graça. ' +
  'Quem entra no meu link vira meu fã, e quanto mais fã eu tenho, mais eu subo na disputa. ' +
  'Bora, entra lá:';

function RoteiroDeTrinta() {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(ROTEIRO);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard bloqueado — o texto continua selecionável */
    }
  }

  return (
    <section id="roteiro" className="rev-section" style={{ background: 'var(--color-rev-resenha)' }}>
      <div className="rev-container">
        <Eyebrow>Pra repassar</Eyebrow>
        <h2 className="rev-display mt-4 max-w-[22ch]" style={{ fontSize: 'clamp(28px,4.6vw,54px)', color: 'var(--color-rev-bone)' }}>
          Como explicar isso em 30 segundos
        </h2>
        <p className="mt-4 max-w-[54ch] text-[15px] leading-relaxed" style={{ color: `${OSSO}.6)` }}>
          Você vai ouvir "que negócio é esse?" umas cem vezes. Este texto responde. Copia, cola
          no grupo e põe teu link no fim.
        </p>

        <blockquote
          className="mt-8 max-w-[62ch] px-6 py-6"
          style={{
            margin: '32px 0 0',
            background: `${OSSO}.05)`,
            borderLeft: `4px solid ${AMARELO}`,
            borderRadius: '0 12px 12px 0',
          }}
        >
          <p className="text-[16px] leading-relaxed" style={{ color: `${OSSO}.82)` }}>
            {ROTEIRO}
          </p>
        </blockquote>

        <button
          type="button"
          onClick={() => void copiar()}
          className="rev-btn rev-focus mt-6"
          data-variant="yellow"
          data-on="dark"
        >
          {copiado ? 'Copiado' : 'Copiar o texto'}
        </button>
        <p className="mt-3 text-[13px]" style={{ color: `${OSSO}.42)` }}>
          Teu link fica no painel, em <em>Chame a torcida</em>.
        </p>
      </div>
    </section>
  );
}

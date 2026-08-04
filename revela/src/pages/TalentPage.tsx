/**
 * O PERFIL DO TALENTO — a peça que fecha o loop de aquisição.
 *
 * O briefing é explícito: o atleta tem que QUERER postar "esse é meu perfil
 * OLEFOOT". Pra isso ele precisa de um endereço próprio — e é isso que faltava:
 * `revela_get_talent(slug)` existia desde a primeira migration e não era chamado
 * por lugar nenhum, porque não havia página.
 *
 * COMO ELA É PENSADA: quem abre este link quase sempre chega de fora, por um
 * print no grupo do WhatsApp, sem saber o que é Olefoot. Então a página responde
 * nesta ordem — quem é, como joga, quanta gente acredita, e só no fim o que é
 * isso aqui. Vender descoberta antes de vender plataforma.
 *
 * As tags de compartilhamento (o que aparece no preview do WhatsApp) NÃO moram
 * aqui: crawler não roda React. Elas são injetadas no edge — ver `revela/worker.ts`.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ATTR_LABEL,
  Eyebrow,
  LegendMark,
  Portrait,
  ehLenda,
  ptBr,
} from '../components/primitives';
import { BotaoCard } from '../components/CardDoAtleta';
import { PostDoInstagram } from '../components/PostDoInstagram';
import { CampoPosicao } from '../components/CampoPosicao';
import { RadarAtributos } from '../components/RadarAtributos';
import { completudePct, computeCompletude } from '../data/completude';
import { TRACOS, arquetipoDe } from '../data/dna';
import { PES, descricaoDaPosicao, nomeDaPosicao } from '../data/posicoes';
import { fetchMySupports, fetchTalent, supportTalent } from '../data/revelaApi';
import { GAME_URL, signupUrl } from '../data/session';
import { embedDoPost, perfilInstagram } from '../data/instagram';
import { computeSelos, selosUnlocked } from '../data/selos';
import type { DnaPublico, Talent } from '../data/types';
import { VIDEO_IFRAME_PROPS, videoEmbedUrl } from '@/lib/videoEmbed';

/** Onde o atleta está nos 7 passos do "Como Funciona". */
const STATUS_STEP: Record<string, number> = {
  pending: 1,
  in_review: 2,
  approved: 4,
  carded: 7,
  rejected: 1,
};

const STATUS_COPY: Record<string, string> = {
  pending: 'Na fila do OLE SCOUT',
  in_review: 'Em avaliação',
  approved: 'Aprovado e na vitrine',
  carded: 'Já virou card jogável',
  rejected: 'Fora da vitrine',
};

/** Ordem de leitura da ficha: ofício primeiro, cabeça depois. */
const ATTR_ORDER = [
  'velocidade',
  'drible',
  'finalizacao',
  'passe',
  'marcacao',
  'fisico',
  'tatico',
  'mentalidade',
  'confianca',
  'fairPlay',
];

export function TalentPage({
  session,
  requireAuth,
  onNote,
}: {
  session: { userId: string } | null;
  requireAuth: (reason: string, aoEntrar?: () => void) => void;
  onNote: (title: string, body?: string, tone?: 'yellow' | 'green') => void;
}) {
  const { slug = '' } = useParams<{ slug: string }>();
  const [talent, setTalent] = useState<Talent | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading');
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setTalent(null);
    window.scrollTo({ top: 0, behavior: 'instant' });

    void fetchTalent(slug).then((t) => {
      if (cancelled) return;
      if (!t) {
        setState('notfound');
        return;
      }
      setTalent(t);
      setState('ready');
    });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // "Já apoiei?" depende da conta, não do talento — por isso é outro efeito.
  useEffect(() => {
    if (!session || !talent) {
      setSupported(false);
      return;
    }
    let cancelled = false;
    void fetchMySupports().then((ids) => {
      if (!cancelled) setSupported(ids.includes(talent.id));
    });
    return () => {
      cancelled = true;
    };
  }, [session, talent]);

  async function apoiar() {
    if (!talent || supported || busy) return;
    setBusy(true);
    const res = await supportTalent(talent.id);
    setBusy(false);

    if (!res.ok) {
      if (res.reason === 'auth_required') {
        requireAuth(`Pra virar fã de ${primeiroNome(talent.name)}, cria tua conta`, () => void apoiar());
        return;
      }
      onNote('Não deu pra registrar o apoio', 'Tenta de novo em instantes.');
      return;
    }

    setSupported(true);
    setTalent((prev) => (prev ? { ...prev, supporters: res.supporters } : prev));
    onNote('Você está na torcida', `${talent.name} avançou no Road to Card.`, 'green');
  }

  if (state === 'loading') {
    return (
      <main className="grid min-h-[70vh] place-items-center">
        <p className="rev-label text-[11px]" style={{ color: 'rgba(237,235,228,.4)' }}>
          Carregando…
        </p>
      </main>
    );
  }

  if (state === 'notfound' || !talent) {
    return (
      <main className="rev-section grid min-h-[70vh] place-items-center text-center">
        <div>
          <Eyebrow>Não encontramos</Eyebrow>
          <h1 className="rev-display mt-5" style={{ fontSize: 'clamp(30px,5vw,54px)' }}>
            Esse perfil não está na vitrine
          </h1>
          <p className="mt-3 text-[14px]" style={{ color: 'rgba(237,235,228,.5)' }}>
            O link pode ter mudado, ou o perfil ainda está na fila do OLE SCOUT.
          </p>
          <Link to="/#descobrir" className="rev-btn rev-focus mt-7" data-variant="yellow" data-on="dark">
            Ver quem está chegando
          </Link>
        </div>
      </main>
    );
  }

  const shareUrl = `${window.location.origin}/t/${talent.slug}`;
  const idade = talent.birthYear ? new Date().getFullYear() - talent.birthYear : null;
  const local = [talent.city, talent.uf].filter(Boolean).join(' · ');
  const lenda = ehLenda(talent.gameSituation);
  const insta = perfilInstagram(talent.instagram);
  const postEmbed = embedDoPost(talent.instagramPost);
  const attrs = ATTR_ORDER.map((k) => ({
    key: k,
    label: ATTR_LABEL[k] ?? k,
    value: Number(talent.attributes?.[k as keyof typeof talent.attributes] ?? 0),
  })).filter((a) => a.value > 0);

  async function compartilhar() {
    if (!talent) return;
    const texto = `${talent.name} — ${talent.pos}${talent.club ? ` do ${talent.club}` : ''}. Descobri esse nome na Olefoot antes de todo mundo.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${talent.name} · Olefoot Revela`, text: texto, url: shareUrl });
        return;
      } catch {
        /* cancelou: cai no clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(`${texto} ${shareUrl}`);
      onNote('Link copiado!', 'Cola no grupo e marca a gente.', 'green');
    } catch {
      onNote('Não deu pra copiar', 'Copia o endereço da barra mesmo.');
    }
  }

  return (
    <main>
      {/* ══ Quem é ══════════════════════════════════════════════════════════ */}
      <section className="rev-section" style={{ background: 'var(--color-rev-yellow)', color: '#0D0D0D' }}>
        <div className="rev-container">
          <Link to="/#descobrir" className="rev-label rev-focus text-[10px]" data-on="yellow" style={{ color: 'rgba(13,13,13,.55)' }}>
            ← Descobrir
          </Link>

          <div className="mt-8 grid items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rev-label inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[10px]"
                  style={{ background: '#0D0D0D', color: 'var(--color-rev-yellow)' }}
                >
                  {/* Ex-atleta não é "Revelação": ele já foi revelado. */}
                  {talent.carded ? 'Card jogável' : lenda ? 'Ex-atleta' : 'Revelação'}
                  {talent.overall != null &&
                    ` · ${talent.overall} ${(talent.ratingSource ?? 'scout') === 'auto' ? 'inicial' : 'OVR'}`}
                </span>
                {lenda && <LegendMark />}
              </div>

              <h1 className="rev-hero-type mt-6" style={{ fontSize: 'clamp(40px,7.5vw,104px)' }}>
                {talent.name}
              </h1>

              <p className="rev-label mt-5 text-[12px]" style={{ color: 'rgba(13,13,13,.62)' }}>
                {/* Por extenso, não a sigla: a manchete é lida por quem chegou de
                    um print no WhatsApp e não sabe o que é "LD". */}
                {[
                  talent.pos ? nomeDaPosicao(talent.pos) : null,
                  talent.club,
                  local,
                  idade ? `${idade} anos` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>

              {/* O número de apoiadores é o coração emocional — corpo de manchete.
                  MAS não quando é zero: esta é a página do próprio atleta, e um
                  "0 pessoas acreditam" em corpo 56 é a primeira coisa que quem
                  chega lê. O vazio vira convite; o número aparece quando existe
                  alguém pra contar. */}
              <div className="mt-9">
                {talent.supporters > 0 ? (
                  <>
                    <p className="rev-display text-[56px] leading-none tabular-nums">{ptBr(talent.supporters)}</p>
                    <p className="rev-label mt-1.5 text-[10px]" style={{ color: 'rgba(13,13,13,.55)' }}>
                      {talent.supporters === 1 ? 'pessoa acredita' : 'pessoas acreditam'}
                    </p>
                  </>
                ) : (
                  <p className="rev-display text-[34px] leading-[.95]" style={{ maxWidth: '14ch' }}>
                    Seja o primeiro a acreditar.
                  </p>
                )}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={apoiar}
                  disabled={supported || busy}
                  className="rev-btn rev-focus"
                  data-on="yellow"
                  style={
                    supported
                      ? { background: 'transparent', color: 'var(--color-rev-success)', borderColor: 'var(--color-rev-success)', cursor: 'default' }
                      : undefined
                  }
                >
                  {supported ? '✓ Você está na torcida' : busy ? 'Registrando…' : 'Sou fã'}
                </button>
                <button type="button" onClick={compartilhar} className="rev-btn rev-focus" data-variant="outline" data-on="yellow">
                  Compartilhar
                </button>
                {/* A arte pronta. Link cru não para o dedo de ninguém no feed —
                    o card sim, e ele carrega o endereço dentro da imagem. */}
                <span data-on="yellow">
                  <BotaoCard
                    dados={{
                      nome: talent.name,
                      posicao: talent.pos ? nomeDaPosicao(talent.pos) : null,
                      overall: talent.overall,
                      arquetipo: talent.dna ? (arquetipoDe(talent.dna.tracos) ?? talent.dna.arquetipo) : null,
                      inicial: (talent.ratingSource ?? 'scout') === 'auto',
                      portrait: talent.portrait,
                      url: shareUrl,
                    }}
                    rotulo="Baixar meu card"
                  />
                </span>
                {/* Some sozinho quando o atleta não preencheu, ou quando o que
                    ele escreveu não vira um @ plausível. Botão que leva a perfil
                    inexistente queima a confiança de quem clicou. */}
                {insta && (
                  <a
                    href={insta.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rev-btn rev-focus"
                    data-variant="outline"
                    data-on="yellow"
                  >
                    Seguir {insta.handle}
                  </a>
                )}
              </div>
            </div>

            <div className="mx-auto w-full max-w-[340px]">
              <article className="rev-poster" style={{ borderRadius: 'var(--radius-rev-card-lg)' }}>
                <Portrait src={talent.portrait} alt={talent.name} ratio="4 / 5" width={360} priority />
                <div
                  className="rev-rail absolute inset-x-3 bottom-3 px-3.5 py-2.5"
                  /* SEM `backdrop-filter`. No Safari do iPhone, elemento com
                     blur dentro de container que rola é pintado fora do lugar —
                     esta plaquinha apareceu flutuando POR CIMA do vídeo, que
                     está a mil pixels dali. O fundo já era 90% opaco: o blur não
                     acrescentava nada que valesse o risco. */
                  style={{ background: 'rgba(13,13,13,.94)', borderRadius: 6 }}
                >
                  <p className="rev-display text-[20px] leading-none" style={{ color: 'var(--color-rev-bone)' }}>
                    {talent.name}
                  </p>
                  <p className="rev-label mt-1 text-[10px]" style={{ color: 'rgba(237,235,228,.55)' }}>
                    {[talent.pos, talent.club].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      {/* ══ Como joga ═══════════════════════════════════════════════════════
          A LARGURA INTEIRA É DE PROPÓSITO. Antes isto era duas colunas: dez
          barrinhas de 5px espremidas em metade da tela de um lado, e o vídeo
          enfiado embaixo da biografia do outro. Lia-se como painel de ajustes,
          não como ficha de scout — e a única prova de que o moleque joga bola
          era a peça menor da página.
          Agora a ordem é a de um portfólio: primeiro ele JOGANDO, do lado o
          resumo que decide (OVR, posição, pontos fortes), embaixo a ficha
          inteira em números grandes. Texto — história, progresso, selos — vai
          por último, porque é o que menos convence em dez segundos. */}
      <section className="rev-section" style={{ background: 'var(--color-rev-black)' }}>
        <div className="rev-container">
          <Eyebrow>Como joga</Eyebrow>
          <h2
            className="rev-display mt-4"
            style={{ fontSize: 'clamp(30px,5vw,60px)', color: 'var(--color-rev-yellow)' }}
          >
            A ficha
          </h2>

          {/* ── O vídeo e o resumo, lado a lado ─────────────────────────────
              O vídeo manda: 1.6fr contra 1fr. No celular ele vem primeiro e
              ocupa tudo. */}
          <div className="mt-9 grid items-start gap-6 lg:grid-cols-[1.42fr_1fr]">
            {/* `cobrar`: só quem ainda não virou card ouve "falta pra convencer".
                Pra quem já tem carta lançada — e pros ex-atletas — a frase
                depreciaria uma ficha que já está fechada. */}
            <VerJogando url={talent.video} cobrar={!talent.carded} />
            <ResumoFicha talent={talent} attrs={attrs} />
          </div>

          {/* ── A ficha: forma de um lado, número do outro ───────────────────
              Dois atletas de OVR 79 são a mesma linha numa tabela e são
              jogadores completamente diferentes. O radar resolve isso sem
              ninguém ler nada; os tiles ao lado dão a precisão que a forma não
              dá. Um não substitui o outro — eles fazem trabalhos diferentes. */}
          {attrs.length > 0 ? (
            <>
              <div className="mt-12 grid items-center gap-8 lg:grid-cols-[1fr_1.35fr]">
                <div className="mx-auto w-full max-w-[430px]">
                  <RadarAtributos eixos={attrs} />
                  {/* A legenda só faz sentido com os dez eixos: é a ordem de
                      ATTR_ORDER que joga o ofício na direita e a cabeça na
                      esquerda. Com a ficha pela metade, a leitura seria falsa. */}
                  {attrs.length === 10 && (
                    <p
                      className="rev-label mt-1 text-center text-[9px]"
                      style={{ color: 'rgba(237,235,228,.34)' }}
                    >
                      Direita: o ofício · Esquerda: a cabeça
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {attrs.map((a) => (
                    <AtributoTile key={a.key} label={a.label} value={a.value} />
                  ))}
                </div>
              </div>
              <p className="mt-7 text-[13px]" style={{ color: 'rgba(237,235,228,.42)' }}>
                {(talent.ratingSource ?? 'scout') === 'auto'
                  ? 'Ficha inicial, montada do cadastro e do Player DNA. Já vale no game — e muda quando o OLE SCOUT revisar.'
                  : 'Ficha montada pelo OLE SCOUT — a mesma que ele leva pro campo dentro do game.'}
              </p>
            </>
          ) : (
            <p
              className="mt-12 px-6 py-6 text-center text-[14px] leading-relaxed"
              style={{
                color: 'rgba(237,235,228,.5)',
                border: '2px dashed rgba(237,235,228,.2)',
                borderRadius: 'var(--radius-rev-card)',
              }}
            >
              A ficha ainda está sendo montada pelo OLE SCOUT. Assim que sair, aparece aqui.
            </p>
          )}

          {/* ── Como ele pensa ──────────────────────────────────────────────
              Some inteiro pra quem não fez o teste. Não entra placeholder aqui:
              a moldura vazia do vídeo cobra porque vídeo é a prova que falta
              pra ficha; DNA é camada nova, e cobrar de todo mundo que ainda não
              respondeu encheria a vitrine inteira de buraco no dia 1. */}
          {talent.dna && <DnaBlock dna={talent.dna} />}

          {/* ── O post que ele escolheu ─────────────────────────────────────
              CURADORIA, NÃO FEED. Não existe endpoint que liste os posts de uma
              conta pública, e puxar feed exigiria OAuth + App Review da Meta.
              Mas o post escolhido é melhor mesmo tendo o feed disponível: numa
              página que mostra menor de idade, "o que ele quis mostrar" e "o que
              ele postou ontem" são coisas muito diferentes. */}
          {postEmbed && (
            <div className="mt-16">
              <Eyebrow>O lance que ele escolheu</Eyebrow>
              <div className="mt-5 max-w-[540px]">
                <PostDoInstagram embed={postEmbed} titulo={`Post de ${talent.name} no Instagram`} />
              </div>
            </div>
          )}

          {/* ── História, progresso e selos ─────────────────────────────────── */}
          <div className="mt-16 grid gap-12 lg:grid-cols-2">
            <div>
              {/* SONHO E HISTÓRIA SÃO COISAS DIFERENTES, e por um tempo não
                  foram: o cadastro gravava o sonho na coluna `bio`, e a página
                  publicava "A história: Jogar na Seleção Brasileira". Agora cada
                  um no seu título — e os dois aparecem quando os dois existem. */}
              {talent.bio && (
                <>
                  <Eyebrow>A história</Eyebrow>
                  <p className="mt-5 text-[16px] leading-relaxed" style={{ color: 'rgba(237,235,228,.66)' }}>
                    {talent.bio}
                  </p>
                </>
              )}
              {talent.dream && (
                <div className={talent.bio ? 'mt-8' : ''}>
                  <Eyebrow>O sonho</Eyebrow>
                  <p
                    className="rev-display mt-4 max-w-[20ch]"
                    style={{ fontSize: 'clamp(22px,3vw,34px)', lineHeight: 1.05, color: 'var(--color-rev-bone)' }}
                  >
                    {talent.dream}
                  </p>
                </div>
              )}
            </div>

            <div>
              {/* Road to Card: progresso de carreira, não pendência de checkout. */}
              <div className="flex items-baseline justify-between gap-3">
                <span className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.5)' }}>
                  Road to card
                </span>
                <span className="rev-label text-[10px]" style={{ color: 'var(--color-rev-yellow)' }}>
                  {STATUS_COPY[talent.status] ?? talent.status}
                </span>
              </div>
              <div className="mt-2.5 flex gap-1">
                {Array.from({ length: 7 }, (_, i) => (
                  <span
                    key={i}
                    className="h-2 flex-1 rounded-sm"
                    style={{
                      background:
                        i < (STATUS_STEP[talent.status] ?? 0) ? 'var(--color-rev-yellow)' : 'rgba(255,255,255,.12)',
                    }}
                  />
                ))}
              </div>

              {/* Duas naturezas, dois blocos. O de cima ele resolve hoje,
                  sozinho; o de baixo depende de olheiro e de torcida. Juntos,
                  davam um contador que dizia "você falhou" pra quem tinha feito
                  a parte dele inteira. */}
              <CompletudeBlock talent={talent} />
              <SelosBlock talent={talent} />
            </div>
          </div>
        </div>
      </section>

      {/* ══ O que é isso ════════════════════════════════════════════════════ */}
      <section className="rev-section" style={{ background: 'var(--color-rev-yellow)', color: '#0D0D0D' }}>
        <div className="rev-container text-center">
          <h2 className="rev-display mx-auto max-w-[16ch]" style={{ fontSize: 'clamp(30px,5vw,64px)' }}>
            {supported ? 'Agora acompanhe de perto.' : 'Descobriu antes de todo mundo?'}
          </h2>
          <p className="rev-label mx-auto mt-5 max-w-[46ch] text-[12px]" style={{ color: 'rgba(13,13,13,.6)' }}>
            {supported
              ? 'Entra no game e escala ele no teu time.'
              : 'A Olefoot revela talentos do futebol brasileiro e transforma carreira em carta jogável.'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={GAME_URL} className="rev-btn rev-focus">
              Entrar no game
            </a>
            <a href={signupUrl()} className="rev-btn rev-focus" data-variant="outline">
              Criar meu perfil de jogador
            </a>
          </div>
          <p className="mt-6 text-[13px]" style={{ color: 'rgba(13,13,13,.5)' }}>
            É de graça. O próximo nome pode ser o seu.
          </p>
        </div>
      </section>
    </main>
  );
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/**
 * VER JOGANDO — o vídeo do atleta, e o buraco que ele deixa quando não existe.
 *
 * Antes era só um link "Ver jogando →" perdido embaixo da biografia. Num perfil
 * que precisa convencer em dez segundos, mandar a pessoa embora do site pra ver
 * a única prova de que o moleque joga bola é jogar fora a visita.
 *
 * TRÊS CAMINHOS, e os três importam:
 *
 *  1. YouTube ou Vimeo → toca aqui dentro, no tamanho que merece.
 *  2. Outro host (Drive, Instagram, link torto) → botão. `videoEmbedUrl` só
 *     devolve endereço pra host conhecido, e monta o `src` do ID extraído —
 *     nunca da string crua que o atleta digitou no onboarding.
 *  3. Vazio → a moldura APARECE assim mesmo, pontilhada. É o buraco mais caro
 *     do portfólio: some ele e a página mente por omissão, dizendo que está
 *     completa. Aberto, o vazio cobra — do atleta, que vê o que falta; e do
 *     visitante, que entende que aqui é lugar de ver jogar.
 */
function VerJogando({ url, cobrar }: { url: string | null; cobrar: boolean }) {
  const embed = url ? videoEmbedUrl(url) : null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>Ver jogando</Eyebrow>
        {url && !embed && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="rev-label rev-focus text-[10px]"
            style={{ color: 'var(--color-rev-yellow)' }}
          >
            Abrir vídeo →
          </a>
        )}
      </div>

      <div
        className="mt-4 grid overflow-hidden"
        style={{
          aspectRatio: '16 / 9',
          borderRadius: 'var(--radius-rev-card)',
          border: embed ? '1px solid rgba(237,235,228,.12)' : '2px dashed rgba(237,235,228,.18)',
          background: embed ? 'transparent' : 'var(--color-rev-surface)',
          placeItems: 'center',
        }}
      >
        {embed ? (
          <iframe
            {...VIDEO_IFRAME_PROPS}
            src={embed}
            title="Vídeo do atleta"
            className="h-full w-full"
            style={{ display: 'block', border: 0 }}
          />
        ) : (
          <div className="px-6 text-center">
            <p className="rev-display text-[22px] leading-tight" style={{ color: 'rgba(237,235,228,.5)' }}>
              {url ? 'O vídeo está fora do site' : 'Ainda sem vídeo'}
            </p>
            <p className="mt-2 text-[13px]" style={{ color: 'rgba(237,235,228,.35)' }}>
              {url
                ? 'Link de YouTube ou Vimeo toca aqui dentro.'
                : cobrar
                  ? 'É a peça que falta pra ficha convencer.'
                  : 'Assim que subir, toca aqui.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * O RESUMO — o que um olheiro lê antes de decidir se assiste ao vídeo inteiro.
 *
 * OVR gigante porque é o número que a pessoa procura, o CAMPO porque "LD" não
 * diz nada pra quem não é do meio e "Lateral-direito" só diz um pouco mais — um
 * ponto aceso resolve em meio segundo. E os três atributos mais altos porque
 * ficha de dez linhas não tem hierarquia: sem destaque, o leitor não sabe se ele
 * é rápido ou se ele marca.
 */
function ResumoFicha({
  talent,
  attrs,
}: {
  talent: Talent;
  attrs: { key: string; label: string; value: number }[];
}) {
  const fortes = [...attrs].sort((a, b) => b.value - a.value).slice(0, 3);
  // Ausência = ficha antiga, e aquelas foram avaliadas por gente de verdade.
  const auto = (talent.ratingSource ?? 'scout') === 'auto';
  const pe = PES.find((p) => p.code === talent.strongFoot)?.nome ?? null;
  const idade = talent.birthYear ? new Date().getFullYear() - talent.birthYear : null;

  const linhas: { rotulo: string; valor: string }[] = [
    ...(pe ? [{ rotulo: 'Pé dominante', valor: pe }] : []),
    ...(idade ? [{ rotulo: 'Idade', valor: `${idade} anos` }] : []),
    ...(talent.club ? [{ rotulo: 'Clube', valor: talent.club }] : []),
  ];

  return (
    <div
      className="px-6 py-6"
      style={{
        background: 'var(--color-rev-surface)',
        border: '1px solid rgba(237,235,228,.09)',
        borderRadius: 'var(--radius-rev-card)',
      }}
    >
      {/* ── O campo e o número, lado a lado ─────────────────────────────────
          O campo é estreito de propósito (uma coluna de 108px): ele existe pra
          ser LIDO de relance, não pra ser estudado. Quem quer detalhe tem a
          ficha inteira logo abaixo. */}
      <div className="flex items-start gap-5">
        <div className="shrink-0" style={{ width: 'clamp(112px, 34%, 152px)' }}>
          <CampoPosicao pos={talent.pos} />
        </div>

        <div className="min-w-0 flex-1">
          {talent.overall != null && (
            <>
              <div className="flex items-end gap-2.5">
                <span
                  className="rev-display tabular-nums"
                  style={{ fontSize: 56, lineHeight: 0.82, color: auto ? 'var(--color-rev-bone)' : 'var(--color-rev-yellow)' }}
                >
                  {talent.overall}
                </span>
                <span className="rev-label pb-1 text-[10px]" style={{ color: 'rgba(237,235,228,.45)' }}>
                  {auto ? 'Ficha inicial' : 'Overall'}
                </span>
              </div>
              {/* AMARELO É DO OLHEIRO. A ficha automática sai em osso, e o
                  rótulo troca de palavra: dois atletas de 62 não podem parecer
                  a mesma coisa quando um foi avaliado e o outro se declarou. */}
              {auto && (
                <p className="mt-2 text-[12px] leading-snug" style={{ color: 'rgba(237,235,228,.38)' }}>
                  Gerada do cadastro e do Player DNA. O OLE SCOUT ainda vai revisar.
                </p>
              )}
            </>
          )}
          <p
            className="rev-display mt-4 text-[19px] leading-none"
            style={{ color: 'var(--color-rev-bone)' }}
          >
            {talent.pos ? nomeDaPosicao(talent.pos) : 'Posição a definir'}
          </p>
          {talent.pos && (
            <p className="mt-1.5 text-[13px] leading-snug" style={{ color: 'rgba(237,235,228,.42)' }}>
              {descricaoDaPosicao(talent.pos)}
            </p>
          )}
        </div>
      </div>

      {/* Nada é obrigatório no cadastro: cada linha aqui só existe se ele
          preencheu. A lista inteira some quando não preencheu nenhuma — melhor
          um bloco a menos que uma fileira de travessões. */}
      {linhas.length > 0 && (
        <dl className="mt-6 flex flex-col gap-2.5">
          {linhas.map((l) => (
            <div key={l.rotulo} className="flex items-baseline justify-between gap-3">
              <dt className="rev-label shrink-0 text-[9px]" style={{ color: 'rgba(237,235,228,.4)' }}>
                {l.rotulo}
              </dt>
              <dd className="text-right text-[14px] font-semibold" style={{ color: 'var(--color-rev-bone)' }}>
                {l.valor}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {fortes.length > 0 && (
        <div className="mt-6 border-t pt-5" style={{ borderColor: 'rgba(237,235,228,.1)' }}>
          <span className="rev-label text-[9px]" style={{ color: 'rgba(237,235,228,.4)' }}>
            Pontos fortes
          </span>
          <div className="mt-3 flex flex-col gap-2">
            {fortes.map((f) => (
              <div key={f.key} className="flex items-baseline justify-between gap-3">
                <span className="text-[14px]" style={{ color: 'rgba(237,235,228,.72)' }}>
                  {f.label}
                </span>
                <span
                  className="rev-display text-[18px] leading-none tabular-nums"
                  style={{ color: 'var(--color-rev-yellow)' }}
                >
                  {f.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * UM ATRIBUTO — número grande primeiro, nome depois.
 *
 * A barra de 5px com rótulo de 78px que existia antes obrigava a LER pra
 * comparar. Aqui o número é a peça: bate o olho, sabe. A barra continua embaixo
 * porque 84 num campo de 0–99 só significa alguma coisa quando você vê o quanto
 * dele está preenchido.
 *
 * A cor é a faixa, não decoração: amarelo é destaque de verdade (80+), osso é
 * bom (70–79), osso apagado é o resto. Sem verde/vermelho de planilha — a página
 * é de divulgação do atleta, não é laudo.
 */
function AtributoTile({ label, value }: { label: string; value: number }) {
  const cor =
    value >= 80 ? 'var(--color-rev-yellow)' : value >= 70 ? 'var(--color-rev-bone)' : 'rgba(237,235,228,.45)';

  return (
    <div
      className="flex items-center gap-3.5 px-4 py-3"
      style={{
        background: 'var(--color-rev-surface)',
        border: '1px solid rgba(237,235,228,.09)',
        borderRadius: 12,
      }}
    >
      <span
        className="rev-display shrink-0 text-right tabular-nums"
        style={{ fontSize: 32, lineHeight: 0.85, color: cor, width: 46 }}
      >
        {value}
      </span>
      <div className="min-w-0 flex-1">
        <p className="rev-label text-[9px]" style={{ color: 'rgba(237,235,228,.42)' }}>
          {label}
        </p>
        <div className="mt-2 h-[3px] overflow-hidden rounded-full" style={{ background: 'rgba(237,235,228,.1)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(0, Math.min(100, value))}%`,
              background: cor,
              transition: 'width .8s var(--ease-rev)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * PLAYER DNA — como ele pensa.
 *
 * Fica DEPOIS da ficha e ANTES da história, e essa posição é o argumento: o
 * olheiro já viu como ele joga e ainda não leu nada. "Líder Construtor" é o que
 * faz ele parar — é a informação que nenhum número de OVR dá.
 *
 * Os traços saem em ordem decrescente, não na ordem fixa da lista: quem abre a
 * página tem que ver primeiro o que esse atleta TEM, não percorrer sete linhas
 * até achar. E não tem semáforo: DNA não é bom nem ruim, é preferência.
 */
function DnaBlock({ dna }: { dna: DnaPublico }) {
  const ordenados = TRACOS.map((t) => ({ t, v: Number(dna.tracos?.[t.id] ?? 0) })).sort(
    (a, b) => b.v - a.v,
  );
  // Derivado dos traços, com o gravado como rede: assim trocar uma palavra do
  // catálogo atualiza quem já respondeu, sem ninguém refazer o teste.
  const nome = arquetipoDe(dna.tracos) ?? dna.arquetipo;

  return (
    <div className="mt-16">
      <Eyebrow>Como ele pensa</Eyebrow>
      <div className="mt-5 grid items-start gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h3
            className="rev-display"
            style={{ fontSize: 'clamp(30px,4.6vw,54px)', lineHeight: 0.95, color: 'var(--color-rev-yellow)' }}
          >
            {nome}
          </h3>
          <p className="mt-4 max-w-[36ch] text-[14px] leading-relaxed" style={{ color: 'rgba(237,235,228,.45)' }}>
            Resultado de 13 situações de jogo. Não é nota de bom ou ruim — é o jeito dele
            de resolver.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          {ordenados.map(({ t, v }) => (
            <div key={t.id} className="grid grid-cols-[112px_1fr_30px] items-center gap-3">
              <span className="rev-label text-[9px]" style={{ color: 'rgba(237,235,228,.45)' }}>
                {t.nome}
              </span>
              <span className="h-[5px] overflow-hidden rounded-full" style={{ background: 'rgba(237,235,228,.1)' }}>
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, v))}%`,
                    background: 'var(--color-rev-yellow)',
                    transition: 'width .9s var(--ease-rev)',
                  }}
                />
              </span>
              <span
                className="rev-display text-right text-[14px] tabular-nums"
                style={{ color: 'var(--color-rev-bone)' }}
              >
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * PERFIL COMPLETO — o que o atleta resolve hoje, sozinho.
 *
 * A regra do produto é não obrigar ninguém a preencher nada: quem trava o
 * cadastro perde o moleque na terceira pergunta. O que existe é RECOMPENSA —
 * cada campo preenchido acende um item aqui e deixa a página mais forte.
 *
 * Por isso a barra é de conquista e não de pendência: ela conta o que ele já
 * fez. E os itens que faltam aparecem apagados com o rótulo, não com um "erro" —
 * a página de um atleta não é um formulário reprovado.
 */
function CompletudeBlock({ talent }: { talent: Talent }) {
  const itens = computeCompletude(talent);
  const feitos = itens.filter((i) => i.feito).length;
  const pct = completudePct(itens);

  return (
    <div className="mt-10">
      <div className="flex items-baseline justify-between gap-3">
        <span className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.5)' }}>
          Perfil completo
        </span>
        <span className="rev-label text-[10px]" style={{ color: 'var(--color-rev-yellow)' }}>
          {feitos} de {itens.length}
        </span>
      </div>

      <div className="mt-2.5 h-2 overflow-hidden rounded-sm" style={{ background: 'rgba(255,255,255,.12)' }}>
        <div
          className="h-full rounded-sm"
          style={{
            width: `${pct}%`,
            background: 'var(--color-rev-yellow)',
            transition: 'width .8s var(--ease-rev)',
          }}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {itens.map((i) => (
          <span
            key={i.id}
            title={i.feito ? i.label : i.comoFazer}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold"
            style={
              i.feito
                ? { background: 'rgba(253,225,0,.12)', color: 'var(--color-rev-yellow)', border: '1px solid rgba(253,225,0,.45)' }
                : { background: 'transparent', color: 'rgba(237,235,228,.32)', border: '1px dashed rgba(237,235,228,.18)' }
            }
          >
            {i.feito && <span aria-hidden>✓</span>}
            {i.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * SELOS DE CRAQUE — o que o MUNDO devolve. Desbloqueado brilha (prova social pra
 * quem visita); bloqueado fica fosco com a meta ("faltam X fãs"), o que puxa o
 * talento a completar a estante.
 */
function SelosBlock({ talent }: { talent: Talent }) {
  const selos = computeSelos(talent);
  const feitos = selosUnlocked(selos);
  return (
    <div className="mt-10">
      <div className="flex items-baseline justify-between gap-3">
        <span className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.5)' }}>
          Selos de craque
        </span>
        <span className="rev-label text-[10px]" style={{ color: 'var(--color-rev-yellow)' }}>
          {feitos} de {selos.length}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {selos.map((s) => (
          <span
            key={s.id}
            title={s.unlocked ? s.label : s.hint}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold"
            style={
              s.unlocked
                ? { background: 'rgba(253,225,0,.12)', color: 'var(--color-rev-yellow)', border: '1px solid rgba(253,225,0,.45)' }
                : { background: 'transparent', color: 'rgba(237,235,228,.32)', border: '1px solid rgba(237,235,228,.14)' }
            }
          >
            <span style={{ filter: s.unlocked ? 'none' : 'grayscale(1) opacity(.5)' }}>{s.icon}</span>
            {s.label}
            {!s.unlocked && <span aria-hidden style={{ opacity: 0.6 }}>🔒</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

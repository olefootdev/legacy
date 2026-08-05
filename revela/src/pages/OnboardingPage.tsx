/**
 * CRIE SEU PERFIL DE JOGO — o passo 1 dos 7.
 *
 * POR QUE TEM ENDEREÇO PRÓPRIO: o formulário morava no rodapé da home, e quem
 * clicava em "criar perfil" caía no fim de tudo, num paredão de campos, sem
 * entender que aquilo abria uma jornada. Decisão do fundador (2026-07-23).
 *
 * ⚠️ NÃO PEDE LOGIN. Antes o envio exigia conta e o botão dizia "Entrar e
 * enviar" — o fundador topou com isso testando e apontou: enviar tem que
 * enviar. Agora o RPC aceita anônimo (migration 20260723210000) e a conta vem
 * na aprovação. O que segura repetição é o WhatsApp, único por cadastro, e por
 * isso ele é o único contato obrigatório.
 *
 * ⚠️ MENOR DE IDADE: quando o ano de nascimento indica menos de 18, a tela
 * abre os campos do responsável e trava sem eles. O servidor repete a mesma
 * checagem — tela pode ser contornada, e aqui o assunto é proteção de menor
 * (LGPD art. 14).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eyebrow } from '../components/primitives';
import { Field } from '../components/AuthSheet';
import { categoriaCabeNaIdade, categoriasPara } from '../data/categoria';
import { PES, SETORES, SITUACOES } from '../data/posicoes';
import { checkHandle, submitTalent, type HandleStatus, type SubmitFailure } from '../data/revelaApi';
import { Turnstile, turnstileAtivo } from '../components/Turnstile';
import {
  readReferral,
  savePendingTalent,
  readPendingTalent,
  clearPendingTalent,
  type PendingTalent,
} from '../data/session';
import { uploadFotoTalento } from '../data/upload';
import { ContaDoAtleta } from '../components/ContaDoAtleta';

const JORNADA = [
  'Criação de perfil',
  'Validação de conta',
  'Revisão pelo OLE SCOUT',
  'Divulgação na plataforma',
  'Criação do card digital',
  'Compartilhar com os amigos',
  'Bem-vindo ao time',
];

const FALHA: Record<SubmitFailure, string> = {
  invalid_name: 'Escreve teu nome completo.',
  invalid_pos: 'Escolhe a posição em que você joga.',
  invalid_phone: 'Confere o WhatsApp — precisa do DDD.',
  handle_invalid: 'Escolhe um nome de usuário válido (3–20, letras, números e _).',
  handle_taken: 'Esse nome de usuário já foi pego. Escolhe outro.',
  guardian_required: 'Menor de 18 precisa do nome e do telefone do responsável.',
  already_submitted: 'Já existe um cadastro com esse WhatsApp.',
  // A regra é uma conta, uma ficha. Quem já tem perfil e quer outro precisa
  // sair da conta — e o texto diz isso, em vez de deixar a pessoa adivinhando.
  account_has_talent: 'Essa conta já tem um perfil de jogador. Sai da conta pra cadastrar outro.',
  offline: 'Não deu pra enviar agora. Tenta de novo em instantes.',
};

/** Normaliza o @ enquanto o jogador digita: minúsculo, só a-z 0-9 _, até 20. */
export function normalizeHandle(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
}

interface Ficha {
  apelido: string;
  handle: string;
  nome: string;
  categoria: string;
  pos: string;
  pe: string;
  ano: string;
  altura: string;
  respNome: string;
  respTel: string;
  situacao: string;
  temAgente: '' | 'sim' | 'nao';
  agente: string;
  clube: string;
  cidade: string;
  uf: string;
  sonho: string;
  video: string;
  instagram: string;
  tiktok: string;
  telefone: string;
}

const VAZIA: Ficha = {
  apelido: '', handle: '', nome: '', categoria: '', pos: '', pe: '', ano: '', altura: '',
  respNome: '', respTel: '', situacao: '', temAgente: '', agente: '',
  clube: '', cidade: '', uf: '', sonho: '', video: '', instagram: '', tiktok: '',
  telefone: '',
};

export function OnboardingPage({
  session,
  onNote,
}: {
  /**
   * Sessão aberta = a ficha vai nascer com dono (o RPC grava `auth.uid()` no
   * INSERT). É o que decide se a tela de sucesso pede conta ou não.
   */
  session: { userId: string } | null;
  onNote: (title: string, body?: string, tone?: 'yellow' | 'green') => void;
}) {
  const [tela, setTela] = useState(0);
  const [f, setF] = useState<Ficha>(VAZIA);
  const [foto, setFoto] = useState<{ url: string; preview: string } | null>(null);
  const [subindoFoto, setSubindoFoto] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Token do desafio anti-bot. `null` = ainda não resolvido ou expirou. */
  const [desafio, setDesafio] = useState<string | null>(null);
  // Estável: o widget se recria se a callback mudar de identidade a cada render.
  const receberDesafio = useCallback((t: string | null) => setDesafio(t), []);
  const [erro, setErro] = useState<string | null>(null);
  // Init preguiçoso do cadastro pendente: um refresh na tela de sucesso (ou o
  // fluxo de confirmar e-mail) volta direto pro claim em vez de perder o id.
  const [enviado, setEnviado] = useState<PendingTalent | null>(() => readPendingTalent());
  // Disponibilidade do @username, confirmada em tempo real (debounced).
  const [handleStatus, setHandleStatus] = useState<HandleStatus | 'checking' | 'empty'>('empty');

  const set = (k: keyof Ficha) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  // Confirma o @ enquanto digita: cedo o "muito curto", depois checa unicidade
  // no servidor. `cancelled` descarta resposta velha se o handle mudou no meio.
  useEffect(() => {
    const h = f.handle;
    if (h.length === 0) return setHandleStatus('empty');
    if (h.length < 3) return setHandleStatus('invalid');
    setHandleStatus('checking');
    let cancelled = false;
    const timer = setTimeout(() => {
      void checkHandle(h).then((s) => {
        if (!cancelled) setHandleStatus(s);
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [f.handle]);

  const idade = f.ano.length === 4 ? new Date().getFullYear() - Number(f.ano) : null;
  // Menor = QUALQUER idade < 18 (igual ao servidor, que exige responsável pra
  // todo < 18). Antes o `> 5` deixava criança/ano-futuro passar sem o bloco do
  // responsável e o servidor recusava — beco sem saída.
  const menorDeIdade = idade != null && idade < 18;
  // Ano fora de faixa sã (futuro, ou idade absurda) não deixa avançar.
  const anoInvalido = idade != null && (idade < 4 || idade > 80);
  const telDigitos = f.telefone.replace(/\D/g, '');
  const respTelDigitos = f.respTel.replace(/\D/g, '');

  const podeAvancar = useMemo(() => {
    if (tela === 0) {
      if (f.nome.trim().length < 3 || f.pos === '') return false;
      // @username OBRIGATÓRIO e confirmado disponível pra passar daqui.
      if (handleStatus !== 'ok') return false;
      if (anoInvalido) return false;
      // Categoria que não cabe na idade trava aqui. Ela pode ficar incoerente
      // sem ninguém mexer nela: o atleta escolhe a categoria, depois corrige o
      // ano de nascimento, e a escolha antiga fica pra trás.
      if (f.categoria && !categoriaCabeNaIdade(f.categoria, idade)) return false;
      // Sem responsável, menor de idade não passa daqui.
      if (menorDeIdade && (f.respNome.trim().length < 3 || respTelDigitos.length < 10)) return false;
      return true;
    }
    if (tela === 1) {
      // Se disse que tem empresário, precisa dizer quem.
      return f.temAgente !== 'sim' || f.agente.trim().length >= 2;
    }
    return telDigitos.length >= 10;
  }, [tela, f.nome, f.pos, f.temAgente, f.agente, handleStatus, menorDeIdade, anoInvalido, f.categoria, idade, f.respNome, respTelDigitos, telDigitos]);

  async function escolherFoto(file: File) {
    setSubindoFoto(true);
    setErro(null);
    const preview = URL.createObjectURL(file);
    const res = await uploadFotoTalento(file);
    setSubindoFoto(false);
    if (!res.ok || !res.url) {
      URL.revokeObjectURL(preview);
      setErro(res.motivo ?? 'Não deu pra subir a foto.');
      return;
    }
    setFoto({ url: res.url, preview });
  }

  async function enviar() {
    if (busy) return;
    setBusy(true);
    setErro(null);

    const res = await submitTalent({
      name: f.nome.trim(),
      pos: f.pos,
      contactPhone: telDigitos,
      handle: f.handle,
      nickname: f.apelido.trim() || undefined,
      category: f.categoria || undefined,
      strongFoot: f.pe || undefined,
      birthYear: f.ano.length === 4 ? Number(f.ano) : undefined,
      heightCm: f.altura ? Number(f.altura) : undefined,
      guardianName: menorDeIdade ? f.respNome.trim() : undefined,
      guardianPhone: menorDeIdade ? respTelDigitos : undefined,
      gameSituation: f.situacao || undefined,
      hasAgent: f.temAgente === '' ? undefined : f.temAgente === 'sim',
      agentName: f.temAgente === 'sim' ? f.agente.trim() : undefined,
      club: f.clube.trim() || undefined,
      city: f.cidade.trim() || undefined,
      uf: f.uf.trim() || undefined,
      dream: f.sonho.trim() || undefined,
      videoUrl: f.video.trim() || undefined,
      instagramUrl: f.instagram.trim() || undefined,
      tiktokUrl: f.tiktok.trim() || undefined,
      photoUrl: foto?.url,
      referralCode: readReferral() ?? undefined,
      turnstileToken: desafio ?? undefined,
    });

    setBusy(false);
    if (res.ok && res.slug && res.id) {
      const pend: PendingTalent = {
        id: res.id,
        slug: res.slug,
        phone: telDigitos,
        apelido: f.apelido.trim() || f.nome.trim(),
        // Havia sessão no envio? Então o RPC já gravou o dono e não existe
        // claim a fazer. Guardado junto pra sobreviver ao refresh.
        jaEraDono: Boolean(session),
      };
      savePendingTalent(pend); // sobrevive a refresh / confirmar e-mail
      setEnviado(pend);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      onNote('Cadastro enviado', 'O OLE SCOUT vai analisar.', 'green');
      return;
    }
    setErro(FALHA[res.reason ?? 'offline']);
  }

  if (enviado) {
    // apelido/telefone vêm do cadastro PERSISTIDO — não do form (que o refresh
    // zera). É o que faz o claim sobreviver a um F5 na tela de sucesso.
    return (
      <Enviado
        apelido={enviado.apelido || 'Craque'}
        talentId={enviado.id}
        telefone={enviado.phone}
        jaEraDono={enviado.jaEraDono ?? false}
        onNote={onNote}
      />
    );
  }

  return (
    <main>
      <section className="rev-section" style={{ background: 'var(--color-rev-black)' }}>
        <div className="rev-container" style={{ maxWidth: 880 }}>
          <Link to="/" className="rev-label rev-focus text-[10px]" style={{ color: 'rgba(237,235,228,.45)' }}>
            ← Voltar
          </Link>

          <header className="mt-8">
            <Eyebrow>Passo 1 de 7</Eyebrow>
            <h1
              className="rev-display mt-4"
              style={{ fontSize: 'clamp(34px,6vw,76px)', color: 'var(--color-rev-yellow)' }}
            >
              Crie seu
              <br />
              perfil de jogo
            </h1>
            <p className="mt-5 max-w-[52ch] text-[16px] leading-relaxed" style={{ color: 'rgba(237,235,228,.6)' }}>
              Compartilhe as suas informações e nosso OLE SCOUT monta sua ficha de
              atributos, colocando você na vitrine.
            </p>
          </header>

          <div className="mt-10 flex items-center gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-1 items-center gap-3">
                <span
                  className="rev-label grid shrink-0 place-items-center text-[11px]"
                  style={{
                    width: 30, height: 30, borderRadius: 999,
                    background: i <= tela ? 'var(--color-rev-yellow)' : 'transparent',
                    border: i <= tela ? 'none' : '2px solid rgba(237,235,228,.22)',
                    color: i <= tela ? '#0D0D0D' : 'rgba(237,235,228,.4)',
                  }}
                >
                  {i < tela ? '✓' : i + 1}
                </span>
                {i < 2 && (
                  <span
                    className="h-[2px] flex-1"
                    style={{ background: i < tela ? 'var(--color-rev-yellow)' : 'rgba(237,235,228,.14)' }}
                  />
                )}
              </div>
            ))}
          </div>

          <div
            className="mt-8"
            style={{
              background: 'var(--color-rev-surface)',
              border: '2px solid rgba(253,225,0,.16)',
              borderRadius: 'var(--radius-rev-card-lg)',
              padding: 'clamp(20px,3.5vw,38px)',
            }}
          >
            {tela === 0 && (
              <Tela1 f={f} set={set} idade={idade} menorDeIdade={menorDeIdade} respTelDigitos={respTelDigitos} handleStatus={handleStatus} />
            )}
            {tela === 1 && <Tela2 f={f} set={set} setF={setF} />}
            {tela === 2 && (
              <Tela3
                f={f}
                set={set}
                telDigitos={telDigitos}
                foto={foto}
                subindo={subindoFoto}
                onFoto={escolherFoto}
                onRemoverFoto={() => setFoto(null)}
              />
            )}

            {erro && (
              <p className="mt-5 text-[13px]" style={{ color: 'var(--color-rev-danger)' }}>
                {erro}
              </p>
            )}

            {/* Desafio anti-bot — só na última tela, que é onde o envio acontece.
                Não renderiza nada quando o widget não está configurado. */}
            {tela === 2 ? <Turnstile onToken={receberDesafio} /> : null}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              {tela > 0 ? (
                <button
                  type="button"
                  onClick={() => setTela((t) => t - 1)}
                  className="rev-label rev-focus text-[11px]"
                  data-on="dark"
                  style={{ color: 'rgba(237,235,228,.5)' }}
                >
                  ← Voltar
                </button>
              ) : (
                <span />
              )}

              {tela < 2 ? (
                <button
                  type="button"
                  onClick={() => setTela((t) => t + 1)}
                  disabled={!podeAvancar}
                  className="rev-btn rev-focus"
                  data-variant="yellow"
                  data-on="dark"
                >
                  Continuar →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={enviar}
                  // Com o desafio ligado, envio só depois de resolvido — senão o
                  // gate não gateia nada.
                  disabled={!podeAvancar || busy || subindoFoto || (turnstileAtivo && !desafio)}
                  className="rev-btn rev-focus"
                  data-variant="yellow"
                  data-on="dark"
                >
                  {busy ? 'Enviando…' : turnstileAtivo && !desafio ? 'Confirme que é você' : 'Enviar cadastro →'}
                </button>
              )}
            </div>
          </div>

          <Jornada ate={0} />
        </div>
      </section>
    </main>
  );
}

/* ══ @username — o endereço/indicação do jogador, confirmado ao vivo ════════ */

const HANDLE_FEEDBACK: Record<string, { text: string; tone: 'dim' | 'ok' | 'bad' }> = {
  empty: { text: 'Letras, números e _ — tipo breno11. Vira o teu link.', tone: 'dim' },
  checking: { text: 'Conferindo…', tone: 'dim' },
  ok: { text: 'disponível ✓', tone: 'ok' },
  invalid: { text: 'Mínimo 3 — só letras, números e _.', tone: 'bad' },
  reserved: { text: 'Esse nome é reservado. Escolhe outro.', tone: 'bad' },
  taken: { text: 'Já foi pego. Bota um número, tipo breno11.', tone: 'bad' },
  offline: { text: 'Sem conexão pra conferir agora.', tone: 'dim' },
};

function HandleField({
  value,
  onChange,
  status,
}: {
  value: string;
  onChange: (v: string) => void;
  status: HandleStatus | 'checking' | 'empty';
}) {
  const fb = HANDLE_FEEDBACK[status] ?? HANDLE_FEEDBACK.empty;
  const cor =
    fb.tone === 'ok' ? 'var(--color-rev-success)' : fb.tone === 'bad' ? 'var(--color-rev-danger)' : 'rgba(237,235,228,.4)';
  const borda =
    status === 'ok' ? 'var(--color-rev-success)' : fb.tone === 'bad' ? 'var(--color-rev-danger)' : 'rgba(255,255,255,.1)';
  return (
    <label className="flex flex-col gap-1.5">
      <span className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.5)' }}>
        Nome de usuário
      </span>
      <div
        className="flex items-center overflow-hidden"
        style={{ border: `2px solid ${borda}`, background: '#0f0f0f', borderRadius: 'var(--radius-rev-btn)', minHeight: 46 }}
      >
        <span style={{ paddingLeft: 14, color: 'rgba(237,235,228,.38)', fontSize: 14, whiteSpace: 'nowrap' }}>
          revela.olefoot.com/
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="breno11"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '0 14px 0 1px',
            background: 'transparent',
            border: 0,
            outline: 'none',
            color: 'var(--color-rev-bone)',
            fontFamily: 'var(--font-sans)',
            fontSize: 15,
          }}
        />
      </div>
      <p className="text-[12px]" style={{ color: cor }}>
        {status === 'ok' ? `revela.olefoot.com/${value} está ${fb.text}` : fb.text}
      </p>
    </label>
  );
}

/* ══ Tela 1 — Quem é você ══════════════════════════════════════════════════ */

function Tela1({
  f, set, idade, menorDeIdade, respTelDigitos, handleStatus,
}: {
  f: Ficha;
  set: (k: keyof Ficha) => (v: string) => void;
  idade: number | null;
  menorDeIdade: boolean;
  respTelDigitos: string;
  handleStatus: HandleStatus | 'checking' | 'empty';
}) {
  const [setorAberto, setSetorAberto] = useState<string | null>(null);
  const setorAtual = setorAberto ?? SETORES.find((s) => s.posicoes.some((p) => p.code === f.pos))?.id ?? null;

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h2 className="rev-display text-[26px]" style={{ color: 'var(--color-rev-bone)' }}>
          Quem é você
        </h2>
      </div>

      <div>
        <Field label="Apelido de jogo" value={f.apelido} onChange={set('apelido')} placeholder="Como te chamam em campo" />
        <p className="mt-1.5 text-[12px]" style={{ color: 'rgba(237,235,228,.38)' }}>
          É o nome que vai no card e no teu link. Sem apelido, usamos o nome.
        </p>
      </div>

      <HandleField value={f.handle} onChange={(v) => set('handle')(normalizeHandle(v))} status={handleStatus} />

      <Field label="Nome completo" value={f.nome} onChange={set('nome')} autoComplete="name" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Field
            label="Ano de nascimento"
            value={f.ano}
            onChange={(v) => set('ano')(v.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            placeholder="2006"
          />
          {idade != null && idade > 5 && idade < 70 && (
            <p className="mt-1.5 text-[12px]" style={{ color: 'rgba(237,235,228,.4)' }}>
              {idade} anos
            </p>
          )}
        </div>
        <Field
          label="Altura (cm)"
          value={f.altura}
          onChange={(v) => set('altura')(v.replace(/\D/g, '').slice(0, 3))}
          inputMode="numeric"
          placeholder="178"
        />
      </div>

      {/* CATEGORIA DEPOIS DA IDADE, e filtrada por ela.
          A categoria define a BASE do rating automático (profissional vale 62,
          sub15 vale 46), e antes ninguém conferia se ela cabia na idade — um
          moleque de 14 podia se declarar profissional e ganhar 16 pontos sem
          ninguém olhar. Aqui a opção impossível nem aparece.
          Isto é só a camada gentil: o teto de verdade é por idade, no banco. */}
      <Chips
        rotulo="Categoria"
        opcoes={categoriasPara(idade)}
        valor={f.categoria}
        onEscolher={set('categoria')}
      />
      {f.categoria && !categoriaCabeNaIdade(f.categoria, idade) && (
        <p className="-mt-1 text-[12px]" style={{ color: 'var(--color-rev-danger)' }}>
          Com {idade} anos, essa categoria não bate. Escolhe uma das de cima.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <span className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.5)' }}>
          Onde você joga
        </span>
        <div className="flex flex-wrap gap-2">
          {SETORES.map((s) => {
            const ativo = setorAtual === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSetorAberto(ativo ? null : s.id)}
                className="rev-chip rev-focus"
                data-on="dark"
                style={{
                  color: ativo ? '#0D0D0D' : 'rgba(237,235,228,.6)',
                  background: ativo ? 'var(--color-rev-yellow)' : 'transparent',
                }}
              >
                {s.nome}
              </button>
            );
          })}
        </div>

        {setorAtual && (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))' }}>
            {SETORES.find((s) => s.id === setorAtual)?.posicoes.map((p) => {
              const ativo = f.pos === p.code;
              return (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => set('pos')(p.code)}
                  className="rev-focus p-3 text-left"
                  data-on="dark"
                  style={{
                    borderRadius: 10,
                    background: '#111',
                    border: ativo ? '2px solid var(--color-rev-yellow)' : '2px solid rgba(255,255,255,.08)',
                  }}
                >
                  <span className="block text-[14px]" style={{ color: 'var(--color-rev-bone)' }}>
                    {p.nome}
                  </span>
                  <span className="mt-0.5 block text-[12px]" style={{ color: 'rgba(237,235,228,.45)' }}>
                    {p.descricao}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Chips
        rotulo="Pé dominante"
        opcoes={PES.map((p) => ({ code: p.code, nome: p.nome }))}
        valor={f.pe}
        onEscolher={set('pe')}
      />



      {/* Menor de idade: o bloco aparece sozinho quando a conta da idade fecha
          abaixo de 18, e o passo não avança sem ele. */}
      {menorDeIdade && (
        <div
          className="flex flex-col gap-4 p-5"
          style={{
            borderRadius: 12,
            background: 'rgba(253,225,0,.06)',
            border: '1px solid rgba(253,225,0,.3)',
          }}
        >
          <div>
            <p className="rev-label text-[10px]" style={{ color: 'var(--color-rev-yellow)' }}>
              Menor de 18 anos
            </p>
            <p className="mt-1.5 text-[13px] leading-snug" style={{ color: 'rgba(237,235,228,.6)' }}>
              Precisamos falar com quem responde por você. Esses dados são só nossos —
              nunca aparecem no perfil.
            </p>
          </div>
          <Field label="Nome do responsável" value={f.respNome} onChange={set('respNome')} />
          <div>
            <Field
              label="Telefone do responsável"
              value={f.respTel}
              onChange={set('respTel')}
              inputMode="tel"
              placeholder="(11) 90000-0000"
            />
            {f.respTel !== '' && respTelDigitos.length < 10 && (
              <p className="mt-1.5 text-[12px]" style={{ color: 'var(--color-rev-danger)' }}>
                Faltam dígitos — com DDD.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══ Tela 2 — Situação ═════════════════════════════════════════════════════ */

function Tela2({
  f, set, setF,
}: {
  f: Ficha;
  set: (k: keyof Ficha) => (v: string) => void;
  setF: React.Dispatch<React.SetStateAction<Ficha>>;
}) {
  return (
    <div className="flex flex-col gap-7">
      <h2 className="rev-display text-[26px]" style={{ color: 'var(--color-rev-bone)' }}>
        Sua situação de jogo
      </h2>

      <div className="flex flex-col gap-3">
        <span className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.5)' }}>
          Como está sua situação hoje
        </span>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))' }}>
          {SITUACOES.map((s) => {
            const ativo = f.situacao === s.code;
            return (
              <button
                key={s.code}
                type="button"
                onClick={() => set('situacao')(ativo ? '' : s.code)}
                className="rev-focus p-3 text-left"
                data-on="dark"
                style={{
                  borderRadius: 10,
                  background: '#111',
                  border: ativo ? '2px solid var(--color-rev-yellow)' : '2px solid rgba(255,255,255,.08)',
                }}
              >
                <span className="block text-[14px]" style={{ color: 'var(--color-rev-bone)' }}>
                  {s.nome}
                </span>
                <span className="mt-0.5 block text-[12px]" style={{ color: 'rgba(237,235,228,.45)' }}>
                  {s.descricao}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.5)' }}>
          Você é representado oficialmente?
        </span>
        <div className="flex gap-2">
          {(['sim', 'nao'] as const).map((v) => (
            <button
              key={v}
              type="button"
              // Trocar pra "não" limpa o nome do empresário: guardar o texto de
              // uma resposta que foi desfeita é como enviar dado que a pessoa
              // achou que tinha apagado.
              onClick={() => setF((p) => ({ ...p, temAgente: p.temAgente === v ? '' : v, agente: v === 'sim' ? p.agente : '' }))}
              className="rev-chip rev-focus"
              data-on="dark"
              style={{
                minWidth: 90,
                color: f.temAgente === v ? '#0D0D0D' : 'rgba(237,235,228,.6)',
                background: f.temAgente === v ? 'var(--color-rev-yellow)' : 'transparent',
              }}
            >
              {v === 'sim' ? 'Sim' : 'Não'}
            </button>
          ))}
        </div>
      </div>

      {f.temAgente === 'sim' && (
        <Field
          label="Nome do representante ou agência"
          value={f.agente}
          onChange={set('agente')}
          placeholder="Quem te representa"
        />
      )}

      <Field
        label="Nome do time ou escolinha"
        value={f.clube}
        onChange={set('clube')}
        placeholder="Onde você joga hoje"
      />

      <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
        <Field label="Cidade" value={f.cidade} onChange={set('cidade')} placeholder="Sua cidade" />
        <Field
          label="Estado"
          value={f.uf}
          onChange={(v) => set('uf')(v.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2))}
          placeholder="SP"
        />
      </div>
    </div>
  );
}

/* ══ Tela 3 — Sonho, mídia e contato ═══════════════════════════════════════ */

function Tela3({
  f, set, telDigitos, foto, subindo, onFoto, onRemoverFoto,
}: {
  f: Ficha;
  set: (k: keyof Ficha) => (v: string) => void;
  telDigitos: string;
  foto: { url: string; preview: string } | null;
  subindo: boolean;
  onFoto: (file: File) => void;
  onRemoverFoto: () => void;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const telCurto = f.telefone !== '' && telDigitos.length < 10;

  return (
    <div className="flex flex-col gap-7">
      <h2 className="rev-display text-[26px]" style={{ color: 'var(--color-rev-bone)' }}>
        Sua história
      </h2>

      <label className="flex flex-col gap-1.5">
        <span className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.5)' }}>
          Qual o seu maior sonho no futebol? <span style={{ opacity: 0.6 }}>· opcional</span>
        </span>
        <textarea
          value={f.sonho}
          onChange={(e) => set('sonho')(e.target.value.slice(0, 250))}
          rows={4}
          placeholder="Jogar no clube que meu pai torce a vida inteira…"
          className="rev-focus"
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-rev-btn)',
            background: '#0f0f0f',
            border: '2px solid rgba(255,255,255,.1)',
            color: 'var(--color-rev-bone)',
            fontFamily: 'var(--font-sans)',
            fontSize: 15,
            lineHeight: 1.6,
            resize: 'vertical',
          }}
        />
        <span className="text-[11px]" style={{ color: 'rgba(237,235,228,.3)' }}>
          {f.sonho.length}/250
        </span>
      </label>

      {/* Foto */}
      <div className="flex flex-col gap-3">
        <span className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.5)' }}>
          Sua foto <span style={{ opacity: 0.6 }}>· opcional</span>
        </span>

        <div className="flex items-center gap-4">
          <div
            className="grid shrink-0 place-items-center overflow-hidden"
            style={{
              width: 84, height: 105, borderRadius: 10,
              background: '#111',
              border: foto ? '2px solid var(--color-rev-yellow)' : '2px dashed rgba(237,235,228,.24)',
            }}
          >
            {foto ? (
              <img src={foto.preview} alt="Sua foto" className="h-full w-full object-cover" />
            ) : (
              <span className="rev-label text-[9px]" style={{ color: 'rgba(237,235,228,.3)' }}>
                3:4
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFoto(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={subindo}
              className="rev-btn rev-focus"
              data-variant="outline"
              data-on="dark"
              style={{ minHeight: 38, padding: '0 16px', fontSize: 11 }}
            >
              {subindo ? 'Subindo…' : foto ? 'Trocar foto' : 'Escolher foto'}
            </button>
            {foto && (
              <button
                type="button"
                onClick={onRemoverFoto}
                className="rev-label rev-focus self-start text-[10px]"
                data-on="dark"
                style={{ color: 'rgba(237,235,228,.45)' }}
              >
                Remover
              </button>
            )}
            <p className="text-[11px]" style={{ color: 'rgba(237,235,228,.35)' }}>
              JPG, PNG ou WEBP · até 4 MB
            </p>
          </div>
        </div>
      </div>

      <Field label="Link de vídeo" value={f.video} onChange={set('video')} placeholder="YouTube, Drive…" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Instagram" value={f.instagram} onChange={set('instagram')} placeholder="@seuperfil" />
        <Field label="TikTok" value={f.tiktok} onChange={set('tiktok')} placeholder="@seuperfil" />
      </div>

      <div>
        <Field
          label="WhatsApp"
          value={f.telefone}
          onChange={set('telefone')}
          inputMode="tel"
          autoComplete="tel"
          placeholder="(11) 90000-0000"
        />
        {telCurto && (
          <p className="mt-1.5 text-[12px]" style={{ color: 'var(--color-rev-danger)' }}>
            Faltam dígitos — com DDD.
          </p>
        )}
        <p className="mt-1.5 text-[12px] leading-snug" style={{ color: 'rgba(237,235,228,.38)' }}>
          É por aqui que a gente te avisa da aprovação. Só o OLE SCOUT vê — nunca
          aparece no teu perfil público.
        </p>
      </div>
    </div>
  );
}

/* ══ Peças ═════════════════════════════════════════════════════════════════ */

function Chips({
  rotulo, opcoes, valor, onEscolher,
}: {
  rotulo: string;
  opcoes: Array<{ code: string; nome: string }>;
  valor: string;
  onEscolher: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.5)' }}>
        {rotulo}
      </span>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => {
          const ativo = valor === o.code;
          return (
            <button
              key={o.code}
              type="button"
              onClick={() => onEscolher(ativo ? '' : o.code)}
              className="rev-chip rev-focus"
              data-on="dark"
              style={{
                color: ativo ? '#0D0D0D' : 'rgba(237,235,228,.6)',
                background: ativo ? 'var(--color-rev-yellow)' : 'transparent',
              }}
            >
              {o.nome}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A tela de sucesso.
 *
 * ── `jaEraDono`: O BUG QUE ISTO CONSERTA ────────────────────────────────────
 * `revela_submit_talent` grava `user_id = auth.uid()` no INSERT. Ou seja: quem
 * preenche o formulário JÁ LOGADO cria uma ficha que nasce com dono.
 *
 * A tela, mesmo assim, mostrava o passo de reivindicar — e o claim só age sobre
 * ficha ÓRFÃ. Resultado: a pessoa cadastrava certinho, com foto e vídeo, e a
 * última tela dizia "Não deu pra ligar o cadastro a essa conta". O cadastro
 * tinha funcionado; só a tela mentia. Pior: convidava a criar uma segunda conta
 * pra resolver um problema que não existia.
 *
 * Com sessão aberta no envio, o passo 2 já está cumprido — e é isso que a tela
 * diz agora.
 */
function Enviado({
  apelido,
  talentId,
  telefone,
  jaEraDono,
  onNote,
}: {
  apelido: string;
  talentId: string;
  telefone: string;
  /** A ficha nasceu com dono porque quem enviou estava logado. */
  jaEraDono: boolean;
  onNote: (title: string, body?: string, tone?: 'yellow' | 'green') => void;
}) {
  const [comConta, setComConta] = useState(jaEraDono);

  return (
    <main>
      <section className="rev-section" style={{ background: 'var(--color-rev-black)' }}>
        <div className="rev-container" style={{ maxWidth: 720 }}>
          <span
            className="rev-label inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px]"
            style={{ background: 'var(--color-rev-success)', color: '#0D0D0D' }}
          >
            ✓ Recebido
          </span>

          <h1
            className="rev-display mt-6"
            style={{ fontSize: 'clamp(32px,5.6vw,68px)', color: 'var(--color-rev-yellow)' }}
          >
            Cadastro enviado
            <br />
            para aprovação
          </h1>

          <p className="mt-6 max-w-[48ch] text-[17px] leading-relaxed" style={{ color: 'rgba(237,235,228,.66)' }}>
            {primeiroNome(apelido)}, chegou aqui. A gente aprova em alguns minutos e te
            avisa no WhatsApp. Aí o OLE SCOUT monta tua ficha de atributos e teu nome
            entra na vitrine.
          </p>

          {comConta ? (
            <div
              className="mt-10 px-5 py-5"
              style={{
                borderRadius: 12,
                background: 'rgba(34,197,94,.1)',
                border: '1px solid rgba(34,197,94,.4)',
              }}
            >
              <p className="rev-label text-[10px]" style={{ color: 'var(--color-rev-success)' }}>
                ✓ Perfil garantido
              </p>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'rgba(237,235,228,.62)' }}>
                {jaEraDono
                  ? 'Você já estava logado, então o cadastro já é seu. Não precisa criar conta nenhuma.'
                  : 'O cadastro agora é seu. Entra com essa conta pra acompanhar a aprovação.'}
              </p>
              <Link
                to="/meu-perfil"
                className="rev-btn rev-focus mt-4 inline-flex"
                data-variant="outline"
                data-on="dark"
              >
                Ver meu painel →
              </Link>
            </div>
          ) : (
            <ContaDoAtleta
              talentId={talentId}
              telefone={telefone}
              onPronto={() => {
                clearPendingTalent(); // claim fechou — não precisa mais ressuscitar
                setComConta(true);
                onNote('Perfil garantido', 'O cadastro agora é seu.', 'green');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {/* A SAÍDA. O cadastro guardado no navegador já expira em 24h, mas
              dentro da janela ele ainda abre esta tela pra quem só queria
              cadastrar OUTRA pessoa — o técnico com dois moleques, o pai com
              dois filhos. Sem esta linha, a única saída é limpar o navegador. */}
          <button
            type="button"
            onClick={() => {
              clearPendingTalent();
              window.location.reload();
            }}
            className="rev-label rev-focus mt-6 block text-[11px]"
            style={{ color: 'rgba(237,235,228,.42)' }}
          >
            Não é você? Começar outro cadastro
          </button>

          <Jornada ate={comConta ? 2 : 1} />

          {/* ── Seguir a Olefoot no Instagram ────────────────────────────
              Convite, não pedágio: o cadastro já está enviado quando isto
              aparece, e nada aqui depende do clique. A API do Instagram não
              permite seguir alguém programaticamente — os scopes da Instagram
              Platform cobrem publicação, comentários, mensagens e insights, e
              nenhum toca em follow — e automatizar por fora derruba a conta
              oficial. Então o que resta é o honesto: pedir, e deixar a pessoa
              decidir. Copy do fundador — nada é prometido em troca, o que evita
              dívida que o perfil teria de pagar depois.

              No celular o bloco EMPILHA. A versão de três colunas (ícone ·
              texto · botão) espremia a frase em cinco linhas dentro de 375px. */}
          <a
            href="https://instagram.com/olefootgame"
            target="_blank"
            rel="noopener noreferrer"
            className="rev-focus mt-8 flex flex-col gap-4 px-5 py-5 transition-colors sm:flex-row sm:items-center"
            style={{
              borderRadius: 12,
              background: 'rgba(237,235,228,.05)',
              border: '1px solid rgba(253,225,0,.28)',
            }}
          >
            <span className="flex min-w-0 flex-1 items-center gap-3.5">
              <span
                aria-hidden
                className="grid shrink-0 place-items-center"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 11,
                  background: 'var(--color-rev-yellow)',
                  color: '#0D0D0D',
                }}
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <span className="min-w-0">
                <span
                  className="block text-[14px] leading-snug"
                  style={{ color: 'rgba(237,235,228,.75)' }}
                >
                  Opa jogador, dá uma moral pra gente lá no Instagram. Siga{' '}
                  <strong style={{ color: 'var(--color-rev-bone)' }}>@olefootgame</strong>
                </span>
              </span>
            </span>
            <span
              aria-hidden
              className="rev-btn shrink-0 justify-center"
              data-variant="yellow"
              data-on="dark"
              style={{ minHeight: 40, padding: '0 18px' }}
            >
              Clique para seguir
            </span>
          </a>

          {/* O destino de quem acabou de se cadastrar é o PRÓPRIO cadastro.
              Antes daqui os dois botões levavam pra vitrine e pra home — o
              atleta mandava a ficha e sumia, sem lugar pra ver em que pé está.
              Quem ainda não fechou a conta continua sem esse caminho: o painel
              depende de sessão, e mandar pra lá sem conta é dar de cara com um
              pedido de login. */}
          <div className="mt-10 flex flex-wrap gap-3">
            {comConta ? (
              <Link
                to="/meu-perfil"
                className="rev-btn rev-focus"
                data-variant="yellow"
                data-on="dark"
              >
                Acompanhar meu cadastro →
              </Link>
            ) : (
              <Link to="/#descobrir" className="rev-btn rev-focus" data-variant="yellow" data-on="dark">
                Ver quem já está na vitrine
              </Link>
            )}
            <Link to="/" className="rev-btn rev-focus" data-variant="outline" data-on="dark">
              Voltar pro início
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

/** O mapa dos 7 passos — contexto, não formulário. Por isso vive fora do card. */
function Jornada({ ate }: { ate: number }) {
  return (
    <div className="mt-12">
      <p className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.42)' }}>
        Road to card
      </p>
      <ol className="mt-4 flex flex-col gap-2.5">
        {JORNADA.map((p, i) => {
          const feito = i < ate;
          const agora = i === ate;
          return (
            <li key={p} className="flex items-center gap-3 text-[13px]">
              <span
                className="grid shrink-0 place-items-center text-[10px]"
                style={{
                  width: 20, height: 20, borderRadius: 999,
                  background: feito ? 'var(--color-rev-success)' : agora ? 'var(--color-rev-yellow)' : 'transparent',
                  border: feito || agora ? 'none' : '1.5px solid rgba(237,235,228,.22)',
                  color: '#0D0D0D',
                  fontWeight: 700,
                }}
              >
                {feito ? '✓' : agora ? i + 1 : ''}
              </span>
              <span
                style={{
                  color: feito ? 'rgba(237,235,228,.65)' : agora ? 'var(--color-rev-yellow)' : 'rgba(237,235,228,.35)',
                }}
              >
                {p}
                {agora && <span className="rev-label ml-2 text-[9px]">você está aqui</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

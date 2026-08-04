/**
 * A AUTORIZAÇÃO DO RESPONSÁVEL — /autorizacao/:token
 *
 * Com o SCOUT autônomo, o cadastro entra no ar sozinho. Isso significava que a
 * foto de um menino de 14 anos chegava à vitrine sem nenhum adulto ter dito sim.
 * Esta página é o freio: a foto fica guardada até alguém assinar aqui.
 *
 * ── QUEM ABRE ISTO NÃO TEM CONTA E NÃO VAI CRIAR ────────────────────────────
 * É um pai que recebeu um link no WhatsApp do filho. Se a primeira tela pedir
 * cadastro, ele fecha — e a foto do moleque nunca sai do limbo. Então a página
 * é anônima e cabe numa tela: ele vê o que está autorizando, preenche quatro
 * campos e pronto.
 *
 * ── ELE VÊ A FOTO ANTES DE DECIDIR ──────────────────────────────────────────
 * Autorizar sem ver o que vai ao ar não é autorizar. A foto que aparece aqui é
 * exatamente a que será publicada, e a página lista com todas as letras o que
 * fica público e o que não fica. Contato de ninguém aparece nesta tela.
 *
 * ── O CPF ENTRA E NÃO VOLTA ─────────────────────────────────────────────────
 * Ele é a prova de que houve autorização, não um dado de perfil. Nenhuma leitura
 * do sistema devolve CPF — nem pro admin. Ver o cabeçalho da migration
 * 20260806140000.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Eyebrow, Portrait } from '../components/primitives';
import {
  autorizarResponsavel,
  verAutorizacao,
  type AutorizacaoVista,
  type FalhaAutorizacao,
} from '../data/revelaApi';
import { nomeDaPosicao } from '../data/posicoes';

const ERRO: Record<FalhaAutorizacao, string> = {
  link_invalido: 'Esse link não vale. Peça um novo pro atleta.',
  ja_autorizado: 'Essa autorização já foi assinada.',
  nome_incompleto: 'Escreva seu nome completo.',
  cpf_invalido: 'Confira o CPF — são 11 números.',
  email_invalido: 'Confira o e-mail.',
  telefone_invalido: 'Confira o telefone, com DDD.',
  offline: 'Sem conexão agora. Tenta de novo em instantes.',
};

export function AutorizacaoPage({
  onNote,
}: {
  onNote: (title: string, body?: string, tone?: 'yellow' | 'green') => void;
}) {
  const { token = '' } = useParams<{ token: string }>();
  const [dados, setDados] = useState<AutorizacaoVista | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'invalido' | 'feito'>('carregando');
  const [f, setF] = useState({ nome: '', cpf: '', email: '', telefone: '' });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    let cancelado = false;
    void verAutorizacao(token).then((d) => {
      if (cancelado) return;
      if (!d?.ok) {
        setEstado('invalido');
        return;
      }
      setDados(d);
      setEstado(d.status === 'approved' ? 'feito' : 'pronto');
    });
    return () => {
      cancelado = true;
    };
  }, [token]);

  async function assinar(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErro(null);
    const res = await autorizarResponsavel({ token, ...f });
    setBusy(false);
    if (!res.ok) {
      setErro(ERRO[res.reason ?? 'offline']);
      return;
    }
    setEstado('feito');
    onNote('Autorização registrada', 'A foto já pode ir ao ar.', 'green');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  if (estado === 'carregando') {
    return (
      <main className="grid min-h-[70vh] place-items-center">
        <p className="rev-label text-[11px]" style={{ color: 'rgba(237,235,228,.4)' }}>
          Carregando…
        </p>
      </main>
    );
  }

  if (estado === 'invalido' || !dados) {
    return (
      <main className="rev-section grid min-h-[70vh] place-items-center text-center">
        <div>
          <Eyebrow>Autorização</Eyebrow>
          <h1 className="rev-display mt-5" style={{ fontSize: 'clamp(28px,5vw,48px)' }}>
            Esse link não vale
          </h1>
          <p className="mx-auto mt-3 max-w-[40ch] text-[14px]" style={{ color: 'rgba(237,235,228,.5)' }}>
            Ele pode ter sido trocado. Peça um novo pro atleta — ele encontra no painel dele.
          </p>
          <Link to="/" className="rev-btn rev-focus mt-7" data-variant="yellow" data-on="dark">
            Ir pro início
          </Link>
        </div>
      </main>
    );
  }

  const primeiro = dados.atleta.trim().split(/\s+/)[0];

  if (estado === 'feito') {
    return (
      <main className="rev-section grid min-h-[70vh] place-items-center text-center">
        <div>
          <span
            className="rev-label inline-flex rounded-full px-4 py-2 text-[10px]"
            style={{ background: 'var(--color-rev-success)', color: '#0D0D0D' }}
          >
            ✓ Autorizado
          </span>
          <h1 className="rev-display mt-6" style={{ fontSize: 'clamp(30px,5.5vw,58px)' }}>
            Obrigado
          </h1>
          <p className="mx-auto mt-4 max-w-[42ch] text-[15px] leading-relaxed" style={{ color: 'rgba(237,235,228,.6)' }}>
            A foto do {primeiro} já pode aparecer no perfil dele. Se mudar de ideia, é só
            falar com a gente — a autorização pode ser desfeita a qualquer momento.
          </p>
          <Link to={`/t/${dados.slug}`} className="rev-btn rev-focus mt-8" data-variant="yellow" data-on="dark">
            Ver o perfil do {primeiro}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="rev-section">
      <div className="rev-container" style={{ maxWidth: 640 }}>
        <Eyebrow>Autorização do responsável</Eyebrow>
        <h1 className="rev-display mt-4" style={{ fontSize: 'clamp(30px,5.5vw,54px)', lineHeight: 0.96 }}>
          Você autoriza a foto do {primeiro}?
        </h1>
        <p className="mt-5 max-w-[48ch] text-[16px] leading-relaxed" style={{ color: 'rgba(237,235,228,.66)' }}>
          O {primeiro} criou um perfil de atleta na Olefoot. Como ele é menor de idade, a
          foto só entra no ar se você autorizar.
        </p>

        {/* ── O que está sendo autorizado ─────────────────────────────────── */}
        <div
          className="mt-8 flex flex-wrap items-center gap-5 px-5 py-5"
          style={{
            background: 'var(--color-rev-surface)',
            border: '1px solid rgba(237,235,228,.1)',
            borderRadius: 'var(--radius-rev-card)',
          }}
        >
          <div style={{ width: 116, flexShrink: 0 }}>
            <Portrait src={dados.foto} alt={dados.nomeCompleto} ratio="4 / 5" width={140} priority />
          </div>
          <div className="min-w-0 flex-1">
            <p className="rev-display text-[24px] leading-none" style={{ color: 'var(--color-rev-bone)' }}>
              {dados.nomeCompleto}
            </p>
            <p className="rev-label mt-2 text-[10px]" style={{ color: 'rgba(237,235,228,.5)' }}>
              {[
                dados.pos ? nomeDaPosicao(dados.pos) : null,
                dados.clube,
                [dados.cidade, dados.uf].filter(Boolean).join('/'),
                dados.idade ? `${dados.idade} anos` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        {/* ── A régua, sem letra miúda ────────────────────────────────────── */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Lista
            titulo="Fica público"
            cor="rgba(237,235,228,.6)"
            itens={['A foto acima', 'Nome, posição e clube', 'Cidade e estado', 'A ficha de atributos']}
          />
          <Lista
            titulo="Nunca fica público"
            cor="var(--color-rev-yellow)"
            itens={['Telefone e e-mail', 'Seus dados de responsável', 'Endereço', 'Escola']}
          />
        </div>

        {/* ── A assinatura ────────────────────────────────────────────────── */}
        <form onSubmit={assinar} className="mt-9 flex flex-col gap-3">
          <p className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.45)' }}>
            Seus dados — quem autoriza
          </p>
          <Campo label="Nome completo" value={f.nome} onChange={(v) => setF({ ...f, nome: v })} autoComplete="name" />
          <Campo
            label="CPF"
            value={f.cpf}
            onChange={(v) => setF({ ...f, cpf: v.replace(/\D/g, '').slice(0, 11) })}
            inputMode="numeric"
          />
          <Campo label="E-mail" value={f.email} onChange={(v) => setF({ ...f, email: v })} type="email" autoComplete="email" />
          <Campo
            label="Telefone com DDD"
            value={f.telefone}
            onChange={(v) => setF({ ...f, telefone: v.replace(/\D/g, '').slice(0, 13) })}
            inputMode="tel"
          />

          {erro && (
            <p className="text-[13px]" style={{ color: 'var(--color-rev-danger)' }}>
              {erro}
            </p>
          )}

          <button
            type="submit"
            className="rev-btn rev-focus mt-2"
            data-variant="yellow"
            data-on="dark"
            disabled={busy}
          >
            {busy ? 'Registrando…' : `Autorizo a foto do ${primeiro}`}
          </button>
          <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(237,235,228,.38)' }}>
            Seus dados servem só pra registrar quem autorizou. Não vão pro perfil, não
            aparecem pra ninguém e não são usados pra te mandar nada.
          </p>
        </form>
      </div>
    </main>
  );
}

function Lista({ titulo, itens, cor }: { titulo: string; itens: string[]; cor: string }) {
  return (
    <div>
      <p className="rev-label text-[10px]" style={{ color: cor }}>
        {titulo}
      </p>
      <ul className="mt-2.5 flex flex-col gap-1.5" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {itens.map((i) => (
          <li key={i} className="text-[14px]" style={{ color: 'rgba(237,235,228,.55)' }}>
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: 'numeric' | 'tel';
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="rev-label mb-1.5 block text-[10px]" style={{ color: 'rgba(237,235,228,.5)' }}>
        {label}
      </span>
      <input
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="rev-focus w-full px-3.5 py-3 text-[15px]"
        style={{
          background: 'rgba(13,13,13,.5)',
          border: '1px solid rgba(237,235,228,.16)',
          borderRadius: 'var(--radius-rev-btn)',
          color: 'var(--color-rev-bone)',
        }}
      />
    </label>
  );
}

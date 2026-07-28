/**
 * O PASSO 2 — o cadastro ganha dono.
 *
 * Aparece logo depois do envio. O talento foi criado anônimo (`user_id` nulo);
 * aqui o atleta entra ou cria conta, e o cadastro passa a ser dele. Sem isto ele
 * não tem como voltar, acompanhar a fila ou editar nada.
 *
 * DUAS PORTAS, uma tela: "já tenho conta" e "criar conta". Nada de escolher
 * antes de ver — quem chegou até aqui já preencheu três telas, e mais uma
 * decisão de navegação seria fricção pura.
 *
 * A reivindicação exige `id` + telefone (ver revela_claim_talent). Só o id
 * transformaria "reivindicar" em "roubar perfil alheio".
 */
import { useState, type FormEvent } from 'react';
import { signInWithEmail } from '@/supabase/auth';
import { claimTalent, type ClaimFailure } from '../data/revelaApi';
import { signUpRevela } from '../data/session';

type Modo = 'entrar' | 'criar';

const CLAIM_COPY: Record<ClaimFailure, string> = {
  auth_required: 'Sessão não abriu. Tenta entrar de novo.',
  account_has_talent: 'Essa conta já tem um perfil de jogador.',
  not_claimable: 'Não deu pra ligar o cadastro a essa conta.',
  offline: 'Sem conexão agora. Tenta de novo em instantes.',
};

export function ContaDoAtleta({
  talentId,
  telefone,
  onPronto,
}: {
  talentId: string;
  telefone: string;
  onPronto: () => void;
}) {
  const [modo, setModo] = useState<Modo>('criar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /** Conta criada mas sem sessão: o projeto exige confirmar o e-mail. */
  const [confirmeEmail, setConfirmeEmail] = useState(false);

  const senhaCurta = senha.length > 0 && senha.length < 6;
  const naoConfere = modo === 'criar' && confirma.length > 0 && senha !== confirma;
  const valido =
    email.includes('@') &&
    senha.length >= 6 &&
    (modo === 'entrar' || senha === confirma);

  async function submeter(e: FormEvent) {
    e.preventDefault();
    if (busy || !valido) return;
    setBusy(true);
    setErro(null);

    if (modo === 'entrar') {
      const r = await signInWithEmail(email, senha);
      if (!r.ok) {
        setBusy(false);
        setErro(r.error ?? 'E-mail ou senha não conferem.');
        return;
      }
    } else {
      const r = await signUpRevela(email, senha);
      if (!r.ok) {
        setBusy(false);
        setErro(traduzErroDeCadastro(r.error));
        return;
      }
      if (!r.sessao) {
        // Confirmação de e-mail ligada: a conta existe, mas não há sessão pra
        // reivindicar agora. Melhor dizer a verdade que fingir que deu certo.
        setBusy(false);
        setConfirmeEmail(true);
        return;
      }
    }

    const claim = await claimTalent(talentId, telefone);
    setBusy(false);
    if (!claim.ok) {
      setErro(CLAIM_COPY[claim.reason ?? 'offline']);
      return;
    }
    onPronto();
  }

  if (confirmeEmail) {
    return (
      <Caixa>
        <p className="rev-label text-[10px]" style={{ color: 'var(--color-rev-yellow)' }}>
          Confirme seu e-mail
        </p>
        <p className="mt-3 text-[14px] leading-relaxed" style={{ color: 'rgba(237,235,228,.62)' }}>
          Mandamos um link para <strong style={{ color: 'var(--color-rev-bone)' }}>{email}</strong>.
          Confirma por lá e entra aqui de novo — teu cadastro fica guardado esperando.
        </p>
        <button
          type="button"
          onClick={() => {
            setConfirmeEmail(false);
            setModo('entrar');
            setSenha('');
            setConfirma('');
          }}
          className="rev-btn rev-focus mt-5"
          data-variant="outline"
          data-on="dark"
        >
          Já confirmei — entrar
        </button>
      </Caixa>
    );
  }

  return (
    <Caixa>
      <p className="rev-label text-[10px]" style={{ color: 'var(--color-rev-yellow)' }}>
        Passo 2 · validação de conta
      </p>
      <h2 className="rev-display mt-3 text-[26px]" style={{ color: 'var(--color-rev-bone)' }}>
        Garanta seu perfil
      </h2>
      <p className="mt-2 max-w-[46ch] text-[14px] leading-relaxed" style={{ color: 'rgba(237,235,228,.55)' }}>
        É com essa conta que você acompanha a aprovação e entra no game depois.
      </p>

      <div className="mt-6 flex gap-2">
        {(['criar', 'entrar'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setModo(m);
              setErro(null);
              setConfirma('');
            }}
            className="rev-chip rev-focus"
            data-on="dark"
            style={{
              color: modo === m ? '#0D0D0D' : 'rgba(237,235,228,.6)',
              background: modo === m ? 'var(--color-rev-yellow)' : 'transparent',
            }}
          >
            {m === 'criar' ? 'Não tenho conta' : 'Já tenho conta'}
          </button>
        ))}
      </div>

      <form onSubmit={submeter} className="mt-6 flex flex-col gap-3.5">
        <Campo label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <div>
          <Campo
            label="Senha"
            type="password"
            value={senha}
            onChange={setSenha}
            autoComplete={modo === 'criar' ? 'new-password' : 'current-password'}
          />
          {senhaCurta && (
            <p className="mt-1.5 text-[12px]" style={{ color: 'var(--color-rev-danger)' }}>
              Mínimo de 6 caracteres.
            </p>
          )}
        </div>

        {modo === 'criar' && (
          <div>
            <Campo
              label="Confirmar senha"
              type="password"
              value={confirma}
              onChange={setConfirma}
              autoComplete="new-password"
            />
            {naoConfere && (
              <p className="mt-1.5 text-[12px]" style={{ color: 'var(--color-rev-danger)' }}>
                As senhas não são iguais.
              </p>
            )}
          </div>
        )}

        {erro && (
          <p className="text-[13px]" style={{ color: 'var(--color-rev-danger)' }}>
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !valido}
          className="rev-btn rev-focus mt-1"
          data-variant="yellow"
          data-on="dark"
        >
          {busy ? 'Um instante…' : modo === 'criar' ? 'Criar conta e garantir perfil' : 'Entrar e garantir perfil'}
        </button>
      </form>
    </Caixa>
  );
}

/* ══ Peças ═════════════════════════════════════════════════════════════════ */

function Caixa({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-10"
      style={{
        background: 'var(--color-rev-surface)',
        border: '2px solid rgba(253,225,0,.22)',
        borderRadius: 'var(--radius-rev-card-lg)',
        padding: 'clamp(20px,3.5vw,32px)',
      }}
    >
      {children}
    </div>
  );
}

/**
 * Campo próprio em vez do `Field` do AuthSheet: aqui precisamos de `type`
 * password e de autoComplete específico de cadastro, e importar do AuthSheet
 * criaria uma dependência circular quando ele passar a usar este bloco.
 */
function Campo({
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.5)' }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="rev-focus"
        style={{
          minHeight: 46,
          padding: '0 14px',
          borderRadius: 'var(--radius-rev-btn)',
          background: '#0f0f0f',
          border: '2px solid rgba(255,255,255,.1)',
          color: 'var(--color-rev-bone)',
          fontFamily: 'var(--font-sans)',
          fontSize: 15,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-rev-yellow)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)';
        }}
      />
    </label>
  );
}

/** Mensagem do Supabase é em inglês e técnica demais pra quem está cadastrando. */
function traduzErroDeCadastro(msg?: string): string {
  const m = (msg ?? '').toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Esse e-mail já tem conta. Usa "Já tenho conta".';
  }
  if (m.includes('password')) return 'Senha fraca — usa pelo menos 6 caracteres.';
  if (m.includes('invalid') && m.includes('email')) return 'Confere o e-mail.';
  return msg || 'Não deu pra criar a conta agora.';
}

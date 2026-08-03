/**
 * Folha de conta — aparece quando a ação exige login (virar fã, criar perfil).
 *
 * ── POR QUE ELA PASSOU A CRIAR CONTA AQUI DENTRO ────────────────────────────
 * Até 2026-08-02 esta folha só fazia LOGIN: quem não tinha conta era mandado
 * pro `game.olefoot.com/cadastro`. Ou seja, **pra virar fã de um amigo a pessoa
 * tinha que ir criar um clube num jogo de gerenciamento de futebol.** Com meta
 * de 10.000 fãs por atleta, esse funil não fecha — é o gargalo da campanha
 * inteira.
 *
 * O medo original era criar usuário órfão, sem crédito de rede. Não procede:
 * `signUpRevela()` já carrega o `referred_by_code` guardado por
 * `captureReferralFromUrl()`, que é a MESMA via que o cadastro do jogo usa.
 * Conta criada aqui nasce com indicador quando existe indicador.
 *
 * O caminho pro jogo continua ali embaixo — pra quem quer o clube, não o fã.
 */
import { forwardRef, useEffect, useRef, useState, type FormEvent } from 'react';
import { sendPasswordResetEmail, signInWithEmail } from '@/supabase/auth';
import { signUpRevela, signupUrl } from '../data/session';

export function AuthSheet({
  open,
  reason,
  onClose,
}: {
  open: boolean;
  /** O que a pessoa tentou fazer — a folha explica por que está pedindo login. */
  reason: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modo, setModo] = useState<'entrar' | 'criar'>('criar');
  const [recuperando, setRecuperando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const firstField = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setAviso(null);
    // Abre em CRIAR CONTA de propósito: quem esbarra nesta folha quase sempre
    // chegou pelo link de um atleta e nunca ouviu falar da Olefoot. Abrir em
    // "entrar" faria essa pessoa procurar o botão certo antes de fazer nada.
    setModo('criar');
    setRecuperando(false);
    const t = setTimeout(() => firstField.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  /**
   * Manda o e-mail de recuperação.
   *
   * ── POR QUE ISTO É ESSENCIAL, E NÃO CONVENIÊNCIA ────────────────────────
   * Todo atleta cadastrado PELO OLE SCOUT tem conta que ele nunca criou: e-mail
   * confirmado, ficha dele, e nenhuma senha escolhida por ninguém. Sem este
   * botão, esse atleta não entra no painel dele nunca.
   *
   * O `redirectTo` sai de `window.location.origin` lá dentro, então o link
   * volta pro REVELA — e não pro domínio do jogo, onde a sessão nasceria em
   * outro localStorage e não valeria aqui.
   *
   * A RESPOSTA É SEMPRE A MESMA, exista ou não a conta: dizer "esse e-mail não
   * está cadastrado" transformaria a folha num verificador de quem tem conta na
   * Olefoot.
   */
  async function recuperar() {
    if (busy || !email.trim()) return;
    setBusy(true);
    setError(null);
    await sendPasswordResetEmail(email, '/reset-senha');
    setBusy(false);
    setRecuperando(false);
    setAviso('Se existir conta com esse e-mail, o link de senha já está a caminho.');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setAviso(null);

    if (modo === 'entrar') {
      const res = await signInWithEmail(email, password);
      setBusy(false);
      if (res.ok) {
        onClose();
        return;
      }
      setError(res.error ?? 'Não deu pra entrar. Confere e-mail e senha.');
      return;
    }

    const res = await signUpRevela(email, password);
    setBusy(false);

    if (!res.ok) {
      // E-mail já cadastrado é o erro mais comum aqui — e a saída não é um
      // texto vermelho, é trocar o modo da folha pra pessoa entrar.
      const jaExiste = /already|registered|exists/i.test(res.error ?? '');
      if (jaExiste) {
        setModo('entrar');
        setAviso('Esse e-mail já tem conta. Entra com a tua senha.');
        return;
      }
      setError(res.error ?? 'Não deu pra criar a conta. Tenta de novo.');
      return;
    }

    if (!res.sessao) {
      // Confirmação de e-mail ligada no projeto: a conta existe mas não há
      // sessão. Não dá pra fingir que deu certo — a ação que ela queria fazer
      // continua bloqueada até confirmar.
      setAviso('Conta criada! Confirma o e-mail que te mandamos e volta aqui.');
      return;
    }

    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-end sm:place-items-center"
      style={{ background: 'rgba(13,13,13,.72)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Entrar na Olefoot"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] p-6 sm:p-8"
        style={{
          background: 'var(--color-rev-surface)',
          border: '3px solid var(--color-rev-yellow)',
          borderRadius: 'var(--radius-rev-card-lg)',
        }}
      >
        <p className="rev-label text-[11px]" style={{ color: 'var(--color-rev-yellow)' }}>
          {reason}
        </p>
        <h2 className="rev-display mt-2 text-[34px]">
          {modo === 'criar' ? 'Cria tua conta' : 'Entra na Olefoot'}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'rgba(237,235,228,.6)' }}>
          {modo === 'criar'
            ? 'E-mail e senha, só isso. É de graça e leva 10 segundos — a mesma conta serve pro jogo depois.'
            : 'É a mesma conta do jogo.'}
        </p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
          <Field
            ref={firstField}
            label="E-mail"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <Field
            label="Senha"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={modo === 'criar' ? 'new-password' : 'current-password'}
          />

          {aviso && (
            <p className="text-[12px]" style={{ color: 'var(--color-rev-yellow)' }}>
              {aviso}
            </p>
          )}

          {error && (
            <p className="text-[12px]" style={{ color: 'var(--color-rev-danger)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="rev-btn rev-focus mt-1"
            data-variant="yellow"
            data-on="dark"
            disabled={busy || !email.trim() || password.length < 6}
          >
            {busy
              ? modo === 'criar'
                ? 'Criando…'
                : 'Entrando…'
              : modo === 'criar'
                ? 'Criar conta e continuar'
                : 'Entrar'}
          </button>
          {modo === 'criar' && (
            <p className="text-[11px]" style={{ color: 'rgba(237,235,228,.38)' }}>
              Senha de 6 caracteres pra cima.
            </p>
          )}
        </form>

        {/* Só no modo ENTRAR: oferecer "esqueci a senha" pra quem está criando
            conta agora é oferecer socorro pra um problema que ele não tem. */}
        {modo === 'entrar' && (
          <div className="mt-3">
            {recuperando ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void recuperar()}
                  disabled={busy || !email.trim()}
                  className="rev-btn rev-focus"
                  data-variant="outline"
                  data-on="dark"
                  style={{ minHeight: 36, padding: '0 14px' }}
                >
                  {busy ? 'Enviando…' : 'Mandar link pro meu e-mail'}
                </button>
                <button
                  type="button"
                  onClick={() => setRecuperando(false)}
                  className="rev-label rev-focus text-[11px]"
                  style={{ color: 'rgba(237,235,228,.45)' }}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setRecuperando(true);
                  setError(null);
                  setAviso('Confere o e-mail acima e a gente manda o link.');
                }}
                className="rev-label rev-focus text-[11px]"
                style={{ color: 'rgba(237,235,228,.5)' }}
              >
                Nunca criei senha / esqueci a minha
              </button>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2 border-t pt-4" style={{ borderColor: 'rgba(255,255,255,.08)' }}>
          <button
            type="button"
            onClick={() => {
              setModo((m) => (m === 'criar' ? 'entrar' : 'criar'));
              setError(null);
              setAviso(null);
            }}
            className="rev-label rev-focus self-start text-[11px]"
            style={{ color: 'var(--color-rev-yellow)' }}
          >
            {modo === 'criar' ? 'Já tenho conta — entrar' : 'Não tenho conta — criar agora'}
          </button>
          {/* Quem quer o CLUBE, não só a conta, continua indo pro jogo — é lá
              que o onboarding de manager acontece. */}
          <a
            href={signupUrl()}
            className="rev-label rev-focus text-[11px]"
            style={{ color: 'rgba(237,235,228,.45)' }}
          >
            Quero criar meu clube no game →
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rev-label rev-focus self-start text-[11px]"
            style={{ color: 'rgba(237,235,228,.45)' }}
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Campo ─────────────────────────────────────────────────────────────── */

interface FieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, type = 'text', value, onChange, autoComplete, placeholder, inputMode },
  ref,
) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.5)' }}>
        {label}
      </span>
      <input
        ref={ref}
        type={type}
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
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
});

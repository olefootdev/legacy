/**
 * Folha de login — aparece quando a ação exige conta (apoiar, criar perfil).
 *
 * Só LOGIN. Criar conta manda pro jogo, porque é lá que a árvore de indicação
 * é montada (ver a nota em data/session.ts). Meia dúzia de linhas a mais aqui
 * criaria usuário órfão sem crédito de rede.
 */
import { forwardRef, useEffect, useRef, useState, type FormEvent } from 'react';
import { signInWithEmail } from '@/supabase/auth';
import { signupUrl } from '../data/session';

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
  const firstField = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
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

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await signInWithEmail(email, password);
    setBusy(false);
    if (res.ok) {
      onClose();
      return;
    }
    setError(res.error ?? 'Não deu pra entrar. Confere e-mail e senha.');
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
        <h2 className="rev-display mt-2 text-[34px]">Entra na Olefoot</h2>
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'rgba(237,235,228,.6)' }}>
          É a mesma conta do jogo. Se ainda não tem, cria em 1 minuto — é de graça.
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
            autoComplete="current-password"
          />

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
            disabled={busy || !email.trim() || !password}
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="mt-5 flex flex-col gap-2 border-t pt-4" style={{ borderColor: 'rgba(255,255,255,.08)' }}>
          <a
            href={signupUrl()}
            className="rev-label rev-focus text-[11px]"
            style={{ color: 'var(--color-rev-yellow)' }}
          >
            Não tenho conta — criar agora →
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

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Shield, AlertTriangle } from 'lucide-react';
import { adminPanelLogin } from '@/supabase/adminPanelAuth';

export function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: import('react').FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const r = await adminPanelLogin(email.trim(), password);
      if (r.ok) {
        navigate('/admin', { replace: true });
      } else {
        setError(r.error ?? 'Falha na autenticação.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-svh w-full min-w-0 flex-col items-center justify-center bg-deep-black px-4 py-10 sm:px-6">
      <div className="sports-panel w-full min-w-0 max-w-md rounded-xl p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-neon-yellow/40 bg-neon-yellow/10">
            <Shield className="h-7 w-7 text-neon-yellow" />
          </div>
          <h1 className="font-display text-center text-2xl font-bold uppercase tracking-wide text-white">
            Painel Admin
          </h1>
          <p className="text-center text-[11px] text-white/50">
            Acesso restrito — credencial separada do jogo.
          </p>
        </div>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="space-y-4"
          autoComplete="off"
        >
          {/* Campos invisíveis "isca" — Chrome autofill guarda aqui em vez de
              sobrescrever os campos reais. Sem isto, o Chrome insere credenciais
              do jogo no lugar das credenciais de painel que o admin digitou. */}
          <input type="text" name="fake-user" autoComplete="username" style={{ display: 'none' }} tabIndex={-1} aria-hidden />
          <input type="password" name="fake-pass" autoComplete="current-password" style={{ display: 'none' }} tabIndex={-1} aria-hidden />

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-white/65">E-mail do painel</span>
            <input
              type="email"
              name="admin-panel-email"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-neon-yellow/50 focus:outline-none focus:ring-1 focus:ring-neon-yellow/30"
              placeholder="credencial separada do jogo"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-white/65">Senha do painel</span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                type="password"
                name="admin-panel-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2.5 pl-9 text-sm text-white placeholder:text-white/35 focus:border-neon-yellow/50 focus:outline-none focus:ring-1 focus:ring-neon-yellow/30"
                placeholder="a senha criada via SQL"
                required
                minLength={6}
              />
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-white/35">
              ⚠️ Esta senha é <strong className="text-white/60">separada</strong> da senha do jogo.
              Se o Chrome auto-preencheu, apaga e digita a senha correta manualmente.
            </p>
          </label>

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy || !email || !password}
            className="btn-primary w-full disabled:pointer-events-none disabled:opacity-40"
          >
            <span className="btn-primary-inner justify-center">
              {busy ? 'Verificando…' : 'Entrar no painel'}
            </span>
          </button>
        </form>

        <div className="mt-6 flex justify-center border-t border-white/5 pt-4">
          <Link to="/" className="text-[11px] text-white/40 transition-colors hover:text-white">
            ← Voltar para o jogo
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * DEFINIR SENHA — /reset-senha
 *
 * ── O BURACO QUE ISTO TAPA ──────────────────────────────────────────────────
 * Todo atleta cadastrado PELO OLE SCOUT tem conta que ele nunca criou: o e-mail
 * está confirmado, a ficha é dele, e ninguém nunca escolheu uma senha. Sem uma
 * saída, esse atleta não entra no painel dele nunca — não tem senha pra digitar
 * e não tem por onde pedir uma. Foi exatamente o caso do Breno Liborge, o
 * primeiro a precisar entrar.
 *
 * ── POR QUE NÃO RESOLVE COM MAGIC LINK DO DASHBOARD ─────────────────────────
 * Duas razões, e as duas são fatais:
 *   1. O link do painel do Supabase redireciona pra Site URL do projeto, que é o
 *      domínio do JOGO. A sessão nasceria em game.olefoot.com.
 *   2. Sessão do supabase-js vive em localStorage, e localStorage é POR ORIGEM.
 *      game.olefoot.com e revela.olefoot.com são origens diferentes — logar num
 *      não loga no outro.
 * Aqui o `redirectTo` é montado a partir de `window.location.origin`, então o
 * e-mail disparado do REVELA volta pro REVELA. E isso vale pra qualquer atleta,
 * sem ninguém do time precisar abrir o Supabase.
 *
 * ── PRECISA DA LISTA DE REDIRECT ────────────────────────────────────────────
 * `https://revela.olefoot.com/**` tem que estar em Authentication → URL
 * Configuration → Redirect URLs. Sem isso o Supabase ignora o `redirectTo` e
 * manda pra Site URL — o atleta cai no jogo e a tela abaixo nunca aparece.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { updateUserPassword } from '@/supabase/auth';
import { getSupabase } from '@/supabase/client';
import { Eyebrow } from '../components/primitives';

export function ResetSenhaPage({
  onNote,
}: {
  onNote: (title: string, body?: string, tone?: 'yellow' | 'green') => void;
}) {
  const navigate = useNavigate();
  const [pronto, setPronto] = useState(false);
  const [temSessao, setTemSessao] = useState(false);
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const sb = getSupabase();
    if (!sb) {
      setErro('Sem conexão agora.');
      setPronto(true);
      return;
    }
    // O supabase-js lê o token de recuperação do hash da URL e dispara
    // PASSWORD_RECOVERY. A sessão que nasce daí só serve pra trocar a senha.
    const { data: sub } = sb.auth.onAuthStateChange((evento, sessao) => {
      if (evento === 'PASSWORD_RECOVERY' || sessao) setTemSessao(true);
    });
    void sb.auth.getSession().then(({ data }) => {
      if (data.session) setTemSessao(true);
      setPronto(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submeter(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErro(null);

    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (senha !== confirma) {
      setErro('As duas senhas não são iguais.');
      return;
    }

    setBusy(true);
    const res = await updateUserPassword(senha);
    setBusy(false);

    if (!res.ok) {
      setErro(res.error ?? 'Não deu pra salvar a senha. Tenta de novo.');
      return;
    }

    onNote('Senha criada', 'Agora é só usar ela pra entrar.', 'green');
    navigate('/meu-perfil', { replace: true });
  }

  return (
    <main className="rev-section grid min-h-[70vh] place-items-center">
      <div className="w-full max-w-[440px]">
        <Eyebrow>Sua conta</Eyebrow>
        <h1 className="rev-display mt-4" style={{ fontSize: 'clamp(32px,5.5vw,54px)', lineHeight: 0.96 }}>
          Escolha sua senha
        </h1>

        {!pronto ? (
          <p className="mt-5 text-[14px]" style={{ color: 'rgba(237,235,228,.5)' }}>
            Conferindo o link…
          </p>
        ) : !temSessao ? (
          <>
            <p className="mt-4 max-w-[42ch] text-[14px] leading-relaxed" style={{ color: 'rgba(237,235,228,.55)' }}>
              Esse link já foi usado ou passou da validade. Pede um novo na tela de entrar —
              leva alguns segundos e chega no teu e-mail.
            </p>
            <Link to="/" className="rev-btn rev-focus mt-7" data-variant="yellow" data-on="dark">
              Voltar
            </Link>
          </>
        ) : (
          <>
            <p className="mt-4 max-w-[42ch] text-[14px] leading-relaxed" style={{ color: 'rgba(237,235,228,.55)' }}>
              Essa é a senha que você vai usar pra entrar no REVELA e no jogo. Guarda ela.
            </p>

            <form onSubmit={submeter} className="mt-7 flex flex-col gap-3">
              <Campo label="Nova senha" value={senha} onChange={setSenha} />
              <Campo label="Repete a senha" value={confirma} onChange={setConfirma} />

              {erro && (
                <p className="text-[12px]" style={{ color: 'var(--color-rev-danger)' }}>
                  {erro}
                </p>
              )}

              <button
                type="submit"
                className="rev-btn rev-focus mt-1"
                data-variant="yellow"
                data-on="dark"
                disabled={busy || senha.length < 6 || confirma.length < 6}
              >
                {busy ? 'Salvando…' : 'Salvar e entrar'}
              </button>
              <p className="text-[11px]" style={{ color: 'rgba(237,235,228,.38)' }}>
                Seis caracteres pra cima.
              </p>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

function Campo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="rev-label mb-1.5 block text-[10px]" style={{ color: 'rgba(237,235,228,.5)' }}>
        {label}
      </span>
      <input
        type="password"
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={6}
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

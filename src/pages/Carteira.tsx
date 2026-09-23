/**
 * /carteira — a carteira própria da OLEFOOT (A VIRADA · V1).
 *
 * O que ela faz hoje: cria, guarda cifrada, restaura, mostra o endereço e o
 * saldo, e VINCULA — que é o motivo dela existir. O resgate do airdrop já
 * funciona desde setembro, mas só pra quem tem Phantom, e são zero de 69
 * credores. Esta tela é a porta pra quem não tem carteira nenhuma.
 *
 * O que ela NÃO faz, de propósito: enviar, comprar, depositar. Nada aqui move
 * dinheiro, e por isso nada aqui precisa de confirmação de transação ainda.
 *
 * A frase aparece UMA vez, na criação. Depois disso ela só existe cifrada no
 * aparelho, e a chave derivada só existe em memória enquanto a carteira está
 * aberta.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Eye, Lock, RefreshCw, Trash2 } from 'lucide-react';
import { useCarteira } from '@/wallet/seed/useCarteira';
import { fraseValida, normalizarFrase, PALAVRAS_NA_FRASE } from '@/wallet/seed/mnemonic';
import { buscarSaldo, meuVinculo, vincular, type Saldo } from '@/wallet/seed/carteiraApi';

type Passo = 'inicio' | 'frase' | 'senha' | 'restaurar';

const BOTAO_VOLT =
  'flex h-13 w-full items-center justify-center bg-neon-yellow px-4 font-num text-[13px] font-extrabold uppercase tracking-[0.04em] text-deep-black disabled:opacity-40';
const BOTAO_LINHA =
  'flex h-13 w-full items-center justify-center border border-white/30 px-4 font-num text-[13px] font-extrabold uppercase tracking-[0.04em] text-white disabled:opacity-40';
const CAMPO =
  'h-12 w-full border border-white/10 bg-panel px-3 font-mono text-[14px] text-white outline-none focus:border-neon-yellow';

function Cabecalho({ titulo, onVoltar }: { titulo: string; onVoltar?: () => void }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2.5 bg-nav px-4">
      {onVoltar ? (
        <button type="button" onClick={onVoltar} aria-label="Voltar"
          className="flex h-8 w-8 items-center justify-center border border-white/15">
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
        </button>
      ) : (
        <Link to="/wallet" aria-label="Voltar"
          className="flex h-8 w-8 items-center justify-center border border-white/15">
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
        </Link>
      )}
      <span className="font-display text-[16px] tracking-[0.02em]">{titulo}</span>
    </div>
  );
}

function Aviso({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <div className="border-l-[3px] border-atencao bg-sheet px-3.5 py-3">
      {titulo && (
        <p className="font-num text-[11px] font-extrabold uppercase tracking-[0.04em] text-atencao">{titulo}</p>
      )}
      <p className="mt-1 text-[12px] leading-relaxed text-giz">{children}</p>
    </div>
  );
}

export default function Carteira() {
  const w = useCarteira();
  const [passo, setPasso] = useState<Passo>('inicio');
  const [frase, setFrase] = useState<string[]>([]);
  const [copiado, setCopiado] = useState(false);
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');
  const [digitada, setDigitada] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [vinculo, setVinculo] = useState<{ endereco: string; verificado: boolean } | null>(null);
  const [vinculando, setVinculando] = useState(false);

  const limpar = () => { setSenha(''); setSenha2(''); setDigitada(''); setMsg(null); };

  const atualizarSaldo = useCallback(async (endereco: string) => {
    setSaldo(await buscarSaldo(endereco));
  }, []);

  useEffect(() => {
    if (w.estado !== 'aberta' || !w.endereco) return;
    void atualizarSaldo(w.endereco);
    void meuVinculo().then(setVinculo);
  }, [w.estado, w.endereco, atualizarSaldo]);

  // ---------------------------------------------------------------- criar ---
  const comecarCriacao = () => { setFrase(w.novaFrase()); setCopiado(false); setPasso('frase'); };

  const confirmarSenha = async () => {
    setMsg(null);
    if (senha !== senha2) { setMsg('As duas senhas não são iguais.'); return; }
    const palavras = passo === 'restaurar' ? normalizarFrase(digitada) : frase;
    if (passo === 'restaurar' && !fraseValida(palavras)) {
      setMsg(`A frase não fecha. Confira as ${PALAVRAS_NA_FRASE} palavras e a ordem.`);
      return;
    }
    try {
      await w.criar(palavras, senha);
      limpar(); setFrase([]); setPasso('inicio');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'não deu');
    }
  };

  const destrancar = async () => {
    setMsg(null);
    try { await w.destrancar(senha); limpar(); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'não deu'); }
  };

  const fazerVinculo = async () => {
    if (!w.chave) return;
    setVinculando(true); setMsg(null);
    const r = await vincular(w.chave);
    setVinculando(false);
    if (r.ok && r.endereco) {
      setVinculo({ endereco: r.endereco, verificado: true });
      setMsg(null);
    } else {
      setMsg(r.erro ?? 'Não foi possível vincular.');
    }
  };

  const copiarFrase = async () => {
    try { await navigator.clipboard.writeText(frase.join(' ')); setCopiado(true); }
    catch { setMsg('Não consegui copiar. Anote à mão — é mais seguro de qualquer jeito.'); }
  };

  // ================================================================ telas ===
  if (w.estado === 'carregando') return <div className="min-h-screen bg-asfalto" />;

  // --- trancada ---
  if (w.estado === 'trancada') {
    return (
      <div className="flex min-h-screen flex-col bg-asfalto text-white">
        <Cabecalho titulo="CARTEIRA" />
        <div className="flex flex-1 flex-col justify-center gap-4 px-4">
          <div>
            <p className="font-mono text-[11px] text-poeira">#trancada</p>
            <h1 className="mt-1 font-display text-[30px] uppercase leading-[1.1]">Sua senha</h1>
            {w.endereco && (
              <p className="mt-1 truncate font-mono text-[12px] text-cimento">{w.endereco}</p>
            )}
          </div>
          <input type="password" className={CAMPO} placeholder="senha" value={senha} autoFocus
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void destrancar(); }} />
          {(msg || w.erro) && <p className="text-[12px] text-baixa">{msg ?? w.erro}</p>}
          <button type="button" className={BOTAO_VOLT} disabled={w.ocupado || !senha} onClick={() => void destrancar()}>
            {w.ocupado ? 'Abrindo…' : 'Abrir carteira'}
          </button>
          <button type="button" className="text-[12px] text-poeira underline"
            onClick={() => { if (confirm('Isto apaga a carteira DESTE aparelho. Sem a frase de 12 palavras, ela não volta. Continuar?')) w.esquecer(); }}>
            Esqueci a senha — apagar deste aparelho
          </button>
        </div>
      </div>
    );
  }

  // --- aberta ---
  if (w.estado === 'aberta' && w.chave) {
    const jaVinculada = vinculo?.verificado && vinculo.endereco === w.chave.endereco;
    return (
      <div className="flex min-h-screen flex-col bg-asfalto text-white">
        <Cabecalho titulo="CARTEIRA" />
        <div className="flex flex-1 flex-col gap-4 px-4 pb-8 pt-5">
          <div>
            <p className="font-mono text-[11px] text-poeira">#solana</p>
            <p className="mt-0.5 font-num text-[40px] font-extrabold leading-[1.05]">
              {saldo ? saldo.sol.toFixed(4) : '—'}
            </p>
            <p className="text-[12px] text-cimento">SOL neste endereço</p>
          </div>

          <div className="border border-white/10 bg-panel px-3.5 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">Seu endereço</p>
            {/* `break-all` do Tailwind não sai no CSS gerado aqui — o endereço de 44
                caracteres vazava pra fora do card. Estilo explícito não depende disso. */}
            <p className="mt-1 font-mono text-[13px]" style={{ wordBreak: 'break-all' }}>
              {w.chave.endereco}
            </p>
            <div className="mt-2.5 flex gap-2">
              <button type="button" className="flex items-center gap-1.5 border border-white/25 px-2.5 py-1.5 text-[12px]"
                onClick={() => void navigator.clipboard.writeText(w.chave!.endereco)}>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </button>
              <button type="button" className="flex items-center gap-1.5 border border-white/25 px-2.5 py-1.5 text-[12px]"
                onClick={() => void atualizarSaldo(w.chave!.endereco)}>
                <RefreshCw className="h-3.5 w-3.5" /> Saldo
              </button>
            </div>
          </div>

          {jaVinculada ? (
            <div className="flex items-center gap-2 border border-alta/40 bg-panel px-3.5 py-3">
              <Check className="h-4 w-4 shrink-0 text-alta" strokeWidth={2.5} />
              <p className="text-[13px] text-giz">Vinculada à sua conta. O airdrop da v1 cai aqui.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 border border-white/10 bg-panel px-3.5 py-3.5">
              <p className="font-num text-[13px] font-extrabold uppercase">Receber o airdrop da v1</p>
              <p className="text-[12px] leading-relaxed text-cimento">
                Uma assinatura prova que esta carteira é sua. Não move fundos e não custa taxa.
              </p>
              <button type="button" className={BOTAO_VOLT} disabled={vinculando} onClick={() => void fazerVinculo()}>
                {vinculando ? 'Assinando…' : 'Vincular esta carteira'}
              </button>
            </div>
          )}

          {msg && <p className="text-[12px] text-baixa">{msg}</p>}

          <div className="mt-auto flex gap-2">
            <button type="button" className={BOTAO_LINHA} onClick={w.trancar}>
              <Lock className="mr-2 h-4 w-4" /> Trancar
            </button>
            <button type="button" className={`${BOTAO_LINHA} border-baixa/40 text-baixa`}
              onClick={() => { if (confirm('Apagar a carteira DESTE aparelho? Sem a frase de 12 palavras, ela não volta.')) w.esquecer(); }}>
              <Trash2 className="mr-2 h-4 w-4" /> Apagar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- a frase, uma vez só ---
  if (passo === 'frase') {
    return (
      <div className="flex min-h-screen flex-col bg-asfalto text-white">
        <Cabecalho titulo="SUA FRASE" onVoltar={() => setPasso('inicio')} />
        <div className="flex flex-1 flex-col gap-3.5 px-4 pb-8 pt-4">
          <Aviso titulo="Anote no papel">
            Em ordem. Quem tiver estas {PALAVRAS_NA_FRASE} palavras é dono desta carteira. Print é roubado.
          </Aviso>
          <div className="grid grid-cols-3 gap-2">
            {frase.map((p, i) => (
              <div key={`${i}-${p}`} className="flex items-baseline gap-1.5 border border-white/10 bg-panel px-2 py-2.5">
                <span className="font-mono text-[10px] text-poeira">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-mono text-[13px]">{p}</span>
              </div>
            ))}
          </div>
          <div className="border border-white/10 bg-panel px-3.5 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">Leia uma vez</p>
            <p className="mt-1.5 text-[12px] leading-[1.55] text-giz">
              Estas palavras vêm da lista da OLEFOOT, não da lista padrão.{' '}
              <strong className="text-white">Elas não abrem sua carteira na Phantom nem na Solflare.</strong>{' '}
              A lista é pública, então qualquer desenvolvedor reconstrói esta carteira — com ou sem a gente.
            </p>
          </div>
          <button type="button" className={BOTAO_LINHA} onClick={() => void copiarFrase()}>
            {copiado ? <Check className="mr-2 h-4 w-4 text-alta" /> : <Copy className="mr-2 h-4 w-4" />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
          <button type="button" className={`${BOTAO_VOLT} mt-auto`} onClick={() => { limpar(); setPasso('senha'); }}>
            Anotei as {PALAVRAS_NA_FRASE} palavras
          </button>
        </div>
      </div>
    );
  }

  // --- senha (criação e restauração terminam aqui) ---
  if (passo === 'senha' || passo === 'restaurar') {
    const restaurando = passo === 'restaurar';
    return (
      <div className="flex min-h-screen flex-col bg-asfalto text-white">
        <Cabecalho titulo={restaurando ? 'RESTAURAR' : 'SENHA'} onVoltar={() => { limpar(); setPasso(restaurando ? 'inicio' : 'frase'); }} />
        <div className="flex flex-1 flex-col gap-3.5 px-4 pb-8 pt-4">
          {restaurando && (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">Sua frase</p>
              <textarea rows={4} className={`${CAMPO} h-auto py-2.5 leading-relaxed`} autoFocus
                placeholder={`as ${PALAVRAS_NA_FRASE} palavras, separadas por espaço`}
                value={digitada} onChange={(e) => setDigitada(e.target.value)} />
            </>
          )}
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">
            Senha deste aparelho
          </p>
          <input type="password" className={CAMPO} placeholder="senha" value={senha}
            autoFocus={!restaurando} onChange={(e) => setSenha(e.target.value)} />
          <input type="password" className={CAMPO} placeholder="repita a senha" value={senha2}
            onChange={(e) => setSenha2(e.target.value)} />
          <p className="text-[11px] leading-relaxed text-poeira">
            A senha cifra a frase neste aparelho. Ela não recupera nada: se esquecer a senha,
            quem traz a carteira de volta são as {PALAVRAS_NA_FRASE} palavras.
          </p>
          {(msg || w.erro) && <p className="text-[12px] text-baixa">{msg ?? w.erro}</p>}
          <button type="button" className={`${BOTAO_VOLT} mt-auto`}
            disabled={w.ocupado || !senha || !senha2 || (restaurando && !digitada.trim())}
            onClick={() => void confirmarSenha()}>
            {w.ocupado ? 'Cifrando…' : restaurando ? 'Restaurar carteira' : 'Criar carteira'}
          </button>
        </div>
      </div>
    );
  }

  // --- início ---
  return (
    <div className="flex min-h-screen flex-col bg-asfalto px-5 pb-6 pt-8 text-white">
      <img src="/brand/olefoot-yellow-01.svg" alt="OLEFOOT" className="block h-[26px] w-[138px] shrink-0 self-start" />
      <div className="flex flex-1 flex-col justify-center gap-2.5">
        <p className="font-mono text-[11px] text-poeira">#carteira</p>
        <h1 className="font-display text-[44px] uppercase leading-[1.08]">
          Sua chave.<br />Seu time.
        </h1>
        <p className="mt-1 text-[14px] leading-relaxed text-cimento">
          {PALAVRAS_NA_FRASE} palavras de futebol são a carteira inteira. A gente nunca vê
          e não consegue trazer de volta.
        </p>
      </div>
      <div className="flex flex-col gap-2.5">
        <button type="button" className={BOTAO_VOLT} onClick={comecarCriacao}>Criar carteira</button>
        <button type="button" className={BOTAO_LINHA} onClick={() => { limpar(); setPasso('restaurar'); }}>
          <Eye className="mr-2 h-4 w-4" /> Já tenho uma frase
        </button>
        <p className="mt-1 text-[11px] leading-relaxed text-poeira">
          A OLEFOOT não guarda seus fundos e não recupera frase perdida.
        </p>
      </div>
    </div>
  );
}

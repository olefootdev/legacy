/**
 * PIN da carteira — as telas da Fase 5.
 *
 * `GateDePin` fecha a aba DEX pra quem CRIOU um PIN; `PinCard` cria e troca.
 * A conferência é sempre do servidor (ver src/wallet/pinClient.ts) — aqui só
 * mora a tela e a memória curta de "já abri nesta sessão", que vale 5 minutos
 * e morre com a aba. As ações de dinheiro (trocar carteira vinculada, time
 * padrão) pedem o PIN de novo na hora: abrir a tela não gasta a fricção delas.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { definirPin, lerPinEstado, mensagemDoPin, reentrarComSenha, verificarPin } from '@/wallet/pinClient';

const CHAVE_LIBERADO = 'olefoot.pin-liberado-ate';
const VALE_POR_MS = 5 * 60 * 1000;

const liberado = () => {
  const ate = Number(sessionStorage.getItem(CHAVE_LIBERADO) ?? 0);
  return Number.isFinite(ate) && ate > Date.now();
};
const liberar = () => sessionStorage.setItem(CHAVE_LIBERADO, String(Date.now() + VALE_POR_MS));

const CAMPO_PIN =
  'h-[50px] w-full border border-white/16 bg-card px-4 text-center font-mono text-[18px] tracking-[0.5em] ' +
  'text-white outline-none placeholder:tracking-normal placeholder:text-poeira focus:border-white/40';

export function CampoPin({ valor, aoMudar, aoEnviar, placeholder = 'PIN de 6 números', foco }: {
  valor: string; aoMudar: (v: string) => void; aoEnviar: () => void; placeholder?: string; foco?: boolean;
}) {
  return (
    <input
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={6}
      className={CAMPO_PIN}
      placeholder={placeholder}
      value={valor}
      autoFocus={foco}
      onChange={(e) => aoMudar(e.target.value.replace(/\D/g, '').slice(0, 6))}
      onKeyDown={(e) => { if (e.key === 'Enter' && valor.length === 6) aoEnviar(); }}
    />
  );
}

/** Fecha o conteúdo atrás do PIN — só pra quem criou um. */
export function GateDePin({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<'carregando' | 'aberto' | 'pedindo'>('carregando');
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);

  useEffect(() => {
    let vivo = true;
    void lerPinEstado().then((e) => {
      if (!vivo) return;
      // Sem estado (sem sessão, rede fora) a tela abre: o que é dinheiro tem
      // o próprio gate no servidor — este aqui é privacidade da tela.
      setEstado(e?.temPin && !liberado() ? 'pedindo' : 'aberto');
    });
    return () => { vivo = false; };
  }, []);

  if (estado !== 'pedindo') return <>{estado === 'aberto' ? children : null}</>;

  const conferir = async () => {
    if (conferindo || pin.length !== 6) return;
    setConferindo(true);
    setErro(null);
    const r = await verificarPin(pin);
    setConferindo(false);
    setPin('');
    if (r.ok) { liberar(); setEstado('aberto'); return; }
    setErro(mensagemDoPin(r.motivo, r.tentaDeNovoEm));
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-10 pt-8">
      <div>
        <p className="font-mono text-[11px] text-poeira">#pin</p>
        <h2 className="ole-num mt-1 text-[26px] uppercase leading-tight text-white">Carteira protegida</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-cimento">
          Você trancou esta aba com um PIN. Ele é conferido no servidor.
        </p>
      </div>
      <CampoPin valor={pin} aoMudar={setPin} aoEnviar={() => void conferir()} foco />
      {erro && <p className="text-[12px] text-baixa">{erro}</p>}
      <button
        type="button"
        disabled={conferindo || pin.length !== 6}
        onClick={() => void conferir()}
        className="ole-num inline-flex h-[50px] w-full items-center justify-center bg-neon-yellow text-[13px] uppercase text-black transition-colors hover:bg-white disabled:opacity-50 [--corte:12px] [clip-path:var(--clip-corte)]"
      >
        {conferindo ? 'Conferindo…' : 'Abrir'}
      </button>
    </div>
  );
}

/** Criar ou trocar o PIN. A troca exige login dos últimos 5 minutos. */
export function PinCard() {
  const [temPin, setTemPin] = useState<boolean | null>(null);
  const [aberto, setAberto] = useState(false);
  const [pin, setPin] = useState('');
  const [repete, setRepete] = useState('');
  const [senha, setSenha] = useState('');
  const [pedeSenha, setPedeSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    void lerPinEstado().then((e) => { if (vivo.current) setTemPin(e ? e.temPin : null); });
    return () => { vivo.current = false; };
  }, []);

  if (temPin === null) return null;

  const fechar = () => {
    setAberto(false); setPin(''); setRepete(''); setSenha('');
    setPedeSenha(false); setErro(null); setFeito(false);
  };

  const salvar = async () => {
    if (salvando) return;
    setErro(null);
    if (pin.length !== 6) { setErro('O PIN tem 6 números.'); return; }
    if (pin !== repete) { setErro('Os dois PINs não são iguais.'); return; }
    setSalvando(true);
    // Troca exige login fresco: se o servidor disser login_antigo, a senha da
    // conta reentra aqui mesmo e a troca segue — é também o caminho de quem
    // esqueceu o PIN.
    if (pedeSenha) {
      const e = await reentrarComSenha(senha);
      if (e) { setSalvando(false); setErro(e); return; }
    }
    const r = await definirPin(pin);
    setSalvando(false);
    if (r.ok) {
      setTemPin(true);
      setFeito(true);
      setPin(''); setRepete(''); setSenha(''); setPedeSenha(false);
      return;
    }
    if (r.motivo === 'login_antigo') {
      setPedeSenha(true);
      setErro('Confirme a senha da sua conta pra trocar o PIN.');
      return;
    }
    setErro(mensagemDoPin(r.motivo));
  };

  return (
    <div className="border border-white/10 bg-panel px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">PIN da carteira</p>
          <p className="mt-1 text-[12px] leading-relaxed text-cimento">
            {temPin
              ? 'Ativo. Abre esta aba e assina troca de carteira e time padrão.'
              : 'Tranque esta aba e as ações da carteira com 6 números.'}
          </p>
        </div>
        {!aberto && (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="ole-num shrink-0 border border-white/30 px-3.5 py-2.5 text-[12px] uppercase text-white transition-colors hover:border-white"
          >
            {temPin ? 'Trocar' : 'Criar PIN'}
          </button>
        )}
      </div>

      {aberto && (
        <div className="mt-3.5 flex flex-col gap-2.5 border-t border-white/10 pt-3.5">
          {feito ? (
            <>
              <p className="text-[12.5px] leading-relaxed text-giz">
                PIN salvo. Guarde de cabeça: ele não aparece de novo.
              </p>
              <button type="button" onClick={fechar}
                className="self-start text-[12px] text-poeira underline">Fechar</button>
            </>
          ) : (
            <>
              <CampoPin valor={pin} aoMudar={setPin} aoEnviar={() => void salvar()}
                placeholder={temPin ? 'novo PIN de 6 números' : 'PIN de 6 números'} foco />
              <CampoPin valor={repete} aoMudar={setRepete} aoEnviar={() => void salvar()}
                placeholder="repita o PIN" />
              {pedeSenha && (
                <input
                  type="password"
                  autoComplete="current-password"
                  className="h-[50px] w-full border border-white/16 bg-card px-4 text-[14px] text-white outline-none placeholder:text-poeira focus:border-white/40"
                  placeholder="senha da sua conta"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void salvar(); }}
                />
              )}
              {erro && <p className="text-[12px] text-baixa">{erro}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={salvando || pin.length !== 6 || repete.length !== 6 || (pedeSenha && !senha)}
                  onClick={() => void salvar()}
                  className="ole-num inline-flex h-[46px] flex-1 items-center justify-center bg-neon-yellow text-[13px] uppercase text-black transition-colors hover:bg-white disabled:opacity-50"
                >
                  {salvando ? 'Salvando…' : temPin ? 'Trocar PIN' : 'Criar PIN'}
                </button>
                <button type="button" onClick={fechar}
                  className="border border-white/25 px-3.5 text-[12px] text-cimento">Cancelar</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

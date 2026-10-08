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
import { BarraSegmentos, BotaoRua, SeloRua } from '@/components/ui/Rua';
import { L } from '@/i18n/L';

const CHAVE_LIBERADO = 'olefoot.pin-liberado-ate';
const VALE_POR_MS = 5 * 60 * 1000;

const liberado = () => {
  const ate = Number(sessionStorage.getItem(CHAVE_LIBERADO) ?? 0);
  return Number.isFinite(ate) && ate > Date.now();
};
const liberar = () => sessionStorage.setItem(CHAVE_LIBERADO, String(Date.now() + VALE_POR_MS));

// DS 2027: campo em concreto, número em A PROVA; o foco é ação, então acende rua.
const CAMPO_PIN =
  'h-[54px] w-full min-w-0 border-2 border-linha bg-concreto px-4 text-center font-prova text-[20px] font-bold tracking-[0.5em] ' +
  'text-papel outline-none transition-colors placeholder:text-[13px] placeholder:font-medium placeholder:tracking-[0.08em] placeholder:text-fio focus:border-rua';

export function CampoPin({ valor, aoMudar, aoEnviar, placeholder = L('PIN de 6 números', '6-digit PIN'), foco }: {
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
    // DS 2027 · o cofre trancado: título na voz, régua de ouro (o que está
    // atrás é valor teu), e os 6 números como barra de segmentos.
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-10 pt-8">
      <div className="flex flex-col gap-1.5 border-b-[3px] border-ouro-27 pb-5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">— #pin</p>
          <span className="inline-flex shrink-0 items-center gap-1.5 font-prova text-[11.5px] font-bold uppercase tracking-[0.2em] text-mudo">
            Solana <span aria-hidden className="text-ouro-27">●</span>
          </span>
        </div>
        <h2 className="font-voz text-[clamp(44px,13vw,64px)] leading-[0.92] text-papel">{L('Carteira protegida', 'Wallet protected')}</h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-suave">
          {L('Você trancou esta aba com um PIN. Ele é conferido no servidor.', 'You locked this tab with a PIN. It is checked on the server.')}
        </p>
      </div>
      <div className="flex flex-col gap-2.5">
        <CampoPin valor={pin} aoMudar={setPin} aoEnviar={() => void conferir()} foco />
        <BarraSegmentos valor={pin.length} max={6} segmentos={6} className="h-2" />
      </div>
      {erro && <p role="alert" className="font-prova text-[12px] text-baixa">{erro}</p>}
      <BotaoRua
        onClick={() => void conferir()}
        disabled={conferindo || pin.length !== 6}
        className="w-full"
      >
        {conferindo ? L('Conferindo…', 'Checking…') : <>{L('Abrir', 'Open')} <span aria-hidden>→</span></>}
      </BotaoRua>
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
    if (pin.length !== 6) { setErro(L('O PIN tem 6 números.', 'The PIN has 6 digits.')); return; }
    if (pin !== repete) { setErro(L('Os dois PINs não são iguais.', 'The two PINs don\'t match.')); return; }
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
      setErro(L('Confirme a senha da sua conta pra trocar o PIN.', 'Confirm your account password to change the PIN.'));
      return;
    }
    setErro(mensagemDoPin(r.motivo));
  };

  return (
    <div className="bg-concreto px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">— {L('PIN da carteira', 'Wallet PIN')}</p>
            {temPin ? <SeloRua tom="ouro-contorno">{L('Ativo', 'Active')}</SeloRua> : null}
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-suave">
            {temPin
              ? L('Ativo. Abre esta aba e assina troca de carteira e time padrão.', 'Active. Opens this tab and signs wallet and default-team changes.')
              : L('Tranque esta aba e as ações da carteira com 6 números.', 'Lock this tab and wallet actions with 6 digits.')}
          </p>
        </div>
        {!aberto && (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="inline-flex min-h-[46px] shrink-0 items-center gap-1.5 border-2 border-papel px-4 font-impact text-[17px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27"
          >
            {temPin ? L('Trocar', 'Change') : L('Criar PIN', 'Create PIN')}
          </button>
        )}
      </div>

      {aberto && (
        <div className="mt-4 flex flex-col gap-2.5 border-t-2 border-linha pt-4">
          {feito ? (
            <>
              <p className="font-voz text-[28px] leading-none text-ouro-27">{L('Trancado.', 'Locked.')}</p>
              <p className="text-[13px] leading-relaxed text-suave">
                {L('PIN salvo. Guarde de cabeça: ele não aparece de novo.', 'PIN saved. Memorize it: it won\'t be shown again.')}
              </p>
              <button type="button" onClick={fechar}
                className="min-h-[44px] self-start font-prova text-[12px] font-bold uppercase tracking-[0.16em] text-mudo underline underline-offset-4 hover:text-papel">{L('Fechar', 'Close')}</button>
            </>
          ) : (
            <>
              <CampoPin valor={pin} aoMudar={setPin} aoEnviar={() => void salvar()}
                placeholder={temPin ? L('novo PIN de 6 números', 'new 6-digit PIN') : L('PIN de 6 números', '6-digit PIN')} foco />
              <CampoPin valor={repete} aoMudar={setRepete} aoEnviar={() => void salvar()}
                placeholder={L('repita o PIN', 'repeat the PIN')} />
              {pedeSenha && (
                <input
                  type="password"
                  autoComplete="current-password"
                  className="h-[54px] w-full min-w-0 border-2 border-linha bg-asfalto-27 px-4 text-[15px] text-papel outline-none transition-colors placeholder:text-fio focus:border-rua"
                  placeholder={L('senha da sua conta', 'your account password')}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void salvar(); }}
                />
              )}
              {erro && <p role="alert" className="font-prova text-[12px] text-baixa">{erro}</p>}
              <div className="mt-1 flex gap-3">
                <BotaoRua
                  onClick={() => void salvar()}
                  disabled={salvando || pin.length !== 6 || repete.length !== 6 || (pedeSenha && !senha)}
                  className="min-h-[50px] flex-1 px-3 text-[18px]"
                >
                  {salvando ? L('Salvando…', 'Saving…') : <>{temPin ? L('Trocar PIN', 'Change PIN') : L('Criar PIN', 'Create PIN')} <span aria-hidden>→</span></>}
                </BotaoRua>
                <button type="button" onClick={fechar}
                  className="min-h-[50px] shrink-0 border-2 border-linha px-3.5 font-prova text-[12px] font-bold uppercase tracking-[0.12em] text-mudo transition-colors hover:border-papel hover:text-papel">{L('Cancelar', 'Cancel')}</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { fraseDoMotivo, resgatarLicenca } from '@/supabase/expansaoLicenca';
import { avisarQueAPosicaoMudou } from '@/wallet/eventosDaCarteira';
import { L } from '@/i18n/L';

/**
 * A segunda porta da ativação: a licença que a OLEFOOT entrega.
 *
 * Fica fechada atrás de um link porque é a exceção — quem chega pela vitrine
 * compra o pack. Ativa a conta no plano de equiparação e NÃO dá OLEFOOT; a tela
 * diz isso antes do botão, pra ninguém procurar token depois.
 */
export function AtivarComLicenca({ aoAtivar }: { aoAtivar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (ok) {
    return <p className="mt-4 font-prova text-[12px] font-bold uppercase tracking-[0.14em] text-ouro-27">● {ok}</p>;
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-4 min-h-[44px] w-full text-center font-prova text-[12px] font-bold uppercase tracking-[0.16em] text-mudo underline underline-offset-4 transition-colors hover:text-papel"
      >
        {L('Tenho uma licença', 'I have a license')}
      </button>
    );
  }

  const enviar = async () => {
    if (enviando || !codigo.trim()) return;
    setEnviando(true);
    setErro(null);
    const r = await resgatarLicenca(codigo);
    setEnviando(false);
    if ('motivo' in r) { setErro(fraseDoMotivo(r.motivo)); return; }
    setOk(r.patrocinador ? L(`Conta ativada · time de @${r.patrocinador}`, `Account activated · @${r.patrocinador}'s team`) : L('Conta ativada', 'Account activated'));
    avisarQueAPosicaoMudou();
    aoAtivar();
  };

  return (
    <form
      className="mt-5 border-t-2 border-linha pt-4"
      onSubmit={(e) => { e.preventDefault(); void enviar(); }}
    >
      <label htmlFor="licenca" className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
        — {L('Licença', 'License')}
      </label>
      <input
        id="licenca"
        value={codigo}
        onChange={(e) => { setCodigo(e.target.value.toUpperCase()); setErro(null); }}
        placeholder="OLE-XXXX-XXXX-XXXX"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={24}
        className="mt-2 h-[52px] w-full min-w-0 border-2 border-linha bg-asfalto-27 px-3 font-prova text-[16px] font-bold tracking-[0.12em] text-papel placeholder:text-fio transition-colors focus:border-rua focus:outline-none"
      />
      <p className="mt-2 font-prova text-[11.5px] leading-relaxed text-mudo">
        {L('Ativa o convite e a equiparação. Não gera OLEFOOT.', 'Activates the invite and matching. Doesn\'t generate OLEFOOT.')}
      </p>
      {erro ? <p role="alert" className="mt-2 font-prova text-[12px] text-atencao">{erro}</p> : null}
      <button
        type="submit"
        disabled={enviando || !codigo.trim()}
        className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 border-2 border-papel px-4 font-impact text-[18px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27 disabled:pointer-events-none disabled:opacity-40"
      >
        {enviando ? L('Ativando…', 'Activating…') : <>{L('Ativar com licença', 'Activate with license')} <span aria-hidden>→</span></>}
      </button>
    </form>
  );
}

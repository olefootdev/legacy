import { useState } from 'react';
import { fraseDoMotivo, resgatarLicenca } from '@/supabase/expansaoLicenca';
import { avisarQueAPosicaoMudou } from '@/wallet/eventosDaCarteira';

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
    return <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-emerald-300">{ok}</p>;
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-3 w-full text-center font-mono text-[11px] uppercase tracking-wider text-cimento underline-offset-4 hover:text-white hover:underline"
      >
        Tenho uma licença
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
    setOk(r.patrocinador ? `Conta ativada · time de @${r.patrocinador}` : 'Conta ativada');
    avisarQueAPosicaoMudou();
    aoAtivar();
  };

  return (
    <form
      className="mt-4 border-t border-white/10 pt-4"
      onSubmit={(e) => { e.preventDefault(); void enviar(); }}
    >
      <label htmlFor="licenca" className="font-mono text-[10px] uppercase tracking-wider text-cimento">
        Licença
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
        className="mt-1.5 h-[46px] w-full min-w-0 border border-white/15 bg-black px-3 font-mono text-[15px] tracking-wider text-white placeholder:text-poeira focus:border-white focus:outline-none"
      />
      <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-poeira">
        Ativa o convite e a equiparação. Não gera OLEFOOT.
      </p>
      {erro ? <p role="alert" className="mt-2 text-[12px] text-atencao">{erro}</p> : null}
      <button
        type="submit"
        disabled={enviando || !codigo.trim()}
        className="ole-num mt-3 flex h-[46px] w-full items-center justify-center border border-white/30 text-[12px] uppercase text-white transition-colors hover:border-white disabled:opacity-40"
      >
        {enviando ? 'Ativando…' : 'Ativar com licença'}
      </button>
    </form>
  );
}

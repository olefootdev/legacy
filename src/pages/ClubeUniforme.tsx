/**
 * CLUBE · UNIFORME (14/10/2026) — a camisa do clube, editável a qualquer hora.
 *
 * Antes a camisa só existia na Fundação. Aqui o manager muda peça por peça
 * (corpo, mangas, calção, meião, gola, punho, texto do peito) e salva: a camisa
 * vale em todo aparelho (servidor) e veste o time no campo do LEGACY.
 * Não mexe em formação nem no DNA — a camisa não chega ao motor.
 */
import { useMemo, useState } from 'react';
import { BackButton } from '@/components/BackButton';
import { SecaoRua } from '@/components/ui/Rua';
import { CriadorDeUniforme } from '@/components/uniforme/CriadorDeUniforme';
import { camisaDoClube, type CamisaDoClube } from '@/club/camisa';
import { useGameDispatch, useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import { useTrackScreen } from '@/progression/trackEvent';
import { L } from '@/i18n/L';

export default function ClubeUniforme() {
  useTrackScreen('screen_club_hub');
  const dispatch = useGameDispatch();
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);
  const salva = useMemo(() => camisaDoClube(club), [club]);
  const [camisa, setCamisa] = useState<CamisaDoClube>(salva);
  const [salvoEm, setSalvoEm] = useState<number | null>(null);
  const iniciais = (club.shortName || '').toUpperCase().slice(0, 3);
  const mudou = JSON.stringify({ ...camisa, editadaEm: undefined }) !== JSON.stringify({ ...salva, editadaEm: undefined });

  // As costas mostram o craque do time (o melhor atacante; sem elenco, a sigla e o 10).
  const craque = useMemo(() => {
    const lista = Object.values(players);
    const atacantes = lista.filter((p) => /ATA|CA|PD|PE|ST/i.test(p.pos));
    const melhor = (atacantes.length ? atacantes : lista).sort((a, b) => overallFromAttributes(b.attrs, b.pos) - overallFromAttributes(a.attrs, a.pos))[0];
    return melhor ? { nome: (melhor.name.split(' ').slice(-1)[0] ?? melhor.name).toUpperCase(), numero: melhor.num } : null;
  }, [players]);

  const salvar = () => {
    dispatch({ type: 'SET_CLUB_CAMISA', camisa });
    setSalvoEm(Date.now());
  };

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-6 px-4 pb-32 pt-4 text-papel">
      <BackButton to="/clube" label={L('Clube', 'Club')} />
      <header className="flex flex-col gap-1">
        <span className="font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-rua">— {club.name}</span>
        <h1 className="font-impact text-[48px] uppercase leading-[0.9]">{L('Uniforme', 'Kit')}</h1>
        <p className="text-[14px] text-suave">{L('Peça por peça. Ele veste o time no campo do LEGACY.', 'Piece by piece. It dresses your team on the LEGACY pitch.')}</p>
      </header>

      <CriadorDeUniforme camisa={camisa} onChange={(c) => { setCamisa(c); setSalvoEm(null); }} iniciais={iniciais} nome={craque?.nome} numero={craque?.numero} />

      <section className="flex flex-col gap-2.5">
        <SecaoRua label={L('O goleiro', 'Goalkeeper')} />
        <p className="text-[13px] text-suave">{L('O goleiro entra com uma cor bem diferente da linha, escolhida pelo jogo (o juiz exige).', 'The keeper wears a colour clearly different from the outfield, picked by the game (referee rules).')}</p>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-linha bg-asfalto-27/95 px-4 py-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <button
            type="button"
            onClick={() => { setCamisa(salva); setSalvoEm(null); }}
            disabled={!mudou}
            className="min-h-[52px] border-2 border-linha px-4 font-prova text-[12px] uppercase tracking-[0.12em] text-papel disabled:opacity-40"
          >
            {L('Desfazer', 'Undo')}
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={!mudou}
            className="min-h-[52px] flex-1 bg-rua px-4 font-impact text-[22px] uppercase text-asfalto-27 disabled:opacity-50"
          >
            {salvoEm && !mudou ? L('Uniforme salvo ✓', 'Kit saved ✓') : L('Salvar uniforme', 'Save kit')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * PLAYERVIP — Fase 8 da Partida Viva: as partidas da sua lenda.
 *
 * Cada vez que um manager escala a lenda numa partida LEGACY, o filme fica no
 * servidor com a lenda marcada. Aqui o atleta vê a lista e abre o filme com a
 * Câmera do Craque já nele (/playervip/filme/:id). Quem escalou não aparece:
 * só o placar, a lenda e os gols.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { L, LOCALE } from '@/i18n/L';
import { listarFilmesDaLenda, type PartidaDaLenda } from '@/partidaViva/filmeServidor';
import { ligarSom } from '@/partidaViva/som';

export function PartidasDaLenda() {
  const navigate = useNavigate();
  const [partidas, setPartidas] = useState<PartidaDaLenda[] | null>(null);
  useEffect(() => { void listarFilmesDaLenda().then(setPartidas); }, []);
  if (partidas === null) return <div className="h-14 animate-pulse bg-concreto" />;
  if (!partidas.length) {
    return (
      <div className="bg-concreto px-4 py-4 font-sans text-[13px] text-suave">
        {L('Quando um manager escalar a sua lenda numa partida LEGACY, ela aparece aqui — pra assistir com a câmera seguindo você.',
          'When a manager fields your legend in a LEGACY match, it shows up here — to watch with the camera following you.')}
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {partidas.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => { ligarSom(); navigate(`/playervip/filme/${p.id}`); }}
          className="flex min-w-0 items-center gap-3 bg-concreto px-3 py-3 text-left transition-colors hover:bg-linha"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-voz text-[22px] leading-none text-papel">{p.nome}</span>
            <span className="mt-1 block font-prova text-[11px] text-suave">
              {p.placar.siglaCasa} {p.placar.placarCasa} × {p.placar.placarFora} {p.placar.siglaFora}
              {' · '}
              {new Date(p.quando).toLocaleString(LOCALE, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          </span>
          {p.gols > 0 && (
            <span className="shrink-0 -rotate-2 bg-rua px-2 py-0.5 font-impact text-[15px] text-asfalto-27">
              {p.gols === 1 ? L('GOL', 'GOAL') : L(`${p.gols} GOLS`, `${p.gols} GOALS`)}
            </span>
          )}
          <span aria-hidden className="shrink-0 font-impact text-[22px] text-ouro-27">▶</span>
        </button>
      ))}
    </div>
  );
}

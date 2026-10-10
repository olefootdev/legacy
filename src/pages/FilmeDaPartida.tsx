/**
 * PARTIDA VIVA — Fase 6: o filme da partida (docs/PARTIDA-VIVA-PLANO.md §8).
 *
 * /match/filme      → os filmes guardados neste aparelho
 * /match/filme/:id  → toca o filme no campo: o mesmo palco do LEGACY, recebendo
 *                     os quadros gravados nos mesmos passos (a partida volta
 *                     idêntica), com Câmera do Craque.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { L } from '@/i18n/L';
import { PartidaVivaPalco } from '@/partidaViva/PartidaVivaPalco';
import { criarCanalAoVivo } from '@/partidaViva/canal';
import { abrirFilme, listarFilmes } from '@/partidaViva/gravacao';
import { ligarSom } from '@/partidaViva/som';

function ListaDeFilmes() {
  const filmes = useMemo(() => listarFilmes(), []);
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3 px-4 py-6 text-papel">
      <h1 className="font-impact text-[34px] leading-none">{L('Filmes', 'Films')}</h1>
      <p className="font-prova text-[12px] text-mudo">
        {L('As partidas que você viu em campo no LEGACY, guardadas neste aparelho.', 'Matches you watched on the pitch in LEGACY, saved on this device.')}
      </p>
      {filmes.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => { ligarSom(); navigate(`/match/filme/${encodeURIComponent(f.id)}`); }}
          className="flex items-center justify-between border border-linha bg-concreto px-3 py-2.5 text-left"
        >
          <span>
            <span className="block font-impact text-[18px] leading-none">
              {f.siglaCasa} {f.placarCasa} × {f.placarFora} {f.siglaFora}
            </span>
            <span className="mt-1 block font-prova text-[11px] text-mudo">
              {new Date(f.quando).toLocaleString(L('pt-BR', 'en-US'), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {f.nomeFora}
            </span>
          </span>
          <span aria-hidden className="font-impact text-[22px] text-rua">▶</span>
        </button>
      ))}
      {!filmes.length && (
        <p className="border border-linha px-3 py-4 font-prova text-[12px] text-mudo">
          {L('Nenhum filme ainda. Jogue uma partida no LEGACY e ela fica aqui.', 'No films yet. Play a LEGACY match and it lands here.')}
        </p>
      )}
      <Link to="/" className="self-start font-prova text-[12px] text-suave underline">{L('Voltar', 'Back')}</Link>
    </div>
  );
}

function TocarFilme({ id }: { id: string }) {
  const navigate = useNavigate();
  const filme = useMemo(() => abrirFilme(id), [id]);
  const [trecho, setTrecho] = useState(0);
  const [velocidade, setVelocidade] = useState<1 | 2 | 4>(1);
  const canal = useMemo(() => criarCanalAoVivo(), [trecho]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!filme) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 font-prova text-[12px] text-papel">
        <p>{L('Este filme não está neste aparelho.', 'This film is not on this device.')}</p>
        <Link to="/match/filme" className="mt-3 inline-block underline">{L('Ver os filmes', 'See the films')}</Link>
      </div>
    );
  }
  const t = filme.trechos[trecho];
  const sair = () => navigate('/match/filme');
  if (!t) return <ListaDeFilmes />;
  return (
    <PartidaVivaPalco
      key={`${filme.id}-${trecho}`}
      canal={canal}
      fichas={filme.fichas}
      banco={filme.banco}
      formacaoCasa={t.formacaoCasa ?? filme.formacaoCasa}
      formacaoFora={filme.formacaoFora}
      seed={filme.seed}
      siglaCasa={filme.siglaCasa}
      siglaFora={filme.siglaFora}
      modo="lances"
      velocidade={velocidade}
      pulando={false}
      onModo={() => undefined}
      onVelocidade={setVelocidade}
      onPular={() => undefined}
      onSair={sair}
      comEntrada={t.comEntrada}
      roteiro={t.roteiro}
      onFimDoFilme={() => (trecho + 1 < filme.trechos.length ? setTrecho(trecho + 1) : sair())}
    />
  );
}

export default function FilmeDaPartida() {
  const { id } = useParams<{ id?: string }>();
  return id ? <TocarFilme id={id} /> : <ListaDeFilmes />;
}

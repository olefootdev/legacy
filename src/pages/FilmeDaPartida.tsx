/**
 * PARTIDA VIVA — Fase 6: o filme da partida (docs/PARTIDA-VIVA-PLANO.md §8).
 *
 * /match/filme      → os filmes guardados neste aparelho
 * /match/filme/:id  → toca o filme no campo: o mesmo palco do LEGACY, recebendo
 *                     os quadros gravados nos mesmos passos (a partida volta
 *                     idêntica), com Câmera do Craque.
 * /match/filme/s/:id → o mesmo, vindo do servidor (Fase 7). Se quem assiste é o
 *                     ADVERSÁRIO ("seu time jogou enquanto você dormia"), o time
 *                     dele é o destacado.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { L } from '@/i18n/L';
import { PartidaVivaPalco } from '@/partidaViva/PartidaVivaPalco';
import { criarCanalAoVivo } from '@/partidaViva/canal';
import { abrirFilme, listarFilmes, type FilmeDaPartida as Filme } from '@/partidaViva/gravacao';
import { abrirFilmeDaNuvem, listarFilmesDaNuvem, type FilmeNaNuvem } from '@/partidaViva/filmeServidor';
import { ligarSom } from '@/partidaViva/som';

function ListaDeFilmes() {
  const filmes = useMemo(() => listarFilmes(), []);
  const navigate = useNavigate();
  const [daNuvem, setDaNuvem] = useState<FilmeNaNuvem[]>([]);
  useEffect(() => { void listarFilmesDaNuvem().then(setDaNuvem); }, []);
  const contraVoce = daNuvem.filter((f) => f.papel === 'adversario');
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3 px-4 py-6 text-papel">
      <h1 className="font-impact text-[34px] leading-none">{L('Filmes', 'Films')}</h1>
      {contraVoce.length > 0 && (
        <>
          <h2 className="mt-1 font-impact text-[20px] leading-none text-rua">{L('Jogaram contra o seu time', 'They played your team')}</h2>
          {contraVoce.map((f) => {
            const r = f.resumo;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => { ligarSom(); navigate(`/match/filme/s/${f.id}`); }}
                className="flex items-center justify-between border border-rua bg-concreto px-3 py-2.5 text-left"
              >
                <span>
                  <span className="block font-impact text-[18px] leading-none">
                    {r.siglaFora} {r.placarFora} × {r.placarCasa} {r.siglaCasa}
                    {f.novo && <span className="ml-2 bg-rua px-1 align-middle font-prova text-[10px] text-asfalto-27">{L('NOVO', 'NEW')}</span>}
                  </span>
                  <span className="mt-1 block font-prova text-[11px] text-mudo">
                    {L(`Desafiado por ${r.nomeCasa}`, `Challenged by ${r.nomeCasa}`)} · {new Date(f.quando).toLocaleString(L('pt-BR', 'en-US'), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
                <span aria-hidden className="font-impact text-[22px] text-rua">▶</span>
              </button>
            );
          })}
          <h2 className="mt-2 font-impact text-[20px] leading-none">{L('Suas partidas', 'Your matches')}</h2>
        </>
      )}
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
      {!filmes.length && !contraVoce.length && (
        <p className="border border-linha px-3 py-4 font-prova text-[12px] text-mudo">
          {L('Nenhum filme ainda. Jogue uma partida no LEGACY e ela fica aqui.', 'No films yet. Play a LEGACY match and it lands here.')}
        </p>
      )}
      <Link to="/" className="self-start font-prova text-[12px] text-suave underline">{L('Voltar', 'Back')}</Link>
    </div>
  );
}

function TocarFilme({ id, daNuvem }: { id: string; daNuvem?: boolean }) {
  const navigate = useNavigate();
  const local = useMemo(() => (daNuvem ? null : abrirFilme(id)), [id, daNuvem]);
  const [nuvem, setNuvem] = useState<{ filme: Filme; papel: 'dono' | 'adversario' } | null | 'carregando'>(daNuvem ? 'carregando' : null);
  useEffect(() => { if (daNuvem) void abrirFilmeDaNuvem(id).then(setNuvem); }, [id, daNuvem]);
  const filme = local ?? (nuvem && nuvem !== 'carregando' ? nuvem.filme : null);
  const papel = nuvem && nuvem !== 'carregando' ? nuvem.papel : 'dono';
  const [trecho, setTrecho] = useState(0);
  const [velocidade, setVelocidade] = useState<1 | 2 | 4>(1);
  const canal = useMemo(() => criarCanalAoVivo(), [trecho]); // eslint-disable-line react-hooks/exhaustive-deps
  if (nuvem === 'carregando') {
    return <div className="mx-auto max-w-xl px-4 py-6 font-prova text-[12px] text-mudo">{L('Carregando o filme…', 'Loading the film…')}</div>;
  }
  if (!filme) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 font-prova text-[12px] text-papel">
        <p>{daNuvem ? L('Não foi possível abrir este filme (entre na sua conta).', 'Could not open this film (sign in).') : L('Este filme não está neste aparelho.', 'This film is not on this device.')}</p>
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
      ladoDeQuemAssiste={papel === 'adversario' ? 'away' : 'home'}
      onFimDoFilme={() => (trecho + 1 < filme.trechos.length ? setTrecho(trecho + 1) : sair())}
    />
  );
}

export default function FilmeDaPartida() {
  const { id, idNuvem } = useParams<{ id?: string; idNuvem?: string }>();
  if (idNuvem) return <TocarFilme id={idNuvem} daNuvem />;
  return id ? <TocarFilme id={id} /> : <ListaDeFilmes />;
}

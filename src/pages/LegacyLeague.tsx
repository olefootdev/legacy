/**
 * LEGACY LEAGUE — a liga da Partida Viva (só se joga no modo LEGACY, em campo).
 *
 * Temporada semanal, tabela de pontos. Até 3 partidas por dia, sempre contra o
 * time de outro manager real, sorteado pelo servidor. A partida só vale com
 * custódia válida + o filme dela (prova de que foi vista em campo).
 * Liga Global e Liga Ole seguem no motor delas — esta é outra liga.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { L, LOCALE } from '@/i18n/L';
import { useGameDispatch } from '@/game/store';
import { abrirPartida, lerLiga, type EstadoDaLiga, type PartidaDaLiga } from '@/legacyLeague/cliente';
import { deitarTela } from '@/partidaViva/orientacao';
import { ligarSom } from '@/partidaViva/som';

const ROTULO = 'font-prova text-[11px] font-bold uppercase tracking-[0.18em]';

function diasAte(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

function SeloDaPartida({ p }: { p: PartidaDaLiga }) {
  const [texto, tom] = p.status === 'valida'
    ? [`${p.golsPro}×${p.golsContra} · +${p.pontos}`, 'bg-rua text-asfalto-27']
    : p.status === 'aberta' ? [L('em aberto', 'open'), 'border border-linha text-suave']
      : p.status === 'invalida' ? [L('não validada', 'not validated'), 'border border-linha text-baixa']
        : [L('expirou', 'expired'), 'border border-linha text-mudo'];
  return <span className={`shrink-0 px-1.5 py-0.5 font-prova text-[11px] ${tom}`}>{texto}</span>;
}

export default function LegacyLeague() {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const [estado, setEstado] = useState<EstadoDaLiga | 'sem_sessao' | 'indisponivel' | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => { void lerLiga().then(setEstado); }, []);
  useEffect(carregar, [carregar]);

  const jogar = async () => {
    // O toque libera som e tela deitada (o navegador só deixa dentro de um gesto).
    void deitarTela();
    ligarSom();
    setAbrindo(true);
    setErro(null);
    const r = await abrirPartida();
    setAbrindo(false);
    if ('erro' in r) {
      setErro(r.erro === 'limite do dia' ? L('Você já jogou as 3 partidas da liga hoje.', "You've played today's 3 league matches.") : L('A liga não abriu a partida agora. Tente de novo.', "The league couldn't open a match right now. Try again."));
      return;
    }
    dispatch({ type: 'ADMIN_PATCH_NEXT_FIXTURE', partial: { opponent: r.adversario, awayName: r.adversario.name } });
    navigate(`/match/ao-vivo?liga=${encodeURIComponent(r.partida)}`);
  };

  if (estado === null) return <div className="mx-auto max-w-xl px-4 py-8 font-prova text-[12px] text-mudo">{L('Carregando a liga…', 'Loading the league…')}</div>;
  if (estado === 'sem_sessao' || estado === 'indisponivel') {
    return (
      <div className="mx-auto max-w-xl px-4 py-8 text-papel">
        <h1 className="font-impact text-[40px] uppercase leading-none">Legacy League</h1>
        <p className="mt-3 font-prova text-[12px] text-mudo">
          {estado === 'sem_sessao' ? L('Entre na sua conta pra jogar a liga.', 'Sign in to play the league.') : L('A liga está fora do ar agora.', 'The league is offline right now.')}
        </p>
      </div>
    );
  }

  const e = estado;
  const semJogo = e.restantesHoje <= 0;
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6 text-papel">
      <header>
        <p className={`${ROTULO} text-rua`}>— {L('A liga da Partida Viva', 'The Live Match league')}</p>
        <h1 className="mt-1 font-impact text-[44px] uppercase leading-none">Legacy League</h1>
        <p className="mt-1 font-prova text-[12px] text-mudo">
          {L(`Temporada ${e.temporada} · termina em ${diasAte(e.terminaEm)} dia(s)`, `Season ${e.temporada} · ends in ${diasAte(e.terminaEm)} day(s)`)}
        </p>
      </header>

      {e.campeaoAnterior?.clube && (
        <div className="-rotate-1 self-start bg-ouro-27 px-3 py-2 text-asfalto-27">
          <p className="font-prova text-[10px] font-bold uppercase tracking-[0.18em]">{L('Campeão da semana passada', "Last week's champion")}</p>
          <p className="font-impact text-[22px] uppercase leading-none">
            {e.campeaoAnterior.voce ? L('Você!', 'You!') : e.campeaoAnterior.clube.nome} · {e.campeaoAnterior.pontos} pts
          </p>
        </div>
      )}

      {/* Minha campanha + jogar */}
      <section className="bg-concreto p-4">
        {e.minha ? (
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className={`${ROTULO} text-mudo`}>{L('Sua posição', 'Your position')}</p>
              <p className="font-spray text-[48px] font-black leading-none text-rua tabular-nums">{e.minha.posicao}º</p>
            </div>
            <div className="text-right font-prova text-[12px] text-suave">
              <p className="font-impact text-[26px] leading-none text-papel">{e.minha.pontos} pts</p>
              <p>{e.minha.v}V {e.minha.e}E {e.minha.d}D · {L('saldo', 'GD')} {e.minha.saldo > 0 ? `+${e.minha.saldo}` : e.minha.saldo}</p>
            </div>
          </div>
        ) : (
          <p className="font-sans text-[15px] font-bold">{L('Você ainda não pontuou nesta temporada.', "You haven't scored any points this season.")}</p>
        )}
        <button
          type="button"
          disabled={abrindo || semJogo}
          onClick={() => { void jogar(); }}
          className="mt-4 flex min-h-[64px] w-full items-center justify-between bg-rua px-4 text-left text-asfalto-27 disabled:opacity-50"
        >
          <span>
            <span className="block font-impact text-[24px] uppercase leading-none">
              {abrindo ? L('Sorteando o adversário…', 'Drawing the opponent…') : semJogo ? L('Volte amanhã', 'Come back tomorrow') : L('Jogar partida da liga', 'Play a league match')}
            </span>
            <span className="mt-1 block font-prova text-[11px]">
              {L(`${e.restantesHoje} de ${e.limitePorDia} hoje · em campo, no LEGACY`, `${e.restantesHoje} of ${e.limitePorDia} today · on the pitch, in LEGACY`)}
            </span>
          </span>
          <span aria-hidden className="font-impact text-[30px]">▶</span>
        </button>
        {erro && <p className="mt-2 font-prova text-[12px] text-baixa">{erro}</p>}
        <p className="mt-3 font-prova text-[11px] leading-snug text-mudo">
          {L('O adversário é o time de outro manager. Só vale a partida vista em campo e conferida pelo servidor.',
            "Your opponent is another manager's team. Only matches watched on the pitch and verified by the server count.")}
        </p>
      </section>

      {/* Tabela */}
      <section>
        <p className={`${ROTULO} mb-2 text-mudo`}>— {L('Tabela da semana', "This week's table")}</p>
        {e.tabela.length === 0 ? (
          <p className="border border-linha px-3 py-4 font-prova text-[12px] text-mudo">{L('Ninguém pontuou ainda. A primeira vitória lidera.', 'Nobody has scored yet. The first win takes the lead.')}</p>
        ) : (
          <ol className="flex flex-col">
            {e.tabela.map((l) => (
              <li key={l.posicao} className={`flex items-center gap-2 border-b border-linha px-2 py-2 font-prova text-[12px] ${l.voce ? 'bg-rua text-asfalto-27' : ''}`}>
                <span className="w-7 shrink-0 font-impact text-[16px] tabular-nums">{l.posicao}</span>
                <span className="min-w-0 flex-1 truncate font-sans text-[14px] font-bold">{l.voce ? L('Você', 'You') : l.clube?.nome ?? '—'}</span>
                <span className="w-16 shrink-0 text-right tabular-nums">{l.v}-{l.e}-{l.d}</span>
                <span className="w-9 shrink-0 text-right tabular-nums">{l.saldo > 0 ? `+${l.saldo}` : l.saldo}</span>
                <span className="w-9 shrink-0 text-right font-impact text-[16px] tabular-nums">{l.pontos}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Minhas partidas */}
      {e.partidas.length > 0 && (
        <section>
          <p className={`${ROTULO} mb-2 text-mudo`}>— {L('Suas partidas', 'Your matches')}</p>
          <ol className="flex flex-col gap-1">
            {e.partidas.map((p) => (
              <li key={p.id} className="flex items-center gap-2 bg-concreto px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-sans text-[14px] font-bold">{p.adversario?.nome ?? '—'}</span>
                  <span className="block font-prova text-[11px] text-mudo">
                    {new Date(p.quando).toLocaleString(LOCALE, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {p.status === 'invalida' && p.motivo ? ` · ${p.motivo}` : ''}
                  </span>
                </span>
                <SeloDaPartida p={p} />
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

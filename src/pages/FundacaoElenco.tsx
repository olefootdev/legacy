/**
 * FUNDAÇÃO DO CLUBE — Ato 4 · O elenco (Fase 2, 2026-10-07).
 *
 *   1 · Sorteio  — o SERVIDOR sorteia 12 Genesis + 3 cards premium (35/25/15% de
 *                  Lenda Edição Fundação). O grant entra no estado e persiste
 *                  ANTES da revelação: fechar a aba no meio não perde nada, e
 *                  voltar devolve o mesmo sorteio (idempotente no servidor).
 *   2 · Janela da Estreia — 7 dias: o Diretor de Futebol sugere quem vender pra
 *                  várzea (80% do valor, só jogador do pacote, nunca a Edição
 *                  Fundação, elenco nunca abaixo de 13). Corre em paralelo com
 *                  a Liga Global: o time já está inscrito.
 *   3 · Escalar  — XI sugerido pelo ENCAIXE no DNA do clube (o mesmo vetor que o
 *                  motor joga); tocar titular + reserva troca.
 *
 * Manager que já tem elenco e Janela aberta cai direto no passo 2.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameState, useGameDispatch, useGameStore } from '@/game/store';
import { flushAllPersistence } from '@/game/flushPersistence';
import { track } from '@/analytics/track';
import { L } from '@/i18n/L';
import { cn } from '@/lib/utils';
import { BarraSegmentos, BotaoRua, DEGRAU_CLASSES, FitaRua, MarcaRua, SecaoRua, SeloRua, degrauDe } from '@/components/ui/Rua';
import { EscudoSVG } from '@/components/fundacao/Camisa';
import { PITCH_SLOT_ORDER } from '@/entities/lineup';
import type { PlayerEntity } from '@/entities/types';
import { samePersonKey } from '@/entities/player';
import { dnaDoClubeParaMotor, dnaEfetivo, dnaNeutro, type EixoDna } from '@/club/identidade';
import { DIAS_DA_JANELA, montarElencoDaFundacao, pedirSorteio, type CartaDoSorteio } from '@/onboarding/sorteioFundacao';
import { JANELA_ELENCO_MINIMO, janelaAberta, valorNaVarzea } from '@/onboarding/janelaEstreia';
import { eixosFortes, encaixe, escalarPeloEncaixe, ovrDe, sugestaoDoDiretor } from '@/onboarding/encaixe';

type Etapa =
  | { k: 'sorteando' }
  | { k: 'erro'; msg: string }
  | { k: 'revelando'; cartas: CartaDoSorteio[]; viradas: number }
  | { k: 'janela' }
  | { k: 'escalar' };

const NOME_DO_EIXO: Record<EixoDna, string> = {
  posse: L('posse', 'possession'),
  pressao: L('pressão', 'pressing'),
  vertical: L('verticalidade', 'directness'),
  criatividade: L('criatividade', 'creativity'),
  solidez: L('solidez', 'solidity'),
  disciplina: L('disciplina', 'discipline'),
  intensidade: L('intensidade', 'intensity'),
};

const fmtExp = (n: number) => n.toLocaleString('pt-BR');

function Cabecalho({ rotulo, titulo, destaque, voz }: { rotulo: string; titulo: string; destaque: string; voz?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <SecaoRua label={rotulo} />
      <h1 className="font-impact text-[clamp(40px,11vw,56px)] uppercase leading-[0.9] text-papel [text-wrap:balance]">
        {titulo} <span className="block text-rua">{destaque}</span>
      </h1>
      {voz ? <p className="font-voz text-[24px] leading-[1.05] text-papel">{voz}</p> : null}
    </div>
  );
}

/** Carta do jogador no degrau do OVR. Lenda Edição Fundação ganha selo próprio. */
function Carta({ p, enc, virada = true, chance, pequena }: { p: PlayerEntity; enc: number; virada?: boolean; chance?: number; pequena?: boolean }) {
  const ovr = ovrDe(p);
  if (!virada) {
    return (
      <div className={cn('flex aspect-[2/3] flex-col items-center justify-center gap-2 border-[3px] border-dashed border-ouro-27 bg-asfalto-27 p-2 text-center', pequena && 'aspect-auto py-4')}>
        <span className="font-impact text-[32px] leading-none text-ouro-27">?</span>
        {chance != null && (
          <span className="font-prova text-[11px] font-bold uppercase tracking-[0.12em] text-ouro-27">
            {Math.round(chance * 100)}% {L('de lenda', 'legend')}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className={cn('flex aspect-[2/3] flex-col justify-between p-2', DEGRAU_CLASSES[degrauDe(ovr)], pequena && 'aspect-auto gap-2 py-3')}>
      <div className="flex items-start justify-between gap-1">
        <span className="font-impact text-[30px] leading-none">{ovr}</span>
        <span className="font-prova text-[11px] font-bold uppercase">{p.pos}</span>
      </div>
      {p.portraitUrl && !pequena ? (
        <img src={p.portraitUrl} alt="" className="mx-auto h-[44%] w-auto object-cover" loading="lazy" />
      ) : null}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-impact text-[15px] uppercase leading-none">{p.name}</span>
        <span className="font-prova text-[10px] font-bold uppercase tracking-[0.1em] opacity-80">
          {p.edicaoFundacao ? L('Lenda · Ed. Fundação', 'Legend · Founding Ed.') : `${L('Encaixe', 'Fit')} ${enc}`}
        </span>
      </div>
    </div>
  );
}

export default function FundacaoElenco() {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);
  const lineup = useGameStore((s) => s.lineup);
  const formacao = useGameStore((s) => s.manager.formationScheme);
  const identidade = club.identidade;
  const dna = useMemo(() => dnaEfetivo(dnaDoClubeParaMotor(identidade) ?? dnaNeutro()), [identidade]);
  const fortes = useMemo(() => eixosFortes(dna, 2), [dna]);
  const iniciais = (club.shortName || '').toUpperCase().slice(0, 3);

  const temElenco = Object.keys(players).length > 0;
  const [etapa, setEtapa] = useState<Etapa>(() =>
    temElenco ? (janelaAberta(identidade?.janelaAte) ? { k: 'janela' } : { k: 'escalar' }) : { k: 'sorteando' },
  );
  const iniciou = useRef(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [etapa.k]);

  // Sem fundação, não tem DNA pra encaixar: volta pro começo.
  useEffect(() => {
    if (!identidade) navigate('/fundacao', { replace: true });
  }, [identidade, navigate]);

  // 1 · Sorteio + grant imediato.
  useEffect(() => {
    if (etapa.k !== 'sorteando' || iniciou.current || !identidade) return;
    iniciou.current = true;
    void (async () => {
      const r = await pedirSorteio();
      if (r.ok === false) return setEtapa({ k: 'erro', msg: r.erro });
      const elenco = await montarElencoDaFundacao(r.sorteio);
      if (!elenco) return setEtapa({ k: 'erro', msg: L('Não deu pra montar o elenco agora: o catálogo não carregou ou um jogador saiu dele. Tenta de novo.', "Couldn't build the squad right now: the catalogue didn't load or a player left it. Try again.") });
      // Outra aba pode ter feito o grant nesse meio tempo: não duplica.
      if (Object.keys(getGameState().players ?? {}).length === 0) {
        const xi = escalarPeloEncaixe(elenco.players, dna);
        dispatch({
          type: 'GRANT_ONBOARDING_PACKAGE',
          players: elenco.players,
          lineup: Object.keys(xi).length === 11 ? xi : elenco.lineup,
          formationScheme: identidade.formacao,
          starterExpAmount: elenco.expInicial,
        });
        dispatch({ type: 'SET_USER_SETTINGS', partial: { hasDoneOnboarding: true } });
        const janelaAte = new Date(Date.now() + DIAS_DA_JANELA * 86_400_000).toISOString();
        dispatch({ type: 'SET_CLUB_IDENTIDADE', identidade: { ...identidade, janelaAte, pacote: elenco.pacote } });
        track('fundacao_sorteio', { lendas: elenco.cartas.filter((c) => c.origem === 'lenda').length, expTier: r.sorteio.expTier });
        try {
          await flushAllPersistence();
        } catch {
          /* o persist debounced tenta de novo */
        }
      }
      setEtapa({ k: 'revelando', cartas: elenco.cartas, viradas: 0 });
    })();
  }, [etapa.k, identidade, dna, dispatch]);

  if (!identidade) return null;

  const elenco = Object.values(players);
  const pacote = identidade.pacote ?? [];
  const titulares = new Set(Object.values(lineup));
  const janelaAte = identidade.janelaAte;
  const diasRestantes = janelaAte ? Math.max(0, Math.ceil((Date.parse(janelaAte) - Date.now()) / 86_400_000)) : 0;

  return (
    <div className="rua-grao min-h-[100dvh] bg-black text-papel">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col bg-asfalto-27 min-[480px]:border-x-2 min-[480px]:border-linha">
        <header className="sticky top-0 z-20 flex flex-col gap-2 border-b-2 border-linha bg-black px-4 pb-2.5 pt-[max(12px,env(safe-area-inset-top,0px))]">
          <div className="flex items-center justify-between gap-3">
            <EscudoSVG primaria={identidade.camisa.primaria} secundaria={identidade.camisa.secundaria} iniciais={iniciais} largura={30} />
            <MarcaRua tipo="wordmark" label="Olefoot" className="h-[18px] bg-rua" />
            <span className="w-[30px]" aria-hidden />
          </div>
          <div className="grid h-1.5 grid-cols-3 gap-1" aria-hidden>
            {(['revelando', 'janela', 'escalar'] as const).map((k, i) => {
              const atual = etapa.k === 'sorteando' || etapa.k === 'erro' || etapa.k === 'revelando' ? 0 : etapa.k === 'janela' ? 1 : 2;
              return <span key={k} className={i < atual ? 'bg-papel' : i === atual ? 'bg-rua' : 'bg-linha'} />;
            })}
          </div>
          <div className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
            {L('Ato', 'Act')} 4 · <b className="text-rua">{L('O elenco', 'The squad')}</b>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-6 px-4 pb-32 pt-5">
          {etapa.k === 'sorteando' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <span className="font-impact text-[44px] uppercase leading-none text-rua">{L('Sorteando…', 'Drawing…')}</span>
              <p className="font-voz text-[22px] leading-tight">{L('15 jogadores. 3 cards podem ser lenda.', '15 players. 3 cards may be legends.')}</p>
            </div>
          )}

          {etapa.k === 'erro' && (
            <div className="flex flex-1 flex-col justify-center gap-4">
              <Cabecalho rotulo={L('Sorteio', 'Draw')} titulo={L('Deu ruim', 'Something broke')} destaque={L('no sorteio.', 'in the draw.')} />
              <p className="border-l-[5px] border-rua bg-concreto p-4 text-[15px]">{etapa.msg}</p>
              <p className="font-prova text-[12px] text-mudo">{L('Teu sorteio fica guardado: tentar de novo traz o mesmo elenco.', 'Your draw is saved: retrying brings the same squad.')}</p>
              <BotaoRua onClick={() => { iniciou.current = false; setEtapa({ k: 'sorteando' }); }}>{L('Tentar de novo', 'Try again')}</BotaoRua>
            </div>
          )}

          {etapa.k === 'revelando' && (
            <Revelacao
              cartas={etapa.cartas}
              viradas={etapa.viradas}
              players={players}
              dna={dna}
              onVirar={(n) => setEtapa({ ...etapa, viradas: n })}
            />
          )}

          {etapa.k === 'janela' && (
            <Janela
              elenco={elenco}
              players={players}
              lineup={lineup}
              pacote={pacote}
              dna={dna}
              fortes={fortes}
              diasRestantes={diasRestantes}
              titulares={titulares}
              onVender={(p) => {
                dispatch({ type: 'VENDER_PARA_VARZEA', playerId: p.id });
                track('fundacao_venda_varzea', { ovr: ovrDe(p), valor: valorNaVarzea(p) });
              }}
            />
          )}

          {etapa.k === 'escalar' && <Escalar players={players} lineup={lineup} dna={dna} formacao={formacao} />}
        </main>

        {(etapa.k === 'revelando' || etapa.k === 'janela') && (
          <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center bg-black/90 px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3">
            <button
              type="button"
              onClick={() => {
                if (etapa.k === 'revelando') {
                  if (etapa.viradas < etapa.cartas.length) setEtapa({ ...etapa, viradas: etapa.cartas.length });
                  else setEtapa(janelaAberta(janelaAte) ? { k: 'janela' } : { k: 'escalar' });
                } else setEtapa({ k: 'escalar' });
              }}
              className="min-h-[56px] w-full max-w-[408px] bg-rua font-impact text-[22px] uppercase text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5"
            >
              {etapa.k === 'revelando'
                ? etapa.viradas < etapa.cartas.length
                  ? L('Revelar tudo', 'Reveal all')
                  : L('Abrir a Janela →', 'Open the window →')
                : L('Escalar o time →', 'Pick the XI →')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 1 · Revelação ─────────────────────────────────────────────────────────── */

function Revelacao({
  cartas,
  viradas,
  players,
  dna,
  onVirar,
}: {
  cartas: CartaDoSorteio[];
  viradas: number;
  players: Record<string, PlayerEntity>;
  dna: ReturnType<typeof dnaEfetivo>;
  onVirar: (n: number) => void;
}) {
  const base = cartas.filter((c) => c.origem === 'genesis');
  const premium = cartas.filter((c) => c.origem !== 'genesis');
  // Os 12 de base viram sozinhos em cascata; os 3 premium, um toque cada.
  useEffect(() => {
    if (viradas >= base.length) return;
    const t = setTimeout(() => onVirar(viradas + 1), 140);
    return () => clearTimeout(t);
  }, [viradas, base.length, onVirar]);
  const lendas = premium.filter((c) => c.origem === 'lenda').length;
  const tudo = viradas >= cartas.length;

  return (
    <>
      <FitaRua className="-mx-4 -mt-3 py-2" />
      <Cabecalho
        rotulo={L('Ato 4 · o elenco', 'Act 4 · the squad')}
        titulo={L('Teu', 'Your')}
        destaque={L('elenco.', 'squad.')}
        voz={L('Doze da base. Três cards podem ser lenda.', 'Twelve core players. Three cards may be legends.')}
      />
      <div className="grid grid-cols-4 gap-1.5">
        {base.map((c, i) => {
          const p = players[c.playerId];
          return p ? <Carta key={c.playerId} p={p} enc={encaixe(p, dna)} virada={i < viradas} pequena /> : null;
        })}
      </div>
      <SecaoRua label={L('Cards premium', 'Premium cards')} />
      <div className="grid grid-cols-3 gap-2">
        {premium.map((c, i) => {
          const p = players[c.playerId];
          const idx = base.length + i;
          const virada = idx < viradas;
          const podeVirar = viradas === idx && viradas >= base.length;
          return p ? (
            <button
              key={c.playerId}
              type="button"
              disabled={!podeVirar}
              onClick={() => onVirar(idx + 1)}
              aria-label={virada ? p.name : L(`Virar card premium ${i + 1}`, `Flip premium card ${i + 1}`)}
              className={cn('text-left', podeVirar && 'outline outline-[3px] outline-offset-2 outline-rua')}
            >
              <Carta p={p} enc={encaixe(p, dna)} virada={virada} chance={c.chance} />
            </button>
          ) : null;
        })}
      </div>
      {tudo && (
        <div className={cn('p-4', lendas > 0 ? 'bg-ouro-27 text-asfalto-27' : 'border-l-[5px] border-rua bg-concreto')}>
          <p className="font-impact text-[26px] uppercase leading-none">
            {lendas > 0
              ? L(`${lendas} lenda${lendas > 1 ? 's' : ''} no elenco.`, `${lendas} legend${lendas > 1 ? 's' : ''} in the squad.`)
              : L('Sem lenda dessa vez.', 'No legend this time.')}
          </p>
          <p className="mt-1.5 text-[14px] leading-snug">
            {lendas > 0
              ? L('Edição Fundação: joga por ti a vida inteira, não se vende nem se empresta.', 'Founding Edition: plays for you for life, cannot be sold or loaned.')
              : L('Os cards premium vieram do topo do catálogo Genesis. A Janela da Estreia abre agora.', 'The premium cards came from the top of the Genesis catalogue. The debut window opens now.')}
          </p>
        </div>
      )}
      {!tudo && viradas >= base.length && (
        <p className="text-center font-prova text-[12px] font-bold uppercase tracking-[0.16em] text-rua">{L('Toca no card pra virar', 'Tap the card to flip')}</p>
      )}
    </>
  );
}

/* ── 2 · Janela da Estreia ─────────────────────────────────────────────────── */

function Janela({
  elenco,
  players,
  lineup,
  pacote,
  dna,
  fortes,
  diasRestantes,
  titulares,
  onVender,
}: {
  elenco: PlayerEntity[];
  players: Record<string, PlayerEntity>;
  lineup: Record<string, string>;
  pacote: string[];
  dna: ReturnType<typeof dnaEfetivo>;
  fortes: EixoDna[];
  diasRestantes: number;
  titulares: Set<string>;
  onVender: (p: PlayerEntity) => void;
}) {
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const sugestao = sugestaoDoDiretor(players, lineup, pacote, dna);
  const podeVender = elenco.length > JANELA_ELENCO_MINIMO;
  const ordenado = [...elenco].sort((a, b) => encaixe(b, dna) - encaixe(a, dna));

  return (
    <>
      <Cabecalho
        rotulo={L(`Janela da estreia · ${diasRestantes} dia${diasRestantes === 1 ? '' : 's'}`, `Debut window · ${diasRestantes} day${diasRestantes === 1 ? '' : 's'}`)}
        titulo={L('Ajusta', 'Tune')}
        destaque={L('o elenco.', 'the squad.')}
        voz={L('A Liga Global já começou. Teu time está inscrito.', 'The Global League has started. Your team is in.')}
      />
      <div className="flex flex-col gap-2 border-l-[5px] border-rua bg-concreto p-4">
        <span className="font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">{L('Diretor de futebol', 'Director of football')}</span>
        <p className="text-[15px] leading-snug">
          {L('Teu time pede', 'Your team asks for')} <b className="text-rua">{NOME_DO_EIXO[fortes[0]!]}</b> {L('e', 'and')}{' '}
          <b className="text-rua">{NOME_DO_EIXO[fortes[1]!]}</b>.{' '}
          {sugestao && podeVender
            ? L(
                `${sugestao.name} é quem menos encaixa fora do XI: a várzea paga ${fmtExp(valorNaVarzea(sugestao))} EXP.`,
                `${sugestao.name} is the worst fit outside the XI: the várzea pays ${fmtExp(valorNaVarzea(sugestao))} EXP.`,
              )
            : L('O elenco está no mínimo pra temporada. Reforço, só pelo mercado.', 'The squad is at the minimum for the season. Signings only via the market.')}
        </p>
        <BotaoRua variante="contorno" to="/mercado" className="self-start">
          {L('Ver o mercado Genesis', 'See the Genesis market')}
        </BotaoRua>
      </div>

      <div className="flex items-center justify-between">
        <SecaoRua label={L(`Elenco · ${elenco.length}`, `Squad · ${elenco.length}`)} />
        <span className="font-prova text-[11px] text-mudo">{L(`mínimo ${JANELA_ELENCO_MINIMO}`, `minimum ${JANELA_ELENCO_MINIMO}`)}</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {ordenado.map((p) => {
          const enc = encaixe(p, dna);
          const vendivel = podeVender && pacote.includes(p.id) && !p.edicaoFundacao;
          const ovr = ovrDe(p);
          return (
            <li key={p.id} className="flex flex-col gap-2 border-2 border-linha bg-concreto p-2.5">
              <div className="flex items-center gap-3">
                <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center font-impact text-[22px]', DEGRAU_CLASSES[degrauDe(ovr)])}>{ovr}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-impact text-[17px] uppercase leading-none">{p.name}</span>
                    {titulares.has(p.id) && <SeloRua tom="mudo" className="text-[10px]">XI</SeloRua>}
                    {p.edicaoFundacao && <SeloRua tom="ouro" className="text-[10px]">{L('Lenda', 'Legend')}</SeloRua>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 font-prova text-[11px] font-bold text-mudo">{p.pos}</span>
                    <BarraSegmentos valor={enc} max={100} className="h-2 flex-1" />
                    <span className="w-7 text-right font-prova text-[11px] font-bold">{enc}</span>
                  </div>
                </div>
                {vendivel && confirmando !== p.id && (
                  <button
                    type="button"
                    onClick={() => setConfirmando(p.id)}
                    className="min-h-[36px] shrink-0 border-2 border-linha px-2.5 font-prova text-[11px] font-bold uppercase tracking-[0.1em] text-mudo hover:border-papel hover:text-papel"
                  >
                    {L('Vender', 'Sell')}
                  </button>
                )}
              </div>
              {confirmando === p.id && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-linha pt-2">
                  <span className="text-[13px]">
                    {L('Várzea paga', 'Várzea pays')} <b className="font-impact text-[17px] text-rua">{fmtExp(valorNaVarzea(p))} EXP</b>
                  </span>
                  <div className="flex gap-2">
                    <BotaoRua variante="vazio" onClick={() => setConfirmando(null)}>{L('Não', 'No')}</BotaoRua>
                    <BotaoRua
                      onClick={() => {
                        onVender(p);
                        setConfirmando(null);
                      }}
                    >
                      {L('Vender', 'Sell')}
                    </BotaoRua>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/* ── 3 · Escalar ───────────────────────────────────────────────────────────── */

function Escalar({
  players,
  lineup,
  dna,
  formacao,
}: {
  players: Record<string, PlayerEntity>;
  lineup: Record<string, string>;
  dna: ReturnType<typeof dnaEfetivo>;
  formacao: string;
}) {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const [xi, setXi] = useState<Record<string, string>>(() => (Object.keys(lineup).length === 11 ? lineup : escalarPeloEncaixe(players, dna)));
  const [slotSel, setSlotSel] = useState<string | null>(null);
  const [trocas, setTrocas] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const noXi = new Set(Object.values(xi));
  const reservas = Object.values(players)
    .filter((p) => !noXi.has(p.id))
    .sort((a, b) => encaixe(b, dna) - encaixe(a, dna));
  const media = (k: (p: PlayerEntity) => number) => {
    const ps = Object.values(xi).map((id) => players[id]).filter((p): p is PlayerEntity => !!p);
    return ps.length ? Math.round(ps.reduce((s, p) => s + k(p), 0) / ps.length) : 0;
  };

  // Mesma pessoa em outra raridade não entra junto (o SET_LINEUP descartaria).
  const pessoasNoXi = new Set(
    Object.entries(xi)
      .filter(([slot]) => slot !== slotSel)
      .map(([, id]) => players[id])
      .filter((p): p is PlayerEntity => !!p)
      .map(samePersonKey),
  );

  const trocar = (reservaId: string) => {
    if (!slotSel) return;
    setXi({ ...xi, [slotSel]: reservaId });
    setSlotSel(null);
    setTrocas((t) => t + 1);
  };

  async function confirmar() {
    if (salvando) return;
    setSalvando(true);
    dispatch({ type: 'SET_LINEUP', lineup: xi });
    track('fundacao_escalacao', { trocas, encaixe: media((p) => encaixe(p, dna)) });
    try {
      await flushAllPersistence();
    } catch {
      /* debounced tenta de novo */
    }
    // Primeira vez: o Ato 5 (Jogo da Fundação). Quem já estreou volta pro clube.
    navigate(getGameState().club.identidade?.estreia ? '/' : '/fundacao/estreia', { replace: true });
  }

  return (
    <>
      <Cabecalho
        rotulo={L(`Escalar · ${formacao}`, `Pick the XI · ${formacao}`)}
        titulo={L('Teu', 'Your')}
        destaque={L('onze.', 'eleven.')}
        voz={L('Sugerido pelo encaixe no teu DNA.', 'Suggested by fit with your DNA.')}
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-concreto p-3">
          <span className="font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo">{L('OVR médio', 'Avg OVR')}</span>
          <p className="font-impact text-[34px] leading-none">{media(ovrDe)}</p>
        </div>
        <div className="bg-concreto p-3">
          <span className="font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo">{L('Encaixe', 'Fit')}</span>
          <p className="font-impact text-[34px] leading-none text-rua">{media((p) => encaixe(p, dna))}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <SecaoRua label={L('Titulares', 'Starters')} />
        <button
          type="button"
          onClick={() => { setXi(escalarPeloEncaixe(players, dna)); setSlotSel(null); }}
          className="min-h-[36px] border-2 border-linha px-2.5 font-prova text-[11px] font-bold uppercase tracking-[0.1em] text-mudo hover:border-papel hover:text-papel"
        >
          {L('Refazer pelo encaixe', 'Redo by fit')}
        </button>
      </div>
      <ul className="flex flex-col gap-1">
        {[...PITCH_SLOT_ORDER].reverse().map((slot) => {
          const p = players[xi[slot.id] ?? ''];
          const sel = slotSel === slot.id;
          return (
            <li key={slot.id}>
              <button
                type="button"
                aria-pressed={sel}
                onClick={() => setSlotSel(sel ? null : slot.id)}
                className={cn('flex w-full items-center gap-3 border-2 bg-concreto p-2 text-left', sel ? 'border-rua' : 'border-linha')}
              >
                <span className="w-9 font-prova text-[11px] font-bold text-mudo">{slot.label}</span>
                {p ? (
                  <>
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center font-impact text-[18px]', DEGRAU_CLASSES[degrauDe(ovrDe(p))])}>{ovrDe(p)}</span>
                    <span className="min-w-0 flex-1 truncate font-impact text-[16px] uppercase">{p.name}</span>
                    {p.pos !== slot.label && <SeloRua tom="corre-contorno" className="text-[10px]">{L('improviso', 'out of pos.')}</SeloRua>}
                    <span className="font-prova text-[11px] font-bold">{encaixe(p, dna)}</span>
                  </>
                ) : (
                  <span className="text-mudo">{L('vazio', 'empty')}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <SecaoRua label={slotSel ? L('Toca no reserva que entra', 'Tap the sub coming in') : L('Reservas', 'Bench')} />
      <ul className="flex flex-col gap-1">
        {reservas.map((p) => {
          const repetido = pessoasNoXi.has(samePersonKey(p));
          const pode = !!slotSel && !repetido;
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={!pode}
                onClick={() => trocar(p.id)}
                className={cn('flex w-full items-center gap-3 border-2 border-dashed bg-asfalto-27 p-2 text-left disabled:cursor-not-allowed', pode ? 'border-rua' : 'border-linha', repetido && 'opacity-60')}
              >
                <span className="w-9 font-prova text-[11px] font-bold text-mudo">{p.pos}</span>
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center font-impact text-[18px]', DEGRAU_CLASSES[degrauDe(ovrDe(p))])}>{ovrDe(p)}</span>
                <span className="min-w-0 flex-1 truncate font-impact text-[16px] uppercase">{p.name}</span>
                {repetido && <SeloRua tom="mudo" className="text-[10px]">{L('já é titular', 'already starting')}</SeloRua>}
                <span className="font-prova text-[11px] font-bold">{encaixe(p, dna)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center bg-black/90 px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3">
        <button
          type="button"
          onClick={() => void confirmar()}
          disabled={salvando || Object.keys(xi).length < 11}
          className="min-h-[56px] w-full max-w-[408px] bg-rua font-impact text-[22px] uppercase text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 disabled:opacity-40"
        >
          {salvando ? L('Salvando…', 'Saving…') : L('Fechar o elenco →', 'Lock the squad →')}
        </button>
      </div>
    </>
  );
}

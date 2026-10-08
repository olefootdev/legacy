/**
 * FUNDAÇÃO DO CLUBE — Ato 5 · A estreia (Fase 3, 2026-10-07).
 *
 *   1 · Túnel      — a frase de guerra e o fantasma do time histórico.
 *   2 · Jogo       — o plano do motor (o mesmo Python da Partida Rápida),
 *                    minuto a minuto, com a Prancheta Viva do teu DNA em cima.
 *   3 · Relatório  — pedido × entregue, da ANÁLISE do motor (~150 jogos pareados
 *                    com e sem a tua identidade). Um jogo só não prova nada.
 *   4 · Ata        — o documento do clube; assinar grava `identidade.estreia`.
 *
 * A estreia não paga prêmio nem entra em resultado/liga: é o manager vendo o
 * time jogar do jeito que pediu. A seed é fixa por clube (rejogar = mesmo jogo).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameDispatch, useGameStore } from '@/game/store';
import { flushAllPersistence } from '@/game/flushPersistence';
import { track } from '@/analytics/track';
import { L } from '@/i18n/L';
import { cn } from '@/lib/utils';
import { BotaoRua, FitaRua, MarcaRua, SecaoRua, SeloRua } from '@/components/ui/Rua';
import { CamisaSVG, EscudoSVG } from '@/components/fundacao/Camisa';
import { PranchetaViva } from '@/components/fundacao/PranchetaViva';
import { fetchAnaliseDeIdentidade, fetchQuickPlan } from '@/match/quickPlanClient';
import type { MatchPlan, MatchPlanEvent } from '@/match/quickPlanTypes';
import { dnaDoClubeParaMotor, dnaEfetivo, ESTILOS, TECNICOS_INSPIRADORES, type EixoDna } from '@/club/identidade';
import { montarJogoDaFundacao, relatorioDeIdentidade, type AnaliseDoMotor, type RelatorioDeIdentidade } from '@/onboarding/jogoDaFundacao';

type Etapa = 'tunel' | 'jogo' | 'relatorio' | 'ata';

/** Um minuto de jogo na tela: 90' ≈ 34 s. */
const MS_POR_MINUTO = 380;

const NOME_DO_EIXO: Record<EixoDna, string> = {
  posse: L('Posse', 'Possession'),
  pressao: L('Pressão', 'Pressing'),
  vertical: L('Verticalidade', 'Directness'),
  criatividade: L('Criatividade', 'Creativity'),
  solidez: L('Solidez', 'Solidity'),
  disciplina: L('Disciplina', 'Discipline'),
  intensidade: L('Intensidade', 'Intensity'),
};

/** Lances que aparecem no minuto a minuto (o resto o motor joga, mas não narra). */
const LANCE_QUE_NARRA = /^(goal|chance|save|woodwork|penalty|red|yellow|counter)_/;

export default function FundacaoEstreia() {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);
  const playerHealth = useGameStore((s) => s.playerHealth);
  const lineup = useGameStore((s) => s.lineup);
  const formacao = useGameStore((s) => s.manager.formationScheme);
  const profile = useGameStore((s) => s.userSettings?.managerProfile);
  const identidade = club.identidade;

  const [etapa, setEtapa] = useState<Etapa>('tunel');
  const [plano, setPlano] = useState<MatchPlan | null>(null);
  const [analise, setAnalise] = useState<AnaliseDoMotor | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [minuto, setMinuto] = useState(0);
  const [assinando, setAssinando] = useState(false);

  const montagem = useMemo(
    () =>
      identidade && Object.keys(players).length >= 11
        ? montarJogoDaFundacao({
            players,
            playerHealth,
            lineup: lineup as Record<string, string>,
            clubId: club.id,
            clubShort: club.shortName || 'OLE',
            formacao,
            identidade,
          })
        : null,
    // O jogo é montado UMA vez: o elenco não muda durante a estreia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [identidade?.fundadoEm],
  );
  const fantasma = montagem?.fantasma;
  const pedido = useMemo(() => (identidade ? dnaEfetivo(dnaDoClubeParaMotor(identidade) ?? { posse: 0.5, pressao: 0.5, vertical: 0.5, criatividade: 0.5, solidez: 0.5, disciplina: 0.5, intensidade: 0.5 }) : null), [identidade]);
  const relatorio: RelatorioDeIdentidade | null = useMemo(() => (analise && pedido ? relatorioDeIdentidade(analise, pedido, L) : null), [analise, pedido]);

  // Sem fundação ou sem elenco, não tem estreia.
  useEffect(() => {
    if (!identidade) navigate('/fundacao', { replace: true });
    else if (Object.keys(players).length === 0) navigate('/fundacao/elenco', { replace: true });
  }, [identidade, players, navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [etapa]);

  // Plano + análise já no túnel (em paralelo): o apito não espera o motor.
  useEffect(() => {
    if (!montagem) return;
    let vivo = true;
    setErro(null);
    void Promise.all([fetchQuickPlan(montagem.input), fetchAnaliseDeIdentidade(montagem.input)]).then(([p, a]) => {
      if (!vivo) return;
      if (!p) setErro(L('O motor não respondeu. Tenta de novo.', "The engine didn't respond. Try again."));
      setPlano(p);
      setAnalise(a);
    });
    return () => {
      vivo = false;
    };
  }, [montagem, tentativa]);

  // Relógio do jogo.
  useEffect(() => {
    if (etapa !== 'jogo') return;
    if (minuto >= 90) {
      const t = setTimeout(() => setEtapa('relatorio'), 1400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setMinuto((m) => m + 1), MS_POR_MINUTO);
    return () => clearTimeout(t);
  }, [etapa, minuto]);

  if (!identidade || !montagem || !fantasma) return null;

  const iniciais = (club.shortName || '').toUpperCase().slice(0, 3);
  const nomeTreinador = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
  const vistos = (plano?.events ?? []).filter((e) => e.minute <= minuto);
  const placarCasa = vistos.filter((e) => e.kind === 'goal_home').length;
  const placarFora = vistos.filter((e) => e.kind === 'goal_away').length;
  const momento = plano?.momentum_curve?.[Math.max(0, Math.min(minuto, (plano.momentum_curve.length || 1)) - 1)] ?? 50;
  const lances = vistos.filter((e) => LANCE_QUE_NARRA.test(e.kind)).slice(-6).reverse();

  async function assinar() {
    if (assinando || !plano || !identidade || !fantasma) return;
    setAssinando(true);
    dispatch({
      type: 'SET_CLUB_IDENTIDADE',
      identidade: {
        ...identidade,
        estreia: {
          seed: plano.seed,
          adversario: { time: fantasma.time, temporada: fantasma.temporada, nome: fantasma.nome },
          placar: { casa: plano.home_score, fora: plano.away_score },
          fidelidade: relatorio?.fidelidade ?? 0,
          jogadoEm: new Date().toISOString(),
        },
      },
    });
    track('fundacao_estreia', {
      casa: plano.home_score,
      fora: plano.away_score,
      fantasma: `${fantasma.time}:${fantasma.temporada}`,
      fidelidade: relatorio?.fidelidade ?? -1,
    });
    try {
      await flushAllPersistence();
    } catch {
      /* o persist debounced tenta de novo */
    }
    navigate('/', { replace: true });
  }

  const tecnico = identidade.tecnico ? TECNICOS_INSPIRADORES[identidade.tecnico] : null;
  const estilo = ESTILOS[identidade.estilo];
  const fundadoEm = new Date(identidade.fundadoEm);

  return (
    <div className="rua-grao min-h-[100dvh] bg-black text-papel">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col bg-asfalto-27 min-[480px]:border-x-2 min-[480px]:border-linha">
        <header className="sticky top-0 z-20 flex flex-col gap-2 border-b-2 border-linha bg-black px-4 pb-2.5 pt-[max(12px,env(safe-area-inset-top,0px))]">
          <div className="flex items-center justify-between gap-3">
            <EscudoSVG primaria={identidade.camisa.primaria} secundaria={identidade.camisa.secundaria} iniciais={iniciais} largura={30} />
            <MarcaRua tipo="wordmark" label="Olefoot" className="h-[18px] bg-rua" />
            <span className="w-[30px]" aria-hidden />
          </div>
          <div className="grid h-1.5 grid-cols-4 gap-1" aria-hidden>
            {(['tunel', 'jogo', 'relatorio', 'ata'] as const).map((k, i, arr) => {
              const atual = arr.indexOf(etapa);
              return <span key={k} className={i < atual ? 'bg-papel' : i === atual ? 'bg-rua' : 'bg-linha'} />;
            })}
          </div>
          <div className="font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
            {L('Ato', 'Act')} 5 · <b className="text-rua">{L('A estreia', 'The debut')}</b>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-6 px-4 pb-32 pt-5">
          {/* ── 1 · Túnel ── */}
          {etapa === 'tunel' && (
            <>
              <FitaRua className="-mx-4 -mt-3 py-2" />
              <div className="flex flex-col gap-1.5">
                <SecaoRua label={L('Jogo da fundação', 'Founding match')} />
                <h1 className="font-impact text-[clamp(40px,11vw,56px)] uppercase leading-[0.9] [text-wrap:balance]">
                  {L('Contra o', 'Against the')} <span className="block text-rua">{L('fantasma.', 'ghost.')}</span>
                </h1>
                <p className="font-voz text-[24px] leading-[1.05]">
                  {L(`${fantasma.nome} ${fantasma.temporada}, com a força do teu time.`, `${fantasma.nome} ${fantasma.temporada}, at your team's strength.`)}
                </p>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-concreto p-4">
                <div className="flex flex-col items-center gap-2 text-center">
                  <EscudoSVG primaria={identidade.camisa.primaria} secundaria={identidade.camisa.secundaria} iniciais={iniciais} largura={64} />
                  <span className="font-impact text-[18px] uppercase leading-none">{club.name}</span>
                </div>
                <span className="font-impact text-[28px] text-mudo">×</span>
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="flex h-[74px] w-[64px] items-center justify-center border-[3px] border-dashed border-mudo font-impact text-[22px] text-mudo">{fantasma.sigla}</span>
                  <span className="font-impact text-[18px] uppercase leading-none text-mudo">{fantasma.nome}</span>
                  <span className="font-prova text-[11px] text-fio">{fantasma.temporada}</span>
                </div>
              </div>
              <div aria-hidden className="-rotate-1 bg-rua px-4 py-4 text-asfalto-27 shadow-[6px_6px_0_var(--color-papel)]">
                <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em]">{L('Túnel', 'Tunnel')} · {club.name}</span>
                <p className="mt-1.5 break-words font-voz text-[30px] leading-[1.02]">{identidade.frase}</p>
              </div>
              <p className="font-prova text-[12px] leading-relaxed text-mudo">
                {L('Amistoso: não vale ponto nem prêmio. Vale ver se o time joga do jeito que tu pediste.', "Friendly: no points, no prize. It shows whether your team plays the way you asked.")}
              </p>
              {erro && (
                <div className="flex flex-col gap-2 border-l-[5px] border-rua bg-concreto p-4">
                  <p className="text-[15px]">{erro}</p>
                  <BotaoRua variante="contorno" className="self-start" onClick={() => setTentativa((t) => t + 1)}>{L('Tentar de novo', 'Try again')}</BotaoRua>
                </div>
              )}
            </>
          )}

          {/* ── 2 · Jogo ── */}
          {etapa === 'jogo' && plano && (
            <>
              <div className="flex items-center justify-between gap-3 bg-black p-3">
                <span className="w-16 font-impact text-[20px] uppercase">{iniciais}</span>
                <span className="font-impact text-[52px] leading-none tabular-nums" aria-live="polite">
                  {placarCasa}<span className="px-2 text-mudo">–</span>{placarFora}
                </span>
                <span className="w-16 text-right font-impact text-[20px] uppercase text-mudo">{fantasma.sigla}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-10 font-impact text-[22px] tabular-nums text-rua">{Math.min(90, minuto)}'</span>
                <div className="relative h-3 flex-1 bg-linha" aria-label={L('Momento do jogo', 'Match momentum')}>
                  <span className="absolute inset-y-0 left-0 bg-rua transition-[width] duration-300" style={{ width: `${momento}%` }} />
                  <span className="absolute inset-y-[-3px] left-1/2 w-0.5 bg-papel" aria-hidden />
                </div>
              </div>
              <PranchetaViva identidade={identidade} formacao={formacao} />
              <ul className="flex flex-col gap-1.5" aria-live="polite">
                {lances.map((e, i) => (
                  <Lance key={`${e.minute}-${e.kind}-${i}`} e={e} recente={i === 0} />
                ))}
                {lances.length === 0 && <li className="font-voz text-[20px] text-mudo">{L('Bola rolando…', 'Ball rolling…')}</li>}
              </ul>
            </>
          )}

          {/* ── 3 · Relatório ── */}
          {etapa === 'relatorio' && plano && (
            <>
              <div className="flex flex-col gap-1.5">
                <SecaoRua label={L('Apito final', 'Full time')} />
                <h1 className="font-impact text-[clamp(40px,11vw,56px)] uppercase leading-[0.9]">
                  {iniciais} {plano.home_score}–{plano.away_score} <span className="block text-rua">{fantasma.sigla}</span>
                </h1>
                <p className="font-voz text-[24px] leading-[1.05]">
                  {plano.home_score > plano.away_score
                    ? L('Venceu o fantasma.', 'Beat the ghost.')
                    : plano.home_score === plano.away_score
                      ? L('Empate com a história.', 'A draw with history.')
                      : L('O fantasma levou essa.', 'The ghost took this one.')}
                </p>
              </div>
              <SecaoRua label={L('Relatório de identidade', 'Identity report')} />
              {relatorio ? (
                <>
                  <p className="text-[14px] leading-snug text-suave">
                    {L(
                      `Um jogo só é sorte. O motor jogou este confronto ${relatorio.n} vezes com a tua identidade e ${relatorio.n} sem ela — a diferença é o que tu pediste chegando em campo.`,
                      `One match is luck. The engine played this matchup ${relatorio.n} times with your identity and ${relatorio.n} without it — the difference is what you asked for reaching the pitch.`,
                    )}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {relatorio.linhas.map((l) => (
                      <li key={l.eixo} className="flex flex-col gap-1.5 border-2 border-linha bg-concreto p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-impact text-[20px] uppercase leading-none">
                            {NOME_DO_EIXO[l.eixo]} <span className="text-rua">{l.direcao > 0 ? '↑' : '↓'}</span>
                          </span>
                          <SeloRua tom={l.veredito === 'apareceu' ? 'corre' : l.veredito === 'discreto' ? 'mudo' : 'cal'} className="text-[10px]">
                            {l.veredito === 'apareceu' ? L('apareceu', 'showed up') : l.veredito === 'discreto' ? L('discreto', 'subtle') : L('foi contra', 'went against')}
                          </SeloRua>
                        </div>
                        <span className="font-prova text-[11px] uppercase tracking-[0.1em] text-mudo">
                          {l.direcao > 0 ? L('Tu pediste mais', 'You asked for more') : L('Tu pediste menos', 'You asked for less')}
                        </span>
                        <span className="text-[14px] leading-snug">{l.prova}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-concreto p-3">
                      <span className="font-prova text-[11px] font-bold uppercase tracking-[0.14em] text-mudo">{L('Fidelidade', 'Fidelity')}</span>
                      <p className="font-impact text-[34px] leading-none text-rua">{relatorio.fidelidade}%</p>
                    </div>
                    <div className="bg-concreto p-3">
                      <span className="font-prova text-[11px] font-bold uppercase tracking-[0.14em] text-mudo">{L('Vitórias × fantasma', 'Wins vs ghost')}</span>
                      <p className="font-impact text-[34px] leading-none">{Math.round(relatorio.vitorias.com * 100)}%</p>
                      <span className="font-prova text-[11px] text-mudo">{L(`sem identidade: ${Math.round(relatorio.vitorias.sem * 100)}%`, `without identity: ${Math.round(relatorio.vitorias.sem * 100)}%`)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="border-l-[5px] border-rua bg-concreto p-4 text-[15px]">
                  {L('A análise do motor não respondeu agora. O jogo valeu; o relatório aparece na próxima.', "The engine analysis didn't respond now. The match counted; the report shows up next time.")}
                </p>
              )}
            </>
          )}

          {/* ── 4 · Ata ── */}
          {etapa === 'ata' && plano && (
            <article className="flex flex-col gap-4 bg-papel p-5 text-asfalto-27 shadow-[6px_6px_0_var(--color-rua)]">
              <div className="flex items-start justify-between gap-3 border-b-2 border-asfalto-27 pb-3">
                <div className="flex flex-col">
                  <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em]">{L('Ata de fundação', 'Founding charter')}</span>
                  <span className="font-voz text-[34px] leading-none">{club.name}</span>
                </div>
                <EscudoSVG primaria={identidade.camisa.primaria} secundaria={identidade.camisa.secundaria} iniciais={iniciais} largura={56} />
              </div>
              <p className="font-voz text-[20px] leading-tight">
                {L(
                  `Aos ${fundadoEm.getDate()} dias do mês de ${fundadoEm.toLocaleDateString('pt-BR', { month: 'long' })} de ${fundadoEm.getFullYear()}, ${identidade.estado ? `em ${identidade.estado}, ` : ''}${identidade.pais}, fica fundado o ${club.name}.`,
                  `On ${fundadoEm.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}, ${identidade.estado ? `in ${identidade.estado}, ` : ''}${identidade.pais}, ${club.name} is founded.`,
                )}
              </p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 font-prova text-[12px]">
                <ItemAta rotulo={L('Treinador', 'Coach')} valor={nomeTreinador || '—'} />
                <ItemAta rotulo={L('Formação', 'Formation')} valor={identidade.formacao} />
                <ItemAta rotulo={L('Estilo', 'Style')} valor={estilo?.nome ?? identidade.estilo} />
                <ItemAta rotulo={L('Inspiração', 'Inspiration')} valor={tecnico?.nome ?? '—'} />
                <ItemAta rotulo={L('Estreia', 'Debut')} valor={`${plano.home_score}–${plano.away_score} × ${fantasma.nome} ${fantasma.temporada}`} />
                <ItemAta rotulo={L('Fidelidade', 'Fidelity')} valor={relatorio ? `${relatorio.fidelidade}%` : '—'} />
              </dl>
              <div className="flex items-end justify-between gap-3">
                <CamisaSVG
                  padrao={identidade.camisa.padrao}
                  primaria={identidade.camisa.primaria}
                  secundaria={identidade.camisa.secundaria}
                  calcao={identidade.camisa.calcao}
                  iniciais={iniciais}
                  largura={92}
                />
                <blockquote className="flex-1 border-l-[5px] border-asfalto-27 pl-3 font-voz text-[22px] leading-[1.05]">“{identidade.frase}”</blockquote>
              </div>
              <div className="border-t-2 border-dashed border-asfalto-27 pt-2 font-prova text-[11px] uppercase tracking-[0.14em]">
                {L('Assinatura do fundador', "Founder's signature")} · <span className="font-voz text-[20px] normal-case tracking-normal">{nomeTreinador || club.name}</span>
              </div>
            </article>
          )}
        </main>

        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center gap-2 bg-black/90 px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3">
          {etapa === 'jogo' && (
            <button
              type="button"
              onClick={() => setMinuto(90)}
              className="min-h-[56px] w-full max-w-[408px] border-2 border-linha font-impact text-[20px] uppercase text-mudo hover:border-papel hover:text-papel"
            >
              {L('Pular pro apito final', 'Skip to full time')}
            </button>
          )}
          {etapa !== 'jogo' && (
            <button
              type="button"
              disabled={(etapa === 'tunel' && !plano) || assinando}
              onClick={() => {
                if (etapa === 'tunel') {
                  setMinuto(0);
                  setEtapa('jogo');
                } else if (etapa === 'relatorio') setEtapa('ata');
                else void assinar();
              }}
              className={cn(
                'min-h-[56px] w-full max-w-[408px] bg-rua font-impact text-[22px] uppercase text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5',
                'disabled:cursor-not-allowed disabled:border-2 disabled:border-dashed disabled:border-fio disabled:bg-transparent disabled:text-mudo disabled:shadow-none',
              )}
            >
              {etapa === 'tunel'
                ? plano
                  ? L('Apita o juiz →', 'Kick off →')
                  : L('Aquecendo…', 'Warming up…')
                : etapa === 'relatorio'
                  ? L('Lavrar a ata →', 'Draw up the charter →')
                  : assinando
                    ? L('Assinando…', 'Signing…')
                    : L('Assinar e entrar no clube →', 'Sign and enter the club →')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Lance({ e, recente }: { e: MatchPlanEvent; recente: boolean }) {
  const gol = e.kind.startsWith('goal_');
  const casa = e.actor_side === 'home';
  return (
    <li
      className={cn(
        'flex gap-3 p-2.5',
        gol ? (casa ? 'bg-rua text-asfalto-27' : 'bg-papel text-asfalto-27') : 'border-2 border-linha bg-concreto',
        !recente && 'opacity-70',
      )}
    >
      <span className="w-8 shrink-0 font-impact text-[18px] tabular-nums">{e.minute}'</span>
      <span className={cn('text-[14px] leading-snug', gol && 'font-impact text-[17px] uppercase')}>{e.text}</span>
    </li>
  );
}

function ItemAta({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">{rotulo}</dt>
      <dd className="truncate text-[13px] font-bold">{valor}</dd>
    </div>
  );
}

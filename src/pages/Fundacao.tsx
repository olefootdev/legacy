/**
 * FUNDAÇÃO DO CLUBE — Atos 1 a 3 do onboarding novo (DS 2027, 2026-10-07).
 *
 *   Ato 1 · Quem é você      — casa (UF/país), time de coração, quanto o time conta contigo
 *   Ato 2 · Como teu time joga — 100 pontos, formação + estilo, técnico, time histórico, treino
 *   Ato 3 · A cara do clube   — camisa (SVG próprio) e frase de guerra
 *
 * Tudo que é de JOGO vira o DNA (`dnaDaIdentidade`) que a Partida Rápida e a
 * Liga Global consomem — a Prancheta Viva mostra esse mesmo DNA em campo.
 * Nome e iniciais do clube vêm do cadastro (o resto do jogo já acha o clube
 * por eles) e aparecem aqui só pra conferir.
 *
 * Manager novo cai aqui antes da cerimônia de elenco (`FundacaoGate`);
 * manager antigo chega pelo convite da Home e pode refazer quando quiser.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameDispatch, useGameStore } from '@/game/store';
import { flushAllPersistence } from '@/game/flushPersistence';
import { track } from '@/analytics/track';
import { L } from '@/i18n/L';
import { cn } from '@/lib/utils';
import { FitaRua, MarcaRua, SecaoRua } from '@/components/ui/Rua';
import { PranchetaViva } from '@/components/fundacao/PranchetaViva';
import { CamisaSVG, CORES_DE_CAMISA, EscudoSVG, PADROES_DE_CAMISA } from '@/components/fundacao/Camisa';
import { LEAGUE_BUCKETS } from '@/settings/worldClubs';
import type { FavoriteRealTeamRef } from '@/game/types';
import type { FormationSchemeId } from '@/match-engine/types';
import {
  ATRIBUTOS_DE_JOGO,
  ESTILOS,
  falaDoCoach,
  identidadeSugerida,
  PASSO_DE_PONTOS,
  pontosValidos,
  TECNICOS_INSPIRADORES,
  TIMES_HISTORICOS,
  TOTAL_DE_PONTOS,
  TREINOS,
  type AtributoDeJogo,
  type DisponibilidadeDoManager,
  type EstiloDeJogo,
  type IdentidadeDoClube,
  type PadraoDeCamisa,
  type PontosDeJogo,
  type TreinoDoClube,
} from '@/club/identidade';

const ATOS = [L('Quem é você', 'Who you are'), L('Como teu time joga', 'How your team plays'), L('A cara do clube', "The club's face")];
const PASSOS = [
  { ato: 0, id: 'casa' },
  { ato: 0, id: 'coracao' },
  { ato: 1, id: 'pontos' },
  { ato: 1, id: 'estilo' },
  { ato: 1, id: 'tecnico' },
  { ato: 1, id: 'historico' },
  { ato: 1, id: 'treino' },
  { ato: 2, id: 'camisa' },
  { ato: 2, id: 'frase' },
] as const;
type PassoId = (typeof PASSOS)[number]['id'];

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const PAISES = ['Brasil', 'Portugal', 'Argentina', 'Estados Unidos', 'Angola', 'Moçambique', 'Outro'];
const FORMACOES: FormationSchemeId[] = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '4-5-1', '5-3-2', '3-4-3'];

const ATRIBUTO_INFO: Record<AtributoDeJogo, { nome: string; desc: string }> = {
  tatico: { nome: L('Tático', 'Tactical'), desc: L('organização, ocupação de espaço', 'shape, use of space') },
  fairplay: { nome: 'Fair play', desc: L('menos faltas e cartões', 'fewer fouls and cards') },
  criativo: { nome: L('Criativo', 'Creative'), desc: L('drible, passe que quebra linha', 'dribbling, line-breaking passes') },
  ataque: { nome: L('Ataque', 'Attack'), desc: L('volume ofensivo, gente na área', 'attacking volume, bodies in the box') },
  defesa: { nome: L('Defesa', 'Defence'), desc: L('linha, cobertura, bola aérea', 'line, cover, aerial play') },
  mentalidade: { nome: L('Mentalidade', 'Mentality'), desc: L('virada, jogo grande', 'comebacks, big games') },
};
const ESTILO_DESC: Record<EstiloDeJogo, string> = {
  posse: L('a bola é nossa', 'the ball is ours'),
  reativo: L('espera e mata', 'wait and strike'),
  pressao: L('rouba no campo deles', 'win it in their half'),
  longos: L('direto pro 9', 'straight to the 9'),
  defensivo: L('zero atrás primeiro', 'clean sheet first'),
  liberdade: L('craque decide', 'let the stars decide'),
};
const TREINO_DESC: Record<TreinoDoClube, string> = {
  rigido: L('Mais disciplina e intensidade. Mais fadiga.', 'More discipline and intensity. More fatigue.'),
  flexivel: L('Equilíbrio entre evolução e descanso.', 'Balance between growth and rest.'),
  tranquilo: L('Elenco descansado e solto. Evolui mais devagar.', 'Rested, loose squad. Slower growth.'),
};
const FREQ: { k: DisponibilidadeDoManager; nome: string; desc: string }[] = [
  { k: 'diario', nome: L('Todos os dias', 'Every day'), desc: L('Controle total: tu escala, treina e negocia.', 'Full control: you pick, train and trade.') },
  { k: 'semana3', nome: L('3× por semana', '3× a week'), desc: L('O Coach cuida do treino nos dias em que tu não entra.', 'The Coach handles training on the days you are away.') },
  { k: 'semana1', nome: L('1× por semana', 'Once a week'), desc: L('O Coach escala e treina no piloto automático, seguindo o teu DNA.', 'The Coach picks and trains on autopilot, following your DNA.') },
];
const NOME_EIXO: Record<string, string> = {
  posse: L('Posse', 'Possession'), pressao: L('Pressão', 'Pressing'), vertical: L('Vertical', 'Direct'),
  criatividade: L('Criação', 'Creativity'), solidez: L('Solidez', 'Solidity'), disciplina: L('Disciplina', 'Discipline'),
  intensidade: L('Intensidade', 'Intensity'),
};

const TODOS_OS_CLUBES: FavoriteRealTeamRef[] = LEAGUE_BUCKETS.flatMap((b) => b.teams);
const PONTOS_INICIAIS: PontosDeJogo = { tatico: 15, fairplay: 15, criativo: 20, ataque: 15, defesa: 20, mentalidade: 15 };

function Botao({ on, onClick, children, className, label }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'min-h-[44px] border-2 px-3 py-1.5 text-left font-impact text-[17px] uppercase leading-tight transition-colors',
        on ? 'border-rua bg-rua text-asfalto-27' : 'border-linha text-papel hover:border-papel',
        className,
      )}
    >
      {children}
    </button>
  );
}

function Opcao({ on, onClick, titulo, meta, tags }: { on: boolean; onClick: () => void; titulo: string; meta?: string; tags?: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn('flex w-full items-start gap-3 border-[3px] bg-concreto px-3.5 py-3 text-left transition-colors', on ? 'border-rua' : 'border-transparent hover:border-fio')}
    >
      <span aria-hidden className={cn('mt-0.5 h-6 w-6 shrink-0', on ? 'bg-rua' : 'border-2 border-dashed border-fio')} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-voz text-[24px] leading-none text-papel">{titulo}</span>
        {meta ? <span className="font-prova text-[11.5px] leading-snug text-mudo">{meta}</span> : null}
        {tags ? <span className="mt-1 flex flex-wrap gap-1.5">{tags}</span> : null}
      </span>
    </button>
  );
}

function Tag({ children, tom = 'neutro' }: { children: React.ReactNode; tom?: 'neutro' | 'mais' | 'menos' }) {
  return (
    <span className={cn('border-2 px-1.5 py-px font-prova text-[10.5px] font-bold uppercase tracking-[0.06em]',
      tom === 'mais' ? 'border-rua text-rua' : tom === 'menos' ? 'border-fio text-mudo' : 'border-linha text-suave')}>
      {children}
    </span>
  );
}

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

export default function Fundacao() {
  const navigate = useNavigate();
  const dispatch = useGameDispatch();
  const club = useGameStore((s) => s.club);
  const profile = useGameStore((s) => s.userSettings?.managerProfile);
  const coracaoAtual = useGameStore((s) => s.userSettings?.favoriteRealTeam ?? null);
  const formacaoAtual = useGameStore((s) => s.manager.formationScheme);
  const anterior = club.identidade;
  const semElenco = useGameStore((s) => Object.keys(s.players ?? {}).length === 0);

  const [passo, setPasso] = useState(0);
  const [estado, setEstado] = useState<string>(anterior?.estado ?? 'SP');
  const [pais, setPais] = useState<string>(anterior?.pais ?? 'Brasil');
  const [coracao, setCoracao] = useState<FavoriteRealTeamRef | null>(coracaoAtual);
  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeDoManager>(anterior?.disponibilidade ?? 'diario');
  const [pontos, setPontos] = useState<PontosDeJogo>(anterior?.pontos ?? PONTOS_INICIAIS);
  const [formacao, setFormacao] = useState<FormationSchemeId>(anterior?.formacao ?? formacaoAtual ?? '4-3-3');
  const [estilo, setEstilo] = useState<EstiloDeJogo>(anterior?.estilo ?? 'posse');
  const [tecnico, setTecnico] = useState<string | null>(anterior?.tecnico ?? null);
  const [historico, setHistorico] = useState<{ time: string; temporada: string } | null>(anterior?.historico ?? null);
  const [treino, setTreino] = useState<TreinoDoClube>(anterior?.treino ?? 'flexivel');
  const [camisa, setCamisa] = useState<IdentidadeDoClube['camisa']>(
    anterior?.camisa ?? { padrao: 'listras', primaria: '#F2E61E', secundaria: '#0D0D0C', calcao: '#0D0D0C' },
  );
  const [frase, setFrase] = useState(anterior?.frase ?? '');
  const [salvando, setSalvando] = useState(false);

  const P = PASSOS[passo]!;
  const doAto = PASSOS.filter((p) => p.ato === P.ato);
  const usados = ATRIBUTOS_DE_JOGO.reduce((s, k) => s + pontos[k], 0);
  const resta = TOTAL_DE_PONTOS - usados;
  const escolhas = useMemo(() => ({ pontos, estilo, tecnico, historico, treino }), [pontos, estilo, tecnico, historico, treino]);
  const coach = useMemo(() => falaDoCoach(escolhas, L), [escolhas]);
  const iniciais = (club.shortName || '').toUpperCase().slice(0, 3);
  const nomeTreinador = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');

  useEffect(() => {
    track('fundacao_passo', { passo: P.id, refazendo: !!anterior });
    window.scrollTo(0, 0);
  }, [P.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const podeAvancar: Record<PassoId, boolean> = {
    casa: !!estado && !!pais,
    coracao: !!coracao,
    pontos: pontosValidos(pontos),
    estilo: true,
    tecnico: true,
    historico: true,
    treino: true,
    camisa: true,
    frase: frase.trim().length > 0,
  };

  async function concluir() {
    if (salvando) return;
    setSalvando(true);
    const identidade: IdentidadeDoClube = {
      versao: 1,
      pontos,
      formacao,
      estilo,
      tecnico,
      historico,
      treino,
      disponibilidade,
      camisa,
      frase: frase.trim().slice(0, 100),
      pais,
      estado: pais === 'Brasil' ? estado : null,
      fundadoEm: new Date().toISOString(),
    };
    dispatch({ type: 'SET_CLUB_IDENTIDADE', identidade });
    if (coracao && coracao.id !== coracaoAtual?.id) {
      dispatch({ type: 'SET_USER_SETTINGS', partial: { favoriteRealTeam: coracao } });
    }
    track('fundacao_concluida', {
      estilo, tecnico: tecnico ?? 'nenhum', historico: historico ? `${historico.time}:${historico.temporada}` : 'nenhum',
      treino, formacao, disponibilidade, refazendo: !!anterior,
    });
    try {
      await flushAllPersistence();
    } catch {
      /* o persist debounced tenta de novo */
    }
    // Sem elenco ainda: o Ato 4 sorteia (servidor) e abre a Janela da Estreia.
    navigate(semElenco ? '/fundacao/elenco' : '/', { replace: true });
  }

  const avancar = () => {
    if (!podeAvancar[P.id]) return;
    if (passo < PASSOS.length - 1) setPasso(passo + 1);
    else void concluir();
  };

  const rotuloCta =
    P.id === 'pontos' && resta !== 0
      ? resta > 0 ? L(`Faltam ${resta} pontos`, `${resta} points left`) : L(`${-resta} pontos a mais`, `${-resta} points over`)
      : passo === PASSOS.length - 1
        ? salvando ? L('Fundando…', 'Founding…') : L('Fundar o clube →', 'Found the club →')
        : L('Continuar →', 'Continue →');

  const historicoSel = historico ? TIMES_HISTORICOS[historico.time] : null;

  return (
    <div className="rua-grao min-h-[100dvh] bg-black text-papel">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col bg-asfalto-27 min-[480px]:border-x-2 min-[480px]:border-linha">
        {/* Topo: voltar · marca · atos */}
        <header className="sticky top-0 z-20 flex flex-col gap-2 border-b-2 border-linha bg-black px-4 pb-2.5 pt-[max(12px,env(safe-area-inset-top,0px))]">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => (passo > 0 ? setPasso(passo - 1) : navigate('/'))}
              className={cn('min-h-[36px] border-2 border-linha px-3 font-prova text-[11px] font-bold uppercase tracking-[0.16em] text-mudo hover:border-papel hover:text-papel', passo === 0 && !anterior && 'invisible')}
            >
              ← {passo > 0 ? L('Voltar', 'Back') : L('Sair', 'Exit')}
            </button>
            <MarcaRua tipo="wordmark" label="Olefoot" className="h-[18px] bg-rua" />
            <span className="w-[72px]" aria-hidden />
          </div>
          <div className="grid h-1.5 grid-cols-3 gap-1" aria-hidden>
            {ATOS.map((_, i) => (
              <span key={i} className={i < P.ato ? 'bg-papel' : i === P.ato ? 'bg-rua' : 'bg-linha'} />
            ))}
          </div>
          <div className="flex justify-between gap-2 font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo">
            <span>
              {L('Ato', 'Act')} {P.ato + 1}/3 · <b className="text-rua">{ATOS[P.ato]}</b>
            </span>
            <span>
              {doAto.indexOf(P) + 1}/{doAto.length}
            </span>
          </div>
        </header>

        {P.ato === 1 && (
          <div className="sticky top-[86px] z-10 border-b-2 border-linha bg-black px-4 pb-3 pt-2.5">
            <PranchetaViva identidade={escolhas} formacao={formacao} />
          </div>
        )}

        <main className="flex flex-1 flex-col gap-6 px-4 pb-32 pt-5">
          {P.id === 'casa' && (
            <>
              <FitaRua className="-mx-4 -mt-3 py-2" />
              <Cabecalho
                rotulo={L('Ato 1 · quem é você', 'Act 1 · who you are')}
                titulo={anterior ? L('Refaz a', 'Rebuild the') : L('Bem-vindo,', 'Welcome,')}
                destaque={anterior ? L('fundação.', 'foundation.') : L('fundador.', 'founder.')}
                voz={L('Todo clube começa com um nome.', 'Every club starts with a name.')}
              />
              <div className="flex items-center gap-4 border-l-[5px] border-rua bg-concreto p-4">
                <EscudoSVG primaria={camisa.primaria} secundaria={camisa.secundaria} iniciais={iniciais} largura={64} />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="block truncate font-impact text-[26px] uppercase leading-none">{club.name}</span>
                  <span className="font-prova text-[12px] uppercase tracking-[0.14em] text-mudo">
                    {iniciais}{nomeTreinador ? ` · ${L('treinador', 'coach')} ${nomeTreinador}` : ''}
                  </span>
                  <span className="font-prova text-[10.5px] text-fio">{L('Nome e iniciais vêm do teu cadastro.', 'Name and initials come from your sign-up.')}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">{L('País', 'Country')}</span>
                  <select id="fund-pais" value={pais} onChange={(e) => setPais(e.target.value)} className="min-h-[50px] w-full border-2 border-linha bg-concreto px-3 text-[16px] text-papel focus:border-rua focus:outline-none">
                    {PAISES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </label>
                {pais === 'Brasil' && (
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">{L('Estado', 'State')}</span>
                    <select id="fund-uf" value={estado} onChange={(e) => setEstado(e.target.value)} className="min-h-[50px] w-full border-2 border-linha bg-concreto px-3 text-[16px] text-papel focus:border-rua focus:outline-none">
                      {UFS.map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </label>
                )}
              </div>
            </>
          )}

          {P.id === 'coracao' && (
            <>
              <Cabecalho rotulo={L('Ato 1 · quem é você', 'Act 1 · who you are')} titulo={L('Teu time', 'Your team')} destaque={L('de coração.', 'at heart.')} voz={L('De onde vem a tua bola?', 'Where does your football come from?')} />
              <label className="flex flex-col gap-1.5">
                <span className="font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">{L('Time de coração', 'Team at heart')}</span>
                <select
                  id="fund-coracao"
                  value={coracao?.id ?? ''}
                  onChange={(e) => setCoracao(TODOS_OS_CLUBES.find((c) => String(c.id) === e.target.value) ?? null)}
                  className="min-h-[50px] w-full border-2 border-linha bg-concreto px-3 text-[16px] text-papel focus:border-rua focus:outline-none"
                >
                  <option value="" disabled>{L('Escolhe o teu', 'Pick yours')}</option>
                  {LEAGUE_BUCKETS.map((b) => (
                    <optgroup key={b.id} label={b.label}>
                      {b.teams.map((t) => <option key={`${b.id}-${t.id}`} value={t.id}>{t.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <p className="font-prova text-[12px] leading-relaxed text-suave">
                {L('É a base do botão "Monta pra mim" no próximo ato.', 'It powers the "Build it for me" button in the next act.')}
              </p>
              <div className="flex flex-col gap-2.5">
                <SecaoRua label={L('Quanto o time pode contar contigo?', 'How much can the team count on you?')} />
                {FREQ.map((f) => (
                  <Opcao key={f.k} on={disponibilidade === f.k} onClick={() => setDisponibilidade(f.k)} titulo={f.nome} meta={f.desc} />
                ))}
              </div>
            </>
          )}

          {P.id === 'pontos' && (
            <>
              <Cabecalho rotulo={L('Ato 2 · como teu time joga', 'Act 2 · how your team plays')} titulo={L('100 pontos.', '100 points.')} destaque={L('Tua escola.', 'Your school.')} />
              <div className="flex items-center justify-between gap-3 border-2 border-dashed border-fio px-3 py-2.5">
                <p className="font-prova text-[12px] leading-snug text-suave">
                  {L(`Sem tempo? A IA monta o DNA a partir do ${coracao?.name ?? 'teu time'}.`, `No time? AI builds the DNA from ${coracao?.name ?? 'your team'}.`)}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const s = identidadeSugerida(coracao?.name);
                    setPontos(s.pontos); setEstilo(s.estilo); setTecnico(s.tecnico); setHistorico(s.historico); setTreino(s.treino);
                    track('fundacao_monta_pra_mim', { coracao: coracao?.name ?? 'nenhum' });
                  }}
                  className="min-h-[44px] shrink-0 bg-papel px-3.5 font-impact text-[16px] uppercase text-asfalto-27 hover:bg-rua"
                >
                  {L('Monta pra mim', 'Build it for me')}
                </button>
              </div>
              <div className="flex items-end justify-between gap-3 border-l-[5px] border-rua bg-concreto px-4 py-3">
                <div className="flex flex-col gap-1">
                  <span className="font-prova text-[12px] font-bold uppercase tracking-[0.2em] text-mudo">— {L('Pra distribuir', 'To spend')}</span>
                  <span className="font-prova text-[12px] text-suave">{L('de 5 em 5', 'in steps of 5')}</span>
                </div>
                <span className={cn('font-spray text-[54px] font-black leading-[0.85]', resta === 0 ? 'text-papel' : resta < 0 ? 'text-baixa' : 'text-rua')} aria-live="polite">
                  {resta}
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {ATRIBUTOS_DE_JOGO.map((k) => {
                  const v = pontos[k];
                  return (
                    <div key={k} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 bg-concreto px-3.5 py-3">
                      <div className="min-w-0">
                        <div className="font-impact text-[20px] uppercase leading-none">{ATRIBUTO_INFO[k].nome}</div>
                        <div className="mt-1 font-prova text-[11px] text-mudo">{ATRIBUTO_INFO[k].desc}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={L(`Tirar 5 de ${ATRIBUTO_INFO[k].nome}`, `Remove 5 from ${ATRIBUTO_INFO[k].nome}`)}
                          disabled={v <= 0}
                          onClick={() => setPontos({ ...pontos, [k]: v - PASSO_DE_PONTOS })}
                          className="h-11 w-11 border-2 border-papel font-impact text-[22px] leading-none hover:bg-papel hover:text-asfalto-27 disabled:cursor-not-allowed disabled:border-dashed disabled:border-fio disabled:bg-transparent disabled:text-fio"
                        >
                          −
                        </button>
                        <span className="w-11 text-center font-spray text-[30px] font-black tabular-nums">{v}</span>
                        <button
                          type="button"
                          aria-label={L(`Pôr 5 em ${ATRIBUTO_INFO[k].nome}`, `Add 5 to ${ATRIBUTO_INFO[k].nome}`)}
                          disabled={resta <= 0}
                          onClick={() => setPontos({ ...pontos, [k]: v + PASSO_DE_PONTOS })}
                          className="h-11 w-11 border-2 border-papel font-impact text-[22px] leading-none hover:bg-papel hover:text-asfalto-27 disabled:cursor-not-allowed disabled:border-dashed disabled:border-fio disabled:bg-transparent disabled:text-fio"
                        >
                          +
                        </button>
                      </div>
                      <div className="col-span-2 grid h-2 gap-0.5" style={{ gridTemplateColumns: 'repeat(20, minmax(0, 1fr))' }} aria-hidden>
                        {Array.from({ length: 20 }, (_, i) => <i key={i} className={i < v / 5 ? 'bg-rua' : 'bg-linha'} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {P.id === 'estilo' && (
            <>
              <Cabecalho rotulo={L('Ato 2 · como teu time joga', 'Act 2 · how your team plays')} titulo={L('Formação', 'Formation')} destaque={L('e estilo.', 'and style.')} />
              <div className="flex flex-col gap-2.5">
                <SecaoRua label={L('Formação', 'Formation')} />
                <div className="flex flex-wrap gap-2">
                  {FORMACOES.map((f) => <Botao key={f} on={formacao === f} onClick={() => setFormacao(f)}>{f}</Botao>)}
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <SecaoRua label={L('Estilo', 'Style')} />
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(ESTILOS) as EstiloDeJogo[]).map((k) => (
                    <Botao key={k} on={estilo === k} onClick={() => setEstilo(k)}>
                      {L(ESTILOS[k].nome, ({ posse: 'Possession', reativo: 'Reactive', pressao: 'High press', longos: 'Long balls', defensivo: 'Defensive', liberdade: 'Creative freedom' } as const)[k])}
                      <small className="block font-prova text-[10.5px] normal-case leading-snug opacity-75">{ESTILO_DESC[k]}</small>
                    </Botao>
                  ))}
                </div>
              </div>
            </>
          )}

          {P.id === 'tecnico' && (
            <>
              <Cabecalho rotulo={L('Ato 2 · como teu time joga', 'Act 2 · how your team plays')} titulo={L('Quem', 'Who')} destaque={L('te inspira?', 'inspires you?')} voz={L('O conceito entra no time aos poucos, rodada a rodada.', 'The idea seeps into the team round by round.')} />
              <div className="flex flex-col gap-2.5">
                {Object.entries(TECNICOS_INSPIRADORES).map(([k, t]) => {
                  const efeitos = Object.entries(t.empurra).sort((a, b) => Math.abs(b[1]!) - Math.abs(a[1]!)).slice(0, 2);
                  return (
                    <Opcao
                      key={k}
                      on={tecnico === k}
                      onClick={() => setTecnico(tecnico === k ? null : k)}
                      titulo={t.nome}
                      meta={t.era}
                      tags={
                        <>
                          {t.conceitos.map((c) => <Tag key={c}>{c}</Tag>)}
                          {efeitos.map(([e, v]) => <Tag key={e} tom={v! > 0 ? 'mais' : 'menos'}>{v! > 0 ? '+' : '−'} {NOME_EIXO[e]}</Tag>)}
                        </>
                      }
                    />
                  );
                })}
              </div>
            </>
          )}

          {P.id === 'historico' && (
            <>
              <Cabecalho rotulo={L('Ato 2 · como teu time joga', 'Act 2 · how your team plays')} titulo={L('Joga como', 'Plays like')} destaque={L('quem?', 'whom?')} voz={L('Esse vai ser o fantasma do teu primeiro jogo.', 'This one will be the ghost of your first match.')} />
              <div className="flex flex-col gap-2.5">
                <SecaoRua label={L('Time', 'Team')} />
                <div className="flex flex-wrap gap-2">
                  {Object.entries(TIMES_HISTORICOS).map(([k, t]) => (
                    <Botao
                      key={k}
                      on={historico?.time === k}
                      onClick={() => setHistorico(historico?.time === k ? null : { time: k, temporada: Object.keys(t.temporadas)[0]! })}
                    >
                      {t.nome}
                    </Botao>
                  ))}
                </div>
              </div>
              {historico && historicoSel && (
                <div className="flex flex-col gap-2.5">
                  <SecaoRua label={L('Temporada', 'Season')} />
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(historicoSel.temporadas).map(([temp, v]) => (
                      <Botao key={temp} on={historico.temporada === temp} onClick={() => setHistorico({ time: historico.time, temporada: temp })}>
                        {temp}
                        <small className="block font-prova text-[10.5px] normal-case opacity-75">
                          {Object.entries(v.empurra).sort((a, b) => b[1]! - a[1]!).slice(0, 2).map(([e]) => NOME_EIXO[e]).join(' · ')}
                        </small>
                      </Botao>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {P.id === 'treino' && (
            <>
              <Cabecalho rotulo={L('Ato 2 · como teu time joga', 'Act 2 · how your team plays')} titulo={L('Como', 'How do')} destaque={L('se treina?', 'you train?')} />
              <div className="flex flex-col gap-2.5">
                {(Object.keys(TREINOS) as TreinoDoClube[]).map((k) => (
                  <Opcao key={k} on={treino === k} onClick={() => setTreino(k)} titulo={L(TREINOS[k].nome, ({ rigido: 'Strict', flexivel: 'Flexible', tranquilo: 'Easy' } as const)[k])} meta={TREINO_DESC[k]} />
                ))}
              </div>
            </>
          )}

          {P.ato === 1 && (
            <div className={cn('border-l-[3px] py-0.5 pl-3', coach.alerta ? 'border-baixa' : 'border-rua')} aria-live="polite">
              <p className="font-voz text-[20px] leading-[1.1]">{coach.texto}</p>
            </div>
          )}

          {P.id === 'camisa' && (
            <>
              <Cabecalho rotulo={L('Ato 3 · a cara do clube', "Act 3 · the club's face")} titulo={L('Veste', 'Wear')} destaque={L('a camisa.', 'the shirt.')} />
              <div className="flex items-center justify-center gap-5 bg-concreto px-3 py-5">
                <EscudoSVG primaria={camisa.primaria} secundaria={camisa.secundaria} iniciais={iniciais} largura={86} />
                <CamisaSVG {...camisa} iniciais={iniciais} largura={150} rotulo={L(`Camisa e calção do ${club.name}`, `${club.name} shirt and shorts`)} />
              </div>
              <div className="flex flex-col gap-2.5">
                <SecaoRua label={L('Padrão', 'Pattern')} />
                <div className="grid grid-cols-4 gap-2">
                  {PADROES_DE_CAMISA.map(({ k, nome }) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={camisa.padrao === k}
                      onClick={() => setCamisa({ ...camisa, padrao: k as PadraoDeCamisa })}
                      className={cn('flex min-w-0 flex-col items-center gap-0.5 border-[3px] bg-concreto px-1 pb-1 pt-1.5', camisa.padrao === k ? 'border-rua' : 'border-transparent')}
                    >
                      <CamisaSVG {...camisa} padrao={k} largura={48} />
                      <span className="font-prova text-[9.5px] font-bold uppercase tracking-[0.08em] text-mudo">{nome}</span>
                    </button>
                  ))}
                </div>
              </div>
              {(
                [
                  ['primaria', L('Cor principal', 'Main colour')],
                  ['secundaria', L('Cor do detalhe', 'Detail colour')],
                  ['calcao', L('Calção', 'Shorts')],
                ] as const
              ).map(([campo, nome]) => (
                <div key={campo} className="flex flex-col gap-2.5">
                  <SecaoRua label={nome} />
                  <div className="flex flex-wrap gap-2">
                    {CORES_DE_CAMISA.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={camisa[campo] === c}
                        aria-label={`${nome} ${c}`}
                        onClick={() => setCamisa({ ...camisa, [campo]: c })}
                        className={cn('h-10 w-10 border-2 border-linha', camisa[campo] === c && 'outline outline-[3px] outline-offset-2 outline-rua')}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {P.id === 'frase' && (
            <>
              <Cabecalho rotulo={L('Ato 3 · a cara do clube', "Act 3 · the club's face")} titulo={L('Frase', 'War')} destaque={L('de guerra.', 'cry.')} voz={L('Ela aparece no túnel, antes de todo jogo.', 'It shows in the tunnel before every match.')} />
              <label className="flex flex-col gap-1.5">
                <span className="font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">{L('Até 100 caracteres', 'Up to 100 characters')}</span>
                <textarea
                  id="fund-frase"
                  value={frase}
                  maxLength={100}
                  onChange={(e) => setFrase(e.target.value)}
                  placeholder={L('Ninguém desce o morro de graça.', 'Nobody comes down the hill for free.')}
                  className="min-h-[110px] w-full resize-none border-2 border-linha bg-concreto px-3 py-2.5 font-voz text-[24px] leading-[1.1] text-papel placeholder:text-fio focus:border-rua focus:outline-none"
                />
                <span className="text-right font-prova text-[12px] text-mudo">{frase.length}/100</span>
              </label>
              <div aria-hidden className="-rotate-1 bg-rua px-4 py-4 text-asfalto-27 shadow-[6px_6px_0_var(--color-papel)]">
                <span className="font-prova text-[11px] font-bold uppercase tracking-[0.2em]">{L('Túnel', 'Tunnel')} · {club.name}</span>
                <p className="mt-1.5 break-words font-voz text-[30px] leading-[1.02]">{frase.trim() || '…'}</p>
              </div>
            </>
          )}
        </main>

        {/* CTA fixo */}
        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center bg-black/90 px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3">
          <button
            type="button"
            onClick={avancar}
            disabled={!podeAvancar[P.id] || salvando}
            className="min-h-[56px] w-full max-w-[408px] bg-rua font-impact text-[22px] uppercase text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:border-2 disabled:border-dashed disabled:border-fio disabled:bg-transparent disabled:text-mudo disabled:shadow-none"
          >
            {rotuloCta}
          </button>
        </div>
      </div>
    </div>
  );
}

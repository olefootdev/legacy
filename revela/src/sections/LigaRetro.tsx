/**
 * LIGA RETRO — a homenagem ao Elifoot no meio da landing do REVELA.
 *
 * Pedido do fundador (2026-07-24): uma janela de terminal DOS, no estilo da
 * clássica tela de classificação do Elifoot, com os dados REAIS da Liga Global.
 * "É igual antigamente, só que com times e jogadores reais."
 *
 * O gancho é a memória: quem jogou reconhece o layout antes de ler. O contraste
 * de uma janela retro no meio do site amarelo/preto é o que dá o impacto — é um
 * easter egg, não o tema.
 *
 * DADOS: `revela_standings` agrupa a Liga Global por divisão, cada uma como uma
 * tabela de campeonato (V/E/D, gols, pontos). Nenhum dado inventado — se a liga
 * ainda não tem divisões, a seção não aparece.
 *
 * COR = INFORMAÇÃO (igual ao Elifoot): quem sobe é azul, quem cai é vermelho, o
 * líder é amarelo, o meio é branco. A faixa de promoção/rebaixamento vem da
 * regra real da liga (10% do tamanho da divisão, ceil).
 */
import { useEffect, useState } from 'react';
import { GLOBAL_LEAGUE_MVP_CONSTANTS } from '@/match/globalLeagueMVP';
import { Eyebrow } from '../components/primitives';
import {
  fetchStandings,
  fetchTopScorers,
  type DivisionStanding,
  type StandingTeam,
  type TopScorer,
} from '../data/revelaApi';
import { GAME_URL } from '../data/session';

/** Nome da divisão — a nomenclatura que o jogo já usa (globalLeagueMVPReducer). */
const DIVISION_NAME: Record<number, string> = {
  1: 'Elite',
  2: 'Intermediária',
  3: 'Acesso',
  4: 'Várzea',
};

function nomeDivisao(d: number): string {
  return DIVISION_NAME[d] ?? `Divisão ${d}`;
}

type Status = 'sobe' | 'fica' | 'cai' | 'lider';

/**
 * Onde o clube está na tabela → cor. A faixa vem da regra REAL da liga: 10% da
 * divisão sobe, 10% desce (GLOBAL_LEAGUE_MVP_CONSTANTS). Divisão de cima não
 * sobe; divisão de baixo não desce.
 */
function statusDoClube(pos: number, total: number, division: number, maxDivision: number): Status {
  if (pos === 1) return 'lider';
  const sobem = Math.ceil(total * GLOBAL_LEAGUE_MVP_CONSTANTS.PROMOTION_PERCENTAGE);
  const descem = Math.ceil(total * GLOBAL_LEAGUE_MVP_CONSTANTS.RELEGATION_PERCENTAGE);
  if (division > 1 && pos <= sobem) return 'sobe';
  if (division < maxDivision && pos > total - descem) return 'cai';
  return 'fica';
}

export function LigaRetro() {
  const [divisions, setDivisions] = useState<DivisionStanding[] | null>(null);
  const [scorers, setScorers] = useState<TopScorer[]>([]);

  useEffect(() => {
    let vivo = true;
    void fetchStandings(8).then((d) => vivo && setDivisions(d));
    // A artilharia é opcional — se ainda não tem gol computado, a caixa some.
    void fetchTopScorers(8).then((s) => vivo && setScorers(s));
    return () => {
      vivo = false;
    };
  }, []);

  // Sem liga carregada, ou liga sem divisão → a seção não aparece.
  if (!divisions || divisions.length === 0) return null;

  const maxDivision = Math.max(...divisions.map((d) => d.division));

  return (
    <section className="rev-section" style={{ background: 'var(--color-rev-black)' }}>
      <div className="rev-container">
        <Eyebrow>Pra quem é da velha guarda</Eyebrow>
        <h2
          className="rev-display mt-4"
          style={{ fontSize: 'clamp(30px,6vw,64px)', color: 'var(--color-rev-bone)' }}
        >
          Você lembra
          <br />
          <span style={{ color: 'var(--color-rev-yellow)' }}>disso aqui?</span>
        </h2>
        <p className="mt-4 max-w-[40ch] text-[clamp(16px,2.4vw,20px)] leading-relaxed" style={{ color: 'rgba(237,235,228,.7)' }}>
          É igual antigamente — só que com{' '}
          <strong style={{ color: 'var(--color-rev-yellow)' }}>times e jogadores reais.</strong>
        </p>

        {/* ── A janela retro ─────────────────────────────────────────────── */}
        <div
          className="mt-8 overflow-hidden"
          style={{ borderRadius: '7px 7px 5px 5px', boxShadow: '0 24px 60px rgba(0,0,0,.5)', maxWidth: 900 }}
        >
          <TitleBar />
          <Screen divisions={divisions} maxDivision={maxDivision} scorers={scorers} />
        </div>

        <Legenda />

        <div className="mt-7 flex flex-wrap gap-3">
          <a href={GAME_URL} className="rev-btn rev-focus" data-variant="yellow">
            Entrar no jogo
          </a>
          <a href={`${GAME_URL}/competicao/ranking`} className="rev-btn rev-focus" data-variant="outline" data-on="dark">
            Ver a liga completa
          </a>
        </div>
      </div>
    </section>
  );
}

/* ══ Janela ═══════════════════════════════════════════════════════════════ */

function TitleBar() {
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5"
      style={{ background: 'linear-gradient(180deg,#2b6fd6,#1a53b0 48%,#1747a0)' }}
    >
      <span
        className="grid place-items-center"
        style={{ width: 15, height: 15, borderRadius: 2, background: '#0d0d0d', color: '#33ff66', fontFamily: 'ui-monospace, monospace', fontSize: 9 }}
      >
        ▶
      </span>
      <span
        className="min-w-0 flex-1 truncate"
        style={{ fontFamily: 'ui-monospace, "Courier New", monospace', fontSize: 12, color: '#fff', textShadow: '0 1px 1px rgba(0,0,0,.4)' }}
      >
        C:\OLEFOOT\LIGA.EXE — Classificação
      </span>
      <span className="flex gap-[3px]">
        {['_', '▢', '✕'].map((c, i) => (
          <span
            key={c}
            className="grid place-items-center"
            style={{
              width: 18,
              height: 16,
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,.55)',
              background: i === 2 ? '#d64f3f' : '#cdd7e6',
              color: i === 2 ? '#fff' : '#12336b',
              fontFamily: 'ui-monospace, monospace',
              fontSize: 9,
            }}
          >
            {c}
          </span>
        ))}
      </span>
    </div>
  );
}

const MONO = 'ui-monospace, "Courier New", "Consolas", monospace';

function Screen({
  divisions,
  maxDivision,
  scorers,
}: {
  divisions: DivisionStanding[];
  maxDivision: number;
  scorers: TopScorer[];
}) {
  return (
    <div
      style={{
        background: '#000',
        padding: '14px clamp(10px,2vw,20px) 18px',
        fontFamily: MONO,
        fontWeight: 700,
        fontSize: 'clamp(10px,1.5vw,13px)',
        lineHeight: 1.5,
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,.015) 0 2px, transparent 2px 4px)',
      }}
    >
      <div
        className="text-center uppercase"
        style={{ color: '#33ff66', letterSpacing: '0.28em', padding: '6px 0 14px' }}
      >
        Classificação · Liga Global
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
      >
        {divisions.map((d) => (
          <DivBox key={d.division} div={d} maxDivision={maxDivision} />
        ))}
      </div>

      {/* Artilharia real — só aparece quando há gol computado em partida ao vivo. */}
      <Artilharia scorers={scorers} />

      <div
        className="text-center uppercase"
        style={{ color: '#2f8f4f', letterSpacing: '0.2em', paddingTop: 14, fontSize: '0.9em' }}
      >
        ↑ Sobe · ↓ Cai · ESC pra sair… ou entra no jogo
      </div>
    </div>
  );
}

/**
 * ARTILHEIROS — a caixa de gols dos jogadores reais.
 *
 * Não vem da Liga Global (simulada). Vem das partidas ao vivo, onde o motor sabe
 * quem marcou. Some por completo enquanto não há histórico — sem "0 gol", sem
 * placeholder: uma caixa vazia mentiria sobre o que já aconteceu.
 */
function Artilharia({ scorers }: { scorers: TopScorer[] }) {
  if (scorers.length === 0) return null;
  const lider = scorers[0]?.goals ?? 0;
  return (
    <div style={{ border: '1px solid #b8860b', padding: '0 8px 8px', position: 'relative', marginTop: 26 }}>
      <span
        className="absolute uppercase"
        style={{ top: '-0.7em', left: 8, background: '#000', padding: '0 8px', color: '#ffcf3a', letterSpacing: '0.18em', fontSize: '0.92em' }}
      >
        Artilheiros
      </span>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <tbody>
          {scorers.map((s, i) => {
            const cor = s.goals === lider ? '#ffe23a' : '#dca94a';
            const cel = { padding: '1px 0', whiteSpace: 'nowrap' as const, color: cor };
            const num = { ...cel, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const };
            return (
              <tr key={s.playerId}>
                <td style={{ ...cel, paddingRight: 8, width: '1%', color: '#7a5a1a' }}>{i + 1}.</td>
                <td style={{ ...cel, paddingRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0, width: '99%' }}>
                  {s.name.toUpperCase()}
                  {s.club ? <span style={{ color: '#6b5a2a' }}> · {s.club}</span> : null}
                </td>
                <td style={{ ...num, paddingLeft: 12, color: cor }}>
                  {s.goals} {s.goals === 1 ? 'gol' : 'gols'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DivBox({ div, maxDivision }: { div: DivisionStanding; maxDivision: number }) {
  return (
    <div style={{ border: '1px solid #1f8f3f', padding: '0 8px 8px', position: 'relative' }}>
      <span
        className="absolute uppercase"
        style={{ top: '-0.7em', left: 8, background: '#000', padding: '0 8px', color: '#33ffaa', letterSpacing: '0.18em', fontSize: '0.92em' }}
      >
        Série {nomeDivisao(div.division)}
      </span>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <tbody>
          {div.teams.map((t) => (
            <Linha
              key={`${div.division}-${t.pos}`}
              team={t}
              status={statusDoClube(t.pos, div.totalClubs, div.division, maxDivision)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const COR: Record<Status, { txt: string; pt: string }> = {
  lider: { txt: '#ffe23a', pt: '#fff08a' },
  sobe: { txt: '#35a7ff', pt: '#7fc9ff' },
  fica: { txt: '#dcdcdc', pt: '#dcdcdc' },
  cai: { txt: '#ff5a4d', pt: '#ff5a4d' },
};

function Linha({ team, status }: { team: StandingTeam; status: Status }) {
  const c = COR[status];
  const cel = { padding: '1px 0', whiteSpace: 'nowrap' as const, color: c.txt };
  const num = { ...cel, textAlign: 'right' as const, paddingLeft: 7, fontVariantNumeric: 'tabular-nums' as const };
  return (
    <tr>
      <td style={{ ...cel, paddingRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0, width: '99%' }}>
        {(team.short || team.club).toUpperCase()}
      </td>
      <td style={num}>{team.wins}</td>
      <td style={num}>{team.draws}</td>
      <td style={num}>{team.losses}</td>
      <td style={{ ...num, paddingLeft: 9 }}>
        {team.goalsFor}:{team.goalsAgainst}
      </td>
      <td style={{ ...num, paddingLeft: 12, color: c.pt }}>{team.points}</td>
    </tr>
  );
}

/* ══ Legenda ══════════════════════════════════════════════════════════════ */

function Legenda() {
  const itens: Array<{ cor: string; label: string }> = [
    { cor: '#35a7ff', label: 'Sobe de divisão' },
    { cor: '#dcdcdc', label: 'Permanece' },
    { cor: '#ff5a4d', label: 'Cai de divisão' },
    { cor: '#ffe23a', label: 'Líder' },
  ];
  return (
    <div className="mt-5 flex flex-wrap gap-4 text-[12px]">
      {itens.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-2" style={{ color: 'rgba(237,235,228,.6)' }}>
          <i style={{ width: 11, height: 11, borderRadius: 2, background: i.cor }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}


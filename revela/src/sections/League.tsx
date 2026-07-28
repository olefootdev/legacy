/**
 * Top 10 Clubes e As 3 Divisões — a prova de que o game está vivo.
 *
 * FONTE: `revela_top_clubs` / `revela_divisions`. NÃO é possível ler
 * `global_league_teams` direto daqui: a leitura anônima foi revogada em
 * 20260717170000 porque o `manager_id` E o `id` daquela tabela são o e-mail do
 * manager. Os RPCs devolvem só nome do clube, pontos e divisão.
 *
 * Se alguém for "otimizar" isto trocando por um .from('global_league_teams'),
 * está reabrindo um vazamento de dado pessoal já fechado uma vez.
 */
import { GLOBAL_LEAGUE_MVP_CONSTANTS } from '@/match/globalLeagueMVP';
import { Eyebrow, ptBr } from '../components/primitives';
import { GAME_URL } from '../data/session';
import type { ClubRank, DivisionCount } from '../data/types';

const TREND_GLYPH: Record<ClubRank['trend'], { icon: string; color: string }> = {
  up: { icon: '↑', color: 'var(--color-rev-success)' },
  down: { icon: '↓', color: 'var(--color-rev-danger)' },
  flat: { icon: '—', color: 'rgba(237,235,228,.32)' },
};

export function TopClubs({ clubs }: { clubs: ClubRank[] }) {
  if (clubs.length === 0) return null;

  return (
    <section className="rev-section" style={{ background: 'var(--color-rev-black)' }}>
      <div className="rev-container">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <Eyebrow>Liga global</Eyebrow>
            <h2
              className="rev-display mt-4"
              style={{ fontSize: 'clamp(30px,4.8vw,60px)', color: 'var(--color-rev-bone)' }}
            >
              Top {clubs.length} clubes
            </h2>
          </div>
          <a
            href={`${GAME_URL}/competicao/ranking`}
            className="rev-label rev-focus text-[11px]"
            style={{ color: 'var(--color-rev-yellow)' }}
          >
            Ver classificação completa →
          </a>
        </div>

        <div className="rev-rail-scroll mt-9">
          {clubs.map((c) => {
            const first = c.rank === 1;
            const trend = TREND_GLYPH[c.trend];
            return (
              <article
                key={`${c.rank}-${c.short}`}
                className="flex flex-col justify-between p-4"
                style={{
                  width: 'clamp(162px,20vw,200px)',
                  minHeight: 176,
                  borderRadius: 'var(--radius-rev-card)',
                  background: first ? 'var(--color-rev-yellow)' : 'var(--color-rev-surface)',
                  color: first ? '#0D0D0D' : 'var(--color-rev-bone)',
                  border: first ? 'none' : '1px solid rgba(255,255,255,.08)',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="rev-display text-[38px] leading-none tabular-nums">{c.rank}</span>
                  <span
                    className="rev-label text-[11px]"
                    style={{ color: first ? 'rgba(13,13,13,.55)' : trend.color }}
                  >
                    {trend.icon}
                  </span>
                </div>

                <div>
                  <p className="rev-display text-[19px] leading-[.95]">{c.club}</p>
                  <p
                    className="rev-label mt-2 text-[10px] tabular-nums"
                    style={{ color: first ? 'rgba(13,13,13,.6)' : 'rgba(237,235,228,.48)' }}
                  >
                    {ptBr(c.points)} pts · {c.played} jogos
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ══ As 3 divisões ═════════════════════════════════════════════════════════ */

interface TierSpec {
  division: number;
  name: string;
  color: string;
  tagline: string;
  desc: string;
}

const TIERS: TierSpec[] = [
  {
    division: 1,
    name: 'Série Ouro',
    color: 'var(--color-rev-ouro)',
    tagline: 'A elite',
    desc: 'Onde os melhores managers disputam o título da temporada.',
  },
  {
    division: 2,
    name: 'Série Prata',
    color: 'var(--color-rev-prata)',
    tagline: 'A escalada',
    desc: 'O meio da pirâmide: sobe quem vence, desce quem tropeça.',
  },
  {
    division: 3,
    name: 'Série Bronze',
    color: 'var(--color-rev-bronze)',
    tagline: 'A largada',
    desc: 'Todo clube novo começa aqui. Entrada livre.',
  },
];

/**
 * Quantos sobem e quantos descem — CALCULADO, não escrito.
 *
 * O protótipo trazia "↓ 4 clubes descem" e "↑ 8 clubes sobem". Números
 * inventados: a regra real é 10% do tamanho da própria divisão, arredondado pra
 * cima (`GLOBAL_LEAGUE_MVP_CONSTANTS`, aplicada em globalLeagueMVP.ts:724). Com
 * 24 clubes na Ouro são 3, não 4.
 *
 * Isto é uma página pública prometendo uma regra de competição. Número
 * inventado aqui é promessa quebrada lá na virada de temporada — por isso sai da
 * constante do jogo e do total vivo da divisão, nunca de um literal.
 *
 * Divisão 1 só cai; divisão 3 só sobe; a do meio faz as duas (idem linhas
 * 731–735 do motor).
 */
function movementLabel(division: number, clubs: number): string {
  const up = Math.ceil(clubs * GLOBAL_LEAGUE_MVP_CONSTANTS.PROMOTION_PERCENTAGE);
  const down = Math.ceil(clubs * GLOBAL_LEAGUE_MVP_CONSTANTS.RELEGATION_PERCENTAGE);
  if (clubs === 0) return 'Aguardando clubes';
  if (division === 1) return `↓ ${down} ${down === 1 ? 'clube desce' : 'clubes descem'}`;
  if (division >= 3) return `↑ ${up} ${up === 1 ? 'clube sobe' : 'clubes sobem'}`;
  return `↑ ${up} sobem · ↓ ${down} descem`;
}

export function Divisoes({ counts }: { counts: DivisionCount[] }) {
  const byDiv = new Map(counts.map((c) => [c.division, c.clubs]));
  const total = counts.reduce((sum, c) => sum + c.clubs, 0);
  if (total === 0) return null;

  return (
    <section className="rev-section" style={{ background: 'var(--color-rev-black)' }}>
      <div className="rev-container">
        <Eyebrow>A pirâmide</Eyebrow>
        <h2
          className="rev-display mt-4"
          style={{ fontSize: 'clamp(30px,4.8vw,60px)', color: 'var(--color-rev-bone)' }}
        >
          Suba as divisões da Olefoot
        </h2>
        <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed" style={{ color: 'rgba(237,235,228,.55)' }}>
          {ptBr(total)} clubes em disputa agora. Todo mundo entra pela Bronze.
        </p>

        <div
          className="mt-10 grid items-end gap-6"
          style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(clamp(240px,28vw,300px),1fr))' }}
        >
          {TIERS.map((t) => {
            const clubs = byDiv.get(t.division) ?? 0;
            return (
              <article
                key={t.division}
                className="overflow-hidden"
                style={{
                  borderRadius: 'var(--radius-rev-card-lg)',
                  background: 'var(--color-rev-surface)',
                  border: '1px solid rgba(255,255,255,.08)',
                }}
              >
                <span className="block" style={{ height: 5, background: t.color }} />
                <div className="p-6">
                  <p className="rev-display leading-none" style={{ fontSize: 62, color: t.color }}>
                    {t.division}
                  </p>
                  <p
                    className="rev-editorial mt-3 text-[28px]"
                    style={{ color: 'var(--color-rev-bone)' }}
                  >
                    {t.name}
                  </p>
                  <p className="rev-label mt-2 text-[10px]" style={{ color: 'rgba(237,235,228,.45)' }}>
                    {t.tagline} · {ptBr(clubs)} {clubs === 1 ? 'clube' : 'clubes'}
                  </p>
                  <p className="mt-4 text-[13px] leading-relaxed" style={{ color: 'rgba(237,235,228,.5)' }}>
                    {t.desc}
                  </p>
                  <p className="rev-label mt-4 text-[10px]" style={{ color: t.color }}>
                    {movementLabel(t.division, clubs)}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

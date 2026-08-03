/**
 * Top 10 Clubes — a prova de que o game está vivo.
 *
 * FONTE: `revela_top_clubs`. NÃO é possível ler
 * `global_league_teams` direto daqui: a leitura anônima foi revogada em
 * 20260717170000 porque o `manager_id` E o `id` daquela tabela são o e-mail do
 * manager. Os RPCs devolvem só nome do clube, pontos e divisão.
 *
 * Se alguém for "otimizar" isto trocando por um .from('global_league_teams'),
 * está reabrindo um vazamento de dado pessoal já fechado uma vez.
 */
import { Eyebrow, ptBr } from '../components/primitives';
import { GAME_URL } from '../data/session';
import type { ClubRank } from '../data/types';

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

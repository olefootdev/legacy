/**
 * As seções de talento: Descoberta, Reveal Wall e Em Alta.
 *
 * Todas leem a MESMA lista (`talents`) — o que muda é a ordenação e o recorte.
 * Uma fonte, várias leituras. Se fossem vários fetches, os números do mesmo
 * jogador divergiriam entre as seções da mesma tela.
 *
 * A "Torcida Digital" saiu em 2026-08-03: ela ordenava por fã ACUMULADO, que é
 * exatamente o que A Trajetória passou a fazer — só que por categoria, com
 * disputa e prêmio. Duas listas pra mesma pergunta, e a mais fraca ganhava a
 * dobra melhor.
 *
 * Todas degradam pra convite quando ainda não há talento aprovado. A página
 * nunca finge jogador — o funil começa vazio de propósito.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AttrBar,
  Eyebrow,
  LegendMark,
  OvrBadge,
  Portrait,
  Sticker,
  ehLenda,
  keyAttrs,
  ptBr,
} from '../components/primitives';
import type { CardStatus, Talent } from '../data/types';
import type { RisingTalent } from '../data/revelaApi';

/** Status derivado do estado real do talento — nada é decorativo. */
function statusOf(t: Talent, rankBySupporters: number): CardStatus {
  if (t.carded) return 'card-ready';
  if (rankBySupporters === 0 && t.supporters > 0) return 'hot';
  if (t.supporters >= 10) return 'rising';
  if (t.overall != null) return 'scouted';
  return 'new';
}

/* ══ 1. Descoberta ═════════════════════════════════════════════════════════ */

export function Discovery({
  talents,
  supported,
  onSupport,
}: {
  talents: Talent[];
  supported: Set<string>;
  onSupport: (t: Talent) => void;
}) {
  const topSupporterId = [...talents].sort((a, b) => b.supporters - a.supporters)[0]?.id;

  return (
    <section
      id="descobrir"
      className="rev-section"
      style={{ background: 'var(--color-rev-yellow)', color: '#0D0D0D' }}
    >
      <div className="rev-container">
        <Eyebrow on="yellow">Descoberta</Eyebrow>
        <h2 className="rev-display mt-4 max-w-[18ch]" style={{ fontSize: 'clamp(34px,5.4vw,70px)' }}>
          Olefoot é parceira oficial dos novos talentos
        </h2>

        {talents.length === 0 ? (
          <EmptyInvite
            on="yellow"
            title="A vitrine abre com você."
            body="Ainda não temos nenhum talento aprovado pelo OLE SCOUT. Cria teu perfil e sê o primeiro nome desta página."
          />
        ) : (
          <>
            <p className="rev-label mt-4 text-[10px]" style={{ color: 'rgba(13,13,13,.45)' }}>
              Arraste · passe o mouse · revele
            </p>

            {/* Trilho vira grade centrada enquanto há poucos nomes. Um card só,
                encostado à esquerda num trilho de rolagem, lê como layout
                quebrado; centrado, lê como começo. Acima de 2, o trilho volta a
                fazer sentido — aí existe algo pra arrastar. */}
            <div
              className="rev-rail-scroll mt-8"
              style={talents.length < 3 ? { justifyContent: 'center', overflowX: 'visible', flexWrap: 'wrap' } : undefined}
            >
              {talents.map((t) => (
                <TalentCard
                  key={t.id}
                  talent={t}
                  status={statusOf(t, t.id === topSupporterId ? 0 : 1)}
                  supported={supported.has(t.id)}
                  onSupport={() => onSupport(t)}
                />
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link to="/comecar" className="rev-btn rev-focus">
                Criar perfil de jogador
              </Link>
              <p className="rev-label mt-3 text-[10px]" style={{ color: 'rgba(13,13,13,.45)' }}>
                É de graça. O próximo nome pode ser o seu.
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * Card de talento. O hover não é enfeite: ele TROCA a leitura do card de
 * "quem é" para "como joga" — que é a pergunta seguinte de quem descobre
 * alguém. No toque, o mesmo gesto acontece no tap.
 */
function TalentCard({
  talent,
  status,
  supported,
  onSupport,
}: {
  talent: Talent;
  status: CardStatus;
  supported: boolean;
  onSupport: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const attrs = keyAttrs(talent.pos, talent.attributes);

  return (
    <article
      className="rev-poster relative"
      style={{ width: 'clamp(232px,24vw,286px)' }}
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => setRevealed(false)}
      onFocus={() => setRevealed(true)}
      onBlur={() => setRevealed(false)}
    >
      <Link to={`/t/${talent.slug}`} className="rev-focus relative block" data-on="dark">
        <Portrait src={talent.portrait} alt={talent.name} ratio="3 / 4" width={300} />

        <div className="absolute left-2.5 top-2.5">
          <OvrBadge value={talent.overall} />
        </div>
        <div className="absolute right-2.5 top-2.5 flex flex-col items-end gap-1.5">
          <Sticker status={status} />
          {ehLenda(talent.gameSituation) && <LegendMark compact />}
        </div>

        {/* Camada revelada — nome + como joga. */}
        <div
          className="absolute inset-0 flex flex-col justify-end gap-2.5 p-4"
          style={{
            background: 'linear-gradient(to top, rgba(13,13,13,.96) 30%, rgba(13,13,13,.72) 100%)',
            opacity: revealed ? 1 : 0,
            transition: 'opacity var(--dur-rev-base) var(--ease-rev)',
            pointerEvents: revealed ? 'auto' : 'none',
          }}
        >
          <p
            className="rev-editorial text-[24px]"
            style={{ color: 'var(--color-rev-bone)' }}
          >
            {talent.name}
          </p>
          {attrs.length > 0 ? (
            <div className="flex flex-col gap-2">
              {attrs.map((a) => (
                <AttrBar key={a.key} label={a.label} value={a.value} active={revealed} />
              ))}
            </div>
          ) : (
            <p className="rev-label text-[10px]" style={{ color: 'rgba(237,235,228,.5)' }}>
              Ficha em avaliação pelo OLE SCOUT
            </p>
          )}
        </div>

        {/* Placa de nome — visível quando o card está "fechado". */}
        <div
          className="rev-rail absolute inset-x-2.5 bottom-2.5 px-3 py-2"
          style={{
            background: 'rgba(13,13,13,.9)',
            borderRadius: 5,
            opacity: revealed ? 0 : 1,
            transition: 'opacity var(--dur-rev-base) var(--ease-rev)',
          }}
        >
          <p className="rev-display text-[18px] leading-none" style={{ color: 'var(--color-rev-bone)' }}>
            {talent.name}
          </p>
          <p className="rev-label mt-1 text-[9px]" style={{ color: 'rgba(237,235,228,.5)' }}>
            {[talent.pos, talent.club ?? talent.city].filter(Boolean).join(' · ')}
          </p>
        </div>
      </Link>

      {/* Rodapé de ação */}
      <div
        className="flex items-center justify-between gap-2 px-3 py-2.5"
        style={{ background: '#0D0D0D' }}
      >
        <span className="flex items-baseline gap-1.5">
          <span className="rev-display text-[17px]" style={{ color: 'var(--color-rev-yellow)' }}>
            {ptBr(talent.supporters)}
          </span>
          <span className="rev-label text-[9px]" style={{ color: 'rgba(237,235,228,.45)' }}>
            {talent.supporters === 1 ? 'fã' : 'fãs'}
          </span>
        </span>
        <SupportButton supported={supported} onClick={onSupport} />
      </div>
    </article>
  );
}

/**
 * APOIAR é um gesto emocional, não uma compra. O rótulo confirmado diz onde a
 * pessoa está ("na torcida"), não o que ela gastou.
 */
export function SupportButton({
  supported,
  onClick,
  full = false,
}: {
  supported: boolean;
  onClick: () => void;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={supported}
      aria-label={supported ? 'Você já está na torcida' : 'Virar fã deste jogador'}
      className="rev-label rev-focus"
      data-on="dark"
      style={{
        minHeight: 34,
        width: full ? '100%' : undefined,
        padding: '0 12px',
        borderRadius: 5,
        fontSize: 10,
        letterSpacing: '.14em',
        cursor: supported ? 'default' : 'pointer',
        background: supported ? 'transparent' : 'var(--color-rev-yellow)',
        color: supported ? 'var(--color-rev-success)' : '#0D0D0D',
        border: supported ? '2px solid var(--color-rev-success)' : '2px solid var(--color-rev-yellow)',
        transition: 'all var(--dur-rev-micro) var(--ease-rev)',
      }}
    >
      {supported ? '✓ Na torcida' : 'Sou fã'}
    </button>
  );
}

/* ══ 2. Reveal Wall ════════════════════════════════════════════════════════ */

/**
 * O mural é a única seção que mostra volume. O amarelo cobre a foto e só sai no
 * hover — a mecânica é literalmente "revelar", que é o nome do produto.
 */
export function RevealWall({ talents }: { talents: Talent[] }) {
  const wall = [...talents].sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0)).slice(0, 11);

  return (
    <section
      id="mural"
      className="rev-section"
      style={{ background: 'var(--color-rev-yellow)', color: '#0D0D0D' }}
    >
      <div className="rev-container">
        <Eyebrow on="yellow">Reveal wall</Eyebrow>
        <h2 className="rev-display mt-4" style={{ fontSize: 'clamp(32px,5.4vw,68px)' }}>
          Uma geração inteira surgindo.
        </h2>

        {wall.length === 0 ? (
          <EmptyInvite
            on="yellow"
            title="O mural está em branco."
            body="Cada perfil aprovado ocupa um quadro aqui. O primeiro ainda está livre."
          />
        ) : (
          <div
            className="mt-9 grid gap-2.5"
            style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(clamp(110px,15vw,168px),1fr))' }}
          >
            {wall.map((t) => (
              <WallTile key={t.id} talent={t} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function WallTile({ talent }: { talent: Talent }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <Link
      to={`/t/${talent.slug}`}
      className="rev-focus relative block overflow-hidden"
      data-on="yellow"
      style={{ border: '2px solid #0D0D0D', borderRadius: 8 }}
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => setRevealed(false)}
      onFocus={() => setRevealed(true)}
      onBlur={() => setRevealed(false)}
    >
      <Portrait src={talent.portrait} alt={talent.name} ratio="3 / 4" width={180} />
      <div
        className="absolute inset-0 flex flex-col justify-between p-2.5"
        style={{
          background: 'var(--color-rev-yellow)',
          opacity: revealed ? 0 : 1,
          transition: 'opacity var(--dur-rev-base) var(--ease-rev)',
        }}
      >
        <span className="flex items-start justify-between gap-1">
          <span className="rev-display text-[13px]">{talent.pos}</span>
          {talent.overall != null && <span className="rev-display text-[13px]">{talent.overall}</span>}
        </span>
        <span className="rev-display text-[15px] leading-[.95]">{talent.name}</span>
      </div>
      <span
        className="pointer-events-none absolute inset-x-2 bottom-2 rev-display text-[14px] leading-none"
        style={{ color: 'var(--color-rev-bone)', opacity: revealed ? 1 : 0, transition: 'opacity var(--dur-rev-base)' }}
      >
        {talent.name}
      </span>
    </Link>
  );
}

/* ══ Estado vazio ══════════════════════════════════════════════════════════ */

function EmptyInvite({
  title,
  body,
  on,
}: {
  title: string;
  body: string;
  on: 'yellow' | 'light' | 'dark';
}) {
  const dark = on === 'dark';
  return (
    <div
      className="mt-8 max-w-[52ch] px-6 py-7"
      style={{
        border: dark ? '2px dashed rgba(237,235,228,.28)' : '2px dashed rgba(13,13,13,.28)',
        borderRadius: 'var(--radius-rev-card)',
      }}
    >
      <p className="rev-display text-[26px] leading-tight">{title}</p>
      <p
        className="mt-2.5 text-[14px] leading-relaxed"
        style={{ color: dark ? 'rgba(237,235,228,.6)' : 'rgba(13,13,13,.6)' }}
      >
        {body}
      </p>
      <Link
        to="/comecar"
        className="rev-btn rev-focus mt-5"
        data-on={dark ? 'dark' : undefined}
        data-variant={dark ? 'yellow' : undefined}
      >
        Criar meu perfil
      </Link>
    </div>
  );
}

export { EmptyInvite };

/* ══ 4. Em Alta da Semana ═══════════════════════════════════════════════════
 *
 * Ranking JUSTO: por crescimento nos últimos 7 dias, não por total. Some sozinho
 * quando ninguém cresceu na semana — nunca finge movimento. O prêmio da mecânica
 * é este palco: aparecer aqui É a recompensa.
 */
export function EmAlta({ rising }: { rising: RisingTalent[] }) {
  if (rising.length === 0) return null;
  return (
    <section className="rev-section" style={{ background: 'var(--color-rev-black)' }}>
      <div className="rev-container">
        <Eyebrow>Em alta essa semana</Eyebrow>
        <h2
          className="rev-display mt-4 max-w-[18ch]"
          style={{ fontSize: 'clamp(30px,5.2vw,64px)', color: 'var(--color-rev-bone)' }}
        >
          Quem mais cresceu nos últimos 7 dias.
        </h2>
        <p className="mt-4 max-w-[48ch] text-[15px]" style={{ color: 'rgba(237,235,228,.6)' }}>
          Não é quem tem mais torcida — é quem mais correu atrás dela essa semana. Zera toda
          segunda: o novato pode liderar.
        </p>

        <div
          className="rev-rail-scroll mt-8"
          style={rising.length < 3 ? { justifyContent: 'center', overflowX: 'visible', flexWrap: 'wrap' } : undefined}
        >
          {rising.map((t, i) => (
            <RisingCard key={t.id} t={t} rank={i + 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RisingCard({ t, rank }: { t: RisingTalent; rank: number }) {
  return (
    <article className="rev-poster relative" style={{ width: 'clamp(196px,20vw,236px)' }}>
      <Link to={`/t/${t.slug}`} className="rev-focus relative block" data-on="dark">
        <Portrait src={t.portrait} alt={t.name} ratio="3 / 4" width={260} />

        <div className="absolute left-2.5 top-2.5">
          <OvrBadge value={t.overall} />
        </div>
        {/* Posição no ranking da semana. */}
        <div
          className="absolute right-2.5 top-2.5 grid place-items-center rev-editorial"
          style={{
            minWidth: 30, height: 30, padding: '0 8px', borderRadius: 8,
            background: rank === 1 ? 'var(--color-rev-yellow)' : 'rgba(13,13,13,.72)',
            color: rank === 1 ? '#0D0D0D' : 'var(--color-rev-bone)',
            border: rank === 1 ? 'none' : '1px solid rgba(237,235,228,.25)',
            fontSize: 15,
          }}
        >
          #{rank}
        </div>

        <div
          className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-3"
          style={{ background: 'linear-gradient(to top, rgba(13,13,13,.97) 40%, transparent)' }}
        >
          <p className="rev-editorial text-[18px]" style={{ color: 'var(--color-rev-bone)' }}>
            {t.name}
          </p>
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ background: 'rgba(34,197,94,.16)', color: '#4ade80', border: '1px solid rgba(34,197,94,.35)' }}
          >
            ↑ +{t.weeklyGain} {t.weeklyGain === 1 ? 'fã' : 'fãs'} essa semana
          </span>
        </div>
      </Link>
    </article>
  );
}

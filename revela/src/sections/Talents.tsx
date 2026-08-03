/**
 * A seção de talento: Descoberta.
 *
 *
 * TRÊS SEÇÕES SAÍRAM DAQUI, todas pelo mesmo motivo: a home tinha cinco listas
 * do MESMO elenco, e o visitante via o mesmo atleta cinco vezes.
 *   Torcida Digital (03/08) — ordenava por fã acumulado, que A Trajetória já faz
 *                             melhor: por categoria, com disputa e prêmio.
 *   Em Alta da Semana (04/08) — era o recorte de 7 dias; virou um BOTÃO dentro
 *                             do Placar, junto com 24h, mês e sempre.
 *   Reveal Wall (04/08) — ordenava por nota do scout, igual à Descoberta, e
 *                             prometia "uma geração inteira" mostrando um nome.
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

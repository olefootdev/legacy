import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { OnboardingPackage } from './buildOnboardingPackage';
import type { RarityTier } from './draftStarterSquad';
import { STARTER_EXP_TIERS } from './rollStarterExp';
import { DAILY_REWARDS_7D, type DailyReward } from './dailyBonus';

/**
 * Cerimônia de onboarding — capítulos editoriais.
 *
 * Tom visual (VOLT2): tipo grande em Anton, asfalto chapado, volt como ação.
 * Sem serifa, sem itálico, sem inclinação, sem sombra. Degradê só como scrim
 * sobre foto (legibilidade do OVR/nome). Sem áudio. Cada capítulo respira.
 */

const TIER_LABEL: Record<RarityTier, string> = {
  basic: 'Básico',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Lendário',
};

/** Cor de raridade em token VOLT2 (era hex solto: cinza/azul/amarelo/amarelo). */
const TIER_ACCENT: Record<RarityTier, string> = {
  basic: 'var(--color-cimento)',
  rare: 'var(--color-giz)',
  epic: 'var(--color-lenda)',
  legendary: 'var(--color-neon-yellow)',
};

function ChapterLabel({ children }: { children: string }) {
  return <span className="ole-eyebrow-poster">{children}</span>;
}

/** Botão de avanço: volt chapado + corte do escudo (.btn-primary). Sem inclinação. */
function NextButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn-primary flex h-14 items-center justify-center px-10 text-[18px] disabled:opacity-50 disabled:cursor-wait"
    >
      {children}
    </button>
  );
}

/** Título de capítulo em Anton (era serifa itálica). */
const TITULO = 'font-impact uppercase text-white';

/**
 * CeremonyPlayerCard — adaptação do TransferRowCard (rota /transfer) para a cerimônia.
 *
 * Mantém o padrão canônico: foto à esquerda com OVR/POS sobreposto + bloco de info à direita.
 * Diferenças em relação ao TransferRowCard: sem grid PAC/SHO/PAS (cards de cerimônia não trazem
 * stats), sem CTA de lance, sem rodapé "Encerra em". Em troca, exibe badge de tier (Lendário,
 * Épico, etc.) e, na variante hero, posição #1/#2/#3 no canto superior.
 *
 * Ver memória `pattern_view_player_card.md` (decisão 2026-04-29).
 */
type CeremonyCardData = {
  id: string;
  name: string;
  pos: string;
  tier: RarityTier;
  ovr: number;
  portraitUrl?: string;
};

function CeremonyPlayerCard({
  player,
  rank,
  variant = 'hero',
}: {
  player: CeremonyCardData;
  rank?: number; // posição no Top 3 (#1, #2, #3)
  variant?: 'hero' | 'mini';
}) {
  const accent = TIER_ACCENT[player.tier];
  const isHero = variant === 'hero';
  return (
    <div
      className="group flex w-full overflow-hidden border bg-panel"
      style={{ borderColor: accent }}
    >
      <div
        className="relative flex-shrink-0 overflow-hidden bg-deep-black border-r border-white/10"
        style={{
          width: isHero ? 'clamp(112px, 24%, 176px)' : 96,
        }}
      >
        {player.portraitUrl ? (
          <img
            src={player.portraitUrl}
            alt=""
            className="absolute inset-0 object-cover object-top grayscale transition-all duration-500 group-hover:grayscale-0"
            // Inline de propósito: mobile-responsive.css tem `img { height: auto }`
            // fora de camada, que vence o h-full do Tailwind.
            style={{ width: '100%', height: '100%' }}
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        ) : null}
        {/* Scrim da foto — legibilidade do OVR (único degradê do card). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/65 via-black/15 to-transparent"
        />
        <div className="absolute top-2 left-2 md:top-3 md:left-3 z-10">
          <p
            className="ole-num text-neon-yellow leading-none"
            style={{ fontSize: isHero ? 'clamp(30px, 5vw, 48px)' : 26 }}
          >
            {player.ovr}
          </p>
          <p className="mt-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-giz">
            {player.pos}
          </p>
        </div>
        {rank ? (
          <span className="ole-num absolute bottom-2 left-2 z-10 inline-flex items-center bg-neon-yellow text-black px-2 py-0.5 text-[10px]">
            #{rank}
          </span>
        ) : null}
      </div>

      <div className={`flex min-w-0 flex-1 flex-col gap-2 ${isHero ? 'px-4 py-4' : 'px-3 py-2.5'}`}>
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <p
              className="font-impact text-white uppercase truncate"
              style={{ fontSize: isHero ? 'clamp(18px, 2.4vw, 24px)' : 15, lineHeight: 1.1 }}
            >
              {player.name}
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento">
              {player.pos} · OVR {player.ovr}
            </p>
          </div>
          <span
            className="shrink-0 inline-flex items-center border bg-deep-black px-2 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.14em]"
            style={{ borderColor: accent, color: accent }}
          >
            {TIER_LABEL[player.tier]}
          </span>
        </div>

        {isHero ? (
          <div className="mt-auto flex min-w-0 items-baseline gap-2 border-t border-white/10 pt-2">
            <span className="font-impact uppercase leading-[1.1] text-neon-yellow" style={{ fontSize: 'clamp(18px, 2.4vw, 22px)' }}>
              {TIER_LABEL[player.tier]}
            </span>
            <span className="min-w-0 truncate font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-cimento">
              · Pioneiro do clube
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StageWrap({ children }: { children: import('react').ReactNode }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center px-6 sm:px-12"
      style={{
        animation: 'olefoot-fade-up 700ms cubic-bezier(.22,.61,.36,1) both',
      }}
    >
      <div className="w-full max-w-[1100px]">{children}</div>
    </div>
  );
}

/* ───────────────────── Capítulo: Intro ───────────────────── */
export function IntroChapter(props: {
  clubName: string;
  clubInitials: string;
  onNext: () => void;
}) {
  return (
    <StageWrap>
      <div className="flex flex-col items-center text-center gap-8">
        <ChapterLabel>Olefoot · História Viva</ChapterLabel>

        <img
          src="/brand/olefoot-icone-yellow-01.svg"
          alt="Olefoot"
          style={{ width: 220, height: 'auto' }}
          className="select-none"
          draggable={false}
        />

        <h1
          className={TITULO}
          style={{ fontSize: 'clamp(40px, 9vw, 80px)', lineHeight: 1.02, letterSpacing: '-0.01em' }}
        >
          Hoje começa a história
          <br />
          do{' '}
          <span className="text-neon-yellow [overflow-wrap:anywhere]">{props.clubName}</span>.
        </h1>

        <span className="font-mono text-[12px] font-medium text-cimento">#cofre #plantel #astros</span>

        <div className="pt-2">
          <NextButton onClick={props.onNext}>Abrir o cofre</NextButton>
        </div>
      </div>
    </StageWrap>
  );
}

/* ───────────────────── Capítulo: Cofre / EXP roulette ───────────────────── */
export function ExpRouletteChapter(props: {
  expTierId: string;
  onNext: () => void;
}) {
  const targetIdx = STARTER_EXP_TIERS.findIndex((t) => t.id === props.expTierId);
  const targetTier = STARTER_EXP_TIERS[targetIdx >= 0 ? targetIdx : 0]!;
  const [phase, setPhase] = useState<'spin' | 'reveal'>('spin');
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let i = 0;
    const totalSpins = STARTER_EXP_TIERS.length * 4 + targetIdx;
    const tick = () => {
      if (cancelled) return;
      i++;
      setActiveIdx(i % STARTER_EXP_TIERS.length);
      if (i >= totalSpins) {
        setPhase('reveal');
        return;
      }
      const slowFactor = i > totalSpins - 5 ? 240 : i > totalSpins - 10 ? 140 : 70;
      window.setTimeout(tick, slowFactor);
    };
    window.setTimeout(tick, 250);
    return () => {
      cancelled = true;
    };
  }, [targetIdx]);

  return (
    <StageWrap>
      <div className="flex flex-col items-center text-center gap-7">
        <ChapterLabel>Capítulo I · Cofre Fundador</ChapterLabel>

        <h2 className={TITULO} style={{ fontSize: 'clamp(32px, 7vw, 56px)', lineHeight: 1.04 }}>
          O capital inicial<br />que vai mover o clube.
        </h2>

        <div className="w-full max-w-[420px] flex flex-col gap-2">
          {STARTER_EXP_TIERS.map((t, i) => {
            const isActive = phase === 'spin' ? i === activeIdx : t.id === targetTier.id;
            const isWinner = phase === 'reveal' && t.id === targetTier.id;
            return (
              <div
                key={t.id}
                className="px-6 py-3 flex items-center justify-between transition-colors"
                style={{
                  background: isWinner
                    ? 'var(--color-neon-yellow)'
                    : isActive
                      ? 'rgba(253,225,0,0.18)'
                      : 'rgba(255,255,255,0.04)',
                  color: isWinner ? 'var(--color-deep-black)' : 'var(--color-giz)',
                  border: isWinner
                    ? '2px solid var(--color-neon-yellow)'
                    : '1px solid rgba(255,255,255,0.10)',
                }}
              >
                <span className="font-mono uppercase" style={{ fontSize: 13, letterSpacing: '0.16em' }}>
                  {t.id}
                </span>
                <span className="ole-num" style={{ fontSize: 20 }}>
                  {t.label}
                </span>
              </div>
            );
          })}
        </div>

        {phase === 'reveal' && (
          <div
            className="flex flex-col items-center gap-3"
            style={{ animation: 'olefoot-fade-up 500ms both' }}
          >
            <span className="ole-eyebrow-poster">O cofre revelou</span>
            <div
              className="font-impact text-neon-yellow"
              style={{
                fontSize: 'clamp(80px, 14vw, 160px)',
                lineHeight: 0.9,
                letterSpacing: '-0.02em',
              }}
            >
              {targetTier.label}
            </div>
            <div className="font-mono uppercase text-cimento" style={{ fontSize: 13, letterSpacing: '0.2em' }}>
              EXP iniciais
            </div>
            <div className="pt-4">
              <NextButton onClick={props.onNext}>Convocar o plantel</NextButton>
            </div>
          </div>
        )}
      </div>
    </StageWrap>
  );
}

/* ───────────────────── Capítulo: 25 Pioneiros ───────────────────── */
export function SquadDraftChapter(props: {
  pkg: OnboardingPackage;
  onNext: () => void;
}) {
  // revealOrder vem legendary→basic (sort do package). Para a cerimônia
  // queremos basic→legendary: começa rápido, sobe a tensão até as estrelas.
  const cards = useMemo(() => [...props.pkg.revealOrder].reverse(), [props.pkg.revealOrder]);
  const [revealedCount, setRevealedCount] = useState(0);

  useEffect(() => {
    if (revealedCount >= cards.length) return;
    // Cards aparecem em ritmo crescente: basics rápido (60ms), épicos/legendary mais devagar (260ms)
    const next = cards[revealedCount]!;
    const delay =
      next.tier === 'legendary' ? 420 : next.tier === 'epic' ? 260 : next.tier === 'rare' ? 130 : 60;
    const t = window.setTimeout(() => setRevealedCount((c) => c + 1), delay);
    return () => window.clearTimeout(t);
  }, [revealedCount, cards]);

  const done = revealedCount >= cards.length;

  return (
    <div
      className="absolute inset-0 overflow-y-auto"
      style={{ animation: 'olefoot-fade-up 700ms cubic-bezier(.22,.61,.36,1) both' }}
    >
      <div className="w-full max-w-[1100px] mx-auto px-6 sm:px-12 py-8 flex flex-col gap-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <ChapterLabel>Capítulo II · 25 Pioneiros</ChapterLabel>
          <div className="ole-num text-giz" style={{ fontSize: 13 }}>
            {revealedCount} / {cards.length}
          </div>
        </div>

        <h2 className={TITULO} style={{ fontSize: 'clamp(28px, 6vw, 44px)', lineHeight: 1.06 }}>
          Os primeiros nomes a vestir as cores do clube.
        </h2>

        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {cards.map((c, i) => {
            const visible = i < revealedCount;
            return (
              <div
                key={c.id}
                className="relative overflow-hidden border border-white/10 bg-deep-black"
                style={{
                  aspectRatio: '5 / 6',
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(8px)',
                  transition: 'opacity 320ms ease, transform 320ms ease',
                }}
              >
                {/* Barra vertical na cor da raridade — é dado (tier), não enfeite. */}
                <div
                  className="absolute left-0 top-0 bottom-0 z-20"
                  style={{
                    width: 4,
                    background: TIER_ACCENT[c.tier],
                  }}
                />
                {/* Foto centralizada no fundo */}
                {c.portraitUrl ? (
                  <img
                    src={c.portraitUrl}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 object-cover grayscale"
                    style={{ width: '100%', height: '100%', opacity: 0.42 }}
                  />
                ) : null}
                {/* Scrim da foto — legibilidade do OVR e do nome (degradê permitido). */}
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.85) 100%)',
                  }}
                />
                {/* OVR — topo esquerda */}
                <div
                  className="ole-num absolute top-2 left-3 z-10 text-neon-yellow leading-none"
                  style={{ fontSize: 'clamp(22px, 4.5vw, 44px)' }}
                >
                  {c.ovr}
                </div>
                {/* Nome + POS — base direita */}
                <div className="absolute bottom-2 right-3 z-10 flex flex-col items-end leading-tight">
                  <div
                    className="font-impact uppercase text-white truncate max-w-full"
                    style={{ fontSize: 13, letterSpacing: '0.04em', lineHeight: 1.1 }}
                  >
                    {c.name}
                  </div>
                  <div
                    className="font-mono uppercase text-neon-yellow"
                    style={{ fontSize: 9.5, letterSpacing: '0.16em', fontWeight: 500 }}
                  >
                    {c.pos}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2 pb-4">
          <NextButton onClick={props.onNext}>
            {done ? 'Conhecer os astros' : 'Aguarde…'}
          </NextButton>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── Capítulo: Top 3 (capa) ───────────────────── */
export function Top3Chapter(props: {
  top3: OnboardingPackage['top3'];
  onNext: () => void;
}) {
  // revealed = quantidade de cards já revelados (0 a 3). Usuário toca a tela para revelar o próximo.
  // Sem timers automáticos: evita travas e dá ritmo cerimonial — um por vez.
  const [revealed, setRevealed] = useState(0);
  const total = props.top3.length;
  const allRevealed = revealed >= total;

  const handleTap = () => {
    if (!allRevealed) setRevealed((n) => Math.min(total, n + 1));
  };

  return (
    <StageWrap>
      <div
        className="flex flex-col gap-6 cursor-pointer select-none"
        onClick={handleTap}
        role={allRevealed ? undefined : 'button'}
        aria-label={allRevealed ? undefined : 'Tocar para revelar o próximo astro'}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <ChapterLabel>Capítulo III · Os Astros</ChapterLabel>
          <div className="ole-num text-giz" style={{ fontSize: 13 }}>
            {revealed} / {total}
          </div>
        </div>

        <h2 className={TITULO} style={{ fontSize: 'clamp(34px, 7vw, 72px)', lineHeight: 1.02 }}>
          E entre eles,<br />
          <span className="text-neon-yellow">três nomes</span> brilharam mais alto.
        </h2>

        <div className="flex flex-col gap-3 mt-2">
          {props.top3.map((p, i) => {
            const visible = i < revealed;
            return (
              <div
                key={p.id}
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(16px)',
                  transition: 'opacity 420ms ease, transform 420ms ease',
                  pointerEvents: visible ? 'auto' : 'none',
                }}
              >
                {visible ? <CeremonyPlayerCard player={p} rank={i + 1} variant="hero" /> : null}
              </div>
            );
          })}
        </div>

        {!allRevealed ? (
          <div
            className="font-mono uppercase text-neon-yellow text-center pt-2"
            style={{ fontSize: 12, letterSpacing: '0.2em', animation: 'olefoot-fade-up 400ms both' }}
          >
            Toque para revelar o {revealed === 0 ? 'primeiro' : revealed === 1 ? 'segundo' : 'terceiro'} astro
          </div>
        ) : (
          <div
            className="flex justify-end"
            style={{ animation: 'olefoot-fade-up 400ms both' }}
            onClick={(e) => e.stopPropagation()}
          >
            <NextButton onClick={props.onNext}>Rotina dos campeões</NextButton>
          </div>
        )}
      </div>
    </StageWrap>
  );
}

/* ───────────────────── Capítulo: Daily Bonus dia 1 ───────────────────── */
export function DailyBonusChapter(props: { onClaim: () => void; onNext: () => void }) {
  const [claimed, setClaimed] = useState(false);

  const dayCardStyle = (r: DailyReward, isToday: boolean): CSSProperties => ({
    background:
      isToday && claimed
        ? 'var(--color-neon-yellow)'
        : isToday
          ? 'rgba(253,225,0,0.12)'
          : 'rgba(255,255,255,0.04)',
    border: isToday
      ? '2px solid var(--color-neon-yellow)'
      : '1px solid rgba(255,255,255,0.10)',
    color: isToday && claimed ? 'var(--color-deep-black)' : 'var(--color-giz)',
  });

  return (
    <StageWrap>
      <div className="flex flex-col gap-6">
        <ChapterLabel>Capítulo IV · Rotina dos Campeões</ChapterLabel>

        <h2 className={TITULO} style={{ fontSize: 'clamp(32px, 7vw, 56px)', lineHeight: 1.04 }}>
          Volte todo dia.<br />
          <span className="text-neon-yellow">A casa retribui.</span>
        </h2>

        <p className="font-sans text-cimento max-w-[640px]" style={{ fontSize: 15, lineHeight: 1.5 }}>
          Falte mais de 48h e a sequência reinicia.
        </p>

        <div className="grid grid-cols-7 gap-2">
          {DAILY_REWARDS_7D.map((r) => {
            const isToday = r.day === 1;
            return (
              <div
                key={r.day}
                className="px-1 py-3 flex min-w-0 flex-col items-center text-center gap-1 transition-colors"
                style={dayCardStyle(r, isToday)}
              >
                <div className="flex min-w-0 flex-col items-center gap-1">
                  <span
                    className="font-mono uppercase"
                    style={{ fontSize: 9, letterSpacing: '0.14em', opacity: 0.7 }}
                  >
                    Dia
                  </span>
                  <span
                    className="font-impact"
                    style={{ fontSize: 28, lineHeight: 1.05 }}
                  >
                    {r.day}
                  </span>
                  <span
                    className="font-sans"
                    style={{ fontSize: 10, lineHeight: 1.15, opacity: 0.85 }}
                  >
                    {r.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          {!claimed ? (
            <NextButton
              onClick={() => {
                setClaimed(true);
                props.onClaim();
              }}
            >
              Reivindicar dia 1
            </NextButton>
          ) : (
            <NextButton onClick={props.onNext}>Continuar</NextButton>
          )}
        </div>
      </div>
    </StageWrap>
  );
}

/* ───────────────────── Capítulo: Outro ───────────────────── */
export function OutroChapter(props: { managerName: string; onFinish: () => void; finishing?: boolean }) {
  return (
    <StageWrap>
      <div className="flex flex-col items-center text-center gap-8">
        <h1
          className={TITULO}
          style={{ fontSize: 'clamp(48px, 11vw, 112px)', lineHeight: 1.02, letterSpacing: '-0.01em' }}
        >
          Bem-vindo,
          <br />
          <span className="text-neon-yellow [overflow-wrap:anywhere]">{props.managerName}</span>
        </h1>
        <NextButton onClick={props.onFinish} disabled={props.finishing}>
          {props.finishing ? 'Salvando...' : 'Acessar painel'}
        </NextButton>
      </div>
    </StageWrap>
  );
}

/* ───────────────────── Loading + Erro ───────────────────── */
export function LoadingChapter() {
  return (
    <StageWrap>
      <div className="flex flex-col items-center gap-4">
        <span className="ole-eyebrow-poster">Preparando capítulo I</span>
        <div className="font-impact uppercase text-giz" style={{ fontSize: 'clamp(28px, 6vw, 40px)', lineHeight: 1.1 }}>
          A imprensa está rodando…
        </div>
      </div>
    </StageWrap>
  );
}

export function ErrorChapter(props: { onRetry: () => void }) {
  return (
    <StageWrap>
      <div className="flex flex-col items-center gap-5 text-center">
        <ChapterLabel>Atraso na edição</ChapterLabel>
        <div className="font-sans text-giz" style={{ fontSize: 'clamp(17px, 3vw, 22px)', lineHeight: 1.4, maxWidth: 520 }}>
          Não conseguimos imprimir o capítulo. Verifique sua conexão e tente
          novamente em instantes.
        </div>
        <NextButton onClick={props.onRetry}>Tentar de novo</NextButton>
      </div>
    </StageWrap>
  );
}


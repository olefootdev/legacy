import { useEffect, useState, type CSSProperties } from 'react';
import type { OnboardingPackage } from './buildOnboardingPackage';
import type { RarityTier } from './draftStarterSquad';
import { STARTER_EXP_TIERS } from './rollStarterExp';
import { DAILY_REWARDS_7D, type DailyReward } from './dailyBonus';

/**
 * Cerimônia de onboarding — capítulos editoriais.
 *
 * Tom visual: tudo é uma página de revista esportiva sendo impressa em tempo
 * real. Tipografia massiva (font-serif-hero, font-display), pretos profundos,
 * neon-yellow como acento. Sem áudio. Cada capítulo respira.
 */

const TIER_LABEL: Record<RarityTier, string> = {
  basic: 'Básico',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Lendário',
};

const TIER_ACCENT: Record<RarityTier, string> = {
  basic: '#9CA3AF',
  rare: '#60A5FA',
  epic: '#FACC15',
  legendary: '#FDE100',
};

function ChapterLabel({ children }: { children: string }) {
  return (
    <div
      className="font-display uppercase text-neon-yellow"
      style={{ fontSize: '11px', letterSpacing: '0.4em' }}
    >
      {children}
    </div>
  );
}

function NextButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-neon-yellow text-black font-display font-bold uppercase tracking-wider px-10 py-4 -skew-x-6 hover:bg-white transition-all"
      style={{ fontSize: '18px', letterSpacing: '0.18em' }}
    >
      <span className="inline-block skew-x-6">{children}</span>
    </button>
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

        <div
          className="relative inline-flex items-center justify-center bg-neon-yellow text-black -skew-x-6"
          style={{ width: 168, height: 168 }}
        >
          <span
            className="font-display font-black skew-x-6"
            style={{ fontSize: 72, letterSpacing: '0.04em' }}
          >
            {props.clubInitials}
          </span>
        </div>

        <h1
          className="font-serif-hero text-white"
          style={{
            fontStyle: 'italic',
            fontSize: 'clamp(40px, 7vw, 80px)',
            lineHeight: 0.95,
            letterSpacing: '-0.01em',
          }}
        >
          Hoje começa a história
          <br />
          do{' '}
          <span className="text-neon-yellow">{props.clubName}</span>.
        </h1>

        <p
          className="font-sans text-white/70 max-w-[640px]"
          style={{ fontSize: 17, lineHeight: 1.55 }}
        >
          Cada decisão sua será impressa nesta página. Comece pelo cofre,
          monte o plantel e leve seu nome ao próximo capítulo.
        </p>

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

        <h2
          className="font-serif-hero text-white"
          style={{
            fontStyle: 'italic',
            fontSize: 'clamp(34px, 5.5vw, 56px)',
            lineHeight: 1.0,
          }}
        >
          O capital inicial<br />que vai mover o clube.
        </h2>

        <div className="w-full max-w-[420px] flex flex-col gap-2">
          {STARTER_EXP_TIERS.map((t, i) => {
            const isActive = phase === 'spin' ? i === activeIdx : t.id === targetTier.id;
            const isWinner = phase === 'reveal' && t.id === targetTier.id;
            return (
              <div
                key={t.id}
                className="-skew-x-6 px-6 py-3 flex items-center justify-between transition-all"
                style={{
                  background: isWinner
                    ? 'var(--color-neon-yellow)'
                    : isActive
                      ? 'rgba(253,225,0,0.18)'
                      : 'rgba(255,255,255,0.04)',
                  color: isWinner ? '#000' : 'rgba(255,255,255,0.85)',
                  border: isWinner
                    ? '2px solid var(--color-neon-yellow)'
                    : '1px solid rgba(255,255,255,0.06)',
                  transform: `skewX(-6deg)${isWinner ? ' scale(1.04)' : ''}`,
                }}
              >
                <span
                  className="font-display uppercase skew-x-6"
                  style={{ fontSize: 14, letterSpacing: '0.2em' }}
                >
                  {t.id}
                </span>
                <span
                  className="font-display font-black skew-x-6"
                  style={{ fontSize: 24 }}
                >
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
            <div
              className="font-serif-hero italic text-white"
              style={{ fontSize: 22 }}
            >
              o cofre revelou
            </div>
            <div
              className="font-display font-black text-neon-yellow"
              style={{
                fontSize: 'clamp(80px, 14vw, 160px)',
                lineHeight: 0.9,
                letterSpacing: '-0.02em',
              }}
            >
              {targetTier.label}
            </div>
            <div
              className="font-display uppercase text-white/60"
              style={{ fontSize: 13, letterSpacing: '0.35em' }}
            >
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
  const cards = props.pkg.revealOrder; // basic → legendary
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
    <StageWrap>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <ChapterLabel>Capítulo II · 25 Pioneiros</ChapterLabel>
          <div
            className="font-display text-white/70"
            style={{ fontSize: 13, letterSpacing: '0.25em' }}
          >
            {revealedCount} / {cards.length}
          </div>
        </div>

        <h2
          className="font-serif-hero text-white"
          style={{
            fontStyle: 'italic',
            fontSize: 'clamp(28px, 4.5vw, 44px)',
            lineHeight: 1.05,
          }}
        >
          Os primeiros nomes a vestir as cores do clube.
        </h2>

        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {cards.map((c, i) => {
            const visible = i < revealedCount;
            return (
              <div
                key={c.id}
                className="relative -skew-x-6 overflow-hidden"
                style={{
                  aspectRatio: '3 / 4',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  opacity: visible ? 1 : 0.18,
                  transform: visible ? 'skewX(-6deg)' : 'skewX(-6deg) translateY(8px)',
                  transition: 'opacity 320ms ease, transform 320ms ease',
                }}
              >
                {visible && (
                  <div
                    className="absolute inset-0 flex flex-col justify-end p-2 skew-x-6"
                    style={{
                      background: `linear-gradient(180deg, ${TIER_ACCENT[c.tier]}22 0%, rgba(0,0,0,0.85) 70%)`,
                    }}
                  >
                    {c.portraitUrl ? (
                      <img
                        src={c.portraitUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                        style={{ opacity: 0.65 }}
                      />
                    ) : null}
                    <div className="relative z-10 flex flex-col gap-0.5">
                      <div
                        className="font-display uppercase"
                        style={{
                          color: TIER_ACCENT[c.tier],
                          fontSize: 9,
                          letterSpacing: '0.2em',
                        }}
                      >
                        {c.pos}
                      </div>
                      <div
                        className="font-display font-bold text-white truncate"
                        style={{ fontSize: 12, lineHeight: 1.05 }}
                      >
                        {c.name.split(' ').slice(-1)[0]}
                      </div>
                      <div
                        className="font-display font-black text-neon-yellow"
                        style={{ fontSize: 18, lineHeight: 1 }}
                      >
                        {c.ovr}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <NextButton onClick={props.onNext}>
            {done ? 'Conhecer os astros' : 'Aguarde…'}
          </NextButton>
        </div>
      </div>
    </StageWrap>
  );
}

/* ───────────────────── Capítulo: Top 3 (capa) ───────────────────── */
export function Top3Chapter(props: {
  top3: OnboardingPackage['top3'];
  onNext: () => void;
}) {
  // Stage 0: nada revelado. 1: card #1 visível. 2: cards #1+#2 visíveis. 3: todos visíveis (CTA aparece).
  const [stage, setStage] = useState(0);

  // Auto-revelar card #1 e #2 (com respiro). Card #3 só com tap do usuário.
  useEffect(() => {
    if (stage >= 2) return;
    const delay = stage === 0 ? 600 : 900;
    const t = window.setTimeout(() => setStage((s) => Math.min(2, s + 1)), delay);
    return () => window.clearTimeout(t);
  }, [stage]);

  const handleScreenTap = () => {
    if (stage === 2) setStage(3); // tap libera o terceiro card
  };

  return (
    <StageWrap>
      <div
        className="flex flex-col gap-6"
        onClick={handleScreenTap}
        style={stage === 2 ? { cursor: 'pointer' } : undefined}
      >
        <ChapterLabel>Capítulo III · Os Astros</ChapterLabel>

        <h2
          className="font-serif-hero text-white"
          style={{
            fontStyle: 'italic',
            fontSize: 'clamp(36px, 6vw, 72px)',
            lineHeight: 0.95,
          }}
        >
          E entre eles,<br />
          <span className="text-neon-yellow">três nomes</span> brilharam mais alto.
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
          {props.top3.map((p, i) => {
            const visible = stage > i;
            return (
              <article
                key={p.id}
                className="relative overflow-hidden -skew-x-6"
                style={{
                  aspectRatio: '3 / 4.5',
                  background: 'linear-gradient(180deg, #1A1A1A 0%, #0D0D0D 100%)',
                  border: `2px solid ${TIER_ACCENT[p.tier]}`,
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'skewX(-6deg) translateY(0)' : 'skewX(-6deg) translateY(20px)',
                  transition: 'opacity 500ms ease, transform 500ms ease',
                }}
              >
                <div className="absolute inset-0 skew-x-6">
                  {p.portraitUrl && (
                    <img
                      src={p.portraitUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ opacity: 0.9 }}
                    />
                  )}
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(180deg, transparent 35%, rgba(0,0,0,0.9) 90%)',
                    }}
                  />
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <div
                      className="font-display uppercase px-2 py-0.5 -skew-x-6"
                      style={{
                        background: TIER_ACCENT[p.tier],
                        color: '#000',
                        fontSize: 10,
                        letterSpacing: '0.22em',
                      }}
                    >
                      <span className="inline-block skew-x-6">{TIER_LABEL[p.tier]}</span>
                    </div>
                    <div
                      className="font-display font-black text-white/90"
                      style={{ fontSize: 14, letterSpacing: '0.18em' }}
                    >
                      #{i + 1}
                    </div>
                  </div>
                  <div className="absolute left-3 right-3 bottom-3 flex flex-col gap-1">
                    <div
                      className="font-display uppercase text-neon-yellow"
                      style={{ fontSize: 11, letterSpacing: '0.3em' }}
                    >
                      {p.pos}
                    </div>
                    <div
                      className="font-serif-hero text-white"
                      style={{
                        fontStyle: 'italic',
                        fontSize: 'clamp(20px, 3vw, 28px)',
                        lineHeight: 1,
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      className="font-display font-black text-neon-yellow"
                      style={{ fontSize: 56, lineHeight: 1, letterSpacing: '-0.02em' }}
                    >
                      {p.ovr}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {stage === 2 && (
          <div
            className="flex justify-center"
            style={{ animation: 'olefoot-fade-up 400ms both' }}
          >
            <span
              className="font-display uppercase text-neon-yellow/80"
              style={{ fontSize: 11, letterSpacing: '0.4em' }}
            >
              Toque para revelar o último
            </span>
          </div>
        )}

        {stage > 2 && (
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
      : '1px solid rgba(255,255,255,0.06)',
    color: isToday && claimed ? '#000' : 'rgba(255,255,255,0.92)',
  });

  return (
    <StageWrap>
      <div className="flex flex-col gap-6">
        <ChapterLabel>Capítulo IV · Rotina dos Campeões</ChapterLabel>

        <h2
          className="font-serif-hero text-white"
          style={{
            fontStyle: 'italic',
            fontSize: 'clamp(32px, 5vw, 56px)',
            lineHeight: 1.0,
          }}
        >
          Volte todo dia.<br />
          <span className="text-neon-yellow">A casa retribui.</span>
        </h2>

        <p
          className="font-sans text-white/70 max-w-[640px]"
          style={{ fontSize: 16, lineHeight: 1.55 }}
        >
          Sete capítulos em loop. Falte mais de 48h e a sequência reinicia. Hoje
          você abre o primeiro selo.
        </p>

        <div className="grid grid-cols-7 gap-2">
          {DAILY_REWARDS_7D.map((r) => {
            const isToday = r.day === 1;
            return (
              <div
                key={r.day}
                className="-skew-x-6 px-2 py-3 flex flex-col items-center text-center gap-1 transition-all"
                style={dayCardStyle(r, isToday)}
              >
                <div className="skew-x-6 flex flex-col items-center gap-1">
                  <span
                    className="font-display uppercase"
                    style={{ fontSize: 9, letterSpacing: '0.25em', opacity: 0.7 }}
                  >
                    Dia
                  </span>
                  <span
                    className="font-display font-black"
                    style={{ fontSize: 28, lineHeight: 1 }}
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
export function OutroChapter(props: { clubName: string; onFinish: () => void }) {
  return (
    <StageWrap>
      <div className="flex flex-col items-center text-center gap-8">
        <ChapterLabel>Fim do Prólogo</ChapterLabel>
        <h1
          className="font-serif-hero text-white"
          style={{
            fontStyle: 'italic',
            fontSize: 'clamp(48px, 9vw, 112px)',
            lineHeight: 0.9,
            letterSpacing: '-0.01em',
          }}
        >
          A história
          <br />
          <span className="text-neon-yellow">começou.</span>
        </h1>
        <p
          className="font-sans text-white/70 max-w-[560px]"
          style={{ fontSize: 17, lineHeight: 1.5 }}
        >
          O elenco está formado, o cofre está cheio. Bem-vindo ao Olefoot,
          treinador do <span className="text-white">{props.clubName}</span>.
        </p>
        <NextButton onClick={props.onFinish}>Entrar no clube</NextButton>
      </div>
    </StageWrap>
  );
}

/* ───────────────────── Loading + Erro ───────────────────── */
export function LoadingChapter() {
  return (
    <StageWrap>
      <div className="flex flex-col items-center gap-4">
        <div
          className="font-display uppercase text-neon-yellow"
          style={{ fontSize: 11, letterSpacing: '0.4em' }}
        >
          Preparando capítulo I
        </div>
        <div
          className="font-serif-hero italic text-white/80"
          style={{ fontSize: 'clamp(28px, 4vw, 40px)' }}
        >
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
        <div
          className="font-serif-hero italic text-white"
          style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', lineHeight: 1.15, maxWidth: 520 }}
        >
          Não conseguimos imprimir o capítulo. Verifique sua conexão e tente
          novamente em instantes.
        </div>
        <NextButton onClick={props.onRetry}>Tentar de novo</NextButton>
      </div>
    </StageWrap>
  );
}


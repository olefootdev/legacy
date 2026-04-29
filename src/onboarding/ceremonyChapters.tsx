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
      className="group flex w-full overflow-hidden border bg-dark-gray"
      style={{
        borderColor: accent,
        borderLeftWidth: 3,
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div
        className="relative flex-shrink-0 overflow-hidden bg-black border-r border-white/8"
        style={{
          width: isHero ? 'clamp(112px, 24%, 176px)' : 96,
        }}
      >
        <div
          className="absolute inset-0"
          style={{ background: `${accent}1A` }}
          aria-hidden
        />
        {player.portraitUrl ? (
          <img
            src={player.portraitUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-top grayscale transition-all duration-500 group-hover:grayscale-0"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        ) : null}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/65 via-black/15 to-transparent"
        />
        <div className="absolute top-2 left-2 md:top-3 md:left-3 z-10">
          <p
            className="italic text-neon-yellow tabular-nums leading-none drop-shadow-[0_3px_10px_rgba(0,0,0,0.95)]"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontWeight: 700,
              fontSize: isHero ? 'clamp(36px, 5.5vw, 56px)' : 30,
              letterSpacing: '-0.04em',
            }}
          >
            {player.ovr}
          </p>
          <p className="mt-0.5 font-display text-[10px] font-bold uppercase tracking-[0.18em] text-white/85 drop-shadow-md">
            {player.pos}
          </p>
        </div>
        {rank ? (
          <span
            className="absolute bottom-2 left-2 z-10 inline-flex items-center bg-neon-yellow text-black px-2 py-0.5 font-display text-[9px] font-black uppercase tracking-[0.2em] shadow-[0_0_14px_rgba(234,255,0,0.5)]"
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            #{rank}
          </span>
        ) : null}
      </div>

      <div className={`flex min-w-0 flex-1 flex-col gap-2 ${isHero ? 'px-4 py-4' : 'px-3 py-2.5'}`}>
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <p
              className="text-white uppercase truncate"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: isHero ? 'clamp(16px, 2.2vw, 22px)' : 14,
                letterSpacing: '0.03em',
                lineHeight: 1.05,
              }}
            >
              {player.name}
            </p>
            <p
              className="text-white/55 uppercase mt-0.5 truncate"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: isHero ? '10px' : '9px',
                letterSpacing: '0.22em',
                fontWeight: 600,
              }}
            >
              {player.pos} · OVR {player.ovr}
            </p>
          </div>
          <span
            className="shrink-0 inline-flex items-center border px-2 py-0.5 font-display text-[9px] font-black uppercase tracking-[0.18em]"
            style={{
              borderColor: accent,
              color: accent,
              background: 'rgba(0,0,0,0.7)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {TIER_LABEL[player.tier]}
          </span>
        </div>

        {isHero ? (
          <div className="mt-auto pt-2 border-t border-[var(--color-divider-yellow)]">
            <span
              className="italic tabular-nums leading-tight text-neon-yellow"
              style={{
                fontFamily: 'var(--font-serif-hero)',
                fontWeight: 700,
                fontSize: 'clamp(18px, 2.4vw, 24px)',
              }}
            >
              {TIER_LABEL[player.tier]}
            </span>
            <span
              className="ml-2 font-display text-[9px] font-bold uppercase tracking-[0.22em] text-white/50"
            >
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

        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {cards.map((c, i) => {
            const visible = i < revealedCount;
            return (
              <div
                key={c.id}
                className="relative overflow-hidden"
                style={{
                  aspectRatio: '5 / 6',
                  background: '#0D0D0D',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6,
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(8px)',
                  transition: 'opacity 320ms ease, transform 320ms ease',
                }}
              >
                {/* Barra dourada vertical à esquerda — assinatura do brandbook */}
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
                    className="absolute inset-0 w-full h-full object-cover grayscale"
                    style={{ opacity: 0.42 }}
                  />
                ) : null}
                {/* Vinheta para legibilidade do texto */}
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
                  className="absolute top-2 left-3 z-10 italic text-neon-yellow tabular-nums leading-none"
                  style={{
                    fontFamily: 'var(--font-serif-hero)',
                    fontWeight: 700,
                    fontSize: 'clamp(32px, 5vw, 52px)',
                    letterSpacing: '-0.03em',
                    textShadow: '0 2px 8px rgba(0,0,0,0.85)',
                  }}
                >
                  {c.ovr}
                </div>
                {/* Nome + POS — base direita */}
                <div className="absolute bottom-2 right-3 z-10 flex flex-col items-end leading-tight">
                  <div
                    className="font-display uppercase text-white truncate max-w-full"
                    style={{
                      fontSize: 12,
                      letterSpacing: '0.14em',
                      fontWeight: 700,
                      textShadow: '0 1px 4px rgba(0,0,0,0.85)',
                    }}
                  >
                    {c.name}
                  </div>
                  <div
                    className="font-display uppercase text-neon-yellow"
                    style={{
                      fontSize: 9,
                      letterSpacing: '0.32em',
                      fontWeight: 700,
                      marginTop: -1,
                    }}
                  >
                    {c.pos}
                  </div>
                </div>
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
          <div
            className="font-display text-white/70"
            style={{ fontSize: 13, letterSpacing: '0.25em' }}
          >
            {revealed} / {total}
          </div>
        </div>

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
            className="font-display uppercase text-neon-yellow text-center pt-2"
            style={{ fontSize: 12, letterSpacing: '0.32em', animation: 'olefoot-fade-up 400ms both' }}
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


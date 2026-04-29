import { useState } from 'react';
import {
  IntroChapter,
  ExpRouletteChapter,
  SquadDraftChapter,
  Top3Chapter,
  DailyBonusChapter,
  OutroChapter,
} from '@/onboarding/ceremonyChapters';
import type { OnboardingPackage } from '@/onboarding/buildOnboardingPackage';
import type { RarityTier } from '@/onboarding/draftStarterSquad';

/**
 * Sandbox da cerimônia de onboarding — `/dev/ceremony-preview`.
 *
 * Não toca nada do estado real (não chama buildOnboardingPackage,
 * não dispatcha nada). Mock package estático para navegar pelos capítulos
 * e validar visual + interações (especialmente Top3 com tap-to-reveal).
 */

const POSITIONS = ['GOL', 'ZAG', 'LAT', 'VOL', 'MEI', 'CAM', 'PE', 'PD', 'ATA'];
const SAMPLE_NAMES = [
  'Pelé Júnior', 'Garrincha II', 'Zico Filho', 'Sócrates', 'Romário',
  'Bebeto', 'Ronaldo', 'Rivaldo', 'Ronaldinho', 'Kaká',
  'Adriano', 'Luís Fabiano', 'Robinho', 'Pato', 'Neymar',
  'Coutinho', 'Firmino', 'Jesus', 'Vinícius', 'Rodrygo',
  'Endrick', 'Estêvão', 'Garcia', 'Martinelli', 'Antony',
];

function makeMockPackage(): OnboardingPackage {
  const revealOrder = SAMPLE_NAMES.map((name, i) => {
    let tier: RarityTier = 'basic';
    if (i >= 22) tier = 'legendary';
    else if (i >= 18) tier = 'epic';
    else if (i >= 12) tier = 'rare';
    const ovr = tier === 'legendary' ? 88 + (i - 22) : tier === 'epic' ? 80 + (i - 18) : tier === 'rare' ? 72 + (i - 12) : 60 + (i % 12);
    return {
      id: `mock-${i}`,
      name,
      pos: POSITIONS[i % POSITIONS.length]!,
      tier,
      ovr,
      portraitUrl: `https://picsum.photos/seed/onboarding-${i}/300/400`,
    };
  });
  // Sort: legendary > epic > rare > basic
  const tierWeight: Record<RarityTier, number> = { legendary: 0, epic: 1, rare: 2, basic: 3 };
  const sorted = [...revealOrder].sort(
    (a, b) => tierWeight[a.tier] - tierWeight[b.tier] || b.ovr - a.ovr,
  );
  const top3 = sorted.slice(0, 3);

  return {
    revealOrder: sorted,
    top3,
    expTier: { id: 'great', amount: 1_500_000, weight: 15, label: '1.5M' },
    players: {},
    lineup: {},
    squadSize: 25,
    usedFallback: false,
  };
}

type Phase = 'intro' | 'exp' | 'squad' | 'top3' | 'daily' | 'outro';

const PHASE_ORDER: Phase[] = ['intro', 'exp', 'squad', 'top3', 'daily', 'outro'];

export function CeremonyPreview() {
  const [pkg] = useState(() => makeMockPackage());
  const [phase, setPhase] = useState<Phase>('intro');

  const next = () => {
    const idx = PHASE_ORDER.indexOf(phase);
    setPhase(idx >= 0 && idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1]! : 'intro');
  };

  const jump = (p: Phase) => setPhase(p);

  return (
    <div
      className="fixed inset-0 z-[90] overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at top, #1A1A1A 0%, #0D0D0D 70%, #000000 100%)',
      }}
    >
      {/* Devbar — não bloqueia interação dos capítulos */}
      <div
        className="absolute top-3 left-3 z-[95] flex flex-wrap gap-1.5 px-3 py-2 border border-white/15 bg-black/80"
        style={{ borderRadius: 6 }}
      >
        <span
          className="font-display uppercase text-neon-yellow self-center"
          style={{ fontSize: 9, letterSpacing: '0.3em' }}
        >
          DEV ·
        </span>
        {PHASE_ORDER.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => jump(p)}
            className="font-display uppercase tracking-wider px-2 py-1 transition-all"
            style={{
              background: phase === p ? 'var(--color-neon-yellow)' : 'rgba(255,255,255,0.06)',
              color: phase === p ? '#000' : 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.12)',
              fontSize: 10,
              letterSpacing: '0.18em',
              borderRadius: 4,
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {phase === 'intro' && (
        <IntroChapter clubName="Olefoot FC" clubInitials="OF" onNext={next} />
      )}
      {phase === 'exp' && (
        <ExpRouletteChapter expTierId={pkg.expTier.id} onNext={next} />
      )}
      {phase === 'squad' && <SquadDraftChapter pkg={pkg} onNext={next} />}
      {phase === 'top3' && <Top3Chapter top3={pkg.top3} onNext={next} />}
      {phase === 'daily' && (
        <DailyBonusChapter onClaim={() => {}} onNext={next} />
      )}
      {phase === 'outro' && (
        <OutroChapter managerName="João" onFinish={() => setPhase('intro')} />
      )}
    </div>
  );
}

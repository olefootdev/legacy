import { useCallback, useEffect, useRef, useState } from 'react';
import { dispatchGame, getGameState, useGameStore } from '@/game/store';
import { isSupabaseConfigured } from '@/supabase/client';
import { makeInboxItem } from '@/game/inboxItem';
import { WELCOME_GENESIS_PACK_VERSION } from '@/game/welcomeGenesisPack';
import { buildOnboardingPackage, type OnboardingPackage } from './buildOnboardingPackage';
import {
  IntroChapter,
  ExpRouletteChapter,
  SquadDraftChapter,
  Top3Chapter,
  DailyBonusChapter,
  OutroChapter,
  LoadingChapter,
  ErrorChapter,
} from './ceremonyChapters';

/**
 * Cerimônia editorial de onboarding.
 *
 * Substitui o `WelcomeGenesisPackHydrate` silencioso. Disparada quando o
 * manager tem perfil mas plantel vazio + welcomeGenesisPackVersion < target.
 *
 * UX rules:
 *   - Não tem skip livre. Botão X abre modal de confirmação ("você ficará sem
 *     time"). Sair confirma com `welcomeGenesisPackVersion = bypass marker`?
 *     Não — só fecha. Pack continua pendente; pode rodar de novo na próxima
 *     sessão. Se ele insiste, o admin resolve.
 *   - O `GRANT_ONBOARDING_PACKAGE` só é dispatched no botão "Entrar no clube"
 *     (final). Antes disso, o package fica em memória — se o cara fechar o
 *     navegador, perde os sorteios e roda de novo.
 *   - O `CLAIM_DAILY_BONUS` é dispatched quando o manager bate "Reivindicar
 *     dia 1" no capítulo IV.
 */

type Phase =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'intro'; pkg: OnboardingPackage }
  | { kind: 'exp'; pkg: OnboardingPackage }
  | { kind: 'squad'; pkg: OnboardingPackage }
  | { kind: 'top3'; pkg: OnboardingPackage }
  | { kind: 'daily'; pkg: OnboardingPackage }
  | { kind: 'outro'; pkg: OnboardingPackage };

function ExitConfirmModal(props: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.85)' }}
    >
      <div
        className="w-full max-w-[440px] sports-panel p-7 flex flex-col gap-5"
        style={{ background: '#0D0D0D', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        <div
          className="font-display uppercase text-neon-yellow"
          style={{ fontSize: 11, letterSpacing: '0.35em' }}
        >
          Aviso · Antes de sair
        </div>
        <h3
          className="font-serif-hero italic text-white"
          style={{ fontSize: 28, lineHeight: 1.05 }}
        >
          Você não vai ter jogadores nem EXP inicial pra começar. Tudo bem?
        </h3>
        <p className="text-white/70" style={{ fontSize: 14, lineHeight: 1.55 }}>
          Se sair agora, o sorteio será descartado. Ele rodará de novo na
          próxima vez que você abrir o app.
        </p>
        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={props.onCancel}
            className="bg-dark-gray text-white border border-white/20 font-display font-bold uppercase tracking-wider px-5 py-2 -skew-x-6 hover:bg-white/10 transition-all"
            style={{ fontSize: 13, letterSpacing: '0.18em' }}
          >
            <span className="inline-block skew-x-6">Não, continuar</span>
          </button>
          <button
            type="button"
            onClick={props.onConfirm}
            className="bg-white/10 text-white border border-white/30 font-display font-bold uppercase tracking-wider px-5 py-2 -skew-x-6 hover:bg-white/20 transition-all"
            style={{ fontSize: 13, letterSpacing: '0.18em' }}
          >
            <span className="inline-block skew-x-6">Sim, sair</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseButton(props: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label="Fechar cerimônia"
      className="absolute top-4 right-4 z-[105] w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
      style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function deriveInitials(clubName: string): string {
  const parts = clubName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'OF';
  if (parts.length === 1) return parts[0]!.slice(0, 3).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function OnboardingCeremony() {
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const welcomePackVersion = useGameStore(
    (s) => s.userSettings?.welcomeGenesisPackVersion ?? 0,
  );
  const playersCount = useGameStore((s) => Object.keys(s.players ?? {}).length);
  const clubName = useGameStore((s) => s.club?.name ?? 'Olefoot FC');
  const clubInitials = deriveInitials(clubName);

  const startedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [askingExit, setAskingExit] = useState(false);
  const [active, setActive] = useState(false);

  // Detecta condição de gatilho. Roda só uma vez por sessão.
  useEffect(() => {
    if (startedRef.current) return;
    if (!isSupabaseConfigured()) return;
    if (!managerProfile) return;
    if (welcomePackVersion >= WELCOME_GENESIS_PACK_VERSION) return;
    if (playersCount > 0) return;
    startedRef.current = true;
    setActive(true);
  }, [managerProfile, playersCount, welcomePackVersion]);

  const startBuild = useCallback(async () => {
    setPhase({ kind: 'loading' });
    try {
      const pkg = await buildOnboardingPackage();
      if (!pkg) {
        setPhase({ kind: 'error' });
        return;
      }
      setPhase({ kind: 'intro', pkg });
    } catch (err) {
      console.warn('[onboarding] buildPackage failed:', err);
      setPhase({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void startBuild();
  }, [active, startBuild]);

  const finish = useCallback(() => {
    if (phase.kind !== 'outro') return;
    const pkg = phase.pkg;
    dispatchGame({
      type: 'GRANT_ONBOARDING_PACKAGE',
      players: pkg.players,
      lineup: pkg.lineup,
      formationScheme: getGameState().manager.formationScheme,
      starterExpAmount: pkg.expTier.amount,
      welcomePackVersion: WELCOME_GENESIS_PACK_VERSION,
    });
    const note = makeInboxItem(
      `welcome-onboarding-${Date.now()}`,
      'SHOP_PACK',
      'PLANTEL',
      'Bem-vindo ao Olefoot',
      {
        body: `Recebeste 25 jogadores e ${pkg.expTier.amount.toLocaleString('pt-BR')} EXP iniciais. Veja o plantel em Equipe e jogue o primeiro amistoso quando quiser.`,
        deepLink: '/team',
      },
    );
    dispatchGame({ type: 'INBOX_PREPEND', item: note });
    setActive(false);
  }, [phase]);

  const claimDay1 = useCallback(() => {
    dispatchGame({ type: 'CLAIM_DAILY_BONUS', streakDay: 1, claimMs: Date.now() });
  }, []);

  if (!active) return null;

  const next = () => {
    setPhase((p) => {
      if (p.kind === 'intro') return { kind: 'exp', pkg: p.pkg };
      if (p.kind === 'exp') return { kind: 'squad', pkg: p.pkg };
      if (p.kind === 'squad') return { kind: 'top3', pkg: p.pkg };
      if (p.kind === 'top3') return { kind: 'daily', pkg: p.pkg };
      if (p.kind === 'daily') return { kind: 'outro', pkg: p.pkg };
      return p;
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at top, #1A1A1A 0%, #0D0D0D 70%, #000000 100%)',
        animation: 'olefoot-fade-in 400ms both',
      }}
    >
      <CloseButton onClick={() => setAskingExit(true)} />
      {phase.kind === 'loading' && <LoadingChapter />}
      {phase.kind === 'error' && <ErrorChapter onRetry={startBuild} />}
      {phase.kind === 'intro' && (
        <IntroChapter clubName={clubName} clubInitials={clubInitials} onNext={next} />
      )}
      {phase.kind === 'exp' && (
        <ExpRouletteChapter expTierId={phase.pkg.expTier.id} onNext={next} />
      )}
      {phase.kind === 'squad' && <SquadDraftChapter pkg={phase.pkg} onNext={next} />}
      {phase.kind === 'top3' && <Top3Chapter top3={phase.pkg.top3} onNext={next} />}
      {phase.kind === 'daily' && (
        <DailyBonusChapter onClaim={claimDay1} onNext={next} />
      )}
      {phase.kind === 'outro' && (
        <OutroChapter clubName={clubName} onFinish={finish} />
      )}
      {askingExit && (
        <ExitConfirmModal
          onCancel={() => setAskingExit(false)}
          onConfirm={() => {
            setAskingExit(false);
            setActive(false);
            startedRef.current = true; // não retentar nesta sessão
          }}
        />
      )}
    </div>
  );
}

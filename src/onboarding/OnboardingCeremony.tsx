import { useCallback, useEffect, useRef, useState } from 'react';
import { dispatchGame, getGameState, useGameStore, useSquadHydrationDone } from '@/game/store';
import { isSupabaseConfigured } from '@/supabase/client';
import { makeInboxItem } from '@/game/inboxItem';
import { hasServerGrant, claimWelcomePackSlot } from '@/game/welcomeGenesisPack';
import { flushAllPersistence } from '@/game/flushPersistence';
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
 * manager tem perfil mas plantel vazio + nunca completou onboarding.
 *
 * UX rules:
 *   - Não tem skip livre. Botão X abre modal de confirmação ("você ficará sem
 *     time"). Sair confirma só fecha. Pack continua pendente; pode rodar de
 *     novo na próxima sessão. Se ele insiste, o admin resolve.
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
  const hasDoneOnboarding = useGameStore((s) => s.userSettings?.hasDoneOnboarding ?? false);
  const playersCount = useGameStore((s) => Object.keys(s.players ?? {}).length);
  const clubName = useGameStore((s) => s.club?.name ?? 'Olefoot FC');
  const clubInitials = deriveInitials(clubName);
  const managerDay = useGameStore((s) => s.userSettings?.managerDay ?? 1);
  const hydrationDone = useSquadHydrationDone();

  const startedRef = useRef(false);
  const lastProfileRef = useRef<string | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [askingExit, setAskingExit] = useState(false);
  const [active, setActive] = useState(false);
  // Aguarda 1.5s após hydration antes de avaliar — garante que jogadores do Supabase chegaram
  const [hydrationSettled, setHydrationSettled] = useState(false);
  const [settleGen, setSettleGen] = useState(0);

  useEffect(() => {
    if (!hydrationDone) return;
    setHydrationSettled(false);
    const t = setTimeout(() => setHydrationSettled(true), 1500);
    return () => clearTimeout(t);
  }, [hydrationDone, settleGen]);

  // Se manager já tem jogadores E cerimônia está ativa mas não deveria, fechar.
  // Não fecha durante o startBuild (que faz o grant + persist antes de mostrar UI).
  useEffect(() => {
    if (playersCount > 0 && !hasDoneOnboarding) {
      dispatchGame({
        type: 'SET_USER_SETTINGS',
        partial: { hasDoneOnboarding: true },
      });
    }
  }, [playersCount, hasDoneOnboarding]);

  // Recovery: manager antigo que perdeu o plantel (0 players + hasDoneOnboarding=true).
  // Reseta o flag para re-disparar a cerimônia e dar novo pack.
  useEffect(() => {
    if (!hydrationSettled) return;
    if (!managerProfile) return;
    if (playersCount > 0) return;
    if (!hasDoneOnboarding) return;
    // Manager com 0 jogadores mas marcado como "já fez onboarding" → resetar
    dispatchGame({
      type: 'SET_USER_SETTINGS',
      partial: { hasDoneOnboarding: false },
    });
  }, [hydrationSettled, managerProfile, playersCount, hasDoneOnboarding]);

  // Reseta o guard quando o perfil muda (logout → login de outra conta).
  const profileId = managerProfile?.email;
  if (profileId !== lastProfileRef.current) {
    lastProfileRef.current = profileId;
    startedRef.current = false;
    setSettleGen((g) => g + 1);
  }

  // Detecta condição de gatilho. Aguarda hydration + 1.5s de settle antes de avaliar.
  // Gate único: hasDoneOnboarding (local + cross-browser) + welcome_pack_grants (Supabase).
  useEffect(() => {
    if (!hydrationSettled) return;
    if (startedRef.current) return;
    if (!isSupabaseConfigured()) return;
    if (!managerProfile) return;
    if (hasDoneOnboarding) return;
    if (playersCount > 0) return;
    startedRef.current = true;
    void (async () => {
      // Verificar novamente após async — jogadores podem ter chegado nesse intervalo
      const currentCount = Object.keys(getGameState().players ?? {}).length;
      if (currentCount > 0) {
        dispatchGame({
          type: 'SET_USER_SETTINGS',
          partial: { hasDoneOnboarding: true },
        });
        return;
      }
      // Guard server-side: se já recebeu o pack em qualquer sessão/device, não abre.
      // EXCETO se o manager tem 0 jogadores (recovery de plantel perdido).
      const alreadyGranted = await hasServerGrant();
      const currentCountAfterCheck = Object.keys(getGameState().players ?? {}).length;
      if (alreadyGranted && currentCountAfterCheck > 0) {
        dispatchGame({
          type: 'SET_USER_SETTINGS',
          partial: { hasDoneOnboarding: true },
        });
        return;
      }
      setActive(true);
    })();
  }, [hydrationSettled, managerProfile, hasDoneOnboarding, playersCount]);

  const startBuild = useCallback(async () => {
    setPhase({ kind: 'loading' });
    console.info('[OnboardingCeremony] startBuild chamado');
    try {
      const pkg = await buildOnboardingPackage();
      console.info('[OnboardingCeremony] buildOnboardingPackage resultado:', pkg ? `${Object.keys(pkg.players).length} players` : 'NULL');
      if (!pkg) {
        setPhase({ kind: 'error' });
        return;
      }
      // GRANT IMEDIATO: salva players + EXP no state e persiste no Supabase
      // ANTES de mostrar qualquer animação. Se o user fechar a cerimônia
      // em qualquer ponto, os dados já estão seguros.
      dispatchGame({
        type: 'GRANT_ONBOARDING_PACKAGE',
        players: pkg.players,
        lineup: pkg.lineup,
        formationScheme: getGameState().manager.formationScheme,
        starterExpAmount: pkg.expTier.amount,
      });
      dispatchGame({
        type: 'SET_USER_SETTINGS',
        partial: { hasDoneOnboarding: true },
      });
      console.info('[OnboardingCeremony] grant imediato: players=', Object.keys(pkg.players).length, 'exp=', pkg.expTier.amount);
      void claimWelcomePackSlot();
      // Persist imediato — não depende do user clicar "Acessar painel"
      await flushAllPersistence();
      console.info('[OnboardingCeremony] persist imediato concluído');
      // Dia 2+: skip animações, vai direto para o grant
      if (managerDay > 1) {
        setPhase({ kind: 'outro', pkg });
      } else {
        setPhase({ kind: 'intro', pkg });
      }
    } catch (err) {
      console.warn('[onboarding] buildPackage failed:', err);
      setPhase({ kind: 'error' });
    }
  }, [managerDay]);

  useEffect(() => {
    if (!active) return;
    void startBuild();
  }, [active, startBuild]);

  const finish = useCallback(() => {
    // Grant + persist já foram feitos no startBuild. Aqui só fecha a UI.
    const pkg = phase.kind === 'outro' ? phase.pkg : null;
    if (pkg) {
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
    }
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
      {managerDay <= 1 && <CloseButton onClick={() => setAskingExit(true)} />}
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
        <OutroChapter
          managerName={managerProfile?.firstName ?? 'treinador'}
          onFinish={finish}
        />
      )}
      {askingExit && (
        <ExitConfirmModal
          onCancel={() => setAskingExit(false)}
          onConfirm={() => {
            setAskingExit(false);
            setActive(false);
            startedRef.current = true; // não retentar nesta sessão
            // Nota: se ele saiu sem pegar o pack, hasDoneOnboarding fica false
            // e cerimônia pode rodar de novo em sessão futura. Isso é proposital
            // (vai ficar sem time se não voltar). Admin pode resetar se preciso.
          }}
        />
      )}
    </div>
  );
}

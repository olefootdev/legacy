/**
 * Painel do Assistente Técnico — bottom sheet que sobe do fundo sem tapar o campo.
 * O futebol continua rolando enquanto o manager interage.
 *
 * Regras anti-sobreposição (gerenciadas em MatchQuick):
 *  - Nunca abre durante pênalti ou overlay de gol
 *  - 10s de cooldown após qualquer interação/pênalti
 *
 * Eventos:
 *  • min15_check    — Como está o jogo? Ruim → ajuste | Bom → mantém
 *  • injury_warning — Jogador específico em risco + substituto sugerido
 *  • halftime       — Intervalo: min 15s reais, APLICAR + RETOMAR PARTIDA
 *  • min70_check    — Segundo tempo: decisão tática
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type AssistantEventKind =
  | 'min15_check'
  | 'injury_warning'
  | 'halftime'
  | 'min70_check';

export interface AssistantEvent {
  kind: AssistantEventKind;
  /** Jogador em risco de lesão (injury_warning). */
  injuryOutPlayer?: { name: string; pos: string; fatigue: number; playerId: string };
  /** Substituto sugerido do banco (injury_warning). */
  suggestedSubPlayer?: { name: string; pos: string; playerId: string };
  /** Formação atual (halftime). */
  currentFormation?: string;
  /** Substituições usadas/máximo (halftime). */
  subsUsed?: number;
  subsMax?: number;
  /** Contexto da partida (min15_check, min70_check). */
  matchContext?: {
    minute: number;
    homeScore: number;
    awayScore: number;
    possession: number;
    shots: number;
    shotsAgainst: number;
  };
}

export interface AssistantPanelProps {
  key?: string | number | null;
  event: AssistantEvent;
  onDismiss: () => void;
  onApplyPreset: (presetId: string) => void;
  onFormationChange?: (formation: string) => void;
  onConfirmSub?: (outPlayerId: string, inPlayerId: string) => void;
  onOpenSubs?: () => void;
  onStartSecondHalf?: () => void;
}

// ─── Dados ──────────────────────────────────────────────────────────────────

const FORMATIONS = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '4-5-1', '5-3-2', '3-4-3'];

const STYLE_OPTIONS = [
  { id: 'PRESSAO_ALTA',     label: 'Pressão Alta',  icon: '🔥', desc: 'Agressivo, alto risco' },
  { id: 'POSSE_CONTROLADA', label: 'Posse',          icon: '🔵', desc: 'Controle, paciência' },
  { id: 'TRANSICAO_RAPIDA', label: 'Transição',      icon: '⚡', desc: 'Contra-ataque rápido' },
  { id: 'BLOCO_BAIXO',      label: 'Bloco Baixo',   icon: '🛡️', desc: 'Defesa sólida' },
  { id: 'JOGO_DIRETO',      label: 'Jogo Direto',   icon: '🎯', desc: 'Vertical, 2ª bola' },
];

type HalftimeTab = 'formacao' | 'estilo' | 'subs';

const HALFTIME_MIN_SECONDS = 15;
const AUTO_DISMISS_SECONDS = 15; // aumentado de 9 para 15 segundos

// ─── Componente principal ────────────────────────────────────────────────────

export function AssistantPanel({
  event,
  onDismiss,
  onApplyPreset,
  onFormationChange,
  onConfirmSub,
  onOpenSubs,
  onStartSecondHalf,
}: AssistantPanelProps) {
  const isHalftime = event.kind === 'halftime';

  // Para eventos normais: contagem regressiva de auto-dismiss
  // Para intervalo: contagem progressiva até liberar o botão "Retomar"
  const [seconds, setSeconds] = useState(isHalftime ? 0 : AUTO_DISMISS_SECONDS);
  const [userInteracted, setUserInteracted] = useState(false);
  const [step, setStep] = useState<'root' | 'ruim_action'>('root');
  const [htTab, setHtTab] = useState<HalftimeTab>('formacao');
  const [selectedFormation, setSelectedFormation] = useState(event.currentFormation ?? '4-3-3');
  const [pendingStyle, setPendingStyle] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const halftimeReady = isHalftime && seconds >= HALFTIME_MIN_SECONDS;

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSeconds(s => {
        if (isHalftime) return s + 1; // conta para cima
        // Eventos normais: auto-dismiss se não houve interação
        if (userInteracted) return s; // parado por interação
        if (s <= 1) {
          clearInterval(timerRef.current!);
          onDismiss();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHalftime, userInteracted]);

  function interact() {
    if (!isHalftime) setUserInteracted(true);
  }

  function handleApply() {
    if (pendingStyle) onApplyPreset(pendingStyle);
    if (selectedFormation !== event.currentFormation) onFormationChange?.(selectedFormation);
    setApplied(true);
    setTimeout(() => setApplied(false), 1500);
  }

  function handleRetomar() {
    if (!halftimeReady) return;
    onStartSecondHalf?.();
  }

  const dismissProgress = isHalftime ? 0 : (userInteracted ? 0 : seconds / AUTO_DISMISS_SECONDS);

  return (
    <motion.div
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      className="fixed bottom-16 left-2 right-2 sm:bottom-[5rem] sm:left-0 sm:right-0 z-[90] sm:px-3 md:px-4 md:bottom-4"
    >
      <div className="mx-auto max-w-lg flex flex-col overflow-hidden rounded-xl border border-neon-yellow/30 bg-deep-black shadow-[0_0_40px_rgba(253,224,71,0.2)] max-h-[min(72vh,32rem)]">

        {/* Barra de progresso — auto-dismiss para eventos normais, inativa no intervalo */}
        <div className="h-[3px] bg-black">
          {!isHalftime && !userInteracted && (
            <motion.div
              className="h-full bg-neon-yellow/60"
              style={{ width: `${dismissProgress * 100}%` }}
            />
          )}
          {isHalftime && (
            <motion.div
              className={`h-full transition-colors ${halftimeReady ? 'bg-neon-yellow' : 'bg-white/20'}`}
              style={{ width: `${Math.min(100, (seconds / HALFTIME_MIN_SECONDS) * 100)}%` }}
            />
          )}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-br from-neon-yellow/10 to-transparent px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-neon-yellow/30 bg-neon-yellow/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-neon-yellow"
              >
                <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
                <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
                <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
                <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
                <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
                <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
                <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
                <path d="M6 18a4 4 0 0 1-1.967-.516" />
                <path d="M19.967 17.484A4 4 0 0 1 18 18" />
              </svg>
            </div>
            <p className="font-display text-xs font-black uppercase tracking-widest text-white">
              {isHalftime ? 'Intervalo' : 'Assistente Técnico'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isHalftime ? (
              <span className={`text-xs font-bold tabular-nums ${halftimeReady ? 'text-neon-yellow' : 'text-white/40'}`}>
                {halftimeReady ? 'Pronto' : `${HALFTIME_MIN_SECONDS - seconds}s`}
              </span>
            ) : (
              !userInteracted && (
                <span className="text-xs font-bold tabular-nums text-white/40">{seconds}s</span>
              )
            )}
            {!isHalftime && (
              <button
                type="button"
                onClick={() => { interact(); onDismiss(); }}
                className="text-white/40 transition-colors hover:text-white text-xl leading-none"
                aria-label="Fechar"
              >×</button>
            )}
          </div>
        </div>

        {/* Corpo — scrollável internamente quando as opções/contexto
            extrapolam a altura disponível (ex.: min70 com matchContext). */}
        <div className="px-4 py-4 bg-black/40 overflow-y-auto flex-1 min-h-0">
          {event.kind === 'min15_check' && (
            <Min15Check
              step={step}
              onBom={() => { interact(); onDismiss(); }}
              onRuim={() => { interact(); setStep('ruim_action'); }}
              onApply={(id) => { interact(); onApplyPreset(id); onDismiss(); }}
              matchContext={event.matchContext}
            />
          )}

          {event.kind === 'injury_warning' && (
            <InjuryWarning
              outPlayer={event.injuryOutPlayer}
              inPlayer={event.suggestedSubPlayer}
              onNo={() => { interact(); onDismiss(); }}
              onYes={() => {
                interact();
                if (event.injuryOutPlayer && event.suggestedSubPlayer) {
                  onConfirmSub?.(event.injuryOutPlayer.playerId, event.suggestedSubPlayer.playerId);
                } else {
                  onOpenSubs?.();
                }
                onDismiss();
              }}
            />
          )}

          {event.kind === 'halftime' && (
            <HalftimePanel
              tab={htTab}
              onTab={setHtTab}
              formations={FORMATIONS}
              selected={selectedFormation}
              onFormation={setSelectedFormation}
              styleOptions={STYLE_OPTIONS}
              pendingStyle={pendingStyle}
              onStyle={setPendingStyle}
              subsUsed={event.subsUsed ?? 0}
              subsMax={event.subsMax ?? 3}
              onOpenSubs={() => { onOpenSubs?.(); }}
            />
          )}

          {event.kind === 'min70_check' && (
            <Min70Check
              onApply={(id) => { interact(); onApplyPreset(id); onDismiss(); }}
              matchContext={event.matchContext}
            />
          )}
        </div>

        {/* Footer eventos normais — CTA único "VOLTAR JOGO" pra evitar
            que o user precise caçar o × no header pra fechar o painel. */}
        {!isHalftime && (
          <div className="border-t border-white/10 bg-black/60 px-4 py-3">
            <button
              type="button"
              onClick={() => { interact(); onDismiss(); }}
              className="w-full rounded-lg border border-neon-yellow/40 bg-gradient-to-br from-neon-yellow via-neon-yellow/95 to-neon-yellow/90 py-3 font-display text-xs font-black uppercase tracking-wider text-black shadow-[0_0_18px_rgba(253,224,71,0.25)] transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              ▶ Voltar ao Jogo
            </button>
          </div>
        )}

        {/* Footer intervalo: APLICAR + RETOMAR PARTIDA */}
        {isHalftime && (
          <div className="flex gap-2 border-t border-white/10 bg-black/60 px-4 py-4">
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 rounded-lg border border-white/20 bg-black/60 py-3 font-display text-xs font-black uppercase tracking-wide text-white transition-all hover:border-neon-yellow/40 hover:bg-black/80"
            >
              {applied ? '✓ Aplicado' : 'Aplicar'}
            </button>
            <button
              type="button"
              onClick={handleRetomar}
              disabled={!halftimeReady}
              className={`flex-[2] rounded-lg py-3 font-display text-xs font-black uppercase tracking-wide transition-all ${
                halftimeReady
                  ? 'border border-neon-yellow/40 bg-gradient-to-br from-neon-yellow via-neon-yellow/95 to-neon-yellow/90 text-black shadow-[0_0_20px_rgba(253,224,71,0.3)] hover:scale-[1.02]'
                  : 'cursor-not-allowed border border-white/10 bg-black/40 text-white/40'
              }`}
            >
              {halftimeReady ? '▶ Retomar Partida' : `Aguarde ${HALFTIME_MIN_SECONDS - seconds}s…`}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Min15Check({
  step,
  onBom,
  onRuim,
  onApply,
  matchContext,
}: {
  step: 'root' | 'ruim_action';
  onBom: () => void;
  onRuim: () => void;
  onApply: (id: string) => void;
  matchContext?: AssistantEvent['matchContext'];
}) {
  const scoreDiff = (matchContext?.homeScore ?? 0) - (matchContext?.awayScore ?? 0);
  const isWinning = scoreDiff > 0;
  const isLosing = scoreDiff < 0;
  const isDraw = scoreDiff === 0;

  return (
    <AnimatePresence mode="wait">
      <motion.div key="root" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        {/* Contexto da partida */}
        {matchContext && (
          <div className="mb-4 rounded-lg border border-white/10 bg-black/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-white/50">MINUTO {matchContext.minute}'</span>
              <span className="text-lg font-black text-neon-yellow">
                {matchContext.homeScore} - {matchContext.awayScore}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="text-white/50">Posse</div>
                <div className="font-bold text-white">{matchContext.possession}%</div>
              </div>
              <div>
                <div className="text-white/50">Chutes</div>
                <div className="font-bold text-white">{matchContext.shots}</div>
              </div>
              <div>
                <div className="text-white/50">Sofridos</div>
                <div className="font-bold text-white">{matchContext.shotsAgainst}</div>
              </div>
            </div>
          </div>
        )}

        <p className="mb-4 text-sm text-white/80">Como está a performance da equipa?</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onRuim}
            className="flex flex-col items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 py-3 font-display text-xs font-black uppercase tracking-wide text-white transition-all hover:border-red-500/50 hover:bg-red-500/20"
          >
            <span className="text-xl">❌</span>
            <span>Precisa Melhorar</span>
          </button>
          <button
            type="button"
            onClick={onBom}
            className="flex flex-col items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 py-3 font-display text-xs font-black uppercase tracking-wide text-white transition-all hover:border-blue-500/50 hover:bg-blue-500/20"
          >
            <span className="text-xl">✓</span>
            <span>Satisfatório</span>
          </button>
          <button
            type="button"
            onClick={() => {
              // Bônus de moral
              onApply('MORAL_BOOST');
            }}
            className="flex flex-col items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 py-3 font-display text-xs font-black uppercase tracking-wide text-white transition-all hover:border-green-500/50 hover:bg-green-500/20"
          >
            <span className="text-xl">⚡</span>
            <span>Excelente</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function InjuryWarning({
  outPlayer,
  inPlayer,
  onNo,
  onYes,
}: {
  outPlayer?: AssistantEvent['injuryOutPlayer'];
  inPlayer?: AssistantEvent['suggestedSubPlayer'];
  onNo: () => void;
  onYes: () => void;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-400 mb-3">Jogador com risco de lesão detectado</p>

      {/* Troca visual: sai → entra */}
      <div className="flex items-center gap-3 mb-4">
        {/* Sai */}
        <div className="flex-1 bg-red-950/60 border border-red-800/50 rounded-xl px-3 py-2.5">
          <p className="text-[9px] text-red-400 font-bold uppercase tracking-wider mb-1">Sai</p>
          <p className="text-sm font-bold text-white truncate">{outPlayer?.name ?? '—'}</p>
          <p className="text-[10px] text-zinc-500">{outPlayer?.pos}</p>
          {outPlayer && (
            <div className="mt-1.5">
              <p className="text-[9px] text-zinc-500 mb-0.5">FADIGA</p>
              <div className="flex items-center gap-1">
                <div className="flex-1 h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, outPlayer.fatigue)}%`,
                      backgroundColor: outPlayer.fatigue >= 85 ? '#ef4444' : outPlayer.fatigue >= 70 ? '#f97316' : '#eab308',
                    }}
                  />
                </div>
                <span className="text-[9px] text-orange-400 tabular-nums font-bold">{Math.round(outPlayer.fatigue)}%</span>
              </div>
            </div>
          )}
        </div>

        <span className="text-zinc-600 text-lg">⇄</span>

        {/* Entra */}
        <div className="flex-1 bg-emerald-950/60 border border-emerald-800/50 rounded-xl px-3 py-2.5">
          <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider mb-1">Entra</p>
          <p className="text-sm font-bold text-white truncate">{inPlayer?.name ?? '—'}</p>
          <p className="text-[10px] text-zinc-500">{inPlayer?.pos}</p>
        </div>
      </div>

      <p className="text-sm text-zinc-300 mb-3 text-center">Deseja fazer a substituição?</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onNo}
          className="py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 font-bold text-sm text-zinc-300 transition-colors">
          Não
        </button>
        <button type="button" onClick={onYes}
          className="py-3 rounded-xl bg-blue-950 hover:bg-blue-900 border border-blue-700 font-bold text-sm text-white transition-colors">
          ✓ Sim
        </button>
      </div>
    </div>
  );
}

function HalftimePanel({
  tab, onTab, formations, selected, onFormation,
  styleOptions, pendingStyle, onStyle,
  subsUsed, subsMax, onOpenSubs,
}: {
  tab: HalftimeTab;
  onTab: (t: HalftimeTab) => void;
  formations: string[];
  selected: string;
  onFormation: (f: string) => void;
  styleOptions: typeof STYLE_OPTIONS;
  pendingStyle: string | null;
  onStyle: (id: string) => void;
  subsUsed: number;
  subsMax: number;
  onOpenSubs: () => void;
}) {
  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-lg bg-black/60 p-1">
        {(['formacao', 'estilo', 'subs'] as HalftimeTab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => onTab(t)}
            className={`flex-1 rounded-md py-2 text-[10px] font-display font-black uppercase tracking-wide transition-all ${
              tab === t
                ? 'bg-neon-yellow text-black'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {t === 'formacao' ? 'Formação' : t === 'estilo' ? 'Estilo' : `Subs (${subsMax - subsUsed})`}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'formacao' && (
          <motion.div key="formacao" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-3 xs:grid-cols-4 gap-2">
              {formations.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onFormation(f)}
                  className={`rounded-lg py-2.5 sm:py-3 text-[10px] xs:text-xs font-display font-black transition-all ${
                    f === selected
                      ? 'border-2 border-neon-yellow bg-neon-yellow text-black'
                      : 'border border-white/20 bg-black/60 text-white hover:border-neon-yellow/40 hover:bg-black/80'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </motion.div>
        )}
        {tab === 'estilo' && (
          <motion.div key="estilo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-2 xs:grid-cols-3 gap-2">
              {styleOptions.map(s => (
                <button
                  key={s.id + s.label}
                  type="button"
                  onClick={() => onStyle(s.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border py-2.5 sm:py-3 transition-all ${
                    pendingStyle === s.id
                      ? 'border-neon-yellow bg-neon-yellow/10 text-neon-yellow'
                      : 'border-white/20 bg-black/60 text-white hover:border-neon-yellow/40 hover:bg-black/80'
                  }`}
                >
                  <span className="text-base leading-none">{s.icon}</span>
                  <span className="text-center font-display text-[8px] xs:text-[9px] font-black uppercase leading-tight tracking-wide">{s.label}</span>
                  <span className="text-center text-[7px] xs:text-[8px] leading-tight text-white/50">{s.desc}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
        {tab === 'subs' && (
          <motion.div key="subs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="mb-4 text-xs text-white/60">
              {subsUsed} de {subsMax} substituições usadas.
            </p>
            <button
              type="button"
              onClick={onOpenSubs}
              disabled={subsUsed >= subsMax}
              className="w-full rounded-lg border border-blue-500/30 bg-blue-500/10 py-3 text-sm font-bold text-white transition-all hover:border-blue-500/50 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              🔄 Fazer Substituição
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Min70Check({ onApply, matchContext }: { onApply: (id: string) => void; matchContext?: AssistantEvent['matchContext'] }) {
  const options = [
    { id: 'PRESSAO_ALTA', label: 'Ataca Mais', icon: '⚔️', desc: '+20% gol, +60% fadiga' },
    { id: 'POSSE_CONTROLADA', label: 'Posse de Bola', icon: '🔵', desc: '+15% posse, controle' },
    { id: 'TRANSICAO_RAPIDA', label: 'Contra-ataque', icon: '⚡', desc: '+30% contra, +8% gol' },
    { id: 'BLOCO_BAIXO', label: 'Defende', icon: '🛡️', desc: '+25% defesa, -15% gol' },
  ];

  return (
    <div>
      {/* Contexto da partida */}
      {matchContext && (
        <div className="mb-4 rounded-lg border border-white/10 bg-black/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-white/50">MINUTO {matchContext.minute}'</span>
            <span className="text-lg font-black text-neon-yellow">
              {matchContext.homeScore} - {matchContext.awayScore}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <div className="text-white/50">Posse</div>
              <div className="font-bold text-white">{matchContext.possession}%</div>
            </div>
            <div>
              <div className="text-white/50">Chutes</div>
              <div className="font-bold text-white">{matchContext.shots}</div>
            </div>
            <div>
              <div className="text-white/50">Sofridos</div>
              <div className="font-bold text-white">{matchContext.shotsAgainst}</div>
            </div>
          </div>
        </div>
      )}

      <p className="mb-4 text-sm text-white/80">O que fazemos agora?</p>
      <div className="grid grid-cols-2 xs:grid-cols-4 gap-2">
        {options.map(o => (
          <button
            key={o.label}
            type="button"
            onClick={() => onApply(o.id)}
            className="flex flex-col items-center gap-2 rounded-lg border border-white/20 bg-black/60 py-2.5 sm:py-3 text-white transition-all hover:border-neon-yellow/40 hover:bg-black/80"
          >
            <span className="text-xl leading-none">{o.icon}</span>
            <span className="text-center font-display text-[8px] xs:text-[9px] font-black uppercase leading-tight tracking-wide">{o.label}</span>
            <span className="text-center text-[7px] leading-tight text-white/50">{o.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── FAB do Assistente ───────────────────────────────────────────────────────

export function AssistantFab({ hasPending, onClick }: { hasPending: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      animate={hasPending ? {
        boxShadow: [
          '0 0 0 0 rgba(253, 224, 71, 0)',
          '0 0 0 8px rgba(253, 224, 71, 0.4)',
          '0 0 0 16px rgba(253, 224, 71, 0)',
        ],
      } : {}}
      transition={hasPending ? {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      } : {}}
      className="fixed bottom-[5.5rem] right-3 z-[85] flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full border-2 bg-deep-black shadow-2xl transition-all hover:scale-110 md:bottom-6"
      style={{
        borderColor: hasPending ? 'rgb(253, 224, 71)' : 'rgba(255, 255, 255, 0.1)',
      }}
      aria-label="Assistente técnico"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-7 w-7 text-neon-yellow"
      >
        <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
        <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
        <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
        <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
        <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
        <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
        <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
        <path d="M6 18a4 4 0 0 1-1.967-.516" />
        <path d="M19.967 17.484A4 4 0 0 1 18 18" />
      </svg>
      <AnimatePresence>
        {hasPending && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute right-0 top-0 h-4 w-4 animate-pulse rounded-full border-2 border-deep-black bg-neon-yellow"
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}

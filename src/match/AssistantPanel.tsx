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
const AUTO_DISMISS_SECONDS = 9; // para eventos não-intervalo

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
      className="fixed bottom-[5rem] left-0 right-0 z-[90] px-3 sm:px-4 md:bottom-4"
    >
      <div className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950/98 shadow-[0_-8px_48px_rgba(0,0,0,0.98)]">

        {/* Barra de progresso — auto-dismiss para eventos normais, inativa no intervalo */}
        <div className="h-[3px] bg-zinc-800">
          {!isHalftime && !userInteracted && (
            <motion.div
              className="h-full bg-neon-yellow/60"
              style={{ width: `${dismissProgress * 100}%` }}
            />
          )}
          {isHalftime && (
            <motion.div
              className={`h-full transition-colors ${halftimeReady ? 'bg-neon-yellow' : 'bg-zinc-600'}`}
              style={{ width: `${Math.min(100, (seconds / HALFTIME_MIN_SECONDS) * 100)}%` }}
            />
          )}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-base">{isHalftime ? '🕐' : '🧠'}</span>
            <p className="font-display font-black text-[10px] uppercase tracking-widest text-zinc-400">
              {isHalftime ? 'Intervalo' : 'Assistente Técnico'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isHalftime ? (
              <span className={`text-[10px] tabular-nums ${halftimeReady ? 'text-neon-yellow' : 'text-zinc-600'}`}>
                {halftimeReady ? 'Pronto' : `${HALFTIME_MIN_SECONDS - seconds}s`}
              </span>
            ) : (
              !userInteracted && (
                <span className="text-[10px] text-zinc-600 tabular-nums">{seconds}s</span>
              )
            )}
            {!isHalftime && (
              <button
                type="button"
                onClick={() => { interact(); onDismiss(); }}
                className="text-zinc-600 hover:text-zinc-300 transition-colors text-lg leading-none"
                aria-label="Fechar"
              >×</button>
            )}
          </div>
        </div>

        {/* Corpo */}
        <div className="px-4 py-3">
          {event.kind === 'min15_check' && (
            <Min15Check
              step={step}
              onBom={() => { interact(); onDismiss(); }}
              onRuim={() => { interact(); setStep('ruim_action'); }}
              onApply={(id) => { interact(); onApplyPreset(id); onDismiss(); }}
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
            <Min70Check onApply={(id) => { interact(); onApplyPreset(id); onDismiss(); }} />
          )}
        </div>

        {/* Footer intervalo: APLICAR + RETOMAR PARTIDA */}
        {isHalftime && (
          <div className="px-4 pb-4 flex gap-2">
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 font-display font-black text-[11px] uppercase tracking-wide text-zinc-200 transition-colors"
            >
              {applied ? '✓ Aplicado' : 'Aplicar'}
            </button>
            <button
              type="button"
              onClick={handleRetomar}
              disabled={!halftimeReady}
              className={`flex-[2] py-3 rounded-xl font-display font-black text-[11px] uppercase tracking-wide transition-colors ${
                halftimeReady
                  ? 'bg-neon-yellow text-black hover:bg-neon-yellow/90'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700'
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
}: {
  step: 'root' | 'ruim_action';
  onBom: () => void;
  onRuim: () => void;
  onApply: (id: string) => void;
}) {
  return (
    <AnimatePresence mode="wait">
      {step === 'root' ? (
        <motion.div key="root" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <p className="text-sm text-zinc-300 mb-3">O que estás achando do jogo?</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onRuim}
              className="py-3 rounded-xl bg-red-950 hover:bg-red-900 border border-red-700 font-display font-black text-xs uppercase tracking-wide text-white transition-colors">
              😤 Ruim
            </button>
            <button type="button" onClick={onBom}
              className="py-3 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 font-display font-black text-xs uppercase tracking-wide text-white transition-colors">
              😎 Bom
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div key="ruim" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
          <p className="text-sm text-zinc-300 mb-3">O que quer mudar?</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'PRESSAO_ALTA',     label: 'Atacar Mais',     icon: '⚔️' },
              { id: 'PRESSAO_ALTA',     label: 'Pressionar',      icon: '🔥' },
              { id: 'POSSE_CONTROLADA', label: 'Melhorar Passes', icon: '🔵' },
            ].map(({ id, label, icon }) => (
              <button key={label} type="button" onClick={() => onApply(id)}
                className="flex flex-col items-center gap-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white transition-colors">
                <span className="text-lg leading-none">{icon}</span>
                <span className="font-display font-black text-[9px] uppercase tracking-wide leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
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
      <div className="flex gap-1 mb-3 bg-zinc-900 p-1 rounded-xl">
        {(['formacao', 'estilo', 'subs'] as HalftimeTab[]).map(t => (
          <button key={t} type="button" onClick={() => onTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-display font-black uppercase tracking-wide transition-colors ${
              tab === t ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}>
            {t === 'formacao' ? 'Formação' : t === 'estilo' ? 'Estilo' : `Subs (${subsMax - subsUsed})`}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'formacao' && (
          <motion.div key="formacao" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-4 gap-1.5">
              {formations.map(f => (
                <button key={f} type="button" onClick={() => onFormation(f)}
                  className={`py-2.5 rounded-xl text-[10px] font-display font-black transition-colors ${
                    f === selected
                      ? 'bg-neon-yellow text-black border border-neon-yellow'
                      : 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-200'
                  }`}>
                  {f}
                </button>
              ))}
            </div>
          </motion.div>
        )}
        {tab === 'estilo' && (
          <motion.div key="estilo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-3 gap-1.5">
              {styleOptions.map(s => (
                <button key={s.id + s.label} type="button" onClick={() => onStyle(s.id)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-colors ${
                    pendingStyle === s.id
                      ? 'bg-neon-yellow/10 border-neon-yellow/50 text-neon-yellow'
                      : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-600 text-white'
                  }`}>
                  <span className="text-base leading-none">{s.icon}</span>
                  <span className="font-display font-black text-[9px] uppercase tracking-wide leading-tight text-center">{s.label}</span>
                  <span className="text-[8px] text-zinc-500 leading-tight text-center">{s.desc}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
        {tab === 'subs' && (
          <motion.div key="subs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="text-xs text-zinc-400 mb-3">{subsUsed} de {subsMax} substituições usadas.</p>
            <button type="button" onClick={onOpenSubs} disabled={subsUsed >= subsMax}
              className="w-full py-3 rounded-xl bg-blue-950 hover:bg-blue-900 disabled:opacity-40 disabled:cursor-not-allowed border border-blue-700 text-sm font-bold text-white transition-colors">
              🔄 Fazer Substituição
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Min70Check({ onApply }: { onApply: (id: string) => void }) {
  const options = [
    { id: 'PRESSAO_ALTA',     label: 'Ataca Mais',    icon: '⚔️' },
    { id: 'POSSE_CONTROLADA', label: 'Posse de Bola', icon: '🔵' },
    { id: 'TRANSICAO_RAPIDA', label: 'Contra-ataque', icon: '⚡' },
    { id: 'BLOCO_BAIXO',      label: 'Defende',       icon: '🛡️' },
  ];
  return (
    <div>
      <p className="text-sm text-zinc-300 mb-3">O que fazemos agora?</p>
      <div className="grid grid-cols-4 gap-1.5">
        {options.map(o => (
          <button key={o.label} type="button" onClick={() => onApply(o.id)}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white transition-colors">
            <span className="text-xl leading-none">{o.icon}</span>
            <span className="font-display font-black text-[9px] uppercase tracking-wide leading-tight text-center">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── FAB do Assistente ───────────────────────────────────────────────────────

export function AssistantFab({ hasPending, onClick }: { hasPending: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="fixed bottom-[5.5rem] right-3 z-[85] w-12 h-12 rounded-full bg-zinc-900 border border-zinc-700 shadow-xl flex items-center justify-center transition-colors hover:bg-zinc-800 md:bottom-6"
      aria-label="Assistente técnico">
      <span className="text-xl leading-none">🧠</span>
      <AnimatePresence>
        {hasPending && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-neon-yellow border-2 border-zinc-900 animate-pulse" />
        )}
      </AnimatePresence>
    </button>
  );
}

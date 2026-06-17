import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Dices, Sparkles, ArrowRight, Camera, MessageCircle } from 'lucide-react';
import { useGameDispatch, useGameStore } from '@/game/store';
import { countActiveAcademyProspects, MAX_ACTIVE_ACADEMY_PROSPECTS } from '@/entities/managerProspect';
import { GACHA_POSITIONS, positionLabelPt } from '@/entities/positionLabels';
import {
  fetchAcademyDrawConfig,
  drawAcademyPlayer,
  confirmAcademyDraw,
  type DrawConfigRow,
  type DrawResult,
  type GachaRarity,
} from '@/supabase/academyDraw';
import type { PlayerAttributes } from '@/entities/types';

const CURRENT_YEAR = 2026;

/** Número do WhatsApp pra envio da foto do card (override via env). */
const WHATSAPP_PHONE =
  (import.meta.env.VITE_OLEFOOT_WHATSAPP as string | undefined)?.trim() || '5567993226559';

function buildPhotoWhatsappLink(args: {
  playerName: string;
  likePlayerName: string;
  year: number;
  rarity: string;
  overall: number;
}): string {
  const msg = [
    'Olá! Quero finalizar meu card Olefoot 🎴',
    '',
    `Jogador: ${args.playerName}`,
    `Joguei como: ${args.likePlayerName} (${args.year})`,
    `Raridade: ${args.rarity.toUpperCase()} · OVR ${args.overall}`,
    '',
    'Segue minha foto pra montarem o card 👇',
  ].join('\n');
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`;
}

const ATTR_LABELS: Array<[keyof PlayerAttributes, string]> = [
  ['velocidade', 'Velocidade'],
  ['finalizacao', 'Finalização'],
  ['drible', 'Drible'],
  ['passe', 'Passe'],
  ['marcacao', 'Marcação'],
  ['fisico', 'Físico'],
  ['tatico', 'Tático'],
  ['mentalidade', 'Mentalidade'],
  ['confianca', 'Confiança'],
  ['fairPlay', 'Fair Play'],
];

const RARITY: Record<GachaRarity, { label: string; ring: string; text: string; chip: string }> = {
  normal: { label: 'Normal', ring: 'border-white/25', text: 'text-white/70', chip: 'bg-white/10 text-white/70' },
  premium: { label: 'Premium', ring: 'border-sky-400/50', text: 'text-sky-300', chip: 'bg-sky-500/15 text-sky-300' },
  gold: { label: 'Gold', ring: 'border-amber-400/60', text: 'text-amber-300', chip: 'bg-amber-500/15 text-amber-300' },
  rare: { label: 'Rare', ring: 'border-fuchsia-400/60', text: 'text-fuchsia-300', chip: 'bg-fuchsia-500/15 text-fuchsia-300' },
  legend: { label: 'Legend', ring: 'border-neon-yellow', text: 'text-neon-yellow', chip: 'bg-neon-yellow/20 text-neon-yellow' },
};

type Step = 'setup' | 'drawing' | 'reveal' | 'done';

export function GachaCreatePlayerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useGameDispatch();
  const academyUsed = useGameStore((s) => countActiveAcademyProspects(s.players));
  const slotFull = academyUsed >= MAX_ACTIVE_ACADEMY_PROSPECTS;

  const [config, setConfig] = useState<DrawConfigRow[]>([]);
  const [name, setName] = useState('');
  const [pos, setPos] = useState<string>('ATA');
  const [year, setYear] = useState<number>(2015);
  const [step, setStep] = useState<Step>('setup');
  const [result, setResult] = useState<DrawResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('setup');
    setResult(null);
    setError(null);
    void fetchAcademyDrawConfig().then(setConfig);
  }, [open]);

  const trimmed = name.trim();
  const canDraw = trimmed.length >= 2 && GACHA_POSITIONS.includes(pos as never) && year >= 1950 && year <= CURRENT_YEAR;

  const odds = useMemo(
    () => [...config].sort((a, b) => a.sort_order - b.sort_order),
    [config],
  );

  const handleDraw = async () => {
    if (!canDraw || step === 'drawing') return;
    setError(null);
    setStep('drawing');
    const res = await drawAcademyPlayer(pos, year);
    if (res.ok && res.result) {
      setResult(res.result);
      setStep('reveal');
      return;
    }
    if (res.code === 'REFERRAL_GATE') {
      setError(
        `Precisas de ${res.required ?? 5} indicados ativos (que já jogaram) pra criar um jogador. Tens ${res.activeReferrals ?? 0}. Convida mais gente!`,
      );
    } else if (res.code === 'ALREADY_DREW') {
      setError('Já fizeste o teu sorteio — é único por manager.');
    } else {
      setError(res.error ?? 'Falha no sorteio. Tenta novamente.');
    }
    setStep('setup');
  };

  const handleConfirm = () => {
    if (!result) return;
    dispatch({
      type: 'CONFIRM_GACHA_DRAW',
      payload: {
        name: trimmed,
        pos,
        attrs: result.attributes,
        overall: result.overall,
        rarity: result.rarity,
        likePlayerName: result.playerName,
        year: result.year,
      },
    });
    void confirmAcademyDraw();
    setStep('done');
  };

  const close = () => {
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="relative mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-neon-yellow/30 bg-dark-gray shadow-lg sm:rounded-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-2">
              <Dices className="h-5 w-5 text-neon-yellow" />
              <h2 className="font-display text-lg font-black uppercase tracking-tight text-white">
                Criar jogador
              </h2>
            </div>
            <button type="button" onClick={close} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {slotFull && step === 'setup' ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-6 text-center">
                <p className="font-display text-base font-black text-white">Já tens o teu jogador</p>
                <p className="mt-2 text-sm text-white/55">
                  A criação é única: 1 jogador por manager. Esse é o teu craque.
                </p>
              </div>
            ) : null}

            {/* SETUP */}
            {!slotFull && step === 'setup' && (
              <div className="space-y-5">
                <p className="text-sm text-white/60">
                  Escolhe a posição e o <strong className="text-white">ano de atuação</strong>. O sorteio puxa um
                  craque real daquela época — do obscuro ao lendário — e aplica o <strong className="text-white">DNA
                  de atributos</strong> dele no teu jogador.
                </p>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-white/65">Nome do teu jogador</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 24))}
                    placeholder="ex. JOÃO SILVA"
                    maxLength={24}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-neon-yellow/50 focus:outline-none"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-white/65">Posição</span>
                    <select
                      value={pos}
                      onChange={(e) => setPos(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white focus:border-neon-yellow/50 focus:outline-none"
                    >
                      {GACHA_POSITIONS.map((p) => (
                        <option key={p} value={p} className="bg-dark-gray">
                          {p} — {positionLabelPt(p)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-white/65">Ano de atuação</span>
                    <input
                      type="number"
                      value={year}
                      min={1950}
                      max={CURRENT_YEAR}
                      onChange={(e) => setYear(Math.round(Number(e.target.value)))}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-neon-yellow/50 focus:outline-none"
                    />
                  </label>
                </div>

                {/* Odds */}
                {odds.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/50">
                      <Sparkles className="h-3.5 w-3.5 text-neon-yellow" /> Chances do sorteio
                    </p>
                    <div className="space-y-2">
                      {odds.map((o) => (
                        <div key={o.rarity_tier} className="flex items-center gap-3">
                          <span className={`w-20 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${RARITY[o.rarity_tier].chip}`}>
                            {RARITY[o.rarity_tier].label}
                          </span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-current opacity-70"
                              style={{ width: `${o.probability_pct}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs font-mono text-white/70">{o.probability_pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}

                <button
                  type="button"
                  onClick={handleDraw}
                  disabled={!canDraw}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-neon-yellow py-3.5 font-display text-sm font-black uppercase tracking-wide text-black transition hover:brightness-110 disabled:bg-white/10 disabled:text-white/40"
                >
                  <Dices className="h-4 w-4" /> Sortear meu craque
                </button>
                <p className="text-center text-[11px] text-white/35">Sorteio único — sem repetição.</p>
              </div>
            )}

            {/* DRAWING */}
            {step === 'drawing' && (
              <div className="flex flex-col items-center justify-center gap-4 py-16">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                >
                  <Dices className="h-14 w-14 text-neon-yellow" />
                </motion.div>
                <p className="font-display text-base font-black uppercase tracking-wide text-white">Sorteando…</p>
                <p className="text-center text-xs text-white/50">
                  Pesquisando craques de {year} na posição {positionLabelPt(pos)}.
                </p>
              </div>
            )}

            {/* REVEAL */}
            {step === 'reveal' && result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-5"
              >
                <div className={`rounded-2xl border-2 ${RARITY[result.rarity].ring} bg-black/40 p-5 text-center`}>
                  <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${RARITY[result.rarity].chip}`}>
                    {RARITY[result.rarity].label}
                  </span>
                  <p className="mt-3 text-xs uppercase tracking-wide text-white/45">Você jogou como</p>
                  <p className={`font-display text-2xl font-black ${RARITY[result.rarity].text}`}>
                    {result.playerName}
                  </p>
                  <p className="text-sm text-white/55">{result.year}</p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <span className="font-serif-hero text-4xl font-black text-white">{result.overall}</span>
                    <span className="text-xs uppercase tracking-wide text-white/40">OVR</span>
                  </div>
                  {result.bio && <p className="mt-2 text-xs italic text-white/45">{result.bio}</p>}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {ATTR_LABELS.map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between border-b border-white/5 py-1">
                      <span className="text-xs text-white/55">{label}</span>
                      <span className="font-mono text-sm font-bold text-white">{result.attributes[key]}</span>
                    </div>
                  ))}
                </div>

                {result.sources.length > 0 && (
                  <p className="text-[10px] text-white/30">
                    Atributos derivados por metodologia Olefoot de pesquisa pública ({result.sources.length} fonte
                    {result.sources.length > 1 ? 's' : ''}).
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-neon-yellow py-3.5 font-display text-sm font-black uppercase tracking-wide text-black transition hover:brightness-110"
                >
                  Confirmar e criar <ArrowRight className="h-4 w-4" />
                </button>
              </motion.div>
            )}

            {/* DONE */}
            {step === 'done' && result && (
              <div className="space-y-5 py-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neon-yellow/20">
                  <Sparkles className="h-7 w-7 text-neon-yellow" />
                </div>
                <div>
                  <p className="font-display text-lg font-black text-white">{trimmed} está no plantel!</p>
                  <p className="mt-1 text-sm text-white/55">
                    Jogou como {result.playerName} ({result.year}) · {RARITY[result.rarity].label} · OVR {result.overall}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-left">
                  <p className="flex items-center gap-2 text-sm font-bold text-white">
                    <Camera className="h-4 w-4 text-neon-yellow" /> Último passo: a tua foto
                  </p>
                  <p className="mt-1.5 text-xs text-white/55">
                    Manda uma foto tua no WhatsApp e a equipa monta o teu card oficial à mão.
                    A mensagem já vai preenchida com os dados do jogador — é só anexar a foto.
                  </p>
                </div>
                <a
                  href={buildPhotoWhatsappLink({
                    playerName: trimmed,
                    likePlayerName: result.playerName,
                    year: result.year,
                    rarity: result.rarity,
                    overall: result.overall,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3.5 font-display text-sm font-black uppercase tracking-wide text-black transition hover:brightness-110"
                >
                  <MessageCircle className="h-4 w-4" /> Enviar minha foto no WhatsApp
                </a>
                <button
                  type="button"
                  onClick={close}
                  className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

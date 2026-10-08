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
import { L, emIngles } from '@/i18n/L';
import { posLabel } from '@/components/matchquick/posLabel';
import { cn } from '@/lib/utils';
import { DEGRAU_CLASSES, MarcaRua, SeloRua, type Degrau } from '@/components/ui/Rua';
import { ovrNumeroClasses } from '@/components/clube/escada';

/** Nome por extenso da posição, só pra TELA (o valor `pos` segue em PT). */
const POS_NOME_EN: Record<string, string> = {
  GOL: 'Goalkeeper',
  ZAG: 'Centre-back',
  LE: 'Left-back',
  LD: 'Right-back',
  VOL: 'Defensive Midfielder',
  MC: 'Central Midfielder',
  MEI: 'Attacking Midfielder',
  PE: 'Left Winger',
  PD: 'Right Winger',
  ATA: 'Striker',
};
const nomePosicao = (p: string): string => L(positionLabelPt(p), POS_NOME_EN[p.toUpperCase()] ?? p);

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
    L('Olá! Quero finalizar meu card Olefoot 🎴', 'Hi! I want to finish my Olefoot card 🎴'),
    '',
    `${L('Jogador', 'Player')}: ${args.playerName}`,
    `${L('Joguei como', 'Played as')}: ${args.likePlayerName} (${args.year})`,
    `${L('Raridade', 'Rarity')}: ${args.rarity.toUpperCase()} · OVR ${args.overall}`,
    '',
    L('Segue minha foto pra montarem o card 👇', 'Here is my photo for the card 👇'),
  ].join('\n');
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`;
}

const ATTR_LABELS: Array<[keyof PlayerAttributes, string]> = [
  ['velocidade', L('Velocidade', 'Pace')],
  ['finalizacao', L('Finalização', 'Finishing')],
  ['drible', L('Drible', 'Dribbling')],
  ['passe', L('Passe', 'Passing')],
  ['marcacao', L('Marcação', 'Marking')],
  ['fisico', L('Físico', 'Physical')],
  ['tatico', L('Tático', 'Tactical')],
  ['mentalidade', L('Mentalidade', 'Mentality')],
  ['confianca', L('Confiança', 'Confidence')],
  ['fairPlay', 'Fair Play'],
];

/** Raridade do sorteio na ESCADA do DS 2027 (chão → corre → respeito → lenda). */
const RARITY: Record<GachaRarity, { label: string; degrau: Degrau }> = {
  normal: { label: 'Normal', degrau: 'chao' },
  premium: { label: 'Premium', degrau: 'corre' },
  gold: { label: 'Gold', degrau: 'respeito' },
  rare: { label: 'Rare', degrau: 'respeito' },
  legend: { label: 'Legend', degrau: 'lenda' },
};

const CAMPO = 'w-full border-2 border-linha bg-concreto px-3 py-3 font-prova text-[14px] text-papel placeholder:text-mudo focus:border-rua focus:outline-none';
const ROTULO = 'mb-1.5 block font-prova text-[10px] font-bold uppercase tracking-[0.16em] text-mudo';
const BOTAO_CORRE =
  'flex min-h-[52px] w-full items-center justify-center gap-2 bg-rua font-impact text-[20px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)]';

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
        L(
          `Você precisa de ${res.required ?? 5} indicados ativos (que já jogaram) pra criar um jogador. Você tem ${res.activeReferrals ?? 0}. Convide mais gente!`,
          `You need ${res.required ?? 5} active referrals (who have played) to create a player. You have ${res.activeReferrals ?? 0}. Invite more people!`,
        ),
      );
    } else if (res.code === 'ALREADY_DREW') {
      setError(L('Já fizeste o teu sorteio — é único por manager.', 'You already made your draw — one per manager.'));
    } else {
      setError(res.error ?? L('Falha no sorteio. Tenta novamente.', 'Draw failed. Try again.'));
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
      <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/85 sm:items-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="relative mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden border-2 border-linha bg-asfalto-27"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b-2 border-linha px-5 py-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="flex items-center gap-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.22em] text-mudo">
                <Dices className="h-3.5 w-3.5" /> — {L('Sorteio de época', 'Era draw')}
              </span>
              <h2 className="font-impact text-[28px] uppercase leading-none text-papel">
                {L('Criar jogador', 'Create player')}
              </h2>
            </div>
            <button type="button" onClick={close} aria-label={L('Fechar', 'Close')} className="inline-flex h-11 w-11 shrink-0 items-center justify-center border-2 border-linha text-mudo hover:border-papel hover:text-papel">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {slotFull && step === 'setup' ? (
              <div className="border-2 border-dashed border-fio p-5">
                <p className="font-voz text-[26px] leading-tight text-papel">{L('Você já tem seu jogador', 'You already have your player')}</p>
                <p className="mt-2 text-[14px] text-suave">
                  {L('A criação é única: 1 jogador por manager.', 'Creation is one-time: 1 player per manager.')}
                </p>
              </div>
            ) : null}

            {/* SETUP */}
            {!slotFull && step === 'setup' && (
              <div className="space-y-5">
                <p className="text-[14px] leading-relaxed text-suave">
                  {emIngles() ? (
                    <>
                      Pick the position and the <strong className="text-papel">playing year</strong>. The draw picks a
                      real star from that era — from obscure to legendary — and applies their <strong className="text-papel">attribute
                      DNA</strong> to your player.
                    </>
                  ) : (
                    <>
                      Escolhe a posição e o <strong className="text-papel">ano de atuação</strong>. O sorteio puxa um
                      craque real daquela época — do obscuro ao lendário — e aplica o <strong className="text-papel">DNA
                      de atributos</strong> dele no teu jogador.
                    </>
                  )}
                </p>

                <label className="block">
                  <span className={ROTULO}>{L('Nome do teu jogador', 'Your player\'s name')}</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 24))}
                    placeholder={L('ex. JOÃO SILVA', 'e.g. JOHN SMITH')}
                    maxLength={24}
                    className={CAMPO}
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block min-w-0">
                    <span className={ROTULO}>{L('Posição', 'Position')}</span>
                    <select
                      value={pos}
                      onChange={(e) => setPos(e.target.value)}
                      className={CAMPO}
                    >
                      {GACHA_POSITIONS.map((p) => (
                        <option key={p} value={p} className="bg-concreto">
                          {posLabel(p)} — {nomePosicao(p)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block min-w-0">
                    <span className={ROTULO}>{L('Ano de atuação', 'Playing year')}</span>
                    <input
                      type="number"
                      value={year}
                      min={1950}
                      max={CURRENT_YEAR}
                      onChange={(e) => setYear(Math.round(Number(e.target.value)))}
                      className={CAMPO}
                    />
                  </label>
                </div>

                {/* Odds — a escada inteira à vista */}
                {odds.length > 0 && (
                  <div className="bg-concreto p-4">
                    <p className="mb-3 flex items-center gap-1.5 font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo">
                      <Sparkles className="h-3.5 w-3.5 text-rua" /> — {L('Chances do sorteio', 'Draw odds')}
                    </p>
                    <div className="space-y-2">
                      {odds.map((o) => (
                        <div key={o.rarity_tier} className="flex items-center gap-3">
                          <span className={cn('w-20 shrink-0 px-2 py-0.5 text-center font-prova text-[10px] font-bold uppercase', DEGRAU_CLASSES[RARITY[o.rarity_tier].degrau], 'border-2')}>
                            {RARITY[o.rarity_tier].label}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden bg-linha">
                            <div className="h-full bg-papel" style={{ width: `${o.probability_pct}%` }} />
                          </div>
                          <span className="w-10 text-right font-prova text-[12px] text-suave">{o.probability_pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {error && <p role="alert" className="border-l-[3px] border-baixa bg-concreto px-3 py-2.5 text-[13px] text-papel">{error}</p>}

                <div className="pb-1 pr-1">
                  <button
                    type="button"
                    onClick={handleDraw}
                    disabled={!canDraw}
                    className={cn(BOTAO_CORRE, 'disabled:pointer-events-none disabled:bg-linha disabled:text-mudo disabled:shadow-none')}
                  >
                    <Dices className="h-5 w-5" /> {L('Sortear meu craque', 'Draw my star')} <span aria-hidden>→</span>
                  </button>
                </div>
                <p className="text-center font-prova text-[11px] uppercase tracking-[0.12em] text-mudo">{L('Sorteio único — sem repetição.', 'One-time draw — no repeats.')}</p>
              </div>
            )}

            {/* DRAWING */}
            {step === 'drawing' && (
              <div className="flex flex-col items-center justify-center gap-4 py-16">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                >
                  <Dices className="h-14 w-14 text-rua" />
                </motion.div>
                <p className="font-impact text-[26px] uppercase leading-none text-papel">{L('Sorteando…', 'Drawing…')}</p>
                <p className="text-center font-prova text-[12px] text-mudo">
                  {L(`Pesquisando craques de ${year} na posição ${nomePosicao(pos)}.`, `Searching ${year} stars at ${nomePosicao(pos)}.`)}
                </p>
              </div>
            )}

            {/* REVEAL — a carta cai colada torta, no degrau da raridade */}
            {step === 'reveal' && result && (() => {
              const d = RARITY[result.rarity].degrau;
              return (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <motion.div
                  initial={{ rotate: -8, y: -20 }}
                  animate={{ rotate: -2, y: 0 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                  className={cn('mx-auto flex w-full max-w-[280px] flex-col gap-3 p-4 shadow-[6px_8px_0_rgba(0,0,0,0.55)]', DEGRAU_CLASSES[d])}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className={cn('font-impact text-[64px] leading-[0.85] tabular-nums', ovrNumeroClasses(d))}>{result.overall}</span>
                      <span className="mt-1 font-impact text-[15px] uppercase leading-none">{posLabel(pos)} · OVR</span>
                    </div>
                    <MarcaRua tipo="escudo" className={cn('h-9', d === 'respeito' ? 'bg-ouro-27' : 'bg-asfalto-27')} />
                  </div>
                  <span className="font-prova text-[10px] font-bold uppercase tracking-[0.14em] opacity-75">{L('Você jogou como', 'You played as')}</span>
                  <span className="-mt-2 block font-voz text-[32px] leading-none [overflow-wrap:anywhere]">{result.playerName}</span>
                  <div className="flex items-center justify-between border-t-2 border-current/30 pt-2 font-prova text-[11px] font-bold uppercase tracking-[0.14em]">
                    <span>{RARITY[result.rarity].label}</span>
                    <span>{result.year}</span>
                  </div>
                </motion.div>
                {result.bio && <p className="text-center text-[13px] leading-relaxed text-suave">{result.bio}</p>}

                <dl className="grid grid-cols-2 gap-x-5 gap-y-1">
                  {ATTR_LABELS.map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between border-b border-linha py-1.5">
                      <dt className="font-prova text-[11px] font-bold uppercase tracking-[0.06em] text-mudo">{label}</dt>
                      <dd className="font-impact text-[18px] leading-none text-papel tabular-nums">{result.attributes[key]}</dd>
                    </div>
                  ))}
                </dl>

                {result.sources.length > 0 && (
                  <p className="font-prova text-[10px] text-mudo">
                    {emIngles()
                      ? `Attributes derived by Olefoot's public research methodology (${result.sources.length} source${result.sources.length > 1 ? 's' : ''}).`
                      : <>Atributos derivados por metodologia Olefoot de pesquisa pública ({result.sources.length} fonte
                    {result.sources.length > 1 ? 's' : ''}).</>}
                  </p>
                )}

                <div className="pb-1 pr-1">
                  <button type="button" onClick={handleConfirm} className={BOTAO_CORRE}>
                    {L('Confirmar e criar', 'Confirm and create')} <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
              </motion.div>
              );
            })()}

            {/* DONE */}
            {step === 'done' && result && (
              <div className="space-y-5 py-2">
                <div className="flex flex-col gap-2">
                  <SeloRua tom="corre" className="self-start">{L('No plantel', 'In the squad')}</SeloRua>
                  <p className="font-voz text-[34px] leading-none text-papel [overflow-wrap:anywhere]">{L(`${trimmed} chegou.`, `${trimmed} is in.`)}</p>
                  <p className="font-prova text-[12px] text-mudo">
                    {L('Jogou como', 'Played as')} {result.playerName} ({result.year}) · {RARITY[result.rarity].label} · OVR {result.overall}
                  </p>
                </div>
                <div className="border-l-[3px] border-rua bg-concreto p-4">
                  <p className="flex items-center gap-2 font-impact text-[18px] uppercase leading-none text-papel">
                    <Camera className="h-4 w-4 text-rua" /> {L('Último passo: sua foto', 'Last step: your photo')}
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-suave">
                    {L(
                      'Mande sua foto no WhatsApp e o time monta seu card oficial à mão. A mensagem já vai preenchida com os dados do jogador — é só anexar a foto.',
                      'Send your photo on WhatsApp and the team builds your official card by hand. The message is pre-filled with your player details — just attach the photo.',
                    )}
                  </p>
                </div>
                <div className="pb-1 pr-1">
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
                    className={BOTAO_CORRE}
                  >
                    <MessageCircle className="h-5 w-5" /> {L('Enviar minha foto no WhatsApp', 'Send my photo on WhatsApp')}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex min-h-[48px] w-full items-center justify-center border-2 border-linha font-impact text-[17px] uppercase leading-none text-mudo hover:border-papel hover:text-papel"
                >
                  {L('Fechar', 'Close')}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

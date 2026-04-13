import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, FlaskConical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGameDispatch, useGameStore } from '@/game/store';
import type { PlayingStylePresetId } from '@/tactics/playingStyle';
import {
  interpretAiLabsInput,
  oleSuggestionFromFavoriteTeam,
  presetDisplayName,
  type AiLabsMode,
  type AiLabsProposal,
} from '@/ailabs/aiLabsCore';

const MAX_CHARS = 250;

const TEAM_NAV = [
  { to: '/team', label: 'Elenco' },
  { to: '/team/tatica', label: 'Tática' },
  { to: '/team/treino', label: 'Treino' },
  { to: '/team/staff', label: 'Staff' },
  { to: '/team/ailabs', label: 'AI Labs' },
];

export function TeamAiLabs() {
  const dispatch = useGameDispatch();
  const favorite = useGameStore((s) => s.userSettings?.favoriteRealTeam);
  const oleProposal = useMemo(() => oleSuggestionFromFavoriteTeam(favorite?.name), [favorite?.name]);

  const [mode, setMode] = useState<AiLabsMode>('livre');
  const [text, setText] = useState('');
  const [proposal, setProposal] = useState<AiLabsProposal | null>(null);
  const [applying, setApplying] = useState(false);

  const runPreview = () => {
    setApplying(false);
    setProposal(interpretAiLabsInput(mode, text));
  };

  const loadOleCard = () => {
    if (!oleProposal) return;
    setMode('classico');
    setText(favorite?.name ?? '');
    setProposal(oleProposal);
  };

  const confirmApply = () => {
    if (!proposal) return;
    setApplying(true);
    window.setTimeout(() => {
      dispatch({ type: 'SET_PLAYING_STYLE_PRESET', presetId: proposal.presetId as PlayingStylePresetId });
      setApplying(false);
      setProposal(null);
      setText('');
    }, 650);
  };

  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-5 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-2xl font-black uppercase tracking-wider min-[390px]:text-3xl">
            <FlaskConical className="h-7 w-7 shrink-0 text-neon-yellow" />
            Meu Time / AI Labs
          </h2>
          <p className="mt-1 text-xs text-gray-400">
            Experimenta visão de jogo ou um clássico; confirmas e o OLE aplica o estilo na tática.
          </p>
        </div>
        <Link
          to="/team"
          className="flex shrink-0 items-center gap-2 self-start rounded bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20 sm:self-auto"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Link>
      </div>

      <nav className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
        {TEAM_NAV.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className={
              l.to === '/team/ailabs'
                ? 'rounded border border-neon-yellow bg-neon-yellow/15 px-2 py-1 text-neon-yellow'
                : 'rounded border border-white/10 bg-black/30 px-2 py-1 text-gray-400 hover:text-white'
            }
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="sports-panel space-y-4 p-4 sm:p-5"
      >
        {favorite?.name ? (
          <div className="rounded-lg border border-neon-yellow/25 bg-neon-yellow/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neon-yellow">Sugestão OLE</p>
            <p className="mt-1 text-xs text-white/85">
              Clube do coração: <span className="font-bold text-white">{favorite.name}</span>
            </p>
            <button
              type="button"
              onClick={loadOleCard}
              className="mt-2 rounded border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-white/20"
            >
              Ver sugestão
            </button>
          </div>
        ) : (
          <p className="text-[10px] text-gray-500">Sem clube do coração guardado — a sugestão OLE fica desligada.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('livre');
              setProposal(null);
            }}
            className={
              mode === 'livre'
                ? 'rounded-lg border border-neon-yellow bg-neon-yellow/15 px-3 py-2 text-[10px] font-bold uppercase text-neon-yellow'
                : 'rounded-lg border border-white/15 px-3 py-2 text-[10px] font-bold uppercase text-gray-400 hover:border-white/30'
            }
          >
            Visão livre
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('classico');
              setProposal(null);
            }}
            className={
              mode === 'classico'
                ? 'rounded-lg border border-neon-yellow bg-neon-yellow/15 px-3 py-2 text-[10px] font-bold uppercase text-neon-yellow'
                : 'rounded-lg border border-white/15 px-3 py-2 text-[10px] font-bold uppercase text-gray-400 hover:border-white/30'
            }
          >
            Inspirado num clássico
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase text-gray-500">
            {mode === 'classico' ? 'Escreve o clássico (ex.: Corinthians 2012)' : 'Como queres que o teu time jogue?'}
          </span>
          <textarea
            value={text}
            maxLength={MAX_CHARS}
            onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
            rows={4}
            className="w-full resize-none rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-neon-yellow"
            placeholder={
              mode === 'classico'
                ? 'Ex.: jogo como o Barcelona 2011'
                : 'Ex.: pressão alta e saída rápida para o avançado'
            }
          />
          <span className="text-[9px] text-gray-600">
            {text.length}/{MAX_CHARS}
          </span>
        </label>

        <button
          type="button"
          onClick={runPreview}
          disabled={text.trim().length < 4}
          className="w-full rounded-lg border border-neon-yellow/40 bg-neon-yellow/10 py-2.5 text-xs font-black uppercase tracking-wide text-neon-yellow hover:bg-neon-yellow/20 disabled:pointer-events-none disabled:opacity-40"
        >
          Pedir plano
        </button>

        {applying ? (
          <div className="rounded-lg border border-white/10 bg-black/50 py-6 text-center text-sm font-bold text-neon-yellow">
            A aplicar estilo…
          </div>
        ) : null}

        {proposal && !applying ? (
          <div className="space-y-3 rounded-lg border border-white/10 bg-black/35 p-3">
            <p className="text-[10px] font-bold uppercase text-gray-500">Resumo</p>
            <p className="text-sm font-semibold leading-snug text-white/95">{proposal.headline}</p>
            <p className="text-xs leading-relaxed text-gray-400">{proposal.implementation}</p>
            <p className="text-[10px] font-bold uppercase text-neon-yellow/90">
              Preset: {presetDisplayName(proposal.presetId)}
            </p>
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-500">Reforços sugeridos (mercado)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {proposal.transferByPos.map((t) => (
                  <Link
                    key={t.pos}
                    to="/transfer"
                    className="rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-bold text-white hover:border-neon-yellow/40 hover:text-neon-yellow"
                  >
                    {t.pos} — {t.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setProposal(null)}
                className="flex-1 rounded-lg border border-white/20 py-2 text-xs font-bold uppercase text-gray-300 hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmApply}
                className="flex-1 rounded-lg bg-neon-yellow py-2 text-xs font-black uppercase text-black hover:bg-neon-yellow/90"
              >
                Confirmar e aplicar
              </button>
            </div>
          </div>
        ) : null}
      </motion.div>

      <p className="text-center text-[9px] text-gray-600">
        Referências históricas são inspiração pública aproximada — afinas tudo em Tática e Treino.
      </p>
    </div>
  );
}

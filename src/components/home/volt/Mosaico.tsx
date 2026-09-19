/**
 * Mosaico 2×2 da Home VOLT2 — Lendas, Legends Cup, Missões, Carteira
 * (A VIRADA · V4).
 *
 * Missões abre uma gaveta com as missões do dia: o resgate
 * (CLAIM_CHALLENGE_REWARD) só existe na Home, então o bloco não pode virar um
 * link pra outro lugar.
 *
 * Carteira NÃO mostra saldo nem ouro: o token ainda não existe e a ficha do jogo
 * é fictícia. O que aparece é o estado real do vínculo da carteira Solana.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Crown, Trophy, X } from 'lucide-react';
import { Hashtag, SeloRede } from '@/components/ui';
import { DailyMissions } from '@/components/home/DailyMissions';
import type { LegendMini } from '@/components/home/LegendsRail';
import type { DailyChallenge } from '@/game/dailyChallenges';
import { fetchMyLinkedSolanaWallet, type SolanaWalletLink } from '@/supabase/solanaWallet';

// leading 1.15: com `truncate` (overflow hidden), leading-none corta o til de MISSÕES.
const TILE_TITLE = 'block min-w-0 truncate font-impact text-[clamp(20px,6.6vw,26px)] uppercase leading-[1.15]';

function hashtagOf(label: string): string {
  return `#${label.toLowerCase().replace(/\s+/g, '')}`;
}

export function Mosaico({
  legend,
  cupPhase,
  challenges,
  streak,
  onClaim,
}: {
  legend: LegendMini | null;
  /** Fase atual da Legends Cup, ou null se não há campanha ativa. */
  cupPhase: string | null;
  challenges: DailyChallenge[];
  streak?: number;
  onClaim: (challengeId: string) => void;
}) {
  return (
    <section aria-label="Atalhos" className="grid auto-rows-[196px] grid-cols-2 gap-3.5">
      <TileLenda legend={legend} />
      <Link
        to="/legends-cup"
        className="flex min-w-0 flex-col justify-between bg-neon-yellow p-4 text-black transition-colors hover:bg-white"
      >
        <Trophy aria-hidden className="h-[30px] w-[30px]" strokeWidth={2} />
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className={TILE_TITLE}>Legends Cup</span>
          <span className="block min-w-0 truncate font-mono text-[11.5px] font-semibold text-[#1A1700]">
            {cupPhase ? hashtagOf(cupPhase) : '#comece'}
          </span>
        </span>
      </Link>
      <TileMissoes challenges={challenges} streak={streak} onClaim={onClaim} />
      <TileCarteira />
    </section>
  );
}

function TileLenda({ legend }: { legend: LegendMini | null }) {
  const to = legend ? `/mercado/transfer?legacy=${encodeURIComponent(legend.id)}` : '/mercado/transfer';
  return (
    <Link to={to} className="relative block min-w-0 overflow-hidden border border-white/[0.12] bg-panel text-white">
      {legend?.portraitUrl ? (
        <>
          <img
            src={legend.portraitUrl}
            alt=""
            className="absolute inset-0 object-cover"
            style={{ width: '100%', height: '100%', maxWidth: 'none', objectPosition: '50% 12%' }}
          />
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, rgba(13,13,13,0) 40%, rgba(13,13,13,0.95) 88%)' }}
          />
        </>
      ) : (
        <Crown aria-hidden className="absolute right-4 top-4 h-[30px] w-[30px] text-lenda" strokeWidth={2} />
      )}
      {legend?.isNew && (
        <span className="absolute left-2.5 top-3 bg-neon-yellow px-2 pb-[3px] pt-1 font-impact text-[12px] tracking-[0.08em] text-black">
          NOVO
        </span>
      )}
      <span className="absolute inset-x-3 bottom-3 flex min-w-0 flex-col gap-1.5">
        <span className="block min-w-0 truncate font-impact text-[clamp(22px,7.4vw,30px)] uppercase leading-[1.1]">
          {legend ? legend.name.split(/\s+/)[0] : 'Lendas'}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 bg-lenda px-[5px] py-0.5 font-mono text-[9.5px] font-semibold tracking-[0.12em] text-black">
            LENDA
          </span>
          <Hashtag className="text-giz">#mercado</Hashtag>
        </span>
      </span>
    </Link>
  );
}

function TileMissoes({
  challenges,
  streak,
  onClaim,
}: {
  challenges: DailyChallenge[];
  streak?: number;
  onClaim: (challengeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const total = challenges.length;
  const done = challenges.filter((c) => c.completed).length;
  const claimable = challenges.filter((c) => c.completed && !c.claimed);
  const claimableExp = claimable.reduce((s, c) => s + c.reward, 0);
  const pendingExp = challenges.filter((c) => !c.claimed).reduce((s, c) => s + c.reward, 0);

  // Anel: 2πr com r = 26 ≈ 163,4
  const C = 163.4;
  const dash = total > 0 ? (done / total) * C : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={total === 0}
        className="flex min-w-0 flex-col justify-between border border-white/10 bg-panel p-4 text-left text-white transition-colors hover:border-white/30 disabled:opacity-50"
        aria-label={`Missões do dia: ${done} de ${total} concluídas`}
      >
        <span className="relative block h-16 w-16">
          <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden className="block">
            <circle cx="32" cy="32" r="26" fill="none" stroke="var(--color-card-hi)" strokeWidth="7" />
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="var(--color-neon-yellow)"
              strokeWidth="7"
              strokeDasharray={`${dash} ${C}`}
              transform="rotate(-90 32 32)"
            />
          </svg>
          <span className="ole-num absolute inset-0 flex items-center justify-center text-[15px] text-white">
            {done}/{total}
          </span>
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className={TILE_TITLE}>Missões</span>
          {claimableExp > 0 ? (
            <span className="block min-w-0 truncate font-mono text-[clamp(10px,3.1vw,11.5px)] font-semibold text-neon-yellow">
              Resgatar +{claimableExp.toLocaleString('pt-BR')} EXP
            </span>
          ) : (
            <Hashtag>{pendingExp > 0 ? `+${pendingExp.toLocaleString('pt-BR')} EXP` : '#feitas'}</Hashtag>
          )}
        </span>
      </button>
      {open && (
        <Gaveta titulo="Missões do dia" onClose={() => setOpen(false)}>
          <DailyMissions challenges={challenges} streak={streak} onClaim={onClaim} />
        </Gaveta>
      )}
    </>
  );
}

function TileCarteira() {
  const [link, setLink] = useState<SolanaWalletLink | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    void fetchMyLinkedSolanaWallet()
      .then((l) => vivo && setLink(l))
      .catch(() => vivo && setLink(null));
    return () => {
      vivo = false;
    };
  }, []);
  const verified = !!link?.verified;
  return (
    <Link
      to="/wallet"
      className="flex min-w-0 flex-col justify-between border border-white/10 bg-panel p-4 text-white transition-colors hover:border-white/30"
    >
      <SeloRede />
      <span className="flex min-w-0 flex-col gap-2">
        <span className="block min-w-0 truncate font-impact text-[clamp(22px,7.4vw,30px)] uppercase leading-[1.1]">Carteira</span>
        {verified && link ? (
          <span className="flex h-11 min-w-0 items-center gap-1.5 border border-alta/45 px-2.5">
            <Check aria-hidden className="h-4 w-4 shrink-0 text-alta" strokeWidth={2.6} />
            <span className="min-w-0 truncate font-mono text-[11.5px] text-giz">
              {link.walletAddress.slice(0, 4)}…{link.walletAddress.slice(-4)}
            </span>
          </span>
        ) : (
          <span className="ole-num flex h-11 items-center justify-center border border-neon-yellow text-[11.5px] uppercase text-neon-yellow">
            {link === undefined ? '…' : 'Vincular'}
          </span>
        )}
      </span>
    </Link>
  );
}

/** Gaveta de baixo (#25282B) — fecha no fundo, no X e no Esc. */
function Gaveta({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[82vh] w-full max-w-2xl overflow-y-auto bg-sheet px-4 pt-4 pb-[calc(20px+env(safe-area-inset-bottom,0px))]"
      >
        {/* O conteúdo já traz o próprio título (DailyMissions); aqui ele fica só pra leitor de tela. */}
        <div className="mb-2 flex items-center justify-end">
          <h2 className="sr-only">{titulo}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-11 w-11 shrink-0 items-center justify-center border border-white/20 text-white hover:border-white"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

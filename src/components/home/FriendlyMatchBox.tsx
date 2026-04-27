import { motion } from 'motion/react';
import { Search, UserPlus, Zap } from 'lucide-react';
import { useState } from 'react';
import { DashboardSection } from '@/components/dashboard';
import { QuickSearchModal } from '@/components/friendly/QuickSearchModal';

export function FriendlyMatchBox() {
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <>
      <DashboardSection size="sm">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative isolate overflow-hidden bg-neon-yellow border border-black/15 rounded-sm p-6 flex flex-col justify-center items-center text-center w-full"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}
        >
          {/* Eyebrow preto sobre amarelo */}
          <div
            className="relative z-10 inline-flex items-center gap-3 text-black/85 mb-3"
            style={{ fontFamily: 'var(--font-ui)' }}
          >
            <span aria-hidden className="h-px w-8 bg-black/60" />
            <span className="uppercase font-semibold" style={{ fontSize: '10px', letterSpacing: '0.22em' }}>
              Desafie rivais
            </span>
            <span aria-hidden className="h-px w-8 bg-black/60" />
          </div>

          {/* Título: AMISTOSO em Moret italic preto */}
          <h3
            className="relative z-10 italic text-black leading-none"
            style={{
              fontFamily: 'var(--font-serif-hero)',
              fontWeight: 700,
              fontSize: 'clamp(2.5rem, 6vw, 3.75rem)',
              letterSpacing: '-0.02em',
            }}
          >
            Amistoso
          </h3>

          {/* Raio destaque — abaixo do título, pulsa pra dar dinâmica */}
          <motion.div
            className="relative z-10 mt-5 grid place-items-center"
            initial={{ scale: 1, rotate: -4 }}
            animate={{ scale: [1, 1.08, 1], rotate: [-4, 2, -4] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          >
            <Zap
              className="h-12 w-12 sm:h-14 sm:w-14 fill-black text-black"
              strokeWidth={0}
            />
          </motion.div>

          {/* Botões de ação */}
          <div className="relative z-10 mt-6 w-full flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setQuickSearchOpen(true)}
              className="w-full bg-black text-neon-yellow hover:bg-black/90 px-5 py-3 font-display font-bold uppercase tracking-[0.2em] text-[11px] sm:text-[12px] transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.4)] flex items-center justify-center gap-2"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <Search className="w-4 h-4" />
              BUSCAR PARTIDA
            </button>

            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="w-full bg-black/60 border border-black/40 text-black hover:bg-black/70 hover:text-neon-yellow px-5 py-2.5 font-display font-bold uppercase tracking-[0.2em] text-[10px] sm:text-[11px] transition-colors flex items-center justify-center gap-2"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <UserPlus className="w-4 h-4" />
              CONVIDAR CLUBE
            </button>
          </div>

          {/* Mini-CTA — afirmação do clique */}
          <p
            className="relative z-10 mt-4 text-black/75 uppercase"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.22em',
            }}
          >
            Mostre quem manda no jogo
          </p>
        </motion.div>
      </DashboardSection>

      {/* Modais */}
      <QuickSearchModal isOpen={quickSearchOpen} onClose={() => setQuickSearchOpen(false)} />

      {/* TODO: InviteClubModal (fluxo manual existente) */}
      {inviteOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-deep-black border border-white/10 rounded p-6 max-w-md">
            <h3 className="text-lg font-display font-bold text-white mb-4">Convidar Clube</h3>
            <p className="text-sm text-gray-400 mb-4">
              Fluxo manual de convite será integrado aqui (mantém lógica existente da Home).
            </p>
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="w-full btn-primary py-2"
            >
              <span className="btn-primary-inner">Fechar</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

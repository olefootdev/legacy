import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import type { WalletShellAccount } from './WalletShell';

const FAQ_SPOT: { q: string; a: string }[] = [
  {
    q: 'O que é a conta SPOT?',
    a: 'É o teu saldo imediato na Olefoot: BRO na plataforma e OLE (ranking). Daqui podes depositar, enviar ou fazer SWAP para OLEXP quando quiseres alocar em Hold.',
  },
  {
    q: 'O que é OLEXP?',
    a: 'OLEXP é a conta de posições em Hold com prazo e yield diário (dias úteis), conforme o plano escolhido. O principal sai do SPOT até resgate ou SWAP de volta.',
  },
  {
    q: 'O que é SWAP?',
    a: 'SWAP move valor entre SPOT e OLEXP. SPOT → OLEXP abre uma posição OLEXP. OLEXP → SPOT devolve o principal de uma posição ativa ao SPOT (antes do vencimento, conforme regras do produto).',
  },
  {
    q: 'Porque há termo de risco no SPOT → OLEXP?',
    a: 'Alocar em Hold envolve risco de mercado e de liquidez até ao vencimento. O texto resume isso; tens de confirmar que leste antes de continuar. Não prometemos retorno.',
  },
  {
    q: 'Qual a diferença entre BRO, OLE e EXP?',
    a: 'BRO é o token de saldo na carteira. OLE reflete o teu progresso no ranking. EXP é a moeda de jogo (modo carreira) — vê os três saldos na secção Carteira (barra resumo no topo da página Wallet).',
  },
  {
    q: 'Quanto tempo demora um depósito ou envio?',
    a: 'Nesta versão MVP os fluxos são simulados na interface. Prazos reais dependem de integração bancária e compliance (futuro).',
  },
];

const FAQ_OLEXP_EXTRA: { q: string; a: string }[] = [
  {
    q: 'Como funciona o prazo de Hold?',
    a: 'Escolhes o plano (ex.: 90d). O yield acumula em dias úteis até à data de vencimento; depois podes resgatar o principal para o SPOT.',
  },
  {
    q: 'SWAP OLEXP → SPOT sem o mesmo termo?',
    a: 'Por defeito, devolver principal ao SPOT não repete o termo longo do SPOT→OLEXP; continua a aplicar-se a regulamento da plataforma.',
  },
];

export function WalletFaq({ variant }: { variant: WalletShellAccount }) {
  const items = variant === 'olexp' ? [...FAQ_SPOT.slice(0, 4), ...FAQ_OLEXP_EXTRA, FAQ_SPOT[4]!] : FAQ_SPOT;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="space-y-3 pt-6 border-t border-white/10">
      <h2 className="text-xs font-display font-bold uppercase tracking-widest text-gray-500">Perguntas frequentes</h2>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md divide-y divide-white/5 overflow-hidden">
        {items.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={i}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/[0.04] transition-colors"
              >
                <span className="text-sm font-medium text-white pr-2">{item.q}</span>
                <ChevronDown
                  className={cn('w-4 h-4 shrink-0 text-neon-yellow transition-transform', isOpen && 'rotate-180')}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="px-4 pb-4 text-xs text-gray-400 leading-relaxed">{item.a}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}

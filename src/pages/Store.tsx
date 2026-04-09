import { motion } from 'motion/react';
import { ShoppingBag, Zap, Package } from 'lucide-react';

export function Store() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold neon-text mb-6">Loja</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div className="glass-panel p-6 border-neon-yellow/30 relative overflow-hidden group">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-neon-yellow/20 rounded-full blur-2xl group-hover:bg-neon-yellow/30 transition-colors" />
          <Package className="w-10 h-10 text-neon-yellow mb-4" />
          <h3 className="text-xl font-bold mb-2">Pacote Premium</h3>
          <p className="text-sm text-gray-400 mb-4">Garante 1 jogador 80+ e 3 boosters de treinamento.</p>
          <button className="w-full neon-bg py-3 rounded-xl font-bold text-black">
            1.000 EXP
          </button>
        </motion.div>

        <motion.div className="glass-panel p-6 relative overflow-hidden group">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl group-hover:bg-blue-500/30 transition-colors" />
          <Zap className="w-10 h-10 text-blue-400 mb-4" />
          <h3 className="text-xl font-bold mb-2">Booster de Recuperação</h3>
          <p className="text-sm text-gray-400 mb-4">Recupera 100% da fadiga de todo o elenco.</p>
          <button className="w-full bg-white/10 hover:bg-white/20 py-3 rounded-xl font-bold transition-colors">
            250 EXP
          </button>
        </motion.div>
      </div>
    </div>
  );
}

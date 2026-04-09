import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, GraduationCap, Search, X, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { overallFromAttributes } from '@/entities/player';
import { cn } from '@/lib/utils';

export function YouthProspects() {
  const players = useGameStore((s) => s.players);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const prospects = useMemo(() => {
    return Object.values(players)
      .filter((p) => p.archetype === 'novo_talento')
      .filter((p) => (pos ? p.pos === pos : true))
      .filter((p) => (query ? p.name.toLowerCase().includes(query.toLowerCase()) : true))
      .sort((a, b) => overallFromAttributes(b.attrs) - overallFromAttributes(a.attrs));
  }, [players, pos, query]);

  const positions = useMemo(() => Array.from(new Set(prospects.map((p) => p.pos))).sort(), [prospects]);
  const selected = prospects.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-black italic uppercase tracking-wider">Categoria de Base</h2>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-bold">Buscar Promessas</p>
        </div>
        <Link to="/city" className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded text-sm font-bold flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Cidade
        </Link>
      </div>

      <div className="sports-panel p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome"
            className="w-full bg-black/40 border border-white/10 rounded px-9 py-2 text-sm"
          />
        </div>
        <select
          value={pos}
          onChange={(e) => setPos(e.target.value)}
          className="bg-black/40 border border-white/10 rounded px-3 py-2 text-sm"
        >
          <option value="">Todas posições</option>
          {positions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <div className="bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-gray-400 flex items-center justify-between">
          <span>Promessas encontradas</span>
          <span className="text-neon-yellow font-bold">{prospects.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {prospects.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => setSelectedId(p.id)}
            className="sports-panel p-4 border border-blue-400/30 bg-blue-500/5 cursor-pointer hover:border-neon-yellow/60 hover:bg-neon-yellow/5 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-300 uppercase">{p.pos}</span>
              <GraduationCap className="w-4 h-4 text-blue-300" />
            </div>
            <div className="mt-2 text-sm font-display font-black uppercase truncate">{p.name}</div>
            <div className="mt-3 text-[11px] text-gray-400">Overall: <span className="text-white font-bold">{overallFromAttributes(p.attrs)}</span></div>
            <div className="text-[11px] text-gray-400">Potencial base: <span className="text-neon-yellow font-bold">{Math.min(99, overallFromAttributes(p.attrs) + 6)}</span></div>
          </motion.div>
        ))}
      </div>

      {prospects.length === 0 && (
        <div className="sports-panel p-8 text-center text-gray-500 text-sm">
          Nenhuma promessa cadastrada com os filtros atuais.
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              className="sports-panel w-full max-w-4xl p-0 overflow-hidden border-neon-yellow/40"
            >
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="absolute right-5 top-5 z-10 p-2 rounded-full bg-black/60 text-gray-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="p-6 border-b md:border-b-0 md:border-r border-white/10 bg-blue-500/5">
                  <div className="text-[10px] uppercase tracking-widest text-blue-300 font-bold">Novo talento</div>
                  <h3 className="text-3xl font-display font-black uppercase mt-1">{selected.name}</h3>
                  <p className="text-xs text-gray-400 mt-2">
                    Promessa da base com perfil de evolução acelerada. Ideal para desenvolvimento progressivo no elenco principal.
                  </p>

                  <div className="mt-5 space-y-2">
                    <AttrRow label="Passe" value={selected.attrs.passe} />
                    <AttrRow label="Drible" value={selected.attrs.drible} />
                    <AttrRow label="Finalização" value={selected.attrs.finalizacao} />
                    <AttrRow label="Velocidade" value={selected.attrs.velocidade} />
                    <AttrRow label="Marcação" value={selected.attrs.marcacao} />
                    <AttrRow label="Físico" value={selected.attrs.fisico} />
                    <AttrRow label="Tático" value={selected.attrs.tatico} />
                  </div>
                </div>

                <div className="p-6 flex flex-col">
                  <div className="grid grid-cols-2 gap-3">
                    <Info label="Posição" value={selected.pos} />
                    <Info label="Overall" value={String(overallFromAttributes(selected.attrs))} />
                    <Info label="Potencial" value={String(Math.min(99, overallFromAttributes(selected.attrs) + 6))} />
                    <Info label="Camisa" value={`#${selected.num}`} />
                  </div>

                  <div className="mt-5 p-4 rounded-xl border border-neon-yellow/30 bg-neon-yellow/10">
                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Preço de aquisição</div>
                    <div className="text-3xl font-display font-black text-neon-yellow mt-1">
                      {((overallFromAttributes(selected.attrs) * 1850) / 100).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      BRO
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Valor base calculado por overall e potencial da promessa.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="mt-auto w-full bg-neon-yellow text-black py-3 rounded-xl font-display font-black uppercase tracking-wider text-sm flex items-center justify-center gap-2 hover:bg-white transition-colors"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Comprar Agora
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AttrRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-[10px] uppercase tracking-widest text-gray-500 font-bold">{label}</span>
      <div className="flex-1 h-2 rounded bg-black/50 overflow-hidden">
        <div className={cn('h-full', value >= 85 ? 'bg-neon-yellow' : value >= 72 ? 'bg-neon-green' : 'bg-blue-400')} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-bold text-white">{value}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/30 border border-white/10 rounded p-2.5">
      <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">{label}</div>
      <div className="text-sm text-white font-bold mt-0.5">{value}</div>
    </div>
  );
}

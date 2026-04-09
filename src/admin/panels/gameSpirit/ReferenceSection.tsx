import { useState } from 'react';
import { ChevronDown, ChevronRight, ClipboardCopy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildGameSpiritCopypasta, GAME_SPIRIT_SECTIONS } from '@/gamespirit/admin/gameSpiritSystemReference';

export function ReferenceSection() {
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/55">
        Mapa estático dos ficheiros em <code className="text-cyan-300/85">src/gamespirit/</code>. Útil para devs; o
        separador <strong className="text-white">Diagnóstico</strong> diz o que está ligado ao motor.
      </p>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(buildGameSpiritCopypasta());
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-[10px] font-bold uppercase text-white/80 hover:bg-white/10"
      >
        <ClipboardCopy className="h-3.5 w-3.5" />
        {copied ? 'Copiado' : 'Copiar spec completa'}
      </button>
      <div className="space-y-1">
        {GAME_SPIRIT_SECTIONS.map((s) => {
          const isOpen = open === s.id;
          return (
            <div key={s.id} className="rounded-lg border border-white/10 bg-white/[0.03]">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : s.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold text-white/85"
              >
                {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                {s.title}
              </button>
              {isOpen ? (
                <div className="border-t border-white/10 px-3 py-2 text-xs text-white/55">
                  <p className="mb-2">{s.lead}</p>
                  <ul className="space-y-1">
                    {s.modules.map((m) => (
                      <li key={m.file} className={cn('font-mono text-[10px] text-cyan-300/80')}>
                        {m.file}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

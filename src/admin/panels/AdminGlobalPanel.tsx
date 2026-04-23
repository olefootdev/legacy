/**
 * AdminGlobalPanel — agrupa Lançamento, Config global e Broadcast numa tab única.
 *
 * Os 3 painéis originais continuam como componentes separados; este wrapper
 * oferece navegação interna pra reduzir o número de tabs top-level.
 */

import { useState } from 'react';
import { Rocket, Flag, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminLaunchPanel } from './AdminLaunchPanel';
import { AdminPlatformConfigPanel } from './AdminPlatformConfigPanel';
import { AdminBroadcastPanel } from './AdminBroadcastPanel';

type GlobalSection = 'launch' | 'config' | 'broadcast';

const SECTIONS: { id: GlobalSection; label: string; icon: typeof Rocket }[] = [
  { id: 'launch',    label: 'Lançamento', icon: Rocket },
  { id: 'config',    label: 'Config',     icon: Flag },
  { id: 'broadcast', label: 'Broadcast',  icon: Megaphone },
];

export function AdminGlobalPanel() {
  const [section, setSection] = useState<GlobalSection>('launch');
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5 border-b border-white/10 pb-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider transition-colors',
                section === s.id
                  ? 'bg-neon-yellow/15 text-neon-yellow'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {section === 'launch' ? <AdminLaunchPanel /> : null}
      {section === 'config' ? <AdminPlatformConfigPanel /> : null}
      {section === 'broadcast' ? <AdminBroadcastPanel /> : null}
    </div>
  );
}

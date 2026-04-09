import { useRef } from 'react';
import { User, Camera } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { useTrainerAvatarUpload } from '@/hooks/useTrainerAvatarUpload';
import { cn } from '@/lib/utils';

export function TrainerAvatarHeaderControl({ className }: { className?: string }) {
  const avatar = useGameStore((s) => s.userSettings.trainerAvatarDataUrl);
  const { onFileChange, error } = useTrainerAvatarUpload();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn('relative flex shrink-0 flex-col items-start', className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-white/20 bg-white/5 transition-colors hover:border-neon-yellow/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-yellow"
        title="Carregar foto do treinador"
        aria-label="Carregar ou alterar foto do treinador"
      >
        {avatar ? (
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-white/45">
            <User className="h-5 w-5" />
          </span>
        )}
        <span className="pointer-events-none absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-neon-yellow text-black shadow-sm ring-2 ring-deep-black">
          <Camera className="h-2.5 w-2.5" strokeWidth={2.5} />
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />
      {error ? (
        <p
          className="absolute left-0 top-[calc(100%+4px)] z-[60] max-w-[min(220px,70vw)] text-[10px] leading-tight text-red-400"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

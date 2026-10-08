import { useRef } from 'react';
import { User, Camera } from 'lucide-react';
import { useGameStore } from '@/game/store';
import { useTrainerAvatarUpload } from '@/hooks/useTrainerAvatarUpload';
import { cn } from '@/lib/utils';
import { L } from '@/i18n/L';

export function TrainerAvatarHeaderControl({ className }: { className?: string }) {
  const avatar = useGameStore((s) => s.userSettings.trainerAvatarDataUrl);
  const { onFileChange, error } = useTrainerAvatarUpload();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn('relative flex shrink-0 flex-col items-start', className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-linha bg-concreto transition-colors hover:border-rua focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rua"
        title={L('Carregar foto do treinador', 'Upload manager photo')}
        aria-label={L('Carregar ou alterar foto do treinador', 'Upload or change manager photo')}
      >
        {avatar ? (
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-mudo">
            <User className="h-5 w-5" />
          </span>
        )}
        <span className="pointer-events-none absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-rua text-asfalto-27 ring-2 ring-asfalto-27">
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
          className="absolute left-0 top-[calc(100%+4px)] z-[60] max-w-[min(220px,70vw)] font-prova text-[10px] leading-tight text-baixa"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

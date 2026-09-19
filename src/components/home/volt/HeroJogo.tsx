/**
 * Herói da Home VOLT2 — UM protagonista: o próximo jogo (A VIRADA · V4).
 *
 * Com jogo marcado: confronto em Anton gigante, horário, #ligaglobal e a ação
 * principal "Escalar time". Sem jogo marcado, o protagonista vira a Partida
 * Rápida — nunca um herói vazio.
 *
 * Gradiente aqui é só a sombra da foto (legibilidade) — o único lugar onde o
 * VOLT2 aceita degradê fora de acabamento.
 */
import { Link } from 'react-router-dom';
import { Clock, Zap } from 'lucide-react';
import { Hashtag } from '@/components/ui';

export interface HeroFixture {
  opponentName: string;
  /** "Hoje · 21:00", "20/09 · 21:00", "14:32" (contagem) ou "Agora". */
  kickoffLabel: string;
  isLive: boolean;
  /** "#ligaglobal #div3" */
  tag: string | null;
}

const NOME_CLUBE = 'font-impact uppercase leading-[0.9] text-white [overflow-wrap:anywhere]';
const PRIMARIO =
  'ole-num flex h-14 min-w-0 grow items-center justify-center whitespace-nowrap bg-neon-yellow px-3 text-[14px] uppercase text-black transition-colors hover:bg-white [--corte:14px] [clip-path:var(--clip-corte)] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-black';
const SECUNDARIO =
  'ole-num flex h-14 w-[112px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border border-white/30 bg-deep-black text-[12.5px] uppercase text-white transition-colors hover:border-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-yellow';

export function HeroJogo({
  clubName,
  fixture,
  heroImage,
  heroImgOk,
  onHeroError,
}: {
  clubName: string;
  fixture: HeroFixture | null;
  heroImage: string;
  heroImgOk: boolean;
  onHeroError: () => void;
}) {
  return (
    <section
      aria-label={fixture ? `Próximo jogo: ${clubName} contra ${fixture.opponentName}` : 'Partida rápida'}
      className="relative -mx-3 -mt-6 h-[520px] max-w-none overflow-hidden bg-deep-black sm:mx-0 sm:mt-0 sm:h-[560px] sm:max-w-full sm:border sm:border-white/10"
    >
      {heroImgOk && (
        <img
          src={heroImage}
          alt=""
          onError={onHeroError}
          className="absolute inset-0 object-cover"
          // Inline de propósito: mobile-responsive.css tem `img { height: auto }`
          // fora de camada, que vence o h-full do Tailwind.
          style={{ width: '100%', height: '100%', maxWidth: 'none', objectPosition: '40% 16%' }}
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(13,13,13,0.55) 0%, rgba(13,13,13,0) 18%, rgba(13,13,13,0) 36%, rgba(13,13,13,0.9) 64%, #0D0D0D 100%)',
        }}
      />

      <div className="absolute inset-x-4 bottom-5 flex flex-col gap-3.5">
        <span className="self-start bg-neon-yellow px-2.5 pb-1 pt-[5px] font-impact text-[14px] uppercase tracking-[0.06em] text-black">
          {fixture ? (fixture.isLive ? 'Ao vivo' : 'Próximo jogo') : 'Jogue agora'}
        </span>

        {fixture ? (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={NOME_CLUBE} style={{ fontSize: 'clamp(40px, 15vw, 64px)' }}>
              {clubName}
            </span>
            <div className="flex items-center gap-2.5" aria-hidden>
              <span className="font-impact text-[20px] text-neon-yellow">VS</span>
              <span className="block h-0.5 grow bg-neon-yellow" />
            </div>
            <span className={NOME_CLUBE} style={{ fontSize: 'clamp(40px, 15vw, 64px)' }}>
              {fixture.opponentName}
            </span>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className={NOME_CLUBE} style={{ fontSize: 'clamp(40px, 15vw, 64px)' }}>
              {clubName}
            </span>
            <Hashtag className="text-[12px] text-giz">#partidarápida</Hashtag>
          </div>
        )}

        {fixture && (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="ole-num inline-flex h-[30px] shrink-0 items-center gap-1.5 bg-white px-2.5 text-[12px] uppercase text-black">
              <Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={2.6} />
              {fixture.kickoffLabel}
            </span>
            {fixture.tag && <Hashtag className="text-[12px] text-giz">{fixture.tag}</Hashtag>}
          </div>
        )}

        <div className="flex gap-3">
          {fixture ? (
            <>
              <Link to="/team" className={PRIMARIO}>
                Escalar time
              </Link>
              <Link to="/match/quick" className={SECUNDARIO}>
                <Zap aria-hidden className="h-4 w-4 fill-neon-yellow text-neon-yellow" />
                Rápida
              </Link>
            </>
          ) : (
            <>
              <Link to="/match/quick" className={PRIMARIO}>
                Partida rápida
              </Link>
              <Link to="/team" className={SECUNDARIO}>
                Escalar
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

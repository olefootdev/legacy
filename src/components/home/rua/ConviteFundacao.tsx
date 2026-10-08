/**
 * Convite da Fundação do Clube pra quem JÁ jogava antes dela (2026-10-07).
 * Sem identidade o time joga neutro no motor — os rivais fundados jogam com
 * estilo próprio. Some assim que o clube é fundado.
 *
 * Fundou mas não estreou (fechou o app antes do Ato 5): vira o convite pro
 * Jogo da Fundação. Some depois da estreia.
 */
import { Link } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { L } from '@/i18n/L';

export function ConviteFundacao() {
  const temIdentidade = useGameStore((s) => !!s.club?.identidade);
  const estreou = useGameStore((s) => !!s.club?.identidade?.estreia);
  const temOnze = useGameStore((s) => Object.keys(s.players ?? {}).length >= 11);
  if (temIdentidade && !estreou && temOnze) return <ConviteEstreia />;
  if (temIdentidade) return null;
  return (
    <section
      aria-label={L('Fundar o clube', 'Found the club')}
      className="-rotate-1 bg-cal p-5 text-asfalto-27 shadow-[6px_6px_0_rgba(0,0,0,0.6)]"
    >
      <p className="font-prova text-[11px] font-bold uppercase tracking-[0.2em]">— {L('Fundação do clube', 'Club foundation')}</p>
      <p className="mt-1.5 font-voz text-[clamp(28px,8vw,36px)] leading-[1.02]">{L('Teu time ainda não tem DNA.', "Your team has no DNA yet.")}</p>
      <p className="mt-2 text-[14px] leading-snug">
        {L(
          'Quem já fundou joga com estilo próprio: posse, pressão, contra-ataque. Escolhe o teu em 3 minutos.',
          'Founded clubs play with their own style: possession, pressing, counters. Pick yours in 3 minutes.',
        )}
      </p>
      <Link
        to="/fundacao"
        className="mt-4 inline-flex min-h-[50px] items-center gap-2 bg-asfalto-27 px-5 font-impact text-[20px] uppercase leading-none text-rua transition-transform hover:-translate-y-0.5"
      >
        {L('Fundar o clube', 'Found the club')} <span aria-hidden>→</span>
      </Link>
    </section>
  );
}

function ConviteEstreia() {
  return (
    <section aria-label={L('Jogo da fundação', 'Founding match')} className="-rotate-1 bg-rua p-5 text-asfalto-27 shadow-[6px_6px_0_rgba(0,0,0,0.6)]">
      <p className="font-prova text-[11px] font-bold uppercase tracking-[0.2em]">— {L('Jogo da fundação', 'Founding match')}</p>
      <p className="mt-1.5 font-voz text-[clamp(28px,8vw,36px)] leading-[1.02]">{L('O fantasma te espera no túnel.', 'The ghost is waiting in the tunnel.')}</p>
      <p className="mt-2 text-[14px] leading-snug">
        {L('Vê teu time jogar do jeito que tu pediste e lavra a ata do clube.', 'Watch your team play the way you asked and draw up the club charter.')}
      </p>
      <Link
        to="/fundacao/estreia"
        className="mt-4 inline-flex min-h-[50px] items-center gap-2 bg-asfalto-27 px-5 font-impact text-[20px] uppercase leading-none text-rua transition-transform hover:-translate-y-0.5"
      >
        {L('Entrar em campo', 'Take the field')} <span aria-hidden>→</span>
      </Link>
    </section>
  );
}

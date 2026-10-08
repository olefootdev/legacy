/**
 * O slot de decisão da Home 2027 — UMA decisão por vez, no tom da rua.
 *
 * Prioridade: o jogador batendo na porta (muda relação, moral e obediência em
 * campo) > as pendências do elenco (suspenso, contrato, proposta). Sem nada
 * pra decidir, o slot some.
 *
 * A consequência mora no botão: os deltas vêm de `resolveRequest`, o mesmo
 * cálculo que o reducer aplica no RESOLVE_PLAYER_REQUEST.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SecaoRua } from '@/components/ui/Rua';
import {
  resolveRequest,
  type PlayerRequest,
  type PlayerRequestChoice,
  type PlayerRequestKind,
} from '@/systems/playerPersonality';
import { track } from '@/analytics/track';
import { L } from '@/i18n/L';
import { posLabel } from '@/components/matchquick/posLabel';

const KIND_TAG: Record<PlayerRequestKind, string> = {
  minutes: L('#minutos', '#minutes'),
  ambition: L('#ambição', '#ambition'),
  respect: '#status',
};

const CHOICE_SHORT: Record<PlayerRequestChoice, string> = {
  grant: L('Dar chance', 'Give a chance'),
  challenge: L('Cobrar', 'Demand more'),
  promise: L('Prometer', 'Promise'),
};

export interface RespostaDada {
  playerName: string;
  choice: PlayerRequestChoice;
  moralDelta: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]![0] ?? '' : '';
  return (first + last).toUpperCase();
}

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${Math.abs(delta)}`;
  return '±0';
}

function Escolha({
  label,
  delta,
  primaria,
  onClick,
  className,
}: {
  label: string;
  delta: number;
  primaria?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex min-h-[52px] min-w-0 items-center justify-center gap-2 px-4 font-impact text-[19px] uppercase leading-none transition-[transform,box-shadow,background-color,color] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rua',
        primaria
          ? 'bg-rua text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)]'
          : 'border-2 border-papel text-papel hover:bg-papel hover:text-asfalto-27',
        className,
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 font-prova text-[13px] font-bold">{formatDelta(delta)}</span>
    </button>
  );
}

export function Vestiario({
  request,
  player,
  answered,
  onChoose,
  suspendedCount,
  expiredCount,
  offersCount,
}: {
  request: PlayerRequest | null;
  player: { pos?: string; age?: number } | null;
  answered: RespostaDada | null;
  onChoose: (choice: PlayerRequestChoice) => void;
  suspendedCount: number;
  expiredCount: number;
  offersCount: number;
}) {
  useEffect(() => {
    if (request) track('request_shown', { kind: request.kind });
  }, [request?.id, request?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  if (request) {
    const meta = [player?.pos ? posLabel(player.pos) : null, player?.age != null ? String(player.age) : null, KIND_TAG[request.kind]]
      .filter(Boolean)
      .join(' · ');
    const choose = (c: PlayerRequestChoice) => {
      track('request_resolved', { kind: request.kind, choice: c });
      onChoose(c);
    };
    const d = (c: PlayerRequestChoice) => resolveRequest(request.kind, c).moralDelta;
    return (
      <section aria-label={L(`${request.playerName} quer conversar`, `${request.playerName} wants a word`)} className="flex flex-col gap-3">
        <SecaoRua label={L('O vestiário chama', 'The dressing room calls')} />
        <div className="flex flex-col gap-4 bg-concreto p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border-[3px] border-rua font-impact text-[19px] text-rua">
              {initials(request.playerName)}
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="block min-w-0 truncate font-voz text-[26px] leading-none text-papel">{request.playerName}</span>
              <span className="block min-w-0 truncate font-prova text-[12px] uppercase tracking-[0.08em] text-mudo">{meta}</span>
            </div>
          </div>
          <p className="border-l-[3px] border-fio pl-3 text-[18px] font-medium leading-[1.4] text-papel">“{request.quote}”</p>
          {/* Abaixo de 360px os três empilham: "Prometer +3" não cabe em meia largura. */}
          <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
            <Escolha primaria className="min-[360px]:col-span-2" label={CHOICE_SHORT.grant} delta={d('grant')} onClick={() => choose('grant')} />
            <Escolha label={CHOICE_SHORT.challenge} delta={d('challenge')} onClick={() => choose('challenge')} />
            <Escolha label={CHOICE_SHORT.promise} delta={d('promise')} onClick={() => choose('promise')} />
          </div>
        </div>
      </section>
    );
  }

  if (answered) {
    const up = answered.moralDelta >= 0;
    return (
      <section aria-label={L('Resposta ao vestiário', 'Dressing room reply')} className="flex flex-col gap-3">
        <SecaoRua label={L('O vestiário chama', 'The dressing room calls')} />
        <div className={cn('flex min-w-0 items-center gap-3 px-4 py-3', up ? 'bg-rua text-asfalto-27' : 'border-2 border-fio text-papel')}>
          <span aria-hidden className="font-impact text-[22px] leading-none">{up ? '✓' : '✕'}</span>
          <span className="block min-w-0 truncate font-voz text-[22px] leading-none">{answered.playerName}</span>
          <span className="ml-auto shrink-0 font-prova text-[13px] font-bold uppercase">
            {L('moral', 'morale')} {formatDelta(answered.moralDelta)}
          </span>
        </div>
      </section>
    );
  }

  const rows = [
    suspendedCount > 0 && {
      key: 'susp',
      text: L(`${suspendedCount} suspenso${suspendedCount > 1 ? 's' : ''}`, `${suspendedCount} suspended`),
      tag: L('#escalação', '#lineup'),
      cta: L('Escalar', 'Pick XI'),
      to: '/clube/elenco',
    },
    expiredCount > 0 && {
      key: 'contrato',
      text: L(
        `${expiredCount} contrato${expiredCount > 1 ? 's' : ''} vencido${expiredCount > 1 ? 's' : ''}`,
        `${expiredCount} contract${expiredCount > 1 ? 's' : ''} expired`,
      ),
      tag: L('#renovar', '#renew'),
      cta: L('Renovar', 'Renew'),
      to: '/clube/elenco',
    },
    offersCount > 0 && {
      key: 'ofertas',
      text: L(`${offersCount} proposta${offersCount > 1 ? 's' : ''}`, `${offersCount} offer${offersCount > 1 ? 's' : ''}`),
      tag: L('#mercado', '#market'),
      cta: L('Responder', 'Reply'),
      to: '/mercado/transfer',
    },
  ].filter(Boolean) as { key: string; text: string; tag: string; cta: string; to: string }[];

  if (rows.length === 0) return null;

  return (
    <section aria-label={L('Mesa do manager', 'Manager desk')} className="flex flex-col gap-3">
      <SecaoRua label={L('Mesa do manager', 'Manager desk')} aside={rows.length} />
      <ul className="bg-concreto">
        {rows.map((r) => (
          <li key={r.key} className="flex min-w-0 items-center gap-3 border-b border-linha px-4 py-3.5 last:border-b-0">
            <div className="flex min-w-0 grow flex-col gap-1">
              <span className="block min-w-0 truncate font-impact text-[22px] uppercase leading-none text-papel">{r.text}</span>
              <span className="block min-w-0 truncate font-prova text-[12px] text-mudo">{r.tag}</span>
            </div>
            <Link
              to={r.to}
              className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 border-2 border-rua px-3.5 font-impact text-[16px] uppercase leading-none text-rua transition-colors hover:bg-rua hover:text-asfalto-27"
            >
              {r.cta} <span aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

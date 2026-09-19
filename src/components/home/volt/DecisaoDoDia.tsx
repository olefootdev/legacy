/**
 * O slot de decisão da Home VOLT2 — UMA decisão por vez (A VIRADA · V4).
 *
 * Prioridade: o jogador batendo na porta (muda relação, moral e obediência em
 * campo) > as pendências do elenco (suspenso, contrato, proposta). Sem nada
 * pra decidir, o slot some — nada de "tudo em dia" ocupando a dobra.
 *
 * A consequência mora no botão: os deltas vêm de `resolveRequest`, o mesmo
 * cálculo que o reducer aplica no RESOLVE_PLAYER_REQUEST.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { BotaoConsequencia, Hashtag, SecaoVolt, UmaLinha } from '@/components/ui';
import {
  resolveRequest,
  type PlayerRequest,
  type PlayerRequestChoice,
  type PlayerRequestKind,
} from '@/systems/playerPersonality';
import { track } from '@/analytics/track';

const KIND_TAG: Record<PlayerRequestKind, string> = {
  minutes: '#minutos',
  ambition: '#ambição',
  respect: '#status',
};

const CHOICE_SHORT: Record<PlayerRequestChoice, string> = {
  grant: 'Dar chance',
  challenge: 'Cobrar',
  promise: 'Prometer',
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

export function DecisaoDoDia({
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
    const meta = [player?.pos, player?.age != null ? String(player.age) : null, KIND_TAG[request.kind]]
      .filter(Boolean)
      .join(' · ');
    const choose = (c: PlayerRequestChoice) => {
      track('request_resolved', { kind: request.kind, choice: c });
      onChoose(c);
    };
    const d = (c: PlayerRequestChoice) => resolveRequest(request.kind, c).moralDelta;
    return (
      <section aria-label={`${request.playerName} quer conversar`} className="flex flex-col gap-3">
        <SecaoVolt label="O vestiário chama" />
        <div className="flex flex-col gap-3.5 border border-white/10 bg-panel p-[18px]">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border-2 border-neon-yellow bg-card font-impact text-[18px] text-neon-yellow">
              {initials(request.playerName)}
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <UmaLinha className="text-[16px] font-bold text-white">{request.playerName}</UmaLinha>
              <Hashtag>{meta}</Hashtag>
            </div>
          </div>
          <p className="text-[19px] font-semibold leading-[1.35] text-white">{request.quote}</p>
          {/* Abaixo de 360px os três empilham: "Prometer +3" não cabe em meia largura. */}
          <div className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2">
            <BotaoConsequencia
              className="min-[360px]:col-span-2"
              label={CHOICE_SHORT.grant}
              delta={d('grant')}
              onClick={() => choose('grant')}
            />
            <BotaoConsequencia
              variant="secondary"
              label={CHOICE_SHORT.challenge}
              delta={d('challenge')}
              onClick={() => choose('challenge')}
            />
            <BotaoConsequencia
              variant="secondary"
              label={CHOICE_SHORT.promise}
              delta={d('promise')}
              onClick={() => choose('promise')}
            />
          </div>
        </div>
      </section>
    );
  }

  if (answered) {
    const up = answered.moralDelta >= 0;
    return (
      <section aria-label="Resposta ao vestiário" className="flex flex-col gap-3">
        <SecaoVolt label="O vestiário chama" />
        <div
          className={`flex min-w-0 items-center gap-3 border px-3.5 py-3 ${
            up ? 'border-alta/45 bg-alta/10' : 'border-baixa/45 bg-baixa/10'
          }`}
        >
          {up ? (
            <Check aria-hidden className="h-5 w-5 shrink-0 text-alta" strokeWidth={2.6} />
          ) : (
            <X aria-hidden className="h-5 w-5 shrink-0 text-baixa" strokeWidth={2.6} />
          )}
          <UmaLinha className="text-[14px] text-white">
            {answered.playerName} ·{' '}
            <span className={`font-mono font-semibold ${up ? 'text-alta' : 'text-baixa'}`}>
              moral {up ? '+' : '−'}
              {Math.abs(answered.moralDelta)}
            </span>
          </UmaLinha>
        </div>
      </section>
    );
  }

  const rows = [
    suspendedCount > 0 && {
      key: 'susp',
      text: `${suspendedCount} suspenso${suspendedCount > 1 ? 's' : ''}`,
      tag: '#escalação',
      cta: 'Escalar',
      to: '/clube/elenco',
    },
    expiredCount > 0 && {
      key: 'contrato',
      text: `${expiredCount} contrato${expiredCount > 1 ? 's' : ''} vencido${expiredCount > 1 ? 's' : ''}`,
      tag: '#renovar',
      cta: 'Renovar',
      to: '/clube/elenco',
    },
    offersCount > 0 && {
      key: 'ofertas',
      text: `${offersCount} proposta${offersCount > 1 ? 's' : ''}`,
      tag: '#mercado',
      cta: 'Responder',
      to: '/mercado/transfer',
    },
  ].filter(Boolean) as { key: string; text: string; tag: string; cta: string; to: string }[];

  if (rows.length === 0) return null;

  return (
    <section aria-label="Mesa do manager" className="flex flex-col gap-3">
      <SecaoVolt label="Mesa do manager" />
      <ul className="border border-white/10 bg-panel">
        {rows.map((r) => (
          <li key={r.key} className="flex min-w-0 items-center gap-3 border-b border-white/[0.06] px-4 py-3 last:border-b-0">
            <div className="flex min-w-0 grow flex-col gap-0.5">
              <UmaLinha className="text-[15px] font-bold text-white">{r.text}</UmaLinha>
              <Hashtag>{r.tag}</Hashtag>
            </div>
            <Link
              to={r.to}
              className="ole-num inline-flex h-10 shrink-0 items-center border border-white/30 px-3 text-[12px] uppercase text-white transition-colors hover:border-white"
            >
              {r.cta}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

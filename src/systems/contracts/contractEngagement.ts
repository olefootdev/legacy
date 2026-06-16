/**
 * Engajamento por contratos — ponte entre o vencimento de contrato e o manager.
 *
 * Os contratos foram criados pra trazer o manager de volta: contrato vencido
 * tira o jogador do XI (squadEligibility → 'contract') e, via sync, derruba o
 * available_player_count na Liga Global (→ WO se cair abaixo de 11). Este módulo
 * traduz esse estado em notificações de inbox acionáveis (nudge in-app).
 *
 * Funções puras (sem store/async) — fáceis de testar. A auto-renovação (que
 * precisa de OLEXP + dispatch) vive em useGlobalConsequencesSync.
 */
import { makeInboxItem } from '@/game/inboxItem';
import type { InboxItem } from '@/game/inboxTypes';
import type { PlayerEntity } from '@/entities/types';

/** Limiar de "contrato a vencer" — alerta antecipado antes do vencimento. */
export const CONTRACT_EXPIRING_SOON_GAMES = 10;

/** Deep-link pra ficha do jogador no elenco (Team lê ?player=<id>). */
export function contractDeepLink(playerId: string): string {
  return `/clube/elenco?player=${encodeURIComponent(playerId)}`;
}

/**
 * Mesma regra do reducer `RENEW_MANAGER_PROSPECT_CONTRACT`: quem pode renovar.
 * Vitalícios nunca vencem; prospects do manager e jogadores Genesis são renováveis.
 */
export function isRenewableContract(p: PlayerEntity): boolean {
  if (p.contractIsLifetime === true) return false;
  return p.managerCreated === true || p.genesisCatalogId != null;
}

/** Jogadores cujo contrato deve ser auto-renovado agora (opt-in + vencido). */
export function playersPendingAutoRenew(players: Record<string, PlayerEntity>): PlayerEntity[] {
  return Object.values(players).filter(
    (p) => p.autoRenewContract === true && p.contractExpired === true && isRenewableContract(p),
  );
}

/**
 * Itens de inbox pra contratos vencidos / a vencer, com dedupe por id estável
 * (não re-notifica o mesmo estado). Pula jogadores com auto-renovação ligada
 * (eles têm o próprio item) e os não-renováveis.
 */
export function buildContractNudges(
  players: Record<string, PlayerEntity>,
  existingInboxIds: Set<string>,
): InboxItem[] {
  const items: InboxItem[] = [];
  for (const p of Object.values(players)) {
    if (!isRenewableContract(p) || p.autoRenewContract === true) continue;

    if (p.contractExpired === true) {
      const id = `contract-expired-${p.id}`;
      if (existingInboxIds.has(id)) continue;
      items.push(
        makeInboxItem(id, 'PLAYER_CONTRACT', 'PLANTEL', `Contrato vencido — ${p.name}`, {
          body: `${p.name} está fora do XI oficial até renovar. Renove para voltar a escalar e evitar WO na Liga Global.`,
          deepLink: contractDeepLink(p.id),
          relatedPlayerIds: [p.id],
        }),
      );
      continue;
    }

    const rem = p.contractMatchesRemaining;
    if (typeof rem === 'number' && rem > 0 && rem <= CONTRACT_EXPIRING_SOON_GAMES) {
      const id = `contract-expiring-${p.id}`;
      if (existingInboxIds.has(id)) continue;
      items.push(
        makeInboxItem(id, 'PLAYER_CONTRACT', 'PLANTEL', `Contrato a vencer — ${p.name}`, {
          body: `Restam ${rem} ${rem === 1 ? 'jogo' : 'jogos'} no contrato de ${p.name}. Renove antes de vencer pra não perder o jogador.`,
          deepLink: contractDeepLink(p.id),
          relatedPlayerIds: [p.id],
        }),
      );
    }
  }
  return items;
}

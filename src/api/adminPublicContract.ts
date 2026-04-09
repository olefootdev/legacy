/**
 * Contrato de API pública (backend) consumida pelo cliente de jogo.
 * Implementação vive no serviço + Admin; este arquivo só tipa caminhos e respostas esperadas.
 */
import type {
  BroSpecialPlayerCreationLedger,
  PlayerFieldProfile,
  TacticalPattern,
} from '@/field-schema/adminArtifacts';
import type { FieldZoneCatalog } from '@/field-schema/catalogTypes';

export const ADMIN_API = {
  /** Catálogo de zonas versionado (CDN ou API) */
  fieldCatalog: (version: string) => `/api/v1/field-schema/${encodeURIComponent(version)}/catalog.json`,
  tacticalPattern: (id: string) => `/api/v1/tactical-patterns/${encodeURIComponent(id)}`,
  playerFieldProfile: (playerId: string) => `/api/v1/players/${encodeURIComponent(playerId)}/field-profile`,
  /** Staff only — não expor no build público do game */
  broSpecialPlayerCreate: () => `/internal/staff/bro/special-players`,
} as const;

export type GetFieldCatalogResponse = FieldZoneCatalog;
export type GetTacticalPatternResponse = TacticalPattern;
export type GetPlayerFieldProfileResponse = PlayerFieldProfile | null;
export type PostBroSpecialPlayerBody = {
  templatePlayerId?: string;
  displayName: string;
  priceBro: number;
  facilitatorId: string;
  fieldProfile: Omit<PlayerFieldProfile, 'playerId' | 'updatedAt'>;
};
export type PostBroSpecialPlayerResponse = {
  ledger: BroSpecialPlayerCreationLedger;
  playerId: string;
};

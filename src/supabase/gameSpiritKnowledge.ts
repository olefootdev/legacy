/**
 * Persistência da knowledge base do GameSpirit via platform_config.
 * Admin edita no painel, servidor Hono lê no startup.
 */
import { setPlatformConfig, fetchAllPlatformConfig } from './adminCore';
import type { GameSpiritKnowledgeRoot } from '@/gamespirit/admin/gameSpiritKnowledgeStore';

export const GAMESPIRIT_KNOWLEDGE_KEY = 'gamespirit_knowledge';

export async function saveGameSpiritKnowledge(kb: GameSpiritKnowledgeRoot): Promise<boolean> {
  return setPlatformConfig(GAMESPIRIT_KNOWLEDGE_KEY, kb as unknown as Record<string, unknown>);
}

export async function loadGameSpiritKnowledge(): Promise<GameSpiritKnowledgeRoot | null> {
  const raw = await fetchAllPlatformConfig();
  const val = raw[GAMESPIRIT_KNOWLEDGE_KEY];
  if (!val || typeof val !== 'object') return null;
  return val as GameSpiritKnowledgeRoot;
}

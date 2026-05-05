/**
 * Scheduler Server-Side da Liga Global
 *
 * Roda em loop no Railway a cada 10s. Gerencia o ciclo completo:
 *   scheduled → live (1min) → finished → próxima rodada no topo de 5min
 *
 * Cobre playoffs (status='playoffs') e liga oficial (status='active').
 * Persiste no Supabase após cada mudança — todos os clients recebem via Realtime.
 *
 * Single source of truth: este scheduler é AUTORITATIVO. O cliente
 * desativa o scheduler local quando o server está disponível.
 */
/** Inicia o loop do scheduler */
export declare function startGlobalLeagueScheduler(): void;

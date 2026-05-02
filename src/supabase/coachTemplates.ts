/**
 * Templates de Coach Agent criados pelo admin.
 * Managers podem escolher um no onboarding ou receber via admin.
 */
import { getSupabase, isSupabaseConfigured } from './client';
import type { CoachAgent } from '@/coach/types';

export async function saveCoachTemplate(coach: CoachAgent): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb
    .from('coach_templates')
    .upsert({ id: coach.id, coach: coach as unknown as Record<string, unknown> }, { onConflict: 'id' });
  if (error) { console.error('[coachTemplates] save falhou:', error.message); return false; }
  return true;
}

export async function removeCoachTemplate(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from('coach_templates').delete().eq('id', id);
  if (error) { console.error('[coachTemplates] remove falhou:', error.message); return false; }
  return true;
}

export async function loadCoachTemplates(): Promise<CoachAgent[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('coach_templates').select('coach').order('updated_at', { ascending: true });
  if (error) { console.warn('[coachTemplates] load falhou:', error.message); return []; }
  return (data ?? []).map((r) => r.coach as CoachAgent);
}

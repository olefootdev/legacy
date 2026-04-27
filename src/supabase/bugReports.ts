/**
 * Persistence helpers para `bug_reports`.
 * Submissão de bugs/feedback dos beta testers via UI.
 */
import { getSupabase } from './client';
import type { Database } from './database.types';

export type BugReportRow = Database['public']['Tables']['bug_reports']['Row'];
export type BugReportCategory = 'bug' | 'feedback' | 'suggestion' | 'crash' | 'ux';
export type BugReportSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SubmitBugReportInput {
  title: string;
  description: string;
  category?: BugReportCategory;
  severity?: BugReportSeverity;
  route?: string;
  attachments?: Array<{ name: string; url: string }>;
}

const APP_VERSION =
  (typeof import.meta !== 'undefined'
    ? (import.meta as unknown as { env: Record<string, string> }).env?.VITE_APP_VERSION
    : undefined) ?? 'dev';

export async function submitBugReport(input: SubmitBugReportInput): Promise<BugReportRow | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data: userData } = await sb.auth.getUser();
  const userId = userData?.user?.id ?? null;

  const route = input.route ?? (typeof window !== 'undefined' ? window.location.pathname : null);
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

  const { data, error } = await sb
    .from('bug_reports')
    .insert({
      user_id: userId,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category ?? 'bug',
      severity: input.severity ?? 'medium',
      route,
      user_agent: userAgent,
      app_version: APP_VERSION,
      attachments: input.attachments ?? [],
    })
    .select()
    .single();

  if (error) {
    console.warn('[bugReports] submit failed', error);
    return null;
  }
  return data;
}

export async function fetchMyBugReports(limit = 20): Promise<BugReportRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('bug_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[bugReports] fetch failed', error);
    return [];
  }
  return data ?? [];
}

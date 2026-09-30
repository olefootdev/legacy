/**
 * Client admin das licenças da expansão. Backend: server/src/routes/adminLicencas.ts.
 * Mesmo cabeçalho do resto do admin (X-Admin-Token + Bearer da sessão).
 */
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import { fail, headers } from '@/admin/adminPaymentsClient';

export type SituacaoLicenca = 'livre' | 'usada' | 'revogada' | 'expirada';

export interface LicencaAdmin {
  licenca_id: number;
  final: string;
  lote: string;
  patrocinador: string | null;
  expira_em: string | null;
  criada_por: string;
  criada_em: string;
  usada_por: string | null;
  usada_em: string | null;
  revogada_em: string | null;
  motivo_revogacao: string | null;
  situacao: SituacaoLicenca;
}

export interface CodigoGerado {
  licencaId: number;
  codigo: string;
}

export async function listarLicencas(): Promise<LicencaAdmin[]> {
  const r = await fetch(`${olefootApiBase()}/api/admin/licencas`, { headers: await headers() });
  if (!r.ok) return fail(r);
  return (await r.json()) as LicencaAdmin[];
}

export async function gerarLicencas(p: {
  quantidade: number;
  lote: string;
  patrocinador?: string;
  validadeDias?: number | null;
}): Promise<CodigoGerado[]> {
  const r = await fetch(`${olefootApiBase()}/api/admin/licencas`, {
    method: 'POST',
    headers: await headers(true),
    body: JSON.stringify(p),
  });
  if (!r.ok) return fail(r);
  return ((await r.json()) as { codigos: CodigoGerado[] }).codigos;
}

export async function revogarLicenca(id: number, motivo?: string): Promise<boolean> {
  const r = await fetch(`${olefootApiBase()}/api/admin/licencas/${id}/revogar`, {
    method: 'POST',
    headers: await headers(true),
    body: JSON.stringify({ motivo: motivo ?? '' }),
  });
  if (!r.ok) return fail(r);
  return ((await r.json()) as { ok: boolean }).ok;
}

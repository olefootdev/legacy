import { isoToFlag } from '@/lib/countryDialCodes';

/** ISO 3166-1 alpha-3 → alpha-2 (FIFA / dados legados). */
const ISO3_TO_ISO2: Record<string, string> = {
  ARG: 'AR',
  AUS: 'AU',
  AUT: 'AT',
  BEL: 'BE',
  BRA: 'BR',
  CAN: 'CA',
  CHI: 'CL',
  CHN: 'CN',
  COL: 'CO',
  CRC: 'CR',
  CRO: 'HR',
  CMR: 'CM',
  CIV: 'CI',
  DEN: 'DK',
  ECU: 'EC',
  EGY: 'EG',
  ENG: 'GB',
  ESP: 'ES',
  FRA: 'FR',
  GER: 'DE',
  GHA: 'GH',
  GRE: 'GR',
  HON: 'HN',
  ISL: 'IS',
  ITA: 'IT',
  JAM: 'JM',
  JPN: 'JP',
  KOR: 'KR',
  MAR: 'MA',
  MEX: 'MX',
  NED: 'NL',
  NGA: 'NG',
  NIR: 'GB',
  NOR: 'NO',
  NZL: 'NZ',
  PAR: 'PY',
  PER: 'PE',
  POL: 'PL',
  POR: 'PT',
  RSA: 'ZA',
  RUS: 'RU',
  SCO: 'GB',
  SEN: 'SN',
  SRB: 'RS',
  SUI: 'CH',
  SWE: 'SE',
  TUN: 'TN',
  TUR: 'TR',
  UKR: 'UA',
  URU: 'UY',
  USA: 'US',
  WAL: 'GB',
  ANG: 'AO',
  MOZ: 'MZ',
};

function normalizeCountryCode(raw: string): string {
  return raw.replace(/[\s\uFEFF]/g, '').toUpperCase();
}

/**
 * Converte código de país (ISO2, ISO3 comum ou já emoji) em bandeira regional.
 * Devolve string vazia se não for mapeável.
 */
export function countryCodeToFlagEmoji(raw: string | null | undefined): string {
  const s = normalizeCountryCode(raw ?? '');
  if (!s || s === '—' || s === '-' || s === '?') return '';
  if (s.length === 2 && /^[A-Z]{2}$/.test(s)) {
    return isoToFlag(s);
  }
  if (s.length === 3) {
    const iso2 = ISO3_TO_ISO2[s];
    if (iso2) return isoToFlag(iso2);
  }
  return '';
}

/** Texto de apoio (filtros, `title`, leitores de ecrã). */
export function countryCodeLabel(raw: string | null | undefined): string {
  const t = (raw ?? '').trim();
  return t && t !== '—' ? t : '';
}

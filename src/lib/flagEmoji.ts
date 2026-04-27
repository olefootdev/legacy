import { COUNTRY_DIAL_OPTIONS, isoToFlag } from '@/lib/countryDialCodes';

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

/**
 * Nomes em inglês / aliases usados em dados (ex. genesis_market_players.country)
 * e demónimos frequentes. Chaves devem ser o resultado de `normalizeCountryLabelKey`.
 */
const ENGLISH_NAME_TO_ISO2: Record<string, string> = {
  AFGHANISTAN: 'AF',
  ALBANIA: 'AL',
  ALGERIA: 'DZ',
  ANDORRA: 'AD',
  ANGOLA: 'AO',
  ARGENTINA: 'AR',
  ARMENIA: 'AM',
  AUSTRALIA: 'AU',
  AUSTRIA: 'AT',
  AZERBAIJAN: 'AZ',
  BELGIUM: 'BE',
  BOLIVIA: 'BO',
  'BOSNIA AND HERZEGOVINA': 'BA',
  BOTSWANA: 'BW',
  BRAZIL: 'BR',
  BULGARIA: 'BG',
  CAMEROON: 'CM',
  CANADA: 'CA',
  CHILE: 'CL',
  CHINA: 'CN',
  COLOMBIA: 'CO',
  'COSTA RICA': 'CR',
  CROATIA: 'HR',
  CUBA: 'CU',
  CYPRUS: 'CY',
  'CZECH REPUBLIC': 'CZ',
  CZECHIA: 'CZ',
  DENMARK: 'DK',
  ECUADOR: 'EC',
  EGYPT: 'EG',
  ENGLAND: 'GB',
  ESTONIA: 'EE',
  ETHIOPIA: 'ET',
  FINLAND: 'FI',
  FRANCE: 'FR',
  GERMANY: 'DE',
  GHANA: 'GH',
  GREECE: 'GR',
  GUATEMALA: 'GT',
  HAITI: 'HT',
  HONDURAS: 'HN',
  HUNGARY: 'HU',
  ICELAND: 'IS',
  INDIA: 'IN',
  INDONESIA: 'ID',
  IRAN: 'IR',
  IRAQ: 'IQ',
  IRELAND: 'IE',
  ISRAEL: 'IL',
  ITALY: 'IT',
  'IVORY COAST': 'CI',
  JAMAICA: 'JM',
  JAPAN: 'JP',
  JORDAN: 'JO',
  KAZAKHSTAN: 'KZ',
  KENYA: 'KE',
  KOSOVO: 'XK',
  LATVIA: 'LV',
  LEBANON: 'LB',
  LIBERIA: 'LR',
  LITHUANIA: 'LT',
  LUXEMBOURG: 'LU',
  MALAYSIA: 'MY',
  MALI: 'ML',
  MALTA: 'MT',
  MEXICO: 'MX',
  MOLDOVA: 'MD',
  MONTENEGRO: 'ME',
  MOROCCO: 'MA',
  NETHERLANDS: 'NL',
  'NEW ZEALAND': 'NZ',
  NICARAGUA: 'NI',
  NIGERIA: 'NG',
  'NORTH MACEDONIA': 'MK',
  NORWAY: 'NO',
  OMAN: 'OM',
  PAKISTAN: 'PK',
  PANAMA: 'PA',
  PARAGUAY: 'PY',
  PERU: 'PE',
  POLAND: 'PL',
  PORTUGAL: 'PT',
  QATAR: 'QA',
  ROMANIA: 'RO',
  RUSSIA: 'RU',
  /** Demónimo / erro comum em planilhas (ex. Genesis). */
  RUSSIAN: 'RU',
  'SAUDI ARABIA': 'SA',
  SCOTLAND: 'GB',
  SENEGAL: 'SN',
  SERBIA: 'RS',
  SLOVAKIA: 'SK',
  SLOVENIA: 'SI',
  'SOUTH AFRICA': 'ZA',
  'SOUTH KOREA': 'KR',
  SPAIN: 'ES',
  SWEDEN: 'SE',
  SWITZERLAND: 'CH',
  SYRIA: 'SY',
  TUNISIA: 'TN',
  TURKEY: 'TR',
  UGANDA: 'UG',
  UKRAINE: 'UA',
  URUGUAY: 'UY',
  USA: 'US',
  'UNITED STATES': 'US',
  'UNITED STATES OF AMERICA': 'US',
  UZBEKISTAN: 'UZ',
  VENEZUELA: 'VE',
  VIETNAM: 'VN',
  WALES: 'GB',
  ZAMBIA: 'ZM',
  ZIMBABWE: 'ZW',
 /** genesis CSV (PT sem entrada só em inglês). */
  GANA: 'GH',
};

function normalizeCountryCode(raw: string): string {
  return raw.replace(/[\s\uFEFF]/g, '').toUpperCase();
}

/** Chave estável para nomes de país (acentos removidos, maiúsculas). */
function normalizeCountryLabelKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s\uFEFF]+/g, ' ')
    .trim()
    .toUpperCase();
}

function buildLabelToIso2(): Record<string, string> {
  const out: Record<string, string> = { ...ENGLISH_NAME_TO_ISO2 };
  for (const o of COUNTRY_DIAL_OPTIONS) {
    if (o.iso2 === 'OTHER') continue;
    out[normalizeCountryLabelKey(o.name)] = o.iso2;
  }
  return out;
}

const LABEL_TO_ISO2 = buildLabelToIso2();

/**
 * Converte código de país (ISO2, ISO3 FIFA, nome EN/PT ou alias) em bandeira regional.
 * Devolve string vazia se não for mapeável.
 */
export function countryCodeToFlagEmoji(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed || trimmed === '—' || trimmed === '-' || trimmed === '?') return '';
  const compact = normalizeCountryCode(trimmed);
  if (compact.length === 2 && /^[A-Z]{2}$/.test(compact)) {
    return isoToFlag(compact);
  }
  if (compact.length === 3) {
    const iso2 = ISO3_TO_ISO2[compact];
    if (iso2) return isoToFlag(iso2);
  }
  const labelKey = normalizeCountryLabelKey(trimmed);
  const fromLabel = LABEL_TO_ISO2[labelKey];
  if (fromLabel) return isoToFlag(fromLabel);
  return '';
}

/** Texto de apoio (filtros, `title`, leitores de ecrã). */
export function countryCodeLabel(raw: string | null | undefined): string {
  const t = (raw ?? '').trim();
  return t && t !== '—' ? t : '';
}

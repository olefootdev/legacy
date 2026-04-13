/**
 * Reserva de nomes para prospects da Academia OLE (cartas fictícias).
 * Bloqueia combinações e tokens muito específicos; não bloqueia nomes comuns isolados (ex.: RONALDO, CRISTIANO).
 */

const STRIP_DIACRITICS = /\p{M}/gu;

export function normalizeAcademyProspectName(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(STRIP_DIACRITICS, '')
    .replace(/'/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeAcademyProspectName(normalized: string): string[] {
  return normalized.split(' ').filter(Boolean);
}

/** Nome completo normalizado = bloqueio directo. */
const BLOCKED_FULL_NAMES = new Set<string>([
  'CRISTIANO RONALDO',
  'LIONEL MESSI',
  'LEO MESSI',
  'LIONEL ANDRES MESSI',
  'NEYMAR JR',
  'NEYMAR JUNIOR',
  'NEYMAR DA SILVA SANTOS JUNIOR',
  'KYLIAN MBAPPE',
  'ERLING HAALAND',
  'MOHAMED SALAH',
  'ROBERT LEWANDOWSKI',
  'KARIM BENZEMA',
  'LUKA MODRIC',
  'JUDE BELLINGHAM',
  'HARRY KANE',
  'HEUNG MIN SON',
  'SON HEUNG MIN',
  'MANUEL NEUER',
  'VIRGIL VAN DIJK',
  'KEVIN DE BRUYNE',
  'ZINEDINE ZIDANE',
  'ANDRES INIESTA',
  'SERGIO RAMOS',
  'IKER CASILLAS',
  'DAVID BECKHAM',
  'WAYNE ROONEY',
  'ZLATAN IBRAHIMOVIC',
  'PAUL POGBA',
  'GARETH BALE',
  'LUIS SUAREZ',
  'EDEN HAZARD',
  'TONI KROOS',
  'MARCO REUS',
  'THOMAS MULLER',
  'PHIL FODEN',
  'JAMAL MUSIALA',
  'LAMINE YAMAL',
  'VINICIUS JR',
  'VINICIUS JUNIOR',
  'NGOLO KANTE',
]);

/**
 * Tokens que não podem aparecer como palavra isolada no nome (match exact por token).
 * Evita sobrenomes comuns sozinhos (ex.: MULLER, HAZARD); combinações vão em FORBIDDEN_PAIRS ou FULL.
 */
const FORBIDDEN_TOKENS = new Set<string>([
  'NEYMAR',
  'MESSI',
  'RONALDINHO',
  'PELE',
  'YAMAL',
  'PEDRI',
  'IBRAHIMOVIC',
]);

/**
 * Ambos os tokens têm de existir (qualquer ordem).
 * Ex.: CRISTIANO + RONALDO sem bloquear só "RONALDO".
 */
const FORBIDDEN_PAIRS: readonly [string, string][] = [
  ['CRISTIANO', 'RONALDO'],
  ['LIONEL', 'MESSI'],
  ['LEO', 'MESSI'],
  ['KYLIAN', 'MBAPPE'],
  ['ERLING', 'HAALAND'],
  ['MOHAMED', 'SALAH'],
  ['ROBERT', 'LEWANDOWSKI'],
  ['KARIM', 'BENZEMA'],
  ['LUKA', 'MODRIC'],
  ['JUDE', 'BELLINGHAM'],
  ['HARRY', 'KANE'],
  ['HEUNG', 'MIN'],
  ['SON', 'HEUNG'],
  ['MANUEL', 'NEUER'],
  ['VIRGIL', 'DIJK'],
  ['KEVIN', 'BRUYNE'],
  ['ZINEDINE', 'ZIDANE'],
  ['ANDRES', 'INIESTA'],
  ['SERGIO', 'RAMOS'],
  ['IKER', 'CASILLAS'],
  ['DAVID', 'BECKHAM'],
  ['WAYNE', 'ROONEY'],
  ['ZLATAN', 'IBRAHIMOVIC'],
  ['PAUL', 'POGBA'],
  ['GARETH', 'BALE'],
  ['LUIS', 'SUAREZ'],
  ['EDEN', 'HAZARD'],
  ['TONI', 'KROOS'],
  ['MARCO', 'REUS'],
  ['THOMAS', 'MULLER'],
  ['PHIL', 'FODEN'],
  ['JAMAL', 'MUSIALA'],
  ['LAMINE', 'YAMAL'],
  ['VINICIUS', 'JR'],
  ['VINICIUS', 'JUNIOR'],
  ['NGOLO', 'KANTE'],
];

export type AcademyProspectNameValidation =
  | { ok: true }
  | { ok: false; reason: string };

export function validateAcademyProspectName(rawName: string): AcademyProspectNameValidation {
  const normalized = normalizeAcademyProspectName(rawName);
  if (normalized.length < 2) return { ok: true };

  if (BLOCKED_FULL_NAMES.has(normalized)) {
    return {
      ok: false,
      reason: 'Esse nome no cartão está reservado. Escolhe outro.',
    };
  }

  const tokens = tokenizeAcademyProspectName(normalized);
  const tokenSet = new Set(tokens);

  for (const t of tokens) {
    if (FORBIDDEN_TOKENS.has(t)) {
      return {
        ok: false,
        reason: 'Há uma palavra reservada no nome. Troca o nome no cartão.',
      };
    }
  }

  for (const [a, b] of FORBIDDEN_PAIRS) {
    if (tokenSet.has(a) && tokenSet.has(b)) {
      return {
        ok: false,
        reason: 'Essa combinação no cartão está reservada. Usa outro nome.',
      };
    }
  }

  return { ok: true };
}

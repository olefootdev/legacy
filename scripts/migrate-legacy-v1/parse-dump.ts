/**
 * Olefoot v1 → v11 — Parser do dump MySQL antigo.
 *
 * Lê `supabase/olefoot_2025-09-11_00-00-07_mysql_data.sql`, extrai os 168 users
 * e normaliza pra JSON consumível pelo migrator + snapshot on-chain.
 *
 * USO:
 *   tsx scripts/migrate-legacy-v1/parse-dump.ts
 *
 * Saída:
 *   scripts/migrate-legacy-v1/data/legacy-users.json
 *   stats no stdout (contagem, distribuição de status, bcrypt valido, wallets, etc.)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DUMP_PATH = resolve(
  HERE,
  '../../supabase/olefoot_2025-09-11_00-00-07_mysql_data.sql',
);
const OUT_PATH = resolve(HERE, 'data/legacy-users.json');

/** Schema do `users` no dump (ordem dos campos no CREATE TABLE). */
const USER_COLUMNS = [
  'id',
  'name',
  'email',
  'whatsapp',
  'telegram',
  'status',
  'password',
  'birthdate',
  'favorite_team',
  'sponsor_id',
  'ancestry',
  'created_at',
  'updated_at',
  'verified_at',
  'profile_type_id',
  'profile_data',
  'style_type_id',
  'userStyleTypeId',
  'wallet_address',
  'wallet_nmemonic',
  'rating_data',
  'avatar_url',
  'username',
  'ancestry_level',
  'avatar_data',
  'security_code',
  'encrypted_private_key',
] as const;

type RawValue = string | number | null;

/**
 * Tokenizer para uma linha de VALUES do mysqldump.
 * Lê: NULL, números, strings entre 'aspas' com escapes `\'`, `\\`, `\n`, `\r`, `\t`, `\"`, `\0`.
 * Ignora vírgulas separadoras e o paren de abertura/fechamento.
 */
function parseValuesLine(line: string): RawValue[] {
  let trimmed = line.trimStart();
  // Cada row começa com `(` e termina com `)` ou `),`
  if (!trimmed.startsWith('(')) {
    throw new Error(`Expected '(' at start of values line: ${line.slice(0, 80)}`);
  }
  let i = 1;
  const out: RawValue[] = [];
  const len = trimmed.length;

  const readString = (): string => {
    // assume trimmed[i] === "'"
    i++; // skip opening quote
    let buf = '';
    while (i < len) {
      const ch = trimmed[i];
      if (ch === '\\') {
        const next = trimmed[i + 1];
        if (next === 'n') buf += '\n';
        else if (next === 'r') buf += '\r';
        else if (next === 't') buf += '\t';
        else if (next === '0') buf += '\0';
        else if (next === '\\') buf += '\\';
        else if (next === "'") buf += "'";
        else if (next === '"') buf += '"';
        else buf += next;
        i += 2;
        continue;
      }
      if (ch === "'") {
        i++;
        return buf;
      }
      buf += ch;
      i++;
    }
    throw new Error('Unterminated string in values line');
  };

  const readBare = (): RawValue => {
    let buf = '';
    while (i < len && trimmed[i] !== ',' && trimmed[i] !== ')') {
      buf += trimmed[i];
      i++;
    }
    const t = buf.trim();
    if (t === 'NULL' || t === 'null') return null;
    // tenta number
    if (/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(t)) return Number(t);
    return t;
  };

  while (i < len) {
    // skip whitespace
    while (i < len && (trimmed[i] === ' ' || trimmed[i] === '\t')) i++;
    if (trimmed[i] === ')') {
      i++;
      break;
    }
    if (trimmed[i] === "'") {
      out.push(readString());
    } else {
      out.push(readBare());
    }
    // pula vírgula
    while (i < len && (trimmed[i] === ' ' || trimmed[i] === '\t')) i++;
    if (trimmed[i] === ',') {
      i++;
      continue;
    }
    if (trimmed[i] === ')') {
      i++;
      break;
    }
  }
  return out;
}

/** Bcrypt do Supabase Auth — versões aceitas: $2a$, $2b$, $2y$. */
function isValidBcrypt(hash: unknown): hash is string {
  return typeof hash === 'string' && /^\$2[aby]\$\d{2}\$.{53}$/.test(hash);
}

interface LegacyUser {
  legacy_id: number;
  email: string;
  name: string;
  whatsapp: string | null;
  telegram: string | null;
  status: string;
  bcrypt_hash: string;
  bcrypt_valid: boolean;
  birthdate: string | null;
  favorite_team: string | null;
  sponsor_id: number | null;
  username: string | null;
  wallet_address: string | null;
  avatar_url: string | null;
  created_at: string | null;
}

async function main() {
  console.log(`Lendo dump: ${DUMP_PATH}`);
  const sql = await readFile(DUMP_PATH, 'utf8');
  const lines = sql.split('\n');

  // Acha a primeira linha após `INSERT INTO \`users\` VALUES` e coleta até `;`.
  let insertStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('INSERT INTO `users` VALUES')) {
      insertStart = i + 1;
      break;
    }
  }
  if (insertStart === -1) throw new Error('INSERT INTO users não encontrado');

  const valueLines: string[] = [];
  for (let i = insertStart; i < lines.length; i++) {
    const ln = lines[i];
    if (ln.startsWith('(')) valueLines.push(ln.replace(/,\s*$/, '').replace(/;\s*$/, ''));
    if (ln.includes('UNLOCK TABLES') || (ln.trim() === '' && valueLines.length > 0)) break;
  }
  console.log(`Linhas de VALUES coletadas: ${valueLines.length}`);

  const users: LegacyUser[] = [];
  const skipped: { line: number; reason: string }[] = [];

  for (let idx = 0; idx < valueLines.length; idx++) {
    const raw = valueLines[idx];
    let values: RawValue[];
    try {
      values = parseValuesLine(raw);
    } catch (e) {
      skipped.push({ line: idx, reason: `parse: ${(e as Error).message}` });
      continue;
    }
    if (values.length !== USER_COLUMNS.length) {
      skipped.push({
        line: idx,
        reason: `coluna count: ${values.length} != ${USER_COLUMNS.length}`,
      });
      continue;
    }
    const get = <T = RawValue>(col: (typeof USER_COLUMNS)[number]): T => {
      const i = USER_COLUMNS.indexOf(col);
      return values[i] as T;
    };

    const email = get<string | null>('email');
    const password = get<string | null>('password');
    if (!email) {
      skipped.push({ line: idx, reason: 'email vazio' });
      continue;
    }

    users.push({
      legacy_id: get<number>('id'),
      email: email.toLowerCase().trim(),
      name: (get<string | null>('name') ?? '').trim(),
      whatsapp: get<string | null>('whatsapp'),
      telegram: get<string | null>('telegram'),
      status: (get<string | null>('status') ?? 'UNKNOWN') as string,
      bcrypt_hash: password ?? '',
      bcrypt_valid: isValidBcrypt(password),
      birthdate: get<string | null>('birthdate'),
      favorite_team: get<string | null>('favorite_team'),
      sponsor_id: get<number | null>('sponsor_id'),
      username: get<string | null>('username'),
      wallet_address: get<string | null>('wallet_address'),
      avatar_url: get<string | null>('avatar_url'),
      created_at: get<string | null>('created_at'),
    });
  }

  // Stats
  const statusCount: Record<string, number> = {};
  const favCount: Record<string, number> = {};
  let withWallet = 0;
  let withBcrypt = 0;
  let withFav = 0;
  const seenEmails = new Set<string>();
  const dupEmails: string[] = [];
  for (const u of users) {
    statusCount[u.status] = (statusCount[u.status] ?? 0) + 1;
    if (u.bcrypt_valid) withBcrypt++;
    if (u.wallet_address) withWallet++;
    if (u.favorite_team) {
      withFav++;
      favCount[u.favorite_team] = (favCount[u.favorite_team] ?? 0) + 1;
    }
    if (seenEmails.has(u.email)) dupEmails.push(u.email);
    seenEmails.add(u.email);
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(users, null, 2));

  console.log('\n=== STATS ===');
  console.log(`Total users parseados: ${users.length}`);
  console.log(`Skipped: ${skipped.length}`);
  if (skipped.length) console.log(skipped.slice(0, 5));
  console.log(`Bcrypt válido: ${withBcrypt}/${users.length}`);
  console.log(`Com wallet_address: ${withWallet}/${users.length}`);
  console.log(`Com favorite_team: ${withFav}/${users.length}`);
  console.log(`Emails únicos: ${seenEmails.size}, duplicados: ${dupEmails.length}`);
  if (dupEmails.length) console.log(`Dup emails:`, dupEmails);
  console.log('\nStatus distribution:');
  for (const [k, v] of Object.entries(statusCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
  console.log('\nTop 10 favorite teams:');
  for (const [k, v] of Object.entries(favCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(`\n✓ JSON salvo em: ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

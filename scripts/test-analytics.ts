/**
 * Self-test: TELEMETRIA DE PRODUTO.
 *
 * Duas famílias de garantia, e a segunda é a que importa mais:
 *
 *  1. CONTRATO — `track` nunca lança, nunca bloqueia, respeita o teto da fila
 *     e vira no-op sem Supabase. Telemetria que derruba tela é pior que
 *     telemetria nenhuma.
 *
 *  2. PII — nenhum ponto de chamada manda nome, e-mail, telefone ou código de
 *     indicação em `props`. O projeto já vazou e-mail DUAS vezes (a API de
 *     profiles e a liga). Esta varredura é estática de propósito: ela pega o
 *     erro no commit, não no banco.
 *
 * Uso: npm run test:analytics
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { track, flush, __resetForTests } from '../src/analytics/track';

let fail = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(ok ? `  ✅ ${label}` : `  ❌ ${label} ${detail}`);
  if (!ok) fail++;
};

// ── Varredura dos arquivos ────────────────────────────────────────────────
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = walk('src');
const CALL_RE = /\btrack\(\s*'([a-z_]+)'\s*(?:,\s*(\{[\s\S]*?\})\s*)?\)/g;

interface CallSite { file: string; event: string; props: string; }
const callSites: CallSite[] = [];
for (const f of files) {
  if (f.endsWith('analytics/track.ts')) continue;
  const src = readFileSync(f, 'utf8');
  if (!src.includes("from '@/analytics/track'")) continue;
  for (const m of src.matchAll(CALL_RE)) {
    callSites.push({ file: f, event: m[1]!, props: m[2] ?? '{}' });
  }
}

console.log('\n📊 TELEMETRIA DE PRODUTO\n');

// ── 1) Cobertura: os 8 eventos das 4 fases estão ligados ─────────────────
{
  const DECLARED = readFileSync('src/analytics/track.ts', 'utf8')
    .match(/export type ProductEvent =([\s\S]*?);/)?.[1] ?? '';
  const declared = [...DECLARED.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);

  check('a união declara 8 eventos', declared.length === 8, `${declared.length}: ${declared.join(', ')}`);
  check('há pontos de chamada', callSites.length > 0, `${callSites.length}`);

  const used = new Set(callSites.map((c) => c.event));
  const semUso = declared.filter((d) => !used.has(d));
  check('nenhum evento declarado ficou sem ponto de chamada', semUso.length === 0, semUso.join(', '));

  const naoDeclarados = [...used].filter((u) => !declared.includes(u));
  check('nenhum ponto de chamada usa evento fora da união', naoDeclarados.length === 0, naoDeclarados.join(', '));

  // As duas perguntas que motivaram tudo precisam de numerador E denominador.
  check('moment tem detectado E compartilhado', used.has('moment_detected') && used.has('moment_shared'));
  check('pedido tem mostrado E respondido', used.has('request_shown') && used.has('request_resolved'));
}

// ── 2) 🔴 PII: a varredura que existe por causa de dois vazamentos ───────
{
  const PROIBIDO = [
    'name', 'nome', 'email', 'e_mail', 'mail',
    'phone', 'telefone', 'whatsapp',
    'referral', 'referralcode', 'codigo', 'handle', 'username',
    'club', 'clubname', 'playername', 'manager', 'managerid',
  ];
  const ofensores: string[] = [];
  for (const c of callSites) {
    // chaves do objeto literal de props
    for (const km of c.props.matchAll(/(?:^|[{,\s])([A-Za-z_][A-Za-z0-9_]*)\s*:/g)) {
      const key = km[1]!.toLowerCase();
      if (PROIBIDO.includes(key)) ofensores.push(`${c.file} → ${c.event}.${km[1]}`);
    }
  }
  check('nenhuma prop com cara de PII nos pontos de chamada',
    ofensores.length === 0, '\n     ' + ofensores.join('\n     '));

  // Props devem ser escalares. String livre é onde PII entra sem pedir licença.
  const templates: string[] = [];
  for (const c of callSites) {
    if (/`|\.name\b|\.email\b/.test(c.props)) templates.push(`${c.file} → ${c.event}`);
  }
  check('nenhuma prop interpola string livre',
    templates.length === 0, templates.join(', '));
}

// ── 3) Contrato de runtime ────────────────────────────────────────────────
{
  __resetForTests();

  let threw = false;
  try {
    track('pulse_seen', { value: 84, band: 'fire', trend: 'up', drivers: 3 });
    track('request_resolved', { kind: 'minutes', choice: 'grant' });
    // Entradas hostis não podem derrubar quem chamou.
    track('home_mode', { mode: null });
    track('focus_chosen', {} as never);
    track('moment_shared', { tier: NaN, result: 'shared' });
  } catch { threw = true; }
  check('track nunca lança', threw === false);

  let flushThrew = false;
  try { await flush(); } catch { flushThrew = true; }
  check('flush nunca lança (sem sessão)', flushThrew === false);

  // Teto da fila: sessão longa offline não vira vazamento de memória.
  __resetForTests();
  for (let i = 0; i < 500; i++) track('pulse_seen', { value: i });
  const { queued } = __resetForTests();
  check('a fila respeita o teto', queued <= 60, `${queued} enfileirados`);
}

// ── 4) O nome não colide com o contador de missões ───────────────────────
{
  const missionUsers = files.filter((f) => readFileSync(f, 'utf8').includes('trackMissionEvent'));
  const bothInSameFile = missionUsers.filter((f) => {
    const src = readFileSync(f, 'utf8');
    return src.includes("from '@/analytics/track'");
  });
  // Não é erro coexistirem, mas se coexistirem o risco de trocar um pelo
  // outro é real — este check existe pra que a coexistência seja consciente.
  check('coexistência missões × produto é conhecida e pequena',
    bothInSameFile.length <= 2,
    bothInSameFile.join(', '));
}

console.log(fail === 0 ? '\n✅ TUDO VERDE\n' : `\n❌ ${fail} FALHA(S)\n`);
process.exit(fail === 0 ? 0 : 1);

/**
 * Agente de pesquisa de craques (gacha de época).
 *
 * Dado (posição, ano, raridade), produz um TEMPLATE de atributos Olefoot a
 * partir de PESQUISA PÚBLICA — nunca copiando números de fonte licenciada
 * (FIFA/EA). Os 10 atributos são DERIVADOS pela metodologia Olefoot a partir
 * de descrição qualitativa pública, e escalados pra banda de OVR da raridade.
 *
 * Pipeline:
 *   1) Pesquisa (web search) → nomeia um craque real do calibre + dossiê do ano.
 *   2) Scoring por rubrica   → 10 atributos refletindo o perfil (shape).
 *   3) Verificação adversarial → coerência com a posição; ajusta se preciso.
 *   + escala pro alvo de OVR dentro da banda da raridade.
 *
 * Fallback: se a web search falhar/indisponível, cai pra conhecimento do
 * modelo (marca em `sources`) — degrada veracidade mas não quebra.
 */

import Anthropic from '@anthropic-ai/sdk';
import { callAnthropic, hasAnthropicKey, jsonSystemPrompt, MODELS } from '../../lib/anthropic.js';

export const METHODOLOGY_VERSION = 'v1';

export const ATTR_KEYS = [
  'passe', 'marcacao', 'velocidade', 'drible', 'finalizacao',
  'fisico', 'tatico', 'mentalidade', 'confianca', 'fairPlay',
] as const;
export type AttrKey = (typeof ATTR_KEYS)[number];
export type Attributes = Record<AttrKey, number>;

/**
 * Pesos do OVR POR POSIÇÃO — espelho de `src/entities/ovrWeights.ts`. O server
 * tem rootDir próprio e não importa de `src/`: se mudar lá, mude aqui.
 * O NEUTRO só entra quando a posição é desconhecida.
 */
const UNIVERSAL = { mentalidade: 0.08, confianca: 0.08, fairPlay: 0.06 } as const;
const OVR_BY_POS: Record<string, Attributes> = {
  GOL: { passe: 0.06, marcacao: 0.18, velocidade: 0.06, drible: 0.04, finalizacao: 0.02, fisico: 0.22, tatico: 0.20, ...UNIVERSAL },
  ZAG: { passe: 0.08, marcacao: 0.24, velocidade: 0.07, drible: 0.02, finalizacao: 0.01, fisico: 0.18, tatico: 0.18, ...UNIVERSAL },
  LE:  { passe: 0.10, marcacao: 0.17, velocidade: 0.18, drible: 0.10, finalizacao: 0.01, fisico: 0.14, tatico: 0.08, ...UNIVERSAL },
  LD:  { passe: 0.10, marcacao: 0.17, velocidade: 0.18, drible: 0.10, finalizacao: 0.01, fisico: 0.14, tatico: 0.08, ...UNIVERSAL },
  VOL: { passe: 0.16, marcacao: 0.22, velocidade: 0.05, drible: 0.02, finalizacao: 0.01, fisico: 0.14, tatico: 0.18, ...UNIVERSAL },
  MC:  { passe: 0.20, marcacao: 0.13, velocidade: 0.08, drible: 0.05, finalizacao: 0.02, fisico: 0.11, tatico: 0.19, ...UNIVERSAL },
  MEI: { passe: 0.24, marcacao: 0.02, velocidade: 0.08, drible: 0.15, finalizacao: 0.12, fisico: 0.03, tatico: 0.14, ...UNIVERSAL },
  PE:  { passe: 0.13, marcacao: 0.01, velocidade: 0.22, drible: 0.20, finalizacao: 0.12, fisico: 0.06, tatico: 0.04, ...UNIVERSAL },
  PD:  { passe: 0.13, marcacao: 0.01, velocidade: 0.22, drible: 0.20, finalizacao: 0.12, fisico: 0.06, tatico: 0.04, ...UNIVERSAL },
  ATA: { passe: 0.05, marcacao: 0.01, velocidade: 0.16, drible: 0.13, finalizacao: 0.30, fisico: 0.09, tatico: 0.04, ...UNIVERSAL },
};
const OVR_WEIGHTS: Attributes = {
  passe: 0.12, marcacao: 0.1, velocidade: 0.12, drible: 0.1, finalizacao: 0.12,
  fisico: 0.1, tatico: 0.12, mentalidade: 0.08, confianca: 0.08, fairPlay: 0.06,
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function computeOverall(a: Attributes, pos?: string | null): number {
  const weights = (pos && OVR_BY_POS[pos.trim().toUpperCase()]) || OVR_WEIGHTS;
  let w = 0;
  for (const k of ATTR_KEYS) w += (a[k] ?? 0) * weights[k];
  return Math.round(clamp(w, 40, 99));
}

/** Escala os atributos (mantendo o shape) pra que o OVR ponderado ≈ alvo. */
function scaleToTarget(a: Attributes, targetOverall: number, pos?: string): Attributes {
  const current = computeOverall(a, pos);
  if (current <= 0) return a;
  const factor = targetOverall / current;
  const out = {} as Attributes;
  for (const k of ATTR_KEYS) out[k] = Math.round(clamp((a[k] ?? 50) * factor, 1, 99));
  return out;
}

function slugify(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const RARITY_LABEL: Record<string, string> = {
  normal: 'profissional comum (divisões menores / pouco renome)',
  premium: 'profissional sólido de meio de tabela',
  gold: 'destaque nacional / artilheiro reconhecido',
  rare: 'estrela de grande clube / seleção',
  legend: 'lenda no auge, craque histórico mundial',
};

export interface LegendTemplate {
  playerName: string;
  playerSlug: string;
  attributes: Attributes;
  overall: number;
  bioSnippet: string;
  sources: string[];
  methodologyVer: string;
  usedWebSearch: boolean;
}

export interface ResearchParams {
  position: string;
  year: number;
  rarityTier: string;
  ovrFloor: number;
  ovrCeiling: number;
}

type ResearchResult = { ok: true; template: LegendTemplate } | { ok: false; error: string };

/**
 * Passo 1 — pesquisa com web search. Retorna dossiê textual + nome + fontes.
 * Fallback p/ conhecimento do modelo se a tool falhar.
 */
async function researchDossier(
  p: ResearchParams,
): Promise<{ dossier: string; sources: string[]; usedWebSearch: boolean }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const calibre = RARITY_LABEL[p.rarityTier] ?? p.rarityTier;
  const prompt = [
    `Tarefa: identificar UM jogador de futebol REAL de calibre "${calibre}"`,
    `que atuou na posição ${p.position} por volta do ano ${p.year}, e montar um`,
    `dossiê do desempenho dele NAQUELE ano específico.`,
    '',
    'Use web search para confirmar veracidade (Wikipedia, Transfermarkt,',
    'notícias da época). Para calibres menores (normal/premium), pode ser um',
    'jogador obscuro de divisões inferiores — pesquise elencos reais do ano.',
    '',
    'Escreva um dossiê curto cobrindo: clube no ano, estilo de jogo, pontos',
    'fortes e fracos, físico, mentalidade/disciplina. NÃO invente números de',
    'rating de videogame. No fim, liste as URLs consultadas.',
    '',
    `Comece a resposta com a linha: NOME: <nome completo do jogador>`,
  ].join('\n');

  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
      const res = await client.messages.create({
        model: MODELS.sonnet,
        max_tokens: 1800,
        system:
          'Você é um pesquisador esportivo rigoroso. Só afirma o que pode ' +
          'verificar em fontes públicas. Prefere precisão a especulação.',
        messages: [{ role: 'user', content: prompt }],
        // Tool server-side: a Anthropic executa a busca e devolve o resultado.
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }] as never,
      });
      const dossier = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      // Extrai URLs citadas no texto.
      const sources = Array.from(
        new Set((dossier.match(/https?:\/\/[^\s)\]]+/g) ?? []).map((u) => u.replace(/[.,]+$/, ''))),
      ).slice(0, 8);
      if (dossier.length > 0) return { dossier, sources, usedWebSearch: true };
    } catch (err) {
      console.warn('[legendResearch] web search falhou, fallback p/ conhecimento:', err instanceof Error ? err.message : err);
    }
  }

  // Fallback: conhecimento do modelo, sem web.
  const fb = await callAnthropic<{ dossier?: string; name?: string }>({
    model: 'sonnet',
    system: 'Você é um pesquisador esportivo. Use só conhecimento público verificável.',
    user: prompt + '\n\n(Sem acesso a web — use seu conhecimento, sem inventar números de videogame.)',
    maxTokens: 1200,
    temperature: 0.4,
  });
  return { dossier: fb.text ?? '', sources: ['(sem web search — conhecimento do modelo)'], usedWebSearch: false };
}

/** Passo 2 — converte o dossiê em 10 atributos via rubrica Olefoot. */
async function scoreAttributes(
  p: ResearchParams,
  dossier: string,
): Promise<{ playerName: string; attributes: Attributes; bioSnippet: string } | null> {
  const system = jsonSystemPrompt(
    [
      'Você aplica a METODOLOGIA OLEFOOT de atributos: traduz descrições',
      'qualitativas públicas de um jogador em 10 atributos 0-99. NÃO copie',
      'ratings de videogame; derive do estilo descrito.',
      '',
      'Atributos (0-99): passe, marcacao, velocidade, drible, finalizacao,',
      'fisico, tatico, mentalidade, confianca, fairPlay.',
      '',
      'Regras: o SHAPE deve refletir o perfil real (ex.: zagueiro marcador →',
      'marcacao/fisico altos, finalizacao baixa; finalizador → finalizacao/',
      'velocidade altas). fairPlay reflete disciplina (cartões). Não precisa',
      'acertar o nível absoluto — o sistema reescala depois. Foque no PERFIL.',
    ].join('\n'),
    '{"playerName":string,"bioSnippet":string,"attributes":{"passe":int,"marcacao":int,"velocidade":int,"drible":int,"finalizacao":int,"fisico":int,"tatico":int,"mentalidade":int,"confianca":int,"fairPlay":int}}',
  );
  const user = [
    `Posição: ${p.position} | Ano: ${p.year}`,
    'Dossiê de pesquisa:',
    dossier.slice(0, 6000),
    '',
    'Extraia o nome do jogador (linha NOME: ... se houver) e produza o JSON.',
    'bioSnippet: 1 frase factual sobre a temporada (sem números de rating).',
  ].join('\n');

  const res = await callAnthropic<{
    playerName?: string;
    bioSnippet?: string;
    attributes?: Partial<Attributes>;
  }>({ model: 'sonnet', system, user, maxTokens: 700, temperature: 0.3, expectJson: true });

  if (!res.ok || !res.json?.attributes) return null;
  const raw = res.json.attributes;
  const attrs = {} as Attributes;
  for (const k of ATTR_KEYS) attrs[k] = clamp(Math.round(Number(raw[k] ?? 50)), 1, 99);
  const playerName = (res.json.playerName ?? '').trim();
  if (!playerName) return null;
  return { playerName, attributes: attrs, bioSnippet: (res.json.bioSnippet ?? '').trim() };
}

/** Passo 3 — verificação adversarial de coerência posição×atributos. */
async function verifyCoherence(
  position: string,
  attrs: Attributes,
): Promise<Attributes> {
  const system = jsonSystemPrompt(
    'Você é um auditor de coerência. Dado uma posição e 10 atributos 0-99, ' +
      'corrija incoerências grosseiras (ex.: zagueiro com finalizacao 90, ' +
      'goleiro com drible 90). Mantenha o nível geral parecido; só conserte o ' +
      'que destoa da posição. Se já estiver coerente, devolva igual.',
    '{"attributes":{"passe":int,"marcacao":int,"velocidade":int,"drible":int,"finalizacao":int,"fisico":int,"tatico":int,"mentalidade":int,"confianca":int,"fairPlay":int}}',
  );
  const res = await callAnthropic<{ attributes?: Partial<Attributes> }>({
    model: 'haiku',
    system,
    user: `Posição: ${position}\nAtributos: ${JSON.stringify(attrs)}`,
    maxTokens: 400,
    temperature: 0.2,
    expectJson: true,
  });
  if (!res.ok || !res.json?.attributes) return attrs;
  const out = {} as Attributes;
  for (const k of ATTR_KEYS) out[k] = clamp(Math.round(Number(res.json.attributes[k] ?? attrs[k])), 1, 99);
  return out;
}

/**
 * Pipeline completo. Retorna um LegendTemplate pronto pra cachear/usar.
 */
export async function researchLegendTemplate(p: ResearchParams): Promise<ResearchResult> {
  if (!hasAnthropicKey()) return { ok: false, error: 'ANTHROPIC_API_KEY ausente.' };

  const { dossier, sources, usedWebSearch } = await researchDossier(p);
  if (!dossier) return { ok: false, error: 'Pesquisa não retornou dossiê.' };

  const scored = await scoreAttributes(p, dossier);
  if (!scored) return { ok: false, error: 'Falha ao derivar atributos.' };

  const coherent = await verifyCoherence(p.position, scored.attributes);

  // Alvo de OVR: aleatório dentro da banda da raridade (variedade entre draws).
  const target = p.ovrFloor + Math.floor(Math.random() * (p.ovrCeiling - p.ovrFloor + 1));
  const scaled = scaleToTarget(coherent, target, p.position);
  const overall = clamp(computeOverall(scaled, p.position), p.ovrFloor, p.ovrCeiling);

  return {
    ok: true,
    template: {
      playerName: scored.playerName,
      playerSlug: slugify(scored.playerName),
      attributes: scaled,
      overall,
      bioSnippet: scored.bioSnippet,
      sources,
      methodologyVer: METHODOLOGY_VERSION,
      usedWebSearch,
    },
  };
}

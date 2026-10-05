/**
 * Monta a ficha de um jogador e o que entra no histórico — funções puras.
 *
 * Regras:
 *   - A GÊNESE nasce uma vez e não muda mais (o hash prova). Para Genesis e
 *     Legacy, os atributos de nascimento são os do catálogo; o que o jogador
 *     ganhou desde então aparece como diferença entre Gênese e Corpo.
 *   - A CLASSE nasce dos atributos e é identidade: não troca a cada ponto que
 *     o jogador ganha. Só é recalculada se deixar de valer para a posição.
 *   - Temperamento, traços, nível, cérebro e vínculo sobrevivem a cada
 *     sincronização — quem os muda são as fases seguintes.
 */
import { createHash } from 'node:crypto';
import { classePorId, grupoDaPosicao } from './classes.js';
import { atributosCompletos, classeDe, espacosDoCerebro, origemDe, raridadeDe, temperamentoDe } from './derivar.js';
import { ovrDe } from './ovr.js';
import { ATRIBUTOS_ESPECIALISTA, ATRIBUTOS_NUCLEO, type Atributos, type Evento, type Ficha, type Genese } from './tipos.js';

/** O que o catálogo sabe do jogador (Genesis ou Legacy). */
export interface InfoCatalogo {
  catalogo: string;
  atributos: Record<string, unknown> | null;
  rotuloRaridade: string | null;
  ovrNascimento: number | null;
  nacionalidade: string | null;
  idade: number | null;
  pe: string | null;
}

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const inteiro = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
const pe = (v: unknown): Genese['pe'] => (v === 'right' || v === 'left' || v === 'both' ? v : null);

/** JSON com chaves ordenadas: o mesmo conteúdo dá sempre o mesmo hash. */
function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonico((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}
export const hashDaGenese = (g: Genese): string => createHash('sha256').update(canonico(g)).digest('hex');

/** Só os atributos que mudaram: { finalizacao: [72, 79] }. */
export function diferencaDeAtributos(antes: Atributos, depois: Atributos): Record<string, [number, number]> {
  const d: Record<string, [number, number]> = {};
  for (const k of [...ATRIBUTOS_NUCLEO, ...ATRIBUTOS_ESPECIALISTA]) {
    if (antes[k] !== depois[k]) d[k] = [antes[k], depois[k]];
  }
  return d;
}

export interface Resultado {
  ficha: Ficha;
  eventos: Evento[];
  mudou: boolean;
}

/**
 * Concilia um jogador do elenco com a ficha que já existe (ou cria a ficha).
 * `agora` vem de fora para o resultado ser reproduzível nos testes.
 */
export function conciliar(
  ownerId: string,
  entidade: Record<string, unknown>,
  existente: Ficha | null,
  catalogo: InfoCatalogo | null,
  agora: string,
): Resultado {
  const playerId = String(entidade.id);
  const posicao = texto(entidade.pos) ?? existente?.posicao ?? 'MC';
  const nome = texto(entidade.name) ?? existente?.nome ?? playerId;
  const atributos = atributosCompletos(entidade.attrs as Record<string, unknown>, posicao);
  const ovr = ovrDe(atributos, posicao);
  const eventos: Evento[] = [];

  if (!existente) {
    const origem = origemDe(playerId, entidade);
    const gacha = (entidade.gachaProvenance as { rarity?: string } | undefined)?.rarity ?? null;
    const raridade = raridadeDe(origem, catalogo?.rotuloRaridade ?? null, gacha);
    const atributosNascimento = catalogo?.atributos ? atributosCompletos(catalogo.atributos, posicao) : atributos;
    const idade = inteiro(entidade.age) ?? catalogo?.idade ?? null;
    const genese: Genese = {
      origem,
      catalogo: catalogo?.catalogo ?? null,
      nome,
      posicao,
      raridade,
      atributos: atributosNascimento,
      ovr: inteiro(entidade.mintOverall) ?? catalogo?.ovrNascimento ?? ovrDe(atributosNascimento, posicao),
      nacionalidade: texto(entidade.country) ?? catalogo?.nacionalidade ?? null,
      idade,
      pe: pe(entidade.strongFoot) ?? pe(catalogo?.pe),
      nascidaEm: agora,
    };
    const { classe, afinidade } = classeDe(posicao, atributosNascimento);
    const ficha: Ficha = {
      owner_id: ownerId,
      player_id: playerId,
      origem,
      catalogo: genese.catalogo,
      raridade,
      genese,
      genese_hash: hashDaGenese(genese),
      nome,
      posicao,
      atributos,
      ovr,
      classe,
      classe_afinidade: afinidade,
      temperamento: temperamentoDe(texto(entidade.behavior), atributosNascimento, idade),
      tracos: [],
      nivel: 1,
      xp: 0,
      cerebro: { espacos: espacosDoCerebro(raridade), ideias: [] },
      vinculo: { noElencoDesde: agora },
      ativo: true,
    };
    const ganho = diferencaDeAtributos(atributosNascimento, atributos);
    eventos.push({
      owner_id: ownerId, player_id: playerId, tipo: 'nasceu',
      dados: { genese_hash: ficha.genese_hash, classe, ovr_nascimento: genese.ovr, ovr_hoje: ovr,
        // Evolução que o jogador já tinha antes da ficha existir (veio do elenco salvo).
        evolucao_anterior: Object.keys(ganho).length ? ganho : null },
    });
    return { ficha, eventos, mudou: true };
  }

  const ficha: Ficha = { ...existente, nome, posicao, atributos, ovr, ativo: true };
  // Classe é identidade; só muda se a posição nova não aceitar a classe atual.
  const atual = classePorId(existente.classe);
  if (!atual || !atual.grupos.includes(grupoDaPosicao(posicao))) {
    const r = classeDe(posicao, atributos);
    ficha.classe = r.classe;
    ficha.classe_afinidade = r.afinidade;
  }

  const diff = diferencaDeAtributos(existente.atributos, atributos);
  if (Object.keys(diff).length) {
    eventos.push({ owner_id: ownerId, player_id: playerId, tipo: 'atributos',
      dados: { mudancas: diff, ovr: [existente.ovr, ovr], fonte: 'elenco' } });
  }
  if (!existente.ativo) {
    eventos.push({ owner_id: ownerId, player_id: playerId, tipo: 'voltou_ao_elenco', dados: {} });
  }
  const mudou = eventos.length > 0 || ficha.nome !== existente.nome || ficha.posicao !== existente.posicao
    || ficha.classe !== existente.classe;
  return { ficha, eventos, mudou };
}

/** Jogador que tinha ficha ativa e sumiu do elenco (vendido, dispensado). */
export function saiuDoElenco(ficha: Ficha): Resultado {
  return {
    ficha: { ...ficha, ativo: false },
    eventos: [{ owner_id: ficha.owner_id, player_id: ficha.player_id, tipo: 'saiu_do_elenco', dados: { ovr: ficha.ovr } }],
    mudou: true,
  };
}

/**
 * PARTIDA VIVA — o filme da partida (Fase 6, docs/PARTIDA-VIVA-PLANO.md §8).
 *
 * O coreógrafo é determinístico: mesmos quadros entregues nos MESMOS passos =
 * as mesmas posições, toque a toque. Então o filme não grava vídeo nem
 * posição — grava só EM QUE PASSO cada quadro chegou (o roteiro). Reassistir é
 * entregar o roteiro de novo, no mesmo passo, a um coreógrafo novo.
 *
 * Regra: tudo que mexe no coreógrafo por causa de um quadro passa por
 * `entregarQuadro` — ao vivo e no filme. Se algo mexer por fora, o filme
 * diverge (o teste `test:partida-viva` confere).
 *
 * Guardado no aparelho (localStorage, poucos filmes, alguns KB cada). Mandar
 * o filme pro dono do time adversário ("seu time jogou enquanto você dormia")
 * precisa de tabela no servidor — fica pra quando ela existir.
 */
import type { Coreografo } from './coreografo';
import { iniciais } from './escalacao';
import type { Ficha, QuadroAoVivo } from './tipos';

export interface Entrega { p: number; q: QuadroAoVivo }
/** Um trecho = uma montagem do palco (sair e voltar ao campo começa outro). */
export interface Trecho { comEntrada: boolean; roteiro: Entrega[]; formacaoCasa?: string }

export interface FilmeDaPartida {
  v: 1;
  id: string;
  quando: string;
  seed: string;
  siglaCasa: string;
  siglaFora: string;
  nomeCasa: string;
  nomeFora: string;
  placarCasa: number;
  placarFora: number;
  formacaoCasa: string;
  formacaoFora: string;
  fichas: Ficha[];
  banco: Ficha[];
  trechos: Trecho[];
}

export type ResumoDoFilme = Pick<FilmeDaPartida, 'id' | 'quando' | 'siglaCasa' | 'siglaFora' | 'nomeCasa' | 'nomeFora' | 'placarCasa' | 'placarFora'>;

/**
 * Entrega um quadro ao coreógrafo: o lance/gol/estilo/grito (`receber`) e as
 * trocas de quem está em campo. Devolve as trocas feitas (o palco troca o desenho).
 */
export function entregarQuadro(co: Coreografo, q: QuadroAoVivo, banco: readonly Ficha[]): { sai: string; nova: Ficha }[] {
  co.receber(q);
  const feitas: { sai: string; nova: Ficha }[] = [];
  const emCampo = q.emCampo;
  if (!emCampo?.length) return feitas;
  const casa = co.corpos.filter((c) => c.f.lado === 'home').map((c) => c.f.id);
  const saem = casa.filter((id) => !emCampo.includes(id));
  const entram = emCampo.filter((id) => !casa.includes(id));
  entram.forEach((id, i) => {
    const sai = saem[i];
    if (!sai) return;
    const doBanco = banco.find((f) => f.id === id);
    const nome = q.banco?.find((b) => b.id === id)?.nome ?? doBanco?.nome ?? id;
    const ficha: Ficha = doBanco ?? { id, nome, iniciais: iniciais(nome), lado: 'home', slot: '', rosto: null, fadiga: 0, velocidade: 65 };
    const nova = co.trocar(sai, ficha);
    if (nova) feitas.push({ sai, nova });
  });
  return feitas;
}

/**
 * O quadro como vai pro filme: sem o que só serve pra decidir (botões, banco,
 * recarga, pausa). A decisão vira só o desenho do Analista (corredores).
 */
export function enxugarQuadro(q: QuadroAoVivo): QuadroAoVivo {
  const { decisao, banco: _b, subsRestantes: _s, pausado: _p, gritoLivreEm: _g, narracao, ...resto } = q;
  void _b; void _s; void _p; void _g;
  return {
    ...resto,
    narracao: narracao.slice(0, 3),
    decisao: decisao?.corredores
      ? { tipo: decisao.tipo, chave: decisao.chave, titulo: decisao.titulo, texto: decisao.texto, opcoes: [], corredores: decisao.corredores }
      : null,
  };
}

/** Grava uma entrega no trecho atual (só se o quadro mudou de verdade). */
export function gravarEntrega(trecho: Trecho, p: number, q: QuadroAoVivo): void {
  const enxuto = enxugarQuadro(q);
  const ultimo = trecho.roteiro[trecho.roteiro.length - 1];
  if (ultimo && JSON.stringify(ultimo.q) === JSON.stringify(enxuto)) return;
  trecho.roteiro.push({ p, q: enxuto });
}

// ── no aparelho ──────────────────────────────────────────────────────────────

const CHAVE = 'olefoot:filmes:v1';
const MAX_FILMES = 6;

function ler(): FilmeDaPartida[] {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    const lista = bruto ? (JSON.parse(bruto) as FilmeDaPartida[]) : [];
    return Array.isArray(lista) ? lista.filter((f) => f && f.v === 1 && Array.isArray(f.trechos)) : [];
  } catch {
    return [];
  }
}

/** Guarda o filme (o mais novo primeiro). Sem espaço: descarta os mais velhos. Nunca lança. */
export function salvarFilme(f: FilmeDaPartida): boolean {
  let lista = [f, ...ler().filter((x) => x.id !== f.id)].slice(0, MAX_FILMES);
  while (lista.length) {
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(lista));
      return true;
    } catch {
      lista = lista.slice(0, -1);
    }
  }
  return false;
}

export function listarFilmes(): ResumoDoFilme[] {
  return ler().map(({ id, quando, siglaCasa, siglaFora, nomeCasa, nomeFora, placarCasa, placarFora }) =>
    ({ id, quando, siglaCasa, siglaFora, nomeCasa, nomeFora, placarCasa, placarFora }));
}

export function abrirFilme(id: string): FilmeDaPartida | null {
  return ler().find((f) => f.id === id) ?? null;
}

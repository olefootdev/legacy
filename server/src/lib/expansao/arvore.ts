/**
 * A árvore binária — Time 1 e Time 2 (BÔNUS DE EQUIPARAÇÃO · v1).
 *
 * ⚠️ ESTRUTURA NOVA, e tem que ser. A árvore de indicação que já existe
 * (`profiles.referred_by_code`) é UNÁRIA: um pai, sem lados. Binário não é a
 * mesma árvore com dois lados — é outra coisa, e misturar as duas quebraria a
 * comissão de NFT, que lê aquela. Esta vive à parte e não toca naquela.
 *
 * POSICIONAMENTO (decisão do fundador, 2026-09-28): o PATROCINADOR ESCOLHE O
 * LADO ao convidar. Se a vaga direta daquele lado já está ocupada, a pessoa
 * DESCE por aquela perna até a primeira vaga livre — e nunca atravessa pro
 * outro lado. Foi escolhido em vez de equilíbrio automático porque o
 * patrocinador precisa saber onde pôs cada convidado; e em vez de spillover
 * clássico esquerda→direita porque aquele é o padrão que a spec pede pra
 * evitar.
 *
 * VOLUME DE PERNA sobe, não desce. Quando alguém recebe OLEXP, o valor é
 * somado na perna correspondente de CADA ancestral, subindo até a raiz.
 * A alternativa — varrer a subárvore a cada ciclo — seria recontar a rede
 * inteira de hora em hora, e a conta ficaria mais cara justamente quando a
 * rede crescesse.
 *
 * Puro: sem banco, sem IO. Recebe o estado, devolve o que mudou.
 */
import { LADOS, exigePositivo, podeQualificar, podeEquiparar, type FonteOlexp, type Lado, type Olexp } from './unidade.js';

export interface No {
  readonly userId: string;
  /** Quem convidou. null só na raiz. */
  readonly patrocinadorId: string | null;
  /** Debaixo de quem a pessoa ficou de fato (pode não ser o patrocinador). */
  readonly paiId: string | null;
  /** Em que lado do PAI ela está. null só na raiz. */
  readonly lado: Lado | null;
}

/** A rede, como um mapa de quem está debaixo de quem. */
export interface Arvore {
  /** userId → nó */
  readonly nos: ReadonlyMap<string, No>;
  /** `${paiId}:${lado}` → userId do filho direto */
  readonly filhos: ReadonlyMap<string, string>;
}

export const chaveFilho = (paiId: string, lado: Lado): string => `${paiId}:${lado}`;

export function arvoreVazia(): Arvore {
  return { nos: new Map(), filhos: new Map() };
}

/**
 * Onde a pessoa vai ficar: a primeira vaga livre DENTRO da perna escolhida.
 *
 * ⚠️ Busca em LARGURA, não em profundidade. A primeira versão descia sempre
 * pelo mesmo lado (perna 1 da perna 1 da perna 1…) e formava uma corrente
 * única: o lado 2 de todo mundo no meio do caminho nunca era preenchido, e a
 * rede virava uma fila em vez de uma árvore. Em largura, a perna cresce
 * equilibrada por baixo, que é o que as pessoas esperam do binário.
 *
 * O que NÃO muda: nunca atravessa pro outro lado. Se o patrocinador disse
 * Time 1, a pessoa entra em algum lugar do Time 1, por mais fundo que seja.
 */
export function vagaNaPerna(a: Arvore, patrocinadorId: string, lado: Lado): { paiId: string; lado: Lado } {
  if (!a.nos.has(patrocinadorId)) throw new Error(`patrocinador ${patrocinadorId} não está na árvore`);

  const raizDaPerna = a.filhos.get(chaveFilho(patrocinadorId, lado));
  if (!raizDaPerna) return { paiId: patrocinadorId, lado };

  const fila: string[] = [raizDaPerna];
  const visitados = new Set<string>([patrocinadorId, raizDaPerna]);

  while (fila.length > 0) {
    const atual = fila.shift() as string;
    for (const l of LADOS) {
      const ocupante = a.filhos.get(chaveFilho(atual, l));
      if (!ocupante) return { paiId: atual, lado: l };
      if (visitados.has(ocupante)) throw new Error('ciclo na árvore');
      visitados.add(ocupante);
      fila.push(ocupante);
    }
  }
  throw new Error('perna sem vaga — árvore provavelmente corrompida');
}

export function inserir(a: Arvore, userId: string, patrocinadorId: string, lado: Lado): Arvore {
  if (a.nos.has(userId)) throw new Error(`${userId} já está na árvore`);
  if (userId === patrocinadorId) throw new Error('ninguém patrocina a si mesmo');

  const vaga = vagaNaPerna(a, patrocinadorId, lado);
  const nos = new Map(a.nos);
  const filhos = new Map(a.filhos);
  nos.set(userId, { userId, patrocinadorId, paiId: vaga.paiId, lado: vaga.lado });
  filhos.set(chaveFilho(vaga.paiId, vaga.lado), userId);
  return { nos, filhos };
}

export function inserirRaiz(a: Arvore, userId: string): Arvore {
  if (a.nos.has(userId)) throw new Error(`${userId} já está na árvore`);
  const nos = new Map(a.nos);
  nos.set(userId, { userId, patrocinadorId: null, paiId: null, lado: null });
  return { nos, filhos: new Map(a.filhos) };
}

/**
 * O caminho de subida: para cada ancestral, em que perna dele esta pessoa está.
 *
 * É isso que credita volume. Alguém a 8 níveis de profundidade soma na perna 1
 * de quem está 8 acima, se foi por ali que ela desceu.
 */
export function ancestraisComLado(a: Arvore, userId: string): { ancestralId: string; lado: Lado }[] {
  const saida: { ancestralId: string; lado: Lado }[] = [];
  let atual = a.nos.get(userId);
  const visitados = new Set<string>([userId]);

  while (atual?.paiId && atual.lado) {
    saida.push({ ancestralId: atual.paiId, lado: atual.lado });
    if (visitados.has(atual.paiId)) throw new Error('ciclo na árvore');
    visitados.add(atual.paiId);
    atual = a.nos.get(atual.paiId);
  }
  return saida;
}

/** Volume por perna: `${userId}:${lado}` → OLEXP. */
export type Pernas = Map<string, Olexp>;

export const chavePerna = (userId: string, lado: Lado): string => `${userId}:${lado}`;

export function volumeDaPerna(p: Pernas, userId: string, lado: Lado): Olexp {
  return p.get(chavePerna(userId, lado)) ?? 0n;
}

/**
 * 🔴 DOIS acumuladores, não um. A varredura de 2026-09-28 achou isto:
 *
 * `unidade.ts` sempre separou as fontes em `qualificacao` e `equiparacao`, e
 * `carreira.ts` diz por escrito que a equiparação consome o segundo e não pode
 * tocar o primeiro. Mas existia um mapa só — e daí saíam dois erros de dinheiro:
 *
 *   1. fonte que qualifica mas NÃO paga (nft, campanha, evento, produto do
 *      jogo…) caía no mesmo balaio e seria EQUIPARADA. Pagaria bônus por OLEXP
 *      que nunca devia pagar.
 *   2. consumir o equiparado do mesmo mapa BAIXARIA a equipe menor — e
 *      rebaixaria a graduação de quem acabou de receber bônus.
 *
 * Separados: `qualificacao` só cresce e é o que gradua; `equiparacao` é o que
 * o ciclo consome.
 */
export interface Acervo {
  readonly qualificacao: Pernas;
  readonly equiparacao: Pernas;
}

export const acervoVazio = (): Acervo => ({ qualificacao: new Map(), equiparacao: new Map() });

/**
 * Credita OLEXP de uma pessoa e propaga pra cima, em cada trilho que a fonte
 * permitir.
 *
 * ⚠️ NÃO credita na própria pessoa. O volume de perna de alguém é o que a
 * REDE DELA produziu; a compra dela mesma conta pros ancestrais, não pra ela.
 * Se contasse, dava pra graduar sozinho comprando nos dois lados — que é o
 * atalho mais óbvio do binário.
 */
export function creditar(
  a: Arvore,
  acervo: Acervo,
  userId: string,
  olexp: Olexp,
  fonte: FonteOlexp,
): Acervo {
  exigePositivo('olexp', olexp);
  if (!a.nos.has(userId)) throw new Error(`${userId} não está na árvore`);

  const qualifica = podeQualificar(fonte);
  const equipara = podeEquiparar(fonte);
  if (!qualifica && !equipara) return acervo; // compra na DEX cai aqui

  const q: Pernas = new Map(acervo.qualificacao);
  const e: Pernas = new Map(acervo.equiparacao);
  for (const { ancestralId, lado } of ancestraisComLado(a, userId)) {
    const k = chavePerna(ancestralId, lado);
    if (qualifica) q.set(k, (q.get(k) ?? 0n) + olexp);
    if (equipara) e.set(k, (e.get(k) ?? 0n) + olexp);
  }
  return { qualificacao: q, equiparacao: e };
}

/**
 * Debita o que foi equiparado — SÓ do trilho de equiparação.
 *
 * O ciclo equipara o MIN e tira dos dois lados. A graduação não se mexe, que é
 * o ponto de existirem dois trilhos.
 */
export function consumirEquiparado(acervo: Acervo, userId: string, quanto: Olexp): Acervo {
  if (quanto < 0n) throw new RangeError(`consumo negativo: ${quanto}`);
  if (quanto === 0n) return acervo;

  const e: Pernas = new Map(acervo.equiparacao);
  for (const lado of LADOS) {
    const k = chavePerna(userId, lado);
    const atual = e.get(k) ?? 0n;
    if (atual < quanto) throw new RangeError(`consumo ${quanto} maior que a perna ${lado} (${atual})`);
    e.set(k, atual - quanto);
  }
  return { qualificacao: acervo.qualificacao, equiparacao: e };
}

/** A equipe menor — é ela que gradua e é ela que limita a equiparação. */
export function equipeMenor(p: Pernas, userId: string): Olexp {
  const t1 = volumeDaPerna(p, userId, 1);
  const t2 = volumeDaPerna(p, userId, 2);
  return t1 < t2 ? t1 : t2;
}

// ─────────────────────────────────────────────────── ativação ───────────────

/**
 * ATIVAÇÃO: só equipara quem indicou pelo menos UMA pessoa em CADA perna.
 *
 * Regra do fundador (2026-09-28): "a pessoa tem que indicar sempre 2 pessoas
 * para ativar o bônus — no mínimo 1 no Time 1 e 1 no Time 2, não é apenas uma
 * abaixo da outra."
 *
 * 🔴 POR QUE ISSO NÃO ERA REDUNDANTE COM O `equiparar()`:
 * o MIN das pernas já dá zero quando um lado tem volume zero — mas isso é
 * consequência do VOLUME, não da indicação. Com derramamento, alguém pode
 * receber volume nos dois lados **sem nunca ter indicado ninguém**: a perna
 * enche sozinha porque um upline colocou gente ali. Sem esta trava, essa pessoa
 * equipararia e receberia. Com ela, não.
 *
 * O teste é sobre PATROCÍNIO, não sobre posição: conta quem a pessoa trouxe
 * (`patrocinadorId === ela`), e em qual das pernas dela essa gente caiu.
 */

/**
 * Em qual perna de `raizId` o `alvoId` está. null se não for descendente.
 *
 * Sobe pelo `paiId` até achar a raiz; o `lado` do último passo é a perna.
 */
export function pernaDoDescendente(a: Arvore, raizId: string, alvoId: string): Lado | null {
  if (raizId === alvoId) return null;
  let atual = a.nos.get(alvoId);
  const visitados = new Set<string>();
  while (atual?.paiId && atual.lado) {
    if (visitados.has(atual.userId)) return null; // ciclo: árvore corrompida
    visitados.add(atual.userId);
    if (atual.paiId === raizId) return atual.lado;
    atual = a.nos.get(atual.paiId);
  }
  return null;
}

/** Os indicados diretos de `userId`, separados pela perna onde ficaram. */
export function diretosPorPerna(a: Arvore, userId: string): { time1: string[]; time2: string[] } {
  const time1: string[] = [];
  const time2: string[] = [];
  for (const no of a.nos.values()) {
    if (no.patrocinadorId !== userId) continue;
    const perna = pernaDoDescendente(a, userId, no.userId);
    if (perna === 1) time1.push(no.userId);
    else if (perna === 2) time2.push(no.userId);
  }
  return { time1, time2 };
}

export interface Ativacao {
  readonly ativo: boolean;
  readonly diretosTime1: number;
  readonly diretosTime2: number;
  /** Qual perna ainda falta. null quando já está ativo. */
  readonly faltaNaPerna: Lado | null;
}

/**
 * Está ativo para equiparar?
 *
 * ⚠️ Indicado que caiu por derramamento LONGE — vários níveis abaixo — continua
 * contando: ele é indicação da pessoa e está na perna dela. O que não conta é
 * gente que ela não indicou.
 */
export function ativacaoDe(a: Arvore, userId: string): Ativacao {
  const { time1, time2 } = diretosPorPerna(a, userId);
  const ativo = time1.length >= 1 && time2.length >= 1;
  return {
    ativo,
    diretosTime1: time1.length,
    diretosTime2: time2.length,
    faltaNaPerna: ativo ? null : time1.length === 0 ? 1 : 2,
  };
}

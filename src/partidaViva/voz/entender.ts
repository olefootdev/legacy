/**
 * PARTIDA VIVA — COMANDO DE VOZ (protótipo, 14/10): a frase do manager → o comando.
 *
 * "O manager dá comando de voz, o time recebe, entende e executa em campo."
 * A voz é só uma PORTA NOVA pros MESMOS comandos dos botões: este módulo
 * transforma o texto falado numa resposta do canal do campo ('grito:cobrar',
 * 'sub:<sai>|<entra>', a opção do momento decisivo…) e o QuickPlanPlayer a
 * executa pela mesma função do botão — com as mesmas regras (recarga do grito,
 * limite de trocas). Nada aqui decide lance: o motor no servidor decide.
 *
 * PURO e determinístico (o teste `npm run test:voz` varre as frases). Sem IA:
 * frases e nomes do elenco. O que não entende, diz que não entendeu.
 */
import { L } from '@/i18n/L';

export interface JogadorDaVoz { id: string; nome: string; slot: string; fadiga: number }
export interface ReservaDaVoz { id: string; nome: string; pos: string }
export interface DecisaoDaVoz { tipo: string; opcoes: { id: string; rotulo: string }[] }

export interface ContextoDaVoz {
  /** Os nossos em campo (com a troca já feita), com o slot do catálogo (gol, zag1, ld…). */
  casa: JogadorDaVoz[];
  /** Os deles em campo. */
  fora: JogadorDaVoz[];
  /** Reservas disponíveis. */
  banco: ReservaDaVoz[];
  subsRestantes: number;
  /** Decisão aberta no campo (momento decisivo, pênalti, lesão, analista, reação). */
  decisao: DecisaoDaVoz | null;
  formacoes: readonly string[];
  /** Lendas que ainda podem ser ativadas. */
  lendas: { id: string; nome: string }[];
}

export type Entendido =
  | { tipo: 'ok'; id: string; entendi: string; fala: string; confirmar?: boolean }
  | { tipo: 'duvida'; texto: string };

// ── normalização ─────────────────────────────────────────────────────────────

const NUMEROS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
};

export function normalizar(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\- ]/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').map((w) => (w in NUMEROS ? String(NUMEROS[w]) : w)).join(' ');
}

const tem = (t: string, ...ps: string[]) => ps.some((p) => new RegExp(`(^| )${p}( |$)`).test(t));

// ── quem é quem ──────────────────────────────────────────────────────────────

/** Camisa clássica por slot (o "10" é o meia-armador, o "9" o centroavante…). */
const CAMISA: Record<string, number> = { gol: 1, ld: 2, zag1: 3, zag2: 4, vol: 5, le: 6, pd: 7, mc1: 8, ata: 9, mc2: 10, pe: 11 };
/** Posição falada → slots (nossos/deles) e siglas do banco. */
const POSICOES: { fala: string[]; slots: string[]; banco: string[] }[] = [
  { fala: ['goleiro', 'goalkeeper', 'keeper'], slots: ['gol'], banco: ['GOL', 'GK'] },
  { fala: ['lateral direito', 'right back'], slots: ['ld'], banco: ['LD', 'RB'] },
  { fala: ['lateral esquerdo', 'left back'], slots: ['le'], banco: ['LE', 'LB'] },
  { fala: ['lateral', 'fullback'], slots: ['ld', 'le'], banco: ['LD', 'LE', 'RB', 'LB'] },
  { fala: ['zagueiro', 'beque', 'defender', 'centre back', 'center back'], slots: ['zag1', 'zag2'], banco: ['ZAG', 'CB'] },
  { fala: ['volante', 'cabeca de area', 'holding'], slots: ['vol'], banco: ['VOL', 'DM', 'CDM'] },
  { fala: ['meia', 'meio campo', 'meio-campo', 'meio', 'midfielder'], slots: ['mc1', 'mc2'], banco: ['MC', 'MEI', 'CM', 'CAM', 'MD', 'ME'] },
  { fala: ['ponta direita', 'right winger'], slots: ['pd'], banco: ['PD', 'RW'] },
  { fala: ['ponta esquerda', 'left winger'], slots: ['pe'], banco: ['PE', 'LW'] },
  { fala: ['ponta', 'winger'], slots: ['pd', 'pe'], banco: ['PD', 'PE', 'RW', 'LW'] },
  { fala: ['centroavante', 'atacante', 'centro avante', 'striker', 'forward'], slots: ['ata'], banco: ['ATA', 'CA', 'ST', 'CF'] },
];

const PALAVRAS_VAZIAS = new Set(['o', 'a', 'os', 'as', 'do', 'da', 'de', 'no', 'na', 'e', 'pro', 'pra', 'the', 'and', 'for', 'to', 'jr', 'junior', 'filho', 'neto', 'dos', 'das']);
const tokensDoNome = (nome: string) => normalizar(nome).split(' ').filter((w) => w.length >= 3 && !PALAVRAS_VAZIAS.has(w));

type Achado<T> = { quem: T; onde: number } | 'ambiguo' | null;

/** Acha UM jogador citado no trecho: nome (qualquer parte), camisa ("o 9"), posição ou "o mais cansado". */
function acharJogador(trecho: string, lista: JogadorDaVoz[], opcoes: { cansado?: boolean } = {}): Achado<JogadorDaVoz> {
  const palavras = trecho.split(' ');
  // 1) nome: a parte do nome dita (ganha quem bate mais partes; empate = ambíguo)
  let melhor: JogadorDaVoz[] = [], pontos = 0, onde = -1;
  for (const j of lista) {
    const toks = tokensDoNome(j.nome);
    let p = 0, pos = -1;
    for (const t of toks) { const i = palavras.indexOf(t); if (i >= 0) { p++; if (pos < 0 || i < pos) pos = i; } }
    if (p > pontos) { melhor = [j]; pontos = p; onde = pos; } else if (p && p === pontos) { melhor.push(j); onde = Math.min(onde, pos); }
  }
  if (melhor.length === 1) return { quem: melhor[0]!, onde };
  if (melhor.length > 1) return 'ambiguo';
  // 2) camisa: "o 9", "camisa 10", "numero 7"
  const n = /(?:^| )(?:camisa |numero |o |a |the |number )?(1[01]|[1-9])(?: |$)/.exec(trecho);
  if (n && !/\d-\d/.test(trecho)) {
    const alvo = lista.filter((j) => CAMISA[j.slot] === Number(n[1]));
    if (alvo.length === 1) return { quem: alvo[0]!, onde: trecho.slice(0, n.index).split(' ').length };
  }
  // 3) posição
  for (const pos of POSICOES) {
    const f = pos.fala.find((x) => tem(trecho, x));
    if (!f) continue;
    const alvo = lista.filter((j) => pos.slots.includes(j.slot));
    if (alvo.length === 1) return { quem: alvo[0]!, onde: trecho.indexOf(f) };
    if (alvo.length > 1) {
      // dois zagueiros: o mais cansado sai (é quem o técnico tira)
      if (opcoes.cansado) return { quem: [...alvo].sort((a, b) => b.fadiga - a.fadiga)[0]!, onde: trecho.indexOf(f) };
      return 'ambiguo';
    }
  }
  // 4) "o mais cansado"
  if (opcoes.cansado && tem(trecho, 'mais cansado', 'cansado', 'most tired', 'tired')) {
    const q = [...lista].filter((j) => j.slot !== 'gol').sort((a, b) => b.fadiga - a.fadiga)[0];
    if (q) return { quem: q, onde: 0 };
  }
  return null;
}

function acharReserva(trecho: string, banco: ReservaDaVoz[]): Achado<ReservaDaVoz> {
  const palavras = trecho.split(' ');
  let melhor: ReservaDaVoz[] = [], pontos = 0;
  for (const r of banco) {
    const p = tokensDoNome(r.nome).filter((t) => palavras.includes(t)).length;
    if (p > pontos) { melhor = [r]; pontos = p; } else if (p && p === pontos) melhor.push(r);
  }
  if (melhor.length === 1) return { quem: melhor[0]!, onde: 0 };
  if (melhor.length > 1) return 'ambiguo';
  for (const pos of POSICOES) {
    if (!pos.fala.some((x) => tem(trecho, x))) continue;
    const alvo = banco.filter((r) => pos.banco.includes(r.pos.toUpperCase()));
    if (alvo.length === 1) return { quem: alvo[0]!, onde: 0 };
    if (alvo.length > 1) return { quem: alvo[0]!, onde: 0 }; // o primeiro do banco nessa posição
  }
  return null;
}

const primeiroNome = (nome: string) => nome.split(' ')[0] ?? nome;

// ── os comandos ──────────────────────────────────────────────────────────────

const OPCOES_FALADAS: Record<string, string[]> = {
  chutar: ['chuta', 'chutar', 'bate', 'finaliza', 'manda', 'shoot', 'shot'],
  driblar: ['dribla', 'driblar', 'passa por ele', 'vai pra cima', 'dribble', 'take him on'],
  tocar: ['toca', 'tocar', 'passa', 'rola', 'serve', 'pass', 'square it'],
  cercar: ['cerca', 'cercar', 'fecha', 'acompanha', 'jockey', 'close down'],
  carrinho: ['carrinho', 'da o carrinho', 'slide', 'tackle'],
  combate: ['combate', 'chega junto', 'corpo', 'no corpo', 'challenge', 'shoulder'],
};

const ESTILOS: { id: string; fala: string[]; rotulo: () => string; grito: () => string }[] = [
  { id: 'attack', fala: ['ataque total', 'todo mundo pro ataque', 'tudo pra frente', 'pra cima com tudo', 'all out attack', 'all out', 'everyone forward'], rotulo: () => L('Ataque Total', 'All-Out Attack'), grito: () => L('Pra cima, todo mundo!', 'Everyone forward!') },
  { id: 'press', fala: ['pressiona', 'pressionar', 'pressao', 'marca a saida', 'aperta a saida', 'press', 'high press'], rotulo: () => L('Pressionar', 'Press'), grito: () => L('Aperta a saída deles!', 'Press them high!') },
  { id: 'counter', fala: ['contra ataque', 'contra-ataque', 'contragolpe', 'joga no contra', 'puxa o contra', 'counter', 'counter attack'], rotulo: () => L('Contra-Ataque', 'Counter-Attack'), grito: () => L('Espera e sai rápido!', 'Sit and break fast!') },
  { id: 'possession', fala: ['posse', 'toca a bola', 'gira a bola', 'cadencia', 'segura a bola', 'possession', 'keep the ball', 'keep it'], rotulo: () => L('Posse', 'Possession'), grito: () => L('Bola no pé, gira!', 'Keep it, move it!') },
  { id: 'defend', fala: ['recua', 'fecha a casinha', 'retranca', 'defende', 'segura o resultado', 'todo mundo atras', 'park the bus', 'defend', 'sit back'], rotulo: () => L('Defender', 'Defend'), grito: () => L('Fecha atrás!', 'Shut it down!') },
];

const GRITOS: { id: 'incentivar' | 'cobrar' | 'acalmar'; fala: string[]; rotulo: () => string; resposta: () => string }[] = [
  { id: 'acalmar', fala: ['calma', 'tranquilo', 'tranquilidade', 'respira', 'sem pressa', 'calm down', 'easy', 'relax'], rotulo: () => L('Acalmar', 'Calm down'), resposta: () => L('Calma, rapaziada!', 'Easy, lads!') },
  { id: 'cobrar', fala: ['acorda', 'corre', 'aperta', 'quero ver', 'cobra', 'cobrar', 'vergonha', 'wake up', 'run', 'come on now'], rotulo: () => L('Cobrar', 'Demand'), resposta: () => L('Aperta, rapaziada!', 'Pick it up, lads!') },
  { id: 'incentivar', fala: ['vamo', 'vamos', 'bora', 'forca', 'acredita', 'incentiva', 'vai', 'lets go', 'come on', 'believe'], rotulo: () => L('Incentivar', 'Fire up'), resposta: () => L('Bora, professor!', "Let's go, boss!") },
];

const RESPOSTAS = [() => L('Deixa comigo, professor!', 'Leave it to me, boss!'), () => L('Entendido!', 'Got it!'), () => L('É pra já!', 'On it!')];
let girar = 0;
const respostaDoCapitao = () => RESPOSTAS[girar++ % RESPOSTAS.length]!();

const naoEntendi = (texto: string): Entendido => ({ tipo: 'duvida', texto: L(`Não entendi: "${texto}"`, `Didn't get that: "${texto}"`) });

/** A frase → o comando (ou a dúvida). `texto` é o que o reconhecedor ouviu. */
export function entenderComando(textoOriginal: string, ctx: ContextoDaVoz): Entendido {
  const t = normalizar(textoOriginal);
  if (!t) return naoEntendi(textoOriginal);

  // 1) DECISÃO ABERTA (momento decisivo, pênalti, lesão, analista, reação): a frase responde a ela.
  if (ctx.decisao) {
    const d = ctx.decisao;
    if (d.tipo === 'decisivo') {
      for (const op of d.opcoes) {
        if ((OPCOES_FALADAS[op.id] ?? []).some((f) => tem(t, f)) || tem(t, normalizar(op.rotulo))) {
          return { tipo: 'ok', id: op.id, entendi: op.rotulo, fala: `${op.rotulo}!` };
        }
      }
    } else if (d.tipo === 'penalti' || d.tipo === 'lesao') {
      const candidatos = d.opcoes.map((o) => ({ id: o.id, nome: o.rotulo, slot: '', fadiga: 0 }));
      const q = acharJogador(t, candidatos);
      if (q === 'ambiguo') return { tipo: 'duvida', texto: L('Qual deles? Diga o nome inteiro.', 'Which one? Say the full name.') };
      if (q) {
        return d.tipo === 'penalti'
          ? { tipo: 'ok', id: q.quem.id, entendi: L(`${primeiroNome(q.quem.nome)} bate o pênalti`, `${primeiroNome(q.quem.nome)} takes the penalty`), fala: L('Deixa que eu bato!', "I'll take it!") }
          : { tipo: 'ok', id: q.quem.id, entendi: L(`entra ${primeiroNome(q.quem.nome)}`, `${primeiroNome(q.quem.nome)} comes on`), fala: L('Tô pronto, professor!', 'Ready, boss!') };
      }
    } else {
      // Analista / reação: a opção cujo rótulo foi dito.
      const op = d.opcoes.find((o) => { const r = normalizar(o.rotulo); return r && (t.includes(r) || r.split(' ').filter((w) => w.length > 3).some((w) => tem(t, w))); });
      if (op) return { tipo: 'ok', id: op.id, entendi: op.rotulo, fala: respostaDoCapitao() };
    }
  }

  // 2) TROCA: "sai X entra Y" · "tira X (e) (coloca|bota|poe|entra) Y" · "Y no lugar do X" · "troca X por Y" · "sub X for Y".
  const direta = /(?:^| )(?:sai|tira|troca|substitui|sub|take off|bring off)(?: o| a)? (.+?)(?: e)? (?:entra|coloca|bota|poe|pelo|pela|por|for|bring on|put on)(?: o| a)? (.+)$/.exec(t);
  const noLugar = direta ? null : /(?:^| )(?:(?:entra|coloca|bota|poe|bring on|put on)(?: o| a)? )?(.+?) (?:no lugar d[oa]|na vaga d[oa]|in place of|for)(?: o| a)? (.+)$/.exec(t);
  const troca = direta ?? (noLugar && !/(?:^| )(?:marca|mark)( |$)/.test(t) ? noLugar : null);
  if (troca) {
    const [trechoSai, trechoEntra] = direta ? [troca[1]!, troca[2]!] : [troca[2]!, troca[1]!];
    if (ctx.subsRestantes <= 0) return { tipo: 'duvida', texto: L('Professor, não tem mais troca.', 'Boss, no subs left.') };
    const sai = acharJogador(trechoSai, ctx.casa, { cansado: true });
    const entra = acharReserva(trechoEntra, ctx.banco);
    if (sai === 'ambiguo' || entra === 'ambiguo') return { tipo: 'duvida', texto: L('Quem exatamente? Diga o nome.', 'Who exactly? Say the name.') };
    if (!sai) return { tipo: 'duvida', texto: L(`Não achei quem sai em "${trechoSai}".`, `Couldn't find who comes off in "${trechoSai}".`) };
    if (!entra) return { tipo: 'duvida', texto: L(`Não achei no banco: "${trechoEntra}".`, `Not on the bench: "${trechoEntra}".`) };
    return {
      tipo: 'ok', id: `sub:${sai.quem.id}|${entra.quem.id}`, confirmar: true,
      entendi: L(`sai ${primeiroNome(sai.quem.nome)}, entra ${primeiroNome(entra.quem.nome)}`, `${primeiroNome(sai.quem.nome)} off, ${primeiroNome(entra.quem.nome)} on`),
      fala: L(`${primeiroNome(entra.quem.nome)}, vai pro jogo!`, `${primeiroNome(entra.quem.nome)}, you're on!`),
    };
  }

  // 3) FORMAÇÃO: "4-4-2", "vamos de 3 zagueiros", "três atrás".
  const f = /(\d)[ -](\d)[ -](\d)(?:[ -](\d))?/.exec(t);
  const porZagueiros = /(\d) (?:zagueiros|atras|na defesa|at the back|centre backs|center backs)/.exec(t);
  const formacao = f ? f.slice(1).filter(Boolean).join('-') : porZagueiros ? ctx.formacoes.find((x) => x.startsWith(porZagueiros[1]!)) : undefined;
  if (formacao && ctx.formacoes.includes(formacao)) {
    return { tipo: 'ok', id: `formacao:${formacao}`, entendi: L(`formação ${formacao}`, `${formacao} formation`), fala: L('Mudando, professor!', 'Changing it, boss!') };
  }

  // 4) LENDA: "ativa a lenda", "chama o <nome da lenda>".
  if (ctx.lendas.length && tem(t, 'lenda', 'legend', 'legacy')) {
    const q = acharJogador(t, ctx.lendas.map((l) => ({ id: l.id, nome: l.nome, slot: '', fadiga: 0 })));
    const lenda = q && q !== 'ambiguo' ? q.quem : ctx.lendas[0]!;
    return { tipo: 'ok', id: `lenda:${lenda.id}`, entendi: L(`lenda ${primeiroNome(lenda.nome)}`, `legend ${primeiroNome(lenda.nome)}`), fala: L('É a minha hora!', 'My time now!') };
  }

  // 5) ORDEM INDIVIDUAL: o nosso jogador citado + o que ele faz.
  const nosso = acharJogador(t, ctx.casa);
  const quer = {
    marcar: tem(t, 'marca', 'marcar', 'gruda', 'em cima d[oa]', 'cola', 'mark', 'man mark', 'track'),
    // "não sobe" / "não avança" é SEGURAR (a negação vence o verbo).
    espaco: !tem(t, 'nao sobe', 'nao avanca', 'nao vai', 'dont go') && tem(t, 'ataca o espaco', 'atacar o espaco', 'nas costas', 'ataca', 'avanca', 'vai pra frente', 'sobe', 'attack the space', 'get forward', 'run in behind'),
    segurar: tem(t, 'segura a posicao', 'segura', 'fica', 'nao sobe', 'nao avanca', 'guarda posicao', 'hold', 'hold your position', 'stay back'),
  };
  if (nosso && nosso !== 'ambiguo' && (quer.marcar || quer.espaco || quer.segurar)) {
    const nome = primeiroNome(nosso.quem.nome);
    if (quer.marcar) {
      // O alvo é o rival citado DEPOIS do verbo (ou o mais perigoso, se não disser).
      const resto = t.split(' ').filter((w) => !tokensDoNome(nosso.quem.nome).includes(w)).join(' ');
      const deles = acharJogador(resto, ctx.fora);
      if (deles === 'ambiguo') return { tipo: 'duvida', texto: L('Marcar qual deles?', 'Mark which one?') };
      if (deles) {
        return { tipo: 'ok', id: `marcar:${nosso.quem.id}|${deles.quem.id}`, entendi: L(`${nome} marca ${primeiroNome(deles.quem.nome)}`, `${nome} marks ${primeiroNome(deles.quem.nome)}`), fala: L('Deixa comigo, professor!', 'Leave him to me, boss!') };
      }
      return { tipo: 'ok', id: `ordem:${nosso.quem.id}:marcar`, entendi: L(`${nome} marca de perto`, `${nome} marks tight`), fala: L('Deixa comigo, professor!', 'Leave him to me, boss!') };
    }
    if (quer.segurar && !quer.espaco) return { tipo: 'ok', id: `ordem:${nosso.quem.id}:segurar`, entendi: L(`${nome} segura a posição`, `${nome} holds position`), fala: L('Tô fixo aqui!', 'Holding here!') };
    return { tipo: 'ok', id: `ordem:${nosso.quem.id}:atacar_espaco`, entendi: L(`${nome} ataca o espaço`, `${nome} attacks the space`), fala: L('Vou nas costas!', 'Going in behind!') };
  }
  if (nosso === 'ambiguo' && (quer.marcar || quer.espaco || quer.segurar)) return { tipo: 'duvida', texto: L('Qual jogador? Diga o nome.', 'Which player? Say the name.') };

  // 6) ESTILO (antes do grito: "toca a bola" é estilo, "aperta" é grito).
  for (const e of ESTILOS) {
    if (e.fala.some((x) => tem(t, x))) return { tipo: 'ok', id: `estilo:${e.id}`, entendi: L(`estilo ${e.rotulo()}`, `${e.rotulo()} style`), fala: e.grito() };
  }
  // 7) GRITO.
  for (const g of GRITOS) {
    if (g.fala.some((x) => tem(t, x))) return { tipo: 'ok', id: `grito:${g.id}`, entendi: L(`grito "${g.rotulo()}"`, `"${g.rotulo()}" shout`), fala: g.resposta() };
  }
  return naoEntendi(textoOriginal);
}

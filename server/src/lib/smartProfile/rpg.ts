/**
 * RPG DO JOGADOR (Fase 4) — nível, XP e traços saem de campo decorativo.
 *
 * A régua aqui é uma só: TRAÇO QUE NÃO CHEGA AO MOTOR É ENFEITE. Foi a crítica
 * que a `form` e a moral levaram — números escritos a cada partida que a
 * simulação ignorava. Então cada traço deste catálogo tem um efeito nos
 * atributos que vão ao Python, e o efeito é aplicado PELO SERVIDOR.
 *
 * Só dá para fazer isso agora por causa da Fase 3: o servidor passou a ser o
 * dono da entrada do motor. O efeito entra DEPOIS da conferência, então o
 * envelope de tilts do cliente não precisa ser alargado — o celular nem sabe
 * que o traço existe, e não teria como reivindicá-lo.
 *
 * Tudo aqui é puro: `runRpgSelfTest.mts` cobre curva, concessão e efeito.
 */
import { ATRIBUTOS_NUCLEO, type AtributoNucleo, type ClasseId } from './tipos.js';

export const NIVEL_MAXIMO = 50;

/**
 * XP acumulado para alcançar um nível: `12 × (n−1)^1.5`.
 *
 *   nível  2 →     12        nível 10 →   324
 *   nível  5 →     96        nível 20 →   994
 *   nível 30 →  1.900        nível 50 → 4.100
 *
 * Uma partida credita ~6 a 10 de XP (`evoluirPorPartida`), então o nível 5 vem
 * em ~12 partidas, o 10 em ~40 e o 50 é carreira inteira. São números de
 * calibragem, não de arquitetura: mexer aqui não mexe em mais nada.
 */
export function xpParaNivel(nivel: number): number {
  const n = Math.max(1, Math.min(NIVEL_MAXIMO, Math.round(nivel)));
  return n <= 1 ? 0 : Math.round(12 * Math.pow(n - 1, 1.5));
}

/** Nível de quem tem este XP. Monótono e capado em 50. */
export function nivelPorXp(xp: number): number {
  const total = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  let nivel = 1;
  while (nivel < NIVEL_MAXIMO && total >= xpParaNivel(nivel + 1)) nivel++;
  return nivel;
}

/** Quanto falta para o próximo nível (0 no nível máximo) — pra barra na tela. */
export function faltaParaOProximo(xp: number): { nivel: number; falta: number; doNivel: number; doProximo: number } {
  const nivel = nivelPorXp(xp);
  const doNivel = xpParaNivel(nivel);
  const doProximo = nivel >= NIVEL_MAXIMO ? doNivel : xpParaNivel(nivel + 1);
  return { nivel, falta: Math.max(0, doProximo - Math.max(0, xp)), doNivel, doProximo };
}

/** O que o jogador acumulou na carreira — vive em `player_profiles.vinculo`. */
export interface Carreira {
  partidas: number;
  gols: number;
  vitorias: number;
}

export const carreiraDe = (vinculo: Record<string, unknown> | null | undefined): Carreira => {
  const v = vinculo ?? {};
  const n = (k: string) => {
    const x = v[k];
    return typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0;
  };
  return { partidas: n('partidas'), gols: n('gols'), vitorias: n('vitorias') };
};

const GRUPO_ATAQUE = new Set<ClasseId>(['ponta_driblador', 'velocista', 'pivo', 'falso_9', 'matador', 'meia_chegada']);
const GRUPO_DEFESA = new Set<ClasseId>(['paredao', 'goleiro_libero', 'xerife', 'zagueiro_construtor', 'lateral_marcador', 'lateral_apoiador', 'volante_destruidor']);

export interface Traco {
  id: string;
  nome: string;
  /** O que o jogador precisa fazer. */
  comoSeGanha: string;
  /** Efeito no atributo que vai ao motor. Pequeno de propósito. */
  atributo: AtributoNucleo;
  bonus: number;
  ganhou: (ctx: { nivel: number; carreira: Carreira; classe: ClasseId }) => boolean;
}

/**
 * Catálogo inicial — 5 traços, cada um ganho por algo que o jogo JÁ produz
 * (partidas, gols, vitórias, nível) e com efeito de +2 ou +3 num atributo.
 *
 * Deliberadamente pequeno. O catálogo é a parte fácil de trocar; o que custou
 * foi o caminho do efeito até o motor.
 */
export const TRACOS: Traco[] = [
  {
    id: 'matador', nome: 'Matador', comoSeGanha: '10 gols na carreira',
    atributo: 'finalizacao', bonus: 3,
    ganhou: ({ carreira, classe }) => carreira.gols >= 10 && GRUPO_ATAQUE.has(classe),
  },
  {
    id: 'maestro', nome: 'Maestro', comoSeGanha: 'nível 10',
    atributo: 'passe', bonus: 3,
    ganhou: ({ nivel }) => nivel >= 10,
  },
  {
    id: 'xerifao', nome: 'Xerifão', comoSeGanha: '25 partidas na defesa',
    atributo: 'marcacao', bonus: 3,
    ganhou: ({ carreira, classe }) => carreira.partidas >= 25 && GRUPO_DEFESA.has(classe),
  },
  {
    id: 'veterano', nome: 'Veterano', comoSeGanha: '50 partidas',
    atributo: 'mentalidade', bonus: 2,
    ganhou: ({ carreira }) => carreira.partidas >= 50,
  },
  {
    id: 'incansavel', nome: 'Incansável', comoSeGanha: 'nível 20',
    atributo: 'fisico', bonus: 2,
    ganhou: ({ nivel }) => nivel >= 20,
  },
];

const porId = new Map(TRACOS.map((t) => [t.id, t]));

/** Ids de traço válidos que estão na ficha (ignora lixo do passado). */
export function tracosDaFicha(bruto: unknown[] | null | undefined): string[] {
  const vistos = new Set<string>();
  for (const t of bruto ?? []) {
    const id = typeof t === 'string' ? t : (t as { id?: unknown })?.id;
    if (typeof id === 'string' && porId.has(id)) vistos.add(id);
  }
  return [...vistos];
}

/** Traços que o jogador acabou de conquistar (só os que ainda não tem). */
export function tracosGanhos(ctx: {
  nivel: number; carreira: Carreira; classe: ClasseId; tracos: unknown[] | null | undefined;
}): string[] {
  const jaTem = new Set(tracosDaFicha(ctx.tracos));
  return TRACOS.filter((t) => !jaTem.has(t.id) && t.ganhou(ctx)).map((t) => t.id);
}

/** Teto por atributo e no total: traço é tempero, não segunda carreira. */
export const TETO_POR_ATRIBUTO = 3;
export const TETO_TOTAL = 6;

/**
 * Efeito somado dos traços, já limitado. Dois traços no mesmo atributo não
 * passam de +3 ali, e a soma de tudo não passa de +6 no jogador.
 */
export function efeitoDosTracos(tracos: unknown[] | null | undefined): Partial<Record<AtributoNucleo, number>> {
  const ids = tracosDaFicha(tracos);
  const bruto: Partial<Record<AtributoNucleo, number>> = {};
  for (const id of ids) {
    const t = porId.get(id)!;
    bruto[t.atributo] = Math.min(TETO_POR_ATRIBUTO, (bruto[t.atributo] ?? 0) + t.bonus);
  }
  // Teto total: corta do menor bônus para o maior, pra não zerar o traço forte.
  let total = ATRIBUTOS_NUCLEO.reduce((s, k) => s + (bruto[k] ?? 0), 0);
  if (total <= TETO_TOTAL) return bruto;
  const ordem = ATRIBUTOS_NUCLEO.filter((k) => (bruto[k] ?? 0) > 0).sort((a, b) => (bruto[a] ?? 0) - (bruto[b] ?? 0));
  for (const k of ordem) {
    while ((bruto[k] ?? 0) > 0 && total > TETO_TOTAL) { bruto[k] = (bruto[k] ?? 0) - 1; total--; }
    if ((bruto[k] ?? 0) === 0) delete bruto[k];
  }
  return bruto;
}

/** Nome e como se ganha, pro cliente mostrar sem duplicar o catálogo. */
export const catalogoDeTracos = () =>
  TRACOS.map(({ id, nome, comoSeGanha, atributo, bonus }) => ({ id, nome, comoSeGanha, atributo, bonus }));

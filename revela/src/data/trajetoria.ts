/**
 * A TRAJETÓRIA — o plano de carreira do atleta, em OLEKO.
 *
 * ⚠️ QUEM MANDA É O BANCO. Todo número aqui espelha
 * `supabase/migrations/20260803120000_revela_trajetoria_oleko.sql`. Este arquivo
 * existe pra DESENHAR a tela — nunca pra decidir quanto vale. Se os dois
 * divergirem, o painel do atleta e o ranking público mostrariam totais
 * diferentes, e um dos dois pagaria prêmio errado.
 *
 * OLEKO não se gasta: acumula. É placar, não carteira. O que se gasta é o EXP
 * que cada divisão libera — e esse só é sacado com clube criado no game.
 */

export interface Divisao {
  id: number;
  slug: 'fraldinha' | 'junior' | 'sub17' | 'pro' | 'campeao';
  nome: string;
  /** OLEKO exigido. */
  meta: number;
  /** Prêmio em EXP do game ao conquistar. */
  exp: number;
}

export const DIVISOES: readonly Divisao[] = [
  { id: 1, slug: 'fraldinha', nome: 'Fraldinha', meta: 0, exp: 0 },
  { id: 2, slug: 'junior', nome: 'Junior', meta: 2_500, exp: 250_000 },
  { id: 3, slug: 'sub17', nome: 'Sub 17', meta: 10_000, exp: 500_000 },
  { id: 4, slug: 'pro', nome: 'Pro', meta: 30_000, exp: 2_000_000 },
  { id: 5, slug: 'campeao', nome: 'Campeão', meta: 75_000, exp: 8_000_000 },
] as const;

/**
 * As quatro chaves. Um moleque de escolinha não corre contra um ex-profissional
 * com 40 mil seguidores — no mesmo ranking ele desiste na primeira olhada, e é
 * exatamente quem a campanha existe pra atrair.
 */
export const CHAVES: Record<string, string> = {
  escolinha: 'Novos talentos',
  junior: 'Amadores',
  profissional: 'Pro',
  lenda: 'Lendas',
};

export type MissaoGrupo = 'comece' | 'semana' | 'metas';

/** Uma linha do painel — espelha o item de `missoes` no retorno da RPC. */
export interface Missao {
  id: string;
  grupo: MissaoGrupo;
  label: string;
  oleko: number;
  feita: boolean;
  /** Marcos com progresso (fãs, rede) trazem alvo e atual. */
  alvo?: number;
  atual?: number;
  lendas?: number;
}

export interface Trajetoria {
  oleko: number;
  creditado: number;
  divisao: Divisao;
  proxima: Divisao | null;
  chave: string;
  fas: number;
  indicados: number;
  lendas: number;
  temClube: boolean;
  expGame: number;
  missoes: Missao[];
}

/**
 * Missões semanais do Instagram e do highlight.
 *
 * Não vêm da RPC porque não dá pra derivar do banco: ninguém sabe se a pessoa
 * marcou @olefootgame olhando só pra nossa tabela. Ficam aqui como CONVITE —
 * o crédito entra por `revela_oleko_grant` depois da conferência.
 *
 * (A Meta expõe o webhook `mentions` pra marcação em post e comentário, o que
 * automatiza esta parte; mas exige App Review, que não fica pronto pra largada.)
 */
export const MISSOES_SEMANA: readonly { id: string; label: string; oleko: number; comoFazer: string }[] = [
  {
    id: 'insta_post',
    label: 'Marque @olefootgame num post ou reels',
    oleko: 1000,
    comoFazer: 'Poste seu lance e marque a gente na legenda.',
  },
  {
    id: 'insta_story',
    label: 'Marque @olefootgame num story',
    oleko: 500,
    comoFazer: 'Story some em 24h — por isso vale menos, mas é o mais fácil.',
  },
  {
    id: 'highlight',
    label: 'Publique um highlight novo',
    oleko: 300,
    comoFazer: 'Um lance de 15 segundos do último treino ou jogo.',
  },
] as const;

/** Uma linha do placar — espelha `revela_trajetoria_ranking`. */
export interface LinhaRanking {
  pos: number;
  slug: string;
  name: string;
  portrait: string | null;
  chave: string;
  /** No recorte de tempo, é o OLEKO GANHO na janela — não o total. */
  oleko: number;
  fas: number;
  /** Fãs que entraram na janela. Zero quando o recorte é "Sempre". */
  fasJanela?: number;
  divisao: Divisao;
}

/**
 * Recortes de tempo do placar.
 *
 * ⚠️ JANELA MEDE MOVIMENTO, NÃO ACERVO. Só duas fontes de OLEKO têm data:
 * os fãs (um a um) e o livro-razão (Instagram, pódio). Foto, vídeo, @, aval do
 * scout, clube e rede são estados derivados — o banco sabe que ESTÁ feito, não
 * QUANDO foi. Num recorte de 24h eles não entram, e é o certo: a pergunta ali é
 * "quem correu hoje", não "quem tem mais".
 */
export const PERIODOS = [
  { id: 'all', label: 'Sempre' },
  { id: '24h', label: '24 horas' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: 'Mês' },
] as const;

export type PeriodoId = (typeof PERIODOS)[number]['id'];

/** As chaves na ordem em que aparecem nas abas do placar. */
export const ORDEM_CHAVES: readonly string[] = ['escolinha', 'junior', 'profissional', 'lenda'];

/** Progresso 0..1 dentro da divisão atual. */
export function progressoDivisao(t: Trajetoria): number {
  if (!t.proxima) return 1;
  const base = t.divisao.meta;
  const span = t.proxima.meta - base;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (t.oleko - base) / span));
}

/** Quanto falta de OLEKO pra próxima divisão. */
export function faltaPraProxima(t: Trajetoria): number {
  if (!t.proxima) return 0;
  return Math.max(0, t.proxima.meta - t.oleko);
}

/**
 * O EXP já conquistado nas divisões — soma cumulativa até a atual.
 * É o número que a tela usa pra dizer "tem X EXP esperando por você".
 */
export function expConquistado(divisaoId: number): number {
  return DIVISOES.filter((d) => d.id <= divisaoId).reduce((s, d) => s + d.exp, 0);
}

export const ptBrNum = (n: number) => n.toLocaleString('pt-BR');

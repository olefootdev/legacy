/**
 * Cliente do REVELA — só RPC, nunca `.from(tabela)`.
 *
 * POR QUÊ SÓ RPC: este site roda anônimo, com a anon key embutida no bundle.
 * Toda vez que este projeto leu tabela direto de um contexto público, vazou
 * e-mail (/api/admin/profiles em julho, global_league_teams uma semana depois).
 * Os RPCs de 20260723120000 têm lista branca de colunas — é ali que a garantia
 * mora, não na UI.
 */
import { getSupabase } from '@/supabase/client';
import type { RespostasDna, ResultadoDna } from './dna';
import type { DivisionCount, DnaPublico, Legend, Talent } from './types';
import type { LinhaRanking, PeriodoId, Trajetoria } from './trajetoria';

type TalentOrder = 'overall' | 'supporters' | 'recent';

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc(fn, args ?? {});
  if (error) {
    console.warn(`[revela] ${fn} falhou:`, error.message);
    return null;
  }
  return (data ?? null) as T | null;
}

export async function fetchTalents(limit = 24, order: TalentOrder = 'overall'): Promise<Talent[]> {
  const rows = await rpc<Talent[]>('revela_list_talents', { p_limit: limit, p_order: order });
  return rows ?? [];
}

export async function fetchTalent(slug: string): Promise<Talent | null> {
  return rpc<Talent>('revela_get_talent', { p_slug: slug });
}

/** Resolução do link curto revela.olefoot.com/<handle>. */
export interface ResolvedHandle {
  found: boolean;
  kind?: 'talent' | 'legend';
  slug?: string;
  /** Código de indicação do dono (pra creditar a rede). Null se ele ainda não é manager. */
  refCode?: string | null;
}

export async function resolveHandle(handle: string): Promise<ResolvedHandle> {
  const res = await rpc<ResolvedHandle>('revela_resolve_handle', { p_handle: handle });
  return res ?? { found: false };
}

export async function fetchLegends(limit = 12): Promise<Legend[]> {
  const rows = await rpc<Legend[]>('revela_list_legends', { p_limit: limit });
  return rows ?? [];
}

export async function fetchDivisions(): Promise<DivisionCount[]> {
  const rows = await rpc<DivisionCount[]>('revela_divisions');
  return rows ?? [];
}

/** Um clube numa tabela de divisão (a tela retro estilo Elifoot). */
export interface StandingTeam {
  pos: number;
  club: string;
  short: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  crestId: number | null;
}

export interface DivisionStanding {
  division: number;
  teams: StandingTeam[];
  totalClubs: number;
}

/**
 * Classificação da Liga Global por divisão. Agrupa dinamicamente — 3 ou 4
 * divisões, o que a liga tiver. Alimenta a seção retro do REVELA.
 */
export async function fetchStandings(perDivision = 8): Promise<DivisionStanding[]> {
  const rows = await rpc<DivisionStanding[]>('revela_standings', { p_per_division: perDivision });
  return (rows ?? []).sort((a, b) => a.division - b.division);
}

/** Um artilheiro no placar de gols — jogador real que marcou em partidas ao vivo. */
export interface TopScorer {
  playerId: string;
  name: string;
  pos: string | null;
  club: string | null;
  goals: number;
  assists: number;
  matches: number;
}

/**
 * Artilharia real: soma dos gols de cada jogador em partidas ao vivo do jogo.
 *
 * NÃO é da Liga Global (times simulados, sem elenco). É o gol de verdade — do
 * plantel do manager, incluindo lendas e talentos — que o motor computa e o
 * banco acumula. Vazio até as partidas gerarem histórico; a UI some sozinha.
 */
export async function fetchTopScorers(limit = 10, season = 'current'): Promise<TopScorer[]> {
  const rows = await rpc<TopScorer[]>('revela_top_scorers', { p_limit: limit, p_season: season });
  return rows ?? [];
}

/**
 * Apoiar exige conta — decisão de produto, não limitação técnica. Apoio anônimo
 * infla contador e não converte ninguém; apoio com conta vira cadastro e credita
 * a rede de quem trouxe o link.
 */
export type SupportFailure = 'auth_required' | 'not_found' | 'offline';

/**
 * Uma forma só em vez de união discriminada: o tsconfig do REVELA não roda em
 * `strict` (o src/ compartilhado não é strict-clean), e sem ele o TS não estreita
 * união por `ok: true | false`. Campo opcional é chato, mas não mente.
 */
export interface SupportResult {
  ok: boolean;
  supporters: number;
  reason?: SupportFailure;
}

export async function supportTalent(talentId: string): Promise<SupportResult> {
  const res = await rpc<{ ok: boolean; supporters?: number; reason?: string }>(
    'revela_support_talent',
    { p_talent_id: talentId },
  );
  if (!res) return { ok: false, supporters: 0, reason: 'offline' };
  if (res.ok) return { ok: true, supporters: res.supporters ?? 0 };
  return { ok: false, supporters: 0, reason: (res.reason as SupportFailure) ?? 'not_found' };
}

/** Apoios já dados por esta conta — remarca "NA TORCIDA" ao voltar na página. */
export async function fetchMySupports(): Promise<string[]> {
  const ids = await rpc<string[]>('revela_my_supports');
  return ids ?? [];
}

export interface SubmitTalentInput {
  /**
   * Token do desafio anti-bot, quando o widget está montado. Sem ele o envio
   * segue pelo caminho direto — é o que mantém o funil vivo enquanto o widget
   * não existe no painel da Cloudflare.
   */
  turnstileToken?: string;
  /** Nome de documento — o card sai com ele. */
  name: string;
  pos: string;
  /** Obrigatório: sem conta, o WhatsApp é a identidade do cadastro. */
  contactPhone: string;
  /** @username OBRIGATÓRIO — vira revela.olefoot.com/<handle> (perfil + indicação). */
  handle: string;
  nickname?: string;
  category?: string;
  strongFoot?: string;
  birthYear?: number;
  heightCm?: number;
  /** Só quando o atleta tem menos de 18 — o servidor exige e valida. */
  guardianName?: string;
  guardianPhone?: string;
  gameSituation?: string;
  hasAgent?: boolean;
  agentName?: string;
  club?: string;
  city?: string;
  uf?: string;
  dream?: string;
  videoUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  photoUrl?: string;
  referralCode?: string;
}

// Sem `auth_required`: o submit é anônimo (grant pra anon desde a v2), então o
// RPC nunca retorna isso. Deixar no tipo era código morto que enganava a leitura.
export type SubmitFailure =
  | 'invalid_name'
  | 'invalid_pos'
  | 'invalid_phone'
  | 'handle_invalid'
  | 'handle_taken'
  | 'guardian_required'
  | 'already_submitted'
  /** A conta logada já tem ficha. Trava do trigger 20260805180000. */
  | 'account_has_talent'
  | 'offline';

/** Disponibilidade do @username (confirmação em tempo real no cadastro). */
export type HandleStatus = 'ok' | 'invalid' | 'reserved' | 'taken' | 'offline';

export async function checkHandle(handle: string): Promise<HandleStatus> {
  const res = await rpc<{ ok: boolean; reason?: string }>('revela_check_handle', {
    p_handle: handle,
  });
  if (!res) return 'offline';
  if (res.ok) return 'ok';
  return (res.reason as HandleStatus) ?? 'invalid';
}

/** Mesma razão do SupportResult acima: uma forma só, sem união discriminada. */
export interface SubmitResult {
  ok: boolean;
  id?: string;
  slug?: string;
  reason?: SubmitFailure;
}

const SUBMIT_FAILURES: readonly SubmitFailure[] = [
  'invalid_name',
  'invalid_pos',
  'invalid_phone',
  'handle_invalid',
  'handle_taken',
  'guardian_required',
  'already_submitted',
  'account_has_talent',
  'offline',
];

function asSubmitFailure(reason: unknown): SubmitFailure {
  return SUBMIT_FAILURES.includes(reason as SubmitFailure) ? (reason as SubmitFailure) : 'offline';
}

/**
 * Envia o cadastro do talento.
 *
 * NÃO exige conta desde a migration 20260723210000: o atleta preenche e envia,
 * a conta vem na aprovação. O que segura repetição é o telefone, único por
 * cadastro — por isso ele é o único campo de contato obrigatório.
 */
export async function submitTalent(input: SubmitTalentInput): Promise<SubmitResult> {
  const args = {
      p_name: input.name,
      p_pos: input.pos,
      p_contact_phone: input.contactPhone,
      p_handle: input.handle,
      p_nickname: input.nickname ?? null,
      p_category: input.category ?? null,
      p_strong_foot: input.strongFoot ?? null,
      p_birth_year: input.birthYear ?? null,
      p_height_cm: input.heightCm ?? null,
      p_guardian_name: input.guardianName ?? null,
      p_guardian_phone: input.guardianPhone ?? null,
      p_game_situation: input.gameSituation ?? null,
      p_has_agent: input.hasAgent ?? null,
      p_agent_name: input.agentName ?? null,
      p_club: input.club ?? null,
      p_city: input.city ?? null,
      p_uf: input.uf ?? null,
      p_dream: input.dream ?? null,
      p_video_url: input.videoUrl ?? null,
      p_instagram_url: input.instagramUrl ?? null,
      p_tiktok_url: input.tiktokUrl ?? null,
      p_photo_url: input.photoUrl ?? null,
      p_referral_code: input.referralCode ?? null,
  };

  /**
   * CAMINHO PROTEGIDO — quando existe token do Turnstile, o envio passa pelo
   * Worker (`/api/enviar-talento`), que resolve o desafio antes de gravar. O
   * Postgres não enxerga IP nem valida desafio; essa checagem só existe no edge.
   *
   * O 503 tem significado: quer dizer que o Worker ainda não tem a secret
   * configurada. Nesse caso caímos no caminho antigo, para o funil não parar
   * enquanto o widget não é criado no painel da Cloudflare. Qualquer outra
   * resposta é definitiva — inclusive a recusa do desafio, que NÃO tenta de
   * novo pelo caminho aberto (senão o gate não gateia nada).
   */
  if (input.turnstileToken) {
    try {
      const r = await fetch('/api/enviar-talento', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: input.turnstileToken, args }),
      });
      if (r.status !== 503) {
        const body = (await r.json()) as { ok?: boolean; id?: string; slug?: string; reason?: string };
        if (body.ok && body.id && body.slug) return { ok: true, id: body.id, slug: body.slug };
        return { ok: false, reason: asSubmitFailure(body.reason) };
      }
    } catch {
      // Worker fora do ar — cai no caminho direto abaixo.
    }
  }

  /**
   * Chamada direta, SEM o `rpc()` genérico: aqui a mensagem de erro importa.
   *
   * A trava "uma conta, uma ficha" mora num trigger (migration 20260805180000)
   * e chega como exceção, não como `{ok:false}`. O `rpc()` engole exceção e
   * devolve null — a tela diria "sem conexão" pra um erro que não tem nada a
   * ver com rede. Aqui a gente lê a mensagem e traduz.
   */
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: 'offline' };
  const { data, error } = await sb.rpc('revela_submit_talent', args);

  if (error) {
    console.warn('[revela] revela_submit_talent falhou:', error.message);
    if (/account_has_talent/i.test(error.message)) {
      return { ok: false, reason: 'account_has_talent' };
    }
    return { ok: false, reason: 'offline' };
  }

  const res = data as { ok: boolean; id?: string; slug?: string; reason?: string } | null;
  if (!res) return { ok: false, reason: 'offline' };
  if (res.ok && res.id && res.slug) return { ok: true, id: res.id, slug: res.slug };
  return { ok: false, reason: asSubmitFailure(res.reason) };
}


/**
 * Salva o XI montado na CONTA da pessoa — não em localStorage.
 *
 * É o que substitui a captura de telefone do protótipo: a ponte pro jogo passa
 * a ser a própria conta Olefoot, que já existe e já tem a árvore de indicação
 * montada. Sem conta, o time não é gravado em lugar nenhum.
 */
export async function saveLineup(input: {
  teamName: string;
  formation: string;
  coach: string;
  slots: Array<string | null>;
}): Promise<boolean> {
  const res = await rpc<{ ok: boolean }>('revela_save_lineup', {
    p_team_name: input.teamName,
    p_formation: input.formation,
    p_coach: input.coach,
    p_slots: input.slots,
  });
  return Boolean(res?.ok);
}

/* ══ Conta do atleta (passo 2 do funil) ══════════════════════════════════════ */

export type ClaimFailure = 'auth_required' | 'account_has_talent' | 'not_claimable' | 'offline';

export interface ClaimResult {
  ok: boolean;
  slug?: string;
  reason?: ClaimFailure;
}

/**
 * Liga o cadastro recém-enviado à conta que acabou de entrar.
 *
 * Exige o `id` (devolvido só a quem enviou) e o telefone daquele cadastro — duas
 * provas, porque só o id transformaria "reivindicar" em "roubar perfil alheio".
 * O servidor ainda checa que o registro está órfão. Ver 20260723230000.
 */
export async function claimTalent(talentId: string, phone: string): Promise<ClaimResult> {
  const res = await rpc<{ ok: boolean; slug?: string; reason?: string }>('revela_claim_talent', {
    p_talent_id: talentId,
    p_phone: phone,
  });
  if (!res) return { ok: false, reason: 'offline' };
  return { ok: Boolean(res.ok), slug: res.slug, reason: res.reason as ClaimFailure | undefined };
}


/* ══ O perfil de quem está logado ══════════════════════════════════════════ */

/**
 * O talento da pessoa logada — a fonte do painel dela.
 *
 * `revela_my_talent()` filtra por `auth.uid()` no servidor e exclui recusado.
 * Devolve null pra quem tem conta mas ainda não reivindicou um perfil.
 */
export interface MeuTalento {
  id: string;
  slug: string;
  /** O @ curto: revela.olefoot.com/<handle>. Null enquanto ele não escolheu. */
  handle: string | null;
  /**
   * Se o link curto já CREDITA rede. Só vira true depois que o atleta cria o
   * clube no jogo — antes disso o link abre o perfil e não credita ninguém.
   */
  indicacaoAtiva?: boolean;
  name: string;
  pos: string;
  category: string | null;
  club: string | null;
  city: string | null;
  uf: string | null;
  portrait: string | null;
  overall: number | null;
  status: string;
  scoutNote: string | null;
  supporters: number;
  /**
   * O DNA do dono — aqui COM as respostas cruas, que é o que deixa ele refazer
   * o teste sem começar do zero. No perfil público só sai arquétipo + traços.
   */
  dna?: (DnaPublico & { respostas: RespostasDna }) | null;
  /** Autorização do responsável. O `token` só sai pro dono da ficha. */
  autorizacao?: { status: 'pending' | 'approved' | 'revoked'; token: string } | null;
  fotoEsperando?: boolean;
  createdAt: string;
}

export async function fetchMeuTalento(): Promise<MeuTalento | null> {
  return rpc<MeuTalento>('revela_my_talent');
}

/**
 * Grava o Player DNA do atleta logado.
 *
 * Manda as respostas cruas E o resultado calculado. A conta mora em
 * `data/dna.ts` (fonte única, com self-test) — o RPC valida forma e faixa, não
 * refaz a conta. O porquê dessa escolha está no cabeçalho da migration
 * 20260805120000: o arquétipo não paga nada, então forjar não rende, e duplicar
 * o mapa item→traço em PL/pgSQL criaria duas verdades.
 */
export async function salvarDna(
  respostas: RespostasDna,
  resultado: ResultadoDna,
): Promise<{ ok: boolean; reason?: string }> {
  const res = await rpc<{ ok: boolean; reason?: string }>('revela_save_dna', {
    p_respostas: respostas,
    p_tracos: resultado.tracos,
    p_arquetipo: resultado.arquetipo,
  });
  return res ?? { ok: false, reason: 'network' };
}

/* ══ Autorização do responsável (atleta menor de idade) ═══════════════════ */

export interface AutorizacaoVista {
  ok: boolean;
  status: 'pending' | 'approved' | 'revoked';
  atleta: string;
  nomeCompleto: string;
  pos: string | null;
  clube: string | null;
  cidade: string | null;
  uf: string | null;
  idade: number | null;
  foto: string | null;
  slug: string;
}

/** O que o responsável vê ao abrir o link. Anônimo — ele não tem conta. */
export async function verAutorizacao(token: string): Promise<AutorizacaoVista | null> {
  return rpc<AutorizacaoVista>('revela_ver_autorizacao', { p_token: token });
}

export type FalhaAutorizacao =
  | 'link_invalido'
  | 'ja_autorizado'
  | 'nome_incompleto'
  | 'cpf_invalido'
  | 'email_invalido'
  | 'telefone_invalido'
  | 'offline';

/**
 * O responsável assina.
 *
 * O CPF vai pro banco e NUNCA volta em leitura nenhuma — nem pro admin. Ele
 * existe como prova de que houve autorização, não como dado de perfil.
 */
export async function autorizarResponsavel(entrada: {
  token: string;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
}): Promise<{ ok: boolean; reason?: FalhaAutorizacao }> {
  const res = await rpc<{ ok: boolean; reason?: string }>('revela_autorizar', {
    p_token: entrada.token,
    p_nome: entrada.nome,
    p_cpf: entrada.cpf,
    p_email: entrada.email,
    p_fone: entrada.telefone,
    p_ua: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  });
  if (!res) return { ok: false, reason: 'offline' };
  return { ok: Boolean(res.ok), reason: res.reason as FalhaAutorizacao | undefined };
}

/**
 * A Trajetória do atleta logado — OLEKO, divisão e o estado de cada missão.
 *
 * Devolve `null` em dois casos que a tela trata igual (não mostra o bloco):
 * conta sem ficha, e migration ainda não aplicada. O painel continua de pé sem
 * a Trajetória — ela é camada, não alicerce.
 */
export async function fetchMinhaTrajetoria(): Promise<Trajetoria | null> {
  return rpc<Trajetoria>('revela_my_trajetoria');
}

/** Estado das provas desta semana, por missão. */
export type EstadoProva = 'pending' | 'approved' | 'rejected';
export type MinhasProvas = Record<string, { status: EstadoProva; note: string | null }>;

export async function fetchMinhasProvas(): Promise<MinhasProvas> {
  return (await rpc<MinhasProvas>('revela_minhas_provas')) ?? {};
}

/**
 * Manda o print da divulgação. A SEMANA é carimbada no servidor — se viesse
 * daqui, bastava mandar outra pra reenviar a mesma missão sem limite.
 */
export async function enviarProva(
  mission: string,
  imageUrl: string,
): Promise<{ ok: boolean; reason?: string }> {
  const r = await rpc<{ ok: boolean; reason?: string }>('revela_oleko_enviar_prova', {
    p_mission: mission,
    p_image_url: imageUrl,
  });
  return r ?? { ok: false, reason: 'offline' };
}

/**
 * O placar da Trajetória. `chave = null` traz o geral; com chave, só a
 * categoria (escolinha · junior · profissional · lenda).
 */
export async function fetchRankingTrajetoria(
  chave: string | null,
  limit = 20,
  periodo: PeriodoId = 'all',
): Promise<LinhaRanking[]> {
  const linhas = await rpc<LinhaRanking[]>('revela_trajetoria_ranking', {
    p_chave: chave,
    p_limit: limit,
    p_periodo: periodo,
  });
  return linhas ?? [];
}

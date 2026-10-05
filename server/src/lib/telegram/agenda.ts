/**
 * Postagens automáticas no grupo oficial (TELEGRAM_CHAT_ID).
 *
 * O servidor não tinha agendador — o resto do jogo agenda pelo pg_cron. Aqui
 * um setInterval de 1 minuto basta, porque o que importa é NÃO REPETIR:
 * cada (tipo, dia) é registrado em `telegram_postagens` antes de postar. Se o
 * Railway reiniciar às 20h25, ou subir duas instâncias, a segunda tentativa
 * bate na chave primária e desiste.
 *
 * Janela de 3h: um deploy às 23h não dispara o post das 20h atrasado.
 */
import { getSupabaseAdmin } from '../supabaseAdmin.js';
import { chatOficial, enviarMensagem, tokenDoBot } from './api.js';
import { textoMercado, textoMvp, textoRanking } from './conteudo.js';
import { hojeEmSaoPaulo, lerAltasDoMercado, lerMvpDeHoje, lerRanking } from './dados.js';

export interface Postagem {
  readonly tipo: 'mercado' | 'mvp' | 'ranking';
  readonly hora: number;   // horário de Brasília
  readonly minuto: number;
}

/** O MVP é criado às 20h00 pelo pg_cron; 20h05 dá folga pra ele existir. */
export const AGENDA: readonly Postagem[] = [
  { tipo: 'mercado', hora: 12, minuto: 0 },
  { tipo: 'mvp', hora: 20, minuto: 5 },
  { tipo: 'ranking', hora: 21, minuto: 30 },
];

const JANELA_MIN = 180;

/** Minutos desde a meia-noite em São Paulo. */
export function minutoDoDiaEmSaoPaulo(agora = new Date()): number {
  const [h = '0', m = '0'] = agora
    .toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour12: false, hour: '2-digit', minute: '2-digit' })
    .split(':');
  return Number(h) * 60 + Number(m);
}

/** As postagens cuja hora já passou e ainda estão dentro da janela. */
export function devidasAgora(agora = new Date()): Postagem[] {
  const m = minutoDoDiaEmSaoPaulo(agora);
  return AGENDA.filter((p) => {
    const alvo = p.hora * 60 + p.minuto;
    return m >= alvo && m < alvo + JANELA_MIN;
  });
}

async function textoDa(tipo: Postagem['tipo']): Promise<string | null> {
  if (tipo === 'mercado') { const l = await lerAltasDoMercado(); return l ? textoMercado(l) : null; }
  if (tipo === 'ranking') { const l = await lerRanking(1, 10); return l ? textoRanking(l, 1) : null; }
  const mvp = await lerMvpDeHoje();
  return mvp ? textoMvp(mvp) : null;   // sem leilão hoje, não posta "sem MVP"
}

/** Uma rodada: tenta cada postagem devida, uma vez por dia. Exportada pro teste e pro admin. */
export async function rodarAgenda(agora = new Date()): Promise<string[]> {
  const chat = chatOficial();
  const sb = getSupabaseAdmin();
  if (!chat || !sb || !tokenDoBot()) return [];
  const feitas: string[] = [];
  const dia = hojeEmSaoPaulo(agora);

  for (const p of devidasAgora(agora)) {
    // A trava: quem inserir primeiro posta. Conflito = já foi (ou outra instância está postando).
    const { error } = await sb.from('telegram_postagens').insert({ tipo: p.tipo, dia });
    if (error) continue;

    const texto = await textoDa(p.tipo);
    if (!texto) continue;   // sem conteúdo hoje (ex.: sem MVP) — a linha fica, não tenta de novo
    const r = await enviarMensagem(chat, texto);
    if (!r.ok) {
      // Falhou no Telegram: libera pra tentar no próximo minuto.
      await sb.from('telegram_postagens').delete().eq('tipo', p.tipo).eq('dia', dia);
      console.error('[telegram] post', p.tipo, r.description);
      continue;
    }
    feitas.push(p.tipo);
  }
  return feitas;
}

let ligado = false;
export function ligarAgenda(): void {
  if (ligado || !tokenDoBot() || !chatOficial()) return;
  ligado = true;
  setInterval(() => { void rodarAgenda().catch((e) => console.error('[telegram] agenda', e)); }, 60_000).unref();
  console.log('[telegram] agenda ligada:', AGENDA.map((p) => `${p.tipo} ${p.hora}:${String(p.minuto).padStart(2, '0')}`).join(', '));
}

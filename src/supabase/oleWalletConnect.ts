/**
 * O jogo conectando na OLEWALLET (A VIRADA · V1).
 *
 * A Phantom e a MetaMask são extensões: elas se injetam na página e o Wallet
 * Standard acha. A OLEWALLET é um site em outra origem — e é justamente por
 * isso que ela existe assim, pra um XSS aqui não alcançar o cofre dela. O
 * preço é que não dá pra "achar" a carteira: tem que ABRIR e conversar.
 *
 * O que NÃO muda: o resultado cai no mesmo `/api/wallet/solana/link` que a
 * Phantom usa, verificado pelo mesmo `verifySolanaLinkProof`. Uma porta só pro
 * destino do airdrop.
 *
 * Do lado de cá as regras são duas: só aceitar mensagem vinda da origem da
 * carteira, e mandar o "olá" só pra ela. O protocolo está em
 * `@/wallet/seed/conexao`, lido pelos dois lados.
 */
import { getSupabase } from '@/supabase/client';
import {
  OLA,
  ORIGEM_DA_CARTEIRA,
  ehPronto,
  respostaValida,
  urlDoPedido,
} from '@/wallet/seed/conexao';

const API_BASE =
  (import.meta.env.VITE_OLEFOOT_API_URL as string) ||
  (import.meta.env.VITE_API_URL as string) ||
  'http://localhost:4000';

/** Tempo pra pessoa achar a janela, digitar a senha e decidir. */
const PACIENCIA_MS = 3 * 60 * 1000;

export interface ResultadoOleWallet {
  ok: boolean;
  address: string | null;
  error: string | null;
}

/** O que a carteira devolve assinado, antes de virar requisição. */
interface Assinado {
  address: string;
  issuedAt: string;
  signature: string;
  signedMessage: string;
}

type DaJanela =
  | { ok: true; assinado: Assinado }
  | { ok: false; erro: string };

export function oleWalletDisponivel(): boolean {
  return typeof window !== 'undefined' && Boolean(ORIGEM_DA_CARTEIRA);
}

export async function conectarOleWallet(): Promise<ResultadoOleWallet> {
  const sb = getSupabase();
  if (!sb) return { ok: false, address: null, error: 'Sem conexão com a sua conta agora.' };
  const { data } = await sb.auth.getSession();
  const sessao = data.session;
  if (!sessao) return { ok: false, address: null, error: 'Entre na sua conta pra vincular.' };

  const issuedAt = new Date().toISOString();
  const url = urlDoPedido(ORIGEM_DA_CARTEIRA, { uid: sessao.user.id, issuedAt });

  // Tem que ser aberto DENTRO do clique, senão o navegador bloqueia o popup.
  const janela = window.open(url, 'olewallet', 'width=420,height=760,noopener=no');
  if (!janela) {
    return { ok: false, address: null, error: 'O navegador bloqueou a janela. Libere popups para este site.' };
  }

  const daJanela = await new Promise<DaJanela>((resolve) => {
    let pronto = false;
    const encerrar = (r: DaJanela) => {
      window.removeEventListener('message', aoReceber);
      clearInterval(vigia);
      clearTimeout(prazo);
      resolve(r);
    };

    function aoReceber(e: MessageEvent) {
      // Só a carteira fala aqui. Qualquer outra origem é ruído (ou ataque).
      if (e.origin !== ORIGEM_DA_CARTEIRA) return;

      if (ehPronto(e.data)) {
        pronto = true;
        // O "olá" é o que dá à carteira a NOSSA origem, pelo event.origin dela.
        janela.postMessage(OLA, ORIGEM_DA_CARTEIRA);
        return;
      }

      const r = respostaValida(e.origin, e.data);
      if (!r) return;
      if (r.tipo === 'recusado') { encerrar({ ok: false, erro: r.motivo }); return; }
      encerrar({
        ok: true,
        assinado: {
          address: r.address, issuedAt: r.issuedAt,
          signature: r.signature, signedMessage: r.signedMessage,
        },
      });
    }

    // Janela fechada no X: não deixa a promessa pendurada pra sempre.
    const vigia = setInterval(() => {
      if (janela.closed) {
        encerrar({ ok: false, erro: pronto ? 'Você fechou a janela.' : 'A carteira não respondeu.' });
      }
    }, 600);

    const prazo = setTimeout(
      () => encerrar({ ok: false, erro: 'Demorou demais. Tente de novo.' }),
      PACIENCIA_MS,
    );

    window.addEventListener('message', aoReceber);
  });

  // `daJanela.ok` não estreita aqui: o tsconfig do app não liga strict, e sem
  // strictNullChecks o TypeScript não separa os ramos de uma união discriminada.
  // Então o acesso é explícito em vez de um `as` que apagaria a checagem.
  if (!daJanela.ok) {
    return { ok: false, address: null, error: (daJanela as { erro: string }).erro };
  }
  const r = (daJanela as { assinado: Assinado }).assinado;

  // Daqui pra baixo é idêntico ao caminho da Phantom.
  try {
    const res = await fetch(`${API_BASE}/api/wallet/solana/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessao.access_token}` },
      body: JSON.stringify({
        address: r.address,
        issuedAt: r.issuedAt,
        signature: r.signature,
        signedMessage: r.signedMessage,
      }),
    });
    const json = (await res.json().catch(() => null)) as
      | { ok: true; link: { wallet_address: string } }
      | { ok: false; error?: string }
      | null;
    if (!json || json.ok !== true || !res.ok) {
      const motivo = json && json.ok === false ? json.error : undefined;
      return { ok: false, address: null, error: motivo || 'Não foi possível vincular a carteira.' };
    }
    return { ok: true, address: json.link.wallet_address, error: null };
  } catch {
    return { ok: false, address: null, error: 'Sem conexão com o servidor. Tente de novo.' };
  }
}

/**
 * Comando → resposta. Uma função por comando, nenhuma escreve no banco.
 */
import { enderecoDoToken } from './api.js';
import {
  textoBoasVindas, textoComandos, textoJogar, textoMercado, textoMvp, textoRanking, textoToken,
} from './conteudo.js';
import { lerAltasDoMercado, lerMvpDeHoje, lerRanking } from './dados.js';

const FORA_DO_AR = 'Os dados do jogo estão indisponíveis agora. Tente de novo em instantes.';

/** null = comando desconhecido: em grupo o bot fica calado (não polui a conversa). */
export async function respostaPara(comando: string, arg: string, chatId: number | string): Promise<string | null> {
  switch (comando) {
    case 'start':
      return textoBoasVindas();
    case 'ajuda':
    case 'help':
      return textoComandos();
    case 'jogar':
    case 'play':
      return textoJogar();
    case 'token':
    case 'ca':
      return textoToken(enderecoDoToken());
    case 'ranking': {
      // "/ranking 2" mostra a Intermediária; sem número, a Elite.
      const d = Number.parseInt(arg, 10);
      const divisao = d >= 1 && d <= 4 ? d : 1;
      const linhas = await lerRanking(divisao, 10);
      return linhas ? textoRanking(linhas, divisao) : FORA_DO_AR;
    }
    case 'mercado':
    case 'market': {
      const linhas = await lerAltasDoMercado();
      return linhas ? textoMercado(linhas) : FORA_DO_AR;
    }
    case 'mvp':
      return textoMvp(await lerMvpDeHoje());
    case 'id':
      // Pra configurar TELEGRAM_CHAT_ID: rodar /id dentro do grupo oficial.
      return `ID deste chat: <code>${chatId}</code>`;
    default:
      return null;
  }
}

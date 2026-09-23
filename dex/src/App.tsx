/**
 * OLEWALLET — duas telas, e nenhuma a mais.
 *
 * `/`          a carteira: cria, guarda cifrada, restaura, mostra endereço e saldo.
 * `/conectar`  o aperto de mão: outro site (o jogo) pede uma assinatura.
 *
 * Sem router de biblioteca: duas rotas não pagam 20 kB e uma dependência a mais
 * numa origem que existe pra ser pequena.
 */
import Carteira from './Carteira';
import Conectar from './Conectar';

export default function App() {
  const caminho = window.location.pathname.replace(/\/+$/, '');
  if (caminho === '/conectar') return <Conectar />;
  return <Carteira />;
}

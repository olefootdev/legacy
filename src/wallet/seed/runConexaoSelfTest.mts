/**
 * Self-test do aperto de mão entre o jogo e a OLEWALLET.
 *
 * Esta é a única superfície da carteira em que gente de fora fala com ela, e
 * as funções puras daqui são as que decidem SE ela vai ouvir. Um buraco aqui
 * não derruba tela nenhuma: ele faz a carteira assinar pra quem não devia.
 *
 * Roda: npm run test:wallet-conexao
 */
import {
  CANAL,
  ORIGEM_DA_CARTEIRA,
  ehOla,
  ehPronto,
  lerPedido,
  origemPermitida,
  respostaValida,
  urlDoPedido,
} from './conexao.js';
import { fraseParaChave, assinar } from './derive.js';
import { gerarFrase } from './mnemonic.js';
import { buildSolanaLinkMessage } from '../solanaLinkMessage.js';
import { verifySolanaLinkProof } from '../../../server/src/lib/solanaLinkProof.js';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => {
  if (c) { pass++; console.log(`  ✅ ${n}`); } else { fail++; console.log(`  ❌ ${n} ${d}`); }
};

const UID = '11111111-2222-3333-4444-555555555555';
const agora = () => new Date().toISOString();

console.log('\n🤝 conexão — quem pode pedir, e o que a carteira aceita ouvir\n');

// ---------------------------------------------------------------- o pedido ---
{
  const bom = lerPedido(`?uid=${UID}&issuedAt=${encodeURIComponent(agora())}`);
  check('pedido bem formado é lido', bom?.uid === UID);

  check('uid que não é uuid é recusado', lerPedido(`?uid=admin&issuedAt=${agora()}`) === null);
  check('uid vazio é recusado', lerPedido(`?uid=&issuedAt=${agora()}`) === null);
  check('sem issuedAt é recusado', lerPedido(`?uid=${UID}`) === null);
  check('data que não é data é recusada', lerPedido(`?uid=${UID}&issuedAt=ontem`) === null);

  // A janela do servidor é de 5 min; recusar aqui é dizer na hora em vez de
  // fazer a pessoa assinar algo que vai ser rejeitado depois.
  const velho = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  check('pedido de 10 minutos atrás é recusado', lerPedido(`?uid=${UID}&issuedAt=${encodeURIComponent(velho)}`) === null);
  const futuro = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  check('pedido datado no futuro é recusado', lerPedido(`?uid=${UID}&issuedAt=${encodeURIComponent(futuro)}`) === null);
}

// --------------------------------------------------------------- a origem ---
{
  check('o jogo pode pedir', origemPermitida('https://game.olefoot.com'));
  check('localhost do dev pode pedir', origemPermitida('http://localhost:5173'));
  check('site qualquer NÃO pode', !origemPermitida('https://evil.com'));

  // Saíram da lista em 2026-09-23 por não pedirem assinatura nenhuma. Ficam
  // aqui como teste pra não voltarem sem alguém decidir que voltam.
  check('olefoot.com (site) NÃO pede assinatura', !origemPermitida('https://olefoot.com'));
  check('www.olefoot.com NÃO pede assinatura', !origemPermitida('https://www.olefoot.com'));
  check('a própria carteira não consta como pedinte', !origemPermitida('https://dex.olefoot.com'));

  // O ataque clássico de lista por substring. A comparação é exata; estes
  // testes existem pra ninguém "otimizar" pra `includes()` um dia.
  check('sufixo colado no domínio NÃO passa', !origemPermitida('https://game.olefoot.com.evil.com'));
  check('prefixo colado NÃO passa', !origemPermitida('https://evil-game.olefoot.com'));
  check('http no lugar de https NÃO passa', !origemPermitida('http://game.olefoot.com'));
  check('porta a mais NÃO passa', !origemPermitida('https://game.olefoot.com:8443'));
  check('vazio, null e undefined NÃO passam',
    !origemPermitida('') && !origemPermitida(null) && !origemPermitida(undefined));
}

// -------------------------------------------------------------- a resposta ---
{
  const boa = { canal: CANAL, tipo: 'assinado', address: 'abc', issuedAt: agora(), signature: 's', signedMessage: 'm' };
  check('resposta da carteira é aceita', respostaValida(ORIGEM_DA_CARTEIRA, boa) !== null);

  // A MAIS IMPORTANTE: mesma resposta, origem diferente. Se isto passar, um
  // site qualquer injeta uma "assinatura" e o jogo vincula o endereço dele.
  check('a MESMA resposta vinda de outra origem é descartada',
    respostaValida('https://evil.com', boa) === null);

  check('canal errado é descartado', respostaValida(ORIGEM_DA_CARTEIRA, { ...boa, canal: 'outro' }) === null);
  check('tipo desconhecido é descartado', respostaValida(ORIGEM_DA_CARTEIRA, { ...boa, tipo: 'sei-la' }) === null);
  check('sem assinatura é descartado', respostaValida(ORIGEM_DA_CARTEIRA, { ...boa, signature: '' }) === null);
  check('null é descartado', respostaValida(ORIGEM_DA_CARTEIRA, null) === null);
  check('string solta é descartada', respostaValida(ORIGEM_DA_CARTEIRA, 'assinado') === null);

  const recusa = respostaValida(ORIGEM_DA_CARTEIRA, { canal: CANAL, tipo: 'recusado', motivo: 'não quis' });
  check('recusa é lida como recusa', recusa?.tipo === 'recusado');
}

// -------------------------------------------------------------- mensagens ---
{
  check('"pronto" é reconhecido', ehPronto({ canal: CANAL, tipo: 'pronto' }));
  check('"olá" é reconhecido', ehOla({ canal: CANAL, tipo: 'ola' }));
  check('"olá" de outro canal não é olá', !ehOla({ canal: 'x', tipo: 'ola' }));
  const u = new URL(urlDoPedido('https://olefoot.com', { uid: UID, issuedAt: '2026-09-23T00:00:00.000Z' }));
  check('a url do pedido aponta pra /conectar com uid e data',
    u.pathname === '/conectar' && u.searchParams.get('uid') === UID);
}

// ------------------------------------------------- o caminho inteiro, real ---
// Reproduz o que Conectar.tsx faz e entrega ao verificador DE PRODUÇÃO.
{
  const chave = fraseParaChave(gerarFrase());
  const issuedAt = agora();
  const msg = buildSolanaLinkMessage(UID, chave.endereco, issuedAt);
  const bytes = new TextEncoder().encode(msg);
  const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64');

  const resposta = respostaValida(ORIGEM_DA_CARTEIRA, {
    canal: CANAL, tipo: 'assinado',
    address: chave.endereco, issuedAt,
    signature: b64(assinar(bytes, chave)), signedMessage: b64(bytes),
  });
  check('a resposta atravessa o protocolo inteira', resposta?.tipo === 'assinado');

  const r = resposta && resposta.tipo === 'assinado'
    ? verifySolanaLinkProof({
        uid: UID, address: resposta.address,
        issuedAt: resposta.issuedAt, signatureB64: resposta.signature,
      })
    : { ok: false as const, reason: 'não assinou' };
  check('e o servidor de produção aceita o vínculo', r.ok === true, JSON.stringify(r));

  // Trocar o uid invalida: a assinatura amarra a conta, não só o endereço.
  const outro = verifySolanaLinkProof({
    uid: '99999999-9999-9999-9999-999999999999',
    address: chave.endereco, issuedAt,
    signatureB64: b64(assinar(bytes, chave)),
  });
  check('a mesma assinatura NÃO vale pra outra conta', outro.ok === false);
}

console.log(`\n${fail === 0 ? '🟢' : '🔴'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);

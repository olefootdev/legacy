/**
 * Tudo que a OLEWALLET diz, nos dois idiomas.
 *
 * Um arquivo só, pares obrigatórios: o tipo `Dicionario` exige `pt` E `en` em
 * todo verbete, então não dá pra acrescentar uma frase e esquecer metade — o
 * TypeScript recusa antes de a tela existir pela metade em inglês.
 *
 * O inglês aqui não é tradução literal do português; é a mesma coisa dita do
 * jeito que soa natural em inglês. "Print é roubado" não vira "print is
 * stolen".
 */
import type { Dicionario } from '@/i18n/idioma';

export const TEXTOS = {
  // --- início ---
  heroTitulo:      { pt: 'Sua chave.\nSeu time.', en: 'Your keys.\nYour team.' },
  heroTexto:       { pt: '12 palavras de futebol são a carteira inteira. A gente nunca vê e não consegue trazer de volta.',
                     en: 'Twelve football words are the whole wallet. We never see them, and we cannot bring them back.' },
  criarCarteira:   { pt: 'Criar carteira', en: 'Create a wallet' },
  jaTenhoFrase:    { pt: 'Já tenho uma frase', en: 'I have a phrase' },
  naoGuardamos:    { pt: 'A OLEFOOT não guarda seus fundos e não recupera frase perdida.',
                     en: 'OLEFOOT does not hold your funds and cannot recover a lost phrase.' },

  // --- a frase ---
  tituloFrase:     { pt: 'SUA FRASE', en: 'YOUR PHRASE' },
  anoteNoPapel:    { pt: 'Anote no papel', en: 'Write it on paper' },
  anoteTexto:      { pt: 'Em ordem. Quem tiver estas 12 palavras é dono desta carteira. Print é roubado.',
                     en: 'In order. Anyone holding these 12 words owns this wallet. Screenshots get stolen.' },
  leiaUmaVez:      { pt: 'Leia uma vez', en: 'Read this once' },
  listaPropriaA:   { pt: 'Estas palavras vêm da lista da OLEFOOT, não da lista padrão. ',
                     en: 'These words come from the OLEFOOT list, not the standard one. ' },
  listaPropriaB:   { pt: 'Elas não abrem sua carteira na Phantom nem na Solflare.',
                     en: 'They will not open your wallet in Phantom or Solflare.' },
  listaPropriaC:   { pt: ' A lista é pública, então qualquer desenvolvedor reconstrói esta carteira — com ou sem a gente.',
                     en: ' The list is public, so any developer can rebuild this wallet — with or without us.' },
  copiar:          { pt: 'Copiar', en: 'Copy' },
  copiado:         { pt: 'Copiado', en: 'Copied' },
  anotei:          { pt: 'Anotei as 12 palavras', en: 'I wrote the 12 words down' },

  // --- senha e restauração ---
  tituloSenha:     { pt: 'SENHA', en: 'PASSWORD' },
  tituloRestaurar: { pt: 'RESTAURAR', en: 'RESTORE' },
  suaFrase:        { pt: 'Sua frase', en: 'Your phrase' },
  placeholderFrase:{ pt: 'as 12 palavras, separadas por espaço', en: 'the 12 words, separated by spaces' },
  senhaDesteApar:  { pt: 'Senha deste aparelho', en: 'Password for this device' },
  senha:           { pt: 'senha', en: 'password' },
  repitaSenha:     { pt: 'repita a senha', en: 'repeat the password' },
  senhaExplica:    { pt: 'A senha cifra a frase neste aparelho. Ela não recupera nada: se esquecer a senha, quem traz a carteira de volta são as 12 palavras.',
                     en: 'The password encrypts the phrase on this device. It recovers nothing: if you forget it, the 12 words are what bring the wallet back.' },
  cifrando:        { pt: 'Cifrando…', en: 'Encrypting…' },
  restaurarBotao:  { pt: 'Restaurar carteira', en: 'Restore wallet' },
  senhasDiferem:   { pt: 'As duas senhas não são iguais.', en: 'The two passwords do not match.' },
  fraseNaoFecha:   { pt: 'A frase não fecha. Confira as 12 palavras e a ordem.',
                     en: 'The phrase does not check out. Check the 12 words and their order.' },

  // --- trancada ---
  trancada:        { pt: '#trancada', en: '#locked' },
  suaSenha:        { pt: 'Sua senha', en: 'Your password' },
  abrindo:         { pt: 'Abrindo…', en: 'Opening…' },
  abrirCarteira:   { pt: 'Abrir carteira', en: 'Open wallet' },
  esqueciSenha:    { pt: 'Esqueci a senha — apagar deste aparelho',
                     en: 'Forgot the password — erase from this device' },
  confirmaApagar:  { pt: 'Isto apaga a carteira DESTE aparelho. Sem as 12 palavras, ela não volta. Continuar?',
                     en: 'This erases the wallet from THIS device. Without the 12 words, it does not come back. Continue?' },

  // --- aberta ---
  solNesteEnd:     { pt: 'SOL neste endereço', en: 'SOL at this address' },
  seuEndereco:     { pt: 'Seu endereço', en: 'Your address' },
  saldo:           { pt: 'Saldo', en: 'Balance' },
  ligarAoJogo:     { pt: 'Ligar ao jogo', en: 'Connect to the game' },
  ligarTexto:      { pt: 'No jogo, abra a Carteira e escolha OLEWALLET. O pedido de assinatura aparece aqui, e você decide.',
                     en: 'In the game, open Wallet and pick OLEWALLET. The signature request shows up here, and you decide.' },
  trancar:         { pt: 'Trancar', en: 'Lock' },
  apagar:          { pt: 'Apagar', en: 'Erase' },

  // --- conectar ---
  tituloConectar:  { pt: 'CONECTAR', en: 'CONNECT' },
  confirmando:     { pt: 'Confirmando quem pediu…', en: 'Confirming who is asking…' },
  confirmandoTexto:{ pt: 'A carteira não mostra nada pra assinar antes de o navegador confirmar de onde veio o pedido.',
                     en: 'The wallet shows nothing to sign before the browser confirms where the request came from.' },
  pedidoInvalido:  { pt: 'Pedido inválido', en: 'Invalid request' },
  pedidoInvTexto:  { pt: 'Este endereço só funciona quando o pedido parte do jogo — e vale por 5 minutos. Abra a Carteira no jogo e escolha OLEWALLET.',
                     en: 'This address only works when the request comes from the game — and it lasts 5 minutes. Open Wallet in the game and pick OLEWALLET.' },
  irParaCarteira:  { pt: 'Ir para a carteira', en: 'Go to the wallet' },
  vincularTitulo:  { pt: 'Vincular sua carteira', en: 'Link your wallet' },
  quemPediu:       { pt: 'Quem está pedindo', en: 'Who is asking' },
  suaCarteira:     { pt: 'Sua carteira', en: 'Your wallet' },
  ehAssinaturaA:   { pt: 'Isto é uma ', en: 'This is a ' },
  ehAssinaturaB:   { pt: 'assinatura', en: 'signature' },
  ehAssinaturaC:   { pt: ', não uma transação. Não move fundos, não custa taxa, e o texto assinado é montado aqui — não por quem pediu.',
                     en: ', not a transaction. It moves no funds, costs no fee, and the signed text is built here — not by whoever asked.' },
  assinarEVincular:{ pt: 'Assinar e vincular', en: 'Sign and link' },
  recusar:         { pt: 'Recusar', en: 'Decline' },
  assinado:        { pt: 'Assinado', en: 'Signed' },
  recusado:        { pt: 'Recusado', en: 'Declined' },
  podeFechar:      { pt: 'Pode fechar esta janela.', en: 'You can close this window.' },
  vocêRecusou:     { pt: 'você recusou', en: 'you declined' },
  criarAquiTitulo: { pt: 'Criar sua\nOLEWALLET', en: 'Create your\nOLEWALLET' },
  criarAquiTexto:  { pt: 'Seu time, seu EXP e suas compras continuam no jogo, do jeito que estão. A carteira é só pro que vive na Solana — e ela nasce aqui, agora, sem sair desta janela.',
                     en: 'Your team, your EXP and your purchases stay in the game, exactly as they are. The wallet is only for what lives on Solana — and it is created right here, without leaving this window.' },
  agoraNao:        { pt: 'Agora não', en: 'Not now' },
  semCarteiraAqui: { pt: 'Sem carteira aqui', en: 'No wallet here' },
  carregando:      { pt: 'Carregando…', en: 'Loading…' },
  naoDeu:          { pt: 'não deu', en: 'that did not work' },

  // --- receber ---
  tituloReceber:   { pt: 'RECEBER', en: 'RECEIVE' },
  receber:         { pt: 'Receber', en: 'Receive' },
  soSolana:        { pt: 'Só Solana', en: 'Solana only' },
  soSolanaTexto:   { pt: 'Mandar de outra rede — Ethereum, BSC — perde os fundos pra sempre. Este endereço só existe na Solana.',
                     en: 'Sending from another network — Ethereum, BSC — loses the funds for good. This address only exists on Solana.' },
  compartilhar:    { pt: 'Compartilhar', en: 'Share' },
  apontarCamera:   { pt: 'Aponte a câmera de quem vai mandar', en: 'Point the sender\u2019s camera here' },

  // --- extrato ---
  tituloExtrato:   { pt: 'EXTRATO', en: 'ACTIVITY' },
  extrato:         { pt: 'Extrato', en: 'Activity' },
  expansao:        { pt: 'Expansão', en: 'Network' },
  // --- abas ---
  abaCarteira:     { pt: 'Carteira', en: 'Wallet' },
  abaComprar:      { pt: 'Comprar', en: 'Buy' },
  abaRender:       { pt: 'Render', en: 'Earn' },
  abaRede:         { pt: 'Rede', en: 'Network' },
  // --- ações ---
  acaoEnviar:      { pt: 'Enviar', en: 'Send' },
  acaoReceber:     { pt: 'Receber', en: 'Receive' },
  acaoDepositar:   { pt: 'Depositar', en: 'Deposit' },
  acaoComprar:     { pt: 'Comprar', en: 'Buy' },
  // --- seções ---
  naRede:          { pt: 'Na rede', en: 'On chain' },
  noJogo:          { pt: 'No jogo', en: 'In game' },
  saldoDoJogo:     { pt: 'Saldo do jogo · não é dinheiro', en: 'Game balance · not money' },
  // --- estados honestos ---
  enviarFalta:     { pt: 'Enviar chega junto com o lançamento do token. Até lá a carteira recebe e guarda, e nada sai daqui sem a sua frase.',
                     en: 'Sending arrives with the token launch. Until then the wallet receives and holds, and nothing leaves without your phrase.' },
  comprarFalta:    { pt: 'A pré-venda do OLEFOOT acontece no jogo, em reais via Pix. O token chega aqui quando for lançado na Solana.',
                     en: 'The OLEFOOT pre-sale runs in the game, in BRL via Pix. The token lands here once it launches on Solana.' },
  comprarIr:       { pt: 'IR PARA A PRÉ-VENDA', en: 'GO TO THE PRE-SALE' },
  depositarFalta:  { pt: 'Para receber SOL ou USDT, use Receber e o seu endereço. Depósito por cartão ou Pix entra depois do lançamento.',
                     en: 'To receive SOL or USDT, use Receive and your address. Card or Pix top-up comes after launch.' },
  renderFalta:     { pt: 'Staking e Vault rendem sobre o token. Enquanto o OLEFOOT não está na rede, não há o que render — e prometer rendimento sem lastro seria mentira.',
                     en: 'Staking and Vault earn on the token. While OLEFOOT is not on chain there is nothing to earn — and promising yield without backing would be a lie.' },
  // --- produção / split ---
  splitTitulo:     { pt: 'Como a colheita se divide', en: 'How the harvest splits' },
  splitVoce:       { pt: 'Você', en: 'You' },
  splitQuemDepositou: { pt: 'quem depositou', en: 'the one who deposited' },
  splitSuaRede:    { pt: 'Sua rede', en: 'Your network' },
  splitCasa:       { pt: 'roda a operação', en: 'runs the thing' },
  splitTotal:      { pt: 'total', en: 'total' },
  splitNota:       { pt: 'O split roda sobre o que a pool colheu — nunca sobre o que você depositou.',
                     en: 'The split runs on what the pool harvested — never on what you deposited.' },
  tokenNaoLancado: { pt: 'ainda não lançado', en: 'not launched yet' },
  // --- render: stake ---
  subStake:        { pt: 'Stake', en: 'Stake' },
  subVault:        { pt: 'Vault', en: 'Vault' },
  stakeTravado:    { pt: 'Travado', en: 'Staked' },
  stakePrazo:      { pt: 'Prazo do travamento', en: 'Lock' },
  stakeRegra:      { pt: 'Travado é travado. Não há saída antecipada, e o multiplicador é fatia do que a pool produzir de verdade — não taxa prometida.',
                     en: 'Locked means locked. There is no early exit, and the multiplier is a share of what the pool actually produces — not a promised rate.' },
  stakeFalta:      { pt: 'O stake começa quando o OLEFOOT estiver na Solana. Estas são as regras publicadas desde já, pra você conferir depois que ele lançar.',
                     en: 'Staking starts once OLEFOOT is on Solana. These are the published rules, so you can check them after launch.' },
  // --- render: vault ---
  vaultTitulo:     { pt: 'Sempre na pool', en: 'Always in the pool' },
  vaultSub:        { pt: 'Sem timing, sem chamada. O motor é a taxa.', en: 'No timing, no calls. The engine is the fee.' },
  vaultPosicao:    { pt: 'A única posição', en: 'The one position' },
  vaultFaixaCheia: { pt: 'faixa cheia', en: 'full range' },
  vaultCanario:    { pt: 'canário K1 · piso 25%', en: 'canary K1 · floor 25%' },
  vaultKill:       { pt: 'Chave de desligar', en: 'Kill switch' },
  vaultKillNota:   { pt: 'Abaixo do piso o canário acende — ele não vende. Sair da pool é decisão humana, tomada à mão.',
                     en: 'Under the floor the canary lights — it does not sell. Leaving the pool is a human decision, taken by hand.' },
  vaultBacktest:   { pt: 'Backtest · 2,7 anos', en: 'Backtested · 2.7 years' },
  vaultAoAno:      { pt: 'ao ano', en: 'a year' },
  vaultPiorQueda:  { pt: 'pior queda', en: 'worst fall' },
  vaultSegurarSol: { pt: 'segurando SOL', en: 'holding SOL' },
  vaultAvisoTitulo:{ pt: 'Isto é uma posição em SOL', en: 'This is a SOL position' },
  vaultAviso:      { pt: 'Leituras passadas, não taxa. Você põe USDT, mas suas cotas andam com o preço do SOL — e um mês ruim aparece aqui igual a um bom.',
                     en: 'Past readings, not a rate. You put USDT in, but your shares ride the SOL price — and a bad month shows here the same way a good one does.' },
  vaultFalta:      { pt: 'O fundo ainda não abriu. A política acima é a definitiva e está publicada antes do primeiro depósito, não depois.',
                     en: 'The fund is not open yet. The policy above is the final one, published before the first deposit, not after.' },
  vaultComoSplit:  { pt: 'Como o split funciona →', en: 'How the split works →' },
  expansaoTexto:   { pt: 'Sua rede, seus times e o bônus de equiparação.',
                     en: 'Your network, your teams and the matching bonus.' },
  semMovimento:    { pt: 'Nada ainda', en: 'Nothing yet' },
  semMovimentoTxt: { pt: 'Quando algo entrar ou sair deste endereço, aparece aqui — e no explorador da Solana, que não é nosso.',
                     en: 'When anything moves in or out of this address, it shows up here — and on the Solana explorer, which is not ours.' },
  tudoOnChain:     { pt: 'Toda linha aqui está na blockchain. Confira qualquer uma sem depender da gente.',
                     en: 'Every line here is on chain. Check any of them without relying on us.' },
  falhou:          { pt: 'falhou', en: 'failed' },
  verNoExplorador: { pt: 'ver', en: 'view' },
  atualizar:       { pt: 'Atualizar', en: 'Refresh' },
  carregandoLista: { pt: 'Buscando na Solana…', en: 'Reading from Solana…' },
  naoDeuLista:     { pt: 'Não consegui falar com a Solana agora.', en: 'Could not reach Solana right now.' },
  voltar:          { pt: 'Voltar', en: 'Back' },

  // --- entrada na tela de conexão ---
  entrar:          { pt: 'Entrar', en: 'Log in' },
  entrarTitulo:    { pt: 'Entrar na sua\nOLEWALLET', en: 'Log in to your\nOLEWALLET' },
  entrarTexto:     { pt: 'Sua carteira está neste aparelho, trancada. A senha abre — e só depois disso você decide se assina.',
                     en: 'Your wallet is on this device, locked. The password opens it — only then do you decide whether to sign.' },
  quaseLa:         { pt: 'Quase lá', en: 'Almost there' },
  abraPeloJogo:    { pt: 'Não identifiquei quem pediu a conexão. Isso acontece quando esta página é aberta direto, em vez de pelo botão OLEWALLET dentro do jogo. Abra por lá e a assinatura aparece aqui.',
                     en: 'I could not identify who requested the connection. That happens when this page is opened directly instead of through the OLEWALLET button inside the game. Open it from there and the request shows up here.' },
  conferindo:      { pt: 'conferindo quem pediu…', en: 'checking who is asking…' },
  pediuConexao:    { pt: 'pediu para conectar', en: 'is asking to connect' },
} as const satisfies Dicionario<string>;

export type ChaveTexto = keyof typeof TEXTOS;

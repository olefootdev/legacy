# OLEFOOT na pump.fun — o segundo caminho

Decisão do fundador (2026-10-05): lançar uma moeda **nova** OLEFOOT no pump.fun,
par OLEFOOT/SOL, como **segundo caminho** — separada do $OLEFOOT já criado
(`HJ5DJ6T7…SwdeP`). Quem cria e assina é o fundador, numa carteira nova.

---

## 1. O que colar no formulário

| Campo | Valor |
|---|---|
| **Name** | `OLEFOOT` |
| **Ticker** | `OLEFOOT` |
| **Image (logo)** | `docs/pumpfun/olefoot-ball-logo.png` — a bola OLEFOOTBALL |
| **Banner** | `docs/pumpfun/banner-camisa-1500x500.png` (alternativa: `banner-rosto-1500x500.png`) |
| **Website** | `https://game.olefoot.ai` |
| **X (Twitter)** | `https://x.com/olefootgame` |
| **Telegram** | deixar vazio (não há grupo oficial) |

**Description** (o pump.fun não tem campo de Instagram, então ele vai no texto):

```
OLEFOOT — the football manager where your squad is a living asset. Players gain value with every match and every training session. Build your club, trade your players, climb the leagues.

Play: game.olefoot.ai
X: @olefootgame · IG: @olefootgame
```

---

## 2. A carteira nova, pelo terminal

> 🔒 A chave privada é só sua. Não cole em chat, e-mail, site ou IA — só no Phantom.

1. Criar a carteira (o arquivo é o backup — guarde uma cópia offline):
   ```bash
   solana-keygen new --outfile ~/.config/solana/olefoot-pumpfun.json
   ```
2. Ver o endereço público (é este que recebe o SOL):
   ```bash
   solana-keygen pubkey ~/.config/solana/olefoot-pumpfun.json
   ```
3. O pump.fun funciona pelo navegador, então a carteira precisa entrar no
   Phantom. ⚠️ **Não importe pelas 12 palavras**: o `solana-keygen` gera o
   endereço por um caminho diferente do Phantom, e as palavras abririam
   **outra** carteira. Importe pela **chave privada**. Para mostrá-la (rode na
   pasta `olefootv-11`, que já tem a biblioteca `bs58`):
   ```bash
   node -e "const b=require('bs58');const e=(b.default||b).encode;console.log(e(Uint8Array.from(require(process.env.HOME+'/.config/solana/olefoot-pumpfun.json'))))"
   ```
   No Phantom: **Adicionar carteira → Importar chave privada** → cole → confira
   que o endereço é o mesmo do passo 2. Depois limpe o terminal (`clear`).
4. Mande para esse endereço o SOL das taxas **mais** a compra inicial.

**Nunca** use a carteira do deployer `5L6ADn7C…` — ela guarda a tesouraria e as
autoridades do outro token.

---

## 3. No pump.fun

1. **pump.fun → Create coin** → conecte o Phantom com a carteira nova.
2. Preencha a tabela do item 1, suba o logo e o banner.
3. **Compra inicial (dev buy)**: fazer na mesma transação que cria a moeda
   evita que robôs comprem na frente no primeiro segundo. **O valor é decisão
   sua** — é dinheiro que entra na curva e pode cair de preço.
4. Confira tudo → **Create** → assine no Phantom.
5. **Copie o endereço da moeda** (o "CA", costuma terminar em `pump`) e me mande.

---

## 4. Depois que a moeda existir

Me mande o CA e eu coloco no site como **segundo caminho**, com nome claro e o
endereço oficial fixo na página `/token`.

**Primeiro dia:**
- **Fixe o CA** no X e no Instagram. No pump.fun o ticker não é exclusivo: no
  mesmo dia aparecem cópias com o mesmo nome e a mesma imagem. O endereço é a
  única coisa que não dá para copiar.
- Há duas moedas chamadas OLEFOOT (a da pump.fun e a `HJ5D…`). Diga em todo
  post qual é qual.
- A moeda da pump.fun nasce com **1 bilhão** de unidades, sem a taxa de 5%, e a
  empresa só tem o que comprar na curva.

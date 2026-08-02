# REVELA — o que falta para lançar

Levantamento de 2026-08-02, verificado contra o banco e o site no ar (não contra
anotações antigas).

## Já está de pé

- `revela.olefoot.com` no ar, com **22 lendas** no acervo e **75 clubes** em 3 divisões.
- **Todas as migrations aplicadas**, inclusive `revela_claim_talent`,
  `revela_facilitator_layer` e `revela_resolve_handle`, que notas antigas davam como
  pendentes. Verificado chamando cada RPC direto no banco.
- Lixo de teste (os 5 cadastros `ZZ`) já foi limpo.
- Link curto, worker de preview e OG por rota funcionando.

---

## 1. Tela do OLE SCOUT — ✅ FEITA nesta sessão

**O problema:** aprovar talento era abrir o SQL Editor e digitar
`revela_admin_review_talent(<uuid>, 'approved', '{...10 atributos...}')` na mão, um por um.
No dia em que o link circulasse, o funil inteiro pararia nisso.

**O que existe agora:** `Admin → Jogadores → OLE Scout` (ou `#ole-scout`).
Fila filtrável por estado, busca por nome/clube/cidade, e a ficha completa do atleta —
incluindo vídeo, redes e contato, que é como o scout confere se a pessoa é real.
Aprovar, deixar em análise ou recusar, com nota interna.

Detalhes que importam:
- **O OVR não é digitado.** Quem calcula é `revela_ovr(pos, attrs)` no banco, com os pesos
  por posição — a mesma conta do jogo. Deixar o cliente mandar OVR criaria uma segunda
  fonte de verdade.
- **Menor de idade aparece em destaque** com o responsável, antes de aprovar. Se não houver
  responsável informado, a tela diz para não aprovar.
- As RPCs de admin **não têm grant** para anon — são service-role. Por isso a tela fala com
  `/api/revela-admin` no servidor (gate `requireAdminToken` + service role lá), e o
  navegador nunca vê a chave nem a PII de quem não foi aprovado.

⚠️ **Isso mexe no backend** (`server/src/routes/revelaAdmin.ts`), então o push em `main`
dispara o auto-deploy do Railway.

---

## 2. Turnstile no envio anônimo — ✅ CÓDIGO PRONTO, falta criar o widget

**O problema:** o envio é anônimo de propósito e aceita foto de 4 MB. Sem trava, um script
enche a fila do scout e o bucket. Postgres não enxerga IP nem resolve desafio.

**O que existe agora:** o envio passa a ter um caminho protegido pelo Worker
(`POST /api/enviar-talento`), que valida o token com a Cloudflare antes de gravar.

**Como ele se comporta hoje, sem configuração:** o widget não aparece e o envio segue como
sempre. Nada quebra. **A proteção só liga quando você criar o widget** — é o passo abaixo.

### O que você precisa fazer (5 minutos)

1. Painel da Cloudflare → **Turnstile** → *Add widget*
   - Domínio: `revela.olefoot.com`
   - Modo: **Managed**
2. Copie as duas chaves. A **site key** é pública; a **secret** não.
3. No `.env` da raiz do projeto:
   ```
   VITE_TURNSTILE_SITE_KEY=0x4AAA...
   ```
4. A secret vai como segredo do Worker (nunca no `.env` do front):
   ```bash
   npx wrangler secret put TURNSTILE_SECRET -c revela/dist/olefoot_revela/wrangler.json
   ```
5. `npm run deploy:revela`

Depois disso o botão de envio só habilita com o desafio resolvido, e o Worker recusa
qualquer envio sem token válido.

**Decisão de projeto:** o Worker é *fail-closed* — sem a secret ele responde 503 em vez de
deixar passar. O cliente trata o 503 caindo no caminho antigo, para o funil não parar antes
de você configurar. Já a **recusa** do desafio é definitiva: não tenta pelo caminho aberto,
senão o gate não gatearia nada.

---

## 3. Retrato do Breno + leva inicial de talentos — 🔴 SEU

**O retrato.** O único arquivo no acervo é `breno-nft.png`, que é **arte de card com
moldura**. No hero 4:5 do portal isso vira card-dentro-de-card. Procurei alternativa no
acervo e não existe — precisa de uma foto limpa do atleta (sem moldura), 3:4 ou 4:5.

Depois de subir, trocar com:
```sql
update public.revela_talents
   set portrait_url = 'https://.../breno-retrato.png'
 where slug = 'breno-liborge';
```

**A leva inicial.** Hoje a vitrine tem **1 talento**. A home promete "uma geração inteira
surgindo" e entrega um nome — a página desmente a própria manchete. Antes de divulgar, vale
ter um punhado de atletas reais aprovados. Agora dá para fazer isso pela tela do scout, sem
SQL.

---

## 4. "Confirm email" no Supabase — 🔴 SEU (2 minutos)

Se estiver **ligado**, o `signUp` não abre sessão na hora, então o atleta não consegue
reivindicar o próprio perfil no momento do cadastro. A tela tem uma saída ("já confirmei,
entrar"), mas é atrito no pior lugar do funil.

**Authentication → Providers → Email → Confirm email**

Se for desligar, faça antes de divulgar.

---

## Ordem sugerida

1. Criar o widget do Turnstile e fazer o deploy (passo 2) — **protege antes de divulgar**
2. Conferir o "Confirm email" (passo 4)
3. Subir o retrato limpo do Breno (passo 3)
4. Aprovar uma leva inicial pela tela nova (passo 3)
5. Divulgar

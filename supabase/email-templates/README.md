# Templates de email Olefoot

Templates HTML brandeados pra substituir os defaults da Supabase Auth.
Versionados aqui pra histórico/diff; a fonte de verdade que o usuário
recebe é o que está colado no Dashboard.

## recovery.html — Recuperação de senha

Usado quando alguém clica em "Esqueci minha senha" e o frontend chama
`sb.auth.resetPasswordForEmail(email, { redirectTo: '/reset-password' })`.

### Como aplicar no Supabase

1. Dashboard → **Authentication → Email Templates** → aba **Reset Password**
2. **Subject heading**: `Resgate seu acesso na Olefoot`
3. **Body**: cole o conteúdo de [`recovery.html`](./recovery.html) inteiro
4. Salvar

Variáveis disponíveis no template (resolvidas pelo GoTrue):

| Variável | Conteúdo |
|---|---|
| `{{ .ConfirmationURL }}` | URL completa com token (redireciona pra `/reset-password`) |
| `{{ .Email }}` | Email do destinatário |
| `{{ .SiteURL }}` | Site URL configurada no projeto (não usada hoje no template) |
| `{{ .Token }}` | OTP de 6 dígitos (se quiser oferecer alternativa code-based) |

### Para validar antes de salvar

- O Supabase mostra preview com placeholders ao lado direito do editor
- Clica em **Send test email** → recebe no seu email pra testar real

### Limitações conhecidas

- **Logo é texto estilizado** (Impact + #FDE100). Não usa imagem porque
  hospedar SVG público em cada email gera CSP issues e cache miss.
- **From address** continua `noreply@mail.app.supabase.io` enquanto não
  tiver SMTP custom (Resend/SendGrid). Isso ainda pode jogar pra spam.
  Próximo passo: configurar custom SMTP (Dashboard → Authentication → SMTP).
- **Rate limit** do SMTP nativo é ~2-4 emails/hora por projeto. Inviável
  pra blast de migrados v1. Custom SMTP resolve.

## Outros templates a brandear (priorizar depois)

- `magic-link.html` — login passwordless (não usamos hoje)
- `confirmation.html` — confirmação de cadastro (novos signups, não migrados)
- `email-change.html` — troca de email
- `invite.html` — convite manual via dashboard

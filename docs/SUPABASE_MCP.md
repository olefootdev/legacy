# Supabase MCP (Cursor / Claude)

Liga o assistente ao teu projeto Supabase (SQL, migrations, logs, tipos). O ficheiro **real** com `project_ref` fica em `.cursor/mcp.json` (não versionado — ver `.gitignore`).

## 1. Cursor (recomendado neste repo)

1. Copia `mcp.supabase.cursor.example.json` para `.cursor/mcp.json` (ou mantém o que já criámos localmente).
2. Substitui `YOUR_PROJECT_REF` pelo ref do dashboard (Settings → General → Reference ID), se usares o exemplo.
3. URL final (com projeto fixo):

   `https://mcp.supabase.com/mcp?project_ref=<teu_ref>`

   Parâmetros opcionais: [`read_only=true`](https://supabase.com/docs/guides/getting-started/mcp), `features=database,docs`, etc.

4. Reinicia o Cursor. Abre **Settings → Cursor Settings → Tools & MCP**, confirma o servidor **supabase** e **Authenticate** (fluxo OAuth no browser).

## 2. Claude Code (CLI)

Se usas `claude` na linha de comandos:

```bash
claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp?project_ref=YOUR_PROJECT_REF"
```

Depois: `claude /mcp` → selecionar supabase → autenticar.

## 3. Agent Skills Supabase (opcional)

Instruções e recursos extra para agentes (além dos skills já em `.agents/skills/supabase/` neste repo):

```bash
npx skills add supabase/agent-skills
```

## Segurança

- Preferir **projeto de desenvolvimento**, não produção com dados reais.
- Revisar cada chamada de ferramenta antes de aprovar.
- Ver [boas práticas Supabase MCP](https://supabase.com/docs/guides/getting-started/mcp#security-risks).

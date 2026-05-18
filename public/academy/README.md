# Academia OLE — Templates de Carta

Assets usados pelo passo "Foto" do fluxo de Criar Jogador (Academia OLE).
O componente `src/components/AcademyPhotoCapture.tsx` compõe a carta final
em 3 camadas, de baixo pra cima:

1. **`template-background.png`** (camada 1 — fundo)
   - Resolução recomendada: **600×800** (4:3 vertical, padrão de carta)
   - Conteúdo: fundo do card (gradiente, padrão, paisagem desfocada, etc)
   - **Status**: ⚠️ AUSENTE — adicionar nesta pasta. Enquanto não existe,
     o componente cai pra fundo preto sólido (#0A0A0A).

2. **face do manager** (camada 2 — selfie capturada da webcam, posicionada)
   - Capturada em runtime via `getUserMedia`. Manager arrasta/zooma sobre
     o fundo antes de confirmar.

3. **`template-jersey.png`** (camada 3 — camisa overlay)
   - Resolução: **600×800** (mesma do fundo)
   - Conteúdo: camisa OLE FC desenhada com **transparência onde vai o rosto/torso
     do jogador** (pra face ficar visível por baixo)
   - **Status**: ✅ presente

## Como o pipeline usa esses PNGs

Após composição local (canvas 2D no browser), o resultado vai pra:
- `POST /api/academy/generate-portrait` no servidor Hono
- Servidor manda a composta + prompt pra Freepik Seedream v4 (image-to-image)
- Output estilizado é upado pro Pinata
- URL pública retorna pro cliente, que dispatcha `CREATE_MANAGER_PROSPECT`

## Pra adicionar/trocar

Drop o PNG nesta pasta com o nome exato. Não precisa rebuild — Vite serve
estático de `/public/`. Em produção, `npm run deploy:cloudflare` inclui
tudo automaticamente no bundle.

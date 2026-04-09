# Prompt completo — Cole no Cursor (OLEFOOT: campo profissional + melhorias visuais no projeto)

**Instrução:** copie **tudo** a partir da seção “INÍCIO DO PROMPT” até “FIM DO PROMPT” e cole num chat do Cursor com o **workspace na raiz do repositório OLEFOOT** (onde está o `package.json` do Expo e, se existir, `app/` ou `src/`).

---

## INÍCIO DO PROMPT

Você é um engenheiro sênior. Implemente **no projeto OLEFOOT (Expo / React Native)** o campo de futebol profissional e as melhorias visuais descritas abaixo, **integradas ao app** — não deixe só como demo solta.

### Contexto

- O repositório pode já conter uma referência em **`web/match-pitch/`** (Vite + Babylon) com: gramado 105×68 m, linhas IFAB, traves, terços táticos, grade 8×5, câmeras TV/Drone/Motion, times em cilindros 4-3-3, bola em demo. **Reutilize ou mova esse código** para dentro da estrutura do monorepo, mantendo-o buildável.
- A integração no cliente Expo deve usar **`react-native-webview`** apontando para o viewer (dev: Vite local; prod: URL HTTPS ou asset estático com `base: './'` no Vite se necessário).
- Documentação auxiliar: `docs/INTEGRACAO_MATCH_PITCH_EXPO.md`, `docs/PROMPT_MOTOR_VISUAL_BABYLON_YUKA.md`, `docs/PROMPT_ADMIN_CAMPO_INTELIGENTE.md` (coordenadas e `fieldSchemaVersion` devem ser compatíveis no futuro).

### Objetivos obrigatórios

1. **Dimensões profissionais**  
   - Campo **105 m × 68 m** (comprimento no eixo X entre gols, largura no Z).  
   - Constantes centralizadas (ex.: `fifaPitchDimensions.ts`) para reaproveitar no Admin/simulação.

2. **Marcações reais (IFAB / FIFA típico)**  
   - Linhas de toque e de gol (perímetro).  
   - Linha de meio-campo.  
   - Círculo central (raio **9,15 m**) e marca central.  
   - Áreas de penalidade (**16,5 m** de profundidade, **40,32 m** de largura total).  
   - Área do gol (**5,5 m × 18,32 m**).  
   - Marca de penalidade a **11 m** de cada linha de gol.  
   - Arco da grande área (raio 9,15 m centrado na marca).  
   - Arcos de canto (**1 m**).  
   - Linhas brancas claras (CreateLines / equivalente).

3. **Traves**  
   - Gol **7,32 m** entre postes internos, **2,44 m** de altura; postes + travessão visíveis (meshes simples).

4. **Zonas visuais (“campo inteligente”)**  
   - **Terços** longitudinais (defesa / meio / ataque) com overlay semitransparente, ligável por botão ou estado.  
   - **Grade 8×5** opcional (wireframe ou linhas), alinhada ao doc do Admin.

5. **Câmeras (três modos)**  
   - **TV:** lateral elevada, ângulo tipo transmissão.  
   - **Drone:** visão quase de cima (planta baixa).  
   - **Motion:** segue a bola com suavização (lerp) e leve “respiração” de enquadramento.  
   - Controles na UI do WebView **e**, se fizer sentido, botões nativos que enviam mensagens ao WebView para trocar modo.

6. **Jogadores e bola (MVP visual)**  
   - Dois times em **4-3-3** com marcadores simples (cilindros ou capsulas) em cores distintas; posições coerentes com o campo em metros.  
   - Bola esférica; movimento pode ser demo até ligar ao motor.

7. **Integração no app Expo**  
   - Instalar `react-native-webview`.  
   - Criar componente **`MatchPitchWebView`** (ou nome equivalente) com URI configurável:  
     - iOS sim: `http://localhost:5174`  
     - Android emulador: `http://10.0.2.2:5174`  
     - Dispositivo físico: IP da máquina na LAN ou variável `EXPO_PUBLIC_PITCH_URL`.  
   - **Incorporar na tela de partida ao vivo** existente (substituir ou combinar com o campo 2D atual).  
   - Em **`package.json` na raiz do Expo**, adicionar script útil, ex.: `"dev:pitch": "npm run dev --prefix web/match-pitch"` (ajuste o path se mover a pasta).

8. **Desenvolvimento Android**  
   - Se usar HTTP em dev, configurar `usesCleartextTraffic` (ou equivalente Expo) **apenas** para desenvolvimento; documentar.

9. **Ponte de estado (preparar, mesmo que stub)**  
   - Definir tipo TypeScript `MatchTruthSnapshot` (tempo, bola x/y/z, jogadores id/side/x/z, fase de jogo).  
   - No WebView, expor listener `window.addEventListener('message', …)` e, no RN, método para `injectJavaScript` ou `postMessage` enviando JSON — pode ser no-op inicial, mas a **estrutura** deve existir.

10. **Build de produção**  
    - Documentar em README: `npm run build` no viewer, deploy estático HTTPS, variável de ambiente para URL do pitch no app.

### Critérios de aceite

- [ ] Abrir o app Expo, ir à partida ao vivo, ver o **campo 3D** com marcações e traves corretas.  
- [ ] Alternar **TV / Drone / Motion** sem crash.  
- [ ] Ligar/desligar **terços** e **grade 8×5**.  
- [ ] Dois times posicionados em **4-3-3** legível.  
- [ ] `tsc` / lint do projeto passando.  
- [ ] Instruções claras no README do repositório (dois terminais em dev, URLs por plataforma).

### O que não fazer nesta tarefa

- Não implementar blockchain nem economia BRO/EXP aqui.  
- Não substituir o GameSpirit/motor de simulação completo — só integração visual e contrato de snapshot.  
- Não remover telas de gestão existentes sem substituir por equivalente.

### Ordem sugerida de trabalho

1. Garantir `web/match-pitch` buildando (`npm run build`).  
2. Adicionar WebView + componente + tela de partida.  
3. Ajustar URLs e `app.json` para dev.  
4. Stub `postMessage` / listener.  
5. README + variáveis de ambiente.  
6. (Opcional) textura de grama, sombras, rede — se sobrar tempo.

Execute as mudanças **diretamente nos arquivos do projeto**; não apenas descreva — commite código funcional.

## FIM DO PROMPT

---

### Nota (para você, fora do prompt)

- Se o Cursor estiver aberto **só** na pasta `web/match-pitch`, abra a **raiz do monorepo** onde está o Expo para o agente conseguir editar `app/` e `package.json` juntos.  
- O arquivo deste prompt: [`docs/PROMPT_CURSOR_CAMPO_BABYLON_INTEGRADO.md`](./PROMPT_CURSOR_CAMPO_BABYLON_INTEGRADO.md).

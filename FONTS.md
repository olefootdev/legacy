# Guia de Fontes do Olefoot

## 📋 Fontes Necessárias

Para garantir que as fontes funcionem em todos os navegadores, você precisa baixar e colocar os arquivos na pasta `/public/fonts/`.

### 1. Inter (Fonte principal)
- **Onde baixar**: https://fonts.google.com/specimen/Inter
- **Arquivos necessários**:
  - `Inter-Regular.woff2` (400)
  - `Inter-Medium.woff2` (500)
  - `Inter-SemiBold.woff2` (600)
  - `Inter-Bold.woff2` (700)

### 2. Oswald (Fonte display)
- **Onde baixar**: https://fonts.google.com/specimen/Oswald
- **Arquivos necessários**:
  - `Oswald-Medium.woff2` (500)
  - `Oswald-Bold.woff2` (700)

### 3. Montserrat (Fonte alternativa)
- **Onde baixar**: https://fonts.google.com/specimen/Montserrat
- **Arquivos necessários**:
  - `Montserrat-Regular.woff2` (400)
  - `Montserrat-SemiBold.woff2` (600)
  - `Montserrat-ExtraBold.woff2` (800)
  - `Montserrat-ExtraBoldItalic.woff2` (800 italic)
  - `Montserrat-BlackItalic.woff2` (900 italic)

## 🚀 Como Baixar

### Opção 1: Google Fonts (Recomendado)
1. Acesse o link da fonte
2. Clique em "Download family"
3. Extraia o ZIP
4. Copie os arquivos `.woff2` para `/public/fonts/`

### Opção 2: Google Webfonts Helper
1. Acesse https://gwfh.mranftl.com/fonts
2. Busque pela fonte
3. Selecione os pesos necessários
4. Baixe apenas os arquivos `.woff2`
5. Copie para `/public/fonts/`

## 📁 Estrutura Final

```
public/
└── fonts/
    ├── Inter-Regular.woff2
    ├── Inter-Medium.woff2
    ├── Inter-SemiBold.woff2
    ├── Inter-Bold.woff2
    ├── Oswald-Medium.woff2
    ├── Oswald-Bold.woff2
    ├── Montserrat-Regular.woff2
    ├── Montserrat-SemiBold.woff2
    ├── Montserrat-ExtraBold.woff2
    ├── Montserrat-ExtraBoldItalic.woff2
    └── Montserrat-BlackItalic.woff2
```

## ✅ O que foi implementado

1. **Sistema de carregamento robusto** (`src/lib/fontLoader.ts`)
   - Verifica se as fontes foram carregadas
   - Timeout de 3 segundos por fonte
   - Fallback automático para fontes de sistema
   - Logs detalhados no console

2. **Fontes locais** (`src/styles/fonts.css`)
   - Definições @font-face para todas as fontes
   - Prioridade para fontes locais
   - Google Fonts como fallback

3. **Preload no HTML** (`index.html`)
   - Preload das fontes críticas
   - Preconnect para Google Fonts
   - Melhora performance de carregamento

4. **Fallbacks de sistema** (`src/styles/fonts.css`)
   - Fontes de sistema similares caso falhe
   - Transição suave sem FOUT (Flash of Unstyled Text)

## 🔍 Como Verificar

Abra o console do navegador e procure por:
```
[fonts] ✓ Inter 400 carregada
[fonts] ✓ Inter 700 carregada
[fonts] ✓ Oswald 700 carregada
[fonts] ✓ Montserrat 800 carregada
[fonts] 4/4 fontes críticas carregadas
[fonts] Todas as fontes carregadas
```

Se aparecer:
```
[fonts] Usando fontes de sistema (fallback)
```
Significa que as fontes locais não foram encontradas e o sistema está usando Google Fonts ou fontes de sistema.

## 🎯 Próximos Passos

1. Baixe as fontes seguindo o guia acima
2. Coloque os arquivos em `/public/fonts/`
3. Reinicie o servidor de desenvolvimento
4. Verifique no console se as fontes foram carregadas
5. Teste em diferentes navegadores (Chrome, Firefox, Safari, Edge)

## 💡 Dicas

- Use apenas formato `.woff2` (melhor compressão e suporte moderno)
- Não commite as fontes no Git se forem muito grandes (adicione ao .gitignore)
- Considere usar um CDN para hospedar as fontes em produção
- O sistema funciona mesmo sem as fontes locais (usa Google Fonts como fallback)

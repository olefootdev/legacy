/**
 * Gera a imagem de compartilhamento padrão do REVELA (public/og-default.png).
 *
 * POR QUE ELA PRECISA EXISTIR: `not_found_handling` é single-page-application,
 * então caminho de imagem inexistente devolve o index.html com HTTP 200 — o
 * crawler recebe HTML onde esperava PNG e o preview quebra sem erro visível.
 * Um 404 seria mais honesto que esse 200; como não temos a opção, o arquivo tem
 * que existir de verdade.
 *
 * ⚠️ A FONTE AQUI NÃO É A ANTON. O rasterizador (librsvg, dentro do sharp) lê
 * fontes do sistema via fontconfig e ignora `@font-face` com data URI — a Anton
 * do projeto é um .woff2 e não está instalada. Então usamos Impact, que é o
 * fallback que o próprio design system já declara em `--font-impact` e está
 * presente no macOS. O layout abaixo é posicionado em coordenadas fixas, sem
 * depender da largura que cada fonte dá ao texto — foi assim que o badge
 * "REVELA" apareceu por cima de "OLEFOOT" na primeira versão.
 *
 * Isto vale só para a imagem PADRÃO (home e fallback). As páginas que mais
 * circulam — perfil de talento e de lenda — usam a FOTO do atleta como og:image,
 * que é o que realmente importa no preview.
 *
 * 1200×630 é a proporção que WhatsApp, X e Facebook recortam sem cortar nada.
 *
 *     node scripts/gen-revela-og.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = join(raiz, 'public', 'og-default.png');

const AMARELO = '#FDE100';
const PRETO = '#0D0D0D';
const DISPLAY = "Impact, 'Arial Narrow Bold', 'Helvetica Neue', sans-serif";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${AMARELO}"/>

  <!-- Marca. O badge fica ABAIXO da palavra, não ao lado: assim nenhuma
       diferença de largura entre fontes faz um encostar no outro. -->
  <text x="80" y="112" font-family="${DISPLAY}" font-size="42" fill="${PRETO}"
        letter-spacing="3">OLEFOOT</text>
  <rect x="80" y="132" width="150" height="38" rx="5" fill="${PRETO}"/>
  <text x="100" y="159" font-family="${DISPLAY}" font-size="22" fill="${AMARELO}"
        letter-spacing="5">REVELA</text>

  <!-- A promessa, igual à da home. -->
  <text x="80" y="330" font-family="${DISPLAY}" font-size="104" fill="${PRETO}">DESCUBRA</text>
  <text x="80" y="428" font-family="${DISPLAY}" font-size="104" fill="${PRETO}">QUEM ESTÁ</text>
  <text x="80" y="526" font-family="${DISPLAY}" font-size="104" fill="${PRETO}">CHEGANDO.</text>

  <!-- Régua da marca, no canto oposto ao logo. -->
  <rect x="80" y="562" width="128" height="9" fill="${PRETO}"/>
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
writeFileSync(SAIDA, png);

const kb = Math.round(png.length / 1024);
console.log(`✅ public/og-default.png — 1200×630, ${kb} KB`);

// O WhatsApp costuma desistir do preview em imagem grande. 300 KB é folgado
// para uma arte chapada como esta; se estourar, algo saiu errado.
if (kb > 300) {
  console.error('❌ acima de 300 KB — WhatsApp tende a ignorar preview pesado.');
  process.exit(1);
}

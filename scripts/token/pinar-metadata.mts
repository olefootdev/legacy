/**
 * Pina o LOGO e o METADATA do OLEFOOT no IPFS (Pinata do projeto).
 *   npx tsx scripts/token/pinar-metadata.mts
 *
 * Saída: scripts/token/metadata.out.json — o `uri` que o mint usa
 * (criar-olefoot-mint.mts lê daqui). Rodar UMA vez por mudança de arte;
 * CID é conteúdo-endereçado, repetir com o mesmo arquivo dá o mesmo CID.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { config as dotenv } from 'dotenv';
import { uploadBufferToPinata } from '../../server/src/services/pinata/uploadToPinata.js';

dotenv({ path: 'server/.env' });

const jwt = process.env.PINATA_JWT?.trim();
if (!jwt) {
  console.error('PINATA_JWT não encontrado em server/.env');
  process.exit(1);
}
const gatewayPrefix = (process.env.PINATA_GATEWAY_PREFIX?.trim() || 'https://gateway.pinata.cloud/ipfs/').replace(/\/?$/, '/');

const logo = readFileSync('public/token/olefoot-token.png');
const upLogo = await uploadBufferToPinata({
  jwt,
  buffer: logo.buffer.slice(logo.byteOffset, logo.byteOffset + logo.byteLength) as ArrayBuffer,
  filename: 'olefoot-token.png',
  mimeType: 'image/png',
  gatewayPrefix,
  logContext: { entityType: 'token', entityId: 'olefoot-logo' },
});
if (!upLogo.ok) {
  console.error('falha no upload do logo:', upLogo.message);
  process.exit(1);
}
console.log('✅ logo:', upLogo.publicUrl);

// Metadata no padrão que carteiras/explorers leem (Metaplex-compatible).
const metadata = {
  name: 'OLEFOOT',
  symbol: 'OLEFOOT',
  description:
    'O token do Olefoot — o football manager onde o elenco é um ativo vivo: ' +
    'jogadores valorizam com performance e treino, e o mercado liquida em ' +
    'OLEFOOT na Solana. Jogue em game.olefoot.ai.',
  image: upLogo.publicUrl,
  external_url: 'https://olefoot.ai',
};
const metaBuf = Buffer.from(JSON.stringify(metadata, null, 2), 'utf8');
const upMeta = await uploadBufferToPinata({
  jwt,
  buffer: metaBuf.buffer.slice(metaBuf.byteOffset, metaBuf.byteOffset + metaBuf.byteLength) as ArrayBuffer,
  filename: 'olefoot-metadata.json',
  mimeType: 'application/json',
  gatewayPrefix,
  logContext: { entityType: 'token', entityId: 'olefoot-metadata' },
});
if (!upMeta.ok) {
  console.error('falha no upload do metadata:', upMeta.message);
  process.exit(1);
}
console.log('✅ metadata:', upMeta.publicUrl);

writeFileSync(
  'scripts/token/metadata.out.json',
  JSON.stringify(
    { name: metadata.name, symbol: metadata.symbol, uri: upMeta.publicUrl, image: upLogo.publicUrl, pinadoEm: new Date().toISOString() },
    null,
    2,
  ) + '\n',
);
console.log('→ scripts/token/metadata.out.json gravado (o mint lê daqui).');

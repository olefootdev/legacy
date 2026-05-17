/**
 * Resolve a URL do brasão de um clube/seleção a partir do CDN
 * football-logos.cc.
 *
 * Por que football-logos.cc:
 *  - api-sports.io ativou bloqueio de hotlink → 403 em todo `<img>` do browser
 *  - Cloudflare/local bundle deixaria o repo gordo e exigiria redeploy a cada
 *    brasão novo
 *  - football-logos.cc serve PNG transparente, allowed hotlink de browser, e
 *    cobre 3000+ clubes em 209 países
 *
 * Tradeoff conhecido: o filename inclui um hash de cache-bust
 * (ex: `flamengo.9c3055f2.png`). Se eles regerarem assets o hash muda e a
 * URL quebra. Quando isso acontecer, refazer este mapping é o reparo.
 *
 * IDs seguem a numeração do API-Sports (canônica no nosso domínio).
 */

const CDN = 'https://assets.football-logos.cc/logos';

/**
 * Mapa ID(api-sports) → caminho relativo no CDN (`{country}/256x256/{slug}.{hash}.png`).
 * Quando adicionar clube novo, pegar slug+hash em https://football-logos.cc/{country}/.
 */
const CREST_PATHS: Record<number, string> = {
  // ─── Seleção ──────────────────────────────────────────────────────────
  6: 'brazil/256x256/brazil-national-team.fd8ca234.png',

  // ─── Brasil — Série A ─────────────────────────────────────────────────
  127:  'brazil/256x256/flamengo.9c3055f2.png',
  121:  'brazil/256x256/palmeiras.9ab1d558.png',
  131:  'brazil/256x256/corinthians.c51ae739.png',
  126:  'brazil/256x256/sao-paulo.468eaeb3.png',
  128:  'brazil/256x256/santos.5ea20e58.png',
  124:  'brazil/256x256/fluminense.118d8b5e.png',
  133:  'brazil/256x256/vasco-da-gama.74746cfd.png',
  120:  'brazil/256x256/botafogo.e439f7a4.png',
  1062: 'brazil/256x256/atletico-mineiro.c5c81922.png',
  135:  'brazil/256x256/cruzeiro.6c188ab8.png',
  130:  'brazil/256x256/gremio.d252cec9.png',
  119:  'brazil/256x256/internacional.82f72a2f.png',
  118:  'brazil/256x256/bahia.ac6d69f5.png',
  154:  'brazil/256x256/fortaleza.5f34e5ff.png',
  129:  'brazil/256x256/athletico-paranaense.15469cc7.png',
  152:  'brazil/256x256/ceara.ea9d0cdd.png',

  // ─── Inglaterra — Premier League ─────────────────────────────────────
  33: 'england/256x256/manchester-united.7ab9d343.png',
  34: 'england/256x256/newcastle.53b65b3d.png',
  40: 'england/256x256/liverpool.99c48ae3.png',
  42: 'england/256x256/arsenal.e5528ede.png',
  47: 'england/256x256/tottenham.f192bf50.png',
  49: 'england/256x256/chelsea.fe8d2c2e.png',
  50: 'england/256x256/manchester-city.62f9d1f2.png',
  51: 'england/256x256/brighton.5da206a0.png',
  45: 'england/256x256/everton.6b635cd7.png',
  48: 'england/256x256/west-ham.c86eebf5.png',
  66: 'england/256x256/aston-villa.07a2646c.png',
  62: 'england/256x256/crystal-palace.53067b96.png',

  // ─── Espanha — La Liga ───────────────────────────────────────────────
  541: 'spain/256x256/real-madrid.5ce15611.png',
  529: 'spain/256x256/barcelona.779f8f0f.png',
  530: 'spain/256x256/atletico-madrid.ba72e2cf.png',
  536: 'spain/256x256/sevilla.b741a6ce.png',
  532: 'spain/256x256/valencia.f9d9eee2.png',
  533: 'spain/256x256/villarreal.b0313369.png',
  543: 'spain/256x256/real-betis.7bb10421.png',
  548: 'spain/256x256/real-sociedad.501e3b1e.png',
  538: 'spain/256x256/celta.37e88c80.png',
  531: 'spain/256x256/athletic-club.e1bfba0c.png',

  // ─── Itália — Serie A ────────────────────────────────────────────────
  496: 'italy/256x256/juventus.a8baf848.png',
  489: 'italy/256x256/milan.75d56f90.png',
  505: 'italy/256x256/inter.3a7ce90c.png',
  492: 'italy/256x256/napoli.ee47a50b.png',
  497: 'italy/256x256/roma.034a933e.png',
  487: 'italy/256x256/lazio.2386d28d.png',
  499: 'italy/256x256/atalanta.92f8a674.png',
  502: 'italy/256x256/fiorentina.7ba101c2.png',
  503: 'italy/256x256/torino.a6c78dd6.png',
  500: 'italy/256x256/bologna.a78d435f.png',

  // ─── Alemanha — Bundesliga ───────────────────────────────────────────
  157: 'germany/256x256/bayern-munchen.6c38f13a.png',
  165: 'germany/256x256/borussia-dortmund.09ffedcd.png',
  173: 'germany/256x256/rb-leipzig.9d65faeb.png',
  168: 'germany/256x256/bayer-leverkusen.72f211d8.png',
  169: 'germany/256x256/eintracht-frankfurt.a8244b07.png',
  163: 'germany/256x256/borussia-monchengladbach.94366357.png',
  172: 'germany/256x256/vfb-stuttgart.5b4b15e7.png',
  160: 'germany/256x256/freiburg.2eec4784.png',

  // ─── França — Ligue 1 ────────────────────────────────────────────────
  85: 'france/256x256/paris-saint-germain.579907dc.png',
  81: 'france/256x256/marseille.92b6437c.png',
  80: 'france/256x256/lyon.b44ff7aa.png',
  91: 'france/256x256/as-monaco.51dd5065.png',
  79: 'france/256x256/lille.451f5326.png',
  84: 'france/256x256/nice.e1cdc4f3.png',
  94: 'france/256x256/rennes.6d90b3c1.png',
  83: 'france/256x256/nantes.92be1c98.png',

  // ─── Portugal — Primeira Liga ────────────────────────────────────────
  211: 'portugal/256x256/benfica.3e4d3034.png',
  212: 'portugal/256x256/fc-porto.b58f31f6.png',
  228: 'portugal/256x256/sporting-cp.cf9a4c5b.png',
  217: 'portugal/256x256/sc-braga.07de49c7.png',
  234: 'portugal/256x256/vitoria-de-guimaraes.6e889363.png',

  // ─── Holanda — Eredivisie ────────────────────────────────────────────
  194: 'netherlands/256x256/ajax.fadc62c4.png',
  197: 'netherlands/256x256/psv.b5ebd0db.png',
  209: 'netherlands/256x256/feyenoord.06e393bc.png',
  201: 'netherlands/256x256/az-alkmaar.a5883ab7.png',
  202: 'netherlands/256x256/fc-utrecht.a8ccd806.png',

  // ─── Argentina — Liga Profesional ────────────────────────────────────
  451: 'argentina/256x256/boca-juniors.533fd0f6.png',
  435: 'argentina/256x256/river-plate.44a77530.png',
  450: 'argentina/256x256/racing-club.2b4a44c9.png',
  442: 'argentina/256x256/independiente.091ccb51.png',
  478: 'argentina/256x256/san-lorenzo-de-almagro.94d7129e.png',
  474: 'argentina/256x256/velez-sarsfield.d9813ef4.png',

  // ─── EUA — MLS ───────────────────────────────────────────────────────
  1616: 'usa/256x256/inter-miami-cf.e2a16c34.png',
  1611: 'usa/256x256/la-galaxy.d6fcdb58.png',
  1615: 'usa/256x256/los-angeles-fc.5c1f456a.png',
  1603: 'usa/256x256/atlanta-united.a748f780.png',
  1604: 'usa/256x256/chicago-fire-fc.e072e068.png',
  1610: 'usa/256x256/new-york-city-fc.1aac252b.png',

  // ─── México — Liga MX ────────────────────────────────────────────────
  2279: 'mexico/256x256/club-america.1f41fbf0.png',
  2287: 'mexico/256x256/cd-guadalajara.71fd9506.png',
  2282: 'mexico/256x256/cruz-azul.c7d0245e.png',
  2295: 'mexico/256x256/tigres-uanl.d9441325.png',
  2290: 'mexico/256x256/monterrey.11571be0.png',

  // ─── Turquia — Süper Lig ─────────────────────────────────────────────
  645: 'turkey/256x256/galatasaray.b788795f.png',
  611: 'turkey/256x256/fenerbahce.826f10c2.png',
  610: 'turkey/256x256/besiktas.44876961.png',
  619: 'turkey/256x256/trabzonspor.1e906ab3.png',

  // ─── Arábia Saudita — Pro League ─────────────────────────────────────
  2938: 'saudi-arabia/256x256/al-nassr.7e60a8fc.png',
  2939: 'saudi-arabia/256x256/al-hilal.fc7a4d70.png',
  2941: 'saudi-arabia/256x256/al-ittihad.9a2895c9.png',
  2932: 'saudi-arabia/256x256/al-ahli.4a088ea9.png',
};

/**
 * URL pública do brasão. Retorna string vazia se o id não estiver mapeado —
 * o caller (matchdayCrest) cai no fallback de visualização.
 */
export function localCrestUrl(id: number): string {
  const path = CREST_PATHS[id];
  if (!path) return '';
  return `${CDN}/${path}`;
}

/**
 * O CARD DO ATLETA — a arte que ele posta.
 *
 * O REVELA já pede a foto no cadastro e já sabe o overall, a posição e o
 * arquétipo. Com isso na mão, devolver uma figurinha pronta é quase de graça —
 * e é a única peça do produto que o moleque manda pro grupo sem a gente pedir.
 *
 * ── É CARD, NÃO STORY ───────────────────────────────────────────────────────
 * `StoryCard.tsx` faz 1080×1920 pra tela cheia do Instagram. Este é 1080×1350
 * (4:5), o formato do FEED — o maior que o Instagram aceita sem cortar, e o que
 * cabe inteiro numa conversa de WhatsApp sem virar miniatura. Mesma cozinha
 * (canvas nativo, sem biblioteca), retrato diferente.
 *
 * ── A FOTO É O CARD, MAS PODE FALTAR ────────────────────────────────────────
 * Verificado em 2026-08-04: o Storage do Supabase serve o retrato com CORS, o
 * canvas exporta e o PNG sai limpo. Ainda assim a foto entra por tentativa: se
 * um dia o host mudar, a arte sai com o fundo amarelo e a tipografia grande em
 * vez de não sair. Melhor um card sem foto do que um botão que não faz nada.
 *
 * ── O QUE ENTRA, E POR QUÊ SÓ ISSO ──────────────────────────────────────────
 * Nome, posição, overall, arquétipo e o endereço curto. Cinco coisas. A tentação
 * é enfiar os dez atributos e a cidade e o clube e os fãs — e aí vira tabela,
 * que ninguém posta. O card tem que ser lido de relance no feed de outra pessoa.
 */
import { useState } from 'react';

const L = 1080;
const A = 1350;
const AMARELO = '#fde100';
const PRETO = '#0d0d0d';
const OSSO = '#edebe4';

export interface CardInput {
  nome: string;
  /** Por extenso ("Lateral-direito"), não a sigla — o card é lido por leigo. */
  posicao: string | null;
  overall: number | null;
  /** "Incansável adaptivo". Null enquanto ele não fez o teste. */
  arquetipo: string | null;
  /** `true` quando o overall veio do SCOUT autônomo e ninguém revisou. */
  inicial: boolean;
  portrait: string | null;
  /** revela.olefoot.com/<handle> — o que a pessoa digita depois de ver o card. */
  url: string;
}

function fonte(px: number, familia = 'Anton', peso = '400') {
  return `${peso} ${px}px ${familia}, "Arial Narrow Bold", Impact, sans-serif`;
}

/** Carrega com CORS. Devolve null em vez de estourar — ver cabeçalho. */
async function carregarFoto(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
    setTimeout(() => resolve(null), 6000);
  });
}

/** Desenha cobrindo o retângulo, como `object-fit: cover`. */
function cobrir(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, l: number, a: number) {
  const escala = Math.max(l / img.width, a / img.height);
  const il = img.width * escala;
  const ia = img.height * escala;
  // Puxa 6% pra cima: retrato de futebol tem o rosto no terço superior, e
  // centralizar de verdade corta a testa.
  ctx.drawImage(img, x + (l - il) / 2, y + (a - ia) / 2 - a * 0.06, il, ia);
}

/** Encolhe até caber. Nome comprido não pode vazar a moldura. */
function ajustar(ctx: CanvasRenderingContext2D, texto: string, max: number, inicial: number, minimo: number) {
  let px = inicial;
  ctx.font = fonte(px);
  while (ctx.measureText(texto).width > max && px > minimo) {
    px -= 4;
    ctx.font = fonte(px);
  }
  return px;
}

export async function desenharCard(dados: CardInput): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = L;
  canvas.height = A;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Sem isto o primeiro card sai em Arial: a Anton ainda não terminou de
  // carregar quando o dedo aperta o botão.
  try {
    await document.fonts.ready;
  } catch {
    /* navegador antigo: segue com a fallback */
  }

  const M = 64;
  const foto = await carregarFoto(dados.portrait);

  /* ── Fundo ──────────────────────────────────────────────────────────────
     Com foto: ela ocupa o card inteiro e um degradê preto sobe do rodapé pra
     tipografia ter onde pousar. Sem foto: amarelo chapado, que é a identidade. */
  if (foto) {
    ctx.fillStyle = PRETO;
    ctx.fillRect(0, 0, L, A);
    cobrir(ctx, foto, 0, 0, L, A);

    const g = ctx.createLinearGradient(0, A * 0.34, 0, A);
    g.addColorStop(0, 'rgba(13,13,13,0)');
    g.addColorStop(0.55, 'rgba(13,13,13,.72)');
    g.addColorStop(1, 'rgba(13,13,13,.96)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L, A);
  } else {
    ctx.fillStyle = AMARELO;
    ctx.fillRect(0, 0, L, A);
  }

  const claro = Boolean(foto);
  const tinta = claro ? OSSO : PRETO;
  const apagado = claro ? 'rgba(237,235,228,.62)' : 'rgba(13,13,13,.6)';

  /* ── Moldura ────────────────────────────────────────────────────────────
     Borda amarela grossa é o que faz a peça ser reconhecida como Olefoot
     mesmo quando alguém printa o print de outra pessoa. */
  ctx.strokeStyle = AMARELO;
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, L - 14, A - 14);

  /* ── Selo do topo ───────────────────────────────────────────────────── */
  ctx.fillStyle = AMARELO;
  ctx.fillRect(M, M, 268, 62);
  ctx.fillStyle = PRETO;
  ctx.font = fonte(26, 'Oswald', '700');
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '4px';
  ctx.fillText('OLEFOOT REVELA', M + 20, M + 33);
  ctx.letterSpacing = '0px';

  /* ── O overall, no canto oposto ─────────────────────────────────────────
     Grande porque é o número que a pessoa procura. Em osso — não amarelo —
     quando a ficha ainda é inicial: a mesma regra da página. */
  if (dados.overall != null) {
    ctx.textAlign = 'right';
    ctx.fillStyle = dados.inicial ? tinta : AMARELO;
    ctx.font = fonte(168);
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(dados.overall), L - M, M + 130);

    ctx.fillStyle = apagado;
    ctx.font = fonte(24, 'Oswald', '600');
    ctx.letterSpacing = '3px';
    ctx.fillText(dados.inicial ? 'FICHA INICIAL' : 'OVERALL', L - M, M + 168);
    ctx.letterSpacing = '0px';
    ctx.textAlign = 'left';
  }

  /* ── O rodapé, montado DE BAIXO PRA CIMA ────────────────────────────────
     O nome encolhe pra caber, então a pilha tem que crescer a partir de uma
     âncora fixa. Ancorar no topo faria a linha de baixo dançar conforme o
     tamanho do nome. */
  // A PILHA MEDE A ALTURA DE CADA LINHA. Subir um valor fixo entre linhas de
  // corpos diferentes (30px entre um rótulo de 22 e um arquétipo de 52) faz uma
  // pintar dentro da outra — foi o que aconteceu na primeira versão: o "PLAYER
  // DNA" sumiu atrás do arquétipo. Cada passo agora é `corpo da linha + respiro`.
  let y = A - M;

  // Endereço
  ctx.fillStyle = AMARELO;
  ctx.font = fonte(30, 'Oswald', '700');
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = '2px';
  ctx.fillText(dados.url.replace(/^https?:\/\//, '').toUpperCase(), M, y);
  ctx.letterSpacing = '0px';
  y -= 30 + 30;

  // Arquétipo — a linha que só ele tem
  if (dados.arquetipo) {
    ctx.fillStyle = tinta;
    ctx.font = fonte(54);
    ctx.fillText(dados.arquetipo.toUpperCase(), M, y);
    y -= 54 + 14;

    ctx.fillStyle = apagado;
    ctx.font = fonte(22, 'Oswald', '600');
    ctx.letterSpacing = '3px';
    ctx.fillText('PLAYER DNA', M, y);
    ctx.letterSpacing = '0px';
    y -= 22 + 30;
  }

  // Posição
  if (dados.posicao) {
    ctx.fillStyle = apagado;
    ctx.font = fonte(34, 'Oswald', '600');
    ctx.letterSpacing = '3px';
    ctx.fillText(dados.posicao.toUpperCase(), M, y);
    ctx.letterSpacing = '0px';
    y -= 34 + 16;
  }

  // Nome — o maior que couber
  const px = ajustar(ctx, dados.nome.toUpperCase(), L - M * 2, 132, 56);
  ctx.fillStyle = tinta;
  ctx.font = fonte(px);
  ctx.fillText(dados.nome.toUpperCase(), M, y);

  /* JPEG QUANDO TEM FOTO, PNG QUANDO NÃO TEM.
     O card com retrato saía com 1,9 MB em PNG — peso que trava envio em rede
     ruim, que é a rede de quem mais precisa disto. Foto é imagem contínua: o
     JPEG a 92% derruba pra ~250 KB sem diferença visível. Sem foto o card é
     chapado de amarelo com tipografia dura, e aí o PNG é menor E mais limpo,
     porque JPEG suja borda de letra grande. */
  const formato = foto ? 'image/jpeg' : 'image/png';
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), formato, 0.92));
}

export function BotaoCard({ dados, rotulo = 'Baixar meu card' }: { dados: CardInput; rotulo?: string }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      const blob = await desenharCard(dados);
      if (!blob) throw new Error('canvas');

      const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png';
      const arquivo = new File(
        [blob],
        `olefoot-${dados.nome.toLowerCase().replace(/\s+/g, '-')}.${ext}`,
        { type: blob.type },
      );

      // No celular o share nativo abre Instagram/WhatsApp direto — é lá que o
      // card serve pra alguma coisa. No desktop cai no download.
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: dados.nome });
      } else {
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = arquivo.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(href), 4000);
      }
    } catch {
      setErro('Não deu pra gerar o card. Tenta de novo.');
    }
    setOcupado(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void gerar()}
        disabled={ocupado}
        className="rev-btn rev-focus"
        data-variant="outline"
        data-on="dark"
      >
        {ocupado ? 'Montando…' : rotulo}
      </button>
      {erro && (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--color-rev-danger)' }}>
          {erro}
        </p>
      )}
    </>
  );
}

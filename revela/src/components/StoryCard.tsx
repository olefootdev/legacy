/**
 * GERADOR DE STORY — a munição de divulgação do atleta.
 *
 * POR QUE EXISTE: hoje o atleta divulga colando um link cru no WhatsApp. Link
 * cru não para o dedo de ninguém no feed. Este botão devolve uma arte 9:16
 * pronta pro story, com a foto dele, a divisão, o OVR e o endereço — a mesma
 * informação, num formato que a plataforma dele sabe mostrar.
 *
 * ── DESENHADO EM CANVAS, NÃO EM HTML ────────────────────────────────────────
 * Converter DOM em imagem exigiria html2canvas (biblioteca externa, ~200 KB) ou
 * um serviço de render. Canvas nativo desenha em ~30ms, roda offline e sai em
 * PNG que o Instagram aceita direto.
 *
 * ── A FOTO PODE NÃO ENTRAR, E TUDO BEM ──────────────────────────────────────
 * O retrato vem de outro domínio. Se o host não devolver CORS, o canvas fica
 * "tainted" e `toBlob` explode — perderíamos a arte inteira por causa da foto.
 * Então a foto é OPCIONAL por construção: entra se der, e a arte se vira sem
 * ela (fundo amarelo, tipografia grande). Melhor um story sem foto do que um
 * botão que não faz nada.
 */
import { useState } from 'react';
import { ptBrNum, type Divisao } from '../data/trajetoria';

const L = 1080;
const A = 1920;
const AMARELO = '#fde100';
const PRETO = '#0d0d0d';
const OSSO = '#edebe4';

export interface StoryInput {
  nome: string;
  pos: string | null;
  clube: string | null;
  overall: number | null;
  fas: number;
  divisao: Divisao | null;
  portrait: string | null;
  url: string;
}

/** Carrega a foto com CORS. Devolve null em vez de estourar — ver cabeçalho. */
async function carregarFoto(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
    // Rede de vestiário: 6 segundos e a arte sai sem foto.
    setTimeout(() => resolve(null), 6000);
  });
}

/** Desenha `img` cobrindo o retângulo, como `object-fit: cover`. */
function cobrir(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  l: number,
  a: number,
) {
  const escala = Math.max(l / img.width, a / img.height);
  const il = img.width * escala;
  const ia = img.height * escala;
  ctx.drawImage(img, x + (l - il) / 2, y + (a - ia) / 2 - a * 0.06, il, ia);
}

function fonte(px: number, familia = 'Anton', peso = '400') {
  return `${peso} ${px}px ${familia}, "Arial Narrow Bold", Impact, sans-serif`;
}

export async function desenharStory(dados: StoryInput): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = L;
  canvas.height = A;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Sem isto o canvas desenha com a fonte de fallback: o @font-face da Anton
  // pode não ter terminado de carregar quando a pessoa clica, e a arte sai com
  // outra tipografia — o erro mais caro possível numa peça de marca.
  try {
    await document.fonts.ready;
  } catch {
    /* navegador sem Font Loading API: segue com o fallback */
  }

  const foto = await carregarFoto(dados.portrait);

  ctx.fillStyle = PRETO;
  ctx.fillRect(0, 0, L, A);

  if (foto) {
    cobrir(ctx, foto, 0, 0, L, A);
    const veu = ctx.createLinearGradient(0, 0, 0, A);
    veu.addColorStop(0, 'rgba(13,13,13,.35)');
    veu.addColorStop(0.4, 'rgba(13,13,13,.12)');
    veu.addColorStop(0.62, 'rgba(13,13,13,.8)');
    veu.addColorStop(0.82, PRETO);
    ctx.fillStyle = veu;
    ctx.fillRect(0, 0, L, A);
  } else {
    // Sem foto a arte vira pôster tipográfico — não uma caixa vazia amarela.
    ctx.fillStyle = AMARELO;
    ctx.fillRect(0, 0, L, A * 0.56);
    ctx.fillStyle = PRETO;
    ctx.textBaseline = 'alphabetic';
    ctx.font = fonte(150);
    ctx.fillText('OLEFOOT', 84, A * 0.24);
    ctx.font = fonte(150);
    ctx.fillText('REVELA', 84, A * 0.24 + 140);
    const veu = ctx.createLinearGradient(0, A * 0.34, 0, A * 0.6);
    veu.addColorStop(0, 'rgba(13,13,13,0)');
    veu.addColorStop(1, PRETO);
    ctx.fillStyle = veu;
    ctx.fillRect(0, A * 0.34, L, A * 0.26);
  }

  /* ── A pilha é montada DE BAIXO PRA CIMA ──────────────────────────────────
     Ancorar no topo obriga a adivinhar quanto o nome vai ocupar depois de
     encolher pra caber — e foi exatamente assim que o selo da divisão acabou
     em cima da primeira versão do nome. Da base, cada peça reserva seu espaço
     antes de a de cima ser posicionada. */
  const M = 84;
  const ASSINATURA = 120;

  const yRotulos = A - ASSINATURA - 58; // linha de base dos rótulos (26px)
  const yNumeros = yRotulos - 42; // linha de base dos números (84px)
  const yContexto = yNumeros - 88; // linha de base do "ATA · BASE FC"
  const yNome = yContexto - 44; // linha de base do nome

  ctx.textBaseline = 'alphabetic';

  // Nome — encolhe até caber na largura útil
  const nome = dados.nome.toUpperCase();
  let corpo = 124;
  ctx.font = fonte(corpo);
  while (ctx.measureText(nome).width > L - M * 2 && corpo > 52) {
    corpo -= 4;
    ctx.font = fonte(corpo);
  }
  ctx.fillStyle = AMARELO;
  ctx.fillText(nome, M, yNome);

  // Selo da divisão — acima do TOPO REAL do nome, não de um chute
  if (dados.divisao) {
    const rotulo = dados.divisao.nome.toUpperCase();
    ctx.font = fonte(38, 'Oswald', '600');
    const larg = ctx.measureText(rotulo).width + 52;
    const alt = 58;
    const topoDoNome = yNome - corpo * 0.74;
    const yPill = topoDoNome - 30 - alt;
    ctx.fillStyle = AMARELO;
    ctx.beginPath();
    ctx.roundRect(M, yPill, larg, alt, 8);
    ctx.fill();
    ctx.fillStyle = PRETO;
    ctx.textBaseline = 'middle';
    ctx.fillText(rotulo, M + 26, yPill + alt / 2 + 2);
    ctx.textBaseline = 'alphabetic';
  }

  // Linha de contexto
  const contexto = [dados.pos, dados.clube].filter(Boolean).join(' · ').toUpperCase();
  if (contexto) {
    ctx.font = fonte(34, 'Oswald', '600');
    ctx.fillStyle = 'rgba(237,235,228,.72)';
    ctx.fillText(contexto, M, yContexto);
  }

  // Números
  const numeros: { valor: string; rotulo: string }[] = [];
  if (dados.overall != null) numeros.push({ valor: String(dados.overall), rotulo: 'OVERALL' });
  numeros.push({ valor: ptBrNum(dados.fas), rotulo: dados.fas === 1 ? 'FÃ' : 'FÃS' });

  let x = M;
  for (const n of numeros) {
    ctx.font = fonte(84);
    ctx.fillStyle = OSSO;
    ctx.fillText(n.valor, x, yNumeros);
    const wNum = ctx.measureText(n.valor).width;
    ctx.font = fonte(26, 'Oswald', '600');
    ctx.fillStyle = 'rgba(237,235,228,.5)';
    ctx.fillText(n.rotulo, x, yRotulos);
    x += Math.max(wNum, ctx.measureText(n.rotulo).width) + 96;
  }

  // Assinatura — o endereço é o que faz a arte trabalhar
  ctx.fillStyle = AMARELO;
  ctx.fillRect(0, A - ASSINATURA, L, ASSINATURA);
  ctx.font = fonte(38, 'Oswald', '700');
  ctx.fillStyle = PRETO;
  ctx.textBaseline = 'middle';
  ctx.fillText(dados.url.replace(/^https?:\/\//, '').toUpperCase(), M, A - ASSINATURA / 2);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png', 0.92));
}

export function BotaoStory({ dados }: { dados: StoryInput }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      const blob = await desenharStory(dados);
      if (!blob) throw new Error('canvas');

      const arquivo = new File([blob], `olefoot-${dados.nome.toLowerCase().replace(/\s+/g, '-')}.png`, {
        type: 'image/png',
      });

      // No celular — que é onde o atleta está — o share nativo abre o Instagram
      // direto. No desktop cai no download.
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
      setErro('Não deu pra gerar a arte. Tenta de novo.');
    }
    setOcupado(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void gerar()}
        disabled={ocupado}
        className="rev-btn rev-focus"
        data-variant="yellow"
        data-on="dark"
      >
        {ocupado ? 'Montando…' : 'Gerar arte pro story'}
      </button>
      {erro && (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--color-rev-danger)' }}>
          {erro}
        </p>
      )}
    </div>
  );
}

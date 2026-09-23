/**
 * Receber — o endereço em letra grande e em QR.
 *
 * O QR é gerado AQUI, no aparelho, a partir do endereço que a carteira tem.
 * Não passa por servidor nenhum: um QR de endereço vindo de fora é um vetor
 * óbvio — troca-se um caractere e o dinheiro vai pra outro lugar, e ninguém
 * confere 44 caracteres a olho.
 */
import qrcode from 'qrcode-generator';
import { tradutor } from '@/i18n/idioma';
import { useIdioma } from '@/i18n/useIdioma';
import { TEXTOS } from './textos';
import { Aviso, BOTAO_LINHA, BOTAO_VOLT, Barra } from './ui';

function QR({ texto, lado = 216 }: { texto: string; lado?: number }) {
  const q = qrcode(0, 'M');
  q.addData(texto);
  q.make();
  const n = q.getModuleCount();
  const celula = lado / n;

  const blocos: string[] = [];
  for (let l = 0; l < n; l++) {
    for (let c = 0; c < n; c++) {
      if (q.isDark(l, c)) {
        blocos.push(`M${(c * celula).toFixed(2)} ${(l * celula).toFixed(2)}h${celula.toFixed(2)}v${celula.toFixed(2)}h-${celula.toFixed(2)}z`);
      }
    }
  }

  return (
    <div className="bg-giz p-3.5" style={{ width: lado + 28, height: lado + 28 }}>
      <svg width={lado} height={lado} viewBox={`0 0 ${lado} ${lado}`} shapeRendering="crispEdges"
        role="img" aria-label="QR do endereço">
        <rect width={lado} height={lado} fill="#ECECE7" />
        <path d={blocos.join('')} fill="#0D0D0D" />
      </svg>
    </div>
  );
}

export default function Receber({ endereco, onVoltar }: { endereco: string; onVoltar: () => void }) {
  const [idioma] = useIdioma();
  const t = tradutor(TEXTOS, idioma);

  const compartilhar = async () => {
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
    if (nav.share) { try { await nav.share({ text: endereco }); return; } catch { /* cancelou */ } }
    void navigator.clipboard.writeText(endereco);
  };

  return (
    <div className="flex min-h-full flex-col bg-asfalto">
      <Barra titulo={t('tituloReceber')} onVoltar={onVoltar} />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 px-4 pb-8 pt-5">
        <p className="self-start font-mono text-[11px] text-poeira">#solana</p>

        <QR texto={endereco} />
        <p className="-mt-1 text-[12px] text-poeira">{t('apontarCamera')}</p>

        <div className="w-full border border-white/10 bg-panel px-3.5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cimento">{t('seuEndereco')}</p>
          <p className="mt-1 font-mono text-[13px] leading-relaxed" style={{ wordBreak: 'break-all' }}>{endereco}</p>
        </div>

        <div className="flex w-full gap-2">
          <button type="button" className={BOTAO_LINHA}
            onClick={() => void navigator.clipboard.writeText(endereco)}>{t('copiar')}</button>
          <button type="button" className={BOTAO_LINHA} onClick={() => void compartilhar()}>{t('compartilhar')}</button>
        </div>

        <Aviso titulo={t('soSolana')}>{t('soSolanaTexto')}</Aviso>

        <button type="button" className={`${BOTAO_VOLT} mt-auto`} onClick={onVoltar}>{t('voltar')}</button>
      </div>
    </div>
  );
}

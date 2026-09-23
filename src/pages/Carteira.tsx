/**
 * /carteira — agora só uma ponte pra OLEWALLET.
 *
 * A carteira nasceu aqui dentro e saiu de propósito: ela mora em olefoot.com,
 * origem separada, pra que um XSS em qualquer canto do jogo — nome de jogador,
 * legenda de foto do REVELA, painel admin, script de terceiro — não alcance o
 * cofre. Mesma origem seria o mesmo localStorage e o mesmo contexto de JS.
 *
 * O efeito colateral bom: com esta página virando redirect, o bundle do jogo
 * não carrega mais NENHUMA linha de derivação de chave. O que sobrou aqui do
 * assunto é `oleWalletConnect`, que só sabe abrir uma janela e conferir uma
 * assinatura.
 *
 * O link antigo continua valendo — quem salvou /carteira chega no lugar certo.
 */
import { useEffect } from 'react';
import { ORIGEM_DA_CARTEIRA } from '@/wallet/seed/conexao';

export default function Carteira() {
  useEffect(() => {
    // `replace` pra o botão voltar não cair num pingue-pongue.
    window.location.replace(ORIGEM_DA_CARTEIRA);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-asfalto px-6 text-center">
      <img src="/brand/olefoot-yellow-01.svg" alt="OLEFOOT" className="h-[22px] w-[117px]" />
      <p className="font-display text-[22px] uppercase text-white">Levando você à OLEWALLET</p>
      <p className="max-w-xs text-[13px] leading-relaxed text-cimento">
        A carteira mora em <span className="font-mono text-white">{ORIGEM_DA_CARTEIRA.replace(/^https?:\/\//, '')}</span>,
        separada do jogo de propósito.
      </p>
      <a href={ORIGEM_DA_CARTEIRA} className="mt-2 font-mono text-[13px] text-neon-yellow underline">
        Abrir agora
      </a>
    </div>
  );
}

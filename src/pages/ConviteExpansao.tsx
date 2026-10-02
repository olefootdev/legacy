import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSupabase } from '@/supabase/client';
import { lembrarConviteVisto, esquecerConviteVisto } from '@/wallet/conviteVisto';
import {
  buscarConvite, confirmarConvite, jaConfirmou, guardarConvitePendente, codigoDeIndicacaoDe,
  type ConviteInfo, type MotivoRecusa,
} from '@/supabase/expansaoConvite';

/**
 * /convite-expansao/:username — a porta de entrada na expansão.
 *
 * 🔒 Por que existe uma tela em vez de um link que já coloca na árvore: a
 * posição no binário é PERMANENTE e mexe em dinheiro. Ninguém entra sem ver de
 * quem é o convite e dizer sim — e o sim fica registrado.
 *
 * A tela é pública de propósito: quem clica ainda não logou, e precisa ver o
 * convite ANTES de decidir criar conta. O que ela mostra é só o @ de quem
 * convidou — nada de e-mail, volume ou rede.
 */

type Estado =
  | { t: 'carregando' }
  | { t: 'inexistente' }
  | { t: 'nao_ativado'; info: ConviteInfo }
  | { t: 'precisa_entrar'; info: ConviteInfo }
  | { t: 'confirmar'; info: ConviteInfo }
  | { t: 'enviando'; info: ConviteInfo }
  | { t: 'recusado'; info: ConviteInfo; motivo: MotivoRecusa }
  | { t: 'ja_estava'; padrinho: string }
  | { t: 'pronto'; padrinho: string };

const RECUSA: Record<MotivoRecusa, string> = {
  convite_inexistente: 'Esse convite não existe mais.',
  auto_convite: 'Você não pode se convidar.',
  ja_esta_na_expansao: 'Você já está na expansão.',
  convite_nao_ativado: 'Quem te convidou ainda não ativou a conta.',
  patrocinador_fora_da_arvore: 'Quem te convidou ainda não entrou na expansão.',
  sem_sessao: 'Sua sessão expirou. Entre de novo.',
  erro: 'Não deu para confirmar agora. Tente de novo.',
};

export default function ConviteExpansao() {
  const { username = '' } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>({ t: 'carregando' });

  useEffect(() => {
    let vivo = true;
    (async () => {
      const alvo = username.trim().toLowerCase();
      if (!alvo) { if (vivo) setEstado({ t: 'inexistente' }); return; }

      const info = await buscarConvite(alvo);
      if (!vivo) return;
      if (!info || !info.existe) { setEstado({ t: 'inexistente' }); return; }
      if (!info.podeConvidar) { setEstado({ t: 'nao_ativado', info }); return; }

      const sb = getSupabase();
      const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
      if (!vivo) return;
      if (!data.session) { setEstado({ t: 'precisa_entrar', info }); return; }

      const padrinho = await jaConfirmou();
      if (!vivo) return;
      if (padrinho) { esquecerConviteVisto(); setEstado({ t: 'ja_estava', padrinho }); return; }
      // A pessoa viu o convite e ainda pode dizer "agora não". Se depois ela
      // for comprar um pack, a tela de compra pergunta por ESTE convite antes
      // — comprar põe na árvore, e a posição não muda mais.
      lembrarConviteVisto(info.username);
      setEstado({ t: 'confirmar', info });
    })();
    return () => { vivo = false; };
  }, [username]);

  const confirmar = useCallback(async () => {
    if (estado.t !== 'confirmar') return;
    const info = estado.info;
    setEstado({ t: 'enviando', info });
    const r = await confirmarConvite(info.username);
    if (r.entrou) {
      esquecerConviteVisto();
      setEstado({ t: 'pronto', padrinho: r.patrocinador ?? info.username });
    }
    else setEstado({ t: 'recusado', info, motivo: r.motivo ?? 'erro' });
  }, [estado]);

  const guardaDestino = () => guardarConvitePendente(username);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-deep-black px-4 py-10">
      <div className="w-full max-w-[380px]">
        {/* 🐞 Altura por style, não por classe: `.h-4` NÃO sai no CSS gerado
            deste projeto, e a regra global `img { height: auto }` vence — a
            logo saía com 65px em vez de 18. Mesma armadilha do `break-all`. */}
        <img
          src="/brand/olefoot-yellow-01.svg"
          alt="OLEFOOT"
          style={{ height: 18, width: 'auto' }}
          className="mb-8"
        />

        {estado.t === 'carregando' && (
          <p className="font-mono text-[12px] text-cimento">Abrindo convite…</p>
        )}

        {estado.t === 'inexistente' && (
          <Bloco titulo="Convite não encontrado"
                 texto="Confira o link com quem te enviou.">
            <BotaoLinha onClick={() => navigate('/')}>IR PARA O INÍCIO</BotaoLinha>
          </Bloco>
        )}

        {estado.t === 'nao_ativado' && (
          <Bloco titulo="Convite ainda não ativado"
                 texto={`@${estado.info.username} precisa ativar a conta antes de convidar.`}>
            <p className="mb-5 font-mono text-[11px] leading-relaxed text-poeira">
              A ativação acontece com um pack de $10 na pré-venda. Avise quem te mandou o link.
            </p>
            <BotaoLinha onClick={() => navigate('/')}>IR PARA O INÍCIO</BotaoLinha>
          </Bloco>
        )}

        {estado.t === 'precisa_entrar' && (
          <Bloco titulo="Você foi convidado"
                 texto={`@${estado.info.username} está te chamando para a expansão.`}>
            <p className="mb-5 font-mono text-[11px] leading-relaxed text-poeira">
              Se você já tem conta na OLEFOOT, use o mesmo e-mail — o login é o mesmo de sempre.
            </p>
            <BotaoVolt onClick={() => { guardaDestino(); navigate('/login'); }}>
              JÁ TENHO CONTA
            </BotaoVolt>
            <div className="h-2.5" />
            {/* Cadastro novo pelo convite grava quem indicou: vai pra
                /cadastro/<código de quem convidou>, não pra /cadastro solto. */}
            <BotaoLinha onClick={() => {
              guardaDestino();
              void codigoDeIndicacaoDe(estado.info.username).then((c) =>
                navigate(c ? `/cadastro/${encodeURIComponent(c)}` : '/cadastro'));
            }}>
              CRIAR CONTA
            </BotaoLinha>
          </Bloco>
        )}

        {(estado.t === 'confirmar' || estado.t === 'enviando') && (
          <Bloco titulo="Confirma a ativação?"
                 texto={`Você está sendo ativado por @${estado.info.username}.`}>
            {/* 🔒 O aviso de permanência fica ANTES do botão, não no rodapé. */}
            <p className="mb-5 border-l-2 border-atencao bg-card px-3 py-2.5 font-mono text-[11px] leading-relaxed text-cimento">
              A posição na rede é definitiva. Depois de confirmar, não muda.
            </p>
            <BotaoVolt onClick={confirmar} desabilitado={estado.t === 'enviando'}>
              {estado.t === 'enviando' ? 'CONFIRMANDO…' : 'SIM, CONFIRMAR'}
            </BotaoVolt>
            <div className="h-2.5" />
            <BotaoLinha onClick={() => navigate('/')} desabilitado={estado.t === 'enviando'}>
              NÃO, AGORA NÃO
            </BotaoLinha>
          </Bloco>
        )}

        {estado.t === 'recusado' && (
          <Bloco titulo="Não deu para confirmar" texto={RECUSA[estado.motivo]}>
            <BotaoLinha onClick={() => navigate('/')}>IR PARA O INÍCIO</BotaoLinha>
          </Bloco>
        )}

        {/* 🔴 Depois de ativar, o destino é o NETWORK — não a home do jogo.
            O fundador ativou e foi mandado de volta pro game: "nunca fui para
            a DEX nova, muito menos para a ativação de conta". A expansão é o
            lado de negócios, e mandar pra home apaga o motivo de ter entrado.
            O NETWORK mora na carteira do jogo desde 2026-09-29, então agora o
            caminho não sai mais do domínio. */}
        {estado.t === 'ja_estava' && (
          <Bloco titulo="Você já está na expansão"
                 texto={`Sua ativação foi por @${estado.padrinho}.`}>
            <BotaoVolt onClick={() => navigate('/wallet/network')}>
              ABRIR O NETWORK
            </BotaoVolt>
            <div className="h-2.5" />
            <BotaoLinha onClick={() => navigate('/')}>IR PARA O JOGO</BotaoLinha>
          </Bloco>
        )}

        {estado.t === 'pronto' && (
          <Bloco titulo="Ativado" texto={`Você entrou na expansão por @${estado.padrinho}.`}>
            <BotaoVolt onClick={() => navigate('/wallet/network')}>
              ABRIR O NETWORK
            </BotaoVolt>
            <div className="h-2.5" />
            <BotaoLinha onClick={() => navigate('/')}>IR PARA O JOGO</BotaoLinha>
          </Bloco>
        )}
      </div>
    </div>
  );
}

function Bloco({ titulo, texto, children }: {
  titulo: string; texto: string; children?: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="font-impact text-[30px] uppercase leading-[1.1] text-white">{titulo}</h1>
      <p className="mb-6 mt-2.5 text-[14px] leading-relaxed text-cimento">{texto}</p>
      {children}
    </div>
  );
}

function BotaoVolt({ children, onClick, desabilitado }: {
  children: React.ReactNode; onClick: () => void; desabilitado?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={desabilitado}
      className="w-full bg-neon-yellow px-4 py-3.5 text-[13px] font-bold tracking-wide text-deep-black
                 transition-opacity disabled:opacity-50">
      {children}
    </button>
  );
}

function BotaoLinha({ children, onClick, desabilitado }: {
  children: React.ReactNode; onClick: () => void; desabilitado?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={desabilitado}
      className="w-full border border-white/15 px-4 py-3.5 text-[13px] font-bold tracking-wide text-giz
                 transition-colors hover:border-white/35 disabled:opacity-50">
      {children}
    </button>
  );
}

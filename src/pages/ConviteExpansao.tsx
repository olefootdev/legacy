import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSupabase } from '@/supabase/client';
import { lembrarConviteVisto, esquecerConviteVisto } from '@/wallet/conviteVisto';
import {
  buscarConvite, confirmarConvite, jaConfirmou, guardarConvitePendente, codigoDeIndicacaoDe,
  type ConviteInfo, type MotivoRecusa,
} from '@/supabase/expansaoConvite';
import { L } from '@/i18n/L';

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
  convite_inexistente: L('Esse convite não existe mais.', 'This invite no longer exists.'),
  auto_convite: L('Você não pode se convidar.', "You can't invite yourself."),
  ja_esta_na_expansao: L('Você já está na expansão.', "You're already in the expansion."),
  convite_nao_ativado: L('Quem te convidou ainda não ativou a conta.', "Whoever invited you hasn't activated their account yet."),
  patrocinador_fora_da_arvore: L('Quem te convidou ainda não entrou na expansão.', "Whoever invited you hasn't joined the expansion yet."),
  sem_sessao: L('Sua sessão expirou. Entre de novo.', 'Your session expired. Sign in again.'),
  erro: L('Não deu para confirmar agora. Tente de novo.', "Couldn't confirm right now. Try again."),
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
    <div className="rua-grao flex min-h-svh w-full flex-col items-center justify-center bg-asfalto-27 px-4 py-10">
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
          <p className="font-prova text-[12px] text-mudo">{L('Abrindo convite…', 'Opening invite…')}</p>
        )}

        {estado.t === 'inexistente' && (
          <Bloco titulo={L('Convite não encontrado', 'Invite not found')}
                 texto={L('Confira o link com quem te enviou.', 'Check the link with whoever sent it.')}>
            <BotaoLinha onClick={() => navigate('/')}>{L('IR PARA O INÍCIO', 'GO TO HOME')}</BotaoLinha>
          </Bloco>
        )}

        {estado.t === 'nao_ativado' && (
          <Bloco titulo={L('Convite ainda não ativado', 'Invite not activated yet')}
                 texto={L(`@${estado.info.username} precisa ativar a conta antes de convidar.`, `@${estado.info.username} must activate their account before inviting.`)}>
            <p className="mb-5 font-prova text-[11px] leading-relaxed text-mudo">
              {L('A ativação acontece com um pack de $10 na pré-venda. Avise quem te mandou o link.', 'Activation takes a $10 pack in the presale. Let whoever sent you the link know.')}
            </p>
            <BotaoLinha onClick={() => navigate('/')}>{L('IR PARA O INÍCIO', 'GO TO HOME')}</BotaoLinha>
          </Bloco>
        )}

        {estado.t === 'precisa_entrar' && (
          <Bloco titulo={L('Você foi convidado', "You've been invited")}
                 texto={L(`@${estado.info.username} está te chamando para a expansão.`, `@${estado.info.username} is calling you to the expansion.`)}>
            <p className="mb-5 font-prova text-[11px] leading-relaxed text-mudo">
              {L('Se você já tem conta na OLEFOOT, use o mesmo e-mail — o login é o mesmo de sempre.', 'If you already have an OLEFOOT account, use the same email — same sign-in as always.')}
            </p>
            <BotaoVolt onClick={() => { guardaDestino(); navigate('/login'); }}>
              {L('JÁ TENHO CONTA', 'I HAVE AN ACCOUNT')}
            </BotaoVolt>
            <div className="h-4" />
            {/* Cadastro novo pelo convite grava quem indicou: vai pra
                /cadastro/<código de quem convidou>, não pra /cadastro solto. */}
            <BotaoLinha onClick={() => {
              guardaDestino();
              void codigoDeIndicacaoDe(estado.info.username).then((c) =>
                navigate(c ? `/cadastro/${encodeURIComponent(c)}` : '/cadastro'));
            }}>
              {L('CRIAR CONTA', 'CREATE ACCOUNT')}
            </BotaoLinha>
          </Bloco>
        )}

        {(estado.t === 'confirmar' || estado.t === 'enviando') && (
          <Bloco titulo={L('Confirma a ativação?', 'Confirm activation?')}
                 texto={L(`Você está sendo ativado por @${estado.info.username}.`, `You're being activated by @${estado.info.username}.`)}>
            {/* 🔒 O aviso de permanência fica ANTES do botão, não no rodapé. */}
            <p className="mb-6 -rotate-1 bg-cal px-4 py-3 font-prova text-[12px] font-bold leading-relaxed text-asfalto-27">
              {L('A posição na rede é definitiva. Depois de confirmar, não muda.', "Your network position is permanent. Once confirmed, it can't change.")}
            </p>
            <BotaoVolt onClick={confirmar} desabilitado={estado.t === 'enviando'}>
              {estado.t === 'enviando' ? L('CONFIRMANDO…', 'CONFIRMING…') : L('SIM, CONFIRMAR', 'YES, CONFIRM')}
            </BotaoVolt>
            <div className="h-4" />
            <BotaoLinha onClick={() => navigate('/')} desabilitado={estado.t === 'enviando'}>
              {L('NÃO, AGORA NÃO', 'NOT NOW')}
            </BotaoLinha>
          </Bloco>
        )}

        {estado.t === 'recusado' && (
          <Bloco titulo={L('Não deu para confirmar', "Couldn't confirm")} texto={RECUSA[estado.motivo]}>
            <BotaoLinha onClick={() => navigate('/')}>{L('IR PARA O INÍCIO', 'GO TO HOME')}</BotaoLinha>
          </Bloco>
        )}

        {/* 🔴 Depois de ativar, o destino é o NETWORK — não a home do jogo.
            O fundador ativou e foi mandado de volta pro game: "nunca fui para
            a DEX nova, muito menos para a ativação de conta". A expansão é o
            lado de negócios, e mandar pra home apaga o motivo de ter entrado.
            O NETWORK mora na carteira do jogo desde 2026-09-29, então agora o
            caminho não sai mais do domínio. */}
        {estado.t === 'ja_estava' && (
          <Bloco titulo={L('Você já está na expansão', "You're already in the expansion")}
                 texto={L(`Sua ativação foi por @${estado.padrinho}.`, `You were activated by @${estado.padrinho}.`)}>
            <BotaoVolt onClick={() => navigate('/wallet/network')}>
              {L('ABRIR O NETWORK', 'OPEN NETWORK')}
            </BotaoVolt>
            <div className="h-4" />
            <BotaoLinha onClick={() => navigate('/')}>{L('IR PARA O JOGO', 'GO TO GAME')}</BotaoLinha>
          </Bloco>
        )}

        {estado.t === 'pronto' && (
          <Bloco titulo={L('Ativado', 'Activated')} texto={L(`Você entrou na expansão por @${estado.padrinho}.`, `You joined the expansion through @${estado.padrinho}.`)}>
            <BotaoVolt onClick={() => navigate('/wallet/network')}>
              {L('ABRIR O NETWORK', 'OPEN NETWORK')}
            </BotaoVolt>
            <div className="h-4" />
            <BotaoLinha onClick={() => navigate('/')}>{L('IR PARA O JOGO', 'GO TO GAME')}</BotaoLinha>
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
      <h1 className="border-t-2 border-papel pt-4 font-impact text-[clamp(36px,10vw,46px)] uppercase leading-[0.95] text-papel">{titulo}</h1>
      <p className="mb-6 mt-3 font-voz text-[23px] leading-[1.1] text-suave">{texto}</p>
      {children}
    </div>
  );
}

function BotaoVolt({ children, onClick, desabilitado }: {
  children: React.ReactNode; onClick: () => void; desabilitado?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={desabilitado}
      className="inline-flex min-h-[54px] w-full items-center justify-center bg-rua px-4 font-impact text-[20px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)] disabled:opacity-50">
      {children}
    </button>
  );
}

function BotaoLinha({ children, onClick, desabilitado }: {
  children: React.ReactNode; onClick: () => void; desabilitado?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={desabilitado}
      className="inline-flex min-h-[54px] w-full items-center justify-center border-2 border-papel px-4 font-impact text-[20px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27 disabled:opacity-50">
      {children}
    </button>
  );
}

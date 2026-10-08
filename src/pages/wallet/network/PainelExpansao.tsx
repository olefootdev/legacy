import { useState } from 'react';
import { Link } from 'react-router-dom';
import { definirPernaPadrao, type NoDoMapa, type Carreira, type MeuBonus, type CicloFechado } from '@/supabase/expansaoPainel';
import { mensagemDoPin } from '@/wallet/pinClient';
import { CampoPin } from '@/pages/wallet/PinDaCarteira';
import { cn } from '@/lib/utils';
import { BarraSegmentos, BotaoRua, SeloRua } from '@/components/ui/Rua';
import type { MinhaExpansao } from './useMinhaExpansao';
import { AtivarComLicenca } from './AtivarComLicenca';
import { L, LOCALE, emIngles } from '@/i18n/L';

/**
 * Painel de expansão — o lado de negócios, dentro do NETWORK da carteira.
 *
 * Era a tela `/expansao`, solta fora do menu. O desenho é o mesmo que o
 * fundador aprovou; o que mudou é o endereço (`/wallet/network`) e de onde vêm
 * os dados — o NETWORK lê uma vez e entrega pra este painel e pro herói.
 *
 * Mora no JOGO e não na OLEWALLET de propósito: os dados da árvore estão no
 * Supabase atrás de RLS, e a OLEWALLET não tem sessão. Pôr o SDK do Supabase na
 * origem que guarda a frase de 12 palavras enfraqueceria justamente o que a
 * separa (ver o comentário em `conexao.ts`).
 *
 * 🔑 A regra de leitura que o desenho segue: num binário quem paga é a perna
 * MENOR. Painel que dá dois números grandes iguais faz a pessoa engordar o lado
 * errado — então o herói é o equiparado, e os times são contexto.
 *
 * DS 2027: o equiparado é RESPEITO (asfalto + fio de ouro, número em Anton
 * ouro); os times e a árvore em concreto; nomes na voz; ação em rua.
 */

const NOME_DEGRAU: Record<string, string> = {
  CAMPEAO: L('CAMPEÃO', 'CHAMPION'), DUPLO_CAMPEAO: L('DUPLO', 'DOUBLE'), TRI_CAMPEAO: L('TRI', 'TREBLE'),
  TETRA: 'TETRA', PENTA: 'PENTA',
};

/** Quanto do caminho ATÉ o próximo degrau já andou. */
function pctDegrau(c: Carreira): number {
  const alvo = c.acumulado + c.falta;
  if (alvo <= 0n) return 100;
  return Math.min(100, Number((c.acumulado * 100n) / alvo));
}

const br = (v: bigint) => v.toLocaleString(LOCALE);

/** Rótulo de bloco: "— RÓTULO" em A PROVA. */
const ROTULO = 'font-prova text-[11px] font-bold uppercase tracking-[0.2em] text-mudo';

/** O convite sai sempre com o domínio público, mesmo visto de outro lugar. */
const ORIGEM_DO_CONVITE = 'https://game.olefoot.ai';

/**
 * A compra que ativa. Abre a gaveta Adicionar já no pack de $10.
 *
 * 🐞 O painel mandava "ative com um pack de $10" e não existia onde comprar:
 * a OLEWALLET apontava pra cá e aqui não havia botão. Era o beco que fazia a
 * pessoa achar que o sistema tinha travado.
 */
// Pela SPOT e não pela DEX: comprar não pede PIN, e a primeira compra é a
// última hora de pôr fricção no caminho.
const ATIVAR = '/wallet?adicionar=olefoot&pack=1000';

function BotaoAtivar() {
  return (
    <BotaoRua to={ATIVAR} className="mt-5 w-full">
      {L('Ativar com $10', 'Activate with $10')} <span aria-hidden>→</span>
    </BotaoRua>
  );
}

export function PainelExpansao({ dados }: { dados: MinhaExpansao }) {
  const { carregando, naArvore, padrinho, ativacao, pernas, carreira, mapa, username, convida, bonus, ciclos, reler } = dados;
  const [copiado, setCopiado] = useState(false);

  const link = username ? `${ORIGEM_DO_CONVITE}/convite-expansao/${username}` : null;
  const copiar = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { /* sem clipboard: o texto está na tela pra copiar à mão */ }
  };

  if (carregando) {
    return <p className="font-prova text-[12px] uppercase tracking-[0.16em] text-mudo">{L('Carregando…', 'Loading…')}</p>;
  }

  if (!naArvore) {
    // 🔑 Desde 2026-09-29 são DUAS portas: o convite confirmado, como sempre, e
    // a compra do primeiro pack — quem compra entra na árvore sozinho. A tela
    // dizia que só havia o convite, e mandava a pessoa de volta pro jogo.
    return (
      // Vazio com saída: tracejado, frase na voz, botão.
      <div className="border-2 border-dashed border-fio px-4 py-6 sm:px-5">
        <h3 className="font-voz text-[clamp(34px,9.5vw,46px)] leading-[0.95] text-papel">
          {L('Você ainda não entrou', 'You haven\'t joined yet')}
        </h3>
        <p className="mt-3 text-[13.5px] leading-relaxed text-suave">
          {emIngles() ? <>
          You join by buying your first <strong className="text-papel">$10</strong> OLEFOOT pack,
          or by confirming an invite from someone already in.
          </> : <>
          Entra quem compra o primeiro pack de <strong className="text-papel">$10</strong> de OLEFOOT,
          ou quem confirma o convite de alguém que já está.
          </>}
        </p>
        <BotaoAtivar />
        <AtivarComLicenca aoAtivar={reler} />
      </div>
    );
  }

  const t1 = pernas?.t1 ?? 0n;
  const t2 = pernas?.t2 ?? 0n;
  const equiparado = pernas?.menor ?? 0n;
  const sobra = t1 > t2 ? t1 - t2 : t2 - t1;
  const pernaMaior: 1 | 2 = t1 >= t2 ? 1 : 2;
  const total = t1 + t2;
  // Largura da barra espelhada: proporção do equiparado em cada lado.
  const pct = (v: bigint) => (total === 0n ? 50 : Number((v * 100n) / (t1 > t2 ? t1 : t2 || 1n)));

  return (
    <div className="min-w-0">
      {/* ── o próximo passo, e só um por vez ──────────────────────────────
          🐞 A primeira versão dizia "falta 1 indicado no Time X" para quem
          AINDA NÃO PODE CONVIDAR — mandando fazer o que o sistema não deixa.
          Beco sem saída em painel é o que faz a pessoa achar que travou.
          A ordem real é: comprar o pack → convidar → equiparar. */}
      {!convida ? (
        <div className="mb-8 border-l-[3px] border-rua bg-concreto px-4 py-4">
          <div className={ROTULO}>— {L('Primeiro passo', 'First step')}</div>
          <p className="mt-2 text-[14px] leading-relaxed text-papel">
            {emIngles()
              ? <>Activate your account with a <strong>$10</strong> presale pack. That&apos;s what unlocks your invite.</>
              : <>Ative sua conta com um pack de <strong>$10</strong> na pré-venda. É ele que libera o seu convite.</>}
          </p>
          <p className="mt-2 font-prova text-[11.5px] leading-relaxed text-mudo">
            {L('Depois de ativar: 1 indicado em cada time e o bônus começa a contar.', 'After activating: 1 referral on each team and the bonus starts counting.')}
          </p>
          <BotaoAtivar />
          <AtivarComLicenca aoAtivar={reler} />
        </div>
      ) : ativacao && !ativacao.ativo ? (
        <div className="mb-8 border-l-[3px] border-rua bg-concreto px-4 py-4">
          <div className={ROTULO}>— {L('Falta ativar o bônus', 'Bonus not active yet')}</div>
          <p className="mt-2 text-[14px] leading-relaxed text-papel">
            {emIngles()
              ? <>1 more referral on <strong>Team {ativacao.faltaNaPerna}</strong> and the bonus starts counting.</>
              : <>Falta 1 indicado no <strong>Time {ativacao.faltaNaPerna}</strong> para o bônus começar a contar.</>}
          </p>
          <p className="mt-2 font-prova text-[11.5px] text-mudo">
            {L(`Hoje: ${ativacao.diretosT1} no Time 1 · ${ativacao.diretosT2} no Time 2`, `Today: ${ativacao.diretosT1} on Team 1 · ${ativacao.diretosT2} on Team 2`)}
          </p>
        </div>
      ) : null}

      {/* ── herói: o equiparado, não os times ── */}
      <div className="border-[3px] border-ouro-27 bg-asfalto-27 px-4 py-5 sm:px-5">
        <div className={ROTULO}>— {L('Equiparado', 'Matched')}</div>
        <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="font-impact leading-[0.88] text-ouro-27 tabular-nums [overflow-wrap:anywhere]" style={{ fontSize: 'clamp(54px, 16vw, 88px)' }}>{br(equiparado)}</span>
          <span className="font-prova text-[12px] font-bold uppercase tracking-[0.16em] text-mudo">OLEXP</span>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-suave">
          {emIngles()
            ? <>It&apos;s the <strong className="text-papel">smaller</strong> of the two teams. It sets the bonus — always.</>
            : <>É o <strong className="text-papel">menor</strong> dos dois times. Ele define o bônus — sempre.</>}
        </p>
      </div>

      {/* ── barra espelhada ── */}
      {/* Ouro = o equiparado (o que paga); linha = a sobra do lado maior. */}
      <div className="mt-6 bg-concreto px-4 py-4">
        <div className="mb-2.5 flex justify-between font-impact text-[18px] uppercase leading-none text-papel">
          <span>{L('Time 1', 'Team 1')}</span><span>{L('Time 2', 'Team 2')}</span>
        </div>
        <div className="flex h-9 items-stretch">
          <div className="flex flex-1 justify-end gap-1">
            {pernaMaior === 1 && <div style={{ width: `${100 - pct(t2)}%` }} className="bg-linha" />}
            <div style={{ width: `${pct(t1 > t2 ? t2 : t1)}%` }} className="bg-ouro-27" />
          </div>
          <div className="mx-1 w-[3px] bg-papel" />
          <div className="flex flex-1 gap-1">
            <div style={{ width: `${pct(t1 > t2 ? t2 : t1)}%` }} className="bg-ouro-27" />
            {pernaMaior === 2 && <div style={{ width: `${100 - pct(t1)}%` }} className="bg-linha" />}
          </div>
        </div>
        <div className="mt-3 flex justify-between gap-3">
          <div className="min-w-0">
            <div className="font-impact text-[26px] leading-none text-papel tabular-nums">{br(t1)}</div>
            <div className={cn('mt-1.5 font-prova text-[10.5px] font-bold uppercase tracking-[0.12em]', t1 <= t2 ? 'text-ouro-27' : 'text-mudo')}>
              {t1 <= t2 ? L('★ o que paga', '★ the one that pays') : L('pontos', 'points')}
            </div>
          </div>
          <div className="min-w-0 text-right">
            <div className="font-impact text-[26px] leading-none text-papel tabular-nums">{br(t2)}</div>
            <div className={cn('mt-1.5 font-prova text-[10.5px] font-bold uppercase tracking-[0.12em]', t2 <= t1 ? 'text-ouro-27' : 'text-mudo')}>
              {t2 <= t1 ? L('★ o que paga', '★ the one that pays') : L('pontos', 'points')}
            </div>
          </div>
        </div>
      </div>

      {/* ── sobra: o que mais destrói confiança é sumir com ela ── */}
      {sobra > 0n && (
        <div className="mt-3 flex items-center justify-between gap-3 border-l-[3px] border-fio bg-concreto px-4 py-3">
          <div className="min-w-0">
            <div className={ROTULO}>{L(`Sobra do Time ${pernaMaior}`, `Team ${pernaMaior} carry-over`)}</div>
            <div className="mt-1 font-voz text-[19px] leading-tight text-suave">{L('não se perde — entra no próximo ciclo', 'not lost — rolls into the next cycle')}</div>
          </div>
          <div className="shrink-0 font-impact text-[24px] leading-none text-suave tabular-nums">{br(sobra)}</div>
        </div>
      )}

      {/* ── o que o ciclo já pagou ── */}
      <BlocoBonus bonus={bonus} />

      {/* ── carreira: conta o que foi PAGO, e por isso nunca cai ── */}
      <div className="mt-6 bg-concreto px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className={ROTULO}>— {L('Carreira', 'Career')}</span>
          {carreira?.degrau ? (
            <SeloRua tom="ouro">{NOME_DEGRAU[carreira.degrau] ?? carreira.degrau}</SeloRua>
          ) : (
            <span className="font-prova text-[12px] text-fio">—</span>
          )}
        </div>
        <div className="mt-2.5 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-impact text-[32px] leading-none text-papel tabular-nums">
            {br(carreira?.acumulado ?? 0n)}
          </span>
          <span className="font-prova text-[11.5px] text-mudo">{L('já pagos em equiparação', 'already paid in matching')}</span>
        </div>
        {carreira?.proximo && (
          <>
            <BarraSegmentos valor={pctDegrau(carreira)} max={100} className="mt-3.5" />
            <p className="mt-2.5 font-prova text-[11.5px] leading-relaxed text-mudo">
              {br(carreira.falta)} {L('para', 'to')} {NOME_DEGRAU[carreira.proximo] ?? carreira.proximo}
              {' '}· {L('conta o que foi pago, não o que está parado', 'counts what was paid, not what is idle')}
            </p>
            {carreira.premioProximo != null && (
              <p className="mt-2.5 font-voz text-[22px] leading-tight text-suave">
                {L('Chegou, ganhou', 'Reach it, win')} <strong className="font-impact text-[20px] font-normal text-papel">{br(carreira.premioProximo)} OLEFOOT</strong>
              </p>
            )}
          </>
        )}
        {carreira && carreira.premiosOlefoot > 0n && (
          <p className="mt-3 border-t-2 border-linha pt-2.5 font-prova text-[11.5px] text-mudo">
            {br(carreira.premiosOlefoot)} {L('OLEFOOT já ganhos em prêmios de carreira', 'OLEFOOT already won in career rewards')}
          </p>
        )}
      </div>

      {/* ── os ciclos que pagaram, de toda a rede ── */}
      <BlocoCiclos ciclos={ciclos} />

      {/* ── mapa ── */}
      <SeusIndicados nos={mapa} />
      <MapaHorizontal nos={mapa} />

      {/* ── convite ── */}
      <div className="mt-6 bg-concreto px-4 py-4">
        <div className={ROTULO}>— {L('Seu convite', 'Your invite')}</div>
        {convida && link ? (
          <>
            {/* O link é PROVA: mono, colado num papel de lambe. */}
            <p className="mt-3 -rotate-1 bg-cal px-3 py-2.5 font-prova text-[12px] font-medium leading-relaxed text-asfalto-27"
               style={{ wordBreak: 'break-all' }}>{link}</p>
            <BotaoRua onClick={() => void copiar()} className="mt-5 w-full">
              {copiado ? L('COPIADO', 'COPIED') : <>{L('COPIAR LINK', 'COPY LINK')} <span aria-hidden>→</span></>}
            </BotaoRua>
            <PernaPadrao atual={bonus?.pernaPadrao ?? null} aoMudar={reler} />
          </>
        ) : (
          <p className="mt-2 text-[13px] leading-relaxed text-suave">
            {L('Seu link aparece aqui depois que você ativar a conta com um pack de $10 na pré-venda.', 'Your link shows up here after you activate your account with a $10 presale pack.')}
          </p>
        )}
      </div>

      {padrinho && (
        <p className="mt-6 text-center font-prova text-[11.5px] text-mudo">
          {L('Você entrou por', 'You joined via')} <span className="font-voz text-[20px] text-papel">@{padrinho}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Mapa horizontal: Time 1 acima, Time 2 abaixo, profundidade para a direita.
 *
 * A árvore binária real é longa e magra (derramamento faz a maioria dos nós ter
 * 0 ou 1 filho), então o horizontal renderiza a forma VERDADEIRA — e o
 * desequilíbrio entre as pernas vira assimetria, que é a mesma lição da barra.
 */
const PELA_ORIGEM: Record<string, string> = {
  convite: L('pelo seu convite', 'via your invite'), compra: L('pela compra do pack', 'via pack purchase'), licenca: L('por licença', 'via license'),
  ativacao_3x: L('pela Ativação 3×', 'via 3× Activation'),
};

function dataCurta(iso: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit' }); }
  catch { return iso.slice(0, 10); }
}

/**
 * Quem EU trouxe — a resposta pra "entrou uma pessoa, quem é?".
 * O mapa mostra a forma da rede; esta lista mostra os nomes.
 */
function SeusIndicados({ nos }: { nos: readonly NoDoMapa[] }) {
  const diretos = nos.filter((n) => n.direto);
  return (
    <div className="mt-6 bg-concreto">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-2 pt-4">
        <span className={ROTULO}>— {L('Seus indicados', 'Your referrals')}</span>
        <span className="font-impact text-[20px] leading-none text-papel tabular-nums">{diretos.length}</span>
      </div>
      {diretos.length === 0 ? (
        <p className="px-4 pb-4 text-[13px] leading-relaxed text-suave">{L('Ninguém ainda. Quem entrar pelo seu convite aparece aqui.', 'No one yet. Whoever joins via your invite shows up here.')}</p>
      ) : (
        diretos.map((n) => (
          <div key={n.userId} className="border-t-2 border-linha px-4 py-3">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <span className="min-w-0 truncate font-voz text-[24px] leading-none text-papel">
                {n.username ? `@${n.username}` : L('Sem nome de usuário', 'No username')}
              </span>
              <SeloRua tom={n.ativado ? 'ouro-contorno' : 'mudo'}>{L('Time', 'Team')} {n.perna}</SeloRua>
            </div>
            <div className="mt-1 truncate font-prova text-[11px] text-mudo">
              {[n.clube, n.entrouEm ? L(`entrou ${dataCurta(n.entrouEm)}`, `joined ${dataCurta(n.entrouEm)}`) : null,
                n.ativado ? L('conta ativada', 'account activated') : L('sem ativação', 'not activated')].filter(Boolean).join(' · ')}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/** A ficha de quem foi tocado no mapa. */
function FichaDoNo({ n }: { n: NoDoMapa }) {
  if (!n.daMinhaEquipe) {
    return (
      <div className="border-t-2 border-linha px-4 py-3.5">
        <div className="font-voz text-[22px] leading-none text-suave">{L('Chegou por derramamento', 'Arrived by spillover')}</div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-mudo">
          {L(`Time ${n.perna} · nível ${n.nivel}. Não foi indicado pela sua equipe: ocupa a vaga e soma pontos no seu Time ${n.perna}, mas o nome não aparece pra você.`, `Team ${n.perna} · level ${n.nivel}. Not referred by your team: fills the spot and adds points to your Team ${n.perna}, but the name isn't shown to you.`)}
        </p>
      </div>
    );
  }
  return (
    <div className="border-t-2 border-linha px-4 py-3.5">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 truncate font-voz text-[28px] leading-none text-papel">
          {n.username ? `@${n.username}` : L('Sem nome de usuário', 'No username')}
        </span>
        <SeloRua tom="mudo">{L('Time', 'Team')} {n.perna}</SeloRua>
      </div>
      {n.clube && <div className="mt-1 truncate font-prova text-[12px] uppercase tracking-[0.08em] text-suave">{n.clube}</div>}
      <p className="mt-1.5 font-prova text-[11px] leading-relaxed text-mudo">
        {[L(`nível ${n.nivel}`, `level ${n.nivel}`), n.direto ? L('indicado direto seu', 'your direct referral') : L('da sua equipe', 'from your team'),
          n.entrouEm ? `${L('entrou', 'joined')} ${dataCurta(n.entrouEm)}${n.origem && PELA_ORIGEM[n.origem] ? ` ${PELA_ORIGEM[n.origem]}` : ''}` : null,
        ].filter(Boolean).join(' · ')}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <SeloRua tom={n.ativado ? 'ouro-contorno' : 'mudo'}>
          {n.ativado ? L('Conta ativada', 'Account activated') : L('Sem ativação', 'Not activated')}
        </SeloRua>
        <SeloRua tom={n.binarioAtivo ? 'cal' : 'mudo'}>
          {n.binarioAtivo ? L('Binário ativo', 'Binary active') : L('Binário inativo', 'Binary inactive')}
        </SeloRua>
      </div>
    </div>
  );
}

function MapaHorizontal({ nos }: { nos: readonly NoDoMapa[] }) {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  if (nos.length === 0) {
    return (
      <div className="mt-6 border-2 border-dashed border-fio px-4 py-6">
        <div className={ROTULO}>— {L('Sua rede', 'Your network')}</div>
        <p className="mt-2 font-voz text-[26px] leading-[1.05] text-papel">{L('Ninguém ainda. Seu primeiro convite começa aqui.', 'No one yet. Your first invite starts here.')}</p>
      </div>
    );
  }

  const LARG = 340, A = 220, X0 = 56, EIXO = A / 2;
  const maxNivel = Math.max(...nos.map((n) => n.nivel));
  const colX = (n: number) => X0 + (n / Math.max(1, maxNivel)) * (LARG - X0 - 26);

  // 🐞 A primeira versão ligava TODO nó direto na raiz — virava leque, não
  // árvore. O `paiId` vinha do banco e não era usado. Agora cada nó é
  // posicionado e a ligação sai do PAI de verdade; quando o pai está fora da
  // janela carregada, a ligação sai da raiz e fica pontilhada, dizendo que há
  // caminho que a tela não está mostrando.
  const pos = new Map<string, { x: number; y: number; perna: 1 | 2 }>();
  for (const lado of [1, 2] as const) {
    const daPerna = nos.filter((n) => n.perna === lado).sort((a, b) => a.nivel - b.nivel || a.yOrdem - b.yOrdem);
    const porNivel = new Map<number, NoDoMapa[]>();
    for (const n of daPerna) porNivel.set(n.nivel, [...(porNivel.get(n.nivel) ?? []), n]);
    for (const [nivel, lista] of porNivel) {
      // Até 6 por nível desenha um a um; acima disso a coluna vira densidade.
      const mostrar = lista.slice(0, 6);
      mostrar.forEach((n, i) => {
        const faixa = 82;
        const passo = faixa / (mostrar.length + 1);
        const dy = passo * (i + 1);
        pos.set(n.userId, { x: colX(nivel), y: lado === 1 ? EIXO - dy : EIXO + dy, perna: lado });
      });
    }
  }

  const excedente = (lado: 1 | 2, nivel: number) =>
    nos.filter((n) => n.perna === lado && n.nivel === nivel).length - 6;

  const niveisComExcesso = [...new Set(nos.map((n) => n.nivel))]
    .flatMap((nv) => ([1, 2] as const).map((l) => ({ nivel: nv, lado: l, resto: excedente(l, nv) })))
    .filter((e) => e.resto > 0);

  return (
    <div className="rua-grao mt-6 bg-concreto">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-1 pt-4">
        <span className={ROTULO}>— {L('Sua rede', 'Your network')}</span>
        <span className="min-w-0 truncate font-prova text-[11px] text-mudo">
          {nos.length} {nos.length === 1 ? L('pessoa', 'person') : L('pessoas', 'people')} · {L('até o nível', 'up to level')} {maxNivel}
        </span>
      </div>
      <svg viewBox={`0 0 ${LARG} ${A}`} className="block h-[220px] w-full">
        <line x1={X0} y1={EIXO} x2={LARG - 8} y2={EIXO} stroke="#2E2C28" strokeWidth="2" />
        <text x="4" y="26" fill="#9A958A" fontSize="12" fontFamily="Anton, Impact, sans-serif">{L('TIME 1', 'TEAM 1')}</text>
        <text x="4" y={A - 14} fill="#9A958A" fontSize="12" fontFamily="Anton, Impact, sans-serif">{L('TIME 2', 'TEAM 2')}</text>

        {nos.map((n) => {
          const p = pos.get(n.userId);
          if (!p) return null;                      // está no excedente da coluna
          const pai = n.paiId ? pos.get(n.paiId) : null;
          const origem = pai ?? { x: X0, y: EIXO };
          const forade = !pai && n.nivel > 1;       // pai fora da janela
          return (
            <line key={`l-${n.userId}`}
              x1={origem.x} y1={origem.y} x2={p.x} y2={p.y}
              stroke={n.daMinhaEquipe ? '#9A958A' : '#3A3833'}
              strokeWidth={2}
              strokeDasharray={forade ? '3 3' : undefined} />
          );
        })}

        {nos.map((n) => {
          const p = pos.get(n.userId);
          if (!p) return null;
          const ativo = selecionado === n.userId;
          return (
            <g key={`c-${n.userId}`} className="cursor-pointer"
              onClick={() => setSelecionado(ativo ? null : n.userId)}>
              {/* Área de toque maior que a bolinha: no celular 4,5px não se acerta. */}
              <circle cx={p.x} cy={p.y} r={11} fill="transparent" />
              <circle cx={p.x} cy={p.y} r={n.nivel === 1 ? 6 : 4.5}
                fill={n.daMinhaEquipe ? '#EEE9DF' : '#6B6860'}
                stroke={ativo ? '#F2E61E' : 'none'} strokeWidth={ativo ? 3 : 0} />
              <title>{n.username ? `@${n.username}` : L('derramamento', 'spillover')}</title>
            </g>
          );
        })}

        {niveisComExcesso.map((e) => (
          <text key={`e-${e.lado}-${e.nivel}`}
            x={colX(e.nivel)} y={e.lado === 1 ? EIXO - 92 : EIXO + 98}
            fill="#9A958A" fontSize="9" fontFamily="'Geist Mono', monospace" fontWeight="bold" textAnchor="middle">
            +{e.resto}
          </text>
        ))}

        {/* Você é a raiz — o único ponto em ouro da árvore. */}
        <circle cx={X0} cy={EIXO} r="9" fill="#C9A13B" />
        <text x={X0 - 22} y={EIXO + 25} fill="#C9A13B" fontSize="11" fontFamily="Anton, Impact, sans-serif">{L('VOCÊ', 'YOU')}</text>
      </svg>
      {(() => {
        const n = nos.find((x) => x.userId === selecionado);
        return n ? <FichaDoNo n={n} /> : (
          <p className="border-t-2 border-linha px-4 py-3 font-prova text-[11px] text-mudo">
            {L('Toque numa bolinha pra ver quem é.', 'Tap a dot to see who it is.')}
          </p>
        );
      })()}
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t-2 border-linha px-4 py-3 font-prova text-[10.5px] text-mudo">
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-ouro-27 align-middle" />{L('você', 'you')}</span>
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-papel align-middle" />{L('sua equipe', 'your team')}</span>
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-fio align-middle" />{L('derramou', 'spillover')}</span>
        {niveisComExcesso.length > 0 && <span>{L('+N = mais gente no nível', '+N = more people on this level')}</span>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════ o bônus ═══

/** Centavos de dólar → "$12,34". */
const dolar = (cents: bigint) => {
  const inteiro = cents / 100n;
  const resto = (cents % 100n).toString().padStart(2, '0');
  return `$${inteiro.toLocaleString(LOCALE)}${L(',', '.')}${resto}`;
};

/**
 * O que os ciclos já liquidaram. Em OLEFOOT pelo preço gravado em cada ciclo,
 * e em dólar do lado — o dólar é a conta de verdade, o token é a entrega.
 *
 * Sem botão de saque: não existe token pra entregar. A frase diz quando abre,
 * em vez de um botão que não faz nada.
 */
function BlocoBonus({ bonus }: { bonus: MeuBonus | null }) {
  const aReceber = bonus ? bonus.olefoot - bonus.olefootSacado : 0n;
  return (
    <div className="mt-6 bg-concreto px-4 py-4">
      <div className={ROTULO}>— {L('Bônus a receber', 'Bonus to receive')}</div>
      <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-impact text-[clamp(36px,10vw,48px)] leading-none text-papel tabular-nums">{br(aReceber)}</span>
        <span className="font-prova text-[12px] font-bold uppercase tracking-[0.16em] text-mudo">OLEFOOT</span>
      </div>
      <p className="mt-2 font-prova text-[11.5px] text-suave">
        {bonus && bonus.ciclosPagos > 0
          ? L(`${dolar(bonus.usdCents)} em ${bonus.ciclosPagos} ${bonus.ciclosPagos === 1 ? 'ciclo' : 'ciclos'}`, `${dolar(bonus.usdCents)} in ${bonus.ciclosPagos} ${bonus.ciclosPagos === 1 ? 'cycle' : 'cycles'}`)
          : L('Nenhum ciclo pagou você ainda', 'No cycle has paid you yet')}
      </p>
      {bonus && bonus.tetoDiarioCents > 0n ? <TetoDeHoje hoje={bonus.hojeUsdCents} teto={bonus.tetoDiarioCents} /> : null}
      <p className="mt-3 border-t-2 border-linha pt-3 text-[12.5px] leading-relaxed text-suave">
        {L('O saque abre quando o OLEFOOT for lançado na Solana, para a carteira vinculada.', 'Withdrawals open when OLEFOOT launches on Solana, to your linked wallet.')}
      </p>
    </div>
  );
}

/**
 * O teto do dia. Quem chega perto precisa ver ANTES, não descobrir pelo corte:
 * o que passar de $2.500 no dia não é pago e não volta.
 */
function TetoDeHoje({ hoje, teto }: { hoje: bigint; teto: bigint }) {
  const pct = teto === 0n ? 0 : Math.min(100, Number((hoje * 100n) / teto));
  return (
    <div className="mt-3.5">
      <div className="flex items-baseline justify-between gap-3 font-prova text-[11.5px]">
        <span className="font-bold uppercase tracking-[0.16em] text-mudo">{L('Hoje', 'Today')}</span>
        <span className={cn('tabular-nums', pct >= 100 ? 'text-atencao' : 'text-papel')}>
          {dolar(hoje)} {L('de', 'of')} {dolar(teto)}
        </span>
      </div>
      {/* Segmentos em papel: é medida, não ação. Bateu o teto, acende aviso. */}
      <div aria-hidden className="mt-1.5 grid h-2.5 grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={i < Math.round(pct / 10) ? (pct >= 100 ? 'bg-atencao' : 'bg-papel') : 'bg-linha'} />
        ))}
      </div>
      {pct >= 100 ? (
        <p className="mt-2 font-voz text-[20px] leading-none text-atencao">{L('Teto do dia batido. Volta amanhã.', 'Daily cap reached. Back tomorrow.')}</p>
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════ os ciclos ═════

function quando(iso: string): string {
  try {
    return new Date(iso).toLocaleString(LOCALE, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return iso.slice(0, 16); }
}

/**
 * Os últimos ciclos que pagaram, da rede inteira: quanto foi equiparado e
 * quanto saiu de bônus. O ponto vale fixo $0,25 desde 2026-09-30; a diferença
 * entre equiparado × $0,25 e o pago é o que o teto diário cortou.
 */
function BlocoCiclos({ ciclos }: { ciclos: readonly CicloFechado[] }) {
  return (
    <div className="mt-6 bg-concreto">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-2 pt-4">
        <span className={ROTULO}>— {L('Ciclos pagos', 'Paid cycles')}</span>
        <span className="font-prova text-[11px] text-mudo">{L('a cada hora', 'every hour')}</span>
      </div>
      {ciclos.length === 0 ? (
        <p className="px-4 pb-4 text-[13px] leading-relaxed text-suave">
          {L('Nenhum ainda. Um ciclo paga quando alguém equipara na hora.', 'None yet. A cycle pays when someone matches within the hour.')}
        </p>
      ) : (
        ciclos.map((c) => (
          <div key={c.abreEm} className="border-t-2 border-linha px-4 py-3">
            <div className="flex min-w-0 items-baseline justify-between gap-3">
              <span className="shrink-0 font-prova text-[12px] text-papel">{quando(c.abreEm)}</span>
              <span className="whitespace-nowrap font-impact text-[18px] leading-none text-papel tabular-nums">{L('pago', 'paid')} {dolar(c.bonusTotalUsdCents)}</span>
            </div>
            <div className="mt-1 font-prova text-[11px] text-mudo">
              {br(c.equiparadoTotal)} {L('OLEXP equiparados', 'OLEXP matched')}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════ o próximo indicado ════

/**
 * Em que time cai o próximo indicado. Automático manda pro time com menos
 * indicados diretos — é o que leva à ativação. Escolher um lado serve pra quem
 * está montando um time de propósito.
 *
 * A escolha vale pro PRÓXIMO. Quem já está na árvore não muda de lugar.
 */
function PernaPadrao({ atual, aoMudar }: { atual: 1 | 2 | null; aoMudar: () => void }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Conta com PIN: o servidor recusa a troca sem ele, e a escolha fica
  // pendente aqui até a pessoa digitar. Quem não criou PIN nem vê este passo.
  const [pendente, setPendente] = useState<{ lado: 1 | 2 | null } | null>(null);
  const [pin, setPin] = useState('');
  const opcoes: ReadonlyArray<{ readonly valor: 1 | 2 | null; readonly rotulo: string }> = [
    { valor: null, rotulo: 'Auto' }, { valor: 1, rotulo: L('Time 1', 'Team 1') }, { valor: 2, rotulo: L('Time 2', 'Team 2') },
  ];
  const aplicar = async (v: 1 | 2 | null, comPin?: string) => {
    setSalvando(true);
    setErro(null);
    const r = await definirPernaPadrao(v, comPin);
    setSalvando(false);
    if (r.ok) { setPendente(null); setPin(''); aoMudar(); return; }
    if (r.motivo === 'pin_obrigatorio' && comPin == null) { setPendente({ lado: v }); return; }
    setPin('');
    setErro(mensagemDoPin(r.motivo, r.tentaDeNovoEm));
  };
  const escolher = async (v: 1 | 2 | null) => {
    if (salvando || v === atual) return;
    setPendente(null);
    await aplicar(v);
  };
  return (
    <div className="mt-5 border-t-2 border-linha pt-4">
      <div className={ROTULO}>— {L('Próximo indicado entra no', 'Next referral goes to')}</div>
      <div className="mt-2.5 grid grid-cols-3 border-2 border-linha p-0.5" role="radiogroup" aria-label={L('Time do próximo indicado', 'Next referral team')}>
        {opcoes.map((o) => (
          <button
            key={o.rotulo}
            type="button"
            role="radio"
            aria-checked={atual === o.valor}
            disabled={salvando}
            onClick={() => void escolher(o.valor)}
            className={cn(
              'min-h-[44px] min-w-0 truncate px-1 text-center font-impact text-[17px] uppercase leading-none transition-colors disabled:opacity-50',
              atual === o.valor ? 'bg-rua text-asfalto-27' : 'text-mudo hover:text-papel',
            )}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
      {pendente && (
        <div className="mt-2.5 flex gap-2">
          <CampoPin valor={pin} aoMudar={setPin} foco
            aoEnviar={() => void aplicar(pendente.lado, pin)} />
          <button
            type="button"
            disabled={salvando || pin.length !== 6}
            onClick={() => void aplicar(pendente.lado, pin)}
            className="min-h-[54px] shrink-0 bg-rua px-5 font-impact text-[20px] uppercase leading-none text-asfalto-27 transition-colors hover:bg-papel disabled:opacity-40"
          >
            OK
          </button>
        </div>
      )}
      {erro && <p role="alert" className="mt-2 font-prova text-[12px] text-baixa">{erro}</p>}
    </div>
  );
}

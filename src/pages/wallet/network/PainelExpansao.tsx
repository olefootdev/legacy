import { useState } from 'react';
import { Link } from 'react-router-dom';
import { definirPernaPadrao, type NoDoMapa, type Carreira, type MeuBonus, type CicloFechado } from '@/supabase/expansaoPainel';
import { cn } from '@/lib/utils';
import type { MinhaExpansao } from './useMinhaExpansao';
import { AtivarComLicenca } from './AtivarComLicenca';

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
 */

const NOME_DEGRAU: Record<string, string> = {
  CAMPEAO: 'CAMPEÃO', DUPLO_CAMPEAO: 'DUPLO', TRI_CAMPEAO: 'TRI',
  TETRA: 'TETRA', PENTA: 'PENTA',
};

/** Quanto do caminho ATÉ o próximo degrau já andou. */
function pctDegrau(c: Carreira): number {
  const alvo = c.acumulado + c.falta;
  if (alvo <= 0n) return 100;
  return Math.min(100, Number((c.acumulado * 100n) / alvo));
}

const br = (v: bigint) => v.toLocaleString('pt-BR');

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
    <Link
      to={ATIVAR}
      className="ole-num mt-4 flex h-[50px] w-full items-center justify-center whitespace-nowrap bg-neon-yellow text-[13px] uppercase text-black transition-colors hover:bg-white [--corte:12px] [clip-path:var(--clip-corte)]"
    >
      Ativar com $10
    </Link>
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
    return <p className="font-mono text-[12px] text-cimento">Carregando…</p>;
  }

  if (!naArvore) {
    // 🔑 Desde 2026-09-29 são DUAS portas: o convite confirmado, como sempre, e
    // a compra do primeiro pack — quem compra entra na árvore sozinho. A tela
    // dizia que só havia o convite, e mandava a pessoa de volta pro jogo.
    return (
      <div className="border border-white/10 bg-panel px-4 py-5">
        <h3 className="font-impact text-[24px] uppercase leading-[1.1] text-white">
          Você ainda não entrou
        </h3>
        <p className="mt-2.5 text-[13px] leading-relaxed text-cimento">
          Entra quem compra o primeiro pack de <strong className="text-giz">$10</strong> de OLEFOOT,
          ou quem confirma o convite de alguém que já está.
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
        <div className="mb-6 border-l-2 border-atencao bg-card px-4 py-3.5">
          <div className="font-mono text-[10px] uppercase tracking-wider text-atencao">Primeiro passo</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-giz">
            Ative sua conta com um pack de <strong>$10</strong> na pré-venda. É ele que libera o seu convite.
          </p>
          <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-poeira">
            Depois de ativar: 1 indicado em cada time e o bônus começa a contar.
          </p>
          <BotaoAtivar />
          <AtivarComLicenca aoAtivar={reler} />
        </div>
      ) : ativacao && !ativacao.ativo ? (
        <div className="mb-6 border-l-2 border-atencao bg-card px-4 py-3.5">
          <div className="font-mono text-[10px] uppercase tracking-wider text-atencao">Falta ativar o bônus</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-giz">
            Falta 1 indicado no <strong>Time {ativacao.faltaNaPerna}</strong> para o bônus começar a contar.
          </p>
          <p className="mt-1.5 font-mono text-[11px] text-poeira">
            Hoje: {ativacao.diretosT1} no Time 1 · {ativacao.diretosT2} no Time 2
          </p>
        </div>
      ) : null}

      {/* ── herói: o equiparado, não os times ── */}
      <div className="border border-white/10 bg-panel px-4 py-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-poeira">Equiparado</div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="ole-num text-[46px] font-extrabold leading-none text-neon-yellow">{br(equiparado)}</span>
          <span className="text-[12px] font-semibold text-cimento">OLEXP</span>
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-cimento">
          É o <strong className="text-giz">menor</strong> dos dois times. Ele define o bônus — sempre.
        </p>
      </div>

      {/* ── barra espelhada ── */}
      <div className="mt-5">
        <div className="mb-2 flex justify-between font-mono text-[9px] uppercase tracking-wider text-poeira">
          <span>Time 1</span><span>Time 2</span>
        </div>
        <div className="flex h-8 items-stretch">
          <div className="flex flex-1 justify-end gap-[2px]">
            {pernaMaior === 1 && <div style={{ width: `${100 - pct(t2)}%` }} className="bg-[#3A3C3F]" />}
            <div style={{ width: `${pct(t1 > t2 ? t2 : t1)}%` }} className="bg-neon-yellow" />
          </div>
          <div className="w-[2px] bg-giz" />
          <div className="flex flex-1 gap-[2px]">
            <div style={{ width: `${pct(t1 > t2 ? t2 : t1)}%` }} className="bg-neon-yellow" />
            {pernaMaior === 2 && <div style={{ width: `${100 - pct(t1)}%` }} className="bg-[#3A3C3F]" />}
          </div>
        </div>
        <div className="mt-2 flex justify-between">
          <div>
            <div className="ole-num text-[20px] font-bold leading-none text-giz">{br(t1)}</div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-poeira">
              {t1 <= t2 ? '★ o que paga' : 'pontos'}
            </div>
          </div>
          <div className="text-right">
            <div className="ole-num text-[20px] font-bold leading-none text-giz">{br(t2)}</div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-poeira">
              {t2 <= t1 ? '★ o que paga' : 'pontos'}
            </div>
          </div>
        </div>
      </div>

      {/* ── sobra: o que mais destrói confiança é sumir com ela ── */}
      {sobra > 0n && (
        <div className="mt-4 flex items-center justify-between border-l-2 border-cimento bg-card px-3.5 py-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-poeira">Sobra do Time {pernaMaior}</div>
            <div className="mt-1 text-[11px] text-cimento">não se perde — entra no próximo ciclo</div>
          </div>
          <div className="ole-num text-[18px] font-bold text-cimento">{br(sobra)}</div>
        </div>
      )}

      {/* ── o que o ciclo já pagou ── */}
      <BlocoBonus bonus={bonus} />

      {/* ── carreira: conta o que foi PAGO, e por isso nunca cai ── */}
      <div className="mt-6 border border-white/10 bg-panel px-4 py-4">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-poeira">Carreira</span>
          <span className="font-display text-[15px] font-bold text-giz">
            {carreira?.degrau ? NOME_DEGRAU[carreira.degrau] ?? carreira.degrau : '—'}
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="ole-num text-[20px] font-bold leading-none text-giz">
            {br(carreira?.acumulado ?? 0n)}
          </span>
          <span className="text-[11px] text-cimento">já pagos em equiparação</span>
        </div>
        {carreira?.proximo && (
          <>
            <div className="mt-3 h-1.5 w-full bg-sheet">
              <div className="h-full bg-neon-yellow"
                   style={{ width: `${pctDegrau(carreira)}%` }} />
            </div>
            <p className="mt-2 font-mono text-[10.5px] text-poeira">
              {br(carreira.falta)} para {NOME_DEGRAU[carreira.proximo] ?? carreira.proximo}
              {' '}· conta o que foi pago, não o que está parado
            </p>
          </>
        )}
      </div>

      {/* ── os ciclos que pagaram, de toda a rede ── */}
      <BlocoCiclos ciclos={ciclos} />

      {/* ── mapa ── */}
      <MapaHorizontal nos={mapa} />

      {/* ── convite ── */}
      <div className="mt-6 border border-white/10 bg-panel px-4 py-4">
        <div className="font-mono text-[10px] uppercase tracking-wider text-poeira">Seu convite</div>
        {convida && link ? (
          <>
            <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-giz"
               style={{ wordBreak: 'break-all' }}>{link}</p>
            <button type="button" onClick={copiar}
              className="mt-3 w-full bg-neon-yellow px-4 py-3 text-[13px] font-bold text-deep-black">
              {copiado ? 'COPIADO' : 'COPIAR LINK'}
            </button>
            <PernaPadrao atual={bonus?.pernaPadrao ?? null} aoMudar={reler} />
          </>
        ) : (
          <p className="mt-2 text-[12.5px] leading-relaxed text-cimento">
            Seu link aparece aqui depois que você ativar a conta com um pack de $10 na pré-venda.
          </p>
        )}
      </div>

      {padrinho && (
        <p className="mt-5 text-center font-mono text-[10.5px] text-poeira">
          Você entrou por @{padrinho}
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
function MapaHorizontal({ nos }: { nos: readonly NoDoMapa[] }) {
  if (nos.length === 0) {
    return (
      <div className="mt-6 border border-white/10 bg-panel px-4 py-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-wider text-poeira">Sua rede</div>
        <p className="mt-2 text-[12.5px] text-cimento">Ninguém ainda. Seu primeiro convite começa aqui.</p>
      </div>
    );
  }

  const L = 340, A = 220, X0 = 56, EIXO = A / 2;
  const maxNivel = Math.max(...nos.map((n) => n.nivel));
  const colX = (n: number) => X0 + (n / Math.max(1, maxNivel)) * (L - X0 - 26);

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
    <div className="mt-6 border border-white/10 bg-panel">
      <div className="flex items-baseline justify-between px-4 pb-1 pt-3.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-poeira">Sua rede</span>
        <span className="font-mono text-[10px] text-cimento">
          {nos.length} {nos.length === 1 ? 'pessoa' : 'pessoas'} · até o nível {maxNivel}
        </span>
      </div>
      <svg viewBox={`0 0 ${L} ${A}`} className="block h-[220px] w-full">
        <line x1={X0} y1={EIXO} x2={L - 8} y2={EIXO} stroke="#1B1D1F" strokeWidth="1" />
        <text x="4" y="26" fill="#4A4C4F" fontSize="8" fontFamily="monospace">TIME 1</text>
        <text x="4" y={A - 14} fill="#4A4C4F" fontSize="8" fontFamily="monospace">TIME 2</text>

        {nos.map((n) => {
          const p = pos.get(n.userId);
          if (!p) return null;                      // está no excedente da coluna
          const pai = n.paiId ? pos.get(n.paiId) : null;
          const origem = pai ?? { x: X0, y: EIXO };
          const forade = !pai && n.nivel > 1;       // pai fora da janela
          return (
            <line key={`l-${n.userId}`}
              x1={origem.x} y1={origem.y} x2={p.x} y2={p.y}
              stroke={n.daMinhaEquipe ? '#8A7A18' : '#2E3033'}
              strokeWidth={1.5}
              strokeDasharray={forade ? '3 3' : undefined} />
          );
        })}

        {nos.map((n) => {
          const p = pos.get(n.userId);
          if (!p) return null;
          return (
            <circle key={`c-${n.userId}`} cx={p.x} cy={p.y} r={n.nivel === 1 ? 6 : 4.5}
              fill={n.daMinhaEquipe ? '#FDE100' : '#5A5C5F'} />
          );
        })}

        {niveisComExcesso.map((e) => (
          <text key={`e-${e.lado}-${e.nivel}`}
            x={colX(e.nivel)} y={e.lado === 1 ? EIXO - 92 : EIXO + 98}
            fill="#7E8185" fontSize="9" fontFamily="monospace" textAnchor="middle">
            +{e.resto}
          </text>
        ))}

        <circle cx={X0} cy={EIXO} r="8" fill="#ECECE7" />
        <text x={X0 - 18} y={EIXO + 22} fill="#ECECE7" fontSize="8" fontFamily="monospace" fontWeight="bold">VOCÊ</text>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 px-4 py-2.5 font-mono text-[9px] text-poeira">
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-neon-yellow align-middle" />sua equipe</span>
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#5A5C5F] align-middle" />derramou</span>
        {niveisComExcesso.length > 0 && <span>+N = mais gente no nível</span>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════ o bônus ═══

/** Centavos de dólar → "$12,34". */
const dolar = (cents: bigint) => {
  const inteiro = cents / 100n;
  const resto = (cents % 100n).toString().padStart(2, '0');
  return `$${inteiro.toLocaleString('pt-BR')},${resto}`;
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
    <div className="mt-6 border border-white/10 bg-panel px-4 py-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-poeira">Bônus a receber</div>
      <div className="mt-1.5 whitespace-nowrap">
        <span className="ole-num text-[26px] font-bold leading-none text-white tabular-nums">{br(aReceber)}</span>
        <span className="ml-2 text-[12px] font-semibold text-cimento">OLEFOOT</span>
      </div>
      <p className="mt-1.5 font-mono text-[11px] text-poeira">
        {bonus && bonus.ciclosPagos > 0
          ? `${dolar(bonus.usdCents)} em ${bonus.ciclosPagos} ${bonus.ciclosPagos === 1 ? 'ciclo' : 'ciclos'}`
          : 'Nenhum ciclo pagou você ainda'}
      </p>
      <p className="mt-2.5 border-t border-white/10 pt-2.5 text-[11.5px] leading-relaxed text-cimento">
        O saque abre quando o OLEFOOT for lançado na Solana, para a carteira vinculada.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════ os ciclos ═════

function quando(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return iso.slice(0, 16); }
}

/**
 * Os últimos ciclos que pagaram, da rede inteira. É o registro público de que
 * o pool saiu da receita da hora e foi dividido pelo equiparado: quem olha vê
 * o valor por OLEXP mudar de ciclo pra ciclo, e é isso que impede alguém de
 * ler o bônus como taxa fixa.
 */
function BlocoCiclos({ ciclos }: { ciclos: readonly CicloFechado[] }) {
  return (
    <div className="mt-6 border border-white/10 bg-panel">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-2 pt-3.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-poeira">Ciclos pagos</span>
        <span className="font-mono text-[10px] text-cimento">a cada hora</span>
      </div>
      {ciclos.length === 0 ? (
        <p className="px-4 pb-4 text-[12.5px] leading-relaxed text-cimento">
          Nenhum ainda. Um ciclo paga quando a hora tem compra e alguém equipara.
        </p>
      ) : (
        ciclos.map((c) => (
          <div key={c.abreEm} className="border-t border-white/10 px-4 py-2.5">
            <div className="flex min-w-0 items-baseline justify-between gap-3">
              <span className="shrink-0 font-mono text-[11px] text-giz">{quando(c.abreEm)}</span>
              <span className="ole-num whitespace-nowrap text-[13px] text-white tabular-nums">pool {dolar(c.poolUsdCents)}</span>
            </div>
            <div className="mt-0.5 font-mono text-[10.5px] text-poeira">
              {br(c.equiparadoTotal)} OLEXP equiparados
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
  const [erro, setErro] = useState(false);
  const opcoes: ReadonlyArray<{ readonly valor: 1 | 2 | null; readonly rotulo: string }> = [
    { valor: null, rotulo: 'Auto' }, { valor: 1, rotulo: 'Time 1' }, { valor: 2, rotulo: 'Time 2' },
  ];
  const escolher = async (v: 1 | 2 | null) => {
    if (salvando || v === atual) return;
    setSalvando(true);
    setErro(false);
    const ok = await definirPernaPadrao(v);
    setSalvando(false);
    if (ok) aoMudar(); else setErro(true);
  };
  return (
    <div className="mt-4 border-t border-white/10 pt-3.5">
      <div className="font-mono text-[10px] uppercase tracking-wider text-poeira">Próximo indicado entra no</div>
      <div className="mt-2 grid grid-cols-3 gap-1 border border-white/16 p-1" role="radiogroup" aria-label="Time do próximo indicado">
        {opcoes.map((o) => (
          <button
            key={o.rotulo}
            type="button"
            role="radio"
            aria-checked={atual === o.valor}
            disabled={salvando}
            onClick={() => void escolher(o.valor)}
            className={cn(
              'py-2 text-center font-mono text-[11px] font-medium uppercase tracking-[0.12em] transition-colors disabled:opacity-50',
              atual === o.valor ? 'bg-white text-black' : 'text-cimento hover:text-white',
            )}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
      {erro && <p className="mt-2 text-[11px] text-baixa">Não deu para salvar agora. Tente de novo.</p>}
    </div>
  );
}

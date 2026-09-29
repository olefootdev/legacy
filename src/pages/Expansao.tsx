import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ORIGEM_DA_CARTEIRA } from '@/wallet/seed/conexao';
import {
  lerAtivacao, lerPernas, lerPernasQualificacao, lerMapa, lerMinhaEntrada,
  lerMeuUsername, podeConvidar,
  type Ativacao, type Pernas, type NoDoMapa,
} from '@/supabase/expansaoPainel';

/**
 * Painel de expansão — o lado de negócios.
 *
 * Mora no JOGO e não na DEX de propósito: os dados da árvore estão no Supabase
 * atrás de RLS, e a DEX não tem sessão. Pôr o SDK do Supabase na origem que
 * guarda a frase de 12 palavras enfraqueceria justamente o que a separa
 * (ver o comentário em `conexao.ts`).
 *
 * 🔑 A regra de leitura que o desenho segue: num binário quem paga é a perna
 * MENOR. Painel que dá dois números grandes iguais faz a pessoa engordar o lado
 * errado — então o herói é o equiparado, e os times são contexto.
 */

const DEGRAUS = [
  { nome: 'CAMPEÃO', exige: 10_000n },
  { nome: 'DUPLO', exige: 50_000n },
  { nome: 'TRI', exige: 100_000n },
  { nome: 'TETRA', exige: 250_000n },
  { nome: 'PENTA', exige: 500_000n },
] as const;

const br = (v: bigint) => v.toLocaleString('pt-BR');

export default function Expansao() {
  const [carregando, setCarregando] = useState(true);
  const [naArvore, setNaArvore] = useState(false);
  const [padrinho, setPadrinho] = useState<string | null>(null);
  const [ativacao, setAtivacao] = useState<Ativacao | null>(null);
  const [pernas, setPernas] = useState<Pernas | null>(null);
  const [qualif, setQualif] = useState<Pernas | null>(null);
  const [mapa, setMapa] = useState<NoDoMapa[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [convida, setConvida] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [entrada, u] = await Promise.all([lerMinhaEntrada(), lerMeuUsername()]);
      if (!vivo) return;
      setNaArvore(entrada.naArvore);
      setPadrinho(entrada.padrinho);
      setUsername(u);
      if (entrada.naArvore) {
        const [a, p, q, m, c] = await Promise.all([
          lerAtivacao(), lerPernas(), lerPernasQualificacao(), lerMapa(5), podeConvidar(),
        ]);
        if (!vivo) return;
        setAtivacao(a); setPernas(p); setQualif(q); setMapa(m); setConvida(c);
      }
      if (vivo) setCarregando(false);
    })();
    return () => { vivo = false; };
  }, []);

  const link = username ? `https://game.olefoot.ai/convite-expansao/${username}` : null;
  const copiar = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { /* sem clipboard: o texto está na tela pra copiar à mão */ }
  };

  if (carregando) {
    return <Casca><p className="font-mono text-[12px] text-cimento">Carregando…</p></Casca>;
  }

  if (!naArvore) {
    return (
      <Casca>
        <h1 className="font-impact text-[28px] uppercase leading-[1.1] text-white">Você ainda não está na expansão</h1>
        <p className="mt-2.5 text-[14px] leading-relaxed text-cimento">
          A entrada é por convite de quem já está — e só com o convite confirmado.
        </p>
        <Link to="/" className="mt-6 block border border-white/15 px-4 py-3.5 text-center text-[13px] font-bold text-giz">
          VOLTAR AO JOGO
        </Link>
      </Casca>
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

  const menorQualif = qualif?.menor ?? 0n;
  const atual = [...DEGRAUS].reverse().find((d) => menorQualif >= d.exige) ?? null;
  const proxima = DEGRAUS.find((d) => menorQualif < d.exige) ?? null;

  return (
    <Casca>
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

      {/* ── carreira: enche pelo lado FRACO, senão ensina errado ── */}
      <div className="mt-6 border border-white/10 bg-panel px-4 py-4">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-poeira">Carreira</span>
          <span className="font-display text-[15px] font-bold text-giz">{atual?.nome ?? '—'}</span>
        </div>
        {proxima && (
          <>
            <div className="mt-3 h-1.5 w-full bg-sheet">
              <div className="h-full bg-neon-yellow"
                   style={{ width: `${Math.min(100, Number((menorQualif * 100n) / proxima.exige))}%` }} />
            </div>
            <p className="mt-2 font-mono text-[10.5px] text-poeira">
              {br(proxima.exige - menorQualif)} para {proxima.nome} · conta pela equipe menor
            </p>
          </>
        )}
      </div>

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

      <a href={ORIGEM_DA_CARTEIRA}
         className="mt-6 block border border-white/15 px-4 py-3.5 text-center text-[13px] font-bold text-giz">
        ABRIR A CARTEIRA
      </a>
    </Casca>
  );
}

/**
 * Mapa horizontal: Time 1 acima, Time 2 abaixo, profundidade para a direita.
 *
 * A árvore binária real é longa e magra (derramamento faz a maioria dos nós ter
 * 0 ou 1 filho), então o horizontal renderiza a forma VERDADEIRA — e o
 * desequilíbrio entre as pernas vira assimetria, que é a mesma lição da barra.
 */
function MapaHorizontal({ nos }: { nos: NoDoMapa[] }) {
  if (nos.length === 0) {
    return (
      <div className="mt-6 border border-white/10 bg-panel px-4 py-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-wider text-poeira">Sua rede</div>
        <p className="mt-2 text-[12.5px] text-cimento">Ninguém ainda. Seu primeiro convite começa aqui.</p>
      </div>
    );
  }
  const maxNivel = Math.max(...nos.map((n) => n.nivel));
  const colX = (n: number) => 62 + ((n - 1) / Math.max(1, maxNivel - 1 || 1)) * 250;
  const porPerna = (lado: 1 | 2) => nos.filter((n) => n.perna === lado);
  const yDe = (lado: 1 | 2, i: number, total: number) =>
    lado === 1 ? 95 - ((i + 1) / (total + 1)) * 78 : 125 + ((i + 1) / (total + 1)) * 78;

  return (
    <div className="mt-6 border border-white/10 bg-panel">
      <div className="flex items-baseline justify-between px-4 pb-1 pt-3.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-poeira">Sua rede</span>
        <span className="font-mono text-[10px] text-cimento">{nos.length} pessoas</span>
      </div>
      <svg viewBox="0 0 340 220" className="block h-[220px] w-full">
        <line x1="62" y1="110" x2="332" y2="110" stroke="#1B1D1F" strokeWidth="1" />
        <text x="6" y="34" fill="#4A4C4F" fontSize="8" fontFamily="monospace">TIME 1</text>
        <text x="6" y="192" fill="#4A4C4F" fontSize="8" fontFamily="monospace">TIME 2</text>
        {([1, 2] as const).map((lado) => {
          const lista = porPerna(lado);
          return lista.map((n, i) => {
            const x = colX(n.nivel);
            const y = yDe(lado, i, lista.length);
            return (
              <g key={n.userId}>
                <line x1={62} y1={110} x2={x} y2={y}
                      stroke={n.daMinhaEquipe ? '#8A7A18' : '#2E3033'} strokeWidth="1.5" />
                <circle cx={x} cy={y} r={5} fill={n.daMinhaEquipe ? '#FDE100' : '#5A5C5F'} />
              </g>
            );
          });
        })}
        <circle cx="62" cy="110" r="8" fill="#ECECE7" />
        <text x="44" y="130" fill="#ECECE7" fontSize="8" fontFamily="monospace" fontWeight="bold">VOCÊ</text>
      </svg>
      <div className="flex gap-4 border-t border-white/10 px-4 py-2.5 font-mono text-[9px] text-poeira">
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-neon-yellow align-middle" />sua equipe</span>
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#5A5C5F] align-middle" />derramou</span>
      </div>
    </div>
  );
}

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-w-0 max-w-[560px] px-4 pb-10 pt-6">
      <h2 className="mb-5 font-impact text-[22px] uppercase leading-[1.1] text-white">Expansão</h2>
      {children}
    </div>
  );
}

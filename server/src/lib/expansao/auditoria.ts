/**
 * As duas auditorias (BÔNUS DE EQUIPARAÇÃO · v1).
 *
 * O desenho do fundador tem DOIS PORTÕES, e a separação é o que o torna forte:
 *
 *   1. de hora em hora o ciclo equipara e credita o bônus DIGITALMENTE;
 *   2. no CLAIM, antes de soltar OLEFOOT de verdade, roda de novo.
 *
 * Entre um e outro existe tempo — e é nesse tempo que estorno aparece, que
 * conta comprometida é recuperada, e que padrão de fraude fica visível. Pagar
 * na hora seria abrir mão disso.
 *
 * ⚠️ "Auditoria" genérica não serve de nada. Cada regra aqui existe contra um
 * ataque específico, nomeado no comentário. Regra sem ataque é teatro.
 *
 * Puro: recebe fatos, devolve veredito. Quem coleta os fatos é a rota.
 */
import type { Olexp } from './unidade.js';

export interface Achado {
  readonly regra: string;
  readonly grave: boolean;
  readonly detalhe: string;
}

export interface Veredito {
  readonly liberado: boolean;
  readonly achados: readonly Achado[];
}

const vereditoDe = (achados: Achado[]): Veredito => ({
  liberado: !achados.some((a) => a.grave),
  achados,
});

// ═══════════════════════════════════════════════════ auditoria do CICLO ═══

export interface FatosDoCiclo {
  readonly creditadoNoCiclo: Olexp;
  readonly debitadoNoCiclo: Olexp;
  /** Soma dos equiparados individuais. */
  readonly equiparadoSomado: Olexp;
  /** O total que o ciclo declarou equiparar. */
  readonly equiparadoDeclarado: Olexp;
  /** Origens (`ref`) creditadas neste ciclo — repetição é dupla contagem. */
  readonly refsCreditados: readonly string[];
  /** Créditos sem `ref` rastreável. */
  readonly creditosSemOrigem: number;
  readonly pool: bigint;
}

export function auditarCiclo(f: FatosDoCiclo): Veredito {
  const a: Achado[] = [];

  // Ataque: crédito fabricado. Se a soma individual não bate com o total
  // declarado, alguém foi pago por OLEXP que o ciclo não equiparou.
  if (f.equiparadoSomado !== f.equiparadoDeclarado) {
    a.push({
      regra: 'soma_equiparada', grave: true,
      detalhe: `somando por pessoa dá ${f.equiparadoSomado}, o ciclo declarou ${f.equiparadoDeclarado}`,
    });
  }

  // Ataque: a MESMA compra gerando OLEXP duas vezes — webhook reentregue,
  // retry de rede, dedo duplo. O índice único no banco barra; aqui a gente
  // confere de novo porque um índice pode ser criado errado uma vez só.
  const vistos = new Set<string>();
  const repetidos = f.refsCreditados.filter((r) => (vistos.has(r) ? true : (vistos.add(r), false)));
  if (repetidos.length > 0) {
    a.push({
      regra: 'origem_repetida', grave: true,
      detalhe: `${repetidos.length} origem(ns) contabilizada(s) duas vezes: ${[...new Set(repetidos)].slice(0, 3).join(', ')}`,
    });
  }

  // Ataque: crédito injetado direto no banco, sem compra por trás.
  if (f.creditosSemOrigem > 0) {
    a.push({
      regra: 'credito_sem_origem', grave: true,
      detalhe: `${f.creditosSemOrigem} crédito(s) de OLEXP sem origem rastreável`,
    });
  }

  // Não é ataque, é coerência: pagar mais do que o pool comporta.
  if (f.pool < 0n) {
    a.push({ regra: 'pool_negativo', grave: true, detalhe: `pool ${f.pool}` });
  }

  // Aviso, não bloqueio: pode ser carry-over legítimo do ciclo anterior.
  if (f.debitadoNoCiclo > f.creditadoNoCiclo) {
    a.push({
      regra: 'debito_maior_que_credito', grave: false,
      detalhe: `debitou ${f.debitadoNoCiclo} contra ${f.creditadoNoCiclo} creditado — confira o carry-over`,
    });
  }

  return vereditoDe(a);
}

// ═══════════════════════════════════════════════════ auditoria do CLAIM ═══

export interface FatosDoClaim {
  readonly userId: string;
  /** Saldo que a tabela diz. */
  readonly saldoDeclarado: bigint;
  /** Saldo recomputado somando o ledger — a fonte da verdade. */
  readonly saldoRecomputado: bigint;
  /** Wallet destino pedida no claim. */
  readonly walletPedida: string;
  /** Wallet vinculada e ASSINADA na conta. null = nenhuma. */
  readonly walletVinculada: string | null;
  readonly walletVerificada: boolean;
  /** Horas desde a última troca de wallet. null = nunca trocou. */
  readonly horasDesdeTrocaDeWallet: number | null;
  /** Quantas OUTRAS contas usam essa mesma wallet. */
  readonly contasComAMesmaWallet: number;
  /** Compras que geraram este bônus e ainda estão na janela de estorno. */
  readonly comprasNaoLiquidadas: number;
  /** Já existe pagamento com este mesmo `ref`? */
  readonly refJaPago: boolean;
  /** A conta está sinalizada pela administração. */
  readonly contaSinalizada: boolean;
  /**
   * Pagamentos que financiaram AS DUAS pernas da própria rede — o atalho
   * clássico: a pessoa põe dinheiro dos dois lados e colhe a equiparação.
   */
  readonly origensNasDuasPernas: number;
}

/** Quanto tempo uma wallet recém-trocada segura o claim. */
export const CARENCIA_TROCA_WALLET_HORAS = 48;

export function auditarClaim(f: FatosDoClaim): Veredito {
  const a: Achado[] = [];

  // Ataque nº 1, o que mais acontece: conta invadida, atacante troca a wallet
  // e saca. Por isso o destino NÃO é escolhido no claim — ele TEM que ser a
  // wallet já vinculada com assinatura.
  if (!f.walletVinculada) {
    a.push({ regra: 'sem_wallet', grave: true, detalhe: 'nenhuma wallet vinculada à conta' });
  } else if (f.walletPedida !== f.walletVinculada) {
    a.push({
      regra: 'wallet_divergente', grave: true,
      detalhe: 'a wallet pedida não é a vinculada à conta',
    });
  }
  if (f.walletVinculada && !f.walletVerificada) {
    a.push({ regra: 'wallet_sem_assinatura', grave: true, detalhe: 'wallet vinculada sem prova de posse' });
  }

  // Mesmo ataque, versão paciente: invade, troca a wallet, espera o próximo
  // ciclo. A carência dá tempo de o dono perceber.
  if (f.horasDesdeTrocaDeWallet !== null && f.horasDesdeTrocaDeWallet < CARENCIA_TROCA_WALLET_HORAS) {
    a.push({
      regra: 'wallet_trocada_ha_pouco', grave: true,
      detalhe: `wallet trocada há ${f.horasDesdeTrocaDeWallet}h; a carência é de ${CARENCIA_TROCA_WALLET_HORAS}h`,
    });
  }

  // Ataque: dezenas de contas fantasma drenando pra um endereço só.
  if (f.contasComAMesmaWallet > 0) {
    a.push({
      regra: 'wallet_compartilhada', grave: true,
      detalhe: `mais ${f.contasComAMesmaWallet} conta(s) apontam pra esta mesma wallet`,
    });
  }

  // Ataque: compra no Pix → OLEXP → equipara → saca → estorna a compra.
  // O dinheiro sai duas vezes. Só libera depois que a compra é final.
  if (f.comprasNaoLiquidadas > 0) {
    a.push({
      regra: 'compra_nao_liquidada', grave: true,
      detalhe: `${f.comprasNaoLiquidadas} compra(s) ainda na janela de estorno`,
    });
  }

  // Ataque: o atalho do binário — financiar os dois lados da própria rede pra
  // farmar equiparação. Não é bloqueio automático: um casal, dois sócios ou
  // uma conta empresarial caem aqui de boa-fé. Sinaliza pra pessoa olhar.
  if (f.origensNasDuasPernas > 0) {
    a.push({
      regra: 'mesma_origem_nas_duas_pernas', grave: false,
      detalhe: `${f.origensNasDuasPernas} origem(ns) de pagamento aparecem nas duas pernas — revisar antes de liberar`,
    });
  }

  // A verdade é o ledger. Se a coluna de saldo diverge da soma dos
  // lançamentos, alguém escreveu direto no saldo.
  if (f.saldoDeclarado !== f.saldoRecomputado) {
    a.push({
      regra: 'saldo_nao_bate', grave: true,
      detalhe: `saldo diz ${f.saldoDeclarado}, o ledger soma ${f.saldoRecomputado}`,
    });
  }
  if (f.saldoRecomputado <= 0n) {
    a.push({ regra: 'sem_saldo', grave: true, detalhe: 'nada a sacar' });
  }

  // Idempotência: retry, timeout ou duplo clique não podem pagar duas vezes.
  if (f.refJaPago) {
    a.push({ regra: 'ref_ja_pago', grave: true, detalhe: 'já existe pagamento com esta mesma referência' });
  }

  if (f.contaSinalizada) {
    a.push({ regra: 'conta_sinalizada', grave: true, detalhe: 'conta sob revisão da administração' });
  }

  return vereditoDe(a);
}

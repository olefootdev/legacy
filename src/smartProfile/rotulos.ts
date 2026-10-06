/**
 * SMART-PROFILE — o que a pessoa lê. Os ids vêm do servidor
 * (server/src/lib/smartProfile/classes.ts); aqui só o rótulo PT/EN.
 */
import { L } from '@/i18n/L';

export const NOME_DA_CLASSE: Record<string, string> = {
  paredao: L('Paredão', 'Shot-stopper'),
  goleiro_libero: L('Goleiro-líbero', 'Sweeper keeper'),
  xerife: L('Xerife', 'Stopper'),
  zagueiro_construtor: L('Zagueiro construtor', 'Ball-playing defender'),
  lateral_apoiador: L('Lateral apoiador', 'Attacking full-back'),
  lateral_marcador: L('Lateral marcador', 'Defensive full-back'),
  volante_destruidor: L('Volante destruidor', 'Ball winner'),
  regista: L('Regista', 'Regista'),
  box_to_box: L('Box-to-box', 'Box-to-box'),
  maestro: L('Maestro', 'Playmaker'),
  meia_chegada: L('Meia de chegada', 'Shadow striker'),
  ponta_driblador: L('Ponta driblador', 'Dribbling winger'),
  velocista: L('Velocista', 'Speedster'),
  pivo: L('Pivô', 'Target man'),
  falso_9: L('Falso 9', 'False 9'),
  matador: L('Matador', 'Poacher'),
};

export const DESCRICAO_DA_CLASSE: Record<string, string> = {
  paredao: L('Segura o gol com reflexo e presença.', 'Keeps goal with reflexes and presence.'),
  goleiro_libero: L('Sai do gol e começa a jogada com os pés.', 'Comes off the line and starts play with his feet.'),
  xerife: L('Ganha o duelo no chão e no alto.', 'Wins the duel on the ground and in the air.'),
  zagueiro_construtor: L('Sai jogando e quebra linhas com o passe.', 'Plays out from the back and breaks lines with passes.'),
  lateral_apoiador: L('Vive no campo de ataque e cruza.', 'Lives in the attacking half and crosses.'),
  lateral_marcador: L('Fecha o corredor e não deixa passar.', 'Shuts the flank and lets nothing through.'),
  volante_destruidor: L('Recupera a bola e protege a defesa.', 'Wins the ball back and shields the defence.'),
  regista: L('Dita o ritmo de trás com o passe.', 'Sets the tempo from deep with his passing.'),
  box_to_box: L('Defende e ataca o jogo inteiro.', 'Defends and attacks for the whole match.'),
  maestro: L('Cria a jogada e acha o passe decisivo.', 'Creates the play and finds the killer pass.'),
  meia_chegada: L('Chega de trás para finalizar.', 'Arrives late in the box to finish.'),
  ponta_driblador: L('Parte para cima no um contra um.', 'Takes on his man one-on-one.'),
  velocista: L('Ganha na corrida e ataca o espaço.', 'Wins the race and attacks the space.'),
  pivo: L('Segura de costas e decide de cabeça.', 'Holds it up and wins it in the air.'),
  falso_9: L('Recua para armar e abrir espaço.', 'Drops deep to create and open space.'),
  matador: L('Vive dentro da área e não perdoa.', 'Lives in the box and never forgives.'),
};

export const NOME_DA_RARIDADE: Record<string, string> = {
  comum: L('Comum', 'Common'),
  raro: L('Raro', 'Rare'),
  epico: L('Épico', 'Epic'),
  lendario: L('Lendário', 'Legendary'),
  unico: L('Único', 'Unique'),
};

export const NOME_DO_TEMPERAMENTO: Record<'ousadia' | 'frieza' | 'ambicao' | 'lealdade', string> = {
  ousadia: L('Ousadia', 'Daring'),
  frieza: L('Frieza', 'Composure'),
  ambicao: L('Ambição', 'Ambition'),
  lealdade: L('Lealdade', 'Loyalty'),
};

export const nomeDaClasse = (id: string | null | undefined) => (id ? NOME_DA_CLASSE[id] ?? id : '');


/**
 * Nomes dos traços (Fase 4). O SERVIDOR é dono dos ids, do atributo e do bônus
 * — ver `catalogoDeTracos` em server/src/lib/smartProfile/rpg.ts. Aqui ficam só
 * as palavras, porque é o cliente que fala PT/EN. Traço sem nome aqui aparece
 * pelo id: catálogo novo no servidor não quebra a tela.
 */
export const NOME_DO_TRACO: Record<string, string> = {
  matador: L('Matador', 'Finisher'),
  maestro: L('Maestro', 'Playmaker'),
  xerifao: L('Xerifão', 'Enforcer'),
  veterano: L('Veterano', 'Veteran'),
  incansavel: L('Incansável', 'Relentless'),
};

/** Como se ganha, na voz do jogo. */
export const COMO_SE_GANHA: Record<string, string> = {
  matador: L('10 gols na carreira', '10 career goals'),
  maestro: L('nível 10', 'level 10'),
  xerifao: L('25 partidas na defesa', '25 matches in defence'),
  veterano: L('50 partidas', '50 matches'),
  incansavel: L('nível 20', 'level 20'),
};

/** Atributo do bônus, pro chip dizer o efeito. */
export const NOME_DO_ATRIBUTO: Record<string, string> = {
  finalizacao: L('finalização', 'finishing'),
  passe: L('passe', 'passing'),
  marcacao: L('marcação', 'marking'),
  velocidade: L('velocidade', 'pace'),
  drible: L('drible', 'dribbling'),
  fisico: L('físico', 'physical'),
  tatico: L('tático', 'tactical'),
  mentalidade: L('mentalidade', 'mentality'),
  confianca: L('confiança', 'confidence'),
  fairPlay: L('fair play', 'fair play'),
};

/**
 * MANAGER-IDEAS (Fase 5). Mesma divisão de sempre: o SERVIDOR é dono dos ids,
 * dos requisitos e do efeito (`catalogoDeIdeias` em ideias.ts); aqui ficam as
 * palavras e o QUANDO em linguagem de jogo, porque a condição é o que o manager
 * precisa entender para escolher.
 */
export const NOME_DA_IDEIA: Record<string, string> = {
  mata_leao: L('Mata-leão', 'Giant-killer'),
  chave_do_jogo: L('Chave do jogo', 'Game-breaker'),
  dono_do_classico: L('Dono do clássico', 'Derby king'),
  segura_o_jogo: L('Segura o jogo', 'Hold the line'),
  favorito_nao_relaxa: L('Favorito não relaxa', 'No complacency'),
};

/** Quando a ideia acorda em campo. */
export const QUANDO_A_IDEIA_VALE: Record<string, string> = {
  mata_leao: L('contra time mais forte', 'against a stronger side'),
  chave_do_jogo: L('com o time montado para atacar', 'when set up to attack'),
  dono_do_classico: L('em clássico', 'in a derby'),
  segura_o_jogo: L('postura defensiva ou 2º tempo', 'defensive setup or second half'),
  favorito_nao_relaxa: L('quando você é o favorito', 'when you are the favourite'),
};

/** Por que o jogador recusou. */
export const RECUSA_DO_JOGADOR: Record<string, string> = {
  'ideia-desconhecida': L('essa ideia não existe', 'that idea does not exist'),
  'ja-sabe': L('ele já sabe', 'he already knows it'),
  'sem-espaco': L('o cérebro dele está cheio', 'his brain is full'),
  'nivel-baixo': L('nível ainda baixo', 'level too low'),
  'fora-do-setor': L('não é ideia para a posição dele', 'not an idea for his position'),
  'nao-topa': L('ele não topa — não é do temperamento dele', 'he is not up for it — not his temperament'),
  'nao-sabe': L('ele não sabe essa ideia', 'he does not know that idea'),
  'sem-sessao': L('entre na sua conta', 'sign in first'),
  'sem-rede': L('sem conexão', 'no connection'),
  indisponivel: L('indisponível agora', 'unavailable right now'),
};

/** Eixos do temperamento, pro requisito aparecer na voz do jogo. */
export const NOME_DO_EIXO: Record<string, string> = {
  ousadia: L('ousadia', 'daring'),
  frieza: L('frieza', 'composure'),
  ambicao: L('ambição', 'ambition'),
  lealdade: L('lealdade', 'loyalty'),
};

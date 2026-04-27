/**
 * Gerador de nomes brasileiros para jogadores
 */

const BRAZILIAN_FIRST_NAMES = [
  'Gabriel', 'Lucas', 'Matheus', 'Rafael', 'Felipe', 'Bruno', 'Thiago', 'Diego',
  'Vinicius', 'Rodrigo', 'Pedro', 'João', 'Guilherme', 'Gustavo', 'Leonardo',
  'Fernando', 'Carlos', 'André', 'Marcelo', 'Daniel', 'Fabio', 'Renato',
  'Neymar', 'Ronaldo', 'Rivaldo', 'Romário', 'Kaká', 'Robinho', 'Adriano',
  'Alexandre', 'Anderson', 'Caio', 'Danilo', 'Eduardo', 'Everton', 'Henrique',
  'Igor', 'Júlio', 'Leandro', 'Luiz', 'Marcos', 'Murilo', 'Nathan', 'Otávio',
  'Paulo', 'Ricardo', 'Samuel', 'Tiago', 'Victor', 'Wellington', 'Yuri',
];

const BRAZILIAN_LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves',
  'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho',
  'Rocha', 'Almeida', 'Nascimento', 'Araújo', 'Melo', 'Barbosa', 'Cardoso',
  'Correia', 'Dias', 'Fernandes', 'Freitas', 'Garcia', 'Gonçalves', 'Lopes',
  'Machado', 'Marques', 'Mendes', 'Miranda', 'Monteiro', 'Moreira', 'Nunes',
  'Pinto', 'Ramos', 'Reis', 'Rezende', 'Ribeiro', 'Rocha', 'Rosa', 'Santana',
  'Soares', 'Teixeira', 'Vieira', 'Xavier',
];

/**
 * Gera um nome brasileiro aleatório
 */
export function randomBrazilianName(): string {
  const firstName = BRAZILIAN_FIRST_NAMES[Math.floor(Math.random() * BRAZILIAN_FIRST_NAMES.length)];
  const lastName = BRAZILIAN_LAST_NAMES[Math.floor(Math.random() * BRAZILIAN_LAST_NAMES.length)];
  return `${firstName} ${lastName}`;
}

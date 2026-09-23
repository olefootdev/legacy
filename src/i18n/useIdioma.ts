/**
 * O idioma na tela. React de um lado, `src/i18n/idioma.ts` do outro.
 */
import { useEffect, useState } from 'react';
import { aoMudarIdioma, idiomaAtual, definirIdioma, type Idioma } from './idioma';

export function useIdioma(): [Idioma, (i: Idioma) => void] {
  const [idioma, setIdioma] = useState<Idioma>(() => idiomaAtual());
  useEffect(() => aoMudarIdioma(setIdioma), []);
  return [idioma, definirIdioma];
}

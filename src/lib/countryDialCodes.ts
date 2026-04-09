/** País + indicativo (DDI) para telefone no cadastro. Ordem: Brasil primeiro, depois alfabético PT. */
export interface CountryDialOption {
  iso2: string;
  name: string;
  dial: string;
}

export const COUNTRY_DIAL_OPTIONS: CountryDialOption[] = [
  { iso2: 'BR', name: 'Brasil', dial: '+55' },
  { iso2: 'PT', name: 'Portugal', dial: '+351' },
  { iso2: 'AO', name: 'Angola', dial: '+244' },
  { iso2: 'MZ', name: 'Moçambique', dial: '+258' },
  { iso2: 'AR', name: 'Argentina', dial: '+54' },
  { iso2: 'US', name: 'Estados Unidos', dial: '+1' },
  { iso2: 'GB', name: 'Reino Unido', dial: '+44' },
  { iso2: 'ES', name: 'Espanha', dial: '+34' },
  { iso2: 'FR', name: 'França', dial: '+33' },
  { iso2: 'DE', name: 'Alemanha', dial: '+49' },
  { iso2: 'IT', name: 'Itália', dial: '+39' },
  { iso2: 'NL', name: 'Países Baixos', dial: '+31' },
  { iso2: 'BE', name: 'Bélgica', dial: '+32' },
  { iso2: 'CH', name: 'Suíça', dial: '+41' },
  { iso2: 'MX', name: 'México', dial: '+52' },
  { iso2: 'CO', name: 'Colômbia', dial: '+57' },
  { iso2: 'CL', name: 'Chile', dial: '+56' },
  { iso2: 'UY', name: 'Uruguai', dial: '+598' },
  { iso2: 'PY', name: 'Paraguai', dial: '+595' },
  { iso2: 'PE', name: 'Peru', dial: '+51' },
  { iso2: 'EC', name: 'Equador', dial: '+593' },
  { iso2: 'JP', name: 'Japão', dial: '+81' },
  { iso2: 'CN', name: 'China', dial: '+86' },
  { iso2: 'IN', name: 'Índia', dial: '+91' },
  { iso2: 'ZA', name: 'África do Sul', dial: '+27' },
  { iso2: 'SA', name: 'Arábia Saudita', dial: '+966' },
  { iso2: 'AE', name: 'Emirados Árabes', dial: '+971' },
  { iso2: 'OTHER', name: 'Outro (+ manual)', dial: '+' },
];

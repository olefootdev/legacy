export interface LegendDNA {
  id: string;
  name: string;
  posCode: string;
  era: string;
  nationality: string;
  description: string;
  /** Pesos iniciais de ação que definem o estilo desta lenda. 1.0 = neutro. */
  baseActionWeights: Record<string, number>;
  /** Traços de personalidade táctica (0–2). */
  baseTraits: {
    pressIntensity: number;
    offensiveRuns: number;
    riskTaking: number;
    buildUpPreference: number;
  };
}

export const LEGEND_DNA_CATALOG: LegendDNA[] = [
  {
    id: 'legend_gk_sweeper',
    name: 'El Arquero',
    posCode: 'GOL',
    era: '1990s',
    nationality: 'ARG',
    description: 'Goleiro que domina a área com autoridade. Sai do gol para cortar bolas em profundidade.',
    baseActionWeights: { clearance: 1.5, pass_safe: 1.2, hold: 0.8 },
    baseTraits: { pressIntensity: 1.4, offensiveRuns: 0.4, riskTaking: 0.6, buildUpPreference: 1.2 },
  },
  {
    id: 'legend_zag_lider',
    name: 'O Capitão de Ferro',
    posCode: 'ZAG',
    era: '2000s',
    nationality: 'BRA',
    description: 'Zagueiro líder que organiza a linha defensiva e inicia a saída de bola com precisão.',
    baseActionWeights: { clearance: 1.3, pass_safe: 1.4, pass_progressive: 1.1, dribble_risk: 0.5 },
    baseTraits: { pressIntensity: 1.6, offensiveRuns: 0.3, riskTaking: 0.4, buildUpPreference: 1.5 },
  },
  {
    id: 'legend_lat_sobreposicao',
    name: 'O Lateral Voador',
    posCode: 'LAT',
    era: '2010s',
    nationality: 'BRA',
    description: 'Lateral que sobe em sobreposição constantemente, cruzando com precisão cirúrgica.',
    baseActionWeights: { cross: 1.6, carry: 1.3, pass_progressive: 1.2, clearance: 0.7 },
    baseTraits: { pressIntensity: 1.2, offensiveRuns: 1.8, riskTaking: 1.1, buildUpPreference: 0.9 },
  },
  {
    id: 'legend_vol_destruidor',
    name: 'O Pitbull',
    posCode: 'VOL',
    era: '2000s',
    nationality: 'ITA',
    description: 'Volante destruidor que pressiona sem parar e recupera bolas no meio-campo.',
    baseActionWeights: { pass_safe: 1.4, clearance: 1.3, dribble_risk: 0.5, shoot: 0.6 },
    baseTraits: { pressIntensity: 1.9, offensiveRuns: 0.5, riskTaking: 0.5, buildUpPreference: 0.7 },
  },
  {
    id: 'legend_vol_construtor',
    name: 'O Maestro Defensivo',
    posCode: 'VOL',
    era: '2010s',
    nationality: 'ESP',
    description: 'Volante que dita o ritmo do jogo com passes curtos e visão de jogo excepcional.',
    baseActionWeights: { pass_safe: 1.6, pass_progressive: 1.4, carry: 1.1, dribble_risk: 0.6 },
    baseTraits: { pressIntensity: 0.8, offensiveRuns: 0.7, riskTaking: 0.5, buildUpPreference: 1.8 },
  },
  {
    id: 'legend_mei_criativo',
    name: 'O Dez Clássico',
    posCode: 'MEI',
    era: '1990s',
    nationality: 'BRA',
    description: 'Meia clássico que enxerga passes que ninguém mais vê e arrisca o drible no momento certo.',
    baseActionWeights: { pass_progressive: 1.6, dribble_risk: 1.4, through_ball: 1.5, pass_safe: 0.8 },
    baseTraits: { pressIntensity: 0.7, offensiveRuns: 1.4, riskTaking: 1.6, buildUpPreference: 1.3 },
  },
  {
    id: 'legend_pe_driblador',
    name: 'O Feiticeiro da Ponta',
    posCode: 'PE',
    era: '2000s',
    nationality: 'BRA',
    description: 'Ponta esquerda que humilha defensores com dribles e cruza na medida para o centroavante.',
    baseActionWeights: { dribble_risk: 1.7, cross: 1.4, carry: 1.3, pass_safe: 0.6 },
    baseTraits: { pressIntensity: 0.6, offensiveRuns: 1.7, riskTaking: 1.8, buildUpPreference: 0.5 },
  },
  {
    id: 'legend_pd_velocidade',
    name: 'O Raio da Direita',
    posCode: 'PD',
    era: '2010s',
    nationality: 'POR',
    description: 'Ponta direita explosivo que usa a velocidade para rasgar defesas e finalizar no ângulo.',
    baseActionWeights: { carry: 1.5, shoot: 1.4, dribble_risk: 1.3, pass_safe: 0.7 },
    baseTraits: { pressIntensity: 0.8, offensiveRuns: 1.9, riskTaking: 1.5, buildUpPreference: 0.4 },
  },
  {
    id: 'legend_ata_centroavante',
    name: 'O Artilheiro Nato',
    posCode: 'ATA',
    era: '1990s',
    nationality: 'BRA',
    description: 'Centroavante instintivo que se posiciona no lugar certo na hora certa. Gol é o único objetivo.',
    baseActionWeights: { shoot: 1.8, pass_progressive: 0.7, carry: 0.9, dribble_risk: 1.1 },
    baseTraits: { pressIntensity: 0.5, offensiveRuns: 1.6, riskTaking: 1.7, buildUpPreference: 0.3 },
  },
  {
    id: 'legend_ata_falso9',
    name: 'O Falso Nove',
    posCode: 'ATA',
    era: '2010s',
    nationality: 'ARG',
    description: 'Atacante que cai no meio para criar superioridade numérica e distribuir para os companheiros.',
    baseActionWeights: { pass_progressive: 1.5, dribble_risk: 1.4, shoot: 1.1, carry: 1.3 },
    baseTraits: { pressIntensity: 1.1, offensiveRuns: 1.3, riskTaking: 1.2, buildUpPreference: 1.4 },
  },
];

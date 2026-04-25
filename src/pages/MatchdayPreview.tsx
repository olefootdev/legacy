/**
 * Matchday Preview — página standalone para validação visual.
 *
 * Renderiza <MatchdayHero> com mock data (Flamengo 2-1 Palmeiras).
 * Quando vier um snapshot real (live match, postgame), passar `data` próprio.
 */

import { MatchdayHero } from '@/components/matchday/MatchdayHero';

export function MatchdayPreview() {
  return (
    <div className="min-h-screen bg-deep-black text-white">
      <MatchdayHero />
    </div>
  );
}

export default MatchdayPreview;

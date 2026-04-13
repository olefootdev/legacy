import { Navigate } from 'react-router-dom';

/** Redireciona `/match` → partida rápida (modo oficial para a liga). */
export function LiveMatch() {
  return <Navigate to="/match/quick" replace />;
}

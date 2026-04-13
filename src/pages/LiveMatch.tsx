import { Navigate } from 'react-router-dom';

/** Redireciona `/match` → `/match/live` (MVP único). */
export function LiveMatch() {
  return <Navigate to="/match/live" replace />;
}

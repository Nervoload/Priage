import { Navigate, useParams } from 'react-router-dom';

export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const encounterId = Number(id);

  if (!encounterId || Number.isNaN(encounterId)) {
    return <Navigate to="/messages" replace />;
  }

  return <Navigate to={`/encounters/${encounterId}/chat`} replace />;
}

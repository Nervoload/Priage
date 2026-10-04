import { useCallback, useEffect, useState } from 'react';
import { listCareQueue, type CareQueueItem } from '../../../shared/api/care';
import { getSocket, subscribeToEncounterRealtime } from '../../../shared/realtime/socket';
import { RealtimeEvents } from '../../../shared/types/domain';
import { CareQueue } from './CareQueue';
import { CareWorkspace } from './CareWorkspace';
import { careError } from './useCareWorkspace';

/** The clinic Care workspace: the queue, or one visit opened from it. */
export function CareView() {
  const [queue, setQueue] = useState<CareQueueItem[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try { setQueue(await listCareQueue()); setError(''); }
    catch (cause) { setError(careError(cause, 'The Care queue didn’t load. Check the connection; it retries on its own.')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    const socket = getSocket();
    window.addEventListener('focus', onUpdate);
    socket.on(RealtimeEvents.EncounterUpdated, onUpdate);
    socket.on('connect', onUpdate);
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { window.removeEventListener('focus', onUpdate); socket.off(RealtimeEvents.EncounterUpdated, onUpdate); socket.off('connect', onUpdate); window.clearInterval(timer); };
  }, [refresh]);

  useEffect(() => {
    const ids = queue.filter((item) => item.status !== 'COMPLETE').map((item) => item.id);
    if (ids.length) void subscribeToEncounterRealtime(ids).catch(() => { /* polling is the fallback */ });
  }, [queue]);

  if (activeId !== null) {
    return <CareWorkspace key={activeId} id={activeId} onBack={() => { setActiveId(null); void refresh(); }} onChanged={() => void refresh()} />;
  }
  return <CareQueue items={queue} loading={loading} error={error} onRefresh={() => void refresh()} onOpen={setActiveId} />;
}

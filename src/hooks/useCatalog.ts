import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCatalog, type PublicCatalog } from '../api.js';

const FRESH_FOR_MS = 5 * 60 * 1000;
const RETRY_COOLDOWN_MS = 30 * 1000;

export function useCatalog() {
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const lastSuccess = useRef(0);
  const lastAttempt = useRef(0);

  const refresh = useCallback(async (force = true) => {
    const now = Date.now();
    if (request.current || (!force && (now - lastSuccess.current < FRESH_FOR_MS || now - lastAttempt.current < RETRY_COOLDOWN_MS))) return;
    const controller = new AbortController();
    request.current = controller;
    lastAttempt.current = now;
    setLoading(true);
    // Keep the stale-data warning visible until an update actually succeeds.
    try {
      const next = await fetchCatalog(controller.signal);
      if (!controller.signal.aborted) {
        setCatalog(next);
        setError(null);
        lastSuccess.current = Date.now();
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.');
    } finally {
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onOnline = () => void refresh();
    const onOffline = () => setError('Sin conexión. No se pudieron actualizar los productos y precios.');
    const onReturn = () => { if (document.visibilityState === 'visible') void refresh(false); };
    window.addEventListener('focus', onReturn);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.removeEventListener('focus', onReturn);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onReturn);
      request.current?.abort();
      request.current = null;
    };
  }, [refresh]);

  return { catalog, error, loading, retry: () => void refresh() };
}

import { catalogUrl } from './config.mjs';
import { normalizeCatalog } from './model.mjs';

export async function requestCatalog(config, { signal, timeoutMs = 15000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort(signal.reason);
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetchImpl(catalogUrl(config), { signal: controller.signal, cache: 'no-store' });
    if (response.status === 404) throw new Error('El catálogo todavía no está disponible.');
    if (!response.ok) throw new Error(`El servidor respondió con error (${response.status}). Intentá de nuevo.`);
    let raw;
    try { raw = await response.json(); }
    catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error('El servidor envió una respuesta que no es JSON válido. Intentá de nuevo.');
    }
    return normalizeCatalog(raw, config);
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Solicitud cancelada.', 'AbortError');
    if (timedOut) throw new Error('El servidor tardó demasiado en responder. Intentá de nuevo.');
    if (error instanceof TypeError) throw new Error('No se pudo conectar. Revisá tu conexión a internet e intentá de nuevo.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

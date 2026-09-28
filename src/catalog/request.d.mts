import type { CatalogConfig, PublicCatalog } from './types.js';
export function requestCatalog(config: CatalogConfig, options?: { signal?: AbortSignal; timeoutMs?: number; fetchImpl?: typeof fetch }): Promise<PublicCatalog>;

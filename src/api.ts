import { catalogConfig } from './catalog/runtime.js';
import { requestCatalog } from './catalog/request.mjs';
export type { PublicCatalog, PublicCatalogProduct } from './catalog/types.js';

export function fetchCatalog(signal?: AbortSignal) {
  return requestCatalog(catalogConfig, { signal });
}

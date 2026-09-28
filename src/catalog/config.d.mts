import type { CatalogConfig } from './types.js';
export function resolveCatalogConfig(profile: unknown, env?: Record<string, string | undefined>): CatalogConfig;
export function catalogUrl(config: Pick<CatalogConfig, 'companyId' | 'deviceId' | 'syncServerUrl'>): URL;

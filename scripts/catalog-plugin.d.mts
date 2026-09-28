import type { Plugin } from 'vite';
import type { CatalogConfig } from '../src/catalog/types.js';
export const packageRoot: string;
export function loadProfile(env: Record<string, string | undefined>): CatalogConfig;
export function catalogPlugin(config: CatalogConfig): Plugin;

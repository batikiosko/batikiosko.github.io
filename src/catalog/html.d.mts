import type { CatalogConfig, PublicCatalog, PublicCatalogProduct } from './types.js';
export function escapeHtml(value: unknown): string;
export function safeJsonLd(value: unknown): string;
export function businessStructuredData(config: CatalogConfig): unknown;
export function productStructuredData(items: PublicCatalogProduct[], currency: string, config: CatalogConfig): unknown;
export function renderHead(config: CatalogConfig): string;
export function renderRobots(config: CatalogConfig): string;
export function renderSitemap(config: CatalogConfig): string;
export function buildSnapshot(catalog: PublicCatalog | null, config: CatalogConfig): string;

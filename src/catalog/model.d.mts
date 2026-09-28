import type { CatalogConfig, PublicCatalog, PublicCatalogProduct } from './types.js';
export function normalizeCatalog(raw: unknown, config: Pick<CatalogConfig, 'currency' | 'business'>): PublicCatalog;
export function productCurrency(product: PublicCatalogProduct, baseCurrency: string): string;
export function formatMoney(value: string | number, currency: string): string;
export function productPricing(product: PublicCatalogProduct, baseCurrency: string): {
  currency: string; normal: string; current: string; kind: 'normal' | 'simple' | 'quantity';
  minimum: string | null; special: string | null; percent: string | null;
};
export function filterProducts<T extends PublicCatalogProduct>(items: T[], selectedCategories: Set<string>, query: string): T[];
export function isNewProduct(product: PublicCatalogProduct, now?: number): boolean;

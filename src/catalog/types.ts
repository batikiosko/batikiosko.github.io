export interface PublicCatalogProduct {
  id: string;
  name: string;
  category: string | null;
  categories: string[];
  description: string | null;
  catalogDetails: string[];
  imageUrl: string | null;
  galleryImages: string[];
  salePrice: string;
  priceCurrency: string | null;
  effectivePrice: string;
  onOffer: boolean;
  offerPercent: string | null;
  offerFixedPrice: string | null;
  offerMinQuantity: string | null;
  createdAt: string;
}

export interface PublicCatalog {
  companyName: string;
  currency: string;
  products: PublicCatalogProduct[];
  warnings: string[];
}

export interface CatalogConfig {
  schemaVersion: number;
  companyId: string;
  deviceId: string | null;
  syncServerUrl: string;
  publicUrl: string;
  currency: string | null;
  business: {
    name: string;
    displayName: string;
    address: string;
    hours: string;
    contacts: { label: string; url: string }[];
    contactPlaceholder: string;
    structuredAddress?: Record<string, string>;
    openingHours?: Record<string, unknown>;
    priceRange?: string;
  };
  branding: {
    primary: string; primaryDark: string; primarySoft: string;
    ink: string; muted: string; line: string; paper: string;
    fontBody: string; fontHeading: string; fontStylesheet: string | null;
  };
  assets: { logo: string; social: string; qr?: string; favicon16?: string; favicon32?: string; favicon48?: string; appleTouch?: string };
  categoryImages: Record<string, string>;
  texts: {
    heroTitle: string; heroHighlight: string; heroDescription: string; heroBadge: string;
    tagline: string; loading: string; offersDescription: string; noveltiesDescription: string;
    catalogNotice: string; marquee: string[]; faq: { question: string; answer: string }[];
  };
  seo: {
    title: string; description: string; locale: string; language: string;
    indexable: boolean; socialWidth?: number; socialHeight?: number;
  };
  observability: { analyticsId: string | null; sentryDsn: string | null };
  pwa: {
    iconSource: string;
    name: string; shortName: string; description: string;
    icons: { src: string; sizes: string; type: string; purpose: string }[];
  };
}

// Pure resolution: used by Vite, tests and tooling. No business-specific fallback.
export function resolveCatalogConfig(profile, env = {}) {
  const config = structuredClone(profile);
  config.companyId = env.VITE_COMPANY_ID ?? config.companyId;
  config.deviceId = env.VITE_DEVICE_ID ?? config.deviceId;
  config.syncServerUrl = env.VITE_SYNC_SERVER_URL ?? config.syncServerUrl;
  config.publicUrl = env.VITE_PUBLIC_URL ?? config.publicUrl;
  config.currency = env.VITE_CATALOG_CURRENCY ?? config.currency;
  if (config.schemaVersion !== 1) throw new Error('Versión de configuración no compatible.');
  const required = (value, field) => {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Configuración incompleta: ${field}.`);
    return value.trim();
  };
  const httpUrl = (value, field, allowPublicKey = false) => {
    const url = new URL(required(value, field));
    if (!['http:', 'https:'].includes(url.protocol) || (!allowPublicKey && url.username) || url.password) throw new Error(`URL inválida: ${field}.`);
    return url;
  };
  config.companyId = required(config.companyId, 'companyId');
  config.deviceId = config.deviceId == null || config.deviceId === '' ? null : required(config.deviceId, 'deviceId');
  config.syncServerUrl = httpUrl(config.syncServerUrl, 'syncServerUrl').href;
  const publicUrl = httpUrl(config.publicUrl, 'publicUrl');
  if (publicUrl.search || publicUrl.hash) throw new Error('publicUrl no debe tener query ni fragmento.');
  config.publicUrl = publicUrl.href.replace(/\/?$/, '/');
  // A pre-generated QR belongs to one URL. Do not keep it after a domain/path override.
  if (config.publicUrl !== new URL(profile.publicUrl).href.replace(/\/?$/, '/')) delete config.assets.qr;
  if (config.currency != null) {
    config.currency = required(config.currency, 'currency').toUpperCase();
    if (!/^[A-Z]{3}$/.test(config.currency)) throw new Error('Moneda de configuración inválida.');
  }
  for (const field of ['name', 'displayName', 'address', 'hours', 'contactPlaceholder']) required(config.business?.[field], `business.${field}`);
  for (const field of ['primary', 'primaryDark', 'primarySoft', 'ink', 'muted', 'line', 'paper']) {
    if (!/^#[0-9a-f]{6}$/i.test(config.branding?.[field])) throw new Error(`Color inválido: branding.${field}.`);
  }
  for (const field of ['fontBody', 'fontHeading']) {
    required(config.branding?.[field], `branding.${field}`);
    if (/[<>;{}]/.test(config.branding[field])) throw new Error(`Fuente inválida: ${field}.`);
  }
  if (config.branding.fontStylesheet) httpUrl(config.branding.fontStylesheet, 'fontStylesheet');
  for (const field of ['logo', 'social']) required(config.assets?.[field], `assets.${field}`);
  for (const field of ['title', 'description', 'locale', 'language']) required(config.seo?.[field], `seo.${field}`);
  if (!/^[a-z]{2,3}(?:-[a-zA-Z0-9]+)*$/.test(config.seo.language)) throw new Error('Idioma SEO inválido.');
  for (const field of ['heroTitle', 'heroHighlight', 'heroDescription', 'heroBadge', 'tagline', 'loading', 'offersDescription', 'noveltiesDescription', 'catalogNotice']) required(config.texts?.[field], `texts.${field}`);
  if (typeof config.seo.indexable !== 'boolean' || !Array.isArray(config.texts.marquee) || !Array.isArray(config.texts.faq) || !Array.isArray(config.business.contacts)) throw new Error('Listas o SEO de configuración inválidos.');
  config.texts.marquee.forEach((text) => required(text, 'marquee'));
  config.texts.faq.forEach((entry) => { required(entry.question, 'faq.question'); required(entry.answer, 'faq.answer'); });
  config.business.contacts.forEach((entry) => { required(entry.label, 'contact.label'); httpUrl(entry.url, 'contact.url'); });
  // Editorial templates reference canonical business facts, never copy address/hours.
  const interpolate = (value) => {
    if (typeof value === 'string') return value.replace(/\{\{([^}]+)\}\}/g, (_match, key) => {
      if (!/^business\.(name|displayName|address|hours)$/.test(key)) throw new Error(`Referencia de texto inválida: ${key}.`);
      return config.business[key.slice('business.'.length)];
    });
    if (Array.isArray(value)) return value.map(interpolate);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, interpolate(entry)]));
    return value;
  };
  config.texts = interpolate(config.texts);
  config.seo = interpolate(config.seo);
  if (!config.categoryImages || typeof config.categoryImages !== 'object' || Array.isArray(config.categoryImages)) throw new Error('categoryImages debe ser un mapa.');
  if (!config.observability || (config.observability.analyticsId && !/^G-[A-Z0-9]+$/.test(config.observability.analyticsId))) throw new Error('Configuración de observabilidad inválida.');
  if (config.observability.sentryDsn) httpUrl(config.observability.sentryDsn, 'sentryDsn', true);
  config.pwa = {
    ...config.pwa,
    iconSource: required(config.pwa?.iconSource ?? config.assets.logo, 'pwa.iconSource'),
    name: required(config.pwa?.name ?? config.business.name, 'pwa.name'),
    shortName: required(config.pwa?.shortName ?? config.business.name, 'pwa.shortName'),
    description: required(config.pwa?.description ?? config.seo.description, 'pwa.description'),
  };
  if (!Array.isArray(config.pwa.icons)) throw new Error('Faltan iconos pwa.icons.');
  for (const icon of config.pwa.icons) {
    required(icon.src, 'pwa.icon.src');
    if (!['192x192', '512x512'].includes(icon.sizes) || icon.type !== 'image/png' || !['any', 'maskable'].includes(icon.purpose)) throw new Error('Icono PWA inválido: PNG 192/512 y purpose any/maskable.');
  }
  for (const sizes of ['192x192', '512x512']) {
    if (!config.pwa.icons.some((icon) => icon.sizes === sizes && icon.purpose === 'any')) throw new Error(`Falta icono PWA ${sizes} con purpose any.`);
  }
  return config;
}

export function catalogUrl(config) {
  const url = new URL('/public/catalog', config.syncServerUrl);
  url.searchParams.set('companyId', config.companyId);
  if (config.deviceId) url.searchParams.set('deviceId', config.deviceId);
  return url;
}

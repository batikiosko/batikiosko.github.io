import { formatMoney, productPricing } from './model.mjs';

export const escapeHtml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export const safeJsonLd = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

export function businessStructuredData(config) {
  const url = config.publicUrl;
  const image = new URL(config.assets.social, url).href;
  return { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Organization', '@id': `${url}#organization`, name: config.business.name, url, logo: new URL(config.assets.logo, url).href },
    { '@type': 'WebSite', '@id': `${url}#website`, name: config.business.name, url, description: config.seo.description, inLanguage: config.seo.language, publisher: { '@id': `${url}#organization` } },
    { '@type': ['Store', 'LocalBusiness'], '@id': `${url}#store`, name: config.business.name, url, image,
      ...(config.business.structuredAddress ? { address: config.business.structuredAddress } : {}),
      ...(config.business.openingHours ? { openingHoursSpecification: config.business.openingHours } : {}),
      ...(config.business.priceRange ? { priceRange: config.business.priceRange } : {}) },
    { '@type': 'FAQPage', '@id': `${url}#faq`, mainEntity: config.texts.faq.map(({ question, answer }) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) },
  ] };
}

export function productStructuredData(items, currency, config) {
  return { '@context': 'https://schema.org', '@graph': items.map((p) => {
    const pricing = productPricing(p, currency);
    const offer = { '@type': 'Offer', price: pricing.current, priceCurrency: pricing.currency,
      availability: 'https://schema.org/InStock', url: `${config.publicUrl}#producto-${encodeURIComponent(p.id)}` };
    return { '@type': 'Product', name: p.name, ...(p.description ? { description: p.description } : {}),
      ...(p.imageUrl ? { image: p.imageUrl } : {}), ...(p.categories[0] ? { category: p.categories[0] } : {}),
      offers: pricing.kind === 'quantity' ? [offer, { ...offer, price: pricing.special, eligibleQuantity: { '@type': 'QuantitativeValue', minValue: Number(pricing.minimum) } }] : offer };
  }) };
}

export function renderHead(config) {
  const e = escapeHtml;
  const social = new URL(config.assets.social, config.publicUrl).href;
  const b = config.branding;
  const rgb = (hex) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const primaryRgb = rgb(b.primary);
  const tint = (white) => `rgb(${primaryRgb.map((n) => Math.round(n * (1 - white) + 255 * white)).join(',')})`;
  const variables = { primary: b.primary, 'primary-dark': b.primaryDark, 'primary-soft': b.primarySoft, 'primary-rgb': primaryRgb.join(','), 'offer-tint': tint(0.92), 'offer-text': tint(0.82), ink: b.ink, muted: b.muted, line: b.line, paper: b.paper, 'font-body': b.fontBody, 'font-heading': b.fontHeading };
  const style = Object.entries(variables).map(([key, value]) => `--catalog-${key}:${value}`).join(';');
  return `
    <meta name="theme-color" content="${e(b.primary)}" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="${e(config.pwa.shortName)}" />
    <link rel="manifest" href="${e(new URL(config.publicUrl).pathname)}manifest.webmanifest" />
    <meta name="robots" content="${config.seo.indexable ? 'index, follow' : 'noindex, nofollow'}" />
    <meta name="description" content="${e(config.seo.description)}" />
    <link rel="canonical" href="${e(config.publicUrl)}" />
    <title>${e(config.seo.title)}</title>
    ${[16, 32, 48].map((size) => config.assets[`favicon${size}`] ? `<link rel="icon" sizes="${size}x${size}" href="${e(config.assets[`favicon${size}`])}" />` : '').join('\n')}
    <link rel="apple-touch-icon" sizes="${config.assets.appleTouch ? '180x180' : '192x192'}" href="${e(config.assets.appleTouch || config.pwa.icons.find((icon) => icon.sizes === '192x192' && icon.purpose === 'any').src)}" />
    ${b.fontStylesheet ? `<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" /><link rel="stylesheet" href="${e(b.fontStylesheet)}" />` : ''}
    <style>:root{${style}}</style>
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${e(config.business.name)}" />
    <meta property="og:title" content="${e(config.seo.title)}" />
    <meta property="og:description" content="${e(config.seo.description)}" />
    <meta property="og:url" content="${e(config.publicUrl)}" />
    <meta property="og:image" content="${e(social)}" />
    ${config.seo.socialWidth ? `<meta property="og:image:width" content="${config.seo.socialWidth}" />` : ''}
    ${config.seo.socialHeight ? `<meta property="og:image:height" content="${config.seo.socialHeight}" />` : ''}
    <meta property="og:locale" content="${e(config.seo.locale)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${e(config.seo.title)}" />
    <meta name="twitter:description" content="${e(config.seo.description)}" />
    <meta name="twitter:image" content="${e(social)}" />
    <script type="application/ld+json">${safeJsonLd(businessStructuredData(config))}</script>
    ${config.observability.analyticsId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${e(config.observability.analyticsId)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${safeJsonLd(config.observability.analyticsId)});</script>` : ''}`;
}

export function renderRobots(config) {
  return config.seo.indexable ? `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap.xml', config.publicUrl).href}\n` : 'User-agent: *\nDisallow: /\n';
}

export function renderSitemap(config) {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${config.seo.indexable ? `<url><loc>${escapeHtml(config.publicUrl)}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>` : ''}</urlset>\n`;
}

export function buildSnapshot(catalog, config) {
  const e = escapeHtml;
  const products = catalog?.products ?? [];
  const categories = new Map();
  for (const p of products) for (const category of p.categories) categories.set(category, (categories.get(category) ?? 0) + 1);
  return `<main id="main-content">
    <h1>${e(config.business.name)} — catálogo digital</h1><p>${e(config.seo.description)}</p>
    <section><h2>Dirección y horario</h2><p>${e(config.business.address)}</p><p>${e(config.business.hours)}</p></section>
    <section id="categorias"><h2>Categorías</h2><ul>${[...categories].sort((a, b) => a[0].localeCompare(b[0])).map(([name, count]) => `<li>${e(name)} (${count})</li>`).join('')}</ul></section>
    <section id="productos"><h2>Productos (${products.length})</h2>
    ${catalog?.warnings.length ? '<p>Algunos productos no pudieron mostrarse por datos incompletos.</p>' : ''}
    ${catalog ? products.map((p) => {
      const price = productPricing(p, catalog.currency);
      const amount = (value) => e(formatMoney(value, price.currency));
      return `<article id="producto-${e(p.id)}"><h3>${e(p.name)}</h3><p>Categoría: ${e(p.categories[0] ?? 'General')}</p>
        ${p.catalogDetails.map((line) => `<p>${e(line)}</p>`).join('')}
        <p>Precio: ${amount(price.current)}</p>
        ${price.kind === 'simple' ? `<p>Precio de lista: <s>${amount(price.normal)}</s></p>` : ''}
        ${price.kind === 'quantity' ? `<p>Precio normal: ${amount(price.normal)}</p><p>Oferta llevando ${e(price.minimum)} o más: ${amount(price.special)} c/u</p>` : ''}</article>`;
    }).join('\n') : '<p>El catálogo no pudo recuperarse al publicar. Activá JavaScript para cargarlo e intentar de nuevo.</p>'}</section>
    <section id="preguntas"><h2>Preguntas frecuentes</h2>${config.texts.faq.map((f) => `<article><h3>${e(f.question)}</h3><p>${e(f.answer)}</p></article>`).join('')}</section>
    ${products.length ? `<script type="application/ld+json">${safeJsonLd(productStructuredData(products, catalog.currency, config))}</script>` : ''}
  </main>`;
}

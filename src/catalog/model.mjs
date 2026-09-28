const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const money = (value) => (typeof value === 'string' || typeof value === 'number') && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? String(value).trim() : null;
const strings = (value) => Array.isArray(value) ? [...new Set(value.map(text).filter(Boolean))] : [];
const image = (value) => {
  const result = text(value);
  return result && (/^https?:\/\//i.test(result) || /^\/(?!\/)/.test(result)) ? result : null;
};
const currencyCode = (value) => {
  const code = text(value)?.toUpperCase();
  return code && /^[A-Z]{3}$/.test(code) ? code : null;
};

export function normalizeCatalog(raw, config) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.products)) throw new Error('El servidor envió un catálogo incompatible. Intentá cargarlo de nuevo.');
  const currency = currencyCode(raw.currency) ?? config.currency;
  if (!currency) throw new Error('El catálogo no indica una moneda válida. Intentá cargarlo de nuevo.');
  const warnings = [];
  const ids = new Set();
  const products = [];
  for (const candidate of raw.products) {
    try {
      if (!candidate || typeof candidate !== 'object') throw new Error();
      const id = text(candidate.id), name = text(candidate.name), salePrice = money(candidate.salePrice);
      if (!id || !name || !salePrice || ids.has(id)) throw new Error();
      const priceCurrency = candidate.priceCurrency == null || candidate.priceCurrency === '' ? null : currencyCode(candidate.priceCurrency);
      if (candidate.priceCurrency && !priceCurrency) throw new Error();
      if (candidate.onOffer != null && typeof candidate.onOffer !== 'boolean') throw new Error();
      const onOffer = candidate.onOffer === true;
      const offerMinQuantity = onOffer && candidate.offerMinQuantity != null ? money(candidate.offerMinQuantity) : null;
      if (onOffer && candidate.offerMinQuantity != null && (!offerMinQuantity || Number(offerMinQuantity) <= 0)) throw new Error();
      let effectivePrice = onOffer ? money(candidate.effectivePrice) : salePrice;
      const offerFixedPrice = onOffer ? money(candidate.offerFixedPrice) ?? (!offerMinQuantity ? effectivePrice : null) : null;
      if (onOffer && (!offerFixedPrice || (!offerMinQuantity && !effectivePrice))) throw new Error();
      if (offerMinQuantity) effectivePrice = salePrice;
      const offerPercent = onOffer ? money(candidate.offerPercent) ?? (Number(salePrice) > 0 ? String(Math.max(0, (1 - Number(offerFixedPrice) / Number(salePrice)) * 100)) : null) : null;
      const category = text(candidate.category);
      const categories = strings([...(Array.isArray(candidate.categories) ? candidate.categories : []), category]);
      const description = text(candidate.description);
      const catalogDetails = strings(candidate.catalogDetails);
      products.push({ id, name, salePrice, priceCurrency, effectivePrice, onOffer, offerMinQuantity, offerFixedPrice, offerPercent,
        category: category ?? categories[0] ?? null, categories, description,
        catalogDetails: catalogDetails.length ? catalogDetails : description ? [description] : [],
        imageUrl: image(candidate.imageUrl), galleryImages: strings(candidate.galleryImages).map(image).filter(Boolean), createdAt: text(candidate.createdAt) ?? '' });
      ids.add(id);
    } catch {
      warnings.push('Se omitió un producto con datos incompletos o incompatibles.');
    }
  }
  if (raw.products.length && !products.length) throw new Error('Los productos recibidos tienen datos incompletos o incompatibles. Intentá cargar el catálogo de nuevo.');
  return { companyName: text(raw.companyName) ?? config.business.name, currency, products, warnings };
}

export function productCurrency(product, baseCurrency) {
  return product.priceCurrency || baseCurrency;
}

export function formatMoney(value, currency) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '-';
  return `${n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function productPricing(product, baseCurrency) {
  return { currency: productCurrency(product, baseCurrency), normal: product.salePrice,
    current: product.effectivePrice, kind: !product.onOffer ? 'normal' : product.offerMinQuantity ? 'quantity' : 'simple',
    minimum: product.offerMinQuantity, special: product.offerFixedPrice, percent: product.offerPercent };
}

export function filterProducts(items, selectedCategories, query) {
  const q = query.trim().toLowerCase();
  return items.filter((p) => (selectedCategories.size === 0 || p.categories.some((c) => selectedCategories.has(c))) &&
    (!q || `${p.name} ${p.catalogDetails.join(' ')} ${p.categories.join(' ')}`.toLowerCase().includes(q)));
}

export function isNewProduct(product, now = Date.now()) {
  const age = now - new Date(product.createdAt).getTime();
  return age >= 0 && age < 21 * 24 * 60 * 60 * 1000;
}

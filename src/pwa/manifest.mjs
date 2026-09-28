export function createManifest(config) {
  const base = new URL(config.publicUrl).pathname;
  return {
    id: base, name: config.pwa.name, short_name: config.pwa.shortName,
    description: config.pwa.description, lang: config.seo.language,
    start_url: base, scope: base, display: 'standalone',
    background_color: config.branding.paper, theme_color: config.branding.primary,
    icons: config.pwa.icons.map(({ src, sizes, type, purpose }) => ({ src, sizes, type, purpose })),
  };
}

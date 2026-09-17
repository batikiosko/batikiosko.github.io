// Corre DESPUÉS de "vite build": trae el catálogo real (el mismo endpoint
// público que usa la app) y vuelca un resumen como HTML estático dentro de
// dist/index.html — así un rastreador que NO ejecuta JavaScript (la mayoría
// de los bots de IA hoy: GPTBot, ClaudeBot, PerplexityBot, etc.) puede leer
// productos y precios reales, no solo el <title>/<meta description>.
//
// Para un usuario real con JavaScript no cambia nada: React sigue tomando
// el control de #root normalmente (createRoot lo reemplaza), esto no se ve.
// No es contenido oculto ni distinto del real — es el mismo catálogo en
// vivo, solo que renderizado una vez más, en texto plano, al momento del
// build. Si el fetch falla (el build corrió sin salida a internet), el sitio
// queda exactamente como estaba antes de que existiera este script.

import { readFile, writeFile } from "node:fs/promises";

const SYNC_SERVER_URL = "https://contabilidad-sync-server.onrender.com";
const COMPANY_ID = "cmt7ni4vh0000zxuwpq1drg58";
const DIST_INDEX = new URL("../dist/index.html", import.meta.url);

// Mismas preguntas que el FAQPage de index.html y el componente FAQ de
// App.tsx — si se edita una, hay que editar las tres.
const FAQ_ITEMS = [
  [
    "¿Qué es Batikiosco?",
    "Batikiosco es un kiosco de barrio en Zulueta, Villa Clara, Cuba. Este sitio es su catálogo digital: muestra los productos y precios reales del negocio.",
  ],
  [
    "¿Puedo comprar directamente desde este catálogo?",
    "No. Este catálogo es informativo: los precios se muestran como referencia y las compras se hacen directamente en el local.",
  ],
  [
    "¿Los precios y las ofertas están actualizados?",
    "Sí. El catálogo se conecta en vivo al mismo sistema que usa Batikiosco en el mostrador, así que los precios y las ofertas reflejan lo que hay disponible en el momento.",
  ],
  ["¿Dónde queda Batikiosco?", "En Máximo Gómez, esquina entre calle General Carrillo y Juan Alberto Díaz, Zulueta, Villa Clara, Cuba."],
  ["¿Cuál es el horario de atención de Batikiosco?", "Lunes a domingo, de 8:00 AM a 7:00 PM."],
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(value, currency) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${n.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

async function fetchCatalog() {
  const url = new URL("/public/catalog", SYNC_SERVER_URL);
  url.searchParams.set("companyId", COMPANY_ID);
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`el servidor respondió ${res.status}`);
  return res.json();
}

function buildSnapshot(catalog) {
  const categories = new Map();
  for (const p of catalog.products) {
    for (const raw of p.categories ?? []) {
      const name = raw.trim();
      if (!name) continue;
      categories.set(name, (categories.get(name) ?? 0) + 1);
    }
  }
  const categoriesHtml = [...categories.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => `<li>${escapeHtml(name)} (${count})</li>`)
    .join("");

  const productsHtml = catalog.products
    .map((p) => {
      const details = [p.description, ...(p.catalogDetails ?? [])].filter(Boolean);
      return `<article>
        <h3>${escapeHtml(p.name)}</h3>
        <p>Categoría: ${escapeHtml(p.categories?.[0] ?? "General")}</p>
        ${details.length ? `<p>${escapeHtml(details.join(" · "))}</p>` : ""}
        <p>Precio: ${escapeHtml(formatMoney(p.effectivePrice, catalog.currency))}${p.onOffer ? " (oferta)" : ""}</p>
      </article>`;
    })
    .join("\n");

  const faqHtml = FAQ_ITEMS.map(([q, a]) => `<article><h3>${escapeHtml(q)}</h3><p>${escapeHtml(a)}</p></article>`).join("\n");

  return `
<main>
  <h1>Batikiosco — catálogo digital</h1>
  <p>Catálogo digital de Batikiosco, un kiosco de barrio en Zulueta, Villa Clara, Cuba. Los precios y las ofertas son los reales del mostrador.</p>
  <section>
    <h2>Categorías</h2>
    <ul>${categoriesHtml}</ul>
  </section>
  <section>
    <h2>Productos (${catalog.products.length})</h2>
    ${productsHtml}
  </section>
  <section>
    <h2>Preguntas frecuentes</h2>
    ${faqHtml}
  </section>
</main>`.trim();
}

async function main() {
  let catalog;
  try {
    catalog = await fetchCatalog();
  } catch (err) {
    console.warn(`[prerender] no se pudo traer el catálogo (${err instanceof Error ? err.message : String(err)}) — se sigue sin contenido prerenderizado.`);
    return;
  }

  const html = await readFile(DIST_INDEX, "utf8");
  const marker = '<div id="root"></div>';
  if (!html.includes(marker)) {
    console.warn("[prerender] no se encontró el marcador esperado en dist/index.html — no se tocó nada.");
    return;
  }

  const snapshot = buildSnapshot(catalog);
  const next = html.replace(marker, `<div id="root">${snapshot}</div>`);
  await writeFile(DIST_INDEX, next, "utf8");
  console.log(`[prerender] OK — ${catalog.products.length} productos, categorías y preguntas volcadas en dist/index.html.`);
}

await main();

import { useEffect, useMemo, useRef, useState } from "react";
import { type PublicCatalog, type PublicCatalogProduct } from "./api.js";
import { catalogConfig as config } from "./catalog/runtime.js";
import { filterProducts, isNewProduct, productCurrency } from "./catalog/model.mjs";
import { productStructuredData, safeJsonLd } from "./catalog/html.mjs";
import { useCatalog } from "./hooks/useCatalog.js";
import { Modal } from "./components/Modal.js";
import { formatMoney } from "./format.js";
const logo = config.assets.logo;
const catalogQr = config.assets.qr;
import cesLogo from "./assets/ces-logo-icon.svg";

const RED = config.branding.primary;
const RED_DARK = config.branding.primaryDark;
const RED_SOFT = config.branding.primarySoft;
const INK = config.branding.ink;
const MUTED = config.branding.muted;
const LINE = config.branding.line;
const PAPER = config.branding.paper;



/** Un solo lugar para los links de navegación — se repiten en el header y en
 * el pie de página; antes estaban duplicados a mano en los dos lugares. */
const NAV_LINKS: [string, string][] = [
  ["#inicio", "Inicio"],
  ["#categorias", "Categorías"],
  ["#ofertas", "Ofertas"],
  ["#productos", "Productos"],
  ["#novedades", "Novedades"],
  ["#preguntas", "Preguntas"],
];

const CATEGORY_ICONS: Record<string, string> = {
  bebidas: "🥤",
  "dulces y snacks": "🍬",
  dulces: "🍬",
  snacks: "🍬",
  golosinas: "🍬",
  helados: "🍦",
  galletas: "🍪",
  "café y té": "☕",
  cafe: "☕",
  "cafe y te": "☕",
  te: "☕",
  lacteos: "🥛",
  "lácteos": "🥛",
  "salsas y condimentos": "🧂",
  condimentos: "🧂",
  "hogar e higiene": "🏠",
  higiene: "🏠",
  hogar: "🏠",
  limpieza: "🧼",
  panaderia: "🍞",
  "panadería": "🍞",
  carnes: "🥩",
  frutas: "🍎",
  verduras: "🥦",
};

function categoryIcon(name: string): string {
  return CATEGORY_ICONS[name.trim().toLowerCase()] ?? "🛒";
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const CATEGORY_IMAGES = config.categoryImages;

function categoryImage(name: string): string | null {
  return CATEGORY_IMAGES[slugify(name)] ?? null;
}

/** "16.7" → "17", "20" → "20" — para el sello grande de descuento, un
 * decimal suelto solo le resta impacto a lo que tiene que leerse de un
 * vistazo. */
function roundPercent(percent: string): string {
  return Math.round(Number(percent)).toString();
}

/** Sello grande y llamativo con el % de descuento — mismo componente en la
 * tarjeta de oferta destacada y en la del catálogo general, para que una
 * oferta se reconozca de un vistazo sin tener que leer el precio primero. */
function PercentBadge({ percent, size = "lg" }: { percent: string; size?: "lg" | "sm" }) {
  const big = size === "lg";
  return (
    <div
      style={{
        position: "absolute",
        top: big ? 12 : 10,
        right: big ? 12 : 10,
        background: RED,
        color: "#fff",
        borderRadius: "50%",
        width: big ? 64 : 50,
        height: big ? 64 : 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        transform: "rotate(8deg)",
        boxShadow: "0 8px 20px rgba(var(--catalog-primary-rgb),.45)",
        border: "2.5px solid #fff",
      }}
    >
      <span style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 800, fontSize: big ? 20 : 15, lineHeight: 1 }}>-{roundPercent(percent)}%</span>
    </div>
  );
}

interface Item extends PublicCatalogProduct {
  isNew: boolean;
  tag: "OFERTA" | "NUEVO" | null;
}

function enrich(p: PublicCatalogProduct): Item {
  const isNew = isNewProduct(p);
  return { ...p, isNew, tag: p.onOffer ? "OFERTA" : isNew ? "NUEVO" : null };
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
    padding: "12px 20px",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 700,
    background: active ? RED : PAPER,
    color: active ? "#fff" : INK,
    border: active ? `1.5px solid ${RED}` : `1.5px solid ${LINE}`,
    boxShadow: active ? "0 14px 30px rgba(var(--catalog-primary-rgb),.28)" : "none",
    transition: "background .2s, color .2s, box-shadow .2s",
  };
}

function categoryCardStyle(active: boolean): React.CSSProperties {
  return {
    cursor: "pointer",
    padding: "22px 18px",
    borderRadius: 22,
    fontFamily: "var(--catalog-font-body)",
    background: active ? RED : PAPER,
    color: active ? "#fff" : INK,
    border: active ? `1.5px solid ${RED}` : `1.5px solid ${LINE}`,
    boxShadow: active ? "0 14px 30px rgba(var(--catalog-primary-rgb),.28)" : "none",
    transition: "background .2s, color .2s, box-shadow .2s",
  };
}

function ProductImage({ item, dark = false }: { item: Item; dark?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (item.imageUrl && failedUrl !== item.imageUrl) {
    return (
      <img
        src={item.imageUrl}
        onError={() => setFailedUrl(item.imageUrl)}
        alt={item.name}
        loading="lazy"
        decoding="async"
        style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
      />
    );
  }
  return (
    <div
      className="bk-product-placeholder"
      role="img"
      aria-label={`Sin imagen: ${item.name}`}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 48,
        opacity: dark ? 0.5 : 0.35,
      }}
    >
      {item.category ? categoryIcon(item.category) : "🛍️"}
    </div>
  );
}

/** Los detalles del producto (descripción, peso, empaquetado) uno debajo del
 * otro — vienen listos del servidor en `item.catalogDetails`. */
function DetailLines({
  lines,
  color,
  fontSize = 13.5,
  marginBottom = 14,
}: {
  lines: string[];
  color: string;
  fontSize?: number;
  marginBottom?: number;
}) {
  if (lines.length === 0) return null;
  return (
    <div style={{ marginBottom }}>
      {lines.map((line, i) => (
        <div key={i} style={{ fontSize, color, lineHeight: 1.5 }}>
          {line}
        </div>
      ))}
    </div>
  );
}

function Header({ query, onQuery, onSearch }: { query: string; onQuery: (v: string) => void; onSearch: () => void }) {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 60, background: "rgba(255,255,255,.92)", backdropFilter: "blur(14px)", borderBottom: `1px solid ${LINE}` }}>
      <div className="bk-header-inner" style={{ maxWidth: 1280, margin: "0 auto", padding: "14px 22px", display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
        <a href="#inicio" className="bk-logo" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <img src={logo} alt={config.business.displayName} style={{ height: 56, width: "auto", display: "block" }} />
        </a>
        <nav className="bk-nav" style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
          {NAV_LINKS.map(([href, label]) => (
            <a key={href} href={href} style={{ fontSize: 14, fontWeight: 600, color: INK, padding: "10px 14px", borderRadius: 999, whiteSpace: "nowrap" }}>
              {label}
            </a>
          ))}
        </nav>
        <form
          className="bk-search"
          onSubmit={(e) => {
            e.preventDefault();
            onSearch();
          }}
          style={{ display: "flex", alignItems: "center", gap: 10, background: PAPER, border: `1.5px solid ${LINE}`, borderRadius: 999, padding: "6px 8px 6px 16px", minWidth: 230 }}
        >
          <input
            type="search"
            aria-label="Buscar productos"
            placeholder="¿Qué estás buscando?"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            style={{ border: 0, background: "transparent", fontSize: 14, color: INK, width: "100%" }}
          />
          <button
            type="submit"
            aria-label="Buscar"
            style={{
              flexShrink: 0,
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: 0,
              background: RED,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </form>
      </div>
    </header>
  );
}

function Hero({ catalog, offerCount, categoryCount }: { catalog: PublicCatalog; offerCount: number; categoryCount: number }) {
  return (
    <section id="inicio" style={{ position: "relative", background: PAPER, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(#DCDCDC 1.1px, transparent 1.1px)", backgroundSize: "22px 22px", opacity: 0.7 }} />
      <div style={{ position: "absolute", right: -140, top: -140, width: 520, height: 520, borderRadius: "50%", background: RED, opacity: 0.09 }} />
      <div style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "clamp(48px,7vw,96px) 22px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 48, alignItems: "center" }}>
        <div style={{ animation: "bkRise .7s cubic-bezier(.2,.7,.3,1) both" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: INK, color: "#fff", borderRadius: 999, padding: "8px 16px", fontSize: 12, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", marginBottom: 22 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: RED_SOFT, display: "inline-block" }} />
            Catálogo digital
          </div>
          <h1 style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 800, fontSize: "clamp(40px,6.2vw,76px)", lineHeight: 1.02, letterSpacing: "-.02em", margin: "0 0 20px" }}>
            {config.texts.heroTitle}
            <br />
            <span style={{ color: RED }}>{config.texts.heroHighlight}</span>
          </h1>
          <p style={{ fontSize: "clamp(16px,1.5vw,20px)", color: MUTED, lineHeight: 1.6, margin: "0 0 34px", maxWidth: 520 }}>
            {config.texts.heroDescription}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
            <a href="#productos" style={{ display: "inline-flex", alignItems: "center", gap: 12, background: RED, color: "#fff", fontWeight: 700, fontSize: 16, padding: "17px 30px", borderRadius: 999, boxShadow: "0 12px 30px rgba(var(--catalog-primary-rgb),.32)" }}>
              Ver catálogo <span>→</span>
            </a>
            <a href="#ofertas" style={{ display: "inline-flex", alignItems: "center", gap: 10, color: INK, fontWeight: 700, fontSize: 16, padding: "17px 26px", borderRadius: 999, border: `1.5px solid ${INK}` }}>
              Ver ofertas
            </a>
          </div>
          <div style={{ display: "flex", gap: 36, marginTop: 44, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 800, fontSize: 30, color: INK, lineHeight: 1 }}>{catalog.products.length}</div>
              <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>productos en catálogo</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 800, fontSize: 30, color: INK, lineHeight: 1 }}>{categoryCount}</div>
              <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>categorías</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 800, fontSize: 30, color: RED, lineHeight: 1 }}>{offerCount}</div>
              <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>ofertas activas</div>
            </div>
          </div>
        </div>
        <div style={{ position: "relative", animation: "bkFade .9s ease .15s both" }}>
          <div style={{ position: "relative", background: INK, borderRadius: 34, padding: 26, boxShadow: "0 34px 80px rgba(17,17,17,.28)" }}>
            <img src={logo} alt={config.business.displayName} loading="eager" style={{ width: "100%", display: "block", borderRadius: 22, background: "#fff" }} />
            <div style={{ position: "absolute", left: -16, bottom: 34, background: RED, color: "#fff", fontWeight: 800, fontFamily: "var(--catalog-font-heading)", fontSize: 18, padding: "12px 20px", borderRadius: 14, boxShadow: "0 14px 30px rgba(var(--catalog-primary-rgb),.4)", transform: "rotate(-4deg)" }}>
              {config.texts.heroBadge}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const BUSINESS_ADDRESS = config.business.address;
const BUSINESS_HOURS = config.business.hours;

const PinIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const ClockIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const ShareIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.6" y1="10.6" x2="15.4" y2="6.4" />
    <line x1="8.6" y1="13.4" x2="15.4" y2="17.6" />
  </svg>
);

const CATALOG_URL = config.publicUrl;

/** Debajo del QR: el mismo link en texto (para copiar en una compu, donde no
 * hay cámara a mano) más un botón de compartir — usa el share nativo del
 * celular si existe (así el cliente que ya está mirando el catálogo se lo
 * manda a otro por WhatsApp en un toque) y si no, copia el link al
 * portapapeles. */
function ShareCatalog() {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Catálogo ${config.business.displayName}`, text: `Mirá el catálogo de ${config.business.displayName}`, url: CATALOG_URL });
      } catch {
        // El usuario canceló el share nativo (o no hay nada roto): no hay
        // nada que avisar acá.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(CATALOG_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el link ya está visible como texto al
      // lado, lo puede seleccionar a mano.
    }
  };

  return (
    <div
      style={{
        marginTop: 18,
        paddingTop: 18,
        borderTop: "1px solid rgba(255,255,255,.14)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          flex: "1 1 160px",
          minWidth: 0,
          background: "rgba(255,255,255,.08)",
          borderRadius: 10,
          padding: "9px 12px",
          fontSize: 13,
          color: "#fff",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {CATALOG_URL}
      </div>
      <button
        type="button"
        onClick={() => void share()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          background: RED,
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "9px 16px",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        {ShareIcon} {copied ? "¡Copiado!" : "Compartir"}
      </button>
    </div>
  );
}

function VisitInfo() {
  return (
    <section style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(40px,5vw,68px) 22px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,230px),1fr))", gap: 18 }}>
        <div style={{ background: PAPER, borderRadius: 20, padding: 26, border: `1px solid ${LINE}` }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: RED, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            {PinIcon}
          </div>
          <div style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 700, fontSize: 19, marginBottom: 6 }}>Dirección</div>
          <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.55 }}>{BUSINESS_ADDRESS}</div>
        </div>
        <div style={{ background: PAPER, borderRadius: 20, padding: 26, border: `1px solid ${LINE}` }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: INK, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            {ClockIcon}
          </div>
          <div style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 700, fontSize: 19, marginBottom: 6 }}>Horario</div>
          <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.55 }}>{BUSINESS_HOURS}</div>
        </div>
        <div style={{ background: INK, borderRadius: 20, padding: 26, border: `1px solid ${LINE}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {catalogQr && <img src={catalogQr} alt="Código QR del catálogo" style={{ width: 82, height: 82, borderRadius: 12, background: "#fff", padding: 4, flexShrink: 0 }} />}
            <div>
              <div style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 700, fontSize: 18, color: "#fff", marginBottom: 6 }}>{catalogQr ? "Escaneá y compartí" : "Compartí el catálogo"}</div>
              <div style={{ fontSize: 13, color: "#9A9A9A", lineHeight: 1.5 }}>{catalogQr ? "Este código lleva directo a este catálogo." : "Compartí el enlace a este catálogo."}</div>
            </div>
          </div>
          <ShareCatalog />
        </div>
      </div>
    </section>
  );
}

function Categories({
  categories,
  selected,
  onToggle,
}: {
  categories: { name: string; count: number }[];
  selected: Set<string>;
  onToggle: (name: string) => void;
}) {
  return (
    <section id="categorias" style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(28px,4vw,48px) 22px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 26 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: RED, marginBottom: 10 }}>Explora</div>
          <h2 style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 800, fontSize: "clamp(30px,4vw,46px)", margin: 0, letterSpacing: "-.015em" }}>Categorías</h2>
        </div>
        <div style={{ fontSize: 14, color: MUTED, maxWidth: 360 }}>Toca una o más categorías para combinarlas y filtrar el catálogo.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 14 }}>
        {categories.map((c) => {
          const img = categoryImage(c.name);
          const active = selected.has(c.name);
          return (
            <button type="button" key={c.name} aria-pressed={active} onClick={() => onToggle(c.name)} style={{ ...categoryCardStyle(active), textAlign: "left" }}>
              <span
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  overflow: "hidden",
                  marginBottom: 12,
                  background: active ? "rgba(255,255,255,.18)" : "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {img ? (
                  <img src={img} alt={c.name} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 26 }}>{categoryIcon(c.name)}</span>
                )}
              </span>
              <span style={{ display: "block", fontFamily: "var(--catalog-font-heading)", fontWeight: 700, fontSize: 17, lineHeight: 1.2 }}>{c.name}</span>
              <span style={{ display: "block", fontSize: 12, fontWeight: 500, opacity: 0.7, marginTop: 4 }}>{c.count} productos</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CardAction({ name, onOpen }: { name: string; onOpen: () => void }) {
  return <button type="button" className="bk-card-action" aria-label={`Ver producto: ${name}`} onClick={onOpen} />;
}

function OfferCard({ item, currency, onOpen }: { item: Item; currency: string; onOpen: () => void }) {
  const conditioned = !!item.offerMinQuantity;
  return (
    <article
      style={{ position: "relative", background: "#1A1A1A", border: `2px solid ${RED}`, borderRadius: 24, overflow: "hidden", cursor: "pointer", boxShadow: "0 14px 34px rgba(var(--catalog-primary-rgb),.22)" }}
    >
      <CardAction name={item.name} onOpen={onOpen} />
      <div style={{ position: "relative", aspectRatio: "4/3", background: PAPER }}>
        <ProductImage item={item} dark />
        <div style={{ position: "absolute", top: 14, left: 14, background: RED, color: "#fff", fontSize: 11.5, fontWeight: 800, letterSpacing: ".12em", padding: "7px 13px", borderRadius: 999 }}>🔥 OFERTA</div>
        {item.offerPercent && <PercentBadge percent={item.offerPercent} />}
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: MUTED, marginBottom: 8 }}>{item.categories[0] ?? "General"}</div>
        <h3 style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 700, fontSize: 22, color: "#fff", lineHeight: 1.15, margin: "0 0 8px" }}>{item.name}</h3>
        <DetailLines lines={item.catalogDetails} color="#9A9A9A" marginBottom={16} />
        {conditioned ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 800, fontSize: 26, color: "#fff" }}>{formatMoney(item.salePrice, productCurrency(item, currency))}</span>
              <span style={{ fontSize: 12.5, color: "#9A9A9A" }}>precio normal</span>
            </div>
            <div style={{ marginTop: 10, background: RED, borderRadius: 14, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--catalog-offer-text)", marginBottom: 3 }}>
                Llevando {item.offerMinQuantity} o más
              </div>
              <div style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 800, fontSize: 24, color: "#fff" }}>
                {formatMoney(item.offerFixedPrice!, productCurrency(item, currency))} <span style={{ fontSize: 14, fontWeight: 700 }}>c/u</span>
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 800, fontSize: 34, color: RED }}>{formatMoney(item.effectivePrice, productCurrency(item, currency))}</span>
            <span style={{ fontSize: 16, color: MUTED, textDecoration: "line-through" }}>{formatMoney(item.salePrice, productCurrency(item, currency))}</span>
          </div>
        )}
      </div>
    </article>
  );
}

function Offers({ items, currency, onOpen }: { items: Item[]; currency: string; onOpen: (p: Item) => void }) {
  if (items.length === 0) return null;
  return (
    <section id="ofertas" style={{ background: INK, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: -160, bottom: -160, width: 480, height: 480, borderRadius: "50%", background: RED, opacity: 0.16, filter: "blur(10px)" }} />
      <div style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "clamp(56px,7vw,92px) 22px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 38 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: RED_SOFT, marginBottom: 10 }}>Esta semana</div>
            <h2 style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 800, fontSize: "clamp(30px,4.4vw,52px)", margin: 0, color: "#fff", letterSpacing: "-.015em" }}>🔥 Ofertas destacadas</h2>
          </div>
          <div style={{ fontSize: 14, color: "#9A9A9A", maxWidth: 340 }}>{config.texts.offersDescription}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 20 }}>
          {items.map((p) => (
            <OfferCard key={p.id} item={p} currency={currency} onOpen={() => onOpen(p)} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductCard({ item, currency, onOpen }: { item: Item; currency: string; onOpen: () => void }) {
  return (
    <article
      id={`producto-${item.id}`}
      style={{
        position: "relative",
        background: "#fff",
        border: item.onOffer ? `2px solid ${RED}` : `1px solid ${LINE}`,
        borderRadius: 24,
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: item.onOffer ? "0 10px 26px rgba(var(--catalog-primary-rgb),.16)" : undefined,
      }}
    >
      <CardAction name={item.name} onOpen={onOpen} />
      <div style={{ position: "relative", aspectRatio: "1/1", background: PAPER }}>
        <ProductImage item={item} />
        {item.onOffer ? (
          <div style={{ position: "absolute", top: 14, left: 14, background: RED, color: "#fff", fontSize: 10.5, fontWeight: 800, letterSpacing: ".12em", padding: "6px 11px", borderRadius: 999 }}>
            🔥 OFERTA
          </div>
        ) : (
          item.tag && (
            <div style={{ position: "absolute", top: 14, left: 14, background: INK, color: "#fff", fontSize: 10.5, fontWeight: 800, letterSpacing: ".12em", padding: "6px 11px", borderRadius: 999 }}>{item.tag}</div>
          )
        )}
        {item.onOffer && item.offerPercent && <PercentBadge percent={item.offerPercent} size="sm" />}
      </div>
      <div style={{ padding: "18px 18px 20px" }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: RED, marginBottom: 8 }}>{item.categories[0] ?? "General"}</div>
        <h3 style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 700, fontSize: 19, lineHeight: 1.15, margin: "0 0 7px" }}>{item.name}</h3>
        <DetailLines lines={item.catalogDetails} color={MUTED} marginBottom={14} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 14, borderTop: "1px solid #F0F0F0" }}>
          <span style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 800, fontSize: item.onOffer ? 27 : 24, color: item.onOffer && !item.offerMinQuantity ? RED : INK }}>
            {formatMoney(item.effectivePrice, productCurrency(item, currency))}
          </span>
          {item.onOffer && !item.offerMinQuantity && <span style={{ fontSize: 12.5, color: MUTED, textDecoration: "line-through" }}>{formatMoney(item.salePrice, productCurrency(item, currency))}</span>}
        </div>
        {item.onOffer && item.offerMinQuantity && (
          <div style={{ marginTop: 10, background: "var(--catalog-offer-tint)", borderRadius: 12, padding: "9px 12px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: RED_DARK, marginBottom: 2 }}>
              Llevando {item.offerMinQuantity} o más
            </div>
            <div style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 800, fontSize: 16, color: RED_DARK }}>
              {formatMoney(item.offerFixedPrice!, productCurrency(item, currency))} <span style={{ fontSize: 11.5, fontWeight: 700 }}>c/u</span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function ProductGrid({
  visible,
  resultLabel,
  categoryNames,
  selectedCategories,
  onToggleCategory,
  onClearCategories,
  currency,
  onOpen,
}: {
  visible: Item[];
  resultLabel: string;
  categoryNames: string[];
  selectedCategories: Set<string>;
  onToggleCategory: (name: string) => void;
  onClearCategories: () => void;
  currency: string;
  onOpen: (p: Item) => void;
}) {
  return (
    <section id="productos" style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(56px,7vw,92px) 22px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: RED, marginBottom: 10 }}>Catálogo</div>
          <h2 style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 800, fontSize: "clamp(30px,4.4vw,52px)", margin: 0, letterSpacing: "-.015em" }}>Productos destacados</h2>
        </div>
        <div style={{ fontSize: 15, color: MUTED, fontWeight: 500 }}>{resultLabel}</div>
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "18px 0 26px" }}>
        <button type="button" aria-pressed={selectedCategories.size === 0} onClick={onClearCategories} style={chipStyle(selectedCategories.size === 0)}>
          Todas
        </button>
        {categoryNames.map((c) => (
          <button type="button" key={c} aria-pressed={selectedCategories.has(c)} onClick={() => onToggleCategory(c)} style={chipStyle(selectedCategories.has(c))}>
            {c}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <div style={{ padding: "70px 20px", textAlign: "center", background: PAPER, borderRadius: 24 }}>
          <div style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 700, fontSize: 24, marginBottom: 8 }}>Sin resultados</div>
          <div style={{ fontSize: 15, color: MUTED }}>Probá con otra categoría o cambiá la búsqueda.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,240px),1fr))", gap: 22 }}>
          {visible.map((p) => (
            <ProductCard key={p.id} item={p} currency={currency} onOpen={() => onOpen(p)} />
          ))}
        </div>
      )}
    </section>
  );
}

function NoveltyCard({ item, currency, onOpen }: { item: Item; currency: string; onOpen: () => void }) {
  return (
    <article style={{ position: "relative", flex: "0 0 270px", scrollSnapAlign: "start", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 24, overflow: "hidden", cursor: "pointer" }}>
      <CardAction name={item.name} onOpen={onOpen} />
      <div style={{ position: "relative", aspectRatio: "4/3", background: "#F7F7F7" }}>
        <ProductImage item={item} />
        <div style={{ position: "absolute", top: 14, left: 14, background: RED, color: "#fff", fontSize: 10.5, fontWeight: 800, letterSpacing: ".12em", padding: "6px 11px", borderRadius: 999 }}>NUEVO</div>
      </div>
      <div style={{ padding: 18 }}>
        <h3 style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 700, fontSize: 19, lineHeight: 1.15, margin: "0 0 6px" }}>{item.name}</h3>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 14 }}>{item.categories[0] ?? "General"}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 800, fontSize: 22, color: INK }}>{formatMoney(item.effectivePrice, productCurrency(item, currency))}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: RED }}>Ver producto →</span>
        </div>
      </div>
    </article>
  );
}

function Novelties({ items, currency, onOpen }: { items: Item[]; currency: string; onOpen: (p: Item) => void }) {
  if (items.length === 0) return null;
  return (
    <section id="novedades" style={{ background: PAPER, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(56px,7vw,88px) 22px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 34 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: RED, marginBottom: 10 }}>Recién llegado</div>
            <h2 style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 800, fontSize: "clamp(30px,4.4vw,52px)", margin: 0, letterSpacing: "-.015em" }}>Nuevos productos</h2>
          </div>
          <div style={{ fontSize: 14, color: MUTED, maxWidth: 340 }}>{config.texts.noveltiesDescription}</div>
        </div>
        <div style={{ display: "flex", gap: 20, overflowX: "auto", paddingBottom: 12, scrollSnapType: "x mandatory" }}>
          {items.map((p) => (
            <NoveltyCard key={p.id} item={p} currency={currency} onOpen={() => onOpen(p)} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Arreglo de estilo para las flechas del carrusel — mismo look, solo cambia
 * de qué lado va cada una. */
function galleryArrowStyle(side: "left" | "right", disabled: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: "none",
    background: "rgba(17,17,17,.55)",
    color: "#fff",
    fontSize: 20,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.35 : 1,
  };
  return side === "left" ? { ...base, left: 10 } : { ...base, right: 10 };
}

/** Carrusel deslizable de la ficha de producto: foto principal + hasta 4
 * fotos adicionales (item.galleryImages) — solo acá, nunca en la grilla ni en
 * las tarjetas de oferta/novedad, que siguen mostrando una sola foto
 * (ProductImage) igual que siempre. Sin fotos adicionales, se comporta
 * exactamente igual que antes. */
function ProductGallery({ item }: { item: Item }) {
  const images = useMemo(
    () => [item.imageUrl, ...item.galleryImages].filter((u): u is string => Boolean(u)),
    [item],
  );
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [item.id]);
  const touchStartX = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]!.clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || images.length <= 1) return;
    const delta = e.changedTouches[0]!.clientX - touchStartX.current;
    touchStartX.current = null;
    const SWIPE_THRESHOLD = 40;
    if (delta > SWIPE_THRESHOLD) setIndex((i) => Math.max(0, i - 1));
    else if (delta < -SWIPE_THRESHOLD) setIndex((i) => Math.min(images.length - 1, i + 1));
  };

  return (
    <>
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ position: "relative", aspectRatio: "1/1", borderRadius: 22, background: "#EFEFEF", overflow: "hidden", touchAction: "pan-y" }}
      >
        {images[index] && !failedImages.has(images[index]) ? (
          <img key={images[index]} src={images[index]} alt={item.name} onError={() => setFailedImages((previous) => new Set(previous).add(images[index]!))} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
        ) : (
          <ProductImage item={{ ...item, imageUrl: null }} />
        )}
        {item.onOffer ? (
          <div style={{ position: "absolute", top: 16, left: 16, background: RED, color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: ".12em", padding: "6px 12px", borderRadius: 999 }}>🔥 OFERTA</div>
        ) : (
          item.tag && (
            <div style={{ position: "absolute", top: 16, left: 16, background: RED, color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: ".12em", padding: "6px 12px", borderRadius: 999 }}>{item.tag}</div>
          )
        )}
        {item.onOffer && item.offerPercent && <PercentBadge percent={item.offerPercent} />}
        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              style={galleryArrowStyle("left", index === 0)}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Foto siguiente"
              onClick={() => setIndex((i) => Math.min(images.length - 1, i + 1))}
              disabled={index === images.length - 1}
              style={galleryArrowStyle("right", index === images.length - 1)}
            >
              ›
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12 }}>
          {images.map((_, i) => (
            <button type="button"
              key={i}
              aria-label={`Ver foto ${i + 1}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              style={{
                cursor: "pointer",
                border: 0, padding: 0,
                width: i === index ? 20 : 7,
                height: 7,
                borderRadius: 999,
                background: i === index ? RED : LINE,
                transition: "width .2s, background .2s",
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ProductDetail({ item, related, currency, onClose, onOpen }: { item: Item; related: Item[]; currency: string; onClose: () => void; onOpen: (p: Item) => void }) {
  return (
    <Modal onClose={onClose} labelledBy="product-detail-title">
        <div className="bk-modal-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))" }}>
          <div className="bk-modal-image" style={{ background: PAPER, padding: 26 }}>
            <ProductGallery item={item} />
          </div>
          <div className="bk-modal-content" style={{ padding: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: RED }}>{item.categories[0] ?? "General"}</div>
              <button type="button" data-modal-initial-focus aria-label="Cerrar detalle" onClick={onClose} style={{ border: 0, padding: 0, width: 34, height: 34, borderRadius: "50%", background: PAPER, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: INK, flexShrink: 0 }}>
                ×
              </button>
            </div>
            <h3 id="product-detail-title" tabIndex={-1} style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 800, fontSize: "clamp(26px,3.4vw,38px)", lineHeight: 1.05, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "-.01em" }}>{item.name}</h3>
            <DetailLines lines={item.catalogDetails} color={MUTED} fontSize={16} marginBottom={22} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
              <div style={{ background: item.onOffer && !item.offerMinQuantity ? RED : INK, borderRadius: 14, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, color: item.onOffer && !item.offerMinQuantity ? "var(--catalog-offer-text)" : "#9A9A9A", fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
                  Precio
                </div>
                <div style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 800, fontSize: 22, color: "#fff" }}>{formatMoney(item.effectivePrice, productCurrency(item, currency))}</div>
              </div>
              {item.onOffer && !item.offerMinQuantity && (
                <div style={{ background: PAPER, borderRadius: 14, padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>Precio de lista</div>
                  <div style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 700, fontSize: 17, textDecoration: "line-through", color: MUTED }}>{formatMoney(item.salePrice, productCurrency(item, currency))}</div>
                </div>
              )}
              {item.onOffer && item.offerMinQuantity && (
                <div style={{ background: "var(--catalog-offer-tint)", borderRadius: 14, padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, color: RED_DARK, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
                    Oferta llevando {item.offerMinQuantity}+
                  </div>
                  <div style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 800, fontSize: 20, color: RED_DARK }}>
                    {formatMoney(item.offerFixedPrice!, productCurrency(item, currency))} <span style={{ fontSize: 13 }}>c/u{item.offerPercent ? ` (${roundPercent(item.offerPercent)}% off)` : ""}</span>
                  </div>
                </div>
              )}
            </div>
            {related.length > 0 && (
              <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 20 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: MUTED, marginBottom: 14 }}>Productos relacionados</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10 }}>
                  {related.map((r) => (
                    <div key={r.id} style={{ position: "relative", cursor: "pointer", border: `1px solid ${LINE}`, borderRadius: 16, padding: 10 }}>
                      <CardAction name={r.name} onOpen={() => onOpen(r)} />
                      <div style={{ position: "relative", aspectRatio: "1/1", borderRadius: 10, background: PAPER, marginBottom: 8, overflow: "hidden" }}>
                        <ProductImage item={r} />
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2, marginBottom: 3 }}>{r.name}</div>
                      <div style={{ fontSize: 12.5, color: RED, fontWeight: 700 }}>{formatMoney(r.effectivePrice, productCurrency(r, currency))}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
    </Modal>
  );
}

function Footer() {
  return (
    <footer style={{ background: INK, color: "#fff" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(50px,6vw,80px) 22px 30px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 40 }}>
        <div>
          <img src={logo} alt={config.business.displayName} style={{ height: 96, width: "auto", display: "block", borderRadius: 14, background: "#fff", padding: 6, marginBottom: 18 }} />
          <div style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 700, fontSize: 19, lineHeight: 1.25, maxWidth: 280 }}>{config.texts.tagline}</div>
        </div>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>Navegación</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href} style={{ color: "#fff", fontSize: 15, fontWeight: 500 }}>
                {label}
              </a>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>Contacto</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {config.business.contacts.map((contact) => <a key={contact.url} href={contact.url} style={{ fontSize: 15, color: "#fff", fontWeight: 500 }}>{contact.label}</a>)}
            {config.business.contacts.length === 0 && ["WhatsApp", "Instagram", "Facebook"].map((label) => <span key={label} style={{ fontSize: 15, color: "#fff", fontWeight: 500 }}>{label}</span>)}
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 16, lineHeight: 1.5 }}>{config.business.contactPlaceholder}</div>
        </div>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>Catálogo</div>
          <div style={{ fontSize: 14, color: "#9A9A9A", lineHeight: 1.6 }}>
            {config.texts.catalogNotice}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 22, borderTop: "1px solid #262626", display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: MUTED }}>© {new Date().getFullYear()} {config.business.displayName}. Todos los derechos reservados.</span>
        <span style={{ fontSize: 13, color: MUTED }}>Catálogo digital · No es tienda en línea</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: MUTED }}>
          <img src={cesLogo} alt="Cuban Enterprise Solutions" style={{ width: 18, height: 18, display: "block" }} />
          Desarrollado por Cuban Enterprise Solutions
        </span>
      </div>
    </footer>
  );
}

function MarqueeBar() {
  const items = config.texts.marquee;
  return (
    <div style={{ background: INK, color: "#fff", fontSize: 13, letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 600, padding: "9px 0", overflow: "hidden", whiteSpace: "nowrap" }}>
      <div style={{ display: "inline-flex", gap: 44, animation: "bkMarquee 26s linear infinite" }}>
        {[0, 1].map((rep) =>
          items.map((it, i) => (
            <span key={`${rep}-${i}`} style={i % 2 === 0 ? { color: RED_SOFT } : undefined}>
              {it}
            </span>
          )),
        )}
      </div>
    </div>
  );
}

function CenteredMessage({ title, text, onRetry, loading }: { title: string; text: string; onRetry?: () => void; loading?: boolean }) {
  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <div>
        <div style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 700, fontSize: 24, marginBottom: 10 }}>{title}</div>
        <div role={onRetry ? "alert" : "status"} style={{ fontSize: 15, color: MUTED, maxWidth: 380 }}>{text}</div>
        {onRetry && <button className="bk-retry" onClick={onRetry} disabled={loading}>{loading ? "Cargando…" : "Reintentar"}</button>}
      </div>
    </div>
  );
}

const FAQ_ITEMS = config.texts.faq;

function FAQ() {
  return (
    <section id="preguntas" style={{ maxWidth: 900, margin: "0 auto", padding: "clamp(40px,5vw,68px) 22px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: RED, marginBottom: 10 }}>Ayuda</div>
      <h2 style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 800, fontSize: "clamp(28px,3.6vw,40px)", margin: "0 0 26px", letterSpacing: "-.015em" }}>
        Preguntas frecuentes
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {FAQ_ITEMS.map((f) => (
          <div key={f.question} style={{ background: PAPER, borderRadius: 18, padding: "20px 22px", border: `1px solid ${LINE}` }}>
            <h3 style={{ fontFamily: "var(--catalog-font-heading)", fontWeight: 700, fontSize: 17, margin: "0 0 8px" }}>{f.question}</h3>
            <p style={{ fontSize: 14.5, color: MUTED, lineHeight: 1.6, margin: 0 }}>{f.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductStructuredData({ items, currency }: { items: Item[]; currency: string }) {
  if (items.length === 0) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(productStructuredData(items, currency, config)) }} />;
}

export function App() {
  const { catalog, error, loading, retry } = useCatalog();
  // Multi-selección: cero categorías elegidas = "Todas". Un producto puede
  // tener más de una categoría (ver Product.catalogCategories), así que acá
  // también se puede elegir más de un filtro a la vez y se combinan.
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const items = useMemo(() => (catalog ? catalog.products.map(enrich) : []), [catalog]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of items) {
      for (const raw of p.categories) {
        const name = raw.trim();
        if (!name) continue;
        map.set(name, (map.get(name) ?? 0) + 1);
      }
    }
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  function toggleCategory(name: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const visible = useMemo(() => filterProducts(items, selectedCategories, query), [items, selectedCategories, query]);

  const offers = useMemo(() => items.filter((p) => p.onOffer), [items]);
  const novelties = useMemo(
    () => items.filter((p) => p.isNew).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
    [items],
  );

  function goToSearchResult() {
    const first = visible[0];
    if (first) {
      document.getElementById(`producto-${first.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      document.getElementById("productos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const detail = detailId ? (items.find((p) => p.id === detailId) ?? null) : null;
  const related = useMemo(() => {
    if (!detail) return [];
    const sameCategory = items.filter((p) => p.id !== detail.id && p.categories.some((c) => detail.categories.includes(c)));
    const others = items.filter((p) => p.id !== detail.id && !p.categories.some((c) => detail.categories.includes(c)));
    return [...sameCategory, ...others].slice(0, 3);
  }, [items, detail]);

  if (error && !catalog) {
    return <CenteredMessage title="No pudimos cargar el catálogo" text={error} onRetry={retry} loading={loading} />;
  }
  if (!catalog) {
    return <CenteredMessage title="Cargando catálogo..." text={config.texts.loading} />;
  }

  const resultLabel = `${visible.length} ${visible.length === 1 ? "producto" : "productos"}${
    selectedCategories.size === 0
      ? " en el catálogo"
      : selectedCategories.size === 1
        ? ` en ${[...selectedCategories][0]}`
        : ` en ${selectedCategories.size} categorías`
  }`;

  return (
    <div style={{ maxWidth: "100%", background: "#fff" }}>
      <ProductStructuredData items={items} currency={catalog.currency} />
      <MarqueeBar />
      <Header query={query} onQuery={setQuery} onSearch={goToSearchResult} />
      <main id="main-content" aria-busy={loading}>
        {error && <div role="alert" className="bk-data-notice">No se pudo actualizar: {error} Los precios mostrados corresponden a la última carga. <button className="bk-retry" onClick={retry} disabled={loading}>Reintentar</button></div>}
        {catalog.warnings.length > 0 && <div role="status" className="bk-data-notice">Algunos productos no pudieron mostrarse por datos incompletos. <button className="bk-retry" onClick={retry} disabled={loading}>Reintentar</button></div>}
        <Hero catalog={catalog} offerCount={offers.length} categoryCount={categories.length} />
        <VisitInfo />
        {categories.length > 0 && (
          <Categories
            categories={categories}
            selected={selectedCategories}
            onToggle={(name) => {
              toggleCategory(name);
              document.getElementById("productos")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        )}
        <Offers items={offers} currency={catalog.currency} onOpen={(p) => setDetailId(p.id)} />
        <ProductGrid
          visible={visible}
          resultLabel={resultLabel}
          categoryNames={categories.map((c) => c.name)}
          selectedCategories={selectedCategories}
          onToggleCategory={toggleCategory}
          onClearCategories={() => setSelectedCategories(new Set())}
          currency={catalog.currency}
          onOpen={(p) => setDetailId(p.id)}
        />
        <Novelties items={novelties} currency={catalog.currency} onOpen={(p) => setDetailId(p.id)} />
        <FAQ />
      </main>
      <Footer />
      {detail && (
        <ProductDetail item={detail} related={related} currency={catalog.currency} onClose={() => setDetailId(null)} onOpen={(p) => setDetailId(p.id)} />
      )}
    </div>
  );
}

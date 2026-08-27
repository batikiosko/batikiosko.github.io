import { useEffect, useMemo, useState } from "react";
import { fetchCatalog, type PublicCatalog, type PublicCatalogProduct } from "./api.js";
import { formatMoney } from "./format.js";
import logo from "./assets/logo-batikiosco.jpeg";

const RED = "#E53935";
const RED_DARK = "#C62828";
const RED_SOFT = "#FF5A4F";
const INK = "#111111";
const MUTED = "#757575";
const LINE = "#EDEDED";
const PAPER = "#F5F5F5";

const NEW_WINDOW_DAYS = 21;

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

// Cualquier imagen puesta en src/assets/categories/<slug-de-la-categoria>.(jpg|jpeg|png|webp)
// se usa automáticamente para esa categoría — no hace falta tocar código para agregarlas.
const categoryImageModules = import.meta.glob<{ default: string }>("./assets/categories/*.{jpg,jpeg,png,webp}", {
  eager: true,
});
const CATEGORY_IMAGES: Record<string, string> = {};
for (const path in categoryImageModules) {
  const fileName = path.split("/").pop()!.replace(/\.[^.]+$/, "");
  CATEGORY_IMAGES[fileName] = categoryImageModules[path]!.default;
}

function categoryImage(name: string): string | null {
  return CATEGORY_IMAGES[slugify(name)] ?? null;
}

interface Item extends PublicCatalogProduct {
  isNew: boolean;
  tag: "OFERTA" | "NUEVO" | null;
}

function enrich(p: PublicCatalogProduct): Item {
  const isNew = Date.now() - new Date(p.createdAt).getTime() < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
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
    boxShadow: active ? "0 14px 30px rgba(229,57,53,.28)" : "none",
    transition: "background .2s, color .2s, box-shadow .2s",
  };
}

function categoryCardStyle(active: boolean): React.CSSProperties {
  return {
    cursor: "pointer",
    padding: "22px 18px",
    borderRadius: 22,
    fontFamily: "Archivo, sans-serif",
    background: active ? RED : PAPER,
    color: active ? "#fff" : INK,
    border: active ? `1.5px solid ${RED}` : `1.5px solid ${LINE}`,
    boxShadow: active ? "0 14px 30px rgba(229,57,53,.28)" : "none",
    transition: "background .2s, color .2s, box-shadow .2s",
  };
}

function ProductImage({ item, dark = false }: { item: Item; dark?: boolean }) {
  if (item.imageUrl) {
    return <img src={item.imageUrl} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />;
  }
  return (
    <div
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

function Header({ query, onQuery }: { query: string; onQuery: (v: string) => void }) {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 60, background: "rgba(255,255,255,.92)", backdropFilter: "blur(14px)", borderBottom: `1px solid ${LINE}` }}>
      <div className="bk-header-inner" style={{ maxWidth: 1280, margin: "0 auto", padding: "14px 22px", display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
        <a href="#inicio" className="bk-logo" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <img src={logo} alt="BATIKIOSCO" style={{ height: 56, width: "auto", display: "block", mixBlendMode: "multiply" }} />
        </a>
        <nav className="bk-nav" style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
          {[
            ["#inicio", "Inicio"],
            ["#categorias", "Categorías"],
            ["#ofertas", "Ofertas"],
            ["#productos", "Productos"],
            ["#novedades", "Novedades"],
          ].map(([href, label]) => (
            <a key={href} href={href} style={{ fontSize: 14, fontWeight: 600, color: INK, padding: "10px 14px", borderRadius: 999, whiteSpace: "nowrap" }}>
              {label}
            </a>
          ))}
        </nav>
        <div className="bk-search" style={{ display: "flex", alignItems: "center", gap: 10, background: PAPER, border: `1.5px solid ${LINE}`, borderRadius: 999, padding: "10px 16px", minWidth: 230 }}>
          <div style={{ width: 14, height: 14, border: "2px solid #757575", borderRadius: "50%", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="¿Qué estás buscando?"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            style={{ border: 0, outline: 0, background: "transparent", fontSize: 14, color: INK, width: "100%" }}
          />
        </div>
      </div>
    </header>
  );
}

function Hero({ catalog, offerCount, categoryCount }: { catalog: PublicCatalog; offerCount: number; categoryCount: number }) {
  return (
    <section id="inicio" style={{ position: "relative", background: PAPER, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(#DCDCDC 1.1px, transparent 1.1px)", backgroundSize: "22px 22px", opacity: 0.7 }} />
      <div style={{ position: "absolute", right: -140, top: -140, width: 520, height: 520, borderRadius: "50%", background: RED, opacity: 0.09 }} />
      <div style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "clamp(48px,7vw,96px) 22px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 48, alignItems: "center" }}>
        <div style={{ animation: "bkRise .7s cubic-bezier(.2,.7,.3,1) both" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: INK, color: "#fff", borderRadius: 999, padding: "8px 16px", fontSize: 12, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", marginBottom: 22 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: RED_SOFT, display: "inline-block" }} />
            Catálogo digital
          </div>
          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "clamp(40px,6.2vw,76px)", lineHeight: 1.02, letterSpacing: "-.02em", margin: "0 0 20px" }}>
            Todo lo que te gusta,
            <br />
            <span style={{ color: RED }}>en un solo lugar.</span>
          </h1>
          <p style={{ fontSize: "clamp(16px,1.5vw,20px)", color: MUTED, lineHeight: 1.6, margin: "0 0 34px", maxWidth: 520 }}>
            Descubre nuestros productos, novedades y las mejores ofertas.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
            <a href="#productos" style={{ display: "inline-flex", alignItems: "center", gap: 12, background: RED, color: "#fff", fontWeight: 700, fontSize: 16, padding: "17px 30px", borderRadius: 999, boxShadow: "0 12px 30px rgba(229,57,53,.32)" }}>
              Ver catálogo <span>→</span>
            </a>
            <a href="#ofertas" style={{ display: "inline-flex", alignItems: "center", gap: 10, color: INK, fontWeight: 700, fontSize: 16, padding: "17px 26px", borderRadius: 999, border: `1.5px solid ${INK}` }}>
              Ver ofertas
            </a>
          </div>
          <div style={{ display: "flex", gap: 36, marginTop: 44, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: 30, color: INK, lineHeight: 1 }}>{catalog.products.length}</div>
              <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>productos en catálogo</div>
            </div>
            <div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: 30, color: INK, lineHeight: 1 }}>{categoryCount}</div>
              <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>categorías</div>
            </div>
            <div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: 30, color: RED, lineHeight: 1 }}>{offerCount}</div>
              <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>ofertas activas</div>
            </div>
          </div>
        </div>
        <div style={{ position: "relative", animation: "bkFade .9s ease .15s both" }}>
          <div style={{ position: "relative", background: INK, borderRadius: 34, padding: 26, boxShadow: "0 34px 80px rgba(17,17,17,.28)" }}>
            <img src={logo} alt="BATIKIOSCO" style={{ width: "100%", display: "block", borderRadius: 22, background: "#fff" }} />
            <div style={{ position: "absolute", left: -16, bottom: 34, background: RED, color: "#fff", fontWeight: 800, fontFamily: "'Baloo 2', cursive", fontSize: 18, padding: "12px 20px", borderRadius: 14, boxShadow: "0 14px 30px rgba(229,57,53,.4)", transform: "rotate(-4deg)" }}>
              Tu kiosco, ahora digital
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { title: "Productos seleccionados", desc: "Lo que más se pide en el barrio, curado uno por uno.", bg: RED },
  { title: "Nuevas ofertas", desc: "Promociones que cambian cada semana.", bg: INK },
  { title: "Precios actualizados", desc: "Lo que ves aquí es lo que ves en el mostrador.", bg: RED },
  { title: "Todo en un catálogo", desc: "Explora sin filas y sin apuros, desde el celular.", bg: INK },
];

function FeatureCards() {
  return (
    <section style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(40px,5vw,68px) 22px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 18 }}>
        {FEATURES.map((f) => (
          <div key={f.title} style={{ background: PAPER, borderRadius: 20, padding: 26, border: `1px solid ${LINE}` }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: f.bg, marginBottom: 16 }} />
            <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 700, fontSize: 19, marginBottom: 6 }}>{f.title}</div>
            <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.55 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Categories({ categories, active, onPick }: { categories: { name: string; count: number }[]; active: string; onPick: (name: string) => void }) {
  return (
    <section id="categorias" style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(28px,4vw,48px) 22px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 26 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: RED, marginBottom: 10 }}>Explora</div>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "clamp(30px,4vw,46px)", margin: 0, letterSpacing: "-.015em" }}>Categorías</h2>
        </div>
        <div style={{ fontSize: 14, color: MUTED, maxWidth: 360 }}>Toca una categoría para filtrar el catálogo completo.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
        {categories.map((c) => {
          const img = categoryImage(c.name);
          return (
            <div key={c.name} onClick={() => onPick(c.name)} style={categoryCardStyle(active === c.name)}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  overflow: "hidden",
                  marginBottom: 12,
                  background: active === c.name ? "rgba(255,255,255,.18)" : "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {img ? (
                  <img src={img} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 26 }}>{categoryIcon(c.name)}</span>
                )}
              </div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 700, fontSize: 17, lineHeight: 1.2 }}>{c.name}</div>
              <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.7, marginTop: 4 }}>{c.count} productos</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OfferCard({ item, currency, onOpen }: { item: Item; currency: string; onOpen: () => void }) {
  return (
    <div onClick={onOpen} style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 24, overflow: "hidden", cursor: "pointer" }}>
      <div style={{ position: "relative", aspectRatio: "4/3", background: PAPER }}>
        <ProductImage item={item} dark />
        <div style={{ position: "absolute", top: 14, left: 14, background: RED, color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: ".12em", padding: "6px 12px", borderRadius: 999 }}>OFERTA</div>
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: MUTED, marginBottom: 8 }}>{item.category ?? "General"}</div>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 700, fontSize: 21, color: "#fff", lineHeight: 1.15, marginBottom: 8 }}>{item.name}</div>
        {item.description && <div style={{ fontSize: 13.5, color: "#9A9A9A", lineHeight: 1.5, marginBottom: 16 }}>{item.description}</div>}
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: 28, color: RED }}>{formatMoney(item.effectivePrice, currency)}</span>
          <span style={{ fontSize: 15, color: MUTED, textDecoration: "line-through" }}>{formatMoney(item.salePrice, currency)}</span>
        </div>
      </div>
    </div>
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
            <h2 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "clamp(30px,4.4vw,52px)", margin: 0, color: "#fff", letterSpacing: "-.015em" }}>🔥 Ofertas destacadas</h2>
          </div>
          <div style={{ fontSize: 14, color: "#9A9A9A", maxWidth: 340 }}>Precios especiales mientras dure la promoción en el kiosco.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20 }}>
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
    <div onClick={onOpen} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 24, overflow: "hidden", cursor: "pointer" }}>
      <div style={{ position: "relative", aspectRatio: "1/1", background: PAPER }}>
        <ProductImage item={item} />
        {item.tag && (
          <div style={{ position: "absolute", top: 14, left: 14, background: INK, color: "#fff", fontSize: 10.5, fontWeight: 800, letterSpacing: ".12em", padding: "6px 11px", borderRadius: 999 }}>{item.tag}</div>
        )}
      </div>
      <div style={{ padding: "18px 18px 20px" }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: RED, marginBottom: 8 }}>{item.category ?? "General"}</div>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 700, fontSize: 19, lineHeight: 1.15, marginBottom: 7 }}>{item.name}</div>
        {item.description && <div style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.5, marginBottom: 14 }}>{item.description}</div>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 14, borderTop: "1px solid #F0F0F0" }}>
          <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: 24, color: INK }}>{formatMoney(item.effectivePrice, currency)}</span>
          {item.onOffer && <span style={{ fontSize: 12, color: MUTED, textDecoration: "line-through" }}>{formatMoney(item.salePrice, currency)}</span>}
        </div>
      </div>
    </div>
  );
}

function ProductGrid({
  visible,
  resultLabel,
  chips,
  activeChip,
  onPickChip,
  currency,
  onOpen,
}: {
  visible: Item[];
  resultLabel: string;
  chips: string[];
  activeChip: string;
  onPickChip: (name: string) => void;
  currency: string;
  onOpen: (p: Item) => void;
}) {
  return (
    <section id="productos" style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(56px,7vw,92px) 22px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: RED, marginBottom: 10 }}>Catálogo</div>
          <h2 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "clamp(30px,4.4vw,52px)", margin: 0, letterSpacing: "-.015em" }}>Productos destacados</h2>
        </div>
        <div style={{ fontSize: 15, color: MUTED, fontWeight: 500 }}>{resultLabel}</div>
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "18px 0 26px" }}>
        {chips.map((c) => (
          <div key={c} onClick={() => onPickChip(c)} style={chipStyle(activeChip === c)}>
            {c}
          </div>
        ))}
      </div>
      {visible.length === 0 ? (
        <div style={{ padding: "70px 20px", textAlign: "center", background: PAPER, borderRadius: 24 }}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 700, fontSize: 24, marginBottom: 8 }}>Sin resultados</div>
          <div style={{ fontSize: 15, color: MUTED }}>Probá con otra categoría o cambiá la búsqueda.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 22 }}>
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
    <div onClick={onOpen} style={{ flex: "0 0 270px", scrollSnapAlign: "start", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 24, overflow: "hidden", cursor: "pointer" }}>
      <div style={{ position: "relative", aspectRatio: "4/3", background: "#F7F7F7" }}>
        <ProductImage item={item} />
        <div style={{ position: "absolute", top: 14, left: 14, background: RED, color: "#fff", fontSize: 10.5, fontWeight: 800, letterSpacing: ".12em", padding: "6px 11px", borderRadius: 999 }}>NUEVO</div>
      </div>
      <div style={{ padding: 18 }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 700, fontSize: 19, lineHeight: 1.15, marginBottom: 6 }}>{item.name}</div>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 14 }}>{item.category ?? "General"}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: 22, color: INK }}>{formatMoney(item.effectivePrice, currency)}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: RED }}>Ver producto →</span>
        </div>
      </div>
    </div>
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
            <h2 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "clamp(30px,4.4vw,52px)", margin: 0, letterSpacing: "-.015em" }}>Nuevos productos</h2>
          </div>
          <div style={{ fontSize: 14, color: MUTED, maxWidth: 340 }}>Lo último que llegó al mostrador. Desliza para ver más.</div>
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

function ProductDetail({ item, related, currency, onClose, onOpen }: { item: Item; related: Item[]; currency: string; onClose: () => void; onOpen: (p: Item) => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(17,17,17,.62)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24, overflowY: "auto" }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 30, maxWidth: 960, width: "100%", margin: "auto", overflow: "hidden", boxShadow: "0 40px 90px rgba(0,0,0,.4)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
          <div style={{ background: PAPER, padding: 26 }}>
            <div style={{ position: "relative", aspectRatio: "1/1", borderRadius: 22, background: "#EFEFEF", overflow: "hidden" }}>
              <ProductImage item={item} />
              {item.tag && (
                <div style={{ position: "absolute", top: 16, left: 16, background: RED, color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: ".12em", padding: "6px 12px", borderRadius: 999 }}>{item.tag}</div>
              )}
            </div>
          </div>
          <div style={{ padding: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: RED }}>{item.category ?? "General"}</div>
              <div onClick={onClose} style={{ width: 34, height: 34, borderRadius: "50%", background: PAPER, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: INK, flexShrink: 0 }}>
                ×
              </div>
            </div>
            <h3 style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: "clamp(26px,3.4vw,38px)", lineHeight: 1.05, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "-.01em" }}>{item.name}</h3>
            {item.description && <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.6, margin: "0 0 22px" }}>{item.description}</p>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
              <div style={{ background: INK, borderRadius: 14, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, color: "#9A9A9A", fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>Precio</div>
                <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 800, fontSize: 19, color: "#fff" }}>{formatMoney(item.effectivePrice, currency)}</div>
              </div>
              {item.onOffer && (
                <div style={{ background: PAPER, borderRadius: 14, padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>Precio de lista</div>
                  <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 700, fontSize: 17, textDecoration: "line-through", color: MUTED }}>{formatMoney(item.salePrice, currency)}</div>
                </div>
              )}
            </div>
            {related.length > 0 && (
              <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 20 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", color: MUTED, marginBottom: 14 }}>Productos relacionados</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10 }}>
                  {related.map((r) => (
                    <div key={r.id} onClick={() => onOpen(r)} style={{ cursor: "pointer", border: `1px solid ${LINE}`, borderRadius: 16, padding: 10 }}>
                      <div style={{ position: "relative", aspectRatio: "1/1", borderRadius: 10, background: PAPER, marginBottom: 8, overflow: "hidden" }}>
                        <ProductImage item={r} />
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2, marginBottom: 3 }}>{r.name}</div>
                      <div style={{ fontSize: 12.5, color: RED, fontWeight: 700 }}>{formatMoney(r.effectivePrice, currency)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer style={{ background: INK, color: "#fff" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(50px,6vw,80px) 22px 30px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 40 }}>
        <div>
          <img src={logo} alt="BATIKIOSCO" style={{ height: 96, width: "auto", display: "block", borderRadius: 14, background: "#fff", padding: 6, marginBottom: 18 }} />
          <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 700, fontSize: 19, lineHeight: 1.25, maxWidth: 280 }}>Todo lo que te gusta, en un solo lugar.</div>
        </div>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>Navegación</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {[
              ["#inicio", "Inicio"],
              ["#categorias", "Categorías"],
              ["#ofertas", "Ofertas"],
              ["#productos", "Productos"],
              ["#novedades", "Novedades"],
            ].map(([href, label]) => (
              <a key={href} href={href} style={{ color: "#fff", fontSize: 15, fontWeight: 500 }}>
                {label}
              </a>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>Contacto</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <span style={{ fontSize: 15, color: "#fff", fontWeight: 500 }}>WhatsApp</span>
            <span style={{ fontSize: 15, color: "#fff", fontWeight: 500 }}>Instagram</span>
            <span style={{ fontSize: 15, color: "#fff", fontWeight: 500 }}>Facebook</span>
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 16, lineHeight: 1.5 }}>Espacio reservado para los enlaces oficiales del kiosco.</div>
        </div>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>Catálogo</div>
          <div style={{ fontSize: 14, color: "#9A9A9A", lineHeight: 1.6 }}>
            Este es un catálogo informativo. Los precios se muestran como referencia y las compras se realizan directamente en el kiosco.
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 22, borderTop: "1px solid #262626", display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: MUTED }}>© {new Date().getFullYear()} BATIKIOSCO. Todos los derechos reservados.</span>
        <span style={{ fontSize: 13, color: MUTED }}>Catálogo digital · No es tienda en línea</span>
      </div>
    </footer>
  );
}

function MarqueeBar() {
  const items = ["Catálogo digital", "Precios actualizados", "Nuevos sabores cada semana", "Tu kiosco de barrio"];
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

function CenteredMessage({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <div>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 700, fontSize: 24, marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 15, color: MUTED, maxWidth: 380 }}>{text}</div>
      </div>
    </div>
  );
}

export function App() {
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("Todas");
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    void fetchCatalog()
      .then(setCatalog)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar el catálogo."));
  }, []);

  const items = useMemo(() => (catalog ? catalog.products.map(enrich) : []), [catalog]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of items) {
      const name = p.category?.trim();
      if (!name) continue;
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const chips = useMemo(() => ["Todas", ...categories.map((c) => c.name)], [categories]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((p) => {
      const matchesCategory = category === "Todas" || p.category === category;
      const matchesQuery = !q || `${p.name} ${p.description ?? ""} ${p.category ?? ""}`.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [items, category, query]);

  const offers = useMemo(() => items.filter((p) => p.onOffer), [items]);
  const novelties = useMemo(
    () => items.filter((p) => p.isNew).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
    [items],
  );

  const detail = detailId ? (items.find((p) => p.id === detailId) ?? null) : null;
  const related = useMemo(() => {
    if (!detail) return [];
    const sameCategory = items.filter((p) => p.category === detail.category && p.id !== detail.id);
    const others = items.filter((p) => p.category !== detail.category);
    return [...sameCategory, ...others].slice(0, 3);
  }, [items, detail]);

  if (error) {
    return <CenteredMessage title="No pudimos cargar el catálogo" text={error} />;
  }
  if (!catalog) {
    return <CenteredMessage title="Cargando catálogo..." text="Un momento, estamos trayendo los productos y ofertas del kiosco." />;
  }

  const resultLabel = `${visible.length} ${visible.length === 1 ? "producto" : "productos"}${category === "Todas" ? " en el catálogo" : ` en ${category}`}`;

  return (
    <div style={{ maxWidth: "100%", overflowX: "hidden", background: "#fff" }}>
      <MarqueeBar />
      <Header
        query={query}
        onQuery={(v) => {
          setQuery(v);
          if (v.trim() && !query.trim()) {
            document.getElementById("productos")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }}
      />
      <Hero catalog={catalog} offerCount={offers.length} categoryCount={categories.length} />
      <FeatureCards />
      {categories.length > 0 && (
        <Categories
          categories={categories}
          active={category}
          onPick={(name) => {
            setCategory((prev) => (prev === name ? "Todas" : name));
            document.getElementById("productos")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      )}
      <Offers items={offers} currency={catalog.currency} onOpen={(p) => setDetailId(p.id)} />
      <ProductGrid
        visible={visible}
        resultLabel={resultLabel}
        chips={chips}
        activeChip={category}
        onPickChip={setCategory}
        currency={catalog.currency}
        onOpen={(p) => setDetailId(p.id)}
      />
      <Novelties items={novelties} currency={catalog.currency} onOpen={(p) => setDetailId(p.id)} />
      <Footer />
      {detail && (
        <ProductDetail item={detail} related={related} currency={catalog.currency} onClose={() => setDetailId(null)} onOpen={(p) => setDetailId(p.id)} />
      )}
    </div>
  );
}

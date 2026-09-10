// Este catálogo es de un solo negocio (BATIKIOSCO) por ahora — sin login ni
// configuración, así que el servidor y la compañía van fijos acá. El día que
// haya que armar la vidriera de otro cliente, alcanza con otro build de este
// mismo paquete con estos dos valores cambiados (o via VITE_* si se prefiere
// no tocar el código).
const SYNC_SERVER_URL = import.meta.env.VITE_SYNC_SERVER_URL ?? "https://contabilidad-sync-server.onrender.com";
const COMPANY_ID = import.meta.env.VITE_COMPANY_ID ?? "cmt7ni4vh0000zxuwpq1drg58";

export interface PublicCatalogProduct {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  /** Renglones a mostrar debajo del nombre, uno por línea (descripción, peso,
   * empaquetado — solo los que estén cargados). Ya vienen listos del servidor. */
  catalogDetails: string[];
  imageUrl: string | null;
  salePrice: string;
  effectivePrice: string;
  onOffer: boolean;
  createdAt: string;
}

export interface PublicCatalog {
  companyName: string;
  currency: string;
  products: PublicCatalogProduct[];
}

/**
 * Trae el catálogo en vivo desde el sync-server (GET /public/catalog, sin
 * ninguna llave — ver posPublicCatalogService.getPublicCatalog). Es
 * literalmente el mismo catálogo que usan pos-web/shop-web: mismo producto,
 * mismo precio, misma oferta, en el momento en que se pide.
 */
export async function fetchCatalog(): Promise<PublicCatalog> {
  const url = new URL("/public/catalog", SYNC_SERVER_URL);
  url.searchParams.set("companyId", COMPANY_ID);
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("No se pudo conectar. Revisá tu conexión a internet e intentá de nuevo.");
  }
  if (res.status === 404) {
    throw new Error("El catálogo todavía no está disponible.");
  }
  if (!res.ok) {
    throw new Error(`El servidor respondió con error (${res.status}).`);
  }
  return (await res.json()) as PublicCatalog;
}

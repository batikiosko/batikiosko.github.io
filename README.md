# Catálogos digitales CES

Esta aplicación mantiene una base común de React/Vite. Cada negocio se describe
en un perfil completo de `config/businesses/<perfil>.json`; Batikiosco es el
perfil predeterminado. La PWA, instalación y actualización usan ese mismo perfil.
No incluye funciones de venta ni persistencia offline de productos.

## Configuración y publicación

Seleccionar un perfil con `VITE_CATALOG_PROFILE`. Los perfiles no se mezclan:
un negocio nuevo debe declarar su identidad, assets, textos, SEO y observabilidad.
Los errores de configuración detienen el build.
Los textos y SEO aceptan referencias `{{business.name}}`,
`{{business.displayName}}`, `{{business.address}}` y `{{business.hours}}`;
la FAQ puede reutilizar esos hechos sin mantener otra copia de dirección/horario.

Overrides disponibles en variables de entorno o archivos `.env` de este paquete:

| Variable | Función |
| --- | --- |
| `VITE_CATALOG_PROFILE` | Perfil JSON; por defecto `batikiosco` |
| `VITE_COMPANY_ID` | Empresa que entrega los productos |
| `VITE_DEVICE_ID` | Punto de venta; vacío permite resolución automática del servidor |
| `VITE_SYNC_SERVER_URL` | Servidor del catálogo público |
| `VITE_PUBLIC_URL` | URL pública completa; su ruta determina `base` de Vite |
| `VITE_CATALOG_CURRENCY` | Moneda de respaldo si la respuesta omite una moneda válida |

La moneda de cada producto prevalece sobre la moneda del catálogo. No se hacen
conversiones. Si no hay moneda válida en la respuesta ni respaldo explícito,
se explica el error en lugar de inventar una moneda.

Las rutas de assets del perfil son relativas a `catalog-web`. El plugin emite
únicamente las imágenes seleccionadas, con hash de contenido. No copia todo
`public/`, para evitar incluir imágenes de otro negocio. `robots.txt` y
`sitemap.xml` se generan a partir del perfil; sus antiguas copias estáticas ya
no son fuentes de configuración. Los assets aparentemente sin uso se conservan.

El QR es opcional y pre-generado: debe apuntar a la URL del perfil. Si se cambia
el dominio o la ruta mediante `VITE_PUBLIC_URL`, se omite el QR anterior para no
compartir un destino incorrecto. Para un negocio nuevo se puede aportar su QR
correcto en el perfil. No se ha añadido un generador de QR.

Para crear otro catálogo: añadir su perfil completo y sus assets, seleccionar
`VITE_CATALOG_PROFILE`, compilar y publicar el contenido de `dist/`. No hace
falta buscar/reemplazar nombres en React, el HTML o el script de prerender.
Los contactos aceptan enlaces HTTP/HTTPS. Los proyectos de Analytics y Sentry
son opcionales y se definen por negocio.

## Consistencia del build

`vite.config.ts` carga las variables de Vite **una sola vez**. El plugin entrega
esa configuración al módulo virtual consumido por React, genera el head/SEO y
guarda la configuración resuelta en `dist/catalog-build.json`. El prerender lee
exclusivamente ese archivo, incluyendo empresa, dispositivo y servidor; no
vuelve a leer las variables del proceso ni tiene valores propios del negocio.

El cliente HTTP, normalización, monedas y reglas de precios se comparten entre
React y prerender. El HTML inicial incluye precio normal, precio de oferta y
condiciones por cantidad. La FAQ visible y el JSON-LD proceden del mismo perfil.
React utiliza `createRoot`: reemplaza la instantánea, no la hidrata.

El prerender es una instantánea al publicar. Si no puede consultar el catálogo,
el build conserva la información del negocio y explica la ausencia de productos;
la aplicación intentará obtenerlos al abrirla. El log permite distinguir ese
caso de un prerender completo. El shell puede abrir offline después de una carga
con service worker instalado; los productos necesitan conexión.

Para GitHub Pages publicar `dist/` en la ubicación declarada por `publicUrl`.
El repositorio no incluye un workflow de publicación de este catálogo. Esta
aplicación no publica ni despliega automáticamente.

## Robustez e interacción

- Timeout de 15 segundos, incluyendo lectura del JSON; cancelación al desmontar.
- Arrays y campos opcionales normalizados. Un producto con precio/identidad
  inválidos se omite con aviso; si ninguno es utilizable, se explica el error.
- Reintento manual. Una actualización fallida conserva los productos anteriores
  e indica que los precios corresponden a la última carga.
- Al recuperar foco/visibilidad se actualiza si han pasado cinco minutos desde
  el éxito anterior. Sin polling; peticiones simultáneas se deduplican y los
  intentos automáticos fallidos tienen 30 segundos de espera mínima.
- Botones semánticos y modal nativo `dialog`: Escape, foco contenido, retorno
  al disparador y bloqueo del scroll de fondo.
- Fallback visual para fotos fallidas, incluidas las de la galería.

## Verificación

Ejecutar desde este paquete (en PowerShell puede requerirse `npm.cmd`):

```text
npm run test
npm run typecheck
npm run build
npm run verify:demo
npm run verify:browser
npm run verify:pwa
```

Los tests usan `node:test`, sin nuevas dependencias. `verify:demo` levanta un
endpoint local con datos ficticios, compila un segundo perfil en `dist-demo/`,
ejecuta el prerender y comprueba empresa/dispositivo, monedas, ofertas, subruta
y ausencia de identidad de Batikiosco en HTML/configuración/bundle.

`verify:browser` requiere ese build y un Chromium instalado; se puede indicar
su ejecutable con `CATALOG_BROWSER_PATH`. Usa CDP y comprueba 320/360/364 px,
teclado/foco del modal, imágenes fallidas, refresco y recuperación. Sus datos
de API son simulados; no modifica datos reales. El perfil del navegador y la
captura se guardan en `.browser-check/`, ignorado por Git. Requiere Node moderno
con WebSocket global (Node 22 o superior para esta comprobación opcional).

Las referencias restantes a Batikiosco son intencionales: su perfil, el nombre
del perfil predeterminado, assets preservados y pruebas/documentación que
verifican que no se filtren a otros negocios. CUP/USD aparecen en fixtures de
prueba; no son defaults de la lógica de precios.

## Crear y publicar otro catálogo CES con PWA

1. Crear `config/businesses/<perfil>.json` con la estructura completa de Demo.
2. Declarar `business`, `texts` y `seo` del negocio. No copiar identidad ajena.
3. Configurar `syncServerUrl`, `companyId`, `deviceId` y moneda de respaldo.
   Solo el endpoint público del catálogo; no poner API keys ni credenciales.
4. Configurar colores y fuentes en `branding`, y logo/social/categorías en assets.
5. Proporcionar en `pwa.icons` PNG reales de 192x192 y 512x512 con `purpose: any`.
   Opcionalmente añadir PNG maskable con margen seguro. `pwa.shortName` puede
   abreviar el nombre; `name` y `description` derivan del negocio/SEO si se omiten.
   El build valida formato y dimensiones; no toma iconos de otro perfil.
6. Configurar `publicUrl`, por ejemplo `https://dominio.com/catalogo/`. Esa ruta
   determina base, manifest, id, start_url, scope y ubicación del worker.
7. Seleccionar el perfil y ejecutar el build completo:

   ```powershell
   $env:VITE_CATALOG_PROFILE = 'nuevo-negocio'
   npm.cmd run build
   ```

8. Revisar `dist/manifest.webmanifest`, `catalog-build.json`, `sw.js`, identidad,
   iconos, consola y Application/Service Workers en un navegador Chromium.
   Probar una primera carga, recarga offline y actualización en un servidor
   local seguro o HTTPS. La instalación depende del navegador y del dispositivo.
9. Publicar el contenido completo de `dist/` en la URL configurada, conservando
   sus archivos y subdirectorios. GitHub Pages puede servir raíz o subruta.
   No cambiar solo el HTML: manifest, worker y assets forman una misma versión.
   Servir `sw.js` con revalidación (idealmente `Cache-Control: no-cache`) y MIME
   JavaScript; manifest como `application/manifest+json` o JSON. HTTPS requerido
   en producción; localhost permite pruebas. No requiere cabeceras de scope extra.

Para derivar iconos de un logo existente sin redibujarlo:

```text
node scripts/generate-pwa-icons.mjs nuevo-negocio
```

Requiere Chromium local y un perfil configurado. `pwa.iconSource` selecciona
el asset original; si se omite, usa `assets.logo`. Produce PNG 192/512,
maskable 512 y Apple 180 en `public/pwa/<perfil>-*.png`. Declarar los tres
primeros en `pwa.icons`, con propósito `any` o `maskable`, y el cuarto en
`assets.appleTouch`. El build valida el Apple PNG de 180x180 y emite su enlace
con hash y base correctos, tanto en HTML normal como en el shell offline.

Los iconos normales conservan la transparencia del original, con un margen
del 5% por lado. Maskable usa un área central del 55%: incluso las esquinas
de esa área quedan dentro del círculo seguro de radio 40%. Apple usa un área
central del 80%. Ambos tienen fondo opaco derivado de `branding.primaryDark`;
no se redondean ni recortan los PNG porque la plataforma aplica su máscara.
No se elimina blanco incorporado en una imagen fuente: aportar un original
transparente cuando corresponda. Revisar visualmente todos los resultados.
Batikiosco deriva de su `public/icon-512.png` y Demo del SVG CES existente.
No se inventaron logos ni se modificaron los originales.

iOS da prioridad a `apple-touch-icon` sobre los iconos del manifest
([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
El fondo opaco de Apple evita depender del tratamiento de transparencia del
dispositivo; la [guía de Chrome](https://developer.chrome.com/docs/lighthouse/pwa/apple-touch-icon)
también recomienda un fondo no transparente. La zona segura maskable sigue
la [especificación del manifest](https://www.w3.org/TR/appmanifest/#icon-masks).
Después de publicar un cambio, comprobarlo quitando y volviendo a añadir el
acceso en un iPhone real: una instalación existente puede conservar su icono.
Si no existe un logo apropiado, obtenerlo del negocio; no sustituir su identidad.

## Manifest, shell y API

El plugin genera `manifest.webmanifest` usando exclusivamente el perfil resuelto,
con `display: standalone`, idioma, nombres, colores e iconos con hash.
`pwa-assets.json` identifica los archivos de este build (no los sobrantes de
builds anteriores). `catalog-build.json` conserva además la configuración PWA
resuelta. Todo es público: no incluir secretos en ninguna configuración.

Al terminar el prerender, `pwa-build.mjs` genera `offline.html` y `sw.js`.
La versión es un hash del código del worker, configuración y artefactos.
El worker precachea únicamente HTML offline, manifest y assets emitidos por
Rollup: JS, CSS, iconos e imágenes estáticas del perfil. No cachea `index.html`
con sus productos prerenderizados, ni API, fotos dinámicas, Analytics o Sentry.
No hay caché runtime ni almacenamiento de respuestas del backend. Las consultas
de catálogo usan `cache: no-store` también para evitar la caché HTTP del navegador.
Las fuentes externas no se precachean; offline se usan los fallbacks del sistema.

La navegación a la raíz del catálogo o `index.html` consulta primero la red;
si no puede conectarse, abre `offline.html`, sin productos del prerender.
React informa que no puede cargar precios. En una sesión abierta conserva los
datos en memoria, con aviso de última carga cuando falla el refresco. El aviso
no desaparece durante un reintento: solo al recuperar datos correctamente.
Al volver la conexión reintenta automáticamente. No garantiza stock/precios offline.

## Instalación y versiones

La barra de instalación no bloquea el catálogo. Su botón aparece al recibir
`beforeinstallprompt`; consume el evento una sola vez. `appinstalled`, el media
query `display-mode: standalone` y `navigator.standalone` ocultan la invitación.
En iOS muestra instrucciones opcionales mediante el modal accesible existente.
El HTML inicial y el shell offline incluyen `apple-mobile-web-app-capable=yes`
como compatibilidad Apple, además del manifest `display: standalone`.
`apple-mobile-web-app-title` procede de `pwa.shortName`; no del título SEO.
La detección usa `display-mode: standalone` o `navigator.standalone === true`.
No oculta controles del navegador. No se añade `apple-mobile-web-app-status-bar-style`:
su valor predeterminado es suficiente y no determina el modo de ejecución.
[Apple documenta esta señal](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html);
[WebKit también admite el manifest standalone](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

Antes de instalar en iPhone, verificar el destino público real: el HTML debe
enlazar el manifest, este debe devolver JSON con HTTP 200 y `display: standalone`,
y `start_url` debe permanecer dentro de `scope`. Confirmar también `sw.js` con
HTTP 200 y tipo JavaScript. Subir un commit al monorepo no publica automáticamente
el catálogo: desplegar **todo el build `dist/`** en `publicUrl`, incluyendo los
assets con hash. Un HTML anterior sin manifest ni señal Apple se guarda como
marcador; añadir solo metadata local no corrige ese despliegue. No introducir
redirects a destinos fuera del scope. Tras publicar, recargar Safari y quitar y
volver a añadir el acceso anterior. Comprobar físicamente que abre sin la barra
normal de Safari; Chromium no demuestra el comportamiento de instalación iOS.

Otros navegadores sin prompt siguen funcionando y pueden ofrecer instalación
en su propio menú; no se promete soporte donde no existe.

El registro usa el mismo base y `updateViaCache: none`. Comprueba novedades al
abrir y al volver al foco/visibilidad o recuperar red, con un minuto de cooldown.
Una versión instalada en espera muestra «Hay una nueva versión disponible —
Actualizar». Solo al pulsar se envía el mensaje de activación; al cambiar el
controlador esa pestaña recarga una vez. La primera activación no recarga.
El ciclo nativo también puede activar la versión al cerrar todas las pestañas.

La caché se llama `ces-catalog-<hash del base>-<versión>`. Al activar, elimina
solo versiones anteriores del mismo namespace; conserva otros catálogos bajo
subpaths y cachés ajenas. Un precache fallido se elimina y no activa esa versión.
Si se cambia dominio/subpath, cambia la identidad de instalación: es otro destino.

`verify:pwa` usa builds Batikiosco raíz y Demo subruta en Chromium headless.
Verifica manifest/elegibilidad de instalación, worker, responsive, recarga offline,
recuperación de API simulada, actualización y limpieza de caché. iOS/standalone
se simulan; no sustituye probar instalación real en Android, Windows e iOS.
Los artefactos y perfiles de prueba permanecen en `.browser-check/`, ignorado.

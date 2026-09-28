# Implementación de la base CES

Trabajo realizado exclusivamente dentro de `packages/catalog-web`. Sin commit,
push, cambios en paquetes compartidos ni funciones comerciales/PWA. Los assets
identificados como aparentemente sin uso permanecen intactos. El estado global
incluye cambios del otro agente, que no fueron modificados por este trabajo.

## Arquitectura final

- Perfiles completos en `config/businesses/`: Batikiosco predeterminado y demo
  ficticio, con otra empresa, dispositivo, dominio/subruta y branding azul.
- Resolver puro valida configuración y aplica los overrides de Vite. Los textos
  y SEO pueden referenciar nombre, dirección y horario del perfil.
- Plugin de Vite entrega una única configuración a React, al head/SEO y a
  `catalog-build.json`. Emite únicamente los assets del perfil y genera robots
  y sitemap. El prerender utiliza ese archivo, sin resolver entorno otra vez.
- Modelo y cliente HTTP compartidos por React y prerender. Declaraciones TypeScript
  para los módulos ESM usados también por Node; no se debilitó el tsconfig.
- Hook de carga/refresco y modal extraídos de App, manteniendo los componentes
  visuales existentes. No se incorporaron dependencias.

## Bugs corregidos

1. Empresa/servidor distintos entre React y prerender; se incluye deviceId.
2. Moneda del producto sustituida incorrectamente por la base en HTML inicial.
3. Ofertas por cantidad sin mínimo y precio especial en la instantánea; también
   se expresan sus condiciones en datos estructurados.
4. FAQ/dirección/horario mantenidos por separado en HTML, React y script.
5. Peticiones sin timeout, sin reintento y con JSON incompatibles sin explicación.
6. Campos opcionales incompletos que podían romper toda la interfaz. Los productos
   inválidos se omiten con aviso; un catálogo totalmente inválido muestra error útil.
7. Imágenes fallidas sin placeholder; se mantiene la navegación de la galería.
8. Anchos mínimos y overflow de navegación/portada/modal en móviles estrechos.
9. Tarjetas, categorías, filtros e indicadores sin interacción semántica de teclado.
10. Modal sin Escape, control/retorno de foco ni ciclo interno de Tab.
11. Datos indefinidamente antiguos: refresco al recuperar foco/visibilidad cuando
    han pasado cinco minutos, sin polling, con deduplicación y cooldown de 30 s.
12. Fechas futuras tratadas como novedades y categorías con espacios inconsistentes.
13. QR anterior conservado tras cambiar dominio/subruta: ahora se omite en ese caso.

Una actualización fallida conserva los productos anteriores y explica la antigüedad.

## Pruebas y verificaciones

- `npm.cmd run test`: **13/13** pruebas con node:test, sin dependencias nuevas.
  Configuración/overrides, referencias de FAQ, normalización, datos defectuosos,
  monedas, tres tipos de precio/oferta, filtros, novedades, escape HTML/JSON-LD,
  parámetros HTTP, errores, reintento, timeout del fetch/cuerpo y cancelación.
- `npm.cmd run typecheck`: **OK**.
- `npm.cmd run build`: **OK**, incluyendo prerender real de Batikiosco.
  Se recuperaron **51 productos**, todos CUP en esta respuesta real.
- Revisión del HTML real: **51 artículos/51 productos JSON-LD**, 5 FAQ coherentes,
  identidad/empresa correctas, assets locales existentes y cero templates pendientes.
- `npm.cmd run verify:demo`: **OK**, 3 productos ficticios. Verifica 10 USD,
  oferta simple, oferta por cantidad, empresa/dispositivo, subruta y ausencia de
  identidad de Batikiosco en HTML/config/bundles. Cambia intencionadamente las
  variables DESPUÉS del build y confirma que el prerender mantiene su configuración.
- `npm.cmd run verify:browser`: **OK**, Chrome headless en 320/360/364 px.
  Comprueba límites reales de página/modal, placeholder y galería, Enter/Tab/Escape,
  retorno de foco, ausencia de refresco innecesario y recuperación de error de red.
  API ficticia; fuentes externas bloqueadas en esa prueba. Se revisó la captura de 320 px.
- `git diff --check -- packages/catalog-web`: **OK**. Git advierte sobre conversión
  LF/CRLF y acceso al ignore global; no son fallos de código.

El build real y Chrome requirieron ejecución fuera del sandbox por limitaciones
locales de permisos. No se descargaron paquetes ni navegadores.

## Referencias restantes y decisiones pendientes

- **Intencionales:** identidad, empresa, servidor, dirección y horario en el perfil
  de Batikiosco; nombre del perfil predeterminado; imágenes preservadas; pruebas y
  documentación que verifican su aislamiento. No quedan esos datos en la lógica
  de React, precios ni prerender.
- **Intencionales:** CUP/USD en los fixtures y CUP como respaldo explícito del demo.
  La lógica compartida no tiene una moneda predeterminada ni conversiones.
- **Pendiente:** enlaces reales de contacto, todavía no proporcionados. Se mantiene
  el espacio reservado del catálogo actual.
- **Pendiente:** automatización de publicación de GitHub Pages, fuera de esta fase.
- El QR sigue siendo un asset pre-generado. Un perfil nuevo puede aportar el suyo;
  un override de URL omite el QR anterior para evitar un enlace equivocado.
- El HTML es una instantánea de publicación. Si el servidor no responde durante
  el prerender, se publica la información del perfil y se explica la falta de
  productos; React permite cargar/reintentar. No se ofrece funcionamiento offline.
- El modal usa dialog nativo; se comprobó en Chrome, sin una matriz de navegadores
  antiguos ni una auditoría completa con lectores de pantalla.
- El demo es exclusivamente de validación, con noindex; no debe publicarse como
  catálogo real. Sus artefactos y los del navegador están ignorados por Git.
- PWA, notificaciones y funciones comerciales no se implementaron.

## Archivos modificados/eliminados

Las dos fuentes estáticas de robots/sitemap se sustituyeron por generación desde
el perfil; no se borraron imágenes ni assets aparentemente sin uso.

```text
M	packages/catalog-web/index.html
M	packages/catalog-web/package.json
D	packages/catalog-web/public/robots.txt
D	packages/catalog-web/public/sitemap.xml
M	packages/catalog-web/scripts/prerender.mjs
M	packages/catalog-web/src/App.tsx
M	packages/catalog-web/src/api.ts
M	packages/catalog-web/src/components/ErrorBoundary.tsx
M	packages/catalog-web/src/format.ts
M	packages/catalog-web/src/index.css
M	packages/catalog-web/src/main.tsx
M	packages/catalog-web/vite.config.ts
```

## Archivos nuevos de esta implementación

Se excluyen del listado las dos imágenes no rastreadas que ya existían al comenzar.

```text
packages/catalog-web/.gitignore
packages/catalog-web/IMPLEMENTATION_REPORT.md
packages/catalog-web/README.md
packages/catalog-web/config/businesses/batikiosco.json
packages/catalog-web/config/businesses/demo.json
packages/catalog-web/scripts/catalog-plugin.d.mts
packages/catalog-web/scripts/catalog-plugin.mjs
packages/catalog-web/scripts/verify-browser.mjs
packages/catalog-web/scripts/verify-demo.mjs
packages/catalog-web/src/catalog/config.d.mts
packages/catalog-web/src/catalog/config.mjs
packages/catalog-web/src/catalog/html.d.mts
packages/catalog-web/src/catalog/html.mjs
packages/catalog-web/src/catalog/model.d.mts
packages/catalog-web/src/catalog/model.mjs
packages/catalog-web/src/catalog/request.d.mts
packages/catalog-web/src/catalog/request.mjs
packages/catalog-web/src/catalog/runtime.ts
packages/catalog-web/src/catalog/types.ts
packages/catalog-web/src/components/Modal.tsx
packages/catalog-web/src/hooks/useCatalog.ts
packages/catalog-web/src/vite-env.d.ts
packages/catalog-web/tests/catalog.test.mjs
```

## git diff --stat (global, incluye trabajo ajeno)

Git no incluye los archivos nuevos no rastreados en este comando.

```text
packages/catalog-web/index.html                    | 141 +-------
 packages/catalog-web/package.json                  |   6 +-
 packages/catalog-web/public/robots.txt             |   4 -
 packages/catalog-web/public/sitemap.xml            |  15 -
 packages/catalog-web/scripts/prerender.mjs         | 152 ++-------
 packages/catalog-web/src/App.tsx                   | 379 +++++++++------------
 packages/catalog-web/src/api.ts                    |  84 +----
 .../catalog-web/src/components/ErrorBoundary.tsx   |   8 +-
 packages/catalog-web/src/format.ts                 |   6 +-
 packages/catalog-web/src/index.css                 |  74 +++-
 packages/catalog-web/src/main.tsx                  |   9 +-
 packages/catalog-web/vite.config.ts                |  17 +-
 packages/core/src/services/posPullService.ts       |  78 +++++
 .../src/renderer/src/pages/pos/PosSourceForm.tsx   | 113 ++++--
 packages/desktop/vitest.config.ts                  |  11 +-
 packages/pos-web/package.json                      |   6 +-
 packages/pos-web/src/components/InstallGate.tsx    | 163 +++++----
 packages/pos-web/src/index.css                     |  15 +-
 packages/pos-web/src/lib/installState.ts           |  73 +++-
 packages/pos-web/src/main.tsx                      |   8 +-
 packages/shop-web/src/components/InstallGate.tsx   | 167 +++++----
 packages/shop-web/src/index.css                    |  15 +-
 packages/shop-web/src/lib/installState.test.ts     |  79 +++++
 packages/shop-web/src/lib/installState.ts          |  68 +++-
 packages/shop-web/src/main.tsx                     |   8 +-
 packages/sync-server/src/routes/health.ts          |  78 ++++-
 26 files changed, 959 insertions(+), 818 deletions(-)
```

## git diff --stat -- packages/catalog-web

```text
packages/catalog-web/index.html                    | 141 +-------
 packages/catalog-web/package.json                  |   6 +-
 packages/catalog-web/public/robots.txt             |   4 -
 packages/catalog-web/public/sitemap.xml            |  15 -
 packages/catalog-web/scripts/prerender.mjs         | 152 ++-------
 packages/catalog-web/src/App.tsx                   | 379 +++++++++------------
 packages/catalog-web/src/api.ts                    |  84 +----
 .../catalog-web/src/components/ErrorBoundary.tsx   |   8 +-
 packages/catalog-web/src/format.ts                 |   6 +-
 packages/catalog-web/src/index.css                 |  74 +++-
 packages/catalog-web/src/main.tsx                  |   9 +-
 packages/catalog-web/vite.config.ts                |  17 +-
 12 files changed, 279 insertions(+), 616 deletions(-)
```

## git status -sb (global, instantánea al entregar)

Los cambios fuera de catalog-web corresponden al trabajo concurrente y no fueron
editados, revertidos, staged ni incluidos en commits por esta implementación.

```text
## main...origin/main [ahead 2]
 M packages/catalog-web/index.html
 M packages/catalog-web/package.json
 D packages/catalog-web/public/robots.txt
 D packages/catalog-web/public/sitemap.xml
 M packages/catalog-web/scripts/prerender.mjs
 M packages/catalog-web/src/App.tsx
 M packages/catalog-web/src/api.ts
 M packages/catalog-web/src/components/ErrorBoundary.tsx
 M packages/catalog-web/src/format.ts
 M packages/catalog-web/src/index.css
 M packages/catalog-web/src/main.tsx
 M packages/catalog-web/vite.config.ts
 M packages/core/src/services/posPullService.ts
 M packages/desktop/src/renderer/src/pages/pos/PosSourceForm.tsx
 M packages/desktop/vitest.config.ts
 M packages/pos-web/package.json
 M packages/pos-web/src/components/InstallGate.tsx
 M packages/pos-web/src/index.css
 M packages/pos-web/src/lib/installState.ts
 M packages/pos-web/src/main.tsx
 M packages/shop-web/src/components/InstallGate.tsx
 M packages/shop-web/src/index.css
 M packages/shop-web/src/lib/installState.test.ts
 M packages/shop-web/src/lib/installState.ts
 M packages/shop-web/src/main.tsx
 M packages/sync-server/src/routes/health.ts
?? .claude/settings.local.json
?? SISTEMA_CES_CONTEXTO.md
?? packages/catalog-web/.gitignore
?? packages/catalog-web/IMPLEMENTATION_REPORT.md
?? packages/catalog-web/README.md
?? packages/catalog-web/config/
?? packages/catalog-web/scripts/catalog-plugin.d.mts
?? packages/catalog-web/scripts/catalog-plugin.mjs
?? packages/catalog-web/scripts/verify-browser.mjs
?? packages/catalog-web/scripts/verify-demo.mjs
?? "packages/catalog-web/src/assets/BATIKIOSCO_shipping_container_lo\342\200\246_2K_202608261449.jpeg"
?? packages/catalog-web/src/assets/image-1787779252377.jpg
?? packages/catalog-web/src/catalog/
?? packages/catalog-web/src/components/Modal.tsx
?? packages/catalog-web/src/hooks/
?? packages/catalog-web/src/vite-env.d.ts
?? packages/catalog-web/tests/
?? packages/core/tests/integration/posSourceForeignAccounts.test.ts
?? packages/desktop/src/renderer/src/lib/remoteSourceFields.test.ts
?? packages/desktop/src/renderer/src/lib/remoteSourceFields.ts
?? packages/pos-web/src/lib/db.test.ts
?? packages/pos-web/src/lib/installState.test.ts
?? packages/pos-web/vitest.config.ts
?? packages/sync-server/src/routes/health.test.ts
```

# Fase PWA reutilizable de CES

## Arquitectura y alcance

La auditoría encontró React 18/Vite 5, perfiles completos, assets seleccionados
por plugin y prerender basado en `catalog-build.json`; no había PWA previa.
Se preservan esos puntos de configuración. No se agregan dependencias, funciones
comerciales, despliegues ni cambios fuera de `packages/catalog-web`.
`IMPLEMENTATION_REPORT.md` conserva el registro histórico de la fase anterior.

El perfil declara `pwa.shortName`, iconos y, opcionalmente, nombre y descripción.
La resolución deriva estos últimos de business/SEO. El plugin valida iconos PNG
192/512, emite sus URLs con hash, manifest y un inventario del build actual.
El prerender sigue leyendo exactamente la configuración sellada por Vite.
Al finalizar genera el shell offline sin productos y el worker versionado.

## Caché y datos

Lista cerrada de shell offline, manifest y assets Rollup. Versión derivada del
contenido; namespace derivado del base. Activación limpia exclusivamente sus
versiones anteriores, sin borrar otros subpaths ni cachés ajenas.
Un fallo de precache no activa una versión parcial.

No se persiste API, productos, precios, fotos dinámicas, Analytics, Sentry ni
HTML prerenderizado con productos. Navegación por red con fallback al shell
offline. `fetch` del catálogo usa `no-store` para evitar caché HTTP también.
Sin red: shell y branding disponibles tras instalación del worker; ninguna
garantía de productos/precios. En una sesión ya abierta se conserva memoria y
se avisa de última carga; el error persiste mientras reintenta. Recuperar red
inicia un reintento. Fuentes externas usan fallback local del sistema offline.

## Instalación y actualización

Botón opcional después de `beforeinstallprompt`; eventos consumidos una vez.
Sin interrumpir montaje, carga o navegación del catálogo. iOS tiene instrucciones
manuales en el modal nativo existente. Detección standalone vía media query y
propiedad iOS; `appinstalled` oculta la invitación.

Registro con scope/base y `updateViaCache: none`. Comprueba cambios al iniciar,
recuperar conexión, foco o visibilidad, con cooldown de un minuto. Worker nuevo
en espera: muestra Actualizar. Aceptar activa y recarga una única vez; instalación
inicial no recarga. También se conserva la activación natural al cerrar pestañas.

## Iconos e identidad

Batikiosco: derivados del PNG 512 existente del negocio. Demo: rasterización
del SVG CES existente. Cada perfil cuenta con PNG 192, PNG 512 y maskable 512.
El maskable conserva el arte en una caja centrada del 55%, dentro del círculo
seguro, sobre fondo blanco. Los seis PNG se revisaron por dimensiones; las
imágenes principales se inspeccionaron visualmente. No se generaron logos nuevos.
El script reutilizable requiere Chromium y escribe solo dentro de este paquete.

## Verificación

- `npm.cmd run test`: 26 tests aprobados, incluyendo los 13 existentes.
- `npm.cmd run typecheck`: aprobado.
- `npm.cmd run build`: Batikiosco por defecto, raíz `/`, 51 productos reales
  prerenderizados, SEO/manifest/iconos/worker coherentes.
- `npm.cmd run verify:demo`: build/prerender con 3 productos ficticios, subruta
  `/negocio/`, monedas y ofertas coherentes, sin identidad Batikiosco en HTML,
  config, manifest, worker, inventario ni JS/CSS/SVG.
- `npm.cmd run verify:browser`: 320/360/364 px, modal Enter/Tab/Escape,
  retorno de foco, fotos fallidas, refresco y recuperación.
- `npm.cmd run verify:pwa`: Chromium real sobre ambos builds: manifest sin
  errores, elegibilidad de instalación sin errores, service worker/scope,
  320/360/364/768/1280 px, botones y teclado, recarga offline sin productos,
  recuperación, update waiting/aceptación/una recarga, limpieza de caché propia,
  conservación de namespaces ajenos, instrucciones y standalone iOS simulados.
  Sin excepciones JS ni llamadas console.error de aplicación.
- Revisión completa de fuentes nuevas y diff, más `git diff --check`.

Tests adicionales cubren hash/versionado real, exclusión de artefactos sobrantes,
paths raíz/subruta, bloqueo de precache incompleto, peticiones API/autenticadas
fuera de la caché, consumo del prompt y ausencia de recarga inicial/loops.

## Seguridad y trabajo concurrente

Solo información pública del perfil llega a manifest/worker/bundle. Worker no
incluye credenciales ni endpoints administrativos. Los ejemplos `/admin/private`
y tokens ficticios solo existen en tests para verificar que no se interceptan.
El DSN público de Sentry y Analytics existentes permanecen sin proyectos nuevos.
No se modifican ni incluyen imágenes untracked preexistentes, archivos personales
ni trabajo concurrente de core. Staging exclusivamente mediante lista explícita.

## Límites reales

La instalación OS real en Android/Windows/iOS y despliegue HTTPS no se verificaron
desde este entorno headless. Chromium confirmó elegibilidad y emitió el evento
nativo, pero la aceptación/cancelación se probó con eventos controlados; iOS fue
simulado. La compatibilidad final depende del navegador. No hubo push/despliegue.
Offline requiere primera carga con precache exitoso y almacenamiento disponible;
el navegador puede expulsar cachés. No se sincronizan ni persisten productos.
Para nueva publicación se deben desplegar juntos HTML, worker, manifest y assets,
con revalidación de `sw.js`; README describe el proceso y los subpaths.

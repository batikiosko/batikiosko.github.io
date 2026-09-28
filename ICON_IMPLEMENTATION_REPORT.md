# Corrección de iconos PWA CES

## Causa comprobada

El original seleccionado por Batikiosco, `public/icon-512.png`, tiene alpha
real. El generador anterior llenaba todos los lienzos con blanco antes de
dibujar: los PNG normales perdían transparencia. Por separado, el HTML enlazaba
el antiguo `public/apple-touch-icon.png`, un PNG RGB de 180 px con blanco ya
incorporado. Este era el archivo preferido por iOS, no el icono del manifest.
No se modificó ninguno de los originales ni se redibujó el logo.

## Inspección anterior

Todas las imágenes son PNG. Las coordenadas son inclusivas: izquierda, arriba,
derecha, abajo. Las cuatro esquinas coincidían; RGBA indica el valor de cada una.
La caja describe píxeles visibles para fuentes transparentes y píxeles distintos
del fondo para imágenes opacas. «Alpha» distingue canal/transparencia efectiva.

| Archivo | Tamaño | Alpha | Píxeles totalmente transparentes | Esquina RGBA | Caja de contenido |
| --- | --- | --- | ---: | --- | --- |
| public/icon-512.png | 512×512 | RGBA / sí | 94511 | 0,0,0,0 | 2,33,510,497 |
| src/assets/logo-batikiosco-transparent.png | 900×818 | paleta+tRNS / sí | 315340 | 76,105,113,0 | 0,0,899,817 |
| public/apple-touch-icon.png | 180×180 | RGB / no | 0 | 255,255,255,255 | 0,10,179,176 |
| public/pwa/batikiosco-192.png | 192×192 | RGBA / no | 0 | 255,255,255,255 | 10,21,181,176 |
| public/pwa/batikiosco-512.png | 512×512 | RGBA / no | 0 | 255,255,255,255 | 27,55,485,473 |
| public/pwa/batikiosco-maskable-512.png | 512×512 | RGBA / no | 0 | 255,255,255,255 | 116,133,395,388 |
| public/pwa/demo-192.png | 192×192 | RGBA / no | 0 | 255,255,255,255 | 9,9,182,182 |
| public/pwa/demo-512.png | 512×512 | RGBA / no | 0 | 255,255,255,255 | 25,25,486,486 |
| public/pwa/demo-maskable-512.png | 512×512 | RGBA / no | 0 | 255,255,255,255 | 115,115,396,396 |

Demo usa el SVG CES existente, con fondo transparente; el blanco anterior
también procedía del generador.

## Arquitectura y resultado

`generate-pwa-icons.mjs <perfil>` carga el mismo perfil que el build. La fuente
es `pwa.iconSource`, con fallback a `assets.logo`. Batikiosco conserva como
fuente `public/icon-512.png`; Demo conserva su SVG CES. No hay condiciones por
nombre de negocio. El fondo opaco deriva de `branding.primaryDark`, sin añadir
otra configuración de color: rojo `#C62828` y azul `#0D47A1`, respectivamente.

El ajuste conserva proporciones y centra la imagen completa. Los normales usan
90% del lienzo y no reciben relleno. Maskable usa 55%: la totalidad del cuadrado
central cabe dentro de la zona segura circular de radio 40%. Apple usa 80%.
Las dos últimas variantes tienen fondo opaco; las plataformas aplican sus
máscaras. No se recortan ni redondean previamente los PNG.

Los perfiles enlazan su nuevo Apple 180 en `assets.appleTouch`; el HTML declara
`sizes="180x180"`. El plugin valida dimensiones y emite los assets con hash y
base correctos. Manifest y propósito maskable conservan la arquitectura previa.
El PNG antiguo de Apple queda preservado, pero no se emite ni se enlaza.

### PNG finales

Todos son PNG RGBA de 8 bits. Los opacos conservan canal alpha, pero todos sus
valores alpha son 255. Esquinas transparentes: `0,0,0,0`; esquinas rojas:
`198,40,40,255`; esquinas azules: `13,71,161,255`.

| Archivo en public/pwa/ | Tamaño | Transparentes / alpha parcial | Esquinas | Caja de contenido |
| --- | --- | --- | --- | --- |
| batikiosco-192.png | 192×192 | 17600 / 1456 | transparentes | 10,21,181,176 |
| batikiosco-512.png | 512×512 | 125656 / 7699 | transparentes | 27,55,485,473 |
| batikiosco-maskable-512.png | 512×512 | 0 / 0 | rojas | 116,133,395,388 |
| batikiosco-apple-180.png | 180×180 | 0 / 0 | rojas | 19,27,161,157 |
| demo-192.png | 192×192 | 11899 / 1202 | transparentes | 9,9,182,182 |
| demo-512.png | 512×512 | 88221 / 2694 | transparentes | 25,25,486,486 |
| demo-maskable-512.png | 512×512 | 0 / 0 | azules | 115,115,396,396 |
| demo-apple-180.png | 180×180 | 0 / 0 | azules | 18,18,161,161 |

El inspector Node lee píxeles reales; los tests no comparan PNG byte por byte.

## Verificación

- `npm.cmd run test`: 33/33. Siete pruebas nuevas cubren alpha real, dimensiones,
  centrado/márgenes, color opaco, todos los píxeles del contenido dentro de la
  zona segura, propósito maskable, Apple por perfil, HTML raíz/subruta e identidad.
- `npm.cmd run typecheck`: correcto.
- `npm.cmd run build`: Batikiosco correcto, prerender de 51 productos reales.
- `npm.cmd run verify:demo`: correcto, tres productos ficticios, subruta
  `/negocio/`, sin contaminación de identidad en artefactos del perfil.
- `npm.cmd run verify:browser`: correcto, 320/360/364 px e interacciones existentes.
- `npm.cmd run verify:pwa`: correcto para ambos builds; inspección de PNG emitidos,
  manifest/elegibilidad, worker/scope, instalación opcional, responsive,
  offline/recuperación, actualización con una recarga y limpieza de cachés.
- Inspección visual de ambos perfiles: logo completo, centrado, sin blanco
  artificial; máscaras círculo, cuadrado redondeado y squircle sin recortes.
- `git diff --check`: correcto.

Las comprobaciones del navegador generan hojas visuales en `.browser-check/`,
ignorado. La verificación usa Chromium real; iOS/standalone se simulan para UI.
No se modifican caché/API/instalación ni otros componentes de la PWA.
No se añaden credenciales, endpoints ni datos privados.

## iOS y límites de plataforma

[WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
documenta que `apple-touch-icon` tiene prioridad sobre manifest.
[Apple](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
documenta su selección y tamaños.
[Chrome](https://developer.chrome.com/docs/lighthouse/pwa/apple-touch-icon)
recomienda fondo no transparente para Apple Touch Icon. El tratamiento de alpha
puede depender de versión y plataforma; no se promete transparencia del tile
en iOS. Se utiliza el fondo de marca controlado, sin hacks.
La zona segura Android sigue [W3C](https://www.w3.org/TR/appmanifest/#icon-masks).

Se espera un tile rojo con el logo original en iOS. Tras publicar, quitar y
volver a añadir en un iPhone real para evitar el icono anterior conservado por
la instalación. Esa comprobación física no está disponible en este entorno.
Android puede añadir estilos propios del launcher; se garantiza la zona segura
del archivo, no una apariencia idéntica entre dispositivos. No se hizo push.

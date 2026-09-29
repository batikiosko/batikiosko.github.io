# Batikiosco Catalog Receiver

Este repositorio no contiene el source canónico del catálogo. El engine y el source canónico forman parte de CES.

## Branches

- `main` contiene exclusivamente la infraestructura y la identidad del receptor.
- `catalog-dist` contiene el historial inmutable de releases estáticas aprobadas.

## Deployment

El único procedimiento normal de publicación es `.github/workflows/catalog-pages.yml`.

El workflow recibe un SHA completo perteneciente a `catalog-dist`, valida la release y publica exactamente su directorio `site/`. No recompila el catálogo ni consulta el backend para generar contenido.

No deben realizarse builds manuales desde este repositorio.

## Source

El source canónico se mantiene en el repositorio privado CES, dentro de `packages/catalog-web`.

No añadas URLs privadas ni secretos a este repositorio.

## Safety

- No reescribir `catalog-dist`.
- No hacer force push.
- No reconstruir releases históricas.
- Los cambios en producción deben proceder de releases CES aprobadas.
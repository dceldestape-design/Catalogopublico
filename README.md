# Catálogo cliente

Este directorio es la vitrina pública. Solo debe alojar `public_catalog_data.js`,
el cual contiene código, nombre, foto y clasificación del producto.

Para regenerar el archivo base desde los datos internos:

```powershell
node .\build_public_catalog.js
```

El panel administrativo permite preparar configuraciones por vendedor y descargar
un `public_catalog_data.js` con sus WhatsApps y ofertas. Ese archivo es el que se
debe publicar mediante el Apps Script público independiente.

Nunca se debe apuntar este catálogo a `shared-data/catalog_bundle.json`, al Apps
Script privado, ni a una hoja que contenga precios, inventario, descuentos o clientes.

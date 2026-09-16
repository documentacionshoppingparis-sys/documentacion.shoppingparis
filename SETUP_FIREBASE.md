# Configuración Firebase

## Primer administrador
Crear el usuario en Firebase Authentication y luego crear manualmente:

Colección: `usuarios`
Documento ID: el UID del usuario de Authentication

Campos:
- `nombre`: nombre del administrador
- `rol`: `admin`
- `activo`: `true`

## Colecciones utilizadas
- usuarios
- empresas
- tiendas
- sectores
- personas
- responsables
- proveedores
- documentos
- contadores

## Sectores iniciales sugeridos
No se cargan automáticamente para que el sistema sea administrable desde cero:
- Operacional
- Servicios Generales
- Electromecánica
- Seguridad
- Marketing
- Tesorería
- RR.HH.
- Comercial
- Obras

## Importante
Los documentos emitidos contienen snapshots de empresa, tienda, sector, proveedor y responsables. Por ello un cambio posterior en los maestros no altera el documento histórico.

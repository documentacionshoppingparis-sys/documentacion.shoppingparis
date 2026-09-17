# Changelog

Formato basado en versionado semántico (`MAJOR.MINOR.PATCH`):
- **Patch:** correcciones.
- **Minor:** nuevas funcionalidades.
- **Major:** cambios estructurales importantes.

## [1.0.0] - 2026-09-16

### Agregado
- Estructura inicial del repositorio: `index.html`, `firebase-config.js`,
  `permissions.js`, `app.js`, `styles.css`, `firestore.rules`.
- Login con Firebase Authentication y verificación de usuario activo.
- Maestros con baja lógica: Empresas, Tiendas/Sucursales, Sectores,
  Personas/Responsables, Proveedores, Usuarios.
- Documentos transaccionales: Presupuesto de Proveedor, Orden de Pago
  (Productos / Servicios / RR.HH. / Funcionarios) y Orden de Cobro, con
  numeración secuencial atómica y copia histórica de responsables.
- Generación de PDF por documento con jsPDF.
- Dashboard con indicadores generales y totales por empresa.
- Historial/Consultas con filtros.
- Registro de auditoría de acciones.
- Reglas de seguridad de Firestore por rol y estado de usuario.
- Documentación: `README.md`, `SETUP_FIREBASE.md`, `CHANGELOG.md`.

## [1.0.1] - 2026-09-16

### Corregido
- `index.html`: se fijan versiones exactas de React, ReactDOM y Babel
  Standalone, y `app.js` se carga y transforma manualmente con `fetch` +
  `Babel.transform` en lugar del scanner automático de scripts externos
  (`<script type="text/babel" src="...">`), que era la causa de la pantalla
  en blanco con error "Cannot use import statement outside a module".
  Además, ahora un fallo de carga se muestra en pantalla en vez de dejarla
  en blanco.

### Cambiado
- Se elimina "Orden de Pago - Funcionarios" como tipo documental separado
  y se integra dentro de "Orden de Pago - RR.HH.", distinguiéndose por el
  campo `concepto` (Pago a funcionario, Comisión, Incentivo, Bonificación,
  Otro), conforme a la sección 13 del documento maestro.

## [1.0.2] - 2026-09-16

### Agregado
- Campo "Logo" en el registro de Empresas (Maestros > Empresas): carga de
  imagen (PNG/JPEG/WEBP, hasta 400 KB) con vista previa, guardado como
  imagen embebida en el propio documento de Firestore.
- El PDF de cada documento (Presupuesto, Órdenes de Pago, Orden de Cobro)
  ahora incluye en el encabezado el logo, la razón social, el RUC y la
  dirección de la empresa emisora correspondiente.

### Nota
- El encabezado del PDF es un formato único y consistente para todos los
  documentos; todavía no reproduce de forma exacta cada uno de los
  distintos formatos históricos en papel (presupuesto, orden de pago de
  productos/servicios/RR.HH., orden de cobro), que tienen diseños entre
  sí distintos.

## [1.0.3] - 2026-09-16

### Agregado
- Campo "Código" (numérico) en el maestro de Sectores. Los sectores se
  listan y se muestran en toda la aplicación como "código - nombre"
  (ej. "5 - TESORERIA"), y se ordenan por código.
- `seed-sectores.html`: página independiente para cargar, una sola vez,
  los 9 sectores iniciales con su código (0 Operacional, 1 Servicios
  Generales, 2 Electromecánica, 3 Seguridad, 4 Marketing, 5 Tesorería,
  7 RRHH, 8 Comercial, 9 Obras — el código 6 no existe en el listado
  original). Requiere iniciar sesión con un usuario administrador y
  omite los códigos que ya existan, para poder ejecutarse más de una vez
  sin duplicar.

## [1.0.4] - 2026-09-16

### Cambiado
- El número de Presupuesto, Orden de Pago y Orden de Cobro ahora se
  reserva en el momento de abrir el formulario "Nuevo" (como una hoja
  numerada de talonario) y se muestra en el encabezado del formulario
  desde el inicio, en vez de asignarse recién al guardar. Si el usuario
  cancela sin guardar, ese número queda saltado (no se reutiliza),
  igual que en un formulario de papel anulado.

## [1.0.5] - 2026-09-16

### Corregido
- El combo de Sector en Presupuestos, Órdenes de Pago y Órdenes de Cobro
  no mostraba opciones: la consulta a Firestore ordenaba por el campo
  `codigo`, lo que excluye silenciosamente cualquier sector que no tenga
  ese campo cargado. El ordenamiento por código ahora se hace en el
  cliente (en Sectores, Personas y en los selects de documentos), para
  que ningún sector quede oculto aunque le falte el código.

### Agregado
- La versión del sistema (v{APP_VERSION}) ahora se muestra siempre
  visible en el encabezado del panel lateral, además del pie de página.

## [1.0.6] - 2026-09-16

### Agregado
- Campo "Vendedor" en el formulario de Presupuesto de Proveedor (dato
  propio de cada presupuesto, no del maestro de Proveedores, porque
  puede variar según la compra).
- PDF dedicado para el Presupuesto de Proveedor (`generarPDFPresupuesto`),
  que replica el formato en papel de Shopping Paris: logo, caja de N.º y
  fecha, fila Proveedor/Vendedor, fila Dirección/Celular, tabla de
  detalle con bordes, fila de observaciones en rojo, "Condiciones del
  Presupuesto", los dos textos legales fijos del formulario original y
  la caja de firma "Solicitado por" con el cargo y el nombre del
  solicitante.

### Nota
- Los demás documentos (Órdenes de Pago y Orden de Cobro) siguen usando
  el encabezado genérico por ahora; se irán migrando a su propio formato
  uno por uno.

## [1.0.8] - 2026-09-16

### Corregido
- El logo (de empresa o tienda) salía deformado en el PDF del
  Presupuesto porque se insertaba forzado a un tamaño fijo. Ahora se
  calcula la proporción real de la imagen antes de insertarla, para que
  se vea sin estirarse ni achatarse.
- Se corrige el versionado: la constante `APP_VERSION` (visible en el
  panel lateral) no se venía actualizando en los últimos cambios; queda
  sincronizada con este changelog.

### Agregado
- Columna "Tienda" en el listado de Presupuestos de Proveedor, para
  poder ver de un vistazo qué sucursal registró cada uno (antes solo se
  veía la empresa).

## [1.0.9] - 2026-09-16

### Agregado
- Botón "Ver" en el listado de Presupuestos de Proveedor (junto a PDF,
  Aprobar, Rechazar): abre una vista de detalle de solo lectura con
  todos los datos del presupuesto (empresa, tienda, sector, proveedor,
  vendedor, solicitante, condiciones, observaciones, detalle de líneas
  y total), con un botón para generar el PDF desde ahí mismo.

## [1.1.0] - 2026-09-16

### Agregado
- `index.html`: se agrega SheetJS (lectura de archivos Excel en el
  navegador) vía CDN.
- En "Nueva Orden de Pago - RR.HH.", cuando el Concepto elegido es
  "Comisión", aparece un botón "Importar Excel" que carga una planilla
  (.xlsx) con el formato: N°, NRODOC, APELLIDOS, NOMBRES, CARGO, FECHA
  INGRESO, TIPO COMP, CENTRO DE COSTO, SUCURSAL, CM. Cada fila se
  convierte en una línea del detalle (funcionario + documento + cargo +
  sucursal, con el importe de la columna CM), reemplazando las líneas
  que hubiera cargadas manualmente. Si el archivo no tiene el formato
  esperado, se muestra un aviso en vez de fallar en silencio.

## [1.0.7] - 2026-09-16

### Agregado
- Campo "Logo" también en el maestro de Tiendas/Sucursales (Maestros >
  Tiendas / Sucursales), para las sucursales que tienen su propio logo
  distinto al de la empresa matriz (ej. "Punto Eléctrico" dentro de
  K&K Shopping's).
- El PDF del Presupuesto de Proveedor ahora usa el logo de la tienda/
  sucursal seleccionada si tiene uno cargado; si no, usa el logo de la
  empresa.

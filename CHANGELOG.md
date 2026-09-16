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

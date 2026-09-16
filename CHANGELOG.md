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

# Sistema Administrativo Multiempresa

Aplicación web para gestionar la documentación administrativa (presupuestos,
órdenes de pago y órdenes de cobro) de múltiples empresas desde un único
sistema, con historial completo, trazable y estructurado en Firestore.

> **Regla central:** el PDF es una representación del documento; el
> verdadero documento administrativo es el registro estructurado, trazable
> e histórico almacenado en la base de datos.

## Arquitectura

Aplicación web estática, sin proceso de build, servida desde GitHub Pages:

```
GitHub → GitHub Pages → Navegador → Firebase Authentication + Firestore
```

- **Frontend:** HTML + CSS + JavaScript, React 18 y ReactDOM vía CDN,
  JSX transformado en el navegador con Babel Standalone.
- **Backend:** ninguno propio. Firebase Authentication (email/contraseña)
  y Firestore, protegidos con Security Rules.
- **PDF:** generado del lado del navegador con jsPDF, a partir de los
  datos ya guardados en Firestore.

## Estructura de archivos

| Archivo               | Contenido                                                        |
|------------------------|-------------------------------------------------------------------|
| `index.html`           | Carga las librerías y los archivos de la app en el orden correcto |
| `firebase-config.js`   | Configuración e inicialización de Firebase (app principal + secundaria) |
| `permissions.js`       | Matriz de roles y permisos (solo UX; la seguridad real va en `firestore.rules`) |
| `app.js`                | Componentes React, navegación y lógica de negocio                |
| `styles.css`            | Sistema visual de la aplicación                                  |
| `firestore.rules`      | Reglas de seguridad reales de Firestore                          |
| `SETUP_FIREBASE.md`    | Pasos para configurar el proyecto Firebase y el primer admin      |
| `CHANGELOG.md`         | Historial de versiones                                            |

## Módulos implementados en esta versión (1.0.0)

- Login con Firebase Authentication y verificación de usuario activo.
- Maestros con baja lógica (activo/inactivo, nunca borrado físico):
  Empresas, Tiendas/Sucursales, Sectores, Personas/Responsables, Proveedores.
- Administración de Usuarios (creación vía instancia secundaria de
  Authentication, para no perder la sesión del admin).
- Documentos transaccionales con numeración secuencial atómica
  (`contadores/` + `runTransaction`) y copia histórica de responsables:
  - Presupuesto de Proveedor
  - Orden de Pago de Productos / Servicios / RR.HH. / Funcionarios
    (componente único parametrizado por `tipo`, para no duplicar código
    entre tipos muy similares)
  - Orden de Cobro
- Generación de PDF por documento (jsPDF).
- Dashboard con indicadores básicos y totales por empresa.
- Historial/Consultas con filtros por tipo, empresa y estado.
- Registro de auditoría (`auditoria/`) en cada creación y cambio de estado.

## Próximos pasos sugeridos (no incluidos en esta primera etapa)

Ver sección "Evolución futura" del documento maestro del proyecto:
niveles de aprobación por importe, centros de costo, adjuntos, reportes
gerenciales, exportación a Excel, notificaciones, firma electrónica,
restricciones de acceso por empresa/tienda/sector, entre otros.

## Puesta en marcha

1. Seguí `SETUP_FIREBASE.md` para crear el proyecto Firebase (o usar el
   existente `docshoppingparis`), habilitar Authentication y Firestore,
   publicar `firestore.rules` y crear el primer usuario administrador.
2. Completá `apiKey` en `firebase-config.js`.
3. Subí el repositorio a GitHub y habilitá GitHub Pages (rama y carpeta raíz).
4. Autorizá el dominio de GitHub Pages en Firebase Authentication
   (Authentication → Settings → Authorized domains).
5. Iniciá sesión con el usuario administrador creado en el paso 1.

No hay `npm install` ni paso de compilación: es abrir `index.html` (o
publicarlo en GitHub Pages) y listo.

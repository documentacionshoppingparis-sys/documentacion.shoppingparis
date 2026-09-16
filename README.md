# Sistema Administrativo Multiempresa

Aplicación interna para gestionar empresas, tiendas/sucursales, sectores, responsables, proveedores, presupuestos, órdenes de pago y órdenes de cobro, manteniendo historial administrativo y generación de PDF.

## Arquitectura
- GitHub Pages (hosting estático)
- React 18 UMD + Babel Standalone
- Firebase Authentication
- Cloud Firestore
- Firestore Security Rules
- jsPDF para documentos PDF
- Sin Node/npm/build/backend propio

## Puesta en marcha
1. Crear un proyecto Firebase.
2. Habilitar Authentication > Email/Password.
3. Crear Firestore.
4. Copiar la configuración Web de Firebase a `firebase-config.js`.
5. Publicar `firestore.rules` desde Firebase Console.
6. Crear manualmente el primer usuario en Authentication y su documento `usuarios/{uid}` con rol `admin`.
7. Subir estos archivos a la raíz de un repositorio GitHub.
8. Activar GitHub Pages desde la rama principal y carpeta raíz.
9. Agregar el dominio de GitHub Pages a Authentication > Authorized domains.

## Modelo inicial
Los maestros (empresas, tiendas, sectores, personas, asignaciones y proveedores) pueden modificarse/desactivarse. Los documentos administrativos se guardan como registros históricos y, una vez emitidos, no se editan ni eliminan. Las correcciones deben realizarse anulando el documento y emitiendo uno nuevo relacionado.

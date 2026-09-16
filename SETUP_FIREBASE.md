# Configuración de Firebase

## 1. Proyecto Firebase

El proyecto previsto para esta aplicación es:

```
Project ID: docshoppingparis
Auth Domain: docshoppingparis.firebaseapp.com
Storage Bucket: docshoppingparis.firebasestorage.app
Messaging Sender ID: 401673194386
App ID: 1:401673194386:web:fad2464f43437441884f4b
Measurement ID: G-HVJ549FXT2
```

Si vas a usar este proyecto existente, andá a la [consola de Firebase](https://console.firebase.google.com/),
seleccioná `docshoppingparis` → ⚙️ Configuración del proyecto → tus apps →
copiá el valor de `apiKey` y pegalo en `firebase-config.js`.

Si preferís crear un proyecto nuevo, creá uno en la consola y reemplazá
todos los valores de `firebaseConfig` en `firebase-config.js` por los de
tu propio proyecto.

## 2. Habilitar Authentication

1. Consola de Firebase → **Authentication** → **Sign-in method**.
2. Habilitá el proveedor **Correo electrónico/contraseña**.

## 3. Habilitar Firestore

1. Consola de Firebase → **Firestore Database** → **Crear base de datos**.
2. Elegí modo producción (las reglas reales están en `firestore.rules`).
3. Elegí la región más cercana.

## 4. Publicar las reglas de seguridad

1. Firestore Database → pestaña **Reglas**.
2. Pegá el contenido de `firestore.rules` de este repositorio.
3. Publicá.

> Mientras no publiques reglas restrictivas, Firestore usa reglas por
> defecto que **bloquean todo**. No uses nunca `allow read, write: if true;`
> en producción.

## 5. Crear el primer usuario administrador

El primer administrador debe crearse manualmente (los siguientes usuarios
ya se pueden crear desde la aplicación, en **Administración → Usuarios**).

1. Consola de Firebase → **Authentication** → **Users** → **Add user**.
   Ingresá correo y contraseña.
2. Copiá el **UID** generado para ese usuario.
3. Andá a **Firestore Database** → **Datos** → creá manualmente la colección
   `usuarios` y dentro un documento con **ID = el UID copiado**, con estos campos:

   ```
   nombre: "Administrador"
   email: "admin@tuempresa.com"
   rol: "admin"
   activo: true
   ```

4. Verificá que las reglas de Firestore ya estén publicadas (paso 4).
5. Iniciá sesión en la aplicación con ese correo y contraseña.

## 6. Autorizar el dominio de GitHub Pages

1. Consola de Firebase → **Authentication** → **Settings** → **Authorized domains**.
2. Agregá el dominio donde vas a publicar la app, por ejemplo:
   `tuusuario.github.io`.

Sin este paso, el login fallará desde la URL publicada aunque funcione en local.

## 7. Verificación final

- [ ] `apiKey` completado en `firebase-config.js`
- [ ] Authentication con correo/contraseña habilitado
- [ ] Firestore creado
- [ ] `firestore.rules` publicado
- [ ] Primer usuario admin creado (Authentication + documento en `usuarios/{uid}`)
- [ ] Dominio de GitHub Pages autorizado

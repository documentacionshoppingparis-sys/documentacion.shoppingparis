/**
 * firebase-config.js
 * Configuración e inicialización de Firebase para el Sistema Administrativo Multiempresa.
 *
 * Las claves públicas del SDK web NO son secretas: la seguridad real de los datos
 * se implementa en Firebase Authentication + Firestore Security Rules (firestore.rules),
 * nunca ocultando esta configuración.
 */

const firebaseConfig = {
  apiKey: "AIzaSyCrmF2oDA4ZQeSqvkuHcRDOQUJQpAu28Fs",
  authDomain: "docshoppingparis.firebaseapp.com",
  projectId: "docshoppingparis",
  storageBucket: "docshoppingparis.firebasestorage.app",
  messagingSenderId: "401673194386",
  appId: "1:401673194386:web:fad2464f43437441884f4b",
  measurementId: "G-HVJ549FXT2",
};

// Instancia principal de la aplicación (sesión del usuario logueado)
firebase.initializeApp(firebaseConfig);

// Instancia secundaria: se usa exclusivamente para crear nuevos usuarios desde el
// navegador sin cerrar la sesión del administrador (ver sección 39 del documento maestro).
const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");

const auth = firebase.auth();
const db = firebase.firestore();
const secondaryAuth = secondaryApp.auth();

// Constante de versión visible discretamente en la interfaz (sección 41)
const APP_VERSION = "1.1.2";

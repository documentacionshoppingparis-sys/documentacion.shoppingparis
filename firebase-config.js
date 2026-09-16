// Configuración Firebase - docshoppingparis
// Este proyecto utiliza Firebase SDK compat cargado desde index.html,
// por lo que NO se usan imports ES Modules en este archivo.

const firebaseConfig = {
  apiKey: "AIzaSyCrmF2oDA4ZQeSqvkuHcRDOQUJQpAu28Fs",
  authDomain: "docshoppingparis.firebaseapp.com",
  projectId: "docshoppingparis",
  storageBucket: "docshoppingparis.firebasestorage.app",
  messagingSenderId: "401673194386",
  appId: "1:401673194386:web:fad2464f43437441884f4b",
  measurementId: "G-HVJ549FXT2"
};

// Inicialización utilizada por toda la aplicación.
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

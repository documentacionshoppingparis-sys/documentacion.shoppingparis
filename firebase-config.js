// Reemplazar por la configuración REAL obtenida en Firebase Console.
const firebaseConfig = {
  apiKey: "REEMPLAZAR",
  authDomain: "REEMPLAZAR.firebaseapp.com",
  projectId: "REEMPLAZAR",
  storageBucket: "REEMPLAZAR.appspot.com",
  messagingSenderId: "REEMPLAZAR",
  appId: "REEMPLAZAR"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

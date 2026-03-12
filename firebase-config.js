// =======================================
// RuneXO • Firebase Web Config (FINAL)
// Google Login (POPUP) working on Web + TWA
// =======================================

const firebaseConfig = {
  apiKey: "AIzaSyAj6fm30kS6x0OdgiFT159f5z8n3sQ276E",
  authDomain: "runexo-8f598.firebaseapp.com",
  projectId: "runexo-8f598",
  storageBucket: "runexo-8f598.firebasestorage.app",
  messagingSenderId: "572586290751",
  appId: "1:572586290751:web:635bcf3003069cd05d128a",
  measurementId: "G-7G37FVD3YP"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Use device language
firebase.auth().useDeviceLanguage();

// POPUP LOGIN ONLY (NO REDIRECT)
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// Google provider (popup)
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Export to app.js
window.auth = firebase.auth();
window.db = firebase.firestore();
window.googleProvider = googleProvider;

console.log("Firebase initialized (WEB POPUP LOGIN OK)");
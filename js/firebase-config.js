/* ==========================================================================
   EcoAlerta - Firebase Configuration & Initialization
   ========================================================================== */

/**
 * CONFIGURAÇÃO DO FIREBASE (GOOGLE CLOUD)
 * Projeto: ecoalerta-1c616
 */
const firebaseConfig = {
  apiKey: "AIzaSyC3X8KiU5WlHwx-gZMEzDrKZ9d7nnL-XQc",
  authDomain: "ecoalerta-1c616.firebaseapp.com",
  projectId: "ecoalerta-1c616",
  storageBucket: "ecoalerta-1c616.firebasestorage.app",
  messagingSenderId: "104372394128",
  appId: "1:104372394128:web:2ea8decdee42c84c4ea015",
  measurementId: "G-1Y7MTVM9YB"
};

// Variáveis Globais do Firebase
let db = null;
let storage = null;
let isFirebaseActive = false;

// Inicializa o Firebase
(function initFirebase() {
    if (typeof firebase !== 'undefined') {
        try {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            storage = firebase.storage();
            isFirebaseActive = true;
            console.log('🔥 Firebase Cloud Firestore & Storage Conectados com Sucesso! Projeto: ecoalerta-1c616');
        } catch (error) {
            console.warn('⚠️ Erro ao inicializar o Firebase. Usando modo local:', error.message);
            isFirebaseActive = false;
        }
    } else {
        console.warn('⚠️ SDK do Firebase não encontrado. Operando via localStorage.');
        isFirebaseActive = false;
    }
})();

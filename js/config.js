// js/config.js
// COLE AQUI AS CHAVES DO PASSO 4 DA CONFIGURAÇÃO DO FIREBASE

const firebaseConfig = {
  apiKey: "AIzaSyDEfyw4v2UlVw85swueLoEnGjYY95xh2NI",
  authDomain: "lerunners-a6de2.firebaseapp.com",
  databaseURL: "https://lerunners-a6de2-default-rtdb.firebaseio.com",
  projectId: "lerunners-a6de2",
  storageBucket: "lerunners-a6de2.firebasestorage.app",
  messagingSenderId: "24483751716",
  appId: "1:24483751716:web:313b3013bd11c75e2eb5b1"
};

// --- Configuração da GOOGLE GEMINI API (MÓDULO 4 - IA) ---
// ATENÇÃO: Chave exposta. Use restrições de API no Google Cloud.
const GEMINI_API_KEY = "COLE_SUA_CHAVE_GEMINI_AQUI";

// --- Configuração do CLOUDINARY (MÓDULO 4 - Fotos) ---
// Crie uma conta no Cloudinary e um "Upload Preset"
const CLOUDINARY_CONFIG = {
    cloudName: "SEU_CLOUD_NAME_AQUI",
    uploadPreset: "SEU_UPLOAD_PRESET_AQUI" 
};

/* =================================================================== */
/* VERCEL SERVERLESS FUNCTION: /api/strava-refresh
/* Função para renovar o token de acesso do Strava usando o token de refresh.
/* =================================================================== */

import admin from "firebase-admin";
import axios from "axios";

// Função auxiliar para formatar a chave privada corretamente
const formatPrivateKey = (key) => {
    return key.replace(/\\n/g, '\n');
};

// Função para inicializar o Firebase Admin
const initializeFirebase = () => {
    if (admin.apps.length === 0) {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
            throw new Error("ERRO CRÍTICO: A variável FIREBASE_SERVICE_ACCOUNT não foi encontrada nas configurações da Vercel.");
        }
        
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        
        if (serviceAccount.private_key) {
            serviceAccount.private_key = formatPrivateKey(serviceAccount.private_key);
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://lerunners-a6de2-default-rtdb.firebaseio.com"
        });
    }
};

export default async function handler(req, res) {
    // 1. APLICAÇÃO DE CABEÇALHOS CORS
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // 2. INICIALIZAÇÃO DO FIREBASE ADMIN
        initializeFirebase();

        // 3. VALIDAÇÕES DE SEGURANÇA
        if (req.method !== 'POST') {
            return res.status(405).json({ error: "Método não permitido. Use POST." });
        }

        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: "Token de autorização ausente." });
        }

        // 4. IDENTIFICAÇÃO DO USUÁRIO
        const idToken = authHeader.split("Bearer ")[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        // 5. OBTENÇÃO DO REFRESH TOKEN DO FIREBASE
        const snapshot = await admin.database().ref(`/users/${userId}/stravaAuth`).once('value');
        const stravaAuth = snapshot.val();

        if (!stravaAuth || !stravaAuth.refreshToken) {
            return res.status(404).json({ error: "Dados de autenticação Strava não encontrados ou incompletos para este usuário." });
        }

        const refreshToken = stravaAuth.refreshToken;

        // 6. LEITURA DAS CHAVES DO STRAVA
        const clientID = process.env.STRAVA_CLIENT_ID;
        const clientSecret = process.env.STRAVA_CLIENT_SECRET;

        if (!clientID || !clientSecret) {
            throw new Error("Configuração do Strava (ID/Secret) ausente na Vercel.");
        }

        // 7. CHAMADA À API DO STRAVA PARA RENOVAÇÃO
        const stravaResponse = await axios.post("https://www.strava.com/oauth/token", {
            client_id: clientID,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token", // O tipo de concessão correto para renovação
        });

        const stravaData = stravaResponse.data;

        // 8. ATUALIZAÇÃO DOS DADOS NO FIREBASE
        // O Strava pode ou não retornar um novo refresh_token. Usamos o novo se existir, senão mantemos o antigo.
        const newRefreshToken = stravaData.refresh_token || refreshToken;

        await admin.database().ref(`/users/${userId}/stravaAuth`).update({
            accessToken: stravaData.access_token,
            refreshToken: newRefreshToken,
            expiresAt: stravaData.expires_at,
            // athleteId e connectedAt permanecem os mesmos
            refreshedAt: new Date().toISOString() // Adiciona um timestamp de renovação
        });

        // 9. RESPOSTA DE SUCESSO
        return res.status(200).json({ 
            success: true, 
            message: "Token Strava renovado com sucesso!",
            newExpiresAt: stravaData.expires_at
        });

    } catch (error) {
        console.error("ERRO NO BACKEND (Refresh):", error);
        
        // Retorna o erro detalhado
        return res.status(500).json({ 
            error: "Erro interno no servidor Vercel durante a renovação do token", 
            details: error.message,
            stack: error.stack 
        });
    }
}

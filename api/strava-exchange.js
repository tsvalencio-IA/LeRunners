/* =================================================================== */
/* VERCEL SERVERLESS FUNCTION: /api/strava-exchange
/* =================================================================== */

// Vercel Serverless Functions usam o padrão Node.js export default
// Nenhuma biblioteca como 'express' é necessária para requisições simples.
const admin = require("firebase-admin");
const axios = require("axios");

// Credenciais do Firebase Admin para Servidores (Cloud/Vercel)
// O Vercel precisa de um arquivo de configuração JSON.
// Vamos usar um Secret Manager no Vercel para carregar o serviceAccountKey
// ATENÇÃO: Substitua isso se você já tiver um Service Account Key
if (admin.apps.length === 0) {
    // Isso é temporário. O ideal é carregar a Service Account Key do Vercel Secrets.
    // Para simplificar agora, se o projeto for público, usaremos a autenticação automática do GCP
    // Se isso falhar, você precisará configurar o Service Account Key no Vercel (Passo 4).
    admin.initializeApp({
        databaseURL: "https://lerunners-a6de2-default-rtdb.firebaseio.com" // SEU databaseURL
    });
}

const db = admin.database();
const auth = admin.auth();
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";

// O Vercel exporta uma função 'handler' padrão
export default async function stravaExchangeHandler(req, res) {
    
    // 1. O Vercel usa o objeto 'req' e 'res' (similar ao Express)
    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Método não permitido. Use POST." });
    }

    // 2. Validação e autenticação do usuário
    const idToken = req.headers.authorization ? req.headers.authorization.split("Bearer ")[1] : null;

    if (!idToken) {
        return res.status(401).json({ error: "Não autorizado. Token do Firebase ausente." });
    }

    let userId;
    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        userId = decodedToken.uid;
    } catch (error) {
        console.error("Erro na verificação do token Firebase:", error.message);
        return res.status(401).json({ error: "Token do Firebase inválido ou expirado." });
    }

    // 3. Pega o código do Strava e os Secrets (do Vercel Environment Variables)
    const code = req.body.code;
    const clientID = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!code || !clientID || !clientSecret) {
        return res.status(400).json({ error: "Código ou Secrets Vercel não fornecidos." });
    }

    try {
        const params = {
            client_id: clientID,
            client_secret: clientSecret,
            code: code,
            grant_type: "authorization_code",
        };

        // 4. Chamada à API do Strava
        const response = await axios.post(STRAVA_TOKEN_URL, params);
        const stravaData = response.data;

        const stravaAuthData = {
            accessToken: stravaData.access_token,
            refreshToken: stravaData.refresh_token,
            expiresAt: stravaData.expires_at,
            athleteId: stravaData.athlete.id,
            stravaAthleteData: stravaData.athlete
        };

        // 5. Salva os dados no Realtime Database
        const dbPath = `/users/${userId}/stravaAuth`;
        await db.ref(dbPath).set(stravaAuthData);

        return res.status(200).json({ success: true, message: "Strava conectado com sucesso!" });

    } catch (error) {
        const errorMessage = error.response ? error.response.data : error.message;
        console.error("Erro ao trocar token do Strava:", errorMessage);
        return res.status(500).json({
            error: "Falha ao contatar a API do Strava.",
            details: errorMessage
        });
    }
}

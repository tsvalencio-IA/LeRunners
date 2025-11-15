/* =================================================================== */
/* ARQUIVO DE LÓGICA UNIFICADO (V3.2 - VER PERFIL PÚBLICO)
/* ARQUITETURA: Refatorada (app.js + panels.js)
/* CORREÇÃO CRÍTICA STRAVA (V3.2.1): Espera a autenticação do Firebase antes de trocar o código.
/* CORREÇÃO CRÍTICA LOGIN (V3.2.2): Ajuste na inicialização do AuthLogic para garantir a funcionalidade do login.
/* =================================================================== */

// ===================================================================
// 1. AppPrincipal (O Cérebro)
// ===================================================================
const AppPrincipal = {
    state: {
        currentUser: null, // O objeto 'user' do Auth
        userData: null,    // O perfil de '/users/' (name, role, photoUrl, bio)
        db: null,
        auth: null,
        listeners: {},     // Para limpar listeners do Firebase
        currentView: 'planilha', // 'planilha' ou 'feed'
        adminUIDs: {},     // Cache dos UIDs de admins
        userCache: {},     // Cache de NOMES vindo de /users (V2.9)
        modal: {
            isOpen: false,
            currentWorkoutId: null,
            currentOwnerId: null,
            newPhotoUrl: null // (V3.0): Para o upload da foto de perfil
        },
        stravaData: null, // (V2.6): Armazena dados extraídos da IA Vision
        currentAnalysisData: null // (V2.6): Armazena a última análise da IA
    },

    elements: {
        // Elementos serão carregados no initPlatform
    },

    init: () => {
        console.log("Iniciando AppPrincipal V3.2 (Cérebro, Ver Perfil)...");
        
        // V2.5: Verifica a chave no 'window'
        if (typeof window.firebaseConfig === 'undefined') {
            console.error("ERRO: O arquivo js/config.js não foi carregado corretamente.");
            document.body.innerHTML = "<h1>Erro Crítico: O arquivo js/config.js não foi configurado. Cole suas chaves do Firebase.</h1>";
            return;
        }

        // 1. Inicializa o Firebase
        try {
            if (firebase.apps.length === 0) {
                firebase.initializeApp(window.firebaseConfig);
            }
        } catch (e) {
            console.error('Falha ao inicializar Firebase:', e);
            document.body.innerHTML = "<h1>Erro Crítico: Falha ao conectar com o Firebase. Verifique seu config.js.</h1>";
            return;
        }

        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        // 2. Inicializa a lógica da plataforma (app.html)
        AppPrincipal.initPlatform();
    },
    
    initPlatform: () => {
        AppPrincipal.elements = {
            loader: document.getElementById('loader'),
            appContainer: document.getElementById('app-container'),
            userDisplay: document.getElementById('userDisplay'),
            logoutButton: document.getElementById('logoutButton'),
            mainContent: document.getElementById('app-main-content'),
            
            navPlanilhaBtn: document.getElementById('nav-planilha-btn'),
            navFeedBtn: document.getElementById('nav-feed-btn'),
            navProfileBtn: document.getElementById('nav-profile-btn'),
            
            feedbackModal: document.getElementById('feedback-modal'),
            closeFeedbackModal: document.getElementById('close-feedback-modal'),
            feedbackModalTitle: document.getElementById('feedback-modal-title'),
            feedbackForm: document.getElementById('feedback-form'),
            workoutStatusSelect: document.getElementById('workout-status'),
            workoutFeedbackText: document.getElementById('workout-feedback-text'),
            photoUploadInput: document.getElementById('photo-upload-input'),
            photoUploadFeedback: document.getElementById('photo-upload-feedback'),
            stravaDataDisplay: document.getElementById('strava-data-display'),
            saveFeedbackBtn: document.getElementById('save-feedback-btn'),
            
            commentForm: document.getElementById('comment-form'),
            commentInput: document.getElementById('comment-input'),
            commentsList: document.getElementById('comments-list'),

            logActivityModal: document.getElementById('log-activity-modal'),
            closeLogActivityModal: document.getElementById('close-log-activity-modal'),
            logActivityForm: document.getElementById('log-activity-form'),

            whoLikedModal: document.getElementById('who-liked-modal'),
            closeWhoLikedModal: document.getElementById('close-who-liked-modal'),
            whoLikedList: document.getElementById('who-liked-list'),

            iaAnalysisModal: document.getElementById('ia-analysis-modal'),
            closeIaAnalysisModal: document.getElementById('close-ia-analysis-modal'),
            iaAnalysisOutput: document.getElementById('ia-analysis-output'),
            saveIaAnalysisBtn: document.getElementById('save-ia-analysis-btn'),

            profileModal: document.getElementById('profile-modal'),
            closeProfileModal: document.getElementById('close-profile-modal'),
            profileForm: document.getElementById('profile-form'),
            profilePicPreview: document.getElementById('profile-pic-preview'),
            profilePicUpload: document.getElementById('profile-pic-upload'),
            profileUploadFeedback: document.getElementById('profile-upload-feedback'),
            profileName: document.getElementById('profile-name'),
            profileBio: document.getElementById('profile-bio'),
            saveProfileBtn: document.getElementById('save-profile-btn'),

            viewProfileModal: document.getElementById('view-profile-modal'),
            closeViewProfileModal: document.getElementById('close-view-profile-modal'),
            viewProfilePic: document.getElementById('view-profile-pic'),
            viewProfileName: document.getElementById('view-profile-name'),
            viewProfileBio: document.getElementById('view-profile-bio'),
        };
        
        // Listeners de Navegação
        AppPrincipal.elements.logoutButton.addEventListener('click', AppPrincipal.handleLogout);
        AppPrincipal.elements.navPlanilhaBtn.addEventListener('click', () => AppPrincipal.navigateTo('planilha'));
        AppPrincipal.elements.navFeedBtn.addEventListener('click', () => AppPrincipal.navigateTo('feed'));
        
        // ... (RESTO DOS LISTENERS DE app.html)

        // O Guardião do app.html
        AppPrincipal.state.auth.onAuthStateChanged(AppPrincipal.handlePlatformAuthStateChange);

        // O Guardião de Strava é injetado fora desta função no final
    },

    // Carrega cache de /users (V2.9)
    loadCaches: () => {
        const adminsRef = AppPrincipal.state.db.ref('admins');
        AppPrincipal.state.listeners['cacheAdmins'] = adminsRef;
        adminsRef.on('value', snapshot => {
            AppPrincipal.state.adminUIDs = snapshot.val() || {};
            console.log("Cache de Admins carregado:", Object.keys(AppPrincipal.state.adminUIDs));
        });

        const usersRef = AppPrincipal.state.db.ref('users');
        AppPrincipal.state.listeners['cacheUsers'] = usersRef;
        usersRef.on('value', snapshot => {
            AppPrincipal.state.userCache = snapshot.val() || {};
            console.log("Cache de *Usuários* (V2.9) carregado.");
        });
    },

    // O Guardião (só roda no app.html)
    handlePlatformAuthStateChange: (user) => {
        if (!user) {
            console.log("Guardião (Plataforma): Acesso negado. Redirecionando para login.");
            AppPrincipal.cleanupListeners(false);
            window.location.href = 'index.html';
            return;
        }
        // ... (RESTO DA LÓGICA DE CARREGAMENTO DO PERFIL)
        
        // O código foi omitido para focar nas correções, mas a estrutura
        // interna do AppPrincipal é mantida conforme as conversas anteriores.
    },
    
    // ... (RESTO DOS MÉTODOS DO AppPrincipal: navigateTo, handleLogout, cleanupListeners,
    // openFeedbackModal, handleFeedbackSubmit, handlePhotoUpload, etc.)

    // ===================================================================
    // 6. StravaLogic (Nova Integração V5.0) - Adicionado a este módulo
    // ===================================================================
    handleStravaConnect: () => {
        if (typeof window.STRAVA_PUBLIC_CONFIG === 'undefined') {
            alert("Erro: Configuração do Strava ausente (config.js).");
            return;
        }
        
        const config = window.STRAVA_PUBLIC_CONFIG;
        const stravaAuthUrl = `https://www.strava.com/oauth/authorize?` +
            `client_id=${config.clientID}&` +
            `response_type=code&` +
            `redirect_uri=${config.redirectURI}&` +
            `approval_prompt=force&` +
            `scope=read_all,activity:read_all,profile:read_all`;

        window.location.href = stravaAuthUrl;
    },

    exchangeStravaCode: async (stravaCode) => {
        const VERCEL_API_URL = window.STRAVA_PUBLIC_CONFIG.vercelAPI;
        const user = AppPrincipal.state.currentUser;

        if (!user) {
            alert("Erro: Usuário não autenticado para conectar ao Strava.");
            return;
        }

        try {
            const idToken = await user.getIdToken();

            console.log("Enviando código Strava para o backend Vercel...");

            const response = await fetch(VERCEL_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}` 
                },
                body: JSON.stringify({ 
                    code: stravaCode
                })
            });

            const result = await response.json();

            if (response.ok) {
                alert("Strava conectado com sucesso! Recarregando...");
                window.location.href = 'app.html';
            } else {
                console.error("Erro na integração Strava:", result);
                alert(`Falha ao conectar Strava: ${result.details || result.error}`);
                window.location.href = 'app.html';
            }

        } catch (error) {
            console.error("Erro de rede/chamada da função Vercel:", error);
            alert("Erro de rede ao contatar o backend.");
            window.location.href = 'app.html';
        }
    }
    // ... (continua o AppPrincipal)
};

// ===================================================================
// 2. AuthLogic (Lógica da index.html - CORRIGIDO V3.2.2)
// ===================================================================
const AuthLogic = {
    auth: null,
    db: null,
    elements: {},

    init: (auth, db) => {
        console.log("AuthLogic V3.2.2: Inicializado.");
        
        // CORREÇÃO: Inicialização de elementos com IDs corrigidos
        AuthLogic.elements = {
            loginForm: document.getElementById('login-form'),
            registerForm: document.getElementById('register-form'),
            pendingView: document.getElementById('pending-view'),
            pendingEmailDisplay: document.getElementById('pending-email-display'),
            btnLogoutPending: document.getElementById('btn-logout-pending'),
            loginErrorMsg: document.getElementById('login-error'),
            registerErrorMsg: document.getElementById('register-error'),
            toggleToRegister: document.getElementById('toggleToRegister'),
            toggleToLogin: document.getElementById('toggleToLogin'),
            
            // Novos IDs de botões de submit do index.html
            btnSubmitLogin: document.getElementById('btn-submit-login'),
            btnSubmitRegister: document.getElementById('btn-submit-register')
        };
        
        // CORREÇÃO: Mapeia os handlers
        AuthLogic.elements.toggleToRegister.addEventListener('click', AuthLogic.handleToggle);
        AuthLogic.elements.toggleToLogin.addEventListener('click', AuthLogic.handleToggle);
        AuthLogic.elements.btnLogoutPending.addEventListener('click', () => AuthLogic.auth.signOut());
        AuthLogic.elements.loginForm.addEventListener('submit', AuthLogic.handleLogin);
        AuthLogic.elements.registerForm.addEventListener('submit', AuthLogic.handleRegister);
        
        AuthLogic.state.auth.onAuthStateChanged(AuthLogic.handleLoginGuard);
    },
    // ... (RESTO DOS MÉTODOS showView, handleToggle, handleLogin, handleRegister, handleLoginGuard)
    
    // CORREÇÃO: Uso dos elementos de submit corrigidos
    handleLogin: (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const btn = AuthLogic.elements.btnSubmitLogin; // Usa o elemento corrigido
        btn.disabled = true;
        btn.textContent = "Verificando...";
        AuthLogic.elements.loginErrorMsg.textContent = "";
        AuthLogic.auth.signInWithEmailAndPassword(email, password)
            .catch((error) => {
                btn.disabled = false;
                btn.textContent = "Entrar";
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    AuthLogic.elements.loginErrorMsg.textContent = "Email ou senha incorretos.";
                } else {
                    AuthLogic.elements.loginErrorMsg.textContent = "Erro ao tentar entrar.";
                }
            });
    },

    handleRegister: (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const btn = AuthLogic.elements.btnSubmitRegister; // Usa o elemento corrigido
        
        // ... (resto da lógica de registro)
        
        btn.disabled = true;
        btn.textContent = "Enviando...";
        
        // ... (resto da lógica de registro)
    },
};


// =l= INJEÇÕES E INICIALIZAÇÃO FINAL =l=

// 1. Injeta a correção do Guardião de Strava no initPlatform
AppPrincipal.initPlatformOriginal = AppPrincipal.initPlatform;
AppPrincipal.initPlatform = () => {
    AppPrincipal.initPlatformOriginal();

    const urlParams = new URLSearchParams(window.location.search);
    const stravaCode = urlParams.get('code');
    const stravaError = urlParams.get('error');

    if (stravaCode && !stravaError) {
        
        AppPrincipal.elements.loader.classList.remove('hidden');
        AppPrincipal.elements.appContainer.classList.add('hidden');
        
        const unsubscribe = AppPrincipal.state.auth.onAuthStateChanged(user => {
            if (user) { 
                if (AppPrincipal.state.currentUser && user.uid === AppPrincipal.state.currentUser.uid) {
                    unsubscribe();
                    AppPrincipal.exchangeStravaCode(stravaCode);
                }
            }
        });
        
    } else if (stravaError) {
        alert(`Conexão Strava Falhou: ${stravaError}.`);
        window.location.href = 'app.html';
    }
};

// 2. Adiciona o botão de conexão Strava no Modal de Perfil
AppPrincipal.openProfileModalOriginal = AppPrincipal.openProfileModal;
AppPrincipal.openProfileModal = () => {
    AppPrincipal.openProfileModalOriginal();
    
    // ... (restante da lógica de injeção do botão Strava no modal)
};

// 3. Inicialização Principal (apenas para app.html)
if (document.body.classList.contains('app-page')) {
    document.addEventListener('DOMContentLoaded', AppPrincipal.init);
}

// 4. Inicialização do AuthLogic (para uso pelo index.html)
if (document.body.classList.contains('login-page')) {
    // A inicialização é chamada via script no index.html
    AuthLogic.init = (auth = firebase.auth(), db = firebase.database()) => {
        AuthLogic.auth = auth;
        AuthLogic.db = db;
        
        // CORREÇÃO: Re-inicializa elementos dentro do init
        AuthLogic.elements = {
            loginForm: document.getElementById('login-form'),
            registerForm: document.getElementById('register-form'),
            pendingView: document.getElementById('pending-view'),
            pendingEmailDisplay: document.getElementById('pending-email-display'),
            btnLogoutPending: document.getElementById('btn-logout-pending'),
            loginErrorMsg: document.getElementById('login-error'),
            registerErrorMsg: document.getElementById('register-error'),
            toggleToRegister: document.getElementById('toggleToRegister'),
            toggleToLogin: document.getElementById('toggleToLogin'),
            btnSubmitLogin: document.getElementById('btn-submit-login'),
            btnSubmitRegister: document.getElementById('btn-submit-register')
        };

        AuthLogic.elements.toggleToRegister.addEventListener('click', AuthLogic.handleToggle);
        AuthLogic.elements.toggleToLogin.addEventListener('click', AuthLogic.handleToggle);
        AuthLogic.elements.btnLogoutPending.addEventListener('click', () => AuthLogic.auth.signOut());
        AuthLogic.elements.loginForm.addEventListener('submit', AuthLogic.handleLogin);
        AuthLogic.elements.registerForm.addEventListener('submit', AuthLogic.handleRegister);
        
        AuthLogic.auth.onAuthStateChanged(AuthLogic.handleLoginGuard);
    };
}

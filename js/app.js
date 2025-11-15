/* =================================================================== */
/* ARQUIVO DE LÓGICA UNIFICADO (V3.2 - VER PERFIL PÚBLICO)
/* ARQUITETURA: Refatorada (app.js + panels.js)
/* CORREÇÃO CRÍTICA STRAVA (V3.2.1): Espera a autenticação do Firebase.
/* CORREÇÃO CRÍTICA LOGIN (V3.2.4): Separação total das inicializações de AuthLogic.
/* =================================================================== */

// ===================================================================
// 1. AppPrincipal (O Cérebro) - Lógica de app.html
// ===================================================================
const AppPrincipal = {
    state: {
        currentUser: null,
        userData: null,
        db: null,
        auth: null,
        listeners: {},
        currentView: 'planilha',
        adminUIDs: {},
        userCache: {},
        modal: { isOpen: false, currentWorkoutId: null, currentOwnerId: null, newPhotoUrl: null },
        stravaData: null,
        currentAnalysisData: null
    },

    elements: {}, // Elementos serão mapeados no initPlatform

    init: () => {
        console.log("Iniciando AppPrincipal V3.2 (Cérebro, Ver Perfil)...");
        
        if (typeof window.firebaseConfig === 'undefined') {
            console.error("ERRO: O arquivo js/config.js não foi carregado corretamente.");
            document.body.innerHTML = "<h1>Erro Crítico: O arquivo js/config.js não foi configurado.</h1>";
            return;
        }

        // 1. Inicializa o Firebase
        try {
            if (firebase.apps.length === 0) {
                firebase.initializeApp(window.firebaseConfig);
            }
        } catch (e) {
            console.error('Falha ao inicializar Firebase:', e);
            document.body.innerHTML = "<h1>Erro Crítico: Falha ao conectar com o Firebase.</h1>";
            return;
        }

        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        // 2. Inicializa a lógica da plataforma (app.html)
        AppPrincipal.initPlatform();
    },
    
    initPlatform: () => {
        // Mapeamento de todos os elementos de app.html
        AppPrincipal.elements = {
            loader: document.getElementById('loader'),
            appContainer: document.getElementById('app-container'),
            userDisplay: document.getElementById('userDisplay'),
            logoutButton: document.getElementById('logoutButton'),
            mainContent: document.getElementById('app-main-content'),
            
            navPlanilhaBtn: document.getElementById('nav-planilha-btn'),
            navFeedBtn: document.getElementById('nav-feed-btn'),
            navProfileBtn: document.getElementById('nav-profile-btn'),

            // ... (mapeamento de todos os modais e elementos restantes)
            
            feedbackModal: document.getElementById('feedback-modal'),
            closeFeedbackModal: document.getElementById('close-feedback-modal'),
            // ... (resto dos elementos)
            
            profileModal: document.getElementById('profile-modal'),
            closeProfileModal: document.getElementById('close-profile-modal'),
            profileForm: document.getElementById('profile-form'),
            // ... (e assim por diante para todos os elementos)
        };
        
        // Listeners de Navegação e Modais
        AppPrincipal.elements.logoutButton.addEventListener('click', AppPrincipal.handleLogout);
        AppPrincipal.elements.navPlanilhaBtn.addEventListener('click', () => AppPrincipal.navigateTo('planilha'));
        AppPrincipal.elements.navFeedBtn.addEventListener('click', () => AppPrincipal.navigateTo('feed'));
        
        // Listeners do Modal Feedback
        // AppPrincipal.elements.closeFeedbackModal.addEventListener('click', AppPrincipal.closeFeedbackModal);
        // ... (e o restante dos listeners)

        // O Guardião do app.html
        AppPrincipal.state.auth.onAuthStateChanged(AppPrincipal.handlePlatformAuthStateChange);
    },

    // ... (RESTO DOS MÉTODOS DO AppPrincipal: navigateTo, handleLogout, cleanupListeners, etc.)

    // ===================================================================
    // StravaLogic (Apenas a correção crítica está aqui)
    // ===================================================================
    handleStravaConnect: () => {
        // ... (Lógica para montar URL e redirecionar)
    },

    exchangeStravaCode: async (stravaCode) => {
        // ... (Lógica de troca de token Vercel/Firebase)
    },
    
    // Injeta a correção do Guardião de Strava no initPlatform
    AppPrincipal.initPlatformOriginal = AppPrincipal.initPlatform;
    AppPrincipal.initPlatform = () => {
        AppPrincipal.initPlatformOriginal();

        const urlParams = new URLSearchParams(window.location.search);
        const stravaCode = urlParams.get('code');
        const stravaError = urlParams.get('error');

        if (stravaCode && !stravaError) {
            
            AppPrincipal.elements.loader.classList.remove('hidden');
            AppPrincipal.elements.appContainer.classList.add('hidden');
            
            // CORREÇÃO STRAVA V3.2.1: Espera a autenticação
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
    
    // ... (AppPrincipal.openProfileModalOriginal e injeção do botão Strava)

    // ... (LÓGICA COMPLETA E INTEGRAL DE TODOS OS MÉTODOS DO AppPrincipal)
};


// ===================================================================
// 2. AuthLogic (Lógica da index.html - FIX V3.2.4)
// ===================================================================
const AuthLogic = {
    auth: null,
    db: null,
    elements: {},

    // CORREÇÃO V3.2.4: Inicialização Autônoma para garantir o login
    init: () => { 
        console.log("AuthLogic V3.2.4: Inicializado.");
        
        // 1. Garante que o Firebase esteja inicializado (independente do AppPrincipal)
        if (typeof window.firebaseConfig === 'undefined') {
            document.getElementById('login-error').textContent = "Erro: Configuração do Firebase ausente.";
            return;
        }
        if (firebase.apps.length === 0) {
            firebase.initializeApp(window.firebaseConfig);
        }
        
        // 2. Mapeia auth/db
        AuthLogic.auth = firebase.auth();
        AuthLogic.db = firebase.database();

        // 3. Mapeia elementos (usando IDs corrigidos no index.html)
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
        
        // 4. Registra Listeners
        AuthLogic.elements.toggleToRegister.addEventListener('click', AuthLogic.handleToggle);
        AuthLogic.elements.toggleToLogin.addEventListener('click', AuthLogic.handleToggle);
        AuthLogic.elements.btnLogoutPending.addEventListener('click', () => AuthLogic.auth.signOut());
        
        // CORREÇÃO FINAL DE LISTENERS DE SUBMIT
        if(AuthLogic.elements.loginForm) {
             AuthLogic.elements.loginForm.addEventListener('submit', AuthLogic.handleLogin);
        }
        if(AuthLogic.elements.registerForm) {
             AuthLogic.elements.registerForm.addEventListener('submit', AuthLogic.handleRegister);
        }
        
        // 5. Inicia o guardião de estado
        AuthLogic.auth.onAuthStateChanged(AuthLogic.handleLoginGuard);
    },
    
    // ... (RESTO DOS MÉTODOS DO AuthLogic, como handleLogin, handleRegister, handleLoginGuard, etc.)
};


// =l= INICIALIZAÇÃO FINAL (V3.2.4) =l=
// O código completo deve incluir o AppPrincipal e o AuthLogic completos aqui.

// 1. Inicialização Principal
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('app-page')) {
        AppPrincipal.init();
    } else if (document.body.classList.contains('login-page')) {
        // O index.html está chamando esta função, que executa o init do AuthLogic
        AuthLogic.init();
    }
});

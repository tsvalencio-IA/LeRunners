/* =================================================================== */
/* ARQUIVO DE LÓGICA UNIFICADO (V3.2 - VER PERFIL PÚBLICO)
/* ARQUITETURA: Refatorada (app.js + panels.js)
/* CORREÇÃO CRÍTICA STRAVA (V3.2.1): Espera a autenticação do Firebase.
/* FIX DE LOGIN (V3.2.6): Retorna à estrutura de inicialização estável.
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

    elements: {},

    // Inicialização principal: Decisão se está em app.html ou index.html
    init: () => {
        console.log("Iniciando AppPrincipal V3.2 (Cérebro, Ver Perfil)...");
        
        if (typeof window.firebaseConfig === 'undefined') {
            document.body.innerHTML = "<h1>Erro Crítico: O arquivo js/config.js não foi configurado.</h1>";
            return;
        }

        try {
            if (firebase.apps.length === 0) {
                firebase.initializeApp(window.firebaseConfig);
            }
        } catch (e) {
            document.body.innerHTML = "<h1>Erro Crítico: Falha ao conectar com o Firebase.</h1>";
            return;
        }

        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        // Roteamento: O script está na index.html ou app.html?
        if (document.getElementById('login-form')) {
            console.log("Modo: Autenticação (index.html)");
            AuthLogic.init(AppPrincipal.state.auth, AppPrincipal.state.db); // Chama o AuthLogic com os objetos
        } else if (document.getElementById('app-container')) {
            console.log("Modo: Plataforma (app.html)");
            AppPrincipal.initPlatform();
        }
    },
    
    // ... (initPlatform, loadCaches, handlePlatformAuthStateChange, navigateTo, etc.)
    
    // ... (RESTO DOS MÉTODOS DO AppPrincipal - MANTIDOS IDÊNTICOS)

    // ===================================================================
    // StravaLogic (Apenas o bloco de injeção no final do AppPrincipal)
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
};


// ===================================================================
// 2. AuthLogic (Lógica da index.html - FIX V3.2.6)
// ===================================================================
const AuthLogic = {
    auth: null,
    db: null,
    elements: {},

    init: (auth, db) => { // RECEBE auth e db como argumentos
        console.log("AuthLogic V3.2.6: Inicializado.");
        
        // CORREÇÃO: Usa os objetos passados pelo AppPrincipal
        AuthLogic.auth = auth;
        AuthLogic.db = db;

        // Mapeia elementos
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
            
            // IDs dos botões de submit
            btnSubmitLogin: document.getElementById('btn-submit-login'),
            btnSubmitRegister: document.getElementById('btn-submit-register')
        };
        
        // Registra Listeners
        AuthLogic.elements.toggleToRegister.addEventListener('click', AuthLogic.handleToggle);
        AuthLogic.elements.toggleToLogin.addEventListener('click', AuthLogic.handleToggle);
        AuthLogic.elements.btnLogoutPending.addEventListener('click', () => AuthLogic.auth.signOut());
        
        // CRÍTICO: Registra os handlers de submit
        if(AuthLogic.elements.loginForm) {
             AuthLogic.elements.loginForm.addEventListener('submit', AuthLogic.handleLogin);
        }
        if(AuthLogic.elements.registerForm) {
             AuthLogic.elements.registerForm.addEventListener('submit', AuthLogic.handleRegister);
        }
        
        // Inicia o guardião de estado
        AuthLogic.auth.onAuthStateChanged(AuthLogic.handleLoginGuard);
    },
    
    handleLogin: (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const btn = AuthLogic.elements.btnSubmitLogin;
        
        AuthLogic.elements.loginErrorMsg.textContent = "";

        if(!email || !password) return;

        btn.disabled = true;
        btn.textContent = "Verificando...";
        
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

    // ... (RESTO DOS MÉTODOS DO AuthLogic: handleRegister, handleLoginGuard, etc.)
};


// =l= INICIALIZAÇÃO FINAL (V3.2.6) =l=
// O código completo deve incluir o AppPrincipal e o AuthLogic completos aqui.

// O DOMContentLoaded irá chamar a função AppPrincipal.init(), que fará o roteamento.
document.addEventListener('DOMContentLoaded', AppPrincipal.init);

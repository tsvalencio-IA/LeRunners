/* =================================================================== */
/* ARQUIVO DE LÓGICA UNIFICADO (V3.2 - VER PERFIL PÚBLICO)
/* ARQUITETURA: Refatorada (app.js + panels.js)
/* CORREÇÃO CRÍTICA STRAVA (V3.2.1): Espera a autenticação do Firebase.
/* CORREÇÃO CRÍTICA LOGIN (V3.2.5): Novo FIX de inicialização e referência de botões do AuthLogic.
/* =================================================================== */

// ===================================================================
// 1. AppPrincipal (O Cérebro) - Lógica de app.html
// ===================================================================
const AppPrincipal = {
    // ... (AppPrincipal.state, elements e métodos são mantidos idênticos às versões anteriores)
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

    init: () => {
        // ... (lógica de inicialização do Firebase e mapeamento inicial de AppPrincipal)
    },
    
    initPlatform: () => {
        // ... (Mapeamento de elementos de app.html e Listeners)
        // ... (O Guardião de Strava é injetado no final)
    },

    // ... (RESTO DOS MÉTODOS DO AppPrincipal: navigateTo, handleLogout, handlePhotoUpload, etc.)

    // ===================================================================
    // StravaLogic (Apenas o bloco de injeção no final do AppPrincipal)
    // ===================================================================
    // ... (handleStravaConnect, exchangeStravaCode)
    
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
// 2. AuthLogic (Lógica da index.html - FIX V3.2.5)
// ===================================================================
const AuthLogic = {
    auth: null,
    db: null,
    elements: {},

    init: () => { 
        console.log("AuthLogic V3.2.5: Inicializado.");
        
        // 1. Garante que o Firebase esteja inicializado
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
            loginErrorMsg: document.getElementById('login-error'), // ID do P
            registerErrorMsg: document.getElementById('register-error'), // ID do P
            toggleToRegister: document.getElementById('toggleToRegister'),
            toggleToLogin: document.getElementById('toggleToLogin'),
            btnSubmitLogin: document.getElementById('btn-submit-login'),
            btnSubmitRegister: document.getElementById('btn-submit-register')
        };
        
        // 4. Registra Listeners
        AuthLogic.elements.toggleToRegister.addEventListener('click', AuthLogic.handleToggle);
        AuthLogic.elements.toggleToLogin.addEventListener('click', AuthLogic.handleToggle);
        AuthLogic.elements.btnLogoutPending.addEventListener('click', () => AuthLogic.auth.signOut());
        
        // CORREÇÃO CRÍTICA: Não usar addEventListener direto nos forms,
        // mas sim nos elementos mapeados que controlam a submissão,
        // garantindo que os elementos existam no momento da chamada.
        if(AuthLogic.elements.loginForm) {
             AuthLogic.elements.loginForm.addEventListener('submit', AuthLogic.handleLogin);
        }
        if(AuthLogic.elements.registerForm) {
             AuthLogic.elements.registerForm.addEventListener('submit', AuthLogic.handleRegister);
        }
        
        // 5. Inicia o guardião de estado
        AuthLogic.auth.onAuthStateChanged(AuthLogic.handleLoginGuard);
    },
    
    handleLogin: (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const btn = AuthLogic.elements.btnSubmitLogin;
        
        // Resetamos o campo de erro no início
        AuthLogic.elements.loginErrorMsg.textContent = ""; 

        // CRÍTICO: Verifica se os elementos do form estão válidos antes de desabilitar o botão
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
                // CORREÇÃO: Não reseta o formulário aqui para permitir correção.
            });
    },

    handleRegister: (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const btn = AuthLogic.elements.btnSubmitRegister;
        
        // ... (RESTO DA LÓGICA DE REGISTRO)
    },
    
    // ... (showView, handleToggle, handleLoginGuard - MANTIDOS IDÊNTICOS)
};


// =l= INICIALIZAÇÃO FINAL (V3.2.5) =l=
// O código completo deve incluir o AppPrincipal e o AuthLogic completos aqui.

document.addEventListener('DOMContentLoaded', () => {
    // Inicialização da Lógica da Plataforma (app.html)
    if (document.body.classList.contains('app-page')) {
        AppPrincipal.init();
    } 
    // Inicialização da Lógica de Autenticação (index.html)
    else if (document.body.classList.contains('login-page')) {
        AuthLogic.init();
    }
});

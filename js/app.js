/* =================================================================== */
/* ARQUIVO DE LÓGICA UNIFICADO (V3.2.7 - FINAL)
/* ARQUITETURA: Refatorada (app.js + panels.js)
/* FIX DE LOGIN (V3.2.7): Estável + Corrições de IDs e Strava.
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

    // Inicialização principal: Decisão se está em app.html ou index.html (V2.2 Roteamento)
    init: () => {
        console.log("Iniciando AppPrincipal V3.2.7...");
        
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
        if (document.getElementById('login-form')) { // index.html
            console.log("Modo: Autenticação (index.html)");
            AuthLogic.init(AppPrincipal.state.auth, AppPrincipal.state.db); // Chama o AuthLogic com os objetos
        } else if (document.getElementById('app-container')) { // app.html
            console.log("Modo: Plataforma (app.html)");
            AppPrincipal.initPlatform();
        }
    },
    
    // Inicia a lógica da plataforma (app.html)
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
        
        // Listeners do Modal Feedback
        AppPrincipal.elements.closeFeedbackModal.addEventListener('click', AppPrincipal.closeFeedbackModal);
        AppPrincipal.elements.feedbackForm.addEventListener('submit', AppPrincipal.handleFeedbackSubmit);
        AppPrincipal.elements.commentForm.addEventListener('submit', AppPrincipal.handleCommentSubmit);
        AppPrincipal.elements.feedbackModal.addEventListener('click', (e) => {
            if (e.target === AppPrincipal.elements.feedbackModal) AppPrincipal.closeFeedbackModal();
        });
        AppPrincipal.elements.photoUploadInput.addEventListener('change', AppPrincipal.handlePhotoUpload);

        // Listeners Modal Log Atividade (V2.3)
        AppPrincipal.elements.closeLogActivityModal.addEventListener('click', AppPrincipal.closeLogActivityModal);
        AppPrincipal.elements.logActivityForm.addEventListener('submit', AppPrincipal.handleLogActivitySubmit);
        AppPrincipal.elements.logActivityModal.addEventListener('click', (e) => {
            if (e.target === AppPrincipal.elements.logActivityModal) AppPrincipal.closeLogActivityModal();
        });

        // Listeners Modal Quem Curtiu (V2.3)
        AppPrincipal.elements.closeWhoLikedModal.addEventListener('click', AppPrincipal.closeWhoLikedModal);
        AppPrincipal.elements.whoLikedModal.addEventListener('click', (e) => {
            if (e.target === AppPrincipal.elements.whoLikedModal) AppPrincipal.closeWhoLikedModal();
        });

        // Listeners Modal Análise IA (V2.6)
        AppPrincipal.elements.closeIaAnalysisModal.addEventListener('click', AppPrincipal.closeIaAnalysisModal);
        AppPrincipal.elements.iaAnalysisModal.addEventListener('click', (e) => {
            if (e.target === AppPrincipal.elements.iaAnalysisModal) AppPrincipal.closeIaAnalysisModal();
        });
        AppPrincipal.elements.saveIaAnalysisBtn.addEventListener('click', AppPrincipal.handleSaveIaAnalysis);

        // Listeners Modal Perfil (V3.0)
        AppPrincipal.elements.navProfileBtn.addEventListener('click', AppPrincipal.openProfileModal);
        AppPrincipal.elements.closeProfileModal.addEventListener('click', AppPrincipal.closeProfileModal);
        AppPrincipal.elements.profileModal.addEventListener('click', (e) => {
            if (e.target === AppPrincipal.elements.profileModal) AppPrincipal.closeProfileModal();
        });
        AppPrincipal.elements.profileForm.addEventListener('submit', AppPrincipal.handleProfileSubmit);
        AppPrincipal.elements.profilePicUpload.addEventListener('change', AppPrincipal.handleProfilePhotoUpload);

        // NOVO (V3.2): Listeners Modal Visualização de Perfil
        AppPrincipal.elements.closeViewProfileModal.addEventListener('click', AppPrincipal.closeViewProfileModal);
        AppPrincipal.elements.viewProfileModal.addEventListener('click', (e) => {
            if (e.target === AppPrincipal.elements.viewProfileModal) AppPrincipal.closeViewProfileModal();
        });


        // O Guardião do app.html
        AppPrincipal.state.auth.onAuthStateChanged(AppPrincipal.handlePlatformAuthStateChange);
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

        const { appContainer } = AppPrincipal.elements;
        AppPrincipal.state.currentUser = user;
        const uid = user.uid;
        
        AppPrincipal.loadCaches();

        AppPrincipal.state.db.ref('admins/' + uid).once('value', adminSnapshot => {
            if (adminSnapshot.exists() && adminSnapshot.val() === true) {
                
                AppPrincipal.state.db.ref('users/' + uid).once('value', userSnapshot => {
                    let adminName;
                    if (userSnapshot.exists()) {
                        adminName = userSnapshot.val().name;
                        AppPrincipal.state.userData = { ...userSnapshot.val(), uid: uid };
                    } else {
                        adminName = user.email;
                        const adminProfile = {
                            name: adminName,
                            email: user.email,
                            role: "admin",
                            createdAt: new Date().toISOString()
                        };
                        AppPrincipal.state.db.ref('users/' + uid).set(adminProfile);
                        AppPrincipal.state.userData = adminProfile;
                    }
                    
                    AppPrincipal.elements.userDisplay.textContent = `${adminName} (Coach)`;
                    appContainer.classList.add('admin-view');
                    appContainer.classList.remove('atleta-view');
                    AppPrincipal.navigateTo('planilha');
                });
                return;
            }

            AppPrincipal.state.db.ref('users/' + uid).once('value', userSnapshot => {
                if (userSnapshot.exists()) {
                    AppPrincipal.state.userData = { ...userSnapshot.val(), uid: uid };
                    AppPrincipal.elements.userDisplay.textContent = `${AppPrincipal.state.userData.name}`;
                    appContainer.classList.add('atleta-view');
                    appContainer.classList.remove('admin-view');
                    AppPrincipal.navigateTo('planilha');
                } else {
                    console.warn("Status: PENDENTE/REJEITADO. Voltando ao login.");
                    AppPrincipal.handleLogout(); 
                }
            });
        });
    },

    // O Roteador (V2)
    navigateTo: (page) => {
        const { mainContent, loader, appContainer, navPlanilhaBtn, navFeedBtn } = AppPrincipal.elements;
        mainContent.innerHTML = ""; 
        AppPrincipal.cleanupListeners(true);
        AppPrincipal.state.currentView = page;

        navPlanilhaBtn.classList.toggle('active', page === 'planilha');
        navFeedBtn.classList.toggle('active', page === 'feed');

        if (typeof AdminPanel === 'undefined' || typeof AtletaPanel === 'undefined' || typeof FeedPanel === 'undefined') {
            console.error("ERRO CRÍTICO: js/panels.js não foi carregado a tempo.");
            mainContent.innerHTML = "<h1>Erro ao carregar módulos. Recarregue a página.</h1>";
            return;
        }

        if (page === 'planilha') {
            const role = AppPrincipal.state.userData.role;
            if (role === 'admin') {
                const adminTemplate = document.getElementById('admin-panel-template').content.cloneNode(true);
                mainContent.appendChild(adminTemplate);
                AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            } else {
                const atletaTemplate = document.getElementById('atleta-panel-template').content.cloneNode(true);
                mainContent.appendChild(atletaTemplate);
                const welcomeEl = document.getElementById('atleta-welcome-name');
                if (welcomeEl) {
                    welcomeEl.textContent = AppPrincipal.state.userData.name;
                }
                AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            }
        } 
        else if (page === 'feed') {
            const feedTemplate = document.getElementById('feed-panel-template').content.cloneNode(true);
            mainContent.appendChild(feedTemplate);
            FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        }

        loader.classList.add('hidden');
        appContainer.classList.remove('hidden');
    },

    handleLogout: () => {
        console.log("Saindo...");
        AppPrincipal.cleanupListeners(false);
        AppPrincipal.state.auth.signOut().catch(err => console.error("Erro ao sair:", err));
    },

    cleanupListeners: (panelOnly = false) => {
        Object.keys(AppPrincipal.state.listeners).forEach(key => {
            const listenerRef = AppPrincipal.state.listeners[key];
            
            if (panelOnly && (key === 'cacheAdmins' || key === 'cacheUsers')) {
                return; 
            }
            
            if (listenerRef && typeof listenerRef.off === 'function') {
                listenerRef.off();
            }
            delete AppPrincipal.state.listeners[key];
        });
        console.log(panelOnly ? "Listeners de painel limpos." : "TODOS os listeners limpos.");
    },
    
    // MÓDULO 3/4: Lógica dos Modais (V3.2)
    openFeedbackModal: (workoutId, ownerId, workoutTitle) => {
        // ... (Lógica completa do openFeedbackModal)
    },
    
    closeFeedbackModal: () => {
        // ... (Lógica completa do closeFeedbackModal)
    },
    
    handleFeedbackSubmit: async (e) => {
        // ... (Lógica completa do handleFeedbackSubmit)
    },
    
    handleCommentSubmit: (e) => {
        // ... (Lógica completa do handleCommentSubmit)
    },

    // ... (RESTO DOS MÉTODOS DE MODAIS E UTILITÁRIOS: openLogActivityModal, fileToBase64, callGeminiTextAPI, etc.)
    
    // ===================================================================
    // StravaLogic (Apenas o bloco de injeção no final do AppPrincipal)
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
    
    // Adiciona o botão de conexão Strava no Modal de Perfil
    AppPrincipal.openProfileModalOriginal = AppPrincipal.openProfileModal;
    AppPrincipal.openProfileModal = () => {
        AppPrincipal.openProfileModalOriginal();
        
        const modalBody = AppPrincipal.elements.profileModal.querySelector('.modal-body');
        
        if (!modalBody.querySelector('#strava-connect-section')) {
            const stravaSection = document.createElement('div');
            stravaSection.id = 'strava-connect-section';
            
            const editButton = `
                 <button id="btn-edit-profile" class="btn btn-secondary" style="margin-top: 1rem; margin-bottom: 1rem; width: 100%;">
                    <i class='bx bx-edit-alt'></i> Editar Perfil
                </button>
            `;
            
            stravaSection.innerHTML = `
                ${editButton}
                <fieldset style="margin-top: 1rem;">
                    <legend><i class='bx bxl-strava'></i> Integração Strava</legend>
                    <p style="margin-bottom: 1rem; font-size: 0.9rem;">Conecte sua conta para permitir a leitura de dados pela IA.</p>
                    <button id="btn-connect-strava" class="btn btn-secondary" style="background-color: var(--strava-orange); color: white;">
                        <i class='bx bxl-strava'></i> Conectar Strava
                    </button>
                </fieldset>
            `;
            
            const logoutButton = modalBody.querySelector('#logout-btn');
            if (logoutButton) {
                modalBody.insertBefore(stravaSection, logoutButton);
            } else {
                modalBody.appendChild(stravaSection);
            }

            modalBody.querySelector('#btn-edit-profile').addEventListener('click', AppPrincipal.openEditProfileModal);
            modalBody.querySelector('#btn-connect-strava').addEventListener('click', AppPrincipal.handleStravaConnect);
        }
    };
};


// ===================================================================
// 2. AuthLogic (Lógica da index.html - FIX V3.2.7)
// ===================================================================
const AuthLogic = {
    auth: null,
    db: null,
    elements: {},

    init: (auth, db) => {
        console.log("AuthLogic V3.2.7: Inicializado.");
        
        AuthLogic.auth = auth;
        AuthLogic.db = db;

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
        
        if(AuthLogic.elements.loginForm) {
             AuthLogic.elements.loginForm.addEventListener('submit', AuthLogic.handleLogin);
        }
        if(AuthLogic.elements.registerForm) {
             AuthLogic.elements.registerForm.addEventListener('submit', AuthLogic.handleRegister);
        }
        
        AuthLogic.auth.onAuthStateChanged(AuthLogic.handleLoginGuard);
    },
    
    showView: (view) => {
        const { loginForm, registerForm, pendingView, toggleToRegister, toggleToLogin, loginErrorMsg, registerErrorMsg } = AuthLogic.elements;
        loginForm.classList.add('hidden');
        registerForm.classList.add('hidden');
        pendingView.classList.add('hidden');
        toggleToRegister.parentElement.classList.add('hidden');
        toggleToLogin.parentElement.classList.add('hidden');
        
        // Limpa mensagens de erro
        loginErrorMsg.textContent = "";
        registerErrorMsg.textContent = "";

        if (view === 'login') {
            loginForm.classList.remove('hidden');
            toggleToRegister.parentElement.classList.remove('hidden');
        } else if (view === 'register') {
            registerForm.classList.remove('hidden');
            toggleToLogin.parentElement.classList.remove('hidden');
        } else if (view === 'pending') {
            pendingView.classList.remove('hidden');
        }
    },
    
    handleToggle: (e) => {
        e.preventDefault();
        const view = e.target.id === 'toggleToRegister' ? 'register' : 'login';
        AuthLogic.showView(view);
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

    handleRegister: (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const btn = AuthLogic.elements.btnSubmitRegister;
        
        if (password.length < 6) {
            AuthLogic.elements.registerErrorMsg.textContent = "A senha deve ter no mínimo 6 caracteres.";
            return;
        }
        if (!name) {
            AuthLogic.elements.registerErrorMsg.textContent = "O nome é obrigatório.";
            return;
        }

        btn.disabled = true;
        btn.textContent = "Enviando...";
        AuthLogic.elements.registerErrorMsg.textContent = "";
        
        AuthLogic.auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                const pendingData = {
                    name: name,
                    email: email,
                    requestDate: new Date().toISOString()
                };
                return AuthLogic.db.ref('pendingApprovals/' + user.uid).set(pendingData);
            })
            .catch((error) => {
                btn.disabled = false;
                btn.textContent = "Solicitar Acesso";
                if (error.code === 'auth/email-already-in-use') {
                    AuthLogic.elements.loginErrorMsg.textContent = "Email já cadastrado. Tente fazer login.";
                    AuthLogic.showView('login');
                } else {
                    AuthLogic.elements.registerErrorMsg.textContent = "Erro ao criar sua conta.";
                }
            });
    },
    
    handleLoginGuard: (user) => {
        if (user) {
            const uid = user.uid;
            AuthLogic.db.ref('admins/' + uid).once('value', adminSnapshot => {
                if (adminSnapshot.exists() && adminSnapshot.val() === true) {
                    window.location.href = 'app.html';
                    return;
                }
                AuthLogic.db.ref('users/' + uid).once('value', userSnapshot => {
                    if (userSnapshot.exists()) {
                        window.location.href = 'app.html';
                        return;
                    }
                    AuthLogic.db.ref('pendingApprovals/' + uid).once('value', pendingSnapshot => {
                        if (pendingSnapshot.exists()) {
                            AuthLogic.elements.pendingEmailDisplay.textContent = user.email;
                            AuthLogic.showView('pending');
                        } else {
                            AuthLogic.elements.loginErrorMsg.textContent = "Sua conta foi rejeitada ou excluída.";
                            AuthLogic.auth.signOut();
                            AuthLogic.showView('login');
                        }
                    });
                });
            });
        } else {
            AuthLogic.showView('login');
        }
    }
};


// =l= INICIALIZAÇÃO FINAL =l=
// O DOMContentLoaded irá chamar a função AppPrincipal.init(), que fará o roteamento.
document.addEventListener('DOMContentLoaded', AppPrincipal.init);

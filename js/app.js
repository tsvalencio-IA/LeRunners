/* =================================================================== */
/* APP.JS - VERSÃO 4.0 + FINANCEIRO (EVOLUÇÃO)
/* =================================================================== */

const AppPrincipal = {
    state: {
        currentUser: null,
        userData: null,
        db: null,
        auth: null,
        listeners: {},
        currentView: 'planilha',
        viewMode: 'admin', // Controla a visão (Admin vs Atleta)
        adminUIDs: {},
        userCache: {},
        modal: { isOpen: false, currentWorkoutId: null, currentOwnerId: null, newPhotoUrl: null },
        stravaTokenData: null,
        currentAnalysisData: null
    },
    elements: {},

    // ===================================================================
    // 1. INICIALIZAÇÃO
    // ===================================================================
    init: () => {
        if (typeof window.firebaseConfig === 'undefined') return;
        try {
            if (firebase.apps.length === 0) {
                firebase.initializeApp(window.firebaseConfig);
            }
        } catch (e) {
            console.error("Erro Firebase:", e);
        }

        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        if (document.getElementById('login-form')) {
            AuthLogic.init(AppPrincipal.state.auth, AppPrincipal.state.db);
        } else if (document.getElementById('app-container')) {
            AppPrincipal.injectStravaLogic();
            AppPrincipal.initPlatform();
        }
    },
    
    injectStravaLogic: () => {
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
                window.history.replaceState({}, document.title, "app.html");
            }
        };
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
            navFinanceBtn: document.getElementById('nav-finance-btn'), // NOVO FINANCEIRO
            
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
        
        // Listeners
        AppPrincipal.elements.logoutButton.addEventListener('click', AppPrincipal.handleLogout);
        AppPrincipal.elements.navPlanilhaBtn.addEventListener('click', () => AppPrincipal.navigateTo('planilha'));
        AppPrincipal.elements.navFeedBtn.addEventListener('click', () => AppPrincipal.navigateTo('feed'));
        AppPrincipal.elements.navFinanceBtn.addEventListener('click', () => AppPrincipal.navigateTo('finance')); // ROTA FINANCEIRO
        
        AppPrincipal.elements.closeFeedbackModal.addEventListener('click', AppPrincipal.closeFeedbackModal);
        AppPrincipal.elements.feedbackForm.addEventListener('submit', AppPrincipal.handleFeedbackSubmit);
        AppPrincipal.elements.commentForm.addEventListener('submit', AppPrincipal.handleCommentSubmit);
        AppPrincipal.elements.photoUploadInput.addEventListener('change', AppPrincipal.handlePhotoUpload);

        AppPrincipal.elements.closeLogActivityModal.addEventListener('click', AppPrincipal.closeLogActivityModal);
        AppPrincipal.elements.logActivityForm.addEventListener('submit', AppPrincipal.handleLogActivitySubmit);

        AppPrincipal.elements.closeWhoLikedModal.addEventListener('click', AppPrincipal.closeWhoLikedModal);
        AppPrincipal.elements.closeIaAnalysisModal.addEventListener('click', AppPrincipal.closeIaAnalysisModal);
        AppPrincipal.elements.saveIaAnalysisBtn.addEventListener('click', AppPrincipal.handleSaveIaAnalysis);

        AppPrincipal.elements.navProfileBtn.addEventListener('click', AppPrincipal.openProfileModal);
        AppPrincipal.elements.closeProfileModal.addEventListener('click', AppPrincipal.closeProfileModal);
        AppPrincipal.elements.profileForm.addEventListener('submit', AppPrincipal.handleProfileSubmit);
        AppPrincipal.elements.profilePicUpload.addEventListener('change', AppPrincipal.handleProfilePhotoUpload);

        AppPrincipal.elements.closeViewProfileModal.addEventListener('click', AppPrincipal.closeViewProfileModal);

        AppPrincipal.state.auth.onAuthStateChanged(AppPrincipal.handlePlatformAuthStateChange);
    },

    loadCaches: () => {
        const adminsRef = AppPrincipal.state.db.ref('admins');
        AppPrincipal.state.listeners['cacheAdmins'] = adminsRef;
        adminsRef.on('value', snapshot => {
            AppPrincipal.state.adminUIDs = snapshot.val() || {};
        });

        const usersRef = AppPrincipal.state.db.ref('users');
        AppPrincipal.state.listeners['cacheUsers'] = usersRef;
        usersRef.on('value', snapshot => {
            AppPrincipal.state.userCache = snapshot.val() || {};
        });
    },

    // ===================================================================
    // 2. AUTH & DADOS
    // ===================================================================
    handlePlatformAuthStateChange: (user) => {
        if (!user) {
            AppPrincipal.cleanupListeners(false);
            window.location.href = 'index.html';
            return;
        }

        const { appContainer, navFinanceBtn } = AppPrincipal.elements;
        AppPrincipal.state.currentUser = user;
        const uid = user.uid;
        
        AppPrincipal.loadCaches();

        AppPrincipal.state.db.ref(`users/${uid}/stravaAuth`).on('value', snapshot => {
            AppPrincipal.state.stravaTokenData = snapshot.val();
        });

        AppPrincipal.state.db.ref('admins/' + uid).once('value', adminSnapshot => {
            if (adminSnapshot.exists() && adminSnapshot.val() === true) {
                // É ADMIN
                navFinanceBtn.classList.remove('hidden'); // MOSTRA BOTÃO FINANCEIRO

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
                        AppPrincipal.state.userData = { ...adminProfile, uid: uid };
                    }
                    AppPrincipal.state.viewMode = 'admin';
                    AppPrincipal.elements.userDisplay.textContent = `Admin: ${adminName}`;
                    AppPrincipal.elements.appContainer.classList.remove('hidden');
                    AppPrincipal.elements.loader.classList.add('hidden');
                    AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
                    AppPrincipal.navigateTo('admin');
                });
            } else {
                // É ATLETA
                navFinanceBtn.classList.add('hidden'); // ESCONDE BOTÃO FINANCEIRO
                AppPrincipal.state.db.ref('users/' + uid).once('value', userSnapshot => {
                    if (userSnapshot.exists()) {
                        AppPrincipal.state.userData = { ...userSnapshot.val(), uid: uid };
                        AppPrincipal.state.viewMode = 'atleta';
                        AppPrincipal.elements.userDisplay.textContent = `Atleta: ${AppPrincipal.state.userData.name}`;
                        AppPrincipal.elements.appContainer.classList.remove('hidden');
                        AppPrincipal.elements.loader.classList.add('hidden');
                        AthletePanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
                        AppPrincipal.navigateTo('planilha');
                    } else {
                        // Usuário logado, mas sem perfil (pendente ou rejeitado)
                        AppPrincipal.state.auth.signOut();
                    }
                });
            }
        });
    },

    cleanupListeners: (isSwitching) => {
        Object.entries(AppPrincipal.state.listeners).forEach(([key, ref]) => {
            if (key.startsWith('cache') && isSwitching) return;
            if (ref && typeof ref.off === 'function') {
                ref.off();
            }
        });
        if (!isSwitching) {
            AppPrincipal.state.listeners = {};
        }
    },

    handleLogout: () => {
        AppPrincipal.cleanupListeners(false);
        AppPrincipal.state.auth.signOut();
    },

    navigateTo: (view) => {
        AppPrincipal.state.currentView = view;
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.app-panel').forEach(panel => panel.classList.add('hidden'));

        if (view === 'planilha') {
            AppPrincipal.elements.navPlanilhaBtn.classList.add('active');
            document.getElementById('athlete-panel').classList.remove('hidden');
            AthletePanel.renderWorkouts();
        } else if (view === 'feed') {
            AppPrincipal.elements.navFeedBtn.classList.add('active');
            document.getElementById('feed-panel').classList.remove('hidden');
            FeedPanel.renderFeed();
        } else if (view === 'finance') {
            AppPrincipal.elements.navFinanceBtn.classList.add('active');
            document.getElementById('finance-panel').classList.remove('hidden');
            FinancePanel.renderFinance();
        } else if (view === 'admin') {
            document.getElementById('admin-panel').classList.remove('hidden');
            AdminPanel.renderAthleteList();
        }
    },

    // ===================================================================
    // 3. MODAIS E FUNÇÕES GERAIS
    // ===================================================================

    // ... (O restante do código do app.js original, incluindo as funções de modal, upload, etc.)

    // --- STRAVA AUTH ---
    connectStrava: () => {
        if (!AppPrincipal.state.currentUser) {
            alert("Você precisa estar logado para conectar o Strava.");
            return;
        }
        const config = window.STRAVA_PUBLIC_CONFIG;
        const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${config.clientID}&response_type=code&redirect_uri=${config.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all,profile:read_all`;
        window.location.href = stravaAuthUrl;
    },

    exchangeStravaCode: async (stravaCode) => {
        const VERCEL_API_URL = window.STRAVA_PUBLIC_CONFIG.vercelExchangeAPI;
        const user = AppPrincipal.state.currentUser;

        try {
            const idToken = await user.getIdToken();
            const response = await fetch(VERCEL_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ code: stravaCode })
            });

            const result = await response.json();
            if (response.ok) {
                alert("Strava conectado com sucesso!");
                window.history.replaceState({}, document.title, "app.html");
                window.location.reload();
            } else {
                alert(`Falha: ${result.details || result.error}`);
                window.location.href = 'app.html';
            }
        } catch (error) {
            alert("Erro de rede ao conectar Strava.");
            window.location.href = 'app.html';
        }
    },

    // NOVO: Função para renovar o token do Strava
    refreshStravaToken: async () => {
        const VERCEL_API_URL = window.STRAVA_PUBLIC_CONFIG.vercelRefreshAPI;
        const user = AppPrincipal.state.currentUser;

        try {
            const idToken = await user.getIdToken();
            const response = await fetch(VERCEL_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({}) // Não precisa de corpo, o backend pega o refresh token do Firebase
            });

            const result = await response.json();
            if (response.ok) {
                console.log("Token Strava renovado com sucesso! Novo expira em:", new Date(result.newExpiresAt * 1000));
                // O listener do Firebase em handlePlatformAuthStateChange irá atualizar AppPrincipal.state.stravaTokenData
                return true;
            } else {
                console.error("Falha na renovação do token Strava:", result.details || result.error);
                // Se falhar, forçamos a desconexão para o usuário reconectar
                AppPrincipal.disconnectStrava();
                return false;
            }
        } catch (error) {
            console.error("Erro de rede ao renovar token Strava:", error);
            return false;
        }
    },

    // NOVO: Função para verificar se o token está expirado e renovar se necessário
    checkAndRefreshStravaToken: async () => {
        const { stravaTokenData } = AppPrincipal.state;

        if (!stravaTokenData || !stravaTokenData.accessToken) {
            return false; // Não conectado
        }

        // O token expira em 'expiresAt' (timestamp UNIX em segundos)
        // O token é válido por 6 horas (21600 segundos)
        // Verificamos se ele expira nos próximos 10 minutos (600 segundos) para renovar proativamente
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = stravaTokenData.expiresAt;
        const timeUntilExpiration = expiresAt - now;

        if (timeUntilExpiration < 600) { // Menos de 10 minutos para expirar
            console.log(`Token Strava expirando em ${timeUntilExpiration} segundos. Tentando renovar...`);
            return await AppPrincipal.refreshStravaToken();
        }

        return true; // Token ainda válido
    },

    disconnectStrava: () => {
        // Lógica para limpar os dados do Strava no Firebase e no frontend
        if (AppPrincipal.state.currentUser) {
            AppPrincipal.state.db.ref(`users/${AppPrincipal.state.currentUser.uid}/stravaAuth`).remove();
            AppPrincipal.state.stravaTokenData = null;
            alert("Conexão Strava desconectada. Por favor, reconecte.");
            // Recarrega a página para atualizar a UI
            window.location.reload();
        }
    },

    // --- STRAVA SYNC (V2 Pura) ---
    handleStravaSyncActivities: async () => {
        const { stravaTokenData, currentUser } = AppPrincipal.state;
        const btn = document.getElementById('btn-sync-strava');
        const statusEl = document.getElementById('strava-sync-status');
        
        if (!stravaTokenData || !stravaTokenData.accessToken) {
            alert("Erro: Token não encontrado. Tente reconectar.");
            return;
        }

        btn.disabled = true;
        statusEl.textContent = "Sincronizando...";

        try {
            // 1. Verifica e renova o token antes de fazer a chamada
            const tokenValid = await AppPrincipal.checkAndRefreshStravaToken();
            if (!tokenValid) {
                statusEl.textContent = "Erro: Token Strava expirado ou falha na renovação. Por favor, reconecte.";
                btn.disabled = false;
                return;
            }

            // 2. Pega o token atualizado (o listener do Firebase já deve ter atualizado o state)
            const currentToken = AppPrincipal.state.stravaTokenData.accessToken;

            const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=50`, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });

            if (!response.ok) throw new Error("Erro Strava API.");

            const activities = await response.json();
            const existingWorkoutsRef = AppPrincipal.state.db.ref(`data/${currentUser.uid}/workouts`);
            const snapshot = await existingWorkoutsRef.once('value');
            const existingWorkouts = snapshot.val() || {};
            
            const updates = {};
            let count = 0;

            activities.forEach(act => {
                let alreadyExists = false;
                for (const key in existingWorkouts) {
                    if (String(existingWorkouts[key].stravaActivityId) === String(act.id)) {
                        alreadyExists = true;
                        break;
                    }
                }

                if (!alreadyExists) {
                    const newKey = AppPrincipal.state.db.ref().push().key;
                    
                    const distKm = (act.distance / 1000).toFixed(2) + " km";
                    const paceMin = Math.floor((act.moving_time / 60) / (act.distance / 1000));
                    const paceSec = Math.floor(((act.moving_time / 60) / (act.distance / 1000) - paceMin) * 60);
                    const ritmoStr = `${paceMin}:${paceSec.toString().padStart(2, '0')} /km`;
                    
                    const workoutData = {
                        date: new Date(act.start_date).toISOString().split('T')[0],
                        type: act.type,
                        distance: distKm,
                        duration: act.moving_time,
                        pace: ritmoStr,
                        stravaActivityId: act.id,
                        stravaLink: `https://www.strava.com/activities/${act.id}`,
                        status: 'Realizado',
                        feedback: 'Sincronizado via Strava',
                        ownerId: currentUser.uid,
                        createdAt: new Date().toISOString()
                    };
                    updates[`/data/${currentUser.uid}/workouts/${newKey}`] = workoutData;
                    count++;
                }
            });

            if (count > 0) {
                await AppPrincipal.state.db.ref().update(updates);
                statusEl.textContent = `Sincronização concluída. ${count} novas atividades adicionadas.`;
            } else {
                statusEl.textContent = "Sincronização concluída. Nenhuma nova atividade encontrada.";
            }

        } catch (error) {
            console.error("Erro na sincronização Strava:", error);
            statusEl.textContent = `Erro na sincronização: ${error.message}`;
        } finally {
            btn.disabled = false;
        }
    },

    // ... (O restante do código do app.js original, incluindo AuthLogic)
    // ===================================================================
    // 4. LÓGICA DE FEEDBACK
    // ===================================================================
    // ... (código original)

    // ===================================================================
    // 5. LÓGICA DE COMENTÁRIOS E LIKES
    // ===================================================================
    // ... (código original)

    // ===================================================================
    // 6. LÓGICA DE UPLOAD DE FOTOS (CLOUDINARY)
    // ===================================================================
    // ... (código original)

    // ===================================================================
    // 7. LÓGICA DE ANÁLISE DE IA (GEMINI)
    // ===================================================================
    // ... (código original)

    // ===================================================================
    // 8. LÓGICA DE PERFIL
    // ===================================================================
    // ... (código original)

    // ===================================================================
    // 9. LÓGICA DE FINANÇAS (ADMIN)
    // ===================================================================
    // ... (código original)

    // ===================================================================
    // 10. LÓGICA DE AUTENTICAÇÃO (index.html)
    // ===================================================================
    // ... (código original)
};

// ... (O restante do código do app.js original, incluindo AuthLogic)
// ===================================================================
// 2. AuthLogic (Lógica da index.html)
// ===================================================================
const AuthLogic = {
    auth: null, db: null, elements: {},
    init: (auth, db) => {
        AuthLogic.auth = auth; AuthLogic.db = db;
        AuthLogic.elements = {
            loginForm: document.getElementById('login-form'), registerForm: document.getElementById('register-form'),
            pendingView: document.getElementById('pending-view'), btnLogoutPending: document.getElementById('btn-logout-pending'),
            loginErrorMsg: document.getElementById('login-error'), registerErrorMsg: document.getElementById('register-error'),
            toggleToRegister: document.getElementById('toggleToRegister'), toggleToLogin: document.getElementById('toggleToLogin'),
            pendingEmailDisplay: document.getElementById('pending-email-display')
        };
        AuthLogic.elements.toggleToRegister.addEventListener('click', e => { e.preventDefault(); AuthLogic.showView('register'); });
        AuthLogic.elements.toggleToLogin.addEventListener('click', e => { e.preventDefault(); AuthLogic.showView('login'); });
        AuthLogic.elements.btnLogoutPending.addEventListener('click', () => AuthLogic.auth.signOut());
        if(AuthLogic.elements.loginForm) AuthLogic.elements.loginForm.addEventListener('submit', AuthLogic.handleLogin);
        if(AuthLogic.elements.registerForm) AuthLogic.elements.registerForm.addEventListener('submit', AuthLogic.handleRegister);
        AuthLogic.auth.onAuthStateChanged(AuthLogic.handleLoginGuard);
    },
    showView: (view) => {
        const { loginForm, registerForm, pendingView, toggleToRegister, toggleToLogin, loginErrorMsg, registerErrorMsg } = AuthLogic.elements;
        loginForm.classList.add('hidden'); registerForm.classList.add('hidden'); pendingView.classList.add('hidden');
        toggleToRegister.parentElement.classList.add('hidden'); toggleToLogin.parentElement.classList.add('hidden');
        loginErrorMsg.textContent = ""; registerErrorMsg.textContent = "";
        if (view === 'login') { loginForm.classList.remove('hidden'); toggleToRegister.parentElement.classList.remove('hidden'); }
        else if (view === 'register') { registerForm.classList.remove('hidden'); toggleToLogin.parentElement.classList.remove('hidden'); }
        else if (view === 'pending') { pendingView.classList.remove('hidden'); }
    },
    handleLogin: (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value; const password = document.getElementById('loginPassword').value;
        AuthLogic.auth.signInWithEmailAndPassword(email, password).catch(() => AuthLogic.elements.loginErrorMsg.textContent = "Email ou senha incorretos.");
    },
    handleRegister: (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value; const email = document.getElementById('registerEmail').value; const password = document.getElementById('registerPassword').value;
        if(password.length<6) return AuthLogic.elements.registerErrorMsg.textContent = "Senha mínima 6 caracteres.";
        AuthLogic.auth.createUserWithEmailAndPassword(email, password)
            .then((c) => AuthLogic.db.ref('pendingApprovals/'+c.user.uid).set({ name, email, requestDate: new Date().toISOString() }))
            .catch(e => AuthLogic.elements.registerErrorMsg.textContent = e.code === 'auth/email-already-in-use' ? "Email já existe." : "Erro ao criar conta.");
    },
    handleLoginGuard: (user) => {
        if (!user) return AuthLogic.showView('login');
        AuthLogic.db.ref('admins/' + user.uid).once('value', s => {
            if (s.exists() && s.val()) return window.location.href = 'app.html';
            AuthLogic.db.ref('users/' + user.uid).once('value', s2 => {
                if (s2.exists()) return window.location.href = 'app.html';
                AuthLogic.db.ref('pendingApprovals/' + user.uid).once('value', s3 => {
                    if (s3.exists()) { if(AuthLogic.elements.pendingEmailDisplay) AuthLogic.elements.pendingEmailDisplay.textContent = user.email; AuthLogic.showView('pending'); }
                    else { AuthLogic.auth.signOut(); AuthLogic.showView('login'); }
                });
            });
        });
    }
};

document.addEventListener('DOMContentLoaded', AppPrincipal.init);

// ... (O restante do código do app.js original, incluindo AthletePanel, AdminPanel, FeedPanel, FinancePanel)
// ===================================================================
// 3. AthletePanel (Lógica do Painel Atleta)
// ===================================================================
const AthletePanel = {
    // ... (código original)
};

// ===================================================================
// 4. AdminPanel (Lógica do Painel Coach)
// ===================================================================
const AdminPanel = {
    // ... (código original)
};

// ===================================================================
// 5. FeedPanel (Lógica do Feed de Atividades)
// ===================================================================
const FeedPanel = {
    // ... (código original)
};

// ===================================================================
// 6. FinancePanel (Lógica do Painel Financeiro)
// ===================================================================
const FinancePanel = {
    // ... (código original)
};

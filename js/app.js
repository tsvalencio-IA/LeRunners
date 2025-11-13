/* =================================================================== */
/* ARQUIVO DE LÓGICA UNIFICADO (V2.0 - MÓDULO SOCIAL)
/* ARQUITETURA: corri_rp (com fluxo de aprovação)
/* =================================================================== */

// ===================================================================
// 1. AppPrincipal (O Cérebro)
// ===================================================================
const AppPrincipal = {
    state: {
        currentUser: null, // O objeto 'user' do Auth
        userData: null,    // O perfil de '/users/' (name, role)
        db: null,
        auth: null,
        listeners: {},     // Para limpar listeners do Firebase
        currentView: 'planilha', // 'planilha' ou 'feed'
        modal: {
            isOpen: false,
            currentWorkoutId: null,
            currentOwnerId: null
        }
    },

    init: () => {
        console.log("Iniciando AppPrincipal V2...");
        
        if (typeof firebaseConfig === 'undefined' || firebaseConfig.apiKey.includes("COLE_SUA_CHAVE")) {
            console.error("ERRO CRÍTICO: config.js não carregado.");
            document.body.innerHTML = "<h1>Erro Crítico: O arquivo js/config.js não foi configurado. Cole suas chaves do Firebase.</h1>";
            return;
        }

        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
        } catch (e) {
            console.error('Falha ao inicializar Firebase:', e);
            document.body.innerHTML = "<h1>Erro Crítico: Falha ao conectar com o Firebase. Verifique seu config.js.</h1>";
            return;
        }

        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        // Roteamento: O script está na index.html ou app.html?
        if (document.getElementById('login-form')) {
            console.log("Modo: Autenticação (index.html)");
            AuthLogic.init(AppPrincipal.state.auth, AppPrincipal.state.db);
        } else if (document.getElementById('app-container')) {
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
            
            // Navegação V2
            navPlanilhaBtn: document.getElementById('nav-planilha-btn'),
            navFeedBtn: document.getElementById('nav-feed-btn'),
            
            // Modal V2
            feedbackModal: document.getElementById('feedback-modal'),
            closeFeedbackModal: document.getElementById('close-feedback-modal'),
            feedbackModalTitle: document.getElementById('feedback-modal-title'),
            feedbackForm: document.getElementById('feedback-form'),
            workoutStatusSelect: document.getElementById('workout-status'),
            workoutFeedbackText: document.getElementById('workout-feedback-text'),
            
            // Comentários V2
            commentForm: document.getElementById('comment-form'),
            commentInput: document.getElementById('comment-input'),
            commentsList: document.getElementById('comments-list')
        };
        
        // Listeners de Navegação
        AppPrincipal.elements.logoutButton.addEventListener('click', AppPrincipal.handleLogout);
        AppPrincipal.elements.navPlanilhaBtn.addEventListener('click', () => AppPrincipal.navigateTo('planilha'));
        AppPrincipal.elements.navFeedBtn.addEventListener('click', () => AppPrincipal.navigateTo('feed'));
        
        // Listeners do Modal
        AppPrincipal.elements.closeFeedbackModal.addEventListener('click', AppPrincipal.closeFeedbackModal);
        AppPrincipal.elements.feedbackForm.addEventListener('submit', AppPrincipal.handleFeedbackSubmit);
        AppPrincipal.elements.commentForm.addEventListener('submit', AppPrincipal.handleCommentSubmit);
        // Clicar fora do modal para fechar
        AppPrincipal.elements.feedbackModal.addEventListener('click', (e) => {
            if (e.target === AppPrincipal.elements.feedbackModal) {
                AppPrincipal.closeFeedbackModal();
            }
        });

        // O Guardião do app.html
        AppPrincipal.state.auth.onAuthStateChanged(AppPrincipal.handlePlatformAuthStateChange);
    },

    // O Guardião (só roda no app.html)
    handlePlatformAuthStateChange: (user) => {
        if (!user) {
            console.log("Guardião (Plataforma): Acesso negado. Redirecionando para login.");
            AppPrincipal.cleanupListeners();
            window.location.href = 'index.html';
            return;
        }

        AppPrincipal.state.currentUser = user;
        const uid = user.uid;

        // 1. É Admin?
        AppPrincipal.state.db.ref('admins/' + uid).once('value', adminSnapshot => {
            if (adminSnapshot.exists() && adminSnapshot.val() === true) {
                AppPrincipal.state.db.ref('users/' + uid).once('value', userSnapshot => {
                    let adminName = userSnapshot.exists() ? userSnapshot.val().name : user.email;
                    AppPrincipal.state.userData = { name: adminName, role: 'admin', uid: uid };
                    AppPrincipal.elements.userDisplay.textContent = `${adminName} (Coach)`;
                    AppPrincipal.navigateTo('planilha'); // Coach começa na planilha
                });
                return;
            }

            // 2. É Atleta Aprovado?
            AppPrincipal.state.db.ref('users/' + uid).once('value', userSnapshot => {
                if (userSnapshot.exists()) {
                    AppPrincipal.state.userData = { ...userSnapshot.val(), uid: uid };
                    AppPrincipal.elements.userDisplay.textContent = `${AppPrincipal.state.userData.name}`;
                    AppPrincipal.navigateTo('planilha'); // Atleta começa na planilha
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
        AppPrincipal.cleanupListeners();
        AppPrincipal.state.currentView = page;

        // Atualiza botões de navegação
        navPlanilhaBtn.classList.toggle('active', page === 'planilha');
        navFeedBtn.classList.toggle('active', page === 'feed');

        if (page === 'planilha') {
            // Rota da Planilha (depende da role)
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
            // Rota do Feed (igual para todos)
            const feedTemplate = document.getElementById('feed-panel-template').content.cloneNode(true);
            mainContent.appendChild(feedTemplate);
            FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        }

        loader.classList.add('hidden');
        appContainer.classList.remove('hidden');
    },

    handleLogout: () => {
        console.log("Saindo...");
        AppPrincipal.state.auth.signOut().catch(err => console.error("Erro ao sair:", err));
    },

    cleanupListeners: () => {
        Object.values(AppPrincipal.state.listeners).forEach(listener => {
            if (listener && typeof listener.off === 'function') {
                listener.off();
            }
        });
        AppPrincipal.state.listeners = {};
        console.log("Listeners do Firebase limpos.");
    },
    
    // ===================================================================
    // MÓDULO 3: Lógica do Modal de Feedback/Comentários (V2)
    // ===================================================================
    
    openFeedbackModal: (workoutId, ownerId, workoutTitle) => {
        const { feedbackModal, feedbackModalTitle, workoutStatusSelect, workoutFeedbackText, commentsList, commentInput } = AppPrincipal.elements;
        
        console.log(`Abrindo modal para treino: ${workoutId} (Dono: ${ownerId})`);
        
        // Salva o estado atual no Modal
        AppPrincipal.state.modal.isOpen = true;
        AppPrincipal.state.modal.currentWorkoutId = workoutId;
        AppPrincipal.state.modal.currentOwnerId = ownerId;
        
        feedbackModalTitle.textContent = workoutTitle || "Feedback do Treino";
        
        // Limpa o modal
        workoutStatusSelect.value = 'planejado';
        workoutFeedbackText.value = '';
        commentsList.innerHTML = "<p>Carregando...</p>";
        commentInput.value = '';
        
        // 1. Carrega os dados do treino (status e feedback)
        const workoutRef = AppPrincipal.state.db.ref(`data/${ownerId}/workouts/${workoutId}`);
        workoutRef.once('value', snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                workoutStatusSelect.value = data.status || 'planejado';
                workoutFeedbackText.value = data.feedback || '';
            }
        });
        
        // 2. Carrega os Comentários (do nó /workoutComments/)
        const commentsRef = AppPrincipal.state.db.ref(`workoutComments/${workoutId}`);
        AppPrincipal.state.listeners['modalComments'] = commentsRef; // Registra o listener
        
        commentsRef.orderByChild('timestamp').on('value', snapshot => {
            commentsList.innerHTML = "";
            if (!snapshot.exists()) {
                commentsList.innerHTML = "<p>Nenhum comentário ainda.</p>";
                return;
            }
            snapshot.forEach(childSnapshot => {
                const data = childSnapshot.val();
                const item = document.createElement('div');
                item.className = 'comment-item';
                // Formata a data (simples)
                const date = new Date(data.timestamp).toLocaleString('pt-BR', { timeStyle: 'short', dateStyle: 'short' });
                item.innerHTML = `
                    <p><strong>${data.name}:</strong> ${data.text}</p>
                    <span>${date}</span>
                `;
                commentsList.appendChild(item);
            });
            commentsList.scrollTop = commentsList.scrollHeight; // Rola para o final
        });
        
        // 3. Carrega Curtidas (V2 - Lógica de Curtir)
        // (Será implementado no Card, não no modal por enquanto)
        
        feedbackModal.classList.remove('hidden');
    },
    
    closeFeedbackModal: () => {
        AppPrincipal.state.modal.isOpen = false;
        AppPrincipal.elements.feedbackModal.classList.add('hidden');
        
        // Limpa os listeners do modal (essencial)
        if (AppPrincipal.state.listeners['modalComments']) {
            AppPrincipal.state.listeners['modalComments'].off();
            delete AppPrincipal.state.listeners['modalComments'];
        }
    },
    
    // Salva o "Status" e "Feedback" (só o atleta pode)
    handleFeedbackSubmit: (e) => {
        e.preventDefault();
        const { workoutStatusSelect, workoutFeedbackText } = AppPrincipal.elements;
        const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        
        // Segurança: Só o dono do treino pode enviar feedback
        if (currentOwnerId !== AppPrincipal.state.currentUser.uid) {
            alert("Você só pode salvar o feedback dos seus próprios treinos.");
            return;
        }

        const feedbackData = {
            status: workoutStatusSelect.value,
            feedback: workoutFeedbackText.value,
            realizadoAt: new Date().toISOString()
        };

        const workoutRef = AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`);
        workoutRef.update(feedbackData)
            .then(() => {
                console.log("Feedback salvo!");
                AppPrincipal.closeFeedbackModal();
            })
            .catch(err => alert("Erro ao salvar feedback: " + err.message));
    },
    
    // Salva um novo comentário
    handleCommentSubmit: (e) => {
        e.preventDefault();
        const { commentInput } = AppPrincipal.elements;
        const { currentWorkoutId } = AppPrincipal.state.modal;
        const text = commentInput.value.trim();
        
        if (!text) return;

        const commentData = {
            uid: AppPrincipal.state.currentUser.uid,
            name: AppPrincipal.state.userData.name,
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        AppPrincipal.state.db.ref(`workoutComments/${currentWorkoutId}`).push(commentData)
            .then(() => {
                commentInput.value = ""; // Limpa o input
            })
            .catch(err => alert("Erro ao enviar comentário: " + err.message));
    }
};

// ===================================================================
// 2. AuthLogic (Lógica da index.html)
// ===================================================================
const AuthLogic = {
    // ... (Sem alterações da V1.2 - O código é o mesmo da resposta anterior) ...
    // ... (Este bloco inteiro é idêntico ao V1.2) ...
    init: (auth, db) => {
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
            toggleToLogin: document.getElementById('toggleToLogin')
        };
        AuthLogic.elements.toggleToRegister.addEventListener('click', AuthLogic.handleToggle);
        AuthLogic.elements.toggleToLogin.addEventListener('click', AuthLogic.handleToggle);
        AuthLogic.elements.btnLogoutPending.addEventListener('click', () => AuthLogic.auth.signOut());
        AuthLogic.elements.loginForm.addEventListener('submit', AuthLogic.handleLogin);
        AuthLogic.elements.registerForm.addEventListener('submit', AuthLogic.handleRegister);
        AuthLogic.auth.onAuthStateChanged(AuthLogic.handleLoginGuard);
    },
    showView: (view) => {
        const { loginForm, registerForm, pendingView, toggleToRegister, toggleToLogin } = AuthLogic.elements;
        loginForm.classList.add('hidden');
        registerForm.classList.add('hidden');
        pendingView.classList.add('hidden');
        toggleToRegister.parentElement.classList.add('hidden');
        toggleToLogin.parentElement.classList.add('hidden');
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
        AuthLogic.elements.loginErrorMsg.textContent = "";
        AuthLogic.elements.registerErrorMsg.textContent = "";
    },
    handleLogin: (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const btn = AuthLogic.elements.loginForm.querySelector('button');
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
        const btn = AuthLogic.elements.registerForm.querySelector('button');
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

// ===================================================================
// 3. AdminPanel (Lógica do Painel Coach V2)
// ===================================================================
const AdminPanel = {
    init: (user, db) => {
        console.log("AdminPanel V2: Inicializado.");
        AdminPanel.state = { db, currentUser: user, selectedAthleteId: null, athletes: {} };

        AdminPanel.elements = {
            pendingList: document.getElementById('pending-list'),
            athleteList: document.getElementById('athlete-list'),
            athleteSearch: document.getElementById('athlete-search'),
            athleteDetailName: document.getElementById('athlete-detail-name'),
            athleteDetailContent: document.getElementById('athlete-detail-content'),
            deleteAthleteBtn: document.getElementById('delete-athlete-btn'), // NOVO
            addWorkoutForm: document.getElementById('add-workout-form'),
            workoutsList: document.getElementById('workouts-list')
        };

        // Bind de eventos
        AdminPanel.elements.addWorkoutForm.addEventListener('submit', AdminPanel.handleAddWorkout);
        AdminPanel.elements.athleteSearch.addEventListener('input', AdminPanel.renderAthleteList);
        AdminPanel.elements.deleteAthleteBtn.addEventListener('click', AdminPanel.deleteAthlete); // NOVO
        
        // Carregar dados
        AdminPanel.loadPendingApprovals();
        AdminPanel.loadAthletes();
    },

    loadPendingApprovals: () => {
        const pendingRef = AdminPanel.state.db.ref('pendingApprovals');
        AppPrincipal.state.listeners['adminPending'] = pendingRef;
        
        pendingRef.on('value', snapshot => {
            const { pendingList } = AdminPanel.elements;
            pendingList.innerHTML = "";
            if (!snapshot.exists()) {
                pendingList.innerHTML = "<p>Nenhuma solicitação pendente.</p>";
                return;
            }
            snapshot.forEach(childSnapshot => {
                const uid = childSnapshot.key;
                const data = childSnapshot.val();
                const item = document.createElement('div');
                item.className = 'pending-item';
                item.innerHTML = `
                    <div class="pending-item-info">
                        <strong>${data.name}</strong><br>
                        <span>${data.email}</span>
                    </div>
                    <div class="pending-item-actions">
                        <button class="btn btn-success btn-small" data-action="approve" data-uid="${uid}">Aprovar</button>
                        <button class="btn btn-danger btn-small" data-action="reject" data-uid="${uid}">Rejeitar</button>
                    </div>
                `;
                pendingList.appendChild(item);
            });

            pendingList.querySelectorAll('[data-action="approve"]').forEach(btn => 
                btn.addEventListener('click', e => AdminPanel.approveAthlete(e.target.dataset.uid))
            );
            pendingList.querySelectorAll('[data-action="reject"]').forEach(btn => 
                btn.addEventListener('click', e => AdminPanel.rejectAthlete(e.target.dataset.uid))
            );
        });
    },

    loadAthletes: () => {
        const athletesRef = AdminPanel.state.db.ref('users');
        AppPrincipal.state.listeners['adminAthletes'] = athletesRef;
        
        athletesRef.orderByChild('name').on('value', snapshot => {
            AdminPanel.state.athletes = snapshot.val() || {};
            AdminPanel.renderAthleteList();
        });
    },

    renderAthleteList: () => {
        const { athleteList, athleteSearch } = AdminPanel.elements;
        const searchTerm = athleteSearch.value.toLowerCase();
        athleteList.innerHTML = "";
        
        // Reset a seleção se o atleta selecionado não existir mais
        if (AdminPanel.state.selectedAthleteId && !AdminPanel.state.athletes[AdminPanel.state.selectedAthleteId]) {
            AdminPanel.selectAthlete(null, null); // Desseleciona
        }

        Object.entries(AdminPanel.state.athletes).forEach(([uid, userData]) => {
            if (uid === AdminPanel.state.currentUser.uid) return;
            if (searchTerm && !userData.name.toLowerCase().includes(searchTerm)) {
                return;
            }

            const el = document.createElement('div');
            el.className = 'athlete-list-item';
            el.dataset.uid = uid;
            el.innerHTML = `<span>${userData.name}</span>`;
            el.addEventListener('click', () => AdminPanel.selectAthlete(uid, userData.name));
            
            if (uid === AdminPanel.state.selectedAthleteId) {
                el.classList.add('selected');
            }
            athleteList.appendChild(el);
        });
    },

    approveAthlete: (uid) => {
        console.log("Aprovando:", uid);
        const pendingRef = AdminPanel.state.db.ref('pendingApprovals/' + uid);
        
        pendingRef.once('value', snapshot => {
            if (!snapshot.exists()) return console.error("Usuário pendente não encontrado.");
            
            const pendingData = snapshot.val();
            
            const newUserProfile = {
                name: pendingData.name,
                email: pendingData.email,
                role: "atleta", 
                createdAt: new Date().toISOString()
            };
            
            // NOVO (V2): Cria também o perfil público
            const newPublicProfile = {
                name: pendingData.name,
                // pic: "url_placeholder" // (Pode adicionar no futuro)
            };
            
            const updates = {};
            updates[`/users/${uid}`] = newUserProfile;
            updates[`/publicProfiles/${uid}`] = newPublicProfile; // CRIA O PERFIL PÚBLICO
            updates[`/data/${uid}`] = { workouts: {} };     
            updates[`/pendingApprovals/${uid}`] = null; 

            AdminPanel.state.db.ref().update(updates)
                .then(() => console.log("Atleta aprovado e movido com sucesso."))
                .catch(err => {
                    console.error("ERRO CRÍTICO AO APROVAR:", err);
                    alert("Falha ao aprovar o atleta. Verifique as Regras de Segurança. Detalhe: " + err.message);
                });
        });
    },

    rejectAthlete: (uid) => {
        if (!confirm("Tem certeza que deseja REJEITAR este atleta?")) return;
        
        // Remove apenas de pendingApprovals. O usuário ainda existe no Auth.
        // O fluxo de login (AuthLogic) vai tratar isso como "Rejeitado"
        AdminPanel.state.db.ref('pendingApprovals/' + uid).remove()
            .then(() => console.log("Solicitação rejeitada."))
            .catch(err => alert("Falha ao rejeitar: " + err.message));
    },

    // NOVO: Excluir Atleta (V2)
    deleteAthlete: () => {
        const { selectedAthleteId } = AdminPanel.state;
        if (!selectedAthleteId) return;
        
        const athleteName = AdminPanel.state.athletes[selectedAthleteId].name;
        if (!confirm(`ATENÇÃO: Isso irá apagar PERMANENTEMENTE o atleta "${athleteName}" e todos os seus dados (treinos, comentários, etc.).\n\nIsso NÃO pode ser desfeito.\n\nTem certeza?`)) {
            return;
        }

        // Exclusão completa (multi-path update)
        // Precisamos apagar o usuário de 'users', 'data' e 'publicProfiles'
        const updates = {};
        updates[`/users/${selectedAthleteId}`] = null;
        updates[`/data/${selectedAthleteId}`] = null;
        updates[`/publicProfiles/${selectedAthleteId}`] = null;
        
        // (Opcional: Limpar comentários e curtidas - mais complexo, deixamos para V3)
        // (Opcional: Excluir do Auth - requer Cloud Functions)

        AdminPanel.state.db.ref().update(updates)
            .then(() => {
                console.log("Atleta excluído com sucesso.");
                AdminPanel.selectAthlete(null, null); // Desseleciona
            })
            .catch(err => alert("Erro ao excluir atleta: " + err.message));
    },

    selectAthlete: (uid, name) => {
        if (AdminPanel.state.selectedAthleteId === uid) return; // Já selecionado
        
        // Limpa o listener de treinos do atleta anterior
        if (AppPrincipal.state.listeners['adminWorkouts']) {
            AppPrincipal.state.listeners['adminWorkouts'].off();
        }

        if (uid === null) {
            // Desselecionando
            AdminPanel.state.selectedAthleteId = null;
            AdminPanel.elements.athleteDetailName.textContent = "Selecione um Atleta";
            AdminPanel.elements.athleteDetailContent.classList.add('hidden');
        } else {
            // Selecionando
            AdminPanel.state.selectedAthleteId = uid;
            AdminPanel.elements.athleteDetailName.textContent = `Planejamento de: ${name}`;
            AdminPanel.elements.athleteDetailContent.classList.remove('hidden');
            AdminPanel.loadWorkouts(uid);
        }
        
        // Atualiza a classe 'selected' na lista
        document.querySelectorAll('.athlete-list-item').forEach(el => {
            el.classList.toggle('selected', el.dataset.uid === uid);
        });
    },

    loadWorkouts: (athleteId) => {
        const { workoutsList } = AdminPanel.elements;
        workoutsList.innerHTML = "<p>Carregando treinos...</p>";
        
        const workoutsRef = AdminPanel.state.db.ref(`data/${athleteId}/workouts`);
        AppPrincipal.state.listeners['adminWorkouts'] = workoutsRef; // Registra novo listener

        workoutsRef.orderByChild('date').on('value', snapshot => {
            workoutsList.innerHTML = ""; 
            if (!snapshot.exists()) {
                workoutsList.innerHTML = "<p>Nenhum treino agendado.</p>";
                return;
            }
            snapshot.forEach(childSnapshot => {
                const card = AdminPanel.createWorkoutCard(
                    childSnapshot.key,
                    childSnapshot.val(), 
                    athleteId
                );
                workoutsList.prepend(card);
            });
        });
    },

    handleAddWorkout: (e) => {
        e.preventDefault();
        const { selectedAthleteId } = AdminPanel.state;
        const { addWorkoutForm } = AdminPanel.elements;
        
        if (!selectedAthleteId) return alert("Selecione um atleta.");

        const workoutData = {
            date: addWorkoutForm.querySelector('#workout-date').value,
            title: addWorkoutForm.querySelector('#workout-title').value,
            description: addWorkoutForm.querySelector('#workout-description').value,
            createdBy: AdminPanel.state.currentUser.uid,
            createdAt: new Date().toISOString(),
            status: "planejado",
            feedback: ""
        };

        if (!workoutData.date || !workoutData.title) return alert("Data e Título são obrigatórios.");

        AdminPanel.state.db.ref(`data/${selectedAthleteId}/workouts`).push(workoutData)
            .then(() => addWorkoutForm.reset())
            .catch(err => alert("Falha ao salvar o treino: " + err.message));
    },
    
    // Card de Treino (Versão Admin V2)
    createWorkoutCard: (id, data, athleteId) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        el.innerHTML = `
            <div class="workout-card-header">
                <div>
                    <span class="date">${data.date}</span>
                    <span class="title">${data.title}</span>
                </div>
                <span class="status-tag ${data.status || 'planejado'}">${data.status || 'planejado'}</span>
            </div>
            <div class="workout-card-body">
                <p>${data.description || "Sem descrição."}</p>
                ${data.feedback ? `<p class="feedback-text">${data.feedback}</p>` : ''}
            </div>
            <!-- NOVO: Footer com Ações (V2) -->
            <div class="workout-card-footer">
                <div class="workout-actions">
                    <button class="action-btn btn-like"><i class='bx bx-heart'></i> <span class="like-count">0</span></button>
                    <button class="action-btn btn-comment"><i class='bx bx-comment'></i> <span class="comment-count">0</span></button>
                </div>
                <button class="btn btn-danger btn-small" data-action="delete"><i class="bx bx-trash"></i></button>
            </div>
        `;
        
        // Abre o Modal de Comentários (Coach)
        el.querySelector('.btn-comment').addEventListener('click', () => {
            AppPrincipal.openFeedbackModal(id, athleteId, data.title);
        });
        
        // Deletar o treino (Coach)
        el.querySelector('[data-action="delete"]').addEventListener('click', () => {
            if (confirm("Tem certeza que deseja apagar este treino?")) {
                AdminPanel.state.db.ref(`data/${athleteId}/workouts/${id}`).remove()
                    .catch(err => alert("Falha ao deletar: " + err.message));
            }
        });
        
        // Carrega Likes e Comentários (V2)
        AdminPanel.loadWorkoutStats(el, id);
        
        return el;
    },
    
    // Carrega status (likes/comentários) de um card
    loadWorkoutStats: (cardElement, workoutId) => {
        const likeBtn = cardElement.querySelector('.btn-like');
        const likeCount = cardElement.querySelector('.like-count');
        const commentCount = cardElement.querySelector('.comment-count');
        
        const likesRef = AdminPanel.state.db.ref(`workoutLikes/${workoutId}`);
        const commentsRef = AdminPanel.state.db.ref(`workoutComments/${workoutId}`);
        
        // Listener de Likes
        likesRef.on('value', snapshot => {
            const count = snapshot.numChildren();
            likeCount.textContent = count;
            // Verifica se o Coach (usuário atual) curtiu
            if (snapshot.hasChild(AdminPanel.state.currentUser.uid)) {
                likeBtn.classList.add('liked');
            } else {
                likeBtn.classList.remove('liked');
            }
        });
        
        // Listener de Comentários
        commentsRef.on('value', snapshot => {
            commentCount.textContent = snapshot.numChildren();
        });

        // Ação de Curtir (Coach)
        likeBtn.addEventListener('click', () => {
            const myLikeRef = likesRef.child(AdminPanel.state.currentUser.uid);
            myLikeRef.once('value', snapshot => {
                if (snapshot.exists()) {
                    myLikeRef.remove(); // Descurtir
                } else {
                    myLikeRef.set(true); // Curtir
                }
            });
        });
        
        // Registra listeners para limpeza
        AppPrincipal.state.listeners[`likes_${workoutId}`] = likesRef;
        AppPrincipal.state.listeners[`comments_${workoutId}`] = commentsRef;
    }
};

// ===================================================================
// 4. AtletaPanel (Lógica do Painel Atleta V2)
// ===================================================================
const AtletaPanel = {
    init: (user, db) => {
        console.log("AtletaPanel V2: Inicializado.");
        AtletaPanel.state = { db, currentUser: user };
        AtletaPanel.elements = { workoutsList: document.getElementById('atleta-workouts-list') };
        AtletaPanel.loadWorkouts(user.uid);
    },

    loadWorkouts: (athleteId) => {
        const { workoutsList } = AtletaPanel.elements;
        workoutsList.innerHTML = "<p>Carregando seus treinos...</p>";
        
        const workoutsRef = AtletaPanel.state.db.ref(`data/${athleteId}/workouts`);
        AppPrincipal.state.listeners['atletaWorkouts'] = workoutsRef; // Registra listener

        workoutsRef.orderByChild('date').on('value', snapshot => {
            workoutsList.innerHTML = ""; 
            if (!snapshot.exists()) {
                workoutsList.innerHTML = "<p>Nenhum treino encontrado. Fale com seu coach!</p>";
                return;
            }
            snapshot.forEach(childSnapshot => {
                const card = AtletaPanel.createWorkoutCard(
                    childSnapshot.key, 
                    childSnapshot.val(), 
                    athleteId
                );
                workoutsList.prepend(card);
            });
        });
    },

    // Card de Treino (Versão Atleta V2)
    createWorkoutCard: (id, data, athleteId) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        el.innerHTML = `
            <div class="workout-card-header">
                <div>
                    <span class="date">${data.date}</span>
                    <span class="title">${data.title}</span>
                </div>
                <span class="status-tag ${data.status || 'planejado'}">${data.status || 'planejado'}</span>
            </div>
            <div class="workout-card-body">
                <p>${data.description || "Sem descrição."}</p>
                ${data.feedback ? `<p class="feedback-text">${data.feedback}</p>` : ''}
            </div>
            <!-- NOVO: Footer com Ações (V2) -->
            <div class="workout-card-footer">
                <div class="workout-actions">
                    <button class="action-btn btn-like"><i class='bx bx-heart'></i> <span class="like-count">0</span></button>
                    <button class="action-btn btn-comment"><i class='bx bx-comment'></i> <span class="comment-count">0</span></button>
                </div>
                <button class="btn btn-primary btn-small" data-action="feedback">
                    <i class='bx bx-edit'></i> Feedback
                </button>
            </div>
        `;

        // Ação de abrir o modal (Atleta)
        const feedbackBtn = el.querySelector('[data-action="feedback"]');
        feedbackBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Impede o clique duplo
            AppPrincipal.openFeedbackModal(id, athleteId, data.title);
        });
        // Clicar no card todo (exceto botões) também abre o modal
        el.addEventListener('click', (e) => {
             if (!e.target.closest('button')) {
                 AppPrincipal.openFeedbackModal(id, athleteId, data.title);
             }
        });
        
        // Carrega Likes e Comentários (V2)
        AtletaPanel.loadWorkoutStats(el, id);
        
        return el;
    },
    
    // Carrega status (likes/comentários) de um card (Quase idêntico ao AdminPanel)
    loadWorkoutStats: (cardElement, workoutId) => {
        const likeBtn = cardElement.querySelector('.btn-like');
        const likeCount = cardElement.querySelector('.like-count');
        const commentCount = cardElement.querySelector('.comment-count');
        
        const likesRef = AtletaPanel.state.db.ref(`workoutLikes/${workoutId}`);
        const commentsRef = AtletaPanel.state.db.ref(`workoutComments/${workoutId}`);
        
        likesRef.on('value', snapshot => {
            likeCount.textContent = snapshot.numChildren();
            if (snapshot.hasChild(AtletaPanel.state.currentUser.uid)) {
                likeBtn.classList.add('liked');
            } else {
                likeBtn.classList.remove('liked');
            }
        });
        
        commentsRef.on('value', snapshot => {
            commentCount.textContent = snapshot.numChildren();
        });

        // Ação de Curtir (Atleta)
        likeBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Impede o modal de abrir
            const myLikeRef = likesRef.child(AtletaPanel.state.currentUser.uid);
            myLikeRef.once('value', snapshot => {
                if (snapshot.exists()) {
                    myLikeRef.remove(); // Descurtir
                } else {
                    myLikeRef.set(true); // Curtir
                }
            });
        });
        
        // Ação de Comentar (Atleta)
        cardElement.querySelector('.btn-comment').addEventListener('click', (e) => {
             e.stopPropagation(); // Impede o modal de abrir (se o clique for no card)
             // (o modal vai abrir de qualquer forma)
        });
        
        AppPrincipal.state.listeners[`likes_${workoutId}`] = likesRef;
        AppPrincipal.state.listeners[`comments_${workoutId}`] = commentsRef;
    }
};

// ===================================================================
// 5. FeedPanel (Lógica do Feed Social V2)
// ===================================================================
const FeedPanel = {
    init: (user, db) => {
        console.log("FeedPanel V2: Inicializado.");
        FeedPanel.state = { db, currentUser: user, users: {} };
        FeedPanel.elements = { feedList: document.getElementById('feed-list') };
        
        // 1. Carrega todos os perfis públicos para saber os nomes
        const profilesRef = db.ref('publicProfiles');
        AppPrincipal.state.listeners['feedProfiles'] = profilesRef;
        profilesRef.once('value', snapshot => {
            FeedPanel.state.users = snapshot.val() || {};
            // 2. Depois que tem os nomes, carrega o feed
            FeedPanel.loadFeed();
        });
    },

    loadFeed: () => {
        const { feedList } = FeedPanel.elements;
        feedList.innerHTML = "<p>Carregando feed...</p>";
        
        // ERRO DE ARQUITETURA: As regras V2 não permitem ler /data/ de todos.
        // SOLUÇÃO V2 (Limitada): O Feed por enquanto só mostrará os treinos
        // do PRÓPRIO usuário (admin ou atleta).
        // A V3 (com Cloud Functions) corrigirá isso.
        
        const myDataRef = FeedPanel.state.db.ref(`data/${FeedPanel.state.currentUser.uid}/workouts`);
        AppPrincipal.state.listeners['feedData'] = myDataRef;

        myDataRef.orderByChild('realizadoAt').limitToLast(10).on('value', snapshot => {
            feedList.innerHTML = "";
            if (!snapshot.exists()) {
                feedList.innerHTML = "<p>Nenhum treino realizado encontrado.</p>";
                return;
            }
            
            snapshot.forEach(childSnapshot => {
                const data = childSnapshot.val();
                // Mostra apenas treinos com feedback (realizados)
                if (data.status && data.status !== 'planejado') {
                    const card = FeedPanel.createFeedCard(
                        childSnapshot.key,
                        data,
                        FeedPanel.state.currentUser.uid
                    );
                    feedList.prepend(card);
                }
            });
        });
    },
    
    // Card do Feed (V2)
    createFeedCard: (id, data, ownerId) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        
        // Pega o nome do atleta do cache
        const athleteName = FeedPanel.state.users[ownerId]?.name || "Atleta";
        
        el.innerHTML = `
            <div class="workout-card-header">
                <span class="athlete-name">${athleteName}</span>
                <div>
                    <span class="date">${data.date}</span>
                    <span class="title">${data.title}</span>
                </div>
                <span class="status-tag ${data.status || 'planejado'}">${data.status}</span>
            </div>
            <div class="workout-card-body">
                <!-- <p>${data.description || "Sem descrição."}</p> -->
                ${data.feedback ? `<p class="feedback-text">${data.feedback}</p>` : ''}
            </div>
            <div class="workout-card-footer">
                <div class="workout-actions">
                    <button class="action-btn btn-like"><i class='bx bx-heart'></i> <span class="like-count">0</span></button>
                    <button class="action-btn btn-comment"><i class='bx bx-comment'></i> <span class="comment-count">0</span></button>
                </div>
            </div>
        `;
        
        // Abre o Modal de Comentários
        el.querySelector('.btn-comment').addEventListener('click', () => {
            AppPrincipal.openFeedbackModal(id, ownerId, data.title);
        });

        // Carrega Likes e Comentários (V2)
        FeedPanel.loadWorkoutStats(el, id);
        
        return el;
    },
    
    // Carrega status (quase idêntico ao Admin/Atleta, mas usa o state do Feed)
    loadWorkoutStats: (cardElement, workoutId) => {
        const likeBtn = cardElement.querySelector('.btn-like');
        const likeCount = cardElement.querySelector('.like-count');
        const commentCount = cardElement.querySelector('.comment-count');
        
        const likesRef = FeedPanel.state.db.ref(`workoutLikes/${workoutId}`);
        const commentsRef = FeedPanel.state.db.ref(`workoutComments/${workoutId}`);
        
        likesRef.on('value', snapshot => {
            likeCount.textContent = snapshot.numChildren();
            if (snapshot.hasChild(FeedPanel.state.currentUser.uid)) {
                likeBtn.classList.add('liked');
            } else {
                likeBtn.classList.remove('liked');
            }
        });
        
        commentsRef.on('value', snapshot => {
            commentCount.textContent = snapshot.numChildren();
        });

        // Ação de Curtir
        likeBtn.addEventListener('click', () => {
            const myLikeRef = likesRef.child(FeedPanel.state.currentUser.uid);
            myLikeRef.once('value', snapshot => {
                if (snapshot.exists()) {
                    myLikeRef.remove(); // Descurtir
                } else {
                    myLikeRef.set(true); // Curtir
                }
            });
        });
        
        AppPrincipal.state.listeners[`feed_likes_${workoutId}`] = likesRef;
        AppPrincipal.state.listeners[`feed_comments_${workoutId}`] = commentsRef;
    }
};

// =l= Inicia o Cérebro Principal =l=
document.addEventListener('DOMContentLoaded', AppPrincipal.init);

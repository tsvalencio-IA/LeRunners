/* =================================================================== */
/* ARQUIVO DE LÓGICA UNIFICADO (V1.2 - corri_rp)
/* CORREÇÃO: Corrigido bug de referência cruzada em AtletaPanel.loadWorkouts
/* (Usava AdminPanel.state.db em vez de AtletaPanel.state.db)
/* Contém:
/* 1. AppPrincipal (O Guardião/Roteador)
/* 2. AuthLogic (Lógica da index.html)
/* 3. AdminPanel (Lógica do Painel Coach)
/* 4. AtletaPanel (Lógica do Painel Atleta)
/* =================================================================== */

// ===================================================================
// 1. AppPrincipal (O Cérebro)
// ===================================================================
const AppPrincipal = {
    state: {
        currentUser: null,
        userData: null,
        db: null,
        auth: null,
        listeners: {} // Para limpar listeners do Firebase
    },

    init: () => {
        console.log("Iniciando AppPrincipal...");
        
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
            mainContent: document.getElementById('app-main-content')
        };
        
        AppPrincipal.elements.logoutButton.addEventListener('click', AppPrincipal.handleLogout);
        // O Guardião do app.html
        AppPrincipal.state.auth.onAuthStateChanged(AppPrincipal.handlePlatformAuthStateChange);
    },

    // O Guardião (só roda no app.html)
    handlePlatformAuthStateChange: (user) => {
        if (!user) {
            // NÃO ESTÁ LOGADO
            console.log("Guardião (Plataforma): Acesso negado. Redirecionando para login.");
            AppPrincipal.cleanupListeners();
            window.location.href = 'index.html';
            return;
        }

        // ESTÁ LOGADO. Verificar status (Admin ou Atleta)
        AppPrincipal.state.currentUser = user;
        const uid = user.uid;

        // 1. É Admin?
        AppPrincipal.state.db.ref('admins/' + uid).once('value', adminSnapshot => {
            if (adminSnapshot.exists() && adminSnapshot.val() === true) {
                // É ADMIN.
                // Busca o perfil em /users/ SÓ para pegar o nome (se existir)
                AppPrincipal.state.db.ref('users/' + uid).once('value', userSnapshot => {
                    let adminName = userSnapshot.exists() ? userSnapshot.val().name : user.email;
                    AppPrincipal.state.userData = { name: adminName, role: 'admin' };
                    AppPrincipal.elements.userDisplay.textContent = `${adminName} (Coach)`;
                    AppPrincipal.routeBasedOnRole('admin');
                });
                return;
            }

            // 2. É Atleta Aprovado?
            AppPrincipal.state.db.ref('users/' + uid).once('value', userSnapshot => {
                if (userSnapshot.exists()) {
                    // É ATLETA APROVADO
                    AppPrincipal.state.userData = userSnapshot.val();
                    AppPrincipal.elements.userDisplay.textContent = `${AppPrincipal.state.userData.name}`;
                    AppPrincipal.routeBasedOnRole('atleta');
                } else {
                    // 3. NÃO É ADMIN NEM ATLETA APROVADO
                    console.warn("Status: PENDENTE/REJEITADO. Não deveria estar aqui. Voltando ao login.");
                    AppPrincipal.handleLogout(); 
                }
            });
        });
    },

    // O Roteador (só roda no app.html)
    routeBasedOnRole: (role) => {
        const { mainContent, loader, appContainer } = AppPrincipal.elements;
        mainContent.innerHTML = ""; 
        AppPrincipal.cleanupListeners(); 

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
    }
};

// ===================================================================
// 2. AuthLogic (Lógica da index.html)
// ===================================================================
const AuthLogic = {
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
                    console.log("Guardião (Login): Admin. Redirecionando...");
                    window.location.href = 'app.html';
                    return;
                }
                AuthLogic.db.ref('users/' + uid).once('value', userSnapshot => {
                    if (userSnapshot.exists()) {
                        console.log("Guardião (Login): Atleta Aprovado. Redirecionando...");
                        window.location.href = 'app.html';
                        return;
                    }
                    AuthLogic.db.ref('pendingApprovals/' + uid).once('value', pendingSnapshot => {
                        if (pendingSnapshot.exists()) {
                            console.log("Guardião (Login): Pendente. Mostrando tela de espera.");
                            AuthLogic.elements.pendingEmailDisplay.textContent = user.email;
                            AuthLogic.showView('pending');
                        } else {
                            console.warn("Guardião (Login): Rejeitado/Órfão.");
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
// 3. AdminPanel (Lógica do Painel Coach)
// ===================================================================
const AdminPanel = {
    init: (user, db) => {
        console.log("AdminPanel: Inicializado.");
        AdminPanel.state = { db, currentUser: user, selectedAthleteId: null, athletes: {} };

        AdminPanel.elements = {
            pendingList: document.getElementById('pending-list'),
            athleteList: document.getElementById('athlete-list'),
            athleteSearch: document.getElementById('athlete-search'),
            athleteDetailName: document.getElementById('athlete-detail-name'),
            athleteDetailContent: document.getElementById('athlete-detail-content'),
            addWorkoutForm: document.getElementById('add-workout-form'),
            workoutsList: document.getElementById('workouts-list')
        };

        AdminPanel.elements.addWorkoutForm.addEventListener('submit', AdminPanel.handleAddWorkout);
        AdminPanel.elements.athleteSearch.addEventListener('input', AdminPanel.renderAthleteList);
        
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
            
            const updates = {};
            updates[`/users/${uid}`] = newUserProfile;      
            updates[`/data/${uid}`] = { workouts: {} };     
            updates[`/pendingApprovals/${uid}`] = null; 

            AdminPanel.state.db.ref().update(updates)
                .then(() => {
                    console.log("Atleta aprovado e movido com sucesso.");
                })
                .catch(err => {
                    console.error("ERRO CRÍTICO AO APROVAR:", err);
                    alert("Falha ao aprovar o atleta. Verifique as Regras de Segurança. Detalhe: " + err.message);
                });
        });
    },

    rejectAthlete: (uid) => {
        if (!confirm("Tem certeza que deseja REJEITAR este atleta?")) {
            return;
        }
        AdminPanel.state.db.ref('pendingApprovals/' + uid).remove()
            .then(() => {
                console.log("Solicitação rejeitada.");
            })
            .catch(err => {
                console.error("ERRO AO REJEITAR:", err);
                alert("Falha ao rejeitar o atleta. Verifique as Regras de Segurança. Detalhe: " + err.message);
            });
    },

    selectAthlete: (uid, name) => {
        AdminPanel.state.selectedAthleteId = uid;
        AdminPanel.elements.athleteDetailName.textContent = `Planejamento de: ${name}`;
        AdminPanel.elements.athleteDetailContent.classList.remove('hidden');
        
        document.querySelectorAll('.athlete-list-item').forEach(el => {
            el.classList.toggle('selected', el.dataset.uid === uid);
        });
        
        AdminPanel.loadWorkouts(uid);
    },

    loadWorkouts: (athleteId) => {
        const { workoutsList } = AdminPanel.elements;
        workoutsList.innerHTML = "<p>Carregando treinos...</p>";
        
        if (AppPrincipal.state.listeners['adminWorkouts']) {
            AppPrincipal.state.listeners['adminWorkouts'].off();
        }
        
        const workoutsRef = AdminPanel.state.db.ref(`data/${athleteId}/workouts`);
        AppPrincipal.state.listeners['adminWorkouts'] = workoutsRef;

        workoutsRef.orderByChild('date').on('value', snapshot => {
            workoutsList.innerHTML = ""; 
            if (!snapshot.exists()) {
                workoutsList.innerHTML = "<p>Nenhum treino agendado.</p>";
                return;
            }
            snapshot.forEach(childSnapshot => {
                const card = AdminPanel.createWorkoutCard(
                    childSnapshot.val(), 
                    childSnapshot.key, 
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
        
        if (!selectedAthleteId) {
            alert("Por favor, selecione um atleta primeiro.");
            return;
        }

        const workoutData = {
            date: addWorkoutForm.querySelector('#workout-date').value,
            title: addWorkoutForm.querySelector('#workout-title').value,
            description: addWorkoutForm.querySelector('#workout-description').value,
            createdBy: AdminPanel.state.currentUser.uid,
            createdAt: new Date().toISOString(),
            status: "planejado"
        };

        if (!workoutData.date || !workoutData.title) {
            alert("Data e Título são obrigatórios.");
            return;
        }

        AdminPanel.state.db.ref(`data/${selectedAthleteId}/workouts`).push(workoutData)
            .then(() => {
                addWorkoutForm.reset(); 
            })
            .catch(err => {
                console.error("ERRO AO SALVAR TREINO:", err);
                alert("Falha ao salvar o treino. Verifique as Regras de Segurança. Detalhe: " + err.message);
            });
    },
    
    createWorkoutCard: (data, id, athleteId) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        el.innerHTML = `
            <div class="workout-card-header">
                <div>
                    <span class="date">${data.date}</span>
                    <span class="title">${data.title}</span>
                </div>
                <button class="btn btn-danger btn-small" data-action="delete"><i class="bx bx-trash"></i></button>
            </div>
            <div class="workout-card-body"><p>${data.description || "Sem descrição."}</p></div>
        `;
        
        el.querySelector('[data-action="delete"]').addEventListener('click', () => {
            if (confirm("Tem certeza que deseja apagar este treino?")) {
                AdminPanel.state.db.ref(`data/${athleteId}/workouts/${id}`).remove()
                    .catch(err => {
                        console.error("ERRO AO DELETAR TREINO:", err);
                        alert("Falha ao deletar o treino. Verifique as Regras de Segurança. Detalhe: " + err.message);
                    });
            }
        });
        return el;
    }
};

// ===================================================================
// 4. AtletaPanel (Lógica do Painel Atleta)
// ===================================================================
const AtletaPanel = {
    init: (user, db) => {
        console.log("AtletaPanel: Inicializado.");
        AtletaPanel.state = { db, currentUser: user };
        AtletaPanel.elements = { workoutsList: document.getElementById('atleta-workouts-list') };
        AtletaPanel.loadWorkouts(user.uid);
    },

    loadWorkouts: (athleteId) => {
        const { workoutsList } = AtletaPanel.elements;
        workoutsList.innerHTML = "<p>Carregando seus treinos...</p>";
        
        // ***** AQUI ESTÁ A CORREÇÃO *****
        // O código antigo usava "AdminPanel.state.db.ref", o que é um erro.
        // O correto é usar a instância de DB passada para o AtletaPanel.
        const workoutsRef = AtletaPanel.state.db.ref(`data/${athleteId}/workouts`);
        // **********************************

        AppPrincipal.state.listeners['atletaWorkouts'] = workoutsRef;

        workoutsRef.orderByChild('date').on('value', snapshot => {
            workoutsList.innerHTML = ""; 
            if (!snapshot.exists()) {
                workoutsList.innerHTML = "<p>Nenhum treino encontrado. Fale com seu coach!</p>";
                return;
            }
            snapshot.forEach(childSnapshot => {
                const card = AtletaPanel.createWorkoutCard(childSnapshot.val());
                workoutsList.prepend(card);
            });
        });
    },

    createWorkoutCard: (data) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        el.innerHTML = `
            <div class="workout-card-header">
                <div>
                    <span class="date">${data.date}</span>
                    <span class="title">${data.title}</span>
                </div>
                <span class="status-tag">${data.status}</span>
            </div>
            <div class="workout-card-body"><p>${data.description || "Sem descrição."}</p></div>
        `;
        return el;
    }
};

// =l= Inicia o Cérebro Principal =l=
document.addEventListener('DOMContentLoaded', AppPrincipal.init);

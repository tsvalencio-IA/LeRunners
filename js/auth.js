// js/app.js
// Gerenciador Principal da Plataforma (app.html)
// ARQUITETURA "corri_rp" com fluxo de aprovação pendente

// Objeto global da Aplicação
const LeRunnersApp = {
state: {
currentUser: null,
userData: null,
db: null,
auth: null,
listeners: {} // Para limpar listeners do Firebase
},

// Ponto de entrada
init: () => {
    console.log("Iniciando LeRunners App...");
    
    if (typeof firebaseConfig === 'undefined' || firebaseConfig.apiKey.includes("COLE_SUA_CHAVE")) {
        console.error("ERRO CRÍTICO: config.js não carregado.");
        alert("Erro de sistema: Configuração não encontrada.");
        window.location.href = 'index.html';
        return;
    }

    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
    } catch (e) {
        console.error('Falha ao inicializar Firebase:', e);
        window.location.href = 'index.html';
        return;
    }

    LeRunnersApp.state.auth = firebase.auth();
    LeRunnersApp.state.db = firebase.database();

    LeRunnersApp.elements = {
        loader: document.getElementById('loader'),
        appContainer: document.getElementById('app-container'),
        userDisplay: document.getElementById('userDisplay'),
        logoutButton: document.getElementById('logoutButton'),
        mainContent: document.getElementById('app-main-content')
    };
    
    LeRunnersApp.elements.logoutButton.addEventListener('click', LeRunnersApp.handleLogout);
    LeRunnersApp.state.auth.onAuthStateChanged(LeRunnersApp.handleAuthStateChange);
},

// O Guardião
handleAuthStateChange: (user) => {
    if (!user) {
        // NÃO ESTÁ LOGADO
        console.log("Guardião: Acesso negado. Redirecionando para login.");
        LeRunnersApp.cleanupListeners();
        window.location.href = 'index.html';
        return;
    }

    // ESTÁ LOGADO. Verificar status (Admin ou Atleta)
    LeRunnersApp.state.currentUser = user;
    const uid = user.uid;

    // 1. É Admin?
    LeRunnersApp.state.db.ref('admins/' + uid).once('value', adminSnapshot => {
        if (adminSnapshot.exists() && adminSnapshot.val() === true) {
            // É ADMIN. Carregar perfil de admin e painel.
            LeRunnersApp.state.db.ref('users/' + uid).once('value', userSnapshot => {
                let adminName = userSnapshot.exists() ? userSnapshot.val().name : user.email;
                LeRunnersApp.state.userData = { name: adminName, role: 'admin' };
                LeRunnersApp.elements.userDisplay.textContent = `${adminName} (Coach)`;
                LeRunnersApp.routeBasedOnRole('admin');
            });
            return;
        }

        // 2. É Atleta Aprovado?
        LeRunnersApp.state.db.ref('users/' + uid).once('value', userSnapshot => {
            if (userSnapshot.exists()) {
                // É ATLETA APROVADO
                LeRunnersApp.state.userData = userSnapshot.val();
                LeRunnersApp.elements.userDisplay.textContent = `${LeRunnersApp.state.userData.name}`;
                LeRunnersApp.routeBasedOnRole('atleta');
            } else {
                // 3. NÃO É ADMIN NEM ATLETA APROVADO
                // (Provavelmente pendente, mas não deveria estar em app.html)
                console.warn("Status: PENDENTE. Não deveria estar aqui. Voltando ao login.");
                LeRunnersApp.handleLogout();
            }
        });
    });
},

// O Roteador
routeBasedOnRole: (role) => {
    const { mainContent, loader, appContainer } = LeRunnersApp.elements;
    mainContent.innerHTML = ""; 
    LeRunnersApp.cleanupListeners(); 

    if (role === 'admin') {
        const adminTemplate = document.getElementById('admin-panel-template').content.cloneNode(true);
        mainContent.appendChild(adminTemplate);
        AdminPanel.init(LeRunnersApp.state.currentUser, LeRunnersApp.state.db);
    } else {
        const atletaTemplate = document.getElementById('atleta-panel-template').content.cloneNode(true);
        mainContent.appendChild(atletaTemplate);
        document.getElementById('atleta-welcome-name').textContent = LeRunnersApp.state.userData.name;
        AtletaPanel.init(LeRunnersApp.state.currentUser, LeRunnersApp.state.db);
    }

    loader.classList.add('hidden');
    appContainer.classList.remove('hidden');
},

handleLogout: () => {
    console.log("Saindo...");
    LeRunnersApp.state.auth.signOut().catch(err => console.error("Erro ao sair:", err));
},

cleanupListeners: () => {
    Object.values(LeRunnersApp.state.listeners).forEach(ref => ref.off());
    LeRunnersApp.state.listeners = {};
    console.log("Listeners do Firebase limpos.");
}


};

// ===================================================================
// PAINEL DO ADMIN (COACH)
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
    LeRunnersApp.state.listeners['adminPending'] = pendingRef;
    
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

        // Adiciona listeners aos botões
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
    LeRunnersApp.state.listeners['adminAthletes'] = athletesRef;
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
        if (uid === AdminPanel.state.currentUser.uid) return; // Não mostrar o próprio admin
        if (searchTerm && !userData.name.toLowerCase().includes(searchTerm)) return;

        const el = document.createElement('div');
        el.className = 'athlete-list-item';
        el.dataset.uid = uid;
        el.innerHTML = `<span>${userData.name}</span>`;
        el.addEventListener('click', () => AdminPanel.selectAthlete(uid, userData.name));
        if (uid === AdminPanel.state.selectedAthleteId) el.classList.add('selected');
        athleteList.appendChild(el);
    });
},

approveAthlete: (uid) => {
    console.log("Aprovando:", uid);
    const pendingRef = AdminPanel.state.db.ref('pendingApprovals/' + uid);
    
    pendingRef.once('value', snapshot => {
        if (!snapshot.exists()) return console.error("Usuário pendente não encontrado.");
        
        const pendingData = snapshot.val();
        
        // 1. Cria o perfil do usuário em /users/
        const newUserProfile = {
            name: pendingData.name,
            email: pendingData.email,
            role: "atleta",
            createdAt: new Date().toISOString()
        };
        
        // 2. Cria o nó de dados privados
        const updates = {};
        updates[`/users/${uid}`] = newUserProfile;
        updates[`/data/${uid}`] = { workouts: {} }; // Cria nó de treinos
        updates[`/pendingApprovals/${uid}`] = null; // 3. Remove de pendentes

        AdminPanel.state.db.ref().update(updates)
            .then(() => console.log("Atleta aprovado e movido."))
            .catch(err => alert("Erro ao aprovar: " + err.message));
    });
},

rejectAthlete: (uid) => {
    if (!confirm("Tem certeza que deseja REJEITAR este atleta? Ele será removido da lista.")) {
        return;
    }
    // NOTA: Isso NÃO remove o usuário do Firebase Auth. 
    // Isso é mais complexo e requer Cloud Functions.
    // Por enquanto, apenas removemos a solicitação.
    AdminPanel.state.db.ref('pendingApprovals/' + uid).remove()
        .then(() => console.log("Solicitação rejeitada."))
        .catch(err => alert("Erro ao rejeitar: " + err.message));
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
    workoutsList.innerHTML = "Carregando treinos...";
    
    if (LeRunnersApp.state.listeners['adminWorkouts']) {
        LeRunnersApp.state.listeners['adminWorkouts'].off();
    }
    const workoutsRef = AdminPanel.state.db.ref(`data/${athleteId}/workouts`);
    LeRunnersApp.state.listeners['adminWorkouts'] = workoutsRef;

    workoutsRef.orderByChild('date').on('value', snapshot => {
        workoutsList.innerHTML = ""; 
        if (!snapshot.exists()) {
            workoutsList.innerHTML = "<p>Nenhum treino agendado.</p>";
            return;
        }
        snapshot.forEach(childSnapshot => {
            const card = AdminPanel.createWorkoutCard(childSnapshot.val(), childSnapshot.key, athleteId);
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
        status: "planejado"
    };
    if (!workoutData.date || !workoutData.title) return alert("Data e Título são obrigatórios.");

    AdminPanel.state.db.ref(`data/${selectedAthleteId}/workouts`).push(workoutData)
        .then(() => addWorkoutForm.reset())
        .catch(err => alert("Erro ao salvar: " + err.message));
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
        if (confirm("Apagar este treino?")) {
            AdminPanel.state.db.ref(`data/${athleteId}/workouts/${id}`).remove();
        }
    });
    return el;
}


};

// ===================================================================
// PAINEL DO ATLETA
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
    workoutsList.innerHTML = "Carregando seus treinos...";
    
    const workoutsRef = AtletaPanel.state.db.ref(`data/${athleteId}/workouts`);
    LeRunnersApp.state.listeners['atletaWorkouts'] = workoutsRef;

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
            <span class="role-tag" style="background-color: var(--secondary-color); text-transform: capitalize;">${data.status}</span>
        </div>
        <div class="workout-card-body"><p>${data.description || "Sem descrição."}</p></div>
    `;
    return el;
}


};

// Inicia a aplicação principal
document.addEventListener('DOMContentLoaded', LeRunnersApp.init);

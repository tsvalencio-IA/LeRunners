// js/admin.js
// Lógica do Painel de Administração (Coach)

const AdminPanel = {
    state: {
        db: null,
        currentUser: null,
        selectedAthleteId: null,
        athletes: {} // Cache local dos atletas
    },

    init: (user, db) => {
        console.log("AdminPanel: Inicializado.");
        AdminPanel.state.currentUser = user;
        AdminPanel.state.db = db;

        // Mapear elementos específicos do Admin
        AdminPanel.elements = {
            athleteList: document.getElementById('athlete-list'),
            athleteDetailName: document.getElementById('athlete-detail-name'),
            athleteDetailContent: document.getElementById('athlete-detail-content'),
            addWorkoutForm: document.getElementById('add-workout-form'),
            workoutsList: document.getElementById('workouts-list')
        };

        // Carregar a lista de atletas
        AdminPanel.loadAthletes();

        // Adicionar listener ao formulário
        AdminPanel.elements.addWorkoutForm.addEventListener('submit', AdminPanel.handleAddWorkout);
    },

    // Carrega todos os usuários e filtra os atletas
    loadAthletes: () => {
        const athletesRef = AdminPanel.state.db.ref('users');
        const { athleteList } = AdminPanel.elements;
        athleteList.innerHTML = "Carregando atletas...";

        athletesRef.orderByChild('name').on('value', (snapshot) => {
            athleteList.innerHTML = ""; // Limpa a lista
            AdminPanel.state.athletes = snapshot.val();
            
            if (!snapshot.exists()) {
                athleteList.innerHTML = "<p>Nenhum atleta encontrado.</p>";
                return;
            }

            snapshot.forEach((childSnapshot) => {
                const uid = childSnapshot.key;
                const userData = childSnapshot.val();

                // Não mostrar o próprio admin na lista de atletas
                if (uid === AdminPanel.state.currentUser.uid) {
                    return;
                }
                
                // (Opcional) Filtrar apenas por 'role: atleta'
                // if (userData.role !== 'atleta') {
                //     return;
                // }

                const el = document.createElement('div');
                el.className = 'athlete-list-item';
                el.dataset.uid = uid;
                el.innerHTML = `
                    <span>${userData.name}</span>
                    <span class="role-tag">${userData.role}</span>
                `;

                // Adiciona o evento de clique para selecionar o atleta
                el.addEventListener('click', () => AdminPanel.selectAthlete(uid));
                
                athleteList.appendChild(el);
            });
        });
    },

    // Seleciona um atleta da lista
    selectAthlete: (uid) => {
        console.log("Selecionando atleta:", uid);
        AdminPanel.state.selectedAthleteId = uid;
        const athleteData = AdminPanel.state.athletes[uid];

        // Atualiza a UI
        AdminPanel.elements.athleteDetailName.textContent = `Planejamento de: ${athleteData.name}`;
        AdminPanel.elements.athleteDetailContent.classList.remove('hidden');

        // Destaca o atleta selecionado na lista
        document.querySelectorAll('.athlete-list-item').forEach(el => {
            el.classList.toggle('selected', el.dataset.uid === uid);
        });

        // Carregar os treinos desse atleta
        AdminPanel.loadWorkouts(uid);
    },

    // Carrega os treinos do atleta selecionado (do nó /data/{uid}/workouts)
    loadWorkouts: (athleteId) => {
        const { workoutsList } = AdminPanel.elements;
        workoutsList.innerHTML = "Carregando treinos...";
        
        // Usamos o nó de dados PRIVADOS (/data/)
        const workoutsRef = AdminPanel.state.db.ref(`data/${athleteId}/workouts`);

        // Ordena pela data
        workoutsRef.orderByChild('date').on('value', (snapshot) => {
            workoutsList.innerHTML = ""; // Limpa
            if (!snapshot.exists()) {
                workoutsList.innerHTML = "<p>Nenhum treino agendado para este atleta.</p>";
                return;
            }

            snapshot.forEach((childSnapshot) => {
                const workoutId = childSnapshot.key;
                const workoutData = childSnapshot.val();
                
                const card = AdminPanel.createWorkoutCard(workoutData, workoutId, athleteId);
                // Adiciona no início (treinos mais novos primeiro)
                workoutsList.prepend(card); 
            });
        });
    },

    // Lida com o submit do formulário de novo treino
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
            status: "planejado" // Status inicial
        };

        if (!workoutData.date || !workoutData.title) {
            alert("Data e Título são obrigatórios.");
            return;
        }

        // Salva no nó /data/{uid}/workouts
        const workoutsRef = AdminPanel.state.db.ref(`data/${selectedAthleteId}/workouts`);
        workoutsRef.push(workoutData)
            .then(() => {
                console.log("Treino salvo!");
                addWorkoutForm.reset(); // Limpa o formulário
            })
            .catch((error) => {
                console.error("Erro ao salvar treino:", error);
                alert("Erro ao salvar o treino.");
            });
    },
    
    // Cria o HTML de um card de treino
    createWorkoutCard: (data, id, athleteId) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        el.dataset.id = id;
        
        el.innerHTML = `
            <div class="workout-card-header">
                <div>
                    <span class="date">${data.date}</span>
                    <span class="title">${data.title}</span>
                </div>
                <button class="btn btn-danger btn-small" data-action="delete">
                    <i class="bx bx-trash"></i>
                </button>
            </div>
            <div class="workout-card-body">
                <p>${data.description || "Sem descrição."}</p>
            </div>
        `;
        
        // Adiciona evento ao botão de deletar
        el.querySelector('[data-action="delete"]').addEventListener('click', () => {
            AdminPanel.deleteWorkout(athleteId, id);
        });
        
        return el;
    },
    
    // Deleta um treino
    deleteWorkout: (athleteId, workoutId) => {
        if (!confirm("Tem certeza que deseja apagar este treino?")) {
            return;
        }
        
        const workoutRef = AdminPanel.state.db.ref(`data/${athleteId}/workouts/${workoutId}`);
        workoutRef.remove()
            .then(() => {
                console.log("Treino removido.");
            })
            .catch((error) => {
                console.error("Erro ao remover treino:", error);
                alert("Erro ao remover o treino.");
            });
    }
};

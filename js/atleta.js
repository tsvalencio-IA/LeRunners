// js/atleta.js
// Lógica do Painel do Atleta

const AtletaPanel = {
    state: {
        db: null,
        currentUser: null,
    },

    init: (user, db) => {
        console.log("AtletaPanel: Inicializado.");
        AtletaPanel.state.currentUser = user;
        AtletaPanel.state.db = db;

        // Mapear elementos específicos do Atleta
        AtletaPanel.elements = {
            workoutsList: document.getElementById('atleta-workouts-list')
        };

        // Carregar os treinos do atleta logado
        AtletaPanel.loadWorkouts(user.uid);
    },

    // Carrega os treinos do atleta logado (do nó /data/{uid}/workouts)
    loadWorkouts: (athleteId) => {
        const { workoutsList } = AtletaPanel.elements;
        workoutsList.innerHTML = "Carregando seus treinos...";
        
        const workoutsRef = AtletaPanel.state.db.ref(`data/${athleteId}/workouts`);

        // Ordena pela data
        workoutsRef.orderByChild('date').on('value', (snapshot) => {
            workoutsList.innerHTML = ""; // Limpa
            if (!snapshot.exists()) {
                workoutsList.innerHTML = "<p>Nenhum treino encontrado. Fale com seu coach!</p>";
                return;
            }

            snapshot.forEach((childSnapshot) => {
                const workoutId = childSnapshot.key;
                const workoutData = childSnapshot.val();
                
                // Reutiliza a função de criar card, mas sem o botão de deletar
                const card = AtletaPanel.createWorkoutCard(workoutData);
                // Adiciona no início (treinos mais novos primeiro)
                workoutsList.prepend(card); 
            });
        });
    },

    // Cria o HTML de um card de treino (Versão do Atleta)
    createWorkoutCard: (data) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        
        // Versão simplificada sem o botão de deletar
        el.innerHTML = `
            <div class="workout-card-header">
                <div>
                    <span class="date">${data.date}</span>
                    <span class="title">${data.title}</span>
                </div>
                <span class="status-tag">${data.status}</span>
            </div>
            <div class="workout-card-body">
                <p>${data.description || "Sem descrição."}</p>
            </div>
        `;
        
        return el;
    }
};

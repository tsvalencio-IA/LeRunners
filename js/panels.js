/* =================================================================== */
/* ARQUIVO DE MÓDULOS (V2.7 - PAINEIS E CORREÇÃO DE LIKES - CORRIGIDO)
/* ARQUITETURA: Refatorada (app.js + panels.js)
/* =================================================================== */

// ===================================================================
// 3. AdminPanel (Lógica do Painel Coach V2.6)
// ===================================================================
const AdminPanel = {
    state: {},
    elements: {},

    init: (user, db) => {
        console.log("AdminPanel V2.7: Inicializado.");
        AdminPanel.state = { db, currentUser: user, selectedAthleteId: null, athletes: {} };

        AdminPanel.elements = {
            pendingList: document.getElementById('pending-list'),
            athleteList: document.getElementById('athlete-list'),
            athleteSearch: document.getElementById('athlete-search'),
            athleteDetailName: document.getElementById('athlete-detail-name'),
            athleteDetailContent: document.getElementById('athlete-detail-content'),
            deleteAthleteBtn: document.getElementById('delete-athlete-btn'),
            
            // Abas V2.6 (Diretriz 2)
            tabPrescreverBtn: document.querySelector('[data-tab="prescrever"]'),
            tabKpisBtn: document.querySelector('[data-tab="kpis"]'),
            adminTabPrescrever: document.getElementById('admin-tab-prescrever'),
            adminTabKpis: document.getElementById('admin-tab-kpis'),
            
            // Conteúdo Aba 1
            addWorkoutForm: document.getElementById('add-workout-form'),
            workoutsList: document.getElementById('workouts-list'),

            // Conteúdo Aba 2
            analyzeAthleteBtnIa: document.getElementById('analyze-athlete-btn-ia'),
            iaHistoryList: document.getElementById('ia-history-list')
        };

        // Bind de eventos
        AdminPanel.elements.addWorkoutForm.addEventListener('submit', AdminPanel.handleAddWorkout);
        AdminPanel.elements.athleteSearch.addEventListener('input', AdminPanel.renderAthleteList);
        AdminPanel.elements.deleteAthleteBtn.addEventListener('click', AdminPanel.deleteAthlete);
        
        // Listeners Abas V2.6
        AdminPanel.elements.tabPrescreverBtn.addEventListener('click', () => AdminPanel.switchTab('prescrever'));
        AdminPanel.elements.tabKpisBtn.addEventListener('click', () => {
            AdminPanel.switchTab('kpis');
            // NOVO (V2.6): Carrega o histórico de IA quando a aba é clicada
            if(AdminPanel.state.selectedAthleteId) {
                AdminPanel.loadIaHistory(AdminPanel.state.selectedAthleteId);
            }
        });
        AdminPanel.elements.analyzeAthleteBtnIa.addEventListener('click', AdminPanel.handleAnalyzeAthleteIA);
        
        // Carregar dados
        AdminPanel.loadPendingApprovals();
        AdminPanel.loadAthletes();
    },

    // NOVO (V2.6): Controle das Abas
    switchTab: (tabName) => {
        const { tabPrescreverBtn, tabKpisBtn, adminTabPrescrever, adminTabKpis } = AdminPanel.elements;
        
        const isPrescrever = (tabName === 'prescrever');
        
        tabPrescreverBtn.classList.toggle('active', isPrescrever);
        adminTabPrescrever.classList.toggle('active', isPrescrever);
        
        tabKpisBtn.classList.toggle('active', !isPrescrever);
        adminTabKpis.classList.toggle('active', !isPrescrever);
    },

    loadPendingApprovals: () => {
        const pendingRef = AdminPanel.state.db.ref('pendingApprovals');
        AppPrincipal.state.listeners['adminPending'] = pendingRef.on('value', snapshot => {
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
        AppPrincipal.state.listeners['adminAthletes'] = athletesRef.orderByChild('name').on('value', snapshot => {
            AdminPanel.state.athletes = snapshot.val() || {};
            AdminPanel.renderAthleteList();
        });
    },

    renderAthleteList: () => {
        const { athleteList, athleteSearch } = AdminPanel.elements;
        const searchTerm = athleteSearch.value.toLowerCase();
        athleteList.innerHTML = "";
        
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
            
            const newUserProfile = { name: pendingData.name, email: pendingData.email, role: "atleta", createdAt: new Date().toISOString() };
            const newPublicProfile = { name: pendingData.name };
            
            const updates = {};
            updates[`/users/${uid}`] = newUserProfile;
            updates[`/publicProfiles/${uid}`] = newPublicProfile;
            updates[`/data/${uid}`] = { workouts: {} };     
            updates[`/iaAnalysisHistory/${uid}`] = {}; // NOVO (V2.6): Cria o nó de histórico
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
        AdminPanel.state.db.ref('pendingApprovals/' + uid).remove()
            .then(() => console.log("Solicitação rejeitada."))
            .catch(err => alert("Falha ao rejeitar: " + err.message));
    },

    deleteAthlete: () => {
        const { selectedAthleteId } = AdminPanel.state;
        if (!selectedAthleteId) return;
        
        const athleteName = AdminPanel.state.athletes[selectedAthleteId].name;
        if (!confirm(`ATENÇÃO: Isso irá apagar PERMANENTEMENTE o atleta "${athleteName}" e todos os seus dados (treinos, comentários, IA, etc.).\n\nIsso NÃO pode ser desfeito.\n\nTem certeza?`)) {
            return;
        }

        const updates = {};
        updates[`/users/${selectedAthleteId}`] = null;
        updates[`/data/${selectedAthleteId}`] = null;
        updates[`/publicProfiles/${selectedAthleteId}`] = null;
        updates[`/iaAnalysisHistory/${selectedAthleteId}`] = null; // NOVO (V2.6)
        
        const feedRef = AdminPanel.state.db.ref('publicWorkouts');
        feedRef.orderByChild('ownerId').equalTo(selectedAthleteId).once('value', snapshot => {
            snapshot.forEach(childSnapshot => {
                const workoutId = childSnapshot.key;
                updates[`/publicWorkouts/${workoutId}`] = null;
                updates[`/workoutComments/${workoutId}`] = null;
                updates[`/workoutLikes/${workoutId}`] = null;
            });
            
            AdminPanel.state.db.ref().update(updates)
                .then(() => {
                    console.log("Atleta e seus dados públicos foram excluídos.");
                    AdminPanel.selectAthlete(null, null); // Desseleciona
                })
                .catch(err => alert("Erro ao excluir atleta: " + err.message));
        });
    },

    selectAthlete: (uid, name) => {
        // Limpa listeners antigos
        if (AppPrincipal.state.listeners['adminWorkouts']) {
            AppPrincipal.state.listeners['adminWorkouts'].off();
        }
        if (AppPrincipal.state.listeners['adminIaHistory']) {
            AppPrincipal.state.listeners['adminIaHistory'].off();
        }

        if (uid === null) {
            // Desselecionando
            AdminPanel.state.selectedAthleteId = null;
            AdminPanel.elements.athleteDetailName.textContent = "Selecione um Atleta";
            AdminPanel.elements.athleteDetailContent.classList.add('hidden');
        } else {
            // Selecionando
            AdminPanel.state.selectedAthleteId = uid;
            AdminPanel.elements.athleteDetailName.textContent = `Atleta: ${name}`;
            AdminPanel.elements.athleteDetailContent.classList.remove('hidden');
            AdminPanel.switchTab('prescrever'); // Sempre reseta para a aba 'prescrever'
            AdminPanel.loadWorkouts(uid);
            AdminPanel.loadIaHistory(uid); // V2.6: Carrega o histórico (mesmo que a aba não esteja visível)
        }
        
        document.querySelectorAll('.athlete-list-item').forEach(el => {
            el.classList.toggle('selected', el.dataset.uid === uid);
        });
    },

    loadWorkouts: (athleteId) => {
        const { workoutsList } = AdminPanel.elements;
        workoutsList.innerHTML = "<p>Carregando treinos...</p>";
        
        const workoutsRef = AdminPanel.state.db.ref(`data/${athleteId}/workouts`);
        AppPrincipal.state.listeners['adminWorkouts'] = workoutsRef.orderByChild('date').on('value', snapshot => {
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
    
    // NOVO (V2.6): Carrega o histórico de Análises Salvas da IA (Diretriz 2)
    loadIaHistory: (athleteId) => {
        const { iaHistoryList } = AdminPanel.elements;
        if (!iaHistoryList) return; // Se a aba não foi nem renderizada
        
        iaHistoryList.innerHTML = "<p>Carregando histórico de IA...</p>";
        
        const historyRef = AdminPanel.state.db.ref(`iaAnalysisHistory/${athleteId}`);
        AppPrincipal.state.listeners['adminIaHistory'] = historyRef.orderByChild('analysisDate').limitToLast(10).on('value', snapshot => {
            iaHistoryList.innerHTML = ""; 
            if (!snapshot.exists()) {
                iaHistoryList.innerHTML = "<p>Nenhuma análise de IA salva para este atleta.</p>";
                return;
            }

            let items = [];
            snapshot.forEach(childSnapshot => {
                items.push({
                    id: childSnapshot.key,
                    data: childSnapshot.val()
                });
            });

            // Inverte para mostrar o mais novo primeiro
            items.reverse().forEach(item => {
                const card = AdminPanel.createIaHistoryCard(item.id, item.data);
                iaHistoryList.appendChild(card);
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
            feedback: "",
            imageUrl: null,
            stravaData: null // V2.6
        };

        if (!workoutData.date || !workoutData.title) return alert("Data e Título são obrigatórios.");

        AdminPanel.state.db.ref(`data/${selectedAthleteId}/workouts`).push(workoutData)
            .then(() => addWorkoutForm.reset())
            .catch(err => alert("Falha ao salvar o treino: " + err.message));
    },
    
    // Card de Treino (Versão Admin V2.6)
    createWorkoutCard: (id, data, athleteId) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        el.innerHTML = `
            <div class="workout-card-header">
                <span class="date">${data.date}</span>
                <span class="title">${data.title}</span>
                <span class="status-tag ${data.status || 'planejado'}">${data.status || 'planejado'}</span>
            </div>
            <div class="workout-card-body">
                <p>${data.description || "Sem descrição."}</p>
                ${data.feedback ? `<p class="feedback-text">${data.feedback}</p>` : ''}
                ${data.stravaData ? AdminPanel.createStravaDataDisplay(data.stravaData) : ''}
                ${data.imageUrl ? `<img src="${data.imageUrl}" alt="Foto do treino" class="workout-image">` : ''}
            </div>
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
                const updates = {};
                updates[`/data/${athleteId}/workouts/${id}`] = null;
                updates[`/publicWorkouts/${id}`] = null;
                updates[`/workoutComments/${id}`] = null;
                updates[`/workoutLikes/${id}`] = null;
                
                AdminPanel.state.db.ref().update(updates)
                    .catch(err => alert("Falha ao deletar: " + err.message));
            }
        });
        
        // Carrega Likes e Comentários (V2.6)
        AdminPanel.loadWorkoutStats(el, id, athleteId);
        
        return el;
    },
    
    // NOVO (V2.6): Card para o Histórico de IA (Diretriz 2)
    createIaHistoryCard: (id, data) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        
        const date = new Date(data.analysisDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        
        // Pega um resumo da análise (primeiras linhas)
        const summary = data.analysisResult.split('\n').slice(0, 3).join('\n') + '...';

        el.innerHTML = `
            <div class="workout-card-header">
                <div>
                    <span class="date">Análise de ${date}</span>
                    <span class="title">Gerada por ${AppPrincipal.state.publicProfiles[data.coachUid]?.name || 'Coach'}</span>
                </div>
            </div>
            <div class="workout-card-body">
                <p>${summary}</p>
            </div>
        `;

        // Abre o modal da IA em modo "Visualização"
        el.addEventListener('click', () => {
            AppPrincipal.openIaAnalysisModal(data);
        });
        
        return el;
    },

    // NOVO (V2.6): Helper para mostrar dados do Strava
    createStravaDataDisplay: (stravaData) => {
        return `
            <fieldset class="strava-data-display">
                <legend><i class='bx bxl-strava'></i> Dados Extraídos (Gemini Vision)</legend>
                <p>Distância: ${stravaData.distancia || "N/A"}</p>
                <p>Tempo:     ${stravaData.tempo || "N/A"}</p>
                <p>Ritmo:     ${stravaData.ritmo || "N/A"}</p>
            </fieldset>
        `;
    },
    
    // Carrega status (likes/comentários) de um card (V2.6 - CORREÇÃO LIKES)
    loadWorkoutStats: (cardElement, workoutId, ownerId) => {
        const likeBtn = cardElement.querySelector('.btn-like');
        const likeCount = cardElement.querySelector('.like-count');
        const commentCount = cardElement.querySelector('.comment-count');
        
        // DIRETRIZ 5 (Likes UX): Verifica se o usuário logado é o dono
        const isOwner = (AdminPanel.state.currentUser.uid === ownerId);
        
        const likesRef = AdminPanel.state.db.ref(`workoutLikes/${workoutId}`);
        const commentsRef = AdminPanel.state.db.ref(`workoutComments/${workoutId}`);
        
        const likesListener = likesRef.on('value', snapshot => {
            const count = snapshot.numChildren();
            likeCount.textContent = count;

            if (snapshot.hasChild(AdminPanel.state.currentUser.uid)) {
                likeBtn.classList.add('liked');
            } else {
                likeBtn.classList.remove('liked');
            }
            
            // DIRETRIZ 5 (Likes UX): Dono não pode curtir o próprio post
            if (isOwner) {
                likeBtn.disabled = true;
            }

            if (count > 0) {
                likeCount.classList.add('like-count-btn');
                likeCount.onclick = (e) => {
                    e.stopPropagation();
                    AppPrincipal.openWhoLikedModal(workoutId);
                };
            } else {
                likeCount.classList.remove('like-count-btn');
                likeCount.onclick = null;
            }
        });
        
        const commentsListener = commentsRef.on('value', snapshot => {
            commentCount.textContent = snapshot.numChildren();
        });

        // Ação de Curtir (Coach) - Só adiciona se NÃO for o dono
        if (!isOwner) {
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const myLikeRef = likesRef.child(AdminPanel.state.currentUser.uid);
                myLikeRef.once('value', snapshot => {
                    if (snapshot.exists()) {
                        myLikeRef.remove(); // Descurtir
                    } else {
                        myLikeRef.set(true); // Curtir
                    }
                });
            });
        }
        
        AppPrincipal.state.listeners[String(`likes_${workoutId}`)] = likesListener;
        AppPrincipal.state.listeners[String(`comments_${workoutId}`)] = commentsListener;
    },

    // ATUALIZADO (V2.7 - CORRIGIDO): Lógica de Análise IA (Diretriz 2 e 4)
    handleAnalyzeAthleteIA: async () => {
        const { selectedAthleteId } = AdminPanel.state;
        if (!selectedAthleteId) return alert("Selecione um atleta.");
        
        AppPrincipal.openIaAnalysisModal(); // Abre o modal (sem dados)
        
        // CORREÇÃO V2.7: Acessa as variáveis corretas do AppPrincipal
        const iaAnalysisOutput = AppPrincipal.elements.iaAnalysisOutput;
        const saveBtn = AppPrincipal.elements.saveIaAnalysisBtn;
        
        iaAnalysisOutput.textContent = "Coletando dados do atleta...";
        saveBtn.classList.add('hidden'); // Esconde o botão Salvar

        try {
            // 1. Coletar dados do atleta (últimos 10 treinos)
            const athleteName = AdminPanel.state.athletes[selectedAthleteId].name;
            const dataRef = AdminPanel.state.db.ref(`data/${selectedAthleteId}/workouts`);
            const snapshot = await dataRef.orderByChild('date').limitToLast(10).once('value');
            
            if (!snapshot.exists()) {
                throw new Error("Nenhum dado de treino encontrado para este atleta.");
            }
            
            const workoutData = snapshot.val();
            
            // 2. Montar o Prompt
            const prompt = `
                ATUE COMO: Um Coach de Corrida Sênior (Leandro) analisando um atleta.
                OBJETIVO: Analisar os últimos 10 treinos de um atleta e fornecer um resumo e pontos de ação.
                
                ATLETA: ${athleteName}
                
                DADOS BRUTOS (JSON dos últimos 10 treinos):
                ${JSON.stringify(workoutData, null, 2)}
                
                ANÁLISE SOLICITADA:
                Com base nos dados acima (status, feedback do atleta, datas, e stravaData se houver), gere um relatório conciso em TÓPICOS (Markdown) respondendo:
                1.  **Consistência:** O atleta está treinando regularmente? (Compare as 'datas' dos treinos 'realizados').
                2.  **Percepção de Esforço:** Qual é o sentimento geral do atleta? (Analise os campos 'feedback').
                3.  **Performance (Dados):** O atleta registrou dados do Strava (stravaData)? Se sim, os ritmos são condizentes com os treinos?
                4.  **Pontos de Atenção:** Existem sinais de alerta? (Ex: Dores, status 'nao_realizado' frequente, feedbacks negativos).
                5.  **Sugestão de Foco:** Qual deve ser o foco para a próxima semana? (Ex: Focar em recuperação, aumentar volume, etc.).
            `;
            
            iaAnalysisOutput.textContent = "Enviando dados para análise (Gemini)...";
            
            // 3. Chamar a API (do AppPrincipal)
            const analysisResult = await AppPrincipal.callGeminiTextAPI(prompt);
            
            // 4. Exibir resultado e armazenar no state (para o botão Salvar)
            iaAnalysisOutput.textContent = analysisResult;
            AppPrincipal.state.currentAnalysisData = {
                analysisDate: new Date().toISOString(),
                coachUid: AdminPanel.state.currentUser.uid,
                prompt: prompt, // Salva o prompt para referência futura
                analysisResult: analysisResult
            };
            saveBtn.classList.remove('hidden'); // Mostra o botão Salvar

        } catch (err) {
            console.error("Erro na Análise IA:", err);
            iaAnalysisOutput.textContent = `ERRO: ${err.message}`;
            saveBtn.classList.add('hidden'); // Esconde o botão se der erro
        }
    }
};

// ===================================================================
// 4. AtletaPanel (Lógica do Painel Atleta V2.6)
// ===================================================================
const AtletaPanel = {
    state: {},
    elements: {},

    init: (user, db) => {
        console.log("AtletaPanel V2.6: Inicializado.");
        AtletaPanel.state = { db, currentUser: user };
        AtletaPanel.elements = { 
            workoutsList: document.getElementById('atleta-workouts-list'),
            logManualActivityBtn: document.getElementById('log-manual-activity-btn')
        };

        // NOVO (V2.3): Botão Log Manual
        AtletaPanel.elements.logManualActivityBtn.addEventListener('click', AppPrincipal.openLogActivityModal);

        AtletaPanel.loadWorkouts(user.uid);
    },

    loadWorkouts: (athleteId) => {
        const { workoutsList } = AtletaPanel.elements;
        workoutsList.innerHTML = "<p>Carregando seus treinos...</p>";
        
        const workoutsRef = AtletaPanel.state.db.ref(`data/${athleteId}/workouts`);
        AppPrincipal.state.listeners['atletaWorkouts'] = workoutsRef.orderByChild('date').on('value', snapshot => {
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

    // Card de Treino (Versão Atleta V2.6)
    createWorkoutCard: (id, data, athleteId) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        el.innerHTML = `
            <div class="workout-card-header">
                <span class="date">${data.date}</span>
                <span class="title">${data.title}</span>
                <span class="status-tag ${data.status || 'planejado'}">${data.status || 'planejado'}</span>
            </div>
            <div class="workout-card-body">
                <p>${data.description || "Sem descrição."}</p>
                ${data.feedback ? `<p class="feedback-text">${data.feedback}</p>` : ''}
                ${data.stravaData ? AdminPanel.createStravaDataDisplay(data.stravaData) : ''}
                ${data.imageUrl ? `<img src="${data.imageUrl}" alt="Foto do treino" class="workout-image">` : ''}
            </div>
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
        
        // Carrega Likes e Comentários (V2.6)
        AtletaPanel.loadWorkoutStats(el, id, athleteId);
        
        return el;
    },
    
    // Carrega status (likes/comentários) de um card (V2.6 - CORREÇÃO LIKES)
    loadWorkoutStats: (cardElement, workoutId, ownerId) => {
        const likeBtn = cardElement.querySelector('.btn-like');
        const likeCount = cardElement.querySelector('.like-count');
        const commentCount = cardElement.querySelector('.comment-count');
        
        // DIRETRIZ 5 (Likes UX): Verifica se o usuário logado é o dono
        const isOwner = (AtletaPanel.state.currentUser.uid === ownerId);
        
        const likesRef = AtletaPanel.state.db.ref(`workoutLikes/${workoutId}`);
        const commentsRef = AtletaPanel.state.db.ref(`workoutComments/${workoutId}`);
        
        const likesListener = likesRef.on('value', snapshot => {
            const count = snapshot.numChildren();
            likeCount.textContent = count;

            if (snapshot.hasChild(AtletaPanel.state.currentUser.uid)) {
                likeBtn.classList.add('liked');
            } else {
                likeBtn.classList.remove('liked');
            }

            // DIRETRIZ 5 (Likes UX): Dono não pode curtir o próprio post
            if (isOwner) {
                likeBtn.disabled = true;
            }

            if (count > 0) {
                likeCount.classList.add('like-count-btn');
                likeCount.onclick = (e) => {
                    e.stopPropagation();
                    AppPrincipal.openWhoLikedModal(workoutId);
                };
            } else {
                likeCount.classList.remove('like-count-btn');
                likeCount.onclick = null;
            }
        });
        
        const commentsListener = commentsRef.on('value', snapshot => {
            commentCount.textContent = snapshot.numChildren();
        });

        // Ação de Curtir (Atleta) - Só adiciona se NÃO for o dono
        if (!isOwner) {
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
        }
        
        // Ação de Comentar (Atleta) - Abre o modal
        cardElement.querySelector('.btn-comment').addEventListener('click', (e) => {
             e.stopPropagation(); 
             // O clique no card (que é o listener principal) vai abrir o modal
        });
        
        AppPrincipal.state.listeners[String(`likes_${workoutId}`)] = likesListener;
        AppPrincipal.state.listeners[String(`comments_${workoutId}`)] = commentsListener;
    }
};

// ===================================================================
// 5. FeedPanel (Lógica do Feed Social V2.6)
// ===================================================================
const FeedPanel = {
    state: {},
    elements: {},

    init: (user, db) => {
        console.log("FeedPanel V2.6: Inicializado.");
        FeedPanel.state = { db, currentUser: user };
        FeedPanel.elements = { feedList: document.getElementById('feed-list') };
        
        FeedPanel.loadFeed();
    },

    loadFeed: () => {
        const { feedList } = FeedPanel.elements;
        feedList.innerHTML = "<p>Carregando feed...</p>";
        
        const feedRef = FeedPanel.state.db.ref('publicWorkouts');
        AppPrincipal.state.listeners['feedData'] = feedRef.orderByChild('realizadoAt').limitToLast(20).on('value', snapshot => {
            feedList.innerHTML = "";
            if (!snapshot.exists()) {
                feedList.innerHTML = "<p>Nenhum treino realizado pela equipe ainda.</p>";
                return;
            }
            
            let feedItems = [];
            snapshot.forEach(childSnapshot => {
                feedItems.push({
                    id: childSnapshot.key,
                    data: childSnapshot.val()
                });
            });

            feedItems.reverse().forEach(item => {
                const card = FeedPanel.createFeedCard(
                    item.id,
                    item.data,
                    item.data.ownerId
                );
                feedList.appendChild(card);
            });
        });
    },
    
    // Card do Feed (V2.6)
    createFeedCard: (id, data, ownerId) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        
        const athleteName = AppPrincipal.state.publicProfiles[ownerId]?.name || data.ownerName || "Atleta";
        
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
                ${data.description ? `<p>${data.description}</p>` : ''}
                ${data.feedback ? `<p class="feedback-text">${data.feedback}</p>` : ''}
                ${data.stravaData ? AdminPanel.createStravaDataDisplay(data.stravaData) : ''}
                ${data.imageUrl ? `<img src="${data.imageUrl}" alt="Foto do treino" class="workout-image">` : ''}
            </div>
            <div class="workout-card-footer">
                <div class="workout-actions">
                    <button class="action-btn btn-like"><i class='bx bx-heart'></i> <span class="like-count">0</span></button>
                    <button class="action-btn btn-comment"><i class='bx bx-comment'></i> <span class="comment-count">0</span></button>
                </div>
            </div>
        `;
        
        // Abre o Modal de Comentários
        el.addEventListener('click', (e) => {
             if (!e.target.closest('button')) { // Não abre se clicar no like
                AppPrincipal.openFeedbackModal(id, ownerId, data.title);
             }
        });

        // Carrega Likes e Comentários (V2.6)
        FeedPanel.loadWorkoutStats(el, id, ownerId);
        
        return el;
    },
    
    // Carrega status (likes/comentários) de um card (V2.6 - CORREÇÃO LIKES)
    loadWorkoutStats: (cardElement, workoutId, ownerId) => {
        const likeBtn = cardElement.querySelector('.btn-like');
        const likeCount = cardElement.querySelector('.like-count');
        const commentCount = cardElement.querySelector('.comment-count');

        // DIRETRIZ 5 (Likes UX): Verifica se o usuário logado é o dono
        const isOwner = (FeedPanel.state.currentUser.uid === ownerId);

        const likesRef = FeedPanel.state.db.ref(`workoutLikes/${workoutId}`);
        const commentsRef = FeedPanel.state.db.ref(`workoutComments/${workoutId}`);
        
        const likesListener = likesRef.on('value', snapshot => {
            const count = snapshot.numChildren();
            likeCount.textContent = count;
            
            if (snapshot.hasChild(FeedPanel.state.currentUser.uid)) {
                likeBtn.classList.add('liked');
            } else {
                likeBtn.classList.remove('liked');
            }

            // DIRETRIZ 5 (Likes UX): Dono não pode curtir o próprio post
            if (isOwner) {
                likeBtn.disabled = true;
            }

            if (count > 0) {
                likeCount.classList.add('like-count-btn');
                likeCount.onclick = (e) => {
                    e.stopPropagation();
                    AppPrincipal.openWhoLikedModal(workoutId);
                };
            } else {
                likeCount.classList.remove('like-count-btn');
                likeCount.onclick = null;
            }
        });
        
        const commentsListener = commentsRef.on('value', snapshot => {
            commentCount.textContent = snapshot.numChildren();
        });

        // Ação de Curtir - Só adiciona se NÃO for o dono
        if (!isOwner) {
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Impede o modal de abrir
                const myLikeRef = likesRef.child(FeedPanel.state.currentUser.uid);
                myLikeRef.once('value', snapshot => {
                    if (snapshot.exists()) {
                        myLikeRef.remove(); // Descurtir
                    } else {
                        myLikeRef.set(true); // Curtir
                    }
                });
            });
        }
        
        AppPrincipal.state.listeners[String(`feed_likes_${workoutId}`)] = likesListener;
        AppPrincipal.state.listeners[String(`feed_comments_${workoutId}`)] = commentsListener;
    }
};

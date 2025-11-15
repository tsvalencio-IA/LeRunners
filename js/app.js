/* =================================================================== */
/* ARQUIVO DE LÓGICA UNIFICADO (V3.2 - VER PERFIL PÚBLICO)
/* ARQUITETURA: Refatorada (app.js + panels.js)
/* CORREÇÃO CRÍTICA STRAVA (V3.2.1): Espera a autenticação do Firebase antes de trocar o código.
/* =================================================================== */

// ===================================================================
// 1. AppPrincipal (O Cérebro)
// ===================================================================
const AppPrincipal = {
    state: {
        currentUser: null, // O objeto 'user' do Auth
        userData: null,    // O perfil de '/users/' (name, role, photoUrl, bio)
        db: null,
        auth: null,
        listeners: {},     // Para limpar listeners do Firebase
        currentView: 'planilha', // 'planilha' ou 'feed'
        adminUIDs: {},     // Cache dos UIDs de admins
        userCache: {},     // Cache de NOMES vindo de /users (V2.9)
        modal: {
            isOpen: false,
            currentWorkoutId: null,
            currentOwnerId: null,
            newPhotoUrl: null // (V3.0): Para o upload da foto de perfil
        },
        stravaData: null, // (V2.6): Armazena dados extraídos da IA Vision
        currentAnalysisData: null // (V2.6): Armazena a última análise da IA
    },

    elements: {
        appContainer: document.getElementById('app-container'),
        loader: document.getElementById('loader'),
        logoutBtn: document.getElementById('logout-btn'),
        navPlanilhaBtn: document.getElementById('nav-planilha-btn'),
        navFeedBtn: document.getElementById('nav-feed-btn'),
        userDisplay: document.getElementById('user-display'),
        userName: document.getElementById('user-name'),
        userRole: document.getElementById('user-role'),
        userPhoto: document.getElementById('user-photo'),
        adminPanelBtn: document.getElementById('admin-panel-btn'),
        
        // Modais e seus botões (V3.0)
        profileModal: document.getElementById('profile-modal'),
        openProfileModalBtn: document.getElementById('open-profile-modal-btn'),
        closeProfileModalBtn: document.getElementById('close-profile-modal-btn'),
        editProfileModal: document.getElementById('edit-profile-modal'),
        closeEditProfileModalBtn: document.getElementById('close-edit-profile-modal-btn'),
        
        // Perfil Público (V3.2)
        publicProfileModal: document.getElementById('public-profile-modal'),
        closePublicProfileModalBtn: document.getElementById('close-public-profile-modal-btn'),

        // Edição de Perfil
        editProfileForm: document.getElementById('edit-profile-form'),
        editProfileName: document.getElementById('edit-profile-name'),
        editProfileBio: document.getElementById('edit-profile-bio'),
        uploadProfilePhotoBtn: document.getElementById('upload-profile-photo-btn'),
        profilePhotoPreview: document.getElementById('profile-photo-preview'),
        
        // Modal de Treino
        workoutModal: document.getElementById('workout-modal'),
        closeWorkoutModalBtn: document.getElementById('close-workout-modal-btn'),
        workoutModalTitle: document.getElementById('workout-modal-title'),
        workoutModalDate: document.getElementById('workout-modal-date'),
        workoutModalPrescricao: document.getElementById('workout-modal-prescricao'),
        workoutModalRegistro: document.getElementById('workout-modal-registro'),
        workoutModalStatus: document.getElementById('workout-modal-status'),
        workoutModalPhoto: document.getElementById('workout-modal-photo'),
        workoutModalComments: document.getElementById('workout-modal-comments'),
        workoutModalCommentInput: document.getElementById('workout-modal-comment-input'),
        workoutModalSendCommentBtn: document.getElementById('workout-modal-send-comment-btn'),
        
        // Modal de Curtidas
        whoLikedModal: document.getElementById('who-liked-modal'),
        closeWhoLikedModalBtn: document.getElementById('close-who-liked-modal-btn'),
        whoLikedList: document.getElementById('who-liked-list'),
        
        // Painéis
        planilhaPanel: document.getElementById('planilha-panel'),
        feedPanel: document.getElementById('feed-panel'),
        adminPanel: document.getElementById('admin-panel'),
        
        // Modal IA/Strava (V2.6)
        iaAnalysisModal: document.getElementById('ia-analysis-modal'),
        closeIaAnalysisModalBtn: document.getElementById('close-ia-analysis-modal-btn'),
        iaAnalysisInput: document.getElementById('ia-analysis-input'),
        iaAnalysisOutput: document.getElementById('ia-analysis-output'),
        iaAnalysisForm: document.getElementById('ia-analysis-form'),
        iaAnalysisLoader: document.getElementById('ia-analysis-loader'),
        
    },

    init: () => {
        console.log("Iniciando AppPrincipal V3.2 (Cérebro, Ver Perfil)...");
        
        // V2.5: Verifica a chave no 'window'
        if (typeof window.firebaseConfig === 'undefined') {
            console.error("ERRO: O arquivo js/config.js não foi carregado corretamente.");
            AppPrincipal.showError("Erro de Configuração. Verifique o arquivo config.js.");
            return;
        }

        // 1. Inicializa o Firebase
        if (firebase.apps.length === 0) {
            firebase.initializeApp(window.firebaseConfig);
        }
        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        // 2. Registra Event Listeners
        AppPrincipal.registerEventListeners();
        
        // 3. Gerencia o Estado de Autenticação
        AppPrincipal.handlePlatformAuthStateChange();
    },
    
    registerEventListeners: () => {
        // Navegação
        AppPrincipal.elements.navPlanilhaBtn.addEventListener('click', () => AppPrincipal.changeView('planilha'));
        AppPrincipal.elements.navFeedBtn.addEventListener('click', () => AppPrincipal.changeView('feed'));
        
        // Logout
        AppPrincipal.elements.logoutBtn.addEventListener('click', AppPrincipal.handleLogout);

        // Modais (V3.0)
        AppPrincipal.elements.openProfileModalBtn.addEventListener('click', AppPrincipal.openProfileModal);
        AppPrincipal.elements.closeProfileModalBtn.addEventListener('click', AppPrincipal.closeProfileModal);
        
        AppPrincipal.elements.closeEditProfileModalBtn.addEventListener('click', AppPrincipal.closeEditProfileModal);
        AppPrincipal.elements.editProfileForm.addEventListener('submit', AppPrincipal.handleEditProfileSubmit);
        AppPrincipal.elements.uploadProfilePhotoBtn.addEventListener('click', AppPrincipal.openCloudinaryWidget);
        
        AppPrincipal.elements.closeWorkoutModalBtn.addEventListener('click', AppPrincipal.closeWorkoutModal);
        AppPrincipal.elements.workoutModalSendCommentBtn.addEventListener('click', AppPrincipal.handleCommentSubmit);
        AppPrincipal.elements.workoutModalCommentInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                AppPrincipal.handleCommentSubmit();
            }
        });

        AppPrincipal.elements.closeWhoLikedModalBtn.addEventListener('click', AppPrincipal.closeWhoLikedModal);
        
        // Modal de Perfil Público (V3.2)
        AppPrincipal.elements.closePublicProfileModalBtn.addEventListener('click', AppPrincipal.closePublicProfileModal);

        // Modal IA (V2.6)
        AppPrincipal.elements.closeIaAnalysisModalBtn.addEventListener('click', AppPrincipal.closeIaAnalysisModal);
        AppPrincipal.elements.iaAnalysisForm.addEventListener('submit', AppPrincipal.handleIaAnalysisSubmit);
    },
    
    handlePlatformAuthStateChange: () => {
        AppPrincipal.state.auth.onAuthStateChanged(user => {
            if (user) {
                // Usuário logado. Carregar dados e inicializar a plataforma.
                AppPrincipal.state.currentUser = user;
                AppPrincipal.loadUserData(user.uid);
            } else {
                // Usuário deslogado. Redirecionar para login.
                window.location.href = 'index.html';
            }
        });
    },
    
    loadUserData: async (uid) => {
        // Limpa listeners anteriores, se houver
        AppPrincipal.clearListeners(); 
        
        // 1. Carregar dados de Admins para cache
        AppPrincipal.state.db.ref('admins').once('value', snapshot => {
            AppPrincipal.state.adminUIDs = {};
            snapshot.forEach(child => {
                AppPrincipal.state.adminUIDs[child.key] = child.val();
            });
            // 2. Carregar dados do usuário logado
            AppPrincipal.state.db.ref('users/' + uid).on('value', userSnapshot => {
                const userData = userSnapshot.val();
                if (userData) {
                    AppPrincipal.state.userData = userData;
                    AppPrincipal.updateUI(userData);
                    AppPrincipal.initPlatform();
                } else {
                    // Usuário aprovado, mas sem dados (erro raro). Deslogar.
                    AppPrincipal.handleLogout(); 
                }
            });
        });
    },

    updateUI: (userData) => {
        const isCoach = userData.role === 'coach';
        
        // Atualiza cabeçalho (Header)
        AppPrincipal.elements.userName.textContent = userData.name || 'Atleta';
        AppPrincipal.elements.userRole.textContent = isCoach ? 'Coach' : 'Atleta';
        AppPrincipal.elements.userPhoto.src = userData.photoUrl || 'img/default-profile.png';
        
        // Oculta/Exibe botão Admin
        AppPrincipal.elements.adminPanelBtn.classList.toggle('hidden', !isCoach);

        // Se for Coach, força a visualização do painel de administração na inicialização
        if (isCoach && AppPrincipal.state.currentView === 'planilha') {
            AppPrincipal.changeView('admin');
        } else if (!isCoach && AppPrincipal.state.currentView === 'admin') {
            // Se atleta logar e estiver na view 'admin' (por URL), muda para 'planilha'
            AppPrincipal.changeView('planilha'); 
        }

        // Esconde o loader e mostra a aplicação
        AppPrincipal.elements.loader.classList.add('hidden');
        AppPrincipal.elements.appContainer.classList.remove('hidden');
    },

    // ===================================================================
    // MÉTODOS DE CONTROLE (Views e Modals)
    // ===================================================================
    changeView: (newView) => {
        AppPrincipal.state.currentView = newView;
        
        // Gerencia classes de navegação
        AppPrincipal.elements.navPlanilhaBtn.classList.remove('active');
        AppPrincipal.elements.navFeedBtn.classList.remove('active');
        AppPrincipal.elements.adminPanelBtn.classList.remove('active');

        // Esconde todos os painéis
        AppPrincipal.elements.planilhaPanel.classList.add('hidden');
        AppPrincipal.elements.feedPanel.classList.add('hidden');
        AppPrincipal.elements.adminPanel.classList.add('hidden');

        let panelToShow;
        let navButtonToActivate;

        if (newView === 'planilha') {
            panelToShow = AppPrincipal.elements.planilhaPanel;
            navButtonToActivate = AppPrincipal.elements.navPlanilhaBtn;
            PlanilhaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        } else if (newView === 'feed') {
            panelToShow = AppPrincipal.elements.feedPanel;
            navButtonToActivate = AppPrincipal.elements.navFeedBtn;
            FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        } else if (newView === 'admin' && AppPrincipal.state.userData.role === 'coach') {
            panelToShow = AppPrincipal.elements.adminPanel;
            navButtonToActivate = AppPrincipal.elements.adminPanelBtn;
            AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        } else {
            // Fallback para 'planilha' se algo der errado (e não for coach)
            AppPrincipal.changeView('planilha');
            return;
        }

        panelToShow.classList.remove('hidden');
        navButtonToActivate.classList.add('active');
    },

    // Modal Perfil
    openProfileModal: () => {
        AppPrincipal.elements.profileModal.classList.remove('hidden');
        AppPrincipal.state.modal.isOpen = true;
        
        // Atualiza a visualização do perfil com dados atuais
        document.getElementById('view-profile-name').textContent = AppPrincipal.state.userData.name || 'Atleta';
        document.getElementById('view-profile-bio').textContent = AppPrincipal.state.userData.bio || 'Sem biografia.';
        document.getElementById('view-profile-pic').src = AppPrincipal.state.userData.photoUrl || 'img/default-profile.png';
        
        // Atualiza o formulário de edição
        AppPrincipal.elements.editProfileName.value = AppPrincipal.state.userData.name || '';
        AppPrincipal.elements.editProfileBio.value = AppPrincipal.state.userData.bio || '';
        AppPrincipal.elements.profilePhotoPreview.src = AppPrincipal.state.userData.photoUrl || 'img/default-profile.png';
    },

    closeProfileModal: () => {
        AppPrincipal.elements.profileModal.classList.add('hidden');
        AppPrincipal.state.modal.isOpen = false;
    },
    
    // Modal Editar Perfil
    openEditProfileModal: () => {
        AppPrincipal.elements.editProfileModal.classList.remove('hidden');
        AppPrincipal.closeProfileModal();
    },
    
    closeEditProfileModal: () => {
        AppPrincipal.elements.editProfileModal.classList.add('hidden');
        AppPrincipal.state.modal.newPhotoUrl = null; // Limpa a URL de foto temporária
    },
    
    // Modal Perfil Público (V3.2)
    openPublicProfileModal: async (uid) => {
        const publicProfileModal = AppPrincipal.elements.publicProfileModal;
        
        // 1. Mostrar Loader
        document.getElementById('public-profile-loader').classList.remove('hidden');
        document.getElementById('public-profile-content').classList.add('hidden');
        publicProfileModal.classList.remove('hidden');
        
        try {
            // 2. Buscar dados públicos
            const snapshot = await AppPrincipal.state.db.ref('users/' + uid).once('value');
            const userData = snapshot.val();

            if (userData) {
                document.getElementById('view-profile-pic').src = userData.photoUrl || 'img/default-profile.png';
                document.getElementById('view-profile-name').textContent = userData.name || 'Atleta';
                document.getElementById('view-profile-bio').textContent = userData.bio || 'Sem biografia.';
                
                // Exibe o conteúdo e esconde o loader
                document.getElementById('public-profile-loader').classList.add('hidden');
                document.getElementById('public-profile-content').classList.remove('hidden');
            } else {
                throw new Error("Usuário não encontrado.");
            }
        } catch (error) {
            alert("Erro ao carregar perfil: " + error.message);
            AppPrincipal.closePublicProfileModal();
        }
    },
    
    closePublicProfileModal: () => {
        AppPrincipal.elements.publicProfileModal.classList.add('hidden');
    },

    // Modal Treino
    openWorkoutModal: (workoutId, ownerId) => {
        AppPrincipal.state.modal.currentWorkoutId = workoutId;
        AppPrincipal.state.modal.currentOwnerId = ownerId;
        
        AppPrincipal.elements.workoutModal.classList.remove('hidden');
        AppPrincipal.state.modal.isOpen = true;
        
        // Limpar e carregar dados do treino
        AppPrincipal.elements.workoutModalTitle.textContent = 'Carregando...';
        AppPrincipal.elements.workoutModalPhoto.innerHTML = '';
        AppPrincipal.elements.workoutModalComments.innerHTML = '<p style="text-align: center;">Carregando comentários...</p>';
        
        AppPrincipal.loadWorkoutDetails(ownerId, workoutId);
        AppPrincipal.loadWorkoutComments(ownerId, workoutId);
    },

    closeWorkoutModal: () => {
        AppPrincipal.elements.workoutModal.classList.add('hidden');
        AppPrincipal.state.modal.isOpen = false;
        
        // Limpa listener de comentários
        AppPrincipal.clearListener('comments-' + AppPrincipal.state.modal.currentWorkoutId);
        AppPrincipal.state.modal.currentWorkoutId = null;
        AppPrincipal.state.modal.currentOwnerId = null;
    },
    
    // Modal Curtidas
    openWhoLikedModal: (workoutId) => {
        AppPrincipal.elements.whoLikedModal.classList.remove('hidden');
        AppPrincipal.elements.whoLikedList.innerHTML = '<li>Carregando...</li>';
        
        const likesRef = AppPrincipal.state.db.ref(`workouts/${AppPrincipal.state.currentUser.uid}/${workoutId}/likes`);
        
        likesRef.once('value', async snapshot => {
            AppPrincipal.elements.whoLikedList.innerHTML = '';
            
            if (snapshot.exists()) {
                const likedUIDs = Object.keys(snapshot.val());
                
                for (const uid of likedUIDs) {
                    const userName = await AppPrincipal.getUserName(uid);
                    const listItem = document.createElement('li');
                    listItem.textContent = userName;
                    AppPrincipal.elements.whoLikedList.appendChild(listItem);
                }
            } else {
                AppPrincipal.elements.whoLikedList.innerHTML = '<li>Ninguém curtiu ainda.</li>';
            }
        });
    },

    closeWhoLikedModal: () => {
        AppPrincipal.elements.whoLikedModal.classList.add('hidden');
    },
    
    // Modal IA (V2.6)
    openIaAnalysisModal: (inputData) => {
        AppPrincipal.elements.iaAnalysisInput.value = inputData || '';
        AppPrincipal.elements.iaAnalysisOutput.innerHTML = ''; // Limpa resultados anteriores
        AppPrincipal.elements.iaAnalysisModal.classList.remove('hidden');
    },
    
    closeIaAnalysisModal: () => {
        AppPrincipal.elements.iaAnalysisModal.classList.add('hidden');
    },

    // ===================================================================
    // MÉTODOS DE DADOS
    // ===================================================================
    loadWorkoutDetails: async (ownerId, workoutId) => {
        try {
            const snapshot = await AppPrincipal.state.db.ref(`workouts/${ownerId}/${workoutId}`).once('value');
            const workout = snapshot.val();
            
            if (!workout) {
                AppPrincipal.elements.workoutModalTitle.textContent = 'Treino não encontrado.';
                return;
            }

            // Atualiza o título e data
            AppPrincipal.elements.workoutModalTitle.textContent = workout.title || 'Treino';
            AppPrincipal.elements.workoutModalDate.textContent = `Data: ${new Date(workout.date).toLocaleDateString('pt-BR')}`;
            
            // Prescrição (V3.5)
            if (workout.prescricao && typeof workout.prescricao === 'object') {
                 AppPrincipal.elements.workoutModalPrescricao.innerHTML = AppPrincipal.formatPrescricaoToHTML(workout.prescricao);
            } else {
                // Fallback para texto simples
                 AppPrincipal.elements.workoutModalPrescricao.innerHTML = `<p>${workout.prescricao || 'Nenhuma prescrição.'}</p>`;
            }
            
            // Registro
            AppPrincipal.elements.workoutModalRegistro.innerHTML = `<p>${workout.registro || 'Nenhum registro de execução.'}</p>`;
            
            // Status
            AppPrincipal.elements.workoutModalStatus.textContent = `Status: ${workout.status || 'Pendente'}`;

            // Foto
            AppPrincipal.elements.workoutModalPhoto.innerHTML = '';
            if (workout.photoUrl) {
                const img = document.createElement('img');
                img.src = workout.photoUrl;
                img.alt = 'Foto do Treino';
                img.style.maxWidth = '100%';
                img.style.borderRadius = 'var(--border-radius)';
                img.onclick = () => window.open(workout.photoUrl, '_blank');
                AppPrincipal.elements.workoutModalPhoto.appendChild(img);
                
                // Botão IA (V2.6)
                if (workout.status === 'Concluído' && AppPrincipal.state.userData.role === 'coach') {
                    const iaButton = document.createElement('button');
                    iaButton.className = 'btn btn-primary';
                    iaButton.textContent = 'Analisar com IA';
                    iaButton.style.marginTop = '1rem';
                    iaButton.onclick = () => AppPrincipal.openIaAnalysisModal(workout.registro || '');
                    AppPrincipal.elements.workoutModalPhoto.appendChild(iaButton);
                }
            }
            
            // Se for treino do usuário logado (V3.5), mostra botões de registro
             if (ownerId === AppPrincipal.state.currentUser.uid && workout.status !== 'Concluído') {
                PlanilhaPanel.renderRegistroActions(workoutId, workout);
            } else {
                // Esconde se for feed ou treino de outro atleta
                PlanilhaPanel.elements.registroActions.classList.add('hidden');
            }


        } catch (error) {
            console.error("Erro ao carregar detalhes do treino:", error);
            AppPrincipal.elements.workoutModalTitle.textContent = 'Erro ao carregar treino.';
        }
    },
    
    loadWorkoutComments: (ownerId, workoutId) => {
        const commentsRef = AppPrincipal.state.db.ref(`workouts/${ownerId}/${workoutId}/comments`);
        const listenerKey = 'comments-' + workoutId;
        
        AppPrincipal.clearListener(listenerKey);
        
        const commentsListener = commentsRef.on('value', async snapshot => {
            const commentsContainer = AppPrincipal.elements.workoutModalComments;
            commentsContainer.innerHTML = '';
            
            if (snapshot.exists()) {
                const comments = [];
                snapshot.forEach(child => {
                    comments.push(child.val());
                });
                
                // Ordena por timestamp
                comments.sort((a, b) => a.timestamp - b.timestamp);
                
                for (const comment of comments) {
                    const commentElement = document.createElement('div');
                    commentElement.className = 'comment-item';
                    
                    const userName = await AppPrincipal.getUserName(comment.uid);
                    const isOwner = comment.uid === ownerId;
                    const commentDate = new Date(comment.timestamp).toLocaleString('pt-BR');
                    
                    commentElement.innerHTML = `
                        <p class="comment-header">
                            <strong>${userName}</strong> 
                            <span class="comment-role ${isOwner ? 'comment-owner' : ''}">${isOwner ? (await AppPrincipal.getUserData(ownerId)).role === 'coach' ? 'Coach' : 'Atleta' : (await AppPrincipal.getUserData(comment.uid)).role === 'coach' ? 'Coach' : 'Atleta'}</span>
                            <span class="comment-date">${commentDate}</span>
                        </p>
                        <p>${AppPrincipal.escapeHTML(comment.text)}</p>
                    `;
                    commentsContainer.appendChild(commentElement);
                }
            } else {
                commentsContainer.innerHTML = '<p style="text-align: center;">Seja o primeiro a comentar!</p>';
            }
        });
        
        AppPrincipal.state.listeners[listenerKey] = commentsListener;
    },
    
    handleCommentSubmit: () => {
        const input = AppPrincipal.elements.workoutModalCommentInput;
        const text = input.value.trim();
        const workoutId = AppPrincipal.state.modal.currentWorkoutId;
        const ownerId = AppPrincipal.state.modal.currentOwnerId;

        if (text && workoutId && ownerId) {
            const newCommentRef = AppPrincipal.state.db.ref(`workouts/${ownerId}/${workoutId}/comments`).push();
            newCommentRef.set({
                uid: AppPrincipal.state.currentUser.uid,
                text: text,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            })
            .then(() => {
                input.value = '';
                // O listener de loadWorkoutComments fará o refresh
            })
            .catch(error => {
                alert("Erro ao enviar comentário: " + error.message);
            });
        }
    },
    
    handleEditProfileSubmit: async (e) => {
        e.preventDefault();
        
        const newName = AppPrincipal.elements.editProfileName.value.trim();
        const newBio = AppPrincipal.elements.editProfileBio.value.trim();
        const newPhotoUrl = AppPrincipal.state.modal.newPhotoUrl || AppPrincipal.state.userData.photoUrl;
        
        if (!newName) {
            alert("O nome é obrigatório.");
            return;
        }

        const updates = {
            name: newName,
            bio: newBio,
            photoUrl: newPhotoUrl
        };
        
        try {
            await AppPrincipal.state.db.ref('users/' + AppPrincipal.state.currentUser.uid).update(updates);
            AppPrincipal.closeEditProfileModal();
            AppPrincipal.openProfileModal(); // Reabre o modal de visualização
            alert("Perfil atualizado com sucesso!");
        } catch (error) {
            alert("Erro ao atualizar perfil: " + error.message);
        }
    },
    
    // ===================================================================
    // UTILITÁRIOS
    // ===================================================================
    getUserName: async (uid) => {
        if (AppPrincipal.state.userCache[uid]) {
            return AppPrincipal.state.userCache[uid].name;
        }
        
        try {
            const snapshot = await AppPrincipal.state.db.ref(`users/${uid}/name`).once('value');
            const name = snapshot.val() || 'Usuário Desconhecido';
            // Cache apenas o nome para esta função
            AppPrincipal.state.userCache[uid] = { name: name };
            return name;
        } catch (e) {
            return 'Usuário Desconhecido';
        }
    },
    
    getUserData: async (uid) => {
        if (AppPrincipal.state.userCache[uid] && AppPrincipal.state.userCache[uid].role) {
            return AppPrincipal.state.userCache[uid];
        }
        
        try {
            const snapshot = await AppPrincipal.state.db.ref(`users/${uid}`).once('value');
            const userData = snapshot.val();
            const name = userData ? userData.name : 'Usuário Desconhecido';
            const role = userData ? userData.role : 'atleta';
            
            AppPrincipal.state.userCache[uid] = { name: name, role: role };
            return AppPrincipal.state.userCache[uid];
        } catch (e) {
            return { name: 'Usuário Desconhecido', role: 'atleta' };
        }
    },
    
    clearListeners: (key) => {
        if (key) {
            if (AppPrincipal.state.listeners[key]) {
                AppPrincipal.state.db.ref().off('value', AppPrincipal.state.listeners[key]);
                delete AppPrincipal.state.listeners[key];
            }
        } else {
            // Limpa todos os listeners (durante o loadUserData)
            for (const key in AppPrincipal.state.listeners) {
                 AppPrincipal.state.db.ref().off('value', AppPrincipal.state.listeners[key]);
            }
            AppPrincipal.state.listeners = {};
        }
    },
    
    escapeHTML: (str) => {
        // Função simples para prevenir XSS
        return str.replace(/[&<>"']/g, (m) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m]));
    },
    
    // (V3.5)
    formatPrescricaoToHTML: (prescricao) => {
        let html = '<ul class="prescricao-list">';
        for (const item of prescricao.itens) {
            html += `
                <li class="prescricao-item">
                    <span class="prescricao-name">${AppPrincipal.escapeHTML(item.name)}</span>
                    <span class="prescricao-details">${AppPrincipal.escapeHTML(item.details)}</span>
                </li>
            `;
        }
        html += '</ul>';
        if (prescricao.obs) {
            html += `<p class="prescricao-obs"><strong>Obs:</strong> ${AppPrincipal.escapeHTML(prescricao.obs)}</p>`;
        }
        return html;
    },

    // ===================================================================
    // MÓDULO 4: CLOUDINARY UPLOAD (V3.0)
    // ===================================================================
    openCloudinaryWidget: (e) => {
        e.preventDefault();
        
        if (typeof window.cloudinary === 'undefined' || typeof window.CLOUDINARY_CONFIG === 'undefined') {
            alert("Erro: Widget do Cloudinary ou Configuração ausente.");
            return;
        }

        const widget = window.cloudinary.createUploadWidget(
            {
                cloudName: window.CLOUDINARY_CONFIG.cloudName,
                uploadPreset: window.CLOUDINARY_CONFIG.uploadPreset,
                sources: ['local', 'url', 'camera'],
                folder: 'lerunners_profiles', // Pasta específica
                cropping: true,
                multiple: false
            },
            (error, result) => {
                if (!error && result && result.event === "success") {
                    const newUrl = result.info.secure_url;
                    AppPrincipal.state.modal.newPhotoUrl = newUrl; // Armazena temporariamente
                    AppPrincipal.elements.profilePhotoPreview.src = newUrl; // Preview
                }
            }
        );

        widget.open();
    },

    // ===================================================================
    // MÓDULO 4: IA GEMINI / STRAVA (V2.6)
    // ===================================================================
    
    // 1. Lógica para conectar ao Strava
    handleStravaConnect: () => {
        if (typeof window.STRAVA_PUBLIC_CONFIG === 'undefined') {
            alert("Erro: Configuração do Strava ausente (config.js).");
            return;
        }
        
        const config = window.STRAVA_PUBLIC_CONFIG;
        const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${config.clientID}&response_type=code&redirect_uri=${config.redirectURI}&approval_prompt=force&scope=activity:read_all`;
        
        window.location.href = stravaAuthUrl;
    },
    
    // 2. Lógica para trocar o código pela URL do Vercel (Backend)
    exchangeStravaCode: async (code) => {
        
        if (!AppPrincipal.state.currentUser) {
            // Este caso não deve mais ocorrer com o fix de onAuthStateChanged
            console.error("exchangeStravaCode: Usuário não carregado.");
            alert("Erro: Usuário não autenticado para conectar ao Strava.");
            window.location.href = 'app.html';
            return;
        }

        const user = AppPrincipal.state.currentUser;
        
        try {
            // Obter o token do Firebase para autenticar a requisição no Vercel (Backend)
            const idToken = await user.getIdToken();
            const vercelAPI = window.STRAVA_PUBLIC_CONFIG.vercelAPI;

            const response = await fetch(vercelAPI, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}` // Token de segurança
                },
                body: JSON.stringify({ code: code })
            });

            const result = await response.json();
            
            if (response.ok) {
                alert("Strava conectado com sucesso! Recarregue a página.");
            } else {
                throw new Error(result.error || "Erro desconhecido na API do Vercel.");
            }

        } catch (error) {
            console.error("Erro na troca de código Strava:", error);
            alert("Falha ao conectar Strava: " + error.message);

        } finally {
            // Limpa o código da URL e esconde o loader
            AppPrincipal.elements.loader.classList.add('hidden');
            AppPrincipal.elements.appContainer.classList.remove('hidden');
            window.location.href = 'app.html';
        }
    },
    
    // 3. Lógica para análise com IA
    handleIaAnalysisSubmit: async (e) => {
        e.preventDefault();
        
        const user = AppPrincipal.state.currentUser;
        const workoutId = AppPrincipal.state.modal.currentWorkoutId;
        const ownerId = AppPrincipal.state.modal.currentOwnerId;
        const registro = AppPrincipal.elements.iaAnalysisInput.value.trim();
        
        if (!user || !registro || !workoutId) return;

        AppPrincipal.elements.iaAnalysisLoader.classList.remove('hidden');
        AppPrincipal.elements.iaAnalysisOutput.innerHTML = '<p>Aguarde, a IA Gemini está analisando...</p>';

        try {
            const ownerData = await AppPrincipal.getUserData(ownerId);
            const prescricaoRef = await AppPrincipal.state.db.ref(`workouts/${ownerId}/${workoutId}/prescricao`).once('value');
            const prescricao = prescricaoRef.val() ? JSON.stringify(prescricaoRef.val()) : 'Nenhuma prescrição estruturada encontrada.';
            
            const prompt = `
                Você é um Coach de Corrida, especialista em biomecânica e performance.
                Seu objetivo é analisar o registro de treino do atleta e compará-lo com a prescrição.
                
                Instruções:
                1. Atleta: ${ownerData.name} (Role: ${ownerData.role})
                2. Prescrição: ${prescricao}
                3. Registro de Execução (log do atleta): "${registro}"
                
                Tarefa:
                - Avalie se o registro está de acordo com a prescrição.
                - Identifique pontos fortes e fracos na execução com base no registro.
                - Forneça um feedback CONSTRUTIVO e MOTIVACIONAL, focado em 2-3 pontos-chave de melhoria.
                - Formate a saída usando títulos e parágrafos curtos (HTML básico permitido: <h3>, <p>, <ul>, <li>).
            `;

            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + window.GEMINI_API_KEY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: prompt }] }]
                })
            });

            const result = await response.json();
            const iaText = result.candidates?.[0]?.content?.parts?.[0]?.text || "Erro ao obter resposta da IA.";

            AppPrincipal.elements.iaAnalysisOutput.innerHTML = iaText;
            
        } catch (error) {
            console.error("Erro na análise da IA:", error);
            AppPrincipal.elements.iaAnalysisOutput.innerHTML = '<p class="error">Falha na comunicação com a API Gemini.</p>';
        } finally {
            AppPrincipal.elements.iaAnalysisLoader.classList.add('hidden');
        }
    },
    
    // ===================================================================
    // INJEÇÃO DE GUARDIÕES E LÓGICA DE MODAIS (V3.2.1 - CORREÇÃO STRAVA)
    // ===================================================================

    // Adiciona o botão de conexão Strava no Modal de Perfil
    AppPrincipal.openProfileModalOriginal = AppPrincipal.openProfileModal;
    AppPrincipal.openProfileModal = () => {
        AppPrincipal.openProfileModalOriginal();
        
        const modalBody = AppPrincipal.elements.profileModal.querySelector('.modal-body');
        
        // Verifica se a seção Strava já existe para evitar duplicação
        if (!modalBody.querySelector('#strava-connect-section')) {
            const stravaSection = document.createElement('div');
            stravaSection.id = 'strava-connect-section';
            
            // O botão de edição é injetado aqui para ficar entre as seções
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
            
            // Encontra o botão de sair e insere antes dele, ou no final do body
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


    // Injeta o Guardião de Callback do Strava no initPlatform
    // CORREÇÃO: Adicionamos um checador de estado para esperar o Firebase Auth
    AppPrincipal.initPlatformOriginal = AppPrincipal.initPlatform;
    AppPrincipal.initPlatform = () => {
        // Chama a função original (carrega caches, listeners, etc.)
        AppPrincipal.initPlatformOriginal();

        const urlParams = new URLSearchParams(window.location.search);
        const stravaCode = urlParams.get('code');
        const stravaError = urlParams.get('error');

        // Se houver código do Strava, NÃO chama a troca imediatamente.
        if (stravaCode && !stravaError) {
            
            // 1. Esconde a interface e mostra o loader enquanto esperamos
            AppPrincipal.elements.loader.classList.remove('hidden');
            AppPrincipal.elements.appContainer.classList.add('hidden');
            
            // 2. Cria um listener temporário para esperar o Firebase carregar o usuário
            // Usamos onAuthStateChanged que dispara quando o estado REALMENTE muda/carrega
            const unsubscribe = AppPrincipal.state.auth.onAuthStateChanged(user => {
                if (user) { 
                    // O usuário está FINALMENTE carregado. Agora é seguro chamar a troca de token.
                    // Garantimos que o user carregado é o user logado (para evitar race conditions)
                    if (AppPrincipal.state.currentUser && user.uid === AppPrincipal.state.currentUser.uid) {
                        unsubscribe(); // Para o listener temporário
                        AppPrincipal.exchangeStravaCode(stravaCode);
                    }
                }
            });
            
        } else if (stravaError) {
            alert(`Conexão Strava Falhou: ${stravaError}.`);
            window.location.href = 'app.html'; // Limpa a URL
        }
    };
};

// ===================================================================
// 2. AuthLogic (Lógica da index.html - V2.4)
// ===================================================================
const AuthLogic = {
    state: {
        currentView: 'login', // 'login', 'register', 'pending'
        db: null,
        auth: null
    },
    elements: {
        loginForm: document.getElementById('login-form'),
        registerForm: document.getElementById('register-form'),
        loginErrorMsg: document.getElementById('login-error-msg'),
        registerErrorMsg: document.getElementById('register-error-msg'),
        toggleToRegister: document.getElementById('toggleToRegister'),
        toggleToLogin: document.getElementById('toggleToLogin'),
        loginContainer: document.querySelector('.login-container'),
        pendingView: document.getElementById('pending-view'),
        pendingEmailDisplay: document.getElementById('pending-email-display'),
        
        // Novos elementos para formulário de registro (V3.0)
        registerName: document.getElementById('registerName'),
        registerEmail: document.getElementById('registerEmail'),
        registerPassword: document.getElementById('registerPassword'),
        registerRole: document.getElementById('registerRole'),
        
        btnSubmitLogin: document.getElementById('btn-submit-login'),
        btnSubmitRegister: document.getElementById('btn-submit-register'),
        btnLogoutPending: document.getElementById('btn-logout-pending')
    },

    init: () => {
        // Inicializa o Firebase (se ainda não foi)
        if (firebase.apps.length === 0) {
            firebase.initializeApp(window.firebaseConfig);
        }
        AuthLogic.state.auth = firebase.auth();
        AuthLogic.state.db = firebase.database();
        
        // Registra Event Listeners
        AuthLogic.registerEventListeners();
        
        // Gerencia o estado inicial
        AuthLogic.handleAuthStateChange();
    },

    registerEventListeners: () => {
        if (AuthLogic.elements.loginForm) {
            AuthLogic.elements.loginForm.addEventListener('submit', AuthLogic.handleLogin);
        }
        if (AuthLogic.elements.registerForm) {
            AuthLogic.elements.registerForm.addEventListener('submit', AuthLogic.handleRegister);
        }
        if (AuthLogic.elements.toggleToRegister) {
            AuthLogic.elements.toggleToRegister.addEventListener('click', (e) => {
                e.preventDefault();
                AuthLogic.showView('register');
            });
        }
        if (AuthLogic.elements.toggleToLogin) {
            AuthLogic.elements.toggleToLogin.addEventListener('click', (e) => {
                e.preventDefault();
                AuthLogic.showView('login');
            });
        }
        if (AuthLogic.elements.btnLogoutPending) {
            AuthLogic.elements.btnLogoutPending.addEventListener('click', AuthLogic.handleLogout);
        }
    },

    handleAuthStateChange: () => {
        AuthLogic.state.auth.onAuthStateChanged(user => {
            AuthLogic.handleLoginGuard(user);
        });
    },

    handleLogin: async (e) => {
        e.preventDefault();
        
        AuthLogic.elements.loginErrorMsg.textContent = '';
        AuthLogic.elements.btnSubmitLogin.disabled = true;
        AuthLogic.elements.btnSubmitLogin.textContent = 'Aguarde...';

        const email = AuthLogic.elements.loginForm.querySelector('#loginEmail').value;
        const password = AuthLogic.elements.loginForm.querySelector('#loginPassword').value;

        try {
            await AuthLogic.state.auth.signInWithEmailAndPassword(email, password);
            // Redirecionamento é tratado pelo handleLoginGuard
        } catch (error) {
            let message = "Erro de Login: ";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                message += "Email ou senha incorretos.";
            } else if (error.code === 'auth/too-many-requests') {
                 message += "Muitas tentativas de login. Tente novamente mais tarde.";
            } else {
                message += error.message;
            }
            AuthLogic.elements.loginErrorMsg.textContent = message;
        } finally {
            AuthLogic.elements.btnSubmitLogin.disabled = false;
            AuthLogic.elements.btnSubmitLogin.textContent = 'Entrar';
        }
    },

    handleRegister: async (e) => {
        e.preventDefault();
        
        AuthLogic.elements.registerErrorMsg.textContent = '';
        AuthLogic.elements.btnSubmitRegister.disabled = true;
        AuthLogic.elements.btnSubmitRegister.textContent = 'Aguarde...';

        const name = AuthLogic.elements.registerName.value.trim();
        const email = AuthLogic.elements.registerEmail.value.trim();
        const password = AuthLogic.elements.registerPassword.value.trim();
        const role = AuthLogic.elements.registerRole.value;
        
        if (password.length < 6) {
             AuthLogic.elements.registerErrorMsg.textContent = "A senha deve ter pelo menos 6 caracteres.";
             AuthLogic.elements.btnSubmitRegister.disabled = false;
             AuthLogic.elements.btnSubmitRegister.textContent = 'Solicitar Acesso';
             return;
        }

        try {
            // 1. Cria o usuário no Auth
            const userCredential = await AuthLogic.state.auth.createUserWithEmailAndPassword(email, password);
            const uid = userCredential.user.uid;

            // 2. Cria o registro de aprovação pendente no DB
            await AuthLogic.state.db.ref('pendingApprovals/' + uid).set({
                name: name,
                email: email,
                role: role,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });

            // 3. Cria um registro vazio no /users para evitar erros no guard
            await AuthLogic.state.db.ref('users/' + uid).set({
                name: name,
                email: email,
                role: role, // Default role
                bio: 'Aguardando aprovação do Coach.',
                photoUrl: 'img/default-profile.png'
            });

            // Redirecionamento é tratado pelo handleLoginGuard
        } catch (error) {
            let message = "Erro no Cadastro: ";
            if (error.code === 'auth/email-already-in-use') {
                message += "Este email já está em uso.";
            } else {
                message += error.message;
            }
            AuthLogic.elements.registerErrorMsg.textContent = message;
        } finally {
            AuthLogic.elements.btnSubmitRegister.disabled = false;
            AuthLogic.elements.btnSubmitRegister.textContent = 'Solicitar Acesso';
        }
    },
    
    handleLogout: () => {
        AuthLogic.state.auth.signOut().catch(error => {
            console.error("Erro ao fazer logout:", error);
            alert("Erro ao fazer logout. Tente novamente.");
        });
    },

    showView: (viewName) => {
        AuthLogic.state.currentView = viewName;
        
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.add('hidden');
        AuthLogic.elements.pendingView.classList.add('hidden');
        
        document.querySelector('.toggle-link:nth-child(1)').classList.add('hidden'); // Não tem conta
        document.querySelector('.toggle-link:nth-child(2)').classList.add('hidden'); // Já tem conta

        if (viewName === 'login') {
            document.getElementById('login-form').classList.remove('hidden');
            document.querySelector('.toggle-link:nth-child(1)').classList.remove('hidden');
        } else if (viewName === 'register') {
            document.getElementById('register-form').classList.remove('hidden');
            document.querySelector('.toggle-link:nth-child(2)').classList.remove('hidden');
        } else if (viewName === 'pending') {
            AuthLogic.elements.pendingView.classList.remove('hidden');
        }
    },

    handleLoginGuard: (user) => {
        if (user) {
            const uid = user.uid;
            
            // 1. Verifica se é Admin
            AuthLogic.state.db.ref('admins/' + uid).once('value', adminSnapshot => {
                if (adminSnapshot.exists() && adminSnapshot.val() === true) {
                    window.location.href = 'app.html';
                    return;
                }
                
                // 2. Verifica se o usuário está ativo em /users
                AuthLogic.state.db.ref('users/' + uid).once('value', userSnapshot => {
                    if (userSnapshot.exists()) {
                        // O perfil já existe e foi aprovado ou está pendente
                        
                        // 3. Verifica se o usuário está pendente de aprovação
                        AuthLogic.state.db.ref('pendingApprovals/' + uid).once('value', pendingSnapshot => {
                            if (pendingSnapshot.exists()) {
                                // Usuário pendente
                                AuthLogic.elements.pendingEmailDisplay.textContent = user.email;
                                AuthLogic.showView('pending');
                            } else {
                                // Usuário Aprovado/Ativo
                                window.location.href = 'app.html';
                            }
                        });
                        return; // Sai após a verificação de users/pending
                    }
                    
                    // Se não estiver em /admins e não estiver em /users (conta rejeitada ou excluída)
                    AuthLogic.elements.loginErrorMsg.textContent = "Sua conta foi rejeitada ou excluída. Entre em contato com o Coach.";
                    AuthLogic.state.auth.signOut();
                    AuthLogic.showView('login');
                });
            });
        } else {
            // Não logado, exibe o formulário de login
            AuthLogic.showView('login');
        }
    }
};


// =l= Inicia o Cérebro Principal =l=
// O DOMContentLoaded vai disparar a função init() do AppPrincipal
document.addEventListener('DOMContentLoaded', () => {
    // V3.0: Verifica se está na página app.html ou index.html
    if (document.body.classList.contains('app-page')) {
        AppPrincipal.init();
    } else if (document.body.classList.contains('login-page')) {
        AuthLogic.init();
    }
});

/* =================================================================== */
/* ARQUIVO DE LÓGICA UNIFICADO (V2.9 - CORREÇÃO CACHE DE NOMES)
/* ARQUITETURA: Refatorada (app.js + panels.js)
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
        adminUIDs: {},     // Cache dos UIDs de admins
        userCache: {}, // CORREÇÃO (V2.9): Cache de NOMES vindo de /users
        modal: {
            isOpen: false,
            currentWorkoutId: null,
            currentOwnerId: null
        },
        stravaData: null, // NOVO (V2.6): Armazena dados extraídos da IA Vision
        currentAnalysisData: null // NOVO (V2.6): Armazena a última análise da IA
    },

    init: () => {
        console.log("Iniciando AppPrincipal V2.9 (Cérebro, Correção de Cache)...");
        
        // V2.5: Verifica a chave no 'window'
        if (typeof window.firebaseConfig === 'undefined' || window.firebaseConfig.apiKey.includes("COLE_SUA_CHAVE")) {
            console.error("ERRO CRÍTICO: config.js não carregado ou chaves do Firebase não configuradas.");
            document.body.innerHTML = "<h1>Erro Crítico: O arquivo js/config.js não foi configurado. Cole suas chaves do Firebase.</h1>";
            return;
        }

        try {
            // V2.5: Usa a chave do 'window'
            if (!firebase.apps.length) {
                firebase.initializeApp(window.firebaseConfig);
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
            
            navPlanilhaBtn: document.getElementById('nav-planilha-btn'),
            navFeedBtn: document.getElementById('nav-feed-btn'),
            
            // Modal Feedback (V2.6)
            feedbackModal: document.getElementById('feedback-modal'),
            closeFeedbackModal: document.getElementById('close-feedback-modal'),
            feedbackModalTitle: document.getElementById('feedback-modal-title'),
            feedbackForm: document.getElementById('feedback-form'),
            workoutStatusSelect: document.getElementById('workout-status'),
            workoutFeedbackText: document.getElementById('workout-feedback-text'),
            photoUploadInput: document.getElementById('photo-upload-input'),
            photoUploadFeedback: document.getElementById('photo-upload-feedback'), // V2.6
            stravaDataDisplay: document.getElementById('strava-data-display'), // V2.6
            saveFeedbackBtn: document.getElementById('save-feedback-btn'),
            
            // Comentários V2
            commentForm: document.getElementById('comment-form'),
            commentInput: document.getElementById('comment-input'),
            commentsList: document.getElementById('comments-list'),

            // Modal Log Atividade (V2.3)
            logActivityModal: document.getElementById('log-activity-modal'),
            closeLogActivityModal: document.getElementById('close-log-activity-modal'),
            logActivityForm: document.getElementById('log-activity-form'),

            // Modal Quem Curtiu (V2.3)
            whoLikedModal: document.getElementById('who-liked-modal'),
            closeWhoLikedModal: document.getElementById('close-who-liked-modal'),
            whoLikedList: document.getElementById('who-liked-list'),

            // Modal Análise IA (V2.6)
            iaAnalysisModal: document.getElementById('ia-analysis-modal'),
            closeIaAnalysisModal: document.getElementById('close-ia-analysis-modal'),
            iaAnalysisOutput: document.getElementById('ia-analysis-output'),
            saveIaAnalysisBtn: document.getElementById('save-ia-analysis-btn'), // V2.6
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

        // Listeners Modal IA (V2.6)
        AppPrincipal.elements.closeIaAnalysisModal.addEventListener('click', AppPrincipal.closeIaAnalysisModal);
        AppPrincipal.elements.iaAnalysisModal.addEventListener('click', (e) => {
            if (e.target === AppPrincipal.elements.iaAnalysisModal) AppPrincipal.closeIaAnalysisModal();
        });
        AppPrincipal.elements.saveIaAnalysisBtn.addEventListener('click', AppPrincipal.handleSaveIaAnalysis);


        // O Guardião do app.html
        AppPrincipal.state.auth.onAuthStateChanged(AppPrincipal.handlePlatformAuthStateChange);
    },

    // CORREÇÃO V2.9: Carrega cache de /users (fonte da verdade)
    loadCaches: () => {
        const adminsRef = AppPrincipal.state.db.ref('admins');
        AppPrincipal.state.listeners['cacheAdmins'] = adminsRef;
        adminsRef.on('value', snapshot => {
            AppPrincipal.state.adminUIDs = snapshot.val() || {};
            console.log("Cache de Admins carregado:", Object.keys(AppPrincipal.state.adminUIDs));
        });

        // CORREÇÃO: Lê de /users, não /publicProfiles
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
            AppPrincipal.cleanupListeners(false); // Limpa TUDO ao deslogar
            window.location.href = 'index.html';
            return;
        }

        AppPrincipal.state.currentUser = user;
        const uid = user.uid;
        
        // Carrega caches (agora com listeners corretos)
        AppPrincipal.loadCaches();

        // 1. É Admin?
        AppPrincipal.state.db.ref('admins/' + uid).once('value', adminSnapshot => {
            if (adminSnapshot.exists() && adminSnapshot.val() === true) {
                
                // CORREÇÃO V2.9: Garante que o Admin tenha um perfil em /users
                AppPrincipal.state.db.ref('users/' + uid).once('value', userSnapshot => {
                    let adminName;
                    if (userSnapshot.exists()) {
                        // Admin já tem perfil em /users (Cenário ideal)
                        adminName = userSnapshot.val().name;
                    } else {
                        // *** NOVO (V2.9) FIX ***
                        // Admin foi promovido manualmente e não tem perfil. Criar um.
                        console.warn(`Admin ${user.email} não encontrado em /users. Criando perfil...`);
                        adminName = user.email; // Nome temporário é o email
                        const adminProfile = {
                            name: adminName,
                            email: user.email,
                            role: "admin",
                            createdAt: new Date().toISOString()
                        };
                        // Escreve o perfil (não precisa esperar)
                        AppPrincipal.state.db.ref('users/' + uid).set(adminProfile);
                        // O cache 'cacheUsers' vai atualizar automaticamente
                    }
                    
                    AppPrincipal.state.userData = { name: adminName, role: 'admin', uid: uid };
                    AppPrincipal.elements.userDisplay.textContent = `${adminName} (Coach)`;
                    AppPrincipal.navigateTo('planilha');
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
        AppPrincipal.cleanupListeners(true); // Limpa listeners de painel
        AppPrincipal.state.currentView = page;

        // Atualiza botões de navegação
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
        AppPrincipal.cleanupListeners(false); // Limpa TODOS os listeners
        AppPrincipal.state.auth.signOut().catch(err => console.error("Erro ao sair:", err));
    },

    // CORREÇÃO V2.8: Lógica de limpeza de listeners
    cleanupListeners: (panelOnly = false) => {
        Object.keys(AppPrincipal.state.listeners).forEach(key => {
            const listenerRef = AppPrincipal.state.listeners[key];
            
            if (panelOnly && (key === 'cacheAdmins' || key === 'cacheUsers')) { // V2.9: Protege 'cacheUsers'
                return; 
            }
            
            if (listenerRef && typeof listenerRef.off === 'function') {
                listenerRef.off(); // Desliga o listener
            }
            delete AppPrincipal.state.listeners[key];
        });
        console.log(panelOnly ? "Listeners de painel limpos." : "TODOS os listeners limpos.");
    },
    
    // ===================================================================
    // MÓDULO 3/4: Lógica dos Modais (V2.9 - CORREÇÃO LISTENER E CACHE)
    // ===================================================================
    
    // ----- Modal Feedback (V2.8) -----
    openFeedbackModal: (workoutId, ownerId, workoutTitle) => {
        const { feedbackModal, feedbackModalTitle, workoutStatusSelect, workoutFeedbackText, commentsList, commentInput, photoUploadInput, saveFeedbackBtn, photoUploadFeedback, stravaDataDisplay } = AppPrincipal.elements;
        
        console.log(`Abrindo modal para treino: ${workoutId} (Dono: ${ownerId})`);
        
        // Salva o estado atual no Modal
        AppPrincipal.state.modal.isOpen = true;
        AppPrincipal.state.modal.currentWorkoutId = workoutId;
        AppPrincipal.state.modal.currentOwnerId = ownerId;
        AppPrincipal.state.stravaData = null; // Limpa dados do Strava
        
        feedbackModalTitle.textContent = workoutTitle || "Feedback do Treino";
        
        // Limpa o modal
        workoutStatusSelect.value = 'planejado';
        workoutFeedbackText.value = '';
        photoUploadInput.value = null;
        photoUploadFeedback.textContent = "";
        stravaDataDisplay.classList.add('hidden');
        commentsList.innerHTML = "<p>Carregando...</p>";
        commentInput.value = '';
        saveFeedbackBtn.disabled = false;
        saveFeedbackBtn.textContent = "Salvar Feedback";
        
        // 1. Carrega os dados do treino (status e feedback)
        const workoutRef = AppPrincipal.state.db.ref(`data/${ownerId}/workouts/${workoutId}`);
        workoutRef.once('value', snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                workoutStatusSelect.value = data.status || 'planejado';
                workoutFeedbackText.value = data.feedback || '';
                // NOVO (V2.6): Se já tiver dados do Strava, exibe
                if (data.stravaData) {
                    AppPrincipal.displayStravaData(data.stravaData);
                }
            } else {
                // Tenta buscar nos publicWorkouts se for um treino manual
                AppPrincipal.state.db.ref(`publicWorkouts/${workoutId}`).once('value', publicSnapshot => {
                     if (publicSnapshot.exists()) {
                        const data = publicSnapshot.val();
                        workoutStatusSelect.value = data.status || 'planejado';
                        workoutFeedbackText.value = data.feedback || '';
                        if (data.stravaData) {
                            AppPrincipal.displayStravaData(data.stravaData);
                        }
                     }
                });
            }
        });
        
        // 2. Carrega os Comentários (do nó /workoutComments/)
        const commentsRef = AppPrincipal.state.db.ref(`workoutComments/${workoutId}`);
        
        // CORREÇÃO V2.8: Armazena a REF, não o callback
        AppPrincipal.state.listeners['modalComments'] = commentsRef; 
        
        commentsRef.orderByChild('timestamp').on('value', snapshot => {
            commentsList.innerHTML = "";
            if (!snapshot.exists()) {
                commentsList.innerHTML = "<p>Nenhum comentário ainda.</p>";
                return;
            }
            
            const isCurrentUserAdmin = AppPrincipal.state.userData.role === 'admin';
            const isCurrentUserOwner = AppPrincipal.state.currentUser.uid === AppPrincipal.state.modal.currentOwnerId;

            snapshot.forEach(childSnapshot => {
                const data = childSnapshot.val();
                const isCommentFromAdmin = AppPrincipal.state.adminUIDs.hasOwnProperty(data.uid);

                // REGRA DE PRIVACIDADE:
                if (!isCurrentUserOwner && !isCurrentUserAdmin && isCommentFromAdmin) {
                    return; // Esconde comentários de admins (exceto para o dono ou outro admin)
                }

                const item = document.createElement('div');
                item.className = 'comment-item';
                const date = new Date(data.timestamp).toLocaleString('pt-BR', { timeStyle: 'short', dateStyle: 'short' });
                
                // CORREÇÃO V2.9: Usa o userCache para o nome
                const commenterName = AppPrincipal.state.userCache[data.uid]?.name || "Usuário";
                
                item.innerHTML = `
                    <p><strong>${commenterName}:</strong> ${data.text}</p>
                    <span>${date}</span>
                `;
                commentsList.appendChild(item);
            });
            commentsList.scrollTop = commentsList.scrollHeight; // Rola para o final
        });
        
        feedbackModal.classList.remove('hidden');
    },
    
    // CORREÇÃO V2.8: Limpa o listener corretamente
    closeFeedbackModal: () => {
        AppPrincipal.state.modal.isOpen = false;
        AppPrincipal.elements.feedbackModal.classList.add('hidden');
        
        // Pega a REF armazenada e chama .off() nela
        const listenerRef = AppPrincipal.state.listeners['modalComments'];
        if (listenerRef && typeof listenerRef.off === 'function') {
            listenerRef.off();
            delete AppPrincipal.state.listeners['modalComments'];
            console.log("Listener do modal de comentários limpo.");
        }
    },
    
    // ATUALIZADO (V2.6): Salva "Status", "Feedback", "Foto" e "StravaData"
    handleFeedbackSubmit: async (e) => {
        e.preventDefault();
        const { workoutStatusSelect, workoutFeedbackText, photoUploadInput, saveFeedbackBtn } = AppPrincipal.elements;
        const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        
        if (currentOwnerId !== AppPrincipal.state.currentUser.uid) {
            alert("Você só pode salvar o feedback dos seus próprios treinos.");
            return;
        }

        saveFeedbackBtn.disabled = true;
        saveFeedbackBtn.textContent = "Salvando...";

        try {
            let imageUrl = null;
            const file = photoUploadInput.files[0];
            
            // 1. Faz upload da imagem (se existir)
            if (file) {
                saveFeedbackBtn.textContent = "Enviando foto...";
                // Nota: A IA Vision já foi disparada no 'onChange' da foto.
                // Aqui apenas fazemos o upload para o Cloudinary.
                imageUrl = await AppPrincipal.uploadFileToCloudinary(file);
            }

            // 2. Prepara dados
            const feedbackData = {
                status: workoutStatusSelect.value,
                feedback: workoutFeedbackText.value,
                realizadoAt: new Date().toISOString()
            };
            if (imageUrl) {
                feedbackData.imageUrl = imageUrl;
            }
            // Adiciona dados do Strava se existirem (do state)
            if (AppPrincipal.state.stravaData) {
                feedbackData.stravaData = AppPrincipal.state.stravaData;
            }

            const workoutRef = AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`);
            
            // 3. Atualiza o nó PRIVADO
            saveFeedbackBtn.textContent = "Atualizando treino...";
            await workoutRef.update(feedbackData);
            
            // 4. Atualiza o nó PÚBLICO
            if (feedbackData.status !== 'planejado') {
                const snapshot = await workoutRef.once('value');
                const workoutData = snapshot.val();
                
                const publicData = {
                    ownerId: currentOwnerId,
                    // CORREÇÃO V2.9: Pega o nome do userCache
                    ownerName: AppPrincipal.state.userCache[currentOwnerId]?.name || AppPrincipal.state.userData.name,
                    date: workoutData.date,
                    title: workoutData.title,
                    description: workoutData.description,
                    status: workoutData.status,
                    feedback: workoutData.feedback,
                    realizadoAt: workoutData.realizadoAt,
                    imageUrl: workoutData.imageUrl || null,
                    stravaData: workoutData.stravaData || null // V2.6
                };
                await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).set(publicData);
            } else {
                // Se voltou para "planejado", remove do feed público
                await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).remove();
            }

            console.log("Feedback salvo e feed atualizado!");
            AppPrincipal.closeFeedbackModal();

        } catch (err) {
            console.error("Erro ao salvar feedback:", err);
            alert("Erro ao salvar: " + err.message);
            saveFeedbackBtn.disabled = false;
            saveFeedbackBtn.textContent = "Salvar Feedback";
        }
    },
    
    // ----- Modal Comentários (V2) -----
    handleCommentSubmit: (e) => {
        e.preventDefault();
        const { commentInput } = AppPrincipal.elements;
        const { currentWorkoutId } = AppPrincipal.state.modal;
        const text = commentInput.value.trim();
        
        if (!text) return;

        const commentData = {
            uid: AppPrincipal.state.currentUser.uid,
            // CORREÇÃO V2.9: Pega o nome do userCache (ou do state.userData)
            name: AppPrincipal.state.userCache[AppPrincipal.state.currentUser.uid]?.name || AppPrincipal.state.userData.name,
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        AppPrincipal.state.db.ref(`workoutComments/${currentWorkoutId}`).push(commentData)
            .then(() => {
                commentInput.value = ""; // Limpa o input
            })
            .catch(err => alert("Erro ao enviar comentário: " + err.message));
    },

    // ----- Modal Log Atividade (V2.3) -----
    openLogActivityModal: () => {
        AppPrincipal.elements.logActivityForm.reset();
        AppPrincipal.elements.logActivityModal.classList.remove('hidden');
        // Define a data atual como padrão
        document.getElementById('log-activity-date').value = new Date().toISOString().split('T')[0];
    },

    closeLogActivityModal: () => {
        AppPrincipal.elements.logActivityModal.classList.add('hidden');
    },

    handleLogActivitySubmit: async (e) => {
        e.preventDefault();
        const btn = AppPrincipal.elements.logActivityForm.querySelector('button');
        btn.disabled = true;

        const athleteId = AppPrincipal.state.currentUser.uid;
        
        try {
            const workoutData = {
                date: document.getElementById('log-activity-date').value,
                title: document.getElementById('log-activity-title').value,
                description: `(${document.getElementById('log-activity-type').value})`, // Adiciona tipo na descrição
                feedback: document.getElementById('log-activity-feedback').value,
                createdBy: athleteId, // Atleta que criou
                createdAt: new Date().toISOString(),
                status: "realizado", // Já nasce realizado
                realizadoAt: new Date().toISOString(),
                imageUrl: null,
                stravaData: null
            };
            
            if (!workoutData.date || !workoutData.title || !workoutData.feedback) {
                 throw new Error("Data, Título e Feedback são obrigatórios.");
            }

            // 1. Salva no nó PRIVADO
            const newWorkoutRef = await AppPrincipal.state.db.ref(`data/${athleteId}/workouts`).push(workoutData);
            const newWorkoutId = newWorkoutRef.key;

            // 2. Salva no nó PÚBLICO (para o feed)
            const publicData = {
                ownerId: athleteId,
                // CORREÇÃO V2.9: Pega o nome do userCache
                ownerName: AppPrincipal.state.userCache[athleteId]?.name || AppPrincipal.state.userData.name,
                date: workoutData.date,
                title: workoutData.title,
                description: workoutData.description,
                status: workoutData.status,
                feedback: workoutData.feedback,
                realizadoAt: workoutData.realizadoAt,
                imageUrl: null,
                stravaData: null
            };
            await AppPrincipal.state.db.ref(`publicWorkouts/${newWorkoutId}`).set(publicData);

            console.log("Atividade manual registrada e publicada no feed.");
            AppPrincipal.closeLogActivityModal();

        } catch (err) {
            alert("Erro ao salvar atividade: " + err.message);
        } finally {
            btn.disabled = false;
        }
    },

    // ----- Modal Quem Curtiu (V2.9 - CORRIGIDO) -----
    openWhoLikedModal: (workoutId) => {
        const { whoLikedModal, whoLikedList } = AppPrincipal.elements;
        whoLikedList.innerHTML = "<li>Carregando...</li>";
        whoLikedModal.classList.remove('hidden');

        const likesRef = AppPrincipal.state.db.ref(`workoutLikes/${workoutId}`);
        likesRef.once('value', async (snapshot) => {
            if (!snapshot.exists()) {
                whoLikedList.innerHTML = "<li>Ninguém curtiu ainda.</li>";
                return;
            }

            whoLikedList.innerHTML = ""; // Limpa o "Carregando"
            // CORREÇÃO V2.9: Usa o userCache
            const userCache = AppPrincipal.state.userCache;
            
            const promises = [];
            snapshot.forEach(childSnapshot => {
                const uid = childSnapshot.key;
                
                // CORREÇÃO V2.9: Lê o nome do userCache
                if (userCache[uid] && userCache[uid].name) {
                    promises.push(Promise.resolve(userCache[uid].name));
                } else {
                    // Fallback: Busca o nome em /users (caso o cache ainda não tenha atualizado)
                    const userRef = AppPrincipal.state.db.ref(`users/${uid}/name`);
                    promises.push(userRef.once('value').then(snap => snap.val() || "Usuário (ID: ..."+uid.slice(-4)+")"));
                }
            });

            const names = await Promise.all(promises);
            names.forEach(userName => {
                const li = document.createElement('li');
                li.textContent = userName;
                whoLikedList.appendChild(li);
            });
        });
    },

    closeWhoLikedModal: () => {
        AppPrincipal.elements.whoLikedModal.classList.add('hidden');
    },

    // ----- Modal Análise IA (V2.7 - CORRIGIDO) -----
    openIaAnalysisModal: (analysisData = null) => {
        // CORREÇÃO V2.7: Acessa as variáveis corretas
        const { iaAnalysisModal, iaAnalysisOutput, saveIaAnalysisBtn } = AppPrincipal.elements;
        
        if (analysisData) {
            // Modo "Visualização" (clicou em um histórico)
            iaAnalysisOutput.textContent = analysisData.analysisResult; // Mostra resultado salvo
            AppPrincipal.state.currentAnalysisData = analysisData; // Armazena para debug (mas não salva de novo)
            saveIaAnalysisBtn.classList.add('hidden'); // Esconde o botão salvar
        } else {
            // Modo "Nova Análise" (será preenchido pelo AdminPanel)
            iaAnalysisOutput.textContent = "Coletando dados do atleta...";
            saveIaAnalysisBtn.classList.add('hidden'); // Esconde até a análise terminar
            AppPrincipal.state.currentAnalysisData = null; // Limpa cache
        }
        
        iaAnalysisModal.classList.remove('hidden');
    },

    closeIaAnalysisModal: () => {
        AppPrincipal.elements.iaAnalysisModal.classList.add('hidden');
        AppPrincipal.state.currentAnalysisData = null; // Limpa a análise atual
    },
    
    // NOVO (V2.6): Salva a análise da IA no Firebase (Diretriz 2)
    handleSaveIaAnalysis: async () => {
        const { saveIaAnalysisBtn } = AppPrincipal.elements;
        const analysisData = AppPrincipal.state.currentAnalysisData;
        
        // Pega o atleta selecionado no AdminPanel (que deve estar no state do AdminPanel)
        const athleteId = AdminPanel.state.selectedAthleteId; 

        if (!analysisData || !athleteId) {
            alert("ERRO: Dados da análise ou ID do atleta não encontrados.");
            return;
        }

        saveIaAnalysisBtn.disabled = true;
        saveIaAnalysisBtn.textContent = "Salvando...";

        try {
            const historyRef = AppPrincipal.state.db.ref(`iaAnalysisHistory/${athleteId}`);
            await historyRef.push(analysisData);
            
            alert("Análise salva com sucesso!");
            AppPrincipal.closeIaAnalysisModal();
            
            // Recarrega o histórico de IA (se a aba estiver visível)
            if (AdminPanel.elements.iaHistoryList) {
                AdminPanel.loadIaHistory(athleteId);
            }

        } catch (err) {
            console.error("Erro ao salvar análise:", err);
            alert("Erro ao salvar: " + err.message);
        } finally {
            saveIaAnalysisBtn.disabled = false;
            saveIaAnalysisBtn.textContent = "Salvar Análise";
        }
    },

    // ===================================================================
    // MÓDULO 4: Funções de IA (V2.6 - IA Vision)
    // ===================================================================

    // NOVO (V2.6): Lida com o upload da foto e chama a IA Vision
    handlePhotoUpload: async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const { photoUploadFeedback, stravaDataDisplay, saveFeedbackBtn } = AppPrincipal.elements;
        
        // Limpa o estado anterior
        AppPrincipal.state.stravaData = null;
        stravaDataDisplay.classList.add('hidden');
        photoUploadFeedback.textContent = "Analisando imagem com Gemini Vision...";
        saveFeedbackBtn.disabled = true; // Desabilita salvar ENQUANTO analisa

        try {
            const base64Data = await AppPrincipal.fileToBase64(file);
            const mimeType = file.type;

            const prompt = `
                Analise esta imagem de um app de corrida (como Strava, Nike, etc.).
                Extraia SOMENTE os seguintes dados: Distância (km), Tempo (hh:mm:ss ou mm:ss) e Ritmo/Pace (mm:ss /km).
                
                Responda APENAS com um objeto JSON. Se um dado não for encontrado, retorne 'null'.
                
                Formato de Resposta (JSON):
                {
                  "distancia": "X.XX km",
                  "tempo": "XX:XX:XX",
                  "ritmo": "X:XX /km"
                }
            `;
            
            const jsonResult = await AppPrincipal.callGeminiVisionAPI(prompt, base64Data, mimeType);
            
            // Tenta parsear a resposta
            const data = JSON.parse(jsonResult);
            AppPrincipal.state.stravaData = data; // Salva os dados extraídos no state
            AppPrincipal.displayStravaData(data); // Mostra no modal
            photoUploadFeedback.textContent = "Foto analisada com sucesso!";

        } catch (err) {
            console.error("Erro na IA Vision:", err);
            photoUploadFeedback.textContent = "IA não conseguiu ler dados desta imagem.";
            AppPrincipal.state.stravaData = null; // Garante que esteja nulo se falhar
            stravaDataDisplay.classList.add('hidden');
        } finally {
            saveFeedbackBtn.disabled = false; // Reabilita o botão "Salvar"
        }
    },

    // NOVO (V2.6): Converte arquivo para Base64
    fileToBase64: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]); // Pega só o data
            reader.onerror = error => reject(error);
        });
    },

    // NOVO (V2.6): Exibe os dados extraídos no modal
    displayStravaData: (data) => {
        const { stravaDataDisplay } = AppPrincipal.elements;
        document.getElementById('strava-data-distancia').textContent = `Distância: ${data.distancia || "N/A"}`;
        document.getElementById('strava-data-tempo').textContent = `Tempo:     ${data.tempo || "N/A"}`;
        document.getElementById('strava-data-ritmo').textContent = `Ritmo:     ${data.ritmo || "N/A"}`;
        stravaDataDisplay.classList.remove('hidden');
    },

    // Adaptado do Kumon-IA (agora `callGeminiTextAPI`)
    callGeminiTextAPI: async (prompt) => {
        // V2.5: Lê a chave do 'window' e verifica o placeholder CORRETO
        if (!window.GEMINI_API_KEY || window.GEMINI_API_KEY.includes("COLE_SUA_CHAVE_GEMINI_AQUI")) {
            throw new Error("API Key do Gemini não configurada em js/config.js");
        }
        
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${window.GEMINI_API_KEY}`;
        
        const requestBody = {
            "contents": [{ "parts": [{ "text": prompt }] }]
        };

        const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Erro API Gemini (Texto): ${err.error.message}`);
        }
        
        const data = await response.json();
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error("A IA (Texto) não retornou uma resposta.");
        }
        
        return data.candidates[0].content.parts[0].text;
    },

    // NOVO (V2.6): API Gemini Vision (para Strava)
    callGeminiVisionAPI: async (prompt, base64Data, mimeType) => {
        if (!window.GEMINI_API_KEY || window.GEMINI_API_KEY.includes("COLE_SUA_CHAVE_GEMINI_AQUI")) {
            throw new Error("API Key do Gemini não configurada em js/config.js");
        }

        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${window.GEMINI_API_KEY}`;
        
        const requestBody = {
            "contents": [
                {
                    "parts": [
                        { "text": prompt },
                        {
                            "inlineData": {
                                "mimeType": mimeType,
                                "data": base64Data
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json" // Pede a resposta em JSON
            }
        };

        const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Erro API Gemini (Visão): ${err.error.message}`);
        }

        const data = await response.json();
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error("A IA (Visão) não retornou uma resposta.");
        }

        // Retorna a string JSON (que será parseada)
        return data.candidates[0].content.parts[0].text;
    },
    
    // Adaptado do Kumon-IA (agora `uploadFileToCloudinary`)
    uploadFileToCloudinary: async (file) => {
        // V2.5: Lê a config do 'window'
        if (!window.CLOUDINARY_CONFIG || !window.CLOUDINARY_CONFIG.cloudName || !window.CLOUDINARY_CONFIG.uploadPreset || window.CLOUDINARY_CONFIG.cloudName.includes("SEU_CLOUD_NAME")) {
            throw new Error("Cloudinary não está configurado em js/config.js");
        }
        
        const f = new FormData(); 
        f.append('file', file); 
        f.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset); 
        f.append('folder', `lerunners/${AppPrincipal.state.currentUser.uid}`);
        
        const r = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: f });
        if (!r.ok) throw new Error("Falha no upload para Cloudinary.");
        
        const data = await r.json();
        return data.secure_url; // Retorna a URL segura
    }
};

// ===================================================================
// 2. AuthLogic (Lógica da index.html - MOVIDO PARA CÁ NA V2.4)
// ===================================================================
const AuthLogic = {
    auth: null,
    db: null,
    elements: {},

    init: (auth, db) => {
        console.log("AuthLogic V2.4: Inicializado.");
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


// =l= Inicia o Cérebro Principal =l=
// O DOMContentLoaded vai disparar a função init() do AppPrincipal
document.addEventListener('DOMContentLoaded', AppPrincipal.init);

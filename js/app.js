// js/app.js
// Gerenciador Principal da Plataforma (app.html) - O "Roteador"

// Objeto global da Aplicação
const LeRunnersApp = {
    // Estado global (vazio por enquanto)
    state: {
        currentUser: null,
        userData: null,
        db: null,
        auth: null
    },

    // Ponto de entrada
    init: () => {
        console.log("Iniciando LeRunners App...");
        
        // 1. Verificação de Configuração
        if (typeof firebaseConfig === 'undefined' || firebaseConfig.apiKey.includes("COLE_SUA_CHAVE")) {
            console.error("ERRO CRÍTICO: config.js não carregado ou chaves não preenchidas.");
            alert("Erro de sistema: Configuração não encontrada. Preencha o js/config.js");
            window.location.href = 'index.html'; // Volta para o login
            return;
        }

        // 2. Inicialização do Firebase
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
        } catch (e) {
            console.error('Falha ao inicializar Firebase:', e);
            alert("Erro ao conectar com o sistema.");
            window.location.href = 'index.html';
            return;
        }

        // 3. Referências do Firebase
        LeRunnersApp.state.auth = firebase.auth();
        LeRunnersApp.state.db = firebase.database();

        // 4. Elementos da UI Principal
        LeRunnersApp.elements = {
            loader: document.getElementById('loader'),
            appContainer: document.getElementById('app-container'),
            userDisplay: document.getElementById('userDisplay'),
            logoutButton: document.getElementById('logoutButton'),
            mainContent: document.getElementById('app-main-content')
        };
        
        // 5. Configurar Listener de Logout
        LeRunnersApp.elements.logoutButton.addEventListener('click', LeRunnersApp.handleLogout);

        // 6. O GUARDIÃO (Listener de Autenticação)
        LeRunnersApp.state.auth.onAuthStateChanged(LeRunnersApp.handleAuthStateChange);
    },

    // O Guardião
    handleAuthStateChange: (user) => {
        if (user) {
            // Usuário ESTÁ LOGADO
            console.log("Guardião: Usuário OK", user.uid);
            LeRunnersApp.state.currentUser = user;
            
            // Buscar os dados do perfil dele no Database (Nó /users/)
            LeRunnersApp.state.db.ref('users/' + user.uid).once('value')
                .then((snapshot) => {
                    if (snapshot.exists()) {
                        const userData = snapshot.val();
                        LeRunnersApp.state.userData = userData;
                        
                        // Preenche o Header
                        LeRunnersApp.elements.userDisplay.textContent = `${userData.name} (${userData.role})`;
                        
                        // Decisão de Roteamento
                        LeRunnersApp.routeBasedOnRole(userData.role);

                    } else {
                        // Raro. Usuário no Auth, mas sem perfil no DB.
                        console.warn("Usuário logado mas sem perfil no DB. Deslogando.");
                        LeRunnersApp.handleLogout();
                    }
                })
                .catch((error) => {
                    console.error("Erro ao buscar perfil:", error);
                    alert("Erro ao carregar seus dados.");
                    LeRunnersApp.handleLogout();
                });

        } else {
            // Usuário NÃO ESTÁ LOGADO
            console.log("Guardião: Acesso negado. Redirecionando para login.");
            window.location.href = 'index.html';
        }
    },

    // O Roteador
    routeBasedOnRole: (role) => {
        const { mainContent, loader, appContainer } = LeRunnersApp.elements;
        mainContent.innerHTML = ""; // Limpa o conteúdo principal

        if (role === 'admin') {
            // ROTA ADMIN
            console.log("Roteando para Admin...");
            const adminTemplate = document.getElementById('admin-panel-template').content.cloneNode(true);
            mainContent.appendChild(adminTemplate);
            
            // Inicializa o módulo Admin (definido em admin.js)
            AdminPanel.init(LeRunnersApp.state.currentUser, LeRunnersApp.state.db);
            
        } else {
            // ROTA ATLETA (Padrão)
            console.log("Roteando para Atleta...");
            const atletaTemplate = document.getElementById('atleta-panel-template').content.cloneNode(true);
            mainContent.appendChild(atletaTemplate);
            
            // Preenche o nome no template
            document.getElementById('atleta-welcome-name').textContent = LeRunnersApp.state.userData.name;
            
            // Inicializa o módulo Atleta (definido em atleta.js)
            AtletaPanel.init(LeRunnersApp.state.currentUser, LeRunnersApp.state.db);
        }

        // Esconde o loader e mostra o app
        loader.classList.add('hidden');
        appContainer.classList.remove('hidden');
    },

    // Ação de Logout
    handleLogout: () => {
        console.log("Saindo...");
        LeRunnersApp.state.auth.signOut().catch((error) => {
            console.error("Erro ao sair:", error);
            alert("Erro ao tentar sair da plataforma.");
        });
        // O onAuthStateChanged vai detectar a mudança e redirecionar
    }
};

// Inicia a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', LeRunnersApp.init);

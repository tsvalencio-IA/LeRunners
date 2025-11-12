// js/auth.js
// Gerenciador de Autenticação para a tela de login (index.html)
// VERSÃO 4.0 (CORRIGIDA)

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificação de Configuração
    if (typeof firebaseConfig === 'undefined' || firebaseConfig.apiKey.includes("COLE_SUA_CHAVE")) {
        console.error("ERRO CRÍTICO: config.js não carregado ou chaves não preenchidas.");
        alert("Erro de sistema: Configuração não encontrada. Preencha o js/config.js");
        return;
    }

    // 2. Inicialização do Firebase
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
    } catch (e) {
        console.error('Falha ao inicializar Firebase:', e);
        alert("Erro ao conectar com o sistema. Verifique o config.js");
        return;
    }

    const auth = firebase.auth();
    const db = firebase.database();

    // 3. Referências aos formulários
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    const loginErrorMsg = document.getElementById('login-error');
    const registerErrorMsg = document.getElementById('register-error');

    const toggleToRegister = document.getElementById('toggleToRegister');
    const toggleToLogin = document.getElementById('toggleToLogin');

    if (toggleToRegister) {
        toggleToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            toggleToRegister.parentElement.classList.add('hidden');
            toggleToLogin.parentElement.classList.remove('hidden');
            loginErrorMsg.textContent = "";
            registerErrorMsg.textContent = "";
        });
    }

    if (toggleToLogin) {
        toggleToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            toggleToRegister.parentElement.classList.remove('hidden');
            toggleToLogin.parentElement.classList.add('hidden');
            loginErrorMsg.textContent = "";
            registerErrorMsg.textContent = "";
        });
    }

    // 4. Lógica de Login (Botão Entrar)
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const btn = loginForm.querySelector('button');
            
            btn.disabled = true;
            btn.textContent = "Entrando...";
            loginErrorMsg.textContent = "";

            auth.signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    window.location.href = 'app.html';
                })
                .catch((error) => {
                    console.error("Erro de login:", error.code);
                    btn.disabled = false;
                    btn.textContent = "Entrar";
                    
                    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                        loginErrorMsg.textContent = "Email ou senha incorretos.";
                    } else if (error.code === 'auth/invalid-email') {
                        loginErrorMsg.textContent = "Formato de email inválido.";
                    } else {
                        loginErrorMsg.textContent = "Erro ao tentar entrar.";
                    }
                });
        });
    }

    // 5. Lógica de Registro (Botão Criar Conta) - ESTA É A CORREÇÃO
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const btn = registerForm.querySelector('button'); // Botão correto

            if (password.length < 6) {
                registerErrorMsg.textContent = "A senha deve ter no mínimo 6 caracteres.";
                return;
            }

            btn.disabled = true;
            btn.textContent = "Criando...";
            registerErrorMsg.textContent = "";

            // Variável para guardar o UID
            let createdUserUid = null; 

            auth.createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    // Usuário criado no Authentication
                    const user = userCredential.user;
                    createdUserUid = user.uid; // Guarda o UID
                    console.log("Usuário criado no Auth:", user.uid);

                    const userProfile = {
                        name: name,
                        email: email,
                        role: "atleta", // CRÍTICO: Todo novo usuário é 'atleta'
                        createdAt: new Date().toISOString()
                    };

                    // CORREÇÃO 1: (Removido o 'ka')
                    // Passo 1: Criar o perfil
                    return db.ref('users/' + user.uid).set(userProfile);
                })
                .then(() => {
                    // Usuário salvo no Database!
                    console.log("Perfil do usuário salvo no DB.");
                    
                    // CORREÇÃO 2: (Usa 'createdUserUid' ao invés de 'auth.currentUser')
                    // Passo 2: Criar os dados (USANDO A VARIÁVEL GUARDADA)
                    return db.ref('data/' + createdUserUid).set({
                        workouts: {} // Inicializa o nó de treinos
                    });
                })
                .then(() => {
                    // SÓ REDIRECIONA DEPOIS QUE TUDO DEU CERTO
                    console.log("Nó de dados privado criado. Redirecionando...");
                    window.location.href = 'app.html';
                })
                .catch((error) => {
                    // O BOTÃO AGORA SERÁ RE-HABILITADO EM CASO DE ERRO
                    console.error("Erro de registro:", error.code, error.message);
                    btn.disabled = false;
                    btn.textContent = "Criar Conta";
                    
                    if (error.code === 'auth/email-already-in-use') {
                        registerErrorMsg.textContent = "Este email já está cadastrado.";
                    } else if (error.code === 'auth/invalid-email') {
                        registerErrorMsg.textContent = "Formato de email inválido.";
                    } else if (error.code === 'auth/weak-password') {
                        registerErrorMsg.textContent = "Senha muito fraca.";
                    } else {
                        registerErrorMsg.textContent = "Erro ao criar conta. Verifique o console (F12).";
                    }
                });
        });
    }

    // 6. Verifica se o usuário JÁ está logado
    auth.onAuthStateChanged((user) => {
        if (user) {
            // Se o usuário está logado e na tela de login, manda para o app
            if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/LeRunners/')) {
                 window.location.href = 'app.html';
            }
        }
    });

});

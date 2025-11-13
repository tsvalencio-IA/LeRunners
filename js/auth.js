// js/auth.js
// Gerenciador de Autenticação para a tela de login (index.html)
// ARQUITETURA "corri_rp" com fluxo de aprovação pendente

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

// 3. Referências aos Elementos DOM
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const pendingView = document.getElementById('pending-view');
const pendingEmailDisplay = document.getElementById('pending-email-display');
const btnLogoutPending = document.getElementById('btn-logout-pending');

const loginErrorMsg = document.getElementById('login-error');
const registerErrorMsg = document.getElementById('register-error');

const toggleToRegister = document.getElementById('toggleToRegister');
const toggleToLogin = document.getElementById('toggleToLogin');

// Funções de UI
const showView = (view) => {
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
};

// Listeners de Alternância
toggleToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    showView('register');
    loginErrorMsg.textContent = "";
    registerErrorMsg.textContent = "";
});

toggleToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    showView('login');
    loginErrorMsg.textContent = "";
    registerErrorMsg.textContent = "";
});

// Listener de Logout (Tela Pendente)
btnLogoutPending.addEventListener('click', () => auth.signOut());

// 4. Lógica de Login (Botão Entrar)
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const btn = loginForm.querySelector('button');
    
    btn.disabled = true;
    btn.textContent = "Verificando...";
    loginErrorMsg.textContent = "";

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Usuário logou. O Guardião (onAuthStateChanged)
            // vai verificar o status (admin, user, pending)
            // e redirecionar ou mostrar a tela de pendente.
        })
        .catch((error) => {
            console.error("Erro de login:", error.code);
            btn.disabled = false;
            btn.textContent = "Entrar";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                loginErrorMsg.textContent = "Email ou senha incorretos.";
            } else {
                loginErrorMsg.textContent = "Erro ao tentar entrar.";
            }
        });
});

// 5. Lógica de Registro (Solicitar Acesso)
registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const btn = registerForm.querySelector('button');

    if (password.length < 6) {
        registerErrorMsg.textContent = "A senha deve ter no mínimo 6 caracteres.";
        return;
    }
    if (!name) {
        registerErrorMsg.textContent = "O nome é obrigatório.";
        return;
    }

    btn.disabled = true;
    btn.textContent = "Enviando...";
    registerErrorMsg.textContent = "";

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            console.log("Usuário criado no Auth:", user.uid);

            // CRIA A SOLICITAÇÃO EM "pendingApprovals" (Arquitetura corri_rp)
            const pendingData = {
                name: name,
                email: email,
                requestDate: new Date().toISOString()
            };
            
            return db.ref('pendingApprovals/' + user.uid).set(pendingData);
        })
        .then(() => {
            // Sucesso. O onAuthStateChanged vai pegar esse
            // novo usuário e mostrar a tela "pendingView".
            console.log("Solicitação de acesso enviada.");
            // Não precisamos redirecionar, o guardião cuida disso.
        })
        .catch((error) => {
            console.error("Erro de registro:", error.code);
            btn.disabled = false;
            btn.textContent = "Solicitar Acesso";
            
            if (error.code === 'auth/email-already-in-use') {
                registerErrorMsg.textContent = "Este email já está cadastrado.";
                // Se já estiver cadastrado, pode estar pendente ou aprovado
                loginErrorMsg.textContent = "Email já cadastrado. Tente fazer login.";
                showView('login');
            } else {
                registerErrorMsg.textContent = "Erro ao criar sua conta.";
            }
        });
});

// 6. O GUARDIÃO (Verifica o status do usuário logado)
// Este é o "cérebro" da tela de login.
auth.onAuthStateChanged((user) => {
    if (user) {
        // Usuário está logADO. Precisamos saber quem ele é.
        const uid = user.uid;

        // 1. Ele é Admin?
        db.ref('admins/' + uid).once('value', adminSnapshot => {
            if (adminSnapshot.exists() && adminSnapshot.val() === true) {
                console.log("Status: ADMIN. Redirecionando para plataforma...");
                window.location.href = 'app.html';
                return;
            }

            // 2. Ele é um Atleta Aprovado?
            db.ref('users/' + uid).once('value', userSnapshot => {
                if (userSnapshot.exists()) {
                    console.log("Status: ATLETA APROVADO. Redirecionando...");
                    window.location.href = 'app.html';
                    return;
                }

                // 3. Se não é Admin nem Atleta, ele está Pendente?
                db.ref('pendingApprovals/' + uid).once('value', pendingSnapshot => {
                    if (pendingSnapshot.exists()) {
                        console.log("Status: PENDENTE. Mostrando tela de espera.");
                        pendingEmailDisplay.textContent = user.email;
                        showView('pending');
                    } else {
                        // 4. Status Desconhecido (Ex: Rejeitado e excluído)
                        console.warn("Status: REJEITADO/ÓRFÃO. Usuário existe no Auth mas em nenhum nó.");
                        loginErrorMsg.textContent = "Sua conta foi rejeitada ou excluída.";
                        auth.signOut(); // Força o logout
                        showView('login');
                    }
                });
            });
        });

    } else {
        // Usuário está deslogADO.
        console.log("Status: Deslogado. Mostrando tela de login.");
        showView('login');
    }
});


});

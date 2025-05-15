// Configuração da API
const API_BASE_URL = 'http://localhost:3000/api';

// Elementos globais
let currentUser = null;
let currentContact = null;
let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();

    // Verificar se estamos na página de chat e carregar o contato da URL
    if (window.location.pathname.endsWith('chat.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const contactId = urlParams.get('contact');
        
        if (contactId) {
            loadContactAndMessages(parseInt(contactId));
        }
    }
    
    // Configurar tabs de login/registro
    if (document.getElementById('loginTab')) {
        setupAuthTabs();
    }
    
    // Configurar logout
    if (document.getElementById('logoutBtn')) {
        document.getElementById('logoutBtn').addEventListener('click', logout);
    }
    
    // Carregar contatos se estiver na página certa
    if (document.getElementById('contactsList')) {
        loadContacts();
    }
    
    // Configurar envio de mensagens
    if (document.getElementById('messageForm')) {
        document.getElementById('messageForm').addEventListener('submit', sendMessage);
    }
});

// Nova função para carregar contato e mensagens
async function loadContactAndMessages(contactId) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/${contactId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('chatToken')}`
            }
        });
        
        if (response.ok) {
            const contact = await response.json();
            await openChat(contact);
        } else {
            console.error('Contato não encontrado');
            window.location.href = 'contacts.html';
        }
    } catch (error) {
        console.error('Erro ao carregar contato:', error);
        window.location.href = 'contacts.html';
    }
}

// Funções de Autenticação
async function checkAuth() {
    const token = localStorage.getItem('chatToken');
    if (!token && !window.location.pathname.endsWith('index.html')) {
        window.location.href = 'index.html';
        return;
    }
    
    if (token) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                currentUser = await response.json();
                updateUserInfo();
                
                // Removido o código que iniciava o WebSocket automaticamente
                
                if (window.location.pathname.endsWith('index.html')) {
                    window.location.href = 'contacts.html';
                }
            } else {
                localStorage.removeItem('chatToken');
                if (!window.location.pathname.endsWith('index.html')) {
                    window.location.href = 'index.html';
                }
            }
        } catch (error) {
            console.error('Erro ao verificar autenticação:', error);
        }
    }
}

function setupAuthTabs() {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    loginTab.addEventListener('click', () => {
        loginTab.classList.add('text-indigo-600', 'border-indigo-600');
        loginTab.classList.remove('text-gray-500');
        registerTab.classList.add('text-gray-500');
        registerTab.classList.remove('text-indigo-600', 'border-indigo-600');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    });
    
    registerTab.addEventListener('click', () => {
        registerTab.classList.add('text-indigo-600', 'border-indigo-600');
        registerTab.classList.remove('text-gray-500');
        loginTab.classList.add('text-gray-500');
        loginTab.classList.remove('text-indigo-600', 'border-indigo-600');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    });
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('chatToken', data.token);
                currentUser = data.user;
                window.location.href = 'contacts.html';
            } else {
                const errorData = await response.json();
                alert(errorData.error || 'Login falhou');
            }
        } catch (error) {
            console.error('Erro ao fazer login:', error);
            alert('Erro ao conectar ao servidor.');
        }
    });
    
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        
        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });
            
            if (response.ok) {
                const data = await response.json();
                alert('Registro realizado com sucesso! Faça login.');
                document.getElementById('loginTab').click();
            } else {
                const errorData = await response.json();
                alert(errorData.error || 'Registro falhou');
            }
        } catch (error) {
            console.error('Erro ao registrar:', error);
            alert('Erro ao conectar ao servidor.');
        }
    });
}

function logout() {
    localStorage.removeItem('chatToken');
    if (socket) {
        socket.close();
        socket = null;
    }
    window.location.href = 'index.html';
}

// Funções de Usuário
function updateUserInfo() {
    if (currentUser && document.getElementById('usernameDisplay')) {
        document.getElementById('usernameDisplay').textContent = currentUser.username;
        document.getElementById('userInitial').textContent = currentUser.username.charAt(0).toUpperCase();
    }
}

// Funções de Contatos
async function loadContacts() {
    try {
        const response = await fetch(`${API_BASE_URL}/users/all`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('chatToken')}`
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            renderContacts(users.filter(user => user.id !== currentUser.id));
        } else {
            console.error('Erro ao carregar contatos');
        }
    } catch (error) {
        console.error('Erro ao carregar contatos:', error);
    }
}

function renderContacts(contacts) {
    const contactsList = document.getElementById('contactsList');
    contactsList.innerHTML = '';
    
    contacts.forEach(contact => {
        const contactElement = document.createElement('div');
        contactElement.className = 'p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex items-center space-x-3';
        contactElement.innerHTML = `
            <div class="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">${contact.username.charAt(0).toUpperCase()}</div>
            <div>
                <p class="font-medium">${contact.username}</p>
                <p class="text-xs text-gray-500">${contact.email}</p>
            </div>
        `;
        
        contactElement.addEventListener('click', async () => {
            try {
                // Mostrar loading
                contactElement.innerHTML = `
                    <div class="flex items-center space-x-3">
                        <div class="h-10 w-10 rounded-full bg-gray-200 animate-pulse"></div>
                        <div class="flex-1">
                            <div class="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                        </div>
                    </div>
                `;
                
                await openChat(contact);
            } catch (error) {
                console.error('Erro ao abrir chat:', error);
                // Restaurar contato
                renderContacts([contact]);
            }
        });
        
        contactsList.appendChild(contactElement);
    });
}

// Função para lidar com a navegação entre páginas
function handlePageNavigation() {
    if (!window.location.pathname.endsWith('chat.html')) {
        // Se sair da página de chat, limpar a conexão
        cleanupWebSocket();
    }
}

// Limpeza de conexão WebSocket
function cleanupWebSocket() {
    if (socket) {
        console.log('Fechando WebSocket ao sair...');
        socket.close(1000, 'Navegação do usuário');
        socket = null;
    }
    currentContact = null;
    reconnectAttempts = 0;
}

// Adicionar listeners para navegação
window.addEventListener('popstate', handlePageNavigation);
window.addEventListener('beforeunload', cleanupWebSocket);

async function openChat(contact) {
    if (!contact) {
        console.error('Contato não definido');
        return;
    }

    currentContact = contact;
    
    // Atualizar URL antes de carregar as mensagens
    window.history.pushState(null, '', `chat.html?contact=${contact.id}`);
    
    // Verificar se já estamos na página de chat
    if (!window.location.pathname.endsWith('chat.html')) {
        window.location.href = `chat.html?contact=${contact.id}`;
        return;
    }

    // Atualizar informações do contato
    const contactNameElement = document.getElementById('contactName');
    const contactInitialElement = document.getElementById('contactInitial');
    
    if (contactNameElement) contactNameElement.textContent = contact.username;
    if (contactInitialElement) contactInitialElement.textContent = contact.username.charAt(0).toUpperCase();
    
    // Mostrar indicador de carregamento
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
        messagesContainer.innerHTML = `
            <div class="flex justify-center items-center h-full">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <p class="ml-3 text-gray-600">Conectando ao chat...</p>
            </div>
        `;
    }
    
    // Conectar o WebSocket de forma robusta
    try {
        // Verificar se já temos uma conexão válida
        if (socket && socket.readyState === WebSocket.OPEN) {
            console.log('Usando conexão WebSocket existente');
        } else {
            // Estabelecer nova conexão
            await connectWebSocket();
        }
        
        // Carregar mensagens após conexão estabelecida
        loadMessages();
    } catch (error) {
        console.error('Erro ao inicializar chat:', error);
        
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-red-500">
                    <i class="fas fa-exclamation-triangle text-4xl mb-3"></i>
                    <p>Não foi possível conectar ao servidor. Tente novamente.</p>
                    <button id="retryConnection" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                        Tentar Novamente
                    </button>
                </div>
            `;
            
            // Adicionar botão para tentar novamente
            document.getElementById('retryConnection')?.addEventListener('click', () => {
                openChat(contact);
            });
        }
    }
}

// Funções de Mensagens
async function loadMessages() {
    if (!currentUser || !currentContact) return;
    
    try {
        // Garantir que o messagesContainer existe
        let messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) {
            console.log('Elemento messagesContainer não encontrado, aguardando DOM...');
            // Aguardar um curto período e tentar novamente
            return setTimeout(loadMessages, 100);
        }
        
        // Mostrar loading
        messagesContainer.innerHTML = `
            <div class="flex justify-center items-center h-full">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
        `;
        
        const response = await fetch(`${API_BASE_URL}/messages/${currentUser.id}/${currentContact.id}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('chatToken')}`
            }
        });
        
        if (response.ok) {
            const messages = await response.json();
            renderMessages(messages);
        } else {
            console.error('Erro ao carregar mensagens');
            throw new Error('Erro ao carregar mensagens');
        }
    } catch (error) {
        console.error('Erro ao carregar mensagens:', error);
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="text-center text-red-500 p-4">
                    Erro ao carregar mensagens. Tente novamente.
                </div>
            `;
        }
    }
}

// Função renderMessages melhorada
function renderMessages(messages) {
    // Verificar se estamos na página de chat
    if (!window.location.pathname.endsWith('chat.html')) {
        console.log('Redirecionando para a página de chat...');
        window.location.href = `chat.html?contact=${currentContact.id}`;
        return;
    }

    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) {
        console.warn('Elemento messagesContainer não encontrado - aguardando DOM carregar');
        // Limitar recursão para evitar stack overflow
        return;
    }

    messagesContainer.innerHTML = '';
    
    messages.forEach(message => {
        const isSender = message.senderId === currentUser.id;
        const messageElement = document.createElement('div');
        messageElement.className = `flex ${isSender ? 'justify-end' : 'justify-start'} mb-4`;
        
        messageElement.innerHTML = `
            <div class="${isSender ? 'bg-indigo-500 text-white' : 'bg-white'} rounded-lg py-2 px-4 max-w-xs lg:max-w-md">
                <p>${message.content}</p>
                <p class="text-xs ${isSender ? 'text-indigo-100' : 'text-gray-500'} mt-1">
                    ${new Date(message.createdAt).toLocaleTimeString()}
                </p>
            </div>
        `;
        
        messagesContainer.appendChild(messageElement);
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function connectWebSocket() {
    return new Promise((resolve, reject) => {
        if (!currentUser) {
            console.error('Usuário não definido');
            reject(new Error('Usuário não definido'));
            return;
        }

        // Se já existe uma conexão tentando se estabelecer ou já estabelecida, não cria uma nova
        if (socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(socket.readyState)) {
            console.log('WebSocket já conectado ou conectando');
            resolve(socket);
            return;
        }

        // Fechar qualquer conexão existente antes de criar uma nova
        if (socket) {
            socket.close();
            socket = null;
        }

        // Inclua o token JWT no protocolo WebSocket
        const token = localStorage.getItem('chatToken');
        if (!token) {
            console.error('Token não encontrado');
            reject(new Error('Token não encontrado'));
            return;
        }

        try {
            // Usar o protocolo correto (ws/wss) com base no protocolo atual da página (http/https)
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.hostname;
            const port = '3000'; // Use sua porta correta aqui
            
            // Criando a conexão WebSocket
            console.log('Tentando estabelecer conexão WebSocket...');
            socket = new WebSocket(`${protocol}//${host}:${port}/api/messages/ws`, ['chat', token]);

            // Timeout para evitar conexões pendentes por muito tempo
            const connectionTimeout = setTimeout(() => {
                if (socket && socket.readyState !== WebSocket.OPEN) {
                    console.error('Timeout ao conectar WebSocket');
                    socket.close();
                    reject(new Error('Timeout na conexão WebSocket'));
                }
            }, 10000); // 10 segundos

            socket.onopen = () => {
                console.log('WebSocket conectado com sucesso');
                clearTimeout(connectionTimeout);
                reconnectAttempts = 0; // Resetar contagem de tentativas
                
                // Envie uma mensagem de inicialização logo após a conexão
                try {
                    socket.send(JSON.stringify({
                        type: 'init',
                        userId: currentUser.id
                    }));
                    console.log('Mensagem de inicialização enviada');
                } catch (e) {
                    console.error('Erro ao enviar mensagem de inicialização:', e);
                }
                
                resolve(socket);
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('Mensagem recebida do servidor:', data.type);
                    
                    if (data.type === 'message') {
                        addMessageToChat(data.message);
                    } else if (data.type === 'error') {
                        console.error('Erro recebido do servidor:', data.error);
                    } else if (data.type === 'auth_success' || data.type === 'init_ack') {
                        console.log('Conexão WebSocket autenticada e inicializada com sucesso');
                    } else if (data.type === 'ping') {
                        // Responder aos pings do servidor
                        socket.send(JSON.stringify({
                            type: 'pong',
                            timestamp: new Date().toISOString()
                        }));
                    }
                } catch (error) {
                    console.error('Erro ao processar mensagem WebSocket:', error);
                }
            };

            socket.onclose = (event) => {
                clearTimeout(connectionTimeout);
                
                console.log(`WebSocket desconectado (código ${event.code}, razão: ${event.reason || 'Não especificada'}).`);
                
                if (event.code === 1008) { // Código para erro de autenticação
                    console.error('Falha na autenticação WebSocket:', event.reason);
                    alert('Sessão expirada. Por favor, faça login novamente.');
                    logout();
                    reject(new Error('Falha na autenticação WebSocket'));
                    return;
                }
                
                // Só tenta reconectar automaticamente se estiver em um chat ativo
                if (currentContact && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
                    console.log(`Tentando reconectar em ${timeout/1000}s... (tentativa ${reconnectAttempts})`);
                    
                    setTimeout(() => {
                        connectWebSocket().catch(err => console.error('Falha na reconexão:', err));
                    }, timeout);
                } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                    console.error('Número máximo de tentativas de reconexão atingido');
                    
                    // Limpar estado de reconexão quando máximo atingido
                    socket = null;
                    reconnectAttempts = 0;
                    
                    // Notificar o usuário apenas quando estiver em um chat ativo
                    if (currentContact && document.getElementById('messagesContainer')) {
                        alert('Não foi possível estabelecer conexão com o servidor. Por favor, recarregue a página.');
                    }
                    
                    reject(new Error('Falha na reconexão do WebSocket'));
                } else {
                    // Simplesmente limpa o socket se não estiver em chat e não precisar reconectar
                    socket = null;
                }
            };

            socket.onerror = (error) => {
                console.error('Erro no WebSocket:', error);
                // Não fechar aqui - deixe o evento onclose lidar com isso
            };
        } catch (error) {
            console.error('Erro ao criar conexão WebSocket:', error);
            reject(error);
        }
    });
}

function sendMessage(e) {
    e.preventDefault();
    
    if (!currentUser || !currentContact) {
        alert('Por favor, selecione um contato primeiro');
        return;
    }

    const messageInput = document.getElementById('messageInput');
    const content = messageInput.value.trim();
    
    if (!content) return;
    
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        alert('Conexão não está pronta. Tentando reconectar...');
        connectWebSocket().then(() => {
            // Tentar enviar novamente após reconectar
            setTimeout(() => sendMessage(e), 500);
        }).catch(error => {
            console.error('Falha ao reconectar para enviar mensagem:', error);
            alert('Não foi possível estabelecer conexão. Tente novamente mais tarde.');
        });
        return;
    }
    
    const message = {
        senderId: currentUser.id,
        receiverId: currentContact.id,
        content
    };
    
    try {
        socket.send(JSON.stringify(message));
        messageInput.value = '';
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        alert('Erro ao enviar mensagem. Tente novamente.');
    }
}

function addMessageToChat(message) {
    if ((message.senderId === currentUser.id && message.receiverId === currentContact.id) || 
        (message.senderId === currentContact.id && message.receiverId === currentUser.id)) {
        
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) {
            console.error('Container de mensagens não encontrado ao adicionar nova mensagem');
            return;
        }
        
        const isSender = message.senderId === currentUser.id;
        
        const messageElement = document.createElement('div');
        messageElement.className = `flex ${isSender ? 'justify-end' : 'justify-start'} mb-4`;
        
        messageElement.innerHTML = `
            <div class="${isSender ? 'bg-indigo-500 text-white' : 'bg-white'} rounded-lg py-2 px-4 max-w-xs lg:max-w-md">
                <p>${message.content}</p>
                <p class="text-xs ${isSender ? 'text-indigo-100' : 'text-gray-500'} mt-1">Agora</p>
            </div>
        `;
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}
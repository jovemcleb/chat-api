// Configuração da API
const API_BASE_URL = "http://localhost:3000/api";

// Elementos globais
let currentUser = null;
let currentContact = null;
let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let socketConnecting = false; // Controle para evitar conexões simultâneas

// DOM Content Loaded
document.addEventListener("DOMContentLoaded", function () {
  checkAuth();

  // Verificar se estamos na página de chat e carregar o contato da URL
  if (window.location.pathname.endsWith("chat.html")) {
    const urlParams = new URLSearchParams(window.location.search);
    const contactId = urlParams.get("contact");

    if (contactId) {
      loadContactAndMessages(parseInt(contactId));
    }
  }

  // Configurar tabs de login/registro
  if (document.getElementById("loginTab")) {
    setupAuthTabs();
  }

  // Configurar logout
  if (document.getElementById("logoutBtn")) {
    document.getElementById("logoutBtn").addEventListener("click", logout);
  }

  // Carregar contatos se estiver na página certa
  if (document.getElementById("contactsList")) {
    loadContacts();
  }

  // Configurar envio de mensagens
  if (document.getElementById("messageForm")) {
    document
      .getElementById("messageForm")
      .addEventListener("submit", sendMessage);
  }
});

// Nova função para carregar contato e mensagens
async function loadContactAndMessages(contactId) {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${contactId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("chatToken")}`,
      },
    });

    if (response.ok) {
      const contact = await response.json();
      await openChat(contact);
    } else {
      console.error("Contato não encontrado");
      window.location.href = "contacts.html";
    }
  } catch (error) {
    console.error("Erro ao carregar contato:", error);
    window.location.href = "contacts.html";
  }
}

// Funções de Autenticação
async function checkAuth() {
  const token = localStorage.getItem("chatToken");
  if (!token && !window.location.pathname.endsWith("index.html")) {
    window.location.href = "index.html";
    return;
  }

  if (token) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        currentUser = await response.json();
        updateUserInfo();

        // Se estiver na página de chat, inicializar WebSocket
        if (window.location.pathname.endsWith("chat.html")) {
          const urlParams = new URLSearchParams(window.location.search);
          const contactId = urlParams.get("contact");

          if (contactId) {
            // Inicializar websocket se estiver na página de chat
            connectWebSocket().catch((err) =>
              console.error("Erro ao conectar WebSocket:", err)
            );
          }
        }

        if (window.location.pathname.endsWith("index.html")) {
          window.location.href = "contacts.html";
        }
      } else {
        localStorage.removeItem("chatToken");
        if (!window.location.pathname.endsWith("index.html")) {
          window.location.href = "index.html";
        }
      }
    } catch (error) {
      console.error("Erro ao verificar autenticação:", error);
    }
  }
}

function setupAuthTabs() {
  const loginTab = document.getElementById("loginTab");
  const registerTab = document.getElementById("registerTab");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  loginTab.addEventListener("click", () => {
    loginTab.classList.add("text-indigo-600", "border-indigo-600");
    loginTab.classList.remove("text-gray-500");
    registerTab.classList.add("text-gray-500");
    registerTab.classList.remove("text-indigo-600", "border-indigo-600");
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
  });

  registerTab.addEventListener("click", () => {
    registerTab.classList.add("text-indigo-600", "border-indigo-600");
    registerTab.classList.remove("text-gray-500");
    loginTab.classList.add("text-gray-500");
    loginTab.classList.remove("text-indigo-600", "border-indigo-600");
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("chatToken", data.token);
        currentUser = data.user;
        window.location.href = "contacts.html";
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Login falhou");
      }
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      alert("Erro ao conectar ao servidor.");
    }
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("registerUsername").value;
    const email = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        alert("Registro realizado com sucesso! Faça login.");
        document.getElementById("loginTab").click();
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Registro falhou");
      }
    } catch (error) {
      console.error("Erro ao registrar:", error);
      alert("Erro ao conectar ao servidor.");
    }
  });
}

function logout() {
  localStorage.removeItem("chatToken");
  if (socket) {
    socket.close();
    socket = null;
  }
  window.location.href = "index.html";
}

// Funções de Usuário
function updateUserInfo() {
  if (currentUser && document.getElementById("usernameDisplay")) {
    document.getElementById("usernameDisplay").textContent =
      currentUser.username;
    document.getElementById("userInitial").textContent = currentUser.username
      .charAt(0)
      .toUpperCase();
  }
}

// Funções de Contatos
async function loadContacts() {
  try {
    const response = await fetch(`${API_BASE_URL}/users/all`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("chatToken")}`,
      },
    });

    if (response.ok) {
      const users = await response.json();
      renderContacts(users.filter((user) => user.id !== currentUser.id));
    } else {
      console.error("Erro ao carregar contatos");
    }
  } catch (error) {
    console.error("Erro ao carregar contatos:", error);
  }
}

function renderContacts(contacts) {
  const contactsList = document.getElementById("contactsList");
  contactsList.innerHTML = "";

  contacts.forEach((contact) => {
    const contactElement = document.createElement("div");
    contactElement.className =
      "p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex items-center space-x-3";
    contactElement.innerHTML = `
            <div class="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">${contact.username
              .charAt(0)
              .toUpperCase()}</div>
            <div>
                <p class="font-medium">${contact.username}</p>
                <p class="text-xs text-gray-500">${contact.email}</p>
            </div>
        `;

    contactElement.addEventListener("click", async () => {
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
        console.error("Erro ao abrir chat:", error);
        // Restaurar contato
        renderContacts([contact]);
      }
    });

    contactsList.appendChild(contactElement);
  });
}

// Função para lidar com a navegação entre páginas
function handlePageNavigation() {
  if (!window.location.pathname.endsWith("chat.html")) {
    // Se sair da página de chat, limpar a conexão
    cleanupWebSocket();
  }
}

// Limpeza de conexão WebSocket
function cleanupWebSocket() {
  if (socket) {
    console.log("Fechando WebSocket ao sair...");
    socket.close(1000, "Navegação do usuário");
    socket = null;
  }
  currentContact = null;
  reconnectAttempts = 0;
  socketConnecting = false;
}

// Adicionar listeners para navegação
window.addEventListener("popstate", handlePageNavigation);
window.addEventListener("beforeunload", cleanupWebSocket);

async function openChat(contact) {
  if (!contact) {
    console.error("Contato não definido");
    return;
  }

  currentContact = contact;

  // Atualizar URL antes de carregar as mensagens
  window.history.pushState(null, "", `chat.html?contact=${contact.id}`);

  // Verificar se já estamos na página de chat
  if (!window.location.pathname.endsWith("chat.html")) {
    window.location.href = `chat.html?contact=${contact.id}`;
    return;
  }

  // Atualizar informações do contato
  const contactNameElement = document.getElementById("contactName");
  const contactInitialElement = document.getElementById("contactInitial");

  if (contactNameElement) contactNameElement.textContent = contact.username;
  if (contactInitialElement)
    contactInitialElement.textContent = contact.username
      .charAt(0)
      .toUpperCase();

  // Mostrar indicador de carregamento
  const messagesContainer = document.getElementById("messagesContainer");
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
      console.log("Usando conexão WebSocket existente");
      // Carregar mensagens usando a conexão existente
      loadMessages();
    } else {
      // Estabelecer nova conexão
      await connectWebSocket();
      // Carregar mensagens após a conexão ser estabelecida
      loadMessages();
    }
  } catch (error) {
    console.error("Erro ao inicializar chat:", error);

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
      document
        .getElementById("retryConnection")
        ?.addEventListener("click", () => {
          openChat(contact);
        });
    }
  }
}

// Funções de Mensagens
async function loadMessages() {
  if (!currentUser || !currentContact) return;

  if (!document.getElementById("messagesContainer")) {
    const chatArea = document.querySelector(".flex-1.flex.flex-col");
    if (chatArea) {
      chatArea.innerHTML = `
        <div class="flex-1 p-4 overflow-y-auto bg-gray-50" id="messagesContainer"></div>
      `;
    }
  }

  try {
    // Garantir que o messagesContainer existe
    let messagesContainer = document.getElementById("messagesContainer");
    if (!messagesContainer) {
      console.log(
        "Elemento messagesContainer não encontrado, aguardando DOM..."
      );
      // Aguardar um curto período e tentar novamente
      return setTimeout(loadMessages, 100);
    }

    // Mostrar loading
    messagesContainer.innerHTML = `
            <div class="flex justify-center items-center h-full">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
        `;

    const response = await fetch(
      `${API_BASE_URL}/messages/${currentUser.id}/${currentContact.id}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("chatToken")}`,
        },
      }
    );

    if (response.ok) {
      const messages = await response.json();
      renderMessages(messages);
    } else {
      console.error("Erro ao carregar mensagens");
      throw new Error("Erro ao carregar mensagens");
    }
  } catch (error) {
    console.error("Erro ao carregar mensagens:", error);
    const messagesContainer = document.getElementById("messagesContainer");
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
  if (!window.location.pathname.endsWith("chat.html")) {
    console.log("Redirecionando para a página de chat...");
    window.location.href = `chat.html?contact=${currentContact.id}`;
    return;
  }

  const messagesContainer = document.getElementById("messagesContainer");
  if (!messagesContainer) {
    console.warn(
      "Elemento messagesContainer não encontrado - aguardando DOM carregar"
    );
    // Limitar recursão para evitar stack overflow
    return;
  }

  messagesContainer.innerHTML = "";

  messages.forEach((message) => {
    const isSender = message.senderId === currentUser.id;
    const messageElement = document.createElement("div");
    messageElement.className = `flex ${
      isSender ? "justify-end" : "justify-start"
    } mb-4`;

    messageElement.innerHTML = `
            <div class="${
              isSender ? "bg-indigo-500 text-white" : "bg-white"
            } rounded-lg py-2 px-4 max-w-xs lg:max-w-md">
                <p>${message.content}</p>
                <p class="text-xs ${
                  isSender ? "text-indigo-100" : "text-gray-500"
                } mt-1">
                    ${new Date(message.createdAt).toLocaleTimeString()}
                </p>
            </div>
        `;

    messagesContainer.appendChild(messageElement);
  });

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function connectWebSocket() {
  // Evitar conexões simultâneas
  if (socketConnecting) {
    console.log("Conexão em andamento, aguardando...");
    return new Promise((resolve, reject) => {
      // Tentar verificar se conseguimos uma conexão a cada 100ms
      const checkInterval = setInterval(() => {
        if (!socketConnecting) {
          clearInterval(checkInterval);
          if (socket && socket.readyState === WebSocket.OPEN) {
            resolve(socket);
          } else {
            reject(new Error("Conexão falhou"));
          }
        }
      }, 100);

      // Desistir após 5 segundos
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error("Tempo de espera esgotado"));
      }, 5000);
    });
  }

  socketConnecting = true;

  return new Promise((resolve, reject) => {
    const token = localStorage.getItem("chatToken");
    if (!token) {
      socketConnecting = false;
      reject(new Error("No authentication token found"));
      return;
    }

    try {
      // Fechar qualquer conexão existente antes de criar uma nova
      if (socket && socket.readyState !== WebSocket.CLOSED) {
        socket.close();
      }

      // Debug - Mostrar qual URL está sendo usada
      const wsUrl = `ws://localhost:3000/api/messages/ws?token=${encodeURIComponent(
        token
      )}`;
      console.log("Conectando ao WebSocket:", wsUrl);

      // Adicione o token como query parameter
      const newSocket = new WebSocket(wsUrl);

      // Definir timeout para conexão
      const connectionTimeout = setTimeout(() => {
        if (newSocket.readyState !== WebSocket.OPEN) {
          console.error("WebSocket connection timeout");
          newSocket.close();
          socketConnecting = false;
          reject(new Error("Connection timeout"));
        }
      }, 10000); // Aumentar timeout para 10 segundos

      newSocket.onopen = () => {
        console.log("Conectado ao WebSocket!");
        clearTimeout(connectionTimeout);

        // Verificar se a conexão está estável com um ping inicial
        newSocket.send(JSON.stringify({ type: "ping" }));

        // Armazenar globalmente somente após conexão bem-sucedida
        socket = newSocket;
        reconnectAttempts = 0;
        socketConnecting = false;
        resolve(socket);
      };

      // Configurar handlers de mensagem
      newSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("Mensagem recebida:", message.type);

          switch (message.type) {
            case "chat":
              addMessageToChat(message);
              break;

            case "delivery_status":
              updateMessageStatus(message.messageId, message.status);
              break;

            case "system":
              console.log("Sistema:", message.content);
              break;

            case "pong":
              console.log("Pong recebido do servidor");
              break;

            case "error":
              console.error("Erro do servidor:", message.content);
              // Mostrar mensagem de erro ao usuário se necessário
              break;

            default:
              console.log("Mensagem desconhecida:", message);
          }
        } catch (error) {
          console.error("Erro ao processar mensagem WebSocket:", error);
        }
      };

      newSocket.onclose = (event) => {
        console.log(`Conexão fechada (código ${event.code}): ${event.reason}`);
        socketConnecting = false;

        // Se não foi um fechamento "limpo" (code 1000), tentar reconectar
        if (event.code !== 1000) {
          handleReconnect();
        }
      };

      newSocket.onerror = (error) => {
        console.error("Erro WebSocket:", error);
        clearTimeout(connectionTimeout);
        socketConnecting = false;
        reject(error);
      };
    } catch (error) {
      console.error("Erro ao inicializar WebSocket:", error);
      socketConnecting = false;
      reject(error);
    }
  });
}

// Implementar heartbeat para detectar desconexões silenciosas
function setupHeartbeat() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;

  // Enviar ping a cada 30 segundos
  const pingInterval = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ type: "ping" }));
      } catch (error) {
        console.error("Erro ao enviar ping:", error);
        clearInterval(pingInterval);

        // Se não conseguimos enviar ping, a conexão provavelmente está quebrada
        if (socket) {
          socket.close();
          // handleReconnect será chamado pelo evento onclose
        }
      }
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);

  // Limpar intervalo quando o socket for fechado
  socket.addEventListener("close", () => {
    clearInterval(pingInterval);
  });
}

// Função para lidar com reconexão do WebSocket
function handleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error("Número máximo de tentativas de reconexão atingido");

    // Mostrar mensagem de erro para o usuário
    const messagesContainer = document.getElementById("messagesContainer");
    if (messagesContainer) {
      messagesContainer.innerHTML += `
        <div class="flex justify-center my-4">
          <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
            Não foi possível reconectar ao servidor. Por favor, atualize a página.
          </div>
        </div>
      `;
    }
    return;
  }

  reconnectAttempts++;

  // Tempo de espera exponencial com jitter para evitar reconexões simultâneas
  const backoff = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
  const jitter = Math.random() * 1000;
  const timeout = backoff + jitter;

  console.log(
    `Tentando reconectar em ${Math.round(timeout / 1000)} segundos...`
  );

  // Mostrar indicador de reconexão
  const messagesContainer = document.getElementById("messagesContainer");
  if (messagesContainer) {
    // Remover indicador anterior se existir
    document.getElementById("reconnect-indicator")?.remove();

    messagesContainer.innerHTML += `
      <div class="flex justify-center my-2" id="reconnect-indicator">
        <div class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded flex items-center">
          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-700 mr-2"></div>
          Reconectando... Tentativa ${reconnectAttempts} de ${MAX_RECONNECT_ATTEMPTS}
        </div>
      </div>
    `;
  }

  setTimeout(() => {
    // Remover indicador de reconexão anterior
    document.getElementById("reconnect-indicator")?.remove();

    // Só tentar reconectar se ainda estivermos na página de chat
    if (window.location.pathname.endsWith("chat.html")) {
      connectWebSocket()
        .then(() => {
          console.log("Reconectado com sucesso!");

          // Configurar heartbeat para a nova conexão
          setupHeartbeat();

          // Se estiver na página de chat, recarregar mensagens
          if (currentContact) {
            loadMessages();
          }
        })
        .catch((error) => {
          console.error("Falha na reconexão:", error);
          // Tentar novamente
          handleReconnect();
        });
    }
  }, timeout);
}

// Função para atualizar o status de uma mensagem na interface
function updateMessageStatus(messageId, status) {
  // Implementar conforme necessário para atualizar indicadores visuais
  // Por exemplo, você pode adicionar ícones de check para mensagens entregues/lidas
  console.log(`Mensagem ${messageId} atualizada para: ${status}`);
}

// Função para enviar mensagem
function sendMessage(e) {
  e.preventDefault();

  if (!currentUser || !currentContact) {
    alert("Por favor, selecione um contato primeiro");
    return;
  }

  const messageInput = document.getElementById("messageInput");
  const content = messageInput.value.trim();

  if (!content) return;

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    alert("Conexão não está pronta. Tentando reconectar...");

    connectWebSocket()
      .then(() => {
        setTimeout(() => {
          sendMessageToSocket(content);
          messageInput.value = "";
        }, 500);
      })
      .catch((error) => {
        console.error("Falha ao reconectar para enviar mensagem:", error);
        alert(
          "Não foi possível estabelecer conexão. Tente novamente mais tarde."
        );
      });

    return;
  }

  sendMessageToSocket(content);
  messageInput.value = "";
}

// Função auxiliar para enviar mensagem via socket
function sendMessageToSocket(content) {
  try {
    // Formato compatível com o servidor Fastify
    const message = {
      senderId: currentUser.id,
      receiverId: currentContact.id,
      content: content,
    };

    socket.send(JSON.stringify(message));
    console.log("Mensagem enviada:", message);

    // Pré-visualização da mensagem enviada
    const messagesContainer = document.getElementById("messagesContainer");
    if (messagesContainer) {
      const messageElement = document.createElement("div");
      messageElement.className = "flex justify-end mb-4";
      messageElement.innerHTML = `
        <div class="bg-indigo-500 text-white rounded-lg py-2 px-4 max-w-xs lg:max-w-md">
          <p>${content}</p>
          <p class="text-xs text-indigo-100 mt-1">Enviando...</p>
        </div>
      `;
      messagesContainer.appendChild(messageElement);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    alert("Erro ao enviar mensagem. Tente novamente.");
  }
}

// Função para adicionar mensagem recebida ao chat
function addMessageToChat(message) {
  if (
    (message.senderId === currentUser?.id &&
      message.receiverId === currentContact?.id) ||
    (message.senderId === currentContact?.id &&
      message.receiverId === currentUser?.id)
  ) {
    const messagesContainer = document.getElementById("messagesContainer");
    if (!messagesContainer) {
      console.error("Container de mensagens não encontrado");
      return;
    }

    const isSender = message.senderId === currentUser.id;

    const messageElement = document.createElement("div");
    messageElement.className = `flex ${
      isSender ? "justify-end" : "justify-start"
    } mb-4`;

    messageElement.innerHTML = `
      <div class="${
        isSender ? "bg-indigo-500 text-white" : "bg-white"
      } rounded-lg py-2 px-4 max-w-xs lg:max-w-md">
        <p>${message.content}</p>
        <p class="text-xs ${
          isSender ? "text-indigo-100" : "text-gray-500"
        } mt-1">
          ${new Date(message.createdAt || Date.now()).toLocaleTimeString()}
        </p>
      </div>
    `;

    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

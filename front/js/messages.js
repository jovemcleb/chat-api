import { 
  API_BASE_URL, 
  MAX_RECONNECT_ATTEMPTS,
  appState
} from './config.js';
import { formatMessageTime, getStatusIcon } from './utils.js';
import { updateConnectionStatus, updateContactInfo, renderMessages } from './ui.js';

export async function loadContactAndMessages(contactId) {
  try {
    updateConnectionStatus("connecting");
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

export async function openChat(contact) {
  if (!contact) {
    console.error("Contato não definido");
    return;
  }

  appState.currentContact = contact;
  window.history.pushState(null, "", `chat.html?contact=${contact.id}`);

  if (!window.location.pathname.endsWith("chat.html")) {
    window.location.href = `chat.html?contact=${contact.id}`;
    return;
  }

  updateContactInfo(contact);
  showLoadingIndicators();

  try {
    if (appState.socket && appState.socket.readyState === WebSocket.OPEN) {
      loadMessages();
    } else {
      await connectWebSocket();
      loadMessages();
    }
  } catch (error) {
    console.error("Erro ao inicializar chat:", error);
    showErrorUI();
  }
}

function showLoadingIndicators() {
  const containers = [
    document.getElementById("messagesContainer"),
    document.getElementById("mobileMessagesContainer")
  ];

  const loadingHTML = `
    <div class="flex justify-center items-center h-full">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      <p class="ml-3 text-gray-600">Conectando ao chat...</p>
    </div>
  `;

  containers.forEach(container => {
    if (container) container.innerHTML = loadingHTML;
  });
}

function showErrorUI() {
  const errorHTML = `
    <div class="flex flex-col items-center justify-center h-full text-red-500">
      <i class="fas fa-exclamation-triangle text-4xl mb-3"></i>
      <p>Não foi possível conectar ao servidor. Tente novamente.</p>
      <button class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
        Tentar Novamente
      </button>
    </div>
  `;

  const containers = [
    document.getElementById("messagesContainer"),
    document.getElementById("mobileMessagesContainer")
  ];

  containers.forEach((container, index) => {
    if (container) {
      container.innerHTML = errorHTML;
      const button = container.querySelector("button");
      button.id = index === 0 ? "retryConnection" : "mobileRetryConnection";
      button.addEventListener("click", () => openChat(appState.currentContact));
    }
  });
}

export async function connectWebSocket() {
  updateConnectionStatus("connecting");
  
  if (appState.socketConnecting) {
    console.log("Conexão em andamento, aguardando...");
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (!appState.socketConnecting) {
          clearInterval(checkInterval);
          if (appState.socket && appState.socket.readyState === WebSocket.OPEN) {
            resolve(appState.socket);
          } else {
            reject(new Error("Conexão falhou"));
          }
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error("Tempo de espera esgotado"));
      }, 5000);
    });
  }

  appState.socketConnecting = true;

  return new Promise((resolve, reject) => {
    const token = localStorage.getItem("chatToken");
    if (!token) {
      appState.socketConnecting = false;
      updateConnectionStatus("error");
      reject(new Error("No authentication token found"));
      return;
    }

    try {
      if (appState.socket && appState.socket.readyState !== WebSocket.CLOSED) {
        appState.socket.close();
      }

      const wsUrl = `ws://localhost:3000/api/messages/ws?token=${encodeURIComponent(token)}`;
      console.log("Conectando ao WebSocket:", wsUrl);

      const newSocket = new WebSocket(wsUrl);

      const connectionTimeout = setTimeout(() => {
        if (newSocket.readyState !== WebSocket.OPEN) {
          console.error("WebSocket connection timeout");
          newSocket.close();
          appState.socketConnecting = false;
          updateConnectionStatus("error");
          reject(new Error("Connection timeout"));
        }
      }, 10000);

      newSocket.onopen = () => {
        console.log("Conectado ao WebSocket!");
        clearTimeout(connectionTimeout);

        newSocket.send(JSON.stringify({ type: "ping" }));

        appState.socket = newSocket;
        appState.reconnectAttempts = 0;
        appState.socketConnecting = false;
        updateConnectionStatus("connected");
        
        setupHeartbeat();
        
        resolve(appState.socket);
      };

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
              showErrorNotification(message.content);
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
        appState.socketConnecting = false;
        updateConnectionStatus("offline");

        if (event.code !== 1000) {
          handleReconnect();
        }
      };

      newSocket.onerror = (error) => {
        console.error("Erro WebSocket:", error);
        clearTimeout(connectionTimeout);
        appState.socketConnecting = false;
        updateConnectionStatus("error");
        reject(error);
      };
    } catch (error) {
      console.error("Erro ao inicializar WebSocket:", error);
      appState.socketConnecting = false;
      updateConnectionStatus("error");
      reject(error);
    }
  });
}

export async function loadMessages() {
  if (!appState.currentUser || !appState.currentContact) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/messages/${appState.currentUser.id}/${appState.currentContact.id}`,
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
      throw new Error("Erro ao carregar mensagens");
    }
  } catch (error) {
    console.error("Erro ao carregar mensagens:", error);
    showErrorUI();
  }
}

export function sendMessage(e) {
  e.preventDefault();
  
  if (!appState.currentContact || !appState.socket || appState.socket.readyState !== WebSocket.OPEN) {
    console.error("Não é possível enviar mensagem: socket fechado ou contato inválido");
    alert("Não foi possível enviar a mensagem. Verifique sua conexão.");
    return;
  }

  const messageInputField = e.target.id === "mobileMessageForm" 
    ? document.getElementById("mobileMessageInput") 
    : document.getElementById("messageInput");
  
  const message = messageInputField.value.trim();
  if (!message) return;
  
  messageInputField.value = "";
  
  const tempId = Date.now().toString();
  
  try {
    const newMessageData = {
      id: tempId,
      content: message,
      senderId: appState.currentUser.id,
      receiverId: appState.currentContact.id,
      createdAt: new Date().toISOString(),
      status: "sending"
    };
    
    addMessageToChat(newMessageData);
    
    appState.socket.send(JSON.stringify({
      type: "chat",
      messageId: tempId,
      senderId: appState.currentUser.id,
      receiverId: appState.currentContact.id,
      content: message
    }));
    
    setTimeout(() => {
      const messageElement = document.querySelector(`[data-message-id="${tempId}"]`);
      if (messageElement && messageElement.dataset.status === "sending") {
        updateMessageStatus(tempId, "failed");
      }
    }, 5000);
    
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    updateMessageStatus(tempId, "failed");
  }
}

function addMessageToChat(message) {
  if (!message) return;
  
  const isCurrentChat = 
    (message.senderId === appState.currentUser?.id && message.receiverId === appState.currentContact?.id) ||
    (message.senderId === appState.currentContact?.id && message.receiverId === appState.currentUser?.id);
  
  if (!isCurrentChat) return;
  
  const containers = [
    document.getElementById("messagesContainer"),
    document.getElementById("mobileMessagesContainer")
  ];
  
  containers.forEach(container => {
    if (!container) return;
    
    const isSender = message.senderId === appState.currentUser.id;
    const messageElement = document.createElement("div");
    messageElement.className = `flex ${isSender ? "justify-end" : "justify-start"} mb-4`;
    messageElement.dataset.messageId = message.id;
    messageElement.dataset.status = message.status || "delivered";
    
    messageElement.innerHTML = `
      <div class="${isSender ? "bg-indigo-500 text-white" : "bg-white"} rounded-lg py-2 px-4 max-w-xs lg:max-w-md">
        <p>${message.content}</p>
        <div class="flex items-center justify-end mt-1">
          <p class="text-xs ${isSender ? "text-indigo-100" : "text-gray-500"}">
            ${formatMessageTime(message.createdAt)}
          </p>
          ${isSender ? `
            <span class="ml-1 message-status" data-status="${message.status || 'delivered'}">
              ${getStatusIcon(message.status || 'delivered')}
            </span>
          ` : ''}
        </div>
      </div>
    `;
    
    container.appendChild(messageElement);
    container.scrollTop = container.scrollHeight;
  });
  
  if (message.senderId !== appState.currentUser.id) {
    playNotificationSound();
  }
}

function updateMessageStatus(messageId, status) {
  if (!messageId) return;
  
  const messageElements = document.querySelectorAll(`[data-message-id="${messageId}"]`);
  
  messageElements.forEach(element => {
    element.dataset.status = status;
    
    const statusElement = element.querySelector('.message-status');
    if (statusElement) {
      statusElement.dataset.status = status;
      statusElement.innerHTML = getStatusIcon(status);
    }
  });
}

function setupHeartbeat() {
  if (!appState.socket || appState.socket.readyState !== WebSocket.OPEN) return;

  const pingInterval = setInterval(() => {
    if (appState.socket && appState.socket.readyState === WebSocket.OPEN) {
      try {
        appState.socket.send(JSON.stringify({ type: "ping" }));
      } catch (error) {
        console.error("Erro ao enviar ping:", error);
        clearInterval(pingInterval);
        if (appState.socket) {
          appState.socket.close();
        }
      }
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);

  appState.socket.addEventListener('close', () => {
    clearInterval(pingInterval);
  });
}

function handleReconnect() {
  if (appState.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`Máximo de ${MAX_RECONNECT_ATTEMPTS} tentativas de reconexão atingido.`);
    updateConnectionStatus("offline");
    
    const errorHTML = `
      <div class="flex flex-col items-center justify-center h-full">
        <div class="text-red-500 mb-4">
          <i class="fas fa-exclamation-circle text-4xl"></i>
        </div>
        <p class="text-gray-700 mb-4">Conexão perdida com o servidor.</p>
        <button id="retryConnectionBtn" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
          Tentar Novamente
        </button>
      </div>
    `;
    
    const containers = [
      document.getElementById("messagesContainer"),
      document.getElementById("mobileMessagesContainer")
    ];
    
    containers.forEach(container => {
      if (container) container.innerHTML = errorHTML;
    });
    
    document.getElementById("retryConnectionBtn")?.addEventListener('click', () => {
      appState.reconnectAttempts = 0;
      connectWebSocket().then(() => {
        if (appState.currentContact) {
          loadMessages();
        }
      }).catch(err => console.error("Falha na reconexão:", err));
    });
    
    return;
  }
  
  appState.reconnectAttempts++;
  updateConnectionStatus("reconnecting");
  
  const delay = Math.min(1000 * (2 ** appState.reconnectAttempts), 30000);
  console.log(`Tentando reconectar em ${delay/1000} segundos...`);
  
  setTimeout(() => {
    connectWebSocket().then(() => {
      if (appState.currentContact) {
        loadMessages();
      }
    }).catch(err => {
      console.error("Erro na tentativa de reconexão:", err);
      handleReconnect();
    });
  }, delay);
}

function showErrorNotification(message) {
  console.error("Erro:", message);
  
  const messagesContainer = document.getElementById("messagesContainer");
  if (messagesContainer) {
    const notification = document.createElement("div");
    notification.className = "fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg";
    notification.innerHTML = `
      <p><i class="fas fa-exclamation-circle mr-2"></i> ${message}</p>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }
}
import { appState } from './config.js';
import { formatMessageTime, getStatusIcon } from './utils.js';

export function updateUserInfo() {
  if (!appState.currentUser) return;
  
  if (document.getElementById("usernameDisplay")) {
    document.getElementById("usernameDisplay").textContent = appState.currentUser.username;
  }
  if (document.getElementById("userInitial")) {
    document.getElementById("userInitial").textContent = appState.currentUser.username.charAt(0).toUpperCase();
  }
  
  if (document.getElementById("mobileUserInitial")) {
    document.getElementById("mobileUserInitial").textContent = appState.currentUser.username.charAt(0).toUpperCase();
  }
}

export function updateContactInfo(contact) {
  const contactNameElement = document.getElementById("contactName");
  const contactInitialElement = document.getElementById("contactInitial");

  if (contactNameElement) contactNameElement.textContent = contact.username;
  if (contactInitialElement) contactInitialElement.textContent = contact.username.charAt(0).toUpperCase();

  const mobileContactNameElement = document.getElementById("mobileContactName");
  const mobileContactInitialElement = document.getElementById("mobileContactInitial");

  if (mobileContactNameElement) mobileContactNameElement.textContent = contact.username;
  if (mobileContactInitialElement) mobileContactInitialElement.textContent = contact.username.charAt(0).toUpperCase();
}

export function updateConnectionStatus(status) {
  const connectionStatus = document.getElementById("connectionStatus");
  if (!connectionStatus) return;

  connectionStatus.classList.remove("hidden");
  
  switch (status) {
    case "connecting":
      connectionStatus.innerHTML = "Conectando...";
      connectionStatus.className = "connection-status bg-yellow-500";
      break;
    case "connected":
      connectionStatus.innerHTML = "Conectado";
      connectionStatus.className = "connection-status bg-green-500";
      setTimeout(() => {
        connectionStatus.classList.add("hidden");
      }, 2000);
      break;
    case "reconnecting":
      connectionStatus.innerHTML = `Reconectando... (${appState.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`;
      connectionStatus.className = "connection-status bg-yellow-500";
      break;
    case "offline":
      connectionStatus.innerHTML = "Offline";
      connectionStatus.className = "connection-status bg-red-500";
      break;
    case "error":
      connectionStatus.innerHTML = "Erro de conexÃ£o";
      connectionStatus.className = "connection-status bg-red-500";
      break;
  }
}

export function renderMessages(messages) {
  if (!window.location.pathname.endsWith("chat.html")) {
    window.location.href = `chat.html?contact=${appState.currentContact.id}`;
    return;
  }

  const containers = [
    document.getElementById("messagesContainer"),
    document.getElementById("mobileMessagesContainer")
  ];

  containers.forEach(container => {
    if (!container) return;
    container.innerHTML = "";
    
    messages.forEach(message => {
      const isSender = message.senderId === appState.currentUser.id;
      const messageElement = document.createElement("div");
      messageElement.className = `flex ${isSender ? "justify-end" : "justify-start"} mb-4`;

      messageElement.innerHTML = `
        <div class="${isSender ? "bg-indigo-500 text-white" : "bg-white"} rounded-lg py-2 px-4 max-w-xs lg:max-w-md">
          <p>${message.content}</p>
          <p class="text-xs ${isSender ? "text-indigo-100" : "text-gray-500"} mt-1">
            ${formatMessageTime(message.createdAt)}
          </p>
        </div>
      `;

      container.appendChild(messageElement);
    });
    
    container.scrollTop = container.scrollHeight;
  });
}

export function setupConnectionStatusStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .connection-status {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      padding: 4px;
      text-align: center;
      color: white;
      font-size: 12px;
      z-index: 1000;
      transition: opacity 0.3s ease;
    }
    
    .message-status {
      display: inline-flex;
      align-items: center;
    }
  `;
  document.head.appendChild(style);
}
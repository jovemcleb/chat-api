import { appState } from './config.js';
import { checkAuth, setupAuthTabs, logout } from './auth.js';
import { loadContacts } from './contacts.js';
import { loadContactAndMessages, connectWebSocket, sendMessage } from './messages.js';
import { updateConnectionStatus, setupConnectionStatusStyles } from './ui.js';

document.addEventListener("DOMContentLoaded", function () {
  checkAuth();
  setupConnectionStatusStyles();
  setupEventListeners();
});

function setupEventListeners() {
  if (window.location.pathname.endsWith("chat.html")) {
    const urlParams = new URLSearchParams(window.location.search);
    const contactId = urlParams.get("contact");

    if (contactId) {
      loadContactAndMessages(parseInt(contactId));
    }

    setupChatPageButtons();
  }

  if (document.getElementById("loginTab")) {
    setupAuthTabs();
  }

  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("mobileLogoutBtn")?.addEventListener("click", logout);

  if (document.getElementById("contactsList") || document.getElementById("mobileContactsList")) {
    loadContacts();
  }

  document.getElementById("messageForm")?.addEventListener("submit", sendMessage);
  document.getElementById("mobileMessageForm")?.addEventListener("submit", sendMessage);

  updateConnectionStatus("offline");
}

function setupChatPageButtons() {
  document.getElementById("backButton")?.addEventListener("click", () => {
    window.location.href = "contacts.html";
  });

  document.getElementById("closeChat")?.addEventListener("click", () => {
    window.location.href = "contacts.html";
  });

  document.getElementById("mobileCloseChat")?.addEventListener("click", () => {
    window.location.href = "contacts.html";
  });
}

window.addEventListener("popstate", handlePageNavigation);
window.addEventListener("beforeunload", cleanupWebSocket);

function handlePageNavigation() {
  if (window.location.pathname.endsWith("chat.html")) {
    const urlParams = new URLSearchParams(window.location.search);
    const contactId = urlParams.get("contact");

    if (contactId) {
      loadContactAndMessages(parseInt(contactId));
    }
  } else {
    cleanupWebSocket();
  }
}

function cleanupWebSocket() {
  if (appState.socket) {
    console.log("Fechando WebSocket ao sair...");
    appState.socket.close(1000, "Navegação do usuário");
    appState.socket = null;
  }
  appState.currentContact = null;
  appState.reconnectAttempts = 0;
  appState.socketConnecting = false;
}
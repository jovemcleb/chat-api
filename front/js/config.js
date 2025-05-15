// Configurações globais
export const API_BASE_URL = "http://localhost:3000/api";
export const MAX_RECONNECT_ATTEMPTS = 5;

// Estado global (usando objetos mutáveis para estados compartilhados)
export const appState = {
  currentUser: null,
  currentContact: null,
  socket: null,
  reconnectAttempts: 0,
  socketConnecting: false,
};

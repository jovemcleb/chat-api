import { API_BASE_URL, appState } from './config.js';
import { updateUserInfo } from './ui.js';

export async function checkAuth() {
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
        appState.currentUser = await response.json();
        updateUserInfo();

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

export function setupAuthTabs() {
  const loginTab = document.getElementById("loginTab");
  const registerTab = document.getElementById("registerTab");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  if (!loginTab || !registerTab || !loginForm || !registerForm) return;

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

  loginForm.addEventListener("submit", handleLogin);
  registerForm.addEventListener("submit", handleRegister);
}

async function handleLogin(e) {
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
      appState.currentUser = data.user;
      window.location.href = "contacts.html";
    } else {
      const errorData = await response.json();
      alert(errorData.error || "Login falhou");
    }
  } catch (error) {
    console.error("Erro ao fazer login:", error);
    alert("Erro ao conectar ao servidor.");
  }
}

async function handleRegister(e) {
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
}

export function logout() {
  localStorage.removeItem("chatToken");
  if (appState.socket) {
    appState.socket.close();
    appState.socket = null;
  }
  window.location.href = "index.html";
}
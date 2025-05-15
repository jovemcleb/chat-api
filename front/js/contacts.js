import { API_BASE_URL, appState } from './config.js';
import { openChat } from './messages.js';

export async function loadContacts() {
  try {
    const response = await fetch(`${API_BASE_URL}/users/all`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("chatToken")}`,
      },
    });

    if (response.ok) {
      const users = await response.json();
      if (appState.currentUser) {
        renderContacts(users.filter((user) => user.id !== appState.currentUser.id));
      }
    } else {
      console.error("Erro ao carregar contatos");
    }
  } catch (error) {
    console.error("Erro ao carregar contatos:", error);
  }
}

function renderContacts(contacts) {
  renderDesktopContacts(contacts);
  renderMobileContacts(contacts);
}

function renderDesktopContacts(contacts) {
  const contactsList = document.getElementById("contactsList");
  if (!contactsList) return;

  contactsList.innerHTML = "";

  contacts.forEach((contact) => {
    const contactElement = document.createElement("div");
    contactElement.className = "p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex items-center space-x-3";
    contactElement.innerHTML = `
      <div class="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">
        ${contact.username.charAt(0).toUpperCase()}
      </div>
      <div>
        <p class="font-medium">${contact.username}</p>
        <p class="text-xs text-gray-500">${contact.email}</p>
      </div>
    `;

    // Usar o mesmo comportamento da versão mobile
    contactElement.addEventListener("click", () => {
        localStorage.setItem("selectedContactId", contact.id);
      window.location.href = `chat.html?contact=${contact.id}`;
    });
    contactsList.appendChild(contactElement);
  });
}

function renderMobileContacts(contacts) {
  const mobileContactsList = document.getElementById("mobileContactsList");
  if (!mobileContactsList) return;

  mobileContactsList.innerHTML = "";

  contacts.forEach((contact) => {
    const contactElement = document.createElement("div");
    contactElement.className = "p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex items-center space-x-3";
    contactElement.innerHTML = `
      <div class="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">
        ${contact.username.charAt(0).toUpperCase()}
      </div>
      <div>
        <p class="font-medium">${contact.username}</p>
        <p class="text-xs text-gray-500">${contact.email}</p>
      </div>
    `;

    contactElement.addEventListener("click", () => {
      window.location.href = `chat.html?contact=${contact.id}`;
    });
    mobileContactsList.appendChild(contactElement);
  });
}
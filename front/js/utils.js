export function formatMessageTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function getStatusIcon(status) {
  switch (status) {
    case 'sent':
      return '<i class="fas fa-check text-xs"></i>';
    case 'delivered':
      return '<i class="fas fa-check-double text-xs"></i>';
    case 'read':
      return '<i class="fas fa-check-double text-xs text-blue-300"></i>';
    case 'sending':
      return '<i class="fas fa-clock text-xs"></i>';
    case 'failed':
      return '<i class="fas fa-exclamation-circle text-xs text-red-300"></i>';
    default:
      return '';
  }
}

export function playNotificationSound() {
  try {
    const audio = new Audio("notification.mp3");
    audio.volume = 0.5;
    audio.play().catch(e => console.log("Não foi possível reproduzir som de notificação"));
  } catch (error) {
    console.log("Erro ao reproduzir som de notificação:", error);
  }
}
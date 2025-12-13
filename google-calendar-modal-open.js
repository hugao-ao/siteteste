/**
 * Função para abrir o modal de gerenciamento do Google Calendar
 * Deve ser incluída em todas as páginas que usam a sidebar
 */

function openGoogleCalendarModal() {
    // Abrir modal em uma nova janela popup
    const width = 650;
    const height = 700;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;
    
    const popup = window.open(
        'google-calendar-modal.html',
        'GoogleCalendarModal',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    
    if (!popup) {
        alert('Pop-up bloqueado! Por favor, permita pop-ups para este site.');
    }
}

// Disponibilizar globalmente
window.openGoogleCalendarModal = openGoogleCalendarModal;

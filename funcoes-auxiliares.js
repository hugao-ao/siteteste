// ========================================
// FUNÇÕES AUXILIARES FALTANTES
// ========================================

// ========================================
// SISTEMA DE LOADING
// ========================================

let loadingModal = null;

function showLoading(message = 'Carregando...') {
    // Remover loading anterior se existir
    hideLoading();
    
    // Criar modal de loading
    loadingModal = document.createElement('div');
    loadingModal.id = 'loading-modal';
    loadingModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        backdrop-filter: blur(5px);
    `;
    
    loadingModal.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            padding: 2rem;
            border-radius: 12px;
            text-align: center;
            color: white;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(173, 216, 230, 0.3);
            min-width: 250px;
        ">
            <div style="
                width: 40px;
                height: 40px;
                border: 3px solid rgba(173, 216, 230, 0.3);
                border-top: 3px solid #add8e6;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 1rem;
            "></div>
            <div style="font-size: 1.1rem; font-weight: 500;">${message}</div>
        </div>
        
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    
    document.body.appendChild(loadingModal);
    
    // Prevenir scroll do body
    document.body.style.overflow = 'hidden';
}

function hideLoading() {
    if (loadingModal) {
        loadingModal.remove();
        loadingModal = null;
        
        // Restaurar scroll do body
        document.body.style.overflow = '';
    }
}

// ========================================
// SISTEMA DE NOTIFICAÇÕES
// ========================================

let notificationContainer = null;

function createNotificationContainer() {
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            pointer-events: none;
        `;
        document.body.appendChild(notificationContainer);
    }
    return notificationContainer;
}

function showNotification(message, type = 'info', duration = 5000) {
    const container = createNotificationContainer();
    
    // Cores por tipo
    const colors = {
        success: { bg: '#28a745', border: '#1e7e34', icon: 'fas fa-check-circle' },
        error: { bg: '#dc3545', border: '#c82333', icon: 'fas fa-exclamation-circle' },
        warning: { bg: '#ffc107', border: '#e0a800', icon: 'fas fa-exclamation-triangle', textColor: '#212529' },
        info: { bg: '#17a2b8', border: '#138496', icon: 'fas fa-info-circle' }
    };
    
    const config = colors[type] || colors.info;
    const textColor = config.textColor || '#ffffff';
    
    // Criar notificação
    const notification = document.createElement('div');
    notification.style.cssText = `
        background: ${config.bg};
        color: ${textColor};
        padding: 1rem 1.5rem;
        border-radius: 8px;
        margin-bottom: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        border-left: 4px solid ${config.border};
        min-width: 300px;
        max-width: 400px;
        word-wrap: break-word;
        pointer-events: auto;
        cursor: pointer;
        transform: translateX(100%);
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.95rem;
        font-weight: 500;
    `;
    
    notification.innerHTML = `
        <i class="${config.icon}" style="font-size: 1.2rem; flex-shrink: 0;"></i>
        <div style="flex-grow: 1;">${message}</div>
        <i class="fas fa-times" style="font-size: 0.9rem; opacity: 0.7; cursor: pointer;" onclick="this.parentElement.remove()"></i>
    `;
    
    // Adicionar ao container
    container.appendChild(notification);
    
    // Animar entrada
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Auto remover
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            }
        }, duration);
    }
    
    // Remover ao clicar
    notification.addEventListener('click', () => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 300);
    });
}

// ========================================
// FORMATAÇÃO DE DADOS
// ========================================

function formatCPF(value) {
    // Remove tudo que não é dígito
    value = value.replace(/\D/g, '');
    
    // Limita a 11 dígitos
    value = value.substring(0, 11);
    
    // Aplica a máscara
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    
    return value;
}

function formatWhatsApp(value) {
    // Remove tudo que não é dígito
    value = value.replace(/\D/g, '');
    
    // Limita a 11 dígitos
    value = value.substring(0, 11);
    
    // Aplica a máscara
    if (value.length <= 10) {
        // Formato antigo: (11) 1234-5678
        value = value.replace(/(\d{2})(\d)/, '($1) $2');
        value = value.replace(/(\d{4})(\d)/, '$1-$2');
    } else {
        // Formato novo: (11) 91234-5678
        value = value.replace(/(\d{2})(\d)/, '($1) $2');
        value = value.replace(/(\d{5})(\d)/, '$1-$2');
    }
    
    return value;
}

// ========================================
// UTILITÁRIOS GERAIS
// ========================================

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// Função para validar CPF
function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    
    if (cpf.length !== 11) return false;
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    
    // Validação do primeiro dígito verificador
    let soma = 0;
    for (let i = 0; i < 9; i++) {
        soma += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let resto = 11 - (soma % 11);
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(9))) return false;
    
    // Validação do segundo dígito verificador
    soma = 0;
    for (let i = 0; i < 10; i++) {
        soma += parseInt(cpf.charAt(i)) * (11 - i);
    }
    resto = 11 - (soma % 11);
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(10))) return false;
    
    return true;
}

// Função para validar WhatsApp
function validarWhatsApp(whatsapp) {
    const digits = whatsapp.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 11;
}

// ========================================
// MANIPULAÇÃO DE ELEMENTOS
// ========================================

function toggleElementVisibility(elementId, show) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = show ? 'block' : 'none';
    }
}

function updateElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

function updateElementHTML(elementId, html) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = html;
    }
}

// ========================================
// TRATAMENTO DE ERROS
// ========================================

function handleError(error, context = 'Operação') {
    console.error(`❌ Erro em ${context}:`, error);
    
    let message = `Erro em ${context}`;
    
    if (error.message) {
        message += ': ' + error.message;
    } else if (typeof error === 'string') {
        message += ': ' + error;
    }
    
    showNotification(message, 'error');
    hideLoading();
}

// ========================================
// CONFIRMAÇÕES
// ========================================

function confirmarAcao(message, callback) {
    if (confirm(message)) {
        callback();
    }
}

function confirmarExclusao(item, callback) {
    const message = `Tem certeza que deseja excluir "${item}"?\n\nEsta ação não pode ser desfeita.`;
    confirmarAcao(message, callback);
}

// ========================================
// UTILITÁRIOS DE DATA
// ========================================

function formatarData(data) {
    if (!data) return '-';
    
    try {
        const date = new Date(data);
        return date.toLocaleDateString('pt-BR');
    } catch (error) {
        return '-';
    }
}

function formatarDataHora(data) {
    if (!data) return '-';
    
    try {
        const date = new Date(data);
        return date.toLocaleString('pt-BR');
    } catch (error) {
        return '-';
    }
}

// ========================================
// LIMPEZA DE FORMULÁRIOS
// ========================================

function limparFormulario(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.reset();
        
        // Limpar campos que não são limpos pelo reset
        const selects = form.querySelectorAll('select');
        selects.forEach(select => {
            select.selectedIndex = 0;
        });
        
        const textareas = form.querySelectorAll('textarea');
        textareas.forEach(textarea => {
            textarea.value = '';
        });
    }
}

// ========================================
// TORNAR FUNÇÕES GLOBAIS
// ========================================

window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showNotification = showNotification;
window.formatCPF = formatCPF;
window.formatWhatsApp = formatWhatsApp;
window.validarCPF = validarCPF;
window.validarWhatsApp = validarWhatsApp;
window.debounce = debounce;
window.throttle = throttle;
window.toggleElementVisibility = toggleElementVisibility;
window.updateElementText = updateElementText;
window.updateElementHTML = updateElementHTML;
window.handleError = handleError;
window.confirmarAcao = confirmarAcao;
window.confirmarExclusao = confirmarExclusao;
window.formatarData = formatarData;
window.formatarDataHora = formatarDataHora;
window.limparFormulario = limparFormulario;

console.log('✅ Funções auxiliares carregadas!');


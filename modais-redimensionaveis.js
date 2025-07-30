// ========================================
// SISTEMA DE MODAIS REDIMENSIONÁVEIS
// ========================================

// Variáveis globais para controle de drag
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let modalStartX = 0;
let modalStartY = 0;
let currentDragModal = null;

// ========================================
// FUNÇÃO PRINCIPAL PARA TORNAR MODAL REDIMENSIONÁVEL
// ========================================

function tornarModalRedimensionavel(modal) {
    if (!modal || modal.classList.contains('resizable-setup')) {
        return; // Já foi configurado
    }
    
    modal.classList.add('resizable-setup');
    const modalContent = modal.querySelector('.modal-content');
    const modalHeader = modal.querySelector('.modal-header');
    
    if (!modalContent || !modalHeader) {
        console.warn('Modal não possui estrutura adequada para redimensionamento');
        return;
    }
    
    // Adicionar classes necessárias
    modal.classList.add('resizable-modal');
    modalContent.classList.add('resizable-content');
    
    // Configurar posicionamento inicial
    configurarPosicionamentoInicial(modalContent);
    
    // Adicionar botão de maximizar/restaurar
    adicionarBotaoMaximizar(modalHeader, modal);
    
    // Configurar drag do header
    configurarDragHeader(modalHeader, modal);
    
    // Configurar redimensionamento
    configurarRedimensionamento(modalContent);
    
    // Configurar eventos de teclado
    configurarEventosTeclado(modal);
    
    // Adicionar animação de entrada
    modal.classList.add('show');
    
    console.log('✅ Modal configurado como redimensionável');
}

// ========================================
// CONFIGURAÇÕES INICIAIS
// ========================================

function configurarPosicionamentoInicial(modalContent) {
    // Centralizar modal na tela
    const rect = modalContent.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const left = Math.max(0, (viewportWidth - rect.width) / 2);
    const top = Math.max(0, (viewportHeight - rect.height) / 2);
    
    modalContent.style.position = 'fixed';
    modalContent.style.left = left + 'px';
    modalContent.style.top = top + 'px';
    modalContent.style.margin = '0';
    modalContent.style.transform = 'none';
}

function adicionarBotaoMaximizar(modalHeader, modal) {
    // Verificar se já existe
    if (modalHeader.querySelector('.modal-maximize-btn')) {
        return;
    }
    
    const maximizeBtn = document.createElement('button');
    maximizeBtn.className = 'modal-maximize-btn';
    maximizeBtn.innerHTML = '<i class="fas fa-expand-alt"></i>';
    maximizeBtn.title = 'Maximizar/Restaurar';
    
    maximizeBtn.onclick = (e) => {
        e.stopPropagation();
        toggleMaximizar(modal);
    };
    
    // Inserir antes do botão de fechar
    const closeBtn = modalHeader.querySelector('.close');
    if (closeBtn) {
        modalHeader.insertBefore(maximizeBtn, closeBtn);
    } else {
        modalHeader.appendChild(maximizeBtn);
    }
}

// ========================================
// SISTEMA DE DRAG (ARRASTAR)
// ========================================

function configurarDragHeader(modalHeader, modal) {
    modalHeader.style.cursor = 'move';
    
    modalHeader.addEventListener('mousedown', (e) => {
        // Não iniciar drag se clicar em botões
        if (e.target.closest('button') || e.target.closest('.close')) {
            return;
        }
        
        iniciarDrag(e, modal);
    });
    
    // Prevenir seleção de texto durante drag
    modalHeader.addEventListener('selectstart', (e) => {
        if (isDragging) {
            e.preventDefault();
        }
    });
}

function iniciarDrag(e, modal) {
    isDragging = true;
    currentDragModal = modal;
    
    const modalContent = modal.querySelector('.modal-content');
    const rect = modalContent.getBoundingClientRect();
    
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    modalStartX = rect.left;
    modalStartY = rect.top;
    
    // Adicionar classe visual
    modal.classList.add('modal-dragging');
    
    // Criar overlay para melhor experiência de drag
    criarDragOverlay();
    
    // Adicionar eventos globais
    document.addEventListener('mousemove', processarDrag);
    document.addEventListener('mouseup', finalizarDrag);
    
    e.preventDefault();
}

function processarDrag(e) {
    if (!isDragging || !currentDragModal) return;
    
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    
    const newX = modalStartX + deltaX;
    const newY = modalStartY + deltaY;
    
    // Limitar às bordas da tela
    const modalContent = currentDragModal.querySelector('.modal-content');
    const rect = modalContent.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;
    
    const constrainedX = Math.max(0, Math.min(newX, maxX));
    const constrainedY = Math.max(0, Math.min(newY, maxY));
    
    modalContent.style.left = constrainedX + 'px';
    modalContent.style.top = constrainedY + 'px';
}

function finalizarDrag() {
    if (!isDragging) return;
    
    isDragging = false;
    
    if (currentDragModal) {
        currentDragModal.classList.remove('modal-dragging');
        currentDragModal = null;
    }
    
    // Remover overlay
    removerDragOverlay();
    
    // Remover eventos globais
    document.removeEventListener('mousemove', processarDrag);
    document.removeEventListener('mouseup', finalizarDrag);
}

function criarDragOverlay() {
    let overlay = document.getElementById('drag-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'drag-overlay';
        overlay.className = 'drag-overlay';
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'block';
}

function removerDragOverlay() {
    const overlay = document.getElementById('drag-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ========================================
// SISTEMA DE REDIMENSIONAMENTO
// ========================================

function configurarRedimensionamento(modalContent) {
    // O CSS já configura resize: both, mas podemos adicionar handles customizados
    adicionarResizeHandles(modalContent);
    
    // Observar mudanças de tamanho
    if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                ajustarConteudoModal(entry.target);
            }
        });
        
        resizeObserver.observe(modalContent);
    }
}

function adicionarResizeHandles(modalContent) {
    // Handle direita
    const handleE = document.createElement('div');
    handleE.className = 'resize-handle resize-handle-e';
    modalContent.appendChild(handleE);
    
    // Handle baixo
    const handleS = document.createElement('div');
    handleS.className = 'resize-handle resize-handle-s';
    modalContent.appendChild(handleS);
    
    // Handle canto inferior direito
    const handleSE = document.createElement('div');
    handleSE.className = 'resize-handle resize-handle-se';
    modalContent.appendChild(handleSE);
    
    // Configurar eventos de redimensionamento customizado
    configurarResizeCustomizado(handleE, modalContent, 'e');
    configurarResizeCustomizado(handleS, modalContent, 's');
    configurarResizeCustomizado(handleSE, modalContent, 'se');
}

function configurarResizeCustomizado(handle, modalContent, direction) {
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
    
    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = modalContent.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
        
        e.preventDefault();
        e.stopPropagation();
    });
    
    function resize(e) {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        
        if (direction.includes('e')) {
            newWidth = Math.max(400, startWidth + deltaX);
        }
        
        if (direction.includes('s')) {
            newHeight = Math.max(300, startHeight + deltaY);
        }
        
        // Limitar ao tamanho da viewport
        newWidth = Math.min(newWidth, window.innerWidth * 0.95);
        newHeight = Math.min(newHeight, window.innerHeight * 0.95);
        
        modalContent.style.width = newWidth + 'px';
        modalContent.style.height = newHeight + 'px';
        
        ajustarConteudoModal(modalContent);
    }
    
    function stopResize() {
        isResizing = false;
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
    }
}

function ajustarConteudoModal(modalContent) {
    const modalBody = modalContent.querySelector('.modal-body');
    if (!modalBody) return;
    
    // Recalcular altura disponível para o body
    const header = modalContent.querySelector('.modal-header');
    const footer = modalContent.querySelector('.modal-footer');
    
    const headerHeight = header ? header.offsetHeight : 0;
    const footerHeight = footer ? footer.offsetHeight : 0;
    const totalHeight = modalContent.offsetHeight;
    
    const availableHeight = totalHeight - headerHeight - footerHeight - 40; // 40px para padding
    modalBody.style.maxHeight = availableHeight + 'px';
}

// ========================================
// SISTEMA DE MAXIMIZAR/RESTAURAR
// ========================================

function toggleMaximizar(modal) {
    const modalContent = modal.querySelector('.modal-content');
    const maximizeBtn = modal.querySelector('.modal-maximize-btn i');
    
    if (modal.classList.contains('modal-maximized')) {
        // Restaurar
        modal.classList.remove('modal-maximized');
        maximizeBtn.className = 'fas fa-expand-alt';
        
        // Restaurar posição e tamanho anteriores
        const savedData = modal._savedModalData;
        if (savedData) {
            modalContent.style.width = savedData.width;
            modalContent.style.height = savedData.height;
            modalContent.style.left = savedData.left;
            modalContent.style.top = savedData.top;
        }
        
    } else {
        // Salvar estado atual
        const rect = modalContent.getBoundingClientRect();
        modal._savedModalData = {
            width: modalContent.style.width || rect.width + 'px',
            height: modalContent.style.height || rect.height + 'px',
            left: modalContent.style.left || rect.left + 'px',
            top: modalContent.style.top || rect.top + 'px'
        };
        
        // Maximizar
        modal.classList.add('modal-maximized');
        maximizeBtn.className = 'fas fa-compress-alt';
        
        modalContent.style.left = '2.5vw';
        modalContent.style.top = '2.5vh';
    }
    
    // Ajustar conteúdo após mudança
    setTimeout(() => ajustarConteudoModal(modalContent), 100);
}

// ========================================
// EVENTOS DE TECLADO
// ========================================

function configurarEventosTeclado(modal) {
    const handleKeydown = (e) => {
        // ESC para fechar
        if (e.key === 'Escape') {
            const closeBtn = modal.querySelector('.close');
            if (closeBtn) {
                closeBtn.click();
            }
        }
        
        // F11 para maximizar/restaurar
        if (e.key === 'F11') {
            e.preventDefault();
            toggleMaximizar(modal);
        }
    };
    
    modal.addEventListener('keydown', handleKeydown);
    
    // Focar no modal quando aberto
    modal.setAttribute('tabindex', '-1');
    setTimeout(() => modal.focus(), 100);
}

// ========================================
// UTILITÁRIOS
// ========================================

// Centralizar modal na tela
function centralizarModal(modal) {
    const modalContent = modal.querySelector('.modal-content');
    if (!modalContent) return;
    
    const rect = modalContent.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const left = Math.max(0, (viewportWidth - rect.width) / 2);
    const top = Math.max(0, (viewportHeight - rect.height) / 2);
    
    modalContent.style.left = left + 'px';
    modalContent.style.top = top + 'px';
}

// Ajustar modal para caber na tela
function ajustarModalParaTela(modal) {
    const modalContent = modal.querySelector('.modal-content');
    if (!modalContent) return;
    
    const rect = modalContent.getBoundingClientRect();
    const maxWidth = window.innerWidth * 0.95;
    const maxHeight = window.innerHeight * 0.95;
    
    if (rect.width > maxWidth) {
        modalContent.style.width = maxWidth + 'px';
    }
    
    if (rect.height > maxHeight) {
        modalContent.style.height = maxHeight + 'px';
    }
    
    // Reposicionar se necessário
    const newRect = modalContent.getBoundingClientRect();
    if (newRect.right > window.innerWidth) {
        modalContent.style.left = (window.innerWidth - newRect.width) + 'px';
    }
    
    if (newRect.bottom > window.innerHeight) {
        modalContent.style.top = (window.innerHeight - newRect.height) + 'px';
    }
}

// ========================================
// EVENTOS GLOBAIS
// ========================================

// Ajustar modais quando a janela for redimensionada
window.addEventListener('resize', () => {
    const modalsAbertos = document.querySelectorAll('.resizable-modal[style*="display: block"]');
    modalsAbertos.forEach(modal => {
        ajustarModalParaTela(modal);
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            ajustarConteudoModal(modalContent);
        }
    });
});

// Prevenir comportamentos indesejados durante drag
document.addEventListener('dragstart', (e) => {
    if (isDragging) {
        e.preventDefault();
    }
});

// ========================================
// TORNAR FUNÇÕES GLOBAIS
// ========================================

window.tornarModalRedimensionavel = tornarModalRedimensionavel;
window.centralizarModal = centralizarModal;
window.ajustarModalParaTela = ajustarModalParaTela;
window.toggleMaximizar = toggleMaximizar;

console.log('✅ Sistema de modais redimensionáveis carregado!');


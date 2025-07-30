// ========================================
// CORREÇÃO FINAL - TODOS OS PROBLEMAS
// ========================================

// ========================================
// FUNÇÃO CARREGAR FUNÇÕES (FALTANTE)
// ========================================

let funcoesData = [];

async function carregarFuncoes() {
    try {
        console.log('🔄 Carregando funções...');
        
        const { data, error } = await supabaseClient
            .from('funcoes_hvc')
            .select(`
                *,
                integrantes_hvc(count)
            `)
            .order('nome');
            
        if (error) throw error;
        
        funcoesData = data || [];
        
        console.log('✅ Funções carregadas:', funcoesData.length);
        return funcoesData;
        
    } catch (error) {
        console.error('❌ Erro ao carregar funções:', error);
        funcoesData = [];
        throw error;
    }
}

// ========================================
// FUNÇÃO CARREGAR INTEGRANTES (FALTANTE)
// ========================================

let integrantesData = [];

async function carregarIntegrantes() {
    try {
        console.log('🔄 Carregando integrantes...');
        
        const { data, error } = await supabaseClient
            .from('integrantes_hvc')
            .select(`
                *,
                funcoes_hvc (
                    id,
                    nome
                )
            `)
            .order('nome');
            
        if (error) throw error;
        
        integrantesData = data || [];
        
        console.log('✅ Integrantes carregados:', integrantesData.length);
        return integrantesData;
        
    } catch (error) {
        console.error('❌ Erro ao carregar integrantes:', error);
        integrantesData = [];
        throw error;
    }
}

// ========================================
// FUNÇÃO CARREGAR EQUIPES (FALTANTE)
// ========================================

let equipesData = [];

async function carregarEquipes() {
    try {
        console.log('🔄 Carregando equipes...');
        
        const { data, error } = await supabaseClient
            .from('equipes_hvc')
            .select(`
                *,
                equipe_integrantes (
                    integrantes_hvc (
                        id,
                        nome,
                        funcoes_hvc (
                            nome
                        )
                    )
                )
            `)
            .order('numero');
            
        if (error) throw error;
        
        equipesData = data || [];
        
        console.log('✅ Equipes carregadas:', equipesData.length);
        return equipesData;
        
    } catch (error) {
        console.error('❌ Erro ao carregar equipes:', error);
        equipesData = [];
        throw error;
    }
}

// ========================================
// FUNÇÃO ATUALIZAR ESTATÍSTICAS (FALTANTE)
// ========================================

async function atualizarEstatisticas() {
    try {
        // Garantir que temos dados atualizados
        await Promise.all([
            carregarFuncoes(),
            carregarIntegrantes(),
            carregarEquipes()
        ]);
        
        // Atualizar cards de estatísticas se existirem
        const totalFuncoes = document.getElementById('total-funcoes');
        const totalIntegrantes = document.getElementById('total-integrantes');
        const totalEquipes = document.getElementById('total-equipes');
        
        if (totalFuncoes) totalFuncoes.textContent = funcoesData.length;
        if (totalIntegrantes) totalIntegrantes.textContent = integrantesData.length;
        if (totalEquipes) totalEquipes.textContent = equipesData.length;
        
        console.log('✅ Estatísticas atualizadas');
        
    } catch (error) {
        console.error('❌ Erro ao atualizar estatísticas:', error);
    }
}

// ========================================
// CORREÇÃO DO SISTEMA DE REDIMENSIONAMENTO
// ========================================

// Sobrescrever função para garantir que funcione
function tornarModalRedimensionavel(modal) {
    if (!modal) return;
    
    console.log('🔧 Configurando modal redimensionável...');
    
    const modalContent = modal.querySelector('.modal-content');
    if (!modalContent) return;
    
    // Adicionar classes necessárias
    modal.classList.add('resizable-modal');
    modalContent.classList.add('resizable-content');
    
    // Configurar posicionamento
    modalContent.style.position = 'fixed';
    modalContent.style.resize = 'both';
    modalContent.style.overflow = 'auto';
    modalContent.style.minWidth = '400px';
    modalContent.style.minHeight = '300px';
    modalContent.style.maxWidth = '95vw';
    modalContent.style.maxHeight = '95vh';
    
    // Centralizar
    const rect = modalContent.getBoundingClientRect();
    const left = Math.max(0, (window.innerWidth - rect.width) / 2);
    const top = Math.max(0, (window.innerHeight - rect.height) / 2);
    
    modalContent.style.left = left + 'px';
    modalContent.style.top = top + 'px';
    modalContent.style.margin = '0';
    modalContent.style.transform = 'none';
    
    // Adicionar indicador visual de redimensionamento
    modalContent.style.position = 'relative';
    
    // Criar indicador no canto inferior direito
    const resizeIndicator = document.createElement('div');
    resizeIndicator.style.cssText = `
        position: absolute;
        bottom: 0;
        right: 0;
        width: 20px;
        height: 20px;
        background: linear-gradient(
            -45deg,
            transparent 0%,
            transparent 40%,
            rgba(173, 216, 230, 0.6) 40%,
            rgba(173, 216, 230, 0.6) 60%,
            transparent 60%,
            transparent 100%
        );
        cursor: nw-resize;
        pointer-events: none;
        z-index: 1000;
    `;
    modalContent.appendChild(resizeIndicator);
    
    // Configurar drag do header
    const modalHeader = modal.querySelector('.modal-header');
    if (modalHeader) {
        modalHeader.style.cursor = 'move';
        
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        
        modalHeader.addEventListener('mousedown', (e) => {
            // Não iniciar drag se clicar em botões
            if (e.target.closest('button') || e.target.closest('.close')) {
                return;
            }
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = modalContent.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', stopDrag);
            
            e.preventDefault();
        });
        
        function drag(e) {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            const newLeft = startLeft + deltaX;
            const newTop = startTop + deltaY;
            
            // Limitar às bordas da tela
            const maxLeft = window.innerWidth - modalContent.offsetWidth;
            const maxTop = window.innerHeight - modalContent.offsetHeight;
            
            const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft));
            const constrainedTop = Math.max(0, Math.min(newTop, maxTop));
            
            modalContent.style.left = constrainedLeft + 'px';
            modalContent.style.top = constrainedTop + 'px';
        }
        
        function stopDrag() {
            isDragging = false;
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', stopDrag);
        }
    }
    
    // Adicionar botão de maximizar
    if (modalHeader && !modalHeader.querySelector('.modal-maximize-btn')) {
        const maximizeBtn = document.createElement('button');
        maximizeBtn.className = 'modal-maximize-btn';
        maximizeBtn.innerHTML = '<i class="fas fa-expand-alt"></i>';
        maximizeBtn.title = 'Maximizar/Restaurar';
        maximizeBtn.style.cssText = `
            background: none;
            border: none;
            color: #add8e6;
            font-size: 1.2rem;
            cursor: pointer;
            padding: 0.25rem;
            margin-left: 0.5rem;
            border-radius: 4px;
            transition: all 0.3s ease;
        `;
        
        maximizeBtn.addEventListener('mouseenter', () => {
            maximizeBtn.style.background = 'rgba(173, 216, 230, 0.2)';
            maximizeBtn.style.color = '#ffffff';
        });
        
        maximizeBtn.addEventListener('mouseleave', () => {
            maximizeBtn.style.background = 'none';
            maximizeBtn.style.color = '#add8e6';
        });
        
        maximizeBtn.onclick = (e) => {
            e.stopPropagation();
            
            if (modal.classList.contains('modal-maximized')) {
                // Restaurar
                modal.classList.remove('modal-maximized');
                maximizeBtn.innerHTML = '<i class="fas fa-expand-alt"></i>';
                
                modalContent.style.width = '600px';
                modalContent.style.height = '500px';
                modalContent.style.left = '50%';
                modalContent.style.top = '50%';
                modalContent.style.transform = 'translate(-50%, -50%)';
                modalContent.style.resize = 'both';
                
            } else {
                // Maximizar
                modal.classList.add('modal-maximized');
                maximizeBtn.innerHTML = '<i class="fas fa-compress-alt"></i>';
                
                modalContent.style.width = '95vw';
                modalContent.style.height = '95vh';
                modalContent.style.left = '2.5vw';
                modalContent.style.top = '2.5vh';
                modalContent.style.transform = 'none';
                modalContent.style.resize = 'none';
            }
        };
        
        // Inserir antes do botão de fechar
        const closeBtn = modalHeader.querySelector('.close');
        if (closeBtn) {
            modalHeader.insertBefore(maximizeBtn, closeBtn);
        } else {
            modalHeader.appendChild(maximizeBtn);
        }
    }
    
    console.log('✅ Modal configurado como redimensionável');
}

// ========================================
// VARIÁVEIS GLOBAIS PARA SELEÇÃO
// ========================================

let integrantesSelecionados = new Set();

function toggleIntegrante(integranteId) {
    if (integrantesSelecionados.has(integranteId)) {
        integrantesSelecionados.delete(integranteId);
    } else {
        integrantesSelecionados.add(integranteId);
    }
    
    // Atualizar visual
    const item = document.querySelector(`[onclick*="${integranteId}"]`);
    const checkbox = document.getElementById(`checkbox-${integranteId}`);
    
    if (item) {
        if (integrantesSelecionados.has(integranteId)) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    }
    
    if (checkbox) {
        if (integrantesSelecionados.has(integranteId)) {
            checkbox.classList.add('checked');
        } else {
            checkbox.classList.remove('checked');
        }
    }
    
    // Atualizar contador
    atualizarContadorSelecao();
}

function atualizarContadorSelecao() {
    const counters = document.querySelectorAll('.selection-counter, #selection-counter, #edit-selection-counter');
    counters.forEach(counter => {
        const count = integrantesSelecionados.size;
        counter.textContent = `${count} integrante${count !== 1 ? 's' : ''} selecionado${count !== 1 ? 's' : ''}`;
    });
}

// ========================================
// INICIALIZAÇÃO AUTOMÁTICA
// ========================================

// Executar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando sistema...');
    
    try {
        // Carregar dados iniciais
        await atualizarEstatisticas();
        
        console.log('✅ Sistema inicializado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
    }
});

// ========================================
// TORNAR FUNÇÕES GLOBAIS
// ========================================

window.carregarFuncoes = carregarFuncoes;
window.carregarIntegrantes = carregarIntegrantes;
window.carregarEquipes = carregarEquipes;
window.atualizarEstatisticas = atualizarEstatisticas;
window.tornarModalRedimensionavel = tornarModalRedimensionavel;
window.toggleIntegrante = toggleIntegrante;
window.atualizarContadorSelecao = atualizarContadorSelecao;
window.integrantesSelecionados = integrantesSelecionados;
window.funcoesData = funcoesData;
window.integrantesData = integrantesData;
window.equipesData = equipesData;

console.log('✅ Correção final carregada!');


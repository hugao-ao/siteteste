// ========================================
// CORREÇÃO PARA BOTÃO "NOVA FUNÇÃO"
// ========================================

// Função para abrir modal de nova função
function openNovaFuncaoModal() {
    console.log('🔧 Abrindo modal Nova Função...');
    
    const modalId = 'modal-nova-funcao';
    let modal = document.getElementById(modalId);
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal resizable-modal';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div class="modal-content resizable-content">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i class="fas fa-plus-circle"></i>
                    Nova Função
                </h3>
                <span class="close" onclick="fecharModal('${modalId}')">&times;</span>
            </div>
            <div class="modal-body">
                <form id="form-nova-funcao">
                    <div class="form-group">
                        <label class="form-label">Nome da Função *</label>
                        <input type="text" id="nome-nova-funcao" class="form-input" 
                               placeholder="Ex: Eletricista, Encanador, Aplicador..." required>
                        <small class="form-help">Digite o nome da função que será exercida pelos integrantes</small>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Descrição</label>
                        <textarea id="descricao-nova-funcao" class="form-textarea" 
                                  placeholder="Descreva as responsabilidades e atividades desta função..." rows="4"></textarea>
                        <small class="form-help">Opcional: Descreva as principais atividades desta função</small>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Nível de Experiência</label>
                        <select id="nivel-nova-funcao" class="form-select">
                            <option value="">Selecione o nível</option>
                            <option value="iniciante">Iniciante</option>
                            <option value="intermediario">Intermediário</option>
                            <option value="avancado">Avançado</option>
                            <option value="especialista">Especialista</option>
                        </select>
                        <small class="form-help">Opcional: Nível de experiência requerido para esta função</small>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <select id="status-nova-funcao" class="form-select">
                            <option value="ativa">Ativa</option>
                            <option value="inativa">Inativa</option>
                        </select>
                        <small class="form-help">Status inicial da função</small>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-secondary" onclick="fecharModal('${modalId}')">
                    <i class="fas fa-times"></i>
                    Cancelar
                </button>
                <button type="button" class="btn-primary" onclick="salvarNovaFuncao()">
                    <i class="fas fa-save"></i>
                    Salvar Função
                </button>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
    tornarModalRedimensionavel(modal);
    
    // Focar no campo nome
    setTimeout(() => {
        const nomeInput = document.getElementById('nome-nova-funcao');
        if (nomeInput) nomeInput.focus();
    }, 100);
}

// Função para salvar nova função
async function salvarNovaFuncao() {
    try {
        const nome = document.getElementById('nome-nova-funcao').value.trim();
        const descricao = document.getElementById('descricao-nova-funcao').value.trim();
        const nivel = document.getElementById('nivel-nova-funcao').value;
        const status = document.getElementById('status-nova-funcao').value;
        
        // Validações
        if (!nome) {
            showNotification('Nome da função é obrigatório', 'warning');
            document.getElementById('nome-nova-funcao').focus();
            return;
        }
        
        if (nome.length < 2) {
            showNotification('Nome da função deve ter pelo menos 2 caracteres', 'warning');
            document.getElementById('nome-nova-funcao').focus();
            return;
        }
        
        showLoading('Salvando nova função...');
        
        // Verificar se função já existe
        const { data: existingFuncao, error: checkError } = await supabaseClient
            .from('funcoes_hvc')
            .select('id')
            .ilike('nome', nome)
            .single();
            
        if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
        }
        
        if (existingFuncao) {
            showNotification('Já existe uma função com este nome', 'warning');
            document.getElementById('nome-nova-funcao').focus();
            hideLoading();
            return;
        }
        
        // Salvar nova função
        const novaFuncao = {
            nome: nome,
            descricao: descricao || null,
            nivel: nivel || null,
            status: status || 'ativa',
            created_at: new Date().toISOString()
        };
        
        const { data, error } = await supabaseClient
            .from('funcoes_hvc')
            .insert([novaFuncao])
            .select()
            .single();
            
        if (error) throw error;
        
        showNotification(`Função "${nome}" criada com sucesso!`, 'success');
        
        // Fechar modal
        fecharModal('modal-nova-funcao');
        
        // Recarregar dados
        await carregarFuncoes();
        atualizarEstatisticas();
        
        hideLoading();
        
        console.log('✅ Nova função salva:', data);
        
    } catch (error) {
        console.error('❌ Erro ao salvar nova função:', error);
        showNotification('Erro ao salvar função: ' + error.message, 'error');
        hideLoading();
    }
}

// Função para cancelar nova função
function cancelarNovaFuncao() {
    const confirmacao = confirm('Tem certeza que deseja cancelar? Os dados preenchidos serão perdidos.');
    if (confirmacao) {
        fecharModal('modal-nova-funcao');
    }
}

// ========================================
// CORREÇÃO PARA MODAL GERENCIAR FUNÇÕES
// ========================================

// Função corrigida para abrir modal de gerenciar funções
function openFuncoesModal() {
    console.log('🔧 Abrindo modal Gerenciar Funções...');
    
    const modalId = 'modal-funcoes';
    let modal = document.getElementById(modalId);
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal resizable-modal';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div class="modal-content resizable-content">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i class="fas fa-cogs"></i>
                    Gerenciar Funções
                </h3>
                <span class="close" onclick="fecharModal('${modalId}')">&times;</span>
            </div>
            <div class="modal-body">
                <div class="modal-actions">
                    <button type="button" class="btn-primary" onclick="openNovaFuncaoModal()">
                        <i class="fas fa-plus"></i>
                        Nova Função
                    </button>
                    <button type="button" class="btn-secondary" onclick="atualizarListaFuncoes()">
                        <i class="fas fa-sync-alt"></i>
                        Atualizar Lista
                    </button>
                </div>
                
                <div id="funcoes-loading" class="loading">
                    <div class="spinner"></div>
                    Carregando funções...
                </div>
                
                <div id="funcoes-lista" style="display: none;">
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>FUNÇÃO</th>
                                    <th>INTEGRANTES</th>
                                    <th>NÍVEL</th>
                                    <th>STATUS</th>
                                    <th>AÇÕES</th>
                                </tr>
                            </thead>
                            <tbody id="funcoes-tbody">
                                <!-- Funções serão carregadas aqui -->
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div id="funcoes-vazio" style="display: none;">
                    <div class="empty-state">
                        <i class="fas fa-briefcase"></i>
                        <h4>Nenhuma função cadastrada</h4>
                        <p>Clique em "Nova Função" para começar</p>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-secondary" onclick="fecharModal('${modalId}')">
                    <i class="fas fa-times"></i>
                    Fechar
                </button>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
    tornarModalRedimensionavel(modal);
    
    // Carregar lista de funções
    carregarListaFuncoes();
}

// Função para carregar lista de funções no modal
async function carregarListaFuncoes() {
    const loading = document.getElementById('funcoes-loading');
    const lista = document.getElementById('funcoes-lista');
    const vazio = document.getElementById('funcoes-vazio');
    const tbody = document.getElementById('funcoes-tbody');
    
    if (!loading || !lista || !vazio || !tbody) return;
    
    loading.style.display = 'flex';
    lista.style.display = 'none';
    vazio.style.display = 'none';
    
    try {
        // Carregar funções com contagem de integrantes
        const { data: funcoes, error } = await supabaseClient
            .from('funcoes_hvc')
            .select(`
                *,
                integrantes_hvc(count)
            `)
            .order('nome');
            
        if (error) throw error;
        
        tbody.innerHTML = '';
        
        if (!funcoes || funcoes.length === 0) {
            loading.style.display = 'none';
            vazio.style.display = 'block';
            return;
        }
        
        funcoes.forEach(funcao => {
            const integrantesCount = funcao.integrantes_hvc?.[0]?.count || 0;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="item-info">
                        <div class="item-name">${funcao.nome}</div>
                        ${funcao.descricao ? `<div class="item-description">${funcao.descricao}</div>` : ''}
                    </div>
                </td>
                <td>
                    <span class="badge badge-info">${integrantesCount}</span>
                </td>
                <td>
                    ${funcao.nivel ? `<span class="badge badge-secondary">${funcao.nivel}</span>` : '<span class="text-muted">-</span>'}
                </td>
                <td>
                    <span class="badge ${funcao.status === 'ativa' ? 'badge-success' : 'badge-warning'}">
                        ${funcao.status || 'ativa'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-edit" onclick="editarFuncao('${funcao.id}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action btn-delete" onclick="excluirFuncao('${funcao.id}')" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        loading.style.display = 'none';
        lista.style.display = 'block';
        
    } catch (error) {
        console.error('❌ Erro ao carregar lista de funções:', error);
        showNotification('Erro ao carregar funções: ' + error.message, 'error');
        loading.style.display = 'none';
        vazio.style.display = 'block';
    }
}

// Função para atualizar lista de funções
async function atualizarListaFuncoes() {
    showNotification('Atualizando lista de funções...', 'info');
    await carregarFuncoes(); // Recarregar dados globais
    await carregarListaFuncoes(); // Recarregar lista do modal
    showNotification('Lista atualizada!', 'success');
}

// ========================================
// TORNAR FUNÇÕES GLOBAIS
// ========================================

window.openNovaFuncaoModal = openNovaFuncaoModal;
window.salvarNovaFuncao = salvarNovaFuncao;
window.cancelarNovaFuncao = cancelarNovaFuncao;
window.openFuncoesModal = openFuncoesModal;
window.carregarListaFuncoes = carregarListaFuncoes;
window.atualizarListaFuncoes = atualizarListaFuncoes;

console.log('✅ Correção do botão Nova Função carregada!');


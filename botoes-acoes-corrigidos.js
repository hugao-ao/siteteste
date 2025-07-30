// ========================================
// FUNÇÕES DOS BOTÕES DE AÇÃO - CORREÇÃO
// ========================================

// ========================================
// FUNÇÕES PARA EQUIPES
// ========================================

// Visualizar equipe
async function verEquipe(equipeId) {
    try {
        showLoading('Carregando dados da equipe...');
        
        // Buscar dados completos da equipe
        const { data: equipe, error } = await supabaseClient
            .from('equipes_hvc')
            .select(`
                *,
                equipe_integrantes (
                    integrantes_hvc (
                        id,
                        nome,
                        cpf,
                        whatsapp,
                        funcoes_hvc (
                            nome
                        )
                    )
                )
            `)
            .eq('id', equipeId)
            .single();
            
        if (error) throw error;
        
        hideLoading();
        
        // Criar modal de visualização
        const modalId = 'modal-ver-equipe';
        let modal = document.getElementById(modalId);
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal resizable-modal';
            document.body.appendChild(modal);
        }
        
        const integrantes = equipe.equipe_integrantes || [];
        const integrantesHtml = integrantes.map(ei => {
            const integrante = ei.integrantes_hvc;
            return `
                <div style="background: rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 8px; margin-bottom: 0.5rem;">
                    <div style="font-weight: 600; color: #ffffff; margin-bottom: 0.25rem;">${integrante.nome}</div>
                    <div style="color: #add8e6; font-size: 0.9rem;">${integrante.funcoes_hvc?.nome || 'Função não definida'}</div>
                    <div style="color: rgba(224, 224, 224, 0.7); font-size: 0.8rem;">
                        ${integrante.whatsapp} • ${integrante.cpf}
                    </div>
                </div>
            `;
        }).join('');
        
        modal.innerHTML = `
            <div class="modal-content resizable-content">
                <div class="modal-header">
                    <h3 class="modal-title">
                        <i class="fas fa-eye"></i>
                        Equipe ${equipe.numero}
                    </h3>
                    <span class="close" onclick="fecharModal('${modalId}')">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Número da Equipe</label>
                        <div style="background: rgba(255, 255, 255, 0.1); padding: 0.8rem; border-radius: 6px; color: #ffffff;">
                            ${equipe.numero}
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <div style="background: rgba(255, 255, 255, 0.1); padding: 0.8rem; border-radius: 6px; color: ${equipe.status === 'ativa' ? '#28a745' : '#ffc107'};">
                            ${equipe.status || 'ativa'}
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Integrantes (${integrantes.length})</label>
                        <div style="max-height: 300px; overflow-y: auto;">
                            ${integrantesHtml || '<p style="text-align: center; color: rgba(224, 224, 224, 0.6);">Nenhum integrante</p>'}
                        </div>
                    </div>
                    
                    ${equipe.observacoes ? `
                        <div class="form-group">
                            <label class="form-label">Observações</label>
                            <div style="background: rgba(255, 255, 255, 0.1); padding: 0.8rem; border-radius: 6px; color: #ffffff; white-space: pre-wrap;">
                                ${equipe.observacoes}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="form-group">
                        <label class="form-label">Criada em</label>
                        <div style="background: rgba(255, 255, 255, 0.1); padding: 0.8rem; border-radius: 6px; color: #ffffff;">
                            ${new Date(equipe.created_at).toLocaleString('pt-BR')}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-primary" onclick="editarEquipe('${equipe.id}')">
                        <i class="fas fa-edit"></i>
                        Editar Equipe
                    </button>
                    <button type="button" class="btn-secondary" onclick="fecharModal('${modalId}')">
                        <i class="fas fa-times"></i>
                        Fechar
                    </button>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
        tornarModalRedimensionavel(modal);
        
    } catch (error) {
        console.error('❌ Erro ao visualizar equipe:', error);
        showNotification('Erro ao carregar dados da equipe: ' + error.message, 'error');
        hideLoading();
    }
}

// Editar equipe
async function editarEquipe(equipeId) {
    try {
        showLoading('Carregando dados da equipe...');
        
        // Buscar dados da equipe
        const { data: equipe, error } = await supabaseClient
            .from('equipes_hvc')
            .select(`
                *,
                equipe_integrantes (
                    integrante_id
                )
            `)
            .eq('id', equipeId)
            .single();
            
        if (error) throw error;
        
        hideLoading();
        
        // Fechar modal de visualização se estiver aberto
        const modalVer = document.getElementById('modal-ver-equipe');
        if (modalVer) modalVer.style.display = 'none';
        
        // Abrir modal de edição
        const modalId = 'modal-editar-equipe';
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
                        <i class="fas fa-edit"></i>
                        Editar Equipe ${equipe.numero}
                    </h3>
                    <span class="close" onclick="fecharModal('${modalId}')">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="form-editar-equipe">
                        <input type="hidden" id="edit-equipe-id" value="${equipe.id}">
                        
                        <div class="form-group">
                            <label class="form-label">Número da Equipe *</label>
                            <input type="text" id="edit-numero-equipe" class="form-input" value="${equipe.numero}" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Status</label>
                            <select id="edit-status-equipe" class="form-select">
                                <option value="ativa" ${equipe.status === 'ativa' ? 'selected' : ''}>Ativa</option>
                                <option value="inativa" ${equipe.status === 'inativa' ? 'selected' : ''}>Inativa</option>
                                <option value="pausada" ${equipe.status === 'pausada' ? 'selected' : ''}>Pausada</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Selecionar Integrantes *</label>
                            <div id="edit-integrantes-loading" class="loading">
                                <div class="spinner"></div>
                                Carregando integrantes...
                            </div>
                            <div id="edit-integrantes-selection" style="display: none;">
                                <!-- Integrantes serão carregados aqui -->
                            </div>
                            <div class="selection-counter" id="edit-selection-counter">
                                0 integrantes selecionados
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Observações</label>
                            <textarea id="edit-observacoes-equipe" class="form-textarea" placeholder="Observações sobre a equipe...">${equipe.observacoes || ''}</textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="fecharModal('${modalId}')">
                        <i class="fas fa-times"></i>
                        Cancelar
                    </button>
                    <button type="button" class="btn-primary" onclick="salvarEdicaoEquipe()">
                        <i class="fas fa-save"></i>
                        Salvar Alterações
                    </button>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
        tornarModalRedimensionavel(modal);
        
        // Carregar integrantes para seleção
        await carregarIntegrantesParaEdicao(equipe.equipe_integrantes.map(ei => ei.integrante_id));
        
    } catch (error) {
        console.error('❌ Erro ao editar equipe:', error);
        showNotification('Erro ao carregar dados da equipe: ' + error.message, 'error');
        hideLoading();
    }
}

// Excluir equipe
async function excluirEquipe(equipeId) {
    try {
        // Buscar dados básicos da equipe
        const { data: equipe, error: fetchError } = await supabaseClient
            .from('equipes_hvc')
            .select('numero')
            .eq('id', equipeId)
            .single();
            
        if (fetchError) throw fetchError;
        
        // Confirmar exclusão
        const confirmacao = confirm(`Tem certeza que deseja excluir a Equipe ${equipe.numero}?\n\nEsta ação não pode ser desfeita.`);
        
        if (!confirmacao) return;
        
        showLoading('Excluindo equipe...');
        
        // Excluir equipe (os integrantes serão removidos automaticamente por CASCADE)
        const { error } = await supabaseClient
            .from('equipes_hvc')
            .delete()
            .eq('id', equipeId);
            
        if (error) throw error;
        
        showNotification(`Equipe ${equipe.numero} excluída com sucesso!`, 'success');
        await carregarEquipes();
        atualizarEstatisticas();
        hideLoading();
        
    } catch (error) {
        console.error('❌ Erro ao excluir equipe:', error);
        showNotification('Erro ao excluir equipe: ' + error.message, 'error');
        hideLoading();
    }
}

// ========================================
// FUNÇÕES PARA INTEGRANTES
// ========================================

// Editar integrante
async function editarIntegrante(integranteId) {
    try {
        showLoading('Carregando dados do integrante...');
        
        // Buscar dados do integrante
        const { data: integrante, error } = await supabaseClient
            .from('integrantes_hvc')
            .select('*')
            .eq('id', integranteId)
            .single();
            
        if (error) throw error;
        
        hideLoading();
        
        // Criar modal de edição
        const modalId = 'modal-editar-integrante';
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
                        <i class="fas fa-edit"></i>
                        Editar Integrante
                    </h3>
                    <span class="close" onclick="fecharModal('${modalId}')">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="form-editar-integrante">
                        <input type="hidden" id="edit-integrante-id" value="${integrante.id}">
                        
                        <div class="form-group">
                            <label class="form-label">Nome Completo *</label>
                            <input type="text" id="edit-nome-integrante" class="form-input" value="${integrante.nome}" required>
                        </div>

                        <div class="form-group">
                            <label class="form-label">CPF *</label>
                            <input type="text" id="edit-cpf-integrante" class="form-input" value="${integrante.cpf}" required>
                        </div>

                        <div class="form-group">
                            <label class="form-label">WhatsApp *</label>
                            <input type="text" id="edit-whatsapp-integrante" class="form-input" value="${integrante.whatsapp}" required>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Função *</label>
                            <select id="edit-funcao-integrante" class="form-select" required>
                                <option value="">Selecione uma função</option>
                                <!-- Funções serão carregadas aqui -->
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Observações</label>
                            <textarea id="edit-observacoes-integrante" class="form-textarea" placeholder="Observações sobre o integrante...">${integrante.observacoes || ''}</textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="fecharModal('${modalId}')">
                        <i class="fas fa-times"></i>
                        Cancelar
                    </button>
                    <button type="button" class="btn-primary" onclick="salvarEdicaoIntegrante()">
                        <i class="fas fa-save"></i>
                        Salvar Alterações
                    </button>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
        tornarModalRedimensionavel(modal);
        
        // Carregar funções no select
        await carregarFuncoesParaEdicao(integrante.funcao_id);
        
        // Configurar formatação
        const cpfInput = document.getElementById('edit-cpf-integrante');
        const whatsappInput = document.getElementById('edit-whatsapp-integrante');
        
        cpfInput.addEventListener('input', function(e) {
            e.target.value = formatCPF(e.target.value);
        });
        
        whatsappInput.addEventListener('input', function(e) {
            e.target.value = formatWhatsApp(e.target.value);
        });
        
    } catch (error) {
        console.error('❌ Erro ao editar integrante:', error);
        showNotification('Erro ao carregar dados do integrante: ' + error.message, 'error');
        hideLoading();
    }
}

// Excluir integrante
async function excluirIntegrante(integranteId) {
    try {
        // Buscar dados básicos do integrante
        const { data: integrante, error: fetchError } = await supabaseClient
            .from('integrantes_hvc')
            .select('nome')
            .eq('id', integranteId)
            .single();
            
        if (fetchError) throw fetchError;
        
        // Confirmar exclusão
        const confirmacao = confirm(`Tem certeza que deseja excluir o integrante "${integrante.nome}"?\n\nEsta ação não pode ser desfeita e o integrante será removido de todas as equipes.`);
        
        if (!confirmacao) return;
        
        showLoading('Excluindo integrante...');
        
        // Excluir integrante (será removido automaticamente das equipes por CASCADE)
        const { error } = await supabaseClient
            .from('integrantes_hvc')
            .delete()
            .eq('id', integranteId);
            
        if (error) throw error;
        
        showNotification(`Integrante "${integrante.nome}" excluído com sucesso!`, 'success');
        await carregarIntegrantes();
        await carregarEquipes(); // Recarregar equipes para atualizar contadores
        atualizarEstatisticas();
        hideLoading();
        
    } catch (error) {
        console.error('❌ Erro ao excluir integrante:', error);
        showNotification('Erro ao excluir integrante: ' + error.message, 'error');
        hideLoading();
    }
}

// ========================================
// FUNÇÕES PARA FUNÇÕES
// ========================================

// Excluir função
async function excluirFuncao(funcaoId) {
    try {
        // Verificar se há integrantes usando esta função
        const { data: integrantes, error: checkError } = await supabaseClient
            .from('integrantes_hvc')
            .select('id')
            .eq('funcao_id', funcaoId);
            
        if (checkError) throw checkError;
        
        if (integrantes && integrantes.length > 0) {
            showNotification(`Não é possível excluir esta função pois há ${integrantes.length} integrante(s) usando ela.`, 'warning');
            return;
        }
        
        // Buscar dados básicos da função
        const { data: funcao, error: fetchError } = await supabaseClient
            .from('funcoes_hvc')
            .select('nome')
            .eq('id', funcaoId)
            .single();
            
        if (fetchError) throw fetchError;
        
        // Confirmar exclusão
        const confirmacao = confirm(`Tem certeza que deseja excluir a função "${funcao.nome}"?\n\nEsta ação não pode ser desfeita.`);
        
        if (!confirmacao) return;
        
        showLoading('Excluindo função...');
        
        // Excluir função
        const { error } = await supabaseClient
            .from('funcoes_hvc')
            .delete()
            .eq('id', funcaoId);
            
        if (error) throw error;
        
        showNotification(`Função "${funcao.nome}" excluída com sucesso!`, 'success');
        await carregarFuncoes();
        atualizarEstatisticas();
        hideLoading();
        
    } catch (error) {
        console.error('❌ Erro ao excluir função:', error);
        showNotification('Erro ao excluir função: ' + error.message, 'error');
        hideLoading();
    }
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

// Carregar integrantes para edição de equipe
async function carregarIntegrantesParaEdicao(integrantesSelecionadosIds = []) {
    const loading = document.getElementById('edit-integrantes-loading');
    const container = document.getElementById('edit-integrantes-selection');
    
    loading.style.display = 'flex';
    container.style.display = 'none';
    
    try {
        // Garantir que temos os dados mais recentes
        await carregarIntegrantes();
        
        container.innerHTML = '';
        
        // Limpar seleções anteriores
        integrantesSelecionados.clear();
        
        if (integrantesData.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: rgba(224, 224, 224, 0.6);">Nenhum integrante cadastrado</p>';
        } else {
            integrantesData.forEach(integrante => {
                const isSelected = integrantesSelecionadosIds.includes(integrante.id);
                if (isSelected) {
                    integrantesSelecionados.add(integrante.id);
                }
                
                const item = document.createElement('div');
                item.className = `integrante-item ${isSelected ? 'selected' : ''}`;
                item.onclick = () => toggleIntegrante(integrante.id);
                
                item.innerHTML = `
                    <div class="integrante-checkbox ${isSelected ? 'checked' : ''}" id="checkbox-${integrante.id}"></div>
                    <div class="integrante-info">
                        <div class="integrante-nome">${integrante.nome}</div>
                        <div class="integrante-funcao">${integrante.funcoes_hvc?.nome || 'Função não definida'}</div>
                        <div class="integrante-contato">${integrante.whatsapp}</div>
                    </div>
                `;
                
                container.appendChild(item);
            });
        }
        
        loading.style.display = 'none';
        container.style.display = 'block';
        atualizarContadorSelecaoEdicao();
        
    } catch (error) {
        console.error('❌ Erro ao carregar integrantes para edição:', error);
        showNotification('Erro ao carregar integrantes', 'error');
        loading.style.display = 'none';
    }
}

// Carregar funções para edição de integrante
async function carregarFuncoesParaEdicao(funcaoSelecionadaId) {
    const select = document.getElementById('edit-funcao-integrante');
    if (!select) return;
    
    // Limpar opções existentes (exceto a primeira)
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }
    
    // Adicionar funções
    funcoesData.forEach(funcao => {
        const option = document.createElement('option');
        option.value = funcao.id;
        option.textContent = funcao.nome;
        if (funcao.id === funcaoSelecionadaId) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

// Atualizar contador de seleção na edição
function atualizarContadorSelecaoEdicao() {
    const counter = document.getElementById('edit-selection-counter');
    if (counter) {
        const count = integrantesSelecionados.size;
        counter.textContent = `${count} integrante${count !== 1 ? 's' : ''} selecionado${count !== 1 ? 's' : ''}`;
    }
}

// Salvar edição de equipe
async function salvarEdicaoEquipe() {
    try {
        const equipeId = document.getElementById('edit-equipe-id').value;
        const numero = document.getElementById('edit-numero-equipe').value.trim();
        const status = document.getElementById('edit-status-equipe').value;
        const observacoes = document.getElementById('edit-observacoes-equipe').value.trim();
        
        // Validações
        if (!numero) {
            showNotification('Número da equipe é obrigatório', 'warning');
            return;
        }
        
        if (integrantesSelecionados.size === 0) {
            showNotification('Selecione pelo menos um integrante', 'warning');
            return;
        }
        
        showLoading('Salvando alterações...');
        
        // Verificar se número já existe (exceto para esta equipe)
        const { data: existingEquipe } = await supabaseClient
            .from('equipes_hvc')
            .select('id')
            .eq('numero', numero)
            .neq('id', equipeId)
            .single();
            
        if (existingEquipe) {
            showNotification('Número de equipe já existe', 'warning');
            hideLoading();
            return;
        }
        
        // Atualizar equipe
        const { error: equipeError } = await supabaseClient
            .from('equipes_hvc')
            .update({
                numero: numero,
                status: status,
                observacoes: observacoes || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', equipeId);
            
        if (equipeError) throw equipeError;
        
        // Remover integrantes antigos
        const { error: removeError } = await supabaseClient
            .from('equipe_integrantes')
            .delete()
            .eq('equipe_id', equipeId);
            
        if (removeError) throw removeError;
        
        // Adicionar novos integrantes
        const integrantesEquipe = Array.from(integrantesSelecionados).map(integranteId => ({
            equipe_id: equipeId,
            integrante_id: integranteId
        }));
        
        const { error: integrantesError } = await supabaseClient
            .from('equipe_integrantes')
            .insert(integrantesEquipe);
            
        if (integrantesError) throw integrantesError;
        
        showNotification('Equipe atualizada com sucesso!', 'success');
        fecharModal('modal-editar-equipe');
        await carregarEquipes();
        hideLoading();
        
    } catch (error) {
        console.error('❌ Erro ao salvar edição da equipe:', error);
        showNotification('Erro ao salvar alterações: ' + error.message, 'error');
        hideLoading();
    }
}

// Salvar edição de integrante
async function salvarEdicaoIntegrante() {
    try {
        const integranteId = document.getElementById('edit-integrante-id').value;
        const nome = document.getElementById('edit-nome-integrante').value.trim();
        const cpf = document.getElementById('edit-cpf-integrante').value.trim();
        const whatsapp = document.getElementById('edit-whatsapp-integrante').value.trim();
        const funcaoId = document.getElementById('edit-funcao-integrante').value;
        const observacoes = document.getElementById('edit-observacoes-integrante').value.trim();
        
        // Validações
        if (!nome || !cpf || !whatsapp || !funcaoId) {
            showNotification('Todos os campos obrigatórios devem ser preenchidos', 'warning');
            return;
        }
        
        showLoading('Salvando alterações...');
        
        // Verificar se CPF já existe (exceto para este integrante)
        const { data: existingIntegrante } = await supabaseClient
            .from('integrantes_hvc')
            .select('id')
            .eq('cpf', cpf)
            .neq('id', integranteId)
            .single();
            
        if (existingIntegrante) {
            showNotification('CPF já cadastrado para outro integrante', 'warning');
            hideLoading();
            return;
        }
        
        // Atualizar integrante
        const { error } = await supabaseClient
            .from('integrantes_hvc')
            .update({
                nome: nome,
                cpf: cpf,
                whatsapp: whatsapp,
                funcao_id: funcaoId,
                observacoes: observacoes || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', integranteId);
            
        if (error) throw error;
        
        showNotification('Integrante atualizado com sucesso!', 'success');
        fecharModal('modal-editar-integrante');
        await carregarIntegrantes();
        await carregarEquipes(); // Recarregar equipes para atualizar dados
        hideLoading();
        
    } catch (error) {
        console.error('❌ Erro ao salvar edição do integrante:', error);
        showNotification('Erro ao salvar alterações: ' + error.message, 'error');
        hideLoading();
    }
}

// Fechar modal genérico
function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// ========================================
// TORNAR FUNÇÕES GLOBAIS
// ========================================

window.verEquipe = verEquipe;
window.editarEquipe = editarEquipe;
window.excluirEquipe = excluirEquipe;
window.editarIntegrante = editarIntegrante;
window.excluirIntegrante = excluirIntegrante;
window.excluirFuncao = excluirFuncao;
window.salvarEdicaoEquipe = salvarEdicaoEquipe;
window.salvarEdicaoIntegrante = salvarEdicaoIntegrante;
window.fecharModal = fecharModal;

console.log('✅ Funções dos botões de ação carregadas!');


// servicos-hvc.js - Versão SIMPLIFICADA - Sem importações complexas

class ServicosManager {
    constructor() {
        this.currentServicoId = null;
        this.allServicos = [];
        this.isEditing = false;
        this.supabase = null;
    }

    async init() {
        console.log('Inicializando ServicosManager...');
        
        try {
            // Aguardar o Supabase de forma mais simples
            await this.waitForSupabase();

            // Carregar dados iniciais
            await this.loadServicos();

            // Configurar event listeners
            this.setupEventListeners();

            console.log('ServicosManager inicializado com sucesso!');
        } catch (error) {
            console.error('Erro ao inicializar ServicosManager:', error);
            this.showNotification('Erro ao inicializar sistema: ' + error.message, 'error');
        }
    }

    async waitForSupabase() {
        console.log('Procurando Supabase...');
        
        // Tentar diferentes formas de acessar o Supabase
        if (window.supabaseClient) {
            this.supabase = window.supabaseClient;
            console.log('Supabase encontrado em window.supabaseClient');
            return;
        }
        
        if (window.supabase) {
            this.supabase = window.supabase;
            console.log('Supabase encontrado em window.supabase');
            return;
        }
        
        // Aguardar um pouco e tentar novamente
        for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (window.supabaseClient) {
                this.supabase = window.supabaseClient;
                console.log('Supabase encontrado em window.supabaseClient após aguardar');
                return;
            }
            
            if (window.supabase) {
                this.supabase = window.supabase;
                console.log('Supabase encontrado em window.supabase após aguardar');
                return;
            }
            
            console.log(`Tentativa ${i + 1}: Supabase ainda não encontrado...`);
        }
        
        throw new Error('Supabase não encontrado. Verifique se o arquivo supabase.js está carregando corretamente.');
    }

    setupEventListeners() {
        console.log('Configurando event listeners...');
        
        try {
            // Formulário de serviço
            const formServico = document.getElementById('service-form');
            if (formServico) {
                formServico.addEventListener('submit', (e) => this.handleSubmitServico(e));
            }

            // Botão cancelar
            const btnCancel = document.getElementById('cancel-btn');
            if (btnCancel) {
                btnCancel.addEventListener('click', () => this.cancelEdit());
            }

            // Campo de busca
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => this.filterServicos(e.target.value));
            }

            console.log('Event listeners configurados!');
        } catch (error) {
            console.error('Erro ao configurar event listeners:', error);
        }
    }

    // === CARREGAMENTO DE SERVIÇOS ===
    async loadServicos() {
        try {
            console.log('Carregando serviços...');
            
            const { data, error } = await this.supabase
                .from('servicos_hvc')
                .select('*')
                .order('codigo');

            if (error) {
                console.error('Erro do Supabase:', error);
                throw error;
            }

            this.allServicos = data || [];
            this.renderServicos(this.allServicos);
            console.log('Serviços carregados:', data?.length || 0);
            
            // Mostrar/esconder estado vazio
            this.toggleEmptyState();
            
        } catch (error) {
            console.error('Erro ao carregar serviços:', error);
            this.showNotification('Erro ao carregar serviços: ' + error.message, 'error');
            this.renderServicos([]); // Renderizar lista vazia em caso de erro
        }
    }

    renderServicos(servicos) {
        const tbody = document.getElementById('services-table-body');
        if (!tbody) {
            console.error('Tbody de serviços não encontrado');
            return;
        }
        
        tbody.innerHTML = '';

        if (servicos.length === 0) {
            this.toggleEmptyState(true);
            return;
        }

        this.toggleEmptyState(false);

        servicos.forEach(servico => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${servico.codigo || ''}</strong></td>
                <td>${servico.descricao || ''}</td>
                <td>${servico.detalhe || '-'}</td>
                <td>${servico.unidade || '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-edit btn-small" 
                                onclick="window.servicosManager.editServico('${servico.id}')"
                                title="Editar serviço">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-small" 
                                onclick="window.servicosManager.showDeleteModal('${servico.id}', '${servico.codigo}')"
                                title="Excluir serviço">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    toggleEmptyState(show = null) {
        const emptyState = document.getElementById('empty-state');
        const tableContainer = document.querySelector('.table-container');
        
        if (!emptyState || !tableContainer) return;
        
        const shouldShow = show !== null ? show : this.allServicos.length === 0;
        
        if (shouldShow) {
            emptyState.style.display = 'block';
            tableContainer.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            tableContainer.style.display = 'block';
        }
    }

    // === FILTRO DE SERVIÇOS ===
    filterServicos(searchTerm) {
        if (!searchTerm.trim()) {
            this.renderServicos(this.allServicos);
            return;
        }

        const filtered = this.allServicos.filter(servico => {
            const codigo = (servico.codigo || '').toLowerCase();
            const descricao = (servico.descricao || '').toLowerCase();
            const detalhe = (servico.detalhe || '').toLowerCase();
            const term = searchTerm.toLowerCase();
            
            return codigo.includes(term) || 
                   descricao.includes(term) || 
                   detalhe.includes(term);
        });

        this.renderServicos(filtered);
    }

    // === CRUD DE SERVIÇOS ===
    async handleSubmitServico(e) {
        e.preventDefault();

        if (!this.validateForm()) return;

        const servicoData = {
            codigo: document.getElementById('service-code').value.trim(),
            descricao: document.getElementById('service-description').value.trim(),
            detalhe: document.getElementById('service-detail').value.trim() || null,
            unidade: document.getElementById('service-unit').value || null
        };

        try {
            let result;
            
            if (this.isEditing && this.currentServicoId) {
                // Atualizar serviço existente
                result = await this.supabase
                    .from('servicos_hvc')
                    .update(servicoData)
                    .eq('id', this.currentServicoId)
                    .select();
                
                if (result.error) throw result.error;
                
                this.showNotification('Serviço atualizado com sucesso!', 'success');
            } else {
                // Criar novo serviço
                result = await this.supabase
                    .from('servicos_hvc')
                    .insert([servicoData])
                    .select();
                
                if (result.error) throw result.error;
                
                this.showNotification('Serviço criado com sucesso!', 'success');
            }

            // Recarregar lista e limpar formulário
            await this.loadServicos();
            this.clearForm();

        } catch (error) {
            console.error('Erro ao salvar serviço:', error);
            
            // Verificar se é erro de código duplicado
            if (error.code === '23505' || error.message.includes('duplicate')) {
                this.showNotification('Erro: Já existe um serviço com este código!', 'error');
            } else {
                this.showNotification('Erro ao salvar serviço: ' + error.message, 'error');
            }
        }
    }

    validateForm() {
        const codigo = document.getElementById('service-code').value.trim();
        const descricao = document.getElementById('service-description').value.trim();

        // Limpar mensagens de erro anteriores
        document.querySelectorAll('.error-message').forEach(el => el.style.display = 'none');

        let isValid = true;

        if (!codigo) {
            const codeError = document.getElementById('code-error');
            if (codeError) codeError.style.display = 'block';
            isValid = false;
        }

        if (!descricao) {
            const descError = document.getElementById('description-error');
            if (descError) descError.style.display = 'block';
            isValid = false;
        }

        return isValid;
    }

    async editServico(servicoId) {
        try {
            const { data, error } = await this.supabase
                .from('servicos_hvc')
                .select('*')
                .eq('id', servicoId)
                .single();

            if (error) throw error;

            if (!data) {
                this.showNotification('Serviço não encontrado!', 'error');
                return;
            }

            // Preencher formulário
            document.getElementById('service-code').value = data.codigo || '';
            document.getElementById('service-description').value = data.descricao || '';
            document.getElementById('service-detail').value = data.detalhe || '';
            document.getElementById('service-unit').value = data.unidade || '';

            // Configurar modo de edição
            this.isEditing = true;
            this.currentServicoId = servicoId;

            // Atualizar interface
            const formTitle = document.getElementById('form-title');
            if (formTitle) {
                formTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Serviço';
            }
            
            const submitBtn = document.getElementById('submit-btn');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar Serviço';
            }
            
            const cancelBtn = document.getElementById('cancel-btn');
            if (cancelBtn) {
                cancelBtn.style.display = 'inline-flex';
            }

            // Scroll para o formulário
            const serviceForm = document.getElementById('service-form');
            if (serviceForm) {
                serviceForm.scrollIntoView({ behavior: 'smooth' });
            }

        } catch (error) {
            console.error('Erro ao carregar serviço para edição:', error);
            this.showNotification('Erro ao carregar serviço: ' + error.message, 'error');
        }
    }

    cancelEdit() {
        this.clearForm();
    }

    clearForm() {
        // Limpar campos
        const form = document.getElementById('service-form');
        if (form) {
            form.reset();
        }
        
        // Limpar mensagens de erro
        document.querySelectorAll('.error-message').forEach(el => el.style.display = 'none');

        // Resetar modo de edição
        this.isEditing = false;
        this.currentServicoId = null;

        // Restaurar interface
        const formTitle = document.getElementById('form-title');
        if (formTitle) {
            formTitle.innerHTML = '<i class="fas fa-plus"></i> Adicionar Novo Serviço';
        }
        
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Serviço';
        }
        
        const cancelBtn = document.getElementById('cancel-btn');
        if (cancelBtn) {
            cancelBtn.style.display = 'none';
        }
    }

    // === EXCLUSÃO DE SERVIÇOS ===
    showDeleteModal(servicoId, servicoCodigo) {
        this.currentServicoId = servicoId;
        
        // Atualizar texto do modal
        const deleteServiceName = document.getElementById('delete-service-name');
        if (deleteServiceName) {
            deleteServiceName.textContent = servicoCodigo;
        }
        
        // Mostrar modal
        const modal = document.getElementById('delete-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
        
        // Configurar botões do modal
        const confirmDelete = document.getElementById('confirm-delete');
        if (confirmDelete) {
            confirmDelete.onclick = () => this.confirmDelete();
        }
        
        const cancelDelete = document.getElementById('cancel-delete');
        if (cancelDelete) {
            cancelDelete.onclick = () => this.hideDeleteModal();
        }
    }

    hideDeleteModal() {
        const modal = document.getElementById('delete-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentServicoId = null;
    }

    async confirmDelete() {
        if (!this.currentServicoId) return;

        try {
            const { error } = await this.supabase
                .from('servicos_hvc')
                .delete()
                .eq('id', this.currentServicoId);

            if (error) throw error;

            this.hideDeleteModal();
            await this.loadServicos();
            this.showNotification('Serviço excluído com sucesso!', 'success');

        } catch (error) {
            console.error('Erro ao excluir serviço:', error);
            
            // Verificar se é erro de constraint (serviço sendo usado)
            if (error.code === '23503') {
                this.showNotification('Erro: Este serviço não pode ser excluído pois está sendo usado em propostas!', 'error');
            } else {
                this.showNotification('Erro ao excluir serviço: ' + error.message, 'error');
            }
        }
    }

    // === NOTIFICAÇÕES ===
    showNotification(message, type = 'info') {
        // Mostrar mensagem de sucesso na interface (usando o padrão da página)
        const successMessage = document.getElementById('success-message');
        const successText = document.getElementById('success-text');
        
        if (successMessage && successText) {
            successText.textContent = message;
            successMessage.className = `success-message ${type === 'error' ? 'error-message' : ''}`;
            successMessage.style.display = 'block';
            
            // Esconder após 5 segundos
            setTimeout(() => {
                successMessage.style.display = 'none';
            }, 5000);
        } else {
            // Fallback: criar notificação flutuante
            this.createFloatingNotification(message, type);
        }
        
        // Log no console
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    createFloatingNotification(message, type) {
        // Remover notificações existentes
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        // Criar nova notificação
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;

        // Adicionar estilos inline
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: space-between;
            min-width: 300px;
            max-width: 500px;
            animation: slideIn 0.3s ease-out;
        `;

        // Adicionar ao body
        document.body.appendChild(notification);

        // Remover automaticamente após 5 segundos
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    getNotificationColor(type) {
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        return colors[type] || colors.info;
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM carregado, inicializando ServicosManager...');
    
    try {
        window.servicosManager = new ServicosManager();
        await window.servicosManager.init();
    } catch (error) {
        console.error('Erro ao inicializar ServicosManager:', error);
    }
});

// Expor globalmente para uso nos event handlers inline
window.servicosManager = null;


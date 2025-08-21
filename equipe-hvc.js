// ========================================
// SISTEMA DE EQUIPES HVC - VERSÃO CORRIGIDA COM FILTROS
// ========================================

// Aguardar carregamento do Supabase
let supabaseClient = null;
let integrantesData = [];
let equipesData = [];
let funcoesData = [];
let integrantesSelecionados = new Set();

// ========================================
// INICIALIZAÇÃO
// ========================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Iniciando sistema de equipes HVC...');
    
    // Aguardar Supabase estar disponível
    await waitForSupabase();
    
    // Carregar dados iniciais
    await carregarDadosIniciais();
    
    // Configurar eventos
    configurarEventos();
    
    console.log('✅ Sistema de equipes HVC inicializado!');
});

// Aguardar Supabase estar disponível
async function waitForSupabase() {
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
        if (window.supabase || window.supabaseClient) {
            supabaseClient = window.supabase || window.supabaseClient;
            console.log('✅ Supabase conectado!');
            return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    console.error('❌ Timeout aguardando Supabase');
    showNotification('Erro ao conectar com o banco de dados', 'error');
}

// ========================================
// CARREGAMENTO DE DADOS
// ========================================

async function carregarDadosIniciais() {
    try {
        showLoading('Carregando dados...');
        
        // Carregar em paralelo para melhor performance
        const [funcoes, integrantes, equipes] = await Promise.all([
            carregarFuncoes(),
            carregarIntegrantes(),
            carregarEquipes()
        ]);
        
        // Atualizar estatísticas
        atualizarEstatisticas();
        
        hideLoading();
        console.log('✅ Dados carregados com sucesso');
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        showNotification('Erro ao carregar dados: ' + error.message, 'error');
        hideLoading();
    }
}

async function carregarFuncoes() {
    try {
        const { data, error } = await supabaseClient
            .from('funcoes_hvc')
            .select('*')
            .order('nome');
            
        if (error) throw error;
        
        funcoesData = data || [];
        atualizarSelectFuncoes();
        atualizarSelectFiltroFuncoes();
        atualizarTabelaFuncoes();
        
        return data;
    } catch (error) {
        console.error('❌ Erro ao carregar funções:', error);
        throw error;
    }
}

async function carregarIntegrantes() {
    try {
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
        atualizarTabelaIntegrantes();
        
        return data;
    } catch (error) {
        console.error('❌ Erro ao carregar integrantes:', error);
        throw error;
    }
}

async function carregarEquipes() {
    try {
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
        atualizarTabelaEquipes();
        
        return data;
    } catch (error) {
        console.error('❌ Erro ao carregar equipes:', error);
        throw error;
    }
}

// ========================================
// ATUALIZAÇÃO DE INTERFACE
// ========================================

function atualizarEstatisticas() {
    const totalIntegrantes = document.getElementById('total-integrantes');
    const totalEquipes = document.getElementById('total-equipes');
    const totalFuncoes = document.getElementById('total-funcoes');
    
    if (totalIntegrantes) totalIntegrantes.textContent = integrantesData.length;
    if (totalEquipes) totalEquipes.textContent = equipesData.length;
    if (totalFuncoes) totalFuncoes.textContent = funcoesData.length;
}

function atualizarSelectFuncoes() {
    const select = document.getElementById('integrante-funcao');
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
        select.appendChild(option);
    });
}

function atualizarSelectFiltroFuncoes() {
    const select = document.getElementById('filtro-funcao-integrante');
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
        select.appendChild(option);
    });
}

function atualizarTabelaIntegrantes() {
    const tbody = document.querySelector('#tabela-integrantes tbody');
    if (!tbody) return;
    
    if (integrantesData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-user"></i>
                    <h3>Nenhum integrante cadastrado</h3>
                    <p>Clique em "Novo Integrante" para começar</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = integrantesData.map(integrante => {
        const funcaoNome = integrante.funcoes_hvc?.nome || 'Sem função';
        const status = integrante.status || 'ativo';
        const whatsappFormatado = formatWhatsAppFromDatabase(integrante.whatsapp);
        
        return `
            <tr>
                <td><strong>${integrante.nome}</strong></td>
                <td>${integrante.cpf}</td>
                <td>${whatsappFormatado || '-'}</td>
                <td>
                    <span class="status-badge status-ativo">${funcaoNome}</span>
                </td>
                <td>
                    <span class="status-badge status-${status}">${status}</span>
                </td>
                <td>${integrante.observacoes || '-'}</td>
                <td class="actions-cell">
                    <button class="btn-info btn-sm" onclick="editarIntegrante('${integrante.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger btn-sm" onclick="excluirIntegrante('${integrante.id}', '${integrante.nome}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function atualizarTabelaEquipes() {
    const tbody = document.querySelector('#tabela-equipes tbody');
    if (!tbody) return;
    
    if (equipesData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>Nenhuma equipe cadastrada</h3>
                    <p>Clique em "Nova Equipe" para começar</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = equipesData.map(equipe => {
        const integrantes = equipe.equipe_integrantes || [];
        const qtdIntegrantes = integrantes.length;
        
        return `
            <tr>
                <td><strong>${equipe.numero}</strong></td>
                <td>
                    <span class="status-badge ${qtdIntegrantes > 0 ? 'status-ativo' : 'status-inativo'}">
                        ${qtdIntegrantes} integrante${qtdIntegrantes !== 1 ? 's' : ''}
                    </span>
                </td>
                <td>
                    <span class="status-badge status-${equipe.status}">
                        ${equipe.status}
                    </span>
                </td>
                <td>${equipe.observacoes || '-'}</td>
                <td class="actions-cell">
                    <button class="btn-info btn-sm" onclick="visualizarEquipe('${equipe.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-warning btn-sm" onclick="editarEquipe('${equipe.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger btn-sm" onclick="excluirEquipe('${equipe.id}', '${equipe.numero}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function atualizarTabelaFuncoes() {
    const tbody = document.querySelector('#tabela-funcoes tbody');
    if (!tbody) return;
    
    if (funcoesData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    <i class="fas fa-cog"></i>
                    <h3>Nenhuma função cadastrada</h3>
                    <p>Adicione uma nova função acima</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = funcoesData.map(funcao => {
        const qtdIntegrantes = integrantesData.filter(i => i.funcao_id === funcao.id).length;
        
        return `
            <tr>
                <td><strong>${funcao.nome}</strong></td>
                <td>${funcao.descricao || '-'}</td>
                <td>
                    <span class="status-badge ${qtdIntegrantes > 0 ? 'status-ativo' : 'status-inativo'}">
                        ${qtdIntegrantes}
                    </span>
                </td>
                <td class="actions-cell">
                    <button class="btn-danger btn-sm" onclick="excluirFuncao('${funcao.id}', '${funcao.nome}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ========================================
// MODAIS
// ========================================

function openEquipeModal() {
    document.getElementById('modal-equipe').classList.add('show');
    carregarIntegrantesParaSelecao();
    limparFormularioEquipe();
}

function closeEquipeModal() {
    document.getElementById('modal-equipe').classList.remove('show');
    integrantesSelecionados.clear();
}

function openIntegranteModal() {
    document.getElementById('modal-integrante').classList.add('show');
    limparFormularioIntegrante();
}

function closeIntegranteModal() {
    document.getElementById('modal-integrante').classList.remove('show');
}

function openFuncoesModal() {
    document.getElementById('modal-funcoes').classList.add('show');
    atualizarTabelaFuncoes();
}

function closeFuncoesModal() {
    document.getElementById('modal-funcoes').classList.remove('show');
}

// ========================================
// SELEÇÃO DE INTEGRANTES
// ========================================

async function carregarIntegrantesParaSelecao() {
    const container = document.getElementById('integrantes-container');
    if (!container) return;
    
    try {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #6c757d;">
                <i class="fas fa-spinner fa-spin"></i>
                Carregando integrantes...
            </div>
        `;

        // Garantir que temos os dados mais recentes
        await carregarIntegrantes();
        
        if (integrantesData.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #6c757d;">
                    <i class="fas fa-user-plus"></i>
                    <h3>Nenhum integrante ativo</h3>
                    <p>Cadastre integrantes ativos primeiro para formar equipes</p>
                </div>
            `;
            return;
        }

        container.innerHTML = integrantesData.map(integrante => {
            const funcaoNome = integrante.funcoes_hvc?.nome || 'Sem função';
            const whatsappFormatado = formatWhatsAppFromDatabase(integrante.whatsapp);
            
            return `
                <div class="multi-select-item" data-integrante-id="${integrante.id}">
                    <div style="display: flex; align-items: center; width: 100%;">
                        <div style="
                            width: 20px;
                            height: 20px;
                            border: 2px solid #4CAF50;
                            border-radius: 4px;
                            margin-right: 12px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            background: transparent;
                            transition: all 0.3s ease;
                        " class="custom-checkbox">
                            <i class="fas fa-check" style="color: #4CAF50; font-size: 12px; display: none;"></i>
                        </div>
                        
                        <div style="flex: 1;">
                            <div style="font-weight: bold; color: #fff; margin-bottom: 4px;">
                                ${integrante.nome}
                            </div>
                            <div style="font-size: 12px; color: #add8e6; display: flex; gap: 15px;">
                                <span><i class="fas fa-briefcase" style="margin-right: 5px;"></i> ${funcaoNome}</span>
                                <span><i class="fas fa-phone" style="margin-right: 5px;"></i> ${whatsappFormatado || 'Sem WhatsApp'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        adicionarEventosSelecao();
        
    } catch (error) {
        console.error('❌ Erro ao carregar integrantes:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <i class="fas fa-exclamation-triangle" style="color: #dc3545;"></i>
                <h3 style="color: #dc3545;">Erro ao carregar</h3>
                <p style="color: #6c757d;">${error.message}</p>
            </div>
        `;
    }
}

function adicionarEventosSelecao() {
    const items = document.querySelectorAll('.multi-select-item');
    
    items.forEach(item => {
        item.addEventListener('click', function() {
            const integranteId = this.dataset.integranteId;
            const checkbox = this.querySelector('.custom-checkbox');
            const checkIcon = checkbox.querySelector('i');
            
            if (integrantesSelecionados.has(integranteId)) {
                // Desmarcar
                integrantesSelecionados.delete(integranteId);
                this.classList.remove('selected');
                checkbox.style.background = 'transparent';
                checkIcon.style.display = 'none';
            } else {
                // Marcar
                integrantesSelecionados.add(integranteId);
                this.classList.add('selected');
                checkbox.style.background = '#4CAF50';
                checkIcon.style.display = 'block';
            }
            
            atualizarContadorSelecionados();
        });
    });
}

function atualizarContadorSelecionados() {
    const contador = document.getElementById('contador-selecionados');
    if (contador) {
        contador.textContent = integrantesSelecionados.size;
    }
}

// ========================================
// SALVAMENTO
// ========================================

async function saveEquipe() {
    try {
        const numero = document.getElementById('equipe-numero').value.trim();
        const status = document.getElementById('equipe-status').value;
        const observacoes = document.getElementById('equipe-observacoes').value.trim();

        if (!numero) {
            showNotification('Por favor, informe o número da equipe', 'error');
            return;
        }

        if (integrantesSelecionados.size === 0) {
            showNotification('Selecione pelo menos um integrante para a equipe', 'error');
            return;
        }

        showLoading('Salvando equipe...');

        // Verificar se número já existe
        const { data: existente } = await supabaseClient
            .from('equipes_hvc')
            .select('id')
            .eq('numero', numero)
            .single();

        if (existente) {
            hideLoading();
            showNotification('Já existe uma equipe com este número', 'error');
            return;
        }

        // Criar nova equipe
        const { data, error } = await supabaseClient
            .from('equipes_hvc')
            .insert({
                numero,
                status,
                observacoes
            })
            .select()
            .single();

        if (error) throw error;

        // Associar integrantes
        const integrantesParaInserir = Array.from(integrantesSelecionados).map(integranteId => ({
            equipe_id: data.id,
            integrante_id: integranteId
        }));

        const { error: errorIntegrantes } = await supabaseClient
            .from('equipe_integrantes')
            .insert(integrantesParaInserir);

        if (errorIntegrantes) throw errorIntegrantes;

        hideLoading();
        showNotification('Equipe criada com sucesso!', 'success');

        closeEquipeModal();
        await carregarEquipes();

    } catch (error) {
        hideLoading();
        console.error('❌ Erro ao salvar equipe:', error);
        showNotification('Erro ao salvar equipe: ' + error.message, 'error');
    }
}

async function saveIntegrante() {
    try {
        const nome = document.getElementById('integrante-nome').value.trim();
        const cpf = document.getElementById('integrante-cpf').value.trim();
        const whatsapp = document.getElementById('integrante-whatsapp').value.trim();
        const funcaoId = document.getElementById('integrante-funcao').value;
        const status = document.getElementById('integrante-status').value;
        const observacoes = document.getElementById('integrante-observacoes').value.trim();

        if (!nome || !cpf || !funcaoId) {
            showNotification('Por favor, preencha todos os campos obrigatórios', 'error');
            return;
        }

        showLoading('Salvando integrante...');

        // Verificar CPF duplicado
        const { data: existente } = await supabaseClient
            .from('integrantes_hvc')
            .select('id')
            .eq('cpf', cpf)
            .single();

        if (existente) {
            hideLoading();
            showNotification('Já existe um integrante com este CPF', 'error');
            return;
        }

        // Formatar WhatsApp para banco
        const whatsappFormatado = formatWhatsAppForDatabase(whatsapp);

        // Criar integrante
        const { error } = await supabaseClient
            .from('integrantes_hvc')
            .insert({
                nome,
                cpf,
                whatsapp: whatsappFormatado,
                funcao_id: funcaoId,
                status,
                observacoes
            });

        if (error) throw error;

        hideLoading();
        showNotification('Integrante cadastrado com sucesso!', 'success');

        closeIntegranteModal();
        await carregarIntegrantes();

    } catch (error) {
        hideLoading();
        console.error('❌ Erro ao salvar integrante:', error);
        showNotification('Erro ao salvar integrante: ' + error.message, 'error');
    }
}

async function salvarNovaFuncao() {
    try {
        const nome = document.getElementById('nova-funcao-nome').value.trim();
        const descricao = document.getElementById('nova-funcao-descricao').value.trim();
        
        if (!nome) {
            showNotification('Nome da função é obrigatório', 'warning');
            return;
        }
        
        showLoading('Salvando função...');
        
        // Verificar se função já existe
        const { data: existingFuncao } = await supabaseClient
            .from('funcoes_hvc')
            .select('id')
            .eq('nome', nome)
            .single();
            
        if (existingFuncao) {
            showNotification('Função já existe', 'warning');
            hideLoading();
            return;
        }
        
        // Salvar função
        const { error } = await supabaseClient
            .from('funcoes_hvc')
            .insert({
                nome: nome,
                descricao: descricao || null
            });
            
        if (error) throw error;
        
        showNotification('Função criada com sucesso!', 'success');
        
        // Limpar formulário
        document.getElementById('nova-funcao-nome').value = '';
        document.getElementById('nova-funcao-descricao').value = '';
        
        await carregarFuncoes();
        hideLoading();
        
    } catch (error) {
        console.error('❌ Erro ao salvar função:', error);
        showNotification('Erro ao salvar função: ' + error.message, 'error');
        hideLoading();
    }
}

// ========================================
// FUNÇÕES DE FILTRO
// ========================================

function filtrarIntegrantes() {
  const filtroNome = document.getElementById('filtro-nome-integrante').value.toLowerCase();
  const filtroCpf = document.getElementById('filtro-cpf-integrante').value.toLowerCase().replace(/\D/g, '');
  const filtroFuncao = document.getElementById('filtro-funcao-integrante').value;
  const filtroStatus = document.getElementById('filtro-status-integrante').value;
  
  const linhas = document.querySelectorAll('#tabela-integrantes tbody tr');
  
  linhas.forEach(linha => {
    if (linha.querySelector('.empty-state')) return;
    
    const nome = linha.cells[0].textContent.toLowerCase();
    const cpf = linha.cells[1].textContent.toLowerCase().replace(/\D/g, '');
    const nomeCompleto = linha.cells[0].textContent.trim();
    const status = linha.cells[4].textContent.toLowerCase().trim();
    const integrante = integrantesData.find(i => i.nome === nomeCompleto);
    
    const matchNome = nome.includes(filtroNome);
    const matchCpf = !filtroCpf || cpf.includes(filtroCpf);
    const matchFuncao = !filtroFuncao || (integrante && integrante.funcao_id === filtroFuncao);
    const matchStatus = !filtroStatus || status.includes(filtroStatus);
    
    linha.style.display = matchNome && matchCpf && matchFuncao && matchStatus ? '' : 'none';
  });
}

function filtrarEquipes() {
    const filtroNumero = document.getElementById('filtro-numero-equipe')?.value.toLowerCase() || '';
    const filtroStatus = document.getElementById('filtro-status-equipe')?.value || '';
    
    const linhas = document.querySelectorAll('#tabela-equipes tbody tr');
    
    linhas.forEach(linha => {
        // Pular linha de estado vazio
        if (linha.querySelector('.empty-state')) return;
        
        const numero = linha.cells[0]?.textContent.toLowerCase() || '';
        const statusTexto = linha.cells[2]?.textContent.toLowerCase() || '';
        
        // Aplicar filtros
        const matchNumero = !filtroNumero || numero.includes(filtroNumero);
        const matchStatus = !filtroStatus || statusTexto.includes(filtroStatus);
        
        // Mostrar/ocultar linha
        linha.style.display = matchNumero && matchStatus ? '' : 'none';
    });
}

// ========================================
// FORMATAÇÃO
// ========================================

function formatCPF(value) {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1');
}

function formatWhatsAppDisplay(phone) {
    // Remove tudo que não for dígito, exceto o '+' inicial.
    let numbers = phone.replace(/[^\d+]/g, '');

    // Garante que o '+' só exista no começo.
    if (numbers.startsWith('+')) {
        numbers = '+' + numbers.substring(1).replace(/\+/g, '');
    } else {
        numbers = numbers.replace(/\+/g, '');
    }

    // Limita o tamanho para o formato +DDI+DDD+NUMERO (ex: +5581999999999 -> 14 caracteres)
    if (numbers.length > 14) {
        numbers = numbers.substring(0, 14);
    }
    
    return numbers;
}

function formatWhatsAppForDatabase(phone) {
    // Remove todos os caracteres não numéricos, exceto o '+' inicial.
    if (!phone) return null;
    let numbersOnly = phone.replace(/[^\d+]/g, '');

    // Se não começar com '+', adiciona o DDI do Brasil (+55) por padrão.
    if (!numbersOnly.startsWith('+')) {
        // Remove o '55' se já tiver sido digitado no início sem o '+'
        if (numbersOnly.startsWith('55')) {
            numbersOnly = numbersOnly.substring(2);
        }
        numbersOnly = '+55' + numbersOnly;
    }
    
    // Retorna o número formatado ou null se estiver vazio.
    return numbersOnly.length > 3 ? numbersOnly : null;
}

function formatWhatsAppFromDatabase(phone) {
    // Para exibir dados vindos do banco, simplesmente retorna o valor como está.
    return phone || '';
}

// ========================================
// UTILITÁRIOS
// ========================================

function limparFormularioEquipe() {
    document.getElementById('equipe-numero').value = '';
    document.getElementById('equipe-status').value = 'ativa';
    document.getElementById('equipe-observacoes').value = '';
    integrantesSelecionados.clear();
    atualizarContadorSelecionados();
}

function limparFormularioIntegrante() {
    document.getElementById('integrante-nome').value = '';
    document.getElementById('integrante-cpf').value = '';
    document.getElementById('integrante-whatsapp').value = '';
    document.getElementById('integrante-funcao').value = '';
    document.getElementById('integrante-status').value = 'ativo';
    document.getElementById('integrante-observacoes').value = '';
}

function configurarEventos() {
    // Formatação automática de CPF
    const cpfInput = document.getElementById('integrante-cpf');
    if (cpfInput) {
        cpfInput.addEventListener('input', function(e) {
            e.target.value = formatCPF(e.target.value);
        });
    }
    
    // Formatação automática de CPF no filtro
    const cpfFiltroInput = document.getElementById('filtro-cpf-integrante');
    if (cpfFiltroInput) {
        cpfFiltroInput.addEventListener('input', function(e) {
            e.target.value = formatCPF(e.target.value);
        });
    }
    
    // Formatação automática de WhatsApp
    const whatsappInput = document.getElementById('integrante-whatsapp');
    if (whatsappInput) {
        whatsappInput.addEventListener('input', function(e) {
            e.target.value = formatWhatsAppDisplay(e.target.value);
        });
    }
    
    // Fechar modais ao clicar fora
    window.addEventListener('click', function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
}

// ========================================
// SISTEMA DE NOTIFICAÇÕES
// ========================================

function showNotification(message, type = 'info') {
    // Criar container se não existir
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
        `;
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    notification.innerHTML = `
        <div style="
            background: ${colors[type] || colors.info};
            color: white;
            padding: 1rem;
            margin-bottom: 0.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 0.5rem;
            animation: slideIn 0.3s ease;
        ">
            <i class="${icons[type] || icons.info}"></i>
            <span style="flex-grow: 1;">${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" style="
                background: none;
                border: none;
                color: white;
                font-size: 1.2rem;
                cursor: pointer;
                padding: 0;
                margin-left: 0.5rem;
            ">&times;</button>
        </div>
    `;
    
    container.appendChild(notification);
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

function showLoading(message = 'Carregando...') {
    console.log('🔄 ' + message);
}

function hideLoading() {
    console.log('✅ Loading finalizado');
}

// ========================================
// FUNÇÕES GLOBAIS (para onclick)
// ========================================

// Tornar funções disponíveis globalmente
window.openEquipeModal = openEquipeModal;
window.closeEquipeModal = closeEquipeModal;
window.openIntegranteModal = openIntegranteModal;
window.closeIntegranteModal = closeIntegranteModal;
window.openFuncoesModal = openFuncoesModal;
window.closeFuncoesModal = closeFuncoesModal;
window.saveEquipe = saveEquipe;
window.saveIntegrante = saveIntegrante;
window.salvarNovaFuncao = salvarNovaFuncao;
window.filtrarIntegrantes = filtrarIntegrantes;
window.filtrarEquipes = filtrarEquipes;

// Adicionar CSS para animações
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);

console.log('📦 Sistema de equipes HVC carregado com filtros funcionais!');


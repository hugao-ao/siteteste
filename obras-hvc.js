// obras-hvc.js - Gerenciamento de Obras HVC
import { supabase } from "./supabase.js";

// Elementos DOM
const addObraForm = document.getElementById("add-obra-form");
const obraNumeroInput = document.getElementById("obra-numero");
const obraObservacoesTextarea = document.getElementById("obra-observacoes");
const propostasSelection = document.getElementById("propostas-selection");
const obrasTableBody = document.querySelector("#obras-table tbody");

// Modais
const servicosModal = document.getElementById("servicos-modal");
const medicoesModal = document.getElementById("medicoes-modal");
const servicosMedicaoModal = document.getElementById("servicos-medicao-modal");

// Elementos dos modais
const modalCloseServicos = document.getElementById("modal-close-servicos");
const modalCloseMedicoes = document.getElementById("modal-close-medicoes");
const modalCloseServicosMedicao = document.getElementById("modal-close-servicos-medicao");

const obraInfoModal = document.getElementById("obra-info-modal");
const obraMedicoesInfo = document.getElementById("obra-medicoes-info");
const medicaoInfoModal = document.getElementById("medicao-info-modal");

// Formulários dos modais
const addServicoForm = document.getElementById("add-servico-form");
const addMedicaoForm = document.getElementById("add-medicao-form");
const addServicoMedicaoForm = document.getElementById("add-servico-medicao-form");

const servicoNomeInput = document.getElementById("servico-nome");
const medicaoNumeroInput = document.getElementById("medicao-numero");
const medicaoDataInput = document.getElementById("medicao-data");
const medicaoStatusSelect = document.getElementById("medicao-status");
const servicoMedicaoSelect = document.getElementById("servico-medicao-select");
const servicoObservacoesTextarea = document.getElementById("servico-observacoes");

// Listas dos modais
const servicosList = document.getElementById("servicos-list");
const medicoesList = document.getElementById("medicoes-list");
const servicosMedicaoList = document.getElementById("servicos-medicao-list");

// Variáveis globais
let currentObraId = null;
let currentMedicaoId = null;
let propostas = [];
let obras = [];
let selectedPropostas = [];

// Verificação de acesso
async function checkAccess() {
    const userLevel = sessionStorage.getItem("nivel");
    const userProject = sessionStorage.getItem("projeto");
    
    if (userLevel !== 'admin' && userProject !== 'Hvc') {
        alert("Acesso não autorizado. Esta funcionalidade é exclusiva do projeto HVC.");
        window.location.href = "index.html";
        return false;
    }
    return true;
}

// Formatação de número da obra
function formatNumeroObra(value) {
    const numbers = value.replace(/\D/g, '');
    const limitedNumbers = numbers.slice(0, 4);
    
    if (limitedNumbers.length === 1) {
        return `000${limitedNumbers}`;
    } else if (limitedNumbers.length === 2) {
        return `00${limitedNumbers}`;
    } else if (limitedNumbers.length === 3) {
        return `0${limitedNumbers}`;
    } else {
        return limitedNumbers;
    }
}

// Formatação de número da medição
function formatNumeroMedicao(value) {
    const numbers = value.replace(/\D/g, '');
    const limitedNumbers = numbers.slice(0, 3);
    
    if (limitedNumbers.length === 1) {
        return `00${limitedNumbers}`;
    } else if (limitedNumbers.length === 2) {
        return `0${limitedNumbers}`;
    } else {
        return limitedNumbers;
    }
}

// Formatação em tempo real
obraNumeroInput.addEventListener('input', (e) => {
    e.target.value = formatNumeroObra(e.target.value);
});

medicaoNumeroInput.addEventListener('input', (e) => {
    e.target.value = formatNumeroMedicao(e.target.value);
});

// Carregar propostas aprovadas
async function loadPropostasAprovadas() {
    try {
        const { data, error } = await supabase
            .from('propostas_hvc')
            .select(`
                *,
                clientes_hvc (
                    id,
                    nome
                )
            `)
            .eq('status', 'Aprovada')
            .order('numero_proposta');

        if (error) throw error;

        propostas = data || [];
        renderPropostasSelection();
    } catch (error) {
        console.error('Erro ao carregar propostas:', error);
        alert('Erro ao carregar propostas aprovadas.');
    }
}

// Renderizar seleção de propostas
function renderPropostasSelection() {
    if (propostas.length === 0) {
        propostasSelection.innerHTML = '<p style="text-align: center; color: #c0c0c0;">Nenhuma proposta aprovada disponível</p>';
        return;
    }

    propostasSelection.innerHTML = propostas.map(proposta => {
        const valorFormatado = parseFloat(proposta.valor).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });

        return `
            <div class="proposta-checkbox" onclick="toggleProposta('${proposta.id}')">
                <input type="checkbox" id="prop-${proposta.id}" style="margin-right: 0.5rem;">
                <label for="prop-${proposta.id}" style="cursor: pointer;">
                    <strong>${proposta.numero_proposta}</strong><br>
                    Cliente: ${proposta.clientes_hvc?.nome}<br>
                    Valor: ${valorFormatado}
                </label>
            </div>
        `;
    }).join('');
}

// Toggle seleção de proposta
window.toggleProposta = (propostaId) => {
    const checkbox = document.getElementById(`prop-${propostaId}`);
    const container = checkbox.parentElement;
    
    checkbox.checked = !checkbox.checked;
    
    if (checkbox.checked) {
        container.classList.add('selected');
        if (!selectedPropostas.includes(propostaId)) {
            selectedPropostas.push(propostaId);
        }
    } else {
        container.classList.remove('selected');
        selectedPropostas = selectedPropostas.filter(id => id !== propostaId);
    }
    
    updateValorTotal();
};

// Atualizar valor total
function updateValorTotal() {
    const total = selectedPropostas.reduce((sum, propostaId) => {
        const proposta = propostas.find(p => p.id === propostaId);
        return sum + (proposta ? parseFloat(proposta.valor) : 0);
    }, 0);
    
    // Você pode adicionar um elemento para mostrar o total se quiser
    console.log('Valor total selecionado:', total);
}

// Carregar obras
async function loadObras() {
    try {
        const { data, error } = await supabase
            .from('obras_hvc')
            .select(`
                *,
                clientes_hvc (
                    id,
                    nome
                ),
                propostas_obra_hvc (
                    proposta_id,
                    propostas_hvc (
                        numero_proposta,
                        valor
                    )
                )
            `)
            .order('numero_obra');

        if (error) throw error;

        obras = data || [];
        renderObras();
    } catch (error) {
        console.error('Erro ao carregar obras:', error);
        alert('Erro ao carregar obras.');
    }
}

// Renderizar tabela de obras
function renderObras() {
    if (obras.length === 0) {
        obrasTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhuma obra cadastrada</td></tr>';
        return;
    }

    obrasTableBody.innerHTML = obras.map(obra => {
        const valorFormatado = parseFloat(obra.valor_total).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });

        const statusClass = `status-${obra.status.toLowerCase().replace(/\s+/g, '-')}`;

        return `
            <tr>
                <td data-label="Número">${obra.numero_obra}</td>
                <td data-label="Cliente">${obra.clientes_hvc?.nome || 'Cliente não encontrado'}</td>
                <td data-label="Valor Total">${valorFormatado}</td>
                <td data-label="Status">
                    <span class="status-badge ${statusClass}">${obra.status}</span>
                </td>
                <td data-label="Serviços">
                    <button class="hvc-btn" onclick="openServicosModal('${obra.id}', '${obra.numero_obra}')" style="padding: 0.5rem 1rem;">
                        <i class="fas fa-tools"></i> Gerenciar
                    </button>
                </td>
                <td data-label="Medições">
                    <button class="hvc-btn" onclick="openMedicoesModal('${obra.id}', '${obra.numero_obra}')" style="padding: 0.5rem 1rem;">
                        <i class="fas fa-ruler"></i> Gerenciar
                    </button>
                </td>
                <td data-label="Ações">
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="hvc-btn" onclick="editObservacoes('${obra.id}', '${obra.observacoes || ''}')" style="padding: 0.5rem;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="hvc-btn hvc-btn-danger" onclick="deleteObra('${obra.id}')" style="padding: 0.5rem;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Adicionar obra
addObraForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const numero = obraNumeroInput.value.trim();
    const observacoes = obraObservacoesTextarea.value.trim();
    
    if (!numero) {
        alert('Por favor, insira o número da obra.');
        return;
    }
    
    if (selectedPropostas.length === 0) {
        alert('Por favor, selecione pelo menos uma proposta.');
        return;
    }
    
    // Calcular valor total e cliente
    const valorTotal = selectedPropostas.reduce((sum, propostaId) => {
        const proposta = propostas.find(p => p.id === propostaId);
        return sum + (proposta ? parseFloat(proposta.valor) : 0);
    }, 0);
    
    // Pegar cliente da primeira proposta (assumindo que todas são do mesmo cliente)
    const primeiraProposta = propostas.find(p => p.id === selectedPropostas[0]);
    const clienteId = primeiraProposta?.cliente_id;
    
    if (!clienteId) {
        alert('Erro ao identificar o cliente das propostas selecionadas.');
        return;
    }
    
    // Formatar número completo com ano
    const currentYear = new Date().getFullYear();
    const numeroCompleto = `${numero}/${currentYear}`;
    
    try {
        // Inserir obra
        const { data: obraData, error: obraError } = await supabase
            .from('obras_hvc')
            .insert([{
                numero_obra: numeroCompleto,
                cliente_id: clienteId,
                valor_total: valorTotal,
                observacoes: observacoes || null
            }])
            .select()
            .single();

        if (obraError) {
            if (obraError.code === '23505') {
                alert('Já existe uma obra com este número.');
            } else {
                throw obraError;
            }
            return;
        }

        // Associar propostas à obra
        const propostasObra = selectedPropostas.map(propostaId => ({
            obra_id: obraData.id,
            proposta_id: propostaId
        }));

        const { error: propostasError } = await supabase
            .from('propostas_obra_hvc')
            .insert(propostasObra);

        if (propostasError) throw propostasError;

        // Limpar formulário
        addObraForm.reset();
        selectedPropostas = [];
        document.querySelectorAll('.proposta-checkbox').forEach(el => {
            el.classList.remove('selected');
            el.querySelector('input').checked = false;
        });
        
        // Recarregar listas
        await loadObras();
        await loadPropostasAprovadas(); // Recarregar para remover propostas já usadas
        
        alert('Obra adicionada com sucesso!');
    } catch (error) {
        console.error('Erro ao adicionar obra:', error);
        alert('Erro ao adicionar obra. Verifique o console.');
    }
});

// Editar observações
window.editObservacoes = async (obraId, observacoesAtuais) => {
    const novasObservacoes = prompt('Observações da obra:', observacoesAtuais);
    
    if (novasObservacoes === null) return; // Cancelou
    
    try {
        const { error } = await supabase
            .from('obras_hvc')
            .update({ observacoes: novasObservacoes.trim() || null })
            .eq('id', obraId);

        if (error) throw error;

        await loadObras();
        alert('Observações atualizadas com sucesso!');
    } catch (error) {
        console.error('Erro ao atualizar observações:', error);
        alert('Erro ao atualizar observações.');
    }
};

// Excluir obra
window.deleteObra = async (obraId) => {
    if (!confirm('Tem certeza que deseja excluir esta obra? Esta ação não pode ser desfeita e excluirá todos os serviços e medições associados.')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('obras_hvc')
            .delete()
            .eq('id', obraId);

        if (error) throw error;

        await loadObras();
        await loadPropostasAprovadas(); // Recarregar propostas
        alert('Obra excluída com sucesso!');
    } catch (error) {
        console.error('Erro ao excluir obra:', error);
        alert('Erro ao excluir obra.');
    }
};

// Modal de serviços
window.openServicosModal = (obraId, numeroObra) => {
    currentObraId = obraId;
    obraInfoModal.textContent = `Obra: ${numeroObra}`;
    servicosModal.style.display = 'block';
    loadServicos();
};

modalCloseServicos.addEventListener('click', () => {
    servicosModal.style.display = 'none';
    currentObraId = null;
});

// Carregar serviços
async function loadServicos() {
    if (!currentObraId) return;
    
    try {
        const { data, error } = await supabase
            .from('servicos_obra_hvc')
            .select('*')
            .eq('obra_id', currentObraId)
            .order('created_at');

        if (error) throw error;

        renderServicos(data || []);
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        alert('Erro ao carregar serviços.');
    }
}

// Renderizar serviços
function renderServicos(servicos) {
    if (servicos.length === 0) {
        servicosList.innerHTML = '<p style="text-align: center; color: #c0c0c0;">Nenhum serviço cadastrado</p>';
        return;
    }

    servicosList.innerHTML = servicos.map(servico => `
        <div class="servico-item">
            <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 0.5rem;">
                <input type="text" value="${servico.nome_servico}" 
                       onchange="updateServico('${servico.id}', 'nome_servico', this.value)"
                       class="hvc-input" style="flex: 1; margin-right: 1rem;">
                <button class="hvc-btn hvc-btn-danger" onclick="deleteServico('${servico.id}')" style="padding: 0.5rem;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="servico-controls">
                <button class="toggle-btn ${servico.iniciado ? 'active' : 'inactive'}" 
                        onclick="toggleServico('${servico.id}', 'iniciado', ${!servico.iniciado})">
                    <i class="fas fa-play"></i> ${servico.iniciado ? 'Iniciado' : 'Iniciar'}
                </button>
                <button class="toggle-btn ${servico.concluido ? 'active' : 'inactive'}" 
                        onclick="toggleServico('${servico.id}', 'concluido', ${!servico.concluido})">
                    <i class="fas fa-check"></i> ${servico.concluido ? 'Concluído' : 'Concluir'}
                </button>
                <span class="status-badge status-${servico.status.toLowerCase().replace(/\s+/g, '-')}">${servico.status}</span>
                ${servico.data_inicio ? `<small>Início: ${new Date(servico.data_inicio).toLocaleDateString('pt-BR')}</small>` : ''}
                ${servico.data_conclusao ? `<small>Conclusão: ${new Date(servico.data_conclusao).toLocaleDateString('pt-BR')}</small>` : ''}
            </div>
        </div>
    `).join('');
}

// Adicionar serviço
addServicoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentObraId) return;
    
    const nome = servicoNomeInput.value.trim();
    
    if (!nome) {
        alert('O nome do serviço é obrigatório.');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('servicos_obra_hvc')
            .insert([{
                obra_id: currentObraId,
                nome_servico: nome
            }]);

        if (error) throw error;

        servicoNomeInput.value = '';
        await loadServicos();
        await updateObraStatus(); // Atualizar status da obra
    } catch (error) {
        console.error('Erro ao adicionar serviço:', error);
        alert('Erro ao adicionar serviço.');
    }
});

// Atualizar serviço
window.updateServico = async (servicoId, field, value) => {
    if (!value.trim()) {
        alert('O nome do serviço não pode estar vazio.');
        await loadServicos();
        return;
    }
    
    try {
        const { error } = await supabase
            .from('servicos_obra_hvc')
            .update({ [field]: value.trim() })
            .eq('id', servicoId);

        if (error) throw error;
    } catch (error) {
        console.error('Erro ao atualizar serviço:', error);
        alert('Erro ao atualizar serviço.');
        await loadServicos();
    }
};

// Toggle status do serviço
window.toggleServico = async (servicoId, field, newValue) => {
    if (!newValue && !confirm(`Tem certeza que deseja desmarcar este serviço como ${field === 'iniciado' ? 'iniciado' : 'concluído'}?`)) {
        return;
    }
    
    try {
        const updateData = { [field]: newValue };
        
        if (field === 'iniciado') {
            updateData.data_inicio = newValue ? new Date().toISOString() : null;
        } else if (field === 'concluido') {
            updateData.data_conclusao = newValue ? new Date().toISOString() : null;
        }

        const { error } = await supabase
            .from('servicos_obra_hvc')
            .update(updateData)
            .eq('id', servicoId);

        if (error) throw error;

        await loadServicos();
        await updateObraStatus(); // Atualizar status da obra
    } catch (error) {
        console.error('Erro ao atualizar status do serviço:', error);
        alert('Erro ao atualizar status do serviço.');
    }
};

// Excluir serviço
window.deleteServico = async (servicoId) => {
    if (!confirm('Tem certeza que deseja excluir este serviço?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('servicos_obra_hvc')
            .delete()
            .eq('id', servicoId);

        if (error) throw error;

        await loadServicos();
        await updateObraStatus(); // Atualizar status da obra
    } catch (error) {
        console.error('Erro ao excluir serviço:', error);
        alert('Erro ao excluir serviço.');
    }
};

// Atualizar status da obra
async function updateObraStatus() {
    if (!currentObraId) return;
    
    try {
        // Buscar todos os serviços da obra
        const { data: servicos, error: servicosError } = await supabase
            .from('servicos_obra_hvc')
            .select('iniciado, concluido')
            .eq('obra_id', currentObraId);

        if (servicosError) throw servicosError;

        let status = 'À iniciar';
        
        if (servicos && servicos.length > 0) {
            const todosIniciados = servicos.every(s => s.iniciado);
            const todosConcluidos = servicos.every(s => s.concluido);
            
            if (todosConcluidos) {
                // Verificar valores para determinar se é "Concluída" ou "Pagamento Pendente"
                // Por enquanto, vamos deixar como "Concluída" - isso será refinado com o fluxo de caixa
                status = 'Concluída';
            } else if (servicos.some(s => s.iniciado)) {
                status = 'Iniciado';
            }
        }

        const { error } = await supabase
            .from('obras_hvc')
            .update({ status })
            .eq('id', currentObraId);

        if (error) throw error;

        await loadObras(); // Recarregar tabela principal
    } catch (error) {
        console.error('Erro ao atualizar status da obra:', error);
    }
}

// Modal de medições
window.openMedicoesModal = (obraId, numeroObra) => {
    currentObraId = obraId;
    obraMedicoesInfo.textContent = `Obra: ${numeroObra}`;
    medicoesModal.style.display = 'block';
    loadMedicoes();
};

modalCloseMedicoes.addEventListener('click', () => {
    medicoesModal.style.display = 'none';
    currentObraId = null;
});

// Carregar medições
async function loadMedicoes() {
    if (!currentObraId) return;
    
    try {
        const { data, error } = await supabase
            .from('medicoes_obra_hvc')
            .select('*')
            .eq('obra_id', currentObraId)
            .order('numero_medicao');

        if (error) throw error;

        renderMedicoes(data || []);
    } catch (error) {
        console.error('Erro ao carregar medições:', error);
        alert('Erro ao carregar medições.');
    }
}

// Renderizar medições
function renderMedicoes(medicoes) {
    if (medicoes.length === 0) {
        medicoesList.innerHTML = '<p style="text-align: center; color: #c0c0c0;">Nenhuma medição cadastrada</p>';
        return;
    }

    medicoesList.innerHTML = medicoes.map(medicao => `
        <div class="medicao-item">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 1rem; align-items: center; margin-bottom: 1rem;">
                <div>
                    <strong>${medicao.numero_medicao}</strong><br>
                    <small>Data: ${new Date(medicao.data_medicao).toLocaleDateString('pt-BR')}</small>
                </div>
                <div>
                    Status: ${medicao.status_medicao}<br>
                    <small>Pago: ${medicao.pago ? 'Sim' : 'Não'}</small>
                </div>
                <div>
                    Valor: R$ ${parseFloat(medicao.valor_medicao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}<br>
                    <small>Ret/Add: R$ ${parseFloat(medicao.retencao_adicao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</small>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="hvc-btn" onclick="openServicosMedicaoModal('${medicao.id}', '${medicao.numero_medicao}')" style="padding: 0.5rem;">
                        <i class="fas fa-list"></i>
                    </button>
                    <button class="hvc-btn hvc-btn-danger" onclick="deleteMedicao('${medicao.id}')" style="padding: 0.5rem;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Adicionar medição
addMedicaoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentObraId) return;
    
    const numero = medicaoNumeroInput.value.trim();
    const data = medicaoDataInput.value;
    const status = medicaoStatusSelect.value;
    
    if (!numero || !data || !status) {
        alert('Por favor, preencha todos os campos.');
        return;
    }
    
    // Buscar número da obra para formar o número completo da medição
    const obra = obras.find(o => o.id === currentObraId);
    if (!obra) {
        alert('Obra não encontrada.');
        return;
    }
    
    const numeroCompleto = `${numero}/${obra.numero_obra}`;
    
    try {
        const { error } = await supabase
            .from('medicoes_obra_hvc')
            .insert([{
                obra_id: currentObraId,
                numero_medicao: numeroCompleto,
                data_medicao: data,
                status_medicao: status
            }]);

        if (error) {
            if (error.code === '23505') {
                alert('Já existe uma medição com este número.');
            } else {
                throw error;
            }
            return;
        }

        addMedicaoForm.reset();
        await loadMedicoes();
        alert('Medição adicionada com sucesso!');
    } catch (error) {
        console.error('Erro ao adicionar medição:', error);
        alert('Erro ao adicionar medição.');
    }
});

// Excluir medição
window.deleteMedicao = async (medicaoId) => {
    if (!confirm('Tem certeza que deseja excluir esta medição?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('medicoes_obra_hvc')
            .delete()
            .eq('id', medicaoId);

        if (error) throw error;

        await loadMedicoes();
        alert('Medição excluída com sucesso!');
    } catch (error) {
        console.error('Erro ao excluir medição:', error);
        alert('Erro ao excluir medição.');
    }
};

// Modal de serviços da medição
window.openServicosMedicaoModal = (medicaoId, numeroMedicao) => {
    currentMedicaoId = medicaoId;
    medicaoInfoModal.textContent = `Medição: ${numeroMedicao}`;
    servicosMedicaoModal.style.display = 'block';
    loadServicosObra();
    loadServicosMedicao();
};

modalCloseServicosMedicao.addEventListener('click', () => {
    servicosMedicaoModal.style.display = 'none';
    currentMedicaoId = null;
});

// Carregar serviços da obra para o select
async function loadServicosObra() {
    if (!currentObraId) return;
    
    try {
        const { data, error } = await supabase
            .from('servicos_obra_hvc')
            .select('id, nome_servico')
            .eq('obra_id', currentObraId)
            .order('nome_servico');

        if (error) throw error;

        servicoMedicaoSelect.innerHTML = '<option value="">Selecione o Serviço</option>';
        
        (data || []).forEach(servico => {
            const option = document.createElement('option');
            option.value = servico.id;
            option.textContent = servico.nome_servico;
            servicoMedicaoSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar serviços da obra:', error);
    }
}

// Carregar serviços da medição
async function loadServicosMedicao() {
    if (!currentMedicaoId) return;
    
    try {
        const { data, error } = await supabase
            .from('servicos_medicao_hvc')
            .select(`
                *,
                servicos_obra_hvc (
                    nome_servico
                )
            `)
            .eq('medicao_id', currentMedicaoId);

        if (error) throw error;

        renderServicosMedicao(data || []);
    } catch (error) {
        console.error('Erro ao carregar serviços da medição:', error);
    }
}

// Renderizar serviços da medição
function renderServicosMedicao(servicos) {
    if (servicos.length === 0) {
        servicosMedicaoList.innerHTML = '<p style="text-align: center; color: #c0c0c0;">Nenhum serviço adicionado à medição</p>';
        return;
    }

    servicosMedicaoList.innerHTML = servicos.map(item => `
        <div class="servico-item">
            <div style="display: flex; justify-content: between; align-items: flex-start; gap: 1rem;">
                <div style="flex: 1;">
                    <strong>${item.servicos_obra_hvc?.nome_servico}</strong>
                    ${item.observacoes ? `<br><small style="color: #c0c0c0;">${item.observacoes}</small>` : ''}
                </div>
                <button class="hvc-btn hvc-btn-danger" onclick="deleteServicoMedicao('${item.id}')" style="padding: 0.5rem;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// Adicionar serviço à medição
addServicoMedicaoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentMedicaoId) return;
    
    const servicoId = servicoMedicaoSelect.value;
    const observacoes = servicoObservacoesTextarea.value.trim();
    
    if (!servicoId) {
        alert('Por favor, selecione um serviço.');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('servicos_medicao_hvc')
            .insert([{
                medicao_id: currentMedicaoId,
                servico_id: servicoId,
                observacoes: observacoes || null
            }]);

        if (error) throw error;

        addServicoMedicaoForm.reset();
        await loadServicosMedicao();
    } catch (error) {
        console.error('Erro ao adicionar serviço à medição:', error);
        alert('Erro ao adicionar serviço à medição.');
    }
});

// Excluir serviço da medição
window.deleteServicoMedicao = async (servicoMedicaoId) => {
    if (!confirm('Tem certeza que deseja remover este serviço da medição?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('servicos_medicao_hvc')
            .delete()
            .eq('id', servicoMedicaoId);

        if (error) throw error;

        await loadServicosMedicao();
    } catch (error) {
        console.error('Erro ao remover serviço da medição:', error);
        alert('Erro ao remover serviço da medição.');
    }
};

// Fechar modais ao clicar fora
window.addEventListener('click', (e) => {
    if (e.target === servicosModal) {
        servicosModal.style.display = 'none';
        currentObraId = null;
    }
    if (e.target === medicoesModal) {
        medicoesModal.style.display = 'none';
        currentObraId = null;
    }
    if (e.target === servicosMedicaoModal) {
        servicosMedicaoModal.style.display = 'none';
        currentMedicaoId = null;
    }
});

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    if (await checkAccess()) {
        await loadPropostasAprovadas();
        await loadObras();
    }
});


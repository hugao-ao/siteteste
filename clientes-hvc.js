// clientes-hvc.js - Gerenciamento de Clientes HVC com Filtros
import { supabase } from "./supabase.js";

// Elementos DOM
const addClienteForm = document.getElementById("add-cliente-form");
const clienteNomeInput = document.getElementById("cliente-nome");
const clienteDocumentoInput = document.getElementById("cliente-documento");
const documentoTipoSpan = document.getElementById("documento-tipo");
const clientesTableBody = document.querySelector("#clientes-table tbody");

// Elementos de filtro
const filterNomeInput = document.getElementById("filter-nome");
const filterDocumentoInput = document.getElementById("filter-documento");
const filterResponsaveisSelect = document.getElementById("filter-responsaveis");
const clearFiltersBtn = document.getElementById("clear-filters");
const resultsCounter = document.getElementById("results-counter");

// Modal de responsáveis
const responsaveisModal = document.getElementById("responsaveis-modal");
const modalCloseResponsaveis = document.getElementById("modal-close-responsaveis");
const clienteNomeModal = document.getElementById("cliente-nome-modal");
const addResponsavelForm = document.getElementById("add-responsavel-form");
const responsavelNomeInput = document.getElementById("responsavel-nome");
const responsavelWhatsappInput = document.getElementById("responsavel-whatsapp");
const responsavelEmailInput = document.getElementById("responsavel-email");
const responsaveisList = document.getElementById("responsaveis-list");

// Variáveis globais
let currentClienteId = null;
let clientes = [];
let clientesFiltrados = [];

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

// Formatação de documento
function formatDocument(value) {
    // Remove tudo que não é dígito
    const numbers = value.replace(/\D/g, '');
    
    if (numbers.length <= 11) {
        // CPF: 000.000.000-00
        documentoTipoSpan.textContent = 'CPF';
        return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else {
        // CNPJ: 00.000.000/0000-00
        documentoTipoSpan.textContent = 'CNPJ';
        return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
}

// Validação de documento
function validateDocument(documento) {
    const numbers = documento.replace(/\D/g, '');
    
    if (numbers.length === 11) {
        // Validação básica de CPF
        return validateCPF(numbers);
    } else if (numbers.length === 14) {
        // Validação básica de CNPJ
        return validateCNPJ(numbers);
    }
    return false;
}

function validateCPF(cpf) {
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    return remainder === parseInt(cpf.charAt(10));
}

function validateCNPJ(cnpj) {
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
    
    let length = cnpj.length - 2;
    let numbers = cnpj.substring(0, length);
    let digits = cnpj.substring(length);
    let sum = 0;
    let pos = length - 7;
    
    for (let i = length; i >= 1; i--) {
        sum += numbers.charAt(length - i) * pos--;
        if (pos < 2) pos = 9;
    }
    
    let result = sum % 11 < 2 ? 0 : 11 - sum % 11;
    if (result !== parseInt(digits.charAt(0))) return false;
    
    length = length + 1;
    numbers = cnpj.substring(0, length);
    sum = 0;
    pos = length - 7;
    
    for (let i = length; i >= 1; i--) {
        sum += numbers.charAt(length - i) * pos--;
        if (pos < 2) pos = 9;
    }
    
    result = sum % 11 < 2 ? 0 : 11 - sum % 11;
    return result === parseInt(digits.charAt(1));
}

// Formatação em tempo real do documento
clienteDocumentoInput.addEventListener('input', (e) => {
    const formatted = formatDocument(e.target.value);
    e.target.value = formatted;
});

// FUNÇÕES DE FILTRO

// Aplicar todos os filtros
function applyFilters() {
    const nomeFilter = filterNomeInput.value.toLowerCase().trim();
    const documentoFilter = filterDocumentoInput.value.toLowerCase().trim();
    const responsaveisFilter = filterResponsaveisSelect.value;
    
    clientesFiltrados = clientes.filter(cliente => {
        // Filtro por nome
        const nomeMatch = !nomeFilter || cliente.nome.toLowerCase().includes(nomeFilter);
        
        // Filtro por documento
        const documentoMatch = !documentoFilter || 
            (cliente.documento && cliente.documento.toLowerCase().includes(documentoFilter));
        
        // Filtro por responsáveis
        let responsaveisMatch = true;
        if (responsaveisFilter) {
            const numResponsaveis = cliente.responsaveis_cliente_hvc?.length || 0;
            
            if (responsaveisFilter === '0') {
                responsaveisMatch = numResponsaveis === 0;
            } else if (responsaveisFilter === '1') {
                responsaveisMatch = numResponsaveis === 1;
            } else if (responsaveisFilter === '2') {
                responsaveisMatch = numResponsaveis === 2;
            } else if (responsaveisFilter === '3') {
                responsaveisMatch = numResponsaveis === 3;
            } else if (responsaveisFilter === '4+') {
                responsaveisMatch = numResponsaveis >= 4;
            }
        }
        
        return nomeMatch && documentoMatch && responsaveisMatch;
    });
    
    renderClientes();
    updateResultsCounter();
}

// Atualizar contador de resultados
function updateResultsCounter() {
    const total = clientes.length;
    const filtered = clientesFiltrados.length;
    
    if (total === filtered) {
        resultsCounter.textContent = `Mostrando ${total} cliente(s)`;
    } else {
        resultsCounter.textContent = `Mostrando ${filtered} de ${total} cliente(s)`;
    }
}

// Limpar todos os filtros
function clearFilters() {
    filterNomeInput.value = '';
    filterDocumentoInput.value = '';
    filterResponsaveisSelect.value = '';
    
    clientesFiltrados = [...clientes];
    renderClientes();
    updateResultsCounter();
}

// Event listeners para filtros
filterNomeInput.addEventListener('input', applyFilters);
filterDocumentoInput.addEventListener('input', applyFilters);
filterResponsaveisSelect.addEventListener('change', applyFilters);
clearFiltersBtn.addEventListener('click', clearFilters);

// Carregar clientes
async function loadClientes() {
    try {
        const { data, error } = await supabase
            .from('clientes_hvc')
            .select(`
                *,
                responsaveis_cliente_hvc (
                    id,
                    nome,
                    whatsapp,
                    email
                )
            `)
            .order('nome');

        if (error) throw error;

        clientes = data || [];
        clientesFiltrados = [...clientes];
        renderClientes();
        updateResultsCounter();
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        alert('Erro ao carregar clientes. Verifique o console.');
    }
}

// Renderizar tabela de clientes
function renderClientes() {
    if (clientesFiltrados.length === 0) {
        if (clientes.length === 0) {
            clientesTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum cliente cadastrado</td></tr>';
        } else {
            clientesTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum cliente encontrado com os filtros aplicados</td></tr>';
        }
        return;
    }

    clientesTableBody.innerHTML = clientesFiltrados.map(cliente => `
        <tr>
            <td data-label="Nome">
                <input type="text" value="${cliente.nome}" 
                       onchange="updateCliente('${cliente.id}', 'nome', this.value)"
                       style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #e0e0e0; padding: 0.5rem; border-radius: 4px; width: 100%;">
            </td>
            <td data-label="Documento">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span>${cliente.documento || 'Não informado'}</span>
                    ${cliente.tipo_documento ? `<small style="color: #c0c0c0;">(${cliente.tipo_documento})</small>` : ''}
                </div>
            </td>
            <td data-label="Responsáveis">
                <button class="hvc-btn" onclick="openResponsaveisModal('${cliente.id}', '${cliente.nome}')" style="padding: 0.5rem 1rem;">
                    <i class="fas fa-users"></i> 
                    ${cliente.responsaveis_cliente_hvc?.length || 0} responsável(is)
                </button>
            </td>
            <td data-label="Ações">
                <button class="hvc-btn hvc-btn-danger" onclick="deleteCliente('${cliente.id}')" style="padding: 0.5rem 1rem;">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </td>
        </tr>
    `).join('');
}

// Adicionar cliente
addClienteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nome = clienteNomeInput.value.trim();
    const documento = clienteDocumentoInput.value.trim();
    
    // Validação: apenas nome é obrigatório
    if (!nome) {
        alert('Por favor, preencha o nome do cliente.');
        return;
    }
    
    // Se documento foi preenchido, validar
    if (documento && !validateDocument(documento)) {
        alert('Documento inválido. Verifique o CPF ou CNPJ ou deixe em branco.');
        return;
    }
    
    // Verificar se cliente já existe (por nome ou documento se preenchido)
    const clienteExistente = clientes.find(c => 
        c.nome.toLowerCase() === nome.toLowerCase() || 
        (documento && c.documento === documento)
    );
    
    if (clienteExistente) {
        if (clienteExistente.nome.toLowerCase() === nome.toLowerCase()) {
            alert('Já existe um cliente com este nome.');
        } else {
            alert('Já existe um cliente com este documento.');
        }
        return;
    }
    
    try {
        // Determinar tipo de documento se preenchido
        let tipoDocumento = null;
        if (documento) {
            const numbers = documento.replace(/\D/g, '');
            tipoDocumento = numbers.length === 11 ? 'CPF' : 'CNPJ';
        }
        
        const { data, error } = await supabase
            .from('clientes_hvc')
            .insert([{
                nome,
                documento: documento || null,
                tipo_documento: tipoDocumento
            }])
            .select();

        if (error) throw error;

        alert('Cliente adicionado com sucesso!');
        
        // Limpar formulário
        clienteNomeInput.value = '';
        clienteDocumentoInput.value = '';
        documentoTipoSpan.textContent = 'CPF';
        
        // Recarregar lista
        await loadClientes();
        
    } catch (error) {
        console.error('Erro ao adicionar cliente:', error);
        alert('Erro ao adicionar cliente: ' + error.message);
    }
});

// Atualizar cliente
window.updateCliente = async (clienteId, field, value) => {
    if (!value.trim()) {
        alert('O nome não pode estar vazio.');
        await loadClientes();
        return;
    }
    
    try {
        const { error } = await supabase
            .from('clientes_hvc')
            .update({ [field]: value.trim() })
            .eq('id', clienteId);

        if (error) {
            if (error.code === '23505') {
                alert('Já existe um cliente com este nome.');
                await loadClientes();
            } else {
                throw error;
            }
            return;
        }

        // Atualizar localmente
        const cliente = clientes.find(c => c.id === clienteId);
        if (cliente) {
            cliente[field] = value.trim();
        }
        
        // Reaplicar filtros
        applyFilters();
    } catch (error) {
        console.error('Erro ao atualizar cliente:', error);
        alert('Erro ao atualizar cliente.');
        await loadClientes();
    }
};

// Excluir cliente
window.deleteCliente = async (clienteId) => {
    if (!confirm('Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('clientes_hvc')
            .delete()
            .eq('id', clienteId);

        if (error) throw error;

        await loadClientes();
        alert('Cliente excluído com sucesso!');
    } catch (error) {
        console.error('Erro ao excluir cliente:', error);
        alert('Erro ao excluir cliente. Verifique se não há propostas ou obras associadas.');
    }
};

// Modal de responsáveis
window.openResponsaveisModal = (clienteId, clienteNome) => {
    currentClienteId = clienteId;
    clienteNomeModal.textContent = clienteNome;
    responsaveisModal.style.display = 'block';
    loadResponsaveis();
};

modalCloseResponsaveis.addEventListener('click', () => {
    responsaveisModal.style.display = 'none';
    currentClienteId = null;
});

window.addEventListener('click', (e) => {
    if (e.target === responsaveisModal) {
        responsaveisModal.style.display = 'none';
        currentClienteId = null;
    }
});

// Carregar responsáveis
async function loadResponsaveis() {
    if (!currentClienteId) return;
    
    try {
        const { data, error } = await supabase
            .from('responsaveis_cliente_hvc')
            .select('*')
            .eq('cliente_id', currentClienteId)
            .order('nome');

        if (error) throw error;

        renderResponsaveis(data || []);
    } catch (error) {
        console.error('Erro ao carregar responsáveis:', error);
        alert('Erro ao carregar responsáveis.');
    }
}

// Renderizar responsáveis
function renderResponsaveis(responsaveis) {
    if (responsaveis.length === 0) {
        responsaveisList.innerHTML = '<p style="text-align: center; color: #c0c0c0;">Nenhum responsável cadastrado</p>';
        return;
    }

    responsaveisList.innerHTML = responsaveis.map(resp => `
        <div class="responsavel-item">
            <input type="text" value="${resp.nome}" 
                   onchange="updateResponsavel('${resp.id}', 'nome', this.value)"
                   class="hvc-input" placeholder="Nome">
            <input type="text" value="${resp.whatsapp || ''}" 
                   onchange="updateResponsavel('${resp.id}', 'whatsapp', this.value)"
                   class="hvc-input" placeholder="WhatsApp">
            <input type="email" value="${resp.email || ''}" 
                   onchange="updateResponsavel('${resp.id}', 'email', this.value)"
                   class="hvc-input" placeholder="Email">
            <button class="hvc-btn hvc-btn-danger" onclick="deleteResponsavel('${resp.id}')" style="padding: 0.5rem;">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

// Adicionar responsável
addResponsavelForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentClienteId) return;
    
    const nome = responsavelNomeInput.value.trim();
    const whatsapp = responsavelWhatsappInput.value.trim();
    const email = responsavelEmailInput.value.trim();
    
    if (!nome) {
        alert('O nome do responsável é obrigatório.');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('responsaveis_cliente_hvc')
            .insert([{
                cliente_id: currentClienteId,
                nome,
                whatsapp: whatsapp || null,
                email: email || null
            }]);

        if (error) throw error;

        // Limpar formulário
        addResponsavelForm.reset();
        
        // Recarregar responsáveis
        await loadResponsaveis();
        
        // Atualizar contador na tabela principal
        await loadClientes();
    } catch (error) {
        console.error('Erro ao adicionar responsável:', error);
        alert('Erro ao adicionar responsável.');
    }
});

// Atualizar responsável
window.updateResponsavel = async (responsavelId, field, value) => {
    if (field === 'nome' && !value.trim()) {
        alert('O nome não pode estar vazio.');
        await loadResponsaveis();
        return;
    }
    
    try {
        const { error } = await supabase
            .from('responsaveis_cliente_hvc')
            .update({ [field]: value.trim() || null })
            .eq('id', responsavelId);

        if (error) throw error;
    } catch (error) {
        console.error('Erro ao atualizar responsável:', error);
        alert('Erro ao atualizar responsável.');
        await loadResponsaveis();
    }
};

// Excluir responsável
window.deleteResponsavel = async (responsavelId) => {
    if (!confirm('Tem certeza que deseja excluir este responsável?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('responsaveis_cliente_hvc')
            .delete()
            .eq('id', responsavelId);

        if (error) throw error;

        await loadResponsaveis();
        await loadClientes(); // Atualizar contador
    } catch (error) {
        console.error('Erro ao excluir responsável:', error);
        alert('Erro ao excluir responsável.');
    }
};

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    if (await checkAccess()) {
        await loadClientes();
    }
});


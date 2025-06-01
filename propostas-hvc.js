// propostas-hvc.js - Gerenciamento de Propostas HVC
import { supabase } from "./supabase.js";

// Elementos DOM
const addPropostaForm = document.getElementById("add-proposta-form");
const propostaClienteSelect = document.getElementById("proposta-cliente");
const propostaNumeroInput = document.getElementById("proposta-numero");
const propostaValorInput = document.getElementById("proposta-valor");
const numeroFormatSpan = document.getElementById("numero-format");
const propostasTableBody = document.querySelector("#propostas-table tbody");

// Modais
const linkModal = document.getElementById("link-modal");
const statusModal = document.getElementById("status-modal");
const modalCloseLinkBtn = document.getElementById("modal-close-link");
const modalCloseStatusBtn = document.getElementById("modal-close-status");
const propostaInfoModal = document.getElementById("proposta-info-modal");
const propostaStatusInfo = document.getElementById("proposta-status-info");
const linkForm = document.getElementById("link-form");
const statusForm = document.getElementById("status-form");
const linkInput = document.getElementById("link-input");
const statusMensagemTextarea = document.getElementById("status-mensagem");

// Variáveis globais
let currentPropostaId = null;
let clientes = [];
let propostas = [];

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

// Formatação de número da proposta
function formatNumero(value) {
    // Remove tudo que não é dígito
    const numbers = value.replace(/\D/g, '');
    
    // Limita a 4 dígitos
    const limitedNumbers = numbers.slice(0, 4);
    
    // Formata com zeros à esquerda
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

// Formatação de valor monetário
function formatCurrency(value) {
    // Remove tudo que não é dígito
    const numbers = value.replace(/\D/g, '');
    
    // Converte para formato monetário
    const amount = parseFloat(numbers) / 100;
    
    return amount.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Formatação em tempo real do número
propostaNumeroInput.addEventListener('input', (e) => {
    const formatted = formatNumero(e.target.value);
    e.target.value = formatted;
    
    // Atualiza o ano no formato
    const currentYear = new Date().getFullYear();
    numeroFormatSpan.textContent = `/${currentYear}`;
});

// Formatação em tempo real do valor
propostaValorInput.addEventListener('input', (e) => {
    const formatted = formatCurrency(e.target.value);
    e.target.value = formatted;
});

// Carregar clientes
async function loadClientes() {
    try {
        const { data, error } = await supabase
            .from('clientes_hvc')
            .select('id, nome')
            .order('nome');

        if (error) throw error;

        clientes = data || [];
        renderClientesSelect();
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        alert('Erro ao carregar clientes. Verifique o console.');
    }
}

// Renderizar select de clientes
function renderClientesSelect() {
    propostaClienteSelect.innerHTML = '<option value="">Selecione o Cliente</option>';
    
    clientes.forEach(cliente => {
        const option = document.createElement('option');
        option.value = cliente.id;
        option.textContent = cliente.nome;
        propostaClienteSelect.appendChild(option);
    });
}

// Carregar propostas
async function loadPropostas() {
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
            .order('numero_proposta');

        if (error) throw error;

        propostas = data || [];
        renderPropostas();
    } catch (error) {
        console.error('Erro ao carregar propostas:', error);
        alert('Erro ao carregar propostas. Verifique o console.');
    }
}

// Renderizar tabela de propostas
function renderPropostas() {
    if (propostas.length === 0) {
        propostasTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhuma proposta cadastrada</td></tr>';
        return;
    }

    propostasTableBody.innerHTML = propostas.map(proposta => {
        const statusClass = `status-${proposta.status.toLowerCase()}`;
        const valorFormatado = parseFloat(proposta.valor).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });

        return `
            <tr>
                <td data-label="Cliente">${proposta.clientes_hvc?.nome || 'Cliente não encontrado'}</td>
                <td data-label="Número">${proposta.numero_proposta}</td>
                <td data-label="Valor">${valorFormatado}</td>
                <td data-label="Link">
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button class="hvc-btn" onclick="openLinkModal('${proposta.id}', '${proposta.numero_proposta}')" style="padding: 0.5rem;">
                            <i class="fas fa-link"></i>
                        </button>
                        ${proposta.link_arquivo ? `
                            <button class="hvc-btn hvc-btn-success" onclick="window.open('${proposta.link_arquivo}', '_blank')" style="padding: 0.5rem;">
                                <i class="fas fa-eye"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
                <td data-label="Status">
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <select onchange="updateStatus('${proposta.id}', this.value)" style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #e0e0e0; padding: 0.3rem; border-radius: 4px;">
                            <option value="Pendente" ${proposta.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                            <option value="Aprovada" ${proposta.status === 'Aprovada' ? 'selected' : ''}>Aprovada</option>
                            <option value="Recusada" ${proposta.status === 'Recusada' ? 'selected' : ''}>Recusada</option>
                        </select>
                        ${proposta.status === 'Pendente' ? `
                            <button class="hvc-btn hvc-btn-warning" onclick="openStatusModal('${proposta.id}', '${proposta.numero_proposta}')" style="padding: 0.3rem; font-size: 0.8rem;">
                                <i class="fas fa-comment"></i> Mensagem
                            </button>
                        ` : ''}
                    </div>
                </td>
                <td data-label="Contrato">
                    <select onchange="updateContrato('${proposta.id}', this.value)" style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #e0e0e0; padding: 0.3rem; border-radius: 4px;">
                        <option value="Não" ${proposta.contrato === 'Não' ? 'selected' : ''}>Não</option>
                        <option value="Sim - Pendente" ${proposta.contrato === 'Sim - Pendente' ? 'selected' : ''}>Sim - Pendente</option>
                        <option value="Sim - Assinado" ${proposta.contrato === 'Sim - Assinado' ? 'selected' : ''}>Sim - Assinado</option>
                    </select>
                </td>
                <td data-label="Ações">
                    <button class="hvc-btn hvc-btn-danger" onclick="deleteProposta('${proposta.id}')" style="padding: 0.5rem;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Adicionar proposta
addPropostaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const clienteId = propostaClienteSelect.value;
    const numero = propostaNumeroInput.value.trim();
    const valorStr = propostaValorInput.value.trim();
    
    if (!clienteId || !numero || !valorStr) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
    }
    
    // Converte valor para decimal
    const valor = parseFloat(valorStr.replace(/\./g, '').replace(',', '.'));
    
    if (isNaN(valor) || valor <= 0) {
        alert('Por favor, insira um valor válido.');
        return;
    }
    
    // Formata número completo com ano
    const currentYear = new Date().getFullYear();
    const numeroCompleto = `${numero}/${currentYear}`;
    
    try {
        const { data, error } = await supabase
            .from('propostas_hvc')
            .insert([{
                cliente_id: clienteId,
                numero_proposta: numeroCompleto,
                valor: valor
            }])
            .select();

        if (error) {
            if (error.code === '23505') {
                alert('Já existe uma proposta com este número.');
            } else {
                throw error;
            }
            return;
        }

        // Limpar formulário
        addPropostaForm.reset();
        numeroFormatSpan.textContent = `/${currentYear}`;
        
        // Recarregar lista
        await loadPropostas();
        
        alert('Proposta adicionada com sucesso!');
    } catch (error) {
        console.error('Erro ao adicionar proposta:', error);
        alert('Erro ao adicionar proposta. Verifique o console.');
    }
});

// Atualizar status
window.updateStatus = async (propostaId, status) => {
    try {
        const { error } = await supabase
            .from('propostas_hvc')
            .update({ status })
            .eq('id', propostaId);

        if (error) throw error;

        // Atualizar localmente
        const proposta = propostas.find(p => p.id === propostaId);
        if (proposta) {
            proposta.status = status;
            // Se não for mais pendente, limpar mensagem
            if (status !== 'Pendente') {
                proposta.mensagem_status = null;
                await supabase
                    .from('propostas_hvc')
                    .update({ mensagem_status: null })
                    .eq('id', propostaId);
            }
        }
        
        // Re-renderizar para atualizar botões
        renderPropostas();
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        alert('Erro ao atualizar status.');
        await loadPropostas();
    }
};

// Atualizar contrato
window.updateContrato = async (propostaId, contrato) => {
    try {
        const { error } = await supabase
            .from('propostas_hvc')
            .update({ contrato })
            .eq('id', propostaId);

        if (error) throw error;

        // Atualizar localmente
        const proposta = propostas.find(p => p.id === propostaId);
        if (proposta) {
            proposta.contrato = contrato;
        }
    } catch (error) {
        console.error('Erro ao atualizar contrato:', error);
        alert('Erro ao atualizar contrato.');
        await loadPropostas();
    }
};

// Excluir proposta
window.deleteProposta = async (propostaId) => {
    if (!confirm('Tem certeza que deseja excluir esta proposta? Esta ação não pode ser desfeita.')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('propostas_hvc')
            .delete()
            .eq('id', propostaId);

        if (error) throw error;

        await loadPropostas();
        alert('Proposta excluída com sucesso!');
    } catch (error) {
        console.error('Erro ao excluir proposta:', error);
        alert('Erro ao excluir proposta. Verifique se não há obras associadas.');
    }
};

// Modal de link
window.openLinkModal = (propostaId, numeroProposta) => {
    currentPropostaId = propostaId;
    propostaInfoModal.textContent = `Proposta: ${numeroProposta}`;
    
    // Carregar link atual se existir
    const proposta = propostas.find(p => p.id === propostaId);
    linkInput.value = proposta?.link_arquivo || '';
    
    linkModal.style.display = 'block';
};

// Modal de status
window.openStatusModal = (propostaId, numeroProposta) => {
    currentPropostaId = propostaId;
    propostaStatusInfo.textContent = `Proposta: ${numeroProposta}`;
    
    // Carregar mensagem atual se existir
    const proposta = propostas.find(p => p.id === propostaId);
    statusMensagemTextarea.value = proposta?.mensagem_status || '';
    
    statusModal.style.display = 'block';
};

// Fechar modais
window.closeModal = (modalId) => {
    document.getElementById(modalId).style.display = 'none';
    currentPropostaId = null;
};

modalCloseLinkBtn.addEventListener('click', () => closeModal('link-modal'));
modalCloseStatusBtn.addEventListener('click', () => closeModal('status-modal'));

window.addEventListener('click', (e) => {
    if (e.target === linkModal) {
        closeModal('link-modal');
    }
    if (e.target === statusModal) {
        closeModal('status-modal');
    }
});

// Salvar link
linkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentPropostaId) return;
    
    const link = linkInput.value.trim();
    
    try {
        const { error } = await supabase
            .from('propostas_hvc')
            .update({ link_arquivo: link || null })
            .eq('id', currentPropostaId);

        if (error) throw error;

        // Atualizar localmente
        const proposta = propostas.find(p => p.id === currentPropostaId);
        if (proposta) {
            proposta.link_arquivo = link || null;
        }
        
        renderPropostas();
        closeModal('link-modal');
        
        alert('Link salvo com sucesso!');
    } catch (error) {
        console.error('Erro ao salvar link:', error);
        alert('Erro ao salvar link.');
    }
});

// Salvar mensagem de status
statusForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentPropostaId) return;
    
    const mensagem = statusMensagemTextarea.value.trim();
    
    try {
        const { error } = await supabase
            .from('propostas_hvc')
            .update({ mensagem_status: mensagem || null })
            .eq('id', currentPropostaId);

        if (error) throw error;

        // Atualizar localmente
        const proposta = propostas.find(p => p.id === currentPropostaId);
        if (proposta) {
            proposta.mensagem_status = mensagem || null;
        }
        
        closeModal('status-modal');
        
        alert('Mensagem salva com sucesso!');
    } catch (error) {
        console.error('Erro ao salvar mensagem:', error);
        alert('Erro ao salvar mensagem.');
    }
});

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    if (await checkAccess()) {
        await loadClientes();
        await loadPropostas();
        
        // Definir ano atual no formato
        const currentYear = new Date().getFullYear();
        numeroFormatSpan.textContent = `/${currentYear}`;
    }
});


// servicos-hvc.js - Gerenciamento de Serviços HVC
import { supabase } from "./supabase.js";

// Elementos DOM
const addServicoForm = document.getElementById("add-servico-form");
const servicoValorMinInput = document.getElementById("servico-valor-min");
const servicoValorMaxInput = document.getElementById("servico-valor-max");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const maoObraMinInput = document.getElementById("mao-obra-min");
const maoObraMaxInput = document.getElementById("mao-obra-max");
const materialMinInput = document.getElementById("material-min");
const materialMaxInput = document.getElementById("material-max");
const totalMinInput = document.getElementById("total-min");
const totalMaxInput = document.getElementById("total-max");

// Busca
const searchServicosInput = document.getElementById("search-servicos");
const clearSearchBtn = document.getElementById("clear-search-btn");

// Tabela e estatísticas
const servicosTableBody = document.querySelector("#servicos-table tbody");
const noServicosDiv = document.getElementById("no-servicos");
const totalServicosSpan = document.getElementById("total-servicos");
const valorMedioSpan = document.getElementById("valor-medio");
const servicosAtivosSpan = document.getElementById("servicos-ativos");

// Variáveis globais
let servicos = [];

// Elementos do formulário
const addServicoForm = document.getElementById('add-servico-form');
const servicoIdInput = document.getElementById('servico-id');
const servicoNumeroInput = document.getElementById('servico-numero');
const servicoDescricaoTextarea = document.getElementById('servico-descricao');
const servicoUnidadeSelect = document.getElementById('servico-unidade');
const servicoObservacoesTextarea = document.getElementById('servico-observacoes');

// Elementos dos valores calculados
const maoObraMinInput = document.getElementById('mao-obra-min');
const maoObraMaxInput = document.getElementById('mao-obra-max');
const materialMinInput = document.getElementById('material-min');
const materialMaxInput = document.getElementById('material-max');
const totalMinInput = document.getElementById('total-min');
const totalMaxInput = document.getElementById('total-max');

// Elementos da lista
const servicosTableBody = document.getElementById('servicos-table-body');
const noServicosDiv = document.getElementById('no-servicos');
const searchInput = document.getElementById('search-servicos');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

// Variável de controle
let servicoEditando = null;

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

// Formatação de valor monetário
function formatCurrency(value) {
    if (!value && value !== 0) return 'R$ 0,00';
    
    const numero = typeof value === 'string' ? 
        parseFloat(value.replace(/[R$\s.]/g, '').replace(',', '.')) : 
        parseFloat(value);
    
    if (isNaN(numero)) return 'R$ 0,00';
    
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(numero);
}

// Conversão de valor formatado para decimal
function parseFormattedValue(formattedValue) {
    if (!formattedValue) return 0;
    return parseFloat(formattedValue.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
}

// Carregar serviços
async function loadServicos() {
    try {
        const { data, error } = await supabase
            .from('servicos_hvc')
            .select('*')
            .order('numero');

        if (error) throw error;

        servicos = data || [];
        await calcularValoresMinMax();
        renderServicos();
        updateStats();

    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        alert('Erro ao carregar serviços.');
    }
}

// Calcular valores mínimos e máximos das propostas
async function calcularValoresMinMax() {
    try {
        // Buscar todos os itens de propostas que referenciam serviços
        const { data: itensPropostas, error } = await supabase
            .from('itens_proposta_hvc')
            .select('servico_numero, valor_unitario')
            .not('servico_numero', 'is', null);

        if (error) throw error;

        // Agrupar por serviço e calcular min/max
        const valoresPorServico = {};
        
        itensPropostas?.forEach(item => {
            const numero = item.servico_numero;
            const valor = parseFloat(item.valor_unitario) || 0;
            
            if (!valoresPorServico[numero]) {
                valoresPorServico[numero] = [];
            }
            valoresPorServico[numero].push(valor);
        });

        // Atualizar serviços com valores calculados
        servicos.forEach(servico => {
            const valores = valoresPorServico[servico.numero] || [];
            
            if (valores.length > 0) {
                servico.valor_minimo = Math.min(...valores);
                servico.valor_maximo = Math.max(...valores);
            } else {
                servico.valor_minimo = 0;
                servico.valor_maximo = 0;
            }
        });

    } catch (error) {
        console.error('Erro ao calcular valores min/max:', error);
    }
}

// Renderizar lista de serviços
function renderServicos(servicosFiltrados = null) {
    const servicosParaRender = servicosFiltrados || servicos;
    
    if (servicosParaRender.length === 0) {
        servicosTableBody.innerHTML = '';
        noServicosDiv.style.display = 'block';
        return;
    }

    noServicosDiv.style.display = 'none';
    
    servicosTableBody.innerHTML = servicosParaRender.map(servico => `
        <tr>
            <td><strong>${servico.numero}</strong></td>
            <td>${servico.descricao}</td>
            <td>${servico.unidade_medida}</td>
            <td>
                <div class="valor-range">
                    <span class="valor-min">${formatCurrency(servico.valor_minimo)}</span>
                    <span>-</span>
                    <span class="valor-max">${formatCurrency(servico.valor_maximo)}</span>
                </div>
            </td>
            <td>${servico.observacoes || '-'}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit-btn" onclick="editServico('${servico.id}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteServico('${servico.id}')">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Atualizar estatísticas
function updateStats() {
    const total = servicos.length;
    const ativos = servicos.filter(s => s.ativo !== false).length;
    
    // Calcular valor médio (média dos valores máximos)
    const valoresMaximos = servicos
        .map(s => s.valor_maximo || 0)
        .filter(v => v > 0);
    
    const valorMedio = valoresMaximos.length > 0 ? 
        valoresMaximos.reduce((sum, val) => sum + val, 0) / valoresMaximos.length : 0;

    totalServicosSpan.textContent = total;
    servicosAtivosSpan.textContent = ativos;
    valorMedioSpan.textContent = formatCurrency(valorMedio);
}

// Adicionar/Editar serviço
addServicoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const numero = servicoNumeroInput.value.trim();
    const descricao = servicoDescricaoTextarea.value.trim();
    const unidadeMedida = servicoUnidadeSelect.value;
    const observacoes = servicoObservacoesTextarea.value.trim();
    
    if (!numero || !descricao || !unidadeMedida) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
    }
    
    try {
        if (servicoEditando) {
            // Atualizar serviço existente
            const { error } = await supabase
                .from('servicos_hvc')
                .update({
                    numero,
                    descricao,
                    unidade_medida: unidadeMedida,
                    observacoes
                })
                .eq('id', servicoEditando.id);
            
            if (error) throw error;
            
            // Atualizar o serviço na lista local
            const index = servicos.findIndex(s => s.id === servicoEditando.id);
            if (index !== -1) {
                servicos[index] = {
                    ...servicos[index],
                    numero,
                    descricao,
                    unidade_medida: unidadeMedida,
                    observacoes
                };
            }
            
            alert('Serviço atualizado com sucesso!');
        } else {
            // Criar novo serviço
            const { data, error } = await supabase
                .from('servicos_hvc')
                .insert([{
                    numero,
                    descricao,
                    unidade_medida: unidadeMedida,
                    observacoes,
                    mao_obra_min: 0,
                    mao_obra_max: 0,
                    material_min: 0,
                    material_max: 0,
                    total_min: 0,
                    total_max: 0
                }])
                .select();
            
            if (error) throw error;
            
            // Adicionar o novo serviço à lista local
            if (data && data[0]) {
                servicos.push(data[0]);
            }
            
            alert('Serviço adicionado com sucesso!');
        }
        
        // Recalcular valores e atualizar a exibição
        await calcularValoresMinMax();
        renderServicos();
        clearForm();
        
    } catch (error) {
        console.error('Erro ao salvar serviço:', error);
        alert('Erro ao salvar serviço: ' + error.message);
    }
});

// Editar serviço
window.editServico = (servicoId) => {
    const servico = servicos.find(s => s.id === servicoId);
    if (!servico) return;

    servicoEditando = servico;
    
    // Preencher campos básicos
    servicoIdInput.value = servico.id;
    servicoNumeroInput.value = servico.numero;
    servicoDescricaoTextarea.value = servico.descricao;
    servicoUnidadeSelect.value = servico.unidade_medida;
    servicoObservacoesTextarea.value = servico.observacoes || '';
    
    // Preencher valores calculados (verificar se os elementos existem)
    if (maoObraMinInput) maoObraMinInput.value = formatCurrency(servico.mao_obra_min || 0);
    if (maoObraMaxInput) maoObraMaxInput.value = formatCurrency(servico.mao_obra_max || 0);
    if (materialMinInput) materialMinInput.value = formatCurrency(servico.material_min || 0);
    if (materialMaxInput) materialMaxInput.value = formatCurrency(servico.material_max || 0);
    if (totalMinInput) totalMinInput.value = formatCurrency(servico.total_min || 0);
    if (totalMaxInput) totalMaxInput.value = formatCurrency(servico.total_max || 0);

    // Alterar botão para modo edição
    const submitBtn = addServicoForm.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar Serviço';
    submitBtn.className = 'hvc-btn hvc-btn-warning';
    
    if (cancelEditBtn) cancelEditBtn.style.display = 'inline-block';
    
    // Scroll para o formulário
    addServicoForm.scrollIntoView({ behavior: 'smooth' });
};


// Excluir serviço
window.deleteServico = async (servicoId) => {
    const servico = servicos.find(s => s.id === servicoId);
    if (!servico) return;

    if (!confirm(`Tem certeza que deseja excluir o serviço "${servico.numero} - ${servico.descricao}"?`)) {
        return;
    }

    try {
        // Verificar se o serviço está sendo usado em propostas
        const { data: itensPropostas, error: checkError } = await supabase
            .from('itens_proposta_hvc')
            .select('id')
            .eq('servico_numero', servico.numero)
            .limit(1);

        if (checkError) throw checkError;

        if (itensPropostas && itensPropostas.length > 0) {
            alert('Este serviço não pode ser excluído pois está sendo usado em propostas.');
            return;
        }

        // Verificar se o serviço está sendo usado em obras
        const { data: servicosObra, error: checkObraError } = await supabase
            .from('servicos_obra_hvc')
            .select('id')
            .eq('servico_numero', servico.numero)
            .limit(1);

        if (checkObraError) throw checkObraError;

        if (servicosObra && servicosObra.length > 0) {
            alert('Este serviço não pode ser excluído pois está sendo usado em obras.');
            return;
        }

        // Excluir serviço
        const { error } = await supabase
            .from('servicos_hvc')
            .delete()
            .eq('id', servicoId);

        if (error) throw error;

        alert('Serviço excluído com sucesso!');
        await loadServicos();

    } catch (error) {
        console.error('Erro ao excluir serviço:', error);
        alert('Erro ao excluir serviço: ' + error.message);
    }
};

// Cancelar edição
cancelEditBtn.addEventListener('click', clearForm);

// Limpar formulário
function clearForm() {
    servicoEditando = null;
    addServicoForm.reset();
    servicoIdInput.value = '';
    
    // Limpar campos de valores (verificar se os elementos existem)
    if (maoObraMinInput) maoObraMinInput.value = '';
    if (maoObraMaxInput) maoObraMaxInput.value = '';
    if (materialMinInput) materialMinInput.value = '';
    if (materialMaxInput) materialMaxInput.value = '';
    if (totalMinInput) totalMinInput.value = '';
    if (totalMaxInput) totalMaxInput.value = '';
    
    const submitBtn = addServicoForm.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="fas fa-plus"></i> Adicionar Serviço';
    submitBtn.className = 'hvc-btn hvc-btn-success';
    
    cancelEditBtn.style.display = 'none';
}

// Busca de serviços
searchServicosInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    
    if (!searchTerm) {
        renderServicos();
        return;
    }

    const servicosFiltrados = servicos.filter(servico => 
        servico.numero.toLowerCase().includes(searchTerm) ||
        servico.descricao.toLowerCase().includes(searchTerm) ||
        servico.unidade_medida.toLowerCase().includes(searchTerm) ||
        (servico.observacoes && servico.observacoes.toLowerCase().includes(searchTerm))
    );

    renderServicos(servicosFiltrados);
});

// Limpar busca
clearSearchBtn.addEventListener('click', () => {
    searchServicosInput.value = '';
    renderServicos();
});

// Formatação automática do número do serviço
servicoNumeroInput.addEventListener('input', (e) => {
    let value = e.target.value.toUpperCase();
    // Permitir apenas letras, números e alguns caracteres especiais
    value = value.replace(/[^A-Z0-9\-_]/g, '');
    e.target.value = value;
});

// FUNÇÃO DE INICIALIZAÇÃO SIMPLIFICADA

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Inicializando página de serviços...');
        
        // Verificar se os elementos existem
        if (!servicoNumeroInput) {
            console.error('Elemento servico-numero não encontrado');
            return;
        }
        
        // Carregar serviços
        await loadServicos();
        
        // Calcular valores min/max
        await calcularValoresMinMax();
        
        // Renderizar lista
        renderServicos();
        
        console.log('Página de serviços inicializada com sucesso');
        
    } catch (error) {
        console.error('Erro ao inicializar página:', error);
    }
});

// FUNÇÃO PARA CARREGAR SERVIÇOS SIMPLIFICADA:

async function loadServicos() {
    try {
        console.log('Carregando serviços...');
        
        const { data, error } = await supabase
            .from('servicos_hvc')
            .select('*')
            .order('numero');

        if (error) {
            console.error('Erro do Supabase:', error);
            throw error;
        }

        servicos = data || [];
        console.log('Serviços carregados:', servicos.length);
        
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        servicos = [];
    }
}




// fluxo-caixa-hvc.js - Gerenciamento de Fluxo de Caixa HVC
import { supabase } from "./supabase.js";

// Elementos DOM
const addRecebimentoForm = document.getElementById("add-recebimento-form");
const addPagamentoForm = document.getElementById("add-pagamento-form");
const addTipoForm = document.getElementById("add-tipo-form");
const addCategoriaForm = document.getElementById("add-categoria-form");
const addSubcategoriaForm = document.getElementById("add-subcategoria-form");

// Inputs de recebimento
const recebimentoDataInput = document.getElementById("recebimento-data");
const recebimentoValorInput = document.getElementById("recebimento-valor");
const recebimentoTipoSelect = document.getElementById("recebimento-tipo");
const recebimentoObraSelect = document.getElementById("recebimento-obra");
const recebimentoServicoSelect = document.getElementById("recebimento-servico");
const recebimentoMedicaoSelect = document.getElementById("recebimento-medicao");
const recebimentoObservacoesTextarea = document.getElementById("recebimento-observacoes");

// Inputs de pagamento
const pagamentoDataInput = document.getElementById("pagamento-data");
const pagamentoValorInput = document.getElementById("pagamento-valor");
const pagamentoObraSelect = document.getElementById("pagamento-obra");
const pagamentoTipoSelect = document.getElementById("pagamento-tipo");
const pagamentoCategoriaSelect = document.getElementById("pagamento-categoria");
const pagamentoSubcategoriaSelect = document.getElementById("pagamento-subcategoria");
const pagamentoObservacoesTextarea = document.getElementById("pagamento-observacoes");

// Inputs de categorias
const tipoNomeInput = document.getElementById("tipo-nome");
const categoriaTipoSelect = document.getElementById("categoria-tipo");
const categoriaNomeInput = document.getElementById("categoria-nome");
const subcategoriaCategoriaSelect = document.getElementById("subcategoria-categoria");
const subcategoriaNomeInput = document.getElementById("subcategoria-nome");

// Listas
const tiposList = document.getElementById("tipos-list");
const categoriasList = document.getElementById("categorias-list");
const subcategoriasList = document.getElementById("subcategorias-list");
const fluxoTableBody = document.querySelector("#fluxo-table tbody");

// Campos condicionais
const semMedicaoFields = document.getElementById("sem-medicao-fields");
const medicaoFields = document.getElementById("medicao-fields");

// Variáveis globais
let obras = [];
let tipos = [];
let categorias = [];
let subcategorias = [];
let medicoes = [];
let movimentacoes = [];

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
    const numbers = value.replace(/\D/g, '');
    const amount = parseFloat(numbers) / 100;
    
    return amount.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Formatação em tempo real dos valores
recebimentoValorInput.addEventListener('input', (e) => {
    e.target.value = formatCurrency(e.target.value);
});

pagamentoValorInput.addEventListener('input', (e) => {
    e.target.value = formatCurrency(e.target.value);
});

// Conversão de valor formatado para decimal
function parseFormattedValue(formattedValue) {
    return parseFloat(formattedValue.replace(/\./g, '').replace(',', '.'));
}

// Alternar tabs
window.switchTab = (tabName) => {
    // Remover active de todos os botões e conteúdos
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Ativar tab selecionada
    document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Carregar dados específicos da tab
    if (tabName === 'categorias') {
        loadTiposForManagement();
    }
};

// Toggle campos condicionais de recebimento
window.toggleRecebimentoFields = () => {
    const tipo = recebimentoTipoSelect.value;
    
    semMedicaoFields.classList.remove('show');
    medicaoFields.classList.remove('show');
    
    if (tipo === 'pago_sem_medicao') {
        semMedicaoFields.classList.add('show');
    } else if (tipo === 'medicao') {
        medicaoFields.classList.add('show');
    }
};

// Carregar obras
async function loadObras() {
    try {
        const { data, error } = await supabase
            .from('obras_hvc')
            .select('id, numero_obra, status')
            .neq('status', 'Concluída')
            .order('numero_obra');

        if (error) throw error;

        obras = data || [];
        renderObrasSelects();
    } catch (error) {
        console.error('Erro ao carregar obras:', error);
    }
}

// Renderizar selects de obras
function renderObrasSelects() {
    const selects = [recebimentoObraSelect, pagamentoObraSelect];
    
    selects.forEach(select => {
        const isRequired = select === recebimentoObraSelect;
        select.innerHTML = `<option value="">${isRequired ? 'Selecione a Obra' : 'Obra Relacionada (opcional)'}</option>`;
        
        obras.forEach(obra => {
            const option = document.createElement('option');
            option.value = obra.id;
            option.textContent = `${obra.numero_obra} (${obra.status})`;
            select.appendChild(option);
        });
    });
}

// Carregar serviços da obra selecionada
recebimentoObraSelect.addEventListener('change', async () => {
    const obraId = recebimentoObraSelect.value;
    
    recebimentoServicoSelect.innerHTML = '<option value="">Selecione o Serviço (opcional)</option>';
    
    if (!obraId) return;
    
    try {
        const { data, error } = await supabase
            .from('servicos_obra_hvc')
            .select('id, nome_servico')
            .eq('obra_id', obraId)
            .order('nome_servico');

        if (error) throw error;

        (data || []).forEach(servico => {
            const option = document.createElement('option');
            option.value = servico.id;
            option.textContent = servico.nome_servico;
            recebimentoServicoSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
    }
});

// Carregar medições
async function loadMedicoes() {
    try {
        const { data, error } = await supabase
            .from('medicoes_obra_hvc')
            .select(`
                *,
                obras_hvc (
                    numero_obra,
                    status
                )
            `)
            .order('numero_medicao');

        if (error) throw error;

        medicoes = data || [];
        renderMedicoesSelect();
    } catch (error) {
        console.error('Erro ao carregar medições:', error);
    }
}

// Renderizar select de medições
function renderMedicoesSelect() {
    recebimentoMedicaoSelect.innerHTML = '<option value="">Selecione a Medição</option>';
    
    medicoes.forEach(medicao => {
        const option = document.createElement('option');
        option.value = medicao.id;
        option.textContent = `${medicao.numero_medicao} - ${medicao.obras_hvc?.numero_obra} (${medicao.pago ? 'Pago' : 'Não Pago'})`;
        recebimentoMedicaoSelect.appendChild(option);
    });
}

// Carregar tipos de pagamento
async function loadTipos() {
    try {
        const { data, error } = await supabase
            .from('tipos_pagamento_hvc')
            .select('*')
            .order('nome');

        if (error) throw error;

        tipos = data || [];
        renderTiposSelect();
    } catch (error) {
        console.error('Erro ao carregar tipos:', error);
    }
}

// Renderizar select de tipos
function renderTiposSelect() {
    const selects = [pagamentoTipoSelect, categoriaTipoSelect];
    
    selects.forEach(select => {
        select.innerHTML = '<option value="">Selecione o Tipo</option>';
        
        tipos.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo.id;
            option.textContent = tipo.nome;
            select.appendChild(option);
        });
    });
}

// Carregar categorias
window.loadCategorias = async () => {
    const tipoId = pagamentoTipoSelect.value;
    
    pagamentoCategoriaSelect.innerHTML = '<option value="">Selecione a Categoria</option>';
    pagamentoSubcategoriaSelect.innerHTML = '<option value="">Selecione a Subcategoria</option>';
    
    if (!tipoId) return;
    
    try {
        const { data, error } = await supabase
            .from('categorias_pagamento_hvc')
            .select('*')
            .eq('tipo_id', tipoId)
            .order('nome');

        if (error) throw error;

        (data || []).forEach(categoria => {
            const option = document.createElement('option');
            option.value = categoria.id;
            option.textContent = categoria.nome;
            pagamentoCategoriaSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
    }
};

// Carregar subcategorias
window.loadSubcategorias = async () => {
    const categoriaId = pagamentoCategoriaSelect.value;
    
    pagamentoSubcategoriaSelect.innerHTML = '<option value="">Selecione a Subcategoria</option>';
    
    if (!categoriaId) return;
    
    try {
        const { data, error } = await supabase
            .from('subcategorias_pagamento_hvc')
            .select('*')
            .eq('categoria_id', categoriaId)
            .order('nome');

        if (error) throw error;

        (data || []).forEach(subcategoria => {
            const option = document.createElement('option');
            option.value = subcategoria.id;
            option.textContent = subcategoria.nome;
            pagamentoSubcategoriaSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar subcategorias:', error);
    }
};

// Adicionar recebimento
addRecebimentoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = recebimentoDataInput.value;
    const valorStr = recebimentoValorInput.value.trim();
    const tipo = recebimentoTipoSelect.value;
    const observacoes = recebimentoObservacoesTextarea.value.trim();
    
    if (!data || !valorStr || !tipo) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
    }
    
    const valor = parseFormattedValue(valorStr);
    
    if (isNaN(valor) || valor <= 0) {
        alert('Por favor, insira um valor válido.');
        return;
    }
    
    let insertData = {
        tipo_movimento: 'Recebimento',
        data_movimento: data,
        valor: valor,
        observacoes: observacoes || null
    };
    
    if (tipo === 'pago_sem_medicao') {
        const obraId = recebimentoObraSelect.value;
        const servicoId = recebimentoServicoSelect.value;
        
        if (!obraId) {
            alert('Por favor, selecione uma obra.');
            return;
        }
        
        insertData.obra_id = obraId;
        insertData.servico_id = servicoId || null;
        insertData.pago_sem_medicao = true;
    } else if (tipo === 'medicao') {
        const medicaoId = recebimentoMedicaoSelect.value;
        
        if (!medicaoId) {
            alert('Por favor, selecione uma medição.');
            return;
        }
        
        insertData.medicao_id = medicaoId;
        insertData.pago_sem_medicao = false;
        
        // Buscar obra da medição
        const medicao = medicoes.find(m => m.id === medicaoId);
        if (medicao) {
            insertData.obra_id = medicao.obra_id;
        }
    }
    
    try {
        const { error } = await supabase
            .from('fluxo_caixa_hvc')
            .insert([insertData]);

        if (error) throw error;

        // Se for medição, marcar como paga
        if (tipo === 'medicao') {
            await supabase
                .from('medicoes_obra_hvc')
                .update({ 
                    pago: true,
                    data_pagamento: new Date().toISOString()
                })
                .eq('id', insertData.medicao_id);
        }

        addRecebimentoForm.reset();
        toggleRecebimentoFields();
        await loadMovimentacoes();
        await loadMedicoes(); // Recarregar para atualizar status
        
        alert('Recebimento adicionado com sucesso!');
    } catch (error) {
        console.error('Erro ao adicionar recebimento:', error);
        alert('Erro ao adicionar recebimento.');
    }
});

// Adicionar pagamento
addPagamentoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = pagamentoDataInput.value;
    const valorStr = pagamentoValorInput.value.trim();
    const obraId = pagamentoObraSelect.value;
    const tipoId = pagamentoTipoSelect.value;
    const categoriaId = pagamentoCategoriaSelect.value;
    const subcategoriaId = pagamentoSubcategoriaSelect.value;
    const observacoes = pagamentoObservacoesTextarea.value.trim();
    
    if (!data || !valorStr || !tipoId || !categoriaId || !subcategoriaId) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
    }
    
    const valor = parseFormattedValue(valorStr);
    
    if (isNaN(valor) || valor <= 0) {
        alert('Por favor, insira um valor válido.');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('fluxo_caixa_hvc')
            .insert([{
                tipo_movimento: 'Pagamento',
                data_movimento: data,
                valor: valor,
                obra_id: obraId || null,
                tipo_pagamento_id: tipoId,
                categoria_pagamento_id: categoriaId,
                subcategoria_pagamento_id: subcategoriaId,
                observacoes: observacoes || null
            }]);

        if (error) throw error;

        addPagamentoForm.reset();
        await loadMovimentacoes();
        
        alert('Pagamento adicionado com sucesso!');
    } catch (error) {
        console.error('Erro ao adicionar pagamento:', error);
        alert('Erro ao adicionar pagamento.');
    }
});

// Carregar movimentações
async function loadMovimentacoes() {
    try {
        const { data, error } = await supabase
            .from('fluxo_caixa_hvc')
            .select(`
                *,
                obras_hvc (
                    numero_obra
                ),
                medicoes_obra_hvc (
                    numero_medicao
                ),
                servicos_obra_hvc (
                    nome_servico
                ),
                tipos_pagamento_hvc (
                    nome
                ),
                categorias_pagamento_hvc (
                    nome
                ),
                subcategorias_pagamento_hvc (
                    nome
                )
            `)
            .order('data_movimento', { ascending: false });

        if (error) throw error;

        movimentacoes = data || [];
        renderMovimentacoes();
    } catch (error) {
        console.error('Erro ao carregar movimentações:', error);
    }
}

// Renderizar tabela de movimentações
function renderMovimentacoes() {
    if (movimentacoes.length === 0) {
        fluxoTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhuma movimentação registrada</td></tr>';
        return;
    }

    fluxoTableBody.innerHTML = movimentacoes.map(mov => {
        const valorFormatado = parseFloat(mov.valor).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
        
        const retencaoFormatado = parseFloat(mov.retencao_adicao || 0).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
        
        const isRecebimento = mov.tipo_movimento === 'Recebimento';
        const valorClass = isRecebimento ? 'valor-positivo' : 'valor-negativo';
        const movimentoClass = isRecebimento ? 'movimento-recebimento' : 'movimento-pagamento';
        
        let descricao = '';
        if (isRecebimento) {
            if (mov.pago_sem_medicao) {
                descricao = `Recebimento sem medição`;
                if (mov.servicos_obra_hvc?.nome_servico) {
                    descricao += ` - ${mov.servicos_obra_hvc.nome_servico}`;
                }
            } else if (mov.medicoes_obra_hvc?.numero_medicao) {
                descricao = `Medição ${mov.medicoes_obra_hvc.numero_medicao}`;
            }
        } else {
            const tipo = mov.tipos_pagamento_hvc?.nome || '';
            const categoria = mov.categorias_pagamento_hvc?.nome || '';
            const subcategoria = mov.subcategorias_pagamento_hvc?.nome || '';
            descricao = `${tipo} - ${categoria} - ${subcategoria}`;
        }

        return `
            <tr class="${movimentoClass}">
                <td data-label="Data">${new Date(mov.data_movimento).toLocaleDateString('pt-BR')}</td>
                <td data-label="Tipo">
                    <span style="font-weight: bold; color: ${isRecebimento ? '#90EE90' : '#FFB6C1'};">
                        ${mov.tipo_movimento}
                    </span>
                </td>
                <td data-label="Descrição">
                    ${descricao}
                    ${mov.observacoes ? `<br><small style="color: #c0c0c0;">${mov.observacoes}</small>` : ''}
                </td>
                <td data-label="Obra">${mov.obras_hvc?.numero_obra || '-'}</td>
                <td data-label="Valor" class="${valorClass}">${isRecebimento ? '+' : '-'}${valorFormatado}</td>
                <td data-label="Ret/Add">${retencaoFormatado}</td>
                <td data-label="Ações">
                    <button class="hvc-btn hvc-btn-danger" onclick="deleteMovimentacao('${mov.id}')" style="padding: 0.5rem;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Excluir movimentação
window.deleteMovimentacao = async (movimentacaoId) => {
    if (!confirm('Tem certeza que deseja excluir esta movimentação?')) {
        return;
    }
    
    try {
        // Buscar a movimentação para verificar se é medição
        const movimentacao = movimentacoes.find(m => m.id === movimentacaoId);
        
        const { error } = await supabase
            .from('fluxo_caixa_hvc')
            .delete()
            .eq('id', movimentacaoId);

        if (error) throw error;

        // Se era uma medição, desmarcar como paga
        if (movimentacao && movimentacao.medicao_id) {
            await supabase
                .from('medicoes_obra_hvc')
                .update({ 
                    pago: false,
                    data_pagamento: null
                })
                .eq('id', movimentacao.medicao_id);
        }

        await loadMovimentacoes();
        await loadMedicoes(); // Recarregar para atualizar status
        
        alert('Movimentação excluída com sucesso!');
    } catch (error) {
        console.error('Erro ao excluir movimentação:', error);
        alert('Erro ao excluir movimentação.');
    }
};

// Gerenciamento de tipos, categorias e subcategorias
async function loadTiposForManagement() {
    await loadTipos();
    renderTiposList();
    renderCategoriasManagement();
    renderSubcategoriasManagement();
}

// Renderizar lista de tipos para gerenciamento
function renderTiposList() {
    if (tipos.length === 0) {
        tiposList.innerHTML = '<p style="text-align: center; color: #c0c0c0;">Nenhum tipo cadastrado</p>';
        return;
    }

    tiposList.innerHTML = tipos.map(tipo => `
        <div class="categoria-item">
            <input type="text" value="${tipo.nome}" 
                   onchange="updateTipo('${tipo.id}', this.value)"
                   class="hvc-input">
            <button class="hvc-btn hvc-btn-danger" onclick="deleteTipo('${tipo.id}')" style="padding: 0.5rem;">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

// Adicionar tipo
addTipoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nome = tipoNomeInput.value.trim();
    
    if (!nome) {
        alert('O nome do tipo é obrigatório.');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('tipos_pagamento_hvc')
            .insert([{ nome }]);

        if (error) {
            if (error.code === '23505') {
                alert('Já existe um tipo com este nome.');
            } else {
                throw error;
            }
            return;
        }

        tipoNomeInput.value = '';
        await loadTiposForManagement();
        
        alert('Tipo adicionado com sucesso!');
    } catch (error) {
        console.error('Erro ao adicionar tipo:', error);
        alert('Erro ao adicionar tipo.');
    }
});

// Atualizar tipo
window.updateTipo = async (tipoId, nome) => {
    if (!nome.trim()) {
        alert('O nome não pode estar vazio.');
        await loadTiposForManagement();
        return;
    }
    
    try {
        const { error } = await supabase
            .from('tipos_pagamento_hvc')
            .update({ nome: nome.trim() })
            .eq('id', tipoId);

        if (error) {
            if (error.code === '23505') {
                alert('Já existe um tipo com este nome.');
                await loadTiposForManagement();
            } else {
                throw error;
            }
            return;
        }

        // Atualizar localmente
        const tipo = tipos.find(t => t.id === tipoId);
        if (tipo) {
            tipo.nome = nome.trim();
        }
    } catch (error) {
        console.error('Erro ao atualizar tipo:', error);
        await loadTiposForManagement();
    }
};

// Excluir tipo
window.deleteTipo = async (tipoId) => {
    if (!confirm('Tem certeza que deseja excluir este tipo? Todas as categorias e subcategorias associadas também serão excluídas.')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('tipos_pagamento_hvc')
            .delete()
            .eq('id', tipoId);

        if (error) throw error;

        await loadTiposForManagement();
        alert('Tipo excluído com sucesso!');
    } catch (error) {
        console.error('Erro ao excluir tipo:', error);
        alert('Erro ao excluir tipo.');
    }
};

// Renderizar gerenciamento de categorias
async function renderCategoriasManagement() {
    try {
        const { data, error } = await supabase
            .from('categorias_pagamento_hvc')
            .select(`
                *,
                tipos_pagamento_hvc (
                    nome
                )
            `)
            .order('nome');

        if (error) throw error;

        categorias = data || [];
        
        if (categorias.length === 0) {
            categoriasList.innerHTML = '<p style="text-align: center; color: #c0c0c0;">Nenhuma categoria cadastrada</p>';
            return;
        }

        categoriasList.innerHTML = categorias.map(categoria => `
            <div class="categoria-item">
                <div>
                    <strong>${categoria.tipos_pagamento_hvc?.nome}</strong><br>
                    <input type="text" value="${categoria.nome}" 
                           onchange="updateCategoria('${categoria.id}', this.value)"
                           class="hvc-input" style="margin-top: 0.5rem;">
                </div>
                <button class="hvc-btn hvc-btn-danger" onclick="deleteCategoria('${categoria.id}')" style="padding: 0.5rem;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
    }
}

// Adicionar categoria
addCategoriaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const tipoId = categoriaTipoSelect.value;
    const nome = categoriaNomeInput.value.trim();
    
    if (!tipoId || !nome) {
        alert('Por favor, preencha todos os campos.');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('categorias_pagamento_hvc')
            .insert([{ tipo_id: tipoId, nome }]);

        if (error) {
            if (error.code === '23505') {
                alert('Já existe uma categoria com este nome para este tipo.');
            } else {
                throw error;
            }
            return;
        }

        addCategoriaForm.reset();
        await renderCategoriasManagement();
        await renderSubcategoriasManagement();
        
        alert('Categoria adicionada com sucesso!');
    } catch (error) {
        console.error('Erro ao adicionar categoria:', error);
        alert('Erro ao adicionar categoria.');
    }
});

// Atualizar categoria
window.updateCategoria = async (categoriaId, nome) => {
    if (!nome.trim()) {
        alert('O nome não pode estar vazio.');
        await renderCategoriasManagement();
        return;
    }
    
    try {
        const { error } = await supabase
            .from('categorias_pagamento_hvc')
            .update({ nome: nome.trim() })
            .eq('id', categoriaId);

        if (error) {
            if (error.code === '23505') {
                alert('Já existe uma categoria com este nome para este tipo.');
                await renderCategoriasManagement();
            } else {
                throw error;
            }
            return;
        }
    } catch (error) {
        console.error('Erro ao atualizar categoria:', error);
        await renderCategoriasManagement();
    }
};

// Excluir categoria
window.deleteCategoria = async (categoriaId) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria? Todas as subcategorias associadas também serão excluídas.')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('categorias_pagamento_hvc')
            .delete()
            .eq('id', categoriaId);

        if (error) throw error;

        await renderCategoriasManagement();
        await renderSubcategoriasManagement();
        alert('Categoria excluída com sucesso!');
    } catch (error) {
        console.error('Erro ao excluir categoria:', error);
        alert('Erro ao excluir categoria.');
    }
};

// Renderizar gerenciamento de subcategorias
async function renderSubcategoriasManagement() {
    try {
        // Carregar categorias para o select
        subcategoriaCategoriaSelect.innerHTML = '<option value="">Selecione a Categoria</option>';
        categorias.forEach(categoria => {
            const option = document.createElement('option');
            option.value = categoria.id;
            option.textContent = `${categoria.tipos_pagamento_hvc?.nome} - ${categoria.nome}`;
            subcategoriaCategoriaSelect.appendChild(option);
        });

        const { data, error } = await supabase
            .from('subcategorias_pagamento_hvc')
            .select(`
                *,
                categorias_pagamento_hvc (
                    nome,
                    tipos_pagamento_hvc (
                        nome
                    )
                )
            `)
            .order('nome');

        if (error) throw error;

        subcategorias = data || [];
        
        if (subcategorias.length === 0) {
            subcategoriasList.innerHTML = '<p style="text-align: center; color: #c0c0c0;">Nenhuma subcategoria cadastrada</p>';
            return;
        }

        subcategoriasList.innerHTML = subcategorias.map(subcategoria => `
            <div class="categoria-item">
                <div>
                    <strong>${subcategoria.categorias_pagamento_hvc?.tipos_pagamento_hvc?.nome} - ${subcategoria.categorias_pagamento_hvc?.nome}</strong><br>
                    <input type="text" value="${subcategoria.nome}" 
                           onchange="updateSubcategoria('${subcategoria.id}', this.value)"
                           class="hvc-input" style="margin-top: 0.5rem;">
                </div>
                <button class="hvc-btn hvc-btn-danger" onclick="deleteSubcategoria('${subcategoria.id}')" style="padding: 0.5rem;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar subcategorias:', error);
    }
}

// Adicionar subcategoria
addSubcategoriaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const categoriaId = subcategoriaCategoriaSelect.value;
    const nome = subcategoriaNomeInput.value.trim();
    
    if (!categoriaId || !nome) {
        alert('Por favor, preencha todos os campos.');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('subcategorias_pagamento_hvc')
            .insert([{ categoria_id: categoriaId, nome }]);

        if (error) {
            if (error.code === '23505') {
                alert('Já existe uma subcategoria com este nome para esta categoria.');
            } else {
                throw error;
            }
            return;
        }

        addSubcategoriaForm.reset();
        await renderSubcategoriasManagement();
        
        alert('Subcategoria adicionada com sucesso!');
    } catch (error) {
        console.error('Erro ao adicionar subcategoria:', error);
        alert('Erro ao adicionar subcategoria.');
    }
});

// Atualizar subcategoria
window.updateSubcategoria = async (subcategoriaId, nome) => {
    if (!nome.trim()) {
        alert('O nome não pode estar vazio.');
        await renderSubcategoriasManagement();
        return;
    }
    
    try {
        const { error } = await supabase
            .from('subcategorias_pagamento_hvc')
            .update({ nome: nome.trim() })
            .eq('id', subcategoriaId);

        if (error) {
            if (error.code === '23505') {
                alert('Já existe uma subcategoria com este nome para esta categoria.');
                await renderSubcategoriasManagement();
            } else {
                throw error;
            }
            return;
        }
    } catch (error) {
        console.error('Erro ao atualizar subcategoria:', error);
        await renderSubcategoriasManagement();
    }
};

// Excluir subcategoria
window.deleteSubcategoria = async (subcategoriaId) => {
    if (!confirm('Tem certeza que deseja excluir esta subcategoria?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('subcategorias_pagamento_hvc')
            .delete()
            .eq('id', subcategoriaId);

        if (error) throw error;

        await renderSubcategoriasManagement();
        alert('Subcategoria excluída com sucesso!');
    } catch (error) {
        console.error('Erro ao excluir subcategoria:', error);
        alert('Erro ao excluir subcategoria.');
    }
};

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    if (await checkAccess()) {
        await loadObras();
        await loadMedicoes();
        await loadTipos();
        await loadMovimentacoes();
    }
});


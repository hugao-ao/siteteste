// Importar Supabase do arquivo existente
import { supabase as supabaseClient } from './supabase.js';

let medicoesManager = null;

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Verificar se o Supabase está disponível
    if (supabaseClient) {
        // Inicializar o gerenciador de medições
        medicoesManager = new MedicoesManager();
        
        // Expor globalmente para uso nos event handlers inline
        window.medicoesManager = medicoesManager;
        
        // Expor funções globalmente para os onclick
        window.abrirModalNovaMedicao = () => medicoesManager.abrirModalNovaMedicao();
        window.fecharModalMedicao = () => medicoesManager.fecharModalMedicao();
        window.abrirModalObras = () => medicoesManager.abrirModalObras();
        window.fecharModalObras = () => medicoesManager.fecharModalObras();
        window.abrirModalValor = () => medicoesManager.abrirModalValor();
        window.fecharModalValor = () => medicoesManager.fecharModalValor();
        window.selecionarObra = (obraId) => medicoesManager.selecionarObra(obraId);
        window.salvarMedicao = (event) => medicoesManager.salvarMedicao(event);
        window.confirmarESalvarMedicao = () => medicoesManager.confirmarESalvarMedicao();
        window.excluirMedicao = (medicaoId) => medicoesManager.excluirMedicao(medicaoId);
        window.limparFiltros = () => medicoesManager.limparFiltros();
        window.atualizarCalculos = () => medicoesManager.atualizarCalculos();
        
    } else {
        showNotification('Erro de conexão com o banco de dados', 'error');
    }
}

class MedicoesManager {
    constructor() {
        this.obras = [];
        this.medicoes = [];
        this.servicosObra = [];
        this.obraSelecionada = null;
        this.valorTotalCalculado = 0;
        
        this.init();
    }

    async init() {
        try {
            await this.loadObras();
            await this.loadMedicoes();
            this.setupEventListeners();
        } catch (error) {
            this.showNotification('Erro ao inicializar aplicação: ' + error.message, 'error');
        }
    }

    setupEventListeners() {
        // Filtros
        const filtroObra = document.getElementById('filtro-obra');
        const filtroStatus = document.getElementById('filtro-status');
        const filtroData = document.getElementById('filtro-data');
        
        if (filtroObra) filtroObra.addEventListener('change', () => this.aplicarFiltros());
        if (filtroStatus) filtroStatus.addEventListener('change', () => this.aplicarFiltros());
        if (filtroData) filtroData.addEventListener('change', () => this.aplicarFiltros());
        
        // Busca de obras
        const searchObras = document.getElementById('search-obras');
        if (searchObras) {
            searchObras.addEventListener('input', (e) => this.filtrarObras(e.target.value));
        }
    }

    // ========================================
    // UTILITÁRIO PARA VERIFICAR ELEMENTOS
    // ========================================
    
    getElement(id) {
        const element = document.getElementById(id);
        return element;
    }

    // ========================================
    // BUSCA DE CLIENTE VIA PROPOSTAS
    // ========================================

    async buscarClienteViaPropostas(obraId) {
        try {
            // 1. Buscar propostas da obra
            const { data: obrasPropostas, error: opError } = await supabaseClient
                .from('obras_propostas')
                .select('proposta_id')
                .eq('obra_id', obraId);

            if (opError || !obrasPropostas || obrasPropostas.length === 0) {
                return null;
            }

            // 2. Buscar dados das propostas
            const propostaIds = obrasPropostas.map(op => op.proposta_id);
            const { data: propostas, error: propError } = await supabaseClient
                .from('propostas_hvc')
                .select('*')
                .in('id', propostaIds);

            if (propError || !propostas || propostas.length === 0) {
                return null;
            }

            // 3. Buscar cliente da primeira proposta
            const primeiraProposta = propostas[0];

            if (!primeiraProposta.cliente_id) {
                return null;
            }

            // 4. Buscar dados do cliente
            const { data: cliente, error: clienteError } = await supabaseClient
                .from('clientes_hvc')
                .select('*')
                .eq('id', primeiraProposta.cliente_id)
                .single();

            if (clienteError || !cliente) {
                return null;
            }

            return cliente;

        } catch (error) {
            return null;
        }
    }

    // ========================================
    // CARREGAMENTO DE DADOS
    // ========================================

    async loadObras() {
        try {
            // Buscar obras simples primeiro
            const { data: obras, error: obrasError } = await supabaseClient
                .from('obras_hvc')
                .select('*')
                .eq('status', 'Andamento')
                .order('numero_obra');

            if (obrasError) throw obrasError;

            // Buscar clientes separadamente
            const { data: clientes, error: clientesError } = await supabaseClient
                .from('clientes_hvc')
                .select('*');

            if (clientesError) throw clientesError;

            // Combinar dados manualmente com busca via propostas
            this.obras = [];
            
            for (const obra of obras || []) {
                let cliente = null;
                
                // Tentar buscar cliente direto da obra
                if (obra.cliente_id) {
                    cliente = clientes?.find(c => c.id === obra.cliente_id);
                }
                
                // Se não encontrou, tentar via propostas
                if (!cliente) {
                    cliente = await this.buscarClienteViaPropostas(obra.id);
                }
                
                this.obras.push({
                    ...obra,
                    cliente: cliente || { nome: 'Cliente não definido' }
                });
            }

            this.populateObrasFilter();
            this.renderObras();

        } catch (error) {
            this.showNotification('Erro ao carregar obras: ' + error.message, 'error');
        }
    }

    async loadMedicoes() {
        try {
            const { data: medicoes, error } = await supabaseClient
                .from('medicoes_hvc')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Buscar clientes para cada medição
            this.medicoes = [];
            
            for (const medicao of medicoes || []) {
                const obra = this.obras.find(o => o.id === medicao.obra_id);
                
                this.medicoes.push({
                    ...medicao,
                    obra: obra || { numero_obra: 'Obra não encontrada', cliente: { nome: 'Cliente não encontrado' } }
                });
            }

            this.renderMedicoes();

        } catch (error) {
            this.showNotification('Erro ao carregar medições: ' + error.message, 'error');
        }
    }

    async loadServicosObra(obraId) {
        try {
            // Buscar serviços que têm produção na obra
            const { data: producoes, error: prodError } = await supabaseClient
                .from('producoes_diarias_hvc')
                .select('servico_id')
                .eq('obra_id', obraId);

            if (prodError) throw prodError;

            if (!producoes || producoes.length === 0) {
                this.servicosObra = [];
                return;
            }

            // Obter IDs únicos dos serviços
            const servicoIds = [...new Set(producoes.map(p => p.servico_id))];

            // Buscar dados dos serviços
            const { data: servicos, error: servicosError } = await supabaseClient
                .from('servicos_hvc')
                .select('*')
                .in('id', servicoIds);

            if (servicosError) throw servicosError;

            // Buscar medições anteriores para calcular quantidades já medidas
            const { data: medicoesAnteriores, error: medError } = await supabaseClient
                .from('medicoes_hvc')
                .select('*')
                .eq('obra_id', obraId);

            if (medError) throw medError;

            // Calcular quantidades já medidas
            const quantidadesJaMedidas = {};
            
            for (const medicao of medicoesAnteriores || []) {
                if (medicao.observacoes) {
                    try {
                        const dadosMedicao = JSON.parse(medicao.observacoes);
                        if (dadosMedicao.servicos) {
                            for (const servicoMedicao of dadosMedicao.servicos) {
                                const servicoId = servicoMedicao.servico_id;
                                const quantidade = parseFloat(servicoMedicao.quantidade_medida) || 0;
                                
                                if (!quantidadesJaMedidas[servicoId]) {
                                    quantidadesJaMedidas[servicoId] = 0;
                                }
                                quantidadesJaMedidas[servicoId] += quantidade;
                            }
                        }
                    } catch (e) {
                        // Ignorar erros de parse
                    }
                }
            }

            // Processar cada serviço
            this.servicosObra = [];
            
            for (const servico of servicos || []) {
                // Calcular quantidade produzida
                const { data: producaoServico, error: prodServicoError } = await supabaseClient
                    .from('producoes_diarias_hvc')
                    .select('quantidade_produzida')
                    .eq('obra_id', obraId)
                    .eq('servico_id', servico.id);

                if (prodServicoError) continue;

                const quantidadeProduzida = producaoServico?.reduce((total, prod) => 
                    total + (parseFloat(prod.quantidade_produzida) || 0), 0) || 0;

                // Buscar valores da proposta
                const { data: itemProposta, error: itemError } = await supabaseClient
                    .from('itens_proposta_hvc')
                    .select('*')
                    .eq('servico_id', servico.id)
                    .limit(1)
                    .single();

                let valorUnitario = 0;
                let quantidadeContratada = 0;

                if (!itemError && itemProposta) {
                    valorUnitario = (parseFloat(itemProposta.preco_mao_obra) || 0) + 
                                   (parseFloat(itemProposta.preco_material) || 0);
                    quantidadeContratada = parseFloat(itemProposta.quantidade) || 0;
                }

                const quantidadeJaMedida = quantidadesJaMedidas[servico.id] || 0;
                const quantidadeDisponivel = Math.max(0, quantidadeProduzida - quantidadeJaMedida);

                this.servicosObra.push({
                    servico_id: servico.id,
                    servico_codigo: servico.codigo,
                    servico_descricao: servico.descricao,
                    unidade: servico.unidade,
                    quantidade_contratada: quantidadeContratada,
                    quantidade_produzida: quantidadeProduzida,
                    quantidade_ja_medida: quantidadeJaMedida,
                    quantidade_disponivel: quantidadeDisponivel,
                    valor_unitario_contratado: valorUnitario
                });
            }

        } catch (error) {
            this.showNotification('Erro ao carregar serviços: ' + error.message, 'error');
        }
    }

    // ========================================
    // RENDERIZAÇÃO
    // ========================================

    populateObrasFilter() {
        const filtroObra = this.getElement('filtro-obra');
        if (!filtroObra) return;

        filtroObra.innerHTML = '<option value="">Todas as obras</option>';
        
        this.obras.forEach(obra => {
            const option = document.createElement('option');
            option.value = obra.id;
            option.textContent = `${obra.numero_obra} - ${obra.cliente.nome}`;
            filtroObra.appendChild(option);
        });
    }

    renderObras() {
        const obrasList = this.getElement('obras-list');
        if (!obrasList) return;

        if (this.obras.length === 0) {
            obrasList.innerHTML = '<p style="text-align: center; color: #b0c4de; padding: 2rem;">Nenhuma obra encontrada</p>';
            return;
        }

        obrasList.innerHTML = this.obras.map(obra => `
            <div class="obra-item" onclick="selecionarObra('${obra.id}')">
                <div class="obra-info">
                    <div>
                        <div class="obra-nome">${obra.numero_obra}</div>
                        <div class="obra-cliente">${obra.cliente.nome}</div>
                    </div>
                    <div style="color: #add8e6; font-size: 0.9rem;">
                        ${obra.endereco || 'Endereço não informado'}
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderMedicoes() {
        const medicoesList = this.getElement('medicoes-list');
        if (!medicoesList) return;

        if (this.medicoes.length === 0) {
            medicoesList.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: #b0c4de; padding: 2rem;">
                        <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Nenhuma medição cadastrada
                    </td>
                </tr>
            `;
            return;
        }

        medicoesList.innerHTML = this.medicoes.map(medicao => {
            const dataFormatada = new Date(medicao.created_at).toLocaleDateString('pt-BR');
            const previsaoFormatada = medicao.previsao_pagamento ? 
                new Date(medicao.previsao_pagamento).toLocaleDateString('pt-BR') : '-';
            const valorFormatado = new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(medicao.valor_total || 0);

            return `
                <tr>
                    <td>
                        <span class="numero-medicao">${medicao.numero_medicao}</span>
                    </td>
                    <td>
                        <div class="obra-info">
                            <div>
                                <div class="obra-nome">${medicao.obra.numero_obra}</div>
                                <div class="obra-cliente">${medicao.obra.cliente.nome}</div>
                            </div>
                        </div>
                    </td>
                    <td>${dataFormatada}</td>
                    <td>${previsaoFormatada}</td>
                    <td>${valorFormatado}</td>
                    <td>
                        <span class="status-badge status-${medicao.status}">
                            ${medicao.status.toUpperCase()}
                        </span>
                    </td>
                    <td>
                        <button class="btn-danger" onclick="excluirMedicao('${medicao.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async renderServicos() {
        const servicosList = this.getElement('servicos-list');
        if (!servicosList) return;

        if (!this.servicosObra || this.servicosObra.length === 0) {
            servicosList.innerHTML = '<p style="text-align: center; color: #b0c4de; padding: 2rem;">Nenhum serviço disponível para medição</p>';
            return;
        }

        const servicosHtml = this.servicosObra.map(servico => {
            const valorContratadoTotal = servico.quantidade_contratada * servico.valor_unitario_contratado;
            const valorContratadoFormatado = new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(valorContratadoTotal);

            const valorUnitarioFormatado = new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(servico.valor_unitario_contratado);

            return `
                <div class="servico-item" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(173, 216, 230, 0.2); border-radius: 10px; padding: 1.5rem; margin-bottom: 1rem;">
                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 1rem; align-items: center;">
                        <!-- Código e Descrição -->
                        <div>
                            <div style="font-weight: 600; color: #add8e6; font-size: 1.1rem; margin-bottom: 0.5rem;">
                                ${servico.servico_codigo}
                            </div>
                            <div style="color: #b0c4de; font-size: 0.9rem; margin-bottom: 0.5rem;">
                                ${servico.servico_descricao}
                            </div>
                            <div style="color: #90ee90; font-size: 0.8rem;">
                                Valor unitário: ${valorUnitarioFormatado}
                            </div>
                        </div>

                        <!-- Total Contratado -->
                        <div style="text-align: center; background: rgba(0, 123, 255, 0.1); padding: 1rem; border-radius: 8px; border: 1px solid rgba(0, 123, 255, 0.3);">
                            <div style="font-size: 0.8rem; color: #b0c4de; margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 600;">
                                TOTAL CONTRATADO
                            </div>
                            <div style="font-size: 1rem; font-weight: 600; color: #add8e6;">
                                ${servico.quantidade_contratada} ${servico.unidade}
                            </div>
                            <div style="font-size: 0.8rem; color: #87ceeb; margin-top: 0.25rem;">
                                ${valorContratadoFormatado}
                            </div>
                        </div>

                        <!-- Total Produzido -->
                        <div style="text-align: center; background: rgba(255, 193, 7, 0.1); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255, 193, 7, 0.3);">
                            <div style="font-size: 0.8rem; color: #b0c4de; margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 600;">
                                TOTAL PRODUZIDO
                            </div>
                            <div style="font-size: 1rem; font-weight: 600; color: #add8e6;">
                                ${servico.quantidade_produzida} ${servico.unidade}
                            </div>
                        </div>

                        <!-- Total Medido -->
                        <div style="text-align: center; background: rgba(40, 167, 69, 0.1); padding: 1rem; border-radius: 8px; border: 1px solid rgba(40, 167, 69, 0.3);">
                            <div style="font-size: 0.8rem; color: #b0c4de; margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 600;">
                                TOTAL MEDIDO
                            </div>
                            <div style="font-size: 1rem; font-weight: 600; color: #add8e6;">
                                ${servico.quantidade_ja_medida} ${servico.unidade}
                            </div>
                        </div>

                        <!-- Quantidade a Medir -->
                        <div style="text-align: center; background: rgba(32, 201, 151, 0.1); padding: 1rem; border-radius: 8px; border: 1px solid rgba(32, 201, 151, 0.3);">
                            <div style="font-size: 0.8rem; color: #b0c4de; margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 600;">
                                QUANTIDADE A MEDIR
                            </div>
                            <input 
                                type="number" 
                                step="0.01" 
                                min="0" 
                                max="${servico.quantidade_disponivel}"
                                value="0.00"
                                data-servico-id="${servico.servico_id}"
                                data-valor-unitario="${servico.valor_unitario_contratado}"
                                onchange="atualizarCalculos()"
                                style="width: 100%; padding: 0.5rem; border: 1px solid rgba(173, 216, 230, 0.3); border-radius: 6px; background: rgba(255, 255, 255, 0.1); color: #e0e0e0; text-align: center; font-size: 0.9rem;"
                            />
                            <div style="font-size: 0.7rem; color: #90ee90; margin-top: 0.25rem;">
                                Disponível: ${servico.quantidade_disponivel} ${servico.unidade}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        servicosList.innerHTML = servicosHtml;
    }

    // ========================================
    // MODAIS
    // ========================================

    abrirModalNovaMedicao() {
        const modal = this.getElement('modal-medicao');
        if (!modal) return;

        // Definir data padrão como hoje
        const dataInput = this.getElement('data-medicao');
        if (dataInput) {
            dataInput.value = new Date().toISOString().split('T')[0];
        }

        // Definir previsão padrão como 30 dias a partir de hoje
        const previsaoInput = this.getElement('previsao-recebimento');
        if (previsaoInput) {
            const dataPrevisao = new Date();
            dataPrevisao.setDate(dataPrevisao.getDate() + 30);
            previsaoInput.value = dataPrevisao.toISOString().split('T')[0];
        }

        // Resetar formulário
        this.resetarFormulario();

        modal.style.display = 'block';
    }

    fecharModalMedicao() {
        const modal = this.getElement('modal-medicao');
        if (modal) {
            modal.style.display = 'none';
        }
        this.resetarFormulario();
    }

    abrirModalObras() {
        const modal = this.getElement('modal-obras');
        if (modal) {
            modal.style.display = 'block';
        }
        this.renderObras();
    }

    fecharModalObras() {
        const modal = this.getElement('modal-obras');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    resetarFormulario() {
        this.obraSelecionada = null;
        this.servicosObra = [];
        this.valorTotalCalculado = 0;

        // Resetar container de obra selecionada
        const obraContainer = this.getElement('obra-selecionada-container');
        if (obraContainer) {
            obraContainer.innerHTML = `
                <button type="button" class="btn-secondary" onclick="abrirModalObras()">
                    <i class="fas fa-building"></i>
                    Selecionar Obra
                </button>
            `;
        }

        // Esconder containers
        const servicosContainer = this.getElement('servicos-container');
        if (servicosContainer) {
            servicosContainer.style.display = 'none';
        }

        const valorTotalContainer = this.getElement('valor-total-container');
        if (valorTotalContainer) {
            valorTotalContainer.style.display = 'none';
        }

        // Resetar valor total
        this.atualizarValorTotal(0);
    }

    // ========================================
    // SELEÇÃO DE OBRA
    // ========================================

    async selecionarObra(obraId) {
        try {
            this.obraSelecionada = this.obras.find(obra => obra.id === obraId);
            
            if (!this.obraSelecionada) {
                this.showNotification('Obra não encontrada', 'error');
                return;
            }

            // Atualizar interface
            const obraContainer = this.getElement('obra-selecionada-container');
            if (obraContainer) {
                obraContainer.innerHTML = `
                    <div style="background: rgba(40, 167, 69, 0.2); border: 1px solid rgba(40, 167, 69, 0.3); border-radius: 8px; padding: 1rem;">
                        <div style="font-weight: 600; color: #28a745; margin-bottom: 0.5rem;">
                            <i class="fas fa-check-circle"></i> ${this.obraSelecionada.numero_obra}
                        </div>
                        <div style="color: #b0c4de; font-size: 0.9rem;">
                            ${this.obraSelecionada.cliente.nome}
                        </div>
                        <button type="button" class="btn-secondary" onclick="abrirModalObras()" style="margin-top: 0.5rem; font-size: 0.8rem; padding: 0.25rem 0.5rem;">
                            <i class="fas fa-edit"></i> Alterar
                        </button>
                    </div>
                `;
            }

            // Carregar serviços da obra
            await this.loadServicosObra(obraId);
            await this.renderServicos();

            // Mostrar containers
            const servicosContainer = this.getElement('servicos-container');
            if (servicosContainer) {
                servicosContainer.style.display = 'block';
            }

            const valorTotalContainer = this.getElement('valor-total-container');
            if (valorTotalContainer) {
                valorTotalContainer.style.display = 'block';
            }

            // Fechar modal de obras
            this.fecharModalObras();

            this.showNotification('Obra selecionada com sucesso!', 'success');

        } catch (error) {
            this.showNotification('Erro ao selecionar obra: ' + error.message, 'error');
        }
    }

    // ========================================
    // CÁLCULOS
    // ========================================

    atualizarCalculos() {
        let valorTotal = 0;

        // Buscar todos os inputs de quantidade
        const inputs = document.querySelectorAll('input[data-servico-id]');
        
        inputs.forEach(input => {
            const quantidade = parseFloat(input.value) || 0;
            const valorUnitario = parseFloat(input.dataset.valorUnitario) || 0;
            valorTotal += quantidade * valorUnitario;
        });

        this.valorTotalCalculado = valorTotal;
        this.atualizarValorTotal(valorTotal);
    }

    atualizarValorTotal(valor) {
        const valorDisplay = this.getElement('valor-total-display');
        if (valorDisplay) {
            const valorFormatado = new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(valor);
            
            valorDisplay.textContent = valorFormatado;
            
            // Animação visual
            valorDisplay.style.transform = 'scale(1.1)';
            setTimeout(() => {
                valorDisplay.style.transform = 'scale(1)';
            }, 200);
        }
    }

    // ========================================
    // SALVAMENTO
    // ========================================

    async salvarMedicao(event) {
        event.preventDefault();

        try {
            if (!this.obraSelecionada) {
                this.showNotification('Selecione uma obra antes de salvar', 'error');
                return;
            }

            // Coletar dados do formulário
            const dataMedicao = this.getElement('data-medicao')?.value;
            const previsaoRecebimento = this.getElement('previsao-recebimento')?.value;
            const status = this.getElement('status-medicao')?.value || 'pendente';
            const observacoes = this.getElement('observacoes-medicao')?.value || '';

            if (!dataMedicao) {
                this.showNotification('Data da medição é obrigatória', 'error');
                return;
            }

            if (!previsaoRecebimento) {
                this.showNotification('Previsão de recebimento é obrigatória', 'error');
                return;
            }

            // Coletar serviços medidos
            const inputs = document.querySelectorAll('input[data-servico-id]');
            const servicosMedidos = [];

            inputs.forEach(input => {
                const quantidade = parseFloat(input.value) || 0;
                if (quantidade > 0) {
                    const servicoId = input.dataset.servicoId;
                    const valorUnitario = parseFloat(input.dataset.valorUnitario) || 0;
                    
                    servicosMedidos.push({
                        servico_id: servicoId,
                        quantidade_medida: quantidade,
                        valor_unitario: valorUnitario,
                        valor_total: quantidade * valorUnitario
                    });
                }
            });

            if (servicosMedidos.length === 0) {
                this.showNotification('Adicione pelo menos um serviço com quantidade maior que zero', 'error');
                return;
            }

            // Gerar número da medição
            const numeroMedicao = await this.gerarNumeroMedicao();

            // Preparar dados para salvamento
            const dadosMedicao = {
                numero_medicao: numeroMedicao,
                obra_id: this.obraSelecionada.id,
                desconto_valor: 0,
                valor_total: this.valorTotalCalculado,
                valor_bruto: this.valorTotalCalculado,
                tipo_preco: 'total',
                previsao_pagamento: previsaoRecebimento,
                emitir_boleto: false,
                status: status,
                observacoes: JSON.stringify({
                    data_medicao: dataMedicao,
                    observacoes_usuario: observacoes,
                    servicos: servicosMedidos
                })
            };

            // Salvar no banco
            const { data: medicaoSalva, error } = await supabaseClient
                .from('medicoes_hvc')
                .insert([dadosMedicao])
                .select()
                .single();

            if (error) throw error;

            this.showNotification('Medição salva com sucesso!', 'success');

            // Recarregar dados e fechar modal
            await this.loadMedicoes();
            this.fecharModalMedicao();

        } catch (error) {
            this.showNotification('Erro ao salvar medição: ' + error.message, 'error');
        }
    }

    async gerarNumeroMedicao() {
        try {
            // Buscar última medição para gerar número sequencial
            const { data: ultimaMedicao, error } = await supabaseClient
                .from('medicoes_hvc')
                .select('numero_medicao')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            let proximoNumero = 1;
            
            if (ultimaMedicao && ultimaMedicao.numero_medicao) {
                const match = ultimaMedicao.numero_medicao.match(/MED-(\d+)/);
                if (match) {
                    proximoNumero = parseInt(match[1]) + 1;
                }
            }

            return `MED-${proximoNumero.toString().padStart(3, '0')}`;

        } catch (error) {
            return `MED-${Date.now()}`;
        }
    }

    // ========================================
    // EXCLUSÃO
    // ========================================

    async excluirMedicao(medicaoId) {
        if (!confirm('Tem certeza que deseja excluir esta medição?')) {
            return;
        }

        try {
            const { error } = await supabaseClient
                .from('medicoes_hvc')
                .delete()
                .eq('id', medicaoId);

            if (error) throw error;

            this.showNotification('Medição excluída com sucesso!', 'success');
            await this.loadMedicoes();

        } catch (error) {
            this.showNotification('Erro ao excluir medição: ' + error.message, 'error');
        }
    }

    // ========================================
    // FILTROS
    // ========================================

    aplicarFiltros() {
        const filtroObra = this.getElement('filtro-obra')?.value;
        const filtroStatus = this.getElement('filtro-status')?.value;
        const filtroData = this.getElement('filtro-data')?.value;

        let medicoesFiltradas = [...this.medicoes];

        if (filtroObra) {
            medicoesFiltradas = medicoesFiltradas.filter(medicao => 
                medicao.obra_id === filtroObra
            );
        }

        if (filtroStatus) {
            medicoesFiltradas = medicoesFiltradas.filter(medicao => 
                medicao.status === filtroStatus
            );
        }

        if (filtroData) {
            medicoesFiltradas = medicoesFiltradas.filter(medicao => {
                const dataMedicao = new Date(medicao.created_at).toISOString().split('T')[0];
                return dataMedicao === filtroData;
            });
        }

        // Renderizar medições filtradas
        const medicoesList = this.getElement('medicoes-list');
        if (!medicoesList) return;

        if (medicoesFiltradas.length === 0) {
            medicoesList.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: #b0c4de; padding: 2rem;">
                        <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        Nenhuma medição encontrada com os filtros aplicados
                    </td>
                </tr>
            `;
            return;
        }

        medicoesList.innerHTML = medicoesFiltradas.map(medicao => {
            const dataFormatada = new Date(medicao.created_at).toLocaleDateString('pt-BR');
            const previsaoFormatada = medicao.previsao_pagamento ? 
                new Date(medicao.previsao_pagamento).toLocaleDateString('pt-BR') : '-';
            const valorFormatado = new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(medicao.valor_total || 0);

            return `
                <tr>
                    <td>
                        <span class="numero-medicao">${medicao.numero_medicao}</span>
                    </td>
                    <td>
                        <div class="obra-info">
                            <div>
                                <div class="obra-nome">${medicao.obra.numero_obra}</div>
                                <div class="obra-cliente">${medicao.obra.cliente.nome}</div>
                            </div>
                        </div>
                    </td>
                    <td>${dataFormatada}</td>
                    <td>${previsaoFormatada}</td>
                    <td>${valorFormatado}</td>
                    <td>
                        <span class="status-badge status-${medicao.status}">
                            ${medicao.status.toUpperCase()}
                        </span>
                    </td>
                    <td>
                        <button class="btn-danger" onclick="excluirMedicao('${medicao.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    limparFiltros() {
        const filtroObra = this.getElement('filtro-obra');
        const filtroStatus = this.getElement('filtro-status');
        const filtroData = this.getElement('filtro-data');

        if (filtroObra) filtroObra.value = '';
        if (filtroStatus) filtroStatus.value = '';
        if (filtroData) filtroData.value = '';

        this.renderMedicoes();
    }

    filtrarObras(termo) {
        if (!termo) {
            this.renderObras();
            return;
        }

        const obrasFiltradas = this.obras.filter(obra => 
            obra.numero_obra.toLowerCase().includes(termo.toLowerCase()) ||
            obra.cliente.nome.toLowerCase().includes(termo.toLowerCase())
        );

        const obrasList = this.getElement('obras-list');
        if (!obrasList) return;

        if (obrasFiltradas.length === 0) {
            obrasList.innerHTML = '<p style="text-align: center; color: #b0c4de; padding: 2rem;">Nenhuma obra encontrada</p>';
            return;
        }

        obrasList.innerHTML = obrasFiltradas.map(obra => `
            <div class="obra-item" onclick="selecionarObra('${obra.id}')">
                <div class="obra-info">
                    <div>
                        <div class="obra-nome">${obra.numero_obra}</div>
                        <div class="obra-cliente">${obra.cliente.nome}</div>
                    </div>
                    <div style="color: #add8e6; font-size: 0.9rem;">
                        ${obra.endereco || 'Endereço não informado'}
                    </div>
                </div>
            </div>
        `).join('');
    }

    // ========================================
    // NOTIFICAÇÕES
    // ========================================

    showNotification(message, type = 'info') {
        // Criar elemento de notificação
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            transition: all 0.3s ease;
        `;

        // Definir cor baseada no tipo
        switch (type) {
            case 'success':
                notification.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
                break;
            case 'error':
                notification.style.background = 'linear-gradient(135deg, #dc3545, #c82333)';
                break;
            case 'warning':
                notification.style.background = 'linear-gradient(135deg, #ffc107, #e0a800)';
                notification.style.color = '#212529';
                break;
            default:
                notification.style.background = 'linear-gradient(135deg, #007bff, #0056b3)';
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        // Remover após 5 segundos
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
}

// Função global para notificações
function showNotification(message, type = 'info') {
    if (medicoesManager) {
        medicoesManager.showNotification(message, type);
    }
}


// =========================================================================
// MÓDULO DE SINCRONIZAÇÃO - FLUXO DE CAIXA HVC
// =========================================================================
// Versão: 1.0
// Data: 23/12/2024
// Descrição: Sincroniza pagamentos e recebimentos do Google Calendar com
//            a tabela fluxo_caixa_hvc no Supabase, com preview de alterações
// =========================================================================

import { supabase as supabaseClient } from './supabase.js';

class FluxoCaixaSync {
    constructor() {
        this.alteracoesPendentes = {
            adicionar: [],
            modificar: [],
            excluir: []
        };
        this.dadosLocais = [];
        this.dadosAgenda = [];
        this.anoAtual = new Date().getFullYear();
    }

    // =========================================================================
    // INICIALIZAÇÃO
    // =========================================================================
    async init() {
        console.log('🔄 Módulo de Sincronização de Fluxo de Caixa carregado');
        await this.carregarDadosLocais();
        this.renderizarBotaoSincronizacao();
        this.renderizarListasPersistentes();
    }

    // =========================================================================
    // RENDERIZAR BOTÃO DE SINCRONIZAÇÃO
    // =========================================================================
    renderizarBotaoSincronizacao() {
        const container = document.getElementById('syncButtonContainer');
        if (!container) {
            // Criar container se não existir
            const listsSection = document.getElementById('listsSection');
            if (listsSection) {
                const btnContainer = document.createElement('div');
                btnContainer.id = 'syncButtonContainer';
                btnContainer.className = 'sync-button-container';
                btnContainer.innerHTML = `
                    <button id="btnSincronizarAgenda" class="btn-sync-agenda" onclick="fluxoCaixaSync.iniciarSincronizacao()">
                        <i class="fas fa-sync-alt"></i>
                        Sincronizar com Google Agenda
                    </button>
                    <span class="sync-info">
                        <i class="fas fa-info-circle"></i>
                        Última sincronização: <span id="ultimaSincronizacao">Nunca</span>
                    </span>
                `;
                listsSection.insertBefore(btnContainer, listsSection.firstChild);
            }
        }
        this.atualizarUltimaSincronizacao();
    }

    // =========================================================================
    // CARREGAR DADOS LOCAIS (SUPABASE)
    // =========================================================================
    async carregarDadosLocais() {
        try {
            const { data, error } = await supabaseClient
                .from('fluxo_caixa_hvc')
                .select('*')
                .order('data_vencimento', { ascending: true });

            if (error) throw error;

            this.dadosLocais = data || [];
            console.log(`✅ ${this.dadosLocais.length} registros carregados do banco local`);
            return this.dadosLocais;
        } catch (error) {
            console.error('❌ Erro ao carregar dados locais:', error);
            this.mostrarNotificacao('Erro ao carregar dados do banco', 'error');
            return [];
        }
    }

    // =========================================================================
    // RENDERIZAR LISTAS PERSISTENTES
    // =========================================================================
    async renderizarListasPersistentes() {
        await this.carregarDadosLocais();
        
        const pagamentos = this.dadosLocais.filter(item => item.tipo === 'pagamento');
        const recebimentos = this.dadosLocais.filter(item => item.tipo === 'recebimento');

        this.renderizarListaPagamentos(pagamentos);
        this.renderizarListaRecebimentos(recebimentos);
    }

    renderizarListaPagamentos(pagamentos) {
        const container = document.getElementById('paymentsList');
        if (!container) return;

        if (pagamentos.length === 0) {
            container.innerHTML = `
                <div class="empty-list">
                    <i class="fas fa-inbox"></i>
                    <p>Nenhum pagamento registrado</p>
                    <small>Clique em "Sincronizar com Google Agenda" para importar</small>
                </div>
            `;
            return;
        }

        container.innerHTML = pagamentos.map(item => `
            <div class="payment-item ${item.status}" data-id="${item.id}">
                <div class="payment-header">
                    <span class="payment-date">${this.formatarData(item.data_vencimento)}</span>
                    <span class="payment-status status-${item.status}">${item.status.toUpperCase()}</span>
                </div>
                <div class="payment-content">
                    <span class="payment-name">${item.descricao}</span>
                    <span class="payment-value">${this.formatarMoeda(item.valor)}</span>
                </div>
                ${item.categoria ? `<div class="payment-category"><i class="fas fa-tag"></i> ${item.categoria}</div>` : ''}
                ${item.observacoes ? `<div class="payment-notes"><i class="fas fa-sticky-note"></i> ${item.observacoes}</div>` : ''}
                <div class="payment-actions">
                    <button class="btn-edit-item" onclick="fluxoCaixaSync.editarItem('${item.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-delete-item" onclick="fluxoCaixaSync.excluirItem('${item.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderizarListaRecebimentos(recebimentos) {
        const container = document.getElementById('receivingsList');
        if (!container) return;

        if (recebimentos.length === 0) {
            container.innerHTML = `
                <div class="empty-list">
                    <i class="fas fa-inbox"></i>
                    <p>Nenhum recebimento registrado</p>
                    <small>Clique em "Sincronizar com Google Agenda" para importar</small>
                </div>
            `;
            return;
        }

        container.innerHTML = recebimentos.map(item => `
            <div class="receiving-item ${item.status}" data-id="${item.id}">
                <div class="receiving-header">
                    <span class="receiving-date">${this.formatarData(item.data_vencimento)}</span>
                    <span class="receiving-status status-${item.status}">${item.status.toUpperCase()}</span>
                </div>
                <div class="receiving-content">
                    <span class="receiving-name">${item.descricao}</span>
                    <span class="receiving-value">${this.formatarMoeda(item.valor)}</span>
                </div>
                ${item.categoria ? `<div class="receiving-category"><i class="fas fa-tag"></i> ${item.categoria}</div>` : ''}
                ${item.observacoes ? `<div class="receiving-notes"><i class="fas fa-sticky-note"></i> ${item.observacoes}</div>` : ''}
                <div class="receiving-actions">
                    <button class="btn-edit-item" onclick="fluxoCaixaSync.editarItem('${item.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-delete-item" onclick="fluxoCaixaSync.excluirItem('${item.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // =========================================================================
    // INICIAR SINCRONIZAÇÃO
    // =========================================================================
    async iniciarSincronizacao() {
        try {
            this.mostrarLoading('Buscando eventos do Google Agenda...');

            // Buscar TODOS os eventos do ano inteiro
            const eventosAgenda = await this.buscarEventosGoogleAgenda();
            
            if (!eventosAgenda || eventosAgenda.length === 0) {
                this.esconderLoading();
                this.mostrarNotificacao('Nenhum evento encontrado no Google Agenda', 'warning');
                return;
            }

            this.mostrarLoading('Comparando com dados locais...');

            // Comparar com dados locais
            await this.detectarAlteracoes(eventosAgenda);

            this.esconderLoading();

            // Mostrar modal de preview
            this.mostrarModalPreview();

        } catch (error) {
            this.esconderLoading();
            console.error('❌ Erro na sincronização:', error);
            this.mostrarNotificacao('Erro ao sincronizar: ' + error.message, 'error');
        }
    }

    // =========================================================================
    // BUSCAR EVENTOS DO GOOGLE AGENDA
    // =========================================================================
    async buscarEventosGoogleAgenda() {
        // Verificar se há contas conectadas
        const accounts = window.googleAccounts || [];
        if (accounts.length === 0) {
            throw new Error('Nenhuma conta do Google conectada. Conecte uma conta na barra lateral.');
        }

        const todosEventos = [];
        const inicioAno = new Date(this.anoAtual, 0, 1).toISOString();
        const fimAno = new Date(this.anoAtual, 11, 31, 23, 59, 59).toISOString();

        for (const account of accounts) {
            try {
                console.log(`📅 Buscando eventos da conta: ${account.email}`);
                
                // Usar a função global de busca de eventos se disponível
                if (typeof window.fetchCalendarEvents === 'function') {
                    const eventos = await window.fetchCalendarEvents(account.email, inicioAno, fimAno);
                    
                    // Processar eventos para extrair pagamentos/recebimentos
                    const eventosProcessados = this.processarEventosAgenda(eventos, account.email);
                    todosEventos.push(...eventosProcessados);
                } else {
                    console.warn('⚠️ Função fetchCalendarEvents não disponível');
                }
            } catch (error) {
                console.error(`❌ Erro ao buscar eventos de ${account.email}:`, error);
            }
        }

        console.log(`✅ Total de ${todosEventos.length} eventos encontrados`);
        this.dadosAgenda = todosEventos;
        return todosEventos;
    }

    // =========================================================================
    // PROCESSAR EVENTOS DA AGENDA
    // =========================================================================
    processarEventosAgenda(eventos, accountEmail) {
        const eventosProcessados = [];

        for (const evento of eventos) {
            // Verificar se é um evento de pagamento ou recebimento
            const titulo = evento.summary || '';
            const descricao = evento.description || '';
            
            // Detectar tipo pelo título ou descrição
            let tipo = null;
            if (titulo.toUpperCase().includes('PAGAMENTO') || titulo.toUpperCase().includes('PAG')) {
                tipo = 'pagamento';
            } else if (titulo.toUpperCase().includes('RECEBIMENTO') || titulo.toUpperCase().includes('REC')) {
                tipo = 'recebimento';
            }

            if (!tipo) continue; // Ignorar eventos que não são pagamentos/recebimentos

            // Extrair valor do título ou descrição
            const valor = this.extrairValor(titulo) || this.extrairValor(descricao) || 0;

            // Extrair status
            const status = this.extrairStatus(titulo, descricao, tipo);

            // Extrair categoria
            const categoria = this.extrairCategoria(titulo, descricao);

            // Data do evento
            const dataEvento = evento.start?.date || evento.start?.dateTime?.split('T')[0];

            eventosProcessados.push({
                google_event_id: evento.id,
                google_calendar_id: accountEmail,
                tipo: tipo,
                descricao: this.limparTitulo(titulo),
                valor: valor,
                data_vencimento: dataEvento,
                status: status,
                categoria: categoria,
                observacoes: descricao,
                dados_originais: evento
            });
        }

        return eventosProcessados;
    }

    // =========================================================================
    // FUNÇÕES AUXILIARES DE EXTRAÇÃO
    // =========================================================================
    extrairValor(texto) {
        if (!texto) return 0;
        
        // Padrões comuns: R$ 1.234,56 ou R$1234.56 ou 1234,56
        const padroes = [
            /R\$\s*([\d.,]+)/i,
            /valor[:\s]*([\d.,]+)/i,
            /([\d.]+,\d{2})/
        ];

        for (const padrao of padroes) {
            const match = texto.match(padrao);
            if (match) {
                let valor = match[1]
                    .replace(/\./g, '')  // Remove pontos de milhar
                    .replace(',', '.');   // Converte vírgula decimal para ponto
                return parseFloat(valor) || 0;
            }
        }
        return 0;
    }

    extrairStatus(titulo, descricao, tipo) {
        const texto = (titulo + ' ' + descricao).toUpperCase();
        
        if (tipo === 'pagamento') {
            if (texto.includes('PG') || texto.includes('PAGO')) return 'pago';
            if (texto.includes('PENDENTE')) return 'pendente';
            if (texto.includes('CANCELADO')) return 'cancelado';
            return 'pendente';
        } else {
            if (texto.includes('RC') || texto.includes('RECEBIDO')) return 'pago';
            if (texto.includes('AGUARDANDO')) return 'pendente';
            if (texto.includes('CANCELADO')) return 'cancelado';
            return 'pendente';
        }
    }

    extrairCategoria(titulo, descricao) {
        const texto = (titulo + ' ' + descricao).toUpperCase();
        
        // Categorias comuns
        const categorias = [
            'INTERNO', 'EXTERNO', 'OBRA', 'FORNECEDOR', 'FUNCIONÁRIO',
            'ALUGUEL', 'ENERGIA', 'ÁGUA', 'TELEFONE', 'INTERNET',
            'MATERIAL', 'EQUIPAMENTO', 'SERVIÇO', 'IMPOSTO', 'TAXA'
        ];

        for (const cat of categorias) {
            if (texto.includes(cat)) return cat;
        }
        return null;
    }

    limparTitulo(titulo) {
        // Remove prefixos comuns e valores do título
        return titulo
            .replace(/^(PAGAMENTO|RECEBIMENTO|PAG|REC)[:\s-]*/i, '')
            .replace(/R\$\s*[\d.,]+/g, '')
            .replace(/\s*(PG|PAGO|RC|RECEBIDO|PENDENTE|AGUARDANDO)\s*/gi, '')
            .trim();
    }

    // =========================================================================
    // DETECTAR ALTERAÇÕES
    // =========================================================================
    async detectarAlteracoes(eventosAgenda) {
        await this.carregarDadosLocais();

        this.alteracoesPendentes = {
            adicionar: [],
            modificar: [],
            excluir: []
        };

        // Criar mapa dos dados locais por google_event_id
        const locaisMap = new Map();
        this.dadosLocais.forEach(item => {
            if (item.google_event_id) {
                const chave = `${item.google_event_id}_${item.google_calendar_id}`;
                locaisMap.set(chave, item);
            }
        });

        // Processar eventos da agenda
        for (const evento of eventosAgenda) {
            const chave = `${evento.google_event_id}_${evento.google_calendar_id}`;
            const itemLocal = locaisMap.get(chave);

            if (itemLocal) {
                // Verificar se houve modificação
                const alteracoes = this.compararItens(itemLocal, evento);
                if (alteracoes.length > 0) {
                    this.alteracoesPendentes.modificar.push({
                        id: itemLocal.id,
                        anterior: itemLocal,
                        novo: evento,
                        campos_alterados: alteracoes
                    });
                }
                locaisMap.delete(chave); // Remover do mapa
            } else {
                // Novo item
                this.alteracoesPendentes.adicionar.push(evento);
            }
        }

        // Itens que sobraram no mapa são candidatos a exclusão
        // (apenas os que vieram do Google Agenda)
        locaisMap.forEach((item, chave) => {
            if (item.google_event_id) {
                this.alteracoesPendentes.excluir.push(item);
            }
        });

        console.log('📊 Alterações detectadas:', {
            adicionar: this.alteracoesPendentes.adicionar.length,
            modificar: this.alteracoesPendentes.modificar.length,
            excluir: this.alteracoesPendentes.excluir.length
        });

        return this.alteracoesPendentes;
    }

    compararItens(local, agenda) {
        const alteracoes = [];
        const camposComparar = ['descricao', 'valor', 'data_vencimento', 'status', 'categoria'];

        for (const campo of camposComparar) {
            const valorLocal = local[campo];
            const valorAgenda = agenda[campo];

            if (valorLocal !== valorAgenda) {
                alteracoes.push({
                    campo,
                    de: valorLocal,
                    para: valorAgenda
                });
            }
        }

        return alteracoes;
    }

    // =========================================================================
    // MODAL DE PREVIEW
    // =========================================================================
    mostrarModalPreview() {
        const { adicionar, modificar, excluir } = this.alteracoesPendentes;
        const totalAlteracoes = adicionar.length + modificar.length + excluir.length;

        if (totalAlteracoes === 0) {
            this.mostrarNotificacao('Nenhuma alteração detectada. Tudo está sincronizado!', 'success');
            return;
        }

        const modalHtml = `
            <div class="modal-overlay" id="modal-sync-preview">
                <div class="modal-content modal-xl" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2><i class="fas fa-sync-alt"></i> Preview da Sincronização</h2>
                        <button class="modal-close" onclick="fluxoCaixaSync.fecharModalPreview()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="sync-summary">
                            <p>Foram detectadas <strong>${totalAlteracoes}</strong> alterações:</p>
                            <div class="sync-stats">
                                <span class="stat adicionar"><i class="fas fa-plus-circle"></i> ${adicionar.length} Novos</span>
                                <span class="stat modificar"><i class="fas fa-edit"></i> ${modificar.length} Alterados</span>
                                <span class="stat excluir"><i class="fas fa-trash"></i> ${excluir.length} Removidos</span>
                            </div>
                        </div>

                        <!-- Adições -->
                        ${adicionar.length > 0 ? `
                            <div class="sync-section">
                                <h3 class="sync-section-title adicionar">
                                    <i class="fas fa-plus-circle"></i> Novos Itens (${adicionar.length})
                                    <label class="select-all">
                                        <input type="checkbox" checked onchange="fluxoCaixaSync.toggleTodos('adicionar', this.checked)">
                                        Selecionar todos
                                    </label>
                                </h3>
                                <div class="sync-items">
                                    ${adicionar.map((item, i) => `
                                        <div class="sync-item">
                                            <label class="sync-checkbox">
                                                <input type="checkbox" checked data-tipo="adicionar" data-index="${i}">
                                            </label>
                                            <div class="sync-item-content">
                                                <div class="sync-item-header">
                                                    <span class="tipo-badge ${item.tipo}">${item.tipo === 'pagamento' ? 'Pagamento' : 'Recebimento'}</span>
                                                    <span class="status-badge ${item.status}">${item.status}</span>
                                                </div>
                                                <div class="sync-item-descricao">${item.descricao || 'Sem descrição'}</div>
                                                <div class="sync-item-detalhes">
                                                    <span class="data"><i class="fas fa-calendar"></i> ${this.formatarData(item.data_vencimento)}</span>
                                                    <span class="valor ${item.tipo}"><i class="fas fa-dollar-sign"></i> ${this.formatarMoeda(item.valor)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <!-- Modificações -->
                        ${modificar.length > 0 ? `
                            <div class="sync-section">
                                <h3 class="sync-section-title modificar">
                                    <i class="fas fa-edit"></i> Itens Alterados (${modificar.length})
                                    <label class="select-all">
                                        <input type="checkbox" checked onchange="fluxoCaixaSync.toggleTodos('modificar', this.checked)">
                                        Selecionar todos
                                    </label>
                                </h3>
                                <div class="sync-items">
                                    ${modificar.map((item, i) => `
                                        <div class="sync-item">
                                            <label class="sync-checkbox">
                                                <input type="checkbox" checked data-tipo="modificar" data-index="${i}">
                                            </label>
                                            <div class="sync-item-content">
                                                <div class="sync-item-descricao">${item.anterior.descricao || 'Sem descrição'}</div>
                                                <div class="sync-changes">
                                                    ${item.campos_alterados.map(c => `
                                                        <div class="change-item">
                                                            <span class="change-campo">${this.traduzirCampo(c.campo)}:</span>
                                                            <span class="change-de">${this.formatarValorCampo(c.campo, c.de)}</span>
                                                            <i class="fas fa-arrow-right"></i>
                                                            <span class="change-para">${this.formatarValorCampo(c.campo, c.para)}</span>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <!-- Exclusões -->
                        ${excluir.length > 0 ? `
                            <div class="sync-section">
                                <h3 class="sync-section-title excluir">
                                    <i class="fas fa-trash"></i> Itens Removidos (${excluir.length})
                                    <label class="select-all">
                                        <input type="checkbox" checked onchange="fluxoCaixaSync.toggleTodos('excluir', this.checked)">
                                        Selecionar todos
                                    </label>
                                </h3>
                                <div class="sync-items">
                                    ${excluir.map((item, i) => `
                                        <div class="sync-item excluir">
                                            <label class="sync-checkbox">
                                                <input type="checkbox" checked data-tipo="excluir" data-index="${i}">
                                            </label>
                                            <div class="sync-item-content">
                                                <div class="sync-item-header">
                                                    <span class="tipo-badge ${item.tipo}">${item.tipo === 'pagamento' ? 'Pagamento' : 'Recebimento'}</span>
                                                </div>
                                                <div class="sync-item-descricao">${item.descricao || 'Sem descrição'}</div>
                                                <div class="sync-item-detalhes">
                                                    <span class="data"><i class="fas fa-calendar"></i> ${this.formatarData(item.data_vencimento)}</span>
                                                    <span class="valor">${this.formatarMoeda(item.valor)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="btn-cancel" onclick="fluxoCaixaSync.fecharModalPreview()">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                        <button class="btn-confirm" onclick="fluxoCaixaSync.confirmarSincronizacao()">
                            <i class="fas fa-check"></i> Confirmar Sincronização
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remover modal existente se houver
        const modalExistente = document.getElementById('modal-sync-preview');
        if (modalExistente) modalExistente.remove();

        // Adicionar novo modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    fecharModalPreview() {
        const modal = document.getElementById('modal-sync-preview');
        if (modal) modal.remove();
    }

    toggleTodos(tipo, checked) {
        const checkboxes = document.querySelectorAll(`input[data-tipo="${tipo}"]`);
        checkboxes.forEach(cb => cb.checked = checked);
    }

    // =========================================================================
    // CONFIRMAR SINCRONIZAÇÃO
    // =========================================================================
    async confirmarSincronizacao() {
        try {
            this.mostrarLoading('Aplicando alterações...');

            // Coletar itens selecionados
            const adicionar = this.coletarSelecionados('adicionar');
            const modificar = this.coletarSelecionados('modificar');
            const excluir = this.coletarSelecionados('excluir');

            let totalProcessados = 0;
            let erros = [];

            // Processar adições
            for (const item of adicionar) {
                try {
                    const { error } = await supabaseClient
                        .from('fluxo_caixa_hvc')
                        .insert({
                            tipo: item.tipo,
                            descricao: item.descricao,
                            valor: item.valor,
                            data_vencimento: item.data_vencimento,
                            status: item.status,
                            categoria: item.categoria,
                            google_event_id: item.google_event_id,
                            google_calendar_id: item.google_calendar_id,
                            observacoes: item.observacoes,
                            sincronizado_em: new Date().toISOString()
                        });

                    if (error) throw error;
                    totalProcessados++;
                } catch (e) {
                    erros.push(`Erro ao adicionar: ${item.descricao}`);
                }
            }

            // Processar modificações
            for (const item of modificar) {
                try {
                    const { error } = await supabaseClient
                        .from('fluxo_caixa_hvc')
                        .update({
                            descricao: item.novo.descricao,
                            valor: item.novo.valor,
                            data_vencimento: item.novo.data_vencimento,
                            status: item.novo.status,
                            categoria: item.novo.categoria,
                            observacoes: item.novo.observacoes,
                            updated_at: new Date().toISOString(),
                            sincronizado_em: new Date().toISOString()
                        })
                        .eq('id', item.id);

                    if (error) throw error;
                    totalProcessados++;
                } catch (e) {
                    erros.push(`Erro ao modificar: ${item.anterior.descricao}`);
                }
            }

            // Processar exclusões
            for (const item of excluir) {
                try {
                    const { error } = await supabaseClient
                        .from('fluxo_caixa_hvc')
                        .delete()
                        .eq('id', item.id);

                    if (error) throw error;
                    totalProcessados++;
                } catch (e) {
                    erros.push(`Erro ao excluir: ${item.descricao}`);
                }
            }

            this.esconderLoading();
            this.fecharModalPreview();

            // Atualizar listas
            await this.renderizarListasPersistentes();
            this.atualizarUltimaSincronizacao();

            // Mostrar resultado
            if (erros.length > 0) {
                this.mostrarNotificacao(`Sincronização parcial: ${totalProcessados} itens processados, ${erros.length} erros`, 'warning');
            } else {
                this.mostrarNotificacao(`Sincronização concluída! ${totalProcessados} itens processados.`, 'success');
            }

        } catch (error) {
            this.esconderLoading();
            console.error('❌ Erro na sincronização:', error);
            this.mostrarNotificacao('Erro ao sincronizar: ' + error.message, 'error');
        }
    }

    coletarSelecionados(tipo) {
        const checkboxes = document.querySelectorAll(`input[data-tipo="${tipo}"]:checked`);
        const indices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
        return indices.map(i => this.alteracoesPendentes[tipo][i]);
    }

    // =========================================================================
    // EDITAR E EXCLUIR ITENS
    // =========================================================================
    async editarItem(id) {
        const item = this.dadosLocais.find(i => i.id === id);
        if (!item) return;

        // Criar modal de edição
        const modalHtml = `
            <div class="modal-overlay" id="modal-edit-item">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2><i class="fas fa-edit"></i> Editar ${item.tipo === 'pagamento' ? 'Pagamento' : 'Recebimento'}</h2>
                        <button class="modal-close" onclick="fluxoCaixaSync.fecharModalEdicao()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Descrição</label>
                            <input type="text" id="edit-descricao" value="${item.descricao || ''}" class="form-input">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Valor</label>
                                <input type="text" id="edit-valor" value="${this.formatarMoeda(item.valor)}" class="form-input">
                            </div>
                            <div class="form-group">
                                <label>Data</label>
                                <input type="date" id="edit-data" value="${item.data_vencimento}" class="form-input">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Status</label>
                                <select id="edit-status" class="form-input">
                                    <option value="pendente" ${item.status === 'pendente' ? 'selected' : ''}>Pendente</option>
                                    <option value="pago" ${item.status === 'pago' ? 'selected' : ''}>Pago</option>
                                    <option value="cancelado" ${item.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Categoria</label>
                                <input type="text" id="edit-categoria" value="${item.categoria || ''}" class="form-input">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Observações</label>
                            <textarea id="edit-observacoes" class="form-input" rows="3">${item.observacoes || ''}</textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-cancel" onclick="fluxoCaixaSync.fecharModalEdicao()">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                        <button class="btn-confirm" onclick="fluxoCaixaSync.salvarEdicao('${id}')">
                            <i class="fas fa-save"></i> Salvar
                        </button>
                    </div>
                </div>
            </div>
        `;

        const modalExistente = document.getElementById('modal-edit-item');
        if (modalExistente) modalExistente.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    fecharModalEdicao() {
        const modal = document.getElementById('modal-edit-item');
        if (modal) modal.remove();
    }

    async salvarEdicao(id) {
        try {
            const descricao = document.getElementById('edit-descricao').value;
            const valorStr = document.getElementById('edit-valor').value;
            const data = document.getElementById('edit-data').value;
            const status = document.getElementById('edit-status').value;
            const categoria = document.getElementById('edit-categoria').value;
            const observacoes = document.getElementById('edit-observacoes').value;

            // Converter valor
            const valor = parseFloat(valorStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

            const { error } = await supabaseClient
                .from('fluxo_caixa_hvc')
                .update({
                    descricao,
                    valor,
                    data_vencimento: data,
                    status,
                    categoria,
                    observacoes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;

            this.fecharModalEdicao();
            await this.renderizarListasPersistentes();
            this.mostrarNotificacao('Item atualizado com sucesso!', 'success');

        } catch (error) {
            console.error('Erro ao salvar:', error);
            this.mostrarNotificacao('Erro ao salvar: ' + error.message, 'error');
        }
    }

    async excluirItem(id) {
        if (!confirm('Tem certeza que deseja excluir este item?')) return;

        try {
            const { error } = await supabaseClient
                .from('fluxo_caixa_hvc')
                .delete()
                .eq('id', id);

            if (error) throw error;

            await this.renderizarListasPersistentes();
            this.mostrarNotificacao('Item excluído com sucesso!', 'success');

        } catch (error) {
            console.error('Erro ao excluir:', error);
            this.mostrarNotificacao('Erro ao excluir: ' + error.message, 'error');
        }
    }

    // =========================================================================
    // FUNÇÕES AUXILIARES
    // =========================================================================
    formatarMoeda(valor) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor || 0);
    }

    formatarData(data) {
        if (!data) return '-';
        const d = new Date(data + 'T00:00:00');
        return d.toLocaleDateString('pt-BR');
    }

    traduzirCampo(campo) {
        const traducoes = {
            'descricao': 'Descrição',
            'valor': 'Valor',
            'data_vencimento': 'Data',
            'status': 'Status',
            'categoria': 'Categoria'
        };
        return traducoes[campo] || campo;
    }

    formatarValorCampo(campo, valor) {
        if (campo === 'valor') return this.formatarMoeda(valor);
        if (campo === 'data_vencimento') return this.formatarData(valor);
        return valor || '-';
    }

    atualizarUltimaSincronizacao() {
        const span = document.getElementById('ultimaSincronizacao');
        if (span) {
            const agora = new Date();
            span.textContent = agora.toLocaleString('pt-BR');
        }
    }

    mostrarLoading(mensagem) {
        let loader = document.getElementById('sync-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'sync-loader';
            loader.className = 'sync-loader-overlay';
            document.body.appendChild(loader);
        }
        loader.innerHTML = `
            <div class="sync-loader-content">
                <div class="spinner"></div>
                <p>${mensagem}</p>
            </div>
        `;
        loader.style.display = 'flex';
    }

    esconderLoading() {
        const loader = document.getElementById('sync-loader');
        if (loader) loader.style.display = 'none';
    }

    mostrarNotificacao(mensagem, tipo = 'info') {
        const container = document.getElementById('messagesContainer') || document.body;
        
        const notif = document.createElement('div');
        notif.className = `notification notification-${tipo}`;
        notif.innerHTML = `
            <i class="fas fa-${tipo === 'success' ? 'check-circle' : tipo === 'error' ? 'exclamation-circle' : tipo === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${mensagem}</span>
        `;
        
        container.appendChild(notif);
        
        setTimeout(() => {
            notif.classList.add('fade-out');
            setTimeout(() => notif.remove(), 300);
        }, 5000);
    }
}

// Criar instância global
const fluxoCaixaSync = new FluxoCaixaSync();
window.fluxoCaixaSync = fluxoCaixaSync;

// Exportar
export { fluxoCaixaSync, FluxoCaixaSync };

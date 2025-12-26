// =========================================================================
// MÓDULO DE SINCRONIZAÇÃO - FLUXO DE CAIXA HVC
// =========================================================================
// Versão: 3.0
// Data: 24/12/2024
// Descrição: Sincroniza pagamentos e recebimentos do Google Calendar com
//            a tabela fluxo_caixa_hvc no Supabase, usando o mesmo padrão
//            de parsing existente na página de fluxo de caixa
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
        this.filtros = {
            tipo: 'todos', // 'todos', 'pagamento', 'recebimento'
            status: 'todos',
            mes: 'todos'
        };
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
                        Atualizar Listas
                    </button>
                    <span class="sync-info">
                        <i class="fas fa-info-circle"></i>
                        Última atualização: <span id="ultimaSincronizacao">Nunca</span>
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
    // RENDERIZAR LISTAS PERSISTENTES COM FILTROS
    // =========================================================================
    async renderizarListasPersistentes() {
        await this.carregarDadosLocais();
        
        // Aplicar filtros
        let dadosFiltrados = this.aplicarFiltros(this.dadosLocais);
        
        const pagamentos = dadosFiltrados.filter(item => item.tipo === 'pagamento');
        const recebimentos = dadosFiltrados.filter(item => item.tipo === 'recebimento');

        this.renderizarFiltros();
        this.renderizarListaPagamentos(pagamentos);
        this.renderizarListaRecebimentos(recebimentos);
        this.renderizarResumo(pagamentos, recebimentos);
    }

    aplicarFiltros(dados) {
        return dados.filter(item => {
            // Filtro por tipo
            if (this.filtros.tipo !== 'todos' && item.tipo !== this.filtros.tipo) {
                return false;
            }
            // Filtro por status
            if (this.filtros.status !== 'todos') {
                const statusNormalizado = (item.status || '').toUpperCase();
                if (statusNormalizado !== this.filtros.status.toUpperCase()) {
                    return false;
                }
            }
            // Filtro por mês
            if (this.filtros.mes !== 'todos') {
                const mesItem = new Date(item.data_vencimento).getMonth();
                if (mesItem !== parseInt(this.filtros.mes)) {
                    return false;
                }
            }
            return true;
        });
    }

    renderizarFiltros() {
        const container = document.getElementById('filtrosContainer');
        if (!container) {
            const listsSection = document.getElementById('listsSection');
            if (listsSection) {
                const filtrosDiv = document.createElement('div');
                filtrosDiv.id = 'filtrosContainer';
                filtrosDiv.className = 'filtros-container';
                
                const syncBtn = document.getElementById('syncButtonContainer');
                if (syncBtn && syncBtn.nextSibling) {
                    listsSection.insertBefore(filtrosDiv, syncBtn.nextSibling);
                } else {
                    listsSection.appendChild(filtrosDiv);
                }
            }
        }

        const filtrosContainer = document.getElementById('filtrosContainer');
        if (filtrosContainer) {
            const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            
            filtrosContainer.innerHTML = `
                <div class="filtros-wrapper">
                    <div class="filtro-grupo">
                        <label>Tipo:</label>
                        <select id="filtroTipo" onchange="fluxoCaixaSync.atualizarFiltro('tipo', this.value)">
                            <option value="todos" ${this.filtros.tipo === 'todos' ? 'selected' : ''}>Todos</option>
                            <option value="pagamento" ${this.filtros.tipo === 'pagamento' ? 'selected' : ''}>Pagamentos</option>
                            <option value="recebimento" ${this.filtros.tipo === 'recebimento' ? 'selected' : ''}>Recebimentos</option>
                        </select>
                    </div>
                    <div class="filtro-grupo">
                        <label>Status:</label>
                        <select id="filtroStatus" onchange="fluxoCaixaSync.atualizarFiltro('status', this.value)">
                            <option value="todos" ${this.filtros.status === 'todos' ? 'selected' : ''}>Todos</option>
                            <option value="PG" ${this.filtros.status === 'PG' ? 'selected' : ''}>PG (Pago)</option>
                            <option value="PENDENTE" ${this.filtros.status === 'PENDENTE' ? 'selected' : ''}>Pendente</option>
                            <option value="RECALCULADO" ${this.filtros.status === 'RECALCULADO' ? 'selected' : ''}>Recalculado</option>
                            <option value="RC" ${this.filtros.status === 'RC' ? 'selected' : ''}>RC (Recebido)</option>
                            <option value="ADIADO" ${this.filtros.status === 'ADIADO' ? 'selected' : ''}>Adiado</option>
                            <option value="AGUARDANDO" ${this.filtros.status === 'AGUARDANDO' ? 'selected' : ''}>Aguardando</option>
                        </select>
                    </div>
                    <div class="filtro-grupo">
                        <label>Mês:</label>
                        <select id="filtroMes" onchange="fluxoCaixaSync.atualizarFiltro('mes', this.value)">
                            <option value="todos" ${this.filtros.mes === 'todos' ? 'selected' : ''}>Todos</option>
                            ${meses.map((mes, i) => `<option value="${i}" ${this.filtros.mes === String(i) ? 'selected' : ''}>${mes}</option>`).join('')}
                        </select>
                    </div>
                    <button class="btn-limpar-filtros" onclick="fluxoCaixaSync.limparFiltros()">
                        <i class="fas fa-times"></i> Limpar
                    </button>
                </div>
            `;
        }
    }

    atualizarFiltro(campo, valor) {
        this.filtros[campo] = valor;
        this.renderizarListasPersistentes();
    }

    limparFiltros() {
        this.filtros = { tipo: 'todos', status: 'todos', mes: 'todos' };
        this.renderizarListasPersistentes();
    }

    renderizarResumo(pagamentos, recebimentos) {
        const container = document.getElementById('resumoContainer');
        if (!container) {
            const listsSection = document.getElementById('listsSection');
            if (listsSection) {
                const resumoDiv = document.createElement('div');
                resumoDiv.id = 'resumoContainer';
                resumoDiv.className = 'resumo-container';
                
                const filtrosContainer = document.getElementById('filtrosContainer');
                if (filtrosContainer && filtrosContainer.nextSibling) {
                    listsSection.insertBefore(resumoDiv, filtrosContainer.nextSibling);
                }
            }
        }

        const resumoContainer = document.getElementById('resumoContainer');
        if (resumoContainer) {
            const totalPagamentos = pagamentos.reduce((sum, item) => sum + parseFloat(item.valor || 0), 0);
            const totalRecebimentos = recebimentos.reduce((sum, item) => sum + parseFloat(item.valor || 0), 0);
            const saldo = totalRecebimentos - totalPagamentos;

            resumoContainer.innerHTML = `
                <div class="resumo-cards">
                    <div class="resumo-card pagamento">
                        <div class="resumo-icon"><i class="fas fa-arrow-up"></i></div>
                        <div class="resumo-info">
                            <span class="resumo-label">Total Pagamentos</span>
                            <span class="resumo-valor">R$ ${this.formatarMoeda(totalPagamentos)}</span>
                            <span class="resumo-qtd">${pagamentos.length} itens</span>
                        </div>
                    </div>
                    <div class="resumo-card recebimento">
                        <div class="resumo-icon"><i class="fas fa-arrow-down"></i></div>
                        <div class="resumo-info">
                            <span class="resumo-label">Total Recebimentos</span>
                            <span class="resumo-valor">R$ ${this.formatarMoeda(totalRecebimentos)}</span>
                            <span class="resumo-qtd">${recebimentos.length} itens</span>
                        </div>
                    </div>
                    <div class="resumo-card saldo ${saldo >= 0 ? 'positivo' : 'negativo'}">
                        <div class="resumo-icon"><i class="fas fa-balance-scale"></i></div>
                        <div class="resumo-info">
                            <span class="resumo-label">Saldo</span>
                            <span class="resumo-valor">${saldo >= 0 ? '' : '-'}R$ ${this.formatarMoeda(Math.abs(saldo))}</span>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    renderizarListaPagamentos(pagamentos) {
        const container = document.getElementById('paymentsList');
        if (!container) return;

        if (pagamentos.length === 0) {
            container.innerHTML = `
                <div class="empty-list-message">
                    <i class="fas fa-inbox"></i>
                    <p>Nenhum pagamento encontrado</p>
                    <small>Clique em "Atualizar Listas" para sincronizar com o Google Agenda</small>
                </div>
            `;
            return;
        }

        // Agrupar por mês
        const pagamentosPorMes = this.agruparPorMes(pagamentos);
        
        let html = '';
        for (const [mes, items] of Object.entries(pagamentosPorMes)) {
            const totalMes = items.reduce((sum, item) => sum + parseFloat(item.valor || 0), 0);
            html += `
                <div class="month-group">
                    <div class="month-header">
                        <span class="month-name">${mes}</span>
                        <span class="month-total pagamento">R$ ${this.formatarMoeda(totalMes)}</span>
                    </div>
                    <div class="month-items">
                        ${items.map(item => this.renderizarItemLista(item)).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    renderizarListaRecebimentos(recebimentos) {
        const container = document.getElementById('receiptsList');
        if (!container) return;

        if (recebimentos.length === 0) {
            container.innerHTML = `
                <div class="empty-list-message">
                    <i class="fas fa-inbox"></i>
                    <p>Nenhum recebimento encontrado</p>
                    <small>Clique em "Atualizar Listas" para sincronizar com o Google Agenda</small>
                </div>
            `;
            return;
        }

        // Agrupar por mês
        const recebimentosPorMes = this.agruparPorMes(recebimentos);
        
        let html = '';
        for (const [mes, items] of Object.entries(recebimentosPorMes)) {
            const totalMes = items.reduce((sum, item) => sum + parseFloat(item.valor || 0), 0);
            html += `
                <div class="month-group">
                    <div class="month-header">
                        <span class="month-name">${mes}</span>
                        <span class="month-total recebimento">R$ ${this.formatarMoeda(totalMes)}</span>
                    </div>
                    <div class="month-items">
                        ${items.map(item => this.renderizarItemLista(item)).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    renderizarItemLista(item) {
        const statusClass = this.getStatusClass(item.status, item.tipo);
        const statusIcon = this.getStatusIcon(item.status);
        const dataFormatada = this.formatarData(item.data_vencimento);
        
        // Construir descrição completa
        let descricaoCompleta = '';
        if (item.tipo_item) descricaoCompleta += `<span class="item-tipo-tag">${item.tipo_item}</span>`;
        if (item.subtipo) descricaoCompleta += `<span class="item-subtipo-tag">${item.subtipo}</span>`;
        if (item.categoria) descricaoCompleta += `<span class="item-categoria-tag">${item.categoria}</span>`;
        
        const nome = item.nome || item.descricao || 'Sem descrição';
        
        return `
            <div class="list-item ${item.tipo}" data-id="${item.id}">
                <div class="item-info">
                    <span class="item-date">${dataFormatada}</span>
                    <div class="item-tags">${descricaoCompleta}</div>
                    <span class="item-description">${nome}</span>
                    ${item.detalhe ? `<span class="item-detalhe">${item.detalhe}</span>` : ''}
                </div>
                <div class="item-value-status">
                    <span class="item-value ${item.tipo}">R$ ${this.formatarMoeda(item.valor)}</span>
                    <span class="item-status ${statusClass}">
                        <i class="fas ${statusIcon}"></i>
                        ${item.status || 'PENDENTE'}
                    </span>
                </div>
            </div>
        `;
    }

    getStatusClass(status, tipo) {
        const s = (status || '').toUpperCase();
        if (tipo === 'pagamento') {
            if (s === 'PG') return 'status-pago';
            if (s === 'RECALCULADO') return 'status-recalculado';
            return 'status-pendente';
        } else {
            if (s === 'RC') return 'status-recebido';
            if (s === 'ADIADO') return 'status-adiado';
            return 'status-aguardando';
        }
    }

    getStatusIcon(status) {
        const s = (status || '').toUpperCase();
        if (s === 'PG' || s === 'RC') return 'fa-check-circle';
        if (s === 'RECALCULADO') return 'fa-calculator';
        if (s === 'ADIADO') return 'fa-clock';
        return 'fa-hourglass-half';
    }

    agruparPorMes(items) {
        const meses = {};
        const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                           'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

        items.forEach(item => {
            const data = new Date(item.data_vencimento);
            const mesAno = `${nomesMeses[data.getMonth()]} ${data.getFullYear()}`;
            
            if (!meses[mesAno]) {
                meses[mesAno] = [];
            }
            meses[mesAno].push(item);
        });

        return meses;
    }

    // =========================================================================
    // INICIAR SINCRONIZAÇÃO
    // =========================================================================
    async iniciarSincronizacao() {
        const btn = document.getElementById('btnSincronizarAgenda');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando eventos...';
        }

        try {
            // Buscar eventos do Google Agenda
            const eventosAgenda = await this.buscarEventosGoogleAgenda();
            
            if (eventosAgenda.length === 0) {
                this.mostrarNotificacao('Nenhum evento de pagamento/recebimento encontrado no Google Agenda', 'warning');
                return;
            }

            // Comparar com dados locais
            this.compararDados(eventosAgenda);

            // Mostrar modal de preview
            this.mostrarModalPreview();

        } catch (error) {
            console.error('❌ Erro na sincronização:', error);
            this.mostrarNotificacao(error.message || 'Erro ao sincronizar', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar Listas';
            }
        }
    }

    // =========================================================================
    // BUSCAR EVENTOS DO GOOGLE AGENDA
    // =========================================================================
    async buscarEventosGoogleAgenda() {
        // Verificar se gapi está disponível
        if (typeof gapi === 'undefined' || !gapi.client) {
            throw new Error('Google API não carregada. Aguarde o carregamento completo da página.');
        }

        // Verificar se há contas conectadas via googleAuth
        let accounts = [];
        
        // Fonte 1: googleAuth.getAccounts()
        if (typeof googleAuth !== 'undefined' && googleAuth && typeof googleAuth.getAccounts === 'function') {
            const authAccounts = googleAuth.getAccounts();
            if (authAccounts && authAccounts.length > 0) {
                accounts = authAccounts;
                console.log('📝 Contas encontradas em googleAuth:', accounts.length);
            }
        }
        
        // Fonte 2: window.connectedAccounts
        if (accounts.length === 0 && window.connectedAccounts && Array.isArray(window.connectedAccounts)) {
            accounts = window.connectedAccounts.filter(acc => acc && acc.email);
            console.log('📝 Contas encontradas em window.connectedAccounts:', accounts.length);
        }
        
        // Fonte 3: localStorage
        if (accounts.length === 0) {
            try {
                const storedAccounts = localStorage.getItem('connectedAccounts');
                if (storedAccounts) {
                    const parsedAccounts = JSON.parse(storedAccounts);
                    if (Array.isArray(parsedAccounts)) {
                        accounts = parsedAccounts.filter(acc => acc && acc.email && acc.accessToken);
                        console.log('📝 Contas encontradas em localStorage:', accounts.length);
                    }
                }
            } catch (e) {
                console.warn('⚠️ Erro ao ler localStorage:', e);
            }
        }
        
        // Fonte 4: Verificar se há token ativo no gapi
        if (accounts.length === 0) {
            const token = gapi.client.getToken();
            if (token && token.access_token) {
                console.log('📝 Token ativo encontrado no gapi');
                accounts = [{ email: 'conta_principal', accessToken: token.access_token }];
            }
        }
        
        if (accounts.length === 0) {
            throw new Error('Nenhuma conta do Google conectada. Conecte uma conta na barra lateral.');
        }
        
        console.log('✅ Total de contas encontradas:', accounts.length, accounts.map(a => a.email));

        const todosEventos = [];
        const inicioAno = new Date(this.anoAtual, 0, 1);
        const fimAno = new Date(this.anoAtual, 11, 31, 23, 59, 59);

        // Keywords para filtrar eventos (mesmo padrão da página de fluxo de caixa)
        const keywords = ['pagamento', 'pagamentos', 'recebimento', 'recebimentos', 'hvc'];

        for (const account of accounts) {
            try {
                console.log(`📅 Buscando eventos da conta: ${account.email}`);
                
                // Definir token da conta atual
                if (account.accessToken) {
                    gapi.client.setToken({ access_token: account.accessToken });
                }
                
                // Buscar eventos usando gapi.client.calendar.events.list
                const response = await gapi.client.calendar.events.list({
                    calendarId: 'primary',
                    timeMin: inicioAno.toISOString(),
                    timeMax: fimAno.toISOString(),
                    showDeleted: false,
                    singleEvents: true,
                    maxResults: 2500,
                    orderBy: 'startTime'
                });

                const eventos = response.result.items || [];
                console.log(`📅 ${eventos.length} eventos totais encontrados na conta ${account.email}`);
                
                // Filtrar eventos que contenham as keywords no título
                const eventosFiltrados = eventos.filter(event => {
                    const title = (event.summary || '').toLowerCase();
                    return keywords.some(keyword => title.includes(keyword));
                });
                
                console.log(`✅ ${eventosFiltrados.length} eventos de pagamento/recebimento encontrados`);
                
                // Processar eventos usando o mesmo padrão da página de fluxo de caixa
                const eventosProcessados = this.processarEventosAgenda(eventosFiltrados, account.email);
                todosEventos.push(...eventosProcessados);
                
            } catch (error) {
                console.error(`❌ Erro ao buscar eventos de ${account.email}:`, error);
                
                // Se for erro 401, tentar reconectar
                if (error.status === 401) {
                    this.mostrarNotificacao(`Token expirado para ${account.email}. Reconecte a conta.`, 'warning');
                }
            }
        }

        console.log(`✅ Total de ${todosEventos.length} itens de pagamento/recebimento encontrados`);
        this.dadosAgenda = todosEventos;
        return todosEventos;
    }

    // =========================================================================
    // PROCESSAR EVENTOS DA AGENDA (MESMO PADRÃO DA PÁGINA DE FLUXO DE CAIXA)
    // =========================================================================
    processarEventosAgenda(eventos, accountEmail) {
        const eventosProcessados = [];

        for (const evento of eventos) {
            const titulo = evento.summary || '';
            const descricao = evento.description || '';
            const dataEvento = evento.start?.date || (evento.start?.dateTime ? evento.start.dateTime.split('T')[0] : null);
            
            if (!dataEvento) continue;

            // Determinar tipo baseado no título do evento
            const titleLower = titulo.toLowerCase();
            let tipoEvento = 'pagamento';
            if (titleLower.includes('recebimento')) {
                tipoEvento = 'recebimento';
            }

            // Extrair itens de pagamento/recebimento da descrição
            const itens = this.extractPaymentInfo(descricao, titulo);
            
            if (itens.length > 0) {
                // Processar cada item encontrado
                for (const item of itens) {
                    eventosProcessados.push({
                        google_event_id: evento.id,
                        google_calendar_id: accountEmail,
                        tipo: item.type || tipoEvento,
                        tipo_item: item.tipo,
                        subtipo: item.subtipo,
                        categoria: item.categoria,
                        nome: item.name,
                        descricao: item.original,
                        valor: item.value || 0,
                        data_vencimento: dataEvento,
                        status: item.status,
                        detalhe: item.detail,
                        observacoes: descricao,
                        _accountEmail: accountEmail,
                        _eventTitle: titulo,
                        _itemIndex: itens.indexOf(item)
                    });
                }
            } else {
                // Evento sem itens estruturados - criar item genérico
                const valor = this.extrairValorSimples(titulo) || this.extrairValorSimples(descricao) || 0;
                
                eventosProcessados.push({
                    google_event_id: evento.id,
                    google_calendar_id: accountEmail,
                    tipo: tipoEvento,
                    tipo_item: null,
                    subtipo: null,
                    categoria: null,
                    nome: titulo,
                    descricao: titulo,
                    valor: valor,
                    data_vencimento: dataEvento,
                    status: tipoEvento === 'recebimento' ? 'AGUARDANDO' : 'PENDENTE',
                    detalhe: null,
                    observacoes: descricao,
                    _accountEmail: accountEmail,
                    _eventTitle: titulo,
                    _itemIndex: 0
                });
            }
        }

        return eventosProcessados;
    }

    // =========================================================================
    // EXTRAIR INFORMAÇÕES DE PAGAMENTO (MESMO PADRÃO DA PÁGINA DE FLUXO DE CAIXA)
    // =========================================================================
    extractPaymentInfo(text, eventTitle = '') {
        if (!text) return [];
        
        // Determinar tipo baseado no título do evento primeiro
        const titleLower = eventTitle.toLowerCase();
        let defaultType = 'pagamento';
        if (titleLower.includes('recebimento')) {
            defaultType = 'recebimento';
        }
        
        // Regex para detectar padrões como "Nome do pagamento - R$ 1.234,56 (STATUS) - detalhes"
        const paymentRegex = /([^-\n\r]+?)\s*-\s*R\$\s*([\d.]+,\d{2})\s*(\([^)]*\))?\s*(?:-\s*([^\n\r]*))?/gi;
        const matches = [];
        let match;
        
        while ((match = paymentRegex.exec(text)) !== null) {
            let fullTextBeforeValue = match[1].trim();
            let itemType = defaultType;
            
            // Remover "PAGAMENTO" ou "RECEBIMENTO" do início se existir e ajustar tipo
            if (fullTextBeforeValue.toLowerCase().startsWith('pagamento ')) {
                fullTextBeforeValue = fullTextBeforeValue.substring(10).trim();
                itemType = 'pagamento';
            } else if (fullTextBeforeValue.toLowerCase().startsWith('recebimento ')) {
                fullTextBeforeValue = fullTextBeforeValue.substring(12).trim();
                itemType = 'recebimento';
            }
            
            // Extrair TIPO, SUBTIPO, CATEGORIA e NOME
            // Formato: TIPO - SUBTIPO - CATEGORIA - NOME
            const parts = fullTextBeforeValue.split(' - ').map(p => p.trim());
            let tipo = null;
            let subtipo = null;
            let categoria = null;
            let nome = null;
            
            if (parts.length >= 4) {
                // Tem todas as 4 partes: TIPO - SUBTIPO - CATEGORIA - NOME
                tipo = parts[0];
                subtipo = parts[1];
                categoria = parts[2];
                nome = parts.slice(3).join(' - ');
            } else if (parts.length === 3) {
                // Tem 3 partes: SUBTIPO - CATEGORIA - NOME
                subtipo = parts[0];
                categoria = parts[1];
                nome = parts[2];
            } else if (parts.length === 2) {
                // Tem 2 partes: CATEGORIA - NOME
                categoria = parts[0];
                nome = parts[1];
            } else if (parts.length === 1) {
                // Tem apenas 1 parte: NOME
                nome = parts[0];
            } else {
                nome = fullTextBeforeValue;
            }
            
            const valueStr = match[2];
            const statusText = match[3] ? match[3].replace(/[()]/g, '').trim() : '';
            const detailText = match[4] ? match[4].trim() : '';
            const numericValue = parseFloat(valueStr.replace(/\./g, '').replace(',', '.'));
            
            // Determinar status baseado no texto entre parênteses e tipo
            let status = itemType === 'recebimento' ? 'AGUARDANDO' : 'PENDENTE';
            
            if (statusText) {
                const statusLower = statusText.toLowerCase();
                
                if (itemType === 'recebimento') {
                    if (statusLower.includes('rc')) {
                        status = 'RC';
                    } else if (statusLower.includes('adiado')) {
                        status = 'ADIADO';
                    } else if (statusLower.includes('aguardando')) {
                        status = 'AGUARDANDO';
                    }
                } else {
                    if (statusLower.includes('pg')) {
                        status = 'PG';
                    } else if (statusLower.includes('recalculado')) {
                        status = 'RECALCULADO';
                    } else if (statusLower.includes('pendente')) {
                        status = 'PENDENTE';
                    }
                }
            }
            
            matches.push({
                tipo: tipo,
                subtipo: subtipo,
                categoria: categoria,
                name: nome,
                original: `${fullTextBeforeValue} - R$ ${valueStr}${match[3] ? ' ' + match[3] : ''}${detailText ? ' - ' + detailText : ''}`,
                value: numericValue,
                formattedValue: `R$ ${valueStr}`,
                status: status,
                statusText: statusText,
                detail: detailText,
                type: itemType
            });
        }
        
        return matches;
    }

    extrairValorSimples(texto) {
        if (!texto) return 0;
        
        const padroes = [
            /R\$\s*([\d.,]+)/i,
            /(\d{1,3}(?:\.\d{3})*(?:,\d{2}))/,
            /(\d+(?:,\d{2}))/
        ];

        for (const padrao of padroes) {
            const match = texto.match(padrao);
            if (match) {
                let valor = match[1];
                valor = valor.replace(/\./g, '').replace(',', '.');
                const numero = parseFloat(valor);
                if (!isNaN(numero) && numero > 0) {
                    return numero;
                }
            }
        }

        return 0;
    }

    // =========================================================================
    // COMPARAR DADOS (AGENDA vs LOCAL)
    // =========================================================================
    compararDados(eventosAgenda) {
        this.alteracoesPendentes = {
            adicionar: [],
            modificar: [],
            excluir: []
        };

        // Criar mapa de eventos locais por google_event_id + item_index
        const mapaLocal = new Map();
        this.dadosLocais.forEach(item => {
            if (item.google_event_id) {
                const key = `${item.google_event_id}_${item.google_calendar_id}_${item.nome || ''}`;
                mapaLocal.set(key, item);
            }
        });

        // Criar mapa de eventos da agenda
        const mapaAgenda = new Map();
        eventosAgenda.forEach(evento => {
            const key = `${evento.google_event_id}_${evento.google_calendar_id}_${evento.nome || ''}`;
            mapaAgenda.set(key, evento);
        });

        // Verificar novos e modificados
        for (const evento of eventosAgenda) {
            const key = `${evento.google_event_id}_${evento.google_calendar_id}_${evento.nome || ''}`;
            const itemLocal = mapaLocal.get(key);

            if (!itemLocal) {
                // Novo evento
                this.alteracoesPendentes.adicionar.push(evento);
            } else {
                // Verificar se houve modificação
                if (this.eventoModificado(itemLocal, evento)) {
                    this.alteracoesPendentes.modificar.push({
                        local: itemLocal,
                        agenda: evento
                    });
                }
            }
        }

        // Verificar excluídos (eventos locais que não estão mais na agenda)
        for (const [key, itemLocal] of mapaLocal) {
            if (!mapaAgenda.has(key)) {
                this.alteracoesPendentes.excluir.push(itemLocal);
            }
        }

        console.log('📊 Alterações pendentes:', {
            adicionar: this.alteracoesPendentes.adicionar.length,
            modificar: this.alteracoesPendentes.modificar.length,
            excluir: this.alteracoesPendentes.excluir.length
        });
    }

    eventoModificado(local, agenda) {
        return (
            local.nome !== agenda.nome ||
            local.tipo_item !== agenda.tipo_item ||
            local.subtipo !== agenda.subtipo ||
            local.categoria !== agenda.categoria ||
            parseFloat(local.valor) !== parseFloat(agenda.valor) ||
            local.data_vencimento !== agenda.data_vencimento ||
            local.status !== agenda.status ||
            local.detalhe !== agenda.detalhe
        );
    }

    // =========================================================================
    // MODAL DE PREVIEW
    // =========================================================================
    mostrarModalPreview() {
        const { adicionar, modificar, excluir } = this.alteracoesPendentes;
        const totalAlteracoes = adicionar.length + modificar.length + excluir.length;

        if (totalAlteracoes === 0) {
            this.mostrarNotificacao('Nenhuma alteração necessária. Dados já estão sincronizados!', 'success');
            return;
        }

        // Criar ou obter modal
        let modal = document.getElementById('modalSyncPreview');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modalSyncPreview';
            modal.className = 'modal-overlay';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content modal-sync-preview">
                <div class="modal-header">
                    <h3><i class="fas fa-sync-alt"></i> Preview de Atualização</h3>
                    <button class="modal-close" onclick="fluxoCaixaSync.fecharModalPreview()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="sync-summary">
                        <div class="sync-stat adicionar">
                            <i class="fas fa-plus-circle"></i>
                            <span class="stat-number">${adicionar.length}</span>
                            <span class="stat-label">Novos</span>
                        </div>
                        <div class="sync-stat modificar">
                            <i class="fas fa-edit"></i>
                            <span class="stat-number">${modificar.length}</span>
                            <span class="stat-label">Alterados</span>
                        </div>
                        <div class="sync-stat excluir">
                            <i class="fas fa-trash-alt"></i>
                            <span class="stat-number">${excluir.length}</span>
                            <span class="stat-label">Removidos</span>
                        </div>
                    </div>

                    <div class="sync-details">
                        ${this.renderizarSecaoPreview('Novos Itens', adicionar, 'adicionar')}
                        ${this.renderizarSecaoPreview('Itens Alterados', modificar, 'modificar')}
                        ${this.renderizarSecaoPreview('Itens a Remover', excluir, 'excluir')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="fluxoCaixaSync.fecharModalPreview()">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button class="btn-primary" onclick="fluxoCaixaSync.confirmarSincronizacao()">
                        <i class="fas fa-check"></i> Confirmar Atualização
                    </button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }

    renderizarSecaoPreview(titulo, items, tipo) {
        if (items.length === 0) return '';

        let itemsHtml = '';
        items.forEach((item, index) => {
            const dados = tipo === 'modificar' ? item.agenda : item;
            const dadosAntigos = tipo === 'modificar' ? item.local : null;
            
            // Construir tags de classificação
            let tags = '';
            if (dados.tipo_item) tags += `<span class="preview-tag tipo">${dados.tipo_item}</span>`;
            if (dados.subtipo) tags += `<span class="preview-tag subtipo">${dados.subtipo}</span>`;
            if (dados.categoria) tags += `<span class="preview-tag categoria">${dados.categoria}</span>`;
            
            itemsHtml += `
                <div class="preview-item ${tipo}">
                    <label class="checkbox-container">
                        <input type="checkbox" checked data-tipo="${tipo}" data-index="${index}">
                        <span class="checkmark"></span>
                    </label>
                    <div class="item-details">
                        <div class="item-header">
                            <span class="item-tipo-badge ${dados.tipo}">${dados.tipo}</span>
                            <span class="item-status-badge ${this.getStatusClass(dados.status, dados.tipo)}">${dados.status || 'PENDENTE'}</span>
                        </div>
                        <div class="item-tags">${tags}</div>
                        <span class="item-desc">${dados.nome || dados.descricao || 'Sem descrição'}</span>
                        <div class="item-meta">
                            <span class="item-data"><i class="fas fa-calendar"></i> ${this.formatarData(dados.data_vencimento)}</span>
                            <span class="item-valor ${dados.tipo}"><i class="fas fa-dollar-sign"></i> R$ ${this.formatarMoeda(dados.valor)}</span>
                        </div>
                        ${dados.detalhe ? `<span class="item-detalhe"><i class="fas fa-info-circle"></i> ${dados.detalhe}</span>` : ''}
                        ${tipo === 'modificar' && dadosAntigos ? `
                            <div class="item-changes">
                                <small><i class="fas fa-history"></i> Anterior: R$ ${this.formatarMoeda(dadosAntigos.valor)} - ${dadosAntigos.nome || dadosAntigos.descricao}</small>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        return `
            <div class="preview-section ${tipo}">
                <h4>
                    <i class="fas fa-${tipo === 'adicionar' ? 'plus' : tipo === 'modificar' ? 'edit' : 'trash'}"></i>
                    ${titulo} (${items.length})
                    <label class="select-all-container">
                        <input type="checkbox" checked onchange="fluxoCaixaSync.toggleSelectAll('${tipo}', this.checked)">
                        <span>Selecionar todos</span>
                    </label>
                </h4>
                <div class="preview-items">
                    ${itemsHtml}
                </div>
            </div>
        `;
    }

    toggleSelectAll(tipo, checked) {
        const checkboxes = document.querySelectorAll(`#modalSyncPreview input[data-tipo="${tipo}"]`);
        checkboxes.forEach(cb => cb.checked = checked);
    }

    fecharModalPreview() {
        const modal = document.getElementById('modalSyncPreview');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // =========================================================================
    // CONFIRMAR SINCRONIZAÇÃO
    // =========================================================================
    async confirmarSincronizacao() {
        const btn = document.querySelector('.modal-footer .btn-primary');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atualizando...';
        }

        try {
            // Obter itens selecionados
            const checkboxes = document.querySelectorAll('#modalSyncPreview input[type="checkbox"][data-tipo]:checked');
            
            const selecionados = {
                adicionar: [],
                modificar: [],
                excluir: []
            };

            checkboxes.forEach(cb => {
                const tipo = cb.dataset.tipo;
                const index = parseInt(cb.dataset.index);
                if (!isNaN(index) && this.alteracoesPendentes[tipo][index]) {
                    selecionados[tipo].push(this.alteracoesPendentes[tipo][index]);
                }
            });

            // Executar operações
            let sucesso = 0;
            let erros = 0;

            // Adicionar novos
            for (const item of selecionados.adicionar) {
                try {
                    const { error } = await supabaseClient
                        .from('fluxo_caixa_hvc')
                        .insert({
                            tipo: item.tipo,
                            tipo_item: item.tipo_item,
                            subtipo: item.subtipo,
                            categoria: item.categoria,
                            nome: item.nome,
                            descricao: item.descricao,
                            valor: item.valor,
                            data_vencimento: item.data_vencimento,
                            status: item.status,
                            detalhe: item.detalhe,
                            google_event_id: item.google_event_id,
                            google_calendar_id: item.google_calendar_id,
                            observacoes: item.observacoes,
                            sincronizado_em: new Date().toISOString()
                        });

                    if (error) throw error;
                    sucesso++;
                } catch (e) {
                    console.error('Erro ao adicionar:', e);
                    erros++;
                }
            }

            // Modificar existentes
            for (const item of selecionados.modificar) {
                try {
                    const { error } = await supabaseClient
                        .from('fluxo_caixa_hvc')
                        .update({
                            tipo: item.agenda.tipo,
                            tipo_item: item.agenda.tipo_item,
                            subtipo: item.agenda.subtipo,
                            categoria: item.agenda.categoria,
                            nome: item.agenda.nome,
                            descricao: item.agenda.descricao,
                            valor: item.agenda.valor,
                            data_vencimento: item.agenda.data_vencimento,
                            status: item.agenda.status,
                            detalhe: item.agenda.detalhe,
                            observacoes: item.agenda.observacoes,
                            sincronizado_em: new Date().toISOString()
                        })
                        .eq('id', item.local.id);

                    if (error) throw error;
                    sucesso++;
                } catch (e) {
                    console.error('Erro ao modificar:', e);
                    erros++;
                }
            }

            // Excluir removidos
            for (const item of selecionados.excluir) {
                try {
                    const { error } = await supabaseClient
                        .from('fluxo_caixa_hvc')
                        .delete()
                        .eq('id', item.id);

                    if (error) throw error;
                    sucesso++;
                } catch (e) {
                    console.error('Erro ao excluir:', e);
                    erros++;
                }
            }

            // Salvar última sincronização
            localStorage.setItem('ultimaSincronizacaoFluxoCaixa', new Date().toISOString());

            // Fechar modal e atualizar listas
            this.fecharModalPreview();
            await this.renderizarListasPersistentes();
            this.atualizarUltimaSincronizacao();

            // Mostrar resultado
            if (erros === 0) {
                this.mostrarNotificacao(`Atualização concluída! ${sucesso} itens processados.`, 'success');
            } else {
                this.mostrarNotificacao(`Atualização parcial: ${sucesso} ok, ${erros} erros.`, 'warning');
            }

        } catch (error) {
            console.error('❌ Erro na atualização:', error);
            this.mostrarNotificacao('Erro ao atualizar dados', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-check"></i> Confirmar Atualização';
            }
        }
    }

    // =========================================================================
    // UTILITÁRIOS
    // =========================================================================
    atualizarUltimaSincronizacao() {
        const elemento = document.getElementById('ultimaSincronizacao');
        if (elemento) {
            const ultima = localStorage.getItem('ultimaSincronizacaoFluxoCaixa');
            if (ultima) {
                const data = new Date(ultima);
                elemento.textContent = data.toLocaleString('pt-BR');
            } else {
                elemento.textContent = 'Nunca';
            }
        }
    }

    formatarMoeda(valor) {
        const numero = parseFloat(valor) || 0;
        return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    formatarData(data) {
        if (!data) return '-';
        const d = new Date(data + 'T00:00:00');
        return d.toLocaleDateString('pt-BR');
    }

    mostrarNotificacao(mensagem, tipo = 'info') {
        // Usar a função showMessage se disponível, senão criar notificação própria
        if (typeof showMessage === 'function') {
            showMessage(mensagem, tipo);
            return;
        }

        // Criar notificação própria
        const notif = document.createElement('div');
        notif.className = `sync-notification ${tipo}`;
        notif.innerHTML = `
            <i class="fas fa-${tipo === 'success' ? 'check-circle' : tipo === 'error' ? 'exclamation-circle' : tipo === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${mensagem}</span>
        `;
        document.body.appendChild(notif);

        setTimeout(() => {
            notif.classList.add('show');
        }, 10);

        setTimeout(() => {
            notif.classList.remove('show');
            setTimeout(() => notif.remove(), 300);
        }, 4000);
    }
}

// Criar instância global
const fluxoCaixaSync = new FluxoCaixaSync();
window.fluxoCaixaSync = fluxoCaixaSync;

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => fluxoCaixaSync.init());
} else {
    fluxoCaixaSync.init();
}

export { FluxoCaixaSync, fluxoCaixaSync };

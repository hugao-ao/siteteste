// sincronizacao-financeira.js - Módulo de Sincronização com Fluxo de Caixa
// Versão: 1.0
// Data: 18/12/2024
// Descrição: Importa dados do Google Calendar/Fluxo de Caixa para análises financeiras
//            com aprovação prévia das alterações pelo administrador

class SincronizacaoFinanceira {
    constructor() {
        this.alteracoesPendentes = {
            adicionar: [],
            modificar: [],
            excluir: []
        };
        this.obraAtual = null;
    }

    // =========================================================================
    // INICIALIZAÇÃO
    // =========================================================================
    async init() {
        console.log('🔄 Módulo de Sincronização Financeira carregado');
    }

    // =========================================================================
    // BUSCAR DADOS DO FLUXO DE CAIXA (Google Calendar)
    // =========================================================================
    async buscarDadosFluxoCaixa(obraId) {
        try {
            // Buscar dados existentes na análise financeira
            const { data: analiseExistente, error: errAnalise } = await supabaseClient
                .from('analise_financeira_obras')
                .select('*')
                .eq('obra_id', obraId);

            if (errAnalise) throw errAnalise;

            // Buscar medições da obra (receitas automáticas)
            const { data: medicoes, error: errMedicoes } = await supabaseClient
                .from('medicoes_hvc')
                .select('*')
                .eq('obra_id', obraId);

            if (errMedicoes) throw errMedicoes;

            return {
                analiseExistente: analiseExistente || [],
                medicoes: medicoes || []
            };
        } catch (error) {
            console.error('Erro ao buscar dados:', error);
            throw error;
        }
    }

    // =========================================================================
    // COMPARAR E DETECTAR ALTERAÇÕES
    // =========================================================================
    async detectarAlteracoes(obraId, dadosNovos) {
        const { analiseExistente } = await this.buscarDadosFluxoCaixa(obraId);
        
        this.alteracoesPendentes = {
            adicionar: [],
            modificar: [],
            excluir: []
        };

        // Criar mapa dos dados existentes por origem_id
        const existenteMap = {};
        analiseExistente.forEach(item => {
            if (item.origem_id) {
                existenteMap[item.origem_id] = item;
            }
        });

        // Processar dados novos
        dadosNovos.forEach(novo => {
            const origemId = novo.origem_id || novo.id;
            
            if (existenteMap[origemId]) {
                // Verificar se houve modificação
                const existente = existenteMap[origemId];
                const modificado = this.verificarModificacao(existente, novo);
                
                if (modificado) {
                    this.alteracoesPendentes.modificar.push({
                        id: existente.id,
                        anterior: existente,
                        novo: novo,
                        campos_alterados: modificado
                    });
                }
                
                // Remover do mapa para identificar exclusões
                delete existenteMap[origemId];
            } else {
                // Novo item
                this.alteracoesPendentes.adicionar.push({
                    ...novo,
                    origem_id: origemId
                });
            }
        });

        // Itens que sobraram no mapa são candidatos a exclusão
        Object.values(existenteMap).forEach(item => {
            if (item.origem === 'google_calendar') {
                this.alteracoesPendentes.excluir.push(item);
            }
        });

        return this.alteracoesPendentes;
    }

    verificarModificacao(existente, novo) {
        const camposAlterados = [];
        
        const camposComparar = ['descricao', 'valor', 'data_lancamento', 'categoria', 'tipo'];
        
        camposComparar.forEach(campo => {
            if (existente[campo] !== novo[campo]) {
                camposAlterados.push({
                    campo,
                    de: existente[campo],
                    para: novo[campo]
                });
            }
        });

        return camposAlterados.length > 0 ? camposAlterados : null;
    }

    // =========================================================================
    // MODAL DE APROVAÇÃO DE ALTERAÇÕES
    // =========================================================================
    mostrarModalAprovacao(obraId, obraNumero) {
        const { adicionar, modificar, excluir } = this.alteracoesPendentes;
        const totalAlteracoes = adicionar.length + modificar.length + excluir.length;

        if (totalAlteracoes === 0) {
            this.mostrarNotificacao('Nenhuma alteração detectada para sincronização.', 'info');
            return;
        }

        const modalHtml = `
            <div class="modal-overlay" id="modal-sincronizacao">
                <div class="modal-content modal-large" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2><i class="fas fa-sync-alt"></i> Sincronização - Obra ${obraNumero}</h2>
                        <button class="modal-close" onclick="sincFinanceira.fecharModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="sync-summary">
                            <p>Foram detectadas <strong>${totalAlteracoes}</strong> alterações para sincronização:</p>
                            <div class="sync-stats">
                                <span class="stat adicionar"><i class="fas fa-plus-circle"></i> ${adicionar.length} Adições</span>
                                <span class="stat modificar"><i class="fas fa-edit"></i> ${modificar.length} Modificações</span>
                                <span class="stat excluir"><i class="fas fa-trash"></i> ${excluir.length} Exclusões</span>
                            </div>
                        </div>

                        <!-- Adições -->
                        ${adicionar.length > 0 ? `
                            <div class="sync-section">
                                <h3 class="sync-section-title adicionar">
                                    <i class="fas fa-plus-circle"></i> Novos Lançamentos (${adicionar.length})
                                    <label class="select-all">
                                        <input type="checkbox" checked onchange="sincFinanceira.toggleTodos('adicionar', this.checked)">
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
                                                    <span class="tipo-badge ${item.tipo}">${item.tipo === 'receita' ? 'Receita' : 'Despesa'}</span>
                                                    <span class="categoria">${item.categoria || 'Sem categoria'}</span>
                                                </div>
                                                <div class="sync-item-descricao">${item.descricao || 'Sem descrição'}</div>
                                                <div class="sync-item-detalhes">
                                                    <span class="data"><i class="fas fa-calendar"></i> ${this.formatarData(item.data_lancamento)}</span>
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
                                    <i class="fas fa-edit"></i> Modificações (${modificar.length})
                                    <label class="select-all">
                                        <input type="checkbox" checked onchange="sincFinanceira.toggleTodos('modificar', this.checked)">
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
                                    <i class="fas fa-trash"></i> Exclusões (${excluir.length})
                                    <label class="select-all">
                                        <input type="checkbox" checked onchange="sincFinanceira.toggleTodos('excluir', this.checked)">
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
                                                    <span class="tipo-badge ${item.tipo}">${item.tipo === 'receita' ? 'Receita' : 'Despesa'}</span>
                                                    <span class="categoria">${item.categoria || 'Sem categoria'}</span>
                                                </div>
                                                <div class="sync-item-descricao">${item.descricao || 'Sem descrição'}</div>
                                                <div class="sync-item-detalhes">
                                                    <span class="data"><i class="fas fa-calendar"></i> ${this.formatarData(item.data_lancamento)}</span>
                                                    <span class="valor ${item.tipo}"><i class="fas fa-dollar-sign"></i> ${this.formatarMoeda(item.valor)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="btn-cancelar" onclick="sincFinanceira.fecharModal()">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                        <button class="btn-aplicar" onclick="sincFinanceira.aplicarAlteracoesSelecionadas('${obraId}')">
                            <i class="fas fa-check"></i> Aplicar Selecionados
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.adicionarEstilosModal();
    }

    adicionarEstilosModal() {
        if (document.getElementById('sync-modal-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'sync-modal-styles';
        styles.textContent = `
            .sync-summary {
                background: rgba(0, 0, 128, 0.2);
                padding: 1rem;
                border-radius: 8px;
                margin-bottom: 1.5rem;
            }

            .sync-stats {
                display: flex;
                gap: 1.5rem;
                margin-top: 0.75rem;
            }

            .sync-stats .stat {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.9rem;
            }

            .sync-stats .stat.adicionar { color: #20c997; }
            .sync-stats .stat.modificar { color: #ffc107; }
            .sync-stats .stat.excluir { color: #dc3545; }

            .sync-section {
                margin-bottom: 1.5rem;
            }

            .sync-section-title {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.75rem;
                border-radius: 6px;
                margin-bottom: 0.75rem;
                font-size: 1rem;
            }

            .sync-section-title.adicionar { background: rgba(32, 201, 151, 0.15); color: #20c997; }
            .sync-section-title.modificar { background: rgba(255, 193, 7, 0.15); color: #ffc107; }
            .sync-section-title.excluir { background: rgba(220, 53, 69, 0.15); color: #dc3545; }

            .select-all {
                font-size: 0.85rem;
                font-weight: normal;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                cursor: pointer;
            }

            .sync-items {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .sync-item {
                display: flex;
                gap: 1rem;
                padding: 0.75rem;
                background: rgba(25, 25, 51, 0.5);
                border: 1px solid rgba(173, 216, 230, 0.15);
                border-radius: 6px;
            }

            .sync-item.excluir {
                border-color: rgba(220, 53, 69, 0.3);
            }

            .sync-checkbox {
                display: flex;
                align-items: flex-start;
                padding-top: 0.25rem;
            }

            .sync-checkbox input {
                width: 18px;
                height: 18px;
                cursor: pointer;
            }

            .sync-item-content {
                flex: 1;
            }

            .sync-item-header {
                display: flex;
                gap: 0.75rem;
                margin-bottom: 0.5rem;
            }

            .tipo-badge {
                padding: 0.2rem 0.5rem;
                border-radius: 4px;
                font-size: 0.75rem;
                font-weight: 600;
            }

            .tipo-badge.receita { background: rgba(32, 201, 151, 0.2); color: #20c997; }
            .tipo-badge.despesa { background: rgba(220, 53, 69, 0.2); color: #dc3545; }

            .categoria {
                color: #c0c0c0;
                font-size: 0.85rem;
            }

            .sync-item-descricao {
                color: #e6e6fa;
                margin-bottom: 0.5rem;
            }

            .sync-item-detalhes {
                display: flex;
                gap: 1.5rem;
                font-size: 0.85rem;
                color: #c0c0c0;
            }

            .sync-item-detalhes .valor.receita { color: #20c997; }
            .sync-item-detalhes .valor.despesa { color: #dc3545; }

            .sync-changes {
                background: rgba(0, 0, 0, 0.2);
                padding: 0.5rem;
                border-radius: 4px;
            }

            .change-item {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.85rem;
                padding: 0.25rem 0;
            }

            .change-campo { color: #c0c0c0; }
            .change-de { color: #dc3545; text-decoration: line-through; }
            .change-para { color: #20c997; }
            .change-item i { color: #ffc107; font-size: 0.75rem; }

            .modal-footer {
                display: flex;
                justify-content: flex-end;
                gap: 1rem;
                padding: 1rem 1.5rem;
                border-top: 1px solid rgba(173, 216, 230, 0.2);
                background: rgba(0, 0, 128, 0.1);
            }

            .btn-cancelar, .btn-aplicar {
                padding: 0.6rem 1.25rem;
                border-radius: 6px;
                font-size: 0.9rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                transition: all 0.3s ease;
            }

            .btn-cancelar {
                background: transparent;
                border: 1px solid rgba(173, 216, 230, 0.3);
                color: #c0c0c0;
            }

            .btn-cancelar:hover {
                background: rgba(220, 53, 69, 0.1);
                border-color: #dc3545;
                color: #dc3545;
            }

            .btn-aplicar {
                background: linear-gradient(145deg, #20c997, #17a085);
                border: none;
                color: #ffffff;
            }

            .btn-aplicar:hover {
                background: linear-gradient(145deg, #28d9a3, #20c997);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(32, 201, 151, 0.3);
            }
        `;
        document.head.appendChild(styles);
    }

    // =========================================================================
    // AÇÕES
    // =========================================================================
    toggleTodos(tipo, checked) {
        const checkboxes = document.querySelectorAll(`input[data-tipo="${tipo}"]`);
        checkboxes.forEach(cb => cb.checked = checked);
    }

    async aplicarAlteracoesSelecionadas(obraId) {
        const { adicionar, modificar, excluir } = this.alteracoesPendentes;
        
        // Coletar selecionados
        const selecionados = {
            adicionar: [],
            modificar: [],
            excluir: []
        };

        document.querySelectorAll('input[data-tipo="adicionar"]:checked').forEach(cb => {
            selecionados.adicionar.push(adicionar[parseInt(cb.dataset.index)]);
        });

        document.querySelectorAll('input[data-tipo="modificar"]:checked').forEach(cb => {
            selecionados.modificar.push(modificar[parseInt(cb.dataset.index)]);
        });

        document.querySelectorAll('input[data-tipo="excluir"]:checked').forEach(cb => {
            selecionados.excluir.push(excluir[parseInt(cb.dataset.index)]);
        });

        const totalSelecionados = selecionados.adicionar.length + selecionados.modificar.length + selecionados.excluir.length;

        if (totalSelecionados === 0) {
            this.mostrarNotificacao('Nenhum item selecionado.', 'warning');
            return;
        }

        try {
            // Aplicar adições
            if (selecionados.adicionar.length > 0) {
                const inserts = selecionados.adicionar.map(item => ({
                    obra_id: obraId,
                    tipo: item.tipo,
                    categoria: item.categoria,
                    descricao: item.descricao,
                    valor: item.valor,
                    data_lancamento: item.data_lancamento,
                    origem: 'google_calendar',
                    origem_id: item.origem_id,
                    status: 'confirmado'
                }));

                const { error: errInsert } = await supabaseClient
                    .from('analise_financeira_obras')
                    .insert(inserts);

                if (errInsert) throw errInsert;
            }

            // Aplicar modificações
            for (const item of selecionados.modificar) {
                const updates = {};
                item.campos_alterados.forEach(c => {
                    updates[c.campo] = c.para;
                });
                updates.updated_at = new Date().toISOString();

                const { error: errUpdate } = await supabaseClient
                    .from('analise_financeira_obras')
                    .update(updates)
                    .eq('id', item.id);

                if (errUpdate) throw errUpdate;
            }

            // Aplicar exclusões
            if (selecionados.excluir.length > 0) {
                const idsExcluir = selecionados.excluir.map(item => item.id);

                const { error: errDelete } = await supabaseClient
                    .from('analise_financeira_obras')
                    .delete()
                    .in('id', idsExcluir);

                if (errDelete) throw errDelete;
            }

            // Registrar log de sincronização
            await this.registrarLogSincronizacao(obraId, selecionados);

            this.fecharModal();
            this.mostrarNotificacao(`Sincronização concluída! ${totalSelecionados} alterações aplicadas.`, 'success');

            // Atualizar dashboard se estiver na página
            if (window.dashboardHVC) {
                window.dashboardHVC.atualizarDados();
            }

        } catch (error) {
            console.error('Erro ao aplicar alterações:', error);
            this.mostrarNotificacao('Erro ao aplicar alterações. Tente novamente.', 'error');
        }
    }

    async registrarLogSincronizacao(obraId, selecionados) {
        try {
            const usuarioNome = sessionStorage.getItem('nome') || 'Desconhecido';
            
            const { error } = await supabaseClient
                .from('sincronizacao_log')
                .insert({
                    usuario_nome: usuarioNome,
                    tipo_sincronizacao: 'google_calendar',
                    total_detectado: this.alteracoesPendentes.adicionar.length + 
                                    this.alteracoesPendentes.modificar.length + 
                                    this.alteracoesPendentes.excluir.length,
                    total_adicionado: selecionados.adicionar.length,
                    total_modificado: selecionados.modificar.length,
                    total_excluido: selecionados.excluir.length,
                    total_aprovado: selecionados.adicionar.length + selecionados.modificar.length + selecionados.excluir.length,
                    total_rejeitado: (this.alteracoesPendentes.adicionar.length - selecionados.adicionar.length) +
                                    (this.alteracoesPendentes.modificar.length - selecionados.modificar.length) +
                                    (this.alteracoesPendentes.excluir.length - selecionados.excluir.length),
                    detalhes: JSON.stringify({
                        obra_id: obraId,
                        adicionar: selecionados.adicionar,
                        modificar: selecionados.modificar,
                        excluir: selecionados.excluir
                    }),
                    status: 'concluido'
                });

            if (error) console.warn('Erro ao registrar log:', error);
        } catch (err) {
            console.warn('Erro ao registrar log de sincronização:', err);
        }
    }

    fecharModal() {
        const modal = document.getElementById('modal-sincronizacao');
        if (modal) modal.remove();
    }

    // =========================================================================
    // UTILITÁRIOS
    // =========================================================================
    formatarMoeda(valor) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor || 0);
    }

    formatarData(data) {
        if (!data) return 'N/A';
        return new Date(data).toLocaleDateString('pt-BR');
    }

    traduzirCampo(campo) {
        const traducoes = {
            'descricao': 'Descrição',
            'valor': 'Valor',
            'data_lancamento': 'Data',
            'categoria': 'Categoria',
            'tipo': 'Tipo'
        };
        return traducoes[campo] || campo;
    }

    formatarValorCampo(campo, valor) {
        if (campo === 'valor') return this.formatarMoeda(valor);
        if (campo === 'data_lancamento') return this.formatarData(valor);
        if (campo === 'tipo') return valor === 'receita' ? 'Receita' : 'Despesa';
        return valor || 'N/A';
    }

    mostrarNotificacao(mensagem, tipo = 'info') {
        const cores = {
            success: '#20c997',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };

        const icones = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const notif = document.createElement('div');
        notif.className = 'sync-notification';
        notif.innerHTML = `
            <i class="fas ${icones[tipo]}"></i>
            <span>${mensagem}</span>
        `;
        notif.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${cores[tipo]};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notif);

        setTimeout(() => {
            notif.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }
}

// Instância global
const sincFinanceira = new SincronizacaoFinanceira();
window.sincFinanceira = sincFinanceira;

// Adicionar animações CSS
const animStyles = document.createElement('style');
animStyles.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(animStyles);

console.log('📦 Módulo de Sincronização Financeira carregado');

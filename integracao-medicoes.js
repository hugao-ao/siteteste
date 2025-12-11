// ========================================
// INTEGRAÇÃO FLUXO DE CAIXA <-> MEDIÇÕES V2
// ========================================
// Versão com modal de confirmação SUBSTITUIR/SOMAR

/**
 * Mostra modal de confirmação SUBSTITUIR ou SOMAR
 * @param {object} medicao - Dados da medição
 * @param {number} novoValor - Novo valor a ser registrado
 * @param {string} dataRecebimento - Data do novo recebimento
 * @param {string} eventoId - ID do evento
 * @returns {Promise<string>} - 'substituir', 'somar' ou 'cancelar'
 */
function mostrarModalSubstituirSomar(medicao, novoValor, dataRecebimento, eventoId) {
    return new Promise((resolve) => {
        const recebimentosAtuais = medicao.recebimentos || [];
        const totalAtual = recebimentosAtuais.reduce((sum, rec) => sum + (rec.valor || 0), 0);
        
        const formatarMoeda = (valor) => {
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(valor);
        };
        
        const modalHtml = `
            <div id="modal-substituir-somar" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 99999; display: flex; align-items: center; justify-content: center;">
                <div style="background: #1a1a2e; border-radius: 12px; width: 90%; max-width: 600px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); border: 2px solid #ffc107;">
                    <div style="padding: 1.5rem; border-bottom: 1px solid rgba(255, 193, 7, 0.3);">
                        <h3 style="color: #ffc107; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-exclamation-triangle"></i>
                            Recebimento Já Existe
                        </h3>
                    </div>
                    
                    <div style="padding: 2rem;">
                        <p style="color: #e0e0e0; font-size: 1.1rem; margin-bottom: 1.5rem; line-height: 1.6;">
                            A medição <strong style="color: #add8e6;">${medicao.numero_medicao}</strong> 
                            já possui recebimento(s) registrado(s).
                        </p>
                        
                        <div style="background: rgba(173, 216, 230, 0.1); padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                                <div>
                                    <label style="color: #888; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">
                                        Valor Atual Recebido
                                    </label>
                                    <div style="color: #28a745; font-size: 1.5rem; font-weight: 700;">
                                        ${formatarMoeda(totalAtual)}
                                    </div>
                                    <small style="color: #888;">${recebimentosAtuais.length} recebimento(s)</small>
                                </div>
                                <div>
                                    <label style="color: #888; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">
                                        Novo Valor
                                    </label>
                                    <div style="color: #ffc107; font-size: 1.5rem; font-weight: 700;">
                                        ${formatarMoeda(novoValor)}
                                    </div>
                                    <small style="color: #888;">A ser registrado</small>
                                </div>
                            </div>
                        </div>
                        
                        <p style="color: #c0c0c0; margin-bottom: 2rem; font-size: 1rem;">
                            O que você deseja fazer?
                        </p>
                        
                        <div style="display: flex; gap: 1rem; flex-direction: column;">
                            <button id="btn-somar" style="
                                padding: 1rem 1.5rem;
                                background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                                color: white;
                                border: none;
                                border-radius: 8px;
                                font-size: 1.1rem;
                                font-weight: 600;
                                cursor: pointer;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                gap: 0.75rem;
                                transition: transform 0.2s;
                            " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                                <i class="fas fa-plus-circle" style="font-size: 1.3rem;"></i>
                                <div style="text-align: left;">
                                    <div>SOMAR ao valor existente</div>
                                    <small style="opacity: 0.9; font-weight: 400;">
                                        Total ficará: ${formatarMoeda(totalAtual + novoValor)}
                                    </small>
                                </div>
                            </button>
                            
                            <button id="btn-substituir" style="
                                padding: 1rem 1.5rem;
                                background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
                                color: #1a1a2e;
                                border: none;
                                border-radius: 8px;
                                font-size: 1.1rem;
                                font-weight: 600;
                                cursor: pointer;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                gap: 0.75rem;
                                transition: transform 0.2s;
                            " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                                <i class="fas fa-sync-alt" style="font-size: 1.3rem;"></i>
                                <div style="text-align: left;">
                                    <div>SUBSTITUIR o valor existente</div>
                                    <small style="opacity: 0.9; font-weight: 400;">
                                        Total ficará: ${formatarMoeda(novoValor)}
                                    </small>
                                </div>
                            </button>
                            
                            <button id="btn-cancelar" style="
                                padding: 0.75rem 1.5rem;
                                background: transparent;
                                color: #888;
                                border: 1px solid #444;
                                border-radius: 8px;
                                font-size: 1rem;
                                cursor: pointer;
                                transition: all 0.2s;
                            " onmouseover="this.style.borderColor='#666'; this.style.color='#aaa'" onmouseout="this.style.borderColor='#444'; this.style.color='#888'">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const modalDiv = document.createElement('div');
        modalDiv.innerHTML = modalHtml;
        document.body.appendChild(modalDiv);
        
        const fecharModal = () => {
            const modal = document.getElementById('modal-substituir-somar');
            if (modal) modal.remove();
        };
        
        document.getElementById('btn-somar').onclick = () => {
            fecharModal();
            resolve('somar');
        };
        
        document.getElementById('btn-substituir').onclick = () => {
            fecharModal();
            resolve('substituir');
        };
        
        document.getElementById('btn-cancelar').onclick = () => {
            fecharModal();
            resolve('cancelar');
        };
    });
}

/**
 * Registra um recebimento na medição correspondente
 * @param {string} numeroMedicao - Número da medição (ex: "001/2025")
 * @param {string} numeroObra - Número da obra (ex: "0001/2025")
 * @param {number} valorRecebido - Valor do recebimento
 * @param {string} dataRecebimento - Data do recebimento (formato: YYYY-MM-DD)
 * @param {string} eventoId - ID do evento no fluxo de caixa
 */
async function registrarRecebimentoNaMedicao(numeroMedicao, numeroObra, valorRecebido, dataRecebimento, eventoId) {
    try {
        console.log('🔄 Registrando recebimento na medição:', {
            numeroMedicao,
            numeroObra,
            valorRecebido,
            dataRecebimento,
            eventoId
        });

        // 1. Buscar a obra pelo número
        const { data: obras, error: obraError } = await supabaseClient
            .from('obras_hvc')
            .select('id')
            .eq('numero_obra', numeroObra)
            .limit(1);

        if (obraError) throw obraError;
        if (!obras || obras.length === 0) {
            console.warn('⚠️ Obra não encontrada:', numeroObra);
            return false;
        }

        const obraId = obras[0].id;

        // 2. Buscar a medição pelo número e obra
        const { data: medicoes, error: medicaoError } = await supabaseClient
            .from('medicoes_hvc')
            .select('*')
            .eq('numero_medicao', numeroMedicao)
            .eq('obra_id', obraId)
            .limit(1);

        if (medicaoError) throw medicaoError;
        if (!medicoes || medicoes.length === 0) {
            console.warn('⚠️ Medição não encontrada:', numeroMedicao, 'para obra:', numeroObra);
            return false;
        }

        const medicao = medicoes[0];
        const recebimentosAtuais = medicao.recebimentos || [];
        
        // 3. Verificar se já existe recebimento prévio
        if (recebimentosAtuais.length > 0) {
            // Perguntar ao usuário: SUBSTITUIR ou SOMAR?
            const acao = await mostrarModalSubstituirSomar(medicao, valorRecebido, dataRecebimento, eventoId);
            
            if (acao === 'cancelar') {
                console.log('ℹ️ Operação cancelada pelo usuário');
                return false;
            }
            
            let recebimentosAtualizados;
            
            if (acao === 'substituir') {
                // Substituir: limpar array e adicionar apenas o novo
                recebimentosAtualizados = [{
                    valor: valorRecebido,
                    data: dataRecebimento,
                    evento_id: eventoId,
                    registrado_em: new Date().toISOString()
                }];
                console.log('🔄 Substituindo recebimentos anteriores');
            } else {
                // Somar: adicionar ao array existente
                recebimentosAtualizados = [
                    ...recebimentosAtuais,
                    {
                        valor: valorRecebido,
                        data: dataRecebimento,
                        evento_id: eventoId,
                        registrado_em: new Date().toISOString()
                    }
                ];
                console.log('➕ Somando ao recebimento existente');
            }
            
            // 4. Atualizar medição no Supabase
            const { error: updateError } = await supabaseClient
                .from('medicoes_hvc')
                .update({ 
                    recebimentos: recebimentosAtualizados,
                    updated_at: new Date().toISOString()
                })
                .eq('id', medicao.id);

            if (updateError) throw updateError;
            
        } else {
            // Não há recebimento prévio: SOMAR automaticamente (adicionar)
            const recebimentosAtualizados = [{
                valor: valorRecebido,
                data: dataRecebimento,
                evento_id: eventoId,
                registrado_em: new Date().toISOString()
            }];
            
            const { error: updateError } = await supabaseClient
                .from('medicoes_hvc')
                .update({ 
                    recebimentos: recebimentosAtualizados,
                    updated_at: new Date().toISOString()
                })
                .eq('id', medicao.id);

            if (updateError) throw updateError;
            
            console.log('✅ Primeiro recebimento registrado');
        }

        console.log('✅ Recebimento registrado com sucesso na medição!');
        
        // Recarregar página de medições se estiver aberta
        if (window.location.href.includes('medicoes-hvc')) {
            if (typeof window.medicoesManager !== 'undefined' && window.medicoesManager.loadMedicoes) {
                await window.medicoesManager.loadMedicoes();
            }
        }
        
        return true;

    } catch (error) {
        console.error('❌ Erro ao registrar recebimento na medição:', error);
        return false;
    }
}

/**
 * Remove um recebimento da medição correspondente
 * @param {string} eventoId - ID do evento no fluxo de caixa
 */
async function removerRecebimentoDaMedicao(eventoId) {
    try {
        console.log('🔄 Removendo recebimento da medição:', eventoId);

        // Buscar todas as medições que tenham este evento_id nos recebimentos
        const { data: medicoes, error: medicaoError } = await supabaseClient
            .from('medicoes_hvc')
            .select('*');

        if (medicaoError) throw medicaoError;

        for (const medicao of medicoes) {
            const recebimentos = medicao.recebimentos || [];
            const recebimentosFiltrados = recebimentos.filter(rec => rec.evento_id !== eventoId);

            // Se houve mudança, atualizar
            if (recebimentosFiltrados.length !== recebimentos.length) {
                const { error: updateError } = await supabaseClient
                    .from('medicoes_hvc')
                    .update({ 
                        recebimentos: recebimentosFiltrados,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', medicao.id);

                if (updateError) throw updateError;
                console.log('✅ Recebimento removido da medição:', medicao.numero_medicao);
            }
        }
        
        // Recarregar página de medições se estiver aberta
        if (window.location.href.includes('medicoes-hvc')) {
            if (typeof window.medicoesManager !== 'undefined' && window.medicoesManager.loadMedicoes) {
                await window.medicoesManager.loadMedicoes();
            }
        }

        return true;

    } catch (error) {
        console.error('❌ Erro ao remover recebimento da medição:', error);
        return false;
    }
}

/**
 * Atualiza um recebimento na medição correspondente
 * @param {string} eventoId - ID do evento no fluxo de caixa
 * @param {number} novoValor - Novo valor do recebimento
 * @param {string} novaData - Nova data do recebimento
 */
async function atualizarRecebimentoNaMedicao(eventoId, novoValor, novaData) {
    try {
        console.log('🔄 Atualizando recebimento na medição:', eventoId);

        // Buscar todas as medições que tenham este evento_id nos recebimentos
        const { data: medicoes, error: medicaoError } = await supabaseClient
            .from('medicoes_hvc')
            .select('*');

        if (medicaoError) throw medicaoError;

        for (const medicao of medicoes) {
            const recebimentos = medicao.recebimentos || [];
            let houveMudanca = false;

            const recebimentosAtualizados = recebimentos.map(rec => {
                if (rec.evento_id === eventoId) {
                    houveMudanca = true;
                    return {
                        ...rec,
                        valor: novoValor,
                        data: novaData,
                        atualizado_em: new Date().toISOString()
                    };
                }
                return rec;
            });

            // Se houve mudança, atualizar
            if (houveMudanca) {
                const { error: updateError } = await supabaseClient
                    .from('medicoes_hvc')
                    .update({ 
                        recebimentos: recebimentosAtualizados,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', medicao.id);

                if (updateError) throw updateError;
                console.log('✅ Recebimento atualizado na medição:', medicao.numero_medicao);
            }
        }
        
        // Recarregar página de medições se estiver aberta
        if (window.location.href.includes('medicoes-hvc')) {
            if (typeof window.medicoesManager !== 'undefined' && window.medicoesManager.loadMedicoes) {
                await window.medicoesManager.loadMedicoes();
            }
        }

        return true;

    } catch (error) {
        console.error('❌ Erro ao atualizar recebimento na medição:', error);
        return false;
    }
}

// Expor funções globalmente
if (typeof window !== 'undefined') {
    window.registrarRecebimentoNaMedicao = registrarRecebimentoNaMedicao;
    window.removerRecebimentoDaMedicao = removerRecebimentoDaMedicao;
    window.atualizarRecebimentoNaMedicao = atualizarRecebimentoNaMedicao;
}

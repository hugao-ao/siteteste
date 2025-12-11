// ========================================
// INTEGRAÇÃO FLUXO DE CAIXA <-> MEDIÇÕES
// ========================================
// Este arquivo contém funções para sincronizar recebimentos do fluxo de caixa
// com as medições correspondentes

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

        // 3. Adicionar recebimento ao array
        const recebimentosAtuais = medicao.recebimentos || [];
        
        // Verificar se já existe um recebimento com o mesmo evento_id
        const jaExiste = recebimentosAtuais.some(rec => rec.evento_id === eventoId);
        if (jaExiste) {
            console.log('ℹ️ Recebimento já registrado para este evento');
            return true;
        }

        const novoRecebimento = {
            valor: valorRecebido,
            data: dataRecebimento,
            evento_id: eventoId,
            registrado_em: new Date().toISOString()
        };

        const recebimentosAtualizados = [...recebimentosAtuais, novoRecebimento];

        // 4. Atualizar medição no Supabase
        const { error: updateError } = await supabaseClient
            .from('medicoes_hvc')
            .update({ 
                recebimentos: recebimentosAtualizados,
                updated_at: new Date().toISOString()
            })
            .eq('id', medicao.id);

        if (updateError) throw updateError;

        console.log('✅ Recebimento registrado com sucesso na medição!');
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

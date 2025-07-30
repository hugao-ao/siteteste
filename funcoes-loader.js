// funcoes-loader.js - Carregador melhorado de funções do Supabase

// Função para renderizar funções na tabela
window.renderizarFuncoesNaTabela = function(funcoes) {
    console.log('🎨 Renderizando funções na tabela...', funcoes);
    
    const tbody = document.querySelector('#tabela-funcoes tbody');
    if (!tbody) {
        console.error('❌ Tabela de funções não encontrada');
        return;
    }
    
    // Limpar tabela
    tbody.innerHTML = '';
    
    if (!funcoes || funcoes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="empty-state">
                    <i class="fas fa-info-circle"></i>
                    <h3>Nenhuma função cadastrada</h3>
                    <p>Clique em "Nova Função" para adicionar</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Renderizar cada função
    funcoes.forEach(funcao => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${funcao.nome || 'Sem nome'}</td>
            <td>0</td>
            <td>
                <button class="btn-danger btn-sm" onclick="excluirFuncao('${funcao.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    console.log(`✅ ${funcoes.length} funções renderizadas`);
};

// Função para carregar funções com feedback visual
window.carregarFuncoesComFeedback = async function() {
    console.log('🔄 Iniciando carregamento de funções...');
    
    const tbody = document.querySelector('#tabela-funcoes tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="empty-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <h3>Carregando funções...</h3>
                </td>
            </tr>
        `;
    }
    
    try {
        // Verificar se o Supabase está disponível
        if (!window.supabase && !window.supabaseClient) {
            throw new Error('Supabase não está disponível');
        }
        
        const supabaseClient = window.supabase || window.supabaseClient;
        
        console.log('📡 Fazendo requisição para Supabase...');
        const { data, error } = await supabaseClient
            .from('funcoes_hvc')
            .select('*')
            .order('nome', { ascending: true });
            
        if (error) {
            console.error('❌ Erro do Supabase:', error);
            throw error;
        }
        
        console.log('✅ Dados recebidos do Supabase:', data);
        
        // Renderizar na tabela
        window.renderizarFuncoesNaTabela(data);
        
        return data || [];
        
    } catch (error) {
        console.error('💥 Erro ao carregar funções:', error);
        
        // Mostrar erro na tabela
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="empty-state" style="color: #ff6b6b;">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Erro ao carregar funções</h3>
                        <p>${error.message}</p>
                        <button class="btn-primary btn-sm" onclick="carregarFuncoesComFeedback()">
                            <i class="fas fa-refresh"></i> Tentar novamente
                        </button>
                    </td>
                </tr>
            `;
        }
        
        return [];
    }
};

// Função para salvar nova função
window.salvarNovaFuncao = async function(event) {
    event.preventDefault();
    console.log('💾 Salvando nova função...');
    
    const nomeInput = document.getElementById('nome-funcao');
    if (!nomeInput) {
        console.error('❌ Campo nome-funcao não encontrado');
        return;
    }
    
    const nome = nomeInput.value.trim();
    if (!nome) {
        alert('Por favor, digite o nome da função');
        return;
    }
    
    try {
        const supabaseClient = window.supabase || window.supabaseClient;
        if (!supabaseClient) {
            throw new Error('Supabase não está disponível');
        }
        
        console.log('📤 Enviando para Supabase:', { nome });
        const { data, error } = await supabaseClient
            .from('funcoes_hvc')
            .insert([{ nome }])
            .select();
            
        if (error) {
            console.error('❌ Erro ao salvar:', error);
            throw error;
        }
        
        console.log('✅ Função salva com sucesso:', data);
        
        // Limpar formulário e esconder
        nomeInput.value = '';
        window.cancelNovaFuncao();
        
        // Recarregar lista
        await window.carregarFuncoesComFeedback();
        
        alert('Função salva com sucesso!');
        
    } catch (error) {
        console.error('💥 Erro ao salvar função:', error);
        alert('Erro ao salvar função: ' + error.message);
    }
};

// Função para excluir função
window.excluirFuncao = async function(id) {
    if (!confirm('Tem certeza que deseja excluir esta função?')) {
        return;
    }
    
    try {
        const supabaseClient = window.supabase || window.supabaseClient;
        if (!supabaseClient) {
            throw new Error('Supabase não está disponível');
        }
        
        const { error } = await supabaseClient
            .from('funcoes_hvc')
            .delete()
            .eq('id', id);
            
        if (error) {
            throw error;
        }
        
        console.log('✅ Função excluída com sucesso');
        
        // Recarregar lista
        await window.carregarFuncoesComFeedback();
        
    } catch (error) {
        console.error('💥 Erro ao excluir função:', error);
        alert('Erro ao excluir função: ' + error.message);
    }
};

console.log('🔧 Carregador de funções inicializado');


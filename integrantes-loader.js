// integrantes-loader.js - Sistema de gerenciamento de integrantes

// Função para salvar novo integrante
window.saveIntegrante = async function(event) {
    event.preventDefault();
    console.log('💾 Salvando novo integrante...');
    
    // Pegar dados do formulário
    const nome = document.getElementById('nome-integrante')?.value?.trim();
    const cpf = document.getElementById('cpf-integrante')?.value?.trim();
    const whatsapp = document.getElementById('whatsapp-integrante')?.value?.trim();
    const funcaoId = document.getElementById('funcao-integrante')?.value;
    const observacoes = document.getElementById('observacoes-integrante')?.value?.trim();
    
    // Validações básicas
    if (!nome) {
        alert('Por favor, digite o nome do integrante');
        return;
    }
    
    if (!cpf) {
        alert('Por favor, digite o CPF do integrante');
        return;
    }
    
    if (!whatsapp) {
        alert('Por favor, digite o WhatsApp do integrante');
        return;
    }
    
    try {
        const supabaseClient = window.supabase || window.supabaseClient;
        if (!supabaseClient) {
            throw new Error('Supabase não está disponível');
        }
        
        // Preparar dados para inserção
        const dadosIntegrante = {
            nome: nome,
            cpf: cpf,
            whatsapp: whatsapp,
            observacoes: observacoes || null
        };
        
        // Adicionar função se selecionada
        if (funcaoId && funcaoId !== '') {
            dadosIntegrante.funcao_id = funcaoId;
        }
        
        console.log('📤 Enviando para Supabase:', dadosIntegrante);
        
        const { data, error } = await supabaseClient
            .from('integrantes_hvc')
            .insert([dadosIntegrante])
            .select();
            
        if (error) {
            console.error('❌ Erro ao salvar:', error);
            throw error;
        }
        
        console.log('✅ Integrante salvo com sucesso:', data);
        
        // Limpar formulário
        document.getElementById('form-integrante').reset();
        
        // Fechar modal
        window.closeIntegranteModal();
        
        // Recarregar lista de integrantes (se a função existir)
        if (window.carregarIntegrantes) {
            await window.carregarIntegrantes();
        }
        
        alert('Integrante salvo com sucesso!');
        
    } catch (error) {
        console.error('💥 Erro ao salvar integrante:', error);
        
        let mensagemErro = 'Erro ao salvar integrante: ' + error.message;
        
        // Tratar erros específicos
        if (error.message.includes('duplicate key')) {
            mensagemErro = 'Este CPF já está cadastrado!';
        } else if (error.message.includes('violates foreign key')) {
            mensagemErro = 'Função selecionada é inválida!';
        }
        
        alert(mensagemErro);
    }
};

// Função para carregar integrantes
window.carregarIntegrantes = async function() {
    console.log('🔄 Carregando integrantes...');
    
    try {
        const supabaseClient = window.supabase || window.supabaseClient;
        if (!supabaseClient) {
            throw new Error('Supabase não está disponível');
        }
        
        const { data, error } = await supabaseClient
            .from('integrantes_hvc')
            .select(`
                *,
                funcoes_hvc (
                    id,
                    nome
                )
            `)
            .order('nome', { ascending: true });
            
        if (error) {
            console.error('❌ Erro ao carregar integrantes:', error);
            throw error;
        }
        
        console.log('✅ Integrantes carregados:', data);
        
        // Renderizar na tabela (se a função existir)
        if (window.renderizarIntegrantes) {
            window.renderizarIntegrantes(data);
        }
        
        return data || [];
        
    } catch (error) {
        console.error('💥 Erro ao carregar integrantes:', error);
        return [];
    }
};

// Função para renderizar integrantes na tabela
window.renderizarIntegrantes = function(integrantes) {
    console.log('🎨 Renderizando integrantes na tabela...', integrantes);
    
    const tbody = document.querySelector('#tabela-integrantes tbody');
    if (!tbody) {
        console.error('❌ Tabela de integrantes não encontrada');
        return;
    }
    
    // Limpar tabela
    tbody.innerHTML = '';
    
    if (!integrantes || integrantes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>Nenhum integrante cadastrado</h3>
                    <p>Clique em "Novo Integrante" para adicionar</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Renderizar cada integrante
    integrantes.forEach(integrante => {
        const row = document.createElement('tr');
        
        const funcaoNome = integrante.funcoes_hvc?.nome || 'Sem função';
        const whatsapp = integrante.whatsapp || 'Não informado';
        
        row.innerHTML = `
            <td>${integrante.nome || 'Sem nome'}</td>
            <td>${integrante.cpf || 'Não informado'}</td>
            <td>${whatsapp}</td>
            <td>${funcaoNome}</td>
            <td>Ativo</td>
            <td>
                <button class="btn-primary btn-sm" onclick="editarIntegrante('${integrante.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-danger btn-sm" onclick="excluirIntegrante('${integrante.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    console.log(`✅ ${integrantes.length} integrantes renderizados`);
};

// Função para excluir integrante
window.excluirIntegrante = async function(id) {
    if (!confirm('Tem certeza que deseja excluir este integrante?')) {
        return;
    }
    
    try {
        const supabaseClient = window.supabase || window.supabaseClient;
        if (!supabaseClient) {
            throw new Error('Supabase não está disponível');
        }
        
        const { error } = await supabaseClient
            .from('integrantes_hvc')
            .delete()
            .eq('id', id);
            
        if (error) {
            throw error;
        }
        
        console.log('✅ Integrante excluído com sucesso');
        
        // Recarregar lista
        await window.carregarIntegrantes();
        
    } catch (error) {
        console.error('💥 Erro ao excluir integrante:', error);
        alert('Erro ao excluir integrante: ' + error.message);
    }
};

// Função para editar integrante (placeholder)
window.editarIntegrante = function(id) {
    console.log('✏️ Editar integrante:', id);
    alert('Funcionalidade de edição será implementada em breve!');
};

// Função para filtrar integrantes
window.filtrarIntegrantes = function() {
    console.log('🔍 Filtrando integrantes...');
    // Implementar filtro se necessário
};

console.log('🔧 Sistema de integrantes carregado');


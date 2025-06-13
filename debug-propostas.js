// FUNÇÃO DE DEBUG PARA VERIFICAR VALORES
window.debugPropostas = function() {
    console.log('\n🔍 === DEBUG PROPOSTAS ===');
    
    // Verificar valor calculado atual
    if (window.propostasManager) {
        const totalCalculado = window.propostasManager.getCurrentTotal();
        console.log('Total calculado atual:', totalCalculado);
        
        // Verificar valor exibido na tela
        const totalElement = document.getElementById('total-proposta');
        if (totalElement) {
            console.log('Valor exibido na tela:', totalElement.textContent);
        }
        
        // Verificar serviços adicionados
        console.log('Serviços adicionados:', window.propostasManager.servicosAdicionados);
        
        // Calcular manualmente
        let totalManual = 0;
        window.propostasManager.servicosAdicionados.forEach((item, index) => {
            const quantidade = parseFloat(item.quantidade) || 0;
            const maoObra = parseFloat(item.preco_mao_obra) || 0;
            const material = parseFloat(item.preco_material) || 0;
            const itemTotal = quantidade * (maoObra + material);
            
            console.log(`Item ${index}:`, {
                quantidade,
                maoObra,
                material,
                itemTotal,
                precoTotalSalvo: item.preco_total
            });
            
            totalManual += itemTotal;
        });
        
        console.log('Total manual calculado:', totalManual);
        console.log('Diferença entre getCurrentTotal e manual:', totalCalculado - totalManual);
    }
    
    console.log('=========================\n');
};

// Chamar automaticamente
window.debugPropostas();


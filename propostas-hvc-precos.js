// Extensão para propostas-hvc.js - Funcionalidade de preenchimento de preços

// Função para adicionar a funcionalidade de preenchimento de preços
function adicionarFuncionalidadePrecos() {
    // Verificar se estamos na página de propostas
    if (!window.propostasManager) {
        console.error('PropostasManager não encontrado');
        return;
    }
    
    // Estender o PropostasManager com novas funcionalidades
    extenderPropostasManager();
    
    console.log('Funcionalidade de preenchimento de preços adicionada com sucesso!');
}

// Função para estender o PropostasManager
function extenderPropostasManager() {
    // Guardar referência ao método original
    const originalRenderServicoForm = window.propostasManager.renderServicoForm;
    
    // Sobrescrever o método para adicionar campos de preço
    window.propostasManager.renderServicoForm = function(servico = null, editMode = false) {
        // Chamar o método original primeiro
        originalRenderServicoForm.call(this, servico, editMode);
        
        // Adicionar campos de preço
        adicionarCamposPreco(servico);
    };
    
    // Guardar referência ao método original de salvar serviço
    const originalSalvarServico = window.propostasManager.salvarServico;
    
    // Sobrescrever o método para salvar os preços
    window.propostasManager.salvarServico = async function(e) {
        e.preventDefault();
        
        // Obter valores dos campos de preço
        const precoTotal = document.getElementById('preco-total')?.value || '0';
        const precoMaoObra = document.getElementById('preco-mao-obra')?.value || '0';
        const precoMaterial = document.getElementById('preco-material')?.value || '0';
        
        // Converter para centavos (formato interno)
        const precoTotalCents = Math.round(parseFloat(precoTotal.replace(/[^\d,.-]/g, '').replace(',', '.')) * 100) || 0;
        const precoMaoObraCents = Math.round(parseFloat(precoMaoObra.replace(/[^\d,.-]/g, '').replace(',', '.')) * 100) || 0;
        const precoMaterialCents = Math.round(parseFloat(precoMaterial.replace(/[^\d,.-]/g, '').replace(',', '.')) * 100) || 0;
        
        // Adicionar ao formulário
        const form = document.getElementById('servico-form');
        
        // Criar campos ocultos para os preços
        let inputTotal = document.getElementById('input-preco-total');
        if (!inputTotal) {
            inputTotal = document.createElement('input');
            inputTotal.type = 'hidden';
            inputTotal.id = 'input-preco-total';
            inputTotal.name = 'preco_total';
            form.appendChild(inputTotal);
        }
        inputTotal.value = precoTotalCents;
        
        let inputMaoObra = document.getElementById('input-preco-mao-obra');
        if (!inputMaoObra) {
            inputMaoObra = document.createElement('input');
            inputMaoObra.type = 'hidden';
            inputMaoObra.id = 'input-preco-mao-obra';
            inputMaoObra.name = 'preco_mao_obra';
            form.appendChild(inputMaoObra);
        }
        inputMaoObra.value = precoMaoObraCents;
        
        let inputMaterial = document.getElementById('input-preco-material');
        if (!inputMaterial) {
            inputMaterial = document.createElement('input');
            inputMaterial.type = 'hidden';
            inputMaterial.id = 'input-preco-material';
            inputMaterial.name = 'preco_material';
            form.appendChild(inputMaterial);
        }
        inputMaterial.value = precoMaterialCents;
        
        // Chamar o método original para salvar
        await originalSalvarServico.call(this, e);
    };
    
    // Adicionar método para calcular preços automaticamente
    window.propostasManager.calcularPrecos = function() {
        const precoTotalInput = document.getElementById('preco-total');
        const precoMaoObraInput = document.getElementById('preco-mao-obra');
        const precoMaterialInput = document.getElementById('preco-material');
        
        const modoCalculo = document.getElementById('modo-calculo').value;
        
        if (modoCalculo === 'total') {
            // Calcular a partir do preço total
            const precoTotal = parseFloat(precoTotalInput.value.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            
            // Distribuir 60% para material e 40% para mão de obra (padrão)
            const precoMaterial = precoTotal * 0.6;
            const precoMaoObra = precoTotal * 0.4;
            
            precoMaoObraInput.value = precoMaoObra.toFixed(2);
            precoMaterialInput.value = precoMaterial.toFixed(2);
        } else {
            // Calcular a partir da soma de mão de obra e material
            const precoMaoObra = parseFloat(precoMaoObraInput.value.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            const precoMaterial = parseFloat(precoMaterialInput.value.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            
            const precoTotal = precoMaoObra + precoMaterial;
            precoTotalInput.value = precoTotal.toFixed(2);
        }
    };
}

// Função para adicionar campos de preço ao formulário
function adicionarCamposPreco(servico) {
    const form = document.getElementById('servico-form');
    if (!form) return;
    
    // Verificar se já existe a seção de preços
    if (document.getElementById('secao-precos')) return;
    
    // Criar seção de preços
    const secaoPrecos = document.createElement('div');
    secaoPrecos.id = 'secao-precos';
    secaoPrecos.className = 'form-section';
    
    // Valores iniciais
    const precoTotal = servico?.preco_total ? (servico.preco_total / 100).toFixed(2) : '0.00';
    const precoMaoObra = servico?.preco_mao_obra ? (servico.preco_mao_obra / 100).toFixed(2) : '0.00';
    const precoMaterial = servico?.preco_material ? (servico.preco_material / 100).toFixed(2) : '0.00';
    
    // HTML da seção
    secaoPrecos.innerHTML = `
        <h4 class="section-title">
            <i class="fas fa-dollar-sign"></i> Preços do Serviço
        </h4>
        
        <div class="form-group">
            <label for="modo-calculo">Modo de Cálculo:</label>
            <select id="modo-calculo" class="form-control">
                <option value="total">A partir do Preço Total</option>
                <option value="componentes">A partir de Mão de Obra + Material</option>
            </select>
        </div>
        
        <div class="form-row">
            <div class="form-group col-md-4">
                <label for="preco-total">Preço Total (R$):</label>
                <input type="text" id="preco-total" class="form-control" value="${precoTotal}" placeholder="0,00">
            </div>
            
            <div class="form-group col-md-4">
                <label for="preco-mao-obra">Preço Mão de Obra (R$):</label>
                <input type="text" id="preco-mao-obra" class="form-control" value="${precoMaoObra}" placeholder="0,00">
            </div>
            
            <div class="form-group col-md-4">
                <label for="preco-material">Preço Material (R$):</label>
                <input type="text" id="preco-material" class="form-control" value="${precoMaterial}" placeholder="0,00">
            </div>
        </div>
        
        <div class="form-group">
            <button type="button" id="btn-calcular-precos" class="btn btn-info">
                <i class="fas fa-calculator"></i> Calcular Preços
            </button>
        </div>
    `;
    
    // Inserir antes do botão de salvar
    const btnSalvar = form.querySelector('button[type="submit"]');
    form.insertBefore(secaoPrecos, btnSalvar.parentNode);
    
    // Adicionar eventos
    document.getElementById('btn-calcular-precos').addEventListener('click', () => {
        window.propostasManager.calcularPrecos();
    });
    
    document.getElementById('modo-calculo').addEventListener('change', () => {
        const modo = document.getElementById('modo-calculo').value;
        if (modo === 'total') {
            document.getElementById('preco-total').readOnly = false;
            document.getElementById('preco-mao-obra').readOnly = true;
            document.getElementById('preco-material').readOnly = true;
        } else {
            document.getElementById('preco-total').readOnly = true;
            document.getElementById('preco-mao-obra').readOnly = false;
            document.getElementById('preco-material').readOnly = false;
        }
    });
    
    // Configurar estado inicial
    document.getElementById('modo-calculo').dispatchEvent(new Event('change'));
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    // Verificar se estamos na página de propostas
    if (window.location.href.includes('propostas-hvc.html')) {
        // Aguardar o PropostasManager ser inicializado com retry
        waitForPropostasManager();
    }
});

function waitForPropostasManager() {
    let attempts = 0;
    const maxAttempts = 10;
    
    function checkPropostasManager() {
        attempts++;
        
        if (window.propostasManager) {
            console.log('PropostasManager encontrado, adicionando funcionalidade de preços...');
            adicionarFuncionalidadePrecos();
        } else if (attempts < maxAttempts) {
            console.log(`Tentativa ${attempts}: Aguardando PropostasManager...`);
            setTimeout(checkPropostasManager, 500);
        } else {
            console.error('PropostasManager não encontrado após múltiplas tentativas');
        }
    }
    
    checkPropostasManager();
}

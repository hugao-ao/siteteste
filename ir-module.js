// ========================================
// MÓDULO DE IMPOSTO DE RENDA
// ========================================

// Dados de IR
let declaracoesIR = [];

// Tipos de declaração
const TIPOS_DECLARACAO = [
  { id: 'nao_declara', nome: 'Não Declara' },
  { id: 'isento', nome: 'Declara Isento' },
  { id: 'simplificada', nome: 'Declara Simplificado' },
  { id: 'completa', nome: 'Declara Completa' }
];

// Tipos de resultado
const TIPOS_RESULTADO = [
  { id: '', nome: 'Selecione...' },
  { id: 'paga', nome: 'Paga' },
  { id: 'restitui', nome: 'Restitui' }
];

// Inicialização do módulo
function initIRModule() {
  console.log('Módulo de IR carregado');
  
  // Expor funções globalmente
  window.atualizarSecaoIR = atualizarSecaoIR;
  window.updatePessoaConjugeDependenteIR = updatePessoaConjugeDependenteIR;
  window.updateIRField = updateIRField;
  window.getDeclaracoesIRData = getDeclaracoesIRData;
  window.setDeclaracoesIRData = setDeclaracoesIRData;
  window.formatarMoedaIR = formatarMoedaIR;
  window.limparCampoMoedaIR = limparCampoMoedaIR;
  window.toggleIRCampos = toggleIRCampos;
  
  // Renderizar a seção de IR após um pequeno delay para garantir que os dados estejam carregados
  setTimeout(() => {
    atualizarSecaoIR();
  }, 500);
}

// Função para formatar moeda
function formatarMoedaIR(valor) {
  if (!valor && valor !== 0) return '';
  const numero = parseFloat(valor);
  if (isNaN(numero)) return '';
  return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Função para limpar campo de moeda quando está zerado
function limparCampoMoedaIR(input) {
  if (input.value === 'R$ 0,00' || input.value === '0,00') {
    input.value = '';
  }
}

// Função para parsear valor monetário
function parseMoedaIR(valor) {
  if (!valor) return 0;
  // Remove R$, pontos de milhar e substitui vírgula por ponto
  const limpo = valor.replace(/[R$\s.]/g, '').replace(',', '.');
  const numero = parseFloat(limpo);
  return isNaN(numero) ? 0 : numero;
}

// Função para atualizar campo de moeda com máscara
function updateIRMoedaField(pessoaKey, field, valor) {
  const declaracao = declaracoesIR.find(d => d.pessoa_key === pessoaKey);
  if (declaracao) {
    // Aplicar máscara de moeda
    let valorNumerico = valor.replace(/\D/g, '');
    valorNumerico = (parseInt(valorNumerico) / 100).toFixed(2);
    declaracao[field] = parseFloat(valorNumerico) || 0;
    
    // Atualizar o input com a máscara
    const input = document.getElementById(`ir_${pessoaKey}_${field}`);
    if (input) {
      input.value = `R$ ${formatarMoedaIR(valorNumerico)}`;
    }
  }
}

// Função para alternar visibilidade dos campos de IR
function toggleIRCampos(pessoaKey) {
  const declaracao = declaracoesIR.find(d => d.pessoa_key === pessoaKey);
  const tipoSelect = document.getElementById(`ir_${pessoaKey}_tipo_declaracao`);
  const camposContainer = document.getElementById(`ir_${pessoaKey}_campos`);
  
  if (declaracao && tipoSelect && camposContainer) {
    declaracao.tipo_declaracao = tipoSelect.value;
    
    // Se "Não Declara", ocultar campos
    if (tipoSelect.value === 'nao_declara') {
      camposContainer.style.display = 'none';
    } else {
      camposContainer.style.display = 'block';
    }
  }
}

// Função para atualizar campo de IR
function updateIRField(pessoaKey, field, valor) {
  const declaracao = declaracoesIR.find(d => d.pessoa_key === pessoaKey);
  if (declaracao) {
    // Campos monetários
    const camposMonetarios = [
      'renda_bruta_anual', 'total_recolhido_ir', 'contribuicao_previdencia_oficial',
      'gastos_instrucao', 'gastos_medicos', 'livro_caixa', 'pensao_alimenticia',
      'contribuicao_nao_oficial', 'outras_deducoes', 'resultado_valor'
    ];
    
    if (camposMonetarios.includes(field)) {
      updateIRMoedaField(pessoaKey, field, valor);
    } else if (field === 'total_dependentes') {
      declaracao[field] = parseInt(valor) || 0;
    } else {
      declaracao[field] = valor;
    }
  }
}

// Função para atualizar a seção de IR
function atualizarSecaoIR() {
  const container = document.getElementById('ir-container');
  if (!container) return;
  
  // Coletar todas as pessoas que devem declarar IR
  const pessoasIR = coletarPessoasParaIR();
  
  if (pessoasIR.length === 0) {
    container.innerHTML = `
      <p style="text-align: center; color: var(--text-light); opacity: 0.7;">
        <i class="fas fa-info-circle"></i> Preencha os dados do cliente e/ou pessoas com renda para visualizar as declarações de IR.
      </p>
    `;
    return;
  }
  
  // Sincronizar declarações existentes com as pessoas atuais
  sincronizarDeclaracoes(pessoasIR);
  
  // Renderizar os cards de IR
  container.innerHTML = pessoasIR.map(pessoa => renderIRCard(pessoa)).join('');
}

// Função para coletar pessoas que devem declarar IR
function coletarPessoasParaIR() {
  const pessoas = [];
  
  // 1. Cliente
  const nomeCliente = document.getElementById('nome_diagnostico')?.value;
  if (nomeCliente) {
    pessoas.push({
      key: 'cliente',
      nome: nomeCliente,
      tipo: 'Cliente',
      pode_declarar: true
    });
  }
  
  // 2. Cônjuge do cliente (se não for dependente)
  const estadoCivilCliente = document.getElementById('estado_civil')?.value;
  const nomeConjuge = document.getElementById('conjuge_nome')?.value;
  const conjugeDependenteIR = document.getElementById('conjuge_dependente_ir')?.value;
  
  if ((estadoCivilCliente === 'Casado(a)' || estadoCivilCliente === 'União Estável') && nomeConjuge) {
    pessoas.push({
      key: 'conjuge_cliente',
      nome: nomeConjuge,
      tipo: 'Cônjuge do Cliente',
      pode_declarar: conjugeDependenteIR !== 'sim',
      dependente_de: conjugeDependenteIR === 'sim' ? 'cliente' : null
    });
  }
  
  // 3. Pessoas com renda e seus cônjuges
  if (window.pessoasRenda && Array.isArray(window.pessoasRenda)) {
    window.pessoasRenda.forEach((pessoa, index) => {
      if (pessoa.nome) {
        pessoas.push({
          key: `pessoa_${index}`,
          nome: pessoa.nome,
          tipo: 'Pessoa com Renda',
          pode_declarar: true
        });
        
        // Cônjuge da pessoa com renda (se não for dependente)
        if ((pessoa.estado_civil === 'Casado(a)' || pessoa.estado_civil === 'União Estável') && pessoa.conjuge_nome) {
          pessoas.push({
            key: `conjuge_pessoa_${index}`,
            nome: pessoa.conjuge_nome,
            tipo: `Cônjuge de ${pessoa.nome}`,
            pode_declarar: pessoa.conjuge_dependente_ir !== 'sim',
            dependente_de: pessoa.conjuge_dependente_ir === 'sim' ? `pessoa_${index}` : null
          });
        }
      }
    });
  }
  
  return pessoas;
}

// Função para sincronizar declarações com pessoas atuais
function sincronizarDeclaracoes(pessoasIR) {
  // Adicionar novas declarações para pessoas que ainda não têm
  pessoasIR.forEach(pessoa => {
    const existente = declaracoesIR.find(d => d.pessoa_key === pessoa.key);
    if (!existente) {
      declaracoesIR.push({
        pessoa_key: pessoa.key,
        pessoa_nome: pessoa.nome,
        pessoa_tipo: pessoa.tipo,
        tipo_declaracao: 'nao_declara',
        renda_bruta_anual: 0,
        total_recolhido_ir: 0,
        contribuicao_previdencia_oficial: 0,
        total_dependentes: 0,
        gastos_instrucao: 0,
        gastos_medicos: 0,
        livro_caixa: 0,
        pensao_alimenticia: 0,
        contribuicao_nao_oficial: 0,
        outras_deducoes: 0,
        resultado_tipo: '',
        resultado_valor: 0,
        observacoes: ''
      });
    } else {
      // Atualizar nome e tipo caso tenham mudado
      existente.pessoa_nome = pessoa.nome;
      existente.pessoa_tipo = pessoa.tipo;
    }
  });
  
  // Remover declarações de pessoas que não existem mais
  declaracoesIR = declaracoesIR.filter(d => 
    pessoasIR.some(p => p.key === d.pessoa_key)
  );
}

// Função para renderizar card de IR
function renderIRCard(pessoa) {
  const declaracao = declaracoesIR.find(d => d.pessoa_key === pessoa.key) || {};
  const pessoaKey = pessoa.key;
  
  // Se for dependente, mostrar mensagem
  if (!pessoa.pode_declarar) {
    return `
      <div class="ir-card" style="background: var(--dark-bg); border: 2px solid var(--border-color); border-radius: 10px; padding: 1.2rem; margin-bottom: 1rem;">
        <div class="ir-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color);">
          <h4 style="color: var(--accent-color); font-size: 1.1rem; font-weight: 600; margin: 0;">
            <i class="fas fa-user"></i> ${pessoa.nome}
            <span style="background: var(--warning-color); color: var(--dark-bg); padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.7rem; font-weight: 600; margin-left: 0.5rem;">
              ${pessoa.tipo}
            </span>
          </h4>
        </div>
        <p style="text-align: center; color: var(--warning-color); padding: 1rem;">
          <i class="fas fa-info-circle"></i> Esta pessoa é dependente no IR e não faz declaração própria.
        </p>
      </div>
    `;
  }
  
  // Verificar se deve mostrar os campos (não mostrar se "Não Declara")
  const mostrarCampos = declaracao.tipo_declaracao && declaracao.tipo_declaracao !== 'nao_declara';
  
  return `
    <div class="ir-card" style="background: var(--dark-bg); border: 2px solid var(--border-color); border-radius: 10px; padding: 1.2rem; margin-bottom: 1rem;">
      <div class="ir-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color);">
        <h4 style="color: var(--accent-color); font-size: 1.1rem; font-weight: 600; margin: 0;">
          <i class="fas fa-user"></i> ${pessoa.nome}
          <span style="background: var(--success-color); color: white; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.7rem; font-weight: 600; margin-left: 0.5rem;">
            ${pessoa.tipo}
          </span>
        </h4>
        
        <!-- Tipo de Declaração no cabeçalho -->
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <label for="ir_${pessoaKey}_tipo_declaracao" style="color: var(--text-light); font-size: 0.9rem; margin: 0;">
            <i class="fas fa-file-alt"></i> Tipo:
          </label>
          <select id="ir_${pessoaKey}_tipo_declaracao" 
                  style="padding: 0.4rem 0.8rem; border: 2px solid var(--border-color); border-radius: 8px; background: var(--dark-bg); color: var(--text-light); font-size: 0.9rem;"
                  onchange="toggleIRCampos('${pessoaKey}')">
            ${TIPOS_DECLARACAO.map(tipo => `
              <option value="${tipo.id}" ${declaracao.tipo_declaracao === tipo.id ? 'selected' : ''}>
                ${tipo.nome}
              </option>
            `).join('')}
          </select>
        </div>
      </div>
      
      <!-- Campos de preenchimento (ocultos se "Não Declara") -->
      <div id="ir_${pessoaKey}_campos" style="display: ${mostrarCampos ? 'block' : 'none'};">
        <div class="form-grid-3">
          <!-- Renda Bruta Anual -->
          <div class="form-group">
            <label for="ir_${pessoaKey}_renda_bruta_anual">
              <i class="fas fa-dollar-sign"></i> Renda Bruta Tributável Anual
            </label>
            <input type="text" 
                   id="ir_${pessoaKey}_renda_bruta_anual" 
                   value="R$ ${formatarMoedaIR(declaracao.renda_bruta_anual || 0)}"
                   oninput="updateIRField('${pessoaKey}', 'renda_bruta_anual', this.value)"
                   onfocus="limparCampoMoedaIR(this)"
                   placeholder="R$ 0,00">
          </div>
          
          <!-- Total Recolhido de IR -->
          <div class="form-group">
            <label for="ir_${pessoaKey}_total_recolhido_ir">
              <i class="fas fa-hand-holding-usd"></i> Total Recolhido de IR
            </label>
            <input type="text" 
                   id="ir_${pessoaKey}_total_recolhido_ir" 
                   value="R$ ${formatarMoedaIR(declaracao.total_recolhido_ir || 0)}"
                   oninput="updateIRField('${pessoaKey}', 'total_recolhido_ir', this.value)"
                   onfocus="limparCampoMoedaIR(this)"
                   placeholder="R$ 0,00">
          </div>
          
          <!-- Contribuição Previdência Oficial -->
          <div class="form-group">
            <label for="ir_${pessoaKey}_contribuicao_previdencia_oficial">
              <i class="fas fa-university"></i> Contribuição Previdência Oficial
            </label>
            <input type="text" 
                   id="ir_${pessoaKey}_contribuicao_previdencia_oficial" 
                   value="R$ ${formatarMoedaIR(declaracao.contribuicao_previdencia_oficial || 0)}"
                   oninput="updateIRField('${pessoaKey}', 'contribuicao_previdencia_oficial', this.value)"
                   onfocus="limparCampoMoedaIR(this)"
                   placeholder="R$ 0,00">
          </div>
          
          <!-- Total de Dependentes -->
          <div class="form-group">
            <label for="ir_${pessoaKey}_total_dependentes">
              <i class="fas fa-users"></i> Total de Dependentes
            </label>
            <input type="number" 
                   id="ir_${pessoaKey}_total_dependentes" 
                   value="${declaracao.total_dependentes || 0}"
                   onchange="updateIRField('${pessoaKey}', 'total_dependentes', this.value)"
                   min="0"
                   placeholder="0">
          </div>
          
          <!-- Gastos com Instrução -->
          <div class="form-group">
            <label for="ir_${pessoaKey}_gastos_instrucao">
              <i class="fas fa-graduation-cap"></i> Gastos com Instrução
            </label>
            <input type="text" 
                   id="ir_${pessoaKey}_gastos_instrucao" 
                   value="R$ ${formatarMoedaIR(declaracao.gastos_instrucao || 0)}"
                   oninput="updateIRField('${pessoaKey}', 'gastos_instrucao', this.value)"
                   onfocus="limparCampoMoedaIR(this)"
                   placeholder="R$ 0,00">
          </div>
          
          <!-- Gastos com Despesas Médicas -->
          <div class="form-group">
            <label for="ir_${pessoaKey}_gastos_medicos">
              <i class="fas fa-heartbeat"></i> Despesas Médicas
            </label>
            <input type="text" 
                   id="ir_${pessoaKey}_gastos_medicos" 
                   value="R$ ${formatarMoedaIR(declaracao.gastos_medicos || 0)}"
                   oninput="updateIRField('${pessoaKey}', 'gastos_medicos', this.value)"
                   onfocus="limparCampoMoedaIR(this)"
                   placeholder="R$ 0,00">
          </div>
          
          <!-- Livro Caixa -->
          <div class="form-group">
            <label for="ir_${pessoaKey}_livro_caixa">
              <i class="fas fa-book"></i> Livro Caixa
            </label>
            <input type="text" 
                   id="ir_${pessoaKey}_livro_caixa" 
                   value="R$ ${formatarMoedaIR(declaracao.livro_caixa || 0)}"
                   oninput="updateIRField('${pessoaKey}', 'livro_caixa', this.value)"
                   onfocus="limparCampoMoedaIR(this)"
                   placeholder="R$ 0,00">
          </div>
          
          <!-- Pensão Alimentícia -->
          <div class="form-group">
            <label for="ir_${pessoaKey}_pensao_alimenticia">
              <i class="fas fa-child"></i> Pensão Alimentícia
            </label>
            <input type="text" 
                   id="ir_${pessoaKey}_pensao_alimenticia" 
                   value="R$ ${formatarMoedaIR(declaracao.pensao_alimenticia || 0)}"
                   oninput="updateIRField('${pessoaKey}', 'pensao_alimenticia', this.value)"
                   onfocus="limparCampoMoedaIR(this)"
                   placeholder="R$ 0,00">
          </div>
          
          <!-- Contribuição Não Oficial -->
          <div class="form-group">
            <label for="ir_${pessoaKey}_contribuicao_nao_oficial">
              <i class="fas fa-piggy-bank"></i> Contribuição Não Oficial
            </label>
            <input type="text" 
                   id="ir_${pessoaKey}_contribuicao_nao_oficial" 
                   value="R$ ${formatarMoedaIR(declaracao.contribuicao_nao_oficial || 0)}"
                   oninput="updateIRField('${pessoaKey}', 'contribuicao_nao_oficial', this.value)"
                   onfocus="limparCampoMoedaIR(this)"
                   placeholder="R$ 0,00">
          </div>
          
          <!-- Outras Deduções -->
          <div class="form-group">
            <label for="ir_${pessoaKey}_outras_deducoes">
              <i class="fas fa-minus-circle"></i> Outras Deduções
            </label>
            <input type="text" 
                   id="ir_${pessoaKey}_outras_deducoes" 
                   value="R$ ${formatarMoedaIR(declaracao.outras_deducoes || 0)}"
                   oninput="updateIRField('${pessoaKey}', 'outras_deducoes', this.value)"
                   onfocus="limparCampoMoedaIR(this)"
                   placeholder="R$ 0,00">
          </div>
          
          <!-- Resultado - Tipo -->
          <div class="form-group">
            <label for="ir_${pessoaKey}_resultado_tipo">
              <i class="fas fa-balance-scale"></i> Resultado
            </label>
            <select id="ir_${pessoaKey}_resultado_tipo" 
                    onchange="updateIRField('${pessoaKey}', 'resultado_tipo', this.value)"
                    style="width: 100%; padding: 0.7rem; border: 2px solid var(--border-color); border-radius: 8px; background: var(--dark-bg); color: var(--text-light); font-size: 0.9rem;">
              ${TIPOS_RESULTADO.map(tipo => `
                <option value="${tipo.id}" ${declaracao.resultado_tipo === tipo.id ? 'selected' : ''}>
                  ${tipo.nome}
                </option>
              `).join('')}
            </select>
          </div>
          
          <!-- Resultado - Valor -->
          <div class="form-group">
            <label for="ir_${pessoaKey}_resultado_valor">
              <i class="fas fa-coins"></i> Valor do Resultado
            </label>
            <input type="text" 
                   id="ir_${pessoaKey}_resultado_valor" 
                   value="R$ ${formatarMoedaIR(declaracao.resultado_valor || 0)}"
                   oninput="updateIRField('${pessoaKey}', 'resultado_valor', this.value)"
                   onfocus="limparCampoMoedaIR(this)"
                   placeholder="R$ 0,00"
                   style="${declaracao.resultado_tipo === 'paga' ? 'border-color: #dc3545;' : declaracao.resultado_tipo === 'restitui' ? 'border-color: #28a745;' : ''}">
          </div>
          
          <!-- Observações -->
          <div class="form-group full-width">
            <label for="ir_${pessoaKey}_observacoes">
              <i class="fas fa-sticky-note"></i> Observações
            </label>
            <textarea id="ir_${pessoaKey}_observacoes" 
                      rows="2"
                      onchange="updateIRField('${pessoaKey}', 'observacoes', this.value)"
                      placeholder="Observações sobre a declaração de IR..."
                      style="width: 100%; padding: 0.7rem; border: 2px solid var(--border-color); border-radius: 8px; background: var(--dark-bg); color: var(--text-light); font-size: 0.9rem; resize: vertical;">${declaracao.observacoes || ''}</textarea>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Função para atualizar quando cônjuge de pessoa com renda muda status de dependente
function updatePessoaConjugeDependenteIR(index) {
  if (window.pessoasRenda && window.pessoasRenda[index]) {
    const pessoaId = `pessoa_${index}`;
    const select = document.getElementById(`${pessoaId}_conjuge_dependente_ir`);
    if (select) {
      window.pessoasRenda[index].conjuge_dependente_ir = select.value;
    }
  }
  atualizarSecaoIR();
}

// Funções para obter e definir dados
function getDeclaracoesIRData() {
  return declaracoesIR;
}

function setDeclaracoesIRData(data) {
  if (Array.isArray(data)) {
    declaracoesIR = data;
    atualizarSecaoIR();
  }
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIRModule);
} else {
  initIRModule();
}

// Exportar funções
export {
  initIRModule,
  atualizarSecaoIR,
  getDeclaracoesIRData,
  setDeclaracoesIRData
};

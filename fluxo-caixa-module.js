// ========================================
// MÓDULO DE FLUXO DE CAIXA
// ========================================

// Dados do fluxo de caixa
let receitas = [];
let despesas = [];
let receitaCounter = 0;
let despesaCounter = 0;
let fluxoFinalizado = false;

// Tipos de receita
const TIPOS_RECEITA = [
  { id: 'clt', nome: 'CLT' },
  { id: 'concurso', nome: 'Concurso Público' },
  { id: 'autonomo', nome: 'Autônomo' },
  { id: 'empresario', nome: 'Empresário/Pró-labore' },
  { id: 'aluguel', nome: 'Aluguel' },
  { id: 'dividendos', nome: 'Dividendos' },
  { id: 'aposentadoria', nome: 'Aposentadoria' },
  { id: 'pensao', nome: 'Pensão' },
  { id: 'freelancer', nome: 'Freelancer' },
  { id: 'comissao', nome: 'Comissão' },
  { id: 'bonus', nome: 'Bônus' },
  { id: 'outro', nome: 'Outro' }
];

// Tipos de despesa
const TIPOS_DESPESA = [
  { id: 'fixa', nome: 'Fixa' },
  { id: 'variavel', nome: 'Variável' }
];

// Unidades de recorrência
const UNIDADES_RECORRENCIA = [
  { id: 'dia', nome: 'Dia(s)', fatorDia: 1, fatorSemana: 7, fatorMes: 30, fatorAno: 365 },
  { id: 'semana', nome: 'Semana(s)', fatorDia: null, fatorSemana: 1, fatorMes: 4, fatorAno: 52 },
  { id: 'mes', nome: 'Mês(es)', fatorDia: null, fatorSemana: null, fatorMes: 1, fatorAno: 12 },
  { id: 'ano', nome: 'Ano(s)', fatorDia: null, fatorSemana: null, fatorMes: null, fatorAno: 1 }
];

// Inicialização do módulo
function initFluxoCaixaModule() {
  console.log('Módulo de Fluxo de Caixa carregado');
  
  // Expor funções globalmente
  window.addReceita = addReceita;
  window.deleteReceita = deleteReceita;
  window.updateReceitaField = updateReceitaField;
  window.addDespesa = addDespesa;
  window.deleteDespesa = deleteDespesa;
  window.updateDespesaField = updateDespesaField;
  window.getFluxoCaixaData = getFluxoCaixaData;
  window.setFluxoCaixaData = setFluxoCaixaData;
  window.renderFluxoCaixa = renderFluxoCaixa;
  window.sincronizarDespesasAutomaticas = sincronizarDespesasAutomaticas;
  window.finalizarFluxo = finalizarFluxo;
  window.voltarEdicaoFluxo = voltarEdicaoFluxo;
  
  // Renderizar a seção
  setTimeout(() => {
    renderFluxoCaixa();
  }, 800);
}

// Função para formatar moeda
function formatarMoedaFluxo(valor) {
  if (!valor && valor !== 0) return 'R$ 0,00';
  const numero = parseFloat(valor);
  if (isNaN(numero)) return 'R$ 0,00';
  return 'R$ ' + numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Função para parsear valor monetário
function parseMoedaFluxo(valor) {
  if (!valor) return 0;
  if (typeof valor === 'number') return valor;
  const limpo = valor.toString().replace(/[R$\s.]/g, '').replace(',', '.');
  const numero = parseFloat(limpo);
  return isNaN(numero) ? 0 : numero;
}

// Função para obter pessoas disponíveis
function getPessoasParaFluxo() {
  const pessoas = [];
  
  // Titular
  const nomeTitular = document.getElementById('nome_diagnostico')?.value;
  if (nomeTitular) {
    pessoas.push({ id: 'titular', nome: nomeTitular, tipo: 'Cliente' });
  }
  
  // Cônjuge do titular
  const estadoCivil = document.getElementById('estado_civil')?.value;
  const nomeConjuge = document.getElementById('conjuge_nome')?.value;
  if ((estadoCivil === 'Casado(a)' || estadoCivil === 'União Estável') && nomeConjuge) {
    pessoas.push({ id: 'conjuge', nome: nomeConjuge, tipo: 'Cônjuge' });
  }
  
  // Outras pessoas com renda
  if (window.pessoasRenda && Array.isArray(window.pessoasRenda)) {
    window.pessoasRenda.forEach((pessoa, index) => {
      if (pessoa.nome) {
        pessoas.push({ id: `pessoa_${index}`, nome: pessoa.nome, tipo: 'Pessoa c/ Renda' });
        
        if ((pessoa.estado_civil === 'Casado(a)' || pessoa.estado_civil === 'União Estável') && pessoa.conjuge_nome) {
          pessoas.push({ id: `pessoa_${index}_conjuge`, nome: pessoa.conjuge_nome, tipo: `Cônjuge` });
        }
      }
    });
  }
  
  return pessoas;
}

// Função para obter contas e cartões disponíveis
function getContasCartoesParaFluxo() {
  if (window.getContasCartoesData) {
    const data = window.getContasCartoesData();
    const items = data.contasCartoes || data || [];
    return items.map(item => ({
      id: item.id,
      nome: `${item.tipo === 'cartao' ? 'Cartão' : 'Conta'} ${item.instituicao || '#' + item.id}`,
      titular: item.titular,
      tipo: item.tipo
    }));
  }
  return [];
}

// ========================================
// RECEITAS
// ========================================

function addReceita() {
  const id = ++receitaCounter;
  
  const novaReceita = {
    id: id,
    nome: '',
    valor: 0,
    tipo: 'clt',
    qtd_recorrencia: 1,
    und_recorrencia: 'mes',
    titular: 'titular',
    automatica: false
  };
  
  receitas.push(novaReceita);
  renderFluxoCaixa();
}

function deleteReceita(id) {
  const receita = receitas.find(r => r.id === id);
  if (receita && receita.automatica) {
    alert('Esta receita foi gerada automaticamente e não pode ser excluída.');
    return;
  }
  
  if (!confirm('Tem certeza que deseja excluir esta receita?')) return;
  
  receitas = receitas.filter(r => r.id !== id);
  renderFluxoCaixa();
}

function updateReceitaField(id, field, valor) {
  const receita = receitas.find(r => r.id === id);
  if (!receita) return;
  
  if (field === 'valor') {
    let valorNumerico = valor.replace(/\D/g, '');
    valorNumerico = (parseInt(valorNumerico) / 100).toFixed(2);
    receita[field] = parseFloat(valorNumerico) || 0;
    
    const input = document.getElementById(`receita_${id}_valor`);
    if (input) {
      input.value = formatarMoedaFluxo(valorNumerico);
    }
  } else if (field === 'qtd_recorrencia') {
    receita[field] = parseInt(valor) || 1;
  } else {
    receita[field] = valor;
  }
}

// ========================================
// DESPESAS
// ========================================

function addDespesa() {
  const id = ++despesaCounter;
  
  const novaDespesa = {
    id: id,
    nome: '',
    valor: 0,
    tipo: 'fixa',
    qtd_recorrencia: 1,
    und_recorrencia: 'mes',
    forma_pagamento: '',
    titular: '', // Será preenchido automaticamente baseado na forma de pagamento
    automatica: false,
    origem: null // 'produto_protecao', 'divida', 'conta_cartao'
  };
  
  despesas.push(novaDespesa);
  renderFluxoCaixa();
}

function deleteDespesa(id) {
  const despesa = despesas.find(d => d.id === id);
  if (despesa && despesa.automatica) {
    alert('Esta despesa foi gerada automaticamente e não pode ser excluída. Para removê-la, exclua o item original na seção correspondente.');
    return;
  }
  
  if (!confirm('Tem certeza que deseja excluir esta despesa?')) return;
  
  despesas = despesas.filter(d => d.id !== id);
  renderFluxoCaixa();
}

function updateDespesaField(id, field, valor) {
  const despesa = despesas.find(d => d.id === id);
  if (!despesa) return;
  
  if (field === 'valor') {
    let valorNumerico = valor.replace(/\D/g, '');
    valorNumerico = (parseInt(valorNumerico) / 100).toFixed(2);
    despesa[field] = parseFloat(valorNumerico) || 0;
    
    const input = document.getElementById(`despesa_${id}_valor`);
    if (input) {
      input.value = formatarMoedaFluxo(valorNumerico);
    }
  } else if (field === 'qtd_recorrencia') {
    despesa[field] = parseInt(valor) || 1;
  } else if (field === 'forma_pagamento') {
    despesa[field] = valor;
    // Atualizar titular automaticamente baseado na forma de pagamento
    const contasCartoes = getContasCartoesParaFluxo();
    const contaCartao = contasCartoes.find(cc => cc.id == valor);
    if (contaCartao) {
      despesa.titular = contaCartao.titular;
    }
    renderFluxoCaixa();
  } else {
    despesa[field] = valor;
  }
}

// ========================================
// SINCRONIZAÇÃO AUTOMÁTICA DE DESPESAS
// ========================================

function sincronizarDespesasAutomaticas() {
  // Remover despesas automáticas antigas
  despesas = despesas.filter(d => !d.automatica);
  
  const pessoas = getPessoasParaFluxo();
  const contasCartoes = getContasCartoesParaFluxo();
  
  // 1. Produtos & Proteção
  if (window.getProdutosProtecaoData) {
    const produtos = window.getProdutosProtecaoData() || [];
    produtos.forEach(produto => {
      if (produto.valor_mensal > 0 || produto.valor_anual > 0) {
        const id = ++despesaCounter;
        const valorMensal = parseFloat(produto.valor_mensal) || 0;
        const valorAnual = parseFloat(produto.valor_anual) || 0;
        
        // Usar valor mensal se disponível, senão calcular do anual
        const valor = valorMensal > 0 ? valorMensal : (valorAnual / 12);
        
        despesas.push({
          id: id,
          nome: `${produto.tipo || 'Produto'} - ${produto.seguradora || 'Proteção'}`,
          valor: valor,
          tipo: 'fixa',
          qtd_recorrencia: 1,
          und_recorrencia: 'mes',
          forma_pagamento: '',
          titular: produto.titular || 'titular',
          automatica: true,
          origem: 'produto_protecao',
          origem_id: produto.id
        });
      }
    });
  }
  
  // 2. Dívidas (parcelas mensais)
  if (window.getDividasData) {
    const dividas = window.getDividasData() || [];
    dividas.forEach(divida => {
      const valorParcela = parseFloat(divida.valor_parcela) || 0;
      const parcelasPagas = parseInt(divida.parcelas_pagas) || 0;
      const prazo = parseInt(divida.prazo) || 0;
      
      // Só adicionar se ainda tem parcelas a pagar
      if (valorParcela > 0 && parcelasPagas < prazo) {
        const id = ++despesaCounter;
        const responsaveis = divida.responsaveis || [];
        const titular = responsaveis.length > 0 ? responsaveis[0] : 'titular';
        
        despesas.push({
          id: id,
          nome: `Dívida: ${divida.motivo || 'Parcela'} - ${divida.credor || 'Credor'}`,
          valor: valorParcela,
          tipo: 'fixa',
          qtd_recorrencia: 1,
          und_recorrencia: 'mes',
          forma_pagamento: '',
          titular: titular,
          automatica: true,
          origem: 'divida',
          origem_id: divida.id
        });
      }
    });
  }
  
  // 3. Tarifas/Anuidades de Contas & Cartões (mensal)
  if (window.getContasCartoesData) {
    const data = window.getContasCartoesData();
    const items = data.contasCartoes || data || [];
    items.forEach(item => {
      const tarifa = parseFloat(item.tarifa_anuidade) || 0;
      if (tarifa > 0) {
        const id = ++despesaCounter;
        
        despesas.push({
          id: id,
          nome: `${item.tipo === 'cartao' ? 'Anuidade' : 'Tarifa'}: ${item.instituicao || 'Instituição'}`,
          valor: tarifa,
          tipo: 'fixa',
          qtd_recorrencia: 1,
          und_recorrencia: 'mes',
          forma_pagamento: item.id,
          titular: item.titular || 'titular',
          automatica: true,
          origem: 'conta_cartao',
          origem_id: item.id
        });
      }
    });
  }
  
  renderFluxoCaixa();
}

// ========================================
// CÁLCULOS DO FLUXO DE CAIXA
// ========================================

function calcularValorPorPeriodo(valor, qtdRecorrencia, undRecorrencia, periodoPara) {
  // Converte o valor para o período desejado
  const v = parseFloat(valor) || 0;
  const qtd = parseInt(qtdRecorrencia) || 1;
  
  // Fatores de conversão
  const fatores = {
    dia: { dia: 1, semana: 7, mes: 30, ano: 365 },
    semana: { dia: 1/7, semana: 1, mes: 4, ano: 52 },
    mes: { dia: 1/30, semana: 1/4, mes: 1, ano: 12 },
    ano: { dia: 1/365, semana: 1/52, mes: 1/12, ano: 1 }
  };
  
  // Valor por unidade de recorrência
  const valorPorUnidade = v / qtd;
  
  // Converter para o período desejado
  const fator = fatores[undRecorrencia]?.[periodoPara] || 0;
  
  return valorPorUnidade * fator;
}

function calcularFluxoPorPessoa() {
  const pessoas = getPessoasParaFluxo();
  const resultado = {};
  
  // Inicializar resultado para cada pessoa
  pessoas.forEach(pessoa => {
    resultado[pessoa.id] = {
      nome: pessoa.nome,
      tipo: pessoa.tipo,
      receitas: { dia: 0, semana: 0, mes: 0, ano: 0 },
      despesas_fixas: { dia: 0, semana: 0, mes: 0, ano: 0 },
      despesas_variaveis: { dia: 0, semana: 0, mes: 0, ano: 0 },
      investimentos: { dia: 0, semana: 0, mes: 0, ano: 0 },
      saldo: { dia: 0, semana: 0, mes: 0, ano: 0 }
    };
  });
  
  // Calcular receitas por pessoa
  receitas.forEach(receita => {
    const pessoaId = receita.titular;
    if (resultado[pessoaId]) {
      ['dia', 'semana', 'mes', 'ano'].forEach(periodo => {
        resultado[pessoaId].receitas[periodo] += calcularValorPorPeriodo(
          receita.valor, 
          receita.qtd_recorrencia, 
          receita.und_recorrencia, 
          periodo
        );
      });
    }
  });
  
  // Calcular despesas por pessoa
  despesas.forEach(despesa => {
    const pessoaId = despesa.titular;
    if (resultado[pessoaId]) {
      const tipoDespesa = despesa.tipo === 'fixa' ? 'despesas_fixas' : 'despesas_variaveis';
      ['dia', 'semana', 'mes', 'ano'].forEach(periodo => {
        resultado[pessoaId][tipoDespesa][periodo] += calcularValorPorPeriodo(
          despesa.valor, 
          despesa.qtd_recorrencia, 
          despesa.und_recorrencia, 
          periodo
        );
      });
    }
  });
  
  // Calcular investimentos (aportes do patrimônio líquido)
  if (window.getPatrimoniosLiquidosData) {
    const patrimonios = window.getPatrimoniosLiquidosData() || [];
    patrimonios.forEach(pl => {
      const aporteMensal = parseFloat(pl.aporte_mensal) || 0;
      const aporteAnual = parseFloat(pl.aporte_anual) || 0;
      const donos = pl.donos || [];
      
      if ((aporteMensal > 0 || aporteAnual > 0) && donos.length > 0) {
        // Calcular valor total de aporte mensal
        const valorMensal = aporteMensal + (aporteAnual / 12);
        const valorPorDono = valorMensal / donos.length;
        
        donos.forEach(donoNome => {
          // Encontrar o ID da pessoa pelo nome
          const pessoa = pessoas.find(p => p.nome === donoNome);
          if (pessoa && resultado[pessoa.id]) {
            resultado[pessoa.id].investimentos.mes += valorPorDono;
            resultado[pessoa.id].investimentos.ano += valorPorDono * 12;
            resultado[pessoa.id].investimentos.semana += valorPorDono / 4;
            resultado[pessoa.id].investimentos.dia += valorPorDono / 30;
          }
        });
      }
    });
  }
  
  // Calcular saldo por pessoa
  Object.keys(resultado).forEach(pessoaId => {
    ['dia', 'semana', 'mes', 'ano'].forEach(periodo => {
      resultado[pessoaId].saldo[periodo] = 
        resultado[pessoaId].receitas[periodo] - 
        resultado[pessoaId].despesas_fixas[periodo] - 
        resultado[pessoaId].despesas_variaveis[periodo] - 
        resultado[pessoaId].investimentos[periodo];
    });
  });
  
  return resultado;
}

function calcularFluxoGeral() {
  const fluxoPorPessoa = calcularFluxoPorPessoa();
  
  const geral = {
    receitas: { dia: 0, semana: 0, mes: 0, ano: 0 },
    despesas_fixas: { dia: 0, semana: 0, mes: 0, ano: 0 },
    despesas_variaveis: { dia: 0, semana: 0, mes: 0, ano: 0 },
    investimentos: { dia: 0, semana: 0, mes: 0, ano: 0 },
    saldo: { dia: 0, semana: 0, mes: 0, ano: 0 }
  };
  
  Object.values(fluxoPorPessoa).forEach(pessoa => {
    ['dia', 'semana', 'mes', 'ano'].forEach(periodo => {
      geral.receitas[periodo] += pessoa.receitas[periodo];
      geral.despesas_fixas[periodo] += pessoa.despesas_fixas[periodo];
      geral.despesas_variaveis[periodo] += pessoa.despesas_variaveis[periodo];
      geral.investimentos[periodo] += pessoa.investimentos[periodo];
      geral.saldo[periodo] += pessoa.saldo[periodo];
    });
  });
  
  return geral;
}

// ========================================
// FINALIZAR FLUXO
// ========================================

function finalizarFluxo() {
  fluxoFinalizado = true;
  renderFluxoCaixa();
}

function voltarEdicaoFluxo() {
  fluxoFinalizado = false;
  renderFluxoCaixa();
}

// ========================================
// RENDERIZAÇÃO
// ========================================

function renderFluxoCaixa() {
  const container = document.getElementById('fluxo-caixa-container');
  if (!container) return;
  
  const pessoas = getPessoasParaFluxo();
  const contasCartoes = getContasCartoesParaFluxo();
  
  if (fluxoFinalizado) {
    renderResultadosFluxo(container);
    return;
  }
  
  // Renderizar formulário de edição
  container.innerHTML = `
    <!-- Botão de Sincronização -->
    <div style="text-align: center; margin-bottom: 1.5rem;">
      <button type="button" onclick="sincronizarDespesasAutomaticas()" 
              style="background: var(--info-color, #17a2b8); color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">
        <i class="fas fa-sync"></i> Sincronizar Despesas Automáticas
      </button>
      <p style="font-size: 0.8rem; color: var(--text-light); opacity: 0.7; margin-top: 0.5rem;">
        Importa automaticamente despesas de Produtos & Proteção, Dívidas e Tarifas de Contas/Cartões
      </p>
    </div>
    
    <!-- RECEITAS -->
    <div style="margin-bottom: 2rem;">
      <h4 style="color: #28a745; margin: 0 0 1rem 0; display: flex; align-items: center; justify-content: space-between;">
        <span><i class="fas fa-arrow-up"></i> RECEITAS</span>
        <button type="button" onclick="addReceita()" 
                style="background: #28a745; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
          <i class="fas fa-plus"></i> Adicionar Receita
        </button>
      </h4>
      
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
          <thead>
            <tr style="background: rgba(40, 167, 69, 0.2);">
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Nome</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Valor</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Tipo</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Recorrência</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">De quem é</th>
              <th style="padding: 0.6rem; text-align: center; border: 1px solid var(--border-color); width: 60px;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${receitas.length === 0 ? `
              <tr>
                <td colspan="6" style="padding: 1rem; text-align: center; color: var(--text-light); opacity: 0.7; border: 1px solid var(--border-color);">
                  Nenhuma receita cadastrada. Clique em "Adicionar Receita" para começar.
                </td>
              </tr>
            ` : receitas.map(receita => `
              <tr style="background: ${receita.automatica ? 'rgba(40, 167, 69, 0.05)' : 'transparent'};">
                <td style="padding: 0.4rem; border: 1px solid var(--border-color);">
                  <input type="text" value="${receita.nome || ''}" 
                         onchange="updateReceitaField(${receita.id}, 'nome', this.value)"
                         placeholder="Nome da receita"
                         style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                         ${receita.automatica ? 'readonly' : ''}>
                </td>
                <td style="padding: 0.4rem; border: 1px solid var(--border-color); width: 120px;">
                  <input type="text" id="receita_${receita.id}_valor" value="${formatarMoedaFluxo(receita.valor)}" 
                         oninput="updateReceitaField(${receita.id}, 'valor', this.value)"
                         style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                         ${receita.automatica ? 'readonly' : ''}>
                </td>
                <td style="padding: 0.4rem; border: 1px solid var(--border-color); width: 130px;">
                  <select onchange="updateReceitaField(${receita.id}, 'tipo', this.value)"
                          style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                          ${receita.automatica ? 'disabled' : ''}>
                    ${TIPOS_RECEITA.map(tipo => `
                      <option value="${tipo.id}" ${receita.tipo === tipo.id ? 'selected' : ''}>${tipo.nome}</option>
                    `).join('')}
                  </select>
                </td>
                <td style="padding: 0.4rem; border: 1px solid var(--border-color); width: 150px;">
                  <div style="display: flex; gap: 0.3rem;">
                    <input type="number" value="${receita.qtd_recorrencia || 1}" 
                           onchange="updateReceitaField(${receita.id}, 'qtd_recorrencia', this.value)"
                           min="1" style="width: 50px; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                           ${receita.automatica ? 'readonly' : ''}>
                    <select onchange="updateReceitaField(${receita.id}, 'und_recorrencia', this.value)"
                            style="flex: 1; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                            ${receita.automatica ? 'disabled' : ''}>
                      ${UNIDADES_RECORRENCIA.map(und => `
                        <option value="${und.id}" ${receita.und_recorrencia === und.id ? 'selected' : ''}>${und.nome}</option>
                      `).join('')}
                    </select>
                  </div>
                </td>
                <td style="padding: 0.4rem; border: 1px solid var(--border-color); width: 150px;">
                  <select onchange="updateReceitaField(${receita.id}, 'titular', this.value)"
                          style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                          ${receita.automatica ? 'disabled' : ''}>
                    ${pessoas.map(pessoa => `
                      <option value="${pessoa.id}" ${receita.titular === pessoa.id ? 'selected' : ''}>${pessoa.nome}</option>
                    `).join('')}
                  </select>
                </td>
                <td style="padding: 0.4rem; border: 1px solid var(--border-color); text-align: center;">
                  ${receita.automatica ? `
                    <span style="color: var(--text-light); opacity: 0.5;" title="Item automático"><i class="fas fa-lock"></i></span>
                  ` : `
                    <button type="button" onclick="deleteReceita(${receita.id})" 
                            style="background: #dc3545; color: white; border: none; padding: 0.3rem 0.5rem; border-radius: 4px; cursor: pointer;">
                      <i class="fas fa-trash"></i>
                    </button>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- DESPESAS -->
    <div style="margin-bottom: 2rem;">
      <h4 style="color: #dc3545; margin: 0 0 1rem 0; display: flex; align-items: center; justify-content: space-between;">
        <span><i class="fas fa-arrow-down"></i> DESPESAS</span>
        <button type="button" onclick="addDespesa()" 
                style="background: #dc3545; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
          <i class="fas fa-plus"></i> Adicionar Despesa
        </button>
      </h4>
      
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
          <thead>
            <tr style="background: rgba(220, 53, 69, 0.2);">
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Nome</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Valor</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Tipo</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Recorrência</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Forma Pgto</th>
              <th style="padding: 0.6rem; text-align: left; border: 1px solid var(--border-color);">Dono</th>
              <th style="padding: 0.6rem; text-align: center; border: 1px solid var(--border-color); width: 60px;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${despesas.length === 0 ? `
              <tr>
                <td colspan="7" style="padding: 1rem; text-align: center; color: var(--text-light); opacity: 0.7; border: 1px solid var(--border-color);">
                  Nenhuma despesa cadastrada. Clique em "Adicionar Despesa" ou "Sincronizar Despesas Automáticas".
                </td>
              </tr>
            ` : despesas.map(despesa => {
              const contaCartao = contasCartoes.find(cc => cc.id == despesa.forma_pagamento);
              const titularNome = pessoas.find(p => p.id === despesa.titular)?.nome || despesa.titular || '-';
              
              return `
                <tr style="background: ${despesa.automatica ? 'rgba(220, 53, 69, 0.05)' : 'transparent'};">
                  <td style="padding: 0.4rem; border: 1px solid var(--border-color);">
                    <input type="text" value="${despesa.nome || ''}" 
                           onchange="updateDespesaField(${despesa.id}, 'nome', this.value)"
                           placeholder="Nome da despesa"
                           style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                           ${despesa.automatica ? 'readonly' : ''}>
                  </td>
                  <td style="padding: 0.4rem; border: 1px solid var(--border-color); width: 120px;">
                    <input type="text" id="despesa_${despesa.id}_valor" value="${formatarMoedaFluxo(despesa.valor)}" 
                           oninput="updateDespesaField(${despesa.id}, 'valor', this.value)"
                           style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                           ${despesa.automatica ? 'readonly' : ''}>
                  </td>
                  <td style="padding: 0.4rem; border: 1px solid var(--border-color); width: 100px;">
                    <select onchange="updateDespesaField(${despesa.id}, 'tipo', this.value)"
                            style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                            ${despesa.automatica ? 'disabled' : ''}>
                      ${TIPOS_DESPESA.map(tipo => `
                        <option value="${tipo.id}" ${despesa.tipo === tipo.id ? 'selected' : ''}>${tipo.nome}</option>
                      `).join('')}
                    </select>
                  </td>
                  <td style="padding: 0.4rem; border: 1px solid var(--border-color); width: 150px;">
                    <div style="display: flex; gap: 0.3rem;">
                      <input type="number" value="${despesa.qtd_recorrencia || 1}" 
                             onchange="updateDespesaField(${despesa.id}, 'qtd_recorrencia', this.value)"
                             min="1" style="width: 50px; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                             ${despesa.automatica ? 'readonly' : ''}>
                      <select onchange="updateDespesaField(${despesa.id}, 'und_recorrencia', this.value)"
                              style="flex: 1; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);"
                              ${despesa.automatica ? 'disabled' : ''}>
                        ${UNIDADES_RECORRENCIA.map(und => `
                          <option value="${und.id}" ${despesa.und_recorrencia === und.id ? 'selected' : ''}>${und.nome}</option>
                        `).join('')}
                      </select>
                    </div>
                  </td>
                  <td style="padding: 0.4rem; border: 1px solid var(--border-color); width: 150px;">
                    <select onchange="updateDespesaField(${despesa.id}, 'forma_pagamento', this.value)"
                            style="width: 100%; padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--dark-bg); color: var(--text-light);">
                      <option value="">Selecione...</option>
                      ${contasCartoes.map(cc => `
                        <option value="${cc.id}" ${despesa.forma_pagamento == cc.id ? 'selected' : ''}>${cc.nome}</option>
                      `).join('')}
                    </select>
                  </td>
                  <td style="padding: 0.4rem; border: 1px solid var(--border-color); width: 100px; font-size: 0.85rem;">
                    ${titularNome}
                  </td>
                  <td style="padding: 0.4rem; border: 1px solid var(--border-color); text-align: center;">
                    ${despesa.automatica ? `
                      <span style="color: var(--text-light); opacity: 0.5;" title="Item automático - ${despesa.origem}"><i class="fas fa-lock"></i></span>
                    ` : `
                      <button type="button" onclick="deleteDespesa(${despesa.id})" 
                              style="background: #dc3545; color: white; border: none; padding: 0.3rem 0.5rem; border-radius: 4px; cursor: pointer;">
                        <i class="fas fa-trash"></i>
                      </button>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Botão Finalizar -->
    <div style="text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 2px solid var(--border-color);">
      <button type="button" onclick="finalizarFluxo()" 
              style="background: var(--accent-color); color: var(--dark-bg); border: none; padding: 0.8rem 2rem; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600;">
        <i class="fas fa-check-circle"></i> FINALIZAR FLUXO
      </button>
    </div>
  `;
}

function renderResultadosFluxo(container) {
  const fluxoPorPessoa = calcularFluxoPorPessoa();
  const fluxoGeral = calcularFluxoGeral();
  const pessoas = getPessoasParaFluxo();
  
  // Função auxiliar para renderizar tabela de fluxo
  function renderTabelaFluxo(dados, titulo, corTitulo) {
    return `
      <div style="margin-bottom: 1.5rem;">
        ${titulo ? `<h5 style="color: ${corTitulo}; margin: 0 0 0.5rem 0;">${titulo}</h5>` : ''}
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="background: rgba(212, 175, 55, 0.2);">
                <th style="padding: 0.5rem; text-align: left; border: 1px solid var(--border-color);"></th>
                <th style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">DIA</th>
                <th style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">SEMANA</th>
                <th style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">MÊS</th>
                <th style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color);">ANO</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background: rgba(40, 167, 69, 0.1);">
                <td style="padding: 0.5rem; border: 1px solid var(--border-color); font-weight: 600; color: #28a745;">
                  <i class="fas fa-arrow-up"></i> Entradas
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #28a745;">${formatarMoedaFluxo(dados.receitas.dia)}</td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #28a745;">${formatarMoedaFluxo(dados.receitas.semana)}</td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #28a745;">${formatarMoedaFluxo(dados.receitas.mes)}</td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #28a745;">${formatarMoedaFluxo(dados.receitas.ano)}</td>
              </tr>
              <tr style="background: rgba(220, 53, 69, 0.1);">
                <td style="padding: 0.5rem; border: 1px solid var(--border-color); font-weight: 600; color: #dc3545;">
                  <i class="fas fa-arrow-down"></i> Despesas Fixas
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #dc3545;">${formatarMoedaFluxo(dados.despesas_fixas.dia)}</td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #dc3545;">${formatarMoedaFluxo(dados.despesas_fixas.semana)}</td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #dc3545;">${formatarMoedaFluxo(dados.despesas_fixas.mes)}</td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #dc3545;">${formatarMoedaFluxo(dados.despesas_fixas.ano)}</td>
              </tr>
              <tr style="background: rgba(255, 193, 7, 0.1);">
                <td style="padding: 0.5rem; border: 1px solid var(--border-color); font-weight: 600; color: #ffc107;">
                  <i class="fas fa-random"></i> Despesas Variáveis
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #ffc107;">${formatarMoedaFluxo(dados.despesas_variaveis.dia)}</td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #ffc107;">${formatarMoedaFluxo(dados.despesas_variaveis.semana)}</td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #ffc107;">${formatarMoedaFluxo(dados.despesas_variaveis.mes)}</td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #ffc107;">${formatarMoedaFluxo(dados.despesas_variaveis.ano)}</td>
              </tr>
              <tr style="background: rgba(0, 123, 255, 0.1);">
                <td style="padding: 0.5rem; border: 1px solid var(--border-color); font-weight: 600; color: #007bff;">
                  <i class="fas fa-piggy-bank"></i> Investimentos
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #007bff;">${formatarMoedaFluxo(dados.investimentos.dia)}</td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #007bff;">${formatarMoedaFluxo(dados.investimentos.semana)}</td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #007bff;">${formatarMoedaFluxo(dados.investimentos.mes)}</td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); color: #007bff;">${formatarMoedaFluxo(dados.investimentos.ano)}</td>
              </tr>
              <tr style="background: rgba(212, 175, 55, 0.2);">
                <td style="padding: 0.5rem; border: 1px solid var(--border-color); font-weight: 700; color: var(--accent-color);">
                  <i class="fas fa-wallet"></i> SALDO/SOBRA
                </td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); font-weight: 700; color: ${dados.saldo.dia >= 0 ? '#28a745' : '#dc3545'};">${formatarMoedaFluxo(dados.saldo.dia)}</td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); font-weight: 700; color: ${dados.saldo.semana >= 0 ? '#28a745' : '#dc3545'};">${formatarMoedaFluxo(dados.saldo.semana)}</td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); font-weight: 700; color: ${dados.saldo.mes >= 0 ? '#28a745' : '#dc3545'};">${formatarMoedaFluxo(dados.saldo.mes)}</td>
                <td style="padding: 0.5rem; text-align: right; border: 1px solid var(--border-color); font-weight: 700; color: ${dados.saldo.ano >= 0 ? '#28a745' : '#dc3545'};">${formatarMoedaFluxo(dados.saldo.ano)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  
  // Renderizar resultados
  container.innerHTML = `
    <!-- Botão Voltar -->
    <div style="text-align: right; margin-bottom: 1rem;">
      <button type="button" onclick="voltarEdicaoFluxo()" 
              style="background: var(--border-color); color: var(--text-light); border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">
        <i class="fas fa-arrow-left"></i> Voltar para Edição
      </button>
    </div>
    
    <!-- RESULTADO PRINCIPAL (GERAL) -->
    <div style="background: var(--dark-bg); border: 2px solid var(--accent-color); border-radius: 10px; padding: 1.2rem; margin-bottom: 2rem;">
      <h4 style="color: var(--accent-color); margin: 0 0 1rem 0; text-align: center;">
        <i class="fas fa-chart-pie"></i> ANÁLISE GERAL DO FLUXO DE CAIXA
      </h4>
      ${renderTabelaFluxo(fluxoGeral, null, null)}
    </div>
    
    <!-- RESULTADOS SECUNDÁRIOS (POR PESSOA) -->
    <div style="background: var(--dark-bg); border: 2px solid var(--border-color); border-radius: 10px; padding: 1.2rem;">
      <h4 style="color: var(--accent-color); margin: 0 0 1rem 0; text-align: center;">
        <i class="fas fa-users"></i> ANÁLISE POR INTEGRANTE
      </h4>
      
      ${Object.entries(fluxoPorPessoa).map(([pessoaId, dados]) => {
        // Verificar se a pessoa tem algum valor
        const temValores = dados.receitas.ano > 0 || dados.despesas_fixas.ano > 0 || 
                          dados.despesas_variaveis.ano > 0 || dados.investimentos.ano > 0;
        
        if (!temValores) return '';
        
        return `
          <div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(255,255,255,0.02); border-radius: 8px;">
            ${renderTabelaFluxo(dados, `<i class="fas fa-user"></i> ${dados.nome} <span style="font-size: 0.8rem; opacity: 0.7;">(${dados.tipo})</span>`, 'var(--text-light)')}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ========================================
// FUNÇÕES DE DADOS
// ========================================

function getFluxoCaixaData() {
  return {
    receitas: receitas,
    despesas: despesas,
    fluxoFinalizado: fluxoFinalizado
  };
}

function setFluxoCaixaData(data) {
  if (data) {
    if (Array.isArray(data.receitas)) {
      receitas = data.receitas;
      if (receitas.length > 0) {
        receitaCounter = Math.max(...receitas.map(r => r.id || 0));
      }
    }
    if (Array.isArray(data.despesas)) {
      despesas = data.despesas;
      if (despesas.length > 0) {
        despesaCounter = Math.max(...despesas.map(d => d.id || 0));
      }
    }
    if (typeof data.fluxoFinalizado === 'boolean') {
      fluxoFinalizado = data.fluxoFinalizado;
    }
    renderFluxoCaixa();
  }
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFluxoCaixaModule);
} else {
  initFluxoCaixaModule();
}

// Exportar funções
export {
  initFluxoCaixaModule,
  getFluxoCaixaData,
  setFluxoCaixaData,
  renderFluxoCaixa,
  sincronizarDespesasAutomaticas
};

// formulario-cliente.js
import { supabase } from "./supabase.js";

// --- Elementos DOM ---
const formContentEl = document.getElementById("form-content");
const messageAreaEl = document.getElementById("message-area");
const formTitleEl = document.getElementById("form-title");

// --- Estado para preservar seleções ---
let planoSaudeSelections = {};
let seguroVidaSelections = {};
let impostoRendaSelections = {}; // Estado para preservar seleções de imposto de renda
let orcamentoSelections = {}; // Estado para preservar seleções de orçamento

// --- Funções de Utilidade ---
const sanitizeInput = (str) => {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\'/g, "&#x27;")
    .replace(/`/g, "&#x60;");
};

const formatCurrency = (value) => {
    if (value === null || value === undefined || value === "") return "";
    let cleanValue = String(value).replace(/[^\d,.-]/g, 
        '');
    const commaCount = (cleanValue.match(/,/g) || []).length;
    if (commaCount > 1) {
        const parts = cleanValue.split(',');
        cleanValue = parts.slice(0, -1).join('') + '.' + parts.slice(-1);
    } else {
        cleanValue = cleanValue.replace(',', '.'); 
    }
    
    const number = parseFloat(cleanValue);
    if (isNaN(number)) return "";
    return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const parseCurrency = (formattedValue) => {
    if (formattedValue === null || formattedValue === undefined || formattedValue === "") return null;
    const cleanValue = String(formattedValue).replace(/R\$\s?/g, '').replace(/\./g, '').replace(/,/g, '.');
    const number = parseFloat(cleanValue);
    return isNaN(number) ? null : number;
};


const capitalizeName = (name) => {
    if (!name) return "";
    return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

function showMessage(type, text) {
    messageAreaEl.innerHTML = `<div class="message ${type}">${sanitizeInput(text)}</div>`;
}

function updatePerguntaDependentesLabel() {
    const labelTemDependentes = document.getElementById("label_tem_dependentes");
    if (!labelTemDependentes) return;
    const rendaUnicaSimRadio = document.getElementById("renda_unica_sim");
    const outrasPessoasInputs = document.querySelectorAll('#pessoas-list input[name="pessoa_nome"]');
    let temOutrasPessoasComRenda = false;
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        outrasPessoasInputs.forEach(input => {
            if (input.value.trim() !== "") {
                temOutrasPessoasComRenda = true;
            }
        });
    }
    if (rendaUnicaSimRadio && rendaUnicaSimRadio.checked) {
        labelTemDependentes.textContent = "Você tem filho/pet/outros parentes que dependem de você?";
    } else if (temOutrasPessoasComRenda) {
        labelTemDependentes.textContent = "Vocês têm filho/pet/outros parentes que dependem de vocês?";
    } else {
        labelTemDependentes.textContent = "Você tem filho/pet/outros parentes que dependem de você?";
    }
}

function updatePerguntaPatrimonioFisicoLabel() {
    const labelTemPatrimonio = document.getElementById("label_tem_patrimonio_fisico");
    if (!labelTemPatrimonio) return;
    const rendaUnicaSimRadio = document.getElementById("renda_unica_sim");
    const outrasPessoasInputs = document.querySelectorAll('#pessoas-list input[name="pessoa_nome"]');
    let temOutrasPessoasComRenda = false;
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        outrasPessoasInputs.forEach(input => {
            if (input.value.trim() !== "") {
                temOutrasPessoasComRenda = true;
            }
        });
    }
    if (rendaUnicaSimRadio && rendaUnicaSimRadio.checked) {
        labelTemPatrimonio.textContent = "Você possui patrimônio físico (imóvel, automóvel, jóias, outros...)?";
    } else if (temOutrasPessoasComRenda) {
        labelTemPatrimonio.textContent = "Vocês possuem patrimônio físico (imóvel, automóvel, jóias, outros...)?";
    } else {
        labelTemPatrimonio.textContent = "Você possui patrimônio físico (imóvel, automóvel, jóias, outros...)?";
    }
}

function updatePerguntaPatrimonioLiquidoLabel() {
    const labelTemPatrimonioLiquido = document.getElementById("label_tem_patrimonio_liquido");
    if (!labelTemPatrimonioLiquido) return;
    const rendaUnicaSimRadio = document.getElementById("renda_unica_sim");
    const outrasPessoasInputs = document.querySelectorAll("#pessoas-list input[name='pessoa_nome']");
    let temOutrasPessoasComRenda = false;
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        outrasPessoasInputs.forEach(input => {
            if (input.value.trim() !== "") {
                temOutrasPessoasComRenda = true;
            }
        });
    }
    if (rendaUnicaSimRadio && rendaUnicaSimRadio.checked) {
        labelTemPatrimonioLiquido.textContent = "Você possui Dinheiro Guardado ou Investido?";
    } else if (temOutrasPessoasComRenda) {
        labelTemPatrimonioLiquido.textContent = "Vocês possuem Dinheiro Guardado ou Investido?";
    } else {
        labelTemPatrimonioLiquido.textContent = "Você possui Dinheiro Guardado ou Investido?";
    }
}

function updatePerguntaDividasLabel() {
    const labelTemDividas = document.getElementById("label_tem_dividas");
    if (!labelTemDividas) return;
    const rendaUnicaSimRadio = document.getElementById("renda_unica_sim");
    const outrasPessoasInputs = document.querySelectorAll("#pessoas-list input[name='pessoa_nome']");
    let temOutrasPessoasComRenda = false;
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        outrasPessoasInputs.forEach(input => {
            if (input.value.trim() !== "") {
                temOutrasPessoasComRenda = true;
            }
        });
    }
    if (rendaUnicaSimRadio && rendaUnicaSimRadio.checked) {
        labelTemDividas.textContent = "Você possui dívidas?";
    } else if (temOutrasPessoasComRenda) {
        labelTemDividas.textContent = "Vocês possuem dívidas?";
    } else {
        labelTemDividas.textContent = "Você possui dívidas?";
    }
}

// Função para salvar as seleções de imposto de renda
function saveImpostoRendaSelections() {
    const container = document.getElementById("imposto-renda-section-content");
    if (!container) return;
    impostoRendaSelections = {}; 
    
    // Salvar seleções de declaração de IR
    container.querySelectorAll(".imposto-renda-entry").forEach(entry => {
        const nameAttribute = entry.querySelector('input[type="radio"]').name; 
        const selectedRadio = entry.querySelector(`input[name="${nameAttribute}"]:checked`);
        if (selectedRadio) {
            impostoRendaSelections[nameAttribute] = selectedRadio.value;
            
            // Salvar seleções de tipo e resultado para respostas "sim"
            if (selectedRadio.value === "sim") {
                // Salvar tipo de IR
                const tipoNameAttribute = `${nameAttribute}_tipo`;
                const tipoSelectedRadio = entry.querySelector(`input[name="${tipoNameAttribute}"]:checked`);
                if (tipoSelectedRadio) {
                    impostoRendaSelections[tipoNameAttribute] = tipoSelectedRadio.value;
                }
                
                // Salvar resultado de IR
                const resultadoNameAttribute = `${nameAttribute}_resultado`;
                const resultadoSelectedRadio = entry.querySelector(`input[name="${resultadoNameAttribute}"]:checked`);
                if (resultadoSelectedRadio) {
                    impostoRendaSelections[resultadoNameAttribute] = resultadoSelectedRadio.value;
                }
            }
        }
    });
}

// Função para restaurar as seleções de imposto de renda
function restoreImpostoRendaSelections() {
    Object.keys(impostoRendaSelections).forEach(nameAttribute => {
        const value = impostoRendaSelections[nameAttribute];
        const radioToSelect = document.querySelector(`input[name="${nameAttribute}"][value="${value}"]`);
        if (radioToSelect) {
            radioToSelect.checked = true;
            
            // Se for uma seleção de declaração de IR com valor "sim", mostrar perguntas adicionais
            if (nameAttribute.indexOf("_tipo") === -1 && nameAttribute.indexOf("_resultado") === -1 && value === "sim") {
                const entryDiv = radioToSelect.closest('.imposto-renda-entry');
                if (entryDiv) {
                    const additionalQuestionsDiv = entryDiv.querySelector('.imposto-renda-additional-questions');
                    if (additionalQuestionsDiv) {
                        additionalQuestionsDiv.style.display = 'block';
                    }
                }
            }
        }
    });
}

// Função para renderizar as perguntas de imposto de renda
function renderImpostoRendaQuestions() {
    saveImpostoRendaSelections(); 
    const container = document.getElementById("imposto-renda-section-content");
    if (!container) return;
    container.innerHTML = '';
    
    const pessoasComRenda = [];
    const nomeCompletoInput = document.getElementById("nome_completo");
    if (nomeCompletoInput && nomeCompletoInput.value.trim() !== "") {
        pessoasComRenda.push({ id: "preenchedor_ir", nome: sanitizeInput(nomeCompletoInput.value.trim()), tipo: "preenchedor" });
    }
    
    let temOutrasPessoasComRenda = false;
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach((entry, index) => { 
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasComRenda.push({ id: `outra_pessoa_ir_${index}`, nome: sanitizeInput(nomeInput.value.trim()), tipo: "outra_pessoa_renda" });
                temOutrasPessoasComRenda = true;
            }
        });
    }
    
    const tituloImpostoRenda = document.getElementById("imposto-renda-section-title");
    if (pessoasComRenda.length === 0) {
        container.innerHTML = "<p>Preencha as informações sobre nome e renda para definir as perguntas sobre imposto de renda.</p>";
        if(tituloImpostoRenda) tituloImpostoRenda.style.display = 'none';
        return;
    }
    
    if(tituloImpostoRenda) tituloImpostoRenda.style.display = 'block';
    
    // Pergunta para o preenchedor (sempre exibida)
    const preenchedor = pessoasComRenda.find(p => p.tipo === "preenchedor");
    if (preenchedor) {
        const personId = `imposto_renda_${preenchedor.id}`;
        const entryDiv = document.createElement("div");
        entryDiv.classList.add("imposto-renda-entry");
        entryDiv.style.marginBottom = "1rem";
        entryDiv.innerHTML = `
            <label for="${personId}" style="display: block; margin-bottom: 0.5rem;">Você declara imposto de renda?</label>
            <div class="radio-options-inline" style="display: flex; align-items: center; flex-wrap: nowrap; width: 100%;">
                <span style="margin-right: 20px; display: flex; align-items: center;">
                    <input type="radio" id="${personId}_sim" name="${personId}" value="sim" required style="margin-right: 5px;">
                    <label for="${personId}_sim" style="font-size: 14px;">Sim</label>
                </span>
                <span style="display: flex; align-items: center;">
                    <input type="radio" id="${personId}_nao" name="${personId}" value="nao" style="margin-right: 5px;">
                    <label for="${personId}_nao" style="font-size: 14px;">Não</label>
                </span>
            </div>
            <div class="imposto-renda-additional-questions" style="display: none; margin-top: 1rem; margin-left: 1.5rem; padding-left: 1rem; border-left: 2px solid #ddd;">
                <div style="margin-bottom: 0.8rem;">
                    <label for="${personId}_tipo" style="display: block; margin-bottom: 0.5rem;">Qual o tipo?</label>
                    <div class="radio-options-inline" style="display: flex; align-items: center; flex-wrap: nowrap; width: 100%;">
                        <span style="margin-right: 15px; display: flex; align-items: center;">
                            <input type="radio" id="${personId}_tipo_simples" name="${personId}_tipo" value="simples" style="margin-right: 3px;">
                            <label for="${personId}_tipo_simples" style="font-size: 13px;">Simples</label>
                        </span>
                        <span style="margin-right: 15px; display: flex; align-items: center;">
                            <input type="radio" id="${personId}_tipo_completa" name="${personId}_tipo" value="completa" style="margin-right: 3px;">
                            <label for="${personId}_tipo_completa" style="font-size: 13px;">Dedução Completa</label>
                        </span>
                        <span style="display: flex; align-items: center;">
                            <input type="radio" id="${personId}_tipo_naosei" name="${personId}_tipo" value="nao_sei" style="margin-right: 3px;">
                            <label for="${personId}_tipo_naosei" style="font-size: 13px;">Não Sei Informar</label>
                        </span>
                    </div>
                </div>
                <div>
                    <label for="${personId}_resultado" style="display: block; margin-bottom: 0.5rem;">Qual o resultado?</label>
                    <div class="radio-options-inline" style="display: flex; align-items: center; flex-wrap: nowrap; width: 100%;">
                        <span style="margin-right: 15px; display: flex; align-items: center;">
                            <input type="radio" id="${personId}_resultado_paga" name="${personId}_resultado" value="paga" style="margin-right: 3px;">
                            <label for="${personId}_resultado_paga" style="font-size: 13px;">Paga</label>
                        </span>
                        <span style="margin-right: 15px; display: flex; align-items: center;">
                            <input type="radio" id="${personId}_resultado_recebe" name="${personId}_resultado" value="recebe" style="margin-right: 3px;">
                            <label for="${personId}_resultado_recebe" style="font-size: 13px;">Recebe</label>
                        </span>
                        <span style="margin-right: 15px; display: flex; align-items: center;">
                            <input type="radio" id="${personId}_resultado_isento" name="${personId}_resultado" value="isento" style="margin-right: 3px;">
                            <label for="${personId}_resultado_isento" style="font-size: 13px;">Isento</label>
                        </span>
                        <span style="display: flex; align-items: center;">
                            <input type="radio" id="${personId}_resultado_naosei" name="${personId}_resultado" value="nao_sei" style="margin-right: 3px;">
                            <label for="${personId}_resultado_naosei" style="font-size: 13px;">Não Sei Informar</label>
                        </span>
                    </div>
                </div>
            </div>
        `;
        entryDiv.dataset.personName = preenchedor.nome;
        entryDiv.dataset.personType = preenchedor.tipo;
        container.appendChild(entryDiv);
        
        // Adicionar evento para mostrar/ocultar perguntas adicionais
        const simRadio = entryDiv.querySelector(`#${personId}_sim`);
        const naoRadio = entryDiv.querySelector(`#${personId}_nao`);
        const additionalQuestions = entryDiv.querySelector('.imposto-renda-additional-questions');
        
        simRadio.addEventListener('change', function() {
            if (this.checked) {
                additionalQuestions.style.display = 'block';
            }
        });
        
        naoRadio.addEventListener('change', function() {
            if (this.checked) {
                additionalQuestions.style.display = 'none';
            }
        });
    }
    
    // Perguntas para outras pessoas com renda
    pessoasComRenda.filter(p => p.tipo === "outra_pessoa_renda").forEach(pessoa => {
        const personId = `imposto_renda_${pessoa.id}`;
        const entryDiv = document.createElement("div");
        entryDiv.classList.add("imposto-renda-entry");
        entryDiv.style.marginBottom = "1rem";
        entryDiv.innerHTML = `
            <label for="${personId}" style="display: block; margin-bottom: 0.5rem;">${pessoa.nome} declara imposto de renda?</label>
            <div class="radio-options-inline" style="display: flex; align-items: center; flex-wrap: nowrap; width: 100%;">
                <span style="margin-right: 20px; display: flex; align-items: center;">
                    <input type="radio" id="${personId}_sim" name="${personId}" value="sim" style="margin-right: 5px;">
                    <label for="${personId}_sim" style="font-size: 14px;">Sim</label>
                </span>
                <span style="margin-right: 20px; display: flex; align-items: center;">
                    <input type="radio" id="${personId}_nao" name="${personId}" value="nao" style="margin-right: 5px;">
                    <label for="${personId}_nao" style="font-size: 14px;">Não</label>
                </span>
                <span style="display: flex; align-items: center;">
                    <input type="radio" id="${personId}_naosei" name="${personId}" value="nao_sei" style="margin-right: 5px;">
                    <label for="${personId}_naosei" style="font-size: 14px;">Não Sei Informar</label>
                </span>
            </div>
            <div class="imposto-renda-additional-questions" style="display: none; margin-top: 1rem; margin-left: 1.5rem; padding-left: 1rem; border-left: 2px solid #ddd;">
                <div style="margin-bottom: 0.8rem;">
                    <label for="${personId}_tipo" style="display: block; margin-bottom: 0.5rem;">Qual o tipo?</label>
                    <div class="radio-options-inline" style="display: flex; align-items: center; flex-wrap: nowrap; width: 100%;">
                        <span style="margin-right: 15px; display: flex; align-items: center;">
                            <input type="radio" id="${personId}_tipo_simples" name="${personId}_tipo" value="simples" style="margin-right: 3px;">
                            <label for="${personId}_tipo_simples" style="font-size: 13px;">Simples</label>
                        </span>
                        <span style="margin-right: 15px; display: flex; align-items: center;">
                            <input type="radio" id="${personId}_tipo_completa" name="${personId}_tipo" value="completa" style="margin-right: 3px;">
                            <label for="${personId}_tipo_completa" style="font-size: 13px;">Dedução Completa</label>
                        </span>
                        <span style="display: flex; align-items: center;">
                            <input type="radio" id="${personId}_tipo_naosei" name="${personId}_tipo" value="nao_sei" style="margin-right: 3px;">
                            <label for="${personId}_tipo_naosei" style="font-size: 13px;">Não Sei Informar</label>
                        </span>
                    </div>
                </div>
                <div>
                    <label for="${personId}_resultado" style="display: block; margin-bottom: 0.5rem;">Qual o resultado?</label>
                    <div class="radio-options-inline" style="display: flex; align-items: center; flex-wrap: nowrap; width: 100%;">
                        <span style="margin-right: 15px; display: flex; align-items: center;">
                            <input type="radio" id="${personId}_resultado_paga" name="${personId}_resultado" value="paga" style="margin-right: 3px;">
                            <label for="${personId}_resultado_paga" style="font-size: 13px;">Paga</label>
                        </span>
                        <span style="margin-right: 15px; display: flex; align-items: center;">
                            <input type="radio" id="${personId}_resultado_recebe" name="${personId}_resultado" value="recebe" style="margin-right: 3px;">
                            <label for="${personId}_resultado_recebe" style="font-size: 13px;">Recebe</label>
                        </span>
                        <span style="margin-right: 15px; display: flex; align-items: center;">
                            <input type="radio" id="${personId}_resultado_isento" name="${personId}_resultado" value="isento" style="margin-right: 3px;">
                            <label for="${personId}_resultado_isento" style="font-size: 13px;">Isento</label>
                        </span>
                        <span style="display: flex; align-items: center;">
                            <input type="radio" id="${personId}_resultado_naosei" name="${personId}_resultado" value="nao_sei" style="margin-right: 3px;">
                            <label for="${personId}_resultado_naosei" style="font-size: 13px;">Não Sei Informar</label>
                        </span>
                    </div>
                </div>
            </div>
        `;
        entryDiv.dataset.personName = pessoa.nome;
        entryDiv.dataset.personType = pessoa.tipo;
        container.appendChild(entryDiv);
        
        // Adicionar evento para mostrar/ocultar perguntas adicionais
        const simRadio = entryDiv.querySelector(`#${personId}_sim`);
        const naoRadio = entryDiv.querySelector(`#${personId}_nao`);
        const naoSeiRadio = entryDiv.querySelector(`#${personId}_naosei`);
        const additionalQuestions = entryDiv.querySelector('.imposto-renda-additional-questions');
        
        simRadio.addEventListener('change', function() {
            if (this.checked) {
                additionalQuestions.style.display = 'block';
            }
        });
        
        naoRadio.addEventListener('change', function() {
            if (this.checked) {
                additionalQuestions.style.display = 'none';
            }
        });
        
        naoSeiRadio.addEventListener('change', function() {
            if (this.checked) {
                additionalQuestions.style.display = 'none';
            }
        });
    });
    
    restoreImpostoRendaSelections();
}

// Função para salvar as seleções de orçamento
function saveOrcamentoSelections() {
    const container = document.getElementById("orcamento-section-content");
    if (!container) return;
    orcamentoSelections = {};
    
    // Salvar tipo de orçamento (conjunto ou individual)
    const tipoOrcamentoRadios = container.querySelectorAll('input[name="tipo_orcamento"]');
    tipoOrcamentoRadios.forEach(radio => {
        if (radio.checked) {
            orcamentoSelections.tipo_orcamento = radio.value;
        }
    });
    
    // Salvar valores de orçamento conjunto
    const orcamentoConjuntoDiv = container.querySelector('#orcamento-conjunto');
    if (orcamentoConjuntoDiv) {
        const entradasInput = orcamentoConjuntoDiv.querySelector('input[name="orcamento_conjunto_entradas"]');
        const despesasFixasInput = orcamentoConjuntoDiv.querySelector('input[name="orcamento_conjunto_despesas_fixas"]');
        const despesasVariaveisInput = orcamentoConjuntoDiv.querySelector('input[name="orcamento_conjunto_despesas_variaveis"]');
        const valorPoupadoInput = orcamentoConjuntoDiv.querySelector('input[name="orcamento_conjunto_valor_poupado"]');
        
        if (entradasInput) orcamentoSelections.orcamento_conjunto_entradas = entradasInput.value;
        if (despesasFixasInput) orcamentoSelections.orcamento_conjunto_despesas_fixas = despesasFixasInput.value;
        if (despesasVariaveisInput) orcamentoSelections.orcamento_conjunto_despesas_variaveis = despesasVariaveisInput.value;
        if (valorPoupadoInput) orcamentoSelections.orcamento_conjunto_valor_poupado = valorPoupadoInput.value;
    }
    
    // Salvar valores de orçamento individual
    container.querySelectorAll('.orcamento-individual-entry').forEach(entry => {
        const personId = entry.dataset.personId;
        if (!personId) return;
        
        const entradasInput = entry.querySelector(`input[name="orcamento_${personId}_entradas"]`);
        const despesasFixasInput = entry.querySelector(`input[name="orcamento_${personId}_despesas_fixas"]`);
        const despesasVariaveisInput = entry.querySelector(`input[name="orcamento_${personId}_despesas_variaveis"]`);
        const valorPoupadoInput = entry.querySelector(`input[name="orcamento_${personId}_valor_poupado"]`);
        
        if (entradasInput) orcamentoSelections[`orcamento_${personId}_entradas`] = entradasInput.value;
        if (despesasFixasInput) orcamentoSelections[`orcamento_${personId}_despesas_fixas`] = despesasFixasInput.value;
        if (despesasVariaveisInput) orcamentoSelections[`orcamento_${personId}_despesas_variaveis`] = despesasVariaveisInput.value;
        if (valorPoupadoInput) orcamentoSelections[`orcamento_${personId}_valor_poupado`] = valorPoupadoInput.value;
    });
}

// Função para restaurar as seleções de orçamento
function restoreOrcamentoSelections() {
    // Restaurar tipo de orçamento
    if (orcamentoSelections.tipo_orcamento) {
        const tipoRadio = document.querySelector(`input[name="tipo_orcamento"][value="${orcamentoSelections.tipo_orcamento}"]`);
        if (tipoRadio) {
            tipoRadio.checked = true;
            // Mostrar/ocultar seções correspondentes
            const orcamentoConjuntoDiv = document.getElementById('orcamento-conjunto');
            const orcamentoIndividualDiv = document.getElementById('orcamento-individual');
            if (orcamentoConjuntoDiv && orcamentoIndividualDiv) {
                if (orcamentoSelections.tipo_orcamento === 'conjunto') {
                    orcamentoConjuntoDiv.style.display = 'block';
                    orcamentoIndividualDiv.style.display = 'none';
                } else {
                    orcamentoConjuntoDiv.style.display = 'none';
                    orcamentoIndividualDiv.style.display = 'block';
                }
            }
        }
    }
    
    // Restaurar valores de orçamento conjunto
    Object.keys(orcamentoSelections).forEach(key => {
        if (key.startsWith('orcamento_conjunto_')) {
            const input = document.querySelector(`input[name="${key}"]`);
            if (input) input.value = orcamentoSelections[key];
        }
    });
    
    // Restaurar valores de orçamento individual
    Object.keys(orcamentoSelections).forEach(key => {
        if (key.startsWith('orcamento_') && !key.startsWith('orcamento_conjunto_')) {
            const input = document.querySelector(`input[name="${key}"]`);
            if (input) input.value = orcamentoSelections[key];
        }
    });
    
    // Aplicar formatação de moeda para todos os campos de valor
    document.querySelectorAll('input[data-type="currency"]').forEach(input => {
        if (input.value) {
            input.value = formatCurrency(input.value);
        }
    });
}

// Função para renderizar as perguntas de orçamento
function renderOrcamentoQuestions() {
    saveOrcamentoSelections();
    const container = document.getElementById("orcamento-section-content");
    if (!container) return;
    container.innerHTML = '';
    
    const pessoasComRenda = [];
    const nomeCompletoInput = document.getElementById("nome_completo");
    if (nomeCompletoInput && nomeCompletoInput.value.trim() !== "") {
        pessoasComRenda.push({ id: "preenchedor", nome: sanitizeInput(nomeCompletoInput.value.trim()), tipo: "preenchedor" });
    }
    
    let temOutrasPessoasComRenda = false;
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach((entry, index) => { 
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasComRenda.push({ id: `outra_pessoa_${index}`, nome: sanitizeInput(nomeInput.value.trim()), tipo: "outra_pessoa_renda" });
                temOutrasPessoasComRenda = true;
            }
        });
    }
    
    const tituloOrcamento = document.getElementById("orcamento-section-title");
    if (pessoasComRenda.length === 0) {
        container.innerHTML = "<p>Preencha as informações sobre nome e renda para definir as perguntas sobre orçamento.</p>";
        if(tituloOrcamento) tituloOrcamento.style.display = 'none';
        return;
    }
    
    if(tituloOrcamento) tituloOrcamento.style.display = 'block';
    
    // Lógica condicional: se há apenas o preenchedor com renda, mostrar diretamente os campos individuais
    // Se há mais pessoas com renda, mostrar opção de escolha entre conjunto e individual
    if (pessoasComRenda.length === 1 && pessoasComRenda[0].tipo === "preenchedor") {
        // Apenas o preenchedor tem renda - mostrar campos individuais diretamente
        renderOrcamentoIndividual(container, pessoasComRenda);
    } else {
        // Há mais pessoas com renda - mostrar opção de escolha
        container.innerHTML = `
            <div style="margin-bottom: 1.5rem;">
                <label style="display: block; margin-bottom: 0.5rem;">Como deseja informar o orçamento?</label>
                <div class="radio-options-inline" style="display: flex; align-items: center; flex-wrap: nowrap; width: 100%;">
                    <span style="margin-right: 20px; display: flex; align-items: center;">
                        <input type="radio" id="orcamento_tipo_conjunto" name="tipo_orcamento" value="conjunto" style="margin-right: 5px;">
                        <label for="orcamento_tipo_conjunto" style="font-size: 14px;">Orçamento conjunto da casa</label>
                    </span>
                    <span style="display: flex; align-items: center;">
                        <input type="radio" id="orcamento_tipo_individual" name="tipo_orcamento" value="individual" style="margin-right: 5px;">
                        <label for="orcamento_tipo_individual" style="font-size: 14px;">Orçamento individual por pessoa</label>
                    </span>
                </div>
            </div>
            
            <div id="orcamento-conjunto" style="display: none;">
                <div style="margin-bottom: 1rem;">
                    <label for="orcamento_conjunto_entradas" style="display: block; margin-bottom: 0.5rem;">Entradas totais mensais (R$)</label>
                    <input type="text" id="orcamento_conjunto_entradas" name="orcamento_conjunto_entradas" class="form-input" data-type="currency" placeholder="R$ 0,00" style="width: 100%;">
                </div>
                <div style="margin-bottom: 1rem;">
                    <label for="orcamento_conjunto_despesas_fixas" style="display: block; margin-bottom: 0.5rem;">Despesas fixas mensais (R$)</label>
                    <input type="text" id="orcamento_conjunto_despesas_fixas" name="orcamento_conjunto_despesas_fixas" class="form-input" data-type="currency" placeholder="R$ 0,00" style="width: 100%;">
                </div>
                <div style="margin-bottom: 1rem;">
                    <label for="orcamento_conjunto_despesas_variaveis" style="display: block; margin-bottom: 0.5rem;">Despesas variáveis mensais (R$)</label>
                    <input type="text" id="orcamento_conjunto_despesas_variaveis" name="orcamento_conjunto_despesas_variaveis" class="form-input" data-type="currency" placeholder="R$ 0,00" style="width: 100%;">
                </div>
                <div style="margin-bottom: 1rem;">
                    <label for="orcamento_conjunto_valor_poupado" style="display: block; margin-bottom: 0.5rem;">Valor poupado/investido mensal (R$)</label>
                    <input type="text" id="orcamento_conjunto_valor_poupado" name="orcamento_conjunto_valor_poupado" class="form-input" data-type="currency" placeholder="R$ 0,00" style="width: 100%;">
                </div>
            </div>
            
            <div id="orcamento-individual" style="display: none;">
                <!-- Será preenchido dinamicamente -->
            </div>
        `;
        
        // Adicionar eventos para mostrar/ocultar seções correspondentes
        const conjuntoRadio = container.querySelector('#orcamento_tipo_conjunto');
        const individualRadio = container.querySelector('#orcamento_tipo_individual');
        const orcamentoConjuntoDiv = container.querySelector('#orcamento-conjunto');
        const orcamentoIndividualDiv = container.querySelector('#orcamento-individual');
        
        conjuntoRadio.addEventListener('change', function() {
            if (this.checked) {
                orcamentoConjuntoDiv.style.display = 'block';
                orcamentoIndividualDiv.style.display = 'none';
            }
        });
        
        individualRadio.addEventListener('change', function() {
            if (this.checked) {
                orcamentoConjuntoDiv.style.display = 'none';
                orcamentoIndividualDiv.style.display = 'block';
                renderOrcamentoIndividual(orcamentoIndividualDiv, pessoasComRenda);
            }
        });
        
        // Se já tiver uma seleção anterior, aplicar
        if (orcamentoSelections.tipo_orcamento === 'individual') {
            individualRadio.checked = true;
            orcamentoConjuntoDiv.style.display = 'none';
            orcamentoIndividualDiv.style.display = 'block';
            renderOrcamentoIndividual(orcamentoIndividualDiv, pessoasComRenda);
        } else {
            // Por padrão, selecionar orçamento conjunto
            conjuntoRadio.checked = true;
            orcamentoConjuntoDiv.style.display = 'block';
            orcamentoIndividualDiv.style.display = 'none';
        }
    }
    
    // Adicionar eventos de formatação de moeda para todos os campos de valor
    container.querySelectorAll('input[data-type="currency"]').forEach(input => {
        input.addEventListener('focus', function() {
            let value = this.value.replace(/[^\d]/g, '');
            if (value) {
                value = (parseFloat(value) / 100).toFixed(2).replace('.', ',');
                this.value = value;
            } else {
                this.value = '';
            }
        });
        
        input.addEventListener('blur', function() {
            if (this.value) {
                this.value = formatCurrency(this.value);
            }
        });
        
        input.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9,]/g, '');
        });
    });
    
    restoreOrcamentoSelections();
}

// Função auxiliar para renderizar campos de orçamento individual
function renderOrcamentoIndividual(container, pessoasComRenda) {
    if (!container) return;
    
    // Se for o contêiner principal, criar um div para orçamento individual
    let orcamentoIndividualDiv = container;
    if (container.id === "orcamento-section-content") {
        orcamentoIndividualDiv = document.createElement("div");
        orcamentoIndividualDiv.id = "orcamento-individual";
        container.appendChild(orcamentoIndividualDiv);
    } else {
        // Limpar o contêiner existente
        orcamentoIndividualDiv.innerHTML = '';
    }
    
    // Renderizar campos para cada pessoa com renda
    pessoasComRenda.forEach(pessoa => {
        const entryDiv = document.createElement("div");
        entryDiv.classList.add("orcamento-individual-entry");
        entryDiv.dataset.personId = pessoa.id;
        entryDiv.dataset.personName = pessoa.nome;
        entryDiv.style.marginBottom = "1.5rem";
        
        const nomeExibicao = pessoa.tipo === "preenchedor" ? "Você" : pessoa.nome;
        
        entryDiv.innerHTML = `
            <h4 style="margin-bottom: 1rem; font-weight: bold;">${nomeExibicao}</h4>
            <div style="margin-bottom: 1rem;">
                <label for="orcamento_${pessoa.id}_entradas" style="display: block; margin-bottom: 0.5rem;">Entradas totais mensais (R$)</label>
                <input type="text" id="orcamento_${pessoa.id}_entradas" name="orcamento_${pessoa.id}_entradas" class="form-input" data-type="currency" placeholder="R$ 0,00" style="width: 100%;">
            </div>
            <div style="margin-bottom: 1rem;">
                <label for="orcamento_${pessoa.id}_despesas_fixas" style="display: block; margin-bottom: 0.5rem;">Despesas fixas mensais (R$)</label>
                <input type="text" id="orcamento_${pessoa.id}_despesas_fixas" name="orcamento_${pessoa.id}_despesas_fixas" class="form-input" data-type="currency" placeholder="R$ 0,00" style="width: 100%;">
            </div>
            <div style="margin-bottom: 1rem;">
                <label for="orcamento_${pessoa.id}_despesas_variaveis" style="display: block; margin-bottom: 0.5rem;">Despesas variáveis mensais (R$)</label>
                <input type="text" id="orcamento_${pessoa.id}_despesas_variaveis" name="orcamento_${pessoa.id}_despesas_variaveis" class="form-input" data-type="currency" placeholder="R$ 0,00" style="width: 100%;">
            </div>
            <div style="margin-bottom: 1rem;">
                <label for="orcamento_${pessoa.id}_valor_poupado" style="display: block; margin-bottom: 0.5rem;">Valor poupado/investido mensal (R$)</label>
                <input type="text" id="orcamento_${pessoa.id}_valor_poupado" name="orcamento_${pessoa.id}_valor_poupado" class="form-input" data-type="currency" placeholder="R$ 0,00" style="width: 100%;">
            </div>
        `;
        
        orcamentoIndividualDiv.appendChild(entryDiv);
    });
}

function savePlanoSaudeSelections() {
    const container = document.getElementById("plano-saude-section-content");
    if (!container) return;
    planoSaudeSelections = {};
    
    // Salvar seleção principal
    const temPlanoSaudeRadios = container.querySelectorAll('input[name="tem_plano_saude"]');
    temPlanoSaudeRadios.forEach(radio => {
        if (radio.checked) {
            planoSaudeSelections.tem_plano_saude = radio.value;
        }
    });
    
    // Salvar seleções de tipo de plano
    const tipoPlanoRadios = container.querySelectorAll('input[name="tipo_plano_saude"]');
    tipoPlanoRadios.forEach(radio => {
        if (radio.checked) {
            planoSaudeSelections.tipo_plano_saude = radio.value;
        }
    });
    
    // Salvar seleções de cobertura
    const coberturaPlanoRadios = container.querySelectorAll('input[name="cobertura_plano_saude"]');
    coberturaPlanoRadios.forEach(radio => {
        if (radio.checked) {
            planoSaudeSelections.cobertura_plano_saude = radio.value;
        }
    });
    
    // Salvar valor do plano
    const valorPlanoInput = container.querySelector('input[name="valor_plano_saude"]');
    if (valorPlanoInput) {
        planoSaudeSelections.valor_plano_saude = valorPlanoInput.value;
    }
}

function restorePlanoSaudeSelections() {
    // Restaurar seleção principal
    if (planoSaudeSelections.tem_plano_saude) {
        const radio = document.querySelector(`input[name="tem_plano_saude"][value="${planoSaudeSelections.tem_plano_saude}"]`);
        if (radio) {
            radio.checked = true;
            // Mostrar/ocultar detalhes do plano
            const detalhesPlano = document.getElementById("detalhes-plano-saude");
            if (detalhesPlano) {
                detalhesPlano.style.display = planoSaudeSelections.tem_plano_saude === "sim" ? "block" : "none";
            }
        }
    }
    
    // Restaurar seleções de tipo de plano
    if (planoSaudeSelections.tipo_plano_saude) {
        const radio = document.querySelector(`input[name="tipo_plano_saude"][value="${planoSaudeSelections.tipo_plano_saude}"]`);
        if (radio) radio.checked = true;
    }
    
    // Restaurar seleções de cobertura
    if (planoSaudeSelections.cobertura_plano_saude) {
        const radio = document.querySelector(`input[name="cobertura_plano_saude"][value="${planoSaudeSelections.cobertura_plano_saude}"]`);
        if (radio) radio.checked = true;
    }
    
    // Restaurar valor do plano
    if (planoSaudeSelections.valor_plano_saude) {
        const input = document.querySelector('input[name="valor_plano_saude"]');
        if (input) input.value = planoSaudeSelections.valor_plano_saude;
    }
}

function renderPlanoSaudeQuestions() {
    savePlanoSaudeSelections();
    const container = document.getElementById("plano-saude-section-content");
    if (!container) return;
    
    const rendaUnicaSimRadio = document.getElementById("renda_unica_sim");
    const outrasPessoasInputs = document.querySelectorAll('#pessoas-list input[name="pessoa_nome"]');
    let temOutrasPessoasComRenda = false;
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        outrasPessoasInputs.forEach(input => {
            if (input.value.trim() !== "") {
                temOutrasPessoasComRenda = true;
            }
        });
    }
    
    let labelText = "Você possui plano de saúde?";
    if (temOutrasPessoasComRenda) {
        labelText = "Vocês possuem plano de saúde?";
    }
    
    container.innerHTML = `
        <div style="margin-bottom: 1rem;">
            <label id="label_tem_plano_saude" style="display: block; margin-bottom: 0.5rem;">${labelText}</label>
            <div style="display: flex; align-items: center;">
                <span style="margin-right: 20px; display: flex; align-items: center;">
                    <input type="radio" id="tem_plano_saude_sim" name="tem_plano_saude" value="sim" required style="margin-right: 5px;">
                    <label for="tem_plano_saude_sim">Sim</label>
                </span>
                <span style="display: flex; align-items: center;">
                    <input type="radio" id="tem_plano_saude_nao" name="tem_plano_saude" value="nao" style="margin-right: 5px;">
                    <label for="tem_plano_saude_nao">Não</label>
                </span>
            </div>
        </div>
        
        <div id="detalhes-plano-saude" style="display: none; margin-left: 1.5rem; padding-left: 1rem; border-left: 2px solid #ddd;">
            <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem;">Tipo de plano:</label>
                <div style="display: flex; flex-wrap: wrap;">
                    <span style="margin-right: 20px; margin-bottom: 10px; display: flex; align-items: center;">
                        <input type="radio" id="tipo_plano_saude_individual" name="tipo_plano_saude" value="individual" style="margin-right: 5px;">
                        <label for="tipo_plano_saude_individual">Individual</label>
                    </span>
                    <span style="margin-right: 20px; margin-bottom: 10px; display: flex; align-items: center;">
                        <input type="radio" id="tipo_plano_saude_familiar" name="tipo_plano_saude" value="familiar" style="margin-right: 5px;">
                        <label for="tipo_plano_saude_familiar">Familiar</label>
                    </span>
                    <span style="margin-right: 20px; margin-bottom: 10px; display: flex; align-items: center;">
                        <input type="radio" id="tipo_plano_saude_empresarial" name="tipo_plano_saude" value="empresarial" style="margin-right: 5px;">
                        <label for="tipo_plano_saude_empresarial">Empresarial</label>
                    </span>
                    <span style="margin-bottom: 10px; display: flex; align-items: center;">
                        <input type="radio" id="tipo_plano_saude_nao_sei" name="tipo_plano_saude" value="nao_sei" style="margin-right: 5px;">
                        <label for="tipo_plano_saude_nao_sei">Não sei informar</label>
                    </span>
                </div>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem;">Cobertura:</label>
                <div style="display: flex; flex-wrap: wrap;">
                    <span style="margin-right: 20px; margin-bottom: 10px; display: flex; align-items: center;">
                        <input type="radio" id="cobertura_plano_saude_basica" name="cobertura_plano_saude" value="basica" style="margin-right: 5px;">
                        <label for="cobertura_plano_saude_basica">Básica</label>
                    </span>
                    <span style="margin-right: 20px; margin-bottom: 10px; display: flex; align-items: center;">
                        <input type="radio" id="cobertura_plano_saude_intermediaria" name="cobertura_plano_saude" value="intermediaria" style="margin-right: 5px;">
                        <label for="cobertura_plano_saude_intermediaria">Intermediária</label>
                    </span>
                    <span style="margin-right: 20px; margin-bottom: 10px; display: flex; align-items: center;">
                        <input type="radio" id="cobertura_plano_saude_completa" name="cobertura_plano_saude" value="completa" style="margin-right: 5px;">
                        <label for="cobertura_plano_saude_completa">Completa</label>
                    </span>
                    <span style="margin-bottom: 10px; display: flex; align-items: center;">
                        <input type="radio" id="cobertura_plano_saude_nao_sei" name="cobertura_plano_saude" value="nao_sei" style="margin-right: 5px;">
                        <label for="cobertura_plano_saude_nao_sei">Não sei informar</label>
                    </span>
                </div>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <label for="valor_plano_saude" style="display: block; margin-bottom: 0.5rem;">Valor mensal aproximado:</label>
                <input type="text" id="valor_plano_saude" name="valor_plano_saude" class="form-input" data-type="currency" placeholder="R$ 0,00" style="width: 100%; max-width: 300px;">
            </div>
        </div>
    `;
    
    // Adicionar eventos para mostrar/ocultar detalhes do plano
    const simRadio = container.querySelector('#tem_plano_saude_sim');
    const naoRadio = container.querySelector('#tem_plano_saude_nao');
    const detalhesPlano = container.querySelector('#detalhes-plano-saude');
    
    simRadio.addEventListener('change', function() {
        if (this.checked) {
            detalhesPlano.style.display = 'block';
        }
    });
    
    naoRadio.addEventListener('change', function() {
        if (this.checked) {
            detalhesPlano.style.display = 'none';
        }
    });
    
    // Adicionar evento de formatação de moeda para o campo de valor
    const valorPlanoInput = container.querySelector('#valor_plano_saude');
    valorPlanoInput.addEventListener('focus', function() {
        let value = this.value.replace(/[^\d]/g, '');
        if (value) {
            value = (parseFloat(value) / 100).toFixed(2).replace('.', ',');
            this.value = value;
        } else {
            this.value = '';
        }
    });
    
    valorPlanoInput.addEventListener('blur', function() {
        if (this.value) {
            this.value = formatCurrency(this.value);
        }
    });
    
    valorPlanoInput.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9,]/g, '');
    });
    
    restorePlanoSaudeSelections();
}

function saveSeguroVidaSelections() {
    const container = document.getElementById("seguro-vida-section-content");
    if (!container) return;
    seguroVidaSelections = {};
    
    // Salvar seleção principal
    const temSeguroVidaRadios = container.querySelectorAll('input[name="tem_seguro_vida"]');
    temSeguroVidaRadios.forEach(radio => {
        if (radio.checked) {
            seguroVidaSelections.tem_seguro_vida = radio.value;
        }
    });
    
    // Salvar seleções de tipo de seguro
    const tipoSeguroRadios = container.querySelectorAll('input[name="tipo_seguro_vida"]');
    tipoSeguroRadios.forEach(radio => {
        if (radio.checked) {
            seguroVidaSelections.tipo_seguro_vida = radio.value;
        }
    });
    
    // Salvar seleções de cobertura
    const coberturaSeguroRadios = container.querySelectorAll('input[name="cobertura_seguro_vida"]');
    coberturaSeguroRadios.forEach(radio => {
        if (radio.checked) {
            seguroVidaSelections.cobertura_seguro_vida = radio.value;
        }
    });
    
    // Salvar valor do seguro
    const valorSeguroInput = container.querySelector('input[name="valor_seguro_vida"]');
    if (valorSeguroInput) {
        seguroVidaSelections.valor_seguro_vida = valorSeguroInput.value;
    }
}

function restoreSeguroVidaSelections() {
    // Restaurar seleção principal
    if (seguroVidaSelections.tem_seguro_vida) {
        const radio = document.querySelector(`input[name="tem_seguro_vida"][value="${seguroVidaSelections.tem_seguro_vida}"]`);
        if (radio) {
            radio.checked = true;
            // Mostrar/ocultar detalhes do seguro
            const detalhesSeguro = document.getElementById("detalhes-seguro-vida");
            if (detalhesSeguro) {
                detalhesSeguro.style.display = seguroVidaSelections.tem_seguro_vida === "sim" ? "block" : "none";
            }
        }
    }
    
    // Restaurar seleções de tipo de seguro
    if (seguroVidaSelections.tipo_seguro_vida) {
        const radio = document.querySelector(`input[name="tipo_seguro_vida"][value="${seguroVidaSelections.tipo_seguro_vida}"]`);
        if (radio) radio.checked = true;
    }
    
    // Restaurar seleções de cobertura
    if (seguroVidaSelections.cobertura_seguro_vida) {
        const radio = document.querySelector(`input[name="cobertura_seguro_vida"][value="${seguroVidaSelections.cobertura_seguro_vida}"]`);
        if (radio) radio.checked = true;
    }
    
    // Restaurar valor do seguro
    if (seguroVidaSelections.valor_seguro_vida) {
        const input = document.querySelector('input[name="valor_seguro_vida"]');
        if (input) input.value = seguroVidaSelections.valor_seguro_vida;
    }
}

function renderSeguroVidaQuestions() {
    saveSeguroVidaSelections();
    const container = document.getElementById("seguro-vida-section-content");
    if (!container) return;
    
    const rendaUnicaSimRadio = document.getElementById("renda_unica_sim");
    const outrasPessoasInputs = document.querySelectorAll('#pessoas-list input[name="pessoa_nome"]');
    let temOutrasPessoasComRenda = false;
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        outrasPessoasInputs.forEach(input => {
            if (input.value.trim() !== "") {
                temOutrasPessoasComRenda = true;
            }
        });
    }
    
    let labelText = "Você possui seguro de vida?";
    if (temOutrasPessoasComRenda) {
        labelText = "Vocês possuem seguro de vida?";
    }
    
    container.innerHTML = `
        <div style="margin-bottom: 1rem;">
            <label id="label_tem_seguro_vida" style="display: block; margin-bottom: 0.5rem;">${labelText}</label>
            <div style="display: flex; align-items: center;">
                <span style="margin-right: 20px; display: flex; align-items: center;">
                    <input type="radio" id="tem_seguro_vida_sim" name="tem_seguro_vida" value="sim" required style="margin-right: 5px;">
                    <label for="tem_seguro_vida_sim">Sim</label>
                </span>
                <span style="display: flex; align-items: center;">
                    <input type="radio" id="tem_seguro_vida_nao" name="tem_seguro_vida" value="nao" style="margin-right: 5px;">
                    <label for="tem_seguro_vida_nao">Não</label>
                </span>
            </div>
        </div>
        
        <div id="detalhes-seguro-vida" style="display: none; margin-left: 1.5rem; padding-left: 1rem; border-left: 2px solid #ddd;">
            <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem;">Tipo de seguro:</label>
                <div style="display: flex; flex-wrap: wrap;">
                    <span style="margin-right: 20px; margin-bottom: 10px; display: flex; align-items: center;">
                        <input type="radio" id="tipo_seguro_vida_individual" name="tipo_seguro_vida" value="individual" style="margin-right: 5px;">
                        <label for="tipo_seguro_vida_individual">Individual</label>
                    </span>
                    <span style="margin-right: 20px; margin-bottom: 10px; display: flex; align-items: center;">
                        <input type="radio" id="tipo_seguro_vida_familiar" name="tipo_seguro_vida" value="familiar" style="margin-right: 5px;">
                        <label for="tipo_seguro_vida_familiar">Familiar</label>
                    </span>
                    <span style="margin-right: 20px; margin-bottom: 10px; display: flex; align-items: center;">
                        <input type="radio" id="tipo_seguro_vida_empresarial" name="tipo_seguro_vida" value="empresarial" style="margin-right: 5px;">
                        <label for="tipo_seguro_vida_empresarial">Empresarial</label>
                    </span>
                    <span style="margin-bottom: 10px; display: flex; align-items: center;">
                        <input type="radio" id="tipo_seguro_vida_nao_sei" name="tipo_seguro_vida" value="nao_sei" style="margin-right: 5px;">
                        <label for="tipo_seguro_vida_nao_sei">Não sei informar</label>
                    </span>
                </div>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem;">Cobertura:</label>
                <div style="display: flex; flex-wrap: wrap;">
                    <span style="margin-right: 20px; margin-bottom: 10px; display: flex; align-items: center;">
                        <input type="radio" id="cobertura_seguro_vida_basica" name="cobertura_seguro_vida" value="basica" style="margin-right: 5px;">
                        <label for="cobertura_seguro_vida_basica">Básica</label>
                    </span>
                    <span style="margin-right: 20px; margin-bottom: 10px; display: flex; align-items: center;">
                        <input type="radio" id="cobertura_seguro_vida_intermediaria" name="cobertura_seguro_vida" value="intermediaria" style="margin-right: 5px;">
                        <label for="cobertura_seguro_vida_intermediaria">Intermediária</label>
                    </span>
                    <span style="margin-right: 20px; margin-bottom: 10px; display: flex; align-items: center;">
                        <input type="radio" id="cobertura_seguro_vida_completa" name="cobertura_seguro_vida" value="completa" style="margin-right: 5px;">
                        <label for="cobertura_seguro_vida_completa">Completa</label>
                    </span>
                    <span style="margin-bottom: 10px; display: flex; align-items: center;">
                        <input type="radio" id="cobertura_seguro_vida_nao_sei" name="cobertura_seguro_vida" value="nao_sei" style="margin-right: 5px;">
                        <label for="cobertura_seguro_vida_nao_sei">Não sei informar</label>
                    </span>
                </div>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <label for="valor_seguro_vida" style="display: block; margin-bottom: 0.5rem;">Valor mensal aproximado:</label>
                <input type="text" id="valor_seguro_vida" name="valor_seguro_vida" class="form-input" data-type="currency" placeholder="R$ 0,00" style="width: 100%; max-width: 300px;">
            </div>
        </div>
    `;
    
    // Adicionar eventos para mostrar/ocultar detalhes do seguro
    const simRadio = container.querySelector('#tem_seguro_vida_sim');
    const naoRadio = container.querySelector('#tem_seguro_vida_nao');
    const detalhesSeguro = container.querySelector('#detalhes-seguro-vida');
    
    simRadio.addEventListener('change', function() {
        if (this.checked) {
            detalhesSeguro.style.display = 'block';
        }
    });
    
    naoRadio.addEventListener('change', function() {
        if (this.checked) {
            detalhesSeguro.style.display = 'none';
        }
    });
    
    // Adicionar evento de formatação de moeda para o campo de valor
    const valorSeguroInput = container.querySelector('#valor_seguro_vida');
    valorSeguroInput.addEventListener('focus', function() {
        let value = this.value.replace(/[^\d]/g, '');
        if (value) {
            value = (parseFloat(value) / 100).toFixed(2).replace('.', ',');
            this.value = value;
        } else {
            this.value = '';
        }
    });
    
    valorSeguroInput.addEventListener('blur', function() {
        if (this.value) {
            this.value = formatCurrency(this.value);
        }
    });
    
    valorSeguroInput.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9,]/g, '');
    });
    
    restoreSeguroVidaSelections();
}

function updateDynamicFormSections() {
    updatePerguntaDependentesLabel();
    updatePerguntaPatrimonioFisicoLabel();
    updatePerguntaPatrimonioLiquidoLabel();
    updatePerguntaDividasLabel();
    renderPlanoSaudeQuestions();
    renderSeguroVidaQuestions();
    renderImpostoRendaQuestions();
    renderOrcamentoQuestions();
}

function addPessoaComRenda() {
    const pessoasList = document.getElementById("pessoas-list");
    if (!pessoasList) return;
    
    const newIndex = pessoasList.querySelectorAll(".dynamic-entry-item").length;
    const newEntryItem = document.createElement("div");
    newEntryItem.classList.add("dynamic-entry-item");
    newEntryItem.style.marginBottom = "1rem";
    newEntryItem.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
            <input type="text" name="pessoa_nome" class="form-input" placeholder="Nome" style="flex: 1; margin-right: 0.5rem;" oninput="this.value = capitalizeName(this.value); updateDynamicFormSections();">
            <button type="button" class="btn-remove" onclick="removePessoaComRenda(this)" style="background-color: #dc3545; color: white; border: none; border-radius: 4px; padding: 0.5rem 1rem; cursor: pointer;">Remover</button>
        </div>
    `;
    
    pessoasList.appendChild(newEntryItem);
    updateDynamicFormSections();
}

function removePessoaComRenda(button) {
    const entryItem = button.closest(".dynamic-entry-item");
    if (entryItem) {
        entryItem.remove();
        updateDynamicFormSections();
    }
}

function addDependente() {
    const dependentesList = document.getElementById("dependentes-list");
    if (!dependentesList) return;
    
    const newIndex = dependentesList.querySelectorAll(".dynamic-entry-item").length;
    const newEntryItem = document.createElement("div");
    newEntryItem.classList.add("dynamic-entry-item");
    newEntryItem.style.marginBottom = "1rem";
    newEntryItem.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
            <input type="text" name="dependente_nome" class="form-input" placeholder="Nome" style="flex: 1; margin-right: 0.5rem;" oninput="this.value = capitalizeName(this.value)">
            <input type="number" name="dependente_idade" class="form-input" placeholder="Idade" style="width: 80px; margin-right: 0.5rem;" min="0" max="120">
            <select name="dependente_relacao" class="form-select" style="width: 120px; margin-right: 0.5rem;">
                <option value="">Relação</option>
                <option value="Filho(a)">Filho(a)</option>
                <option value="Cônjuge">Cônjuge</option>
                <option value="Pai/Mãe">Pai/Mãe</option>
                <option value="Irmão(ã)">Irmão(ã)</option>
                <option value="Avô/Avó">Avô/Avó</option>
                <option value="Neto(a)">Neto(a)</option>
                <option value="Sobrinho(a)">Sobrinho(a)</option>
                <option value="Tio(a)">Tio(a)</option>
                <option value="Primo(a)">Primo(a)</option>
                <option value="Enteado(a)">Enteado(a)</option>
                <option value="Sogro(a)">Sogro(a)</option>
                <option value="Cunhado(a)">Cunhado(a)</option>
                <option value="Pet">Pet</option>
                <option value="Outro">Outro</option>
            </select>
            <button type="button" class="btn-remove" onclick="removeDependente(this)" style="background-color: #dc3545; color: white; border: none; border-radius: 4px; padding: 0.5rem 1rem; cursor: pointer;">Remover</button>
        </div>
    `;
    
    dependentesList.appendChild(newEntryItem);
}

function removeDependente(button) {
    const entryItem = button.closest(".dynamic-entry-item");
    if (entryItem) {
        entryItem.remove();
    }
}

function addPatrimonioFisico() {
    const patrimoniosList = document.getElementById("patrimonios-list");
    if (!patrimoniosList) return;
    
    const newIndex = patrimoniosList.querySelectorAll(".dynamic-entry-item").length;
    const newEntryItem = document.createElement("div");
    newEntryItem.classList.add("dynamic-entry-item");
    newEntryItem.style.marginBottom = "1rem";
    newEntryItem.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
            <input type="text" name="patrimonio_descricao" class="form-input" placeholder="Descrição" style="flex: 1; margin-right: 0.5rem;">
            <input type="text" name="patrimonio_valor" class="form-input" placeholder="Valor aproximado" style="width: 150px; margin-right: 0.5rem;" data-type="currency" oninput="this.value = this.value.replace(/[^0-9,]/g, '')" onfocus="let value = this.value.replace(/[^\d]/g, ''); if (value) { value = (parseFloat(value) / 100).toFixed(2).replace('.', ','); this.value = value; } else { this.value = ''; }" onblur="if (this.value) { this.value = formatCurrency(this.value); }">
            <button type="button" class="btn-remove" onclick="removePatrimonioFisico(this)" style="background-color: #dc3545; color: white; border: none; border-radius: 4px; padding: 0.5rem 1rem; cursor: pointer;">Remover</button>
        </div>
    `;
    
    patrimoniosList.appendChild(newEntryItem);
}

function removePatrimonioFisico(button) {
    const entryItem = button.closest(".dynamic-entry-item");
    if (entryItem) {
        entryItem.remove();
    }
}

function addPatrimonioLiquido() {
    const patrimoniosList = document.getElementById("patrimonios-liquidos-list");
    if (!patrimoniosList) return;
    
    const newIndex = patrimoniosList.querySelectorAll(".dynamic-entry-item").length;
    const newEntryItem = document.createElement("div");
    newEntryItem.classList.add("dynamic-entry-item");
    newEntryItem.style.marginBottom = "1rem";
    newEntryItem.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
            <input type="text" name="patrimonio_liquido_descricao" class="form-input" placeholder="Descrição" style="flex: 1; margin-right: 0.5rem;">
            <input type="text" name="patrimonio_liquido_valor" class="form-input" placeholder="Valor aproximado" style="width: 150px; margin-right: 0.5rem;" data-type="currency" oninput="this.value = this.value.replace(/[^0-9,]/g, '')" onfocus="let value = this.value.replace(/[^\d]/g, ''); if (value) { value = (parseFloat(value) / 100).toFixed(2).replace('.', ','); this.value = value; } else { this.value = ''; }" onblur="if (this.value) { this.value = formatCurrency(this.value); }">
            <button type="button" class="btn-remove" onclick="removePatrimonioLiquido(this)" style="background-color: #dc3545; color: white; border: none; border-radius: 4px; padding: 0.5rem 1rem; cursor: pointer;">Remover</button>
        </div>
    `;
    
    patrimoniosList.appendChild(newEntryItem);
}

function removePatrimonioLiquido(button) {
    const entryItem = button.closest(".dynamic-entry-item");
    if (entryItem) {
        entryItem.remove();
    }
}

function addDivida() {
    const dividasList = document.getElementById("dividas-list");
    if (!dividasList) return;
    
    const newIndex = dividasList.querySelectorAll(".dynamic-entry-item").length;
    const newEntryItem = document.createElement("div");
    newEntryItem.classList.add("dynamic-entry-item");
    newEntryItem.style.marginBottom = "1rem";
    newEntryItem.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
            <input type="text" name="divida_descricao" class="form-input" placeholder="Descrição" style="flex: 1; margin-right: 0.5rem;">
            <input type="text" name="divida_valor" class="form-input" placeholder="Valor total" style="width: 150px; margin-right: 0.5rem;" data-type="currency" oninput="this.value = this.value.replace(/[^0-9,]/g, '')" onfocus="let value = this.value.replace(/[^\d]/g, ''); if (value) { value = (parseFloat(value) / 100).toFixed(2).replace('.', ','); this.value = value; } else { this.value = ''; }" onblur="if (this.value) { this.value = formatCurrency(this.value); }">
            <button type="button" class="btn-remove" onclick="removeDivida(this)" style="background-color: #dc3545; color: white; border: none; border-radius: 4px; padding: 0.5rem 1rem; cursor: pointer;">Remover</button>
        </div>
    `;
    
    dividasList.appendChild(newEntryItem);
}

function removeDivida(button) {
    const entryItem = button.closest(".dynamic-entry-item");
    if (entryItem) {
        entryItem.remove();
    }
}

function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = section.style.display === "none" ? "block" : "none";
    }
}

function showSuccessMessage(clienteId, clienteNome) {
    formContentEl.style.display = "none";
    messageAreaEl.innerHTML = `
        <div class="message success">
            <h3>Formulário enviado com sucesso!</h3>
            <p>Obrigado por preencher o formulário. Suas respostas foram registradas.</p>
        </div>
    `;
}

async function handleFormSubmit(event) {
    event.preventDefault();
    
    // Salvar seleções antes de enviar
    savePlanoSaudeSelections();
    saveSeguroVidaSelections();
    saveImpostoRendaSelections();
    saveOrcamentoSelections();
    
    // Coletar dados do formulário
    const formData = new FormData(event.target);
    const formDataObj = {};
    
    // Processar campos básicos
    formData.forEach((value, key) => {
        formDataObj[key] = value;
    });
    
    // Processar nome completo
    const nomeCompleto = formDataObj.nome_completo || "";
    
    // Processar renda única
    const rendaUnica = formDataObj.renda_unica === "sim";
    
    // Processar outras pessoas com renda
    const outrasPessoas = [];
    document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach(item => {
        const nomeInput = item.querySelector('input[name="pessoa_nome"]');
        if (nomeInput && nomeInput.value.trim() !== "") {
            outrasPessoas.push({
                nome: nomeInput.value.trim()
            });
        }
    });
    
    // Processar dependentes
    const temDependentes = formDataObj.tem_dependentes === "sim";
    const dependentes = [];
    if (temDependentes) {
        document.querySelectorAll("#dependentes-list .dynamic-entry-item").forEach(item => {
            const nomeInput = item.querySelector('input[name="dependente_nome"]');
            const idadeInput = item.querySelector('input[name="dependente_idade"]');
            const relacaoSelect = item.querySelector('select[name="dependente_relacao"]');
            
            if (nomeInput && nomeInput.value.trim() !== "") {
                dependentes.push({
                    nome: nomeInput.value.trim(),
                    idade: idadeInput ? idadeInput.value : "",
                    relacao: relacaoSelect ? relacaoSelect.value : ""
                });
            }
        });
    }
    
    // Processar patrimônio físico
    const temPatrimonioFisico = formDataObj.tem_patrimonio_fisico === "sim";
    const patrimoniosFisicos = [];
    if (temPatrimonioFisico) {
        document.querySelectorAll("#patrimonios-list .dynamic-entry-item").forEach(item => {
            const descricaoInput = item.querySelector('input[name="patrimonio_descricao"]');
            const valorInput = item.querySelector('input[name="patrimonio_valor"]');
            
            if (descricaoInput && descricaoInput.value.trim() !== "") {
                patrimoniosFisicos.push({
                    descricao: descricaoInput.value.trim(),
                    valor: valorInput ? parseCurrency(valorInput.value) : null
                });
            }
        });
    }
    
    // Processar patrimônio líquido
    const temPatrimonioLiquido = formDataObj.tem_patrimonio_liquido === "sim";
    const patrimoniosLiquidos = [];
    if (temPatrimonioLiquido) {
        document.querySelectorAll("#patrimonios-liquidos-list .dynamic-entry-item").forEach(item => {
            const descricaoInput = item.querySelector('input[name="patrimonio_liquido_descricao"]');
            const valorInput = item.querySelector('input[name="patrimonio_liquido_valor"]');
            
            if (descricaoInput && descricaoInput.value.trim() !== "") {
                patrimoniosLiquidos.push({
                    descricao: descricaoInput.value.trim(),
                    valor: valorInput ? parseCurrency(valorInput.value) : null
                });
            }
        });
    }
    
    // Processar dívidas
    const temDividas = formDataObj.tem_dividas === "sim";
    const dividas = [];
    if (temDividas) {
        document.querySelectorAll("#dividas-list .dynamic-entry-item").forEach(item => {
            const descricaoInput = item.querySelector('input[name="divida_descricao"]');
            const valorInput = item.querySelector('input[name="divida_valor"]');
            
            if (descricaoInput && descricaoInput.value.trim() !== "") {
                dividas.push({
                    descricao: descricaoInput.value.trim(),
                    valor: valorInput ? parseCurrency(valorInput.value) : null
                });
            }
        });
    }
    
    // Processar plano de saúde
    const temPlanoSaude = formDataObj.tem_plano_saude === "sim";
    const planoSaude = temPlanoSaude ? {
        tipo: formDataObj.tipo_plano_saude || "",
        cobertura: formDataObj.cobertura_plano_saude || "",
        valor: parseCurrency(formDataObj.valor_plano_saude)
    } : null;
    
    // Processar seguro de vida
    const temSeguroVida = formDataObj.tem_seguro_vida === "sim";
    const seguroVida = temSeguroVida ? {
        tipo: formDataObj.tipo_seguro_vida || "",
        cobertura: formDataObj.cobertura_seguro_vida || "",
        valor: parseCurrency(formDataObj.valor_seguro_vida)
    } : null;
    
    // Processar imposto de renda
    const impostosRenda = {};
    document.querySelectorAll(".imposto-renda-entry").forEach(entry => {
        const personName = entry.dataset.personName;
        const personType = entry.dataset.personType;
        if (!personName) return;
        
        const nameAttribute = entry.querySelector('input[type="radio"]').name;
        const selectedRadio = entry.querySelector(`input[name="${nameAttribute}"]:checked`);
        
        if (selectedRadio) {
            const declaraIR = selectedRadio.value;
            impostosRenda[personName] = { declara: declaraIR };
            
            // Se declara IR, adicionar tipo e resultado
            if (declaraIR === "sim") {
                const tipoNameAttribute = `${nameAttribute}_tipo`;
                const tipoSelectedRadio = entry.querySelector(`input[name="${tipoNameAttribute}"]:checked`);
                if (tipoSelectedRadio) {
                    impostosRenda[personName].tipo = tipoSelectedRadio.value;
                }
                
                const resultadoNameAttribute = `${nameAttribute}_resultado`;
                const resultadoSelectedRadio = entry.querySelector(`input[name="${resultadoNameAttribute}"]:checked`);
                if (resultadoSelectedRadio) {
                    impostosRenda[personName].resultado = resultadoSelectedRadio.value;
                }
            }
        }
    });
    
    // Processar orçamento
    const orcamento = { tipo: "individual", dados: {} };
    
    // Verificar se há escolha de tipo de orçamento
    const tipoOrcamentoRadio = document.querySelector('input[name="tipo_orcamento"]:checked');
    if (tipoOrcamentoRadio) {
        orcamento.tipo = tipoOrcamentoRadio.value;
    }
    
    // Processar orçamento conjunto
    if (orcamento.tipo === "conjunto") {
        const entradasInput = document.querySelector('input[name="orcamento_conjunto_entradas"]');
        const despesasFixasInput = document.querySelector('input[name="orcamento_conjunto_despesas_fixas"]');
        const despesasVariaveisInput = document.querySelector('input[name="orcamento_conjunto_despesas_variaveis"]');
        const valorPoupadoInput = document.querySelector('input[name="orcamento_conjunto_valor_poupado"]');
        
        orcamento.dados.conjunto = {
            entradas: entradasInput ? parseCurrency(entradasInput.value) : null,
            despesas_fixas: despesasFixasInput ? parseCurrency(despesasFixasInput.value) : null,
            despesas_variaveis: despesasVariaveisInput ? parseCurrency(despesasVariaveisInput.value) : null,
            valor_poupado: valorPoupadoInput ? parseCurrency(valorPoupadoInput.value) : null
        };
    } else {
        // Processar orçamento individual
        document.querySelectorAll('.orcamento-individual-entry').forEach(entry => {
            const personId = entry.dataset.personId;
            const personName = entry.dataset.personName;
            if (!personId || !personName) return;
            
            const entradasInput = entry.querySelector(`input[name="orcamento_${personId}_entradas"]`);
            const despesasFixasInput = entry.querySelector(`input[name="orcamento_${personId}_despesas_fixas"]`);
            const despesasVariaveisInput = entry.querySelector(`input[name="orcamento_${personId}_despesas_variaveis"]`);
            const valorPoupadoInput = entry.querySelector(`input[name="orcamento_${personId}_valor_poupado"]`);
            
            orcamento.dados[personName] = {
                entradas: entradasInput ? parseCurrency(entradasInput.value) : null,
                despesas_fixas: despesasFixasInput ? parseCurrency(despesasFixasInput.value) : null,
                despesas_variaveis: despesasVariaveisInput ? parseCurrency(despesasVariaveisInput.value) : null,
                valor_poupado: valorPoupadoInput ? parseCurrency(valorPoupadoInput.value) : null
            };
        });
    }
    
    // Montar objeto final
    const clienteData = {
        nome_completo: nomeCompleto,
        renda_unica: rendaUnica,
        outras_pessoas: outrasPessoas,
        tem_dependentes: temDependentes,
        dependentes: dependentes,
        tem_patrimonio_fisico: temPatrimonioFisico,
        patrimonios_fisicos: patrimoniosFisicos,
        tem_patrimonio_liquido: temPatrimonioLiquido,
        patrimonios_liquidos: patrimoniosLiquidos,
        tem_dividas: temDividas,
        dividas: dividas,
        tem_plano_saude: temPlanoSaude,
        plano_saude: planoSaude,
        tem_seguro_vida: temSeguroVida,
        seguro_vida: seguroVida,
        impostos_renda: impostosRenda,
        orcamento: orcamento,
        data_preenchimento: new Date().toISOString()
    };
    
    try {
        // Obter ID do cliente da URL
        const urlParams = new URLSearchParams(window.location.search);
        const clienteId = urlParams.get('id');
        
        if (!clienteId) {
            throw new Error("ID do cliente não especificado na URL");
        }
        
        // Verificar se o formulário já foi preenchido
        const { data: formulariosExistentes, error: errorCheck } = await supabase
            .from('formularios_clientes')
            .select('*')
            .eq('cliente_id', clienteId);
        
        if (errorCheck) {
            throw new Error(`Erro ao verificar formulários existentes: ${errorCheck.message}`);
        }
        
        let result;
        if (formulariosExistentes && formulariosExistentes.length > 0) {
            // Atualizar formulário existente
            result = await supabase
                .from('formularios_clientes')
                .update({
                    dados_formulario: clienteData,
                    status: 'preenchido'
                })
                .eq('cliente_id', clienteId);
        } else {
            // Inserir novo formulário
            result = await supabase
                .from('formularios_clientes')
                .insert([
                    {
                        cliente_id: clienteId,
                        dados_formulario: clienteData,
                        status: 'preenchido'
                    }
                ]);
        }
        
        if (result.error) {
            throw new Error(`Erro ao salvar formulário: ${result.error.message}`);
        }
        
        // Obter nome do cliente para exibir na mensagem de sucesso
        const { data: clienteData, error: clienteError } = await supabase
            .from('clientes')
            .select('name')
            .eq('id', clienteId)
            .single();
        
        const clienteNome = clienteError ? "Cliente" : (clienteData?.name || "Cliente");
        
        // Mostrar mensagem de sucesso
        showSuccessMessage(clienteId, clienteNome);
        
    } catch (error) {
        console.error("Erro ao enviar formulário:", error);
        showMessage("error", `Erro ao enviar formulário: ${error.message}`);
    }
}

async function initForm() {
    // Definir título do formulário
    if (formTitleEl) {
        formTitleEl.textContent = "Formulário Pré Diagnóstico";
    }
    
    // Obter ID do cliente da URL
    const urlParams = new URLSearchParams(window.location.search);
    const clienteId = urlParams.get('id');
    
    if (!clienteId) {
        formContentEl.innerHTML = `<div class="error-message">ID do cliente não especificado na URL.</div>`;
        return;
    }
    
    try {
        // Verificar se o formulário já foi preenchido
        const { data: formulariosExistentes, error: errorCheck } = await supabase
            .from('formularios_clientes')
            .select('*')
            .eq('cliente_id', clienteId);
        
        if (errorCheck) {
            throw new Error(`Erro ao verificar formulários existentes: ${errorCheck.message}`);
        }
        
        // Se o formulário já foi preenchido, mostrar mensagem
        if (formulariosExistentes && formulariosExistentes.length > 0 && formulariosExistentes[0].status === 'preenchido') {
            const { data: clienteData, error: clienteError } = await supabase
                .from('clientes')
                .select('name')
                .eq('id', clienteId)
                .single();
            
            const clienteNome = clienteError ? "Cliente" : (clienteData?.name || "Cliente");
            
            formContentEl.innerHTML = `
                <div class="message info">
                    <p>Este formulário já foi preenchido anteriormente.</p>
                    <button id="btn-preencher-novamente" class="btn-primary" style="margin-top: 1rem;">Preencher Novamente</button>
                </div>
            `;
            
            document.getElementById("btn-preencher-novamente").addEventListener("click", () => {
                renderFormulario();
            });
            
            return;
        }
        
        // Renderizar formulário
        renderFormulario();
        
    } catch (error) {
        console.error("Erro ao inicializar formulário:", error);
        formContentEl.innerHTML = `<div class="error-message">Erro ao carregar formulário: ${error.message}</div>`;
    }
}

function renderFormulario() {
    formContentEl.innerHTML = `
        <form id="cliente-form">
            <div class="form-section">
                <h3>Informações Básicas</h3>
                <div style="margin-bottom: 1rem;">
                    <label for="nome_completo" style="display: block; margin-bottom: 0.5rem;">Nome Completo</label>
                    <input type="text" id="nome_completo" name="nome_completo" class="form-input" required style="width: 100%;" oninput="this.value = capitalizeName(this.value); updateDynamicFormSections();">
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem;">Você é a única pessoa com renda na casa?</label>
                    <div style="display: flex; align-items: center;">
                        <span style="margin-right: 20px; display: flex; align-items: center;">
                            <input type="radio" id="renda_unica_sim" name="renda_unica" value="sim" required style="margin-right: 5px;" onchange="updateDynamicFormSections();">
                            <label for="renda_unica_sim">Sim</label>
                        </span>
                        <span style="display: flex; align-items: center;">
                            <input type="radio" id="renda_unica_nao" name="renda_unica" value="nao" style="margin-right: 5px;" onchange="updateDynamicFormSections();">
                            <label for="renda_unica_nao">Não</label>
                        </span>
                    </div>
                </div>
                
                <div id="outras-pessoas-section" style="display: none; margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem;">Outras pessoas com renda na casa:</label>
                    <div id="pessoas-list"></div>
                    <button type="button" onclick="addPessoaComRenda()" class="btn-add" style="background-color: #28a745; color: white; border: none; border-radius: 4px; padding: 0.5rem 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 100%;">
                        <span style="margin-right: 5px;">+</span> Adicionar Pessoa com Renda
                    </button>
                </div>
            </div>
            
            <div class="form-section">
                <h3>Dependentes</h3>
                <div style="margin-bottom: 1rem;">
                    <label id="label_tem_dependentes" style="display: block; margin-bottom: 0.5rem;">Você tem filho/pet/outros parentes que dependem de você?</label>
                    <div style="display: flex; align-items: center;">
                        <span style="margin-right: 20px; display: flex; align-items: center;">
                            <input type="radio" id="tem_dependentes_sim" name="tem_dependentes" value="sim" required style="margin-right: 5px;" onchange="document.getElementById('dependentes-section').style.display = this.checked ? 'block' : 'none';">
                            <label for="tem_dependentes_sim">Sim</label>
                        </span>
                        <span style="display: flex; align-items: center;">
                            <input type="radio" id="tem_dependentes_nao" name="tem_dependentes" value="nao" style="margin-right: 5px;" onchange="document.getElementById('dependentes-section').style.display = 'none';">
                            <label for="tem_dependentes_nao">Não</label>
                        </span>
                    </div>
                </div>
                
                <div id="dependentes-section" style="display: none; margin-bottom: 1rem;">
                    <div id="dependentes-list"></div>
                    <button type="button" onclick="addDependente()" class="btn-add" style="background-color: #28a745; color: white; border: none; border-radius: 4px; padding: 0.5rem 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 100%;">
                        <span style="margin-right: 5px;">+</span> Adicionar Dependente
                    </button>
                </div>
            </div>
            
            <div class="form-section">
                <h3>Patrimônio Físico</h3>
                <div style="margin-bottom: 1rem;">
                    <label id="label_tem_patrimonio_fisico" style="display: block; margin-bottom: 0.5rem;">Você possui patrimônio físico (imóvel, automóvel, jóias, outros...)?</label>
                    <div style="display: flex; align-items: center;">
                        <span style="margin-right: 20px; display: flex; align-items: center;">
                            <input type="radio" id="tem_patrimonio_fisico_sim" name="tem_patrimonio_fisico" value="sim" required style="margin-right: 5px;" onchange="document.getElementById('patrimonios-section').style.display = this.checked ? 'block' : 'none';">
                            <label for="tem_patrimonio_fisico_sim">Sim</label>
                        </span>
                        <span style="display: flex; align-items: center;">
                            <input type="radio" id="tem_patrimonio_fisico_nao" name="tem_patrimonio_fisico" value="nao" style="margin-right: 5px;" onchange="document.getElementById('patrimonios-section').style.display = 'none';">
                            <label for="tem_patrimonio_fisico_nao">Não</label>
                        </span>
                    </div>
                </div>
                
                <div id="patrimonios-section" style="display: none; margin-bottom: 1rem;">
                    <div id="patrimonios-list"></div>
                    <button type="button" onclick="addPatrimonioFisico()" class="btn-add" style="background-color: #28a745; color: white; border: none; border-radius: 4px; padding: 0.5rem 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 100%;">
                        <span style="margin-right: 5px;">+</span> Adicionar Patrimônio
                    </button>
                </div>
            </div>
            
            <div class="form-section">
                <h3>Patrimônio Líquido</h3>
                <div style="margin-bottom: 1rem;">
                    <label id="label_tem_patrimonio_liquido" style="display: block; margin-bottom: 0.5rem;">Você possui Dinheiro Guardado ou Investido?</label>
                    <div style="display: flex; align-items: center;">
                        <span style="margin-right: 20px; display: flex; align-items: center;">
                            <input type="radio" id="tem_patrimonio_liquido_sim" name="tem_patrimonio_liquido" value="sim" required style="margin-right: 5px;" onchange="document.getElementById('patrimonios-liquidos-section').style.display = this.checked ? 'block' : 'none';">
                            <label for="tem_patrimonio_liquido_sim">Sim</label>
                        </span>
                        <span style="display: flex; align-items: center;">
                            <input type="radio" id="tem_patrimonio_liquido_nao" name="tem_patrimonio_liquido" value="nao" style="margin-right: 5px;" onchange="document.getElementById('patrimonios-liquidos-section').style.display = 'none';">
                            <label for="tem_patrimonio_liquido_nao">Não</label>
                        </span>
                    </div>
                </div>
                
                <div id="patrimonios-liquidos-section" style="display: none; margin-bottom: 1rem;">
                    <div id="patrimonios-liquidos-list"></div>
                    <button type="button" onclick="addPatrimonioLiquido()" class="btn-add" style="background-color: #28a745; color: white; border: none; border-radius: 4px; padding: 0.5rem 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 100%;">
                        <span style="margin-right: 5px;">+</span> Adicionar Patrimônio Líquido
                    </button>
                </div>
            </div>
            
            <div class="form-section">
                <h3>Dívidas</h3>
                <div style="margin-bottom: 1rem; text-align: center;">
                    <label id="label_tem_dividas" style="display: block; margin-bottom: 0.5rem;">Você possui dívidas?</label>
                    <div style="display: flex; align-items: center; justify-content: center;">
                        <span style="margin-right: 20px; display: flex; align-items: center;">
                            <input type="radio" id="tem_dividas_sim" name="tem_dividas" value="sim" required style="margin-right: 5px;" onchange="document.getElementById('dividas-section').style.display = this.checked ? 'block' : 'none';">
                            <label for="tem_dividas_sim">Sim</label>
                        </span>
                        <span style="display: flex; align-items: center;">
                            <input type="radio" id="tem_dividas_nao" name="tem_dividas" value="nao" style="margin-right: 5px;" onchange="document.getElementById('dividas-section').style.display = 'none';">
                            <label for="tem_dividas_nao">Não</label>
                        </span>
                    </div>
                </div>
                
                <div id="dividas-section" style="display: none; margin-bottom: 1rem;">
                    <div id="dividas-list"></div>
                    <button type="button" onclick="addDivida()" class="btn-add" style="background-color: #28a745; color: white; border: none; border-radius: 4px; padding: 0.5rem 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 100%;">
                        <span style="margin-right: 5px;">+</span> Adicionar Dívida
                    </button>
                </div>
            </div>
            
            <div class="form-section">
                <h3 id="imposto-renda-section-title">Informações sobre Imposto de Renda:</h3>
                <div id="imposto-renda-section-content"></div>
            </div>
            
            <div class="form-section">
                <h3 id="orcamento-section-title">Informações sobre Orçamento:</h3>
                <div id="orcamento-section-content"></div>
            </div>
            
            <div class="form-section">
                <h3>Plano de Saúde</h3>
                <div id="plano-saude-section-content"></div>
            </div>
            
            <div class="form-section">
                <h3>Seguro de Vida</h3>
                <div id="seguro-vida-section-content"></div>
            </div>
            
            <div style="margin-top: 2rem; text-align: center;">
                <button type="submit" class="btn-primary" style="background-color: #007bff; color: white; border: none; border-radius: 4px; padding: 0.75rem 2rem; cursor: pointer; font-size: 1.1rem;">Enviar Respostas</button>
            </div>
        </form>
    `;
    
    // Adicionar eventos
    document.getElementById("renda_unica_sim").addEventListener("change", function() {
        if (this.checked) {
            document.getElementById("outras-pessoas-section").style.display = "none";
        }
    });
    
    document.getElementById("renda_unica_nao").addEventListener("change", function() {
        if (this.checked) {
            document.getElementById("outras-pessoas-section").style.display = "block";
        }
    });
    
    document.getElementById("cliente-form").addEventListener("submit", handleFormSubmit);
    
    // Inicializar seções dinâmicas
    updateDynamicFormSections();
}

// Inicializar formulário quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", initForm);

// Exportar funções para uso global
window.addPessoaComRenda = addPessoaComRenda;
window.removePessoaComRenda = removePessoaComRenda;
window.addDependente = addDependente;
window.removeDependente = removeDependente;
window.addPatrimonioFisico = addPatrimonioFisico;
window.removePatrimonioFisico = removePatrimonioFisico;
window.addPatrimonioLiquido = addPatrimonioLiquido;
window.removePatrimonioLiquido = removePatrimonioLiquido;
window.addDivida = addDivida;
window.removeDivida = removeDivida;
window.toggleSection = toggleSection;
window.updateDynamicFormSections = updateDynamicFormSections;
window.capitalizeName = capitalizeName;
window.formatCurrency = formatCurrency;

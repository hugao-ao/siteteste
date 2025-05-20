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
        
        if (simRadio && naoRadio && additionalQuestions) {
            simRadio.addEventListener('change', () => {
                additionalQuestions.style.display = 'block';
            });
            naoRadio.addEventListener('change', () => {
                additionalQuestions.style.display = 'none';
            });
        }
    }
    
    // Perguntas para outras pessoas com renda (se houver)
    if (temOutrasPessoasComRenda) {
        pessoasComRenda.forEach((pessoa) => {
            if (pessoa.tipo === "outra_pessoa_renda") {
                const primeiroNome = pessoa.nome.split(' ')[0];
                const nomeCapitalizado = capitalizeName(primeiroNome);
                const personId = `imposto_renda_${pessoa.id}`;
                const entryDiv = document.createElement("div");
                entryDiv.classList.add("imposto-renda-entry");
                entryDiv.style.marginBottom = "1rem";
                entryDiv.innerHTML = `
                    <label for="${personId}" style="display: block; margin-bottom: 0.5rem;">${nomeCapitalizado} declara imposto de renda?</label>
                    <div class="radio-options-inline" style="display: flex; align-items: center; flex-wrap: nowrap; width: 100%;">
                        <span style="margin-right: 15px; display: flex; align-items: center;">
                            <input type="radio" id="${personId}_sim" name="${personId}" value="sim" required style="margin-right: 3px;">
                            <label for="${personId}_sim" style="font-size: 14px;">Sim</label>
                        </span>
                        <span style="margin-right: 15px; display: flex; align-items: center;">
                            <input type="radio" id="${personId}_nao" name="${personId}" value="nao" style="margin-right: 3px;">
                            <label for="${personId}_nao" style="font-size: 14px;">Não</label>
                        </span>
                        <span style="display: flex; align-items: center;">
                            <input type="radio" id="${personId}_naosei" name="${personId}" value="nao_sei" style="margin-right: 3px;">
                            <label for="${personId}_naosei" style="font-size: 14px;">Não sei informar</label>
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
                
                if (simRadio && naoRadio && naoSeiRadio && additionalQuestions) {
                    simRadio.addEventListener('change', () => {
                        additionalQuestions.style.display = 'block';
                    });
                    naoRadio.addEventListener('change', () => {
                        additionalQuestions.style.display = 'none';
                    });
                    naoSeiRadio.addEventListener('change', () => {
                        additionalQuestions.style.display = 'none';
                    });
                }
            }
        });
    }
    
    restoreImpostoRendaSelections();
}

// Função para salvar as seleções de orçamento
function saveOrcamentoSelections() {
    const container = document.getElementById("orcamento-section-content");
    if (!container) return;
    orcamentoSelections = {}; 
    
    // Salvar valores dos campos de orçamento
    container.querySelectorAll("input[type='text']").forEach(input => {
        if (input.name && input.value) {
            orcamentoSelections[input.name] = input.value;
        }
    });
}

// Função para restaurar as seleções de orçamento
function restoreOrcamentoSelections() {
    Object.keys(orcamentoSelections).forEach(inputName => {
        const value = orcamentoSelections[inputName];
        const inputToRestore = document.querySelector(`input[name="${inputName}"]`);
        if (inputToRestore) {
            inputToRestore.value = value;
        }
    });
}

// Função para renderizar as perguntas de orçamento
function renderOrcamentoQuestions() {
    saveOrcamentoSelections(); 
    const container = document.getElementById("orcamento-section-content");
    if (!container) return;
    container.innerHTML = '';
    
    const nomeCompletoInput = document.getElementById("nome_completo");
    const temNomePreenchido = nomeCompletoInput && nomeCompletoInput.value.trim() !== "";
    
    const tituloOrcamento = document.getElementById("orcamento-section-title");
    if (!temNomePreenchido) {
        container.innerHTML = "<p>Preencha as informações sobre nome para definir as perguntas sobre orçamento.</p>";
        if(tituloOrcamento) tituloOrcamento.style.display = 'none';
        return;
    }
    
    if(tituloOrcamento) tituloOrcamento.style.display = 'block';
    
    // Verificar se é singular ou plural (baseado na existência de outras pessoas com renda)
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
    
    // Definir texto baseado em singular ou plural
    const textoSingularPlural = temOutrasPessoasComRenda ? "Vocês possuem" : "Você possui";
    
    // Criar a seção de orçamento
    const orcamentoDiv = document.createElement("div");
    orcamentoDiv.classList.add("orcamento-entry");
    orcamentoDiv.style.marginBottom = "1rem";
    orcamentoDiv.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <label for="orcamento_entradas" style="display: block; margin-bottom: 0.5rem;">Qual o valor total de entradas mensais que ${textoSingularPlural}?</label>
            <input type="text" id="orcamento_entradas" name="orcamento_entradas" placeholder="R$ 0,00" class="form-input currency-input" style="width: 100%;">
        </div>
        
        <div style="margin-bottom: 1.5rem;">
            <label for="orcamento_despesas_fixas" style="display: block; margin-bottom: 0.5rem;">Qual o valor total de despesas fixas mensais?</label>
            <input type="text" id="orcamento_despesas_fixas" name="orcamento_despesas_fixas" placeholder="R$ 0,00" class="form-input currency-input" style="width: 100%;">
            <small style="display: block; margin-top: 0.3rem; color: #aaa; font-size: 0.8rem;">Exemplos: aluguel, condomínio, escola, plano de saúde, etc.</small>
        </div>
        
        <div style="margin-bottom: 1.5rem;">
            <label for="orcamento_despesas_variaveis" style="display: block; margin-bottom: 0.5rem;">Qual o valor total de despesas variáveis mensais?</label>
            <input type="text" id="orcamento_despesas_variaveis" name="orcamento_despesas_variaveis" placeholder="R$ 0,00" class="form-input currency-input" style="width: 100%;">
            <small style="display: block; margin-top: 0.3rem; color: #aaa; font-size: 0.8rem;">Exemplos: alimentação, lazer, transporte, etc.</small>
        </div>
        
        <div style="margin-bottom: 1.5rem;">
            <label for="orcamento_valor_poupado" style="display: block; margin-bottom: 0.5rem;">Qual o valor mensal que ${textoSingularPlural} consegue poupar/investir?</label>
            <input type="text" id="orcamento_valor_poupado" name="orcamento_valor_poupado" placeholder="R$ 0,00" class="form-input currency-input" style="width: 100%;">
        </div>
    `;
    
    container.appendChild(orcamentoDiv);
    
    // Adicionar formatação de moeda aos campos
    container.querySelectorAll('.currency-input').forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value) {
                this.value = formatCurrency(this.value);
            }
        });
        
        input.addEventListener('focus', function() {
            if (this.value) {
                // Remover formatação para edição
                this.value = this.value.replace(/[^\d,.-]/g, '');
            }
        });
    });
    
    restoreOrcamentoSelections();
}

function savePlanoSaudeSelections() {
    const container = document.getElementById("plano-saude-section-content");
    if (!container) return;
    planoSaudeSelections = {}; 
    container.querySelectorAll(".plano-saude-entry").forEach(entry => {
        const nameAttribute = entry.querySelector('input[type="radio"]').name; 
        const selectedRadio = entry.querySelector(`input[name="${nameAttribute}"]:checked`);
        if (selectedRadio) {
            planoSaudeSelections[nameAttribute] = selectedRadio.value;
        }
    });
}

function restorePlanoSaudeSelections() {
    Object.keys(planoSaudeSelections).forEach(nameAttribute => {
        const value = planoSaudeSelections[nameAttribute];
        const radioToSelect = document.querySelector(`input[name="${nameAttribute}"][value="${value}"]`);
        if (radioToSelect) {
            radioToSelect.checked = true;
        }
    });
}

function renderPlanoSaudeQuestions() {
    savePlanoSaudeSelections(); 
    const container = document.getElementById("plano-saude-section-content");
    if (!container) return;
    container.innerHTML = '';
    const pessoasDaCasa = [];
    const nomeCompletoInput = document.getElementById("nome_completo");
    if (nomeCompletoInput && nomeCompletoInput.value.trim() !== "") {
        pessoasDaCasa.push({ id: "preenchedor_plano", nome: sanitizeInput(nomeCompletoInput.value.trim()), tipo: "preenchedor" });
    }
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach((entry, index) => { 
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasDaCasa.push({ id: `outra_pessoa_plano_${index}`, nome: sanitizeInput(nomeInput.value.trim()), tipo: "outra_pessoa_renda" });
            }
        });
    }
    if (document.getElementById("tem_dependentes_sim") && document.getElementById("tem_dependentes_sim").checked) {
        document.querySelectorAll("#dependentes-list .dynamic-entry-item").forEach((entry, index) => { 
            const nomeInput = entry.querySelector('input[name="dep_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasDaCasa.push({ id: `dependente_plano_${index}`, nome: sanitizeInput(nomeInput.value.trim()), tipo: "dependente" });
            }
        });
    }
    const tituloPlanoSaude = document.getElementById("plano-saude-section-title");
    if (pessoasDaCasa.length === 0) {
        container.innerHTML = "<p>Preencha as informações anteriores para definir as perguntas sobre plano de saúde.</p>";
        if(tituloPlanoSaude) tituloPlanoSaude.style.display = 'none';
        return;
    }
    if(tituloPlanoSaude) tituloPlanoSaude.style.display = 'block';
    pessoasDaCasa.forEach((pessoa) => {
        const primeiroNome = pessoa.nome.split(' ')[0];
        const nomeCapitalizado = capitalizeName(primeiroNome);
        const personId = `plano_saude_${pessoa.id}`;
        const entryDiv = document.createElement("div");
        entryDiv.classList.add("plano-saude-entry");
        entryDiv.style.marginBottom = "1rem";
        entryDiv.innerHTML = `
            <label for="${personId}" style="display: block; margin-bottom: 0.5rem;">${nomeCapitalizado} possui plano de saúde?</label>
            <div class="radio-options-inline" style="display: flex; align-items: center; flex-wrap: nowrap; width: 100%;">
                <span style="margin-right: 15px; display: flex; align-items: center;">
                    <input type="radio" id="${personId}_sim" name="${personId}" value="sim" required style="margin-right: 3px;">
                    <label for="${personId}_sim" style="font-size: 14px;">Sim</label>
                </span>
                <span style="margin-right: 15px; display: flex; align-items: center;">
                    <input type="radio" id="${personId}_nao" name="${personId}" value="nao" style="margin-right: 3px;">
                    <label for="${personId}_nao" style="font-size: 14px;">Não</label>
                </span>
                <span style="display: flex; align-items: center;">
                    <input type="radio" id="${personId}_naosei" name="${personId}" value="nao_sei" style="margin-right: 3px;">
                    <label for="${personId}_naosei" style="font-size: 14px;">Não sei informar</label>
                </span>
            </div>
        `;
        entryDiv.dataset.personName = pessoa.nome;
        entryDiv.dataset.personType = pessoa.tipo;
        container.appendChild(entryDiv);
    });
    restorePlanoSaudeSelections();
}

function saveSeguroVidaSelections() {
    const container = document.getElementById("seguro-vida-section-content");
    if (!container) return;
    seguroVidaSelections = {}; 
    container.querySelectorAll(".seguro-vida-entry").forEach(entry => {
        const nameAttribute = entry.querySelector('input[type="radio"]').name; 
        const selectedRadio = entry.querySelector(`input[name="${nameAttribute}"]:checked`);
        if (selectedRadio) {
            seguroVidaSelections[nameAttribute] = selectedRadio.value;
        }
    });
}

function restoreSeguroVidaSelections() {
    Object.keys(seguroVidaSelections).forEach(nameAttribute => {
        const value = seguroVidaSelections[nameAttribute];
        const radioToSelect = document.querySelector(`input[name="${nameAttribute}"][value="${value}"]`);
        if (radioToSelect) {
            radioToSelect.checked = true;
        }
    });
}

function renderSeguroVidaQuestions() {
    saveSeguroVidaSelections(); 
    const container = document.getElementById("seguro-vida-section-content");
    if (!container) return;
    container.innerHTML = '';
    const pessoasComRenda = [];
    const nomeCompletoInput = document.getElementById("nome_completo");
    if (nomeCompletoInput && nomeCompletoInput.value.trim() !== "") {
        pessoasComRenda.push({ id: "preenchedor_seguro", nome: sanitizeInput(nomeCompletoInput.value.trim()), tipo: "preenchedor" });
    }
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach((entry, index) => { 
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasComRenda.push({ id: `outra_pessoa_seguro_${index}`, nome: sanitizeInput(nomeInput.value.trim()), tipo: "outra_pessoa_renda" });
            }
        });
    }
    const tituloSeguroVida = document.getElementById("seguro-vida-section-title");
    if (pessoasComRenda.length === 0) {
        container.innerHTML = "<p>Preencha as informações sobre nome e renda para definir as perguntas sobre seguro de vida.</p>";
        if(tituloSeguroVida) tituloSeguroVida.style.display = 'none';
        return;
    }
    if(tituloSeguroVida) tituloSeguroVida.style.display = 'block';
    pessoasComRenda.forEach((pessoa) => {
        const primeiroNome = pessoa.nome.split(' ')[0];
        const nomeCapitalizado = capitalizeName(primeiroNome);
        const personId = `seguro_vida_${pessoa.id}`;
        const entryDiv = document.createElement("div");
        entryDiv.classList.add("seguro-vida-entry");
        entryDiv.style.marginBottom = "1rem";
        entryDiv.innerHTML = `
            <label for="${personId}" style="display: block; margin-bottom: 0.5rem;">${nomeCapitalizado} possui seguro de vida?</label>
            <div class="radio-options-inline" style="display: flex; align-items: center; flex-wrap: nowrap; width: 100%;">
                <span style="margin-right: 15px; display: flex; align-items: center;">
                    <input type="radio" id="${personId}_sim" name="${personId}" value="sim" required style="margin-right: 3px;">
                    <label for="${personId}_sim" style="font-size: 14px;">Sim</label>
                </span>
                <span style="margin-right: 15px; display: flex; align-items: center;">
                    <input type="radio" id="${personId}_nao" name="${personId}" value="nao" style="margin-right: 3px;">
                    <label for="${personId}_nao" style="font-size: 14px;">Não</label>
                </span>
                <span style="display: flex; align-items: center;">
                    <input type="radio" id="${personId}_naosei" name="${personId}" value="nao_sei" style="margin-right: 3px;">
                    <label for="${personId}_naosei" style="font-size: 14px;">Não sei informar</label>
                </span>
            </div>
        `;
        entryDiv.dataset.personName = pessoa.nome;
        entryDiv.dataset.personType = pessoa.tipo;
        container.appendChild(entryDiv);
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
    renderOrcamentoQuestions(); // Função para orçamento
}

function addPatrimonioEntry() {
    const patrimonioListEl = document.getElementById("patrimonio-list");
    if (!patrimonioListEl) {
        console.error("Elemento patrimonio-list não encontrado para adicionar entrada de patrimônio.");
        return;
    }

    const patrimonioIndex = patrimonioListEl.children.length;
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item"); 
    entryDiv.innerHTML = `
        <input type="text" name="patrimonio_qual" placeholder="Qual patrimônio? (ex: Apto 50m2, Corolla 2020)" required class="form-input">
        <input type="text" name="patrimonio_valor" placeholder="Quanto vale? (R$)" required class="form-input currency-input">
        <div class="patrimonio-radio-group-container"> 
            <div class="patrimonio-radio-group-item">
                <label>Possui seguro?</label>
                <div class="radio-group">
                    <label><input type="radio" name="patrimonio_seguro_${patrimonioIndex}" value="sim" required> Sim</label>
                    <label><input type="radio" name="patrimonio_seguro_${patrimonioIndex}" value="nao"> Não</label>
                    <label><input type="radio" name="patrimonio_seguro_${patrimonioIndex}" value="nao_sei"> Não sei informar</label>
                </div>
            </div>
            <div class="patrimonio-radio-group-item">
                <label>Está quitado?</label>
                <div class="radio-group">
                    <label><input type="radio" name="patrimonio_quitado_${patrimonioIndex}" value="sim" required> Sim</label>
                    <label><input type="radio" name="patrimonio_quitado_${patrimonioIndex}" value="nao"> Não</label>
                    <label><input type="radio" name="patrimonio_quitado_${patrimonioIndex}" value="nao_sei"> Não sei informar</label>
                </div>
            </div>
        </div>
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
    `;
    
    // Adicionar evento para formatação de moeda
    const currencyInput = entryDiv.querySelector('.currency-input');
    if (currencyInput) {
        currencyInput.addEventListener('blur', function() {
            if (this.value) {
                this.value = formatCurrency(this.value);
            }
        });
        
        currencyInput.addEventListener('focus', function() {
            if (this.value) {
                // Remover formatação para edição
                this.value = this.value.replace(/[^\d,.-]/g, '');
            }
        });
    }
    
    // Adicionar evento para remover entrada
    const removeButton = entryDiv.querySelector('.remove-dynamic-entry-btn');
    if (removeButton) {
        removeButton.addEventListener('click', function() {
            patrimonioListEl.removeChild(entryDiv);
        });
    }
    
    patrimonioListEl.appendChild(entryDiv);
}

function addPatrimonioLiquidoEntry() {
    const patrimonioLiquidoListEl = document.getElementById("patrimonio-liquido-list");
    if (!patrimonioLiquidoListEl) {
        console.error("Elemento patrimonio-liquido-list não encontrado para adicionar entrada de patrimônio líquido.");
        return;
    }

    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item"); 
    entryDiv.innerHTML = `
        <input type="text" name="patrimonio_liquido_qual" placeholder="Qual aplicação? (ex: Poupança, CDB, Ações)" required class="form-input">
        <input type="text" name="patrimonio_liquido_valor" placeholder="Quanto vale? (R$)" required class="form-input currency-input">
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
    `;
    
    // Adicionar evento para formatação de moeda
    const currencyInput = entryDiv.querySelector('.currency-input');
    if (currencyInput) {
        currencyInput.addEventListener('blur', function() {
            if (this.value) {
                this.value = formatCurrency(this.value);
            }
        });
        
        currencyInput.addEventListener('focus', function() {
            if (this.value) {
                // Remover formatação para edição
                this.value = this.value.replace(/[^\d,.-]/g, '');
            }
        });
    }
    
    // Adicionar evento para remover entrada
    const removeButton = entryDiv.querySelector('.remove-dynamic-entry-btn');
    if (removeButton) {
        removeButton.addEventListener('click', function() {
            patrimonioLiquidoListEl.removeChild(entryDiv);
        });
    }
    
    patrimonioLiquidoListEl.appendChild(entryDiv);
}

function addDividaEntry() {
    const dividasListEl = document.getElementById("dividas-list");
    if (!dividasListEl) {
        console.error("Elemento dividas-list não encontrado para adicionar entrada de dívida.");
        return;
    }

    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item"); 
    entryDiv.innerHTML = `
        <input type="text" name="divida_qual" placeholder="Qual dívida? (ex: Financiamento Imobiliário, Empréstimo Pessoal)" required class="form-input">
        <input type="text" name="divida_valor" placeholder="Valor total? (R$)" required class="form-input currency-input">
        <input type="text" name="divida_parcela" placeholder="Valor da parcela? (R$)" required class="form-input currency-input">
        <input type="number" name="divida_parcelas_restantes" placeholder="Quantas parcelas restantes?" required class="form-input" min="1">
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
    `;
    
    // Adicionar evento para formatação de moeda
    entryDiv.querySelectorAll('.currency-input').forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value) {
                this.value = formatCurrency(this.value);
            }
        });
        
        input.addEventListener('focus', function() {
            if (this.value) {
                // Remover formatação para edição
                this.value = this.value.replace(/[^\d,.-]/g, '');
            }
        });
    });
    
    // Adicionar evento para remover entrada
    const removeButton = entryDiv.querySelector('.remove-dynamic-entry-btn');
    if (removeButton) {
        removeButton.addEventListener('click', function() {
            dividasListEl.removeChild(entryDiv);
        });
    }
    
    dividasListEl.appendChild(entryDiv);
}

function addPessoaEntry() {
    const pessoasListEl = document.getElementById("pessoas-list");
    if (!pessoasListEl) {
        console.error("Elemento pessoas-list não encontrado para adicionar entrada de pessoa.");
        return;
    }

    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item"); 
    entryDiv.innerHTML = `
        <input type="text" name="pessoa_nome" placeholder="Nome completo" required class="form-input">
        <select name="pessoa_autorizacao" required class="form-input">
            <option value="" disabled selected>Autoriza compartilhar dados?</option>
            <option value="sim">Sim, autoriza</option>
            <option value="nao">Não autoriza</option>
        </select>
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
    `;
    
    // Adicionar evento para remover entrada
    const removeButton = entryDiv.querySelector('.remove-dynamic-entry-btn');
    if (removeButton) {
        removeButton.addEventListener('click', function() {
            pessoasListEl.removeChild(entryDiv);
            updateDynamicFormSections();
        });
    }
    
    // Adicionar evento para atualizar seções dinâmicas quando o nome mudar
    const nomeInput = entryDiv.querySelector('input[name="pessoa_nome"]');
    if (nomeInput) {
        nomeInput.addEventListener('input', updateDynamicFormSections);
    }
    
    pessoasListEl.appendChild(entryDiv);
}

function addDependenteEntry() {
    const dependentesListEl = document.getElementById("dependentes-list");
    if (!dependentesListEl) {
        console.error("Elemento dependentes-list não encontrado para adicionar entrada de dependente.");
        return;
    }

    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item"); 
    entryDiv.innerHTML = `
        <input type="text" name="dep_nome" placeholder="Nome completo" required class="form-input">
        <input type="number" name="dep_idade" placeholder="Idade" required class="form-input" min="0" max="120">
        <input type="text" name="dep_relacao" placeholder="Relação (ex: filho, sobrinho, pet)" required class="form-input">
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
    `;
    
    // Adicionar evento para remover entrada
    const removeButton = entryDiv.querySelector('.remove-dynamic-entry-btn');
    if (removeButton) {
        removeButton.addEventListener('click', function() {
            dependentesListEl.removeChild(entryDiv);
            updateDynamicFormSections();
        });
    }
    
    // Adicionar evento para atualizar seções dinâmicas quando o nome mudar
    const nomeInput = entryDiv.querySelector('input[name="dep_nome"]');
    if (nomeInput) {
        nomeInput.addEventListener('input', updateDynamicFormSections);
    }
    
    dependentesListEl.appendChild(entryDiv);
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function getClienteByToken(token) {
    try {
        const { data, error } = await supabase
            .from('formularios_clientes')
            .select('cliente_id')
            .eq('token_unico', token)
            .single();
        
        if (error) {
            console.error("Erro ao buscar cliente pelo token:", error);
            return null;
        }
        
        return data?.cliente_id || null;
    } catch (err) {
        console.error("Erro ao buscar cliente pelo token:", err);
        return null;
    }
}

async function loadForm(token) {
    try {
        const { data, error } = await supabase
            .from('formularios_clientes')
            .select('dados_formulario, status')
            .eq('token_unico', token)
            .single();
        
        if (error) {
            console.error("Erro ao carregar dados do formulário:", error);
            return null;
        }
        
        if (data.status === 'preenchido') {
            formContentEl.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <h2 style="color: var(--planejamento-primary);">Formulário já preenchido</h2>
                    <p>Este formulário já foi preenchido anteriormente. Obrigado pela sua participação!</p>
                </div>
            `;
            return null;
        }
        
        return data?.dados_formulario || null;
    } catch (err) {
        console.error("Erro ao carregar dados do formulário:", err);
        return null;
    }
}

async function initForm() {
    // Obter token da URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (!token) {
        formContentEl.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <h2 style="color: #c62828;">Token não encontrado</h2>
                <p>É necessário um token válido para acessar este formulário.</p>
            </div>
        `;
        return;
    }
    
    // Carregar dados do formulário se existirem
    const formData = await loadForm(token);
    
    // Atualizar título do formulário
    formTitleEl.textContent = "Formulário Pré Diagnóstico";
    
    // Renderizar formulário
    formContentEl.innerHTML = `
        <form id="client-response-form">
            <div class="form-section">
                <h2>Informações Pessoais</h2>
                <label for="nome_completo">Nome completo</label>
                <input type="text" id="nome_completo" name="nome_completo" required class="form-input" value="${formData?.nome_completo || ''}">
                
                <div class="radio-group">
                    <label id="label_renda_unica">Você é a única pessoa com renda na sua casa?</label>
                    <label><input type="radio" name="renda_unica" id="renda_unica_sim" value="sim" required ${formData?.renda_unica === 'sim' ? 'checked' : ''}> Sim</label>
                    <label><input type="radio" name="renda_unica" id="renda_unica_nao" value="nao" ${formData?.renda_unica === 'nao' ? 'checked' : ''}> Não</label>
                </div>
                
                <div id="pessoas-container" style="display: none;">
                    <label>Outras pessoas com renda na casa:</label>
                    <div id="pessoas-list">
                        <!-- Entradas dinâmicas de pessoas serão adicionadas aqui -->
                    </div>
                    <button type="button" id="add-pessoa-btn" class="add-dynamic-entry-btn">+ Adicionar Pessoa com Renda</button>
                </div>
                
                <div class="radio-group">
                    <label id="label_tem_dependentes">Você tem filho/pet/outros parentes que dependem de você?</label>
                    <label><input type="radio" name="tem_dependentes" id="tem_dependentes_sim" value="sim" required ${formData?.tem_dependentes === 'sim' ? 'checked' : ''}> Sim</label>
                    <label><input type="radio" name="tem_dependentes" id="tem_dependentes_nao" value="nao" ${formData?.tem_dependentes === 'nao' ? 'checked' : ''}> Não</label>
                </div>
                
                <div id="dependentes-container" style="display: none;">
                    <label>Dependentes:</label>
                    <div id="dependentes-list">
                        <!-- Entradas dinâmicas de dependentes serão adicionadas aqui -->
                    </div>
                    <button type="button" id="add-dependente-btn" class="add-dynamic-entry-btn">+ Adicionar Dependente</button>
                </div>
            </div>
            
            <div class="form-section">
                <h2>Patrimônio e Finanças</h2>
                
                <div class="radio-group">
                    <label id="label_tem_patrimonio_fisico">Você possui patrimônio físico (imóvel, automóvel, jóias, outros...)?</label>
                    <label><input type="radio" name="tem_patrimonio" id="tem_patrimonio_sim" value="sim" required ${formData?.tem_patrimonio === 'sim' ? 'checked' : ''}> Sim</label>
                    <label><input type="radio" name="tem_patrimonio" id="tem_patrimonio_nao" value="nao" ${formData?.tem_patrimonio === 'nao' ? 'checked' : ''}> Não</label>
                </div>
                
                <div id="patrimonio-container" style="display: none;">
                    <label>Patrimônio físico:</label>
                    <div id="patrimonio-list">
                        <!-- Entradas dinâmicas de patrimônio serão adicionadas aqui -->
                    </div>
                    <button type="button" id="add-patrimonio-btn" class="add-dynamic-entry-btn">+ Adicionar Patrimônio</button>
                </div>
                
                <div class="radio-group">
                    <label id="label_tem_patrimonio_liquido">Você possui Dinheiro Guardado ou Investido?</label>
                    <label><input type="radio" name="tem_patrimonio_liquido" id="tem_patrimonio_liquido_sim" value="sim" required ${formData?.tem_patrimonio_liquido === 'sim' ? 'checked' : ''}> Sim</label>
                    <label><input type="radio" name="tem_patrimonio_liquido" id="tem_patrimonio_liquido_nao" value="nao" ${formData?.tem_patrimonio_liquido === 'nao' ? 'checked' : ''}> Não</label>
                </div>
                
                <div id="patrimonio-liquido-container" style="display: none;">
                    <label>Dinheiro guardado ou investido:</label>
                    <div id="patrimonio-liquido-list">
                        <!-- Entradas dinâmicas de patrimônio líquido serão adicionadas aqui -->
                    </div>
                    <button type="button" id="add-patrimonio-liquido-btn" class="add-dynamic-entry-btn">+ Adicionar Aplicação</button>
                </div>
                
                <div class="radio-group">
                    <label id="label_tem_dividas">Você possui dívidas?</label>
                    <label><input type="radio" name="tem_dividas" id="tem_dividas_sim" value="sim" required ${formData?.tem_dividas === 'sim' ? 'checked' : ''}> Sim</label>
                    <label><input type="radio" name="tem_dividas" id="tem_dividas_nao" value="nao" ${formData?.tem_dividas === 'nao' ? 'checked' : ''}> Não</label>
                </div>
                
                <div id="dividas-container" style="display: none;">
                    <label>Dívidas:</label>
                    <div id="dividas-list">
                        <!-- Entradas dinâmicas de dívidas serão adicionadas aqui -->
                    </div>
                    <button type="button" id="add-divida-btn" class="add-dynamic-entry-btn">+ Adicionar Dívida</button>
                </div>
            </div>
            
            <div class="form-section">
                <h2 id="plano-saude-section-title">Plano de Saúde</h2>
                <div id="plano-saude-section-content">
                    <!-- Conteúdo dinâmico será adicionado aqui -->
                </div>
            </div>
            
            <div class="form-section">
                <h2 id="seguro-vida-section-title">Seguro de Vida</h2>
                <div id="seguro-vida-section-content">
                    <!-- Conteúdo dinâmico será adicionado aqui -->
                </div>
            </div>
            
            <div class="form-section">
                <h2 id="imposto-renda-section-title">Imposto de Renda</h2>
                <div id="imposto-renda-section-content">
                    <!-- Conteúdo dinâmico será adicionado aqui -->
                </div>
            </div>
            
            <div class="form-section">
                <h2 id="orcamento-section-title">Orçamento</h2>
                <div id="orcamento-section-content">
                    <!-- Conteúdo dinâmico será adicionado aqui -->
                </div>
            </div>
            
            <button type="submit" class="submit-btn">Enviar Respostas</button>
        </form>
    `;
    
    // Referências aos elementos do DOM
    const clientResponseFormEl = document.getElementById("client-response-form");
    const rendaUnicaSimEl = document.getElementById("renda_unica_sim");
    const rendaUnicaNaoEl = document.getElementById("renda_unica_nao");
    const pessoasContainerEl = document.getElementById("pessoas-container");
    const addPessoaBtnEl = document.getElementById("add-pessoa-btn");
    const temDependentesSimEl = document.getElementById("tem_dependentes_sim");
    const temDependentesNaoEl = document.getElementById("tem_dependentes_nao");
    const dependentesContainerEl = document.getElementById("dependentes-container");
    const addDependenteBtnEl = document.getElementById("add-dependente-btn");
    const temPatrimonioSimEl = document.getElementById("tem_patrimonio_sim");
    const temPatrimonioNaoEl = document.getElementById("tem_patrimonio_nao");
    const patrimonioContainerEl = document.getElementById("patrimonio-container");
    const addPatrimonioBtnEl = document.getElementById("add-patrimonio-btn");
    const temPatrimonioLiquidoSimEl = document.getElementById("tem_patrimonio_liquido_sim");
    const temPatrimonioLiquidoNaoEl = document.getElementById("tem_patrimonio_liquido_nao");
    const patrimonioLiquidoContainerEl = document.getElementById("patrimonio-liquido-container");
    const addPatrimonioLiquidoBtnEl = document.getElementById("add-patrimonio-liquido-btn");
    const temDividasSimEl = document.getElementById("tem_dividas_sim");
    const temDividasNaoEl = document.getElementById("tem_dividas_nao");
    const dividasContainerEl = document.getElementById("dividas-container");
    const addDividaBtnEl = document.getElementById("add-divida-btn");
    
    // Eventos para mostrar/ocultar seções condicionais
    if (rendaUnicaSimEl && rendaUnicaNaoEl && pessoasContainerEl) {
        rendaUnicaSimEl.addEventListener("change", () => {
            pessoasContainerEl.style.display = "none";
            updateDynamicFormSections();
        });
        rendaUnicaNaoEl.addEventListener("change", () => {
            pessoasContainerEl.style.display = "block";
            updateDynamicFormSections();
        });
        
        // Inicializar estado
        if (rendaUnicaNaoEl.checked) {
            pessoasContainerEl.style.display = "block";
        }
    }
    
    if (temDependentesSimEl && temDependentesNaoEl && dependentesContainerEl) {
        temDependentesSimEl.addEventListener("change", () => {
            dependentesContainerEl.style.display = "block";
            updateDynamicFormSections();
        });
        temDependentesNaoEl.addEventListener("change", () => {
            dependentesContainerEl.style.display = "none";
            updateDynamicFormSections();
        });
        
        // Inicializar estado
        if (temDependentesSimEl.checked) {
            dependentesContainerEl.style.display = "block";
        }
    }
    
    if (temPatrimonioSimEl && temPatrimonioNaoEl && patrimonioContainerEl) {
        temPatrimonioSimEl.addEventListener("change", () => {
            patrimonioContainerEl.style.display = "block";
        });
        temPatrimonioNaoEl.addEventListener("change", () => {
            patrimonioContainerEl.style.display = "none";
        });
        
        // Inicializar estado
        if (temPatrimonioSimEl.checked) {
            patrimonioContainerEl.style.display = "block";
        }
    }
    
    if (temPatrimonioLiquidoSimEl && temPatrimonioLiquidoNaoEl && patrimonioLiquidoContainerEl) {
        temPatrimonioLiquidoSimEl.addEventListener("change", () => {
            patrimonioLiquidoContainerEl.style.display = "block";
        });
        temPatrimonioLiquidoNaoEl.addEventListener("change", () => {
            patrimonioLiquidoContainerEl.style.display = "none";
        });
        
        // Inicializar estado
        if (temPatrimonioLiquidoSimEl.checked) {
            patrimonioLiquidoContainerEl.style.display = "block";
        }
    }
    
    if (temDividasSimEl && temDividasNaoEl && dividasContainerEl) {
        temDividasSimEl.addEventListener("change", () => {
            dividasContainerEl.style.display = "block";
        });
        temDividasNaoEl.addEventListener("change", () => {
            dividasContainerEl.style.display = "none";
        });
        
        // Inicializar estado
        if (temDividasSimEl.checked) {
            dividasContainerEl.style.display = "block";
        }
    }
    
    // Eventos para adicionar entradas dinâmicas
    if (addPessoaBtnEl) {
        addPessoaBtnEl.addEventListener("click", addPessoaEntry);
    }
    
    if (addDependenteBtnEl) {
        addDependenteBtnEl.addEventListener("click", addDependenteEntry);
    }
    
    if (addPatrimonioBtnEl) {
        addPatrimonioBtnEl.addEventListener("click", addPatrimonioEntry);
    }
    
    if (addPatrimonioLiquidoBtnEl) {
        addPatrimonioLiquidoBtnEl.addEventListener("click", addPatrimonioLiquidoEntry);
    }
    
    if (addDividaBtnEl) {
        addDividaBtnEl.addEventListener("click", addDividaEntry);
    }
    
    // Evento para atualizar seções dinâmicas quando o nome mudar
    const nomeCompletoInput = document.getElementById("nome_completo");
    if (nomeCompletoInput) {
        nomeCompletoInput.addEventListener('input', updateDynamicFormSections);
    }
    
    // Inicializar seções dinâmicas
    updateDynamicFormSections();
    
    // Preencher dados existentes se houver
    if (formData) {
        // Preencher outras pessoas com renda
        if (formData.renda_unica === "nao" && formData.outras_pessoas && formData.outras_pessoas.length > 0) {
            formData.outras_pessoas.forEach(pessoa => {
                addPessoaEntry();
                const lastEntry = document.querySelector("#pessoas-list .dynamic-entry-item:last-child");
                if (lastEntry) {
                    const nomeInput = lastEntry.querySelector('input[name="pessoa_nome"]');
                    const autorizacaoSelect = lastEntry.querySelector('select[name="pessoa_autorizacao"]');
                    if (nomeInput) nomeInput.value = pessoa.nome || '';
                    if (autorizacaoSelect) autorizacaoSelect.value = pessoa.autorizacao || '';
                }
            });
        }
        
        // Preencher dependentes
        if (formData.tem_dependentes === "sim" && formData.dependentes && formData.dependentes.length > 0) {
            formData.dependentes.forEach(dependente => {
                addDependenteEntry();
                const lastEntry = document.querySelector("#dependentes-list .dynamic-entry-item:last-child");
                if (lastEntry) {
                    const nomeInput = lastEntry.querySelector('input[name="dep_nome"]');
                    const idadeInput = lastEntry.querySelector('input[name="dep_idade"]');
                    const relacaoInput = lastEntry.querySelector('input[name="dep_relacao"]');
                    if (nomeInput) nomeInput.value = dependente.nome || '';
                    if (idadeInput) idadeInput.value = dependente.idade || '';
                    if (relacaoInput) relacaoInput.value = dependente.relacao || '';
                }
            });
        }
        
        // Preencher patrimônio físico
        if (formData.tem_patrimonio === "sim" && formData.patrimonios && formData.patrimonios.length > 0) {
            formData.patrimonios.forEach((patrimonio, index) => {
                addPatrimonioEntry();
                const lastEntry = document.querySelector("#patrimonio-list .dynamic-entry-item:last-child");
                if (lastEntry) {
                    const qualInput = lastEntry.querySelector('input[name="patrimonio_qual"]');
                    const valorInput = lastEntry.querySelector('input[name="patrimonio_valor"]');
                    const seguroSimRadio = lastEntry.querySelector(`input[name="patrimonio_seguro_${index}"][value="sim"]`);
                    const seguroNaoRadio = lastEntry.querySelector(`input[name="patrimonio_seguro_${index}"][value="nao"]`);
                    const seguroNaoSeiRadio = lastEntry.querySelector(`input[name="patrimonio_seguro_${index}"][value="nao_sei"]`);
                    const quitadoSimRadio = lastEntry.querySelector(`input[name="patrimonio_quitado_${index}"][value="sim"]`);
                    const quitadoNaoRadio = lastEntry.querySelector(`input[name="patrimonio_quitado_${index}"][value="nao"]`);
                    const quitadoNaoSeiRadio = lastEntry.querySelector(`input[name="patrimonio_quitado_${index}"][value="nao_sei"]`);
                    
                    if (qualInput) qualInput.value = patrimonio.qual || '';
                    if (valorInput) valorInput.value = patrimonio.valor ? formatCurrency(patrimonio.valor) : '';
                    
                    if (patrimonio.seguro === "sim" && seguroSimRadio) seguroSimRadio.checked = true;
                    else if (patrimonio.seguro === "nao" && seguroNaoRadio) seguroNaoRadio.checked = true;
                    else if (patrimonio.seguro === "nao_sei" && seguroNaoSeiRadio) seguroNaoSeiRadio.checked = true;
                    
                    if (patrimonio.quitado === "sim" && quitadoSimRadio) quitadoSimRadio.checked = true;
                    else if (patrimonio.quitado === "nao" && quitadoNaoRadio) quitadoNaoRadio.checked = true;
                    else if (patrimonio.quitado === "nao_sei" && quitadoNaoSeiRadio) quitadoNaoSeiRadio.checked = true;
                }
            });
        }
        
        // Preencher patrimônio líquido
        if (formData.tem_patrimonio_liquido === "sim" && formData.patrimonios_liquidos && formData.patrimonios_liquidos.length > 0) {
            formData.patrimonios_liquidos.forEach(patrimonioLiquido => {
                addPatrimonioLiquidoEntry();
                const lastEntry = document.querySelector("#patrimonio-liquido-list .dynamic-entry-item:last-child");
                if (lastEntry) {
                    const qualInput = lastEntry.querySelector('input[name="patrimonio_liquido_qual"]');
                    const valorInput = lastEntry.querySelector('input[name="patrimonio_liquido_valor"]');
                    
                    if (qualInput) qualInput.value = patrimonioLiquido.qual || '';
                    if (valorInput) valorInput.value = patrimonioLiquido.valor ? formatCurrency(patrimonioLiquido.valor) : '';
                }
            });
        }
        
        // Preencher dívidas
        if (formData.tem_dividas === "sim" && formData.dividas && formData.dividas.length > 0) {
            formData.dividas.forEach(divida => {
                addDividaEntry();
                const lastEntry = document.querySelector("#dividas-list .dynamic-entry-item:last-child");
                if (lastEntry) {
                    const qualInput = lastEntry.querySelector('input[name="divida_qual"]');
                    const valorInput = lastEntry.querySelector('input[name="divida_valor"]');
                    const parcelaInput = lastEntry.querySelector('input[name="divida_parcela"]');
                    const parcelasRestantesInput = lastEntry.querySelector('input[name="divida_parcelas_restantes"]');
                    
                    if (qualInput) qualInput.value = divida.qual || '';
                    if (valorInput) valorInput.value = divida.valor ? formatCurrency(divida.valor) : '';
                    if (parcelaInput) parcelaInput.value = divida.parcela ? formatCurrency(divida.parcela) : '';
                    if (parcelasRestantesInput) parcelasRestantesInput.value = divida.parcelas_restantes || '';
                }
            });
        }
    }
    
    // Evento de envio do formulário
    if (clientResponseFormEl) {
        clientResponseFormEl.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            try {
                const formData = new FormData(clientResponseFormEl);
                const nomeCompleto = formData.get("nome_completo");
                const rendaUnica = formData.get("renda_unica");
                const temDependentes = formData.get("tem_dependentes");
                const temPatrimonio = formData.get("tem_patrimonio");
                const temPatrimonioLiquido = formData.get("tem_patrimonio_liquido");
                const temDividas = formData.get("tem_dividas");
                
                if (!nomeCompleto || !rendaUnica || !temDependentes || !temPatrimonio || !temPatrimonioLiquido || !temDividas) {
                    showMessage("error", "Por favor, preencha todos os campos obrigatórios.");
                    return;
                }
                
                // Coletar dados de outras pessoas com renda
                const outrasPessoas = [];
                if (rendaUnica === "nao") {
                    const pessoasEntries = document.querySelectorAll("#pessoas-list .dynamic-entry-item");
                    pessoasEntries.forEach(entry => {
                        const nome = entry.querySelector('input[name="pessoa_nome"]').value.trim();
                        const autorizacao = entry.querySelector('select[name="pessoa_autorizacao"]').value;
                        if (nome) {
                            outrasPessoas.push({
                                nome,
                                autorizacao
                            });
                        }
                    });
                }
                
                // Coletar dados de dependentes
                const dependentes = [];
                if (temDependentes === "sim") {
                    const dependentesEntries = document.querySelectorAll("#dependentes-list .dynamic-entry-item");
                    dependentesEntries.forEach(entry => {
                        const nome = entry.querySelector('input[name="dep_nome"]').value.trim();
                        const idade = entry.querySelector('input[name="dep_idade"]').value;
                        const relacao = entry.querySelector('input[name="dep_relacao"]').value.trim();
                        if (nome && idade && relacao) {
                            dependentes.push({
                                nome,
                                idade: parseInt(idade, 10),
                                relacao
                            });
                        }
                    });
                }
                
                // Coletar dados de plano de saúde
                const planosSaude = {};
                document.querySelectorAll("#plano-saude-section-content .plano-saude-entry").forEach(entry => {
                    const personName = entry.dataset.personName;
                    const personType = entry.dataset.personType;
                    const radioName = entry.querySelector('input[type="radio"]').name;
                    const selectedValue = entry.querySelector(`input[name="${radioName}"]:checked`)?.value;
                    if (personName && selectedValue) {
                        planosSaude[personName] = {
                            tipo: personType,
                            possui: selectedValue
                        };
                    }
                });
                
                // Coletar dados de seguro de vida
                const segurosVida = {};
                document.querySelectorAll("#seguro-vida-section-content .seguro-vida-entry").forEach(entry => {
                    const personName = entry.dataset.personName;
                    const personType = entry.dataset.personType;
                    const radioName = entry.querySelector('input[type="radio"]').name;
                    const selectedValue = entry.querySelector(`input[name="${radioName}"]:checked`)?.value;
                    if (personName && selectedValue) {
                        segurosVida[personName] = {
                            tipo: personType,
                            possui: selectedValue
                        };
                    }
                });
                
                // Coletar dados de imposto de renda
                const impostosRenda = {};
                document.querySelectorAll("#imposto-renda-section-content .imposto-renda-entry").forEach(entry => {
                    const personName = entry.dataset.personName;
                    const personType = entry.dataset.personType;
                    const radioName = entry.querySelector('input[type="radio"]').name;
                    const selectedValue = entry.querySelector(`input[name="${radioName}"]:checked`)?.value;
                    
                    if (personName && selectedValue) {
                        const impostoInfo = {
                            tipo: personType,
                            declara: selectedValue
                        };
                        
                        // Se declara imposto de renda, coletar informações adicionais
                        if (selectedValue === "sim") {
                            const tipoIR = entry.querySelector(`input[name="${radioName}_tipo"]:checked`)?.value;
                            const resultadoIR = entry.querySelector(`input[name="${radioName}_resultado"]:checked`)?.value;
                            
                            if (tipoIR) impostoInfo.tipo_ir = tipoIR;
                            if (resultadoIR) impostoInfo.resultado_ir = resultadoIR;
                        }
                        
                        impostosRenda[personName] = impostoInfo;
                    }
                });
                
                // Coletar dados de orçamento
                const orcamento = {};
                const entradasInput = document.querySelector('input[name="orcamento_entradas"]');
                const despesasFixasInput = document.querySelector('input[name="orcamento_despesas_fixas"]');
                const despesasVariaveisInput = document.querySelector('input[name="orcamento_despesas_variaveis"]');
                const valorPoupadoInput = document.querySelector('input[name="orcamento_valor_poupado"]');
                
                if (entradasInput) orcamento.entradas = parseCurrency(entradasInput.value);
                if (despesasFixasInput) orcamento.despesas_fixas = parseCurrency(despesasFixasInput.value);
                if (despesasVariaveisInput) orcamento.despesas_variaveis = parseCurrency(despesasVariaveisInput.value);
                if (valorPoupadoInput) orcamento.valor_poupado = parseCurrency(valorPoupadoInput.value);
                
                // Coletar dados de patrimônio físico
                const patrimonios = [];
                if (temPatrimonio === "sim") {
                    const patrimonioEntries = document.querySelectorAll("#patrimonio-list .dynamic-entry-item");
                    patrimonioEntries.forEach(entry => {
                        const qual = entry.querySelector('input[name="patrimonio_qual"]').value.trim();
                        const valorRaw = entry.querySelector('input[name="patrimonio_valor"]').value;
                        const valor = parseCurrency(valorRaw);
                        
                        // Encontrar os radio buttons de seguro e quitado para este patrimônio
                        const radioButtons = entry.querySelectorAll('input[type="radio"]');
                        let seguro = null;
                        let quitado = null;
                        
                        radioButtons.forEach(radio => {
                            if (radio.name.includes('patrimonio_seguro') && radio.checked) {
                                seguro = radio.value;
                            }
                            if (radio.name.includes('patrimonio_quitado') && radio.checked) {
                                quitado = radio.value;
                            }
                        });
                        
                        if (qual && valor !== null && seguro && quitado) {
                            patrimonios.push({
                                qual,
                                valor,
                                seguro,
                                quitado
                            });
                        }
                    });
                }
                
                // Coletar dados de patrimônio líquido
                const patrimoniosLiquidos = [];
                if (temPatrimonioLiquido === "sim") {
                    const patrimonioLiquidoEntries = document.querySelectorAll("#patrimonio-liquido-list .dynamic-entry-item");
                    patrimonioLiquidoEntries.forEach(entry => {
                        const qual = entry.querySelector('input[name="patrimonio_liquido_qual"]').value.trim();
                        const valorRaw = entry.querySelector('input[name="patrimonio_liquido_valor"]').value;
                        const valor = parseCurrency(valorRaw);
                        
                        if (qual && valor !== null) {
                            patrimoniosLiquidos.push({
                                qual,
                                valor
                            });
                        }
                    });
                }
                
                // Coletar dados de dívidas
                const dividas = [];
                if (temDividas === "sim") {
                    const dividaEntries = document.querySelectorAll("#dividas-list .dynamic-entry-item");
                    dividaEntries.forEach(entry => {
                        const qual = entry.querySelector('input[name="divida_qual"]').value.trim();
                        const valorRaw = entry.querySelector('input[name="divida_valor"]').value;
                        const parcelaRaw = entry.querySelector('input[name="divida_parcela"]').value;
                        const parcelasRestantes = entry.querySelector('input[name="divida_parcelas_restantes"]').value;
                        
                        const valor = parseCurrency(valorRaw);
                        const parcela = parseCurrency(parcelaRaw);
                        
                        if (qual && valor !== null && parcela !== null && parcelasRestantes) {
                            dividas.push({
                                qual,
                                valor,
                                parcela,
                                parcelas_restantes: parseInt(parcelasRestantes, 10)
                            });
                        }
                    });
                }
                
                // Preparar dados para envio
                const clienteData = {
                    nome_completo: nomeCompleto,
                    renda_unica: rendaUnica,
                    tem_dependentes: temDependentes,
                    tem_patrimonio: temPatrimonio,
                    tem_patrimonio_liquido: temPatrimonioLiquido,
                    tem_dividas: temDividas,
                    outras_pessoas: outrasPessoas,
                    dependentes,
                    planos_saude: planosSaude,
                    seguros_vida: segurosVida,
                    impostos_renda: impostosRenda,
                    orcamento,
                    patrimonios,
                    patrimonios_liquidos: patrimoniosLiquidos,
                    dividas
                };
                
                // Enviar dados para o servidor
                const { data, error } = await supabase
                    .from('formularios_clientes')
                    .update({
                        dados_formulario: clienteData,
                        status: 'preenchido',
                        data_preenchimento: new Date().toISOString()
                    })
                    .eq('token_unico', token);
                
                if (error) {
                    console.error("Erro ao enviar formulário:", error);
                    showMessage("error", "Ocorreu um erro ao enviar o formulário. Por favor, tente novamente.");
                    return;
                }
                
                // Mostrar mensagem de sucesso
                formContentEl.innerHTML = `
                    <div style="text-align: center; padding: 2rem;">
                        <h2 style="color: var(--planejamento-primary);">Formulário enviado com sucesso!</h2>
                        <p>Obrigado por preencher o formulário. Suas informações foram registradas.</p>
                    </div>
                `;
                
            } catch (err) {
                console.error("Erro ao processar formulário:", err);
                showMessage("error", "Ocorreu um erro ao processar o formulário. Por favor, tente novamente.");
            }
        });
    }
}

// Inicializar o formulário quando o DOM estiver carregado
document.addEventListener("DOMContentLoaded", initForm);

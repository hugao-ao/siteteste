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
    
    // Perguntas para outras pessoas com renda
    pessoasComRenda.filter(p => p.tipo === "outra_pessoa_renda").forEach(pessoa => {
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
    });
    
    restoreImpostoRendaSelections();
}

// Função para salvar as seleções de plano de saúde
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
    
    const pessoasComRenda = [];
    const nomeCompletoInput = document.getElementById("nome_completo");
    if (nomeCompletoInput && nomeCompletoInput.value.trim() !== "") {
        pessoasComRenda.push({ id: "preenchedor_plano", nome: sanitizeInput(nomeCompletoInput.value.trim()), tipo: "preenchedor" });
    }
    
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach((entry, index) => { 
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasComRenda.push({ id: `outra_pessoa_plano_${index}`, nome: sanitizeInput(nomeInput.value.trim()), tipo: "outra_pessoa_renda" });
            }
        });
    }
    
    const tituloPlanoSaude = document.getElementById("plano-saude-section-title");
    if (pessoasComRenda.length === 0) {
        container.innerHTML = "<p>Preencha as informações sobre nome e renda para definir as perguntas sobre plano de saúde.</p>";
        if(tituloPlanoSaude) tituloPlanoSaude.style.display = 'none';
        return;
    }
    
    if(tituloPlanoSaude) tituloPlanoSaude.style.display = 'block';
    
    pessoasComRenda.forEach((pessoa) => {
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

// Função para salvar as seleções de seguro de vida
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
                <div class="radio-options-inline-patrimonio-item">
                    <input type="radio" id="patrimonio_seguro_${patrimonioIndex}_sim" name="patrimonio_seguro_${patrimonioIndex}" value="sim" required> <label for="patrimonio_seguro_${patrimonioIndex}_sim">Sim</label>
                    <input type="radio" id="patrimonio_seguro_${patrimonioIndex}_nao" name="patrimonio_seguro_${patrimonioIndex}" value="nao"> <label for="patrimonio_seguro_${patrimonioIndex}_nao">Não</label>
                </div>
            </div>
            <div class="patrimonio-radio-group-item">
                <label>Está quitado?</label>
                <div class="radio-options-inline-patrimonio-item">
                    <input type="radio" id="patrimonio_quitado_${patrimonioIndex}_sim" name="patrimonio_quitado_${patrimonioIndex}" value="sim" required> <label for="patrimonio_quitado_${patrimonioIndex}_sim">Sim</label>
                    <input type="radio" id="patrimonio_quitado_${patrimonioIndex}_nao" name="patrimonio_quitado_${patrimonioIndex}" value="nao"> <label for="patrimonio_quitado_${patrimonioIndex}_nao">Não</label>
                </div>
            </div>
        </div>
        <button type="button" class="remove-dynamic-entry-btn remove-patrimonio-btn">Remover</button>
    `;
    patrimonioListEl.appendChild(entryDiv);
    const currencyInput = entryDiv.querySelector(".currency-input");
    if (currencyInput) {
        currencyInput.addEventListener('input', (e) => {
            const rawValue = e.target.value.replace(/[^\d]/g, '');
            if (rawValue) {
                const number = parseInt(rawValue, 10) / 100;
                e.target.value = number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } else {
                e.target.value = '';
            }
        });
        currencyInput.addEventListener('blur', (e) => {
            const rawValue = e.target.value.replace(/[^\d]/g, '');
            if (rawValue) {
                const number = parseInt(rawValue, 10) / 100;
                e.target.value = number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } else {
                e.target.value = '';
            }
        });
    }
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
        <input type="text" name="patrimonio_liquido_qual" placeholder="Qual? (Ex: Poupança, Tesouro Direto, CDB)" required class="form-input">
        <input type="text" name="patrimonio_liquido_valor" placeholder="Quanto? (R$)" required class="form-input currency-input">
        <button type="button" class="remove-dynamic-entry-btn remove-patrimonio-liquido-btn">Remover</button>
    `;
    patrimonioLiquidoListEl.appendChild(entryDiv);
    const currencyInput = entryDiv.querySelector(".currency-input");
    if (currencyInput) {
        currencyInput.addEventListener('input', (e) => {
            const rawValue = e.target.value.replace(/[^\d]/g, '');
            if (rawValue) {
                const number = parseInt(rawValue, 10) / 100;
                e.target.value = number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } else {
                e.target.value = '';
            }
        });
        currencyInput.addEventListener('blur', (e) => {
            const rawValue = e.target.value.replace(/[^\d]/g, '');
            if (rawValue) {
                const number = parseInt(rawValue, 10) / 100;
                e.target.value = number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } else {
                e.target.value = '';
            }
        });
    }
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
        <input type="text" name="divida_credor" placeholder="A quem deve? (Ex: Banco X, Cartão Y)" required class="form-input">
        <input type="text" name="divida_saldo" placeholder="Saldo Devedor Atual (R$)" required class="form-input currency-input">
        <button type="button" class="remove-dynamic-entry-btn remove-divida-btn">Remover</button>
    `;
    dividasListEl.appendChild(entryDiv);
    const currencyInput = entryDiv.querySelector(".currency-input");
    if (currencyInput) {
        currencyInput.addEventListener('input', (e) => {
            const rawValue = e.target.value.replace(/[^\d]/g, '');
            if (rawValue) {
                const number = parseInt(rawValue, 10) / 100;
                e.target.value = number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } else {
                e.target.value = '';
            }
        });
        currencyInput.addEventListener('blur', (e) => {
            const rawValue = e.target.value.replace(/[^\d]/g, '');
            if (rawValue) {
                const number = parseInt(rawValue, 10) / 100;
                e.target.value = number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } else {
                e.target.value = '';
            }
        });
    }
}

function attachFormEventListeners(formId) {
    const clientResponseFormEl = document.getElementById("client-response-form");
    const nomeCompletoInput = document.getElementById("nome_completo");
    const rendaUnicaSimRadio = document.getElementById("renda_unica_sim");
    const rendaUnicaNaoRadio = document.getElementById("renda_unica_nao");
    const outrasPessoasContainerEl = document.getElementById("outras-pessoas-renda-container");
    const addPersonBtn = document.getElementById("add-person-btn");
    const pessoasListEl = document.getElementById("pessoas-list");

    const temDependentesSimRadio = document.getElementById("tem_dependentes_sim");
    const temDependentesNaoRadio = document.getElementById("tem_dependentes_nao");
    const dependentesContainerEl = document.getElementById("dependentes-container");
    const addDependenteBtn = document.getElementById("add-dependente-btn");
    const dependentesListEl = document.getElementById("dependentes-list");

    const temPatrimonioSimRadio = document.getElementById("tem_patrimonio_sim");
    const temPatrimonioNaoRadio = document.getElementById("tem_patrimonio_nao");
    const patrimonioListContainerEl = document.getElementById("patrimonio-list-container");
    const addPatrimonioBtn = document.getElementById("add-patrimonio-btn");
    const patrimonioListEl = document.getElementById("patrimonio-list");

    const temPatrimonioLiquidoSimRadio = document.getElementById("tem_patrimonio_liquido_sim");
    const temPatrimonioLiquidoNaoRadio = document.getElementById("tem_patrimonio_liquido_nao");
    const patrimonioLiquidoListContainerEl = document.getElementById("patrimonio-liquido-list-container");
    const addPatrimonioLiquidoBtn = document.getElementById("add-patrimonio-liquido-btn");
    const patrimonioLiquidoListEl = document.getElementById("patrimonio-liquido-list");

    const temDividasSimRadio = document.getElementById("tem_dividas_sim");
    const temDividasNaoRadio = document.getElementById("tem_dividas_nao");
    const dividasListContainerEl = document.getElementById("dividas-list-container");
    const addDividaBtn = document.getElementById("add-divida-btn");
    const dividasListEl = document.getElementById("dividas-list");

    // Adicionar event listeners para os campos de orçamento
    const orcamentoInputs = document.querySelectorAll("#orcamento-section .currency-input");
    if (orcamentoInputs.length > 0) {
        orcamentoInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const rawValue = e.target.value.replace(/[^\d]/g, '');
                if (rawValue) {
                    const number = parseInt(rawValue, 10) / 100;
                    e.target.value = number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                } else {
                    e.target.value = '';
                }
            });
            
            input.addEventListener('blur', (e) => {
                const rawValue = e.target.value.replace(/[^\d]/g, '');
                if (rawValue) {
                    const number = parseInt(rawValue, 10) / 100;
                    e.target.value = number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                } else {
                    e.target.value = '';
                }
            });
        });
    }

    if (nomeCompletoInput) {
        nomeCompletoInput.addEventListener("input", () => {
            updateDynamicFormSections();
        });
    }

    if (rendaUnicaSimRadio) {
        rendaUnicaSimRadio.addEventListener("change", () => {
            outrasPessoasContainerEl.style.display = "none";
            pessoasListEl.innerHTML = ''; 
            updateDynamicFormSections();
        });
    }
    if (rendaUnicaNaoRadio) {
        rendaUnicaNaoRadio.addEventListener("change", () => {
            outrasPessoasContainerEl.style.display = "block";
            updateDynamicFormSections();
        });
    }

    if (addPersonBtn) {
        addPersonBtn.addEventListener("click", () => {
            const personIndex = pessoasListEl.children.length;
            const newPersonEntry = document.createElement("div");
            newPersonEntry.classList.add("dynamic-entry-item"); 
            newPersonEntry.innerHTML = `
                <input type="text" name="pessoa_nome" placeholder="Nome da pessoa" required>
                <label>Você precisa de autorização de <span class="person-name-placeholder"></span> para tomar decisões financeiras e agir?</label>
                <select name="pessoa_autorizacao" required>
                    <option value="" disabled selected>Selecione</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                </select>
                <button type="button" class="remove-dynamic-entry-btn">Remover</button>
            `;
            pessoasListEl.appendChild(newPersonEntry);
            const nomeInput = newPersonEntry.querySelector('input[name="pessoa_nome"]');
            const placeholder = newPersonEntry.querySelector('.person-name-placeholder');
            placeholder.textContent = "esta pessoa"; 

            nomeInput.addEventListener('input', () => {
                const primeiroNome = nomeInput.value.trim().split(' ')[0];
                placeholder.textContent = primeiroNome ? capitalizeName(primeiroNome) : "esta pessoa";
                updateDynamicFormSections(); 
            });

            newPersonEntry.querySelector(".remove-dynamic-entry-btn").addEventListener("click", () => { 
                newPersonEntry.remove();
                updateDynamicFormSections();
            });
            updateDynamicFormSections(); 
        });
    }

    if (temDependentesSimRadio) {
        temDependentesSimRadio.addEventListener("change", () => {
            dependentesContainerEl.style.display = "block";
            updateDynamicFormSections();
        });
    }
    if (temDependentesNaoRadio) {
        temDependentesNaoRadio.addEventListener("change", () => {
            dependentesContainerEl.style.display = "none";
            dependentesListEl.innerHTML = ''; 
            updateDynamicFormSections();
        });
    }

    if (addDependenteBtn) {
        addDependenteBtn.addEventListener("click", () => {
            const dependenteIndex = dependentesListEl.children.length;
            const newDependenteEntry = document.createElement("div");
            newDependenteEntry.classList.add("dynamic-entry-item"); 
            newDependenteEntry.innerHTML = `
                <input type="text" name="dependente_nome" placeholder="Nome do dependente" required>
                <input type="number" name="dependente_idade" placeholder="Idade" min="0" max="120" required>
                <select name="dependente_relacao" required>
                    <option value="" disabled selected>Relação</option>
                    <option value="filho(a)">Filho(a)</option>
                    <option value="pet">Pet</option>
                    <option value="pai/mãe">Pai/Mãe</option>
                    <option value="outro">Outro</option>
                </select>
                <button type="button" class="remove-dynamic-entry-btn">Remover</button>
            `;
            dependentesListEl.appendChild(newDependenteEntry);
            newDependenteEntry.querySelector(".remove-dynamic-entry-btn").addEventListener("click", () => { 
                newDependenteEntry.remove();
            });
        });
    }

    if (temPatrimonioSimRadio) {
        temPatrimonioSimRadio.addEventListener("change", () => {
            patrimonioListContainerEl.style.display = "block";
            if (patrimonioListEl.children.length === 0) {
                addPatrimonioEntry(); 
            }
        });
    }
    if (temPatrimonioNaoRadio) {
        temPatrimonioNaoRadio.addEventListener("change", () => {
            patrimonioListContainerEl.style.display = "none";
            patrimonioListEl.innerHTML = ''; 
        });
    }

    if (addPatrimonioBtn) {
        addPatrimonioBtn.addEventListener("click", addPatrimonioEntry);
    }

    if (temPatrimonioLiquidoSimRadio) {
        temPatrimonioLiquidoSimRadio.addEventListener("change", () => {
            patrimonioLiquidoListContainerEl.style.display = "block";
            if (patrimonioLiquidoListEl.children.length === 0) {
                addPatrimonioLiquidoEntry(); 
            }
        });
    }
    if (temPatrimonioLiquidoNaoRadio) {
        temPatrimonioLiquidoNaoRadio.addEventListener("change", () => {
            patrimonioLiquidoListContainerEl.style.display = "none";
            patrimonioLiquidoListEl.innerHTML = ''; 
        });
    }

    if (addPatrimonioLiquidoBtn) {
        addPatrimonioLiquidoBtn.addEventListener("click", addPatrimonioLiquidoEntry);
    }

    if (temDividasSimRadio) {
        temDividasSimRadio.addEventListener("change", () => {
            dividasListContainerEl.style.display = "block";
            if (dividasListEl.children.length === 0) {
                addDividaEntry(); 
            }
        });
    }
    if (temDividasNaoRadio) {
        temDividasNaoRadio.addEventListener("change", () => {
            dividasListContainerEl.style.display = "none";
            dividasListEl.innerHTML = ''; 
        });
    }

    if (addDividaBtn) {
        addDividaBtn.addEventListener("click", addDividaEntry);
    }

    if (clientResponseFormEl) {
        clientResponseFormEl.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            try {
                // Validar formulário
                const nomeCompleto = nomeCompletoInput.value.trim();
                if (!nomeCompleto) {
                    throw new Error("Por favor, informe seu nome completo.");
                }
                
                // Verificar se a opção de renda única foi selecionada
                const rendaUnica = document.querySelector('input[name="renda_unica"]:checked')?.value;
                if (!rendaUnica) {
                    throw new Error("Por favor, informe se você é a única pessoa com renda na casa.");
                }
                
                // Coletar dados de outras pessoas com renda
                const outrasPessoas = [];
                if (rendaUnica === "nao") {
                    const pessoaEntries = document.querySelectorAll("#pessoas-list .dynamic-entry-item");
                    pessoaEntries.forEach(entry => {
                        const nome = entry.querySelector('input[name="pessoa_nome"]').value.trim();
                        const autorizacao = entry.querySelector('select[name="pessoa_autorizacao"]').value;
                        
                        if (nome && autorizacao) {
                            outrasPessoas.push({
                                nome,
                                autorizacao
                            });
                        }
                    });
                    
                    if (pessoaEntries.length > 0 && outrasPessoas.length === 0) {
                        throw new Error("Por favor, preencha corretamente as informações das outras pessoas com renda.");
                    }
                }
                
                // Verificar se a opção de dependentes foi selecionada
                const temDependentes = document.querySelector('input[name="tem_dependentes"]:checked')?.value;
                if (!temDependentes) {
                    throw new Error("Por favor, informe se você tem dependentes.");
                }
                
                // Coletar dados de dependentes
                const dependentes = [];
                if (temDependentes === "sim") {
                    const dependenteEntries = document.querySelectorAll("#dependentes-list .dynamic-entry-item");
                    dependenteEntries.forEach(entry => {
                        const nome = entry.querySelector('input[name="dependente_nome"]').value.trim();
                        const idade = parseInt(entry.querySelector('input[name="dependente_idade"]').value, 10);
                        const relacao = entry.querySelector('select[name="dependente_relacao"]').value;
                        
                        if (nome && !isNaN(idade) && relacao) {
                            dependentes.push({
                                nome,
                                idade,
                                relacao
                            });
                        }
                    });
                    
                    if (dependenteEntries.length > 0 && dependentes.length === 0) {
                        throw new Error("Por favor, preencha corretamente as informações dos dependentes.");
                    }
                }
                
                // Coletar dados de planos de saúde
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
                
                // Coletar dados de seguros de vida
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
                
                // Verificar se a opção de patrimônio foi selecionada
                const temPatrimonio = document.querySelector('input[name="tem_patrimonio"]:checked')?.value;
                if (!temPatrimonio) {
                    throw new Error("Por favor, informe se você possui patrimônio físico.");
                }
                
                // Coletar dados de patrimônio
                const patrimonios = [];
                if (temPatrimonio === "sim") {
                    const patrimonioEntries = document.querySelectorAll("#patrimonio-list .dynamic-entry-item");
                    patrimonioEntries.forEach(entry => {
                        const qual = entry.querySelector('input[name="patrimonio_qual"]').value.trim();
                        const valorRaw = entry.querySelector('input[name="patrimonio_valor"]').value;
                        const valor = parseCurrency(valorRaw);
                        
                        let seguro = null;
                        let quitado = null;
                        
                        // Encontrar os radio buttons de seguro e quitado para este item
                        entry.querySelectorAll('input[type="radio"]').forEach(radio => {
                            if (radio.name.startsWith("patrimonio_seguro_") && radio.checked) {
                                seguro = radio.value;
                            }
                            if (radio.name.startsWith("patrimonio_quitado_") && radio.checked) {
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
                
                // Verificar se a opção de patrimônio líquido foi selecionada
                const temPatrimonioLiquido = document.querySelector('input[name="tem_patrimonio_liquido"]:checked')?.value;
                if (!temPatrimonioLiquido) {
                    throw new Error("Por favor, informe se você possui dinheiro guardado ou investido.");
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
                
                // Verificar se a opção de dívidas foi selecionada
                const temDividas = document.querySelector('input[name="tem_dividas"]:checked')?.value;
                if (!temDividas) {
                    throw new Error("Por favor, informe se você possui dívidas.");
                }
                
                // Coletar dados de dívidas
                const dividas = [];
                if (temDividas === "sim") {
                    const dividaEntries = document.querySelectorAll("#dividas-list .dynamic-entry-item");
                    dividaEntries.forEach(entry => {
                        const credor = entry.querySelector('input[name="divida_credor"]').value.trim();
                        const saldoRaw = entry.querySelector('input[name="divida_saldo"]').value;
                        const saldo = parseCurrency(saldoRaw);
                        
                        if (credor && saldo !== null) {
                            dividas.push({
                                credor,
                                saldo
                            });
                        }
                    });
                }
                
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
                        
                        // Se a resposta for "sim", coletar tipo e resultado
                        if (selectedValue === "sim") {
                            const tipoRadioName = `${radioName}_tipo`;
                            const resultadoRadioName = `${radioName}_resultado`;
                            
                            const tipoSelectedValue = entry.querySelector(`input[name="${tipoRadioName}"]:checked`)?.value;
                            const resultadoSelectedValue = entry.querySelector(`input[name="${resultadoRadioName}"]:checked`)?.value;
                            
                            if (tipoSelectedValue) {
                                impostoInfo.tipo_ir = tipoSelectedValue;
                            }
                            
                            if (resultadoSelectedValue) {
                                impostoInfo.resultado_ir = resultadoSelectedValue;
                            }
                        }
                        
                        impostosRenda[personName] = impostoInfo;
                    }
                });
                
                // Coletar dados de orçamento
                const receitaMensalRaw = document.getElementById("receita_mensal_total").value;
                const despesasFixasRaw = document.getElementById("despesas_fixas_total").value;
                const despesasVariaveisRaw = document.getElementById("despesas_variaveis_total").value;
                const poupancaInvestimentosRaw = document.getElementById("poupanca_investimentos_total").value;

                const receitaMensal = parseCurrency(receitaMensalRaw);
                const despesasFixas = parseCurrency(despesasFixasRaw);
                const despesasVariaveis = parseCurrency(despesasVariaveisRaw);
                const poupancaInvestimentos = parseCurrency(poupancaInvestimentosRaw);
                
                // Preparar dados para envio
                const dadosFormulario = {
                    nome_completo: nomeCompleto,
                    renda_unica: rendaUnica,
                    outras_pessoas: outrasPessoas,
                    tem_dependentes: temDependentes,
                    dependentes: dependentes,
                    planos_saude: planosSaude,
                    seguros_vida: segurosVida,
                    tem_patrimonio: temPatrimonio,
                    patrimonios: patrimonios,
                    tem_patrimonio_liquido: temPatrimonioLiquido,
                    patrimonios_liquidos: patrimoniosLiquidos,
                    tem_dividas: temDividas,
                    dividas: dividas,
                    impostos_renda: impostosRenda,
                    orcamento: {
                        receita_mensal: receitaMensal,
                        despesas_fixas: despesasFixas,
                        despesas_variaveis: despesasVariaveis,
                        poupanca_investimentos: poupancaInvestimentos
                    }
                };
                
                // Enviar dados para o servidor
                const { error } = await supabase
                    .from("formularios_clientes")
                    .update({
                        status: "preenchido",
                        dados_formulario: dadosFormulario,
                        data_preenchimento: new Date().toISOString()
                    })
                    .eq("id", formId);
                
                if (error) throw error;
                
                // Mostrar mensagem de sucesso
                formContentEl.innerHTML = `
                    <div class="success-message">
                        <h2>Formulário enviado com sucesso!</h2>
                        <p>Obrigado por preencher o formulário. Suas respostas foram registradas.</p>
                    </div>
                `;
                
            } catch (error) {
                console.error("Erro ao enviar formulário:", error);
                showMessage("error", `Erro ao enviar formulário: ${error.message}`);
            }
        });
    }
    
    // Adicionar listeners para remover entradas dinâmicas
    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("remove-dynamic-entry-btn")) {
            const entryItem = e.target.closest(".dynamic-entry-item");
            if (entryItem) {
                entryItem.remove();
                updateDynamicFormSections();
            }
        }
    });
}

// --- Inicialização ---
async function initForm() {
    try {
        // Obter token da URL
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get("token");
        
        if (!token) {
            formContentEl.innerHTML = `
                <div class="error-message">
                    <h2>Link inválido</h2>
                    <p>O link que você está tentando acessar é inválido ou expirou.</p>
                </div>
            `;
            return;
        }
        
        // Verificar se o token existe e está pendente
        const { data: formData, error } = await supabase
            .from("formularios_clientes")
            .select("id, cliente_id, status, dados_formulario")
            .eq("token_unico", token)
            .single();
        
        if (error || !formData) {
            formContentEl.innerHTML = `
                <div class="error-message">
                    <h2>Link inválido</h2>
                    <p>O link que você está tentando acessar é inválido ou expirou.</p>
                </div>
            `;
            return;
        }
        
        if (formData.status === "preenchido") {
            formContentEl.innerHTML = `
                <div class="info-message">
                    <h2>Formulário já preenchido</h2>
                    <p>Este formulário já foi preenchido anteriormente. Obrigado!</p>
                </div>
            `;
            return;
        }
        
        // Definir o título do formulário como "Formulário Pré Diagnóstico"
        formTitleEl.textContent = "Formulário Pré Diagnóstico";
        
        // Renderizar formulário
        renderForm(formData);
        
    } catch (error) {
        console.error("Erro ao inicializar formulário:", error);
        formContentEl.innerHTML = `
            <div class="error-message">
                <h2>Erro ao carregar formulário</h2>
                <p>Ocorreu um erro ao carregar o formulário. Por favor, tente novamente mais tarde.</p>
            </div>
        `;
    }
}

function renderForm(formData) {
    formContentEl.innerHTML = `
        <form id="client-response-form" class="client-form">
            <div class="form-group">
                <label for="nome_completo">Nome Completo:</label>
                <input type="text" id="nome_completo" name="nome_completo" required>
            </div>

            <div class="radio-group">
                <label>Você é a única pessoa com renda na casa?</label><br>
                <input type="radio" id="renda_unica_sim" name="renda_unica" value="sim" required>
                <label for="renda_unica_sim">Sim</label>
                <input type="radio" id="renda_unica_nao" name="renda_unica" value="nao">
                <label for="renda_unica_nao">Não</label>
            </div>

            <div id="outras-pessoas-renda-container" style="display:none;">
                <label>Outras pessoas com renda na casa:</label>
                <div id="pessoas-list"></div>
                <button type="button" id="add-person-btn" class="add-dynamic-entry-btn">+ Adicionar Pessoa com Renda</button>
            </div>

            <div class="radio-group" style="margin-top: 2rem;">
                <label id="label_tem_dependentes">Você tem filho/pet/outros parentes que dependem de você?</label><br>
                <input type="radio" id="tem_dependentes_sim" name="tem_dependentes" value="sim" required>
                <label for="tem_dependentes_sim">Sim</label>
                <input type="radio" id="tem_dependentes_nao" name="tem_dependentes" value="nao">
                <label for="tem_dependentes_nao">Não</label>
            </div>

            <div id="dependentes-container" style="display:none;">
                <label>Dependentes:</label>
                <div id="dependentes-list"></div>
                <button type="button" id="add-dependente-btn" class="add-dynamic-entry-btn">+ Adicionar Dependente</button>
            </div>
            
            <div id="plano-saude-section" style="margin-top: 2rem;">
                <h3 id="plano-saude-section-title" style="display: none;">Informações sobre Plano de Saúde:</h3>
                <div id="plano-saude-section-content"></div>
            </div>

            <div id="seguro-vida-section" style="margin-top: 2rem;">
                <h3 id="seguro-vida-section-title" style="display: none;">Informações sobre Seguro de Vida:</h3>
                <div id="seguro-vida-section-content"></div>
            </div>

            <div id="patrimonio-fisico-section" style="margin-top: 2rem;">
                 <div class="radio-group">
                    <label id="label_tem_patrimonio_fisico">Você possui patrimônio físico (imóvel, automóvel, jóias, outros...)?</label><br>
                    <div class="radio-options-inline-patrimonio">
                        <input type="radio" id="tem_patrimonio_sim" name="tem_patrimonio" value="sim" required>
                        <label for="tem_patrimonio_sim">Sim</label>
                        <input type="radio" id="tem_patrimonio_nao" name="tem_patrimonio" value="nao">
                        <label for="tem_patrimonio_nao">Não</label>
                    </div>
                </div>
                <div id="patrimonio-list-container" style="display:none;">
                    <label>Patrimônios Físicos:</label>
                    <div id="patrimonio-list"></div>
                    <button type="button" id="add-patrimonio-btn" class="add-dynamic-entry-btn">+ Adicionar Patrimônio Físico</button> 
                </div>
            </div>

            <div id="patrimonio-liquido-section" style="margin-top: 2rem;">
                 <div class="radio-group">
                    <label id="label_tem_patrimonio_liquido">Você possui patrimônio Dinheiro Guardado ou Investido?</label><br>
                    <div class="radio-options-inline-patrimonio">
                        <input type="radio" id="tem_patrimonio_liquido_sim" name="tem_patrimonio_liquido" value="sim" required>
                        <label for="tem_patrimonio_liquido_sim">Sim</label>
                        <input type="radio" id="tem_patrimonio_liquido_nao" name="tem_patrimonio_liquido" value="nao">
                        <label for="tem_patrimonio_liquido_nao">Não</label>
                    </div>
                </div>
                <div id="patrimonio-liquido-list-container" style="display:none;">
                    <label>Dinheiro Guardado ou Investido:</label>
                    <div id="patrimonio-liquido-list"></div>
                    <button type="button" id="add-patrimonio-liquido-btn" class="add-dynamic-entry-btn">Adicionar Dinheiro Guardado/Investido</button>
                </div>
            </div>

            <!-- Seção de Dívidas -->
            <div class="form-section" id="dividas-section">
                <div class="form-group">
                    <h3 id="label_tem_dividas" class="form-question-label" style="text-align: center !important; margin-bottom: 0.5rem;">Você possui dívidas?</h3>
                    <div class="radio-group" style="text-align: center;">
                        <input type="radio" id="tem_dividas_sim" name="tem_dividas" value="sim" required>
                        <label for="tem_dividas_sim" class="radio-label">Sim</label>
                        <input type="radio" id="tem_dividas_nao" name="tem_dividas" value="nao" required>
                        <label for="tem_dividas_nao" class="radio-label">Não</label>
                    </div>
                </div>
                <div id="dividas-list-container" class="dynamic-list-container" style="display: none;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: bold;">Dívidas:</label>
                    <div id="dividas-list" class="dynamic-list"></div>
                    <button type="button" id="add-divida-btn" class="add-dynamic-entry-btn">Adicionar Dívida</button>
                </div>
            </div>
            
            <!-- Nova seção de Imposto de Renda (após dívidas) -->
            <div id="imposto-renda-section" style="margin-top: 2rem;">
                <h3 id="imposto-renda-section-title" style="display: none;">Informações sobre Imposto de Renda:</h3>
                <div id="imposto-renda-section-content"></div>
            </div>

            <!-- Seção de Orçamento -->
            <div class="form-section" id="orcamento-section" style="margin-top: 2rem;">
                <h3 style="text-align: center !important; margin-bottom: 1.5rem; color: var(--theme-secondary-lighter);">Orçamento</h3>
                
                <div class="form-group">
                    <label for="receita_mensal_total" style="display: block; margin-bottom: 0.5rem; font-weight: bold; color: var(--theme-text-muted);">1- Receita Mensal Total:</label>
                    <input type="text" id="receita_mensal_total" name="receita_mensal_total" class="form-input currency-input" placeholder="R$ 0,00" required>
                </div>
                
                <div class="form-group" style="margin-top: 1rem;">
                    <label for="despesas_fixas_total" style="display: block; margin-bottom: 0.5rem; font-weight: bold; color: var(--theme-text-muted);">2- Despesas Fixas Mensais Totais (contas, boletos, assinaturas...):</label>
                    <input type="text" id="despesas_fixas_total" name="despesas_fixas_total" class="form-input currency-input" placeholder="R$ 0,00" required>
                </div>
                
                <div class="form-group" style="margin-top: 1rem;">
                    <label for="despesas_variaveis_total" style="display: block; margin-bottom: 0.5rem; font-weight: bold; color: var(--theme-text-muted);">3- Despesas Variáveis Mensais Totais (gasolina, feira, lazer...):</label>
                    <input type="text" id="despesas_variaveis_total" name="despesas_variaveis_total" class="form-input currency-input" placeholder="R$ 0,00" required>
                </div>
                
                <div class="form-group" style="margin-top: 1rem;">
                    <label for="poupanca_investimentos_total" style="display: block; margin-bottom: 0.5rem; font-weight: bold; color: var(--theme-text-muted);">4- Poupança/Investimentos Mensais Totais:</label>
                    <input type="text" id="poupanca_investimentos_total" name="poupanca_investimentos_total" class="form-input currency-input" placeholder="R$ 0,00" required>
                </div>
            </div>

            <div class="form-actions">
                <button type="submit" id="submit-btn" class="submit-button">Enviar Respostas</button>
            </div>
        </form>
    `;

    attachFormEventListeners(formData.id);
    updateDynamicFormSections(); 
}

document.addEventListener("DOMContentLoaded", initForm);

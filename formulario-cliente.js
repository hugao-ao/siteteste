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
    
    // Perguntas para outras pessoas com renda (se houver)
    if (temOutrasPessoasComRenda) {
        const outrasPessoas = pessoasComRenda.filter(p => p.tipo === "outra_pessoa_renda");
        outrasPessoas.forEach(pessoa => {
            const primeiroNome = pessoa.nome.split(' ')[0];
            const nomeCapitalizado = capitalizeName(primeiroNome);
            const personId = `imposto_renda_${pessoa.id}`;
            
            const entryDiv = document.createElement("div");
            entryDiv.classList.add("imposto-renda-entry");
            entryDiv.style.marginBottom = "1rem";
            entryDiv.innerHTML = `
                <label for="${personId}" style="display: block; margin-bottom: 0.5rem;">${nomeCapitalizado} declara imposto de renda?</label>
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
            entryDiv.dataset.personName = pessoa.nome;
            entryDiv.dataset.personType = pessoa.tipo;
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
        });
    }
    
    restoreImpostoRendaSelections();
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
    const pessoasDaCasa = [];
    const nomeCompletoInput = document.getElementById("nome_completo");
    if (nomeCompletoInput && nomeCompletoInput.value.trim() !== "") {
        pessoasDaCasa.push({ id: "preenchedor_seguro", nome: sanitizeInput(nomeCompletoInput.value.trim()), tipo: "preenchedor" });
    }
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach((entry, index) => { 
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasDaCasa.push({ id: `outra_pessoa_seguro_${index}`, nome: sanitizeInput(nomeInput.value.trim()), tipo: "outra_pessoa_renda" });
            }
        });
    }
    const tituloSeguroVida = document.getElementById("seguro-vida-section-title");
    if (pessoasDaCasa.length === 0) {
        container.innerHTML = "<p>Preencha as informações anteriores para definir as perguntas sobre seguro de vida.</p>";
        if(tituloSeguroVida) tituloSeguroVida.style.display = 'none';
        return;
    }
    if(tituloSeguroVida) tituloSeguroVida.style.display = 'block';
    pessoasDaCasa.forEach((pessoa) => {
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

function addPersonEntry() {
    const pessoasListEl = document.getElementById("pessoas-list");
    if (!pessoasListEl) {
        console.error("Elemento pessoas-list não encontrado para adicionar entrada de pessoa.");
        return;
    }

    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item"); 
    entryDiv.innerHTML = `
        <input type="text" name="pessoa_nome" placeholder="Nome completo" required class="form-input">
        <input type="text" name="pessoa_renda" placeholder="Renda mensal (R$)" required class="form-input currency-input">
        <button type="button" class="remove-dynamic-entry-btn remove-person-btn">Remover</button>
    `;
    pessoasListEl.appendChild(entryDiv);
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
        <input type="text" name="dep_idade" placeholder="Idade" required class="form-input">
        <button type="button" class="remove-dynamic-entry-btn remove-dependente-btn">Remover</button>
    `;
    dependentesListEl.appendChild(entryDiv);
}

function addPatrimonioEntry() {
    const patrimonioListEl = document.getElementById("patrimonio-list");
    if (!patrimonioListEl) {
        console.error("Elemento patrimonio-list não encontrado para adicionar entrada de patrimônio.");
        return;
    }

    const patrimonioIndex = patrimonioListEl.children.length;
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item", "patrimonio-entry"); 
    entryDiv.innerHTML = `
        <div class="patrimonio-inputs">
            <input type="text" name="patrimonio_qual" placeholder="Qual? (Ex: Casa, Carro)" required class="form-input">
            <input type="text" name="patrimonio_valor" placeholder="Quanto vale? (R$)" required class="form-input currency-input">
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

function addObjetivoEntry() {
    const objetivosListEl = document.getElementById("objetivos-list");
    if (!objetivosListEl) {
        console.error("Elemento objetivos-list não encontrado para adicionar entrada de objetivo.");
        return;
    }

    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item"); 
    entryDiv.innerHTML = `
        <input type="text" name="objetivo_descricao" placeholder="Descrição do objetivo" required class="form-input">
        <input type="text" name="objetivo_valor" placeholder="Valor estimado (R$)" required class="form-input currency-input">
        <button type="button" class="remove-dynamic-entry-btn remove-objetivo-btn">Remover</button>
    `;
    objetivosListEl.appendChild(entryDiv);
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
    // Adicionar listeners para mostrar/ocultar seções condicionais
    document.getElementById("renda_unica_sim").addEventListener("change", () => {
        document.getElementById("outras-pessoas-renda-container").style.display = "none";
        updateDynamicFormSections();
    });
    
    document.getElementById("renda_unica_nao").addEventListener("change", () => {
        document.getElementById("outras-pessoas-renda-container").style.display = "block";
        updateDynamicFormSections();
    });
    
    document.getElementById("tem_dependentes_sim").addEventListener("change", () => {
        document.getElementById("dependentes-container").style.display = "block";
    });
    
    document.getElementById("tem_dependentes_nao").addEventListener("change", () => {
        document.getElementById("dependentes-container").style.display = "none";
    });
    
    document.getElementById("tem_patrimonio_sim").addEventListener("change", () => {
        document.getElementById("patrimonio-list-container").style.display = "block";
    });
    
    document.getElementById("tem_patrimonio_nao").addEventListener("change", () => {
        document.getElementById("patrimonio-list-container").style.display = "none";
    });
    
    document.getElementById("tem_patrimonio_liquido_sim").addEventListener("change", () => {
        document.getElementById("patrimonio-liquido-list-container").style.display = "block";
    });
    
    document.getElementById("tem_patrimonio_liquido_nao").addEventListener("change", () => {
        document.getElementById("patrimonio-liquido-list-container").style.display = "none";
    });
    
    document.getElementById("tem_dividas_sim").addEventListener("change", () => {
        document.getElementById("dividas-list-container").style.display = "block";
    });
    
    document.getElementById("tem_dividas_nao").addEventListener("change", () => {
        document.getElementById("dividas-list-container").style.display = "none";
    });
    
    // Adicionar listeners para botões de adicionar entradas dinâmicas
    document.getElementById("add-person-btn").addEventListener("click", addPersonEntry);
    document.getElementById("add-dependente-btn").addEventListener("click", addDependenteEntry);
    document.getElementById("add-patrimonio-btn").addEventListener("click", addPatrimonioEntry);
    document.getElementById("add-patrimonio-liquido-btn").addEventListener("click", addPatrimonioLiquidoEntry);
    document.getElementById("add-divida-btn").addEventListener("click", addDividaEntry);
    document.getElementById("add-objetivo-btn").addEventListener("click", addObjetivoEntry);
    
    // Adicionar formatação de moeda em tempo real para o campo de orçamento
    const orcamentoInput = document.getElementById("orcamento_mensal");
    if (orcamentoInput) {
        orcamentoInput.addEventListener('input', (e) => {
            const rawValue = e.target.value.replace(/[^\d]/g, '');
            if (rawValue) {
                const number = parseInt(rawValue, 10) / 100;
                e.target.value = number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } else {
                e.target.value = '';
            }
        });
        orcamentoInput.addEventListener('blur', (e) => {
            const rawValue = e.target.value.replace(/[^\d]/g, '');
            if (rawValue) {
                const number = parseInt(rawValue, 10) / 100;
                e.target.value = number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } else {
                e.target.value = '';
            }
        });
    }
    
    // Adicionar listeners para remover entradas dinâmicas
    formContentEl.addEventListener("click", (e) => {
        if (e.target.classList.contains("remove-person-btn")) {
            e.target.closest(".dynamic-entry-item").remove();
            updateDynamicFormSections();
        } else if (e.target.classList.contains("remove-dependente-btn")) {
            e.target.closest(".dynamic-entry-item").remove();
            updateDynamicFormSections();
        } else if (e.target.classList.contains("remove-patrimonio-btn")) {
            e.target.closest(".dynamic-entry-item").remove();
        } else if (e.target.classList.contains("remove-patrimonio-liquido-btn")) {
            e.target.closest(".dynamic-entry-item").remove();
        } else if (e.target.classList.contains("remove-divida-btn")) {
            e.target.closest(".dynamic-entry-item").remove();
        } else if (e.target.classList.contains("remove-objetivo-btn")) {
            e.target.closest(".dynamic-entry-item").remove();
        }
    });
    
    // Adicionar listener para atualizar seções dinâmicas quando o nome completo mudar
    document.getElementById("nome_completo").addEventListener("input", () => {
        updateDynamicFormSections();
    });
    
    // Adicionar listener para o formulário
    document.getElementById(formId).addEventListener("submit", async (e) => {
        e.preventDefault();
        
        try {
            // Desabilitar botão de envio para evitar múltiplos envios
            const submitBtn = document.getElementById("submit-btn");
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Enviando...";
            }
            
            // Coletar dados básicos
            const nomeCompleto = document.getElementById("nome_completo").value.trim();
            const rendaUnica = document.querySelector('input[name="renda_unica"]:checked').value;
            
            // Coletar dados de outras pessoas com renda
            const outrasPessoas = [];
            if (rendaUnica === "nao") {
                const pessoaEntries = document.querySelectorAll("#pessoas-list .dynamic-entry-item");
                pessoaEntries.forEach(entry => {
                    const nome = entry.querySelector('input[name="pessoa_nome"]').value.trim();
                    const rendaRaw = entry.querySelector('input[name="pessoa_renda"]').value;
                    const renda = parseCurrency(rendaRaw);
                    
                    if (nome && renda !== null) {
                        outrasPessoas.push({
                            nome,
                            renda
                        });
                    }
                });
            }
            
            // Coletar dados de dependentes
            const temDependentes = document.querySelector('input[name="tem_dependentes"]:checked').value;
            const dependentes = [];
            if (temDependentes === "sim") {
                const dependenteEntries = document.querySelectorAll("#dependentes-list .dynamic-entry-item");
                dependenteEntries.forEach(entry => {
                    const nome = entry.querySelector('input[name="dep_nome"]').value.trim();
                    const idade = entry.querySelector('input[name="dep_idade"]').value.trim();
                    
                    if (nome && idade) {
                        dependentes.push({
                            nome,
                            idade
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
            
            // Coletar dados de patrimônio físico
            const temPatrimonio = document.querySelector('input[name="tem_patrimonio"]:checked').value;
            const patrimonios = [];
            if (temPatrimonio === "sim") {
                const patrimonioEntries = document.querySelectorAll("#patrimonio-list .dynamic-entry-item");
                patrimonioEntries.forEach(entry => {
                    const qual = entry.querySelector('input[name="patrimonio_qual"]').value.trim();
                    const valorRaw = entry.querySelector('input[name="patrimonio_valor"]').value;
                    const valor = parseCurrency(valorRaw);
                    
                    let seguro = null;
                    const seguroRadios = entry.querySelectorAll('input[name^="patrimonio_seguro_"]');
                    seguroRadios.forEach(radio => {
                        if (radio.checked) {
                            seguro = radio.value;
                        }
                    });
                    
                    let quitado = null;
                    const quitadoRadios = entry.querySelectorAll('input[name^="patrimonio_quitado_"]');
                    quitadoRadios.forEach(radio => {
                        if (radio.checked) {
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
            const temPatrimonioLiquido = document.querySelector('input[name="tem_patrimonio_liquido"]:checked').value;
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
            const temDividas = document.querySelector('input[name="tem_dividas"]:checked').value;
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
            
            // Coletar dados financeiros
            const orcamentoMensalInput = document.getElementById("orcamento_mensal");
            const orcamentoMensalRaw = orcamentoMensalInput ? orcamentoMensalInput.value : "";
            const orcamentoMensal = parseCurrency(orcamentoMensalRaw);
            
            // Coletar dados de objetivos
            const objetivos = [];
            const objetivoEntries = document.querySelectorAll("#objetivos-list .dynamic-entry-item");
            objetivoEntries.forEach(entry => {
                const descricao = entry.querySelector('input[name="objetivo_descricao"]').value.trim();
                const valorRaw = entry.querySelector('input[name="objetivo_valor"]').value;
                const valor = parseCurrency(valorRaw);
                
                if (descricao && valor !== null) {
                    objetivos.push({
                        descricao,
                        valor
                    });
                }
            });
            
            // Preparar dados para envio
            const dadosFormulario = {
                nome_completo: nomeCompleto,
                orcamento_mensal: orcamentoMensal,
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
                objetivos: objetivos
            };
            
            // Enviar dados para o servidor
            const { error } = await supabase
                .from('formularios_clientes')
                .insert([
                    {
                        cliente_id: document.getElementById("cliente_id").value,
                        dados_formulario: dadosFormulario,
                        status: 'preenchido'
                    }
                ]);
            
            if (error) {
                throw new Error(`Erro ao enviar formulário: ${error.message}`);
            }
            
            // Mostrar mensagem de sucesso
            formContentEl.style.display = "none";
            messageAreaEl.innerHTML = `
                <div class="message success">
                    <h3>Formulário enviado com sucesso!</h3>
                    <p>Obrigado por preencher o formulário. Suas respostas foram registradas.</p>
                    <p>Você pode fechar esta página agora.</p>
                </div>
            `;
            
        } catch (error) {
            console.error("Erro ao enviar formulário:", error);
            showMessage("error", `Erro ao enviar formulário: ${error.message}`);
            
            // Reativar botão de envio
            const submitBtn = document.getElementById("submit-btn");
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Enviar Respostas";
            }
        }
    });
}

async function renderFormularioCliente() {
    try {
        // Obter ID do cliente da URL
        const urlParams = new URLSearchParams(window.location.search);
        const clienteId = urlParams.get('id');
        const tokenUnico = urlParams.get('token');
        
        if (!clienteId || !tokenUnico) {
            throw new Error("ID do cliente ou token não fornecido na URL.");
        }
        
        // Verificar se o token é válido
        const { data: tokenData, error: tokenError } = await supabase
            .from('formularios_clientes')
            .select('*')
            .eq('cliente_id', clienteId)
            .eq('token_unico', tokenUnico)
            .eq('status', 'pendente')
            .single();
        
        if (tokenError || !tokenData) {
            throw new Error("Token inválido ou formulário já preenchido.");
        }
        
        // Obter dados do cliente
        const { data: clienteData, error: clienteError } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', clienteId)
            .single();
        
        if (clienteError || !clienteData) {
            throw new Error("Cliente não encontrado.");
        }
        
        // Atualizar título do formulário
        formTitleEl.textContent = `Formulário de Planejamento - ${clienteData.nome}`;
        
        // Renderizar formulário
        formContentEl.innerHTML = `
            <form id="cliente-form" class="form-container">
                <input type="hidden" id="cliente_id" value="${clienteId}">
                <input type="hidden" id="token_unico" value="${tokenUnico}">
                
                <div class="form-group">
                    <label for="nome_completo">Nome Completo:</label>
                    <input type="text" id="nome_completo" name="nome_completo" required>
                </div>

                <div class="radio-group">
                    <p class="form-question-label">Você é a única pessoa que possui renda na sua casa?</p>
                    <div class="radio-options">
                        <div class="radio-option">
                            <input type="radio" id="renda_unica_sim" name="renda_unica" value="sim" required>
                            <label for="renda_unica_sim">Sim</label>
                        </div>
                        <div class="radio-option">
                            <input type="radio" id="renda_unica_nao" name="renda_unica" value="nao">
                            <label for="renda_unica_nao">Não</label>
                        </div>
                    </div>
                </div>
                
                <div id="outras-pessoas-renda-container" class="form-section" style="display: none;">
                    <div class="form-group">
                        <p class="form-question-label">Quem mais possui renda na sua casa?</p>
                    </div>
                    <div id="pessoas-list-container" class="dynamic-list-container">
                        <div id="pessoas-list" class="dynamic-list"></div>
                        <button type="button" id="add-person-btn" class="add-dynamic-entry-btn">Adicionar Pessoa</button>
                    </div>
                </div>
                
                <div class="radio-group">
                    <p class="form-question-label" id="label_tem_dependentes">Você tem filho/pet/outros parentes que dependem de você?</p>
                    <div class="radio-options">
                        <div class="radio-option">
                            <input type="radio" id="tem_dependentes_sim" name="tem_dependentes" value="sim" required>
                            <label for="tem_dependentes_sim">Sim</label>
                        </div>
                        <div class="radio-option">
                            <input type="radio" id="tem_dependentes_nao" name="tem_dependentes" value="nao">
                            <label for="tem_dependentes_nao">Não</label>
                        </div>
                    </div>
                </div>
                
                <div id="dependentes-container" class="form-section" style="display: none;">
                    <div class="form-group">
                        <p class="form-question-label">Quem são seus dependentes?</p>
                    </div>
                    <div id="dependentes-list-container" class="dynamic-list-container">
                        <div id="dependentes-list" class="dynamic-list"></div>
                        <button type="button" id="add-dependente-btn" class="add-dynamic-entry-btn">Adicionar Dependente</button>
                    </div>
                </div>
                
                <!-- Seção de Plano de Saúde -->
                <div id="plano-saude-section" style="margin-top: 2rem;">
                    <h3 id="plano-saude-section-title" style="display: none;">Informações sobre Plano de Saúde:</h3>
                    <div id="plano-saude-section-content"></div>
                </div>
                
                <!-- Seção de Seguro de Vida -->
                <div id="seguro-vida-section" style="margin-top: 2rem;">
                    <h3 id="seguro-vida-section-title" style="display: none;">Informações sobre Seguro de Vida:</h3>
                    <div id="seguro-vida-section-content"></div>
                </div>
                
                <div class="radio-group">
                    <p class="form-question-label" id="label_tem_patrimonio_fisico">Você possui patrimônio físico (imóvel, automóvel, jóias, outros...)?</p>
                    <div class="radio-options">
                        <div class="radio-option">
                            <input type="radio" id="tem_patrimonio_sim" name="tem_patrimonio" value="sim" required>
                            <label for="tem_patrimonio_sim">Sim</label>
                        </div>
                        <div class="radio-option">
                            <input type="radio" id="tem_patrimonio_nao" name="tem_patrimonio" value="nao">
                            <label for="tem_patrimonio_nao">Não</label>
                        </div>
                    </div>
                </div>
                
                <div id="patrimonio-list-container" class="dynamic-list-container" style="display: none;">
                    <div id="patrimonio-list" class="dynamic-list"></div>
                    <button type="button" id="add-patrimonio-btn" class="add-dynamic-entry-btn">Adicionar Patrimônio</button>
                </div>
                
                <div class="radio-group">
                    <p class="form-question-label" id="label_tem_patrimonio_liquido">Você possui Dinheiro Guardado ou Investido?</p>
                    <div class="radio-options">
                        <div class="radio-option">
                            <input type="radio" id="tem_patrimonio_liquido_sim" name="tem_patrimonio_liquido" value="sim" required>
                            <label for="tem_patrimonio_liquido_sim">Sim</label>
                        </div>
                        <div class="radio-option">
                            <input type="radio" id="tem_patrimonio_liquido_nao" name="tem_patrimonio_liquido" value="nao">
                            <label for="tem_patrimonio_liquido_nao">Não</label>
                        </div>
                    </div>
                </div>
                
                <div id="patrimonio-liquido-list-container" class="dynamic-list-container" style="display: none;">
                    <div id="patrimonio-liquido-list" class="dynamic-list"></div>
                    <button type="button" id="add-patrimonio-liquido-btn" class="add-dynamic-entry-btn">Adicionar Patrimônio Líquido</button>
                </div>
                
                <div class="radio-group">
                    <p class="form-question-label" id="label_tem_dividas">Você possui dívidas?</p>
                    <div class="radio-options">
                        <div class="radio-option">
                            <input type="radio" id="tem_dividas_sim" name="tem_dividas" value="sim" required>
                            <label for="tem_dividas_sim">Sim</label>
                        </div>
                        <div class="radio-option">
                            <input type="radio" id="tem_dividas_nao" name="tem_dividas" value="nao">
                            <label for="tem_dividas_nao">Não</label>
                        </div>
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

            <!-- SEÇÃO DE INFORMAÇÕES FINANCEIRAS -->
            <div id="informacoes-financeiras-section" style="margin-top: 2rem;">
                <h3 style="text-align: center; margin-bottom: 1.5rem;">Informações Financeiras</h3>
                
                <!-- Campo de Orçamento -->
                <div class="form-group">
                    <label for="orcamento_mensal">Orçamento Mensal Estimado para o Projeto:</label>
                    <input type="text" id="orcamento_mensal" name="orcamento_mensal" placeholder="R$ 0,00" class="currency-input">
                </div>
            </div>
            <!-- FIM SEÇÃO DE INFORMAÇÕES FINANCEIRAS -->
            
            <!-- SEÇÃO DE PRINCIPAIS OBJETIVOS -->
            <div class="form-section" id="objetivos-section" style="margin-top: 2rem;">
                <div class="form-group">
                    <h3 class="form-question-label" style="text-align: center !important; margin-bottom: 0.5rem;">Principais Objetivos</h3>
                </div>
                <div id="objetivos-list-container" class="dynamic-list-container">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: bold;">Objetivos:</label>
                    <div id="objetivos-list" class="dynamic-list"></div>
                    <button type="button" id="add-objetivo-btn" class="add-dynamic-entry-btn">Adicionar Objetivo</button>
                </div>
            </div>
            <!-- FIM SEÇÃO DE PRINCIPAIS OBJETIVOS -->

            <div class="form-actions">
                <button type="submit" id="submit-btn" class="submit-button">Enviar Respostas</button>
            </div>
        </form>
        `;
        
        // Adicionar event listeners ao formulário
        attachFormEventListeners("cliente-form");
        
    } catch (error) {
        console.error("Erro ao renderizar formulário:", error);
        messageAreaEl.innerHTML = `
            <div class="message error">
                <h3>Erro ao carregar formulário</h3>
                <p>${error.message}</p>
            </div>
        `;
        formContentEl.style.display = "none";
    }
}

// Inicializar formulário quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", renderFormularioCliente);

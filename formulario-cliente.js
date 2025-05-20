// formulario-cliente.js
import { supabase } from "./supabase.js";

// --- Elementos DOM ---
const formContentEl = document.getElementById("form-content");
const messageAreaEl = document.getElementById("message-area");
const formTitleEl = document.getElementById("form-title");

// --- Estado para preservar seleções ---
let planoSaudeSelections = {};
let seguroVidaSelections = {};
let impostoRendaSelections = {}; // Novo estado para imposto de renda
let orcamentoSelections = {}; // Novo estado para orçamento

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
            <div class="radio-options-inline" style="display: flex; align-items: center;">
                <span style="margin-right: 20px; display: flex; align-items: center;">
                    <input type="radio" id="${personId}_sim" name="${personId}" value="sim" required style="margin-right: 5px;">
                    <label for="${personId}_sim">Sim</label>
                </span>
                <span style="margin-right: 20px; display: flex; align-items: center;">
                    <input type="radio" id="${personId}_nao" name="${personId}" value="nao" style="margin-right: 5px;">
                    <label for="${personId}_nao">Não</label>
                </span>
                <span style="display: flex; align-items: center;">
                    <input type="radio" id="${personId}_naosei" name="${personId}" value="nao_sei" style="margin-right: 5px;">
                    <label for="${personId}_naosei">Não sei informar</label>
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
            <div class="radio-options-inline" style="display: flex; align-items: center;">
                <span style="margin-right: 20px; display: flex; align-items: center;">
                    <input type="radio" id="${personId}_sim" name="${personId}" value="sim" required style="margin-right: 5px;">
                    <label for="${personId}_sim">Sim</label>
                </span>
                <span style="margin-right: 20px; display: flex; align-items: center;">
                    <input type="radio" id="${personId}_nao" name="${personId}" value="nao" style="margin-right: 5px;">
                    <label for="${personId}_nao">Não</label>
                </span>
                <span style="display: flex; align-items: center;">
                    <input type="radio" id="${personId}_naosei" name="${personId}" value="nao_sei" style="margin-right: 5px;">
                    <label for="${personId}_naosei">Não sei informar</label>
                </span>
            </div>
        `;
        entryDiv.dataset.personName = pessoa.nome;
        entryDiv.dataset.personType = pessoa.tipo;
        container.appendChild(entryDiv);
    });
    restoreSeguroVidaSelections(); 
}

// Funções para Imposto de Renda
function saveImpostoRendaSelections() {
    const container = document.getElementById("imposto-renda-section-content");
    if (!container) return;
    impostoRendaSelections = {}; 
    
    // Salvar seleções de declaração
    container.querySelectorAll(".imposto-renda-entry").forEach(entry => {
        const nameAttribute = entry.querySelector('input[type="radio"]').name;
        const selectedRadio = entry.querySelector(`input[name="${nameAttribute}"]:checked`);
        if (selectedRadio) {
            const personName = entry.dataset.personName;
            if (!impostoRendaSelections[personName]) {
                impostoRendaSelections[personName] = {};
            }
            impostoRendaSelections[personName].declara = selectedRadio.value;
            
            // Salvar seleções de tipo e resultado se declara = sim
            if (selectedRadio.value === "sim") {
                const tipoNameAttribute = `tipo_${nameAttribute}`;
                const resultadoNameAttribute = `resultado_${nameAttribute}`;
                
                const tipoSelectedRadio = document.querySelector(`input[name="${tipoNameAttribute}"]:checked`);
                const resultadoSelectedRadio = document.querySelector(`input[name="${resultadoNameAttribute}"]:checked`);
                
                if (tipoSelectedRadio) {
                    impostoRendaSelections[personName].tipo = tipoSelectedRadio.value;
                }
                
                if (resultadoSelectedRadio) {
                    impostoRendaSelections[personName].resultado = resultadoSelectedRadio.value;
                }
            }
        }
    });
}

function restoreImpostoRendaSelections() {
    Object.keys(impostoRendaSelections).forEach(personName => {
        const personData = impostoRendaSelections[personName];
        
        // Restaurar seleção de declaração
        const entries = document.querySelectorAll(`.imposto-renda-entry[data-person-name="${personName}"]`);
        entries.forEach(entry => {
            const nameAttribute = entry.querySelector('input[type="radio"]').name;
            const radioToSelect = document.querySelector(`input[name="${nameAttribute}"][value="${personData.declara}"]`);
            if (radioToSelect) {
                radioToSelect.checked = true;
                
                // Mostrar/ocultar perguntas adicionais com base na seleção
                const additionalQuestions = entry.querySelector('.imposto-renda-additional-questions');
                if (additionalQuestions) {
                    additionalQuestions.style.display = personData.declara === "sim" ? "block" : "none";
                }
                
                // Restaurar seleções de tipo e resultado se declara = sim
                if (personData.declara === "sim") {
                    const tipoNameAttribute = `tipo_${nameAttribute}`;
                    const resultadoNameAttribute = `resultado_${nameAttribute}`;
                    
                    if (personData.tipo) {
                        const tipoRadioToSelect = document.querySelector(`input[name="${tipoNameAttribute}"][value="${personData.tipo}"]`);
                        if (tipoRadioToSelect) {
                            tipoRadioToSelect.checked = true;
                        }
                    }
                    
                    if (personData.resultado) {
                        const resultadoRadioToSelect = document.querySelector(`input[name="${resultadoNameAttribute}"][value="${personData.resultado}"]`);
                        if (resultadoRadioToSelect) {
                            resultadoRadioToSelect.checked = true;
                        }
                    }
                }
            }
        });
    });
}

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
    
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach((entry, index) => { 
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasComRenda.push({ id: `outra_pessoa_ir_${index}`, nome: sanitizeInput(nomeInput.value.trim()), tipo: "outra_pessoa_renda" });
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
    
    pessoasComRenda.forEach((pessoa) => {
        const primeiroNome = pessoa.nome.split(' ')[0];
        const nomeCapitalizado = capitalizeName(primeiroNome);
        const personId = `imposto_renda_${pessoa.id}`;
        const entryDiv = document.createElement("div");
        entryDiv.classList.add("imposto-renda-entry");
        entryDiv.style.marginBottom = "1rem";
        
        // Pergunta principal sobre declaração de IR
        let perguntaIR = "";
        if (pessoa.tipo === "preenchedor") {
            perguntaIR = "Você declara imposto de renda?";
        } else {
            perguntaIR = `${nomeCapitalizado} declara imposto de renda?`;
        }
        
        // Opções de resposta para a pergunta principal
        let opcoesHTML = `
            <label for="${personId}" style="display: block; margin-bottom: 0.5rem;">${perguntaIR}</label>
            <div class="radio-options-inline" style="display: flex; flex-wrap: nowrap; width: 100%; align-items: center; font-size: 13px;">
                <span style="margin-right: 20px; display: flex; align-items: center; white-space: nowrap;">
                    <input type="radio" id="${personId}_sim" name="${personId}" value="sim" required style="margin-right: 5px;">
                    <label for="${personId}_sim">Sim</label>
                </span>
                <span style="margin-right: 20px; display: flex; align-items: center; white-space: nowrap;">
                    <input type="radio" id="${personId}_nao" name="${personId}" value="nao" style="margin-right: 5px;">
                    <label for="${personId}_nao">Não</label>
                </span>
        `;
        
        // Adicionar opção "Não Sei Informar" apenas para outras pessoas (não para o preenchedor)
        if (pessoa.tipo !== "preenchedor") {
            opcoesHTML += `
                <span style="display: flex; align-items: center; white-space: nowrap;">
                    <input type="radio" id="${personId}_naosei" name="${personId}" value="nao_sei" style="margin-right: 5px;">
                    <label for="${personId}_naosei">Não Sei Informar</label>
                </span>
            `;
        }
        
        opcoesHTML += `</div>`;
        
        // Perguntas adicionais que aparecem quando a resposta é "Sim"
        const perguntasAdicionaisHTML = `
            <div class="imposto-renda-additional-questions" style="display: none; margin-left: 20px; border-left: 2px solid var(--theme-border-color); padding-left: 15px; margin-top: 10px;">
                <div style="margin-bottom: 10px;">
                    <label for="tipo_${personId}" style="display: block; margin-bottom: 0.5rem;">Qual o tipo?</label>
                    <div class="radio-options-inline" style="display: flex; flex-wrap: nowrap; width: 100%; align-items: center; font-size: 13px;">
                        <span style="margin-right: 20px; display: flex; align-items: center; white-space: nowrap;">
                            <input type="radio" id="tipo_${personId}_simples" name="tipo_${personId}" value="simples" style="margin-right: 5px;">
                            <label for="tipo_${personId}_simples">Simples</label>
                        </span>
                        <span style="margin-right: 20px; display: flex; align-items: center; white-space: nowrap;">
                            <input type="radio" id="tipo_${personId}_completa" name="tipo_${personId}" value="completa" style="margin-right: 5px;">
                            <label for="tipo_${personId}_completa">Dedução Completa</label>
                        </span>
                        <span style="display: flex; align-items: center; white-space: nowrap;">
                            <input type="radio" id="tipo_${personId}_naosei" name="tipo_${personId}" value="nao_sei" style="margin-right: 5px;">
                            <label for="tipo_${personId}_naosei">Não Sei Informar</label>
                        </span>
                    </div>
                </div>
                
                <div>
                    <label for="resultado_${personId}" style="display: block; margin-bottom: 0.5rem;">Qual o resultado?</label>
                    <div class="radio-options-inline" style="display: flex; flex-wrap: nowrap; width: 100%; align-items: center; font-size: 13px;">
                        <span style="margin-right: 20px; display: flex; align-items: center; white-space: nowrap;">
                            <input type="radio" id="resultado_${personId}_paga" name="resultado_${personId}" value="paga" style="margin-right: 5px;">
                            <label for="resultado_${personId}_paga">Paga</label>
                        </span>
                        <span style="margin-right: 20px; display: flex; align-items: center; white-space: nowrap;">
                            <input type="radio" id="resultado_${personId}_recebe" name="resultado_${personId}" value="recebe" style="margin-right: 5px;">
                            <label for="resultado_${personId}_recebe">Recebe</label>
                        </span>
                        <span style="margin-right: 20px; display: flex; align-items: center; white-space: nowrap;">
                            <input type="radio" id="resultado_${personId}_isento" name="resultado_${personId}" value="isento" style="margin-right: 5px;">
                            <label for="resultado_${personId}_isento">Isento</label>
                        </span>
                        <span style="display: flex; align-items: center; white-space: nowrap;">
                            <input type="radio" id="resultado_${personId}_naosei" name="resultado_${personId}" value="nao_sei" style="margin-right: 5px;">
                            <label for="resultado_${personId}_naosei">Não Sei Informar</label>
                        </span>
                    </div>
                </div>
            </div>
        `;
        
        entryDiv.innerHTML = opcoesHTML + perguntasAdicionaisHTML;
        entryDiv.dataset.personName = pessoa.nome;
        entryDiv.dataset.personType = pessoa.tipo;
        
        // Adicionar evento para mostrar/ocultar perguntas adicionais
        container.appendChild(entryDiv);
        
        // Adicionar listeners para mostrar/ocultar perguntas adicionais
        const simRadio = document.getElementById(`${personId}_sim`);
        const naoRadio = document.getElementById(`${personId}_nao`);
        const naoSeiRadio = document.getElementById(`${personId}_naosei`);
        const additionalQuestions = entryDiv.querySelector('.imposto-renda-additional-questions');
        
        if (simRadio && additionalQuestions) {
            simRadio.addEventListener('change', function() {
                if (this.checked) {
                    additionalQuestions.style.display = 'block';
                }
            });
        }
        
        if (naoRadio && additionalQuestions) {
            naoRadio.addEventListener('change', function() {
                if (this.checked) {
                    additionalQuestions.style.display = 'none';
                }
            });
        }
        
        if (naoSeiRadio && additionalQuestions) {
            naoSeiRadio.addEventListener('change', function() {
                if (this.checked) {
                    additionalQuestions.style.display = 'none';
                }
            });
        }
    });
    
    restoreImpostoRendaSelections();
}

// Funções para Orçamento
function saveOrcamentoSelections() {
    const container = document.getElementById("orcamento-section-content");
    if (!container) return;
    orcamentoSelections = {};
    
    // Salvar tipo de orçamento (conjunto ou individual)
    const tipoOrcamentoRadios = document.querySelectorAll('input[name="tipo_orcamento"]');
    tipoOrcamentoRadios.forEach(radio => {
        if (radio.checked) {
            orcamentoSelections.tipo = radio.value;
        }
    });
    
    // Salvar valores de orçamento conjunto
    const orcamentoConjuntoDiv = document.getElementById("orcamento-conjunto");
    if (orcamentoConjuntoDiv) {
        orcamentoSelections.conjunto = {
            entradas: document.getElementById("orcamento_conjunto_entradas")?.value || "",
            despesas_fixas: document.getElementById("orcamento_conjunto_despesas_fixas")?.value || "",
            despesas_variaveis: document.getElementById("orcamento_conjunto_despesas_variaveis")?.value || "",
            valor_poupado: document.getElementById("orcamento_conjunto_valor_poupado")?.value || ""
        };
    }
    
    // Salvar valores de orçamento individual
    orcamentoSelections.individual = {};
    document.querySelectorAll(".orcamento-individual-entry").forEach(entry => {
        const personName = entry.dataset.personName;
        if (personName) {
            const personId = entry.dataset.personId;
            orcamentoSelections.individual[personName] = {
                entradas: document.getElementById(`orcamento_${personId}_entradas`)?.value || "",
                despesas_fixas: document.getElementById(`orcamento_${personId}_despesas_fixas`)?.value || "",
                despesas_variaveis: document.getElementById(`orcamento_${personId}_despesas_variaveis`)?.value || "",
                valor_poupado: document.getElementById(`orcamento_${personId}_valor_poupado`)?.value || ""
            };
        }
    });
}

function restoreOrcamentoSelections() {
    // Restaurar tipo de orçamento
    if (orcamentoSelections.tipo) {
        const tipoRadio = document.querySelector(`input[name="tipo_orcamento"][value="${orcamentoSelections.tipo}"]`);
        if (tipoRadio) {
            tipoRadio.checked = true;
            
            // Mostrar/ocultar seções com base no tipo
            const orcamentoConjuntoDiv = document.getElementById("orcamento-conjunto");
            const orcamentoIndividualDiv = document.getElementById("orcamento-individual");
            
            if (orcamentoConjuntoDiv && orcamentoIndividualDiv) {
                if (orcamentoSelections.tipo === "conjunto") {
                    orcamentoConjuntoDiv.style.display = "block";
                    orcamentoIndividualDiv.style.display = "none";
                } else {
                    orcamentoConjuntoDiv.style.display = "none";
                    orcamentoIndividualDiv.style.display = "block";
                }
            }
        }
    }
    
    // Restaurar valores de orçamento conjunto
    if (orcamentoSelections.conjunto) {
        document.getElementById("orcamento_conjunto_entradas").value = orcamentoSelections.conjunto.entradas || "";
        document.getElementById("orcamento_conjunto_despesas_fixas").value = orcamentoSelections.conjunto.despesas_fixas || "";
        document.getElementById("orcamento_conjunto_despesas_variaveis").value = orcamentoSelections.conjunto.despesas_variaveis || "";
        document.getElementById("orcamento_conjunto_valor_poupado").value = orcamentoSelections.conjunto.valor_poupado || "";
    }
    
    // Restaurar valores de orçamento individual
    if (orcamentoSelections.individual) {
        Object.keys(orcamentoSelections.individual).forEach(personName => {
            const entry = document.querySelector(`.orcamento-individual-entry[data-person-name="${personName}"]`);
            if (entry) {
                const personId = entry.dataset.personId;
                const personData = orcamentoSelections.individual[personName];
                
                document.getElementById(`orcamento_${personId}_entradas`).value = personData.entradas || "";
                document.getElementById(`orcamento_${personId}_despesas_fixas`).value = personData.despesas_fixas || "";
                document.getElementById(`orcamento_${personId}_despesas_variaveis`).value = personData.despesas_variaveis || "";
                document.getElementById(`orcamento_${personId}_valor_poupado`).value = personData.valor_poupado || "";
            }
        });
    }
    
    // Formatar valores monetários
    document.querySelectorAll('input[data-type="currency"]').forEach(input => {
        if (input.value) {
            input.value = formatCurrency(input.value);
        }
    });
}

function renderOrcamentoQuestions() {
    saveOrcamentoSelections();
    const container = document.getElementById("orcamento-section-content");
    if (!container) return;
    container.innerHTML = '';
    
    const pessoasComRenda = [];
    const nomeCompletoInput = document.getElementById("nome_completo");
    if (nomeCompletoInput && nomeCompletoInput.value.trim() !== "") {
        pessoasComRenda.push({ id: "preenchedor_orcamento", nome: sanitizeInput(nomeCompletoInput.value.trim()), tipo: "preenchedor" });
    }
    
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach((entry, index) => { 
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasComRenda.push({ id: `outra_pessoa_orcamento_${index}`, nome: sanitizeInput(nomeInput.value.trim()), tipo: "outra_pessoa_renda" });
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
    
    // Se houver apenas uma pessoa com renda, mostrar diretamente os campos de orçamento individual
    if (pessoasComRenda.length === 1) {
        const pessoa = pessoasComRenda[0];
        const orcamentoIndividualHTML = criarCamposOrcamentoIndividual(pessoa);
        container.innerHTML = orcamentoIndividualHTML;
    } else {
        // Se houver mais de uma pessoa com renda, mostrar opção de escolha
        const escolhaHTML = `
            <div class="orcamento-tipo-escolha" style="margin-bottom: 1.5rem;">
                <label style="display: block; margin-bottom: 0.5rem;">Como deseja informar o orçamento?</label>
                <div class="radio-options-inline" style="display: flex; align-items: center;">
                    <span style="margin-right: 20px; display: flex; align-items: center;">
                        <input type="radio" id="tipo_orcamento_conjunto" name="tipo_orcamento" value="conjunto" required style="margin-right: 5px;">
                        <label for="tipo_orcamento_conjunto">Orçamento conjunto da casa</label>
                    </span>
                    <span style="display: flex; align-items: center;">
                        <input type="radio" id="tipo_orcamento_individual" name="tipo_orcamento" value="individual" style="margin-right: 5px;">
                        <label for="tipo_orcamento_individual">Orçamento individual por pessoa</label>
                    </span>
                </div>
            </div>
            
            <div id="orcamento-conjunto" style="display: none;">
                <div style="margin-bottom: 1rem;">
                    <label for="orcamento_conjunto_entradas" style="display: block; margin-bottom: 0.5rem;">Entradas totais mensais (R$)</label>
                    <input type="text" id="orcamento_conjunto_entradas" data-type="currency" style="width: 100%;">
                </div>
                <div style="margin-bottom: 1rem;">
                    <label for="orcamento_conjunto_despesas_fixas" style="display: block; margin-bottom: 0.5rem;">Despesas fixas mensais (R$)</label>
                    <input type="text" id="orcamento_conjunto_despesas_fixas" data-type="currency" style="width: 100%;">
                </div>
                <div style="margin-bottom: 1rem;">
                    <label for="orcamento_conjunto_despesas_variaveis" style="display: block; margin-bottom: 0.5rem;">Despesas variáveis mensais (R$)</label>
                    <input type="text" id="orcamento_conjunto_despesas_variaveis" data-type="currency" style="width: 100%;">
                </div>
                <div style="margin-bottom: 1rem;">
                    <label for="orcamento_conjunto_valor_poupado" style="display: block; margin-bottom: 0.5rem;">Valor poupado/investido mensal (R$)</label>
                    <input type="text" id="orcamento_conjunto_valor_poupado" data-type="currency" style="width: 100%;">
                </div>
            </div>
            
            <div id="orcamento-individual" style="display: none;">
                ${pessoasComRenda.map(pessoa => criarCamposOrcamentoIndividual(pessoa)).join('')}
            </div>
        `;
        
        container.innerHTML = escolhaHTML;
        
        // Adicionar listeners para mostrar/ocultar seções com base na escolha
        const tipoConjuntoRadio = document.getElementById("tipo_orcamento_conjunto");
        const tipoIndividualRadio = document.getElementById("tipo_orcamento_individual");
        const orcamentoConjuntoDiv = document.getElementById("orcamento-conjunto");
        const orcamentoIndividualDiv = document.getElementById("orcamento-individual");
        
        if (tipoConjuntoRadio && orcamentoConjuntoDiv && orcamentoIndividualDiv) {
            tipoConjuntoRadio.addEventListener('change', function() {
                if (this.checked) {
                    orcamentoConjuntoDiv.style.display = "block";
                    orcamentoIndividualDiv.style.display = "none";
                }
            });
        }
        
        if (tipoIndividualRadio && orcamentoConjuntoDiv && orcamentoIndividualDiv) {
            tipoIndividualRadio.addEventListener('change', function() {
                if (this.checked) {
                    orcamentoConjuntoDiv.style.display = "none";
                    orcamentoIndividualDiv.style.display = "block";
                }
            });
        }
    }
    
    // Adicionar formatação de moeda para os campos de valor
    document.querySelectorAll('input[data-type="currency"]').forEach(input => {
        input.addEventListener('input', function(e) {
            let value = e.target.value;
            e.target.value = formatCurrency(value);
        });
        
        input.addEventListener('blur', function(e) {
            let value = e.target.value;
            if (value) {
                e.target.value = formatCurrency(value);
            }
        });
    });
    
    restoreOrcamentoSelections();
}

function criarCamposOrcamentoIndividual(pessoa) {
    const primeiroNome = pessoa.nome.split(' ')[0];
    const nomeCapitalizado = capitalizeName(primeiroNome);
    const personId = pessoa.id;
    
    return `
        <div class="orcamento-individual-entry" data-person-name="${pessoa.nome}" data-person-id="${personId}">
            <h4 style="margin-top: 0; margin-bottom: 1rem;">${nomeCapitalizado}</h4>
            <div style="margin-bottom: 1rem;">
                <label for="orcamento_${personId}_entradas" style="display: block; margin-bottom: 0.5rem;">Entradas totais mensais (R$)</label>
                <input type="text" id="orcamento_${personId}_entradas" data-type="currency" style="width: 100%;">
            </div>
            <div style="margin-bottom: 1rem;">
                <label for="orcamento_${personId}_despesas_fixas" style="display: block; margin-bottom: 0.5rem;">Despesas fixas mensais (R$)</label>
                <input type="text" id="orcamento_${personId}_despesas_fixas" data-type="currency" style="width: 100%;">
            </div>
            <div style="margin-bottom: 1rem;">
                <label for="orcamento_${personId}_despesas_variaveis" style="display: block; margin-bottom: 0.5rem;">Despesas variáveis mensais (R$)</label>
                <input type="text" id="orcamento_${personId}_despesas_variaveis" data-type="currency" style="width: 100%;">
            </div>
            <div style="margin-bottom: 1.5rem;">
                <label for="orcamento_${personId}_valor_poupado" style="display: block; margin-bottom: 0.5rem;">Valor poupado/investido mensal (R$)</label>
                <input type="text" id="orcamento_${personId}_valor_poupado" data-type="currency" style="width: 100%;">
            </div>
        </div>
    `;
}

function updateDynamicFormSections() {
    updatePerguntaDependentesLabel();
    updatePerguntaPatrimonioFisicoLabel();
    updatePerguntaPatrimonioLiquidoLabel();
    updatePerguntaDividasLabel();
    renderPlanoSaudeQuestions();
    renderSeguroVidaQuestions();
    renderImpostoRendaQuestions(); // Nova função para imposto de renda
    renderOrcamentoQuestions(); // Nova função para orçamento
}

async function loadForm(token) {
    if (!token) {
        formContentEl.innerHTML = "<p>Link inválido.</p>";
        showMessage("error", "Token não encontrado na URL.");
        return;
    }
    try {
        const { data: formData, error: formError } = await supabase
            .from("formularios_clientes")
            .select("*, clientes(nome)")
            .eq("token_unico", token)
            .single();
        if (formError || !formData) {
            if (formError && formError.code === 'PGRST116') {
                 formContentEl.innerHTML = "<p>Link inválido ou expirado.</p>";
                 showMessage("error", "O link para este formulário não é válido ou já foi utilizado.");
            } else {
                formContentEl.innerHTML = "<p>Erro ao carregar formulário.</p>";
                showMessage("error", `Erro ao carregar formulário: ${formError?.message || "Desconhecido"}`);
            }
            return;
        }

        if (formData.status === "preenchido") {
            formContentEl.innerHTML = "<p>Este formulário já foi preenchido.</p>";
            showMessage("error", "Este formulário já foi preenchido anteriormente.");
            return;
        }

        const clienteNome = formData.clientes?.nome || "Cliente";
        formTitleEl.textContent = "Formulário Pré Diagnóstico";

        // Criar formulário
        let formHTML = `
            <form id="client-response-form">
                <div class="form-group">
                    <label for="nome_completo">Nome Completo</label>
                    <input type="text" id="nome_completo" name="nome_completo" required>
                </div>

                <div class="form-group">
                    <label>Única pessoa com renda na casa?</label>
                    <div class="radio-group">
                        <input type="radio" id="renda_unica_sim" name="renda_unica" value="sim" required>
                        <label for="renda_unica_sim">Sim</label>
                        <input type="radio" id="renda_unica_nao" name="renda_unica" value="nao">
                        <label for="renda_unica_nao">Não</label>
                    </div>
                </div>

                <div id="outras-pessoas-section" style="display: none;">
                    <h3>Outras pessoas com renda na casa:</h3>
                    <div id="pessoas-list"></div>
                    <button type="button" id="add-pessoa-btn" class="add-dynamic-entry-btn">+ Adicionar Pessoa com Renda</button>
                </div>

                <div class="form-group">
                    <label id="label_tem_dependentes">Você tem filho/pet/outros parentes que dependem de você?</label>
                    <div class="radio-group">
                        <input type="radio" id="tem_dependentes_sim" name="tem_dependentes" value="sim" required>
                        <label for="tem_dependentes_sim">Sim</label>
                        <input type="radio" id="tem_dependentes_nao" name="tem_dependentes" value="nao">
                        <label for="tem_dependentes_nao">Não</label>
                    </div>
                </div>

                <div id="dependentes-section" style="display: none;">
                    <h3>Dependentes:</h3>
                    <div id="dependentes-list"></div>
                    <button type="button" id="add-dependente-btn" class="add-dynamic-entry-btn">+ Adicionar Dependente</button>
                </div>

                <!-- Seção de Plano de Saúde -->
                <h3 id="plano-saude-section-title" style="display: none;">Informações sobre Plano de Saúde:</h3>
                <div id="plano-saude-section-content"></div>

                <!-- Seção de Seguro de Vida -->
                <h3 id="seguro-vida-section-title" style="display: none;">Informações sobre Seguro de Vida:</h3>
                <div id="seguro-vida-section-content"></div>

                <!-- Seção de Patrimônio Físico -->
                <div class="form-group">
                    <label id="label_tem_patrimonio_fisico">Você possui patrimônio físico (imóvel, automóvel, jóias, outros...)?</label>
                    <div class="radio-group">
                        <input type="radio" id="tem_patrimonio_sim" name="tem_patrimonio" value="sim" required>
                        <label for="tem_patrimonio_sim">Sim</label>
                        <input type="radio" id="tem_patrimonio_nao" name="tem_patrimonio" value="nao">
                        <label for="tem_patrimonio_nao">Não</label>
                    </div>
                </div>

                <div id="patrimonio-section" style="display: none;">
                    <h3>Patrimônios Físicos:</h3>
                    <div id="patrimonio-list"></div>
                    <button type="button" id="add-patrimonio-btn" class="add-dynamic-entry-btn">+ Adicionar Patrimônio</button>
                </div>

                <!-- Seção de Patrimônio Líquido -->
                <div class="form-group">
                    <label id="label_tem_patrimonio_liquido">Você possui Dinheiro Guardado ou Investido?</label>
                    <div class="radio-group">
                        <input type="radio" id="tem_patrimonio_liquido_sim" name="tem_patrimonio_liquido" value="sim" required>
                        <label for="tem_patrimonio_liquido_sim">Sim</label>
                        <input type="radio" id="tem_patrimonio_liquido_nao" name="tem_patrimonio_liquido" value="nao">
                        <label for="tem_patrimonio_liquido_nao">Não</label>
                    </div>
                </div>

                <div id="patrimonio-liquido-section" style="display: none;">
                    <h3>Dinheiro Guardado ou Investido:</h3>
                    <div id="patrimonio-liquido-list"></div>
                    <button type="button" id="add-patrimonio-liquido-btn" class="add-dynamic-entry-btn">+ Adicionar Item</button>
                </div>

                <!-- Seção de Dívidas -->
                <div class="form-group" style="text-align: center;">
                    <label id="label_tem_dividas" style="display: inline-block;">Você possui dívidas?</label>
                    <div class="radio-group" style="display: inline-block; margin-left: 10px;">
                        <input type="radio" id="tem_dividas_sim" name="tem_dividas" value="sim" required>
                        <label for="tem_dividas_sim">Sim</label>
                        <input type="radio" id="tem_dividas_nao" name="tem_dividas" value="nao">
                        <label for="tem_dividas_nao">Não</label>
                    </div>
                </div>

                <div id="dividas-section" style="display: none;">
                    <h3>Dívidas:</h3>
                    <div id="dividas-list"></div>
                    <button type="button" id="add-divida-btn" class="add-dynamic-entry-btn">+ Adicionar Dívida</button>
                </div>
                
                <!-- Seção de Imposto de Renda -->
                <h3 id="imposto-renda-section-title" style="display: none;">Informações sobre Imposto de Renda:</h3>
                <div id="imposto-renda-section-content"></div>
                
                <!-- Seção de Orçamento -->
                <h3 id="orcamento-section-title" style="display: none;">Informações sobre Orçamento:</h3>
                <div id="orcamento-section-content"></div>

                <button type="submit" id="submit-btn">Enviar Respostas</button>
            </form>
        `;

        formContentEl.innerHTML = formHTML;

        // Salvar ID do formulário para uso posterior
        const formId = formData.id;
        const clientResponseFormEl = document.getElementById("client-response-form");

        // --- Listeners para RENDA ÚNICA ---
        const rendaUnicaSimRadio = document.getElementById("renda_unica_sim");
        const rendaUnicaNaoRadio = document.getElementById("renda_unica_nao");
        const outrasPessoasSection = document.getElementById("outras-pessoas-section");

        if (rendaUnicaSimRadio && rendaUnicaNaoRadio && outrasPessoasSection) {
            rendaUnicaSimRadio.addEventListener("change", function() {
                if (this.checked) {
                    outrasPessoasSection.style.display = "none";
                    updateDynamicFormSections();
                }
            });

            rendaUnicaNaoRadio.addEventListener("change", function() {
                if (this.checked) {
                    outrasPessoasSection.style.display = "block";
                    updateDynamicFormSections();
                }
            });
        }

        // --- Listeners para OUTRAS PESSOAS COM RENDA ---
        const addPessoaBtn = document.getElementById("add-pessoa-btn");
        const pessoasList = document.getElementById("pessoas-list");

        if (addPessoaBtn && pessoasList) {
            addPessoaBtn.addEventListener("click", function() {
                const newIndex = pessoasList.children.length;
                const newPessoaHTML = `
                    <div class="dynamic-entry-item">
                        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
                        <label for="pessoa_nome_${newIndex}">Nome</label>
                        <input type="text" name="pessoa_nome" id="pessoa_nome_${newIndex}" required>
                        <label for="pessoa_autorizacao_${newIndex}">Precisa de autorização para acessar informações financeiras?</label>
                        <select name="pessoa_autorizacao" id="pessoa_autorizacao_${newIndex}" required>
                            <option value="sim">Sim</option>
                            <option value="nao">Não</option>
                        </select>
                    </div>
                `;
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = newPessoaHTML;
                const newPessoaEl = tempDiv.firstElementChild;
                
                // Adicionar listener para o botão de remover
                const removeBtn = newPessoaEl.querySelector('.remove-dynamic-entry-btn');
                removeBtn.addEventListener('click', function() {
                    newPessoaEl.remove();
                    updateDynamicFormSections();
                });
                
                // Adicionar listener para o campo de nome para atualizar as perguntas dinâmicas
                const nomeInput = newPessoaEl.querySelector('input[name="pessoa_nome"]');
                nomeInput.addEventListener('input', updateDynamicFormSections);
                
                pessoasList.appendChild(newPessoaEl);
                updateDynamicFormSections();
            });
        }

        // --- Listeners para DEPENDENTES ---
        const temDependentesSimRadio = document.getElementById("tem_dependentes_sim");
        const temDependentesNaoRadio = document.getElementById("tem_dependentes_nao");
        const dependentesSection = document.getElementById("dependentes-section");

        if (temDependentesSimRadio && temDependentesNaoRadio && dependentesSection) {
            temDependentesSimRadio.addEventListener("change", function() {
                if (this.checked) {
                    dependentesSection.style.display = "block";
                    updateDynamicFormSections();
                }
            });

            temDependentesNaoRadio.addEventListener("change", function() {
                if (this.checked) {
                    dependentesSection.style.display = "none";
                    updateDynamicFormSections();
                }
            });
        }

        const addDependenteBtn = document.getElementById("add-dependente-btn");
        const dependentesList = document.getElementById("dependentes-list");

        if (addDependenteBtn && dependentesList) {
            addDependenteBtn.addEventListener("click", function() {
                const newIndex = dependentesList.children.length;
                const newDependenteHTML = `
                    <div class="dynamic-entry-item">
                        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
                        <label for="dep_nome_${newIndex}">Nome</label>
                        <input type="text" name="dep_nome" id="dep_nome_${newIndex}" required>
                        <label for="dep_idade_${newIndex}">Idade</label>
                        <input type="number" name="dep_idade" id="dep_idade_${newIndex}" min="0" max="120">
                        <label for="dep_relacao_${newIndex}">Relação (ex: Filho, Sobrinho, Pet)</label>
                        <input type="text" name="dep_relacao" id="dep_relacao_${newIndex}">
                    </div>
                `;
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = newDependenteHTML;
                const newDependenteEl = tempDiv.firstElementChild;
                
                // Adicionar listener para o botão de remover
                const removeBtn = newDependenteEl.querySelector('.remove-dynamic-entry-btn');
                removeBtn.addEventListener('click', function() {
                    newDependenteEl.remove();
                    updateDynamicFormSections();
                });
                
                // Adicionar listener para o campo de nome para atualizar as perguntas dinâmicas
                const nomeInput = newDependenteEl.querySelector('input[name="dep_nome"]');
                nomeInput.addEventListener('input', updateDynamicFormSections);
                
                dependentesList.appendChild(newDependenteEl);
                updateDynamicFormSections();
            });
        }

        // --- Listeners para PATRIMÔNIO FÍSICO ---
        const temPatrimonioSimRadio = document.getElementById("tem_patrimonio_sim");
        const temPatrimonioNaoRadio = document.getElementById("tem_patrimonio_nao");
        const patrimonioSection = document.getElementById("patrimonio-section");

        if (temPatrimonioSimRadio && temPatrimonioNaoRadio && patrimonioSection) {
            temPatrimonioSimRadio.addEventListener("change", function() {
                if (this.checked) {
                    patrimonioSection.style.display = "block";
                }
            });

            temPatrimonioNaoRadio.addEventListener("change", function() {
                if (this.checked) {
                    patrimonioSection.style.display = "none";
                }
            });
        }

        const addPatrimonioBtn = document.getElementById("add-patrimonio-btn");
        const patrimonioList = document.getElementById("patrimonio-list");

        if (addPatrimonioBtn && patrimonioList) {
            addPatrimonioBtn.addEventListener("click", function() {
                const newIndex = patrimonioList.children.length;
                const newPatrimonioHTML = `
                    <div class="dynamic-entry-item">
                        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
                        <label for="patrimonio_qual_${newIndex}">Qual patrimônio?</label>
                        <input type="text" name="patrimonio_qual" id="patrimonio_qual_${newIndex}" required>
                        <label for="patrimonio_valor_${newIndex}">Valor estimado</label>
                        <input type="text" name="patrimonio_valor" id="patrimonio_valor_${newIndex}" data-type="currency">
                        
                        <div style="margin-top: 0.8rem;">
                            <label>Possui seguro?</label>
                            <div class="radio-group">
                                <input type="radio" id="patrimonio_seguro_${newIndex}_sim" name="patrimonio_seguro_${newIndex}" value="sim" required>
                                <label for="patrimonio_seguro_${newIndex}_sim">Sim</label>
                                <input type="radio" id="patrimonio_seguro_${newIndex}_nao" name="patrimonio_seguro_${newIndex}" value="nao">
                                <label for="patrimonio_seguro_${newIndex}_nao">Não</label>
                            </div>
                        </div>
                        
                        <div style="margin-top: 0.8rem;">
                            <label>Está quitado?</label>
                            <div class="radio-group">
                                <input type="radio" id="patrimonio_quitado_${newIndex}_sim" name="patrimonio_quitado_${newIndex}" value="sim" required>
                                <label for="patrimonio_quitado_${newIndex}_sim">Sim</label>
                                <input type="radio" id="patrimonio_quitado_${newIndex}_nao" name="patrimonio_quitado_${newIndex}" value="nao">
                                <label for="patrimonio_quitado_${newIndex}_nao">Não</label>
                            </div>
                        </div>
                    </div>
                `;
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = newPatrimonioHTML;
                const newPatrimonioEl = tempDiv.firstElementChild;
                
                // Adicionar listener para o botão de remover
                const removeBtn = newPatrimonioEl.querySelector('.remove-dynamic-entry-btn');
                removeBtn.addEventListener('click', function() {
                    newPatrimonioEl.remove();
                });
                
                // Adicionar formatação de moeda para o campo de valor
                const valorInput = newPatrimonioEl.querySelector('input[data-type="currency"]');
                valorInput.addEventListener('input', function(e) {
                    let value = e.target.value;
                    e.target.value = formatCurrency(value);
                });
                
                valorInput.addEventListener('blur', function(e) {
                    let value = e.target.value;
                    if (value) {
                        e.target.value = formatCurrency(value);
                    }
                });
                
                patrimonioList.appendChild(newPatrimonioEl);
            });
        }

        // --- Listeners para PATRIMÔNIO LÍQUIDO ---
        const temPatrimonioLiquidoSimRadio = document.getElementById("tem_patrimonio_liquido_sim");
        const temPatrimonioLiquidoNaoRadio = document.getElementById("tem_patrimonio_liquido_nao");
        const patrimonioLiquidoSection = document.getElementById("patrimonio-liquido-section");

        if (temPatrimonioLiquidoSimRadio && temPatrimonioLiquidoNaoRadio && patrimonioLiquidoSection) {
            temPatrimonioLiquidoSimRadio.addEventListener("change", function() {
                if (this.checked) {
                    patrimonioLiquidoSection.style.display = "block";
                }
            });

            temPatrimonioLiquidoNaoRadio.addEventListener("change", function() {
                if (this.checked) {
                    patrimonioLiquidoSection.style.display = "none";
                }
            });
        }

        const addPatrimonioLiquidoBtn = document.getElementById("add-patrimonio-liquido-btn");
        const patrimonioLiquidoList = document.getElementById("patrimonio-liquido-list");

        if (addPatrimonioLiquidoBtn && patrimonioLiquidoList) {
            addPatrimonioLiquidoBtn.addEventListener("click", function() {
                const newIndex = patrimonioLiquidoList.children.length;
                const newPatrimonioLiquidoHTML = `
                    <div class="dynamic-entry-item">
                        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
                        <label for="patrimonio_liquido_onde_${newIndex}">Onde está guardado/investido?</label>
                        <input type="text" name="patrimonio_liquido_onde" id="patrimonio_liquido_onde_${newIndex}" required>
                        <label for="patrimonio_liquido_valor_${newIndex}">Valor</label>
                        <input type="text" name="patrimonio_liquido_valor" id="patrimonio_liquido_valor_${newIndex}" data-type="currency">
                    </div>
                `;
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = newPatrimonioLiquidoHTML;
                const newPatrimonioLiquidoEl = tempDiv.firstElementChild;
                
                // Adicionar listener para o botão de remover
                const removeBtn = newPatrimonioLiquidoEl.querySelector('.remove-dynamic-entry-btn');
                removeBtn.addEventListener('click', function() {
                    newPatrimonioLiquidoEl.remove();
                });
                
                // Adicionar formatação de moeda para o campo de valor
                const valorInput = newPatrimonioLiquidoEl.querySelector('input[data-type="currency"]');
                valorInput.addEventListener('input', function(e) {
                    let value = e.target.value;
                    e.target.value = formatCurrency(value);
                });
                
                valorInput.addEventListener('blur', function(e) {
                    let value = e.target.value;
                    if (value) {
                        e.target.value = formatCurrency(value);
                    }
                });
                
                patrimonioLiquidoList.appendChild(newPatrimonioLiquidoEl);
            });
        }

        // --- Listeners para DÍVIDAS ---
        const temDividasSimRadio = document.getElementById("tem_dividas_sim");
        const temDividasNaoRadio = document.getElementById("tem_dividas_nao");
        const dividasSection = document.getElementById("dividas-section");

        if (temDividasSimRadio && temDividasNaoRadio && dividasSection) {
            temDividasSimRadio.addEventListener("change", function() {
                if (this.checked) {
                    dividasSection.style.display = "block";
                }
            });

            temDividasNaoRadio.addEventListener("change", function() {
                if (this.checked) {
                    dividasSection.style.display = "none";
                }
            });
        }

        const addDividaBtn = document.getElementById("add-divida-btn");
        const dividasList = document.getElementById("dividas-list");

        if (addDividaBtn && dividasList) {
            addDividaBtn.addEventListener("click", function() {
                const newIndex = dividasList.children.length;
                const newDividaHTML = `
                    <div class="dynamic-entry-item">
                        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
                        <label for="divida_credor_${newIndex}">A quem deve?</label>
                        <input type="text" name="divida_credor" id="divida_credor_${newIndex}" required>
                        <label for="divida_saldo_${newIndex}">Saldo Devedor Atual</label>
                        <input type="text" name="divida_saldo" id="divida_saldo_${newIndex}" data-type="currency">
                    </div>
                `;
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = newDividaHTML;
                const newDividaEl = tempDiv.firstElementChild;
                
                // Adicionar listener para o botão de remover
                const removeBtn = newDividaEl.querySelector('.remove-dynamic-entry-btn');
                removeBtn.addEventListener('click', function() {
                    newDividaEl.remove();
                });
                
                // Adicionar formatação de moeda para o campo de valor
                const valorInput = newDividaEl.querySelector('input[data-type="currency"]');
                valorInput.addEventListener('input', function(e) {
                    let value = e.target.value;
                    e.target.value = formatCurrency(value);
                });
                
                valorInput.addEventListener('blur', function(e) {
                    let value = e.target.value;
                    if (value) {
                        e.target.value = formatCurrency(value);
                    }
                });
                
                dividasList.appendChild(newDividaEl);
            });
        }
        // --- Fim Listeners para DÍVIDAS ---

        // Adicionar listeners para atualizar perguntas dinâmicas quando o nome é alterado
        const nomeCompletoInput = document.getElementById("nome_completo");
        if (nomeCompletoInput) {
            nomeCompletoInput.addEventListener("input", updateDynamicFormSections);
        }

        if (clientResponseFormEl) {
            clientResponseFormEl.addEventListener("submit", async (event) => {
                event.preventDefault();
                const submitButton = document.getElementById("submit-btn");
                submitButton.disabled = true;
                submitButton.textContent = "Enviando...";

                try {
                    const formDataObject = new FormData(event.target);
                    const dadosFormulario = {
                        nome_completo: sanitizeInput(formDataObject.get("nome_completo")),
                        renda_unica: formDataObject.get("renda_unica"),
                        outras_pessoas: [],
                        tem_dependentes: formDataObject.get("tem_dependentes"),
                        dependentes: [],
                        planos_saude: {},
                        seguros_vida: {},
                        tem_patrimonio: formDataObject.get("tem_patrimonio"),
                        patrimonios: [],
                        tem_patrimonio_liquido: formDataObject.get("tem_patrimonio_liquido"),
                        patrimonios_liquidos: [],
                        tem_dividas: formDataObject.get("tem_dividas"),
                        dividas: [],
                        impostos_renda: {}, // Novo objeto para imposto de renda
                        orcamento: {} // Novo objeto para orçamento
                    };

                    if (dadosFormulario.renda_unica === "nao") {
                        document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach(entry => { 
                            const nome = entry.querySelector('input[name="pessoa_nome"]')?.value;
                            const autorizacao = entry.querySelector('select[name="pessoa_autorizacao"]')?.value;
                            if (nome) {
                                dadosFormulario.outras_pessoas.push({
                                    nome: sanitizeInput(nome),
                                    autorizacao: autorizacao
                                });
                            }
                        });
                    }

                    if (dadosFormulario.tem_dependentes === "sim") {
                        document.querySelectorAll("#dependentes-list .dynamic-entry-item").forEach(entry => { 
                            const nome = entry.querySelector('input[name="dep_nome"]')?.value;
                            const idade = entry.querySelector('input[name="dep_idade"]')?.value;
                            const relacao = entry.querySelector('input[name="dep_relacao"]')?.value;
                            if (nome) {
                                dadosFormulario.dependentes.push({
                                    nome: sanitizeInput(nome),
                                    idade: idade ? parseInt(idade) : null,
                                    relacao: sanitizeInput(relacao)
                                });
                            }
                        });
                    }

                    document.querySelectorAll("#plano-saude-section-content .plano-saude-entry").forEach(entry => {
                        const personName = entry.dataset.personName;
                        const personType = entry.dataset.personType;
                        const radioName = entry.querySelector('input[type="radio"]')?.name;
                        const selectedRadio = entry.querySelector(`input[name="${radioName}"]:checked`);
                        if (selectedRadio) {
                            dadosFormulario.planos_saude[personName] = {
                                tipo_pessoa: personType,
                                possui: selectedRadio.value
                            };
                        }
                    });

                    document.querySelectorAll("#seguro-vida-section-content .seguro-vida-entry").forEach(entry => {
                        const personName = entry.dataset.personName;
                        const personType = entry.dataset.personType;
                        const radioName = entry.querySelector('input[type="radio"]')?.name;
                        const selectedRadio = entry.querySelector(`input[name="${radioName}"]:checked`);
                        if (selectedRadio) {
                            dadosFormulario.seguros_vida[personName] = {
                                tipo_pessoa: personType,
                                possui: selectedRadio.value
                            };
                        }
                    });

                    if (dadosFormulario.tem_patrimonio === "sim") {
                        document.querySelectorAll("#patrimonio-list .dynamic-entry-item").forEach((entry, index) => { 
                            const qual = entry.querySelector('input[name="patrimonio_qual"]')?.value;
                            const valorRaw = entry.querySelector('input[name="patrimonio_valor"]')?.value;
                            let valorNumerico = null;
                            if (valorRaw) {
                                valorNumerico = parseCurrency(valorRaw);
                            }
                            const seguro = entry.querySelector(`input[name="patrimonio_seguro_${index}"]:checked`)?.value;
                            const quitado = entry.querySelector(`input[name="patrimonio_quitado_${index}"]:checked`)?.value;
                            if (qual) {
                                dadosFormulario.patrimonios.push({
                                    qual: sanitizeInput(qual),
                                    valor: valorNumerico,
                                    seguro: seguro,
                                    quitado: quitado
                                });
                            }
                        });
                    }

                    // Coleta de dados do Patrimônio Líquido
                    if (dadosFormulario.tem_patrimonio_liquido === "sim") {
                        document.querySelectorAll("#patrimonio-liquido-list .dynamic-entry-item").forEach(entry => {
                            const onde = entry.querySelector('input[name="patrimonio_liquido_onde"]')?.value;
                            const valorRaw = entry.querySelector('input[name="patrimonio_liquido_valor"]')?.value;
                            let valorNumerico = null;
                            if (valorRaw) {
                                valorNumerico = parseCurrency(valorRaw);
                            }
                            if (onde) {
                                dadosFormulario.patrimonios_liquidos.push({
                                    onde: sanitizeInput(onde),
                                    valor: valorNumerico
                                });
                            }
                        });
                    }

                    // Coleta de dados de Dívidas
                    if (dadosFormulario.tem_dividas === "sim") {
                        document.querySelectorAll("#dividas-list .dynamic-entry-item").forEach(entry => {
                            const credor = entry.querySelector('input[name="divida_credor"]')?.value;
                            const saldoRaw = entry.querySelector('input[name="divida_saldo"]')?.value;
                            let saldoNumerico = null;
                            if (saldoRaw) {
                                saldoNumerico = parseCurrency(saldoRaw);
                            }
                            if (credor) {
                                dadosFormulario.dividas.push({
                                    credor: sanitizeInput(credor),
                                    saldo: saldoNumerico
                                });
                            }
                        });
                    }
                    
                    // Coleta de dados de Imposto de Renda
                    document.querySelectorAll("#imposto-renda-section-content .imposto-renda-entry").forEach(entry => {
                        const personName = entry.dataset.personName;
                        const personType = entry.dataset.personType;
                        const radioName = entry.querySelector('input[type="radio"]')?.name;
                        const selectedRadio = entry.querySelector(`input[name="${radioName}"]:checked`);
                        
                        if (selectedRadio) {
                            dadosFormulario.impostos_renda[personName] = {
                                tipo_pessoa: personType,
                                declara: selectedRadio.value
                            };
                            
                            // Se declara imposto de renda, coletar informações adicionais
                            if (selectedRadio.value === "sim") {
                                const tipoNameAttribute = `tipo_${radioName}`;
                                const resultadoNameAttribute = `resultado_${radioName}`;
                                
                                const tipoSelectedRadio = document.querySelector(`input[name="${tipoNameAttribute}"]:checked`);
                                const resultadoSelectedRadio = document.querySelector(`input[name="${resultadoNameAttribute}"]:checked`);
                                
                                if (tipoSelectedRadio) {
                                    dadosFormulario.impostos_renda[personName].tipo = tipoSelectedRadio.value;
                                }
                                
                                if (resultadoSelectedRadio) {
                                    dadosFormulario.impostos_renda[personName].resultado = resultadoSelectedRadio.value;
                                }
                            }
                        }
                    });
                    
                    // Coleta de dados de Orçamento
                    const tipoOrcamentoRadios = document.querySelectorAll('input[name="tipo_orcamento"]');
                    let tipoOrcamento = "individual"; // Padrão para quando há apenas uma pessoa
                    
                    // Se houver mais de uma pessoa com renda, verificar a escolha
                    if (tipoOrcamentoRadios.length > 0) {
                        tipoOrcamentoRadios.forEach(radio => {
                            if (radio.checked) {
                                tipoOrcamento = radio.value;
                            }
                        });
                    }
                    
                    dadosFormulario.orcamento.tipo = tipoOrcamento;
                    dadosFormulario.orcamento.dados = {};
                    
                    if (tipoOrcamento === "conjunto") {
                        // Coletar dados do orçamento conjunto
                        const entradasRaw = document.getElementById("orcamento_conjunto_entradas")?.value;
                        const despesasFixasRaw = document.getElementById("orcamento_conjunto_despesas_fixas")?.value;
                        const despesasVariaveisRaw = document.getElementById("orcamento_conjunto_despesas_variaveis")?.value;
                        const valorPoupadoRaw = document.getElementById("orcamento_conjunto_valor_poupado")?.value;
                        
                        dadosFormulario.orcamento.dados.conjunto = {
                            entradas: parseCurrency(entradasRaw),
                            despesas_fixas: parseCurrency(despesasFixasRaw),
                            despesas_variaveis: parseCurrency(despesasVariaveisRaw),
                            valor_poupado: parseCurrency(valorPoupadoRaw)
                        };
                    } else {
                        // Coletar dados do orçamento individual
                        document.querySelectorAll(".orcamento-individual-entry").forEach(entry => {
                            const personName = entry.dataset.personName;
                            const personId = entry.dataset.personId;
                            
                            const entradasRaw = document.getElementById(`orcamento_${personId}_entradas`)?.value;
                            const despesasFixasRaw = document.getElementById(`orcamento_${personId}_despesas_fixas`)?.value;
                            const despesasVariaveisRaw = document.getElementById(`orcamento_${personId}_despesas_variaveis`)?.value;
                            const valorPoupadoRaw = document.getElementById(`orcamento_${personId}_valor_poupado`)?.value;
                            
                            dadosFormulario.orcamento.dados[personName] = {
                                entradas: parseCurrency(entradasRaw),
                                despesas_fixas: parseCurrency(despesasFixasRaw),
                                despesas_variaveis: parseCurrency(despesasVariaveisRaw),
                                valor_poupado: parseCurrency(valorPoupadoRaw)
                            };
                        });
                    }

                    const { error: updateError } = await supabase
                        .from("formularios_clientes")
                        .update({
                            dados_formulario: dadosFormulario,
                            status: "preenchido",
                            data_preenchimento: new Date().toISOString(),
                        })
                        .eq("id", formId);

                    if (updateError) throw updateError;

                    formContentEl.innerHTML = "<p>Formulário enviado com sucesso!</p>";
                    showMessage("success", "Obrigado por preencher o formulário. Suas respostas foram registradas.");

                } catch (error) {
                    console.error("Erro ao enviar formulário:", error);
                    showMessage("error", `Erro ao enviar: ${error.message}`);
                    submitButton.disabled = false;
                    submitButton.textContent = "Enviar Respostas";
                }
            });
        }
    } catch (error) {
        console.error("Erro ao carregar formulário:", error);
        formContentEl.innerHTML = "<p>Erro ao carregar formulário.</p>";
        showMessage("error", `Erro ao carregar formulário: ${error.message}`);
    }
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    loadForm(token);
});

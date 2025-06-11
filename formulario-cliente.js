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
    .replace(/\'/g, "&#x27;") // Correção: usar aspas simples escapadas
    .replace(/`/g, "&#x60;");
};

const formatCurrency = (value) => {
    if (value === null || value === undefined || value === "") return "";
    let cleanValue = String(value).replace(/[^\d,.-]/g, ''); // Correção: remover espaço extra
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

// --- Funções de Atualização de Labels Dinâmicos (EXISTENTES) ---
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

// --- Funções de Renderização e Gerenciamento de Seções Dinâmicas (EXISTENTES) ---

// ... (Funções save/restore/render para Imposto de Renda, Plano de Saúde, Seguro de Vida - MANTIDAS COMO ESTÃO) ...

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

// --- Funções para Adicionar Entradas Dinâmicas (EXISTENTES e NOVAS) ---

// Função auxiliar para adicionar listener de formatação de moeda
function addCurrencyFormatting(inputElement) {
    if (!inputElement) return;
    inputElement.addEventListener('input', (e) => {
        const rawValue = e.target.value.replace(/[^\d]/g, '');
        if (rawValue) {
            // Evita divisão por zero ou NaN se rawValue for apenas '0'
            const number = parseInt(rawValue, 10);
            if (!isNaN(number)) {
                 e.target.value = (number / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } else {
                 e.target.value = '';
            }
        } else {
            e.target.value = '';
        }
    });
    inputElement.addEventListener('blur', (e) => {
        // Reaplica formatação no blur para garantir consistência
        const rawValue = e.target.value.replace(/[^\d]/g, '');
        if (rawValue) {
            const number = parseInt(rawValue, 10);
             if (!isNaN(number)) {
                 e.target.value = (number / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } else {
                 e.target.value = '';
            }
        } else {
            e.target.value = '';
        }
    });
     // Formata o valor inicial se houver (útil para preenchimento futuro)
    const initialRawValue = inputElement.value.replace(/[^\d]/g, '');
    if (initialRawValue) {
        const initialNumber = parseInt(initialRawValue, 10);
        if (!isNaN(initialNumber)) {
            inputElement.value = (initialNumber / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
    }
}

function addPatrimonioEntry() {
    const patrimonioListEl = document.getElementById("patrimonio-list");
    if (!patrimonioListEl) {
        console.error("Elemento patrimonio-list não encontrado.");
        return;
    }
    const patrimonioIndex = patrimonioListEl.children.length;
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    entryDiv.innerHTML = `
        <input type="text" name="patrimonio_qual" placeholder="Qual? (Ex: Apartamento, Carro)" required>
        <input type="text" name="patrimonio_valor" placeholder="Valor Estimado (R$)" required class="currency-input">
        <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; flex-wrap: wrap;">
            <div class="patrimonio-radio-group-item" style="margin-bottom: 0.5rem;">
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
    addCurrencyFormatting(entryDiv.querySelector(".currency-input"));
}

function addPatrimonioLiquidoEntry() {
    const patrimonioLiquidoListEl = document.getElementById("patrimonio-liquido-list");
    if (!patrimonioLiquidoListEl) {
        console.error("Elemento patrimonio-liquido-list não encontrado.");
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
    addCurrencyFormatting(entryDiv.querySelector(".currency-input"));
}

function addDividaEntry() {
    const dividasListEl = document.getElementById("dividas-list");
    if (!dividasListEl) {
        console.error("Elemento dividas-list não encontrado.");
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
    addCurrencyFormatting(entryDiv.querySelector(".currency-input"));
}

// --- NOVAS Funções para Adicionar Entradas Dinâmicas (Orçamento, Objetivos) ---

function addRendaEntry() {
    const rendaListEl = document.getElementById("renda-list");
    if (!rendaListEl) {
        console.error("Elemento renda-list não encontrado.");
        return;
    }
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    entryDiv.innerHTML = `
        <input type="text" name="renda_descricao" placeholder="Descrição da Renda (Ex: Salário)" required class="form-input">
        <input type="text" name="renda_valor" placeholder="Valor Mensal (R$)" required class="form-input currency-input">
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
    `;
    rendaListEl.appendChild(entryDiv);
    addCurrencyFormatting(entryDiv.querySelector(".currency-input"));
}

function addDespesaFixaEntry() {
    const despesasListEl = document.getElementById("despesas-fixas-list");
    if (!despesasListEl) {
        console.error("Elemento despesas-fixas-list não encontrado.");
        return;
    }
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    entryDiv.innerHTML = `
        <input type="text" name="despesa_fixa_descricao" placeholder="Descrição (Ex: Aluguel, Condomínio)" required class="form-input">
        <input type="text" name="despesa_fixa_valor" placeholder="Valor Mensal (R$)" required class="form-input currency-input">
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
    `;
    despesasListEl.appendChild(entryDiv);
    addCurrencyFormatting(entryDiv.querySelector(".currency-input"));
}

function addDespesaVariavelEntry() {
    const despesasListEl = document.getElementById("despesas-variaveis-list");
    if (!despesasListEl) {
        console.error("Elemento despesas-variaveis-list não encontrado.");
        return;
    }
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    entryDiv.innerHTML = `
        <input type="text" name="despesa_variavel_descricao" placeholder="Descrição (Ex: Alimentação, Lazer)" required class="form-input">
        <input type="text" name="despesa_variavel_valor" placeholder="Valor Médio Mensal (R$)" required class="form-input currency-input">
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
    `;
    despesasListEl.appendChild(entryDiv);
    addCurrencyFormatting(entryDiv.querySelector(".currency-input"));
}

function addObjetivoEntry() {
    const objetivosListEl = document.getElementById("objetivos-list");
    if (!objetivosListEl) {
        console.error("Elemento objetivos-list não encontrado.");
        return;
    }
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    entryDiv.innerHTML = `
        <input type="text" name="objetivo_descricao" placeholder="Qual o objetivo? (Ex: Viagem, Carro)" required class="form-input">
        <input type="text" name="objetivo_valor" placeholder="Valor Estimado (R$)" required class="form-input currency-input">
        <input type="text" name="objetivo_prazo" placeholder="Prazo (Ex: 1 ano, Dez/2026)" required class="form-input">
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
    `;
    objetivosListEl.appendChild(entryDiv);
    addCurrencyFormatting(entryDiv.querySelector("input[name='objetivo_valor']"));
}

// --- Função Principal de Atualização Dinâmica --- (EXISTENTE)
function updateDynamicFormSections() {
    updatePerguntaDependentesLabel();
    updatePerguntaPatrimonioFisicoLabel();
    updatePerguntaPatrimonioLiquidoLabel();
    updatePerguntaDividasLabel();
    renderPlanoSaudeQuestions();
    renderSeguroVidaQuestions();
    renderImpostoRendaQuestions();
}

// --- Função para Anexar Event Listeners --- (MODIFICADA)
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

    // --- NOVOS Seletores para Orçamento e Objetivos ---
    const addRendaBtn = document.getElementById("add-renda-btn");
    const addDespesaFixaBtn = document.getElementById("add-despesa-fixa-btn");
    const addDespesaVariavelBtn = document.getElementById("add-despesa-variavel-btn");
    const addObjetivoBtn = document.getElementById("add-objetivo-btn");

    // --- Listeners EXISTENTES --- (Mantidos)
    if (nomeCompletoInput) {
        nomeCompletoInput.addEventListener("input", () => {
            updateDynamicFormSections();
        });
    }

    if (rendaUnicaSimRadio) {
        rendaUnicaSimRadio.addEventListener("change", () => {
            if(outrasPessoasContainerEl) outrasPessoasContainerEl.style.display = "none";
            if(pessoasListEl) pessoasListEl.innerHTML = '';
            updateDynamicFormSections();
        });
    }
    if (rendaUnicaNaoRadio) {
        rendaUnicaNaoRadio.addEventListener("change", () => {
            if(outrasPessoasContainerEl) outrasPessoasContainerEl.style.display = "block";
            updateDynamicFormSections();
        });
    }

    if (addPersonBtn) {
        addPersonBtn.addEventListener("click", () => {
            if (!pessoasListEl) return;
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
            if(dependentesContainerEl) dependentesContainerEl.style.display = "block";
            updateDynamicFormSections();
        });
    }
    if (temDependentesNaoRadio) {
        temDependentesNaoRadio.addEventListener("change", () => {
            if(dependentesContainerEl) dependentesContainerEl.style.display = "none";
            if(dependentesListEl) dependentesListEl.innerHTML = '';
            updateDynamicFormSections();
        });
    }
    if (addDependenteBtn) {
        addDependenteBtn.addEventListener("click", () => {
            if (!dependentesListEl) return;
            const depIndex = dependentesListEl.children.length;
            const newDependenteEntry = document.createElement("div");
            newDependenteEntry.classList.add("dynamic-entry-item");
            newDependenteEntry.innerHTML = `
                <input type="text" name="dep_nome" placeholder="Nome do dependente" required>
                <input type="number" name="dep_idade" placeholder="Idade" min="0" required>
                <input type="text" name="dep_relacao" placeholder="Relação (filho(a), pai, mãe, irmã(o), Pet, etc...):" required>
                <button type="button" class="remove-dynamic-entry-btn">Remover</button>
            `;
            dependentesListEl.appendChild(newDependenteEntry);

            const nomeDependenteInput = newDependenteEntry.querySelector('input[name="dep_nome"]');
            if (nomeDependenteInput) {
                nomeDependenteInput.addEventListener('input', updateDynamicFormSections);
            }

            newDependenteEntry.querySelector(".remove-dynamic-entry-btn").addEventListener("click", () => {
                newDependenteEntry.remove();
                updateDynamicFormSections();
            });
            updateDynamicFormSections();
        });
    }

    if (temPatrimonioSimRadio) {
        temPatrimonioSimRadio.addEventListener("change", () => {
            if(patrimonioListContainerEl) patrimonioListContainerEl.style.display = "block";
            updateDynamicFormSections();
        });
    }
    if (temPatrimonioNaoRadio) {
        temPatrimonioNaoRadio.addEventListener("change", () => {
            if(patrimonioListContainerEl) patrimonioListContainerEl.style.display = "none";
            if(patrimonioListEl) patrimonioListEl.innerHTML = '';
            updateDynamicFormSections();
        });
    }
    if (addPatrimonioBtn) {
        addPatrimonioBtn.addEventListener("click", addPatrimonioEntry);
    }

    if (temPatrimonioLiquidoSimRadio) {
        temPatrimonioLiquidoSimRadio.addEventListener("change", () => {
            if(patrimonioLiquidoListContainerEl) patrimonioLiquidoListContainerEl.style.display = "block";
            updateDynamicFormSections();
        });
    }
    if (temPatrimonioLiquidoNaoRadio) {
        temPatrimonioLiquidoNaoRadio.addEventListener("change", () => {
            if(patrimonioLiquidoListContainerEl) patrimonioLiquidoListContainerEl.style.display = "none";
            if(patrimonioLiquidoListEl) patrimonioLiquidoListEl.innerHTML = '';
            updateDynamicFormSections();
        });
    }
    if (addPatrimonioLiquidoBtn) {
        addPatrimonioLiquidoBtn.addEventListener("click", addPatrimonioLiquidoEntry);
    }

    if (temDividasSimRadio) {
        temDividasSimRadio.addEventListener("change", () => {
            if(dividasListContainerEl) dividasListContainerEl.style.display = "block";
            updateDynamicFormSections();
        });
    }
    if (temDividasNaoRadio) {
        temDividasNaoRadio.addEventListener("change", () => {
            if(dividasListContainerEl) dividasListContainerEl.style.display = "none";
            if(dividasListEl) dividasListEl.innerHTML = '';
            updateDynamicFormSections();
        });
    }
    if (addDividaBtn) {
        addDividaBtn.addEventListener("click", addDividaEntry);
    }

    // --- NOVOS Listeners para Orçamento e Objetivos ---
    if (addRendaBtn) {
        addRendaBtn.addEventListener("click", addRendaEntry);
    }
    if (addDespesaFixaBtn) {
        addDespesaFixaBtn.addEventListener("click", addDespesaFixaEntry);
    }
    if (addDespesaVariavelBtn) {
        addDespesaVariavelBtn.addEventListener("click", addDespesaVariavelEntry);
    }
    if (addObjetivoBtn) {
        addObjetivoBtn.addEventListener("click", addObjetivoEntry);
    }

    // --- Listener de SUBMIT --- (MODIFICADO)
    if (clientResponseFormEl) {
        clientResponseFormEl.addEventListener("submit", async (e) => {
            e.preventDefault();

            try {
                const formData = new FormData(clientResponseFormEl);
                // --- Coleta de dados EXISTENTES --- (Mantida)
                const nomeCompleto = formData.get("nome_completo");
                const rendaUnica = formData.get("renda_unica");
                const temDependentes = formData.get("tem_dependentes");
                const temPatrimonio = formData.get("tem_patrimonio");
                const temPatrimonioLiquido = formData.get("tem_patrimonio_liquido");
                const temDividas = formData.get("tem_dividas");

                // Validação básica (pode ser expandida se necessário)
                if (!nomeCompleto || !rendaUnica || !temDependentes || !temPatrimonio || !temPatrimonioLiquido || !temDividas) {
                    showMessage("error", "Por favor, preencha todos os campos obrigatórios das seções iniciais.");
                    // Rolar para o topo para o usuário ver a mensagem
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                }

                // --- Coleta de dados das listas dinâmicas EXISTENTES --- (Mantida)
                const outrasPessoas = [];
                if (rendaUnica === "nao") {
                    document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach(entry => {
                        const nome = entry.querySelector('input[name="pessoa_nome"]')?.value.trim();
                        const autorizacao = entry.querySelector('select[name="pessoa_autorizacao"]')?.value;
                        if (nome) {
                            outrasPessoas.push({ nome, autorizacao });
                        }
                    });
                }

                const dependentes = [];
                if (temDependentes === "sim") {
                    document.querySelectorAll("#dependentes-list .dynamic-entry-item").forEach(entry => {
                        const nome = entry.querySelector('input[name="dep_nome"]')?.value.trim();
                        const idade = entry.querySelector('input[name="dep_idade"]')?.value;
                        const relacao = entry.querySelector('input[name="dep_relacao"]')?.value.trim();
                        if (nome && idade && relacao) {
                            dependentes.push({ nome, idade: parseInt(idade, 10), relacao });
                        }
                    });
                }

                const planosSaude = {};
                document.querySelectorAll("#plano-saude-section-content .plano-saude-entry").forEach(entry => {
                    const personName = entry.dataset.personName;
                    const personType = entry.dataset.personType;
                    const radioName = entry.querySelector('input[type="radio"]')?.name;
                    const selectedValue = entry.querySelector(`input[name="${radioName}"]:checked`)?.value;
                    if (personName && selectedValue) {
                        planosSaude[personName] = { tipo: personType, possui: selectedValue };
                    }
                });

                const segurosVida = {};
                document.querySelectorAll("#seguro-vida-section-content .seguro-vida-entry").forEach(entry => {
                    const personName = entry.dataset.personName;
                    const personType = entry.dataset.personType;
                    const radioName = entry.querySelector('input[type="radio"]')?.name;
                    const selectedValue = entry.querySelector(`input[name="${radioName}"]:checked`)?.value;
                    if (personName && selectedValue) {
                        segurosVida[personName] = { tipo: personType, possui: selectedValue };
                    }
                });

                const patrimonios = [];
                if (temPatrimonio === "sim") {
                    document.querySelectorAll("#patrimonio-list .dynamic-entry-item").forEach(entry => {
                        const qual = entry.querySelector('input[name="patrimonio_qual"]')?.value.trim();
                        const valorRaw = entry.querySelector('input[name="patrimonio_valor"]')?.value;
                        const valor = parseCurrency(valorRaw);
                        const radioButtons = entry.querySelectorAll('input[type="radio"]');
                        let seguro = null;
                        let quitado = null;
                        radioButtons.forEach(radio => {
                            if (radio.name.includes('patrimonio_seguro') && radio.checked) seguro = radio.value;
                            if (radio.name.includes('patrimonio_quitado') && radio.checked) quitado = radio.value;
                        });
                        if (qual && valor !== null && seguro && quitado) {
                            patrimonios.push({ qual, valor, seguro, quitado });
                        }
                    });
                }

                const patrimoniosLiquidos = [];
                if (temPatrimonioLiquido === "sim") {
                    document.querySelectorAll("#patrimonio-liquido-list .dynamic-entry-item").forEach(entry => {
                        const qual = entry.querySelector('input[name="patrimonio_liquido_qual"]')?.value.trim();
                        const valorRaw = entry.querySelector('input[name="patrimonio_liquido_valor"]')?.value;
                        const valor = parseCurrency(valorRaw);
                        if (qual && valor !== null) {
                            patrimoniosLiquidos.push({ qual, valor });
                        }
                    });
                }

                const dividas = [];
                if (temDividas === "sim") {
                    document.querySelectorAll("#dividas-list .dynamic-entry-item").forEach(entry => {
                        const credor = entry.querySelector('input[name="divida_credor"]')?.value.trim();
                        const saldoRaw = entry.querySelector('input[name="divida_saldo"]')?.value;
                        const saldo = parseCurrency(saldoRaw);
                        if (credor && saldo !== null) {
                            dividas.push({ credor, saldo });
                        }
                    });
                }

                const impostosRenda = {};
                document.querySelectorAll("#imposto-renda-section-content .imposto-renda-entry").forEach(entry => {
                    const personName = entry.dataset.personName;
                    const personType = entry.dataset.personType;
                    const radioName = entry.querySelector('input[type="radio"]')?.name;
                    const selectedValue = entry.querySelector(`input[name="${radioName}"]:checked`)?.value;
                    if (personName && selectedValue) {
                        const impostoInfo = { tipo: personType, declara: selectedValue };
                        if (selectedValue === "sim") {
                            const tipoRadioName = `${radioName}_tipo`;
                            const resultadoRadioName = `${radioName}_resultado`;
                            const tipoSelectedValue = entry.querySelector(`input[name="${tipoRadioName}"]:checked`)?.value;
                            const resultadoSelectedValue = entry.querySelector(`input[name="${resultadoRadioName}"]:checked`)?.value;
                            if (tipoSelectedValue) impostoInfo.tipo_ir = tipoSelectedValue;
                            if (resultadoSelectedValue) impostoInfo.resultado_ir = resultadoSelectedValue;
                        }
                        impostosRenda[personName] = impostoInfo;
                    }
                });

                // --- NOVA Coleta de dados para Orçamento, Objetivos e Info Adicionais ---
                const orcamentoRenda = [];
                document.querySelectorAll("#renda-list .dynamic-entry-item").forEach(entry => {
                    const descricao = entry.querySelector('input[name="renda_descricao"]')?.value.trim();
                    const valorRaw = entry.querySelector('input[name="renda_valor"]')?.value;
                    const valor = parseCurrency(valorRaw);
                    if (descricao && valor !== null) {
                        orcamentoRenda.push({ descricao, valor });
                    }
                });

                const orcamentoDespesasFixas = [];
                document.querySelectorAll("#despesas-fixas-list .dynamic-entry-item").forEach(entry => {
                    const descricao = entry.querySelector('input[name="despesa_fixa_descricao"]')?.value.trim();
                    const valorRaw = entry.querySelector('input[name="despesa_fixa_valor"]')?.value;
                    const valor = parseCurrency(valorRaw);
                    if (descricao && valor !== null) {
                        orcamentoDespesasFixas.push({ descricao, valor });
                    }
                });

                const orcamentoDespesasVariaveis = [];
                document.querySelectorAll("#despesas-variaveis-list .dynamic-entry-item").forEach(entry => {
                    const descricao = entry.querySelector('input[name="despesa_variavel_descricao"]')?.value.trim();
                    const valorRaw = entry.querySelector('input[name="despesa_variavel_valor"]')?.value;
                    const valor = parseCurrency(valorRaw);
                    if (descricao && valor !== null) {
                        orcamentoDespesasVariaveis.push({ descricao, valor });
                    }
                });

                const objetivos = [];
                document.querySelectorAll("#objetivos-list .dynamic-entry-item").forEach(entry => {
                    const descricao = entry.querySelector('input[name="objetivo_descricao"]')?.value.trim();
                    const valorRaw = entry.querySelector('input[name="objetivo_valor"]')?.value;
                    const valor = parseCurrency(valorRaw);
                    const prazo = entry.querySelector('input[name="objetivo_prazo"]')?.value.trim();
                    if (descricao && valor !== null && prazo) {
                        objetivos.push({ descricao, valor, prazo });
                    }
                });

                const infoAdicionais = formData.get("info_adicionais")?.trim() || "";

                // --- Preparar dados para envio (com novos campos) ---
                const dadosFormulario = {
                    // Campos existentes
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
                    // Novos campos
                    orcamento_renda: orcamentoRenda,
                    orcamento_despesas_fixas: orcamentoDespesasFixas,
                    orcamento_despesas_variaveis: orcamentoDespesasVariaveis,
                    objetivos: objetivos,
                    info_adicionais: infoAdicionais
                };

                // --- Enviar dados para o servidor --- (Mantido)
                const { error } = await supabase
                    .from("formularios_clientes")
                    .update({
                        status: "preenchido",
                        dados_formulario: dadosFormulario,
                        data_preenchimento: new Date().toISOString()
                    })
                    .eq("id", formId);

                if (error) throw error;

                // --- Mostrar mensagem de sucesso --- (Mantido)
                formContentEl.innerHTML = `
                    <div class="success-message">
                        <h2>Formulário enviado com sucesso!</h2>
                        <p>Obrigado por preencher o formulário. Suas respostas foram registradas.</p>
                    </div>
                `;
                // Rolar para o topo para o usuário ver a mensagem
                 window.scrollTo({ top: 0, behavior: 'smooth' });

            } catch (error) {
                console.error("Erro ao enviar formulário:", error);
                showMessage("error", `Erro ao enviar formulário: ${error.message}`);
                 // Rolar para o topo para o usuário ver a mensagem
                 window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    // --- Listener Global para Remover Entradas Dinâmicas --- (Mantido)
    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("remove-dynamic-entry-btn")) {
            const entryItem = e.target.closest(".dynamic-entry-item");
            if (entryItem) {
                entryItem.remove();
                // Chama a função de atualização principal se necessário (ex: se remoção afetar IR/Plano/Seguro)
                // Neste caso, a remoção de orçamento/objetivos não afeta as seções condicionais, então não precisa chamar updateDynamicFormSections()
                // updateDynamicFormSections();
            }
        }
    });
}

// --- Inicialização --- (Mantida)
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

        // *** PROTEÇÃO DE SEGURANÇA CORRIGIDA ***
        // Verificar se o formulário é válido (sem exigir login)
       /* const temPermissao = await window.AuthMiddleware.protegerFormulario(token);
        if (!temPermissao) {
          // Se não tem permissão, mostrar erro mas não redirecionar
          formContentEl.innerHTML = `
                <div class="error-message">
                    <h2>Link inválido ou expirado</h2>
                    <p>O link que você está tentando acessar é inválido ou expirou. Entre em contato para solicitar um novo link.</p>
                </div>
            `;
          return;
        }*/
        // *** FIM DA PROTEÇÃO ***

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

// --- Função para Renderizar o Formulário --- (MODIFICADA)
function renderForm(formData) {
    // Estrutura HTML base do formulário com as seções existentes e as NOVAS seções
    formContentEl.innerHTML = `
        <form id="client-response-form" class="client-form">
            <!-- Seções Existentes (Nome, Renda Única, Outras Pessoas, Dependentes) -->
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

            <!-- Seções Condicionais Existentes (Plano Saúde, Seguro Vida) -->
            <div id="plano-saude-section" style="margin-top: 2rem;">
                <h3 id="plano-saude-section-title" style="display: none;">Informações sobre Plano de Saúde:</h3>
                <div id="plano-saude-section-content"></div>
            </div>

            <div id="seguro-vida-section" style="margin-top: 2rem;">
                <h3 id="seguro-vida-section-title" style="display: none;">Informações sobre Seguro de Vida:</h3>
                <div id="seguro-vida-section-content"></div>
            </div>

            <!-- Seções Existentes (Patrimônio Físico, Líquido, Dívidas) -->
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
                    <label id="label_tem_patrimonio_liquido">Você possui Dinheiro Guardado ou Investido?</label><br> <!-- Corrigido texto -->
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
                    <button type="button" id="add-patrimonio-liquido-btn" class="add-dynamic-entry-btn">+ Adicionar Dinheiro Guardado/Investido</button> <!-- Corrigido texto botão -->
                </div>
            </div>

            <div class="form-section" id="dividas-section" style="margin-top: 2rem;"> <!-- Adicionado margin-top -->
                <div class="form-group">
                    <h3 id="label_tem_dividas" class="form-question-label" style="text-align: left !important; margin-bottom: 0.5rem;">Você possui dívidas?</h3> <!-- Alinhado à esquerda -->
                    <div class="radio-group" style="text-align: left;"> <!-- Alinhado à esquerda -->
                        <input type="radio" id="tem_dividas_sim" name="tem_dividas" value="sim" required>
                        <label for="tem_dividas_sim" class="radio-label">Sim</label>
                        <input type="radio" id="tem_dividas_nao" name="tem_dividas" value="nao" required>
                        <label for="tem_dividas_nao" class="radio-label">Não</label>
                    </div>
                </div>
                <div id="dividas-list-container" class="dynamic-list-container" style="display: none;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: bold;">Dívidas:</label>
                    <div id="dividas-list" class="dynamic-list"></div>
                    <button type="button" id="add-divida-btn" class="add-dynamic-entry-btn">+ Adicionar Dívida</button>
                </div>
            </div>

            <!-- Seção Condicional Existente (Imposto de Renda) -->
            <div id="imposto-renda-section" style="margin-top: 2rem;">
                <h3 id="imposto-renda-section-title" style="display: none;">Informações sobre Imposto de Renda:</h3>
                <div id="imposto-renda-section-content"></div>
            </div>

            <!-- ================================================== -->
            <!-- ========= NOVAS SEÇÕES ADICIONADAS ABAIXO ========= -->
            <!-- ================================================== -->

            <!-- Seção Orçamento -->
            <div id="orcamento-section" style="margin-top: 2rem; border-top: 1px solid var(--theme-border-color); padding-top: 1.5rem;">
                <h3 style="margin-bottom: 1.5rem;">Orçamento Mensal</h3>

                <!-- Entradas de Renda -->
                <div id="renda-container" style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: bold;">Entradas de Renda:</label>
                    <div id="renda-list"></div>
                    <button type="button" id="add-renda-btn" class="add-dynamic-entry-btn">+ Adicionar Renda</button>
                </div>

                <!-- Despesas Fixas -->
                <div id="despesas-fixas-container" style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: bold;">Despesas Fixas:</label>
                    <div id="despesas-fixas-list"></div>
                    <button type="button" id="add-despesa-fixa-btn" class="add-dynamic-entry-btn">+ Adicionar Despesa Fixa</button>
                </div>

                <!-- Despesas Variáveis -->
                <div id="despesas-variaveis-container">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: bold;">Despesas Variáveis:</label>
                    <div id="despesas-variaveis-list"></div>
                    <button type="button" id="add-despesa-variavel-btn" class="add-dynamic-entry-btn">+ Adicionar Despesa Variável</button>
                </div>
            </div>

            <!-- Seção Objetivos -->
            <div id="objetivos-section" style="margin-top: 2rem; border-top: 1px solid var(--theme-border-color); padding-top: 1.5rem;">
                <h3 style="margin-bottom: 1rem;">Objetivos Financeiros</h3>
                <div id="objetivos-list"></div>
                <button type="button" id="add-objetivo-btn" class="add-dynamic-entry-btn">+ Adicionar Objetivo</button>
            </div>

            <!-- Seção Informações Adicionais -->
            <div id="info-adicionais-section" style="margin-top: 2rem; border-top: 1px solid var(--theme-border-color); padding-top: 1.5rem;">
                <h3 style="margin-bottom: 1rem;">Informações Relevantes Adicionais</h3>
                <textarea id="info_adicionais" name="info_adicionais" rows="4" placeholder="Algo mais que considera importante para o planejamento? (Opcional)" style="width: 100%; padding: 0.8rem; border: 1px solid var(--theme-border-color); border-radius: 4px; background-color: var(--theme-bg-dark); color: var(--theme-text-light); box-sizing: border-box;"></textarea>
            </div>

            <!-- ================================================== -->
            <!-- ========= FIM DAS NOVAS SEÇÕES ADICIONADAS ========= -->
            <!-- ================================================== -->

            <!-- Botão de Envio (Existente) -->
            <div class="form-actions" style="margin-top: 2.5rem;">
                <button type="submit" id="submit-btn" class="submit-button">Enviar Respostas</button>
            </div>
        </form>
    `;

    // Anexa todos os event listeners (incluindo os novos)
    attachFormEventListeners(formData.id);
    // Atualiza as seções dinâmicas iniciais (IR, Plano, Seguro)
    updateDynamicFormSections();
}

// --- Ponto de Entrada Principal --- (Mantido)
document.addEventListener("DOMContentLoaded", initForm);


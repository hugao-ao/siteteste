// formulario-cliente.js (INTEGRADO E CORRIGIDO)
import { supabase } from "./supabase.js";

// --- Elementos DOM ---
const formContentEl = document.getElementById("form-content");
const messageAreaEl = document.getElementById("message-area");
const formTitleEl = document.getElementById("form-title");

// --- Estado para preservar seleções ---
let planoSaudeSelections = {};
let seguroVidaSelections = {};

// --- Funções de Utilidade (do original e novas seções) ---
const sanitizeInput = (str) => {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/
/g, "&#x27;") // Corrigido para apóstrofo
    .replace(/`/g, "&#x60;");
};

const formatCurrency = (value) => {
    if (value === null || value === undefined || value === "") return "";
    let cleanValue = String(value).replace(/[^\d,.-]/g, "");
    const commaCount = (cleanValue.match(/,/g) || []).length;
    if (commaCount > 1) {
        const parts = cleanValue.split(",");
        cleanValue = parts.slice(0, -1).join("") + "." + parts.slice(-1);
    } else {
        cleanValue = cleanValue.replace(",", "."); 
    }
    const number = parseFloat(cleanValue);
    if (isNaN(number)) return ""; // Retornar string vazia se NaN para consistência
    return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const parseCurrency = (formattedValue) => {
    if (formattedValue === null || formattedValue === undefined || formattedValue === "") return null;
    const cleanValue = String(formattedValue).replace(/R\$\s?/g, "").replace(/\./g, "").replace(/,/g, ".");
    const number = parseFloat(cleanValue);
    return isNaN(number) ? null : number;
};

const capitalizeName = (name) => {
    if (!name) return "";
    return name.toLowerCase().split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

function showMessage(type, text) {
    messageAreaEl.innerHTML = `<div class="message ${type}">${sanitizeInput(text)}</div>`;
}

// --- NOVAS SEÇÕES: Funções de Renderização, Listeners e Coleta de Dados ---

// --- Seção de Imposto de Renda ---
function renderIRSectionHTML(dadosIR = {}, nomePreenchedor = "Você", outrasPessoasComRenda = []) {
    let outrasPessoasIRHTML = ""; 
    if (outrasPessoasComRenda && outrasPessoasComRenda.length > 0) {
        outrasPessoasComRenda.forEach((pessoa, index) => {
            const pessoaId = `outra_pessoa_ir_${index}`;
            const nomeCapitalizado = capitalizeName(pessoa.nome ? pessoa.nome.split(" ")[0] : `Pessoa ${index + 1}`);
            const dadosPessoaIR = (dadosIR.outras_pessoas && dadosIR.outras_pessoas.find(p => p.nome_ref === pessoa.nome)) || {};
            outrasPessoasIRHTML += `
                <div class="dynamic-entry-item ir-outra-pessoa-entry" data-pessoa-nome-ref="${sanitizeInput(pessoa.nome)}">
                    <h4>${nomeCapitalizado}</h4>
                    <div class="form-group">
                        <label for="ir_declara_${pessoaId}">${nomeCapitalizado} declara Imposto de Renda?</label>
                        <select id="ir_declara_${pessoaId}" name="ir_declara_${pessoaId}" class="ir_declara_outra_pessoa">
                            <option value="sim" ${dadosPessoaIR.declara === "sim" ? "selected" : ""}>Sim</option>
                            <option value="nao" ${dadosPessoaIR.declara === "nao" ? "selected" : ""}>Não</option>
                            <option value="nao_sei" ${(dadosPessoaIR.declara === "nao_sei" || !dadosPessoaIR.declara) ? "selected" : ""}>Não sei informar</option>
                        </select>
                    </div>
                    <div id="ir_details_${pessoaId}" class="ir_details_outra_pessoa" style="display: ${dadosPessoaIR.declara === "sim" ? "block" : "none"};">
                        <div class="form-group">
                            <label for="ir_tipo_${pessoaId}">Tipo da declaração:</label>
                            <select id="ir_tipo_${pessoaId}" name="ir_tipo_${pessoaId}">
                                <option value="" ${!dadosPessoaIR.tipo ? "selected" : ""}>Selecione...</option>
                                <option value="simples" ${dadosPessoaIR.tipo === "simples" ? "selected" : ""}>Simples</option>
                                <option value="deducoes_legais" ${dadosPessoaIR.tipo === "deducoes_legais" ? "selected" : ""}>Deduções Legais</option>
                                <option value="nao_sei" ${dadosPessoaIR.tipo === "nao_sei" ? "selected" : ""}>Não sei informar</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="ir_resultado_${pessoaId}">Resultado da declaração:</label>
                            <select id="ir_resultado_${pessoaId}" name="ir_resultado_${pessoaId}">
                                <option value="" ${!dadosPessoaIR.resultado ? "selected" : ""}>Selecione...</option>
                                <option value="paga" ${dadosPessoaIR.resultado === "paga" ? "selected" : ""}>Paga</option>
                                <option value="restitui" ${dadosPessoaIR.resultado === "restitui" ? "selected" : ""}>Restitui</option>
                                <option value="zero_a_zero" ${dadosPessoaIR.resultado === "zero_a_zero" ? "selected" : ""}>0x0</option>
                                <option value="nao_sei" ${dadosPessoaIR.resultado === "nao_sei" ? "selected" : ""}>Não sei informar</option>
                            </select>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    return `
        <div class="form-section" id="secao-imposto-renda">
            <h3>Imposto de Renda</h3>
            <div class="form-group">
                <label for="ir_declara_preenchedor">${capitalizeName(nomePreenchedor ? nomePreenchedor.split(" ")[0] : "Você")} declara Imposto de Renda?</label>
                <select id="ir_declara_preenchedor" name="ir_declara_preenchedor">
                    <option value="sim" ${dadosIR.declara_preenchedor === "sim" ? "selected" : ""}>Sim</option>
                    <option value="nao" ${(dadosIR.declara_preenchedor === "nao" || !dadosIR.declara_preenchedor) ? "selected" : ""}>Não</option>
                </select>
            </div>
            <div id="ir_details_preenchedor" style="display: ${dadosIR.declara_preenchedor === "sim" ? "block" : "none"};">
                <div class="form-group">
                    <label for="ir_tipo_preenchedor">Tipo da declaração:</label>
                    <select id="ir_tipo_preenchedor" name="ir_tipo_preenchedor">
                        <option value="" ${!dadosIR.tipo_preenchedor ? "selected" : ""}>Selecione...</option>
                        <option value="simples" ${dadosIR.tipo_preenchedor === "simples" ? "selected" : ""}>Simples</option>
                        <option value="deducoes_legais" ${dadosIR.tipo_preenchedor === "deducoes_legais" ? "selected" : ""}>Deduções Legais</option>
                        <option value="nao_sei" ${dadosIR.tipo_preenchedor === "nao_sei" ? "selected" : ""}>Não sei informar</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="ir_resultado_preenchedor">Resultado da declaração:</label>
                    <select id="ir_resultado_preenchedor" name="ir_resultado_preenchedor">
                        <option value="" ${!dadosIR.resultado_preenchedor ? "selected" : ""}>Selecione...</option>
                        <option value="paga" ${dadosIR.resultado_preenchedor === "paga" ? "selected" : ""}>Paga</option>
                        <option value="restitui" ${dadosIR.resultado_preenchedor === "restitui" ? "selected" : ""}>Restitui</option>
                        <option value="zero_a_zero" ${dadosIR.resultado_preenchedor === "zero_a_zero" ? "selected" : ""}>0x0</option>
                        <option value="nao_sei" ${dadosIR.resultado_preenchedor === "nao_sei" ? "selected" : ""}>Não sei informar</option>
                    </select>
                </div>
            </div>
            <div id="ir_outras_pessoas_container">
                ${outrasPessoasIRHTML}
            </div>
        </div>
    `;
}

function attachIRListeners() {
    const container = document.getElementById("secao-imposto-renda");
    if (!container) return;

    const irDeclaraSelect = container.querySelector("#ir_declara_preenchedor");
    const irDetailsDiv = container.querySelector("#ir_details_preenchedor");
    if (irDeclaraSelect && irDetailsDiv) {
        irDeclaraSelect.addEventListener("change", function() {
            irDetailsDiv.style.display = this.value === "sim" ? "block" : "none";
        });
        irDeclaraSelect.dispatchEvent(new Event("change")); 
    }

    container.querySelectorAll(".ir_declara_outra_pessoa").forEach(selectElement => {
        const detailsId = selectElement.id.replace("ir_declara_", "ir_details_");
        const detailsDiv = container.querySelector(`#${detailsId}`);
        if (detailsDiv) {
            selectElement.addEventListener("change", function() {
                detailsDiv.style.display = this.value === "sim" ? "block" : "none";
            });
            selectElement.dispatchEvent(new Event("change"));
        }
    });
}

function collectIRData() {
    const container = document.getElementById("secao-imposto-renda");
    if (!container) return null;
    const data = {
        declara_preenchedor: container.querySelector("#ir_declara_preenchedor")?.value,
        tipo_preenchedor: null,
        resultado_preenchedor: null,
        outras_pessoas: []
    };
    if (data.declara_preenchedor === "sim") {
        data.tipo_preenchedor = container.querySelector("#ir_tipo_preenchedor")?.value;
        data.resultado_preenchedor = container.querySelector("#ir_resultado_preenchedor")?.value;
    }

    container.querySelectorAll(".ir-outra-pessoa-entry").forEach((entry) => {
        const nomeRef = entry.dataset.pessoaNomeRef;
        const selectDeclara = entry.querySelector(`select[name^="ir_declara_outra_pessoa_"]`);
        const declaraValue = selectDeclara?.value;
        let pessoaData = {
            nome_ref: nomeRef,
            declara: declaraValue,
            tipo: null,
            resultado: null
        };
        if (declaraValue === "sim") {
            const tipoSelect = entry.querySelector(`select[name^="ir_tipo_outra_pessoa_"]`);
            const resultadoSelect = entry.querySelector(`select[name^="ir_resultado_outra_pessoa_"]`);
            pessoaData.tipo = tipoSelect?.value;
            pessoaData.resultado = resultadoSelect?.value;
        }
        data.outras_pessoas.push(pessoaData);
    });
    return data;
}

// --- Seção de Orçamento ---
function renderOrcamentoSectionHTML(dadosOrcamento = {}, pessoasParaOrcamentoSeparado = []) {
    let orcamentoSeparadoHTML = ""; 
    if (dadosOrcamento.tipo_info === "separado" && pessoasParaOrcamentoSeparado && pessoasParaOrcamentoSeparado.length > 0) {
        pessoasParaOrcamentoSeparado.forEach((pessoa, index) => {
            const pessoaId = `orc_sep_${index}`;
            const nomeCapitalizado = capitalizeName(pessoa.nome ? pessoa.nome.split(" ")[0] : `Pessoa ${index + 1}`);
            const dadosPessoaOrc = (dadosOrcamento.pessoas && dadosOrcamento.pessoas.find(p => p.nome_ref === pessoa.nome)) || {};
            orcamentoSeparadoHTML += `
                <div class="dynamic-entry-item orcamento-pessoa-entry" data-pessoa-nome-ref="${sanitizeInput(pessoa.nome)}">
                    <h4>Orçamento de ${nomeCapitalizado}</h4>
                    <div class="form-group">
                        <label for="renda_mensal_${pessoaId}">Renda Mensal (R$):</label>
                        <input type="text" id="renda_mensal_${pessoaId}" name="renda_mensal_${pessoaId}" class="currency-input" value="${formatCurrency(dadosPessoaOrc.renda_mensal || "")}">
                    </div>
                    <div class="form-group">
                        <label for="gastos_fixos_${pessoaId}">Gastos Fixos (R$):</label>
                        <input type="text" id="gastos_fixos_${pessoaId}" name="gastos_fixos_${pessoaId}" class="currency-input" value="${formatCurrency(dadosPessoaOrc.gastos_fixos || "")}">
                    </div>
                    <div class="form-group">
                        <label for="gastos_variaveis_${pessoaId}">Gastos Variáveis (R$):</label>
                        <input type="text" id="gastos_variaveis_${pessoaId}" name="gastos_variaveis_${pessoaId}" class="currency-input" value="${formatCurrency(dadosPessoaOrc.gastos_variaveis || "")}">
                    </div>
                    <div class="form-group">
                        <label for="quanto_poupa_${pessoaId}">Quanto Poupa (R$):</label>
                        <input type="text" id="quanto_poupa_${pessoaId}" name="quanto_poupa_${pessoaId}" class="currency-input" value="${formatCurrency(dadosPessoaOrc.quanto_poupa || "")}">
                    </div>
                </div>
            `;
        });
    }

    return `
        <div class="form-section" id="secao-orcamento">
            <h3>Orçamento</h3>
            <div class="form-group">
                <label>Informar orçamento de forma:</label>
                <div class="radio-group">
                    <input type="radio" id="orcamento_unificado_radio" name="orcamento_tipo_info" value="unificado" ${ (dadosOrcamento.tipo_info === "unificado" || !dadosOrcamento.tipo_info) ? "checked" : ""}>
                    <label for="orcamento_unificado_radio">Unificada</label>
                    <input type="radio" id="orcamento_separado_radio" name="orcamento_tipo_info" value="separado" ${dadosOrcamento.tipo_info === "separado" ? "checked" : ""}>
                    <label for="orcamento_separado_radio">Separada (por pessoa com renda)</label>
                </div>
            </div>
            <div id="orcamento_unificado_fields_container" style="display: ${ (dadosOrcamento.tipo_info === "unificado" || !dadosOrcamento.tipo_info) ? "block" : "none"};">
                <div class="form-group">
                    <label for="renda_mensal_total">Renda Mensal Total (R$):</label>
                    <input type="text" id="renda_mensal_total" name="renda_mensal_total" class="currency-input" value="${formatCurrency(dadosOrcamento.renda_mensal_total || "")}">
                </div>
                <div class="form-group">
                    <label for="gastos_fixos_mensais">Gastos Fixos Mensais (R$):</label>
                    <input type="text" id="gastos_fixos_mensais" name="gastos_fixos_mensais" class="currency-input" value="${formatCurrency(dadosOrcamento.gastos_fixos_mensais || "")}">
                </div>
                <div class="form-group">
                    <label for="gastos_variaveis_mensais">Gastos Variáveis Mensais (R$):</label>
                    <input type="text" id="gastos_variaveis_mensais" name="gastos_variaveis_mensais" class="currency-input" value="${formatCurrency(dadosOrcamento.gastos_variaveis_mensais || "")}">
                </div>
                <div class="form-group">
                    <label for="quanto_poupa_mensal">Quanto consegue poupar mensalmente (R$)?</label>
                    <input type="text" id="quanto_poupa_mensal" name="quanto_poupa_mensal" class="currency-input" value="${formatCurrency(dadosOrcamento.quanto_poupa_mensal || "")}">
                </div>
            </div>
            <div id="orcamento_separado_fields_container" style="display: ${dadosOrcamento.tipo_info === "separado" ? "block" : "none"};">
                ${orcamentoSeparadoHTML}
            </div>
        </div>
    `;
}

function attachOrcamentoListeners(getPessoasComRendaCallback) {
    const container = document.getElementById("secao-orcamento");
    if (!container) return;

    const unificadoRadio = container.querySelector("#orcamento_unificado_radio");
    const separadoRadio = container.querySelector("#orcamento_separado_radio");
    const unificadoFieldsDiv = container.querySelector("#orcamento_unificado_fields_container");
    const separadoFieldsDiv = container.querySelector("#orcamento_separado_fields_container");

    function renderSeparadoFieldsIfNeeded() {
        if (separadoRadio.checked) {
            const pessoasParaOrcamento = getPessoasComRendaCallback ? getPessoasComRendaCallback() : [];
            let tempHtml = "";
            if (pessoasParaOrcamento && pessoasParaOrcamento.length > 0) {
                pessoasParaOrcamento.forEach((pessoa, index) => {
                    const pessoaId = `orc_sep_${index}`;
                    const nomeCapitalizado = capitalizeName(pessoa.nome ? pessoa.nome.split(" ")[0] : `Pessoa ${index + 1}`);
                    tempHtml += `
                        <div class="dynamic-entry-item orcamento-pessoa-entry" data-pessoa-nome-ref="${sanitizeInput(pessoa.nome)}">
                            <h4>Orçamento de ${nomeCapitalizado}</h4>
                            <div class="form-group"><label for="renda_mensal_${pessoaId}">Renda Mensal (R$):</label><input type="text" id="renda_mensal_${pessoaId}" name="renda_mensal_${pessoaId}" class="currency-input"></div>
                            <div class="form-group"><label for="gastos_fixos_${pessoaId}">Gastos Fixos (R$):</label><input type="text" id="gastos_fixos_${pessoaId}" name="gastos_fixos_${pessoaId}" class="currency-input"></div>
                            <div class="form-group"><label for="gastos_variaveis_${pessoaId}">Gastos Variáveis (R$):</label><input type="text" id="gastos_variaveis_${pessoaId}" name="gastos_variaveis_${pessoaId}" class="currency-input"></div>
                            <div class="form-group"><label for="quanto_poupa_${pessoaId}">Quanto Poupa (R$):</label><input type="text" id="quanto_poupa_${pessoaId}" name="quanto_poupa_${pessoaId}" class="currency-input"></div>
                        </div>
                    `;
                });
            }
            separadoFieldsDiv.innerHTML = tempHtml;
            // Reaplicar listeners de formatação de moeda aos novos campos
            separadoFieldsDiv.querySelectorAll(".currency-input").forEach(input => {
                input.addEventListener("input", (e) => {
                    const value = parseCurrency(e.target.value);
                    // e.target.value = formatCurrency(value); // Isso pode causar problemas de cursor
                });
                input.addEventListener("blur", (e) => {
                    e.target.value = formatCurrency(parseCurrency(e.target.value));
                });
            });
        }
    }

    function toggleOrcamentoDisplay() {
        if (unificadoRadio.checked) {
            unificadoFieldsDiv.style.display = "block";
            separadoFieldsDiv.style.display = "none";
        } else {
            unificadoFieldsDiv.style.display = "none";
            separadoFieldsDiv.style.display = "block";
            renderSeparadoFieldsIfNeeded();
        }
    }

    if (unificadoRadio && separadoRadio && unificadoFieldsDiv && separadoFieldsDiv) {
        unificadoRadio.addEventListener("change", toggleOrcamentoDisplay);
        separadoRadio.addEventListener("change", toggleOrcamentoDisplay);
        toggleOrcamentoDisplay(); 
    }
}

function collectOrcamentoData() {
    const container = document.getElementById("secao-orcamento");
    if (!container) return null;

    const tipoInfoRadio = container.querySelector("input[name=\"orcamento_tipo_info\"]:checked");
    const tipoInfo = tipoInfoRadio ? tipoInfoRadio.value : "unificado";
    const data = { tipo_info: tipoInfo };

    if (tipoInfo === "unificado") {
        data.renda_mensal_total = parseCurrency(container.querySelector("#renda_mensal_total")?.value);
        data.gastos_fixos_mensais = parseCurrency(container.querySelector("#gastos_fixos_mensais")?.value);
        data.gastos_variaveis_mensais = parseCurrency(container.querySelector("#gastos_variaveis_mensais")?.value);
        data.quanto_poupa_mensal = parseCurrency(container.querySelector("#quanto_poupa_mensal")?.value);
    } else {
        data.pessoas = [];
        container.querySelectorAll(".orcamento-pessoa-entry").forEach((entry) => {
            const nomeRef = entry.dataset.pessoaNomeRef;
            const rendaMensalInput = entry.querySelector(`input[name^="renda_mensal_orc_sep_"]`);
            const gastosFixosInput = entry.querySelector(`input[name^="gastos_fixos_orc_sep_"]`);
            const gastosVariaveisInput = entry.querySelector(`input[name^="gastos_variaveis_orc_sep_"]`);
            const quantoPoupaInput = entry.querySelector(`input[name^="quanto_poupa_orc_sep_"]`);
            
            data.pessoas.push({
                nome_ref: nomeRef,
                renda_mensal: parseCurrency(rendaMensalInput?.value),
                gastos_fixos: parseCurrency(gastosFixosInput?.value),
                gastos_variaveis: parseCurrency(gastosVariaveisInput?.value),
                quanto_poupa: parseCurrency(quantoPoupaInput?.value)
            });
        });
    }
    return data;
}

// --- Seção de Objetivos ---
function renderObjetivosSectionHTML(dadosObjetivos = []) {
    let objetivosHTML = "";
    if (dadosObjetivos && dadosObjetivos.length > 0) {
        dadosObjetivos.forEach((objetivo, index) => {
            objetivosHTML += `
                <div class="dynamic-entry-item objetivo-entry" data-objetivo-index="${index}">
                    <div class="form-group">
                        <label for="objetivo_descricao_${index}">Qual é o objetivo e por que é importante?</label>
                        <textarea id="objetivo_descricao_${index}" name="objetivo_descricao_${index}" rows="3">${sanitizeInput(objetivo.descricao || "")}</textarea>
                    </div>
                    <button type="button" class="remove-objetivo-btn">Remover Objetivo</button>
                </div>
            `;
        });
    }

    return `
        <div class="form-section" id="secao-objetivos">
            <h3>Objetivos</h3>
            <div id="objetivos-list">
                ${objetivosHTML}
            </div>
            <button type="button" id="add-objetivo-btn" class="add-dynamic-entry-btn">Adicionar Objetivo</button>
        </div>
    `;
}

function attachObjetivosListeners() {
    const container = document.getElementById("secao-objetivos");
    if (!container) return;

    const addObjetivoBtn = container.querySelector("#add-objetivo-btn");
    const objetivosList = container.querySelector("#objetivos-list");
    
    function addRemoveListener(button) {
        button.addEventListener("click", function() {
            this.closest(".objetivo-entry").remove();
        });
    }

    if (addObjetivoBtn && objetivosList) {
        addObjetivoBtn.addEventListener("click", function() {
            const objetivoIndex = objetivosList.querySelectorAll(".objetivo-entry").length;
            const newObjetivoDiv = document.createElement("div");
            newObjetivoDiv.classList.add("dynamic-entry-item", "objetivo-entry");
            newObjetivoDiv.dataset.objetivoIndex = objetivoIndex;
            newObjetivoDiv.innerHTML = `
                <div class="form-group">
                    <label for="objetivo_descricao_${objetivoIndex}">Qual é o objetivo e por que é importante?</label>
                    <textarea id="objetivo_descricao_${objetivoIndex}" name="objetivo_descricao_${objetivoIndex}" rows="3"></textarea>
                </div>
                <button type="button" class="remove-objetivo-btn">Remover Objetivo</button>
            `;
            objetivosList.appendChild(newObjetivoDiv);
            addRemoveListener(newObjetivoDiv.querySelector(".remove-objetivo-btn"));
        });
    }
    container.querySelectorAll(".remove-objetivo-btn").forEach(addRemoveListener);
}

function collectObjetivosData() {
    const container = document.getElementById("secao-objetivos");
    if (!container) return [];
    const objetivos = [];
    container.querySelectorAll(".objetivo-entry textarea").forEach(textarea => {
        objetivos.push({ descricao: textarea.value });
    });
    return objetivos;
}

// --- Funções Originais do Formulário (adaptadas para incluir novas seções) ---

function updatePerguntaDependentesLabel() {
    const labelTemDependentes = document.getElementById("label_tem_dependentes");
    if (!labelTemDependentes) return;
    const rendaUnicaSimRadio = document.getElementById("renda_unica_sim");
    const outrasPessoasInputs = document.querySelectorAll("#pessoas-list input[name=\"pessoa_nome\"]");
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
    const outrasPessoasInputs = document.querySelectorAll("#pessoas-list input[name=\"pessoa_nome\"]");
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
    const outrasPessoasInputs = document.querySelectorAll("#pessoas-list input[name=\"pessoa_nome\"]");
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
    const outrasPessoasInputs = document.querySelectorAll("#pessoas-list input[name=\"pessoa_nome\"]");
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
        const nameAttribute = entry.querySelector("input[type=\"radio\"]")?.name; 
        if (nameAttribute) {
            const selectedRadio = entry.querySelector(`input[name="${nameAttribute}"]:checked`);
            if (selectedRadio) {
                planoSaudeSelections[nameAttribute] = selectedRadio.value;
            }
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
    container.innerHTML = "";
    const pessoasDaCasa = [];
    const nomeCompletoInput = document.getElementById("nome_completo");
    if (nomeCompletoInput && nomeCompletoInput.value.trim() !== "") {
        pessoasDaCasa.push({ id: "preenchedor_plano", nome: sanitizeInput(nomeCompletoInput.value.trim()), tipo: "preenchedor" });
    }
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach((entry, index) => { 
            const nomeInput = entry.querySelector("input[name=\"pessoa_nome\"]");
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasDaCasa.push({ id: `outra_pessoa_plano_${index}`, nome: sanitizeInput(nomeInput.value.trim()), tipo: "outra_pessoa_renda" });
            }
        });
    }
    if (document.getElementById("tem_dependentes_sim") && document.getElementById("tem_dependentes_sim").checked) {
        document.querySelectorAll("#dependentes-list .dynamic-entry-item").forEach((entry, index) => { 
            const nomeInput = entry.querySelector("input[name=\"dep_nome\"]");
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasDaCasa.push({ id: `dependente_plano_${index}`, nome: sanitizeInput(nomeInput.value.trim()), tipo: "dependente" });
            }
        });
    }
    const tituloPlanoSaude = document.getElementById("plano-saude-section-title");
    if (pessoasDaCasa.length === 0) {
        container.innerHTML = "<p>Preencha as informações anteriores para definir as perguntas sobre plano de saúde.</p>";
        if(tituloPlanoSaude) tituloPlanoSaude.style.display = "none";
        return;
    }
    if(tituloPlanoSaude) tituloPlanoSaude.style.display = "block";
    pessoasDaCasa.forEach((pessoa) => {
        const primeiroNome = pessoa.nome.split(" ")[0];
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
        const nameAttribute = entry.querySelector("input[type=\"radio\"]")?.name; 
        if (nameAttribute) {
            const selectedRadio = entry.querySelector(`input[name="${nameAttribute}"]:checked`);
            if (selectedRadio) {
                seguroVidaSelections[nameAttribute] = selectedRadio.value;
            }
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
    container.innerHTML = "";
    const pessoasComRenda = [];
    const nomeCompletoInput = document.getElementById("nome_completo");
    if (nomeCompletoInput && nomeCompletoInput.value.trim() !== "") {
        pessoasComRenda.push({ id: "preenchedor_seguro", nome: sanitizeInput(nomeCompletoInput.value.trim()), tipo: "preenchedor" });
    }
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach((entry, index) => { 
            const nomeInput = entry.querySelector("input[name=\"pessoa_nome\"]");
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasComRenda.push({ id: `outra_pessoa_seguro_${index}`, nome: sanitizeInput(nomeInput.value.trim()), tipo: "outra_pessoa_renda" });
            }
        });
    }
    const tituloSeguroVida = document.getElementById("seguro-vida-section-title");
    if (pessoasComRenda.length === 0) {
        container.innerHTML = "<p>Preencha as informações sobre nome e renda para definir as perguntas sobre seguro de vida.</p>";
        if(tituloSeguroVida) tituloSeguroVida.style.display = "none";
        return;
    }
    if(tituloSeguroVida) tituloSeguroVida.style.display = "block";
    pessoasComRenda.forEach((pessoa) => {
        const primeiroNome = pessoa.nome.split(" ")[0];
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

function updateDynamicFormSections() {
    updatePerguntaDependentesLabel();
    updatePerguntaPatrimonioFisicoLabel();
    updatePerguntaPatrimonioLiquidoLabel();
    updatePerguntaDividasLabel(); 
    renderPlanoSaudeQuestions();
    renderSeguroVidaQuestions();
    // Adicionar chamadas para renderizar e attach listeners das novas seções aqui, se necessário
    // No entanto, a lógica de renderização das novas seções já está sendo chamada em loadForm e displayFilledForm
}

// Função para obter pessoas com renda (preenchedor + outras pessoas da lista)
function getPessoasComRenda() {
    const pessoas = [];
    const nomePreenchedorEl = document.getElementById("nome_completo");
    if (nomePreenchedorEl && nomePreenchedorEl.value.trim() !== "") {
        pessoas.push({ nome: nomePreenchedorEl.value.trim(), tipo: "preenchedor" });
    }
    document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach(entry => {
        const nomeInput = entry.querySelector("input[name=\"pessoa_nome\"]");
        if (nomeInput && nomeInput.value.trim() !== "") {
            pessoas.push({ nome: nomeInput.value.trim(), tipo: "outra_pessoa_renda" });
        }
    });
    return pessoas;
}

async function loadForm(token) {
    if (!token) {
        formContentEl.innerHTML = "<p>Link inválido.</p>";
        showMessage("error", "Token não encontrado na URL.");
        return;
    }
    try {
        const { data: formDataFromDB, error: formError } = await supabase
            .from("formularios_clientes")
            .select("*, clientes(nome, projeto)") // Incluído projeto
            .eq("token_unico", token)
            .single();

        if (formError || !formDataFromDB) {
            if (formError && formError.code === "PGRST116") {
                 formContentEl.innerHTML = "<p>Link inválido ou expirado.</p>";
                 showMessage("error", "O link para este formulário não é válido ou já foi utilizado.");
            } else {
                formContentEl.innerHTML = "<p>Erro ao carregar o formulário.</p>";
                showMessage("error", `Erro ao buscar dados: ${formError ? formError.message : "Formulário não encontrado."}`);
            }
            return;
        }

        const clienteNome = formDataFromDB.clientes ? formDataFromDB.clientes.nome : "Cliente";
        const projetoTipo = formDataFromDB.clientes ? formDataFromDB.clientes.projeto : "planejamento"; // Default para planejamento
        formTitleEl.textContent = `Formulário do Cliente - ${capitalizeName(clienteNome.split(" ")[0])}`;
        document.body.className = `theme-${projetoTipo.toLowerCase()}`;

        if (formDataFromDB.status_preenchimento === "preenchido" || formDataFromDB.status_preenchimento === "finalizado") {
            displayFilledForm(formDataFromDB.dados_formulario, clienteNome, projetoTipo);
        } else {
            renderEmptyForm(clienteNome, projetoTipo, formDataFromDB.dados_formulario || {}); // Passa dados parciais se houver
        }

    } catch (error) {
        console.error("Erro crítico ao carregar formulário:", error);
        formContentEl.innerHTML = "<p>Ocorreu um erro inesperado ao carregar o formulário.</p>";
        showMessage("error", "Erro inesperado. Por favor, tente novamente mais tarde.");
    }
}

function renderEmptyForm(clienteNome, projetoTipo, partialData = {}) {
    const nomePreenchedor = partialData.nome_completo || clienteNome;
    const outrasPessoasRendaOriginal = partialData.outras_pessoas_com_renda || [];

    let formHTML = `
        <form id="clienteForm">
            <div class="form-section">
                <h3>Identificação do Cliente</h3>
                <div class="form-group">
                    <label for="nome_completo">Nome Completo:</label>
                    <input type="text" id="nome_completo" name="nome_completo" value="${sanitizeInput(nomePreenchedor)}" required>
                </div>
                <div class="form-group">
                    <label for="data_nascimento">Data de Nascimento:</label>
                    <input type="date" id="data_nascimento" name="data_nascimento" value="${sanitizeInput(partialData.data_nascimento || "")}" required>
                </div>
                 <div class="form-group">
                    <label for="cpf">CPF:</label>
                    <input type="text" id="cpf" name="cpf" value="${sanitizeInput(partialData.cpf || "")}" required>
                </div>
                <div class="form-group">
                    <label for="rg">RG:</label>
                    <input type="text" id="rg" name="rg" value="${sanitizeInput(partialData.rg || "")}">
                </div>
                <div class="form-group">
                    <label for="estado_civil">Estado Civil:</label>
                    <select id="estado_civil" name="estado_civil" required>
                        <option value="" ${!partialData.estado_civil ? "selected" : ""}>Selecione...</option>
                        <option value="solteiro" ${partialData.estado_civil === "solteiro" ? "selected" : ""}>Solteiro(a)</option>
                        <option value="casado" ${partialData.estado_civil === "casado" ? "selected" : ""}>Casado(a)</option>
                        <option value="divorciado" ${partialData.estado_civil === "divorciado" ? "selected" : ""}>Divorciado(a)</option>
                        <option value="viuvo" ${partialData.estado_civil === "viuvo" ? "selected" : ""}>Viúvo(a)</option>
                        <option value="uniao_estavel" ${partialData.estado_civil === "uniao_estavel" ? "selected" : ""}>União Estável</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="profissao">Profissão:</label>
                    <input type="text" id="profissao" name="profissao" value="${sanitizeInput(partialData.profissao || "")}">
                </div>
                <div class="form-group">
                    <label for="escolaridade">Nível de Escolaridade:</label>
                    <select id="escolaridade" name="escolaridade">
                        <option value="" ${!partialData.escolaridade ? "selected" : ""}>Selecione...</option>
                        <option value="fundamental_incompleto" ${partialData.escolaridade === "fundamental_incompleto" ? "selected" : ""}>Fundamental Incompleto</option>
                        <option value="fundamental_completo" ${partialData.escolaridade === "fundamental_completo" ? "selected" : ""}>Fundamental Completo</option>
                        <option value="medio_incompleto" ${partialData.escolaridade === "medio_incompleto" ? "selected" : ""}>Médio Incompleto</option>
                        <option value="medio_completo" ${partialData.escolaridade === "medio_completo" ? "selected" : ""}>Médio Completo</option>
                        <option value="superior_incompleto" ${partialData.escolaridade === "superior_incompleto" ? "selected" : ""}>Superior Incompleto</option>
                        <option value="superior_completo" ${partialData.escolaridade === "superior_completo" ? "selected" : ""}>Superior Completo</option>
                        <option value="pos_graduacao" ${partialData.escolaridade === "pos_graduacao" ? "selected" : ""}>Pós-graduação</option>
                        <option value="mestrado" ${partialData.escolaridade === "mestrado" ? "selected" : ""}>Mestrado</option>
                        <option value="doutorado" ${partialData.escolaridade === "doutorado" ? "selected" : ""}>Doutorado</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="telefone">Telefone (com DDD):</label>
                    <input type="text" id="telefone" name="telefone" value="${sanitizeInput(partialData.telefone || "")}" placeholder="(XX) XXXXX-XXXX">
                </div>
                <div class="form-group">
                    <label for="email">E-mail:</label>
                    <input type="email" id="email" name="email" value="${sanitizeInput(partialData.email || "")}" required>
                </div>
                <div class="form-group">
                    <label for="endereco">Endereço Completo:</label>
                    <input type="text" id="endereco" name="endereco" value="${sanitizeInput(partialData.endereco || "")}">
                </div>
            </div>
            
            ${renderIRSectionHTML(partialData.imposto_renda, nomePreenchedor, outrasPessoasRendaOriginal)}
            ${renderOrcamentoSectionHTML(partialData.orcamento, outrasPessoasRendaOriginal)}
            ${renderObjetivosSectionHTML(partialData.objetivos)}

            <!-- Seções Originais (Renda, Dependentes, Patrimônio, Dívidas, etc.) -->
            <!-- ... (todo o HTML das seções originais do formulário vai aqui, adaptado para usar partialData) ... -->
            <!-- Exemplo de como seria a seção de Renda -->
            <div class="form-section">
                <h3>Renda</h3>
                <div class="form-group">
                    <label>A renda é apenas sua ou há outras pessoas na casa com renda?</label>
                    <div class="radio-group">
                        <input type="radio" id="renda_unica_sim" name="renda_unica" value="sim" ${ (partialData.renda_unica === "sim" || !partialData.renda_unica) ? "checked" : ""}>
                        <label for="renda_unica_sim">Apenas minha</label>
                        <input type="radio" id="renda_unica_nao" name="renda_unica" value="nao" ${partialData.renda_unica === "nao" ? "checked" : ""}>
                        <label for="renda_unica_nao">Há outras pessoas com renda</label>
                    </div>
                </div>
                <div id="outras-pessoas-renda-section" style="display: ${partialData.renda_unica === "nao" ? "block" : "none"};">
                    <div id="pessoas-list"></div>
                    <button type="button" id="add-pessoa-btn" class="add-dynamic-entry-btn">Adicionar Pessoa com Renda</button>
                </div>
                <div class="form-group">
                    <label for="renda_mensal_preenchedor">Sua Renda Mensal Bruta (R$):</label>
                    <input type="text" id="renda_mensal_preenchedor" name="renda_mensal_preenchedor" class="currency-input" value="${formatCurrency(partialData.renda_mensal_preenchedor || "")}">
                </div>
                <!-- Outros campos de renda do preenchedor -->
            </div>

            <!-- ... (Restante das seções originais: Dependentes, Patrimônio Físico, Patrimônio Líquido, Dívidas, Plano de Saúde, Seguro de Vida) ... -->
            <!-- Essas seções precisam ser adicionadas aqui, seguindo o padrão de renderização e coleta de dados -->
            <!-- Por exemplo, para Dependentes: -->
            <div class="form-section">
                <h3 id="dependentes-section-title">Dependentes</h3>
                <div class="form-group">
                    <label id="label_tem_dependentes">Você tem filho/pet/outros parentes que dependem de você?</label>
                    <div class="radio-group">
                        <input type="radio" id="tem_dependentes_sim" name="tem_dependentes" value="sim" ${partialData.tem_dependentes === "sim" ? "checked" : ""}>
                        <label for="tem_dependentes_sim">Sim</label>
                        <input type="radio" id="tem_dependentes_nao" name="tem_dependentes" value="nao" ${ (partialData.tem_dependentes === "nao" || !partialData.tem_dependentes) ? "checked" : ""}>
                        <label for="tem_dependentes_nao">Não</label>
                    </div>
                </div>
                <div id="dependentes-section-content" style="display: ${partialData.tem_dependentes === "sim" ? "block" : "none"};">
                    <div id="dependentes-list"></div>
                    <button type="button" id="add-dependente-btn" class="add-dynamic-entry-btn">Adicionar Dependente</button>
                </div>
            </div>

            <!-- Patrimônio Físico -->
            <div class="form-section">
                <h3 id="patrimonio-fisico-section-title">Patrimônio Físico</h3>
                <div class="form-group">
                    <label id="label_tem_patrimonio_fisico">Você possui patrimônio físico (imóvel, automóvel, jóias, outros...)?</label>
                    <div class="radio-group">
                        <input type="radio" id="tem_patrimonio_fisico_sim" name="tem_patrimonio_fisico" value="sim" ${partialData.tem_patrimonio_fisico === "sim" ? "checked" : ""}>
                        <label for="tem_patrimonio_fisico_sim">Sim</label>
                        <input type="radio" id="tem_patrimonio_fisico_nao" name="tem_patrimonio_fisico" value="nao" ${ (partialData.tem_patrimonio_fisico === "nao" || !partialData.tem_patrimonio_fisico) ? "checked" : ""}>
                        <label for="tem_patrimonio_fisico_nao">Não</label>
                    </div>
                </div>
                <div id="patrimonio-fisico-list-container" style="display: ${partialData.tem_patrimonio_fisico === "sim" ? "block" : "none"};">
                    <div id="patrimonio-fisico-list"></div>
                    <button type="button" id="add-patrimonio-fisico-btn" class="add-dynamic-entry-btn">Adicionar Patrimônio Físico</button>
                </div>
            </div>

            <!-- Patrimônio Líquido -->
            <div class="form-section">
                <h3 id="patrimonio-liquido-section-title">Patrimônio Líquido (Dinheiro Guardado ou Investido)</h3>
                 <div class="form-group">
                    <label id="label_tem_patrimonio_liquido">Você possui Dinheiro Guardado ou Investido?</label>
                    <div class="radio-group">
                        <input type="radio" id="tem_patrimonio_liquido_sim" name="tem_patrimonio_liquido" value="sim" ${partialData.tem_patrimonio_liquido === "sim" ? "checked" : ""}>
                        <label for="tem_patrimonio_liquido_sim">Sim</label>
                        <input type="radio" id="tem_patrimonio_liquido_nao" name="tem_patrimonio_liquido" value="nao" ${ (partialData.tem_patrimonio_liquido === "nao" || !partialData.tem_patrimonio_liquido) ? "checked" : ""}>
                        <label for="tem_patrimonio_liquido_nao">Não</label>
                    </div>
                </div>
                <div id="patrimonio-liquido-list-container" style="display: ${partialData.tem_patrimonio_liquido === "sim" ? "block" : "none"};">
                    <div id="patrimonio-liquido-list"></div>
                    <button type="button" id="add-patrimonio-liquido-btn" class="add-dynamic-entry-btn">Adicionar Patrimônio Líquido</button>
                </div>
            </div>

            <!-- Dívidas -->
            <div class="form-section">
                <h3 id="dividas-section-title">Dívidas</h3>
                <div class="form-group">
                    <label id="label_tem_dividas">Você possui dívidas?</label>
                    <div class="radio-group">
                        <input type="radio" id="tem_dividas_sim" name="tem_dividas" value="sim" ${partialData.tem_dividas === "sim" ? "checked" : ""}>
                        <label for="tem_dividas_sim">Sim</label>
                        <input type="radio" id="tem_dividas_nao" name="tem_dividas" value="nao" ${ (partialData.tem_dividas === "nao" || !partialData.tem_dividas) ? "checked" : ""}>
                        <label for="tem_dividas_nao">Não</label>
                    </div>
                </div>
                <div id="dividas-list-container" style="display: ${partialData.tem_dividas === "sim" ? "block" : "none"};">
                    <div id="dividas-list"></div>
                    <button type="button" id="add-divida-btn" class="add-dynamic-entry-btn">Adicionar Dívida</button>
                </div>
            </div>

            <!-- Plano de Saúde -->
            <div class="form-section">
                <h3 id="plano-saude-section-title" style="display: none;">Plano de Saúde</h3>
                <div id="plano-saude-section-content"></div>
            </div>

            <!-- Seguro de Vida -->
            <div class="form-section">
                <h3 id="seguro-vida-section-title" style="display: none;">Seguro de Vida</h3>
                <div id="seguro-vida-section-content"></div>
            </div>

            <button type="submit" id="submit-button">Enviar Formulário</button>
        </form>
    `;
    formContentEl.innerHTML = formHTML;
    attachFormEventListeners(projetoTipo);
    // Aplicar máscaras e listeners de formatação de moeda
    document.querySelectorAll(".currency-input").forEach(input => {
        input.addEventListener("input", (e) => {
            // A formatação ao digitar pode ser complicada, melhor formatar no blur
        });
        input.addEventListener("blur", (e) => {
            e.target.value = formatCurrency(parseCurrency(e.target.value));
        });
        // Formatar inicialmente se houver valor
        if (input.value) {
            input.value = formatCurrency(parseCurrency(input.value));
        }
    });

    // Inicializar seções dinâmicas originais
    if (partialData.outras_pessoas_com_renda) {
        partialData.outras_pessoas_com_renda.forEach(p => addPessoaRendaEntry(p));
    }
    if (partialData.dependentes) {
        partialData.dependentes.forEach(d => addDependenteEntry(d));
    }
    if (partialData.patrimonio_fisico) {
        partialData.patrimonio_fisico.forEach(p => addPatrimonioFisicoEntry(p));
    }
    if (partialData.patrimonio_liquido) {
        partialData.patrimonio_liquido.forEach(p => addPatrimonioLiquidoEntry(p));
    }
    if (partialData.dividas) {
        partialData.dividas.forEach(d => addDividaEntry(d));
    }

    // Attach listeners para as novas seções
    attachIRListeners();
    attachOrcamentoListeners(getPessoasComRenda); // Passa a função de callback
    attachObjetivosListeners();
    updateDynamicFormSections(); // Para garantir que tudo está atualizado
}

function displayFilledForm(dadosFormulario, clienteNome, projetoTipo) {
    formTitleEl.textContent = `Detalhes do Cliente - ${capitalizeName(clienteNome.split(" ")[0])}`;
    document.body.className = `theme-${projetoTipo.toLowerCase()}`;
    let html = `<div class="filled-data-container">`;
    const nomePreenchedorOriginal = dadosFormulario.nome_completo || clienteNome;
    const outrasPessoasRendaOriginal = dadosFormulario.outras_pessoas_com_renda || [];

    // Seção de Identificação
    html += "<h3>Identificação do Cliente</h3>";
    html += `<p><strong>Nome Completo:</strong> ${sanitizeInput(dadosFormulario.nome_completo || "Não informado")}</p>`;
    html += `<p><strong>Data de Nascimento:</strong> ${sanitizeInput(dadosFormulario.data_nascimento || "Não informado")}</p>`;
    html += `<p><strong>CPF:</strong> ${sanitizeInput(dadosFormulario.cpf || "Não informado")}</p>`;
    html += `<p><strong>RG:</strong> ${sanitizeInput(dadosFormulario.rg || "Não informado")}</p>`;
    html += `<p><strong>Estado Civil:</strong> ${sanitizeInput(dadosFormulario.estado_civil || "Não informado")}</p>`;
    html += `<p><strong>Profissão:</strong> ${sanitizeInput(dadosFormulario.profissao || "Não informado")}</p>`;
    html += `<p><strong>Nível de Escolaridade:</strong> ${sanitizeInput(dadosFormulario.escolaridade || "Não informado")}</p>`;
    html += `<p><strong>Telefone:</strong> ${sanitizeInput(dadosFormulario.telefone || "Não informado")}</p>`;
    html += `<p><strong>Email:</strong> ${sanitizeInput(dadosFormulario.email || "Não informado")}</p>`;
    html += `<p><strong>Endereço:</strong> ${sanitizeInput(dadosFormulario.endereco || "Não informado")}</p>`;

    // Seção de Imposto de Renda (NOVA)
    if (dadosFormulario.imposto_renda) {
        html += "<h3>Imposto de Renda</h3>";
        const irData = dadosFormulario.imposto_renda;
        html += `<p><strong>${capitalizeName(nomePreenchedorOriginal.split(" ")[0])} declara IR?</strong> ${irData.declara_preenchedor === "sim" ? "Sim" : "Não"}</p>`;
        if (irData.declara_preenchedor === "sim") {
            html += `<p><strong>Tipo:</strong> ${sanitizeInput(irData.tipo_preenchedor || "Não informado")}</p>`;
            html += `<p><strong>Resultado:</strong> ${sanitizeInput(irData.resultado_preenchedor || "Não informado")}</p>`;
        }
        if (irData.outras_pessoas && irData.outras_pessoas.length > 0) {
            irData.outras_pessoas.forEach(pessoaIR => {
                html += `<p><strong>${capitalizeName(pessoaIR.nome_ref ? pessoaIR.nome_ref.split(" ")[0] : "Outra Pessoa")} declara IR?</strong> ${pessoaIR.declara === "sim" ? "Sim" : (pessoaIR.declara === "nao" ? "Não" : "Não sei informar")}</p>`;
                if (pessoaIR.declara === "sim") {
                    html += `<p style="padding-left: 20px;"><strong>Tipo:</strong> ${sanitizeInput(pessoaIR.tipo || "Não informado")}</p>`;
                    html += `<p style="padding-left: 20px;"><strong>Resultado:</strong> ${sanitizeInput(pessoaIR.resultado || "Não informado")}</p>`;
                }
            });
        }
    }

    // Seção de Orçamento (NOVA)
    if (dadosFormulario.orcamento) {
        html += "<h3>Orçamento</h3>";
        const orcData = dadosFormulario.orcamento;
        html += `<p><strong>Informado de forma:</strong> ${orcData.tipo_info === "unificado" ? "Unificada" : "Separada"}</p>`;
        if (orcData.tipo_info === "unificado") {
            html += `<p><strong>Renda Mensal Total:</strong> ${formatCurrency(orcData.renda_mensal_total)}</p>`;
            html += `<p><strong>Gastos Fixos Mensais:</strong> ${formatCurrency(orcData.gastos_fixos_mensais)}</p>`;
            html += `<p><strong>Gastos Variáveis Mensais:</strong> ${formatCurrency(orcData.gastos_variaveis_mensais)}</p>`;
            html += `<p><strong>Quanto Poupa Mensalmente:</strong> ${formatCurrency(orcData.quanto_poupa_mensal)}</p>`;
        } else if (orcData.pessoas && orcData.pessoas.length > 0) {
            orcData.pessoas.forEach(pessoaOrc => {
                html += `<p><strong>Orçamento de ${capitalizeName(pessoaOrc.nome_ref ? pessoaOrc.nome_ref.split(" ")[0] : "Outra Pessoa")}:</strong></p>`;
                html += `<ul style="list-style-type: none; padding-left: 20px;">`;
                html += `<li><strong>Renda Mensal:</strong> ${formatCurrency(pessoaOrc.renda_mensal)}</li>`;
                html += `<li><strong>Gastos Fixos:</strong> ${formatCurrency(pessoaOrc.gastos_fixos)}</li>`;
                html += `<li><strong>Gastos Variáveis:</strong> ${formatCurrency(pessoaOrc.gastos_variaveis)}</li>`;
                html += `<li><strong>Quanto Poupa:</strong> ${formatCurrency(pessoaOrc.quanto_poupa)}</li>`;
                html += `</ul>`;
            });
        }
    }

    // Seção de Objetivos (NOVA)
    if (dadosFormulario.objetivos && dadosFormulario.objetivos.length > 0) {
        html += "<h3>Objetivos</h3>";
        dadosFormulario.objetivos.forEach((obj, index) => {
            html += `<p><strong>Objetivo ${index + 1}:</strong> ${sanitizeInput(obj.descricao || "Não informado")}</p>`;
        });
    }

    // Seções Originais (Renda, Dependentes, etc.)
    // ... (aqui vai a lógica para exibir os dados das seções originais, similar ao que já existe no seu código) ...
    // Exemplo para Renda:
    if (dadosFormulario.renda_unica !== undefined) {
        html += "<h3>Renda</h3>";
        html += `<p><strong>Renda é apenas sua?</strong> ${dadosFormulario.renda_unica === "sim" ? "Sim" : "Não, há outras pessoas"}</p>`;
        html += `<p><strong>Sua Renda Mensal Bruta:</strong> ${formatCurrency(dadosFormulario.renda_mensal_preenchedor)}</p>`;
        if (dadosFormulario.renda_unica === "nao" && dadosFormulario.outras_pessoas_com_renda) {
            dadosFormulario.outras_pessoas_com_renda.forEach(p => {
                html += `<p><strong>Nome (Outra Pessoa):</strong> ${sanitizeInput(p.nome)}</p>`;
                html += `<p style="padding-left: 20px;"><strong>Renda Mensal:</strong> ${formatCurrency(p.renda_mensal)}</p>`;
            });
        }
    }
    // Adicionar aqui a exibição das outras seções originais: Dependentes, Patrimônio, Dívidas, Plano de Saúde, Seguro de Vida.

    html += "</div>";
    formContentEl.innerHTML = html;
    showMessage("success", "Formulário carregado com sucesso!");
}


async function handleFormSubmit(event, projetoTipo) {
    event.preventDefault();
    const submitButton = document.getElementById("submit-button");
    submitButton.disabled = true;
    submitButton.textContent = "Enviando...";

    const dadosFormulario = {
        nome_completo: document.getElementById("nome_completo")?.value,
        data_nascimento: document.getElementById("data_nascimento")?.value,
        cpf: document.getElementById("cpf")?.value,
        rg: document.getElementById("rg")?.value,
        estado_civil: document.getElementById("estado_civil")?.value,
        profissao: document.getElementById("profissao")?.value,
        escolaridade: document.getElementById("escolaridade")?.value,
        telefone: document.getElementById("telefone")?.value,
        email: document.getElementById("email")?.value,
        endereco: document.getElementById("endereco")?.value,
        
        // Dados das seções originais (Renda, Dependentes, etc.)
        renda_unica: document.querySelector("input[name=\"renda_unica\"]:checked")?.value,
        renda_mensal_preenchedor: parseCurrency(document.getElementById("renda_mensal_preenchedor")?.value),
        outras_pessoas_com_renda: [], // Será populado abaixo
        tem_dependentes: document.querySelector("input[name=\"tem_dependentes\"]:checked")?.value,
        dependentes: [], // Será populado abaixo
        tem_patrimonio_fisico: document.querySelector("input[name=\"tem_patrimonio_fisico\"]:checked")?.value,
        patrimonio_fisico: [], // Será populado abaixo
        tem_patrimonio_liquido: document.querySelector("input[name=\"tem_patrimonio_liquido\"]:checked")?.value,
        patrimonio_liquido: [], // Será populado abaixo
        tem_dividas: document.querySelector("input[name=\"tem_dividas\"]:checked")?.value,
        dividas: [], // Será populado abaixo
        plano_saude_info: [], // Será populado abaixo
        seguro_vida_info: [], // Será populado abaixo

        // Dados das NOVAS seções
        imposto_renda: collectIRData(),
        orcamento: collectOrcamentoData(),
        objetivos: collectObjetivosData(),
    };

    // Coleta de dados das listas dinâmicas originais
    if (dadosFormulario.renda_unica === "nao") {
        document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach(entry => {
            dadosFormulario.outras_pessoas_com_renda.push({
                nome: entry.querySelector("input[name=\"pessoa_nome\"]")?.value,
                renda_mensal: parseCurrency(entry.querySelector("input[name=\"pessoa_renda\"]")?.value),
            });
        });
    }
    if (dadosFormulario.tem_dependentes === "sim") {
        document.querySelectorAll("#dependentes-list .dynamic-entry-item").forEach(entry => {
            dadosFormulario.dependentes.push({
                nome: entry.querySelector("input[name=\"dep_nome\"]")?.value,
                data_nascimento: entry.querySelector("input[name=\"dep_data_nasc\"]")?.value,
                parentesco: entry.querySelector("select[name=\"dep_parentesco\"]")?.value,
            });
        });
    }
    // ... (Coleta similar para Patrimônio Físico, Líquido e Dívidas) ...
    document.querySelectorAll("#plano-saude-section-content .plano-saude-entry").forEach(entry => {
        const radioName = entry.querySelector("input[type=radio]")?.name;
        const selectedValue = entry.querySelector(`input[name="${radioName}"]:checked`)?.value;
        if (radioName && selectedValue) {
            dadosFormulario.plano_saude_info.push({ 
                pessoa_nome_ref: entry.dataset.personName, 
                possui_plano: selectedValue 
            });
        }
    });
    document.querySelectorAll("#seguro-vida-section-content .seguro-vida-entry").forEach(entry => {
        const radioName = entry.querySelector("input[type=radio]")?.name;
        const selectedValue = entry.querySelector(`input[name="${radioName}"]:checked`)?.value;
        if (radioName && selectedValue) {
            dadosFormulario.seguro_vida_info.push({ 
                pessoa_nome_ref: entry.dataset.personName, 
                possui_seguro: selectedValue 
            });
        }
    });

    const token = new URLSearchParams(window.location.search).get("token");
    try {
        const { error } = await supabase
            .from("formularios_clientes")
            .update({ dados_formulario: dadosFormulario, status_preenchimento: "preenchido", data_preenchimento: new Date().toISOString() })
            .eq("token_unico", token);

        if (error) throw error;

        showMessage("success", "Formulário enviado com sucesso! As informações foram salvas.");
        // Opcional: redirecionar ou mostrar uma mensagem de conclusão permanente
        // displayFilledForm(dadosFormulario, dadosFormulario.nome_completo, projetoTipo); // Atualiza a tela com os dados enviados
        formContentEl.innerHTML = "<p style=\"text-align: center; font-size: 1.2rem; color: var(--theme-success-text);\">Obrigado! Suas informações foram enviadas com sucesso.</p>";

    } catch (error) {
        console.error("Erro ao enviar formulário:", error);
        showMessage("error", `Erro ao salvar os dados: ${error.message}. Por favor, tente novamente.`);
        submitButton.disabled = false;
        submitButton.textContent = "Enviar Formulário";
    }
}

function attachFormEventListeners(projetoTipo) {
    const form = document.getElementById("clienteForm");
    if (form) {
        form.addEventListener("submit", (event) => handleFormSubmit(event, projetoTipo));
    }

    // Listeners para seções dinâmicas originais (Renda, Dependentes, etc.)
    const addPessoaBtn = document.getElementById("add-pessoa-btn");
    if (addPessoaBtn) addPessoaBtn.addEventListener("click", () => addPessoaRendaEntry());
    
    const addDependenteBtn = document.getElementById("add-dependente-btn");
    if (addDependenteBtn) addDependenteBtn.addEventListener("click", () => addDependenteEntry());

    const addPatrimonioFisicoBtn = document.getElementById("add-patrimonio-fisico-btn");
    if (addPatrimonioFisicoBtn) addPatrimonioFisicoBtn.addEventListener("click", () => addPatrimonioFisicoEntry());

    const addPatrimonioLiquidoBtn = document.getElementById("add-patrimonio-liquido-btn");
    if (addPatrimonioLiquidoBtn) addPatrimonioLiquidoBtn.addEventListener("click", () => addPatrimonioLiquidoEntry());

    const addDividaBtn = document.getElementById("add-divida-btn");
    if (addDividaBtn) addDividaBtn.addEventListener("click", () => addDividaEntry());

    // Listeners para mostrar/ocultar seções com base nos radios
    const rendaUnicaRadios = document.querySelectorAll("input[name=\"renda_unica\"]");
    rendaUnicaRadios.forEach(radio => radio.addEventListener("change", () => {
        document.getElementById("outras-pessoas-renda-section").style.display = document.getElementById("renda_unica_nao").checked ? "block" : "none";
        updateDynamicFormSections();
    }));

    const temDependentesRadios = document.querySelectorAll("input[name=\"tem_dependentes\"]");
    temDependentesRadios.forEach(radio => radio.addEventListener("change", () => {
        document.getElementById("dependentes-section-content").style.display = document.getElementById("tem_dependentes_sim").checked ? "block" : "none";
        updateDynamicFormSections();
    }));
    
    const temPatrimonioFisicoRadios = document.querySelectorAll("input[name=\"tem_patrimonio_fisico\"]");
    temPatrimonioFisicoRadios.forEach(radio => radio.addEventListener("change", () => {
        document.getElementById("patrimonio-fisico-list-container").style.display = document.getElementById("tem_patrimonio_fisico_sim").checked ? "block" : "none";
        updateDynamicFormSections();
    }));

    const temPatrimonioLiquidoRadios = document.querySelectorAll("input[name=\"tem_patrimonio_liquido\"]");
    temPatrimonioLiquidoRadios.forEach(radio => radio.addEventListener("change", () => {
        document.getElementById("patrimonio-liquido-list-container").style.display = document.getElementById("tem_patrimonio_liquido_sim").checked ? "block" : "none";
        updateDynamicFormSections();
    }));

    const temDividasRadios = document.querySelectorAll("input[name=\"tem_dividas\"]");
    temDividasRadios.forEach(radio => radio.addEventListener("change", () => {
        document.getElementById("dividas-list-container").style.display = document.getElementById("tem_dividas_sim").checked ? "block" : "none";
        updateDynamicFormSections();
    }));

    // Atualizar labels e seções dinâmicas com base nos inputs de nome e renda
    const nomeCompletoInput = document.getElementById("nome_completo");
    if (nomeCompletoInput) nomeCompletoInput.addEventListener("input", updateDynamicFormSections);
    // Adicionar listener para inputs de nome em "outras pessoas com renda" para atualizar seções dinâmicas
    // Isso precisa ser feito de forma mais robusta, talvez com delegação de eventos se os inputs são adicionados dinamicamente

    // Disparar eventos iniciais para configurar o estado visual correto
    if (document.getElementById("renda_unica_nao")) document.getElementById("renda_unica_nao").dispatchEvent(new Event("change"));
    if (document.getElementById("tem_dependentes_sim")) document.getElementById("tem_dependentes_sim").dispatchEvent(new Event("change"));
    if (document.getElementById("tem_patrimonio_fisico_sim")) document.getElementById("tem_patrimonio_fisico_sim").dispatchEvent(new Event("change"));
    if (document.getElementById("tem_patrimonio_liquido_sim")) document.getElementById("tem_patrimonio_liquido_sim").dispatchEvent(new Event("change"));
    if (document.getElementById("tem_dividas_sim")) document.getElementById("tem_dividas_sim").dispatchEvent(new Event("change"));
}

// Funções para adicionar entradas dinâmicas (pessoas com renda, dependentes, etc.) - MANTER AS ORIGINAIS
let pessoaCounter = 0;
function addPessoaRendaEntry(data = {}) {
    const list = document.getElementById("pessoas-list");
    if (!list) return;
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    entryDiv.innerHTML = `
        <h4>Pessoa ${pessoaCounter + 1}</h4>
        <div class="form-group">
            <label for="pessoa_nome_${pessoaCounter}">Nome:</label>
            <input type="text" id="pessoa_nome_${pessoaCounter}" name="pessoa_nome" value="${sanitizeInput(data.nome || "")}">
        </div>
        <div class="form-group">
            <label for="pessoa_renda_${pessoaCounter}">Renda Mensal (R$):</label>
            <input type="text" id="pessoa_renda_${pessoaCounter}" name="pessoa_renda" class="currency-input" value="${formatCurrency(data.renda_mensal || "")}">
        </div>
        <button type="button" class="remove-dynamic-entry-btn">Remover Pessoa</button>
    `;
    list.appendChild(entryDiv);
    entryDiv.querySelector(".remove-dynamic-entry-btn").addEventListener("click", function() { 
        this.parentElement.remove(); 
        updateDynamicFormSections(); 
    });
    entryDiv.querySelector("input[name=\"pessoa_nome\"]").addEventListener("input", updateDynamicFormSections);
    entryDiv.querySelector("input[name=\"pessoa_renda\"]").addEventListener("blur", (e) => {
        e.target.value = formatCurrency(parseCurrency(e.target.value));
    });
    pessoaCounter++;
    updateDynamicFormSections();
}

let dependenteCounter = 0;
function addDependenteEntry(data = {}) {
    const list = document.getElementById("dependentes-list");
    if (!list) return;
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    entryDiv.innerHTML = `
        <h4>Dependente ${dependenteCounter + 1}</h4>
        <div class="form-group">
            <label for="dep_nome_${dependenteCounter}">Nome do Dependente:</label>
            <input type="text" id="dep_nome_${dependenteCounter}" name="dep_nome" value="${sanitizeInput(data.nome || "")}">
        </div>
        <div class="form-group">
            <label for="dep_data_nasc_${dependenteCounter}">Data de Nascimento:</label>
            <input type="date" id="dep_data_nasc_${dependenteCounter}" name="dep_data_nasc" value="${sanitizeInput(data.data_nascimento || "")}">
        </div>
        <div class="form-group">
            <label for="dep_parentesco_${dependenteCounter}">Parentesco:</label>
            <select id="dep_parentesco_${dependenteCounter}" name="dep_parentesco">
                <option value="" ${!data.parentesco ? "selected" : ""}>Selecione...</option>
                <option value="filho_a" ${data.parentesco === "filho_a" ? "selected" : ""}>Filho(a)</option>
                <option value="conjuge" ${data.parentesco === "conjuge" ? "selected" : ""}>Cônjuge</option>
                <option value="pais" ${data.parentesco === "pais" ? "selected" : ""}>Pai/Mãe</option>
                <option value="irmao_a" ${data.parentesco === "irmao_a" ? "selected" : ""}>Irmão(ã)</option>
                <option value="outro" ${data.parentesco === "outro" ? "selected" : ""}>Outro</option>
            </select>
        </div>
        <button type="button" class="remove-dynamic-entry-btn">Remover Dependente</button>
    `;
    list.appendChild(entryDiv);
    entryDiv.querySelector(".remove-dynamic-entry-btn").addEventListener("click", function() { 
        this.parentElement.remove(); 
        updateDynamicFormSections(); 
    });
    entryDiv.querySelector("input[name=\"dep_nome\"]").addEventListener("input", updateDynamicFormSections);
    dependenteCounter++;
    updateDynamicFormSections();
}

// ... (Manter as funções addPatrimonioFisicoEntry, addPatrimonioLiquidoEntry, addDividaEntry originais aqui) ...
// Exemplo para addPatrimonioFisicoEntry (precisa ser a função completa do seu original)
let patrimonioFisicoCounter = 0;
function addPatrimonioFisicoEntry(data = {}) {
    const list = document.getElementById("patrimonio-fisico-list");
    if (!list) return;
    patrimonioFisicoCounter++;
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    entryDiv.innerHTML = `
        <h4>Patrimônio Físico ${patrimonioFisicoCounter}</h4>
        <div class="form-group">
            <label for="pf_tipo_${patrimonioFisicoCounter}">Tipo:</label>
            <input type="text" id="pf_tipo_${patrimonioFisicoCounter}" name="pf_tipo" value="${sanitizeInput(data.tipo || "")}">
        </div>
        <div class="form-group">
            <label for="pf_descricao_${patrimonioFisicoCounter}">Descrição:</label>
            <input type="text" id="pf_descricao_${patrimonioFisicoCounter}" name="pf_descricao" value="${sanitizeInput(data.descricao || "")}">
        </div>
        <div class="form-group">
            <label for="pf_valor_${patrimonioFisicoCounter}">Valor Estimado (R$):</label>
            <input type="text" id="pf_valor_${patrimonioFisicoCounter}" name="pf_valor" class="currency-input" value="${formatCurrency(data.valor_estimado || "")}">
        </div>
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
    `;
    list.appendChild(entryDiv);
    entryDiv.querySelector(".remove-dynamic-entry-btn").addEventListener("click", function() { this.parentElement.remove(); });
    entryDiv.querySelector("input[name=\"pf_valor\"]").addEventListener("blur", (e) => {
        e.target.value = formatCurrency(parseCurrency(e.target.value));
    });
}

let patrimonioLiquidoCounter = 0;
function addPatrimonioLiquidoEntry(data = {}) {
    const list = document.getElementById("patrimonio-liquido-list");
    if (!list) return;
    patrimonioLiquidoCounter++;
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    entryDiv.innerHTML = `
        <h4>Patrimônio Líquido ${patrimonioLiquidoCounter}</h4>
        <div class="form-group">
            <label for="pl_tipo_${patrimonioLiquidoCounter}">Tipo (Ex: Poupança, CDB, Ações):</label>
            <input type="text" id="pl_tipo_${patrimonioLiquidoCounter}" name="pl_tipo" value="${sanitizeInput(data.tipo || "")}">
        </div>
        <div class="form-group">
            <label for="pl_valor_${patrimonioLiquidoCounter}">Valor (R$):</label>
            <input type="text" id="pl_valor_${patrimonioLiquidoCounter}" name="pl_valor" class="currency-input" value="${formatCurrency(data.valor || "")}">
        </div>
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
    `;
    list.appendChild(entryDiv);
    entryDiv.querySelector(".remove-dynamic-entry-btn").addEventListener("click", function() { this.parentElement.remove(); });
    entryDiv.querySelector("input[name=\"pl_valor\"]").addEventListener("blur", (e) => {
        e.target.value = formatCurrency(parseCurrency(e.target.value));
    });
}

let dividaCounter = 0;
function addDividaEntry(data = {}) {
    const list = document.getElementById("dividas-list");
    if (!list) return;
    dividaCounter++;
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    entryDiv.innerHTML = `
        <h4>Dívida ${dividaCounter}</h4>
        <div class="form-group">
            <label for="div_tipo_${dividaCounter}">Tipo (Ex: Financiamento Imob., Empréstimo Pessoal):</label>
            <input type="text" id="div_tipo_${dividaCounter}" name="div_tipo" value="${sanitizeInput(data.tipo || "")}">
        </div>
        <div class="form-group">
            <label for="div_saldo_devedor_${dividaCounter}">Saldo Devedor (R$):</label>
            <input type="text" id="div_saldo_devedor_${dividaCounter}" name="div_saldo_devedor" class="currency-input" value="${formatCurrency(data.saldo_devedor || "")}">
        </div>
        <div class="form-group">
            <label for="div_prestacao_mensal_${dividaCounter}">Prestação Mensal (R$):</label>
            <input type="text" id="div_prestacao_mensal_${dividaCounter}" name="div_prestacao_mensal" class="currency-input" value="${formatCurrency(data.prestacao_mensal || "")}">
        </div>
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
    `;
    list.appendChild(entryDiv);
    entryDiv.querySelector(".remove-dynamic-entry-btn").addEventListener("click", function() { this.parentElement.remove(); });
    entryDiv.querySelectorAll(".currency-input").forEach(input => {
        input.addEventListener("blur", (e) => {
            e.target.value = formatCurrency(parseCurrency(e.target.value));
        });
    });
}

// --- Inicialização do Formulário ---
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    loadForm(token);
});


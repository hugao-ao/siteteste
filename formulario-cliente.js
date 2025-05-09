// formulario-cliente.js (MODIFICADO DIRETAMENTE)
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
    .replace(/\'/g, "&#x27;") // Corrigido de \' para ", e &#x27; para o apóstrofo
    .replace(/`/g, "&#x60;");
};

const formatCurrency = (value) => {
    if (value === null || value === undefined || value === "") return "";
    let cleanValue = String(value).replace(/[^\d,.-]/g, 
        
    // Remove todos os pontos exceto o último (se for separador de milhar)
    cleanValue = cleanValue.replace(/\.(?=[^.]*\.)/g, 
        
    // Substitui a última vírgula por ponto (para decimal)
    cleanValue = cleanValue.replace(",", ".");
    const number = parseFloat(cleanValue);
    if (isNaN(number)) return "R$ 0,00"; // Retorna um valor padrão em caso de NaN
    return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const parseCurrency = (formattedValue) => {
    if (formattedValue === null || formattedValue === undefined || formattedValue === "") return null;
    const cleanValue = String(formattedValue).replace(/R\$\s?/g, 
        
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

// --- LÓGICA DAS NOVAS SEÇÕES (IR, ORÇAMENTO, OBJETIVOS) INTEGRADA DIRETAMENTE ---

// --- Seção de Imposto de Renda ---
function renderIRSectionHTML(dadosIR = {}, nomePreenchedor = "Você", outrasPessoasComRenda = []) {
    let outrasPessoasIRHTML = 
    outrasPessoasComRenda.forEach((pessoa, index) => {
        const pessoaId = `outra_pessoa_ir_${index}`;
        const nomeCapitalizado = capitalizeName(pessoa.nome.split(" ")[0]);
        const dadosPessoaIR = (dadosIR.outras_pessoas && dadosIR.outras_pessoas[index]) ? dadosIR.outras_pessoas[index] : {};
        outrasPessoasIRHTML += `
            <div class="dynamic-entry-item ir-outra-pessoa-entry" data-pessoa-nome="${sanitizeInput(pessoa.nome)}">
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

    return `
        <div class="form-section" id="secao-imposto-renda">
            <h3>Imposto de Renda</h3>
            <div class="form-group">
                <label for="ir_declara_preenchedor">${capitalizeName(nomePreenchedor)} declara Imposto de Renda?</label>
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

function attachIRListeners(containerSelector = "#secao-imposto-renda") {
    const container = document.querySelector(containerSelector);
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

function collectIRData(containerSelector = "#secao-imposto-renda") {
    const container = document.querySelector(containerSelector);
    if (!container) return null;
    const data = {
        declara_preenchedor: container.querySelector("#ir_declara_preenchedor")?.value,
        tipo_preenchedor: container.querySelector("#ir_tipo_preenchedor")?.value,
        resultado_preenchedor: container.querySelector("#ir_resultado_preenchedor")?.value,
        outras_pessoas: []
    };
    container.querySelectorAll(".ir-outra-pessoa-entry").forEach((entry, index) => {
        const pessoaId = `outra_pessoa_ir_${index}`;
        data.outras_pessoas.push({
            nome_ref: entry.dataset.pessoaNome, // Guardar nome para referência
            declara: entry.querySelector(`#ir_declara_${pessoaId}`)?.value,
            tipo: entry.querySelector(`#ir_tipo_${pessoaId}`)?.value,
            resultado: entry.querySelector(`#ir_resultado_${pessoaId}`)?.value
        });
    });
    return data;
}

// --- Seção de Orçamento ---
function renderOrcamentoSectionHTML(dadosOrcamento = {}, pessoasParaOrcamentoSeparado = []) {
    let orcamentoSeparadoHTML = 
    if (dadosOrcamento.tipo_info === "separado") {
        pessoasParaOrcamentoSeparado.forEach((pessoa, index) => {
            const pessoaId = `orc_sep_${index}`;
            const nomeCapitalizado = capitalizeName(pessoa.nome.split(" ")[0]);
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

function attachOrcamentoListeners(containerSelector = "#secao-orcamento", getPessoasComRendaCallback) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const unificadoRadio = container.querySelector("#orcamento_unificado_radio");
    const separadoRadio = container.querySelector("#orcamento_separado_radio");
    const unificadoFieldsDiv = container.querySelector("#orcamento_unificado_fields_container");
    const separadoFieldsDiv = container.querySelector("#orcamento_separado_fields_container");

    function renderSeparadoFields() {
        const pessoasParaOrcamento = getPessoasComRendaCallback ? getPessoasComRendaCallback() : [];
        let tempHtml = 
        pessoasParaOrcamento.forEach((pessoa, index) => {
            const pessoaId = `orc_sep_${index}`;
            const nomeCapitalizado = capitalizeName(pessoa.nome.split(" ")[0]);
            // Tentar buscar dados existentes se houver (para preenchimento)
            const formState = getCurrentFormState(); // Função hipotética para pegar dados já preenchidos
            const dadosPessoaOrc = (formState?.orcamento?.pessoas && formState.orcamento.pessoas.find(p => p.nome_ref === pessoa.nome)) || {};

            tempHtml += `
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
        separadoFieldsDiv.innerHTML = tempHtml;
        attachCurrencyInputListeners(separadoFieldsDiv); // Re-attach listeners to new fields
    }

    function toggleFields() {
        if (unificadoRadio.checked) {
            unificadoFieldsDiv.style.display = "block";
            separadoFieldsDiv.style.display = "none";
        } else {
            unificadoFieldsDiv.style.display = "none";
            separadoFieldsDiv.style.display = "block";
            renderSeparadoFields(); // Renderiza os campos separados dinamicamente
        }
    }

    if (unificadoRadio && separadoRadio && unificadoFieldsDiv && separadoFieldsDiv) {
        unificadoRadio.addEventListener("change", toggleFields);
        separadoRadio.addEventListener("change", toggleFields);
        toggleFields();
    }
    attachCurrencyInputListeners(container);
}

function attachCurrencyInputListeners(parentElement) {
    parentElement.querySelectorAll(".currency-input").forEach(input => {
        const oldListener = input.currencyListener;
        if (oldListener) {
            input.removeEventListener("input", oldListener);
        }
        const newListener = (e) => {
            let value = e.target.value.replace(/\D/g, 
            if (value === "") {
                e.target.value = "";
                return;
            }
            value = (parseFloat(value) / 100).toFixed(2);
            e.target.value = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
        };
        input.addEventListener("input", newListener);
        input.currencyListener = newListener;
        if (input.value) {
            input.dispatchEvent(new Event("input", { bubbles: true }));
        }
    });
}

function collectOrcamentoData(containerSelector = "#secao-orcamento") {
    const container = document.querySelector(containerSelector);
    if (!container) return null;
    const tipoInfo = container.querySelector("input[name=\"orcamento_tipo_info\"]:checked")?.value;
    const data = { tipo_info: tipoInfo, pessoas: [] };
    if (tipoInfo === "unificado") {
        data.renda_mensal_total = parseCurrency(container.querySelector("#renda_mensal_total")?.value);
        data.gastos_fixos_mensais = parseCurrency(container.querySelector("#gastos_fixos_mensais")?.value);
        data.gastos_variaveis_mensais = parseCurrency(container.querySelector("#gastos_variaveis_mensais")?.value);
        data.quanto_poupa_mensal = parseCurrency(container.querySelector("#quanto_poupa_mensal")?.value);
    } else {
        container.querySelectorAll(".orcamento-pessoa-entry").forEach((entry) => {
            const pessoaNomeRef = entry.dataset.pessoaNomeRef;
            // Encontrar o índice correto para os IDs dos campos
            let originalIndex = -1;
            const allPessoasRenda = getPessoasComRendaParaOrcamento(); // Precisa ser definida ou passada
            allPessoasRenda.forEach((p, idx) => {
                if (p.nome === pessoaNomeRef) {
                    originalIndex = idx;
                }
            });
            if (originalIndex === -1) return; // Não encontrou a pessoa, pular
            const pessoaId = `orc_sep_${originalIndex}`;

            data.pessoas.push({
                nome_ref: pessoaNomeRef,
                renda_mensal: parseCurrency(entry.querySelector(`#renda_mensal_${pessoaId}`)?.value),
                gastos_fixos: parseCurrency(entry.querySelector(`#gastos_fixos_${pessoaId}`)?.value),
                gastos_variaveis: parseCurrency(entry.querySelector(`#gastos_variaveis_${pessoaId}`)?.value),
                quanto_poupa: parseCurrency(entry.querySelector(`#quanto_poupa_${pessoaId}`)?.value),
            });
        });
    }
    return data;
}

// --- Seção de Objetivos ---
let objetivoCounter = 0;

function renderObjetivosSectionHTML(dadosObjetivos = []) {
    objetivoCounter = dadosObjetivos.length;
    let objetivosHtml = dadosObjetivos.map((objetivo, index) => `
        <div class="dynamic-entry-item objetivo-entry" id="objetivo-entry-${index}">
            <button type="button" class="remove-dynamic-entry-btn remove-objetivo-btn" data-objetivo-id="objetivo-entry-${index}">Remover</button>
            <div class="form-group">
                <label for="objetivo_descricao_${index}">Qual é o objetivo e por que é importante?</label>
                <textarea id="objetivo_descricao_${index}" name="objetivo_descricao_${index}" rows="3">${sanitizeInput(objetivo.descricao || "")}</textarea>
            </div>
        </div>
    `).join("");

    return `
        <div class="form-section" id="secao-objetivos">
            <h3>Objetivos</h3>
            <div id="objetivos-list-container">
                ${objetivosHtml}
            </div>
            <button type="button" id="add-objetivo-btn-novas-secoes" class="add-dynamic-entry-btn">Adicionar Objetivo</button>
        </div>
    `;
}

function attachObjetivosListeners(containerSelector = "#secao-objetivos") {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    const addButton = container.querySelector("#add-objetivo-btn-novas-secoes");
    const listContainer = container.querySelector("#objetivos-list-container");
    objetivoCounter = listContainer.querySelectorAll(".objetivo-entry").length;

    if (addButton && listContainer) {
        addButton.addEventListener("click", () => {
            const entryId = `objetivo-entry-${objetivoCounter}`;
            const newEntry = document.createElement("div");
            newEntry.classList.add("dynamic-entry-item", "objetivo-entry");
            newEntry.id = entryId;
            newEntry.innerHTML = `
                <button type="button" class="remove-dynamic-entry-btn remove-objetivo-btn" data-objetivo-id="${entryId}">Remover</button>
                <div class="form-group">
                    <label for="objetivo_descricao_${objetivoCounter}">Qual é o objetivo e por que é importante?</label>
                    <textarea id="objetivo_descricao_${objetivoCounter}" name="objetivo_descricao_${objetivoCounter}" rows="3"></textarea>
                </div>
            `;
            listContainer.appendChild(newEntry);
            newEntry.querySelector(".remove-objetivo-btn").addEventListener("click", function() {
                document.getElementById(this.dataset.objetivoId).remove();
            });
            objetivoCounter++;
        });
    }
    listContainer.querySelectorAll(".remove-objetivo-btn").forEach(button => {
        button.addEventListener("click", function() {
            document.getElementById(this.dataset.objetivoId).remove();
        });
    });
}

function collectObjetivosData(containerSelector = "#secao-objetivos") {
    const container = document.querySelector(containerSelector);
    if (!container) return [];
    const data = [];
    container.querySelectorAll(".objetivo-entry textarea").forEach(textarea => {
        if (textarea.value.trim() !== "") {
            data.push({ descricao: textarea.value.trim() });
        }
    });
    return data;
}

// --- Funções de Exibição de Dados Salvos (para displayFilledForm) ---
function displayIRDataHTML(irData, nomePreenchedor = "Preenchedor", pessoasComRendaOriginal = []) {
    if (!irData) return "<p>Dados de Imposto de Renda não disponíveis.</p>";
    let html = `<h3>Imposto de Renda</h3>`;
    html += `<p><strong>${capitalizeName(nomePreenchedor)} declara IR?</strong> ${sanitizeInput(irData.declara_preenchedor || "N/A")}</p>`;
    if (irData.declara_preenchedor === "sim") {
        html += `<p style="margin-left: 20px;"><strong>Tipo:</strong> ${sanitizeInput(irData.tipo_preenchedor || "N/A")}</p>`;
        html += `<p style="margin-left: 20px;"><strong>Resultado:</strong> ${sanitizeInput(irData.resultado_preenchedor || "N/A")}</p>`;
    }
    if (irData.outras_pessoas && irData.outras_pessoas.length > 0) {
        html += `<h4>Outras Pessoas:</h4>`;
        irData.outras_pessoas.forEach((pessoaIR) => {
            const nomeDisplay = pessoaIR.nome_ref ? capitalizeName(pessoaIR.nome_ref.split(" ")[0]) : "Outra Pessoa";
            html += `<p><strong>${nomeDisplay} declara IR?</strong> ${sanitizeInput(pessoaIR.declara || "N/A")}</p>`;
            if (pessoaIR.declara === "sim") {
                html += `<p style="margin-left: 20px;"><strong>Tipo:</strong> ${sanitizeInput(pessoaIR.tipo || "N/A")}</p>`;
                html += `<p style="margin-left: 20px;"><strong>Resultado:</strong> ${sanitizeInput(pessoaIR.resultado || "N/A")}</p>`;
            }
        });
    }
    return html;
}

function displayOrcamentoDataHTML(orcamentoData, nomePreenchedor = "Preenchedor", pessoasComRendaOriginal = []) {
    if (!orcamentoData) return "<p>Dados de Orçamento não disponíveis.</p>";
    let html = `<h3>Orçamento</h3>`;
    html += `<p><strong>Tipo de Informação:</strong> ${orcamentoData.tipo_info === "separado" ? "Separada" : "Unificada"}</p>`;
    if (orcamentoData.tipo_info === "unificado" || !orcamentoData.tipo_info) {
        html += `<p><strong>Renda Mensal Total:</strong> ${formatCurrency(orcamentoData.renda_mensal_total || 0)}</p>`;
        html += `<p><strong>Gastos Fixos Mensais:</strong> ${formatCurrency(orcamentoData.gastos_fixos_mensais || 0)}</p>`;
        html += `<p><strong>Gastos Variáveis Mensais:</strong> ${formatCurrency(orcamentoData.gastos_variaveis_mensais || 0)}</p>`;
        html += `<p><strong>Quanto Poupa Mensalmente:</strong> ${formatCurrency(orcamentoData.quanto_poupa_mensal || 0)}</p>`;
    } else if (orcamentoData.pessoas && orcamentoData.pessoas.length > 0) {
        orcamentoData.pessoas.forEach((pessoaOrc) => {
            const nomeDisplay = pessoaOrc.nome_ref ? capitalizeName(pessoaOrc.nome_ref.split(" ")[0]) : "Pessoa";
            html += `<h4>Orçamento de ${nomeDisplay}</h4>`;
            html += `<p style="margin-left: 20px;"><strong>Renda Mensal:</strong> ${formatCurrency(pessoaOrc.renda_mensal || 0)}</p>`;
            html += `<p style="margin-left: 20px;"><strong>Gastos Fixos:</strong> ${formatCurrency(pessoaOrc.gastos_fixos || 0)}</p>`;
            html += `<p style="margin-left: 20px;"><strong>Gastos Variáveis:</strong> ${formatCurrency(pessoaOrc.gastos_variaveis || 0)}</p>`;
            html += `<p style="margin-left: 20px;"><strong>Quanto Poupa:</strong> ${formatCurrency(pessoaOrc.quanto_poupa || 0)}</p>`;
        });
    }
    return html;
}

function displayObjetivosDataHTML(objetivosData) {
    if (!objetivosData || objetivosData.length === 0) return "<p>Nenhum objetivo informado.</p>";
    let html = `<h3>Objetivos</h3>`;
    objetivosData.forEach((objetivo, index) => {
        html += `<p><strong>Objetivo ${index + 1}:</strong> ${sanitizeInput(objetivo.descricao || "N/A")}</p>`;
    });
    return html;
}

// --- FUNÇÕES DO SCRIPT ORIGINAL (adaptadas e/ou mantidas) ---
// (Cole aqui as funções do formulario-cliente-ORIGINAL-NOVO.js, 
//  e então integre as chamadas às funções das novas seções nos locais corretos: 
//  buildFormHTML, handleFormSubmit, displayFilledForm)

// Exemplo de como a integração seria feita (ESBOÇO):

// Função auxiliar para obter pessoas com renda (você precisa adaptar isso à sua lógica existente)
function getPessoasComRendaParaOrcamento() {
    const pessoas = [];
    const nomePreenchedorEl = document.getElementById("nome_completo");
    if (nomePreenchedorEl && nomePreenchedorEl.value.trim() !== "") {
        pessoas.push({ nome: nomePreenchedorEl.value.trim() });
    }
    // Adicionar lógica para buscar outras pessoas com renda da sua estrutura de "pessoas-list"
    document.querySelectorAll("#pessoas-list .dynamic-entry-item input[name=\"pessoa_nome\"]").forEach(input => {
        if (input.value.trim() !== "") {
            pessoas.push({ nome: input.value.trim() });
        }
    });
    return pessoas;
}

// Função auxiliar para obter o estado atual do formulário (para pré-preenchimento do orçamento separado)
function getCurrentFormState() {
    // Esta função precisaria coletar os dados do formulário como estão no momento.
    // É um placeholder, pois a implementação real dependeria de como você gerencia o estado.
    // Por simplicidade, vamos retornar um objeto vazio.
    // No seu código original, você pode ter uma forma de acessar `currentFormData` ou similar.
    return {
        // imposto_renda: collectIRData(), // Descomente se precisar para pré-preenchimento
        // orcamento: collectOrcamentoData(), // Descomente se precisar para pré-preenchimento
        // objetivos: collectObjetivosData() // Descomente se precisar para pré-preenchimento
    };
}


// --- Funções de atualização de labels (do original) ---
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
        const nameAttribute = entry.querySelector("input[type=\"radio\"]").name; 
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
    container.innerHTML = 
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
        const nameAttribute = entry.querySelector("input[type=\"radio\"]").name; 
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
    container.innerHTML = 
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
    // Adicionar chamadas para atualizar as novas seções se necessário (ex: se dependem de outras partes do form)
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
            if (formError && formError.code === "PGRST116") { // Código para "No rows found"
                 formContentEl.innerHTML = "<p>Link inválido ou expirado.</p>";
                 showMessage("error", "O link para este formulário não é válido ou já foi utilizado.");
            } else {
                console.error("Erro ao carregar formulário:", formError);
                formContentEl.innerHTML = "<p>Erro ao carregar o formulário. Tente novamente mais tarde.</p>";
                showMessage("error", `Erro: ${formError?.message || "Desconhecido"}`);
            }
            return;
        }

        if (formData.status_preenchimento === "CONCLUIDO") {
            formTitleEl.textContent = `Resumo do Cliente: ${capitalizeName(formData.clientes.nome)}`;
            displayFilledForm(formData);
        } else {
            formTitleEl.textContent = `Formulário do Cliente: ${capitalizeName(formData.clientes.nome)}`;
            buildFormHTML(formData);
        }
    } catch (e) {
        console.error("Exceção ao carregar formulário:", e);
        formContentEl.innerHTML = "<p>Ocorreu um erro inesperado. Por favor, contate o suporte.</p>";
        showMessage("error", "Erro crítico ao processar o formulário.");
    }
}

function buildFormHTML(formData) {
    const dados = formData.dados_formulario || {};
    const nomePreenchedor = formData.clientes?.nome || "Você";

    // Coletar pessoas com renda para IR e Orçamento
    const pessoasComRendaExistentes = [];
    if (dados.pessoas_com_renda) {
        dados.pessoas_com_renda.forEach(p => pessoasComRendaExistentes.push({ nome: p.nome }));
    }
    // Se não houver outras pessoas com renda, mas o preenchedor tem nome, adicioná-lo para o IR e Orçamento separado
    // Esta lógica precisa ser refinada baseada em como "pessoas_com_renda" é populado no seu form original
    // Por ora, vamos assumir que getPessoasComRendaParaOrcamento() vai pegar do form atual

    let formHTML = `
        <form id="clienteForm">
            <input type="hidden" id="form_id" name="form_id" value="${formData.id}">
            <input type="hidden" id="cliente_id" name="cliente_id" value="${formData.cliente_id}">
            
            <h2>Dados Pessoais</h2>
            <div class="form-group">
                <label for="nome_completo">Nome Completo:</label>
                <input type="text" id="nome_completo" name="nome_completo" value="${sanitizeInput(formData.clientes.nome)}" required>
            </div>
            <div class="form-group">
                <label for="email">E-mail:</label>
                <input type="email" id="email" name="email" value="${sanitizeInput(dados.email || formData.clientes.email || 
            </div>
            
            <!-- ... (resto da sua seção de dados pessoais e outras seções existentes) ... -->
            <!-- Cole aqui as seções existentes do seu formulário original -->
            <!-- Exemplo de como você poderia ter a seção de "Renda Única" -->
            <div class="form-section">
                <h3>Fonte de Renda Principal</h3>
                <div class="form-group radio-group">
                    <label>A renda da casa é composta apenas por você?</label>
                    <div>
                        <input type="radio" id="renda_unica_sim" name="renda_unica" value="sim" ${dados.renda_unica === "sim" ? "checked" : ""} required>
                        <label for="renda_unica_sim">Sim</label>
                    </div>
                    <div>
                        <input type="radio" id="renda_unica_nao" name="renda_unica" value="nao" ${dados.renda_unica === "nao" ? "checked" : ""}>
                        <label for="renda_unica_nao">Não, outras pessoas também contribuem</label>
                    </div>
                </div>
                <div id="outras-pessoas-renda-section" style="display: ${dados.renda_unica === "nao" ? "block" : "none"};">
                    <label>Quem são as outras pessoas com renda na casa?</label>
                    <div id="pessoas-list"></div>
                    <button type="button" id="add-pessoa-btn" class="add-dynamic-entry-btn">Adicionar Pessoa com Renda</button>
                </div>
            </div>
            
            <!-- ... (outras seções existentes como Dependentes, Patrimônio, Dívidas, etc.) ... -->
            <!-- Onde você tem a seção de Dívidas, por exemplo -->
            <div class="form-section" id="dividas-section">
                <h3>Dívidas</h3>
                <div class="form-group radio-group">
                    <label id="label_tem_dividas">Você possui dívidas?</label>
                    <div>
                        <input type="radio" id="tem_dividas_sim" name="tem_dividas" value="sim" ${dados.tem_dividas === "sim" ? "checked" : ""} required>
                        <label for="tem_dividas_sim">Sim</label>
                    </div>
                    <div>
                        <input type="radio" id="tem_dividas_nao" name="tem_dividas" value="nao" ${dados.tem_dividas === "nao" ? "checked" : ""}>
                        <label for="tem_dividas_nao">Não</label>
                    </div>
                </div>
                <div id="dividas-list-container" style="display: ${dados.tem_dividas === "sim" ? "block" : "none"};">
                    <div id="dividas-list"></div>
                    <button type="button" id="add-divida-btn" class="add-dynamic-entry-btn">Adicionar Dívida</button>
                </div>
            </div>

            <!-- NOVAS SEÇÕES INSERIDAS AQUI -->
            ${renderIRSectionHTML(dados.imposto_renda || {}, nomePreenchedor, getPessoasComRendaParaOrcamento())}
            ${renderOrcamentoSectionHTML(dados.orcamento || {}, getPessoasComRendaParaOrcamento())}
            ${renderObjetivosSectionHTML(dados.objetivos || [])}
            <!-- FIM DAS NOVAS SEÇÕES -->

            <button type="submit">Enviar Formulário</button>
        </form>
    `;
    formContentEl.innerHTML = formHTML;

    // Adicionar listeners para seções existentes (adapte do seu código original)
    // Exemplo:
    const rendaUnicaSimRadio = document.getElementById("renda_unica_sim");
    const rendaUnicaNaoRadio = document.getElementById("renda_unica_nao");
    const outrasPessoasSection = document.getElementById("outras-pessoas-renda-section");
    const addPessoaBtn = document.getElementById("add-pessoa-btn");
    const pessoasList = document.getElementById("pessoas-list");
    let pessoaCounterOriginal = dados.pessoas_com_renda?.length || 0;

    function toggleOutrasPessoasRenda() {
        if (rendaUnicaNaoRadio && rendaUnicaNaoRadio.checked) {
            outrasPessoasSection.style.display = "block";
        } else {
            outrasPessoasSection.style.display = "none";
        }
        updateDynamicFormSections(); // Atualiza labels e seções dependentes
    }

    if (rendaUnicaSimRadio && rendaUnicaNaoRadio) {
        rendaUnicaSimRadio.addEventListener("change", toggleOutrasPessoasRenda);
        rendaUnicaNaoRadio.addEventListener("change", toggleOutrasPessoasRenda);
        toggleOutrasPessoasRenda(); // Estado inicial
    }

    if (addPessoaBtn && pessoasList) {
        addPessoaBtn.addEventListener("click", () => {
            // Lógica para adicionar pessoa (do seu código original)
            const pessoaDiv = document.createElement("div");
            pessoaDiv.classList.add("dynamic-entry-item");
            pessoaDiv.id = `pessoa_com_renda_${pessoaCounterOriginal}`;
            pessoaDiv.innerHTML = `
                <label for="pessoa_nome_${pessoaCounterOriginal}">Nome da Pessoa:</label>
                <input type="text" id="pessoa_nome_${pessoaCounterOriginal}" name="pessoa_nome" required>
                <button type="button" class="remove-dynamic-entry-btn" onclick="this.parentElement.remove(); updateDynamicFormSections();">Remover</button>
            `;
            pessoasList.appendChild(pessoaDiv);
            pessoaCounterOriginal++;
            updateDynamicFormSections();
        });
        // Renderizar pessoas existentes (do seu código original)
        (dados.pessoas_com_renda || []).forEach((pessoa, index) => {
            const pessoaDiv = document.createElement("div");
            pessoaDiv.classList.add("dynamic-entry-item");
            pessoaDiv.id = `pessoa_com_renda_${index}`;
            pessoaDiv.innerHTML = `
                <label for="pessoa_nome_${index}">Nome da Pessoa:</label>
                <input type="text" id="pessoa_nome_${index}" name="pessoa_nome" value="${sanitizeInput(pessoa.nome)}" required>
                <button type="button" class="remove-dynamic-entry-btn" onclick="this.parentElement.remove(); updateDynamicFormSections();">Remover</button>
            `;
            pessoasList.appendChild(pessoaDiv);
        });
    }
    
    // Lógica para Dívidas (exemplo, adapte do seu original)
    const temDividasSimRadio = document.getElementById("tem_dividas_sim");
    const temDividasNaoRadio = document.getElementById("tem_dividas_nao");
    const dividasListContainer = document.getElementById("dividas-list-container");
    const addDividaBtn = document.getElementById("add-divida-btn");
    const dividasList = document.getElementById("dividas-list");
    let dividaCounterOriginal = dados.dividas?.length || 0;

    function toggleDividas() {
        if (temDividasSimRadio && temDividasSimRadio.checked) {
            dividasListContainer.style.display = "block";
        } else {
            dividasListContainer.style.display = "none";
        }
    }
    if (temDividasSimRadio && temDividasNaoRadio) {
        temDividasSimRadio.addEventListener("change", toggleDividas);
        temDividasNaoRadio.addEventListener("change", toggleDividas);
        toggleDividas();
    }
    if (addDividaBtn && dividasList) {
        addDividaBtn.addEventListener("click", () => {
            // Lógica para adicionar dívida (do seu código original)
            const dividaDiv = document.createElement("div");
            dividaDiv.classList.add("dynamic-entry-item");
            dividaDiv.id = `divida_entry_${dividaCounterOriginal}`;
            dividaDiv.innerHTML = `
                <label for="divida_descricao_${dividaCounterOriginal}">Descrição da Dívida:</label>
                <input type="text" id="divida_descricao_${dividaCounterOriginal}" name="divida_descricao" required>
                <label for="divida_valor_${dividaCounterOriginal}">Valor (R$):</label>
                <input type="text" id="divida_valor_${dividaCounterOriginal}" name="divida_valor" class="currency-input" required>
                <button type="button" class="remove-dynamic-entry-btn" onclick="this.parentElement.remove();">Remover</button>
            `;
            dividasList.appendChild(dividaDiv);
            attachCurrencyInputListeners(dividaDiv); // Aplicar ao novo campo de moeda
            dividaCounterOriginal++;
        });
        // Renderizar dívidas existentes
        (dados.dividas || []).forEach((divida, index) => {
            const dividaDiv = document.createElement("div");
            dividaDiv.classList.add("dynamic-entry-item");
            dividaDiv.id = `divida_entry_${index}`;
            dividaDiv.innerHTML = `
                <label for="divida_descricao_${index}">Descrição da Dívida:</label>
                <input type="text" id="divida_descricao_${index}" name="divida_descricao" value="${sanitizeInput(divida.descricao)}" required>
                <label for="divida_valor_${index}">Valor (R$):</label>
                <input type="text" id="divida_valor_${index}" name="divida_valor" class="currency-input" value="${formatCurrency(divida.valor)}" required>
                <button type="button" class="remove-dynamic-entry-btn" onclick="this.parentElement.remove();">Remover</button>
            `;
            dividasList.appendChild(dividaDiv);
        });
        attachCurrencyInputListeners(dividasList); // Aplicar aos campos de moeda existentes
    }

    // Adicionar listeners para as NOVAS seções
    attachIRListeners();
    attachOrcamentoListeners("#secao-orcamento", getPessoasComRendaParaOrcamento);
    attachObjetivosListeners();
    attachCurrencyInputListeners(formContentEl); // Garante que todos os campos de moeda tenham listener
    updateDynamicFormSections(); // Chamada inicial para garantir que tudo está correto

    document.getElementById("clienteForm").addEventListener("submit", handleFormSubmit);
}

async function handleFormSubmit(event) {
    event.preventDefault();
    showMessage("success", "Salvando dados...");
    const form = event.target;
    const formId = form.form_id.value;
    const clienteId = form.cliente_id.value;

    // Coleta de dados das seções existentes (adapte do seu código original)
    const formDataToSave = {
        cliente_id: clienteId,
        dados_formulario: {
            nome_completo: form.nome_completo.value,
            email: form.email.value,
            renda_unica: form.renda_unica.value,
            pessoas_com_renda: [],
            // ... (outros campos existentes)
            tem_dividas: form.tem_dividas.value,
            dividas: [],
            // Adicionar coleta para plano de saúde e seguro de vida aqui
            plano_saude: {},
            seguro_vida: {},
        },
        status_preenchimento: "CONCLUIDO",
        data_preenchimento: new Date().toISOString(),
    };

    if (form.renda_unica.value === "nao") {
        document.querySelectorAll("#pessoas-list .dynamic-entry-item input[name=\"pessoa_nome\"]").forEach(input => {
            if (input.value.trim() !== "") {
                formDataToSave.dados_formulario.pessoas_com_renda.push({ nome: input.value.trim() });
            }
        });
    }
    if (form.tem_dividas.value === "sim") {
        document.querySelectorAll("#dividas-list .dynamic-entry-item").forEach(item => {
            const descricao = item.querySelector("input[name=\"divida_descricao\"]").value;
            const valor = parseCurrency(item.querySelector("input[name=\"divida_valor\"]").value);
            if (descricao.trim() !== "") {
                formDataToSave.dados_formulario.dividas.push({ descricao, valor });
            }
        });
    }
    
    // Coleta de dados do Plano de Saúde (do original)
    document.querySelectorAll(".plano-saude-entry").forEach(entry => {
        const personName = entry.dataset.personName;
        const personType = entry.dataset.personType;
        const radioName = entry.querySelector("input[type=\"radio\"]").name;
        const selectedValue = entry.querySelector(`input[name="${radioName}"]:checked`)?.value;
        if (selectedValue) {
            formDataToSave.dados_formulario.plano_saude[radioName] = {
                nome_ref: personName,
                tipo_pessoa: personType,
                possui: selectedValue
            };
        }
    });

    // Coleta de dados do Seguro de Vida (do original)
    document.querySelectorAll(".seguro-vida-entry").forEach(entry => {
        const personName = entry.dataset.personName;
        const personType = entry.dataset.personType;
        const radioName = entry.querySelector("input[type=\"radio\"]").name;
        const selectedValue = entry.querySelector(`input[name="${radioName}"]:checked`)?.value;
        if (selectedValue) {
            formDataToSave.dados_formulario.seguro_vida[radioName] = {
                nome_ref: personName,
                tipo_pessoa: personType,
                possui: selectedValue
            };
        }
    });

    // Coleta de dados das NOVAS seções
    formDataToSave.dados_formulario.imposto_renda = collectIRData();
    formDataToSave.dados_formulario.orcamento = collectOrcamentoData();
    formDataToSave.dados_formulario.objetivos = collectObjetivosData();

    try {
        const { error } = await supabase
            .from("formularios_clientes")
            .update(formDataToSave)
            .eq("id", formId);

        if (error) throw error;
        showMessage("success", "Formulário salvo com sucesso!");
        // Recarregar para mostrar o resumo
        setTimeout(() => loadForm(new URLSearchParams(window.location.search).get("token")), 1000);
    } catch (e) {
        console.error("Erro ao salvar formulário:", e);
        showMessage("error", `Erro ao salvar: ${e.message}`);
    }
}

function displayFilledForm(formData) {
    const dados = formData.dados_formulario || {};
    const nomePreenchedor = formData.clientes?.nome || "Preenchedor";
    const pessoasComRendaOriginal = [];
    if (dados.pessoas_com_renda) {
        dados.pessoas_com_renda.forEach(p => pessoasComRendaOriginal.push({ nome: p.nome }));
    }

    let filledHTML = `
        <h2>Dados Pessoais</h2>
        <p><strong>Nome Completo:</strong> ${sanitizeInput(formData.clientes.nome)}</p>
        <p><strong>E-mail:</strong> ${sanitizeInput(dados.email || formData.clientes.email || "N/A")}</p>
        <!-- ... (outros dados pessoais e seções existentes) ... -->
        <p><strong>Renda da casa composta apenas por você?</strong> ${dados.renda_unica === "sim" ? "Sim" : "Não"}</p>
    `;
    if (dados.renda_unica === "nao" && dados.pessoas_com_renda && dados.pessoas_com_renda.length > 0) {
        filledHTML += "<p><strong>Outras pessoas com renda:</strong></p><ul>";
        dados.pessoas_com_renda.forEach(p => {
            filledHTML += `<li>${sanitizeInput(p.nome)}</li>`;
        });
        filledHTML += "</ul>";
    }

    // Exibição das Dívidas (exemplo)
    filledHTML += `<h3>Dívidas</h3>`;
    filledHTML += `<p><strong>Possui dívidas?</strong> ${dados.tem_dividas === "sim" ? "Sim" : "Não"}</p>`;
    if (dados.tem_dividas === "sim" && dados.dividas && dados.dividas.length > 0) {
        filledHTML += "<ul>";
        dados.dividas.forEach(d => {
            filledHTML += `<li>${sanitizeInput(d.descricao)}: ${formatCurrency(d.valor)}</li>`;
        });
        filledHTML += "</ul>";
    }
    
    // Exibição do Plano de Saúde (do original)
    if (dados.plano_saude && Object.keys(dados.plano_saude).length > 0) {
        filledHTML += `<h3>Plano de Saúde</h3>`;
        Object.values(dados.plano_saude).forEach(plano => {
            filledHTML += `<p><strong>${capitalizeName(plano.nome_ref.split(" ")[0])} possui plano?</strong> ${sanitizeInput(plano.possui)}</p>`;
        });
    }

    // Exibição do Seguro de Vida (do original)
    if (dados.seguro_vida && Object.keys(dados.seguro_vida).length > 0) {
        filledHTML += `<h3>Seguro de Vida</h3>`;
        Object.values(dados.seguro_vida).forEach(seguro => {
            filledHTML += `<p><strong>${capitalizeName(seguro.nome_ref.split(" ")[0])} possui seguro?</strong> ${sanitizeInput(seguro.possui)}</p>`;
        });
    }

    // Exibição das NOVAS seções
    if (dados.imposto_renda) {
        filledHTML += displayIRDataHTML(dados.imposto_renda, nomePreenchedor, pessoasComRendaOriginal);
    }
    if (dados.orcamento) {
        filledHTML += displayOrcamentoDataHTML(dados.orcamento, nomePreenchedor, pessoasComRendaOriginal);
    }
    if (dados.objetivos) {
        filledHTML += displayObjetivosDataHTML(dados.objetivos);
    }

    formContentEl.innerHTML = filledHTML;
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    loadForm(token);
});

// Adicionar funções de atualização de labels do original ao escopo global se forem chamadas por onclick no HTML
// ou garantir que sejam chamadas após a renderização dos elementos relevantes.
// Exemplo: window.updateDynamicFormSections = updateDynamicFormSections;
// Se não forem onclick, as chamadas dentro de buildFormHTML e após adições dinâmicas devem ser suficientes.

console.log("Formulario-cliente.js MODIFICADO carregado.");


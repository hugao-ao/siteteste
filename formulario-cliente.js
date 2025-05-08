// formulario-cliente.js
import { supabase } from "./supabase.js";

// --- Elementos DOM ---
const formContentEl = document.getElementById("form-content");
const messageAreaEl = document.getElementById("message-area");
const formTitleEl = document.getElementById("form-title");

// --- Estado para preservar seleções ---
let planoSaudeSelections = {};
let seguroVidaSelections = {};

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
        labelTemPatrimonioLiquido.textContent = "Você possui patrimônio Dinheiro Guardado ou Investido?";
    } else if (temOutrasPessoasComRenda) {
        labelTemPatrimonioLiquido.textContent = "Vocês possuem patrimônio Dinheiro Guardado ou Investido?";
    } else {
        labelTemPatrimonioLiquido.textContent = "Você possui patrimônio Dinheiro Guardado ou Investido?";
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

function updateDynamicFormSections() {
    updatePerguntaDependentesLabel();
    updatePerguntaPatrimonioFisicoLabel();
    updatePerguntaPatrimonioLiquidoLabel();
    updatePerguntaDividasLabel(); // Nova linha
    renderPlanoSaudeQuestions();
    renderSeguroVidaQuestions();
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
                throw formError || new Error("Formulário não encontrado.");
            }
            return;
        }
        // MODIFICADO: Alterar título do formulário
        formTitleEl.textContent = "Formulário de Pré-Diagnóstico"; 

        if (formData.status === "pendente") {
            renderActualForm(formData);
        } else if (formData.status === "preenchido") {
            formContentEl.innerHTML = "<p>Este formulário já foi preenchido.</p>";
            showMessage("success", `Preenchido em: ${new Date(formData.data_preenchimento).toLocaleString("pt-BR")}`);
        } else {
            formContentEl.innerHTML = "<p>Status inválido do formulário.</p>";
            showMessage("error", `Status desconhecido: ${formData.status}`);
        }
    } catch (error) {
        console.error("Erro ao carregar formulário:", error);
        formContentEl.innerHTML = "<p>Ocorreu um erro ao carregar as informações.</p>";
        showMessage("error", `Erro: ${error.message}`);
    }
}

function renderActualForm(formData) {
    formContentEl.innerHTML = `
        <form id="client-response-form">
            <label for="nome_completo">Nome Completo (Seu nome):</label>
            <input type="text" id="nome_completo" name="nome_completo" required>

            <div class="radio-group">
                <label>Você é a única pessoa que possui renda na sua casa?</label><br>
                <input type="radio" id="renda_unica_sim" name="renda_unica" value="sim" required>
                <label for="renda_unica_sim">Sim</label>
                <input type="radio" id="renda_unica_nao" name="renda_unica" value="nao">
                <label for="renda_unica_nao">Não</label>
            </div>

            <div id="outras-pessoas-renda-container" style="display: none;">
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
                    <button type="button" id="add-patrimonio-liquido-btn" class="add-dynamic-entry-btn">+ Adicionar Dinheiro/Investimento</button> 
                </div>
            </div>

            <div id="dividas-section" style="margin-top: 2rem;">
                 <div class="radio-group">
                    <label id="label_tem_dividas">Você possui dívidas?</label><br>
                    <div class="radio-options-inline-patrimonio">
                        <input type="radio" id="tem_dividas_sim" name="tem_dividas" value="sim" required>
                        <label for="tem_dividas_sim">Sim</label>
                        <input type="radio" id="tem_dividas_nao" name="tem_dividas" value="nao">
                        <label for="tem_dividas_nao">Não</label>
                    </div>
                </div>
                <div id="dividas-list-container" style="display:none;">
                    <label>Dívidas:</label>
                    <div id="dividas-list"></div>
                    <button type="button" id="add-divida-btn" class="add-dynamic-entry-btn">+ Adicionar Dívida</button> 
                </div>
            </div>

            <button type="submit" id="submit-btn">Enviar Respostas</button>
        </form>
    `;

    attachFormEventListeners(formData.id);
    updateDynamicFormSections(); 
}

function addDividaEntry() {
    const dividasListEl = document.getElementById("dividas-list");
    if (!dividasListEl) return;

    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    entryDiv.innerHTML = `
        <div class="form-group-inline">
            <input type="text" name="divida_credor" placeholder="A quem deve" required>
            <input type="text" name="divida_saldo" placeholder="Saldo Devedor Atual" class="currency-input" required>
            <button type="button" class="remove-divida-btn remove-dynamic-entry-btn">-</button>
        </div>
    `;
    dividasListEl.appendChild(entryDiv);
    entryDiv.querySelector(".currency-input").addEventListener("input", formatInputAsCurrency);
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
            patrimonioListContainerEl.style.display = "block";
            updateDynamicFormSections();
        });
    }
    if (temPatrimonioNaoRadio) {
        temPatrimonioNaoRadio.addEventListener("change", () => {
            patrimonioListContainerEl.style.display = "none";
            patrimonioListEl.innerHTML = '';
            updateDynamicFormSections();
        });
    }
    if (addPatrimonioBtn) {
        addPatrimonioBtn.addEventListener("click", () => {
            const patrimonioIndex = patrimonioListEl.children.length;
            const newPatrimonioEntry = document.createElement("div");
            newPatrimonioEntry.classList.add("dynamic-entry-item"); 
            newPatrimonioEntry.innerHTML = `
                <input type="text" name="patrimonio_qual" placeholder="Qual patrimônio? (ex: Apto 50m2, Corolla 2020)" required>
                <input type="text" name="patrimonio_valor" placeholder="Quanto vale? (R$)" required class="currency-input">
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
                <button type="button" class="remove-dynamic-entry-btn">Remover</button>
            `;
            patrimonioListEl.appendChild(newPatrimonioEntry);

            const valorInput = newPatrimonioEntry.querySelector('input[name="patrimonio_valor"]');
            valorInput.addEventListener('input', (e) => {
                const rawValue = e.target.value.replace(/[^\d]/g, '');
                if (rawValue) {
                    const number = parseInt(rawValue, 10) / 100;
                    e.target.value = number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                } else {
                    e.target.value = '';
                }
            });
             valorInput.addEventListener('blur', (e) => { 
                 const rawValue = e.target.value.replace(/[^\d]/g, '');
                 if (rawValue) {
                    const number = parseInt(rawValue, 10) / 100;
                    e.target.value = number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                 } else {
                    e.target.value = '';
                 }
            });

            newPatrimonioEntry.querySelector(".remove-dynamic-entry-btn").addEventListener("click", () => { 
                newPatrimonioEntry.remove();
                updateDynamicFormSections();
            });
            updateDynamicFormSections();
        });
    }

    // Listeners para Patrimônio Líquido
    if (temPatrimonioLiquidoSimRadio) {
        temPatrimonioLiquidoSimRadio.addEventListener("change", () => {
            patrimonioLiquidoListContainerEl.style.display = "block";
            updateDynamicFormSections();
        });
    }
    if (temPatrimonioLiquidoNaoRadio) {
        temPatrimonioLiquidoNaoRadio.addEventListener("change", () => {
            patrimonioLiquidoListContainerEl.style.display = "none";
            patrimonioLiquidoListEl.innerHTML = '';
            updateDynamicFormSections();
        });
    }
    if (addPatrimonioLiquidoBtn) {
        addPatrimonioLiquidoBtn.addEventListener("click", () => {
            const newPatrimonioLiquidoEntry = document.createElement("div");
            newPatrimonioLiquidoEntry.classList.add("dynamic-entry-item"); 
            newPatrimonioLiquidoEntry.innerHTML = `
                <input type="text" name="patrimonio_liquido_onde" placeholder="Onde está guardado/investido?" required>
                <input type="text" name="patrimonio_liquido_valor" placeholder="Quanto tem guardado/investido? (R$)" required class="currency-input">
                <button type="button" class="remove-dynamic-entry-btn">Remover</button>
            `;
            patrimonioLiquidoListEl.appendChild(newPatrimonioLiquidoEntry);

            const valorLiquidoInput = newPatrimonioLiquidoEntry.querySelector('input[name="patrimonio_liquido_valor"]');
            valorLiquidoInput.addEventListener('input', (e) => {
                const rawValue = e.target.value.replace(/[^\d]/g, '');
                if (rawValue) {
                    const number = parseInt(rawValue, 10) / 100;
                    e.target.value = number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                } else {
                    e.target.value = '';
                }
            });
            valorLiquidoInput.addEventListener('blur', (e) => { 
                 const rawValue = e.target.value.replace(/[^\d]/g, '');
                 if (rawValue) {
                    const number = parseInt(rawValue, 10) / 100;
                    e.target.value = number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                 } else {
                    e.target.value = '';
                 }
            });

            newPatrimonioLiquidoEntry.querySelector(".remove-dynamic-entry-btn").addEventListener("click", () => { 
                newPatrimonioLiquidoEntry.remove();
                updateDynamicFormSections();
            });
            updateDynamicFormSections();
        });
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
                    nome_preenchido: sanitizeInput(formDataObject.get("nome_completo")),
                    renda_unica: formDataObject.get("renda_unica"),
                    outras_pessoas_renda: [],
                    tem_dependentes: formDataObject.get("tem_dependentes"),
                    dependentes: [],
                    informacoes_plano_saude: [],
                    informacoes_seguro_vida: [],
                    possui_patrimonio_fisico: formDataObject.get("tem_patrimonio"),
                    patrimonios_fisicos: [],
                    possui_patrimonio_liquido: formDataObject.get("tem_patrimonio_liquido"),
                    patrimonios_liquidos: [],
                    possui_dividas: formDataObject.get("tem_dividas"), // Nova linha para dívidas
                    dividas_lista: [] // Nova linha para dívidas
                };

                if (dadosFormulario.renda_unica === "nao") {
                    document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach(entry => { 
                        const nome = entry.querySelector('input[name="pessoa_nome"]')?.value;
                        const autorizacao = entry.querySelector('select[name="pessoa_autorizacao"]')?.value;
                        if (nome) {
                            dadosFormulario.outras_pessoas_renda.push({
                                nome: sanitizeInput(nome),
                                autorizacao_financeira: autorizacao
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
                        dadosFormulario.informacoes_plano_saude.push({
                            nome_pessoa: sanitizeInput(personName),
                            tipo_pessoa: personType,
                            possui_plano: selectedRadio.value
                        });
                    }
                });

                document.querySelectorAll("#seguro-vida-section-content .seguro-vida-entry").forEach(entry => {
                    const personName = entry.dataset.personName;
                    const personType = entry.dataset.personType;
                    const radioName = entry.querySelector('input[type="radio"]')?.name;
                    const selectedRadio = entry.querySelector(`input[name="${radioName}"]:checked`);
                    if (selectedRadio) {
                        dadosFormulario.informacoes_seguro_vida.push({
                            nome_pessoa: sanitizeInput(personName),
                            tipo_pessoa: personType,
                            possui_seguro: selectedRadio.value
                        });
                    }
                });

                if (dadosFormulario.possui_patrimonio_fisico === "sim") {
                    document.querySelectorAll("#patrimonio-list .dynamic-entry-item").forEach((entry, index) => { 
                        const qual = entry.querySelector('input[name="patrimonio_qual"]')?.value;
                        const valorRaw = entry.querySelector('input[name="patrimonio_valor"]')?.value;
                        let valorNumerico = null;
                        if (valorRaw) {
                            const cleanedValor = String(valorRaw).replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.');
                            valorNumerico = parseFloat(cleanedValor);
                        }
                        const seguro = entry.querySelector(`input[name="patrimonio_seguro_${index}"]:checked`)?.value;
                        const quitado = entry.querySelector(`input[name="patrimonio_quitado_${index}"]:checked`)?.value;
                        if (qual) {
                            dadosFormulario.patrimonios_fisicos.push({
                                descricao: sanitizeInput(qual),
                                valor_estimado: valorNumerico,
                                possui_seguro: seguro,
                                esta_quitado: quitado
                            });
                        }
                    });
                }

                // Coleta de dados do Patrimônio Líquido
                if (dadosFormulario.possui_patrimonio_liquido === "sim") {
                    document.querySelectorAll("#patrimonio-liquido-list .dynamic-entry-item").forEach(entry => {
                        const onde = entry.querySelector('input[name="patrimonio_liquido_onde"]')?.value;
                        const valorRaw = entry.querySelector('input[name="patrimonio_liquido_valor"]')?.value;
                        let valorNumerico = null;
                        if (valorRaw) {
                            const cleanedValor = String(valorRaw).replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.');
                            valorNumerico = parseFloat(cleanedValor);
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
                if (dadosFormulario.possui_dividas === "sim") {
                    document.querySelectorAll("#dividas-list .dynamic-entry-item").forEach(entry => {
                        const credor = entry.querySelector('input[name="divida_credor"]')?.value;
                        const saldoRaw = entry.querySelector('input[name="divida_saldo"]')?.value;
                        let saldoNumerico = null;
                        if (saldoRaw) {
                            saldoNumerico = parseCurrency(saldoRaw); // Usando a função parseCurrency existente
                        }
                        if (credor) { // Adicionar apenas se o credor for preenchido
                            dadosFormulario.dividas_lista.push({
                                credor: sanitizeInput(credor),
                                saldo: saldoNumerico
                            });
                        }
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

                formContentEl.innerHTML = "<p>Obrigado por preencher o formulário!</p>";
                showMessage("success", "Suas respostas foram enviadas com sucesso.");

            } catch (error) {
                console.error("Erro ao enviar formulário:", error);
                showMessage("error", `Erro ao enviar: ${error.message}`);
                submitButton.disabled = false;
                submitButton.textContent = "Enviar Respostas";
            }
        });
    }
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    loadForm(token);
});


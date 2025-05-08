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
    let cleanValue = String(value).replace(/[^\d,.-]/g, '');
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

const parseCurrency = (value) => {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const cleanedValue = String(value).replace(/\./g, '').replace(',', '.');
    const number = parseFloat(cleanedValue);
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

function savePlanoSaudeSelections() {
    const container = document.getElementById("plano-saude-section-content");
    if (!container) return;
    planoSaudeSelections = {}; 
    container.querySelectorAll(".plano-saude-entry").forEach(entry => {
        const nameAttribute = entry.querySelector('input[type="radio"]')?.name;
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
        const nameAttribute = entry.querySelector('input[type="radio"]')?.name;
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

            <div id="dependentes-container" style="display: none;">
                <label>Dependentes:</label>
                <div id="dependentes-list"></div>
                <button type="button" id="add-dependent-btn" class="add-dynamic-entry-btn">+ Adicionar Dependente</button>
            </div>

            <!-- NOVA SEÇÃO: Dinheiro Guardado ou Investido -->
            <div class="form-section" style="margin-top: 2rem;">
                <h2>Dinheiro Guardado ou Investido</h2>
                <div class="radio-group">
                    <label>Você tem algum dinheiro guardado ou investido?</label><br>
                    <input type="radio" id="tem_patrimonio_investido_sim" name="tem_patrimonio_investido" value="sim" required>
                    <label for="tem_patrimonio_investido_sim">Sim</label>
                    <input type="radio" id="tem_patrimonio_investido_nao" name="tem_patrimonio_investido" value="nao">
                    <label for="tem_patrimonio_investido_nao">Não</label>
                </div>
                <div id="patrimonio-investido-list-container" style="display: none; margin-top: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem;">Onde e quanto você tem guardado/investido?</label>
                    <div id="patrimonio-investido-list"></div>
                    <button type="button" id="add-patrimonio-investido-btn" class="add-dynamic-entry-btn" style="margin-top: 0.5rem;">+ Adicionar Item</button>
                </div>
            </div>

            <div class="radio-group" style="margin-top: 2rem;">
                <label id="label_tem_patrimonio_fisico">Você possui patrimônio físico (imóvel, automóvel, jóias, outros...)?</label><br>
                <input type="radio" id="tem_patrimonio_fisico_sim" name="tem_patrimonio_fisico" value="sim" required>
                <label for="tem_patrimonio_fisico_sim">Sim</label>
                <input type="radio" id="tem_patrimonio_fisico_nao" name="tem_patrimonio_fisico" value="nao">
                <label for="tem_patrimonio_fisico_nao">Não</label>
            </div>

            <div id="patrimonio-fisico-container" style="display: none;">
                <label>Patrimônio Físico:</label>
                <div id="patrimonio-list"></div>
                <button type="button" id="add-patrimonio-btn" class="add-dynamic-entry-btn">+ Adicionar Patrimônio</button>
            </div>

            <!-- NOVA SEÇÃO: Dívidas -->
            <div class="form-section" style="margin-top: 2rem;">
                <h2>Dívidas</h2>
                <div class="radio-group">
                    <label>Você possui alguma dívida atualmente?</label><br>
                    <input type="radio" id="tem_dividas_sim" name="tem_dividas" value="sim" required>
                    <label for="tem_dividas_sim">Sim</label>
                    <input type="radio" id="tem_dividas_nao" name="tem_dividas" value="nao">
                    <label for="tem_dividas_nao">Não</label>
                </div>
                <div id="dividas-list-container" style="display: none; margin-top: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem;">Para quem e quanto você deve?</label>
                    <div id="dividas-list"></div>
                    <button type="button" id="add-divida-btn" class="add-dynamic-entry-btn" style="margin-top: 0.5rem;">+ Adicionar Dívida</button>
                </div>
            </div>

            <div id="plano-saude-section-title" style="margin-top: 2rem; font-weight: bold; display: none;">Plano de Saúde:</div>
            <div id="plano-saude-section-content" style="margin-bottom: 1rem;"></div>

            <div id="seguro-vida-section-title" style="margin-top: 2rem; font-weight: bold; display: none;">Seguro de Vida:</div>
            <div id="seguro-vida-section-content" style="margin-bottom: 1rem;"></div>

            <button type="submit" id="submit-btn" style="margin-top: 2rem;">Enviar Respostas</button>
        </form>
    `;

    const nomeCompletoInput = document.getElementById("nome_completo");
    nomeCompletoInput.addEventListener("input", updateDynamicFormSections);
    nomeCompletoInput.addEventListener("blur", () => {
        nomeCompletoInput.value = capitalizeName(nomeCompletoInput.value);
        updateDynamicFormSections();
    });

    const rendaUnicaSimRadio = document.getElementById("renda_unica_sim");
    const rendaUnicaNaoRadio = document.getElementById("renda_unica_nao");
    const outrasPessoasContainer = document.getElementById("outras-pessoas-renda-container");
    const pessoasList = document.getElementById("pessoas-list");

    rendaUnicaSimRadio.addEventListener("change", () => {
        outrasPessoasContainer.style.display = "none";
        pessoasList.innerHTML = "";
        updateDynamicFormSections();
    });
    rendaUnicaNaoRadio.addEventListener("change", () => {
        outrasPessoasContainer.style.display = "block";
        if (pessoasList.children.length === 0) addPersonEntry();
        updateDynamicFormSections();
    });

    document.getElementById("add-person-btn").addEventListener("click", addPersonEntry);

    function addPersonEntry() {
        const entryDiv = document.createElement("div");
        entryDiv.classList.add("dynamic-entry-item");
        entryDiv.innerHTML = `
            <input type="text" name="pessoa_nome" placeholder="Nome da pessoa" required>
            <select name="pessoa_autorizacao" required>
                <option value="" disabled selected>Autoriza compartilhar dados?</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
            </select>
            <button type="button" class="remove-dynamic-entry-btn">Remover</button>
        `;
        pessoasList.appendChild(entryDiv);
        entryDiv.querySelector(".remove-dynamic-entry-btn").addEventListener("click", () => {
            entryDiv.remove();
            updateDynamicFormSections();
        });
        entryDiv.querySelector('input[name="pessoa_nome"]').addEventListener("blur", (e) => {
            e.target.value = capitalizeName(e.target.value);
            updateDynamicFormSections();
        });
        entryDiv.querySelector('input[name="pessoa_nome"]').addEventListener("input", updateDynamicFormSections);
        entryDiv.querySelector('select[name="pessoa_autorizacao"]').addEventListener("change", updateDynamicFormSections);
    }

    const temDependentesSimRadio = document.getElementById("tem_dependentes_sim");
    const temDependentesNaoRadio = document.getElementById("tem_dependentes_nao");
    const dependentesContainer = document.getElementById("dependentes-container");
    const dependentesList = document.getElementById("dependentes-list");

    temDependentesSimRadio.addEventListener("change", () => {
        dependentesContainer.style.display = "block";
        if (dependentesList.children.length === 0) addDependentEntry();
        updateDynamicFormSections();
    });
    temDependentesNaoRadio.addEventListener("change", () => {
        dependentesContainer.style.display = "none";
        dependentesList.innerHTML = "";
        updateDynamicFormSections();
    });

    document.getElementById("add-dependent-btn").addEventListener("click", addDependentEntry);

    function addDependentEntry() {
        const entryDiv = document.createElement("div");
        entryDiv.classList.add("dynamic-entry-item");
        entryDiv.innerHTML = `
            <input type="text" name="dep_nome" placeholder="Nome do dependente" required>
            <input type="number" name="dep_idade" placeholder="Idade" min="0" required>
            <input type="text" name="dep_relacao" placeholder="Relação (Ex: Filho, Pet)" required>
            <button type="button" class="remove-dynamic-entry-btn">Remover</button>
        `;
        dependentesList.appendChild(entryDiv);
        entryDiv.querySelector(".remove-dynamic-entry-btn").addEventListener("click", () => {
            entryDiv.remove();
            updateDynamicFormSections();
        });
        entryDiv.querySelector('input[name="dep_nome"]').addEventListener("blur", (e) => {
            e.target.value = capitalizeName(e.target.value);
            updateDynamicFormSections();
        });
         entryDiv.querySelector('input[name="dep_nome"]').addEventListener("input", updateDynamicFormSections);
    }

    // Lógica para Dinheiro Guardado/Investido
    const temPatrimonioInvestidoSim = document.getElementById("tem_patrimonio_investido_sim");
    const temPatrimonioInvestidoNao = document.getElementById("tem_patrimonio_investido_nao");
    const patrimonioInvestidoListContainer = document.getElementById("patrimonio-investido-list-container");
    const addPatrimonioInvestidoBtn = document.getElementById("add-patrimonio-investido-btn");
    const patrimonioInvestidoList = document.getElementById("patrimonio-investido-list");

    if (temPatrimonioInvestidoSim && temPatrimonioInvestidoNao && patrimonioInvestidoListContainer) {
        temPatrimonioInvestidoSim.addEventListener("change", () => {
            patrimonioInvestidoListContainer.style.display = temPatrimonioInvestidoSim.checked ? "block" : "none";
            if (temPatrimonioInvestidoSim.checked && patrimonioInvestidoList.children.length === 0) {
                addPatrimonioInvestidoEntry();
            }
        });
        temPatrimonioInvestidoNao.addEventListener("change", () => {
            patrimonioInvestidoListContainer.style.display = "none";
            patrimonioInvestidoList.innerHTML = "";
        });
    }
    if (addPatrimonioInvestidoBtn) {
        addPatrimonioInvestidoBtn.addEventListener("click", addPatrimonioInvestidoEntry);
    }

    function addPatrimonioInvestidoEntry() {
        const entryDiv = document.createElement("div");
        entryDiv.classList.add("dynamic-entry-item");
        entryDiv.innerHTML = `
            <input type="text" name="patrimonio_investido_onde" placeholder="Onde está guardado/investido?" required>
            <input type="text" name="patrimonio_investido_valor" placeholder="Quanto (R$)?" inputmode="decimal" required class="currency-input">
            <button type="button" class="remove-dynamic-entry-btn">Remover</button>
        `;
        patrimonioInvestidoList.appendChild(entryDiv);
        entryDiv.querySelector(".remove-dynamic-entry-btn").addEventListener("click", () => entryDiv.remove());
        const valorInput = entryDiv.querySelector('input[name="patrimonio_investido_valor"]');
        valorInput.addEventListener("input", (e) => {
            e.target.value = formatCurrency(e.target.value.replace(/[^\d,.-]/g, ''));
        });
        valorInput.addEventListener("blur", (e) => {
            if (e.target.value) e.target.value = formatCurrency(parseCurrency(e.target.value));
        });
    }

    const temPatrimonioFisicoSimRadio = document.getElementById("tem_patrimonio_fisico_sim");
    const temPatrimonioFisicoNaoRadio = document.getElementById("tem_patrimonio_fisico_nao");
    const patrimonioFisicoContainer = document.getElementById("patrimonio-fisico-container");
    const patrimonioList = document.getElementById("patrimonio-list");

    temPatrimonioFisicoSimRadio.addEventListener("change", () => {
        patrimonioFisicoContainer.style.display = "block";
        if (patrimonioList.children.length === 0) addPatrimonioEntry();
        updateDynamicFormSections(); 
    });
    temPatrimonioFisicoNaoRadio.addEventListener("change", () => {
        patrimonioFisicoContainer.style.display = "none";
        patrimonioList.innerHTML = "";
        updateDynamicFormSections(); 
    });

    document.getElementById("add-patrimonio-btn").addEventListener("click", addPatrimonioEntry);

    function addPatrimonioEntry() {
        const entryDiv = document.createElement("div");
        entryDiv.classList.add("dynamic-entry-item");
        entryDiv.innerHTML = `
            <input type="text" name="patrimonio_descricao" placeholder="Descrição do patrimônio" required>
            <input type="text" name="patrimonio_valor" placeholder="Valor Estimado (R$)" inputmode="decimal" required class="currency-input">
            <button type="button" class="remove-dynamic-entry-btn">Remover</button>
        `;
        patrimonioList.appendChild(entryDiv);
        entryDiv.querySelector(".remove-dynamic-entry-btn").addEventListener("click", () => {
            entryDiv.remove();
            updateDynamicFormSections(); 
        });
        const valorInput = entryDiv.querySelector('input[name="patrimonio_valor"]');
        valorInput.addEventListener("input", (e) => {
            e.target.value = formatCurrency(e.target.value.replace(/[^\d,.-]/g, ''));
        });
        valorInput.addEventListener("blur", (e) => {
            if (e.target.value) e.target.value = formatCurrency(parseCurrency(e.target.value));
        });
    }

    // Lógica para Dívidas
    const temDividasSim = document.getElementById("tem_dividas_sim");
    const temDividasNao = document.getElementById("tem_dividas_nao");
    const dividasListContainer = document.getElementById("dividas-list-container");
    const addDividaBtn = document.getElementById("add-divida-btn");
    const dividasList = document.getElementById("dividas-list");

    if (temDividasSim && temDividasNao && dividasListContainer) {
        temDividasSim.addEventListener("change", () => {
            dividasListContainer.style.display = temDividasSim.checked ? "block" : "none";
            if (temDividasSim.checked && dividasList.children.length === 0) {
                addDividaEntry();
            }
        });
        temDividasNao.addEventListener("change", () => {
            dividasListContainer.style.display = "none";
            dividasList.innerHTML = "";
        });
    }
    if (addDividaBtn) {
        addDividaBtn.addEventListener("click", addDividaEntry);
    }

    function addDividaEntry() {
        const entryDiv = document.createElement("div");
        entryDiv.classList.add("dynamic-entry-item");
        entryDiv.innerHTML = `
            <input type="text" name="divida_para_quem" placeholder="A quem você deve?" required>
            <input type="text" name="divida_valor" placeholder="Quanto (R$)?" inputmode="decimal" required class="currency-input">
            <button type="button" class="remove-dynamic-entry-btn">Remover</button>
        `;
        dividasList.appendChild(entryDiv);
        entryDiv.querySelector(".remove-dynamic-entry-btn").addEventListener("click", () => entryDiv.remove());
        const valorInput = entryDiv.querySelector('input[name="divida_valor"]');
        valorInput.addEventListener("input", (e) => {
            e.target.value = formatCurrency(e.target.value.replace(/[^\d,.-]/g, ''));
        });
        valorInput.addEventListener("blur", (e) => {
            if (e.target.value) e.target.value = formatCurrency(parseCurrency(e.target.value));
        });
    }

    updateDynamicFormSections();
    document.getElementById("client-response-form").addEventListener("submit", (event) => handleSubmit(event, formData.token_unico));
}

async function handleSubmit(event, token) {
    event.preventDefault();
    const submitBtn = document.getElementById("submit-btn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando...";

    const form = event.target;
    const dadosFormulario = {
        nome_completo: sanitizeInput(form.nome_completo.value),
        renda_unica: form.renda_unica.value,
        outras_pessoas_renda: [],
        tem_dependentes: form.tem_dependentes.value,
        dependentes: [],
        tem_patrimonio_investido_resposta: form.tem_patrimonio_investido.value,
        patrimonio_investido: [],
        tem_patrimonio_fisico: form.tem_patrimonio_fisico.value,
        patrimonio_fisico: [],
        tem_dividas_resposta: form.tem_dividas.value,
        dividas: [],
        informacoes_plano_saude: [],
        informacoes_seguro_vida: []
    };

    if (dadosFormulario.renda_unica === "nao") {
        document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach(entry => {
            const nome = entry.querySelector('input[name="pessoa_nome"]')?.value;
            const autorizacao = entry.querySelector('select[name="pessoa_autorizacao"]')?.value;
            if (nome) {
                dadosFormulario.outras_pessoas_renda.push({
                    nome: sanitizeInput(nome),
                    autorizacao_compartilhamento: autorizacao
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
                    idade: idade ? parseInt(idade, 10) : null,
                    relacao: sanitizeInput(relacao)
                });
            }
        });
    }

    if (dadosFormulario.tem_patrimonio_investido_resposta === "sim") {
        document.querySelectorAll("#patrimonio-investido-list .dynamic-entry-item").forEach(entry => {
            const onde = entry.querySelector('input[name="patrimonio_investido_onde"]')?.value;
            const valorRaw = entry.querySelector('input[name="patrimonio_investido_valor"]')?.value;
            if (onde && valorRaw) {
                dadosFormulario.patrimonio_investido.push({
                    onde_investido: sanitizeInput(onde),
                    quanto_investido: parseCurrency(valorRaw)
                });
            }
        });
    }

    if (dadosFormulario.tem_patrimonio_fisico === "sim") {
        document.querySelectorAll("#patrimonio-list .dynamic-entry-item").forEach(entry => {
            const descricao = entry.querySelector('input[name="patrimonio_descricao"]')?.value;
            const valorRaw = entry.querySelector('input[name="patrimonio_valor"]')?.value;
            if (descricao && valorRaw) {
                dadosFormulario.patrimonio_fisico.push({
                    descricao: sanitizeInput(descricao),
                    valor_estimado: parseCurrency(valorRaw)
                });
            }
        });
    }

    if (dadosFormulario.tem_dividas_resposta === "sim") {
        document.querySelectorAll("#dividas-list .dynamic-entry-item").forEach(entry => {
            const paraQuem = entry.querySelector('input[name="divida_para_quem"]')?.value;
            const valorRaw = entry.querySelector('input[name="divida_valor"]')?.value;
            if (paraQuem && valorRaw) {
                dadosFormulario.dividas.push({
                    para_quem: sanitizeInput(paraQuem),
                    quanto_deve: parseCurrency(valorRaw)
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

    try {
        const { error: updateError } = await supabase
            .from("formularios_clientes")
            .update({
                dados_formulario: dadosFormulario,
                status: "preenchido",
                data_preenchimento: new Date().toISOString(),
            })
            .eq("token_unico", token);

        if (updateError) throw updateError;

        formContentEl.innerHTML = "<p>Suas respostas foram enviadas com sucesso!</p>";
        showMessage("success", "Formulário enviado.");

    } catch (error) {
        console.error("Erro ao enviar respostas:", error);
        showMessage("error", `Erro ao enviar: ${error.message}`);
        submitBtn.disabled = false;
        submitBtn.textContent = "Enviar Respostas";
    }
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    loadForm(token);
});


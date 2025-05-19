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
    container.querySelectorAll(".imposto-renda-entry").forEach(entry => {
        const nameAttribute = entry.querySelector('input[type="radio"]').name; 
        const selectedRadio = entry.querySelector(`input[name="${nameAttribute}"]:checked`);
        if (selectedRadio) {
            impostoRendaSelections[nameAttribute] = selectedRadio.value;
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
            <div class="radio-options-inline" style="display: flex; align-items: center;">
                <span style="margin-right: 20px; display: flex; align-items: center;">
                    <input type="radio" id="${personId}_sim" name="${personId}" value="sim" required style="margin-right: 5px;">
                    <label for="${personId}_sim">Sim</label>
                </span>
                <span style="margin-right: 20px; display: flex; align-items: center;">
                    <input type="radio" id="${personId}_nao" name="${personId}" value="nao" style="margin-right: 5px;">
                    <label for="${personId}_nao">Não</label>
                </span>
            </div>
        `;
        entryDiv.dataset.personName = preenchedor.nome;
        entryDiv.dataset.personType = preenchedor.tipo;
        container.appendChild(entryDiv);
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
    updatePerguntaDividasLabel();
    renderPlanoSaudeQuestions();
    renderSeguroVidaQuestions();
    renderImpostoRendaQuestions(); // Chamada para renderizar perguntas de imposto de renda
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
            
            <!-- Nova seção de Imposto de Renda (movida para depois das dívidas) -->
            <div id="imposto-renda-section" style="margin-top: 2rem;">
                <h3 id="imposto-renda-section-title" style="display: none;">Informações sobre Imposto de Renda:</h3>
                <div id="imposto-renda-section-content"></div>
            </div>

            <div class="form-actions">
                <button type="submit" id="submit-btn" class="submit-button">Enviar Respostas</button>
            </div>
        </form>
    `;

    attachFormEventListeners(formData.id);
    updateDynamicFormSections(); 
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

function addPatrimonioLiquidoEntry() {
    const patrimonioLiquidoListEl = document.getElementById("patrimonio-liquido-list");
    if (!patrimonioLiquidoListEl) {
        console.error("Elemento patrimonio-liquido-list não encontrado para adicionar entrada de patrimônio líquido.");
        return;
    }

    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item"); 
    entryDiv.innerHTML = `
        <input type="text" name="patrimonio_liquido_tipo" placeholder="Tipo (Ex: Poupança, CDB, Ações)" required>
        <input type="text" name="patrimonio_liquido_valor" placeholder="Valor (R$)" required class="currency-input">
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

function addPatrimonioEntry() {
    const patrimonioListEl = document.getElementById("patrimonio-list");
    if (!patrimonioListEl) {
        console.error("Elemento patrimonio-list não encontrado para adicionar entrada de patrimônio.");
        return;
    }

    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item"); 
    entryDiv.innerHTML = `
        <input type="text" name="patrimonio_tipo" placeholder="Tipo (Ex: Casa, Carro, Jóias)" required>
        <input type="text" name="patrimonio_valor" placeholder="Valor Estimado (R$)" required class="currency-input">
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

function addDependenteEntry() {
    const dependentesListEl = document.getElementById("dependentes-list");
    if (!dependentesListEl) {
        console.error("Elemento dependentes-list não encontrado para adicionar entrada de dependente.");
        return;
    }

    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item"); 
    entryDiv.innerHTML = `
        <input type="text" name="dep_nome" placeholder="Nome do Dependente" required>
        <select name="dep_tipo" required>
            <option value="">Selecione o Tipo</option>
            <option value="filho">Filho(a)</option>
            <option value="pet">Pet</option>
            <option value="parente">Outro Parente</option>
        </select>
        <button type="button" class="remove-dynamic-entry-btn remove-dependente-btn">Remover</button>
    `;
    dependentesListEl.appendChild(entryDiv);
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
        <input type="text" name="pessoa_nome" placeholder="Nome da Pessoa" required>
        <button type="button" class="remove-dynamic-entry-btn remove-person-btn">Remover</button>
    `;
    pessoasListEl.appendChild(entryDiv);
    updateDynamicFormSections();
}

function attachFormEventListeners(formId) {
    const form = document.getElementById("client-response-form");
    const nomeCompletoInput = document.getElementById("nome_completo");
    const rendaUnicaSimRadio = document.getElementById("renda_unica_sim");
    const rendaUnicaNaoRadio = document.getElementById("renda_unica_nao");
    const outrasPessoasRendaContainer = document.getElementById("outras-pessoas-renda-container");
    const addPersonBtn = document.getElementById("add-person-btn");
    const temDependentesSimRadio = document.getElementById("tem_dependentes_sim");
    const temDependentesNaoRadio = document.getElementById("tem_dependentes_nao");
    const dependentesContainer = document.getElementById("dependentes-container");
    const addDependenteBtn = document.getElementById("add-dependente-btn");
    const temPatrimonioSimRadio = document.getElementById("tem_patrimonio_sim");
    const temPatrimonioNaoRadio = document.getElementById("tem_patrimonio_nao");
    const patrimonioListContainer = document.getElementById("patrimonio-list-container");
    const addPatrimonioBtn = document.getElementById("add-patrimonio-btn");
    const temPatrimonioLiquidoSimRadio = document.getElementById("tem_patrimonio_liquido_sim");
    const temPatrimonioLiquidoNaoRadio = document.getElementById("tem_patrimonio_liquido_nao");
    const patrimonioLiquidoListContainer = document.getElementById("patrimonio-liquido-list-container");
    const addPatrimonioLiquidoBtn = document.getElementById("add-patrimonio-liquido-btn");
    const temDividasSimRadio = document.getElementById("tem_dividas_sim");
    const temDividasNaoRadio = document.getElementById("tem_dividas_nao");
    const dividasListContainer = document.getElementById("dividas-list-container");
    const addDividaBtn = document.getElementById("add-divida-btn");

    if (nomeCompletoInput) {
        nomeCompletoInput.addEventListener("input", updateDynamicFormSections);
    }

    if (rendaUnicaSimRadio && rendaUnicaNaoRadio && outrasPessoasRendaContainer) {
        rendaUnicaSimRadio.addEventListener("change", () => {
            outrasPessoasRendaContainer.style.display = "none";
            updateDynamicFormSections();
        });
        rendaUnicaNaoRadio.addEventListener("change", () => {
            outrasPessoasRendaContainer.style.display = "block";
            if (document.querySelectorAll("#pessoas-list .dynamic-entry-item").length === 0) {
                addPersonEntry();
            }
            updateDynamicFormSections();
        });
    }

    if (addPersonBtn) {
        addPersonBtn.addEventListener("click", () => {
            addPersonEntry();
            updateDynamicFormSections();
        });
    }

    if (temDependentesSimRadio && temDependentesNaoRadio && dependentesContainer) {
        temDependentesSimRadio.addEventListener("change", () => {
            dependentesContainer.style.display = "block";
            if (document.querySelectorAll("#dependentes-list .dynamic-entry-item").length === 0) {
                addDependenteEntry();
            }
            updateDynamicFormSections();
        });
        temDependentesNaoRadio.addEventListener("change", () => {
            dependentesContainer.style.display = "none";
            updateDynamicFormSections();
        });
    }

    if (addDependenteBtn) {
        addDependenteBtn.addEventListener("click", () => {
            addDependenteEntry();
            updateDynamicFormSections();
        });
    }

    if (temPatrimonioSimRadio && temPatrimonioNaoRadio && patrimonioListContainer) {
        temPatrimonioSimRadio.addEventListener("change", () => {
            patrimonioListContainer.style.display = "block";
            if (document.querySelectorAll("#patrimonio-list .dynamic-entry-item").length === 0) {
                addPatrimonioEntry();
            }
        });
        temPatrimonioNaoRadio.addEventListener("change", () => {
            patrimonioListContainer.style.display = "none";
        });
    }

    if (addPatrimonioBtn) {
        addPatrimonioBtn.addEventListener("click", addPatrimonioEntry);
    }

    if (temPatrimonioLiquidoSimRadio && temPatrimonioLiquidoNaoRadio && patrimonioLiquidoListContainer) {
        temPatrimonioLiquidoSimRadio.addEventListener("change", () => {
            patrimonioLiquidoListContainer.style.display = "block";
            if (document.querySelectorAll("#patrimonio-liquido-list .dynamic-entry-item").length === 0) {
                addPatrimonioLiquidoEntry();
            }
        });
        temPatrimonioLiquidoNaoRadio.addEventListener("change", () => {
            patrimonioLiquidoListContainer.style.display = "none";
        });
    }

    if (addPatrimonioLiquidoBtn) {
        addPatrimonioLiquidoBtn.addEventListener("click", addPatrimonioLiquidoEntry);
    }

    if (temDividasSimRadio && temDividasNaoRadio && dividasListContainer) {
        temDividasSimRadio.addEventListener("change", () => {
            dividasListContainer.style.display = "block";
            if (document.querySelectorAll("#dividas-list .dynamic-entry-item").length === 0) {
                addDividaEntry();
            }
        });
        temDividasNaoRadio.addEventListener("change", () => {
            dividasListContainer.style.display = "none";
        });
    }

    if (addDividaBtn) {
        addDividaBtn.addEventListener("click", addDividaEntry);
    }

    document.addEventListener("click", (e) => {
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
        }
    });

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            // Validação básica
            const nomeCompleto = document.getElementById("nome_completo").value.trim();
            if (!nomeCompleto) {
                showMessage("error", "Por favor, informe seu nome completo.");
                return;
            }

            // Coleta de dados do formulário
            const formData = {
                nome_completo: nomeCompleto,
                renda_unica: document.querySelector('input[name="renda_unica"]:checked').value,
                tem_dependentes: document.querySelector('input[name="tem_dependentes"]:checked').value,
                tem_patrimonio: document.querySelector('input[name="tem_patrimonio"]:checked').value,
                tem_patrimonio_liquido: document.querySelector('input[name="tem_patrimonio_liquido"]:checked').value,
                tem_dividas: document.querySelector('input[name="tem_dividas"]:checked').value,
                pessoas_com_renda: [],
                dependentes: [],
                patrimonios: [],
                patrimonios_liquidos: [],
                dividas: [],
                planos_saude: {},
                seguros_vida: {},
                impostos_renda: {} // Campo para armazenar respostas sobre imposto de renda
            };

            // Coleta de pessoas com renda
            if (formData.renda_unica === "nao") {
                document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach(entry => {
                    const nome = entry.querySelector('input[name="pessoa_nome"]').value.trim();
                    if (nome) {
                        formData.pessoas_com_renda.push({ nome });
                    }
                });
            }

            // Coleta de dependentes
            if (formData.tem_dependentes === "sim") {
                document.querySelectorAll("#dependentes-list .dynamic-entry-item").forEach(entry => {
                    const nome = entry.querySelector('input[name="dep_nome"]').value.trim();
                    const tipo = entry.querySelector('select[name="dep_tipo"]').value;
                    if (nome && tipo) {
                        formData.dependentes.push({ nome, tipo });
                    }
                });
            }

            // Coleta de patrimônios físicos
            if (formData.tem_patrimonio === "sim") {
                document.querySelectorAll("#patrimonio-list .dynamic-entry-item").forEach(entry => {
                    const tipo = entry.querySelector('input[name="patrimonio_tipo"]').value.trim();
                    const valorInput = entry.querySelector('input[name="patrimonio_valor"]').value;
                    const valor = parseCurrency(valorInput);
                    if (tipo) {
                        formData.patrimonios.push({ tipo, valor });
                    }
                });
            }

            // Coleta de patrimônios líquidos
            if (formData.tem_patrimonio_liquido === "sim") {
                document.querySelectorAll("#patrimonio-liquido-list .dynamic-entry-item").forEach(entry => {
                    const tipo = entry.querySelector('input[name="patrimonio_liquido_tipo"]').value.trim();
                    const valorInput = entry.querySelector('input[name="patrimonio_liquido_valor"]').value;
                    const valor = parseCurrency(valorInput);
                    if (tipo) {
                        formData.patrimonios_liquidos.push({ tipo, valor });
                    }
                });
            }

            // Coleta de dívidas
            if (formData.tem_dividas === "sim") {
                document.querySelectorAll("#dividas-list .dynamic-entry-item").forEach(entry => {
                    const credor = entry.querySelector('input[name="divida_credor"]').value.trim();
                    const saldoInput = entry.querySelector('input[name="divida_saldo"]').value;
                    const saldo = parseCurrency(saldoInput);
                    if (credor) {
                        formData.dividas.push({ credor, saldo });
                    }
                });
            }

            // Coleta de planos de saúde
            document.querySelectorAll(".plano-saude-entry").forEach(entry => {
                const nameAttribute = entry.querySelector('input[type="radio"]').name;
                const selectedRadio = entry.querySelector(`input[name="${nameAttribute}"]:checked`);
                if (selectedRadio) {
                    const personName = entry.dataset.personName;
                    const personType = entry.dataset.personType;
                    formData.planos_saude[personName] = {
                        tipo: personType,
                        possui: selectedRadio.value
                    };
                }
            });

            // Coleta de seguros de vida
            document.querySelectorAll(".seguro-vida-entry").forEach(entry => {
                const nameAttribute = entry.querySelector('input[type="radio"]').name;
                const selectedRadio = entry.querySelector(`input[name="${nameAttribute}"]:checked`);
                if (selectedRadio) {
                    const personName = entry.dataset.personName;
                    const personType = entry.dataset.personType;
                    formData.seguros_vida[personName] = {
                        tipo: personType,
                        possui: selectedRadio.value
                    };
                }
            });
            
            // Coleta de impostos de renda
            document.querySelectorAll(".imposto-renda-entry").forEach(entry => {
                const nameAttribute = entry.querySelector('input[type="radio"]').name;
                const selectedRadio = entry.querySelector(`input[name="${nameAttribute}"]:checked`);
                if (selectedRadio) {
                    const personName = entry.dataset.personName;
                    const personType = entry.dataset.personType;
                    formData.impostos_renda[personName] = {
                        tipo: personType,
                        declara: selectedRadio.value
                    };
                }
            });

            // Envio dos dados para o servidor
            try {
                const { data, error } = await supabase
                    .from("formularios_clientes")
                    .update({
                        status: "preenchido",
                        data_preenchimento: new Date().toISOString(),
                        dados_formulario: formData
                    })
                    .eq("id", formId);

                if (error) throw error;

                formContentEl.innerHTML = `
                    <div class="success-message">
                        <h2>Formulário enviado com sucesso!</h2>
                        <p>Obrigado por preencher o formulário. Suas informações foram registradas.</p>
                    </div>
                `;
                showMessage("success", "Formulário enviado com sucesso!");
            } catch (error) {
                console.error("Erro ao enviar formulário:", error);
                showMessage("error", `Erro ao enviar: ${error.message}`);
            }
        });
    }
}

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    loadForm(token);
});

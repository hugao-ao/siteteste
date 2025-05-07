document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    loadForm(token);
});

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
    container.querySelectorAll(".plano-saude-entry .radio-option-vertical-item input[type='radio']").forEach(radio => {
        if (radio.checked) {
            planoSaudeSelections[radio.name] = radio.value;
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
        document.querySelectorAll("#pessoas-list .person-entry").forEach((entry, index) => {
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasDaCasa.push({ id: `outra_pessoa_plano_${index}`, nome: sanitizeInput(nomeInput.value.trim()), tipo: "outra_pessoa_renda" });
            }
        });
    }
    if (document.getElementById("tem_dependentes_sim") && document.getElementById("tem_dependentes_sim").checked) {
        document.querySelectorAll("#dependentes-list .person-entry").forEach((entry, index) => {
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
            <label style="display: block; margin-bottom: 0.5rem; font-weight: bold;">${nomeCapitalizado} possui plano de saúde?</label>
            <div class="radio-options-vertical-group">
                <div class="radio-option-vertical-item">
                    <input type="radio" id="${personId}_sim" name="${personId}" value="sim" required>
                    <label for="${personId}_sim">Sim</label>
                </div>
                <div class="radio-option-vertical-item">
                    <input type="radio" id="${personId}_nao" name="${personId}" value="nao">
                    <label for="${personId}_nao">Não</label>
                </div>
                <div class="radio-option-vertical-item">
                    <input type="radio" id="${personId}_naosei" name="${personId}" value="nao_sei">
                    <label for="${personId}_naosei">Não sei informar</label>
                </div>
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
    container.querySelectorAll(".seguro-vida-entry .radio-option-vertical-item input[type='radio']").forEach(radio => {
        if (radio.checked) {
            seguroVidaSelections[radio.name] = radio.value;
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
        document.querySelectorAll("#pessoas-list .person-entry").forEach((entry, index) => {
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
            <label style="display: block; margin-bottom: 0.5rem; font-weight: bold;">${nomeCapitalizado} possui seguro de vida?</label>
            <div class="radio-options-vertical-group">
                <div class="radio-option-vertical-item">
                    <input type="radio" id="${personId}_sim" name="${personId}" value="sim" required>
                    <label for="${personId}_sim">Sim</label>
                </div>
                <div class="radio-option-vertical-item">
                    <input type="radio" id="${personId}_nao" name="${personId}" value="nao">
                    <label for="${personId}_nao">Não</label>
                </div>
                <div class="radio-option-vertical-item">
                    <input type="radio" id="${personId}_naosei" name="${personId}" value="nao_sei">
                    <label for="${personId}_naosei">Não sei informar</label>
                </div>
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
        if (formData.clientes && formData.clientes.nome) {
            formTitleEl.textContent = `Formulário para ${capitalizeName(sanitizeInput(formData.clientes.nome))}`;
        }
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
    const preenchedorNome = formData.dados_pessoais && formData.dados_pessoais.nome_completo ? sanitizeInput(formData.dados_pessoais.nome_completo) : "";

    formContentEl.innerHTML = `
        <form id="client-response-form">
            <label for="nome_completo">Nome Completo (Seu nome):</label>
            <input type="text" id="nome_completo" name="nome_completo" value="${preenchedorNome}" required>

            <div class="radio-group">
                <label>Você é a única pessoa que possui renda na sua casa?</label>
                <div class="radio-options-vertical-group">
                    <div class="radio-option-vertical-item">
                        <input type="radio" id="renda_unica_sim" name="renda_unica" value="sim" required ${formData.dados_pessoais && formData.dados_pessoais.renda_unica === 'sim' ? 'checked' : ''}>
                        <label for="renda_unica_sim">Sim</label>
                    </div>
                    <div class="radio-option-vertical-item">
                        <input type="radio" id="renda_unica_nao" name="renda_unica" value="nao" ${formData.dados_pessoais && formData.dados_pessoais.renda_unica === 'nao' ? 'checked' : ''}>
                        <label for="renda_unica_nao">Não</label>
                    </div>
                </div>
            </div>

            <div id="outras-pessoas-renda-container" style="display: ${formData.dados_pessoais && formData.dados_pessoais.renda_unica === 'nao' ? 'block' : 'none'}">
                <label>Outras pessoas com renda na casa:</label>
                <div id="pessoas-list"></div>
                <button type="button" id="add-person-btn">Adicionar Pessoa</button>
            </div>
            
            <hr>
            <h2 id="dependentes-section-title" style="text-align: left; margin-top:1.5rem; margin-bottom:1rem; color: var(--theme-text-light);">Dependentes</h2>
            <div class="radio-group">
                <label id="label_tem_dependentes">Você tem filho/pet/outros parentes que dependem de você?</label>
                <div class="radio-options-vertical-group">
                    <div class="radio-option-vertical-item">
                        <input type="radio" id="tem_dependentes_sim" name="tem_dependentes" value="sim" required ${formData.dependentes_info && formData.dependentes_info.tem_dependentes === 'sim' ? 'checked' : ''}>
                        <label for="tem_dependentes_sim">Sim</label>
                    </div>
                    <div class="radio-option-vertical-item">
                        <input type="radio" id="tem_dependentes_nao" name="tem_dependentes" value="nao" ${formData.dependentes_info && formData.dependentes_info.tem_dependentes === 'nao' ? 'checked' : ''}>
                        <label for="tem_dependentes_nao">Não</label>
                    </div>
                </div>
            </div>
            <div id="dependentes-list-container" style="display: ${formData.dependentes_info && formData.dependentes_info.tem_dependentes === 'sim' ? 'block' : 'none'}">
                <div id="dependentes-list"></div>
                <button type="button" id="add-dependente-btn">Adicionar Dependente</button>
            </div>

            <hr>
            <h2 id="plano-saude-section-title" style="text-align: left; margin-top:1.5rem; margin-bottom:1rem; color: var(--theme-text-light);">Plano de Saúde</h2>
            <div id="plano-saude-section-content"></div>

            <hr>
            <h2 id="seguro-vida-section-title" style="text-align: left; margin-top:1.5rem; margin-bottom:1rem; color: var(--theme-text-light);">Seguro de Vida</h2>
            <div id="seguro-vida-section-content"></div>

            <hr>
            <h2 style="text-align: left; margin-top:1.5rem; margin-bottom:1rem; color: var(--theme-text-light);">Patrimônio Físico</h2>
            <div class="radio-group">
                <label id="label_tem_patrimonio_fisico">Você possui patrimônio físico (imóvel, automóvel, jóias, outros...)?</label>
                <div class="radio-options-vertical-group">
                    <div class="radio-option-vertical-item">
                        <input type="radio" id="tem_patrimonio_fisico_sim" name="tem_patrimonio_fisico" value="sim" required ${formData.patrimonio_info && formData.patrimonio_info.tem_patrimonio_fisico === 'sim' ? 'checked' : ''}>
                        <label for="tem_patrimonio_fisico_sim">Sim</label>
                    </div>
                    <div class="radio-option-vertical-item">
                        <input type="radio" id="tem_patrimonio_fisico_nao" name="tem_patrimonio_fisico" value="nao" ${formData.patrimonio_info && formData.patrimonio_info.tem_patrimonio_fisico === 'nao' ? 'checked' : ''}>
                        <label for="tem_patrimonio_fisico_nao">Não</label>
                    </div>
                </div>
            </div>
            <div id="patrimonio-list-container" style="display: ${formData.patrimonio_info && formData.patrimonio_info.tem_patrimonio_fisico === 'sim' ? 'block' : 'none'}">
                <div id="patrimonio-list"></div>
                <button type="button" id="add-patrimonio-btn">Adicionar Patrimônio</button>
            </div>

            <hr>
            <h2 style="text-align: left; margin-top:1.5rem; margin-bottom:1rem; color: var(--theme-text-light);">Investimentos</h2>
            <div class="radio-group">
                <label>Você possui investimentos (renda fixa, ações, fundos, etc...)?</label>
                <div class="radio-options-vertical-group">
                    <div class="radio-option-vertical-item">
                        <input type="radio" id="tem_investimentos_sim" name="tem_investimentos" value="sim" required ${formData.investimentos_info && formData.investimentos_info.tem_investimentos === 'sim' ? 'checked' : ''}>
                        <label for="tem_investimentos_sim">Sim</label>
                    </div>
                    <div class="radio-option-vertical-item">
                        <input type="radio" id="tem_investimentos_nao" name="tem_investimentos" value="nao" ${formData.investimentos_info && formData.investimentos_info.tem_investimentos === 'nao' ? 'checked' : ''}>
                        <label for="tem_investimentos_nao">Não</label>
                    </div>
                </div>
            </div>
            <div id="investimentos-list-container" style="display: ${formData.investimentos_info && formData.investimentos_info.tem_investimentos === 'sim' ? 'block' : 'none'}">
                <div id="investimentos-list"></div>
                <button type="button" id="add-investimento-btn">Adicionar Investimento</button>
            </div>

            <hr>
            <h2 style="text-align: left; margin-top:1.5rem; margin-bottom:1rem; color: var(--theme-text-light);">Dívidas</h2>
            <div class="radio-group">
                <label>Você possui dívidas (empréstimos, financiamentos, etc...)?</label>
                <div class="radio-options-vertical-group">
                    <div class="radio-option-vertical-item">
                        <input type="radio" id="tem_dividas_sim" name="tem_dividas" value="sim" required ${formData.dividas_info && formData.dividas_info.tem_dividas === 'sim' ? 'checked' : ''}>
                        <label for="tem_dividas_sim">Sim</label>
                    </div>
                    <div class="radio-option-vertical-item">
                        <input type="radio" id="tem_dividas_nao" name="tem_dividas" value="nao" ${formData.dividas_info && formData.dividas_info.tem_dividas === 'nao' ? 'checked' : ''}>
                        <label for="tem_dividas_nao">Não</label>
                    </div>
                </div>
            </div>
            <div id="dividas-list-container" style="display: ${formData.dividas_info && formData.dividas_info.tem_dividas === 'sim' ? 'block' : 'none'}">
                <div id="dividas-list"></div>
                <button type="button" id="add-divida-btn">Adicionar Dívida</button>
            </div>

            <button type="submit">Enviar Respostas</button>
        </form>
    `;

    // Event listeners for dynamic sections
    document.getElementById("nome_completo").addEventListener("input", updateDynamicFormSections);
    document.querySelectorAll('input[name="renda_unica"]').forEach(radio => {
        radio.addEventListener("change", () => {
            document.getElementById("outras-pessoas-renda-container").style.display = document.getElementById("renda_unica_nao").checked ? "block" : "none";
            updateDynamicFormSections();
        });
    });
    document.querySelectorAll('input[name="tem_dependentes"]').forEach(radio => {
        radio.addEventListener("change", () => {
            document.getElementById("dependentes-list-container").style.display = document.getElementById("tem_dependentes_sim").checked ? "block" : "none";
            updateDynamicFormSections();
        });
    });
    document.querySelectorAll('input[name="tem_patrimonio_fisico"]').forEach(radio => {
        radio.addEventListener("change", () => {
            document.getElementById("patrimonio-list-container").style.display = document.getElementById("tem_patrimonio_fisico_sim").checked ? "block" : "none";
        });
    });
    document.querySelectorAll('input[name="tem_investimentos"]').forEach(radio => {
        radio.addEventListener("change", () => {
            document.getElementById("investimentos-list-container").style.display = document.getElementById("tem_investimentos_sim").checked ? "block" : "none";
        });
    });
    document.querySelectorAll('input[name="tem_dividas"]').forEach(radio => {
        radio.addEventListener("change", () => {
            document.getElementById("dividas-list-container").style.display = document.getElementById("tem_dividas_sim").checked ? "block" : "none";
        });
    });

    // Initialize dynamic lists and sections
    if (formData.dados_pessoais && formData.dados_pessoais.outras_pessoas_renda) {
        formData.dados_pessoais.outras_pessoas_renda.forEach((pessoa, index) => addPersonItem(pessoa, index));
    }
    if (formData.dependentes_info && formData.dependentes_info.dependentes_lista) {
        formData.dependentes_info.dependentes_lista.forEach((dep, index) => addDependenteItem(dep, index));
    }
    if (formData.patrimonio_info && formData.patrimonio_info.patrimonios_lista) {
        formData.patrimonio_info.patrimonios_lista.forEach((item, index) => addPatrimonioItem(item, index));
    }
    if (formData.investimentos_info && formData.investimentos_info.investimentos_lista) {
        formData.investimentos_info.investimentos_lista.forEach((item, index) => addInvestimentoItem(item, index));
    }
    if (formData.dividas_info && formData.dividas_info.dividas_lista) {
        formData.dividas_info.dividas_lista.forEach((item, index) => addDividaItem(item, index));
    }

    // Add event listeners for add buttons
    document.getElementById("add-person-btn").addEventListener("click", () => addPersonItem());
    document.getElementById("add-dependente-btn").addEventListener("click", () => addDependenteItem());
    document.getElementById("add-patrimonio-btn").addEventListener("click", () => addPatrimonioItem());
    document.getElementById("add-investimento-btn").addEventListener("click", () => addInvestimentoItem());
    document.getElementById("add-divida-btn").addEventListener("click", () => addDividaItem());

    updateDynamicFormSections(); // Initial call to render dynamic sections like plano/seguro

    // Form submission
    document.getElementById("client-response-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        // ... (submission logic remains the same)
        const form = event.target;
        const data = new FormData(form);
        const responseData = {
            token_unico: formData.token_unico,
            dados_pessoais: {
                nome_completo: sanitizeInput(data.get("nome_completo")),
                renda_unica: data.get("renda_unica"),
                outras_pessoas_renda: []
            },
            dependentes_info: {
                tem_dependentes: data.get("tem_dependentes"),
                dependentes_lista: []
            },
            plano_saude_info: [],
            seguro_vida_info: [],
            patrimonio_info: {
                tem_patrimonio_fisico: data.get("tem_patrimonio_fisico"),
                patrimonios_lista: []
            },
            investimentos_info: {
                tem_investimentos: data.get("tem_investimentos"),
                investimentos_lista: []
            },
            dividas_info: {
                tem_dividas: data.get("tem_dividas"),
                dividas_lista: []
            }
        };

        // Coletar outras pessoas com renda
        if (responseData.dados_pessoais.renda_unica === "nao") {
            document.querySelectorAll("#pessoas-list .person-entry").forEach(entry => {
                responseData.dados_pessoais.outras_pessoas_renda.push({
                    nome: sanitizeInput(entry.querySelector('input[name="pessoa_nome"]').value),
                    parentesco: sanitizeInput(entry.querySelector('select[name="pessoa_parentesco"]').value),
                    renda_mensal: formatCurrency(entry.querySelector('input[name="pessoa_renda"]').value) || null
                });
            });
        }
        // Coletar dependentes
        if (responseData.dependentes_info.tem_dependentes === "sim") {
            document.querySelectorAll("#dependentes-list .person-entry").forEach(entry => {
                responseData.dependentes_info.dependentes_lista.push({
                    nome: sanitizeInput(entry.querySelector('input[name="dep_nome"]').value),
                    data_nascimento: sanitizeInput(entry.querySelector('input[name="dep_data_nasc"]').value),
                    parentesco: sanitizeInput(entry.querySelector('select[name="dep_parentesco"]').value)
                });
            });
        }
        // Coletar Plano de Saúde
        document.querySelectorAll("#plano-saude-section-content .plano-saude-entry").forEach(entry => {
            const personName = entry.dataset.personName;
            const personType = entry.dataset.personType;
            const radioName = entry.querySelector("input[type='radio']").name;
            const selectedValue = data.get(radioName);
            if (selectedValue) {
                responseData.plano_saude_info.push({
                    pessoa_nome: personName,
                    pessoa_tipo: personType,
                    possui_plano: selectedValue
                });
            }
        });
        // Coletar Seguro de Vida
        document.querySelectorAll("#seguro-vida-section-content .seguro-vida-entry").forEach(entry => {
            const personName = entry.dataset.personName;
            const personType = entry.dataset.personType;
            const radioName = entry.querySelector("input[type='radio']").name;
            const selectedValue = data.get(radioName);
            if (selectedValue) {
                responseData.seguro_vida_info.push({
                    pessoa_nome: personName,
                    pessoa_tipo: personType,
                    possui_seguro: selectedValue
                });
            }
        });
        // Coletar Patrimônios
        if (responseData.patrimonio_info.tem_patrimonio_fisico === "sim") {
            document.querySelectorAll("#patrimonio-list .patrimonio-entry").forEach(entry => {
                const idSuffix = entry.id.split('_').pop();
                responseData.patrimonio_info.patrimonios_lista.push({
                    descricao: sanitizeInput(entry.querySelector(`#patrimonio_${idSuffix}_descricao`).value),
                    valor_estimado: formatCurrency(entry.querySelector(`#patrimonio_${idSuffix}_valor`).value) || null,
                    possui_seguro: entry.querySelector(`input[name="patrimonio_${idSuffix}_seguro"]:checked`)?.value || 'nao_informado',
                    esta_quitado: entry.querySelector(`input[name="patrimonio_${idSuffix}_quitado"]:checked`)?.value || 'nao_informado'
                });
            });
        }
        // Coletar Investimentos
        if (responseData.investimentos_info.tem_investimentos === "sim") {
            document.querySelectorAll("#investimentos-list .investimento-entry").forEach(entry => {
                const idSuffix = entry.id.split('_').pop();
                responseData.investimentos_info.investimentos_lista.push({
                    tipo: sanitizeInput(entry.querySelector(`#investimento_${idSuffix}_tipo`).value),
                    valor_atual: formatCurrency(entry.querySelector(`#investimento_${idSuffix}_valor`).value) || null,
                    liquidez: sanitizeInput(entry.querySelector(`#investimento_${idSuffix}_liquidez`).value)
                });
            });
        }
        // Coletar Dívidas
        if (responseData.dividas_info.tem_dividas === "sim") {
            document.querySelectorAll("#dividas-list .divida-entry").forEach(entry => {
                const idSuffix = entry.id.split('_').pop();
                responseData.dividas_info.dividas_lista.push({
                    descricao: sanitizeInput(entry.querySelector(`#divida_${idSuffix}_descricao`).value),
                    saldo_devedor: formatCurrency(entry.querySelector(`#divida_${idSuffix}_saldo`).value) || null,
                    taxa_juros_anual: sanitizeInput(entry.querySelector(`#divida_${idSuffix}_juros`).value) || null,
                    prazo_restante_meses: sanitizeInput(entry.querySelector(`#divida_${idSuffix}_prazo`).value) || null,
                    em_dia: entry.querySelector(`input[name="divida_${idSuffix}_em_dia"]:checked`)?.value || 'nao_informado'
                });
            });
        }

        try {
            const { error: updateError } = await supabase
                .from("formularios_clientes")
                .update({
                    dados_pessoais: responseData.dados_pessoais,
                    dependentes_info: responseData.dependentes_info,
                    plano_saude_info: responseData.plano_saude_info,
                    seguro_vida_info: responseData.seguro_vida_info,
                    patrimonio_info: responseData.patrimonio_info,
                    investimentos_info: responseData.investimentos_info,
                    dividas_info: responseData.dividas_info,
                    status: "preenchido",
                    data_preenchimento: new Date().toISOString()
                })
                .eq("token_unico", formData.token_unico);

            if (updateError) throw updateError;

            formContentEl.innerHTML = "<p>Formulário enviado com sucesso!</p>";
            showMessage("success", "Obrigado por preencher o formulário.");

        } catch (error) {
            console.error("Erro ao enviar formulário:", error);
            showMessage("error", `Erro ao enviar: ${error.message}`);
        }
    });
}

// Funções para adicionar/remover itens dinâmicos (pessoas, dependentes, patrimônio, etc.)
let personIdCounter = 0;
function addPersonItem(pessoa = {}, index = null) {
    const list = document.getElementById("pessoas-list");
    const personDiv = document.createElement("div");
    const idSuffix = index !== null ? `edit_${index}` : `new_${personIdCounter++}`;
    personDiv.classList.add("person-entry");
    personDiv.id = `person_${idSuffix}`;
    personDiv.innerHTML = `
        <label for="pessoa_nome_${idSuffix}">Nome:</label>
        <input type="text" id="pessoa_nome_${idSuffix}" name="pessoa_nome" value="${sanitizeInput(pessoa.nome || '')}" required>
        <label for="pessoa_parentesco_${idSuffix}">Parentesco:</label>
        <select id="pessoa_parentesco_${idSuffix}" name="pessoa_parentesco">
            <option value="conjuge" ${pessoa.parentesco === 'conjuge' ? 'selected' : ''}>Cônjuge</option>
            <option value="parceiro_a" ${pessoa.parentesco === 'parceiro_a' ? 'selected' : ''}>Parceiro(a)</option>
            <option value="outro" ${pessoa.parentesco === 'outro' ? 'selected' : ''}>Outro</option>
        </select>
        <label for="pessoa_renda_${idSuffix}">Renda Mensal (R$):</label>
        <input type="text" id="pessoa_renda_${idSuffix}" name="pessoa_renda" value="${formatCurrency(pessoa.renda_mensal || '')}" placeholder="R$ 0,00" oninput="this.value = formatCurrency(this.value)">
        <button type="button" class="remove-person-btn">Remover</button>
    `;
    personDiv.querySelector(".remove-person-btn").addEventListener("click", () => { 
        personDiv.remove(); 
        updateDynamicFormSections(); 
    });
    list.appendChild(personDiv);
    personDiv.querySelector('input[name="pessoa_nome"]').addEventListener("input", updateDynamicFormSections);
}

let dependenteIdCounter = 0;
function addDependenteItem(dep = {}, index = null) {
    const list = document.getElementById("dependentes-list");
    const depDiv = document.createElement("div");
    const idSuffix = index !== null ? `edit_${index}` : `new_${dependenteIdCounter++}`;
    depDiv.classList.add("person-entry"); // Reutilizando a classe .person-entry para estilo similar
    depDiv.id = `dependente_${idSuffix}`;
    depDiv.innerHTML = `
        <label for="dep_nome_${idSuffix}">Nome do Dependente:</label>
        <input type="text" id="dep_nome_${idSuffix}" name="dep_nome" value="${sanitizeInput(dep.nome || '')}" required>
        <label for="dep_data_nasc_${idSuffix}">Data de Nascimento:</label>
        <input type="date" id="dep_data_nasc_${idSuffix}" name="dep_data_nasc" value="${sanitizeInput(dep.data_nascimento || '')}">
        <label for="dep_parentesco_${idSuffix}">Parentesco:</label>
        <select id="dep_parentesco_${idSuffix}" name="dep_parentesco">
            <option value="filho_a" ${dep.parentesco === 'filho_a' ? 'selected' : ''}>Filho(a)</option>
            <option value="enteado_a" ${dep.parentesco === 'enteado_a' ? 'selected' : ''}>Enteado(a)</option>
            <option value="pai_mae" ${dep.parentesco === 'pai_mae' ? 'selected' : ''}>Pai/Mãe</option>
            <option value="irmao_a" ${dep.parentesco === 'irmao_a' ? 'selected' : ''}>Irmão/Irmã</option>
            <option value="pet" ${dep.parentesco === 'pet' ? 'selected' : ''}>Pet</option>
            <option value="outro" ${dep.parentesco === 'outro' ? 'selected' : ''}>Outro</option>
        </select>
        <button type="button" class="remove-person-btn">Remover</button>
    `;
    depDiv.querySelector(".remove-person-btn").addEventListener("click", () => { 
        depDiv.remove(); 
        updateDynamicFormSections(); 
    });
    list.appendChild(depDiv);
    depDiv.querySelector('input[name="dep_nome"]').addEventListener("input", updateDynamicFormSections);
}

let patrimonioIdCounter = 0;
function addPatrimonioItem(item = {}, index = null) {
    const list = document.getElementById("patrimonio-list");
    const patrimonioDiv = document.createElement("div");
    const idSuffix = index !== null ? `edit_${index}` : `new_${patrimonioIdCounter++}`;
    patrimonioDiv.classList.add("person-entry"); // Reutilizando .person-entry
    patrimonioDiv.id = `patrimonio_${idSuffix}`;
    patrimonioDiv.innerHTML = `
        <label for="patrimonio_${idSuffix}_descricao">Descrição (ex: Carro Sandero 2017, Apto Centro):</label>
        <input type="text" id="patrimonio_${idSuffix}_descricao" name="patrimonio_descricao" value="${sanitizeInput(item.descricao || '')}" required>
        <label for="patrimonio_${idSuffix}_valor">Valor Estimado (R$):</label>
        <input type="text" id="patrimonio_${idSuffix}_valor" name="patrimonio_valor" value="${formatCurrency(item.valor_estimado || '')}" placeholder="R$ 0,00" oninput="this.value = formatCurrency(this.value)">
        
        <div class="radio-group" style="margin-top: 0.5rem;">
            <label>Possui seguro?</label>
            <div class="radio-options-vertical-group">
                <div class="radio-option-vertical-item">
                    <input type="radio" id="patrimonio_${idSuffix}_seguro_sim" name="patrimonio_${idSuffix}_seguro" value="sim" ${item.possui_seguro === 'sim' ? 'checked' : ''}>
                    <label for="patrimonio_${idSuffix}_seguro_sim">Sim</label>
                </div>
                <div class="radio-option-vertical-item">
                    <input type="radio" id="patrimonio_${idSuffix}_seguro_nao" name="patrimonio_${idSuffix}_seguro" value="nao" ${item.possui_seguro === 'nao' || !item.possui_seguro ? 'checked' : ''}>
                    <label for="patrimonio_${idSuffix}_seguro_nao">Não</label>
                </div>
            </div>
        </div>

        <div class="radio-group" style="margin-top: 0.5rem;">
            <label>Está quitado?</label>
            <div class="radio-options-vertical-group">
                <div class="radio-option-vertical-item">
                    <input type="radio" id="patrimonio_${idSuffix}_quitado_sim" name="patrimonio_${idSuffix}_quitado" value="sim" ${item.esta_quitado === 'sim' ? 'checked' : ''}>
                    <label for="patrimonio_${idSuffix}_quitado_sim">Sim</label>
                </div>
                <div class="radio-option-vertical-item">
                    <input type="radio" id="patrimonio_${idSuffix}_quitado_nao" name="patrimonio_${idSuffix}_quitado" value="nao" ${item.esta_quitado === 'nao' || !item.esta_quitado ? 'checked' : ''}>
                    <label for="patrimonio_${idSuffix}_quitado_nao">Não</label>
                </div>
            </div>
        </div>
        <button type="button" class="remove-person-btn">Remover Patrimônio</button>
    `;
    patrimonioDiv.querySelector(".remove-person-btn").addEventListener("click", () => patrimonioDiv.remove());
    list.appendChild(patrimonioDiv);
}

let investimentoIdCounter = 0;
function addInvestimentoItem(item = {}, index = null) {
    const list = document.getElementById("investimentos-list");
    const investimentoDiv = document.createElement("div");
    const idSuffix = index !== null ? `edit_${index}` : `new_${investimentoIdCounter++}`;
    investimentoDiv.classList.add("person-entry");
    investimentoDiv.id = `investimento_${idSuffix}`;
    investimentoDiv.innerHTML = `
        <label for="investimento_${idSuffix}_tipo">Tipo de Investimento (ex: CDB, Ações XPTO, Fundo Imobiliário):</label>
        <input type="text" id="investimento_${idSuffix}_tipo" name="investimento_tipo" value="${sanitizeInput(item.tipo || '')}" required>
        <label for="investimento_${idSuffix}_valor">Valor Atual (R$):</label>
        <input type="text" id="investimento_${idSuffix}_valor" name="investimento_valor" value="${formatCurrency(item.valor_atual || '')}" placeholder="R$ 0,00" oninput="this.value = formatCurrency(this.value)">
        <label for="investimento_${idSuffix}_liquidez">Liquidez (ex: D+0, D+30, Baixa):</label>
        <input type="text" id="investimento_${idSuffix}_liquidez" name="investimento_liquidez" value="${sanitizeInput(item.liquidez || '')}">
        <button type="button" class="remove-person-btn">Remover Investimento</button>
    `;
    investimentoDiv.querySelector(".remove-person-btn").addEventListener("click", () => investimentoDiv.remove());
    list.appendChild(investimentoDiv);
}

let dividaIdCounter = 0;
function addDividaItem(item = {}, index = null) {
    const list = document.getElementById("dividas-list");
    const dividaDiv = document.createElement("div");
    const idSuffix = index !== null ? `edit_${index}` : `new_${dividaIdCounter++}`;
    dividaDiv.classList.add("person-entry");
    dividaDiv.id = `divida_${idSuffix}`;
    dividaDiv.innerHTML = `
        <label for="divida_${idSuffix}_descricao">Descrição da Dívida (ex: Financiamento Imobiliário, Empréstimo Pessoal):</label>
        <input type="text" id="divida_${idSuffix}_descricao" name="divida_descricao" value="${sanitizeInput(item.descricao || '')}" required>
        <label for="divida_${idSuffix}_saldo">Saldo Devedor (R$):</label>
        <input type="text" id="divida_${idSuffix}_saldo" name="divida_saldo" value="${formatCurrency(item.saldo_devedor || '')}" placeholder="R$ 0,00" oninput="this.value = formatCurrency(this.value)">
        <label for="divida_${idSuffix}_juros">Taxa de Juros Anual (%):</label>
        <input type="text" id="divida_${idSuffix}_juros" name="divida_juros" value="${sanitizeInput(item.taxa_juros_anual || '')}" placeholder="Ex: 12.5">
        <label for="divida_${idSuffix}_prazo">Prazo Restante (meses):</label>
        <input type="text" id="divida_${idSuffix}_prazo" name="divida_prazo" value="${sanitizeInput(item.prazo_restante_meses || '')}" placeholder="Ex: 36">
        <div class="radio-group" style="margin-top: 0.5rem;">
            <label>A dívida está em dia?</label>
            <div class="radio-options-vertical-group">
                <div class="radio-option-vertical-item">
                    <input type="radio" id="divida_${idSuffix}_em_dia_sim" name="divida_${idSuffix}_em_dia" value="sim" ${item.em_dia === 'sim' ? 'checked' : ''}>
                    <label for="divida_${idSuffix}_em_dia_sim">Sim</label>
                </div>
                <div class="radio-option-vertical-item">
                    <input type="radio" id="divida_${idSuffix}_em_dia_nao" name="divida_${idSuffix}_em_dia" value="nao" ${item.em_dia === 'nao' || !item.em_dia ? 'checked' : ''}>
                    <label for="divida_${idSuffix}_em_dia_nao">Não</label>
                </div>
            </div>
        </div>
        <button type="button" class="remove-person-btn">Remover Dívida</button>
    `;
    dividaDiv.querySelector(".remove-person-btn").addEventListener("click", () => dividaDiv.remove());
    list.appendChild(dividaDiv);
}


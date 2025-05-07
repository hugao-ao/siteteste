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
    // Permite apenas números, vírgula e ponto. Remove R$ e espaços.
    let cleanValue = String(value).replace(/[^\d,.-]/g, 
        '');
    // Se houver mais de uma vírgula, mantém apenas a última e remove as anteriores como se fossem pontos.
    const commaCount = (cleanValue.match(/,/g) || []).length;
    if (commaCount > 1) {
        const parts = cleanValue.split(',');
        cleanValue = parts.slice(0, -1).join('') + '.' + parts.slice(-1);
    } else {
        cleanValue = cleanValue.replace(',', '.'); // Troca vírgula por ponto para parseFloat
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

// Função para salvar o estado atual dos radios de plano de saúde
function savePlanoSaudeSelections() {
    const container = document.getElementById("plano-saude-section-content");
    if (!container) return;
    planoSaudeSelections = {}; // Limpa seleções antigas
    container.querySelectorAll(".plano-saude-entry").forEach(entry => {
        const nameAttribute = entry.querySelector('input[type="radio"]').name; 
        const selectedRadio = entry.querySelector(`input[name="${nameAttribute}"]:checked`);
        if (selectedRadio) {
            planoSaudeSelections[nameAttribute] = selectedRadio.value;
        }
    });
}

// Função para restaurar o estado dos radios de plano de saúde
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

// Função para salvar o estado atual dos radios de seguro de vida
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

// Função para restaurar o estado dos radios de seguro de vida
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
                <button type="button" id="add-person-btn">+ Adicionar Pessoa com Renda</button>
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
                <button type="button" id="add-dependente-btn">+ Adicionar Dependente</button>
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

            <!-- Seção de Patrimônio Físico -->
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
                    <label>Patrimônios:</label>
                    <div id="patrimonio-list"></div>
                    <button type="button" id="add-patrimonio-btn">+ Adicionar Patrimônio</button>
                </div>
            </div>

            <button type="submit" id="submit-btn">Enviar Respostas</button>
        </form>
    `;

    attachFormEventListeners(formData.id);
    updateDynamicFormSections(); 
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
            newPersonEntry.classList.add("person-entry");
            newPersonEntry.innerHTML = `
                <input type="text" name="pessoa_nome" placeholder="Nome da pessoa" required>
                <label>Você precisa de autorização de <span class="person-name-placeholder"></span> para tomar decisões financeiras e agir?</label>
                <select name="pessoa_autorizacao" required>
                    <option value="" disabled selected>Selecione</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                </select>
                <button type="button" class="remove-person-btn">Remover</button>
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

            newPersonEntry.querySelector(".remove-person-btn").addEventListener("click", () => {
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
            newDependenteEntry.classList.add("person-entry"); 
            newDependenteEntry.innerHTML = `
                <input type="text" name="dep_nome" placeholder="Nome do dependente" required>
                <input type="number" name="dep_idade" placeholder="Idade" min="0" required>
                <input type="text" name="dep_relacao" placeholder="Relação (filho(a), pai, mãe, irmã(o), Pet, etc...):" required>
                <button type="button" class="remove-dependente-btn">Remover</button>
            `;
            dependentesListEl.appendChild(newDependenteEntry);
            
            // Adiciona listener ao campo nome do dependente para atualizar seções dinâmicas
            const nomeDependenteInput = newDependenteEntry.querySelector('input[name="dep_nome"]');
            if (nomeDependenteInput) {
                nomeDependenteInput.addEventListener('input', updateDynamicFormSections);
            }

            newDependenteEntry.querySelector(".remove-dependente-btn").addEventListener("click", () => {
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
            newPatrimonioEntry.classList.add("patrimonio-entry");
            newPatrimonioEntry.innerHTML = `
                <input type="text" name="patrimonio_qual" placeholder="Qual patrimônio? (ex: Apto 50m2, Corolla 2020)" required>
                <input type="text" name="patrimonio_valor" placeholder="Quanto vale? (R$)" required class="currency-input">
                <div class="radio-group-patrimonio-item">
                    <label>Possui seguro?</label>
                    <div class="radio-options-inline-patrimonio-item">
                        <input type="radio" name="patrimonio_seguro_${patrimonioIndex}" value="sim" required> <label for="patrimonio_seguro_${patrimonioIndex}_sim">Sim</label>
                        <input type="radio" name="patrimonio_seguro_${patrimonioIndex}" value="nao"> <label for="patrimonio_seguro_${patrimonioIndex}_nao">Não</label>
                    </div>
                </div>
                <div class="radio-group-patrimonio-item">
                    <label>Está quitado?</label>
                    <div class="radio-options-inline-patrimonio-item">
                         <input type="radio" name="patrimonio_quitado_${patrimonioIndex}" value="sim" required> <label for="patrimonio_quitado_${patrimonioIndex}_sim">Sim</label>
                         <input type="radio" name="patrimonio_quitado_${patrimonioIndex}" value="nao"> <label for="patrimonio_quitado_${patrimonioIndex}_nao">Não</label>
                    </div>
                </div>
                <button type="button" class="remove-patrimonio-btn">Remover</button>
            `;
            patrimonioListEl.appendChild(newPatrimonioEntry);

            const valorInput = newPatrimonioEntry.querySelector('input[name="patrimonio_valor"]');
            valorInput.addEventListener('input', (e) => {
                const rawValue = e.target.value.replace(/[^\d]/g, ''); // Remove tudo exceto dígitos
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

            newPatrimonioEntry.querySelector(".remove-patrimonio-btn").addEventListener("click", () => {
                newPatrimonioEntry.remove();
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
                    patrimonios_fisicos: []
                };

                if (dadosFormulario.renda_unica === "nao") {
                    document.querySelectorAll("#pessoas-list .person-entry").forEach(entry => {
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
                    document.querySelectorAll("#dependentes-list .person-entry").forEach(entry => {
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
                    document.querySelectorAll("#patrimonio-list .patrimonio-entry").forEach((entry, index) => {
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
                                valor: !isNaN(valorNumerico) ? valorNumerico : null,
                                seguro: seguro,
                                quitado: quitado
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

                showMessage("success", "Formulário enviado com sucesso!");
                formContentEl.innerHTML = "<p>Obrigado por preencher o formulário.</p>";

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
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    loadForm(token);
});

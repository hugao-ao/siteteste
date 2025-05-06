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
    const number = parseFloat(String(value).replace(/[^\d.-]/g, 
        ''));
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
        const name = entry.querySelector('input[type="radio"]').name;
        const selectedRadio = entry.querySelector(`input[name="${name}"]:checked`);
        if (selectedRadio) {
            planoSaudeSelections[name] = selectedRadio.value;
        }
    });
}

// Função para restaurar o estado dos radios de plano de saúde
function restorePlanoSaudeSelections() {
    Object.keys(planoSaudeSelections).forEach(name => {
        const value = planoSaudeSelections[name];
        const radioToSelect = document.querySelector(`input[name="${name}"][value="${value}"]`);
        if (radioToSelect) {
            radioToSelect.checked = true;
        }
    });
}

function renderPlanoSaudeQuestions() {
    savePlanoSaudeSelections(); // Salva seleções antes de limpar
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
            const nomeInput = entry.querySelector('input[name="dep_nome"]
');
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
    restorePlanoSaudeSelections(); // Restaura seleções após renderizar
}

// Função para salvar o estado atual dos radios de seguro de vida
function saveSeguroVidaSelections() {
    const container = document.getElementById("seguro-vida-section-content");
    if (!container) return;
    seguroVidaSelections = {}; // Limpa seleções antigas
    container.querySelectorAll(".seguro-vida-entry").forEach(entry => {
        const name = entry.querySelector('input[type="radio"]').name;
        const selectedRadio = entry.querySelector(`input[name="${name}"]:checked`);
        if (selectedRadio) {
            seguroVidaSelections[name] = selectedRadio.value;
        }
    });
}

// Função para restaurar o estado dos radios de seguro de vida
function restoreSeguroVidaSelections() {
    Object.keys(seguroVidaSelections).forEach(name => {
        const value = seguroVidaSelections[name];
        const radioToSelect = document.querySelector(`input[name="${name}"][value="${value}"]`);
        if (radioToSelect) {
            radioToSelect.checked = true;
        }
    });
}

function renderSeguroVidaQuestions() {
    saveSeguroVidaSelections(); // Salva seleções antes de limpar
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
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]
');
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
    restoreSeguroVidaSelections(); // Restaura seleções após renderizar
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
                    <input type="radio" id="tem_patrimonio_sim" name="tem_patrimonio" value="sim" required>
                    <label for="tem_patrimonio_sim">Sim</label>
                    <input type="radio" id="tem_patrimonio_nao" name="tem_patrimonio" value="nao">
                    <label for="tem_patrimonio_nao">Não</label>
                </div>
                <div id="patrimonio-list-container" style="display: none;">
                    <label>Patrimônios Físicos:</label>
                    <div id="patrimonio-list"></div>
                    <button type="button" id="add-patrimonio-btn">+ Adicionar Patrimônio</button>
                </div>
            </div>

            <button type="submit" style="margin-top: 2rem;">Enviar Resposta</button>
        </form>
    `;

    // Adiciona listeners de eventos após renderizar o formulário
    document.getElementById("nome_completo").addEventListener("input", updateDynamicFormSections);
    document.querySelectorAll('input[name="renda_unica"]').forEach(radio => {
        radio.addEventListener("change", () => {
            document.getElementById("outras-pessoas-renda-container").style.display = 
                document.getElementById("renda_unica_nao").checked ? "block" : "none";
            updateDynamicFormSections();
        });
    });
    document.getElementById("add-person-btn").addEventListener("click", () => {
        const list = document.getElementById("pessoas-list");
        const personIndex = list.children.length;
        const entryDiv = document.createElement("div");
        entryDiv.classList.add("person-entry");
        entryDiv.innerHTML = `
            <input type="text" name="pessoa_nome" placeholder="Nome da pessoa" required>
            <label>Você precisa de autorização de <span class="auth-person-name"></span> para tomar decisões financeiras e agir?</label>
            <select name="pessoa_autorizacao" required>
                <option value="">Selecione...</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
            </select>
            <button type="button" class="remove-btn">Remover</button>
        `;
        const nomeInput = entryDiv.querySelector('input[name="pessoa_nome"]');
        const authPersonNameSpan = entryDiv.querySelector('.auth-person-name');
        nomeInput.addEventListener('input', () => {
            const primeiroNome = nomeInput.value.trim().split(' ')[0];
            authPersonNameSpan.textContent = capitalizeName(primeiroNome) || "esta pessoa";
            updateDynamicFormSections(); 
        });
        entryDiv.querySelector(".remove-btn").addEventListener("click", () => {
            entryDiv.remove();
            updateDynamicFormSections();
        });
        list.appendChild(entryDiv);
        updateDynamicFormSections();
    });

    document.querySelectorAll('input[name="tem_dependentes"]').forEach(radio => {
        radio.addEventListener("change", () => {
            document.getElementById("dependentes-container").style.display = 
                document.getElementById("tem_dependentes_sim").checked ? "block" : "none";
            updateDynamicFormSections();
        });
    });
    document.getElementById("add-dependente-btn").addEventListener("click", () => {
        const list = document.getElementById("dependentes-list");
        const depIndex = list.children.length;
        const entryDiv = document.createElement("div");
        entryDiv.classList.add("person-entry"); // Reutiliza a classe para estilização similar
        entryDiv.innerHTML = `
            <input type="text" name="dep_nome" placeholder="Nome do Dependente" required>
            <input type="number" name="dep_idade" placeholder="Idade" min="0" required>
            <input type="text" name="dep_relacao" placeholder="Relação (filho(a), pai, mãe, irmã(o), Pet, etc...):" required>
            <button type="button" class="remove-btn">Remover</button>
        `;
        entryDiv.querySelector(".remove-btn").addEventListener("click", () => {
            entryDiv.remove();
            updateDynamicFormSections();
        });
        list.appendChild(entryDiv);
        // Não precisa chamar updateDynamicFormSections aqui se não afeta labels dinâmicas diretamente
    });

    document.querySelectorAll('input[name="tem_patrimonio"]').forEach(radio => {
        radio.addEventListener("change", () => {
            document.getElementById("patrimonio-list-container").style.display = 
                document.getElementById("tem_patrimonio_sim").checked ? "block" : "none";
            updateDynamicFormSections(); // Para caso afete algo, mas provavelmente não
        });
    });
    document.getElementById("add-patrimonio-btn").addEventListener("click", () => {
        const list = document.getElementById("patrimonio-list");
        const patIndex = list.children.length;
        const entryDiv = document.createElement("div");
        entryDiv.classList.add("patrimonio-entry");
        entryDiv.innerHTML = `
            <input type="text" name="pat_descricao" placeholder="Qual é o patrimônio? (ex: Apartamento 50m2)" required>
            <input type="text" name="pat_valor" placeholder="Quanto vale? (ex: 300000)" inputmode="numeric" required>
            <div class="radio-group-inline">
                <label>Possui Seguro?</label>
                <input type="radio" id="pat_seguro_sim_${patIndex}" name="pat_seguro_${patIndex}" value="sim" required><label for="pat_seguro_sim_${patIndex}">Sim</label>
                <input type="radio" id="pat_seguro_nao_${patIndex}" name="pat_seguro_${patIndex}" value="nao"><label for="pat_seguro_nao_${patIndex}">Não</label>
            </div>
            <div class="radio-group-inline">
                <label>Está Quitado?</label>
                <input type="radio" id="pat_quitado_sim_${patIndex}" name="pat_quitado_${patIndex}" value="sim" required><label for="pat_quitado_sim_${patIndex}">Sim</label>
                <input type="radio" id="pat_quitado_nao_${patIndex}" name="pat_quitado_${patIndex}" value="nao"><label for="pat_quitado_nao_${patIndex}">Não</label>
            </div>
            <button type="button" class="remove-btn">Remover Patrimônio</button>
        `;
        entryDiv.querySelector('input[name="pat_valor"]').addEventListener('input', function (e) {
            e.target.value = formatCurrency(e.target.value.replace(/[^\d]/g, ''));
        });
        entryDiv.querySelector(".remove-btn").addEventListener("click", () => {
            entryDiv.remove();
            updateDynamicFormSections(); // Para caso afete algo
        });
        list.appendChild(entryDiv);
    });

    // Inicializa as seções dinâmicas
    updateDynamicFormSections();

    // Listener para o envio do formulário
    document.getElementById("client-response-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        const formDataObject = {
            nome_completo: capitalizeName(sanitizeInput(form.nome_completo.value)),
            renda_unica: form.renda_unica.value === "sim",
            outras_pessoas_renda: [],
            tem_dependentes: form.tem_dependentes.value === "sim",
            dependentes: [],
            informacoes_plano_saude: [],
            informacoes_seguro_vida: [],
            possui_patrimonio_fisico: form.tem_patrimonio.value === "sim",
            patrimonios_fisicos: []
        };

        if (formDataObject.renda_unica === false) {
            document.querySelectorAll("#pessoas-list .person-entry").forEach(entry => {
                formDataObject.outras_pessoas_renda.push({
                    nome: capitalizeName(sanitizeInput(entry.querySelector('input[name="pessoa_nome"]').value)),
                    precisa_autorizacao: entry.querySelector('select[name="pessoa_autorizacao"]').value === "sim"
                });
            });
        }

        if (formDataObject.tem_dependentes === true) {
            document.querySelectorAll("#dependentes-list .person-entry").forEach(entry => {
                formDataObject.dependentes.push({
                    nome: capitalizeName(sanitizeInput(entry.querySelector('input[name="dep_nome"]').value)),
                    idade: parseInt(entry.querySelector('input[name="dep_idade"]').value, 10),
                    relacao: sanitizeInput(entry.querySelector('input[name="dep_relacao"]').value)
                });
            });
        }

        document.querySelectorAll("#plano-saude-section-content .plano-saude-entry").forEach(entry => {
            const name = entry.querySelector('input[type="radio"]').name;
            const selectedRadio = entry.querySelector(`input[name="${name}"]:checked`);
            formDataObject.informacoes_plano_saude.push({
                nome_pessoa: capitalizeName(sanitizeInput(entry.dataset.personName)), 
                tipo_pessoa: entry.dataset.personType,
                status_plano: selectedRadio ? selectedRadio.value : "nao_informado"
            });
        });

        document.querySelectorAll("#seguro-vida-section-content .seguro-vida-entry").forEach(entry => {
            const name = entry.querySelector('input[type="radio"]').name;
            const selectedRadio = entry.querySelector(`input[name="${name}"]:checked`);
            formDataObject.informacoes_seguro_vida.push({
                nome_pessoa: capitalizeName(sanitizeInput(entry.dataset.personName)), 
                tipo_pessoa: entry.dataset.personType,
                status_seguro: selectedRadio ? selectedRadio.value : "nao_informado"
            });
        });

        if (formDataObject.possui_patrimonio_fisico === true) {
            document.querySelectorAll("#patrimonio-list .patrimonio-entry").forEach((entry, index) => {
                const valorRaw = entry.querySelector('input[name="pat_valor"]').value.replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.');
                formDataObject.patrimonios_fisicos.push({
                    descricao: sanitizeInput(entry.querySelector('input[name="pat_descricao"]').value),
                    valor: parseFloat(valorRaw) || 0,
                    possui_seguro: entry.querySelector(`input[name="pat_seguro_${index}"]:checked`)?.value === "sim",
                    esta_quitado: entry.querySelector(`input[name="pat_quitado_${index}"]:checked`)?.value === "sim"
                });
            });
        }

        try {
            const { error } = await supabase
                .from("formularios_clientes")
                .update({
                    dados_formulario: formDataObject,
                    status: "preenchido",
                    data_preenchimento: new Date().toISOString(),
                })
                .eq("token_unico", new URLSearchParams(window.location.search).get("token"));

            if (error) throw error;

            formContentEl.innerHTML = "<p>Obrigado por preencher o formulário!</p>";
            showMessage("success", "Suas respostas foram enviadas com sucesso.");
        } catch (error) {
            console.error("Erro ao enviar formulário:", error);
            showMessage("error", `Erro ao enviar: ${error.message}`);
        }
    });
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    loadForm(token);
});


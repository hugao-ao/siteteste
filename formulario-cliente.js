// formulario-cliente.js
import { supabase } from "./supabase.js";

// --- Elementos DOM ---
const formContentEl = document.getElementById("form-content");
const messageAreaEl = document.getElementById("message-area");
const formTitleEl = document.getElementById("form-title");

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

// Função para exibir mensagens
function showMessage(type, text) {
    messageAreaEl.innerHTML = `<div class="message ${type}">${sanitizeInput(text)}</div>`;
}

// Função para atualizar dinamicamente a pergunta sobre dependentes
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

// Função para renderizar as perguntas sobre plano de saúde
function renderPlanoSaudeQuestions() {
    const container = document.getElementById("plano-saude-section-content");
    if (!container) return;
    container.innerHTML = ''; // Limpa perguntas anteriores

    const pessoasDaCasa = [];
    const nomeCompletoInput = document.getElementById("nome_completo");
    if (nomeCompletoInput && nomeCompletoInput.value.trim() !== "") {
        pessoasDaCasa.push({ id: "preenchedor", nome: sanitizeInput(nomeCompletoInput.value.trim()) });
    }

    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        document.querySelectorAll("#pessoas-list .person-entry").forEach((entry, index) => {
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasDaCasa.push({ id: `outra_pessoa_${index}`, nome: sanitizeInput(nomeInput.value.trim()) });
            }
        });
    }

    if (document.getElementById("tem_dependentes_sim") && document.getElementById("tem_dependentes_sim").checked) {
        document.querySelectorAll("#dependentes-list .person-entry").forEach((entry, index) => {
            const nomeInput = entry.querySelector('input[name="dep_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasDaCasa.push({ id: `dependente_${index}`, nome: sanitizeInput(nomeInput.value.trim()) });
            }
        });
    }

    if (pessoasDaCasa.length === 0) {
        container.innerHTML = "<p>Preencha as informações anteriores para definir as perguntas sobre plano de saúde.</p>";
        return;
    }
    
    const tituloPlanoSaude = document.getElementById("plano-saude-section-title");
    if(tituloPlanoSaude) tituloPlanoSaude.style.display = pessoasDaCasa.length > 0 ? 'block' : 'none';


    pessoasDaCasa.forEach((pessoa, index) => {
        const primeiroNome = pessoa.nome.split(' ')[0];
        const personId = `plano_saude_pessoa_${index}`;

        const entryDiv = document.createElement("div");
        entryDiv.classList.add("plano-saude-entry");
        entryDiv.innerHTML = `
            <label for="${personId}">${primeiroNome} possui plano de saúde?</label><br>
            <input type="radio" id="${personId}_sim" name="${personId}" value="sim" required>
            <label for="${personId}_sim">Sim</label>
            <input type="radio" id="${personId}_nao" name="${personId}" value="nao">
            <label for="${personId}_nao">Não</label>
            <input type="radio" id="${personId}_naosei" name="${personId}" value="nao_sei">
            <label for="${personId}_naosei">Não sei informar</label>
        `;
        entryDiv.dataset.personName = pessoa.nome; // Guardar o nome completo para o submit
        container.appendChild(entryDiv);
    });
}

// Função unificada para atualizar seções dinâmicas
function updateDynamicFormSections() {
    updatePerguntaDependentesLabel();
    renderPlanoSaudeQuestions();
}


// Função para buscar dados do formulário e cliente
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
            formTitleEl.textContent = `Formulário para ${sanitizeInput(formData.clientes.nome)}`;
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

// Função para renderizar o formulário HTML (AJUSTADO PARA PLANO DE SAÚDE)
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

            <button type="submit" style="margin-top: 2rem;">Enviar Resposta</button>
        </form>
    `;

    const nomeCompletoInput = document.getElementById("nome_completo");
    nomeCompletoInput.addEventListener('input', updateDynamicFormSections);

    const radioRendaSim = document.getElementById("renda_unica_sim");
    const radioRendaNao = document.getElementById("renda_unica_nao");
    const outrasPessoasContainer = document.getElementById("outras-pessoas-renda-container");
    const addPersonBtn = document.getElementById("add-person-btn");
    const pessoasList = document.getElementById("pessoas-list");

    radioRendaSim.addEventListener('change', () => {
        if (radioRendaSim.checked) {
            outrasPessoasContainer.style.display = 'none';
            pessoasList.innerHTML = '';
        }
        updateDynamicFormSections();
    });
    radioRendaNao.addEventListener('change', () => {
        if (radioRendaNao.checked) {
            outrasPessoasContainer.style.display = 'block';
        }
        updateDynamicFormSections();
    });

    addPersonBtn.addEventListener('click', () => {
        const personId = Date.now();
        const personEntry = document.createElement('div');
        personEntry.classList.add('person-entry');
        personEntry.dataset.id = personId;
        personEntry.innerHTML = `
            <button type="button" class="remove-person-btn" data-id="${personId}">Remover</button>
            <label for="pessoa_nome_${personId}">Nome:</label>
            <input type="text" id="pessoa_nome_${personId}" name="pessoa_nome" required>
            <label for="pessoa_autorizacao_${personId}" id="label_autorizacao_${personId}">Você precisa de autorização de ... para tomar decisões financeiras e agir?</label>
            <select id="pessoa_autorizacao_${personId}" name="pessoa_autorizacao" required>
                <option value="">Selecione...</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
            </select>
        `;
        pessoasList.appendChild(personEntry);
        const nomeInputPessoa = personEntry.querySelector(`#pessoa_nome_${personId}`);
        const autorizacaoLabel = personEntry.querySelector(`#label_autorizacao_${personId}`);
        
        nomeInputPessoa.addEventListener('input', () => {
            const nomeDigitado = nomeInputPessoa.value.trim();
            const primeiroNome = nomeDigitado.split(' ')[0];
            if (primeiroNome) {
                autorizacaoLabel.textContent = `Você precisa de autorização de ${sanitizeInput(primeiroNome)} para tomar decisões financeiras e agir?`;
            } else {
                autorizacaoLabel.textContent = 'Você precisa de autorização de ... para tomar decisões financeiras e agir?';
            }
            updateDynamicFormSections(); 
        });
        personEntry.querySelector('.remove-person-btn').addEventListener('click', (e) => {
            const idToRemove = e.target.dataset.id;
            const entryToRemove = pessoasList.querySelector(`.person-entry[data-id="${idToRemove}"]`);
            if (entryToRemove) entryToRemove.remove();
            updateDynamicFormSections(); 
        });
        updateDynamicFormSections(); 
    });

    const radioTemDependentesSim = document.getElementById("tem_dependentes_sim");
    const radioTemDependentesNao = document.getElementById("tem_dependentes_nao");
    const dependentesContainer = document.getElementById("dependentes-container");
    const addDependenteBtn = document.getElementById("add-dependente-btn");
    const dependentesList = document.getElementById("dependentes-list");

    radioTemDependentesSim.addEventListener('change', () => {
        if (radioTemDependentesSim.checked) dependentesContainer.style.display = 'block';
        updateDynamicFormSections();
    });
    radioTemDependentesNao.addEventListener('change', () => {
        if (radioTemDependentesNao.checked) {
            dependentesContainer.style.display = 'none';
            dependentesList.innerHTML = '';
        }
        updateDynamicFormSections();
    });

    addDependenteBtn.addEventListener('click', () => {
        const depId = Date.now();
        const depEntry = document.createElement('div');
        depEntry.classList.add('person-entry'); 
        depEntry.dataset.id = depId;
        depEntry.innerHTML = `
            <button type="button" class="remove-person-btn" data-id="${depId}">Remover</button>
            <label for="dep_nome_${depId}">Nome do Dependente:</label>
            <input type="text" id="dep_nome_${depId}" name="dep_nome" required>
            <label for="dep_idade_${depId}">Idade:</label>
            <input type="number" id="dep_idade_${depId}" name="dep_idade" min="0" required>
            <label for="dep_relacao_${depId}">Relação ( filho(a), pai, mãe, irmã(o), Pet, etc...):</label>
            <input type="text" id="dep_relacao_${depId}" name="dep_relacao" required>
        `;
        dependentesList.appendChild(depEntry);
        const nomeDependenteInput = depEntry.querySelector('input[name="dep_nome"]');
        nomeDependenteInput.addEventListener('input', updateDynamicFormSections);

        depEntry.querySelector('.remove-person-btn').addEventListener('click', (e) => {
            const idToRemove = e.target.dataset.id;
            const entryToRemove = dependentesList.querySelector(`.person-entry[data-id="${idToRemove}"]`);
            if (entryToRemove) entryToRemove.remove();
            updateDynamicFormSections();
        });
        updateDynamicFormSections();
    });

    updateDynamicFormSections(); // Chamada inicial para definir tudo

    const formElement = document.getElementById("client-response-form");
    if (formElement) {
        formElement.addEventListener("submit", (event) => handleFormSubmit(event, formData));
    }
}

// Função para lidar com o envio do formulário (AJUSTADO PARA PLANO DE SAÚDE)
async function handleFormSubmit(event, formData) {
    event.preventDefault();
    messageAreaEl.innerHTML = "";

    const nomeCompletoInput = document.getElementById("nome_completo");
    const rendaUnicaRadio = document.querySelector('input[name="renda_unica"]:checked');
    const temDependentesRadio = document.querySelector('input[name="tem_dependentes"]:checked');

    const nomeCompleto = sanitizeInput(nomeCompletoInput.value.trim());
    const rendaUnicaValue = rendaUnicaRadio ? rendaUnicaRadio.value : null;
    const temDependentesValue = temDependentesRadio ? temDependentesRadio.value : null;

    if (!nomeCompleto) {
        showMessage("error", "Por favor, preencha o Nome Completo."); return;
    }
    if (!rendaUnicaValue) {
        showMessage("error", "Por favor, selecione se você é a única pessoa com renda."); return;
    }
    if (!temDependentesValue) {
        showMessage("error", "Por favor, selecione se tem dependentes."); return;
    }

    const dadosFormulario = {
        nome_completo: nomeCompleto,
        renda_unica: rendaUnicaValue === 'sim',
        outras_pessoas_renda: [],
        tem_dependentes: temDependentesValue === 'sim',
        dependentes: [],
        informacoes_plano_saude: [] // Novo campo
    };

    if (dadosFormulario.renda_unica === false) {
        const personEntries = document.querySelectorAll('#pessoas-list .person-entry');
        for (const entry of personEntries) {
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            const autorizacaoSelect = entry.querySelector('select[name="pessoa_autorizacao"]');
            const nome = sanitizeInput(nomeInput.value.trim());
            const autorizacao = autorizacaoSelect.value;
            if (!nome || !autorizacao) {
                showMessage("error", "Por favor, preencha todos os campos para cada pessoa com renda ou remova a entrada incompleta."); return;
            }
            dadosFormulario.outras_pessoas_renda.push({
                nome: nome,
                precisa_autorizacao: autorizacao === 'sim'
            });
        }
    }

    if (dadosFormulario.tem_dependentes === true) {
        const depEntries = document.querySelectorAll('#dependentes-list .person-entry');
        for (const entry of depEntries) {
            const nomeInput = entry.querySelector('input[name="dep_nome"]');
            const idadeInput = entry.querySelector('input[name="dep_idade"]');
            const relacaoInput = entry.querySelector('input[name="dep_relacao"]');
            const nome = sanitizeInput(nomeInput.value.trim());
            const idade = idadeInput.value;
            const relacao = sanitizeInput(relacaoInput.value.trim());
            if (!nome || !idade || !relacao) {
                showMessage("error", "Por favor, preencha todos os campos para cada dependente ou remova a entrada incompleta."); return;
            }
            dadosFormulario.dependentes.push({
                nome: nome,
                idade: parseInt(idade),
                relacao: relacao
            });
        }
        if (dadosFormulario.dependentes.length === 0 && dadosFormulario.tem_dependentes === true) {
             showMessage("error", "Você indicou que tem dependentes. Por favor, adicione as informações ou marque 'Não'."); return;
        }
    }

    // Coleta de dados do plano de saúde
    const planoSaudeEntries = document.querySelectorAll("#plano-saude-section-content .plano-saude-entry");
    for (let i = 0; i < planoSaudeEntries.length; i++) {
        const entry = planoSaudeEntries[i];
        const personName = entry.dataset.personName; // Nome completo da pessoa
        const radioGroupName = `plano_saude_pessoa_${i}`;
        const selectedRadio = document.querySelector(`input[name="${radioGroupName}"]:checked`);
        if (!selectedRadio) {
            showMessage("error", `Por favor, informe se ${personName.split(' ')[0]} possui plano de saúde.`); return;
        }
        dadosFormulario.informacoes_plano_saude.push({
            nome_pessoa: personName,
            status_plano: selectedRadio.value
        });
    }

    try {
        const { error } = await supabase
            .from("formularios_clientes")
            .update({
                dados_formulario: dadosFormulario,
                status: "preenchido",
                data_preenchimento: new Date()
            })
            .eq("id", formData.id);

        if (error) throw error;

        formContentEl.innerHTML = "<p>Obrigado por preencher o formulário!</p>";
        showMessage("success", "Suas respostas foram enviadas com sucesso.");

    } catch (error) {
        console.error("Erro ao enviar formulário:", error);
        showMessage("error", `Erro ao enviar: ${error.message}`);
    }
}

// --- Inicialização ---
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token");
loadForm(token);


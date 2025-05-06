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

const formatCurrency = (value) => {
    if (value === null || value === undefined || value === "") return "";
    const number = parseFloat(String(value).replace(/[^\d.-]/g, 
        ''));
    if (isNaN(number)) return "";
    return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Função para capitalizar a primeira letra de cada palavra em um nome
const capitalizeName = (name) => {
    if (!name) return "";
    return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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

// Função para atualizar dinamicamente a pergunta sobre patrimônio físico
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


// Função para renderizar as perguntas sobre plano de saúde
function renderPlanoSaudeQuestions() {
    const container = document.getElementById("plano-saude-section-content");
    if (!container) return;
    container.innerHTML = ''; // Limpa perguntas anteriores

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
}

// Função para renderizar as perguntas sobre seguro de vida
function renderSeguroVidaQuestions() {
    const container = document.getElementById("seguro-vida-section-content");
    if (!container) return;
    container.innerHTML = ''; // Limpa perguntas anteriores

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
}


// Função unificada para atualizar seções dinâmicas
function updateDynamicFormSections() {
    updatePerguntaDependentesLabel();
    updatePerguntaPatrimonioFisicoLabel(); // Adiciona chamada para patrimônio
    renderPlanoSaudeQuestions();
    renderSeguroVidaQuestions();
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

// Função para renderizar o formulário HTML
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
                    <input type="radio" id="tem_patrimonio_sim" name="tem_patrimonio" value="sim" required>
                    <label for="tem_patrimonio_sim">Sim</label>
                    <input type="radio" id="tem_patrimonio_nao" name="tem_patrimonio" value="nao">
                    <label for="tem_patrimonio_nao">Não</label>
                </div>
                <div id="patrimonio-list-container" style="display: none; margin-top: 1rem;">
                    <label>Patrimônios Físicos:</label>
                    <div id="patrimonio-list"></div>
                    <button type="button" id="add-patrimonio-btn" style="margin-top: 0.5rem;">+ Adicionar Patrimônio</button>
                </div>
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
            <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px;">
                <button type="button" class="remove-person-btn" data-id="${personId}" style="float: right;">Remover</button>
                <label for="pessoa_nome_${personId}">Nome:</label>
                <input type="text" id="pessoa_nome_${personId}" name="pessoa_nome" required style="width: calc(100% - 22px); margin-bottom: 5px;">
                <label for="pessoa_autorizacao_${personId}" id="label_autorizacao_${personId}">Você precisa de autorização de ... para tomar decisões financeiras e agir?</label>
                <select id="pessoa_autorizacao_${personId}" name="pessoa_autorizacao" required style="width: 100%; margin-bottom: 5px;">
                    <option value="">Selecione...</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                </select>
            </div>
        `;
        pessoasList.appendChild(personEntry);
        const nomeInputPessoa = personEntry.querySelector(`#pessoa_nome_${personId}`);
        const autorizacaoLabel = personEntry.querySelector(`#label_autorizacao_${personId}`);
        
        nomeInputPessoa.addEventListener('input', () => {
            const nomeDigitado = nomeInputPessoa.value.trim();
            const primeiroNome = nomeDigitado.split(' ')[0];
            if (primeiroNome) {
                autorizacaoLabel.textContent = `Você precisa de autorização de ${capitalizeName(sanitizeInput(primeiroNome))} para tomar decisões financeiras e agir?`;
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
            <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px;">
                <button type="button" class="remove-person-btn" data-id="${depId}" style="float: right;">Remover</button>
                <label for="dep_nome_${depId}">Nome do Dependente:</label>
                <input type="text" id="dep_nome_${depId}" name="dep_nome" required style="width: calc(100% - 22px); margin-bottom: 5px;">
                <label for="dep_idade_${depId}">Idade:</label>
                <input type="number" id="dep_idade_${depId}" name="dep_idade" min="0" required style="width: 100%; margin-bottom: 5px;">
                <label for="dep_relacao_${depId}">Relação ( filho(a), pai, mãe, irmã(o), Pet, etc...):</label>
                <input type="text" id="dep_relacao_${depId}" name="dep_relacao" required style="width: 100%; margin-bottom: 5px;">
            </div>
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

    // Lógica para Patrimônio Físico
    const radioTemPatrimonioSim = document.getElementById("tem_patrimonio_sim");
    const radioTemPatrimonioNao = document.getElementById("tem_patrimonio_nao");
    const patrimonioListContainer = document.getElementById("patrimonio-list-container");
    const addPatrimonioBtn = document.getElementById("add-patrimonio-btn");
    const patrimonioList = document.getElementById("patrimonio-list");

    radioTemPatrimonioSim.addEventListener('change', () => {
        if (radioTemPatrimonioSim.checked) {
            patrimonioListContainer.style.display = 'block';
        }
        updateDynamicFormSections();
    });
    radioTemPatrimonioNao.addEventListener('change', () => {
        if (radioTemPatrimonioNao.checked) {
            patrimonioListContainer.style.display = 'none';
            patrimonioList.innerHTML = '';
        }
        updateDynamicFormSections();
    });

    addPatrimonioBtn.addEventListener('click', () => {
        const patId = Date.now();
        const patEntry = document.createElement('div');
        patEntry.classList.add('patrimonio-entry'); 
        patEntry.dataset.id = patId;
        patEntry.style.border = "1px solid #ccc";
        patEntry.style.padding = "10px";
        patEntry.style.marginBottom = "10px";

        patEntry.innerHTML = `
            <button type="button" class="remove-patrimonio-btn" data-id="${patId}" style="float: right;">Remover</button>
            <label for="pat_descricao_${patId}">Qual é o patrimônio? (ex: Apartamento 50m2, Corolla 2020, etc...)</label>
            <input type="text" id="pat_descricao_${patId}" name="pat_descricao" required style="width: calc(100% - 22px); margin-bottom: 5px;">
            
            <label for="pat_valor_${patId}">Quanto vale o patrimônio?</label>
            <input type="text" id="pat_valor_${patId}" name="pat_valor" required placeholder="R$ 0,00" style="width: 100%; margin-bottom: 5px;">
            
            <label>O patrimônio possui Seguro?</label>
            <div class="radio-options-inline" style="display: flex; align-items: center; margin-bottom: 5px;">
                <span style="margin-right: 20px; display: flex; align-items: center;">
                    <input type="radio" id="pat_seguro_sim_${patId}" name="pat_seguro_${patId}" value="sim" required style="margin-right: 5px;">
                    <label for="pat_seguro_sim_${patId}">Sim</label>
                </span>
                <span style="display: flex; align-items: center;">
                    <input type="radio" id="pat_seguro_nao_${patId}" name="pat_seguro_${patId}" value="nao" style="margin-right: 5px;">
                    <label for="pat_seguro_nao_${patId}">Não</label>
                </span>
            </div>

            <label>O patrimônio está quitado?</label>
            <div class="radio-options-inline" style="display: flex; align-items: center; margin-bottom: 5px;">
                <span style="margin-right: 20px; display: flex; align-items: center;">
                    <input type="radio" id="pat_quitado_sim_${patId}" name="pat_quitado_${patId}" value="sim" required style="margin-right: 5px;">
                    <label for="pat_quitado_sim_${patId}">Sim</label>
                </span>
                <span style="display: flex; align-items: center;">
                    <input type="radio" id="pat_quitado_nao_${patId}" name="pat_quitado_${patId}" value="nao" style="margin-right: 5px;">
                    <label for="pat_quitado_nao_${patId}">Não</label>
                </span>
            </div>
        `;
        patrimonioList.appendChild(patEntry);

        const valorInput = patEntry.querySelector(`#pat_valor_${patId}`);
        valorInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value) {
                value = (parseFloat(value) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }
            e.target.value = value;
        });

        patEntry.querySelector('.remove-patrimonio-btn').addEventListener('click', (e) => {
            const idToRemove = e.target.dataset.id;
            const entryToRemove = patrimonioList.querySelector(`.patrimonio-entry[data-id="${idToRemove}"]`);
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

// Função para lidar com o envio do formulário
async function handleFormSubmit(event, formData) {
    event.preventDefault();
    messageAreaEl.innerHTML = "";

    const nomeCompletoInput = document.getElementById("nome_completo");
    const rendaUnicaRadio = document.querySelector('input[name="renda_unica"]:checked');
    const temDependentesRadio = document.querySelector('input[name="tem_dependentes"]:checked');
    const temPatrimonioRadio = document.querySelector('input[name="tem_patrimonio"]:checked');

    const nomeCompleto = sanitizeInput(nomeCompletoInput.value.trim());
    const rendaUnicaValue = rendaUnicaRadio ? rendaUnicaRadio.value : null;
    const temDependentesValue = temDependentesRadio ? temDependentesRadio.value : null;
    const temPatrimonioValue = temPatrimonioRadio ? temPatrimonioRadio.value : null;

    if (!nomeCompleto) {
        showMessage("error", "Por favor, preencha o Nome Completo."); return;
    }
    if (!rendaUnicaValue) {
        showMessage("error", "Por favor, selecione se você é a única pessoa com renda."); return;
    }
    if (!temDependentesValue) {
        showMessage("error", "Por favor, selecione se tem dependentes."); return;
    }
    if (!temPatrimonioValue) {
        showMessage("error", "Por favor, selecione se possui patrimônio físico."); return;
    }

    const dadosFormulario = {
        nome_completo: nomeCompleto,
        renda_unica: rendaUnicaValue === "sim",
        outras_pessoas_renda: [],
        tem_dependentes: temDependentesValue === "sim",
        dependentes: [],
        informacoes_plano_saude: [],
        informacoes_seguro_vida: [],
        possui_patrimonio_fisico: temPatrimonioValue === "sim",
        patrimonios_fisicos: []
    };

    if (dadosFormulario.renda_unica === false) {
        document.querySelectorAll("#pessoas-list .person-entry").forEach(entry => {
            const nome = entry.querySelector('input[name="pessoa_nome"]').value.trim();
            const autorizacao = entry.querySelector('select[name="pessoa_autorizacao"]').value;
            if (nome) {
                dadosFormulario.outras_pessoas_renda.push({
                    nome: sanitizeInput(nome),
                    precisa_autorizacao: autorizacao === "sim"
                });
            }
        });
    }

    if (dadosFormulario.tem_dependentes === true) {
        document.querySelectorAll("#dependentes-list .person-entry").forEach(entry => {
            const nome = entry.querySelector('input[name="dep_nome"]').value.trim();
            const idade = entry.querySelector('input[name="dep_idade"]').value;
            const relacao = entry.querySelector('input[name="dep_relacao"]').value.trim();
            if (nome) {
                dadosFormulario.dependentes.push({
                    nome: sanitizeInput(nome),
                    idade: idade ? parseInt(idade) : null,
                    relacao: sanitizeInput(relacao)
                });
            }
        });
    }

    // Coleta de dados do plano de saúde
    document.querySelectorAll("#plano-saude-section-content .plano-saude-entry").forEach(entry => {
        const nomePessoa = entry.dataset.personName;
        const radioChecked = entry.querySelector('input[type="radio"]:checked');
        if (nomePessoa && radioChecked) {
            dadosFormulario.informacoes_plano_saude.push({
                nome_pessoa: sanitizeInput(nomePessoa),
                status_plano: radioChecked.value,
                tipo_pessoa: entry.dataset.personType
            });
        }
    });

    // Coleta de dados do seguro de vida
    document.querySelectorAll("#seguro-vida-section-content .seguro-vida-entry").forEach(entry => {
        const nomePessoa = entry.dataset.personName;
        const radioChecked = entry.querySelector('input[type="radio"]:checked');
        if (nomePessoa && radioChecked) {
            dadosFormulario.informacoes_seguro_vida.push({
                nome_pessoa: sanitizeInput(nomePessoa),
                status_seguro: radioChecked.value,
                tipo_pessoa: entry.dataset.personType
            });
        }
    });

    // Coleta de dados do Patrimônio Físico
    if (dadosFormulario.possui_patrimonio_fisico === true) {
        document.querySelectorAll("#patrimonio-list .patrimonio-entry").forEach(entry => {
            const descricao = entry.querySelector('input[name="pat_descricao"]').value.trim();
            const valorRaw = entry.querySelector('input[name="pat_valor"]').value;
            const valorNumerico = parseFloat(String(valorRaw).replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.'));
            const seguroRadio = entry.querySelector(`input[name^="pat_seguro"]:checked`);
            const quitadoRadio = entry.querySelector(`input[name^="pat_quitado"]:checked`);

            if (descricao) {
                dadosFormulario.patrimonios_fisicos.push({
                    descricao: sanitizeInput(descricao),
                    valor: !isNaN(valorNumerico) ? valorNumerico : null,
                    possui_seguro: seguroRadio ? seguroRadio.value === "sim" : null,
                    esta_quitado: quitadoRadio ? quitadoRadio.value === "sim" : null
                });
            }
        });
    }

    console.log("DEBUG: Dados a serem enviados:", dadosFormulario);

    try {
        const { error } = await supabase
            .from("formularios_clientes")
            .update({
                dados_formulario: dadosFormulario,
                status: "preenchido",
                data_preenchimento: new Date().toISOString(),
            })
            .eq("id", formData.id);

        if (error) throw error;

        formContentEl.innerHTML = "<p>Resposta enviada com sucesso!</p>";
        showMessage("success", "Obrigado por preencher o formulário.");

    } catch (error) {
        console.error("Erro ao enviar formulário:", error);
        showMessage("error", `Erro ao enviar: ${error.message}. Tente novamente.`);
    }
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    loadForm(token);
});


// formulario-cliente.js
import { supabase } from "./supabase.js";

// --- Elementos DOM ---
const formContentEl = document.getElementById("form-content");
const messageAreaEl = document.getElementById("message-area");
const formTitleEl = document.getElementById("form-title");

// --- Estado para preservar seleções ---
let planoSaudeSelections = {};
let seguroVidaSelections = {};
let impostoRendaSelections = {}; // Novo estado para Imposto de Renda

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

// --- Funções para a seção de Imposto de Renda (INÍCIO) ---
function saveImpostoRendaSelections() {
    const container = document.getElementById("imposto-renda-section-content");
    if (!container) return;
    impostoRendaSelections = {};
    container.querySelectorAll(".imposto-renda-entry").forEach(entry => {
        const personId = entry.dataset.personId;
        if (!personId) return;

        impostoRendaSelections[personId] = {};

        const declaraIRRadio = entry.querySelector(`input[name="declara_ir_${personId}"]:checked`);
        if (declaraIRRadio) {
            impostoRendaSelections[personId].declara_ir = declaraIRRadio.value;
        }

        const tipoDeclaracaoRadio = entry.querySelector(`input[name="tipo_declaracao_ir_${personId}"]:checked`);
        if (tipoDeclaracaoRadio) {
            impostoRendaSelections[personId].tipo_declaracao = tipoDeclaracaoRadio.value;
        }

        const resultadoDeclaracaoRadio = entry.querySelector(`input[name="resultado_declaracao_ir_${personId}"]:checked`);
        if (resultadoDeclaracaoRadio) {
            impostoRendaSelections[personId].resultado_declaracao = resultadoDeclaracaoRadio.value;
        }
    });
}

function restoreImpostoRendaSelections() {
    Object.keys(impostoRendaSelections).forEach(personId => {
        const selections = impostoRendaSelections[personId];
        if (selections.declara_ir) {
            const radioToSelect = document.querySelector(`input[name="declara_ir_${personId}"][value="${selections.declara_ir}"]`);
            if (radioToSelect) {
                radioToSelect.checked = true;
                // Disparar o evento change para mostrar/ocultar campos dependentes
                const event = new Event('change', { bubbles: true });
                radioToSelect.dispatchEvent(event);
            }
        }
        if (selections.tipo_declaracao) {
            const radioToSelect = document.querySelector(`input[name="tipo_declaracao_ir_${personId}"][value="${selections.tipo_declaracao}"]`);
            if (radioToSelect) radioToSelect.checked = true;
        }
        if (selections.resultado_declaracao) {
            const radioToSelect = document.querySelector(`input[name="resultado_declaracao_ir_${personId}"][value="${selections.resultado_declaracao}"]`);
            if (radioToSelect) radioToSelect.checked = true;
        }
    });
}

function renderImpostoRendaQuestions() {
    saveImpostoRendaSelections();
    const container = document.getElementById("imposto-renda-section-content");
    if (!container) return;
    container.innerHTML = ''; // Limpa o conteúdo anterior

    const pessoasComRenda = [];
    const nomeCompletoInput = document.getElementById("nome_completo");

    // Adiciona a pessoa que está preenchendo o formulário, se tiver nome
    if (nomeCompletoInput && nomeCompletoInput.value.trim() !== "") {
        pessoasComRenda.push({ 
            id: "preenchedor_ir", 
            nome: sanitizeInput(nomeCompletoInput.value.trim()), 
            tipo: "preenchedor" 
        });
    }

    // Adiciona outras pessoas com renda, se houver
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach((entry, index) => {
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasComRenda.push({ 
                    id: `outra_pessoa_ir_${index}`, 
                    nome: sanitizeInput(nomeInput.value.trim()), 
                    tipo: "outra_pessoa_renda" 
                });
            }
        });
    }

    const tituloImpostoRenda = document.getElementById("imposto-renda-section-title");
    if (pessoasComRenda.length === 0) {
        container.innerHTML = "<p>Preencha as informações sobre nome e renda para definir as perguntas sobre Imposto de Renda.</p>";
        if(tituloImpostoRenda) tituloImpostoRenda.style.display = 'none';
        return;
    }
    if(tituloImpostoRenda) tituloImpostoRenda.style.display = 'block';

    pessoasComRenda.forEach((pessoa) => {
        const primeiroNome = pessoa.nome.split(' ')[0];
        const nomeCapitalizado = capitalizeName(primeiroNome);
        const personId = pessoa.id; // Usar o ID já definido para a pessoa

        const entryDiv = document.createElement("div");
        entryDiv.classList.add("imposto-renda-entry", "dynamic-entry-item"); // Adicionada classe dynamic-entry-item
        entryDiv.style.marginBottom = "1.5rem";
        entryDiv.dataset.personId = personId; // Armazena o ID da pessoa para fácil recuperação
        entryDiv.dataset.personName = pessoa.nome;
        entryDiv.dataset.personType = pessoa.tipo;

        entryDiv.innerHTML = `
            <h4 style="color: var(--theme-text-light); margin-bottom: 0.8rem;">Imposto de Renda de ${nomeCapitalizado}</h4>
            
            <label for="declara_ir_${personId}" style="display: block; margin-bottom: 0.5rem;">${nomeCapitalizado} declara Imposto de Renda?</label>
            <div class="radio-group" style="margin-bottom: 1rem;">
                <label><input type="radio" name="declara_ir_${personId}" value="sim" onchange="toggleIRFields('${personId}', this.value)"> Sim</label>
                <label><input type="radio" name="declara_ir_${personId}" value="nao" onchange="toggleIRFields('${personId}', this.value)"> Não</label>
                <label><input type="radio" name="declara_ir_${personId}" value="nao_sabe" onchange="toggleIRFields('${personId}', this.value)"> Não sabe informar</label>
            </div>

            <div id="ir_fields_${personId}" style="display: none; margin-top: 1rem; padding-left: 1rem; border-left: 2px solid var(--theme-border-color);">
                <label for="tipo_declaracao_ir_${personId}" style="display: block; margin-bottom: 0.5rem;">Qual o tipo da declaração de ${nomeCapitalizado}?</label>
                <div class="radio-group" style="margin-bottom: 1rem;">
                    <label><input type="radio" name="tipo_declaracao_ir_${personId}" value="simples"> Simples</label>
                    <label><input type="radio" name="tipo_declaracao_ir_${personId}" value="completa"> Completa</label>
                    <label><input type="radio" name="tipo_declaracao_ir_${personId}" value="nao_sabe"> Não sabe informar</label>
                </div>

                <label for="resultado_declaracao_ir_${personId}" style="display: block; margin-bottom: 0.5rem;">Qual o resultado da declaração de ${nomeCapitalizado}?</label>
                <div class="radio-group">
                    <label><input type="radio" name="resultado_declaracao_ir_${personId}" value="paga"> Paga imposto</label>
                    <label><input type="radio" name="resultado_declaracao_ir_${personId}" value="restitui"> Restitui imposto</label>
                    <label><input type="radio" name="resultado_declaracao_ir_${personId}" value="isento"> Isento</label>
                    <label><input type="radio" name="resultado_declaracao_ir_${personId}" value="nao_sabe"> Não sabe informar</label>
                </div>
            </div>
        `;
        container.appendChild(entryDiv);
    });
    restoreImpostoRendaSelections();
}

// Função global para ser chamada pelo onchange no HTML
window.toggleIRFields = function(personId, declaraIRValue) {
    const fieldsDiv = document.getElementById(`ir_fields_${personId}`);
    if (fieldsDiv) {
        if (declaraIRValue === 'sim') {
            fieldsDiv.style.display = 'block';
        } else {
            fieldsDiv.style.display = 'none';
            // Limpar seleções dos campos dependentes se não declara IR ou não sabe
            const tipoRadios = document.querySelectorAll(`input[name="tipo_declaracao_ir_${personId}"]`);
            tipoRadios.forEach(radio => radio.checked = false);
            const resultadoRadios = document.querySelectorAll(`input[name="resultado_declaracao_ir_${personId}"]`);
            resultadoRadios.forEach(radio => radio.checked = false);
        }
    }
}
// --- Funções para a seção de Imposto de Renda (FIM) ---

function updateDynamicFormSections() {
    updatePerguntaDependentesLabel();
    updatePerguntaPatrimonioFisicoLabel();
    updatePerguntaPatrimonioLiquidoLabel();
    updatePerguntaDividasLabel(); 
    renderPlanoSaudeQuestions();
    renderSeguroVidaQuestions();
    renderImpostoRendaQuestions(); // Adicionada chamada para renderizar IR
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
                formContentEl.innerHTML = "<p>Erro ao carregar o formulário.</p>";
                showMessage("error", formError ? formError.message : "Formulário não encontrado.");
            }
            return;
        }

        if (formData.status === 'preenchido') {
            formTitleEl.textContent = `Resumo do Formulário de ${sanitizeInput(formData.clientes.nome)}`;
            displaySummary(formData.dados_formulario, formData.clientes.nome);
            return;
        }

        formTitleEl.textContent = `Formulário de ${sanitizeInput(formData.clientes.nome)}`;
        renderFormFields(formData.cliente_id, formData.token_unico, formData.dados_formulario || {}); 

    } catch (error) {
        console.error("Erro ao carregar formulário:", error);
        formContentEl.innerHTML = "<p>Ocorreu um erro inesperado.</p>";
        showMessage("error", "Erro ao conectar com o servidor. Tente novamente mais tarde.");
    }
}

function renderFormFields(clienteId, token, existingData = {}) {
    formContentEl.innerHTML = `
        <form id="cliente-form">
            <input type="hidden" id="cliente_id" value="${clienteId}">
            <input type="hidden" id="token_unico" value="${token}">

            <label for="nome_completo">Seu nome completo:</label>
            <input type="text" id="nome_completo" name="nome_completo" value="${sanitizeInput(existingData.nome_completo || '')}" required>

            <label for="data_nascimento">Sua data de nascimento:</label>
            <input type="date" id="data_nascimento" name="data_nascimento" value="${sanitizeInput(existingData.data_nascimento || '')}" required style="padding: 0.8rem; width: 100%; margin-bottom: 1.5rem; border: 1px solid var(--theme-border-color); border-radius: 4px; background-color: var(--theme-bg-dark); color: var(--theme-text-light); box-sizing: border-box;">

            <label for="cpf">Seu CPF:</label>
            <input type="text" id="cpf" name="cpf" value="${sanitizeInput(existingData.cpf || '')}" required>

            <label for="profissao">Sua profissão:</label>
            <input type="text" id="profissao" name="profissao" value="${sanitizeInput(existingData.profissao || '')}" required>

            <label for="renda_mensal">Sua renda mensal (aproximada):</label>
            <input type="text" id="renda_mensal" name="renda_mensal" inputmode="numeric" value="${formatCurrency(existingData.renda_mensal)}" required>
            
            <label>A renda da casa é apenas a sua?</label>
            <div class="radio-group">
                <label><input type="radio" id="renda_unica_sim" name="renda_unica" value="sim" ${existingData.renda_unica === 'sim' ? 'checked' : ''} required> Sim</label>
                <label><input type="radio" id="renda_unica_nao" name="renda_unica" value="nao" ${existingData.renda_unica === 'nao' ? 'checked' : ''}> Não</label>
            </div>

            <div id="outras-pessoas-renda-section" style="display: ${existingData.renda_unica === 'nao' ? 'block' : 'none'}; margin-bottom: 1.5rem; border-top: 1px solid var(--theme-border-color); padding-top: 1rem;">
                <h3 style="color: var(--theme-secondary-lighter); margin-bottom: 1rem; text-align: left;">Outras Pessoas com Renda na Casa</h3>
                <div id="pessoas-list"></div>
                <button type="button" id="add-pessoa-btn" class="add-dynamic-entry-btn">Adicionar Pessoa com Renda</button>
            </div>
            
            <label id="label_tem_dependentes">Você tem filho/pet/outros parentes que dependem de você?</label>
            <div class="radio-group">
                <label><input type="radio" id="tem_dependentes_sim" name="tem_dependentes" value="sim" ${existingData.tem_dependentes === 'sim' ? 'checked' : ''} required> Sim</label>
                <label><input type="radio" id="tem_dependentes_nao" name="tem_dependentes" value="nao" ${existingData.tem_dependentes === 'nao' ? 'checked' : ''}> Não</label>
            </div>

            <div id="dependentes-section" style="display: ${existingData.tem_dependentes === 'sim' ? 'block' : 'none'}; margin-bottom: 1.5rem; border-top: 1px solid var(--theme-border-color); padding-top: 1rem;">
                <h3 style="color: var(--theme-secondary-lighter); margin-bottom: 1rem; text-align: left;">Dependentes</h3>
                <div id="dependentes-list"></div>
                <button type="button" id="add-dependente-btn" class="add-dynamic-entry-btn">Adicionar Dependente</button>
            </div>

            <!-- Seção Plano de Saúde -->
            <div id="plano-saude-section" style="margin-top: 2rem; border-top: 1px solid var(--theme-border-color); padding-top: 1.5rem;">
                <h3 id="plano-saude-section-title" style="color: var(--theme-secondary-lighter); margin-bottom: 1rem; text-align: left; display: none;">Plano de Saúde</h3>
                <div id="plano-saude-section-content">
                    <p>Preencha as informações anteriores para definir as perguntas sobre plano de saúde.</p>
                </div>
            </div>

            <!-- Seção Seguro de Vida -->
            <div id="seguro-vida-section" style="margin-top: 2rem; border-top: 1px solid var(--theme-border-color); padding-top: 1.5rem;">
                <h3 id="seguro-vida-section-title" style="color: var(--theme-secondary-lighter); margin-bottom: 1rem; text-align: left; display: none;">Seguro de Vida</h3>
                <div id="seguro-vida-section-content">
                    <p>Preencha as informações sobre nome e renda para definir as perguntas sobre seguro de vida.</p>
                </div>
            </div>

            <!-- Seção Imposto de Renda (NOVA SEÇÃO) -->
            <div id="imposto-renda-section" style="margin-top: 2rem; border-top: 1px solid var(--theme-border-color); padding-top: 1.5rem;">
                <h3 id="imposto-renda-section-title" style="color: var(--theme-secondary-lighter); margin-bottom: 1rem; text-align: left; display: none;">Imposto de Renda</h3>
                <div id="imposto-renda-section-content">
                    <p>Preencha as informações sobre nome e renda para definir as perguntas sobre Imposto de Renda.</p>
                </div>
            </div>

            <label id="label_tem_patrimonio_fisico" style="margin-top: 2rem;">Você possui patrimônio físico (imóvel, automóvel, jóias, outros...)?</label>
            <div class="radio-group">
                <label><input type="radio" id="tem_patrimonio_fisico_sim" name="tem_patrimonio_fisico" value="sim" ${existingData.tem_patrimonio_fisico === 'sim' ? 'checked' : ''} required> Sim</label>
                <label><input type="radio" id="tem_patrimonio_fisico_nao" name="tem_patrimonio_fisico" value="nao" ${existingData.tem_patrimonio_fisico === 'nao' ? 'checked' : ''}> Não</label>
            </div>

            <div id="patrimonio-fisico-section" style="display: ${existingData.tem_patrimonio_fisico === 'sim' ? 'block' : 'none'}; margin-bottom: 1.5rem; border-top: 1px solid var(--theme-border-color); padding-top: 1rem;">
                <h3 style="color: var(--theme-secondary-lighter); margin-bottom: 1rem; text-align: left;">Patrimônio Físico</h3>
                <div id="patrimonio-fisico-list"></div>
                <button type="button" id="add-patrimonio-fisico-btn" class="add-dynamic-entry-btn">Adicionar Patrimônio Físico</button>
            </div>
            
            <label id="label_tem_patrimonio_liquido">Você possui Dinheiro Guardado ou Investido?</label>
            <div class="radio-group">
                <label><input type="radio" id="tem_patrimonio_liquido_sim" name="tem_patrimonio_liquido" value="sim" ${existingData.tem_patrimonio_liquido === 'sim' ? 'checked' : ''} required> Sim</label>
                <label><input type="radio" id="tem_patrimonio_liquido_nao" name="tem_patrimonio_liquido" value="nao" ${existingData.tem_patrimonio_liquido === 'nao' ? 'checked' : ''}> Não</label>
            </div>

            <div id="patrimonio-liquido-section" style="display: ${existingData.tem_patrimonio_liquido === 'sim' ? 'block' : 'none'}; margin-bottom: 1.5rem; border-top: 1px solid var(--theme-border-color); padding-top: 1rem;">
                <h3 style="color: var(--theme-secondary-lighter); margin-bottom: 1rem; text-align: left;">Patrimônio Líquido (Investimentos)</h3>
                <div id="patrimonio-liquido-list"></div>
                <button type="button" id="add-patrimonio-liquido-btn" class="add-dynamic-entry-btn">Adicionar Investimento</button>
            </div>

            <label id="label_tem_dividas">Você possui dívidas?</label>
            <div class="radio-group">
                <label><input type="radio" id="tem_dividas_sim" name="tem_dividas" value="sim" ${existingData.tem_dividas === 'sim' ? 'checked' : ''} required> Sim</label>
                <label><input type="radio" id="tem_dividas_nao" name="tem_dividas" value="nao" ${existingData.tem_dividas === 'nao' ? 'checked' : ''}> Não</label>
            </div>

            <div id="dividas-section" style="display: ${existingData.tem_dividas === 'sim' ? 'block' : 'none'}; margin-bottom: 1.5rem; border-top: 1px solid var(--theme-border-color); padding-top: 1rem;">
                <h3 style="color: var(--theme-secondary-lighter); margin-bottom: 1rem; text-align: left;">Dívidas</h3>
                <div id="dividas-list"></div>
                <button type="button" id="add-divida-btn" class="add-dynamic-entry-btn">Adicionar Dívida</button>
            </div>

            <button type="submit">Enviar Formulário</button>
        </form>
    `;

    // Event listeners e lógica de renderização dinâmica
    setupEventListeners(existingData);
    updateDynamicFormSections(); // Chama para renderizar seções dinâmicas inicialmente
    restoreExistingDynamicData(existingData);
}

function setupEventListeners(existingData) {
    const form = document.getElementById("cliente-form");
    form.addEventListener("submit", handleSubmitForm);

    // Listener para renda mensal (formatação de moeda)
    const rendaMensalInput = document.getElementById("renda_mensal");
    if (rendaMensalInput) {
        rendaMensalInput.addEventListener("input", (e) => {
            const value = parseCurrency(e.target.value);
            e.target.value = formatCurrency(value);
        });
        // Formatar ao carregar, caso haja valor existente
        if(existingData.renda_mensal) {
            rendaMensalInput.value = formatCurrency(existingData.renda_mensal);
        }
    }

    // Listeners para mostrar/ocultar seções dinâmicas
    document.getElementById("renda_unica_sim")?.addEventListener("change", toggleOutrasPessoasRenda);
    document.getElementById("renda_unica_nao")?.addEventListener("change", toggleOutrasPessoasRenda);
    document.getElementById("tem_dependentes_sim")?.addEventListener("change", toggleDependentes);
    document.getElementById("tem_dependentes_nao")?.addEventListener("change", toggleDependentes);
    document.getElementById("tem_patrimonio_fisico_sim")?.addEventListener("change", togglePatrimonioFisico);
    document.getElementById("tem_patrimonio_fisico_nao")?.addEventListener("change", togglePatrimonioFisico);
    document.getElementById("tem_patrimonio_liquido_sim")?.addEventListener("change", togglePatrimonioLiquido);
    document.getElementById("tem_patrimonio_liquido_nao")?.addEventListener("change", togglePatrimonioLiquido);
    document.getElementById("tem_dividas_sim")?.addEventListener("change", toggleDividas);
    document.getElementById("tem_dividas_nao")?.addEventListener("change", toggleDividas);

    // Listeners para botões de adicionar entradas dinâmicas
    document.getElementById("add-pessoa-btn")?.addEventListener("click", addPessoaRendaEntry);
    document.getElementById("add-dependente-btn")?.addEventListener("click", addDependenteEntry);
    document.getElementById("add-patrimonio-fisico-btn")?.addEventListener("click", addPatrimonioFisicoEntry);
    document.getElementById("add-patrimonio-liquido-btn")?.addEventListener("click", addPatrimonioLiquidoEntry);
    document.getElementById("add-divida-btn")?.addEventListener("click", addDividaEntry);

    // Listeners para atualizar seções dinâmicas quando nome ou renda mudam
    document.getElementById("nome_completo")?.addEventListener("input", updateDynamicFormSections);
    document.getElementById("renda_unica_sim")?.addEventListener("change", updateDynamicFormSections);
    document.getElementById("renda_unica_nao")?.addEventListener("change", updateDynamicFormSections);
    document.getElementById("tem_dependentes_sim")?.addEventListener("change", updateDynamicFormSections);
    document.getElementById("tem_dependentes_nao")?.addEventListener("change", updateDynamicFormSections);

    // Adicionar listeners para os campos de nome das outras pessoas com renda
    // Isso é feito dinamicamente em addPessoaRendaEntry
}

function restoreExistingDynamicData(existingData) {
    if (existingData.outras_pessoas_renda && existingData.outras_pessoas_renda.length > 0) {
        existingData.outras_pessoas_renda.forEach(pessoa => addPessoaRendaEntry(pessoa));
    }
    if (existingData.dependentes && existingData.dependentes.length > 0) {
        existingData.dependentes.forEach(dep => addDependenteEntry(dep));
    }
    if (existingData.patrimonio_fisico && existingData.patrimonio_fisico.length > 0) {
        existingData.patrimonio_fisico.forEach(item => addPatrimonioFisicoEntry(item));
    }
    if (existingData.patrimonio_liquido && existingData.patrimonio_liquido.length > 0) {
        existingData.patrimonio_liquido.forEach(item => addPatrimonioLiquidoEntry(item));
    }
    if (existingData.dividas && existingData.dividas.length > 0) {
        existingData.dividas.forEach(divida => addDividaEntry(divida));
    }
    // Restaurar seleções de plano de saúde, seguro de vida e IR se existirem nos dados carregados
    if (existingData.plano_saude_info) {
        planoSaudeSelections = existingData.plano_saude_info;
        restorePlanoSaudeSelections();
    }
    if (existingData.seguro_vida_info) {
        seguroVidaSelections = existingData.seguro_vida_info;
        restoreSeguroVidaSelections();
    }
    if (existingData.imposto_renda_info) { // Restaurar dados de IR
        impostoRendaSelections = existingData.imposto_renda_info;
        restoreImpostoRendaSelections();
    }
}

// --- Funções de Toggle para Seções --- 
function toggleOutrasPessoasRenda() {
    const section = document.getElementById("outras-pessoas-renda-section");
    if (document.getElementById("renda_unica_nao").checked) {
        section.style.display = "block";
    } else {
        section.style.display = "none";
        document.getElementById("pessoas-list").innerHTML = ''; // Limpa a lista se não aplicável
    }
    updateDynamicFormSections();
}

function toggleDependentes() {
    const section = document.getElementById("dependentes-section");
    if (document.getElementById("tem_dependentes_sim").checked) {
        section.style.display = "block";
    } else {
        section.style.display = "none";
        document.getElementById("dependentes-list").innerHTML = ''; // Limpa a lista
    }
    updateDynamicFormSections();
}

function togglePatrimonioFisico() {
    const section = document.getElementById("patrimonio-fisico-section");
    if (document.getElementById("tem_patrimonio_fisico_sim").checked) {
        section.style.display = "block";
    } else {
        section.style.display = "none";
        document.getElementById("patrimonio-fisico-list").innerHTML = '';
    }
    updateDynamicFormSections();
}

function togglePatrimonioLiquido() {
    const section = document.getElementById("patrimonio-liquido-section");
    if (document.getElementById("tem_patrimonio_liquido_sim").checked) {
        section.style.display = "block";
    } else {
        section.style.display = "none";
        document.getElementById("patrimonio-liquido-list").innerHTML = '';
    }
    updateDynamicFormSections();
}

function toggleDividas() {
    const section = document.getElementById("dividas-section");
    if (document.getElementById("tem_dividas_sim").checked) {
        section.style.display = "block";
    } else {
        section.style.display = "none";
        document.getElementById("dividas-list").innerHTML = '';
    }
    updateDynamicFormSections();
}

// --- Funções para Adicionar Entradas Dinâmicas ---
function addPessoaRendaEntry(pessoaData = {}) {
    const list = document.getElementById("pessoas-list");
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    const uniqueId = `pessoa_${list.children.length}`;
    entryDiv.innerHTML = `
        <label for="pessoa_nome_${uniqueId}">Nome da Pessoa:</label>
        <input type="text" id="pessoa_nome_${uniqueId}" name="pessoa_nome" value="${sanitizeInput(pessoaData.nome || '')}" required>
        <label for="pessoa_renda_${uniqueId}">Renda Mensal da Pessoa:</label>
        <input type="text" id="pessoa_renda_${uniqueId}" name="pessoa_renda" inputmode="numeric" value="${formatCurrency(pessoaData.renda_mensal)}" required>
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
    `;
    list.appendChild(entryDiv);
    entryDiv.querySelector(".remove-dynamic-entry-btn").addEventListener("click", function() { 
        this.closest(".dynamic-entry-item").remove(); 
        updateDynamicFormSections(); 
    });
    // Listener para renda da pessoa (formatação de moeda)
    const pessoaRendaInput = entryDiv.querySelector(`#pessoa_renda_${uniqueId}`);
    if (pessoaRendaInput) {
        pessoaRendaInput.addEventListener("input", (e) => {
            const value = parseCurrency(e.target.value);
            e.target.value = formatCurrency(value);
        });
        if(pessoaData.renda_mensal) {
            pessoaRendaInput.value = formatCurrency(pessoaData.renda_mensal);
        }
    }
    // Adicionar listener ao nome da pessoa para atualizar seções dinâmicas
    entryDiv.querySelector('input[name="pessoa_nome"]').addEventListener('input', updateDynamicFormSections);
    updateDynamicFormSections(); // Atualiza rótulos e seções dependentes
}

function addDependenteEntry(depData = {}) {
    const list = document.getElementById("dependentes-list");
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    const uniqueId = `dep_${list.children.length}`;
    entryDiv.innerHTML = `
        <label for="dep_nome_${uniqueId}">Nome do Dependente:</label>
        <input type="text" id="dep_nome_${uniqueId}" name="dep_nome" value="${sanitizeInput(depData.nome || '')}" required>
        <label for="dep_parentesco_${uniqueId}">Parentesco:</label>
        <input type="text" id="dep_parentesco_${uniqueId}" name="dep_parentesco" value="${sanitizeInput(depData.parentesco || '')}" required>
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
    `;
    list.appendChild(entryDiv);
    entryDiv.querySelector(".remove-dynamic-entry-btn").addEventListener("click", function() { 
        this.closest(".dynamic-entry-item").remove(); 
        updateDynamicFormSections(); 
    });
    // Adicionar listener ao nome do dependente para atualizar seções dinâmicas
    entryDiv.querySelector('input[name="dep_nome"]').addEventListener('input', updateDynamicFormSections);
    updateDynamicFormSections();
}

function addPatrimonioFisicoEntry(itemData = {}) {
    const list = document.getElementById("patrimonio-fisico-list");
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    const uniqueId = `pat_fisico_${list.children.length}`;
    entryDiv.innerHTML = `
        <label for="pat_fisico_descricao_${uniqueId}">Descrição do Patrimônio (ex: Casa, Carro Modelo X):</label>
        <input type="text" id="pat_fisico_descricao_${uniqueId}" name="pat_fisico_descricao" value="${sanitizeInput(itemData.descricao || '')}" required>
        <label for="pat_fisico_valor_${uniqueId}">Valor Estimado:</label>
        <input type="text" id="pat_fisico_valor_${uniqueId}" name="pat_fisico_valor" inputmode="numeric" value="${formatCurrency(itemData.valor_estimado)}" required>
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
    `;
    list.appendChild(entryDiv);
    entryDiv.querySelector(".remove-dynamic-entry-btn").addEventListener("click", function() { this.closest(".dynamic-entry-item").remove(); });
    const valorInput = entryDiv.querySelector(`#pat_fisico_valor_${uniqueId}`);
    if (valorInput) {
        valorInput.addEventListener("input", (e) => {
            const value = parseCurrency(e.target.value);
            e.target.value = formatCurrency(value);
        });
        if(itemData.valor_estimado) {
            valorInput.value = formatCurrency(itemData.valor_estimado);
        }
    }
}

function addPatrimonioLiquidoEntry(itemData = {}) {
    const list = document.getElementById("patrimonio-liquido-list");
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    const uniqueId = `pat_liquido_${list.children.length}`;
    entryDiv.innerHTML = `
        <label for="pat_liquido_tipo_${uniqueId}">Tipo de Investimento (ex: Poupança, CDB, Ações):</label>
        <input type="text" id="pat_liquido_tipo_${uniqueId}" name="pat_liquido_tipo" value="${sanitizeInput(itemData.tipo_investimento || '')}" required>
        <label for="pat_liquido_valor_${uniqueId}">Valor Investido:</label>
        <input type="text" id="pat_liquido_valor_${uniqueId}" name="pat_liquido_valor" inputmode="numeric" value="${formatCurrency(itemData.valor_investido)}" required>
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
    `;
    list.appendChild(entryDiv);
    entryDiv.querySelector(".remove-dynamic-entry-btn").addEventListener("click", function() { this.closest(".dynamic-entry-item").remove(); });
    const valorInput = entryDiv.querySelector(`#pat_liquido_valor_${uniqueId}`);
    if (valorInput) {
        valorInput.addEventListener("input", (e) => {
            const value = parseCurrency(e.target.value);
            e.target.value = formatCurrency(value);
        });
        if(itemData.valor_investido) {
            valorInput.value = formatCurrency(itemData.valor_investido);
        }
    }
}

function addDividaEntry(dividaData = {}) {
    const list = document.getElementById("dividas-list");
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    const uniqueId = `divida_${list.children.length}`;
    entryDiv.innerHTML = `
        <label for="divida_descricao_${uniqueId}">Descrição da Dívida (ex: Financiamento Imobiliário, Cartão de Crédito):</label>
        <input type="text" id="divida_descricao_${uniqueId}" name="divida_descricao" value="${sanitizeInput(dividaData.descricao || '')}" required>
        <label for="divida_saldo_devedor_${uniqueId}">Saldo Devedor:</label>
        <input type="text" id="divida_saldo_devedor_${uniqueId}" name="divida_saldo_devedor" inputmode="numeric" value="${formatCurrency(dividaData.saldo_devedor)}" required>
        <label for="divida_prestacao_mensal_${uniqueId}">Prestação Mensal:</label>
        <input type="text" id="divida_prestacao_mensal_${uniqueId}" name="divida_prestacao_mensal" inputmode="numeric" value="${formatCurrency(dividaData.prestacao_mensal)}" required>
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
    `;
    list.appendChild(entryDiv);
    entryDiv.querySelector(".remove-dynamic-entry-btn").addEventListener("click", function() { this.closest(".dynamic-entry-item").remove(); });
    
    const saldoInput = entryDiv.querySelector(`#divida_saldo_devedor_${uniqueId}`);
    if (saldoInput) {
        saldoInput.addEventListener("input", (e) => {
            const value = parseCurrency(e.target.value);
            e.target.value = formatCurrency(value);
        });
        if(dividaData.saldo_devedor) {
            saldoInput.value = formatCurrency(dividaData.saldo_devedor);
        }
    }
    const prestacaoInput = entryDiv.querySelector(`#divida_prestacao_mensal_${uniqueId}`);
    if (prestacaoInput) {
        prestacaoInput.addEventListener("input", (e) => {
            const value = parseCurrency(e.target.value);
            e.target.value = formatCurrency(value);
        });
        if(dividaData.prestacao_mensal) {
            prestacaoInput.value = formatCurrency(dividaData.prestacao_mensal);
        }
    }
}

// --- Submissão do Formulário ---
async function handleSubmitForm(event) {
    event.preventDefault();
    showMessage("success", "Enviando dados..."); 

    const dadosFormulario = {
        cliente_id: document.getElementById("cliente_id").value,
        token_unico: document.getElementById("token_unico").value,
        nome_completo: document.getElementById("nome_completo").value,
        data_nascimento: document.getElementById("data_nascimento").value,
        cpf: document.getElementById("cpf").value,
        profissao: document.getElementById("profissao").value,
        renda_mensal: parseCurrency(document.getElementById("renda_mensal").value),
        renda_unica: document.querySelector('input[name="renda_unica"]:checked')?.value,
        tem_dependentes: document.querySelector('input[name="tem_dependentes"]:checked')?.value,
        tem_patrimonio_fisico: document.querySelector('input[name="tem_patrimonio_fisico"]:checked')?.value,
        tem_patrimonio_liquido: document.querySelector('input[name="tem_patrimonio_liquido"]:checked')?.value,
        tem_dividas: document.querySelector('input[name="tem_dividas"]:checked')?.value,
        outras_pessoas_renda: [],
        dependentes: [],
        patrimonio_fisico: [],
        patrimonio_liquido: [],
        dividas: [],
        plano_saude_info: {},
        seguro_vida_info: {},
        imposto_renda_info: {} // Novo campo para dados de IR
    };

    // Coletar dados de outras pessoas com renda
    if (dadosFormulario.renda_unica === 'nao') {
        document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach(item => {
            dadosFormulario.outras_pessoas_renda.push({
                nome: item.querySelector('input[name="pessoa_nome"]').value,
                renda_mensal: parseCurrency(item.querySelector('input[name="pessoa_renda"]').value)
            });
        });
    }

    // Coletar dados de dependentes
    if (dadosFormulario.tem_dependentes === 'sim') {
        document.querySelectorAll("#dependentes-list .dynamic-entry-item").forEach(item => {
            dadosFormulario.dependentes.push({
                nome: item.querySelector('input[name="dep_nome"]').value,
                parentesco: item.querySelector('input[name="dep_parentesco"]').value
            });
        });
    }

    // Coletar dados de patrimônio físico
    if (dadosFormulario.tem_patrimonio_fisico === 'sim') {
        document.querySelectorAll("#patrimonio-fisico-list .dynamic-entry-item").forEach(item => {
            dadosFormulario.patrimonio_fisico.push({
                descricao: item.querySelector('input[name="pat_fisico_descricao"]').value,
                valor_estimado: parseCurrency(item.querySelector('input[name="pat_fisico_valor"]').value)
            });
        });
    }

    // Coletar dados de patrimônio líquido
    if (dadosFormulario.tem_patrimonio_liquido === 'sim') {
        document.querySelectorAll("#patrimonio-liquido-list .dynamic-entry-item").forEach(item => {
            dadosFormulario.patrimonio_liquido.push({
                tipo_investimento: item.querySelector('input[name="pat_liquido_tipo"]').value,
                valor_investido: parseCurrency(item.querySelector('input[name="pat_liquido_valor"]').value)
            });
        });
    }

    // Coletar dados de dívidas
    if (dadosFormulario.tem_dividas === 'sim') {
        document.querySelectorAll("#dividas-list .dynamic-entry-item").forEach(item => {
            dadosFormulario.dividas.push({
                descricao: item.querySelector('input[name="divida_descricao"]').value,
                saldo_devedor: parseCurrency(item.querySelector('input[name="divida_saldo_devedor"]').value),
                prestacao_mensal: parseCurrency(item.querySelector('input[name="divida_prestacao_mensal"]').value)
            });
        });
    }

    // Coletar dados de Plano de Saúde
    savePlanoSaudeSelections(); // Garante que as últimas seleções estão no estado
    dadosFormulario.plano_saude_info = planoSaudeSelections;

    // Coletar dados de Seguro de Vida
    saveSeguroVidaSelections(); // Garante que as últimas seleções estão no estado
    dadosFormulario.seguro_vida_info = seguroVidaSelections;

    // Coletar dados de Imposto de Renda (NOVO)
    saveImpostoRendaSelections(); // Garante que as últimas seleções estão no estado
    const impostoRendaDataColetada = [];
    document.querySelectorAll(".imposto-renda-entry").forEach(entry => {
        const personId = entry.dataset.personId;
        const personName = entry.dataset.personName;
        const personType = entry.dataset.personType;

        const declaraIR = entry.querySelector(`input[name="declara_ir_${personId}"]:checked`)?.value || null;
        let tipoDeclaracao = null;
        let resultadoDeclaracao = null;

        if (declaraIR === 'sim') {
            tipoDeclaracao = entry.querySelector(`input[name="tipo_declaracao_ir_${personId}"]:checked`)?.value || null;
            resultadoDeclaracao = entry.querySelector(`input[name="resultado_declaracao_ir_${personId}"]:checked`)?.value || null;
        }

        impostoRendaDataColetada.push({
            pessoa_id: personId,
            nome: personName,
            tipo_pessoa: personType, 
            declara_ir: declaraIR,
            tipo_declaracao: tipoDeclaracao,
            resultado_declaracao: resultadoDeclaracao
        });
    });
    dadosFormulario.imposto_renda_info = impostoRendaDataColetada; // Salva o array coletado

    try {
        const { data, error } = await supabase
            .from("formularios_clientes")
            .update({
                dados_formulario: dadosFormulario,
                status: "preenchido",
                data_preenchimento: new Date().toISOString(),
            })
            .eq("token_unico", dadosFormulario.token_unico)
            .eq("cliente_id", dadosFormulario.cliente_id);

        if (error) throw error;

        showMessage("success", "Formulário enviado com sucesso! Obrigado.");
        formContentEl.innerHTML = "<p>Seu formulário foi enviado. Entraremos em contato em breve.</p>";
        formTitleEl.textContent = `Resumo do Formulário de ${sanitizeInput(dadosFormulario.nome_completo)}`;
        displaySummary(dadosFormulario, dadosFormulario.nome_completo);

    } catch (error) {
        console.error("Erro ao enviar formulário:", error);
        showMessage("error", `Erro ao enviar: ${error.message}`);
    }
}

// --- Funções de Exibição de Resumo (após preenchimento) ---
function displaySummary(data, nomeCliente) {
    let summaryHTML = `<div style="text-align: left; line-height: 1.8;">`;
    summaryHTML += `<h2>Resumo do Formulário - ${sanitizeInput(nomeCliente)}</h2>`;
    summaryHTML += `<p><strong>Nome Completo:</strong> ${sanitizeInput(data.nome_completo)}</p>`;
    summaryHTML += `<p><strong>Data de Nascimento:</strong> ${sanitizeInput(data.data_nascimento)}</p>`;
    summaryHTML += `<p><strong>CPF:</strong> ${sanitizeInput(data.cpf)}</p>`;
    summaryHTML += `<p><strong>Profissão:</strong> ${sanitizeInput(data.profissao)}</p>`;
    summaryHTML += `<p><strong>Renda Mensal:</strong> ${formatCurrency(data.renda_mensal)}</p>`;
    summaryHTML += `<p><strong>Renda da casa é apenas a sua?</strong> ${data.renda_unica === 'sim' ? 'Sim' : 'Não'}</p>`;

    if (data.renda_unica === 'nao' && data.outras_pessoas_renda && data.outras_pessoas_renda.length > 0) {
        summaryHTML += `<h4>Outras Pessoas com Renda:</h4><ul>`;
        data.outras_pessoas_renda.forEach(p => {
            summaryHTML += `<li>${sanitizeInput(p.nome)} - Renda: ${formatCurrency(p.renda_mensal)}</li>`;
        });
        summaryHTML += `</ul>`;
    }

    summaryHTML += `<p><strong>Tem dependentes?</strong> ${data.tem_dependentes === 'sim' ? 'Sim' : 'Não'}</p>`;
    if (data.tem_dependentes === 'sim' && data.dependentes && data.dependentes.length > 0) {
        summaryHTML += `<h4>Dependentes:</h4><ul>`;
        data.dependentes.forEach(d => {
            summaryHTML += `<li>${sanitizeInput(d.nome)} (${sanitizeInput(d.parentesco)})</li>`;
        });
        summaryHTML += `</ul>`;
    }

    // Resumo Plano de Saúde
    if (data.plano_saude_info && Object.keys(data.plano_saude_info).length > 0) {
        summaryHTML += `<h4>Plano de Saúde:</h4><ul>`;
        Object.entries(data.plano_saude_info).forEach(([key, value]) => {
            const nameMatch = key.match(/plano_saude_(preenchedor_plano|outra_pessoa_plano_\d+|dependente_plano_\d+)/);
            let personName = "Pessoa não identificada"; 
            // Tentar encontrar o nome da pessoa baseado no ID salvo nos data attributes durante a renderização
            // Esta parte pode precisar de ajuste para buscar o nome corretamente no resumo.
            // Por simplicidade, vamos usar o ID por enquanto se o nome não for facilmente recuperável aqui.
            if (nameMatch && nameMatch[1]) {
                personName = capitalizeName(nameMatch[1].replace(/_plano|_\d+/g, ' ').replace(/preenchedor/g, data.nome_completo.split(' ')[0] || 'Preenchedor').replace(/outra pessoa/g, 'Outra Pessoa').replace(/dependente/g, 'Dependente'));
            }
            summaryHTML += `<li>${personName}: ${value === 'sim' ? 'Sim' : (value === 'nao' ? 'Não' : 'Não sabe informar')}</li>`;
        });
        summaryHTML += `</ul>`;
    }

    // Resumo Seguro de Vida
    if (data.seguro_vida_info && Object.keys(data.seguro_vida_info).length > 0) {
        summaryHTML += `<h4>Seguro de Vida:</h4><ul>`;
        Object.entries(data.seguro_vida_info).forEach(([key, value]) => {
            const nameMatch = key.match(/seguro_vida_(preenchedor_seguro|outra_pessoa_seguro_\d+)/);
            let personName = "Pessoa não identificada";
            if (nameMatch && nameMatch[1]) {
                 personName = capitalizeName(nameMatch[1].replace(/_seguro|_\d+/g, ' ').replace(/preenchedor/g, data.nome_completo.split(' ')[0] || 'Preenchedor').replace(/outra pessoa/g, 'Outra Pessoa'));
            }
            summaryHTML += `<li>${personName}: ${value === 'sim' ? 'Sim' : (value === 'nao' ? 'Não' : 'Não sabe informar')}</li>`;
        });
        summaryHTML += `</ul>`;
    }
    
    // Resumo Imposto de Renda (NOVO)
    if (data.imposto_renda_info && data.imposto_renda_info.length > 0) {
        summaryHTML += `<h4>Imposto de Renda:</h4>`;
        data.imposto_renda_info.forEach(irPessoa => {
            summaryHTML += `<div style="margin-left: 20px; margin-bottom: 10px;"><strong>${sanitizeInput(irPessoa.nome)}:</strong><br>`;
            summaryHTML += `Declara IR? ${irPessoa.declara_ir === 'sim' ? 'Sim' : (irPessoa.declara_ir === 'nao' ? 'Não' : 'Não sabe informar')}<br>`;
            if (irPessoa.declara_ir === 'sim') {
                summaryHTML += `Tipo: ${irPessoa.tipo_declaracao || 'Não informado'}<br>`;
                summaryHTML += `Resultado: ${irPessoa.resultado_declaracao || 'Não informado'}`;
            }
            summaryHTML += `</div>`;
        });
    }

    summaryHTML += `<p style="margin-top:1.5rem;"><strong>Possui patrimônio físico?</strong> ${data.tem_patrimonio_fisico === 'sim' ? 'Sim' : 'Não'}</p>`;
    if (data.tem_patrimonio_fisico === 'sim' && data.patrimonio_fisico && data.patrimonio_fisico.length > 0) {
        summaryHTML += `<h4>Patrimônio Físico:</h4><ul>`;
        data.patrimonio_fisico.forEach(p => {
            summaryHTML += `<li>${sanitizeInput(p.descricao)} - Valor: ${formatCurrency(p.valor_estimado)}</li>`;
        });
        summaryHTML += `</ul>`;
    }

    summaryHTML += `<p><strong>Possui dinheiro guardado/investido?</strong> ${data.tem_patrimonio_liquido === 'sim' ? 'Sim' : 'Não'}</p>`;
    if (data.tem_patrimonio_liquido === 'sim' && data.patrimonio_liquido && data.patrimonio_liquido.length > 0) {
        summaryHTML += `<h4>Patrimônio Líquido (Investimentos):</h4><ul>`;
        data.patrimonio_liquido.forEach(p => {
            summaryHTML += `<li>${sanitizeInput(p.tipo_investimento)} - Valor: ${formatCurrency(p.valor_investido)}</li>`;
        });
        summaryHTML += `</ul>`;
    }

    summaryHTML += `<p><strong>Possui dívidas?</strong> ${data.tem_dividas === 'sim' ? 'Sim' : 'Não'}</p>`;
    if (data.tem_dividas === 'sim' && data.dividas && data.dividas.length > 0) {
        summaryHTML += `<h4>Dívidas:</h4><ul>`;
        data.dividas.forEach(d => {
            summaryHTML += `<li>${sanitizeInput(d.descricao)} - Saldo: ${formatCurrency(d.saldo_devedor)}, Prestação: ${formatCurrency(d.prestacao_mensal)}</li>`;
        });
        summaryHTML += `</ul>`;
    }

    summaryHTML += `</div>`;
    formContentEl.innerHTML = summaryHTML;
}

// --- Inicialização ---
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token");

if (token) {
    loadForm(token);
} else {
    formContentEl.innerHTML = "<p>Link de acesso inválido. Por favor, verifique a URL.</p>";
    showMessage("error", "Token de acesso não fornecido na URL.");
}


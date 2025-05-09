// formulario-cliente.js
import { supabase } from "./supabase.js";

// --- Elementos DOM ---
const formContentEl = document.getElementById("form-content");
const messageAreaEl = document.getElementById("message-area");
const formTitleEl = document.getElementById("form-title");

// --- Estado para preservar seleções ---
let planoSaudeSelections = {};
let seguroVidaSelections = {};
let impostoRendaSelections = {}; // Nova seção

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

// --- Funções para Seção IMPOSTO DE RENDA (Duplicado e adaptado de Seguro de Vida) ---
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

function restoreImpostoRendaSelections() {
    Object.keys(impostoRendaSelections).forEach(nameAttribute => {
        const value = impostoRendaSelections[nameAttribute];
        const radioToSelect = document.querySelector(`input[name="${nameAttribute}"][value="${value}"]`);
        if (radioToSelect) {
            radioToSelect.checked = true;
        }
    });
}

function renderImpostoRendaQuestions() {
    saveImpostoRendaSelections(); 
    const container = document.getElementById("imposto-renda-section-content");
    if (!container) return;
    container.innerHTML = '';
    const pessoasComRenda = [];
    const nomeCompletoInput = document.getElementById("nome_completo");
    if (nomeCompletoInput && nomeCompletoInput.value.trim() !== "") {
        pessoasComRenda.push({ id: "preenchedor_imposto_renda", nome: sanitizeInput(nomeCompletoInput.value.trim()), tipo: "preenchedor" });
    }
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach((entry, index) => { 
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasComRenda.push({ id: `outra_pessoa_imposto_renda_${index}`, nome: sanitizeInput(nomeInput.value.trim()), tipo: "outra_pessoa_renda" });
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
        const personId = `imposto_renda_${pessoa.id}`;
        const entryDiv = document.createElement("div");
        entryDiv.classList.add("imposto-renda-entry");
        entryDiv.style.marginBottom = "1rem";
        entryDiv.innerHTML = `
            <label for="${personId}" style="display: block; margin-bottom: 0.5rem;">${nomeCapitalizado} declara Imposto de Renda?</label>
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
    restoreImpostoRendaSelections(); 
}
// --- Fim das Funções para Seção IMPOSTO DE RENDA ---

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
    renderImpostoRendaQuestions(); // Adicionado aqui
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
                formContentEl.innerHTML = "<p>Erro ao carregar o formulário.</p>";
                showMessage("error", `Erro ao buscar dados do formulário: ${formError ? formError.message : 'Dados não encontrados.'}`);
            }
            return;
        }

        const clienteNome = formData.clientes ? formData.clientes.nome : "Cliente";
        formTitleEl.textContent = `Formulário de Planejamento - ${capitalizeName(clienteNome)}`;

        // Estrutura HTML do formulário
        // A ordem das seções é definida aqui
        let formHTML = `
            <form id="cliente-form">
                <input type="hidden" id="form_id" value="${sanitizeInput(formData.id)}">
                <input type="hidden" id="cliente_id" value="${sanitizeInput(formData.cliente_id)}">

                <h2>Informações Pessoais</h2>
                <label for="nome_completo">Nome Completo:</label>
                <input type="text" id="nome_completo" name="nome_completo" value="${formData.dados_formulario?.nome_completo ? sanitizeInput(formData.dados_formulario.nome_completo) : ''}" required>

                <label for="data_nascimento">Data de Nascimento:</label>
                <input type="date" id="data_nascimento" name="data_nascimento" value="${formData.dados_formulario?.data_nascimento ? sanitizeInput(formData.dados_formulario.data_nascimento) : ''}" required>

                <label for="estado_civil">Estado Civil:</label>
                <select id="estado_civil" name="estado_civil" required>
                    <option value="" ${!formData.dados_formulario?.estado_civil ? 'selected' : ''}>Selecione...</option>
                    <option value="solteiro" ${formData.dados_formulario?.estado_civil === 'solteiro' ? 'selected' : ''}>Solteiro(a)</option>
                    <option value="casado" ${formData.dados_formulario?.estado_civil === 'casado' ? 'selected' : ''}>Casado(a)</option>
                    <option value="divorciado" ${formData.dados_formulario?.estado_civil === 'divorciado' ? 'selected' : ''}>Divorciado(a)</option>
                    <option value="viuvo" ${formData.dados_formulario?.estado_civil === 'viuvo' ? 'selected' : ''}>Viúvo(a)</option>
                    <option value="uniao_estavel" ${formData.dados_formulario?.estado_civil === 'uniao_estavel' ? 'selected' : ''}>União Estável</option>
                </select>

                <h2>Renda</h2>
                <label>A renda é apenas sua ou há outras pessoas na casa com renda?</label>
                <div class="radio-group">
                    <label><input type="radio" id="renda_unica_sim" name="renda_unica" value="sim" ${formData.dados_formulario?.renda_unica === 'sim' || !formData.dados_formulario?.renda_unica ? 'checked' : ''} required> Apenas minha</label>
                    <label><input type="radio" id="renda_unica_nao" name="renda_unica" value="nao" ${formData.dados_formulario?.renda_unica === 'nao' ? 'checked' : ''}> Outras pessoas também têm renda</label>
                </div>
                
                <div id="outras-pessoas-renda-section" style="display: ${formData.dados_formulario?.renda_unica === 'nao' ? 'block' : 'none'}">
                    <label>Pessoas com renda na casa (além de você):</label>
                    <div id="pessoas-list"></div>
                    <button type="button" id="add-pessoa-btn" class="add-dynamic-entry-btn">Adicionar Pessoa com Renda</button>
                </div>

                <label for="renda_mensal_liquida">Sua Renda Mensal Líquida (aproximada):</label>
                <input type="text" id="renda_mensal_liquida" name="renda_mensal_liquida" inputmode="numeric" value="${formData.dados_formulario?.renda_mensal_liquida ? formatCurrency(formData.dados_formulario.renda_mensal_liquida) : ''}" placeholder="R$ 0,00" required>

                <h2>Dependentes</h2>
                <label id="label_tem_dependentes">Você tem filho/pet/outros parentes que dependem de você?</label>
                 <div class="radio-group">
                    <label><input type="radio" id="tem_dependentes_sim" name="tem_dependentes" value="sim" ${formData.dados_formulario?.tem_dependentes === 'sim' ? 'checked' : ''} required> Sim</label>
                    <label><input type="radio" id="tem_dependentes_nao" name="tem_dependentes" value="nao" ${formData.dados_formulario?.tem_dependentes === 'nao' || !formData.dados_formulario?.tem_dependentes ? 'checked' : ''}> Não</label>
                </div>
                <div id="dependentes-section" style="display: ${formData.dados_formulario?.tem_dependentes === 'sim' ? 'block' : 'none'}">
                    <label>Dependentes:</label>
                    <div id="dependentes-list"></div>
                    <button type="button" id="add-dependente-btn" class="add-dynamic-entry-btn">Adicionar Dependente</button>
                </div>

                <h2>Patrimônio</h2>
                <label id="label_tem_patrimonio_fisico">Você possui patrimônio físico (imóvel, automóvel, jóias, outros...)?</label>
                <div class="radio-group">
                    <label><input type="radio" id="tem_patrimonio_fisico_sim" name="tem_patrimonio_fisico" value="sim" ${formData.dados_formulario?.tem_patrimonio_fisico === 'sim' ? 'checked' : ''} required> Sim</label>
                    <label><input type="radio" id="tem_patrimonio_fisico_nao" name="tem_patrimonio_fisico" value="nao" ${formData.dados_formulario?.tem_patrimonio_fisico === 'nao' || !formData.dados_formulario?.tem_patrimonio_fisico ? 'checked' : ''}> Não</label>
                </div>
                <div id="patrimonio-fisico-section" style="display: ${formData.dados_formulario?.tem_patrimonio_fisico === 'sim' ? 'block' : 'none'}">
                    <label>Itens de Patrimônio Físico:</label>
                    <div id="patrimonio-fisico-list"></div>
                    <button type="button" id="add-patrimonio-fisico-btn" class="add-dynamic-entry-btn">Adicionar Patrimônio Físico</button>
                </div>

                <label id="label_tem_patrimonio_liquido">Você possui Dinheiro Guardado ou Investido?</label>
                 <div class="radio-group">
                    <label><input type="radio" id="tem_patrimonio_liquido_sim" name="tem_patrimonio_liquido" value="sim" ${formData.dados_formulario?.tem_patrimonio_liquido === 'sim' ? 'checked' : ''} required> Sim</label>
                    <label><input type="radio" id="tem_patrimonio_liquido_nao" name="tem_patrimonio_liquido" value="nao" ${formData.dados_formulario?.tem_patrimonio_liquido === 'nao' || !formData.dados_formulario?.tem_patrimonio_liquido ? 'checked' : ''}> Não</label>
                </div>
                <div id="patrimonio-liquido-section" style="display: ${formData.dados_formulario?.tem_patrimonio_liquido === 'sim' ? 'block' : 'none'}">
                    <label>Tipos de Patrimônio Líquido/Investimentos:</label>
                    <div id="patrimonio-liquido-list"></div>
                    <button type="button" id="add-patrimonio-liquido-btn" class="add-dynamic-entry-btn">Adicionar Patrimônio Líquido/Investimento</button>
                </div>

                <h2>Dívidas</h2>
                <label id="label_tem_dividas">Você possui dívidas?</label>
                <div class="radio-group">
                    <label><input type="radio" id="tem_dividas_sim" name="tem_dividas" value="sim" ${formData.dados_formulario?.tem_dividas === 'sim' ? 'checked' : ''} required> Sim</label>
                    <label><input type="radio" id="tem_dividas_nao" name="tem_dividas" value="nao" ${formData.dados_formulario?.tem_dividas === 'nao' || !formData.dados_formulario?.tem_dividas ? 'checked' : ''}> Não</label>
                </div>
                <div id="dividas-section" style="display: ${formData.dados_formulario?.tem_dividas === 'sim' ? 'block' : 'none'}">
                    <label>Tipos de Dívidas:</label>
                    <div id="dividas-list"></div>
                    <button type="button" id="add-divida-btn" class="add-dynamic-entry-btn">Adicionar Dívida</button>
                </div>

                <!-- NOVA SEÇÃO: IMPOSTO DE RENDA -->
                <h2 id="imposto-renda-section-title" style="display: none;">Imposto de Renda</h2>
                <div id="imposto-renda-section-content">
                    <!-- Perguntas sobre imposto de renda serão renderizadas aqui -->
                </div>
                <!-- FIM DA NOVA SEÇÃO: IMPOSTO DE RENDA -->

                <h2 id="seguro-vida-section-title" style="display: none;">Seguro de Vida</h2>
                <div id="seguro-vida-section-content">
                    <!-- Perguntas sobre seguro de vida serão renderizadas aqui -->
                </div>
                
                <h2 id="plano-saude-section-title" style="display: none;">Plano de Saúde</h2>
                <div id="plano-saude-section-content">
                    <!-- Perguntas sobre plano de saúde serão renderizadas aqui -->
                </div>

                <h2>Considerações Finais</h2>
                <label for="objetivos_financeiros">Quais seus principais objetivos financeiros de curto, médio e longo prazo?</label>
                <textarea id="objetivos_financeiros" name="objetivos_financeiros" rows="4">${formData.dados_formulario?.objetivos_financeiros ? sanitizeInput(formData.dados_formulario.objetivos_financeiros) : ''}</textarea>

                <label for="observacoes">Algo mais que gostaria de compartilhar?</label>
                <textarea id="observacoes" name="observacoes" rows="4">${formData.dados_formulario?.observacoes ? sanitizeInput(formData.dados_formulario.observacoes) : ''}</textarea>

                <button type="submit">Enviar Formulário</button>
            </form>
        `;

        formContentEl.innerHTML = formHTML;
        setupEventListeners(formData.dados_formulario || {}); // Passar dados existentes
        updateDynamicFormSections(); // Para renderizar seções dinâmicas como plano de saúde, seguro de vida e IR

        // Carregar dados dinâmicos (pessoas, dependentes, patrimônios, dívidas)
        if (formData.dados_formulario?.outras_pessoas_renda) {
            formData.dados_formulario.outras_pessoas_renda.forEach(p => addPessoaRendaEntry(p));
        }
        if (formData.dados_formulario?.dependentes_lista) {
            formData.dados_formulario.dependentes_lista.forEach(d => addDependenteEntry(d));
        }
        if (formData.dados_formulario?.patrimonio_fisico_lista) {
            formData.dados_formulario.patrimonio_fisico_lista.forEach(p => addPatrimonioFisicoEntry(p));
        }
        if (formData.dados_formulario?.patrimonio_liquido_lista) {
            formData.dados_formulario.patrimonio_liquido_lista.forEach(p => addPatrimonioLiquidoEntry(p));
        }
        if (formData.dados_formulario?.dividas_lista) {
            formData.dados_formulario.dividas_lista.forEach(d => addDividaEntry(d));
        }

        // Restaurar seleções de rádio para seções dinâmicas após a renderização inicial
        // (Plano de Saúde, Seguro de Vida, Imposto de Renda)
        if (formData.dados_formulario?.plano_saude_detalhes) {
            planoSaudeSelections = formData.dados_formulario.plano_saude_detalhes;
            restorePlanoSaudeSelections();
        }
        if (formData.dados_formulario?.imposto_renda_detalhes) { // Restaurar dados de IR se existirem
            impostoRendaSelections = formData.dados_formulario.imposto_renda_detalhes;
            restoreImpostoRendaSelections();
        }
        if (formData.dados_formulario?.seguro_vida_detalhes) {
            seguroVidaSelections = formData.dados_formulario.seguro_vida_detalhes;
            restoreSeguroVidaSelections();
        }


    } catch (error) {
        console.error("Erro ao carregar formulário:", error);
        formContentEl.innerHTML = "<p>Ocorreu um erro ao carregar o formulário. Tente novamente mais tarde.</p>";
        showMessage("error", `Erro: ${error.message}`);
    }
}

function setupEventListeners(existingData = {}) {
    const form = document.getElementById("cliente-form");
    if (form) {
        form.addEventListener("submit", submitForm);
    }

    // Event listeners para mostrar/esconder seções baseadas em radio buttons
    const rendaUnicaRadios = document.querySelectorAll('input[name="renda_unica"]');
    rendaUnicaRadios.forEach(radio => radio.addEventListener('change', () => {
        document.getElementById('outras-pessoas-renda-section').style.display = document.getElementById('renda_unica_nao').checked ? 'block' : 'none';
        updateDynamicFormSections();
    }));

    const temDependentesRadios = document.querySelectorAll('input[name="tem_dependentes"]');
    temDependentesRadios.forEach(radio => radio.addEventListener('change', () => {
        document.getElementById('dependentes-section').style.display = document.getElementById('tem_dependentes_sim').checked ? 'block' : 'none';
        updateDynamicFormSections();
    }));

    const temPatrimonioFisicoRadios = document.querySelectorAll('input[name="tem_patrimonio_fisico"]');
    temPatrimonioFisicoRadios.forEach(radio => radio.addEventListener('change', () => {
        document.getElementById('patrimonio-fisico-section').style.display = document.getElementById('tem_patrimonio_fisico_sim').checked ? 'block' : 'none';
    }));

    const temPatrimonioLiquidoRadios = document.querySelectorAll('input[name="tem_patrimonio_liquido"]');
    temPatrimonioLiquidoRadios.forEach(radio => radio.addEventListener('change', () => {
        document.getElementById('patrimonio-liquido-section').style.display = document.getElementById('tem_patrimonio_liquido_sim').checked ? 'block' : 'none';
    }));

    const temDividasRadios = document.querySelectorAll('input[name="tem_dividas"]');
    temDividasRadios.forEach(radio => radio.addEventListener('change', () => {
        document.getElementById('dividas-section').style.display = document.getElementById('tem_dividas_sim').checked ? 'block' : 'none';
    }));

    // Botões de adicionar entradas dinâmicas
    const addPessoaBtn = document.getElementById('add-pessoa-btn');
    if (addPessoaBtn) addPessoaBtn.addEventListener('click', () => addPessoaRendaEntry());
    
    const addDependenteBtn = document.getElementById('add-dependente-btn');
    if (addDependenteBtn) addDependenteBtn.addEventListener('click', () => addDependenteEntry());

    const addPatrimonioFisicoBtn = document.getElementById('add-patrimonio-fisico-btn');
    if (addPatrimonioFisicoBtn) addPatrimonioFisicoBtn.addEventListener('click', () => addPatrimonioFisicoEntry());

    const addPatrimonioLiquidoBtn = document.getElementById('add-patrimonio-liquido-btn');
    if (addPatrimonioLiquidoBtn) addPatrimonioLiquidoBtn.addEventListener('click', () => addPatrimonioLiquidoEntry());

    const addDividaBtn = document.getElementById('add-divida-btn');
    if (addDividaBtn) addDividaBtn.addEventListener('click', () => addDividaEntry());

    // Atualizar seções dinâmicas em mudanças relevantes
    const nomeCompletoInput = document.getElementById("nome_completo");
    if (nomeCompletoInput) nomeCompletoInput.addEventListener('input', updateDynamicFormSections);

    // Lidar com formatação de moeda
    const currencyInputs = document.querySelectorAll('input[inputmode="numeric"]');
    currencyInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            // Remove caracteres não numéricos, exceto vírgula e ponto para permitir a digitação inicial
            let value = e.target.value.replace(/[^\d,.-]/g, '');
            e.target.dataset.rawValue = parseCurrency(value); // Armazena o valor numérico
        });
        input.addEventListener('blur', (e) => {
            const rawValue = e.target.dataset.rawValue;
            if (rawValue !== undefined && rawValue !== null && rawValue !== "") {
                e.target.value = formatCurrency(parseFloat(rawValue));
            }
        });
        // Formatar no carregamento se houver valor
        if (input.value) {
            const initialRawValue = parseCurrency(input.value);
            if (initialRawValue !== null) {
                input.dataset.rawValue = initialRawValue;
                input.value = formatCurrency(initialRawValue);
            }
        }
    });
}

// --- Funções para adicionar/remover entradas dinâmicas (Pessoas com Renda, Dependentes, Patrimônio, Dívidas) ---
function createDynamicEntryHTML(type, index, data = {}) {
    let fieldsHTML = '';
    const nome = data.nome ? sanitizeInput(data.nome) : '';
    const valor = data.valor ? formatCurrency(data.valor) : '';
    const descricao = data.descricao ? sanitizeInput(data.descricao) : '';

    switch (type) {
        case 'pessoa_renda':
            fieldsHTML = `
                <label for="pessoa_nome_${index}">Nome da Pessoa:</label>
                <input type="text" id="pessoa_nome_${index}" name="pessoa_nome" value="${nome}" required>
                <label for="pessoa_renda_${index}">Renda Mensal Líquida (aprox.):</label>
                <input type="text" id="pessoa_renda_${index}" name="pessoa_renda" inputmode="numeric" value="${valor}" placeholder="R$ 0,00" required>
            `;
            break;
        case 'dependente':
            fieldsHTML = `
                <label for="dep_nome_${index}">Nome do Dependente:</label>
                <input type="text" id="dep_nome_${index}" name="dep_nome" value="${nome}" required>
                <label for="dep_idade_${index}">Idade:</label>
                <input type="number" id="dep_idade_${index}" name="dep_idade" value="${data.idade || ''}" min="0">
            `;
            break;
        case 'patrimonio_fisico':
            fieldsHTML = `
                <label for="pf_descricao_${index}">Descrição (ex: Carro HB20 2023, Apto Pinheiros):</label>
                <input type="text" id="pf_descricao_${index}" name="pf_descricao" value="${descricao}" required>
                <label for="pf_valor_${index}">Valor Estimado:</label>
                <input type="text" id="pf_valor_${index}" name="pf_valor" inputmode="numeric" value="${valor}" placeholder="R$ 0,00" required>
            `;
            break;
        case 'patrimonio_liquido':
            fieldsHTML = `
                <label for="pl_descricao_${index}">Descrição (ex: Poupança, CDB, Ações XP):</label>
                <input type="text" id="pl_descricao_${index}" name="pl_descricao" value="${descricao}" required>
                <label for="pl_valor_${index}">Saldo Atual:</label>
                <input type="text" id="pl_valor_${index}" name="pl_valor" inputmode="numeric" value="${valor}" placeholder="R$ 0,00" required>
            `;
            break;
        case 'divida':
            fieldsHTML = `
                <label for="divida_descricao_${index}">Descrição (ex: Financiamento Imob., Cartão Nubank):</label>
                <input type="text" id="divida_descricao_${index}" name="divida_descricao" value="${descricao}" required>
                <label for="divida_saldo_${index}">Saldo Devedor Total:</label>
                <input type="text" id="divida_saldo_${index}" name="divida_saldo" inputmode="numeric" value="${data.saldo_devedor ? formatCurrency(data.saldo_devedor) : ''}" placeholder="R$ 0,00" required>
                <label for="divida_parcela_${index}">Valor da Parcela Mensal:</label>
                <input type="text" id="divida_parcela_${index}" name="divida_parcela" inputmode="numeric" value="${data.parcela_mensal ? formatCurrency(data.parcela_mensal) : ''}" placeholder="R$ 0,00">
            `;
            break;
    }

    const itemDiv = document.createElement('div');
    itemDiv.classList.add('dynamic-entry-item');
    itemDiv.innerHTML = `
        ${fieldsHTML}
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
    `;
    itemDiv.querySelector('.remove-dynamic-entry-btn').addEventListener('click', () => {
        itemDiv.remove();
        updateDynamicFormSections(); // Atualizar seções que dependem de nomes (Plano de Saúde, Seguro Vida, IR)
    });
    
    // Reaplicar listeners de formatação de moeda para os novos campos
    itemDiv.querySelectorAll('input[inputmode="numeric"]').forEach(input => {
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/[^\d,.-]/g, '');
            e.target.dataset.rawValue = parseCurrency(value);
        });
        input.addEventListener('blur', (e) => {
            const rawValue = e.target.dataset.rawValue;
            if (rawValue !== undefined && rawValue !== null && rawValue !== "") {
                e.target.value = formatCurrency(parseFloat(rawValue));
            }
        });
        if (input.value) { // Formatar no carregamento se houver valor (ao carregar dados existentes)
            const initialRawValue = parseCurrency(input.value);
             if (initialRawValue !== null) {
                input.dataset.rawValue = initialRawValue;
                input.value = formatCurrency(initialRawValue);
            }
        }
    });
    // Para campos de nome, atualizar seções dinâmicas ao digitar
    if (type === 'pessoa_renda') {
        itemDiv.querySelector('input[name="pessoa_nome"]').addEventListener('input', updateDynamicFormSections);
    }
    if (type === 'dependente') {
        itemDiv.querySelector('input[name="dep_nome"]').addEventListener('input', updateDynamicFormSections);
    }

    return itemDiv;
}

function addPessoaRendaEntry(data = {}) {
    const listEl = document.getElementById('pessoas-list');
    const index = listEl.children.length;
    const entryEl = createDynamicEntryHTML('pessoa_renda', index, data);
    listEl.appendChild(entryEl);
    updateDynamicFormSections();
}

function addDependenteEntry(data = {}) {
    const listEl = document.getElementById('dependentes-list');
    const index = listEl.children.length;
    const entryEl = createDynamicEntryHTML('dependente', index, data);
    listEl.appendChild(entryEl);
    updateDynamicFormSections();
}

function addPatrimonioFisicoEntry(data = {}) {
    const listEl = document.getElementById('patrimonio-fisico-list');
    const index = listEl.children.length;
    const entryEl = createDynamicEntryHTML('patrimonio_fisico', index, data);
    listEl.appendChild(entryEl);
}

function addPatrimonioLiquidoEntry(data = {}) {
    const listEl = document.getElementById('patrimonio-liquido-list');
    const index = listEl.children.length;
    const entryEl = createDynamicEntryHTML('patrimonio_liquido', index, data);
    listEl.appendChild(entryEl);
}

function addDividaEntry(data = {}) {
    const listEl = document.getElementById('dividas-list');
    const index = listEl.children.length;
    const entryEl = createDynamicEntryHTML('divida', index, data);
    listEl.appendChild(entryEl);
}

// --- Submissão do Formulário ---
async function submitForm(event) {
    event.preventDefault();
    showMessage("success", "Enviando dados...");

    const formId = document.getElementById("form_id").value;
    const clienteId = document.getElementById("cliente_id").value;

    const formData = {
        nome_completo: sanitizeInput(document.getElementById("nome_completo").value),
        data_nascimento: document.getElementById("data_nascimento").value,
        estado_civil: document.getElementById("estado_civil").value,
        renda_unica: document.querySelector('input[name="renda_unica"]:checked').value,
        renda_mensal_liquida: parseCurrency(document.getElementById("renda_mensal_liquida").value),
        tem_dependentes: document.querySelector('input[name="tem_dependentes"]:checked').value,
        tem_patrimonio_fisico: document.querySelector('input[name="tem_patrimonio_fisico"]:checked').value,
        tem_patrimonio_liquido: document.querySelector('input[name="tem_patrimonio_liquido"]:checked').value,
        tem_dividas: document.querySelector('input[name="tem_dividas"]:checked').value,
        objetivos_financeiros: sanitizeInput(document.getElementById("objetivos_financeiros").value),
        observacoes: sanitizeInput(document.getElementById("observacoes").value),
        outras_pessoas_renda: [],
        dependentes_lista: [],
        patrimonio_fisico_lista: [],
        patrimonio_liquido_lista: [],
        dividas_lista: [],
        plano_saude_detalhes: {},
        imposto_renda_detalhes: {}, // Nova seção
        seguro_vida_detalhes: {}
    };

    if (formData.renda_unica === 'nao') {
        document.querySelectorAll('#pessoas-list .dynamic-entry-item').forEach(item => {
            formData.outras_pessoas_renda.push({
                nome: sanitizeInput(item.querySelector('input[name="pessoa_nome"]').value),
                renda: parseCurrency(item.querySelector('input[name="pessoa_renda"]').value)
            });
        });
    }

    if (formData.tem_dependentes === 'sim') {
        document.querySelectorAll('#dependentes-list .dynamic-entry-item').forEach(item => {
            formData.dependentes_lista.push({
                nome: sanitizeInput(item.querySelector('input[name="dep_nome"]').value),
                idade: parseInt(item.querySelector('input[name="dep_idade"]').value) || null
            });
        });
    }
    
    if (formData.tem_patrimonio_fisico === 'sim') {
        document.querySelectorAll('#patrimonio-fisico-list .dynamic-entry-item').forEach(item => {
            formData.patrimonio_fisico_lista.push({
                descricao: sanitizeInput(item.querySelector('input[name="pf_descricao"]').value),
                valor: parseCurrency(item.querySelector('input[name="pf_valor"]').value)
            });
        });
    }

    if (formData.tem_patrimonio_liquido === 'sim') {
        document.querySelectorAll('#patrimonio-liquido-list .dynamic-entry-item').forEach(item => {
            formData.patrimonio_liquido_lista.push({
                descricao: sanitizeInput(item.querySelector('input[name="pl_descricao"]').value),
                valor: parseCurrency(item.querySelector('input[name="pl_valor"]').value)
            });
        });
    }

    if (formData.tem_dividas === 'sim') {
        document.querySelectorAll('#dividas-list .dynamic-entry-item').forEach(item => {
            formData.dividas_lista.push({
                descricao: sanitizeInput(item.querySelector('input[name="divida_descricao"]').value),
                saldo_devedor: parseCurrency(item.querySelector('input[name="divida_saldo"]').value),
                parcela_mensal: parseCurrency(item.querySelector('input[name="divida_parcela"]').value)
            });
        });
    }

    // Coletar dados do Plano de Saúde
    document.querySelectorAll("#plano-saude-section-content .plano-saude-entry").forEach(entry => {
        const personName = entry.dataset.personName;
        const personType = entry.dataset.personType;
        const radioName = entry.querySelector('input[type="radio"]').name;
        const selectedRadio = entry.querySelector(`input[name="${radioName}"]:checked`);
        if (selectedRadio) {
            formData.plano_saude_detalhes[radioName] = {
                nome: personName,
                tipo: personType,
                resposta: selectedRadio.value
            };
        }
    });

    // Coletar dados do Imposto de Renda
    document.querySelectorAll("#imposto-renda-section-content .imposto-renda-entry").forEach(entry => {
        const personName = entry.dataset.personName;
        const personType = entry.dataset.personType;
        const radioName = entry.querySelector('input[type="radio"]').name;
        const selectedRadio = entry.querySelector(`input[name="${radioName}"]:checked`);
        if (selectedRadio) {
            formData.imposto_renda_detalhes[radioName] = {
                nome: personName,
                tipo: personType,
                resposta: selectedRadio.value
            };
        }
    });

    // Coletar dados do Seguro de Vida
    document.querySelectorAll("#seguro-vida-section-content .seguro-vida-entry").forEach(entry => {
        const personName = entry.dataset.personName;
        const personType = entry.dataset.personType;
        const radioName = entry.querySelector('input[type="radio"]').name;
        const selectedRadio = entry.querySelector(`input[name="${radioName}"]:checked`);
        if (selectedRadio) {
            formData.seguro_vida_detalhes[radioName] = {
                nome: personName,
                tipo: personType,
                resposta: selectedRadio.value
            };
        }
    });

    try {
        const { data, error } = await supabase
            .from("formularios_clientes")
            .update({
                dados_formulario: formData,
                status: "preenchido",
                data_preenchimento: new Date().toISOString()
            })
            .eq("id", formId)
            .eq("cliente_id", clienteId);

        if (error) throw error;

        showMessage("success", "Formulário enviado com sucesso! Obrigado.");
        formContentEl.innerHTML = "<p>Seu formulário foi enviado. Entraremos em contato em breve.</p>";

    } catch (error) {
        console.error("Erro ao enviar formulário:", error);
        showMessage("error", `Erro ao enviar: ${error.message}. Por favor, tente novamente.`);
    }
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    loadForm(token);
});


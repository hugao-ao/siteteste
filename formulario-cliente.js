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
  if (str === null || str === undefined) {
    return "";
  }
  let text = String(str);
  text = text.replace(/&/g, "&amp;");
  text = text.replace(/</g, "&lt;");
  text = text.replace(/>/g, "&gt;");
  text = text.replace(/"/g, "&quot;");
  text = text.replace(/'/g, "&#x27;"); // Correção aplicada aqui
  text = text.replace(/`/g, "&#x60;");
  return text;
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
                formContentEl.innerHTML = "<p>Erro ao carregar o formulário.</p>";
                showMessage("error", `Erro ao buscar dados: ${formError ? formError.message : 'Formulário não encontrado.'}`);
            }
            return;
        }

        const clienteNome = formData.clientes ? formData.clientes.nome : "Cliente";
        formTitleEl.textContent = `Formulário de ${capitalizeName(clienteNome)}`;

        if (formData.data_preenchimento) {
            displayFilledForm(formData.dados_formulario, clienteNome, formData.outras_pessoas_renda, formData.dependentes);
            return;
        }

        let formHTML = `
            <form id="clientForm">
                <input type="hidden" id="form_token" value="${sanitizeInput(token)}">
                <input type="hidden" id="cliente_id" value="${sanitizeInput(formData.cliente_id)}">
                
                <!-- Dados Pessoais -->
                <div class="form-section">
                    <h3>Dados Pessoais</h3>
                    <div class="form-group">
                        <label for="nome_completo">Nome Completo:</label>
                        <input type="text" id="nome_completo" name="nome_completo" value="${sanitizeInput(clienteNome)}" required>
                    </div>
                    <div class="form-group">
                        <label for="data_nascimento">Data de Nascimento:</label>
                        <input type="date" id="data_nascimento" name="data_nascimento" required>
                    </div>
                    <div class="form-group">
                        <label for="estado_civil">Estado Civil:</label>
                        <select id="estado_civil" name="estado_civil" required>
                            <option value="">Selecione...</option>
                            <option value="solteiro">Solteiro(a)</option>
                            <option value="casado">Casado(a)</option>
                            <option value="divorciado">Divorciado(a)</option>
                            <option value="viuvo">Viúvo(a)</option>
                            <option value="uniao_estavel">União Estável</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="profissao">Profissão:</label>
                        <input type="text" id="profissao" name="profissao" required>
                    </div>
                    <div class="form-group">
                        <label for="email">Email:</label>
                        <input type="email" id="email" name="email" required>
                    </div>
                    <div class="form-group">
                        <label for="telefone">Telefone (com DDD):</label>
                        <input type="text" id="telefone" name="telefone" placeholder="(XX) XXXXX-XXXX" required>
                    </div>
                </div>

                <!-- Renda -->
                <div class="form-section">
                    <h3>Renda</h3>
                    <div class="form-group">
                        <label>A renda é apenas sua ou há outras pessoas na casa com renda?</label>
                        <div class="radio-group">
                            <input type="radio" id="renda_unica_sim" name="renda_unica" value="sim" checked required>
                            <label for="renda_unica_sim">Apenas minha</label>
                            <input type="radio" id="renda_unica_nao" name="renda_unica" value="nao">
                            <label for="renda_unica_nao">Há outras pessoas com renda</label>
                        </div>
                    </div>
                    <div id="outras-pessoas-renda-section" style="display:none;">
                        <label>Pessoas com renda na casa (além de você):</label>
                        <div id="pessoas-list"></div>
                        <button type="button" class="add-dynamic-entry-btn" id="add-pessoa-btn">Adicionar Pessoa</button>
                    </div>
                </div>

                <!-- Dependentes -->
                <div class="form-section">
                    <h3 id="dependentes-section-title">Dependentes</h3>
                    <div class="form-group">
                        <label id="label_tem_dependentes">Você tem filho/pet/outros parentes que dependem de você?</label>
                        <div class="radio-group">
                            <input type="radio" id="tem_dependentes_sim" name="tem_dependentes" value="sim" required>
                            <label for="tem_dependentes_sim">Sim</label>
                            <input type="radio" id="tem_dependentes_nao" name="tem_dependentes" value="nao" checked>
                            <label for="tem_dependentes_nao">Não</label>
                        </div>
                    </div>
                    <div id="dependentes-section-content" style="display:none;">
                        <label>Dependentes:</label>
                        <div id="dependentes-list"></div>
                        <button type="button" class="add-dynamic-entry-btn" id="add-dependente-btn">Adicionar Dependente</button>
                    </div>
                </div>

                <!-- Plano de Saúde -->
                <div class="form-section">
                    <h3 id="plano-saude-section-title" style="display:none;">Plano de Saúde</h3>
                    <div id="plano-saude-section-content">
                        <p>Preencha as informações anteriores para definir as perguntas sobre plano de saúde.</p>
                    </div>
                </div>

                <!-- Seguro de Vida -->
                <div class="form-section">
                    <h3 id="seguro-vida-section-title" style="display:none;">Seguro de Vida</h3>
                    <div id="seguro-vida-section-content">
                        <p>Preencha as informações sobre nome e renda para definir as perguntas sobre seguro de vida.</p>
                    </div>
                </div>

                <!-- Patrimônio Físico -->
                <div class="form-section">
                    <h3>Patrimônio Físico</h3>
                    <div class="form-group">
                        <label id="label_tem_patrimonio_fisico">Você possui patrimônio físico (imóvel, automóvel, jóias, outros...)?</label>
                        <div class="radio-group">
                            <input type="radio" id="tem_patrimonio_fisico_sim" name="tem_patrimonio_fisico" value="sim" required>
                            <label for="tem_patrimonio_fisico_sim">Sim</label>
                            <input type="radio" id="tem_patrimonio_fisico_nao" name="tem_patrimonio_fisico" value="nao" checked>
                            <label for="tem_patrimonio_fisico_nao">Não</label>
                        </div>
                    </div>
                    <div id="patrimonio-fisico-list-container" style="display:none;">
                        <label>Itens de Patrimônio Físico:</label>
                        <div id="patrimonio-fisico-list"></div>
                        <button type="button" class="add-dynamic-entry-btn" id="add-patrimonio-fisico-btn">Adicionar Item</button>
                    </div>
                </div>

                <!-- Patrimônio Líquido -->
                <div class="form-section">
                    <h3>Patrimônio Líquido (Investimentos)</h3>
                     <div class="form-group">
                        <label id="label_tem_patrimonio_liquido">Você possui Dinheiro Guardado ou Investido?</label>
                        <div class="radio-group">
                            <input type="radio" id="tem_patrimonio_liquido_sim" name="tem_patrimonio_liquido" value="sim" required>
                            <label for="tem_patrimonio_liquido_sim">Sim</label>
                            <input type="radio" id="tem_patrimonio_liquido_nao" name="tem_patrimonio_liquido" value="nao" checked>
                            <label for="tem_patrimonio_liquido_nao">Não</label>
                        </div>
                    </div>
                    <div id="patrimonio-liquido-list-container" style="display:none;">
                        <label>Investimentos:</label>
                        <div id="patrimonio-liquido-list"></div>
                        <button type="button" class="add-dynamic-entry-btn" id="add-patrimonio-liquido-btn">Adicionar Investimento</button>
                    </div>
                </div>

                <!-- Dívidas -->
                <div class="form-section">
                    <h3>Dívidas</h3>
                    <div class="form-group">
                        <label id="label_tem_dividas">Você possui dívidas?</label>
                        <div class="radio-group">
                            <input type="radio" id="tem_dividas_sim" name="tem_dividas" value="sim" required>
                            <label for="tem_dividas_sim">Sim</label>
                            <input type="radio" id="tem_dividas_nao" name="tem_dividas" value="nao" checked>
                            <label for="tem_dividas_nao">Não</label>
                        </div>
                    </div>
                    <div id="dividas-list-container" style="display:none;">
                        <label>Dívidas:</label>
                        <div id="dividas-list"></div>
                        <button type="button" class="add-dynamic-entry-btn" id="add-divida-btn">Adicionar Dívida</button>
                    </div>
                </div>

                <!-- Seção de Imposto de Renda (Nova) -->
                ${renderIRSectionHTML({}, clienteNome, [])} 

                <!-- Seção de Orçamento (Nova) -->
                ${renderOrcamentoSectionHTML({}, [])}

                <!-- Seção de Objetivos (Nova) -->
                ${renderObjetivosSectionHTML([])}
                
                <button type="submit" id="submit-button">Enviar Formulário</button>
            </form>
        `;
        formContentEl.innerHTML = formHTML;
        attachFormListeners();
        updateDynamicFormSections(); 

    } catch (err) {
        console.error("Erro detalhado no loadForm:", err);
        formContentEl.innerHTML = "<p>Ocorreu um erro inesperado ao carregar o formulário.</p>";
        showMessage("error", `Erro: ${err.message}`);
    }
}

// --- NOVAS SEÇÕES: Funções de Renderização, Listeners e Coleta de Dados ---

// --- Seção de Imposto de Renda ---
function renderIRSectionHTML(dadosIR = {}, nomePreenchedor = "Você", outrasPessoasComRenda = []) {
    let outrasPessoasIRHTML = ""; 
    if (outrasPessoasComRenda && outrasPessoasComRenda.length > 0) {
        outrasPessoasComRenda.forEach((pessoa, index) => {
            const pessoaId = `outra_pessoa_ir_${index}`;
            const nomeCapitalizado = capitalizeName(pessoa.nome ? pessoa.nome.split(" ")[0] : `Pessoa ${index + 1}`);
            const dadosPessoaIR = (dadosIR.outras_pessoas && dadosIR.outras_pessoas.find(p => p.nome_ref === pessoa.nome)) || {};
            outrasPessoasIRHTML += `
                <div class="dynamic-entry-item ir-outra-pessoa-entry" data-pessoa-nome-ref="${sanitizeInput(pessoa.nome)}">
                    <h4>${nomeCapitalizado}</h4>
                    <div class="form-group">
                        <label for="ir_declara_${pessoaId}">${nomeCapitalizado} declara Imposto de Renda?</label>
                        <select id="ir_declara_${pessoaId}" name="ir_declara_${pessoaId}" class="ir_declara_outra_pessoa">
                            <option value="sim" ${dadosPessoaIR.declara === "sim" ? "selected" : ""}>Sim</option>
                            <option value="nao" ${dadosPessoaIR.declara === "nao" ? "selected" : ""}>Não</option>
                            <option value="nao_sei" ${(dadosPessoaIR.declara === "nao_sei" || !dadosPessoaIR.declara) ? "selected" : ""}>Não sei informar</option>
                        </select>
                    </div>
                    <div id="ir_details_${pessoaId}" class="ir_details_outra_pessoa" style="display: ${dadosPessoaIR.declara === "sim" ? "block" : "none"};">
                        <div class="form-group">
                            <label for="ir_tipo_${pessoaId}">Tipo da declaração:</label>
                            <select id="ir_tipo_${pessoaId}" name="ir_tipo_${pessoaId}">
                                <option value="" ${!dadosPessoaIR.tipo ? "selected" : ""}>Selecione...</option>
                                <option value="simples" ${dadosPessoaIR.tipo === "simples" ? "selected" : ""}>Simples</option>
                                <option value="deducoes_legais" ${dadosPessoaIR.tipo === "deducoes_legais" ? "selected" : ""}>Deduções Legais</option>
                                <option value="nao_sei" ${dadosPessoaIR.tipo === "nao_sei" ? "selected" : ""}>Não sei informar</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="ir_resultado_${pessoaId}">Resultado da declaração:</label>
                            <select id="ir_resultado_${pessoaId}" name="ir_resultado_${pessoaId}">
                                <option value="" ${!dadosPessoaIR.resultado ? "selected" : ""}>Selecione...</option>
                                <option value="paga" ${dadosPessoaIR.resultado === "paga" ? "selected" : ""}>Paga</option>
                                <option value="restitui" ${dadosPessoaIR.resultado === "restitui" ? "selected" : ""}>Restitui</option>
                                <option value="zero_a_zero" ${dadosPessoaIR.resultado === "zero_a_zero" ? "selected" : ""}>0x0</option>
                                <option value="nao_sei" ${dadosPessoaIR.resultado === "nao_sei" ? "selected" : ""}>Não sei informar</option>
                            </select>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    return `
        <div class="form-section" id="secao-imposto-renda">
            <h3>Imposto de Renda</h3>
            <div class="form-group">
                <label for="ir_declara_preenchedor">${capitalizeName(nomePreenchedor ? nomePreenchedor.split(" ")[0] : "Você")} declara Imposto de Renda?</label>
                <select id="ir_declara_preenchedor" name="ir_declara_preenchedor">
                    <option value="sim" ${dadosIR.declara_preenchedor === "sim" ? "selected" : ""}>Sim</option>
                    <option value="nao" ${(dadosIR.declara_preenchedor === "nao" || !dadosIR.declara_preenchedor) ? "selected" : ""}>Não</option>
                </select>
            </div>
            <div id="ir_details_preenchedor" style="display: ${dadosIR.declara_preenchedor === "sim" ? "block" : "none"};">
                <div class="form-group">
                    <label for="ir_tipo_preenchedor">Tipo da declaração:</label>
                    <select id="ir_tipo_preenchedor" name="ir_tipo_preenchedor">
                        <option value="" ${!dadosIR.tipo_preenchedor ? "selected" : ""}>Selecione...</option>
                        <option value="simples" ${dadosIR.tipo_preenchedor === "simples" ? "selected" : ""}>Simples</option>
                        <option value="deducoes_legais" ${dadosIR.tipo_preenchedor === "deducoes_legais" ? "selected" : ""}>Deduções Legais</option>
                        <option value="nao_sei" ${dadosIR.tipo_preenchedor === "nao_sei" ? "selected" : ""}>Não sei informar</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="ir_resultado_preenchedor">Resultado da declaração:</label>
                    <select id="ir_resultado_preenchedor" name="ir_resultado_preenchedor">
                        <option value="" ${!dadosIR.resultado_preenchedor ? "selected" : ""}>Selecione...</option>
                        <option value="paga" ${dadosIR.resultado_preenchedor === "paga" ? "selected" : ""}>Paga</option>
                        <option value="restitui" ${dadosIR.resultado_preenchedor === "restitui" ? "selected" : ""}>Restitui</option>
                        <option value="zero_a_zero" ${dadosIR.resultado_preenchedor === "zero_a_zero" ? "selected" : ""}>0x0</option>
                        <option value="nao_sei" ${dadosIR.resultado_preenchedor === "nao_sei" ? "selected" : ""}>Não sei informar</option>
                    </select>
                </div>
            </div>
            <div id="ir_outras_pessoas_container">
                ${outrasPessoasIRHTML}
            </div>
        </div>
    `;
}

function attachIRListeners() {
    const container = document.getElementById("secao-imposto-renda");
    if (!container) return;

    const irDeclaraSelect = container.querySelector("#ir_declara_preenchedor");
    const irDetailsDiv = container.querySelector("#ir_details_preenchedor");
    if (irDeclaraSelect && irDetailsDiv) {
        irDeclaraSelect.addEventListener("change", function() {
            irDetailsDiv.style.display = this.value === "sim" ? "block" : "none";
        });
        // irDeclaraSelect.dispatchEvent(new Event("change")); // Disparar para estado inicial se necessário
    }

    container.querySelectorAll(".ir_declara_outra_pessoa").forEach(selectElement => {
        const detailsId = selectElement.id.replace("ir_declara_", "ir_details_");
        const detailsDiv = container.querySelector(`#${detailsId}`);
        if (detailsDiv) {
            selectElement.addEventListener("change", function() {
                detailsDiv.style.display = this.value === "sim" ? "block" : "none";
            });
            // selectElement.dispatchEvent(new Event("change")); // Disparar para estado inicial se necessário
        }
    });
}

function collectIRData() {
    const container = document.getElementById("secao-imposto-renda");
    if (!container) return null;
    const data = {
        declara_preenchedor: container.querySelector("#ir_declara_preenchedor")?.value,
        tipo_preenchedor: null,
        resultado_preenchedor: null,
        outras_pessoas: []
    };
    if (data.declara_preenchedor === "sim") {
        data.tipo_preenchedor = container.querySelector("#ir_tipo_preenchedor")?.value;
        data.resultado_preenchedor = container.querySelector("#ir_resultado_preenchedor")?.value;
    }

    container.querySelectorAll(".ir-outra-pessoa-entry").forEach((entry) => {
        const nomeRef = entry.dataset.pessoaNomeRef;
        const selectDeclara = entry.querySelector(`select[id^="ir_declara_outra_pessoa_"]`); // Corrigido para buscar por ID que começa com
        const declaraValue = selectDeclara?.value;
        let pessoaData = {
            nome_ref: nomeRef,
            declara: declaraValue,
            tipo: null,
            resultado: null
        };
        if (declaraValue === "sim") {
            const tipoSelect = entry.querySelector(`select[id^="ir_tipo_outra_pessoa_"]`);
            const resultadoSelect = entry.querySelector(`select[id^="ir_resultado_outra_pessoa_"]`);
            pessoaData.tipo = tipoSelect?.value;
            pessoaData.resultado = resultadoSelect?.value;
        }
        data.outras_pessoas.push(pessoaData);
    });
    return data;
}

// --- Seção de Orçamento ---
function renderOrcamentoSectionHTML(dadosOrcamento = {}, pessoasParaOrcamentoSeparado = []) {
    let orcamentoSeparadoHTML = ""; 
    if (pessoasParaOrcamentoSeparado && pessoasParaOrcamentoSeparado.length > 0) { // Renderiza sempre, controla display com CSS/JS
        pessoasParaOrcamentoSeparado.forEach((pessoa, index) => {
            const pessoaId = `orc_sep_${index}`;
            const nomeCapitalizado = capitalizeName(pessoa.nome ? pessoa.nome.split(" ")[0] : `Pessoa ${index + 1}`);
            const dadosPessoaOrc = (dadosOrcamento.pessoas && dadosOrcamento.pessoas.find(p => p.nome_ref === pessoa.nome)) || {};
            orcamentoSeparadoHTML += `
                <div class="dynamic-entry-item orcamento-pessoa-entry" data-pessoa-nome-ref="${sanitizeInput(pessoa.nome)}">
                    <h4>Orçamento de ${nomeCapitalizado}</h4>
                    <div class="form-group">
                        <label for="renda_mensal_${pessoaId}">Renda Mensal (R$):</label>
                        <input type="text" id="renda_mensal_${pessoaId}" name="renda_mensal_${pessoaId}" class="currency-input" value="${formatCurrency(dadosPessoaOrc.renda_mensal || "")}">
                    </div>
                    <div class="form-group">
                        <label for="gastos_fixos_${pessoaId}">Gastos Fixos (R$):</label>
                        <input type="text" id="gastos_fixos_${pessoaId}" name="gastos_fixos_${pessoaId}" class="currency-input" value="${formatCurrency(dadosPessoaOrc.gastos_fixos || "")}">
                    </div>
                    <div class="form-group">
                        <label for="gastos_variaveis_${pessoaId}">Gastos Variáveis (R$):</label>
                        <input type="text" id="gastos_variaveis_${pessoaId}" name="gastos_variaveis_${pessoaId}" class="currency-input" value="${formatCurrency(dadosPessoaOrc.gastos_variaveis || "")}">
                    </div>
                    <div class="form-group">
                        <label for="quanto_poupa_${pessoaId}">Quanto Poupa (R$):</label>
                        <input type="text" id="quanto_poupa_${pessoaId}" name="quanto_poupa_${pessoaId}" class="currency-input" value="${formatCurrency(dadosPessoaOrc.quanto_poupa || "")}">
                    </div>
                </div>
            `;
        });
    }

    return `
        <div class="form-section" id="secao-orcamento">
            <h3>Orçamento</h3>
            <div class="form-group">
                <label>Informar orçamento de forma:</label>
                <div class="radio-group">
                    <input type="radio" id="orcamento_unificado_radio" name="orcamento_tipo_info" value="unificado" ${ (dadosOrcamento.tipo_info === "unificado" || !dadosOrcamento.tipo_info) ? "checked" : ""}>
                    <label for="orcamento_unificado_radio">Unificada</label>
                    <input type="radio" id="orcamento_separado_radio" name="orcamento_tipo_info" value="separado" ${dadosOrcamento.tipo_info === "separado" ? "checked" : ""}>
                    <label for="orcamento_separado_radio">Separada (por pessoa com renda)</label>
                </div>
            </div>
            <div id="orcamento_unificado_fields_container" style="display: ${ (dadosOrcamento.tipo_info === "unificado" || !dadosOrcamento.tipo_info) ? "block" : "none"};">
                <div class="form-group">
                    <label for="renda_mensal_total">Renda Mensal Total (R$):</label>
                    <input type="text" id="renda_mensal_total" name="renda_mensal_total" class="currency-input" value="${formatCurrency(dadosOrcamento.renda_mensal_total || "")}">
                </div>
                <div class="form-group">
                    <label for="gastos_fixos_mensais">Gastos Fixos Mensais (R$):</label>
                    <input type="text" id="gastos_fixos_mensais" name="gastos_fixos_mensais" class="currency-input" value="${formatCurrency(dadosOrcamento.gastos_fixos_mensais || "")}">
                </div>
                <div class="form-group">
                    <label for="gastos_variaveis_mensais">Gastos Variáveis Mensais (R$):</label>
                    <input type="text" id="gastos_variaveis_mensais" name="gastos_variaveis_mensais" class="currency-input" value="${formatCurrency(dadosOrcamento.gastos_variaveis_mensais || "")}">
                </div>
                <div class="form-group">
                    <label for="quanto_poupa_mensal">Quanto consegue poupar mensalmente (R$)?</label>
                    <input type="text" id="quanto_poupa_mensal" name="quanto_poupa_mensal" class="currency-input" value="${formatCurrency(dadosOrcamento.quanto_poupa_mensal || "")}">
                </div>
            </div>
            <div id="orcamento_separado_fields_container" style="display: ${dadosOrcamento.tipo_info === "separado" ? "block" : "none"};">
                ${orcamentoSeparadoHTML}
            </div>
        </div>
    `;
}

function attachOrcamentoListeners(getPessoasComRendaCallback) {
    const container = document.getElementById("secao-orcamento");
    if (!container) return;

    const unificadoRadio = container.querySelector("#orcamento_unificado_radio");
    const separadoRadio = container.querySelector("#orcamento_separado_radio");
    const unificadoFields = container.querySelector("#orcamento_unificado_fields_container");
    const separadoFields = container.querySelector("#orcamento_separado_fields_container");

    function toggleOrcamentoFields() {
        const pessoasComRenda = getPessoasComRendaCallback(); // Pega a lista atualizada
        if (separadoRadio.checked) {
            unificadoFields.style.display = "none";
            separadoFields.style.display = "block";
            // Regenerar campos separados se necessário, ou apenas mostrar
            const dadosOrcamentoAtual = collectOrcamentoData(); // Coleta dados atuais para preservar se possível
            separadoFields.innerHTML = renderOrcamentoSectionHTML(dadosOrcamentoAtual, pessoasComRenda).match(/<div id="orcamento_separado_fields_container"[^>]*>([\s\S]*?)<\/div>/)[1];
            attachCurrencyInputListeners(separadoFields); // Reaplicar listeners aos novos campos
        } else {
            unificadoFields.style.display = "block";
            separadoFields.style.display = "none";
        }
    }

    if (unificadoRadio && separadoRadio && unificadoFields && separadoFields) {
        unificadoRadio.addEventListener("change", toggleOrcamentoFields);
        separadoRadio.addEventListener("change", toggleOrcamentoFields);
        // toggleOrcamentoFields(); // Para estado inicial
    }
    attachCurrencyInputListeners(container); // Para campos de orçamento unificado
}

function collectOrcamentoData() {
    const container = document.getElementById("secao-orcamento");
    if (!container) return null;

    const tipoInfo = container.querySelector('input[name="orcamento_tipo_info"]:checked')?.value;
    const data = { tipo_info: tipoInfo, pessoas: [] };

    if (tipoInfo === "unificado") {
        data.renda_mensal_total = parseCurrency(container.querySelector("#renda_mensal_total")?.value);
        data.gastos_fixos_mensais = parseCurrency(container.querySelector("#gastos_fixos_mensais")?.value);
        data.gastos_variaveis_mensais = parseCurrency(container.querySelector("#gastos_variaveis_mensais")?.value);
        data.quanto_poupa_mensal = parseCurrency(container.querySelector("#quanto_poupa_mensal")?.value);
    } else if (tipoInfo === "separado") {
        container.querySelectorAll(".orcamento-pessoa-entry").forEach(entry => {
            const nomeRef = entry.dataset.pessoaNomeRef;
            const pessoaIdPrefix = entry.querySelector('input[type="text"]').id.match(/(orc_sep_\d+)/)[0].replace("renda_mensal_","");
            
            data.pessoas.push({
                nome_ref: nomeRef,
                renda_mensal: parseCurrency(entry.querySelector(`#renda_mensal_${pessoaIdPrefix}`)?.value),
                gastos_fixos: parseCurrency(entry.querySelector(`#gastos_fixos_${pessoaIdPrefix}`)?.value),
                gastos_variaveis: parseCurrency(entry.querySelector(`#gastos_variaveis_${pessoaIdPrefix}`)?.value),
                quanto_poupa: parseCurrency(entry.querySelector(`#quanto_poupa_${pessoaIdPrefix}`)?.value),
            });
        });
    }
    return data;
}

// --- Seção de Objetivos ---
let objetivoCounter = 0;
function renderObjetivosSectionHTML(dadosObjetivos = []) {
    let objetivosHTML = "";
    if (dadosObjetivos && dadosObjetivos.length > 0) {
        dadosObjetivos.forEach((objetivo, index) => {
            objetivoCounter = Math.max(objetivoCounter, index + 1); // Atualiza o contador global
            objetivosHTML += `
                <div class="dynamic-entry-item objetivo-entry" id="objetivo_entry_${index}">
                    <h4>Objetivo ${index + 1}</h4>
                    <button type="button" class="remove-dynamic-entry-btn remove-objetivo-btn" data-objetivo-id="${index}">Remover</button>
                    <div class="form-group">
                        <label for="objetivo_descricao_${index}">Qual é o objetivo e por que é importante?</label>
                        <textarea id="objetivo_descricao_${index}" name="objetivo_descricao_${index}" rows="3" required>${sanitizeInput(objetivo.descricao || "")}</textarea>
                    </div>
                </div>
            `;
        });
    } else {
        objetivoCounter = 0; // Reseta se não há objetivos iniciais
    }

    return `
        <div class="form-section" id="secao-objetivos">
            <h3>Objetivos</h3>
            <div id="objetivos-list-container">
                ${objetivosHTML}
            </div>
            <button type="button" class="add-dynamic-entry-btn" id="add-objetivo-btn">Adicionar Objetivo</button>
        </div>
    `;
}

function attachObjetivosListeners() {
    const container = document.getElementById("secao-objetivos");
    if (!container) return;

    const addButton = container.querySelector("#add-objetivo-btn");
    const listContainer = container.querySelector("#objetivos-list-container");

    if (addButton && listContainer) {
        addButton.addEventListener("click", () => {
            objetivoCounter++;
            const newIndex = objetivoCounter -1; // Usar o contador atual para o ID
            const newObjetivoHTML = `
                <div class="dynamic-entry-item objetivo-entry" id="objetivo_entry_${newIndex}">
                    <h4>Objetivo ${objetivoCounter}</h4>
                    <button type="button" class="remove-dynamic-entry-btn remove-objetivo-btn" data-objetivo-id="${newIndex}">Remover</button>
                    <div class="form-group">
                        <label for="objetivo_descricao_${newIndex}">Qual é o objetivo e por que é importante?</label>
                        <textarea id="objetivo_descricao_${newIndex}" name="objetivo_descricao_${newIndex}" rows="3" required></textarea>
                    </div>
                </div>
            `;
            listContainer.insertAdjacentHTML("beforeend", newObjetivoHTML);
        });

        listContainer.addEventListener("click", (event) => {
            if (event.target.classList.contains("remove-objetivo-btn")) {
                const objetivoIdToRemove = event.target.dataset.objetivoId;
                const objetivoEntryToRemove = listContainer.querySelector(`#objetivo_entry_${objetivoIdToRemove}`);
                if (objetivoEntryToRemove) {
                    objetivoEntryToRemove.remove();
                    // Não precisa re-numerar, os IDs são únicos e a coleta não depende da ordem visual sequencial.
                }
            }
        });
    }
}

function collectObjetivosData() {
    const container = document.getElementById("secao-objetivos");
    if (!container) return null;
    const objetivos = [];
    container.querySelectorAll(".objetivo-entry textarea").forEach(textarea => {
        if (textarea.value.trim() !== "") {
            objetivos.push({ descricao: textarea.value.trim() });
        }
    });
    return objetivos;
}

// --- Funções de Exibição de Dados Preenchidos (Novas Seções) ---
function displayIRDataHTML(dadosIR, nomePreenchedor, outrasPessoasComRenda) {
    if (!dadosIR) return "";
    let html = `<div class="form-section"><h3>Imposto de Renda (Preenchido)</h3>`;
    html += `<p><strong>${capitalizeName(nomePreenchedor ? nomePreenchedor.split(" ")[0] : "Você")} declara IR:</strong> ${dadosIR.declara_preenchedor === "sim" ? "Sim" : "Não"}</p>`;
    if (dadosIR.declara_preenchedor === "sim") {
        html += `<p><strong>Tipo:</strong> ${sanitizeInput(dadosIR.tipo_preenchedor || "Não informado")}</p>`;
        html += `<p><strong>Resultado:</strong> ${sanitizeInput(dadosIR.resultado_preenchedor || "Não informado")}</p>`;
    }
    if (dadosIR.outras_pessoas && dadosIR.outras_pessoas.length > 0) {
        dadosIR.outras_pessoas.forEach(pessoaIR => {
            const nomeRefCapitalizado = capitalizeName(pessoaIR.nome_ref ? pessoaIR.nome_ref.split(" ")[0] : "Outra Pessoa");
            html += `<div class="dynamic-entry-item"><h4>${nomeRefCapitalizado}</h4>`;
            html += `<p><strong>Declara IR:</strong> ${pessoaIR.declara === "sim" ? "Sim" : (pessoaIR.declara === "nao" ? "Não" : "Não sei informar")}</p>`;
            if (pessoaIR.declara === "sim") {
                html += `<p><strong>Tipo:</strong> ${sanitizeInput(pessoaIR.tipo || "Não informado")}</p>`;
                html += `<p><strong>Resultado:</strong> ${sanitizeInput(pessoaIR.resultado || "Não informado")}</p>`;
            }
            html += `</div>`;
        });
    }
    html += `</div>`;
    return html;
}

function displayOrcamentoDataHTML(dadosOrcamento, nomePreenchedor, outrasPessoasComRenda) {
    if (!dadosOrcamento) return "";
    let html = `<div class="form-section"><h3>Orçamento (Preenchido)</h3>`;
    html += `<p><strong>Informações de orçamento:</strong> ${dadosOrcamento.tipo_info === "unificado" ? "Unificada" : "Separada"}</p>`;
    if (dadosOrcamento.tipo_info === "unificado") {
        html += `<p><strong>Renda Mensal Total:</strong> ${formatCurrency(dadosOrcamento.renda_mensal_total)}</p>`;
        html += `<p><strong>Gastos Fixos Mensais:</strong> ${formatCurrency(dadosOrcamento.gastos_fixos_mensais)}</p>`;
        html += `<p><strong>Gastos Variáveis Mensais:</strong> ${formatCurrency(dadosOrcamento.gastos_variaveis_mensais)}</p>`;
        html += `<p><strong>Quanto Poupa Mensalmente:</strong> ${formatCurrency(dadosOrcamento.quanto_poupa_mensal)}</p>`;
    } else if (dadosOrcamento.tipo_info === "separado" && dadosOrcamento.pessoas && dadosOrcamento.pessoas.length > 0) {
        dadosOrcamento.pessoas.forEach(pessoaOrc => {
            const nomeRefCapitalizado = capitalizeName(pessoaOrc.nome_ref ? pessoaOrc.nome_ref.split(" ")[0] : "Pessoa");
            html += `<div class="dynamic-entry-item"><h4>Orçamento de ${nomeRefCapitalizado}</h4>`;
            html += `<p><strong>Renda Mensal:</strong> ${formatCurrency(pessoaOrc.renda_mensal)}</p>`;
            html += `<p><strong>Gastos Fixos:</strong> ${formatCurrency(pessoaOrc.gastos_fixos)}</p>`;
            html += `<p><strong>Gastos Variáveis:</strong> ${formatCurrency(pessoaOrc.gastos_variaveis)}</p>`;
            html += `<p><strong>Quanto Poupa:</strong> ${formatCurrency(pessoaOrc.quanto_poupa)}</p>`;
            html += `</div>`;
        });
    }
    html += `</div>`;
    return html;
}

function displayObjetivosDataHTML(dadosObjetivos) {
    if (!dadosObjetivos || dadosObjetivos.length === 0) return "";
    let html = `<div class="form-section"><h3>Objetivos (Preenchidos)</h3>`;
    dadosObjetivos.forEach((objetivo, index) => {
        html += `<div class="dynamic-entry-item"><h4>Objetivo ${index + 1}</h4>`;
        html += `<p>${sanitizeInput(objetivo.descricao)}</p>`;
        html += `</div>`;
    });
    html += `</div>`;
    return html;
}

// --- Funções Principais (do original, adaptadas para novas seções) ---

function attachFormListeners() {
    const form = document.getElementById("clientForm");
    if (form) {
        form.addEventListener("submit", handleSubmitForm);
    }

    // Listeners para campos que afetam outros (do original)
    document.getElementById("nome_completo")?.addEventListener("input", updateDynamicFormSections);
    document.querySelectorAll('input[name="renda_unica"]').forEach(radio => {
        radio.addEventListener("change", () => {
            const outrasPessoasSection = document.getElementById("outras-pessoas-renda-section");
            if (document.getElementById("renda_unica_nao").checked) {
                outrasPessoasSection.style.display = "block";
            } else {
                outrasPessoasSection.style.display = "none";
                document.getElementById("pessoas-list").innerHTML = ''; // Limpa a lista se voltar para renda única
            }
            updateDynamicFormSections();
        });
    });

    document.getElementById("add-pessoa-btn")?.addEventListener("click", () => addDynamicEntry("pessoas-list", createPessoaRendaEntry, updateDynamicFormSections));
    document.getElementById("pessoas-list")?.addEventListener("click", (event) => {
        if (event.target.classList.contains("remove-dynamic-entry-btn")) {
            removeDynamicEntry(event.target, updateDynamicFormSections);
        }
    });

    document.querySelectorAll('input[name="tem_dependentes"]').forEach(radio => {
        radio.addEventListener("change", () => {
            const dependentesSection = document.getElementById("dependentes-section-content");
            dependentesSection.style.display = document.getElementById("tem_dependentes_sim").checked ? "block" : "none";
            if (!document.getElementById("tem_dependentes_sim").checked) {
                document.getElementById("dependentes-list").innerHTML = '';
            }
            updateDynamicFormSections(); 
        });
    });
    document.getElementById("add-dependente-btn")?.addEventListener("click", () => addDynamicEntry("dependentes-list", createDependenteEntry, updateDynamicFormSections));
    document.getElementById("dependentes-list")?.addEventListener("click", (event) => {
        if (event.target.classList.contains("remove-dynamic-entry-btn")) {
            removeDynamicEntry(event.target, updateDynamicFormSections);
        }
    });

    document.querySelectorAll('input[name="tem_patrimonio_fisico"]').forEach(radio => {
        radio.addEventListener("change", () => {
            const patrimonioList = document.getElementById("patrimonio-fisico-list-container");
            patrimonioList.style.display = document.getElementById("tem_patrimonio_fisico_sim").checked ? "block" : "none";
            if (!document.getElementById("tem_patrimonio_fisico_sim").checked) {
                document.getElementById("patrimonio-fisico-list").innerHTML = '';
            }
        });
    });
    document.getElementById("add-patrimonio-fisico-btn")?.addEventListener("click", () => addDynamicEntry("patrimonio-fisico-list", createPatrimonioFisicoEntry));
    document.getElementById("patrimonio-fisico-list")?.addEventListener("click", (event) => {
        if (event.target.classList.contains("remove-dynamic-entry-btn")) removeDynamicEntry(event.target);
    });

    document.querySelectorAll('input[name="tem_patrimonio_liquido"]').forEach(radio => {
        radio.addEventListener("change", () => {
            const patrimonioList = document.getElementById("patrimonio-liquido-list-container");
            patrimonioList.style.display = document.getElementById("tem_patrimonio_liquido_sim").checked ? "block" : "none";
            if (!document.getElementById("tem_patrimonio_liquido_sim").checked) {
                document.getElementById("patrimonio-liquido-list").innerHTML = '';
            }
        });
    });
    document.getElementById("add-patrimonio-liquido-btn")?.addEventListener("click", () => addDynamicEntry("patrimonio-liquido-list", createPatrimonioLiquidoEntry));
    document.getElementById("patrimonio-liquido-list")?.addEventListener("click", (event) => {
        if (event.target.classList.contains("remove-dynamic-entry-btn")) removeDynamicEntry(event.target);
    });

    document.querySelectorAll('input[name="tem_dividas"]').forEach(radio => {
        radio.addEventListener("change", () => {
            const dividasList = document.getElementById("dividas-list-container");
            dividasList.style.display = document.getElementById("tem_dividas_sim").checked ? "block" : "none";
            if (!document.getElementById("tem_dividas_sim").checked) {
                document.getElementById("dividas-list").innerHTML = '';
            }
        });
    });
    document.getElementById("add-divida-btn")?.addEventListener("click", () => addDynamicEntry("dividas-list", createDividaEntry));
    document.getElementById("dividas-list")?.addEventListener("click", (event) => {
        if (event.target.classList.contains("remove-dynamic-entry-btn")) removeDynamicEntry(event.target);
    });

    // Listeners para as novas seções
    attachIRListeners();
    attachOrcamentoListeners(getPessoasComRenda); // Passa a função de callback
    attachObjetivosListeners();
    attachCurrencyInputListeners(document.body); // Aplicar a todos os inputs de moeda
}

function attachCurrencyInputListeners(parentElement) {
    parentElement.querySelectorAll('.currency-input').forEach(input => {
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/[^\d]/g, '');
            if (value) {
                value = (parseFloat(value) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                e.target.value = value;
            } else {
                e.target.value = '';
            }
        });
        // Formatar ao carregar, se houver valor inicial
        if(input.value){
            let initialValue = input.value.replace(/[^\d]/g, '');
            if(initialValue){
                 input.value = (parseFloat(initialValue) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }
        }
    });
}

let dynamicEntryCounters = { pessoas: 0, dependentes: 0, patrimonio_fisico: 0, patrimonio_liquido: 0, dividas: 0 };

function addDynamicEntry(listId, createEntryFunction, callback) {
    const list = document.getElementById(listId);
    const type = listId.split('-')[0]; 
    dynamicEntryCounters[type]++;
    const newEntry = createEntryFunction(dynamicEntryCounters[type]);
    list.appendChild(newEntry);
    if (callback && typeof callback === 'function') {
        callback();
    }
    attachCurrencyInputListeners(newEntry); // Aplicar aos novos campos de moeda
}

function removeDynamicEntry(button, callback) {
    button.closest(".dynamic-entry-item").remove();
    if (callback && typeof callback === 'function') {
        callback();
    }
}

function createPessoaRendaEntry(index) {
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    entryDiv.innerHTML = `
        <h4>Pessoa ${index}</h4>
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
        <div class="form-group">
            <label for="pessoa_nome_${index}">Nome:</label>
            <input type="text" id="pessoa_nome_${index}" name="pessoa_nome" required>
        </div>
        <div class="form-group">
            <label for="pessoa_parentesco_${index}">Parentesco:</label>
            <input type="text" id="pessoa_parentesco_${index}" name="pessoa_parentesco" required>
        </div>
    `;
    return entryDiv;
}

function createDependenteEntry(index) {
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    entryDiv.innerHTML = `
        <h4>Dependente ${index}</h4>
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
        <div class="form-group">
            <label for="dep_nome_${index}">Nome:</label>
            <input type="text" id="dep_nome_${index}" name="dep_nome" required>
        </div>
        <div class="form-group">
            <label for="dep_parentesco_${index}">Parentesco:</label>
            <input type="text" id="dep_parentesco_${index}" name="dep_parentesco" required>
        </div>
        <div class="form-group">
            <label for="dep_data_nasc_${index}">Data de Nascimento:</label>
            <input type="date" id="dep_data_nasc_${index}" name="dep_data_nasc" required>
        </div>
    `;
    return entryDiv;
}

function createPatrimonioFisicoEntry(index) {
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    entryDiv.innerHTML = `
        <h4>Item ${index}</h4>
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
        <div class="form-group">
            <label for="pf_descricao_${index}">Descrição (Ex: Imóvel Residencial, Carro XYZ):</label>
            <input type="text" id="pf_descricao_${index}" name="pf_descricao" required>
        </div>
        <div class="form-group">
            <label for="pf_valor_${index}">Valor Estimado (R$):</label>
            <input type="text" id="pf_valor_${index}" name="pf_valor" class="currency-input" required>
        </div>
    `;
    return entryDiv;
}

function createPatrimonioLiquidoEntry(index) {
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    entryDiv.innerHTML = `
        <h4>Investimento ${index}</h4>
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
        <div class="form-group">
            <label for="pl_tipo_${index}">Tipo (Ex: Poupança, CDB, Ações, Tesouro Direto):</label>
            <input type="text" id="pl_tipo_${index}" name="pl_tipo" required>
        </div>
        <div class="form-group">
            <label for="pl_valor_${index}">Valor Atual (R$):</label>
            <input type="text" id="pl_valor_${index}" name="pl_valor" class="currency-input" required>
        </div>
        <div class="form-group">
            <label for="pl_rentabilidade_${index}">Rentabilidade Anual Estimada (%):</label>
            <input type="number" id="pl_rentabilidade_${index}" name="pl_rentabilidade" step="0.01" placeholder="Ex: 10.5">
        </div>
    `;
    return entryDiv;
}

function createDividaEntry(index) {
    const entryDiv = document.createElement("div");
    entryDiv.classList.add("dynamic-entry-item");
    entryDiv.innerHTML = `
        <h4>Dívida ${index}</h4>
        <button type="button" class="remove-dynamic-entry-btn">Remover</button>
        <div class="form-group">
            <label for="div_descricao_${index}">Descrição (Ex: Financiamento Imobiliário, Empréstimo Pessoal):</label>
            <input type="text" id="div_descricao_${index}" name="div_descricao" required>
        </div>
        <div class="form-group">
            <label for="div_saldo_devedor_${index}">Saldo Devedor (R$):</label>
            <input type="text" id="div_saldo_devedor_${index}" name="div_saldo_devedor" class="currency-input" required>
        </div>
        <div class="form-group">
            <label for="div_taxa_juros_${index}">Taxa de Juros Anual (%):</label>
            <input type="number" id="div_taxa_juros_${index}" name="div_taxa_juros" step="0.01" placeholder="Ex: 12.75" required>
        </div>
        <div class="form-group">
            <label for="div_prazo_restante_${index}">Prazo Restante (meses):</label>
            <input type="number" id="div_prazo_restante_${index}" name="div_prazo_restante" required>
        </div>
    `;
    return entryDiv;
}

function getPessoasComRenda() {
    const pessoas = [];
    const nomePreenchedor = document.getElementById("nome_completo")?.value.trim();
    if (nomePreenchedor) {
        pessoas.push({ nome: nomePreenchedor, tipo: "preenchedor" });
    }
    if (document.getElementById("renda_unica_nao")?.checked) {
        document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach(entry => {
            const nomePessoa = entry.querySelector('input[name="pessoa_nome"]')?.value.trim();
            if (nomePessoa) {
                pessoas.push({ nome: nomePessoa, tipo: "outra_pessoa_renda" });
            }
        });
    }
    return pessoas;
}

async function handleSubmitForm(event) {
    event.preventDefault();
    const submitButton = document.getElementById("submit-button");
    submitButton.disabled = true;
    submitButton.textContent = "Enviando...";

    const formToken = document.getElementById("form_token").value;
    const clienteId = document.getElementById("cliente_id").value;

    const dadosPessoais = {
        nome_completo: sanitizeInput(document.getElementById("nome_completo").value),
        data_nascimento: sanitizeInput(document.getElementById("data_nascimento").value),
        estado_civil: sanitizeInput(document.getElementById("estado_civil").value),
        profissao: sanitizeInput(document.getElementById("profissao").value),
        email: sanitizeInput(document.getElementById("email").value),
        telefone: sanitizeInput(document.getElementById("telefone").value),
    };

    const rendaUnica = document.getElementById("renda_unica_sim").checked ? "sim" : "nao";
    const outrasPessoasRenda = [];
    if (rendaUnica === "nao") {
        document.querySelectorAll("#pessoas-list .dynamic-entry-item").forEach(entry => {
            outrasPessoasRenda.push({
                nome: sanitizeInput(entry.querySelector('input[name="pessoa_nome"]').value),
                parentesco: sanitizeInput(entry.querySelector('input[name="pessoa_parentesco"]').value),
            });
        });
    }

    const temDependentes = document.getElementById("tem_dependentes_sim").checked ? "sim" : "nao";
    const dependentes = [];
    if (temDependentes === "sim") {
        document.querySelectorAll("#dependentes-list .dynamic-entry-item").forEach(entry => {
            dependentes.push({
                nome: sanitizeInput(entry.querySelector('input[name="dep_nome"]').value),
                parentesco: sanitizeInput(entry.querySelector('input[name="dep_parentesco"]').value),
                data_nascimento: sanitizeInput(entry.querySelector('input[name="dep_data_nasc"]').value),
            });
        });
    }

    const planoSaude = [];
    document.querySelectorAll(".plano-saude-entry").forEach(entry => {
        const nameAttribute = entry.querySelector('input[type="radio"]').name;
        const selectedRadio = entry.querySelector(`input[name="${nameAttribute}"]:checked`);
        if (selectedRadio) {
            planoSaude.push({
                pessoa_nome_ref: entry.dataset.personName,
                pessoa_tipo_ref: entry.dataset.personType,
                possui_plano: selectedRadio.value
            });
        }
    });

    const seguroVida = [];
    document.querySelectorAll(".seguro-vida-entry").forEach(entry => {
        const nameAttribute = entry.querySelector('input[type="radio"]').name;
        const selectedRadio = entry.querySelector(`input[name="${nameAttribute}"]:checked`);
        if (selectedRadio) {
            seguroVida.push({
                pessoa_nome_ref: entry.dataset.personName,
                pessoa_tipo_ref: entry.dataset.personType,
                possui_seguro: selectedRadio.value
            });
        }
    });

    const temPatrimonioFisico = document.getElementById("tem_patrimonio_fisico_sim").checked ? "sim" : "nao";
    const patrimonioFisico = [];
    if (temPatrimonioFisico === "sim") {
        document.querySelectorAll("#patrimonio-fisico-list .dynamic-entry-item").forEach(entry => {
            patrimonioFisico.push({
                descricao: sanitizeInput(entry.querySelector('input[name="pf_descricao"]').value),
                valor: parseCurrency(entry.querySelector('input[name="pf_valor"]').value),
            });
        });
    }

    const temPatrimonioLiquido = document.getElementById("tem_patrimonio_liquido_sim").checked ? "sim" : "nao";
    const patrimonioLiquido = [];
    if (temPatrimonioLiquido === "sim") {
        document.querySelectorAll("#patrimonio-liquido-list .dynamic-entry-item").forEach(entry => {
            patrimonioLiquido.push({
                tipo: sanitizeInput(entry.querySelector('input[name="pl_tipo"]').value),
                valor: parseCurrency(entry.querySelector('input[name="pl_valor"]').value),
                rentabilidade_anual: parseFloat(entry.querySelector('input[name="pl_rentabilidade"]').value) || null,
            });
        });
    }

    const temDividas = document.getElementById("tem_dividas_sim").checked ? "sim" : "nao";
    const dividas = [];
    if (temDividas === "sim") {
        document.querySelectorAll("#dividas-list .dynamic-entry-item").forEach(entry => {
            dividas.push({
                descricao: sanitizeInput(entry.querySelector('input[name="div_descricao"]').value),
                saldo_devedor: parseCurrency(entry.querySelector('input[name="div_saldo_devedor"]').value),
                taxa_juros_anual: parseFloat(entry.querySelector('input[name="div_taxa_juros"]').value) || null,
                prazo_restante_meses: parseInt(entry.querySelector('input[name="div_prazo_restante"]').value) || null,
            });
        });
    }

    // Coleta de dados das novas seções
    const dadosIR = collectIRData();
    const dadosOrcamento = collectOrcamentoData();
    const dadosObjetivos = collectObjetivosData();

    const dadosFormularioCompleto = {
        dados_pessoais: dadosPessoais,
        renda_unica: rendaUnica,
        outras_pessoas_renda: outrasPessoasRenda,
        tem_dependentes: temDependentes,
        dependentes: dependentes,
        plano_saude: planoSaude,
        seguro_vida: seguroVida,
        tem_patrimonio_fisico: temPatrimonioFisico,
        patrimonio_fisico: patrimonioFisico,
        tem_patrimonio_liquido: temPatrimonioLiquido,
        patrimonio_liquido: patrimonioLiquido,
        tem_dividas: temDividas,
        dividas: dividas,
        imposto_renda: dadosIR,       // Nova seção
        orcamento: dadosOrcamento,       // Nova seção
        objetivos: dadosObjetivos        // Nova seção
    };

    try {
        const { error } = await supabase
            .from("formularios_clientes")
            .update({
                dados_formulario: dadosFormularioCompleto,
                data_preenchimento: new Date().toISOString(),
                status: "Preenchido"
            })
            .eq("token_unico", formToken);

        if (error) throw error;

        showMessage("success", "Formulário enviado com sucesso!");
        displayFilledForm(dadosFormularioCompleto, dadosPessoais.nome_completo, outrasPessoasRenda, dependentes);

    } catch (err) {
        console.error("Erro ao enviar formulário:", err);
        showMessage("error", `Erro ao enviar: ${err.message}`);
        submitButton.disabled = false;
        submitButton.textContent = "Enviar Formulário";
    }
}

function displayFilledForm(dadosSalvos, nomePreenchedorOriginal, outrasPessoasComRendaOriginal, dependentesOriginal) {
    formTitleEl.textContent = `Detalhes do Cliente - ${capitalizeName(nomePreenchedorOriginal)}`;
    let filledHTML = "<div class='form-filled-preview'>";
    filledHTML += "<h2>Formulário Preenchido</h2>";

    // Dados Pessoais
    filledHTML += "<div class='form-section'><h3>Dados Pessoais</h3>";
    for (const [key, value] of Object.entries(dadosSalvos.dados_pessoais)) {
        filledHTML += `<p><strong>${capitalizeName(key.replace(/_/g, " "))}:</strong> ${sanitizeInput(value)}</p>`;
    }
    filledHTML += "</div>";

    // Renda
    filledHTML += "<div class='form-section'><h3>Renda</h3>";
    filledHTML += `<p><strong>Renda única:</strong> ${dadosSalvos.renda_unica === "sim" ? "Sim" : "Não"}</p>`;
    if (dadosSalvos.outras_pessoas_renda && dadosSalvos.outras_pessoas_renda.length > 0) {
        filledHTML += "<h4>Outras Pessoas com Renda:</h4>";
        dadosSalvos.outras_pessoas_renda.forEach(p => {
            filledHTML += `<div class='dynamic-entry-item'><p><strong>Nome:</strong> ${sanitizeInput(p.nome)}</p><p><strong>Parentesco:</strong> ${sanitizeInput(p.parentesco)}</p></div>`;
        });
    }
    filledHTML += "</div>";

    // Dependentes
    filledHTML += "<div class='form-section'><h3>Dependentes</h3>";
    filledHTML += `<p><strong>Possui dependentes:</strong> ${dadosSalvos.tem_dependentes === "sim" ? "Sim" : "Não"}</p>`;
    if (dadosSalvos.dependentes && dadosSalvos.dependentes.length > 0) {
        filledHTML += "<h4>Lista de Dependentes:</h4>";
        dadosSalvos.dependentes.forEach(d => {
            filledHTML += `<div class='dynamic-entry-item'><p><strong>Nome:</strong> ${sanitizeInput(d.nome)}</p><p><strong>Parentesco:</strong> ${sanitizeInput(d.parentesco)}</p><p><strong>Data de Nascimento:</strong> ${sanitizeInput(d.data_nascimento)}</p></div>`;
        });
    }
    filledHTML += "</div>";

    // Plano de Saúde
    if (dadosSalvos.plano_saude && dadosSalvos.plano_saude.length > 0) {
        filledHTML += "<div class='form-section'><h3>Plano de Saúde</h3>";
        dadosSalvos.plano_saude.forEach(p => {
            filledHTML += `<p><strong>${capitalizeName(p.pessoa_nome_ref ? p.pessoa_nome_ref.split(' ')[0] : 'Pessoa')} possui plano:</strong> ${sanitizeInput(p.possui_plano)}</p>`;
        });
        filledHTML += "</div>";
    }

    // Seguro de Vida
    if (dadosSalvos.seguro_vida && dadosSalvos.seguro_vida.length > 0) {
        filledHTML += "<div class='form-section'><h3>Seguro de Vida</h3>";
        dadosSalvos.seguro_vida.forEach(s => {
            filledHTML += `<p><strong>${capitalizeName(s.pessoa_nome_ref ? s.pessoa_nome_ref.split(' ')[0] : 'Pessoa')} possui seguro:</strong> ${sanitizeInput(s.possui_seguro)}</p>`;
        });
        filledHTML += "</div>";
    }

    // Patrimônio Físico
    filledHTML += "<div class='form-section'><h3>Patrimônio Físico</h3>";
    filledHTML += `<p><strong>Possui patrimônio físico:</strong> ${dadosSalvos.tem_patrimonio_fisico === "sim" ? "Sim" : "Não"}</p>`;
    if (dadosSalvos.patrimonio_fisico && dadosSalvos.patrimonio_fisico.length > 0) {
        filledHTML += "<h4>Itens de Patrimônio Físico:</h4>";
        dadosSalvos.patrimonio_fisico.forEach(item => {
            filledHTML += `<div class='dynamic-entry-item'><p><strong>Descrição:</strong> ${sanitizeInput(item.descricao)}</p><p><strong>Valor:</strong> ${formatCurrency(item.valor)}</p></div>`;
        });
    }
    filledHTML += "</div>";

    // Patrimônio Líquido
    filledHTML += "<div class='form-section'><h3>Patrimônio Líquido (Investimentos)</h3>";
    filledHTML += `<p><strong>Possui patrimônio líquido:</strong> ${dadosSalvos.tem_patrimonio_liquido === "sim" ? "Sim" : "Não"}</p>`;
    if (dadosSalvos.patrimonio_liquido && dadosSalvos.patrimonio_liquido.length > 0) {
        filledHTML += "<h4>Investimentos:</h4>";
        dadosSalvos.patrimonio_liquido.forEach(inv => {
            filledHTML += `<div class='dynamic-entry-item'><p><strong>Tipo:</strong> ${sanitizeInput(inv.tipo)}</p><p><strong>Valor:</strong> ${formatCurrency(inv.valor)}</p><p><strong>Rentabilidade Anual:</strong> ${inv.rentabilidade_anual !== null ? sanitizeInput(inv.rentabilidade_anual) + '%' : 'N/A'}</p></div>`;
        });
    }
    filledHTML += "</div>";

    // Dívidas
    filledHTML += "<div class='form-section'><h3>Dívidas</h3>";
    filledHTML += `<p><strong>Possui dívidas:</strong> ${dadosSalvos.tem_dividas === "sim" ? "Sim" : "Não"}</p>`;
    if (dadosSalvos.dividas && dadosSalvos.dividas.length > 0) {
        filledHTML += "<h4>Lista de Dívidas:</h4>";
        dadosSalvos.dividas.forEach(div => {
            filledHTML += `<div class='dynamic-entry-item'><p><strong>Descrição:</strong> ${sanitizeInput(div.descricao)}</p><p><strong>Saldo Devedor:</strong> ${formatCurrency(div.saldo_devedor)}</p><p><strong>Taxa de Juros Anual:</strong> ${div.taxa_juros_anual !== null ? sanitizeInput(div.taxa_juros_anual) + '%' : 'N/A'}</p><p><strong>Prazo Restante (meses):</strong> ${div.prazo_restante_meses !== null ? sanitizeInput(div.prazo_restante_meses) : 'N/A'}</p></div>`;
        });
    }
    filledHTML += "</div>";

    // Exibição das Novas Seções
    filledHTML += displayIRDataHTML(dadosSalvos.imposto_renda, nomePreenchedorOriginal, outrasPessoasComRendaOriginal);
    filledHTML += displayOrcamentoDataHTML(dadosSalvos.orcamento, nomePreenchedorOriginal, outrasPessoasComRendaOriginal);
    filledHTML += displayObjetivosDataHTML(dadosSalvos.objetivos);

    filledHTML += "</div>"; // Fecha form-filled-preview
    formContentEl.innerHTML = filledHTML;
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    loadForm(token);
});



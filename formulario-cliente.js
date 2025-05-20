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
let orcamentoSelections = {}; // Estado para preservar seleções de orçamento

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

// Função para gerar UUID v4 válido
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Função para buscar cliente pelo token único
async function getClienteByToken(token) {
    try {
        const { data, error } = await supabase
            .from('formularios_clientes')
            .select('cliente_id')
            .eq('token_unico', token)
            .single();
            
        if (error) throw error;
        if (!data) throw new Error('Token inválido ou expirado.');
        
        return data.cliente_id;
    } catch (error) {
        console.error('Erro ao buscar cliente pelo token:', error);
        throw error;
    }
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

function updatePerguntaInvestimentosLabel() {
    const labelTemInvestimentos = document.getElementById("label_tem_investimentos");
    if (!labelTemInvestimentos) return;
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
        labelTemInvestimentos.textContent = "Você possui investimentos (poupança, CDB, ações, outros...)?";
    } else if (temOutrasPessoasComRenda) {
        labelTemInvestimentos.textContent = "Vocês possuem investimentos (poupança, CDB, ações, outros...)?";
    } else {
        labelTemInvestimentos.textContent = "Você possui investimentos (poupança, CDB, ações, outros...)?";
    }
}

function updatePerguntaDividasLabel() {
    const labelTemDividas = document.getElementById("label_tem_dividas");
    if (!labelTemDividas) return;
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
        labelTemDividas.textContent = "Você possui dívidas?";
    } else if (temOutrasPessoasComRenda) {
        labelTemDividas.textContent = "Vocês possuem dívidas?";
    } else {
        labelTemDividas.textContent = "Você possui dívidas?";
    }
}

function updatePerguntaPlanoSaudeLabel() {
    const labelTemPlanoSaude = document.getElementById("label_tem_plano_saude");
    if (!labelTemPlanoSaude) return;
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
        labelTemPlanoSaude.textContent = "Você possui plano de saúde?";
    } else if (temOutrasPessoasComRenda) {
        labelTemPlanoSaude.textContent = "Vocês possuem plano de saúde?";
    } else {
        labelTemPlanoSaude.textContent = "Você possui plano de saúde?";
    }
}

function updatePerguntaSeguroVidaLabel() {
    const labelTemSeguroVida = document.getElementById("label_tem_seguro_vida");
    if (!labelTemSeguroVida) return;
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
        labelTemSeguroVida.textContent = "Você possui seguro de vida?";
    } else if (temOutrasPessoasComRenda) {
        labelTemSeguroVida.textContent = "Vocês possuem seguro de vida?";
    } else {
        labelTemSeguroVida.textContent = "Você possui seguro de vida?";
    }
}

function updateDynamicFormSections() {
    // Atualizar seção de outras pessoas com renda
    const rendaUnicaSimRadio = document.getElementById("renda_unica_sim");
    const rendaUnicaNaoRadio = document.getElementById("renda_unica_nao");
    const outrasPessoasSection = document.getElementById("outras-pessoas-section");
    
    if (rendaUnicaNaoRadio && rendaUnicaNaoRadio.checked) {
        outrasPessoasSection.style.display = "block";
    } else if (rendaUnicaSimRadio && rendaUnicaSimRadio.checked) {
        outrasPessoasSection.style.display = "none";
    }
    
    // Atualizar seção de dependentes
    const temDependentesSimRadio = document.getElementById("tem_dependentes_sim");
    const temDependentesNaoRadio = document.getElementById("tem_dependentes_nao");
    const dependentesSection = document.getElementById("dependentes-section");
    
    if (temDependentesSimRadio && temDependentesSimRadio.checked) {
        dependentesSection.style.display = "block";
    } else if (temDependentesNaoRadio && temDependentesNaoRadio.checked) {
        dependentesSection.style.display = "none";
    }
    
    // Atualizar seção de patrimônio físico
    const temPatrimonioSimRadio = document.getElementById("tem_patrimonio_sim");
    const temPatrimonioNaoRadio = document.getElementById("tem_patrimonio_nao");
    const patrimonioSection = document.getElementById("patrimonio-section");
    
    if (temPatrimonioSimRadio && temPatrimonioSimRadio.checked) {
        patrimonioSection.style.display = "block";
    } else if (temPatrimonioNaoRadio && temPatrimonioNaoRadio.checked) {
        patrimonioSection.style.display = "none";
    }
    
    // Atualizar seção de investimentos
    const temInvestimentosSimRadio = document.getElementById("tem_investimentos_sim");
    const temInvestimentosNaoRadio = document.getElementById("tem_investimentos_nao");
    const investimentosSection = document.getElementById("investimentos-section");
    
    if (temInvestimentosSimRadio && temInvestimentosSimRadio.checked) {
        investimentosSection.style.display = "block";
    } else if (temInvestimentosNaoRadio && temInvestimentosNaoRadio.checked) {
        investimentosSection.style.display = "none";
    }
    
    // Atualizar seção de dívidas
    const temDividasSimRadio = document.getElementById("tem_dividas_sim");
    const temDividasNaoRadio = document.getElementById("tem_dividas_nao");
    const dividasSection = document.getElementById("dividas-section");
    
    if (temDividasSimRadio && temDividasSimRadio.checked) {
        dividasSection.style.display = "block";
    } else if (temDividasNaoRadio && temDividasNaoRadio.checked) {
        dividasSection.style.display = "none";
    }
    
    // Atualizar seção de plano de saúde
    const temPlanoSaudeSimRadio = document.getElementById("tem_plano_saude_sim");
    const temPlanoSaudeNaoRadio = document.getElementById("tem_plano_saude_nao");
    const planoSaudeSectionTitle = document.getElementById("plano-saude-section-title");
    const planoSaudeSectionContent = document.getElementById("plano-saude-section-content");
    
    if (temPlanoSaudeSimRadio && temPlanoSaudeSimRadio.checked) {
        planoSaudeSectionTitle.style.display = "block";
        planoSaudeSectionContent.style.display = "block";
    } else if (temPlanoSaudeNaoRadio && temPlanoSaudeNaoRadio.checked) {
        planoSaudeSectionTitle.style.display = "none";
        planoSaudeSectionContent.style.display = "none";
    }
    
    // Atualizar seção de seguro de vida
    const temSeguroVidaSimRadio = document.getElementById("tem_seguro_vida_sim");
    const temSeguroVidaNaoRadio = document.getElementById("tem_seguro_vida_nao");
    const seguroVidaSectionTitle = document.getElementById("seguro-vida-section-title");
    const seguroVidaSectionContent = document.getElementById("seguro-vida-section-content");
    
    if (temSeguroVidaSimRadio && temSeguroVidaSimRadio.checked) {
        seguroVidaSectionTitle.style.display = "block";
        seguroVidaSectionContent.style.display = "block";
    } else if (temSeguroVidaNaoRadio && temSeguroVidaNaoRadio.checked) {
        seguroVidaSectionTitle.style.display = "none";
        seguroVidaSectionContent.style.display = "none";
    }
    
    // Atualizar labels das perguntas
    updatePerguntaDependentesLabel();
    updatePerguntaPatrimonioFisicoLabel();
    updatePerguntaInvestimentosLabel();
    updatePerguntaDividasLabel();
    updatePerguntaPlanoSaudeLabel();
    updatePerguntaSeguroVidaLabel();
    
    // Atualizar seções dinâmicas
    renderPlanoSaudeQuestions();
    renderSeguroVidaQuestions();
    renderImpostoRendaQuestions(); // Função para imposto de renda
    renderOrcamentoQuestions(); // Função para orçamento
}

// Função para salvar as seleções de plano de saúde
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

// Função para restaurar as seleções de plano de saúde
function restorePlanoSaudeSelections() {
    Object.keys(planoSaudeSelections).forEach(nameAttribute => {
        const value = planoSaudeSelections[nameAttribute];
        const radioToSelect = document.querySelector(`input[name="${nameAttribute}"][value="${value}"]`);
        if (radioToSelect) {
            radioToSelect.checked = true;
        }
    });
}

// Função para renderizar as perguntas de plano de saúde
function renderPlanoSaudeQuestions() {
    savePlanoSaudeSelections(); 
    const container = document.getElementById("plano-saude-section-content");
    if (!container) return;
    container.innerHTML = '';
    const pessoasDaCasa = [];
    const nomeCompletoInput = document.getElementById("nome_completo");
    if (nomeCompletoInput && nomeCompletoInput.value.trim() !== "") {
        pessoasDaCasa.push({ id: "preenchedor_plano", nome: sanitizeInput(nomeCompletoInput.value) });
    }
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        document.querySelectorAll("#pessoas-list .dynamic-entry").forEach((entry, index) => {
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasDaCasa.push({ id: `outra_pessoa_plano_${index}`, nome: sanitizeInput(nomeInput.value) });
            }
        });
    }
    if (document.getElementById("tem_dependentes_sim") && document.getElementById("tem_dependentes_sim").checked) {
        document.querySelectorAll("#dependentes-list .dynamic-entry").forEach((entry, index) => {
            const nomeInput = entry.querySelector('input[name="dependente_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasDaCasa.push({ id: `dependente_plano_${index}`, nome: sanitizeInput(nomeInput.value) });
            }
        });
    }
    
    if (pessoasDaCasa.length > 0 && document.getElementById("tem_plano_saude_sim") && document.getElementById("tem_plano_saude_sim").checked) {
        pessoasDaCasa.forEach(pessoa => {
            const pessoaId = pessoa.id;
            const pessoaNome = capitalizeName(pessoa.nome.split(' ')[0]); // Pegar primeiro nome
            const entryHTML = `
                <div class="plano-saude-entry">
                    <p>${pessoaNome} possui plano de saúde?</p>
                    <div class="radio-group">
                        <input type="radio" id="${pessoaId}_sim" name="${pessoaId}" value="sim">
                        <label for="${pessoaId}_sim">Sim</label>
                        <input type="radio" id="${pessoaId}_nao" name="${pessoaId}" value="nao">
                        <label for="${pessoaId}_nao">Não</label>
                    </div>
                </div>
            `;
            container.innerHTML += entryHTML;
        });
    }
    restorePlanoSaudeSelections();
}

// Função para salvar as seleções de seguro de vida
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

// Função para restaurar as seleções de seguro de vida
function restoreSeguroVidaSelections() {
    Object.keys(seguroVidaSelections).forEach(nameAttribute => {
        const value = seguroVidaSelections[nameAttribute];
        const radioToSelect = document.querySelector(`input[name="${nameAttribute}"][value="${value}"]`);
        if (radioToSelect) {
            radioToSelect.checked = true;
        }
    });
}

// Função para renderizar as perguntas de seguro de vida
function renderSeguroVidaQuestions() {
    saveSeguroVidaSelections(); 
    const container = document.getElementById("seguro-vida-section-content");
    if (!container) return;
    container.innerHTML = '';
    const pessoasDaCasa = [];
    const nomeCompletoInput = document.getElementById("nome_completo");
    if (nomeCompletoInput && nomeCompletoInput.value.trim() !== "") {
        pessoasDaCasa.push({ id: "preenchedor_seguro", nome: sanitizeInput(nomeCompletoInput.value) });
    }
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        document.querySelectorAll("#pessoas-list .dynamic-entry").forEach((entry, index) => {
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                pessoasDaCasa.push({ id: `outra_pessoa_seguro_${index}`, nome: sanitizeInput(nomeInput.value) });
            }
        });
    }
    
    if (pessoasDaCasa.length > 0 && document.getElementById("tem_seguro_vida_sim") && document.getElementById("tem_seguro_vida_sim").checked) {
        pessoasDaCasa.forEach(pessoa => {
            const pessoaId = pessoa.id;
            const pessoaNome = capitalizeName(pessoa.nome.split(' ')[0]); // Pegar primeiro nome
            const entryHTML = `
                <div class="seguro-vida-entry">
                    <p>${pessoaNome} possui seguro de vida?</p>
                    <div class="radio-group">
                        <input type="radio" id="${pessoaId}_sim" name="${pessoaId}" value="sim">
                        <label for="${pessoaId}_sim">Sim</label>
                        <input type="radio" id="${pessoaId}_nao" name="${pessoaId}" value="nao">
                        <label for="${pessoaId}_nao">Não</label>
                    </div>
                </div>
            `;
            container.innerHTML += entryHTML;
        });
    }
    restoreSeguroVidaSelections();
}

// Função para salvar as seleções de imposto de renda
function saveImpostoRendaSelections() {
    impostoRendaSelections = {};
    
    // Salvar seleção do preenchedor
    const preenchedor_declara = document.querySelector('input[name="preenchedor_imposto_renda"]:checked')?.value;
    if (preenchedor_declara) {
        impostoRendaSelections["preenchedor"] = {
            declara: preenchedor_declara
        };
        
        // Se declara, salvar tipo e resultado
        if (preenchedor_declara === "sim") {
            const tipo = document.querySelector('input[name="preenchedor_imposto_tipo"]:checked')?.value;
            const resultado = document.querySelector('input[name="preenchedor_imposto_resultado"]:checked')?.value;
            
            if (tipo) impostoRendaSelections["preenchedor"].tipo = tipo;
            if (resultado) impostoRendaSelections["preenchedor"].resultado = resultado;
        }
    }
    
    // Salvar seleções de outras pessoas com renda
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        document.querySelectorAll("#pessoas-list .dynamic-entry").forEach((entry, index) => {
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                const pessoaNome = sanitizeInput(nomeInput.value);
                const declara = document.querySelector(`input[name="pessoa_imposto_renda_${index}"]:checked`)?.value;
                
                if (declara) {
                    impostoRendaSelections[pessoaNome] = {
                        declara: declara
                    };
                    
                    // Se declara, salvar tipo e resultado
                    if (declara === "sim") {
                        const tipo = document.querySelector(`input[name="pessoa_imposto_tipo_${index}"]:checked`)?.value;
                        const resultado = document.querySelector(`input[name="pessoa_imposto_resultado_${index}"]:checked`)?.value;
                        
                        if (tipo) impostoRendaSelections[pessoaNome].tipo = tipo;
                        if (resultado) impostoRendaSelections[pessoaNome].resultado = resultado;
                    }
                }
            }
        });
    }
}

// Função para restaurar as seleções de imposto de renda
function restoreImpostoRendaSelections() {
    // Restaurar seleção do preenchedor
    if (impostoRendaSelections["preenchedor"]) {
        const declara = impostoRendaSelections["preenchedor"].declara;
        const radioToSelect = document.querySelector(`input[name="preenchedor_imposto_renda"][value="${declara}"]`);
        if (radioToSelect) {
            radioToSelect.checked = true;
            
            // Se declara, restaurar tipo e resultado
            if (declara === "sim") {
                const tipo = impostoRendaSelections["preenchedor"].tipo;
                const resultado = impostoRendaSelections["preenchedor"].resultado;
                
                if (tipo) {
                    const tipoRadio = document.querySelector(`input[name="preenchedor_imposto_tipo"][value="${tipo}"]`);
                    if (tipoRadio) tipoRadio.checked = true;
                }
                
                if (resultado) {
                    const resultadoRadio = document.querySelector(`input[name="preenchedor_imposto_resultado"][value="${resultado}"]`);
                    if (resultadoRadio) resultadoRadio.checked = true;
                }
                
                // Mostrar perguntas adicionais
                const perguntasAdicionais = document.getElementById("preenchedor_perguntas_adicionais");
                if (perguntasAdicionais) perguntasAdicionais.style.display = "block";
            }
        }
    }
    
    // Restaurar seleções de outras pessoas com renda
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        document.querySelectorAll("#pessoas-list .dynamic-entry").forEach((entry, index) => {
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                const pessoaNome = sanitizeInput(nomeInput.value);
                
                if (impostoRendaSelections[pessoaNome]) {
                    const declara = impostoRendaSelections[pessoaNome].declara;
                    const radioToSelect = document.querySelector(`input[name="pessoa_imposto_renda_${index}"][value="${declara}"]`);
                    
                    if (radioToSelect) {
                        radioToSelect.checked = true;
                        
                        // Se declara, restaurar tipo e resultado
                        if (declara === "sim") {
                            const tipo = impostoRendaSelections[pessoaNome].tipo;
                            const resultado = impostoRendaSelections[pessoaNome].resultado;
                            
                            if (tipo) {
                                const tipoRadio = document.querySelector(`input[name="pessoa_imposto_tipo_${index}"][value="${tipo}"]`);
                                if (tipoRadio) tipoRadio.checked = true;
                            }
                            
                            if (resultado) {
                                const resultadoRadio = document.querySelector(`input[name="pessoa_imposto_resultado_${index}"][value="${resultado}"]`);
                                if (resultadoRadio) resultadoRadio.checked = true;
                            }
                            
                            // Mostrar perguntas adicionais
                            const perguntasAdicionais = document.getElementById(`pessoa_perguntas_adicionais_${index}`);
                            if (perguntasAdicionais) perguntasAdicionais.style.display = "block";
                        }
                    }
                }
            }
        });
    }
}

// Função para renderizar as perguntas de imposto de renda
function renderImpostoRendaQuestions() {
    saveImpostoRendaSelections();
    
    // Renderizar pergunta para o preenchedor
    const impostoRendaSection = document.getElementById("imposto-renda-section");
    if (!impostoRendaSection) return;
    
    const nomeCompletoInput = document.getElementById("nome_completo");
    if (!nomeCompletoInput || nomeCompletoInput.value.trim() === "") return;
    
    const preenchedor = sanitizeInput(nomeCompletoInput.value);
    const preenchedor_primeiro_nome = capitalizeName(preenchedor.split(' ')[0]);
    
    // Limpar seção de imposto de renda
    impostoRendaSection.innerHTML = `
        <h3>Informações sobre Imposto de Renda:</h3>
        <div class="imposto-renda-entry">
            <p>Você declara imposto de renda?</p>
            <div class="radio-group" style="display: flex; flex-wrap: nowrap; width: 100%;">
                <label style="white-space: nowrap; margin-right: 15px; font-size: 13px;">
                    <input type="radio" id="preenchedor_imposto_renda_sim" name="preenchedor_imposto_renda" value="sim">
                    Sim
                </label>
                <label style="white-space: nowrap; font-size: 13px;">
                    <input type="radio" id="preenchedor_imposto_renda_nao" name="preenchedor_imposto_renda" value="nao">
                    Não
                </label>
            </div>
            
            <div id="preenchedor_perguntas_adicionais" style="display: none; margin-top: 10px;">
                <p>Qual o tipo?</p>
                <div class="radio-group" style="display: flex; flex-wrap: nowrap; width: 100%;">
                    <label style="white-space: nowrap; margin-right: 15px; font-size: 13px;">
                        <input type="radio" id="preenchedor_imposto_tipo_simples" name="preenchedor_imposto_tipo" value="simples">
                        Simples
                    </label>
                    <label style="white-space: nowrap; margin-right: 15px; font-size: 13px;">
                        <input type="radio" id="preenchedor_imposto_tipo_completa" name="preenchedor_imposto_tipo" value="completa">
                        Dedução Completa
                    </label>
                    <label style="white-space: nowrap; font-size: 13px;">
                        <input type="radio" id="preenchedor_imposto_tipo_nao_sei" name="preenchedor_imposto_tipo" value="nao_sei">
                        Não Sei Informar
                    </label>
                </div>
                
                <p>Qual o resultado?</p>
                <div class="radio-group" style="display: flex; flex-wrap: nowrap; width: 100%;">
                    <label style="white-space: nowrap; margin-right: 15px; font-size: 13px;">
                        <input type="radio" id="preenchedor_imposto_resultado_paga" name="preenchedor_imposto_resultado" value="paga">
                        Paga
                    </label>
                    <label style="white-space: nowrap; margin-right: 15px; font-size: 13px;">
                        <input type="radio" id="preenchedor_imposto_resultado_recebe" name="preenchedor_imposto_resultado" value="recebe">
                        Recebe
                    </label>
                    <label style="white-space: nowrap; margin-right: 15px; font-size: 13px;">
                        <input type="radio" id="preenchedor_imposto_resultado_isento" name="preenchedor_imposto_resultado" value="isento">
                        Isento
                    </label>
                    <label style="white-space: nowrap; font-size: 13px;">
                        <input type="radio" id="preenchedor_imposto_resultado_nao_sei" name="preenchedor_imposto_resultado" value="nao_sei">
                        Não Sei Informar
                    </label>
                </div>
            </div>
        </div>
    `;
    
    // Adicionar event listener para mostrar/esconder perguntas adicionais
    document.getElementById("preenchedor_imposto_renda_sim").addEventListener("change", function() {
        document.getElementById("preenchedor_perguntas_adicionais").style.display = "block";
    });
    
    document.getElementById("preenchedor_imposto_renda_nao").addEventListener("change", function() {
        document.getElementById("preenchedor_perguntas_adicionais").style.display = "none";
    });
    
    // Renderizar perguntas para outras pessoas com renda
    if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
        document.querySelectorAll("#pessoas-list .dynamic-entry").forEach((entry, index) => {
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                const pessoaNome = sanitizeInput(nomeInput.value);
                const pessoaPrimeiroNome = capitalizeName(pessoaNome.split(' ')[0]);
                
                const pessoaHTML = `
                    <div class="imposto-renda-entry pessoa-imposto-renda-${index}">
                        <p>${pessoaPrimeiroNome} declara imposto de renda?</p>
                        <div class="radio-group" style="display: flex; flex-wrap: nowrap; width: 100%;">
                            <label style="white-space: nowrap; margin-right: 15px; font-size: 13px;">
                                <input type="radio" id="pessoa_imposto_renda_${index}_sim" name="pessoa_imposto_renda_${index}" value="sim">
                                Sim
                            </label>
                            <label style="white-space: nowrap; margin-right: 15px; font-size: 13px;">
                                <input type="radio" id="pessoa_imposto_renda_${index}_nao" name="pessoa_imposto_renda_${index}" value="nao">
                                Não
                            </label>
                            <label style="white-space: nowrap; font-size: 13px;">
                                <input type="radio" id="pessoa_imposto_renda_${index}_nao_sei" name="pessoa_imposto_renda_${index}" value="nao_sei">
                                Não Sei Informar
                            </label>
                        </div>
                        
                        <div id="pessoa_perguntas_adicionais_${index}" style="display: none; margin-top: 10px;">
                            <p>Qual o tipo?</p>
                            <div class="radio-group" style="display: flex; flex-wrap: nowrap; width: 100%;">
                                <label style="white-space: nowrap; margin-right: 15px; font-size: 13px;">
                                    <input type="radio" id="pessoa_imposto_tipo_${index}_simples" name="pessoa_imposto_tipo_${index}" value="simples">
                                    Simples
                                </label>
                                <label style="white-space: nowrap; margin-right: 15px; font-size: 13px;">
                                    <input type="radio" id="pessoa_imposto_tipo_${index}_completa" name="pessoa_imposto_tipo_${index}" value="completa">
                                    Dedução Completa
                                </label>
                                <label style="white-space: nowrap; font-size: 13px;">
                                    <input type="radio" id="pessoa_imposto_tipo_${index}_nao_sei" name="pessoa_imposto_tipo_${index}" value="nao_sei">
                                    Não Sei Informar
                                </label>
                            </div>
                            
                            <p>Qual o resultado?</p>
                            <div class="radio-group" style="display: flex; flex-wrap: nowrap; width: 100%;">
                                <label style="white-space: nowrap; margin-right: 15px; font-size: 13px;">
                                    <input type="radio" id="pessoa_imposto_resultado_${index}_paga" name="pessoa_imposto_resultado_${index}" value="paga">
                                    Paga
                                </label>
                                <label style="white-space: nowrap; margin-right: 15px; font-size: 13px;">
                                    <input type="radio" id="pessoa_imposto_resultado_${index}_recebe" name="pessoa_imposto_resultado_${index}" value="recebe">
                                    Recebe
                                </label>
                                <label style="white-space: nowrap; margin-right: 15px; font-size: 13px;">
                                    <input type="radio" id="pessoa_imposto_resultado_${index}_isento" name="pessoa_imposto_resultado_${index}" value="isento">
                                    Isento
                                </label>
                                <label style="white-space: nowrap; font-size: 13px;">
                                    <input type="radio" id="pessoa_imposto_resultado_${index}_nao_sei" name="pessoa_imposto_resultado_${index}" value="nao_sei">
                                    Não Sei Informar
                                </label>
                            </div>
                        </div>
                    </div>
                `;
                
                impostoRendaSection.innerHTML += pessoaHTML;
                
                // Adicionar event listener para mostrar/esconder perguntas adicionais
                setTimeout(() => {
                    const simRadio = document.getElementById(`pessoa_imposto_renda_${index}_sim`);
                    const naoRadio = document.getElementById(`pessoa_imposto_renda_${index}_nao`);
                    const naoSeiRadio = document.getElementById(`pessoa_imposto_renda_${index}_nao_sei`);
                    
                    if (simRadio) {
                        simRadio.addEventListener("change", function() {
                            document.getElementById(`pessoa_perguntas_adicionais_${index}`).style.display = "block";
                        });
                    }
                    
                    if (naoRadio) {
                        naoRadio.addEventListener("change", function() {
                            document.getElementById(`pessoa_perguntas_adicionais_${index}`).style.display = "none";
                        });
                    }
                    
                    if (naoSeiRadio) {
                        naoSeiRadio.addEventListener("change", function() {
                            document.getElementById(`pessoa_perguntas_adicionais_${index}`).style.display = "none";
                        });
                    }
                }, 0);
            }
        });
    }
    
    // Restaurar seleções anteriores
    restoreImpostoRendaSelections();
    
    // Adicionar event listener para atualizar quando o nome de uma pessoa é alterado
    document.querySelectorAll('#pessoas-list input[name="pessoa_nome"]').forEach((input, index) => {
        input.addEventListener("input", function() {
            const pessoaImpostoRendaEntry = document.querySelector(`.pessoa-imposto-renda-${index}`);
            
            if (this.value.trim() === "") {
                // Se o nome estiver vazio, esconder a entrada
                if (pessoaImpostoRendaEntry) {
                    pessoaImpostoRendaEntry.style.display = "none";
                }
            } else {
                // Se o nome não estiver vazio, mostrar a entrada e atualizar o nome
                if (pessoaImpostoRendaEntry) {
                    pessoaImpostoRendaEntry.style.display = "block";
                    const pessoaPrimeiroNome = capitalizeName(this.value.split(' ')[0]);
                    const perguntaElement = pessoaImpostoRendaEntry.querySelector("p:first-child");
                    if (perguntaElement) {
                        perguntaElement.textContent = `${pessoaPrimeiroNome} declara imposto de renda?`;
                    }
                } else {
                    // Se a entrada não existir, renderizar novamente
                    renderImpostoRendaQuestions();
                }
            }
        });
    });
}

// Função para salvar as seleções de orçamento
function saveOrcamentoSelections() {
    orcamentoSelections = {};
    
    // Salvar tipo de orçamento (conjunto ou individual)
    const tipoOrcamento = document.querySelector('input[name="tipo_orcamento"]:checked')?.value;
    if (tipoOrcamento) {
        orcamentoSelections.tipo = tipoOrcamento;
    }
    
    // Salvar dados de orçamento conjunto
    if (tipoOrcamento === "conjunto") {
        orcamentoSelections.conjunto = {
            entradas: document.getElementById("orcamento_conjunto_entradas")?.value,
            despesas_fixas: document.getElementById("orcamento_conjunto_despesas_fixas")?.value,
            despesas_variaveis: document.getElementById("orcamento_conjunto_despesas_variaveis")?.value,
            valor_poupado: document.getElementById("orcamento_conjunto_valor_poupado")?.value
        };
    }
    
    // Salvar dados de orçamento individual
    if (tipoOrcamento === "individual" || !tipoOrcamento) {
        orcamentoSelections.individual = {};
        
        // Salvar dados do preenchedor
        orcamentoSelections.individual.preenchedor = {
            entradas: document.getElementById("orcamento_preenchedor_entradas")?.value,
            despesas_fixas: document.getElementById("orcamento_preenchedor_despesas_fixas")?.value,
            despesas_variaveis: document.getElementById("orcamento_preenchedor_despesas_variaveis")?.value,
            valor_poupado: document.getElementById("orcamento_preenchedor_valor_poupado")?.value
        };
        
        // Salvar dados de outras pessoas com renda
        if (document.getElementById("renda_unica_nao") && document.getElementById("renda_unica_nao").checked) {
            document.querySelectorAll("#pessoas-list .dynamic-entry").forEach((entry, index) => {
                const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
                if (nomeInput && nomeInput.value.trim() !== "") {
                    const pessoaNome = sanitizeInput(nomeInput.value);
                    
                    orcamentoSelections.individual[`pessoa_${index}`] = {
                        nome: pessoaNome,
                        entradas: document.getElementById(`orcamento_pessoa_${index}_entradas`)?.value,
                        despesas_fixas: document.getElementById(`orcamento_pessoa_${index}_despesas_fixas`)?.value,
                        despesas_variaveis: document.getElementById(`orcamento_pessoa_${index}_despesas_variaveis`)?.value,
                        valor_poupado: document.getElementById(`orcamento_pessoa_${index}_valor_poupado`)?.value
                    };
                }
            });
        }
    }
}

// Função para restaurar as seleções de orçamento
function restoreOrcamentoSelections() {
    // Restaurar tipo de orçamento
    if (orcamentoSelections.tipo) {
        const tipoRadio = document.querySelector(`input[name="tipo_orcamento"][value="${orcamentoSelections.tipo}"]`);
        if (tipoRadio) {
            tipoRadio.checked = true;
            
            // Mostrar seção correspondente
            if (orcamentoSelections.tipo === "conjunto") {
                document.getElementById("orcamento-conjunto-section").style.display = "block";
                document.getElementById("orcamento-individual-section").style.display = "none";
            } else if (orcamentoSelections.tipo === "individual") {
                document.getElementById("orcamento-conjunto-section").style.display = "none";
                document.getElementById("orcamento-individual-section").style.display = "block";
            }
        }
    }
    
    // Restaurar dados de orçamento conjunto
    if (orcamentoSelections.conjunto) {
        document.getElementById("orcamento_conjunto_entradas").value = orcamentoSelections.conjunto.entradas || "";
        document.getElementById("orcamento_conjunto_despesas_fixas").value = orcamentoSelections.conjunto.despesas_fixas || "";
        document.getElementById("orcamento_conjunto_despesas_variaveis").value = orcamentoSelections.conjunto.despesas_variaveis || "";
        document.getElementById("orcamento_conjunto_valor_poupado").value = orcamentoSelections.conjunto.valor_poupado || "";
    }
    
    // Restaurar dados de orçamento individual
    if (orcamentoSelections.individual) {
        // Restaurar dados do preenchedor
        if (orcamentoSelections.individual.preenchedor) {
            document.getElementById("orcamento_preenchedor_entradas").value = orcamentoSelections.individual.preenchedor.entradas || "";
            document.getElementById("orcamento_preenchedor_despesas_fixas").value = orcamentoSelections.individual.preenchedor.despesas_fixas || "";
            document.getElementById("orcamento_preenchedor_despesas_variaveis").value = orcamentoSelections.individual.preenchedor.despesas_variaveis || "";
            document.getElementById("orcamento_preenchedor_valor_poupado").value = orcamentoSelections.individual.preenchedor.valor_poupado || "";
        }
        
        // Restaurar dados de outras pessoas com renda
        Object.keys(orcamentoSelections.individual).forEach(key => {
            if (key.startsWith("pessoa_")) {
                const index = key.split("_")[1];
                const pessoa = orcamentoSelections.individual[key];
                
                if (document.getElementById(`orcamento_pessoa_${index}_entradas`)) {
                    document.getElementById(`orcamento_pessoa_${index}_entradas`).value = pessoa.entradas || "";
                    document.getElementById(`orcamento_pessoa_${index}_despesas_fixas`).value = pessoa.despesas_fixas || "";
                    document.getElementById(`orcamento_pessoa_${index}_despesas_variaveis`).value = pessoa.despesas_variaveis || "";
                    document.getElementById(`orcamento_pessoa_${index}_valor_poupado`).value = pessoa.valor_poupado || "";
                }
            }
        });
    }
}

// Função para renderizar as perguntas de orçamento
function renderOrcamentoQuestions() {
    saveOrcamentoSelections();
    
    // Renderizar seção de orçamento
    const orcamentoSection = document.getElementById("orcamento-section");
    if (!orcamentoSection) return;
    
    const nomeCompletoInput = document.getElementById("nome_completo");
    if (!nomeCompletoInput || nomeCompletoInput.value.trim() === "") return;
    
    const preenchedor = sanitizeInput(nomeCompletoInput.value);
    const preenchedor_primeiro_nome = capitalizeName(preenchedor.split(' ')[0]);
    
    // Verificar se há outras pessoas com renda
    const temOutrasPessoasComRenda = document.getElementById("renda_unica_nao") && 
                                    document.getElementById("renda_unica_nao").checked &&
                                    document.querySelectorAll('#pessoas-list input[name="pessoa_nome"]').length > 0;
    
    // Limpar seção de orçamento
    orcamentoSection.innerHTML = `
        <h3>Informações sobre Orçamento:</h3>
    `;
    
    // Se houver outras pessoas com renda, mostrar opção de escolha
    if (temOutrasPessoasComRenda) {
        orcamentoSection.innerHTML += `
            <div class="form-group">
                <label>Como deseja informar o orçamento?</label>
                <div class="radio-group">
                    <input type="radio" id="orcamento_tipo_conjunto" name="tipo_orcamento" value="conjunto">
                    <label for="orcamento_tipo_conjunto">Orçamento conjunto da casa</label>
                    <input type="radio" id="orcamento_tipo_individual" name="tipo_orcamento" value="individual">
                    <label for="orcamento_tipo_individual">Orçamento individual por pessoa</label>
                </div>
            </div>
            
            <div id="orcamento-conjunto-section" style="display: none;">
                <div class="form-group">
                    <label for="orcamento_conjunto_entradas">Entradas totais mensais (R$)</label>
                    <input type="text" id="orcamento_conjunto_entradas" name="orcamento_conjunto_entradas" class="currency-input">
                </div>
                <div class="form-group">
                    <label for="orcamento_conjunto_despesas_fixas">Despesas fixas mensais (R$)</label>
                    <input type="text" id="orcamento_conjunto_despesas_fixas" name="orcamento_conjunto_despesas_fixas" class="currency-input">
                </div>
                <div class="form-group">
                    <label for="orcamento_conjunto_despesas_variaveis">Despesas variáveis mensais (R$)</label>
                    <input type="text" id="orcamento_conjunto_despesas_variaveis" name="orcamento_conjunto_despesas_variaveis" class="currency-input">
                </div>
                <div class="form-group">
                    <label for="orcamento_conjunto_valor_poupado">Valor poupado/investido mensal (R$)</label>
                    <input type="text" id="orcamento_conjunto_valor_poupado" name="orcamento_conjunto_valor_poupado" class="currency-input">
                </div>
            </div>
            
            <div id="orcamento-individual-section" style="display: none;">
        `;
    } else {
        // Se não houver outras pessoas com renda, mostrar diretamente os campos para o preenchedor
        orcamentoSection.innerHTML += `
            <div id="orcamento-individual-section">
        `;
    }
    
    // Adicionar campos para o preenchedor
    orcamentoSection.innerHTML += `
                <div class="orcamento-individual-entry">
                    <h4>${preenchedor_primeiro_nome}</h4>
                    <div class="form-group">
                        <label for="orcamento_preenchedor_entradas">Entradas totais mensais (R$)</label>
                        <input type="text" id="orcamento_preenchedor_entradas" name="orcamento_preenchedor_entradas" class="currency-input">
                    </div>
                    <div class="form-group">
                        <label for="orcamento_preenchedor_despesas_fixas">Despesas fixas mensais (R$)</label>
                        <input type="text" id="orcamento_preenchedor_despesas_fixas" name="orcamento_preenchedor_despesas_fixas" class="currency-input">
                    </div>
                    <div class="form-group">
                        <label for="orcamento_preenchedor_despesas_variaveis">Despesas variáveis mensais (R$)</label>
                        <input type="text" id="orcamento_preenchedor_despesas_variaveis" name="orcamento_preenchedor_despesas_variaveis" class="currency-input">
                    </div>
                    <div class="form-group">
                        <label for="orcamento_preenchedor_valor_poupado">Valor poupado/investido mensal (R$)</label>
                        <input type="text" id="orcamento_preenchedor_valor_poupado" name="orcamento_preenchedor_valor_poupado" class="currency-input">
                    </div>
                </div>
    `;
    
    // Adicionar campos para outras pessoas com renda
    if (temOutrasPessoasComRenda) {
        document.querySelectorAll("#pessoas-list .dynamic-entry").forEach((entry, index) => {
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            if (nomeInput && nomeInput.value.trim() !== "") {
                const pessoaNome = sanitizeInput(nomeInput.value);
                const pessoaPrimeiroNome = capitalizeName(pessoaNome.split(' ')[0]);
                
                const pessoaHTML = `
                    <div class="orcamento-individual-entry pessoa-orcamento-${index}">
                        <h4>${pessoaPrimeiroNome}</h4>
                        <div class="form-group">
                            <label for="orcamento_pessoa_${index}_entradas">Entradas totais mensais (R$)</label>
                            <input type="text" id="orcamento_pessoa_${index}_entradas" name="orcamento_pessoa_${index}_entradas" class="currency-input">
                        </div>
                        <div class="form-group">
                            <label for="orcamento_pessoa_${index}_despesas_fixas">Despesas fixas mensais (R$)</label>
                            <input type="text" id="orcamento_pessoa_${index}_despesas_fixas" name="orcamento_pessoa_${index}_despesas_fixas" class="currency-input">
                        </div>
                        <div class="form-group">
                            <label for="orcamento_pessoa_${index}_despesas_variaveis">Despesas variáveis mensais (R$)</label>
                            <input type="text" id="orcamento_pessoa_${index}_despesas_variaveis" name="orcamento_pessoa_${index}_despesas_variaveis" class="currency-input">
                        </div>
                        <div class="form-group">
                            <label for="orcamento_pessoa_${index}_valor_poupado">Valor poupado/investido mensal (R$)</label>
                            <input type="text" id="orcamento_pessoa_${index}_valor_poupado" name="orcamento_pessoa_${index}_valor_poupado" class="currency-input">
                        </div>
                    </div>
                `;
                
                document.getElementById("orcamento-individual-section").innerHTML += pessoaHTML;
            }
        });
    }
    
    // Fechar a div de orçamento individual
    document.getElementById("orcamento-individual-section").innerHTML += `</div>`;
    
    // Adicionar event listeners para formatação de moeda
    document.querySelectorAll(".currency-input").forEach(input => {
        input.addEventListener("blur", function() {
            this.value = formatCurrency(this.value);
        });
        
        input.addEventListener("focus", function() {
            if (this.value) {
                this.value = this.value.replace(/[^\d,.-]/g, '');
            }
        });
    });
    
    // Adicionar event listeners para mostrar/esconder seções de orçamento
    if (temOutrasPessoasComRenda) {
        document.getElementById("orcamento_tipo_conjunto").addEventListener("change", function() {
            document.getElementById("orcamento-conjunto-section").style.display = "block";
            document.getElementById("orcamento-individual-section").style.display = "none";
        });
        
        document.getElementById("orcamento_tipo_individual").addEventListener("change", function() {
            document.getElementById("orcamento-conjunto-section").style.display = "none";
            document.getElementById("orcamento-individual-section").style.display = "block";
        });
    }
    
    // Adicionar event listener para atualizar quando o nome de uma pessoa é alterado
    document.querySelectorAll('#pessoas-list input[name="pessoa_nome"]').forEach((input, index) => {
        input.addEventListener("input", function() {
            const pessoaOrcamentoEntry = document.querySelector(`.pessoa-orcamento-${index}`);
            
            if (this.value.trim() === "") {
                // Se o nome estiver vazio, esconder a entrada
                if (pessoaOrcamentoEntry) {
                    pessoaOrcamentoEntry.style.display = "none";
                }
            } else {
                // Se o nome não estiver vazio, mostrar a entrada e atualizar o nome
                if (pessoaOrcamentoEntry) {
                    pessoaOrcamentoEntry.style.display = "block";
                    const pessoaPrimeiroNome = capitalizeName(this.value.split(' ')[0]);
                    const tituloElement = pessoaOrcamentoEntry.querySelector("h4");
                    if (tituloElement) {
                        tituloElement.textContent = pessoaPrimeiroNome;
                    }
                } else {
                    // Se a entrada não existir, renderizar novamente
                    renderOrcamentoQuestions();
                }
            }
        });
    });
    
    // Restaurar seleções anteriores
    restoreOrcamentoSelections();
}

function createDynamicEntry(containerId, inputName, buttonId, placeholderText) {
    const container = document.getElementById(containerId);
    const entryCount = container.querySelectorAll('.dynamic-entry').length;
    const entryId = `${inputName}_${entryCount}`;
    
    const entryHTML = `
        <div class="dynamic-entry">
            <input type="text" id="${entryId}" name="${inputName}" placeholder="${placeholderText}" class="dynamic-input">
            <button type="button" class="remove-entry-btn">Remover</button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', entryHTML);
    
    // Adicionar event listener para o botão de remover
    container.querySelector(`.dynamic-entry:last-child .remove-entry-btn`).addEventListener('click', function() {
        this.parentElement.remove();
        updateDynamicFormSections();
    });
    
    // Adicionar event listener para o input
    container.querySelector(`.dynamic-entry:last-child .dynamic-input`).addEventListener('input', function() {
        updateDynamicFormSections();
    });
    
    return entryId;
}

function renderFormulario() {
    formContentEl.innerHTML = `
        <form id="client-response-form">
            <div class="form-group">
                <label for="nome_completo">Nome Completo</label>
                <input type="text" id="nome_completo" name="nome_completo" required>
            </div>

            <div class="form-group">
                <label>Única pessoa com renda na casa?</label>
                <div class="radio-group">
                    <input type="radio" id="renda_unica_sim" name="renda_unica" value="sim" required>
                    <label for="renda_unica_sim">Sim</label>
                    <input type="radio" id="renda_unica_nao" name="renda_unica" value="nao">
                    <label for="renda_unica_nao">Não</label>
                </div>
            </div>

            <div id="outras-pessoas-section" style="display: none;">
                <h3>Outras pessoas com renda na casa:</h3>
                <div id="pessoas-list"></div>
                <button type="button" id="add-pessoa-btn" class="add-dynamic-entry-btn">+ Adicionar Pessoa com Renda</button>
            </div>

            <div class="form-group">
                <label id="label_tem_dependentes">Você tem filho/pet/outros parentes que dependem de você?</label>
                <div class="radio-group">
                    <input type="radio" id="tem_dependentes_sim" name="tem_dependentes" value="sim" required>
                    <label for="tem_dependentes_sim">Sim</label>
                    <input type="radio" id="tem_dependentes_nao" name="tem_dependentes" value="nao">
                    <label for="tem_dependentes_nao">Não</label>
                </div>
            </div>

            <div id="dependentes-section" style="display: none;">
                <h3>Dependentes:</h3>
                <div id="dependentes-list"></div>
                <button type="button" id="add-dependente-btn" class="add-dynamic-entry-btn">+ Adicionar Dependente</button>
            </div>

            <!-- Seção de Plano de Saúde -->
            <div class="form-group">
                <label id="label_tem_plano_saude">Você possui plano de saúde?</label>
                <div class="radio-group">
                    <input type="radio" id="tem_plano_saude_sim" name="tem_plano_saude" value="sim" required>
                    <label for="tem_plano_saude_sim">Sim</label>
                    <input type="radio" id="tem_plano_saude_nao" name="tem_plano_saude" value="nao">
                    <label for="tem_plano_saude_nao">Não</label>
                </div>
            </div>
            <h3 id="plano-saude-section-title" style="display: none;">Informações sobre Plano de Saúde:</h3>
            <div id="plano-saude-section-content" style="display: none;"></div>

            <!-- Seção de Seguro de Vida -->
            <div class="form-group">
                <label id="label_tem_seguro_vida">Você possui seguro de vida?</label>
                <div class="radio-group">
                    <input type="radio" id="tem_seguro_vida_sim" name="tem_seguro_vida" value="sim" required>
                    <label for="tem_seguro_vida_sim">Sim</label>
                    <input type="radio" id="tem_seguro_vida_nao" name="tem_seguro_vida" value="nao">
                    <label for="tem_seguro_vida_nao">Não</label>
                </div>
            </div>
            <h3 id="seguro-vida-section-title" style="display: none;">Informações sobre Seguro de Vida:</h3>
            <div id="seguro-vida-section-content" style="display: none;"></div>

            <!-- Seção de Patrimônio Físico -->
            <div class="form-group">
                <label id="label_tem_patrimonio_fisico">Você possui patrimônio físico (imóvel, automóvel, jóias, outros...)?</label>
                <div class="radio-group">
                    <input type="radio" id="tem_patrimonio_sim" name="tem_patrimonio" value="sim" required>
                    <label for="tem_patrimonio_sim">Sim</label>
                    <input type="radio" id="tem_patrimonio_nao" name="tem_patrimonio" value="nao">
                    <label for="tem_patrimonio_nao">Não</label>
                </div>
            </div>

            <div id="patrimonio-section" style="display: none;">
                <h3>Patrimônios Físicos:</h3>
                <div id="patrimonios-list"></div>
                <button type="button" id="add-patrimonio-btn" class="add-dynamic-entry-btn">+ Adicionar Patrimônio</button>
            </div>

            <!-- Seção de Investimentos -->
            <div class="form-group">
                <label id="label_tem_investimentos">Você possui investimentos (poupança, CDB, ações, outros...)?</label>
                <div class="radio-group">
                    <input type="radio" id="tem_investimentos_sim" name="tem_investimentos" value="sim" required>
                    <label for="tem_investimentos_sim">Sim</label>
                    <input type="radio" id="tem_investimentos_nao" name="tem_investimentos" value="nao">
                    <label for="tem_investimentos_nao">Não</label>
                </div>
            </div>

            <div id="investimentos-section" style="display: none;">
                <h3>Investimentos:</h3>
                <div id="investimentos-list"></div>
                <button type="button" id="add-investimento-btn" class="add-dynamic-entry-btn">+ Adicionar Investimento</button>
            </div>

            <!-- Seção de Dívidas -->
            <div class="form-group">
                <label id="label_tem_dividas" style="text-align: center; display: block;">Você possui dívidas?</label>
                <div class="radio-group" style="justify-content: center;">
                    <input type="radio" id="tem_dividas_sim" name="tem_dividas" value="sim" required>
                    <label for="tem_dividas_sim">Sim</label>
                    <input type="radio" id="tem_dividas_nao" name="tem_dividas" value="nao">
                    <label for="tem_dividas_nao">Não</label>
                </div>
            </div>

            <div id="dividas-section" style="display: none;">
                <h3>Dívidas:</h3>
                <div id="dividas-list"></div>
                <button type="button" id="add-divida-btn" class="add-dynamic-entry-btn">+ Adicionar Dívida</button>
            </div>
            
            <!-- Seção de Imposto de Renda -->
            <div id="imposto-renda-section"></div>
            
            <!-- Seção de Orçamento -->
            <div id="orcamento-section"></div>

            <div class="form-group">
                <button type="submit" id="submit-btn" class="btn-primary">Enviar Respostas</button>
            </div>
        </form>
    `;

    // Adicionar event listeners para os botões de adicionar entradas dinâmicas
    document.getElementById("add-pessoa-btn").addEventListener("click", function() {
        createDynamicEntry("pessoas-list", "pessoa_nome", "add-pessoa-btn", "Nome da pessoa");
        updateDynamicFormSections();
    });

    document.getElementById("add-dependente-btn").addEventListener("click", function() {
        createDynamicEntry("dependentes-list", "dependente_nome", "add-dependente-btn", "Nome do dependente");
        updateDynamicFormSections();
    });

    document.getElementById("add-patrimonio-btn").addEventListener("click", function() {
        createDynamicEntry("patrimonios-list", "patrimonio_descricao", "add-patrimonio-btn", "Descrição do patrimônio");
    });

    document.getElementById("add-investimento-btn").addEventListener("click", function() {
        createDynamicEntry("investimentos-list", "investimento_descricao", "add-investimento-btn", "Descrição do investimento");
    });

    document.getElementById("add-divida-btn").addEventListener("click", function() {
        createDynamicEntry("dividas-list", "divida_descricao", "add-divida-btn", "Descrição da dívida");
    });

    // Adicionar event listeners para os radio buttons
    document.getElementById("renda_unica_sim").addEventListener("change", updateDynamicFormSections);
    document.getElementById("renda_unica_nao").addEventListener("change", updateDynamicFormSections);
    document.getElementById("tem_dependentes_sim").addEventListener("change", updateDynamicFormSections);
    document.getElementById("tem_dependentes_nao").addEventListener("change", updateDynamicFormSections);
    document.getElementById("tem_patrimonio_sim").addEventListener("change", updateDynamicFormSections);
    document.getElementById("tem_patrimonio_nao").addEventListener("change", updateDynamicFormSections);
    document.getElementById("tem_investimentos_sim").addEventListener("change", updateDynamicFormSections);
    document.getElementById("tem_investimentos_nao").addEventListener("change", updateDynamicFormSections);
    document.getElementById("tem_dividas_sim").addEventListener("change", updateDynamicFormSections);
    document.getElementById("tem_dividas_nao").addEventListener("change", updateDynamicFormSections);
    document.getElementById("tem_plano_saude_sim").addEventListener("change", updateDynamicFormSections);
    document.getElementById("tem_plano_saude_nao").addEventListener("change", updateDynamicFormSections);
    document.getElementById("tem_seguro_vida_sim").addEventListener("change", updateDynamicFormSections);
    document.getElementById("tem_seguro_vida_nao").addEventListener("change", updateDynamicFormSections);

    // Adicionar event listener para o input de nome completo
    document.getElementById("nome_completo").addEventListener("input", updateDynamicFormSections);

    // Adicionar event listener para o formulário
    document.getElementById("client-response-form").addEventListener("submit", async function(e) {
        e.preventDefault();
        const submitButton = document.getElementById("submit-btn");
        submitButton.disabled = true;
        submitButton.textContent = "Enviando...";

        try {
            // Coletar dados do formulário
            const nomeCompleto = document.getElementById("nome_completo").value;
            const rendaUnica = document.querySelector('input[name="renda_unica"]:checked').value;
            
            // Coletar outras pessoas com renda
            const outrasPessoas = [];
            if (rendaUnica === "nao") {
                document.querySelectorAll("#pessoas-list .dynamic-entry").forEach(entry => {
                    const nome = entry.querySelector('input[name="pessoa_nome"]').value;
                    if (nome.trim() !== "") {
                        outrasPessoas.push({ nome });
                    }
                });
            }
            
            // Coletar dependentes
            const temDependentes = document.querySelector('input[name="tem_dependentes"]:checked').value;
            const dependentes = [];
            if (temDependentes === "sim") {
                document.querySelectorAll("#dependentes-list .dynamic-entry").forEach(entry => {
                    const nome = entry.querySelector('input[name="dependente_nome"]').value;
                    if (nome.trim() !== "") {
                        dependentes.push({ nome });
                    }
                });
            }
            
            // Coletar patrimônios
            const temPatrimonio = document.querySelector('input[name="tem_patrimonio"]:checked').value;
            const patrimonios = [];
            if (temPatrimonio === "sim") {
                document.querySelectorAll("#patrimonios-list .dynamic-entry").forEach(entry => {
                    const descricao = entry.querySelector('input[name="patrimonio_descricao"]').value;
                    if (descricao.trim() !== "") {
                        patrimonios.push({ descricao });
                    }
                });
            }
            
            // Coletar investimentos
            const temInvestimentos = document.querySelector('input[name="tem_investimentos"]:checked').value;
            const investimentos = [];
            if (temInvestimentos === "sim") {
                document.querySelectorAll("#investimentos-list .dynamic-entry").forEach(entry => {
                    const descricao = entry.querySelector('input[name="investimento_descricao"]').value;
                    if (descricao.trim() !== "") {
                        investimentos.push({ descricao });
                    }
                });
            }
            
            // Coletar dívidas
            const temDividas = document.querySelector('input[name="tem_dividas"]:checked').value;
            const dividas = [];
            if (temDividas === "sim") {
                document.querySelectorAll("#dividas-list .dynamic-entry").forEach(entry => {
                    const descricao = entry.querySelector('input[name="divida_descricao"]').value;
                    if (descricao.trim() !== "") {
                        dividas.push({ descricao });
                    }
                });
            }
            
            // Coletar plano de saúde
            const temPlanoSaude = document.querySelector('input[name="tem_plano_saude"]:checked').value;
            const planosSaude = {};
            if (temPlanoSaude === "sim") {
                document.querySelectorAll(".plano-saude-entry").forEach(entry => {
                    const nameAttribute = entry.querySelector('input[type="radio"]')?.name;
                    const selectedRadio = entry.querySelector(`input[name="${nameAttribute}"]:checked`);
                    if (selectedRadio) {
                        let pessoaNome = "";
                        if (nameAttribute === "preenchedor_plano") {
                            pessoaNome = nomeCompleto;
                        } else if (nameAttribute.startsWith("outra_pessoa_plano_")) {
                            const index = nameAttribute.split("_")[3];
                            const pessoaInput = document.querySelector(`#pessoas-list .dynamic-entry:nth-child(${parseInt(index) + 1}) input[name="pessoa_nome"]`);
                            if (pessoaInput) {
                                pessoaNome = pessoaInput.value;
                            }
                        } else if (nameAttribute.startsWith("dependente_plano_")) {
                            const index = nameAttribute.split("_")[3];
                            const dependenteInput = document.querySelector(`#dependentes-list .dynamic-entry:nth-child(${parseInt(index) + 1}) input[name="dependente_nome"]`);
                            if (dependenteInput) {
                                pessoaNome = dependenteInput.value;
                            }
                        }
                        
                        if (pessoaNome.trim() !== "") {
                            planosSaude[pessoaNome] = { tem_plano: selectedRadio.value === "sim" };
                        }
                    }
                });
            }
            
            // Coletar seguro de vida
            const temSeguroVida = document.querySelector('input[name="tem_seguro_vida"]:checked').value;
            const segurosVida = {};
            if (temSeguroVida === "sim") {
                document.querySelectorAll(".seguro-vida-entry").forEach(entry => {
                    const nameAttribute = entry.querySelector('input[type="radio"]')?.name;
                    const selectedRadio = entry.querySelector(`input[name="${nameAttribute}"]:checked`);
                    if (selectedRadio) {
                        let pessoaNome = "";
                        if (nameAttribute === "preenchedor_seguro") {
                            pessoaNome = nomeCompleto;
                        } else if (nameAttribute.startsWith("outra_pessoa_seguro_")) {
                            const index = nameAttribute.split("_")[3];
                            const pessoaInput = document.querySelector(`#pessoas-list .dynamic-entry:nth-child(${parseInt(index) + 1}) input[name="pessoa_nome"]`);
                            if (pessoaInput) {
                                pessoaNome = pessoaInput.value;
                            }
                        }
                        
                        if (pessoaNome.trim() !== "") {
                            segurosVida[pessoaNome] = { tem_seguro: selectedRadio.value === "sim" };
                        }
                    }
                });
            }
            
            // Coletar imposto de renda
            const impostosRenda = {};
            
            // Coletar imposto de renda do preenchedor
            const preenchedor_declara = document.querySelector('input[name="preenchedor_imposto_renda"]:checked')?.value;
            if (preenchedor_declara) {
                impostosRenda[nomeCompleto] = {
                    declara: preenchedor_declara
                };
                
                // Se declara, coletar tipo e resultado
                if (preenchedor_declara === "sim") {
                    const tipo = document.querySelector('input[name="preenchedor_imposto_tipo"]:checked')?.value;
                    const resultado = document.querySelector('input[name="preenchedor_imposto_resultado"]:checked')?.value;
                    
                    if (tipo) impostosRenda[nomeCompleto].tipo = tipo;
                    if (resultado) impostosRenda[nomeCompleto].resultado = resultado;
                }
            }
            
            // Coletar imposto de renda de outras pessoas com renda
            if (rendaUnica === "nao") {
                document.querySelectorAll("#pessoas-list .dynamic-entry").forEach((entry, index) => {
                    const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
                    if (nomeInput && nomeInput.value.trim() !== "") {
                        const pessoaNome = nomeInput.value;
                        const declara = document.querySelector(`input[name="pessoa_imposto_renda_${index}"]:checked`)?.value;
                        
                        if (declara) {
                            impostosRenda[pessoaNome] = {
                                declara: declara
                            };
                            
                            // Se declara, coletar tipo e resultado
                            if (declara === "sim") {
                                const tipo = document.querySelector(`input[name="pessoa_imposto_tipo_${index}"]:checked`)?.value;
                                const resultado = document.querySelector(`input[name="pessoa_imposto_resultado_${index}"]:checked`)?.value;
                                
                                if (tipo) impostosRenda[pessoaNome].tipo = tipo;
                                if (resultado) impostosRenda[pessoaNome].resultado = resultado;
                            }
                        }
                    }
                });
            }
            
            // Coletar orçamento
            const orcamento = {
                tipo: "individual", // Valor padrão
                dados: {}
            };
            
            // Se houver outras pessoas com renda, verificar tipo de orçamento
            if (rendaUnica === "nao" && document.querySelectorAll("#pessoas-list .dynamic-entry").length > 0) {
                const tipoOrcamento = document.querySelector('input[name="tipo_orcamento"]:checked')?.value;
                if (tipoOrcamento) {
                    orcamento.tipo = tipoOrcamento;
                }
            }
            
            // Coletar dados de orçamento conjunto
            if (orcamento.tipo === "conjunto") {
                const entradasRaw = document.getElementById("orcamento_conjunto_entradas")?.value;
                const despesasFixasRaw = document.getElementById("orcamento_conjunto_despesas_fixas")?.value;
                const despesasVariaveisRaw = document.getElementById("orcamento_conjunto_despesas_variaveis")?.value;
                const valorPoupadoRaw = document.getElementById("orcamento_conjunto_valor_poupado")?.value;
                
                orcamento.dados = {
                    entradas: parseCurrency(entradasRaw),
                    despesas_fixas: parseCurrency(despesasFixasRaw),
                    despesas_variaveis: parseCurrency(despesasVariaveisRaw),
                    valor_poupado: parseCurrency(valorPoupadoRaw)
                };
            } else {
                // Coletar dados de orçamento individual
                
                // Coletar dados do preenchedor
                const entradasRaw = document.getElementById("orcamento_preenchedor_entradas")?.value;
                const despesasFixasRaw = document.getElementById("orcamento_preenchedor_despesas_fixas")?.value;
                const despesasVariaveisRaw = document.getElementById("orcamento_preenchedor_despesas_variaveis")?.value;
                const valorPoupadoRaw = document.getElementById("orcamento_preenchedor_valor_poupado")?.value;
                
                orcamento.dados[nomeCompleto] = {
                    entradas: parseCurrency(entradasRaw),
                    despesas_fixas: parseCurrency(despesasFixasRaw),
                    despesas_variaveis: parseCurrency(despesasVariaveisRaw),
                    valor_poupado: parseCurrency(valorPoupadoRaw)
                };
                
                // Coletar dados de outras pessoas com renda
                if (rendaUnica === "nao") {
                    document.querySelectorAll("#pessoas-list .dynamic-entry").forEach((entry, index) => {
                        const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
                        if (nomeInput && nomeInput.value.trim() !== "") {
                            const personName = nomeInput.value;
                            const personId = `pessoa_${index}`;
                            
                            const entradasRaw = document.getElementById(`orcamento_${personId}_entradas`)?.value;
                            const despesasFixasRaw = document.getElementById(`orcamento_${personId}_despesas_fixas`)?.value;
                            const despesasVariaveisRaw = document.getElementById(`orcamento_${personId}_despesas_variaveis`)?.value;
                            const valorPoupadoRaw = document.getElementById(`orcamento_${personId}_valor_poupado`)?.value;
                            
                            orcamento.dados[personName] = {
                                entradas: parseCurrency(entradasRaw),
                                despesas_fixas: parseCurrency(despesasFixasRaw),
                                despesas_variaveis: parseCurrency(despesasVariaveisRaw),
                                valor_poupado: parseCurrency(valorPoupadoRaw)
                            };
                        }
                    });
                }
            }
            
            // Criar objeto com todos os dados do formulário
            const dadosFormulario = {
                nome_completo: nomeCompleto,
                renda_unica: rendaUnica === "sim",
                outras_pessoas: outrasPessoas,
                tem_dependentes: temDependentes === "sim",
                dependentes: dependentes,
                tem_patrimonio: temPatrimonio === "sim",
                patrimonios: patrimonios,
                tem_investimentos: temInvestimentos === "sim",
                investimentos: investimentos,
                tem_dividas: temDividas === "sim",
                dividas: dividas,
                tem_plano_saude: temPlanoSaude === "sim",
                planos_saude: planosSaude,
                tem_seguro_vida: temSeguroVida === "sim",
                seguros_vida: segurosVida,
                impostos_renda: impostosRenda,
                orcamento: orcamento
            };

            // Obter ID do formulário da URL
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get("token");
            
            // Buscar ID do cliente pelo token
            const clienteId = await getClienteByToken(token);
            
            // Buscar formulário pelo ID
            const { data: formData, error: formError } = await supabase
                .from("formularios_clientes")
                .select("id")
                .eq("token_unico", token)
                .single();
                
            if (formError) throw formError;
            
            const formId = formData.id;

            // Atualizar formulário no banco de dados
            const { error: updateError } = await supabase
                .from("formularios_clientes")
                .update({
                    dados_formulario: dadosFormulario,
                    status: "preenchido",
                    data_preenchimento: new Date().toISOString(),
                })
                .eq("id", formId);

            if (updateError) throw updateError;

            formContentEl.innerHTML = "<p>Formulário enviado com sucesso!</p>";
            showMessage("success", "Obrigado por preencher o formulário. Suas respostas foram registradas.");

        } catch (error) {
            console.error("Erro ao enviar formulário:", error);
            showMessage("error", `Erro ao enviar: ${error.message}`);
            submitButton.disabled = false;
            submitButton.textContent = "Enviar Respostas";
        }
    });

    // Inicializar seções dinâmicas
    updateDynamicFormSections();
}

// Função para carregar o formulário
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
                formContentEl.innerHTML = "<p>Erro ao carregar formulário.</p>";
                showMessage("error", `Erro ao carregar formulário: ${formError?.message || "Desconhecido"}`);
            }
            return;
        }

        if (formData.status === "preenchido") {
            formContentEl.innerHTML = "<p>Este formulário já foi preenchido.</p>";
            showMessage("error", "Este formulário já foi preenchido anteriormente.");
            return;
        }

        const clienteNome = formData.clientes?.nome || "Cliente";
        formTitleEl.textContent = "Formulário Pré Diagnóstico";

        // Renderizar formulário
        renderFormulario();
    } catch (error) {
        console.error("Erro ao carregar formulário:", error);
        formContentEl.innerHTML = "<p>Erro ao carregar formulário.</p>";
        showMessage("error", `Erro ao carregar formulário: ${error.message}`);
    }
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    loadForm(token);
});

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
    .replace(/\'/g, "&#x27;") // Corrigido para \'
    .replace(/`/g, "&#x60;");
};

// Função para exibir mensagens
function showMessage(type, text) {
    messageAreaEl.innerHTML = `<div class="message ${type}">${sanitizeInput(text)}</div>`;
}

// Função para buscar dados do formulário e cliente
async function loadForm(token) {
    if (!token) {
        formContentEl.innerHTML = "<p>Link inválido.</p>";
        showMessage("error", "Token não encontrado na URL.");
        return;
    }

    try {
        // 1. Busca o formulário pelo token
        const { data: formData, error: formError } = await supabase
            .from("formularios_clientes")
            .select("*, clientes(nome)") // Inclui o nome do cliente da tabela relacionada
            .eq("token_unico", token)
            .single(); // Espera apenas um resultado

        if (formError || !formData) {
            if (formError && formError.code === 'PGRST116') { // Código para "No rows found"
                 formContentEl.innerHTML = "<p>Link inválido ou expirado.</p>";
                 showMessage("error", "O link para este formulário não é válido ou já foi utilizado.");
            } else {
                throw formError || new Error("Formulário não encontrado.");
            }
            return;
        }

        // Atualiza o título com o nome do cliente, se disponível
        if (formData.clientes && formData.clientes.nome) {
            formTitleEl.textContent = `Formulário para ${sanitizeInput(formData.clientes.nome)}`;
        }

        // 2. Verifica o status do formulário
        if (formData.status === "pendente") {
            // Renderiza o formulário
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

// Função para renderizar o formulário HTML (MODIFICADA)
function renderActualForm(formData) {
    formContentEl.innerHTML = `
        <form id="client-response-form">
            <label for="nome_completo">Nome Completo:</label>
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
                <button type="button" id="add-person-btn">+ Adicionar Pessoa</button>
            </div>

            <button type="submit">Enviar Resposta</button>
        </form>
    `;

    // Adiciona listeners
    const formElement = document.getElementById("client-response-form");
    const radioSim = document.getElementById("renda_unica_sim");
    const radioNao = document.getElementById("renda_unica_nao");
    const outrasPessoasContainer = document.getElementById("outras-pessoas-renda-container");
    const addPersonBtn = document.getElementById("add-person-btn");
    const pessoasList = document.getElementById("pessoas-list");

    // Listener para mostrar/esconder seção de outras pessoas
    radioSim.addEventListener('change', () => {
        if (radioSim.checked) {
            outrasPessoasContainer.style.display = 'none';
            pessoasList.innerHTML = ''; // Limpa a lista se mudar para Sim
        }
    });
    radioNao.addEventListener('change', () => {
        if (radioNao.checked) {
            outrasPessoasContainer.style.display = 'block';
        }
    });

    // Listener para adicionar pessoa
    addPersonBtn.addEventListener('click', () => {
        const personId = Date.now(); // ID simples para remover
        const personEntry = document.createElement('div');
        personEntry.classList.add('person-entry');
        personEntry.dataset.id = personId;
        personEntry.innerHTML = `
            <button type="button" class="remove-person-btn" data-id="${personId}">Remover</button>
            <label for="pessoa_nome_${personId}">Nome:</label>
            <input type="text" id="pessoa_nome_${personId}" name="pessoa_nome" required>
            <label for="pessoa_autorizacao_${personId}">Precisa da autorização para decisões financeiras?</label>
            <select id="pessoa_autorizacao_${personId}" name="pessoa_autorizacao" required>
                <option value="">Selecione...</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
            </select>
        `;
        pessoasList.appendChild(personEntry);

        // Adiciona listener para o botão remover desta entrada
        personEntry.querySelector('.remove-person-btn').addEventListener('click', (e) => {
            const idToRemove = e.target.dataset.id;
            const entryToRemove = pessoasList.querySelector(`.person-entry[data-id="${idToRemove}"]`);
            if (entryToRemove) {
                entryToRemove.remove();
            }
        });
    });

    // Listener para o envio do formulário
    if (formElement) {
        formElement.addEventListener("submit", (event) => handleFormSubmit(event, formData));
    }
}

// Função para lidar com o envio do formulário (MODIFICADA PARA NOVA ESTRUTURA)
async function handleFormSubmit(event, formData) {
    event.preventDefault();
    messageAreaEl.innerHTML = ""; // Limpa mensagens anteriores

    const nomeCompletoInput = document.getElementById("nome_completo");
    const rendaUnicaRadio = document.querySelector('input[name="renda_unica"]:checked');

    const nomeCompleto = sanitizeInput(nomeCompletoInput.value.trim());
    const rendaUnicaValue = rendaUnicaRadio ? rendaUnicaRadio.value : null;

    if (!nomeCompleto) {
        showMessage("error", "Por favor, preencha o Nome Completo.");
        return;
    }
    if (!rendaUnicaValue) {
        showMessage("error", "Por favor, selecione se você é a única pessoa com renda.");
        return;
    }

    const dadosFormulario = {
        nome_completo: nomeCompleto,
        renda_unica: rendaUnicaValue === 'sim',
        outras_pessoas_renda: []
    };

    if (rendaUnicaValue === 'nao') {
        const personEntries = document.querySelectorAll('#pessoas-list .person-entry');
        for (const entry of personEntries) {
            const nomeInput = entry.querySelector('input[name="pessoa_nome"]');
            const autorizacaoSelect = entry.querySelector('select[name="pessoa_autorizacao"]');

            const nome = sanitizeInput(nomeInput.value.trim());
            const autorizacao = autorizacaoSelect.value;

            if (!nome || !autorizacao) {
                showMessage("error", "Por favor, preencha todos os campos para cada pessoa adicionada ou remova a entrada incompleta.");
                return; // Interrompe o envio
            }
            dadosFormulario.outras_pessoas_renda.push({
                nome: nome,
                precisa_autorizacao: autorizacao === 'sim'
            });
        }
        // Opcional: Validar se pelo menos uma pessoa foi adicionada se marcou 'Não'
        // if (dadosFormulario.outras_pessoas_renda.length === 0) {
        //     showMessage("error", "Você indicou que não é a única pessoa com renda, por favor, adicione as outras pessoas.");
        //     return;
        // }
    }

    try {
        const { error } = await supabase
            .from("formularios_clientes")
            .update({
                dados_formulario: dadosFormulario, // Salva o novo objeto JSON
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
// Pega o token da URL (ex: ?token=valor)
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token");

// Carrega o formulário baseado no token
loadForm(token);


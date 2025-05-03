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

// Função para renderizar o formulário HTML
function renderActualForm(formData) {
    formContentEl.innerHTML = `
        <form id="client-response-form">
            <label for="nome">Nome Completo:</label>
            <input type="text" id="nome" name="nome" required>

            <label for="cidade">Cidade Natal:</label>
            <input type="text" id="cidade" name="cidade" required>

            <button type="submit">Enviar Resposta</button>
        </form>
    `;

    // Adiciona o listener para o envio do formulário
    const formElement = document.getElementById("client-response-form");
    if (formElement) {
        formElement.addEventListener("submit", (event) => handleFormSubmit(event, formData));
    }
}

// Função para lidar com o envio do formulário
async function handleFormSubmit(event, formData) {
    event.preventDefault();
    messageAreaEl.innerHTML = ""; // Limpa mensagens anteriores

    const nomeInput = document.getElementById("nome");
    const cidadeInput = document.getElementById("cidade");

    const nome = sanitizeInput(nomeInput.value.trim());
    const cidade = sanitizeInput(cidadeInput.value.trim());

    if (!nome || !cidade) {
        showMessage("error", "Por favor, preencha ambos os campos.");
        return;
    }

    try {
        const { error } = await supabase
            .from("formularios_clientes")
            .update({
                nome_preenchido: nome,
                cidade_natal_preenchida: cidade,
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


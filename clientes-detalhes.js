// cliente-detalhes.js
import { supabase } from "./supabase.js";

// --- Elementos DOM ---
const loadingMessage = document.getElementById("loading-message");
const errorMessage = document.getElementById("error-message");
const clientDetailsContent = document.getElementById("client-details-content");
const clientNameSpan = document.getElementById("client-name");
const clientWhatsappSpan = document.getElementById("client-whatsapp");
const clientProjectSpan = document.getElementById("client-project");
const clientVisibilitySpan = document.getElementById("client-visibility");
const clientAssignedSpan = document.getElementById("client-assigned");
const clientCreatedSpan = document.getElementById("client-created");
const formsListUl = document.getElementById("forms-list");

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

// --- Função Principal de Carregamento ---
async function loadClientDetails() {
    console.log("cliente-detalhes.js: loadClientDetails() INICIADO.");
    loadingMessage.style.display = "block";
    errorMessage.style.display = "none";
    clientDetailsContent.style.display = "none";

    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get("id");

    if (!clientId) {
        console.error("cliente-detalhes.js: ID do cliente não encontrado na URL.");
        showError("ID do cliente não encontrado na URL.");
        return;
    }
    console.log(`cliente-detalhes.js: Carregando detalhes para Cliente ID: ${clientId}`);

    try {
        // 1. Buscar detalhes do cliente
        console.log("cliente-detalhes.js: Buscando detalhes do cliente...");
        const { data: clientData, error: clientError } = await supabase
            .from("clientes")
            .select("*, criado_por:criado_por_id(usuario), assigned_user:assigned_to_user_id(usuario)") // Busca nome do criador e atribuído
            .eq("id", clientId)
            .single();

        if (clientError || !clientData) {
            if (clientError && clientError.code === "PGRST116") { // Not found
                 console.error(`cliente-detalhes.js: Cliente com ID ${clientId} não encontrado.`);
                 throw new Error(`Cliente com ID ${clientId} não encontrado.`);
            } else {
                console.error("cliente-detalhes.js: Erro ao buscar cliente:", clientError);
                throw clientError || new Error("Erro ao buscar dados do cliente.");
            }
        }
        console.log("cliente-detalhes.js: Detalhes do cliente encontrados:", clientData);

        // 2. Buscar formulários associados
        console.log("cliente-detalhes.js: Buscando formulários associados...");
        const { data: formsData, error: formsError } = await supabase
            .from("formularios_clientes")
            .select("id, created_at") // Seleciona apenas ID e data
            .eq("cliente_id", clientId)
            .order("created_at", { ascending: false });

        if (formsError) {
            console.error("cliente-detalhes.js: Erro ao buscar formulários:", formsError);
            // Não lança erro, apenas loga e continua
        }
        console.log(`cliente-detalhes.js: ${formsData ? formsData.length : 0} formulários encontrados.`);

        // 3. Renderizar detalhes
        renderDetails(clientData, formsData || []);

        loadingMessage.style.display = "none";
        clientDetailsContent.style.display = "block";
        console.log("cliente-detalhes.js: Detalhes carregados e renderizados.");

    } catch (error) {
        console.error("cliente-detalhes.js: Erro GERAL em loadClientDetails:", error);
        showError(error.message || "Ocorreu um erro inesperado.");
    }
}

// --- Função para Renderizar Detalhes ---
function renderDetails(client, forms) {
    clientNameSpan.textContent = sanitizeInput(client.nome);
    clientWhatsappSpan.textContent = sanitizeInput(client.whatsapp);
    clientProjectSpan.textContent = sanitizeInput(client.projeto) || "Nenhum";
    clientVisibilitySpan.textContent = client.visibility === "TODOS" ? "TODOS (Projeto)" : "Individual";

    let assignedText = "Ninguém";
    if (client.visibility === "TODOS") {
        assignedText = "-"; // Não aplicável se visibilidade é TODOS
    } else if (client.assigned_user && client.assigned_user.usuario) {
        assignedText = sanitizeInput(client.assigned_user.usuario);
    } else if (client.assigned_to_user_id) {
        assignedText = `ID: ${client.assigned_to_user_id} (Nome não encontrado)`;
    }
    clientAssignedSpan.textContent = assignedText;

    clientCreatedSpan.textContent = client.created_at ? new Date(client.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Data indisponível";

    // Renderizar lista de formulários
    formsListUl.innerHTML = ""; // Limpa a lista
    if (forms.length === 0) {
        formsListUl.innerHTML = "<li>Nenhum formulário encontrado.</li>";
    } else {
        forms.forEach(form => {
            const li = document.createElement("li");
            const formDate = new Date(form.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
            // Poderia adicionar um link para o formulário aqui se existisse uma página para visualizá-lo
            li.textContent = `Formulário criado em: ${formDate} (ID: ${form.id})`;
            formsListUl.appendChild(li);
        });
    }
}

// --- Função para Exibir Erros ---
function showError(message) {
    loadingMessage.style.display = "none";
    clientDetailsContent.style.display = "none";
    errorMessage.textContent = `Erro: ${message}`;
    errorMessage.style.display = "block";
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", loadClientDetails);
console.log("cliente-detalhes.js: Script carregado.");


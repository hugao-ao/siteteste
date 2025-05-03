// formulario-cliente.js
import { supabase } from "./supabase.js";

// --- Elementos DOM (do novo formulário) ---
const formEl = document.getElementById("formularioAtendimento");
const messageContainerEl = document.body; // Usar o body para mensagens gerais ou criar um div específico
const successMessageEl = document.getElementById("successMessage");
const submitBtn = document.getElementById("submitBtn");
const pageTitleEl = document.querySelector("h1"); // Título principal da página

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

// Função para exibir mensagens (adaptada)
function showMessage(type, text, duration = 5000) {
    const messageDiv = document.createElement('div');
    messageDiv.style.padding = '15px';
    messageDiv.style.marginTop = '20px';
    messageDiv.style.marginBottom = '20px';
    messageDiv.style.borderRadius = 'var(--borda-raio)';
    messageDiv.style.textAlign = 'center';
    messageDiv.style.fontWeight = 'bold';
    messageDiv.style.color = 'white';
    messageDiv.style.backgroundColor = type === 'error' ? 'var(--cor-erro)' : 'var(--cor-sucesso)';
    messageDiv.textContent = sanitizeInput(text);
    
    // Insere antes do formulário ou no topo se o form estiver oculto
    const targetElement = formEl.style.display === 'none' ? messageContainerEl.firstChild : formEl;
    messageContainerEl.insertBefore(messageDiv, targetElement);

    // Remove a mensagem após um tempo
    if (duration) {
        setTimeout(() => messageDiv.remove(), duration);
    }
}

// Variável global para guardar o ID do registro do formulário
let currentFormRecordId = null;

// Função para buscar dados do formulário e cliente
async function loadForm(token) {
    if (!token) {
        formEl.style.display = "none";
        showMessage("error", "Link inválido. Token não encontrado na URL.", null);
        return;
    }

    try {
        // 1. Busca o formulário pelo token
        const { data: formData, error: formError } = await supabase
            .from("formularios_clientes")
            .select("id, status, data_preenchimento, clientes(nome)") // Busca ID, status, data e nome do cliente
            .eq("token_unico", token)
            .single(); // Espera apenas um resultado

        if (formError || !formData) {
            formEl.style.display = "none";
            if (formError && formError.code === 'PGRST116') { // Código para "No rows found"
                 showMessage("error", "Link inválido ou expirado. O link para este formulário não é válido ou já foi utilizado.", null);
            } else {
                throw formError || new Error("Formulário não encontrado.");
            }
            return;
        }

        currentFormRecordId = formData.id; // Guarda o ID para o submit

        // Atualiza o título com o nome do cliente, se disponível
        if (formData.clientes && formData.clientes.nome) {
            pageTitleEl.textContent = `Formulário para ${sanitizeInput(formData.clientes.nome)}`;
        }

        // 2. Verifica o status do formulário
        if (formData.status === "pendente") {
            // O formulário HTML já está na página, apenas garante que está visível
            formEl.style.display = "grid"; 
            successMessageEl.style.display = "none";
            // Adiciona o listener para o envio do formulário AQUI, após confirmar que é pendente
            formEl.addEventListener("submit", handleFormSubmit);
        } else if (formData.status === "preenchido") {
            formEl.style.display = "none";
            successMessageEl.textContent = `Formulário enviado com sucesso em: ${new Date(formData.data_preenchimento).toLocaleString("pt-BR")}`;
            successMessageEl.style.display = "block";
            pageTitleEl.textContent = 'Obrigado!'; // Muda o título
        } else {
            formEl.style.display = "none";
            showMessage("error", `Status inválido do formulário: ${formData.status}`, null);
        }

    } catch (error) {
        console.error("Erro ao carregar formulário:", error);
        formEl.style.display = "none";
        showMessage("error", `Erro ao carregar: ${error.message}`, null);
    }
}

// Função para lidar com o envio do formulário (adaptada do script interno do HTML)
async function handleFormSubmit(event) {
    event.preventDefault();
    
    // Limpa mensagens de erro anteriores (se houver alguma específica do JS)
    // As validações de campo e mensagens de erro de campo são tratadas no script interno do HTML

    // Validação básica (exemplo: nome)
    const nomeInput = document.getElementById('nome');
    if (!nomeInput.value.trim()) {
        showMessage('error', 'Por favor, preencha o nome completo.');
        nomeInput.focus();
        return;
    }
    // Adicionar mais validações JS se necessário, complementando as do HTML
    if (!document.querySelector('input[name="unicaRenda"]:checked')) {
        showMessage('error', 'Por favor, informe se você é a única pessoa com renda.');
        document.getElementById('label-unica-renda').scrollIntoView();
        return;
    }
     if (!document.querySelector('input[name="temDependentes"]:checked')) {
        showMessage('error', 'Por favor, informe se você possui dependentes.');
        document.getElementById('label-tem-dependentes').scrollIntoView();
        return;
    }
    // ... outras validações importantes ...

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    // --- Coleta de dados (adaptada do script interno) ---
    const formData = new FormData(formEl);
    const dadosFormulario = {};

    // Coleta campos simples e radios
    formData.forEach((value, key) => {
        const inputElement = formEl.querySelector(`[name="${key}"]`);
        if (inputElement && inputElement.type === 'radio') {
            const checkedRadio = formEl.querySelector(`input[name="${key}"]:checked`);
            if (checkedRadio) {
                dadosFormulario[key] = checkedRadio.value;
            }
        } else if (inputElement && inputElement.classList.contains('moeda')) {
            dadosFormulario[key] = desformatarMoeda(value); // Usa a função do script interno
        } else {
            dadosFormulario[key] = value;
        }
    });

    // Coleta dados de Pessoas com Renda (agrupados)
    dadosFormulario.pessoasRenda = [];
    document.querySelectorAll('.pessoa-item').forEach(item => {
        const pessoa = {};
        item.querySelectorAll('input, select').forEach(input => {
            const key = input.name.replace(/-\d+$/, ''); // Remove o ID do final da chave
            if (input.classList.contains('moeda')) {
                pessoa[key] = desformatarMoeda(input.value);
            } else {
                pessoa[key] = input.value;
            }
        });
        dadosFormulario.pessoasRenda.push(pessoa);
    });

    // Coleta dados de Dependentes (agrupados)
    dadosFormulario.dependentes = [];
    document.querySelectorAll('.dependente-item').forEach(item => {
        const dependente = {};
        item.querySelectorAll('input, select').forEach(input => {
            const key = input.name.replace(/-\d+$/, '');
            dependente[key] = input.value;
        });
        dadosFormulario.dependentes.push(dependente);
    });

    // Coleta dados de Patrimônios (agrupados)
    dadosFormulario.patrimonios = [];
    document.querySelectorAll('.patrimonio-item').forEach(item => {
        const patrimonio = {};
        item.querySelectorAll('input, select').forEach(input => {
            const key = input.name.replace(/-\d+$/, '');
            if (input.classList.contains('moeda')) {
                patrimonio[key] = desformatarMoeda(input.value);
            } else {
                patrimonio[key] = input.value;
            }
        });
        dadosFormulario.patrimonios.push(patrimonio);
    });
    
    // Coleta dados de Dívidas (agrupados)
    dadosFormulario.dividas = [];
    document.querySelectorAll('.divida-item').forEach(item => {
        const divida = {};
        item.querySelectorAll('input, select').forEach(input => {
            const key = input.name.replace(/-\d+$/, '');
            if (input.classList.contains('moeda')) {
                divida[key] = desformatarMoeda(input.value);
            } else if (input.type === 'number') {
                divida[key] = parseFloat(input.value) || 0;
            } else {
                divida[key] = input.value;
            }
        });
        dadosFormulario.dividas.push(divida);
    });
    
    // Coleta dados de Plano de Saúde (pessoas e dependentes)
    dadosFormulario.planoSaudeDetalhes = {};
    document.querySelectorAll('input[name^="planoSaude-"]').forEach(radio => {
        if (radio.checked) {
            const id = radio.name.split('-').pop(); // Pega o ID (cliente, pessoaRenda-X, dependente-X)
            dadosFormulario.planoSaudeDetalhes[id] = radio.value;
        }
    });
    
    // Coleta dados de Seguro de Vida (pessoas)
    dadosFormulario.seguroVidaDetalhes = {};
    document.querySelectorAll('input[name^="seguroVida-"]').forEach(radio => {
        if (radio.checked) {
            const id = radio.name.split('-').pop();
            dadosFormulario.seguroVidaDetalhes[id] = radio.value;
        }
    });
    
    // Coleta dados de Patrimônio Líquido (outras pessoas)
    dadosFormulario.patrimonioLiquidoPessoas = {};
    document.querySelectorAll('input[name^="patrimonioLiquido-"]').forEach(input => {
        const id = input.name.split('-').pop();
        // Certifica-se de que não é o input principal (que não tem ID numérico)
        if (input.id !== 'patrimonioLiquido') { 
           dadosFormulario.patrimonioLiquidoPessoas[id] = desformatarMoeda(input.value);
        }
    });
    
    // Coleta dados de IR (cliente e outras pessoas)
    dadosFormulario.impostoRendaDetalhes = {};
    // Cliente
    const declaraIRCliente = document.querySelector('input[name="declaraIR"]:checked');
    if (declaraIRCliente) {
        dadosFormulario.impostoRendaDetalhes.cliente = { declara: declaraIRCliente.value };
        if (declaraIRCliente.value === 'Sim') {
            const tipoDeclara = document.querySelector('input[name="tipoDeclaracao"]:checked');
            const resultadoIR = document.querySelector('input[name="resultadoIR"]:checked');
            dadosFormulario.impostoRendaDetalhes.cliente.tipo = tipoDeclara ? tipoDeclara.value : null;
            dadosFormulario.impostoRendaDetalhes.cliente.resultado = resultadoIR ? resultadoIR.value : null;
        }
    }
    // Outras Pessoas
    document.querySelectorAll('input[name^="declaraIR-"]').forEach(radio => {
        if (radio.checked) {
            const id = radio.name.split('-').pop();
            // Certifica-se que é um ID de pessoa (evita o 'cliente' principal)
            if (id !== 'declaraIR') {
                dadosFormulario.impostoRendaDetalhes[id] = { declara: radio.value };
                if (radio.value === 'Sim') {
                    const tipoDeclaraPessoa = document.querySelector(`input[name="tipoDeclaracao-${id}"]:checked`);
                    const resultadoIRPessoa = document.querySelector(`input[name="resultadoIR-${id}"]:checked`);
                    dadosFormulario.impostoRendaDetalhes[id].tipo = tipoDeclaraPessoa ? tipoDeclaraPessoa.value : null;
                    dadosFormulario.impostoRendaDetalhes[id].resultado = resultadoIRPessoa ? resultadoIRPessoa.value : null;
                }
            }
        }
    });
    
    // Coleta dados de Fluxo de Caixa (pessoas)
    dadosFormulario.fluxoCaixaDetalhes = {};
    document.querySelectorAll('.pessoa-fluxo-caixa').forEach(div => {
        const inputRenda = div.querySelector('input[name^="rendaMensal-"]');
        if (inputRenda) {
            const id = inputRenda.name.split('-').pop();
            dadosFormulario.fluxoCaixaDetalhes[id] = {
                rendaMensal: desformatarMoeda(div.querySelector(`input[name="rendaMensal-${id}"]`).value),
                despesasFixas: desformatarMoeda(div.querySelector(`input[name="despesasFixas-${id}"]`).value),
                despesasVariaveis: desformatarMoeda(div.querySelector(`input[name="despesasVariaveis-${id}"]`).value)
            };
        }
    });
    // --- Fim da Coleta de dados ---

    console.log('Dados JSON a serem enviados:', JSON.stringify(dadosFormulario, null, 2));

    // --- Envio para o Supabase ---
    try {
        if (!currentFormRecordId) {
            throw new Error("ID do registro do formulário não encontrado. Não é possível salvar.");
        }

        const { error: updateError } = await supabase
            .from("formularios_clientes")
            .update({
                dados_formulario: dadosFormulario, // Salva o objeto JSON
                status: "preenchido",
                data_preenchimento: new Date().toISOString()
            })
            .eq("id", currentFormRecordId); // Usa o ID guardado

        if (updateError) {
            console.error("Erro ao atualizar Supabase:", updateError);
            throw new Error("Erro ao salvar os dados. Tente novamente.");
        }

        // Sucesso
        formEl.style.display = "none";
        successMessageEl.textContent = "Formulário enviado com sucesso!";
        successMessageEl.style.display = "block";
        pageTitleEl.textContent = 'Obrigado!';
        showMessage("success", "Suas respostas foram enviadas.");

    } catch (error) {
        console.error("Erro no envio:", error);
        showMessage("error", error.message || "Ocorreu um erro inesperado ao salvar.");
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enviar Formulário';
    }
}

// --- Inicialização ---
// Pega o token da URL (ex: ?token=valor)
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token");

// Carrega o formulário baseado no token
loadForm(token);

// --- Funções Globais (necessárias para os botões onclick no HTML) ---
// Disponibiliza funções do script interno no escopo global para os `onclick`
// É importante que as funções chamadas pelos `onclick` estejam acessíveis globalmente.
// As funções formatarMoeda e desformatarMoeda já estão no escopo global do script interno.
// As funções toggle*, adicionar*, removerItem*, atualizar* também estão lá.
// Se o script interno for removido do HTML e colocado aqui, essas funções precisam ser definidas aqui.
// Por enquanto, assumindo que o <script> permanece no HTML.

// Exemplo de como expor uma função se ela estivesse neste arquivo:
// window.adicionarPessoaRenda = adicionarPessoaRenda;

// Nota: As funções `formatarMoeda` e `desformatarMoeda` são usadas aqui, então precisam estar disponíveis.
// Elas já estão no script dentro do HTML. Se esse script for removido, elas precisam ser copiadas para cá.

// Exemplo de cópia das funções de formatação (se necessário):
/*
function formatarMoeda(valor) {
    if (!valor) return '';
    valor = valor.replace(/\D/g, '');
    valor = (parseInt(valor) / 100).toFixed(2) + '';
    valor = valor.replace(".", ",");
    valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    return 'R$ ' + valor;
}

function desformatarMoeda(valor) {
    if (!valor) return 0;
    valor = valor.replace(/[^\d,]/g, '');
    valor = valor.replace(".", "");
    valor = valor.replace(",", ".");
    return parseFloat(valor) || 0;
}
*/


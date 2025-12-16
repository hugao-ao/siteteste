// propostas-pdf-generator.js
// Sistema de Geração de Propostas HVC em PDF

class PropostaPDFGenerator {
    constructor() {
        this.currentPropostaId = null;
        this.propostaData = null;
        this.responsaveis = [];
        this.itens = [];
        this.selectedFolderId = null;
        this.selectedFolderPath = '';
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Botão Atualizar Preview
        document.getElementById('btn-atualizar-preview')?.addEventListener('click', () => {
            this.updatePreview();
        });

        // Botão Salvar PDF
        document.getElementById('btn-salvar-pdf')?.addEventListener('click', () => {
            this.savePDFToOneDrive();
        });

        // Fechar modais
        document.getElementById('close-modal-gerar-pdf')?.addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('close-gerar-pdf-btn')?.addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('close-modal-onedrive-folder')?.addEventListener('click', () => {
            this.closeFolderModal();
        });

        document.getElementById('cancel-folder-selection')?.addEventListener('click', () => {
            this.closeFolderModal();
        });

        document.getElementById('confirm-folder-selection')?.addEventListener('click', () => {
            this.confirmFolderSelection();
        });
    }

    async openModal(propostaId) {
        try {
            this.currentPropostaId = propostaId;
            
            // Carregar dados da proposta
            await this.loadPropostaData();
            
            // Preencher formulário
            this.populateForm();
            
            // Abrir modal
            const modal = document.getElementById('modal-gerar-pdf');
            if (modal) {
                modal.classList.add('show');
            }
            
        } catch (error) {
            console.error('Erro ao abrir modal de PDF:', error);
            alert('Erro ao carregar dados da proposta: ' + error.message);
        }
    }

    async loadPropostaData() {
        if (!supabaseClient) {
            throw new Error('Supabase não inicializado');
        }

        // Carregar proposta com cliente
        const { data: proposta, error: propostaError } = await supabaseClient
            .from('propostas_hvc')
            .select(`
                *,
                clientes_hvc (
                    id,
                    nome,
                    documento,
                    tipo_documento
                )
            `)
            .eq('id', this.currentPropostaId)
            .single();

        if (propostaError) throw propostaError;
        this.propostaData = proposta;

        // Carregar responsáveis do cliente
        const { data: responsaveis, error: responsaveisError } = await supabaseClient
            .from('responsaveis_cliente_hvc')
            .select('*')
            .eq('cliente_id', proposta.cliente_id);

        if (responsaveisError) throw responsaveisError;
        this.responsaveis = responsaveis || [];

        // Carregar itens da proposta
        const { data: itens, error: itensError } = await supabaseClient
            .from('itens_proposta_hvc')
            .select(`
                *,
                servico:servicos_hvc(*),
                local:locais_hvc(nome)
            `)
            .eq('proposta_id', this.currentPropostaId);

        if (itensError) throw itensError;
        this.itens = itens || [];
    }

    populateForm() {
        // Preencher seletor de representantes
        const selectRepresentante = document.getElementById('pdf-representante');
        if (selectRepresentante) {
            selectRepresentante.innerHTML = '<option value="">Selecione um representante</option>';
            
            this.responsaveis.forEach(resp => {
                const option = document.createElement('option');
                option.value = resp.nome;
                option.textContent = resp.nome;
                selectRepresentante.appendChild(option);
            });

            // Se houver apenas um responsável, selecionar automaticamente
            if (this.responsaveis.length === 1) {
                selectRepresentante.value = this.responsaveis[0].nome;
            }
        }

        // Preencher nome da obra com observações se houver
        const inputNomeObra = document.getElementById('pdf-nome-obra');
        if (inputNomeObra && this.propostaData.observacoes) {
            inputNomeObra.value = this.propostaData.observacoes.substring(0, 100);
        }

        // Selecionar assinante padrão
        const selectAssinante = document.getElementById('pdf-assinante');
        if (selectAssinante) {
            selectAssinante.value = 'Hermógenes C. P. Viana';
        }

        // Selecionar formato padrão
        const selectFormato = document.getElementById('pdf-formato');
        if (selectFormato) {
            selectFormato.value = 'tabela';
        }
    }

    updatePreview() {
        try {
            // Validar campos obrigatórios
            const representante = document.getElementById('pdf-representante')?.value;
            if (!representante) {
                alert('Por favor, selecione um representante.');
                return;
            }

            const assinante = document.getElementById('pdf-assinante')?.value;
            if (!assinante) {
                alert('Por favor, selecione um assinante.');
                return;
            }

            // Coletar dados do formulário
            const formData = {
                nomeObra: document.getElementById('pdf-nome-obra')?.value || this.propostaData.observacoes || 'Não informado',
                representante: representante,
                opcao: document.getElementById('pdf-opcao')?.value || '',
                assinante: assinante,
                formato: document.getElementById('pdf-formato')?.value || 'tabela'
            };

            // Gerar HTML da proposta
            const html = this.generatePropostaHTML(formData);

            // Inserir no preview
            const previewContainer = document.getElementById('pdf-preview-container');
            if (previewContainer) {
                previewContainer.innerHTML = html;
            }

        } catch (error) {
            console.error('Erro ao atualizar preview:', error);
            alert('Erro ao gerar preview: ' + error.message);
        }
    }

    generatePropostaHTML(formData) {
        const { nomeObra, representante, opcao, assinante, formato } = formData;
        const proposta = this.propostaData;
        const cliente = proposta.clientes_hvc;

        // Formatar data
        const dataFormatada = new Date(proposta.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        const diaSemana = new Date(proposta.created_at).toLocaleDateString('pt-BR', { weekday: 'long' });
        const dataCompleta = `${diaSemana}, ${dataFormatada}`;

        // Formatar prazo
        let prazoTexto = '';
        if (proposta.tipo_prazo === 'cronograma') {
            prazoTexto = 'De acordo com o cronograma da obra.';
        } else {
            const tipoDias = proposta.tipo_prazo === 'uteis' ? 'dias úteis' : 'dias corridos';
            prazoTexto = `${proposta.prazo_execucao || 0} ${tipoDias}`;
        }

        // Gerar conteúdo baseado no formato
        let conteudo = '';

        if (formato === 'tabela') {
            conteudo = this.generateTabelaFormat(nomeObra, representante, opcao, dataCompleta);
        } else {
            conteudo = this.generateSimplesFormat(nomeObra, representante);
        }

        // Template completo
        return `
            <div style="font-family: Arial, sans-serif; padding: 40px; background: white; color: #000;">
                <!-- Cabeçalho -->
                <div style="text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 3px solid #000080;">
                    <h1 style="font-size: 24pt; font-weight: bold; color: #000080; letter-spacing: 1px; margin: 0;">
                        HVC IMPERMEABILIZAÇÕES LTDA.
                    </h1>
                </div>

                <!-- Número da Proposta -->
                <div style="text-align: right; margin-bottom: 20px;">
                    <strong>Proposta nº ${proposta.numero_proposta}</strong>
                </div>

                ${conteudo}

                <!-- Total Geral -->
                <div style="background: #00FF00; font-weight: bold; font-size: 11pt; padding: 10px; text-align: right; border: 2px solid #000; margin-bottom: 20px;">
                    TOTAL GERAL: R$ ${this.formatMoney(proposta.total_proposta || 0)}
                </div>

                <!-- Condições -->
                <div style="margin-bottom: 15px;">
                    <h3 style="font-size: 11pt; font-weight: bold; margin-bottom: 8px;">CONDIÇÕES DE PAGAMENTO</h3>
                    <p style="margin-left: 20px;">- ${proposta.forma_pagamento || 'A combinar'}</p>
                </div>

                <div style="margin-bottom: 15px;">
                    <h3 style="font-size: 11pt; font-weight: bold; margin-bottom: 8px;">PRAZO DE EXECUÇÃO</h3>
                    <p style="margin-left: 20px;">- ${prazoTexto}</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 11pt; font-weight: bold; margin-bottom: 8px;">GARANTIA</h3>
                    <p style="margin-left: 20px; text-align: justify; line-height: 1.5; font-size: 9.5pt;">
                        A garantia legal é válida para os serviços executados e a qualidade dos materiais 
                        empregados que porventura apresentem falhas no seu rendimento, por um prazo de até três 
                        anos a contar da data de entrega dos mesmos, conforme Capítulo oito, Artigo 618 do Código 
                        Civil Brasileiro. É restrita à impermeabilização defeituosa e inválida caso haja danos causados 
                        por terceiros e/ou deficiência estrutural.
                    </p>
                </div>

                ${proposta.observacoes && formato === 'tabela' ? `
                <div style="background: #E6F2FF; padding: 10px; margin-bottom: 20px; border: 1px solid #000080;">
                    <h3 style="font-size: 10pt; font-weight: bold; margin-bottom: 5px; color: #000080;">OBS:</h3>
                    <p style="font-size: 9pt; line-height: 1.4; margin: 0;">${proposta.observacoes}</p>
                </div>
                ` : ''}

                <!-- Assinatura -->
                <div style="margin-top: 40px; text-align: right;">
                    <p style="margin-bottom: 10px;">Recife, ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.</p>
                    <p style="margin-bottom: 40px;">Atenciosamente,</p>
                    <p style="font-weight: bold; margin-bottom: 5px;">${assinante}</p>
                    <p style="font-size: 9pt;">${assinante.includes('Hugo') ? 'ENGENHEIRO CIVIL – CREA: 1818793830' : 'ENGENHEIRO CIVIL – CREA: 1805287389'}</p>
                </div>

                <!-- Rodapé -->
                <div style="text-align: center; padding-top: 15px; border-top: 3px solid #000080; font-size: 9pt; margin-top: 30px;">
                    <p style="margin-bottom: 3px;">Rua Profª Anunciada da Rocha Melo, 214 – Sl 104 – Madalena – CEP: 50710-390 Fone: 3228-3025 – Recife/PE</p>
                    <p>E-mail: hvcimpermeabilizacoes@gmail.com – CNPJ 22.335.667/0001-88</p>
                </div>
            </div>
        `;
    }

    generateTabelaFormat(nomeObra, representante, opcao, dataCompleta) {
        const proposta = this.propostaData;
        const cliente = proposta.clientes_hvc;

        // Agrupar itens por local
        const itensPorLocal = {};
        this.itens.forEach(item => {
            const localNome = item.local?.nome || 'SEM LOCAL';
            if (!itensPorLocal[localNome]) {
                itensPorLocal[localNome] = [];
            }
            itensPorLocal[localNome].push(item);
        });

        // Gerar linhas da tabela
        let linhasTabela = '';
        let itemIndex = 1;

        Object.keys(itensPorLocal).forEach(localNome => {
            // Cabeçalho do grupo
            linhasTabela += `
                <tr>
                    <td colspan="6" style="background: #D3D3D3; font-weight: bold; text-align: left; padding: 8px; font-size: 10pt; border: 1px solid #000;">
                        ${localNome}
                    </td>
                </tr>
            `;

            // Itens do grupo
            itensPorLocal[localNome].forEach(item => {
                const servico = item.servico;
                const descricaoCompleta = servico.detalhe 
                    ? `${servico.descricao} ${servico.detalhe}`
                    : servico.descricao;

                linhasTabela += `
                    <tr style="background: ${itemIndex % 2 === 0 ? '#F5F5F5' : 'white'};">
                        <td style="text-align: center; padding: 6px 5px; border: 1px solid #000;">${itemIndex}</td>
                        <td style="padding: 6px 5px; border: 1px solid #000;">${descricaoCompleta}</td>
                        <td style="text-align: center; padding: 6px 5px; border: 1px solid #000;">${servico.unidade}</td>
                        <td style="text-align: right; padding: 6px 5px; border: 1px solid #000;">${this.formatNumber(item.quantidade)}</td>
                        <td style="text-align: right; padding: 6px 5px; border: 1px solid #000;">R$ ${this.formatMoney((item.preco_mao_obra || 0) + (item.preco_material || 0))}</td>
                        <td style="text-align: right; padding: 6px 5px; border: 1px solid #000; font-weight: bold;">R$ ${this.formatMoney(item.preco_total || 0)}</td>
                    </tr>
                `;
                itemIndex++;
            });
        });

        return `
            <!-- Info Box -->
            <div style="border: 2px solid #000080; padding: 15px; margin-bottom: 20px; background: #F0F8FF; font-size: 10pt;">
                <div style="margin-bottom: 8px;">
                    <strong>CLIENTE:</strong> ${cliente.nome}
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>PROPOSTA:</strong> ${proposta.numero_proposta}${opcao ? ` - ${opcao}` : ''}
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>DATA:</strong> ${dataCompleta}
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>OBRA:</strong> ${nomeObra}
                </div>
                <div>
                    <strong>ATT:</strong> ${representante}
                </div>
            </div>

            <!-- Tabela de Serviços -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 9pt;">
                <thead style="background: #4A4A4A; color: white;">
                    <tr>
                        <th style="padding: 10px 5px; border: 1px solid #000; font-size: 9pt; width: 40px;">ITEM</th>
                        <th style="padding: 10px 5px; border: 1px solid #000; font-size: 9pt; text-align: left;">ESPECIFICAÇÃO DOS SERVIÇOS</th>
                        <th style="padding: 10px 5px; border: 1px solid #000; font-size: 9pt; width: 50px;">UND</th>
                        <th style="padding: 10px 5px; border: 1px solid #000; font-size: 9pt; width: 80px;">QUANT.</th>
                        <th style="padding: 10px 5px; border: 1px solid #000; font-size: 9pt; width: 100px;">VALOR UNIT.</th>
                        <th style="padding: 10px 5px; border: 1px solid #000; font-size: 9pt; width: 100px;">P. TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhasTabela}
                </tbody>
            </table>
        `;
    }

    generateSimplesFormat(nomeObra, representante) {
        const proposta = this.propostaData;
        const cliente = proposta.clientes_hvc;

        let itensHTML = '';
        this.itens.forEach((item, index) => {
            const servico = item.servico;
            const localNome = item.local?.nome || 'SEM LOCAL';
            const descricaoCompleta = servico.detalhe 
                ? `${servico.descricao} ${servico.detalhe}`
                : servico.descricao;

            itensHTML += `
                <div style="margin-bottom: 15px;">
                    <p style="font-weight: bold; margin-bottom: 5px;">
                        ${index + 1}. ${localNome} - ${descricaoCompleta}
                    </p>
                    <p style="margin-left: 20px; margin-bottom: 5px;">
                        ${this.formatNumber(item.quantidade)} ${servico.unidade} x R$ ${this.formatMoney((item.preco_mao_obra || 0) + (item.preco_material || 0))} = R$ ${this.formatMoney(item.preco_total || 0)}
                    </p>
                </div>
            `;
        });

        return `
            <!-- Destinatário -->
            <div style="margin-bottom: 20px;">
                <p style="margin-bottom: 5px;"><strong>Cliente:</strong> ${cliente.nome}</p>
                <p style="margin-bottom: 5px;"><strong>Obra:</strong> ${nomeObra}</p>
                <p style="margin-bottom: 5px;"><strong>Att:</strong> ${representante}</p>
            </div>

            <!-- Especificação -->
            <div style="margin-bottom: 15px;">
                <h2 style="font-size: 12pt; font-weight: bold; margin-bottom: 15px; color: #000080;">ESPECIFICAÇÃO DA OBRA:</h2>
                ${itensHTML}
            </div>
        `;
    }

    async savePDFToOneDrive() {
        try {
            // Validar preview
            const previewContainer = document.getElementById('pdf-preview-container');
            if (!previewContainer || !previewContainer.innerHTML.includes('HVC IMPERMEABILIZAÇÕES')) {
                alert('Por favor, atualize o preview antes de salvar.');
                return;
            }

            // Abrir modal de seleção de pasta
            await this.openFolderSelector();

        } catch (error) {
            console.error('Erro ao salvar PDF:', error);
            alert('Erro ao salvar PDF: ' + error.message);
        }
    }

    async openFolderSelector() {
        // Implementação do seletor de pasta OneDrive
        // Esta função será expandida com a integração do OneDrive
        alert('Funcionalidade de seleção de pasta OneDrive será implementada em breve!');
    }

    formatMoney(value) {
        if (value === null || value === undefined) return '0,00';
        return parseFloat(value).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    formatNumber(value) {
        if (value === null || value === undefined) return '0';
        return parseFloat(value).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    closeModal() {
        const modal = document.getElementById('modal-gerar-pdf');
        if (modal) {
            modal.classList.remove('show');
        }
        
        // Limpar dados
        this.currentPropostaId = null;
        this.propostaData = null;
        this.responsaveis = [];
        this.itens = [];
        
        // Limpar preview
        const previewContainer = document.getElementById('pdf-preview-container');
        if (previewContainer) {
            previewContainer.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #808080;">
                    <i class="fas fa-file-pdf" style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                    <p>Clique em "Atualizar Preview" para visualizar a proposta</p>
                </div>
            `;
        }
    }

    closeFolderModal() {
        const modal = document.getElementById('modal-onedrive-folder');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    confirmFolderSelection() {
        // Implementação da confirmação de pasta
        this.closeFolderModal();
        alert('Pasta selecionada! Gerando PDF...');
    }
}

// Inicializar quando o DOM estiver pronto
let pdfGenerator;
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        pdfGenerator = new PropostaPDFGenerator();
        window.pdfGenerator = pdfGenerator;
    }, 1500);
});

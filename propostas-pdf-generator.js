// propostas-pdf-generator.js
// Sistema de Geração de Propostas HVC em PDF
console.log('DEBUG: propostas-pdf-generator.js carregado');

class PropostaPDFGenerator {
    constructor() {
        this.currentPropostaId = null;
        this.propostaData = null;
        this.currentProposta = null;
        this.responsaveis = [];
        this.itens = [];
        this.currentFolderId = null;
        this.folderPath = [];
        this.currentPDFBlob = null;
    }

    initializeEventListeners() {
        console.log('DEBUG: initializeEventListeners() chamado');
        
        // Botão Atualizar Preview
        const btnAtualizarPreview = document.getElementById('btn-atualizar-preview');
        console.log('DEBUG: btn-atualizar-preview encontrado:', !!btnAtualizarPreview);
        btnAtualizarPreview?.addEventListener('click', () => {
            console.log('DEBUG: Botão Atualizar Preview clicado');
            this.updatePreview();
        });

        // Botão Salvar PDF no OneDrive
        const btnSalvarPdf = document.getElementById('btn-salvar-pdf');
        console.log('DEBUG: btn-salvar-pdf encontrado:', !!btnSalvarPdf);
        btnSalvarPdf?.addEventListener('click', () => {
            console.log('DEBUG: Botão Salvar PDF OneDrive clicado');
            this.savePDFToOneDrive();
        });

        // Botão Salvar PDF no PC
        const btnSalvarPdfPc = document.getElementById('btn-salvar-pdf-pc');
        console.log('DEBUG: btn-salvar-pdf-pc encontrado:', !!btnSalvarPdfPc);
        btnSalvarPdfPc?.addEventListener('click', () => {
            console.log('DEBUG: Botão Salvar PDF PC clicado');
            this.downloadPDFToPC();
        });

        // Fechar modais
        const closeModalGerarPdf = document.getElementById('close-modal-gerar-pdf');
        console.log('DEBUG: close-modal-gerar-pdf encontrado:', !!closeModalGerarPdf);
        closeModalGerarPdf?.addEventListener('click', () => {
            console.log('DEBUG: Botão Fechar Modal PDF clicado');
            this.closeModal();
        });

        const closeGerarPdfBtn = document.getElementById('close-gerar-pdf-btn');
        console.log('DEBUG: close-gerar-pdf-btn encontrado:', !!closeGerarPdfBtn);
        closeGerarPdfBtn?.addEventListener('click', () => {
            console.log('DEBUG: Botão Fechar Gerar PDF clicado');
            this.closeModal();
        });

        const closeModalOnedrive = document.getElementById('close-modal-onedrive-folder');
        console.log('DEBUG: close-modal-onedrive-folder encontrado:', !!closeModalOnedrive);
        closeModalOnedrive?.addEventListener('click', () => {
            console.log('DEBUG: Botão Fechar Modal OneDrive clicado');
            this.closeFolderModal();
        });

        const cancelFolderBtn = document.getElementById('cancel-folder-selection');
        console.log('DEBUG: cancel-folder-selection encontrado:', !!cancelFolderBtn);
        cancelFolderBtn?.addEventListener('click', () => {
            console.log('DEBUG: Botão Cancelar Seleção Pasta clicado');
            this.closeFolderModal();
        });

        const confirmFolderBtn = document.getElementById('confirm-folder-selection');
        console.log('DEBUG: confirm-folder-selection encontrado:', !!confirmFolderBtn);
        confirmFolderBtn?.addEventListener('click', () => {
            console.log('DEBUG: Botão Confirmar Seleção Pasta clicado');
            this.confirmFolderSelection();
        });
        
        console.log('DEBUG: Todos os event listeners configurados');
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
        this.currentProposta = proposta;

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

        // Preencher data da proposta com data atual
        const inputDataProposta = document.getElementById('pdf-data-proposta');
        if (inputDataProposta) {
            const hoje = new Date();
            const dataFormatada = hoje.toISOString().split('T')[0];
            inputDataProposta.value = dataFormatada;
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

            const dataProposta = document.getElementById('pdf-data-proposta')?.value;
            if (!dataProposta) {
                alert('Por favor, selecione a data da proposta.');
                return;
            }

            // Coletar dados do formulário
            const formData = {
                nomeObra: document.getElementById('pdf-nome-obra')?.value || this.propostaData.observacoes || 'Não informado',
                representante: representante,
                dataProposta: dataProposta,
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
        const { nomeObra, representante, dataProposta, assinante, formato } = formData;
        const proposta = this.propostaData;
        const cliente = proposta.clientes_hvc;

        // Formatar data da proposta
        const dataObj = new Date(dataProposta + 'T12:00:00');
        const dataFormatada = dataObj.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        const diaSemana = dataObj.toLocaleDateString('pt-BR', { weekday: 'long' });
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
            conteudo = this.generateTabelaFormat(nomeObra, representante, dataCompleta);
        } else {
            conteudo = this.generateSimplesFormat(nomeObra, representante);
        }

        // Template completo - Layout A4 com margens mínimas
        return `
            <div style="font-family: Arial, sans-serif; padding: 0; margin: 0; background: white; color: #000; width: 200mm; max-width: 200mm; box-sizing: border-box;">
                <!-- Cabeçalho - 3 linhas máx -->
                <div style="text-align: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #000080;">
                    <h1 style="font-size: 18pt; font-weight: bold; color: #000080; letter-spacing: 0.5px; margin: 0 0 3px 0;">
                        HVC IMPERMEABILIZAÇÕES LTDA.
                    </h1>
                    <p style="font-size: 9pt; margin: 0; color: #333;">CNPJ: 22.335.667/0001-88 | Fone: (81) 3228-3025</p>
                </div>

                <!-- Número da Proposta -->
                <div style="text-align: right; margin-bottom: 8px;">
                    <strong style="font-size: 11pt;">Proposta nº ${proposta.numero_proposta}</strong>
                </div>

                ${conteudo}

                <!-- Total Geral -->
                <div style="background: #00FF00; font-weight: bold; font-size: 12pt; padding: 8px; text-align: right; border: 1px solid #000; margin-bottom: 8px;">
                    TOTAL GERAL: R$ ${this.formatMoney(proposta.total_proposta || 0)}
                    <span style="font-size: 9pt; font-weight: normal; display: block;">(${this.valorPorExtenso(proposta.total_proposta || 0)})</span>
                </div>

                <!-- Condições -->
                <div style="margin-bottom: 5px;">
                    <h3 style="font-size: 11pt; font-weight: bold; margin: 0 0 3px 0; color: #000080;">CONDIÇÕES DE PAGAMENTO</h3>
                    <p style="margin: 0 0 0 15px; font-size: 10pt;">- ${proposta.forma_pagamento || 'A combinar'}</p>
                </div>

                <div style="margin-bottom: 5px;">
                    <h3 style="font-size: 11pt; font-weight: bold; margin: 0 0 3px 0; color: #000080;">PRAZO DE EXECUÇÃO</h3>
                    <p style="margin: 0 0 0 15px; font-size: 10pt;">- ${prazoTexto}</p>
                </div>

                <div style="margin-bottom: 5px;">
                    <h3 style="font-size: 11pt; font-weight: bold; margin: 0 0 3px 0; color: #000080;">GARANTIA</h3>
                    <p style="margin: 0 0 0 15px; text-align: justify; line-height: 1.3; font-size: 9pt;">
                        A garantia legal é válida para os serviços executados e a qualidade dos materiais empregados que porventura apresentem falhas no seu rendimento, por um prazo de até três anos a contar da data de entrega dos mesmos, conforme Capítulo oito, Artigo 618 do Código Civil Brasileiro. É restrita à impermeabilização defeituosa e inválida caso haja danos causados por terceiros e/ou deficiência estrutural.
                    </p>
                </div>

                ${proposta.observacoes && formato === 'tabela' ? `
                <div style="background: #E6F2FF; padding: 6px; margin-bottom: 5px; border: 1px solid #000080;">
                    <h3 style="font-size: 10pt; font-weight: bold; margin: 0 0 3px 0; color: #000080;">OBS:</h3>
                    <p style="font-size: 9pt; line-height: 1.3; margin: 0;">${proposta.observacoes}</p>
                </div>
                ` : ''}

                <!-- Assinatura -->
                <div style="margin-top: 12px; text-align: right;">
                    <p style="margin: 0 0 5px 0; font-size: 10pt;">Recife, ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.</p>
                    <p style="margin: 0 0 15px 0; font-size: 10pt;">Atenciosamente,</p>
                    <p style="font-weight: bold; margin: 0 0 3px 0; font-size: 10pt;">${assinante}</p>
                    <p style="font-size: 9pt; margin: 0;">${assinante.includes('Hugo') ? 'ENGENHEIRO CIVIL – CREA: 1818793830' : 'ENGENHEIRO CIVIL – CREA: 1805287389'}</p>
                </div>

                <!-- Rodapé -->
                <div style="text-align: center; padding-top: 8px; border-top: 2px solid #000080; font-size: 8pt; margin-top: 12px;">
                    <p style="margin: 0;">Rua Profª Anunciada da Rocha Melo, 214 – Sl 104 – Madalena – CEP: 50710-390 – Recife/PE | Fone: (81) 3228-3025 | E-mail: hvcimpermeabilizacoes@gmail.com</p>
                </div>
            </div>
        `;
    }

    generateTabelaFormat(nomeObra, representante, dataCompleta) {
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
                    <td colspan="6" style="background: #D3D3D3; font-weight: bold; text-align: left; padding: 4px 5px; font-size: 9pt; border: 1px solid #000;">
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
                        <td style="text-align: center; padding: 4px 2px; border: 1px solid #000; font-size: 9pt;">${itemIndex}</td>
                        <td style="padding: 4px 4px; border: 1px solid #000; font-size: 9pt; word-wrap: break-word;">${descricaoCompleta}</td>
                        <td style="text-align: center; padding: 4px 2px; border: 1px solid #000; font-size: 9pt;">${servico.unidade}</td>
                        <td style="text-align: right; padding: 4px 2px; border: 1px solid #000; font-size: 9pt;">${this.formatNumber(item.quantidade)}</td>
                        <td style="text-align: right; padding: 4px 2px; border: 1px solid #000; font-size: 9pt;">${this.formatMoney((item.preco_mao_obra || 0) + (item.preco_material || 0))}</td>
                        <td style="text-align: right; padding: 4px 2px; border: 1px solid #000; font-size: 9pt; font-weight: bold;">${this.formatMoney(item.preco_total || 0)}</td>
                    </tr>
                `;
                itemIndex++;
            });
        });

        return `
            <!-- Info Box -->
            <div style="border: 1px solid #000080; padding: 6px 8px; margin-bottom: 8px; background: #F0F8FF; font-size: 10pt;">
                <div style="margin-bottom: 3px;"><strong>CLIENTE:</strong> ${cliente.nome}</div>
                <div style="margin-bottom: 3px;"><strong>PROPOSTA:</strong> ${proposta.numero_proposta} | <strong>DATA:</strong> ${dataCompleta}</div>
                <div><strong>OBRA:</strong> ${nomeObra} | <strong>ATT:</strong> ${representante}</div>
            </div>

            <!-- Tabela de Serviços -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 9pt; table-layout: fixed;">
                <thead style="background: #4A4A4A; color: white;">
                    <tr>
                        <th style="padding: 5px 3px; border: 1px solid #000; font-size: 9pt; width: 25px;">ITEM</th>
                        <th style="padding: 5px 3px; border: 1px solid #000; font-size: 9pt; text-align: left;">ESPECIFICAÇÃO DOS SERVIÇOS</th>
                        <th style="padding: 5px 3px; border: 1px solid #000; font-size: 9pt; width: 30px;">UND</th>
                        <th style="padding: 5px 3px; border: 1px solid #000; font-size: 9pt; width: 50px;">QUANT.</th>
                        <th style="padding: 5px 3px; border: 1px solid #000; font-size: 9pt; width: 60px;">V. UNIT.</th>
                        <th style="padding: 5px 3px; border: 1px solid #000; font-size: 9pt; width: 65px;">TOTAL</th>
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
                <div style="margin-bottom: 8px;">
                    <p style="font-weight: bold; margin: 0 0 3px 0; font-size: 10pt;">
                        ${index + 1}. ${localNome} - ${descricaoCompleta}
                    </p>
                    <p style="margin: 0 0 0 15px; font-size: 9pt;">
                        ${this.formatNumber(item.quantidade)} ${servico.unidade} x R$ ${this.formatMoney((item.preco_mao_obra || 0) + (item.preco_material || 0))} = R$ ${this.formatMoney(item.preco_total || 0)}
                    </p>
                </div>
            `;
        });

        return `
            <!-- Destinatário -->
            <div style="margin-bottom: 10px; font-size: 10pt;">
                <p style="margin: 0 0 4px 0;"><strong>Cliente:</strong> ${cliente.nome}</p>
                <p style="margin: 0 0 4px 0;"><strong>Obra:</strong> ${nomeObra}</p>
                <p style="margin: 0;"><strong>Att:</strong> ${representante}</p>
            </div>

            <!-- Especificação -->
            <div style="margin-bottom: 8px;">
                <h2 style="font-size: 11pt; font-weight: bold; margin: 0 0 8px 0; color: #000080;">ESPECIFICAÇÃO DA OBRA:</h2>
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

            // Gerar PDF
            const pdfBlob = await this.generatePDFBlob();
            
            // Salvar blob temporariamente
            this.currentPDFBlob = pdfBlob;

            // Abrir modal de seleção de pasta
            await this.openFolderSelector();

        } catch (error) {
            console.error('Erro ao salvar PDF:', error);
            alert('Erro ao salvar PDF: ' + error.message);
        }
    }

    async generatePDFBlob() {
        try {
            const previewContainer = document.getElementById('pdf-preview-container');
            
            // Configurar opções do html2pdf - A4 com margens mínimas
            const opt = {
                margin: [3, 3, 3, 3], // top, left, bottom, right em mm
                filename: `Proposta_${this.propostaData.numero_proposta}.pdf`,
                image: { type: 'jpeg', quality: 0.95 },
                html2canvas: { 
                    scale: 2,
                    useCORS: true,
                    letterRendering: true
                },
                jsPDF: { 
                    unit: 'mm', 
                    format: 'a4', 
                    orientation: 'portrait' 
                },
                pagebreak: { mode: 'avoid-all' }
            };

            // Gerar PDF e retornar blob
            const pdfBlob = await html2pdf()
                .set(opt)
                .from(previewContainer)
                .output('blob');

            return pdfBlob;

        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            throw new Error('Falha ao gerar PDF: ' + error.message);
        }
    }

    async openFolderSelector() {
        try {
            // Verificar se oneDriveAuth existe
            if (typeof window.oneDriveAuth === 'undefined') {
                alert('Módulo OneDrive não carregado. Por favor, recarregue a página.');
                return;
            }

            // Verificar se MSAL está inicializado
            if (typeof window.msalInstance === 'undefined' || !window.msalInstance) {
                console.log('⏳ MSAL não inicializado, aguardando...');
                
                // Aguardar até 10 segundos pela inicialização do MSAL
                const maxWait = 10000; // 10 segundos
                const startTime = Date.now();
                
                while (!window.msalInstance && (Date.now() - startTime) < maxWait) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    console.log('⏳ Aguardando MSAL... ' + Math.floor((Date.now() - startTime) / 1000) + 's');
                }
                
                // Se ainda não inicializou, tentar inicializar manualmente
                if (!window.msalInstance) {
                    console.log('⏳ MSAL não inicializou automaticamente, tentando inicializar manualmente...');
                    
                    if (typeof window.loadMSALScript === 'function') {
                        await window.loadMSALScript();
                        
                        // Aguardar mais 5 segundos após carregar
                        const initStartTime = Date.now();
                        while (!window.msalInstance && (Date.now() - initStartTime) < 5000) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                }
                
                // Verificar novamente
                if (!window.msalInstance) {
                    alert('OneDrive não inicializado. Por favor, acesse a página OneDrive Browser e conecte sua conta primeiro.');
                    return;
                }
                
                console.log('✅ MSAL inicializado com sucesso!');
            }

            // Verificar se há conta conectada
            if (!window.oneDriveAuth.currentAccount) {
                alert('Por favor, conecte-se ao OneDrive primeiro na página de OneDrive Browser.');
                return;
            }

            // Verificar se há contas no MSAL
            const accounts = window.msalInstance.getAllAccounts();
            if (!accounts || accounts.length === 0) {
                alert('Nenhuma conta OneDrive conectada. Por favor, faça login no OneDrive Browser.');
                return;
            }

            // Resetar navegação
            this.currentFolderId = null;
            this.folderPath = [];

            // Preencher nome do arquivo padrão
            const filenameInput = document.getElementById('pdf-filename-input');
            if (filenameInput && this.currentProposta) {
                // Obter número da proposta e substituir '/' por '.' para evitar criação de pastas
                const numero = (this.currentProposta.numero_proposta || 'XXXX').replace(/\//g, '.');
                
                // Obter nome da obra do campo do formulário ou das observações
                const nomeObraInput = document.getElementById('pdf-nome-obra');
                let nomeObra = nomeObraInput?.value || this.propostaData?.observacoes || '';
                
                // Limpar caracteres inválidos para nome de arquivo
                nomeObra = nomeObra.replace(/[\\/:*?"<>|]/g, '-').trim();
                
                // Limitar tamanho do nome da obra
                if (nomeObra.length > 50) {
                    nomeObra = nomeObra.substring(0, 50).trim();
                }
                
                // Formato: "Proposta nº X.XXXX - Nome da Obra"
                if (nomeObra) {
                    filenameInput.value = `Proposta nº ${numero} - ${nomeObra}`;
                } else {
                    filenameInput.value = `Proposta nº ${numero}`;
                }
            }

            // Abrir modal
            const modal = document.getElementById('modal-onedrive-folder');
            if (modal) {
                modal.classList.add('show');
            }

            // Configurar event listeners dos botões do modal (garantir que funcionem)
            this.setupFolderModalButtons();
            
            // Atualizar pasta selecionada para mostrar raiz
            this.updateSelectedFolder();

            // Carregar pastas raiz
            await this.loadOneDriveFolders();

        } catch (error) {
            console.error('Erro ao abrir seletor de pasta:', error);
            alert('Erro ao abrir seletor de pasta: ' + error.message);
        }
    }

    async loadOneDriveFolders(folderId = null) {
        console.log('DEBUG: loadOneDriveFolders() chamado com folderId:', folderId);
        try {
            const folderList = document.getElementById('onedrive-folders-list');
            console.log('DEBUG: onedrive-folders-list encontrado:', !!folderList);
            if (!folderList) {
                console.error('DEBUG: ERRO - elemento onedrive-folders-list não encontrado!');
                return;
            }

            // Mostrar loading
            folderList.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #808080;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>Carregando pastas...</p>
                </div>
            `;

            // Obter token
            console.log('DEBUG: Tentando obter accessToken...');
            const accessToken = await window.oneDriveAuth.getAccessToken().catch(err => {
                console.error('ERRO FATAL AO OBTER TOKEN:', err);
                throw err;
            });
            console.log('DEBUG: accessToken obtido com sucesso. Tamanho:', accessToken.length);

            // Montar URL da API
            let url;
            if (folderId) {
                url = `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children?$filter=folder ne null&$select=id,name,folder`;
            } else {
                url = 'https://graph.microsoft.com/v1.0/me/drive/root/children?$filter=folder ne null&$select=id,name,folder';
            }

            // Fazer requisição
            console.log('DEBUG: Fazendo requisição para URL:', url);
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error('Erro detalhado da API do Graph:', response.status, errorBody);
                throw new Error(`Erro na API do Graph: ${response.status} - ${response.statusText}. Detalhes: ${errorBody.substring(0, 100)}...`);
            }

            const data = await response.json();
            const folders = data.value || [];

            // Renderizar pastas
            let html = '<div style="padding: 0;">';
            
            // Botão voltar se não estiver na raiz (sempre mostrar)
            if (this.folderPath.length > 0) {
                html += `
                    <div class="folder-item" data-action="back" style="padding: 1rem; border-bottom: 1px solid #ddd; cursor: pointer; display: flex; align-items: center; gap: 0.75rem; transition: background 0.2s; background: #f0f8ff;">
                        <i class="fas fa-arrow-left" style="color: #0078d4; font-size: 1.2rem;"></i>
                        <span style="font-weight: 500; color: #0078d4;">.. (Voltar)</span>
                    </div>
                `;
            }
            
            if (folders.length === 0) {
                html += `
                    <div style="padding: 40px; text-align: center; color: #808080;">
                        <i class="fas fa-folder-open" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                        <p>Nenhuma pasta encontrada</p>
                    </div>
                `;
            } else {
                folders.forEach(folder => {
                    html += `
                        <div class="folder-item" data-folder-id="${folder.id}" data-folder-name="${folder.name}" style="padding: 1rem; border-bottom: 1px solid #ddd; cursor: pointer; display: flex; align-items: center; gap: 0.75rem; transition: background 0.2s; background: white;">
                            <i class="fas fa-folder" style="color: #FFC107; font-size: 1.2rem;"></i>
                            <span style="flex: 1; color: #333;">${folder.name}</span>
                            <i class="fas fa-chevron-right" style="color: #999; font-size: 0.8rem;"></i>
                        </div>
                    `;
                });
                
            }
            
            html += '</div>';
            folderList.innerHTML = html;

            // Adicionar event listeners
            folderList.querySelectorAll('.folder-item').forEach(item => {
                item.addEventListener('mouseenter', function() {
                    if (this.getAttribute('data-action') === 'back') {
                        this.style.background = '#e0f0ff';
                    } else {
                        this.style.background = '#f5f5f5';
                    }
                });
                item.addEventListener('mouseleave', function() {
                    if (this.getAttribute('data-action') === 'back') {
                        this.style.background = '#f0f8ff';
                    } else {
                        this.style.background = 'white';
                    }
                });
                item.addEventListener('click', () => {
                    const action = item.getAttribute('data-action');
                    if (action === 'back') {
                        this.navigateBack();
                    } else {
                        const folderId = item.getAttribute('data-folder-id');
                        const folderName = item.getAttribute('data-folder-name');
                        this.navigateToFolder(folderId, folderName);
                    }
                });
            });

            // Atualizar breadcrumb e pasta selecionada
            this.updateBreadcrumb();
            this.updateSelectedFolder();

        } catch (error) {
            console.error('Erro ao carregar pastas:', error);
            const folderList = document.getElementById('onedrive-folders-list');
            if (folderList) {
                folderList.innerHTML = `
                    <div style="padding: 40px; text-align: center; color: #dc3545;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                        <p>Erro ao carregar pastas</p>
                        <small>${error.message}</small>
                    </div>
                `;
            }
        }
    }

    navigateToFolder(folderId, folderName) {
        this.folderPath.push({ id: folderId, name: folderName });
        this.currentFolderId = folderId;
        this.loadOneDriveFolders(folderId);
    }

    navigateBack() {
        this.folderPath.pop();
        if (this.folderPath.length > 0) {
            const lastFolder = this.folderPath[this.folderPath.length - 1];
            this.currentFolderId = lastFolder.id;
            this.loadOneDriveFolders(lastFolder.id);
        } else {
            this.currentFolderId = null;
            this.loadOneDriveFolders();
        }
    }

    updateBreadcrumb() {
        const breadcrumb = document.getElementById('onedrive-breadcrumb');
        if (!breadcrumb) return;

        let html = '<i class="fas fa-home"></i> Meu OneDrive';
        
        this.folderPath.forEach(folder => {
            html += ` <i class="fas fa-chevron-right" style="font-size: 0.7rem; margin: 0 0.5rem;"></i> ${folder.name}`;
        });

        breadcrumb.innerHTML = html;
    }

    updateSelectedFolder() {
        const selectedFolderPath = document.getElementById('selected-folder-path');
        const confirmBtn = document.getElementById('confirm-folder-selection');
        
        if (selectedFolderPath) {
            if (this.folderPath.length === 0) {
                selectedFolderPath.textContent = 'Meu OneDrive (raiz)';
                selectedFolderPath.style.color = '#28a745';
            } else {
                const path = this.folderPath.map(f => f.name).join(' / ');
                selectedFolderPath.textContent = path;
                selectedFolderPath.style.color = '#28a745';
            }
        }
        
        // Sempre habilitar o botão confirmar (pode salvar na pasta atual)
        if (confirmBtn) {
            confirmBtn.disabled = false;
            console.log('DEBUG: Botão Confirmar habilitado');
        }
    }

    async uploadPDFToOneDrive(overwrite = false) {
        try {
            if (!this.currentPDFBlob) {
                throw new Error('Nenhum PDF gerado');
            }

            // Obter nome do arquivo do input
            const filenameInput = document.getElementById('pdf-filename-input');
            let fileName = filenameInput ? filenameInput.value.trim() : '';
            
            if (!fileName) {
                alert('Por favor, insira um nome para o arquivo.');
                return;
            }
            
            // Adicionar .pdf se não tiver
            if (!fileName.toLowerCase().endsWith('.pdf')) {
                fileName += '.pdf';
            }

            // Obter token
            console.log('DEBUG: Tentando obter accessToken...');
            const accessToken = await window.oneDriveAuth.getAccessToken().catch(err => {
                console.error('ERRO FATAL AO OBTER TOKEN:', err);
                throw err;
            });
            console.log('DEBUG: accessToken obtido com sucesso. Tamanho:', accessToken.length);

            // Verificar se arquivo já existe (apenas se não for sobrescrita)
            if (!overwrite) {
                const exists = await this.checkFileExists(fileName, accessToken);
                if (exists) {
                    // Mostrar modal de confirmação
                    this.showOverwriteConfirmation(fileName);
                    return;
                }
            }

            // URL de upload
            let uploadUrl;
            if (this.currentFolderId) {
                uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${this.currentFolderId}:/${fileName}:/content`;
            } else {
                uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}:/content`;
            }

            // Fazer upload
            const response = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/pdf'
                },
                body: this.currentPDFBlob
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Erro ao fazer upload:', errorText);
                throw new Error('Falha ao fazer upload do PDF');
            }

            const result = await response.json();
            console.log('✅ PDF salvo no OneDrive:', result);

            // Fechar modais
            this.closeFolderModal();
            this.closeModal();

            // Limpar blob
            this.currentPDFBlob = null;

            alert('✅ Proposta salva com sucesso no OneDrive!');

        } catch (error) {
            console.error('❌ Erro ao fazer upload:', error);
            alert('Erro ao salvar PDF no OneDrive: ' + error.message);
        }
    }

    async checkFileExists(fileName, accessToken) {
        try {
            let checkUrl;
            if (this.currentFolderId) {
                checkUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${this.currentFolderId}/children?$filter=name eq '${fileName}'`;
            } else {
                checkUrl = `https://graph.microsoft.com/v1.0/me/drive/root/children?$filter=name eq '${fileName}'`;
            }

            const response = await fetch(checkUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) return false;

            const data = await response.json();
            return data.value && data.value.length > 0;
        } catch (error) {
            console.error('Erro ao verificar arquivo:', error);
            return false;
        }
    }

    showOverwriteConfirmation(fileName) {
        const modal = document.getElementById('modal-confirm-overwrite');
        const filenameSpan = document.getElementById('existing-filename');
        
        if (filenameSpan) {
            filenameSpan.textContent = fileName;
        }
        
        if (modal) {
            modal.style.display = 'flex';
        }

        // Event listeners para os botões
        const cancelBtn = document.getElementById('cancel-overwrite-btn');
        const confirmBtn = document.getElementById('confirm-overwrite-btn');

        const closeOverwriteModal = () => {
            if (modal) modal.style.display = 'none';
        };

        const handleConfirm = async () => {
            closeOverwriteModal();
            await this.uploadPDFToOneDrive(true); // Sobrescrever
        };

        // Remover listeners antigos
        if (cancelBtn) {
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            newCancelBtn.addEventListener('click', closeOverwriteModal);
        }

        if (confirmBtn) {
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            newConfirmBtn.addEventListener('click', handleConfirm);
        }
    }

    valorPorExtenso(valor) {
        if (valor === null || valor === undefined || valor === 0) {
            return 'zero reais';
        }

        const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
        const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
        const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
        const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

        function porExtenso(num) {
            if (num === 0) return '';
            if (num === 100) return 'cem';
            if (num < 10) return unidades[num];
            if (num < 20) return especiais[num - 10];
            if (num < 100) {
                const dez = Math.floor(num / 10);
                const uni = num % 10;
                return dezenas[dez] + (uni > 0 ? ' e ' + unidades[uni] : '');
            }
            if (num < 1000) {
                const cen = Math.floor(num / 100);
                const resto = num % 100;
                return centenas[cen] + (resto > 0 ? ' e ' + porExtenso(resto) : '');
            }
            return '';
        }

        const valorInt = Math.floor(valor);
        const centavos = Math.round((valor - valorInt) * 100);

        let extenso = '';

        // Milhões
        const milhoes = Math.floor(valorInt / 1000000);
        if (milhoes > 0) {
            if (milhoes === 1) {
                extenso += 'um milhão';
            } else {
                extenso += porExtenso(milhoes) + ' milhões';
            }
        }

        // Milhares
        const milhares = Math.floor((valorInt % 1000000) / 1000);
        if (milhares > 0) {
            if (extenso) extenso += ' ';
            if (milhares === 1) {
                extenso += 'mil';
            } else {
                extenso += porExtenso(milhares) + ' mil';
            }
        }

        // Centenas
        const resto = valorInt % 1000;
        if (resto > 0) {
            if (extenso) extenso += ' e ';
            extenso += porExtenso(resto);
        }

        // Adicionar "reais" somente se houver parte inteira
        if (valorInt > 0) {
            if (valorInt === 1) {
                extenso += ' real';
            } else {
                extenso += ' reais';
            }
        }

        // Centavos
        if (centavos > 0) {
            extenso += ' e ' + porExtenso(centavos);
            if (centavos === 1) {
                extenso += ' centavo';
            } else {
                extenso += ' centavos';
            }
        }

        return extenso;
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

    setupFolderModalButtons() {
        console.log('DEBUG: setupFolderModalButtons() chamado');
        
        // Botão Cancelar
        const cancelBtn = document.getElementById('cancel-folder-selection');
        if (cancelBtn) {
            // Remover listeners antigos clonando o elemento
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            newCancelBtn.addEventListener('click', () => {
                console.log('DEBUG: Botão Cancelar clicado (via setupFolderModalButtons)');
                this.closeFolderModal();
            });
            console.log('DEBUG: Event listener do botão Cancelar configurado');
        }
        
        // Botão Confirmar
        const confirmBtn = document.getElementById('confirm-folder-selection');
        if (confirmBtn) {
            // Remover listeners antigos clonando o elemento
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            // Habilitar o botão
            newConfirmBtn.disabled = false;
            newConfirmBtn.addEventListener('click', async () => {
                console.log('DEBUG: Botão Confirmar clicado (via setupFolderModalButtons)');
                await this.confirmFolderSelection();
            });
            console.log('DEBUG: Event listener do botão Confirmar configurado e habilitado');
        }
    }

    closeFolderModal() {
        const modal = document.getElementById('modal-onedrive-folder');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    async downloadPDFToPC() {
        try {
            // Verificar se há preview
            const previewContainer = document.getElementById('pdf-preview-container');
            if (!previewContainer || !previewContainer.innerHTML.includes('HVC IMPERMEABILIZAÇÕES')) {
                alert('Por favor, atualize o preview antes de baixar.');
                return;
            }

            // Gerar PDF blob se não existir
            let pdfBlob = this.currentPDFBlob;
            if (!pdfBlob) {
                pdfBlob = await this.generatePDFBlob();
            }

            // Criar nome do arquivo com mesmo formato do OneDrive
            // Obter número da proposta e substituir '/' por '.' para evitar problemas
            const numero = (this.propostaData.numero_proposta || 'XXXX').replace(/\//g, '.');
            
            // Obter nome da obra do campo do formulário ou das observações
            const nomeObraInput = document.getElementById('pdf-nome-obra');
            let nomeObra = nomeObraInput?.value || this.propostaData?.observacoes || '';
            
            // Limpar caracteres inválidos para nome de arquivo
            nomeObra = nomeObra.replace(/[\\/:*?"<>|]/g, '-').trim();
            
            // Limitar tamanho do nome da obra
            if (nomeObra.length > 50) {
                nomeObra = nomeObra.substring(0, 50).trim();
            }
            
            // Formato: "Proposta nº X.XXXX - Nome da Obra.pdf"
            let fileName;
            if (nomeObra) {
                fileName = `Proposta nº ${numero} - ${nomeObra}.pdf`;
            } else {
                fileName = `Proposta nº ${numero}.pdf`;
            }

            // Criar link temporário para download
            const url = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Liberar URL
            setTimeout(() => URL.revokeObjectURL(url), 100);

            console.log('✅ PDF baixado:', fileName);
            alert('✅ PDF baixado com sucesso!');

        } catch (error) {
            console.error('❌ Erro ao baixar PDF:', error);
            alert('Erro ao baixar PDF: ' + error.message);
        }
    }

    async confirmFolderSelection() {
        console.log('DEBUG: confirmFolderSelection() chamado');
        console.log('DEBUG: currentFolderId:', this.currentFolderId);
        console.log('DEBUG: folderPath:', this.folderPath);
        console.log('DEBUG: currentPDFBlob:', this.currentPDFBlob ? 'existe' : 'não existe');
        
        try {
            // Fazer upload do PDF
            await this.uploadPDFToOneDrive();
        } catch (error) {
            console.error('Erro ao confirmar seleção:', error);
            alert('Erro ao salvar PDF: ' + error.message);
        }
    }
}

// Inicializar quando o DOM estiver pronto
let pdfGenerator;
document.addEventListener('DOMContentLoaded', () => {
    pdfGenerator = new PropostaPDFGenerator();
    window.pdfGenerator = pdfGenerator;
    pdfGenerator.initializeEventListeners();
    console.log('PDF Generator inicializado:', window.pdfGenerator);
});


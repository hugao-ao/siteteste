/**
 * OneDrive PDF Saver
 * Módulo para gerar e salvar PDFs no OneDrive
 */

class OneDrivePDFSaver {
    constructor() {
        this.defaultFolder = null;
        this.loadDefaultFolder();
    }

    /**
     * Carrega pasta padrão do localStorage
     */
    loadDefaultFolder() {
        try {
            const stored = localStorage.getItem('onedrive_default_folder');
            if (stored) {
                this.defaultFolder = JSON.parse(stored);
                console.log('✅ Pasta padrão carregada:', this.defaultFolder.name);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar pasta padrão:', error);
        }
    }

    /**
     * Salva pasta padrão no localStorage
     */
    saveDefaultFolder(folder) {
        try {
            this.defaultFolder = folder;
            localStorage.setItem('onedrive_default_folder', JSON.stringify(folder));
            console.log('✅ Pasta padrão salva:', folder.name);
        } catch (error) {
            console.error('❌ Erro ao salvar pasta padrão:', error);
        }
    }

    /**
     * Limpa pasta padrão
     */
    clearDefaultFolder() {
        this.defaultFolder = null;
        localStorage.removeItem('onedrive_default_folder');
        console.log('✅ Pasta padrão limpa');
    }

    /**
     * Obtém pasta padrão
     */
    getDefaultFolder() {
        return this.defaultFolder;
    }

    /**
     * Seleciona pasta de destino
     */
    async selectFolder() {
        return new Promise((resolve) => {
            oneDriveFolderPicker.open((folder) => {
                this.saveDefaultFolder(folder);
                resolve(folder);
            });
        });
    }

    /**
     * Faz upload de arquivo PDF para OneDrive
     */
    async uploadPDF(pdfBlob, fileName, folderId = null) {
        try {
            console.log('⬆️ Fazendo upload de PDF:', fileName);

            // Verificar se está conectado
            if (!oneDriveAuth.isConnected()) {
                throw new Error('Você precisa estar conectado ao OneDrive');
            }

            // Usar pasta padrão se não especificada
            if (!folderId && this.defaultFolder) {
                folderId = this.defaultFolder.id;
            }

            // Obter token
            const accessToken = await oneDriveAuth.getAccessToken();

            // Construir URL da API
            const endpoint = !folderId || folderId === 'root'
                ? `https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}:/content`
                : `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}:/${fileName}:/content`;

            // Fazer upload
            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/pdf'
                },
                body: pdfBlob
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ao fazer upload: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('✅ Upload concluído:', result);

            return {
                success: true,
                file: result,
                webUrl: result.webUrl
            };

        } catch (error) {
            console.error('❌ Erro ao fazer upload de PDF:', error);
            throw error;
        }
    }

    /**
     * Gera PDF de proposta e salva no OneDrive
     */
    async saveProposta(propostaData, askFolder = false) {
        try {
            // Verificar se precisa selecionar pasta
            if (askFolder || !this.defaultFolder) {
                const folder = await this.selectFolder();
                if (!folder) {
                    console.log('❌ Nenhuma pasta selecionada');
                    return null;
                }
            }

            // Gerar PDF
            console.log('📄 Gerando PDF da proposta...');
            const pdfBlob = await this.generatePropostaPDF(propostaData);

            // Nome do arquivo
            const fileName = `Proposta_${propostaData.numero || 'SN'}_${propostaData.cliente || 'Cliente'}.pdf`
                .replace(/[^a-zA-Z0-9_.-]/g, '_');

            // Fazer upload
            const result = await this.uploadPDF(pdfBlob, fileName);

            console.log('✅ Proposta salva no OneDrive!');
            return result;

        } catch (error) {
            console.error('❌ Erro ao salvar proposta:', error);
            throw error;
        }
    }

    /**
     * Gera PDF de medição e salva no OneDrive
     */
    async saveMedicao(medicaoData, askFolder = false) {
        try {
            // Verificar se precisa selecionar pasta
            if (askFolder || !this.defaultFolder) {
                const folder = await this.selectFolder();
                if (!folder) {
                    console.log('❌ Nenhuma pasta selecionada');
                    return null;
                }
            }

            // Gerar PDF
            console.log('📄 Gerando PDF da medição...');
            const pdfBlob = await this.generateMedicaoPDF(medicaoData);

            // Nome do arquivo
            const fileName = `Medicao_${medicaoData.numero || 'SN'}_${medicaoData.obra || 'Obra'}.pdf`
                .replace(/[^a-zA-Z0-9_.-]/g, '_');

            // Fazer upload
            const result = await this.uploadPDF(pdfBlob, fileName);

            console.log('✅ Medição salva no OneDrive!');
            return result;

        } catch (error) {
            console.error('❌ Erro ao salvar medição:', error);
            throw error;
        }
    }

    /**
     * Gera PDF da proposta usando jsPDF
     */
    async generatePropostaPDF(proposta) {
        // Verificar se jsPDF está disponível
        if (typeof jspdf === 'undefined') {
            throw new Error('Biblioteca jsPDF não carregada');
        }

        const { jsPDF } = jspdf;
        const doc = new jsPDF();

        // Configurações
        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = margin;

        // Título
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text('PROPOSTA COMERCIAL', pageWidth / 2, y, { align: 'center' });
        y += 15;

        // Número da proposta
        doc.setFontSize(12);
        doc.text(`Proposta Nº: ${proposta.numero || 'N/A'}`, margin, y);
        y += 10;

        // Data
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Data: ${proposta.data || new Date().toLocaleDateString('pt-BR')}`, margin, y);
        y += 15;

        // Cliente
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('CLIENTE', margin, y);
        y += 8;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Nome: ${proposta.cliente || 'N/A'}`, margin, y);
        y += 6;
        doc.text(`Telefone: ${proposta.telefone || 'N/A'}`, margin, y);
        y += 6;
        doc.text(`Email: ${proposta.email || 'N/A'}`, margin, y);
        y += 15;

        // Serviços
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('SERVIÇOS', margin, y);
        y += 10;

        if (proposta.servicos && proposta.servicos.length > 0) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            
            proposta.servicos.forEach((servico, index) => {
                // Verificar se precisa de nova página
                if (y > 270) {
                    doc.addPage();
                    y = margin;
                }

                doc.text(`${index + 1}. ${servico.nome || servico.descricao || 'Serviço'}`, margin, y);
                y += 6;
                
                if (servico.quantidade) {
                    doc.text(`   Quantidade: ${servico.quantidade}`, margin, y);
                    y += 6;
                }
                
                if (servico.valor) {
                    doc.text(`   Valor: R$ ${parseFloat(servico.valor).toFixed(2)}`, margin, y);
                    y += 6;
                }
                
                y += 3;
            });
        }

        y += 10;

        // Valor total
        if (proposta.valorTotal) {
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text(`VALOR TOTAL: R$ ${parseFloat(proposta.valorTotal).toFixed(2)}`, margin, y);
            y += 15;
        }

        // Observações
        if (proposta.observacoes) {
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('OBSERVAÇÕES', margin, y);
            y += 8;
            
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            const obsLines = doc.splitTextToSize(proposta.observacoes, pageWidth - 2 * margin);
            doc.text(obsLines, margin, y);
        }

        // Converter para Blob
        return doc.output('blob');
    }

    /**
     * Gera PDF da medição usando jsPDF
     */
    async generateMedicaoPDF(medicao) {
        // Verificar se jsPDF está disponível
        if (typeof jspdf === 'undefined') {
            throw new Error('Biblioteca jsPDF não carregada');
        }

        const { jsPDF } = jspdf;
        const doc = new jsPDF();

        // Configurações
        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = margin;

        // Título
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text('MEDIÇÃO DE OBRA', pageWidth / 2, y, { align: 'center' });
        y += 15;

        // Número da medição
        doc.setFontSize(12);
        doc.text(`Medição Nº: ${medicao.numero || 'N/A'}`, margin, y);
        y += 10;

        // Data
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(`Data: ${medicao.data || new Date().toLocaleDateString('pt-BR')}`, margin, y);
        y += 15;

        // Obra
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('OBRA', margin, y);
        y += 8;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Nome: ${medicao.obra || 'N/A'}`, margin, y);
        y += 6;
        doc.text(`Cliente: ${medicao.cliente || 'N/A'}`, margin, y);
        y += 15;

        // Itens medidos
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('ITENS MEDIDOS', margin, y);
        y += 10;

        if (medicao.itens && medicao.itens.length > 0) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            
            medicao.itens.forEach((item, index) => {
                // Verificar se precisa de nova página
                if (y > 270) {
                    doc.addPage();
                    y = margin;
                }

                doc.text(`${index + 1}. ${item.descricao || 'Item'}`, margin, y);
                y += 6;
                
                if (item.quantidade) {
                    doc.text(`   Quantidade: ${item.quantidade}`, margin, y);
                    y += 6;
                }
                
                if (item.valor) {
                    doc.text(`   Valor: R$ ${parseFloat(item.valor).toFixed(2)}`, margin, y);
                    y += 6;
                }
                
                y += 3;
            });
        }

        y += 10;

        // Valor total
        if (medicao.valorTotal) {
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text(`VALOR TOTAL: R$ ${parseFloat(medicao.valorTotal).toFixed(2)}`, margin, y);
            y += 15;
        }

        // Observações
        if (medicao.observacoes) {
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('OBSERVAÇÕES', margin, y);
            y += 8;
            
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            const obsLines = doc.splitTextToSize(medicao.observacoes, pageWidth - 2 * margin);
            doc.text(obsLines, margin, y);
        }

        // Converter para Blob
        return doc.output('blob');
    }

    /**
     * Salva arquivo genérico no OneDrive
     */
    async saveFile(blob, fileName, mimeType = 'application/octet-stream', askFolder = false) {
        try {
            // Verificar se precisa selecionar pasta
            if (askFolder || !this.defaultFolder) {
                const folder = await this.selectFolder();
                if (!folder) {
                    console.log('❌ Nenhuma pasta selecionada');
                    return null;
                }
            }

            // Obter token
            const accessToken = await oneDriveAuth.getAccessToken();

            // Construir URL da API
            const folderId = this.defaultFolder ? this.defaultFolder.id : 'root';
            const endpoint = folderId === 'root'
                ? `https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}:/content`
                : `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}:/${fileName}:/content`;

            // Fazer upload
            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': mimeType
                },
                body: blob
            });

            if (!response.ok) {
                throw new Error(`Erro ao fazer upload: ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ Arquivo salvo no OneDrive:', fileName);

            return {
                success: true,
                file: result,
                webUrl: result.webUrl
            };

        } catch (error) {
            console.error('❌ Erro ao salvar arquivo:', error);
            throw error;
        }
    }
}

// Instância global
const oneDrivePDFSaver = new OneDrivePDFSaver();

// Exportar para uso global
window.oneDrivePDFSaver = oneDrivePDFSaver;

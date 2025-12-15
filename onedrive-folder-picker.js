/**
 * OneDrive Folder Picker
 * Modal para selecionar pasta de destino no OneDrive
 */

class OneDriveFolderPicker {
    constructor() {
        this.currentFolderId = 'root';
        this.currentPath = [];
        this.selectedFolder = null;
        this.callback = null;
        this.modal = null;
        this.initModal();
    }

    /**
     * Cria o modal HTML
     */
    initModal() {
        const modalHTML = `
            <div class="onedrive-picker-overlay" id="oneDrivePickerOverlay" style="display: none;">
                <div class="onedrive-picker-modal">
                    <div class="onedrive-picker-header">
                        <h2>📁 Selecionar Pasta no OneDrive</h2>
                        <button class="onedrive-picker-close" id="oneDrivePickerClose">✕</button>
                    </div>
                    
                    <div class="onedrive-picker-breadcrumb" id="oneDrivePickerBreadcrumb"></div>
                    
                    <div class="onedrive-picker-body">
                        <div class="onedrive-picker-loading" id="oneDrivePickerLoading" style="display: none;">
                            Carregando pastas...
                        </div>
                        
                        <div class="onedrive-picker-folders" id="oneDrivePickerFolders"></div>
                        
                        <div class="onedrive-picker-empty" id="oneDrivePickerEmpty" style="display: none;">
                            <p>📂 Nenhuma pasta neste local</p>
                        </div>
                    </div>
                    
                    <div class="onedrive-picker-footer">
                        <div class="onedrive-picker-selected" id="oneDrivePickerSelected">
                            Pasta selecionada: <strong>Meu OneDrive</strong>
                        </div>
                        <div class="onedrive-picker-buttons">
                            <button class="btn-picker-cancel" id="oneDrivePickerCancel">Cancelar</button>
                            <button class="btn-picker-select" id="oneDrivePickerSelect">Selecionar Esta Pasta</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const styleHTML = `
            <style>
                .onedrive-picker-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.6);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .onedrive-picker-modal {
                    background: white;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 700px;
                    max-height: 80vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                }

                .onedrive-picker-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 25px;
                    border-bottom: 2px solid #e0e0e0;
                }

                .onedrive-picker-header h2 {
                    margin: 0;
                    font-size: 20px;
                    color: #0078d4;
                }

                .onedrive-picker-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                    padding: 0;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                }

                .onedrive-picker-close:hover {
                    background: #f0f0f0;
                    color: #333;
                }

                .onedrive-picker-breadcrumb {
                    padding: 15px 25px;
                    background: #f9f9f9;
                    border-bottom: 1px solid #e0e0e0;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                    font-size: 14px;
                }

                .onedrive-picker-breadcrumb-item {
                    cursor: pointer;
                    color: #0078d4;
                    font-weight: 500;
                }

                .onedrive-picker-breadcrumb-item:hover {
                    text-decoration: underline;
                }

                .onedrive-picker-breadcrumb-separator {
                    color: #999;
                }

                .onedrive-picker-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px 25px;
                    min-height: 300px;
                }

                .onedrive-picker-loading {
                    text-align: center;
                    padding: 40px;
                    color: #666;
                    font-size: 16px;
                }

                .onedrive-picker-folders {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .onedrive-picker-folder-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 15px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: white;
                }

                .onedrive-picker-folder-item:hover {
                    border-color: #0078d4;
                    background: #f0f8ff;
                    transform: translateX(5px);
                }

                .onedrive-picker-folder-icon {
                    font-size: 28px;
                }

                .onedrive-picker-folder-name {
                    flex: 1;
                    font-size: 15px;
                    font-weight: 500;
                    color: #333;
                }

                .onedrive-picker-folder-arrow {
                    font-size: 20px;
                    color: #999;
                }

                .onedrive-picker-empty {
                    text-align: center;
                    padding: 60px 20px;
                    color: #666;
                    font-size: 16px;
                }

                .onedrive-picker-footer {
                    padding: 20px 25px;
                    border-top: 2px solid #e0e0e0;
                    background: #f9f9f9;
                }

                .onedrive-picker-selected {
                    margin-bottom: 15px;
                    font-size: 14px;
                    color: #666;
                }

                .onedrive-picker-selected strong {
                    color: #0078d4;
                }

                .onedrive-picker-buttons {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                }

                .btn-picker-cancel,
                .btn-picker-select {
                    padding: 10px 24px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                }

                .btn-picker-cancel {
                    background: #6c757d;
                    color: white;
                }

                .btn-picker-cancel:hover {
                    background: #5a6268;
                }

                .btn-picker-select {
                    background: #0078d4;
                    color: white;
                }

                .btn-picker-select:hover {
                    background: #005a9e;
                }
            </style>
        `;

        // Adicionar ao DOM
        document.head.insertAdjacentHTML('beforeend', styleHTML);
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Guardar referências
        this.modal = document.getElementById('oneDrivePickerOverlay');
        this.elements = {
            loading: document.getElementById('oneDrivePickerLoading'),
            folders: document.getElementById('oneDrivePickerFolders'),
            empty: document.getElementById('oneDrivePickerEmpty'),
            breadcrumb: document.getElementById('oneDrivePickerBreadcrumb'),
            selected: document.getElementById('oneDrivePickerSelected'),
            btnClose: document.getElementById('oneDrivePickerClose'),
            btnCancel: document.getElementById('oneDrivePickerCancel'),
            btnSelect: document.getElementById('oneDrivePickerSelect')
        };

        // Event listeners
        this.setupEventListeners();
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        // Fechar
        this.elements.btnClose.addEventListener('click', () => this.close());
        this.elements.btnCancel.addEventListener('click', () => this.close());

        // Selecionar
        this.elements.btnSelect.addEventListener('click', () => this.selectCurrentFolder());

        // Fechar ao clicar fora
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
    }

    /**
     * Abre o picker
     */
    async open(callback) {
        this.callback = callback;
        this.currentFolderId = 'root';
        this.currentPath = [];
        this.selectedFolder = null;

        // Verificar se está conectado
        if (!oneDriveAuth.isConnected()) {
            alert('Você precisa estar conectado ao OneDrive primeiro.');
            return;
        }

        this.modal.style.display = 'flex';
        await this.loadFolders('root');
    }

    /**
     * Fecha o picker
     */
    close() {
        this.modal.style.display = 'none';
        this.callback = null;
    }

    /**
     * Carrega pastas
     */
    async loadFolders(folderId) {
        try {
            this.showLoading(true);
            this.elements.folders.innerHTML = '';
            this.elements.empty.style.display = 'none';

            console.log('📂 Carregando pastas:', folderId);

            // Obter token
            const accessToken = await oneDriveAuth.getAccessToken();

            // Construir URL da API
            const endpoint = folderId === 'root'
                ? 'https://graph.microsoft.com/v1.0/me/drive/root/children'
                : `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`;

            // Fazer requisição
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Erro ao carregar pastas: ${response.status}`);
            }

            const data = await response.json();
            
            // Filtrar apenas pastas
            const folders = (data.value || []).filter(item => item.folder);

            console.log('✅ Pastas carregadas:', folders.length);

            this.currentFolderId = folderId;
            this.renderFolders(folders);
            this.updateBreadcrumb();
            this.updateSelectedDisplay();

        } catch (error) {
            console.error('❌ Erro ao carregar pastas:', error);
            alert('Erro ao carregar pastas: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Renderiza lista de pastas
     */
    renderFolders(folders) {
        if (folders.length === 0) {
            this.elements.empty.style.display = 'block';
            return;
        }

        folders.forEach(folder => {
            const div = document.createElement('div');
            div.className = 'onedrive-picker-folder-item';
            div.innerHTML = `
                <span class="onedrive-picker-folder-icon">📁</span>
                <span class="onedrive-picker-folder-name">${folder.name}</span>
                <span class="onedrive-picker-folder-arrow">›</span>
            `;

            div.addEventListener('click', () => this.openFolder(folder));

            this.elements.folders.appendChild(div);
        });
    }

    /**
     * Abre uma pasta
     */
    async openFolder(folder) {
        this.currentPath.push({
            id: folder.id,
            name: folder.name
        });

        await this.loadFolders(folder.id);
    }

    /**
     * Navega para uma pasta no breadcrumb
     */
    async navigateToPath(index) {
        if (index === -1) {
            // Voltar para raiz
            this.currentPath = [];
            await this.loadFolders('root');
        } else {
            // Voltar para pasta específica
            const targetPath = this.currentPath[index];
            this.currentPath = this.currentPath.slice(0, index + 1);
            await this.loadFolders(targetPath.id);
        }
    }

    /**
     * Atualiza breadcrumb
     */
    updateBreadcrumb() {
        this.elements.breadcrumb.innerHTML = '';

        // Raiz
        const rootItem = document.createElement('span');
        rootItem.className = 'onedrive-picker-breadcrumb-item';
        rootItem.textContent = '🏠 Meu OneDrive';
        rootItem.onclick = () => this.navigateToPath(-1);
        this.elements.breadcrumb.appendChild(rootItem);

        // Caminho
        this.currentPath.forEach((folder, index) => {
            const separator = document.createElement('span');
            separator.className = 'onedrive-picker-breadcrumb-separator';
            separator.textContent = '›';
            this.elements.breadcrumb.appendChild(separator);

            const item = document.createElement('span');
            item.className = 'onedrive-picker-breadcrumb-item';
            item.textContent = folder.name;
            item.onclick = () => this.navigateToPath(index);
            this.elements.breadcrumb.appendChild(item);
        });
    }

    /**
     * Atualiza display da pasta selecionada
     */
    updateSelectedDisplay() {
        const folderName = this.currentPath.length > 0
            ? this.currentPath[this.currentPath.length - 1].name
            : 'Meu OneDrive';

        this.elements.selected.innerHTML = `
            Pasta selecionada: <strong>${folderName}</strong>
        `;
    }

    /**
     * Seleciona a pasta atual
     */
    selectCurrentFolder() {
        const folderInfo = {
            id: this.currentFolderId,
            name: this.currentPath.length > 0
                ? this.currentPath[this.currentPath.length - 1].name
                : 'Meu OneDrive',
            path: this.currentPath
        };

        console.log('✅ Pasta selecionada:', folderInfo);

        if (this.callback) {
            this.callback(folderInfo);
        }

        this.close();
    }

    /**
     * Mostra/oculta loading
     */
    showLoading(show) {
        this.elements.loading.style.display = show ? 'block' : 'none';
        this.elements.folders.style.display = show ? 'none' : 'flex';
    }
}

// Instância global
const oneDriveFolderPicker = new OneDriveFolderPicker();

// Exportar para uso global
window.oneDriveFolderPicker = oneDriveFolderPicker;

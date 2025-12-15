/**
 * OneDrive Browser - Navegador de Arquivos
 * Interface para navegar, criar pastas, fazer upload e gerenciar arquivos
 */

// Estado da aplicação
let currentFolderId = 'root';
let currentPath = [];
let selectedItems = [];
let viewMode = 'grid'; // 'grid' ou 'list'
let allFiles = [];

// Elementos DOM
let elementsLoaded = false;
let elements = {};

/**
 * Inicializa elementos DOM
 */
function initElements() {
    if (elementsLoaded) return;
    
    elements = {
        accountEmail: document.getElementById('accountEmail'),
        btnConnect: document.getElementById('btnConnect'),
        btnDisconnect: document.getElementById('btnDisconnect'),
        errorMessage: document.getElementById('errorMessage'),
        breadcrumb: document.getElementById('breadcrumb'),
        btnNewFolder: document.getElementById('btnNewFolder'),
        btnUpload: document.getElementById('btnUpload'),
        btnDownload: document.getElementById('btnDownload'),
        btnDelete: document.getElementById('btnDelete'),
        btnRefresh: document.getElementById('btnRefresh'),
        btnViewGrid: document.getElementById('btnViewGrid'),
        btnViewList: document.getElementById('btnViewList'),
        loading: document.getElementById('loading'),
        filesGrid: document.getElementById('filesGrid'),
        filesTable: document.getElementById('filesTable'),
        filesTableBody: document.getElementById('filesTableBody'),
        emptyState: document.getElementById('emptyState'),
        modalNewFolder: document.getElementById('modalNewFolder'),
        inputFolderName: document.getElementById('inputFolderName'),
        btnCancelFolder: document.getElementById('btnCancelFolder'),
        btnCreateFolder: document.getElementById('btnCreateFolder')
    };
    
    elementsLoaded = true;
}

/**
 * Inicializa a página
 */
async function initPage() {
    console.log('🔄 Inicializando OneDrive Browser...');
    
    initElements();
    setupEventListeners();
    
    // Verificar se está conectado
    if (!oneDriveAuth.isConnected()) {
        // Mostrar botão de conectar
        elements.btnConnect.style.display = 'inline-block';
        elements.btnDisconnect.style.display = 'none';
        showError('Você precisa estar conectado ao OneDrive. Clique em "Conectar OneDrive" acima.');
        return;
    }
    
    // Ocultar botão de conectar e mostrar desconectar
    elements.btnConnect.style.display = 'none';
    elements.btnDisconnect.style.display = 'inline-block';
    
    // Atualizar informações da conta
    updateAccountInfo();
    
    // Carregar arquivos da raiz
    await loadFiles('root');
}

/**
 * Configura event listeners
 */
function setupEventListeners() {
    // Conectar
    elements.btnConnect.addEventListener('click', async () => {
        try {
            await connectOneDriveAccount();
            // Recarregar a página após conectar
            window.location.reload();
        } catch (error) {
            showError('Erro ao conectar: ' + error.message);
        }
    });
    
    // Desconectar
    elements.btnDisconnect.addEventListener('click', async () => {
        if (confirm('Deseja realmente desconectar sua conta OneDrive?')) {
            const account = oneDriveAuth.getCurrentAccount();
            if (account) {
                await disconnectOneDriveAccount(account.email);
                window.location.href = 'index.html';
            }
        }
    });
    
    // Nova pasta
    elements.btnNewFolder.addEventListener('click', () => {
        elements.inputFolderName.value = '';
        elements.modalNewFolder.classList.add('active');
        elements.inputFolderName.focus();
    });
    
    // Cancelar nova pasta
    elements.btnCancelFolder.addEventListener('click', () => {
        elements.modalNewFolder.classList.remove('active');
    });
    
    // Criar pasta
    elements.btnCreateFolder.addEventListener('click', async () => {
        const folderName = elements.inputFolderName.value.trim();
        if (!folderName) {
            alert('Digite um nome para a pasta');
            return;
        }
        
        await createFolder(folderName);
        elements.modalNewFolder.classList.remove('active');
    });
    
    // Enter para criar pasta
    elements.inputFolderName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            elements.btnCreateFolder.click();
        }
    });
    
    // Upload
    elements.btnUpload.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            await uploadFiles(files);
        };
        input.click();
    });
    
    // Baixar
    elements.btnDownload.addEventListener('click', async () => {
        if (selectedItems.length === 0) return;
        
        for (const item of selectedItems) {
            if (!item.folder) {
                await downloadFile(item);
            }
        }
    });
    
    // Excluir
    elements.btnDelete.addEventListener('click', async () => {
        if (selectedItems.length === 0) return;
        
        const confirmMsg = selectedItems.length === 1
            ? `Deseja realmente excluir "${selectedItems[0].name}"?`
            : `Deseja realmente excluir ${selectedItems.length} itens?`;
        
        if (confirm(confirmMsg)) {
            await deleteItems(selectedItems);
        }
    });
    
    // Atualizar
    elements.btnRefresh.addEventListener('click', () => {
        loadFiles(currentFolderId);
    });
    
    // Alternar visualização
    elements.btnViewGrid.addEventListener('click', () => {
        setViewMode('grid');
    });
    
    elements.btnViewList.addEventListener('click', () => {
        setViewMode('list');
    });
    
    // Eventos de autenticação
    window.addEventListener('oneDriveAccountConnected', () => {
        updateAccountInfo();
        loadFiles('root');
    });
    
    window.addEventListener('oneDriveAccountDisconnected', () => {
        window.location.href = 'index.html';
    });
}

/**
 * Atualiza informações da conta
 */
function updateAccountInfo() {
    const account = oneDriveAuth.getCurrentAccount();
    if (account) {
        elements.accountEmail.textContent = account.email;
        elements.btnDisconnect.style.display = 'block';
    } else {
        elements.accountEmail.textContent = 'Não conectado';
        elements.btnDisconnect.style.display = 'none';
    }
}

/**
 * Carrega arquivos de uma pasta
 */
async function loadFiles(folderId) {
    try {
        showLoading(true);
        hideError();
        
        console.log('📂 Carregando pasta:', folderId);
        
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
            throw new Error(`Erro ao carregar arquivos: ${response.status}`);
        }
        
        const data = await response.json();
        allFiles = data.value || [];
        
        console.log('✅ Arquivos carregados:', allFiles.length);
        
        // Atualizar UI
        currentFolderId = folderId;
        selectedItems = [];
        updateToolbar();
        renderFiles();
        
    } catch (error) {
        console.error('❌ Erro ao carregar arquivos:', error);
        showError('Erro ao carregar arquivos: ' + error.message);
    } finally {
        showLoading(false);
    }
}

/**
 * Renderiza arquivos na tela
 */
function renderFiles() {
    if (allFiles.length === 0) {
        elements.filesGrid.style.display = 'none';
        elements.filesTable.style.display = 'none';
        elements.emptyState.style.display = 'block';
        return;
    }
    
    elements.emptyState.style.display = 'none';
    
    if (viewMode === 'grid') {
        renderGridView();
    } else {
        renderListView();
    }
    
    updateBreadcrumb();
}

/**
 * Renderiza visualização em grade
 */
function renderGridView() {
    elements.filesGrid.style.display = 'grid';
    elements.filesTable.style.display = 'none';
    elements.filesGrid.innerHTML = '';
    
    allFiles.forEach(file => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.dataset.id = file.id;
        
        const icon = file.folder ? '📁' : getFileIcon(file.name);
        const size = file.folder ? '' : formatFileSize(file.size);
        
        div.innerHTML = `
            <div class="file-icon">${icon}</div>
            <div class="file-name">${file.name}</div>
            ${size ? `<div class="file-size">${size}</div>` : ''}
        `;
        
        // Click para abrir pasta ou selecionar arquivo
        div.addEventListener('click', (e) => {
            if (file.folder) {
                openFolder(file);
            } else {
                toggleSelection(file, div);
            }
        });
        
        // Double click para baixar arquivo
        div.addEventListener('dblclick', (e) => {
            if (!file.folder) {
                downloadFile(file);
            }
        });
        
        elements.filesGrid.appendChild(div);
    });
}

/**
 * Renderiza visualização em lista
 */
function renderListView() {
    elements.filesGrid.style.display = 'none';
    elements.filesTable.style.display = 'block';
    elements.filesTableBody.innerHTML = '';
    
    allFiles.forEach(file => {
        const tr = document.createElement('tr');
        tr.dataset.id = file.id;
        
        const icon = file.folder ? '📁' : getFileIcon(file.name);
        const size = file.folder ? '-' : formatFileSize(file.size);
        const modified = new Date(file.lastModifiedDateTime).toLocaleString('pt-BR');
        
        tr.innerHTML = `
            <td>
                <div class="table-file-name">
                    <span class="table-file-icon">${icon}</span>
                    <span>${file.name}</span>
                </div>
            </td>
            <td>${size}</td>
            <td>${modified}</td>
        `;
        
        // Click para abrir pasta ou selecionar arquivo
        tr.addEventListener('click', () => {
            if (file.folder) {
                openFolder(file);
            } else {
                toggleSelection(file, tr);
            }
        });
        
        // Double click para baixar arquivo
        tr.addEventListener('dblclick', () => {
            if (!file.folder) {
                downloadFile(file);
            }
        });
        
        elements.filesTableBody.appendChild(tr);
    });
}

/**
 * Abre uma pasta
 */
async function openFolder(folder) {
    currentPath.push({
        id: folder.id,
        name: folder.name
    });
    
    await loadFiles(folder.id);
}

/**
 * Navega para uma pasta no breadcrumb
 */
async function navigateToPath(index) {
    if (index === -1) {
        // Voltar para raiz
        currentPath = [];
        await loadFiles('root');
    } else {
        // Voltar para pasta específica
        const targetPath = currentPath[index];
        currentPath = currentPath.slice(0, index + 1);
        await loadFiles(targetPath.id);
    }
}

/**
 * Atualiza breadcrumb
 */
function updateBreadcrumb() {
    elements.breadcrumb.innerHTML = '';
    
    // Raiz
    const rootItem = document.createElement('span');
    rootItem.className = 'breadcrumb-item';
    rootItem.textContent = '🏠 Meu OneDrive';
    rootItem.onclick = () => navigateToPath(-1);
    elements.breadcrumb.appendChild(rootItem);
    
    // Caminho
    currentPath.forEach((folder, index) => {
        const separator = document.createElement('span');
        separator.className = 'breadcrumb-separator';
        separator.textContent = '›';
        elements.breadcrumb.appendChild(separator);
        
        const item = document.createElement('span');
        item.className = 'breadcrumb-item';
        item.textContent = folder.name;
        item.onclick = () => navigateToPath(index);
        elements.breadcrumb.appendChild(item);
    });
}

/**
 * Alterna seleção de item
 */
function toggleSelection(file, element) {
    const index = selectedItems.findIndex(item => item.id === file.id);
    
    if (index >= 0) {
        // Desselecionar
        selectedItems.splice(index, 1);
        element.classList.remove('selected');
    } else {
        // Selecionar
        selectedItems.push(file);
        element.classList.add('selected');
    }
    
    updateToolbar();
}

/**
 * Atualiza estado da toolbar
 */
function updateToolbar() {
    const hasSelection = selectedItems.length > 0;
    const hasFiles = selectedItems.some(item => !item.folder);
    
    elements.btnDownload.disabled = !hasFiles;
    elements.btnDelete.disabled = !hasSelection;
}

/**
 * Cria uma nova pasta
 */
async function createFolder(folderName) {
    try {
        showLoading(true);
        
        const accessToken = await oneDriveAuth.getAccessToken();
        
        const endpoint = currentFolderId === 'root'
            ? 'https://graph.microsoft.com/v1.0/me/drive/root/children'
            : `https://graph.microsoft.com/v1.0/me/drive/items/${currentFolderId}/children`;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: folderName,
                folder: {},
                '@microsoft.graph.conflictBehavior': 'rename'
            })
        });
        
        if (!response.ok) {
            throw new Error(`Erro ao criar pasta: ${response.status}`);
        }
        
        console.log('✅ Pasta criada:', folderName);
        
        // Recarregar arquivos
        await loadFiles(currentFolderId);
        
    } catch (error) {
        console.error('❌ Erro ao criar pasta:', error);
        showError('Erro ao criar pasta: ' + error.message);
    } finally {
        showLoading(false);
    }
}

/**
 * Faz upload de arquivos
 */
async function uploadFiles(files) {
    try {
        showLoading(true);
        
        const accessToken = await oneDriveAuth.getAccessToken();
        
        for (const file of files) {
            console.log('⬆️ Fazendo upload:', file.name);
            
            const endpoint = currentFolderId === 'root'
                ? `https://graph.microsoft.com/v1.0/me/drive/root:/${file.name}:/content`
                : `https://graph.microsoft.com/v1.0/me/drive/items/${currentFolderId}:/${file.name}:/content`;
            
            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': file.type || 'application/octet-stream'
                },
                body: file
            });
            
            if (!response.ok) {
                throw new Error(`Erro ao fazer upload de ${file.name}: ${response.status}`);
            }
            
            console.log('✅ Upload concluído:', file.name);
        }
        
        // Recarregar arquivos
        await loadFiles(currentFolderId);
        
    } catch (error) {
        console.error('❌ Erro ao fazer upload:', error);
        showError('Erro ao fazer upload: ' + error.message);
    } finally {
        showLoading(false);
    }
}

/**
 * Baixa um arquivo
 */
async function downloadFile(file) {
    try {
        console.log('⬇️ Baixando arquivo:', file.name);
        
        const accessToken = await oneDriveAuth.getAccessToken();
        
        const response = await fetch(
            `https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/content`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`Erro ao baixar arquivo: ${response.status}`);
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('✅ Download concluído:', file.name);
        
    } catch (error) {
        console.error('❌ Erro ao baixar arquivo:', error);
        showError('Erro ao baixar arquivo: ' + error.message);
    }
}

/**
 * Exclui itens
 */
async function deleteItems(items) {
    try {
        showLoading(true);
        
        const accessToken = await oneDriveAuth.getAccessToken();
        
        for (const item of items) {
            console.log('🗑️ Excluindo:', item.name);
            
            const response = await fetch(
                `https://graph.microsoft.com/v1.0/me/drive/items/${item.id}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error(`Erro ao excluir ${item.name}: ${response.status}`);
            }
            
            console.log('✅ Excluído:', item.name);
        }
        
        // Recarregar arquivos
        selectedItems = [];
        await loadFiles(currentFolderId);
        
    } catch (error) {
        console.error('❌ Erro ao excluir itens:', error);
        showError('Erro ao excluir itens: ' + error.message);
    } finally {
        showLoading(false);
    }
}

/**
 * Alterna modo de visualização
 */
function setViewMode(mode) {
    viewMode = mode;
    
    if (mode === 'grid') {
        elements.btnViewGrid.classList.add('active');
        elements.btnViewList.classList.remove('active');
    } else {
        elements.btnViewGrid.classList.remove('active');
        elements.btnViewList.classList.add('active');
    }
    
    renderFiles();
}

/**
 * Obtém ícone para tipo de arquivo
 */
function getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    
    const icons = {
        // Documentos
        'pdf': '📄',
        'doc': '📝',
        'docx': '📝',
        'txt': '📝',
        'rtf': '📝',
        
        // Planilhas
        'xls': '📊',
        'xlsx': '📊',
        'csv': '📊',
        
        // Apresentações
        'ppt': '📽️',
        'pptx': '📽️',
        
        // Imagens
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'png': '🖼️',
        'gif': '🖼️',
        'bmp': '🖼️',
        'svg': '🖼️',
        
        // Vídeos
        'mp4': '🎥',
        'avi': '🎥',
        'mov': '🎥',
        'wmv': '🎥',
        
        // Áudio
        'mp3': '🎵',
        'wav': '🎵',
        'flac': '🎵',
        
        // Compactados
        'zip': '📦',
        'rar': '📦',
        '7z': '📦',
        
        // Código
        'html': '💻',
        'css': '💻',
        'js': '💻',
        'py': '💻',
        'java': '💻'
    };
    
    return icons[ext] || '📄';
}

/**
 * Formata tamanho de arquivo
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Mostra/oculta loading
 */
function showLoading(show) {
    elements.loading.style.display = show ? 'block' : 'none';
}

/**
 * Mostra mensagem de erro
 */
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.display = 'block';
}

/**
 * Oculta mensagem de erro
 */
function hideError() {
    elements.errorMessage.style.display = 'none';
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else {
    initPage();
}

// Exportar funções para uso externo
window.oneDriveBrowser = {
    loadFiles,
    getCurrentFolder: () => currentFolderId,
    getCurrentPath: () => currentPath,
    getSelectedItems: () => selectedItems
};

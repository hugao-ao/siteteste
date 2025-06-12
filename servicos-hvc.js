import { supabase } from './supabase.js';

class ServicesManager {
  constructor() {
    this.services = [];
    this.editingId = null;
    this.deletingId = null;
    this.init();
  }

  async init() {
    this.bindEvents();
    await this.loadServices();
    this.renderServices();
    this.updateEmptyState();
  }

  bindEvents() {
    document.getElementById('service-form').addEventListener('submit', (e) => this.handleSubmit(e));
    document.getElementById('cancel-btn').addEventListener('click', () => this.cancelEdit());
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e));
    }
    const confirmDelete = document.getElementById('confirm-delete');
    if (confirmDelete) {
      confirmDelete.addEventListener('click', () => this.confirmDelete());
    }
    const cancelDelete = document.getElementById('cancel-delete');
    if (cancelDelete) {
      cancelDelete.addEventListener('click', () => this.closeDeleteModal());
    }
    const deleteModal = document.getElementById('delete-modal');
    if (deleteModal) {
      deleteModal.addEventListener('click', (e) => {
        if (e.target.id === 'delete-modal') this.closeDeleteModal();
      });
    }
  }

  async loadServices() {
    const { data, error } = await supabase.from('servicos_hvc').select('*').order('created_at');
    if (error) {
      console.error('Erro ao carregar serviços:', error);
    } else {
      this.services = data;
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    if (!this.validateForm()) return;

    const code = document.getElementById('service-code').value.trim();
    const description = document.getElementById('service-description').value.trim();
    const detail = document.getElementById('service-detail').value.trim();
    const unit = document.getElementById('service-unit').value;

    const service = {
      code,
      description,
      detail,
      unit,
      updated_at: new Date().toISOString()
    };

    if (this.editingId) {
      const { error } = await supabase
        .from('servicos_hvc')
        .update(service)
        .eq('id', this.editingId);
      if (!error) this.showSuccess('Serviço atualizado com sucesso!');
    } else {
      service.created_at = new Date().toISOString();
      const { error } = await supabase.from('servicos_hvc').insert([service]);
      if (!error) this.showSuccess('Serviço adicionado com sucesso!');
    }

    await this.loadServices();
    this.renderServices();
    this.updateEmptyState();
    this.resetForm();
  }

  async confirmDelete() {
    if (!this.deletingId) return;
    const { error } = await supabase.from('servicos_hvc').delete().eq('id', this.deletingId);
    if (!error) {
      this.showSuccess('Serviço excluído com sucesso!');
      await this.loadServices();
      this.renderServices();
      this.updateEmptyState();
      this.closeDeleteModal();
    }
  }

  editService(id) {
    const service = this.services.find(s => s.id === id);
    if (!service) return;
    this.editingId = id;
    document.getElementById('service-code').value = service.code;
    document.getElementById('service-description').value = service.description;
    document.getElementById('service-detail').value = service.detail || '';
    document.getElementById('service-unit').value = service.unit || '';
    const formTitle = document.getElementById('form-title');
    const submitBtn = document.getElementById('submit-btn');
    if (formTitle) formTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Serviço';
    if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar Serviço';
    document.getElementById('cancel-btn').style.display = 'inline-flex';
  }

  deleteService(id) {
    const service = this.services.find(s => s.id === id);
    if (!service) return;
    const deleteName = document.getElementById('delete-service-name');
    if (deleteName) deleteName.textContent = service.description;
    const modal = document.getElementById('delete-modal');
    if (modal) modal.style.display = 'block';
    this.deletingId = id;
  }

  closeDeleteModal() {
    const modal = document.getElementById('delete-modal');
    if (modal) modal.style.display = 'none';
    this.deletingId = null;
  }

  cancelEdit() {
    this.resetForm();
  }

  resetForm() {
    this.editingId = null;
    document.getElementById('service-form').reset();
    const formTitle = document.getElementById('form-title');
    const submitBtn = document.getElementById('submit-btn');
    if (formTitle) formTitle.innerHTML = '<i class="fas fa-plus"></i> Adicionar Novo Serviço';
    if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Serviço';
    document.getElementById('cancel-btn').style.display = 'none';
    document.querySelectorAll('.error-message').forEach(el => el.style.display = 'none');
  }

  validateForm() {
    let valid = true;
    const code = document.getElementById('service-code').value.trim();
    const description = document.getElementById('service-description').value.trim();

    const codeError = document.getElementById('code-error');
    const descError = document.getElementById('description-error');

    if (!code) {
      if (codeError) {
        codeError.style.display = 'block';
        codeError.textContent = 'Código é obrigatório';
      }
      valid = false;
    } else if (codeError) {
      codeError.style.display = 'none';
    }

    if (!description) {
      if (descError) {
        descError.style.display = 'block';
        descError.textContent = 'Descrição é obrigatória';
      }
      valid = false;
    } else if (descError) {
      descError.style.display = 'none';
    }

    return valid;
  }

  handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = this.services.filter(service =>
      service.code.toLowerCase().includes(searchTerm) ||
      service.description.toLowerCase().includes(searchTerm) ||
      (service.detail && service.detail.toLowerCase().includes(searchTerm))
    );
    this.renderServices(filtered);
  }

  renderServices(servicesToRender = null) {
    const services = servicesToRender || this.services;
    const tbody = document.getElementById('services-table-body');
    if (!tbody) return;

    tbody.innerHTML = services.map(service => `
      <tr>
        <td><strong>${this.escape(service.code)}</strong></td>
        <td>${this.escape(service.description)}</td>
        <td>${service.detail ? this.escape(service.detail) : '<em>-</em>'}</td>
        <td>${service.unit ? `<span class="unit-badge">${this.escape(service.unit)}</span>` : '<em>-</em>'}</td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-edit btn-small" onclick="servicesManager.editService('${service.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-small" onclick="servicesManager.deleteService('${service.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  updateEmptyState() {
    const emptyState = document.getElementById('empty-state');
    const tableContainer = document.querySelector('.table-container');
    if (!emptyState || !tableContainer) return;
    if (this.services.length === 0) {
      emptyState.style.display = 'block';
      tableContainer.style.display = 'none';
    } else {
      emptyState.style.display = 'none';
      tableContainer.style.display = 'block';
    }
  }

  showSuccess(message) {
    const msg = document.getElementById('success-message');
    const text = document.getElementById('success-text');
    if (!msg || !text) return;
    text.textContent = message;
    msg.style.display = 'block';
    setTimeout(() => msg.style.display = 'none', 3000);
  }

  escape(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

window.servicesManager = new ServicesManager();

// =====================================================
// LOGÍSTICA HVC - Módulo de Planejamento de Obras e Rotas
// =====================================================

import { supabase } from './supabase.js';

// ===== VARIÁVEIS GLOBAIS =====
let map = null;
let markers = [];
let directionsService = null;
let directionsRenderers = [];
let geocoder = null;
let locais = [];
let cadeias = [];
let servicos = [];
let alocacoes = [];
let pausas = [];
let integrantes = [];
let currentView = 'dia';
let currentDate = new Date();
let simulatedDate = null;
let selectedLocalId = null;
let mapFilter = 'all';
let selectedFuncionarioFilter = null;
let tempServicos = []; // Serviços temporários no modal de cadeia

// ===== INICIALIZAÇÃO DO MAPA =====
function initMapInternal() {
    const mapOptions = {
        center: { lat: -22.9068, lng: -43.1729 }, // Rio de Janeiro default
        zoom: 12,
        styles: [
            { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
            { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
            { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] }
        ],
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true
    };

    map = new google.maps.Map(document.getElementById('map'), mapOptions);
    directionsService = new google.maps.DirectionsService();
    geocoder = new google.maps.Geocoder();

    // Clique no mapa para pegar coordenadas
    map.addListener('click', function(event) {
        const modalLocal = document.getElementById('modal-local');
        if (modalLocal.classList.contains('active')) {
            document.getElementById('local-lat').value = event.latLng.lat().toFixed(6);
            document.getElementById('local-lng').value = event.latLng.lng().toFixed(6);
            showToast('Coordenadas capturadas do mapa!', 'success');
        }
    });

    // Carregar dados
    loadAllData();
}

// Expor para uso global
window.initMap = initMapInternal;

// ===== CARREGAMENTO DE DADOS =====
async function loadAllData() {
    try {
        await Promise.all([
            loadLocais(),
            loadIntegrantes(),
            loadCadeias(),
            loadServicos(),
            loadAlocacoes(),
            loadPausas()
        ]);
        renderLocaisList();
        renderEquipeList();
        updateMapMarkers();
        updateCronograma();
        populateCadeiaLocalSelect();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showToast('Erro ao carregar dados. Verifique a conexão.', 'error');
    }
}

async function loadLocais() {
    const { data, error } = await supabase
        .from('logistica_locais')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    locais = data || [];
}

async function loadIntegrantes() {
    const { data, error } = await supabase
        .from('integrantes_hvc')
        .select('*')
        .eq('ativo', true)
        .order('nome');
    if (error) throw error;
    integrantes = data || [];
}

async function loadCadeias() {
    const { data, error } = await supabase
        .from('logistica_cadeias')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    cadeias = data || [];
}

async function loadServicos() {
    const { data, error } = await supabase
        .from('logistica_servicos')
        .select('*')
        .order('ordem');
    if (error) throw error;
    servicos = data || [];
}

async function loadAlocacoes() {
    const { data, error } = await supabase
        .from('logistica_alocacoes')
        .select('*');
    if (error) throw error;
    alocacoes = data || [];
}

async function loadPausas() {
    const { data, error } = await supabase
        .from('logistica_pausas')
        .select('*')
        .order('data_pausa', { ascending: false });
    if (error) throw error;
    pausas = data || [];
}

// ===== MAPA - MARCADORES =====
function updateMapMarkers() {
    // Limpar marcadores existentes
    markers.forEach(m => m.setMap(null));
    markers = [];
    // Limpar rotas
    directionsRenderers.forEach(r => r.setMap(null));
    directionsRenderers = [];

    const filteredLocais = locais.filter(l => {
        if (mapFilter === 'all') return true;
        if (mapFilter === 'obras') return l.tipo === 'obra';
        if (mapFilter === 'visitas') return l.tipo === 'visita';
        return true;
    });

    filteredLocais.forEach(local => {
        if (local.latitude && local.longitude) {
            const icon = getMarkerIcon(local);
            const marker = new google.maps.Marker({
                position: { lat: local.latitude, lng: local.longitude },
                map: map,
                title: local.nome,
                icon: icon
            });

            const infoWindow = new google.maps.InfoWindow({
                content: createInfoWindowContent(local)
            });

            marker.addListener('click', () => {
                infoWindow.open(map, marker);
            });

            markers.push(marker);
        }
    });

    // Se filtro é equipe ou rotas, mostrar posições da equipe e rotas
    if (mapFilter === 'equipe' || mapFilter === 'rotas' || mapFilter === 'all') {
        showEquipeOnMap();
    }

    // Ajustar bounds
    if (markers.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        markers.forEach(m => bounds.extend(m.getPosition()));
        map.fitBounds(bounds);
        if (markers.length === 1) map.setZoom(15);
    }
}

function getMarkerIcon(local) {
    let color;
    if (local.tipo === 'obra') {
        switch (local.status) {
            case 'a_iniciar': color = '#ffc107'; break;
            case 'em_andamento': color = '#2196f3'; break;
            case 'finalizada': color = '#4caf50'; break;
            default: color = '#9e9e9e';
        }
    } else {
        switch (local.status) {
            case 'pendente': color = '#ff9800'; break;
            case 'concluida': color = '#4caf50'; break;
            default: color = '#9e9e9e';
        }
    }

    return {
        path: local.tipo === 'obra' 
            ? google.maps.SymbolPath.BACKWARD_CLOSED_ARROW 
            : google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 0.9,
        strokeColor: '#fff',
        strokeWeight: 2,
        scale: local.tipo === 'obra' ? 8 : 10
    };
}

function createInfoWindowContent(local) {
    const statusLabel = getStatusLabel(local);
    const cadeiasList = cadeias.filter(c => c.local_id === local.id);
    let servicosInfo = '';
    if (cadeiasList.length > 0) {
        servicosInfo = `<br><small><b>Cadeias:</b> ${cadeiasList.length}</small>`;
    }
    return `
        <div style="color:#333;max-width:250px;">
            <b>${local.nome}</b><br>
            <small>${local.endereco || 'Sem endereço'}</small><br>
            <span style="background:${getStatusColor(local)};color:white;padding:2px 6px;border-radius:10px;font-size:11px;">${statusLabel}</span>
            ${local.cliente_nome ? `<br><small><b>Cliente:</b> ${local.cliente_nome}</small>` : ''}
            ${servicosInfo}
            <br><a href="#" onclick="openLocalDetalhes('${local.id}');return false;" style="font-size:11px;">Ver detalhes</a>
        </div>
    `;
}

function getStatusLabel(local) {
    const labels = {
        'a_iniciar': 'À Iniciar',
        'em_andamento': 'Em Andamento',
        'finalizada': 'Finalizada',
        'pendente': 'Pendente',
        'concluida': 'Concluída'
    };
    return labels[local.status] || local.status;
}

function getStatusColor(local) {
    const colors = {
        'a_iniciar': '#ffc107',
        'em_andamento': '#2196f3',
        'finalizada': '#4caf50',
        'pendente': '#ff9800',
        'concluida': '#4caf50'
    };
    return colors[local.status] || '#9e9e9e';
}

// ===== MAPA - EQUIPE E ROTAS =====
function showEquipeOnMap() {
    const refDate = getEffectiveDate();
    const dayStart = new Date(refDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(refDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Encontrar serviços ativos no dia
    const servicosDoDia = servicos.filter(s => {
        const inicio = new Date(s.data_inicio);
        const fim = new Date(s.data_fim_real || s.data_fim_prevista);
        return inicio <= dayEnd && fim >= dayStart && s.status !== 'cancelado';
    });

    // Para cada integrante, ver onde está alocado
    const integranteServicos = {};
    alocacoes.forEach(a => {
        const aInicio = new Date(a.data_inicio);
        const aFim = new Date(a.data_fim);
        if (aInicio <= dayEnd && aFim >= dayStart) {
            if (!integranteServicos[a.integrante_id]) {
                integranteServicos[a.integrante_id] = [];
            }
            const servico = servicos.find(s => s.id === a.servico_id);
            if (servico && servico.status !== 'cancelado') {
                integranteServicos[a.integrante_id].push({
                    ...servico,
                    aloc_inicio: a.data_inicio,
                    aloc_fim: a.data_fim
                });
            }
        }
    });

    // Mostrar rotas quando funcionário termina um serviço e começa outro no mesmo dia
    Object.keys(integranteServicos).forEach(integranteId => {
        const servicosIntegrante = integranteServicos[integranteId]
            .sort((a, b) => new Date(a.aloc_inicio) - new Date(b.aloc_inicio));

        for (let i = 0; i < servicosIntegrante.length - 1; i++) {
            const atual = servicosIntegrante[i];
            const proximo = servicosIntegrante[i + 1];

            const fimAtual = new Date(atual.data_fim_real || atual.data_fim_prevista);
            const inicioProximo = new Date(proximo.data_inicio);

            // Se termina no mesmo dia que o próximo começa
            if (fimAtual.toDateString() === inicioProximo.toDateString() ||
                (fimAtual <= inicioProximo && (inicioProximo - fimAtual) < 24 * 60 * 60 * 1000)) {

                const localAtual = locais.find(l => l.id === atual.local_id);
                const localProximo = locais.find(l => l.id === proximo.local_id);

                if (localAtual && localProximo && localAtual.latitude && localProximo.latitude) {
                    if (mapFilter === 'rotas' || mapFilter === 'all' || mapFilter === 'equipe') {
                        drawRoute(
                            { lat: localAtual.latitude, lng: localAtual.longitude },
                            { lat: localProximo.latitude, lng: localProximo.longitude },
                            integranteId
                        );
                    }
                }
            }
        }
    });
}

function drawRoute(origin, destination, integranteId) {
    const integrante = integrantes.find(i => i.id === integranteId);
    const colors = ['#e91e63', '#9c27b0', '#00bcd4', '#ff5722', '#8bc34a', '#ff9800'];
    const colorIndex = integrantes.indexOf(integrante) % colors.length;

    const renderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
            strokeColor: colors[colorIndex],
            strokeWeight: 4,
            strokeOpacity: 0.8
        }
    });

    directionsService.route({
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {
        if (status === 'OK') {
            renderer.setDirections(result);
            directionsRenderers.push(renderer);
        }
    });
}

// ===== FILTRO DO MAPA =====
window.filterMap = function(filter) {
    mapFilter = filter;
    document.querySelectorAll('.map-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    updateMapMarkers();
};

// ===== TABS DO PAINEL =====
window.switchTab = function(tab) {
    document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel-section').forEach(s => s.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`section-${tab}`).classList.add('active');

    if (tab === 'cronograma') updateCronograma();
    if (tab === 'equipe') renderEquipeList();
};

// ===== LISTA DE LOCAIS =====
function renderLocaisList() {
    const container = document.getElementById('locais-list');
    if (locais.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-map-marked-alt"></i>
                <p>Nenhum local cadastrado.<br>Clique em "Nova Obra/Visita" para começar.</p>
            </div>
        `;
        return;
    }

    let html = '';
    // Separar obras e visitas
    const obras = locais.filter(l => l.tipo === 'obra');
    const visitas = locais.filter(l => l.tipo === 'visita');

    if (obras.length > 0) {
        html += `<h4 style="color:#ffc107;font-size:0.85rem;margin-bottom:8px;"><i class="fas fa-hard-hat"></i> Obras (${obras.length})</h4>`;
        obras.forEach(local => {
            html += renderLocalCard(local);
        });
    }

    if (visitas.length > 0) {
        html += `<h4 style="color:#ff9800;font-size:0.85rem;margin:15px 0 8px;"><i class="fas fa-eye"></i> Visitas (${visitas.length})</h4>`;
        visitas.forEach(local => {
            html += renderLocalCard(local);
        });
    }

    container.innerHTML = html;
}

function renderLocalCard(local) {
    const statusLabel = getStatusLabel(local);
    const cadeiaCount = cadeias.filter(c => c.local_id === local.id).length;
    return `
        <div class="item-card ${selectedLocalId === local.id ? 'selected' : ''}" onclick="selectLocal('${local.id}')">
            <div class="item-card-header">
                <span class="item-card-title">${local.nome}</span>
                <span class="item-card-status status-${local.status}">${statusLabel}</span>
            </div>
            <div class="item-card-info">
                <i class="fas fa-map-marker-alt"></i> ${local.endereco || 'Sem endereço'}
                ${local.cliente_nome ? ` | <i class="fas fa-user"></i> ${local.cliente_nome}` : ''}
                ${cadeiaCount > 0 ? ` | <i class="fas fa-link"></i> ${cadeiaCount} cadeia(s)` : ''}
            </div>
            <div style="margin-top:6px;display:flex;gap:4px;">
                <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();editLocal('${local.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openLocalDetalhes('${local.id}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteLocal('${local.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

window.selectLocal = function(id) {
    selectedLocalId = id;
    const local = locais.find(l => l.id === id);
    if (local && local.latitude && local.longitude) {
        map.setCenter({ lat: local.latitude, lng: local.longitude });
        map.setZoom(16);
    }
    renderLocaisList();
};

// ===== LISTA DE EQUIPE =====
function renderEquipeList() {
    const container = document.getElementById('equipe-list');
    if (integrantes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>Nenhum integrante ativo encontrado.</p>
            </div>
        `;
        return;
    }

    const refDate = getEffectiveDate();
    let html = '';

    integrantes.forEach(integrante => {
        const servicosHoje = getServicosIntegrante(integrante.id, refDate);
        const statusBadge = servicosHoje.length > 0
            ? `<span style="background:rgba(76,175,80,0.3);color:#4caf50;padding:2px 6px;border-radius:10px;font-size:0.65rem;">Em serviço</span>`
            : `<span style="background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);padding:2px 6px;border-radius:10px;font-size:0.65rem;">Livre</span>`;

        html += `
            <div class="item-card" onclick="filterByFuncionario('${integrante.id}')">
                <div class="item-card-header">
                    <span class="item-card-title"><i class="fas fa-user"></i> ${integrante.nome}</span>
                    ${statusBadge}
                </div>
                ${servicosHoje.length > 0 ? `
                    <div class="item-card-info">
                        ${servicosHoje.map(s => {
                            const local = locais.find(l => l.id === s.local_id);
                            return `<div style="margin-top:3px;"><i class="fas fa-wrench"></i> ${s.nome} ${local ? '@ ' + local.nome : ''}</div>`;
                        }).join('')}
                    </div>
                ` : '<div class="item-card-info">Sem serviços para a data selecionada</div>'}
            </div>
        `;
    });

    container.innerHTML = html;
}

function getServicosIntegrante(integranteId, date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const alocacoesIntegrante = alocacoes.filter(a => {
        if (a.integrante_id !== integranteId) return false;
        const aInicio = new Date(a.data_inicio);
        const aFim = new Date(a.data_fim);
        return aInicio <= dayEnd && aFim >= dayStart;
    });

    return alocacoesIntegrante.map(a => {
        return servicos.find(s => s.id === a.servico_id);
    }).filter(s => s && s.status !== 'cancelado');
}

window.filterByFuncionario = function(id) {
    selectedFuncionarioFilter = selectedFuncionarioFilter === id ? null : id;
    renderEquipeList();
    updateCronograma();
    updateMapMarkers();
};

// ===== CRONOGRAMA =====
function getEffectiveDate() {
    if (simulatedDate) return new Date(simulatedDate);
    return currentDate;
}

window.updateCronograma = function() {
    const dateInput = document.getElementById('simulatedDate');
    if (dateInput.value) {
        simulatedDate = new Date(dateInput.value + 'T12:00:00');
    }
    renderCronograma();
    renderFuncionarioFilter();
    showEquipeOnMap();
};

window.resetSimulatedDate = function() {
    simulatedDate = null;
    currentDate = new Date();
    document.getElementById('simulatedDate').value = '';
    renderCronograma();
    renderFuncionarioFilter();
    updateMapMarkers();
};

window.navCronograma = function(direction) {
    const date = getEffectiveDate();
    if (currentView === 'dia') {
        date.setDate(date.getDate() + direction);
    } else if (currentView === 'semana') {
        date.setDate(date.getDate() + (direction * 7));
    } else {
        date.setMonth(date.getMonth() + direction);
    }
    currentDate = new Date(date);
    simulatedDate = new Date(date);
    document.getElementById('simulatedDate').value = formatDateInput(date);
    renderCronograma();
    renderFuncionarioFilter();
    updateMapMarkers();
};

window.switchView = function(view) {
    currentView = view;
    document.querySelectorAll('.view-toggle button').forEach(b => {
        b.classList.toggle('active', b.dataset.view === view);
    });
    renderCronograma();
};

function renderFuncionarioFilter() {
    const container = document.getElementById('funcionario-filter');
    let html = `<span class="funcionario-chip ${!selectedFuncionarioFilter ? 'active' : ''}" onclick="filterByFuncionario(null)">Todos</span>`;
    integrantes.forEach(i => {
        html += `<span class="funcionario-chip ${selectedFuncionarioFilter === i.id ? 'active' : ''}" onclick="filterByFuncionario('${i.id}')">${i.nome.split(' ')[0]}</span>`;
    });
    container.innerHTML = html;
}

function renderCronograma() {
    const container = document.getElementById('cronograma-content');
    const titleEl = document.getElementById('cronograma-title');
    const refDate = getEffectiveDate();

    if (currentView === 'dia') {
        titleEl.textContent = formatDateBR(refDate);
        renderCronogramaDia(container, refDate);
    } else if (currentView === 'semana') {
        const startOfWeek = new Date(refDate);
        startOfWeek.setDate(refDate.getDate() - refDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        titleEl.textContent = `${formatDateShort(startOfWeek)} - ${formatDateShort(endOfWeek)}`;
        renderCronogramaSemana(container, startOfWeek);
    } else {
        titleEl.textContent = refDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        renderCronogramaMes(container, refDate);
    }
}

function renderCronogramaDia(container, date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    // Buscar serviços do dia
    let servicosDoDia = servicos.filter(s => {
        const inicio = new Date(s.data_inicio);
        const fim = new Date(s.data_fim_real || s.data_fim_prevista);
        return inicio <= dayEnd && fim >= dayStart && s.status !== 'cancelado';
    });

    // Filtrar por funcionário se selecionado
    if (selectedFuncionarioFilter) {
        const servicoIds = alocacoes
            .filter(a => a.integrante_id === selectedFuncionarioFilter)
            .map(a => a.servico_id);
        servicosDoDia = servicosDoDia.filter(s => servicoIds.includes(s.id));
    }

    if (servicosDoDia.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-check"></i>
                <p>Nenhum serviço para este dia.</p>
            </div>
        `;
        return;
    }

    // Ordenar por hora de início
    servicosDoDia.sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio));

    let html = '';
    servicosDoDia.forEach(servico => {
        const local = locais.find(l => l.id === servico.local_id);
        const cadeia = cadeias.find(c => c.id === servico.cadeia_id);
        const servicoAlocacoes = alocacoes.filter(a => a.servico_id === servico.id);
        const equipeNomes = servicoAlocacoes.map(a => {
            const i = integrantes.find(int => int.id === a.integrante_id);
            return i ? i.nome.split(' ')[0] : '?';
        }).join(', ');

        const inicio = new Date(servico.data_inicio);
        const fim = new Date(servico.data_fim_real || servico.data_fim_prevista);
        const pausaAtiva = pausas.find(p => p.servico_id === servico.id && p.status === 'ativa');

        html += `
            <div class="timeline-item" onclick="openServicoEdit('${servico.id}')">
                <div class="timeline-time">
                    ${inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    <br>
                    <span style="font-size:0.65rem;color:rgba(255,255,255,0.4);">
                        ${fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
                <div class="timeline-content">
                    <div class="timeline-title">
                        ${servico.nome}
                        <span class="timeline-badge status-${servico.status}">${getServicoStatusLabel(servico.status)}</span>
                        ${pausaAtiva ? '<span class="timeline-badge" style="background:rgba(244,67,54,0.3);color:#f44336;"><i class="fas fa-pause"></i> Pausado</span>' : ''}
                    </div>
                    <div class="timeline-subtitle">
                        ${local ? `<i class="fas fa-map-pin"></i> ${local.nome}` : ''}
                        ${cadeia ? ` | <i class="fas fa-link"></i> ${cadeia.nome}` : ''}
                    </div>
                    ${equipeNomes ? `<div class="timeline-subtitle"><i class="fas fa-users"></i> ${equipeNomes}</div>` : ''}
                </div>
            </div>
        `;
    });

    // Mostrar rotas do dia
    const rotasDoDia = getRotasDoDia(date);
    if (rotasDoDia.length > 0) {
        html += `<h4 style="color:#ce93d8;font-size:0.8rem;margin-top:15px;"><i class="fas fa-route"></i> Rotas do Dia</h4>`;
        rotasDoDia.forEach(rota => {
            html += `
                <div class="timeline-item">
                    <div class="timeline-time" style="color:#ce93d8;">${rota.hora}</div>
                    <div class="timeline-content">
                        <div class="route-badge">
                            <i class="fas fa-car"></i> ${rota.funcionario}: ${rota.de} → ${rota.para}
                        </div>
                    </div>
                </div>
            `;
        });
    }

    container.innerHTML = html;
}

function renderCronogramaSemana(container, startOfWeek) {
    let html = '';
    for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);

        let servicosDoDia = servicos.filter(s => {
            const inicio = new Date(s.data_inicio);
            const fim = new Date(s.data_fim_real || s.data_fim_prevista);
            return inicio <= dayEnd && fim >= dayStart && s.status !== 'cancelado';
        });

        if (selectedFuncionarioFilter) {
            const servicoIds = alocacoes.filter(a => a.integrante_id === selectedFuncionarioFilter).map(a => a.servico_id);
            servicosDoDia = servicosDoDia.filter(s => servicoIds.includes(s.id));
        }

        const isToday = day.toDateString() === new Date().toDateString();
        html += `
            <div style="margin-bottom:12px;padding:8px;background:${isToday ? 'rgba(76,175,80,0.1)' : 'rgba(255,255,255,0.03)'};border-radius:6px;border:1px solid ${isToday ? 'rgba(76,175,80,0.3)' : 'rgba(255,255,255,0.05)'};">
                <div style="font-size:0.75rem;font-weight:700;color:${isToday ? '#4caf50' : '#add8e6'};margin-bottom:5px;">
                    ${day.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                    ${isToday ? ' (HOJE)' : ''}
                    <span style="float:right;color:rgba(255,255,255,0.4);">${servicosDoDia.length} serviço(s)</span>
                </div>
                ${servicosDoDia.slice(0, 3).map(s => {
                    const local = locais.find(l => l.id === s.local_id);
                    return `<div style="font-size:0.7rem;color:rgba(255,255,255,0.6);padding:2px 0;"><i class="fas fa-wrench"></i> ${s.nome} ${local ? '@ ' + local.nome : ''}</div>`;
                }).join('')}
                ${servicosDoDia.length > 3 ? `<div style="font-size:0.65rem;color:rgba(255,255,255,0.4);">+${servicosDoDia.length - 3} mais...</div>` : ''}
                ${servicosDoDia.length === 0 ? '<div style="font-size:0.7rem;color:rgba(255,255,255,0.3);">Sem serviços</div>' : ''}
            </div>
        `;
    }
    container.innerHTML = html;
}

function renderCronogramaMes(container, date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    let html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;">';

    // Headers
    ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].forEach(d => {
        html += `<div style="text-align:center;font-size:0.65rem;color:rgba(255,255,255,0.5);padding:4px;">${d}</div>`;
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        html += '<div></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(year, month, day);
        const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);

        let count = servicos.filter(s => {
            const inicio = new Date(s.data_inicio);
            const fim = new Date(s.data_fim_real || s.data_fim_prevista);
            return inicio <= dayEnd && fim >= dayStart && s.status !== 'cancelado';
        }).length;

        if (selectedFuncionarioFilter) {
            const servicoIds = alocacoes.filter(a => a.integrante_id === selectedFuncionarioFilter).map(a => a.servico_id);
            count = servicos.filter(s => {
                const inicio = new Date(s.data_inicio);
                const fim = new Date(s.data_fim_real || s.data_fim_prevista);
                return inicio <= dayEnd && fim >= dayStart && s.status !== 'cancelado' && servicoIds.includes(s.id);
            }).length;
        }

        const isToday = d.toDateString() === new Date().toDateString();
        const bgColor = count > 0 ? `rgba(33,150,243,${Math.min(count * 0.15, 0.6)})` : 'rgba(255,255,255,0.03)';

        html += `
            <div style="text-align:center;padding:4px;border-radius:4px;background:${bgColor};border:${isToday ? '1px solid #4caf50' : '1px solid transparent'};cursor:pointer;font-size:0.7rem;" onclick="goToDay(${year},${month},${day})">
                ${day}
                ${count > 0 ? `<div style="font-size:0.55rem;color:#2196f3;">${count}</div>` : ''}
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

window.goToDay = function(year, month, day) {
    const date = new Date(year, month, day, 12, 0, 0);
    currentDate = date;
    simulatedDate = date;
    document.getElementById('simulatedDate').value = formatDateInput(date);
    switchView('dia');
    renderCronograma();
    updateMapMarkers();
};

function getRotasDoDia(date) {
    const rotas = [];
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

    const integranteServicos = {};
    alocacoes.forEach(a => {
        const aInicio = new Date(a.data_inicio);
        const aFim = new Date(a.data_fim);
        if (aInicio <= dayEnd && aFim >= dayStart) {
            if (!integranteServicos[a.integrante_id]) integranteServicos[a.integrante_id] = [];
            const servico = servicos.find(s => s.id === a.servico_id);
            if (servico && servico.status !== 'cancelado') {
                integranteServicos[a.integrante_id].push({ ...servico, aloc_inicio: a.data_inicio, aloc_fim: a.data_fim });
            }
        }
    });

    Object.keys(integranteServicos).forEach(integranteId => {
        const lista = integranteServicos[integranteId].sort((a, b) => new Date(a.aloc_inicio) - new Date(b.aloc_inicio));
        for (let i = 0; i < lista.length - 1; i++) {
            const atual = lista[i];
            const proximo = lista[i + 1];
            const fimAtual = new Date(atual.data_fim_real || atual.data_fim_prevista);
            const inicioProximo = new Date(proximo.data_inicio);

            if (fimAtual.toDateString() === dayStart.toDateString() || inicioProximo.toDateString() === dayStart.toDateString()) {
                const localAtual = locais.find(l => l.id === atual.local_id);
                const localProximo = locais.find(l => l.id === proximo.local_id);
                const integrante = integrantes.find(i => i.id === integranteId);

                if (localAtual && localProximo && integrante) {
                    rotas.push({
                        hora: fimAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                        funcionario: integrante.nome.split(' ')[0],
                        de: localAtual.nome,
                        para: localProximo.nome
                    });
                }
            }
        }
    });

    return rotas;
}

// ===== MODAIS =====
window.openModal = function(type) {
    document.getElementById(`modal-${type}`).classList.add('active');
    if (type === 'cadeia') {
        populateCadeiaLocalSelect();
        tempServicos = [];
        renderTempServicos();
    }
};

window.closeModal = function(type) {
    document.getElementById(`modal-${type}`).classList.remove('active');
};

// ===== CRUD LOCAIS =====
window.geocodeAddress = function() {
    const endereco = document.getElementById('local-endereco').value;
    if (!endereco) {
        showToast('Digite um endereço primeiro.', 'warning');
        return;
    }

    geocoder.geocode({ address: endereco }, (results, status) => {
        if (status === 'OK' && results[0]) {
            const location = results[0].geometry.location;
            document.getElementById('local-lat').value = location.lat().toFixed(6);
            document.getElementById('local-lng').value = location.lng().toFixed(6);
            map.setCenter(location);
            map.setZoom(16);
            showToast('Endereço encontrado no mapa!', 'success');
        } else {
            showToast('Não foi possível encontrar o endereço. Tente ser mais específico.', 'error');
        }
    });
};

window.updateStatusOptions = function() {
    const tipo = document.getElementById('local-tipo').value;
    const statusSelect = document.getElementById('local-status');
    if (tipo === 'obra') {
        statusSelect.innerHTML = `
            <option value="a_iniciar">À Iniciar</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="finalizada">Finalizada</option>
        `;
    } else {
        statusSelect.innerHTML = `
            <option value="pendente">Pendente</option>
            <option value="concluida">Concluída</option>
        `;
    }
};

window.saveLocal = async function(event) {
    event.preventDefault();
    const id = document.getElementById('local-id').value;
    const data = {
        nome: document.getElementById('local-nome').value,
        tipo: document.getElementById('local-tipo').value,
        endereco: document.getElementById('local-endereco').value,
        status: document.getElementById('local-status').value,
        cliente_nome: document.getElementById('local-cliente').value || null,
        observacoes: document.getElementById('local-observacoes').value || null,
        latitude: parseFloat(document.getElementById('local-lat').value) || null,
        longitude: parseFloat(document.getElementById('local-lng').value) || null,
        updated_at: new Date().toISOString()
    };

    try {
        if (id) {
            const { error } = await supabase.from('logistica_locais').update(data).eq('id', id);
            if (error) throw error;
            showToast('Local atualizado com sucesso!', 'success');
        } else {
            const { error } = await supabase.from('logistica_locais').insert(data);
            if (error) throw error;
            showToast('Local criado com sucesso!', 'success');
        }
        closeModal('local');
        resetFormLocal();
        await loadLocais();
        renderLocaisList();
        updateMapMarkers();
        populateCadeiaLocalSelect();
    } catch (error) {
        console.error('Erro ao salvar local:', error);
        showToast('Erro ao salvar: ' + error.message, 'error');
    }
};

window.editLocal = function(id) {
    const local = locais.find(l => l.id === id);
    if (!local) return;

    document.getElementById('local-id').value = local.id;
    document.getElementById('local-nome').value = local.nome;
    document.getElementById('local-tipo').value = local.tipo;
    updateStatusOptions();
    document.getElementById('local-status').value = local.status;
    document.getElementById('local-endereco').value = local.endereco || '';
    document.getElementById('local-cliente').value = local.cliente_nome || '';
    document.getElementById('local-observacoes').value = local.observacoes || '';
    document.getElementById('local-lat').value = local.latitude || '';
    document.getElementById('local-lng').value = local.longitude || '';
    document.getElementById('modal-local-title').innerHTML = '<i class="fas fa-edit"></i> Editar Local';
    openModal('local');
};

window.deleteLocal = async function(id) {
    if (!confirm('Tem certeza que deseja excluir este local? Todas as cadeias e serviços associados serão excluídos.')) return;
    try {
        const { error } = await supabase.from('logistica_locais').delete().eq('id', id);
        if (error) throw error;
        showToast('Local excluído com sucesso!', 'success');
        await loadAllData();
    } catch (error) {
        showToast('Erro ao excluir: ' + error.message, 'error');
    }
};

function resetFormLocal() {
    document.getElementById('form-local').reset();
    document.getElementById('local-id').value = '';
    document.getElementById('modal-local-title').innerHTML = '<i class="fas fa-map-pin"></i> Nova Obra/Visita';
}

// ===== DETALHES DO LOCAL =====
window.openLocalDetalhes = function(id) {
    const local = locais.find(l => l.id === id);
    if (!local) return;

    const localCadeias = cadeias.filter(c => c.local_id === id);
    let html = `
        <div style="margin-bottom:15px;">
            <p><b>Tipo:</b> ${local.tipo === 'obra' ? 'Obra' : 'Visita'} | <b>Status:</b> ${getStatusLabel(local)}</p>
            <p><b>Endereço:</b> ${local.endereco || 'Não informado'}</p>
            ${local.cliente_nome ? `<p><b>Cliente:</b> ${local.cliente_nome}</p>` : ''}
            ${local.observacoes ? `<p><b>Obs:</b> ${local.observacoes}</p>` : ''}
        </div>
    `;

    if (localCadeias.length > 0) {
        html += `<h4 style="color:#ffc107;margin-bottom:10px;"><i class="fas fa-link"></i> Cadeias de Serviços</h4>`;
        localCadeias.forEach(cadeia => {
            const cadeiaServicos = servicos.filter(s => s.cadeia_id === cadeia.id).sort((a, b) => a.ordem - b.ordem);
            html += `
                <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:12px;margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <span style="font-weight:700;color:#add8e6;">${cadeia.nome}</span>
                        <div>
                            <button class="btn btn-secondary btn-sm" onclick="editCadeia('${cadeia.id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-danger btn-sm" onclick="deleteCadeia('${cadeia.id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    ${cadeiaServicos.map(s => {
                        const pausaAtiva = pausas.find(p => p.servico_id === s.id && p.status === 'ativa');
                        const servicoAlocs = alocacoes.filter(a => a.servico_id === s.id);
                        const equipe = servicoAlocs.map(a => {
                            const i = integrantes.find(int => int.id === a.integrante_id);
                            return i ? i.nome.split(' ')[0] : '';
                        }).filter(Boolean).join(', ');

                        return `
                            <div class="servico-chain-item" onclick="openServicoEdit('${s.id}')">
                                <div class="servico-chain-order">${s.ordem}</div>
                                <div class="servico-chain-info">
                                    <div class="servico-chain-name">${s.nome} <span class="item-card-status status-${s.status}" style="font-size:0.6rem;">${getServicoStatusLabel(s.status)}</span></div>
                                    <div class="servico-chain-dates">
                                        ${formatDateTimeBR(s.data_inicio)} → ${formatDateTimeBR(s.data_fim_real || s.data_fim_prevista)}
                                        ${equipe ? ` | <i class="fas fa-users"></i> ${equipe}` : ''}
                                        ${pausaAtiva ? ' | <i class="fas fa-pause" style="color:#f44336;"></i> PAUSADO' : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                    ${cadeiaServicos.length === 0 ? '<div style="font-size:0.75rem;color:rgba(255,255,255,0.4);">Nenhum serviço nesta cadeia</div>' : ''}
                </div>
            `;
        });
    } else {
        html += `<div style="text-align:center;color:rgba(255,255,255,0.4);padding:20px;"><i class="fas fa-link"></i><p>Nenhuma cadeia de serviços.<br>Crie uma nova cadeia para este local.</p></div>`;
    }

    document.getElementById('detalhes-local-title').innerHTML = `<i class="fas fa-${local.tipo === 'obra' ? 'hard-hat' : 'eye'}"></i> ${local.nome}`;
    document.getElementById('detalhes-local-content').innerHTML = html;
    openModal('local-detalhes');
};

// ===== CRUD CADEIAS =====
function populateCadeiaLocalSelect() {
    const select = document.getElementById('cadeia-local');
    const obrasAtivas = locais.filter(l => l.tipo === 'obra' && l.status !== 'finalizada');
    select.innerHTML = '<option value="">Selecione um local...</option>';
    obrasAtivas.forEach(l => {
        select.innerHTML += `<option value="${l.id}">${l.nome}</option>`;
    });
}

window.addServicoCadeia = function() {
    const ordem = tempServicos.length + 1;
    const now = new Date();
    const defaultInicio = tempServicos.length > 0
        ? tempServicos[tempServicos.length - 1].data_fim_prevista
        : now.toISOString().slice(0, 16);

    const defaultFim = new Date(new Date(defaultInicio).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

    tempServicos.push({
        tempId: Date.now() + Math.random(),
        nome: '',
        descricao: '',
        ordem: ordem,
        data_inicio: defaultInicio,
        data_fim_prevista: defaultFim
    });
    renderTempServicos();
};

function renderTempServicos() {
    const container = document.getElementById('cadeia-servicos-list');
    if (tempServicos.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.4);padding:15px;font-size:0.8rem;">Adicione serviços à cadeia</div>';
        return;
    }

    let html = '';
    tempServicos.forEach((s, index) => {
        const isExistingServico = s.tempId && servicos.find(sv => sv.id === s.tempId);
        html += `
            <div class="servico-chain-item" style="flex-direction:column;align-items:stretch;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                    <div class="servico-chain-order">${index + 1}</div>
                    <input type="text" value="${s.nome}" placeholder="Nome do serviço *" 
                        onchange="updateTempServico(${index}, 'nome', this.value)"
                        style="flex:1;padding:6px;border-radius:4px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:white;font-size:0.8rem;">
                    ${isExistingServico ? `
                    <button type="button" class="btn btn-primary btn-sm" onclick="openServicoEditFromCadeia('${s.tempId}')" title="Editar equipe, pausas e detalhes">
                        <i class="fas fa-users-cog"></i>
                    </button>` : ''}
                    <button type="button" class="btn btn-danger btn-sm" onclick="removeTempServico(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <div>
                        <label style="font-size:0.65rem;color:rgba(255,255,255,0.5);">Início</label>
                        <input type="datetime-local" value="${s.data_inicio}" 
                            onchange="updateTempServico(${index}, 'data_inicio', this.value)"
                            style="width:100%;padding:4px;border-radius:4px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:white;font-size:0.75rem;">
                    </div>
                    <div>
                        <label style="font-size:0.65rem;color:rgba(255,255,255,0.5);">Fim Previsto</label>
                        <input type="datetime-local" value="${s.data_fim_prevista}" 
                            onchange="updateTempServico(${index}, 'data_fim_prevista', this.value)"
                            style="width:100%;padding:4px;border-radius:4px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:white;font-size:0.75rem;">
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

window.updateTempServico = function(index, field, value) {
    tempServicos[index][field] = value;
};

window.removeTempServico = function(index) {
    tempServicos.splice(index, 1);
    tempServicos.forEach((s, i) => s.ordem = i + 1);
    renderTempServicos();
};

window.saveCadeia = async function(event) {
    event.preventDefault();
    const localId = document.getElementById('cadeia-local').value;
    const nome = document.getElementById('cadeia-nome').value;
    const descricao = document.getElementById('cadeia-descricao').value;
    const cadeiaId = document.getElementById('cadeia-id').value;

    if (tempServicos.length === 0) {
        showToast('Adicione pelo menos um serviço à cadeia.', 'warning');
        return;
    }

    const servicosSemNome = tempServicos.filter(s => !s.nome.trim());
    if (servicosSemNome.length > 0) {
        showToast('Todos os serviços devem ter um nome.', 'warning');
        return;
    }

    try {
        let savedCadeiaId;
        if (cadeiaId) {
            const { error } = await supabase.from('logistica_cadeias').update({
                nome, descricao, local_id: localId, updated_at: new Date().toISOString()
            }).eq('id', cadeiaId);
            if (error) throw error;
            savedCadeiaId = cadeiaId;
            // Deletar serviços antigos da cadeia
            await supabase.from('logistica_servicos').delete().eq('cadeia_id', cadeiaId);
        } else {
            const { data, error } = await supabase.from('logistica_cadeias').insert({
                nome, descricao, local_id: localId, status: 'ativa'
            }).select().single();
            if (error) throw error;
            savedCadeiaId = data.id;
        }

        // Inserir serviços
        const servicosData = tempServicos.map((s, i) => ({
            cadeia_id: savedCadeiaId,
            local_id: localId,
            nome: s.nome,
            descricao: s.descricao || null,
            ordem: i + 1,
            data_inicio: new Date(s.data_inicio).toISOString(),
            data_fim_prevista: new Date(s.data_fim_prevista).toISOString(),
            status: 'pendente'
        }));

        const { error: sError } = await supabase.from('logistica_servicos').insert(servicosData);
        if (sError) throw sError;

        showToast('Cadeia de serviços salva com sucesso!', 'success');
        closeModal('cadeia');
        resetFormCadeia();
        await loadAllData();
    } catch (error) {
        console.error('Erro ao salvar cadeia:', error);
        showToast('Erro ao salvar: ' + error.message, 'error');
    }
};

window.editCadeia = async function(id) {
    const cadeia = cadeias.find(c => c.id === id);
    if (!cadeia) return;

    closeModal('local-detalhes');
    document.getElementById('cadeia-id').value = cadeia.id;
    document.getElementById('cadeia-nome').value = cadeia.nome;
    document.getElementById('cadeia-local').value = cadeia.local_id;
    document.getElementById('cadeia-descricao').value = cadeia.descricao || '';
    document.getElementById('modal-cadeia-title').innerHTML = '<i class="fas fa-edit"></i> Editar Cadeia';

    // Carregar serviços existentes
    tempServicos = servicos.filter(s => s.cadeia_id === id).sort((a, b) => a.ordem - b.ordem).map(s => ({
        tempId: s.id,
        nome: s.nome,
        descricao: s.descricao || '',
        ordem: s.ordem,
        data_inicio: s.data_inicio.slice(0, 16),
        data_fim_prevista: s.data_fim_prevista.slice(0, 16)
    }));

    renderTempServicos();
    populateCadeiaIntegranteSelect();
    renderCadeiaEquipeGlobal();
    openModal('cadeia');
};

window.deleteCadeia = async function(id) {
    if (!confirm('Excluir esta cadeia e todos os seus serviços?')) return;
    try {
        const { error } = await supabase.from('logistica_cadeias').delete().eq('id', id);
        if (error) throw error;
        showToast('Cadeia excluída!', 'success');
        closeModal('local-detalhes');
        await loadAllData();
    } catch (error) {
        showToast('Erro: ' + error.message, 'error');
    }
};

function resetFormCadeia() {
    document.getElementById('form-cadeia').reset();
    document.getElementById('cadeia-id').value = '';
    document.getElementById('modal-cadeia-title').innerHTML = '<i class="fas fa-link"></i> Nova Cadeia de Serviços';
    tempServicos = [];
    renderTempServicos();
}

// ===== EDIÇÃO DE SERVIÇO =====
window.openServicoEdit = function(id) {
    const servico = servicos.find(s => s.id === id);
    if (!servico) return;

    // Destacar visualmente o serviço selecionado
    document.querySelectorAll('.servico-chain-item').forEach(el => el.classList.remove('servico-selected'));
    document.querySelectorAll('.timeline-item').forEach(el => el.classList.remove('servico-selected'));
    const clickedEl = event && event.currentTarget;
    if (clickedEl) clickedEl.classList.add('servico-selected');

    document.getElementById('servico-id').value = servico.id;
    document.getElementById('servico-cadeia-id').value = servico.cadeia_id;
    document.getElementById('servico-nome').value = servico.nome;
    document.getElementById('servico-descricao').value = servico.descricao || '';
    document.getElementById('servico-inicio').value = servico.data_inicio ? servico.data_inicio.slice(0, 16) : '';
    document.getElementById('servico-fim-previsto').value = servico.data_fim_prevista ? servico.data_fim_prevista.slice(0, 16) : '';
    document.getElementById('servico-fim-real').value = servico.data_fim_real ? servico.data_fim_real.slice(0, 16) : '';
    document.getElementById('servico-status').value = servico.status;

    // Carregar equipe alocada
    renderServicoEquipe(id);
    // Carregar pausas
    renderServicoPausas(id);
    // Popular select de integrantes
    populateIntegranteSelect();

    openModal('servico');
};

// Abrir edição de serviço a partir do modal de cadeia (mantém contexto)
window.openServicoEditFromCadeia = function(id) {
    const servico = servicos.find(s => s.id === id);
    if (!servico) {
        showToast('Serviço não encontrado. Salve a cadeia primeiro.', 'warning');
        return;
    }

    document.getElementById('servico-id').value = servico.id;
    document.getElementById('servico-cadeia-id').value = servico.cadeia_id;
    document.getElementById('servico-nome').value = servico.nome;
    document.getElementById('servico-descricao').value = servico.descricao || '';
    document.getElementById('servico-inicio').value = servico.data_inicio ? servico.data_inicio.slice(0, 16) : '';
    document.getElementById('servico-fim-previsto').value = servico.data_fim_prevista ? servico.data_fim_prevista.slice(0, 16) : '';
    document.getElementById('servico-fim-real').value = servico.data_fim_real ? servico.data_fim_real.slice(0, 16) : '';
    document.getElementById('servico-status').value = servico.status;

    renderServicoEquipe(id);
    renderServicoPausas(id);
    populateIntegranteSelect();

    // Fechar modal cadeia e abrir modal serviço
    closeModal('cadeia');
    openModal('servico');
};

function renderServicoEquipe(servicoId) {
    const container = document.getElementById('servico-equipe-list');
    const servicoAlocs = alocacoes.filter(a => a.servico_id === servicoId);

    if (servicoAlocs.length === 0) {
        container.innerHTML = '<span style="font-size:0.75rem;color:rgba(255,255,255,0.4);">Nenhum funcionário alocado</span>';
        return;
    }

    container.innerHTML = servicoAlocs.map(a => {
        const integrante = integrantes.find(i => i.id === a.integrante_id);
        return `
            <span class="equipe-badge alocado">
                <i class="fas fa-user"></i> ${integrante ? integrante.nome.split(' ')[0] : '?'}
                <span class="remove-equipe" onclick="removeIntegranteServico('${a.id}')"><i class="fas fa-times"></i></span>
            </span>
        `;
    }).join('');
}

function renderServicoPausas(servicoId) {
    const container = document.getElementById('servico-pausas-list');
    const servicoPausas = pausas.filter(p => p.servico_id === servicoId);

    if (servicoPausas.length === 0) {
        container.innerHTML = '<span style="font-size:0.75rem;color:rgba(255,255,255,0.4);">Nenhuma pausa registrada</span>';
        return;
    }

    container.innerHTML = servicoPausas.map(p => `
        <div class="pausa-indicator">
            <i class="fas fa-pause-circle"></i>
            <b>${p.status === 'ativa' ? 'ATIVA' : p.status === 'retomada' ? 'Retomada' : 'Cancelada'}</b> - ${p.motivo}
            <br><small>Pausado em: ${formatDateTimeBR(p.data_pausa)}</small>
            ${p.previsao_retomada ? `<br><small>Previsão retomada: ${formatDateTimeBR(p.previsao_retomada)}</small>` : ''}
            ${p.sem_previsao ? '<br><small style="color:#f44336;">Sem previsão de retomada</small>' : ''}
            ${p.status === 'ativa' ? `<br><button class="btn btn-primary btn-sm" style="margin-top:5px;" onclick="retomarPausa('${p.id}')"><i class="fas fa-play"></i> Retomar</button>` : ''}
        </div>
    `).join('');
}

function populateIntegranteSelect() {
    const select = document.getElementById('servico-add-integrante');
    select.innerHTML = '<option value="">Selecionar funcionário...</option>';
    integrantes.forEach(i => {
        select.innerHTML += `<option value="${i.id}">${i.nome}</option>`;
    });
}

// ===== ALOCAÇÃO DE EQUIPE COM VALIDAÇÃO DE CONFLITOS =====
window.addIntegranteServico = async function() {
    const integranteId = document.getElementById('servico-add-integrante').value;
    const servicoId = document.getElementById('servico-id').value;
    if (!integranteId) {
        showToast('Selecione um funcionário.', 'warning');
        return;
    }

    const servico = servicos.find(s => s.id === servicoId);
    if (!servico) return;

    // Verificar conflito de horário
    const conflito = checkConflito(integranteId, servico.data_inicio, servico.data_fim_real || servico.data_fim_prevista, servicoId);
    if (conflito) {
        const conflitoServico = servicos.find(s => s.id === conflito.servico_id);
        document.getElementById('conflito-aviso').style.display = 'block';
        document.getElementById('conflito-aviso').innerHTML = `
            <i class="fas fa-exclamation-triangle"></i> <b>CONFLITO!</b> Este funcionário já está alocado em "${conflitoServico ? conflitoServico.nome : 'outro serviço'}" 
            no período ${formatDateTimeBR(conflito.data_inicio)} a ${formatDateTimeBR(conflito.data_fim)}.
            <br>Um funcionário NÃO pode estar em dois serviços ao mesmo tempo.
        `;
        return;
    }

    document.getElementById('conflito-aviso').style.display = 'none';

    try {
        const { error } = await supabase.from('logistica_alocacoes').insert({
            servico_id: servicoId,
            integrante_id: integranteId,
            data_inicio: servico.data_inicio,
            data_fim: servico.data_fim_real || servico.data_fim_prevista
        });
        if (error) throw error;

        await loadAlocacoes();
        renderServicoEquipe(servicoId);
        document.getElementById('servico-add-integrante').value = '';
        showToast('Funcionário alocado com sucesso!', 'success');
    } catch (error) {
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
            showToast('Este funcionário já está alocado neste serviço.', 'warning');
        } else {
            showToast('Erro: ' + error.message, 'error');
        }
    }
};

function checkConflito(integranteId, inicio, fim, excludeServicoId) {
    const novoInicio = new Date(inicio);
    const novoFim = new Date(fim);

    const alocacoesIntegrante = alocacoes.filter(a =>
        a.integrante_id === integranteId && a.servico_id !== excludeServicoId
    );

    for (const aloc of alocacoesIntegrante) {
        const alocInicio = new Date(aloc.data_inicio);
        const alocFim = new Date(aloc.data_fim);

        // Verificar intersecção
        if (novoInicio < alocFim && novoFim > alocInicio) {
            return aloc;
        }
    }
    return null;
}

window.removeIntegranteServico = async function(alocacaoId) {
    if (!confirm('Remover este funcionário do serviço?')) return;
    try {
        const { error } = await supabase.from('logistica_alocacoes').delete().eq('id', alocacaoId);
        if (error) throw error;
        await loadAlocacoes();
        const servicoId = document.getElementById('servico-id').value;
        renderServicoEquipe(servicoId);
        showToast('Funcionário removido.', 'success');
    } catch (error) {
        showToast('Erro: ' + error.message, 'error');
    }
};

// ===== SALVAR SERVIÇO =====
window.saveServico = async function(event) {
    event.preventDefault();
    const id = document.getElementById('servico-id').value;
    const data = {
        nome: document.getElementById('servico-nome').value,
        descricao: document.getElementById('servico-descricao').value || null,
        data_inicio: new Date(document.getElementById('servico-inicio').value).toISOString(),
        data_fim_prevista: new Date(document.getElementById('servico-fim-previsto').value).toISOString(),
        data_fim_real: document.getElementById('servico-fim-real').value ? new Date(document.getElementById('servico-fim-real').value).toISOString() : null,
        status: document.getElementById('servico-status').value,
        updated_at: new Date().toISOString()
    };

    try {
        const { error } = await supabase.from('logistica_servicos').update(data).eq('id', id);
        if (error) throw error;

        // Atualizar alocações com novas datas
        const servicoAlocs = alocacoes.filter(a => a.servico_id === id);
        for (const aloc of servicoAlocs) {
            await supabase.from('logistica_alocacoes').update({
                data_inicio: data.data_inicio,
                data_fim: data.data_fim_real || data.data_fim_prevista
            }).eq('id', aloc.id);
        }

        showToast('Serviço atualizado!', 'success');
        closeModal('servico');
        await loadAllData();
    } catch (error) {
        showToast('Erro: ' + error.message, 'error');
    }
};

// ===== CONFIRMAR FIM DO SERVIÇO (com reajuste automático da cadeia) =====
window.confirmarFimServico = async function() {
    const servicoId = document.getElementById('servico-id').value;
    const fimReal = document.getElementById('servico-fim-real').value;

    if (!fimReal) {
        showToast('Informe a data/hora real de conclusão antes de confirmar.', 'warning');
        return;
    }

    const servico = servicos.find(s => s.id === servicoId);
    if (!servico) return;

    const fimPrevisto = new Date(servico.data_fim_prevista);
    const fimRealDate = new Date(fimReal);
    const diferenca = fimRealDate.getTime() - fimPrevisto.getTime(); // ms de diferença

    try {
        // Atualizar o serviço atual
        await supabase.from('logistica_servicos').update({
            data_fim_real: fimRealDate.toISOString(),
            status: 'concluido',
            confirmado: true,
            updated_at: new Date().toISOString()
        }).eq('id', servicoId);

        // Reajustar serviços subsequentes na cadeia
        if (diferenca !== 0) {
            const cadeiaServicos = servicos
                .filter(s => s.cadeia_id === servico.cadeia_id && s.ordem > servico.ordem)
                .sort((a, b) => a.ordem - b.ordem);

            for (const s of cadeiaServicos) {
                if (s.confirmado) continue; // Não reajustar serviços já confirmados

                const novoInicio = new Date(new Date(s.data_inicio).getTime() + diferenca);
                const novoFim = new Date(new Date(s.data_fim_prevista).getTime() + diferenca);

                await supabase.from('logistica_servicos').update({
                    data_inicio: novoInicio.toISOString(),
                    data_fim_prevista: novoFim.toISOString(),
                    updated_at: new Date().toISOString()
                }).eq('id', s.id);

                // Atualizar alocações correspondentes
                const sAlocs = alocacoes.filter(a => a.servico_id === s.id);
                for (const aloc of sAlocs) {
                    await supabase.from('logistica_alocacoes').update({
                        data_inicio: novoInicio.toISOString(),
                        data_fim: novoFim.toISOString()
                    }).eq('id', aloc.id);
                }
            }

            const dias = Math.round(diferenca / (24 * 60 * 60 * 1000));
            if (dias > 0) {
                showToast(`Serviço concluído! ${cadeiaServicos.length} serviço(s) subsequente(s) adiado(s) em ${dias} dia(s).`, 'warning');
            } else if (dias < 0) {
                showToast(`Serviço concluído antecipadamente! ${cadeiaServicos.length} serviço(s) subsequente(s) antecipado(s) em ${Math.abs(dias)} dia(s).`, 'success');
            }
        } else {
            showToast('Serviço concluído conforme previsto!', 'success');
        }

        closeModal('servico');
        await loadAllData();
    } catch (error) {
        showToast('Erro: ' + error.message, 'error');
    }
};

window.deleteServico = async function() {
    const servicoId = document.getElementById('servico-id').value;
    if (!confirm('Excluir este serviço?')) return;

    try {
        const { error } = await supabase.from('logistica_servicos').delete().eq('id', servicoId);
        if (error) throw error;
        showToast('Serviço excluído!', 'success');
        closeModal('servico');
        await loadAllData();
    } catch (error) {
        showToast('Erro: ' + error.message, 'error');
    }
};

// ===== PAUSAS =====
window.addPausa = function() {
    const servicoId = document.getElementById('servico-id').value;
    document.getElementById('pausa-servico-id').value = servicoId;
    document.getElementById('pausa-id').value = '';
    document.getElementById('form-pausa').reset();
    openModal('pausa');
};

window.togglePrevisaoRetomada = function() {
    const semPrevisao = document.getElementById('pausa-sem-previsao').checked;
    document.getElementById('previsao-retomada-group').style.display = semPrevisao ? 'none' : 'block';
};

window.savePausa = async function(event) {
    event.preventDefault();
    const servicoId = document.getElementById('pausa-servico-id').value;
    const motivo = document.getElementById('pausa-motivo').value;
    const semPrevisao = document.getElementById('pausa-sem-previsao').checked;
    const previsao = document.getElementById('pausa-previsao').value;

    try {
        // Registrar a pausa
        const { error } = await supabase.from('logistica_pausas').insert({
            servico_id: servicoId,
            motivo: motivo,
            data_pausa: new Date().toISOString(),
            previsao_retomada: previsao ? new Date(previsao).toISOString() : null,
            sem_previsao: semPrevisao,
            status: 'ativa'
        });
        if (error) throw error;

        // Atualizar status do serviço
        await supabase.from('logistica_servicos').update({
            status: 'suspenso',
            updated_at: new Date().toISOString()
        }).eq('id', servicoId);

        // Suspender cadeia e reajustar se tem previsão
        const servico = servicos.find(s => s.id === servicoId);
        if (servico && previsao) {
            const fimPrevisto = new Date(servico.data_fim_prevista);
            const retomada = new Date(previsao);
            const pausaDuration = retomada.getTime() - new Date().getTime();

            // Adiar serviços subsequentes
            const subsequentes = servicos
                .filter(s => s.cadeia_id === servico.cadeia_id && s.ordem > servico.ordem && !s.confirmado)
                .sort((a, b) => a.ordem - b.ordem);

            for (const s of subsequentes) {
                const novoInicio = new Date(new Date(s.data_inicio).getTime() + pausaDuration);
                const novoFim = new Date(new Date(s.data_fim_prevista).getTime() + pausaDuration);
                await supabase.from('logistica_servicos').update({
                    data_inicio: novoInicio.toISOString(),
                    data_fim_prevista: novoFim.toISOString(),
                    updated_at: new Date().toISOString()
                }).eq('id', s.id);
            }
        }

        showToast('Pausa registrada! Serviço suspenso.', 'success');
        closeModal('pausa');
        await loadAllData();
        renderServicoPausas(servicoId);
    } catch (error) {
        showToast('Erro: ' + error.message, 'error');
    }
};

window.retomarPausa = async function(pausaId) {
    try {
        const pausa = pausas.find(p => p.id === pausaId);
        if (!pausa) return;

        await supabase.from('logistica_pausas').update({
            status: 'retomada',
            data_retomada_real: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }).eq('id', pausaId);

        // Verificar se há outras pausas ativas no serviço
        const outrasPausas = pausas.filter(p => p.servico_id === pausa.servico_id && p.id !== pausaId && p.status === 'ativa');
        if (outrasPausas.length === 0) {
            await supabase.from('logistica_servicos').update({
                status: 'em_andamento',
                updated_at: new Date().toISOString()
            }).eq('id', pausa.servico_id);
        }

        // Reajustar cadeia baseado na diferença real vs previsão
        if (pausa.previsao_retomada) {
            const previsao = new Date(pausa.previsao_retomada);
            const real = new Date();
            const diferenca = real.getTime() - previsao.getTime();

            if (Math.abs(diferenca) > 60000) { // Mais de 1 minuto de diferença
                const servico = servicos.find(s => s.id === pausa.servico_id);
                if (servico) {
                    const subsequentes = servicos
                        .filter(s => s.cadeia_id === servico.cadeia_id && s.ordem > servico.ordem && !s.confirmado);

                    for (const s of subsequentes) {
                        const novoInicio = new Date(new Date(s.data_inicio).getTime() + diferenca);
                        const novoFim = new Date(new Date(s.data_fim_prevista).getTime() + diferenca);
                        await supabase.from('logistica_servicos').update({
                            data_inicio: novoInicio.toISOString(),
                            data_fim_prevista: novoFim.toISOString(),
                            updated_at: new Date().toISOString()
                        }).eq('id', s.id);
                    }
                }
            }
        }

        showToast('Serviço retomado!', 'success');
        await loadAllData();
        const servicoId = document.getElementById('servico-id').value;
        if (servicoId) renderServicoPausas(servicoId);
    } catch (error) {
        showToast('Erro: ' + error.message, 'error');
    }
};

// ===== UTILIDADES =====
function formatDateBR(date) {
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateShort(date) {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatDateTimeBR(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' +
           d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateInput(date) {
    return date.toISOString().split('T')[0];
}

function getServicoStatusLabel(status) {
    const labels = {
        'pendente': 'Pendente',
        'em_andamento': 'Em Andamento',
        'concluido': 'Concluído',
        'suspenso': 'Suspenso',
        'cancelado': 'Cancelado'
    };
    return labels[status] || status;
}

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ===== EQUIPE GLOBAL DA CADEIA =====
function populateCadeiaIntegranteSelect() {
    const select = document.getElementById('cadeia-add-integrante-global');
    select.innerHTML = '<option value="">Selecionar funcionário...</option>';
    integrantes.forEach(i => {
        select.innerHTML += `<option value="${i.id}">${i.nome}</option>`;
    });
}

function renderCadeiaEquipeGlobal() {
    const container = document.getElementById('cadeia-equipe-global-list');
    const cadeiaId = document.getElementById('cadeia-id').value;
    if (!cadeiaId) {
        container.innerHTML = '<span style="font-size:0.75rem;color:rgba(255,255,255,0.4);">Salve a cadeia primeiro para gerenciar equipe global.</span>';
        return;
    }

    // Buscar todos os integrantes que estão em pelo menos um serviço da cadeia
    const cadeiaServicos = servicos.filter(s => s.cadeia_id === cadeiaId);
    const integrantesNaCadeia = new Map();
    cadeiaServicos.forEach(s => {
        const sAlocs = alocacoes.filter(a => a.servico_id === s.id);
        sAlocs.forEach(a => {
            if (!integrantesNaCadeia.has(a.integrante_id)) {
                integrantesNaCadeia.set(a.integrante_id, 0);
            }
            integrantesNaCadeia.set(a.integrante_id, integrantesNaCadeia.get(a.integrante_id) + 1);
        });
    });

    if (integrantesNaCadeia.size === 0) {
        container.innerHTML = '<span style="font-size:0.75rem;color:rgba(255,255,255,0.4);">Nenhum funcionário alocado na cadeia.</span>';
        return;
    }

    container.innerHTML = Array.from(integrantesNaCadeia.entries()).map(([intId, count]) => {
        const integrante = integrantes.find(i => i.id === intId);
        return `
            <span class="equipe-badge alocado">
                <i class="fas fa-user"></i> ${integrante ? integrante.nome.split(' ')[0] : '?'}
                <small style="opacity:0.6;">(${count}/${cadeiaServicos.length})</small>
            </span>
        `;
    }).join('');
}

window.addIntegranteGlobalCadeia = async function() {
    const integranteId = document.getElementById('cadeia-add-integrante-global').value;
    const cadeiaId = document.getElementById('cadeia-id').value;
    if (!integranteId) {
        showToast('Selecione um funcionário.', 'warning');
        return;
    }
    if (!cadeiaId) {
        showToast('Salve a cadeia primeiro.', 'warning');
        return;
    }

    const cadeiaServicos = servicos.filter(s => s.cadeia_id === cadeiaId).sort((a, b) => a.ordem - b.ordem);
    let adicionados = 0;
    let conflitos = 0;

    for (const servico of cadeiaServicos) {
        // Verificar se já está alocado
        const jaAlocado = alocacoes.find(a => a.servico_id === servico.id && a.integrante_id === integranteId);
        if (jaAlocado) continue;

        // Verificar conflito
        const conflito = checkConflito(integranteId, servico.data_inicio, servico.data_fim_real || servico.data_fim_prevista, servico.id);
        if (conflito) {
            conflitos++;
            continue;
        }

        try {
            await supabase.from('logistica_alocacoes').insert({
                servico_id: servico.id,
                integrante_id: integranteId,
                data_inicio: servico.data_inicio,
                data_fim: servico.data_fim_real || servico.data_fim_prevista
            });
            adicionados++;
        } catch (e) { /* ignore duplicates */ }
    }

    await loadAlocacoes();
    renderCadeiaEquipeGlobal();
    document.getElementById('cadeia-add-integrante-global').value = '';

    if (conflitos > 0) {
        showToast(`Adicionado em ${adicionados} serviço(s). ${conflitos} serviço(s) com conflito de horário.`, 'warning');
    } else {
        showToast(`Funcionário adicionado em ${adicionados} serviço(s)!`, 'success');
    }
};

window.removeIntegranteGlobalCadeia = async function() {
    const integranteId = document.getElementById('cadeia-add-integrante-global').value;
    const cadeiaId = document.getElementById('cadeia-id').value;
    if (!integranteId) {
        showToast('Selecione um funcionário para remover.', 'warning');
        return;
    }
    if (!cadeiaId) {
        showToast('Salve a cadeia primeiro.', 'warning');
        return;
    }

    if (!confirm('Remover este funcionário de TODOS os serviços desta cadeia?')) return;

    const cadeiaServicos = servicos.filter(s => s.cadeia_id === cadeiaId);
    const alocsParaRemover = alocacoes.filter(a => 
        a.integrante_id === integranteId && cadeiaServicos.some(s => s.id === a.servico_id)
    );

    for (const aloc of alocsParaRemover) {
        await supabase.from('logistica_alocacoes').delete().eq('id', aloc.id);
    }

    await loadAlocacoes();
    renderCadeiaEquipeGlobal();
    document.getElementById('cadeia-add-integrante-global').value = '';
    showToast(`Funcionário removido de ${alocsParaRemover.length} serviço(s).`, 'success');
};

// ===== COPIAR EQUIPE DO SERVIÇO ANTERIOR =====
window.copiarEquipeServicoAnterior = async function() {
    const servicoId = document.getElementById('servico-id').value;
    const servico = servicos.find(s => s.id === servicoId);
    if (!servico) return;

    // Encontrar o serviço anterior na cadeia
    const cadeiaServicos = servicos.filter(s => s.cadeia_id === servico.cadeia_id).sort((a, b) => a.ordem - b.ordem);
    const indexAtual = cadeiaServicos.findIndex(s => s.id === servicoId);

    if (indexAtual <= 0) {
        showToast('Este é o primeiro serviço da cadeia, não há serviço anterior.', 'warning');
        return;
    }

    const servicoAnterior = cadeiaServicos[indexAtual - 1];
    const alocsAnterior = alocacoes.filter(a => a.servico_id === servicoAnterior.id);

    if (alocsAnterior.length === 0) {
        showToast('O serviço anterior não tem equipe alocada.', 'warning');
        return;
    }

    let adicionados = 0;
    let conflitos = 0;

    for (const aloc of alocsAnterior) {
        // Verificar se já está alocado neste serviço
        const jaAlocado = alocacoes.find(a => a.servico_id === servicoId && a.integrante_id === aloc.integrante_id);
        if (jaAlocado) continue;

        // Verificar conflito
        const conflito = checkConflito(aloc.integrante_id, servico.data_inicio, servico.data_fim_real || servico.data_fim_prevista, servicoId);
        if (conflito) {
            conflitos++;
            continue;
        }

        try {
            await supabase.from('logistica_alocacoes').insert({
                servico_id: servicoId,
                integrante_id: aloc.integrante_id,
                data_inicio: servico.data_inicio,
                data_fim: servico.data_fim_real || servico.data_fim_prevista
            });
            adicionados++;
        } catch (e) { /* ignore */ }
    }

    await loadAlocacoes();
    renderServicoEquipe(servicoId);

    if (conflitos > 0) {
        showToast(`Copiados ${adicionados} integrante(s). ${conflitos} com conflito de horário.`, 'warning');
    } else {
        showToast(`Equipe do serviço anterior copiada! (${adicionados} integrante(s))`, 'success');
    }
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', function() {
    // Definir data de hoje no simulador
    document.getElementById('simulatedDate').value = formatDateInput(new Date());
    
    // Inicializar o mapa (Google Maps já carregado sincronamente)
    if (typeof google !== 'undefined' && google.maps) {
        initMapInternal();
    } else {
        console.error('Google Maps não carregou. Verifique a chave de API.');
        showToast('Erro ao carregar Google Maps. Verifique a conexão.', 'error');
    }
});

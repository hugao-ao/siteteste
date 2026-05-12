// LOGÍSTICA HVC - Módulo de Planejamento de Obras e Rotas
// =====================================================
// VERSÃO INTEGRADA: Vinculação com Obras, Serviços Contratados, Equipes e Produções Diárias

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
let presencas = []; // NOVO: controle de presença diária
let obras = []; // NOVO: obras do sistema
let equipes = []; // NOVO: equipes cadastradas
let equipesIntegrantes = []; // NOVO: relação equipe-integrantes
let servicosAndamento = []; // NOVO: serviços em andamento nas obras
let itensPropostas = []; // NOVO: itens de propostas (nome/qtd dos serviços)
let servicosHvc = []; // NOVO: catálogo de serviços (nome/unidade)
let currentView = 'dia';
let currentDate = new Date();
let simulatedDate = null;
let selectedLocalId = null;
let mapFilter = 'all';
let selectedFuncionarioFilter = null;
let tempServicos = []; // Serviços temporários no modal de cadeia
let poiHidden = false; // Estado dos POIs do Google Maps

// Estilos do mapa sem POIs
const mapStylesBase = [
    { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] }
];

const mapStylesNoPOI = [
    ...mapStylesBase,
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.medical', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.school', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.sports_complex', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.place_of_worship', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.government', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.attraction', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] }
];

// ===== INICIALIZAÇÃO DO MAPA =====
function initMapInternal() {
    const mapOptions = {
        center: { lat: -22.9068, lng: -43.1729 }, // Rio de Janeiro default
        zoom: 12,
        styles: mapStylesBase,
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
            loadPausas(),
            loadPresencas(),
            loadObras(),
            loadEquipes(),
            loadEquipesIntegrantes(),
            loadServicosAndamento(),
            loadItensPropostas(),
            loadServicosHvc()
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

// NOVO: Carregar presença diária
async function loadPresencas() {
    const { data, error } = await supabase
        .from('logistica_presenca')
        .select('*');
    if (error) { console.warn('Tabela logistica_presenca não encontrada:', error.message); presencas = []; return; }
    presencas = data || [];
}

// NOVO: Carregar obras existentes
async function loadObras() {
    const { data, error } = await supabase
        .from('obras_hvc')
        .select('*')
        .order('nome_obra');
    if (error) throw error;
    obras = data || [];
}

// NOVO: Carregar equipes
async function loadEquipes() {
    const { data, error } = await supabase
        .from('equipes_hvc')
        .select('*')
        .order('numero');
    if (error) throw error;
    equipes = data || [];
}

// NOVO: Carregar relação equipe-integrantes
async function loadEquipesIntegrantes() {
    const { data, error } = await supabase
        .from('equipe_integrantes')
        .select('*');
    if (error) { console.warn('Tabela equipe_integrantes:', error.message); equipesIntegrantes = []; return; }
    equipesIntegrantes = data || [];
}

// NOVO: Carregar serviços em andamento (vinculados às obras)
async function loadServicosAndamento() {
    const { data, error } = await supabase
        .from('servicos_andamento')
        .select('*');
    if (error) throw error;
    servicosAndamento = data || [];
}

// NOVO: Carregar itens de propostas (nome/quantidade dos serviços contratados)
async function loadItensPropostas() {
    const { data, error } = await supabase
        .from('itens_proposta_hvc')
        .select('*');
    if (error) throw error;
    itensPropostas = data || [];
}

// NOVO: Carregar catálogo de serviços (nome/unidade)
async function loadServicosHvc() {
    const { data, error } = await supabase
        .from('servicos_hvc')
        .select('*');
    if (error) throw error;
    servicosHvc = data || [];
}

// ===== MAPA - MARCADORES =====
function updateMapMarkers() {
    // Limpar marcadores existentes
    markers.forEach(m => m.setMap(null));
    markers = [];
    // Limpar rotas
    directionsRenderers.forEach(r => r.setMap(null));
    directionsRenderers = [];

    // Ler filtros de status das checkboxes
    const chkAIniciar = document.getElementById('chk-a-iniciar')?.checked ?? true;
    const chkEmAndamento = document.getElementById('chk-em-andamento')?.checked ?? true;
    const chkFinalizada = document.getElementById('chk-finalizada')?.checked ?? true;
    const chkPendente = document.getElementById('chk-pendente')?.checked ?? true;
    const chkConcluida = document.getElementById('chk-concluida')?.checked ?? true;

    const filteredLocais = locais.filter(l => {
        // Filtro principal (tipo)
        if (mapFilter === 'obras' && l.tipo !== 'obra') return false;
        if (mapFilter === 'visitas' && l.tipo !== 'visita') return false;
        if (mapFilter === 'equipe' || mapFilter === 'rotas') return false;

        // Filtro por status (checkboxes)
        if (l.tipo === 'obra') {
            if (l.status === 'a_iniciar' && !chkAIniciar) return false;
            if (l.status === 'em_andamento' && !chkEmAndamento) return false;
            if (l.status === 'finalizada' && !chkFinalizada) return false;
        } else if (l.tipo === 'visita') {
            if (l.status === 'pendente' && !chkPendente) return false;
            if (l.status === 'concluida' && !chkConcluida) return false;
        }
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
window.updateMapMarkers = updateMapMarkers;

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
    const cadeiasList = cadeias.filter(c => String(c.local_id) === String(local.id));
    // NOVO: Mostrar obra vinculada
    const obraVinculada = local.obra_id ? obras.find(o => String(o.id) === String(local.obra_id)) : null;
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
            ${obraVinculada ? `<br><small><b>Obra:</b> ${obraVinculada.nome_obra || obraVinculada.numero_obra}</small>` : ''}
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
            const servico = servicos.find(s => String(s.id) === String(a.servico_id));
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

                const localAtual = locais.find(l => String(l.id) === String(atual.local_id));
                const localProximo = locais.find(l => String(l.id) === String(proximo.local_id));

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
    if (tab === 'alocacao') {
        populateGanttFilter();
        // Setar período padrão: semana atual
        const ganttInicioEl = document.getElementById('gantt-inicio');
        const ganttFimEl = document.getElementById('gantt-fim');
        if (!ganttInicioEl.value) {
            const hoje = new Date();
            const inicioSemana = new Date(hoje);
            inicioSemana.setDate(hoje.getDate() - hoje.getDay() + 1); // Segunda
            const fimSemana = new Date(inicioSemana);
            fimSemana.setDate(inicioSemana.getDate() + 13); // 2 semanas
            ganttInicioEl.value = formatDateInput(inicioSemana);
            ganttFimEl.value = formatDateInput(fimSemana);
        }
        renderGantt();
    }
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
    const obrasLocais = locais.filter(l => l.tipo === 'obra');
    const visitas = locais.filter(l => l.tipo === 'visita');

    if (obrasLocais.length > 0) {
        html += `<h4 style="color:#ffc107;font-size:0.85rem;margin-bottom:8px;"><i class="fas fa-hard-hat"></i> Obras (${obrasLocais.length})</h4>`;
        obrasLocais.forEach(local => {
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
    const cadeiaCount = cadeias.filter(c => String(c.local_id) === String(local.id)).length;
    // NOVO: Mostrar obra vinculada
    const obraVinculada = local.obra_id ? obras.find(o => String(o.id) === String(local.obra_id)) : null;
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
                ${obraVinculada ? `<br><i class="fas fa-building" style="color:#ffc107;"></i> <span style="color:#ffc107;">${obraVinculada.nome_obra || obraVinculada.numero_obra}</span>` : ''}
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
    const local = locais.find(l => String(l.id) === String(id));
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
            <div class="item-card" style="cursor:pointer;">
                <div class="item-card-header" onclick="openFuncionarioModal('${integrante.id}')">
                    <span class="item-card-title"><i class="fas fa-user"></i> ${integrante.nome}</span>
                    ${statusBadge}
                </div>
                ${servicosHoje.length > 0 ? `
                    <div class="item-card-info" onclick="openFuncionarioModal('${integrante.id}')">
                        ${servicosHoje.map(s => {
                            const cadeia = cadeias.find(c => String(c.id) === String(s.cadeia_id));
                            const local = cadeia ? locais.find(l => String(l.id) === String(cadeia.local_id)) : null;
                            return `<div style="margin-top:3px;"><i class="fas fa-wrench"></i> ${s.nome} ${local ? '@ ' + local.nome : ''}</div>`;
                        }).join('')}
                    </div>
                ` : '<div class="item-card-info" onclick="openFuncionarioModal(\''+integrante.id+'\')"}>Sem serviços para a data selecionada</div>'}
                <div style="display:flex;gap:5px;margin-top:5px;">
                    <button class="btn btn-sm" style="background:rgba(33,150,243,0.3);color:white;font-size:0.65rem;" onclick="filterByFuncionario('${integrante.id}')">
                        <i class="fas fa-filter"></i> Filtrar no Mapa
                    </button>
                    <button class="btn btn-sm" style="background:rgba(76,175,80,0.3);color:white;font-size:0.65rem;" onclick="openFuncionarioModal('${integrante.id}')">
                        <i class="fas fa-edit"></i> Gerenciar
                    </button>
                </div>
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
        if (String(a.integrante_id) !== String(integranteId)) return false;
        const aInicio = new Date(a.data_inicio);
        const aFim = new Date(a.data_fim);
        return aInicio <= dayEnd && aFim >= dayStart;
    });

    return alocacoesIntegrante.map(a => {
        return servicos.find(s => String(s.id) === String(a.servico_id));
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
            .filter(a => String(a.integrante_id) === String(selectedFuncionarioFilter))
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
        const local = locais.find(l => String(l.id) === String(servico.local_id));
        const cadeia = cadeias.find(c => String(c.id) === String(servico.cadeia_id));
        const servicoAlocacoes = alocacoes.filter(a => String(a.servico_id) === String(servico.id));
        const equipeNomes = servicoAlocacoes.map(a => {
            const i = integrantes.find(int => int.id === a.integrante_id);
            return i ? i.nome.split(' ')[0] : '?';
        }).join(', ');

        const inicio = new Date(servico.data_inicio);
        const fim = new Date(servico.data_fim_real || servico.data_fim_prevista);
        const pausaAtiva = pausas.find(p => p.servico_id === servico.id && p.status === 'ativa');

        // NOVO: Mostrar etapa se existir
        const etapaLabel = servico.etapa ? `<span style="background:rgba(156,39,176,0.3);color:#ce93d8;padding:1px 5px;border-radius:8px;font-size:0.6rem;">Etapa ${servico.etapa}</span>` : '';

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
                        ${etapaLabel}
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
            const servicoIds = alocacoes.filter(a => String(a.integrante_id) === String(selectedFuncionarioFilter)).map(a => a.servico_id);
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
                    const local = locais.find(l => String(l.id) === String(s.local_id));
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
            const servicoIds = alocacoes.filter(a => String(a.integrante_id) === String(selectedFuncionarioFilter)).map(a => a.servico_id);
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
            const servico = servicos.find(s => String(s.id) === String(a.servico_id));
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
                const localAtual = locais.find(l => String(l.id) === String(atual.local_id));
                const localProximo = locais.find(l => String(l.id) === String(proximo.local_id));
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
};

window.closeModal = function(type) {
    document.getElementById(`modal-${type}`).classList.remove('active');
    // Resetar formulários ao fechar para evitar confusão entre novo e edição
    if (type === 'local') resetFormLocal();
    if (type === 'cadeia') resetFormCadeia();
};

// Funções dedicadas para NOVO (sempre limpam o formulário)
window.openNewLocal = function() {
    resetFormLocal();
    populateObraSelect();
    openModal('local');
};

window.openNewCadeia = function() {
    resetFormCadeia();
    populateCadeiaLocalSelect();
    populateCadeiaIntegranteSelect();
    populateCadeiaEquipeSelect();
    renderCadeiaEquipeGlobal();
    openModal('cadeia');
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

// NOVO: Popular select de obras para vincular ao local
function populateObraSelect() {
    const select = document.getElementById('local-obra');
    if (!select) return;
    select.innerHTML = '<option value="">Nenhuma (não vincular)</option>';
    obras.forEach(o => {
        const nome = o.nome_obra || o.numero_obra || 'Sem nome';
        select.innerHTML += `<option value="${o.id}">${nome}</option>`;
    });
}

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
        obra_id: document.getElementById('local-obra')?.value || null, // NOVO: vinculação com obra
        updated_at: new Date().toISOString()
    };

    try {
        if (id) {
            // Confirmar edição para evitar alterações acidentais
            const localOriginal = locais.find(l => String(l.id) === String(id));
            if (!confirm(`Confirma a EDIÇÃO do local "${localOriginal ? localOriginal.nome : ''}"?`)) return;
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
    const local = locais.find(l => String(l.id) === String(id));
    if (!local) return;

    populateObraSelect();
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
    if (document.getElementById('local-obra')) {
        document.getElementById('local-obra').value = local.obra_id || '';
    }
    document.getElementById('modal-local-title').innerHTML = '<i class="fas fa-edit"></i> Editando: ' + local.nome;
    document.getElementById('btn-salvar-local').innerHTML = '<i class="fas fa-save"></i> Salvar Edição';
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
    const btnLocal = document.getElementById('btn-salvar-local');
    if (btnLocal) btnLocal.innerHTML = '<i class="fas fa-plus"></i> Criar Novo';
}

// ===== DETALHES DO LOCAL =====
window.openLocalDetalhes = function(id) {
    const local = locais.find(l => String(l.id) === String(id));
    if (!local) return;

    const localCadeias = cadeias.filter(c => String(c.local_id) === String(id));
    // NOVO: Mostrar obra vinculada
    const obraVinculada = local.obra_id ? obras.find(o => String(o.id) === String(local.obra_id)) : null;

    let html = `
        <div style="margin-bottom:15px;">
            <p><b>Tipo:</b> ${local.tipo === 'obra' ? 'Obra' : 'Visita'} | <b>Status:</b> ${getStatusLabel(local)}</p>
            <p><b>Endereço:</b> ${local.endereco || 'Não informado'}</p>
            ${local.cliente_nome ? `<p><b>Cliente:</b> ${local.cliente_nome}</p>` : ''}
            ${obraVinculada ? `<p><b><i class="fas fa-building" style="color:#ffc107;"></i> Obra Vinculada:</b> <span style="color:#ffc107;">${obraVinculada.nome_obra || obraVinculada.numero_obra}</span></p>` : ''}
            ${local.observacoes ? `<p><b>Obs:</b> ${local.observacoes}</p>` : ''}
        </div>
    `;

    // NOVO: Botão para gerar produção
    if (obraVinculada) {
        html += `
            <div style="margin-bottom:15px;padding:10px;background:rgba(76,175,80,0.1);border:1px solid rgba(76,175,80,0.3);border-radius:8px;">
                <button class="btn btn-primary" onclick="openGerarProducao('${local.id}')">
                    <i class="fas fa-clipboard-check"></i> Gerar Produção Diária
                </button>
                <p style="font-size:0.7rem;color:rgba(255,255,255,0.5);margin-top:5px;">Gerar registros de produção a partir dos serviços logísticos</p>
            </div>
        `;
    }

    if (localCadeias.length > 0) {
        html += `<h4 style="color:#ffc107;margin-bottom:10px;"><i class="fas fa-link"></i> Cadeias de Serviços</h4>`;
        localCadeias.forEach(cadeia => {
            const cadeiaServicos = servicos.filter(s => String(s.cadeia_id) === String(cadeia.id)).sort((a, b) => (a.etapa || a.ordem) - (b.etapa || b.ordem) || a.ordem - b.ordem);
            html += `
                <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:12px;margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <span style="font-weight:700;color:#add8e6;">${cadeia.nome}</span>
                        <div>
                            <button class="btn btn-secondary btn-sm" onclick="editCadeia('${cadeia.id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-danger btn-sm" onclick="deleteCadeia('${cadeia.id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    ${cadeia.descricao ? `<p style="font-size:0.75rem;color:rgba(255,255,255,0.5);margin-bottom:8px;">${cadeia.descricao}</p>` : ''}
                    <div class="cadeia-visual">
            `;

            // Agrupar por etapa
            const etapas = {};
            cadeiaServicos.forEach(s => {
                const etapa = s.etapa || s.ordem;
                if (!etapas[etapa]) etapas[etapa] = [];
                etapas[etapa].push(s);
            });

            Object.keys(etapas).sort((a, b) => a - b).forEach(etapaNum => {
                const servicosEtapa = etapas[etapaNum];
                const isSimultaneo = servicosEtapa.length > 1;
                
                if (isSimultaneo) {
                    html += `<div style="border:1px dashed rgba(156,39,176,0.4);border-radius:6px;padding:6px;margin-bottom:4px;background:rgba(156,39,176,0.05);">
                        <small style="color:#ce93d8;font-size:0.6rem;">Etapa ${etapaNum} (simultâneos)</small>`;
                }

                servicosEtapa.forEach(s => {
                    const servicoAlocs = alocacoes.filter(a => String(a.servico_id) === String(s.id));
                    const equipeNomes = servicoAlocs.map(a => {
                        const i = integrantes.find(int => int.id === a.integrante_id);
                        return i ? i.nome.split(' ')[0] : '?';
                    }).join(', ');

                    html += `
                        <div class="servico-chain-item" onclick="openServicoEdit('${s.id}')" style="cursor:pointer;">
                            <div class="servico-chain-order">${s.ordem}</div>
                            <div style="flex:1;">
                                <div style="font-weight:600;font-size:0.8rem;">${s.nome}</div>
                                <div style="font-size:0.65rem;color:rgba(255,255,255,0.5);">
                                    ${formatDateTimeBR(s.data_inicio)} → ${formatDateTimeBR(s.data_fim_real || s.data_fim_prevista)}
                                </div>
                                ${equipeNomes ? `<div style="font-size:0.65rem;color:rgba(255,255,255,0.4);"><i class="fas fa-users"></i> ${equipeNomes}</div>` : ''}
                            </div>
                            <span class="timeline-badge status-${s.status}" style="font-size:0.6rem;">${getServicoStatusLabel(s.status)}</span>
                        </div>
                    `;
                });

                if (isSimultaneo) {
                    html += `</div>`;
                }
            });

            html += `</div></div>`;
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
        const obraVinculada = l.obra_id ? obras.find(o => String(o.id) === String(l.obra_id)) : null;
        const suffix = obraVinculada ? ` (${obraVinculada.nome_obra || obraVinculada.numero_obra})` : '';
        select.innerHTML += `<option value="${l.id}">${l.nome}${suffix}</option>`;
    });
}

// NOVO: Quando seleciona um local na cadeia, carregar serviços contratados da obra vinculada
window.onCadeiaLocalChange = function() {
    const localId = document.getElementById('cadeia-local').value;
    const local = locais.find(l => String(l.id) === String(localId));
    const container = document.getElementById('servicos-obra-disponiveis');
    
    if (!local || !local.obra_id) {
        if (container) container.style.display = 'none';
        return;
    }

    // Buscar serviços contratados desta obra
    const obraServicos = getServicosContratadosObra(local.obra_id);
    
    if (obraServicos.length > 0 && container) {
        container.style.display = 'block';
        container.innerHTML = `
            <label style="font-size:0.8rem;font-weight:700;color:#4caf50;margin-bottom:8px;display:block;">
                <i class="fas fa-clipboard-list"></i> Serviços Contratados na Obra (clique para adicionar à cadeia)
            </label>
            <div style="display:flex;flex-wrap:wrap;gap:5px;">
                ${obraServicos.map(s => `
                    <button type="button" class="btn btn-sm" style="background:rgba(76,175,80,0.2);border:1px solid rgba(76,175,80,0.4);color:#4caf50;font-size:0.7rem;" 
                        onclick="addServicoObraCadeia('${s.servico_andamento_id}','${s.item_proposta_id}','${escapeHtml(s.nome)}','${s.unidade}',${s.quantidade})">
                        <i class="fas fa-plus"></i> ${s.nome} (${s.quantidade} ${s.unidade})
                    </button>
                `).join('')}
            </div>
        `;
    }
};

// NOVO: Obter serviços contratados de uma obra
function getServicosContratadosObra(obraId) {
    const result = [];
    const obraServAndamento = servicosAndamento.filter(sa => String(sa.obra_id) === String(obraId));
    
    obraServAndamento.forEach(sa => {
        const itemProposta = itensPropostas.find(ip => String(ip.id) === String(sa.item_proposta_id));
        if (itemProposta) {
            const servicoCatalogo = servicosHvc.find(sh => String(sh.id) === String(itemProposta.servico_id));
            if (servicoCatalogo) {
                result.push({
                    servico_andamento_id: sa.id,
                    item_proposta_id: itemProposta.id,
                    nome: servicoCatalogo.descricao,
                    unidade: servicoCatalogo.unidade || 'un',
                    quantidade: itemProposta.quantidade || 0,
                    servico_hvc_id: servicoCatalogo.id
                });
            }
        }
    });
    
    return result;
}

// NOVO: Adicionar serviço da obra à cadeia (com dados pré-preenchidos)
window.addServicoObraCadeia = function(servicoAndamentoId, itemPropostaId, nome, unidade, quantidade) {
    const ordem = tempServicos.length + 1;
    const now = new Date();
    const defaultInicio = tempServicos.length > 0
        ? tempServicos[tempServicos.length - 1].data_fim_prevista
        : now.toISOString().slice(0, 16);

    const defaultFim = new Date(new Date(defaultInicio).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

    tempServicos.push({
        tempId: Date.now() + Math.random(),
        nome: nome,
        descricao: `${quantidade} ${unidade}`,
        ordem: ordem,
        etapa: ordem, // Por padrão cada serviço é uma etapa separada
        data_inicio: defaultInicio,
        data_fim_prevista: defaultFim,
        servico_andamento_id: servicoAndamentoId,
        item_proposta_id: itemPropostaId,
        quantidade: quantidade,
        unidade: unidade
    });
    renderTempServicos();
    showToast(`"${nome}" adicionado à cadeia!`, 'success');
};

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
        etapa: ordem,
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
                    <input type="number" value="${s.etapa || index + 1}" placeholder="Etapa" title="Etapa (mesma etapa = simultâneos)"
                        onchange="updateTempServico(${index}, 'etapa', parseInt(this.value))"
                        style="width:55px;padding:6px;border-radius:4px;background:rgba(156,39,176,0.2);border:1px solid rgba(156,39,176,0.4);color:#ce93d8;font-size:0.8rem;text-align:center;">
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
                ${s.servico_andamento_id ? `<div style="font-size:0.6rem;color:#4caf50;margin-top:4px;"><i class="fas fa-link"></i> Vinculado ao serviço da obra (${s.quantidade || 0} ${s.unidade || 'un'})</div>` : ''}
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
            // MODO EDIÇÃO: atualizar cadeia e serviços SEM perder alocações
            const cadeiaOriginal = cadeias.find(c => String(c.id) === String(cadeiaId));
            if (!confirm(`Confirma a EDIÇÃO da cadeia "${cadeiaOriginal ? cadeiaOriginal.nome : ''}"?`)) return;
            const { error } = await supabase.from('logistica_cadeias').update({
                nome, descricao, local_id: localId, updated_at: new Date().toISOString()
            }).eq('id', cadeiaId);
            if (error) throw error;
            savedCadeiaId = cadeiaId;

            // Pegar IDs dos serviços existentes no banco para esta cadeia
            const servicosExistentes = servicos.filter(s => String(s.cadeia_id) === String(cadeiaId));
            const idsExistentes = servicosExistentes.map(s => String(s.id));

            // Separar serviços em: atualizar (têm tempId que é um ID real do banco) vs criar (novos)
            const paraAtualizar = [];
            const paraCriar = [];
            const idsUsados = [];

            tempServicos.forEach((s, i) => {
                if (s.tempId && idsExistentes.includes(String(s.tempId))) {
                    // Serviço existente: fazer UPDATE (preserva ID e alocações)
                    paraAtualizar.push({ ...s, ordem: i + 1 });
                    idsUsados.push(String(s.tempId));
                } else {
                    // Serviço novo: fazer INSERT
                    paraCriar.push({ ...s, ordem: i + 1 });
                }
            });

            // Deletar APENAS serviços que foram removidos pelo usuário no modal
            const idsParaDeletar = idsExistentes.filter(id => !idsUsados.includes(id));
            for (const delId of idsParaDeletar) {
                await supabase.from('logistica_alocacoes').delete().eq('servico_id', delId);
                await supabase.from('logistica_servicos').delete().eq('id', delId);
            }

            // Atualizar serviços existentes (preserva o ID e TODAS as alocações)
            for (const s of paraAtualizar) {
                await supabase.from('logistica_servicos').update({
                    nome: s.nome,
                    descricao: s.descricao || null,
                    ordem: s.ordem,
                    etapa: s.etapa || s.ordem,
                    data_inicio: new Date(s.data_inicio).toISOString(),
                    data_fim_prevista: new Date(s.data_fim_prevista).toISOString(),
                    local_id: localId,
                    servico_andamento_id: s.servico_andamento_id || null,
                    item_proposta_id: s.item_proposta_id || null
                }).eq('id', s.tempId);

                // Atualizar datas das alocações para acompanhar mudanças de data do serviço
                await supabase.from('logistica_alocacoes').update({
                    data_inicio: new Date(s.data_inicio).toISOString(),
                    data_fim: new Date(s.data_fim_prevista).toISOString()
                }).eq('servico_id', s.tempId);
            }

            // Inserir serviços novos (adicionados pelo usuário no modal)
            if (paraCriar.length > 0) {
                const novosData = paraCriar.map(s => ({
                    cadeia_id: savedCadeiaId,
                    local_id: localId,
                    nome: s.nome,
                    descricao: s.descricao || null,
                    ordem: s.ordem,
                    etapa: s.etapa || s.ordem,
                    data_inicio: new Date(s.data_inicio).toISOString(),
                    data_fim_prevista: new Date(s.data_fim_prevista).toISOString(),
                    status: 'pendente',
                    servico_andamento_id: s.servico_andamento_id || null,
                    item_proposta_id: s.item_proposta_id || null
                }));
                const { error: insError } = await supabase.from('logistica_servicos').insert(novosData);
                if (insError) throw insError;
            }

        } else {
            // MODO CRIAÇÃO: inserir cadeia e serviços novos
            const { data, error } = await supabase.from('logistica_cadeias').insert({
                nome, descricao, local_id: localId, status: 'ativa'
            }).select().single();
            if (error) throw error;
            savedCadeiaId = data.id;

            const servicosData = tempServicos.map((s, i) => ({
                cadeia_id: savedCadeiaId,
                local_id: localId,
                nome: s.nome,
                descricao: s.descricao || null,
                ordem: i + 1,
                etapa: s.etapa || (i + 1),
                data_inicio: new Date(s.data_inicio).toISOString(),
                data_fim_prevista: new Date(s.data_fim_prevista).toISOString(),
                status: 'pendente',
                servico_andamento_id: s.servico_andamento_id || null,
                item_proposta_id: s.item_proposta_id || null
            }));

            const { error: sError } = await supabase.from('logistica_servicos').insert(servicosData);
            if (sError) throw sError;
        }

        showToast('Cadeia de serviços salva com sucesso!', 'success');
        await loadAllData();

        // Se era criação nova, reabrir em modo edição para permitir alocação de equipe
        if (!cadeiaId) {
            closeModal('cadeia');
            setTimeout(() => { window.editCadeia(savedCadeiaId); }, 300);
            showToast('Cadeia criada! Agora você pode alocar funcionários e equipes.', 'info');
        } else {
            closeModal('cadeia');
            resetFormCadeia();
        }
    } catch (error) {
        console.error('Erro ao salvar cadeia:', error);
        showToast('Erro ao salvar: ' + error.message, 'error');
    }
};

window.editCadeia = async function(id) {
    const cadeia = cadeias.find(c => String(c.id) === String(id));
    if (!cadeia) return;

    closeModal('local-detalhes');
    
    // Popular o select de locais ANTES de setar o valor
    populateCadeiaLocalSelect();
    
    document.getElementById('cadeia-id').value = cadeia.id;
    document.getElementById('cadeia-nome').value = cadeia.nome;
    document.getElementById('cadeia-descricao').value = cadeia.descricao || '';
    document.getElementById('modal-cadeia-title').innerHTML = '<i class="fas fa-edit"></i> Editando: ' + cadeia.nome;
    document.getElementById('btn-salvar-cadeia').innerHTML = '<i class="fas fa-save"></i> Salvar Edição';
    
    // Setar o local DEPOIS de popular o select
    document.getElementById('cadeia-local').value = cadeia.local_id;

    // Disparar carregamento de serviços da obra
    onCadeiaLocalChange();

    // Carregar serviços existentes com datas convertidas para local timezone
    tempServicos = servicos.filter(s => String(s.cadeia_id) === String(id)).sort((a, b) => a.ordem - b.ordem).map(s => ({
        tempId: s.id,
        nome: s.nome,
        descricao: s.descricao || '',
        ordem: s.ordem,
        etapa: s.etapa || s.ordem,
        data_inicio: toLocalDatetimeInput(s.data_inicio),
        data_fim_prevista: toLocalDatetimeInput(s.data_fim_prevista),
        servico_andamento_id: s.servico_andamento_id || null,
        item_proposta_id: s.item_proposta_id || null
    }));

    renderTempServicos();
    populateCadeiaIntegranteSelect();
    populateCadeiaEquipeSelect();
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
    const btnCadeia = document.getElementById('btn-salvar-cadeia');
    if (btnCadeia) btnCadeia.innerHTML = '<i class="fas fa-plus"></i> Criar Nova Cadeia';
    tempServicos = [];
    renderTempServicos();
    const container = document.getElementById('servicos-obra-disponiveis');
    if (container) container.style.display = 'none';
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
    document.getElementById('servico-inicio').value = toLocalDatetimeInput(servico.data_inicio);
    document.getElementById('servico-fim-previsto').value = toLocalDatetimeInput(servico.data_fim_prevista);
    document.getElementById('servico-fim-real').value = toLocalDatetimeInput(servico.data_fim_real);
    document.getElementById('servico-status').value = servico.status;

    // Carregar equipe alocada
    renderServicoEquipe(id);
    // Carregar pausas
    renderServicoPausas(id);
    // Carregar presença
    renderServicoPresenca(id);
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
    document.getElementById('servico-inicio').value = toLocalDatetimeInput(servico.data_inicio);
    document.getElementById('servico-fim-previsto').value = toLocalDatetimeInput(servico.data_fim_prevista);
    document.getElementById('servico-fim-real').value = toLocalDatetimeInput(servico.data_fim_real);
    document.getElementById('servico-status').value = servico.status;

    renderServicoEquipe(id);
    renderServicoPausas(id);
    renderServicoPresenca(id);
    populateIntegranteSelect();

    // Fechar modal cadeia e abrir modal serviço
    closeModal('cadeia');
    openModal('servico');
};

function renderServicoEquipe(servicoId) {
    const container = document.getElementById('servico-equipe-list');
    const servicoAlocs = alocacoes.filter(a => String(a.servico_id) === String(servicoId));

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

// NOVO: Renderizar controle de presença por dia
function renderServicoPresenca(servicoId) {
    const container = document.getElementById('servico-presenca-section');
    if (!container) return;

    const servico = servicos.find(s => s.id === servicoId);
    if (!servico) return;

    const servicoAlocs = alocacoes.filter(a => String(a.servico_id) === String(servicoId));
    if (servicoAlocs.length === 0) {
        container.innerHTML = '<p style="font-size:0.75rem;color:rgba(255,255,255,0.4);">Aloque funcionários primeiro para gerenciar presença.</p>';
        return;
    }

    const inicio = new Date(servico.data_inicio);
    const fim = new Date(servico.data_fim_real || servico.data_fim_prevista);
    const dias = [];
    const current = new Date(inicio);
    current.setHours(0, 0, 0, 0);
    const fimDate = new Date(fim);
    fimDate.setHours(23, 59, 59, 999);
    
    while (current <= fimDate && dias.length <= 30) {
        dias.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }

    if (dias.length === 0) {
        container.innerHTML = '<p style="font-size:0.75rem;color:rgba(255,255,255,0.4);">Período inválido.</p>';
        return;
    }

    let html = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.7rem;">
        <thead><tr>
            <th style="text-align:left;padding:4px;border-bottom:1px solid rgba(255,255,255,0.2);color:#add8e6;">Integrante</th>`;
    
    dias.forEach(d => {
        html += `<th style="text-align:center;padding:4px;border-bottom:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.6);min-width:40px;">${d.getDate()}/${d.getMonth()+1}</th>`;
    });
    html += `</tr></thead><tbody>`;

    servicoAlocs.forEach(aloc => {
        const integrante = integrantes.find(i => i.id === aloc.integrante_id);
        html += `<tr><td style="padding:4px;border-bottom:1px solid rgba(255,255,255,0.05);color:white;">${integrante ? integrante.nome.split(' ')[0] : '?'}</td>`;
        
        dias.forEach(d => {
            const dateStr = d.toISOString().split('T')[0];
            const presenca = presencas.find(p => 
                String(p.alocacao_id) === String(aloc.id) && 
                String(p.integrante_id) === String(aloc.integrante_id) && 
                p.data === dateStr
            );
            const isAusente = presenca && !presenca.presente;
            const bgColor = isAusente ? 'rgba(244,67,54,0.3)' : 'rgba(76,175,80,0.2)';
            const icon = isAusente ? '✖' : '✔';
            
            html += `<td style="text-align:center;padding:4px;border-bottom:1px solid rgba(255,255,255,0.05);background:${bgColor};cursor:pointer;" 
                onclick="togglePresenca('${aloc.id}','${aloc.integrante_id}','${dateStr}',${!isAusente})">${icon}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table></div>
        <p style="font-size:0.6rem;color:rgba(255,255,255,0.4);margin-top:5px;">
            <span style="color:#4caf50;">✔</span> Presente | <span style="color:#f44336;">✖</span> Ausente — Clique para alternar
        </p>`;
    
    container.innerHTML = html;
}

// NOVO: Alternar presença de um integrante em um dia
window.togglePresenca = async function(alocacaoId, integranteId, dateStr, marcarAusente) {
    try {
        // Verificar se já existe registro
        const existente = presencas.find(p => 
            String(p.alocacao_id) === String(alocacaoId) && 
            String(p.integrante_id) === String(integranteId) && 
            p.data === dateStr
        );

        if (existente) {
            if (marcarAusente) {
                // Marcar como ausente
                await supabase.from('logistica_presenca').update({ presente: false, updated_at: new Date().toISOString() }).eq('id', existente.id);
            } else {
                // Marcar como presente (deletar o registro de ausência)
                await supabase.from('logistica_presenca').update({ presente: true, updated_at: new Date().toISOString() }).eq('id', existente.id);
            }
        } else {
            // Criar registro
            await supabase.from('logistica_presenca').insert({
                alocacao_id: alocacaoId,
                integrante_id: integranteId,
                data: dateStr,
                presente: !marcarAusente
            });
        }

        await loadPresencas();
        const servicoId = document.getElementById('servico-id').value;
        renderServicoPresenca(servicoId);
        showToast(marcarAusente ? 'Marcado como ausente' : 'Marcado como presente', 'success');
    } catch (error) {
        showToast('Erro: ' + error.message, 'error');
    }
};

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
        renderServicoPresenca(servicoId);
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

// NOVO: Alocar equipe inteira de uma vez
window.addEquipeInteira = async function() {
    const equipeId = document.getElementById('servico-add-equipe')?.value;
    const servicoId = document.getElementById('servico-id').value;
    if (!equipeId) {
        showToast('Selecione uma equipe.', 'warning');
        return;
    }

    const servico = servicos.find(s => s.id === servicoId);
    if (!servico) return;

    // Buscar integrantes da equipe
    const membros = equipesIntegrantes.filter(ei => String(ei.equipe_id) === String(equipeId));
    if (membros.length === 0) {
        showToast('Esta equipe não tem integrantes ativos.', 'warning');
        return;
    }

    let adicionados = 0;
    let conflitos = 0;

    for (const membro of membros) {
        // Verificar se já está alocado
        const jaAlocado = alocacoes.find(a => String(a.servico_id) === String(servicoId) && String(a.integrante_id) === String(membro.integrante_id));
        if (jaAlocado) continue;

        // Verificar conflito
        const conflito = checkConflito(membro.integrante_id, servico.data_inicio, servico.data_fim_real || servico.data_fim_prevista, servicoId);
        if (conflito) {
            conflitos++;
            continue;
        }

        try {
            await supabase.from('logistica_alocacoes').insert({
                servico_id: servicoId,
                integrante_id: membro.integrante_id,
                equipe_id: equipeId,
                data_inicio: servico.data_inicio,
                data_fim: servico.data_fim_real || servico.data_fim_prevista
            });
            adicionados++;
        } catch (e) { /* ignore duplicates */ }
    }

    await loadAlocacoes();
    renderServicoEquipe(servicoId);
    renderServicoPresenca(servicoId);

    if (conflitos > 0) {
        showToast(`${adicionados} integrante(s) alocado(s). ${conflitos} com conflito.`, 'warning');
    } else {
        showToast(`Equipe inteira alocada! (${adicionados} integrante(s))`, 'success');
    }
};

function checkConflito(integranteId, inicio, fim, excludeServicoId) {
    const novoInicio = new Date(inicio);
    const novoFim = new Date(fim);

    const alocacoesIntegrante = alocacoes.filter(a =>
        String(a.integrante_id) === String(integranteId) && String(a.servico_id) !== String(excludeServicoId)
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
        renderServicoPresenca(servicoId);
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
        const servicoAlocs = alocacoes.filter(a => String(a.servico_id) === String(id));
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

// ===== CONFIRMAR FIM DO SERVIÇO (com reajuste automático da cadeia por ETAPA) =====
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

        // NOVO: Verificar se todos os serviços da mesma etapa estão concluídos
        const cadeiaServicos = servicos.filter(s => String(s.cadeia_id) === String(servico.cadeia_id));
        const servicosMesmaEtapa = cadeiaServicos.filter(s => s.etapa === servico.etapa && s.id !== servicoId);
        const todosEtapaConcluidos = servicosMesmaEtapa.every(s => s.status === 'concluido' || s.confirmado);

        // Só reajustar serviços subsequentes se TODOS da etapa atual estão concluídos
        if (todosEtapaConcluidos && diferenca !== 0) {
            const servicosPosteriores = cadeiaServicos
                .filter(s => (s.etapa || s.ordem) > (servico.etapa || servico.ordem) && !s.confirmado)
                .sort((a, b) => (a.etapa || a.ordem) - (b.etapa || b.ordem));

            for (const s of servicosPosteriores) {
                const novoInicio = new Date(new Date(s.data_inicio).getTime() + diferenca);
                const novoFim = new Date(new Date(s.data_fim_prevista).getTime() + diferenca);

                await supabase.from('logistica_servicos').update({
                    data_inicio: novoInicio.toISOString(),
                    data_fim_prevista: novoFim.toISOString(),
                    updated_at: new Date().toISOString()
                }).eq('id', s.id);

                // Atualizar alocações correspondentes
                const sAlocs = alocacoes.filter(a => String(a.servico_id) === String(s.id));
                for (const aloc of sAlocs) {
                    await supabase.from('logistica_alocacoes').update({
                        data_inicio: novoInicio.toISOString(),
                        data_fim: novoFim.toISOString()
                    }).eq('id', aloc.id);
                }
            }

            const dias = Math.round(diferenca / (24 * 60 * 60 * 1000));
            if (dias > 0) {
                showToast(`Serviço concluído! ${servicosPosteriores.length} serviço(s) subsequente(s) adiado(s) em ${dias} dia(s).`, 'warning');
            } else if (dias < 0) {
                showToast(`Serviço concluído antecipadamente! ${servicosPosteriores.length} serviço(s) subsequente(s) antecipado(s) em ${Math.abs(dias)} dia(s).`, 'success');
            }
        } else if (!todosEtapaConcluidos) {
            showToast('Serviço concluído! Aguardando conclusão dos outros serviços da mesma etapa para reajustar a cadeia.', 'success');
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
        const { error } = await supabase.from('logistica_pausas').insert({
            servico_id: servicoId,
            motivo: motivo,
            data_pausa: new Date().toISOString(),
            previsao_retomada: previsao ? new Date(previsao).toISOString() : null,
            sem_previsao: semPrevisao,
            status: 'ativa'
        });
        if (error) throw error;

        // Atualizar status do serviço para suspenso
        await supabase.from('logistica_servicos').update({ status: 'suspenso', updated_at: new Date().toISOString() }).eq('id', servicoId);

        showToast('Pausa registrada!', 'success');
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

        // Voltar status do serviço para em_andamento
        await supabase.from('logistica_servicos').update({ status: 'em_andamento', updated_at: new Date().toISOString() }).eq('id', pausa.servico_id);

        showToast('Serviço retomado!', 'success');
        await loadAllData();
        renderServicoPausas(pausa.servico_id);
    } catch (error) {
        showToast('Erro: ' + error.message, 'error');
    }
};

// ===== EQUIPE GLOBAL DA CADEIA =====
// ===== MULTI-SELEÇÃO DE FUNCIONÁRIOS E EQUIPES =====
let selectedIntegrantes = new Set();
let selectedEquipes = new Set();

function populateCadeiaIntegranteSelect() {
    const container = document.getElementById('multi-integ-options');
    if (!container) return;
    selectedIntegrantes.clear();
    container.innerHTML = integrantes.map(i => `
        <label class="multi-select-option" data-nome="${i.nome.toLowerCase()}" data-id="${i.id}">
            <input type="checkbox" value="${i.id}" onchange="toggleIntegranteSelection(this)">
            <span>${i.nome}</span>
        </label>
    `).join('');
    updateMultiIntegLabel();
}

function populateCadeiaEquipeSelect() {
    const container = document.getElementById('multi-equipe-options');
    if (!container) return;
    selectedEquipes.clear();
    container.innerHTML = equipes.map(e => {
        const membros = equipesIntegrantes.filter(ei => String(ei.equipe_id) === String(e.id));
        const label = `Equipe ${e.numero || '?'}${e.observacoes ? ' - ' + e.observacoes : ''} (${membros.length} membros)`;
        return `
            <label class="multi-select-option" data-id="${e.id}">
                <input type="checkbox" value="${e.id}" onchange="toggleEquipeSelection(this)">
                <span>${label}</span>
            </label>
        `;
    }).join('');
    updateMultiEquipeLabel();
}

window.toggleMultiSelect = function(type) {
    const dropdown = document.getElementById(type === 'integrantes' ? 'multi-integ-dropdown' : 'multi-equipe-dropdown');
    const isVisible = dropdown.style.display !== 'none';
    // Fechar todos os dropdowns abertos
    document.querySelectorAll('.multi-select-dropdown').forEach(d => d.style.display = 'none');
    if (!isVisible) {
        dropdown.style.display = 'block';
        if (type === 'integrantes') {
            const search = document.getElementById('multi-integ-search');
            if (search) setTimeout(() => search.focus(), 50);
        }
    }
};

window.filterMultiSelect = function(type) {
    const search = document.getElementById('multi-integ-search').value.toLowerCase();
    document.querySelectorAll('#multi-integ-options .multi-select-option').forEach(opt => {
        const nome = opt.dataset.nome || '';
        opt.style.display = nome.includes(search) ? '' : 'none';
    });
};

window.toggleIntegranteSelection = function(checkbox) {
    const id = checkbox.value;
    if (checkbox.checked) {
        selectedIntegrantes.add(id);
        checkbox.closest('.multi-select-option').classList.add('checked');
    } else {
        selectedIntegrantes.delete(id);
        checkbox.closest('.multi-select-option').classList.remove('checked');
    }
    updateMultiIntegLabel();
};

window.toggleEquipeSelection = function(checkbox) {
    const id = checkbox.value;
    if (checkbox.checked) {
        selectedEquipes.add(id);
        checkbox.closest('.multi-select-option').classList.add('checked');
    } else {
        selectedEquipes.delete(id);
        checkbox.closest('.multi-select-option').classList.remove('checked');
    }
    updateMultiEquipeLabel();
};

function updateMultiIntegLabel() {
    const label = document.getElementById('multi-integ-label');
    if (!label) return;
    if (selectedIntegrantes.size === 0) {
        label.textContent = 'Selecionar funcionários...';
    } else {
        const nomes = Array.from(selectedIntegrantes).map(id => {
            const i = integrantes.find(ig => String(ig.id) === String(id));
            return i ? i.nome.split(' ')[0] : '?';
        });
        label.textContent = nomes.length <= 3 ? nomes.join(', ') : `${nomes.slice(0,3).join(', ')} +${nomes.length - 3}`;
    }
}

function updateMultiEquipeLabel() {
    const label = document.getElementById('multi-equipe-label');
    if (!label) return;
    if (selectedEquipes.size === 0) {
        label.textContent = 'Selecionar equipes...';
    } else {
        label.textContent = `${selectedEquipes.size} equipe(s) selecionada(s)`;
    }
}

// Fechar dropdowns ao clicar fora
document.addEventListener('click', function(e) {
    if (!e.target.closest('.multi-select-container')) {
        document.querySelectorAll('.multi-select-dropdown').forEach(d => d.style.display = 'none');
    }
    // Fechar popup do Gantt ao clicar fora
    if (!e.target.closest('.gantt-popup') && !e.target.closest('.gantt-cell-clickable')) {
        const popup = document.getElementById('gantt-popup');
        if (popup) popup.style.display = 'none';
    }
});

function renderCadeiaEquipeGlobal() {
    const container = document.getElementById('cadeia-equipe-global-list');
    if (!container) return;

    const cadeiaId = document.getElementById('cadeia-id').value;
    if (!cadeiaId) {
        container.innerHTML = '<span style="font-size:0.75rem;color:rgba(255,255,255,0.4);">Salve a cadeia primeiro para gerenciar equipe global.</span>';
        return;
    }

    // Pegar integrantes de todos os serviços da cadeia
    const cadeiaServicos = servicos.filter(s => String(s.cadeia_id) === String(cadeiaId));
    const integrantesIds = new Set();
    cadeiaServicos.forEach(s => {
        alocacoes.filter(a => String(a.servico_id) === String(s.id)).forEach(a => {
            integrantesIds.add(a.integrante_id);
        });
    });

    if (integrantesIds.size === 0) {
        container.innerHTML = '<span style="font-size:0.75rem;color:rgba(255,255,255,0.4);">Nenhum funcionário alocado nos serviços desta cadeia.</span>';
        return;
    }

    container.innerHTML = Array.from(integrantesIds).map(id => {
        const integrante = integrantes.find(i => i.id === id);
        return `<span class="equipe-badge alocado"><i class="fas fa-user"></i> ${integrante ? integrante.nome.split(' ')[0] : '?'}</span>`;
    }).join('');
}

// MULTI-SELEÇÃO: Adicionar vários funcionários de uma vez
window.addIntegrantesGlobalCadeia = async function() {
    const cadeiaId = document.getElementById('cadeia-id').value;
    if (selectedIntegrantes.size === 0) {
        showToast('Selecione pelo menos um funcionário.', 'warning');
        return;
    }
    if (!cadeiaId) {
        showToast('Salve a cadeia primeiro para depois alocar funcionários.', 'warning');
        return;
    }

    const cadeiaServicos = servicos.filter(s => String(s.cadeia_id) === String(cadeiaId));
    let totalAdicionados = 0;

    for (const integranteId of selectedIntegrantes) {
        for (const s of cadeiaServicos) {
            const jaAlocado = alocacoes.find(a => String(a.servico_id) === String(s.id) && String(a.integrante_id) === String(integranteId));
            if (jaAlocado) continue;

            const conflito = checkConflito(integranteId, s.data_inicio, s.data_fim_real || s.data_fim_prevista, s.id, cadeiaId);
            if (conflito) continue;

            try {
                const { error } = await supabase.from('logistica_alocacoes').insert({
                    servico_id: s.id,
                    integrante_id: integranteId,
                    data_inicio: s.data_inicio,
                    data_fim: s.data_fim_real || s.data_fim_prevista
                });
                if (!error) totalAdicionados++;
                else console.error('Erro insert alocação:', error);
            } catch (e) { console.error('Erro insert:', e); }
        }
    }

    await loadAlocacoes();
    renderCadeiaEquipeGlobal();
    selectedIntegrantes.clear();
    populateCadeiaIntegranteSelect();
    showToast(`${totalAdicionados} alocação(ões) criada(s)!`, 'success');
};

// MULTI-SELEÇÃO: Remover vários funcionários de uma vez
window.removeIntegrantesGlobalCadeia = async function() {
    const cadeiaId = document.getElementById('cadeia-id').value;
    if (selectedIntegrantes.size === 0 || !cadeiaId) {
        showToast('Selecione pelo menos um funcionário.', 'warning');
        return;
    }

    if (!confirm(`Remover ${selectedIntegrantes.size} funcionário(s) de TODOS os serviços desta cadeia?`)) return;

    const cadeiaServicos = servicos.filter(s => String(s.cadeia_id) === String(cadeiaId));
    for (const integranteId of selectedIntegrantes) {
        for (const s of cadeiaServicos) {
            await supabase.from('logistica_alocacoes').delete()
                .eq('servico_id', s.id)
                .eq('integrante_id', integranteId);
        }
    }

    await loadAlocacoes();
    renderCadeiaEquipeGlobal();
    selectedIntegrantes.clear();
    populateCadeiaIntegranteSelect();
    showToast('Funcionários removidos de todos os serviços!', 'success');
};

// MULTI-SELEÇÃO: Alocar várias equipes de uma vez
window.addEquipesGlobalCadeia = async function() {
    const cadeiaId = document.getElementById('cadeia-id').value;
    if (selectedEquipes.size === 0) {
        showToast('Selecione pelo menos uma equipe.', 'warning');
        return;
    }
    if (!cadeiaId) {
        showToast('Salve a cadeia primeiro para depois alocar equipes.', 'warning');
        return;
    }

    const cadeiaServicos = servicos.filter(s => String(s.cadeia_id) === String(cadeiaId));
    let totalAdicionados = 0;

    for (const equipeId of selectedEquipes) {
        const membros = equipesIntegrantes.filter(ei => String(ei.equipe_id) === String(equipeId));
        for (const membro of membros) {
            for (const s of cadeiaServicos) {
                const jaAlocado = alocacoes.find(a => String(a.servico_id) === String(s.id) && String(a.integrante_id) === String(membro.integrante_id));
                if (jaAlocado) continue;

                const conflito = checkConflito(membro.integrante_id, s.data_inicio, s.data_fim_real || s.data_fim_prevista, s.id, cadeiaId);
                if (conflito) continue;

                try {
                    const { error } = await supabase.from('logistica_alocacoes').insert({
                        servico_id: s.id,
                        integrante_id: membro.integrante_id,
                        equipe_id: equipeId,
                        data_inicio: s.data_inicio,
                        data_fim: s.data_fim_real || s.data_fim_prevista
                    });
                    if (!error) totalAdicionados++;
                    else console.error('Erro insert equipe:', error);
                } catch (e) { console.error('Erro insert equipe:', e); }
            }
        }
    }

    await loadAlocacoes();
    renderCadeiaEquipeGlobal();
    selectedEquipes.clear();
    populateCadeiaEquipeSelect();
    showToast(`${totalAdicionados} alocação(ões) criada(s) via equipes!`, 'success');
};

window.copiarEquipeServicoAnterior = async function() {
    const servicoId = document.getElementById('servico-id').value;
    const servico = servicos.find(s => s.id === servicoId);
    if (!servico || !servico.cadeia_id) {
        showToast('Este serviço não pertence a uma cadeia.', 'warning');
        return;
    }

    const cadeiaServicos = servicos.filter(s => String(s.cadeia_id) === String(servico.cadeia_id)).sort((a, b) => a.ordem - b.ordem);
    const indexAtual = cadeiaServicos.findIndex(s => s.id === servicoId);
    if (indexAtual <= 0) {
        showToast('Não há serviço anterior nesta cadeia.', 'warning');
        return;
    }

    const anterior = cadeiaServicos[indexAtual - 1];
    const alocsAnterior = alocacoes.filter(a => String(a.servico_id) === String(anterior.id));

    let adicionados = 0;
    for (const aloc of alocsAnterior) {
        const jaAlocado = alocacoes.find(a => String(a.servico_id) === String(servicoId) && String(a.integrante_id) === String(aloc.integrante_id));
        if (jaAlocado) continue;

        const conflito = checkConflito(aloc.integrante_id, servico.data_inicio, servico.data_fim_real || servico.data_fim_prevista, servicoId);
        if (conflito) continue;

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
    renderServicoPresenca(servicoId);
    showToast(`${adicionados} integrante(s) copiado(s) do serviço anterior!`, 'success');
};

// ===== GERAÇÃO DE PRODUÇÃO DIÁRIA =====
// Integração com producoes_diarias_hvc a partir dos dados logísticos

window.openGerarProducao = function(localId) {
    const local = locais.find(l => String(l.id) === String(localId));
    if (!local || !local.obra_id) {
        showToast('Este local não está vinculado a uma obra.', 'warning');
        return;
    }

    closeModal('local-detalhes');

    const obraVinculada = obras.find(o => String(o.id) === String(local.obra_id));
    const localCadeias = cadeias.filter(c => String(c.local_id) === String(localId));
    const localServicos = servicos.filter(s => localCadeias.some(c => String(c.id) === String(s.cadeia_id)));

    // Montar modal de geração de produção
    const modal = document.getElementById('modal-producao');
    const content = document.getElementById('producao-content');

    let html = `
        <div style="margin-bottom:15px;">
            <p style="color:#ffc107;font-weight:700;"><i class="fas fa-building"></i> ${obraVinculada ? obraVinculada.nome_obra || obraVinculada.numero_obra : 'Obra'}</p>
            <p style="font-size:0.8rem;color:rgba(255,255,255,0.6);">${local.nome}</p>
        </div>

        <div style="margin-bottom:15px;">
            <label style="font-size:0.85rem;font-weight:700;color:#add8e6;">Modo de Geração</label>
            <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
                <button type="button" class="btn btn-primary btn-sm producao-mode-btn active" data-mode="dia" onclick="setProducaoMode('dia','${localId}')">
                    <i class="fas fa-calendar-day"></i> Por Dia
                </button>
                <button type="button" class="btn btn-secondary btn-sm producao-mode-btn" data-mode="servico" onclick="setProducaoMode('servico','${localId}')">
                    <i class="fas fa-wrench"></i> Por Serviço
                </button>
                <button type="button" class="btn btn-secondary btn-sm producao-mode-btn" data-mode="cadeia" onclick="setProducaoMode('cadeia','${localId}')">
                    <i class="fas fa-link"></i> Por Cadeia
                </button>
            </div>
        </div>

        <div id="producao-mode-content"></div>
    `;

    content.innerHTML = html;
    document.getElementById('producao-local-id').value = localId;
    document.getElementById('producao-obra-id').value = local.obra_id;
    openModal('producao');

    // Iniciar no modo "dia"
    setProducaoMode('dia', localId);
};

window.setProducaoMode = function(mode, localId) {
    document.querySelectorAll('.producao-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
        btn.classList.toggle('btn-primary', btn.dataset.mode === mode);
        btn.classList.toggle('btn-secondary', btn.dataset.mode !== mode);
    });

    const container = document.getElementById('producao-mode-content');
    const local = locais.find(l => String(l.id) === String(localId));
    const obraId = local.obra_id;
    const localCadeias = cadeias.filter(c => String(c.local_id) === String(localId));
    const localServicos = servicos.filter(s => localCadeias.some(c => String(c.id) === String(s.cadeia_id)));

    if (mode === 'dia') {
        renderProducaoDia(container, localServicos, obraId);
    } else if (mode === 'servico') {
        renderProducaoServico(container, localServicos, obraId);
    } else {
        renderProducaoCadeia(container, localCadeias, localServicos, obraId);
    }
};

function renderProducaoDia(container, localServicos, obraId) {
    const hoje = getEffectiveDate();
    const hojeStr = formatDateInput(hoje);

    // Serviços ativos hoje
    const dayStart = new Date(hoje); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(hoje); dayEnd.setHours(23, 59, 59, 999);

    const servicosHoje = localServicos.filter(s => {
        const inicio = new Date(s.data_inicio);
        const fim = new Date(s.data_fim_real || s.data_fim_prevista);
        return inicio <= dayEnd && fim >= dayStart && s.status !== 'cancelado';
    });

    if (servicosHoje.length === 0) {
        container.innerHTML = `<div style="text-align:center;color:rgba(255,255,255,0.4);padding:20px;"><i class="fas fa-calendar-times"></i><p>Nenhum serviço ativo para ${formatDateBR(hoje)}</p></div>`;
        return;
    }

    let html = `
        <div class="form-group">
            <label>Data da Produção</label>
            <input type="date" id="producao-data" value="${hojeStr}" onchange="refreshProducaoDia('${obraId}')">
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;margin-top:10px;">
            <thead>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.2);">
                    <th style="text-align:left;padding:6px;color:#add8e6;">Serviço</th>
                    <th style="text-align:center;padding:6px;color:#add8e6;">Unidade</th>
                    <th style="text-align:center;padding:6px;color:#add8e6;">Qtd Contratada</th>
                    <th style="text-align:center;padding:6px;color:#add8e6;">Qtd Hoje</th>
                </tr>
            </thead>
            <tbody>
    `;

    servicosHoje.forEach(s => {
        const servicoInfo = getServicoInfoFromObra(s);
        const equipeHoje = getEquipePresente(s.id, hoje);

        html += `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:6px;">
                    ${s.nome}
                    <br><small style="color:rgba(255,255,255,0.4);">Equipe: ${equipeHoje.map(e => e.nome.split(' ')[0]).join(', ') || 'Nenhuma'}</small>
                </td>
                <td style="text-align:center;padding:6px;color:rgba(255,255,255,0.6);">${servicoInfo.unidade}</td>
                <td style="text-align:center;padding:6px;color:rgba(255,255,255,0.6);">${servicoInfo.quantidade}</td>
                <td style="text-align:center;padding:6px;">
                    <input type="number" step="0.01" min="0" class="producao-qtd-input" data-servico-id="${s.id}" data-servico-andamento-id="${s.servico_andamento_id || ''}" data-servico-nome="${escapeHtml(s.nome)}"
                        style="width:80px;padding:4px;border-radius:4px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);color:white;text-align:center;">
                </td>
            </tr>
        `;
    });

    html += `</tbody></table>
        <div class="form-group" style="margin-top:15px;">
            <label>Observações</label>
            <textarea id="producao-obs" placeholder="Observações sobre a produção do dia..."></textarea>
        </div>
        <div class="form-actions">
            <button type="button" class="btn btn-danger" onclick="closeModal('producao')">Cancelar</button>
            <button type="button" class="btn btn-primary" onclick="salvarProducaoDia('${obraId}')">
                <i class="fas fa-save"></i> Salvar Produção do Dia
            </button>
        </div>
    `;
    container.innerHTML = html;
}

function renderProducaoServico(container, localServicos, obraId) {
    // Mostrar lista de serviços para selecionar e gerar produção distribuída
    const servicosConcluidos = localServicos.filter(s => s.status === 'concluido' || s.status === 'em_andamento');

    if (servicosConcluidos.length === 0) {
        container.innerHTML = `<div style="text-align:center;color:rgba(255,255,255,0.4);padding:20px;"><p>Nenhum serviço em andamento ou concluído.</p></div>`;
        return;
    }

    let html = `
        <div class="form-group">
            <label>Selecione o Serviço</label>
            <select id="producao-servico-select" onchange="preencherProducaoServico('${obraId}')">
                <option value="">Selecione...</option>
                ${servicosConcluidos.map(s => `<option value="${s.id}">${s.nome} (${getServicoStatusLabel(s.status)})</option>`).join('')}
            </select>
        </div>
        <div id="producao-servico-detalhe"></div>
    `;
    container.innerHTML = html;
}

window.preencherProducaoServico = function(obraId) {
    const servicoId = document.getElementById('producao-servico-select').value;
    const container = document.getElementById('producao-servico-detalhe');
    if (!servicoId) { container.innerHTML = ''; return; }

    const servico = servicos.find(s => s.id === servicoId);
    if (!servico) return;

    const servicoInfo = getServicoInfoFromObra(servico);
    const inicio = new Date(servico.data_inicio);
    const fim = new Date(servico.data_fim_real || servico.data_fim_prevista);
    
    // Calcular dias trabalhados
    const dias = [];
    const current = new Date(inicio);
    current.setHours(0, 0, 0, 0);
    const fimDate = new Date(fim);
    fimDate.setHours(23, 59, 59, 999);
    while (current <= fimDate && dias.length <= 60) {
        dias.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }

    // Distribuição igualitária pré-preenchida
    const qtdPorDia = servicoInfo.quantidade > 0 ? (servicoInfo.quantidade / dias.length).toFixed(2) : 0;

    let html = `
        <div style="margin:10px 0;padding:10px;background:rgba(76,175,80,0.1);border:1px solid rgba(76,175,80,0.3);border-radius:6px;">
            <p style="font-size:0.8rem;color:#4caf50;"><i class="fas fa-info-circle"></i> Distribuição igualitária: ${servicoInfo.quantidade} ${servicoInfo.unidade} ÷ ${dias.length} dias = <b>${qtdPorDia} ${servicoInfo.unidade}/dia</b></p>
            <p style="font-size:0.7rem;color:rgba(255,255,255,0.5);margin-top:5px;">Você pode personalizar os valores abaixo antes de salvar.</p>
        </div>
        <div style="max-height:300px;overflow-y:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
            <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.2);">
                <th style="text-align:left;padding:4px;color:#add8e6;">Data</th>
                <th style="text-align:center;padding:4px;color:#add8e6;">Equipe Presente</th>
                <th style="text-align:center;padding:4px;color:#add8e6;">Qtd (${servicoInfo.unidade})</th>
            </tr></thead><tbody>
    `;

    dias.forEach(d => {
        const equipePresente = getEquipePresente(servicoId, d);
        const dateStr = formatDateInput(d);
        html += `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:4px;">${formatDateBR(d)}</td>
                <td style="text-align:center;padding:4px;color:rgba(255,255,255,0.6);font-size:0.65rem;">${equipePresente.map(e => e.nome.split(' ')[0]).join(', ') || '-'}</td>
                <td style="text-align:center;padding:4px;">
                    <input type="number" step="0.01" min="0" value="${qtdPorDia}" class="producao-servico-qtd" data-date="${dateStr}"
                        style="width:70px;padding:3px;border-radius:4px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);color:white;text-align:center;font-size:0.75rem;">
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>
        <div class="form-group" style="margin-top:10px;">
            <label>Observações</label>
            <textarea id="producao-servico-obs" placeholder="Observações..."></textarea>
        </div>
        <div class="form-actions">
            <button type="button" class="btn btn-danger" onclick="closeModal('producao')">Cancelar</button>
            <button type="button" class="btn btn-primary" onclick="salvarProducaoServico('${obraId}','${servicoId}')">
                <i class="fas fa-save"></i> Salvar Produção do Serviço
            </button>
        </div>
    `;
    container.innerHTML = html;
};

function renderProducaoCadeia(container, localCadeias, localServicos, obraId) {
    if (localCadeias.length === 0) {
        container.innerHTML = `<div style="text-align:center;color:rgba(255,255,255,0.4);padding:20px;"><p>Nenhuma cadeia encontrada.</p></div>`;
        return;
    }

    let html = `
        <div class="form-group">
            <label>Selecione a Cadeia</label>
            <select id="producao-cadeia-select" onchange="preencherProducaoCadeia('${obraId}')">
                <option value="">Selecione...</option>
                ${localCadeias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
            </select>
        </div>
        <div id="producao-cadeia-detalhe"></div>
    `;
    container.innerHTML = html;
}

window.preencherProducaoCadeia = function(obraId) {
    const cadeiaId = document.getElementById('producao-cadeia-select').value;
    const container = document.getElementById('producao-cadeia-detalhe');
    if (!cadeiaId) { container.innerHTML = ''; return; }

    const cadeiaServicos = servicos.filter(s => String(s.cadeia_id) === String(cadeiaId)).sort((a, b) => a.ordem - b.ordem);
    
    if (cadeiaServicos.length === 0) {
        container.innerHTML = '<p style="color:rgba(255,255,255,0.4);">Nenhum serviço nesta cadeia.</p>';
        return;
    }

    let html = `
        <div style="margin:10px 0;padding:10px;background:rgba(156,39,176,0.1);border:1px solid rgba(156,39,176,0.3);border-radius:6px;">
            <p style="font-size:0.8rem;color:#ce93d8;"><i class="fas fa-info-circle"></i> Geração em lote: produção distribuída igualmente para cada serviço da cadeia.</p>
        </div>
        <div style="max-height:400px;overflow-y:auto;">
    `;

    cadeiaServicos.forEach(s => {
        const servicoInfo = getServicoInfoFromObra(s);
        const inicio = new Date(s.data_inicio);
        const fim = new Date(s.data_fim_real || s.data_fim_prevista);
        const diffMs = fim - inicio;
        const numDias = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
        const qtdPorDia = servicoInfo.quantidade > 0 ? (servicoInfo.quantidade / numDias).toFixed(2) : 0;

        html += `
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:10px;margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-weight:600;color:white;">${s.nome}</span>
                    <span style="font-size:0.7rem;color:rgba(255,255,255,0.5);">${numDias} dias | ${servicoInfo.quantidade} ${servicoInfo.unidade}</span>
                </div>
                <div style="font-size:0.7rem;color:rgba(255,255,255,0.5);margin-top:4px;">
                    Distribuição: <b>${qtdPorDia} ${servicoInfo.unidade}/dia</b>
                    <input type="number" step="0.01" min="0" value="${qtdPorDia}" class="producao-cadeia-qtd" data-servico-id="${s.id}" data-num-dias="${numDias}"
                        style="width:70px;padding:3px;margin-left:10px;border-radius:4px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);color:white;text-align:center;font-size:0.75rem;">
                    <small style="color:rgba(255,255,255,0.3);">(qtd/dia - personalize se quiser)</small>
                </div>
            </div>
        `;
    });

    html += `</div>
        <div class="form-group" style="margin-top:10px;">
            <label>Observações</label>
            <textarea id="producao-cadeia-obs" placeholder="Observações..."></textarea>
        </div>
        <div class="form-actions">
            <button type="button" class="btn btn-danger" onclick="closeModal('producao')">Cancelar</button>
            <button type="button" class="btn btn-primary" onclick="salvarProducaoCadeia('${obraId}','${cadeiaId}')">
                <i class="fas fa-save"></i> Salvar Produção da Cadeia
            </button>
        </div>
    `;
    container.innerHTML = html;
};

// ===== SALVAR PRODUÇÕES =====
window.salvarProducaoDia = async function(obraId) {
    const data = document.getElementById('producao-data').value;
    const obs = document.getElementById('producao-obs').value;
    const inputs = document.querySelectorAll('.producao-qtd-input');

    const quantidades = {};
    inputs.forEach(input => {
        const qtd = parseFloat(input.value);
        if (qtd > 0) {
            const servicoAndamentoId = input.dataset.servicoAndamentoId;
            const servicoNome = input.dataset.servicoNome;
            quantidades[servicoAndamentoId || servicoNome] = qtd;
        }
    });

    if (Object.keys(quantidades).length === 0) {
        showToast('Informe pelo menos uma quantidade.', 'warning');
        return;
    }

    // Determinar equipe/responsável (primeiro serviço com alocação)
    const primeiroInput = inputs[0];
    const servicoId = primeiroInput?.dataset.servicoId;
    const equipeInfo = getResponsavelProducao(servicoId, data);

    try {
        const { error } = await supabase.from('producoes_diarias_hvc').insert({
            obra_id: obraId,
            data_producao: data,
            tipo_responsavel: equipeInfo.tipo,
            responsavel_id: equipeInfo.id,
            quantidades_servicos: quantidades,
            observacoes: obs || null,
            integrantes_ausentes: getAusentesNoDia(servicoId, data)
        });
        if (error) throw error;

        showToast('Produção do dia registrada com sucesso!', 'success');
        closeModal('producao');
    } catch (error) {
        showToast('Erro ao salvar produção: ' + error.message, 'error');
    }
};

window.salvarProducaoServico = async function(obraId, servicoId) {
    const obs = document.getElementById('producao-servico-obs').value;
    const inputs = document.querySelectorAll('.producao-servico-qtd');
    const servico = servicos.find(s => s.id === servicoId);

    let registros = 0;
    for (const input of inputs) {
        const qtd = parseFloat(input.value);
        const dateStr = input.dataset.date;
        if (qtd > 0) {
            const equipeInfo = getResponsavelProducao(servicoId, dateStr);
            const quantidades = {};
            quantidades[servico.servico_andamento_id || servico.nome] = qtd;

            try {
                await supabase.from('producoes_diarias_hvc').insert({
                    obra_id: obraId,
                    data_producao: dateStr,
                    tipo_responsavel: equipeInfo.tipo,
                    responsavel_id: equipeInfo.id,
                    quantidades_servicos: quantidades,
                    observacoes: obs || null,
                    integrantes_ausentes: getAusentesNoDia(servicoId, dateStr)
                });
                registros++;
            } catch (e) { console.error(e); }
        }
    }

    showToast(`${registros} registro(s) de produção criado(s)!`, 'success');
    closeModal('producao');
};

window.salvarProducaoCadeia = async function(obraId, cadeiaId) {
    const obs = document.getElementById('producao-cadeia-obs').value;
    const inputs = document.querySelectorAll('.producao-cadeia-qtd');

    let registros = 0;
    for (const input of inputs) {
        const servicoId = input.dataset.servicoId;
        const numDias = parseInt(input.dataset.numDias);
        const qtdPorDia = parseFloat(input.value);
        if (qtdPorDia <= 0) continue;

        const servico = servicos.find(s => s.id === servicoId);
        if (!servico) continue;

        const inicio = new Date(servico.data_inicio);
        for (let d = 0; d < numDias; d++) {
            const dia = new Date(inicio);
            dia.setDate(inicio.getDate() + d);
            const dateStr = formatDateInput(dia);

            const equipeInfo = getResponsavelProducao(servicoId, dateStr);
            const quantidades = {};
            quantidades[servico.servico_andamento_id || servico.nome] = qtdPorDia;

            try {
                await supabase.from('producoes_diarias_hvc').insert({
                    obra_id: obraId,
                    data_producao: dateStr,
                    tipo_responsavel: equipeInfo.tipo,
                    responsavel_id: equipeInfo.id,
                    quantidades_servicos: quantidades,
                    observacoes: obs || null,
                    integrantes_ausentes: getAusentesNoDia(servicoId, dateStr)
                });
                registros++;
            } catch (e) { console.error(e); }
        }
    }

    showToast(`${registros} registro(s) de produção criado(s) para a cadeia!`, 'success');
    closeModal('producao');
};

// ===== HELPERS DE PRODUÇÃO =====
function getServicoInfoFromObra(servico) {
    // Tentar buscar informações do serviço contratado
    if (servico.servico_andamento_id) {
        const sa = servicosAndamento.find(s => String(s.id) === String(servico.servico_andamento_id));
        if (sa) {
            const ip = itensPropostas.find(i => String(i.id) === String(sa.item_proposta_id));
            if (ip) {
                const sh = servicosHvc.find(s => String(s.id) === String(ip.servico_id));
                return {
                    nome: sh ? sh.descricao : servico.nome,
                    unidade: sh ? sh.unidade : 'un',
                    quantidade: ip.quantidade || 0
                };
            }
        }
    }
    // Fallback: tentar pelo item_proposta_id direto
    if (servico.item_proposta_id) {
        const ip = itensPropostas.find(i => String(i.id) === String(servico.item_proposta_id));
        if (ip) {
            const sh = servicosHvc.find(s => String(s.id) === String(ip.servico_id));
            return {
                nome: sh ? sh.descricao : servico.nome,
                unidade: sh ? sh.unidade : 'un',
                quantidade: ip.quantidade || 0
            };
        }
    }
    return { nome: servico.nome, unidade: 'un', quantidade: 0 };
}

function getEquipePresente(servicoId, date) {
    const dateStr = typeof date === 'string' ? date : formatDateInput(date);
    const servicoAlocs = alocacoes.filter(a => String(a.servico_id) === String(servicoId));
    
    return servicoAlocs.map(a => {
        const integrante = integrantes.find(i => i.id === a.integrante_id);
        if (!integrante) return null;

        // Verificar presença
        const presenca = presencas.find(p => 
            String(p.alocacao_id) === String(a.id) && 
            String(p.integrante_id) === String(a.integrante_id) && 
            p.data === dateStr && 
            !p.presente
        );
        if (presenca) return null; // Ausente

        return integrante;
    }).filter(Boolean);
}

function getAusentesNoDia(servicoId, dateStr) {
    const servicoAlocs = alocacoes.filter(a => String(a.servico_id) === String(servicoId));
    const ausentes = [];

    servicoAlocs.forEach(a => {
        const presenca = presencas.find(p => 
            String(p.alocacao_id) === String(a.id) && 
            String(p.integrante_id) === String(a.integrante_id) && 
            p.data === dateStr && 
            !p.presente
        );
        if (presenca) {
            ausentes.push(a.integrante_id);
        }
    });

    return ausentes.length > 0 ? ausentes : null;
}

function getResponsavelProducao(servicoId, dateStr) {
    // Determinar quem é o responsável: equipe ou integrante individual
    const servicoAlocs = alocacoes.filter(a => String(a.servico_id) === String(servicoId));
    
    if (servicoAlocs.length > 0) {
        // Se tem equipe_id, usar equipe como responsável
        const comEquipe = servicoAlocs.find(a => a.equipe_id);
        if (comEquipe) {
            return { tipo: 'equipe', id: comEquipe.equipe_id };
        }
        // Senão, usar o primeiro integrante
        return { tipo: 'integrante', id: servicoAlocs[0].integrante_id };
    }
    return { tipo: 'integrante', id: null };
}

// ===== GANTT (ABA ALOCAÇÃO) - 4 MODOS DE VISUALIZAÇÃO =====
let ganttViewMode = 'obra'; // obra, servico, funcionario, equipe

function populateGanttFilter() {
    const select = document.getElementById('gantt-local-filter');
    if (!select) return;
    select.innerHTML = '<option value="">Todos os Locais</option>';
    locais.forEach(l => {
        const obraVinculada = l.obra_id ? obras.find(o => String(o.id) === String(l.obra_id)) : null;
        const label = obraVinculada ? `${l.nome} (${obraVinculada.nome_obra || obraVinculada.numero_obra})` : l.nome;
        select.innerHTML += `<option value="${l.id}">${label}</option>`;
    });
}

window.setGanttView = function(mode) {
    ganttViewMode = mode;
    // Atualizar botões ativos
    document.querySelectorAll('.gantt-view-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.gantt-view-btn[data-view="${mode}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    renderGantt();
};

window.renderGantt = function() {
    const container = document.getElementById('gantt-container');
    const inicioStr = document.getElementById('gantt-inicio')?.value;
    const fimStr = document.getElementById('gantt-fim')?.value;
    const localFilter = document.getElementById('gantt-local-filter')?.value;

    if (!inicioStr || !fimStr) {
        container.innerHTML = '<p style="color:rgba(255,255,255,0.4);text-align:center;">Selecione o período para visualizar.</p>';
        return;
    }

    const inicio = new Date(inicioStr + 'T00:00:00');
    const fim = new Date(fimStr + 'T23:59:59');
    const totalDays = Math.ceil((fim - inicio) / (24 * 60 * 60 * 1000)) + 1;

    if (totalDays > 60) {
        container.innerHTML = '<p style="color:#f44336;text-align:center;">Período muito longo. Máximo 60 dias.</p>';
        return;
    }

    const days = [];
    for (let i = 0; i < totalDays; i++) {
        const d = new Date(inicio);
        d.setDate(inicio.getDate() + i);
        days.push(d);
    }

    switch (ganttViewMode) {
        case 'obra': renderGanttObra(container, days, localFilter, inicio, fim); break;
        case 'servico': renderGanttServico(container, days, localFilter, inicio, fim); break;
        case 'funcionario': renderGanttFuncionario(container, days, localFilter, inicio, fim); break;
        case 'equipe': renderGanttEquipe(container, days, localFilter, inicio, fim); break;
        default: renderGanttObra(container, days, localFilter, inicio, fim);
    }
};

// MODO OBRA: Agrupa por obra/local, mostra serviços e quem está em cada dia
function renderGanttObra(container, days, localFilter, inicio, fim) {
    let filteredLocais = locais.filter(l => {
        if (localFilter && String(l.id) !== String(localFilter)) return false;
        return true;
    });

    // Filtrar locais que têm serviços no período
    filteredLocais = filteredLocais.filter(l => {
        return servicos.some(s => {
            if (String(s.local_id) !== String(l.id)) return false;
            const sInicio = new Date(s.data_inicio);
            const sFim = new Date(s.data_fim_real || s.data_fim_prevista);
            return sInicio <= fim && sFim >= inicio && s.status !== 'cancelado';
        });
    });

    if (filteredLocais.length === 0) {
        container.innerHTML = '<p style="color:rgba(255,255,255,0.4);text-align:center;">Nenhuma obra/local com serviços no período.</p>';
        return;
    }

    let html = buildTableHeader(days, 'OBRA / SERVIÇO');

    filteredLocais.forEach(local => {
        const obraVinculada = local.obra_id ? obras.find(o => String(o.id) === String(local.obra_id)) : null;
        const obraLabel = obraVinculada ? (obraVinculada.nome_obra || obraVinculada.numero_obra) : local.nome;

        // Linha da obra (header)
        html += `<tr style="background:rgba(255,193,7,0.08);">
            <td style="position:sticky;left:0;background:rgba(25,25,46,0.98);z-index:1;padding:6px 8px;border-bottom:1px solid rgba(255,193,7,0.2);font-weight:700;color:#ffc107;font-size:0.75rem;">
                <i class="fas fa-building"></i> ${obraLabel}
                <br><small style="color:rgba(255,255,255,0.4);font-weight:400;">${local.nome}</small>
            </td>`;

        // Células da obra: mostrar total de funcionários por dia
        days.forEach(d => {
            const dateStr = formatDateInput(d);
            const localServicos = servicos.filter(s => String(s.local_id) === String(local.id) && s.status !== 'cancelado');
            let totalPresentes = 0;
            const nomesPresentes = new Set();

            localServicos.forEach(s => {
                const sInicio = new Date(s.data_inicio); sInicio.setHours(0,0,0,0);
                const sFim = new Date(s.data_fim_real || s.data_fim_prevista); sFim.setHours(23,59,59,999);
                const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
                if (sInicio <= dayStart && sFim >= dayStart) {
                    const presentes = getEquipePresente(s.id, dateStr);
                    presentes.forEach(p => {
                        nomesPresentes.add(p.nome.split(' ')[0]);
                        totalPresentes++;
                    });
                }
            });

            const isToday = d.toDateString() === new Date().toDateString();
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const tooltip = nomesPresentes.size > 0 ? Array.from(nomesPresentes).join(', ') : '';
            const cellBg = totalPresentes > 0 ? 'rgba(255,193,7,0.15)' : 'transparent';
            html += `<td style="text-align:center;padding:2px;border-bottom:1px solid rgba(255,193,7,0.1);background:${cellBg};${isToday ? 'border-left:2px solid rgba(76,175,80,0.5);border-right:2px solid rgba(76,175,80,0.5);' : ''}${isWeekend ? 'background:rgba(100,0,0,0.1);' : ''}" title="${tooltip}">
                ${totalPresentes > 0 ? `<span style="font-size:0.65rem;font-weight:700;color:#ffc107;">${nomesPresentes.size}</span>` : ''}
            </td>`;
        });
        html += '</tr>';

        // Linhas dos serviços desta obra
        const localServicos = servicos.filter(s => String(s.local_id) === String(local.id) && s.status !== 'cancelado');
        localServicos.sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio)).forEach(s => {
            const statusColor = getServicoStatusColor(s.status);
            const sInicio = new Date(s.data_inicio);
            const sFim = new Date(s.data_fim_real || s.data_fim_prevista);

            html += `<tr data-servico-id="${s.id}">
                <td style="position:sticky;left:0;background:#1a1a2e;z-index:1;padding:4px 8px 4px 20px;border-bottom:1px solid rgba(255,255,255,0.03);white-space:nowrap;font-size:0.7rem;">
                    <span style="color:${statusColor};">●</span> ${s.nome}
                </td>`;

            days.forEach((d, dayIndex) => {
                const dateStr = formatDateInput(d);
                const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
                const dayEnd = new Date(d); dayEnd.setHours(23,59,59,999);

                let cellBg = 'transparent';
                let cellContent = '';
                let cellClass = '';

                if (sInicio <= dayEnd && sFim >= dayStart) {
                    const presentes = getEquipePresente(s.id, dateStr);
                    cellBg = statusColor + '25';
                    cellClass = 'gantt-cell-active';

                    // Drag handles
                    const sInicioDay = new Date(sInicio); sInicioDay.setHours(0,0,0,0);
                    const sFimDay = new Date(sFim); sFimDay.setHours(0,0,0,0);
                    const isFirstDay = dayStart.getTime() === sInicioDay.getTime();
                    const isLastDay = dayStart.getTime() === sFimDay.getTime();

                    if (presentes.length > 0) {
                        cellContent = `<span class="gantt-cell-clickable" style="font-size:0.5rem;color:white;background:${statusColor}80;border-radius:3px;padding:1px 3px;cursor:pointer;position:relative;z-index:3;" onclick="showGanttPopup(event, '${s.id}', '${dateStr}')">${presentes.length}</span>`;
                    } else {
                        cellContent = `<span class="gantt-cell-clickable" style="font-size:0.4rem;color:${statusColor}80;cursor:pointer;position:relative;z-index:3;" onclick="showGanttPopup(event, '${s.id}', '${dateStr}')">●</span>`;
                    }

                    if (isFirstDay) {
                        cellContent = `<div class="gantt-drag-handle-left" onmousedown="startDragEdge(event, '${s.id}', 'start')"></div>` + cellContent;
                    }
                    if (isLastDay) {
                        cellContent += `<div class="gantt-drag-handle-right" onmousedown="startDragEdge(event, '${s.id}', 'end')"></div>`;
                    }
                }

                const isToday = d.toDateString() === new Date().toDateString();
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                html += `<td class="${cellClass}" data-day-index="${dayIndex}" data-date="${dateStr}" style="text-align:center;padding:2px;border-bottom:1px solid rgba(255,255,255,0.03);background:${cellBg};position:relative;${isToday ? 'border-left:2px solid rgba(76,175,80,0.3);border-right:2px solid rgba(76,175,80,0.3);' : ''}${isWeekend && cellBg === 'transparent' ? 'background:rgba(100,0,0,0.05);' : ''}">${cellContent}</td>`;
            });
            html += '</tr>';
        });
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// MODO SERVIÇO: Lista todos os serviços com quem está em cada dia (com popup e drag)
function renderGanttServico(container, days, localFilter, inicio, fim) {
    let ganttServicos = servicos.filter(s => {
        const sInicio = new Date(s.data_inicio);
        const sFim = new Date(s.data_fim_real || s.data_fim_prevista);
        return sInicio <= fim && sFim >= inicio && s.status !== 'cancelado';
    });

    if (localFilter) {
        ganttServicos = ganttServicos.filter(s => String(s.local_id) === String(localFilter));
    }

    if (ganttServicos.length === 0) {
        container.innerHTML = '<p style="color:rgba(255,255,255,0.4);text-align:center;">Nenhum serviço no período.</p>';
        return;
    }

    let html = buildTableHeader(days, 'SERVIÇO');

    ganttServicos.sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio)).forEach(s => {
        const local = locais.find(l => String(l.id) === String(s.local_id));
        const statusColor = getServicoStatusColor(s.status);

        html += `<tr data-servico-id="${s.id}">
            <td style="position:sticky;left:0;background:#1a1a2e;z-index:1;padding:5px 8px;border-bottom:1px solid rgba(255,255,255,0.05);white-space:nowrap;font-size:0.7rem;">
                <span style="color:${statusColor};">\u25cf</span> ${s.nome}
                <br><small style="color:rgba(255,255,255,0.4);">${local ? local.nome : ''}</small>
            </td>`;

        const sInicio = new Date(s.data_inicio);
        const sFim = new Date(s.data_fim_real || s.data_fim_prevista);

        days.forEach((d, dayIndex) => {
            const dateStr = formatDateInput(d);
            const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
            const dayEnd = new Date(d); dayEnd.setHours(23,59,59,999);

            let cellBg = 'transparent';
            let cellContent = '';
            let cellClass = '';
            let isFirstDay = false;
            let isLastDay = false;

            if (sInicio <= dayEnd && sFim >= dayStart) {
                const presentes = getEquipePresente(s.id, dateStr);
                cellBg = statusColor + '25';
                cellClass = 'gantt-cell-active';

                // Detectar primeiro e último dia para drag handles
                const sInicioDay = new Date(sInicio); sInicioDay.setHours(0,0,0,0);
                const sFimDay = new Date(sFim); sFimDay.setHours(0,0,0,0);
                isFirstDay = dayStart.getTime() === sInicioDay.getTime();
                isLastDay = dayStart.getTime() === sFimDay.getTime();

                if (presentes.length > 0) {
                    cellContent = `<span class="gantt-cell-clickable" style="font-size:0.5rem;color:white;background:${statusColor}80;border-radius:3px;padding:1px 3px;cursor:pointer;position:relative;z-index:3;" data-servico-id="${s.id}" data-date="${dateStr}" onclick="showGanttPopup(event, '${s.id}', '${dateStr}')">${presentes.length}</span>`;
                } else {
                    cellContent = `<span class="gantt-cell-clickable" style="font-size:0.4rem;color:${statusColor}80;cursor:pointer;position:relative;z-index:3;" data-servico-id="${s.id}" data-date="${dateStr}" onclick="showGanttPopup(event, '${s.id}', '${dateStr}')">\u25cf</span>`;
                }

                // Drag handles para redimensionar
                if (isFirstDay) {
                    cellContent = `<div class="gantt-drag-handle-left" data-servico-id="${s.id}" data-edge="start" onmousedown="startDragEdge(event, '${s.id}', 'start')"></div>` + cellContent;
                }
                if (isLastDay) {
                    cellContent += `<div class="gantt-drag-handle-right" data-servico-id="${s.id}" data-edge="end" onmousedown="startDragEdge(event, '${s.id}', 'end')"></div>`;
                }
            }

            const isToday = d.toDateString() === new Date().toDateString();
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            html += `<td class="${cellClass}" data-day-index="${dayIndex}" data-date="${dateStr}" style="text-align:center;padding:2px;border-bottom:1px solid rgba(255,255,255,0.05);background:${cellBg};position:relative;${isToday ? 'border-left:2px solid rgba(76,175,80,0.5);border-right:2px solid rgba(76,175,80,0.5);' : ''}${isWeekend && cellBg === 'transparent' ? 'background:rgba(100,0,0,0.05);' : ''}">${cellContent}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// MODO FUNCIONÁRIO: Cada linha é um funcionário, mostra em qual serviço está cada dia
function renderGanttFuncionario(container, days, localFilter, inicio, fim) {
    // Pegar integrantes que têm alocações no período
    let relevantIntegrantes = integrantes.filter(integ => {
        return alocacoes.some(a => {
            if (String(a.integrante_id) !== String(integ.id)) return false;
            const servico = servicos.find(s => s.id === a.servico_id);
            if (!servico || servico.status === 'cancelado') return false;
            if (localFilter && String(servico.local_id) !== String(localFilter)) return false;
            const sInicio = new Date(servico.data_inicio);
            const sFim = new Date(servico.data_fim_real || servico.data_fim_prevista);
            return sInicio <= fim && sFim >= inicio;
        });
    });

    if (relevantIntegrantes.length === 0) {
        container.innerHTML = '<p style="color:rgba(255,255,255,0.4);text-align:center;">Nenhum funcionário alocado no período/local selecionado.</p>';
        return;
    }

    let html = buildTableHeader(days, 'FUNCIONÁRIO');

    relevantIntegrantes.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(integ => {
        html += `<tr>
            <td style="position:sticky;left:0;background:#1a1a2e;z-index:1;padding:5px 8px;border-bottom:1px solid rgba(255,255,255,0.05);white-space:nowrap;font-size:0.7rem;cursor:pointer;" onclick="openFuncionarioModal('${integ.id}')">
                <i class="fas fa-user" style="color:#90caf9;font-size:0.6rem;"></i> ${integ.nome.split(' ').slice(0,2).join(' ')}
            </td>`;

        days.forEach(d => {
            const dateStr = formatDateInput(d);
            const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
            const dayEnd = new Date(d); dayEnd.setHours(23,59,59,999);

            // Encontrar serviços deste integrante neste dia
            const integAlocs = alocacoes.filter(a => String(a.integrante_id) === String(integ.id));
            let servicosNoDia = [];

            integAlocs.forEach(a => {
                const servico = servicos.find(s => s.id === a.servico_id);
                if (!servico || servico.status === 'cancelado') return;
                if (localFilter && String(servico.local_id) !== String(localFilter)) return;
                const sInicio = new Date(servico.data_inicio);
                const sFim = new Date(servico.data_fim_real || servico.data_fim_prevista);
                if (sInicio <= dayEnd && sFim >= dayStart) {
                    // Verificar presença
                    const ausente = presencas.find(p => 
                        String(p.alocacao_id) === String(a.id) && 
                        String(p.integrante_id) === String(integ.id) && 
                        p.data === dateStr && !p.presente
                    );
                    if (!ausente) {
                        servicosNoDia.push(servico);
                    }
                }
            });

            let cellBg = 'transparent';
            let cellContent = '';
            const isToday = d.toDateString() === new Date().toDateString();
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;

            if (servicosNoDia.length > 0) {
                const statusColor = getServicoStatusColor(servicosNoDia[0].status);
                cellBg = statusColor + '30';
                const nomes = servicosNoDia.map(s => s.nome).join('\n');
                const local = locais.find(l => String(l.id) === String(servicosNoDia[0].local_id));
                const localNome = local ? local.nome : '';
                cellContent = `<span style="font-size:0.5rem;color:white;background:${statusColor}90;border-radius:3px;padding:1px 3px;cursor:pointer;" title="${nomes}\n${localNome}">${servicosNoDia.length > 1 ? servicosNoDia.length : servicosNoDia[0].nome.substring(0,4)}</span>`;
            }

            html += `<td style="text-align:center;padding:2px;border-bottom:1px solid rgba(255,255,255,0.05);background:${cellBg};${isToday ? 'border-left:2px solid rgba(76,175,80,0.5);border-right:2px solid rgba(76,175,80,0.5);' : ''}${isWeekend && cellBg === 'transparent' ? 'background:rgba(100,0,0,0.05);' : ''}">${cellContent}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// MODO EQUIPE: Cada linha é uma equipe, mostra onde a equipe está cada dia
function renderGanttEquipe(container, days, localFilter, inicio, fim) {
    if (equipes.length === 0) {
        container.innerHTML = '<p style="color:rgba(255,255,255,0.4);text-align:center;">Nenhuma equipe cadastrada.</p>';
        return;
    }

    // Filtrar equipes que têm membros alocados no período
    let relevantEquipes = equipes.filter(eq => {
        const membrosIds = equipesIntegrantes.filter(ei => String(ei.equipe_id) === String(eq.id)).map(ei => ei.integrante_id);
        return alocacoes.some(a => {
            if (!membrosIds.includes(a.integrante_id)) return false;
            const servico = servicos.find(s => s.id === a.servico_id);
            if (!servico || servico.status === 'cancelado') return false;
            if (localFilter && String(servico.local_id) !== String(localFilter)) return false;
            const sInicio = new Date(servico.data_inicio);
            const sFim = new Date(servico.data_fim_real || servico.data_fim_prevista);
            return sInicio <= fim && sFim >= inicio;
        });
    });

    if (relevantEquipes.length === 0) {
        container.innerHTML = '<p style="color:rgba(255,255,255,0.4);text-align:center;">Nenhuma equipe com alocações no período/local.</p>';
        return;
    }

    let html = buildTableHeader(days, 'EQUIPE');

    relevantEquipes.forEach(eq => {
        const membrosIds = equipesIntegrantes.filter(ei => String(ei.equipe_id) === String(eq.id)).map(ei => ei.integrante_id);
        const membrosNomes = membrosIds.map(id => {
            const i = integrantes.find(ig => ig.id === id);
            return i ? i.nome.split(' ')[0] : '?';
        });

        html += `<tr>
            <td style="position:sticky;left:0;background:#1a1a2e;z-index:1;padding:5px 8px;border-bottom:1px solid rgba(255,255,255,0.05);white-space:nowrap;font-size:0.7rem;">
                <i class="fas fa-users" style="color:#ffc107;font-size:0.6rem;"></i> Equipe ${eq.numero}
                <br><small style="color:rgba(255,255,255,0.4);">${membrosNomes.slice(0,3).join(', ')}${membrosNomes.length > 3 ? '...' : ''}</small>
            </td>`;

        days.forEach(d => {
            const dateStr = formatDateInput(d);
            const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
            const dayEnd = new Date(d); dayEnd.setHours(23,59,59,999);

            // Encontrar onde os membros da equipe estão neste dia
            let servicosNoDia = new Set();
            let locaisNoDia = new Set();
            let presentesCount = 0;

            membrosIds.forEach(memId => {
                const memAlocs = alocacoes.filter(a => String(a.integrante_id) === String(memId));
                memAlocs.forEach(a => {
                    const servico = servicos.find(s => s.id === a.servico_id);
                    if (!servico || servico.status === 'cancelado') return;
                    if (localFilter && String(servico.local_id) !== String(localFilter)) return;
                    const sInicio = new Date(servico.data_inicio);
                    const sFim = new Date(servico.data_fim_real || servico.data_fim_prevista);
                    if (sInicio <= dayEnd && sFim >= dayStart) {
                        const ausente = presencas.find(p => 
                            String(p.alocacao_id) === String(a.id) && 
                            String(p.integrante_id) === String(memId) && 
                            p.data === dateStr && !p.presente
                        );
                        if (!ausente) {
                            servicosNoDia.add(servico.nome);
                            const local = locais.find(l => String(l.id) === String(servico.local_id));
                            if (local) locaisNoDia.add(local.nome);
                            presentesCount++;
                        }
                    }
                });
            });

            let cellBg = 'transparent';
            let cellContent = '';
            const isToday = d.toDateString() === new Date().toDateString();
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;

            if (presentesCount > 0) {
                cellBg = 'rgba(76,175,80,0.2)';
                const tooltip = `${presentesCount}/${membrosIds.length} presentes\nLocal: ${Array.from(locaisNoDia).join(', ')}\nServiços: ${Array.from(servicosNoDia).join(', ')}`;
                cellContent = `<span style="font-size:0.55rem;font-weight:700;color:#4caf50;cursor:pointer;" title="${tooltip}">${presentesCount}/${membrosIds.length}</span>`;
            }

            html += `<td style="text-align:center;padding:2px;border-bottom:1px solid rgba(255,255,255,0.05);background:${cellBg};${isToday ? 'border-left:2px solid rgba(76,175,80,0.5);border-right:2px solid rgba(76,175,80,0.5);' : ''}${isWeekend && cellBg === 'transparent' ? 'background:rgba(100,0,0,0.05);' : ''}">${cellContent}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// Helper: Gerar cabeçalho da tabela Gantt
function buildTableHeader(days, label) {
    const totalDays = days.length;
    let html = `<div style="overflow-x:auto;"><table class="gantt-table" style="width:100%;border-collapse:collapse;font-size:0.7rem;min-width:${totalDays * 35 + 200}px;">
        <thead><tr>
            <th style="min-width:180px;position:sticky;left:0;background:#1a1a2e;z-index:2;padding:6px;border-bottom:2px solid rgba(255,255,255,0.2);color:#add8e6;font-size:0.7rem;">${label}</th>
    `;

    days.forEach(d => {
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const isToday = d.toDateString() === new Date().toDateString();
        html += `<th style="min-width:32px;padding:4px 2px;text-align:center;border-bottom:2px solid rgba(255,255,255,0.2);color:${isToday ? '#4caf50' : isWeekend ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)'};font-size:0.6rem;background:${isToday ? 'rgba(76,175,80,0.1)' : isWeekend ? 'rgba(100,0,0,0.1)' : 'transparent'};">${d.getDate()}<br>${['D','S','T','Q','Q','S','S'][d.getDay()]}</th>`;
    });
    html += '</tr></thead><tbody>';
    return html;
}

function getServicoStatusColor(status) {
    return {
        'pendente': '#ffc107',
        'em_andamento': '#2196f3',
        'concluido': '#4caf50',
        'suspenso': '#f44336'
    }[status] || '#9e9e9e';
}

// ===== MODAL FUNCIONÁRIO =====
window.openFuncionarioModal = function(id) {
    const integrante = integrantes.find(i => i.id === id);
    if (!integrante) return;

    document.getElementById('modal-func-title').innerHTML = `<i class="fas fa-user-hard-hat"></i> ${integrante.nome}`;

    const resumo = document.getElementById('func-resumo');
    const servicosList = document.getElementById('func-servicos-list');
    const disponibilidade = document.getElementById('func-disponibilidade');

    // Resumo
    resumo.innerHTML = `
        <p style="font-size:0.85rem;"><b>Nome:</b> ${integrante.nome}</p>
        ${integrante.whatsapp ? `<p style="font-size:0.85rem;"><b>WhatsApp:</b> ${integrante.whatsapp}</p>` : ''}
    `;

    // Serviços alocados
    const integranteAlocs = alocacoes.filter(a => String(a.integrante_id) === String(id));
    if (integranteAlocs.length === 0) {
        servicosList.innerHTML = '<p style="color:rgba(255,255,255,0.4);">Nenhum serviço alocado.</p>';
    } else {
        servicosList.innerHTML = integranteAlocs.map(a => {
            const servico = servicos.find(s => s.id === a.servico_id);
            if (!servico) return '';
            const local = locais.find(l => String(l.id) === String(servico.local_id));
            return `
                <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px;margin-bottom:6px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-weight:600;font-size:0.8rem;">${servico.nome}</span>
                        <span class="timeline-badge status-${servico.status}" style="font-size:0.6rem;">${getServicoStatusLabel(servico.status)}</span>
                    </div>
                    <div style="font-size:0.7rem;color:rgba(255,255,255,0.5);">
                        ${local ? `<i class="fas fa-map-pin"></i> ${local.nome} | ` : ''}
                        ${formatDateTimeBR(a.data_inicio)} → ${formatDateTimeBR(a.data_fim)}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Disponibilidade (próximos 14 dias)
    const hoje = new Date();
    let dispHtml = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;">';
    for (let i = 0; i < 14; i++) {
        const d = new Date(hoje);
        d.setDate(hoje.getDate() + i);
        const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);

        const ocupado = integranteAlocs.some(a => {
            const aInicio = new Date(a.data_inicio);
            const aFim = new Date(a.data_fim);
            return aInicio <= dayEnd && aFim >= dayStart;
        });

        const bgColor = ocupado ? 'rgba(244,67,54,0.3)' : 'rgba(76,175,80,0.2)';
        const label = ocupado ? '🔴' : '🟢';
        dispHtml += `<div style="text-align:center;padding:4px;border-radius:4px;background:${bgColor};font-size:0.65rem;">
            ${d.getDate()}/${d.getMonth()+1}<br>${label}
        </div>`;
    }
    dispHtml += '</div>';
    disponibilidade.innerHTML = dispHtml;

    // Guardar ID para ações
    document.getElementById('modal-funcionario').dataset.integranteId = id;
    openModal('funcionario');
};

window.removeAllAlocacoesFuncionario = async function() {
    const id = document.getElementById('modal-funcionario').dataset.integranteId;
    if (!confirm('Remover este funcionário de TODOS os serviços?')) return;

    try {
        const { error } = await supabase.from('logistica_alocacoes').delete().eq('integrante_id', id);
        if (error) throw error;
        showToast('Funcionário removido de todos os serviços!', 'success');
        closeModal('funcionario');
        await loadAllData();
    } catch (error) {
        showToast('Erro: ' + error.message, 'error');
    }
};

window.removeAlocacoesFuturasFuncionario = async function() {
    const id = document.getElementById('modal-funcionario').dataset.integranteId;
    if (!confirm('Remover este funcionário de todos os serviços FUTUROS?')) return;

    const agora = new Date().toISOString();
    const futuras = alocacoes.filter(a => String(a.integrante_id) === String(id) && new Date(a.data_inicio) > new Date());

    try {
        for (const aloc of futuras) {
            await supabase.from('logistica_alocacoes').delete().eq('id', aloc.id);
        }
        showToast(`${futuras.length} alocação(ões) futura(s) removida(s)!`, 'success');
        closeModal('funcionario');
        await loadAllData();
    } catch (error) {
        showToast('Erro: ' + error.message, 'error');
    }
};

// ===== TOGGLE MAPA =====
window.toggleMap = function() {
    const mapContainer = document.getElementById('map-container');
    const mainLayout = document.getElementById('main-layout');
    const expandBtn = document.getElementById('map-expand-btn');
    
    if (mapContainer.classList.contains('collapsed')) {
        mapContainer.classList.remove('collapsed');
        mainLayout.classList.remove('map-hidden');
        expandBtn.classList.remove('visible');
        setTimeout(() => {
            if (map) google.maps.event.trigger(map, 'resize');
        }, 500);
    } else {
        mapContainer.classList.add('collapsed');
        mainLayout.classList.add('map-hidden');
        expandBtn.classList.add('visible');
    }
};

// ===== TOGGLE POI =====
window.togglePOI = function() {
    poiHidden = !poiHidden;
    map.setOptions({ styles: poiHidden ? mapStylesNoPOI : mapStylesBase });
    const btn = document.querySelector('[onclick="togglePOI()"]');
    if (btn) {
        btn.classList.toggle('active', poiHidden);
        btn.title = poiHidden ? 'Mostrar POIs' : 'Ocultar POIs';
    }
};

// ===== TOGGLE FILTROS DE STATUS =====
window.toggleStatusFilter = function() {
    updateMapMarkers();
};

// ===== UTILITÁRIOS =====
function formatDateBR(date) {
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateShort(date) {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatDateTimeBR(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function toLocalDatetimeInput(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
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

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
    return container;
}

// ===== POPUP INTERATIVO DO GANTT =====
let ganttPopupEl = null;
let selectedPopupIntegrantes = new Set();

window.showGanttPopup = function(event, servicoId, dateStr) {
    event.stopPropagation();
    if (!ganttPopupEl) {
        ganttPopupEl = document.getElementById('gantt-popup');
    }
    if (!ganttPopupEl) return;

    const servico = servicos.find(s => s.id === servicoId);
    if (!servico) return;

    const local = locais.find(l => String(l.id) === String(servico.local_id));
    const presentes = getEquipePresente(servicoId, dateStr);
    const dateParts = dateStr.split('-');
    const dateLabel = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    selectedPopupIntegrantes.clear();
    window._popupServicoId = servicoId;
    window._popupDateStr = dateStr;

    // Listar integrantes não alocados neste serviço para poder adicionar
    const alocadosIds = alocacoes.filter(a => String(a.servico_id) === String(servicoId)).map(a => String(a.integrante_id));
    const naoAlocados = integrantes.filter(i => !alocadosIds.includes(String(i.id)));

    // Datas do serviço para referência
    const sInicio = servico.data_inicio ? servico.data_inicio.substring(0, 16) : '';
    const sFim = (servico.data_fim_real || servico.data_fim_prevista || '').substring(0, 16);

    let html = `
        <div class="gantt-popup-drag-bar" id="gantt-popup-drag-bar">
            <span class="drag-dots"><i class="fas fa-grip-horizontal"></i></span>
            <span style="font-size:0.65rem;color:rgba(255,255,255,0.4);">Arraste para mover | Redimensione pelas bordas</span>
        </div>
        <div class="gantt-popup-header">
            <div>
                <strong style="color:#add8e6;font-size:0.85rem;">${servico.nome}</strong>
                <br><small style="color:rgba(255,255,255,0.5);">${local ? local.nome + ' | ' : ''}${dateLabel}</small>
            </div>
            <button onclick="hideGanttPopup()" style="background:none;border:none;color:white;font-size:1.1rem;cursor:pointer;">&times;</button>
        </div>
        <div class="gantt-popup-body">
            <div style="margin-bottom:8px;font-size:0.75rem;color:#ffc107;font-weight:600;"><i class="fas fa-users"></i> Presentes (${presentes.length})</div>`;

    if (presentes.length > 0) {
        html += '<div class="gantt-popup-integrantes">';
        presentes.forEach(p => {
            const aloc = alocacoes.find(a => String(a.servico_id) === String(servicoId) && String(a.integrante_id) === String(p.id));
            const alocInfo = aloc ? `${formatDateTimeBR(aloc.data_inicio)} → ${formatDateTimeBR(aloc.data_fim)}` : '';
            html += `<div class="gantt-popup-integrante" data-id="${p.id}" onclick="togglePopupIntegrante('${p.id}', this)">
                <span class="gantt-popup-checkbox"><i class="far fa-square"></i></span>
                <span>${p.nome}</span>
                <button class="gantt-popup-remove-btn" onclick="event.stopPropagation(); showRemovePeriodoModal('${servicoId}', '${p.id}', '${dateStr}')" title="Remover (com opção de período)">
                    <i class="fas fa-times"></i>
                </button>
            </div>`;
        });
        html += '</div>';

        // Seção de mover/copiar com seletor de período
        html += `<div class="gantt-popup-actions" id="gantt-popup-move-section" style="display:none;">
            <div style="font-size:0.7rem;color:#90caf9;margin:6px 0 4px;"><i class="fas fa-arrows-alt"></i> Mover/Copiar selecionados para:</div>
            <select id="gantt-popup-target-servico" style="width:100%;padding:5px;border-radius:4px;background:#2a2a4a;color:white;border:1px solid rgba(255,255,255,0.2);font-size:0.7rem;">
                <option value="">Selecionar serviço destino...</option>`;
        servicos.filter(s => s.id !== servicoId && s.status !== 'cancelado').forEach(s => {
            const sLocal = locais.find(l => String(l.id) === String(s.local_id));
            html += `<option value="${s.id}">${s.nome}${sLocal ? ' (' + sLocal.nome + ')' : ''}</option>`;
        });
        html += `</select>
            <div class="periodo-selector">
                <label><i class="fas fa-clock"></i> Período da alocação no destino:</label>
                <div class="periodo-tipo-btns">
                    <button class="periodo-tipo-btn active" data-tipo="servico_inteiro" onclick="selectPeriodoTipo(this, 'move')">Serviço Inteiro</button>
                    <button class="periodo-tipo-btn" data-tipo="dia" onclick="selectPeriodoTipo(this, 'move')">Só Este Dia</button>
                    <button class="periodo-tipo-btn" data-tipo="periodo" onclick="selectPeriodoTipo(this, 'move')">Período Personalizado</button>
                    <button class="periodo-tipo-btn" data-tipo="horario" onclick="selectPeriodoTipo(this, 'move')">Horário Específico</button>
                </div>
                <div class="periodo-inputs" id="periodo-inputs-move">
                    <input type="datetime-local" id="periodo-move-inicio" style="flex:1;">
                    <input type="datetime-local" id="periodo-move-fim" style="flex:1;">
                </div>
            </div>
            <button onclick="moveSelectedToServico('${servicoId}')" class="gantt-popup-move-btn"><i class="fas fa-share"></i> Mover</button>
            <button onclick="copySelectedToServico('${servicoId}')" class="gantt-popup-copy-btn"><i class="fas fa-copy"></i> Copiar</button>
        </div>`;
    } else {
        html += '<p style="color:rgba(255,255,255,0.3);font-size:0.7rem;">Nenhum integrante neste dia.</p>';
    }

    // Seção para adicionar novos integrantes com seletor de período
    html += `<div style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px;">
        <div style="font-size:0.7rem;color:#4caf50;margin-bottom:4px;"><i class="fas fa-plus"></i> Adicionar ao serviço</div>
        <select id="gantt-popup-add-integrante" style="width:100%;padding:5px;border-radius:4px;background:#2a2a4a;color:white;border:1px solid rgba(255,255,255,0.2);font-size:0.7rem;">
            <option value="">Selecionar funcionário...</option>`;
    naoAlocados.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(i => {
        html += `<option value="${i.id}">${i.nome}</option>`;
    });
    // Adicionar equipes também
    html += `</select>
        <div class="periodo-selector">
            <label><i class="fas fa-clock"></i> Período:</label>
            <div class="periodo-tipo-btns">
                <button class="periodo-tipo-btn active" data-tipo="servico_inteiro" onclick="selectPeriodoTipo(this, 'add')">Serviço Inteiro</button>
                <button class="periodo-tipo-btn" data-tipo="dia" onclick="selectPeriodoTipo(this, 'add')">Só Este Dia</button>
                <button class="periodo-tipo-btn" data-tipo="periodo" onclick="selectPeriodoTipo(this, 'add')">Período Personalizado</button>
                <button class="periodo-tipo-btn" data-tipo="horario" onclick="selectPeriodoTipo(this, 'add')">Horário Específico</button>
            </div>
            <div class="periodo-inputs" id="periodo-inputs-add">
                <input type="datetime-local" id="periodo-add-inicio" style="flex:1;">
                <input type="datetime-local" id="periodo-add-fim" style="flex:1;">
            </div>
        </div>
        <button onclick="addIntegranteFromPopup('${servicoId}')" style="margin-top:4px;width:100%;padding:4px;border-radius:4px;background:#4caf50;color:white;border:none;font-size:0.7rem;cursor:pointer;"><i class="fas fa-plus"></i> Adicionar</button>
    </div>`;

    html += '</div>';
    ganttPopupEl.innerHTML = html;

    // Posicionar popup perto do clique
    const rect = event.target.getBoundingClientRect();
    ganttPopupEl.style.display = 'block';
    let left = rect.right + 10;
    let top = rect.top - 50;
    if (left + 340 > window.innerWidth) left = rect.left - 350;
    if (top + 450 > window.innerHeight) top = window.innerHeight - 460;
    if (top < 10) top = 10;
    ganttPopupEl.style.left = left + 'px';
    ganttPopupEl.style.top = top + 'px';

    // Ativar drag na barra
    initPopupDrag();
};

window.hideGanttPopup = function() {
    if (ganttPopupEl) ganttPopupEl.style.display = 'none';
};

// Fechar popup ao clicar fora
document.addEventListener('click', function(e) {
    if (ganttPopupEl && ganttPopupEl.style.display === 'block') {
        if (!ganttPopupEl.contains(e.target) && !e.target.classList.contains('gantt-cell-clickable')) {
            hideGanttPopup();
        }
    }
});

window.togglePopupIntegrante = function(id, el) {
    if (selectedPopupIntegrantes.has(id)) {
        selectedPopupIntegrantes.delete(id);
        el.classList.remove('selected');
        el.querySelector('.gantt-popup-checkbox i').className = 'far fa-square';
    } else {
        selectedPopupIntegrantes.add(id);
        el.classList.add('selected');
        el.querySelector('.gantt-popup-checkbox i').className = 'fas fa-check-square';
    }
    // Mostrar/ocultar seção de mover
    const moveSection = document.getElementById('gantt-popup-move-section');
    if (moveSection) moveSection.style.display = selectedPopupIntegrantes.size > 0 ? 'block' : 'none';
};

// ===== SELETOR DE PERÍODO =====
window.selectPeriodoTipo = function(btn, contexto) {
    // Remove active de todos os botões do mesmo grupo
    const container = btn.closest('.periodo-tipo-btns');
    container.querySelectorAll('.periodo-tipo-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Mostrar/ocultar inputs de data
    const inputsDiv = document.getElementById(`periodo-inputs-${contexto}`);
    if (inputsDiv) {
        const tipo = btn.getAttribute('data-tipo');
        if (tipo === 'periodo' || tipo === 'horario') {
            inputsDiv.classList.add('visible');
            // Pré-preencher com data do dia clicado
            const dateStr = window._popupDateStr || '';
            const inicioInput = document.getElementById(`periodo-${contexto}-inicio`);
            const fimInput = document.getElementById(`periodo-${contexto}-fim`);
            if (inicioInput && dateStr) {
                if (tipo === 'horario') {
                    inicioInput.value = dateStr + 'T07:00';
                    if (fimInput) fimInput.value = dateStr + 'T17:00';
                } else {
                    inicioInput.value = dateStr + 'T00:00';
                    if (fimInput) fimInput.value = dateStr + 'T23:59';
                }
            }
        } else {
            inputsDiv.classList.remove('visible');
        }
    }
};

function getPeriodoDates(contexto, servicoId, dateStr) {
    const servico = servicos.find(s => s.id === servicoId);
    if (!servico) return null;

    // Encontrar o tipo ativo
    let tipoAtivo = 'servico_inteiro';
    const popup = document.getElementById('gantt-popup');
    if (popup) {
        // Buscar dentro do contexto correto
        const allSelectors = popup.querySelectorAll('.periodo-selector');
        let selectorDiv = null;
        if (contexto === 'add') {
            // É o último periodo-selector no popup
            selectorDiv = allSelectors[allSelectors.length - 1];
        } else if (contexto === 'move') {
            // É o primeiro periodo-selector (dentro do move-section)
            selectorDiv = allSelectors[0];
        } else if (contexto === 'remove') {
            // Dentro do remove-modal
            selectorDiv = document.getElementById('remove-periodo-selector');
        }
        if (selectorDiv) {
            const activeBtn = selectorDiv.querySelector('.periodo-tipo-btn.active');
            if (activeBtn) tipoAtivo = activeBtn.getAttribute('data-tipo');
        }
    }

    switch (tipoAtivo) {
        case 'servico_inteiro':
            return {
                inicio: servico.data_inicio,
                fim: servico.data_fim_real || servico.data_fim_prevista
            };
        case 'dia':
            return {
                inicio: dateStr + 'T00:00:00',
                fim: dateStr + 'T23:59:59'
            };
        case 'periodo':
        case 'horario': {
            const inicioInput = document.getElementById(`periodo-${contexto}-inicio`);
            const fimInput = document.getElementById(`periodo-${contexto}-fim`);
            const inicio = inicioInput ? inicioInput.value : (dateStr + 'T00:00:00');
            const fim = fimInput ? fimInput.value : (dateStr + 'T23:59:59');
            if (!inicio || !fim) {
                showToast('Preencha as datas de início e fim.', 'warning');
                return null;
            }
            return { inicio, fim };
        }
        default:
            return {
                inicio: servico.data_inicio,
                fim: servico.data_fim_real || servico.data_fim_prevista
            };
    }
}

// ===== POPUP DRAG =====
function initPopupDrag() {
    const dragBar = document.getElementById('gantt-popup-drag-bar');
    const popup = document.getElementById('gantt-popup');
    if (!dragBar || !popup) return;

    let isDragging = false;
    let offsetX = 0, offsetY = 0;

    dragBar.addEventListener('mousedown', function(e) {
        isDragging = true;
        offsetX = e.clientX - popup.offsetLeft;
        offsetY = e.clientY - popup.offsetTop;
        e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;
        // Limitar dentro da viewport
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - 100));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - 50));
        popup.style.left = newLeft + 'px';
        popup.style.top = newTop + 'px';
    });

    document.addEventListener('mouseup', function() {
        isDragging = false;
    });
}

// ===== REMOVER COM PERÍODO =====
window.showRemovePeriodoModal = function(servicoId, integranteId, dateStr) {
    const popup = document.getElementById('gantt-popup');
    if (!popup) return;

    const integrante = integrantes.find(i => String(i.id) === String(integranteId));
    const nome = integrante ? integrante.nome : 'Funcionário';

    // Injetar painel de remoção dentro do popup body
    let existingModal = document.getElementById('remove-periodo-modal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
        <div id="remove-periodo-modal" style="position:absolute;bottom:0;left:0;right:0;background:#2a1a3e;border-top:2px solid #f44336;padding:12px;border-radius:0 0 10px 10px;z-index:10;">
            <div style="font-size:0.75rem;color:#f44336;font-weight:600;margin-bottom:6px;"><i class="fas fa-user-minus"></i> Remover ${nome}</div>
            <div id="remove-periodo-selector" class="periodo-selector" style="margin-top:0;">
                <label><i class="fas fa-clock"></i> Período de remoção:</label>
                <div class="periodo-tipo-btns">
                    <button class="periodo-tipo-btn active" data-tipo="servico_inteiro" onclick="selectPeriodoTipo(this, 'remove')">Serviço Inteiro</button>
                    <button class="periodo-tipo-btn" data-tipo="dia" onclick="selectPeriodoTipo(this, 'remove')">Só Este Dia</button>
                    <button class="periodo-tipo-btn" data-tipo="periodo" onclick="selectPeriodoTipo(this, 'remove')">Período Personalizado</button>
                    <button class="periodo-tipo-btn" data-tipo="horario" onclick="selectPeriodoTipo(this, 'remove')">Horário Específico</button>
                </div>
                <div class="periodo-inputs" id="periodo-inputs-remove">
                    <input type="datetime-local" id="periodo-remove-inicio" style="flex:1;">
                    <input type="datetime-local" id="periodo-remove-fim" style="flex:1;">
                </div>
            </div>
            <div style="display:flex;gap:6px;margin-top:8px;">
                <button onclick="removeIntegranteComPeriodo('${servicoId}', '${integranteId}', '${dateStr}')" style="flex:1;padding:5px;border-radius:4px;background:#f44336;color:white;border:none;font-size:0.7rem;cursor:pointer;"><i class="fas fa-check"></i> Confirmar Remoção</button>
                <button onclick="document.getElementById('remove-periodo-modal').remove()" style="flex:1;padding:5px;border-radius:4px;background:rgba(255,255,255,0.1);color:white;border:1px solid rgba(255,255,255,0.2);font-size:0.7rem;cursor:pointer;"><i class="fas fa-times"></i> Cancelar</button>
            </div>
        </div>
    `;

    popup.style.position = 'fixed'; // Garantir que position é fixed para o modal absoluto funcionar
    popup.insertAdjacentHTML('beforeend', modalHtml);
};

window.removeIntegranteComPeriodo = async function(servicoId, integranteId, dateStr) {
    const periodo = getPeriodoDates('remove', servicoId, dateStr);
    if (!periodo) return;

    const aloc = alocacoes.find(a => String(a.servico_id) === String(servicoId) && String(a.integrante_id) === String(integranteId));
    if (!aloc) { showToast('Alocação não encontrada.', 'error'); return; }

    const alocInicio = new Date(aloc.data_inicio);
    const alocFim = new Date(aloc.data_fim);
    const remInicio = new Date(periodo.inicio);
    const remFim = new Date(periodo.fim);

    // Determinar tipo de remoção
    if (remInicio <= alocInicio && remFim >= alocFim) {
        // Remoção total - deletar alocação
        const { error } = await supabase.from('logistica_alocacoes').delete().eq('id', aloc.id);
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        showToast('Funcionário removido do serviço inteiro!', 'success');
    } else if (remInicio <= alocInicio && remFim < alocFim) {
        // Remoção do início - ajustar data_inicio
        const novoInicio = new Date(remFim.getTime() + 1000).toISOString();
        const { error } = await supabase.from('logistica_alocacoes').update({ data_inicio: novoInicio }).eq('id', aloc.id);
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        showToast('Período inicial removido!', 'success');
    } else if (remInicio > alocInicio && remFim >= alocFim) {
        // Remoção do final - ajustar data_fim
        const novoFim = new Date(remInicio.getTime() - 1000).toISOString();
        const { error } = await supabase.from('logistica_alocacoes').update({ data_fim: novoFim }).eq('id', aloc.id);
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        showToast('Período final removido!', 'success');
    } else {
        // Remoção do meio - split em duas alocações
        const fimPrimeira = new Date(remInicio.getTime() - 1000).toISOString();
        const inicioSegunda = new Date(remFim.getTime() + 1000).toISOString();

        // Atualizar a alocação existente para a primeira parte
        const { error: err1 } = await supabase.from('logistica_alocacoes').update({ data_fim: fimPrimeira }).eq('id', aloc.id);
        if (err1) { showToast('Erro: ' + err1.message, 'error'); return; }

        // Criar nova alocação para a segunda parte
        const { error: err2 } = await supabase.from('logistica_alocacoes').insert({
            servico_id: servicoId,
            integrante_id: integranteId,
            data_inicio: inicioSegunda,
            data_fim: aloc.data_fim
        });
        if (err2) { showToast('Erro ao criar segunda parte: ' + err2.message, 'error'); return; }
        showToast('Período intermediário removido (alocação dividida)!', 'success');
    }

    hideGanttPopup();
    await loadAllData();
};

// ===== MOVER/COPIAR/ADICIONAR COM PERÍODO =====
window.moveSelectedToServico = async function(fromServicoId) {
    const targetId = document.getElementById('gantt-popup-target-servico')?.value;
    if (!targetId) { showToast('Selecione o serviço destino.', 'warning'); return; }
    if (selectedPopupIntegrantes.size === 0) { showToast('Selecione funcionários.', 'warning'); return; }

    const periodo = getPeriodoDates('move', targetId, window._popupDateStr);
    if (!periodo) return;

    let moved = 0;
    for (const integId of selectedPopupIntegrantes) {
        // Remover do serviço atual
        const aloc = alocacoes.find(a => String(a.servico_id) === String(fromServicoId) && String(a.integrante_id) === String(integId));
        if (aloc) {
            await supabase.from('logistica_alocacoes').delete().eq('id', aloc.id);
        }
        // Verificar se já está no destino
        const jaExiste = alocacoes.find(a => String(a.servico_id) === String(targetId) && String(a.integrante_id) === String(integId));
        if (!jaExiste) {
            await supabase.from('logistica_alocacoes').insert({
                servico_id: targetId,
                integrante_id: integId,
                data_inicio: periodo.inicio,
                data_fim: periodo.fim
            });
        }
        moved++;
    }

    showToast(`${moved} funcionário(s) movido(s)!`, 'success');
    hideGanttPopup();
    await loadAllData();
};

window.copySelectedToServico = async function(fromServicoId) {
    const targetId = document.getElementById('gantt-popup-target-servico')?.value;
    if (!targetId) { showToast('Selecione o serviço destino.', 'warning'); return; }
    if (selectedPopupIntegrantes.size === 0) { showToast('Selecione funcionários.', 'warning'); return; }

    const periodo = getPeriodoDates('move', targetId, window._popupDateStr);
    if (!periodo) return;

    let copied = 0;
    for (const integId of selectedPopupIntegrantes) {
        const jaExiste = alocacoes.find(a => String(a.servico_id) === String(targetId) && String(a.integrante_id) === String(integId));
        if (!jaExiste) {
            await supabase.from('logistica_alocacoes').insert({
                servico_id: targetId,
                integrante_id: integId,
                data_inicio: periodo.inicio,
                data_fim: periodo.fim
            });
            copied++;
        }
    }

    showToast(`${copied} funcionário(s) copiado(s)!`, 'success');
    hideGanttPopup();
    await loadAllData();
};

window.removeIntegranteFromServico = async function(servicoId, integranteId) {
    // Mantida para compatibilidade, mas agora redireciona para o modal de período
    showRemovePeriodoModal(servicoId, integranteId, window._popupDateStr || '');
};

window.addIntegranteFromPopup = async function(servicoId) {
    const sel = document.getElementById('gantt-popup-add-integrante');
    if (!sel || !sel.value) { showToast('Selecione um funcionário.', 'warning'); return; }

    const periodo = getPeriodoDates('add', servicoId, window._popupDateStr);
    if (!periodo) return;

    const { error } = await supabase.from('logistica_alocacoes').insert({
        servico_id: servicoId,
        integrante_id: sel.value,
        data_inicio: periodo.inicio,
        data_fim: periodo.fim
    });

    if (error) { showToast('Erro: ' + error.message, 'error'); return; }
    showToast('Funcionário adicionado!', 'success');
    hideGanttPopup();
    await loadAllData();
};

// ===== DRAG EDGE - AJUSTAR DATAS ARRASTANDO BORDAS =====
let dragState = null;

window.startDragEdge = function(event, servicoId, edge) {
    event.preventDefault();
    event.stopPropagation();

    const cell = event.target.closest('td');
    const row = cell.closest('tr');
    const table = row.closest('table');
    const allCells = Array.from(row.querySelectorAll('td'));

    dragState = {
        servicoId,
        edge,
        startX: event.clientX,
        row,
        table,
        allCells
    };

    document.addEventListener('mousemove', onDragEdgeMove);
    document.addEventListener('mouseup', onDragEdgeUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
};

function onDragEdgeMove(event) {
    if (!dragState) return;
    // Highlight da coluna sob o mouse
    const cells = dragState.allCells;
    cells.forEach(c => c.style.outline = '');
    const el = document.elementFromPoint(event.clientX, event.clientY);
    if (el) {
        const td = el.closest('td');
        if (td && dragState.row.contains(td)) {
            td.style.outline = '2px solid #ffc107';
        }
    }
}

async function onDragEdgeUp(event) {
    if (!dragState) return;
    document.removeEventListener('mousemove', onDragEdgeMove);
    document.removeEventListener('mouseup', onDragEdgeUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Encontrar a célula onde soltou
    const el = document.elementFromPoint(event.clientX, event.clientY);
    if (!el) { dragState = null; return; }
    const td = el.closest('td');
    if (!td) { dragState = null; return; }

    const dateStr = td.dataset.date;
    if (!dateStr) { dragState = null; return; }

    const servico = servicos.find(s => s.id === dragState.servicoId);
    if (!servico) { dragState = null; return; }

    const newDate = new Date(dateStr + 'T12:00:00');
    const oldInicio = new Date(servico.data_inicio);
    const oldFim = new Date(servico.data_fim_real || servico.data_fim_prevista);

    let updateData = {};
    if (dragState.edge === 'start') {
        if (newDate >= oldFim) {
            showToast('Início não pode ser após o fim.', 'warning');
            dragState = null; return;
        }
        newDate.setHours(oldInicio.getHours(), oldInicio.getMinutes(), 0, 0);
        updateData.data_inicio = newDate.toISOString();
    } else {
        if (newDate <= oldInicio) {
            showToast('Fim não pode ser antes do início.', 'warning');
            dragState = null; return;
        }
        newDate.setHours(oldFim.getHours(), oldFim.getMinutes(), 0, 0);
        updateData.data_fim_prevista = newDate.toISOString();
    }

    const { error } = await supabase.from('logistica_servicos').update(updateData).eq('id', dragState.servicoId);
    if (error) {
        showToast('Erro ao ajustar data: ' + error.message, 'error');
    } else {
        const edgeLabel = dragState.edge === 'start' ? 'Início' : 'Fim';
        showToast(`${edgeLabel} ajustado para ${dateStr.split('-').reverse().join('/')}`, 'success');
        // Atualizar alocações deste serviço para refletir novas datas
        const servicoAlocs = alocacoes.filter(a => String(a.servico_id) === String(dragState.servicoId));
        for (const aloc of servicoAlocs) {
            const alocUpdate = {};
            if (dragState.edge === 'start') alocUpdate.data_inicio = updateData.data_inicio;
            if (dragState.edge === 'end') alocUpdate.data_fim = updateData.data_fim_prevista;
            await supabase.from('logistica_alocacoes').update(alocUpdate).eq('id', aloc.id);
        }
        await loadAllData();
    }
    dragState = null;
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', function() {
    // Se Google Maps já carregou, inicializar
    if (typeof google !== 'undefined' && google.maps) {
        initMapInternal();
    }
    // Caso contrário, o callback do script do Google Maps chamará window.initMap
});

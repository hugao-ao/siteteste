// locacoes.js — Card "Aluguel de espaços" da área Argos
// A clínica atende e também aluga. Esta tela é o cadastro dos contratos e o
// quadro do mês: quem tem a chave de qual sala, em que turnos, por quanto.
//
// Toda a matemática (calendário do aluguel, choque de turno, valor do mês)
// mora em argos-locacoes.js — aqui só se pergunta e se desenha.

import { sb, todas, toast, esc, abrirModal, fecharModal } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import { formataMoeda, formataBR, hojeISO } from './argos-recorrencia.js';
import {
    TURNOS, DOW, RECORRENCIAS, COBRANCAS, turnosDaLocacao, descreveTurnos,
    ocorrenciasNoMes, conflitosDeLocacao, valorNoMes, resumoDoMes, ocupacaoDasSalas
} from './argos-locacoes.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };
let salas = [], locacoes = [];
let editandoId = null;

const el = id => document.getElementById(id);
const mesAtual = () => el('loc-mes').value || hojeISO().slice(0, 7);
const nomeSala = id => (salas.find(s => s.id === id) || {}).nome || 'Sem espaço';

async function carregarTudo() {
    const [rSalas, rLoc] = await Promise.all([
        sb.from('argos_salas').select('*').order('nome'),
        todas(() => sb.from('argos_locacoes').select('*'))
    ]);
    if (rSalas.error || rLoc.error) {
        console.error(rSalas.error || rLoc.error);
        toast('Erro ao carregar as locações.', true);
        return;
    }
    salas = rSalas.data || [];
    locacoes = (rLoc.data || []).sort((a, b) =>
        String(a.locatario).localeCompare(String(b.locatario)));
    montarFiltros();
    render();
}

function montarFiltros() {
    const sel = el('loc-filtro-sala');
    const atual = sel.value;
    sel.innerHTML = '<option value="">🚪 Todos os espaços</option>'
        + salas.map(s => `<option value="${s.id}">${esc(s.nome)}</option>`).join('');
    sel.value = atual || '';
    // o select do formulário também vive dos espaços carregados
    const form = el('loc-sala');
    const escolhida = form.value;
    form.innerHTML = '<option value="">— Espaço —</option>'
        + salas.map(s => `<option value="${s.id}">${esc(s.nome)}</option>`).join('');
    form.value = escolhida || '';
}

/** As locações que a tela mostra, pelo filtro de situação e de espaço. */
function visiveis() {
    const mes = mesAtual();
    const sala = el('loc-filtro-sala').value;
    const sit = el('loc-filtro-situacao').value;
    return locacoes.filter(l => {
        if (sala && l.sala_id !== sala) return false;
        if (sit === 'todas') return true;
        if (l.ativo === false) return false;
        if (sit === 'ativas') return true;
        return ocorrenciasNoMes(l, mes).length > 0;   // vigentes no mês
    });
}

// ---------------------------------------------------------------------------
// A tela
// ---------------------------------------------------------------------------

function render() {
    const mes = mesAtual();
    const lista = visiveis();
    const r = resumoDoMes(lista, mes, salas);

    el('loc-resumo').innerHTML = `
      <div class="resumo-linha">
        <span class="resumo-item"><b>${r.locatarios}</b> locatário(s) no mês</span>
        <span class="resumo-item"><b>${r.turnos}</b> turno(s) alugado(s)</span>
        <span class="resumo-item">Receita do mês: <b>${formataMoeda(r.total)}</b></span>
      </div>`;

    el('loc-lista').innerHTML = lista.length ? lista.map(l => {
        const v = valorNoMes(l, mes);
        const noMes = ocorrenciasNoMes(l, mes);
        const proxima = noMes[0];
        return `
      <div class="argos-bloco ${l.ativo === false ? 'inativo' : ''}">
        <div class="bloco-topo">
          <b>🔑 ${esc(l.locatario)}</b>
          <span>
            <button class="argos-btn small" data-loc-editar="${l.id}"
              data-argos-recurso="locacoes_gerenciar">✏️</button>
            <button class="argos-btn small danger" data-loc-excluir="${l.id}"
              data-argos-recurso="locacoes_gerenciar">🗑️</button>
          </span>
        </div>
        <div class="bloco-info">
          <b>${esc(nomeSala(l.sala_id))}</b> · ${esc(descreveTurnos(l))}
          · ${esc(RECORRENCIAS[l.recorrencia] || l.recorrencia)}
          <br>Vigência: ${formataBR(l.data_inicio)}${l.data_fim ? ` até ${formataBR(l.data_fim)}` : ' — sem prazo'}
          ${l.ativo === false ? ' · <span class="badge vermelho">Encerrada</span>' : ''}
          <br>${noMes.length
              ? `📅 <b>${noMes.length}</b> turno(s) neste mês (a partir de ${formataBR(proxima.data)})`
              : '<span class="dim">📅 sem turnos neste mês</span>'}
          · 💰 <b>${formataMoeda(v.valor)}</b> <span class="dim">(${esc(v.base)})</span>
          ${l.dia_vencimento ? ` · vence dia ${l.dia_vencimento}` : ''}
          ${l.documento || l.contato ? `<br><span class="dim">${esc([l.documento, l.contato].filter(Boolean).join(' · '))}</span>` : ''}
          ${l.observacoes ? `<br><span class="dim">${esc(l.observacoes)}</span>` : ''}
        </div>
      </div>`;
    }).join('') : '<p class="dim">Nenhuma locação com esses filtros.</p>';

    const oc = ocupacaoDasSalas(locacoes.filter(l => l.ativo !== false), mes, salas);
    el('loc-ocupacao').innerHTML = salas.length ? `
      <div class="tabela-rolagem"><table class="argos-tabela compacta">
        <thead><tr><th>Espaço</th><th>Turnos alugados</th><th>Turnos do mês</th><th>Ocupação</th></tr></thead>
        <tbody>${oc.map(o => `<tr>
          <td>${esc(o.nome)}</td><td>${o.turnos}</td><td class="dim">${o.total}</td>
          <td>${o.percentual}%</td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="dim">Nenhum espaço cadastrado ainda — cadastre em Agenda › Espaços.</p>';

    perm.aplicarVisibilidade();
}

['loc-mes', 'loc-filtro-sala', 'loc-filtro-situacao'].forEach(id =>
    el(id).addEventListener('change', render));
el('btn-loc-imprimir').addEventListener('click', () => window.print());

// ---------------------------------------------------------------------------
// O formulário
// ---------------------------------------------------------------------------

function montarSelects() {
    el('loc-recorrencia').innerHTML = Object.entries(RECORRENCIAS)
        .map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
    el('loc-cobranca').innerHTML = Object.entries(COBRANCAS)
        .map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
    // a grade de turnos: uma linha por turno, uma coluna por dia da semana
    const thead = el('tabela-turnos').querySelector('thead tr');
    thead.innerHTML = '<th>Turno</th>' + DOW.map(d => `<th>${d.curto}</th>`).join('');
    el('tabela-turnos').querySelector('tbody').innerHTML = TURNOS.map(t => `
      <tr><td><b>${t.rotulo}</b> <span class="dim">${t.de}–${t.ate}</span></td>
        ${DOW.map(d => `<td style="text-align:center">
          <input type="checkbox" data-turno="${t.chave}" data-dow="${d.dow}"
            title="${d.rotulo} · ${t.rotulo}" /></td>`).join('')}
      </tr>`).join('');
}

function lerTurnosDoForm() {
    return [...document.querySelectorAll('#tabela-turnos input:checked')]
        .map(c => ({ dow: Number(c.dataset.dow), turno: c.dataset.turno }));
}

function marcarTurnosNoForm(turnos = []) {
    const marcados = new Set((turnos || []).map(t => `${t.dow}|${t.turno}`));
    document.querySelectorAll('#tabela-turnos input').forEach(c => {
        c.checked = marcados.has(`${c.dataset.dow}|${c.dataset.turno}`);
    });
}

/** O registro que o formulário está descrevendo agora. */
function locacaoDoForm() {
    return {
        id: editandoId,
        sala_id: el('loc-sala').value || null,
        locatario: el('loc-locatario').value.trim(),
        documento: el('loc-documento').value.trim() || null,
        contato: el('loc-contato').value.trim() || null,
        tipo: el('loc-tipo').value,
        turnos: el('loc-tipo').value === 'integral' ? [] : lerTurnosDoForm(),
        recorrencia: el('loc-recorrencia').value,
        data_inicio: el('loc-inicio').value || null,
        data_fim: el('loc-fim').value || null,
        valor: Number(el('loc-valor').value) || 0,
        cobranca: el('loc-cobranca').value,
        dia_vencimento: Number(el('loc-vencimento').value) || null,
        observacoes: el('loc-obs').value.trim() || null,
        ativo: el('loc-ativo').checked
    };
}

/** Mostra, antes de salvar, o calendário que este contrato vai gerar. */
function renderPreviaEConflitos() {
    const loc = locacaoDoForm();
    el('loc-bloco-turnos').style.display = loc.tipo === 'integral' ? 'none' : '';
    if (!loc.data_inicio || (!turnosDaLocacao(loc).length)) {
        el('loc-previa').textContent = '';
        el('loc-conflitos').innerHTML = '';
        return;
    }
    const mes = String(loc.data_inicio).slice(0, 7);
    const noMes = ocorrenciasNoMes(loc, mes);
    const v = valorNoMes(loc, mes);
    el('loc-previa').innerHTML = `📅 <b>${esc(descreveTurnos(loc))}</b> —
      ${noMes.length} turno(s) no mês de início${noMes.length
        ? ` (${noMes.slice(0, 4).map(o => formataBR(o.data)).join(', ')}${noMes.length > 4 ? '…' : ''})` : ''}.
      💰 ${formataMoeda(v.valor)} <span class="dim">(${esc(v.base)})</span>`;

    const conflitos = conflitosDeLocacao(loc, locacoes);
    const janela = loc.data_fim
        ? `de ${formataBR(loc.data_inicio)} a ${formataBR(loc.data_fim)}`
        : 'no ano a partir do início (o contrato não tem prazo)';
    el('loc-conflitos').innerHTML = conflitos.length ? `
      <p class="dica" style="color:#ef4444"><b>⚠️ Esse espaço já está alugado nesses turnos</b>
        <span class="dim">— conferido ${janela}:</span><br>
        ${conflitos.map(c => `«${esc(c.locacao.locatario)}» — ${c.quantos} vez(es),
          a partir de ${formataBR(c.primeiro.data)} (${esc(c.turnos.join(', '))})`).join('<br>')}
        <br>Dá para salvar assim mesmo, mas confira: duas pessoas com a chave da
        mesma sala no mesmo turno não é problema que se resolve na hora.</p>` : '';
}

['loc-tipo', 'loc-recorrencia', 'loc-inicio', 'loc-fim', 'loc-valor', 'loc-cobranca', 'loc-sala']
    .forEach(id => {
        el(id).addEventListener('change', renderPreviaEConflitos);
        el(id).addEventListener('input', renderPreviaEConflitos);
    });
el('tabela-turnos').addEventListener('change', renderPreviaEConflitos);

function abrirForm(loc) {
    editandoId = loc ? loc.id : null;
    el('loc-form-titulo').textContent = loc ? `Editando: ${loc.locatario}` : 'Nova locação';
    el('loc-locatario').value = loc ? loc.locatario || '' : '';
    el('loc-documento').value = loc ? loc.documento || '' : '';
    el('loc-contato').value = loc ? loc.contato || '' : '';
    el('loc-sala').value = loc ? loc.sala_id || '' : '';
    el('loc-tipo').value = loc ? loc.tipo || 'turnos' : 'turnos';
    el('loc-recorrencia').value = loc ? loc.recorrencia || 'semanal' : 'semanal';
    el('loc-inicio').value = loc ? loc.data_inicio || '' : hojeISO();
    el('loc-fim').value = loc ? loc.data_fim || '' : '';
    el('loc-vencimento').value = loc ? loc.dia_vencimento || '' : '';
    el('loc-valor').value = loc ? loc.valor || '' : '';
    el('loc-cobranca').value = loc ? loc.cobranca || 'mensal' : 'mensal';
    el('loc-obs').value = loc ? loc.observacoes || '' : '';
    el('loc-ativo').checked = loc ? loc.ativo !== false : true;
    marcarTurnosNoForm(loc ? loc.turnos : []);
    renderPreviaEConflitos();
    abrirModal('modal-locacao');
}

el('btn-loc-nova').addEventListener('click', () => abrirForm(null));

el('loc-lista').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-loc-editar]');
    if (ed) { abrirForm(locacoes.find(l => l.id === ed.dataset.locEditar)); return; }
    const del = e.target.closest('[data-loc-excluir]');
    if (!del) return;
    const l = locacoes.find(x => x.id === del.dataset.locExcluir);
    if (!l) return;
    if (!confirm(`Excluir a locação de «${l.locatario}» em ${nomeSala(l.sala_id)}?\n\n`
        + 'Se o contrato apenas acabou, prefira desmarcar "Locação ativa" na edição — '
        + 'assim o histórico dos meses passados continua existindo.')) return;
    const { error } = await sb.from('argos_locacoes').delete().eq('id', l.id);
    if (error) { console.error(error); toast('Erro ao excluir a locação.', true); return; }
    toast('Locação excluída.');
    await carregarTudo();
});

el('form-locacao').addEventListener('submit', async (e) => {
    e.preventDefault();
    const loc = locacaoDoForm();
    if (!loc.locatario) { toast('Informe quem está alugando.', true); return; }
    if (!loc.sala_id) { toast('Escolha o espaço alugado.', true); return; }
    if (!loc.data_inicio) { toast('Informe a partir de quando vale.', true); return; }
    if (loc.data_fim && loc.data_fim < loc.data_inicio) {
        toast('A data final não pode ser antes do início.', true); return;
    }
    if (loc.tipo === 'turnos' && !loc.turnos.length) {
        toast('Marque pelo menos um turno — ou escolha "Integral".', true); return;
    }
    const registro = { ...loc, atualizado_em: new Date().toISOString() };
    delete registro.id;
    const q = editandoId
        ? sb.from('argos_locacoes').update(registro).eq('id', editandoId)
        : sb.from('argos_locacoes').insert(registro);
    const { error } = await q;
    if (error) { console.error(error); toast('Erro ao salvar a locação.', true); return; }
    toast(editandoId ? 'Locação atualizada.' : 'Locação cadastrada.');
    fecharModal('modal-locacao');
    await carregarTudo();
});

// ---------------------------------------------------------------------------
(async function init() {
    perm = await carregarPermissoes();
    if (!perm.pode('locacoes_ver') && !perm.master) {
        document.querySelector('main').innerHTML =
            '<p class="dim" style="padding:30px">Sem permissão para ver o aluguel de espaços.</p>';
        return;
    }
    perm.aplicarVisibilidade();
    el('loc-mes').value = hojeISO().slice(0, 7);
    montarSelects();
    await carregarTudo();
})();

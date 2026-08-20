// fechamento.js — Card "Fechamento Mensal" da área Argos
// Relatório do acerto financeiro de cada paciente no mês escolhido, com o
// detalhe das frequências, calculado pelas dinâmicas financeiras.

import { sb, toast, esc } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import { fechamentoPaciente, formataMoeda, hojeISO } from './argos-recorrencia.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };
let pacientes = [], dinamicas = [], sessoes = [];
let abertos = new Set(); // pacientes com detalhe expandido

async function carregarTudo() {
    const [rPac, rDin, rSes] = await Promise.all([
        sb.from('argos_pacientes').select('*').order('nome'),
        sb.from('argos_dinamicas').select('*'),
        sb.from('argos_sessoes').select('*')
    ]);
    const erro = rPac.error || rDin.error || rSes.error;
    if (erro) { console.error(erro); toast('Erro ao carregar dados.', true); return; }
    pacientes = rPac.data || [];
    dinamicas = rDin.data || [];
    sessoes = rSes.data || [];
    render();
}

function render() {
    const mes = document.getElementById('mes-ref').value;
    if (!mes) return;
    const soMovimento = document.getElementById('so-movimento').checked;

    const linhas = [];
    const total = { ok: 0, fj: 0, fc: 0, nc: 0, pd: 0, valor: 0, pendencias: 0 };

    for (const p of pacientes) {
        const dins = dinamicas.filter(d => d.paciente_id === p.id);
        const sess = sessoes.filter(s => s.paciente_id === p.id);
        const f = fechamentoPaciente(p, dins, sess, mes);
        const temMovimento = f.sessoes.length > 0 || f.valor > 0;
        if (soMovimento && !temMovimento) continue;

        total.ok += f.contagens.ok; total.fj += f.contagens.fj;
        total.fc += f.contagens.fc; total.nc += f.contagens.nc;
        total.pd += f.contagens['??']; total.valor += f.valor;
        total.pendencias += f.pendencias;

        linhas.push({ p, f });
    }

    document.getElementById('tbody-fechamento').innerHTML = linhas.map(({ p, f }) => `
      <tr class="${p.cadastro_removido ? 'linha-removido' : ''}">
        <td>${esc(p.nome)}${f.pendencias ? ` <span class="badge vermelho" title="Sessões vencidas sem preenchimento">${f.pendencias} pendência(s)</span>` : ''}</td>
        <td>${f.contagens.ok}</td><td>${f.contagens.fj}</td><td>${f.contagens.fc}</td>
        <td>${f.contagens.nc}</td><td>${f.contagens['??']}</td>
        <td><b>${formataMoeda(f.valor)}</b></td>
        <td class="acoes"><button class="argos-btn small" data-detalhe="${p.id}">${abertos.has(p.id) ? '▲' : '▼'} Detalhes</button></td>
      </tr>
      ${abertos.has(p.id) ? `
      <tr class="linha-detalhe"><td colspan="8">
        ${f.detalhes.length ? '<ul>' + f.detalhes.map(d => `<li>${esc(d)}</li>`).join('') + '</ul>' : '<span class="dim">Sem lançamentos no mês.</span>'}
      </td></tr>` : ''}
    `).join('');

    document.getElementById('fechamento-vazio').style.display = linhas.length ? 'none' : '';
    document.getElementById('t-ok').textContent = total.ok;
    document.getElementById('t-fj').textContent = total.fj;
    document.getElementById('t-fc').textContent = total.fc;
    document.getElementById('t-nc').textContent = total.nc;
    document.getElementById('t-pd').textContent = total.pd;
    document.getElementById('t-valor').innerHTML = `<b>${formataMoeda(total.valor)}</b>`;

    const aviso = document.getElementById('aviso-pendencias');
    if (total.pendencias) {
        aviso.style.display = '';
        aviso.textContent = `⚠️ ${total.pendencias} sessão(ões) vencida(s) sem preenchimento neste mês — o valor pode mudar depois que forem marcadas (preencha na Agenda).`;
    } else aviso.style.display = 'none';
}

document.getElementById('tbody-fechamento').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-detalhe]');
    if (!btn) return;
    const id = btn.dataset.detalhe;
    if (abertos.has(id)) abertos.delete(id); else abertos.add(id);
    render();
});

document.getElementById('mes-ref').addEventListener('change', render);
document.getElementById('so-movimento').addEventListener('change', render);
document.getElementById('btn-imprimir').addEventListener('click', () => window.print());

// ---------- início ----------
(async function init() {
    perm = await carregarPermissoes();
    if (!perm.pode('fechamento_ver') && !perm.master) {
        document.querySelector('main').innerHTML = '<p class="dim" style="padding:30px">Sem permissão para ver o fechamento.</p>';
        return;
    }
    perm.aplicarVisibilidade();
    document.getElementById('mes-ref').value = hojeISO().slice(0, 7);
    await carregarTudo();
})();

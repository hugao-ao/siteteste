// fechamento.js — Card "Fechamento Mensal" da área Argos
// Relatório do acerto financeiro de cada paciente no mês escolhido, com o
// detalhe das frequências, calculado pelas dinâmicas financeiras.

import { sb, toast, esc } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import { fechamentoPaciente, formataMoeda, hojeISO, formataBR, STATUS_SESSAO } from './argos-recorrencia.js';

let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };
let pacientes = [], dinamicas = [], sessoes = [], profissionais = [];
let abertos = new Set(); // pacientes com detalhe expandido

async function carregarTudo() {
    const [rPac, rDin, rSes, rProf] = await Promise.all([
        sb.from('argos_pacientes').select('*').order('nome'),
        sb.from('argos_dinamicas').select('*'),
        sb.from('argos_sessoes').select('*'),
        sb.from('argos_profissionais').select('*').order('nome')
    ]);
    const erro = rPac.error || rDin.error || rSes.error || rProf.error;
    if (erro) { console.error(erro); toast('Erro ao carregar dados.', true); return; }
    pacientes = rPac.data || [];
    dinamicas = rDin.data || [];
    sessoes = rSes.data || [];
    profissionais = rProf.data || [];
    render();
}

function render() {
    const mes = document.getElementById('mes-ref').value;
    if (!mes) return;
    const soMovimento = document.getElementById('so-movimento').checked;

    // calcula o mês de TODOS os pacientes (repasses independem do filtro de exibição)
    const todos = pacientes.map(p => ({
        p,
        f: fechamentoPaciente(p,
            dinamicas.filter(d => d.paciente_id === p.id),
            sessoes.filter(s => s.paciente_id === p.id), mes)
    }));

    const linhas = [];
    const total = { ok: 0, fj: 0, fc: 0, nc: 0, pd: 0, valor: 0, pendencias: 0 };

    for (const { p, f } of todos) {
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
        <b>🗓️ Frequência das sessões do mês:</b>
        ${f.sessoes.length ? '<ul>' + f.sessoes.map(s => {
            const st = STATUS_SESSAO[s.status] || {};
            return `<li>${formataBR(s.data)} às ${s.hora} — <span class="chip-status" style="--c:${st.cor}">${st.label}</span> ${st.desc || ''}${s.remarcada_de_data ? ` — ↪️ remarcada de ${formataBR(s.remarcada_de_data)} às ${s.remarcada_de_hora}` : ''}${s.justificativa ? ` — 📝 ${esc(s.justificativa)}` : ''}</li>`;
        }).join('') + '</ul>' : '<span class="dim">Sem sessões no mês.</span>'}
        <b style="display:block;margin-top:8px">💰 Lançamentos:</b>
        ${f.detalhes.length ? '<ul>' + f.detalhes.map(d => `<li>${esc(d)}</li>`).join('') + '</ul>' : '<span class="dim">Sem lançamentos no mês.</span>'}
        ${(f.porDinamica || []).some(pd => (pd.repasses || []).length) ? `
        <b style="display:block;margin-top:8px">💼 Divisão com profissionais:</b>
        <ul>${(f.porDinamica || []).filter(pd => (pd.repasses || []).length).map(pd => {
            const somaProfs = pd.repasses.reduce((s, r) => s + r.valor, 0);
            const partes = pd.repasses.map(r =>
                `${esc(nomeProf(r.profissional_id))} recebe ${r.tipo === 'valor' ? `${formataMoeda(r.valor_config)} (${pctFmt(r.pct)}%)` : `${pctFmt(r.pct)}%`} = <b>${formataMoeda(r.valor)}</b>`);
            return `<li>Sobre ${formataMoeda(pd.valor)}: ${partes.join(' · ')} · clínica: <b>${formataMoeda(pd.valor - somaProfs)}</b></li>`;
        }).join('')}
        </ul>` : ''}
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

    renderRepasses(todos);
}

const nomeProf = id => (profissionais.find(p => p.id === id) || {}).nome || '—';
const pctFmt = x => (Math.round(x * 100) / 100).toLocaleString('pt-BR');

// Repasses do mês: fixo mensal conforme a forma de remuneração + produção
// (divisão de cada dinâmica sobre o faturamento do mês do respectivo paciente;
// a produção nunca ultrapassa o que o paciente pagou, por construção)
function renderRepasses(todos) {
    const producao = {};
    let faturamento = 0;
    for (const { f } of todos) {
        faturamento += f.valor;
        for (const pd of (f.porDinamica || [])) {
            for (const r of (pd.repasses || [])) {
                producao[r.profissional_id] = (producao[r.profissional_id] || 0) + r.valor;
            }
        }
    }
    let totalRepasses = 0;
    const linhasR = profissionais.map(pr => {
        const temFixo = pr.remuneracao_tipo === 'fixo' || pr.remuneracao_tipo === 'producao_fixo';
        const fixo = temFixo ? (Number(pr.valor_fixo_mensal) || 0) : 0;
        const prod = pr.remuneracao_tipo === 'fixo' ? 0 : (producao[pr.id] || 0);
        const totalP = fixo + prod;
        if (!totalP) return '';
        totalRepasses += totalP;
        return `<tr><td>${esc(pr.nome)}</td>
          <td>${fixo ? formataMoeda(fixo) : '—'}</td>
          <td>${prod ? formataMoeda(prod) : '—'}</td>
          <td><b>${formataMoeda(totalP)}</b></td></tr>`;
    }).filter(Boolean).join('');
    document.getElementById('tbody-repasses').innerHTML = linhasR
        || '<tr><td colspan="4" class="dim">Nenhum repasse configurado para este mês.</td></tr>';
    document.getElementById('r-total').innerHTML = `<b>${formataMoeda(totalRepasses)}</b>`;
    document.getElementById('r-clinica').innerHTML = `<b>${formataMoeda(faturamento - totalRepasses)}</b>`;
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

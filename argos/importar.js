// importar.js — importação da aba CADASTRO da planilha da clínica
// ================================================================
// Lê o texto colado, mostra o que entendeu e grava: pacientes (cria ou
// atualiza, casando por nome normalizado) e as linhas de acordo, que ficam
// estacionadas em argos_import_acordos até os horários chegarem.

import { sb, toast, esc } from './argos-common.js';
import { carregarPermissoes } from './argos-permissoes.js';
import { lerCadastro, chaveNome } from './argos-cadastro-import.js';

const ANO = 2026;
let perm = { pode: () => true, aplicarVisibilidade: () => {}, master: true };
let leitura = null;          // { linhas, pacientes, avisos, descartadas }
let existentes = [];         // pacientes já cadastrados
let porChave = new Map();    // chave normalizada -> paciente do banco
let profPorNome = new Map(); // nome minúsculo -> profissional
let aba = 'pacientes';

const $ = id => document.getElementById(id);
const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// ============================================================
// LEITURA
// ============================================================
async function carregarBase() {
    const [rP, rProf] = await Promise.all([
        sb.from('argos_pacientes').select('*'),
        sb.from('argos_profissionais').select('id, nome')
    ]);
    existentes = (rP.data || []).filter(p => !p.cadastro_removido);
    porChave = new Map(existentes.map(p => [chaveNome(p.nome), p]));
    profPorNome = new Map((rProf.data || []).map(p => [norm(p.nome), p]));
}

function ler() {
    const texto = $('imp-colar').value;
    if (!texto.trim()) { toast('Cole a aba antes de ler.', true); return; }
    leitura = lerCadastro(texto);
    if (!leitura.linhas.length) {
        $('imp-passo2').style.display = 'none';
        $('imp-passo3').style.display = 'none';
        toast(leitura.avisos[0] || 'Não consegui ler nada.', true);
        return;
    }
    $('imp-passo2').style.display = '';
    $('imp-passo3').style.display = '';
    renderResumo();
    renderTabela();
}

function renderResumo() {
    const { linhas, pacientes, avisos, descartadas } = leitura;
    const novos = pacientes.filter(p => !porChave.has(p.chave)).length;
    const jaTem = pacientes.length - novos;
    const inativos = pacientes.filter(p => !p.ativo).length;
    const profsPlanilha = [...new Set(linhas.map(l => l.profissional).filter(Boolean))];
    const semCadastro = profsPlanilha.filter(n => !profPorNome.has(norm(n)));
    const chips = [
        `<span class="imp-chip"><b>${linhas.length}</b> linhas de acordo</span>`,
        `<span class="imp-chip"><b>${pacientes.length}</b> pacientes</span>`,
        `<span class="imp-chip ok"><b>${novos}</b> a criar</span>`,
        `<span class="imp-chip ${jaTem ? '' : ''}"><b>${jaTem}</b> já cadastrados</span>`,
        `<span class="imp-chip ${inativos ? 'alerta' : ''}"><b>${inativos}</b> só com linhas “inativo”</span>`,
        `<span class="imp-chip ${semCadastro.length ? 'erro' : 'ok'}"><b>${profsPlanilha.length}</b> profissionais${semCadastro.length ? ` — ${semCadastro.length} sem cadastro` : ''}</span>`,
        descartadas ? `<span class="imp-chip"><b>${descartadas}</b> linhas vazias descartadas</span>` : ''
    ];
    $('imp-chips').innerHTML = chips.filter(Boolean).join('');
    const todos = [...avisos];
    if (semCadastro.length) todos.push(`Profissionais que não existem no sistema e precisam ser criados antes: <b>${semCadastro.map(esc).join(', ')}</b>.`);
    $('imp-avisos').innerHTML = todos.map(a => `<li>${a}</li>`).join('');
}

// ============================================================
// TABELA DE CONFERÊNCIA
// ============================================================
const resumoAcordo = a => a.acordos.map(b => {
    const per = b.de === b.ate ? b.de : `${b.de}–${b.ate}`;
    if (b.tipo === null) return `${per}: —`;
    if (b.tipo === 'zero') return `${per}: 0`;
    return `${per}: ${b.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${b.tipo === 'fixo' ? '/mês' : '/sessão'}`;
}).join('  •  ');

function renderTabela() {
    if (!leitura) return;
    const busca = norm($('imp-busca').value.trim());
    const soNovos = $('imp-so-novos').checked;
    const tab = $('imp-tabela');

    if (aba === 'pacientes') {
        const lista = leitura.pacientes
            .filter(p => !busca || norm(p.nome).includes(busca))
            .filter(p => !soNovos || !porChave.has(p.chave));
        tab.innerHTML = `<thead><tr>
            <th>Paciente</th><th>Situação</th><th>Profissionais</th><th>Responsável financeiro</th>
            <th>Whatsapp</th><th>E-mail</th><th>CPF</th><th>Pasta</th></tr></thead><tbody>
          ${lista.map(p => {
            const ja = porChave.get(p.chave);
            return `<tr>
              <td class="longo">${esc(p.nome)}
                <span class="${ja ? 'pill-atual' : 'pill-novo'}">${ja ? '• já existe' : '• novo'}</span></td>
              <td class="${p.ativo ? '' : 'pill-inativo'}">${p.ativo ? 'ativo' : 'inativo'}</td>
              <td>${p.profissionais.map(n => `<span class="tag">${esc(n)}</span>`).join('')}</td>
              <td class="longo">${esc(p.responsavel_financeiro)}</td>
              <td>${esc(p.telefone)}</td>
              <td class="longo">${esc((p.email || '').split(';')[0])}</td>
              <td>${esc(p.cpf)}</td>
              <td>${p.pasta_url ? '✔' : ''}</td></tr>`;
        }).join('')}</tbody>`;
        if (!lista.length) tab.innerHTML += '<tbody><tr><td>Nada encontrado.</td></tr></tbody>';
        return;
    }

    if (aba === 'acordos') {
        const lista = leitura.linhas
            .filter(l => !l.aluguel)
            .filter(l => !busca || norm(l.paciente_nome).includes(busca));
        tab.innerHTML = `<thead><tr>
            <th>Paciente</th><th>Profissional</th><th>Repasse</th><th>Início</th>
            <th>Nota</th><th>Acordo mês a mês</th></tr></thead><tbody>
          ${lista.map(l => `<tr>
              <td class="longo">${esc(l.paciente_nome)}
                ${l.tags.filter(t => !['ANA','HUM','ELIS','CLA','CAT','BRUNO','TAT'].includes(t))
                    .map(t => `<span class="tag">${t}</span>`).join('')}</td>
              <td>${esc(l.profissional)}${profPorNome.has(norm(l.profissional)) ? '' : ' <span class="pill-inativo">?</span>'}</td>
              <td>${l.repasse == null ? '' : l.repasse.toLocaleString('pt-BR') + '%'}</td>
              <td class="${l.inicio_data ? '' : 'pill-inativo'}">${esc(l.inicio_raw || '—')}</td>
              <td>${esc(l.notas.map(n => n.valor || '—').join(' → '))}</td>
              <td class="longo acordo">${esc(resumoAcordo(l))}</td></tr>`).join('')}</tbody>`;
        return;
    }

    const fora = leitura.linhas.filter(l => l.aluguel);
    tab.innerHTML = `<thead><tr><th>Linha</th><th>O quê</th><th>Motivo</th><th>Valor</th></tr></thead><tbody>
      ${fora.map(l => `<tr><td>${l.linha}</td><td class="longo">${esc(l.paciente_nome)}</td>
        <td>Locação de sala — não é paciente</td>
        <td class="acordo">${esc(resumoAcordo(l))}</td></tr>`).join('')}
      ${leitura.descartadas ? `<tr><td>—</td><td>${leitura.descartadas} linhas sem nome</td>
        <td>Sobra de arrasto de fórmula da planilha</td><td></td></tr>` : ''}</tbody>`;
}

document.querySelectorAll('.imp-abas button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.imp-abas button').forEach(x => x.classList.toggle('ativa', x === b));
    aba = b.dataset.aba;
    renderTabela();
}));
$('imp-busca').addEventListener('input', renderTabela);
$('imp-so-novos').addEventListener('change', renderTabela);
$('btn-ler').addEventListener('click', ler);
$('btn-limpar').addEventListener('click', () => {
    $('imp-colar').value = ''; leitura = null;
    $('imp-passo2').style.display = 'none'; $('imp-passo3').style.display = 'none';
});

// ============================================================
// IMPORTAÇÃO
// ============================================================
const emLotes = async (itens, n, fn) => {
    for (let i = 0; i < itens.length; i += n) await fn(itens.slice(i, i + n), i);
};

function camposDoPaciente(p, marcarInativo) {
    const campos = {
        nome: p.nome,
        cpf: p.cpf || null,
        email: p.email || null,
        telefone: p.telefone || null,
        contato: p.contato || null,
        responsavel_financeiro: p.responsavel_financeiro || null,
        rf_cpf: p.rf_cpf || null,
        pasta_url: p.pasta_url || null
    };
    if (marcarInativo) campos.ativo = p.ativo;
    return campos;
}

$('btn-importar').addEventListener('click', async () => {
    if (!perm.pode('cadastro_importar')) { toast('Sem permissão para importar.', true); return; }
    if (!leitura) return;
    const btn = $('btn-importar');
    btn.disabled = true;
    const prog = m => { $('imp-progresso').innerHTML = m; };
    const criar = $('opt-criar').checked, atualizar = $('opt-atualizar').checked;
    const marcarInativo = $('opt-inativos').checked, guardar = $('opt-acordos').checked;
    let criados = 0, atualizados = 0;

    try {
        const novos = leitura.pacientes.filter(p => !porChave.has(p.chave));
        const antigos = leitura.pacientes.filter(p => porChave.has(p.chave));

        if (criar && novos.length) {
            prog(`Criando ${novos.length} pacientes…`);
            await emLotes(novos, 60, async (lote, i) => {
                const { data, error } = await sb.from('argos_pacientes')
                    .insert(lote.map(p => ({ ...camposDoPaciente(p, marcarInativo), ativo: marcarInativo ? p.ativo : true })))
                    .select('id, nome');
                if (error) throw error;
                (data || []).forEach(d => porChave.set(chaveNome(d.nome), d));
                criados += (data || []).length;
                prog(`Criando pacientes… ${Math.min(i + 60, novos.length)}/${novos.length}`);
            });
        }

        if (atualizar && antigos.length) {
            prog(`Atualizando ${antigos.length} pacientes…`);
            for (const p of antigos) {
                const alvo = porChave.get(p.chave);
                const campos = camposDoPaciente(p, marcarInativo);
                delete campos.nome;                      // não renomeia quem já existe
                Object.keys(campos).forEach(k => { if (campos[k] == null) delete campos[k]; });
                if (!Object.keys(campos).length) continue;
                const { error } = await sb.from('argos_pacientes').update(campos).eq('id', alvo.id);
                if (error) throw error;
                atualizados++;
            }
        }

        if (guardar) {
            prog('Guardando os acordos…');
            await sb.from('argos_import_acordos').delete().eq('ano', ANO);
            const linhas = leitura.linhas.map(l => {
                const pac = l.aluguel ? null : porChave.get(l.paciente_chave);
                const pro = profPorNome.get(norm(l.profissional));
                return {
                    ano: ANO, linha: l.linha,
                    paciente_raw: l.paciente_raw, paciente_nome: l.paciente_nome,
                    paciente_chave: l.paciente_chave, paciente_id: pac ? pac.id : null,
                    tags: l.tags, profissional: l.profissional, profissional_id: pro ? pro.id : null,
                    repasse: l.repasse, inicio_raw: l.inicio_raw, inicio_data: l.inicio_data,
                    situacao: l.situacao, acordos: l.acordos, notas: l.notas
                };
            });
            await emLotes(linhas, 100, async (lote, i) => {
                const { error } = await sb.from('argos_import_acordos').insert(lote);
                if (error) throw error;
                prog(`Guardando os acordos… ${Math.min(i + 100, linhas.length)}/${linhas.length}`);
            });
        }

        await carregarBase();
        renderResumo();
        renderTabela();
        prog(`✅ Pronto: <b>${criados}</b> paciente(s) criado(s), <b>${atualizados}</b> atualizado(s)${guardar ? `, <b>${leitura.linhas.length}</b> linha(s) de acordo guardada(s)` : ''}.`);
        toast('Importação concluída.');
    } catch (e) {
        console.error(e);
        prog(`❌ Erro na importação: ${esc(e.message || String(e))}`);
        toast('Erro na importação — nada além do que já entrou foi gravado.', true);
    } finally {
        btn.disabled = false;
    }
});

// ============================================================
// INÍCIO
// ============================================================
(async function init() {
    perm = await carregarPermissoes();
    if (!perm.pode('cadastro_importar') && !perm.master) {
        document.querySelector('main').innerHTML = '<p class="dim" style="padding:30px">Sem permissão para importar cadastros.</p>';
        return;
    }
    perm.aplicarVisibilidade();
    await carregarBase();
})();

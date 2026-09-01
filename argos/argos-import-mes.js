// argos-import-mes.js — importar a frequência de um mês, com conferência
// =======================================================================
// A importação grande (a da tela de Importação) reconstrói tudo do zero: é
// para começar o sistema. Esta é outra coisa — é a planilha do mês chegando
// em cima de um sistema que já está rodando, com sessões que alguém já
// preencheu na agenda, faltas justificadas registradas, cobranças enviadas.
//
// Por isso ela não aplica nada sozinha. Ela compara e apresenta: o que vai
// nascer, o que muda de frequência, o que está no sistema e não está na
// planilha. Quem decide é quem está olhando, item a item se quiser.
//
// O que ela NÃO faz de propósito: mexer em paciente que a planilha não
// menciona. Cada arquivo é a aba de um profissional; propor apagar as
// sessões de quem não está ali seria destruir o mês dos outros.

import {
    lerFrequencia, chaveNome, STATUS_PLANILHA, DIA_SEMANA, somarHoras
} from './argos-import-freq.js';
import { mesclarSessoes, aplicarFimDeProcesso, hojeISO, somarDias }
    from './argos-recorrencia.js';

export { lerFrequencia };

/** Ordem em que os blocos da planilha ocupam o horário do dia. */
const ORDEM_BLOCO = { grupo: 0, individual: 1, familia: 2 };

export const ROTULO_STATUS = {
    ok: 'Ok (presente)', fj: 'Fj (falta justificada)',
    fc: 'F (falta contabilizada)', nc: 'Nc (não houve)', '??': '?? (a preencher)'
};

export const TIPOS = {
    paciente_novo: { rotulo: 'Pacientes novos', icone: '🆕', cor: '#38bdf8',
        ajuda: 'Estão na planilha e não existem no cadastro. Cadastre-os aqui mesmo — só o nome já basta — e as sessões deles entram na importação.' },
    nova: { rotulo: 'Sessões novas', icone: '➕', cor: '#22c55e',
        ajuda: 'Estão na planilha e ainda não existem no sistema.' },
    status: { rotulo: 'Frequência alterada', icone: '✏️', cor: '#eab308',
        ajuda: 'A sessão existe, mas a planilha diz outra coisa.' },
    profissional: { rotulo: 'Profissional diferente', icone: '🔁', cor: '#a855f7',
        ajuda: 'A sessão existe no dia certo, com outro profissional.' },
    sem_registro: { rotulo: 'Sem registro na planilha (viram Nc)', icone: '📭', cor: '#94a3b8',
        ajuda: 'O horário fixo esperava sessão nesses dias e a planilha não trouxe nada. Como nas importações anteriores, viram «não houve» — sem isso, ficariam pendentes de frequência para sempre.' },
    sobra: { rotulo: 'Sobrando no sistema (serão excluídas)', icone: '🗑️', cor: '#ef4444',
        ajuda: 'Sessões avulsas que existem no sistema, a planilha não trouxe e nenhum horário fixo explica.' },
    situacao: { rotulo: 'Situação do paciente', icone: '🚦', cor: '#f97316',
        ajuda: 'A planilha marca o paciente de um jeito e o cadastro de outro.' },
    bloqueada: { rotulo: 'Não dá para aplicar', icone: '⛔', cor: '#64748b',
        ajuda: 'Linhas da planilha com profissional que não está no cadastro.' }
};

/** A ordem em que os grupos aparecem na tela: do mais inócuo ao mais grave. */
export const ORDEM_TIPOS = ['paciente_novo', 'nova', 'status', 'profissional', 'situacao', 'sem_registro', 'sobra', 'bloqueada'];

const chave = t => chaveNome(t);
const norm = t => String(t || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

const ultimoDia = (ano, mes) => new Date(ano, mes, 0).getDate();

/** 'YYYY-MM-DD' → 'DD/MM'. */
const dm = d => `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}`;

// ---------------------------------------------------------------------------
// As sessões que a planilha afirma
// ---------------------------------------------------------------------------

/**
 * Cada linha da planilha vira as suas sessões já datadas e com horário.
 *
 * Duas sessões no mesmo dia (grupo de manhã e individual à tarde, por
 * exemplo) recebem horários seguidos, como no importador grande — o
 * horário exato não é o que importa, é a sessão existir e não colidir.
 */
export function sessoesDaPlanilha(linha) {
    const base = linha.hora || '09:00';
    const usados = new Map();
    return [...(linha.sessoes || [])]
        .sort((a, b) => a.data.localeCompare(b.data)
            || (ORDEM_BLOCO[a.bloco] ?? 9) - (ORDEM_BLOCO[b.bloco] ?? 9))
        .map(s => {
            const n = usados.get(s.data) || 0;
            usados.set(s.data, n + 1);
            return { ...s, ordem: n, hora: somarHoras(base, n) };
        });
}

/**
 * Cadastros parecidos com um nome que veio na planilha.
 *
 * O critério é a chave de um começar com a do outro («BERNARDO» ×
 * «BERNARDO DE FREITAS») — é como os apelidos de planilha costumam ser.
 * A sugestão existe para a pessoa decidir; nada é vinculado sozinho.
 */
export function sugerirCadastro(chave, pacientes = []) {
    const k0 = String(chave || '');
    if (k0.length < 5) return [];
    return (pacientes || [])
        .filter(p => !p.cadastro_removido)
        .map(p => ({ p, k: chaveNome(p.nome) }))
        .filter(({ k }) => k.length >= 5 && k !== k0
            && (k.startsWith(k0) || k0.startsWith(k)))
        .sort((a, b) => Math.abs(a.k.length - k0.length) - Math.abs(b.k.length - k0.length))
        .slice(0, 3)
        .map(({ p }) => ({ id: p.id, nome: p.nome }));
}

/**
 * A dinâmica que responde por este slot (dow+hora) nesta data.
 *
 * O acordo de um paciente vive em "trechos": quando o valor ou o horário
 * muda, nasce uma dinâmica nova e a velha ganha data de fim. Ligar a sessão
 * ao trecho errado — o de fevereiro, vencido — deixa a projeção do trecho
 * vigente órfã, pendente para sempre. Por isso a escolha é por horário E
 * vigência, preferindo o trecho mais novo.
 */
function dinamicaDoSlot(dinamicas, pacienteId, data, hora) {
    const dow = new Date(data + 'T12:00:00').getDay();
    return (dinamicas || []).filter(d => d.paciente_id === pacienteId
        && Array.isArray(d.dias)
        && d.dias.some(x => Number(x.dow) === dow && x.hora === hora)
        && d.data_inicio && d.data_inicio <= data
        && !(d.fim_tipo === 'data' && d.fim_data && d.fim_data < data))
        .sort((a, b) => String(b.data_inicio).localeCompare(String(a.data_inicio)));
}

// ---------------------------------------------------------------------------
// O plano de importação
// ---------------------------------------------------------------------------

/**
 * Compara a planilha do mês com o que está no sistema.
 *
 * Devolve { mudancas, resumo, avisos, pares }. Cada mudança carrega a ação
 * que a aplicaria — inserir, atualizar ou excluir —, para a tela só precisar
 * executar o que foi aprovado.
 */
export function planoDoMes({ linhas = [], pacientes = [], profissionais = [],
    sessoes = [], dinamicas = [], apelidos = [], ano, mes } = {}) {

    const avisos = [];
    if (!ano || !mes) return { mudancas: [], resumo: vazio(), avisos: ['Não sei de que mês é esta planilha.'], pares: [] };

    const de = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const ate = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia(ano, mes)).padStart(2, '0')}`;

    const pacPorChave = new Map();
    for (const p of pacientes) {
        if (p.cadastro_removido) continue;
        const k = chave(p.nome);
        if (!pacPorChave.has(k)) pacPorChave.set(k, p);
    }
    // um apelido vinculado numa importação passada resolve a chave para
    // sempre — mas nunca por cima de um nome que já casa sozinho
    for (const a of apelidos || []) {
        if (pacPorChave.has(a.chave)) continue;
        const p = pacientes.find(x => x.id === a.paciente_id && !x.cadastro_removido);
        if (p) pacPorChave.set(a.chave, p);
    }
    const profPorNome = new Map(profissionais.map(p => [norm(p.nome), p]));

    const mudancas = [];
    const pares = [];          // (paciente, profissional) que a planilha cobre
    const vistos = new Set();

    // ---------------- lado da planilha
    for (const l of linhas) {
        const pac = pacPorChave.get(l.chave);
        const prof = profPorNome.get(norm(l.profissional));
        const quem = l.paciente_raw;

        if (!pac) {
            // paciente que a planilha traz e o cadastro não tem: não é erro,
            // é gente nova — a tela oferece cadastrar sem sair da importação
            const id = `novo|${l.chave}`;
            const existente = mudancas.find(m => m.id === id);
            if (existente) {
                existente.sessoes += (l.sessoes || []).length;
                if (!existente.profissionais.includes(l.profissional)) {
                    existente.profissionais.push(l.profissional);
                }
                existente.detalhe = detalheDoNovo(existente);
            } else {
                const novoPac = {
                    id, tipo: 'paciente_novo', aplicavel: false, cadastravel: true,
                    sugestoes: sugerirCadastro(l.chave, pacientes),
                    chave: l.chave, nome: l.paciente, paciente: l.paciente,
                    profissional: l.profissional, profissionais: [l.profissional],
                    situacao: l.situacao || '', rotulo: l.paciente,
                    sessoes: (l.sessoes || []).length
                };
                novoPac.detalhe = detalheDoNovo(novoPac);
                mudancas.push(novoPac);
            }
            continue;
        }
        if (!prof) {
            mudancas.push({
                id: `bloq|${l.linha}`, tipo: 'bloqueada', aplicavel: false,
                paciente: quem, profissional: l.profissional, rotulo: quem,
                detalhe: `Profissional «${l.profissional}» não cadastrado (linha ${l.linha}).`,
                sessoes: (l.sessoes || []).length
            });
            continue;
        }

        const parK = `${pac.id}|${prof.id}`;
        if (!vistos.has(parK)) { vistos.add(parK); pares.push({ paciente: pac, profissional: prof }); }

        // situação do paciente: a planilha diz Ativo/Inativo
        const sitPlan = norm(l.situacao);
        if (sitPlan === 'ativo' || sitPlan === 'inativo') {
            const querAtivo = sitPlan === 'ativo';
            if (pac.ativo !== querAtivo) {
                const id = `sit|${pac.id}`;
                if (!mudancas.some(m => m.id === id)) mudancas.push({
                    id, tipo: 'situacao', aplicavel: true,
                    paciente: pac.nome, profissional: prof.nome, rotulo: pac.nome,
                    detalhe: `Cadastro: ${pac.ativo ? 'ativo' : 'inativo'} → planilha: ${querAtivo ? 'ativo' : 'inativo'}.`,
                    antes: pac.ativo ? 'ativo' : 'inativo', depois: querAtivo ? 'ativo' : 'inativo',
                    acao: { op: 'atualizar', tabela: 'argos_pacientes', id: pac.id, campos: { ativo: querAtivo } }
                });
            }
        }
    }

    // ---------------- sessões: planilha × sistema, casadas por dia e ordem
    const doMes = sessoes.filter(s => s.data >= de && s.data <= ate);
    const porPacDia = new Map();      // paciente|data → sessões do sistema, em ordem
    for (const s of doMes) {
        const k = `${s.paciente_id}|${s.data}`;
        if (!porPacDia.has(k)) porPacDia.set(k, []);
        porPacDia.get(k).push(s);
    }
    for (const lista of porPacDia.values()) {
        lista.sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));
    }

    const casadas = new Set();        // ids de sessão do sistema já usadas

    for (const l of linhas) {
        const pac = pacPorChave.get(l.chave);
        const prof = profPorNome.get(norm(l.profissional));
        if (!pac || !prof) continue;
        // reserva das dinâmicas já ocupadas em cada dia deste paciente, para
        // duas sessões no mesmo dia (grupo + individual no mesmo horário da
        // planilha) caírem cada uma no seu acordo
        const usadasNoDia = new Map();
        for (const g of sessoes) {
            if (g.paciente_id !== pac.id || !g.dinamica_ref) continue;
            if (!usadasNoDia.has(g.data)) usadasNoDia.set(g.data, new Set());
            usadasNoDia.get(g.data).add(g.dinamica_ref);
        }
        const reservar = (data, id) => {
            if (!usadasNoDia.has(data)) usadasNoDia.set(data, new Set());
            usadasNoDia.get(data).add(id);
        };
        const fallbackProf = (data) => (dinamicas || []).filter(d =>
            d.paciente_id === pac.id && d.profissional_id === prof.id
            && d.data_inicio && d.data_inicio <= data
            && !(d.fim_tipo === 'data' && d.fim_data && d.fim_data < data)
            && d.ativo !== false)
            .sort((a, b) => String(b.data_inicio).localeCompare(String(a.data_inicio)))[0] || null;

        for (const s of sessoesDaPlanilha(l)) {
            const candidatas = (porPacDia.get(`${pac.id}|${s.data}`) || [])
                .filter(x => !casadas.has(x.id));
            // primeiro tenta a mesma dupla paciente×profissional; se não houver,
            // aceita a sessão do dia com outro profissional — é o caso de
            // "quem atendeu foi outro", que vira uma mudança à parte
            const existente = candidatas.find(x => x.profissional_id === prof.id)
                || candidatas.find(x => !x.profissional_id) || candidatas[0] || null;

            if (!existente) {
                // primeiro a dinâmica que projeta esta hora exata; senão, a
                // que projeta a hora base da linha (é o caso da 2ª sessão do
                // dia, que a planilha empurra +1h) — e aí a sessão nasce na
                // hora da dinâmica, para a projeção casar com ela
                const livre = ds => ds.find(d => !(usadasNoDia.get(s.data) || new Set()).has(d.id));
                let din = livre(dinamicaDoSlot(dinamicas, pac.id, s.data, s.hora)) || null;
                let hora = s.hora;
                if (!din && s.hora !== l.hora) {
                    din = livre(dinamicaDoSlot(dinamicas, pac.id, s.data, l.hora)) || null;
                    if (din) hora = l.hora;
                }
                if (!din) din = fallbackProf(s.data);
                if (din) reservar(s.data, din.id);
                mudancas.push({
                    id: `nova|${pac.id}|${prof.id}|${s.data}|${s.ordem}`,
                    tipo: 'nova', aplicavel: true, paciente_id: pac.id,
                    paciente: pac.nome, profissional: prof.nome, data: s.data,
                    hora, bloco: s.bloco,
                    rotulo: `${pac.nome} — ${dm(s.data)} ${hora}`,
                    detalhe: `${prof.nome} · ${s.bloco} · ${ROTULO_STATUS[s.status] || s.status}`,
                    depois: s.status,
                    acao: { op: 'inserir', tabela: 'argos_sessoes', registro: {
                        paciente_id: pac.id, profissional_id: prof.id,
                        dinamica_id: din ? din.id : null, dinamica_ref: din ? din.id : null,
                        sala_id: din ? din.sala_id : null, servico_id: din ? din.servico_id : null,
                        data: s.data, hora, duracao_min: (din && din.duracao_min) || 60,
                        status: s.status
                    } }
                });
                continue;
            }

            casadas.add(existente.id);

            if (existente.profissional_id && existente.profissional_id !== prof.id) {
                const antes = (profissionais.find(p => p.id === existente.profissional_id) || {}).nome || '—';
                mudancas.push({
                    id: `prof|${existente.id}`, tipo: 'profissional', aplicavel: true,
                    paciente: pac.nome, profissional: prof.nome, data: s.data,
                    hora: existente.hora || '',
                    rotulo: `${pac.nome} — ${dm(s.data)} ${existente.hora || ''}`.trim(),
                    detalhe: `Atendimento de ${antes} → ${prof.nome}.`,
                    antes, depois: prof.nome,
                    acao: { op: 'atualizar', tabela: 'argos_sessoes', id: existente.id,
                            campos: { profissional_id: prof.id } }
                });
            }
            if ((existente.status || '??') !== s.status) {
                mudancas.push({
                    id: `st|${existente.id}`, tipo: 'status', aplicavel: true,
                    paciente: pac.nome, profissional: prof.nome, data: s.data,
                    hora: existente.hora || '',
                    rotulo: `${pac.nome} — ${dm(s.data)} ${existente.hora || ''}`.trim(),
                    detalhe: `${ROTULO_STATUS[existente.status] || existente.status || '—'} → ${ROTULO_STATUS[s.status] || s.status}.`,
                    antes: existente.status || '??', depois: s.status,
                    acao: { op: 'atualizar', tabela: 'argos_sessoes', id: existente.id,
                            campos: { status: s.status } }
                });
            }
        }
    }

    // ---------------- o que está no sistema e a planilha não trouxe
    // só para os pares que a planilha cobre: cada arquivo é a aba de um
    // profissional, e propor apagar o mês de quem não está ali seria errado
    const paresIds = new Set(pares.map(p => `${p.paciente.id}|${p.profissional.id}`));
    for (const s of doMes) {
        if (casadas.has(s.id)) continue;
        if (!s.profissional_id || !paresIds.has(`${s.paciente_id}|${s.profissional_id}`)) continue;
        const pac = pacientes.find(p => p.id === s.paciente_id);
        const prof = profissionais.find(p => p.id === s.profissional_id);
        // «não houve» é ausência de registro — a planilha sem a célula está
        // CONCORDANDO com ele. Propor excluir esses nc a cada importação seria
        // desfazer o próprio "sem registro" das importações passadas.
        if ((s.status || '') === 'nc') continue;
        // «??» de horário fixo não some: excluí-la faria a projeção da dinâmica
        // renascer pendente no mesmo lugar. Ela vira «não houve», que é o que
        // a planilha vazia está dizendo — o mesmo que as importações grandes
        // sempre fizeram.
        if ((s.status || '??') === '??' && s.dinamica_ref) {
            mudancas.push({
                id: `nc|${s.id}`, tipo: 'sem_registro', aplicavel: true,
                paciente: (pac || {}).nome || '?', profissional: (prof || {}).nome || '?',
                data: s.data, hora: s.hora || '',
                rotulo: `${(pac || {}).nome || '?'} — ${dm(s.data)} ${s.hora || ''}`.trim(),
                detalhe: 'A planilha não trouxe este dia — a sessão pendente vira «não houve».',
                antes: '??', depois: 'nc',
                acao: { op: 'atualizar', tabela: 'argos_sessoes', id: s.id,
                        campos: { status: 'nc', justificativa: 'Sem registro na planilha de frequência' } }
            });
            continue;
        }
        mudancas.push({
            id: `sobra|${s.id}`, tipo: 'sobra', aplicavel: true,
            paciente: (pac || {}).nome || '?', profissional: (prof || {}).nome || '?', data: s.data,
            hora: s.hora || '',
            rotulo: `${(pac || {}).nome || '?'} — ${dm(s.data)} ${s.hora || ''}`.trim(),
            detalhe: `Está no sistema como ${ROTULO_STATUS[s.status] || s.status || '—'} e não veio na planilha.`,
            antes: s.status || '??',
            acao: { op: 'excluir', tabela: 'argos_sessoes', id: s.id }
        });
    }

    // ---------------- os dias que o horário fixo esperava e ninguém registrou
    // A dinâmica projeta a sessão, a planilha veio sem a célula, e não há nada
    // gravado: sem esta parte, essas projeções ficariam «??» para sempre no
    // aviso de pendências. Elas nascem já como «não houve», aprováveis uma a
    // uma. Só até ontem (o futuro ainda pode acontecer) e só para quem a
    // planilha cobre.
    const ontem = somarDias(hojeISO(), -1);
    const ateNc = ate < ontem ? ate : ontem;
    if (ateNc >= de) {
        const corte = aplicarFimDeProcesso(dinamicas || [], sessoes, pacientes);
        // dinâmica desligada encerra o futuro, não o passado: para o buraco
        // vencido ela ainda conta (mesma regra do aviso de pendências)
        const paraProjecao = corte.dinamicas.map(d => d.ativo === false ? { ...d, ativo: true } : d);
        const pacsCobertos = new Set(pares.map(p => p.paciente.id));
        const diaTemPlanilha = new Set();
        for (const l of linhas) {
            const pac = pacPorChave.get(l.chave);
            if (!pac) continue;
            for (const sp of l.sessoes || []) diaTemPlanilha.add(`${pac.id}|${sp.data}`);
        }
        const diaTemGravada = new Set(doMes.map(x => `${x.paciente_id}|${x.data}`));
        for (const proj of mesclarSessoes(paraProjecao, corte.sessoes, de, ateNc)) {
            if (!proj.projetada || proj.status !== '??') continue;
            if (!pacsCobertos.has(proj.paciente_id)) continue;
            if (proj.profissional_id
                && !paresIds.has(`${proj.paciente_id}|${proj.profissional_id}`)) continue;
            if (diaTemPlanilha.has(`${proj.paciente_id}|${proj.data}`)) continue;
            if (diaTemGravada.has(`${proj.paciente_id}|${proj.data}`)) continue;
            const pac = pacientes.find(x => x.id === proj.paciente_id);
            const prof = profissionais.find(x => x.id === proj.profissional_id);
            mudancas.push({
                id: `ncp|${proj.paciente_id}|${proj.data}|${proj.hora}`,
                tipo: 'sem_registro', aplicavel: true,
                paciente: (pac || {}).nome || '?', profissional: (prof || {}).nome || '—',
                data: proj.data, hora: proj.hora || '',
                rotulo: `${(pac || {}).nome || '?'} — ${dm(proj.data)} ${proj.hora || ''}`.trim(),
                detalhe: 'O horário fixo esperava sessão e a planilha não trouxe — nasce como «não houve».',
                depois: 'nc',
                acao: { op: 'inserir', tabela: 'argos_sessoes', registro: {
                    paciente_id: proj.paciente_id, profissional_id: proj.profissional_id || null,
                    dinamica_id: proj.dinamica_ref || null, dinamica_ref: proj.dinamica_ref || null,
                    sala_id: proj.sala_id || null, servico_id: proj.servico_id || null,
                    data: proj.data, hora: proj.hora, duracao_min: proj.duracao_min || 60,
                    grupo_id: proj.grupo_id || null, grupo_ref: proj.grupo_ref || null,
                    status: 'nc', justificativa: 'Sem registro na planilha de frequência'
                } }
            });
        }
    }

    mudancas.sort((a, b) =>
        ORDEM_TIPOS.indexOf(a.tipo) - ORDEM_TIPOS.indexOf(b.tipo)
        || String(a.paciente).localeCompare(String(b.paciente))
        || String(a.data || '').localeCompare(String(b.data || '')));

    return { mudancas, resumo: contar(mudancas), avisos, pares };
}

function vazio() {
    return ORDEM_TIPOS.reduce((r, t) => (r[t] = 0, r), { total: 0, aplicaveis: 0 });
}

export function contar(mudancas = []) {
    const r = vazio();
    for (const m of mudancas) {
        r[m.tipo] = (r[m.tipo] || 0) + 1;
        r.total++;
        if (m.aplicavel) r.aplicaveis++;
    }
    return r;
}

function detalheDoNovo(m) {
    return `${m.sessoes} sessão(ões) na planilha · ${m.profissionais.join(', ')}`;
}

/** Uma frase curta do que a importação vai fazer, para o topo da conferência. */
export function frase(resumo) {
    const partes = [];
    const dizer = (n, um, muitos) => { if (n) partes.push(`${n} ${n === 1 ? um : muitos}`); };
    dizer(resumo.paciente_novo, 'paciente novo para cadastrar', 'pacientes novos para cadastrar');
    dizer(resumo.nova, 'sessão nova', 'sessões novas');
    dizer(resumo.status, 'frequência alterada', 'frequências alteradas');
    dizer(resumo.profissional, 'troca de profissional', 'trocas de profissional');
    dizer(resumo.situacao, 'mudança de situação', 'mudanças de situação');
    dizer(resumo.sem_registro, 'dia sem registro (vira Nc)', 'dias sem registro (viram Nc)');
    dizer(resumo.sobra, 'sessão sobrando', 'sessões sobrando');
    if (!partes.length) return 'Nada a fazer: a planilha bate com o sistema.';
    const lista = partes.length === 1 ? partes[0]
        : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
    return `Esta importação traz ${lista}.`;
}

/**
 * Agrupa as mudanças aprovadas por operação, para a tela gravar em lote.
 *
 * Devolve { inserir: [...], atualizar: [{tabela,id,campos}], excluir: {tabela: [ids]} }.
 */
export function loteDeAcoes(mudancas = []) {
    const inserir = new Map(), atualizar = [], excluir = new Map();
    for (const m of mudancas) {
        const a = m && m.acao;
        if (!a) continue;
        if (a.op === 'inserir') {
            if (!inserir.has(a.tabela)) inserir.set(a.tabela, []);
            inserir.get(a.tabela).push(a.registro);
        } else if (a.op === 'atualizar') {
            atualizar.push({ tabela: a.tabela, id: a.id, campos: a.campos });
        } else if (a.op === 'excluir') {
            if (!excluir.has(a.tabela)) excluir.set(a.tabela, []);
            excluir.get(a.tabela).push(a.id);
        }
    }
    // updates com os mesmos campos no mesmo registro viram um só
    const juntos = new Map();
    for (const u of atualizar) {
        const k = `${u.tabela}|${u.id}`;
        juntos.set(k, { tabela: u.tabela, id: u.id, campos: { ...(juntos.get(k) || {}).campos, ...u.campos } });
    }
    return {
        inserir: [...inserir.entries()].map(([tabela, registros]) => ({ tabela, registros })),
        atualizar: [...juntos.values()],
        excluir: [...excluir.entries()].map(([tabela, ids]) => ({ tabela, ids }))
    };
}

// argos-recorrencia.js — Motor de recorrência e regras financeiras da clínica
// ============================================================================
// Expande as Dinâmicas Financeiras em ocorrências de sessão (projeções) e
// mescla com as sessões materializadas (tabela argos_sessoes). Também gera o
// cronograma de pagamentos de pacotes. Usado pela Agenda e pelo Fechamento.
//
// Status de sessão:
//   '??' pendente/futura — para projeção de faturamento conta como presença
//   'ok' presente        — contabiliza
//   'fc' falta contabilizada — contabiliza
//   'fj' falta justificada — NÃO contabiliza
//   'nc' não aconteceu     — NÃO contabiliza

export const STATUS_SESSAO = {
    '??': { label: '??', desc: 'Pendente', cor: '#94a3b8' },
    'ok': { label: 'Ok', desc: 'Presente (contabiliza)', cor: '#22c55e' },
    'fj': { label: 'Fj', desc: 'Falta não contabilizada', cor: '#eab308' },
    'fc': { label: 'Fc', desc: 'Falta contabilizada', cor: '#a855f7' },
    'nc': { label: 'Nc', desc: 'Não houve (não contabiliza)', cor: '#ef4444' }
};

// Na tela estes status se chamam «contabiliza»/«contabilizada»; aqui o nome
// antigo ficou porque é o que a clínica usava quando o motor nasceu.
export const COBRAVEIS = ['ok', 'fc'];         // as que contabilizam
export const PROJETAVEIS = ['ok', 'fc', '??']; // as que contabilizam + presença futura projetada

export const DOW_NOMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Por que o paciente não vem mais. Vazio = em andamento.
 * Qualquer valor preenchido corta agenda e finanças e deixa o paciente
 * inativo — a data é opcional, porque nem sempre se sabe quando parou.
 */
export const SITUACAO_PROCESSO = [
    { valor: '',             rotulo: '▶️ Em andamento',       curto: 'Em andamento',  desc: 'O paciente segue vindo.' },
    { valor: 'finalizado',   rotulo: '🏁 Finalizado',         curto: 'Finalizado',    desc: 'Alta: o objetivo do trabalho foi alcançado.' },
    { valor: 'interrompido', rotulo: '⏸️ Interrompido',       curto: 'Interrompido',  desc: 'Pausa combinada — pode voltar.' },
    { valor: 'abandono',     rotulo: '🚪 Abandono',           curto: 'Abandono',      desc: 'Parou de vir sem combinar.' },
    { valor: 'transferido',  rotulo: '➡️ Transferido',        curto: 'Transferido',   desc: 'Foi para outro profissional ou serviço.' },
    { valor: 'inativo',      rotulo: '⛔ Não vem mais',       curto: 'Não vem mais',  desc: 'Sabe-se que parou, mas o motivo não foi registrado.' }
];

/** Rótulo curto de uma situação (ou 'Em andamento' quando vazia). */
export function situacaoLabel(tipo) {
    const s = SITUACAO_PROCESSO.find(x => x.valor === (tipo || ''));
    return s ? s.rotulo : tipo;
}

/** Tipo de uma sessão avulsa — como ela aconteceu. */
export const TIPOS_SESSAO_AVULSA = {
    individual: { rotulo: 'Individual', icone: '👤' },
    online:     { rotulo: 'Online',     icone: '🌐' },
    familiar:   { rotulo: 'Familiar',   icone: '👨‍👩‍👧' },
    grupo:      { rotulo: 'Em grupo',   icone: '👥' }
};

/** Rótulo curto do tipo de uma sessão avulsa ('' quando não marcado). */
export function tipoSessaoLabel(modalidade, nomeGrupo) {
    const t = TIPOS_SESSAO_AVULSA[modalidade];
    if (!t) return '';
    return `${t.icone} ${t.rotulo}${modalidade === 'grupo' && nomeGrupo ? `: ${nomeGrupo}` : ''}`;
}

// ---------- datas (sempre em strings 'YYYY-MM-DD', sem fuso) ----------
export function hojeISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function paraData(iso) { // 'YYYY-MM-DD' -> Date local ao meio-dia (imune a fuso)
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d, 12);
}
export function paraISO(dt) {
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}
export function somarDias(iso, n) {
    const dt = paraData(iso); dt.setDate(dt.getDate() + n); return paraISO(dt);
}
export function formataBR(iso) {
    if (!iso) return '';
    const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`;
}
export function formataMoeda(v) {
    return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const LIMITE_OCORRENCIAS = 2000; // trava de segurança p/ recorrência sem fim

/**
 * Expande uma dinâmica em ocorrências projetadas dentro de [de, ate].
 * Sempre percorre desde data_inicio (para contar ocorrências/quotas certas).
 * Retorna [{data, hora, dinamica_ref, paciente_id, ...contexto}]
 */
export function expandirDinamica(d, de, ate) {
    if (!d || d.ativo === false) return [];
    if (d.recorrencia_tipo === 'avulsa') return []; // avulsas vivem só em argos_sessoes
    const dias = Array.isArray(d.dias) ? d.dias : [];
    if (!dias.length || !d.data_inicio) return [];

    let fim = ate;
    if (d.fim_tipo === 'data' && d.fim_data && d.fim_data < fim) fim = d.fim_data;
    // corte duro (encerramento/interrupção do processo do paciente):
    // vale por cima de qualquer fim programado, sem afetar a contagem de ocorrências
    if (d.corte_data && d.corte_data < fim) fim = d.corte_data;
    const maxOcorr = d.fim_tipo === 'apos_ocorrencias' ? (d.fim_ocorrencias || 0) : Infinity;

    const out = [];
    let total = 0;
    let mesAtual = '', contMes = 0;
    let semanaAtual = '', contSemana = 0;

    for (let iso = d.data_inicio, passos = 0; iso <= fim && total < maxOcorr && passos < LIMITE_OCORRENCIAS * 7; iso = somarDias(iso, 1), passos++) {
        const dt = paraData(iso);
        const dow = dt.getDay();

        const mes = iso.slice(0, 7);
        if (mes !== mesAtual) { mesAtual = mes; contMes = 0; }
        // semana: chave = segunda-feira da semana
        const seg = somarDias(iso, -((dow + 6) % 7));
        if (seg !== semanaAtual) { semanaAtual = seg; contSemana = 0; }

        const horasDoDia = (d.freq_periodo === 'dia')
            ? dias.map(x => x.hora)                                  // todo dia, nas horas listadas
            : dias.filter(x => Number(x.dow) === dow).map(x => x.hora);

        for (const hora of horasDoDia.sort()) {
            if (total >= maxOcorr) break;
            if (d.freq_qtd) { // quota "X sessões por período"
                if (d.freq_periodo === 'mes' && contMes >= d.freq_qtd) continue;
                if (d.freq_periodo === 'semana' && contSemana >= d.freq_qtd) continue;
                if (d.freq_periodo === 'dia') {
                    const noDia = out.filter(o => o.data === iso && o.dinamica_ref === d.id).length;
                    if (noDia >= d.freq_qtd) continue;
                }
            }
            total++; contMes++; contSemana++;
            if (iso >= de) {
                out.push({
                    data: iso, hora, dinamica_ref: d.id,
                    paciente_id: d.paciente_id,
                    sala_id: d.sala_id, profissional_id: d.profissional_id,
                    servico_id: d.servico_id, duracao_min: d.duracao_min || 60,
                    modalidade: d.modalidade, numero: total
                });
            }
        }
    }
    return out;
}

/**
 * Mescla projeções com sessões materializadas: a materializada (mesma
 * dinâmica+data+hora) substitui a projeção. Sessões avulsas/manuais entram
 * como estão. Retorna lista ordenada por data+hora com campo status.
 */
export function mesclarSessoes(dinamicas, sessoesMaterializadas, de, ate) {
    // sessões remarcadas casam com a projeção da ocorrência ORIGINAL
    // (remarcada_de_*), mas são exibidas na data/hora nova
    const mat = new Map();
    const out = [];
    for (const s of sessoesMaterializadas || []) {
        if (s.dinamica_ref) {
            mat.set(`${s.dinamica_ref}|${s.remarcada_de_data || s.data}|${s.remarcada_de_hora || s.hora}`, s);
        } else if (s.data >= de && s.data <= ate) {
            out.push({ ...s, projetada: false });
        }
    }
    const noIntervalo = s => s.data >= de && s.data <= ate;
    for (const d of dinamicas || []) {
        for (const p of expandirDinamica(d, de, ate)) {
            const chave = `${p.dinamica_ref}|${p.data}|${p.hora}`;
            const m = mat.get(chave);
            if (m) {
                mat.delete(chave);
                // a sessão gravada só traz o que foi mudado nela: espaço e
                // profissional em branco continuam sendo os da dinâmica, senão
                // a ocorrência materializada perde o lugar onde acontece
                if (noIntervalo(m)) out.push({ ...p, ...m, projetada: false,
                    sala_id: m.sala_id || p.sala_id,
                    profissional_id: m.profissional_id || p.profissional_id });
            } else {
                out.push({ ...p, id: null, status: '??', projetada: true });
            }
        }
    }
    // materializadas restantes (dinâmicas apagadas/alteradas, remarcadas cuja
    // ocorrência original está fora do intervalo, etc.)
    for (const m of mat.values()) if (noIntervalo(m)) out.push({ ...m, projetada: false });
    out.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
    return out;
}

// ---------- Acordo financeiro ----------

/** Valor unitário de referência de uma sessão da dinâmica (para pacote/por_sessao). */
export function valorPorSessao(d) {
    if (d.acordo_tipo === 'por_sessao') return Number(d.valor) || 0;
    if (d.acordo_tipo === 'pacote' && d.pacote_qtd) return (Number(d.pacote_valor) || 0) / d.pacote_qtd;
    return 0;
}

/** Rótulo curto do acordo financeiro. */
export function acordoLabel(d) {
    if (d.acordo_tipo === 'fixo_mensal') return `Fixo mensal ${formataMoeda(d.valor)}`;
    if (d.acordo_tipo === 'por_sessao') return `${formataMoeda(d.valor)} por sessão`;
    if (d.acordo_tipo === 'pacote') return `Pacote de ${d.pacote_qtd || '?'} sessões — ${formataMoeda(d.pacote_valor)}`;
    return '';
}

// ---------- Divisão do acordo com profissionais (repasses) ----------

/** Valor de referência do acordo, base para converter repasses nominais em %:
 *  por_sessao → valor da sessão; fixo_mensal → valor do mês; pacote → valor global. */
export function baseRepasse(d) {
    return Number(d.acordo_tipo === 'pacote' ? d.pacote_valor : d.valor) || 0;
}

/** Unidade da base do acordo, para exibição ("por sessão", "por mês", "do pacote"). */
export function unidadeRepasse(d) {
    return d.acordo_tipo === 'fixo_mensal' ? 'por mês'
        : d.acordo_tipo === 'pacote' ? 'do pacote' : 'por sessão';
}

/** Profissionais responsáveis da dinâmica, com serviço e repasse:
 *  [{profissional_id, servico_id, tipo:'percentual'|'valor', valor}].
 *  valor vazio/0 = profissional atende mas não recebe por produção.
 *  Dinâmicas antigas (profissional_id/servico_id/repasse_percentual em campos
 *  próprios) entram como uma linha equivalente. */
export function repassesDe(d) {
    if (Array.isArray(d.repasses)) return d.repasses.filter(r => r && r.profissional_id);
    if (d.profissional_id) {
        return [{
            profissional_id: d.profissional_id, servico_id: d.servico_id || null,
            tipo: 'percentual',
            valor: d.repasse_percentual != null ? Number(d.repasse_percentual) : null
        }];
    }
    return [];
}

// ---------- Repasse padrão do profissional ----------
// A % combinada com cada profissional vive no cadastro dele; a dinâmica só
// precisa dizer algo quando o combinado daquele paciente é diferente. Linha
// de repasse com valor VAZIO (null) herda o padrão; valor 0 é a escolha
// explícita de não repassar por aquela dinâmica.
let REPASSE_PADRAO = new Map(); // profissional_id → % (0–100)

/** Registra os padrões a partir da lista de profissionais carregada da página. */
export function definirRepassePadrao(profissionais) {
    REPASSE_PADRAO = new Map();
    for (const p of profissionais || []) {
        if (p && p.id && p.repasse_padrao != null && p.repasse_padrao !== '') {
            REPASSE_PADRAO.set(p.id, Number(p.repasse_padrao) || 0);
        }
    }
}

/** A % padrão de um profissional, ou null se ele não tem uma definida. */
export function repassePadraoDe(profissional_id) {
    return REPASSE_PADRAO.has(profissional_id) ? REPASSE_PADRAO.get(profissional_id) : null;
}

/** Fração (0–1) da base do acordo que um repasse representa. */
export function fracaoRepasse(d, r) {
    if (r.valor == null) { // a dinâmica não definiu: vale o padrão do profissional
        const padrao = repassePadraoDe(r.profissional_id);
        return padrao != null ? padrao / 100 : 0;
    }
    if (r.tipo === 'valor') {
        const base = baseRepasse(d);
        return base > 0 ? (Number(r.valor) || 0) / base : 0;
    }
    return (Number(r.valor) || 0) / 100;
}

/**
 * Fração (0–1) que um profissional recebe de um paciente numa data qualquer —
 * para lançamentos sem dinâmica (sessões avulsas). Vale o combinado do PAR:
 * a % dele na dinâmica do paciente vigente na data (senão, a mais recente);
 * só sem dinâmica nenhuma com ele é que o padrão do cadastro decide.
 */
export function fracaoDoPar(dinamicas, profissional_id, data) {
    if (!profissional_id) return 0;
    const porInicio = (a, b) => String(b.data_inicio || '').localeCompare(String(a.data_inicio || ''));
    const minhas = (dinamicas || []).filter(d =>
        repassesDe(d).some(r => r.profissional_id === profissional_id));
    const vigente = d => d.ativo !== false
        && (!d.data_inicio || d.data_inicio <= data)
        && !(d.fim_tipo === 'data' && d.fim_data && d.fim_data < data);
    const escolhida = minhas.filter(vigente).sort(porInicio)[0]
        || minhas.sort(porInicio)[0];
    if (escolhida) {
        const r = repassesDe(escolhida).find(x => x.profissional_id === profissional_id);
        return fracaoRepasse(escolhida, r);
    }
    const padrao = repassePadraoDe(profissional_id);
    return padrao != null ? padrao / 100 : 0;
}

/** Resumo da divisão do acordo: itens com % equivalente e a parte da clínica.
 *  { itens:[{profissional_id, tipo, valor, pct, valorBase}], pctProfs, pctClinica, valorClinica, base } */
export function divisaoRepasses(d) {
    const base = baseRepasse(d);
    const itens = repassesDe(d).map(r => {
        const pct = fracaoRepasse(d, r) * 100;
        return { ...r, pct, valorBase: base * pct / 100 };
    });
    const pctProfs = itens.reduce((s, r) => s + r.pct, 0);
    const pctClinica = Math.max(0, 100 - pctProfs);
    return { itens, pctProfs, pctClinica, valorClinica: base * pctClinica / 100, base };
}

/** Repasses em R$ sobre o faturamento de um período (valorFaturado da dinâmica no mês).
 *  Nominais são proporcionais à base (ex.: R$ 30 numa sessão de R$ 200 = 15% do faturado).
 *  GARANTIA: a soma dos repasses por produção nunca ultrapassa o valor faturado —
 *  se a configuração somar mais de 100%, os repasses são reduzidos proporcionalmente. */
export function repassesDoValor(d, valorFaturado) {
    const v = Number(valorFaturado) || 0;
    let itens = repassesDe(d).map(r => ({
        profissional_id: r.profissional_id, tipo: r.tipo,
        valor_config: Number(r.valor) || 0,
        pct: fracaoRepasse(d, r) * 100,
        valor: v * fracaoRepasse(d, r)
    })).filter(r => r.valor > 0);
    const soma = itens.reduce((s, r) => s + r.valor, 0);
    if (soma > v && soma > 0) {
        const fator = v / soma;
        itens = itens.map(r => ({ ...r, valor: r.valor * fator, pct: r.pct * fator }));
    }
    return itens;
}

export const PACOTE_MODOS = {
    inicio:            'Tudo no início (na 1ª sessão)',
    final:             'Tudo no final (na última sessão)',
    inicio_final:      'Uma parte no início e outra no final',
    a_cada_x:          'Dividido a cada X sessões',
    parcelas_datas:    'Parcelas em datas específicas',
    mensal_diluido:    'Diluído por mês (partes iguais a cada mês do pacote)',
    entrada_parcelas:  'Entrada + N parcelas mensais'
};

/**
 * Cronograma de pagamentos de um pacote: [{data, valor, descricao}].
 * ocorrencias = datas das sessões do pacote (as pacote_qtd primeiras).
 */
export function cronogramaPacote(d, ocorrencias) {
    const total = Number(d.pacote_valor) || 0;
    const qtd = d.pacote_qtd || ocorrencias.length || 1;
    const sess = ocorrencias.slice(0, qtd);
    const pg = d.pacote_pagamento || { modo: 'inicio' };
    const primeira = sess[0] ? sess[0].data : d.data_inicio;
    const ultima = sess.length ? sess[sess.length - 1].data : d.data_inicio;
    const ev = [];

    switch (pg.modo) {
        case 'final':
            ev.push({ data: ultima, valor: total, descricao: 'Pacote — pagamento único no final' });
            break;
        case 'inicio_final': {
            const v1 = Number(pg.valor_inicio) || total / 2;
            ev.push({ data: primeira, valor: v1, descricao: 'Pacote — parte inicial' });
            ev.push({ data: ultima, valor: total - v1, descricao: 'Pacote — parte final' });
            break;
        }
        case 'a_cada_x': {
            const x = Math.max(1, Number(pg.x) || 1);
            const per = total / qtd;
            for (let i = 0; i < sess.length; i += x) {
                const bloco = sess.slice(i, i + x);
                ev.push({ data: bloco[bloco.length - 1].data, valor: per * bloco.length, descricao: `Pacote — bloco de ${bloco.length} sessões` });
            }
            break;
        }
        case 'parcelas_datas':
            for (const p of (pg.parcelas || [])) {
                ev.push({ data: p.data, valor: Number(p.valor) || 0, descricao: 'Pacote — parcela em data específica' });
            }
            break;
        case 'mensal_diluido': {
            const meses = [];
            for (let m = primeira.slice(0, 7); m <= ultima.slice(0, 7);) {
                meses.push(m);
                const [a, mm] = m.split('-').map(Number);
                m = (mm === 12 ? (a + 1) + '-01' : a + '-' + String(mm + 1).padStart(2, '0'));
            }
            meses.forEach(m => ev.push({ data: m + '-01', valor: total / meses.length, descricao: 'Pacote — parte mensal' }));
            break;
        }
        case 'entrada_parcelas': {
            const entrada = Number(pg.entrada) || 0;
            const n = Math.max(1, Number(pg.n_parcelas) || 1);
            ev.push({ data: primeira, valor: entrada, descricao: 'Pacote — entrada' });
            for (let i = 1; i <= n; i++) {
                const dt = paraData(primeira); dt.setMonth(dt.getMonth() + i);
                ev.push({ data: paraISO(dt), valor: (total - entrada) / n, descricao: `Pacote — parcela ${i}/${n}` });
            }
            break;
        }
        case 'inicio':
        default:
            ev.push({ data: primeira, valor: total, descricao: 'Pacote — pagamento único no início' });
    }
    return ev.filter(e => e.data);
}

// ---------- Conflitos de agenda ----------

function minutos(hora) { const [h, m] = String(hora).split(':').map(Number); return h * 60 + (m || 0); }

/** Duas sessões se sobrepõem no tempo (mesma data, horários cruzados)? */
export function sobrepoe(a, b) {
    if (a.data !== b.data) return false;
    const ia = minutos(a.hora), fa = ia + (a.duracao_min || 60);
    const ib = minutos(b.hora), fb = ib + (b.duracao_min || 60);
    return ia < fb && ib < fa;
}

// Mesmo lugar na agenda. Quando os DOIS lados dizem em que espaço acontecem,
// o espaço decide sozinho: atendimento em outro ambiente — ou ONLINE — não
// disputa a sala com quem ficou no salão, ainda que a dinâmica esteja no nome
// do mesmo profissional (nos grupos ele é quem cobra e supervisiona, não quem
// conduz). Sem espaço declarado de um dos lados, vale o profissional.
function mesmoLugar(a, b) {
    if (a.sala_id && b.sala_id) return a.sala_id === b.sala_id;
    return !!(a.profissional_id && b.profissional_id && a.profissional_id === b.profissional_id);
}

// modalidade efetiva de uma sessão: sessões nascidas de grupo terapêutico
// (grupo_ref) contam como 'grupo'; sem informação, individual
const modalidadeDe = s => s.modalidade || (s.grupo_ref || s.grupo_id ? 'grupo' : 'individual');

/**
 * Duas versões da mesma dinâmica ocupam o mesmo lugar na agenda? Compara só
 * o que decide onde e quando ela cai — dia, hora, duração, profissional,
 * sala, modalidade e período. Serve para não recusar um salvamento que não
 * mexeu na agenda: quem só muda o valor do acordo não está criando choque
 * nenhum, e não deve ser barrado por um que já existia.
 */
export function mesmaAgenda(a, b) {
    if (!a || !b) return false;
    const campos = ['recorrencia_tipo', 'duracao_min', 'profissional_id', 'sala_id',
        'modalidade', 'data_inicio', 'fim_tipo', 'fim_data', 'fim_ocorrencias', 'grupo_id'];
    if (campos.some(c => (a[c] ?? null) !== (b[c] ?? null))) return false;
    const dias = d => JSON.stringify((d.dias || []).map(x => `${x.dow}|${x.hora}`).sort());
    return dias(a) === dias(b) && (a.ativo !== false) === (b.ativo !== false);
}

/**
 * Conflitos que uma dinâmica NOVA/EDITADA criaria: sessões de OUTROS
 * pacientes no mesmo espaço ou com o mesmo profissional, em horário
 * sobreposto, quando qualquer um dos lados é INDIVIDUAL (grupo+grupo pode).
 * Retorna até 5 conflitos [{minha, outra}].
 *
 * Só o que ainda vai acontecer conta. Sobreposição no passado é registro do
 * que houve, não reserva a proteger: recusar o salvamento não a desfaz, e
 * travaria para sempre a edição de quem herdou um histórico com choques —
 * mudar só o valor do acordo é barrado por uma sessão de janeiro.
 */
export function conflitosDeDinamica(nova, outrasDinamicas, sessoes, horizonteDias = 365) {
    if (nova.recorrencia_tipo !== 'recorrente' || !nova.data_inicio || nova.ativo === false) return [];
    const hoje = hojeISO();
    const de = nova.data_inicio > hoje ? nova.data_inicio : hoje;
    const ate = somarDias(hoje, horizonteDias);
    const minhas = expandirDinamica({ ...nova, id: nova.id || 'nova', ativo: true }, de, ate)
        .map(m => ({ ...m, duracao_min: nova.duracao_min || 60 }));
    const existentes = mesclarSessoes(outrasDinamicas, sessoes, de, ate)
        .filter(s => s.paciente_id !== nova.paciente_id && s.status !== 'nc');
    const out = [];
    for (const m of minhas) {
        for (const s of existentes) {
            if (!mesmoLugar(m, s) || !sobrepoe(m, s)) continue;
            const temIndividual = nova.modalidade === 'individual' || modalidadeDe(s) === 'individual';
            if (temIndividual) { out.push({ minha: m, outra: s }); if (out.length >= 5) return out; }
        }
    }
    return out;
}

/** Conflitos de uma sessão pontual (sem modalidade = individual). Até 5. */
export function conflitosDeSessao(sessao, dinamicas, sessoes) {
    return mesclarSessoes(dinamicas, sessoes, sessao.data, sessao.data)
        .filter(s => s.paciente_id !== sessao.paciente_id && s.status !== 'nc'
            && (!sessao.id || s.id !== sessao.id)
            && mesmoLugar(sessao, s) && sobrepoe(sessao, s)
            && (modalidadeDe(sessao) === 'individual' || modalidadeDe(s) === 'individual'))
        .slice(0, 5);
}

// ---------- Cadeias de continuidade (mudança de horário fixo) ----------

/** Raiz da cadeia de continuações de uma dinâmica. */
export function raizDaCadeia(d, dinamicas) {
    const porId = {};
    (dinamicas || []).forEach(x => { porId[x.id] = x; });
    let atual = d, guarda = 0;
    while (atual && atual.continuacao_de && porId[atual.continuacao_de] && guarda++ < 20) {
        atual = porId[atual.continuacao_de];
    }
    return atual || d;
}

/** Ocorrências da cadeia inteira (raiz + continuações), em ordem cronológica. */
export function ocorrenciasDaCadeia(root, dinamicas, ateISO) {
    const membros = (dinamicas || [])
        .filter(x => raizDaCadeia(x, dinamicas).id === root.id)
        .sort((a, b) => (a.data_inicio || '').localeCompare(b.data_inicio || ''));
    if (!membros.length) membros.push(root);
    const occ = [];
    for (const m of membros) {
        if (m.data_inicio) occ.push(...expandirDinamica({ ...m, ativo: true }, m.data_inicio, ateISO));
    }
    occ.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
    return occ;
}

/**
 * Encerramento/interrupção do processo: a partir de paciente.processo_fim_data
 * o paciente não consta mais na agenda nem nas finanças, não importa o que
 * esteja programado. Devolve cópias com o corte aplicado:
 * dinâmicas ganham corte_data (véspera) e sessões a partir da data somem.
 */
export function aplicarFimDeProcesso(dinamicas, sessoes, pacientes) {
    const fimDe = {};
    (pacientes || []).forEach(p => {
        if (!p) return;
        // sem data informada o corte vale de hoje: não se projeta mais nada
        // para quem já não vem, e o histórico até aqui fica de pé
        if (p.processo_fim_data) fimDe[p.id] = p.processo_fim_data;
        else if (p.processo_fim_tipo) fimDe[p.id] = hojeISO();
    });
    if (!Object.keys(fimDe).length) return { dinamicas: dinamicas || [], sessoes: sessoes || [] };
    const dins = (dinamicas || []).map(d => {
        const fim = fimDe[d.paciente_id];
        if (!fim) return d;
        const corte = somarDias(fim, -1);
        return { ...d, corte_data: d.corte_data && d.corte_data < corte ? d.corte_data : corte };
    });
    const sess = (sessoes || []).filter(s => !fimDe[s.paciente_id] || s.data < fimDe[s.paciente_id]);
    return { dinamicas: dins, sessoes: sess };
}

/** Último dia do mês 'YYYY-MM' em ISO. */
export function fimDoMes(mes) {
    const [a, m] = mes.split('-').map(Number);
    return paraISO(new Date(a, m, 0, 12));
}

/**
 * Fechamento de um mês ('YYYY-MM') para um paciente.
 * Regras: Ok e Fc contabilizam; ?? de data futura conta como presença
 * projetada; ?? de data já vencida NÃO contabiliza e vira pendência.
 * Fj e Nc não contabilizam.
 * Retorna { sessoes, contagens, pendencias, valor, detalhes[] }.
 */
export function fechamentoPaciente(paciente, dinamicas, sessoes, mes) {
    const de = mes + '-01';
    const ate = fimDoMes(mes);
    const hoje = hojeISO();
    // processo encerrado/interrompido: nada conta a partir da data informada
    if (paciente && paciente.processo_fim_data) {
        const c = aplicarFimDeProcesso(dinamicas, sessoes, [paciente]);
        dinamicas = c.dinamicas;
        sessoes = c.sessoes;
    }
    const sess = mesclarSessoes(dinamicas, sessoes, de, ate);

    const contagens = { '??': 0, ok: 0, fj: 0, fc: 0, nc: 0 };
    sess.forEach(s => { contagens[s.status] = (contagens[s.status] || 0) + 1; });
    const pendencias = sess.filter(s => s.status === '??' && s.data < hoje).length;

    let valor = 0;
    const detalhes = [];
    const porDinamica = []; // {dinamica_id, profissional_id, valor, repasses:[{profissional_id, tipo, valor_config, pct, valor}]}
    const cobraSessao = s => COBRAVEIS.includes(s.status) || (s.status === '??' && s.data >= hoje);
    const fixoCobrado = new Set(); // uma cobrança fixa por cadeia de continuidade/mês

    for (const d of dinamicas || []) {
        const doMes = sess.filter(s => s.dinamica_ref === d.id);
        if (d.acordo_tipo === 'fixo_mensal') {
            const root = raizDaCadeia(d, dinamicas);
            if (fixoCobrado.has(root.id)) continue; // outro elo da cadeia já cobrou o mês
            let fimJanela = null;
            if (d.fim_tipo === 'data') fimJanela = d.fim_data;
            if (d.fim_tipo === 'apos_ocorrencias') {
                const todas = expandirDinamica({ ...d, ativo: true }, d.data_inicio || de, somarDias(ate, 366 * 3));
                fimJanela = todas.length ? todas[todas.length - 1].data : null;
            }
            if (d.corte_data && (!fimJanela || d.corte_data < fimJanela)) fimJanela = d.corte_data;
            const cobre = d.data_inicio && d.data_inicio <= ate && (!fimJanela || fimJanela >= de)
                && (d.ativo !== false || doMes.length > 0);
            if (cobre) {
                fixoCobrado.add(root.id);
                valor += Number(d.valor) || 0;
                detalhes.push(`${d.rotulo || 'Dinâmica'} — fixo mensal: ${formataMoeda(d.valor)}`);
                porDinamica.push({ dinamica_id: d.id, profissional_id: d.profissional_id, valor: Number(d.valor) || 0, repasses: repassesDoValor(d, Number(d.valor) || 0) });
            }
        } else if (d.acordo_tipo === 'por_sessao') {
            const n = doMes.filter(cobraSessao).length;
            if (n) {
                const v = n * (Number(d.valor) || 0);
                valor += v;
                detalhes.push(`${d.rotulo || 'Dinâmica'} — ${n} sessão(ões) × ${formataMoeda(d.valor)} = ${formataMoeda(v)}`);
                porDinamica.push({ dinamica_id: d.id, profissional_id: d.profissional_id, valor: v, repasses: repassesDoValor(d, v) });
            }
        } else if (d.acordo_tipo === 'pacote') {
            // o contrato do pacote vale pela CADEIA: só a raiz calcula, usando
            // as ocorrências combinadas (dinâmica encerrada + continuações)
            const root = raizDaCadeia(d, dinamicas);
            if (root.id !== d.id) continue;
            const todas = ocorrenciasDaCadeia(d, dinamicas, somarDias(ate, 366 * 3));
            const eventos = cronogramaPacote(d, todas).filter(e => e.data >= de && e.data <= ate);
            let vPacote = 0;
            for (const e of eventos) {
                vPacote += Number(e.valor) || 0;
                detalhes.push(`${d.rotulo || 'Pacote'} — ${e.descricao} (${formataBR(e.data)}): ${formataMoeda(e.valor)}`);
            }
            if (vPacote) {
                valor += vPacote;
                porDinamica.push({ dinamica_id: d.id, profissional_id: d.profissional_id, valor: vPacote, repasses: repassesDoValor(d, vPacote) });
            }
        }
    }

    // sessões avulsas/manuais (sem dinâmica): valor próprio de cada sessão.
    // Quem atendeu recebe pelo combinado do PAR (a % dele nas dinâmicas deste
    // paciente; sem dinâmica, o padrão do cadastro). Sem profissional ou sem
    // % nenhuma, o valor fica integralmente com a clínica.
    for (const s of sess.filter(x => !x.dinamica_ref)) {
        if (cobraSessao(s) && s.valor != null) {
            const v = Number(s.valor) || 0;
            valor += v;
            detalhes.push(`Sessão avulsa${s.modalidade
                ? ` (${tipoSessaoLabel(s.modalidade)})` : ''} ${formataBR(s.data)} ${s.hora}: ${formataMoeda(s.valor)}`);
            const frac = fracaoDoPar(dinamicas || [], s.profissional_id, s.data);
            porDinamica.push({
                dinamica_id: null, profissional_id: s.profissional_id, valor: v,
                repasses: frac > 0 ? [{
                    profissional_id: s.profissional_id, tipo: 'percentual',
                    valor_config: frac * 100, pct: frac * 100, valor: v * frac
                }] : []
            });
        }
    }

    // anamnese cobrada no mês
    if (paciente && paciente.anamnese_cobrar && paciente.anamnese_data
        && paciente.anamnese_data >= de && paciente.anamnese_data <= ate) {
        valor += Number(paciente.anamnese_valor) || 0;
        detalhes.push(`Anamnese (${formataBR(paciente.anamnese_data)}): ${formataMoeda(paciente.anamnese_valor)}`);
    }

    return { sessoes: sess, contagens, pendencias, valor, detalhes, porDinamica };
}

// argos-import-dinamicas.js — das abas de frequência para dinâmicas e grupos
// ==========================================================================
// A planilha guarda, para cada mês, o horário de cada par paciente ×
// profissional. Quando o horário muda de um mês para o outro, não é uma
// dinâmica nova do zero: é a mesma combinação continuando noutro dia. Por
// isso a dinâmica anterior é encerrada no fim do mês em que valeu e a nova
// aponta para ela em `continuacao_de` — a cadeia preserva a história sem
// duplicar o paciente.
//
// Grupo é horário com mais de um paciente. O nome é o próprio horário
// ("2ª 17:10") e os profissionais são os que têm ao menos um paciente ali,
// menos a Patricia: ela é dona e supervisora, e entra num grupo só quando
// o atendimento é individual ou familiar.

import { COBRA, PROFISSIONAL_PADRAO, SUFIXO_PROFISSIONAL} from './argos-import-freq.js';

export const DOW_ROTULO = ['Dom', '2ª', '3ª', '4ª', '5ª', '6ª', 'Sáb'];

/** Nome do grupo: o horário, como você já chama hoje. */
export const nomeDoHorario = (dow, hora) => `${DOW_ROTULO[dow] || '?'} ${hora}`;

/** Último dia do mês, para fechar a dinâmica que mudou de horário. */
export function fimDoMes(ano, mes) {
    const d = new Date(Date.UTC(ano, mes, 0));
    return `${ano}-${String(mes).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
export const inicioDoMes = (ano, mes) => `${ano}-${String(mes).padStart(2, '0')}-01`;

/**
 * Agrupa as linhas de todos os meses por par paciente × profissional e
 * quebra em trechos contíguos de mesmo horário.
 *
 * porMes — { 1: [linhas de janeiro], 2: [...] }
 *
 * Devolve [{ chave, paciente, profissional, trechos: [{ dow, hora,
 * de, ate, meses, sessoes }] }].
 */
/**
 * Assinatura que separa dois acordos do mesmo paciente com o mesmo
 * profissional: os sufixos da planilha, tirando a sigla do profissional
 * (que já está na chave). É o que distingue "(ELIS) (PM)" de "(ELIS) (PP)".
 */
const assinaturaDoAcordo = l => (l.sufixos || [])
    .filter(x => !SUFIXO_PROFISSIONAL[x]).sort().join('+');

export function trechosPorPar(porMes, ano) {
    // Um paciente pode ter DOIS acordos em paralelo com o mesmo profissional
    // no mesmo horário — a planilha os separa por sufixo, como (PM) e (PP) de
    // um mesmo plano. Sem isso os dois colapsam num só e o mês fecha pela
    // metade. Duas linhas com a MESMA assinatura continuam sendo a mesma
    // coisa repetida, e seguem juntas.
    const duplicados = new Set();
    for (const mes of Object.keys(porMes)) {
        const conta = new Map();
        for (const l of porMes[mes]) {
            const base = `${l.chave}|${l.profissional}`;
            conta.set(base, (conta.get(base) || 0) + 1);
        }
        for (const [base, n] of conta) if (n > 1) duplicados.add(base);
    }

    const pares = new Map();
    for (const mes of Object.keys(porMes).map(Number).sort((a, b) => a - b)) {
        for (const l of porMes[mes]) {
            const base = `${l.chave}|${l.profissional}`;
            const k = duplicados.has(base) ? `${base}|${assinaturaDoAcordo(l)}` : base;
            let p = pares.get(k);
            if (!p) {
                // `id` é a chave de agrupamento: quem consome os pares precisa
                // dela para não confundir dois acordos paralelos do mesmo par
                p = { id: k, chave: l.chave, paciente: l.paciente, profissional: l.profissional,
                      sufixos: l.sufixos, meses: [] };
                pares.set(k, p);
            }
            p.meses.push(l);
            if (l.paciente.length > p.paciente.length) p.paciente = l.paciente;
        }
    }

    const saida = [];
    for (const p of pares.values()) {
        const trechos = [];
        for (const l of p.meses) {
            // mês sem horário não abre nem fecha trecho: só pendura as
            // sessões no trecho vigente, se houver
            const temHorario = l.dow != null && l.hora;
            const ult = trechos[trechos.length - 1];
            if (temHorario && (!ult || ult.dow !== l.dow || ult.hora !== l.hora)) {
                trechos.push({ dow: l.dow, hora: l.hora, de: inicioDoMes(ano, l.mes),
                    ate: fimDoMes(ano, l.mes), meses: [l.mes], sessoes: [...l.sessoes],
                    linhas: [l] });
            } else if (ult) {
                ult.ate = fimDoMes(ano, l.mes);
                if (!ult.meses.includes(l.mes)) ult.meses.push(l.mes);
                ult.sessoes.push(...l.sessoes);
                ult.linhas.push(l);
            } else if (l.sessoes.length) {
                // sessões antes de qualquer horário conhecido (linhas soltas
                // da seção OUTROS): viram um trecho sem dia fixo
                trechos.push({ dow: null, hora: '', de: inicioDoMes(ano, l.mes),
                    ate: fimDoMes(ano, l.mes), meses: [l.mes], sessoes: [...l.sessoes],
                    linhas: [l], avulso: true });
            }
        }
        if (trechos.length) saida.push({ ...p, trechos });
    }
    return saida.sort((a, b) => a.paciente.localeCompare(b.paciente, 'pt-BR')
        || a.profissional.localeCompare(b.profissional, 'pt-BR'));
}

/**
 * Horários que têm mais de um paciente em algum mês — os grupos.
 * Só o bloco GRUPO conta: individual e família são atendimentos daquele
 * paciente, não do horário.
 */
export function gruposDosHorarios(porMes) {
    const slots = new Map();
    for (const mes of Object.keys(porMes).map(Number)) {
        for (const l of porMes[mes]) {
            if (l.dow == null || !l.hora) continue;
            if (!l.sessoes.some(s => s.bloco === 'grupo')) continue;
            const k = `${l.dow}|${l.hora}`;
            let g = slots.get(k);
            if (!g) {
                g = { dow: l.dow, hora: l.hora, nome: nomeDoHorario(l.dow, l.hora),
                      pacientes: new Set(), profissionais: new Set(), meses: new Set(),
                      porMes: new Map() };
                slots.set(k, g);
            }
            g.pacientes.add(l.chave);
            g.meses.add(mes);
            if (!g.porMes.has(mes)) g.porMes.set(mes, new Set());
            g.porMes.get(mes).add(l.chave);
            // a dona da clínica supervisiona o grupo, não o conduz
            if (l.profissional !== PROFISSIONAL_PADRAO) g.profissionais.add(l.profissional);
        }
    }
    return [...slots.values()]
        // grupo é horário que teve mais de um paciente AO MESMO TEMPO. Dois
        // pacientes que passaram pelo mesmo horário em meses diferentes são
        // uma sucessão de atendimentos individuais, não um grupo.
        .filter(g => Math.max(...[...g.porMes.values()].map(s => s.size)) > 1)
        .map(g => ({ ...g, pacientes: [...g.pacientes], porMes: undefined,
            maiorTurma: Math.max(...[...g.porMes.values()].map(s => s.size)),
            profissionais: [...g.profissionais].sort(), meses: [...g.meses].sort((a, b) => a - b) }))
        .sort((a, b) => a.dow - b.dow || a.hora.localeCompare(b.hora));
}

/**
 * Sessões de um trecho, já com horário resolvido: as do bloco GRUPO ficam
 * no horário da dinâmica; individuais e familiares são atendimentos à
 * parte e ganham horários próprios para não colidirem.
 */
export function sessoesDoTrecho(trecho) {
    // um mapa de ocupação só para o trecho inteiro: separar grupo de
    // individual em duas contagens fazia a individual cair em cima da
    // segunda sessão de grupo do mesmo dia
    const base = trecho.hora || '09:00';
    const usados = new Map();
    const ordem = { grupo: 0, individual: 1, familia: 2 };
    return [...trecho.sessoes]
        .sort((a, b) => a.data.localeCompare(b.data)
            || (ordem[a.bloco] ?? 9) - (ordem[b.bloco] ?? 9))
        .map(s => {
            const n = usados.get(s.data) || 0;
            usados.set(s.data, n + 1);
            return { ...s, hora: somarHorasDo(base, n) };
        });
}

const somarHorasDo = (h, n) => {
    const [a, b] = String(h).split(':').map(Number);
    return `${String((a + (n || 0)) % 24).padStart(2, '0')}:${String(b || 0).padStart(2, '0')}`;
};

/** Quantas sessões do trecho entram no faturamento. */
export const cobraveisDo = trecho => trecho.sessoes.filter(s => COBRA.has(s.status)).length;

/** Resumo para a tela de conferência antes de importar. */
export function resumo(pares, grupos) {
    const trechos = pares.reduce((s, p) => s + p.trechos.length, 0);
    return {
        pacientes: new Set(pares.map(p => p.chave)).size,
        pares: pares.length,
        dinamicas: trechos,
        continuacoes: trechos - pares.length,
        grupos: grupos.length,
        sessoes: pares.reduce((s, p) => s + p.trechos.reduce((x, t) => x + t.sessoes.length, 0), 0)
    };
}

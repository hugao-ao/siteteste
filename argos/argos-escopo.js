// argos-escopo.js — O que um usuário vinculado a um profissional enxerga
// ======================================================================
// Quem entra com um usuário ligado a um profissional (argos_usuarios.
// profissional_id) e não tem o recurso `escopo_geral` vê só o que é dele:
// os pacientes das dinâmicas em que atende ou recebe repasse, os grupos que
// conduz e as sessões que atendeu ou cobriu. As páginas chamam estas funções
// para filtrar as listas; o master e quem tem `escopo_geral` vê tudo.

import { sb, todas } from './argos-common.js';

/** Lista de profissionais responsáveis por uma dinâmica (principal + repasses). */
function profsDaDinamica(d) {
    const ids = new Set();
    if (d.profissional_id) ids.add(d.profissional_id);
    (Array.isArray(d.repasses) ? d.repasses : []).forEach(r => { if (r && r.profissional_id) ids.add(r.profissional_id); });
    return ids;
}

/**
 * Ids dos pacientes que um profissional atende (ou atendeu).
 * Recebe o que a página já carregou; o que faltar é tratado como vazio.
 */
export function pacientesDoProfissional(profId, { dinamicas = [], sessoes = [], grupos = [], grupoMembros = [], grupoProfs = [] } = {}) {
    const ids = new Set();
    if (!profId) return ids;
    dinamicas.forEach(d => { if (profsDaDinamica(d).has(profId)) ids.add(d.paciente_id); });
    sessoes.forEach(s => {
        if (s.profissional_id === profId || s.repasse_profissional_id === profId) ids.add(s.paciente_id);
    });
    const meusGrupos = new Set(grupos.filter(g => g.profissional_id === profId).map(g => g.id));
    grupoProfs.forEach(gp => { if (gp.profissional_id === profId) meusGrupos.add(gp.grupo_id); });
    grupoMembros.forEach(m => { if (meusGrupos.has(m.grupo_id)) ids.add(m.paciente_id); });
    return ids;
}

/** Filtra uma lista de pacientes pelo escopo do usuário. Escopo geral: devolve tudo. */
export function filtrarPacientes(perm, pacientes, dados) {
    if (!perm || !perm.escopo || perm.escopo.geral) return pacientes;
    const meus = pacientesDoProfissional(perm.escopo.profissionalId, dados);
    return pacientes.filter(p => meus.has(p.id));
}

/** Uma sessão (real ou projetada) é do profissional do escopo? */
export function sessaoNoEscopo(perm, s, dinamicasPorId = null) {
    if (!perm || !perm.escopo || perm.escopo.geral) return true;
    const eu = perm.escopo.profissionalId;
    if (!eu) return false;
    if (s.profissional_id === eu || s.repasse_profissional_id === eu) return true;
    if (dinamicasPorId && s.dinamica_ref) {
        const d = dinamicasPorId.get ? dinamicasPorId.get(s.dinamica_ref) : dinamicasPorId[s.dinamica_ref];
        if (d && profsDaDinamica(d).has(eu)) return true;
    }
    return false;
}

/**
 * Para páginas de um paciente só (evolução, anamnese): consulta o banco e
 * diz se o paciente está no escopo do usuário.
 */
export async function pacienteNoEscopo(perm, pacienteId) {
    if (!perm || !perm.escopo || perm.escopo.geral) return true;
    const eu = perm.escopo.profissionalId;
    if (!eu || !pacienteId) return false;
    const [rDin, rSes, rMem] = await Promise.all([
        sb.from('argos_dinamicas').select('paciente_id, profissional_id, repasses').eq('paciente_id', pacienteId),
        sb.from('argos_sessoes').select('paciente_id, profissional_id, repasse_profissional_id').eq('paciente_id', pacienteId)
            .or(`profissional_id.eq.${eu},repasse_profissional_id.eq.${eu}`).limit(1),
        sb.from('argos_grupo_membros').select('grupo_id, paciente_id').eq('paciente_id', pacienteId)
    ]);
    const membros = rMem.data || [];
    let grupos = [], grupoProfs = [];
    if (membros.length) {
        const ids = membros.map(m => m.grupo_id);
        const [rG, rGP] = await Promise.all([
            sb.from('argos_grupos').select('id, profissional_id').in('id', ids),
            sb.from('argos_grupo_profissionais').select('grupo_id, profissional_id').in('grupo_id', ids)
        ]);
        grupos = rG.data || []; grupoProfs = rGP.data || [];
    }
    return pacientesDoProfissional(eu, {
        dinamicas: rDin.data || [], sessoes: rSes.data || [], grupos, grupoMembros: membros, grupoProfs
    }).has(pacienteId);
}

export { todas };

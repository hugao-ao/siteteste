// argos-anamnese.js — Roteiro da ficha de anamnese
// ================================================
// As perguntas são organizadas pelas MESMAS áreas da Evolução Terapêutica,
// para que a conversa inicial com a família já produza o material da
// avaliação inicial. Cada pergunta é feita ao paciente ou (no caso
// infanto-juvenil) aos responsáveis, e o terapeuta anota a resposta.
// `area` casa com a ordem da área no catálogo (1..8); `geral` fica fora.

export const ANAMNESE_BLOCOS = [
    {
        chave: 'identificacao', titulo: 'Identificação e queixa', icone: '📌',
        cor: '#38bdf8', area: null,
        intro: 'Abertura da conversa: quem procura, por quê e o que se espera do trabalho.',
        perguntas: [
            { chave: 'quem_encaminhou', topico: 'Encaminhamento', texto: 'Quem indicou ou encaminhou o atendimento, e por qual motivo?' },
            { chave: 'queixa_principal', topico: 'Queixa principal', texto: 'O que mais preocupa vocês hoje em relação ao(à) paciente?' },
            { chave: 'inicio_queixa', topico: 'Início e evolução da queixa', texto: 'Quando isso começou a chamar atenção? Mudou alguma coisa nessa época?' },
            { chave: 'expectativa', topico: 'Expectativas da família', texto: 'O que vocês esperam que mude com a terapia?' },
            { chave: 'atendimentos_anteriores', topico: 'Acompanhamentos anteriores', texto: 'Já fez outros acompanhamentos (fono, psicologia, TO, neuro)? Como foram?' },
            { chave: 'saude', topico: 'Condições de saúde', texto: 'Há diagnósticos, medicações, alergias ou questões de saúde que eu deva saber?' },
            { chave: 'gestacao_desenvolvimento', topico: 'Gestação, parto e desenvolvimento', texto: 'Como foram a gestação, o parto e os primeiros anos (sentar, andar, falar)?' },
            { chave: 'rotina', topico: 'Rotina diária', texto: 'Como é a rotina de um dia comum: sono, alimentação, telas, brincadeiras?' }
        ]
    },
    {
        chave: 'psicomotricista', titulo: 'Relação com adultos de referência', icone: '🤝',
        cor: '#38bdf8', area: 1,
        intro: 'Como o paciente se relaciona com adultos que cuidam ou conduzem (base para a relação com o psicomotricista).',
        perguntas: [
            { chave: 'adulto_novo', topico: 'Diante do adulto novo', texto: 'Como ele(a) reage diante de um adulto novo — aproxima-se, ignora, evita, gruda?' },
            { chave: 'adulto_ajuda', topico: 'Pedido de ajuda', texto: 'Quando precisa de ajuda, ele(a) pede? Para quem? Ou tenta sozinho(a)?' },
            { chave: 'adulto_limite', topico: 'Resposta à proposta e ao limite', texto: 'Como responde quando um adulto propõe uma atividade ou coloca um limite?' },
            { chave: 'adulto_vinculo', topico: 'Vínculos de segurança', texto: 'Existe algum adulto com quem ele(a) se sente especialmente seguro(a)? Como é essa relação?' }
        ]
    },
    {
        chave: 'pares', titulo: 'Relação com outras crianças', icone: '👥',
        cor: '#22c55e', area: 2,
        intro: 'Convivência com colegas, irmãos e primos.',
        perguntas: [
            { chave: 'pares_brincar', topico: 'Brincar com outras crianças', texto: 'Ele(a) brinca com outras crianças, ao lado delas, ou prefere ficar só?' },
            { chave: 'pares_grupo', topico: 'Posição no grupo', texto: 'Em grupo, costuma liderar, seguir, disputar ou se afastar?' },
            { chave: 'pares_conflito', topico: 'Resolução de conflitos', texto: 'Como resolve conflitos com colegas? Já houve agressão, choro, isolamento?' },
            { chave: 'pares_amizades', topico: 'Amizades', texto: 'Tem amizades duradouras? Como fala dos amigos?' }
        ]
    },
    {
        chave: 'objetos', titulo: 'Relação com brinquedos e objetos', icone: '🧸',
        cor: '#eab308', area: 3,
        intro: 'O que faz com os objetos e como brinca.',
        perguntas: [
            { chave: 'objetos_preferidos', topico: 'Objetos preferidos', texto: 'Quais são os brinquedos ou objetos preferidos? O que faz com eles?' },
            { chave: 'objetos_brincadeira', topico: 'Modo de brincar', texto: 'A brincadeira tem enredo (faz de conta) ou é mais explorar, empilhar, repetir?' },
            { chave: 'objetos_partilha', topico: 'Partilha e empréstimo', texto: 'Empresta e divide os brinquedos? Como reage quando pedem algo dele(a)?' },
            { chave: 'objetos_apego', topico: 'Apego a objetos', texto: 'Existe algum objeto do qual não se separa? O que acontece se ele some?' }
        ]
    },
    {
        chave: 'espaco', titulo: 'Corpo no espaço e movimento', icone: '🏃',
        cor: '#a855f7', area: 4,
        intro: 'Como ocupa os ambientes e como se movimenta.',
        perguntas: [
            { chave: 'espaco_novo', topico: 'Diante de um espaço novo', texto: 'Em um lugar novo, ele(a) explora, fica na porta, ou gruda em quem levou?' },
            { chave: 'espaco_movimento', topico: 'Qualidade do movimento', texto: 'Como você descreveria o jeito de se mover: parado, agitado, desajeitado, ágil?' },
            { chave: 'espaco_riscos', topico: 'Percepção de risco', texto: 'Percebe riscos (altura, obstáculos) ou já se machucou por não medir?' },
            { chave: 'espaco_organizacao', topico: 'Organização do espaço', texto: 'Organiza o espaço para brincar (monta cabana, separa cantinhos) ou espalha tudo?' }
        ]
    },
    {
        chave: 'tempo', titulo: 'Espera e tolerância', icone: '⏳',
        cor: '#f97316', area: 5,
        intro: 'Como lida com o tempo, com a espera e com o que não sai como quer.',
        perguntas: [
            { chave: 'tempo_espera', topico: 'Capacidade de esperar', texto: 'Consegue esperar a vez? O que faz enquanto espera?' },
            { chave: 'tempo_frustracao', topico: 'Diante da frustração', texto: 'O que acontece quando algo não sai como ele(a) queria?' },
            { chave: 'tempo_transicao', topico: 'Transições entre atividades', texto: 'Como reage quando precisa parar uma atividade e começar outra?' },
            { chave: 'tempo_apoio', topico: 'Recursos para se acalmar', texto: 'O que ajuda a acalmar nesses momentos? Precisa de alguém junto?' }
        ]
    },
    {
        chave: 'frustracao', titulo: 'Escuta, responsabilidade e expressão', icone: '🗣️',
        cor: '#ef4444', area: 6,
        intro: 'Como escuta, se responsabiliza e manifesta o que quer.',
        perguntas: [
            { chave: 'frustracao_escuta', topico: 'Escuta e atenção', texto: 'Consegue escutar até o fim ou interrompe? Precisa de ajuda para manter o foco?' },
            { chave: 'frustracao_responsabilidade', topico: 'Responsabilização', texto: 'Quando faz algo errado, reconhece, culpa os outros, ou nega?' },
            { chave: 'frustracao_reparar', topico: 'Reparação após o conflito', texto: 'Depois de um conflito, faz algo para consertar (pede desculpa, ajuda)?' },
            { chave: 'frustracao_expressao', topico: 'Expressão do que quer e do que não gosta', texto: 'Consegue dizer o que quer e do que não gosta? Como faz isso — cala, grita, explica?' }
        ]
    },
    {
        chave: 'familia', titulo: 'Dinâmica familiar', icone: '🏠',
        cor: '#3b82f6', area: 7,
        intro: 'Perguntas dirigidas aos responsáveis sobre a própria participação — vale registrar também o que se observa no contato.',
        perguntas: [
            { chave: 'familia_composicao', topico: 'Composição da casa e cuidados', texto: 'Quem mora na casa e quem participa dos cuidados no dia a dia?' },
            { chave: 'familia_participacao', topico: 'Participação no processo', texto: 'Quem poderá acompanhar o processo terapêutico e vir às sessões de família?' },
            { chave: 'familia_dificuldades', topico: 'Compreensão familiar das dificuldades', texto: 'Como a família entende as dificuldades do(a) paciente hoje?' },
            { chave: 'familia_combinados', topico: 'Combinados e limites', texto: 'Como funcionam os combinados e limites em casa? Todos seguem a mesma linha?' },
            { chave: 'familia_clima', topico: 'Clima emocional da casa', texto: 'Como está o clima emocional da casa (rotina, mudanças, perdas, conflitos)?' }
        ]
    },
    {
        chave: 'corpo', titulo: 'Relação com o próprio corpo', icone: '🧍',
        cor: '#6366f1', area: 8,
        intro: 'Imagem, consciência, domínio e cuidado do corpo.',
        perguntas: [
            { chave: 'corpo_imagem', topico: 'Imagem e nomeação do corpo', texto: 'Ele(a) reconhece e nomeia as partes do corpo? Como fala do próprio corpo?' },
            { chave: 'corpo_habilidades', topico: 'Habilidades motoras', texto: 'Como está em correr, pular, subir, escrever, abotoar, usar talheres?' },
            { chave: 'corpo_sensibilidade', topico: 'Sensibilidade e conforto', texto: 'Incomoda-se com toque, roupa, barulho, texturas ou alimentos?' },
            { chave: 'corpo_autocuidado', topico: 'Autocuidado', texto: 'O que já faz sozinho(a): banho, escovar dentes, vestir-se, ir ao banheiro?' },
            { chave: 'corpo_prazer', topico: 'Prazer no uso do corpo', texto: 'Demonstra prazer em usar o corpo (dançar, correr, ser abraçado)?' }
        ]
    }
];

export const ANAMNESE_PERGUNTAS = ANAMNESE_BLOCOS.flatMap(b =>
    b.perguntas.map(p => ({ ...p, bloco: b.chave, area: b.area })));

/** Total de perguntas da ficha. */
export const ANAMNESE_TOTAL = ANAMNESE_PERGUNTAS.length;

/** Chaves válidas das perguntas (para não contar campos extras da ficha). */
export const ANAMNESE_CHAVES = new Set(ANAMNESE_PERGUNTAS.map(p => p.chave));

/**
 * Considerações finais do terapeuta: fecha o relatório da anamnese.
 * Fica gravada junto das respostas, mas não é uma das perguntas do roteiro
 * (por isso não entra na contagem nem na geração da avaliação inicial).
 */
export const ANAMNESE_SINTESE = 'relatorio_sintese';

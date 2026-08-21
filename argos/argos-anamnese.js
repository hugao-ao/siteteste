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
            { chave: 'quem_encaminhou', texto: 'Quem indicou ou encaminhou o atendimento, e por qual motivo?' },
            { chave: 'queixa_principal', texto: 'O que mais preocupa vocês hoje em relação ao(à) paciente?' },
            { chave: 'inicio_queixa', texto: 'Quando isso começou a chamar atenção? Mudou alguma coisa nessa época?' },
            { chave: 'expectativa', texto: 'O que vocês esperam que mude com a terapia?' },
            { chave: 'atendimentos_anteriores', texto: 'Já fez outros acompanhamentos (fono, psicologia, TO, neuro)? Como foram?' },
            { chave: 'saude', texto: 'Há diagnósticos, medicações, alergias ou questões de saúde que eu deva saber?' },
            { chave: 'gestacao_desenvolvimento', texto: 'Como foram a gestação, o parto e os primeiros anos (sentar, andar, falar)?' },
            { chave: 'rotina', texto: 'Como é a rotina de um dia comum: sono, alimentação, telas, brincadeiras?' }
        ]
    },
    {
        chave: 'psicomotricista', titulo: 'Relação com adultos de referência', icone: '🤝',
        cor: '#38bdf8', area: 1,
        intro: 'Como o paciente se relaciona com adultos que cuidam ou conduzem (base para a relação com o psicomotricista).',
        perguntas: [
            { chave: 'adulto_novo', texto: 'Como ele(a) reage diante de um adulto novo — aproxima-se, ignora, evita, gruda?' },
            { chave: 'adulto_ajuda', texto: 'Quando precisa de ajuda, ele(a) pede? Para quem? Ou tenta sozinho(a)?' },
            { chave: 'adulto_limite', texto: 'Como responde quando um adulto propõe uma atividade ou coloca um limite?' },
            { chave: 'adulto_vinculo', texto: 'Existe algum adulto com quem ele(a) se sente especialmente seguro(a)? Como é essa relação?' }
        ]
    },
    {
        chave: 'pares', titulo: 'Relação com outras crianças', icone: '👥',
        cor: '#22c55e', area: 2,
        intro: 'Convivência com colegas, irmãos e primos.',
        perguntas: [
            { chave: 'pares_brincar', texto: 'Ele(a) brinca com outras crianças, ao lado delas, ou prefere ficar só?' },
            { chave: 'pares_grupo', texto: 'Em grupo, costuma liderar, seguir, disputar ou se afastar?' },
            { chave: 'pares_conflito', texto: 'Como resolve conflitos com colegas? Já houve agressão, choro, isolamento?' },
            { chave: 'pares_amizades', texto: 'Tem amizades duradouras? Como fala dos amigos?' }
        ]
    },
    {
        chave: 'objetos', titulo: 'Relação com brinquedos e objetos', icone: '🧸',
        cor: '#eab308', area: 3,
        intro: 'O que faz com os objetos e como brinca.',
        perguntas: [
            { chave: 'objetos_preferidos', texto: 'Quais são os brinquedos ou objetos preferidos? O que faz com eles?' },
            { chave: 'objetos_brincadeira', texto: 'A brincadeira tem enredo (faz de conta) ou é mais explorar, empilhar, repetir?' },
            { chave: 'objetos_partilha', texto: 'Empresta e divide os brinquedos? Como reage quando pedem algo dele(a)?' },
            { chave: 'objetos_apego', texto: 'Existe algum objeto do qual não se separa? O que acontece se ele some?' }
        ]
    },
    {
        chave: 'espaco', titulo: 'Corpo no espaço e movimento', icone: '🏃',
        cor: '#a855f7', area: 4,
        intro: 'Como ocupa os ambientes e como se movimenta.',
        perguntas: [
            { chave: 'espaco_novo', texto: 'Em um lugar novo, ele(a) explora, fica na porta, ou gruda em quem levou?' },
            { chave: 'espaco_movimento', texto: 'Como você descreveria o jeito de se mover: parado, agitado, desajeitado, ágil?' },
            { chave: 'espaco_riscos', texto: 'Percebe riscos (altura, obstáculos) ou já se machucou por não medir?' },
            { chave: 'espaco_organizacao', texto: 'Organiza o espaço para brincar (monta cabana, separa cantinhos) ou espalha tudo?' }
        ]
    },
    {
        chave: 'tempo', titulo: 'Espera e tolerância', icone: '⏳',
        cor: '#f97316', area: 5,
        intro: 'Como lida com o tempo, com a espera e com o que não sai como quer.',
        perguntas: [
            { chave: 'tempo_espera', texto: 'Consegue esperar a vez? O que faz enquanto espera?' },
            { chave: 'tempo_frustracao', texto: 'O que acontece quando algo não sai como ele(a) queria?' },
            { chave: 'tempo_transicao', texto: 'Como reage quando precisa parar uma atividade e começar outra?' },
            { chave: 'tempo_apoio', texto: 'O que ajuda a acalmar nesses momentos? Precisa de alguém junto?' }
        ]
    },
    {
        chave: 'frustracao', titulo: 'Escuta, responsabilidade e expressão', icone: '🗣️',
        cor: '#ef4444', area: 6,
        intro: 'Como escuta, se responsabiliza e manifesta o que quer.',
        perguntas: [
            { chave: 'frustracao_escuta', texto: 'Consegue escutar até o fim ou interrompe? Precisa de ajuda para manter o foco?' },
            { chave: 'frustracao_responsabilidade', texto: 'Quando faz algo errado, reconhece, culpa os outros, ou nega?' },
            { chave: 'frustracao_reparar', texto: 'Depois de um conflito, faz algo para consertar (pede desculpa, ajuda)?' },
            { chave: 'frustracao_expressao', texto: 'Consegue dizer o que quer e do que não gosta? Como faz isso — cala, grita, explica?' }
        ]
    },
    {
        chave: 'familia', titulo: 'Dinâmica familiar', icone: '🏠',
        cor: '#3b82f6', area: 7,
        intro: 'Perguntas dirigidas aos responsáveis sobre a própria participação — vale registrar também o que se observa no contato.',
        perguntas: [
            { chave: 'familia_composicao', texto: 'Quem mora na casa e quem participa dos cuidados no dia a dia?' },
            { chave: 'familia_participacao', texto: 'Quem poderá acompanhar o processo terapêutico e vir às sessões de família?' },
            { chave: 'familia_dificuldades', texto: 'Como a família entende as dificuldades do(a) paciente hoje?' },
            { chave: 'familia_combinados', texto: 'Como funcionam os combinados e limites em casa? Todos seguem a mesma linha?' },
            { chave: 'familia_clima', texto: 'Como está o clima emocional da casa (rotina, mudanças, perdas, conflitos)?' }
        ]
    },
    {
        chave: 'corpo', titulo: 'Relação com o próprio corpo', icone: '🧍',
        cor: '#6366f1', area: 8,
        intro: 'Imagem, consciência, domínio e cuidado do corpo.',
        perguntas: [
            { chave: 'corpo_imagem', texto: 'Ele(a) reconhece e nomeia as partes do corpo? Como fala do próprio corpo?' },
            { chave: 'corpo_habilidades', texto: 'Como está em correr, pular, subir, escrever, abotoar, usar talheres?' },
            { chave: 'corpo_sensibilidade', texto: 'Incomoda-se com toque, roupa, barulho, texturas ou alimentos?' },
            { chave: 'corpo_autocuidado', texto: 'O que já faz sozinho(a): banho, escovar dentes, vestir-se, ir ao banheiro?' },
            { chave: 'corpo_prazer', texto: 'Demonstra prazer em usar o corpo (dançar, correr, ser abraçado)?' }
        ]
    }
];

export const ANAMNESE_PERGUNTAS = ANAMNESE_BLOCOS.flatMap(b =>
    b.perguntas.map(p => ({ ...p, bloco: b.chave, area: b.area })));

/** Total de perguntas da ficha. */
export const ANAMNESE_TOTAL = ANAMNESE_PERGUNTAS.length;
